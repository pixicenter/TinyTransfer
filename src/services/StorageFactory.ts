import { R2StorageService } from './R2StorageService';
import { Readable } from 'stream';

export interface StorageProvider {
  uploadFile(transferId: string, file: File): Promise<string>;
  uploadFilesParallel(
    transferId: string, 
    files: File[], 
    concurrency?: number
  ): Promise<Array<{ name: string, key: string, size: number, success: boolean, error?: string }>>;
  uploadFilesParallelUnlimited(
    transferId: string, 
    files: File[]
  ): Promise<Array<{ name: string, key: string, size: number, success: boolean, error?: string }>>;
  downloadFile(transferId: string, fileName: string): Promise<Readable>;
  downloadArchive(transferId: string, archiveKey: string): Promise<Readable>;
  deleteFile(transferId: string, fileName: string): Promise<void>;
  deleteTransferFiles(transferId: string): Promise<number>;
  listFiles(transferId: string): Promise<Array<{ name: string; size: number; lastModified?: Date }>>;
  createArchive(transferId: string): Promise<string>;
  getSignedUrl(key: string, expiresIn?: number): Promise<string>;
  getSignedUrlWithCustomFilename(key: string, filename: string, expiresIn?: number): Promise<string>;
}

export class StorageFactory {
  private static instance: StorageProvider;

  static getStorage(): StorageProvider {
    if (!this.instance) {
      this.instance = new R2StorageService();
    }
    return this.instance;
  }
} 