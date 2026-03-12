// ============================================================
// DESPIECE PRO — Service Worker v6
// Offline support + Cache-first strategy
// ============================================================

const CACHE_NAME = 'despiece-pro-v7';
const OFFLINE_URL = 'despiece-hvac.html';

const ASSETS_TO_CACHE = [
  'despiece-hvac.html',
  'manifest.json',
  'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@300;400;600;700;900&family=JetBrains+Mono:wght@300;400;500&family=Barlow:wght@300;400;500&display=swap'
];

// ---- INSTALL: pre-cache app shell ----
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE.filter(u => !u.startsWith('http')));
    }).then(() => self.skipWaiting())
  );
});

// ---- ACTIVATE: clean old caches ----
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ---- FETCH: cache-first, fallback to network ----
self.addEventListener('fetch', event => {
  // Skip non-GET and cross-origin (except Google Fonts)
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Always try network first for Google Fonts (nice to have online, skip if offline)
  if (url.hostname.includes('fonts.g')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(event.request).then(cached => {
          const networkFetch = fetch(event.request).then(resp => {
            cache.put(event.request, resp.clone());
            return resp;
          }).catch(() => cached);
          return cached || networkFetch;
        })
      )
    );
    return;
  }

  // Cache-first for app files
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(resp => {
        if (!resp || resp.status !== 200 || resp.type === 'opaque') return resp;
        const clone = resp.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return resp;
      }).catch(() => caches.match(OFFLINE_URL));
    })
  );
});

// ---- SKIP WAITING on message ----
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ---- PUSH NOTIFICATIONS ----
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'DESPIECE PRO';
  const options = {
    body: data.body || 'Tienes alertas de mantenimiento pendientes.',
    icon: data.icon || 'icon-192.png',
    badge: data.badge || 'icon-192.png',
    tag: data.tag || 'despiece-alert',
    renotify: true,
    data: { url: data.url || '/' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// ---- NOTIFICATION CLICK ----
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      if (list.length) return list[0].focus();
      return clients.openWindow(event.notification.data.url || '/');
    })
  );
});

// ---- SYNC (background sync for deferred saves) ----
self.addEventListener('sync', event => {
  if (event.tag === 'sync-data') {
    // Future: sync to cloud backend
    console.log('[SW] Background sync triggered');
  }
});
