'use strict';
// KepingUang Service Worker — cache app shell, network-first for API
const CACHE = 'kepinguang-v1';

const APP_SHELL = [
  '/',
  '/app.css',
  '/manifest.json',
  '/icons/icon.svg',
  '/js/api.js',
  '/js/helpers.js',
  '/js/state.js',
  '/js/ui.js',
  '/js/auth.js',
  '/js/main.js',
  '/js/render.core.js',
  '/js/render.dashboard.js',
  '/js/render.cashflow.js',
  '/js/render.assets.js',
  '/js/render.debts.js',
  '/js/render.planning.js',
  '/js/render.transactions.js',
  '/js/render.charts.js',
  '/js/actions.cashflow.js',
  '/js/actions.assets.js',
  '/js/actions.debts.js',
  '/js/actions.goals.js',
  '/js/actions.transactions.js',
  '/js/actions.edit-modal.js',
  '/js/actions.export.js',
  '/js/transactions.js',
  '/js/checkpoint.js',
  '/js/profile.js',
  '/js/tutorial.js',
];

// Install: cache app shell
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(APP_SHELL))
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

  // Cache-first untuk app shell dan static assets
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        // Cache response baru untuk same-origin assets
        if (res.ok && url.origin === location.origin) {
          const clone = res.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone));
        }
        return res;
      }).catch(() => {
        // Offline fallback: kembalikan halaman utama
        if (e.request.destination === 'document') return caches.match('/');
      });
    })
  );
});
