'use client';

import { cn, formatDateTime } from '@/lib/utils';

interface MessageBubbleProps {
  content: string;
  isOwn: boolean;
  senderName: string;
  senderAvatar?: string;
  timestamp: string;
}

export function MessageBubble({
  content,
  isOwn,
  senderName,
  senderAvatar,
  timestamp,
}: MessageBubbleProps) {
  return (
    <div
      className={cn(
        'flex gap-3',
        isOwn ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Avatar */}
      <div className="flex-shrink-0">
        {senderAvatar ? (
          <img
            src={senderAvatar}
            alt={senderName}
            className="w-8 h-8 rounded-full object-cover"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-charcoal-border flex items-center justify-center text-white text-xs font-medium">
            {senderName.charAt(0)}
          </div>
        )}
      </div>

      {/* Message */}
      <div className={cn('flex flex-col max-w-[75%]', isOwn ? 'items-end' : 'items-start')}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs text-white/50">{senderName}</span>
          <span className="text-xs text-white/30">{formatDateTime(timestamp)}</span>
        </div>
        <div
          className={cn(
            'px-4 py-2 rounded-2xl',
            isOwn
              ? 'bg-gold text-charcoal'
              : 'bg-charcoal-border text-white'
          )}
        >
          <p className="text-sm">{content}</p>
        </div>
      </div>
    </div>
  );
}
