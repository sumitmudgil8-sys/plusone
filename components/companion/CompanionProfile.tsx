'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn, formatDistance } from '@/lib/utils';

interface CompanionImage {
  id: string;
  url: string;
  isPrimary: boolean;
}

interface CompanionData {
  id: string;
  name: string;
  bio?: string;
  tagline?: string;
  hourlyRatePaise: number;
  chatRatePerMinute?: number | null;
  callRatePerMinute?: number | null;
  availabilityStatus?: string;
  avatarUrl?: string | null;
  images?: CompanionImage[];
  isVerified?: boolean;
  averageRating?: number;
  reviewCount?: number;
  gender?: string;
  age?: number;
  city?: string;
  languages?: string[];
  interests?: string[];
  tags?: string[];
  distance: number;
  isFavorited: boolean;
  accessible: boolean;
}

interface CompanionProfileProps {
  companion: CompanionData;
  onChatClick?: () => void;
  onBookClick?: () => void;
  showActions?: boolean;
}

export function CompanionProfile({
  companion,
  onChatClick,
  onBookClick,
  showActions = true,
}: CompanionProfileProps) {
  const [isFavorited, setIsFavorited] = useState(companion.isFavorited);
  const [activeImage, setActiveImage] = useState(0);

  const images =
    companion.images && companion.images.length > 0
      ? companion.images.map((img) => img.url)
      : companion.avatarUrl
      ? [companion.avatarUrl]
      : [];

  const status = companion.availabilityStatus ?? 'OFFLINE';
  const isOnline = status === 'ONLINE';
  const isBusy = status === 'BUSY';
  const isOffline = status === 'OFFLINE';

  const chatRatePaise = companion.chatRatePerMinute ?? null;
  const callRatePaise = companion.callRatePerMinute ?? null;
  const chatRateLabel = chatRatePaise ? `₹${Math.round(chatRatePaise / 100)}/min` : null;
  const callRateLabel = callRatePaise ? `₹${Math.round(callRatePaise / 100)}/min` : null;

  // Chat is always requestable (companion gets notified even when offline)
  const chatDisabled = !chatRateLabel;
  // Calls still require companion to be online
  const callDisabled = !callRateLabel || !isOnline;

  const bookingRate =
    companion.hourlyRatePaise > 0
      ? `₹${Math.round(companion.hourlyRatePaise / 100).toLocaleString('en-IN')}/hr`
      : null;

  const prev = () =>
    setActiveImage((i) => (i - 1 + images.length) % images.length);
  const next = () =>
    setActiveImage((i) => (i + 1) % images.length);

  const toggleFavorite = async () => {
    try {
      const res = await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companionId: companion.id }),
      });
      const data = await res.json();
      if (data.success) setIsFavorited(data.isFavorited);
    } catch {
      // non-fatal
    }
  };

  return (
    <div className="space-y-6">
      {/* Image Carousel */}
      <div className="relative rounded-2xl overflow-hidden bg-charcoal-border">
        <div className="aspect-[3/4]">
          {images.length > 0 ? (
            <img
              src={images[activeImage]}
              alt={companion.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-6xl font-medium text-white/30 bg-charcoal">
              {companion.name.charAt(0)}
            </div>
          )}
        </div>

        {/* Gradient overlay */}
        <div className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />

        {/* Prev / Next arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}

        {/* Dot indicators */}
        {images.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveImage(i)}
                className={cn(
                  'rounded-full transition-all',
                  i === activeImage ? 'w-4 h-2 bg-white' : 'w-2 h-2 bg-white/40'
                )}
              />
            ))}
          </div>
        )}

        {/* Availability badge — top left */}
        <div className="absolute top-3 left-3">
          {isOnline && (
            <Badge className="bg-green-500/90 text-white text-xs flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-white inline-block" />
              Online
            </Badge>
          )}
          {isBusy && (
            <Badge className="bg-amber-500/90 text-white text-xs flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-white inline-block" />
              Busy
            </Badge>
          )}
          {isOffline && (
            <Badge className="bg-white/20 text-white/60 text-xs flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-white/50 inline-block" />
              Offline
            </Badge>
          )}
        </div>

        {/* Verified badge — top right */}
        {companion.isVerified && (
          <div className="absolute top-3 right-3">
            <Badge className="bg-green-500/90 text-white text-xs">
              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Verified
            </Badge>
          </div>
        )}

        {/* Favorite button */}
        {companion.accessible && (
          <button
            onClick={toggleFavorite}
            className={cn(
              'absolute bottom-3 right-3 w-9 h-9 rounded-full flex items-center justify-center transition-colors',
              'bg-black/40 backdrop-blur-sm hover:bg-black/60',
              isFavorited ? 'text-red-400' : 'text-white/70 hover:text-white'
            )}
          >
            <svg
              className="w-5 h-5"
              fill={isFavorited ? 'currentColor' : 'none'}
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </button>
        )}
      </div>

      {/* Info section */}
      <div className="space-y-4">
        {/* Name + meta */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-white truncate">{companion.name}</h1>
            {(companion.city || companion.gender || companion.age) && (
              <p className="text-sm text-white/50 mt-0.5">
                {[companion.city, companion.gender, companion.age ? `${companion.age}` : '']
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            )}
            {companion.distance > 0 && (
              <p className="text-xs text-white/40 mt-0.5">{formatDistance(companion.distance)} away</p>
            )}
            {(companion.reviewCount ?? 0) > 0 && (
              <div className="flex items-center gap-1 mt-1">
                <svg className="w-3.5 h-3.5 text-gold fill-current" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="text-xs text-white/60">
                  {companion.averageRating?.toFixed(1)} ({companion.reviewCount})
                </span>
              </div>
            )}
          </div>
          {bookingRate && (
            <div className="text-right shrink-0">
              <p className="text-xs text-white/40">Booking</p>
              <p className="text-lg font-bold text-gold">{bookingRate}</p>
            </div>
          )}
        </div>

        {/* Action buttons */}
        {showActions && companion.accessible && (
          <div className="space-y-2">
            <div className="flex gap-2">
              {/* Chat */}
              <button
                onClick={onChatClick}
                disabled={chatDisabled}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all border',
                  chatDisabled
                    ? 'border-charcoal-border text-white/25 cursor-not-allowed'
                    : 'border-charcoal-border text-white hover:border-gold/50 hover:text-gold'
                )}
              >
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span>Chat{chatRateLabel ? ` · ${chatRateLabel}` : ''}</span>
              </button>

              {/* Call */}
              <a
                href={`/client/chat/${companion.id}`}
                onClick={(e) => {
                  if (callDisabled) e.preventDefault();
                }}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all border',
                  callDisabled
                    ? 'border-charcoal-border text-white/25 cursor-not-allowed pointer-events-none'
                    : 'border-charcoal-border text-white hover:border-gold/50 hover:text-gold'
                )}
              >
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <span>Call{callRateLabel ? ` · ${callRateLabel}` : ''}</span>
              </a>
            </div>

            {callDisabled && !callRateLabel && (
              <p className="text-xs text-center text-white/40">Call rate not configured</p>
            )}
            {callDisabled && callRateLabel && !isOnline && (
              <p className="text-xs text-center text-white/40">
                {isBusy ? 'Busy — calls unavailable' : 'Offline — send a chat request to connect'}
              </p>
            )}

            {/* Book */}
            {bookingRate && (
              <button
                onClick={onBookClick}
                className="w-full py-3 rounded-xl text-sm font-semibold border border-gold/30 text-gold bg-gold/5 hover:bg-gold/10 transition-colors"
              >
                Book · {bookingRate}
              </button>
            )}
          </div>
        )}

        {/* Bio */}
        {companion.bio && (
          <Card>
            <h2 className="font-medium text-white mb-2">About</h2>
            {companion.tagline && (
              <p className="text-sm text-gold/80 mb-2 italic">"{companion.tagline}"</p>
            )}
            <p className="text-white/70 whitespace-pre-line text-sm leading-relaxed">{companion.bio}</p>
          </Card>
        )}

        {/* Tags */}
        {companion.tags && companion.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {companion.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs px-2.5 py-1 rounded-full bg-charcoal-surface border border-charcoal-border text-white/60"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Languages */}
        {companion.languages && companion.languages.length > 0 && (
          <div>
            <p className="text-xs text-white/40 uppercase tracking-wide mb-2">Languages</p>
            <div className="flex flex-wrap gap-1.5">
              {companion.languages.map((lang) => (
                <span
                  key={lang}
                  className="text-xs px-2 py-0.5 rounded-full bg-gold/10 text-gold/80 border border-gold/20"
                >
                  {lang}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
