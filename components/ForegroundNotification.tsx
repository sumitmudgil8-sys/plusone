'use client';

import { useRouter } from 'next/navigation';
import type { FcmNotification } from '@/hooks/useFcm';

interface Props {
  notification: FcmNotification | null;
  onDismiss: () => void;
}

/**
 * In-app toast for FCM messages received while the app is in the foreground.
 * No system notification is shown — this component handles it visually.
 */
export function ForegroundNotification({ notification, onDismiss }: Props) {
  const router = useRouter();

  if (!notification) return null;

  const isCall = notification.type === 'INCOMING_CALL';
  const isChat = notification.type === 'CHAT_MESSAGE' || notification.type === 'CHAT_REQUEST';

  const handleClick = () => {
    onDismiss();
    if (notification.url && notification.url !== '/') {
      router.push(notification.url);
    }
  };

  return (
    <div className="fixed top-0 inset-x-0 z-[100] flex justify-center pointer-events-none">
      <div
        onClick={handleClick}
        className="pointer-events-auto w-full max-w-md mx-3 mt-[max(env(safe-area-inset-top),12px)] cursor-pointer animate-fcm-slide-down"
      >
        <div className={`
          rounded-2xl px-4 py-3.5 shadow-2xl border backdrop-blur-xl
          ${isCall
            ? 'bg-emerald-950/90 border-emerald-500/30'
            : isChat
              ? 'bg-charcoal-surface/90 border-amber-500/20'
              : 'bg-charcoal-surface/90 border-white/10'
          }
        `}>
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className={`
              shrink-0 w-10 h-10 rounded-full flex items-center justify-center
              ${isCall ? 'bg-emerald-500/20' : 'bg-amber-500/15'}
            `}>
              {isCall ? (
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white text-sm truncate">
                {notification.title}
              </p>
              <p className="text-white/60 text-xs mt-0.5 line-clamp-2 leading-snug">
                {notification.body}
              </p>
            </div>

            {/* Dismiss */}
            <button
              onClick={(e) => { e.stopPropagation(); onDismiss(); }}
              className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
            >
              <svg className="w-3.5 h-3.5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes fcmSlideDown {
          from { opacity: 0; transform: translateY(-100%); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-fcm-slide-down { animation: fcmSlideDown 0.3s ease-out; }
      `}</style>
    </div>
  );
}
