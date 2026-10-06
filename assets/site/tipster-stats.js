/* Tipdash 0.45.1 — public tipster stats from tip rows.
 * Historical imports are dropped before any record, chart or form is computed.
 * A tip is an import when imported or is_historical is set, or source is "import".
 * Browser global TipsterStats + CommonJS.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.TipsterStats = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  /* SWAP POINT: set this to the API origin ("" for same-origin) when
     GET /api/public/tipster/<handle> exists. null keeps the example file. */
  var PUBLIC_TIPSTER_API = null;

  function flagTrue(v) {
    return v === true || v === 1 || v === "1" || v === "true" || v === "yes";
  }

  function isHistoricalImport(tip) {
    if (!tip || typeof tip !== "object") return false;
    if (flagTrue(tip.imported) || flagTrue(tip.is_historical)) return true;
    var source = tip.source == null ? "" : String(tip.source).trim().toLowerCase();
    return source === "import";
  }

  function resultOf(tip) {
    if (flagTrue(tip.pending)) return "pending";
    var raw = tip.res != null ? tip.res : (tip.result != null ? tip.result : tip.status);
    var s = String(raw == null ? "" : raw).trim().toUpperCase();
    if (s === "W" || s === "WIN" || s === "WON") return "W";
    if (s === "L" || s === "LOSS" || s === "LOST") return "L";
    if (s === "PUSH" || s === "VOID" || s === "V" || s === "P") return "P";
    if (s === "PENDING" || s === "OPEN" || s === "PEND") return "pending";
    if (String(tip.status || "").trim().toLowerCase() === "pending") return "pending";
    return "";
  }

  function round1(n) {
    return Math.round((n + Number.EPSILON) * 10) / 10;
  }
  function round2(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  function num(v) {
    var n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function viewRow(tip, result) {
    var pl = num(tip.pl != null ? tip.pl : tip.profit);
    var odds = num(tip.odds);
    var stake = num(tip.stake != null ? tip.stake : tip.units);
    return {
      result: result,
      selection: tip.sel != null ? String(tip.sel) : (tip.selection != null ? String(tip.selection) : ""),
      match: tip.match != null ? String(tip.match) : "",
      round: tip.rnd != null ? tip.rnd : (tip.round != null ? tip.round : null),
      book: tip.book != null ? String(tip.book) : (tip.bookmaker != null ? String(tip.bookmaker) : ""),
      odds: odds,
      stake: stake,
      pl: pl,
      time: tip.time != null ? String(tip.time) : "",
      venue: tip.venue != null ? String(tip.venue) : ""
    };
  }

  function formatUnits(n, decimals) {
    var v = Number(n);
    if (!Number.isFinite(v)) v = 0;
    var d = decimals == null ? 1 : decimals;
    var sign = v > 0 ? "+" : (v < 0 ? "\u2212" : "");
    return sign + Math.abs(v).toFixed(d) + "u";
  }

  function formatPct(n, signed) {
    var v = Number(n);
    if (!Number.isFinite(v)) return "\u2014";
    var sign = signed ? (v > 0 ? "+" : (v < 0 ? "\u2212" : "")) : (v < 0 ? "\u2212" : "");
    return sign + Math.abs(v).toFixed(1) + "%";
  }

  function computeTipsterStats(tips) {
    var list = Array.isArray(tips) ? tips : [];
    var excludedImports = 0;
    var pending = [];
    var settledRaw = [];
    for (var i = 0; i < list.length; i++) {
      var tip = list[i];
      if (!tip || typeof tip !== "object") continue;
      if (isHistoricalImport(tip)) {
        excludedImports += 1;
        continue;
      }
      var result = resultOf(tip);
      if (result === "pending") pending.push(viewRow(tip, "pending"));
      else if (result === "W" || result === "L" || result === "P") settledRaw.push({tip: tip, result: result});
    }
    settledRaw.sort(function (a, b) {
      var ai = Number(a.tip.i);
      var bi = Number(b.tip.i);
      var aOk = Number.isFinite(ai);
      var bOk = Number.isFinite(bi);
      if (aOk && bOk && ai !== bi) return ai - bi;
      if (aOk !== bOk) return aOk ? -1 : 1;
      return 0;
    });

    var wins = 0;
    var losses = 0;
    var pushes = 0;
    var units = 0;
    var staked = 0;
    var oddsSum = 0;
    var oddsN = 0;
    var settled = [];
    var roundOrder = [];
    var roundEnd = {};
    for (var s = 0; s < settledRaw.length; s++) {
      var raw = settledRaw[s];
      var resultS = raw.result;
      var row = viewRow(raw.tip, resultS);
      var pl = row.pl == null ? 0 : row.pl;
      units = round2(units + pl);
      if (resultS === "W") wins += 1;
      else if (resultS === "L") losses += 1;
      else pushes += 1;
      if (resultS === "W" || resultS === "L") {
        var stake = row.stake == null ? 0 : row.stake;
        staked = round2(staked + stake);
        if (row.odds != null) {
          oddsSum += row.odds;
          oddsN += 1;
        }
      }
      settled.push(row);
      var key = row.round == null || row.round === "" ? ("tip:" + s) : ("r:" + row.round);
      if (roundEnd[key] == null) roundOrder.push({key: key, round: row.round});
      roundEnd[key] = units;
    }

    var decided = wins + losses;
    var strikeRate = decided ? round1((100 * wins) / decided) : null;
    var roi = staked ? round1((100 * units) / staked) : null;
    var avgOdds = oddsN ? round2(oddsSum / oddsN) : null;

    var lastSlice = settled.slice(-10);
    var last10 = lastSlice.map(function (row) { return row.result; }).reverse();
    var last10Wins = 0;
    var last10Losses = 0;
    last10.forEach(function (r) {
      if (r === "W") last10Wins += 1;
      else if (r === "L") last10Losses += 1;
    });

    var streak = null;
    if (settled.length && (settled[settled.length - 1].result === "W" || settled[settled.length - 1].result === "L")) {
      var type = settled[settled.length - 1].result;
      var n = 0;
      for (var k = settled.length - 1; k >= 0 && settled[k].result === type; k--) n += 1;
      streak = {type: type, n: n, hot: type === "W" && n >= 3};
    }

    var unitsSeries = [];
    var running = 0;
    settled.forEach(function (row) {
      running = round2(running + (row.pl == null ? 0 : row.pl));
      unitsSeries.push(running);
    });
    var roundSeries = [0];
    var rounds = [];
    roundOrder.forEach(function (item) {
      rounds.push(item.round);
      roundSeries.push(roundEnd[item.key]);
    });

    return {
      excludedImports: excludedImports,
      wins: wins,
      losses: losses,
      pushes: pushes,
      pendingCount: pending.length,
      settledCount: settled.length,
      units: units,
      staked: staked,
      roi: roi,
      strikeRate: strikeRate,
      avgOdds: avgOdds,
      last10: last10,
      last10Wins: last10Wins,
      last10Losses: last10Losses,
      streak: streak,
      settled: settled,
      recent: settled.slice().reverse(),
      pending: pending,
      unitsSeries: unitsSeries,
      rounds: rounds,
      roundSeries: roundSeries
    };
  }

  function readJson(res) {
    if (!res || !res.ok) {
      var status = res && res.status;
      var err = new Error("tipster_http_" + (status == null ? "0" : status));
      err.status = status || 0;
      throw err;
    }
    return typeof res.json === "function" ? res.json() : res;
  }

  function loadPublicTipster(handle, options) {
    var opts = options || {};
    var fetchFn = opts.fetch;
    if (typeof fetchFn !== "function") return Promise.reject(new Error("fetch required"));
    var api = opts.apiBase !== undefined ? opts.apiBase : PUBLIC_TIPSTER_API;
    var name = String(handle == null ? "" : handle);
    if (api) {
      var url = String(api).replace(/\/$/, "") + "/api/public/tipster/" + encodeURIComponent(name);
      return Promise.resolve(fetchFn(url, {headers: {Accept: "application/json"}})).then(readJson);
    }
    var exampleUrl = opts.exampleUrl || "/assets/site/example-tipster.json";
    return Promise.resolve(fetchFn(exampleUrl, {headers: {Accept: "application/json"}})).then(readJson).then(function (data) {
      var body = data && typeof data === "object" ? data : {};
      return Object.assign({}, body, {example: true, requestedHandle: name});
    });
  }

  function tipsterHandleFromPath(pathname) {
    var path = String(pathname || "");
    var m = path.match(/\/t\/([^/]+)\/?$/);
    if (!m) return null;
    var raw;
    try { raw = decodeURIComponent(m[1]); }
    catch (e) { return null; }
    if (raw.toLowerCase() === "index.html") return null;
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/.test(raw)) return null;
    return raw.toLowerCase();
  }

  function tipsterHandleFromQuery(search) {
    var q = String(search || "");
    if (q.charAt(0) === "?") q = q.slice(1);
    var params = {};
    q.split("&").forEach(function (part) {
      if (!part) return;
      var bits = part.split("=");
      params[decodeURIComponent(bits[0] || "")] = decodeURIComponent((bits.slice(1).join("=")) || "");
    });
    var raw = params.handle == null ? "" : String(params.handle).trim();
    if (!raw) return null;
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/.test(raw)) return null;
    return raw.toLowerCase();
  }

  return {
    PUBLIC_TIPSTER_API: PUBLIC_TIPSTER_API,
    isHistoricalImport: isHistoricalImport,
    computeTipsterStats: computeTipsterStats,
    loadPublicTipster: loadPublicTipster,
    tipsterHandleFromPath: tipsterHandleFromPath,
    tipsterHandleFromQuery: tipsterHandleFromQuery,
    formatUnits: formatUnits,
    formatPct: formatPct
  };
});
