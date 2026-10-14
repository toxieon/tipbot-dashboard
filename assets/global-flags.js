/* Owner-only Global switches. Not per server.
   GET/POST /api/owner/global-flags
     {marketplace_enabled, build_tips_enabled}
   Everyone else reads the same booleans from GET /api/config or /api/me
   (top level, or under config / flags). A missing value stays on.
   When a flag is off, the menu, nav entry and route hide for every session
   except the owner, who still sees them with an "Off for users" badge.
*/
(function (root) {
  "use strict";
  var PATH = "/api/owner/global-flags";
  var CONFIG_PATH = "/api/config";
  var KEYS = ["marketplace_enabled", "build_tips_enabled"];
  var BADGE = "Off for users";
  var flags = { marketplace_enabled: true, build_tips_enabled: true };
  var owner = false;
  var listeners = [];
  var CSS = ""
    + ".gf{min-width:0;max-width:100%}"
    + ".gf h2{margin:0 0 6px;font-size:var(--t-h3)}"
    + ".gf-lead{color:var(--faint);font-size:var(--t-foot);line-height:1.45;margin:0 0 4px}"
    + ".gf-row{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:52px;padding:12px 0;border-bottom:1px solid var(--line);cursor:pointer}"
    + ".gf-row:last-of-type{border-bottom:0}"
    + ".gf-copy{min-width:0;display:flex;flex-direction:column;gap:2px}"
    + ".gf-title{font-weight:750;font-size:var(--t-callout);display:flex;flex-wrap:wrap;align-items:center;gap:6px}"
    + ".gf-sub{color:var(--faint);font-size:var(--t-foot);line-height:1.4}"
    + ".gf-row input{width:22px;height:22px;margin:0;flex:none;accent-color:var(--accent)}"
    + ".gf-msg{min-height:1.2em;margin:8px 0 0;color:var(--faint);font-size:var(--t-foot)}"
    + ".gf-msg.err{color:var(--loss)}"
    + ".gf-badge{display:inline-flex;align-items:center;margin-left:6px;padding:1px 7px;border-radius:999px;font-size:10px;font-weight:800;letter-spacing:.02em;line-height:1.4;color:#e0a04a;background:rgba(224,160,74,.16);white-space:nowrap;vertical-align:middle}"
    + ".gf-title .gf-badge{margin-left:0}";

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function asBool(value) {
    if (value === true || value === false) return value;
    if (value === 1 || value === "1" || value === "true") return true;
    if (value === 0 || value === "0" || value === "false") return false;
    return null;
  }
  function bagsOf(payload) {
    var bags = [];
    if (!payload || typeof payload !== "object") return bags;
    bags.push(payload);
    if (payload.config && typeof payload.config === "object") bags.push(payload.config);
    if (payload.flags && typeof payload.flags === "object" && !Array.isArray(payload.flags)) bags.push(payload.flags);
    return bags;
  }
  function readFlags(payload) {
    var found = {};
    var bags = bagsOf(payload);
    KEYS.forEach(function (key) {
      var i, bag, value;
      for (i = bags.length - 1; i >= 0; i--) {
        bag = bags[i];
        if (!bag || !Object.prototype.hasOwnProperty.call(bag, key)) continue;
        value = asBool(bag[key]);
        if (value !== null) { found[key] = value; break; }
      }
    });
    return found;
  }
  function currentFlags() {
    return {
      marketplace_enabled: !!flags.marketplace_enabled,
      build_tips_enabled: !!flags.build_tips_enabled
    };
  }
  function emit() {
    var snap = currentFlags();
    listeners.slice().forEach(function (fn) { try { fn(snap); } catch (e) {} });
  }
  function ingest(incoming) {
    var found = readFlags(incoming);
    var changed = false;
    KEYS.forEach(function (key) {
      if (!Object.prototype.hasOwnProperty.call(found, key)) return;
      if (flags[key] !== found[key]) { flags[key] = found[key]; changed = true; }
    });
    if (changed) emit();
    return currentFlags();
  }
  function noteSession(info) {
    var next = !!(info && info.owner);
    if (next === owner) return owner;
    owner = next;
    emit();
    return owner;
  }
  function enabled(key) { return flags[key] !== false; }
  function shown(key) { return enabled(key) || owner; }
  function badge(key) { return (!enabled(key) && owner) ? BADGE : ""; }
  function reset() {
    flags.marketplace_enabled = true;
    flags.build_tips_enabled = true;
    owner = false;
  }
  function onChange(fn) {
    if (typeof fn !== "function") return function () {};
    listeners.push(fn);
    return function () { listeners = listeners.filter(function (f) { return f !== fn; }); };
  }
  function rowHtml(key, title, sub) {
    var on = enabled(key);
    var mark = badge(key);
    return '<label class="gf-row">'
      + '<span class="gf-copy"><span class="gf-title">' + esc(title)
      + '<span class="gf-badge" data-gf-badge="' + key + '"' + (mark ? "" : " hidden") + ">" + BADGE + "</span>"
      + '</span><span class="gf-sub">' + esc(sub) + "</span></span>"
      + '<input type="checkbox" data-gf="' + key + '"' + (on ? " checked" : "") + ">"
      + "</label>";
  }
  function settingsHtml(view) {
    var msg = view && view.message ? view.message : "";
    var err = !!(view && view.error);
    return '<section class="gf" id="os-global" aria-labelledby="os-global-title">'
      + '<h2 id="os-global-title">Global</h2>'
      + '<p class="gf-lead">These apply to every server. Turning one off hides it from everyone except you.</p>'
      + rowHtml("marketplace_enabled", "Marketplace", "Marketplace entry in the menu")
      + rowHtml("build_tips_enabled", "Build your own tips", "Build button in the nav, and the builder")
      + '<p class="gf-msg' + (err ? " err" : "") + '" id="gf-msg" role="status">' + esc(msg) + "</p>"
      + "</section>";
  }
  function ensureCss() {
    var doc = root.document;
    if (!doc || doc.getElementById("gf-css")) return;
    var style = doc.createElement("style");
    style.id = "gf-css";
    style.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(style);
  }
  function mountSettings(box, opts) {
    opts = opts || {};
    if (!box || (typeof opts.allowed === "function" && !opts.allowed())) return null;
    ensureCss();
    var body = box.querySelector(".os-body");
    if (!body) {
      var shell = "";
      if (!box.querySelector(".back")) shell += '<div class="back" id="os-back">← Back</div>';
      if (!box.querySelector("h1")) shell += "<h1>Owner settings</h1>";
      shell += '<div class="os-body"></div>';
      box.insertAdjacentHTML("beforeend", shell);
      body = box.querySelector(".os-body");
      var back = box.querySelector("#os-back");
      if (back) back.onclick = function () { if (typeof opts.onBack === "function") opts.onBack(); };
    }
    var previous = box.querySelector("#os-global");
    if (previous) previous.remove();
    body.insertAdjacentHTML("beforeend", settingsHtml({ message: "Loading…" }));
    var section = box.querySelector("#os-global");
    var alive = true;
    var missing = false;
    function setMsg(text, isErr) {
      var el = section.querySelector("#gf-msg");
      if (!el) return;
      el.textContent = text || "";
      el.classList.toggle("err", !!isErr);
    }
    function syncBadges() {
      section.querySelectorAll("[data-gf-badge]").forEach(function (el) {
        el.hidden = !badge(el.getAttribute("data-gf-badge"));
      });
    }
    function setBusy(on) {
      section.querySelectorAll("[data-gf]").forEach(function (el) { el.disabled = !!on || missing; });
    }
    async function save(key, prev, input) {
      setBusy(true);
      setMsg("Saving…", false);
      try {
        var r = await opts.call(PATH, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(currentFlags())
        });
        var j = null;
        try { j = await r.json(); } catch (e1) { j = null; }
        if (!alive) return;
        if (r.status === 404 || r.status === 501) {
          missing = true;
          flags[key] = prev;
          input.checked = prev;
          emit();
          syncBadges();
          setMsg("This needs TipBot’s latest deploy.", true);
          return;
        }
        if (!r.ok || (j && j.ok === false)) {
          flags[key] = prev;
          input.checked = prev;
          emit();
          syncBadges();
          setMsg((j && (j.message || j.error)) || "Couldn’t save that.", true);
          return;
        }
        if (j) ingest(j);
        section.querySelectorAll("[data-gf]").forEach(function (el) {
          el.checked = !!flags[el.getAttribute("data-gf")];
        });
        syncBadges();
        setMsg("Saved.", false);
      } catch (e2) {
        if (e2 && e2.unauth && opts.onUnauth) { opts.onUnauth(); return; }
        if (!alive) return;
        flags[key] = prev;
        input.checked = prev;
        emit();
        syncBadges();
        setMsg("Couldn’t reach TipBot.", true);
      } finally {
        if (alive) setBusy(false);
      }
    }
    section.querySelectorAll("[data-gf]").forEach(function (input) {
      input.addEventListener("change", function () {
        if (input.disabled || missing || typeof opts.call !== "function") return;
        var key = input.getAttribute("data-gf");
        var prev = !!flags[key];
        flags[key] = !!input.checked;
        emit();
        syncBadges();
        save(key, prev, input);
      });
    });
    async function load() {
      if (typeof opts.call !== "function") { setMsg("", false); return; }
      try {
        var r = await opts.call(PATH, { method: "GET" });
        var j = null;
        try { j = await r.json(); } catch (e3) { j = null; }
        if (!alive) return;
        if (r.status === 404 || r.status === 501) {
          missing = true;
          setBusy(true);
          setMsg("This needs TipBot’s latest deploy.", true);
          return;
        }
        if (!r.ok || (j && j.ok === false)) {
          setMsg("Couldn’t load global settings.", true);
          return;
        }
        if (j) ingest(j);
        section.querySelectorAll("[data-gf]").forEach(function (el) {
          el.checked = !!flags[el.getAttribute("data-gf")];
        });
        syncBadges();
        setMsg("", false);
      } catch (e4) {
        if (e4 && e4.unauth && opts.onUnauth) { opts.onUnauth(); return; }
        if (!alive) return;
        setMsg("Couldn’t load global settings.", true);
      }
    }
    load();
    return { destroy: function () { alive = false; } };
  }

  var api = {
    PATH: PATH,
    CONFIG_PATH: CONFIG_PATH,
    BADGE: BADGE,
    readFlags: readFlags,
    ingest: ingest,
    noteSession: noteSession,
    enabled: enabled,
    shown: shown,
    badge: badge,
    payload: currentFlags,
    reset: reset,
    onChange: onChange,
    settingsHtml: settingsHtml,
    mountSettings: mountSettings
  };
  root.TBGlobalFlags = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
