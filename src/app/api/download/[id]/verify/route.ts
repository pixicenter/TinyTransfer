import { NextRequest, NextResponse } from 'next/server';
import { getTransferById } from '../../../../../lib/db';
import bcrypt from 'bcrypt';

export const runtime = 'nodejs';

interface Transfer {
  id: string;
  created_at: string;
  expires_at: string | null;
  archive_name: string;
  size_bytes: number;
  transfer_password_hash: string | null;
}

export async function POST(request: NextRequest, context: any) {
  try {
    const transfer = getTransferById.get(context.params.id) as Transfer;
    if (!transfer) {
      return NextResponse.json({ error: 'Transfer not found' }, { status: 404 });
    }
    if (!transfer.transfer_password_hash) {
      return NextResponse.json({ success: true, needsPassword: false });
    }
    const { password } = await request.json();
    if (!password) {
      return NextResponse.json({ error: 'Password is required', needsPassword: true }, { status: 400 });
    }
    const isPasswordValid = await bcrypt.compare(password, transfer.transfer_password_hash);
    if (!isPasswordValid) {
      return NextResponse.json({ error: 'Invalid password', needsPassword: true }, { status: 401 });
    }
    return NextResponse.json({ success: true, needsPassword: false });
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
} 