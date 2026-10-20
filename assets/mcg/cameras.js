/* Game view camera presets and the chip row that switches between them.
   Pure helpers (presets, tween maths, saved choice) plus a small DOM chip row.
   mount.js owns the three.js camera and calls these; nothing here imports three.js. */

// Presets as data. Metres, y up, the same space as mount.js (the broadcast camera
// sits on the +z side looking at the centre square; the long axis of the oval runs
// along x). A stadium can ship its own table (see camerasFor). "broadcast" must
// stay identical to mount.js CAM: the fallback photo and the logo tilt use it.
export var CAMERAS = [
  {id: "broadcast", label: "Broadcast", fov: 36, pos: [0, 110, 200], look: [0, 0, 0]},
  // Behind the goals and raised (inside the bowl, clear of the stand roofs): -x and +x ends.
  {id: "goals-north", label: "North end", fov: 40, pos: [-118, 70, 0], look: [10, 0, 0], minAspect: 1.3},
  {id: "goals-south", label: "South end", fov: 40, pos: [118, 70, 0], look: [-10, 0, 0], minAspect: 1.3},
  // High and side-on from the members' (far, -z) wing, a little closer than broadcast.
  {id: "wing", label: "Wing", fov: 38, pos: [-24, 82, -150], look: [0, 0, 6]},
  // Overhead and slightly tilted, so the stands still frame the oval.
  {id: "blimp", label: "Blimp", fov: 42, pos: [0, 190, 50], look: [0, 0, -3], minAspect: 1.4}
];

// Chips shown in the overlay. "Ends" covers both goal cameras; tapping it again flips end.
export var CHIPS = [
  {key: "broadcast", label: "Broadcast", ids: ["broadcast"]},
  {key: "ends", label: "Ends", ids: ["goals-north", "goals-south"]},
  {key: "wing", label: "Wing", ids: ["wing"]},
  {key: "blimp", label: "Blimp", ids: ["blimp"]}
];

export var STORAGE_KEY = "tipdash_gv_cam";
export var TWEEN_MS = 600;

function vec3(v) {
  return Array.isArray(v) && v.length === 3 && v.every(function (n) { return typeof n === "number" && isFinite(n); });
}

/** True when a preset has the fields mount.js needs. */
export function validCamera(c) {
  return !!c && typeof c.id === "string" && !!c.id && typeof c.fov === "number" && c.fov > 5 && c.fov < 120 &&
    vec3(c.pos) && vec3(c.look) && (c.minAspect == null || (typeof c.minAspect === "number" && c.minAspect > 0));
}

/** The camera table for a stadium config ({cameras: [...]}) or the MCG defaults. A stadium
    table is used only if every entry is valid and it has a "broadcast" camera. */
export function camerasFor(stadium) {
  var list = stadium && Array.isArray(stadium.cameras) ? stadium.cameras : null;
  if (list && list.length && list.every(validCamera) && list.some(function (c) { return c.id === "broadcast"; })) return list;
  return CAMERAS;
}

export function findCamera(cams, id) {
  for (var i = 0; i < cams.length; i++) if (cams[i].id === id) return cams[i];
  return null;
}

/** Vertical fov that keeps at least the horizontal coverage of `minAspect` on a narrower host. */
export function effectiveFov(cam, aspect) {
  var fov = cam.fov;
  if (!cam.minAspect || !(aspect > 0) || aspect >= cam.minAspect) return fov;
  var half = Math.atan(Math.tan(fov * Math.PI / 360) * cam.minAspect / aspect);
  return Math.min(100, half * 360 / Math.PI);
}

export function easeOutCubic(t) {
  var x = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - x, 3);
}

function mix(a, b, k) { return a + (b - a) * k; }

/** Camera state part-way from `from` to `to` ({pos, look, fov}); t is linear time 0..1, eased here. */
export function cameraAt(from, to, t) {
  var k = easeOutCubic(t);
  return {
    pos: [mix(from.pos[0], to.pos[0], k), mix(from.pos[1], to.pos[1], k), mix(from.pos[2], to.pos[2], k)],
    look: [mix(from.look[0], to.look[0], k), mix(from.look[1], to.look[1], k), mix(from.look[2], to.look[2], k)],
    fov: mix(from.fov, to.fov, k)
  };
}

/** Tween progress (0..1) at time `now` for a tween that started at `start`. Instant under reduced motion. */
export function tweenProgress(start, now, ms, reduced) {
  if (reduced || !(ms > 0)) return 1;
  return Math.max(0, Math.min(1, (now - start) / ms));
}

/** Chip labels for a handle: the MCG labels, with a per-venue override map
    ({ends: "Baseline", blimp: "Overhead"}). Unknown keys are ignored. */
export function chipLabels(overrides) {
  var out = {};
  for (var i = 0; i < CHIPS.length; i++) {
    var k = CHIPS[i].key;
    var o = overrides && typeof overrides[k] === "string" && overrides[k] ? overrides[k] : null;
    out[k] = o || CHIPS[i].label;
  }
  return out;
}

/** Storage key for the saved camera. The MCG keeps the original key; any other venue
    is namespaced ("tipdash_gv_cam:arena") so one ground's choice can't bleed into another. */
export function storageKeyFor(venue) {
  var v = String(venue || "").trim().toLowerCase();
  return !v || v === "mcg" ? STORAGE_KEY : STORAGE_KEY + ":" + v;
}

/** Which camera a chip tap goes to. "Ends" flips north/south when an end camera is already showing. */
export function nextCameraForChip(key, currentId, cams) {
  var chip = null;
  for (var i = 0; i < CHIPS.length; i++) if (CHIPS[i].key === key) chip = CHIPS[i];
  if (!chip) return currentId;
  var ids = chip.ids.filter(function (id) { return !cams || findCamera(cams, id); });
  if (!ids.length) return currentId;
  var at = ids.indexOf(currentId);
  return at === -1 ? ids[0] : ids[(at + 1) % ids.length];
}

export function chipForCamera(id) {
  for (var i = 0; i < CHIPS.length; i++) if (CHIPS[i].ids.indexOf(id) !== -1) return CHIPS[i].key;
  return null;
}

/** The saved camera id, or "broadcast" when nothing valid is saved. Storage can throw (private mode). */
export function loadCameraChoice(storage, cams, key) {
  try {
    var id = storage && storage.getItem(key || STORAGE_KEY);
    if (id && findCamera(cams || CAMERAS, id)) return id;
  } catch (e) {}
  return "broadcast";
}

export function saveCameraChoice(storage, id, key) {
  try { if (storage) storage.setItem(key || STORAGE_KEY, String(id)); return true; } catch (e) { return false; }
}

// ── chip row ────────────────────────────────────────────────────────────────
var STYLE_ID = "tb-gv-cams-style";
var CSS = ""
  + ".fl-cams{position:absolute;z-index:5;left:max(8px, env(safe-area-inset-left, 0px));bottom:4px;display:flex;gap:2px;"
  + "max-width:calc(100% - 16px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px));pointer-events:auto}"
  + ".fl-cams button{flex:none;min-width:44px;min-height:44px;height:44px;padding:0 3px;margin:0;border:0;background:none;"
  + "color:var(--txt);font:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent;display:flex;align-items:center}"
  + ".fl-cams span{display:block;height:28px;line-height:26px;padding:0 10px;border-radius:999px;font-size:12px;font-weight:700;"
  + "border:1px solid color-mix(in srgb,var(--txt) 22%,transparent);background:color-mix(in srgb,#070b14 72%,transparent);white-space:nowrap}"
  + ".fl-cams button[aria-pressed=\"true\"] span{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 30%,#070b14)}"
  + ".fl-cams button:focus-visible span{outline:2px solid var(--accent);outline-offset:2px}"
  // Photo mode (WebGL off or lost) has no cameras: the still exists only for broadcast.
  + ".fl-mcg:not(.is-webgl) .fl-cams{display:none}"
  // The cartoon player overlay is drawn for the broadcast framing, so it only shows there.
  + ".fl-mcg.is-webgl[data-cam]:not([data-cam=\"broadcast\"]) .tblfx-afl{visibility:hidden}";

function ensureStyle(doc) {
  if (!doc || doc.getElementById(STYLE_ID)) return;
  var st = doc.createElement("style");
  st.id = STYLE_ID;
  st.textContent = CSS;
  (doc.head || doc.documentElement).appendChild(st);
}

/** Chip row HTML for the current camera (exported for tests). `labels` overrides chip
    labels per venue (see chipLabels); an overridden "ends" label stays fixed. */
export function chipRowHtml(currentId, labels) {
  var on = chipForCamera(currentId);
  var names = chipLabels(labels);
  var fixedEnds = !!(labels && labels.ends);
  return CHIPS.map(function (c) {
    var label = !fixedEnds && c.key === "ends" && (currentId === "goals-north" || currentId === "goals-south")
      ? (currentId === "goals-north" ? "North end" : "South end") : names[c.key];
    return '<button type="button" data-cam-chip="' + c.key + '" aria-pressed="' + (c.key === on ? "true" : "false") + '"'
      + (c.key === "ends" ? ' title="Tap again to switch ends"' : "") + "><span>" + label + "</span></button>";
  }).join("");
}

/**
 * Adds the chip row to the ground host and applies the saved camera.
 * handle: the mount() handle. No row in fallback (photo) mode: the photo exists only
 * for the broadcast camera. Returns the row element, or null when no row is shown.
 */
export function mountCameraChips(host, handle, opts) {
  opts = opts || {};
  if (!host || !handle || handle.fallback || typeof handle.setCamera !== "function") return null;
  var doc = host.ownerDocument || (typeof document !== "undefined" ? document : null);
  if (!doc) return null;
  var storage = opts.storage !== undefined ? opts.storage : (function () { try { return window.localStorage; } catch (e) { return null; } })();
  var cams = handle.cameras || CAMERAS;
  var key = handle.storageKey || STORAGE_KEY;
  var labels = handle.chips || null;
  ensureStyle(doc);
  var old = host.querySelector(".fl-cams");
  if (old) old.remove();
  var row = doc.createElement("div");
  row.className = "fl-cams";
  row.setAttribute("role", "group");
  row.setAttribute("aria-label", "Camera");
  function paint() {
    var id = handle.cameraId || "broadcast";
    row.innerHTML = chipRowHtml(id, labels);
    try { host.dataset.cam = id; } catch (e) {}
  }
  row.addEventListener("click", function (ev) {
    var btn = ev.target && ev.target.closest ? ev.target.closest("[data-cam-chip]") : null;
    if (!btn) return;
    var next = nextCameraForChip(btn.getAttribute("data-cam-chip"), handle.cameraId || "broadcast", cams);
    if (handle.setCamera(next, {animate: true}) !== false) saveCameraChoice(storage, next, key);
    paint();
  });
  var saved = loadCameraChoice(storage, cams, key);
  if (saved !== (handle.cameraId || "broadcast")) handle.setCamera(saved, {animate: false});
  paint();
  host.appendChild(row);
  return row;
}
