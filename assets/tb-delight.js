/* tb-delight.js — settle stamp, form strip, rank FLIP, empty art, season wrapped shell.
 * Works on every theme; honours prefers-reduced-motion via TBMotion when present.
 * window.TBDelight + CommonJS for node --test.
 */
(function (root) {
  "use strict";

  var doc = root.document;
  var EASE = "cubic-bezier(.22,1,.36,1)";
  var rankPrev = typeof WeakMap !== "undefined" ? new WeakMap() : null;

  function reduced() {
    if (root.TBMotion && typeof root.TBMotion.reduced === "function") return !!root.TBMotion.reduced();
    try {
      return !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch (e) {
      return false;
    }
  }

  function raf(fn) {
    if (root.requestAnimationFrame) return root.requestAnimationFrame(fn);
    return setTimeout(fn, 16);
  }

  function vibrate(ms) {
    if (reduced()) return;
    try {
      if (root.navigator && root.navigator.vibrate) root.navigator.vibrate(ms);
    } catch (e2) {}
  }

  function injectCss() {
    if (!doc || doc.getElementById("td-delight-css")) return;
    var s = doc.createElement("style");
    s.id = "td-delight-css";
    s.textContent =
      ".td-stamp{position:absolute;right:14px;bottom:14px;z-index:0;opacity:.15;display:flex;align-items:center;justify-content:center;min-width:64px;padding:4px 8px;border:2px solid currentColor;border-radius:4px;font-size:var(--t-sub,13px);font-weight:750;letter-spacing:.14em;line-height:1;transform:rotate(-8deg);pointer-events:none}" +
      ".td-stamp-win{color:var(--win)}" +
      ".td-stamp-loss{color:var(--muted)}" +
      ".betcard.td-flip{transform-style:preserve-3d}" +
      ".td-confetti{display:block;position:absolute;left:50%;top:50%;width:6px;height:6px;margin:-3px 0 0 -3px;border-radius:1px;pointer-events:none}" +
      ".td-delta{display:inline-flex;margin-left:6px;padding:1px 6px;border-radius:999px;font-size:var(--t-cap,11px);font-weight:750;font-variant-numeric:tabular-nums;background:var(--card2);border:1px solid var(--line)}" +
      ".td-delta-up{color:var(--win)}" +
      ".td-delta-down{color:var(--loss)}" +
      ".leg-odds-drift{display:inline-flex;align-items:center;gap:2px;margin-left:4px;font-size:var(--t-cap,11px);font-weight:750;font-variant-numeric:tabular-nums}" +
      ".leg-odds-drift.up{color:var(--win)}" +
      ".leg-odds-drift.down{color:var(--loss)}" +
      ".td-wrapped{position:fixed;inset:0;z-index:90;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.55)}" +
      ".td-wrapped[hidden]{display:none}" +
      ".td-wrapped-card{max-width:390px;width:100%;max-height:min(92vh,720px);overflow:hidden;border-radius:var(--radius,14px);border:1px solid var(--line);background:var(--card);display:flex;flex-direction:column;min-width:0}" +
      ".td-wrapped-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 14px;border-bottom:1px solid var(--line)}" +
      ".td-wrapped-track{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;min-width:0}" +
      ".td-wrapped-slide{flex:0 0 100%;scroll-snap-align:start;padding:18px 16px 20px;box-sizing:border-box;min-width:0}" +
      ".td-wrapped-dots{display:flex;gap:6px;justify-content:center;padding:10px}" +
      ".td-wrapped-dot{width:7px;height:7px;border-radius:50%;background:var(--line);border:0;padding:0}" +
      ".td-wrapped-dot[aria-current=true]{background:var(--accent)}" +
      ".td-share-card{border:1px dashed var(--line);border-radius:12px;padding:16px;text-align:center;background:var(--bg2)}" +
      "@media(prefers-reduced-motion:no-preference){.betcard.td-flip{animation:td-card-flip 320ms " + EASE + " both}.td-stamp{animation:td-stamp-in 320ms " + EASE + " 120ms both}.tb-form-dot.td-tile{animation:td-tile 320ms " + EASE + " both;animation-delay:calc(var(--td-i,0)*40ms)}.td-confetti{animation:td-confetti 900ms " + EASE + " both}.tb-form-hot.td-flame-pulse{animation:td-flame 1.1s ease-in-out infinite;transform-origin:50% 80%}}" +
      "@keyframes td-card-flip{0%{transform:rotateY(0)}42%{transform:rotateY(86deg)}100%{transform:rotateY(0)}}" +
      "@keyframes td-stamp-in{from{opacity:0;transform:scale(1.35) rotate(-8deg)}to{opacity:.15;transform:scale(1) rotate(-8deg)}}" +
      "@keyframes td-tile{from{opacity:0;transform:rotateX(90deg)}to{opacity:1;transform:none}}" +
      "@keyframes td-confetti{to{opacity:0;transform:translate3d(var(--dx),var(--dy),0) rotate(var(--rot))}}" +
      "@keyframes td-flame{0%,100%{transform:scale(1)}50%{transform:scale(1.08) translateY(-1px);opacity:.85}}" +
      "@media(prefers-reduced-motion:reduce){.betcard.td-flip,.td-stamp,.tb-form-dot.td-tile,.td-confetti,.tb-form-hot.td-flame-pulse{animation:none!important}}";
    (doc.head || doc.documentElement).appendChild(s);
  }

  function burst(origin) {
    if (!origin || reduced()) return;
    var n = 10 + Math.floor(Math.random() * 5);
    var colors = ["var(--win)", "var(--accent)", "var(--txt)", "var(--warn)"];
    var i;
    for (i = 0; i < n; i++) {
      var bit = doc.createElement("i");
      bit.className = "td-confetti";
      var ang = Math.random() * Math.PI * 2;
      var dist = 28 + Math.random() * 36;
      bit.style.setProperty("--dx", (Math.cos(ang) * dist).toFixed(1) + "px");
      bit.style.setProperty("--dy", (Math.sin(ang) * dist - 8).toFixed(1) + "px");
      bit.style.setProperty("--rot", (Math.random() * 140 - 70).toFixed(0) + "deg");
      bit.style.background = colors[i % colors.length];
      origin.appendChild(bit);
    }
    setTimeout(function () {
      var bits = origin.querySelectorAll(".td-confetti");
      for (var k = 0; k < bits.length; k++) if (bits[k].parentNode) bits[k].parentNode.removeChild(bits[k]);
    }, 900);
  }

  function stamp(card) {
    if (!card || card.dataset.tdStamp === "1") return;
    if (card.dataset.settled !== "1") return;
    var win = card.querySelector(".tbchip--win");
    var loss = card.querySelector(".tbchip--loss");
    if (!win && !loss) return;
    var id = card.getAttribute("data-tip") || "";
    if (!id) return;
    var key = "td-stamp:" + id;
    var played = false;
    try {
      played = root.sessionStorage.getItem(key) === "1";
    } catch (e) {}
    card.dataset.tdStamp = "1";
    try {
      root.sessionStorage.setItem(key, "1");
    } catch (e2) {}
    if (!card.style.position) card.style.position = "relative";
    var mark = doc.createElement("span");
    mark.className = "td-stamp " + (win ? "td-stamp-win" : "td-stamp-loss");
    mark.setAttribute("aria-hidden", "true");
    mark.textContent = win ? "WON" : "LOST";
    card.appendChild(mark);
    if (played || reduced()) return;
    card.classList.add("td-flip");
    if (win) {
      burst(mark);
      vibrate(12);
    } else {
      vibrate([8, 40, 8]);
    }
    setTimeout(function () {
      card.classList.remove("td-flip");
    }, 700);
  }

  function formStrip(form) {
    if (!form || form.dataset.tdForm === "1") return;
    var dots = form.querySelectorAll(".tb-form-dot");
    var isW = form.getAttribute("data-streak") === "W";
    var n = Number(form.getAttribute("data-streak-n")) || 0;
    if (!dots.length && !(isW && n >= 3)) return;
    form.dataset.tdForm = "1";
    var formKey = "td-form:" + (form.getAttribute("aria-label") || "");
    var played = false;
    try {
      played = root.sessionStorage.getItem(formKey) === "1";
    } catch (e) {}
    try {
      root.sessionStorage.setItem(formKey, "1");
    } catch (e2) {}
    var i;
    for (i = 0; i < dots.length; i++) {
      if (!played && !reduced()) {
        dots[i].classList.add("td-tile");
        dots[i].style.setProperty("--td-i", String(i));
      }
      if (i === 0) dots[i].classList.add("td-newest");
    }
    if (isW && n >= 3) {
      var tag = form.querySelector(".tb-form-streak, .tb-form-hot");
      if (tag) {
        tag.innerHTML = '<span class="td-flame-icon" aria-hidden="true">🔥</span> ' + n + "W";
        tag.classList.add("tb-form-hot", "td-flame-pulse");
      }
    }
  }

  function rowKey(row) {
    var id = row.getAttribute("data-uid") || row.getAttribute("data-tip");
    if (id) return id;
    var n = row.querySelector(".sv-nm, .tb-form-name, .dc-name");
    var t = (n ? n.textContent : "") || "";
    return t.replace(/\s+/g, " ").trim().slice(0, 80);
  }

  function flipLists(scope) {
    if (!rankPrev || !doc) return;
    (scope || doc).querySelectorAll(".sv-ranks, .tb-form-list, .dc-grid, #flist").forEach(function (list) {
      var rows = list.querySelectorAll(".sv-rank, .tb-form-row, .dc-card, .frow");
      var prev = rankPrev.get(list);
      var next = {};
      var reads = [];
      rows.forEach(function (row, i) {
        var key = rowKey(row);
        if (!key) return;
        var top = 0;
        try {
          top = row.getBoundingClientRect().top;
        } catch (e) {}
        next[key] = { i: i, top: top };
        reads.push({ row: row, key: key, i: i, top: top });
      });
      if (prev && !reduced()) {
        reads.forEach(function (r) {
          var was = prev[r.key];
          if (!was || was.i === r.i) return;
          var dy = was.top - r.top;
          if (Math.abs(dy) > 1 && r.row.animate) {
            try {
              r.row.animate(
                [{ transform: "translateY(" + dy.toFixed(1) + "px)" }, { transform: "translateY(0px)" }],
                { duration: 320, easing: EASE, fill: "both" }
              );
            } catch (e) {}
          }
          var places = was.i - r.i;
          if (!places || r.row.querySelector(".td-delta")) return;
          var chip = doc.createElement("span");
          chip.className = "td-delta " + (places > 0 ? "td-delta-up" : "td-delta-down");
          chip.textContent = (places > 0 ? "+" : "\u2212") + Math.abs(places);
          r.row.appendChild(chip);
          setTimeout(function () {
            if (chip.parentNode) chip.parentNode.removeChild(chip);
          }, 900);
        });
      }
      rankPrev.set(list, next);
    });
  }

  function emptySvg(kind) {
    if (kind === "upcoming") {
      return '<svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto 16px"><rect x="24" y="28" width="72" height="64" rx="10" fill="var(--card2)" stroke="var(--line)" stroke-width="2"/><path d="M36 20v16M84 20v16M24 48h72" stroke="var(--line)" stroke-width="2" stroke-linecap="round"/><rect x="40" y="60" width="16" height="16" rx="4" fill="var(--accent)" opacity="0.2"/><rect x="64" y="60" width="16" height="16" rx="4" fill="var(--line)" opacity="0.5"/></svg>';
    }
    if (kind === "feed") {
      return '<svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto 16px"><rect x="18" y="22" width="84" height="76" rx="12" fill="var(--card2)" stroke="var(--line)" stroke-width="2"/><path d="M30 42h60M30 58h44M30 74h52" stroke="var(--line)" stroke-width="2" stroke-linecap="round"/></svg>';
    }
    return '<svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto 16px"><path d="M20 90h80" stroke="var(--line)" stroke-width="2" stroke-linecap="round"/><path d="M30 80l20-30 15 10 25-35" stroke="var(--accent)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  function armEmptyStates(scope) {
    (scope || doc).querySelectorAll(".empty").forEach(function (el) {
      if (el.dataset.tdEmpty === "1") return;
      var text = el.textContent || "";
      var kind = "";
      if (text.indexOf("No upcoming") !== -1) kind = "upcoming";
      else if (text.indexOf("Nothing here") !== -1 || text.indexOf("No communities") !== -1) kind = "feed";
      else if (text.indexOf("No settled") !== -1 || text.indexOf("No results") !== -1 || text.indexOf("No finished") !== -1) kind = "results";
      if (!kind) return;
      el.dataset.tdEmpty = "1";
      var inner = el.innerHTML;
      if (inner.indexOf("<svg") !== -1) return;
      el.innerHTML = emptySvg(kind) + '<div style="color:var(--muted)">' + inner + "</div>";
      el.style.textAlign = "center";
      el.style.padding = "28px 16px";
    });
  }

  function round2(n) {
    return Math.round(Number(n) * 100) / 100;
  }

  function oddsDriftHtml(posted, current) {
    var p = Number(posted);
    var c = Number(current);
    if (!Number.isFinite(p) || !Number.isFinite(c) || !(p > 1) || !(c > 1)) return "";
    var diff = round2(c - p);
    if (Math.abs(diff) < 0.02) return "";
    var up = diff > 0;
    var arrow = up ? "\u2191" : "\u2193";
    var cls = up ? "up" : "down";
    var title = "Posted " + p.toFixed(2) + ", now " + c.toFixed(2);
    return '<span class="leg-odds-drift ' + cls + '" title="' + title + '" aria-label="' + title + '">' + arrow + Math.abs(diff).toFixed(2) + "</span>";
  }

  function escAttr(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  }

  function monthSlides(monthly) {
    var bars = monthly || [];
    if (!bars.length) return [{ title: "Season", body: "<p class=\"muted\">No monthly results yet.</p>" }];
    return bars.map(function (b) {
      var cls = b.value >= 0 ? "pos" : "neg";
      var sign = b.value > 0 ? "+" : "";
      return {
        title: b.label,
        body:
          '<p style="font-size:var(--t-h2);font-weight:800;margin:0 0 8px" class="' +
          cls +
          '">' +
          sign +
          round2(b.value).toFixed(1) +
          "u</p><p class=\"muted\">Profit for " +
          escAttr(b.label) +
          "</p>"
      };
    });
  }

  function shareCardHtml(stats) {
    var u = stats.units != null ? stats.units : 0;
    var roi = stats.roi != null ? stats.roi : 0;
    return (
      '<div class="td-share-card" id="td-share-card">' +
      "<h3 style=\"margin:0 0 6px\">Season Wrapped</h3>" +
      '<p style="margin:0 0 12px;color:var(--muted);font-size:var(--t-sub)">Your Tipdash season</p>' +
      '<p style="font-size:28px;font-weight:800;margin:0" class="' +
      (u >= 0 ? "pos" : "neg") +
      '">' +
      (u > 0 ? "+" : "") +
      round2(u).toFixed(1) +
      "u</p>" +
      '<p style="margin:8px 0 0">ROI <b>' +
      round2(roi).toFixed(1) +
      "%</b> · " +
      (stats.count || 0) +
      " tips</p>" +
      '<p style="margin:12px 0 0;font-size:var(--t-cap);color:var(--faint)">tipdashhq.com</p></div>'
    );
  }

  var wrappedEl = null;

  function closeWrapped() {
    if (wrappedEl && wrappedEl.parentNode) wrappedEl.parentNode.removeChild(wrappedEl);
    wrappedEl = null;
  }

  function exportSharePng(cardEl) {
    if (!cardEl || !doc) return;
    var canvas = doc.createElement("canvas");
    canvas.width = 780;
    canvas.height = 420;
    var ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#11141c";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f5f7fa";
    ctx.font = "bold 42px system-ui,sans-serif";
    ctx.fillText("Season Wrapped", 48, 72);
    var units = cardEl.querySelector(".pos, .neg");
    var unitText = units ? units.textContent : "";
    ctx.font = "bold 64px system-ui,sans-serif";
    ctx.fillStyle = units && units.classList.contains("neg") ? "#f87171" : "#34d399";
    ctx.fillText(unitText, 48, 160);
    ctx.fillStyle = "#8b93a7";
    ctx.font = "24px system-ui,sans-serif";
    var meta = cardEl.querySelectorAll("p")[2];
    ctx.fillText(meta ? meta.textContent : "", 48, 220);
    ctx.fillStyle = "#5b8cff";
    ctx.fillText("tipdashhq.com", 48, 360);
    try {
      canvas.toBlob(function (blob) {
        if (!blob) return;
        var url = URL.createObjectURL(blob);
        var a = doc.createElement("a");
        a.href = url;
        a.download = "tipdash-season-wrapped.png";
        a.click();
        setTimeout(function () {
          URL.revokeObjectURL(url);
        }, 500);
      });
    } catch (e) {}
  }

  function openSeasonWrapped(stats) {
    if (!doc || !doc.body) return;
    closeWrapped();
    injectCss();
    var slides = monthSlides(stats.monthly || []);
    slides.push({ title: "Share", body: shareCardHtml(stats), share: true });
    var track = "";
    slides.forEach(function (sl, i) {
      track +=
        '<div class="td-wrapped-slide" data-i="' +
        i +
        '"><h3 style="margin:0 0 12px">' +
        escAttr(sl.title) +
        "</h3>" +
        sl.body +
        (sl.share
          ? '<button type="button" class="btn sm" id="td-wrapped-png" style="margin-top:16px">Save share card (PNG)</button>'
          : "") +
        "</div>";
    });
    var dots = slides
      .map(function (_, i) {
        return '<button type="button" class="td-wrapped-dot" data-go="' + i + '" aria-label="Slide ' + (i + 1) + '"></button>';
      })
      .join("");
    var shell = doc.createElement("div");
    shell.className = "td-wrapped";
    shell.setAttribute("role", "dialog");
    shell.setAttribute("aria-modal", "true");
    shell.setAttribute("aria-label", "Season Wrapped");
    shell.innerHTML =
      '<div class="td-wrapped-card">' +
      '<div class="td-wrapped-head"><strong>Season Wrapped</strong><button type="button" class="btn sm ghost" id="td-wrapped-close">Close</button></div>' +
      '<div class="td-wrapped-track" tabindex="0">' +
      track +
      '</div><div class="td-wrapped-dots">' +
      dots +
      "</div></div>";
    doc.body.appendChild(shell);
    wrappedEl = shell;
    var trackEl = shell.querySelector(".td-wrapped-track");
    function syncDots() {
      if (!trackEl) return;
      var w = trackEl.offsetWidth || 1;
      var idx = Math.round(trackEl.scrollLeft / w);
      shell.querySelectorAll(".td-wrapped-dot").forEach(function (d) {
        d.setAttribute("aria-current", d.getAttribute("data-go") === String(idx) ? "true" : "false");
      });
    }
    shell.querySelector("#td-wrapped-close").onclick = closeWrapped;
    shell.addEventListener("click", function (ev) {
      if (ev.target === shell) closeWrapped();
    });
    shell.querySelectorAll(".td-wrapped-dot").forEach(function (btn) {
      btn.onclick = function () {
        var i = Number(btn.getAttribute("data-go"));
        if (trackEl) trackEl.scrollTo({ left: i * trackEl.offsetWidth, behavior: reduced() ? "auto" : "smooth" });
        syncDots();
      };
    });
    if (trackEl) trackEl.addEventListener("scroll", syncDots, { passive: true });
    syncDots();
    var png = shell.querySelector("#td-wrapped-png");
    if (png) {
      png.onclick = function () {
        exportSharePng(shell.querySelector("#td-share-card"));
      };
    }
  }

  function armStamps(scope) {
    (scope || doc).querySelectorAll(".betcard[data-settled='1']").forEach(stamp);
  }

  function armForms(scope) {
    (scope || doc).querySelectorAll(".tb-form").forEach(formStrip);
  }

  var queued = false;
  var busy = false;

  function pass(scope) {
    if (!doc) return;
    if (busy) {
      queued = true;
      return;
    }
    busy = true;
    try {
      injectCss();
      armStamps(scope);
      armForms(scope);
      flipLists(scope);
      armEmptyStates(scope);
    } finally {
      busy = false;
      if (queued) {
        queued = false;
        raf(function () {
          pass(scope);
        });
      }
    }
  }

  function boot() {
    if (!doc || !doc.body) return;
    injectCss();
    pass(doc);
    if (root.MutationObserver && doc.body) {
      var mo = new root.MutationObserver(function () {
        if (!queued) {
          queued = true;
          raf(function () {
            queued = false;
            pass(doc);
          });
        }
      });
      mo.observe(doc.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["data-settled", "hidden"]
      });
    }
  }

  var api = {
    reduced: reduced,
    stamp: stamp,
    formStrip: formStrip,
    flipLists: flipLists,
    armEmptyStates: armEmptyStates,
    oddsDriftHtml: oddsDriftHtml,
    openSeasonWrapped: openSeasonWrapped,
    pass: pass,
    boot: boot
  };
  root.TBDelight = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (doc) {
    if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot);
    else boot();
  }
})(typeof window !== "undefined" ? window : globalThis);
