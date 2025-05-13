import { NextRequest, NextResponse } from 'next/server';
import { EncryptionService } from '../../../../services/EncryptionService';

// Această rută trebuie să ruleze pe Node.js și nu pe Edge Runtime
export const runtime = 'nodejs';

// Dezactivăm caching pentru acest endpoint
export const dynamic = 'force-dynamic';

/**
 * Endpoint pentru pregătirea criptării
 * Preîncarcă cheia de criptare pentru un transfer specific
 * pentru a optimiza operațiile de upload ulterioare
 */
export async function POST(request: NextRequest) {
  try {
    // Verificăm dacă serviciul de criptare este disponibil
    if (!EncryptionService.isReady()) {
      return NextResponse.json(
        { error: 'Serviciul de criptare nu este disponibil' },
        { status: 503 }
      );
    }
    
    // Parsăm body-ul cererii
    const body = await request.json();
    const { transferId } = body;
    
    if (!transferId) {
      return NextResponse.json(
        { error: 'ID-ul transferului lipsește' },
        { status: 400 }
      );
    }
    
    // Preîncărcăm cheia pentru transferul specificat
    EncryptionService.preloadKey(transferId);
    
    // Trimitem răspunsul de succes
    return NextResponse.json({
      success: true,
      message: 'Cheia de criptare a fost preîncărcată cu succes'
    });
    
  } catch (error) {
    console.error('Eroare la pregătirea criptării:', error);
    return NextResponse.json(
      { error: 'Eroare internă de server' },
      { status: 500 }
    );
  }
} 