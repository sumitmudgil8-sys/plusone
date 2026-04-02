import { PLATFORM_COMMISSION_RATE } from '@/lib/constants';

/** Convert an hourly rate (INR/hr) to a per-minute rate (INR/min). */
export function getRatePerMinute(hourlyRate: number): number {
  return hourlyRate / 60;
}

/** Amount the companion earns per minute after platform commission. */
export function getCompanionRatePerMinute(ratePerMinute: number): number {
  return ratePerMinute * (1 - PLATFORM_COMMISSION_RATE);
}
