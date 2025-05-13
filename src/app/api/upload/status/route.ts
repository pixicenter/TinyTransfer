import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// This route needs to run on Node.js and not on Edge Runtime
export const runtime = 'nodejs';

// Path pentru directorul temporar
const TMP_DIR = path.join(process.cwd(), 'tmp');

// Interfața pentru metadata transfer
interface TransferMetadata {
  id: string;
  name: string;
  fileCount: number;
  totalSize: number;
  password: string | null;
  expiration: string;
  email: string | null;
  createdAt: string;
  files: Array<{
    path: string;
    originalname: string;
    size: number;
    uploadedAt: string;
  }>;
  uploadedFileCount: number;
  isFinalized: boolean;
}

export async function POST(req: NextRequest) {
  try {
    // Parsează request body
    const body = await req.json();
    const { transferId } = body;
    
    if (!transferId) {
      return NextResponse.json(
        { error: 'ID-ul transferului lipsește' },
        { status: 400 }
      );
    }
    
    // Verifică dacă directorul temporar există
    const transferDir = path.join(TMP_DIR, transferId);
    if (!fs.existsSync(transferDir)) {
      return NextResponse.json(
        { error: 'Transfer invalid sau expirat' },
        { status: 404 }
      );
    }
    
    // Încarcă metadata transferului
    const metadataPath = path.join(transferDir, 'metadata.json');
    if (!fs.existsSync(metadataPath)) {
      return NextResponse.json(
        { error: 'Metadata transferului lipsește' },
        { status: 500 }
      );
    }
    
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8')) as TransferMetadata;
    
    // Verifică numărul real de fișiere din director
    const filesInDirectory = fs.readdirSync(transferDir)
      .filter(filename => filename !== 'metadata.json');
    
    // Dacă numărul de fișiere din director este diferit de cel din metadata, actualizăm
    if (filesInDirectory.length !== metadata.uploadedFileCount) {
      console.log(`Status: Corecție uploadedFileCount: ${metadata.uploadedFileCount} -> ${filesInDirectory.length}`);
      metadata.uploadedFileCount = filesInDirectory.length;
      
      // Dacă numărul de fișiere încărcate este mai mare decât fileCount, actualizăm și fileCount
      if (metadata.uploadedFileCount > metadata.fileCount) {
        console.log(`Status: Actualizare fileCount: ${metadata.fileCount} -> ${metadata.uploadedFileCount}`);
        metadata.fileCount = metadata.uploadedFileCount;
      }
      
      // Salvăm metadata actualizat
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    }
    
    return NextResponse.json({
      success: true,
      transferId,
      name: metadata.name,
      fileCount: metadata.fileCount,
      uploadedFileCount: metadata.uploadedFileCount,
      isFinalized: metadata.isFinalized,
      filesInDirectory: filesInDirectory.length
    });
    
  } catch (error) {
    console.error('Eroare la verificarea stării transferului:', error);
    return NextResponse.json(
      { error: 'Eroare la verificarea stării', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 