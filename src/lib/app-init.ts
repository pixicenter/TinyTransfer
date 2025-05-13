import { EncryptionService } from '../services/EncryptionService';
import fs from 'fs';
import path from 'path';

/**
 * Inițializează serviciile globale ale aplicației
 */
export function initializeServices() {
  console.log('Inițializare servicii globale...');
  
  // Verificăm configurările de criptare
  const useEncryption = process.env.USE_ENCRYPTION !== 'false';
  const encryptionKey = process.env.ENCRYPTION_MASTER_KEY || undefined;
  const encryptionSalt = process.env.ENCRYPTION_SALT || undefined;
  
  console.log(`Stare criptare: ${useEncryption ? 'ACTIVATĂ' : 'DEZACTIVATĂ'}`);
  
  if (useEncryption) {
    if (!encryptionKey) {
      console.warn('AVERTISMENT: Variabila ENCRYPTION_MASTER_KEY nu este setată!');
      console.warn('Se va genera o cheie aleatorie, dar aceasta nu va fi persistentă între reporniri!');
      console.warn('Setați ENCRYPTION_MASTER_KEY în .env.local pentru a asigura persistența cheii.');
    } else {
      // console.log('Cheie de criptare configurată din variabilele de mediu.');
    }
    
    if (!encryptionSalt) {
      console.warn('AVERTISMENT: Variabila ENCRYPTION_SALT nu este setată!');
      console.warn('Se va încerca încărcarea salt-ului din fișier sau generarea unuia nou.');
      console.warn('Pentru securitate maximă, setați ENCRYPTION_SALT în .env.local.');
    } else {
      // console.log('Salt de criptare configurat din variabilele de mediu.');
    }
    
    // Verificăm dacă directorul de date există (pentru compatibilitate)
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
        // console.log('Director de date creat pentru stocarea salt-ului de criptare.');
      } catch (error) {
        console.error('Eroare la crearea directorului de date:', error);
        if (!encryptionSalt) {
          console.warn('AVERTISMENT: Decriptarea poate să nu funcționeze între reporniri!');
        }
      }
    }
  }
  
  // Inițializare serviciu de criptare cu cheia și salt-ul
  const encryptionInitialized = EncryptionService.initialize(encryptionKey, encryptionSalt);
  
  if (encryptionInitialized) {
    // console.log('Serviciu de criptare inițializat cu succes.');
    
    // Afișăm informații doar în development, pentru debugging
    if (process.env.NODE_ENV === 'development') {
      // const masterKey = EncryptionService.exportMasterKey();
      // const salt = EncryptionService.exportSalt();
      
      // console.log('Informații pentru dezvoltare:');
      // console.log('- Cheie master de criptare:', masterKey);
      // console.log('- Salt pentru derivarea cheilor:', salt);
      
      if (!encryptionKey || !encryptionSalt) {
        console.log('IMPORTANT: Setați următoarele variabile în .env.local pentru a asigura persistența criptării:');
        if (!encryptionKey) {
          // console.log(`ENCRYPTION_MASTER_KEY="${masterKey}"`);
        }
        if (!encryptionSalt) {
          // console.log(`ENCRYPTION_SALT="${salt}"`);
        }
      }
    }
  } else {
    console.warn('AVERTISMENT: Serviciul de criptare nu a putut fi inițializat!');
    console.warn('Verificați configurările și permisiunile de sistem.');
    
    if (useEncryption) {
      console.error('EROARE CRITICĂ: Criptarea este activată, dar serviciul nu a putut fi inițializat!');
      console.error('Fișierele criptate anterior nu vor putea fi decriptate.');
    }
  }
}

// Auto-inițializare când rulează pe server
if (typeof window === 'undefined') {
  initializeServices();
} 