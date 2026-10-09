/* Sport marks for chips, filters, and game labels.
 * One map. Browser global window.TBSports + CommonJS for node --test.
 */
(function (root) {
  "use strict";
  // Keys are letters and digits only. "Horse racing", "horse-racing" and
  // "UFC/MMA" fold to the same entry.
  var MARKS = {
    AFL: "🏉",
    AFLW: "🏉",
    NFL: "🏈",
    NBA: "🏀",
    WNBA: "🏀",
    NBL: "🏀",
    SOCCER: "⚽",
    NRL: "🏉",
    MLB: "⚾",
    TENNIS: "🎾",
    CRICKET: "🏏",
    HORSERACING: "🏇",
    RACING: "🏇",
    GOLF: "⛳",
    HOCKEY: "🏒",
    NHL: "🏒",
    ICEHOCKEY: "🏒",
    HOCKEYNHL: "🏒",
    UFC: "🥊",
    MMA: "🥊",
    BOXING: "🥊",
    UFCMMA: "🥊",
    OTHER: "➕"
  };
  var EMOJIS = [];
  Object.keys(MARKS).forEach(function (k) {
    if (EMOJIS.indexOf(MARKS[k]) === -1) EMOJIS.push(MARKS[k]);
  });

  function keyOf(name) {
    return String(name == null ? "" : name)
      .trim()
      .toUpperCase()
      .replace(/[/_-]+/g, " ")
      .replace(/[^A-Z0-9]+/g, "")
  }
  function stripMark(raw) {
    var s = String(raw == null ? "" : raw).trim();
    for (var i = 0; i < EMOJIS.length; i++) {
      var e = EMOJIS[i];
      if (s.indexOf(e) !== 0) continue;
      var rest = s.slice(e.length).replace(/^\s+/, "");
      return rest || s;
    }
    return s;
  }
  function mark(name) {
    var body = stripMark(name);
    if (!String(body).trim()) return "";
    return MARKS[keyOf(body)] || "";
  }
  function label(name) {
    var raw = String(name == null ? "" : name).trim();
    if (!raw) return "";
    var body = stripMark(raw);
    var emoji = MARKS[keyOf(body)] || "";
    if (!emoji) return raw;
    if (body !== raw && raw.indexOf(emoji) === 0) return raw;
    return emoji + " " + body;
  }

  var API = { mark: mark, label: label };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  root.TBSports = API;
})(typeof window !== "undefined" ? window : globalThis);
