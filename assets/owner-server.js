/* Owner-only server settings shell. Not part of the public site
   (scripts/build-public.mjs ASSET_DENY). The page loads it for an owner
   session; the public build does not copy this file. */
(function (root) {
  "use strict";

  function mountPostSettings(el, ctx) {
    if (!el || !ctx || ctx.owner !== true) return;
    var TD = root.TD;
    if (!TD || typeof TD.load !== "function") return;
    TD.load("connector-post").then(function () {
      if (!el.isConnected || ctx.owner !== true) return;
      if (root.TBConnectorPost && typeof root.TBConnectorPost.mount === "function") root.TBConnectorPost.mount(el, ctx);
      else el.innerHTML = "";
    }).catch(function () { if (el.isConnected) el.innerHTML = ""; });
  }

  function mountPushSecrets(el, ctx) {
    if (!el || !ctx || ctx.owner !== true) return;
    var TD = root.TD;
    if (!TD || typeof TD.load !== "function") return;
    TD.load("connector-push").then(function () {
      if (!el.isConnected || ctx.owner !== true) return;
      if (root.TBPushSecret && typeof root.TBPushSecret.mount === "function") root.TBPushSecret.mount(el, ctx);
      else el.innerHTML = "";
    }).catch(function () { if (el.isConnected) el.innerHTML = ""; });
  }

  // The server page stamps data-guild-id on #detail. A ctx made for another
  // server (a late callback after a server switch) must never draw here.
  function pageGid(ctx) {
    var d = ctx && ctx.detail;
    var g = d && typeof d.getAttribute === "function" ? d.getAttribute("data-guild-id") : null;
    return g == null || g === "" ? null : String(g);
  }

  function sameServer(ctx) {
    if (!ctx || ctx.gid == null || String(ctx.gid) === "") return false;
    var cur = pageGid(ctx);
    return cur === null || cur === String(ctx.gid);
  }

  function renderConnectors(ctx) {
    var body = ctx && ctx.detail && ctx.detail.querySelector("#settings-body");
    if (!body) return;
    if (!(ctx && ctx.owner === true) || !sameServer(ctx)) { body.innerHTML = ""; return; }
    body.innerHTML = '<div data-cx-client></div><div data-cx-post></div><div data-cx-push></div><div data-cx-extra><div class="empty">Loading…</div></div>';
    var client = body.querySelector("[data-cx-client]");
    var post = body.querySelector("[data-cx-post]");
    var push = body.querySelector("[data-cx-push]");
    var extra = body.querySelector("[data-cx-extra]");
    ensureExt().then(function () {
      if (!(ctx && ctx.owner === true) || !sameServer(ctx)) return;
      if (client && client.isConnected && root.TBConnectors && typeof root.TBConnectors.mount === "function") root.TBConnectors.mount(client, ctx);
      if (post && post.isConnected) mountPostSettings(post, ctx);
      if (push && push.isConnected) mountPushSecrets(push, ctx);
      if (!extra || !extra.isConnected) return;
      if (root.TBConnectorPanel && typeof root.TBConnectorPanel.mount === "function") root.TBConnectorPanel.mount(extra, ctx);
      else extra.innerHTML = "";
    });
  }

  // Stop the panels on a server page that is being replaced.
  function stop(detail) {
    if (!detail || typeof detail.querySelector !== "function") return;
    var client = detail.querySelector("[data-cx-client]");
    if (client && typeof client._cxStop === "function") client._cxStop();
    var push = detail.querySelector("[data-cx-push]");
    if (push && typeof push._psStop === "function") push._psStop();
  }

  function attach(ctx) {
    if (!ctx || ctx.owner !== true || !ctx.detail) return;
    if (!sameServer(ctx)) return;
    var tabs = ctx.detail.querySelector("#settings-panel .tabs");
    if (!tabs || tabs.querySelector("#stab-connectors")) return;
    var btn = document.createElement("button");
    btn.className = "tab";
    btn.id = "stab-connectors";
    btn.type = "button";
    btn.textContent = "Connectors";
    tabs.appendChild(btn);
    btn.onclick = function () {
      var names = tabs.querySelectorAll(".tab");
      for (var i = 0; i < names.length; i++) names[i].classList.toggle("active", names[i] === btn);
      renderConnectors(ctx);
    };
    tabs.addEventListener("click", function (e) {
      var t = e.target;
      if (!t || t === btn || !t.id || t.id.indexOf("stab-") !== 0) return;
      btn.classList.remove("active");
    });
  }

  var API = { attach: attach, renderConnectors: renderConnectors, mountPushSecrets: mountPushSecrets, mountPostSettings: mountPostSettings, sameServer: sameServer, stop: stop };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  root.TBOwnerServer = API;
  if (root.TD && root.TD.loaded) root.TD.loaded["owner-server"] = true;
})(typeof window !== "undefined" ? window : globalThis);
