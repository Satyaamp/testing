const CACHE_NAME = "dhanrekha-v44"; // UPDATE THIS VERSION ON EVERY DEPLOY TO FORCE REFRESH

const STATIC_ASSETS = [
  "/",
  "/login",
  "/signup",
  "/dashboard",
  "/monthly",
  "/yearly",
  "/profile",
  "/forgot-password",

  "/css/index.css",
  "/css/glass.css",
  "/css/dashboard.css",
  "/css/monthly.css",

  "/js/api.js",
  "/js/authGuard.js",
  "/js/home.js",
  "/js/auth.js",
  "/js/signup.js",
  "/js/dashboard.js",
  "/js/monthly.js",

  "/assets/logo1.png",
  "/assets/banner.png",

  //ICONS (IMPORTANT FOR PWA INSTALL)
  "/assets/icons/icon-72.png",
  "/assets/icons/icon-96.png",
  "/assets/icons/icon-128.png",
  "/assets/icons/icon-144.png",
  "/assets/icons/icon-152.png",
  "/assets/icons/icon-192.png",
  "/assets/icons/icon-384.png",
  "/assets/icons/icon-512.png"
];

/* ================================
   INSTALL
================================ */
self.addEventListener("install", event => {
  console.log("Service Worker installing...");
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log("Caching static assets");
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting(); // force activate
});

/* ================================
   ACTIVATE
================================ */
self.addEventListener("activate", event => {
  console.log("🚀 Service Worker activating...");
  event.waitUntil(
    Promise.all([
      // Delete old caches
      caches.keys().then(keys =>
        Promise.all(
          keys.map(key => {
            if (key !== CACHE_NAME) {
              console.log("🧹 Deleting old cache:", key);
              return caches.delete(key);
            }
          })
        )
      ),
      self.clients.claim() // take control immediately
    ])
  );
});

/* ================================
   FETCH
================================ */
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // 1. Network First for HTML/Navigation (Ensures latest version)
  if (event.request.mode === 'navigate' || url.pathname.indexOf('.') === -1) {
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        })
        .catch(() => {
          return caches.match(event.request); // Fallback to cache if offline
        })
    );
  } else {
    // 2. Cache First for Static Assets (Images, CSS, JS)
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, response.clone());
            return response;
          });
        });
      })
    );
  }
});
