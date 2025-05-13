import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { SignJWT } from 'jose';
import db from '../../../../lib/db';

// This route needs to run on Node.js and not on Edge Runtime
export const runtime = 'nodejs';

// Interface for admin settings
interface AdminSettings {
  admin_password_hash: string;
  admin_email: string;
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    // Logging pentru debugging
    // console.log('Login attempt received');

    // Get admin password hash from settings
    const settings = db.prepare('SELECT admin_password_hash, admin_email FROM settings LIMIT 1').get() as AdminSettings;
    if (!settings) {
      console.log('Admin account not set up');
      return NextResponse.json(
        { error: 'Admin account not set up' },
        { status: 400 }
      );
    }

    // Verify email
    if (email !== settings.admin_email) {
      // console.log('Invalid email');
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(
      password,
      settings.admin_password_hash
    );

    if (!passwordMatch) {
      // console.log('Invalid password');
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // console.log('Credentials valid, generating token');

    // Generate JWT token with a longer expiration
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET || 'default_secret_key_change_me'
    );
    
    const token = await new SignJWT({ role: 'admin', email })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h') // Token valid for 24 hours
      .sign(secret);

    // console.log('JWT token generated');
    
    // Set cookie with proper options
    const response = NextResponse.json({ 
      success: true,
      message: 'Logged in successfully'
    });
    
    // Set the cookie with correct options for different media
    const isProduction = process.env.NODE_ENV === 'production';
    response.cookies.set({
      name: 'auth_token',
      value: token,
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax', // 'strict' can cause issues with redirecting
      maxAge: 60 * 60 * 24, // 24 hours in seconds
      path: '/' // Available on all paths
    });

    // console.log('Auth cookie set');
    
    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Failed to process login' },
      { status: 500 }
    );
  }
} 