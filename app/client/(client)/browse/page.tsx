'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CompanionCard } from '@/components/companion/CompanionCard';
import { Button } from '@/components/ui/Button';
import { MAX_FREE_COMPANIONS } from '@/lib/constants';
import { useLocation } from '@/hooks/useLocation';

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
  availableNow?: boolean;
}

type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

const DAY_OPTIONS: { key: DayKey; label: string }[] = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
];

function getCurrentDayKey(): DayKey {
  const dayMap: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return dayMap[new Date().getDay()];
}

function getCurrentSlot(): string {
  const h = new Date().getHours();
  if (h >= 6 && h < 12) return 'MORNING';
  if (h >= 12 && h < 17) return 'AFTERNOON';
  if (h >= 17 && h < 21) return 'EVENING';
  return 'NIGHT';
}

export default function BrowsePage() {
  const router = useRouter();
  const { getLocationIfGranted } = useLocation();
  const [companions, setCompanions] = useState<CompanionRow[]>([]);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [nearbyMode, setNearbyMode] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationToast, setLocationToast] = useState('');
  const [filterAvailableNow, setFilterAvailableNow] = useState(false);
  const [filterDay, setFilterDay] = useState<DayKey | ''>('');
  const ablyRef = useRef<import('ably').Realtime | null>(null);

  // On mount: silently fetch location if already granted
  useEffect(() => {
    getLocationIfGranted().then((coords) => {
      if (coords) {
        setUserLocation({ lat: coords.latitude, lng: coords.longitude });
      }
    });
  }, []);

  useEffect(() => {
    fetchCompanions();
    setupAbly();
    return () => {
      ablyRef.current?.close();
    };
  }, []);

  // Re-fetch when filters change
  useEffect(() => {
    if (!loading) fetchCompanions();
  }, [nearbyMode, userLocation, filterAvailableNow, filterDay]);

  const fetchCompanions = async () => {
    try {
      const params = new URLSearchParams();
      if (nearbyMode && userLocation) {
        params.set('lat', String(userLocation.lat));
        params.set('lng', String(userLocation.lng));
        params.set('radius', '50');
      }
      if (filterAvailableNow) params.set('availableNow', 'true');
      if (filterDay) {
        params.set('availableDay', filterDay);
        // Also filter by current time slot when filtering by today
        if (filterDay === getCurrentDayKey()) {
          params.set('availableSlot', getCurrentSlot());
        }
      }
      const qs = params.toString();
      let url = `/api/companions${qs ? `?${qs}` : ''}`;
      const res = await fetch(url);
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

  const handleNearbyToggle = async (enable: boolean) => {
    if (!enable) {
      setNearbyMode(false);
      return;
    }

    if (userLocation) {
      setNearbyMode(true);
      return;
    }

    // Request location
    if (!('geolocation' in navigator)) {
      setLocationToast('Location not supported on this device');
      setTimeout(() => setLocationToast(''), 3000);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setNearbyMode(true);
      },
      () => {
        setLocationToast('Location access needed for nearby search');
        setTimeout(() => setLocationToast(''), 3000);
      }
    );
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Browse Companions</h1>
          <p className="text-white/60 text-sm mt-0.5">
            {nearbyMode
              ? `${companions.length} companion${companions.length !== 1 ? 's' : ''} nearby`
              : isSubscribed
              ? 'All companions — unlimited access'
              : `Showing ${Math.min(companions.length, MAX_FREE_COMPANIONS)} of ${total} companions`}
          </p>
        </div>

        {/* Nearby toggle — only show if location is available or requestable */}
        {('geolocation' in (typeof navigator !== 'undefined' ? navigator : {})) && (
          <div className="flex items-center gap-1 shrink-0 bg-charcoal-surface border border-white/[0.06] rounded-full p-1">
            <button
              onClick={() => handleNearbyToggle(false)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                !nearbyMode
                  ? 'bg-gold text-black'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              All
            </button>
            <button
              onClick={() => handleNearbyToggle(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                nearbyMode
                  ? 'bg-gold text-black'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Nearby
            </button>
          </div>
        )}
      </div>

      {/* Location denied toast */}
      {locationToast && (
        <div className="p-3 rounded-xl bg-error/10 border border-error/30 text-error text-sm text-center">
          {locationToast}
        </div>
      )}

      {/* Availability filters */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        <button
          onClick={() => setFilterAvailableNow(!filterAvailableNow)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap transition-colors ${
            filterAvailableNow
              ? 'bg-green-500/15 border-green-500/30 text-green-400'
              : 'bg-charcoal-surface border-white/[0.06] text-white/50 hover:text-white/70'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${filterAvailableNow ? 'bg-green-400' : 'bg-white/20'}`} />
          Available Now
        </button>

        {DAY_OPTIONS.map((d) => (
          <button
            key={d.key}
            onClick={() => setFilterDay(filterDay === d.key ? '' : d.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap transition-colors ${
              filterDay === d.key
                ? 'bg-gold/15 border-gold/30 text-gold'
                : 'bg-charcoal-surface border-white/[0.06] text-white/50 hover:text-white/70'
            }`}
          >
            {d.label}
          </button>
        ))}

        {(filterAvailableNow || filterDay) && (
          <button
            onClick={() => { setFilterAvailableNow(false); setFilterDay(''); }}
            className="px-3 py-1.5 rounded-full text-xs font-medium text-white/30 hover:text-white/60 transition-colors whitespace-nowrap"
          >
            Clear
          </button>
        )}
      </div>

      {/* Subscription banner */}
      {hasLocked && !bannerDismissed && !nearbyMode && (
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
            <CompanionCard {...companion} nearbyMode={nearbyMode} />
          </div>
        ))}
      </div>

      {companions.length === 0 && nearbyMode && (
        <div className="text-center py-16">
          <svg className="w-14 h-14 mx-auto mb-4 text-white/15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          </svg>
          <p className="text-white/50 font-medium">No companions found nearby</p>
          <p className="text-white/30 text-sm mt-1">Try increasing your search area or view all companions</p>
          <button
            onClick={() => setNearbyMode(false)}
            className="mt-4 px-5 py-2 rounded-full bg-gold/20 border border-gold/30 text-gold text-sm font-medium hover:bg-gold/30 transition-colors"
          >
            View All
          </button>
        </div>
      )}

      {companions.length === 0 && !nearbyMode && (
        <div className="text-center py-16">
          <svg className="w-14 h-14 mx-auto mb-4 text-white/15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-white/50">No companions available yet</p>
        </div>
      )}

      {/* Bottom CTA */}
      {hasLocked && !nearbyMode && (
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
