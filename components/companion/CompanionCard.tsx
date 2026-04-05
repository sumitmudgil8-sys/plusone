'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatDistance, formatCurrency, cn } from '@/lib/utils';

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
}

export function CompanionCard({
  id,
  name,
  bio,
  hourlyRatePaise,
  chatRatePerMinute,
  callRatePerMinute,
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
}: CompanionCardProps) {
  const [isFavorited, setIsFavorited] = useState(initialFavorited);
  const [isHovered, setIsHovered] = useState(false);

  const displayImage = primaryImageUrl ?? avatarUrl ?? null;

  const toggleFavorite = async (e: React.MouseEvent) => {
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
  };

  const renderStars = (rating: number) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg key={star} className={`w-3.5 h-3.5 ${star <= rating ? 'text-gold fill-current' : 'text-white/20'}`} viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );

  const showChat = chatRatePerMinute != null && chatRatePerMinute > 0;
  const showCall = callRatePerMinute != null && callRatePerMinute > 0;
  const showBooking = hourlyRatePaise > 0;

  return (
    <Link href={accessible ? `/client/booking/${id}` : '/client/subscription'}>
      <Card
        className={cn(
          'relative overflow-hidden transition-all duration-300',
          accessible
            ? 'cursor-pointer hover:shadow-xl hover:border-gold/30'
            : 'cursor-pointer'
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Image */}
        <div className="relative aspect-[4/3] bg-charcoal-border overflow-hidden">
          {displayImage ? (
            <img
              src={displayImage}
              alt={name}
              className={cn(
                'w-full h-full object-cover transition-transform duration-300',
                !accessible && 'blur-sm scale-105'
              )}
              style={{ transform: isHovered && accessible ? 'scale(1.05)' : undefined }}
            />
          ) : (
            <div className={cn(
              'w-full h-full flex items-center justify-center text-4xl font-medium text-white/30',
              !accessible && 'blur-sm'
            )}>
              {name.charAt(0)}
            </div>
          )}

          {/* Badges */}
          {accessible && (
            <div className="absolute top-2 left-2 flex flex-col gap-1">
              <Badge variant="outline" className="bg-charcoal/80 backdrop-blur-sm">
                {formatDistance(distance)} away
              </Badge>
              {isVerified && (
                <Badge className="bg-green-500/90 text-white">
                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Verified
                </Badge>
              )}
            </div>
          )}

          {/* Favorite Button — only on accessible cards */}
          {accessible && (
            <button
              onClick={toggleFavorite}
              className={cn(
                'absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition-colors',
                'bg-charcoal/80 backdrop-blur-sm hover:bg-charcoal',
                isFavorited ? 'text-red-500' : 'text-white/60 hover:text-white'
              )}
            >
              <svg className="w-5 h-5" fill={isFavorited ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </button>
          )}

          {/* Subscription lock overlay */}
          {!accessible && (
            <div className="absolute inset-0 bg-charcoal/70 backdrop-blur-[2px] flex items-center justify-center">
              <div className="text-center px-4">
                <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-gold/20 border border-gold/30 flex items-center justify-center">
                  <svg className="w-5 h-5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-white leading-tight">Subscribe to unlock</p>
                <p className="text-xs text-white/50 mt-0.5">₹2,999/month</p>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="flex items-start justify-between mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="font-semibold text-white truncate">{name}</h3>
              {(gender || age) && (
                <span className="text-xs text-white/50 shrink-0">
                  {[gender, age ? `${age}` : ''].filter(Boolean).join(' · ')}
                </span>
              )}
            </div>
          </div>

          {reviewCount > 0 ? (
            <div className="flex items-center gap-2 mb-3">
              {renderStars(Math.round(averageRating))}
              <span className="text-xs text-white/50">{averageRating.toFixed(1)} ({reviewCount})</span>
            </div>
          ) : (
            <p className="text-xs text-white/40 mb-3">No reviews yet</p>
          )}

          {/* Pricing grid */}
          {(showChat || showCall || showBooking) && (
            <div className="border-t border-charcoal-border pt-3 grid grid-cols-2 gap-y-1.5">
              {showChat && (
                <>
                  <span className="text-xs text-white/50">💬 Chat</span>
                  <span className="text-xs text-white text-right">{formatCurrency(chatRatePerMinute!)}/min</span>
                </>
              )}
              {showCall && (
                <>
                  <span className="text-xs text-white/50">📞 Call</span>
                  <span className="text-xs text-white text-right">{formatCurrency(callRatePerMinute!)}/min</span>
                </>
              )}
              {showBooking && (
                <>
                  <span className="text-xs text-white/50">📅 Book</span>
                  <span className="text-xs text-gold text-right">from {formatCurrency(hourlyRatePaise)}/hr</span>
                </>
              )}
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
}
