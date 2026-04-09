"use client";
'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { formatCurrency, formatDate } from '@/lib/utils';

interface BookingCardProps {
  booking: {
    id: string;
    date: string;
    duration: number;
    status: string;
    totalAmount: number;
    notes?: string;
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
        {booking.notes && (
          <div className="pt-2 border-t border-charcoal-border">
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
            onClick={() => onStatusChange?.(booking.id, 'REJECTED')}
          >
            Reject
          </Button>
        )}
        {canCancel && (
          <Button
            size="sm"
            variant="danger"
            className="flex-1"
            onClick={() => onStatusChange?.(booking.id, 'CANCELLED')}
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
    </Card>
  );
}
