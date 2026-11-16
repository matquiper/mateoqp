/* Mateo QP · funciona sin conexión. La app se guarda en el iPad; los datos nunca pasan por esta caché. */
var V = 'mqp-v2';
var SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(V).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener('activate', function (e) { e.waitUntil(caches.keys().then(function (k) { return Promise.all(k.filter(function (x) { return x !== V; }).map(function (x) { return caches.delete(x); })); }).then(function () { return self.clients.claim(); })); });
self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== 'GET' || /script\.google(usercontent)?\.com$/.test(u.hostname)) return;   // API: siempre a la red
  if (u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(V).then(function (c) { return c.match(e.request).then(function (r) { return r || fetch(e.request).then(function (n) { c.put(e.request, n.clone()); return n; }); }); }));
    return;
  }
  if (u.origin !== location.origin) return;
  // la app: primero la red (para coger versiones nuevas), si no hay, la copia guardada
  e.respondWith(fetch(e.request).then(function (n) { var cp = n.clone(); caches.open(V).then(function (c) { c.put(e.request, cp); }); return n; })
    .catch(function () { return caches.match(e.request).then(function (r) { return r || caches.match('./index.html'); }); }));
});
