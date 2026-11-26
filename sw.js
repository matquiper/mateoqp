/* Mateo QP · funciona sin conexión. La app se guarda en el iPad; los datos nunca pasan por esta caché. */
var V = 'mqp-v11';
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
function leerKv(k) {
  return new Promise(function (res) {
    try {
      var q = indexedDB.open('mateoqp');
      q.onsuccess = function () { try { var g = q.result.transaction('kv').objectStore('kv').get(k); g.onsuccess = function () { res(g.result || {}); }; g.onerror = function () { res({}); }; } catch (x) { res({}); } };
      q.onerror = function () { res({}); };
    } catch (x) { res({}); }
  });
}
function leerMeta() { return leerKv('meta'); }
/* ¿juega hoy su equipo? (la pestaña PARTIDOS guardada en el móvil solo tiene los de su equipo) */
function hayPartidoHoy(tabs) {
  var P = (tabs && tabs.PARTIDOS) || [], h = (P[0] || []).map(function (x) { return String(x).toLowerCase(); }), cf = h.indexOf('fecha'), ce = h.indexOf('estado');
  if (cf < 0) return false;
  var d = new Date(), hoy = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return P.slice(1).some(function (r) {
    var s = String(r[cf] || '').trim(), t = null, m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) t = Date.UTC(+m[3], +m[2] - 1, +m[1]); else if (/^\d{5}(\.\d+)?$/.test(s)) t = Date.UTC(1899, 11, 30) + Math.floor(+s) * 864e5;
    var est = ce >= 0 ? String(r[ce] || '').toLowerCase() : '';
    return t === hoy && est.indexOf('susp') < 0 && est.indexOf('aplaz') < 0;
  });
}
self.addEventListener('push', function (e) {
  e.waitUntil(Promise.all([leerMeta(), leerKv('tabs')]).then(function (x) {
    var m = x[0], par = hayPartidoHoy(x[1]);
    /* el del wellness sale por la mañana a su hora; el del RPE, al acabar el entreno o el partido (cada día a una hora) */
    var d = new Date(), h = d.getHours() + d.getMinutes() / 60, hw = (m.aviso && m.aviso.hora != null) ? +m.aviso.hora : 9;
    var rpe = h >= hw + 2.5 || h < hw - 4;
    var tit = !rpe ? 'Mateo QP · Wellness' : par ? 'Mateo QP · RPE del partido' : 'Mateo QP · RPE final';
    var txt = !rpe ? 'Toca para responder el wellness de hoy. Tarda 10 segundos.' : par ? '¿Cómo de duro ha sido el partido? Pon tu RPE y los minutos que has jugado.' : '¿Cómo de dura ha sido la sesión de hoy? Toca y responde tu RPE final.';
    return self.registration.showNotification(tit,
      { body: txt,
        icon: './icons/icon-192-v2.png', badge: './icons/icon-192-v2.png', tag: rpe ? 'rpe' : 'wellness', renotify: true, data: { go: rpe ? 'rpe' : 'wellness' } });
  }));
});
/* al tocar el aviso: la app se abre (o se pone delante) en «Hoy», justo en la tarjeta del wellness o del RPE */
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var go = (e.notification.data && e.notification.data.go) || 'rpe';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cs) {
    for (var i = 0; i < cs.length; i++) { if ('focus' in cs[i]) { cs[i].postMessage({ go: go }); return cs[i].focus(); } }
    return self.clients.openWindow('./#' + go);
  }));
});