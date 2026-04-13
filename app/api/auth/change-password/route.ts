import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, comparePassword, hashPassword, signJWT, setAuthCookie } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
  confirmPassword: z.string().min(1, 'Confirm password is required'),
});

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth.user === null) return auth.response;

  const { user } = auth;

  const body = await request.json();
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { currentPassword, newPassword, confirmPassword } = parsed.data;

  if (newPassword !== confirmPassword) {
    return NextResponse.json(
      { success: false, error: 'New passwords do not match' },
      { status: 400 }
    );
  }

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser) {
    return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
  }

  const isValid = await comparePassword(currentPassword, dbUser.passwordHash);
  if (!isValid) {
    return NextResponse.json(
      { success: false, error: 'Current password is incorrect' },
      { status: 401 }
    );
  }

  const newHash = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: newHash, isTemporaryPassword: false },
  });

  // Issue a fresh JWT with isTemporaryPassword: false
  const newToken = signJWT({
    id: user.id,
    email: user.email,
    role: user.role,
    isTemporaryPassword: false,
    ...(user.role === 'COMPANION' && { hasCompletedOnboarding: dbUser.hasCompletedOnboarding }),
  });

  const response = NextResponse.json({ success: true });
  setAuthCookie(response, newToken);
  return response;
}
