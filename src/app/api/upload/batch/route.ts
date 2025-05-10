import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { writeFile } from 'fs/promises';

// This route needs to run on Node.js and not on Edge Runtime
export const runtime = 'nodejs';
// Corectăm configurația pentru a gestiona streamingul
export const dynamic = 'force-dynamic';
// Dezactivează cache-ul pentru rută
export const fetchCache = 'force-no-store';

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
  localEncryption: boolean;
  localEncryptionKeySource: string;
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
    const formData = await req.formData();
    
    // Obține ID-ul transferului
    const transferId = formData.get('transferId');
    if (!transferId || typeof transferId !== 'string') {
      return NextResponse.json(
        { error: 'ID-ul transferului lipsește sau este invalid' },
        { status: 400 }
      );
    }
    
    // Verifică dacă directorul transferului există
    const transferDir = path.join(TMP_DIR, transferId);
    if (!fs.existsSync(transferDir)) {
      return NextResponse.json(
        { error: 'Transfer invalid sau expirat' },
        { status: 404 }
      );
    }
    
    // Verifică și încarcă metadata transferului
    const metadataPath = path.join(transferDir, 'metadata.json');
    if (!fs.existsSync(metadataPath)) {
      return NextResponse.json(
        { error: 'Metadata transferului lipsește' },
        { status: 500 }
      );
    }
    
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8')) as TransferMetadata;
    
    // Verifică dacă transferul a fost deja finalizat
    if (metadata.isFinalized) {
      return NextResponse.json(
        { error: 'Transferul a fost deja finalizat' },
        { status: 400 }
      );
    }
    
    // Obține fișierele din FormData
    const files = formData.getAll('files').filter(file => 
      typeof file === 'object' && 'arrayBuffer' in file) as File[];
    
    if (files.length === 0) {
      return NextResponse.json(
        { error: 'Nu au fost găsite fișiere în cerere' },
        { status: 400 }
      );
    }
    
    console.log(`Procesare lot de ${files.length} fișiere pentru transferul ${transferId}`);
    
    // Salvează fișierele și actualizează metadata
    const processedFiles = [];
    
    for (const file of files) {
      try {
        const fileId = uuidv4();
        const fileName = file.name;
        const fileSize = file.size;
        const filePath = path.join(transferDir, `${fileId}-${fileName}`);
        
        // Salvează fișierul pe disc
        const buffer = Buffer.from(await file.arrayBuffer());
        await writeFile(filePath, buffer);
        
        const fileInfo = {
          path: filePath,
          originalname: fileName,
          size: fileSize,
          uploadedAt: new Date().toISOString()
        };
        
        processedFiles.push(fileInfo);
        metadata.files.push(fileInfo);
        
        console.log(`Salvat fișier: ${fileName} (${formatBytes(fileSize)}) in ${filePath}`);
      } catch (error) {
        console.error(`Eroare la salvarea fișierului ${file.name}:`, error);
      }
    }
    
    // Actualizează contorul de fișiere încărcate
    metadata.uploadedFileCount = metadata.files.length;
    
    // Salvează metadata actualizat
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    
    console.log(`Lot procesat: ${processedFiles.length} fișiere pentru transferul ${transferId}`);
    
    return NextResponse.json({
      success: true, 
      transferId,
      processedFiles: processedFiles.length,
      totalProcessedFiles: metadata.uploadedFileCount,
      expectedFiles: metadata.fileCount
    });
    
  } catch (error) {
    console.error('Eroare la procesarea lotului de fișiere:', error);
    return NextResponse.json(
      { error: 'Eroare la procesarea lotului', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// Funcție pentru formatarea dimensiunii în bytes într-un format lizibil
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
} 