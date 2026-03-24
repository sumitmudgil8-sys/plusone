'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { BookingCard } from '@/components/booking/BookingCard';

export default function ClientDashboard() {
  const [user, setUser] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<any[]>([]);
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
          setBookings(bookingsData.bookings.slice(0, 3));
        }

        // Get favorites
        const favRes = await fetch('/api/favorites');
        if (favRes.ok) {
          const favData = await favRes.json();
          setFavorites(favData.favorites);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const activeBookings = bookings.filter(
    (b) => b.status === 'PENDING' || b.status === 'CONFIRMED'
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
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Welcome back, {user?.clientProfile?.name || 'Guest'}
          </h1>
          <p className="text-white/60">Ready to find your perfect companion?</p>
        </div>
        <Badge
          variant={user?.subscriptionTier === 'PREMIUM' ? 'gold' : 'outline'}
          className="text-sm"
        >
          {user?.subscriptionTier || 'FREE'}
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="text-center">
          <p className="text-3xl font-bold text-white">{activeBookings.length}</p>
          <p className="text-sm text-white/60">Active Bookings</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-white">{favorites.length}</p>
          <p className="text-sm text-white/60">Favorites</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-gold">
            {user?.subscriptionTier === 'PREMIUM' ? '∞' : '20'}
          </p>
          <p className="text-sm text-white/60">Companions</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-white">{bookings.length}</p>
          <p className="text-sm text-white/60">Total Bookings</p>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <h2 className="font-medium text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link href="/client/browse">
            <Button variant="outline" className="w-full">
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Browse
            </Button>
          </Link>
          <Link href="/client/bookings">
            <Button variant="outline" className="w-full">
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Bookings
            </Button>
          </Link>
          <Link href="/client/favorites">
            <Button variant="outline" className="w-full">
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              Favorites
            </Button>
          </Link>
          <Link href="/client/profile">
            <Button variant="outline" className="w-full">
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Profile
            </Button>
          </Link>
        </div>
      </Card>

      {/* Recent Bookings */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-medium text-white">Recent Bookings</h2>
          <Link href="/client/bookings" className="text-sm text-gold hover:underline">
            View All
          </Link>
        </div>

        {bookings.length === 0 ? (
          <Card className="text-center py-8">
            <p className="text-white/60">No bookings yet</p>
            <Link href="/client/browse" className="mt-4 inline-block">
              <Button>Browse Companions</Button>
            </Link>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(bookings as any[]).map((booking) => (
              <BookingCard key={booking.id} booking={booking} role="CLIENT" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
