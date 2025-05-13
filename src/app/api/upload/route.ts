import { NextRequest, NextResponse } from 'next/server';
import { StorageFactory } from '../../../services/StorageFactory';


// Această rută trebuie să ruleze pe Node.js și nu pe Edge Runtime
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const transferId = formData.get('transferId') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!transferId) {
      return NextResponse.json({ error: 'Transfer ID is required' }, { status: 400 });
    }

    console.log(`Încărcare fișier ${file.name} pentru transferul ${transferId}`);

    // Obținem serviciul de stocare
    const storage = StorageFactory.getStorage();

    try {
      // Încărcăm fișierul în R2
      const key = await storage.uploadFile(transferId, file);
      console.log(`Fișier încărcat cu succes: ${key}`);


      return NextResponse.json({
        success: true,
        key: key,
        size: file.size
      });
    } catch (error) {
      console.error(`Eroare la încărcarea fișierului: ${error}`);
      return NextResponse.json(
        { error: 'Failed to upload file' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Eroare la procesarea cererii de încărcare:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
} 