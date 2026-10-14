/* Global Marketplace / Build switches (read side). Not per server.
   Everyone reads the booleans from GET /api/config (public) or GET /api/me
   (under global_flags). A missing value stays on. The owner's switch UI is
   served by TipBot with the other owner-only scripts.
   When a flag is off, the menu, nav entry and route hide for every session
   except the owner, who still sees them with an "Off for users" badge.
*/
(function (root) {
  "use strict";
  var CONFIG_PATH = "/api/config";
  var KEYS = ["marketplace_enabled", "build_tips_enabled"];
  var BADGE = "Off for users";
  var flags = { marketplace_enabled: true, build_tips_enabled: true };
  var owner = false;
  var listeners = [];
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
    if (payload.global_flags && typeof payload.global_flags === "object") bags.push(payload.global_flags);
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
  function set(key, value) {
    if (KEYS.indexOf(key) < 0) return;
    var next = !!value;
    if (flags[key] === next) return;
    flags[key] = next;
    emit();
  }
  var api = {
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
    set: set
  };
  root.TBGlobalFlags = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
