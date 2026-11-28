/* tipdash owner-only: Wet track shortlist (TipBot GET /api/owner/horse/wet-shortlist).
 * Private asset (build-public ASSET_DENY). Mounted by the Horses page when the signed-in owner ticks
 * "Wet track shortlist". Every Australian race today in three columns (With, Without, Agree), run races
 * marked with a tick or a cross, plus a day tally per column. Read-only. Prediction only, not betting advice.
 * Plain script (window.TBWetShortlist) and CommonJS for node --test.
 */
(function (root) {
  "use strict";

  var PATH = "/api/owner/horse/wet-shortlist";
  var REFRESH_MS = 120000;
  var COLS = [["with_price", "With"], ["without_price", "Without"], ["agree", "Agree"]];

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function price(v) {
    var n = Number(v);
    return isFinite(n) && n > 1 ? "$" + (n >= 10 ? n.toFixed(0) : n.toFixed(2).replace(/0$/, "")) : "";
  }
  function units(v) {
    var n = Number(v);
    if (!isFinite(n)) return "0.0u";
    return (n > 0 ? "+" : "") + n.toFixed(1) + "u";
  }
  function startText(iso) {
    try {
      return new Date(iso).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", timeZone: "Australia/Melbourne" });
    } catch (e) { return ""; }
  }
  function going(tc) {
    var m = /^([A-Za-z ]+?)\s*(\d{1,2})?$/.exec(String(tc || "").trim());
    return m ? (m[1] + (m[2] ? " " + m[2] : "")).trim() : String(tc || "").trim();
  }
  function wetText(w) {
    return w.starts + " wet \u00B7 " + w.wins + "W " + w.places + "P";
  }
  function mark(e) {
    return e.won === true ? "\u2705" : e.won === false ? "\u274C" : "\u2022";
  }
  function entryHtml(e) {
    var cls = e.won === true ? " ws-win" : e.won === false ? " ws-lose" : "";
    var label = e.won === true ? "Won" : e.won === false ? "Did not win" : "Not run yet";
    return '<li class="ws-ent' + cls + '"><span class="ws-mk" role="img" aria-label="' + label + '">' + mark(e) + "</span>"
      + '<span class="ws-who"><span class="ws-nm">' + (e.number != null ? "<b>" + esc(e.number) + "</b> " : "") + esc(e.name) + "</span>"
      + '<span class="ws-sub">' + esc([price(e.price), wetText(e.wet || { wins: 0, places: 0, starts: 0 }), e.stays ? "stays" : ""].filter(Boolean).join(" \u00B7 ")) + "</span></span></li>";
  }
  function colHtml(r, key, label) {
    var list = (r.columns && r.columns[key]) || [];
    return '<div class="ws-col" data-col="' + key + '"><div class="ws-ch">' + label + "</div>"
      + (list.length ? '<ul class="ws-list">' + list.map(entryHtml).join("") + "</ul>" : '<div class="ws-none">\u2014</div>') + "</div>";
  }
  function raceHtml(r) {
    var head = esc((r.track || "") + " R" + (r.race_number || "?"));
    var meta = [startText(r.start), r.distance ? r.distance + "m" : "", going(r.track_condition)].filter(Boolean).join(" \u00B7 ");
    var state = r.status === "run"
      ? (r.winner ? '<span class="ws-won">Won: ' + (r.winner.number != null ? esc(r.winner.number) + " " : "") + esc(r.winner.name) + (price(r.winner.price) ? " " + price(r.winner.price) : "") + "</span>" : '<span class="ws-won">Run</span>')
      : '<span class="ws-up">Upcoming</span>';
    return '<section class="ws-race" data-race="' + esc(r.id) + '" data-status="' + esc(r.status) + '">'
      + '<div class="ws-rh"><b>' + head + '</b><span class="ws-meta">' + esc(meta) + "</span>" + state + "</div>"
      + (r.note ? '<div class="ws-note">' + esc(r.note) + "</div>" : "")
      + '<div class="ws-cols">' + COLS.map(function (c) { return colHtml(r, c[0], c[1]); }).join("") + "</div></section>";
  }
  function tallyHtml(t) {
    return '<div class="ws-tally" aria-label="Day tally, 1u win on each first pick">'
      + COLS.map(function (c) {
        var x = (t && t[c[0]]) || { bets: 0, wins: 0, losses: 0, units: 0, pending: 0 };
        return '<div class="ws-tcard" data-tally="' + c[0] + '"><div class="ws-tn">' + c[1] + '</div><div class="ws-tv">' + x.wins + "-" + x.losses + "</div>"
          + '<div class="ws-tu' + (x.units < 0 ? " neg" : x.units > 0 ? " pos" : "") + '">' + units(x.units) + "</div></div>";
      }).join("") + "</div>";
  }
  function render(body) {
    if (!body || !body.races) return '<div class="ws-empty" role="status">Nothing to show yet.</div>';
    var rows = body.races;
    return '<div class="ws-head"><p class="ws-lead">' + esc(body.run) + " run \u00B7 " + esc(body.upcoming) + " to go \u00B7 Australia only. \u2705 won, \u274C did not win. Tally is 1u win on each column's first pick at the closing price.</p>"
      + '<button type="button" class="btn sm" id="ws-refresh">Refresh</button></div>'
      + tallyHtml(body.tally)
      + '<details class="ws-rule"><summary>How the shortlist is picked</summary><p>' + esc(body.rule || "") + "</p></details>"
      + (rows.length ? rows.map(raceHtml).join("") : '<div class="ws-empty" role="status">No Australian races found for today.</div>')
      + '<p class="ws-foot">Prediction only \u2014 not betting advice.</p>';
  }

  function cssText() {
    return ""
      + ".ws{min-width:0;max-width:100%;overflow-x:clip}"
      + ".ws .ws-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin:0 0 10px}"
      + ".ws .ws-lead{margin:0;color:var(--muted);font-size:var(--t-sub,.9rem)}"
      + ".ws .ws-head .btn{flex:none}"
      + ".ws .ws-tally{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0 0 10px}"
      + ".ws .ws-tcard{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:8px 6px;text-align:center}"
      + ".ws .ws-tn{color:var(--muted);font-size:var(--t-cap,.75rem);letter-spacing:.06em;text-transform:uppercase}"
      + ".ws .ws-tv{font-weight:800;font-size:1.15rem;font-variant-numeric:tabular-nums}"
      + ".ws .ws-tu{font-weight:700;font-variant-numeric:tabular-nums}"
      + ".ws .ws-tu.pos{color:var(--good,#3fb67a)}.ws .ws-tu.neg{color:var(--bad,#e5646b)}"
      + ".ws .ws-rule{margin:0 0 12px;color:var(--muted);font-size:var(--t-foot,.8rem)}"
      + ".ws .ws-rule summary{cursor:pointer;min-height:32px}"
      + ".ws .ws-race{background:var(--card);border:1px solid var(--line);border-radius:14px;margin:0 0 10px;padding:10px;min-width:0}"
      + ".ws .ws-rh{display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 8px;margin:0 0 8px}"
      + ".ws .ws-meta{color:var(--muted);font-size:var(--t-foot,.8rem)}"
      + ".ws .ws-won,.ws .ws-up{flex-basis:100%;font-size:var(--t-foot,.8rem);color:var(--muted)}"
      + ".ws .ws-won{color:var(--txt)}"
      + ".ws .ws-note{color:var(--muted);font-size:var(--t-foot,.8rem);margin:0 0 6px}"
      + ".ws .ws-cols{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}"
      + ".ws .ws-col{min-width:0;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:6px}"
      + ".ws .ws-ch{color:var(--muted);font-size:var(--t-cap,.75rem);letter-spacing:.06em;text-transform:uppercase;margin:0 0 4px}"
      + ".ws .ws-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}"
      + ".ws .ws-ent{display:flex;gap:4px;align-items:flex-start;min-width:0}"
      + ".ws .ws-mk{flex:none;width:1.2em;font-size:.85rem;line-height:1.25}"
      + ".ws .ws-who{min-width:0;display:flex;flex-direction:column}"
      + ".ws .ws-nm{font-weight:700;font-size:.82rem;line-height:1.2;overflow-wrap:anywhere}"
      + ".ws .ws-sub{color:var(--muted);font-size:.7rem;line-height:1.25;overflow-wrap:anywhere}"
      + ".ws .ws-win .ws-nm{color:var(--good,#3fb67a)}"
      + ".ws .ws-none{color:var(--faint,var(--muted));text-align:center;padding:2px 0}"
      + ".ws .ws-empty{color:var(--muted);text-align:center;padding:24px 12px}"
      + ".ws .ws-foot{color:var(--faint,var(--muted));font-size:var(--t-foot,.8rem);margin:8px 0 0}"
      + "@media (min-width:700px){.ws .ws-nm{font-size:.92rem}.ws .ws-sub{font-size:.78rem}.ws .ws-col{padding:8px}}";
  }
  function injectCss() {
    var doc = root.document;
    if (!doc || doc.getElementById("ws-css")) return;
    var s = doc.createElement("style");
    s.id = "ws-css";
    s.textContent = cssText();
    (doc.head || doc.documentElement).appendChild(s);
  }

  var seq = 0;
  var timer = null;

  function stop() {
    seq++;
    if (timer != null) { try { root.clearInterval(timer); } catch (e) {} timer = null; }
  }

  async function fetchBody(call) {
    var r = await call(PATH);
    if (r.status === 401) throw Object.assign(new Error("Session expired."), { unauth: true });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok || j.ok === false) throw new Error(r.status === 404 ? "Not available." : "Couldn't load the shortlist. Try again shortly.");
    return j;
  }

  function mount(box, opt) {
    opt = opt || {};
    stop();
    injectCss();
    var mine = seq;
    box.innerHTML = '<div class="ws" id="ws-app"><div class="ws-empty" role="status">Loading\u2026</div></div>';
    var app = box.querySelector("#ws-app");
    function alive() { return mine === seq && box.isConnected !== false && !box.hidden; }
    async function load(quiet) {
      try {
        var body = await fetchBody(opt.call);
        if (!alive()) return;
        var keep = root.scrollY || 0;
        app.innerHTML = render(body);
        var btn = app.querySelector("#ws-refresh");
        if (btn) btn.onclick = function () { btn.disabled = true; load(false); };
        if (quiet && root.scrollTo) root.scrollTo(0, keep);
      } catch (e) {
        if (!alive()) return;
        if (e && e.unauth) { stop(); if (opt.onUnauth) opt.onUnauth(); return; }
        if (!quiet || !app.querySelector(".ws-race")) {
          app.innerHTML = '<div class="ws-empty" role="status">' + esc((e && e.message) || "Couldn't load the shortlist.")
            + '</div><div style="text-align:center"><button type="button" class="btn sm" id="ws-retry">Try again</button></div>';
          var rt = app.querySelector("#ws-retry");
          if (rt) rt.onclick = function () { load(false); };
        }
      }
    }
    timer = root.setInterval(function () { if (alive()) load(true); else stop(); }, opt.intervalMs || REFRESH_MS);
    return load(false);
  }

  var api = { PATH: PATH, render: render, raceHtml: raceHtml, tallyHtml: tallyHtml, cssText: cssText, injectCss: injectCss, mount: mount, stop: stop, REFRESH_MS: REFRESH_MS };
  root.TBWetShortlist = api;
  if (root.TD && root.TD.loaded) root.TD.loaded["wet-shortlist"] = true;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
