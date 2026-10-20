'use strict';

const CACHE_NAME = '10drinks-v210';

function isStaticAssetPath(pathname) {
  return /\.(js|mjs|css|json|png|jpe?g|webp|svg|woff2?)$/i.test(pathname)
    || pathname.includes('/src/');
}

function scopeUrl(path) {
  return new URL(path, self.registration.scope).href;
}

function precacheUrls() {
  return [
    self.registration.scope,
    scopeUrl('index.html'),
    scopeUrl('manifest.json'),
    scopeUrl('css/base.css'),
    scopeUrl('d3.min.js'),
    scopeUrl('src/config/app.config.js'),
    scopeUrl('src/utils/dates.js'),
    scopeUrl('src/utils/helpers.js'),
    scopeUrl('src/constants/milestones.js'),
    scopeUrl('src/constants/dyk.js'),
    scopeUrl('src/data/local-storage.js'),
    scopeUrl('src/data/backup.js'),
    scopeUrl('src/journey/streak.js'),
    scopeUrl('src/journey/journey-score.js'),
    scopeUrl('src/journey/best-performances.js'),
    scopeUrl('src/journey/midnight.js'),
    scopeUrl('src/journey/daily-msg.js'),
    scopeUrl('src/journey/journey.js'),
    scopeUrl('src/journey/catchup.js'),
    scopeUrl('src/ui/journey-milestones.js'),
    scopeUrl('src/ui/dashboard.js'),
    scopeUrl('src/ui/history-views.js'),
    scopeUrl('src/ui/renderAll.js'),
    scopeUrl('src/ui/reminders.js'),
    scopeUrl('src/ui/panels.js'),
    scopeUrl('src/premium/pricing.js'),
    scopeUrl('src/premium/premium.js'),
    scopeUrl('src/onboarding/onboarding.js'),
    scopeUrl('src/assessment/meter.js'),
    scopeUrl('src/assessment/questions.js'),
    scopeUrl('src/main.js'),
    scopeUrl('assets/icons/icon-180.png'),
    scopeUrl('assets/icons/icon-192.png'),
    scopeUrl('assets/icons/icon-512.png'),
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

  // Network-first for JS/CSS; never serve index.html as a script (causes global error banner)
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => {
        if (cached) return cached;
        if (isStaticAssetPath(url.pathname)) {
          return new Response('', { status: 503, statusText: 'Offline' });
        }
        return caches.match(scopeUrl('index.html'));
      }))
  );
});
