"use client";
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatCurrency, formatDate } from '@/lib/utils';

interface BookingCardProps {
  booking: {
    id: string;
    date: string;
    duration: number;
    status: string;
    totalAmount: number;
    notes?: string;
    venueName?: string | null;
    venueAddress?: string | null;
    venueLat?: number | null;
    venueLng?: number | null;
    arrivedAt?: string | null;
    freeChatExpiresAt?: string | null;
    client?: {
      clientProfile?: {
        name: string;
        avatarUrl?: string;
      };
    };
    companion?: {
      id?: string;
      companionProfile?: {
        name: string;
        avatarUrl?: string;
      };
    };
  };
  role: 'CLIENT' | 'COMPANION';
  onStatusChange?: (id: string, status: string) => void;
  onArrive?: (id: string, lat: number, lng: number) => void;
}

export function BookingCard({ booking, role, onStatusChange, onArrive }: BookingCardProps) {
  const person = role === 'CLIENT' ? booking.companion : booking.client;
  const profile = (person as any)?.companionProfile || (person as any)?.clientProfile;
  const [confirmAction, setConfirmAction] = useState<null | 'CANCELLED' | 'REJECTED'>(null);
  const [arrivingLoading, setArrivingLoading] = useState(false);

  const statusColors: Record<string, string> = {
    PENDING: 'warning',
    CONFIRMED: 'success',
    REJECTED: 'error',
    COMPLETED: 'gold',
    CANCELLED: 'outline',
  };

  const now = new Date();
  const meetingStart = new Date(booking.date);
  const meetingEnd = new Date(meetingStart.getTime() + booking.duration * 60 * 60 * 1000);

  const canConfirm = role === 'COMPANION' && booking.status === 'PENDING';
  const canReject = role === 'COMPANION' && booking.status === 'PENDING';
  const canCancel = role === 'CLIENT' && ['PENDING', 'CONFIRMED'].includes(booking.status);
  const canMarkArrived = role === 'COMPANION' && booking.status === 'CONFIRMED' && now >= meetingStart && !booking.arrivedAt;
  const canMarkComplete = role === 'COMPANION' && booking.status === 'CONFIRMED' && now >= meetingEnd;

  // Free coordination chat: active when confirmed and window hasn't expired
  const freeChatActive = booking.status === 'CONFIRMED' && booking.freeChatExpiresAt
    ? new Date(booking.freeChatExpiresAt) > now
    : false;

  const handleArrive = () => {
    setArrivingLoading(true);
    if (!navigator.geolocation) {
      onArrive?.(booking.id, 0, 0);
      setArrivingLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onArrive?.(booking.id, pos.coords.latitude, pos.coords.longitude);
        setArrivingLoading(false);
      },
      () => {
        onArrive?.(booking.id, 0, 0);
        setArrivingLoading(false);
      },
      { timeout: 8000 }
    );
  };

  // Link to companion's profile for coordination chat (client side)
  const companionId = (booking.companion as any)?.id;

  return (
    <Card className="space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {profile?.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt={profile.name}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-white/[0.08] flex items-center justify-center text-white font-medium">
              {profile?.name.charAt(0) || '?'}
            </div>
          )}
          <div>
            <p className="font-medium text-white">{profile?.name || 'Unknown'}</p>
            <p className="text-sm text-white/50">{formatDate(booking.date)}</p>
          </div>
        </div>
        <Badge variant={statusColors[booking.status] as any || 'default'}>
          {booking.status}
        </Badge>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-white/60">Duration</span>
          <span className="text-white">{booking.duration} hours</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/60">Total</span>
          <span className="text-gold font-medium">{formatCurrency(booking.totalAmount)}</span>
        </div>
        {booking.arrivedAt && (
          <div className="flex items-center gap-1.5 pt-1">
            <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
            <span className="text-xs text-green-400">Companion arrived</span>
          </div>
        )}
        {booking.venueName && (
          <div className="pt-2 border-t border-charcoal-border">
            <div className="flex items-start gap-2">
              <svg className="w-3.5 h-3.5 text-gold mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <div className="min-w-0">
                <p className="text-xs text-white font-medium">{booking.venueName}</p>
                {booking.venueAddress && (
                  <p className="text-[10px] text-white/40 truncate">{booking.venueAddress}</p>
                )}
              </div>
            </div>
          </div>
        )}
        {booking.notes && (
          <div className={`${booking.venueName ? 'pt-1' : 'pt-2 border-t border-charcoal-border'}`}>
            <p className="text-white/60 text-xs">{booking.notes}</p>
          </div>
        )}
      </div>

      {/* Free coordination chat banner */}
      {freeChatActive && role === 'CLIENT' && companionId && (
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <div className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span className="text-xs text-amber-300 font-medium">Free coordination chat</span>
          </div>
          <Link
            href={`/client/inbox/${companionId}?coord=1`}
            className="text-xs text-amber-400 font-semibold underline underline-offset-2"
          >
            Open
          </Link>
        </div>
      )}
      {freeChatActive && role === 'COMPANION' && (
        <div className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <p className="text-xs text-amber-300 font-medium">Free coordination chat window active — check inbox</p>
        </div>
      )}

      <div className="flex gap-2 pt-2 flex-wrap">
        {canConfirm && (
          <Button
            size="sm"
            variant="primary"
            className="flex-1"
            onClick={() => onStatusChange?.(booking.id, 'CONFIRMED')}
          >
            Accept
          </Button>
        )}
        {canReject && (
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={() => setConfirmAction('REJECTED')}
          >
            Reject
          </Button>
        )}
        {canCancel && (
          <Button
            size="sm"
            variant="danger"
            className="flex-1"
            onClick={() => setConfirmAction('CANCELLED')}
          >
            Cancel
          </Button>
        )}
        {canMarkArrived && (
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={handleArrive}
            disabled={arrivingLoading}
          >
            {arrivingLoading ? 'Locating…' : 'Mark Arrived'}
          </Button>
        )}
        {canMarkComplete && (
          <Button
            size="sm"
            variant="primary"
            className="flex-1"
            onClick={() => onStatusChange?.(booking.id, 'COMPLETED')}
          >
            Mark Completed
          </Button>
        )}
        {booking.status === 'CONFIRMED' && role === 'COMPANION' && !canMarkComplete && (
          <p className="w-full text-center text-xs text-white/30 pt-1">
            Can mark complete after {meetingEnd.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
          </p>
        )}
      </div>
      <ConfirmDialog
        isOpen={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => {
          if (confirmAction) onStatusChange?.(booking.id, confirmAction);
          setConfirmAction(null);
        }}
        title={confirmAction === 'CANCELLED' ? 'Cancel this booking?' : 'Reject this booking?'}
        message={
          confirmAction === 'CANCELLED'
            ? 'Your booking will be cancelled. Late cancellations may incur a fee per our terms.'
            : 'The client will be notified that you declined this booking.'
        }
        confirmLabel={confirmAction === 'CANCELLED' ? 'Cancel booking' : 'Reject'}
        variant="danger"
      />
    </Card>
  );
}
