'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { CompanionCard } from '@/components/CompanionCard';
import type { CompanionCardData } from '@/components/CompanionCard';

interface Companion extends CompanionCardData {
  distance: number;
  isFavorited: boolean;
}

const SCARCITY_LABELS = ['Just joined', 'High demand', 'Top rated', 'Rising star', 'Popular'];

export default function ClientHome() {
  const [user, setUser] = useState<{ clientProfile?: { name?: string }; subscriptionStatus?: string } | null>(null);
  const [companions, setCompanions] = useState<Companion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [userRes, companionsRes] = await Promise.all([
          fetch('/api/users/me'),
          fetch('/api/companions'),
        ]);

        if (userRes.ok) {
          const userData = await userRes.json();
          setUser(userData.user);
        }
        if (companionsRes.ok) {
          const data = await companionsRes.json();
          setCompanions(data.companions ?? []);
        }
      } catch (error) {
        console.error('Error fetching home data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const isSubscribed = user?.subscriptionStatus === 'ACTIVE';

  // Curate sections from the companion list
  const { todaysPicks, availableNow, recommended } = useMemo(() => {
    const accessible = companions.filter((c) => c.accessible);
    const online = companions.filter((c) => c.availabilityStatus === 'AVAILABLE');
    const topRated = [...companions].sort((a, b) => b.averageRating - a.averageRating);

    // Today's Picks — mix of top rated + accessible, max 6
    const picks = accessible.length > 0 ? accessible.slice(0, 6) : companions.slice(0, 6);

    // Available Now — online companions, max 6
    const available = online.slice(0, 6);

    // Recommended — top rated, excluding duplicates from picks, max 6
    const pickIds = new Set(picks.map((p) => p.id));
    const recs = topRated.filter((c) => !pickIds.has(c.id)).slice(0, 6);

    return { todaysPicks: picks, availableNow: available, recommended: recs };
  }, [companions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0B0B0B]">
        <div className="animate-spin h-8 w-8 border-2 border-[#C9A96E] border-t-transparent rounded-full" />
      </div>
    );
  }

  const firstName = user?.clientProfile?.name?.split(' ')[0] || 'there';

  return (
    <div className="space-y-8 -mx-4 -mt-6">
      {/* Hero Section */}
      <div className="relative px-5 pt-8 pb-6">
        <div className="absolute inset-0 bg-gradient-to-b from-[#C9A96E]/8 to-transparent pointer-events-none" />
        <div className="relative">
          <p className="text-white/50 text-sm">Good evening, {firstName}</p>
          <h1 className="text-2xl font-bold text-white mt-1 leading-tight">
            Find your perfect<br />
            <span className="text-[#C9A96E]">companion</span> tonight
          </h1>
          <p className="text-white/40 text-sm mt-2 max-w-xs">
            Hand-picked profiles, verified and ready to connect.
          </p>
          <Link
            href="/client/browse"
            className="inline-flex items-center gap-2 mt-4 bg-[#C9A96E] text-black text-sm font-semibold px-5 py-2.5 rounded-full hover:bg-[#d4b87a] transition-colors"
          >
            Explore All
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>

      {/* Today's Picks */}
      {todaysPicks.length > 0 && (
        <section className="px-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-white font-semibold text-base">Today&apos;s Picks</h2>
              <p className="text-white/30 text-xs mt-0.5">Curated just for you</p>
            </div>
            <Link href="/client/browse" className="text-[#C9A96E] text-xs font-medium">
              See all
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 snap-x scroll-smooth -mx-5 px-5 scrollbar-hide">
            {todaysPicks.map((c, i) => (
              <CompanionCard
                key={c.id}
                companion={c}
                scarcityLabel={i < 2 ? SCARCITY_LABELS[i % SCARCITY_LABELS.length] : undefined}
              />
            ))}
          </div>
        </section>
      )}

      {/* Available Now */}
      {availableNow.length > 0 && (
        <section className="px-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <h2 className="text-white font-semibold text-base">Available Now</h2>
            </div>
            <span className="text-white/30 text-xs">{availableNow.length} online</span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 snap-x scroll-smooth -mx-5 px-5 scrollbar-hide">
            {availableNow.map((c) => (
              <CompanionCard key={c.id} companion={c} />
            ))}
          </div>
        </section>
      )}

      {/* Recommended for You */}
      {recommended.length > 0 && (
        <section className="px-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-white font-semibold text-base">Recommended for You</h2>
              <p className="text-white/30 text-xs mt-0.5">Based on your preferences</p>
            </div>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 snap-x scroll-smooth -mx-5 px-5 scrollbar-hide">
            {recommended.map((c) => (
              <CompanionCard key={c.id} companion={c} />
            ))}
          </div>
        </section>
      )}

      {/* Subscription CTA (free users) */}
      {!isSubscribed && (
        <section className="px-5">
          <div className="rounded-2xl border border-[#C9A96E]/20 bg-gradient-to-br from-[#C9A96E]/5 to-transparent p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white">Unlock all companions</p>
                <p className="text-xs text-white/40 mt-0.5">Premium access — unlimited profiles</p>
              </div>
              <Link
                href="/client/subscription"
                className="shrink-0 bg-[#C9A96E] text-black text-xs font-semibold px-4 py-2 rounded-full hover:bg-[#d4b87a] transition-colors"
              >
                Subscribe
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Trust Strip */}
      <section className="px-5 pb-8">
        <div className="flex items-center justify-center gap-6 py-4 border-t border-white/5">
          <div className="flex items-center gap-1.5">
            <svg className="w-4 h-4 text-[#C9A96E]" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="text-white/30 text-[11px]">Verified Profiles</span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg className="w-4 h-4 text-[#C9A96E]" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            <span className="text-white/30 text-[11px]">Secure Payments</span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg className="w-4 h-4 text-[#C9A96E]" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
            </svg>
            <span className="text-white/30 text-[11px]">24/7 Support</span>
          </div>
        </div>
      </section>
    </div>
  );
}
