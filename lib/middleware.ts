import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from './auth';

export function middlewareCheck(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  const pathname = request.nextUrl.pathname;

  // Public routes that don't require authentication
  const publicRoutes = ['/', '/login', '/signup', '/offline'];
  if (publicRoutes.includes(pathname)) {
    return null; // Allow access
  }

  // Check if user is authenticated
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

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

  if (pathname.startsWith('/admin') && user.role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Redirect root to appropriate dashboard
  if (pathname === '/') {
    if (user.role === 'CLIENT') {
      return NextResponse.redirect(new URL('/client/dashboard', request.url));
    }
    if (user.role === 'COMPANION') {
      return NextResponse.redirect(new URL('/companion/dashboard', request.url));
    }
    if (user.role === 'ADMIN') {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    }
  }

  return null; // Allow access
}
