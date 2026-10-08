/* Tipdash 0.47.1 — shared public-site behaviour.
 * BOT_INVITE_URL: tipdash has no Discord bot invite or OAuth URL yet
 * (checked the dashboard and Live). Set this to the real
 * https://discord.com/oauth2/authorize?client_id=… link when it exists.
 * Until then the "Add TipBot" buttons explain that, and do not navigate.
 */
(function () {
  "use strict";

  var BOT_INVITE_URL = null;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return {"&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"}[c];
    });
  }

  function areaChart(opts) {
    var data = opts.data || [];
    if (data.length < 2) return "";
    var w = opts.w || 640;
    var h = opts.h || 220;
    var padL = opts.padL == null ? 44 : opts.padL;
    var padR = opts.padR == null ? 16 : opts.padR;
    var padT = opts.padT == null ? 14 : opts.padT;
    var padB = opts.padB == null ? 28 : opts.padB;
    var color = opts.color || "#5B8CFF";
    var id = opts.id || "units";
    var yTicks = opts.yTicks || [];
    var min = opts.yMin != null ? opts.yMin : Math.min.apply(null, [0].concat(data, yTicks));
    var max = opts.yMax != null ? opts.yMax : Math.max.apply(null, data.concat(yTicks));
    if (!(max > min)) max = min + 1;
    function X(i) { return padL + (w - padL - padR) * (i / (data.length - 1)); }
    function Y(v) { return padT + (h - padT - padB) * (1 - (v - min) / (max - min)); }
    var pts = data.map(function (v, i) { return [X(i), Y(v)]; });
    var smooth = opts.smooth == null ? 0.65 : opts.smooth;
    var line = "M" + pts[0][0].toFixed(1) + " " + pts[0][1].toFixed(1);
    var tension = smooth / 6;
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i];
      var p1 = pts[i];
      var p2 = pts[i + 1];
      var p3 = pts[i + 2] || p2;
      var c1x = p1[0] + (p2[0] - p0[0]) * tension;
      var c1y = p1[1] + (p2[1] - p0[1]) * tension;
      var c2x = p2[0] - (p3[0] - p1[0]) * tension;
      var c2y = p2[1] - (p3[1] - p1[1]) * tension;
      line += " C" + c1x.toFixed(1) + " " + c1y.toFixed(1) + " " + c2x.toFixed(1) + " " + c2y.toFixed(1) + " " + p2[0].toFixed(1) + " " + p2[1].toFixed(1);
    }
    var area = line + " L" + X(data.length - 1).toFixed(1) + " " + Y(min).toFixed(1) + " L" + padL.toFixed(1) + " " + Y(min).toFixed(1) + " Z";
    var font = opts.fontSize || 12;
    var yFmt = opts.yFmt || function (v) { return String(v); };
    var svg = '<svg class="chart" width="100%" viewBox="0 0 ' + w + " " + h + '" role="img" aria-label="' + esc(opts.label || "Units over time") + '">';
    svg += '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + color + '" stop-opacity=".28"/><stop offset="1" stop-color="' + color + '" stop-opacity="0"/></linearGradient></defs>';
    yTicks.forEach(function (tick) {
      var y = Y(tick);
      svg += '<line x1="' + padL + '" x2="' + (w - padR) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="' + (tick === 0 ? "#33405e" : "#1f2740") + '" stroke-width="1"></line>';
      svg += '<text x="' + (padL - 8) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="end" fill="#8a95ad" font-size="' + font + '">' + esc(yFmt(tick)) + "</text>";
    });
    var labels = opts.xLabels || [];
    labels.forEach(function (pair, k) {
      var anchor = k === 0 ? "start" : (k === labels.length - 1 ? "end" : "middle");
      var idx = pair[0];
      if (idx < 0 || idx > data.length - 1) return;
      svg += '<text x="' + X(idx).toFixed(1) + '" y="' + (h - 6) + '" text-anchor="' + anchor + '" fill="#8a95ad" font-size="' + font + '">' + esc(pair[1]) + "</text>";
    });
    svg += '<path d="' + area + '" fill="url(#' + id + ')"></path>';
    svg += '<path d="' + line + '" fill="none" stroke="' + color + '" stroke-width="' + (opts.strokeW || 2.4) + '" stroke-linejoin="round" stroke-linecap="round"></path>';
    var end = pts[pts.length - 1];
    svg += '<circle cx="' + end[0].toFixed(1) + '" cy="' + end[1].toFixed(1) + '" r="7" fill="' + color + '" opacity=".22"></circle>';
    svg += '<circle cx="' + end[0].toFixed(1) + '" cy="' + end[1].toFixed(1) + '" r="3.6" fill="' + color + '" stroke="#0f1420" stroke-width="1.5"></circle>';
    return svg + "</svg>";
  }

  function ensureDialogs() {
    if (document.getElementById("site-dialog")) return;
    var wrap = document.createElement("div");
    wrap.innerHTML =
      '<dialog id="site-dialog" class="site-dialog">' +
        '<h2 id="site-dialog-title"></h2>' +
        '<p id="site-dialog-body"></p>' +
        '<form id="site-waitlist" hidden>' +
          '<label for="site-waitlist-email">Email</label>' +
          '<input id="site-waitlist-email" name="email" type="email" autocomplete="email" inputmode="email" maxlength="200" required>' +
          '<p id="site-waitlist-thanks" class="thanks" hidden>Thanks \u2014 we\u2019ll let you know when it opens. No payment is taken.</p>' +
          '<div class="dialog-actions">' +
            '<button type="submit" class="btn btn-primary" id="site-waitlist-go">Join the waitlist</button>' +
            '<button type="button" class="btn btn-secondary" id="site-dialog-close">Close</button>' +
          '</div>' +
          '<p class="fine">Coming soon.</p>' +
        '</form>' +
        '<div class="dialog-actions" id="site-dialog-actions">' +
          '<button type="button" class="btn btn-secondary" id="site-notice-close">Close</button>' +
        '</div>' +
      '</dialog>';
    document.body.appendChild(wrap.firstChild);
    var dialog = document.getElementById("site-dialog");
    var form = document.getElementById("site-waitlist");
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      form.querySelector(".dialog-actions").hidden = true;
      document.getElementById("site-waitlist-email").disabled = true;
      document.getElementById("site-waitlist-thanks").hidden = false;
    });
    function close() {
      if (dialog.close) dialog.close();
      else dialog.removeAttribute("open");
    }
    document.getElementById("site-dialog-close").addEventListener("click", close);
    document.getElementById("site-notice-close").addEventListener("click", close);
  }

  function showDialog(opts) {
    ensureDialogs();
    var dialog = document.getElementById("site-dialog");
    document.getElementById("site-dialog-title").textContent = opts.title;
    document.getElementById("site-dialog-body").textContent = opts.body;
    var form = document.getElementById("site-waitlist");
    var noticeActions = document.getElementById("site-dialog-actions");
    form.hidden = !opts.waitlist;
    noticeActions.hidden = !!opts.waitlist;
    if (opts.waitlist) {
      form.reset();
      form.querySelector(".dialog-actions").hidden = false;
      var email = document.getElementById("site-waitlist-email");
      email.disabled = false;
      document.getElementById("site-waitlist-thanks").hidden = true;
    }
    if (dialog.showModal) dialog.showModal();
    else dialog.setAttribute("open", "");
    if (opts.waitlist) document.getElementById("site-waitlist-email").focus();
  }

  function openWaitlist(result) {
    var plan = result || {};
    var price = "";
    if (window.TipdashCheckout && TipdashCheckout.formatAud) {
      price = TipdashCheckout.formatAud(plan.priceAud);
      if (plan.interval === "year") price += "/year";
      else if (plan.interval === "month") price += "/month";
    }
    var name = plan.name || "This plan";
    showDialog({
      waitlist: true,
      title: "Coming soon \u2014 join the waitlist",
      body: name + (price ? " (" + price + ")" : "") + " isn\u2019t on sale yet. Leave an email if you want a note when checkout opens. Nothing is sent, and no payment is taken."
    });
  }

  function openNotice(title, body) {
    showDialog({waitlist: false, title: title, body: body});
  }

  function bindInviteLinks() {
    var links = document.querySelectorAll("[data-invite='bot']");
    for (var i = 0; i < links.length; i++) {
      (function (el) {
        if (BOT_INVITE_URL) {
          el.setAttribute("href", BOT_INVITE_URL);
          var note = document.getElementById("invite-fallback");
          if (note) note.hidden = true;
          return;
        }
        el.addEventListener("click", function (ev) {
          ev.preventDefault();
          openNotice(
            "Add TipBot to your server",
            "The invite link is coming soon. If TipBot is already in your server, open the dashboard."
          );
        });
      })(links[i]);
    }
  }

  function init() {
    bindInviteLinks();
  }

  window.TipdashSite = {
    BOT_INVITE_URL: BOT_INVITE_URL,
    esc: esc,
    areaChart: areaChart,
    openWaitlist: openWaitlist,
    openNotice: openNotice,
    init: init
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
