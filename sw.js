// Everything the app needs is static and the maths runs on the device, so the whole
// app is cached and it works with no connection.
// Bump VERSION whenever a file below changes so phones pick up the new copy.
const VERSION = 'daylight-v4';
const FILES = ['./', 'index.html', 'app.css', 'app.js', 'seasons.js', 'cities.js', 'manifest.webmanifest',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/favicon-32.png'];

self.addEventListener('install', (event) => {
  // cache: 'reload' skips the HTTP cache, so a new version never stores old copies.
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll(FILES.map((f) => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // The page itself comes from the network when there is one, so a new release shows up
  // on the next launch; the cached copy is only the offline fallback.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((cache) => cache.put('./', copy));
          }
          return res;
        })
        .catch(() => caches.match('./')),
    );
    return;
  }
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((hit) => hit || fetch(event.request)),
  );
});
