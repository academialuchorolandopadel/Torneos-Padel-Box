// PadelBox service worker — requisito de instalabilidad PWA
// Estrategia: network-first (la app siempre intenta datos frescos de Firestore;
// el cache solo sirve el shell si no hay conexión)
const CACHE = "padelbox-v1";
const SHELL = ["/Torneos-Padel-Box/", "/Torneos-Padel-Box/index.html"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  // Solo GET y solo nuestro origen — Firestore/Auth pasan directo
  if (e.request.method !== "GET" || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match("/Torneos-Padel-Box/index.html")))
  );
});
