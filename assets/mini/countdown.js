/* Live start chip: "starts in 2h 14m" → LIVE. TBMini.countdown */
(function (root) {
  "use strict";

  function toMs(iso) {
    if (root.TBTime && typeof root.TBTime.toMs === "function") return root.TBTime.toMs(iso);
    if (iso == null || iso === "") return NaN;
    var s = String(iso).trim();
    if (/^\d{4}-\d{2}-\d{2} \d/.test(s)) s = s.replace(" ", "T");
    return Date.parse(s);
  }

  function startsInLabel(ms) {
    if (!(ms > 0)) return "starts now";
    var sec = Math.ceil(ms / 1000);
    if (sec < 60) return "starts in <1m";
    var min = Math.floor(sec / 60);
    if (min < 60) return "starts in " + min + "m";
    var hr = Math.floor(min / 60);
    min = min % 60;
    if (hr < 24) return "starts in " + hr + "h" + (min ? " " + min + "m" : "");
    var day = Math.floor(hr / 24);
    hr = hr % 24;
    return "starts in " + day + "d" + (hr ? " " + hr + "h" : "");
  }

  function paintChip(el, startMs, now) {
    if (!el) return "idle";
    if (!Number.isFinite(startMs)) {
      el.textContent = "";
      el.className = "tb-mini-chip";
      return "idle";
    }
    if (now >= startMs) {
      el.textContent = "LIVE";
      el.className = "tb-mini-chip tb-mini-chip--live";
      el.setAttribute("aria-label", "Live");
      return "live";
    }
    var label = startsInLabel(startMs - now);
    el.textContent = label;
    el.className = "tb-mini-chip tb-mini-chip--soon";
    el.setAttribute("aria-label", label);
    return "soon";
  }

  function countdown(el, startIso, opts) {
    opts = opts || {};
    var nowFn = opts.now || function () { return Date.now(); };
    var tickMs = opts.tickMs == null ? 30000 : opts.tickMs;
    var startMs = toMs(startIso);
    var timer = null;

    function tick() {
      var state = paintChip(el, startMs, nowFn());
      if (state === "live" && timer) {
        clearInterval(timer);
        timer = null;
      }
    }

    tick();
    if (paintChip(el, startMs, nowFn()) !== "live") {
      timer = setInterval(tick, tickMs);
    }

    return {
      stop: function () {
        if (timer) clearInterval(timer);
        timer = null;
      },
      refresh: tick,
      startsInLabel: startsInLabel,
    };
  }

  var api = root.TBMini = root.TBMini || {};
  api.countdown = countdown;
  api.startsInLabel = startsInLabel;
  api._toMs = toMs;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { countdown: countdown, startsInLabel: startsInLabel, toMs: toMs, paintChip: paintChip };
  }
})(typeof window !== "undefined" ? window : globalThis);
