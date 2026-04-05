'use client';

export function usePushNotifications() {
  const subscribe = async (): Promise<{ success: boolean; reason?: string }> => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return { success: false, reason: 'not_supported' };
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, reason: 'denied' };
    }

    const reg = await navigator.serviceWorker.ready;

    const existing = await reg.pushManager.getSubscription();
    if (existing) await existing.unsubscribe();

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    });

    const key = sub.getKey('p256dh');
    const authKey = sub.getKey('auth');

    if (!key || !authKey) return { success: false, reason: 'key_error' };

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

    return { success: true };
  };

  return { subscribe };
}
