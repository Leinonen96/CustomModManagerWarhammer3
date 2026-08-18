// WH3 Mod Manager Service Worker (Auto-refresh cache)
const CACHE_NAME = 'wh3-mod-manager-v2.0.1';

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((name) => {
                    if (name !== CACHE_NAME) {
                        console.log('Purging old cache:', name);
                        return caches.delete(name);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Network-first strategy for local development / desktop app
self.addEventListener('fetch', (event) => {
    // API & dynamic assets always go straight to network
    if (event.request.url.includes('/api/') || event.request.url.includes('/workshop_assets/')) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                if (response && response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => caches.match(event.request))
    );
});