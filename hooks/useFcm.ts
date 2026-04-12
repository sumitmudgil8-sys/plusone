'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { getFirebaseMessaging } from '@/lib/firebase-client';

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

export interface FcmNotification {
  title: string;
  body: string;
  url: string;
  type: string;
  /** raw data map from the push payload */
  data: Record<string, string>;
}

interface UseFcmReturn {
  /** Request permission + register FCM token with backend */
  requestPermission: () => Promise<boolean>;
  /** Silently refresh FCM token if permission already granted */
  autoRegister: () => Promise<void>;
  /** Latest foreground notification (cleared after 6s) */
  foregroundNotification: FcmNotification | null;
  /** Dismiss the foreground notification */
  dismissNotification: () => void;
}

/**
 * Get the FCM-dedicated service worker registration.
 * This is a SEPARATE SW from the main next-pwa sw.js to avoid
 * push subscription conflicts between FCM and VAPID channels.
 */
async function registerFcmSw(): Promise<ServiceWorkerRegistration | undefined> {
  if (!('serviceWorker' in navigator)) return undefined;

  // Reuse existing registration if present
  const registrations = await navigator.serviceWorker.getRegistrations();
  for (const reg of registrations) {
    if (reg.active?.scriptURL.includes('firebase-messaging-sw.js')) {
      return reg;
    }
  }

  // Register the FCM SW on its own scope
  return navigator.serviceWorker.register('/firebase-messaging-sw.js', {
    scope: '/firebase-cloud-messaging-push-scope',
  });
}

async function registerTokenWithBackend(token: string): Promise<void> {
  await fetch('/api/push/fcm-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, device: navigator.userAgent }),
  });
}

export function useFcm(): UseFcmReturn {
  const [foregroundNotification, setForegroundNotification] =
    useState<FcmNotification | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissNotification = useCallback(() => {
    setForegroundNotification(null);
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }, []);

  // Listen for foreground push messages forwarded from EITHER service worker
  // (firebase-messaging-sw.js for FCM, sw.js for VAPID).
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator))
      return;

    function onSwMessage(event: MessageEvent) {
      if (event.data?.type !== 'PUSH_FOREGROUND') return;
      const data = event.data.data || {};

      setForegroundNotification({
        title: data.title || 'Plus One',
        body: data.body || '',
        url: data.url || '/',
        type: data.type || 'DEFAULT',
        data,
      });

      // Auto-dismiss after 6 seconds
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = setTimeout(() => {
        setForegroundNotification(null);
      }, 6000);
    }

    navigator.serviceWorker.addEventListener('message', onSwMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', onSwMessage);
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined') return false;
    if (!('Notification' in window)) return false;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    try {
      const messaging = await getFirebaseMessaging();
      if (!messaging) return false;

      const swReg = await registerFcmSw();
      const { getToken } = await import('firebase/messaging');
      const token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: swReg,
      });

      if (token) {
        await registerTokenWithBackend(token);
        return true;
      }
      return false;
    } catch (err) {
      console.error('[useFcm] Token registration failed:', err);
      return false;
    }
  }, []);

  const autoRegister = useCallback(async (): Promise<void> => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    try {
      const messaging = await getFirebaseMessaging();
      if (!messaging) return;

      const swReg = await registerFcmSw();
      const { getToken } = await import('firebase/messaging');
      const token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: swReg,
      });

      if (token) {
        await registerTokenWithBackend(token);
      }
    } catch {
      // Non-fatal — token will refresh on next app open
    }
  }, []);

  return {
    requestPermission,
    autoRegister,
    foregroundNotification,
    dismissNotification,
  };
}
