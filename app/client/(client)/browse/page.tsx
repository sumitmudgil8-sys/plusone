"use client";
'use client';

import { useEffect, useState, useCallback } from 'react';
import { CompanionCard } from '@/components/companion/CompanionCard';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { SearchFilters } from '@/components/search/SearchFilters';
import { SUBSCRIPTION_PRICE } from '@/lib/constants';
import { formatCurrency } from '@/lib/utils';
import { useRouter } from 'next/navigation';

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
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

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
      setCompanions(data.companions);
    } catch (error) {
      console.error('Error fetching companions:', error);
    } finally {
      setLoading(false);
    }
  }, [filters, selectedDate]);

  useEffect(() => {
    fetchCompanions();
  }, [fetchCompanions]);

  const handleCardClick = (accessible: boolean) => {
    if (!accessible) {
      setShowUpgradeModal(true);
      return false;
    }
    return true;
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Browse Companions</h1>
          <p className="text-white/60">Find the perfect companion near you</p>
        </div>
        <SearchFilters filters={filters} onChange={setFilters} />
      </div>

      {/* Filters */}
      <div className="bg-charcoal-surface border border-charcoal-border rounded-2xl p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Price Range: ₹{filters.minPrice} - ₹{filters.maxPrice}
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
            <label className="block text-sm font-medium text-white/80 mb-2">
              Available Date
            </label>
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
              <option value="price">Price (Low to High)</option>
              <option value="rating">Rating (High to Low)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(companions as any[]).map((companion) => (
          <div
            key={companion.id}
            onClick={() => !handleCardClick(companion.accessible)}
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
          <p className="text-white/60 text-lg">No companions found matching your criteria</p>
          <p className="text-white/40 text-sm mt-2">Try adjusting your filters</p>
        </div>
      )}

      {/* Upgrade Modal */}
      <Modal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        title="Upgrade to Premium"
      >
        <div className="space-y-4">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gold/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-white mb-2">
              This Companion is Locked
            </h3>
            <p className="text-white/60">
              Free members can only browse the first 20 companions.
              Upgrade to Premium for unlimited access.
            </p>
          </div>

          <ul className="space-y-2 text-sm text-white/70">
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-success" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Unlimited companion browsing
            </li>
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-success" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Unlimited messages
            </li>
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-success" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Priority booking requests
            </li>
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-success" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Advanced search filters
            </li>
          </ul>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowUpgradeModal(false)}
              className="flex-1"
            >
              Maybe Later
            </Button>
            <Button
              onClick={() => router.push('/client/profile')}
              className="flex-1"
            >
              Upgrade for {formatCurrency(SUBSCRIPTION_PRICE)}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
