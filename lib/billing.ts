import { PLATFORM_COMMISSION_RATE } from '@/lib/constants';

/**
 * Convert an hourly rate (paise/hr) to a per-minute rate (paise/min).
 * Uses Math.round to keep amounts as integers.
 */
export function getRatePerMinute(hourlyRate: number): number {
  return Math.round(hourlyRate / 60);
}

/**
 * Amount the companion earns per minute after platform commission.
 * Rounds down to the nearest paise to avoid fractional amounts.
 */
export function getCompanionRatePerMinute(ratePerMinute: number): number {
  return Math.round(ratePerMinute * (1 - PLATFORM_COMMISSION_RATE));
}
