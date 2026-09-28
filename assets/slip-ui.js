/* Master → Overview → "Slip import" card (Phase 1.3). Owner only (TipBot enforces it).
 * Switch, #slips channel picker, default target server, and status: key present, model,
 * drafts today and approximate spend. Uses the master page's existing card/switch/stats styles.
 * Browser global window.SlipUI + CommonJS export for node --test.
 */
(function (root) {
  "use strict";
  var UNAVAILABLE = "This needs TipBot’s latest deploy.";
  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c];
    });
  }
  function money(v) {
    var n = Number(v || 0);
    return n < 0.01 && n > 0 ? "<US$0.01" : "US$" + n.toFixed(2);
  }
  function create(opts) {
    var call = opts.call, paint = opts.paint;
    var S = {data: null, missing: null, busy: false, msg: null};
    async function load() {
      var r = await call("/api/owner/slip-import");
      if ([404, 405, 501].indexOf(r._status) !== -1) S.missing = UNAVAILABLE;
      else if (!r.ok) S.missing = r.error || "Couldn’t load slip import.";
      else { S.data = r; S.missing = null; }
      paint();
    }
    async function save(body, label) {
      S.busy = true; S.msg = null; paint();
      var r = await call("/api/owner/slip-import/settings", body);
      S.busy = false;
      if (r.ok) { S.data = r; S.msg = {cls: "ok", text: label}; }
      else S.msg = {cls: "err", text: [404, 405, 501].indexOf(r._status) !== -1 ? UNAVAILABLE : (r.error || "Couldn’t save")};
      paint();
    }
    function view() {
      if (S.missing) return '<section class="card"><h2>Slip import</h2><div class="empty">' + esc(S.missing) + '</div><p><button class="btn ghost" id="slip-retry">Retry</button></p></section>';
      if (!S.data) return '<section class="card"><h2>Slip import</h2><div class="empty">Loading…</div></section>';
      var s = S.data, dis = S.busy ? " disabled" : "";
      var chans = (s.channels || []).map(function (c) {
        return '<option value="' + esc(c.id) + '"' + (String(c.id) === String(s.slips_channel_id) ? " selected" : "") + '>#' + esc(c.name) + (c.category ? " (" + esc(c.category) + ")" : "") + "</option>";
      }).join("");
      var targets = (s.targets || []).map(function (t) {
        return '<option value="' + esc(t.guild_id) + '"' + (String(t.guild_id) === String(s.target_guild_id) ? " selected" : "") + '>' + esc(t.name) + (t.unit_size > 0 ? " · unit $" + esc(t.unit_size) : " · no unit size") + "</option>";
      }).join("");
      return '<section class="card"><h2>Slip import</h2>'
        + '<label class="switch"><input type="checkbox" id="slip-on"' + (s.enabled ? " checked" : "") + dis + '> Slip import on</label>'
        + '<p class="note">Share a bet-slip screenshot in #slips and @mention TipBot (or use /slip, or DM it). TipBot reads it, builds the tip exactly like the builder and replies with Post / Edit / Discard. Nothing posts until you press Post.' + (s.key_present ? "" : " <b>Needs SLIP_VISION_API_KEY and SLIP_VISION_MODEL on TipBot before it can read slips.</b>") + '</p>'
        + '<div class="access-form" style="margin-top:10px">'
        + '<label>#slips channel (master server)<select id="slip-chan"' + dis + '><option value="">—</option>' + chans + '</select></label>'
        + '<label>Default target server<select id="slip-target"' + dis + '><option value="">—</option>' + targets + '</select></label></div>'
        + '<div class="stats" style="margin-top:12px">'
        + '<div><div class="stat">' + (s.key_present ? "Yes" : "No") + '</div><div class="stat-l">vision key set</div></div>'
        + '<div><div class="stat" style="font-size:15px">' + esc(s.model || "—") + '</div><div class="stat-l">model</div></div>'
        + '<div><div class="stat">' + esc(s.drafts_today || 0) + '</div><div class="stat-l">drafts today</div></div>'
        + '<div><div class="stat">' + esc(money(s.spend_today_usd)) + '</div><div class="stat-l">approx spend today (' + esc(money(s.spend_month_usd)) + ' this month)</div></div></div>'
        + (S.msg ? '<div class="banner ' + S.msg.cls + '">' + esc(S.msg.text) + '</div>' : '')
        + '</section>';
    }
    function bind() {
      var q = function (id) { return document.getElementById(id); };
      if (q("slip-retry")) q("slip-retry").onclick = function () { S.missing = null; S.data = null; paint(); load(); };
      var on = q("slip-on"); if (on) on.onchange = function () { save({enabled: on.checked}, "Slip import " + (on.checked ? "on" : "off") + "."); };
      var ch = q("slip-chan"); if (ch) ch.onchange = function () { save({slips_channel_id: ch.value}, "#slips channel saved."); };
      var tg = q("slip-target"); if (tg) tg.onchange = function () { save({target_guild_id: tg.value}, "Default target saved."); };
    }
    return {load: load, view: view, bind: bind, state: function () { return S; }};
  }
  var API = {create: create, money: money, UNAVAILABLE: UNAVAILABLE};
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  root.SlipUI = API;
})(typeof window !== "undefined" ? window : globalThis);
