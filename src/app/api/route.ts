import { NextResponse } from 'next/server';

/**
 * API route principală care inițializează serviciile globale
 */
export async function GET() {
  return NextResponse.json({ status: 'ok', message: 'API TinyTransfer funcționează corect' });
} 