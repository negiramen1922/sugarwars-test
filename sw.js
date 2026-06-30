/* SUGAR WARS — Service Worker（PWA：オフライン起動＆ホーム追加用）
   方針：HTML(本体)はネット優先→失敗時キャッシュ（更新が届きつつオフラインでも起動）。
        同一オリジンの静的（アイコン等）はキャッシュ優先。外部(フォント/Firebase)は素通し。
   バージョンを上げる（CACHE名を変える）と、activate時に古いキャッシュを破棄して更新される。 */
const CACHE = 'sugarwars-v2';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (_) { return; }

  // 本体HTML：ネット優先（更新を取りに行く）→ オフライン時はキャッシュ
  if (req.mode === 'navigate' || (url.origin === location.origin && url.pathname.endsWith('index.html'))) {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put('index.html', copy)).catch(() => {});
        return res;
      }).catch(() => caches.match('index.html').then((c) => c || caches.match('./')))
    );
    return;
  }

  // 同一オリジンの静的（アイコン等）：キャッシュ優先
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(req).then((c) => c || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((cc) => cc.put(req, copy)).catch(() => {});
        return res;
      }))
    );
    return;
  }

  // 外部（Googleフォント／Firebase SDK 等）：素通し。失敗時にキャッシュがあれば返す
  e.respondWith(fetch(req).catch(() => caches.match(req)));
});
