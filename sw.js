// Service worker: önce ağdan dener (her zaman en güncel sürüm), ağ yoksa son kaydedilen kopyayı verir.
// Yeni sürüm yayınlarken VERSION'ı değiştirmek eski önbelleği temizler.
const VERSION = 'muhlet-v4';
const CORE = [
  './', 'index.html', 'css/style.css',
  'js/app.js', 'js/evrak.js', 'js/pwa.js', 'js/rules.js', 'js/engine.js', 'js/holidays.js',
  'js/store.js', 'js/classify.js', 'js/docreader.js', 'js/account.js', 'js/cloud.js', 'js/config.js',
  'img/icon.svg', 'manifest.webmanifest',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('./'))),
  );
});
