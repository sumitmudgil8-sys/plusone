import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, signJWT, signRefreshToken, verifyRefreshToken, setAuthCookie } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

// GET /api/session
// Requires a valid auth cookie. Re-issues the cookie with a fresh 30-day
// maxAge (sliding window) and returns a new 90-day refresh token for
// localStorage storage. Called once per app open from layouts.
export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth.user === null) return auth.response;

  const { user } = auth;

  const jwtPayload: Parameters<typeof signJWT>[0] = {
    id: user.id,
    email: user.email,
    role: user.role,
    isTemporaryPassword: user.isTemporaryPassword,
    ...(user.role === 'CLIENT' && { clientStatus: user.clientStatus }),
  };

  const newToken = signJWT(jwtPayload);
  const refreshToken = signRefreshToken({ id: user.id, role: user.role });

  const response = NextResponse.json({ success: true, refreshToken });
  setAuthCookie(response, newToken);
  return response;
}

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

// POST /api/session
// Body: { refreshToken: string }
// Validates the localStorage refresh token (no cookie required) and issues
// a fresh httpOnly auth cookie. Used by SessionRestorer when the cookie is
// missing — e.g. after Samsung's aggressive memory management clears it.
export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = refreshSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const payload = verifyRefreshToken(parsed.data.refreshToken);
  if (!payload) {
    return NextResponse.json({ error: 'Invalid or expired refresh token' }, { status: 401 });
  }

  // Re-fetch user to ensure account is still active and not banned
  const user = await prisma.user.findUnique({
    where: { id: payload.id },
    include: { clientProfile: true },
  });

  if (!user || !user.isActive || user.isBanned) {
    return NextResponse.json({ error: 'Account unavailable' }, { status: 401 });
  }

  const jwtPayload: Parameters<typeof signJWT>[0] = {
    id: user.id,
    email: user.email,
    role: user.role,
    isTemporaryPassword: user.isTemporaryPassword,
    ...(user.role === 'CLIENT' && { clientStatus: user.clientStatus }),
  };

  const newToken = signJWT(jwtPayload);
  const newRefreshToken = signRefreshToken({ id: user.id, role: user.role });

  const response = NextResponse.json({
    success: true,
    refreshToken: newRefreshToken,
    user: { role: user.role },
  });
  setAuthCookie(response, newToken);
  return response;
}
