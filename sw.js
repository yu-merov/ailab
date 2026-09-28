// AiLab — service worker: „мрежата първо“, но при слабо покритие след 3,5 с — запазеното (мрежата обновява кеша във фона).
// Кешира само кода на приложението и библиотеките; данните от базата НЕ минават оттук.
// Изключение (Етап 3): МИНИАТЮРИТЕ на снимките (…/object/sign/snimki/…/mini/…) — „първо кешът“, в отделен кеш VS,
// с ключ адреса БЕЗ ?token= (нов подпис = същият запис). Големите снимки и всичко друго от supabase.co не минават оттук.
// Кешът е общ за целия адрес (yu-merov.github.io — и за другите приложения там) → пипаме и четем САМО кешовете на AiLab.
var V = 'ailab-e4-v2';
var VS = 'ailab-snimki-v1';   // НЕ се трие при нова версия на приложението; трие го само „Изход“ (app.js)
var VS_MAX = 800;             // ≈ 12 MB: 6 дни в кеша на Ден × до 79 + до 160 в Таблото [К32]
var WAIT_MS = 3500;
var SHELL = ['./', 'index.html', 'style.css', 'config.js', 'app.js', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'logo-512.png',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(V).then(function (c) { return Promise.all(SHELL.map(function (u) { return c.add(u).catch(function () {}); })); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  // само старите кешове на AiLab (ailab-…) — чуждите на същия адрес не се трият; миниатюрите (ailab-snimki-…) остават
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k.indexOf('ailab-') === 0 && k !== V && k.indexOf('ailab-snimki-') !== 0; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
// над VS_MAX записа — най-старите (първите в keys()) излизат
function trimVS(c) {
  return c.keys().then(function (ks) {
    var x = ks.length - VS_MAX; if (x <= 0) return;
    return Promise.all(ks.slice(0, x).map(function (k) { return c.delete(k); }));
  });
}
// Миниатюра: намерена в кеша → веднага (без мрежа и трафик); иначе мрежата и, ако е истински успешен CORS отговор, в кеша.
// Мрежата падне → Response.error() (плочката става сива).
function mini(e, u) {
  var key = new Request(u.origin + u.pathname);
  function net(c) {
    return fetch(e.request).then(function (r) {
      if (c && r && r.ok && r.type === 'cors') {
        var cp = r.clone();
        var p = c.put(key, cp).then(function () { return trimVS(c); }).catch(function () {});
        try { e.waitUntil(p); } catch (x) {}
      }
      return r;
    });
  }
  return caches.open(VS).then(function (c) {
    return c.match(key).then(function (hit) { return hit || net(c); });
  }, function () { return net(null); }).catch(function () { return Response.error(); });
}
self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (/supabase\.co$/.test(u.hostname) && /^\/storage\/v1\/object\/sign\/snimki\/.+\/mini\/[^\/]+$/.test(u.pathname)) { e.respondWith(mini(e, u)); return; }
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
