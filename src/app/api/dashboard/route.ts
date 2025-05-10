import { NextResponse } from 'next/server';
import db, { getRecentTransfers } from '../../../lib/db';

// Default storage limit per user (50 GB converted to bytes, can be overridden in .env)
const DEFAULT_STORAGE_LIMIT = process.env.STORAGE_LIMIT_BYTES ? parseInt(process.env.STORAGE_LIMIT_BYTES, 10) : 10 * 1024 * 1024 * 1024;

// Interface for dashboard statistics
interface DashboardStats {
  totalTransfers: number;
  totalFiles: number;
  totalStorageUsed: number;
  activeTransfers: number;
  expiredTransfers: number;
  availableStorage?: number;
}

// Route handler for the dashboard API
export async function GET() {
  try {
    // Get general statistics
    const statsQuery = db.prepare(`
      SELECT 
        (SELECT COUNT(*) FROM transfers) as totalTransfers,
        (SELECT COUNT(*) FROM files) as totalFiles,
        (SELECT COALESCE(SUM(size_bytes), 0) FROM transfers) as totalStorageUsed,
        (SELECT COUNT(*) FROM transfers WHERE expires_at IS NULL OR datetime(expires_at) > datetime('now')) as activeTransfers,
        (SELECT COUNT(*) FROM transfers WHERE expires_at IS NOT NULL AND datetime(expires_at) <= datetime('now')) as expiredTransfers
    `);
    
    const stats = statsQuery.get() as DashboardStats;
    
    // Add available storage (difference between implicit limit and used storage)
    stats.availableStorage = Math.max(0, DEFAULT_STORAGE_LIMIT - stats.totalStorageUsed);
    
    // Get the latest 10 active transfers (which haven't expired)
    // Increase the number of transfers to 10 to allow filtering on the client
    const recentTransfers = getRecentTransfers.all(10);
    
    return NextResponse.json({
      stats,
      recentTransfers
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching dashboard data' },
      { status: 500 }
    );
  }
} 