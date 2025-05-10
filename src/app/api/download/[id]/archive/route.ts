import { NextRequest, NextResponse } from 'next/server';
import { getTransferById, recordTransferDownload, logAccess, getAppSettings } from '../../../../../lib/db';
import { ArchiveService } from '../../../../../services/ArchiveService';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Readable } from 'stream';

// This route needs to run on Node.js and not on Edge Runtime
export const runtime = 'nodejs';

// Interface for Transfer
interface Transfer {
  id: string;
  created_at: string;
  expires_at: string | null;
  archive_name: string;
  size_bytes: number;
  transfer_password_hash: string | null;
  is_encrypted: number | boolean;
  encryption_key_source: string | null;
}

// Interface for AppSettings
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

// Add these types next to the other interfaces
type EncryptionKeySource = 'manual' | 'transfer_name' | 'email' | 'password' | 'timestamp';

// interface CryptoConfig {
//   enabled: boolean;
//   keySource: EncryptionKeySource;
//   manualKey: string;
// }

// interface ErrorResponse {
//   error: string;
//   message?: string;
// }

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const transfer = getTransferById.get(params.id) as Transfer;
    if (!transfer) {
      return NextResponse.json(
        { error: 'Transfer not found' },
        { status: 404 }
      );
    }

    // Check if transfer has expired
    if (transfer.expires_at && new Date(transfer.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Transfer has expired' },
        { status: 410 }
      );
    }

    // Verify password if required
    if (transfer.transfer_password_hash) {
      const password = request.nextUrl.searchParams.get('password');
      if (!password) {
        return NextResponse.json(
          { error: 'Password required' },
          { status: 401 }
        );
      }

      const passwordMatch = await bcrypt.compare(
        password,
        transfer.transfer_password_hash
      );

      if (!passwordMatch) {
        return NextResponse.json(
          { error: 'Invalid password' },
          { status: 401 }
        );
      }
    }

    const archivePath = ArchiveService.getArchivePath(transfer.id);
    if (!fs.existsSync(archivePath)) {
      return NextResponse.json(
        { error: 'Archive not found' },
        { status: 404 }
      );
    }

    // Get app settings for encryption
    const appSettings = getAppSettings.get() as AppSettings;

    // Find an existing decrypted file with a valid timestamp
    let filePathToServe = archivePath;
    let shouldCleanupTempFile = false;
    if (transfer.is_encrypted) {
      const now = Date.now();
      const oneHour = 60 * 60 * 1000;
      const tempDir = path.join(process.cwd(), 'tmp');
      let foundDecrypted = false;
      let decryptedPath = '';
      if (fs.existsSync(tempDir)) {
        const files = fs.readdirSync(tempDir);
        for (const file of files) {
          const match = file.match(new RegExp(`^${transfer.id}_decrypted_(\\d+)\\.zip$`));
          if (match) {
            const timestamp = parseInt(match[1], 10);
            if (now - timestamp < oneHour) {
              decryptedPath = path.join(tempDir, file);
              foundDecrypted = true;
              break;
            }
          }
        }
      }
      if (!foundDecrypted) {
        // Decrypt and save with new timestamp
        decryptedPath = await ArchiveService.decryptArchive(transfer.id, {
          name: transfer.id,
          encryptionConfig: {
            enabled: true,
            keySource: (transfer.encryption_key_source || 'manual') as EncryptionKeySource,
            manualKey: appSettings.encryption_manual_key || ''
          },
          password: request.nextUrl.searchParams.get('password') || undefined,
          emailTo: request.nextUrl.searchParams.get('email') || undefined
        });
      }
      filePathToServe = decryptedPath;
      shouldCleanupTempFile = false; // Don't delete at the end, automatic cleanup will handle it
    }

    // Record the download
    const ip = request.headers.get('x-forwarded-for') || request.ip || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    // Record the download statistics
    recordTransferDownload.run(params.id);
    
    // Record the access in logs as a download
    logAccess.run(params.id, ip, userAgent, 1); // 1 = is a download

    // Stream the file
    const fileStream = fs.createReadStream(filePathToServe);
    const headers = new Headers();
    headers.set('Content-Type', 'application/zip');
    headers.set(
      'Content-Disposition',
      `attachment; filename="${transfer.archive_name}"`
    );

    // Configure the cleanup event after the stream
    if (shouldCleanupTempFile) {
      const tempFilePath = filePathToServe;
      fileStream.on('end', () => {
        console.log(`Temporary decrypted file deletion: ${tempFilePath}`);
        try {
          fs.unlinkSync(tempFilePath);
        } catch (cleanupErr) {
          console.error('Error deleting temporary file:', cleanupErr);
        }
      });
    }

    return new Response(fileStream as unknown as BodyInit, {
      headers
    });
  } catch (error) {
    console.error('Error streaming file:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
} 