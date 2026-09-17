/* Release the entire app-shell atomically. Bump RELEASE on every static-file change. */
const RELEASE = '0.1.0';
const PREFIX = `fitness-20w:${self.registration.scope}:`;
const CACHE = `${PREFIX}${RELEASE}`;
const FILES = [
  './index.html', './styles.css', './app.js', './program.js', './date-engine.js', './state.js',
  './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png',
  './icons/maskable-512.png', './icons/apple-touch-icon.png',
];
const urlFor = path => new URL(path, self.registration.scope).href;
const STATIC = new Set(FILES.map(urlFor));
self.addEventListener('install', event => {
  // No skipWaiting here: an update must not silently change an open session.
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES.map(file => new Request(urlFor(file), { cache: 'reload' })))));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const shell = await cache.match(urlFor('./index.html'));
      return shell || fetch(request);
    })());
    return;
  }
  if (STATIC.has(url.href)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request);
      return cached || fetch(request);
    })());
  }
});
