/* Premium Tipdash PDF / print report from data already on the page.
 * Apex-style layout, inline SVG charts, public tips only. TBPdfReport + CommonJS. */
(function (root) {
  "use strict";

  var PALETTE = {
    bg: "#0b0d12",
    card: "#12151c",
    line: "#2a3142",
    txt: "#eef2f8",
    muted: "#8b95a8",
    faint: "#5c6678",
    accent: "#5ce1e6",
    accent2: "#8b7cf6",
    win: "#3ecf8e",
    loss: "#f07178",
    push: "#e0a04a",
    onAccent: "#061014"
  };
  var DONUT = [PALETTE.accent, PALETTE.accent2, PALETTE.win, PALETTE.push, PALETTE.loss];
  var DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var OPTS_KEY = "tipdash_pdf_report_opts_v1";
  var BRAND_KEY = "tipdash_pdf_brand_v1";

  function defaultOptions() {
    return {
      sections: {
        cover: true,
        summary: true,
        chartCumulative: true,
        chartMonthly: true,
        chartSportWin: true,
        chartBetMix: true,
        breakdownSport: true,
        breakdownMarket: true,
        breakdownSinglesMultis: true,
        breakdownOdds: true,
        breakdownWeekday: true,
        breakdownRacingSports: true,
        log: true,
        notes: true
      },
      logColumns: {
        date: true,
        event: true,
        legs: true,
        odds: true,
        stake: true,
        result: true,
        pl: true
      }
    };
  }

  function normalizeOptions(raw) {
    var d = defaultOptions();
    if (!raw || typeof raw !== "object") return d;
    var sec = raw.sections && typeof raw.sections === "object" ? raw.sections : {};
    var cols = raw.logColumns && typeof raw.logColumns === "object" ? raw.logColumns : {};
    var keys = Object.keys(d.sections);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (k === "cover") {
        d.sections.cover = true;
        continue;
      }
      if (typeof sec[k] === "boolean") d.sections[k] = sec[k];
    }
    d.sections.cover = true;
    var ckeys = Object.keys(d.logColumns);
    for (var j = 0; j < ckeys.length; j++) {
      var ck = ckeys[j];
      if (typeof cols[ck] === "boolean") d.logColumns[ck] = cols[ck];
    }
    if (!d.sections.log) {
      ckeys.forEach(function (ck) { d.logColumns[ck] = false; });
    } else {
      var anyCol = ckeys.some(function (ck) { return d.logColumns[ck]; });
      if (!anyCol) d.logColumns.date = true;
    }
    return d;
  }

  function loadOptions() {
    try {
      var raw = root.localStorage && root.localStorage.getItem(OPTS_KEY);
      if (!raw) return defaultOptions();
      return normalizeOptions(JSON.parse(raw));
    } catch (e) {
      return defaultOptions();
    }
  }

  function saveOptions(opts) {
    try {
      if (root.localStorage) root.localStorage.setItem(OPTS_KEY, JSON.stringify(normalizeOptions(opts)));
    } catch (e2) {}
  }

  function brandSlot(guildId) {
    var id = guildId == null || guildId === "" ? "_default" : String(guildId);
    return id;
  }

  function loadBrand(guildId) {
    var slot = brandSlot(guildId);
    try {
      var raw = root.localStorage && root.localStorage.getItem(BRAND_KEY);
      if (!raw) return { displayName: "", accent: "", logoDataUrl: "" };
      var all = JSON.parse(raw);
      var row = all && all[slot];
      if (!row || typeof row !== "object") return { displayName: "", accent: "", logoDataUrl: "" };
      return {
        displayName: row.displayName ? String(row.displayName).slice(0, 80) : "",
        accent: sanitizeHex(row.accent) || "",
        logoDataUrl: row.logoDataUrl && String(row.logoDataUrl).indexOf("data:image/") === 0 ? String(row.logoDataUrl) : ""
      };
    } catch (e) {
      return { displayName: "", accent: "", logoDataUrl: "" };
    }
  }

  function saveBrand(guildId, brand) {
    try {
      if (!root.localStorage) return;
      var slot = brandSlot(guildId);
      var raw = root.localStorage.getItem(BRAND_KEY);
      var all = {};
      if (raw) {
        try { all = JSON.parse(raw) || {}; } catch (e) { all = {}; }
      }
      all[slot] = {
        displayName: brand.displayName ? String(brand.displayName).slice(0, 80) : "",
        accent: sanitizeHex(brand.accent) || "",
        logoDataUrl: brand.logoDataUrl && String(brand.logoDataUrl).indexOf("data:image/") === 0 ? String(brand.logoDataUrl).slice(0, 220000) : ""
      };
      root.localStorage.setItem(BRAND_KEY, JSON.stringify(all));
    } catch (e2) {}
  }

  function sanitizeHex(c) {
    var s = String(c == null ? "" : c).trim();
    if (!/^#[0-9a-fA-F]{6}$/.test(s)) return "";
    return s.toLowerCase();
  }

  function brandCustomAllowed(detail, server) {
    if (detail && truthy(detail.brand_custom)) return true;
    if (detail && detail.settings && truthy(detail.settings.brand_custom)) return true;
    if (server && truthy(server.brand_custom)) return true;
    return false;
  }

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

  function dashStats() {
    var g = typeof globalThis !== "undefined" ? globalThis : {};
    if (g.TBDashStats) return g.TBDashStats;
    if (typeof require === "function") {
      try { return require("./stats.js"); } catch (e) {}
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
  function chartsApi() {
    var g = typeof globalThis !== "undefined" ? globalThis : {};
    if (g.SvgCharts) return g.SvgCharts;
    if (typeof require === "function") {
      try { return require("./svg-charts.js"); } catch (e) {}
    }
    return null;
  }
  function clock() {
    var g = typeof globalThis !== "undefined" ? globalThis : {};
    if (g.TBTime) return g.TBTime;
    if (typeof require === "function") {
      try { return require("./tbtime.js"); } catch (e) {}
    }
    return null;
  }
  function racingLegs() {
    var g = typeof globalThis !== "undefined" ? globalThis : {};
    if (g.TBRacingLegs) return g.TBRacingLegs;
    if (typeof require === "function") {
      try { return require("./racing-legs.js"); } catch (e) {}
    }
    return null;
  }
  function aflGuernseys() {
    var g = typeof globalThis !== "undefined" ? globalThis : {};
    if (g.TBAflGuernseys) return g.TBAflGuernseys;
    if (typeof require === "function") {
      try { return require("./afl-guernseys.js"); } catch (e) {}
    }
    return null;
  }
  function sportsApi() {
    var g = typeof globalThis !== "undefined" ? globalThis : {};
    if (g.TBSports) return g.TBSports;
    if (typeof require === "function") {
      try { return require("./sport-marks.js"); } catch (e) {}
    }
    return null;
  }

  function truthy(v) {
    return v === true || v === 1 || v === "1" || v === "true" || v === "yes";
  }

  function isHiddenTip(tip) {
    if (!tip || typeof tip !== "object") return true;
    if (truthy(tip.hidden) || truthy(tip.is_hidden) || tip.visible === false) return true;
    if (truthy(tip.admin_only) || truthy(tip.owner_only) || truthy(tip.internal)) return true;
    var vis = String(tip.visibility || tip.audience || "").trim().toLowerCase();
    if (vis === "admin" || vis === "owner" || vis === "hidden" || vis === "internal") return true;
    return false;
  }

  function isPublicTip(tip) {
    if (!tip || typeof tip !== "object") return false;
    if (isHiddenTip(tip)) return false;
    var SV = serverView();
    if (SV && typeof SV.isHistoricalImport === "function" && SV.isHistoricalImport(tip)) return false;
    var DS = dashStats();
    if (DS && typeof DS.settledList === "function") {
      /* settledList already drops imports when used via packs */
    }
    return true;
  }

  function resultOf(tip) {
    var SV = serverView();
    if (SV && typeof SV.resultOf === "function") return SV.resultOf(tip);
    var DS = dashStats();
    if (DS && DS.compute) {
      var raw = String(tip.result || tip.outcome || "").trim().toLowerCase();
      if (raw === "won" || raw === "w" || raw === "win") return "win";
      if (raw === "lost" || raw === "l" || raw === "loss") return "loss";
      if (raw === "push" || raw === "p" || raw === "void" || raw === "v") return raw === "void" || raw === "v" ? "void" : "push";
    }
    return "";
  }

  function profitOf(tip) {
    var p = num(tip.profit_units);
    if (p == null) p = num(tip.profit);
    if (p == null) p = num(tip.pl);
    if (p != null) return p;
    var res = resultOf(tip);
    var u = stakeOf(tip);
    var o = num(tip.odds);
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
    return String(raw || "").trim() || "Other";
  }

  function marketOf(tip) {
    var raw = tip.bet_type || tip.market || tip.market_name || "";
    if (!raw && tip.legs && tip.legs[0]) {
      raw = tip.legs[0].stat || tip.legs[0].market || tip.legs[0].sel || "";
    }
    return String(raw || "").trim() || "Other";
  }

  function isRacingTip(tip) {
    var sp = sportOf(tip).toLowerCase();
    if (sp.indexOf("racing") >= 0 || sp === "thoroughbred" || sp === "harness") return true;
    if (Array.isArray(tip.legs)) {
      for (var i = 0; i < tip.legs.length; i++) {
        if (tip.legs[i] && tip.legs[i].kind === "racing") return true;
      }
    }
    return false;
  }

  function isMultiTip(tip) {
    if (Array.isArray(tip.legs) && tip.legs.length > 1) return true;
    var bt = String(tip.bet_type || tip.market || "").toLowerCase();
    return bt.indexOf("multi") >= 0 || bt.indexOf("parlay") >= 0 || bt.indexOf("acca") >= 0;
  }

  function oddsBand(o) {
    if (o == null || !(o > 0)) return "Unknown";
    if (o < 2) return "<2.00";
    if (o < 3) return "2.00–2.99";
    if (o < 5) return "3.00–4.99";
    return "5.00+";
  }

  function dayKey(ms) {
    var T = clock();
    if (T && typeof T.parts === "function") {
      var p = T.parts(ms);
      if (p) return DAYS[p.weekday] || "—";
    }
    return DAYS[new Date(ms).getUTCDay()] || "—";
  }

  function fmtUnits(n) {
    if (!Number.isFinite(Number(n))) return "0.0u";
    var r = round1(n);
    return (r > 0 ? "+" : "") + r.toFixed(1) + "u";
  }

  function fmtPct(n, signed) {
    if (!Number.isFinite(Number(n))) return "—";
    var r = round1(n);
    return (signed && r > 0 ? "+" : "") + r.toFixed(1) + "%";
  }

  function fmtDate(ms) {
    if (ms == null) return "—";
    var T = clock();
    if (T && typeof T.parts === "function") {
      var p = T.parts(ms);
      if (p) return p.day + "/" + p.month + "/" + p.year;
    }
    var d = new Date(ms);
    return d.getUTCDate() + "/" + (d.getUTCMonth() + 1) + "/" + d.getUTCFullYear();
  }

  function fmtRange(minMs, maxMs) {
    if (minMs == null && maxMs == null) return "All settled tips";
    if (minMs == null) return "Through " + fmtDate(maxMs);
    if (maxMs == null) return "From " + fmtDate(minMs);
    return fmtDate(minMs) + " – " + fmtDate(maxMs);
  }

  function windowLabel(key) {
    if (key === "7") return "Last 7 days";
    if (key === "30") return "Last 30 days";
    if (key === "season") return "This season";
    if (key && String(key).match(/^\d{4}-\d{2}$/)) return String(key);
    return key ? String(key) : "Selected period";
  }

  function collectTipsFromPacks(packs) {
    var DS = dashStats();
    var out = [];
    if (DS && typeof DS.taggedTips === "function") {
      out = DS.taggedTips(packs).filter(function (t) { return isPublicTip(t) && resultOf(t); });
      return out;
    }
    (packs || []).forEach(function (pack) {
      var detail = pack.detail || pack;
      var tips = detail.tips;
      var settled = [];
      if (Array.isArray(tips)) settled = tips;
      else if (tips && tips.settled) settled = tips.settled;
      else if (detail.feed) settled = detail.feed;
      settled.forEach(function (t) {
        if (isPublicTip(t) && resultOf(t)) out.push(t);
      });
    });
    return out;
  }

  function collectTipsFromDetail(detail) {
    var tips = [];
    if (!detail) return tips;
    if (detail.tips && Array.isArray(detail.tips.settled)) tips = detail.tips.settled;
    else if (Array.isArray(detail.tips)) tips = detail.tips;
    else if (detail.feed) tips = detail.feed;
    return tips.filter(function (t) { return isPublicTip(t) && resultOf(t); });
  }

  function bucketRows(tips, keyFn) {
    var map = {};
    tips.forEach(function (t) {
      var k = keyFn(t);
      if (!map[k]) map[k] = { key: k, n: 0, won: 0, lost: 0, profit: 0, staked: 0 };
      var b = map[k];
      b.n++;
      b.profit = round2(b.profit + profitOf(t));
      b.staked = round2(b.staked + stakeOf(t));
      var r = resultOf(t);
      if (r === "win") b.won++;
      else if (r === "loss") b.lost++;
    });
    return Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) {
      return b.profit - a.profit || a.key.localeCompare(b.key);
    });
  }

  function tipEventLabel(tip) {
    if (tip.match) return String(tip.match);
    if (tip.event) return String(tip.event);
    if (tip.description) return String(tip.description);
    if (Array.isArray(tip.legs) && tip.legs.length) {
      return tip.legs.map(function (leg) {
        if (!leg) return "";
        if (leg.kind === "racing") return (leg.meeting || "") + " R" + (leg.race_number || "?");
        return leg.description || leg.player || leg.sel || "";
      }).filter(Boolean).join(" · ");
    }
    return sportOf(tip);
  }

  function legChipsHtml(tip) {
    var html = "";
    var RL = racingLegs();
    var AG = aflGuernseys();
    var legs = Array.isArray(tip.legs) ? tip.legs : [];
    if (!legs.length) return '<span class="rp-leg-txt">' + esc(tipEventLabel(tip)) + "</span>";
    legs.forEach(function (leg) {
      if (!leg) return;
      if (leg.kind === "racing" && RL && typeof RL.miniHorseSvg === "function") {
        html += RL.miniHorseSvg(leg, false);
      } else if (AG && typeof AG.isAflPlayerLeg === "function" && AG.isAflPlayerLeg(leg)) {
        html += AG.miniGuernseyHtml(leg.team, leg.number, false);
      }
      var txt = leg.description || (AG && AG.legLabel ? AG.legLabel(leg) : "") || leg.sel || leg.player || "";
      if (txt) html += '<span class="rp-leg-txt">' + esc(txt) + "</span>";
    });
    return html || '<span class="rp-leg-txt">' + esc(tipEventLabel(tip)) + "</span>";
  }

  function resultBadge(tip) {
    var r = resultOf(tip);
    if (r === "win") return '<span class="rp-res w">W</span>';
    if (r === "loss") return '<span class="rp-res l">L</span>';
    if (r === "push") return '<span class="rp-res p">P</span>';
    if (r === "void") return '<span class="rp-res p">V</span>';
    return '<span class="rp-res">—</span>';
  }

  function buildModel(tips, meta) {
    meta = meta || {};
    var DS = dashStats();
    var windowKey = meta.window == null ? "season" : String(meta.window);
    var nowMs = meta.now == null ? Date.now() : meta.now;
    var stats = DS && typeof DS.compute === "function"
      ? DS.compute(tips, { window: windowKey, now: nowMs })
      : { units: 0, roi: 0, staked: 0, won: 0, lost: 0, push: 0, count: 0, streaks: { longestWin: 0 }, avgOdds: 0, cumulative: [], monthly: [], sports: [] };

    var inWin = tips;
    if (DS && typeof DS.compute === "function") {
      inWin = tips.filter(function (t) {
        var ms = whenOf(t);
        if (windowKey === "7") return ms != null && (nowMs - ms) <= 7 * 864e5;
        if (windowKey === "30") return ms != null && (nowMs - ms) <= 30 * 864e5;
        if (windowKey === "season") {
          var T = clock();
          if (T && typeof T.parts === "function" && ms != null) {
            var a = T.parts(ms);
            var b = T.parts(nowMs);
            return !!(a && b && a.year === b.year);
          }
          return ms == null || new Date(ms).getUTCFullYear() === new Date(nowMs).getUTCFullYear();
        }
        return true;
      });
    }

    var minMs = null;
    var maxMs = null;
    inWin.forEach(function (t) {
      var ms = whenOf(t);
      if (ms == null) return;
      if (minMs == null || ms < minMs) minMs = ms;
      if (maxMs == null || ms > maxMs) maxMs = ms;
    });

    var best = null;
    var worst = null;
    inWin.forEach(function (t) {
      var p = profitOf(t);
      if (!best || p > best.profit) best = { tip: t, profit: p };
      if (!worst || p < worst.profit) worst = { tip: t, profit: p };
    });

    var sportRows = bucketRows(inWin, sportOf);
    var marketRows = bucketRows(inWin, marketOf);
    var oddsRows = bucketRows(inWin, function (t) { return oddsBand(num(t.odds)); });
    var dayRows = bucketRows(inWin, function (t) { return dayKey(whenOf(t)); });
    var multiRows = bucketRows(inWin, function (t) { return isMultiTip(t) ? "Multis" : "Singles"; });
    var raceRows = bucketRows(inWin, function (t) { return isRacingTip(t) ? "Racing" : "Sports"; });

    var betTypeMap = {};
    inWin.forEach(function (t) {
      var k = marketOf(t);
      betTypeMap[k] = (betTypeMap[k] || 0) + 1;
    });
    var betSlices = Object.keys(betTypeMap).map(function (name, i) {
      return { name: name, n: betTypeMap[name], pct: 0, color: DONUT[i % DONUT.length] };
    }).sort(function (a, b) { return b.n - a.n; });
    var btTotal = betSlices.reduce(function (a, s) { return a + s.n; }, 0);
    betSlices.forEach(function (s) { s.pct = btTotal ? Math.round(s.n / btTotal * 100) : 0; });
    if (betSlices.length > 8) {
      var top = betSlices.slice(0, 7);
      var rest = betSlices.slice(7).reduce(function (a, s) { return a + s.n; }, 0);
      top.push({ name: "Other", n: rest, pct: btTotal ? Math.round(rest / btTotal * 100) : 0, color: DONUT[7 % DONUT.length] });
      betSlices = top;
    }

    var sportWin = (stats.sports || []).map(function (s) {
      return { label: s.label || s.name, rate: s.rate, won: s.won, lost: s.lost };
    });

    var log = inWin.map(function (t, i) {
      return {
        i: i,
        ms: whenOf(t),
        date: fmtDate(whenOf(t)),
        event: tipEventLabel(t),
        legsHtml: legChipsHtml(t),
        odds: num(t.odds),
        stake: stakeOf(t),
        resultHtml: resultBadge(t),
        pl: profitOf(t),
        plText: fmtUnits(profitOf(t)),
        plCls: profitOf(t) >= 0 ? "pos" : "neg"
      };
    });
    log.sort(function (a, b) {
      if (a.ms == null && b.ms == null) return a.i - b.i;
      if (a.ms == null) return 1;
      if (b.ms == null) return -1;
      return b.ms - a.ms || a.i - b.i;
    });

    return {
      brand: "TipBot",
      title: meta.title || "Performance report",
      subtitle: meta.subtitle || "",
      serverName: meta.serverName || meta.subtitle || "Your communities",
      tipsterName: meta.tipsterName || "",
      periodLabel: meta.periodLabel || windowLabel(windowKey),
      dateRange: fmtRange(minMs, maxMs),
      generatedAt: fmtDate(nowMs),
      units: stats.units,
      roi: stats.roi,
      staked: stats.staked,
      won: stats.won,
      lost: stats.lost,
      push: stats.push,
      winRate: stats.won + stats.lost ? round1((stats.won / (stats.won + stats.lost)) * 100) : 0,
      streaks: stats.streaks,
      avgOdds: stats.avgOdds,
      best: best,
      worst: worst,
      cumulative: stats.cumulative || [],
      monthly: stats.monthly || [],
      sportWin: sportWin,
      betSlices: betSlices,
      breakdowns: {
        sport: sportRows,
        market: marketRows,
        singlesMultis: multiRows,
        odds: oddsRows,
        weekday: dayRows,
        racingSports: raceRows
      },
      log: log
    };
  }

  function breakdownTable(rows, opts) {
    opts = opts || {};
    if (!rows.length) return '<p class="rp-muted">No data in this period.</p>';
    var html = '<table class="rp-tbl"><thead><tr><th>' + esc(opts.col || "Category") + "</th><th>Tips</th><th>W–L</th><th>Units</th><th>ROI</th></tr></thead><tbody>";
    rows.forEach(function (r, i) {
      var roi = r.staked ? round1((r.profit / r.staked) * 100) : 0;
      html += '<tr class="' + (i % 2 ? "zebra" : "") + '"><td>' + esc(r.key) + "</td><td>" + r.n + "</td><td>" + r.won + "–" + r.lost + "</td>"
        + '<td class="' + (r.profit >= 0 ? "pos" : "neg") + '">' + esc(fmtUnits(r.profit)) + "</td><td>" + esc(fmtPct(roi, true)) + "</td></tr>";
    });
    return html + "</tbody></table>";
  }

  function chartsBlock(model, opts, accent) {
    opts = normalizeOptions(opts || {});
    var sec = opts.sections;
    var color = accent || PALETTE.accent;
    var C = chartsApi();
    var html = '<div class="rp-charts">';
    if (sec.chartCumulative && C && model.cumulative.length >= 2) {
      var ys = model.cumulative.map(function (p) { return p.y; });
      html += '<section class="rp-panel"><h3>Cumulative profit</h3><div class="rp-chart">' + C.areaChart({
        data: ys, w: 520, h: 180, id: "rpcum", smooth: 0.5, padL: 40, color: color,
        yFmt: function (v) { return round1(v); },
        aria: "Cumulative units"
      }) + "</div></section>";
    }
    if (sec.chartMonthly && C && model.monthly.length) {
      html += '<section class="rp-panel"><h3>Monthly P&amp;L</h3><div class="rp-chart">' + C.barChart({
        bars: model.monthly, w: 520, h: 180, padL: 40,
        yFmt: function (v) { return round1(v); },
        aria: "Monthly profit"
      }) + "</div></section>";
    }
    if (sec.chartSportWin && model.sportWin.length) {
      html += '<section class="rp-panel"><h3>Win rate by sport</h3><div class="rp-sport-bars">';
      model.sportWin.forEach(function (s) {
        var w = Math.max(4, Math.min(100, s.rate));
        html += '<div class="rp-sbar"><span class="rp-sbar-l">' + esc(s.label) + '</span><span class="rp-sbar-track"><i style="width:' + w + '%"></i></span><span class="rp-sbar-v">' + s.rate.toFixed(0) + "%</span></div>";
      });
      html += "</div></section>";
    }
    if (sec.chartBetMix && C && model.betSlices.length) {
      html += '<section class="rp-panel"><h3>Bet-type mix</h3><div class="rp-donut-row">' + C.donut({
        slices: model.betSlices, center: String(model.betSlices.reduce(function (a, s) { return a + s.n; }, 0)), sub: "bets",
        aria: "Bet type mix"
      }) + '<div class="rp-legend">';
      model.betSlices.forEach(function (s) {
        html += '<div><i style="background:' + s.color + '"></i><span>' + esc(s.name) + "</span><b>" + s.n + "</b><em>" + s.pct + "%</em></div>";
      });
      html += "</div></div></section>";
    }
    html += "</div>";
    return html;
  }

  function cssText(theme) {
    theme = theme || {};
    var accent = theme.accent || PALETTE.accent;
    var accent2 = theme.accent2 || PALETTE.accent2;
    return (
      ":root{" +
      "--bg:" + PALETTE.bg + ";--card:" + PALETTE.card + ";--line:" + PALETTE.line + ";--txt:" + PALETTE.txt + ";--muted:" + PALETTE.muted + ";--faint:" + PALETTE.faint +
      ";--accent:" + accent + ";--accent2:" + accent2 + ";--win:" + PALETTE.win + ";--loss:" + PALETTE.loss + ";--push:" + PALETTE.push + ";--on-accent:" + PALETTE.onAccent + "}" +
      "*{box-sizing:border-box}body{margin:0;font:13px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;color:var(--txt);background:var(--bg)}" +
      "@page{size:A4;margin:16mm 12mm 20mm 12mm}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}" +
      ".rp-page{page-break-after:always;min-height:250mm;position:relative;padding:0 2mm}" +
      ".rp-page:last-child{page-break-after:auto}" +
      ".rp-head,.rp-foot{position:fixed;left:12mm;right:12mm;color:var(--muted);font-size:10px;z-index:2}" +
      ".rp-head{top:8mm;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--line);padding-bottom:4px}" +
      ".rp-foot{bottom:8mm;border-top:1px solid var(--line);padding-top:4px;display:flex;justify-content:space-between}" +
      ".rp-cover{padding-top:28mm;text-align:left}" +
      ".rp-brand{font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:var(--accent);font-weight:700}" +
      ".rp-logo{max-height:52px;max-width:200px;margin-bottom:14px;display:block}" +
      ".rp-cover h1{font-size:34px;margin:12px 0 6px;font-weight:800;letter-spacing:-.02em}" +
      ".rp-cover .rp-sub{color:var(--muted);font-size:15px;margin:0 0 28px}" +
      ".rp-hero{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:24px 0}" +
      ".rp-kpi{background:linear-gradient(135deg,rgba(92,225,230,.12),rgba(139,124,246,.08));border:1px solid var(--line);border-radius:14px;padding:18px 20px}" +
      ".rp-kpi .k{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted)}" +
      ".rp-kpi .v{font-size:32px;font-weight:800;font-variant-numeric:tabular-nums;margin-top:6px}" +
      ".rp-kpi .pos{color:var(--win)}.rp-kpi .neg{color:var(--loss)}" +
      ".rp-accent-bar{height:4px;border-radius:99px;background:linear-gradient(90deg,var(--accent),var(--accent2));margin:18px 0 0}" +
      ".rp-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}" +
      ".rp-panel{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin-bottom:12px}" +
      ".rp-panel h3{margin:0 0 10px;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted)}" +
      ".rp-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px}" +
      ".rp-stat{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px}" +
      ".rp-stat .k{font-size:9px;text-transform:uppercase;color:var(--muted);letter-spacing:.08em}" +
      ".rp-stat .v{font-weight:800;font-size:18px;margin-top:4px;font-variant-numeric:tabular-nums}" +
      ".rp-charts{display:grid;grid-template-columns:1fr 1fr;gap:12px}" +
      ".rp-chart svg{width:100%;height:auto;display:block}" +
      ".rp-sbar{display:grid;grid-template-columns:88px 1fr 36px;gap:8px;align-items:center;margin:6px 0;font-size:11px}" +
      ".rp-sbar-track{height:8px;background:rgba(255,255,255,.06);border-radius:99px;overflow:hidden}" +
      ".rp-sbar-track i{display:block;height:100%;background:linear-gradient(90deg,var(--accent),var(--win));border-radius:99px}" +
      ".rp-donut-row{display:flex;gap:12px;align-items:center}" +
      ".rp-donut-row svg{width:120px;height:120px;flex:none}" +
      ".rp-legend{flex:1;font-size:11px}" +
      ".rp-legend div{display:grid;grid-template-columns:10px 1fr auto auto;gap:6px;align-items:center;margin:4px 0}" +
      ".rp-legend i{width:10px;height:10px;border-radius:2px;display:block}" +
      ".rp-legend em{color:var(--muted);font-style:normal;font-size:10px}" +
      ".rp-tbl{width:100%;border-collapse:collapse;font-size:11px}" +
      ".rp-tbl th,.rp-tbl td{padding:6px 8px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}" +
      ".rp-tbl th{color:var(--muted);font-weight:600;font-size:10px;text-transform:uppercase;letter-spacing:.06em}" +
      ".rp-tbl tr.zebra td{background:rgba(255,255,255,.02)}" +
      ".rp-log .rp-tbl td.odds,.rp-log .rp-tbl td.stake,.rp-log .rp-tbl td.pl{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}" +
      ".rp-res{display:inline-block;min-width:20px;text-align:center;font-weight:800;font-size:10px;padding:2px 6px;border-radius:6px}" +
      ".rp-res.w{background:rgba(62,207,142,.2);color:var(--win)}" +
      ".rp-res.l{background:rgba(240,113,120,.2);color:var(--loss)}" +
      ".rp-res.p{background:rgba(224,160,74,.15);color:var(--push)}" +
      ".rp-leg-txt{display:inline;margin-right:6px}" +
      ".rp-muted{color:var(--muted)}" +
      ".rp-notes{padding-top:20mm;font-size:12px;color:var(--muted)}" +
      ".rp-notes h2{color:var(--txt);font-size:20px}" +
      ".rp-disclaimer{margin-top:24px;padding:16px;border:1px solid var(--line);border-radius:12px;background:var(--card)}" +
      ".rp-disclaimer strong{display:block;font-size:16px;color:var(--txt);margin-bottom:6px}" +
      ".rp-page-break{break-before:page;page-break-before:always}" +
      "@media print{.rp-head,.rp-foot{position:fixed}}"
    );
  }

  function pageShell(headLeft, headRight, bodyHtml, footLeft, pageNum) {
    return (
      '<section class="rp-page">' +
      '<div class="rp-head"><span>' + esc(headLeft) + "</span><span>" + esc(headRight) + "</span></div>" +
      '<div class="rp-body">' + bodyHtml + "</div>" +
      '<div class="rp-foot"><span>' + esc(footLeft) + "</span><span>Page " + pageNum + "</span></div>" +
      "</section>"
    );
  }

  function themeFromBrand(brand) {
    brand = brand || {};
    var accent = sanitizeHex(brand.accent) || PALETTE.accent;
    return { accent: accent, accent2: PALETTE.accent2, displayName: brand.displayName || "", logoDataUrl: brand.logoDataUrl || "" };
  }

  function documentHtml(model, opts, brand) {
    opts = normalizeOptions(opts || {});
    var theme = themeFromBrand(brand);
    var sec = opts.sections;
    var cols = opts.logColumns;
    var uCls = model.units >= 0 ? "pos" : "neg";
    var rCls = model.roi >= 0 ? "pos" : "neg";
    var brandLabel = theme.displayName || model.brand || "TipBot";
    var headLeft = brandLabel + " · " + model.serverName;
    var headRight = model.periodLabel;
    var footLeft = brandLabel + " report";

    var coverBrand = theme.displayName ? esc(theme.displayName) : "TipBot";
    var cover = "";
    if (sec.cover) {
      cover = '<div class="rp-cover">' +
        (theme.logoDataUrl ? '<img class="rp-logo" src="' + theme.logoDataUrl.replace(/"/g, "") + '" alt="">' : "") +
        '<div class="rp-brand">' + coverBrand + "</div>" +
        "<h1>" + esc(model.title) + "</h1>" +
        '<p class="rp-sub">' + esc(model.serverName) +
        (model.tipsterName ? " · " + esc(model.tipsterName) : "") +
        "<br>" + esc(model.periodLabel) + " · " + esc(model.dateRange) + "</p>" +
        '<div class="rp-hero">' +
        '<div class="rp-kpi"><div class="k">Profit</div><div class="v ' + uCls + '">' + esc(fmtUnits(model.units)) + "</div></div>" +
        '<div class="rp-kpi"><div class="k">ROI</div><div class="v ' + rCls + '">' + esc(fmtPct(model.roi, true)) + "</div></div>" +
        "</div><div class=\"rp-accent-bar\"></div></div>";
    }

    var exec = "";
    if (sec.summary) {
      exec = '<h2>Executive summary</h2>' +
        '<div class="rp-summary">' +
        '<div class="rp-stat"><div class="k">Units</div><div class="v ' + uCls + '">' + esc(fmtUnits(model.units)) + "</div></div>" +
        '<div class="rp-stat"><div class="k">ROI</div><div class="v ' + rCls + '">' + esc(fmtPct(model.roi, true)) + "</div></div>" +
        '<div class="rp-stat"><div class="k">Win rate</div><div class="v">' + esc(fmtPct(model.winRate, false)) + "</div></div>" +
        '<div class="rp-stat"><div class="k">Record</div><div class="v">' + model.won + "–" + model.lost + (model.push ? " · " + model.push + " push" : "") + "</div></div>" +
        '<div class="rp-stat"><div class="k">Longest streak</div><div class="v">' + (model.streaks && model.streaks.longestWin ? model.streaks.longestWin + " wins" : "—") + "</div></div>" +
        '<div class="rp-stat"><div class="k">Average odds</div><div class="v">' + (model.avgOdds ? model.avgOdds.toFixed(2) : "—") + "</div></div>" +
        "</div>" +
        '<div class="rp-grid">' +
        '<div class="rp-panel"><h3>Best tip</h3><p>' + (model.best ? esc(tipEventLabel(model.best.tip)) + ' <span class="' + (model.best.profit >= 0 ? "pos" : "neg") + '">' + esc(fmtUnits(model.best.profit)) + "</span>" : "—") + "</p></div>" +
        '<div class="rp-panel"><h3>Worst tip</h3><p>' + (model.worst ? esc(tipEventLabel(model.worst.tip)) + ' <span class="' + (model.worst.profit >= 0 ? "pos" : "neg") + '">' + esc(fmtUnits(model.worst.profit)) + "</span>" : "—") + "</p></div>" +
        "</div>";
    }

    var chartBits = chartsBlock(model, opts, theme.accent);
    var charts = chartBits.indexOf("rp-panel") >= 0 ? "<h2>Charts</h2>" + chartBits : "";

    var bd = model.breakdowns;
    var breakParts = [];
    if (sec.breakdownSport) breakParts.push('<div class="rp-panel"><h3>By sport</h3>' + breakdownTable(bd.sport, { col: "Sport" }) + "</div>");
    if (sec.breakdownMarket) breakParts.push('<div class="rp-panel"><h3>By market</h3>' + breakdownTable(bd.market, { col: "Market" }) + "</div>");
    if (sec.breakdownSinglesMultis) breakParts.push('<div class="rp-panel"><h3>Singles vs multis</h3>' + breakdownTable(bd.singlesMultis, { col: "Type" }) + "</div>");
    if (sec.breakdownOdds) breakParts.push('<div class="rp-panel"><h3>Odds bands</h3>' + breakdownTable(bd.odds, { col: "Odds" }) + "</div>");
    if (sec.breakdownWeekday) breakParts.push('<div class="rp-panel"><h3>Day of week</h3>' + breakdownTable(bd.weekday, { col: "Day" }) + "</div>");
    if (sec.breakdownRacingSports) breakParts.push('<div class="rp-panel"><h3>Racing vs sports</h3>' + breakdownTable(bd.racingSports, { col: "Category" }) + "</div>");
    var breaks = breakParts.length ? "<h2>Breakdowns</h2><div class=\"rp-grid\">" + breakParts.join("") + "</div>" : "";

    var log = "";
    if (sec.log && model.log.length) {
      var logHead = "<tr>";
      if (cols.date) logHead += "<th>Date</th>";
      if (cols.event) logHead += "<th>Event</th>";
      if (cols.legs) logHead += "<th>Legs</th>";
      if (cols.odds) logHead += '<th class="odds">Odds</th>';
      if (cols.stake) logHead += '<th class="stake">Stake</th>';
      if (cols.result) logHead += "<th>Res</th>";
      if (cols.pl) logHead += '<th class="pl">P/L</th>';
      logHead += "</tr>";
      var logRows = "";
      model.log.forEach(function (row, i) {
        logRows += '<tr class="' + (i % 2 ? "zebra" : "") + '">';
        if (cols.date) logRows += "<td>" + esc(row.date) + "</td>";
        if (cols.event) logRows += "<td>" + esc(row.event) + "</td>";
        if (cols.legs) logRows += "<td>" + row.legsHtml + "</td>";
        if (cols.odds) logRows += '<td class="odds">' + (row.odds ? row.odds.toFixed(2) : "—") + "</td>";
        if (cols.stake) logRows += '<td class="stake">' + (row.stake ? row.stake.toFixed(1) + "u" : "—") + "</td>";
        if (cols.result) logRows += "<td>" + row.resultHtml + "</td>";
        if (cols.pl) logRows += '<td class="pl ' + row.plCls + '">' + esc(row.plText) + "</td>";
        logRows += "</tr>";
      });
      log = '<div class="rp-page-break"></div><h2>Tip log</h2><div class="rp-log"><table class="rp-tbl"><thead>' + logHead + "</thead><tbody>" + logRows + "</tbody></table></div>";
    }

    var notes = "";
    if (sec.notes) {
      notes = '<div class="rp-notes"><h2>Notes</h2><p>This report is generated from settled tips visible in your Tipdash account. Figures exclude historical imports and non-public tips. Past performance is not a reliable indicator of future results.</p>' +
        '<div class="rp-disclaimer"><strong>18+ Gamble responsibly</strong><span>If gambling is a problem for you or someone you know, call Gambling Help on 1800 858 858 (Australia).</span></div>' +
        '<p class="rp-muted" style="margin-top:18px">Generated ' + esc(model.generatedAt) + " · Tipdash</p></div>";
    }

    var chunks = [];
    if (cover) chunks.push({ key: "cover", html: cover });
    var mid = exec + charts;
    if (mid) chunks.push({ key: "mid", html: mid });
    var tail = breaks + log;
    if (tail) chunks.push({ key: "tail", html: tail });
    if (notes) chunks.push({ key: "notes", html: notes });
    if (!chunks.length) chunks.push({ key: "cover", html: cover || '<div class="rp-cover"><div class="rp-brand">TipBot</div></div>' });

    var pages = [];
    for (var pi = 0; pi < chunks.length; pi++) {
      pages.push(pageShell(headLeft, headRight, chunks[pi].html, footLeft, pi + 1));
    }

    return (
      "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"utf-8\"><title>" + esc(model.title) + "</title><style>" + cssText(theme) + "</style></head><body>" +
      pages.join("") +
      "</body></html>"
    );
  }

  function openPrint(html, title) {
    var doc = root.document;
    if (!doc) return false;
    var frame = doc.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    doc.body.appendChild(frame);
    var win = frame.contentWindow;
    if (!win) {
      frame.remove();
      return false;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    var cleanup = function () {
      try { frame.remove(); } catch (e) {}
    };
    win.onafterprint = cleanup;
    setTimeout(function () {
      try {
        win.focus();
        win.print();
      } catch (e2) {
        cleanup();
      }
    }, 250);
    setTimeout(cleanup, 120000);
    return true;
  }

  function buildExport(ctx, reportOpts, brand) {
    ctx = ctx || {};
    reportOpts = normalizeOptions(reportOpts);
    var model;
    if (ctx.kind === "detail") {
      var tips = collectTipsFromDetail(ctx.detail);
      var meta = ctx.meta || {};
      var opts = ctx.opts || {};
      model = buildModel(tips, {
        window: opts.window || "season",
        now: opts.now,
        serverName: meta.serverName || meta.name || "Server",
        title: meta.title || "Server performance report",
        periodLabel: meta.periodLabel || opts.periodLabel || "Lifetime",
        tipsterName: meta.tipsterName || ""
      });
    } else {
      var packs = ctx.packs || [];
      var optsP = ctx.opts || {};
      var tipsP = collectTipsFromPacks(packs);
      var serverName = optsP.serverName;
      if (!serverName && packs.length === 1) {
        var s0 = packs[0].server || {};
        serverName = s0.display_name || s0.name || "Server";
      }
      if (!serverName) serverName = "All communities";
      model = buildModel(tipsP, {
        window: optsP.window,
        now: optsP.now,
        serverName: serverName,
        title: optsP.title || "Performance report",
        periodLabel: optsP.periodLabel || windowLabel(optsP.window || "season"),
        tipsterName: optsP.tipsterName || ""
      });
    }
    var html = documentHtml(model, reportOpts, brand);
    return { model: model, html: html, open: function () { return openPrint(html, model.title); } };
  }

  function exportFromPacks(packs, opts, reportOpts, brand) {
    return buildExport({ kind: "packs", packs: packs, opts: opts || {} }, reportOpts, brand);
  }

  function exportFromDetail(detail, meta, opts, reportOpts, brand) {
    return buildExport({ kind: "detail", detail: detail, meta: meta || {}, opts: opts || {} }, reportOpts, brand);
  }

  function sheetCssText() {
    return (
      ".rpdf-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:1200;display:flex;align-items:flex-end;justify-content:center;padding:0}" +
      ".rpdf-sheet{background:var(--card,#12151c);color:var(--txt,#eef2f8);border:1px solid var(--line,#2a3142);border-radius:20px 20px 0 0;width:100%;max-width:520px;max-height:min(92vh,720px);overflow:auto;padding:18px 18px calc(18px + env(safe-area-inset-bottom,0px));box-shadow:0 -12px 40px rgba(0,0,0,.4)}" +
      ".rpdf-sheet::before{content:'';display:block;width:38px;height:5px;border-radius:99px;background:var(--line,#2a3142);margin:0 auto 14px}" +
      ".rpdf-sheet h3{margin:0 0 4px;font-size:var(--t-h3,1.15rem)}" +
      ".rpdf-sub{color:var(--muted,#8b95a8);font-size:var(--t-foot,.8rem);margin:0 0 14px}" +
      ".rpdf-group{margin:0 0 14px}" +
      ".rpdf-group h4{margin:0 0 8px;font-size:var(--t-cap,.72rem);text-transform:uppercase;letter-spacing:.08em;color:var(--muted,#8b95a8)}" +
      ".rpdf-row{display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid var(--line,#2a3142);font-size:var(--t-sub,.9rem)}" +
      ".rpdf-row:last-child{border-bottom:0}" +
      ".rpdf-row input[type=checkbox]{width:18px;height:18px;margin-top:2px;flex:none}" +
      ".rpdf-row label{flex:1;cursor:pointer}" +
      ".rpdf-row.rpdf-disabled{opacity:.55}" +
      ".rpdf-row.rpdf-disabled label{cursor:default}" +
      ".rpdf-nest{padding-left:28px}" +
      ".rpdf-brand input[type=text],.rpdf-brand input[type=color]{width:100%;min-height:44px;border-radius:var(--r-sm,8px);border:1px solid var(--line,#2a3142);background:var(--card2,#0f1218);color:var(--txt,#eef2f8);font:inherit;padding:8px 10px;box-sizing:border-box}" +
      ".rpdf-brand input[type=color]{padding:4px;height:44px}" +
      ".rpdf-acts{display:flex;gap:10px;margin-top:16px}" +
      ".rpdf-acts .btn,.rpdf-acts .ghost{flex:1;min-height:48px}" +
      "@media(min-width:641px){.rpdf-backdrop{align-items:center;padding:16px}.rpdf-sheet{border-radius:18px;max-height:85vh}.rpdf-sheet::before{display:none}}"
    );
  }

  function injectSheetCss() {
    var doc = root.document;
    if (!doc || doc.getElementById("rpdf-sheet-css")) return;
    var s = doc.createElement("style");
    s.id = "rpdf-sheet-css";
    s.textContent = sheetCssText();
    (doc.head || doc.documentElement).appendChild(s);
  }

  function checkboxRow(id, label, checked, disabled) {
    return '<div class="rpdf-row' + (disabled ? " rpdf-disabled" : "") + '">' +
      '<input type="checkbox" id="' + esc(id) + '" data-rpdf-key="' + esc(id) + '"' +
      (checked ? " checked" : "") + (disabled ? " disabled" : "") + ">" +
      '<label for="' + esc(id) + '">' + esc(label) + (disabled ? " (required)" : "") + "</label></div>";
  }

  function readSheetOptions(rootEl) {
    var opts = loadOptions();
    rootEl.querySelectorAll("input[data-rpdf-key]").forEach(function (inp) {
      var key = inp.getAttribute("data-rpdf-key");
      if (!key) return;
      if (key.indexOf("log.") === 0) {
        opts.logColumns[key.slice(4)] = !!inp.checked;
      } else if (opts.sections.hasOwnProperty(key)) {
        opts.sections[key] = key === "cover" ? true : !!inp.checked;
      }
    });
    return normalizeOptions(opts);
  }

  function openCustomizeSheet(ctx, onConfirm) {
    var doc = root.document;
    if (!doc || !doc.body) {
      if (onConfirm) onConfirm(loadOptions(), loadBrand(ctx.guildId));
      return;
    }
    injectSheetCss();
    var opts = loadOptions();
    var brandCustom = !!ctx.brandCustom;
    var brand = brandCustom ? loadBrand(ctx.guildId) : { displayName: "", accent: "", logoDataUrl: "" };
    var backdrop = doc.createElement("div");
    backdrop.className = "rpdf-backdrop";
    backdrop.setAttribute("role", "presentation");
    var sheet = doc.createElement("div");
    sheet.className = "rpdf-sheet";
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-modal", "true");
    sheet.setAttribute("aria-labelledby", "rpdf-title");

    var sec = opts.sections;
    var cols = opts.logColumns;
    var html = '<h3 id="rpdf-title">Customise report</h3><p class="rpdf-sub">Choose sections and columns. Your choices are remembered on this device.</p>' +
      '<div class="rpdf-group"><h4>Sections</h4>' +
      checkboxRow("cover", "Cover page", true, true) +
      checkboxRow("summary", "Executive summary", sec.summary, false) +
      checkboxRow("chartCumulative", "Chart — cumulative profit", sec.chartCumulative, false) +
      checkboxRow("chartMonthly", "Chart — monthly P&amp;L", sec.chartMonthly, false) +
      checkboxRow("chartSportWin", "Chart — win rate by sport", sec.chartSportWin, false) +
      checkboxRow("chartBetMix", "Chart — bet-type mix", sec.chartBetMix, false) +
      checkboxRow("breakdownSport", "Breakdown — by sport", sec.breakdownSport, false) +
      checkboxRow("breakdownMarket", "Breakdown — by market", sec.breakdownMarket, false) +
      checkboxRow("breakdownSinglesMultis", "Breakdown — singles vs multis", sec.breakdownSinglesMultis, false) +
      checkboxRow("breakdownOdds", "Breakdown — odds bands", sec.breakdownOdds, false) +
      checkboxRow("breakdownWeekday", "Breakdown — day of week", sec.breakdownWeekday, false) +
      checkboxRow("breakdownRacingSports", "Breakdown — racing vs sports", sec.breakdownRacingSports, false) +
      checkboxRow("log", "Tip log table", sec.log, false) +
      checkboxRow("notes", "Notes and disclaimer", sec.notes, false) +
      "</div>" +
      '<div class="rpdf-group"><h4>Tip log columns</h4>' +
      checkboxRow("log.date", "Date", cols.date, false) +
      checkboxRow("log.event", "Event", cols.event, false) +
      checkboxRow("log.legs", "Legs (silks / guernseys)", cols.legs, false) +
      checkboxRow("log.odds", "Odds", cols.odds, false) +
      checkboxRow("log.stake", "Stake", cols.stake, false) +
      checkboxRow("log.result", "Result", cols.result, false) +
      checkboxRow("log.pl", "Profit / loss", cols.pl, false) +
      "</div>";

    if (brandCustom) {
      html += '<div class="rpdf-group rpdf-brand"><h4>Custom branding</h4>' +
        '<p class="rpdf-sub" style="margin-bottom:10px">Optional logo, display name and accent colour on the cover.</p>' +
        '<div class="rpdf-row" style="flex-direction:column;align-items:stretch;gap:6px;border:0;padding:0 0 10px">' +
        '<label for="rpdf-brand-name">Display name</label>' +
        '<input type="text" id="rpdf-brand-name" maxlength="80" placeholder="Your tipster name" value="' + esc(brand.displayName) + '">' +
        "</div>" +
        '<div class="rpdf-row" style="flex-direction:column;align-items:stretch;gap:6px;border:0;padding:0 0 10px">' +
        '<label for="rpdf-brand-accent">Accent colour</label>' +
        '<input type="color" id="rpdf-brand-accent" value="' + esc(brand.accent || PALETTE.accent) + '">' +
        "</div>" +
        '<div class="rpdf-row" style="flex-direction:column;align-items:stretch;gap:6px;border:0;padding:0">' +
        '<label for="rpdf-brand-logo">Logo image</label>' +
        '<input type="file" id="rpdf-brand-logo" accept="image/png,image/jpeg,image/webp,image/svg+xml">' +
        (brand.logoDataUrl ? '<p class="rpdf-sub">Logo saved on this device. Upload again to replace.</p>' : "") +
        "</div></div>";
    }

    html += '<div class="rpdf-acts"><button type="button" class="ghost" id="rpdf-cancel">Cancel</button><button type="button" class="btn sm" id="rpdf-go">Create report</button></div>';
    sheet.innerHTML = html;

    var logoData = brand.logoDataUrl || "";
    var logoInput = sheet.querySelector("#rpdf-brand-logo");
    if (logoInput) {
      logoInput.onchange = function () {
        var file = logoInput.files && logoInput.files[0];
        if (!file) return;
        if (file.size > 180000) return;
        var reader = new FileReader();
        reader.onload = function () {
          if (typeof reader.result === "string") logoData = reader.result;
        };
        reader.readAsDataURL(file);
      };
    }

    function close() {
      backdrop.remove();
    }
    function persistBrand() {
      if (!brandCustom) return { displayName: "", accent: "", logoDataUrl: "" };
      var nameEl = sheet.querySelector("#rpdf-brand-name");
      var accentEl = sheet.querySelector("#rpdf-brand-accent");
      var next = {
        displayName: nameEl ? nameEl.value : "",
        accent: accentEl ? accentEl.value : "",
        logoDataUrl: logoData
      };
      saveBrand(ctx.guildId, next);
      return loadBrand(ctx.guildId);
    }

    sheet.querySelector("#rpdf-cancel").onclick = close;
    backdrop.addEventListener("click", function (ev) {
      if (ev.target === backdrop) close();
    });
    sheet.querySelector("#rpdf-go").onclick = function () {
      var nextOpts = readSheetOptions(sheet);
      saveOptions(nextOpts);
      var nextBrand = persistBrand();
      close();
      if (onConfirm) onConfirm(nextOpts, nextBrand);
    };
    sheet.querySelectorAll("input[data-rpdf-key]").forEach(function (inp) {
      inp.addEventListener("change", function () {
        saveOptions(readSheetOptions(sheet));
      });
    });

    backdrop.appendChild(sheet);
    doc.body.appendChild(backdrop);
    var go = sheet.querySelector("#rpdf-go");
    if (go) go.focus();
  }

  function promptExport(ctx) {
    ctx = ctx || {};
    openCustomizeSheet(ctx, function (reportOpts, brand) {
      var out = buildExport(ctx, reportOpts, ctx.brandCustom ? brand : null);
      if (out && out.open) out.open();
    });
  }

  var api = {
    PALETTE: PALETTE,
    OPTS_KEY: OPTS_KEY,
    BRAND_KEY: BRAND_KEY,
    defaultOptions: defaultOptions,
    normalizeOptions: normalizeOptions,
    loadOptions: loadOptions,
    saveOptions: saveOptions,
    loadBrand: loadBrand,
    saveBrand: saveBrand,
    brandCustomAllowed: brandCustomAllowed,
    isPublicTip: isPublicTip,
    isHiddenTip: isHiddenTip,
    collectTipsFromPacks: collectTipsFromPacks,
    collectTipsFromDetail: collectTipsFromDetail,
    buildModel: buildModel,
    buildExport: buildExport,
    documentHtml: documentHtml,
    cssText: cssText,
    sheetCssText: sheetCssText,
    openPrint: openPrint,
    openCustomizeSheet: openCustomizeSheet,
    promptExport: promptExport,
    exportFromPacks: exportFromPacks,
    exportFromDetail: exportFromDetail,
    fmtUnits: fmtUnits,
    windowLabel: windowLabel
  };
  root.TBPdfReport = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
