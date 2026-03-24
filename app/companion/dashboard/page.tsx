'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { BookingCard } from '@/components/booking/BookingCard';
import { formatCurrency } from '@/lib/utils';

export default function CompanionDashboard() {
  const [user, setUser] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get current user
        const userRes = await fetch('/api/users/me');
        if (userRes.ok) {
          const userData = await userRes.json();
          setUser(userData.user);
        }

        // Get bookings
        const bookingsRes = await fetch('/api/bookings');
        if (bookingsRes.ok) {
          const bookingsData = await bookingsRes.json();
          setBookings(bookingsData.bookings);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const pendingBookings = bookings.filter((b) => b.status === 'PENDING');
  const confirmedBookings = bookings.filter((b) => b.status === 'CONFIRMED');
  const completedBookings = bookings.filter((b) => b.status === 'COMPLETED');

  const totalEarnings = completedBookings.reduce(
    (sum, b) => sum + b.totalAmount,
    0
  );

  const handleStatusChange = async (bookingId: string, status: string) => {
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        const bookingsRes = await fetch('/api/bookings');
        const data = await bookingsRes.json();
        setBookings(data.bookings);
      }
    } catch (error) {
      console.error('Error updating booking:', error);
    }
  };

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
        <h1 className="text-2xl font-bold text-white">
          Welcome back, {user?.companionProfile?.name}
        </h1>
        <p className="text-white/60">Manage your bookings and profile</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="text-center">
          <p className="text-3xl font-bold text-white">{pendingBookings.length}</p>
          <p className="text-sm text-white/60">Pending</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-white">{confirmedBookings.length}</p>
          <p className="text-sm text-white/60">Confirmed</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-gold">{formatCurrency(totalEarnings)}</p>
          <p className="text-sm text-white/60">Earnings</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-white">{bookings.length}</p>
          <p className="text-sm text-white/60">Total</p>
        </Card>
      </div>

      {/* Pending Requests */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-medium text-white">Pending Requests</h2>
          <Link href="/companion/bookings" className="text-sm text-gold hover:underline">
            View All
          </Link>
        </div>

        {pendingBookings.length === 0 ? (
          <Card className="text-center py-8">
            <p className="text-white/60">No pending requests</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingBookings.slice(0, 3).map((booking: any) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                role="COMPANION"
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        )}
      </div>

      {/* Upcoming Bookings */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-medium text-white">Upcoming</h2>
        </div>

        {confirmedBookings.length === 0 ? (
          <Card className="text-center py-8">
            <p className="text-white/60">No upcoming bookings</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {confirmedBookings.slice(0, 3).map((booking: any) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                role="COMPANION"
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
