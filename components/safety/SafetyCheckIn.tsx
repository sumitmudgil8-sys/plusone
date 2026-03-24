"use client";
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { SAFETY_CHECKIN_INTERVALS } from '@/lib/constants';

interface CheckIn {
  id: string;
  scheduledAt: string;
  checkedInAt: string | null;
  status: string;
  location: string;
  companion: {
    companionProfile: {
      name: string;
      avatarUrl: string;
    } | null;
  };
}

export function SafetyCheckIn({ companionId, bookingId }: { companionId?: string; bookingId?: string }) {
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedInterval, setSelectedInterval] = useState(60);

  useEffect(() => {
    fetchCheckIns();
    const interval = setInterval(fetchCheckIns, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  const fetchCheckIns = async () => {
    try {
      const res = await fetch('/api/safety/checkins');
      const data = await res.json();
      setCheckIns(data.checkIns || []);
    } catch (error) {
      console.error('Failed to fetch check-ins:', error);
    }
  };

  const scheduleCheckIn = async () => {
    try {
      const checkInTime = new Date(Date.now() + selectedInterval * 60000);

      const res = await fetch('/api/safety/checkins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companionId,
          bookingId,
          scheduledAt: checkInTime.toISOString(),
          location,
          notes,
        }),
      });

      if (res.ok) {
        setIsModalOpen(false);
        setLocation('');
        setNotes('');
        fetchCheckIns();
      }
    } catch (error) {
      console.error('Failed to schedule check-in:', error);
    }
  };

  const completeCheckIn = async (checkInId: string) => {
    try {
      const res = await fetch('/api/safety/checkins', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkInId }),
      });

      if (res.ok) {
        fetchCheckIns();
      }
    } catch (error) {
      console.error('Failed to complete check-in:', error);
    }
  };

  const activeCheckIn = checkIns.find(c => c.status === 'SCHEDULED');
  const overdueCheckIn = checkIns.find(c => {
    if (c.status !== 'SCHEDULED') return false;
    const scheduled = new Date(c.scheduledAt);
    const now = new Date();
    return now > new Date(scheduled.getTime() + 15 * 60000); // 15 min grace period
  });

  if (overdueCheckIn) {
    return (
      <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h3 className="text-red-400 font-semibold">Check-in Overdue!</h3>
            <p className="text-white/70 text-sm">Your emergency contact has been notified.</p>
          </div>
          <Button
            onClick={() => completeCheckIn(overdueCheckIn.id)}
            className="ml-auto bg-red-500 hover:bg-red-600"
          >
            Check In Now
          </Button>
        </div>
      </div>
    );
  }

  if (activeCheckIn) {
    const scheduled = new Date(activeCheckIn.scheduledAt);
    const timeUntil = scheduled.getTime() - Date.now();
    const minutesUntil = Math.floor(timeUntil / 60000);

    return (
      <div className="bg-gold/10 border border-gold/30 rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gold/20 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-gold font-medium">Check-in Scheduled</h3>
              <p className="text-white/60 text-sm">
                {minutesUntil > 0 ? `${minutesUntil} minutes remaining` : 'Check-in due now'}
              </p>
            </div>
          </div>
          <Button
            onClick={() => completeCheckIn(activeCheckIn.id)}
            variant="outline"
            className="border-gold text-gold hover:bg-gold/10"
          >
            Check In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Button
        onClick={() => setIsModalOpen(true)}
        variant="outline"
        className="w-full border-gold/50 text-gold hover:bg-gold/10"
      >
        <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        Schedule Safety Check-in
      </Button>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-charcoal-surface border border-charcoal-border rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-white mb-4">Schedule Safety Check-in</h2>
            <p className="text-white/70 text-sm mb-6">
              Set a check-in time. If you don't check in within 15 minutes after the scheduled time,
              your emergency contact will be notified.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Check-in after (minutes)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {SAFETY_CHECKIN_INTERVALS.map((interval) => (
                    <button
                      key={interval}
                      onClick={() => setSelectedInterval(interval)}
                      className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedInterval === interval
                          ? 'bg-gold text-charcoal'
                          : 'bg-charcoal border border-charcoal-border text-white/70 hover:border-gold/50'
                      }`}
                    >
                      {interval}m
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Location (optional)
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g., Connaught Place"
                  className="w-full bg-charcoal border border-charcoal-border text-white rounded-lg px-4 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional safety notes..."
                  rows={3}
                  className="w-full bg-charcoal border border-charcoal-border text-white rounded-lg px-4 py-2"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={scheduleCheckIn}
                className="flex-1"
              >
                Schedule
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
