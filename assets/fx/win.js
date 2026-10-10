/* Standalone settled-win moment — loads win.svg + win.css. Registers TBMatchFx.win */
(function (root) {
  "use strict";
  var CSS_ID = "tbfx-win-css";
  var svgText = null;

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

  function assetDir() {
    var d = doc();
    if (!d) return "./";
    var list = d.querySelectorAll("script[src]");
    var i, src;
    for (i = list.length - 1; i >= 0; i--) {
      src = list[i].getAttribute("src") || "";
      if (/win\.js(\?|$)/.test(src)) return src.replace(/win\.js.*$/, "");
    }
    return "./";
  }

  function ensureCss() {
    var d = doc();
    if (!d || d.getElementById(CSS_ID)) return;
    var link = d.createElement("link");
    link.id = CSS_ID;
    link.rel = "stylesheet";
    link.href = assetDir() + "win.css";
    (d.head || d.documentElement).appendChild(link);
  }

  function loadSvg(done) {
    if (svgText) {
      done(svgText);
      return;
    }
    var url = assetDir() + "win.svg";
    if (!root.fetch) {
      done("");
      return;
    }
    root.fetch(url)
      .then(function (r) {
        return r.ok ? r.text() : "";
      })
      .then(function (t) {
        svgText = t || "";
        done(svgText);
      })
      .catch(function () {
        done("");
      });
  }

  function burst(origin) {
    var colors = ["var(--tbfx-win,#34d399)", "var(--tbfx-accent,#5b8cff)", "var(--tbfx-txt,#f5f7fa)", "var(--tbfx-warn,#fbbf24)"];
    var n = 10 + Math.floor(Math.random() * 5);
    var i;
    for (i = 0; i < n; i++) {
      var bit = doc().createElement("i");
      bit.className = "tbfx-win-confetti";
      var ang = Math.random() * Math.PI * 2;
      var dist = 28 + Math.random() * 36;
      bit.style.setProperty("--tbfx-dx", (Math.cos(ang) * dist).toFixed(1) + "px");
      bit.style.setProperty("--tbfx-dy", (Math.sin(ang) * dist - 8).toFixed(1) + "px");
      bit.style.setProperty("--tbfx-rot", (Math.random() * 140 - 70).toFixed(0) + "deg");
      bit.style.background = colors[i % colors.length];
      origin.appendChild(bit);
    }
    root.setTimeout(function () {
      var bits = origin.querySelectorAll(".tbfx-win-confetti");
      var k;
      for (k = 0; k < bits.length; k++) {
        if (bits[k].parentNode) bits[k].parentNode.removeChild(bits[k]);
      }
    }, 900);
  }

  function win(anchor) {
    var d = doc();
    if (!d || !d.body) return;
    ensureCss();
    loadSvg(function (svg) {
      if (!svg) return;
      var host = anchor && anchor.nodeType === 1 ? anchor : null;
      var float = !host;
      if (host) {
        host.classList.add("tbfx-win-host");
        if (reduced()) host.classList.add("tbfx-win-host--settled");
        else host.classList.add("tbfx-win-host--glow");
      } else host = d.body;
      var layer = d.createElement("div");
      layer.className = "tbfx-win-layer" + (float ? " tbfx-win-layer--float" : "");
      layer.setAttribute("aria-hidden", "true");
      layer.innerHTML = svg;
      layer.classList.add(reduced() ? "tbfx-win-layer--rm" : "tbfx-win-layer--play");
      host.appendChild(layer);
      if (!reduced()) burst(layer);
      var ms = reduced() ? 500 : 1400;
      root.setTimeout(function () {
        if (layer.parentNode) layer.parentNode.removeChild(layer);
        if (host && host.classList) {
          host.classList.remove("tbfx-win-host--glow");
        }
      }, ms);
    });
  }

  root.TBMatchFx = root.TBMatchFx || {};
  root.TBMatchFx.win = win;
})(typeof window !== "undefined" ? window : globalThis);
