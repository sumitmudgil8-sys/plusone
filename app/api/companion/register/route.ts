import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { hashPassword, signJWT, setAuthCookie } from '@/lib/auth';

export const runtime = 'nodejs';

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  phone: z.string().optional(),
});

// POST /api/companion/register
// Self-registration for companions. Account is created with isApproved: false.
// Admin must approve before the profile becomes visible to clients.
export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { email, password, name, phone } = parsed.data;

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'An account with this email already exists' },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: 'COMPANION',
        companionProfile: {
          create: {
            name,
            bio: '',
            hourlyRate: 2000,
            lat: 28.6139,
            lng: 77.2090,
            isApproved: false,
            verificationStatus: 'PENDING',
            availability: '[]',
            images: '[]',
            languages: '[]',
            interests: '[]',
          },
        },
      },
      include: { companionProfile: true },
    });

    // Store phone on profile if provided
    if (phone) {
      // CompanionProfile doesn't have a phone field — store in ClientProfile not applicable.
      // Phone can be added via onboarding; skip silently for now.
    }

    const token = signJWT({ id: user.id, email: user.email, role: user.role });

    const response = NextResponse.json(
      {
        success: true,
        data: {
          id: user.id,
          email: user.email,
          role: user.role,
          name,
        },
      },
      { status: 201 }
    );

    return setAuthCookie(response, token);
  } catch (error) {
    console.error('Companion register error:', error);
    return NextResponse.json(
      { success: false, error: 'Registration failed' },
      { status: 500 }
    );
  }
}
