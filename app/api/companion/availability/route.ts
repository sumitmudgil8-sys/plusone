import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

// POST /api/companion/availability — toggle isOnline; optionally update location
export async function POST(request: NextRequest) {
  const auth = requireAuth(request, ['COMPANION']);
  if (auth.user === null) return auth.response;

  // Body is optional — lat/lng may be provided when going online
  let latitude: number | undefined;
  let longitude: number | undefined;
  try {
    const body = await request.json();
    if (typeof body.latitude === 'number' && typeof body.longitude === 'number') {
      latitude = body.latitude;
      longitude = body.longitude;
    }
  } catch {
    // No body or invalid JSON — proceed without location
  }

  const current = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { isOnline: true },
  });

  if (!current) {
    return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
  }

  const goingOnline = !current.isOnline;

  const updateData: {
    isOnline: boolean;
    latitude?: number;
    longitude?: number;
    locationUpdatedAt?: Date;
  } = { isOnline: goingOnline };

  if (goingOnline && latitude !== undefined && longitude !== undefined) {
    updateData.latitude = latitude;
    updateData.longitude = longitude;
    updateData.locationUpdatedAt = new Date();
  }

  await prisma.user.update({
    where: { id: auth.user.id },
    data: updateData,
  });

  await prisma.companionProfile.update({
    where: { userId: auth.user.id },
    data: {
      availabilityStatus: goingOnline ? 'ONLINE' : 'OFFLINE',
    },
  });

  return NextResponse.json({ success: true, data: { isOnline: goingOnline } });
}
