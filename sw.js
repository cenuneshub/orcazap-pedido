const CACHE_NAME = 'orcazap-v15-static-1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './cliente.html',
  './meus-pedidos.html',
  './ajuda.html',
  './status.html',
  './ranking.html',
  './privacidade-conta.html',
  './styles.css',
  './config.js',
  './auth.js',
  './ranking.js',
  './smart-triage.js',
  './professions.json',
  './pwa.js',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.includes('/rest/v1/') || url.pathname.includes('/auth/v1/')) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request).then(cached => {
        if (cached) return cached;
        if (request.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      }))
  );
});
