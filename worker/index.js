// Custom service worker additions merged by next-pwa (customWorkerDir: 'worker')
// Handles push notifications and notification clicks.

self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url || '/companion/dashboard' },
      vibrate: [200, 100, 200],
      // Keep the notification on screen until the user taps it.
      // Critical for chat requests — without this it auto-dismisses on mobile.
      requireInteraction: true,
      tag: data.tag || 'plusone-notification',
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/companion/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If any companion window is open, focus it and navigate to the URL
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          // Navigate the focused client to the correct URL
          if ('navigate' in client) {
            return client.navigate(url);
          }
          return;
        }
      }
      // No window open — launch the app
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
