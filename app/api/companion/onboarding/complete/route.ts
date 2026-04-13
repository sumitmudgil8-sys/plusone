import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, signJWT, setAuthCookie } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

// POST /api/companion/onboarding/complete
// Marks the companion's onboarding tour as completed and re-issues JWT
export async function POST(request: NextRequest) {
  const auth = requireAuth(request, ['COMPANION']);
  if (auth.user === null) return auth.response;

  const { user } = auth;

  await prisma.user.update({
    where: { id: user.id },
    data: { hasCompletedOnboarding: true },
  });

  // Re-issue JWT with updated hasCompletedOnboarding
  const jwtPayload: Parameters<typeof signJWT>[0] = {
    id: user.id,
    email: user.email,
    role: user.role,
    isTemporaryPassword: false,
    hasCompletedOnboarding: true,
  };

  const newToken = signJWT(jwtPayload);
  const response = NextResponse.json({ success: true });
  setAuthCookie(response, newToken);
  return response;
}
