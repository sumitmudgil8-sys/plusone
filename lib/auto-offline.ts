import { prisma } from '@/lib/prisma';
import { AUTO_OFFLINE_MINUTES } from '@/lib/constants';

/**
 * Lazy auto-offline: marks companions as unavailable if they haven't
 * sent a heartbeat in AUTO_OFFLINE_MINUTES.
 *
 * Called from hot-path read APIs (sections, browse) so no cron is needed.
 * Uses updateMany which is a single DB round-trip — very cheap.
 *
 * Returns the number of companions marked offline.
 */
export async function markStaleCompanionsOffline(): Promise<number> {
  const cutoff = new Date(Date.now() - AUTO_OFFLINE_MINUTES * 60_000);

  // Find companions who are "available now" but haven't heartbeated recently
  const result = await prisma.user.updateMany({
    where: {
      role: 'COMPANION',
      isOnline: true,
      companionProfile: { availableNow: true },
      OR: [
        { locationUpdatedAt: { lt: cutoff } },
        { locationUpdatedAt: null },
      ],
    },
    data: { isOnline: false },
  });

  // Also flip availableNow on the companion profiles
  if (result.count > 0) {
    await prisma.companionProfile.updateMany({
      where: {
        availableNow: true,
        user: {
          isOnline: false,
          OR: [
            { locationUpdatedAt: { lt: cutoff } },
            { locationUpdatedAt: null },
          ],
        },
      },
      data: { availableNow: false },
    });
  }

  return result.count;
}
