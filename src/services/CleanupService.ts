import { deleteExpiredTransfers } from '../lib/db';
import cron from 'node-cron';
import db from '../lib/db';
import { R2StorageService } from './R2StorageService';

interface Transfer {
  id: string;
  created_at: string;
  expires_at: string | null;
  archive_name: string;
  size_bytes: number;
}

export class CleanupService {
  static initialize() {
    // Verifică transferurile expirate la fiecare 10 minute
    cron.schedule('*/10 * * * *', () => {
      const now = new Date();
      console.log(`[${now.toISOString()}] CleanupService scheduled check running...`);
      
      this.deleteExpiredTransfers()
        .then(count => {
          if (count > 0) {
            console.log(`Successfully cleaned up ${count} expired transfers`);
          } else {
            console.log(`No expired transfers found to clean up at ${now.toISOString()}`);
          }
        })
        .catch(err => console.error('Failed to cleanup expired transfers:', err));
    });

    console.log(`CleanupService initialized at ${new Date().toISOString()}. Scheduled to run every 10 minutes.`);
  }

  static async deleteExpiredTransfers(): Promise<number> {
    try {
      // 1. Găsește toate transferurile care au expirat până la momentul actual
      const expiredTransfers = db.prepare(`
        SELECT id FROM transfers 
        WHERE expires_at IS NOT NULL 
        AND datetime('now') > datetime(expires_at)
      `).all() as Transfer[];

      if (expiredTransfers.length === 0) {
        return 0;
      }

      console.log(`Found ${expiredTransfers.length} expired transfers to clean up`);

      // 2. Șterge fișierele din R2 storage pentru fiecare transfer expirat
      const r2Service = new R2StorageService();
      let filesDeleted = 0;
      let transfersDeleted = 0;

      for (const transfer of expiredTransfers) {
        try {
          // Ștergem fișierele din storage
          const deletedCount = await r2Service.deleteTransferFiles(transfer.id);
          filesDeleted += deletedCount;
          console.log(`Deleted ${deletedCount} files for expired transfer ${transfer.id}`);
          
          // Începem o tranzacție pentru a asigura operațiile atomice în baza de date
          db.prepare('BEGIN TRANSACTION').run();
          
          try {
            // Ștergem înregistrările în ordinea corectă pentru a respecta constrângerile de cheie străină
            
            // 1. Ștergem înregistrările din jurnal (access_logs)
            const deleteAccessLogs = db.prepare('DELETE FROM access_logs WHERE transfer_id = ?');
            deleteAccessLogs.run(transfer.id);
            
            // 2. Ștergem statisticile de transfer
            const deleteTransferStats = db.prepare('DELETE FROM transfer_stats WHERE transfer_id = ?');
            deleteTransferStats.run(transfer.id);
            
            // 3. Verificăm dacă există tabela email_history și ștergem înregistrările
            const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='email_history'").get();
            if (tableExists) {
              const deleteEmailHistory = db.prepare('DELETE FROM email_history WHERE transfer_id = ?');
              deleteEmailHistory.run(transfer.id);
            }
            
            // 4. Ștergem fișierele asociate transferului
            const deleteFilesStmt = db.prepare('DELETE FROM files WHERE transfer_id = ?');
            deleteFilesStmt.run(transfer.id);
            
            // 5. În final, ștergem transferul
            const deleteTransferStmt = db.prepare('DELETE FROM transfers WHERE id = ?');
            deleteTransferStmt.run(transfer.id);
            
            // Commit-ul tranzacției dacă totul a mers bine
            db.prepare('COMMIT').run();
            transfersDeleted++;
            console.log(`Successfully deleted transfer ${transfer.id} from database`);
          } catch (dbError) {
            // Rollback în caz de eroare
            db.prepare('ROLLBACK').run();
            console.error(`Error deleting transfer ${transfer.id} from database:`, dbError);
          }
        } catch (storageError) {
          // Logăm eroarea, dar continuăm cu celelalte transferuri
          console.error(`Error deleting files for transfer ${transfer.id}:`, storageError);
        }
      }

      if (transfersDeleted > 0) {
        console.log(`Cleanup completed: Deleted ${transfersDeleted} expired transfers and ${filesDeleted} files from storage`);
      }
      return transfersDeleted;
    } catch (error) {
      console.error('Error in deleteExpiredTransfers:', error);
      throw error;
    }
  }

  // Metodă pentru a forța curățarea manuală
  static async forceCleanup(): Promise<number> {
    console.log('Manual cleanup initiated');
    return this.deleteExpiredTransfers();
  }
} 