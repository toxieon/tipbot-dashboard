/* Tipdash 0.52.5 — shared public-site behaviour.
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
    opts = opts || {};
    if (window.TBCharts && typeof TBCharts.areaChart === "function") {
      return TBCharts.areaChart({
        data: opts.data || [],
        xLabels: opts.xLabels || [],
        aria: opts.label || opts.aria || "Units over time",
        unit: "u",
        signed: true,
        height: opts.h || opts.height || 220,
        yMin: opts.yMin,
        yMax: opts.yMax,
        colorMode: "end"
      });
    }
    return "";
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
