import { NextRequest, NextResponse } from 'next/server';
import { createTransferWithStats, insertFile, getAppSettings as getSettingsFromDb } from '../../../lib/db';
import { ArchiveService } from '../../../services/ArchiveService';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';
import { writeFile } from 'fs/promises';
import crypto from 'crypto';
import { CleanupService } from '../../../services/CleanupService';
import { pipeline } from 'stream';
import { Readable } from 'stream';

// This route needs to run on Node.js and not on Edge Runtime
export const runtime = 'nodejs';
// Corectăm configurația pentru a gestiona streamingul
export const dynamic = 'force-dynamic';
// Dezactivează cache-ul pentru rută
export const fetchCache = 'force-no-store';

// Ensure the necessary directories exist
const TMP_DIR = path.join(process.cwd(), 'tmp');
if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

// Initialize ArchiveService
ArchiveService.initialize();

// Initialize CleanupService
CleanupService.initialize();

// Add this interface after imports
interface AppSettings {
  id: number;
  app_name: string;
  logo_url: string | null;
  logo_url_dark: string | null;
  logo_url_light: string | null;
  logo_type: string;
  theme: string;
  language: string;
  slideshow_interval: number;
  slideshow_effect: string;
  encryption_enabled: number | boolean;
  encryption_key_source: string;
  encryption_manual_key: string | null;
}

// Add this type after the AppSettings interface
type EncryptionKeySource = 'manual' | 'transfer_name' | 'email' | 'password' | 'timestamp';

// Interface for encryption configuration (if not already defined)
interface CryptoConfig {
  enabled: boolean;
  keySource: EncryptionKeySource;
  manualKey: string;
}

// Interface for processed file
interface ProcessedFile {
  path: string;
  originalname: string;
  size: number;
}

// Function to generate a short ID based on the transfer name
function generateShortId(name: string, length: number = 10): string {
  // Process the transfer name
  const cleanName = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Elimină diacriticele
    .replace(/[^a-z0-9]/g, ''); // Păstrează doar literele și cifrele
  
  // Extract the first 5 characters from the name (or fewer if the name is shorter)
  const namePrefix = cleanName.substring(0, 5);
  
  // Generate a random value for the rest of the ID
  const randomPart = crypto.randomBytes(8).toString('hex').substring(0, length - namePrefix.length);
  
  // Combine the two parts to form the final ID
  return (namePrefix + randomPart).substring(0, length);
}

// Function to get app settings
function getAppSettings() {
  try {
    // In the server-side context, we can access the database directly
    const settings = getSettingsFromDb.get() as AppSettings;
    
    if (!settings) {
      // If we can't get the settings, use default values
      return {
        encryption_enabled: false,
        encryption_key_source: 'manual',
        encryption_manual_key: ''
      };
    }
    
    return {
      encryption_enabled: !!settings.encryption_enabled,
      encryption_key_source: settings.encryption_key_source || 'manual',
      encryption_manual_key: settings.encryption_manual_key || ''
    };
    
  } catch (error) {
    console.error('Error getting settings:', error);
    return {
      encryption_enabled: false,
      encryption_key_source: 'manual',
      encryption_manual_key: ''
    };
  }
}

// Function to process files in batches
async function processFilesInBatches(
  files: Array<File>, 
  transferDir: string,
  batchSize: number = 2
): Promise<ProcessedFile[]> {
  const processedFiles: ProcessedFile[] = [];
  const totalFiles = files.length;
  let processedCount = 0;
  
  // Process files in batches
  for (let i = 0; i < totalFiles; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    
    // Process batch concurrently
    const batchPromises = batch.map(async (file) => {
      try {
        const fileId = uuidv4();
        const fileName = file.name;
        const fileSize = file.size;
        const filePath = path.join(transferDir, `${fileId}-${fileName}`);
        
        // Save file to disk
        const fileStream = fs.createWriteStream(filePath);
        const readable = new Readable();
        readable._read = () => {}; // Implementare necesară
        readable.push(Buffer.from(await file.arrayBuffer()));
        readable.push(null);
        await pipeline(readable, fileStream);
        
        processedCount++;
        console.log(`[${processedCount}/${totalFiles}] Saved file: ${fileName} (${fileSize} bytes)`);
        
        return {
          path: filePath,
          originalname: fileName,
          size: fileSize
        };
      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error);
        throw error;
      }
    });
    
    // Wait for all files in the current batch to be processed
    const batchResults = await Promise.all(batchPromises);
    processedFiles.push(...batchResults);
  }
  
  return processedFiles;
}

export async function POST(req: NextRequest) {
  let transferDir = '';
  let files: ProcessedFile[] = [];
  
  try {
    console.log('Upload request received');
    
    const formData = await req.formData();
    console.log('FormData received');
    
    // Extract fields
    const filesField = formData.getAll('files');
    const password = formData.get('password') as string;
    const expiration = formData.get('expiration') as string;
    const email = formData.get('email') as string || null;
    // Get the transfer name from formData or use a default one
    let transferName = (formData.get('transferName') as string)?.trim() || 'Transfer';

    console.log(`Received ${filesField.length} files, password: ${password ? 'yes' : 'no'}, expiration: ${expiration}, email: ${email || 'no'}, transferName: ${transferName}`);
    
    if (!filesField || filesField.length === 0) {
      console.log('No files uploaded');
      return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
    }
    
    // Generate transfer ID early to create unique folder
    const transferId = generateShortId(transferName);
    transferDir = path.join(TMP_DIR, transferId);
    
    // Create unique directory for this transfer
    if (!fs.existsSync(transferDir)) {
      fs.mkdirSync(transferDir, { recursive: true });
    }
    
    console.log(`Created transfer directory: ${transferDir}`);
    
    // Process the files in batches
    const typedFiles = filesField.filter(fileField => 
      typeof fileField === 'object' && 'arrayBuffer' in fileField) as File[];
    
    // Process files in batches (4 concurrent files)
    files = await processFilesInBatches(typedFiles, transferDir, 2);
    
    if (files.length === 0) {
      // Clean up the empty transfer directory
      if (fs.existsSync(transferDir)) {
        fs.rmdirSync(transferDir);
      }
      return NextResponse.json({ error: 'Failed to process files' }, { status: 400 });
    }
    
    // If the transfer name wasn't specified and there are files, use the name of the first file without extension
    if (transferName === 'Transfer' && files.length > 0) {
      const firstFileName = files[0].originalname;
      const nameWithoutExtension = firstFileName.split('.').slice(0, -1).join('.');
      if (nameWithoutExtension) {
        transferName = nameWithoutExtension;
      }
    }
    
    console.log('Using transfer name:', transferName);
    console.log('Using transfer ID:', transferId);
    
    // Get the app settings for encryption
    const settings = getAppSettings();
    
    // The encryption configuration
    const encryptionConfig: CryptoConfig = {
      enabled: settings.encryption_enabled,
      keySource: settings.encryption_key_source as EncryptionKeySource,
      manualKey: settings.encryption_manual_key
    };
    
    // Archive files with encryption options
    console.log(`Archiving ${files.length} files...`);
    const { size } = await ArchiveService.archiveFiles(files as any, {
      name: transferId,
      encryptionConfig: encryptionConfig,
      password: password,
      emailTo: email || undefined,
    });
    console.log('Files archived and encrypted, ID:', transferId);

    // Calculate expiration date
    const expiresAt = expiration === '0' ? null : new Date(
      Date.now() + parseInt(expiration) * 24 * 60 * 60 * 1000
    ).toISOString();

    // Hash password if provided
    const passwordHash = password ? await bcrypt.hash(password, 10) : null;

    // Use transferName for the archive name
    const customArchiveName = `${transferName}.zip`;

    // Save the transfer to the database and initialize statistics
    createTransferWithStats(
      transferId,
      expiresAt,
      customArchiveName,
      size,
      passwordHash,
      settings.encryption_enabled ? 1 : 0,
      settings.encryption_enabled ? settings.encryption_key_source : null
    );

    console.log('Transfer saved to database with stats initialized');

    // Save individual files
    for (const file of files) {
      insertFile.run(
        transferId,
        file.originalname,
        file.size
      );
    }

    console.log('Files saved to database');

    // Clean up temp files and transfer directory
    for (const file of files) {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    }
    
    // Remove the transfer directory if it exists
    if (fs.existsSync(transferDir)) {
      fs.rmdirSync(transferDir, { recursive: true });
    }

    // Generate download link - folosim URL-ul de la request pentru a obține domeniul corect
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const host = req.headers.get('host') || req.headers.get('x-forwarded-host') || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;
    console.log(`Using base URL for download link: ${baseUrl}`);
    const downloadLink = `${baseUrl}/download/${transferId}`;

    // If an email is provided, prepare data for the email sending API call
    let emailResult: { success: boolean; error?: string } = { success: false };
    if (email) {
      try {
        const emailResponse = await fetch(`${baseUrl}/api/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            downloadLink,
            transferId,
            transferName,
            files: files.map(f => ({ 
              name: f.originalname, 
              size: f.size 
            })),
            expirationDays: expiration === '0' ? null : parseInt(expiration)
          }),
        });

        const emailData = await emailResponse.json();
        emailResult = { 
          success: emailResponse.ok, 
          error: !emailResponse.ok ? emailData.error : undefined 
        };
        
        console.log('Email sending result:', emailResult);
      } catch (emailError) {
        console.error('Error sending email:', emailError);
        emailResult = { success: false, error: 'Email sending failed' };
      }
    }

    return NextResponse.json({
      success: true, 
      id: transferId,
      downloadLink,
      emailSent: emailResult.success,
      emailError: emailResult.error,
    });

  } catch (error) {
    console.error('Error processing upload:', error);
    
    // Clean up the transfer directory if it exists and an error occurred
    if (transferDir && fs.existsSync(transferDir)) {
      try {
        // Clean up any generated files
        for (const file of files) {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        }
        
        // Remove the directory
        fs.rmdirSync(transferDir, { recursive: true });
      } catch (cleanupError) {
        console.error('Error cleaning up after failed upload:', cleanupError);
      }
    }
    
    return NextResponse.json(
      { error: 'Error processing upload', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 