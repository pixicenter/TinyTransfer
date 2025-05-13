import crypto from 'crypto';
import { Transform } from 'stream';
import fs from 'fs';
import path from 'path';

/**
 * Serviciu pentru criptarea și decriptarea fișierelor în iTransfer
 * Implementează criptare AES-256-CBC pentru fișiere la upload/download
 */
export class EncryptionService {
  // Cheia master pentru criptarea/decriptarea fișierelor (32 bytes pentru AES-256)
  private static masterKey: Buffer | null = null;
  
  // Salt pentru derivarea cheii din master key - va fi generat la inițializare
  private static keySalt: Buffer | null = null;
  
  // Inițializat după ce masterKey este setat
  private static isInitialized: boolean = false;

  // Lungimea IV (Initialization Vector) pentru AES-CBC
  private static readonly IV_LENGTH = 16;
  
  // Lungimea salt-ului în bytes
  private static readonly SALT_LENGTH = 16;
  
  // Lungimea tag-ului de autentificare pentru AES-GCM (nu e folosit în cazul CBC)
  private static readonly TAG_LENGTH = 16;
  
  // Calea către fișierul de salt
  private static readonly SALT_FILE_PATH = path.join(process.cwd(), 'data', 'encryption_salt.bin');

  // Cache pentru cheile derivate - îmbunătățește performanța
  private static keyCache: Map<string, Buffer> = new Map();

  // Numărul de iterații pentru PBKDF2 - redus pentru performanță
  private static readonly PBKDF2_ITERATIONS = 1000; // Redus de la 10000
  
  // Flag pentru a controla nivelul de logging
  private static verbose: boolean = false;

  /**
   * Inițializează serviciul de criptare cu o cheie master
   * @param masterKeyString Cheia master în format string (va fi convertită în buffer)
   * @param saltString Salt-ul în format hex string (opțional)
   * @returns true dacă inițializarea a reușit
   */
  static initialize(masterKeyString?: string, saltString?: string): boolean {
    try {
      if (this.isInitialized) {
        console.log('EncryptionService este deja inițializat');
        return true;
      }

      // Generăm sau folosim cheia master existentă
      if (masterKeyString) {
        // Dacă primim cheia ca string, o hash-uim pentru a obține 32 de bytes
        const hash = crypto.createHash('sha256');
        hash.update(masterKeyString);
        this.masterKey = hash.digest();
      } else {
        // Generăm o cheie aleatoare de 32 bytes (256 biți)
        this.masterKey = crypto.randomBytes(32);
        // console.log('Cheie de criptare generată automat:', this.masterKey.toString('hex'));
      }

      // Încărcăm salt-ul din una din sursele disponibile
      this.keySalt = this.loadOrCreateSalt(saltString);
      
      this.isInitialized = true;
      console.log('EncryptionService inițializat cu succes');
      // console.log(`Salt folosit pentru derivarea cheii: ${this.keySalt?.toString('hex')}`);
      
      // Resetăm cache-ul de chei
      this.keyCache.clear();
      
      return true;
    } catch (error) {
      console.error('Eroare la inițializarea EncryptionService:', error);
      return false;
    }
  }
  
  /**
   * Încarcă salt-ul din variabila de mediu, fișier, sau creează unul nou
   * @param saltString Salt-ul în format hex string (opțional)
   * @returns Buffer cu salt-ul
   */
  private static loadOrCreateSalt(saltString?: string): Buffer {
    try {
      // 1. Încercăm să folosim saltString dacă este furnizat
      if (saltString) {
        try {
          // Verificăm dacă string-ul este un hex valid și are lungimea corectă
          if (/^[0-9a-f]{32}$/i.test(saltString)) {
            // console.log('Salt încărcat din parametrul furnizat');
            return Buffer.from(saltString, 'hex');
          } else {
            throw new Error('Formatul salt-ului furnizat este invalid (trebuie să fie 32 de caractere hex)');
          }
        } catch (error) {
          console.error('Eroare la parsarea salt-ului din string:', error);
          // Continuăm cu următoarea metodă dacă aceasta eșuează
        }
      }
      
      // 2. Încercăm să folosim variabila de mediu ENCRYPTION_SALT
      const envSalt = process.env.ENCRYPTION_SALT;
      if (envSalt) {
        try {
          // Verificăm dacă string-ul este un hex valid și are lungimea corectă
          if (/^[0-9a-f]{32}$/i.test(envSalt)) {
            // console.log('Salt încărcat din variabila de mediu ENCRYPTION_SALT');
            return Buffer.from(envSalt, 'hex');
          } else {
            console.warn('Formatul salt-ului din variabila de mediu este invalid (trebuie să fie 32 de caractere hex)');
            // Continuăm cu următoarea metodă
          }
        } catch (error) {
          console.error('Eroare la parsarea salt-ului din variabila de mediu:', error);
          // Continuăm cu următoarea metodă
        }
      }
      
      // 3. Încercăm să încărcăm din fișierul de salt (pentru compatibilitate)
      // Asigură-te că directorul data există
      const dataDir = path.dirname(this.SALT_FILE_PATH);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      if (fs.existsSync(this.SALT_FILE_PATH)) {
        try {
          const salt = fs.readFileSync(this.SALT_FILE_PATH);
          // console.log('Salt încărcat din fișierul existent');
          
          // Opțional: Salvăm salt-ul în variabila de mediu pentru viitoare inițializări
          if (process.env.NODE_ENV === 'development') {
            console.log('RECOMANDARE: Setați următoarea variabilă în .env.local pentru a evita folosirea fișierului de salt:');
            // console.log(`ENCRYPTION_SALT="${salt.toString('hex')}"`);
          }
          
          return salt;
        } catch (error) {
          console.error('Eroare la citirea fișierului de salt:', error);
          // Continuăm cu generarea unui salt nou
        }
      }
      
      // 4. Generăm un salt nou
      const newSalt = crypto.randomBytes(this.SALT_LENGTH);
      console.log('Salt nou generat');
      
      // Salvăm salt-ul în fișier pentru compatibilitate
      try {
        fs.writeFileSync(this.SALT_FILE_PATH, newSalt);
        console.log('Salt nou salvat în fișier');
      } catch (error) {
        console.warn('Nu s-a putut salva salt-ul în fișier:', error);
      }
      
      // Afișăm recomandarea pentru setarea variabilei de mediu
      if (process.env.NODE_ENV === 'development') {
        // console.log('IMPORTANT: Copiați acest salt în variabila de mediu pentru consistență între reporniri:');
        // console.log(`ENCRYPTION_SALT="${newSalt.toString('hex')}"`);
      }
      
      return newSalt;
    } catch (error) {
      console.error('Eroare critică la încărcarea/crearea salt-ului:', error);
      // În caz de eroare, generăm un salt temporar în memorie
      console.warn('Se folosește un salt temporar în memorie - decriptarea nu va fi persistentă între reporniri!');
      return crypto.randomBytes(this.SALT_LENGTH);
    }
  }

  /**
   * Verifică dacă serviciul este inițializat
   * @returns true dacă serviciul este inițializat
   */
  static isReady(): boolean {
    return this.isInitialized && !!this.masterKey && !!this.keySalt;
  }

  /**
   * Exportă cheia master pentru backup (utilizată doar în scopuri administrative)
   * @returns Cheia master în format hex string
   */
  static exportMasterKey(): string | null {
    if (!this.isReady()) {
      console.error('EncryptionService nu este inițializat');
      return null;
    }
    
    return this.masterKey!.toString('hex');
  }
  
  /**
   * Exportă salt-ul pentru backup (utilizat doar în scopuri administrative)
   * @returns Salt-ul în format hex string
   */
  static exportSalt(): string | null {
    if (!this.isReady()) {
      console.error('EncryptionService nu este inițializat');
      return null;
    }
    
    return this.keySalt!.toString('hex');
  }

  /**
   * Setează verbose logging pentru depanare
   * @param verbose Starea de verbose logging (true/false)
   */
  static setVerboseLogging(verbose: boolean): void {
    this.verbose = verbose;
  }

  /**
   * Derivă o cheie unică pentru un transfer specific
   * @param transferId ID-ul transferului pentru care se derivă cheia
   * @returns Buffer cu cheia derivată
   */
  private static deriveKeyForTransfer(transferId: string): Buffer {
    if (!this.isReady()) {
      throw new Error('EncryptionService nu este inițializat');
    }

    // Verificăm dacă avem deja cheia în cache
    const cacheKey = `key_${transferId}`;
    if (this.keyCache.has(cacheKey)) {
      return this.keyCache.get(cacheKey)!;
    }

    // Derivăm o cheie unică pentru fiecare transfer folosind PBKDF2
    const transferKey = transferId + this.keySalt!.toString('hex');
    if (this.verbose) {
      console.log(`Derivare cheie pentru transferul: ${transferId} folosind salt`);
    }
    
    const derivedKey = crypto.pbkdf2Sync(
      this.masterKey!,                   // Cheia de bază
      transferKey,                       // Salt specific transferului + salt global
      this.PBKDF2_ITERATIONS,            // Iterații reduse pentru PBKDF2
      32,                                // Lungimea cheii derivate (bytes)
      'sha256'                           // Funcția hash
    );
    
    // Adăugăm cheia în cache pentru utilizare ulterioară
    this.keyCache.set(cacheKey, derivedKey);
    
    return derivedKey;
  }

  /**
   * Criptează un buffer de date pentru un transfer specific
   * @param data Buffer-ul de date de criptat
   * @param transferId ID-ul transferului
   * @returns Buffer cu datele criptate (include IV la început)
   */
  static encryptBuffer(data: Buffer, transferId: string): Buffer {
    if (!this.isReady()) {
      throw new Error('EncryptionService nu este inițializat');
    }

    try {
      // Derivăm cheia specifică pentru acest transfer
      const key = this.deriveKeyForTransfer(transferId);
      
      // Generăm un IV (Initialization Vector) aleator pentru fiecare operațiune de criptare
      const iv = crypto.randomBytes(this.IV_LENGTH);
      
      // Creăm un cifru AES-256-CBC
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
      
      // Criptăm datele
      const encryptedData = Buffer.concat([
        cipher.update(data),
        cipher.final()
      ]);
      
      // Adăugăm IV la începutul datelor criptate pentru a-l avea la decriptare
      return Buffer.concat([iv, encryptedData]);
    } catch (error: any) {
      // console.error(`Eroare la criptarea buffer-ului pentru transferul ${transferId}:`, error);
      throw error;
    }
  }

  /**
   * Decriptează un buffer de date pentru un transfer specific
   * @param encryptedData Buffer-ul cu datele criptate (include IV la început)
   * @param transferId ID-ul transferului
   * @returns Buffer cu datele decriptate
   */
  static decryptBuffer(encryptedData: Buffer, transferId: string): Buffer {
    if (!this.isReady()) {
      throw new Error('EncryptionService nu este inițializat');
    }
    
    try {
      // Verificăm dacă buffer-ul are cel puțin dimensiunea IV
      if (encryptedData.length < this.IV_LENGTH) {
        throw new Error(`Buffer insuficient pentru decriptare: ${encryptedData.length} bytes (minim ${this.IV_LENGTH} necesar)`);
      }
      
      // Derivăm cheia specifică pentru acest transfer
      const key = this.deriveKeyForTransfer(transferId);
      
      // Extragem IV-ul (primii IV_LENGTH bytes din datele criptate)
      const iv = encryptedData.subarray(0, this.IV_LENGTH);
      
      // Restul datelor reprezintă textul criptat efectiv
      const ciphertext = encryptedData.subarray(this.IV_LENGTH);
      
      // Verificăm dacă avem date criptate valide
      if (ciphertext.length === 0) {
        throw new Error('Nu există date criptate după IV');
      }
      
      // Creăm un decipher AES-256-CBC
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      
      // Decriptăm datele
      return Buffer.concat([
        decipher.update(ciphertext),
        decipher.final()
      ]);
    } catch (error: any) {
      // console.error(`Eroare la decriptarea buffer-ului pentru transferul ${transferId}:`, error);
      // Re-aruncăm eroarea pentru a fi gestionată la nivel superior
      throw error;
    }
  }

  /**
   * Creează un transform stream pentru criptarea datelor
   * @param transferId ID-ul transferului
   * @returns Transform stream care criptează datele care trec prin el
   */
  static createEncryptStream(transferId: string): Transform {
    if (!this.isReady()) {
      throw new Error('EncryptionService nu este inițializat');
    }
    
    if (this.verbose) {
      console.log(`Creez stream de criptare pentru transferul: ${transferId}`);
    }
    
    // Derivăm cheia specifică pentru acest transfer
    const key = this.deriveKeyForTransfer(transferId);
    
    // Generăm un IV aleator pentru această operațiune de criptare
    const iv = crypto.randomBytes(this.IV_LENGTH);
    if (this.verbose) {
      console.log(`IV generat pentru criptare: ${iv.toString('hex')}`);
    }
    
    // Creăm un cifru AES-256-CBC
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    
    // Flag pentru a indica dacă este primul chunk (pentru a adăuga IV)
    let isFirstChunk = true;
    
    // Creăm un transform stream pentru criptare
    const encryptStream = new Transform({
      // Setăm un buffer highWaterMark mai mare pentru performanță mai bună
      highWaterMark: 1024 * 1024, // 1MB

      transform(chunk, encoding, callback) {
        try {
          if (isFirstChunk) {
            // Pentru primul chunk, adăugăm IV-ul la început
            isFirstChunk = false;
            const encryptedChunk = cipher.update(chunk);
            callback(null, Buffer.concat([iv, encryptedChunk]));
          } else {
            // Pentru celelalte chunk-uri, doar criptăm
            callback(null, cipher.update(chunk));
          }
        } catch (error: any) {
          if (EncryptionService.verbose) {
            // console.error(`Eroare la criptarea chunk-ului pentru transferul ${transferId}:`, error);
          }
          callback(error as Error);
        }
      },
      flush(callback) {
        try {
          // La final, adăugăm rezultatul cipher.final()
          const finalChunk = cipher.final();
          callback(null, finalChunk);
        } catch (error: any) {
          // console.error(`Eroare la finalizarea criptării pentru transferul ${transferId}:`, error);
          callback(error as Error);
        }
      }
    });
    
    return encryptStream;
  }

  /**
   * Creează un transform stream pentru decriptarea datelor
   * @param transferId ID-ul transferului
   * @returns Transform stream care decriptează datele care trec prin el
   */
  static createDecryptStream(transferId: string): Transform {
    if (!this.isReady()) {
      throw new Error('EncryptionService nu este inițializat');
    }
    
    // console.log(`Creez stream de decriptare pentru transferul: ${transferId}`);
    // console.log(`Salt folosit pentru derivarea cheii: ${this.keySalt?.toString('hex')}`);
    
    // Derivăm cheia specifică pentru acest transfer
    const key = this.deriveKeyForTransfer(transferId);
    
    // Creăm un buffer pentru a colecta primele date până avem IV-ul complet
    let pendingBuffer = Buffer.alloc(0);
    
    // Flag pentru a indica dacă am procesat IV-ul
    let ivProcessed = false;
    
    // Decipher-ul va fi creat după ce avem IV-ul
    let decipher: crypto.Decipher;
    
    // Creăm un transform stream pentru decriptare
    const decryptStream = new Transform({
      transform(chunk, encoding, callback) {
        try {
          if (!ivProcessed) {
            // Adăugăm chunk-ul la buffer-ul pending
            pendingBuffer = Buffer.concat([pendingBuffer, chunk]);
            
            // Verificăm dacă avem suficiente date pentru IV
            if (pendingBuffer.length >= EncryptionService.IV_LENGTH) {
              // Extragem IV-ul
              const iv = pendingBuffer.subarray(0, EncryptionService.IV_LENGTH);
              console.log(`IV extras din date: ${iv.toString('hex')}`);
              
              try {
                // Creăm decipher-ul
                decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
                
                // Restul datelor din buffer reprezintă text criptat
                const remainingData = pendingBuffer.subarray(EncryptionService.IV_LENGTH);
                
                // Decriptăm datele rămase și le trimitem
                if (remainingData.length > 0) {
                  callback(null, decipher.update(remainingData));
                } else {
                  callback();
                }
                
                // Marcăm IV-ul ca procesat și eliberăm buffer-ul
                ivProcessed = true;
                pendingBuffer = Buffer.alloc(0);
              } catch (error: any) {
                console.error(`Eroare la inițializarea decriptării pentru transferul ${transferId}:`, error);
                callback(new Error(`Eroare la configurarea decriptării: ${error.message}`));
              }
            } else {
              // Nu avem încă suficiente date pentru IV
              callback();
            }
          } else {
            // IV-ul a fost procesat, decriptăm datele direct
            try {
              callback(null, decipher.update(chunk));
            } catch (error: any) {
              // console.error(`Eroare la decriptarea chunk-ului pentru transferul ${transferId}:`, error);
              callback(new Error(`Eroare la decriptarea chunk-ului: ${error.message}`));
            }
          }
        } catch (error: any) {
          // console.error(`Eroare generală în transform stream pentru transferul ${transferId}:`, error);
          callback(error as Error);
        }
      },
      flush(callback) {
        try {
          if (ivProcessed) {
            // Finalizăm decriptarea
            try {
              callback(null, decipher.final());
            } catch (error: any) {
              // console.error(`Eroare la finalizarea decriptării pentru transferul ${transferId}:`, error);
              callback(new Error(`Eroare la finalizarea decriptării: ${error.message}`));
            }
          } else {
            // Nu am primit suficiente date pentru IV
            callback(new Error(`Date insuficiente pentru decriptare (${pendingBuffer.length} bytes primite, minim ${EncryptionService.IV_LENGTH} necesar)`));
          }
        } catch (error: any) {
          // console.error(`Eroare generală în flush pentru transferul ${transferId}:`, error);
          callback(error as Error);
        }
      }
    });
    
    return decryptStream;
  }

  /**
   * Preîncarcă o cheie derivată pentru un transfer specific
   * Utilizarea acestei metode înainte de operații multiple de criptare/decriptare
   * va îmbunătăți performanța prin evitarea recalculării repetate a cheii
   * 
   * @param transferId ID-ul transferului pentru care se preîncarcă cheia
   */
  static preloadKey(transferId: string): void {
    if (!this.isReady()) {
      throw new Error('EncryptionService nu este inițializat');
    }
    
    // Forțează calculul și cache-uirea cheii
    this.deriveKeyForTransfer(transferId);
  }
  
  /**
   * Preîncarcă cheile derivate pentru mai multe transferuri
   * Util când se știe dinainte că vor fi necesare multiple operații
   * 
   * @param transferIds Array cu ID-urile transferurilor pentru care se preîncarcă cheile
   */
  static preloadKeys(transferIds: string[]): void {
    if (!this.isReady()) {
      throw new Error('EncryptionService nu este inițializat');
    }
    
    for (const transferId of transferIds) {
      this.preloadKey(transferId);
    }
  }
  
  /**
   * Eliberează memoria ocupată de cache-ul de chei
   * Poate fi folosită periodic pentru a gestiona memoria
   * 
   * @param transferId ID-ul transferului pentru care se elimină cheia (opțional)
   */
  static clearKeyCache(transferId?: string): void {
    if (transferId) {
      // Elimină doar cheia unui anumit transfer
      const cacheKey = `key_${transferId}`;
      this.keyCache.delete(cacheKey);
    } else {
      // Elimină toate cheile
      this.keyCache.clear();
    }
  }
} 