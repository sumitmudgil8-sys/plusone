import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { hashPassword, signJWT, setAuthCookie } from '@/lib/auth';
import { signupLimiter, getClientIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Enter a valid email address'),
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  linkedInUrl: z
    .string()
    .url('Enter a valid URL')
    .refine((url) => url.includes('linkedin.com'), {
      message: 'Must be a LinkedIn profile URL (linkedin.com)',
    }),
  dateOfBirth: z.string().refine((val) => {
    const d = new Date(val);
    if (isNaN(d.getTime())) return false;
    // Must be at least 18 years old
    const age = (Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
    return age >= 18;
  }, { message: 'You must be at least 18 years old' }),
});

// POST /api/auth/signup
// Creates a client account with PENDING_REVIEW status.
// Issues a JWT so the user can immediately proceed to ID upload.
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rl = signupLimiter.check(`signup:${ip}`);
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many signup attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
      );
    }

    const body = await request.json();
    const parsed = signupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { name, email, phone, password, linkedInUrl, dateOfBirth } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'An account with this email already exists' },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);

    // Create User (PENDING_REVIEW) + ClientProfile + empty Wallet atomically
    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          email,
          passwordHash,
          role: 'CLIENT',
          clientStatus: 'PENDING_REVIEW',
          phone,
          linkedInUrl,
          clientProfile: {
            create: {
              name,
              dateOfBirth: new Date(dateOfBirth),
              bio: '',
              lat: 28.6139,
              lng: 77.209,
            },
          },
        },
      });

      await tx.wallet.create({
        data: { userId: u.id, balance: 0 },
      });

      return u;
    });

    const token = signJWT({
      id: user.id,
      email: user.email,
      role: user.role,
      isTemporaryPassword: false,
      clientStatus: 'PENDING_REVIEW',
    });

    const response = NextResponse.json({
      success: true,
      message: 'Account created. Your application is under review.',
    });

    return setAuthCookie(response, token);
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { success: false, error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
