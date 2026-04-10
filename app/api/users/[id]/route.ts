import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export const runtime = 'nodejs';

// GET /api/users/[id] - Get user profile
//
// Privacy guard: self or admin get the full profile. All other authenticated
// callers get a scoped public view (id, role, display name, avatar only).
// The companion inbox legitimately needs to resolve client display info for
// active threads, so we don't 403 cross-user reads — we just strip
// sensitive fields (email, phone, LinkedIn, status, etc.).
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = requireAuth(request);
  if (auth.user === null) return auth.response;

  const { id } = params;
  const isSelfOrAdmin = auth.user.id === id || auth.user.role === 'ADMIN';

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        clientProfile: true,
        companionProfile: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (!isSelfOrAdmin) {
      // Public / cross-user view — only display identity, no sensitive fields.
      return NextResponse.json({
        user: {
          id: user.id,
          role: user.role,
          clientProfile: user.clientProfile
            ? {
                name: user.clientProfile.name,
                avatarUrl: user.clientProfile.avatarUrl,
              }
            : null,
          companionProfile: user.companionProfile
            ? {
                name: user.companionProfile.name,
                avatarUrl: user.companionProfile.avatarUrl,
              }
            : null,
        },
      });
    }

    // Remove password hash from response
    const { passwordHash, ...userWithoutPassword } = user;

    return NextResponse.json({ user: userWithoutPassword });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    );
  }
}

// PATCH /api/users/[id] - Update user profile
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = requireAuth(request);
  if (auth.user === null) return auth.response;

  const currentUser = auth.user;
  const { id } = params;

  // Only allow updating own profile
  if (currentUser.id !== id && currentUser.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { name, bio, avatarUrl, lat, lng, availability, images, hourlyRate } = body;

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        clientProfile: true,
        companionProfile: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Update profile based on role
    if (user.role === 'CLIENT' && user.clientProfile) {
      await prisma.clientProfile.update({
        where: { userId: id },
        data: {
          name: name || undefined,
          bio: bio !== undefined ? bio : undefined,
          avatarUrl: avatarUrl !== undefined ? avatarUrl : undefined,
          lat: lat !== undefined ? lat : undefined,
          lng: lng !== undefined ? lng : undefined,
        },
      });
    } else if (user.role === 'COMPANION' && user.companionProfile) {
      await prisma.companionProfile.update({
        where: { userId: id },
        data: {
          name: name || undefined,
          bio: bio !== undefined ? bio : undefined,
          avatarUrl: avatarUrl !== undefined ? avatarUrl : undefined,
          lat: lat !== undefined ? lat : undefined,
          lng: lng !== undefined ? lng : undefined,
          availability: availability !== undefined ? availability : undefined,
          images: images !== undefined ? images : undefined,
          hourlyRate: hourlyRate !== undefined ? hourlyRate : undefined,
        },
      });
    }

    // Fetch updated user
    const updatedUser = await prisma.user.findUnique({
      where: { id },
      include: {
        clientProfile: true,
        companionProfile: true,
      },
    });

    const { passwordHash, ...userWithoutPassword } = updatedUser!;

    return NextResponse.json({ user: userWithoutPassword });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}
