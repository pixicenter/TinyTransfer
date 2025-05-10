import { NextResponse } from 'next/server';

export async function POST() {
  try {
    // Create a response that deletes the authentication cookie
    const response = NextResponse.json({ success: true });
    
    // Delete the authentication cookie by setting an expired cookie
    response.cookies.set('auth_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0, // Cookie that expires immediately
      path: '/'
    });
    
    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Failed to logout' },
      { status: 500 }
    );
  }
} 