/**
 * Simple in-memory sliding-window rate limiter.
 *
 * LIMITATIONS:
 *   - Per-process only. On serverless cold starts the state resets, and
 *     horizontally-scaled deploys each get their own bucket. This is a
 *     mitigation, not hard protection. For production credential-stuffing
 *     defense, move to Redis / Upstash.
 *   - Buckets are pruned lazily on each hit; no background timer.
 *
 * Usage:
 *   const rl = rateLimit({ windowMs: 60_000, max: 5 });
 *   const { ok, retryAfter } = rl.check(getClientIp(req) + ':login');
 *   if (!ok) return 429
 */

type Bucket = { hits: number[]; };

const buckets = new Map<string, Bucket>();

export interface RateLimitConfig {
  /** Window length in milliseconds. */
  windowMs: number;
  /** Max hits allowed within the window. */
  max: number;
}

export interface RateLimitResult {
  ok: boolean;
  /** Seconds to wait before retrying (0 if ok). */
  retryAfter: number;
  /** Hits remaining in the current window. */
  remaining: number;
}

export function rateLimit(config: RateLimitConfig) {
  const { windowMs, max } = config;

  return {
    check(key: string): RateLimitResult {
      const now = Date.now();
      const cutoff = now - windowMs;

      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { hits: [] };
        buckets.set(key, bucket);
      }

      // Drop expired hits
      bucket.hits = bucket.hits.filter((t) => t > cutoff);

      if (bucket.hits.length >= max) {
        const oldest = bucket.hits[0];
        const retryAfter = Math.ceil((oldest + windowMs - now) / 1000);
        return { ok: false, retryAfter: Math.max(1, retryAfter), remaining: 0 };
      }

      bucket.hits.push(now);
      return { ok: true, retryAfter: 0, remaining: max - bucket.hits.length };
    },
  };
}

/**
 * Extract a best-effort client IP from a Next.js request. Handles Vercel's
 * x-forwarded-for chain. Falls back to a constant so missing headers do not
 * accidentally disable the limiter for ALL traffic.
 */
export function getClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const real = req.headers.get('x-real-ip');
  if (real) return real.trim();
  return 'unknown';
}

// Pre-configured limiters. Tight on auth (credential stuffing), looser on
// billing tick (legitimate clients tick once per minute).
export const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
export const signupLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5 });
export const billingTickLimiter = rateLimit({ windowMs: 60 * 1000, max: 30 });
// Manual payment creation: legitimate flow needs maybe 2-3 per hour (retries,
// amount corrections). 10 per hour per user is tight enough to stop spammy
// creation but lenient enough for real users who re-submit.
export const manualPaymentLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10 });
