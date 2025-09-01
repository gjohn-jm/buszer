/* Simple PWA Service Worker for a React SPA
 * Place this file in: client/public/service-worker.js
 * Make sure your app registers it (serviceWorkerRegistration.register()).
 */

const VERSION = "v1.0.0";
const APP_SHELL_CACHE = `app-shell-${VERSION}`;

// Files we want cached immediately (add/remove to fit your app)
const APP_SHELL = [
  "/",                    // will be rewritten to index.html by the SW for nav requests
  "/index.html",
  "/manifest.json",
  "/logo192.png",
  "/logo512.png",
];

// Install: pre-cache the app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL))
  );
  // Activate new SW immediately after install
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("app-shell-") && key !== APP_SHELL_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Helper: detect navigation requests (SPA routing)
function isNavigationRequest(request) {
  return request.mode === "navigate" ||
    (request.method === "GET" &&
      request.headers.get("accept") &&
      request.headers.get("accept").includes("text/html"));
}

// Fetch: strategies
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // 1) For navigations (React Router routes), use an "offline-first" SPA handler:
  if (isNavigationRequest(request)) {
    event.respondWith(
      fetch(request)
        .then((response) => response)               // Online OK
        .catch(() => caches.match("/index.html"))   // Offline → app shell
    );
    return;
  }

  const url = new URL(request.url);

  // 2) For built static assets (/static/*), use Stale-While-Revalidate
  if (url.pathname.startsWith("/static/")) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // 3) For everything else, try cache-first then network
  event.respondWith(
    caches.match(request).then((cached) => {
      return (
        cached ||
        fetch(request)
          .then((response) => {
            // Optionally cache GET responses
            if (request.method === "GET" && response && response.status === 200) {
              const clone = response.clone();
              caches.open(APP_SHELL_CACHE).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => cached) // if network fails and we had a cached version
      );
    })
  );
});

// Stale-While-Revalidate helper for /static/*
async function staleWhileRevalidate(request) {
  const cache = await caches.open(APP_SHELL_CACHE);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.status === 200) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => undefined);
  // Return cached immediately, update in background
  return cached || networkPromise;
}

// Listen for "SKIP_WAITING" messages to activate updates immediately
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
