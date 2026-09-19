/* अपनी हट्टी — app shell cache. Bump VERSION after every edit to index.html. */
const VERSION = 'ah-v12';
const SHELL = ['./', './index.html', './manifest.json', './icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// answer the page's build check
self.addEventListener('message', e => {
  if (e.data && e.data.q === 'version' && e.ports && e.ports[0]) {
    e.ports[0].postMessage({ version: VERSION });
  }
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Never cache Firebase / Google endpoints — they must always hit the network.
  if (/googleapis\.com|firebaseio\.com|gstatic\.com\/firebasejs/.test(url.hostname + url.pathname)) return;

  if (url.origin === location.origin) {
    // App shell: serve from cache first so the shop counter opens instantly, offline.
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match('./index.html')))
    );
    return;
  }

  // Third-party (the OCR engine): cache after first successful download, then reuse offline.
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(req, copy)).catch(() => {});
      }
      return res;
    }))
  );
});
