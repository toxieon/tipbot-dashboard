/* Embeddable stadium boards. The scene is loaded from TipBot.
   TipStadium.mount(element, { gameId, token, sponsors })
   TipStadium.sponsorsUrl(gameId) */
(function (global) {
  "use strict";
  var API = "https://afl-tipster-bot.onrender.com";
  var pending = null;

  function sponsorsUrl(gameId) {
    return API + "/api/games/" + encodeURIComponent(String(gameId || "")) + "/sponsors";
  }

  function assetUrl(gameId, assetId) {
    return sponsorsUrl(gameId) + "/" + encodeURIComponent(String(assetId || ""));
  }

  function scene() {
    if (global.TipStadiumScene && global.TipStadiumScene.mount) return Promise.resolve(global.TipStadiumScene);
    if (pending) return pending;
    pending = new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = API + "/api/stadium.js";
      script.async = true;
      script.onload = function () {
        if (global.TipStadiumScene && global.TipStadiumScene.mount) resolve(global.TipStadiumScene);
        else { pending = null; reject(new Error("stadium")); }
      };
      script.onerror = function () { pending = null; reject(new Error("stadium")); };
      document.head.appendChild(script);
    });
    return pending;
  }

  function mount(el, opts) {
    opts = opts || {};
    return scene().then(function (api) {
      return api.mount(el, {
        api: API,
        gameId: opts.gameId || "",
        token: opts.token || "",
        model: opts.model || "stadium",
        sponsors: opts.sponsors || null
      });
    });
  }

  global.TipStadium = { API: API, sponsorsUrl: sponsorsUrl, assetUrl: assetUrl, mount: mount };
})(typeof window !== "undefined" ? window : globalThis);
