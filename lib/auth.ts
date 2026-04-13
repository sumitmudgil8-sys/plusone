import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set');
}
const JWT_SECRET: string = process.env.JWT_SECRET;

export interface JWTPayload {
  id: string;
  email: string;
  role: string;
  isTemporaryPassword?: boolean;
  hasCompletedOnboarding?: boolean;
  clientStatus?: string; // 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' — only set for CLIENTs
  iat?: number;
  exp?: number;
}

// Access tokens are short-lived; the long-lived refresh token (below)
// silently re-mints them via /api/session POST. This limits the exploit
// window of a stolen cookie while preserving persistent-login UX.
const ACCESS_TOKEN_TTL_SECONDS = 24 * 60 * 60; // 24 hours
const REFRESH_TOKEN_TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days
// Bcrypt cost — 12 is the current OWASP recommendation for password hashing.
// 10 → 12 ≈ 4× slower verification; still well under 300ms on modern hardware.
const BCRYPT_ROUNDS = 12;

export { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS };

export function signJWT(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL_SECONDS });
}

export function verifyJWT(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function getAuthToken(request: NextRequest): string | null {
  const token = request.cookies.get('token')?.value;
  return token || null;
}

export function requireAuth(
  request: NextRequest,
  allowedRoles?: string[]
): { user: JWTPayload; response?: NextResponse } | { user: null; response: NextResponse } {
  const token = getAuthToken(request);

  if (!token) {
    return {
      user: null,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const user = verifyJWT(token);

  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ error: 'Invalid token' }, { status: 401 }),
    };
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return {
      user: null,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return { user };
}

export function setAuthCookie(response: NextResponse, token: string): NextResponse {
  response.cookies.set({
    name: 'token',
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    // Cookie maxAge matches the access-token TTL. The localStorage refresh
    // token (/api/session POST) silently re-issues a new cookie on app
    // open once the old one is gone.
    maxAge: ACCESS_TOKEN_TTL_SECONDS,
    path: '/',
  });
  return response;
}

export function clearAuthCookie(response: NextResponse): NextResponse {
  response.cookies.set({
    name: 'token',
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',  // Must match setAuthCookie's sameSite to properly clear
    maxAge: 0,
    path: '/',
  });
  return response;
}
export function verifyToken(token: string): JWTPayload | null {
  return verifyJWT(token);
}

// ── Refresh tokens ────────────────────────────────────────────────────────
// Stored in localStorage by the client; used to silently restore the
// httpOnly auth cookie when Android/Samsung clears browser cookie storage.

interface RefreshPayload {
  id: string;
  role: string;
  type: 'refresh';
  iat?: number;
  exp?: number;
}

export function signRefreshToken(payload: { id: string; role: string }): string {
  return jwt.sign({ ...payload, type: 'refresh' }, JWT_SECRET, {
    expiresIn: REFRESH_TOKEN_TTL_SECONDS,
  });
}

export function verifyRefreshToken(token: string): { id: string; role: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as RefreshPayload;
    if (decoded.type !== 'refresh') return null;
    return { id: decoded.id, role: decoded.role };
  } catch {
    return null;
  }
}
