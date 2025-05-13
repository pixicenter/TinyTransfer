import { NextResponse } from 'next/server';
import db from '../../../lib/db';
import { R2StorageService } from '../../../services/R2StorageService';

// Add an interface for Transfer
interface Transfer {
  id: string;
  created_at: string;
  expires_at: string | null;
  archive_name: string;
  size_bytes: number;
  transfer_password_hash: string | null;
}

// Add this interface next to the existing Transfer interface
interface AppSettings {
  id: number;
  app_name: string;
  logo_url: string | null;
  logo_url_dark: string | null;
  logo_url_light: string | null;
  logo_type: string;
  theme: string;
  language: string;
  slideshow_interval: number;
  slideshow_effect: string;
}

// Route handler pentru listarea transferurilor
export async function GET() {
  try {
    // Get all transfers with statistics
    const transfersQuery = db.prepare(`
      SELECT t.id, t.created_at, t.expires_at, t.archive_name, t.size_bytes, t.transfer_password_hash,
             ts.link_views, ts.downloads, ts.email_sent, ts.email_error, ts.last_accessed,
             (SELECT COUNT(DISTINCT ip_address) FROM access_logs WHERE transfer_id = t.id) as unique_ip_count
      FROM transfers t
      LEFT JOIN transfer_stats ts ON t.id = ts.transfer_id
      ORDER BY t.created_at DESC
    `);

    const filesQuery = db.prepare(`
      SELECT id, transfer_id, original_name, size_bytes
      FROM files
      WHERE transfer_id = ?
    `);

    const transfers = transfersQuery.all().map((transfer: any) => {
      const files = filesQuery.all(transfer.id);
      return {
        ...transfer,
        stats: {
          link_views: transfer.link_views || 0,
          downloads: transfer.downloads || 0,
          unique_ip_count: transfer.unique_ip_count || 0,
          email_sent: !!transfer.email_sent,
          email_error: transfer.email_error || null,
          last_accessed: transfer.last_accessed || null
        },
        files
      };
    });

    return NextResponse.json({
      transfers
    });
  } catch (error) {
    console.error('API Transfers error:', error);
    return NextResponse.json(
      { error: 'A apărut o eroare la obținerea transferurilor' },
      { status: 500 }
    );
  }
}

// Route handler pentru ștergerea unui transfer
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'The transfer ID is required' },
        { status: 400 }
      );
    }

    // Check if the transfer exists and get the archive name
    const transfer = db.prepare('SELECT id, archive_name FROM transfers WHERE id = ?').get(id) as Transfer;
    if (!transfer) {
      return NextResponse.json(
        { error: 'The transfer was not found' },
        { status: 404 }
      );
    }

    // 1. Ștergem fișierele din storage (R2)
    const r2Service = new R2StorageService();
    try {
      // Vom încerca să ștergem fișierele, dar vom continua chiar dacă eșuează
      await r2Service.deleteTransferFiles(id);
    } catch (storageError) {
      console.error(`Eroare la ștergerea fișierelor din storage pentru transferul ${id}:`, storageError);
      // Nu returnăm eroare aici, continuăm cu ștergerea din baza de date
    }

    // 2. Start a transaction to ensure atomic operations in the database
    db.prepare('BEGIN TRANSACTION').run();

    try {
      // Delete the statistics and logs associated
      const deleteAccessLogs = db.prepare('DELETE FROM access_logs WHERE transfer_id = ?');
      deleteAccessLogs.run(id);
      
      const deleteTransferStats = db.prepare('DELETE FROM transfer_stats WHERE transfer_id = ?');
      deleteTransferStats.run(id);

      // Check if the email_history table exists and delete the associated records
      const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='email_history'").get();
      
      if (tableExists) {
        const deleteEmailHistory = db.prepare('DELETE FROM email_history WHERE transfer_id = ?');
        deleteEmailHistory.run(id);
      }

      // Delete the files associated with the transfer first
      const deleteFilesStmt = db.prepare('DELETE FROM files WHERE transfer_id = ?');
      deleteFilesStmt.run(id);

      // Then delete the transfer
      const deleteTransferStmt = db.prepare('DELETE FROM transfers WHERE id = ?');
      deleteTransferStmt.run(id);

      // Commit the transaction if everything went well
      db.prepare('COMMIT').run();

      return NextResponse.json({
        success: true,
        message: 'Transfer and associated files deleted successfully'
      });
    } catch (dbError) {
      // Rollback to the previous state in case of an error
      db.prepare('ROLLBACK').run();
      throw dbError;
    }
  } catch (error) {
    console.error('Error deleting the transfer:', error);
    return NextResponse.json(
      { error: 'An error occurred while deleting the transfer' },
      { status: 500 }
    );
  }
}

// Route handler for updating the expiration date of a transfer
export async function PATCH(request: Request) {
  try {
    const { id, expiration } = await request.json();

    if (!id || !expiration) {
      return NextResponse.json(
        { error: 'Transfer ID and expiration period are required' },
        { status: 400 }
      );
    }

    let newExpiresAt: string | null = null;
    const now = new Date();

    switch (expiration) {
      case '2-minutes':
        // Adăugăm 2 minute la data curentă pentru testare
        const twoMinutesLater = new Date(now.getTime() + 2 * 60 * 1000);
        newExpiresAt = twoMinutesLater.toISOString();
        break;
      case '1-month':
        newExpiresAt = new Date(now.setMonth(now.getMonth() + 1)).toISOString();
        break;
      case '3-months':
        newExpiresAt = new Date(now.setMonth(now.getMonth() + 3)).toISOString();
        break;
      case 'permanent':
        newExpiresAt = null; // Set to null for permanent transfers
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid expiration period' },
          { status: 400 }
        );
    }

    // Update the transfer in the database
    const stmt = db.prepare('UPDATE transfers SET expires_at = ? WHERE id = ?');
    const result = stmt.run(newExpiresAt, id);

    if (result.changes === 0) {
      return NextResponse.json(
        { error: 'Transfer not found or no changes made' },
        { status: 404 }
      );
    }

    // Fetch the updated transfer to return it
    const updatedTransferQuery = db.prepare(`
      SELECT t.id, t.created_at, t.expires_at, t.archive_name, t.size_bytes, 
             ts.link_views, ts.downloads, ts.email_sent, ts.email_error, ts.last_accessed,
             (SELECT COUNT(DISTINCT ip_address) FROM access_logs WHERE transfer_id = t.id) as unique_ip_count
      FROM transfers t
      LEFT JOIN transfer_stats ts ON t.id = ts.transfer_id
      WHERE t.id = ?
    `);
    const updatedTransfer = updatedTransferQuery.get(id) as Transfer;

    if (!updatedTransfer) {
        return NextResponse.json(
            { error: 'Failed to retrieve updated transfer' },
            { status: 500 }
        );
    }
    
    const filesQuery = db.prepare(`
        SELECT id, transfer_id, original_name, size_bytes
        FROM files
        WHERE transfer_id = ?
    `);
    const files = filesQuery.all(id);

    return NextResponse.json({
      success: true,
      message: 'Transfer expiration updated successfully',
      transfer: {
        ...updatedTransfer,
        stats: {
            link_views: (updatedTransfer as any).link_views || 0,
            downloads: (updatedTransfer as any).downloads || 0,
            unique_ip_count: (updatedTransfer as any).unique_ip_count || 0,
            email_sent: !!(updatedTransfer as any).email_sent,
            email_error: (updatedTransfer as any).email_error || null,
            last_accessed: (updatedTransfer as any).last_accessed || null
        },
        files
      }
    });

  } catch (error) {
    console.error('Error updating transfer expiration:', error);
    return NextResponse.json(
      { error: 'An error occurred while updating the transfer expiration' },
      { status: 500 }
    );
  }
} 