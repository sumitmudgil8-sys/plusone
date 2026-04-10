'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { DEPOSIT_PERCENTAGE } from '@/lib/constants';
import { formatCurrency } from '@/lib/utils';

type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

const DAY_KEY_MAP: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function generateAvailableDates(
  weeklyAvailability: Record<string, string[]> | undefined,
  legacyAvailability: string[],
  daysAhead = 14
): string[] {
  // If weekly availability has data, use it to generate dates
  const hasWeekly = weeklyAvailability && Object.values(weeklyAvailability).some((s) => s.length > 0);
  if (hasWeekly) {
    const dates: string[] = [];
    const today = new Date();
    for (let i = 0; i < daysAhead; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dayKey = DAY_KEY_MAP[d.getDay()];
      if (weeklyAvailability[dayKey]?.length > 0) {
        dates.push(d.toISOString().split('T')[0]);
      }
    }
    return dates;
  }
  // Fall back to legacy array
  return legacyAvailability;
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
  const availableDates = useMemo(
    () => generateAvailableDates(weeklyAvailability, availability),
    [weeklyAvailability, availability]
  );
  const [date, setDate] = useState('');
  const [duration, setDuration] = useState(2);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  const totalAmount = hourlyRate * duration;
  const depositAmount = Math.ceil((totalAmount * DEPOSIT_PERCENTAGE) / 100);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termsAccepted) {
      setError('Please accept the terms and conditions to proceed.');
      toast.error('Please accept the terms and conditions');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companionId,
          date,
          duration,
          notes,
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
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Date
              </label>
              <select
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full bg-charcoal border border-charcoal-border text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gold"
              >
                <option value="">Select a date</option>
                {availableDates.map((dateStr) => (
                  <option key={dateStr} value={dateStr}>
                    {new Date(dateStr).toLocaleDateString('en-IN', {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </option>
                ))}
              </select>
            </div>

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
              <span>Deposit due now ({DEPOSIT_PERCENTAGE}%)</span>
              <span className="font-semibold text-gold">{formatCurrency(depositAmount)}</span>
            </div>
            <p className="text-[11px] text-white/40 leading-snug">
              Held from your wallet until the booking is confirmed. Refunded in full if the companion declines or you cancel before confirmation.
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
          <Button onClick={() => router.push('/client/bookings')} className="w-full">
            View My Bookings
          </Button>
        </div>
      </Modal>
    </>
  );
}
