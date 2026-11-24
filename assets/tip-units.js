/* Change units on a posted tip until its first start (TipBot 0.102.1, POST /api/tip-units).
 * TipBot marks each pending tip on /api/server with can_edit_units (your own posted tip,
 * before the start) and units_lock_at. TipBot checks both again and answers 409 after the
 * start, so this file is only the button, the prompt and the message.
 * Browser global window.TBTipUnits + CommonJS export for node --test.
 */
(function (root) {
  "use strict";
  var MAX_UNITS = 100;

  function lockTs(t) {
    var ts = Date.parse((t && t.units_lock_at) || "");
    return isFinite(ts) ? ts : null;
  }
  /** Show ✎ Units: TipBot said this session may edit it, and the lock time is still ahead. */
  function canEdit(t, now) {
    if (!t || !t.can_edit_units) return false;
    var lock = lockTs(t);
    return lock != null && lock > (now == null ? Date.now() : now);
  }
  /** Parse what was typed. Returns {units} or {error}. */
  function parse(text, current) {
    var raw = String(text == null ? "" : text).trim().replace(/u(nits?)?$/i, "").trim();
    if (!raw) return {error: null};
    var n = Number(raw);
    if (!isFinite(n) || n <= 0 || n > MAX_UNITS) return {error: "Units must be above 0 and at most " + MAX_UNITS + "."};
    n = Math.round(n * 100) / 100;
    if (current != null && Math.abs(n - Number(current)) < 1e-9) return {error: null};
    return {units: n};
  }
  function lockLabel(t, fmt) {
    var lock = lockTs(t);
    if (lock == null) return "";
    var when = typeof fmt === "function" ? fmt(new Date(lock).toISOString()) : new Date(lock).toLocaleString();
    return "Units lock at the start: " + when;
  }
  function buttonHtml(t, esc, fmt) {
    if (!canEdit(t)) return "";
    var title = lockLabel(t, fmt);
    return '<button type="button" class="unitsedit ghost" data-tip="' + esc(t.tip_id) + '" data-units="' + esc(t.units) + '"'
      + ' title="' + esc(title) + '" aria-label="Change units. ' + esc(title) + '"'
      + ' style="padding:5px 9px;font-size:var(--t-foot);flex:none">✎ Units</button>';
  }
  /** Prompt, save, and report. deps: {api, ask, toast, onSaved}. Resolves the server body or null. */
  async function edit(gid, tipId, current, deps) {
    var typed = await deps.ask("Units for this tip (you can change them until the game starts):", current == null ? "" : String(current));
    if (typed == null) return null;
    var p = parse(typed, current);
    if (p.error) { deps.toast(p.error, "error"); return null; }
    if (p.units == null) return null;
    var r, j = {};
    try {
      r = await deps.api("/api/tip-units", {method: "POST", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({guild_id: String(gid), tip_id: tipId, units: p.units})});
      try { j = await r.json(); } catch (e) { j = {}; }
    } catch (e) {
      if (e && e.unauth) throw e;
      deps.toast("Couldn’t reach the bot.", "error"); return null;
    }
    if (r.ok && j.ok) {
      deps.toast(j.message || "Units updated.", "success");
      if (deps.onSaved) deps.onSaved(j.tip || {tip_id: tipId, units: p.units});
      return j;
    }
    if ([404, 405, 501].indexOf(r.status) !== -1 && !j.message) {
      deps.toast("Changing units needs TipBot’s latest deploy.", "error");
    } else {
      deps.toast(j.message || "Couldn’t change the units.", "error");
    }
    if (r.status === 409 && deps.onLocked) deps.onLocked(tipId, j);
    return j;
  }

  var api = {canEdit: canEdit, parse: parse, lockLabel: lockLabel, buttonHtml: buttonHtml, edit: edit, MAX_UNITS: MAX_UNITS};
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.TBTipUnits = api;
})(typeof window !== "undefined" ? window : null);
