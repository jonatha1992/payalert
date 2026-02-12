// Service Worker para PayAlert
// Maneja notificaciones push y caching

const CACHE_NAME = 'payalert-v1';
const urlsToCache = [
  '/',
  '/dashboard',
  '/icon-192x192.png',
  '/icon-512x512.png',
];

// Instalación del Service Worker
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Cache opened');
        return cache.addAll(urlsToCache);
      })
      .catch((err) => {
        console.error('[Service Worker] Cache failed:', err);
      })
  );
  
  // Activar inmediatamente
  self.skipWaiting();
});

// Activación del Service Worker
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  // Tomar control de todas las páginas
  self.clients.claim();
});

// Manejar notificaciones push
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push received:', event);
  
  let data = {
    title: 'Nueva notificación',
    body: 'Tienes una nueva notificación de PayAlert',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: 'default',
    data: {},
    actions: [
      { action: 'open', title: 'Abrir app' },
      { action: 'close', title: 'Cerrar' }
    ]
  };
  
  try {
    if (event.data) {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    }
  } catch (error) {
    console.error('[Service Worker] Error parsing push data:', error);
  }
  
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      tag: data.tag,
      data: data.data,
      actions: data.actions,
      requireInteraction: true,
      vibrate: [200, 100, 200],
    })
  );
});

// Manejar click en notificaciones
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification click:', event);
  
  event.notification.close();
  
  const action = event.action;
  const notificationData = event.notification.data;
  
  if (action === 'close') {
    return;
  }
  
  // Abrir o enfocar la app
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Si hay una ventana abierta, enfocarla
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Si no hay ventana abierta, abrir una nueva
        if (self.clients.openWindow) {
          const url = notificationData?.url || '/dashboard';
          return self.clients.openWindow(url);
        }
      })
  );
});

// Manejar mensajes desde la app
self.addEventListener('message', (event) => {
  console.log('[Service Worker] Message received:', event.data);
  
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    self.registration.showNotification(event.data.title, {
      body: event.data.body,
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      tag: 'manual-notification',
    });
  }
});

// Fetch event - estrategia stale-while-revalidate para la app
self.addEventListener('fetch', (event) => {
  // Solo cachear requests GET
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Ignorar requests de API
  if (event.request.url.includes('/api/')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          // Actualizar cache en background
          fetch(event.request)
            .then((networkResponse) => {
              if (networkResponse.ok) {
                caches.open(CACHE_NAME)
                  .then((cache) => {
                    cache.put(event.request, networkResponse);
                  });
              }
            })
            .catch(() => {
              // Falló el fetch en background, ignorar
            });
          
          return response;
        }
        
        // Cache miss - fetch from network
        return fetch(event.request)
          .then((networkResponse) => {
            // No cachear si no es OK
            if (!networkResponse.ok) {
              return networkResponse;
            }
            
            // Clonar respuesta para cachear
            const responseToCache = networkResponse.clone();
            
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
            
            return networkResponse;
          })
          .catch((error) => {
            console.error('[Service Worker] Fetch failed:', error);
            // Podríamos retornar una página offline aquí
            throw error;
          });
      })
  );
});
