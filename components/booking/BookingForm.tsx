"use client";
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { formatCurrency } from '@/lib/utils';

interface BookingFormProps {
  companionId: string;
  companionName: string;
  hourlyRate: number;
  availability: string[];
}

export function BookingForm({
  companionId,
  companionName,
  hourlyRate,
  availability,
}: BookingFormProps) {
  const router = useRouter();
  const [date, setDate] = useState('');
  const [duration, setDuration] = useState(2);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const totalAmount = hourlyRate * duration;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
          setError('This companion is locked. Upgrade to Premium to book.');
          return;
        }
        throw new Error(data.error || 'Failed to create booking');
      }

      setShowSuccessModal(true);
    } catch (err: any) {
      setError(err.message);
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
                {availability.map((dateStr) => (
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
                className="w-full h-2 bg-charcoal-border rounded-lg appearance-none cursor-pointer accent-gold"
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
          </div>
        </Card>

        {error && (
          <div className="p-4 bg-error/10 border border-error/30 rounded-lg text-error text-sm">
            {error}
          </div>
        )}

        <Button type="submit" size="lg" className="w-full" isLoading={loading}>
          Confirm Booking
        </Button>
      </form>

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
