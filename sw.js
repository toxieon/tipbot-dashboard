/* tipdash sw 0.59.1 — app shell and static assets. API calls are not stored. */
importScripts("/assets/pwa-cache.js");

var P = self.TBPwaCache;

self.addEventListener("install", function (event) {
  event.waitUntil(caches.open(P.CACHE).then(function (cache) {
    return cache.addAll(P.SHELL);
  }));
});

self.addEventListener("activate", function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (key) { return key !== P.CACHE; }).map(function (key) {
      return caches.delete(key);
    }));
  }).then(function () {
    return self.clients.claim();
  }));
});

self.addEventListener("message", function (event) {
  var data = event.data || {};
  if (data.type === "skip-waiting") self.skipWaiting();
});

function fromNetwork(req) {
  if (req.method === "GET" || req.method === "HEAD") {
    try { return fetch(new Request(req, { cache: "no-store" })); } catch (e) {}
  }
  return fetch(req);
}

function putIfAllowed(cache, req, res) {
  if (!P.canStore(res)) return;
  cache.put(req, res.clone()).catch(function () {});
}

function cachedPage(cache, req) {
  return cache.match(req).then(function (hit) {
    if (hit) return hit;
    return cache.match("/offline.html").then(function (offline) {
      if (offline) return offline;
      return new Response("You are offline.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    });
  });
}

function networkFirstPage(req) {
  return caches.open(P.CACHE).then(function (cache) {
    return fetch(req).then(function (res) {
      putIfAllowed(cache, req, res);
      return res;
    }, function () {
      return cachedPage(cache, req);
    });
  });
}

function cacheFirstStatic(req) {
  return caches.open(P.CACHE).then(function (cache) {
    return cache.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        putIfAllowed(cache, req, res);
        return res;
      });
    });
  });
}

self.addEventListener("fetch", function (event) {
  var req = event.request;
  var choice;
  try {
    choice = P.decide({
      url: req.url,
      origin: self.location.origin,
      method: req.method,
      mode: req.mode,
      headers: req.headers,
      accept: req.headers.get("accept") || ""
    });
  } catch (e) {
    return;
  }
  if (choice === "ignore") return;
  if (choice === "network-only") {
    // Cross-origin calls are the bot API and sign-in. Leave them on the network
    // the page already started (cache mode included). Do not read or store them.
    if (new URL(req.url).origin !== self.location.origin) return;
    event.respondWith(fromNetwork(req));
    return;
  }
  if (choice === "navigation") {
    event.respondWith(networkFirstPage(req));
    return;
  }
  if (choice === "static") event.respondWith(cacheFirstStatic(req));
});
