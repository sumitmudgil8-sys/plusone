"use client";
'use client';

import { useEffect, useState } from 'react';
import { BookingCard } from '@/components/booking/BookingCard';
import { Card } from '@/components/ui/Card';

export default function CompanionBookingsPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('PENDING');

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

  const handleArrive = async (bookingId: string, lat: number, lng: number) => {
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'arrived', lat, lng }),
      });
      if (res.ok) fetchBookings();
    } catch (error) {
      console.error('Error marking arrival:', error);
    }
  };

  const filteredBookings = bookings.filter((b) => {
    if (activeTab === 'PENDING') return b.status === 'PENDING';
    if (activeTab === 'CONFIRMED') return b.status === 'CONFIRMED';
    if (activeTab === 'COMPLETED') return ['COMPLETED', 'CANCELLED', 'REJECTED'].includes(b.status);
    return true;
  });

  const tabs = ['PENDING', 'CONFIRMED', 'COMPLETED'];

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
        <h1 className="text-2xl font-bold text-white">Bookings</h1>
        <p className="text-white/60">Manage your booking requests</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-charcoal-border">
        {(tabs as any[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`
              px-4 py-3 text-sm font-medium border-b-2 transition-colors
              ${activeTab === tab
                ? 'text-gold border-gold'
                : 'text-white/60 border-transparent hover:text-white'
              }
            `}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Bookings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(filteredBookings as any[]).map((booking) => (
          <BookingCard
            key={booking.id}
            booking={booking}
            role="COMPANION"
            onStatusChange={handleStatusChange}
            onArrive={handleArrive}
          />
        ))}
      </div>

      {filteredBookings.length === 0 && (
        <Card className="text-center py-12">
          <p className="text-white/60">No {activeTab.toLowerCase()} bookings</p>
        </Card>
      )}
    </div>
  );
}
