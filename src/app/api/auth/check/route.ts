import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import db from '../../../../lib/db';
import { CleanupService } from '../../../../services/CleanupService';

CleanupService.initialize();

export async function GET(request: NextRequest) {
  try {
    // First check if the database is properly set up
    try {
      const settings = db.prepare('SELECT * FROM settings LIMIT 1').get();
      if (!settings) {
        console.log('Auth check: No settings found, setup required');
        return NextResponse.json({
          isAuthenticated: false,
          isSetupRequired: true
        });
      }
    } catch (dbError) {
      console.error('Database access error:', dbError);
      return NextResponse.json({
        isAuthenticated: false,
        isSetupRequired: true,
        error: 'Database error'
      });
    }
    
    // Obtain the authentication cookie
    const cookieStore = cookies();
    const authToken = cookieStore.get('auth_token');
    
    // Check if the token exists
    if (!authToken || !authToken.value) {
      console.log('Auth check: No token found');
      return NextResponse.json({
        isAuthenticated: false,
        isSetupRequired: false
      });
    }
    
    try {
      // Verify the JWT
      const secret = new TextEncoder().encode(
        process.env.JWT_SECRET || 'default_secret_key_change_me'
      );
      
      await jwtVerify(authToken.value, secret);
      console.log('Auth check: Valid token');
      
      return NextResponse.json({
        isAuthenticated: true,
        isSetupRequired: false
      });
    } catch (jwtError) {
      console.error('Auth check: Invalid JWT token', jwtError);
      return NextResponse.json({
        isAuthenticated: false,
        isSetupRequired: false
      });
    }
  } catch (error) {
    console.error('Authentication check error:', error);
    return NextResponse.json(
      { isAuthenticated: false, error: 'Verification failed' },
      { status: 500 }
    );
  }
} 