/* Open Models row in the account menu.
   The caller decides whether this session is the platform owner. The row is
   created only then, and only when localStorage tipbot_token has a value.
   That value is URI-encoded into the fragment. It is not placed in the query
   or the path, and this file does not log it or send it anywhere.
   The address is fixed: https://www.neilldata.com/models/ */
(function (root) {
  "use strict";
  var MODELS_ORIGIN = "https://www.neilldata.com";
  var MODELS_PATH = "/models/";
  var ITEM_ID = "dd-open-models";
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

  function modelsUrl(token) {
    if (typeof token !== "string" || !token) return "";
    var href = MODELS_ORIGIN + MODELS_PATH + "#t=" + encodeURIComponent(token);
    var parsed;
    try { parsed = new URL(href); } catch (e) { return ""; }
    var head = href.split("#")[0];
    if (head !== MODELS_ORIGIN + MODELS_PATH) return "";
    if (head.indexOf("?") !== -1) return "";
    if (parsed.origin !== MODELS_ORIGIN) return "";
    if (parsed.pathname !== MODELS_PATH) return "";
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

  function chartIcon(doc) {
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
    path.setAttribute("d", "M4 19h16M6 16l4-5 3 3 5-7");
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "1.8");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    svg.appendChild(path);
    return svg;
  }

  function buildItem(doc) {
    var a = doc.createElement("a");
    a.id = ITEM_ID;
    a.className = "dd-item";
    a.setAttribute("id", ITEM_ID);
    a.setAttribute("class", "dd-item");
    var main = doc.createElement("span");
    main.className = "dd-item-main";
    main.setAttribute("class", "dd-item-main");
    main.appendChild(chartIcon(doc));
    var label = doc.createElement("span");
    label.textContent = "Open Models";
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

  function paint(menu, opts) {
    opts = opts || {};
    if (!menu || typeof menu.appendChild !== "function") return null;
    var doc = opts.doc || (typeof document !== "undefined" ? document : null);
    if (!doc || typeof doc.createElement !== "function") return null;
    var owner = opts.owner === true;
    var token = Object.prototype.hasOwnProperty.call(opts, "token") ? opts.token : readToken(opts.storage);
    var href = owner ? modelsUrl(token) : "";
    var existing = findChild(menu, ITEM_ID);
    if (!href) {
      drop(existing);
      return null;
    }
    var el = existing || buildItem(doc);
    el.setAttribute("href", href);
    el.setAttribute("target", "_blank");
    el.setAttribute("rel", "noopener noreferrer");
    try { el.referrerPolicy = "no-referrer"; } catch (e) {}
    el.setAttribute("referrerpolicy", "no-referrer");
    if (!existing) {
      var before = afterSettingsLabel(menu);
      if (before && typeof menu.insertBefore === "function") menu.insertBefore(el, before);
      else menu.appendChild(el);
    }
    if (typeof el.search === "string" && el.search !== "") {
      drop(el);
      return null;
    }
    return findChild(menu, ITEM_ID);
  }

  var API = {
    modelsUrl: modelsUrl,
    readToken: readToken,
    paint: paint,
    ORIGIN: MODELS_ORIGIN,
    PATH: MODELS_PATH,
    ITEM_ID: ITEM_ID
  };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  root.TBOpenModels = API;
})(typeof window !== "undefined" ? window : globalThis);
