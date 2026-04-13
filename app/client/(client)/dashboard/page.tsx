'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { CompanionCard } from '@/components/CompanionCard';
import type { CompanionCardData } from '@/components/CompanionCard';

interface SectionCompanion extends CompanionCardData {
  distance: number;
  isFavorited: boolean;
  rankingScore: number;
  audioIntroUrl: string | null;
  badges: string[];
}

interface SectionsData {
  availableNow: SectionCompanion[];
  recentlyActive: SectionCompanion[];
  topRated: SectionCompanion[];
  newCompanions: SectionCompanion[];
  allCompanions: SectionCompanion[];
}

type QuickFilter = 'all' | 'online' | 'new' | 'top';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function ClientHome() {
  const [user, setUser] = useState<{ clientProfile?: { name?: string }; subscriptionStatus?: string } | null>(null);
  const [sections, setSections] = useState<SectionsData | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<QuickFilter>('all');
  const [scheduledSessions, setScheduledSessions] = useState<Array<{
    id: string; duration: number; scheduledAt: string; status: string;
    companionName: string; companionAvatar: string | null; holdAmount: number; estimatedTotal: number;
  }>>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [userRes, sectionsRes, walletRes, schedRes] = await Promise.all([
          fetch('/api/users/me'),
          fetch('/api/companions/sections'),
          fetch('/api/wallet'),
          fetch('/api/scheduled-sessions?status=BOOKED'),
        ]);
        if (userRes.ok) {
          const userData = await userRes.json();
          setUser(userData.user);
        }
        if (sectionsRes.ok) {
          const data = await sectionsRes.json();
          if (data.success) setSections(data.data);
        }
        if (walletRes.ok) {
          const walletData = await walletRes.json();
          if (walletData.success) setWalletBalance(walletData.data.balance);
        }
        if (schedRes.ok) {
          const schedData = await schedRes.json();
          if (schedData.success) setScheduledSessions(schedData.data);
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

  // Quick filter logic — filters the availableNow section
  const getFilteredCompanions = useCallback((): SectionCompanion[] => {
    if (!sections) return [];
    const all = [
      ...sections.availableNow,
      ...sections.recentlyActive,
      ...sections.topRated,
      ...sections.newCompanions,
      ...sections.allCompanions,
    ];
    // Deduplicate
    const seen = new Set<string>();
    const unique = all.filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });

    switch (activeFilter) {
      case 'online':
        return unique.filter((c) => c.availabilityStatus === 'AVAILABLE');
      case 'new':
        return sections.newCompanions;
      case 'top':
        return [...unique].sort((a, b) => b.averageRating - a.averageRating).slice(0, 20);
      default:
        return unique;
    }
  }, [sections, activeFilter]);

  if (loading) {
    return (
      <div className="space-y-8 pb-6 animate-pulse">
        {/* Hero skeleton */}
        <div className="rounded-2xl bg-white/[0.03] h-48" />
        {/* Filter chips skeleton */}
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-9 w-20 rounded-full bg-white/[0.06]" />
          ))}
        </div>
        {/* Wallet skeleton */}
        <div className="rounded-2xl bg-white/[0.03] h-20" />
        {/* Section skeleton */}
        <div className="space-y-3">
          <div className="h-5 w-32 bg-white/[0.06] rounded" />
          <div className="flex gap-3 overflow-hidden">
            {[1, 2, 3].map((i) => (
              <div key={i} className="shrink-0 w-44 h-56 rounded-xl bg-white/[0.04]" />
            ))}
          </div>
        </div>
        {/* Another section */}
        <div className="space-y-3">
          <div className="h-5 w-36 bg-white/[0.06] rounded" />
          <div className="flex gap-3 overflow-hidden">
            {[1, 2, 3].map((i) => (
              <div key={i} className="shrink-0 w-44 h-56 rounded-xl bg-white/[0.04]" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const firstName = user?.clientProfile?.name?.split(' ')[0] || 'there';
  const hasAvailableNow = (sections?.availableNow.length ?? 0) > 0;

  return (
    <div className="space-y-8 pb-6">
      {/* Hero */}
      <div className="relative rounded-2xl overflow-hidden">
        <div className="absolute inset-0 bg-gold-subtle" />
        <div className="absolute top-0 right-0 w-48 h-48 bg-gold/[0.05] rounded-full blur-3xl -translate-y-1/3 translate-x-1/4" />

        <div className="relative px-5 pt-8 pb-6">
          <p className="text-white/35 text-sm font-medium tracking-wide">{getGreeting()}, {firstName}</p>
          <h1 className="text-[26px] font-bold text-white mt-1.5 leading-[1.2]">
            Find your perfect<br />
            <span className="text-gold-gradient">companion</span> tonight
          </h1>
          <p className="text-white/25 text-[13px] mt-3 leading-relaxed max-w-[280px]">
            Verified profiles, real connections. Browse and connect instantly.
          </p>
          <Link
            href="/client/browse"
            className="inline-flex items-center gap-2 mt-5 bg-gold text-charcoal text-[13px] font-bold px-6 py-3 rounded-full hover:bg-gold-hover active:scale-[0.97] transition-all shadow-gold-md"
          >
            Explore All
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>

      {/* Quick Filters */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {[
          { key: 'all' as const, label: 'All' },
          { key: 'online' as const, label: 'Online Now', dot: true },
          { key: 'new' as const, label: 'New' },
          { key: 'top' as const, label: 'Top Rated' },
        ].map(({ key, label, dot }) => (
          <button
            key={key}
            onClick={() => setActiveFilter(key)}
            className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium transition-all ${
              activeFilter === key
                ? 'bg-gold text-black'
                : 'bg-white/[0.06] text-white/50 hover:text-white/70 hover:bg-white/[0.1]'
            }`}
          >
            {dot && (
              <span className={`w-1.5 h-1.5 rounded-full ${activeFilter === key ? 'bg-black/40' : 'bg-emerald-400'}`} />
            )}
            {label}
          </button>
        ))}
      </div>

      {/* Wallet balance widget */}
      {walletBalance !== null && (
        <Link
          href="/client/wallet"
          className="flex items-center justify-between gap-3 rounded-2xl bg-charcoal-surface border border-white/[0.06] px-5 py-4 active:scale-[0.98] transition-transform"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <p className="text-[11px] text-white/40 uppercase tracking-wider font-medium">Wallet balance</p>
              <p className="text-lg font-bold text-white mt-0.5">
                ₹{(walletBalance / 100).toLocaleString('en-IN')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs text-gold font-semibold">
            {walletBalance < 20000 ? 'Add money' : 'Recharge'}
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
      )}

      {/* Upcoming Scheduled Sessions */}
      {scheduledSessions.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-white font-semibold text-[15px] flex items-center gap-2">
            <svg className="w-4 h-4 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Upcoming Sessions
          </h2>
          {scheduledSessions.map((s) => {
            const dt = new Date(s.scheduledAt);
            const isNow = Math.abs(dt.getTime() - Date.now()) < 10 * 60 * 1000;
            return (
              <div key={s.id} className="rounded-xl bg-charcoal-surface border border-white/[0.06] px-4 py-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0 text-sm font-bold text-gold">
                  {s.duration}m
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate">Chat with {s.companionName}</p>
                  <p className="text-xs text-white/40">
                    {dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}{' '}
                    at {dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {isNow ? (
                  <Link href={`/client/inbox/${s.id}?activate=true`}
                    className="shrink-0 bg-gold text-black text-[11px] font-bold px-3 py-1.5 rounded-full">
                    Start
                  </Link>
                ) : (
                  <span className="shrink-0 text-[10px] text-white/30 font-medium">
                    {dt > new Date() ? 'Upcoming' : 'Missed'}
                  </span>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* Filtered results (when a quick filter is active other than 'all') */}
      {activeFilter !== 'all' && (
        <section>
          <SectionHeader
            title={activeFilter === 'online' ? 'Online Now' : activeFilter === 'new' ? 'New Companions' : 'Top Rated'}
            href="/client/browse"
          />
          <div className="flex gap-3 overflow-x-auto pb-2 snap-x scroll-smooth scrollbar-hide">
            {getFilteredCompanions().map((c) => (
              <CompanionCard key={c.id} companion={c} />
            ))}
          </div>
          {getFilteredCompanions().length === 0 && (
            <p className="text-white/30 text-sm text-center py-8">No companions match this filter right now</p>
          )}
        </section>
      )}

      {/* Sections (show when 'all' filter is active) */}
      {activeFilter === 'all' && (
        <>
          {/* Available Now */}
          {hasAvailableNow && (
            <section>
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success-fg opacity-60" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-success-fg" />
                  </span>
                  <h2 className="text-white font-semibold text-[15px]">Available Now</h2>
                </div>
                <span className="text-white/20 text-xs">{sections!.availableNow.length} online</span>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 snap-x scroll-smooth scrollbar-hide">
                {sections!.availableNow.map((c) => (
                  <CompanionCard key={c.id} companion={c} />
                ))}
              </div>
            </section>
          )}

          {/* Recently Active */}
          {(sections?.recentlyActive.length ?? 0) > 0 && (
            <section>
              <SectionHeader title="Recently Active" href="/client/browse" />
              <div className="flex gap-3 overflow-x-auto pb-2 snap-x scroll-smooth scrollbar-hide">
                {sections!.recentlyActive.map((c) => (
                  <CompanionCard key={c.id} companion={c} />
                ))}
              </div>
            </section>
          )}

          {/* Top Rated (GOLD only) */}
          {(sections?.topRated.length ?? 0) > 0 && (
            <section>
              <SectionHeader title="Top Rated" href="/client/browse?sortBy=rating" />
              <div className="flex gap-3 overflow-x-auto pb-2 snap-x scroll-smooth scrollbar-hide">
                {sections!.topRated.map((c) => (
                  <CompanionCard key={c.id} companion={c} />
                ))}
              </div>
            </section>
          )}

          {/* New Companions (GOLD only) */}
          {(sections?.newCompanions.length ?? 0) > 0 && (
            <section>
              <SectionHeader title="New Companions" />
              <div className="flex gap-3 overflow-x-auto pb-2 snap-x scroll-smooth scrollbar-hide">
                {sections!.newCompanions.map((c) => (
                  <CompanionCard key={c.id} companion={c} />
                ))}
              </div>
            </section>
          )}

          {/* All Companions — fallback section for offline companions */}
          {(sections?.allCompanions.length ?? 0) > 0 && (
            <section>
              <SectionHeader title="All Companions" href="/client/browse" />
              <div className="flex gap-3 overflow-x-auto pb-2 snap-x scroll-smooth scrollbar-hide">
                {sections!.allCompanions.map((c) => (
                  <CompanionCard key={c.id} companion={c} />
                ))}
              </div>
            </section>
          )}

          {/* Empty state — no one online */}
          {!hasAvailableNow && (sections?.recentlyActive.length ?? 0) === 0 && (sections?.allCompanions.length ?? 0) === 0 && (
            <section className="text-center py-10">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-white/[0.04] flex items-center justify-center">
                <svg className="w-7 h-7 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-white/40 text-sm">No companions available right now</p>
              <p className="text-white/20 text-xs mt-1">Check back soon or browse all profiles</p>
              <Link
                href="/client/browse"
                className="inline-block mt-4 text-gold text-sm font-medium hover:text-gold-hover transition-colors"
              >
                Browse All Companions
              </Link>
            </section>
          )}
        </>
      )}

      {/* GOLD CTA */}
      {!isSubscribed && (
        <section>
          <div className="relative rounded-2xl overflow-hidden border border-gold/10 gold-border-glow">
            <div className="absolute inset-0 bg-gold-subtle" />
            <div className="relative flex items-center justify-between gap-4 p-5">
              <div>
                <p className="text-sm font-bold text-white">Unlock all social companions</p>
                <p className="text-[11px] text-white/30 mt-0.5">GOLD — full access for events, dining & travel</p>
              </div>
              <Link
                href="/client/subscription"
                className="shrink-0 bg-gold text-charcoal text-[11px] font-bold px-4 py-2.5 rounded-full hover:bg-gold-hover active:scale-[0.96] transition-all shadow-gold-sm"
              >
                Upgrade
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Trust strip */}
      <section className="pt-2">
        <div className="flex items-center justify-center gap-8 py-5 border-t border-white/[0.04]">
          <TrustItem icon="shield" label="Verified Profiles" />
          <TrustItem icon="lock" label="Secure Payments" />
          <TrustItem icon="support" label="24/7 Support" />
        </div>
      </section>
    </div>
  );
}

function SectionHeader({ title, href }: { title: string; href?: string }) {
  return (
    <div className="flex items-baseline justify-between mb-3.5">
      <h2 className="text-white font-semibold text-[15px]">{title}</h2>
      {href && (
        <Link href={href} className="text-gold/70 hover:text-gold text-xs font-medium transition-colors">
          See all &rarr;
        </Link>
      )}
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
    <div className="flex items-center gap-2">
      <svg className="w-3.5 h-3.5 text-gold/40" viewBox="0 0 20 20" fill="currentColor">
        {icons[icon]}
      </svg>
      <span className="text-white/20 text-[10px] font-medium tracking-wide">{label}</span>
    </div>
  );
}
