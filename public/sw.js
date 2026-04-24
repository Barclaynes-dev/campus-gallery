// ============================================================
//  public/sw.js — Service Worker (PWA)
//  Enables offline access and "Add to Home Screen" install.
//  This file must live at the ROOT of your public folder.
// ============================================================

const CACHE_NAME    = "campus-gallery-v2";
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
  "/js/about.js",
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

// ── Allow pages to activate updates immediately ───────────────
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// ── Fetch strategy ─────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Always go to the network for API calls (live data)
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(request));
    return;
  }

  // For full-page navigations, prefer fresh network HTML so page/script/theme
  // fixes are picked up immediately. Fall back to cache when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return networkResponse;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("/index.html")))
    );
    return;
  }

  // For non-HTML static assets: stale-while-revalidate. Return cached quickly,
  // but update cache in the background so next load gets fresh files.
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((networkResponse) => {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return networkResponse;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});
