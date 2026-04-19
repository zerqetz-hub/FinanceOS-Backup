'use strict';
// KepingUang Service Worker — cache app shell, network-first for API
const CACHE = 'kepinguang-v3';

// Hanya cache static assets — jangan cache '/' karena bisa simpan versi lama
const STATIC_ASSETS = [
  '/app.css',
  '/manifest.json',
  '/icons/icon.svg',
];

// Install: cache minimal assets, jangan block activation
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

// Activate: remove old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Fetch strategy:
// - /api/* and /health → network-first (data harus fresh)
// - Everything else → cache-first, fallback ke network
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Hanya handle GET requests
  if (e.request.method !== 'GET') return;

  // Network-first untuk API (data keuangan harus real-time)
  if (url.pathname.startsWith('/api/') || url.pathname === '/health') {
    e.respondWith(
      fetch(e.request)
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Network-first untuk dokumen HTML (selalu fresh)
  if (e.request.destination === 'document') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('/app.css').then(() => fetch(e.request)))
    );
    return;
  }

  // Cache-first untuk static assets (CSS, icons, manifest)
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok && url.origin === location.origin) {
          const clone = res.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone));
        }
        return res;
      });
    })
  );
});
