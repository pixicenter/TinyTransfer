import { NextRequest, NextResponse } from 'next/server';
import { StorageFactory } from '../../../../services/StorageFactory';
import { initializeServices } from '../../../../lib/app-init';
import { EncryptionService } from '../../../../services/EncryptionService';

// Această rută trebuie să ruleze pe Node.js și nu pe Edge Runtime
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // Inițializăm serviciile dacă nu sunt deja inițializate
    if (!EncryptionService.isReady()) {
      console.log('Inițializare servicii globale...');
      initializeServices();
    }
    
    const data = await request.json();
    const { transferId, fileName, fileSize } = data;

    if (!transferId || !fileName) {
      return NextResponse.json({ error: 'Transfer ID și numele fișierului sunt obligatorii' }, { status: 400 });
    }

    console.log(`Inițiere upload multipart pentru ${fileName} (${fileSize} bytes) în transferul ${transferId}`);

    // Obținem serviciul de stocare
    const storage = StorageFactory.getStorage();

    // Verificăm dacă este R2StorageService
    if (typeof storage.initMultipartUpload !== 'function') {
      return NextResponse.json({ error: 'Serviciul de stocare curent nu suportă upload multipart' }, { status: 400 });
    }

    try {
      // Generăm key-ul pentru fișier
      const key = `uploads/${transferId}/${fileName}`;
      
      // Inițiem upload-ul multipart direct pe storage
      const uploadId = await storage.initMultipartUpload(key);
      
      return NextResponse.json({
        success: true,
        uploadId: uploadId,
        key: key
      });
    } catch (error) {
      console.error(`Eroare la inițierea upload-ului multipart: ${error}`);
      return NextResponse.json(
        { error: 'Eroare la inițierea upload-ului multipart', details: String(error) },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Eroare la procesarea cererii de inițiere upload multipart:', error);
    return NextResponse.json(
      { error: 'Eroare internă server', details: String(error) },
      { status: 500 }
    );
  }
} 