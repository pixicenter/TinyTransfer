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
    const { key, uploadId, parts } = data;

    if (!key || !uploadId || !parts || !Array.isArray(parts) || parts.length === 0) {
      return NextResponse.json({ 
        error: 'Cerere incompletă', 
        details: 'Sunt necesare: key, uploadId, parts (array)' 
      }, { status: 400 });
    }

    console.log(`Finalizare upload multipart pentru ${key} cu ${parts.length} părți`);

    // Obținem serviciul de stocare
    const storage = StorageFactory.getStorage();

    // Verificăm dacă este R2StorageService cu completeMultipartUpload
    if (typeof storage.completeMultipartUpload !== 'function') {
      return NextResponse.json({ error: 'Serviciul de stocare curent nu suportă upload multipart' }, { status: 400 });
    }

    try {
      // Sortăm părțile după număr pentru a ne asigura că sunt în ordine
      const sortedParts = [...parts].sort((a, b) => a.PartNumber - b.PartNumber);
      
      // Finalizăm upload-ul multipart direct pe storage
      const result = await storage.completeMultipartUpload(key, uploadId, sortedParts);
      
      console.log(`Upload multipart finalizat cu succes pentru ${key}`);
      
      return NextResponse.json({
        success: true,
        key: result
      });
    } catch (error) {
      console.error(`Eroare la finalizarea upload-ului multipart: ${error}`);
      
      // Încercăm să anulăm upload-ul multipart
      try {
        if ('abortMultipartUpload' in storage && typeof storage.abortMultipartUpload === 'function') {
          await storage.abortMultipartUpload(key, uploadId);
          console.log(`Upload multipart anulat pentru ${key}`);
        }
      } catch (abortError) {
        console.error(`Nu s-a putut anula upload-ul multipart: ${abortError}`);
      }
      
      return NextResponse.json(
        { error: 'Eroare la finalizarea upload-ului multipart', details: String(error) },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Eroare la procesarea cererii de finalizare upload multipart:', error);
    return NextResponse.json(
      { error: 'Eroare internă server', details: String(error) },
      { status: 500 }
    );
  }
} 