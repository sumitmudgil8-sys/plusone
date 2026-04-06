import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { comparePassword, signJWT } from '@/lib/auth';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        clientProfile: true,
        companionProfile: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    if (user.isBanned) {
      return NextResponse.json(
        { error: 'Your account has been suspended' },
        { status: 403 }
      );
    }

    const isValidPassword = await comparePassword(password, user.passwordHash);
    if (!isValidPassword) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Build JWT payload — include clientStatus for CLIENT users so middleware
    // can gate access without a DB lookup on every request.
    const jwtPayload: Parameters<typeof signJWT>[0] = {
      id: user.id,
      email: user.email,
      role: user.role,
      isTemporaryPassword: user.isTemporaryPassword,
      ...(user.role === 'CLIENT' && { clientStatus: user.clientStatus }),
    };

    const token = signJWT(jwtPayload);

    const name =
      user.clientProfile?.name ?? user.companionProfile?.name ?? 'User';

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        subscriptionTier: user.subscriptionTier,
        name,
        isTemporaryPassword: user.isTemporaryPassword,
        ...(user.role === 'CLIENT' && { clientStatus: user.clientStatus }),
      },
    });

    const cookieStore = cookies();
    cookieStore.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days — persistent across browser restarts
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
