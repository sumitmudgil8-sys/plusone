"use client";
'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, formatDistance } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface CompanionProfileProps {
  companion: {
    id: string;
    name: string;
    bio?: string;
    hourlyRate: number;
    avatarUrl?: string;
    images?: string[];
    distance: number;
    isFavorited: boolean;
    accessible: boolean;
    formattedPrice: string;
    availability?: string[];
  };
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

const images = (companion.images && companion.images.length > 0) ? companion.images : [companion.avatarUrl];

  const toggleFavorite = async () => {
    try {
      const res = await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companionId: companion.id }),
      });

      const data = await res.json();
      if (data.success) {
        setIsFavorited(data.isFavorited);
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Image Gallery */}
      <div className="relative">
        <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-charcoal-border">
          {images[activeImage] ? (
            <img
              src={images[activeImage]}
              alt={companion.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-6xl font-medium text-white/30">
              {companion.name.charAt(0)}
            </div>
          )}
        </div>

        {/* Image Navigation */}
        {images.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveImage(i)}
                className={cn(
                  'w-2 h-2 rounded-full transition-colors',
                  i === activeImage ? 'bg-gold' : 'bg-white/50'
                )}
              />
            ))}
          </div>
        )}

        {/* Distance Badge */}
        <div className="absolute top-4 left-4">
          <Badge variant="outline" className="bg-charcoal/80 backdrop-blur-sm">
            {formatDistance(companion.distance)} away
          </Badge>
        </div>

        {/* Favorite Button */}
        <button
          onClick={toggleFavorite}
          className={cn(
            'absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center transition-colors',
            'bg-charcoal/80 backdrop-blur-sm hover:bg-charcoal',
            isFavorited ? 'text-red-500' : 'text-white/60 hover:text-white'
          )}
        >
          <svg className="w-6 h-6" fill={isFavorited ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>

        {/* Lock Overlay */}
        {!companion.accessible && (
          <div className="absolute inset-0 bg-charcoal/70 flex items-center justify-center rounded-2xl backdrop-blur-sm">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-charcoal-border flex items-center justify-center">
                <svg className="w-8 h-8 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <p className="text-white font-medium">Upgrade to Premium</p>
              <p className="text-sm text-white/60">Unlock this companion</p>
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">{companion.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex items-center text-yellow-400">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <span className="text-sm text-white/50">4.9 (24 reviews)</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gold">{companion.formattedPrice}</p>
            <p className="text-sm text-white/50">per hour</p>
          </div>
        </div>

        {companion.bio && (
          <Card>
            <h2 className="font-medium text-white mb-2">About</h2>
            <p className="text-white/70 whitespace-pre-line">{companion.bio}</p>
          </Card>
        )}

        {showActions && companion.accessible && (
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onChatClick}
            >
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Message
            </Button>
            <Button
              className="flex-1"
              onClick={onBookClick}
            >
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Book Now
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
