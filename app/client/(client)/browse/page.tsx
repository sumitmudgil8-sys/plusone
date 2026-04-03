'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { CompanionCard } from '@/components/companion/CompanionCard';
import { Modal } from '@/components/ui/Modal';
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
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');
  const [showWalletModal, setShowWalletModal] = useState(false);

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
    } catch (error) {
      console.error('Error fetching companions:', error);
    } finally {
      setLoading(false);
    }
  }, [filters, selectedDate]);

  useEffect(() => {
    fetchCompanions();
  }, [fetchCompanions]);

  const handleLockedClick = () => {
    setShowWalletModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-gold border-t-transparent rounded-full" />
      </div>
    );
  }

  const accessibleCount = companions.filter((c) => c.accessible).length;
  const hasLocked = companions.some((c) => !c.accessible);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Browse Companions</h1>
          <p className="text-white/60">Pay per minute · No subscription required</p>
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

      {/* Free limit info banner */}
      {hasLocked && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-gold/10 border border-gold/25">
          <p className="text-sm text-white/70">
            Showing first {MAX_FREE_COMPANIONS} companions free.
            <span className="text-gold ml-1">Recharge your wallet to browse all.</span>
          </p>
          <button
            onClick={() => router.push('/client/profile')}
            className="text-xs text-gold font-semibold whitespace-nowrap ml-3 hover:underline"
          >
            Add Money →
          </button>
        </div>
      )}

      {/* Results */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(companions as any[]).map((companion) => (
          <div
            key={companion.id}
            onClick={() => !companion.accessible && handleLockedClick()}
          >
            <CompanionCard {...companion} />
          </div>
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

      {/* Wallet recharge modal */}
      <Modal
        isOpen={showWalletModal}
        onClose={() => setShowWalletModal(false)}
        title="Recharge Wallet to Continue"
      >
        <div className="space-y-4">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gold/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-white mb-2">Browse All Companions</h3>
            <p className="text-white/60 text-sm">
              You&apos;ve browsed the first {MAX_FREE_COMPANIONS} companions for free.
              Recharge your wallet to unlock all profiles.
            </p>
          </div>

          <ul className="space-y-2 text-sm text-white/70">
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gold shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Pay only for time spent — per minute billing
            </li>
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gold shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              No subscription — no recurring charges
            </li>
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gold shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Balance never expires
            </li>
          </ul>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowWalletModal(false)} className="flex-1">
              Maybe Later
            </Button>
            <Button onClick={() => { setShowWalletModal(false); router.push('/client/profile'); }} className="flex-1">
              Recharge Wallet
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
