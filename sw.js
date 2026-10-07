// Temporary one-time cleanup worker for legacy deployments.
self.addEventListener('install', event => { self.skipWaiting(); });
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({type:'window'});
    clients.forEach(c => c.navigate(c.url));
  })());
});
self.addEventListener('fetch', event => {
  event.respondWith(fetch(event.request));
});
