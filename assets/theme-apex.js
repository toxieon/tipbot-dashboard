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
    link.onload = function () { if (active()) pass(); };
    (doc.head || doc.documentElement).appendChild(link);
  }

  function syncTone() {
    if (!doc) return;
    var el = doc.documentElement;
    var auto = false;
    try { auto = root.localStorage.getItem("tipbot_theme_auto") === "true"; } catch (e) {}
    var day = false;
    try { day = !!(root.TBTime && root.TBTime.isDaytime(Date.now())); } catch (e2) {}
    var v = el.dataset.theme === "apex" ? (el.dataset.apexVariant || "") : "";
    // Only write on change: the theme observer watches data-apex-light, so a same-value write would loop.
    var wantLight = v === "light" || (el.dataset.theme === "apex" && !v && auto && day);
    if (wantLight && el.dataset.apexLight !== "1") el.dataset.apexLight = "1";
    else if (!wantLight && "apexLight" in el.dataset) delete el.dataset.apexLight;
    var meta = doc.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    if (el.dataset.apexVariant) return; // pre-paint / Settings set the variant colour
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
    el.dataset.apexFinal = raw;
    if (numText == null) {
      el.dataset.apexCounted = "1";
      el.dataset.apexLast = raw;
      el.dataset.apexSettled = "1";
      return;
    }
    el.dataset.apexCounted = "1";
    el.dataset.apexLast = raw;
    el.dataset.apexGen = String((+el.dataset.apexGen || 0) + 1);
    var gen = el.dataset.apexGen;
    if (reduced()) {
      el.textContent = raw;
      el.dataset.apexSettled = "1";
      return;
    }
    el.dataset.apexBusy = "1";
    delete el.dataset.apexSettled;
    var neg = numText.charAt(0) === "-";
    var pos = numText.charAt(0) === "+";
    var abs = parseFloat(pos || neg ? numText.slice(1) : numText);
    if (!isFinite(abs)) {
      delete el.dataset.apexBusy;
      el.dataset.apexSettled = "1";
      return;
    }
    var at = raw.indexOf(numText);
    var prefix = raw.slice(0, at);
    var suffix = raw.slice(at + numText.length);
    var decimals = (numText.split(".")[1] || "").length;
    if (!decimals && /u/.test(suffix)) decimals = 1;
    var t0 = root.performance && root.performance.now ? root.performance.now() : Date.now();
    function frame(now) {
      if (el.dataset.apexGen !== gen) return;
      var t = now == null ? Date.now() : now;
      var p = Math.min(1, (t - t0) / ms);
      var e = 1 - Math.pow(1 - p, 3);
      var v = abs * e;
      var body = decimals ? v.toFixed(decimals) : String(Math.round(v));
      if (p < 1) {
        el.textContent = prefix + (neg ? "-" : pos ? "+" : "") + body + suffix;
        raf(frame);
        return;
      }
      el.textContent = raw;
      el.dataset.apexLast = raw;
      el.dataset.apexFinal = raw;
      delete el.dataset.apexBusy;
      el.dataset.apexSettled = "1";
    }
    raf(frame);
  }
  function settledText(el) {
    if (!el) return "";
    if (el.dataset.apexBusy === "1" && el.dataset.apexFinal) return el.dataset.apexFinal;
    return (el.textContent || "").trim();
  }

  function armCounts(scope) {
    (scope || doc).querySelectorAll(".apex-display, .sv-stat .v, .sv-big b, .apex-facts b, .mini .mv, .tile .tv").forEach(function (el) {
      var now = el.textContent || "";
      if (el.dataset.apexCount === "1") {
        if (el.dataset.apexBusy === "1") return;
        if ((el.dataset.apexLast || "") === now) return;
        delete el.dataset.apexCounted;
      }
      el.dataset.apexCount = "1";
      if (reduced() || inView(el)) countEl(el, el.classList.contains("apex-display") ? 640 : 320);
      else if (seenIO) seenIO.observe(el);
      if (el.classList.contains("apex-display") && (reduced() || inView(el))) el.classList.add("apex-in");
    });
  }

  function drawLine(path) {
    if (!path || path.dataset.apexDrawn === "1") return;
    var len = 0;
    try { len = path.getTotalLength(); } catch (e) { path.dataset.apexSettled = "1"; return; }
    if (!(len > 0)) { path.dataset.apexSettled = "1"; return; }
    path.dataset.apexDrawn = "1";
    var svg = path.ownerSVGElement || path.parentNode;
    var end = svg && svg.querySelector ? svg.querySelector(".sv-end") : null;
    if (reduced()) {
      path.style.strokeDashoffset = "0";
      path.dataset.apexSettled = "1";
      return;
    }
    path.style.strokeDasharray = String(len);
    path.style.strokeDashoffset = String(len);
    try {
      var anim = path.animate(
        [{ strokeDashoffset: len }, { strokeDashoffset: 0 }],
        { duration: 640, easing: EASE, fill: "both" }
      );
      anim.onfinish = function () {
        path.style.strokeDashoffset = "0";
        path.dataset.apexSettled = "1";
      };
      setTimeout(function () {
        path.style.strokeDashoffset = "0";
        path.dataset.apexSettled = "1";
      }, 700);
    } catch (e2) {
      path.style.strokeDashoffset = "0";
      path.dataset.apexSettled = "1";
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
      var profitTile = Array.prototype.slice.call(doc.querySelectorAll(".tile")).filter(function(t) {
        var tl = t.querySelector(".tl");
        return tl && tl.textContent.indexOf("Profit") !== -1;
      })[0];
      if (profitTile) {
        var tv = profitTile.querySelector(".tv");
        if (tv) {
          tv.classList.add("apex-pulse-win");
          setTimeout(function() { tv.classList.remove("apex-pulse-win"); }, 1200);
        }
      }
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
    var isW = form.getAttribute("data-streak") === "W";
    var n = Number(form.getAttribute("data-streak-n")) || 0;
    if (!dots.length && !(isW && n >= 3)) return;
    form.dataset.apexForm = "1";
    var formKey = "apex-form:" + (form.getAttribute("aria-label") || "");
    var played = false;
    try { played = root.sessionStorage.getItem(formKey) === "1"; } catch (e) {}
    try { root.sessionStorage.setItem(formKey, "1"); } catch (e2) {}
    var i;
    for (i = 0; i < dots.length; i++) {
      if (!played && !reduced()) {
        dots[i].classList.add("apex-tile");
        dots[i].style.setProperty("--apex-i", String(i));
      }
      if (i === 0) dots[i].classList.add("apex-newest");
    }
    if (isW && n >= 3) {
      var tag = form.querySelector(".tb-form-streak, .tb-form-hot");
      if (tag) {
        tag.innerHTML = '<span class="apex-flame-icon">🔥</span> ' + n + 'W';
        tag.classList.add("apex-flame-chip");
      }
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

  var pending = "";
  var pendingFired = false;
  var picked = "";
  var shellReady = false;
  var NAV = [
    { id: "home", label: "Home", d: "M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" },
    { id: "servers", label: "Servers", d: "M4 6h16v4H4zm0 6h16v6H4z" },
    { id: "upcoming", label: "Upcoming", d: "M7 3v2M17 3v2M4 8h16M5 5h14a1 1 0 0 1 1 1v13H4V6a1 1 0 0 1 1-1z" },
    { id: "live", label: "Live", d: "M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0-4v2m0 14v2M3 12H1m22 0h-2" },
    { id: "build", label: "Build", d: "M12 5v14M5 12h14" },
    { id: "settings", label: "Settings", d: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm8 4-2.1-.6a6 6 0 0 0-.5-1.2l1.2-1.8-1.4-1.4-1.8 1.2a6 6 0 0 0-1.2-.5L12 4l-.6 2.1a6 6 0 0 0-1.2.5L8.4 5.4 7 6.8l1.2 1.8a6 6 0 0 0-.5 1.2L4 12l2.1.6a6 6 0 0 0 .5 1.2L5.4 15.6 6.8 17l1.8-1.2a6 6 0 0 0 1.2.5L12 20l.6-2.1a6 6 0 0 0 1.2-.5l1.8 1.2 1.4-1.4-1.2-1.8a6 6 0 0 0 .5-1.2z" }
  ];
  var TABS = ["home", "build", "upcoming"];

  function icon(d) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + d + '"></path></svg>';
  }
  function numOf(text) {
    var m = String(text == null ? "" : text).replace(/,/g, "").match(/[+-]?\d+(?:\.\d+)?/);
    if (!m) return null;
    var n = parseFloat(m[0]);
    return isFinite(n) ? n : null;
  }
  function fmtUnits(n) {
    if (n == null || !isFinite(n)) return "\u2014";
    var r = Math.round(n * 10) / 10;
    var body = Math.abs(r).toFixed(1);
    if (r > 0) return "+" + body + "u";
    if (r < 0) return "-" + body + "u";
    return "0.0u";
  }
  function exactUnits(text) {
    var raw = String(text == null ? "" : text).trim();
    if (!raw || raw === "\u2014" || /updating/i.test(raw)) return raw || "\u2014";
    var n = numOf(raw);
    if (n == null) return raw;
    return fmtUnits(n);
  }
  function initials(name) {
    var parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }
  function onDash() { return !!(doc.getElementById("app")); }
  function livePath() {
    var path = "";
    try { path = root.location.pathname || ""; } catch (e) {}
    return /\/live\//.test(path);
  }
  function dashHref() {
    var a = doc.querySelector("a.topnav-dash");
    if (a && a.getAttribute("href")) return a.getAttribute("href");
    return livePath() ? "../" : "./";
  }
  function liveHref() {
    var a = doc.querySelector("a.topnav-live, a.live-open-btn");
    if (a && a.getAttribute("href")) return a.getAttribute("href");
    return livePath() ? "./" : "./live/";
  }
  function withTransition(fn) {
    namePages();
    if (reduced() || !doc.startViewTransition || doc.hidden) { fn(); return; }
    try { doc.startViewTransition(function () { fn(); }); }
    catch (e) { fn(); }
  }
  function namePages() {
    var ids = ["overview", "detail", "builder", "upcoming", "followers", "follower", "mytips", "discover", "settings"];
    var i, el, named = false;
    for (i = 0; i < ids.length; i++) {
      el = doc.getElementById(ids[i]);
      if (!el || !el.style) continue;
      if (!el.hidden && !named) { el.style.viewTransitionName = "apex-page"; named = true; }
      else el.style.viewTransitionName = "";
    }
    if (!doc.getElementById("app")) {
      var wrap = doc.querySelector(".wrap");
      if (wrap && wrap.style) wrap.style.viewTransitionName = "apex-page";
    }
  }
  function clickSel(sel) {
    var el = doc.querySelector(sel);
    if (el && el.click) { el.click(); return true; }
    return false;
  }
  function openPanel(el) {
    if (!el) return;
    el.hidden = false;
    var body = el.querySelector(".panel-body");
    if (body) body.hidden = false;
    if (root.TDSec && root.TDSec.open) { try { root.TDSec.open(el); } catch (e) {} }
    try {
      var bar = doc.querySelector("#app > .top, header.top");
      var h = 80;
      if (bar && bar.getBoundingClientRect) h = Math.ceil(bar.getBoundingClientRect().height) + 16;
      var y = el.getBoundingClientRect().top + (root.pageYOffset || root.scrollY || 0) - h;
      root.scrollTo(0, Math.max(0, y));
    } catch (e2) {}
  }
  function go(id) {
    picked = id;
    paintNav();
    if (!onDash()) {
      if (id === "live") { if (!livePath()) root.location.href = liveHref(); return; }
      try { root.sessionStorage.setItem("apex-go", id); } catch (e) {}
      root.location.href = dashHref();
      return;
    }
    if (id === "live") { root.location.href = liveHref(); return; }
    withTransition(function () {
      if (id === "home") clickSel("#homelogo") || clickSel("#nav-dash");
      else if (id === "servers") {
        var back = doc.getElementById("backbtn");
        if (back) back.click();
        else clickSel("#homelogo") || clickSel("#nav-dash");
        pending = "servers";
        pendingFired = false;
      } else if (id === "upcoming") {
        var visUpc = doc.getElementById("upcoming");
        if (visUpc && !visUpc.hidden) return;
        var u = doc.getElementById("upcomingbtn");
        var detail = doc.getElementById("detail");
        if (u && detail && !detail.hidden) u.click();
        else if (typeof root.TBOpenUpcoming === "function") { try { root.TBOpenUpcoming(); } catch (e3) {} }
        else { pending = "upcoming"; pendingFired = false; }
      } else if (id === "build") {
        var b = doc.getElementById("buildbtn");
        if (b) b.click();
        else { pending = "build"; pendingFired = false; }
      } else if (id === "settings") clickSel("#gear");
    });
  }
  function flushPending() {
    if (!pending || !onDash()) return;
    if (pending === "servers") {
      var grid = doc.querySelector("#overview .grid");
      var ov = doc.getElementById("overview");
      if (grid && ov && !ov.hidden) {
        pending = "";
        if (!grid.id) grid.id = "apex-servers";
        try { grid.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" }); } catch (e) {}
        return;
      }
      if (!pendingFired) {
        var back = doc.getElementById("backbtn");
        if (back) { pendingFired = true; back.click(); }
      }
      return;
    }
    if (pending === "upcoming") {
      var u = doc.getElementById("upcomingbtn");
      if (u) { pending = ""; u.click(); picked = "upcoming"; return; }
      if (!pendingFired) {
        var card = doc.querySelector("#overview:not([hidden]) .scard");
        if (card) { pendingFired = true; card.click(); }
      }
      return;
    }
    if (pending === "build") {
      var btn = doc.getElementById("buildbtn");
      if (btn) { pending = ""; btn.click(); return; }
      if (!pendingFired) {
        var card2 = doc.querySelector("#overview:not([hidden]) .scard");
        if (card2) { pendingFired = true; card2.click(); }
      }
    }
  }
  function readGo() {
    var go = "";
    try { go = root.sessionStorage.getItem("apex-go") || ""; root.sessionStorage.removeItem("apex-go"); } catch (e) {}
    if (!go || !onDash()) return;
    pending = go === "home" || go === "live" || go === "settings" ? "" : go;
    pendingFired = false;
    picked = go;
    if (go === "settings") clickSel("#gear");
  }
  function sectionNow() {
    if (livePath() && !onDash()) return "live";
    var builder = doc.getElementById("builder");
    if (builder && !builder.hidden) return "build";
    var upc = doc.getElementById("upcoming");
    if (upc && !upc.hidden) return "upcoming";
    var dd = doc.getElementById("dropdown");
    if (dd && !dd.hidden && picked === "settings") return "settings";
    if (picked === "servers" || picked === "home" || picked === "settings") return picked === "settings" ? "home" : picked;
    var ov = doc.getElementById("overview");
    if (ov && !ov.hidden) return "home";
    var stats = doc.getElementById("stats");
    if (stats && !stats.hidden) return "home";
    return picked || "home";
  }
  function buttonRow(items, extra) {
    return items.map(function (item) {
      var cls = "apex-navbtn" + (item.id === "build" ? " apex-tab-build" : "") + (extra || "");
      return '<button type="button" class="' + cls + '" data-apex-nav="' + item.id + '" aria-label="' + item.label + '">' + icon(item.d) + "<span>" + item.label + "</span></button>";
    }).join("");
  }
  function mountShell() {
    if (!active() || !doc.body || shellReady) return;
    var host = doc.getElementById("app") || doc.body;
    if (host.querySelector(".apex-rail")) { shellReady = true; return; }
    var rail = doc.createElement("nav");
    rail.className = "apex-rail";
    rail.setAttribute("aria-label", "Sections");
    rail.innerHTML = '<i class="apex-indicator" aria-hidden="true"></i>' + buttonRow(NAV, "");
    var tabs = doc.createElement("nav");
    tabs.className = "apex-tabs";
    tabs.setAttribute("aria-label", "Sections");
    // 0.53.3: phone tabs follow TABS order (Home | Build | Upcoming), not NAV order.
    var tabItems = TABS.map(function (id) { return NAV.filter(function (item) { return item.id === id; })[0]; }).filter(Boolean);
    tabs.innerHTML = '<i class="apex-indicator" aria-hidden="true"></i>' + buttonRow(tabItems, "");
    host.insertBefore(rail, host.firstChild);
    host.appendChild(tabs);
    host.addEventListener("click", function (ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest("[data-apex-nav]") : null;
      if (!btn || !host.contains(btn)) return;
      ev.preventDefault();
      go(btn.getAttribute("data-apex-nav"));
    });
    shellReady = true;
    readGo();
  }
  function moveIndicator(nav) {
    if (!nav) return;
    var ind = nav.querySelector(".apex-indicator");
    var current = nav.querySelector('[aria-current="page"]');
    if (!ind || !current) return;
    var r = current.getBoundingClientRect();
    var nr = nav.getBoundingClientRect();
    ind.style.width = r.width + "px";
    ind.style.height = r.height + "px";
    ind.style.transform = "translate3d(" + (r.left - nr.left) + "px," + (r.top - nr.top) + "px,0)";
  }
  function paintNav() {
    var id = sectionNow();
    doc.querySelectorAll("[data-apex-nav]").forEach(function (btn) {
      var on = btn.getAttribute("data-apex-nav") === id;
      if (on) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
    });
    moveIndicator(doc.querySelector(".apex-rail"));
    moveIndicator(doc.querySelector(".apex-tabs"));
  }
  function sparkD(values, w, h) {
    if (!values.length) return "";
    var min = Math.min.apply(null, values.concat([0]));
    var max = Math.max.apply(null, values.concat([0]));
    var span = (max - min) || 1;
    var pad = 4;
    return values.map(function (v, i) {
      var x = values.length === 1 ? w / 2 : (i / (values.length - 1)) * (w - 8) + 4;
      var y = pad + (1 - (v - min) / span) * (h - pad * 2);
      return (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
    }).join(" ");
  }
  function cumulative(values) {
    var running = [0];
    var acc = 0;
    (values || []).forEach(function (p) {
      acc = Math.round((acc + p) * 10) / 10;
      running.push(acc);
    });
    return running;
  }
  function svgLine(cls, values, w, h) {
    var svg = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", cls);
    svg.setAttribute("viewBox", "0 0 " + w + " " + h);
    svg.setAttribute("aria-hidden", "true");
    var path = doc.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("class", "sv-line");
    path.setAttribute("fill", "none");
    path.setAttribute("d", sparkD(values, w, h));
    svg.appendChild(path);
    return svg;
  }
  function cardStats(card) {
    var out = { queued: null, profit: null, won: null, lost: null };
    card.querySelectorAll(".m").forEach(function (m) {
      var lab = ((m.querySelector(".ml") || {}).textContent || "").toLowerCase();
      var raw = (m.querySelector(".mv") || {}).textContent || "";
      if (lab.indexOf("queue") !== -1) out.queued = numOf(raw);
      else if (lab.indexOf("profit") !== -1) out.profit = numOf(raw);
      else if (lab.indexOf("w") !== -1) {
        var bits = raw.match(/\d+/g) || [];
        out.won = bits.length ? +bits[0] : null;
        out.lost = bits.length > 1 ? +bits[1] : null;
      }
    });
    return out;
  }
  function setFigure(el, text) {
    if (!el) return;
    if (el.dataset.apexShow === text) return;
    el.dataset.apexShow = text;
    el.textContent = text;
    delete el.dataset.apexCounted;
    delete el.dataset.apexCount;
    delete el.dataset.apexLast;
    delete el.dataset.apexFinal;
    delete el.dataset.apexSettled;
    delete el.dataset.apexBusy;
  }
  function asMs(ts) {
    var n = +ts;
    if (!n) return 0;
    return n > 1e12 ? n : n * 1000;
  }
  function leadText(ms) {
    if (!(ms > 0)) return null;
    var s = Math.max(0, Math.round(ms / 1000));
    var d = Math.floor(s / 86400);
    var h = Math.floor((s % 86400) / 3600);
    var m = Math.floor((s % 3600) / 60);
    if (d) return d + "d " + h + "h";
    if (h) return h + "h " + m + "m";
    if (m) return m + "m";
    return "<1m";
  }
  var nextFetch = {};
  function considerStart(best, ts, skip) {
    if (skip) return best;
    var ms = asMs(ts) - Date.now();
    if (!(ms > 0)) return best;
    if (best == null || ms < best) return ms;
    return best;
  }
  function nextStart() {
    var best = null;
    if (doc) {
      doc.querySelectorAll("[data-ts]").forEach(function (cd) {
        best = considerStart(best, cd.dataset.ts, false);
      });
    }
    try {
      var all = JSON.parse(root.localStorage.getItem("tipdash_upctx_v1") || "{}") || {};
      Object.keys(all).forEach(function (gid) {
        var starts = (all[gid] && all[gid].starts) || {};
        Object.keys(starts).forEach(function (name) {
          var g = starts[name] || {};
          var done = !!(g.finished || g.concluded || Number(g.complete) >= 100);
          best = considerStart(best, g.ts, done);
        });
      });
    } catch (e) {}
    Object.keys(nextFetch).forEach(function (gid) {
      var v = nextFetch[gid];
      if (typeof v === "number") best = considerStart(best, v, false);
    });
    return leadText(best);
  }
  function tickNext() {
    if (!doc) return;
    var ov = doc.getElementById("overview");
    if (!ov || ov.hidden) return;
    var nEl = doc.querySelector('.apex-facts [data-fact="next"]');
    paintNext(nEl);
  }
  function paintNext(nEl) {
    if (!nEl) return;
    var label = nextStart();
    var text = label || "No games";
    if (nEl.textContent !== text) nEl.textContent = text;
    nEl.classList.toggle("apex-muted", !label);
    if (!label) requestUpcoming();
  }
  function requestUpcoming() {
    if (!doc || typeof root.api !== "function") return;
    var nodes = doc.querySelectorAll("#overview .sgid");
    nodes.forEach(function (el) {
      var gid = String(el.textContent || "").trim();
      if (!/^\d{8,}$/.test(gid) || nextFetch[gid]) return;
      nextFetch[gid] = "pending";
      var finish = function (ts) {
        nextFetch[gid] = ts || "empty";
        if (active()) tickNext();
      };
      try {
        Promise.resolve(root.api("/api/upcoming?guild_id=" + encodeURIComponent(gid), { timeoutMs: 8000, retries: 1 })).then(function (r) {
          if (!r || !r.ok || typeof r.json !== "function") return null;
          return r.json();
        }).then(function (data) {
          var best = null;
          var games = data && data.games;
          if (!Array.isArray(games)) { finish(null); return; }
          games.forEach(function (g) {
            if (!g || g.finished || g.concluded || Number(g.complete) >= 100) return;
            var ts = +g.unixtime || +g.ts || 0;
            if (!ts) return;
            if (asMs(ts) <= Date.now()) return;
            if (best == null || asMs(ts) < asMs(best)) best = ts;
          });
          finish(best);
        }).catch(function () { finish(null); });
      } catch (e2) { finish(null); }
    });
  }
  function armHome() {
    var ov = doc.getElementById("overview");
    if (!ov || ov.hidden) return;
    var cards = ov.querySelectorAll(".scard");
    if (!cards.length) {
      var old = ov.querySelector(".apex-hero");
      if (old && old.parentNode) old.parentNode.removeChild(old);
      return;
    }
    var profits = [];
    var queuedN = 0;
    var queuedKnown = false;
    var won = 0;
    var lost = 0;
    cards.forEach(function (card, i) {
      var st = cardStats(card);
      if (st.profit != null) profits.push(st.profit);
      if (st.queued != null) { queuedN += st.queued; queuedKnown = true; }
      if (st.won != null) won += st.won;
      if (st.lost != null) lost += st.lost;
      if (!card.querySelector(".apex-mini") && st.profit != null) {
        card.appendChild(svgLine("apex-mini", [0, st.profit], 120, 36));
      }
      if (!card.querySelector(".apex-record") && st.won != null && st.lost != null && (st.won + st.lost) > 0) {
        var rec = doc.createElement("div");
        rec.className = "apex-record";
        rec.setAttribute("aria-hidden", "true");
        var total = st.won + st.lost;
        rec.innerHTML = '<i class="apex-w" style="width:' + (st.won / total * 100).toFixed(1) + '%"></i><i class="apex-l" style="width:' + (st.lost / total * 100).toFixed(1) + '%"></i>';
        card.appendChild(rec);
      }
      card.style.setProperty("--apex-i", String(i));
      var grid = card.parentNode;
      if (grid && grid.classList && grid.classList.contains("grid") && !grid.id) grid.id = "apex-servers";
    });
    var sum = Math.round(profits.reduce(function (a, b) { return a + b; }, 0) * 10) / 10;
    var hero = ov.querySelector(".apex-hero");
    if (!hero) {
      hero = doc.createElement("section");
      hero.className = "apex-hero";
      hero.setAttribute("aria-label", "Overview");
      hero.innerHTML = '<p class="apex-kicker">Total profit</p><p class="apex-hero-num apex-display"></p><div class="apex-spark-slot"></div><div class="apex-facts"><div><b data-fact="queued"></b><span>Bets queued</span></div><div><b data-fact="live"></b><span>Live now</span></div><div><b data-fact="next"></b><span>Next start</span></div></div>';
      var glowEl = ov.querySelector(".apex-glow");
      if (glowEl && glowEl.nextSibling) ov.insertBefore(hero, glowEl.nextSibling);
      else ov.insertBefore(hero, ov.firstChild);
    }
    var num = hero.querySelector(".apex-hero-num");
    var text = profits.length ? fmtUnits(sum) : "\u2014";
    if (num) {
      num.classList.toggle("pos", sum > 0);
      num.classList.toggle("neg", sum < 0);
    }
    setFigure(num, text);
    var slot = hero.querySelector(".apex-spark-slot");
    var running = profits.length ? [0, sum] : [];
    if (slot && running.length && slot.dataset.apexSpark !== running.join(",")) {
      slot.dataset.apexSpark = running.join(",");
      slot.textContent = "";
      var spark = svgLine("apex-spark", running.length === 1 ? [running[0], running[0]] : running, 280, 72);
      spark.setAttribute("role", "img");
      spark.setAttribute("aria-label", "Units by server");
      spark.removeAttribute("aria-hidden");
      slot.appendChild(spark);
    }
    var liveN = doc.querySelectorAll(".cd.apex-live, .cd[data-live='1']").length;
    var qEl = hero.querySelector('[data-fact="queued"]');
    var lEl = hero.querySelector('[data-fact="live"]');
    var nEl = hero.querySelector('[data-fact="next"]');
    if (qEl) qEl.textContent = queuedKnown ? String(queuedN) : "\u2014";
    if (lEl) lEl.textContent = String(liveN);
    paintNext(nEl);
    if (won || lost) hero.dataset.apexRecord = won + "-" + lost;
  }
  function armServerHero() {
    var detail = doc.getElementById("detail");
    if (!detail || detail.hidden) return;
    var units = detail.querySelector('[data-sv="units"]') || detail.querySelector(".sv-big b");
    var roi = detail.querySelector('[data-sv="roi"]');
    var head = detail.querySelector(".dhead");
    if (!units || !head) return;
    var hero = head.querySelector(".apex-server-hero");
    if (!hero) {
      hero = doc.createElement("div");
      hero.className = "apex-server-hero";
      hero.innerHTML = '<p class="apex-kicker">Units</p><p class="apex-hero-num apex-display"></p><p class="apex-hero-roi"></p>';
      head.appendChild(hero);
    }
    var num = hero.querySelector(".apex-hero-num");
    var raw = exactUnits(settledText(units));
    if (num) {
      num.classList.toggle("pos", units.classList.contains("pos") || raw.charAt(0) === "+");
      num.classList.toggle("neg", units.classList.contains("neg") || raw.charAt(0) === "-" || raw.charAt(0) === "\u2212");
    }
    setFigure(num, raw);
    var roiEl = hero.querySelector(".apex-hero-roi");
    if (roiEl) roiEl.textContent = roi ? ("ROI " + (roi.textContent || "").trim()) : "";
  }
  function placePill(sel) {
    if (!sel) return;
    var host = sel.previousElementSibling;
    if (!host || !host.classList || !host.classList.contains("apex-seg")) return;
    var pill = host.querySelector(".apex-seg-pill");
    var buttons = host.querySelectorAll(".apex-seg-btn");
    var current = null;
    var i;
    for (i = 0; i < buttons.length; i++) {
      var on = buttons[i].dataset.value === sel.value;
      buttons[i].setAttribute("aria-pressed", on ? "true" : "false");
      if (on) current = buttons[i];
    }
    if (!pill || !current) return;
    pill.style.width = current.offsetWidth + "px";
    pill.style.height = current.offsetHeight + "px";
    pill.style.transform = "translate3d(" + current.offsetLeft + "px," + current.offsetTop + "px,0)";
  }
  function armPeriod() {
    var sel = doc.getElementById("monthsel");
    if (!sel || !sel.options || typeof sel.options.length !== "number") return;
    if (sel.dataset.apexSeg === "1") { placePill(sel); return; }
    sel.dataset.apexSeg = "1";
    sel.classList.add("apex-native-period");
    var seg = doc.createElement("div");
    seg.className = "apex-seg";
    seg.setAttribute("role", "tablist");
    seg.setAttribute("aria-label", "Timeframe");
    var pill = doc.createElement("i");
    pill.className = "apex-seg-pill";
    pill.setAttribute("aria-hidden", "true");
    seg.appendChild(pill);
    var i;
    for (i = 0; i < sel.options.length; i++) {
      (function (opt) {
        var b = doc.createElement("button");
        b.type = "button";
        b.className = "apex-seg-btn";
        b.textContent = opt.textContent;
        b.dataset.value = opt.value;
        b.setAttribute("role", "tab");
        b.setAttribute("aria-pressed", opt.selected ? "true" : "false");
        b.addEventListener("click", function () {
          if (sel.value === b.dataset.value) return;
          sel.value = b.dataset.value;
          var ev;
          try { ev = new root.Event("change", { bubbles: true }); }
          catch (e) { ev = doc.createEvent("Event"); ev.initEvent("change", true, true); }
          sel.dispatchEvent(ev);
        });
        seg.appendChild(b);
      })(sel.options[i]);
    }
    sel.parentNode.insertBefore(seg, sel);
    raf(function () { placePill(sel); });
  }
  function dayLabel(group) {
    var cd = group.querySelector(".cd");
    var ts = cd ? +cd.dataset.ts : 0;
    if (!ts) return "Scheduled";
    try {
      return new Date(ts * 1000).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
    } catch (e) { return "Scheduled"; }
  }
  function armDays(box) {
    if (!box) return;
    var groups = Array.prototype.slice.call(box.querySelectorAll(":scope > .game-group"));
    var last = "";
    groups.forEach(function (g) {
      var label = dayLabel(g);
      var prev = g.previousElementSibling;
      if (prev && prev.classList && prev.classList.contains("apex-day")) {
        if (label === last) { if (prev.parentNode) prev.parentNode.removeChild(prev); return; }
        prev.textContent = label;
        last = label;
        return;
      }
      if (label === last) return;
      var h = doc.createElement("div");
      h.className = "apex-day";
      h.textContent = label;
      g.parentNode.insertBefore(h, g);
      last = label;
    });
  }
  function armLockups(scope) {
    (scope || doc).querySelectorAll(".game-group").forEach(function (g) {
      if (g.querySelector(".apex-lockup")) return;
      var title = g.querySelector(".gtitle");
      if (!title) return;
      var parts = (title.textContent || "").trim().split(/\s+(?:vs\.?|v|@)\s+/i);
      if (parts.length < 2) return;
      var row = doc.createElement("div");
      row.className = "apex-lockup";
      row.setAttribute("aria-hidden", "true");
      var a = doc.createElement("span");
      a.className = "apex-logo";
      a.textContent = initials(parts[0]);
      var mid = doc.createElement("span");
      mid.className = "apex-vs";
      mid.textContent = "v";
      var b = doc.createElement("span");
      b.className = "apex-logo";
      b.textContent = initials(parts[1]);
      row.appendChild(a);
      row.appendChild(mid);
      row.appendChild(b);
      title.parentNode.insertBefore(row, title);
    });
  }
  function builderStep(box) {
    var h1 = box.querySelector("h1");
    var title = h1 ? (h1.textContent || "") : "";
    if (/confirm|schedule batch/i.test(title)) return 3;
    if (box.querySelector("#players, .linectl, #c_leg")) return 2;
    if (box.querySelector(".gcard")) return box.dataset.apexSport === "1" ? 1 : 0;
    if (box.querySelector(".compchip")) return 0;
    return 0;
  }
  function armBuilder() {
    var box = doc.getElementById("builder");
    if (!box) return;
    if (box.hidden) { delete box.dataset.apexSport; return; }
    var step = builderStep(box);
    if (box.dataset.apexStep !== String(step)) box.dataset.apexStep = String(step);
    var sport = box.querySelector(".espnsport, .sportstub");
    if (sport && sport.parentElement) sport.parentElement.classList.add("apex-sports");
    var flow = box.querySelector(":scope > .apex-flow");
    if (!flow) {
      flow = doc.createElement("ol");
      flow.className = "apex-flow";
      ["Sport", "Game", "Market", "Confirm"].forEach(function (label, i) {
        var li = doc.createElement("li");
        li.dataset.step = String(i);
        li.textContent = label;
        flow.appendChild(li);
      });
      var bar = doc.createElement("i");
      bar.className = "apex-flow-bar";
      bar.setAttribute("aria-hidden", "true");
      flow.appendChild(bar);
      box.insertBefore(flow, box.firstChild);
    }
    var items = flow.querySelectorAll("li");
    var i;
    for (i = 0; i < items.length; i++) {
      items[i].classList.toggle("is-on", i === step);
      items[i].classList.toggle("is-done", i < step);
    }
    var barEl = flow.querySelector(".apex-flow-bar");
    if (barEl) barEl.style.transform = "scaleX(" + ((step + 1) / 4) + ")";
    var note = box.querySelector(":scope > .apex-step-note");
    if (step === 0 && box.querySelector(".apex-sports")) {
      if (!note) {
        note = doc.createElement("p");
        note.className = "apex-step-note";
        note.textContent = "Pick a sport";
        var sports = box.querySelector(".apex-sports");
        if (sports && sports.parentNode) sports.parentNode.insertBefore(note, sports);
      }
    } else if (note && note.parentNode) note.parentNode.removeChild(note);
  }

  function armEmptyStates(scope) {
    (scope || doc).querySelectorAll(".empty").forEach(function (el) {
      if (el.dataset.apexEmpty) return;
      var text = el.textContent || "";
      var svg = "";
      if (text.indexOf("Nothing here yet") !== -1) {
        svg = `<svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto 16px"><rect x="20" y="30" width="80" height="60" rx="12" fill="var(--card2)" stroke="var(--line)" stroke-width="2"/><circle cx="60" cy="60" r="16" fill="var(--bg)" stroke="var(--line)" stroke-width="2" stroke-dasharray="4 4"/><path d="M60 52v16M52 60h16" stroke="var(--accent)" stroke-width="2" stroke-linecap="round"/></svg>`;
      } else if (text.indexOf("No upcoming bets") !== -1) {
        svg = `<svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto 16px"><rect x="24" y="28" width="72" height="64" rx="10" fill="var(--card2)" stroke="var(--line)" stroke-width="2"/><path d="M36 20v16M84 20v16M24 48h72" stroke="var(--line)" stroke-width="2" stroke-linecap="round"/><rect x="40" y="60" width="16" height="16" rx="4" fill="var(--accent)" opacity="0.2"/><rect x="64" y="60" width="16" height="16" rx="4" fill="var(--line)" opacity="0.5"/></svg>`;
      } else if (text.indexOf("No settled tips yet") !== -1 || text.indexOf("No results yet") !== -1 || text.indexOf("No finished games") !== -1) {
        svg = `<svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto 16px"><path d="M20 90h80" stroke="var(--line)" stroke-width="2" stroke-linecap="round"/><path d="M30 80l20-30 15 10 25-35" stroke="var(--accent)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="90" cy="25" r="5" fill="var(--accent)"/><rect x="25" y="50" width="10" height="30" rx="2" fill="var(--line)" opacity="0.3"/><rect x="45" y="30" width="10" height="50" rx="2" fill="var(--line)" opacity="0.3"/><rect x="65" y="40" width="10" height="40" rx="2" fill="var(--line)" opacity="0.3"/></svg>`;
      }
      if (svg) {
        el.dataset.apexEmpty = "1";
        el.innerHTML = svg + "<div style=\"color:var(--muted)\">" + el.innerHTML + "</div>";
        el.style.textAlign = "center";
        el.style.padding = "32px 16px";
      }
    });
  }

  function pass() {
    if (!active() || !doc.body) return;
    if (busy) { queued = true; return; }
    busy = true;
    try {
      syncTone();
      mountShell();
      namePages();
      armHome();
      armServerHero();
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
      armPeriod();
      armEmptyStates(doc);
      armDays(doc.getElementById("upcoming-box"));
      armDays(doc.getElementById("live-tips-box"));
      armDays(doc.getElementById("finished-box"));
      armLockups(doc);
      armBuilder();
      paintNav();
      flushPending();
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
      doc.addEventListener("click", function (ev) {
        if (!active()) return;
        var t = ev.target && ev.target.closest ? ev.target.closest("#builder .compchip, #builder .gcard") : null;
        if (!t) return;
        var box = doc.getElementById("builder");
        if (box) {
          box.dataset.apexSport = "1";
          if (!queued) { queued = true; raf(function () { queued = false; pass(); }); }
        }
      }, true);
      root.addEventListener("resize", function () {
        if (!active()) return;
        paintNav();
        placePill(doc.getElementById("monthsel"));
      });
      if (doc.body && root.MutationObserver) {
        var mo = new root.MutationObserver(function () {
          if (!queued) { queued = true; raf(function () { queued = false; pass(); }); }
        });
        mo.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-settled", "data-live", "data-ts", "hidden"] });
      }
      var themeMO = new root.MutationObserver(function () { syncTone(); if (active()) pass(); });
      themeMO.observe(doc.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-apex-light", "data-apex-variant"] });
      pass();
      setInterval(function () {
        if (doc.hidden || !active()) return;
        armRings();
        syncTone();
        tickNext();
      }, 1000);
      setTimeout(function () {
        doc.querySelectorAll(".apex-rise:not(.apex-in)").forEach(function (el) { el.classList.add("apex-in"); });
      }, 1400);
    };
    if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start);
    else start();
  }

  root.ApexTheme = {
    boot: boot,
    reduced: reduced,
    syncTone: syncTone,
    fmtUnits: fmtUnits,
    sparkD: sparkD,
    cumulative: cumulative,
    leadText: leadText,
    countEl: countEl,
    settledText: settledText,
    formStrip: formStrip,
    stamp: stamp,
    armEmptyStates: armEmptyStates
  };
  if (doc && doc.documentElement && doc.documentElement.dataset.theme === "apex") boot();
})(typeof window !== "undefined" ? window : globalThis);
