import { NextRequest, NextResponse } from 'next/server';
import { EncryptionService } from '../../../../services/EncryptionService';
import { initializeServices } from '../../../../lib/app-init';

// Ruta va rula pe Node.js
export const runtime = 'nodejs';

// Dezactivăm caching
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Starea inițială
    let initialStatus = {
      isReady: EncryptionService.isReady(),
      masterKeyPresent: process.env.ENCRYPTION_MASTER_KEY ? true : false,
      saltPresent: process.env.ENCRYPTION_SALT ? true : false,
      useEncryption: process.env.USE_ENCRYPTION !== 'false'
    };
    
    console.log('Stare inițială serviciu criptare:', initialStatus);
    
    // Încercăm reinițializarea
    console.log('Încercare reinițializare servicii...');
    initializeServices();
    
    // Starea după reinițializare
    const currentStatus = {
      isReady: EncryptionService.isReady(),
      masterKeyPresent: process.env.ENCRYPTION_MASTER_KEY ? true : false,
      saltPresent: process.env.ENCRYPTION_SALT ? true : false,
      useEncryption: process.env.USE_ENCRYPTION !== 'false'
    };
    
    console.log('Stare curentă serviciu criptare:', currentStatus);
    
    return NextResponse.json({
      initialStatus,
      currentStatus,
      message: "Verificare stare serviciu criptare completă"
    });
  } catch (error) {
    console.error('Eroare la verificarea serviciului de criptare:', error);
    return NextResponse.json(
      { error: 'Eroare internă de server' },
      { status: 500 }
    );
  }
} 