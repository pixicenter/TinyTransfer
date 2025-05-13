import { NextRequest, NextResponse } from 'next/server';
import { CleanupService } from '../../../services/CleanupService';
import { initializeCleanupService } from '../../../lib/cleanup-init';

// Inițializare la pornirea aplicației
initializeCleanupService();
console.log('CleanupService initialized from cleanup endpoint');

// Endpoint pentru forțarea curățării manuale
export async function POST(request: NextRequest) {
  try {
    // Verifică dacă userul este autentificat (ar trebui implementat)
    // În mod ideal, ar trebui să verifici tokenul JWT sau cookie-urile de autentificare
    
    const count = await CleanupService.forceCleanup();
    
    return NextResponse.json({
      success: true,
      message: `Cleanup job completed successfully. Deleted ${count} expired transfers.`
    });
  } catch (error) {
    console.error('Error running manual cleanup:', error);
    return NextResponse.json(
      { error: 'Failed to run cleanup process' },
      { status: 500 }
    );
  }
} 