/* All-time units figure and the cumulative line for a follower community.
   window.FollowerUnits + CommonJS for node --test.
   The hero number is all-time. The line follows the Showing period. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FollowerUnits = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c];
    });
  }

  function num(v) {
    if (v == null || v === "") return null;
    var n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function round2(n) {
    return Math.round(n * 100) / 100;
  }

  function resultOf(tip) {
    return String((tip && (tip.result || tip.follow_result || tip.tip_result)) || "").trim().toLowerCase();
  }

  function settledProfit(tip) {
    var result = resultOf(tip);
    if (result !== "win" && result !== "won" && result !== "loss" && result !== "lost") return null;
    var p = num(tip && tip.profit_units);
    if (p == null) return null;
    return p;
  }

  function tipMs(tip) {
    var v = tip && (tip.settled_at || tip.follow_settled_at || tip.created_at || tip.timestamp || tip.post_at || tip.ts);
    if (v == null || v === "") return null;
    if (typeof v === "number" && Number.isFinite(v)) return v < 1e12 ? v * 1000 : v;
    var n = Date.parse(v);
    return Number.isFinite(n) ? n : null;
  }

  function monthKey(ms, clock) {
    if (clock && typeof clock.monthKey === "function") return clock.monthKey(ms);
    var d = new Date(ms);
    return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0");
  }

  function inPeriod(ms, month, clock) {
    if (!month) return true;
    if (ms == null) return false;
    return monthKey(ms, clock) === month;
  }

  function series(feed, month, clock) {
    var rows = [];
    (feed || []).forEach(function (tip, i) {
      var profit = settledProfit(tip);
      if (profit == null) return;
      var ms = tipMs(tip);
      if (!inPeriod(ms, month, clock)) return;
      rows.push({i: i, ms: ms, p: profit});
    });
    rows.sort(function (a, b) {
      if (a.ms == null && b.ms == null) return a.i - b.i;
      if (a.ms == null) return 1;
      if (b.ms == null) return -1;
      return a.ms - b.ms || a.i - b.i;
    });
    var points = [{y: 0}];
    var run = 0;
    rows.forEach(function (row) {
      run = round2(run + row.p);
      points.push({y: run, ms: row.ms});
    });
    return points;
  }

  function heroText(profit) {
    var n = num(profit);
    if (n == null) n = 0;
    n = round2(n);
    var body = Math.abs(n).toFixed(2) + "u";
    if (n > 0) return {text: "+" + body, cls: "pos"};
    if (n < 0) return {text: "-" + body, cls: "neg"};
    return {text: "0.00u", cls: "zero"};
  }

  function heroHtml(profit) {
    var h = heroText(profit);
    return '<section class="fl-units-hero" aria-label="All-time units">'
      + '<p class="k">All-time units</p>'
      + '<p class="fl-units-num ' + h.cls + '">' + esc(h.text) + "</p>"
      + "</section>";
  }

  function chartSvg(points) {
    var pts = points && points.length ? points : [{y: 0}];
    var w = 360;
    var h = 156;
    var padX = 12;
    var padT = 16;
    var padB = 28;
    var min = 0;
    var max = 0;
    var i;
    for (i = 0; i < pts.length; i++) {
      if (pts[i].y < min) min = pts[i].y;
      if (pts[i].y > max) max = pts[i].y;
    }
    if (min === max) {
      min -= 1;
      max += 1;
    }
    function x(i) {
      if (pts.length === 1) return w / 2;
      return padX + (i / (pts.length - 1)) * (w - padX * 2);
    }
    function y(v) {
      return padT + (1 - (v - min) / (max - min)) * (h - padT - padB);
    }
    var coords = [];
    for (i = 0; i < pts.length; i++) {
      coords.push({x: x(i), y: y(pts[i].y), v: pts[i].y});
    }
    var zero = y(0);
    var fills = "";
    for (i = 0; i < coords.length - 1; i++) {
      var a = coords[i];
      var b = coords[i + 1];
      var parts = [];
      if ((a.v >= 0 && b.v >= 0) || (a.v <= 0 && b.v <= 0)) parts.push([a, b]);
      else {
        var t = (0 - a.v) / (b.v - a.v);
        var mid = {x: a.x + (b.x - a.x) * t, y: zero, v: 0};
        parts.push([a, mid], [mid, b]);
      }
      var p;
      for (p = 0; p < parts.length; p++) {
        var seg = parts[p];
        var up = seg[0].v + seg[1].v >= 0;
        fills += '<path d="M' + seg[0].x.toFixed(1) + " " + seg[0].y.toFixed(1)
          + " L" + seg[1].x.toFixed(1) + " " + seg[1].y.toFixed(1)
          + " L" + seg[1].x.toFixed(1) + " " + zero.toFixed(1)
          + " L" + seg[0].x.toFixed(1) + " " + zero.toFixed(1)
          + ' Z" fill="' + (up ? "var(--win)" : "var(--loss)") + '" fill-opacity="0.22"/>';
      }
    }
    var d = "";
    for (i = 0; i < coords.length; i++) {
      d += (i ? "L" : "M") + coords[i].x.toFixed(1) + " " + coords[i].y.toFixed(1) + " ";
    }
    var first = pts[0].y;
    var last = pts[pts.length - 1].y;
    var stroke = last > 0 ? "var(--win)" : last < 0 ? "var(--loss)" : "var(--muted)";
    var start = coords[0];
    var end = coords[coords.length - 1];
    return '<svg class="fl-units-chart" viewBox="0 0 ' + w + " " + h + '" role="img" aria-label="Cumulative units">'
      + '<line class="fl-units-zero" x1="' + padX + '" y1="' + zero.toFixed(1) + '" x2="' + (w - padX) + '" y2="' + zero.toFixed(1) + '" stroke="var(--line)" stroke-width="1" stroke-dasharray="4 4"/>'
      + fills
      + '<path d="' + d.trim() + '" fill="none" stroke="' + stroke + '" stroke-width="2.75" stroke-linejoin="round" stroke-linecap="round"/>'
      + '<text class="fl-units-label" x="' + start.x.toFixed(1) + '" y="' + (h - 8) + '" text-anchor="start" fill="var(--muted)">' + esc(heroText(first).text) + "</text>"
      + '<text class="fl-units-label" x="' + end.x.toFixed(1) + '" y="' + (h - 8) + '" text-anchor="end" fill="' + stroke + '">' + esc(heroText(last).text) + "</text>"
      + "</svg>";
  }

  function chartHtml(points) {
    return '<div class="fl-units-chart-wrap">' + chartSvg(points) + "</div>";
  }

  return {
    settledProfit: settledProfit,
    tipMs: tipMs,
    series: series,
    heroText: heroText,
    heroHtml: heroHtml,
    chartSvg: chartSvg,
    chartHtml: chartHtml
  };
});
