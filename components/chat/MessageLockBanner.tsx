"use client";
'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { SUBSCRIPTION_PRICE } from '@/lib/constants';
import { formatCurrency } from '@/lib/utils';

interface MessageLockBannerProps {
  messageCount: number;
  limit: number;
  isLocked: boolean;
}

export function MessageLockBanner({
  messageCount,
  limit,
  isLocked,
}: MessageLockBannerProps) {
  const router = useRouter();

  if (!isLocked && messageCount < limit) {
    // Show progress bar
    return (
      <div className="px-4 py-2 border-t border-charcoal-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-white/60">
            {messageCount}/{limit} messages used
          </span>
          <span className="text-xs text-gold">
            {limit - messageCount} remaining
          </span>
        </div>
        <div className="h-1.5 bg-charcoal-border rounded-full overflow-hidden">
          <div
            className="h-full bg-gold transition-all duration-300"
            style={{ width: `${(messageCount / limit) * 100}%` }}
          />
        </div>
      </div>
    );
  }

  if (!isLocked) return null;

  // Show lock banner
  return (
    <div className="px-4 py-4 border-t border-gold/30 bg-gold/5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center">
          <svg className="w-5 h-5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-white">
            Message limit reached
          </p>
          <p className="text-xs text-white/60">
            You have used {limit}/{limit} free messages. Upgrade to Premium to continue chatting with unlimited companions.
          </p>
        </div>
      </div>
      <Button
        variant="primary"
        size="sm"
        onClick={() => router.push('/client/profile')}
        className="w-full"
      >
        Upgrade for {formatCurrency(SUBSCRIPTION_PRICE)}
      </Button>
    </div>
  );
}
