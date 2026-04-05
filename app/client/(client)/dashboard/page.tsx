'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

interface RecentlyViewedItem {
  companionId: string;
  name: string;
  primaryImage: string | null;
  hourlyRatePaise: number;
  viewedAt: string;
}

export default function ClientDashboard() {
  const [user, setUser] = useState<any>(null);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [userRes, favRes, viewedRes] = await Promise.all([
          fetch('/api/users/me'),
          fetch('/api/favorites'),
          fetch('/api/client/recently-viewed'),
        ]);

        if (userRes.ok) {
          const userData = await userRes.json();
          setUser(userData.user);
        }
        if (favRes.ok) {
          const favData = await favRes.json();
          setFavorites(favData.favorites ?? []);
        }
        if (viewedRes.ok) {
          const viewedData = await viewedRes.json();
          setRecentlyViewed(viewedData.data ?? []);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const isSubscribed = user?.subscriptionStatus === 'ACTIVE';

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
          variant={isSubscribed ? 'gold' : 'outline'}
          className="text-sm"
        >
          {isSubscribed ? 'Subscribed' : 'Free'}
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="text-center">
          <p className="text-3xl font-bold text-white">{favorites.length}</p>
          <p className="text-sm text-white/60">Favorites</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-white">{recentlyViewed.length}</p>
          <p className="text-sm text-white/60">Profiles Viewed</p>
        </Card>
        <Card className="text-center col-span-2 md:col-span-1">
          <p className="text-3xl font-bold text-gold">{isSubscribed ? '∞' : String(6)}</p>
          <p className="text-sm text-white/60">Companions Access</p>
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
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

      {/* Recently Viewed */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium text-white">Recently Viewed</h2>
          <Link href="/client/browse" className="text-sm text-gold hover:underline">
            Browse All
          </Link>
        </div>

        {recentlyViewed.length === 0 ? (
          <Card className="text-center py-8">
            <p className="text-white/50 text-sm">No profiles viewed yet</p>
            <Link href="/client/browse" className="mt-3 inline-block">
              <Button size="sm">Browse Companions</Button>
            </Link>
          </Card>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 snap-x scroll-smooth -mx-4 px-4">
            {recentlyViewed.map((item) => (
              <Link
                key={item.companionId}
                href={`/client/booking/${item.companionId}`}
                className="shrink-0 snap-start"
                style={{ width: 160 }}
              >
                <div className="relative rounded-xl overflow-hidden bg-charcoal-border" style={{ aspectRatio: '3/4' }}>
                  {item.primaryImage ? (
                    <img
                      src={item.primaryImage}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl font-medium text-white/30 bg-charcoal">
                      {item.name.charAt(0)}
                    </div>
                  )}
                  {/* Gradient */}
                  <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/80 to-transparent" />
                  {/* Labels */}
                  <div className="absolute bottom-0 inset-x-0 p-2">
                    <p className="text-white text-xs font-semibold truncate">{item.name}</p>
                    {item.hourlyRatePaise > 0 && (
                      <p className="text-white/60 text-xs">
                        ₹{Math.round(item.hourlyRatePaise / 100).toLocaleString('en-IN')}/hr
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Subscription CTA (free users) */}
      {!isSubscribed && (
        <div className="rounded-2xl border border-gold/20 bg-gradient-to-br from-gold/5 to-transparent p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white">Unlock all companions</p>
            <p className="text-xs text-white/50 mt-0.5">₹2,999/month — unlimited access</p>
          </div>
          <Link href="/client/subscription">
            <Button size="sm" className="shrink-0">Subscribe</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
