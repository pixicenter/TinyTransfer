// Import without type checking for archiver  
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { CryptoService, CryptoConfig } from './CryptoService';
import archiver from 'archiver';
import { PassThrough } from 'stream';

export interface ArchiveOptions {
  password?: string;
  expireAfter?: number; // in hours
  emailTo?: string;
  name?: string;
  encryptionConfig?: CryptoConfig;
}

interface FileToArchive {
  path: string;
  originalname: string;
  size: number;
}

export class ArchiveService {
  private static STORAGE_DIR = path.join(process.cwd(), 'storage');
  private static TEMP_DIR = path.join(process.cwd(), 'tmp');
  private static MAX_FILES_PER_BATCH = 500; // Maximum files to add to archive at once

  static initialize() {
    if (!fs.existsSync(this.STORAGE_DIR)) {
      fs.mkdirSync(this.STORAGE_DIR, { recursive: true });
    }
    if (!fs.existsSync(this.TEMP_DIR)) {
      fs.mkdirSync(this.TEMP_DIR, { recursive: true });
    }
  }

  static async archiveFiles(
    files: FileToArchive[], 
    options?: ArchiveOptions
  ): Promise<{ id: string; size: number }> {
    const archiveId = options?.name || uuidv4();
    const tempArchivePath = path.join(this.TEMP_DIR, `${archiveId}_temp.zip`);
    const finalArchivePath = path.join(this.STORAGE_DIR, `${archiveId}.zip`);
    const output = fs.createWriteStream(tempArchivePath);
    
    // Configure archiver with improved compression settings
    const archive = archiver('zip', {
      zlib: { level: 6 } // Balance between speed and compression
    });
    
    // Improved error handling
    archive.on('warning', function(err) {
      if (err.code === 'ENOENT') {
        console.warn('Archive warning:', err);
      } else {
        throw err;
      }
    });
    
    archive.on('error', function(err) {
      throw err;
    });

    const archiveResult = await new Promise<{ id: string; size: number }>((resolve, reject) => {
      output.on('close', () => {
        resolve({
          id: archiveId,
          size: archive.pointer()
        });
      });

      output.on('error', (err) => {
        reject(err);
      });

      archive.pipe(output);

      // Process files in batches to prevent memory issues with large numbers of files
      this.addFilesToArchiveInBatches(archive, files).then(() => {
        archive.finalize();
      }).catch(err => {
        reject(err);
      });
    });

    // If we have encryption configuration and it is enabled, apply encryption
    if (options?.encryptionConfig?.enabled) {
      console.log(`Applying encryption for archive ${archiveId}`);
      await CryptoService.encryptFile(
        tempArchivePath,
        finalArchivePath,
        options.encryptionConfig,
        {
          name: options.name,
          email: options.emailTo,
          password: options.password,
          timestamp: Date.now()
        }
      );
      
      // Delete the temporary archive
      fs.unlinkSync(tempArchivePath);
    } else {
      // If we don't have encryption, just move the file
      fs.renameSync(tempArchivePath, finalArchivePath);
    }

    return archiveResult;
  }

  // Helper method to add files to archive in batches
  private static async addFilesToArchiveInBatches(archive: archiver.Archiver, files: FileToArchive[]): Promise<void> {
    const totalFiles = files.length;
    console.log(`Adding ${totalFiles} files to archive in batches`);
    
    for (let i = 0; i < totalFiles; i += this.MAX_FILES_PER_BATCH) {
      const batchFiles = files.slice(i, i + this.MAX_FILES_PER_BATCH);
      const batchSize = batchFiles.length;
      
      console.log(`Processing batch ${Math.floor(i/this.MAX_FILES_PER_BATCH) + 1}: ${batchSize} files (${i+1}-${Math.min(i+batchSize, totalFiles)} of ${totalFiles})`);
      
      // Add current batch of files
      for (const file of batchFiles) {
        if (fs.existsSync(file.path)) {
          try {
            // Create read stream for each file and append to archive
            const fileStream = fs.createReadStream(file.path);
            archive.append(fileStream, { name: file.originalname });
          } catch (error) {
            console.error(`Error adding file ${file.originalname} to archive:`, error);
            throw error;
          }
        } else {
          console.warn(`File does not exist: ${file.path}, skipping`);
        }
      }
      
      // Allows garbage collection between batches and prevents memory buildup
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  static async deleteArchive(archiveId: string): Promise<void> {
    const archivePath = path.join(this.STORAGE_DIR, `${archiveId}.zip`);
    if (fs.existsSync(archivePath)) {
      await fs.promises.unlink(archivePath);
    }
  }

  static getArchivePath(archiveId: string): string {
    return path.join(this.STORAGE_DIR, `${archiveId}.zip`);
  }

  static async decryptArchive(
    archiveId: string, 
    options: ArchiveOptions
  ): Promise<string> {
    if (!options.encryptionConfig?.enabled) {
      // If encryption is not enabled, return the original path
      return this.getArchivePath(archiveId);
    }

    const encryptedPath = this.getArchivePath(archiveId);
    const timestamp = Date.now();
    const decryptedPath = path.join(this.TEMP_DIR, `${archiveId}_decrypted_${timestamp}.zip`);

    console.log(`Temporary decryption of archive ${archiveId} using ${options.encryptionConfig.keySource} as key source`);
    await CryptoService.decryptFile(
      encryptedPath,
      decryptedPath,
      options.encryptionConfig,
      {
        name: options.name,
        email: options.emailTo,
        password: options.password,
        timestamp: timestamp
      }
    );

    return decryptedPath;
  }

  // Add a method for deleting a temporary decrypted file
  static cleanupTempFile(filePath: string): void {
    if (fs.existsSync(filePath) && filePath.startsWith(this.TEMP_DIR)) {
      try {
        console.log(`Deleting temporary file: ${filePath}`);
        fs.unlinkSync(filePath);
      } catch (error: unknown) {
        console.error(`Error deleting temporary file ${filePath}:`, error);
      }
    }
  }
} 