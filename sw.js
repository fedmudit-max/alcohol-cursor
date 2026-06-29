'use strict';

const CACHE_NAME = 'sober-journey-v3';

function scopeUrl(path) {
  return new URL(path, self.registration.scope).href;
}

function precacheUrls() {
  return [
    self.registration.scope,
    scopeUrl('index.html'),
    scopeUrl('manifest.json'),
    scopeUrl('d3.min.js'),
    scopeUrl('icon-180.png'),
    scopeUrl('icon-192.png'),
    scopeUrl('icon-512.png'),
  ];
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.all(
        precacheUrls().map((url) => cache.add(url).catch(() => {}))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  // App shell only — never intercept CDN or other origins
  if (url.origin !== self.location.origin) return;

  const isNavigate = event.request.mode === 'navigate';
  const isAppShell = url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');

  if (isNavigate || isAppShell) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(scopeUrl('index.html'), copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request)
          .then((cached) => cached || caches.match(scopeUrl('index.html'))))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cached) => {
        if (cached) return cached;
        return fetch(event.request)
          .then((response) => {
            if (!response || !response.ok) return response;
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
            return response;
          })
          .catch(() => caches.match(scopeUrl('index.html')));
      })
  );
});
