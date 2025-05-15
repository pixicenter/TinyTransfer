import { NextRequest, NextResponse } from 'next/server';
import { StorageFactory } from '../../../../services/StorageFactory';
import { initializeServices } from '../../../../lib/app-init';
import { EncryptionService } from '../../../../services/EncryptionService';

// Această rută trebuie să ruleze pe Node.js și nu pe Edge Runtime
export const runtime = 'nodejs';

// Corectăm configurația pentru a gestiona streamingul
export const dynamic = 'force-dynamic';
// Dezactivează cache-ul pentru rută
export const fetchCache = 'force-no-store';

// Interfața pentru rezultatul încărcării unui fișier
interface UploadResult {
  name: string;
  key: string;
  size: number;
  success: boolean;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Încercăm să inițializăm serviciile dacă nu sunt deja inițializate
    if (!EncryptionService.isReady()) {
      console.log('Serviciul de criptare nu este inițializat. Încercăm inițializarea...');
      initializeServices();
    }
    
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const transferId = formData.get('transferId') as string;

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    if (!transferId) {
      return NextResponse.json({ error: 'Transfer ID is required' }, { status: 400 });
    }

    // console.log(`Procesare lot de ${files.length} fișiere pentru transferul ${transferId}`);

    // Obținem serviciul de stocare
    const storage = StorageFactory.getStorage();

    // Utilizăm noua metodă de încărcare paralelă pentru performanță
    // Aceasta va procesa toate fișierele în paralel, cu un număr limitat de conexiuni simultane
    const results = await storage.uploadFilesParallel(transferId, files, 4);

    return NextResponse.json({
      success: true,
      processedFiles: results.filter((r: UploadResult) => r.success).length,
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