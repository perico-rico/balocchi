const CACHE_NAME = 'gemafusion-pwa-v2.0';
const STATIC_CACHE = 'gemafusion-static-v2.0';
const IMAGES_CACHE = 'gemafusion-images-v2.0';

// Archivos estáticos que se cachean inmediatamente
const STATIC_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icon-72.png',
  './icon-96.png',
  './icon-128.png',
  './icon-144.png',
  './icon-152.png',
  './icon-192.png',
  './icon-384.png',
  './icon-512.png'
];

// URLs de imágenes remotas para cachear
const REMOTE_IMAGES = [
      './images/d01.png',
      './images/d02.png',
      './images/d03.png',
      './images/d04.png',
      './images/d05.png',
      './images/d06.png',
      './images/d07.png',
      './images/d08.png',
      './images/d09.png',
      './images/d10.png'
];

// Instalación del Service Worker
self.addEventListener('install', event => {
  console.log('🔧 Service Worker: Instalando...');
  
  event.waitUntil(
    Promise.all([
      // Cachear archivos estáticos
      caches.open(STATIC_CACHE).then(cache => {
        console.log('📦 Cacheando archivos estáticos...');
        return cache.addAll(STATIC_FILES);
      }),
      // Cachear imágenes remotas
      caches.open(IMAGES_CACHE).then(cache => {
        console.log('🖼️ Cacheando imágenes remotas...');
        return Promise.allSettled(
          REMOTE_IMAGES.map(url => 
            fetch(url)
              .then(response => {
                if (response.ok) {
                  return cache.put(url, response);
                }
                throw new Error(`Failed to fetch ${url}`);
              })
              .catch(error => {
                console.warn(`⚠️ No se pudo cachear: ${url}`, error);
              })
          )
        );
      })
    ]).then(() => {
      console.log('✅ Service Worker: Instalación completada');
      // Forzar activación inmediata
      return self.skipWaiting();
    })
  );
});

// Activación del Service Worker
self.addEventListener('activate', event => {
  console.log('🚀 Service Worker: Activando...');
  
  event.waitUntil(
    Promise.all([
      // Limpiar cachés obsoletos
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== STATIC_CACHE && 
                cacheName !== IMAGES_CACHE && 
                cacheName !== CACHE_NAME) {
              console.log('🗑️ Eliminando caché obsoleto:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Tomar control de todos los clientes
      self.clients.claim()
    ]).then(() => {
      console.log('✅ Service Worker: Activación completada');
    })
  );
});

// Manejo de solicitudes de red
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Estrategia para archivos estáticos: Cache First
  if (STATIC_FILES.some(file => request.url.includes(file))) {
    event.respondWith(
      caches.match(request).then(response => {
        if (response) {
          return response;
        }
        return fetch(request).then(fetchResponse => {
          return caches.open(STATIC_CACHE).then(cache => {
            cache.put(request, fetchResponse.clone());
            return fetchResponse;
          });
        });
      })
    );
    return;
  }

  // Estrategia para imágenes remotas: Cache First con fallback
  if (REMOTE_IMAGES.includes(request.url)) {
    event.respondWith(
      caches.match(request).then(response => {
        if (response) {
          console.log('📱 Imagen servida desde caché:', request.url);
          return response;
        }
        
        return fetch(request).then(fetchResponse => {
          if (fetchResponse.ok) {
            return caches.open(IMAGES_CACHE).then(cache => {
              cache.put(request, fetchResponse.clone());
              console.log('💾 Imagen cacheada:', request.url);
              return fetchResponse;
            });
          }
          throw new Error('Network response was not ok');
        }).catch(error => {
          console.warn('⚠️ Error al cargar imagen:', request.url, error);
          // Retornar una imagen placeholder si está disponible
          return caches.match('./icon-192.png');
        });
      })
    );
    return;
  }

  // Estrategia para navegación: Network First con fallback a caché
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then(response => {
        return response;
      }).catch(() => {
        return caches.match('./index.html');
      })
    );
    return;
  }

  // Estrategia por defecto: Network First
  event.respondWith(
    fetch(request).then(response => {
      // Si la respuesta es exitosa, cachearla
      if (response.status === 200) {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(request, responseClone);
        });
      }
      return response;
    }).catch(() => {
      // Si la red falla, intentar servir desde caché
      return caches.match(request);
    })
  );
});

// Manejo de mensajes desde el cliente
self.addEventListener('message', event => {
  const { action, data } = event.data;

  switch (action) {
    case 'GET_CACHE_SIZE':
      getCacheSize().then(size => {
        event.ports[0].postMessage({ size });
      });
      break;
      
    case 'CLEAR_CACHE':
      clearAllCaches().then(success => {
        event.ports[0].postMessage({ success });
      });
      break;
      
    case 'UPDATE_CACHE':
      updateCache().then(success => {
        event.ports[0].postMessage({ success });
      });
      break;
      
    default:
      console.warn('⚠️ Acción de mensaje no reconocida:', action);
  }
});

// Función para obtener el tamaño del caché
async function getCacheSize() {
  try {
    const cacheNames = await caches.keys();
    let totalSize = 0;
    
    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName);
      const requests = await cache.keys();
      
      for (const request of requests) {
        const response = await cache.match(request);
        if (response) {
          const blob = await response.blob();
          totalSize += blob.size;
        }
      }
    }
    
    return Math.round(totalSize / 1024 / 1024 * 100) / 100; // MB
  } catch (error) {
    console.error('❌ Error calculando tamaño de caché:', error);
    return 0;
  }
}

// Función para limpiar todos los cachés
async function clearAllCaches() {
  try {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames.map(cacheName => caches.delete(cacheName))
    );
    console.log('🧹 Todos los cachés eliminados');
    return true;
  } catch (error) {
    console.error('❌ Error limpiando cachés:', error);
    return false;
  }
}

// Función para actualizar el caché
async function updateCache() {
  try {
    // Forzar actualización de archivos estáticos
    const cache = await caches.open(STATIC_CACHE);
    await Promise.all(
      STATIC_FILES.map(url => {
        return fetch(url + '?v=' + Date.now())
          .then(response => {
            if (response.ok) {
              return cache.put(url, response);
            }
            throw new Error(`Failed to update ${url}`);
          })
          .catch(error => {
            console.warn(`⚠️ No se pudo actualizar: ${url}`, error);
          });
      })
    );
    
    console.log('🔄 Caché actualizado');
    return true;
  } catch (error) {
    console.error('❌ Error actualizando caché:', error);
    return false;
  }
}

// Manejo de sincronización en segundo plano
self.addEventListener('sync', event => {
  console.log('🔄 Background Sync:', event.tag);
  
  if (event.tag === 'game-stats-sync') {
    event.waitUntil(syncGameStats());
  }
});

// Función para sincronizar estadísticas del juego
async function syncGameStats() {
  try {
    // Aquí podrías enviar estadísticas a un servidor si fuera necesario
    console.log('📊 Sincronizando estadísticas del juego...');
    
    // Simular sincronización
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('✅ Estadísticas sincronizadas');
  } catch (error) {
    console.error('❌ Error sincronizando estadísticas:', error);
    throw error; // Re-lanzar para reintento automático
  }
}

// Notificaciones push (para futuras características)
self.addEventListener('push', event => {
  console.log('📬 Push recibido:', event);
  
  const options = {
    body: event.data ? event.data.text() : 'Nueva actualización disponible',
    icon: './icon-192.png',
    badge: './icon-72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Abrir juego',
        icon: './icon-192.png'
      },
      {
        action: 'close',
        title: 'Cerrar',
        icon: './icon-192.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('Gemafusion', options)
  );
});

// Manejo de clics en notificaciones
self.addEventListener('notificationclick', event => {
  console.log('🔔 Notificación clickeada:', event.notification.tag);
  
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('./index.html')
    );
  }
});

console.log('🎮 Gemafusion Service Worker registrado correctamente');
console.log('📱 Características del SW:');
console.log('  • Caché inteligente de recursos');
console.log('  • Soporte offline completo');
console.log('  • Gestión automática de versiones');
console.log('  • Optimización para imágenes remotas');
console.log('  • Background sync preparado');
console.log('  • Push notifications listo');