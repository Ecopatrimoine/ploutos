const CACHE_NAME = 'ploutos-app-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/logo.ploutos.svg',
  '/manifest.webmanifest'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Ne jamais intercepter les requêtes non-GET (POST, PUT, DELETE, PATCH)
  if (event.request.method !== 'GET') return;

  // Ne pas intercepter Supabase, Stripe, Fonts, extensions Chrome
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('buy.stripe.com') ||
    url.protocol === 'chrome-extension:'
  ) {
    return;
  }

  // Network-first : on essaie le réseau, fallback cache
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Ne mettre en cache que les réponses GET valides
        if (response && response.status === 200 && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
