import { EncryptionService } from './EncryptionService';

// Dimensiunea maximă pentru împărțirea fișierelor în bucăți (5MB)
const CHUNK_SIZE = 16 * 1024 * 1024;
const MAX_PARALLEL_CHUNKS = 6; // Numărul maxim de chunks încărcate simultan

// Interfață pentru progresul încărcării
export interface UploadProgress {
  file: string;
  bytesUploaded: number;
  totalBytes: number;
  percentage: number;
  isComplete: boolean;
}

// Interfață pentru rezultatul încărcării
export interface UploadResult {
  name: string;
  key: string;
  size: number;
  success: boolean;
  error?: string;
}

// Callback pentru actualizarea progresului
export type ProgressCallback = (progress: UploadProgress) => void;

/**
 * Serviciu pentru gestionarea încărcării fișierelor
 * Suportă criptare end-to-end și încărcare în bucăți pentru fișiere mari
 */
export class UploadService {
  private transferId: string;
  private onProgress?: ProgressCallback;
  private baseUrl: string;

  constructor(transferId: string, onProgress?: ProgressCallback) {
    try {
      console.log(`Inițializare UploadService pentru transferul: ${transferId}`);
      this.transferId = transferId;
      this.onProgress = onProgress;
      
      // URL-ul de bază pentru API-uri
      this.baseUrl = window.location.origin;
      
      console.log(`UploadService inițializat cu succes`);
    } catch (error) {
      console.error(`Eroare la inițializarea UploadService:`, error);
      throw new Error(`Nu s-a putut inițializa serviciul de upload: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Încarcă un singur fișier, împărțindu-l în bucăți dacă este necesar
   * @param file Fișierul pentru încărcare
   * @returns Promisiune rezolvată cu rezultatul încărcării
   */
  async uploadFile(file: File): Promise<UploadResult> {
    try {
      const fileName = file.name;
      const fileSize = file.size;
      
      // Inițializăm progresul
      this.updateProgress({
        file: fileName,
        bytesUploaded: 0,
        totalBytes: fileSize,
        percentage: 0,
        isComplete: false
      });

      // Verifică dacă fișierul este suficient de mare pentru încărcarea în bucăți
      if (fileSize > CHUNK_SIZE) {
        return await this.uploadLargeFile(file);
      } else {
        return await this.uploadStandardFile(file);
      }
    } catch (error: any) {
      console.error(`Eroare la încărcarea fișierului ${file.name}:`, error);
      return {
        name: file.name,
        key: '',
        size: file.size,
        success: false,
        error: error.message || 'Eroare necunoscută la încărcare'
      };
    }
  }

  /**
   * Încărcarea mai multor fișiere în paralel
   * @param files Array de fișiere pentru încărcare
   * @param concurrentUploads Numărul maxim de încărcări concurente
   * @returns Array cu rezultatele încărcării
   */
  async uploadFiles(files: File[], concurrentUploads = 5): Promise<UploadResult[]> {
    const results: UploadResult[] = [];
    let currentIndex = 0;

    // Funcție pentru procesarea următorului fișier
    const processNextFile = async (): Promise<UploadResult | null> => {
      const fileIndex = currentIndex++;
      if (fileIndex >= files.length) return null;

      const file = files[fileIndex];
      const result = await this.uploadFile(file);
      results.push(result);
      return result;
    };

    // Creăm un array de promisiuni pentru încărcările concurente
    const uploadPromises = [];
    for (let i = 0; i < Math.min(concurrentUploads, files.length); i++) {
      uploadPromises.push(
        (async () => {
          let result = await processNextFile();
          while (result !== null) {
            result = await processNextFile();
          }
        })()
      );
    }

    // Așteptăm finalizarea tuturor încărcărilor
    await Promise.all(uploadPromises);
    return results;
  }

  /**
   * Metoda privată pentru încărcarea unui fișier standard (mai mic de CHUNK_SIZE)
   * @param file Fișierul pentru încărcare
   * @returns Rezultatul încărcării
   */
  private async uploadStandardFile(file: File): Promise<UploadResult> {
    try {
      // Folosim ruta API pentru încărcare simplă
      const formData = new FormData();
      formData.append('file', file);
      formData.append('transferId', this.transferId);
      
      const response = await fetch(`${this.baseUrl}/api/upload`, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Eroare la încărcarea fișierului');
      }
      
      const result = await response.json();
      
      // Actualizăm progresul la 100%
      this.updateProgress({
        file: file.name,
        bytesUploaded: file.size,
        totalBytes: file.size,
        percentage: 100,
        isComplete: true
      });
      
      return {
        name: file.name,
        key: result.key,
        size: file.size,
        success: true
      };
    } catch (error: any) {
      console.error(`Eroare la încărcarea standard a fișierului ${file.name}:`, error);
      return {
        name: file.name,
        key: '',
        size: file.size,
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Metoda privată pentru încărcarea unui fișier mare în bucăți
   * @param file Fișierul pentru încărcare
   * @returns Rezultatul încărcării
   */
  private async uploadLargeFile(file: File): Promise<UploadResult> {
    try {
      const fileName = file.name;
      const fileSize = file.size;
      
      // Numărul total de bucăți
      const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);
      console.log(`Împărțirea fișierului ${fileName} în ${totalChunks} bucăți de ${CHUNK_SIZE / (1024 * 1024)}MB`);
      
      // 1. Inițiem încărcarea multipart prin API
      const initResponse = await fetch(`${this.baseUrl}/api/upload/init-multipart`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          transferId: this.transferId,
          fileName: fileName,
          fileSize: fileSize
        })
      });
      
      if (!initResponse.ok) {
        const errorData = await initResponse.json();
        throw new Error(errorData.error || 'Eroare la inițierea încărcării multipart');
      }
      
      const { uploadId, key } = await initResponse.json();
      console.log(`Inițiere upload multipart pentru ${fileName} cu ID: ${uploadId}`);
      
      // 2. Încărcăm bucățile în batch-uri paralele
      const partTags: { PartNumber: number, ETag: string }[] = [];
      let bytesUploaded = 0;
      let partNumber = 1;
      while (partNumber <= totalChunks) {
        const batchPromises = [];
        for (
          let i = 0;
          i < MAX_PARALLEL_CHUNKS && partNumber + i <= totalChunks;
          i++
        ) {
          const currentPartNumber = partNumber + i;
          const start = (currentPartNumber - 1) * CHUNK_SIZE;
          const end = Math.min(currentPartNumber * CHUNK_SIZE, fileSize);
          const chunkSize = end - start;
          const chunk = file.slice(start, end);

          const formData = new FormData();
          formData.append('chunk', chunk);
          formData.append('key', key);
          formData.append('uploadId', uploadId);
          formData.append('partNumber', currentPartNumber.toString());
          formData.append('transferId', this.transferId);

          const promise = fetch(`${this.baseUrl}/api/upload/upload-part`, {
            method: 'POST',
            body: formData
          }).then(async (partResponse) => {
            if (!partResponse.ok) {
              const errorData = await partResponse.json();
              throw new Error(errorData.error || `Eroare la încărcarea părții ${currentPartNumber}`);
            }
            const partResult = await partResponse.json();
            partTags.push({ PartNumber: currentPartNumber, ETag: partResult.etag });

            // Actualizăm progresul
            bytesUploaded += chunkSize;
            this.updateProgress({
              file: fileName,
              bytesUploaded,
              totalBytes: fileSize,
              percentage: Math.floor((bytesUploaded / fileSize) * 100),
              isComplete: false
            });
            console.log(`Parte ${currentPartNumber}/${totalChunks} încărcată cu succes pentru ${fileName}`);
          });

          batchPromises.push(promise);
        }
        await Promise.all(batchPromises);
        partNumber += batchPromises.length;
      }
      
      // 3. Finalizăm încărcarea multipart prin API
      console.log(`Finalizare upload multipart pentru ${fileName} cu ${partTags.length} părți`);
      
      const completeResponse = await fetch(`${this.baseUrl}/api/upload/complete-multipart`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          key,
          uploadId,
          parts: partTags
        })
      });
      
      if (!completeResponse.ok) {
        const errorData = await completeResponse.json();
        throw new Error(errorData.error || 'Eroare la finalizarea încărcării multipart');
      }
      
      // Actualizăm progresul la 100%
      this.updateProgress({
        file: fileName,
        bytesUploaded: fileSize,
        totalBytes: fileSize,
        percentage: 100,
        isComplete: true
      });
      
      console.log(`Upload multipart finalizat cu succes pentru ${fileName}`);
      
      return {
        name: fileName,
        key,
        size: fileSize,
        success: true
      };
    } catch (error: any) {
      console.error(`Eroare la încărcarea în bucăți a fișierului ${file.name}:`, error);
      return {
        name: file.name,
        key: '',
        size: file.size,
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Actualizează progresul încărcării și apelează callback-ul
   * @param progress Informații despre progres
   */
  private updateProgress(progress: UploadProgress): void {
    if (this.onProgress) {
      this.onProgress(progress);
    }
  }
} 