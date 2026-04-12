import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { calculateDistance } from '@/lib/utils';
import { MAX_FREE_COMPANIONS } from '@/lib/constants';

export const runtime = 'nodejs';

// ── Zod schema for query params ─────────────────────────────────────────────
const conciergeQuerySchema = z.object({
  intent: z.string().min(1, 'intent is required').max(500),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

// ── Keyword dictionaries ────────────────────────────────────────────────────

const TIME_KEYWORDS: Record<string, string[]> = {
  MORNING: ['morning', 'sunrise', 'early'],
  AFTERNOON: ['afternoon', 'lunch', 'midday', 'noon'],
  EVENING: ['evening', 'tonight', 'dinner', 'sunset', 'dusk'],
  NIGHT: ['night', 'late', 'midnight'],
};

const ACTIVITY_KEYWORDS: Record<string, string[]> = {
  chat: ['chat', 'talk', 'conversation', 'text', 'message', 'messaging'],
  call: ['call', 'voice', 'phone', 'audio', 'speak'],
};

const QUALITY_KEYWORDS = ['best', 'top', 'premium', 'elite', 'highest', 'rated', 'popular', 'recommended'];

const LANGUAGE_KEYWORDS = [
  'english', 'hindi', 'tamil', 'telugu', 'bengali', 'marathi',
  'gujarati', 'punjabi', 'urdu', 'kannada', 'malayalam',
];

const GENDER_KEYWORDS: Record<string, string[]> = {
  Male: ['male', 'man', 'guy', 'gentleman', 'boy'],
  Female: ['female', 'woman', 'girl', 'lady'],
};

// ── Intent parser ───────────────────────────────────────────────────────────

interface ParsedIntent {
  timeSlots: string[];
  activity: 'chat' | 'call' | null;
  preferQuality: boolean;
  traits: string[];
  languages: string[];
  gender: string | null;
}

function parseIntent(intent: string): ParsedIntent {
  const lower = intent.toLowerCase();
  const words = lower.split(/[\s,;.!?]+/).filter(Boolean);

  // Time slots
  const timeSlots: string[] = [];
  for (const [slot, keywords] of Object.entries(TIME_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      timeSlots.push(slot);
    }
  }

  // Activity preference
  let activity: 'chat' | 'call' | null = null;
  for (const [act, keywords] of Object.entries(ACTIVITY_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      activity = act as 'chat' | 'call';
      break; // first match wins — chat before call
    }
  }

  // Quality preference
  const preferQuality = QUALITY_KEYWORDS.some((kw) => lower.includes(kw));

  // Languages
  const languages = LANGUAGE_KEYWORDS.filter((lang) => lower.includes(lang));

  // Gender
  let gender: string | null = null;
  for (const [g, keywords] of Object.entries(GENDER_KEYWORDS)) {
    if (keywords.some((kw) => words.includes(kw))) {
      gender = g;
      break;
    }
  }

  // Trait keywords — everything that isn't a recognized keyword above becomes
  // a candidate for matching against personalityTags / interests.
  const reservedWords = new Set([
    ...Object.values(TIME_KEYWORDS).flat(),
    ...Object.values(ACTIVITY_KEYWORDS).flat(),
    ...QUALITY_KEYWORDS,
    ...LANGUAGE_KEYWORDS,
    ...Object.values(GENDER_KEYWORDS).flat(),
    // Common stop words
    'a', 'an', 'the', 'to', 'for', 'in', 'on', 'with', 'and', 'or', 'is',
    'who', 'someone', 'looking', 'need', 'want', 'find', 'me', 'my', 'i',
    'can', 'that', 'this', 'some', 'like', 'would', 'could', 'please',
    'companion', 'partner', 'person', 'one', 'plus',
  ]);

  const traits = words.filter(
    (w) => w.length >= 3 && !reservedWords.has(w)
  );

  return { timeSlots, activity, preferQuality, traits, languages, gender };
}

// ── Companion card select (mirrors sections API) ────────────────────────────

const companionCardSelect = {
  id: true,
  companionProfile: {
    select: {
      name: true,
      bio: true,
      tagline: true,
      avatarUrl: true,
      hourlyRate: true,
      chatRatePerMinute: true,
      callRatePerMinute: true,
      isVerified: true,
      averageRating: true,
      reviewCount: true,
      rankingScore: true,
      availableNow: true,
      availabilityStatus: true,
      gender: true,
      age: true,
      city: true,
      lat: true,
      lng: true,
      personalityTags: true,
      interests: true,
      languages: true,
      audioIntroUrl: true,
      weeklyAvailability: true,
      lastSessionAt: true,
      badges: {
        where: { isActive: true },
        select: { type: true },
      },
    },
  },
  companionImages: {
    where: { isPrimary: true },
    take: 1,
    select: { imageUrl: true },
  },
} as const;

type CompanionRow = Awaited<
  ReturnType<typeof prisma.user.findMany<{ select: typeof companionCardSelect }>>
>[0];

// ── Scoring engine ──────────────────────────────────────────────────────────

function scoreCompanion(
  c: CompanionRow,
  parsed: ParsedIntent,
  clientLat: number,
  clientLng: number,
): number {
  const p = c.companionProfile!;
  let score = 0;

  // 1. Availability boost (currently online = big bonus)
  if (p.availableNow) score += 25;

  // 2. Time-slot matching via weeklyAvailability
  if (parsed.timeSlots.length > 0) {
    try {
      const weekly: Record<string, string[]> = JSON.parse(p.weeklyAvailability || '{}');
      const allSlots = Object.values(weekly).flat().map((s) => s.toUpperCase());
      for (const slot of parsed.timeSlots) {
        if (allSlots.includes(slot)) {
          score += 15;
          break; // one match is enough
        }
      }
    } catch {
      // invalid JSON — skip
    }
  }

  // 3. Activity-based rate sorting (lower rate = better value = higher score)
  if (parsed.activity === 'chat' && p.chatRatePerMinute != null) {
    // Invert: cheaper chat rate → higher score (0–10 range)
    score += Math.max(0, 10 - (p.chatRatePerMinute / 1000));
  } else if (parsed.activity === 'call' && p.callRatePerMinute != null) {
    score += Math.max(0, 10 - (p.callRatePerMinute / 1000));
  }

  // 4. Quality preference
  if (parsed.preferQuality) {
    score += (p.rankingScore ?? 0) * 0.3; // rankingScore is 0-100 → max +30
  }

  // 5. Base ranking score contribution (always matters a little)
  score += (p.rankingScore ?? 0) * 0.1;

  // 6. Trait matching against personalityTags and interests
  if (parsed.traits.length > 0) {
    const tags: string[] = safeJsonArray(p.personalityTags);
    const interests: string[] = safeJsonArray(p.interests);
    const allTraits = [...tags, ...interests].map((t) => t.toLowerCase());

    for (const trait of parsed.traits) {
      if (allTraits.some((t) => t.includes(trait) || trait.includes(t))) {
        score += 12;
      }
    }
  }

  // 7. Language matching
  if (parsed.languages.length > 0) {
    const companionLangs: string[] = safeJsonArray(p.languages).map((l) => l.toLowerCase());
    for (const lang of parsed.languages) {
      if (companionLangs.includes(lang)) {
        score += 20;
      }
    }
  }

  // 8. Gender filter bonus (exact match gets a big boost; mismatch is handled
  //    by the filter, but we add score for sorting stability)
  if (parsed.gender && p.gender) {
    if (p.gender.toLowerCase() === parsed.gender.toLowerCase()) {
      score += 10;
    }
  }

  // 9. Distance penalty (closer is better) — only when client location known
  if (clientLat !== 0 && clientLng !== 0) {
    const dist = calculateDistance(clientLat, clientLng, p.lat, p.lng);
    // Companions within 10km get full bonus; beyond 100km get 0
    score += Math.max(0, 10 - dist / 10);
  }

  // 10. Rating bonus
  if (p.averageRating > 0) {
    score += p.averageRating * 2; // max +10 for 5.0 rating
  }

  // 11. Verified bonus
  if (p.isVerified) score += 5;

  return score;
}

function safeJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === 'string');
    return [];
  } catch {
    return [];
  }
}

// ── Map to card shape (same as sections API) ────────────────────────────────

function mapCompanionCard(
  c: CompanionRow,
  clientLat: number,
  clientLng: number,
  isSubscribed: boolean,
  index: number,
  favoriteSet: Set<string>,
  intentScore: number,
) {
  const p = c.companionProfile!;
  return {
    id: c.id,
    name: p.name,
    tagline: p.tagline,
    bio: p.bio,
    avatarUrl: p.avatarUrl,
    primaryImageUrl: c.companionImages[0]?.imageUrl ?? null,
    hourlyRatePaise: p.hourlyRate,
    chatRatePerMinute: p.chatRatePerMinute,
    callRatePerMinute: p.callRatePerMinute,
    isVerified: p.isVerified,
    averageRating: p.averageRating,
    reviewCount: p.reviewCount,
    rankingScore: p.rankingScore,
    availableNow: p.availableNow,
    availabilityStatus: p.availabilityStatus,
    gender: p.gender,
    age: p.age,
    city: p.city,
    personalityTags: JSON.parse(p.personalityTags || '[]') as string[],
    interests: JSON.parse(p.interests || '[]') as string[],
    audioIntroUrl: p.audioIntroUrl,
    badges: p.badges.map((b) => b.type),
    distance: calculateDistance(clientLat, clientLng, p.lat, p.lng),
    isFavorited: favoriteSet.has(c.id),
    accessible: isSubscribed || index < MAX_FREE_COMPANIONS,
    intentScore: Math.round(intentScore * 10) / 10,
  };
}

// ── GET handler ─────────────────────────────────────────────────────────────

const MAX_CONCIERGE_RESULTS = 10;
const MAX_FREE_CONCIERGE_RESULTS = 3;

export async function GET(request: NextRequest) {
  const auth = requireAuth(request, ['CLIENT']);
  if (auth.user === null) return auth.response;

  const user = auth.user;
  const { searchParams } = new URL(request.url);

  // Validate query params
  const parseResult = conciergeQuerySchema.safeParse({
    intent: searchParams.get('intent'),
    lat: searchParams.get('lat') ?? undefined,
    lng: searchParams.get('lng') ?? undefined,
  });

  if (!parseResult.success) {
    return NextResponse.json(
      { success: false, error: parseResult.error.issues[0]?.message ?? 'Invalid query params' },
      { status: 400 },
    );
  }

  const { intent, lat: queryLat, lng: queryLng } = parseResult.data;

  try {
    // Parse intent into structured keywords
    const parsed = parseIntent(intent);

    // Parallel lookups for client context
    const [clientProfile, clientUser, favorites, rejectedIds] = await Promise.all([
      prisma.clientProfile.findUnique({
        where: { userId: user.id },
        select: { lat: true, lng: true },
      }),
      prisma.user.findUnique({
        where: { id: user.id },
        select: { subscriptionStatus: true, subscriptionExpiresAt: true },
      }),
      prisma.favorite.findMany({
        where: { clientId: user.id },
        select: { companionId: true },
      }),
      prisma.clientVisibility.findMany({
        where: { clientId: user.id, status: 'REJECTED' },
        select: { companionId: true },
      }),
    ]);

    const clientLat = queryLat ?? clientProfile?.lat ?? 28.6139;
    const clientLng = queryLng ?? clientProfile?.lng ?? 77.2090;
    const now = new Date();
    const isSubscribed =
      clientUser?.subscriptionStatus === 'ACTIVE' &&
      (clientUser.subscriptionExpiresAt == null || clientUser.subscriptionExpiresAt > now);

    const favoriteSet = new Set(favorites.map((f) => f.companionId));
    const rejectedSet = new Set(rejectedIds.map((r) => r.companionId));

    // Build base where clause (same as sections API)
    const baseWhere = {
      role: 'COMPANION' as const,
      isActive: true,
      isBanned: false,
      companionProfile: {
        isApproved: true,
        // Gender filter when intent mentions a gender
        ...(parsed.gender ? { gender: { equals: parsed.gender, mode: 'insensitive' as const } } : {}),
      },
      id: rejectedSet.size > 0 ? { notIn: Array.from(rejectedSet) } : undefined,
    };

    // Fetch a broad set of candidates — we score and sort in-memory
    const candidates = await prisma.user.findMany({
      where: baseWhere,
      select: companionCardSelect,
      // Fetch more than we need; scoring will reorder
      take: 50,
      orderBy: { companionProfile: { rankingScore: 'desc' } },
    });

    // Score each candidate
    const scored = candidates
      .filter((c) => c.companionProfile != null)
      .map((c) => ({
        companion: c,
        score: scoreCompanion(c, parsed, clientLat, clientLng),
      }))
      .sort((a, b) => b.score - a.score);

    // Limit results: subscribers get 10, free users get 3
    const limit = isSubscribed ? MAX_CONCIERGE_RESULTS : MAX_FREE_CONCIERGE_RESULTS;
    const topResults = scored.slice(0, limit);

    const companions = topResults.map((item, index) =>
      mapCompanionCard(
        item.companion,
        clientLat,
        clientLng,
        isSubscribed,
        index,
        favoriteSet,
        item.score,
      ),
    );

    return NextResponse.json({
      success: true,
      data: {
        companions,
        intent: {
          raw: intent,
          timeSlots: parsed.timeSlots,
          activity: parsed.activity,
          preferQuality: parsed.preferQuality,
          traits: parsed.traits,
          languages: parsed.languages,
          gender: parsed.gender,
        },
      },
    });
  } catch (error) {
    console.error('Concierge fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch concierge recommendations' },
      { status: 500 },
    );
  }
}
