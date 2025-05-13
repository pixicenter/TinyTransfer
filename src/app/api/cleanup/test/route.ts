import { NextRequest, NextResponse } from 'next/server';
import { CleanupService } from '../../../../services/CleanupService';
import db from '../../../../lib/db';

// Endpoint pentru testarea ștergerii transferurilor expirate
export async function POST(request: NextRequest) {
  try {
    // 1. Creează un transfer care a expirat în trecut
    const testTransferId = `test-${Date.now()}`;
    const expiredDate = new Date();
    expiredDate.setHours(expiredDate.getHours() - 1); // Transfer expirat cu o oră în urmă
    
    // Inserăm transferul expirat în baza de date
    db.prepare(`
      INSERT INTO transfers (id, created_at, expires_at, archive_name, size_bytes)
      VALUES (?, datetime('now'), ?, ?, ?)
    `).run(
      testTransferId,
      expiredDate.toISOString(),
      `${testTransferId}.zip`,
      1024 // 1KB
    );
    
    // Inițializăm statisticile pentru transfer
    db.prepare(`
      INSERT INTO transfer_stats (transfer_id, link_views, downloads)
      VALUES (?, 0, 0)
    `).run(testTransferId);
    
    console.log(`Created test transfer ${testTransferId} that expired at ${expiredDate.toISOString()}`);
    
    // 2. Rulăm procesul de curățare
    const count = await CleanupService.forceCleanup();
    
    // 3. Verificăm dacă transferul a fost șters
    const checkTransfer = db.prepare(`
      SELECT id FROM transfers WHERE id = ?
    `).get(testTransferId);
    
    const wasDeleted = checkTransfer === undefined;
    
    return NextResponse.json({
      success: true,
      testTransferId,
      wasDeleted,
      totalDeleted: count,
      message: wasDeleted 
        ? `Test successful: Transfer ${testTransferId} was deleted by cleanup process` 
        : `Test failed: Transfer ${testTransferId} was not deleted`
    });
  } catch (error) {
    console.error('Error in cleanup test:', error);
    return NextResponse.json(
      { error: 'Failed to run cleanup test' },
      { status: 500 }
    );
  }
} 