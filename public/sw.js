// v2: la versión anterior interceptaba TODA petición GET del mismo origen con
// una estrategia "primero red" y reescribía cada respuesta en caché en cada
// carga —incluidos el HTML de navegación, las respuestas de /api y los chunks
// de _next/static—. Eso añadía trabajo a cada arranque sin acelerar nada, y
// dejaba en caché HTML de rutas autenticadas (/dashboard) que podía servirse
// después con datos de otra sesión.
//
// Cambiar el nombre del caché hace que el handler `activate` borre el anterior.
const CACHE = 'studyhub-v2';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(OFFLINE_URL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// Los assets de _next/static llevan un hash de contenido en el nombre: nunca
// cambian sin cambiar de URL, así que servirlos desde caché es seguro y evita
// un viaje de red por chunk en cada visita.
function isImmutableAsset(url) {
  return url.pathname.startsWith('/_next/static/');
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Las rutas de API devuelven datos por usuario y deben ir siempre a la red.
  if (url.pathname.startsWith('/api/')) return;

  if (isImmutableAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, clone));
            }
            return response;
          })
      )
    );
    return;
  }

  // Navegaciones: siempre red (el HTML depende de la sesión y nunca debe
  // cachearse); si no hay conexión, mostramos la página offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then((r) => r ?? Response.error())
      )
    );
    return;
  }

  // El resto (iconos, manifest, sonidos) lo gestiona el navegador con su propia
  // caché HTTP; no hace falta duplicar ese trabajo aquí.
});
