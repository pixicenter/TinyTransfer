import { NextRequest, NextResponse } from 'next/server';
import { getTransferById, getTransferFiles } from '../../../../lib/db';

interface Transfer {
  id: string;
  created_at: string;
  expires_at: string | null;
  archive_name: string;
  size_bytes: number;
  transfer_password_hash: string | null;
}

interface File {
  original_name: string;
  size_bytes: number;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const transferId = params.id;
    // console.log(`Cerere informații pentru transferul ${transferId}`);

    // Obținem transferul din bază
    const transfer = getTransferById.get(transferId) as Transfer;
    if (!transfer) {
      // console.log(`Transfer cu ID-ul ${transferId} nu a fost găsit`);
      return NextResponse.json({ error: 'Transfer not found' }, { status: 404 });
    }

    // Verifică dacă transferul este valid (nu a expirat)
    if (transfer.expires_at) {
      const expiresAt = new Date(transfer.expires_at);
      if (expiresAt < new Date()) {
        // console.log(`Transferul ${transferId} a expirat la ${expiresAt}`);
        return NextResponse.json(
          { error: 'Transfer has expired' },
          { status: 410 }
        );
      }
    }

    // Obținem fișierele asociate cu transferul
    const files = getTransferFiles.all(transferId) as File[];

    return NextResponse.json({
      id: transfer.id,
      created_at: transfer.created_at,
      expires_at: transfer.expires_at,
      size_bytes: transfer.size_bytes,
      has_password: !!transfer.transfer_password_hash,
      files: files.map(file => ({
        original_name: file.original_name,
        size_bytes: file.size_bytes
      }))
    });

  } catch (error) {
    console.error('Eroare la obținerea informațiilor transferului:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
} 