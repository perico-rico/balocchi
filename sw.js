const CACHE_NAME = 'gemafusion-v1.5.0';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  // Imágenes del tema diamantes
  './images/diamonds/d01.png',
  './images/diamonds/d02.png',
  './images/diamonds/d03.png',
  './images/diamonds/d04.png',
  './images/diamonds/d05.png',
  './images/diamonds/d06.png',
  './images/diamonds/d07.png',
  './images/diamonds/d08.png',
  './images/diamonds/d09.png',
  './images/diamonds/d10.png',
  // Imágenes del tema frutas
  './images/frutas/a01.png',
  './images/frutas/a02.png',
  './images/frutas/a03.png',
  './images/frutas/a04.png',
  './images/frutas/a05.png',
  './images/frutas/a06.png',
  './images/frutas/a07.png',
  './images/frutas/a08.png',
  './images/frutas/a09.png',
  './images/frutas/a10.png',
  // Imágenes del tema frutas2
  './images/frutas2/b01.png',
  './images/frutas2/b02.png',
  './images/frutas2/b03.png',
  './images/frutas2/b04.png',
  './images/frutas2/b05.png',
  './images/frutas2/b06.png',
  './images/frutas2/b07.png',
  './images/frutas2/b08.png',
  './images/frutas2/b09.png',
  './images/frutas2/b10.png',
  // Imágenes del tema flores
  './images/flores/f01.png',
  './images/flores/f02.png',
  './images/flores/f03.png',
  './images/flores/f04.png',
  './images/flores/f05.png',
  './images/flores/f06.png',
  './images/flores/f07.png',
  './images/flores/f08.png',
  './images/flores/f09.png',
  './images/flores/f10.png',
  // Imágenes del tema vegetales
  './images/vegeta/v01.png',
  './images/vegeta/v02.png',
  './images/vegeta/v03.png',
  './images/vegeta/v04.png',
  './images/vegeta/v05.png',
  './images/vegeta/v06.png',
  './images/vegeta/v07.png',
  './images/vegeta/v08.png',
  './images/vegeta/v09.png',
  './images/vegeta/v10.png',
  // Sonidos
  './sounds/welcome.mp3',
  './sounds/merge.wav',
  './sounds/levelup.mp3',
  './sounds/victory.wav',
  './sounds/bonus.wav',
  './sounds/undo.wav'
];

// Instalar SW
self.addEventListener('install', event => {
  console.log('🔧 SW: Instalando Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 SW: Cache abierto');
        return cache.addAll(urlsToCache.map(url => {
          return new Request(url, {cache: 'reload'});
        }));
      })
      .then(() => {
        console.log('✅ SW: Todos los recursos en cache');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('❌ SW: Error cacheando recursos:', error);
      })
  );
});

// Activar SW
self.addEventListener('activate', event => {
  console.log('🚀 SW: Activando Service Worker...');
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              console.log('🗑️ SW: Eliminando cache antiguo:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('✅ SW: Cache actualizado');
        return self.clients.claim();
      })
  );
});

// Estrategia de fetch: Cache First con fallback a Network
self.addEventListener('fetch', event => {
  // Solo manejar requests HTTP/HTTPS
  if (event.request.url.startsWith('http')) {
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          // Si está en cache, devolverlo
          if (response) {
            console.log('📦 SW: Sirviendo desde cache:', event.request.url);
            return response;
          }
          
          // Si no está en cache, fetch desde red
          console.log('🌐 SW: Fetcheando desde red:', event.request.url);
          return fetch(event.request)
            .then(response => {
              // Verificar si es una respuesta válida
              if (!response || response.status !== 200 || response.type !== 'basic') {
                return response;
              }
              
              // Clonar respuesta (solo se puede leer una vez)
              const responseToCache = response.clone();
              
              // Añadir al cache para futuras requests
              caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(event.request, responseToCache);
                });
              
              return response;
            })
            .catch(error => {
              console.warn('⚠️ SW: Error de red:', error);
              
              // Si es una imagen, devolver imagen placeholder
              if (event.request.destination === 'image') {
                return new Response(
                  '<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">' +
                  '<rect width="100" height="100" fill="#2d3748"/>' +
                  '<text x="50" y="50" text-anchor="middle" fill="white">?</text>' +
                  '</svg>',
                  { headers: { 'Content-Type': 'image/svg+xml' } }
                );
              }
              
              // Para otras requests, re-throw el error
              throw error;
            });
        })
    );
  }
});

// Manejar mensajes del cliente
self.addEventListener('message', event => {
  console.log('💬 SW: Mensaje recibido:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({version: CACHE_NAME});
  }
});

// Log de información del SW
console.log('🎮 Gemafusion Service Worker v1.5.0 iniciado');
console.log('📊 Recursos a cachear:', urlsToCache.length);
