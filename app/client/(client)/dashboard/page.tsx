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

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

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

  const { todaysPicks, availableNow, recommended } = useMemo(() => {
    const accessible = companions.filter((c) => c.accessible);
    const online = companions.filter((c) => c.availabilityStatus === 'AVAILABLE');
    const topRated = [...companions].sort((a, b) => b.averageRating - a.averageRating);

    const picks = accessible.length > 0 ? accessible.slice(0, 6) : companions.slice(0, 6);
    const available = online.slice(0, 6);

    const pickIds = new Set(picks.map((p) => p.id));
    const recs = topRated.filter((c) => !pickIds.has(c.id)).slice(0, 6);

    return { todaysPicks: picks, availableNow: available, recommended: recs };
  }, [companions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin h-8 w-8 border-2 border-[#C9A96E] border-t-transparent rounded-full" />
      </div>
    );
  }

  const firstName = user?.clientProfile?.name?.split(' ')[0] || 'there';

  return (
    <div className="space-y-8 pb-6">
      {/* Hero */}
      <div className="relative rounded-2xl overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#C9A96E]/[0.08] via-[#C9A96E]/[0.03] to-transparent" />
        <div className="absolute top-0 right-0 w-48 h-48 bg-[#C9A96E]/[0.06] rounded-full blur-3xl -translate-y-1/3 translate-x-1/4" />

        <div className="relative px-5 pt-8 pb-6">
          <p className="text-white/40 text-sm font-medium tracking-wide">{getGreeting()}, {firstName}</p>
          <h1 className="text-[26px] font-bold text-white mt-1.5 leading-[1.2]">
            Find your perfect<br />
            <span className="text-[#C9A96E]">companion</span> tonight
          </h1>
          <p className="text-white/30 text-[13px] mt-2.5 leading-relaxed max-w-[280px]">
            Verified profiles, real connections. Browse and connect instantly.
          </p>
          <Link
            href="/client/browse"
            className="inline-flex items-center gap-2 mt-5 bg-[#C9A96E] text-black text-[13px] font-bold px-6 py-3 rounded-full hover:bg-[#d4b87a] active:scale-[0.97] transition-all shadow-lg shadow-[#C9A96E]/20"
          >
            Explore All
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>

      {/* Today's Picks */}
      {todaysPicks.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between mb-3.5">
            <h2 className="text-white font-semibold text-[15px]">Today&apos;s Picks</h2>
            <Link href="/client/browse" className="text-[#C9A96E] text-xs font-medium">
              See all &rarr;
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 snap-x scroll-smooth scrollbar-hide">
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
        <section>
          <div className="flex items-center justify-between mb-3.5">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
              </span>
              <h2 className="text-white font-semibold text-[15px]">Available Now</h2>
            </div>
            <span className="text-white/25 text-xs">{availableNow.length} online</span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 snap-x scroll-smooth scrollbar-hide">
            {availableNow.map((c) => (
              <CompanionCard key={c.id} companion={c} />
            ))}
          </div>
        </section>
      )}

      {/* Recommended */}
      {recommended.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between mb-3.5">
            <h2 className="text-white font-semibold text-[15px]">Recommended</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 snap-x scroll-smooth scrollbar-hide">
            {recommended.map((c) => (
              <CompanionCard key={c.id} companion={c} />
            ))}
          </div>
        </section>
      )}

      {/* Premium CTA */}
      {!isSubscribed && (
        <section>
          <div className="relative rounded-2xl overflow-hidden border border-[#C9A96E]/15">
            <div className="absolute inset-0 bg-gradient-to-r from-[#C9A96E]/[0.06] to-transparent" />
            <div className="relative flex items-center justify-between gap-4 p-5">
              <div>
                <p className="text-[13px] font-bold text-white">Unlock all companions</p>
                <p className="text-[11px] text-white/35 mt-0.5">Premium — unlimited profiles & priority access</p>
              </div>
              <Link
                href="/client/subscription"
                className="shrink-0 bg-[#C9A96E] text-black text-[11px] font-bold px-4 py-2.5 rounded-full hover:bg-[#d4b87a] active:scale-[0.96] transition-all"
              >
                Upgrade
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Trust strip */}
      <section className="pt-2">
        <div className="flex items-center justify-center gap-6 py-4 border-t border-white/[0.04]">
          <TrustItem icon="shield" label="Verified" />
          <TrustItem icon="lock" label="Secure" />
          <TrustItem icon="support" label="24/7 Support" />
        </div>
      </section>
    </div>
  );
}

function TrustItem({ icon, label }: { icon: 'shield' | 'lock' | 'support'; label: string }) {
  const icons = {
    shield: <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />,
    lock: <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />,
    support: <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />,
  };

  return (
    <div className="flex items-center gap-1.5">
      <svg className="w-3.5 h-3.5 text-[#C9A96E]/60" viewBox="0 0 20 20" fill="currentColor">
        {icons[icon]}
      </svg>
      <span className="text-white/20 text-[10px] font-medium">{label}</span>
    </div>
  );
}
