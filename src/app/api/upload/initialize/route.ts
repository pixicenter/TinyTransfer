import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// This route needs to run on Node.js and not on Edge Runtime
export const runtime = 'nodejs';

// Path pentru directoarele temporary
const TMP_DIR = path.join(process.cwd(), 'tmp');

// Funcție pentru generarea unui ID scurt în funcție de numele transferului
function generateShortId(name: string, length: number = 10): string {
  // Procesarea numelui transferului
  const cleanName = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Elimină diacriticele
    .replace(/[^a-z0-9]/g, ''); // Păstrează doar literele și cifrele
  
  // Extrage primele 5 caractere din nume (sau mai puține dacă numele este mai scurt)
  const namePrefix = cleanName.substring(0, 5);
  
  // Generează o valoare aleatorie pentru restul ID-ului
  const randomPart = crypto.randomBytes(8).toString('hex').substring(0, length - namePrefix.length);
  
  // Combină cele două părți pentru a forma ID-ul final
  return (namePrefix + randomPart).substring(0, length);
}

// Interfața pentru cererea de inițializare
interface InitializeRequestBody {
  transferName: string;
  fileCount: number;
  totalSize: number;
  password?: string;
  expiration?: string;
  email?: string;
  localEncryption?: boolean;
  localEncryptionKeySource?: 'transfer_name' | 'timestamp';
}

export async function POST(req: NextRequest) {
  try {
    // Parsarea corpului cererii
    const body = await req.json() as InitializeRequestBody;
    
    // Validarea câmpurilor necesare
    if (!body.transferName || !body.fileCount || !body.totalSize) {
      return NextResponse.json(
        { error: 'Lipsesc câmpuri obligatorii: transferName, fileCount, totalSize' },
        { status: 400 }
      );
    }
    
    console.log(`Inițializare încărcare pentru "${body.transferName}" (${body.fileCount} fișiere, ${formatBytes(body.totalSize)})`);
    
    // Generează ID-ul transferului bazat pe nume
    const transferId = generateShortId(body.transferName);
    
    // Creează directorul temporar pentru acest transfer
    const transferDir = path.join(TMP_DIR, transferId);
    if (!fs.existsSync(transferDir)) {
      fs.mkdirSync(transferDir, { recursive: true });
    }
    
    // Salvează metadata pentru acest transfer
    const metadataPath = path.join(transferDir, 'metadata.json');
    const metadata = {
      id: transferId,
      name: body.transferName,
      fileCount: body.fileCount,
      totalSize: body.totalSize,
      password: body.password || null,
      expiration: body.expiration || '14',
      email: body.email || null,
      localEncryption: body.localEncryption || false,
      localEncryptionKeySource: body.localEncryptionKeySource || 'transfer_name',
      createdAt: new Date().toISOString(),
      files: [], // Va fi populat pe măsură ce fișierele sunt încărcate
      uploadedFileCount: 0,
      isFinalized: false
    };
    
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    
    console.log(`Transfer inițializat: ${transferId} (dir: ${transferDir})`);
    
    return NextResponse.json({
      success: true,
      transferId,
      message: 'Transfer inițializat cu succes'
    });
    
  } catch (error) {
    console.error('Eroare la inițializarea transferului:', error);
    return NextResponse.json(
      { error: 'Eroare la inițializarea transferului', details: error instanceof Error ? error.message : String(error) },
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