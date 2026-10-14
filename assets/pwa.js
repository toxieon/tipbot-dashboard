/* Installable tipdash: register the service worker, the one-time iOS home-screen
   hint, and the prompt shown when a new version is waiting. */
(function () {
  "use strict";
  var HINT_KEY = "tipdash_a2hs_dismissed";
  var updateReg = null;
  var updateBuilt = false;

  function isIosDevice(ua, platform, touchPoints) {
    ua = ua || "";
    if (/iPad|iPhone|iPod/.test(ua)) return true;
    return platform === "MacIntel" && touchPoints > 1;
  }

  function ios() {
    return isIosDevice(navigator.userAgent || "", navigator.platform, navigator.maxTouchPoints || 0);
  }

  function installed() {
    try {
      if (window.matchMedia("(display-mode: standalone)").matches) return true;
      if (window.matchMedia("(display-mode: fullscreen)").matches) return true;
      if (window.matchMedia("(display-mode: minimal-ui)").matches) return true;
    } catch (e) {}
    return window.navigator.standalone === true;
  }

  function dismissed() {
    try { return localStorage.getItem(HINT_KEY) === "1"; } catch (e) { return false; }
  }

  function rememberDismiss() {
    try { localStorage.setItem(HINT_KEY, "1"); } catch (e) {}
  }

  function syncLock() {
    var locked = document.documentElement.classList.contains("tg-locked");
    var nodes = document.querySelectorAll(".pwa-banner");
    for (var i = 0; i < nodes.length; i++) {
      if (locked) nodes[i].setAttribute("inert", "");
      else nodes[i].removeAttribute("inert");
    }
  }

  function stack() {
    var nodes = document.querySelectorAll(".pwa-banner");
    var top = 10;
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].hidden) continue;
      nodes[i].style.top = "calc(" + top + "px + env(safe-area-inset-top, 0px))";
      top += nodes[i].offsetHeight + 8;
    }
  }

  function banner(id, label) {
    var el = document.getElementById(id);
    if (el) return el;
    el = document.createElement("div");
    el.id = id;
    el.className = "pwa-banner";
    el.hidden = true;
    el.setAttribute("role", "region");
    el.setAttribute("aria-label", label);
    document.body.appendChild(el);
    syncLock();
    return el;
  }

  function button(id, label, primary, onClick) {
    var b = document.createElement("button");
    b.type = "button";
    b.id = id;
    b.textContent = label;
    if (primary) b.className = "pwa-go";
    b.addEventListener("click", onClick);
    return b;
  }

  function showIosHint() {
    if (!ios() || installed() || dismissed()) return;
    if (document.getElementById("pwa-ios")) return;
    var el = banner("pwa-ios", "Add to Home Screen");
    var p = document.createElement("p");
    p.textContent = "Add TipBot to your Home Screen. Tap Share, then Add to Home Screen.";
    var row = document.createElement("div");
    row.className = "pwa-banner-actions";
    row.appendChild(button("pwa-ios-dismiss", "Not now", false, function () {
      rememberDismiss();
      el.hidden = true;
      stack();
    }));
    el.appendChild(p);
    el.appendChild(row);
    el.hidden = false;
    stack();
  }

  function applyUpdate() {
    var waiting = updateReg && updateReg.waiting;
    var reloaded = false;
    if (navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener("controllerchange", function () {
        if (reloaded) return;
        reloaded = true;
        location.reload();
      });
    }
    if (waiting) waiting.postMessage({ type: "skip-waiting" });
    else location.reload();
  }

  function noteUpdate(reg) {
    if (reg) updateReg = reg;
    if (updateBuilt) return;
    updateBuilt = true;
    var el = banner("pwa-update", "Update available");
    el.setAttribute("aria-live", "polite");
    var p = document.createElement("p");
    p.textContent = "A new version of tipdash is ready.";
    var row = document.createElement("div");
    row.className = "pwa-banner-actions";
    row.appendChild(button("pwa-update-go", "Update", true, applyUpdate));
    row.appendChild(button("pwa-update-dismiss", "Not now", false, function () {
      el.hidden = true;
      stack();
    }));
    el.appendChild(p);
    el.appendChild(row);
    el.hidden = false;
    stack();
  }

  function watch(reg) {
    if (reg.waiting && navigator.serviceWorker.controller) noteUpdate(reg);
    reg.addEventListener("updatefound", function () {
      var worker = reg.installing;
      if (!worker) return;
      worker.addEventListener("statechange", function () {
        if (worker.state === "installed" && navigator.serviceWorker.controller) noteUpdate(reg);
      });
    });
  }

  function register() {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).then(function (reg) {
      watch(reg);
      document.addEventListener("visibilitychange", function () {
        if (document.visibilityState !== "visible") return;
        try {
          var pending = reg.update();
          if (pending && typeof pending.catch === "function") pending.catch(function () {});
        } catch (e) {}
      });
    }).catch(function () {});
  }

  window.TBPwa = {
    noteUpdate: noteUpdate,
    isIosDevice: isIosDevice,
    ios: ios,
    installed: installed
  };

  try {
    new MutationObserver(syncLock).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  } catch (e) {}
  window.addEventListener("resize", stack);
  showIosHint();
  register();
})();
