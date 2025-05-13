import { NextRequest, NextResponse } from 'next/server';
import { getTransferById, getTransferFiles, recordTransferView, logAccess} from '../../../../../lib/db';

// This route needs to run on Node.js and not on Edge Runtime
export const runtime = 'nodejs';

// Add this interface after Transfer
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
}


// Add this interface for Transfer
interface Transfer {
  id: string;
  created_at: string;
  expires_at: string | null;
  archive_name: string;
  size_bytes: number;
  transfer_password_hash: string | null;
}

// Interfață pentru fișierele transferate
interface TransferFile {
  original_name: string;
  size_bytes: number;
}

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

    // Record the view statistics
    const ip = request.headers.get('x-forwarded-for') || request.ip || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    // Record the access in logs (this will also update the view count)
    logAccess(params.id, ip, userAgent, 0); // 0 = not a download

    const files = getTransferFiles.all(params.id) as TransferFile[];

    // Then type the result
    // const appSettings = getAppSettings.get() as AppSettings;

    return NextResponse.json({
      id: transfer.id,
      created_at: transfer.created_at,
      expires_at: transfer.expires_at,
      size_bytes: transfer.size_bytes,
      has_password: !!transfer.transfer_password_hash,
      files: files.map((file: TransferFile) => ({
        original_name: file.original_name,
        size_bytes: file.size_bytes
      }))
    });
  } catch (error) {
    console.error('Error fetching transfer info:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transfer info' },
      { status: 500 }
    );
  }
} 