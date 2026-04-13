import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import jwt from 'jsonwebtoken';

export const runtime = 'nodejs';

const JWT_SECRET = process.env.JWT_SECRET!;

const forgotPasswordSchema = z.object({
  email: z.string().email('A valid email address is required'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = forgotPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email } = parsed.data;

    // Always return success to avoid leaking whether an email exists
    const successResponse = {
      success: true,
      message: 'If an account exists with that email, you will receive a password reset link.',
    };

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(successResponse);
    }

    // Mint a short-lived JWT for password reset (1 hour expiry)
    const resetToken = jwt.sign(
      { id: user.id, email: user.email, type: 'password_reset' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://plusone.app';
    const resetUrl = `${appUrl}/reset-password?token=${resetToken}`;

    // Always log the reset link for debugging / local development
    console.log('Password reset link:', resetUrl);

    // Attempt to send the reset email; don't break if it fails
    try {
      await sendEmail(
        email,
        'Reset your password — Plus One',
        `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1C1C1C; color: #FFFFFF; padding: 40px; border-radius: 12px;">
          <h1 style="color: #D4AF37; font-size: 28px; margin-bottom: 8px;">Password Reset</h1>
          <p style="color: #A0A0A0; margin-bottom: 24px;">Plus One</p>
          <p>Hi,</p>
          <p>We received a request to reset the password for your account. Click the button below to choose a new password.</p>
          <div style="margin: 32px 0;">
            <a href="${resetUrl}"
               style="background: #D4AF37; color: #1C1C1C; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p style="color: #A0A0A0; font-size: 14px;">This link will expire in 1 hour. If you did not request a password reset, you can safely ignore this email.</p>
          <p style="color: #A0A0A0; font-size: 14px;">— The Plus One Team</p>
        </div>
        `
      );
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);
    }

    return NextResponse.json(successResponse);
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { success: false, error: 'Something went wrong' },
      { status: 500 }
    );
  }
}
