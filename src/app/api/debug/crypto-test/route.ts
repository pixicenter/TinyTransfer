import { NextRequest, NextResponse } from 'next/server';
import { EncryptionService } from '../../../../services/EncryptionService';
import { initializeServices } from '../../../../lib/app-init';
import crypto from 'crypto';

// Ruta va rula pe Node.js
export const runtime = 'nodejs';

// Dezactivăm caching
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Forțăm inițializarea serviciilor
    console.log('Inițializare servicii...');
    initializeServices();
    
    // Verificăm starea de inițializare
    const isReady = EncryptionService.isReady();
    console.log(`Serviciu de criptare inițializat: ${isReady}`);
    
    if (!isReady) {
      return NextResponse.json(
        { error: 'Serviciul de criptare nu este inițializat' },
        { status: 500 }
      );
    }
    
    // Testăm criptarea/decriptarea
    const transferId = 'test-' + Date.now();
    const testData = Buffer.from('Acesta este un test de criptare pentru iTransfer');
    console.log(`Date originale (${testData.length} bytes): ${testData.toString()}`);
    
    try {
      // Criptăm datele
      console.log('Începere test criptare...');
      const encryptedData = EncryptionService.encryptBuffer(testData, transferId);
      console.log(`Date criptate (${encryptedData.length} bytes): ${encryptedData.toString('hex').substring(0, 50)}...`);
      
      // Decriptăm datele
      console.log('Începere test decriptare...');
      const decryptedData = EncryptionService.decryptBuffer(encryptedData, transferId);
      console.log(`Date decriptate (${decryptedData.length} bytes): ${decryptedData.toString()}`);
      
      // Verificăm rezultatul
      const testSuccessful = testData.toString() === decryptedData.toString();
      console.log(`Test criptare/decriptare: ${testSuccessful ? 'SUCCES' : 'EȘEC'}`);
      
      return NextResponse.json({
        isReady,
        testSuccessful,
        originalDataSize: testData.length,
        encryptedDataSize: encryptedData.length,
        decryptedDataSize: decryptedData.length,
        originalData: testData.toString(),
        decryptedData: decryptedData.toString(),
        message: "Test criptare/decriptare finalizat"
      });
    } catch (cryptoError) {
      console.error('Eroare în timpul testului de criptare:', cryptoError);
      return NextResponse.json(
        { error: 'Eroare la testul de criptare/decriptare', details: String(cryptoError) },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Eroare generală la testarea criptării:', error);
    return NextResponse.json(
      { error: 'Eroare internă de server' },
      { status: 500 }
    );
  }
} 