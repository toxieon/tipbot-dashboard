/* Namespace bootstrap for live loop animations (race-running.js, afl-match.js). */
(function (root) {
  "use strict";
  var api = root.TBLiveFx || {};
  api._session = null;
  api.stop = function () {
    var s = api._session;
    if (!s) return;
    if (typeof s.teardown === "function") s.teardown();
    api._session = null;
  };
  root.TBLiveFx = api;
})(typeof window !== "undefined" ? window : globalThis);
