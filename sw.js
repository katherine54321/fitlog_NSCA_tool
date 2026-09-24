const CACHE_NAME = "fitlog-app-v82";
const IMAGE_CACHE_NAME = "fitlog-exercise-images-v1";
const appUrl = (path) => new URL(path, self.registration.scope).pathname;
const APP_SHELL = appUrl("index.html");
const RUNTIME_CONFIG = appUrl("config/fitlog-runtime.js");
const IMAGE_PLACEHOLDER = appUrl("assets/exercise-placeholder.svg");
const APP_ASSETS = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "app-icon.svg",
  "icon-192.png",
  "icon-512.png",
  "data/exercises-v1.json",
  "data/exercise-library-data.js",
  "assets/exercise-placeholder.svg"
].map(appUrl);

const isExerciseImagePath = (pathname) =>
  pathname.startsWith(appUrl("assets/exercise-images/")) ||
  pathname === IMAGE_PLACEHOLDER;

const isImageRequest = (request) => {
  const { pathname } = new URL(request.url);
  return request.destination === "image" || isExerciseImagePath(pathname);
};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME && key !== IMAGE_CACHE_NAME).map((key) => caches.delete(key)))
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (isImageRequest(event.request)) {
    event.respondWith(
      caches.open(IMAGE_CACHE_NAME).then((imageCache) => imageCache.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request)
          .then((response) => {
            if (response.ok) {
              const copy = response.clone();
              imageCache.put(event.request, copy);
            }
            return response.ok ? response : caches.match(IMAGE_PLACEHOLDER);
          })
          .catch(() => caches.match(IMAGE_PLACEHOLDER));
      }))
    );
    return;
  }
  if (new URL(event.request.url).pathname === RUNTIME_CONFIG) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(APP_SHELL, copy));
          return response;
        })
        .catch(() => caches.match(APP_SHELL))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request))
    })
  );
});
