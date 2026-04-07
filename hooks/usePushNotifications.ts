'use client';

async function registerSubscriptionWithServer(sub: PushSubscription): Promise<void> {
  const key = sub.getKey('p256dh');
  const authKey = sub.getKey('auth');
  if (!key || !authKey) return;

  const p256dh = btoa(String.fromCharCode(...Array.from(new Uint8Array(key))));
  const auth = btoa(String.fromCharCode(...Array.from(new Uint8Array(authKey))));

  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: sub.endpoint,
      p256dh,
      auth,
      userAgent: navigator.userAgent,
    }),
  });
}

export function usePushNotifications() {
  // Called when user explicitly clicks "Enable Notifications"
  const subscribe = async (): Promise<{ success: boolean; reason?: string }> => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return { success: false, reason: 'not_supported' };
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, reason: 'denied' };
    }

    try {
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (existing) await existing.unsubscribe();

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      });

      await registerSubscriptionWithServer(sub);
      return { success: true };
    } catch {
      return { success: false, reason: 'subscribe_error' };
    }
  };

  // Called silently on every app open — refreshes the subscription in the DB
  // without prompting. Only runs if permission is already granted.
  const autoSubscribe = async (): Promise<void> => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    try {
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();

      // If no subscription exists, create one (handles SW update / subscription expiry)
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        });
      }

      await registerSubscriptionWithServer(sub);
    } catch {
      // Non-fatal — push just won't work until next successful registration
    }
  };

  return { subscribe, autoSubscribe };
}
