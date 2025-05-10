import CryptoJS from 'crypto-js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { promisify } from 'util';
import { pipeline } from 'stream';

const pipelineAsync = promisify(pipeline);

// Maximum size for in-memory processing (50MB)
const MAX_IN_MEMORY_SIZE = 50 * 1024 * 1024;

type EncryptionKeySource = 'manual' | 'transfer_name' | 'email' | 'password' | 'timestamp';

export interface CryptoConfig {
  enabled: boolean;
  keySource: EncryptionKeySource;
  manualKey?: string;
}

interface TransferData {
  name?: string;
  email?: string;
  password?: string;
  timestamp?: number;
}

export class CryptoService {
  private static defaultConfig: CryptoConfig = {
    enabled: false,
    keySource: 'manual',
    manualKey: '_change_me'
  };

  /**
   * Encrypts a file
   * @param sourcePath Path to the file that needs to be encrypted
   * @param destinationPath Path where the encrypted file will be saved
   * @param config Encryption configuration
   * @param transferData Data used for generating the encryption key
   */
  static async encryptFile(
    sourcePath: string, 
    destinationPath: string, 
    config: CryptoConfig,
    transferData?: TransferData
  ): Promise<void> {
    if (!config.enabled) {
      // If encryption is disabled, copy the file only
      fs.copyFileSync(sourcePath, destinationPath);
      return;
    }

    const key = this.generateKey(config, transferData);
    console.log(`Encryption of file ${path.basename(sourcePath)} using key derived from: ${config.keySource}`);

    try {
      // Check the file size
      const stats = fs.statSync(sourcePath);
      
      if (stats.size <= MAX_IN_MEMORY_SIZE) {
        // For small files, use in-memory approach
        await this.encryptSmallFile(sourcePath, destinationPath, key);
      } else {
        // For large files, use streams
        await this.encryptLargeFile(sourcePath, destinationPath, key);
      }
      
      console.log(`File ${path.basename(sourcePath)} has been encrypted successfully.`);
    } catch (error: any) {
      console.error('Error encrypting file:', error);
      throw new Error(`Error encrypting file: ${error.message || String(error)}`);
    }
  }

  /**
   * Decrypts a file
   * @param sourcePath Path to the encrypted file
   * @param destinationPath Path where the decrypted file will be saved
   * @param config Encryption configuration
   * @param transferData Data used for generating the decryption key
   */
  static async decryptFile(
    sourcePath: string, 
    destinationPath: string, 
    config: CryptoConfig,
    transferData?: TransferData
  ): Promise<void> {
    if (!config.enabled) {
      // If encryption is disabled, copy the file only
      fs.copyFileSync(sourcePath, destinationPath);
      return;
    }

    const key = this.generateKey(config, transferData);
    console.log(`Decryption of file ${path.basename(sourcePath)} using key derived from: ${config.keySource}`);

    try {
      // Check the file size
      const stats = fs.statSync(sourcePath);
      
      if (stats.size <= MAX_IN_MEMORY_SIZE) {
        // For small files, use in-memory approach
        await this.decryptSmallFile(sourcePath, destinationPath, key);
      } else {
        // For large files, use streams and chunked encryption
        await this.decryptLargeFile(sourcePath, destinationPath, key);
      }
      
      console.log(`File ${path.basename(sourcePath)} has been decrypted successfully.`);
    } catch (error: any) {
      console.error('Error decrypting file:', error);
      throw new Error(`Error decrypting file: ${error.message || String(error)}`);
    }
  }

  /**
   * Encrypts a small file (in-memory processing)
   */
  private static async encryptSmallFile(sourcePath: string, destinationPath: string, key: string): Promise<void> {
    // Read the file as a buffer
    const fileData = fs.readFileSync(sourcePath);
    
    // Convert the buffer to a WordArray
    const wordArray = CryptoJS.lib.WordArray.create(fileData as any);
    
    // Encrypt the data
    const encrypted = CryptoJS.AES.encrypt(wordArray, key).toString();
    
    // Save the encrypted data
    fs.writeFileSync(destinationPath, encrypted);
  }

  /**
   * Decrypts a small file (in-memory processing)
   */
  private static async decryptSmallFile(sourcePath: string, destinationPath: string, key: string): Promise<void> {
    // Read the encrypted data
    const encryptedData = fs.readFileSync(sourcePath, 'utf8');
    
    // Decrypt the data
    const decrypted = CryptoJS.AES.decrypt(encryptedData, key);
    
    // Convert the WordArray to a buffer to save the file
    const decryptedBuffer = Buffer.from(decrypted.toString(CryptoJS.enc.Hex), 'hex');
    
    // Save the decrypted data
    fs.writeFileSync(destinationPath, decryptedBuffer);
  }

  /**
   * Encrypts a large file using Node.js crypto streams
   */
  private static async encryptLargeFile(sourcePath: string, destinationPath: string, key: string): Promise<void> {
    // Derive the key and iv from the key
    const derivedKey = crypto.scryptSync(key, 'salt', 32);
    const iv = crypto.randomBytes(16);
    
    // Write the iv to the beginning of the file
    const writeStream = fs.createWriteStream(destinationPath);
    writeStream.write(iv);
    
    // Create an encryption stream
    const cipher = crypto.createCipheriv('aes-256-cbc', derivedKey, iv);
    
    // Connect the streams
    const readStream = fs.createReadStream(sourcePath);
    
    await pipelineAsync(
      readStream,
      cipher,
      writeStream
    );
  }

  /**
   * Decrypts a large file using Node.js crypto streams
   */
  private static async decryptLargeFile(sourcePath: string, destinationPath: string, key: string): Promise<void> {
    try {
      // Read the iv from the beginning of the file
      const readIvStream = fs.createReadStream(sourcePath, { end: 15 });
      const chunks: Buffer[] = [];
      
      for await (const chunk of readIvStream) {
        chunks.push(Buffer.from(chunk));
      }
      
      const iv = Buffer.concat(chunks);
      
      // Derive the key from the key
      const derivedKey = crypto.scryptSync(key, 'salt', 32);
      
      // Create the streams
      const readStream = fs.createReadStream(sourcePath, { start: 16 });
      const decipher = crypto.createDecipheriv('aes-256-cbc', derivedKey, iv);
      const writeStream = fs.createWriteStream(destinationPath);
      
      await pipelineAsync(
        readStream,
        decipher,
        writeStream
      );
    } catch (error: any) {
      console.error('Error decrypting large file:', error);
      throw new Error(`Error decrypting large file: ${error.message || String(error)}`);
    }
  }

  /**
   * Generates an encryption key based on the configuration and transfer data
   */
  private static generateKey(
    config: CryptoConfig, 
    transferData?: TransferData
  ): string {
    let rawKey: string = '';

    switch (config.keySource) {
      case 'manual':
        rawKey = config.manualKey || this.defaultConfig.manualKey || '';
        break;
      case 'transfer_name':
        if (!transferData?.name) {
          throw new Error('The transfer name is required for key generation.');
        }
        rawKey = transferData.name;
        break;
      case 'email':
        if (!transferData?.email) {
          throw new Error('The email is required for key generation.');
        }
        rawKey = transferData.email;
        break;
      case 'password':
        if (!transferData?.password) {
          throw new Error('The password is required for key generation.');
        }
        rawKey = transferData.password;
        break;
      case 'timestamp':
        if (!transferData?.timestamp) {
          rawKey = Date.now().toString();
        } else {
          rawKey = transferData.timestamp.toString();
        }
        break;
      default:
        rawKey = this.defaultConfig.manualKey || '';
    }

    // Derive a secure key with SHA-256
    return CryptoJS.SHA256(rawKey).toString();
  }
} 