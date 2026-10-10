/* Standalone tip copy helper. TBMini.formatTipText + TBMini.copyTip + mini toast. */
(function (root) {
  "use strict";
  var CSS_ID = "tb-mini-css";
  var toastTimer = null;

  function num(v) {
    var n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function fmtOdds(v) {
    var n = num(v);
    return n == null || n <= 1 ? "" : n.toFixed(2);
  }

  function fmtUnits(v) {
    var n = num(v);
    if (n == null || n <= 0) return "";
    var s = n % 1 === 0 ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
    return s + "u";
  }

  function legDescription(l) {
    if (!l || typeof l !== "object") return "";
    if (l.description) return String(l.description).replace(/\s+/g, " ").trim();
    if (l.desc) return String(l.desc).replace(/\s+/g, " ").trim();
    if (l.selection) return String(l.selection).replace(/\s+/g, " ").trim();
    if (l.player && l.stat) {
      var side = String(l.side || "");
      if (/^over$/i.test(side)) return l.player + " " + l.line + "+ " + l.stat;
      if (/^under$/i.test(side)) return l.player + " under " + l.line + " " + l.stat;
      return l.player + " " + l.stat;
    }
    return String(l.name || l.label || "").trim();
  }

  function legLine(l, index) {
    var text = legDescription(l);
    if (!text) return "";
    var odds = fmtOdds(l.odds);
    var prefix = index == null ? "" : String(index + 1) + ". ";
    return prefix + text + (odds ? " @ " + odds : "");
  }

  function formatTipText(tip) {
    if (!tip || typeof tip !== "object") return "";
    var legs = Array.isArray(tip.legs) ? tip.legs : [];
    var odds = fmtOdds(tip.odds);
    var units = fmtUnits(tip.units);
    var title = String(tip.game_name || tip.title || "").trim();
    var book = String(tip.bookmaker || "").trim();
    var lines = [];
    if (title) lines.push(title);
    var stakeTail = "";
    if (odds && units) stakeTail = " @ " + odds + " · " + units;
    else if (odds) stakeTail = " @ " + odds;
    else if (units) stakeTail = " · " + units;

    if (legs.length > 1) {
      lines.push(legs.length + "-leg multi" + stakeTail);
      for (var i = 0; i < legs.length; i++) {
        var row = legLine(legs[i], i);
        if (row) lines.push(row);
      }
    } else if (legs.length === 1) {
      var single = legLine(legs[0]);
      if (single) lines.push(single + stakeTail);
      else if (stakeTail) lines.push(stakeTail.replace(/^ · /, ""));
    } else {
      var pick = String(tip.selection || tip.pick || "").trim();
      if (pick) lines.push(pick + stakeTail);
      else if (stakeTail) lines.push(stakeTail.replace(/^ @ /, "").replace(/^ · /, ""));
    }
    if (book) lines.push(book);
    return lines.join("\n").trim();
  }

  function assetDir() {
    var d = root.document;
    if (!d) return "./";
    var list = d.querySelectorAll("script[src]");
    for (var i = list.length - 1; i >= 0; i--) {
      var src = list[i].getAttribute("src") || "";
      if (/copy-tip\.js(\?|$)/.test(src)) return src.replace(/copy-tip\.js.*$/, "");
    }
    return "./";
  }

  function ensureCss() {
    var d = root.document;
    if (!d || d.getElementById(CSS_ID)) return;
    var link = d.createElement("link");
    link.id = CSS_ID;
    link.rel = "stylesheet";
    link.href = assetDir() + "mini.css";
    (d.head || d.documentElement).appendChild(link);
  }

  function miniToast(msg, kind) {
    var d = root.document;
    if (!d || !d.body) return;
    ensureCss();
    var el = d.getElementById("tb-mini-toast");
    if (!el) {
      el = d.createElement("div");
      el.id = "tb-mini-toast";
      el.className = "tb-mini-toast";
      el.setAttribute("role", "status");
      d.body.appendChild(el);
    }
    el.textContent = String(msg == null ? "" : msg);
    el.className = "tb-mini-toast tb-mini-toast--" + (kind || "info") + " in";
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove("in");
    }, 2800);
  }

  function writeClipboard(text) {
    if (root.navigator && root.navigator.clipboard && root.navigator.clipboard.writeText) {
      return root.navigator.clipboard.writeText(text);
    }
    var d = root.document;
    if (!d || !d.body) return Promise.reject(new Error("clipboard unavailable"));
    var ta = d.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    d.body.appendChild(ta);
    ta.select();
    var ok = false;
    try {
      ok = d.execCommand && d.execCommand("copy");
    } catch (e) {
      ok = false;
    }
    d.body.removeChild(ta);
    return ok ? Promise.resolve() : Promise.reject(new Error("copy failed"));
  }

  function copyTip(tip) {
    var text = formatTipText(tip);
    if (!text) {
      miniToast("Nothing to copy", "error");
      return Promise.resolve(false);
    }
    return writeClipboard(text).then(
      function () {
        miniToast("Tip copied", "success");
        return true;
      },
      function () {
        miniToast("Could not copy", "error");
        return false;
      }
    );
  }

  var api = root.TBMini = root.TBMini || {};
  api.formatTipText = formatTipText;
  api.copyTip = copyTip;
  api._miniToast = miniToast;
  api._writeClipboard = writeClipboard;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      formatTipText: formatTipText,
      copyTip: copyTip,
      miniToast: miniToast,
      writeClipboard: writeClipboard,
    };
  }
})(typeof window !== "undefined" ? window : globalThis);
