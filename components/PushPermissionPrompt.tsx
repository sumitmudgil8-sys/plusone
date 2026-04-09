'use client';

import { useEffect, useState } from 'react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useFcm } from '@/hooks/useFcm';

const DISMISS_KEY = 'push_prompt_dismissed_at';
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function PushPermissionPrompt() {
  const [visible, setVisible] = useState(false);
  const { subscribe, autoSubscribe } = usePushNotifications();
  const { requestPermission: requestFcm, autoRegister: autoRegisterFcm } = useFcm();

  // Silently refresh both VAPID and FCM subscriptions on every mount
  // if permission is already granted.
  useEffect(() => {
    autoSubscribe();
    autoRegisterFcm();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Show prompt only if permission hasn't been decided yet
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'default') return;

    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt && Date.now() - parseInt(dismissedAt, 10) < DISMISS_TTL_MS) return;

    // Small delay so it doesn't flash immediately on page load
    const t = setTimeout(() => setVisible(true), 1500);
    return () => clearTimeout(t);
  }, []);

  if (!visible) return null;

  const handleEnable = async () => {
    setVisible(false);
    // Register both channels — VAPID for broad browser support, FCM for Android reliability
    await Promise.all([
      subscribe(),
      requestFcm(),
    ]);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 flex justify-center pointer-events-none">
      <div
        className="pointer-events-auto w-full max-w-md mx-4 mb-20 md:mb-6 bg-charcoal-surface border border-white/[0.06] rounded-2xl px-6 py-5 shadow-2xl animate-slide-up"
      >
        <div className="flex items-start gap-4">
          <div className="shrink-0 w-10 h-10 rounded-full bg-gold/15 flex items-center justify-center">
            <svg className="w-5 h-5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white text-sm">Stay in the loop</p>
            <p className="text-white/55 text-xs mt-0.5 leading-snug">
              Get notified about messages, bookings, and more
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <button
            onClick={handleEnable}
            className="w-full py-2.5 rounded-xl bg-gold hover:bg-gold/90 text-black font-semibold text-sm transition-colors"
          >
            Enable Notifications
          </button>
          <button
            onClick={handleDismiss}
            className="w-full py-2 text-sm text-white/40 hover:text-white/60 transition-colors"
          >
            Not now
          </button>
        </div>
      </div>

      <style jsx global>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up { animation: slideUp 0.3s ease-out; }
      `}</style>
    </div>
  );
}
