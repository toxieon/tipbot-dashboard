/* Server settings -> Command access -> Stat tracker (TipBot 0.92.25+): which Horse Predictor
 * models this server's stat tracker counts. GET /api/server/predictor-tracker,
 * POST /api/server/predictor-tracking (owner / server admin). Default: every model on.
 * A filter only: picks keep posting and nothing stored changes. window.TBStatTracker + CommonJS.
 */
(function (root) {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function units(u) {
    var n = Number(u) || 0;
    return (n > 0 ? "+" : n < 0 ? "\u2212" : "") + Math.abs(n).toFixed(2) + "u";
  }
  function record(m) {
    if (!m || !m.tracked || m.wins == null) return "";
    return m.wins + "-" + m.losses + " \u00b7 " + units(m.units);
  }
  /** The tracked keys from the toggles' state, in the models' order. */
  function trackedKeys(models, state) {
    return (models || []).filter(function (m) { return !!state[m.key]; }).map(function (m) { return m.key; });
  }
  function dirty(view, state) {
    var want = trackedKeys(view.models, state).join(","), have = (view.tracked || []).join(",");
    return want !== have;
  }

  function html(view, state, opts) {
    opts = opts || {};
    var edit = !!view.can_edit, models = view.models || [];
    var on = trackedKeys(models, state);
    var out = '<div class="stm" id="stm">'
      + '<div class="stm-cap">Stat tracker</div>'
      + '<div class="stm-lead">Horse Predictor models this server\u2019s stat tracker counts. Picks keep posting to their channels either way; this only changes what the tracker, its tallies and the weekly summary count.</div>'
      + '<div class="stm-list" role="group" aria-label="Models the stat tracker counts">';
    models.forEach(function (m) {
      var isOn = !!state[m.key], rec = record(m);
      out += '<div class="switch stm-row">'
        + '<button type="button" class="toggle stm-t' + (isOn ? " on" : "") + '" data-k="' + esc(m.key) + '" role="switch" aria-checked="' + (isOn ? "true" : "false") + '" aria-label="' + esc(m.label) + '"' + (edit ? "" : " disabled") + '></button>'
        + '<span class="stm-txt"><b>' + esc(m.label) + '</b><span>' + esc(m.description || "") + '</span></span>'
        + '<span class="stm-rec">' + (rec ? esc(rec) : (m.tracked ? "No days yet" : "Not tracked")) + '</span>'
        + '</div>';
    });
    out += '</div>';
    var t = view.totals || {};
    out += '<div class="stm-tot">Last ' + esc(view.days || 30) + ' days, tracked models: <b>' + esc((t.wins || 0) + "-" + (t.losses || 0)) + '</b> \u00b7 <b class="' + ((t.units || 0) >= 0 ? "pos" : "neg") + '">' + esc(units(t.units)) + '</b></div>';
    if (!on.length) out += '<div class="stm-warn" role="status">No models selected: the tracker will count nothing.</div>';
    if (edit) {
      out += '<div class="stm-act"><button class="btn sm" id="stm-save"' + (dirty(view, state) ? "" : " disabled") + '>Save tracker</button>'
        + '<button type="button" class="ghost sm" id="stm-all">All on</button>'
        + '<span id="stm-msg" class="stm-msg" role="status">' + esc(opts.msg || "") + '</span></div>';
    } else {
      out += '<div class="stm-note">Only the owner or a server admin can change this.</div>';
    }
    return out + '</div>';
  }

  var CSS = ".stm{margin-top:20px;padding-top:14px;border-top:1px solid var(--line)}"
    + ".stm-cap{color:var(--faint);font-size:var(--t-cap);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px}"
    + ".stm-lead,.stm-note{color:var(--faint);font-size:var(--t-foot);line-height:1.4;margin-bottom:10px}"
    + ".stm-list{display:flex;flex-direction:column;gap:8px}"
    + ".stm-row{justify-content:flex-start;gap:12px}"
    + ".stm-txt{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}"
    + ".stm-txt b{font-size:var(--t-callout);font-weight:600}"
    + ".stm-txt span{color:var(--faint);font-size:var(--t-foot);line-height:1.3}"
    + ".stm-rec{color:var(--muted);font-size:var(--t-foot);font-variant-numeric:tabular-nums;white-space:nowrap;text-align:right}"
    + ".stm-tot{margin-top:10px;font-size:var(--t-foot);color:var(--muted)}"
    + ".stm-warn{margin-top:8px;font-size:var(--t-foot);color:var(--loss)}"
    + ".stm-act{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:12px}"
    + ".stm-msg{font-size:var(--t-foot)}"
    + ".stm-t[disabled]{cursor:not-allowed;opacity:.6}";
  function injectCss() {
    var doc = root.document;
    if (!doc || doc.getElementById("stm-css")) return;
    var st = doc.createElement("style");
    st.id = "stm-css"; st.textContent = CSS;
    doc.head.appendChild(st);
  }

  /** True when the server has a Horse Predictor tally to show: a saved choice, or a recap
      in the window for a tracked model. A server without the predictor has neither. */
  function hasTally(v) {
    if (!v || !v.ok || !Array.isArray(v.models)) return false;
    if (v.updated_at) return true;
    return v.models.some(function (m) { return m && m.tracked && Number(m.days) > 0; });
  }

  /** opts: {api(path, init) -> Response, gid, onUnauth}. Renders nothing on an older TipBot
      (404) or a server with no Horse Predictor tally (no end-of-day recap in the window and no
      saved choice). */
  function mount(box, opts) {
    if (!box) return Promise.resolve(null);
    injectCss();
    var gid = String(opts.gid);
    var state = {}, view = null;
    function paint(msg, ok) {
      if (!box.isConnected && root.document) return;
      box.innerHTML = html(view, state, { msg: msg });
      var m = box.querySelector("#stm-msg");
      if (m && msg) m.style.color = ok ? "var(--win)" : "var(--loss)";
      box.querySelectorAll(".stm-t").forEach(function (b) {
        b.onclick = function () { if (b.disabled) return; state[b.dataset.k] = !state[b.dataset.k]; paint(); };
      });
      var all = box.querySelector("#stm-all");
      if (all) all.onclick = function () { (view.models || []).forEach(function (mm) { state[mm.key] = true; }); paint(); };
      var save = box.querySelector("#stm-save");
      if (save) save.onclick = function () { doSave(save); };
    }
    function take(v) {
      view = v; state = {};
      (v.models || []).forEach(function (m) { state[m.key] = !!m.tracked; });
    }
    function doSave(btn) {
      btn.disabled = true;
      var body = JSON.stringify({ guild_id: gid, tracked: trackedKeys(view.models, state) });
      return opts.api("/api/server/predictor-tracking", { method: "POST", headers: { "Content-Type": "application/json" }, body: body })
        .then(function (r) { return r.json().then(function (j) { return { r: r, j: j }; }); })
        .then(function (x) {
          if (x.r.ok && x.j && x.j.ok) { take(x.j); paint("\u2713 saved", true); }
          else paint((x.j && (x.j.message || x.j.error)) || "Couldn\u2019t save.", false);
        })
        .catch(function (e) {
          if (e && e.unauth && opts.onUnauth) return opts.onUnauth();
          paint("Couldn\u2019t reach the bot.", false);
        });
    }
    return opts.api("/api/server/predictor-tracker?guild_id=" + encodeURIComponent(gid))
      .then(function (r) {
        if (!r.ok) return null;
        return r.json();
      })
      .then(function (v) {
        if (!hasTally(v)) { box.innerHTML = ""; return null; }
        take(v); paint();
        return v;
      })
      .catch(function (e) {
        if (e && e.unauth && opts.onUnauth) opts.onUnauth();
        box.innerHTML = "";
        return null;
      });
  }

  var api = { mount: mount, hasTally: hasTally, html: html, trackedKeys: trackedKeys, record: record, units: units, dirty: dirty, injectCss: injectCss };
  if (typeof module === "object" && module.exports) module.exports = api;
  root.TBStatTracker = api;
})(typeof window !== "undefined" ? window : globalThis);
