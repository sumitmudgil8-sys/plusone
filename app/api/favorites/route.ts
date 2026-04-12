import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export const runtime = 'nodejs';

// GET /api/favorites - Get favorites for current client
export async function GET(request: NextRequest) {
  const auth = requireAuth(request, ['CLIENT']);
  if (auth.user === null) return auth.response;

  const user = auth.user;

  try {
    const { searchParams } = new URL(request.url);
    const take = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50));
    const skip = Math.max(0, parseInt(searchParams.get('offset') || '0', 10) || 0);

    const favorites = await prisma.favorite.findMany({
      where: { clientId: user.id },
      include: {
        companion: {
          include: { companionProfile: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    });

    return NextResponse.json({ favorites, hasMore: favorites.length === take });
  } catch (error) {
    console.error('Error fetching favorites:', error);
    return NextResponse.json(
      { error: 'Failed to fetch favorites' },
      { status: 500 }
    );
  }
}

// POST /api/favorites - Add a favorite
export async function POST(request: NextRequest) {
  const auth = requireAuth(request, ['CLIENT']);
  if (auth.user === null) return auth.response;

  const user = auth.user;

  try {
    const body = await request.json();
    const { companionId } = body;

    if (!companionId) {
      return NextResponse.json(
        { error: 'Companion ID is required' },
        { status: 400 }
      );
    }

    // Check if companion exists
    const companion = await prisma.user.findUnique({
      where: {
        id: companionId,
        role: 'COMPANION',
        isActive: true,
        companionProfile: { isApproved: true },
      },
    });

    if (!companion) {
      return NextResponse.json(
        { error: 'Companion not found' },
        { status: 404 }
      );
    }

    // Create or delete (toggle)
    const existing = await prisma.favorite.findUnique({
      where: {
        clientId_companionId: {
          clientId: user.id,
          companionId,
        },
      },
    });

    if (existing) {
      await prisma.favorite.delete({
        where: { id: existing.id },
      });
      return NextResponse.json({
        success: true,
        isFavorited: false,
      });
    }

    await prisma.favorite.create({
      data: {
        clientId: user.id,
        companionId,
      },
    });

    return NextResponse.json({
      success: true,
      isFavorited: true,
    });
  } catch (error) {
    console.error('Error toggling favorite:', error);
    return NextResponse.json(
      { error: 'Failed to toggle favorite' },
      { status: 500 }
    );
  }
}
