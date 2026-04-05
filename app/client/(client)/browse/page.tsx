'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { CompanionCard } from '@/components/companion/CompanionCard';
import { Button } from '@/components/ui/Button';
import { SearchFilters } from '@/components/search/SearchFilters';
import { MAX_FREE_COMPANIONS } from '@/lib/constants';

interface Filters {
  minPrice: number;
  maxPrice: number;
  gender: string;
  minAge: number;
  maxAge: number;
  languages: string[];
  interests: string[];
  sortBy: string;
}

export default function BrowsePage() {
  const router = useRouter();
  const [companions, setCompanions] = useState<any[]>([]);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const [filters, setFilters] = useState<Filters>({
    minPrice: 0,
    maxPrice: 10000,
    gender: '',
    minAge: 18,
    maxAge: 60,
    languages: [],
    interests: [],
    sortBy: 'distance',
  });

  const fetchCompanions = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filters.minPrice > 0) params.append('minPrice', filters.minPrice.toString());
      if (filters.maxPrice < 10000) params.append('maxPrice', filters.maxPrice.toString());
      if (selectedDate) params.append('date', selectedDate);
      if (filters.gender) params.append('gender', filters.gender);
      if (filters.minAge) params.append('minAge', filters.minAge.toString());
      if (filters.maxAge) params.append('maxAge', filters.maxAge.toString());
      if (filters.languages.length > 0) params.append('languages', filters.languages.join(','));
      if (filters.interests.length > 0) params.append('interests', filters.interests.join(','));
      if (filters.sortBy) params.append('sortBy', filters.sortBy);

      const res = await fetch(`/api/companions?${params.toString()}`);
      const data = await res.json();
      setCompanions(data.companions ?? []);
      setIsSubscribed(data.isSubscribed ?? false);
      setTotal(data.total ?? 0);
    } catch (error) {
      console.error('Error fetching companions:', error);
    } finally {
      setLoading(false);
    }
  }, [filters, selectedDate]);

  useEffect(() => {
    fetchCompanions();
  }, [fetchCompanions]);

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Browse Companions</h1>
          <p className="text-white/60">
            {isSubscribed
              ? 'All companions — unlimited access'
              : `Showing ${Math.min(total, MAX_FREE_COMPANIONS)} of ${total} companions`}
          </p>
        </div>
        <SearchFilters filters={filters} onChange={setFilters} />
      </div>

      {/* Filters */}
      <div className="bg-charcoal-surface border border-charcoal-border rounded-2xl p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Rate: up to ₹{filters.maxPrice}/hr
            </label>
            <input
              type="range"
              min="0"
              max="10000"
              step="500"
              value={filters.maxPrice}
              onChange={(e) => setFilters((prev) => ({ ...prev, maxPrice: parseInt(e.target.value) }))}
              className="w-full h-2 bg-charcoal-border rounded-lg appearance-none cursor-pointer accent-gold"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">Available Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full bg-charcoal border border-charcoal-border text-white rounded-lg px-4 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">Sort By</label>
            <select
              value={filters.sortBy}
              onChange={(e) => setFilters((prev) => ({ ...prev, sortBy: e.target.value }))}
              className="w-full bg-charcoal border border-charcoal-border text-white rounded-lg px-4 py-2"
            >
              <option value="distance">Distance</option>
              <option value="price">Rate (Low to High)</option>
              <option value="rating">Rating (High to Low)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Subscription banner for free tier */}
      {hasLocked && !bannerDismissed && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-gold/10 border border-gold/25">
          <p className="text-sm text-white/70">
            You&apos;re viewing{' '}
            <span className="text-white font-medium">{MAX_FREE_COMPANIONS} of {total}</span>{' '}
            companions.
            <span className="text-gold ml-1">Subscribe for full access.</span>
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

      {/* Results */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(companions as any[]).map((companion) => (
          <CompanionCard key={companion.id} {...companion} />
        ))}
      </div>

      {companions.length === 0 && (
        <div className="text-center py-12">
          <svg className="w-16 h-16 mx-auto mb-4 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-white/60 text-lg">No companions found</p>
          <p className="text-white/40 text-sm mt-2">Try adjusting your filters</p>
        </div>
      )}

      {/* Bottom subscription CTA for free users */}
      {hasLocked && (
        <div className="rounded-2xl border border-gold/20 bg-gradient-to-br from-gold/5 to-transparent p-6 text-center space-y-4">
          <h3 className="text-lg font-semibold text-white">Unlock all companions</h3>
          <p className="text-white/60 text-sm">
            ₹2,999/month — unlimited access to all profiles, bios, photos, and rates
          </p>
          <Button onClick={() => router.push('/client/subscription')} className="mx-auto">
            Subscribe Now
          </Button>
        </div>
      )}
    </div>
  );
}
