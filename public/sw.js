self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    // Claim clients so the SW starts controlling immediately
    event.waitUntil(self.clients.claim());
});

// Basic pass-through fetch handler; customize caching later
self.addEventListener('fetch', (event) => {
    event.respondWith(fetch(event.request));
});
