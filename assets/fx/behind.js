/* Standalone AFL behind moment — loads behind.svg + behind.css. Registers TBMatchFx.behind */
(function (root) {
  "use strict";
  var CSS_ID = "tbfx-behind-css";
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
      if (/behind\.js(\?|$)/.test(src)) return src.replace(/behind\.js.*$/, "");
    }
    return "./";
  }

  function ensureCss() {
    var d = doc();
    if (!d || d.getElementById(CSS_ID)) return;
    var link = d.createElement("link");
    link.id = CSS_ID;
    link.rel = "stylesheet";
    link.href = assetDir() + "behind.css";
    (d.head || d.documentElement).appendChild(link);
  }

  function loadSvg(done) {
    if (svgText) {
      done(svgText);
      return;
    }
    var url = assetDir() + "behind.svg";
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

  function behind(anchor) {
    var d = doc();
    if (!d || !d.body) return;
    ensureCss();
    loadSvg(function (svg) {
      if (!svg) return;
      var host = anchor && anchor.nodeType === 1 ? anchor : null;
      var float = !host;
      if (host) host.classList.add("tbfx-behind-host");
      else host = d.body;
      var layer = d.createElement("div");
      layer.className = "tbfx-behind-layer" + (float ? " tbfx-behind-layer--float" : "");
      layer.setAttribute("aria-hidden", "true");
      layer.innerHTML = svg;
      layer.classList.add(reduced() ? "tbfx-behind-layer--rm" : "tbfx-behind-layer--play");
      host.appendChild(layer);
      var ms = reduced() ? 400 : 700;
      root.setTimeout(function () {
        if (layer.parentNode) layer.parentNode.removeChild(layer);
      }, ms);
    });
  }

  root.TBMatchFx = root.TBMatchFx || {};
  root.TBMatchFx.behind = behind;
})(typeof window !== "undefined" ? window : globalThis);
