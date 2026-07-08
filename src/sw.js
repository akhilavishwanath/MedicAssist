const CACHE_NAME = "medicassist-cache-v2";
const ASSETS = [
    "./",
    "./index.html",
    "./styles.css",
    "./app.js",
    "./api-client.js",
    "./fhir-builder.js",
    "./db.js",
    "./manifest.json",
    "./styles/variables.css",
    "./styles/base.css",
    "./styles/layout.css",
    "./styles/components.css",
    "./styles/animations.css",
    "./styles/responsive.css",
    "./components/recorder.js",
    "./components/utils.js",
    "./components/status.js",
    "./components/transcript.js",
    "./components/fhirViewer.js",
    "./components/exportUtils.js",
    "./components/records.js"
];

// Install Event
self.addEventListener("install", (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        }).then(() => self.skipWaiting())
    );
});

// Activate Event
self.addEventListener("activate", (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch Event (Cache First with Network Fallback)
self.addEventListener("fetch", (e) => {
    if (e.request.method !== "GET") return;

    e.respondWith(
        caches.match(e.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }

            return fetch(e.request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(e.request, responseClone);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // Ignore network failure and return nothing if not cached
            });
        })
    );
});
