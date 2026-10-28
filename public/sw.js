/* Public install assets only. Never cache pages, scripts, credentials or API data. */
const CACHE = 'kagopita-pwa-v2';
const PUBLIC_ASSETS = ['/offline.html', '/icons/pwa-192.png', '/icons/pwa-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PUBLIC_ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('kagopita-pwa-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/offline.html')));
  } else if (!url.search && PUBLIC_ASSETS.includes(url.pathname)) {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request)));
  }
});

// Web Push is delivered by the browser even when no Kagopita page is open.
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data?.json() || {}; } catch {}
  event.waitUntil(self.registration.showNotification('カゴピタ', {
    body: typeof data.body === 'string' ? data.body.slice(0, 160) : '共有リストが更新されました。',
    icon: '/icons/pwa-192.png', badge: '/icons/pwa-192.png',
    tag: typeof data.tag === 'string' ? data.tag.slice(0, 100) : 'kagopita-update',
    data: { url: '/?notifications=1' }
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const destination = new URL('/?notifications=1', self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const client = windows.find(client => new URL(client.url).origin === self.location.origin);
    if (client) {
      await client.focus();
      client.postMessage({ type: 'kagopita:open-notifications' });
    } else await self.clients.openWindow(destination);
  })());
});
