/* Chart adapter (tipdash). Time series, areas and sparklines use uPlot (MIT).
 * Bars and donuts use a modular Apache ECharts build (pie, bar, grid, tooltip,
 * canvas). Both files are self-hosted under assets/vendor. Hosts are inert
 * until they are near the viewport. window.TBCharts + CommonJS for node --test.
 */
(function (root) {
  "use strict";
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c];
    });
  }
  function num(v) {
    var n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  function docOf() {
    return typeof document !== "undefined" ? document : null;
  }
  function reduced() {
    try { return !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches); }
    catch (e) { return false; }
  }
  function fmtUnit(v, spec) {
    spec = spec || {};
    var n = Number(v);
    if (!Number.isFinite(n)) return "\u2014";
    var r = Math.round(n * 10) / 10;
    var body = Math.abs(r % 1) < 0.05 ? String(Math.round(r)) : r.toFixed(1);
    if (r === 0) body = "0";
    var unit = spec.unit == null ? "u" : String(spec.unit);
    var signed = !!spec.signed;
    if (unit === "$") {
      var abs = body.replace(/^-/, "");
      if (r < 0) return "-$" + abs;
      return (signed && r > 0 ? "+" : "") + "$" + abs;
    }
    var prefix = signed && r > 0 ? "+" : "";
    if (unit === "%") return prefix + body + "%";
    if (!unit) return prefix + body;
    return prefix + body + unit;
  }
  function seriesTone(data, mode) {
    var vals = data || [];
    if (!vals.length) return "accent";
    var last = num(vals[vals.length - 1]);
    var first = num(vals[0]);
    if (mode === "accent") return "accent";
    if (mode === "trend") return last >= first ? "win" : "loss";
    return last >= 0 ? "win" : "loss";
  }
  function plotY(v, min, max, h) {
    var span = (max - min) || 1;
    var pad = 4;
    var height = h || 36;
    return pad + (1 - (num(v) - min) / span) * (height - pad * 2);
  }
  function hasData(spec) {
    if (!spec) return false;
    if (spec.kind === "bar") return Array.isArray(spec.bars) && spec.bars.length > 0;
    if (spec.kind === "donut") {
      return Array.isArray(spec.slices) && spec.slices.some(function (s) { return num(s && s.n) > 0; });
    }
    return Array.isArray(spec.data) && spec.data.length >= 2;
  }
  function shell(spec) {
    spec = spec || {};
    if (!hasData(spec)) return "";
    var kind = spec.kind || "line";
    var height = spec.height || (kind === "spark" ? 36 : (kind === "donut" ? 112 : 220));
    var json = JSON.stringify(spec).replace(/</g, "\\u003c");
    var cls = "tb-chart tb-chart--" + kind + (kind === "donut" ? " tb-donut" : "");
    if (spec.className) cls += " " + String(spec.className).replace(/[^a-zA-Z0-9 _-]/g, "");
    var mid = "";
    if (kind === "donut") {
      mid = '<div class="tb-donut-mid"><b>' + esc(spec.center != null ? spec.center : "") + "</b><span>" + esc(spec.sub || "") + "</span></div>";
    }
    return '<div class="' + cls + '" data-tb-kind="' + esc(kind) + '" data-tb-lazy="1" role="img" aria-label="' + esc(spec.aria || "Chart") + '" style="height:' + height + 'px">'
      + '<div class="tb-plot"></div>'
      + mid
      + '<script type="application/json" class="tb-spec">' + json + "</script></div>";
  }
  function areaChart(opts) {
    opts = opts || {};
    return shell({
      kind: opts.kind === "spark" ? "spark" : "line",
      data: (opts.data || []).map(num),
      xLabels: opts.xLabels || [],
      pointLabels: opts.pointLabels || [],
      aria: opts.aria || opts.label || "Units over time",
      unit: opts.unit == null ? "u" : opts.unit,
      signed: opts.signed !== false,
      height: opts.height || opts.h || 220,
      fill: opts.fill !== false,
      colorMode: opts.colorMode || "end",
      yMin: opts.yMin,
      yMax: opts.yMax,
      className: opts.className || ""
    });
  }
  function barChart(opts) {
    opts = opts || {};
    return shell({
      kind: "bar",
      bars: opts.bars || [],
      aria: opts.aria || "Monthly profit and loss",
      unit: opts.unit == null ? "u" : opts.unit,
      signed: opts.signed !== false,
      height: opts.height || opts.h || 220,
      filter: opts.filter || "",
      className: opts.className || ""
    });
  }
  function donut(opts) {
    opts = opts || {};
    return shell({
      kind: "donut",
      slices: opts.slices || [],
      center: opts.center != null ? String(opts.center) : "",
      sub: opts.sub != null ? String(opts.sub) : "bets",
      aria: opts.aria || "Split",
      height: opts.height || 112,
      filter: opts.filter || "",
      className: opts.className || ""
    });
  }
  function spark(opts) {
    opts = opts || {};
    return shell({
      kind: "spark",
      data: (opts.data || []).map(num),
      aria: opts.aria || "Trend",
      unit: opts.unit == null ? "u" : opts.unit,
      signed: opts.signed !== false,
      height: opts.height || 36,
      colorMode: opts.colorMode || "trend",
      className: opts.className || ""
    });
  }

  var libP = { uplot: null, echarts: null };
  var io = null;
  function assetBase() {
    var doc = docOf();
    if (!doc) return "./assets/";
    var scripts = doc.getElementsByTagName("script");
    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].src || "";
      if (/tb-charts\.js/.test(src)) return src.replace(/tb-charts\.js.*$/, "");
    }
    return "./assets/";
  }
  function loadScript(url) {
    return new Promise(function (resolve, reject) {
      var doc = docOf();
      var s = doc.createElement("script");
      s.src = url;
      s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error("chart")); };
      doc.head.appendChild(s);
    });
  }
  function loadCss(url) {
    var doc = docOf();
    if (!doc || doc.querySelector('link[data-tb-css="' + url + '"]')) return;
    var l = doc.createElement("link");
    l.rel = "stylesheet";
    l.href = url;
    l.setAttribute("data-tb-css", url);
    doc.head.appendChild(l);
  }
  function ensureLib(kind) {
    var key = (kind === "bar" || kind === "donut") ? "echarts" : "uplot";
    if (key === "uplot" && root.uPlot) return Promise.resolve();
    if (key === "echarts" && root.echarts) return Promise.resolve();
    if (libP[key]) return libP[key];
    var base = assetBase();
    if (key === "uplot") {
      loadCss(base + "vendor/uplot/uPlot.min.css");
      libP[key] = loadScript(base + "vendor/uplot/uPlot.iife.min.js");
    } else {
      libP[key] = loadScript(base + "vendor/echarts/echarts-pie-bar.min.js");
    }
    return libP[key];
  }
  function cssVar(el, name, fallback) {
    try {
      var cs = root.getComputedStyle(el || docOf().documentElement);
      var v = (cs.getPropertyValue(name) || "").trim();
      if (v) return v;
    } catch (e) {}
    return fallback;
  }
  function colorsOf(el) {
    return {
      win: cssVar(el, "--win", "#2eaf62"),
      loss: cssVar(el, "--loss", "#e5595f"),
      accent: cssVar(el, "--accent", "#5b8cff"),
      accent2: cssVar(el, "--accent2", "#7b5bff"),
      txt: cssVar(el, "--txt", "#eef2fa"),
      muted: cssVar(el, "--muted", "#8a95ad"),
      faint: cssVar(el, "--faint", "#5c6785"),
      line: cssVar(el, "--line", "#26304a"),
      card2: cssVar(el, "--card2", "#1a2133"),
      push: cssVar(el, "--push", "#5c6785"),
      warn: cssVar(el, "--warn", "#e0a04a")
    };
  }
  function resolveColor(c, colors, el) {
    var s = String(c || "");
    var m = s.match(/var\(\s*(--[A-Za-z0-9-]+)/);
    if (!m) return s || colors.accent;
    var known = {
      "--accent": colors.accent, "--accent2": colors.accent2, "--win": colors.win,
      "--loss": colors.loss, "--push": colors.push, "--warn": colors.warn
    };
    return known[m[1]] || cssVar(el, m[1], colors.accent);
  }
  function withAlpha(color, a) {
    var hex = String(color || "").trim();
    var m = hex.match(/^#([0-9a-f]{6})$/i);
    if (m) {
      var n = parseInt(m[1], 16);
      return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
    }
    var rgb = hex.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (rgb) return "rgba(" + rgb[1] + "," + rgb[2] + "," + rgb[3] + "," + a + ")";
    return color;
  }
  function readSpec(el) {
    if (el._tbSpec) return el._tbSpec;
    var node = el.querySelector && el.querySelector(".tb-spec");
    if (!node) return null;
    try { el._tbSpec = JSON.parse(node.textContent || ""); }
    catch (e) { return null; }
    if (node.parentNode) node.parentNode.removeChild(node);
    return el._tbSpec;
  }
  function labelAt(spec, i) {
    var labs = spec.xLabels || [];
    for (var k = 0; k < labs.length; k++) {
      if (Number(labs[k][0]) === i) return String(labs[k][1] == null ? "" : labs[k][1]);
    }
    return "";
  }
  function lineTip(spec, i) {
    var named = (spec.pointLabels && spec.pointLabels[i]) || labelAt(spec, i);
    var lab = named || ((i + 1) + " of " + spec.data.length);
    return lab + " \u00b7 " + fmtUnit(spec.data[i], spec);
  }
  function niceSplits(min, max) {
    if (!(max > min)) return [min];
    var span = max - min;
    var raw = span / 4;
    var pow = Math.pow(10, Math.floor(Math.log10(raw)));
    var err = raw / pow;
    var nice = err <= 1 ? 1 : err <= 2 ? 2 : err <= 5 ? 5 : 10;
    var step = nice * pow;
    var start = Math.ceil(min / step) * step;
    var out = [];
    for (var v = start; v <= max + step * 0.01; v += step) {
      var t = Math.round(v * 1000) / 1000;
      if (t < min - 1e-6 || t > max + 1e-6) continue;
      out.push(t);
      if (out.length > 6) break;
    }
    if (min <= 0 && max >= 0 && out.indexOf(0) < 0) out.push(0);
    out.sort(function (a, b) { return a - b; });
    return out.length ? out : [min, max];
  }
  function destroy(el) {
    if (el._tbPlot && el._tbPlot.destroy) { try { el._tbPlot.destroy(); } catch (e) {} }
    el._tbPlot = null;
    if (el._tbEc && el._tbEc.dispose) { try { el._tbEc.dispose(); } catch (e2) {} }
    el._tbEc = null;
    if (el._tbRo) { try { el._tbRo.disconnect(); } catch (e3) {} el._tbRo = null; }
    var tip = el.querySelector && el.querySelector(".tb-tip");
    if (tip) tip.remove();
  }
  function watchSize(el, fn) {
    if (!root.ResizeObserver) return;
    var ro = new root.ResizeObserver(function () { fn(); });
    ro.observe(el);
    el._tbRo = ro;
  }
  function placeTip(el, tip, clientX, clientY) {
    var host = el.getBoundingClientRect();
    var left = clientX - host.left;
    var top = clientY - host.top - 8;
    tip.hidden = false;
    tip.style.left = Math.max(48, Math.min(left, Math.max(48, host.width - 48))) + "px";
    tip.style.top = Math.max(28, top) + "px";
  }
  function paintLine(el, spec, colors) {
    var data = spec.data || [];
    var sparkline = spec.kind === "spark";
    var height = spec.height || (sparkline ? 36 : 220);
    var host = el.querySelector(".tb-plot") || el;
    var width = Math.max(80, el.clientWidth || host.clientWidth || 320);
    var tone = seriesTone(data, spec.colorMode);
    var stroke = tone === "win" ? colors.win : (tone === "loss" ? colors.loss : colors.accent);
    var xs = data.map(function (_, i) { return i; });
    var narrow = width < 420;
    var xSplits = (spec.xLabels && spec.xLabels.length)
      ? spec.xLabels.map(function (p) { return Number(p[0]); })
      : [0, Math.round((data.length - 1) / 2), data.length - 1];
    if (narrow && xSplits.length > 3) xSplits = [xSplits[0], xSplits[xSplits.length - 1]];
    var opts = {
      width: width,
      height: height,
      pxAlign: false,
      legend: { show: false },
      cursor: sparkline ? { show: false } : {
        show: true,
        x: true,
        y: false,
        drag: { x: false, y: false, setScale: false },
        points: { show: true, size: 8, width: 2, stroke: stroke, fill: colors.card2 }
      },
      select: { show: false },
      scales: {
        x: { time: false },
        y: {
          range: function (u, min, max) {
            var lo = spec.yMin != null ? spec.yMin : Math.min(min, 0);
            var hi = spec.yMax != null ? spec.yMax : Math.max(max, 0);
            if (!(hi > lo)) { lo -= 1; hi += 1; }
            var pad = (hi - lo) * 0.08;
            return [lo - pad, hi + pad];
          }
        }
      },
      axes: sparkline ? [{ show: false }, { show: false }] : [
        {
          stroke: colors.faint,
          grid: { show: false },
          ticks: { show: true, stroke: colors.line, size: 4, width: 1 },
          font: "12px system-ui, -apple-system, sans-serif",
          gap: 4,
          splits: function () { return xSplits; },
          values: function (u, splits) {
            return splits.map(function (v) { return labelAt(spec, Math.round(v)); });
          }
        },
        {
          stroke: colors.faint,
          grid: { show: true, stroke: colors.line, width: 1 },
          ticks: { show: false },
          size: narrow ? 46 : 52,
          font: "12px system-ui, -apple-system, sans-serif",
          splits: function (u, idx, min, max) { return niceSplits(min, max); },
          values: function (u, splits) { return splits.map(function (v) { return fmtUnit(v, spec); }); }
        }
      ],
      series: [
        {},
        {
          stroke: stroke,
          width: sparkline ? 2 : 2.2,
          fill: (!sparkline && spec.fill !== false) ? withAlpha(stroke, 0.18) : undefined,
          points: { show: !sparkline && data.length <= 18, size: 5 }
        }
      ],
      hooks: sparkline ? {} : {
        draw: [function (u) {
          var y = u.valToPos(0, "y", true);
          if (!Number.isFinite(y)) return;
          var ctx = u.ctx;
          ctx.save();
          ctx.strokeStyle = colors.faint;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(u.bbox.left, y);
          ctx.lineTo(u.bbox.left + u.bbox.width, y);
          ctx.stroke();
          ctx.restore();
        }]
      }
    };
    if (sparkline) opts.padding = [4, 2, 4, 2];
    var plot = new root.uPlot(opts, [xs, data], host);
    el._tbPlot = plot;
    if (!sparkline) bindLinePointer(el, plot, spec);
    watchSize(el, function () {
      var w = el.clientWidth;
      if (w > 24 && el._tbPlot) el._tbPlot.setSize({ width: w, height: height });
    });
  }
  function bindLinePointer(el, plot, spec) {
    var over = plot.over;
    if (!over) return;
    var tip = docOf().createElement("div");
    tip.className = "tb-tip";
    tip.setAttribute("role", "tooltip");
    tip.hidden = true;
    el.appendChild(tip);
    var hideTimer = null;
    function show(ev) {
      var rect = over.getBoundingClientRect();
      var x = (ev.clientX - rect.left) / Math.max(1, rect.width);
      var i = Math.round(x * (spec.data.length - 1));
      if (i < 0) i = 0;
      if (i > spec.data.length - 1) i = spec.data.length - 1;
      tip.textContent = lineTip(spec, i);
      placeTip(el, tip, ev.clientX, ev.clientY);
      try {
        plot.setCursor({ left: plot.valToPos(i, "x"), top: plot.valToPos(spec.data[i], "y") });
      } catch (e) {}
    }
    function hideSoon(delay) {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(function () { tip.hidden = true; }, delay);
    }
    over.addEventListener("pointerdown", function (ev) {
      if (ev.pointerType !== "mouse" && over.setPointerCapture) {
        try { over.setPointerCapture(ev.pointerId); } catch (e) {}
      }
      show(ev);
    });
    over.addEventListener("pointermove", function (ev) {
      if (ev.pointerType === "mouse" || (over.hasPointerCapture && over.hasPointerCapture(ev.pointerId))) show(ev);
    });
    over.addEventListener("pointerup", function (ev) {
      if (ev.pointerType !== "mouse") hideSoon(1400);
    });
    over.addEventListener("pointerleave", function (ev) {
      if (ev.pointerType === "mouse") hideSoon(0);
    });
    over.addEventListener("pointercancel", function () { hideSoon(0); });
  }
  function paintBars(el, spec, colors) {
    var bars = spec.bars || [];
    var host = el.querySelector(".tb-plot") || el;
    var height = spec.height || 220;
    host.style.height = height + "px";
    var chart = root.echarts.init(host, null, { renderer: "canvas", width: el.clientWidth, height: height });
    el._tbEc = chart;
    var narrow = (el.clientWidth || 390) < 420;
    chart.setOption({
      animation: !reduced(),
      animationDuration: reduced() ? 0 : 280,
      grid: { left: narrow ? 46 : 52, right: 8, top: 12, bottom: narrow ? 32 : 28, containLabel: false },
      tooltip: {
        trigger: "axis",
        triggerOn: "mousemove|click",
        confine: true,
        backgroundColor: colors.card2,
        borderColor: colors.line,
        textStyle: { color: colors.txt, fontSize: 13 },
        axisPointer: { type: "shadow" },
        formatter: function (items) {
          var it = items && items[0];
          if (!it) return "";
          var b = bars[it.dataIndex] || {};
          var bets = b.bets ? " \u00b7 " + b.bets + (b.bets === 1 ? " bet" : " bets") : "";
          var wr = b.bets && b.winRate != null ? " \u00b7 " + fmtUnit(b.winRate, { unit: "%", signed: false }) + " strike" : "";
          return (b.label || b.key || "") + ": " + fmtUnit(b.value, spec) + bets + wr;
        }
      },
      xAxis: {
        type: "category",
        data: bars.map(function (b) { return b.label || ""; }),
        axisLabel: { color: colors.faint, fontSize: 12, hideOverlap: true, interval: narrow && bars.length > 6 ? "auto" : 0 },
        axisLine: { lineStyle: { color: colors.line } },
        axisTick: { show: false }
      },
      yAxis: {
        type: "value",
        axisLabel: { color: colors.faint, fontSize: 12, formatter: function (v) { return fmtUnit(v, spec); } },
        splitLine: { lineStyle: { color: colors.line } },
        axisLine: { show: false }
      },
      series: [{
        type: "bar",
        data: bars.map(function (b) {
          var v = num(b.value);
          return {
            value: v,
            itemStyle: {
              color: v > 0 ? colors.win : (v < 0 ? colors.loss : colors.faint),
              borderRadius: v >= 0 ? [3, 3, 0, 0] : [0, 0, 3, 3]
            }
          };
        }),
        barMaxWidth: 28
      }]
    });
    chart.on("click", function (p) {
      var h = el._tbHandlers;
      var b = bars[p.dataIndex];
      if (b && h && typeof h.onBar === "function" && spec.filter) h.onBar(b);
    });
    watchSize(el, function () { if (el._tbEc) el._tbEc.resize(); });
  }
  function paintDonut(el, spec, colors) {
    var slices = (spec.slices || []).filter(function (s) { return num(s.n) > 0; });
    var host = el.querySelector(".tb-plot") || el;
    var box = el.clientWidth || 112;
    var chart = root.echarts.init(host, null, { renderer: "canvas", width: box, height: box });
    el._tbEc = chart;
    chart.setOption({
      animation: !reduced(),
      animationDuration: reduced() ? 0 : 280,
      tooltip: {
        trigger: "item",
        triggerOn: "mousemove|click",
        confine: true,
        backgroundColor: colors.card2,
        borderColor: colors.line,
        textStyle: { color: colors.txt, fontSize: 13 },
        formatter: function (p) {
          var s = slices[p.dataIndex] || {};
          var pct = s.pct != null ? " \u00b7 " + s.pct + "%" : "";
          return (s.name || "") + " \u00b7 " + s.n + (s.n === 1 ? " bet" : " bets") + pct;
        }
      },
      series: [{
        type: "pie",
        radius: ["58%", "84%"],
        center: ["50%", "50%"],
        label: { show: false },
        labelLine: { show: false },
        data: slices.map(function (s) {
          return { name: s.name, value: num(s.n), itemStyle: { color: resolveColor(s.color, colors, el) } };
        })
      }]
    });
    chart.on("click", function (p) {
      var h = el._tbHandlers;
      var s = slices[p.dataIndex];
      if (s && h && typeof h.onSlice === "function" && spec.filter) h.onSlice(s.name, spec.filter);
    });
    watchSize(el, function () { if (el._tbEc) el._tbEc.resize(); });
  }
  function paint(el, spec) {
    destroy(el);
    var colors = colorsOf(el);
    if (spec.kind === "bar") paintBars(el, spec, colors);
    else if (spec.kind === "donut") paintDonut(el, spec, colors);
    else paintLine(el, spec, colors);
  }
  function draw(el) {
    if (!el || el.getAttribute("data-tb-ready") === "1") return;
    if (el.clientWidth < 24) return;
    var spec = readSpec(el);
    if (!spec) return;
    if (io) io.unobserve(el);
    el.setAttribute("data-tb-ready", "wait");
    ensureLib(spec.kind).then(function () {
      if (!el.isConnected) return;
      if (spec.kind === "bar" || spec.kind === "donut") {
        if (!root.echarts) throw new Error("echarts");
      } else if (!root.uPlot) throw new Error("uplot");
      paint(el, spec);
      el.setAttribute("data-tb-ready", "1");
    }).catch(function () {
      el.setAttribute("data-tb-ready", "err");
      var host = el.querySelector(".tb-plot");
      if (host) host.innerHTML = '<p class="tb-empty">Chart couldn\u2019t load.</p>';
    });
  }
  function observer() {
    if (io || !root.IntersectionObserver) return io;
    io = new root.IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) draw(en.target);
      });
    }, { rootMargin: "160px 0px" });
    return io;
  }
  function mountAll(scope) {
    var doc = docOf();
    if (!doc || !scope || !scope.querySelectorAll) return;
    injectCss();
    bootTheme();
    var nodes = scope.querySelectorAll(".tb-chart[data-tb-lazy='1']");
    var watch = observer();
    nodes.forEach(function (el) {
      if (el.getAttribute("data-tb-armed") === "1" || el.getAttribute("data-tb-ready")) return;
      el.setAttribute("data-tb-armed", "1");
      if (!watch) draw(el);
      else {
        watch.observe(el);
        if (el.getBoundingClientRect && el.getBoundingClientRect().top < (root.innerHeight || 800) + 160) draw(el);
      }
    });
  }
  function attach(scope, handlers) {
    if (!scope || !scope.querySelectorAll) return;
    scope.querySelectorAll(".tb-chart").forEach(function (el) { el._tbHandlers = handlers || {}; });
  }
  function bootTheme() {
    var doc = docOf();
    if (!doc || !root.MutationObserver || doc.documentElement._tbChartsTheme) return;
    doc.documentElement._tbChartsTheme = "1";
    new root.MutationObserver(function () {
      doc.querySelectorAll(".tb-chart[data-tb-ready='1']").forEach(function (el) {
        var spec = el._tbSpec;
        if (!spec) return;
        el.setAttribute("data-tb-ready", "wait");
        paint(el, spec);
        el.setAttribute("data-tb-ready", "1");
      });
    }).observe(doc.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-apex-light", "data-apex-variant"] });
  }
  function injectCss() {
    var doc = docOf();
    if (!doc || doc.getElementById("tb-charts-css")) return;
    var s = doc.createElement("style");
    s.id = "tb-charts-css";
    s.textContent = ""
      + ".tb-chart{position:relative;width:100%;min-width:0;overflow:visible}"
      + ".tb-chart .tb-plot{width:100%;height:100%}"
      + ".tb-chart .u-over{touch-action:pan-y}"
      + ".tb-chart .u-cursor-x,.tb-chart .u-cursor-y{border-color:var(--muted,#8a95ad)}"
      + ".tb-tip{position:absolute;z-index:6;pointer-events:none;max-width:min(260px,88vw);padding:6px 10px;border-radius:8px;background:var(--card2,#1a2133);border:1px solid var(--line,#26304a);color:var(--txt,#eef2fa);font-size:13px;line-height:1.35;box-shadow:0 8px 24px rgba(0,0,0,.22);transform:translate(-50%,-120%);white-space:nowrap}"
      + ".tb-empty{color:var(--faint,#5c6785);font-size:14px;margin:8px 0}"
      + ".tb-donut{width:112px;height:112px;flex:none}"
      + ".tb-donut .tb-plot{position:absolute;inset:0}"
      + ".tb-donut-mid{position:absolute;left:0;right:0;top:50%;transform:translateY(-58%);text-align:center;pointer-events:none;z-index:1}"
      + ".tb-donut-mid b{display:block;color:var(--txt);font-size:16px;font-weight:750;line-height:1}"
      + ".tb-donut-mid span{display:block;color:var(--muted);font-size:11px;margin-top:2px}"
      + "@media(max-width:420px){.tb-tip{font-size:13px}}"
      + "@media(prefers-reduced-motion:reduce){.tb-chart .u-cursor-pt{transition:none}}";
    (doc.head || doc.documentElement).appendChild(s);
  }

  var api = {
    shell: shell,
    areaChart: areaChart,
    barChart: barChart,
    donut: donut,
    spark: spark,
    mountAll: mountAll,
    attach: attach,
    fmtUnit: fmtUnit,
    seriesTone: seriesTone,
    plotY: plotY,
    injectCss: injectCss
  };
  root.TBCharts = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
