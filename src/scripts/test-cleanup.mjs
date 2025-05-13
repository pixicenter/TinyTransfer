#!/usr/bin/env node

// Script pentru testarea funcției de curățare a transferurilor expirate
import db from '../lib/db.ts';
import { CleanupService } from '../services/CleanupService.ts';
import { R2StorageService } from '../services/R2StorageService.ts';

async function testCleanup() {
  try {
    console.log('Starting cleanup test...');
    
    // 1. Creăm un transfer de test expirat
    const testTransferId = `test-cleanup-${Date.now()}`;
    const expiredDate = new Date();
    expiredDate.setHours(expiredDate.getHours() - 1); // Transferul a expirat cu o oră în urmă
    
    console.log(`Creating test transfer ${testTransferId} with expiration ${expiredDate.toISOString()}`);
    
    // Inserăm transferul în baza de date
    db.prepare(`
      INSERT INTO transfers (id, created_at, expires_at, archive_name, size_bytes)
      VALUES (?, datetime('now'), ?, ?, ?)
    `).run(
      testTransferId,
      expiredDate.toISOString(),
      `${testTransferId}.zip`,
      1024 // 1KB
    );
    
    // Inițializăm statisticile
    db.prepare(`
      INSERT INTO transfer_stats (transfer_id, link_views, downloads)
      VALUES (?, 0, 0)
    `).run(testTransferId);
    
    // Creem un fișier de test în storage (opțional - doar dacă avem storage configurat)
    try {
      const storage = new R2StorageService();
      // Creem un fișier gol în directorul transferului pentru test
      await storage.createEmptyFile(`uploads/${testTransferId}/test-file.txt`);
      console.log(`Created test file in storage for transfer ${testTransferId}`);
    } catch (storageError) {
      console.warn('Could not create test file in storage. This is OK for DB-only tests:', storageError.message);
    }
    
    // 2. Verificăm dacă există în baza de date
    const beforeCleanup = db.prepare(`SELECT * FROM transfers WHERE id = ?`).get(testTransferId);
    if (!beforeCleanup) {
      throw new Error(`Test transfer ${testTransferId} was not properly created in the database`);
    }
    console.log(`Confirmed test transfer exists in database: ${JSON.stringify(beforeCleanup)}`);
    
    // 3. Rulăm procesul de cleanup
    console.log('Running cleanup process...');
    const deletedCount = await CleanupService.forceCleanup();
    console.log(`Cleanup process completed. Deleted ${deletedCount} transfers.`);
    
    // 4. Verificăm dacă transferul a fost șters
    const afterCleanup = db.prepare(`SELECT * FROM transfers WHERE id = ?`).get(testTransferId);
    
    if (afterCleanup) {
      console.error(`TEST FAILED: Transfer ${testTransferId} was not deleted by cleanup process`);
      return {
        success: false,
        testTransferId,
        deletedCount
      };
    } else {
      console.log(`TEST SUCCESSFUL: Transfer ${testTransferId} was properly deleted by cleanup process`);
      return {
        success: true,
        testTransferId,
        deletedCount
      };
    }
  } catch (error) {
    console.error('Error running cleanup test:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Rulăm testul când scriptul este executat direct
testCleanup()
  .then(result => {
    console.log('Test result:', result);
    process.exit(result.success ? 0 : 1);
  })
  .catch(err => {
    console.error('Test failed with error:', err);
    process.exit(1);
  }); 