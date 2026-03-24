"use client";
'use client';

import { useEffect, useState } from 'react';
import { BookingCard } from '@/components/booking/BookingCard';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export default function BookingsPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      const res = await fetch('/api/bookings');
      const data = await res.json();
      setBookings(data.bookings);
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (bookingId: string, status: string) => {
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        fetchBookings();
      }
    } catch (error) {
      console.error('Error updating booking:', error);
    }
  };

  const filteredBookings =
    filter === 'ALL'
      ? bookings
      : bookings.filter((b) => b.status === filter);

  const filters = ['ALL', 'PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-gold border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">My Bookings</h1>
        <p className="text-white/60">Manage your bookings</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {(filters as any[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`
              px-4 py-2 rounded-full text-sm font-medium transition-colors
              ${filter === f
                ? 'bg-gold text-charcoal'
                : 'bg-charcoal-surface text-white/70 hover:bg-charcoal-border'
              }
            `}
          >
            {f === 'ALL' ? 'All Bookings' : f}
          </button>
        ))}
      </div>

      {/* Bookings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(filteredBookings as any[]).map((booking) => (
          <BookingCard
            key={booking.id}
            booking={booking}
            role="CLIENT"
            onStatusChange={handleStatusChange}
          />
        ))}
      </div>

      {filteredBookings.length === 0 && (
        <Card className="text-center py-12">
          <p className="text-white/60">No bookings found</p>
        </Card>
      )}
    </div>
  );
}
