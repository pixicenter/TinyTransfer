import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import db, { updateEmailStatus, updateEmailError, getAppSettings } from '../../../lib/db';
import translations from '../../../lib/translations';

// Interfaces for type-checking the database results
interface Transfer {
  archive_name: string;
  size_bytes: number;
  expires_at: string | null;
}

interface FileCountResult {
  fileCount: number;
}

interface AppSettings {
  id: number;
  app_name: string;
  language: string;
}

// Configure the transporter for email based on environment variables
// Add these variables to the .env.local file
const getTransporter = () => {
  // Check if we're using local sendmail (default option for VPS)
  const useSendmail = process.env.USE_SENDMAIL === 'true';
  
  if (useSendmail) {
    // Use sendmail or postfix local (installed on VPS)
    return nodemailer.createTransport({
      sendmail: true,
      newline: 'unix',
      path: '/usr/sbin/sendmail'
    });
  }
  
  // Check if we're using a special service or direct SMTP
  const service = process.env.EMAIL_SERVICE; // 'gmail', 'sendgrid', 'mailgun', etc
  
  if (service) {
    // Configure for services like Gmail, SendGrid, etc.
    return nodemailer.createTransport({
      service,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });
  } else {
    // Configure direct SMTP
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }
};

const transporter = getTransporter();

// Helper function for translation with parameters
function translate(language: string, key: string, params: Record<string, string> = {}) {
  // Split the key by dots to navigate the nested translation object
  const keys = key.split('.');
  
  // Get the translations for the selected language or fall back to English
  let translation: any = translations[language as 'en' | 'ro'] || translations.en;
  
  // Navigate through the translation object
  for (const k of keys) {
    if (translation && translation[k] !== undefined) {
      translation = translation[k];
    } else {
      // If translation not found, try in English
      console.warn(`Translation key not found: ${key} in ${language}`);
      
      let fallbackTranslation = translations.en;
      for (const fallbackKey of keys) {
        if (fallbackTranslation && fallbackTranslation[fallbackKey] !== undefined) {
          fallbackTranslation = fallbackTranslation[fallbackKey];
        } else {
          // If not found in English either, return the key
          return key;
        }
      }
      
      translation = fallbackTranslation;
      break;
    }
  }
  
  // Replace parameters in the translation
  if (typeof translation === 'string') {
    Object.entries(params).forEach(([param, value]) => {
      translation = translation.replace(`{${param}}`, value);
    });
    return translation;
  }
  
  return key;
}

export async function POST(req: NextRequest) {
  try {
    const { email, downloadLink, transferId, transferName } = await req.json();

    // Validation
    if (!email || !downloadLink || !transferId) {
      return NextResponse.json(
        { error: 'Email, downloadLink and transferId are required' },
        { status: 400 }
      );
    }

    // Get app settings to determine the language
    const appSettings = getAppSettings.get() as AppSettings;
    const language = appSettings?.language || 'en';
    
    // Get app name from environment or settings
    const appName = process.env.APP_NAME || appSettings?.app_name || 'TinyTransfer';
    
    // Get hostname from environment
    const hostname = process.env.HOSTNAME || 'TinyTransfer';

    // Only check configuration if we're not using sendmail
    if (process.env.USE_SENDMAIL !== 'true' && !process.env.EMAIL_USER && !process.env.SMTP_USER) {
      // Update the email error statistics
      updateEmailError.run('Email configuration incomplete', transferId);
      
      return NextResponse.json(
        { error: 'Email configuration is incomplete. Contact the administrator.' },
        { status: 500 }
      );
    }

    // Get transfer information to include in the email
    const getTransferQuery = db.prepare(`
      SELECT archive_name, size_bytes, expires_at FROM transfers WHERE id = ?
    `);
    const transfer = getTransferQuery.get(transferId) as Transfer;

    if (!transfer) {
      // Update the email error statistics
      updateEmailError.run('Transfer not found', transferId);
      
      return NextResponse.json(
        { error: 'Transfer not found' },
        { status: 404 }
      );
    }

    const getFilesCountQuery = db.prepare(`
      SELECT COUNT(*) as fileCount FROM files WHERE transfer_id = ?
    `);
    const { fileCount } = getFilesCountQuery.get(transferId) as FileCountResult;

    // Format size
    const formatBytes = (bytes: number) => {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Format date according to the selected language
    const formatDate = (dateString: string) => {
      const date = new Date(dateString);
      return date.toLocaleDateString(language === 'ro' ? 'ro-RO' : 'en-US');
    };

    // Calculate expiry date and text with translations
    let expiryInfo;
    let expiryText;
    
    if (transfer.expires_at) {
      const formattedDate = formatDate(transfer.expires_at);
      expiryInfo = translate(language, 'emails.transfer.expiry', { date: formattedDate });
      expiryText = translate(language, 'emails.transfer.willExpire', { date: formattedDate });
    } else {
      expiryInfo = translate(language, 'emails.transfer.noExpiry');
      expiryText = translate(language, 'emails.transfer.doesNotExpire');
    }

    // Determine the sender address
    const fromAddress = process.env.EMAIL_FROM || 
                        (process.env.USE_SENDMAIL === 'true' ? 
                          `${appName} <no-reply@${process.env.DOMAIN || 'TinyTransfer.com'}>` : 
                          `${appName} <${process.env.EMAIL_USER || process.env.SMTP_USER}>`);
    
    // Build and send the email with translated content
    const mailOptions = {
      from: fromAddress,
      to: email,
      subject: translate(language, 'emails.transfer.subject', { 
        appName: appName,
        transferName: transferName || transfer.archive_name 
      }),
      text: `
${translate(language, 'emails.transfer.intro', { appName: appName, hostname: hostname })}

${translate(language, 'emails.transfer.transferName')}: ${transferName || transfer.archive_name}
${translate(language, 'emails.transfer.downloadLink')}: ${downloadLink}

${translate(language, 'emails.transfer.details')}:
- ${translate(language, 'emails.transfer.fileCount')}: ${fileCount}
- ${translate(language, 'emails.transfer.totalSize')}: ${formatBytes(transfer.size_bytes)}
- ${expiryInfo}

${translate(language, 'emails.transfer.note', { expiryText: expiryText })}

-- 
${translate(language, 'emails.transfer.team', { appName: appName })}
      `,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(to right, #4F46E5, #6366F1); padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .content { background: #fff; padding: 20px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none; }
    .button { display: inline-block; background: #4F46E5; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; margin: 20px 0; }
    .details { background: #f9fafb; padding: 15px; border-radius: 6px; margin: 20px 0; }
    .details p { margin: 8px 0; }
    .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${appName}</h1>
  </div>
  <div class="content">
    <p>${translate(language, 'emails.transfer.intro', { appName: appName, hostname: hostname })}</p>
    
    <div style="text-align: center;">
      <a href="${downloadLink}" class="button">${translate(language, 'emails.transfer.downloadButton')}</a>
    </div>
    
    <div class="details">
      <p><strong>${translate(language, 'emails.transfer.transferName')}:</strong> ${transferName || transfer.archive_name}</p>
      <p><strong>${translate(language, 'emails.transfer.fileCount')}:</strong> ${fileCount}</p>
      <p><strong>${translate(language, 'emails.transfer.totalSize')}:</strong> ${formatBytes(transfer.size_bytes)}</p>
      <p><strong>Expirare:</strong> ${expiryInfo}</p>
    </div>
    
    <p>${translate(language, 'emails.transfer.note', { expiryText: expiryText })}</p>
    
    <div class="footer">
      <p>© ${new Date().getFullYear()} ${appName}. ${translate(language, 'emails.transfer.allRightsReserved')}</p>
    </div>
  </div>
</body>
</html>
      `
    };

    try {
      // Send the email
      const info = await transporter.sendMail(mailOptions);
      // console.log('Email sent:', info.messageId);

      // Update the email status for the successfully sent email
      updateEmailStatus.run(transferId);

      // Create a table for the email history (optional)
      try {
        db.exec(`
          CREATE TABLE IF NOT EXISTS email_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            transfer_id TEXT NOT NULL,
            recipient_email TEXT NOT NULL,
            sent_at DATETIME NOT NULL,
            message_id TEXT,
            FOREIGN KEY (transfer_id) REFERENCES transfers(id)
          )
        `);

        const insertEmailHistory = db.prepare(`
          INSERT INTO email_history (transfer_id, recipient_email, sent_at, message_id)
          VALUES (?, ?, datetime('now'), ?)
        `);

        insertEmailHistory.run(transferId, email, info.messageId);
      } catch (dbErr) {
        console.error('Error recording email history:', dbErr);
        // Continue execution, this step is optional
      }

      return NextResponse.json({
        success: true,
        message: 'Email sent successfully',
        messageId: info.messageId
      });
    } catch (emailError: any) {
      console.error('Error sending email:', emailError);
      
      // Update the email error statistics
      const errorMessage = emailError.message || 'Error sending email';
      updateEmailError.run(errorMessage.substring(0, 200), transferId); // Limit the error message length
      
      return NextResponse.json({
        success: false,
        error: 'An error occurred while sending the email',
        details: emailError.message
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Send email error:', error);
    
    // Try to update the statistics with the error, if we have transferId
    try {
      const data = await req.json();
      if (data && data.transferId) {
        updateEmailError.run(
          (error.message || 'Unknown error').substring(0, 200), 
          data.transferId
        );
      }
    } catch (parseErr) {
      console.error('Could not parse the request to extract transferId:', parseErr);
    }
    
    return NextResponse.json(
      { 
        success: false,
        error: 'An error occurred while sending the email' 
      },
      { status: 500 }
    );
  }
} 