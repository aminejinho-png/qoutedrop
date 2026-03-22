/* ============================================================
   QuoteDrop — Service Worker  v1.0
   Place this file at the ROOT of your site, next to index.html
   ============================================================ */

const CACHE_NAME   = 'quotedrop-v1';
const OFFLINE_PAGE = './';          /* fallback = the app itself */

const PRECACHE = [
  './',
  './index.html',
];

/* ── Install: pre-cache the shell ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

/* ── Activate: clean up old caches ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k  => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* ── Fetch: network-first, fall back to cache ── */
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  /* Skip cross-origin requests (fonts, APIs, etc.) */
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        /* Cache a fresh copy on every successful network response */
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() =>
        /* Network failed — serve from cache, or the offline shell */
        caches.match(event.request)
          .then(cached => cached || caches.match(OFFLINE_PAGE))
      )
  );
});

/* ── Push notifications ── */
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'QuoteDrop', {
      body:    data.body  || 'A quote is waiting for you.',
      icon:    data.icon  || './quotedrop-192.png',
      badge:   data.badge || './quotedrop-96.png',
      vibrate: [100, 50, 100],
      data:    { url: data.url || self.location.origin },
    })
  );
});

/* ── Notification click: open / focus the app ── */
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        /* If a window is already open, focus it */
        for (const client of windowClients) {
          if (client.url === self.location.origin && 'focus' in client) {
            return client.focus();
          }
        }
        /* Otherwise open a new window */
        if (clients.openWindow) {
          return clients.openWindow(event.notification.data?.url || '/');
        }
      })
  );
});
