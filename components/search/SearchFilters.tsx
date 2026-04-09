"use client";
'use client';

import { useState } from 'react';
import { LANGUAGES, INTERESTS, GENDERS } from '@/lib/constants';

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

interface SearchFiltersProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
}

export function SearchFilters({ filters, onChange }: SearchFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localFilters, setLocalFilters] = useState(filters);

  const handleApply = () => {
    onChange(localFilters);
    setIsOpen(false);
  };

  const handleReset = () => {
    const resetFilters = {
      minPrice: 0,
      maxPrice: 10000,
      gender: '',
      minAge: 18,
      maxAge: 60,
      languages: [],
      interests: [],
      sortBy: 'distance',
    };
    setLocalFilters(resetFilters);
    onChange(resetFilters);
  };

  const toggleLanguage = (lang: string) => {
    setLocalFilters((prev) => ({
      ...prev,
      languages: prev.languages.includes(lang)
        ? prev.languages.filter((l) => l !== lang)
        : [...prev.languages, lang],
    }));
  };

  const toggleInterest = (interest: string) => {
    setLocalFilters((prev) => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter((i) => i !== interest)
        : [...prev.interests, interest],
    }));
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-charcoal-surface border border-charcoal-border text-white rounded-lg hover:border-gold/50 transition-colors"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
        Filters
        {(localFilters.languages.length > 0 || localFilters.interests.length > 0 || localFilters.gender) && (
          <span className="w-2 h-2 bg-gold rounded-full" />
        )}
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-charcoal-surface border border-charcoal-border rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-charcoal-border">
              <h2 className="text-lg font-semibold text-white">Filters</h2>
              <button onClick={() => setIsOpen(false)} className="text-white/60 hover:text-white">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 space-y-6">
              {/* Sort By */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">Sort By</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'distance', label: 'Distance' },
                    { value: 'price', label: 'Price' },
                    { value: 'rating', label: 'Rating' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setLocalFilters((prev) => ({ ...prev, sortBy: option.value }))}
                      className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                        localFilters.sortBy === option.value
                          ? 'bg-gold text-charcoal'
                          : 'bg-charcoal border border-charcoal-border text-white/70 hover:border-gold/50'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price Range */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Price Range: ₹{localFilters.minPrice} - ₹{localFilters.maxPrice}
                </label>
                <input
                  type="range"
                  min="0"
                  max="10000"
                  step="500"
                  value={localFilters.maxPrice}
                  onChange={(e) => setLocalFilters((prev) => ({ ...prev, maxPrice: parseInt(e.target.value) }))}
                  className="w-full h-2 bg-white/[0.08] rounded-lg appearance-none cursor-pointer accent-gold"
                />
              </div>

              {/* Gender */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">Gender</label>
                <div className="flex flex-wrap gap-2">
                  {GENDERS.map((gender) => (
                    <button
                      key={gender}
                      onClick={() => setLocalFilters((prev) => ({ ...prev, gender: prev.gender === gender ? '' : gender }))}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        localFilters.gender === gender
                          ? 'bg-gold text-charcoal'
                          : 'bg-charcoal border border-charcoal-border text-white/70 hover:border-gold/50'
                      }`}
                    >
                      {gender}
                    </button>
                  ))}
                </div>
              </div>

              {/* Age Range */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Age: {localFilters.minAge} - {localFilters.maxAge}
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="18"
                    max="60"
                    value={localFilters.minAge}
                    onChange={(e) => setLocalFilters((prev) => ({ ...prev, minAge: parseInt(e.target.value) }))}
                    className="flex-1 h-2 bg-white/[0.08] rounded-lg appearance-none cursor-pointer accent-gold"
                  />
                  <input
                    type="range"
                    min="18"
                    max="60"
                    value={localFilters.maxAge}
                    onChange={(e) => setLocalFilters((prev) => ({ ...prev, maxAge: parseInt(e.target.value) }))}
                    className="flex-1 h-2 bg-white/[0.08] rounded-lg appearance-none cursor-pointer accent-gold"
                  />
                </div>
              </div>

              {/* Languages */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">Languages</label>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang}
                      onClick={() => toggleLanguage(lang)}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        localFilters.languages.includes(lang)
                          ? 'bg-gold text-charcoal'
                          : 'bg-charcoal border border-charcoal-border text-white/70 hover:border-gold/50'
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              </div>

              {/* Interests */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">Interests</label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {INTERESTS.map((interest) => (
                    <button
                      key={interest}
                      onClick={() => toggleInterest(interest)}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        localFilters.interests.includes(interest)
                          ? 'bg-gold text-charcoal'
                          : 'bg-charcoal border border-charcoal-border text-white/70 hover:border-gold/50'
                      }`}
                    >
                      {interest}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 p-4 border-t border-charcoal-border">
              <button
                onClick={handleReset}
                className="flex-1 py-3 border border-charcoal-border text-white rounded-lg hover:bg-white/5 transition-colors"
              >
                Reset
              </button>
              <button
                onClick={handleApply}
                className="flex-1 py-3 bg-gold text-charcoal rounded-lg hover:bg-gold/90 transition-colors font-medium"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
