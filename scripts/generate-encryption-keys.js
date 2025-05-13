const crypto = require('crypto');

/**
 * Script pentru generarea cheilor de criptare pentru TinyTransfer
 * Generează cheie master și salt pentru variabilele de mediu
 */

// Generare cheie master (32 bytes / 256 biți)
const masterKey = crypto.randomBytes(32).toString('hex');

// Generare salt (16 bytes / 128 biți)
const salt = crypto.randomBytes(16).toString('hex');

console.log(`\n=== CHEI DE CRIPTARE PENTRU TINYTRANSFER ===\n`);
console.log(`ENCRYPTION_MASTER_KEY="${masterKey}"`);
console.log(`ENCRYPTION_SALT="${salt}"\n`);
console.log(`Adaugați aceste variabile în fișierul .env.local pentru a activa criptarea.\n`); 