/* Live race-in-progress cartoon (generic horses). window.TBLiveFx.race + shared stop(). */
(function (root, factory) {
  var base = root && root.TBLiveFx ? root.TBLiveFx : {};
  var api = factory(base);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.TBLiveFx = api;
})(typeof window !== "undefined" ? window : globalThis, function (TBLiveFx) {
  "use strict";

  var hub = TBLiveFx._hub || { active: null };
  TBLiveFx._hub = hub;

  var raf =
    (typeof requestAnimationFrame === "function" && requestAnimationFrame) ||
    function (f) {
      return setTimeout(function () {
        f(Date.now());
      }, 16);
    };
  var caf =
    (typeof cancelAnimationFrame === "function" && cancelAnimationFrame) ||
    (typeof clearTimeout === "function" && clearTimeout) ||
    function () {};

  function nowMs() {
    if (typeof performance !== "undefined" && performance.now) return performance.now();
    return Date.now();
  }

  function reducedMotion() {
    try {
      if (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
    } catch (e) {}
    return false;
  }

  function parseColours(raw) {
    if (!raw) return ["#c45c26", "#f2e6d8"];
    if (Array.isArray(raw)) return raw.length ? raw.map(String) : ["#c45c26", "#f2e6d8"];
    return String(raw)
      .split(/[,|/]/)
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean)
      .slice(0, 4);
  }

  function escNum(n) {
    var x = Number(n);
    if (!Number.isFinite(x)) return "0";
    return String(x);
  }

  function horseSvg(number, cols, bob) {
    var c0 = cols[0] || "#c45c26";
    var c1 = cols[1] || cols[0] || "#f2e6d8";
    var c2 = cols[2] || "#2a2118";
    var dy = bob || 0;
    return (
      '<g transform="translate(0 ' +
      escNum(dy) +
      ')">' +
      '<ellipse cx="34" cy="30" rx="18" ry="10" fill="' +
      c0 +
      '"/>' +
      '<path d="M18 28 Q8 22 6 14 Q12 8 20 12 L26 18" fill="none" stroke="' +
      c2 +
      '" stroke-width="2.2" stroke-linecap="round"/>' +
      '<path d="M48 28 Q58 20 60 12 Q54 6 46 10 L40 16" fill="none" stroke="' +
      c2 +
      '" stroke-width="2.2" stroke-linecap="round"/>' +
      '<rect x="24" y="18" width="20" height="14" rx="3" fill="' +
      c1 +
      '"/>' +
      '<text x="34" y="28" text-anchor="middle" font-size="9" font-family="system-ui,sans-serif" font-weight="700" fill="' +
      c2 +
      '">' +
      escNum(number) +
      "</text>" +
      '<circle cx="52" cy="10" r="5" fill="#f5d0b5"/>' +
      '<path d="M50 15 L54 22 L48 24" fill="#f5d0b5"/>' +
      '<path d="M14 34 L10 42 M22 36 L18 44 M40 36 L36 44 M52 34 L48 42" stroke="' +
      c2 +
      '" stroke-width="2" stroke-linecap="round"/>' +
      "</g>"
    );
  }

  function disposeRun(run) {
    if (!run) return;
    if (run.rafId) caf(run.rafId);
    if (run.vis && typeof document !== "undefined" && document.removeEventListener) {
      document.removeEventListener("visibilitychange", run.vis);
    }
    if (run.root && run.root.parentNode) run.root.parentNode.removeChild(run.root);
  }

  function stop() {
    disposeRun(hub.active);
    hub.active = null;
  }
  TBLiveFx.stop = stop;

  function race(el, runners) {
    stop();
    if (!el || !runners || !runners.length) return;
    var list = runners.slice(0, 12).map(function (r, i) {
      return {
        number: r.number != null ? r.number : i + 1,
        colours: parseColours(r.colours),
        lane: i,
        phase: Math.random() * Math.PI * 2,
        speed: 0.35 + Math.random() * 0.25,
        offset: Math.random() * 0.4,
      };
    });

    var host = document.createElement("div");
    host.className = "tb-fx-race";
    host.setAttribute("role", "img");
    host.setAttribute("aria-label", "Race in progress animation");
    host.style.cssText = "position:relative;width:100%;max-width:640px;margin:0 auto;aspect-ratio:16/9;overflow:hidden;border-radius:12px;background:linear-gradient(180deg,#87b86a 0%,#5f9a48 55%,#3d6b32 100%);";
    el.appendChild(host);

    var svgNS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 640 360");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.style.display = "block";
    host.appendChild(svg);

    var defs = document.createElementNS(svgNS, "defs");
    defs.innerHTML =
      '<linearGradient id="tbfx-turf" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#6faa58"/><stop offset="100%" stop-color="#3f6d36"/></linearGradient>';
    svg.appendChild(defs);

    var track = document.createElementNS(svgNS, "g");
    track.setAttribute("transform", "skewY(-6) translate(0 24)");
    track.innerHTML =
      '<rect x="20" y="120" width="600" height="140" rx="8" fill="url(#tbfx-turf)"/>' +
      '<g class="tbfx-rail" transform="translate(0,0)">' +
      Array.from({ length: 14 })
        .map(function (_, i) {
          return '<rect x="' + (40 + i * 44) + '" y="108" width="6" height="24" fill="#e8ecef" opacity="0.9"/>';
        })
        .join("") +
      "</g>" +
      '<line x1="24" y1="260" x2="616" y2="260" stroke="#dfe6ee" stroke-width="3"/>';
    svg.appendChild(track);

    var herd = document.createElementNS(svgNS, "g");
    herd.setAttribute("transform", "translate(0,-8)");
    svg.appendChild(herd);

    var run = {
      root: host,
      rafId: 0,
      t0: nowMs(),
      rail: 0,
      paused: false,
      hidden: false,
      list: list,
      herd: herd,
    };

    function paintStatic() {
      var mid = list
        .map(function (r, i) {
          return { r: r, p: 0.35 + (i % 5) * 0.08 };
        })
        .sort(function (a, b) {
          return b.p - a.p;
        });
      herd.innerHTML = mid
        .map(function (item, rank) {
          var x = 80 + item.p * 460;
          var y = 150 + item.r.lane * 14;
          return (
            '<g transform="translate(' +
            escNum(x) +
            "," +
            escNum(y) +
            ') scale(0.85)">' +
            horseSvg(item.r.number, item.r.colours, 0) +
            "</g>"
          );
        })
        .join("");
    }

    if (reducedMotion()) {
      paintStatic();
      hub.active = run;
      return;
    }

    function frame() {
      if (run.paused || run.hidden) {
        run.rafId = raf(frame);
        return;
      }
      var t = (nowMs() - run.t0) / 1000;
      run.rail = (run.rail + 2.8) % 44;
      var railG = track.querySelector(".tbfx-rail");
      if (railG) railG.setAttribute("transform", "translate(" + escNum(-run.rail) + ",0)");

      var scored = list.map(function (r) {
        var wobble =
          Math.sin(t * r.speed * 3.1 + r.phase) * 0.04 +
          Math.sin(t * 1.7 + r.offset * 10) * 0.02;
        var p = 0.22 + ((t * r.speed * 0.12 + r.offset + wobble) % 0.76);
        var bob = Math.sin(t * 9 + r.phase) * 2.2;
        return { r: r, p: p, bob: bob };
      });
      scored.sort(function (a, b) {
        return b.p - a.p;
      });

      herd.innerHTML = scored
        .map(function (item, rank) {
          var depth = 1 - rank / Math.max(1, scored.length - 1);
          var x = 70 + item.p * 470 + Math.sin(t * 2.3 + item.r.phase) * 6;
          var y = 138 + item.r.lane * 13 + depth * 4;
          var sc = 0.78 + depth * 0.12;
          return (
            '<g transform="translate(' +
            escNum(x) +
            "," +
            escNum(y) +
            ") scale(" +
            escNum(sc) +
            ')">' +
            horseSvg(item.r.number, item.r.colours, item.bob) +
            "</g>"
          );
        })
        .join("");

      run.rafId = raf(frame);
    }

    run.vis = function () {
      run.hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
      run.paused = run.hidden;
    };
    if (typeof document !== "undefined" && document.addEventListener) {
      document.addEventListener("visibilitychange", run.vis);
      run.vis();
    }

    run.rafId = raf(frame);
    hub.active = run;
  }

  TBLiveFx.race = race;
  TBLiveFx.reducedMotion = reducedMotion;
  return TBLiveFx;
});
