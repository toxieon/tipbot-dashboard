/* tb-motion.js — TipDash motion + interaction helpers (Apple-design pass, 0.43.1+).
 *
 * Loaded eagerly from index.html (and master/index.html). No dependencies, no build step.
 * Everything is feature-detected so it is safe in the test VM's fake DOM.
 *
 *   TBMotion.reduced()      true when the user asked for reduced motion
 *   TBMotion.bump(el)       quick 1 → 1.08 → 1 "something landed here" pulse
 *   TBMotion.tick()         10 ms haptic tick (Android Chrome; iOS Safari has no Vibration API)
 *   TBMotion.spring(opts)   interruptible, velocity-aware spring (Apple damping/response params)
 *
 *   TBSheet.open(opts)      bottom sheet (phones) / centered card (desktop); drag-to-dismiss
 *   TBSheet.confirm(opts)   action sheet → Promise<boolean>; `hold:true` = hold-to-confirm
 *   TBSheet.top() / TBSheet.closeTop()   used by the Back-button router (0.43.1)
 *
 * Also: tapping anywhere on a `.switch` row flips its `.toggle` (bigger hit target).
 */
(function () {
  "use strict";
  var w = typeof window !== "undefined" ? window : this;
  var doc = w.document;

  function mq(q) {
    try { return !!(w.matchMedia && w.matchMedia(q).matches); } catch (e) { return false; }
  }
  function reduced() { return mq("(prefers-reduced-motion: reduce)"); }
  var raf = (w.requestAnimationFrame && w.requestAnimationFrame.bind(w)) || function (f) { return setTimeout(function () { f(Date.now()); }, 16); };
  var caf = (w.cancelAnimationFrame && w.cancelAnimationFrame.bind(w)) || clearTimeout;
  function now() { return (w.performance && w.performance.now) ? w.performance.now() : Date.now(); }

  function bump(el) {
    if (!el || !el.classList) return;
    el.classList.remove("tb-bump");
    try { void el.offsetWidth; } catch (e) {}
    el.classList.add("tb-bump");
    var done = function () { el.classList.remove("tb-bump"); };
    if (el.addEventListener) el.addEventListener("animationend", done, { once: true });
    setTimeout(done, 600);
  }

  function tick() {
    try {
      var n = w.navigator;
      if (n && typeof n.vibrate === "function") n.vibrate(10);
    } catch (e) {}
  }

  /* ── Spring ──────────────────────────────────────────────────────────────────
     Apple's designer-facing parameters: dampingRatio (1 = no overshoot) and response
     (seconds, ~ how quickly it gets there). Mass 1: k = (2π/response)², c = 4π·ζ/response.
     The spring always starts from the *current* value and velocity, so re-targeting
     mid-flight is seamless (no "brick wall" at a reversal). */
  function spring(o) {
    var st = { value: o.from, velocity: o.velocity || 0, target: o.to, id: 0, done: false };
    var k, c;
    function params(damping, response) {
      var r = Math.max(0.05, response || 0.35);
      k = Math.pow(2 * Math.PI / r, 2);
      c = 4 * Math.PI * (damping == null ? 1 : damping) / r;
    }
    params(o.damping, o.response);
    var last = now();
    function step() {
      var t = now(), dt = Math.min(0.064, (t - last) / 1000); last = t;
      var n = Math.max(1, Math.ceil(dt / 0.004)), h = dt / n;
      for (var i = 0; i < n; i++) {
        var a = -k * (st.value - st.target) - c * st.velocity;
        st.velocity += a * h; st.value += st.velocity * h;
      }
      o.onUpdate && o.onUpdate(st.value, st.velocity);
      if (Math.abs(st.value - st.target) < 0.4 && Math.abs(st.velocity) < 8) {
        st.value = st.target; st.velocity = 0; st.done = true;
        o.onUpdate && o.onUpdate(st.value, 0);
        o.onRest && o.onRest();
        return;
      }
      st.id = raf(step);
    }
    st.id = raf(step);
    return {
      get value() { return st.value; }, get velocity() { return st.velocity; },
      stop: function () { caf(st.id); st.done = true; },
      retarget: function (to, d, r) { st.target = to; if (d != null || r != null) params(d, r); if (st.done) { st.done = false; last = now(); st.id = raf(step); } }
    };
  }

  // Apple's projection (Designing Fluid Interfaces): where a flick would come to rest.
  function project(v /* px/s */, rate) {
    rate = rate || 0.998;
    return (v / 1000) * rate / (1 - rate);
  }
  function rubber(over, dim) {
    var c = 0.55;
    return (over * dim * c) / (dim + c * Math.abs(over));
  }

  // Whole .switch row toggles its switch: the 44×25 pill alone is a small target.
  function wireSwitchRows() {
    if (!doc || !doc.addEventListener) return;
    doc.addEventListener("click", function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var row = t.closest(".switch");
      if (!row) return;
      if (t.closest("button,input,select,textarea,a,label")) return;
      var sw = row.querySelector(".toggle");
      if (sw && !sw.disabled) sw.click();
    });
  }

  /* ── Sheets ──────────────────────────────────────────────────────────────── */
  var CSS = [
    ".tbs-root{position:fixed;inset:0;z-index:1000;display:flex;align-items:flex-end;justify-content:center;",
    "width:auto;height:auto;max-width:none;max-height:none;margin:0;border:0;padding:0;background:transparent;color:inherit;overflow:visible}",
    ".tbs-scrim{position:absolute;inset:0;background:rgba(0,0,0,.5);opacity:0;-webkit-tap-highlight-color:transparent}",
    ".tbs-card{position:relative;width:min(560px,100%);max-height:min(86dvh,720px);display:flex;flex-direction:column;",
    "  background:var(--card);color:var(--txt);border:1px solid var(--line);border-bottom:0;border-radius:20px 20px 0 0;",
    "  box-shadow:0 -10px 40px rgba(0,0,0,.35);padding-bottom:env(safe-area-inset-bottom,0px);will-change:transform;outline:none}",
    ".tbs-grab{flex:none;height:22px;display:grid;place-items:center;cursor:grab;touch-action:none}",
    ".tbs-grab::before{content:'';width:38px;height:5px;border-radius:99px;background:var(--line)}",
    ".tbs-hd{flex:none;touch-action:none;padding:0 18px 10px}",
    ".tbs-body{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;padding:0 18px 18px;-webkit-overflow-scrolling:touch}",
    ".tbs-root.tbs-desktop{align-items:center;padding:24px}",
    ".tbs-desktop .tbs-card{border-radius:18px;border-bottom:1px solid var(--line);padding-bottom:0;box-shadow:0 24px 70px rgba(0,0,0,.45)}",
    ".tbs-desktop .tbs-grab{height:10px;cursor:default}.tbs-desktop .tbs-grab::before{display:none}",
    "body.tbs-pushed .wrap{transition:transform .38s cubic-bezier(.22,1,.36,1),filter .3s ease;transform:scale(.965);filter:brightness(.85);border-radius:14px}",
    "body.tbs-unpushing .wrap{transition:transform .3s cubic-bezier(.22,1,.36,1),filter .25s ease}",
    "@media (prefers-reduced-motion:reduce){body.tbs-pushed .wrap{transform:none}}",
    /* action sheet */
    ".tbs-act h3{margin:2px 0 6px;font-size:1.0625rem;letter-spacing:-.01em;line-height:1.25}",
    ".tbs-act .tbs-msg{margin:0;color:var(--muted);font-size:.875rem;line-height:1.5;white-space:pre-line}",
    ".tbs-act .tbs-detail{margin-top:12px}",
    ".tbs-btns{display:flex;flex-direction:column;gap:8px;margin-top:18px}",
    ".tbs-btn{position:relative;overflow:hidden;min-height:48px;border-radius:14px;border:1px solid var(--line);background:var(--card2);color:var(--txt);",
    "  font:inherit;font-size:1rem;font-weight:700;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}",
    ".tbs-btn.primary{background:var(--accent);border-color:var(--accent);color:var(--on-accent,#fff)}",
    ".tbs-btn.danger{background:color-mix(in srgb,var(--loss) 14%,var(--card2));border-color:var(--loss);color:var(--loss-ink,var(--loss))}",
    ".tbs-btn .tbs-fill{position:absolute;inset:0;transform-origin:left center;transform:scaleX(0);background:var(--loss);opacity:.28;pointer-events:none}",
    ".tbs-btn .tbs-lbl{position:relative}",
    "@media (prefers-reduced-motion:no-preference){.tbs-btn{transition:transform .12s cubic-bezier(.2,.9,.3,1)}.tbs-btn:active{transform:scale(.97);transition-duration:.06s}}",
    "@media (min-width:641px){.tbs-btns{flex-direction:row-reverse}.tbs-btns .tbs-btn{flex:1}}",
    "@media (prefers-contrast:more){.tbs-card{border-color:var(--txt)}}"
  ].join("\n");
  function injectCSS() {
    if (!doc || !doc.getElementById || doc.getElementById("tbs-css")) return;
    var s = doc.createElement("style"); s.id = "tbs-css"; s.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(s);
  }
  // A transformed, filtered, or overflow-scrolling page paints over position:fixed.
  // The top layer stays above that page; z-index covers browsers without popover.
  function lift(root) {
    try { root.style.zIndex = "1000"; } catch (e) {}
    if (!root || typeof root.showPopover !== "function") return;
    try {
      root.setAttribute("popover", "manual");
      root.showPopover();
    } catch (e) {
      try { root.removeAttribute("popover"); } catch (e2) {}
    }
  }
  function drop(root) {
    try { if (root && typeof root.hidePopover === "function") root.hidePopover(); } catch (e) {}
  }

  var STACK = [];
  var FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

  function isDesktop() { return mq("(min-width:641px)"); }

  function open(opts) {
    opts = opts || {};
    injectCSS();
    var opener = doc.activeElement;
    var desktop = isDesktop();
    var rm = reduced();
    var root = doc.createElement("div");
    root.className = "tbs-root" + (desktop ? " tbs-desktop" : "") + (opts.className ? " " + opts.className : "");
    if (opts.id) root.id = opts.id;
    root.innerHTML = '<div class="tbs-scrim"></div><div class="tbs-card" role="dialog" aria-modal="true" tabindex="-1">'
      + '<div class="tbs-grab" aria-hidden="true"></div><div class="tbs-hd"></div><div class="tbs-body"></div></div>';
    var scrim = root.firstChild, card = root.lastChild;
    var hd = card.querySelector(".tbs-hd"), body = card.querySelector(".tbs-body");
    card.setAttribute("aria-label", opts.label || "Sheet");
    if (opts.header != null) { if (typeof opts.header === "string") hd.innerHTML = opts.header; else hd.appendChild(opts.header); }
    else hd.style.display = "none";
    if (typeof opts.html === "string") body.innerHTML = opts.html;
    else if (opts.node) body.appendChild(opts.node);
    doc.body.appendChild(root);
    lift(root);

    var api = { el: root, card: card, body: body, header: hd, closed: false, close: close, dismissible: opts.dismissible !== false };
    STACK.push(api);
    try { if (w.TBSheet && w.TBSheet.hooks && w.TBSheet.hooks.open) w.TBSheet.hooks.open(api); } catch (e) {}
    if (STACK.length === 1 && !desktop) { doc.body.classList.remove("tbs-unpushing"); doc.body.classList.add("tbs-pushed"); setOrigin(); }

    var H = function () { return card.getBoundingClientRect().height + 24; };
    var anim = null, y = 0;
    function paint(v) {
      y = v;
      if (desktop) {
        var p = Math.max(0, Math.min(1, 1 - v)); // v: 1 = hidden, 0 = shown
        card.style.opacity = String(p);
        card.style.transform = "scale(" + (0.96 + 0.04 * p) + ")";
        scrim.style.opacity = String(p);
      } else {
        card.style.transform = "translate3d(0," + v + "px,0)";
        var h = H();
        scrim.style.opacity = String(Math.max(0, Math.min(1, 1 - v / h)));
      }
    }
    function animateTo(to, velocity, damping, response, done) {
      if (anim) anim.stop();
      if (rm) {
        // Reduced motion: a short cross-fade, no travel.
        card.style.transition = "opacity .16s ease"; scrim.style.transition = "opacity .16s ease";
        var shown = desktop ? to === 0 : to === 0;
        card.style.transform = "none"; card.style.opacity = shown ? "1" : "0"; scrim.style.opacity = shown ? "1" : "0";
        y = to; setTimeout(function () { done && done(); }, 170);
        return;
      }
      anim = spring({ from: y, to: to, velocity: velocity || 0, damping: damping, response: response,
        onUpdate: paint, onRest: function () { anim = null; done && done(); } });
    }

    // Enter: phones slide up from the bottom edge (drawer spring 0.8/0.3 with a hint of
    // overshoot); desktop scales from 0.96 (critically damped).
    if (desktop) { paint(1); animateTo(0, 0, 1, 0.3); }
    else { paint(H()); animateTo(0, 0, 0.86, 0.34); }

    function close(reason) {
      if (api.closed) return Promise.resolve();
      api.closed = true;
      var i = STACK.indexOf(api); if (i >= 0) STACK.splice(i, 1);
      doc.removeEventListener("keydown", onKey, true);
      try { if (w.TBSheet && w.TBSheet.hooks && w.TBSheet.hooks.close) w.TBSheet.hooks.close(api, reason || {}); } catch (e) {}
      if (!STACK.length && !desktop) { doc.body.classList.add("tbs-unpushing"); doc.body.classList.remove("tbs-pushed"); setTimeout(function () { doc.body.classList.remove("tbs-unpushing"); }, 350); }
      return new Promise(function (res) {
        var v = (reason && reason.velocity) || 0;
        animateTo(desktop ? 1 : H(), v, 1, desktop ? 0.22 : 0.3, function () {
          drop(root);
          if (root.parentNode) root.parentNode.removeChild(root);
          if (opener && opener.isConnected && opener.focus) { try { opener.focus({ preventScroll: true }); } catch (e) {} }
          opts.onClose && opts.onClose(reason || {});
          res();
        });
      });
    }

    scrim.addEventListener("click", function () { if (api.dismissible) close({ via: "scrim" }); });
    function onKey(e) {
      if (STACK[STACK.length - 1] !== api) return;
      if (e.key === "Escape" && api.dismissible) { e.stopPropagation(); close({ via: "escape" }); return; }
      if (e.key === "Tab") {
        var f = Array.prototype.filter.call(card.querySelectorAll(FOCUSABLE), function (n) { return n.offsetParent !== null || n === doc.activeElement; });
        if (!f.length) { e.preventDefault(); card.focus(); return; }
        var first = f[0], last = f[f.length - 1], a = doc.activeElement;
        if (e.shiftKey) { if (a === first || !card.contains(a)) { e.preventDefault(); last.focus(); } }
        else if (a === last || !card.contains(a)) { e.preventDefault(); first.focus(); }
      }
    }
    doc.addEventListener("keydown", onKey, true);

    // Drag to dismiss (phones): grab handle + header track 1:1, keep the grab offset,
    // rubber-band upward, project momentum on release and decide by where the flick lands.
    if (!desktop) {
      var drag = null;
      var start = function (e) {
        if (!api.dismissible || (e.button != null && e.button !== 0)) return;
        if (e.target.closest && e.target.closest("button,input,select,textarea,a")) return;
        if (anim) anim.stop(); // interruptible: grab it mid-flight, from where it is now
        drag = { id: e.pointerId, y0: e.clientY, base: y, hist: [{ y: e.clientY, t: e.timeStamp }] };
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch (x) {}
      };
      var move = function (e) {
        if (!drag || e.pointerId !== drag.id) return;
        var raw = drag.base + (e.clientY - drag.y0);
        paint(raw < 0 ? -rubber(-raw, H()) : raw);
        drag.hist.push({ y: e.clientY, t: e.timeStamp }); if (drag.hist.length > 6) drag.hist.shift();
      };
      var end = function (e) {
        if (!drag || e.pointerId !== drag.id) return;
        var a = drag.hist[0], b = drag.hist[drag.hist.length - 1];
        var v = (b.t > a.t) ? (b.y - a.y) / (b.t - a.t) * 1000 : 0; // px/s
        if (e.timeStamp - b.t > 90) v = 0; // finger rested before lifting: no fling
        drag = null;
        var rest = y + project(v);
        if (rest > H() * 0.45 || v > 900) { close({ via: "drag", velocity: v }); }
        else animateTo(0, v, 0.86, 0.3);
      };
      [card.querySelector(".tbs-grab"), hd].forEach(function (el) {
        el.addEventListener("pointerdown", start);
        el.addEventListener("pointermove", move);
        el.addEventListener("pointerup", end);
        el.addEventListener("pointercancel", end);
      });
    }

    // Focus: the requested element, else the first control, else the card.
    // Immediately, so a confirm is focused when it appears, then again after the
    // enter frame in case the browser moved focus while promoting the top layer.
    function focusInitial() {
      if (api.closed) return;
      var target = (opts.initialFocus && card.querySelector(opts.initialFocus)) || card.querySelector(FOCUSABLE) || card;
      try { target.focus({ preventScroll: true }); } catch (e) { try { target.focus(); } catch (e2) {} }
    }
    focusInitial();
    setTimeout(focusInitial, 30);
    return api;
  }
  function setOrigin() {
    var wr = doc.querySelector(".wrap"); if (!wr) return;
    var r = wr.getBoundingClientRect();
    wr.style.transformOrigin = "50% " + Math.round(-r.top + w.innerHeight / 2) + "px";
  }

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  /* Action sheet. Confirm only what is destructive or irreversible; everything else should
     act immediately and offer Undo. `hold` (ms or true = 1200) turns the confirm button into
     hold-to-confirm for truly irreversible actions (keyboard: hold Space/Enter). */
  function confirm(o) {
    o = o || {};
    return new Promise(function (resolve) {
      var settled = false;
      var holdMs = o.hold === true ? 1200 : (+o.hold || 0);
      var tone = o.destructive ? "danger" : "primary";
      var html = '<div class="tbs-act">'
        + (o.title ? '<h3>' + esc(o.title) + '</h3>' : "")
        + (o.message ? '<p class="tbs-msg">' + esc(o.message) + '</p>' : "")
        + (o.detailHtml ? '<div class="tbs-detail">' + o.detailHtml + '</div>' : "")
        + '<div class="tbs-btns">'
        + '<button type="button" class="tbs-btn ' + tone + '" data-act="ok">' + (holdMs ? '<span class="tbs-fill"></span>' : "")
        + '<span class="tbs-lbl">' + esc(holdMs ? (o.holdLabel || ("Hold to " + (o.confirmLabel || "confirm").toLowerCase())) : (o.confirmLabel || "Confirm")) + '</span></button>'
        + '<button type="button" class="tbs-btn" data-act="cancel">' + esc(o.cancelLabel || "Cancel") + '</button>'
        + '</div></div>';
      var sh = open({ html: html, label: o.title || "Confirm", initialFocus: holdMs ? '[data-act="cancel"]' : '[data-act="ok"]',
        onClose: function () { if (!settled) { settled = true; resolve(false); } } });
      var ok = sh.card.querySelector('[data-act="ok"]'), cancel = sh.card.querySelector('[data-act="cancel"]');
      function finish(v) { if (settled) return; settled = true; resolve(v); sh.close({ via: v ? "confirm" : "cancel" }); }
      cancel.onclick = function () { finish(false); };
      if (!holdMs) { ok.onclick = function () { finish(true); }; return; }
      var fill = ok.querySelector(".tbs-fill"), t0 = 0, rafId = 0;
      function frame() {
        var p = Math.min(1, (now() - t0) / holdMs);
        fill.style.transform = "scaleX(" + p + ")";
        if (p >= 1) { tick(); finish(true); return; }
        rafId = raf(frame);
      }
      function begin(e) { if (t0) return; if (e && e.preventDefault) e.preventDefault(); t0 = now(); rafId = raf(frame); }
      function abort() {
        if (!t0 || settled) return; t0 = 0; caf(rafId);
        fill.style.transition = "transform .25s ease"; fill.style.transform = "scaleX(0)";
        setTimeout(function () { fill.style.transition = ""; }, 260);
      }
      ok.addEventListener("pointerdown", begin);
      ["pointerup", "pointerleave", "pointercancel"].forEach(function (ev) { ok.addEventListener(ev, abort); });
      ok.addEventListener("keydown", function (e) { if ((e.key === " " || e.key === "Enter") && !e.repeat) begin(e); });
      ok.addEventListener("keyup", function (e) { if (e.key === " " || e.key === "Enter") abort(); });
      ok.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    });
  }

  /* Switches (0.43.1): `.toggle` buttons are visual-only — give them role=switch, an on/off
     state and the label beside them, and keep aria-checked in sync with the .on class. */
  function a11ySwitch(b) {
    if (!b || !b.classList || !b.classList.contains("toggle")) return;
    if (b.getAttribute("role") !== "switch") b.setAttribute("role", "switch");
    var on = String(b.classList.contains("on"));
    if (b.getAttribute("aria-checked") !== on) b.setAttribute("aria-checked", on);
    if (!b.hasAttribute("aria-label") && !b.hasAttribute("aria-labelledby")) {
      var row = b.closest && b.closest(".switch");
      var lab = row && row.querySelector("span");
      var txt = lab ? lab.textContent.trim() : (b.title || "");
      if (txt) b.setAttribute("aria-label", txt);
    }
  }
  function wireSwitchA11y() {
    if (!doc || !doc.body || typeof w.MutationObserver !== "function") return;
    Array.prototype.forEach.call(doc.querySelectorAll(".toggle"), a11ySwitch);
    new w.MutationObserver(function (muts) {
      muts.forEach(function (m) {
        if (m.type === "attributes") { a11ySwitch(m.target); return; }
        Array.prototype.forEach.call(m.addedNodes || [], function (n) {
          if (n.nodeType !== 1) return;
          a11ySwitch(n);
          if (n.querySelectorAll) Array.prototype.forEach.call(n.querySelectorAll(".toggle"), a11ySwitch);
        });
      });
    }).observe(doc.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class"] });
  }
  if (doc && doc.readyState === "loading" && doc.addEventListener) doc.addEventListener("DOMContentLoaded", wireSwitchA11y);
  else wireSwitchA11y();

  w.TBMotion = { reduced: reduced, bump: bump, tick: tick, spring: spring, project: project };
  w.TBSheet = {
    hooks: null, // {open(api), close(api, reason)} — the dashboard's router uses these (0.43.1)
    open: open, confirm: confirm,
    top: function () { return STACK[STACK.length - 1] || null; },
    closeTop: function (reason) { var t = STACK[STACK.length - 1]; if (t && t.dismissible) { t.close(reason || { via: "back" }); return true; } return false; }
  };
  wireSwitchRows();
}).call(this);
