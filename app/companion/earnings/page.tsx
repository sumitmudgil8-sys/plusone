'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function EarningsPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  const completedBookings = bookings.filter((b) => b.status === 'COMPLETED');
  const pendingPayout = bookings.filter(
    (b) => b.status === 'CONFIRMED'
  );

  const totalEarned = completedBookings.reduce(
    (sum, b) => sum + b.totalAmount,
    0
  );
  const pendingAmount = pendingPayout.reduce(
    (sum, b) => sum + b.totalAmount,
    0
  );

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
        <h1 className="text-2xl font-bold text-white">Earnings</h1>
        <p className="text-white/60">Track your income</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="text-center">
          <p className="text-3xl font-bold text-gold">{formatCurrency(totalEarned)}</p>
          <p className="text-sm text-white/60">Total Earned</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-white">{formatCurrency(pendingAmount)}</p>
          <p className="text-sm text-white/60">Pending Payout</p>
        </Card>
      </div>

      {/* Transaction History */}
      <Card>
        <h2 className="font-medium text-white mb-4">Transaction History</h2>

        {completedBookings.length === 0 ? (
          <p className="text-white/60 text-center py-8">No earnings yet</p>
        ) : (
          <div className="divide-y divide-charcoal-border">
            {(completedBookings as any[]).map((booking) => (
              <div key={booking.id} className="py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {booking.client.clientProfile?.avatarUrl ? (
                    <img
                      src={booking.client.clientProfile.avatarUrl}
                      alt={booking.client.clientProfile.name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-charcoal-border flex items-center justify-center text-white font-medium">
                      {booking.client.clientProfile?.name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-white">
                      {booking.client.clientProfile?.name}
                    </p>
                    <p className="text-sm text-white/50">{formatDate(booking.date)}</p>
                  </div>
                </div>
                <span className="font-medium text-success">+{formatCurrency(booking.totalAmount)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
