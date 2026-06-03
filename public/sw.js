const CACHE_NAME = 'sansuu-quest-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin) && !event.request.url.startsWith('http')) return;

  const url = new URL(event.request.url);

  // Network-First strategy for the main HTML file to ensure update safety
  if (url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => {
            return cache.match(event.request).then((cachedResponse) => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // If offline and not cached yet, return a clean HTML offline fallback instead of undefined
              return new Response(
                '<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><title>オフライン</title></head><body><div style="text-align:center;margin-top:20%;font-family:sans-serif;color:#555;"><h2>オフライン状態です 🔌</h2><p>アプリを一度オンラインで起動すると、オフラインでも遊べるようになります。</p></div></body></html>',
                {
                  headers: { 'Content-Type': 'text/html; charset=utf-8' }
                }
              );
            });
          });
      })
    );
    return;
  }

  // Stale-While-Revalidate strategy for static assets
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        const fetchedResponse = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch((err) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Propagate the network error properly instead of returning undefined which throws TypeError
            throw err;
          });

        return cachedResponse || fetchedResponse;
      });
    })
  );
});
