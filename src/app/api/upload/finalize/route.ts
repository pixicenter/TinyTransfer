import { NextRequest, NextResponse } from 'next/server';
import { createTransferWithStats, insertFile, getAppSettings as getSettingsFromDb } from '../../../../lib/db';
import { ArchiveService } from '../../../../services/ArchiveService';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcrypt';

// This route needs to run on Node.js and not on Edge Runtime
export const runtime = 'nodejs';

// Path pentru directorul temporar
const TMP_DIR = path.join(process.cwd(), 'tmp');

// Interfață pentru setările aplicației
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

// Tip pentru sursa cheii de criptare
type EncryptionKeySource = 'manual' | 'transfer_name' | 'email' | 'password' | 'timestamp';

// Interfață pentru configurația de criptare
interface CryptoConfig {
  enabled: boolean;
  keySource: EncryptionKeySource;
  manualKey: string;
}

// Interfață pentru metadata transferului
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

// Funcție pentru obținerea setărilor aplicației
function getAppSettings() {
  try {
    // În contextul server-side, putem accesa baza de date direct
    const settings = getSettingsFromDb.get() as AppSettings;
    
    if (!settings) {
      // Dacă nu putem obține setările, folosim valori implicite
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
    console.error('Eroare la obținerea setărilor:', error);
    return {
      encryption_enabled: false,
      encryption_key_source: 'manual',
      encryption_manual_key: ''
    };
  }
}

export async function POST(req: NextRequest) {
  try {
    // Parsează request body
    const body = await req.json();
    const { transferId, force = false } = body;
    
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
    
    // Verifică dacă transferul a fost deja finalizat
    if (metadata.isFinalized) {
      return NextResponse.json(
        { error: 'Transferul a fost deja finalizat' },
        { status: 400 }
      );
    }
    
    // Verifică și actualizează numărul real de fișiere din director
    // Acest lucru rezolvă problema când uploadedFileCount nu reflectă realitatea
    const filesInDirectory = fs.readdirSync(transferDir)
      .filter(filename => filename !== 'metadata.json');
    
    // Dacă numărul de fișiere din director este diferit de numărul din metadata
    // sau dacă metadata.files conține mai puține intrări decât uploadedFileCount
    if (filesInDirectory.length !== metadata.uploadedFileCount || 
        metadata.files.length !== metadata.uploadedFileCount) {
      console.log(`Actualizare uploadedFileCount: ${metadata.uploadedFileCount} -> ${filesInDirectory.length}`);
      
      // Verificăm fișierele care nu se află în array-ul files
      const existingFilePaths = new Set(metadata.files.map(f => path.basename(f.path)));
      const newFiles = filesInDirectory.filter(filename => !existingFilePaths.has(filename));
      
      // Adăugăm noile fișiere la array-ul files
      for (const filename of newFiles) {
        const filePath = path.join(transferDir, filename);
        const fileStats = fs.statSync(filePath);
        const originalname = filename.substring(filename.indexOf('-') + 1);
        
        metadata.files.push({
          path: filePath,
          originalname: originalname,
          size: fileStats.size,
          uploadedAt: new Date(fileStats.birthtime).toISOString()
        });
      }
      
      // Actualizăm contorul de fișiere
      metadata.uploadedFileCount = filesInDirectory.length;
      
      // Dacă numărul de fișiere încărcate este mai mare decât fileCount, actualizăm și fileCount
      if (metadata.uploadedFileCount > metadata.fileCount) {
        console.log(`Actualizare fileCount: ${metadata.fileCount} -> ${metadata.uploadedFileCount}`);
        metadata.fileCount = metadata.uploadedFileCount;
      }
      
      // Salvăm metadata actualizat
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    }
    
    // Verifică dacă toate fișierele au fost încărcate, cu excepția cazului când forțăm finalizarea
    if (metadata.uploadedFileCount < metadata.fileCount && !force) {
      return NextResponse.json(
        { 
          error: 'Nu toate fișierele au fost încărcate', 
          uploadedFiles: metadata.uploadedFileCount, 
          expectedFiles: metadata.fileCount,
          canForce: true
        },
        { status: 400 }
      );
    }
    
    // Dacă forțăm finalizarea, actualizăm metadata pentru a reflecta numărul real de fișiere
    if (force && metadata.uploadedFileCount < metadata.fileCount) {
      console.log(`Finalizare forțată: ${metadata.uploadedFileCount}/${metadata.fileCount} fișiere încărcate`);
      metadata.fileCount = metadata.uploadedFileCount;
    }
    
    console.log(`Finalizare transfer ${transferId} cu ${metadata.files.length} fișiere`);
    
    // Obține setările aplicației pentru criptare
    const settings = getAppSettings();
    
    // Configurația de criptare
    const encryptionConfig: CryptoConfig = {
      enabled: settings.encryption_enabled,
      keySource: settings.encryption_key_source as EncryptionKeySource,
      manualKey: settings.encryption_manual_key
    };
    
    // Arhivează fișierele cu opțiunile de criptare
    console.log(`Arhivare ${metadata.files.length} fișiere...`);
    const { size } = await ArchiveService.archiveFiles(metadata.files, {
      name: transferId,
      encryptionConfig: encryptionConfig,
      password: metadata.password || undefined,
      emailTo: metadata.email || undefined,
    });
    console.log(`Fișiere arhivate și criptate, ID: ${transferId}`);
    
    // Calculează data de expirare
    const expiresAt = metadata.expiration === '0' ? null : new Date(
      Date.now() + parseInt(metadata.expiration) * 24 * 60 * 60 * 1000
    ).toISOString();
    
    // Hash pentru parolă, dacă este furnizată
    const passwordHash = metadata.password ? await bcrypt.hash(metadata.password, 10) : null;
    
    // Folosește numele transferului pentru numele arhivei
    const customArchiveName = `${metadata.name}.zip`;
    
    // Salvează transferul în baza de date și inițializează statisticile
    createTransferWithStats(
      transferId,
      expiresAt,
      customArchiveName,
      size,
      passwordHash,
      settings.encryption_enabled ? 1 : 0,
      settings.encryption_enabled ? settings.encryption_key_source : null
    );
    
    console.log('Transfer salvat în baza de date cu statistici inițializate');
    
    // Salvează fișierele individuale
    for (const file of metadata.files) {
      insertFile.run(
        transferId,
        file.originalname,
        file.size
      );
    }
    
    console.log('Fișiere salvate în baza de date');
    
    // Marchează transferul ca finalizat în metadata
    metadata.isFinalized = true;
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    
    // Generează link-ul de descărcare folosind URL-ul de la request pentru a obține domeniul corect
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const host = req.headers.get('host') || req.headers.get('x-forwarded-host') || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;
    console.log(`Folosim URL de bază pentru link-ul de descărcare: ${baseUrl}`);
    const downloadLink = `${baseUrl}/download/${transferId}`;
    
    // Dacă este furnizat un email, pregătește datele pentru API-ul de trimitere email
    let emailResult: { success: boolean; error?: string } = { success: false };
    if (metadata.email) {
      try {
        const emailResponse = await fetch(`${baseUrl}/api/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: metadata.email,
            downloadLink,
            transferId,
            transferName: metadata.name,
            files: metadata.files.map(f => ({ 
              name: f.originalname, 
              size: f.size 
            })),
            expirationDays: metadata.expiration === '0' ? null : parseInt(metadata.expiration)
          }),
        });
        
        const emailData = await emailResponse.json();
        emailResult = { 
          success: emailResponse.ok, 
          error: !emailResponse.ok ? emailData.error : undefined 
        };
        
        console.log('Rezultat trimitere email:', emailResult);
      } catch (emailError) {
        console.error('Eroare la trimiterea email-ului:', emailError);
        emailResult = { success: false, error: 'Trimiterea email-ului a eșuat' };
      }
    }
    
    // Curăță fișierele temporare după ce am finalizat procesarea
    // Se menține doar metadata pentru potential debugging
    for (const file of metadata.files) {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    }
    
    return NextResponse.json({
      success: true,
      transferId,
      downloadLink,
      emailSent: emailResult.success,
      emailError: emailResult.error,
    });
    
  } catch (error) {
    console.error('Eroare la finalizarea transferului:', error);
    return NextResponse.json(
      { error: 'Eroare la finalizarea transferului', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 