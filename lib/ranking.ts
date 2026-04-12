import { prisma } from '@/lib/prisma';
import {
  RANKING_WEIGHT_AVAILABILITY,
  RANKING_WEIGHT_QUALITY,
  RANKING_WEIGHT_RESPONSIVENESS,
  RANKING_WEIGHT_RECENCY,
  BADGE_TOP_RATED_MIN_RATING,
  BADGE_TOP_RATED_MIN_SESSIONS,
  BADGE_FAST_RESPONDER_MAX_SECONDS,
  BADGE_ELITE_MIN_SESSIONS,
  BADGE_ELITE_MIN_MONTHS,
  BADGE_RISING_STAR_MAX_DAYS,
  BADGE_RISING_STAR_MIN_RATING,
  BADGE_RISING_STAR_MIN_SESSIONS,
} from '@/lib/constants';

// ─── Scoring Functions ──────────────────────────────────────────────────────

/** Availability component (0-100). Highest weight — rewards being online. */
function scoreAvailability(availableNow: boolean, lastSeenAt: Date | null): number {
  if (availableNow) return 100;
  if (!lastSeenAt) return 0;

  const minutesAgo = (Date.now() - lastSeenAt.getTime()) / 60_000;
  if (minutesAgo < 30) return 85;
  if (minutesAgo < 120) return 60;
  if (minutesAgo < 1440) return 30;   // today
  if (minutesAgo < 4320) return 10;   // 1-3 days
  return 0;
}

/** Quality component (0-100). Rating + review volume. */
function scoreQuality(avgRating: number, ratedSessions: number): number {
  const ratingPart = (avgRating / 5.0) * 70;
  const volumePart = Math.min(ratedSessions / 50, 1.0) * 30;
  return ratingPart + volumePart;
}

/** Responsiveness component (0-100). How fast companion accepts sessions. */
function scoreResponsiveness(avgResponseTimeSeconds: number | null): number {
  if (avgResponseTimeSeconds === null) return 50; // neutral for new companions
  if (avgResponseTimeSeconds < 15) return 100;
  if (avgResponseTimeSeconds < 30) return 90;
  if (avgResponseTimeSeconds < 60) return 75;
  if (avgResponseTimeSeconds < 120) return 50;
  if (avgResponseTimeSeconds < 300) return 25;
  return 0;
}

/** Recency component (0-100). How recently the companion had a session. */
function scoreRecency(lastSessionAt: Date | null): number {
  if (!lastSessionAt) return 0;

  const hoursAgo = (Date.now() - lastSessionAt.getTime()) / 3_600_000;
  if (hoursAgo < 4) return 100;
  if (hoursAgo < 12) return 80;
  if (hoursAgo < 24) return 60;
  if (hoursAgo < 72) return 30;
  if (hoursAgo < 168) return 10;
  return 0;
}

/** Compute overall ranking score (0-100). */
export function computeRankingScore(params: {
  availableNow: boolean;
  lastSeenAt: Date | null;
  avgRating: number;
  ratedSessions: number;
  avgResponseTimeSeconds: number | null;
  lastSessionAt: Date | null;
}): number {
  const a = scoreAvailability(params.availableNow, params.lastSeenAt);
  const q = scoreQuality(params.avgRating, params.ratedSessions);
  const r = scoreResponsiveness(params.avgResponseTimeSeconds);
  const c = scoreRecency(params.lastSessionAt);

  return (
    a * RANKING_WEIGHT_AVAILABILITY +
    q * RANKING_WEIGHT_QUALITY +
    r * RANKING_WEIGHT_RESPONSIVENESS +
    c * RANKING_WEIGHT_RECENCY
  );
}

// ─── Badge Logic ────────────────────────────────────────────────────────────

export type BadgeType = 'TOP_RATED' | 'FAST_RESPONDER' | 'ELITE' | 'RISING_STAR';

interface BadgeEligibility {
  type: BadgeType;
  eligible: boolean;
}

export function evaluateBadges(params: {
  avgRating: number;
  ratedSessions: number;
  avgResponseTimeSeconds: number | null;
  totalSessions: number;
  createdAt: Date;
}): BadgeEligibility[] {
  const { avgRating, ratedSessions, avgResponseTimeSeconds, totalSessions, createdAt } = params;

  const monthsActive = (Date.now() - createdAt.getTime()) / (30 * 24 * 3600_000);
  const daysActive = (Date.now() - createdAt.getTime()) / (24 * 3600_000);

  const isTopRated =
    avgRating >= BADGE_TOP_RATED_MIN_RATING &&
    ratedSessions >= BADGE_TOP_RATED_MIN_SESSIONS;

  const isFastResponder =
    avgResponseTimeSeconds !== null &&
    avgResponseTimeSeconds <= BADGE_FAST_RESPONDER_MAX_SECONDS &&
    totalSessions >= 10; // need at least 10 sessions for meaningful avg

  const isElite =
    isTopRated &&
    isFastResponder &&
    totalSessions >= BADGE_ELITE_MIN_SESSIONS &&
    monthsActive >= BADGE_ELITE_MIN_MONTHS;

  const isRisingStar =
    daysActive <= BADGE_RISING_STAR_MAX_DAYS &&
    avgRating >= BADGE_RISING_STAR_MIN_RATING &&
    ratedSessions >= BADGE_RISING_STAR_MIN_SESSIONS;

  return [
    { type: 'TOP_RATED', eligible: isTopRated },
    { type: 'FAST_RESPONDER', eligible: isFastResponder },
    { type: 'ELITE', eligible: isElite },
    { type: 'RISING_STAR', eligible: isRisingStar },
  ];
}

// ─── Batch Update (used by cron) ────────────────────────────────────────────

/** Recompute ranking scores and badges for all active companions. */
export async function recomputeAllRankings(): Promise<{ updated: number }> {
  const companions = await prisma.companionProfile.findMany({
    where: { isApproved: true },
    select: {
      userId: true,
      availableNow: true,
      averageRating: true,
      totalRatedSessions: true,
      avgResponseTime: true,
      lastSessionAt: true,
      user: { select: { isOnline: true, createdAt: true, locationUpdatedAt: true } },
    },
  });

  // Count total sessions per companion in one query
  const sessionCounts = await prisma.billingSession.groupBy({
    by: ['companionId'],
    where: { status: 'ENDED' },
    _count: { id: true },
  });
  const sessionCountMap = new Map(sessionCounts.map((s) => [s.companionId, s._count.id]));

  let updated = 0;

  for (const cp of companions) {
    const totalSessions = sessionCountMap.get(cp.userId) ?? 0;

    // Use locationUpdatedAt as a proxy for "last seen" (heartbeat updates this)
    const lastSeenAt = cp.user.locationUpdatedAt ?? (cp.user.isOnline ? new Date() : null);

    const score = computeRankingScore({
      availableNow: cp.availableNow,
      lastSeenAt,
      avgRating: cp.averageRating,
      ratedSessions: cp.totalRatedSessions,
      avgResponseTimeSeconds: cp.avgResponseTime,
      lastSessionAt: cp.lastSessionAt,
    });

    // Evaluate badges
    const badgeResults = evaluateBadges({
      avgRating: cp.averageRating,
      ratedSessions: cp.totalRatedSessions,
      avgResponseTimeSeconds: cp.avgResponseTime,
      totalSessions,
      createdAt: cp.user.createdAt,
    });

    // Update ranking score
    await prisma.companionProfile.update({
      where: { userId: cp.userId },
      data: { rankingScore: Math.round(score * 100) / 100 },
    });

    // Upsert badges
    for (const badge of badgeResults) {
      const existing = await prisma.companionBadge.findUnique({
        where: { companionId_type: { companionId: cp.userId, type: badge.type } },
      });

      if (badge.eligible && !existing) {
        // Earned new badge
        await prisma.companionBadge.create({
          data: { companionId: cp.userId, type: badge.type, isActive: true },
        });
      } else if (badge.eligible && existing && !existing.isActive) {
        // Re-earned lost badge
        await prisma.companionBadge.update({
          where: { id: existing.id },
          data: { isActive: true, lostAt: null, earnedAt: new Date() },
        });
      } else if (!badge.eligible && existing?.isActive) {
        // Lost badge
        await prisma.companionBadge.update({
          where: { id: existing.id },
          data: { isActive: false, lostAt: new Date() },
        });
      }
    }

    updated++;
  }

  return { updated };
}
