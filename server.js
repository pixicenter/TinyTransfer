// Fișier server.js personalizat pentru Next.js
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Încărcăm variabilele de mediu cât mai devreme
const dotenv = require('dotenv');

// Încărcăm explicit .env.local
const envLocalPath = path.resolve(process.cwd(), '.env.local');
const envLocalResult = dotenv.config({ path: envLocalPath });

if (envLocalResult.error) {
  console.error(`❌ Eroare la încărcarea .env.local: ${envLocalResult.error.message}`);
} else {
  console.log(`✅ Fișierul .env.local încărcat cu succes de la: ${envLocalPath}`);
}

// Adăugăm și încărcarea implicită pentru siguranță
dotenv.config();

// Verificăm dacă avem variabile specifice pentru depanare
console.log('🔍 VERIFICARE VARIABILE DE MEDIU ÎNCĂRCATE:');
console.log(`- APP_NAME: ${process.env.APP_NAME || 'nedefinit'}`);
console.log(`- ENCRYPTION_MASTER_KEY primii 8 caractere: ${process.env.ENCRYPTION_MASTER_KEY?.substring(0, 8) || 'nedefinit'}`);
console.log(`- ENCRYPTION_SALT primii 8 caractere: ${process.env.ENCRYPTION_SALT?.substring(0, 8) || 'nedefinit'}`);
console.log(`- USE_ENCRYPTION: ${process.env.USE_ENCRYPTION || 'nedefinit'}`);
console.log(`- NODE_ENV: ${process.env.NODE_ENV || 'nedefinit'}`);

// Determinăm modul de rulare (development sau production)
// Forțăm modul de dezvoltare dacă nu există build
const nextBuildDir = path.join(process.cwd(), '.next');
const hasBuild = fs.existsSync(nextBuildDir) && fs.readdirSync(nextBuildDir).length > 0;

// Setăm modul de rulare - forțăm development dacă nu există build
let dev = process.env.NODE_ENV !== 'production';
if (!hasBuild && process.env.NODE_ENV === 'production') {
  console.warn('⚠️ Nu s-a găsit un build în directorul .next, se forțează modul de dezvoltare.');
  dev = true;
}

console.log(`🚀 Rulăm în mod: ${dev ? 'development' : 'production'}`);

const app = next({ dev });
const handle = app.getRequestHandler();

// PORT pe care va rula serverul
const PORT = process.env.PORT || 3000;

// Inițializăm serviciile globale ale aplicației
console.log('🔹 Inițializare servicii globale pentru iTransfer...');

// Inițializăm manual serviciul de criptare
try {
  // Verifică dacă criptarea este activată
  const useEncryption = process.env.USE_ENCRYPTION !== 'false';
  console.log(`Stare criptare: ${useEncryption ? 'ACTIVATĂ' : 'DEZACTIVATĂ'}`);
  
  if (useEncryption) {
    // Obține sau generează cheia de criptare
    const encryptionKey = process.env.ENCRYPTION_MASTER_KEY;
    if (!encryptionKey) {
      console.warn('⚠️ AVERTISMENT: Variabila ENCRYPTION_MASTER_KEY nu este setată!');
      console.warn('Se va genera o cheie aleatorie, dar aceasta nu va fi persistentă între reporniri!');
      
      // Generăm și afișăm o cheie pentru dezvoltare
      if (dev) {
        const randomKey = crypto.randomBytes(32).toString('hex');
        console.log('Cheie generată (adaugă în .env.local):');
        console.log(`ENCRYPTION_MASTER_KEY="${randomKey}"`);
      }
    } else {
      console.log('✅ Cheie de criptare configurată din variabilele de mediu.');
    }
    
    // Obține sau generează salt-ul
    const encryptionSalt = process.env.ENCRYPTION_SALT;
    if (!encryptionSalt) {
      console.warn('⚠️ AVERTISMENT: Variabila ENCRYPTION_SALT nu este setată!');
      
      // Verifică dacă există fișierul de salt (pentru compatibilitate)
      const saltFilePath = path.join(process.cwd(), 'data', 'encryption_salt.bin');
      let saltExists = false;
      
      try {
        if (fs.existsSync(path.dirname(saltFilePath))) {
          if (fs.existsSync(saltFilePath)) {
            console.log('✅ Salt găsit în fișierul de pe disc.');
            saltExists = true;
          }
        } else {
          // Creăm directorul data dacă nu există
          fs.mkdirSync(path.dirname(saltFilePath), { recursive: true });
          console.log('📁 Director de date creat pentru salt.');
        }
      } catch (diskError) {
        console.error('❌ Eroare la verificarea fișierului de salt:', diskError);
      }
      
      if (!saltExists && dev) {
        // Generăm și afișăm un salt pentru dezvoltare
        const randomSalt = crypto.randomBytes(16).toString('hex');
        console.log('Salt generat (adaugă în .env.local):');
        console.log(`ENCRYPTION_SALT="${randomSalt}"`);
      }
    } else {
      console.log('✅ Salt de criptare configurat din variabilele de mediu.');
    }
  }
  
  console.log('✅ Configurare criptare finalizată!');
} catch (error) {
  console.error('❌ Eroare la configurarea criptării:', error);
}

// Verificăm dacă trebuie să construim aplicația pentru producție
if (!dev && !hasBuild) {
  console.log('⚙️ Nu s-a găsit un build pentru producție, se construiește aplicația...');
  try {
    // Executăm comanda de build
    const { execSync } = require('child_process');
    execSync('npm run build', { stdio: 'inherit' });
    console.log('✅ Build realizat cu succes!');
  } catch (error) {
    console.error('❌ Eroare la construirea aplicației:', error);
    process.exit(1);
  }
}

// Pornim serverul Next.js când este gata
console.log('⚙️ Se pregătește server-ul Next.js...');
app.prepare().then(() => {
  createServer((req, res) => {
    // Parseaza URL-ul din request
    const parsedUrl = parse(req.url, true);
    
    // Trimite request-ul către Next.js pentru procesare
    handle(req, res, parsedUrl);
  }).listen(PORT, (err) => {
    if (err) throw err;
    console.log(`> Server gata! Aplicația rulează la http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('❌ Eroare la pornirea serverului:', err);
  process.exit(1);
}); 