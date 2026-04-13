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
    client?: {
      clientProfile?: {
        name: string;
        avatarUrl?: string;
      };
    };
    companion?: {
      companionProfile?: {
        name: string;
        avatarUrl?: string;
      };
    };
  };
  role: 'CLIENT' | 'COMPANION';
  onStatusChange?: (id: string, status: string) => void;
}

export function BookingCard({ booking, role, onStatusChange }: BookingCardProps) {
  const person = role === 'CLIENT' ? booking.companion : booking.client;
  const profile = (person as any)?.companionProfile || (person as any)?.clientProfile;
  const [confirmAction, setConfirmAction] = useState<null | 'CANCELLED' | 'REJECTED'>(null);

  const statusColors: Record<string, string> = {
    PENDING: 'warning',
    CONFIRMED: 'success',
    REJECTED: 'error',
    COMPLETED: 'gold',
    CANCELLED: 'outline',
  };

  const canConfirm = role === 'COMPANION' && booking.status === 'PENDING';
  const canReject = role === 'COMPANION' && booking.status === 'PENDING';
  const canCancel = role === 'CLIENT' && ['PENDING', 'CONFIRMED'].includes(booking.status);

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

      <div className="flex gap-2 pt-2">
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
        {booking.status === 'CONFIRMED' && role === 'COMPANION' && (
          <Button
            size="sm"
            variant="primary"
            className="flex-1"
            onClick={() => onStatusChange?.(booking.id, 'COMPLETED')}
          >
            Mark Completed
          </Button>
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
