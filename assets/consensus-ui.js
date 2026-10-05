/* Master → Consensus tab (Phase 1.2): settings form + live "what would qualify right now" preview.
 * Uses the master page's existing card/switch/stats/table styles. Owner only (TipBot enforces it).
 * Browser global window.ConsensusUI + CommonJS export (pure helpers) for node --test.
 */
(function (root) {
  "use strict";
  // Action sheet when tb-motion.js is loaded (0.44.1); plain confirm() otherwise.
  function ask(o) {
    var W = typeof window !== "undefined" ? window : {};
    if (W.TBSheet && W.TBSheet.confirm) return W.TBSheet.confirm(o);
    return Promise.resolve(typeof W.confirm === "function" ? W.confirm(o.title + (o.message ? "\n\n" + o.message : "")) : false);
  }
  var UNAVAILABLE = "This needs TipBot’s latest deploy.";
  var NUMS = [["min_servers", "Minimum servers", 1, 100, 1], ["min_pct", "Minimum % of active servers (0 = off)", 0, 100, 1],
              ["window_hours", "Window (hours, first to last bet)", 1, 168, 1], ["line_tolerance", "Line tolerance (stat units)", 0, 20, 0.5]];

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c];
    });
  }
  /** Form values → the POST body / preview overrides. Throws a readable error on bad input. */
  function readForm(f) {
    var out = {};
    NUMS.forEach(function (n) {
      var raw = f[n[0]];
      if (raw === undefined || raw === null || raw === "") return;
      var v = Number(raw);
      if (!isFinite(v) || v < n[2] || v > n[3]) throw new Error(n[1] + " must be between " + n[2] + " and " + n[3] + ".");
      out[n[0]] = n[0] === "min_servers" ? Math.round(v) : v;
    });
    ["require_before_start", "include_multi_legs"].forEach(function (k) { if (k in f) out[k] = !!f[k]; });
    if (Array.isArray(f.sports)) {
      if (!f.sports.length) throw new Error("Pick at least one sport.");
      out.sports = f.sports.slice().sort();
    }
    if (f.show_sources) out.show_sources = f.show_sources;
    return out;
  }
  function previewQuery(body) {
    var q = [];
    Object.keys(body).sort().forEach(function (k) {
      var v = body[k];
      if (k === "show_sources") return; // display only; no effect on what qualifies
      if (Array.isArray(v)) v = v.join(",");
      else if (typeof v === "boolean") v = v ? "1" : "0";
      q.push(encodeURIComponent(k) + "=" + encodeURIComponent(String(v)));
    });
    return "/api/consensus/preview" + (q.length ? "?" + q.join("&") : "");
  }
  function summary(p) {
    if (!p) return "";
    return p.qualifying + " qualif" + (p.qualifying === 1 ? "ies" : "y") + " · need " + p.needed + " of " + p.active_servers + " active server" + (p.active_servers === 1 ? "" : "s");
  }

  function create(opts) {
    var call = opts.call, paint = opts.paint, when = opts.when || function (t) { return t || ""; };
    var S = {data: null, preview: null, form: null, busy: false, msg: null, missing: null};
    function formFromSettings(s) {
      return {min_servers: s.min_servers, min_pct: s.min_pct, window_hours: s.window_hours, line_tolerance: s.line_tolerance,
              require_before_start: s.require_before_start, include_multi_legs: s.include_multi_legs,
              sports: (s.sports || []).slice(), show_sources: s.show_sources};
    }
    async function load() {
      S.missing = null;
      var r = await call("/api/consensus/settings");
      if ([404, 405, 501].indexOf(r._status) !== -1) { S.missing = UNAVAILABLE; paint(); return; }
      if (!r.ok) { S.missing = r.error === "bot_not_ready" ? "TipBot is still starting. Retry in a few seconds." : (r.error || "Couldn’t load consensus settings."); paint(); return; }
      S.data = r; S.form = formFromSettings(r.settings); paint();
      runPreview();
    }
    async function runPreview() {
      var body;
      try { body = readForm(S.form); } catch (e) { S.msg = {cls: "err", text: e.message}; paint(); return; }
      S.preview = "loading"; paint();
      var r = await call(previewQuery(body));
      if ([404, 405, 501].indexOf(r._status) !== -1) S.preview = {missing: UNAVAILABLE};
      else S.preview = r.ok ? r : {missing: r.error || "Couldn’t load the preview."};
      paint();
    }
    async function save(body, label) {
      S.busy = true; S.msg = null; paint();
      var r = await call("/api/consensus/settings", body);
      S.busy = false;
      if (r.ok) { S.data.settings = r.settings; S.form = formFromSettings(r.settings); S.msg = {cls: "ok", text: label}; }
      else S.msg = {cls: "err", text: [404, 405, 501].indexOf(r._status) !== -1 ? UNAVAILABLE : (r.error || "Couldn’t save")};
      paint();
      if (r.ok) runPreview();
    }
    function view() {
      if (S.missing) return '<section class="card empty"><b>Consensus isn’t available.</b><p>' + esc(S.missing) + '</p><p><button class="btn ghost" id="cons-retry">Retry</button></p></section>';
      if (!S.data) return '<section class="card empty">Loading consensus…</section>';
      var s = S.data.settings, g = S.data.gates || {}, f = S.form, dis = S.busy ? " disabled" : "";
      var blocked = g.kill_switch || !g.beta_enabled || !g.master_verified;
      var why = g.kill_switch ? "MASTER_BETA_DISABLE is set on TipBot, so consensus is forced off." : (!g.beta_enabled ? "Turn the master beta on first (needed before anything posts)." : (!g.master_verified ? "Pick and verify a master first (needed before anything posts)." : ""));
      var h = '<section class="card"><h2>Consensus</h2>'
        + '<label class="switch"><input type="checkbox" id="cons-on"' + (s.enabled ? " checked" : "") + dis + '> Consensus on</label>'
        + '<label class="switch" style="margin-top:8px"><input type="checkbox" id="cons-dry"' + (s.dry_run ? " checked" : "") + (dis || (blocked && s.dry_run ? " disabled" : "")) + '> Dry run (preview only, nothing posts)</label>'
        + '<label class="switch" style="margin-top:8px"><input type="checkbox" id="cons-pause"' + (s.paused ? " checked" : "") + dis + '> Paused</label>'
        + '<p class="note">' + (why ? "<b>" + esc(why) + "</b> " : "") + 'When the same bet shows up in enough different servers before the game, TipBot posts one consensus tip in <code>#consensus</code> (TipBot Consensus category, created in the master the first time it posts) and keeps it updated: live edits, “Locked at bounce” at the start, then the result. Consensus bets never touch follows, bankrolls or leaderboards.</p></section>';
      h += '<section class="card"><h2>What counts</h2><div class="access-form">'
        + NUMS.map(function (n) {
          return '<label>' + esc(n[1]) + '<input type="number" class="cons-num" data-k="' + n[0] + '" min="' + n[2] + '" max="' + n[3] + '" step="' + n[4] + '" value="' + esc(f[n[0]]) + '"' + dis + '></label>';
        }).join("")
        + '<label class="switch"><input type="checkbox" class="cons-bool" data-k="require_before_start"' + (f.require_before_start ? " checked" : "") + dis + '> Only bets posted before the game starts</label>'
        + '<label class="switch"><input type="checkbox" class="cons-bool" data-k="include_multi_legs"' + (f.include_multi_legs ? " checked" : "") + dis + '> Count legs inside multis</label>'
        + '<div><div class="stat-l" style="margin-bottom:6px">Sports</div><div class="pills">' + (S.data.sports_available || []).map(function (sp) {
          return '<label class="pill' + (f.sports.indexOf(sp) !== -1 ? " on" : "") + '" style="display:inline-flex;align-items:center"><input type="checkbox" class="cons-sport" value="' + esc(sp) + '"' + (f.sports.indexOf(sp) !== -1 ? " checked" : "") + dis + ' style="margin:0 4px 0 0">' + esc(sp) + '</label>';
        }).join("") + '</div></div>'
        + '<label>Show on the post<select id="cons-show"' + dis + '>' + (S.data.show_sources_options || []).map(function (o) {
          var lab = {servers_and_tipsters: "Servers and tipsters", servers_only: "Servers only", anonymous: "Counts only"}[o] || o;
          return '<option value="' + esc(o) + '"' + (f.show_sources === o ? " selected" : "") + '>' + esc(lab) + '</option>';
        }).join("") + '</select></label>'
        + '<div class="row"><button class="btn ghost" id="cons-preview"' + dis + '>Preview with these settings</button><button class="btn" id="cons-save"' + dis + '>Save settings</button></div></div>'
        + '<p class="note">Same bet = same game, same player (or team) and market, same Over/Under, and the same line after the half-point rule (20 = 19.5 = 20+). Each server counts once, however many tipsters posted it.</p></section>';
      var p = S.preview;
      h += '<section class="card"><h2>What would qualify right now</h2>';
      if (p === "loading" || p === null) h += '<div class="empty">Loading preview…</div>';
      else if (p.missing) h += '<div class="empty">' + esc(p.missing) + '</div>';
      else {
        h += '<p class="note" style="margin:0 0 8px">' + esc(summary(p)) + ' · ' + esc(p.legs_considered) + ' legs considered'
          + (p.late_sources ? ' · ' + esc(p.late_sources) + ' posted after the start (never count)' : '') + '</p>';
        var un = p.unmatched || {}, unTotal = Object.keys(un).reduce(function (a, k) { return a + (un[k] || 0); }, 0);
        if (unTotal) h += '<p class="note" style="margin:0 0 8px">Unmatched legs: ' + Object.keys(un).filter(function (k) { return un[k]; }).map(function (k) { return esc(un[k] + " " + k); }).join(" · ") + '</p>';
        var list = (p.clusters || []).filter(function (c) { return c.count > 1 || c.qualifies; });
        h += !list.length ? '<div class="empty">No bet is shared by two or more servers yet.</div>'
          : '<div class="access-table"><table><thead><tr><th>Bet</th><th>Game</th><th>Servers</th><th>Lines seen</th><th></th></tr></thead><tbody>'
            + list.map(function (c) {
              return '<tr><td><b>' + esc(c.label) + '</b><div class="stat-l">' + esc(c.sport) + '</div></td><td>' + esc(c.game_label) + (c.game_start ? '<div class="stat-l">' + esc(when(c.game_start)) + '</div>' : '') + '</td>'
                + '<td>' + esc(c.count + "/" + c.needed) + '<div class="stat-l">' + esc((c.servers || []).map(function (s) { return s.name; }).join(", ")) + '</div></td>'
                + '<td>' + esc(Object.keys(c.lines_seen || {}).map(function (k) { return k + " ×" + c.lines_seen[k]; }).join(", ")) + '</td>'
                + '<td>' + (c.status ? '<span class="pill on">' + esc(c.status) + '</span>' : c.qualifies ? (c.started ? '<span class="pill off">started</span>' : '<span class="pill on">qualifies</span>') : '<span class="pill off">below</span>') + '</td></tr>';
            }).join("") + '</tbody></table></div>';
      }
      h += '</section>';
      return h + (S.msg ? '<div class="banner ' + S.msg.cls + '">' + esc(S.msg.text) + '</div>' : '');
    }
    function collect() {
      document.querySelectorAll(".cons-num").forEach(function (i) { S.form[i.dataset.k] = i.value; });
      document.querySelectorAll(".cons-bool").forEach(function (i) { S.form[i.dataset.k] = i.checked; });
      S.form.sports = Array.prototype.slice.call(document.querySelectorAll(".cons-sport:checked")).map(function (i) { return i.value; });
      var sh = document.getElementById("cons-show"); if (sh) S.form.show_sources = sh.value;
    }
    function bind() {
      var q = function (id) { return document.getElementById(id); };
      if (q("cons-retry")) q("cons-retry").onclick = function () { S.data = null; paint(); load(); };
      if (q("cons-preview")) q("cons-preview").onclick = function () { collect(); S.msg = null; runPreview(); };
      if (q("cons-save")) q("cons-save").onclick = function () {
        collect();
        var body;
        try { body = readForm(S.form); } catch (e) { S.msg = {cls: "err", text: e.message}; paint(); return; }
        save(body, "Consensus settings saved.");
      };
      document.querySelectorAll(".cons-sport").forEach(function (i) { i.onchange = function () { collect(); paint(); }; });
      var on = q("cons-on"); if (on) on.onchange = async function () {
        if (!(await ask({title: "Turn consensus " + (on.checked ? "on" : "off") + "?", message: on.checked ? "With dry run on, it only previews." : "",
          confirmLabel: on.checked ? "Turn on" : "Turn off"}))) { paint(); return; }
        save({enabled: on.checked}, "Consensus " + (on.checked ? "on" : "off") + ".");
      };
      var dry = q("cons-dry"); if (dry) dry.onchange = async function () {
        if (!dry.checked && !(await ask({title: "Turn dry run off?", message: "TipBot will create #consensus in the master and post bets that qualify.",
          confirmLabel: "Go live"}))) { paint(); return; }
        save({dry_run: dry.checked}, dry.checked ? "Dry run on: preview only." : "Dry run off: qualifying bets will post.");
      };
      var pz = q("cons-pause"); if (pz) pz.onchange = function () {
        save({paused: pz.checked}, pz.checked ? "Paused." : "Resumed.");
      };
    }
    return {load: load, view: view, bind: bind, state: function () { return S; }};
  }

  var API = {create: create, readForm: readForm, previewQuery: previewQuery, summary: summary, UNAVAILABLE: UNAVAILABLE};
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  root.ConsensusUI = API;
})(typeof window !== "undefined" ? window : globalThis);
