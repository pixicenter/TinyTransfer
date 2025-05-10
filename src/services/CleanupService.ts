import { deleteExpiredTransfers } from '../lib/db';
import cron from 'node-cron';
import fs from 'fs';
import path from 'path';

export class CleanupService {
  static initialize() {
    // Run cleanup job every day at 3 AM
    cron.schedule('0 3 * * *', () => {
      this.deleteExpiredTransfers()
        .catch(err => console.error('Failed to cleanup expired transfers:', err));
      this.cleanupDecryptedFiles()
        .catch(err => console.error('Failed to cleanup decrypted files:', err));
    });
    // Run every hour for decrypted files
    cron.schedule('0 * * * *', () => {
      this.cleanupDecryptedFiles()
        .catch(err => console.error('Failed to cleanup decrypted files:', err));
    });
  }

  static async deleteExpiredTransfers() {
    try {
      const result = deleteExpiredTransfers.run();
      console.log(`Deleted ${result.changes} expired transfers`);
    } catch (error) {
      console.error('Error deleting expired transfers:', error);
      throw error;
    }
  }

  static async cleanupDecryptedFiles() {
    const tmpDir = path.join(process.cwd(), 'tmp');
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    try {
      if (!fs.existsSync(tmpDir)) return;
      const files = fs.readdirSync(tmpDir);
      for (const file of files) {
        // Find files of the form *_decrypted_TIMESTAMP.zip
        const match = file.match(/^(.+)_decrypted_(\d+)\.zip$/);
        if (match) {
          const timestamp = parseInt(match[2], 10);
          if (now - timestamp > oneHour) {
            const filePath = path.join(tmpDir, file);
            try {
              fs.unlinkSync(filePath);
              console.log(`Deleted decrypted file: ${file}`);
            } catch (err) {
              console.error(`Failed to delete decrypted file: ${file}`, err);
            }
          }
        }
      }
    } catch (err) {
      console.error('Error cleaning up decrypted files:', err);
    }
  }
} 