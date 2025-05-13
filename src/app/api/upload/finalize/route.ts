import { NextRequest, NextResponse } from 'next/server';
import { createTransfer, getTransferById, recordTransferDownload, logAccess, initTransferStats } from '../../../../lib/db';
import { StorageFactory } from '../../../../services/StorageFactory';


// Această rută trebuie să ruleze pe Node.js și nu pe Edge Runtime
export const runtime = 'nodejs';

// Interfața pentru Transfer
interface Transfer {
  id: string;
  created_at: string;
  expires_at: string | null;
  archive_name: string;
  size_bytes: number;
  transfer_password_hash: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const { transferId, archiveName, expiresAt, password } = await request.json();

    if (!transferId) {
      return NextResponse.json({ error: 'Transfer ID is required' }, { status: 400 });
    }

    console.log(`Finalizare transfer ${transferId} cu numele arhivei: ${archiveName}`);

    // Obținem serviciul de stocare
    const storage = StorageFactory.getStorage();

    // Verificăm dacă există fișiere pentru acest transfer
    const files = await storage.listFiles(transferId);
    if (files.length === 0) {
      console.error(`Nu există fișiere pentru transferul ${transferId}`);
      return NextResponse.json({ error: 'No files found for transfer' }, { status: 404 });
    }

    // Calculăm dimensiunea totală
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);

    // Calculăm data de expirare
    let expirationDate = null;
    if (expiresAt) {
      const days = parseInt(expiresAt);
      if (days > 0) {
        expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + days);
        expirationDate = expirationDate.toISOString();
      }
    }

    // Hash parola dacă există
    let passwordHash = null;
    if (password) {
      const bcrypt = await import('bcrypt');
      passwordHash = await bcrypt.hash(password, 10);
    }

    // Creăm înregistrarea în baza de date
    createTransfer.run(
      transferId,
      expirationDate,
      archiveName || `${transferId}.zip`,
      totalSize,
      passwordHash
    );

    // Inițializăm statisticile pentru transfer
    initTransferStats.run(transferId);

    // Inserăm fișierele în tabela files
    const { insertFile } = await import('../../../../lib/db');
    for (const file of files) {
      // Salvăm doar fișierele efective, nu arhiva
      if (file.name && !file.name.endsWith('.zip')) {
        insertFile.run(transferId, file.name, file.size);
      }
    }

    // Obținem transferul creat
    const transfer = getTransferById.get(transferId) as Transfer;

    // Înregistrăm încărcarea în statistici
    try {
      // Obținem IP-ul și user agent-ul din request
      const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
      const userAgent = request.headers.get('user-agent') || 'unknown';
    } catch (statsError) {
      console.error(`Eroare la înregistrarea statisticilor: ${statsError}`);
      // Continuăm chiar dacă nu reușim să înregistrăm statisticile
    }

    // Obținem domeniul din request
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
    const host = request.headers.get('host') || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;

    return NextResponse.json({
      success: true,
      transfer: {
        id: transfer.id,
        archive_name: transfer.archive_name,
        size_bytes: transfer.size_bytes,
        expires_at: transfer.expires_at,
        requires_password: !!transfer.transfer_password_hash
      },
      downloadLink: `${baseUrl}/download/${transfer.id}`,
      emailSent: false // Vom adăuga suport pentru email mai târziu
    });

  } catch (error) {
    console.error('Eroare la finalizarea transferului:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
} 