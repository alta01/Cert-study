// sw.js — bumped to v2: works at any base path (root or /cert-study/ etc.)
const CACHE = 'cert-study-v3';

// Resolve everything relative to the SW's own scope so this works under
// any deploy path (root '/', '/cert-study/', or any future subpath).
const BASE = new URL('./', self.location).pathname;
const rel = (p) => BASE + p;

const PRECACHE = [
  rel(''),                                  // BASE itself (index)
  rel('index.html'),
  rel('style.css'),
  rel('app.js'),
  rel('ai.js'),
  rel('auth.js'),
  rel('config.js'),
  rel('public/vendor/supabase.js'),
  rel('manifest.json'),
  rel('app.webmanifest'),
  rel('data/exams/sc-300.json'),
  rel('data/exams/sc-500.json'),
  rel('data/exams/aws-saa-c03.json'),
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      // Cache opportunistically — don't fail install if some assets 404
      Promise.allSettled(PRECACHE.map(u => cache.add(u)))
    )
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

  // Never intercept cross-origin (Ollama, Google Fonts, etc.)
  if (url.origin !== location.origin) return;

  const isExamData = url.pathname.startsWith(BASE + 'data/exams/') && url.pathname.endsWith('.json');

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
