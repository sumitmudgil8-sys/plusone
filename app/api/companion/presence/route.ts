import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getAblyClient } from '@/lib/ably';
import { sendPushToUser } from '@/lib/push';
import { FAVORITE_NOTIFICATION_THROTTLE_S } from '@/lib/constants';

export const runtime = 'nodejs';

// POST /api/companion/presence — companion heartbeat (online)
export async function POST(request: NextRequest) {
  const auth = requireAuth(request, ['COMPANION']);
  if (auth.user === null) return auth.response;

  const companionId = auth.user.id;

  // Fetch current state to detect offline → online transition
  const companion = await prisma.companionProfile.findUnique({
    where: { userId: companionId },
    select: { availableNow: true, name: true },
  });

  if (!companion) {
    return NextResponse.json(
      { success: false, error: 'Companion profile not found' },
      { status: 404 }
    );
  }

  const wasOffline = !companion.availableNow;

  // Update companion presence
  await prisma.companionProfile.update({
    where: { userId: companionId },
    data: { availableNow: true },
  });

  await prisma.user.update({
    where: { id: companionId },
    data: { isOnline: true, locationUpdatedAt: new Date() },
  });

  // Publish to Ably presence channel
  try {
    const ably = getAblyClient();
    const channel = ably.channels.get('companions-presence');
    await channel.publish('companion:online', {
      companionId,
      name: companion.name,
    });
  } catch (err) {
    console.error('Ably presence publish error (non-fatal):', err);
  }

  // If transitioning offline → online, notify favoriting GOLD clients
  if (wasOffline) {
    triggerFavoriteOnlineNotifications(companionId, companion.name).catch(
      (err) => console.error('Favorite-online notification error (non-fatal):', err)
    );
  }

  return NextResponse.json({ success: true, data: { availableNow: true } });
}

// DELETE /api/companion/presence — set companion offline
export async function DELETE(request: NextRequest) {
  const auth = requireAuth(request, ['COMPANION']);
  if (auth.user === null) return auth.response;

  const companionId = auth.user.id;

  await prisma.companionProfile.update({
    where: { userId: companionId },
    data: { availableNow: false },
  });

  await prisma.user.update({
    where: { id: companionId },
    data: { isOnline: false },
  });

  // Publish offline event to Ably
  try {
    const ably = getAblyClient();
    const channel = ably.channels.get('companions-presence');
    await channel.publish('companion:offline', { companionId });
  } catch (err) {
    console.error('Ably presence publish error (non-fatal):', err);
  }

  return NextResponse.json({ success: true, data: { availableNow: false } });
}

// ── Favorite-online notifications ──────────────────────────────────────────
// Fire-and-forget: finds all GOLD clients who favorited this companion and
// sends a push notification. Throttled per companion→client pair using
// Notification table timestamps.

async function triggerFavoriteOnlineNotifications(
  companionId: string,
  companionName: string
): Promise<void> {
  // Find all clients who have favorited this companion
  const favorites = await prisma.favorite.findMany({
    where: { companionId },
    select: {
      clientId: true,
      client: {
        select: { subscriptionStatus: true },
      },
    },
  });

  const throttleMs = FAVORITE_NOTIFICATION_THROTTLE_S * 1000;
  const cutoff = new Date(Date.now() - throttleMs);

  for (const fav of favorites) {
    // Only notify GOLD subscribers (subscriptionStatus === 'ACTIVE')
    if (fav.client.subscriptionStatus !== 'ACTIVE') continue;

    const clientId = fav.clientId;
    const tag = `fav-online-${companionId}-${clientId}`;

    // Throttle: check if we already sent a FAVORITE_ONLINE notification
    // for this companion→client pair within the throttle window.
    const recent = await prisma.notification.findFirst({
      where: {
        userId: clientId,
        type: 'FAVORITE_ONLINE',
        data: { contains: companionId },
        createdAt: { gte: cutoff },
      },
      select: { id: true },
    });

    if (recent) continue; // Already notified within throttle window

    // Store notification in DB (also serves as throttle record)
    await prisma.notification.create({
      data: {
        userId: clientId,
        type: 'FAVORITE_ONLINE',
        title: `${companionName} is online now`,
        message: 'Your favorite companion is available',
        data: JSON.stringify({ companionId, url: `/client/booking/${companionId}` }),
      },
    });

    // Send push notification
    await sendPushToUser(clientId, {
      title: `${companionName} is online now`,
      body: 'Your favorite companion is available',
      url: `/client/booking/${companionId}`,
      type: 'FAVORITE_ONLINE',
      tag,
    });
  }
}
