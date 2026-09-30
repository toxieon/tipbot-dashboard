/* Server page → Scheduled Tips (0.41.1): this server's queued / scheduled tips that
 * haven't posted yet, with Cancel, Adjust odds and Edit (legs, stake, bookmaker).
 * Every action goes through TipBot (/api/scheduled-tip), which updates the queue and
 * the forwarded master copy. A tip that already posted comes back as 409 with a
 * clear message. Browser global window.TBScheduled + CommonJS export for node --test.
 */
(function (root) {
  "use strict";
  var UNAVAILABLE = "Scheduled tips need TipBot’s latest deploy.";
  var POLL_MS = 30000;

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c];
    });
  }
  function rel(iso, now) {
    var t = Date.parse(iso || "");
    if (!isFinite(t)) return "";
    var s = Math.round((t - (now == null ? Date.now() : now)) / 1000);
    if (s <= 30) return "any moment";
    var m = Math.round(s / 60);
    if (m < 60) return "in " + m + " min";
    var h = Math.floor(m / 60), mm = m % 60;
    if (h < 24) return "in " + h + " h" + (mm ? " " + mm + " min" : "");
    return "in " + Math.round(h / 24) + " d";
  }
  function num(v) { var n = Number(v); return isFinite(n) ? n : null; }
  function fmtOdds(v) { var n = num(v); return n == null ? "" : n.toFixed(2); }

  /** The POST body for an edit: only what changed. Throws a readable error on bad input. */
  function editBody(tip, form) {
    var body = {guild_id: String(form.guild_id || ""), tip_id: tip.tip_id, action: "edit"};
    var changed = false;
    if (form.odds !== undefined && String(form.odds).trim() !== "") {
      var o = num(form.odds);
      if (o == null || o <= 1) throw new Error("Odds must be a number above 1.00.");
      if (Math.abs(o - (num(tip.odds) || 0)) > 1e-9) { body.odds = o; changed = true; }
    }
    if (form.units !== undefined && String(form.units).trim() !== "") {
      var u = num(form.units);
      if (u == null || u <= 0) throw new Error("Stake must be above zero.");
      if (Math.abs(u - (num(tip.units) || 0)) > 1e-9) { body.units = u; changed = true; }
    }
    if (form.bookmaker !== undefined) {
      var b = String(form.bookmaker || "").trim();
      if (b && b !== String(tip.bookmaker || "")) { body.bookmaker = b; changed = true; }
    }
    if (form.legs) {
      var legs = [];
      (tip.legs || []).forEach(function (l) {
        var k = String(l.position);
        if (!(k in form.legs)) return;
        var text = String(form.legs[k] || "").replace(/\s+/g, " ").trim();
        if (!text) throw new Error("A leg can’t be empty. Cancel the tip instead.");
        if (text !== String(l.description || "")) legs.push({position: l.position, description: text});
      });
      if (legs.length) { body.legs = legs; changed = true; }
    }
    if (!changed) throw new Error("Nothing changed.");
    return body;
  }

  function create(ctx) {
    var S = {tips: null, missing: null, err: null, busy: null, open: {}, msg: null};
    var when = ctx.when || function (t) { return t || ""; };
    var paint = ctx.paint || function () {};
    async function call(path, body) {
      var r = await ctx.api(path, body ? {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(body)} : undefined);
      var j = {};
      try { j = await r.json(); } catch (e) { j = {}; }
      j._status = r.status;
      if (j.ok === undefined) j.ok = r.ok;
      return j;
    }
    async function load() {
      try {
        var r = await call("/api/scheduled-tips?guild_id=" + encodeURIComponent(ctx.gid));
        if ([404, 405, 501].indexOf(r._status) !== -1) { S.missing = UNAVAILABLE; S.tips = null; }
        else if (!r.ok) { S.err = r.message || r.error || "Couldn’t load scheduled tips."; }
        else { S.missing = null; S.err = null; S.tips = r.tips || []; }
      } catch (e) {
        if (e && e.unauth) { if (ctx.onUnauth) ctx.onUnauth(); return; }
        S.err = "Couldn’t reach the bot.";
      }
      paint();
    }
    function find(id) { return (S.tips || []).find(function (t) { return t.tip_id === id; }); }
    async function act(tipId, body, okText) {
      S.busy = tipId; S.msg = null; paint();
      var r;
      try { r = await call("/api/scheduled-tip", body); }
      catch (e) {
        S.busy = null;
        if (e && e.unauth) { if (ctx.onUnauth) ctx.onUnauth(); return; }
        S.msg = {tip: tipId, cls: "err", text: "Couldn’t reach the bot."}; paint(); return;
      }
      S.busy = null;
      if (r.ok) {
        delete S.open[tipId];
        S.msg = {tip: body.action === "cancel" ? null : tipId, cls: "ok", text: okText};
        if (ctx.onChange) try { ctx.onChange(body.action, tipId); } catch (e) {}
        await load();
        return r;
      }
      var text = [404, 405, 501].indexOf(r._status) !== -1 && !r.message ? UNAVAILABLE : (r.message || "Couldn’t save.");
      S.msg = {tip: tipId, cls: "err", text: text};
      if (r._status === 409 || r._status === 404) { delete S.open[tipId]; await load(); } else paint();
      return r;
    }
    function cancel(tipId) {
      return act(tipId, {guild_id: String(ctx.gid), tip_id: tipId, action: "cancel"}, "Cancelled. It won’t post, and the master copy is removed.");
    }
    function save(tipId, form) {
      var tip = find(tipId); if (!tip) return null;
      var body;
      try { body = editBody(tip, Object.assign({guild_id: ctx.gid}, form)); }
      catch (e) { S.msg = {tip: tipId, cls: "err", text: e.message}; paint(); return null; }
      return act(tipId, body, "Updated. The master copy updates too.");
    }
    function openForm(tipId, mode) { S.open[tipId] = mode; S.msg = null; paint(); }
    function closeForm(tipId) { delete S.open[tipId]; paint(); }

    function tipHTML(t) {
      var id = esc(t.tip_id), mode = S.open[t.tip_id], busy = S.busy === t.tip_id, dis = (busy || t.releasing) ? " disabled" : "";
      var h = '<div class="sched-tip" data-tip="' + id + '" style="border:1px solid var(--line);border-radius:12px;padding:12px;margin-bottom:10px;background:var(--card2)">'
        + '<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:baseline">'
        + '<div><b>' + esc(t.display_id || t.tip_id) + '</b>' + (t.game_name ? ' <span style="color:var(--muted)">· ' + esc(t.game_name) + '</span>' : '') + '</div>'
        + '<div class="sched-when" style="font-size:13px">' + (t.releasing ? '<b>Posting now…</b>' : '⏰ Posts <b>' + esc(when(t.post_at)) + '</b> <span style="color:var(--faint)">(' + esc(rel(t.post_at)) + ')</span>') + '</div></div>'
        + '<ul style="margin:8px 0;padding-left:18px">' + (t.legs || []).map(function (l) { return '<li>' + esc(l.description) + '</li>'; }).join("") + '</ul>'
        + '<div style="font-size:13px;color:var(--muted)">@ <b class="sched-odds">' + esc(fmtOdds(t.odds)) + '</b> · ' + esc(t.units) + 'u · ' + esc(t.bookmaker || "")
        + (t.has_image ? ' · 📷 image' : '') + (t.forward && t.forward.sent ? ' · <span title="A scheduled copy is already in the master">↗ forwarded</span>' : '') + '</div>';
      if (mode === "odds") {
        h += '<div class="sched-form" style="display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap"><label style="font-size:13px">New odds <input class="sched-in-odds" type="number" step="0.01" min="1.01" value="' + esc(fmtOdds(t.odds)) + '" style="width:90px"' + dis + '></label>'
          + '<button class="btn sched-save" data-tip="' + id + '"' + dis + '>Save odds</button><button class="ghost sched-close" data-tip="' + id + '"' + dis + '>Back</button></div>';
      } else if (mode === "edit") {
        h += '<div class="sched-form" style="margin-top:10px;display:grid;gap:8px">' + (t.legs || []).map(function (l) {
          return '<label style="font-size:13px">Leg ' + esc(l.position) + '<textarea class="sched-in-leg" data-pos="' + esc(l.position) + '" rows="2" style="width:100%"' + dis + '>' + esc(l.description) + '</textarea></label>';
        }).join("")
          + '<div style="display:flex;gap:8px;flex-wrap:wrap"><label style="font-size:13px">Odds <input class="sched-in-odds" type="number" step="0.01" min="1.01" value="' + esc(fmtOdds(t.odds)) + '" style="width:90px"' + dis + '></label>'
          + '<label style="font-size:13px">Stake (u) <input class="sched-in-units" type="number" step="0.25" min="0.25" value="' + esc(t.units) + '" style="width:80px"' + dis + '></label>'
          + '<label style="font-size:13px">Bookmaker <input class="sched-in-book" type="text" value="' + esc(t.bookmaker || "") + '" style="width:130px"' + dis + '></label></div>'
          + '<div style="display:flex;gap:8px"><button class="btn sched-save" data-tip="' + id + '"' + dis + '>Save changes</button><button class="ghost sched-close" data-tip="' + id + '"' + dis + '>Back</button></div></div>';
      } else {
        h += '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">'
          + '<button class="ghost sched-odds-btn" data-tip="' + id + '"' + dis + '>Adjust odds</button>'
          + '<button class="ghost sched-edit-btn" data-tip="' + id + '"' + dis + '>Edit</button>'
          + '<button class="ghost sched-cancel-btn" data-tip="' + id + '" style="color:var(--loss)"' + dis + '>Cancel tip</button></div>';
      }
      if (busy) h += '<div class="sched-msg" style="font-size:12.5px;margin-top:8px;color:var(--faint)">Saving…</div>';
      else if (S.msg && S.msg.tip === t.tip_id) h += '<div class="sched-msg" style="font-size:12.5px;margin-top:8px;color:' + (S.msg.cls === "err" ? "var(--loss)" : "var(--win)") + '">' + esc(S.msg.text) + '</div>';
      return h + '</div>';
    }
    function view() {
      if (S.missing) return '<div class="empty">' + esc(S.missing) + '</div>';
      if (S.tips === null) return S.err ? '<div class="empty">' + esc(S.err) + '</div>' : '<div class="empty">Loading scheduled tips…</div>';
      var orphan = S.msg && (!S.msg.tip || !S.tips.some(function (t) { return t.tip_id === S.msg.tip; }));
      var top = orphan ? '<div class="sched-msg" style="font-size:12.5px;margin-bottom:8px;color:' + (S.msg.cls === "err" ? "var(--loss)" : "var(--win)") + '">' + esc(S.msg.text) + '</div>' : "";
      if (!S.tips.length) return top + '<div class="empty">No scheduled tips. Tips you queue for later show here until they post.</div>';
      return top + S.tips.map(tipHTML).join("");
    }
    return {load: load, view: view, cancel: cancel, save: save, openForm: openForm, closeForm: closeForm,
            state: function () { return S; }};
  }

  /** DOM host: paints into box, binds buttons, refreshes every 30 s while the box is on the page. */
  function mount(box, ctx) {
    var timer = null;
    var ui = create(Object.assign({}, ctx, {paint: paint}));
    function formOf(tipId) {
      var el = box.querySelector('.sched-tip[data-tip="' + (root.CSS && CSS.escape ? CSS.escape(tipId) : tipId) + '"]');
      if (!el) return {};
      var f = {}, o = el.querySelector(".sched-in-odds"), u = el.querySelector(".sched-in-units"), b = el.querySelector(".sched-in-book");
      if (o) f.odds = o.value;
      if (u) f.units = u.value;
      if (b) f.bookmaker = b.value;
      var legs = el.querySelectorAll(".sched-in-leg");
      if (legs.length) { f.legs = {}; legs.forEach(function (t) { f.legs[t.dataset.pos] = t.value; }); }
      return f;
    }
    function paint() {
      if (!box.isConnected && timer) { clearInterval(timer); timer = null; return; }
      box.innerHTML = ui.view();
      var on = function (cls, fn) { box.querySelectorAll(cls).forEach(function (b) { b.onclick = function () { fn(b.dataset.tip); }; }); };
      on(".sched-odds-btn", function (id) { ui.openForm(id, "odds"); });
      on(".sched-edit-btn", function (id) { ui.openForm(id, "edit"); });
      on(".sched-close", function (id) { ui.closeForm(id); });
      on(".sched-save", function (id) { ui.save(id, formOf(id)); });
      on(".sched-cancel-btn", function (id) {
        var t = (ui.state().tips || []).find(function (x) { return x.tip_id === id; });
        if (!confirm("Cancel " + ((t && t.display_id) || "this tip") + "? It won’t post, and the forwarded master copy is removed.")) return;
        ui.cancel(id);
      });
    }
    paint();
    ui.load();
    timer = setInterval(function () {
      if (!box.isConnected) { clearInterval(timer); timer = null; return; }
      var S = ui.state();
      if (!S.busy && !Object.keys(S.open).length && !(root.document && document.hidden)) ui.load();
    }, POLL_MS);
    return {reload: ui.load, ui: ui, stop: function () { if (timer) clearInterval(timer); timer = null; }};
  }

  var API = {create: create, mount: mount, editBody: editBody, rel: rel, UNAVAILABLE: UNAVAILABLE};
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  root.TBScheduled = API;
})(typeof window !== "undefined" ? window : globalThis);
