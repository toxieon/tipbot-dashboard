/* In-progress gallops loop — cartoon horse/jockey SVG, no finish implied. TBLiveFx.race */
(function (root) {
  "use strict";

  var HOST = "tblfx-race-host";
  var PALETTE = [
    ["#E5484D", "#FFFFFF"],
    ["#2EAF62", "#111318"],
    ["#5B8CFF", "#FFFFFF"],
    ["#8E6CF0", "#FFFFFF"],
    ["#FF8A3D", "#1B2A4A"],
    ["#F5C542", "#111318"],
    ["#19B5A5", "#FFFFFF"],
    ["#F5F7FA", "#111318"],
  ];

  var NAME_COLOUR = {
    red: "#E5484D",
    blue: "#5B8CFF",
    green: "#2EAF62",
    yellow: "#F5C542",
    gold: "#F5C542",
    orange: "#FF8A3D",
    purple: "#8E6CF0",
    violet: "#8E6CF0",
    teal: "#19B5A5",
    white: "#F5F7FA",
    black: "#111318",
    navy: "#1B2A4A",
    pink: "#F472B6",
    grey: "#8B93A7",
    gray: "#8B93A7",
  };

  function doc() {
    return root.document;
  }

  function reduced() {
    try {
      return !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch (e) {
      return false;
    }
  }

  function raf(fn) {
    var run =
      (root.requestAnimationFrame && root.requestAnimationFrame.bind(root)) ||
      function (f) {
        return root.setTimeout(function () {
          f(Date.now());
        }, 16);
      };
    return run(fn);
  }

  function caf(id) {
    var cancel = (root.cancelAnimationFrame && root.cancelAnimationFrame.bind(root)) || root.clearTimeout;
    return cancel(id);
  }

  function now() {
    return root.performance && root.performance.now ? root.performance.now() : Date.now();
  }

  function parsePair(runner, idx) {
    var raw = runner && runner.colours;
    if (typeof raw === "string" && raw.indexOf(",") >= 0) {
      var bits = raw.split(",");
      var a = bits[0] ? bits[0].trim().toLowerCase() : "";
      var b = bits[1] ? bits[1].trim().toLowerCase() : "";
      var p = NAME_COLOUR[a] || (a.indexOf("#") === 0 ? a : PALETTE[idx % PALETTE.length][0]);
      var s = NAME_COLOUR[b] || (b.indexOf("#") === 0 ? b : PALETTE[idx % PALETTE.length][1]);
      return [p, s];
    }
    if (Array.isArray(raw) && raw.length >= 2) return [String(raw[0]), String(raw[1])];
    var n = runner && runner.number != null ? Number(runner.number) : idx + 1;
    var pick = PALETTE[(Math.abs(n) || 1) % PALETTE.length];
    return [pick[0], pick[1]];
  }

  function horseSvg(num, primary, secondary) {
    return (
      '<g class="tblfx-horse">' +
      '<ellipse cx="0" cy="8" rx="22" ry="7" fill="rgba(0,0,0,.12)"/>' +
      '<path d="M-18 2 Q-8 -6 6 -4 L10 -5 L9 1 L16 10 Q8 14 0 12 L-10 14 Q-20 12 -18 2 Z" fill="#C49A6C" stroke="#8B6914" stroke-width="1"/>' +
      '<path d="M10 -5 C12 -9 15 -10 18 -9 L29 -8 L31 -6 L28 -4 L20 -4 C14 -4 12 -5 10 -5 Z" fill="#C49A6C" stroke="#8B6914" stroke-width="1" stroke-linejoin="round"/>' +
      '<path d="M14 -9.5 L13.2 -12.2 L15.8 -10.2 Z M17.2 -9.8 L16.4 -12.4 L18.6 -10.4 Z" fill="#B8895A" stroke="#8B6914" stroke-width=".6"/>' +
      '<circle cx="24.5" cy="-7.2" r=".9" fill="#3D2E1A"/>' +
      '<path d="M11 -5.5 Q13 -8 16 -7.5 Q18.5 -9 21 -8" fill="none" stroke="#6B4F12" stroke-width="1.1" stroke-linecap="round"/>' +
      '<path d="M-16 4 L-22 10 L-18 12" fill="none" stroke="#8B6914" stroke-width="1.4" stroke-linecap="round"/>' +
      '<path d="M4 12 L6 18 L2 20 M-4 12 L-6 18 L-2 20" fill="none" stroke="#6B4F12" stroke-width="1.2" stroke-linecap="round"/>' +
      '<rect x="-6" y="-2" width="12" height="9" rx="2" fill="' +
      primary +
      '" stroke="' +
      secondary +
      '" stroke-width="1"/>' +
      '<text x="0" y="5" text-anchor="middle" font-size="7" font-weight="700" fill="' +
      secondary +
      '" font-family="system-ui,sans-serif">' +
      num +
      "</text>" +
      '<circle cx="1" cy="-13.5" r="2.6" fill="#F5D0A9"/>' +
      '<ellipse cx="1" cy="-15" rx="2.2" ry="1.5" fill="#5B8CFF" opacity=".85"/>' +
      '<path d="M3 -12.5 L7 -10.5 L6.5 -9" fill="none" stroke="#4A3728" stroke-width="1" stroke-linecap="round"/>' +
      "</g>"
    );
  }

  function railPattern(scroll) {
    var x = scroll % 40;
    var posts = "";
    var i;
    for (i = -2; i < 14; i++) {
      var px = i * 40 - x;
      posts +=
        '<line x1="' +
        px +
        '" y1="92" x2="' +
        px +
        '" y2="78" stroke="#D4DCE8" stroke-width="2"/>' +
        '<line x1="' +
        px +
        '" y1="78" x2="' +
        (px + 40) +
        '" y2="78" stroke="#B8C4D4" stroke-width="1.5"/>';
    }
    return posts;
  }

  function normalizeRunners(runners) {
    var list = Array.isArray(runners) ? runners.slice(0, 12) : [];
    if (!list.length) {
      list = [{ number: 1 }, { number: 2 }, { number: 3 }, { number: 4 }];
    }
    return list;
  }

  function race(el, runners) {
    var d = doc();
    if (!d || !el || el.nodeType !== 1) return;
    root.TBLiveFx.stop();

    var list = normalizeRunners(runners);
    var reduce = reduced();
    var hidden = false;
    var rafId = 0;
    var t0 = now();
    var scroll = 0;

    el.classList.add(HOST);
    if (!el.style.position || el.style.position === "static") el.style.position = "relative";
    if (!el.style.minHeight) el.style.minHeight = "140px";

    var wrap = d.createElement("div");
    wrap.className = "tblfx-race";
    wrap.setAttribute("aria-hidden", "true");
    wrap.style.cssText = "position:absolute;inset:0;overflow:hidden;border-radius:inherit;pointer-events:none;";
    var svg = d.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 400 100");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.setAttribute("preserveAspectRatio", "xMidYMid slice");

    var turf = d.createElementNS("http://www.w3.org/2000/svg", "rect");
    turf.setAttribute("x", "0");
    turf.setAttribute("y", "55");
    turf.setAttribute("width", "400");
    turf.setAttribute("height", "45");
    turf.setAttribute("fill", "#3D7A45");
    svg.appendChild(turf);

    var railG = d.createElementNS("http://www.w3.org/2000/svg", "g");
    railG.setAttribute("class", "tblfx-rail");
    svg.appendChild(railG);

    var runnersG = d.createElementNS("http://www.w3.org/2000/svg", "g");
    runnersG.setAttribute("class", "tblfx-runners");
    svg.appendChild(runnersG);

    wrap.appendChild(svg);
    el.appendChild(wrap);

    var states = [];
    var gi;
    for (gi = 0; gi < list.length; gi++) {
      var pair = parsePair(list[gi], gi);
      var num = list[gi].number != null ? list[gi].number : gi + 1;
      var g = d.createElementNS("http://www.w3.org/2000/svg", "g");
      g.innerHTML = horseSvg(num, pair[0], pair[1]);
      runnersG.appendChild(g);
      states.push({
        node: g,
        lane: 0.18 + (gi / Math.max(1, list.length - 1)) * 0.55,
        phase: Math.random() * Math.PI * 2,
        prog: 0.12 + Math.random() * 0.55,
        drift: (Math.random() - 0.5) * 0.00035,
        bob: 0.9 + Math.random() * 0.5,
        skew: (Math.random() - 0.5) * 0.08,
      });
    }

    function paint(frame) {
      var i;
      scroll = reduce ? 12 : scroll + 1.8;
      railG.innerHTML = railPattern(scroll);
      for (i = 0; i < states.length; i++) {
        var st = states[i];
        if (!reduce) {
          st.prog += 0.0016 + st.drift + Math.sin(frame * 0.02 + st.phase) * 0.00025;
          if (st.prog > 0.92) st.prog = 0.18 + Math.random() * 0.15;
          if (st.prog < 0.08) st.prog = 0.55 + Math.random() * 0.2;
        }
        var bob = reduce ? 0 : Math.sin(frame * 0.14 * st.bob + st.phase) * 3.5;
        var laneY = 52 + st.lane * 38 + bob * 0.35;
        var depth = 0.72 + st.lane * 0.38;
        var x = 40 + st.prog * 300;
        var skew = st.skew + (reduce ? 0 : Math.sin(frame * 0.03 + st.phase) * 0.04);
        st.node.setAttribute(
          "transform",
          "translate(" + x.toFixed(1) + " " + laneY.toFixed(1) + ") scale(" + depth.toFixed(2) + ") skewX(" + skew.toFixed(3) + ")"
        );
      }
    }

    function onVis() {
      hidden = !!(d && d.hidden);
      if (!hidden && !reduce && !rafId) loop();
    }

    function loop() {
      rafId = 0;
      if (hidden || reduce) return;
      paint((now() - t0) / 16);
      rafId = raf(loop);
    }

    function teardown() {
      if (rafId) caf(rafId);
      rafId = 0;
      if (d && d.removeEventListener) d.removeEventListener("visibilitychange", onVis);
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
      el.classList.remove(HOST);
    }

    paint(reduce ? 0 : 1);
    if (!reduce) {
      rafId = raf(loop);
      if (d && d.addEventListener) d.addEventListener("visibilitychange", onVis);
    }

    root.TBLiveFx._session = { teardown: teardown };
  }

  root.TBLiveFx = root.TBLiveFx || {};
  root.TBLiveFx.race = race;

  var API = { race: race, parsePair: parsePair, normalizeRunners: normalizeRunners };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
