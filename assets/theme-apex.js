/* Apex theme behaviour. Loaded only while html[data-theme="apex"].
   Motion is transform and opacity. Loops pause when the tab is hidden
   or the glow is off screen. Reduced motion shows the end state. */
(function (root) {
  "use strict";
  var EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
  var RING = 2 * Math.PI * 15;
  var WINDOW_MS = 6 * 3600 * 1000;
  var doc = root.document;
  var started = false;
  var glow = null;
  var glowIO = null;
  var seenIO = null;
  var rankPrev = typeof WeakMap === "function" ? new WeakMap() : null;
  var busy = false;
  var queued = false;

  function reduced() {
    try { return !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches); }
    catch (e) { return false; }
  }
  function active() {
    return !!(doc && doc.documentElement && doc.documentElement.dataset.theme === "apex");
  }
  function raf(fn) {
    if (root.requestAnimationFrame) return root.requestAnimationFrame(fn);
    return setTimeout(fn, 16);
  }

  function loadCss() {
    if (!doc || doc.getElementById("theme-apex-css")) return;
    var cur = doc.querySelector("script[data-apex]");
    var src = cur && cur.src ? cur.src : "";
    var href = src ? src.replace(/theme-apex\.js.*$/, "theme-apex.css") : "./assets/theme-apex.css";
    var link = doc.createElement("link");
    link.id = "theme-apex-css";
    link.rel = "stylesheet";
    link.href = href;
    (doc.head || doc.documentElement).appendChild(link);
  }

  function syncTone() {
    if (!doc) return;
    var el = doc.documentElement;
    var auto = false;
    try { auto = root.localStorage.getItem("tipbot_theme_auto") === "true"; } catch (e) {}
    var day = false;
    try { day = !!(root.TBTime && root.TBTime.isDaytime(Date.now())); } catch (e2) {}
    if (el.dataset.theme === "apex" && auto && day) el.dataset.apexLight = "1";
    else delete el.dataset.apexLight;
    var meta = doc.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    if (el.dataset.theme === "apex") meta.setAttribute("content", el.dataset.apexLight === "1" ? "#F4F6F8" : "#07090F");
    else if (meta.getAttribute("content") === "#07090F" || meta.getAttribute("content") === "#F4F6F8") meta.setAttribute("content", "#0b0f1a");
  }

  function heroHost() {
    var ids = ["overview", "detail", "builder"];
    var i, el;
    for (i = 0; i < ids.length; i++) {
      el = doc.getElementById(ids[i]);
      if (el && !el.hidden) return el;
    }
    return doc.querySelector("main") || doc.body;
  }

  function placeGlow() {
    if (!active() || !doc.body) return;
    var host = heroHost();
    if (!host) return;
    var skip = host.id === "settings" || host.id === "ops";
    if (skip) {
      if (glow && glow.parentNode) glow.parentNode.removeChild(glow);
      return;
    }
    if (!glow) {
      glow = doc.createElement("div");
      glow.className = "apex-glow";
      glow.setAttribute("aria-hidden", "true");
    }
    if (glow.parentNode !== host) host.insertBefore(glow, host.firstChild);
    if (glowIO) glowIO.observe(glow);
    if (reduced() || doc.hidden) glow.classList.add("apex-paused");
  }

  function inView(el) {
    if (!el || !el.getBoundingClientRect) return false;
    var r = el.getBoundingClientRect();
    var h = root.innerHeight || 800;
    return r.width > 0 && r.bottom > 0 && r.top < h;
  }

  function armRise(scope) {
    var nodes = (scope || doc).querySelectorAll(".panel, .scard, .sv-stat, .sv-panel, .game-group, .gcard, .dc-card");
    var n = 0;
    nodes.forEach(function (el) {
      if (el.dataset.apexRise === "1") return;
      el.dataset.apexRise = "1";
      el.classList.add("apex-rise");
      el.style.setProperty("--apex-i", String(Math.min(n, 8)));
      n++;
      if (reduced() || inView(el)) el.classList.add("apex-in");
      else if (seenIO) seenIO.observe(el);
    });
  }

  function markDisplay() {
    var host = heroHost();
    if (!host || host.querySelector(".apex-display")) return;
    var pick = host.querySelector('.sv-big b, [data-sv="units"], .mini .mv.pos, .mini .mv.neg, .dc-net, .tile .tv');
    if (pick) pick.classList.add("apex-display");
  }

  function oneNumber(text) {
    var found = String(text == null ? "" : text).match(/[+-]?\d+(?:\.\d+)?/g);
    return found && found.length === 1 ? found[0] : null;
  }

  function countEl(el, ms) {
    if (!el || el.dataset.apexCounted === "1") return;
    var raw = el.textContent || "";
    var numText = oneNumber(raw);
    if (numText == null) return;
    el.dataset.apexCounted = "1";
    if (reduced()) return;
    var neg = numText.charAt(0) === "-";
    var pos = numText.charAt(0) === "+";
    var abs = parseFloat(pos || neg ? numText.slice(1) : numText);
    if (!isFinite(abs)) return;
    var at = raw.indexOf(numText);
    var prefix = raw.slice(0, at);
    var suffix = raw.slice(at + numText.length);
    var decimals = (numText.split(".")[1] || "").length;
    var t0 = root.performance && root.performance.now ? root.performance.now() : Date.now();
    function frame(now) {
      var t = now == null ? Date.now() : now;
      var p = Math.min(1, (t - t0) / ms);
      var e = 1 - Math.pow(1 - p, 3);
      var v = abs * e;
      var body = decimals ? v.toFixed(decimals) : String(Math.round(v));
      el.textContent = prefix + (neg ? "-" : pos ? "+" : "") + body + suffix;
      if (p < 1) raf(frame);
      else el.textContent = raw;
    }
    raf(frame);
  }

  function armCounts(scope) {
    (scope || doc).querySelectorAll(".apex-display, .sv-stat .v, .sv-big b").forEach(function (el) {
      if (el.dataset.apexCount === "1") return;
      el.dataset.apexCount = "1";
      if (reduced() || inView(el)) countEl(el, el.classList.contains("apex-display") ? 640 : 320);
      else if (seenIO) seenIO.observe(el);
      if (el.classList.contains("apex-display") && (reduced() || inView(el))) el.classList.add("apex-in");
    });
  }

  function drawLine(path) {
    if (!path || path.dataset.apexDrawn === "1") return;
    var len = 0;
    try { len = path.getTotalLength(); } catch (e) { return; }
    if (!(len > 0)) return;
    path.dataset.apexDrawn = "1";
    var svg = path.ownerSVGElement || path.parentNode;
    var end = svg && svg.querySelector ? svg.querySelector(".sv-end") : null;
    if (reduced()) {
      path.style.strokeDashoffset = "0";
      return;
    }
    path.style.strokeDasharray = String(len);
    path.style.strokeDashoffset = String(len);
    try {
      var anim = path.animate(
        [{ strokeDashoffset: len }, { strokeDashoffset: 0 }],
        { duration: 640, easing: EASE, fill: "both" }
      );
      anim.onfinish = function () { path.style.strokeDashoffset = "0"; };
    } catch (e2) {
      path.style.strokeDashoffset = "0";
    }
    if (end) end.classList.add("apex-pulse");
  }

  function armLines(scope) {
    (scope || doc).querySelectorAll(".sv-line, .sv-svg path[fill='none'], svg polyline.sv-line").forEach(function (path) {
      if (path.dataset.apexWatch === "1") return;
      path.dataset.apexWatch = "1";
      if (!path.classList.contains("sv-line")) path.classList.add("sv-line");
      if (reduced() || inView(path)) drawLine(path);
      else if (seenIO) seenIO.observe(path);
    });
  }

  function burst(origin) {
    var n = 10 + Math.floor(Math.random() * 5);
    var colors = ["var(--win)", "var(--accent)", "var(--txt)", "var(--warn)"];
    var i;
    for (i = 0; i < n; i++) {
      var bit = doc.createElement("i");
      bit.className = "apex-confetti";
      var ang = Math.random() * Math.PI * 2;
      var dist = 28 + Math.random() * 36;
      bit.style.setProperty("--dx", (Math.cos(ang) * dist).toFixed(1) + "px");
      bit.style.setProperty("--dy", (Math.sin(ang) * dist - 8).toFixed(1) + "px");
      bit.style.setProperty("--rot", (Math.random() * 140 - 70).toFixed(0) + "deg");
      bit.style.background = colors[i % colors.length];
      origin.appendChild(bit);
    }
    setTimeout(function () {
      var bits = origin.querySelectorAll(".apex-confetti");
      for (var k = 0; k < bits.length; k++) if (bits[k].parentNode) bits[k].parentNode.removeChild(bits[k]);
    }, 900);
  }

  function stamp(card) {
    if (!card || card.dataset.apexStamp === "1") return;
    if (card.dataset.settled !== "1") return;
    var win = card.querySelector(".tbchip--win");
    var loss = card.querySelector(".tbchip--loss");
    if (!win && !loss) return;
    var id = card.getAttribute("data-tip") || "";
    if (!id) return;
    var key = "apex-stamp:" + id;
    var played = false;
    try { played = root.sessionStorage.getItem(key) === "1"; } catch (e) {}
    card.dataset.apexStamp = "1";
    try { root.sessionStorage.setItem(key, "1"); } catch (e2) {}
    var mark = doc.createElement("span");
    mark.className = "apex-stamp " + (win ? "apex-stamp-win" : "apex-stamp-loss");
    mark.setAttribute("aria-hidden", "true");
    mark.textContent = win ? "WON" : "LOST";
    card.appendChild(mark);
    if (played || reduced()) return;
    card.classList.add("apex-flip");
    if (win) {
      burst(mark);
      try { if (root.navigator && root.navigator.vibrate) root.navigator.vibrate(12); } catch (e3) {}
    }
    setTimeout(function () { card.classList.remove("apex-flip"); }, 700);
  }

  function armStamps(scope) {
    (scope || doc).querySelectorAll(".betcard[data-settled='1']").forEach(stamp);
  }

  function formStrip(form) {
    if (!form || form.dataset.apexForm === "1") return;
    var dots = form.querySelectorAll(".tb-form-dot");
    if (!dots.length && !(form.getAttribute("data-streak") === "W" && Number(form.getAttribute("data-streak-n")) >= 3)) return;
    form.dataset.apexForm = "1";
    var formKey = "apex-form:" + (form.getAttribute("aria-label") || "");
    var played = false;
    try { played = root.sessionStorage.getItem(formKey) === "1"; } catch (e) {}
    try { root.sessionStorage.setItem(formKey, "1"); } catch (e2) {}
    var lead = 0;
    var i;
    for (i = 0; i < dots.length; i++) {
      if (!played && !reduced()) {
        dots[i].classList.add("apex-tile");
        dots[i].style.setProperty("--apex-i", String(i));
      }
      if (i === 0) dots[i].classList.add("apex-newest");
      if (lead === i && dots[i].getAttribute("data-r") === "W") lead++;
    }
    var streakN = Number(form.getAttribute("data-streak-n") || 0);
    var hot = form.getAttribute("data-streak") === "W" && streakN >= 3;
    if ((lead >= 3 || hot) && !form.querySelector(".apex-flame")) {
      var flame = doc.createElement("span");
      flame.className = "apex-flame";
      flame.setAttribute("aria-hidden", "true");
      flame.innerHTML = '<svg viewBox="0 0 16 20" width="14" height="18"><path d="M8 1c1 3-2 4-2 7 0 1 .5 2 1.2 2.4C6 8 6 6 8 5c0 3 3 4 3 7a4.5 4.5 0 1 1-9 0c0-3 2-4.5 3-7 .3 1.2.8 2 1.4 2.6C6 6 6.2 4 8 1z"/></svg>';
      form.appendChild(flame);
    }
  }

  function armForms(scope) {
    (scope || doc).querySelectorAll(".tb-form").forEach(formStrip);
  }

  function ringFor(cd) {
    var host = cd.parentElement;
    if (!host) return;
    var ring = null;
    var kids = host.children || [];
    for (var c = 0; c < kids.length; c++) {
      if (kids[c].classList && kids[c].classList.contains("apex-ring")) { ring = kids[c]; break; }
    }
    if (!ring) {
      ring = doc.createElement("span");
      ring.className = "apex-ring";
      ring.setAttribute("aria-hidden", "true");
      ring.innerHTML = '<svg viewBox="0 0 36 36"><circle class="apex-ring-track" cx="18" cy="18" r="15"></circle><circle class="apex-ring-value" cx="18" cy="18" r="15"></circle></svg>';
      host.insertBefore(ring, host.firstChild);
    }
    var value = ring.querySelector(".apex-ring-value");
    var ts = +cd.dataset.ts;
    var live = cd.dataset.live === "1";
    var diff = ts ? ts * 1000 - Date.now() : null;
    var text = cd.textContent || "";
    var ft = /\bFT\b/.test(text);
    var showLive = !ft && (live || (diff != null && diff <= 0));
    cd.classList.toggle("apex-live", showLive);
    if (!value) return;
    if (!ts || ft || showLive) {
      ring.hidden = true;
      return;
    }
    ring.hidden = false;
    var frac = Math.max(0, Math.min(1, diff / WINDOW_MS));
    value.style.strokeDasharray = String(RING);
    value.style.strokeDashoffset = String(RING * (1 - frac));
  }

  function armRings() {
    doc.querySelectorAll(".cd").forEach(ringFor);
  }

  function rowKey(row) {
    var id = row.getAttribute("data-uid") || row.getAttribute("data-tip");
    if (id) return id;
    var n = row.querySelector(".sv-nm, .tb-form-name, .dc-name");
    var t = (n ? n.textContent : "") || "";
    t = t.replace(/\s+/g, " ").trim();
    return t.slice(0, 80);
  }

  function flipLists() {
    if (!rankPrev) return;
    doc.querySelectorAll(".sv-ranks, .tb-form-list, .dc-grid, #flist").forEach(function (list) {
      var rows = list.querySelectorAll(".sv-rank, .tb-form-row, .dc-card, .frow");
      var prev = rankPrev.get(list);
      var next = {};
      var reads = [];
      rows.forEach(function (row, i) {
        var key = rowKey(row);
        if (!key) return;
        var top = 0;
        try { top = row.getBoundingClientRect().top; } catch (e) {}
        next[key] = { i: i, top: top };
        reads.push({ row: row, key: key, i: i, top: top });
      });
      if (prev && !reduced()) {
        reads.forEach(function (r) {
          var was = prev[r.key];
          if (!was || was.i === r.i) return;
          var dy = was.top - r.top;
          if (Math.abs(dy) > 1 && r.row.animate) {
            try {
              r.row.animate(
                [{ transform: "translateY(" + dy.toFixed(1) + "px)" }, { transform: "translateY(0px)" }],
                { duration: 320, easing: EASE, fill: "both" }
              );
            } catch (e) {}
          }
          var places = was.i - r.i;
          if (!places || r.row.querySelector(".apex-delta")) return;
          var chip = doc.createElement("span");
          chip.className = "apex-delta " + (places > 0 ? "apex-delta-up" : "apex-delta-down");
          chip.textContent = (places > 0 ? "+" : "\u2212") + Math.abs(places);
          r.row.appendChild(chip);
          setTimeout(function () { if (chip.parentNode) chip.parentNode.removeChild(chip); }, 900);
        });
      }
      rankPrev.set(list, next);
    });
  }

  function markSteps() {
    var box = doc.getElementById("builder");
    if (!box || box.hidden) return;
    var nodes = box.querySelectorAll(".gcard, .panel, .teamplayers");
    var active = null;
    nodes.forEach(function (el) {
      el.classList.add("apex-step");
      if (!el.hidden) active = el;
    });
    var open = box.querySelector(".teamplayers:not([hidden])") || box.querySelector(".panel");
    if (open) active = open;
    nodes.forEach(function (el) { el.classList.toggle("is-active", el === active); });
  }

  function wireScroll() {
    var top = doc.querySelector("#app > .top") || doc.querySelector("header.top");
    if (!top || top.dataset.apexScroll === "1") return;
    top.dataset.apexScroll = "1";
    function on() { top.classList.toggle("is-scrolled", (root.scrollY || 0) > 4); }
    on();
    root.addEventListener("scroll", function () {
      if (top._apexQ) return;
      top._apexQ = true;
      raf(function () { top._apexQ = false; on(); });
    }, { passive: true });
  }

  function pass() {
    if (!active() || !doc.body) return;
    if (busy) { queued = true; return; }
    busy = true;
    try {
      syncTone();
      placeGlow();
      markDisplay();
      armRise(doc);
      armCounts(doc);
      armLines(doc);
      armStamps(doc);
      armForms(doc);
      armRings();
      flipLists();
      markSteps();
      wireScroll();
    } finally {
      busy = false;
      if (queued) { queued = false; raf(pass); }
    }
  }

  function onVis() {
    if (!doc.documentElement) return;
    doc.documentElement.classList.toggle("apex-hidden", !!doc.hidden);
    if (!doc.hidden && active()) {
      syncTone();
      if (glow) glow.classList.remove("apex-paused");
      pass();
    } else if (glow) glow.classList.add("apex-paused");
  }

  function boot() {
    if (started || !doc) return;
    started = true;
    loadCss();
    syncTone();
    if (root.IntersectionObserver) {
      seenIO = new root.IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          var el = en.target;
          el.classList.add("apex-in");
          if (el.classList.contains("sv-line")) drawLine(el);
          if (el.dataset.apexCount === "1") countEl(el, el.classList.contains("apex-display") ? 640 : 320);
          seenIO.unobserve(el);
        });
      }, { threshold: 0.15 });
      glowIO = new root.IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.target && en.target.classList) en.target.classList.toggle("apex-paused", !en.isIntersecting || reduced() || doc.hidden);
        });
      }, { threshold: 0 });
    }
    var start = function () {
      if (!doc.body) return;
      doc.documentElement.classList.toggle("apex-hidden", !!doc.hidden);
      doc.addEventListener("visibilitychange", onVis);
      if (doc.body && root.MutationObserver) {
        var mo = new root.MutationObserver(function () {
          if (!queued) { queued = true; raf(function () { queued = false; pass(); }); }
        });
        mo.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-settled", "data-live", "data-ts", "hidden"] });
      }
      var themeMO = new root.MutationObserver(function () { syncTone(); if (active()) pass(); });
      themeMO.observe(doc.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-apex-light"] });
      pass();
      setInterval(function () {
        if (doc.hidden || !active()) return;
        armRings();
        syncTone();
      }, 1000);
      setTimeout(function () {
        doc.querySelectorAll(".apex-rise:not(.apex-in)").forEach(function (el) { el.classList.add("apex-in"); });
      }, 1400);
    };
    if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start);
    else start();
  }

  root.ApexTheme = { boot: boot, reduced: reduced, syncTone: syncTone };
  if (doc && doc.documentElement && doc.documentElement.dataset.theme === "apex") boot();
})(typeof window !== "undefined" ? window : globalThis);
