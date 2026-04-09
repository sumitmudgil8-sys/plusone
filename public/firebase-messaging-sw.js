// Firebase Cloud Messaging Service Worker
// Handles background FCM push notifications (data-only payloads).
// No Firebase SDK needed — raw push events work for data-only messages.
// This SW runs on a separate scope from the main next-pwa sw.js to avoid
// push subscription conflicts with VAPID.

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    const raw = event.data.json();
    // FCM data-only messages nest payload under a 'data' key;
    // VAPID messages are flat { title, body, … }.
    data =
      raw.data && typeof raw.data === 'object' && raw.data.title
        ? raw.data
        : raw;
  } catch {
    return;
  }

  if (!data.title) return;

  const type = data.type || 'DEFAULT';
  const url = data.url || '/';
  const tag = data.tag || `plusone-${type}-${Date.now()}`;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If a window is visible, forward the data for an in-app toast
        const focused = clientList.find(
          (c) => c.visibilityState === 'visible'
        );
        if (focused) {
          focused.postMessage({ type: 'PUSH_FOREGROUND', data });
          return;
        }

        // Background — show a system notification
        return self.registration.showNotification(data.title, {
          body: data.body || '',
          icon: data.icon || '/icons/icon-192.png',
          badge: '/icons/icon-96.png',
          data: { url, type, sessionId: data.sessionId },
          vibrate: [200, 100, 200],
          requireInteraction:
            type === 'INCOMING_CALL' || type === 'CHAT_REQUEST',
          tag,
          ...(type === 'INCOMING_CALL' && {
            actions: [
              { action: 'answer', title: 'Answer' },
              { action: 'decline', title: 'Decline' },
            ],
          }),
        });
      })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const url = data.url || '/';

  // Handle call decline action button
  if (event.action === 'decline') {
    if (data.sessionId) {
      fetch('/api/billing/decline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: data.sessionId }),
      }).catch(() => {});
    }
    return;
  }

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            return client
              .focus()
              .then((c) => {
                if ('navigate' in c) return c.navigate(url);
              })
              .catch(() => clients.openWindow(url));
          }
        }
        return clients.openWindow(url);
      })
  );
});
