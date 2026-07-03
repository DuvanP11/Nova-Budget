/* ===== Nova Budget — Service Worker (offline + notificaciones) ===== */
const CACHE = 'nova-budget-v11';
const ASSETS = [
  './', './index.html',
  './css/styles.css',
  './js/store.js', './js/charts.js', './js/notifications.js', './js/cloud.js', './js/ui.js', './js/app.js',
  './manifest.webmanifest', './icons/icon.svg',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache-first para los recursos propios; red para lo demás.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => { try { c.put(req, copy); } catch {} });
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});

// Chequeo periódico en segundo plano (donde el navegador lo permita).
self.addEventListener('periodicsync', e => {
  if (e.tag === 'nova-check') e.waitUntil(notifyClients());
});
async function notifyClients() {
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  clients.forEach(c => c.postMessage({ type: 'check-alerts' }));
}

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(cl => {
    for (const c of cl) if ('focus' in c) return c.focus();
    return self.clients.openWindow('./');
  }));
});
