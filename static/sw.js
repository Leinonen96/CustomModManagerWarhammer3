const CACHE_NAME = 'wh3-mod-manager-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/static/style.css',
    '/static/main.js',
    '/static/gemini-svg.svg',
    'https://cdnjs.cloudflare.com/ajax/libs/Sortable/1.15.0/Sortable.min.js'
];

// Install event: Cache our static shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// Fetch event: Serve static files from cache, but let API calls hit the network
self.addEventListener('fetch', (event) => {
    // We don't want to cache our dynamic local API routes
    if (event.request.url.includes('/api/') || event.request.url.includes('/workshop_assets/')) {
        return; 
    }

    event.respondWith(
        caches.match(event.request).then((response) => {
            // Return cached version if found, else fetch from network
            return response || fetch(event.request);
        })
    );
});