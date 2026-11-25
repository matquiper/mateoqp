/* Mateo QP · funciona sin conexión. La app se guarda en el iPad; los datos nunca pasan por esta caché. */
var V = 'mqp-v8';
var SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192-v2.png', './icons/icon-512-v2.png', './icons/maskable-512-v2.png', './icons/apple-touch-icon-v2.png'];
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
  // iconos y manifiesto: que los pida el navegador directamente (el iPhone los coge al «Añadir a pantalla de inicio»)
  if (/\/icons\/|manifest\.webmanifest$/.test(u.pathname)) return;
  // la app: primero la red (para coger versiones nuevas), si no hay, la copia guardada; la página solo se devuelve al abrir la app
  e.respondWith(fetch(e.request).then(function (n) { if (n && n.ok && n.type === 'basic') { var cp = n.clone(); caches.open(V).then(function (c) { c.put(e.request, cp); }); } return n; })
    .catch(function () { return caches.match(e.request).then(function (r) { return r || (e.request.mode === 'navigate' ? caches.match('./index.html') : Response.error()); }); }));
});
/* avisos del wellness y del RPE (llegan sin contenido: no llevan nombres ni datos).
   Se sabe cuál es por la hora: el más cercano a la hora programada de cada uno (la app la guarda en el dispositivo). */
function leerMeta() {
  return new Promise(function (res) {
    try {
      var q = indexedDB.open('mateoqp');
      q.onsuccess = function () { try { var g = q.result.transaction('kv').objectStore('kv').get('meta'); g.onsuccess = function () { res(g.result || {}); }; g.onerror = function () { res({}); }; } catch (x) { res({}); } };
      q.onerror = function () { res({}); };
    } catch (x) { res({}); }
  });
}
self.addEventListener('push', function (e) {
  e.waitUntil(leerMeta().then(function (m) {
    var h = new Date().getHours(), hw = (m.aviso && m.aviso.hora != null) ? +m.aviso.hora : 9, hr = (m.avisoRpe && m.avisoRpe.hora != null) ? +m.avisoRpe.hora : 21;
    var rpe = Math.abs(h - hr) < Math.abs(h - hw);
    return self.registration.showNotification(rpe ? 'Mateo QP · RPE final' : 'Mateo QP · Wellness',
      { body: rpe ? '¿Cómo de dura ha sido la sesión de hoy? Toca y responde tu RPE final.' : 'Toca para responder el wellness de hoy. Tarda 10 segundos.',
        icon: './icons/icon-192-v2.png', badge: './icons/icon-192-v2.png', tag: rpe ? 'rpe' : 'wellness', renotify: true, data: { url: './' } });
  }));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cs) {
    for (var i = 0; i < cs.length; i++) { if ('focus' in cs[i]) return cs[i].focus(); }
    return self.clients.openWindow('./');
  }));
});