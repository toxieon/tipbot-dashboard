/* Open Models and Open Black Book rows in the account menu.
   The caller decides whether this session is the platform owner. The row is
   created only then, and only when localStorage tipbot_token has a value.
   That value is URI-encoded into the fragment. It is not placed in the query
   or the path, and this file does not log it or send it anywhere.
   The addresses are fixed: https://www.neilldata.com/models/ and
   https://www.neilldata.com/blackbook/ (the Black Book row sits next to Models). */
(function (root) {
  "use strict";
  var MODELS_ORIGIN = "https://www.neilldata.com";
  var MODELS_PATH = "/models/";
  var ITEM_ID = "dd-open-models";
  var BLACKBOOK_PATH = "/blackbook/";
  var BLACKBOOK_ITEM_ID = "dd-open-blackbook";
  var TOKEN_KEY = "tipbot_token";

  function readToken(storage) {
    try {
      var bag = storage;
      if (!bag) {
        if (typeof localStorage === "undefined") return "";
        bag = localStorage;
      }
      var raw = bag.getItem(TOKEN_KEY);
      if (typeof raw !== "string" || !raw) return "";
      return raw;
    } catch (e) {
      return "";
    }
  }

  function modelsUrl(token) { return rowUrl(MODELS_PATH, token); }
  function blackbookUrl(token) { return rowUrl(BLACKBOOK_PATH, token); }

  function rowUrl(rowPath, token) {
    if (typeof token !== "string" || !token) return "";
    var href = MODELS_ORIGIN + rowPath + "#t=" + encodeURIComponent(token);
    var parsed;
    try { parsed = new URL(href); } catch (e) { return ""; }
    var head = href.split("#")[0];
    if (head !== MODELS_ORIGIN + rowPath) return "";
    if (head.indexOf("?") !== -1) return "";
    if (parsed.origin !== MODELS_ORIGIN) return "";
    if (parsed.pathname !== rowPath) return "";
    if (parsed.search !== "") return "";
    if (href.slice(head.length) !== "#t=" + encodeURIComponent(token)) return "";
    try {
      if (decodeURIComponent(parsed.hash.slice(3)) !== token) return "";
    } catch (e2) {
      return "";
    }
    return href;
  }

  function findChild(menu, id) {
    var kids = menu.children || [];
    var i, el, p;
    for (i = 0; i < kids.length; i++) {
      if (kids[i] && kids[i].id === id) return kids[i];
    }
    if (typeof menu.querySelector !== "function") return null;
    try { el = menu.querySelector("#" + id); } catch (e) { return null; }
    if (!el || el === menu) return null;
    p = el.parentNode;
    while (p) {
      if (p === menu) return el;
      p = p.parentNode;
    }
    return null;
  }

  function afterSettingsLabel(menu) {
    var kids = menu.children || [];
    var i, cls;
    for (i = 0; i < kids.length; i++) {
      if (!kids[i] || kids[i].id === "dd-version") continue;
      cls = kids[i].className || "";
      if (typeof cls === "string" && (" " + cls + " ").indexOf(" dd-label ") !== -1) {
        return i + 1 < kids.length ? kids[i + 1] : null;
      }
    }
    return findChild(menu, "dd-logout");
  }

  function chartIcon(doc) { return icon(doc, "M4 19h16M6 16l4-5 3 3 5-7"); }
  function bookIcon(doc) { return icon(doc, "M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4zM5 17a3 3 0 0 1 3-3h11"); }

  function icon(doc, d) {
    var svg = doc.createElementNS
      ? doc.createElementNS("http://www.w3.org/2000/svg", "svg")
      : doc.createElement("svg");
    svg.setAttribute("class", "dd-ico");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    var path = doc.createElementNS
      ? doc.createElementNS("http://www.w3.org/2000/svg", "path")
      : doc.createElement("path");
    path.setAttribute("d", d);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "1.8");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    svg.appendChild(path);
    return svg;
  }

  function buildItem(doc, spec) {
    var a = doc.createElement("a");
    a.id = spec.id;
    a.className = "dd-item";
    a.setAttribute("id", spec.id);
    a.setAttribute("class", "dd-item");
    var main = doc.createElement("span");
    main.className = "dd-item-main";
    main.setAttribute("class", "dd-item-main");
    main.appendChild(spec.icon(doc));
    var label = doc.createElement("span");
    label.textContent = spec.label;
    main.appendChild(label);
    var chev = doc.createElement("span");
    chev.className = "dd-chev";
    chev.setAttribute("class", "dd-chev");
    chev.setAttribute("aria-hidden", "true");
    chev.textContent = "\u203a";
    a.appendChild(main);
    a.appendChild(chev);
    return a;
  }

  function drop(el) {
    if (el && el.parentNode && typeof el.parentNode.removeChild === "function") {
      el.parentNode.removeChild(el);
    }
  }

  var MODELS_ROW = { id: ITEM_ID, label: "Open Models", icon: chartIcon, url: modelsUrl };
  var BLACKBOOK_ROW = { id: BLACKBOOK_ITEM_ID, label: "Open Black Book", icon: bookIcon, url: blackbookUrl };

  function placeBefore(menu, spec) {
    if (spec.id === BLACKBOOK_ITEM_ID) {
      // Next to Models: straight after its row when it is there.
      var models = findChild(menu, ITEM_ID);
      var kids = menu.children || [];
      var at = models ? Array.prototype.indexOf.call(kids, models) : -1;
      if (at >= 0) return at + 1 < kids.length ? kids[at + 1] : null;
    }
    return afterSettingsLabel(menu);
  }

  function paintRow(menu, opts, spec) {
    opts = opts || {};
    if (!menu || typeof menu.appendChild !== "function") return null;
    var doc = opts.doc || (typeof document !== "undefined" ? document : null);
    if (!doc || typeof doc.createElement !== "function") return null;
    var owner = opts.owner === true;
    var token = Object.prototype.hasOwnProperty.call(opts, "token") ? opts.token : readToken(opts.storage);
    var href = owner ? spec.url(token) : "";
    var existing = findChild(menu, spec.id);
    if (!href) {
      drop(existing);
      return null;
    }
    var el = existing || buildItem(doc, spec);
    el.setAttribute("href", href);
    el.setAttribute("target", "_blank");
    el.setAttribute("rel", "noopener noreferrer");
    try { el.referrerPolicy = "no-referrer"; } catch (e) {}
    el.setAttribute("referrerpolicy", "no-referrer");
    if (!existing) {
      var before = placeBefore(menu, spec);
      if (before && typeof menu.insertBefore === "function") menu.insertBefore(el, before);
      else menu.appendChild(el);
    }
    if (typeof el.search === "string" && el.search !== "") {
      drop(el);
      return null;
    }
    return findChild(menu, spec.id);
  }

  function paint(menu, opts) { return paintRow(menu, opts, MODELS_ROW); }
  function paintBlackBook(menu, opts) { return paintRow(menu, opts, BLACKBOOK_ROW); }
  var API = {
    modelsUrl: modelsUrl,
    blackbookUrl: blackbookUrl,
    readToken: readToken,
    paint: paint,
    paintBlackBook: paintBlackBook,
    ORIGIN: MODELS_ORIGIN,
    PATH: MODELS_PATH,
    ITEM_ID: ITEM_ID,
    BLACKBOOK_PATH: BLACKBOOK_PATH,
    BLACKBOOK_ITEM_ID: BLACKBOOK_ITEM_ID
  };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  root.TBOpenModels = API;
})(typeof window !== "undefined" ? window : globalThis);
