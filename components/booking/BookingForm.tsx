'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { DEPOSIT_PERCENTAGE } from '@/lib/constants';
import { formatCurrency } from '@/lib/utils';

type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
type SlotKey = 'MORNING' | 'AFTERNOON' | 'EVENING' | 'NIGHT';

const DAY_KEY_MAP: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const WEEKDAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const SLOT_META: Record<SlotKey, { label: string; startHour: number; endHour: number }> = {
  MORNING:   { label: 'Morning (6 AM–12 PM)',   startHour: 6,  endHour: 12 },
  AFTERNOON: { label: 'Afternoon (12–5 PM)', startHour: 12, endHour: 17 },
  EVENING:   { label: 'Evening (5–9 PM)',   startHour: 17, endHour: 21 },
  NIGHT:     { label: 'Night (9 PM–12 AM)',     startHour: 21, endHour: 24 },
};

/** Generate hour options within available slots for a given date */
function getAvailableHours(
  dateStr: string,
  weeklyAvailability: Record<string, string[]> | undefined,
): number[] {
  if (!dateStr || !weeklyAvailability) return [];
  const d = new Date(dateStr + 'T00:00');
  const dayKey = DAY_KEY_MAP[d.getDay()];
  const slots = (weeklyAvailability[dayKey] ?? []) as SlotKey[];
  const hours: number[] = [];
  for (const slot of slots) {
    const meta = SLOT_META[slot];
    if (!meta) continue;
    for (let h = meta.startHour; h < meta.endHour; h++) {
      hours.push(h);
    }
  }
  return hours;
}

function formatHour(h: number): string {
  const period = h >= 12 ? 'PM' : 'AM';
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${display}:00 ${period}`;
}

/** Check if a date is available based on companion's weekly schedule */
function isDateAvailable(
  dateStr: string,
  weeklyAvailability: Record<string, string[]> | undefined,
  legacyAvailability: string[],
): boolean {
  const hasWeekly = weeklyAvailability && Object.values(weeklyAvailability).some((s) => s.length > 0);
  if (hasWeekly) {
    const d = new Date(dateStr + 'T00:00');
    const dayKey = DAY_KEY_MAP[d.getDay()];
    return (weeklyAvailability[dayKey]?.length ?? 0) > 0;
  }
  // Legacy: available if date is in the array
  if (legacyAvailability.length > 0) {
    return legacyAvailability.includes(dateStr);
  }
  // No availability data — treat all dates as available
  return true;
}

/** Build calendar grid for a given month */
function getCalendarDays(year: number, month: number): (string | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid: (string | null)[] = [];
  // Padding for days before the 1st
  for (let i = 0; i < firstDay; i++) grid.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    grid.push(dateStr);
  }
  return grid;
}

interface VenueResult {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating?: number;
}

interface SelectedVenue {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

interface BookingFormProps {
  companionId: string;
  companionName: string;
  hourlyRate: number;
  availability: string[];
  weeklyAvailability?: Record<string, string[]>;
}

export function BookingForm({
  companionId,
  companionName,
  hourlyRate,
  availability,
  weeklyAvailability,
}: BookingFormProps) {
  const router = useRouter();
  const toast = useToast();

  // Calendar state
  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const calendarDays = useMemo(
    () => getCalendarDays(calendarMonth.year, calendarMonth.month),
    [calendarMonth],
  );
  const monthLabel = useMemo(
    () => new Date(calendarMonth.year, calendarMonth.month).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
    [calendarMonth],
  );

  const [date, setDate] = useState('');
  const [startHour, setStartHour] = useState<number | ''>('');
  const [duration, setDuration] = useState(2);
  const [notes, setNotes] = useState('');

  // Venue search — location-first flow
  const [locationQuery, setLocationQuery] = useState('');
  const [venueResults, setVenueResults] = useState<VenueResult[]>([]);
  const [venueLoading, setVenueLoading] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState<SelectedVenue | null>(null);
  const [venueSearched, setVenueSearched] = useState(false);
  const venueWrapperRef = useRef<HTMLDivElement>(null);

  const availableHours = useMemo(
    () => getAvailableHours(date, weeklyAvailability),
    [date, weeklyAvailability],
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  const totalAmount = hourlyRate * duration;
  const depositAmount = Math.ceil((totalAmount * DEPOSIT_PERCENTAGE) / 100);

  // Navigate calendar
  const prevMonth = () => {
    setCalendarMonth((prev) => {
      if (prev.month === 0) return { year: prev.year - 1, month: 11 };
      return { ...prev, month: prev.month - 1 };
    });
  };
  const nextMonth = () => {
    setCalendarMonth((prev) => {
      if (prev.month === 11) return { year: prev.year + 1, month: 0 };
      return { ...prev, month: prev.month + 1 };
    });
  };

  // Search restaurants near the entered location
  const searchNearbyVenues = useCallback(async () => {
    if (locationQuery.length < 2) return;
    setVenueLoading(true);
    setVenueSearched(false);
    setSelectedVenue(null);
    try {
      const res = await fetch(`/api/venues/search?location=${encodeURIComponent(locationQuery)}`);
      const data = await res.json();
      if (data.success) {
        setVenueResults(data.data ?? []);
      }
    } catch {
      // non-fatal
    } finally {
      setVenueLoading(false);
      setVenueSearched(true);
    }
  }, [locationQuery]);

  const selectVenue = (venue: VenueResult) => {
    setSelectedVenue({
      name: venue.name,
      address: venue.address,
      lat: venue.lat,
      lng: venue.lng,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termsAccepted) {
      setError('Please accept the terms and conditions to proceed.');
      toast.error('Please accept the terms and conditions');
      return;
    }
    if (!date) {
      setError('Please select a date.');
      toast.error('Please select a date');
      return;
    }
    if (availableHours.length > 0 && startHour === '') {
      setError('Please select a start time for the meeting.');
      toast.error('Please select a start time');
      return;
    }
    setError('');
    setLoading(true);

    // Build full datetime: date string + selected hour (or midnight if no slots)
    let bookingDate = date;
    if (startHour !== '') {
      const h = String(startHour).padStart(2, '0');
      bookingDate = `${date}T${h}:00:00`;
    }

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companionId,
          date: bookingDate,
          duration,
          notes,
          venueName: selectedVenue?.name || undefined,
          venueAddress: selectedVenue?.address || undefined,
          venueLat: selectedVenue?.lat || undefined,
          venueLng: selectedVenue?.lng || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === 'COMPANION_LOCKED') {
          const msg = 'This companion is locked. Upgrade to Premium to book.';
          setError(msg);
          toast.error(msg);
          return;
        }
        if (data.error === 'INSUFFICIENT_BALANCE') {
          const msg = data.message || 'Insufficient wallet balance for the booking deposit.';
          setError(msg);
          toast.error(msg);
          return;
        }
        throw new Error(data.error || 'Failed to create booking');
      }

      toast.success('Booking request sent');
      setShowSuccessModal(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create booking';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // Determine if we can go to previous month (don't allow going before current month)
  const canGoPrev = calendarMonth.year > new Date().getFullYear() ||
    (calendarMonth.year === new Date().getFullYear() && calendarMonth.month > new Date().getMonth());

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Calendar Date Picker */}
        <Card>
          <div className="space-y-4">
            <label className="block text-sm font-medium text-white/80 mb-1">
              Select Date
            </label>

            {/* Month navigation */}
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={prevMonth}
                disabled={!canGoPrev}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-sm font-semibold text-white">{monthLabel}</span>
              <button
                type="button"
                onClick={nextMonth}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {WEEKDAY_HEADERS.map((d) => (
                <div key={d} className="text-center text-[10px] font-medium text-white/40 py-1">
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((dateStr, i) => {
                if (!dateStr) {
                  return <div key={`empty-${i}`} className="aspect-square" />;
                }
                const isPast = dateStr < today;
                const available = !isPast && isDateAvailable(dateStr, weeklyAvailability, availability);
                const isSelected = dateStr === date;
                const isToday = dateStr === today;
                const dayNum = parseInt(dateStr.split('-')[2]);

                return (
                  <button
                    key={dateStr}
                    type="button"
                    disabled={isPast || !available}
                    onClick={() => {
                      setDate(dateStr);
                      setStartHour('');
                    }}
                    className={`aspect-square rounded-lg text-xs font-medium transition-all flex items-center justify-center relative ${
                      isSelected
                        ? 'bg-gold text-charcoal ring-2 ring-gold/50'
                        : available
                          ? 'bg-green-500/15 text-green-400 border border-green-500/25 hover:bg-green-500/25 cursor-pointer'
                          : isPast
                            ? 'text-white/15 cursor-not-allowed'
                            : 'text-white/25 cursor-not-allowed'
                    }`}
                  >
                    {dayNum}
                    {isToday && !isSelected && (
                      <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-gold" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-2 pt-2 border-t border-white/[0.06]">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-green-500/15 border border-green-500/25" />
                <span className="text-[10px] text-white/40">Available</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-gold" />
                <span className="text-[10px] text-white/40">Selected</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Time Slot Selection */}
        {date && availableHours.length > 0 && (
          <Card>
            <label className="block text-sm font-medium text-white/80 mb-3">
              Select Time
            </label>
            <div className="grid grid-cols-3 gap-2">
              {availableHours.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setStartHour(h)}
                  className={`py-2.5 rounded-xl text-xs font-medium border transition-all ${
                    startHour === h
                      ? 'bg-gold/15 border-gold/40 text-gold'
                      : 'bg-white/5 border-white/[0.06] text-white/60 hover:border-white/15'
                  }`}
                >
                  {formatHour(h)}
                </button>
              ))}
            </div>
          </Card>
        )}

        {/* Duration + Venue + Notes */}
        <Card>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Duration: {duration} hours
              </label>
              <input
                type="range"
                min="1"
                max="8"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
                className="w-full h-2 bg-white/[0.08] rounded-lg appearance-none cursor-pointer accent-gold"
              />
              <div className="flex justify-between text-xs text-white/50 mt-1">
                <span>1 hour</span>
                <span>8 hours</span>
              </div>
            </div>

            {/* Venue Search — enter location, see nearby restaurants */}
            <div ref={venueWrapperRef}>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Meeting Venue
              </label>
              <p className="text-[10px] text-white/30 mb-2">
                Enter a location or area to find nearby restaurants and cafes
              </p>

              {/* Location input + search button */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <input
                    type="text"
                    value={locationQuery}
                    onChange={(e) => { setLocationQuery(e.target.value); setVenueSearched(false); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); searchNearbyVenues(); } }}
                    placeholder="e.g. Connaught Place, Delhi"
                    className="w-full bg-charcoal border border-charcoal-border text-white rounded-lg pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold placeholder:text-white/30"
                  />
                </div>
                <button
                  type="button"
                  onClick={searchNearbyVenues}
                  disabled={locationQuery.length < 2 || venueLoading}
                  className="px-4 py-3 rounded-lg bg-gold/10 border border-gold/30 text-gold text-sm font-medium hover:bg-gold/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                >
                  {venueLoading ? (
                    <div className="animate-spin h-4 w-4 border-2 border-gold border-t-transparent rounded-full" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Nearby restaurant results */}
              {venueSearched && venueResults.length > 0 && !selectedVenue && (
                <div className="mt-3 border border-white/[0.06] rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                  <p className="text-[10px] text-white/40 px-3 py-2 bg-white/[0.02] border-b border-white/[0.04]">
                    {venueResults.length} restaurants found near {locationQuery}
                  </p>
                  {venueResults.map((venue) => (
                    <button
                      key={venue.id}
                      type="button"
                      onClick={() => selectVenue(venue)}
                      className="w-full text-left px-4 py-3 hover:bg-white/[0.06] transition-colors border-b border-white/[0.04] last:border-0"
                    >
                      <div className="flex items-start gap-2">
                        <svg className="w-4 h-4 text-gold mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-white font-medium truncate">{venue.name}</p>
                          <p className="text-xs text-white/40 truncate">{venue.address}</p>
                          {venue.rating && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <svg className="w-3 h-3 text-gold fill-current" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                              <span className="text-[10px] text-white/50">{venue.rating}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* No results */}
              {venueSearched && venueResults.length === 0 && !selectedVenue && (
                <div className="mt-3 bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-center">
                  <p className="text-xs text-white/40">No restaurants found near this location</p>
                  <p className="text-[10px] text-white/25 mt-1">Try a different area or landmark</p>
                </div>
              )}

              {/* Selected venue badge */}
              {selectedVenue && (
                <div className="mt-3 flex items-center gap-2 bg-gold/5 border border-gold/15 rounded-lg px-3 py-2">
                  <svg className="w-4 h-4 text-gold shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gold font-medium truncate">{selectedVenue.name}</p>
                    <p className="text-[10px] text-white/40 truncate">{selectedVenue.address}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSelectedVenue(null); setVenueResults([]); setVenueSearched(false); }}
                    className="text-white/40 hover:text-white/60 shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
            </div>

            <div>
              <Input
                label="Notes (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any special requests or preferences..."
              />
            </div>
          </div>
        </Card>

        {/* Price breakdown */}
        <Card>
          <div className="space-y-3">
            <div className="flex justify-between text-white/60">
              <span>{formatCurrency(hourlyRate)} × {duration} hrs</span>
              <span>{formatCurrency(hourlyRate * duration)}</span>
            </div>
            <div className="flex justify-between text-white/60">
              <span>Platform fee</span>
              <span>Included</span>
            </div>
            <div className="border-t border-charcoal-border pt-3 flex justify-between">
              <span className="font-medium text-white">Total</span>
              <span className="font-bold text-gold text-lg">{formatCurrency(totalAmount)}</span>
            </div>
            <div className="flex justify-between text-white/80 bg-gold/5 border border-gold/15 rounded-lg px-3 py-2">
              <span>Amount on hold</span>
              <span className="font-semibold text-gold">{formatCurrency(depositAmount)}</span>
            </div>
            <p className="text-[11px] text-white/40 leading-snug">
              Full amount held from your wallet until the booking is confirmed. Refunded in full if the companion declines or you cancel before confirmation.
            </p>
          </div>
        </Card>

        {error && (
          <div className="p-4 bg-error/10 border border-error/30 rounded-lg text-error text-sm">
            {error}
          </div>
        )}

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-charcoal-border bg-charcoal accent-gold cursor-pointer flex-shrink-0"
          />
          <span className="text-sm text-white/70 leading-snug">
            I understand that all meetings will take place in public settings and agree to{' '}
            <button
              type="button"
              onClick={() => setShowTermsModal(true)}
              className="text-gold underline underline-offset-2 hover:text-gold/80 transition-colors"
            >
              terms and conditions
            </button>
          </span>
        </label>

        <Button type="submit" size="lg" className="w-full" isLoading={loading}>
          Confirm Booking
        </Button>
      </form>

      {showTermsModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-charcoal border border-charcoal-border rounded-xl w-full max-w-lg flex flex-col max-h-[80vh]">
            <div className="p-5 border-b border-charcoal-border flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Terms &amp; Conditions</h3>
              <button
                type="button"
                onClick={() => setShowTermsModal(false)}
                className="text-white/50 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1 space-y-4 text-sm text-white/70 leading-relaxed">
              <p className="font-semibold text-white">Last updated: April 2026</p>
              <p>
                By booking a companion through Plus One, you agree to the following terms and conditions.
                Please read them carefully before confirming your booking.
              </p>
              <h4 className="font-semibold text-white mt-4">1. Public Meeting Requirement</h4>
              <p>
                All meetings between clients and companions must take place exclusively in public settings
                such as cafes, restaurants, parks, or other publicly accessible venues. Private meetings
                at residences, hotels, or any non-public location are strictly prohibited.
              </p>
              <h4 className="font-semibold text-white mt-4">2. Nature of Service</h4>
              <p>
                Plus One is a companionship platform. Companions provide social companionship services only.
                Any request for services of a romantic, sexual, or otherwise inappropriate nature is strictly
                forbidden and will result in immediate account termination.
              </p>
              <h4 className="font-semibold text-white mt-4">3. Conduct &amp; Respect</h4>
              <p>
                Clients are expected to treat companions with dignity and respect at all times. Harassment,
                abuse, or inappropriate behaviour of any kind will not be tolerated and will result in
                permanent suspension from the platform.
              </p>
              <h4 className="font-semibold text-white mt-4">4. Cancellation Policy</h4>
              <p>
                Bookings cancelled less than 24 hours before the scheduled meeting may incur a cancellation
                fee. Repeated no-shows may result in account restrictions.
              </p>
              <h4 className="font-semibold text-white mt-4">5. Safety &amp; Reporting</h4>
              <p>
                If you feel unsafe or experience any issue during a meeting, please leave the situation
                immediately and report the incident to Plus One support. We take all safety reports seriously
                and will investigate promptly.
              </p>
              <h4 className="font-semibold text-white mt-4">6. Privacy</h4>
              <p>
                Do not share personal contact information with companions outside the platform. All
                communication should remain within the Plus One app to ensure safety for both parties.
              </p>
              <h4 className="font-semibold text-white mt-4">7. Amendments</h4>
              <p>
                Plus One reserves the right to update these terms at any time. Continued use of the platform
                after changes constitutes acceptance of the revised terms.
              </p>
            </div>
            <div className="p-5 border-t border-charcoal-border">
              <Button
                type="button"
                size="lg"
                className="w-full"
                onClick={() => {
                  setTermsAccepted(true);
                  setShowTermsModal(false);
                }}
              >
                Accept &amp; Close
              </Button>
            </div>
          </div>
        </div>
      )}

      <Modal
        isOpen={showSuccessModal}
        onClose={() => {
          setShowSuccessModal(false);
          router.push('/client/bookings');
        }}
        title="Booking Confirmed!"
      >
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-success/20 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-white/80">
            Your booking with {companionName} has been sent. They will confirm shortly.
          </p>
          {selectedVenue && (
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-3 text-left">
              <p className="text-xs text-white/40">Meeting venue</p>
              <p className="text-sm text-white font-medium">{selectedVenue.name}</p>
              <p className="text-xs text-white/50">{selectedVenue.address}</p>
            </div>
          )}
          <Button onClick={() => router.push('/client/bookings')} className="w-full">
            View My Bookings
          </Button>
        </div>
      </Modal>
    </>
  );
}
