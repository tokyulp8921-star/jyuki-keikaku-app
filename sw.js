// 重機作業計画書アプリ用 簡易Service Worker(オフラインキャッシュ)
// ネットワーク優先(network-first): オンライン時は常に最新ファイルを使い、オフライン時のみキャッシュにフォールバックする。
// 大きなバイナリ資産(フォント・ベースPDF・CDNスクリプト)は、モバイル回線での転送中断によるキャッシュ破損リスクを避けるため
// Service Workerの介入(cache.put)を行わずブラウザの標準フェッチ/HTTPキャッシュにそのまま委ねる。
const CACHE_NAME = 'jyuki-app-v5';
const ASSETS = [
  './', './index.html', './css/style.css',
  './js/coords.js', './js/storage.js', './js/idb-store.js', './js/holidays.js', './js/master-data.js',
  './js/plan-state.js', './js/ui-helpers.js', './js/signature.js', './js/dropbox.js',
  './js/pdfgen.js', './js/wizard-header.js', './js/wizard-machine.js', './js/wizard.js',
  './js/list.js', './js/preview.js', './js/master-admin.js', './js/app.js',
  './data/master.json', './data/holidays.json',
  './manifest.json',
];
const BYPASS_PATTERNS = [/\.ttf$/, /\.otf$/, /base_template\.pdf$/, /unpkg\.com/, /dropboxapi\.com/];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  if (BYPASS_PATTERNS.some((re) => re.test(url))) return; // SW非介入。ブラウザに直接処理させる
  event.respondWith(
    fetch(event.request).then((res) => {
      if (res && res.ok) {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
      }
      return res;
    }).catch(() => caches.match(event.request)),
  );
});
