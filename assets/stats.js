/* Home Stats screen: ROI, units, streaks and breakdowns from the tips
 * the dashboard already loads. No new endpoints. Hand-written SVG via SvgCharts
 * when present, with a local polyline fallback. window.TBDashStats + CommonJS.
 */
(function (root) {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c];
    });
  }
  function num(v) {
    if (v == null || v === "") return null;
    var n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  function round1(n) { return Math.round(Number(n) * 10) / 10; }
  function round2(n) { return Math.round(Number(n) * 100) / 100; }
  function clock() {
    var g = typeof globalThis !== "undefined" ? globalThis : {};
    if (g.TBTime && typeof g.TBTime.toMs === "function") return g.TBTime;
    if (typeof require === "function") {
      try { return require("./tbtime.js"); } catch (e) {}
    }
    return null;
  }
  function sportsApi() {
    var g = typeof globalThis !== "undefined" ? globalThis : {};
    if (g.TBSports && typeof g.TBSports.mark === "function") return g.TBSports;
    if (typeof require === "function") {
      try { return require("./sport-marks.js"); } catch (e) {}
    }
    return null;
  }
  function chartsApi() {
    var g = typeof globalThis !== "undefined" ? globalThis : {};
    if (g.SvgCharts && typeof g.SvgCharts.areaChart === "function") return g.SvgCharts;
    if (typeof require === "function") {
      try { return require("./svg-charts.js"); } catch (e) {}
    }
    return null;
  }
  function serverView() {
    var g = typeof globalThis !== "undefined" ? globalThis : {};
    if (g.ServerView) return g.ServerView;
    if (typeof require === "function") {
      try { return require("./server-view.js"); } catch (e) {}
    }
    return null;
  }
  function reducedMotion() {
    var g = typeof globalThis !== "undefined" ? globalThis : {};
    if (g.TBMotion && typeof g.TBMotion.reduced === "function") return !!g.TBMotion.reduced();
    try { return !!(g.matchMedia && g.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; }
  }

  function isHistoricalImport(tip) {
    var SV = serverView();
    if (SV && typeof SV.isHistoricalImport === "function") return SV.isHistoricalImport(tip);
    if (!tip || typeof tip !== "object") return false;
    if (tip.historical === true || tip.imported === true || tip.is_historical === true) return true;
    var src = String(tip.source || tip.origin || "").toLowerCase();
    return src === "import" || src === "historical" || src === "historical_import";
  }
  function resultOf(tip) {
    var SV = serverView();
    if (SV && typeof SV.resultOf === "function") return SV.resultOf(tip);
    var raw = String(tip && (tip.result != null && tip.result !== "" ? tip.result : tip.outcome) || "").trim().toLowerCase();
    if (raw === "won" || raw === "w" || raw === "win") return "win";
    if (raw === "lost" || raw === "l" || raw === "loss") return "loss";
    if (raw === "push" || raw === "p" || raw === "void" || raw === "v") return (raw === "void" || raw === "v") ? "void" : "push";
    var p = num(tip && tip.profit_units);
    if (p != null) return p > 0 ? "win" : (p < 0 ? "loss" : "push");
    return "";
  }
  function profitOf(tip) {
    var p = num(tip.profit_units);
    if (p == null) p = num(tip.profit);
    if (p == null) p = num(tip.pl);
    if (p != null) return p;
    var res = resultOf(tip);
    var u = stakeOf(tip), o = num(tip.odds);
    if (res === "win" && u > 0 && o > 1) return round2(u * (o - 1));
    if (res === "loss" && u > 0) return round2(-u);
    return 0;
  }
  function stakeOf(tip) {
    var u = num(tip.units);
    if (u != null && u > 0) return u;
    u = num(tip.stake_units);
    return u != null && u > 0 ? u : 0;
  }
  function whenOf(tip) {
    var T = clock();
    var keys = ["settled_at", "graded_at", "result_at", "created_at", "posted_at", "date", "ts", "time"];
    for (var i = 0; i < keys.length; i++) {
      var v = tip[keys[i]];
      if (v == null || v === "") continue;
      if (T && typeof T.toMs === "function") {
        var ms = T.toMs(v);
        if (Number.isFinite(ms)) return ms;
      }
      var p = Date.parse(String(v));
      if (Number.isFinite(p)) return p;
    }
    return null;
  }
  function sportOf(tip) {
    var raw = tip.sport || tip.league || tip.comp || "";
    if (!raw && tip.tags && tip.tags.length) raw = tip.tags[0];
    raw = String(raw || "").trim();
    return raw || "Other";
  }
  function marketOf(tip) {
    var raw = tip.bet_type || tip.market || tip.market_name || "";
    if (!raw && tip.legs && tip.legs[0]) {
      raw = tip.legs[0].stat || tip.legs[0].market || tip.legs[0].sel || "";
    }
    raw = String(raw || "").trim();
    return raw || "Other";
  }
  /** Map TipBot GET /api/server/settled-summary to the detail shape Stats expects. */
  function detailFromSettledSummary(body) {
    if (!body || typeof body !== "object") return null;
    if (body.ok === false) return null;
    var settled = [];
    if (Array.isArray(body.settled)) settled = body.settled;
    else if (body.tips && Array.isArray(body.tips.settled)) settled = body.tips.settled;
    else if (Array.isArray(body.tips)) settled = body.tips;
    if (!settled.length) return { tips: { settled: [] } };
    return { tips: { settled: settled.filter(function (t) { return t && typeof t === "object"; }) } };
  }

  function settledList(detail) {
    var tips = detail && detail.tips;
    var settled = [];
    if (Array.isArray(tips)) {
      tips.forEach(function (t) { if (t && resultOf(t)) settled.push(t); });
    } else if (tips && typeof tips === "object") {
      settled = Array.isArray(tips.settled) ? tips.settled.filter(function (t) { return t && typeof t === "object"; }) : [];
    }
    if (Array.isArray(detail && detail.feed)) {
      detail.feed.forEach(function (t) { if (t && typeof t === "object") settled.push(t); });
    }
    return settled.filter(function (t) { return !isHistoricalImport(t) && resultOf(t); });
  }
  function inWindow(ms, windowKey, nowMs) {
    if (ms == null || !Number.isFinite(ms)) return windowKey === "season";
    var now = Number.isFinite(nowMs) ? nowMs : Date.now();
    if (windowKey === "7") return (now - ms) <= 7 * 864e5;
    if (windowKey === "30") return (now - ms) <= 30 * 864e5;
    var T = clock();
    if (T && typeof T.parts === "function") {
      var a = T.parts(ms), b = T.parts(now);
      return !!(a && b && a.year === b.year);
    }
    return new Date(ms).getUTCFullYear() === new Date(now).getUTCFullYear();
  }
  function roiOf(profit, staked) {
    if (!(staked > 0)) return 0;
    return round1((profit / staked) * 100);
  }
  function unitsOf(tips) {
    var sum = 0;
    (tips || []).forEach(function (t) { sum += profitOf(t); });
    return round2(sum);
  }
  function streaksOf(tips) {
    var rows = (tips || []).map(function (t, i) { return { t: t, i: i, ms: whenOf(t), res: resultOf(t) }; });
    rows.sort(function (a, b) {
      if (a.ms == null && b.ms == null) return a.i - b.i;
      if (a.ms == null) return 1;
      if (b.ms == null) return -1;
      return a.ms - b.ms || a.i - b.i;
    });
    var longestWin = 0, runWin = 0;
    rows.forEach(function (row) {
      if (row.res === "win") {
        runWin++;
        if (runWin > longestWin) longestWin = runWin;
      } else if (row.res === "loss") {
        runWin = 0;
      }
    });
    var currentType = "", currentN = 0;
    for (var i = rows.length - 1; i >= 0; i--) {
      var res = rows[i].res;
      if (res !== "win" && res !== "loss") continue;
      if (!currentType) { currentType = res === "win" ? "W" : "L"; currentN = 1; continue; }
      if ((currentType === "W" && res === "win") || (currentType === "L" && res === "loss")) currentN++;
      else break;
    }
    return { currentType: currentType, currentN: currentN, longestWin: longestWin };
  }
  function taggedTips(packs) {
    var out = [];
    var seen = {};
    (packs || []).forEach(function (pack) {
      var server = pack.server || {};
      var name = server.display_name || server.name || "Server";
      var gid = String(server.guild_id || pack.guild_id || "");
      settledList(pack.detail || pack).forEach(function (t) {
        var tid = t && t.tip_id != null && t.tip_id !== "" ? String(t.tip_id) : "";
        if (tid && seen[tid]) return;
        if (tid) seen[tid] = true;
        var copy = {};
        for (var k in t) if (Object.prototype.hasOwnProperty.call(t, k)) copy[k] = t[k];
        copy._server = name;
        copy._gid = gid;
        out.push(copy);
      });
    });
    return out;
  }
  function compute(tips, opts) {
    opts = opts || {};
    var windowKey = opts.window == null ? "7" : String(opts.window);
    var nowMs = opts.now == null ? Date.now() : opts.now;
    var inWin = (tips || []).filter(function (t) { return inWindow(whenOf(t), windowKey, nowMs); });
    var profit = unitsOf(inWin);
    var staked = 0, oddsSum = 0, oddsN = 0;
    var sports = {}, markets = {}, servers = {};
    var rows = inWin.map(function (t, i) { return { t: t, i: i, ms: whenOf(t) }; });
    rows.sort(function (a, b) {
      if (a.ms == null && b.ms == null) return a.i - b.i;
      if (a.ms == null) return 1;
      if (b.ms == null) return -1;
      return a.ms - b.ms || a.i - b.i;
    });
    var cumulative = [{ y: 0, label: "Start" }];
    var run = 0;
    var monthly = {}, monthOrder = [];
    var T = clock();
    rows.forEach(function (row) {
      var t = row.t;
      var res = resultOf(t);
      var p = profitOf(t);
      var stake = stakeOf(t);
      staked += stake;
      run = round2(run + p);
      cumulative.push({ y: run, ms: row.ms, label: "" });
      var o = num(t.odds);
      if (o != null && o > 0) { oddsSum += o; oddsN++; }
      var sp = sportOf(t);
      if (!sports[sp]) sports[sp] = { name: sp, won: 0, lost: 0, push: 0, profit: 0 };
      if (res === "win") sports[sp].won++;
      else if (res === "loss") sports[sp].lost++;
      else sports[sp].push++;
      sports[sp].profit = round2(sports[sp].profit + p);
      var mk = marketOf(t);
      if (!markets[mk]) markets[mk] = { name: mk, profit: 0, won: 0, lost: 0, n: 0 };
      markets[mk].profit = round2(markets[mk].profit + p);
      markets[mk].n++;
      if (res === "win") markets[mk].won++;
      else if (res === "loss") markets[mk].lost++;
      var key = t._gid || t._server || "server";
      if (!servers[key]) servers[key] = { id: key, name: t._server || "Server", profit: 0, staked: 0, won: 0, lost: 0, n: 0 };
      servers[key].profit = round2(servers[key].profit + p);
      servers[key].staked = round2(servers[key].staked + stake);
      servers[key].n++;
      if (res === "win") servers[key].won++;
      else if (res === "loss") servers[key].lost++;
      var monthKey = "";
      if (T && typeof T.monthKey === "function" && row.ms != null) monthKey = T.monthKey(row.ms) || "";
      else if (row.ms != null) monthKey = new Date(row.ms).toISOString().slice(0, 7);
      if (monthKey) {
        if (!Object.prototype.hasOwnProperty.call(monthly, monthKey)) { monthly[monthKey] = 0; monthOrder.push(monthKey); }
        monthly[monthKey] = round2(monthly[monthKey] + p);
      }
    });
    staked = round2(staked);
    var roi = roiOf(profit, staked);
    var streaks = streaksOf(inWin);
    var sportRows = Object.keys(sports).map(function (k) {
      var s = sports[k];
      var decided = s.won + s.lost;
      var marks = sportsApi();
      return {
        name: s.name,
        mark: marks ? (marks.mark(s.name) || "") : "",
        // marks.label() already starts with the emoji; the row shows the mark on its own.
        label: s.name,
        won: s.won, lost: s.lost, push: s.push,
        rate: decided ? round1((s.won / decided) * 100) : 0,
        profit: s.profit
      };
    }).sort(function (a, b) { return b.rate - a.rate || b.won - a.won || a.name.localeCompare(b.name); });
    var marketRows = Object.keys(markets).map(function (k) { return markets[k]; });
    marketRows.sort(function (a, b) { return b.profit - a.profit || a.name.localeCompare(b.name); });
    var serverRows = Object.keys(servers).map(function (k) {
      var s = servers[k];
      return {
        id: s.id, name: s.name, profit: s.profit, staked: s.staked,
        roi: roiOf(s.profit, s.staked), n: s.n, won: s.won, lost: s.lost
      };
    }).sort(function (a, b) { return b.profit - a.profit || a.name.localeCompare(b.name); });
    monthOrder.sort();
    var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var years = {};
    monthOrder.forEach(function (k) { years[k.slice(0, 4)] = 1; });
    var multi = Object.keys(years).length > 1;
    var monthBars = monthOrder.map(function (k) {
      var p = k.split("-");
      var lab = MONTHS[(Number(p[1]) || 1) - 1] || k;
      if (multi && p[0]) lab += " " + String(p[0]).slice(2);
      return { key: k, label: lab, value: monthly[k] };
    });
    var won = 0, lost = 0, push = 0;
    inWin.forEach(function (t) {
      var r = resultOf(t);
      if (r === "win") won++;
      else if (r === "loss") lost++;
      else push++;
    });
    return {
      window: windowKey,
      count: inWin.length,
      won: won, lost: lost, push: push,
      units: profit,
      staked: staked,
      roi: roi,
      avgOdds: oddsN ? round2(oddsSum / oddsN) : 0,
      streaks: streaks,
      cumulative: cumulative.length > 1 ? cumulative : [],
      sports: sportRows,
      bestMarkets: marketRows.slice(0, 3),
      worstMarkets: marketRows.slice().sort(function (a, b) { return a.profit - b.profit || a.name.localeCompare(b.name); }).slice(0, 3),
      monthly: monthBars,
      servers: serverRows
    };
  }
  function fmtUnits(n) {
    if (!Number.isFinite(Number(n))) return "—";
    var r = round1(n);
    return (r > 0 ? "+" : "") + r.toFixed(1) + "u";
  }
  function csvCell(v) {
    var s = String(v == null ? "" : v);
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  function bankrollCsv(tips) {
    var header = ["settled_at", "server", "tip_id", "result", "units", "odds", "profit_units", "sport", "market"];
    var lines = [header.join(",")];
    (tips || []).forEach(function (t) {
      if (!t || isHistoricalImport(t)) return;
      var res = resultOf(t);
      if (!res) return;
      lines.push(
        [
          csvCell(t.settled_at || t.graded_at || t.created_at || ""),
          csvCell(t._server || ""),
          csvCell(t.tip_id != null ? t.tip_id : ""),
          csvCell(res),
          csvCell(stakeOf(t)),
          csvCell(t.odds != null ? t.odds : ""),
          csvCell(profitOf(t)),
          csvCell(sportOf(t)),
          csvCell(marketOf(t))
        ].join(",")
      );
    });
    return lines.join("\n");
  }
  function downloadBankrollCsv(tips, filename) {
    var doc = root.document;
    if (!doc) return;
    var text = bankrollCsv(tips);
    var blob = new Blob([text], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = doc.createElement("a");
    a.href = url;
    a.download = filename || "tipdash-bankroll.csv";
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 500);
  }
  function fmtPct(n, signed) {
    if (!Number.isFinite(Number(n))) return "—";
    var r = round1(n);
    return (signed && r > 0 ? "+" : "") + r.toFixed(1) + "%";
  }
  function streakLabel(st) {
    if (!st || !st.currentN) return "None";
    var word = st.currentType === "L" ? (st.currentN === 1 ? "loss" : "losses") : (st.currentN === 1 ? "win" : "wins");
    return st.currentN + " " + word;
  }
  function fallbackLine(data) {
    if (!data || data.length < 2) return "";
    var w = 100, h = 42, minY = 0, maxY = 0, i;
    for (i = 0; i < data.length; i++) {
      if (data[i].y < minY) minY = data[i].y;
      if (data[i].y > maxY) maxY = data[i].y;
    }
    if (minY === maxY) { minY -= 1; maxY += 1; }
    var pts = [];
    for (i = 0; i < data.length; i++) {
      var px = (i / (data.length - 1)) * w;
      var py = h - ((data[i].y - minY) / (maxY - minY)) * h;
      pts.push(px.toFixed(1) + "," + py.toFixed(1));
    }
    var zeroY = h - ((0 - minY) / (maxY - minY)) * h;
    return '<svg class="ds-svg" viewBox="0 0 100 42" width="100%" height="100%" preserveAspectRatio="none" role="img" aria-label="Cumulative units">'
      + '<line x1="0" y1="' + zeroY.toFixed(1) + '" x2="100" y2="' + zeroY.toFixed(1) + '" stroke="var(--line)" stroke-width="0.4"/>'
      + '<polyline points="' + pts.join(" ") + '" fill="none" stroke="var(--accent)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>'
      + "</svg>";
  }
  function lineChart(points) {
    var C = chartsApi();
    var ys = (points || []).map(function (p) { return p.y; });
    if (C && ys.length >= 2) {
      return C.areaChart({
        data: ys, w: 640, h: 200, id: "dsu", smooth: reducedMotion() ? 0 : 0.65, padL: 44,
        yFmt: function (v) { var r = round1(v); return (r > 0 ? "+" : "") + r.toFixed(r % 1 ? 1 : 0).replace(/\.0$/, ""); },
        aria: "Cumulative units"
      });
    }
    return fallbackLine(points);
  }
  function monthChart(bars) {
    var C = chartsApi();
    if (C && bars && bars.length) {
      return C.barChart({
        bars: bars, w: 640, h: 200, padL: 44,
        yFmt: function (v) { var r = round1(v); return (r > 0 ? "+" : "") + r.toFixed(r % 1 ? 1 : 0).replace(/\.0$/, ""); },
        aria: "Monthly profit"
      });
    }
    if (!bars || !bars.length) return "";
    var maxMag = 1;
    bars.forEach(function (b) { var m = Math.abs(b.value); if (m > maxMag) maxMag = m; });
    var html = '<div class="ds-bars" role="img" aria-label="Monthly profit">';
    bars.forEach(function (b) {
      var h = Math.max(4, Math.round(Math.abs(b.value) / maxMag * 100));
      var cls = b.value >= 0 ? "pos" : "neg";
      html += '<div class="ds-bar" title="' + esc(b.label) + " " + fmtUnits(b.value) + '"><i class="' + cls + '" style="height:' + h + '%"></i><span>' + esc(b.label) + "</span></div>";
    });
    return html + "</div>";
  }
  function emptyBlock(title, body) {
    return '<section class="ds-panel"><h3>' + esc(title) + '</h3><div class="ds-empty">' + esc(body) + "</div></section>";
  }
  function render(stats, opts) {
    opts = opts || {};
    var windowKey = stats.window || "7";
    function tab(id, label) {
      return '<button type="button" class="ds-win-btn" data-ds-win="' + id + '" aria-pressed="' + (windowKey === id ? "true" : "false") + '">' + label + "</button>";
    }
    var html = '<div class="ds-page">'
      + '<div class="back" id="ds-back">← Back</div>'
      + '<div class="dhead"><h1 style="margin:0">Stats</h1></div>'
      + '<div class="ds-actions" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px">'
      + '<div class="ds-win" role="group" aria-label="Time window" style="flex:1 1 auto;margin:0">' + tab("7", "7d") + tab("30", "30d") + tab("season", "Season") + "</div>"
      + '<button type="button" class="btn sm" id="ds-wrapped">Season Wrapped</button>'
      + '<button type="button" class="btn sm ghost" id="ds-csv">Export bankroll CSV</button></div>';
    if (!stats.count) {
      html += '<div class="ds-empty ds-empty-lg"><p>No settled tips in this window yet.</p><p class="ds-empty-sub">Grade a few tips and they land here — 7 days, 30 days, or this season.</p></div></div>';
      return html;
    }
    var uCls = stats.units >= 0 ? "pos" : "neg";
    var rCls = stats.roi >= 0 ? "pos" : "neg";
    html += '<div class="ds-hero">'
      + '<div class="ds-kpi"><div class="ds-k">Units</div><div class="ds-v ' + uCls + '">' + esc(fmtUnits(stats.units)) + '</div><div class="ds-s">' + esc(round1(stats.staked).toFixed(1)) + "u staked</div></div>"
      + '<div class="ds-kpi"><div class="ds-k">ROI</div><div class="ds-v ' + rCls + '">' + esc(fmtPct(stats.roi, true)) + '</div><div class="ds-s">Profit ÷ stake</div></div>'
      + "</div>";
    var line = lineChart(stats.cumulative);
    html += '<section class="ds-panel"><h3>Cumulative units</h3>'
      + (line ? '<div class="ds-chart">' + line + "</div>" : '<div class="ds-empty">Not enough settled tips to draw a line yet.</div>')
      + "</section>";
    html += '<div class="ds-grid">'
      + '<div class="ds-kpi"><div class="ds-k">Current streak</div><div class="ds-v' + (stats.streaks.currentType === "L" ? " neg" : (stats.streaks.currentType === "W" ? " pos" : "")) + '">' + esc(streakLabel(stats.streaks)) + "</div></div>"
      + '<div class="ds-kpi"><div class="ds-k">Longest streak</div><div class="ds-v">' + esc(stats.streaks.longestWin + (stats.streaks.longestWin === 1 ? " win" : " wins")) + "</div></div>"
      + '<div class="ds-kpi"><div class="ds-k">Average odds</div><div class="ds-v">' + (stats.avgOdds ? stats.avgOdds.toFixed(2) : "—") + "</div></div>"
      + "</div>";
    if (stats.sports.length) {
      html += '<section class="ds-panel"><h3>Win rate by sport</h3><div class="ds-list">';
      stats.sports.forEach(function (s) {
        html += '<div class="ds-row"><span class="ds-mark" aria-hidden="true">' + esc(s.mark || "➕") + '</span><span class="ds-name">' + esc(s.label || s.name) + '</span><span class="ds-meta">' + s.won + "–" + s.lost + '</span><span class="ds-fig">' + s.rate.toFixed(0) + "%</span></div>";
      });
      html += "</div></section>";
    } else {
      html += emptyBlock("Win rate by sport", "No sports in this window.");
    }
    html += '<div class="ds-split">';
    html += '<section class="ds-panel"><h3>Best markets</h3>';
    if (!stats.bestMarkets.length) html += '<div class="ds-empty">No markets yet.</div>';
    else {
      html += '<div class="ds-list">';
      stats.bestMarkets.forEach(function (m) {
        html += '<div class="ds-row"><span class="ds-name">' + esc(m.name) + '</span><span class="ds-fig ' + (m.profit >= 0 ? "pos" : "neg") + '">' + esc(fmtUnits(m.profit)) + "</span></div>";
      });
      html += "</div>";
    }
    html += "</section>";
    html += '<section class="ds-panel"><h3>Worst markets</h3>';
    if (!stats.worstMarkets.length) html += '<div class="ds-empty">No markets yet.</div>';
    else {
      html += '<div class="ds-list">';
      stats.worstMarkets.forEach(function (m) {
        html += '<div class="ds-row"><span class="ds-name">' + esc(m.name) + '</span><span class="ds-fig ' + (m.profit >= 0 ? "pos" : "neg") + '">' + esc(fmtUnits(m.profit)) + "</span></div>";
      });
      html += "</div>";
    }
    html += "</section></div>";
    var bars = monthChart(stats.monthly);
    html += '<section class="ds-panel"><h3>Monthly</h3>'
      + (bars ? '<div class="ds-chart">' + bars + "</div>" : '<div class="ds-empty">No monthly results in this window yet.</div>')
      + "</section>";
    html += '<section class="ds-panel"><h3>By server</h3>';
    if (!stats.servers.length) html += '<div class="ds-empty">No servers in this window.</div>';
    else {
      html += '<div class="ds-list">';
      stats.servers.forEach(function (s) {
        html += '<div class="ds-row ds-server"><span class="ds-name">' + esc(s.name) + '</span><span class="ds-meta">' + s.n + " tips · " + esc(fmtPct(s.roi, true)) + '</span><span class="ds-fig ' + (s.profit >= 0 ? "pos" : "neg") + '">' + esc(fmtUnits(s.profit)) + "</span></div>";
      });
      html += "</div>";
    }
    html += "</section>";
    if (opts.capped) html += '<p class="ds-note">Based on the latest settled tips each server sends (up to 25 per server).</p>';
    html += "</div>";
    return html;
  }
  // The server payload lists at most 25 settled tips; flag when a list is full.
  function cappedPacks(packs) {
    return (packs || []).some(function (pack) {
      var d = pack && (pack.detail || pack);
      return !!(d && d.tips && Array.isArray(d.tips.settled) && d.tips.settled.length >= 25);
    });
  }
  function skeletonHtml() {
    var sk = (typeof NDSkeleton !== "undefined" && NDSkeleton) ? NDSkeleton : null;
    var box = function (w, h) { return sk ? sk.box(w, h) : '<div class="ds-sk" style="width:' + w + ";height:" + h + '"></div>'; };
    return '<div class="ds-page ds-loading" aria-busy="true">'
      + '<div class="back">← Back</div>'
      + '<div class="dhead">' + box("120px", "28px") + "</div>"
      + '<div class="ds-win">' + box("100%", "44px") + "</div>"
      + '<div class="ds-hero">' + box("100%", "88px") + box("100%", "88px") + "</div>"
      + box("100%", "160px")
      + '<div style="margin-top:14px">' + box("100%", "120px") + "</div>"
      + "</div>";
  }
  function errorHtml(msg) {
    return '<div class="ds-page"><div class="back" id="ds-back">← Back</div><div class="dhead"><h1 style="margin:0">Stats</h1></div>'
      + '<div class="ds-empty ds-empty-lg"><p>' + esc(msg || "Couldn't load stats.") + '</p><button type="button" class="btn sm" id="ds-retry">Try again</button></div></div>';
  }
  function cssText() {
    return (
      "#stats{min-width:0;max-width:100%;overflow-x:clip}" +
      ".ds-page{min-width:0;max-width:100%;overflow-x:clip}" +
      ".ds-win{display:flex;gap:6px;margin:0 0 16px;padding:4px;background:var(--card);border:1px solid var(--line);border-radius:var(--r-pill);max-width:100%;box-sizing:border-box}" +
      ".ds-win-btn{flex:1 1 0;min-width:0;min-height:44px;border:0;background:transparent;color:var(--muted);font:inherit;font-weight:650;border-radius:var(--r-pill);cursor:pointer;padding:8px 10px}" +
      ".ds-win-btn[aria-pressed=\"true\"]{background:var(--accent);color:var(--on-accent,#fff)}" +
      ".ds-hero{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}" +
      ".ds-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:14px}" +
      ".ds-split{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}" +
      ".ds-kpi,.ds-panel{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:14px 16px;min-width:0;max-width:100%;box-sizing:border-box}" +
      ".ds-panel{margin-bottom:14px}" +
      ".ds-panel h3{margin:0 0 12px;font-size:var(--t-sub);text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}" +
      ".ds-k{color:var(--muted);font-size:var(--t-cap);text-transform:uppercase;letter-spacing:.05em}" +
      ".ds-v{font-weight:800;font-size:var(--t-h2);line-height:1.15;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}" +
      ".ds-s{color:var(--faint);font-size:var(--t-foot);margin-top:4px}" +
      ".ds-chart{width:100%;min-width:0;overflow:hidden}" +
      ".ds-chart .sv-svg,.ds-chart .ds-svg{display:block;width:100%;height:auto;max-width:100%}" +
      ".ds-list{display:flex;flex-direction:column;gap:8px;min-width:0}" +
      ".ds-row{display:flex;align-items:center;gap:8px;min-width:0}" +
      ".ds-mark{width:1.5em;text-align:center;flex:none}" +
      ".ds-name{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
      ".ds-meta{color:var(--muted);font-size:var(--t-foot);flex:none;font-variant-numeric:tabular-nums}" +
      ".ds-fig{font-weight:700;flex:none;font-variant-numeric:tabular-nums}" +
      ".ds-server .ds-meta{max-width:42%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
      ".ds-empty{color:var(--muted);font-size:var(--t-sub);padding:8px 0}" +
      ".ds-empty-lg{text-align:center;padding:28px 12px}" +
      ".ds-empty-sub{color:var(--faint);font-size:var(--t-foot)}" +
      ".ds-bars{display:flex;align-items:flex-end;gap:6px;height:120px;min-width:0;padding-bottom:18px;border-bottom:1px solid var(--line)}" +
      ".ds-bar{flex:1 1 0;min-width:0;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;position:relative}" +
      ".ds-bar i{display:block;width:100%;border-radius:3px 3px 0 0}" +
      ".ds-bar i.pos{background:var(--win)}" +
      ".ds-bar i.neg{background:var(--loss)}" +
      ".ds-bar span{position:absolute;bottom:-16px;font-size:var(--t-cap);color:var(--muted);white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}" +
      ".ds-note{grid-column:1/-1;color:var(--muted);font-size:var(--t-foot);margin:0 0 14px}" +
      ".ds-sk{background:rgba(255,255,255,.06);border-radius:8px}" +
      ".home-stats-tile .sname{display:flex;align-items:center;gap:8px}" +
      "@media(max-width:700px){.ds-hero,.ds-split{grid-template-columns:1fr}.ds-grid{grid-template-columns:1fr 1fr}.ds-grid .ds-kpi:last-child{grid-column:1/-1}}" +
      "@media(min-width:900px){.ds-page{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:0 16px;align-items:start}.ds-page>.back,.ds-page>.dhead,.ds-page>.ds-win,.ds-page>.ds-hero,.ds-page>.ds-empty-lg{grid-column:1/-1}.ds-page>.ds-grid{grid-column:1/-1}.ds-page>.ds-split{grid-column:1/-1}}" +
      "@media(prefers-reduced-motion:reduce){.ds-win-btn{transition:none}.ds-chart .sv-line{transition:none}}");
  }
  function injectCss() {
    var doc = root.document;
    if (!doc || doc.getElementById("ds-css")) return;
    var s = doc.createElement("style");
    s.id = "ds-css";
    s.textContent = cssText();
    (doc.head || doc.documentElement).appendChild(s);
  }
  function bind(el, model, handlers) {
    handlers = handlers || {};
    var back = el.querySelector("#ds-back");
    if (back) back.onclick = handlers.onBack || function () {};
    el.querySelectorAll("[data-ds-win]").forEach(function (btn) {
      btn.onclick = function () {
        var w = btn.getAttribute("data-ds-win");
        if (handlers.onWindow) handlers.onWindow(w);
      };
    });
    var retry = el.querySelector("#ds-retry");
    if (retry && handlers.onRetry) retry.onclick = handlers.onRetry;
    var wrapped = el.querySelector("#ds-wrapped");
    if (wrapped && handlers.onWrapped) wrapped.onclick = handlers.onWrapped;
    var csv = el.querySelector("#ds-csv");
    if (csv && handlers.onCsv) csv.onclick = handlers.onCsv;
  }
  function mount(el, packs, opts) {
    opts = opts || {};
    injectCss();
    var windowKey = opts.window || "7";
    var tips = taggedTips(packs);
    var stats = compute(tips, { window: windowKey, now: opts.now });
    var ropts = {};
    for (var k in opts) if (Object.prototype.hasOwnProperty.call(opts, k)) ropts[k] = opts[k];
    ropts.capped = cappedPacks(packs);
    el.innerHTML = render(stats, ropts);
    var handlers = {};
    for (var hk in opts) if (Object.prototype.hasOwnProperty.call(opts, hk)) handlers[hk] = opts[hk];
    handlers.onWrapped = function () {
      var D = root.TBDelight;
      if (D && typeof D.openSeasonWrapped === "function") D.openSeasonWrapped(stats);
    };
    handlers.onCsv = function () {
      downloadBankrollCsv(tips, "tipdash-bankroll.csv");
    };
    bind(el, stats, handlers);
    return stats;
  }

  var api = {
    compute: compute,
    computeDashStats: compute,
    unitsOf: unitsOf,
    roiOf: roiOf,
    streaksOf: streaksOf,
    taggedTips: taggedTips,
    cappedPacks: cappedPacks,
    settledList: settledList,
    detailFromSettledSummary: detailFromSettledSummary,
    render: render,
    skeletonHtml: skeletonHtml,
    errorHtml: errorHtml,
    mount: mount,
    injectCss: injectCss,
    cssText: cssText,
    fmtUnits: fmtUnits,
    fmtPct: fmtPct,
    bankrollCsv: bankrollCsv,
    downloadBankrollCsv: downloadBankrollCsv
  };
  root.TBDashStats = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
