import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyJWT } from './lib/auth';

// Public routes that don't require authentication
const publicRoutes = ['/', '/login', '/signup', '/offline', '/_next', '/api/auth', '/terms', '/privacy', '/refund-policy'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if route is public
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Check if it's a static file
  if (
    pathname.includes('.') &&
    !pathname.startsWith('/api/')
  ) {
    return NextResponse.next();
  }

  // Get token from cookie
  const token = request.cookies.get('token')?.value;

  // If no token, redirect to login
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Verify token
  const user = verifyJWT(token);

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Role-based route protection
  if (pathname.startsWith('/client') && user.role !== 'CLIENT') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (pathname.startsWith('/companion') && user.role !== 'COMPANION') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Force password change before accessing any companion route
  if (
    user.role === 'COMPANION' &&
    user.isTemporaryPassword === true &&
    pathname.startsWith('/companion') &&
    pathname !== '/companion/change-password'
  ) {
    return NextResponse.redirect(new URL('/companion/change-password', request.url));
  }

  if (pathname.startsWith('/admin') && user.role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons/).*)'],
};
