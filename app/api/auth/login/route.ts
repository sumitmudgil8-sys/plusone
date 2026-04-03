import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { comparePassword, signJWT } from '@/lib/auth';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        clientProfile: true,
        companionProfile: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Check if user is banned
    if (user.isBanned) {
      return NextResponse.json(
        { error: 'Your account has been banned' },
        { status: 403 }
      );
    }

    // Verify password
    const isValidPassword = await comparePassword(
      password,
      user.passwordHash
    );

    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Generate JWT
    const token = signJWT({
      id: user.id,
      email: user.email,
      role: user.role,
      isTemporaryPassword: user.isTemporaryPassword,
    });

    // Get name safely
    const name =
      user.clientProfile?.name ||
      user.companionProfile?.name ||
      'User';

    // Create response
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        subscriptionTier: user.subscriptionTier,
        name,
        isTemporaryPassword: user.isTemporaryPassword,
      },
    });

    // ✅ SET COOKIE (THIS WAS MISSING)
    const cookieStore = cookies();

    cookieStore.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'lax',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    );
  }
}