// service-worker.js
// Cachea el "app shell" y las librerías externas para que la app funcione
// sin conexión una vez instalada en el celular.

const CACHE_NAME = 'asistencia-qr-v1';

const APP_SHELL = [
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/db.js',
  './js/qr.js',
  './js/pdf.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png'
];

const EXTERNAL_LIBS = [
  'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js',
  'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // El app shell es local y siempre debe poder cachearse.
      const shellPromise = cache.addAll(APP_SHELL);
      // Las librerías externas se intentan cachear, pero si el dispositivo
      // no tiene internet en este momento no debe romper la instalación.
      const libsPromise = Promise.all(
        EXTERNAL_LIBS.map((url) =>
          fetch(url, { mode: 'cors' })
            .then((res) => (res && res.ok ? cache.put(url, res) : null))
            .catch(() => null)
        )
      );
      return Promise.all([shellPromise, libsPromise]);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          // Sólo cacheamos respuestas válidas (evita cachear errores/opacas raras).
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // Sin red y sin caché: si pedían la página principal, devuélvela igual.
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return undefined;
        });
    })
  );
});
