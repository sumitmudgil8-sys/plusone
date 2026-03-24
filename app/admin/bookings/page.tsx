"use client";
'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      const res = await fetch('/api/admin/bookings');
      const data = await res.json();
      setBookings(data.bookings);
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this booking?')) return;

    try {
      const res = await fetch(`/api/admin/bookings?id=${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        fetchBookings();
      }
    } catch (error) {
      console.error('Error deleting booking:', error);
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
        <h1 className="text-2xl font-bold text-white">Bookings</h1>
        <p className="text-white/60">Manage all bookings</p>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-charcoal-border">
                <th className="text-left py-3 px-4 text-sm font-medium text-white/50">ID</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-white/50">Client</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-white/50">Companion</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-white/50">Date</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-white/50">Amount</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-white/50">Status</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-white/50">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal-border">
              {(bookings as any[]).map((booking) => (
                <tr key={booking.id}>
                  <td className="py-3 px-4 text-white/50">
                    {booking.id.slice(0, 8)}...
                  </td>
                  <td className="py-3 px-4 text-white">
                    {booking.client.clientProfile?.name}
                  </td>
                  <td className="py-3 px-4 text-white">
                    {booking.companion.companionProfile?.name}
                  </td>
                  <td className="py-3 px-4 text-white/70">
                    {formatDate(booking.date)}
                  </td>
                  <td className="py-3 px-4 text-gold">
                    {formatCurrency(booking.totalAmount)}
                  </td>
                  <td className="py-3 px-4">
                    <Badge
                      variant={
                        booking.status === 'CONFIRMED'
                          ? 'success'
                          : booking.status === 'PENDING'
                          ? 'warning'
                          : booking.status === 'CANCELLED' || booking.status === 'REJECTED'
                          ? 'error'
                          : 'default'
                      }
                    >
                      {booking.status}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => handleDelete(booking.id)}
                      className="text-error hover:text-red-400"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
