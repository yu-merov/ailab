// AiLab — service worker: „мрежата първо“, но при слабо покритие след 3,5 с — запазеното (мрежата обновява кеша във фона).
// Кешира само кода на приложението и библиотеките; данните от базата НЕ минават оттук.
// Кешът е общ за целия адрес (yu-merov.github.io — и за другите приложения там) → пипаме и четем САМО кешовете на AiLab.
var V = 'ailab-e2-v2';
var WAIT_MS = 3500;
var SHELL = ['./', 'index.html', 'style.css', 'config.js', 'app.js', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'logo-512.png',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(V).then(function (c) { return Promise.all(SHELL.map(function (u) { return c.add(u).catch(function () {}); })); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  // само старите кешове на AiLab (ailab-…) — чуждите на същия адрес не се трият
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k.indexOf('ailab-') === 0 && k !== V; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (/supabase\.co$/.test(u.hostname)) return;             // данни — никога от кеша
  var cacheable = u.origin === self.location.origin || u.hostname === 'cdn.jsdelivr.net' || /fonts\.(googleapis|gstatic)\.com$/.test(u.hostname);
  if (!cacheable) return;
  var net = fetch(e.request);
  // мрежата продължава и след таймаута — обновява кеша за следващото отваряне; само истински успешни отговори
  // (index.html зарежда библиотеката и шрифтовете с crossorigin → статусът се вижда, 4xx/5xx не влиза в кеша)
  e.waitUntil(net.then(function (r) {
    if (r && r.ok) { var cp = r.clone(); return caches.open(V).then(function (c) { return c.put(e.request, cp); }); }
  }).catch(function () {}));
  e.respondWith(new Promise(function (resolve) {
    var done = false;
    function give(r) { if (!done && r) { done = true; resolve(r); } }
    function fromCache() { return caches.open(V).then(function (c) { return c.match(e.request, { ignoreSearch: true }); }); }
    // 1 чертичка на обекта: след 3,5 с — запазеното, ако го има; ако няма — чака мрежата докрай
    var t = setTimeout(function () { fromCache().then(give); }, WAIT_MS);
    net.then(function (r) { clearTimeout(t); give(r); }, function () {
      clearTimeout(t);
      fromCache().then(function (m) {
        if (m) { give(m); return; }
        // резервата index.html — само при отваряне на страница, не за скрипт/стил
        return (e.request.mode === 'navigate' ? caches.open(V).then(function (c) { return c.match('index.html'); }) : Promise.resolve(null)).then(function (x) {
          if (x) give(x); else if (!done) { done = true; resolve(Response.error()); }
        });
      });
    });
  }));
});
