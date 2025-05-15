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
    
    const formData = await request.formData();
    const chunk = formData.get('chunk') as File;
    const key = formData.get('key') as string;
    const uploadId = formData.get('uploadId') as string;
    const partNumber = parseInt(formData.get('partNumber') as string);
    const transferId = formData.get('transferId') as string;

    if (!chunk || !key || !uploadId || isNaN(partNumber) || !transferId) {
      return NextResponse.json({ 
        error: 'Cerere incompletă', 
        details: 'Sunt necesare: chunk, key, uploadId, partNumber, transferId' 
      }, { status: 400 });
    }

    console.log(`Încărcare parte ${partNumber} pentru ${key} în upload-ul ${uploadId}`);

    // Obținem serviciul de stocare
    const storage = StorageFactory.getStorage();

    // Verificăm dacă este R2StorageService cu uploadPart
    if (!('uploadPart' in storage)) {
      return NextResponse.json({ error: 'Serviciul de stocare curent nu suportă upload multipart' }, { status: 400 });
    }

    try {
      // Transformăm chunk-ul în buffer
      const arrayBuffer = await chunk.arrayBuffer();
      let buffer = Buffer.from(arrayBuffer);
      
      // Criptăm buffer-ul dacă este necesar
      if (EncryptionService.isReady()) {
        buffer = Buffer.from(EncryptionService.encryptBuffer(buffer, transferId));
        console.log(`Parte ${partNumber} criptată cu succes`);
      }
      
      // Încărcăm partea
      const etag = await storage.uploadPart(key, uploadId, partNumber, buffer);
      
      return NextResponse.json({
        success: true,
        partNumber: partNumber,
        etag: etag
      });
    } catch (error) {
      console.error(`Eroare la încărcarea părții ${partNumber}: ${error}`);
      return NextResponse.json(
        { error: `Eroare la încărcarea părții ${partNumber}`, details: String(error) },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Eroare la procesarea cererii de încărcare parte:', error);
    return NextResponse.json(
      { error: 'Eroare internă server', details: String(error) },
      { status: 500 }
    );
  }
} 