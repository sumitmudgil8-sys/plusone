'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CompanionCard } from '@/components/companion/CompanionCard';
import { Button } from '@/components/ui/Button';
import { MAX_FREE_COMPANIONS } from '@/lib/constants';

interface CompanionRow {
  id: string;
  name: string;
  hourlyRatePaise: number;
  chatRatePerMinute: number | null;
  callRatePerMinute: number | null;
  primaryImageUrl: string | null;
  avatarUrl?: string;
  distance: number;
  isFavorited: boolean;
  accessible: boolean;
  isVerified: boolean;
  averageRating: number;
  reviewCount: number;
  gender?: string;
  age?: number;
  city?: string;
  isNew?: boolean;
}

export default function BrowsePage() {
  const router = useRouter();
  const [companions, setCompanions] = useState<CompanionRow[]>([]);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const ablyRef = useRef<import('ably').Realtime | null>(null);

  useEffect(() => {
    fetchCompanions();
    setupAbly();
    return () => {
      ablyRef.current?.close();
    };
  }, []);

  const fetchCompanions = async () => {
    try {
      const res = await fetch('/api/companions');
      const data = await res.json();
      setCompanions(data.companions ?? []);
      setIsSubscribed(data.isSubscribed ?? false);
      setTotal(data.total ?? 0);
    } catch (error) {
      console.error('Error fetching companions:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupAbly = async () => {
    try {
      const Ably = (await import('ably')).default;
      const ably = new Ably.Realtime({ authUrl: '/api/ably/token', authMethod: 'GET' });
      ablyRef.current = ably;

      const channel = ably.channels.get('companions-feed');
      channel.subscribe('companion.added', (msg) => {
        const d = msg.data as {
          id: string;
          name: string;
          city: string | null;
          primaryImage: string | null;
          hourlyRate: number;
          chatRatePerMinute: number | null;
          callRatePerMinute: number | null;
          availabilityStatus: string;
        };

        setCompanions((prev) => {
          if (prev.some((c) => c.id === d.id)) return prev;
          const newEntry: CompanionRow = {
            id: d.id,
            name: d.name,
            hourlyRatePaise: d.hourlyRate,
            chatRatePerMinute: d.chatRatePerMinute,
            callRatePerMinute: d.callRatePerMinute,
            primaryImageUrl: d.primaryImage,
            avatarUrl: undefined,
            distance: 0,
            isFavorited: false,
            accessible: false,
            isVerified: false,
            averageRating: 0,
            reviewCount: 0,
            city: d.city ?? undefined,
            isNew: true,
          };
          return [newEntry, ...prev];
        });
        setTotal((t) => t + 1);
      });
    } catch {
      // Ably setup failure is non-fatal
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-gold border-t-transparent rounded-full" />
      </div>
    );
  }

  const hasLocked = !isSubscribed && total > MAX_FREE_COMPANIONS;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Browse Companions</h1>
        <p className="text-white/60 text-sm mt-0.5">
          {isSubscribed
            ? 'All companions — unlimited access'
            : `Showing ${Math.min(companions.length, MAX_FREE_COMPANIONS)} of ${total} companions`}
        </p>
      </div>

      {/* Subscription banner */}
      {hasLocked && !bannerDismissed && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-gold/10 border border-gold/25">
          <p className="text-sm text-white/70">
            You&apos;re viewing{' '}
            <span className="text-white font-medium">{MAX_FREE_COMPANIONS} of {total}</span>{' '}
            companions.{' '}
            <span className="text-gold">Subscribe for full access.</span>
          </p>
          <div className="flex items-center gap-2 ml-3 shrink-0">
            <button
              onClick={() => router.push('/client/subscription')}
              className="text-xs text-gold font-semibold hover:underline whitespace-nowrap"
            >
              Subscribe →
            </button>
            <button
              onClick={() => setBannerDismissed(true)}
              className="text-xs text-white/30 hover:text-white/60"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Companion grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {companions.map((companion) => (
          <div
            key={companion.id}
            className={companion.isNew ? 'animate-fade-in' : undefined}
            style={companion.isNew ? { animation: 'fadeIn 0.4s ease-out' } : undefined}
          >
            <CompanionCard {...companion} />
          </div>
        ))}
      </div>

      {companions.length === 0 && (
        <div className="text-center py-16">
          <svg className="w-14 h-14 mx-auto mb-4 text-white/15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-white/50">No companions available yet</p>
        </div>
      )}

      {/* Bottom CTA */}
      {hasLocked && (
        <div className="rounded-2xl border border-gold/20 bg-gradient-to-br from-gold/5 to-transparent p-6 text-center space-y-3">
          <h3 className="text-lg font-semibold text-white">Unlock all companions</h3>
          <p className="text-white/55 text-sm">
            ₹2,999/month — unlimited access to all profiles, bios, photos &amp; rates
          </p>
          <Button onClick={() => router.push('/client/subscription')} className="mx-auto">
            Subscribe Now
          </Button>
        </div>
      )}

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
