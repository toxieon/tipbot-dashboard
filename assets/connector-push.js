/* Owner-only Push secret row for each connector in server settings.
   Status: GET  /api/connectors/{id}/push-secret/status  → {set, created_at}
   Create: POST /api/connectors/{id}/push-secret/generate → {secret, created_at} once.
   The secret is shown in a sheet and then dropped. It is never written to
   storage, and it is never sent to a log. */
(function (root) {
  "use strict";

  var ROTATE_CONFIRM = {
    title: "Rotate the push secret?",
    message: "The old secret stops working.",
    confirmLabel: "Rotate",
    destructive: true
  };

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c];
    });
  }

  function enc(v) { return encodeURIComponent(v == null ? "" : String(v)); }

  function isSet(body) {
    if (!body || typeof body !== "object") return false;
    var v = body.set;
    return v === true || v === 1 || v === "1" || v === "true";
  }

  function listFrom(body) {
    if (!body || typeof body !== "object") return [];
    if (Array.isArray(body.connectors)) return body.connectors.filter(Boolean);
    if (body.connector && typeof body.connector === "object") return [body.connector];
    if (body.id != null && body.id !== "") return [body];
    return [];
  }

  function labelOf(c) {
    var name = String((c && (c.tipster_name || c.tipster_label || c.name || c.label)) || "").trim();
    if (name) return name;
    var id = String(c && c.id != null ? c.id : "");
    if (!id) return "Connector";
    return "Connector " + id.slice(-4);
  }

  function fallbackDate(raw) {
    if (raw == null || raw === "") return "";
    var ms = Date.parse(String(raw));
    if (!isFinite(ms)) return String(raw);
    try {
      return new Date(ms).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "Australia/Sydney" });
    } catch (e) {
      return String(raw);
    }
  }

  function statusText(body, when) {
    if (body && body.error) return "";
    if (!isSet(body)) return "Not set";
    var date = "";
    if (typeof when === "function") {
      try { date = String(when(body.created_at) || ""); } catch (e) { date = ""; }
    }
    if (!date) date = fallbackDate(body.created_at);
    return date ? ("Set on " + date) : "Set";
  }

  function buttonText(set) {
    return set ? "Rotate" : "Generate push secret";
  }

  function withGuild(path, gid) {
    if (gid == null || gid === "") return path;
    return path + "?guild_id=" + enc(gid);
  }

  function listPath(gid) {
    return "/api/connectors?guild_id=" + enc(gid);
  }

  function statusPath(id, gid) {
    return withGuild("/api/connectors/" + enc(id) + "/push-secret/status", gid);
  }

  function generatePath(id, gid) {
    return withGuild("/api/connectors/" + enc(id) + "/push-secret/generate", gid);
  }

  function paths(id, gid) {
    return { list: listPath(gid), status: statusPath(id, gid), generate: generatePath(id, gid) };
  }

  function rememberStatus(createdAt) {
    return { set: true, created_at: createdAt || null };
  }

  function rowHtml(c, body, when) {
    var id = String(c && c.id != null ? c.id : "");
    var set = isSet(body);
    var failed = !!(body && body.error);
    var status = failed ? "Couldn't check" : statusText(body, when);
    var label = buttonText(set);
    var name = labelOf(c);
    return '<section class="ps-row" data-ps-id="' + esc(id) + '">'
      + '<div class="ps-main"><div class="ps-k">Push secret</div>'
      + '<div class="ps-name">' + esc(name) + '</div>'
      + '<div class="ps-status"' + (failed ? "" : ' aria-live="polite"') + '>' + esc(status) + '</div>'
      + '<span class="ps-msg" data-ps-msg role="status"></span></div>'
      + '<button type="button" class="' + (set && !failed ? "ghost" : "btn") + ' ps-go" data-ps-go>' + esc(failed ? "Retry" : label) + '</button>'
      + '</section>';
  }

  function modalHtml() {
    return '<div class="ps-modal">'
      + '<p class="ps-warn">You won\'t see this again.</p>'
      + '<input class="ps-secret" data-ps-secret type="text" readonly autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" aria-label="Push secret" value="">'
      + '<div class="ps-actions">'
      + '<button type="button" class="btn" data-ps-copy>Copy</button>'
      + '<button type="button" class="ghost" data-ps-done>Done</button>'
      + '</div></div>';
  }

  function injectCss(doc) {
    if (!doc || !doc.getElementById || doc.getElementById("ps-css")) return;
    var style = doc.createElement("style");
    style.id = "ps-css";
    style.textContent = [
      "#ps-root{min-width:0;max-width:100%}",
      "#ps-root *{box-sizing:border-box}",
      "#ps-root .ps-row{display:flex;align-items:flex-start;gap:10px;flex-wrap:wrap;margin-top:14px;padding-top:12px;border-top:1px solid var(--line);min-width:0}",
      "#ps-root .ps-row:first-child{margin-top:0}",
      "#ps-root .ps-main{flex:1;min-width:0}",
      "#ps-root .ps-k{font-weight:700;font-size:var(--t-sub);margin-bottom:4px;color:var(--txt)}",
      "#ps-root .ps-name,#ps-root .ps-status{color:var(--faint);font-size:var(--t-foot);line-height:1.45;overflow-wrap:anywhere}",
      "#ps-root .ps-msg{display:block;min-height:0;margin-top:4px;font-size:var(--t-foot)}",
      "#ps-root .ps-msg:empty{display:none}",
      "#ps-root .ps-go{min-height:44px;flex:none}",
      "#ps-root .ps-err{color:var(--loss)}",
      ".ps-modal .ps-warn{margin:0 0 10px;font-weight:700;font-size:var(--t-sub);line-height:1.4;color:var(--warn-ink,var(--loss-ink,var(--txt)))}",
      ".ps-modal .ps-secret{display:block;width:100%;max-width:100%;min-height:44px;margin:0 0 12px;padding:10px 12px;border-radius:var(--r-sm,10px);border:1px solid var(--line);background:var(--card2);color:var(--txt);font:inherit;font-size:16px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}",
      ".ps-modal .ps-actions{display:flex;flex-direction:column;gap:8px}",
      ".ps-modal .ps-actions .btn,.ps-modal .ps-actions .ghost{width:100%;min-height:44px}",
      ".ps-back{position:fixed;inset:0;z-index:80;display:flex;align-items:flex-end;justify-content:center;padding:12px;padding-bottom:calc(12px + env(safe-area-inset-bottom,0px));background:rgba(15,23,38,.45)}",
      ".ps-sheet{width:min(420px,100%);max-height:min(80vh,640px);overflow:auto;background:var(--card);color:var(--txt);border:1px solid var(--line);border-radius:16px;padding:16px}",
      "@media(max-width:420px){#ps-root .ps-go{width:100%}}",
      "@media(min-width:480px){.ps-modal .ps-actions{flex-direction:row}.ps-modal .ps-actions .btn,.ps-modal .ps-actions .ghost{width:auto;flex:1}}",
      "@media(min-width:641px){.ps-back{align-items:center}}"
    ].join("");
    (doc.head || doc.documentElement).appendChild(style);
  }

  async function readJson(res) {
    try { return await res.json(); } catch (e) { return {}; }
  }

  function unauth(res, err, ctx) {
    if ((res && res.status === 401) || (err && err.unauth)) {
      if (ctx && typeof ctx.onUnauth === "function") ctx.onUnauth();
      return true;
    }
    return false;
  }

  async function requestSecret(ctx, id, known) {
    if (isSet(known)) {
      var ok = true;
      if (typeof ctx.confirm === "function") ok = await ctx.confirm(ROTATE_CONFIRM);
      if (!ok) return { cancelled: true };
    }
    var res = await ctx.api(generatePath(id, ctx.gid), {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: "{}"
    });
    if (unauth(res, null, ctx)) return { unauth: true };
    var body = await readJson(res);
    if (!res || !res.ok || body.ok === false || !body.secret) {
      return { error: true };
    }
    return { secret: String(body.secret), created_at: body.created_at || null };
  }

  function showSecret(doc, secret) {
    var held = String(secret || "");
    var input = null;
    function wipe() {
      held = "";
      if (input) input.value = "";
    }
    function selectField() {
      try { if (input) { input.focus(); input.select(); } } catch (e) {}
    }
    function copyHeld(btn) {
      var text = held;
      if (!text) return;
      var clip = root.navigator && root.navigator.clipboard;
      function mark(ok) {
        if (!btn) return;
        btn.textContent = ok ? "Copied" : "Copy";
      }
      if (clip && typeof clip.writeText === "function") {
        clip.writeText(text).then(function () { mark(true); }, function () { selectField(); mark(false); });
        return;
      }
      selectField();
      mark(false);
    }
    var sheet = root.TBSheet;
    if (sheet && typeof sheet.open === "function") {
      function onEsc(e) {
        if (e.key !== "Escape") return;
        finish();
      }
      function finish() {
        wipe();
        doc.removeEventListener("keydown", onEsc, true);
      }
      var sh = sheet.open({
        label: "Push secret",
        html: modalHtml(),
        initialFocus: "[data-ps-copy]",
        onClose: finish
      });
      input = sh.card.querySelector("[data-ps-secret]");
      if (input) input.value = held;
      var copyBtn = sh.card.querySelector("[data-ps-copy]");
      var doneBtn = sh.card.querySelector("[data-ps-done]");
      if (copyBtn) copyBtn.onclick = function () { copyHeld(copyBtn); };
      if (doneBtn) doneBtn.onclick = function () { finish(); sh.close({ via: "done" }); };
      var scrim = sh.el && sh.el.querySelector(".tbs-scrim");
      if (scrim) scrim.addEventListener("click", finish);
      doc.addEventListener("keydown", onEsc, true);
      return;
    }
    var back = doc.createElement("div");
    back.className = "ps-back";
    back.innerHTML = '<div class="ps-sheet" role="dialog" aria-modal="true" aria-label="Push secret">' + modalHtml() + "</div>";
    doc.body.appendChild(back);
    input = back.querySelector("[data-ps-secret]");
    if (input) input.value = held;
    function close() {
      wipe();
      if (back.parentNode) back.parentNode.removeChild(back);
      doc.removeEventListener("keydown", onKey, true);
    }
    function onKey(e) { if (e.key === "Escape") close(); }
    doc.addEventListener("keydown", onKey, true);
    back.addEventListener("click", function (e) { if (e.target === back) close(); });
    var copyBtn2 = back.querySelector("[data-ps-copy]");
    var doneBtn2 = back.querySelector("[data-ps-done]");
    if (copyBtn2) copyBtn2.onclick = function () { copyHeld(copyBtn2); };
    if (doneBtn2) doneBtn2.onclick = close;
    try { if (copyBtn2) copyBtn2.focus(); } catch (e) {}
  }

  function mount(el, ctx) {
    if (!el) return;
    ctx = ctx || {};
    var doc = el.ownerDocument || root.document;
    if (!doc) return;
    injectCss(doc);
    var stopped = false;
    var gen = 0;
    var state = { list: [], status: {} };

    function alive() { return !stopped && el.isConnected !== false; }

    function paint() {
      if (!alive()) return;
      var html = '<div id="ps-root">';
      state.list.forEach(function (c) {
        if (!c || c.id == null || c.id === "") return;
        html += rowHtml(c, state.status[String(c.id)] || { error: true }, ctx.when);
      });
      html += "</div>";
      el.innerHTML = html || "";
      var rootEl = el.querySelector("#ps-root");
      if (!rootEl) return;
      var buttons = rootEl.querySelectorAll("[data-ps-go]");
      Array.prototype.forEach.call(buttons, function (btn) {
        btn.onclick = function () { onGo(btn); };
      });
    }

    function rowEl(id) {
      var want = String(id);
      var nodes = el.querySelectorAll("[data-ps-id]");
      for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].getAttribute("data-ps-id") === want) return nodes[i];
      }
      return null;
    }

    function setMsg(id, text, isErr) {
      var row = rowEl(id);
      if (!row) return;
      var msg = row.querySelector("[data-ps-msg]");
      if (!msg) return;
      msg.textContent = text || "";
      msg.classList.toggle("ps-err", !!isErr);
    }

    async function loadOne(c, token) {
      var id = String(c.id);
      try {
        var res = await ctx.api(statusPath(id, ctx.gid));
        if (!alive() || token !== gen) return;
        if (unauth(res, null, ctx)) return;
        var body = await readJson(res);
        if (!alive() || token !== gen) return;
        if (!res || !res.ok || body.ok === false) state.status[id] = { error: true };
        else state.status[id] = { set: isSet(body), created_at: body.created_at || null };
      } catch (e) {
        if (unauth(null, e, ctx)) return;
        if (alive() && token === gen) state.status[id] = { error: true };
      }
    }

    async function load() {
      var token = ++gen;
      el.innerHTML = '<div id="ps-root"><div class="empty">Loading…</div></div>';
      try {
        var res = await ctx.api(listPath(ctx.gid));
        if (!alive() || token !== gen) return;
        if (unauth(res, null, ctx)) return;
        var body = await readJson(res);
        if (!alive() || token !== gen) return;
        if (!res || res.status === 404 || res.status === 501) { el.innerHTML = ""; return; }
        if (!res.ok || body.ok === false) {
          el.innerHTML = '<div id="ps-root"><div class="empty">Couldn\'t load connectors.</div></div>';
          return;
        }
        state.list = listFrom(body).filter(function (c) { return c && c.id != null && c.id !== ""; });
        state.status = {};
        state.list.forEach(function (c) { state.status[String(c.id)] = { error: true }; });
        await Promise.all(state.list.map(function (c) { return loadOne(c, token); }));
        if (!alive() || token !== gen) return;
        if (!state.list.length) { el.innerHTML = ""; return; }
        paint();
      } catch (e) {
        if (!alive() || token !== gen) return;
        if (unauth(null, e, ctx)) return;
        el.innerHTML = '<div id="ps-root"><div class="empty">Couldn\'t reach the bot.</div></div>';
      }
    }

    async function onGo(btn) {
      var row = btn.closest ? btn.closest("[data-ps-id]") : null;
      var id = row ? row.getAttribute("data-ps-id") : "";
      if (!id) return;
      var known = state.status[id] || {};
      if (known.error) { state.status[id] = {}; await loadOne({ id: id }, gen); paint(); return; }
      if (btn.disabled) return;
      btn.disabled = true;
      setMsg(id, "", false);
      try {
        var result = await requestSecret(ctx, id, known);
        if (!alive()) return;
        if (result.unauth || result.cancelled) { btn.disabled = false; return; }
        if (result.error || !result.secret) {
          btn.disabled = false;
          setMsg(id, "Couldn't generate a secret.", true);
          return;
        }
        var created = result.created_at;
        var secret = result.secret;
        state.status[id] = rememberStatus(created);
        paint();
        showSecret(doc, secret);
        secret = "";
        result.secret = "";
      } catch (e) {
        if (unauth(null, e, ctx)) return;
        if (btn.isConnected) btn.disabled = false;
        setMsg(id, "Couldn't reach the bot.", true);
      }
    }

    el._psStop = function () { stopped = true; gen += 1; };
    load();
  }

  var API = {
    ROTATE_CONFIRM: ROTATE_CONFIRM,
    isSet: isSet,
    listFrom: listFrom,
    labelOf: labelOf,
    statusText: statusText,
    buttonText: buttonText,
    paths: paths,
    listPath: listPath,
    statusPath: statusPath,
    generatePath: generatePath,
    rememberStatus: rememberStatus,
    rowHtml: rowHtml,
    modalHtml: modalHtml,
    requestSecret: requestSecret,
    mount: mount
  };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  root.TBPushSecret = API;
  if (root.TD && root.TD.loaded) root.TD.loaded["connector-push"] = true;
})(typeof window !== "undefined" ? window : globalThis);
