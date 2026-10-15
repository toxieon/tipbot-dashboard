/* Platform owner only: Brandon's Discord user. A server owner is not this account. */
(function (root) {
  "use strict";

  var OWNER_ID = "274753853516283905";

  function decodePart(part) {
    try {
      var pad = String(part || "").replace(/-/g, "+").replace(/_/g, "/");
      while (pad.length % 4) pad += "=";
      var json;
      if (typeof atob === "function") json = atob(pad);
      else if (typeof Buffer !== "undefined") json = Buffer.from(pad, "base64").toString("utf8");
      else return null;
      return JSON.parse(json);
    } catch (e) {
      return null;
    }
  }

  function userIdFromToken(token) {
    var part = String(token || "").split(".")[0];
    var body = decodePart(part);
    if (!body || body.user_id == null) return "";
    return String(body.user_id).trim();
  }

  function allow(tokenOrId) {
    var text = String(tokenOrId || "").trim();
    if (!text) return false;
    if (text.indexOf(".") >= 0) text = userIdFromToken(text);
    return text === OWNER_ID;
  }

  var api = {
    allow: allow,
    userIdFromToken: userIdFromToken
  };

  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.TBMcgGate = api;
  if (root && root.TD && root.TD.loaded) root.TD.loaded["mcg/gate"] = true;
})(typeof window !== "undefined" ? window : globalThis);
