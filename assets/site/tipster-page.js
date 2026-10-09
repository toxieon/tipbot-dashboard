/* Tipdash 0.45.1 — render the public verified tipster page from loader data. */
(function () {
  "use strict";

  var ICONS = {
    shield: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.2 19.6 5v6.1c0 4.9-3.2 9-7.6 10.7C7.6 20.1 4.4 16 4.4 11.1V5L12 2.2Z" fill="#5B8CFF"/><path d="M8.4 12.1l2.5 2.5 4.9-5.1" fill="none" stroke="#fff" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    flame: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.6 2c.4 2.9-.9 4.6-2.3 6.2C8.7 10 6.5 12 6.5 15.2A5.5 5.5 0 0 0 12 21a5.5 5.5 0 0 0 5.5-5.6c0-2.4-1.1-4.2-2.2-5.6-.3 1.5-1 2.5-2.1 3 .6-3.7-.2-7.1-.6-10.8Z" fill="#f59e42"/><path d="M12 21a2.9 2.9 0 0 1-2.9-3c0-1.7 1.2-2.7 2.1-3.7.2 1 .8 1.6 1.5 1.9.9.5 2.2 1.2 2.2 2.6A2.9 2.9 0 0 1 12 21Z" fill="#ffe3a3"/></svg>',
    chat: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12.5a7.5 7.5 0 0 1-11 6.6L4 20.5l1.4-4.6A7.5 7.5 0 1 1 20 12.5Z"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    share: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>',
    shieldSm: '<svg viewBox="0 0 24 24" aria-hidden="true" width="14" height="14"><path d="M12 2.2 19.6 5v6.1c0 4.9-3.2 9-7.6 10.7C7.6 20.1 4.4 16 4.4 11.1V5L12 2.2Z" fill="#5B8CFF"/><path d="M8.4 12.1l2.5 2.5 4.9-5.1" fill="none" stroke="#fff" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  function esc(s) {
    return window.TipdashSite ? TipdashSite.esc(s) : String(s == null ? "" : s);
  }

  function initials(name) {
    var parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    if (parts.length === 1) {
      var word = parts[0];
      var caps = word.replace(/[^A-Z]/g, "");
      if (caps.length >= 2) return caps.slice(0, 2);
      return word.slice(0, 2).toUpperCase();
    }
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  }

  function chip(result) {
    if (result === "W") return '<span class="chip W">WON</span>';
    if (result === "L") return '<span class="chip L">LOST</span>';
    if (result === "P") return '<span class="chip push">PUSH</span>';
    return '<span class="chip pending">PENDING</span>';
  }

  function plText(row) {
    if (row.result === "pending") return '<span class="pl muted">\u2014</span>';
    var cls = row.pl > 0 ? "pos" : (row.pl < 0 ? "neg" : "muted");
    var digits = row.result === "P" ? 1 : 2;
    return '<span class="pl ' + cls + '">' + TipsterStats.formatUnits(row.pl || 0, digits) + "</span>";
  }

  function tipLine(row) {
    var odds = row.odds == null ? "" : Number(row.odds).toFixed(2);
    var stake = row.stake == null ? "" : String(row.stake);
    var meta = [];
    if (row.round != null && row.round !== "") meta.push("Rd " + row.round);
    if (row.match) meta.push(row.match);
    if (row.book) meta.push(row.book);
    var extra = (odds ? "@ " + odds : "") + (stake !== "" ? " \u00b7 " + stake + "u" : "");
    return '<article class="tip"><div><p class="t1">' + esc(row.selection) +
      (extra ? ' <span class="muted">' + esc(extra) + "</span>" : "") +
      '</p><p class="t2">' + esc(meta.join(" \u00b7 ")) + "</p></div><div class=\"r\">" +
      chip(row.result) + plText(row) + "</div></article>";
  }

  function dots(letters) {
    return '<div class="dots">' + letters.map(function (r) {
      return '<span class="dot ' + r + '">' + esc(r) + "</span>";
    }).join("") + "</div>";
  }

  function streakHtml(streak) {
    if (!streak) return "";
    if (streak.hot) {
      return '<span class="streak">' + ICONS.flame + esc(streak.n) + " win streak</span>";
    }
    var label = streak.type + streak.n;
    return '<span class="streak quiet">' + esc(label) + "</span>";
  }

  function chartLabels(rounds) {
    var labels = [[0, "Start"]];
    var marks = {6: true, 12: true, 18: true};
    var lastIdx = rounds.length;
    rounds.forEach(function (round, i) {
      var n = Number(round);
      var idx = i + 1;
      if (marks[n] && idx !== lastIdx) labels.push([idx, "Rd " + round]);
    });
    if (rounds.length) {
      var last = rounds[rounds.length - 1];
      labels.push([rounds.length, last == null ? "Latest" : "Rd " + last]);
    }
    return labels;
  }

  function yTicksFor(series) {
    var max = 0;
    var min = 0;
    series.forEach(function (v) {
      if (v > max) max = v;
      if (v < min) min = v;
    });
    var top = max <= 33 ? 33 : Math.ceil((max + 2) / 10) * 10;
    var step = top > 60 ? 20 : 10;
    var ticks = [];
    var low = min < 0 ? Math.floor(min / step) * step : 0;
    for (var v = low; v <= top; v += step) ticks.push(v);
    return {ticks: ticks, yMax: top, yMin: low};
  }

  function paintChart(host, stats) {
    if (!host || !window.TipdashSite) return;
    var series = stats.roundSeries || [];
    if (series.length < 2) {
      host.innerHTML = '<p class="muted">Not enough settled tips for a chart.</p>';
      return;
    }
    var w = Math.max(300, Math.round(host.clientWidth || 640));
    var narrow = w < 520;
    var scale = yTicksFor(series);
    var labels = chartLabels(stats.rounds || []);
    if (narrow && labels.length > 3) labels = [labels[0], labels[Math.floor(labels.length / 2)], labels[labels.length - 1]];
    host.innerHTML = TipdashSite.areaChart({
      w: w,
      h: narrow ? 176 : 248,
      data: series,
      padL: narrow ? 36 : 46,
      padR: 12,
      padT: 12,
      padB: 28,
      yTicks: scale.ticks,
      yMax: scale.yMax,
      yMin: scale.yMin,
      yFmt: function (v) { return v + "u"; },
      xLabels: labels,
      fontSize: narrow ? 13 : 12,
      id: "units-fill",
      label: "Units over time, ending at " + TipsterStats.formatUnits(stats.units, 1),
      smooth: 0.65,
      strokeW: narrow ? 2.2 : 2.6
    });
  }

  function render(data) {
    var stats = TipsterStats.computeTipsterStats(data && data.tips);
    var name = data && data.name ? String(data.name) : "Tipster";
    var handle = data && data.handle ? String(data.handle) : "";
    var requested = data && data.requestedHandle ? String(data.requestedHandle).toLowerCase() : "";
    var mismatch = !!(data && data.example && requested && handle && requested !== handle.toLowerCase());
    var sport = data && data.sport ? String(data.sport) : "Tipster";
    var server = data && data.server ? String(data.server) : "";
    var since = data && data.since ? String(data.since) : "";
    var meta = [sport];
    if (server) meta.push(server + " Discord");
    if (since) meta.push(since);
    var example = data && data.example
      ? '<p class="example-banner" role="note">Example data' +
        (mismatch ? " \u2014 showing " + esc(name) + ". @" + esc(requested) + " isn\u2019t live yet." : ". Public records aren\u2019t live yet.") +
        "</p>"
      : "";
    var roi = stats.roi == null ? "\u2014" : TipsterStats.formatPct(stats.roi, true);
    var sr = stats.strikeRate == null ? "\u2014" : TipsterStats.formatPct(stats.strikeRate, false);
    var avg = stats.avgOdds == null ? "" : "Avg odds " + stats.avgOdds.toFixed(2);
    var record = stats.wins + " won \u00b7 " + stats.losses + " lost" + (stats.pushes ? " \u00b7 " + stats.pushes + " push" : "");
    var formScore = stats.last10.length ? (stats.last10Wins + "\u2013" + stats.last10Losses) : "\u2014";
    var shown = [];
    stats.pending.forEach(function (row) { shown.push(row); });
    stats.recent.slice(0, 6).forEach(function (row) { shown.push(row); });
    var rest = stats.recent.slice(6);
    var tipsHtml = shown.map(tipLine).join("") || '<p class="muted empty-tips">No tips in this record.</p>';
    var more = rest.length
      ? '<div id="more-tips" hidden>' + rest.map(tipLine).join("") + "</div>" +
        '<button type="button" class="btn btn-secondary view-all" id="view-all">View all ' + stats.settledCount + "</button>"
      : "";
    var followNote = "Following in Discord is coming soon.";

    return example +
      '<section class="hero card"><div class="who"><div class="avatar" aria-hidden="true">' + esc(data && data.initials ? data.initials : initials(name)) + "</div>" +
        "<div><h1>" + esc(name) + ' <span class="vbadge">' + ICONS.shield + "Verified by TipBot</span></h1>" +
        '<p class="meta">' + esc(meta.join(" \u00b7 ")) + "</p></div></div>" +
        '<div class="hero-actions"><button type="button" class="btn btn-primary" id="follow">' + ICONS.chat + "Follow in Discord</button>" +
        '<button type="button" class="btn btn-secondary icon-btn" id="share" aria-label="Share this record">' + ICONS.share + "</button></div></section>" +
      '<section class="stats" aria-label="Record">' +
        '<div class="stat"><span class="k"><span class="k-long">Units profit</span><span class="k-short">Units</span></span><span class="v pos">' + TipsterStats.formatUnits(stats.units, 1) + '</span><span class="s">' + TipsterStats.formatUnits(stats.staked, 1).replace(/^\+/, "") + " staked</span></div>" +
        '<div class="stat"><span class="k">ROI</span><span class="v pos">' + esc(roi) + '</span><span class="s">Profit \u00f7 units staked</span></div>' +
        '<div class="stat"><span class="k"><span class="k-long">Strike rate</span><span class="k-short">Strike</span></span><span class="v">' + esc(sr) + '</span><span class="s">' + esc(record) + "</span></div>" +
        '<div class="stat"><span class="k"><span class="k-long">Total tips</span><span class="k-short">Tips</span></span><span class="v">' + stats.settledCount + '</span><span class="s">' + esc(avg) + "</span></div>" +
        '<div class="stat form"><div class="form-top"><span class="k">Last 10 \u00b7 ' + esc(formScore) + "</span>" + streakHtml(stats.streak) + "</div>" +
        dots(stats.last10) + "</div></section>" +
      '<div class="record-main">' +
        '<section class="card panel"><div class="ph"><h2>Units over time</h2><span class="season">Season</span></div>' +
          '<p class="big"><b class="pos">' + TipsterStats.formatUnits(stats.units, 1) + "</b> across " + stats.settledCount + " settled tips</p>" +
          '<div id="units-chart"></div>' +
          '<p class="note">' + ICONS.shieldSm + "Every tip is time-stamped in Discord before the event and settled automatically by TipBot. Historical imports are left out.</p></section>" +
        '<section class="card panel"><div class="ph"><h2>Recent tips</h2></div><div class="tips" id="tips">' + tipsHtml + more + "</div></section>" +
      "</div>" +
      '<section class="card cta"><img src="/assets/favicon.svg" alt="" width="44" height="44"><div><h2>Run a tipping server?</h2><p>TipBot tracks every tip, settles results and builds your verified record. Free for tipsters.</p></div>' +
        '<a class="btn btn-primary" href="/welcome/#add" data-invite="bot">' + ICONS.plus + "Add TipBot to your server</a></section>" +
      '<p id="follow-note" class="sr" data-note="' + esc(followNote) + '"></p>';
  }

  function bind(root, data, stats) {
    var chartHost = root.querySelector("#units-chart");
    function draw() { paintChart(chartHost, stats); }
    draw();
    var resizeTimer;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(draw, 120);
    });
    var viewAll = root.querySelector("#view-all");
    if (viewAll) {
      viewAll.addEventListener("click", function () {
        var more = root.querySelector("#more-tips");
        if (more) more.hidden = false;
        viewAll.hidden = true;
      });
    }
    var follow = root.querySelector("#follow");
    if (follow) {
      follow.addEventListener("click", function () {
        TipdashSite.openNotice("Follow in Discord", root.querySelector("#follow-note").getAttribute("data-note"));
      });
    }
    var share = root.querySelector("#share");
    if (share) {
      share.addEventListener("click", function () {
        var handle = (data && data.requestedHandle) || (data && data.handle) || "";
        var url = location.origin + "/t/" + handle;
        var title = document.title;
        if (navigator.share) {
          navigator.share({title: title, url: url}).catch(function () {});
          return;
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(function () {
            TipdashSite.openNotice("Link copied", url);
          }).catch(function () {
            TipdashSite.openNotice("Share this record", url);
          });
          return;
        }
        TipdashSite.openNotice("Share this record", url);
      });
    }
    if (window.TipdashSite && TipdashSite.init) TipdashSite.init();
    var name = data && data.name ? data.name : "Tipster";
    document.title = name + " \u2014 verified tipster \u2014 TipBot";
    var desc = name + " on TipBot. Units, strike rate and recent tips. Example data until the public record is live.";
    var md = document.querySelector('meta[name="description"]');
    if (md) md.setAttribute("content", desc);
    var ogt = document.querySelector('meta[property="og:title"]');
    if (ogt) ogt.setAttribute("content", document.title);
    var ogd = document.querySelector('meta[property="og:description"]');
    if (ogd) ogd.setAttribute("content", desc);
    var handle = (data && (data.requestedHandle || data.handle)) || "";
    var canon = document.querySelector('link[rel="canonical"]');
    if (canon && handle) canon.setAttribute("href", "https://tipdashhq.com/t/" + handle);
  }

  function showError(root) {
    root.innerHTML = '<section class="card panel"><h1>Couldn\u2019t load this record</h1><p class="muted">The example record didn\u2019t load. Try the <a href="/welcome/">home page</a>.</p></section>';
  }

  function boot(root, handle) {
    if (!root) return;
    root.innerHTML = '<p class="loading">Loading record\u2026</p>';
    TipsterStats.loadPublicTipster(handle, {fetch: window.fetch.bind(window)}).then(function (data) {
      var stats = TipsterStats.computeTipsterStats(data && data.tips);
      root.innerHTML = render(data);
      root._stats = stats;
      bind(root, data, stats);
    }).catch(function () { showError(root); });
  }

  window.TipsterPage = {boot: boot, render: render};
})();
