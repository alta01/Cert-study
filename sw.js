const CACHE = 'cert-study-v1';
const PRECACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/ai.js',
  '/manifest.json',
  '/data/exams/sc-300.json',
  '/data/exams/aws-saa-c03.json',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Never intercept Ollama requests
  if (url.origin !== location.origin) return;

  const isExamData = url.pathname.startsWith('/data/exams/') && url.pathname.endsWith('.json');

  if (isExamData) {
    // Network-first for exam data so fresh questions load when online
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    // Cache-first for static assets (HTML, JS, CSS, icons)
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, clone));
          return res;
        });
      })
    );
  }
});
