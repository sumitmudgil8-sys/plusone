import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import jwt from 'jsonwebtoken';

export const runtime = 'nodejs';

const JWT_SECRET = process.env.JWT_SECRET!;

interface PasswordResetPayload {
  id: string;
  email: string;
  type: string;
  iat: number;
  exp: number;
}

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = resetPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { token, password } = parsed.data;

    // Verify the reset token
    let payload: PasswordResetPayload;
    try {
      payload = jwt.verify(token, JWT_SECRET) as PasswordResetPayload;
    } catch {
      return NextResponse.json(
        { success: false, error: 'Reset link is invalid or has expired. Please request a new one.' },
        { status: 400 }
      );
    }

    // Ensure this is actually a password reset token
    if (payload.type !== 'password_reset') {
      return NextResponse.json(
        { success: false, error: 'Reset link is invalid or has expired. Please request a new one.' },
        { status: 400 }
      );
    }

    // Look up the user by id from the token
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Reset link is invalid or has expired. Please request a new one.' },
        { status: 400 }
      );
    }

    // Hash the new password and update
    const newHash = await hashPassword(password);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash, isTemporaryPassword: false },
    });

    return NextResponse.json({
      success: true,
      message: 'Password has been reset. You can now sign in.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { success: false, error: 'Something went wrong' },
      { status: 500 }
    );
  }
}
