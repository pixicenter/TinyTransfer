import { NextRequest, NextResponse } from 'next/server';
import { StorageFactory } from '../../../../services/StorageFactory';

// Această rută trebuie să ruleze pe Node.js și nu pe Edge Runtime
export const runtime = 'nodejs';

// Corectăm configurația pentru a gestiona streamingul
export const dynamic = 'force-dynamic';
// Dezactivează cache-ul pentru rută
export const fetchCache = 'force-no-store';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const transferId = formData.get('transferId') as string;

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    if (!transferId) {
      return NextResponse.json({ error: 'Transfer ID is required' }, { status: 400 });
    }

    console.log(`Procesare lot de ${files.length} fișiere pentru transferul ${transferId}`);

    // Obținem serviciul de stocare
    const storage = StorageFactory.getStorage();

    // Procesăm fiecare fișier
    const results = await Promise.all(
      files.map(async (file, idx) => {
        try {
          const key = await storage.uploadFile(transferId, file);
          return {
            name: file.name,
            key: key,
            size: file.size,
            success: true
          };
        } catch (error) {
          console.error(`Eroare la încărcarea fișierului ${file.name}:`, error);
          return {
            name: file.name,
            error: 'Failed to upload file',
            success: false
          };
        }
      })
    );

    return NextResponse.json({
      success: true,
      processedFiles: results.filter(r => r.success).length,
      results: results
    });

  } catch (error) {
    console.error('Eroare la procesarea cererii de încărcare în lot:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
} 