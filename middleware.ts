import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyJWT } from './lib/auth';

// Public routes — no auth required
const publicRoutes = [
  '/',
  '/login',
  '/signup',
  '/offline',
  '/_next',
  '/api/auth',   // includes /api/auth/okyc/* (requireAuth handles internal auth)
  '/api/session', // handles its own auth — POST used by SessionRestorer without a cookie
  '/terms',
  '/privacy',
  '/refund-policy',
  '/apply',      // /apply/submitted is public
  '/faq',
  '/forgot-password',
  '/reset-password',
];

// CLIENT routes that are accessible regardless of clientStatus.
// All others require clientStatus === 'APPROVED'.
const clientStatusExempt = [
  '/client/pending',
  '/client/rejected',
  '/client/verify',      // /client/verify and /client/verify/callback
  '/client/browse',      // PENDING_REVIEW clients who have uploaded a photo can preview companions
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Allow static files
  if (pathname.includes('.') && !pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Extract and verify JWT
  const token = request.cookies.get('token')?.value;
  if (!token) {
    // Redirect to landing page (not /login) so SessionRestorer can silently
    // restore the session from the localStorage refresh token. This prevents
    // users from seeing the login form after Android/iOS clears cookies.
    return NextResponse.redirect(new URL('/', request.url));
  }

  const user = verifyJWT(token);
  if (!user) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // ── Role-based route protection ───────────────────────────────────────────

  if (pathname.startsWith('/client') && user.role !== 'CLIENT') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (pathname.startsWith('/companion') && user.role !== 'COMPANION') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (pathname.startsWith('/admin') && user.role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // ── CLIENT approval gate ──────────────────────────────────────────────────
  // Only applied to /client/* routes that are NOT in the exempt list.

  if (pathname.startsWith('/client')) {
    const isExempt = clientStatusExempt.some((p) => pathname.startsWith(p));

    if (!isExempt) {
      if (user.clientStatus === 'PENDING_REVIEW') {
        return NextResponse.redirect(new URL('/client/pending', request.url));
      }
      if (user.clientStatus === 'REJECTED') {
        return NextResponse.redirect(new URL('/client/rejected', request.url));
      }
      // 'APPROVED' or field absent (legacy users pre-migration) → allow through
    }
  }

  // ── Companion: force password change before any dashboard access ──────────

  if (
    user.role === 'COMPANION' &&
    user.isTemporaryPassword === true &&
    pathname.startsWith('/companion') &&
    pathname !== '/companion/change-password'
  ) {
    return NextResponse.redirect(
      new URL('/companion/change-password', request.url)
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons/).*)',
  ],
};
