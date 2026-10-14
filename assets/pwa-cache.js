/* Cache policy for the tipdash service worker.
   The shell and static files may be stored. API calls, auth calls, and anything
   carrying a session header are network-only: nothing is read from or written
   to the cache. */
(function (root) {
  "use strict";
  var VERSION = "0.59.1";
  var CACHE = "tipdash-shell-" + VERSION;
  var ASSETS = [
    "favicon.ico", "favicon.svg", "apple-touch-icon.png", "icon-192.png", "icon-512.png", "logo.svg",
    "pwa.js", "pwa.css", "pwa-cache.js", "tbtime.js", "terms-gate.js", "terms-gate.css", "cookie-consent.js",
    "req-pool.js", "light-data.js", "lines.js", "racing-legs.js", "afl-guernseys.js", "compare-ui.js",
    "sport-keywords.js", "sport-marks.js", "discover-sports.js", "routing.js", "scheduled-tips.js",
    "auto-recaps.js", "emoji-picker.js", "upcoming-split.js", "espn-props.js", "tb-motion.js",
    "form-badges.js", "svg-charts.js", "server-view.js", "legal-md.js", "theme-apex.js", "theme-apex.css"
  ];
  var SHELL = ["/", "/index.html", "/offline.html", "/manifest.webmanifest", "/manifest.webmanifest?v=" + VERSION];
  ASSETS.forEach(function (name) {
    var path = "/assets/" + name;
    SHELL.push(path);
    SHELL.push(path + "?v=" + VERSION);
  });

  function header(headers, name) {
    if (!headers) return "";
    if (typeof headers.get === "function") return headers.get(name) || headers.get(name.toLowerCase()) || "";
    var keys = Object.keys(headers);
    for (var i = 0; i < keys.length; i++) {
      if (String(keys[i]).toLowerCase() === name) return headers[keys[i]] == null ? "" : String(headers[keys[i]]);
    }
    return "";
  }

  function isPrivatePath(pathname) {
    var p = String(pathname || "").toLowerCase();
    return p === "/api" || p.indexOf("/api/") === 0 || p === "/auth" || p.indexOf("/auth/") === 0;
  }

  function isStaticPath(pathname) {
    return /\.(?:js|mjs|css|png|svg|ico|webp|avif|gif|jpe?g|woff2?|webmanifest|json|txt)$/i.test(pathname || "");
  }

  function decide(input) {
    input = input || {};
    var origin = input.origin || "https://tipdashhq.com";
    var url = new URL(input.url, origin);
    var method = String(input.method || "GET").toUpperCase();
    var mode = input.mode || "";
    if (url.protocol !== "http:" && url.protocol !== "https:") return "ignore";
    if (url.origin !== origin) {
      if (mode === "navigate") return "ignore";
      return "network-only";
    }
    if (isPrivatePath(url.pathname)) return "network-only";
    if (header(input.headers, "authorization")) return "network-only";
    if (header(input.headers, "range")) return "network-only";
    if (method !== "GET") return "network-only";
    if (url.pathname === "/sw.js") return "network-only";
    if (isStaticPath(url.pathname)) return "static";
    if (mode === "navigate" || String(input.accept || "").indexOf("text/html") !== -1) return "navigation";
    return "network-only";
  }

  function canStore(res) {
    if (!res) return false;
    var status = res.status == null ? 0 : res.status;
    var type = res.type || "";
    if (status !== 200 || type !== "basic") return false;
    var cc = header(res.headers, "cache-control").toLowerCase();
    if (cc.indexOf("no-store") !== -1 || cc.indexOf("private") !== -1) return false;
    if (header(res.headers, "set-cookie")) return false;
    if (header(res.headers, "vary").toLowerCase().indexOf("authorization") !== -1) return false;
    return true;
  }

  var api = {
    VERSION: VERSION,
    CACHE: CACHE,
    SHELL: SHELL,
    isPrivatePath: isPrivatePath,
    isStaticPath: isStaticPath,
    decide: decide,
    canStore: canStore
  };
  root.TBPwaCache = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof self !== "undefined" ? self : globalThis);
