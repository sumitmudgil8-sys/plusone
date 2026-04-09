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
  clientStatus?: string; // 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' — only set for CLIENTs
  iat?: number;
  exp?: number;
}

export function signJWT(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '365d' });
}

export function verifyJWT(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
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
    maxAge: 60 * 60 * 24 * 365, // 1 year
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
  return jwt.sign({ ...payload, type: 'refresh' }, JWT_SECRET, { expiresIn: '365d' });
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
