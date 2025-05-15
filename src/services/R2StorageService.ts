import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable, PassThrough } from 'stream';
import JSZip from 'jszip';
import { StorageProvider } from './StorageFactory';
import { EncryptionService } from './EncryptionService';

// Verificăm dacă codul rulează pe server sau pe client
const isServer = typeof window === 'undefined';

// Implementare simplificată a pipeline-ului care funcționează atât în browser cât și pe server
const streamPipeline = async (source: NodeJS.ReadableStream, ...destinations: any[]): Promise<void> => {
  return new Promise((resolve, reject) => {
    let current = source;
    
    // Conectăm stream-urile în serie
    for (const dest of destinations) {
      current.pipe(dest);
      current = dest;
    }
    
    // Configurăm evenimentele pe ultimul stream din lanț
    const lastDest = destinations[destinations.length - 1];
    
    lastDest.on('finish', resolve);
    lastDest.on('error', (err: Error) => {
      reject(err);
    });
    
    // Adăugăm handler de eroare pentru sursa inițială
    source.on('error', (err: Error) => {
      lastDest.destroy(err);
      reject(err);
    });
    
    // Adăugăm handler de eroare pentru toate stream-urile intermediare
    for (let i = 0; i < destinations.length - 1; i++) {
      destinations[i].on('error', (err: Error) => {
        lastDest.destroy(err);
        reject(err);
      });
    }
  });
};

// Interfața pentru un fișier R2
interface R2File {
  name: string;
  size: number;
  lastModified?: Date;
  etag: string;
}

export class R2StorageService implements StorageProvider {
  private client: S3Client;
  private bucket: string;
  private publicUrl: string | null;
  private useEncryption: boolean = true; // Flag pentru activarea/dezactivarea criptării

  constructor() {
    // Obținem credențialele din variabilele de mediu
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucketName = process.env.R2_BUCKET_NAME;
    
    // Inițializăm URL-ul public al bucket-ului dacă există
    this.publicUrl = process.env.R2_PUBLIC_URL || null;
    
    // Verificăm dacă toate credențialele necesare sunt disponibile
    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      console.error('Credențiale lipsă pentru serviciul R2:');
      console.error(`- R2_ACCOUNT_ID: ${accountId ? 'prezent' : 'lipsește'}`);
      console.error(`- R2_ACCESS_KEY_ID: ${accessKeyId ? 'prezent' : 'lipsește'}`);
      console.error(`- R2_SECRET_ACCESS_KEY: ${secretAccessKey ? 'prezent' : 'lipsește'}`);
      console.error(`- R2_BUCKET_NAME: ${bucketName ? 'prezent' : 'lipsește'}`);
      throw new Error('Lipsesc credențialele R2 necesare. Verificați variabilele de mediu.');
    }

    console.log(`Inițializare client S3 pentru R2 cu bucket: ${bucketName}`);
    
    // Inițializăm clientul S3 pentru R2
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    this.bucket = bucketName;
    
    // Inițializăm serviciul de criptare
    // Cheia și salt-ul pot fi setate prin variabilele de mediu
    const encryptionKey = process.env.ENCRYPTION_MASTER_KEY || undefined;
    const encryptionSalt = process.env.ENCRYPTION_SALT || undefined;
    
    console.log('Chei de criptare disponibile:',
      `ENCRYPTION_MASTER_KEY=${encryptionKey ? 'setat' : 'nesetat'}`,
      `ENCRYPTION_SALT=${encryptionSalt ? 'setat' : 'nesetat'}`);
    
    const initialized = EncryptionService.initialize(encryptionKey, encryptionSalt);
    const ready = EncryptionService.isReady();
    
    // Setăm flag-ul de criptare în funcție de variabila de mediu
    this.useEncryption = process.env.USE_ENCRYPTION !== 'false';
    
    console.log(`Stare serviciu criptare în R2StorageService:`, 
      `useEncryption=${this.useEncryption}`,
      `initialized=${initialized}`,
      `isReady=${ready}`);
  }

  /**
   * Setează starea criptării pentru toată aplicația
   * @param state True pentru a activa criptarea, false pentru a o dezactiva
   */
  setEncryptionState(state: boolean): void {
    this.useEncryption = state;
    // console.log(`Criptare fișiere: ${this.useEncryption ? 'activată' : 'dezactivată'}`);
  }

  /**
   * Încarcă un fișier în R2
   * @param transferId ID-ul transferului
   * @param file Fișierul de încărcat
   * @returns Cheia sub care a fost stocat fișierul
   */
  async uploadFile(transferId: string, file: File): Promise<string> {
    try {
      const key = `uploads/${transferId}/${file.name}`;
      const arrayBuffer = await file.arrayBuffer();
      let buffer = Buffer.from(arrayBuffer);
      let isEncrypted = false;

      // Pentru fișiere mari, folosim o abordare optimizată
      const isLargeFile = file.size > 5 * 1024 * 1024; // Fișiere peste 5MB

      console.log(`Încărcare fișier ${file.name}: useEncryption=${this.useEncryption}, isReady=${EncryptionService.isReady()}`);

      // Verificarea explicită a stării serviciului de criptare
      if (this.useEncryption) {
        if (!EncryptionService.isReady()) {
          console.log(`Reîncercare inițializare serviciu de criptare pentru ${file.name}...`);
          
          // Încercăm să inițializăm serviciul cu cheile din variabilele de mediu
          const encryptionKey = process.env.ENCRYPTION_MASTER_KEY || undefined;
          const encryptionSalt = process.env.ENCRYPTION_SALT || undefined;
          const initialized = EncryptionService.initialize(encryptionKey, encryptionSalt);
          
          console.log(`Rezultat reinițializare: ${initialized}, isReady=${EncryptionService.isReady()}`);
        }
        
        // Verificăm din nou după încercarea de inițializare
        if (EncryptionService.isReady()) {
          try {
            console.log(`Criptare fișier ${file.name} pentru transferul ${transferId}`);
            
            // Criptare unificată pentru toate dimensiunile de fișiere
            const encryptedBuffer = EncryptionService.encryptBuffer(buffer, transferId);
            buffer = Buffer.from(encryptedBuffer); // Conversie pentru a rezolva problema de tipuri
            isEncrypted = true;
            
            console.log(`Fișier ${file.name} criptat cu succes (${buffer.length} bytes)`);
          } catch (encryptError) {
            console.error(`Eroare la criptarea fișierului ${file.name}:`, encryptError);
            // Continuăm cu buffer-ul original necriptat în caz de eroare
          }
        } else {
          console.warn(`Serviciul de criptare nu este disponibil pentru fișierul ${file.name}. Se va încărca necriptat.`);
        }
      } else {
        console.log(`Fișierul ${file.name} NU va fi criptat. Criptarea este dezactivată.`);
      }

      // Adăugăm informații detaliate în metadate
      const metadata: Record<string, string> = {
        'encrypted': isEncrypted ? 'true' : 'false',
        'original-size': file.size.toString(),
        'content-type': file.type || 'application/octet-stream'
      };
      
      // Log detaliat înainte de încărcare
      console.log(`Încărcare în R2: ${key}, dimensiune=${buffer.length} bytes, criptat=${isEncrypted}`);

      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentLength: buffer.length,
        ContentType: file.type,
        Metadata: metadata
      });

      await this.client.send(command);
      console.log(`Fișier ${file.name} încărcat cu succes în R2`);
      
      return key;
    } catch (error) {
      console.error(`Eroare la încărcarea fișierului în R2: ${file.name}`, error);
      throw error;
    }
  }

  /**
   * Încarcă mai multe fișiere în paralel, optimizat pentru performanță
   * @param transferId ID-ul transferului
   * @param files Array de fișiere pentru încărcare
   * @param concurrency Numărul maxim de încărcări paralele
   * @returns Array de obiecte cu rezultatele încărcării
   */
  async uploadFilesParallel(
    transferId: string,
    files: File[],
    concurrency: number = 4
  ): Promise<Array<{ name: string, key: string, size: number, success: boolean, error?: string }>> {
    // Preîncărcăm cheia de criptare pentru acest transfer pentru a evita calculul repetat
    if (this.useEncryption && EncryptionService.isReady()) {
      try {
        EncryptionService.preloadKey(transferId);
      } catch (error) {
        console.warn('Nu s-a putut preîncărca cheia de criptare:', error);
      }
    }

    // Împărțim fișierele în loturi pentru a limita numărul de cereri paralele
    const results: Array<{ name: string, key: string, size: number, success: boolean, error?: string }> = [];
    const batches: File[][] = [];
    
    // Grupăm fișierele în loturi
    for (let i = 0; i < files.length; i += concurrency) {
      batches.push(files.slice(i, i + concurrency));
    }
    
    // Procesăm loturile pe rând, dar în paralel în cadrul fiecărui lot
    for (const batch of batches) {
      const batchPromises = batch.map(async (file) => {
        try {
          const key = await this.uploadFile(transferId, file);
          return {
            name: file.name,
            key,
            size: file.size,
            success: true
          };
        } catch (error) {
          return {
            name: file.name,
            key: '',
            size: file.size,
            success: false,
            error: error instanceof Error ? error.message : String(error)
          };
        }
      });
      
      // Așteptăm să se proceseze toate fișierele din acest lot
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    
    return results;
  }

  /**
   * Încarcă mai multe fișiere în paralel complet (fără limite de lot)
   * Atenție: Folosiți această metodă doar când aveți puține fișiere și aveți conexiuni stabile
   * @param transferId ID-ul transferului
   * @param files Array de fișiere pentru încărcare
   * @returns Array de obiecte cu rezultatele încărcării
   */
  async uploadFilesParallelUnlimited(
    transferId: string,
    files: File[]
  ): Promise<Array<{ name: string, key: string, size: number, success: boolean, error?: string }>> {
    // Preîncărcăm cheia de criptare pentru performanță
    if (this.useEncryption && EncryptionService.isReady()) {
      EncryptionService.preloadKey(transferId);
    }
    
    // Lansăm toate încărcările în paralel
    const uploadPromises = files.map(async (file) => {
      try {
        const key = await this.uploadFile(transferId, file);
        return {
          name: file.name,
          key,
          size: file.size,
          success: true
        };
      } catch (error) {
        return {
          name: file.name,
          key: '',
          size: file.size,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    });
    
    // Așteptăm ca toate încărcările să fie finalizate
    return Promise.all(uploadPromises);
  }

  /**
   * Încarcă un stream direct în R2
   * @param stream Stream-ul de date pentru încărcare
   * @param key Cheia sub care va fi stocat în R2
   * @param contentLength Dimensiunea totală a conținutului în bytes
   * @param transferId ID-ul transferului (pentru criptare)
   */
  async uploadStream(
    stream: Readable | PassThrough, 
    key: string, 
    contentLength: number,
    transferId?: string
  ): Promise<void> {
    try {
      // console.log(`Începere încărcare stream în R2: ${key} (${contentLength} bytes)`);
      
      // Dacă avem ID de transfer și criptarea este activată, aplicăm transform de criptare
      if (this.useEncryption && transferId && EncryptionService.isReady()) {
        try {
          const encryptStream = EncryptionService.createEncryptStream(transferId);
          
          // Creăm un stream nou pentru a primi datele criptate
          const encryptedStream = new PassThrough();
          
          // Adăugăm handler pentru erori pe stream-ul original
          stream.on('error', (err) => {
            console.error(`Eroare în stream-ul original de încărcare pentru ${key}:`, err);
            encryptedStream.destroy(err);
          });
          
          // Adăugăm handler pentru erori pe stream-ul de criptare
          encryptStream.on('error', (err) => {
            console.error(`Eroare în stream-ul de criptare pentru ${key}:`, err);
            encryptedStream.destroy(err);
          });
          
          // Pipeline: stream original -> encryptStream -> encryptedStream
          streamPipeline(stream, encryptStream, encryptedStream).catch((err: Error) => {
            // console.error(`Eroare în pipeline de criptare pentru ${key}:`, err);
            encryptedStream.destroy(err);
          });
          
          // Folosim stream-ul criptat pentru încărcare
          stream = encryptedStream;
          
          // console.log(`Stream criptat pentru transfer: ${transferId}, cheie: ${key}`);
        } catch (error) {
          console.error(`Eroare la configurarea criptării pentru ${key}:`, error);
          throw error;
        }
      }
      
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: stream,
        // Nu mai setăm ContentLength explicit pentru stream-urile criptate
        ...((!this.useEncryption || !transferId) && { ContentLength: contentLength }),
        Metadata: {
          'encrypted': (this.useEncryption && transferId) ? 'true' : 'false'
        }
      });

      await this.client.send(command);
      // console.log(`Stream încărcat cu succes în R2: ${key}`);
    } catch (error) {
      console.error(`Eroare la încărcarea stream-ului în R2: ${key}`, error);
      throw error;
    }
  }

  /**
   * Descarcă un fișier din R2 cu streaming direct
   * @param transferId ID-ul transferului
   * @param fileName Numele fișierului
   * @returns Stream-ul Readable pentru download
   */
  async downloadFileInChunks(
    transferId: string, 
    fileName: string
  ): Promise<Readable> {
    try {
      const key = `uploads/${transferId}/${fileName}`;
      // console.log(`Începere descărcare stream pentru fișierul: ${key}`);
      
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.client.send(command);
      
      if (!response.Body) {
        throw new Error(`Nu s-a putut obține conținutul pentru: ${key}`);
      }

      const stream = response.Body as Readable;
      
      // Verificăm dacă fișierul este criptat
      const isEncrypted = response.Metadata?.['encrypted'] === 'true' || this.useEncryption;
      // console.log(`Fișier ${fileName} este criptat: ${isEncrypted}`);
      
      // Dacă fișierul este criptat și criptarea este activată, aplicăm decriptare
      if (isEncrypted && EncryptionService.isReady()) {
        // console.log(`Decriptare stream pentru fișierul: ${fileName} (transferId: ${transferId})`);
        
        try {
          const decryptStream = EncryptionService.createDecryptStream(transferId);
          const finalStream = new PassThrough();
          
          // Adăugăm handler pentru erori pe stream-ul original pentru a evita crash-ul aplicației
          stream.on('error', (err) => {
            console.error(`Eroare în stream-ul de descărcare pentru ${fileName}:`, err);
            finalStream.destroy(err);
          });
          
          // Adăugăm handler pentru erori pe stream-ul de decriptare
          decryptStream.on('error', (err) => {
            console.error(`Eroare în stream-ul de decriptare pentru ${fileName}:`, err);
            finalStream.destroy(err);
          });
          
          // Pipeline: stream original -> decryptStream -> finalStream
          streamPipeline(stream, decryptStream, finalStream).catch((err: Error) => {
            console.error(`Eroare în pipeline de decriptare pentru ${fileName}:`, err);
            finalStream.destroy(err);
          });
          
          return finalStream;
        } catch (error) {
          console.error(`Eroare la configurarea decriptării pentru ${fileName}:`, error);
          throw error;
        }
      }
      
      // Dacă nu este criptat sau criptarea este dezactivată, returnăm stream-ul original
      return stream;
    } catch (error) {
      console.error(`Eroare la descărcarea fișierului din R2: ${fileName}`, error);
      throw error;
    }
  }

  /**
   * Descarcă un fișier din R2 cu suport pentru resume
   * @param transferId ID-ul transferului
   * @param fileName Numele fișierului
   * @param startByte Poziția de start pentru download (pentru resume)
   * @param endByte Poziția de sfârșit pentru download (opțional)
   * @returns Stream-ul pentru download
   */
  async downloadFileResumable(
    transferId: string,
    fileName: string,
    startByte: number,
    endByte?: number
  ): Promise<Readable> {
    try {
      const key = `uploads/${transferId}/${fileName}`;
      const range = endByte 
        ? `bytes=${startByte}-${endByte}`
        : `bytes=${startByte}-`;

      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Range: range
      });

      const response = await this.client.send(command);
      
      if (!response.Body) {
        throw new Error(`Nu s-a putut obține conținutul pentru: ${key}`);
      }

      const stream = response.Body as Readable;
      
      // NOTĂ: Decriptarea parțială nu este implementată în versiunea curentă
      // Fișierele criptate nu pot fi descărcate cu resume
      const isEncrypted = response.Metadata?.['encrypted'] === 'true' || this.useEncryption;
      
      if (isEncrypted) {
        console.warn(`Descărcarea parțială pentru fișierele criptate nu este suportată: ${fileName}`);
      }
      
      return stream;
    } catch (error) {
      console.error(`Eroare la descărcarea fișierului din R2: ${fileName}`, error);
      throw error;
    }
  }

  /**
   * Descarcă mai multe fișiere în paralel
   * @param transferId ID-ul transferului
   * @param fileNames Lista de nume de fișiere
   * @param maxConcurrent Numărul maxim de download-uri simultane
   * @returns Map cu numele fișierului și stream-ul corespunzător
   */
  async downloadFilesParallel(
    transferId: string,
    fileNames: string[],
    maxConcurrent: number = 3
  ): Promise<Map<string, Readable>> {
    const results = new Map<string, Readable>();
    const chunks = [];

    // Împărțim lista de fișiere în chunks pentru procesare paralelă
    for (let i = 0; i < fileNames.length; i += maxConcurrent) {
      chunks.push(fileNames.slice(i, i + maxConcurrent));
    }

    // Procesăm fiecare chunk în paralel
    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async (fileName) => {
        const stream = await this.downloadFileInChunks(transferId, fileName);
        results.set(fileName, stream);
      });

      await Promise.all(chunkPromises);
    }

    return results;
  }

  /**
   * Obține informații despre un fișier (dimensiune, etc.)
   * @param transferId ID-ul transferului
   * @param fileName Numele fișierului
   * @returns Informații despre fișier
   */
  async getFileInfo(transferId: string, fileName: string): Promise<{ size: number; lastModified: Date }> {
    try {
      const key = `uploads/${transferId}/${fileName}`;
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key
      });

      const response = await this.client.send(command);
      
      return {
        size: response.ContentLength || 0,
        lastModified: response.LastModified || new Date()
      };
    } catch (error) {
      console.error(`Eroare la obținerea informațiilor despre fișier: ${fileName}`, error);
      throw error;
    }
  }

  /**
   * Modificăm metoda existentă downloadFile pentru a folosi noile funcționalități
   * @param transferId ID-ul transferului
   * @param fileName Numele fișierului
   * @returns Blob-ul cu conținutul fișierului
   */
  async downloadFile(transferId: string, fileName: string): Promise<Readable> {
    try {
      // Returnăm direct stream-ul, fără buffering
      return await this.downloadFileInChunks(transferId, fileName);
    } catch (error) {
      console.error(`Eroare la descărcarea fișierului din R2: ${fileName}`, error);
      throw error;
    }
  }

  /**
   * Șterge un fișier din R2
   * @param transferId ID-ul transferului
   * @param fileName Numele fișierului
   */
  async deleteFile(transferId: string, fileName: string): Promise<void> {
    try {
      const key = `uploads/${transferId}/${fileName}`;
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.client.send(command);
    } catch (error) {
      console.error(`Eroare la ștergerea fișierului ${fileName} din transferul ${transferId}:`, error);
      throw error;
    }
  }

  /**
   * Șterge un obiect din R2 folosind cheia directă
   * @param key Cheia fișierului în R2
   * @private Metodă privată pentru uz intern
   */
  private async deleteObjectByKey(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.client.send(command);
    } catch (error) {
      console.error(`Eroare la ștergerea obiectului din R2: ${key}`, error);
      throw error;
    }
  }

  /**
   * Verifică dacă un fișier există în R2
   * @param key Cheia fișierului în R2
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.client.send(command);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generează un URL temporar pentru descărcarea fișierului
   * @param key Cheia fișierului în R2
   * @param expiresIn Durata de valabilitate a URL-ului în secunde (implicit 3600 = 1 oră)
   */
  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const url = await getSignedUrl(this.client, command, { expiresIn });
      return url;
    } catch (error) {
      console.error(`Eroare la generarea URL-ului semnat pentru: ${key}`, error);
      throw error;
    }
  }

  /**
   * Generează un URL temporar pentru descărcarea fișierului cu un nume personalizat
   * @param key Cheia fișierului în R2
   * @param filename Numele fișierului care va apărea la descărcare
   * @param expiresIn Durata de valabilitate a URL-ului în secunde (implicit 3600 = 1 oră)
   */
  async getSignedUrlWithCustomFilename(key: string, filename: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentDisposition: `attachment; filename="${encodeURIComponent(filename)}"`
      });

      const url = await getSignedUrl(this.client, command, { expiresIn });
      return url;
    } catch (error) {
      console.error(`Eroare la generarea URL-ului semnat cu nume personalizat pentru: ${key}`, error);
      throw error;
    }
  }

  /**
   * Returnează URL-ul public al unui fișier (dacă este configurat un domeniu public)
   * @param key Cheia fișierului în R2
   */
  getPublicUrl(key: string): string | null {
    if (!this.publicUrl) {
      return null;
    }
    return `${this.publicUrl}/${key}`;
  }

  /**
   * Listează fișierele dintr-un transfer
   * @param transferId ID-ul transferului
   * @returns Lista de fișiere
   */
  async listFiles(transferId: string): Promise<R2File[]> {
    try {
      const prefix = `uploads/${transferId}/`;
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
      });

      const response = await this.client.send(command);
      
      if (!response.Contents) {
        return [];
      }

      return response.Contents.map(item => ({
        name: item.Key?.replace(prefix, '') || '',
        size: item.Size || 0,
        lastModified: item.LastModified,
        etag: item.ETag || ''
      }));
    } catch (error) {
      console.error(`Eroare la listarea fișierelor pentru transferul ${transferId}:`, error);
      throw error;
    }
  }

  /**
   * Creează o arhivă din fișierele încărcate în R2
   */
  async createArchive(transferId: string): Promise<string> {
    try {
      console.log(`Inițiere creare arhivă pentru transferul ${transferId}`);
      
      // Verificăm dacă există fișiere pentru acest transfer
      const files = await this.listFiles(transferId);
      if (files.length === 0) {
        throw new Error('Nu există fișiere pentru a crea arhiva');
      }

      // Creăm arhiva în același bucket
      const archiveKey = `archives/${transferId}.zip`;

      // Creăm arhiva folosind JSZip
      const zip = new JSZip();
      
      // Procesăm fișierele în paralel, limitând numărul de fișiere procesate simultan
      console.log(`Începere procesare ${files.length} fișiere pentru arhivă`);
      
      // Reducem numărul de fișiere procesate simultan pentru a evita epuizarea memoriei
      const chunkSize = 2; // Reducem și mai mult pentru a preveni memory pressure
      let procesate = 0;
      let erori = 0;
      
      // Sortăm fișierele după dimensiune - procesăm mai întâi fișierele mici
      const sortedFiles = [...files].sort((a, b) => a.size - b.size);
      
      for (let i = 0; i < sortedFiles.length; i += chunkSize) {
        const chunk = sortedFiles.slice(i, i + chunkSize);
        
        // Adăugăm un delay mic între loturi pentru a permite eliberarea memoriei
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        await Promise.all(chunk.map(async (file) => {
          try {
            // Obținem stream-ul pentru fișier (posibil criptat)
            const fileStream = await this.getFile(transferId, file.name);
            
            // Convertim stream-ul în Buffer, cu tratare specială pentru fișiere mari
            console.log(`Începere citire: ${file.name} (${Math.round(file.size/1024/1024)}MB)`);
            
            const chunks: Uint8Array[] = [];
            let totalBytes = 0;
            
            for await (const chunk of fileStream) {
              chunks.push(chunk);
              totalBytes += chunk.length;
              
              // Raportăm progresul pentru fișierele mari
              if (file.size > 30 * 1024 * 1024 && chunks.length % 10 === 0) {
                console.log(`Progres citire ${file.name}: ${Math.round(totalBytes / file.size * 100)}% (${totalBytes}/${file.size} bytes)`);
              }
            }
            
            // Verificăm dacă am citit tot fișierul
            if (totalBytes < file.size) {
              console.warn(`Posibilă citire incompletă pentru ${file.name}: ${totalBytes}/${file.size} bytes`);
            }
            
            console.log(`Finalizare citire: ${file.name} - ${totalBytes} bytes citite`);
            const fileData = Buffer.concat(chunks);
            
            // Adăugăm fișierul la arhivă FĂRĂ compresie (store)
            zip.file(file.name, fileData, {
              compression: "STORE" // Dezactivăm complet compresia pentru toate fișierele
            });
            
            procesate++;
            console.log(`Fișier adăugat la arhivă (${procesate}/${sortedFiles.length}): ${file.name} (${Math.round(fileData.length/1024)}KB)`);
          } catch (error) {
            erori++;
            console.error(`Eroare la procesarea fișierului ${file.name} pentru arhivă:`, error);
            // Continuăm cu celelalte fișiere chiar dacă unul eșuează
          }
        }));
      }

      if (procesate === 0) {
        throw new Error('Nu s-a putut adăuga niciun fișier la arhivă');
      }

      console.log(`Generare arhivă finală cu ${procesate} fișiere (${erori} erori)...`);
      
      // Generăm arhiva fără compresie pentru viteză și pentru a evita probleme de memorie
      const archiveData = await zip.generateAsync({ 
        type: 'nodebuffer',
        compression: "STORE",  // Dezactivăm complet compresia pentru întreaga arhivă
      });

      console.log(`Arhivă generată: ${Math.round(archiveData.length/1024/1024)}MB - Încărcare în R2...`);

      // Încărcăm arhiva în R2 (nu criptăm arhiva, doar conținutul individual)
      await this.client.send(new PutObjectCommand({
        Bucket: this.bucket,
        Key: archiveKey,
        Body: archiveData,
        ContentType: 'application/zip',
        ContentLength: archiveData.length,
        Metadata: {
          'encrypted': 'false', // Arhiva nu este criptată, conținutul individual poate fi
          'fileCount': procesate.toString(),
          'totalOriginal': sortedFiles.length.toString(),
          'errors': erori.toString()
        }
      }));

      console.log(`Arhivă creată cu succes pentru transferul ${transferId} (${archiveData.length} bytes, ${procesate}/${sortedFiles.length} fișiere)`);
      return archiveKey;
    } catch (error) {
      console.error(`Eroare la crearea arhivei: ${error}`);
      throw error;
    }
  }

  /**
   * Obține lista de obiecte dintr-un prefix din R2
   * @param prefix Prefixul pentru listare (ex: "temp/transferId/")
   * @returns Array de obiecte din R2
   */
  async listObjects(prefix: string): Promise<R2File[]> {
    try {
      // console.log(`Listare obiecte cu prefixul: ${prefix}`);
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        MaxKeys: 1000
      });
      
      const response = await this.client.send(command);
      
      if (!response.Contents || response.Contents.length === 0) {
        return [];
      }
      
      return response.Contents.map(item => ({
        name: item.Key || '',
        size: item.Size || 0,
        lastModified: item.LastModified,
        etag: item.ETag || ''
      }));
    } catch (error) {
      console.error(`Eroare la listarea obiectelor din R2 cu prefixul ${prefix}:`, error);
      throw error;
    }
  }

  /**
   * Încarcă un obiect în R2
   */
  async uploadObject(key: string, data: Buffer | Uint8Array, contentType: string = 'application/octet-stream'): Promise<void> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: contentType
      });

      await this.client.send(command);
    } catch (error) {
      console.error(`Error uploading object ${key}:`, error);
      throw error;
    }
  }

  /**
   * Încarcă un buffer în R2 și returnează cheia
   * @param key Cheia unde va fi stocat obiectul
   * @param buffer Buffer-ul pentru încărcare
   * @param contentType Tipul de conținut (opțional)
   * @returns Cheia unde a fost stocat obiectul
   */
  async uploadBuffer(key: string, buffer: Buffer, contentType: string = 'application/octet-stream'): Promise<string> {
    try {
      const metadata: Record<string, string> = {
        'encrypted': 'true',
        'original-size': buffer.length.toString()
      };

      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentLength: buffer.length,
        ContentType: contentType,
        Metadata: metadata
      });

      await this.client.send(command);
      return key;
    } catch (error) {
      console.error(`Eroare la încărcarea buffer-ului în R2: ${key}`, error);
      throw error;
    }
  }

  /**
   * Inițiază o încărcare multipart pentru fișierele mari
   * @param key Cheia unde va fi stocat obiectul
   * @returns ID-ul încărcării multipart
   */
  async initMultipartUpload(key: string): Promise<string> {
    try {
      const command = new CreateMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        Metadata: {
          'encrypted': 'true'
        }
      });

      const response = await this.client.send(command);
      if (!response.UploadId) {
        throw new Error('Nu s-a putut inițializa încărcarea multipart');
      }
      return response.UploadId;
    } catch (error) {
      console.error(`Eroare la inițierea încărcării multipart pentru ${key}:`, error);
      throw error;
    }
  }

  /**
   * Încarcă o parte a unui fișier în cadrul unei încărcări multipart
   * @param key Cheia obiectului
   * @param uploadId ID-ul încărcării multipart
   * @param partNumber Numărul părții (indexat de la 1)
   * @param buffer Datele de încărcat
   * @returns ETag-ul părții încărcate
   */
  async uploadPart(key: string, uploadId: string, partNumber: number, buffer: Buffer): Promise<string> {
    try {
      const command = new UploadPartCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
        Body: buffer
      });

      const response = await this.client.send(command);
      if (!response.ETag) {
        throw new Error(`Nu s-a putut încărca partea ${partNumber}`);
      }
      return response.ETag;
    } catch (error) {
      console.error(`Eroare la încărcarea părții ${partNumber} pentru ${key}:`, error);
      throw error;
    }
  }

  /**
   * Finalizează o încărcare multipart
   * @param key Cheia obiectului
   * @param uploadId ID-ul încărcării multipart
   * @param parts Lista de părți încărcate cu ETag-urile lor
   * @returns Cheia obiectului finalizat
   */
  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: { PartNumber: number; ETag: string }[]
  ): Promise<string> {
    try {
      // Sortăm părțile după număr pentru a ne asigura că sunt în ordine
      const sortedParts = [...parts].sort((a, b) => a.PartNumber - b.PartNumber);
      
      const command = new CompleteMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: sortedParts
        }
      });

      const response = await this.client.send(command);
      if (!response.Key) {
        throw new Error('Nu s-a putut finaliza încărcarea multipart');
      }
      return response.Key;
    } catch (error) {
      console.error(`Eroare la finalizarea încărcării multipart pentru ${key}:`, error);
      
      // Încercăm să anulăm încărcarea multipart pentru a elibera resursele
      try {
        await this.abortMultipartUpload(key, uploadId);
      } catch (abortError) {
        console.error(`Nu s-a putut anula încărcarea multipart pentru ${key}:`, abortError);
      }
      
      throw error;
    }
  }

  /**
   * Anulează o încărcare multipart în curs
   * @param key Cheia obiectului
   * @param uploadId ID-ul încărcării multipart
   */
  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    try {
      const command = new AbortMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId
      });

      await this.client.send(command);
      console.log(`Încărcarea multipart pentru ${key} a fost anulată cu succes`);
    } catch (error) {
      console.error(`Eroare la anularea încărcării multipart pentru ${key}:`, error);
      throw error;
    }
  }

  /**
   * Obține conținutul unui fișier din R2 ca stream
   * @param transferId ID-ul transferului
   * @param fileName Numele fișierului
   * @returns Stream-ul Readable pentru fișier
   */
  async getFile(transferId: string, fileName: string): Promise<Readable> {
    try {
      const stream = await this.downloadFileInChunks(transferId, fileName);
      
      // Optimizare: Creăm un stream intermediar cu configurație specială pentru compatibilitate cu archiver
      const passThrough = new PassThrough({
        // Setăm buffer mare pentru performanță
        highWaterMark: 1024 * 1024, // 1MB
        // Setări pentru a evita ERR_STREAM_PREMATURE_CLOSE
        allowHalfOpen: true,
        emitClose: false // Nu emitem evenimentul 'close' care poate cauza probleme
      });
      
      // Monitorizăm evenimentele de pe stream-ul original
      let bytesReceived = 0;
      
      // Configurăm gestionarea streams pentru prevenirea erorilor ERR_STREAM_PREMATURE_CLOSE
      stream.pipe(passThrough, { end: false }); // Nu propagăm end event automat
      
      // Adăugăm handler pentru date, pentru a monitoriza fluxul de date
      stream.on('data', (chunk) => {
        bytesReceived += chunk.length;
      });
      
      // Adăugăm handler pentru erori pe stream-ul original
      stream.on('error', (err) => {
        console.error(`Eroare în stream-ul original pentru ${fileName}:`, err);
        // Nu distrugem passThrough imediat pentru a permite continuarea arhivării
        setTimeout(() => {
          try {
            passThrough.end();
          } catch (e) {
            console.error(`Eroare secundară la închiderea stream-ului PassThrough pentru ${fileName}:`, e);
          }
        }, 100);
      });
      
      // Adăugăm handler pentru end pe stream-ul original
      stream.on('end', () => {
        console.log(`Stream-ul pentru ${fileName} s-a încheiat normal: ${bytesReceived} bytes transferați`);
        
        // Asigurăm un delay mic înainte de a închide passThrough
        setTimeout(() => {
          try {
            passThrough.end();
            console.log(`Stream-ul PassThrough pentru ${fileName} a fost închis cu succes`);
          } catch (e) {
            console.error(`Eroare la închiderea normală a stream-ului PassThrough pentru ${fileName}:`, e);
          }
        }, 200);
      });
      
      // Adăugăm metode pentru a facilita închiderea forțată a stream-urilor din exterior
      const originalDestroy = passThrough.destroy.bind(passThrough);
      
      // Suprascriem metoda destroy pentru a închide și stream-ul original
      passThrough.destroy = function(error?: Error) {
        try {
          // Încercăm să închidem stream-ul original
          stream.destroy(error);
        } catch (e) {
          console.error(`Eroare la distrugerea stream-ului original pentru ${fileName}:`, e);
        }
        
        // Apelăm metoda originală destroy
        return originalDestroy(error);
      };
      
      console.log(`Stream pregătit pentru fișierul: ${fileName}`);
      return passThrough;
    } catch (error) {
      console.error(`Eroare la obținerea fișierului ${fileName}:`, error);
      throw error;
    }
  }

  /**
   * Șterge toate fișierele asociate unui transfer din R2
   * @param transferId ID-ul transferului
   * @returns Numărul de fișiere șterse
   */
  async deleteTransferFiles(transferId: string): Promise<number> {
    // Folosim varianta cu paralelizare controlată (implicit 10 cereri simultane)
    return this.deleteTransferFilesParallel(transferId, 10);
  }

  /**
   * Șterge toate fișierele asociate unui transfer din R2 cu paralelizare controlată
   * @param transferId ID-ul transferului
   * @param concurrency Numărul maxim de operații de ștergere paralele
   * @returns Numărul de fișiere șterse
   */
  async deleteTransferFilesParallel(transferId: string, concurrency: number = 10): Promise<number> {
    try {
      // 1. Listăm toate fișierele din directorul transferului
      const uploadPrefix = `uploads/${transferId}/`;
      const uploadedFiles = await this.listObjects(uploadPrefix);
      
      if (uploadedFiles.length === 0) {
        console.log(`Nu există fișiere de șters pentru transferul ${transferId}`);
      }
      
      // 2. Verificăm dacă există arhivă asociată
      const archiveKey = `archives/${transferId}.zip`;
      const archiveExists = await this.fileExists(archiveKey);
      
      // 3. Adăugăm arhiva la lista de fișiere de șters dacă există
      const allKeys = uploadedFiles.map(file => file.name);
      if (archiveExists) {
        allKeys.push(archiveKey);
      }
      
      console.log(`Se șterg ${allKeys.length} fișiere pentru transferul ${transferId} cu concurență ${concurrency}`);
      
      if (allKeys.length === 0) {
        return 0;
      }
      
      // 4. Împărțim lista de fișiere în loturi pentru a controla concurența
      const batches: string[][] = [];
      for (let i = 0; i < allKeys.length; i += concurrency) {
        batches.push(allKeys.slice(i, i + concurrency));
      }
      
      let successCount = 0;
      let failCount = 0;
      
      // 5. Procesăm loturile de fișiere secvențial, dar cu operații paralele în fiecare lot
      for (const batch of batches) {
        const batchPromises = batch.map(async (key) => {
          try {
            await this.deleteObjectByKey(key);
            return true;
          } catch (error) {
            console.error(`Eroare la ștergerea obiectului ${key}:`, error);
            return false;
          }
        });
        
        // Așteptăm finalizarea tuturor ștergerilor din acest lot înainte de a trece la următorul
        const results = await Promise.all(batchPromises);
        
        // Actualizăm contoarele
        successCount += results.filter(Boolean).length;
        failCount += results.filter(result => !result).length;
        
        // Adăugăm un mic delay între loturi pentru a permite eliberarea resurselor
        if (batches.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      console.log(`S-au șters ${successCount} fișiere pentru transferul ${transferId} (${failCount} erori)`);
      return successCount;
    } catch (error) {
      console.error(`Eroare la ștergerea fișierelor pentru transferul ${transferId}:`, error);
      throw error;
    }
  }

  /**
   * Șterge toate fișierele asociate unui transfer din R2 folosind paralelizare completă
   * @param transferId ID-ul transferului
   * @returns Numărul de fișiere șterse
   */
  async deleteTransferFilesUnlimited(transferId: string): Promise<number> {
    try {
      // 1. Listăm toate fișierele din directorul transferului
      const uploadPrefix = `uploads/${transferId}/`;
      const uploadedFiles = await this.listObjects(uploadPrefix);
      
      // 2. Verificăm dacă există arhivă asociată
      const archiveKey = `archives/${transferId}.zip`;
      const archiveExists = await this.fileExists(archiveKey);
      
      // 3. Adăugăm arhiva la lista de fișiere de șters dacă există
      const allKeys = uploadedFiles.map(file => file.name);
      if (archiveExists) {
        allKeys.push(archiveKey);
      }
      
      // 4. Lansăm toate operațiile de ștergere în paralel
      const deletePromises = allKeys.map(async (key) => {
        try {
          await this.deleteObjectByKey(key);
          return true;
        } catch (error) {
          console.error(`Eroare la ștergerea obiectului ${key}:`, error);
          return false;
        }
      });
      
      // 5. Așteptăm finalizarea tuturor ștergerilor
      const results = await Promise.all(deletePromises);
      const deletedCount = results.filter(Boolean).length;
      
      console.log(`S-au șters ${deletedCount} fișiere pentru transferul ${transferId} (mod nelimitat)`);
      return deletedCount;
    } catch (error) {
      console.error(`Eroare la ștergerea fișierelor pentru transferul ${transferId} (mod nelimitat):`, error);
      throw error;
    }
  }

  /**
   * Creează un fișier gol în storage (util pentru testare)
   * @param key Calea completă unde va fi creat fișierul
   * @returns True dacă fișierul a fost creat cu succes
   */
  async createEmptyFile(key: string): Promise<boolean> {
    try {
      const emptyBuffer = Buffer.from('');
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: emptyBuffer,
        ContentLength: 0,
        ContentType: 'text/plain'
      });

      await this.client.send(command);
      console.log(`Fișier gol creat cu succes: ${key}`);
      return true;
    } catch (error) {
      console.error(`Eroare la crearea fișierului gol: ${key}`, error);
      throw error;
    }
  }

  /**
   * Descarcă o arhivă cu optimizări speciale pentru streaming
   * @param transferId ID-ul transferului 
   * @param archiveKey Cheia la care este stocată arhiva
   * @returns Stream Readable optimizat pentru arhive mari
   */
  async downloadArchive(transferId: string, archiveKey: string): Promise<Readable> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: archiveKey,
        // Adăugăm headere specifice pentru binare
        ResponseContentType: 'application/zip',
        ResponseContentDisposition: `attachment; filename="${archiveKey.split('/').pop()}"`
      });

      const response = await this.client.send(command);
      
      if (!response.Body) {
        throw new Error(`Nu s-a putut obține arhiva: ${archiveKey}`);
      }

      const stream = response.Body as Readable;
      
      // Optimizare: Creăm un stream intermediar pentru a preveni închiderea prematură a stream-ului original
      const passThrough = new PassThrough({
        // Configurăm buffer-ele pentru streaming rapid 
        highWaterMark: 8 * 1024 * 1024, // Creștem la 8MB buffer pentru performanță maximă
        allowHalfOpen: true,
        emitClose: false // Prevenim emiterea evenimentului 'close' care poate cauza probleme
      });
      
      // Configurăm gestionarea streams pentru prevenirea erorilor ERR_STREAM_PREMATURE_CLOSE
      stream.pipe(passThrough, { end: false }); // Nu propagăm end event automat
      
      // Adăugăm monitorizare pentru evenimente
      let bytesReceived = 0;
      const totalBytes = response.ContentLength || 0;
      
      stream.on('data', (chunk) => {
        bytesReceived += chunk.length;
        
        if (totalBytes > 0) {
          const percentage = Math.round((bytesReceived / totalBytes) * 100);
          if (percentage % 10 === 0 && percentage > 0) { // Log la fiecare 10%
            console.log(`Descărcare arhivă ${archiveKey}: ${percentage}% (${bytesReceived}/${totalBytes} bytes)`);
          }
        }
      });
      
      // Adăugăm handler pentru end pe stream-ul original
      stream.on('end', () => {
        console.log(`Stream-ul original pentru arhiva ${archiveKey} s-a terminat: ${bytesReceived} bytes transferați`);
        
        // Asigurăm un delay mai mare înainte de a închide passThrough
        setTimeout(() => {
          try {
            passThrough.end();
            console.log(`Stream-ul PassThrough pentru arhiva ${archiveKey} a fost închis cu succes`);
          } catch (e) {
            console.error(`Eroare la închiderea normală a stream-ului PassThrough pentru arhiva ${archiveKey}:`, e);
          }
        }, 500); // Creștem delay-ul la 500ms pentru a asigura transmisia completă a datelor
      });
      
      // Adăugăm handler pentru erori pe stream-ul original
      stream.on('error', (err) => {
        console.error(`Eroare în stream-ul original pentru arhiva ${archiveKey}:`, err);
        
        // Nu distrugem imediat - așteptăm mai mult pentru a permite continuarea transmisiei
        setTimeout(() => {
          try {
            passThrough.end();
            console.log(`Stream-ul PassThrough pentru arhiva ${archiveKey} a fost închis după eroare`);
          } catch (e) {
            console.error(`Eroare secundară la închiderea stream-ului PassThrough pentru arhiva ${archiveKey}:`, e);
          }
        }, 300); // Creștem la 300ms pentru mai multă siguranță
      });
      
      // Adăugăm eveniment pentru a detecta când PassThrough se închide prematur
      passThrough.on('error', (err) => {
        console.error(`Eroare în stream-ul PassThrough pentru arhiva ${archiveKey}:`, err);
      });
      
      // Adăugăm metode pentru a facilita închiderea forțată a stream-urilor din exterior
      const originalDestroy = passThrough.destroy.bind(passThrough);
      
      // Suprascriem metoda destroy pentru a închide și stream-ul original
      passThrough.destroy = function(error?: Error) {
        try {
          // Încercăm să închidem stream-ul original
          stream.destroy(error);
        } catch (e) {
          console.error(`Eroare la distrugerea stream-ului original pentru arhiva ${archiveKey}:`, e);
        }
        
        // Apelăm metoda originală destroy
        return originalDestroy(error);
      };
      
      console.log(`Stream pregătit pentru arhiva: ${archiveKey} (${totalBytes} bytes)`);
      return passThrough;
    } catch (error) {
      console.error(`Eroare la descărcarea arhivei ${archiveKey}:`, error);
      throw error;
    }
  }
}