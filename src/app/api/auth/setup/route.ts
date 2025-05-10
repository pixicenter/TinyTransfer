import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import db from '../../../../lib/db';

// This route needs to run on Node.js and not on Edge Runtime
export const runtime = 'nodejs';

// Email validation function
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Check if an admin account already exists
export async function GET() {
  try {
    const existingSettings = db.prepare('SELECT * FROM settings LIMIT 1').get();
    
    if (existingSettings) {
      return NextResponse.json(
        { error: 'Admin account already set up', exists: true },
        { status: 403 }
      );
    }
    
    return NextResponse.json({ exists: false });
  } catch (error) {
    console.error('Setup check error:', error);
    return NextResponse.json(
      { error: 'Failed to check admin account' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check if admin account already exists
    const existingSettings = db.prepare('SELECT * FROM settings LIMIT 1').get();
    if (existingSettings) {
      return NextResponse.json(
        { error: 'Admin account already set up' },
        { status: 403 }
      );
    }

    const { email, password } = await request.json();
    
    // Validate email
    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Please provide a valid email address' },
        { status: 400 }
      );
    }

    // Validate password
    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    // Hash password and save settings
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Use a transaction to insert all initial settings
    db.transaction(() => {
      // Insert admin settings with email
      db.prepare('INSERT INTO settings (admin_password_hash, admin_email) VALUES (?, ?)').run(passwordHash, email);
      
      // Insert app settings with dark theme and English as defaults
      db.prepare(`
        INSERT OR REPLACE INTO app_settings (id, app_name, theme, language, encryption_enabled, encryption_key_source) 
        VALUES (1, 'TinyTransfer', 'dark', 'en', 1, 'transfer_name')
      `).run();
    })();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Setup error:', error);
    return NextResponse.json(
      { error: 'Failed to set up admin account' },
      { status: 500 }
    );
  }
} 