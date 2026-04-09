// Custom service worker additions merged by next-pwa (customWorkerDir: 'worker')
// Handles VAPID Web Push notifications, foreground forwarding, and notification clicks.
// FCM notifications are handled by firebase-messaging-sw.js on a separate scope.

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    const raw = event.data.json();
    // VAPID payloads are flat { title, body, … }
    data = raw;
  } catch {
    return;
  }

  if (!data.title) return;

  const type = data.type || 'DEFAULT';
  const tag = data.tag || `plusone-${type}-${Date.now()}`;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If a window is visible, forward for in-app toast instead
        const focused = clientList.find(
          (c) => c.visibilityState === 'visible'
        );
        if (focused) {
          focused.postMessage({ type: 'PUSH_FOREGROUND', data });
          return;
        }

        // Background — show system notification
        return self.registration.showNotification(data.title, {
          body: data.body || '',
          icon: data.icon || '/icons/icon-192.png',
          badge: '/icons/icon-96.png',
          data: { url: data.url || '/companion/dashboard', type },
          vibrate: [200, 100, 200],
          requireInteraction:
            type === 'INCOMING_CALL' || type === 'CHAT_REQUEST',
          tag,
        });
      })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/companion/dashboard';

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            client.focus();
            if ('navigate' in client) {
              return client.navigate(url);
            }
            return;
          }
        }
        if (clients.openWindow) return clients.openWindow(url);
      })
  );
});
