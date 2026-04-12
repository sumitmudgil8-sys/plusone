'use client';

import Link from 'next/link';
import Image from 'next/image';
import React, { useState, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { formatDistance, cn } from '@/lib/utils';

interface CompanionCardProps {
  id: string;
  name: string;
  bio?: string;
  hourlyRatePaise: number;
  chatRatePerMinute?: number | null;
  callRatePerMinute?: number | null;
  avatarUrl?: string;
  primaryImageUrl?: string | null;
  images?: string[];
  distance: number;
  isFavorited: boolean;
  accessible: boolean;
  isVerified?: boolean;
  averageRating?: number;
  reviewCount?: number;
  gender?: string;
  age?: number;
  city?: string;
  nearbyMode?: boolean;
  availableNow?: boolean;
}

export const CompanionCard = React.memo(function CompanionCard({
  id,
  name,
  hourlyRatePaise,
  avatarUrl,
  primaryImageUrl,
  distance,
  isFavorited: initialFavorited,
  accessible,
  isVerified,
  averageRating = 0,
  reviewCount = 0,
  gender,
  age,
  city,
  nearbyMode = false,
  availableNow = false,
}: CompanionCardProps) {
  const [isFavorited, setIsFavorited] = useState(initialFavorited);

  const displayImage = primaryImageUrl ?? avatarUrl ?? null;
  const bookingRateDisplay = hourlyRatePaise > 0
    ? `₹${Math.round(hourlyRatePaise / 100).toLocaleString('en-IN')}/hr`
    : null;

  const toggleFavorite = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const res = await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companionId: id }),
      });
      const data = await res.json();
      if (data.success) setIsFavorited(data.isFavorited);
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  }, [id]);

  return (
    <Link href={accessible ? `/client/booking/${id}` : '/client/subscription'}>
      <Card
        className={cn(
          'group relative overflow-hidden transition-all duration-300 p-0',
          accessible ? 'cursor-pointer hover:shadow-xl hover:border-gold/30' : 'cursor-pointer'
        )}
      >
        {/* Image */}
        <div className="relative aspect-[3/4] bg-charcoal-surface overflow-hidden">
          {displayImage ? (
            <Image
              src={displayImage}
              alt={name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className={cn(
                'object-cover transition-transform duration-300',
                accessible && 'group-hover:scale-105',
                !accessible && 'blur-sm scale-105'
              )}
            />
          ) : (
            <div className={cn(
              'w-full h-full flex items-center justify-center text-4xl font-medium text-white/30 bg-charcoal',
              !accessible && 'blur-sm'
            )}>
              {name.charAt(0)}
            </div>
          )}

          {/* Dark gradient overlay at bottom */}
          <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />

          {/* Nearby distance badge — bottom-left pill */}
          {nearbyMode && accessible && distance > 0 && (
            <div className="absolute bottom-2 left-2 z-10">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm text-xs text-white/80">
                <svg className="w-3 h-3 text-gold shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {formatDistance(distance)} away
              </span>
            </div>
          )}

          {/* Badges top-left */}
          {accessible && (
            <div className="absolute top-2 left-2 flex flex-col gap-1 items-start">
              {availableNow && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/90 text-white text-[10px] font-semibold backdrop-blur-sm shadow-lg shadow-black/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  Available
                </span>
              )}
              {isVerified && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-info/90 text-white text-[10px] font-semibold backdrop-blur-sm shadow-lg shadow-black/30">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Verified
                </span>
              )}
              {accessible && reviewCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-[10px] font-semibold text-white shadow-lg shadow-black/30">
                  <svg className="w-3 h-3 text-amber-400 fill-current" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  {averageRating.toFixed(1)}
                </span>
              )}
            </div>
          )}

          {/* Favorite button */}
          {accessible && (
            <button
              onClick={toggleFavorite}
              className={cn(
                'absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition-colors',
                'bg-black/40 backdrop-blur-sm hover:bg-black/60',
                isFavorited ? 'text-error-fg' : 'text-white/70 hover:text-white'
              )}
            >
              <svg className="w-4 h-4" fill={isFavorited ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </button>
          )}

          {/* Content overlay at bottom */}
          <div className="absolute bottom-0 inset-x-0 p-3">
            <div className="flex items-end justify-between">
              <div className="min-w-0">
                <h3 className="font-bold text-white text-sm leading-tight truncate">{name}</h3>
                {(gender || age || city) && (
                  <p className="text-xs text-white/60 mt-0.5 truncate">
                    {[city, gender, age ? `${age}` : ''].filter(Boolean).join(' · ')}
                  </p>
                )}
                {accessible && !nearbyMode && distance > 0 && (
                  <p className="text-xs text-white/50 mt-0.5">{formatDistance(distance)} away</p>
                )}
              </div>
              {accessible && bookingRateDisplay && (
                <div className="text-right shrink-0 ml-2">
                  <p className="text-xs text-white/60">Booking rate</p>
                  <p className="text-sm font-semibold text-white">{bookingRateDisplay}</p>
                </div>
              )}
            </div>

            {accessible && reviewCount > 0 && (
              <div className="mt-1 text-[10px] text-white/50">{reviewCount} review{reviewCount === 1 ? '' : 's'}</div>
            )}
          </div>

          {/* Subscription lock overlay */}
          {!accessible && (
            <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center">
              <div className="text-center px-4">
                <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-gold/20 border border-gold/30 flex items-center justify-center">
                  <svg className="w-5 h-5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-white leading-tight">Unlock all companions</p>
                <p className="text-xs text-gold mt-0.5">₹2,999/month — unlimited access</p>
                <p className="text-xs text-white/40 mt-1">[Subscribe Now]</p>
              </div>
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
});
