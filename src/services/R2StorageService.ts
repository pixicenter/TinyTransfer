import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fs from 'fs';
import { Readable, PassThrough } from 'stream';
import { pipeline } from 'stream/promises';
import JSZip from 'jszip';
import { StorageProvider } from './StorageFactory';

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

  constructor() {
    // Verificăm dacă avem toate variabilele de mediu necesare
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucketName = process.env.R2_BUCKET_NAME;
    this.publicUrl = process.env.R2_PUBLIC_URL || null;

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      console.error('Eroare la inițializarea R2StorageService:');
      console.error(`- R2_ACCOUNT_ID: ${accountId ? 'prezent' : 'lipsește'}`);
      console.error(`- R2_ACCESS_KEY_ID: ${accessKeyId ? 'prezent' : 'lipsește'}`);
      console.error(`- R2_SECRET_ACCESS_KEY: ${secretAccessKey ? 'prezent' : 'lipsește'}`);
      console.error(`- R2_BUCKET_NAME: ${bucketName ? 'prezent' : 'lipsește'}`);
      throw new Error('Lipsesc credențialele R2 necesare. Verificați variabilele de mediu.');
    }

    // console.log(`Inițializare client S3 pentru R2 cu bucket: ${this.bucket}`);
    // console.log(`Endpoint R2: https://${accountId}.r2.cloudflarestorage.com`);

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
      const buffer = Buffer.from(arrayBuffer);

      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentLength: buffer.length,
        ContentType: file.type
      });

      await this.client.send(command);
      console.log(`Fișier încărcat cu succes în R2: ${key}`);
      return key;
    } catch (error) {
      console.error(`Eroare la încărcarea fișierului în R2: ${file.name}`, error);
      throw error;
    }
  }

  /**
   * Încarcă un stream direct în R2
   * @param stream Stream-ul de date pentru încărcare
   * @param key Cheia sub care va fi stocat în R2
   * @param contentLength Dimensiunea totală a conținutului în bytes
   */
  async uploadStream(stream: Readable | PassThrough, key: string, contentLength: number): Promise<void> {
    try {
      console.log(`Începere încărcare stream în R2: ${key} (${contentLength} bytes)`);
      
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: stream,
        ContentLength: contentLength,
      });

      await this.client.send(command);
      console.log(`Stream încărcat cu succes în R2: ${key}`);
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
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.client.send(command);
      
      if (!response.Body) {
        throw new Error(`Nu s-a putut obține conținutul pentru: ${key}`);
      }

      return response.Body as Readable;
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

      return response.Body as Readable;
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
      const chunkSize = 5; // Numărul de fișiere procesate simultan
      for (let i = 0; i < files.length; i += chunkSize) {
        const chunk = files.slice(i, i + chunkSize);
        await Promise.all(chunk.map(async (file) => {
          const fileStream = await this.getFile(transferId, file.name);
          
          // Convertim stream-ul în Buffer pentru JSZip
          const chunks: Uint8Array[] = [];
          for await (const chunk of fileStream) {
            chunks.push(chunk);
          }
          const fileData = Buffer.concat(chunks);
          
          zip.file(file.name, fileData);
        }));
      }

      // Generăm arhiva
      const archiveData = await zip.generateAsync({ type: 'nodebuffer' });

      // Încărcăm arhiva în R2
      await this.client.send(new PutObjectCommand({
        Bucket: this.bucket,
        Key: archiveKey,
        Body: archiveData,
        ContentType: 'application/zip',
      }));

      console.log(`Arhivă creată cu succes pentru transferul ${transferId}`);
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
      console.log(`Listare obiecte cu prefixul: ${prefix}`);
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
      console.log(`Încărcare obiect în R2: ${key} (${data.byteLength} bytes)`);
      
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentLength: data.byteLength,
        ContentType: contentType
      });

      await this.client.send(command);
      console.log(`Obiect încărcat cu succes în R2: ${key}`);
    } catch (error) {
      console.error(`Eroare la încărcarea obiectului în R2: ${key}`, error);
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
      const key = `uploads/${transferId}/${fileName}`;
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key
      });

      const response = await this.client.send(command);
      if (!response.Body) {
        throw new Error('Fișierul nu a fost găsit');
      }

      return response.Body as Readable;
    } catch (error) {
      console.error(`Eroare la obținerea fișierului ${fileName}: ${error}`);
      throw error;
    }
  }

  /**
   * Șterge toate fișierele asociate unui transfer din R2
   * @param transferId ID-ul transferului
   * @returns Numărul de fișiere șterse
   */
  async deleteTransferFiles(transferId: string): Promise<number> {
    try {
      console.log(`Ștergere fișiere pentru transferul: ${transferId}`);
      
      // 1. Listăm toate fișierele din directorul transferului
      const uploadPrefix = `uploads/${transferId}/`;
      const uploadedFiles = await this.listObjects(uploadPrefix);
      
      // 2. Verificăm dacă există arhivă asociată
      const archiveKey = `archives/${transferId}.zip`;
      const archiveExists = await this.fileExists(archiveKey);
      
      let deletedCount = 0;
      
      // 3. Ștergem toate fișierele încărcate
      for (const file of uploadedFiles) {
        // Folosim deleteObjectByKey pentru a șterge fișierele folosind calea completă
        const fileKey = file.name; // Name deja conține calea completă din listObjects
        await this.deleteObjectByKey(fileKey);
        deletedCount++;
        console.log(`Fișier șters: ${fileKey}`);
      }
      
      // 4. Ștergem arhiva dacă există
      if (archiveExists) {
        await this.deleteObjectByKey(archiveKey);
        deletedCount++;
        console.log(`Arhivă ștearsă: ${archiveKey}`);
      }
      
      console.log(`S-au șters ${deletedCount} fișiere pentru transferul ${transferId}`);
      return deletedCount;
    } catch (error) {
      console.error(`Eroare la ștergerea fișierelor pentru transferul ${transferId}:`, error);
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
}