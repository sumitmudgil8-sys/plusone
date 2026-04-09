'use client';

import Link from 'next/link';

export interface CompanionCardData {
  id: string;
  name: string;
  age: number | null;
  bio: string | null;
  tagline: string | null;
  primaryImageUrl: string | null;
  avatarUrl: string | null;
  chatRatePerMinute: number | null;
  callRatePerMinute: number | null;
  hourlyRatePaise: number;
  availabilityStatus: string;
  isVerified: boolean;
  averageRating: number;
  reviewCount: number;
  city: string | null;
  tags: string[];
  personalityTags: string[];
  interests: string[];
  accessible: boolean;
  scarcityLabel?: string;
}

export function CompanionCard({ companion, scarcityLabel }: { companion: CompanionCardData; scarcityLabel?: string }) {
  const chatRate = companion.chatRatePerMinute ? Math.round(companion.chatRatePerMinute / 100) : null;
  const isOnline = companion.availabilityStatus === 'AVAILABLE';
  const displayTags = [...(companion.personalityTags || []), ...(companion.interests || [])].slice(0, 3);
  const label = scarcityLabel || companion.scarcityLabel;

  return (
    <Link
      href={companion.accessible ? `/client/booking/${companion.id}` : '/client/subscription'}
      className="block shrink-0 snap-start group w-[42vw] min-w-[140px] max-w-[172px]"
    >
      <div className="relative rounded-2xl overflow-hidden bg-charcoal-surface" style={{ aspectRatio: '3/4' }}>
        {/* Image */}
        {companion.primaryImageUrl || companion.avatarUrl ? (
          <img
            src={companion.primaryImageUrl || companion.avatarUrl || ''}
            alt={companion.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl font-medium text-white/20 bg-charcoal-elevated">
            {companion.name.charAt(0)}
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />

        {/* Scarcity label */}
        {label && (
          <div className="absolute top-2.5 left-2.5">
            <span className="bg-gold text-black text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
              {label}
            </span>
          </div>
        )}

        {/* Online indicator */}
        {isOnline && (
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-[10px] text-emerald-400 font-medium">Online</span>
          </div>
        )}

        {/* Verified badge */}
        {companion.isVerified && (
          <div className="absolute top-2.5 right-2.5" style={isOnline ? { top: 28 } : {}}>
            <svg className="w-4 h-4 text-gold" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
        )}

        {/* Lock overlay for non-accessible */}
        {!companion.accessible && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
            <div className="text-center">
              <svg className="w-6 h-6 text-gold mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <p className="text-[10px] text-white/60">Premium</p>
            </div>
          </div>
        )}

        {/* Bottom info */}
        <div className="absolute bottom-0 inset-x-0 p-3">
          {/* Name + age */}
          <div className="flex items-baseline gap-1.5">
            <p className="text-white text-sm font-semibold truncate">{companion.name}</p>
            {companion.age && <span className="text-white/50 text-xs">{companion.age}</span>}
          </div>

          {/* Tagline or bio snippet */}
          {(companion.tagline || companion.bio) && (
            <p className="text-white/50 text-[11px] mt-0.5 line-clamp-1">
              {companion.tagline || companion.bio}
            </p>
          )}

          {/* Tags */}
          {displayTags.length > 0 && (
            <div className="flex gap-1 mt-1.5 flex-wrap">
              {displayTags.map((tag) => (
                <span key={tag} className="text-[9px] text-white/60 bg-white/10 rounded-full px-1.5 py-0.5">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Rate */}
          {chatRate && (
            <p className="text-gold text-[11px] font-medium mt-1.5">
              from ₹{chatRate}/min
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
