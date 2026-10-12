/* Server stats chart scrub + bet filters (tipdash 0.57.1). */
(function (root) {
  "use strict";

  function fmtUnits(n) {
    if (!Number.isFinite(Number(n))) return "—";
    var r = Math.round(Number(n) * 10) / 10;
    var body = r.toFixed(1);
    return (r > 0 ? "+" : "") + body + "u";
  }

  function resultLine(pt) {
    if (!pt || !pt.result) return "";
    var res = String(pt.result).toLowerCase();
    var label = res === "win" ? "Win" : res === "loss" ? "Loss" : res === "push" ? "Push" : res === "void" ? "Void" : pt.result;
    if (pt.delta != null && Number.isFinite(Number(pt.delta))) {
      return label + " " + fmtUnits(pt.delta);
    }
    return label;
  }

  function nearestIndex(meta, x) {
    var pts = meta.points || [];
    if (!pts.length) return 0;
    var best = 0;
    var bestD = Infinity;
    for (var i = 0; i < pts.length; i++) {
      var d = Math.abs(pts[i].x - x);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  function wireScrub(chartEl) {
    if (!chartEl || chartEl.dataset.svScrubBound === "1") return;
    var raw = chartEl.getAttribute("data-sv-scrub");
    if (!raw) return;
    var meta;
    try {
      meta = JSON.parse(raw);
    } catch (e) {
      return;
    }
    var svg = chartEl.querySelector("svg");
    var guide = chartEl.querySelector(".sv-scrub-guide");
    var tip = chartEl.querySelector(".sv-scrub-tip");
    if (!svg || !guide || !tip) return;

    chartEl.dataset.svScrubBound = "1";
    chartEl.style.touchAction = "none";

    function clientToChartX(clientX) {
      var rect = svg.getBoundingClientRect();
      if (!(rect.width > 0)) return meta.padL;
      var vb = meta.w || 640;
      return ((clientX - rect.left) / rect.width) * vb;
    }

    function showAt(clientX) {
      var x = clientToChartX(clientX);
      var idx = nearestIndex(meta, x);
      var pt = meta.points[idx];
      if (!pt) return;
      var pct = (pt.x / (meta.w || 640)) * 100;
      guide.style.left = pct + "%";
      guide.hidden = false;
      tip.hidden = false;
      var when = pt.label || (pt.ms ? String(pt.ms) : "");
      var cum = fmtUnits(pt.y);
      var extra = resultLine(pt);
      tip.innerHTML =
        '<div class="sv-scrub-tip-d">' + escapeHtml(when) + "</div>" +
        '<div class="sv-scrub-tip-u">' + escapeHtml(cum) + "</div>" +
        (extra ? '<div class="sv-scrub-tip-r">' + escapeHtml(extra) + "</div>" : "");
    }

    function hide() {
      guide.hidden = true;
      tip.hidden = true;
    }

    function onMove(ev) {
      if (!chartEl._svScrubActive) return;
      showAt(ev.clientX);
    }

    chartEl.addEventListener("pointerdown", function (ev) {
      chartEl._svScrubActive = true;
      chartEl.setPointerCapture(ev.pointerId);
      showAt(ev.clientX);
    });
    chartEl.addEventListener("pointermove", onMove);
    chartEl.addEventListener("pointerup", function (ev) {
      chartEl._svScrubActive = false;
      try {
        chartEl.releasePointerCapture(ev.pointerId);
      } catch (e) {}
      hide();
    });
    chartEl.addEventListener("pointercancel", function () {
      chartEl._svScrubActive = false;
      hide();
    });
    chartEl.addEventListener("pointerleave", function (ev) {
      if (!chartEl._svScrubActive) hide();
    });
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function wireDetail(root, ctx) {
    if (!root) return;
    ctx = ctx || {};
    var SV = root.ServerView;
    var detail = ctx.detail || {};
    var tips = ctx.tips || { settled: [], queued: [] };
    var guildId = ctx.guildId;
    var loadDetail = ctx.loadDetail;
    var filter = { bookie: "", sport: "" };

    root.querySelectorAll(".sv-chart-scrub").forEach(wireScrub);

    var barPanel = root.querySelector('.sv-panel[aria-label="Monthly P and L"]');
    if (barPanel) {
      barPanel.querySelectorAll(".sv-bar-slice").forEach(function (bar) {
        bar.onclick = function () {
          var mk = bar.getAttribute("data-sv-month");
          if (!mk || !loadDetail) return;
          var sel = root.querySelector("#monthsel");
          if (sel) sel.value = mk;
          loadDetail(guildId, mk);
        };
        bar.onkeydown = function (ev) {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            bar.click();
          }
        };
      });
    }

    function setActivePick() {
      root.querySelectorAll(".sv-legend-pick, .sv-donut-slice").forEach(function (el) {
        var kind = el.getAttribute("data-sv-kind") || "bookie";
        var val = el.getAttribute("data-sv-pick") || "";
        var on = (kind === "bookie" && filter.bookie && val === filter.bookie) || (kind === "sport" && filter.sport && val === filter.sport);
        el.classList.toggle("sv-pick-on", on);
        el.setAttribute("aria-pressed", on ? "true" : "false");
      });
    }

    function applyListFilter() {
      var box = root.querySelector("#recent-box");
      var bar = root.querySelector("#sv-bet-filter");
      if (!box || !SV) return;
      var settled = Array.isArray(tips.settled) ? tips.settled : [];
      var list = settled.filter(function (t) {
        return SV.matchesBookieFilter(t, filter.bookie) && SV.matchesSportFilter(t, filter.sport);
      });
      if (typeof ctx.renderTipRow === "function") {
        box.innerHTML = list.length ? list.map(ctx.renderTipRow).join("") : '<div class="empty">No bets match this filter.</div>';
        if (typeof ctx.wireTipRows === "function") ctx.wireTipRows(box, guildId);
      }
      if (bar) {
        var parts = [];
        if (filter.bookie) parts.push(filter.bookie);
        if (filter.sport) parts.push(filter.sport);
        if (parts.length) {
          bar.hidden = false;
          bar.querySelector(".sv-bet-filter-t").textContent = parts.join(" · ");
        } else {
          bar.hidden = true;
        }
      }
      setActivePick();
    }

    function togglePick(kind, name) {
      if (kind === "bookie") {
        filter.bookie = filter.bookie === name ? "" : name;
      } else if (kind === "sport") {
        filter.sport = filter.sport === name ? "" : name;
      }
      applyListFilter();
      var panel = root.querySelector("#recent-panel");
      if (panel && (filter.bookie || filter.sport)) {
        panel.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }

    root.querySelectorAll(".sv-legend-pick").forEach(function (btn) {
      btn.onclick = function () {
        togglePick(btn.getAttribute("data-sv-kind"), btn.getAttribute("data-sv-pick"));
      };
    });
    root.querySelectorAll(".sv-donut-slice").forEach(function (slice) {
      slice.onclick = function () {
        togglePick(slice.getAttribute("data-sv-kind") || "bookie", slice.getAttribute("data-sv-pick"));
      };
      slice.onkeydown = function (ev) {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          slice.click();
        }
      };
    });

    var clear = root.querySelector("#sv-bet-filter-clear");
    if (clear) {
      clear.onclick = function () {
        filter.bookie = "";
        filter.sport = "";
        applyListFilter();
      };
    }
  }

  var api = { wireDetail: wireDetail, wireScrub: wireScrub };
  root.ServerInteract = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
