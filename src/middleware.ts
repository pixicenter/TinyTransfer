import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// The public routes that are always accessible
const PUBLIC_PATHS = [
  '/',
  '/api/auth/login',
  '/api/auth/setup',
  '/api/auth/check',
  '/api/download',
  '/download'
];

// The routes that require admin authentication
const PROTECTED_ROUTES = [
  '/admin',
  '/admin/settings',
  '/transfers',
  '/dashboard',
  '/api/dashboard',
  '/api/settings',
  '/api/logo',
  '/api/gallery',
  '/api/upload',
  '/api/send-email',
  '/api/transfers',
  '/api/upload/initialize',
  '/api/upload/batch',
  '/api/upload/status'
];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  // Debugging - for diagnostic
  console.log(`Middleware processing path: ${path}`);
  
  // Allow access for public routes
  if (PUBLIC_PATHS.some(p => path === p || path.startsWith(p + '/'))) {
    console.log(`Public path allowed: ${path}`);
    return NextResponse.next();
  }

  // Check if the route requires authentication
  const requiresAuth = PROTECTED_ROUTES.some(route => 
    path === route || path.startsWith(route + '/')
  );
  
  // If the route does not require authentication, allow access
  if (!requiresAuth) {
    console.log(`Non-protected path allowed: ${path}`);
    return NextResponse.next();
  }
  
  console.log(`Protected path detected: ${path}`);
  
  // Check the authentication token for protected routes
  const authToken = request.cookies.get('auth_token');
  console.log(`Auth token present: ${!!authToken}`);

  if (!authToken || !authToken.value) {
    console.log('No auth token, redirecting to login');
    // Redirect to login for non-API routes
    if (!path.startsWith('/api/')) {
      const loginUrl = new URL('/', request.url);
      loginUrl.searchParams.set('redirect', path);
      return NextResponse.redirect(loginUrl);
    }
    
    // Return 401 error for API routes
    return NextResponse.json(
      { error: 'Unauthorized - No token provided' },
      { status: 401 }
    );
  }

  try {
    // Check the validity of the JWT token
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET || 'default_secret_key_change_me'
    );
    
    // Use the token from the cookie for verification
    const verified = await jwtVerify(authToken.value, secret);
    console.log('JWT verification successful');
    
    // If the verification is successful, allow access
    return NextResponse.next();
  } catch (error) {
    console.error('JWT verification failed:', error);
    
    // Delete the invalid cookie
    const response = !path.startsWith('/api/')
      ? NextResponse.redirect(new URL('/', request.url))
      : NextResponse.json({ error: 'Unauthorized - Invalid token' }, { status: 401 });
    
    response.cookies.delete('auth_token');
    return response;
  }
}

// Configure the middleware to apply to all routes
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)'],
}; 