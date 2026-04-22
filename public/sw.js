// ============================================================
//  public/sw.js — Service Worker (PWA)
//  Enables offline access and "Add to Home Screen" install.
//  This file must live at the ROOT of your public folder.
// ============================================================

const CACHE_NAME    = "campus-gallery-v1";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/gallery.html",
  "/about.html",
  "/login.html",
  "/css/global.css",
  "/css/home.css",
  "/css/gallery.css",
  "/css/about.css",
  "/css/login.css",
  "/js/global.js",
  "/js/home.js",
  "/js/gallery.js",
  "/manifest.json",
];

// ── Install: Pre-cache all static assets ─────────────────────
self.addEventListener("install", (event) => {
  console.log("[SW] Installing and caching static assets...");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting(); // Activate immediately
});

// ── Activate: Clean up old caches ────────────────────────────
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating and cleaning old caches...");
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

// ── Fetch: Network-first for API, Cache-first for static ─────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Always go to the network for API calls (live data)
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(request));
    return;
  }

  // For static assets: try cache first, fall back to network
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((networkResponse) => {
        // Cache the new resource for future use
        const clone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return networkResponse;
      });
    }).catch(() => {
      // If offline and not cached, show a friendly fallback for HTML pages
      if (request.headers.get("accept").includes("text/html")) {
        return caches.match("/index.html");
      }
    })
  );
});
