/* Business Finance Hub — push delivery only.
   No caching, no offline shell: the app already runs entirely from IndexedDB,
   and a stale cached bundle would be a liability rather than a feature. */

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  if (!event.data) return

  let data
  try {
    data = event.data.json()
  } catch {
    data = { title: 'Business Finance Hub', body: event.data.text() }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body || '',
      icon: data.icon || '/icons/icon-192.png',
      badge: data.badge || '/icons/icon-96.png',
      data: { link: data.link || '/' },
      // Same tag replaces the previous notification of that type instead of
      // stacking a second copy in the tray.
      tag: data.type || 'bfh-notification',
      renotify: false,
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const link = (event.notification.data && event.notification.data.link) || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          client.postMessage({ type: 'NAVIGATE', link })
          return client.focus()
        }
      }
      // Nothing open — launch the app straight at the page the alert refers to.
      return self.clients.openWindow(link)
    }),
  )
})
