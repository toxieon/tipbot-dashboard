/* Owner-only Push secret row for each connector in server settings.
   Status: GET  /api/connectors/{id}/push-secret/status  → {set, created_at}
   Create: POST /api/connectors/{id}/push-secret/generate → {secret, created_at} once.
   The secret is shown in a sheet and then dropped. It is never written to
   storage, and it is never sent to a log.
   Dry run: POST /api/connectors/{id}/push-dry-run {payload} checks a pasted
   push body (validation, race match, each-way split, Late, post preview).
   Nothing is posted or stored.
   Send test tip: POST /api/connectors/{id}/test-tip posts one TEST racing tip
   (horse TipBot, random silk) in the connector's channel. Nothing is saved. */
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

  function dryRunPath(id, gid) {
    return withGuild("/api/connectors/" + enc(id) + "/push-dry-run", gid);
  }

  function testTipPath(id, gid) {
    return withGuild("/api/connectors/" + enc(id) + "/test-tip", gid);
  }

  function paths(id, gid) {
    return { list: listPath(gid), status: statusPath(id, gid), generate: generatePath(id, gid), dryRun: dryRunPath(id, gid), testTip: testTipPath(id, gid) };
  }

  function channelLabel(name) {
    var text = String(name == null ? "" : name).trim().replace(/^#/, "");
    return text ? "#" + text : "";
  }

  function testTipConfirm(c) {
    var where = channelLabel(c && (c.channel_name || c.channel_label)) || "this connector's channel";
    return {
      title: "Send a test tip?",
      message: "Posts one TEST racing tip (horse TipBot) in " + where + ". It isn't saved or graded.",
      confirmLabel: "Send test tip"
    };
  }

  // Plain words for what the bot answered. 404 = an older bot without the route.
  function testTipOutcome(status, body) {
    body = body && typeof body === "object" ? body : {};
    if (status === 404) return { ok: false, notYet: true, message: "The bot doesn't have Send test tip yet. It needs the next update." };
    if (status === 429) {
      var wait = Number(body.retry_after);
      return { ok: false, message: wait > 0 ? "Wait " + Math.ceil(wait) + "s before sending another test tip." : "Wait a few seconds before sending another test tip." };
    }
    if (status >= 200 && status < 300 && body.ok !== false && Number(body.posted) > 0) {
      var chan = channelLabel(body.channel_name);
      return { ok: true, message: "Test tip posted" + (chan ? " in " + chan : "") + "." };
    }
    return { ok: false, message: String(body.message || body.error || "Couldn't send the test tip.") };
  }

  async function runTestTip(ctx, id) {
    var res = await ctx.api(testTipPath(id, ctx.gid), {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: "{}"
    });
    if (unauth(res, null, ctx)) return { ok: false, unauth: true, message: "" };
    var body = await readJson(res);
    return testTipOutcome(res ? res.status : 0, body);
  }

  // Parse the pasted body before sending, so a typo is caught on the phone.
  function parsePayload(text) {
    var raw = String(text == null ? "" : text).trim();
    if (!raw) return { error: "Paste a push body first." };
    try {
      var value = JSON.parse(raw);
      if (value === null || typeof value !== "object") return { error: "The body must be a JSON object or list." };
      return { payload: value };
    } catch (e) {
      return { error: "That isn't valid JSON." };
    }
  }

  function legLine(leg) {
    if (!leg) return "";
    if (!leg.event_id) return String(leg.description || "Unmatched leg");
    var bits = [];
    if (leg.meeting_name) bits.push(String(leg.meeting_name) + (leg.race_number != null ? " R" + leg.race_number : ""));
    bits.push((leg.runner_number != null ? "#" + leg.runner_number + " " : "") + String(leg.runner_name || ""));
    bits.push(String(leg.bet_type || ""));
    return bits.filter(Boolean).join(" \u00b7 ");
  }

  function tipHtml(item) {
    item = item || {};
    var ok = item.accepted === true;
    var html = '<div class="pd-tip">';
    html += '<div class="pd-head"><span class="pd-badge ' + (ok ? "pd-ok" : "pd-bad") + '">' + (ok ? "Would post" : "Would not post") + "</span>";
    html += '<span class="pd-id">' + esc(item.id || ("Tip " + ((item.index || 0) + 1))) + "</span></div>";
    var reasons = Array.isArray(item.reasons) ? item.reasons : [];
    if (reasons.length) {
      html += '<ul class="pd-reasons">';
      reasons.forEach(function (r) { html += "<li>" + esc(r) + "</li>"; });
      html += "</ul>";
    }
    var facts = [];
    if (item.market) facts.push("Market: " + item.market);
    if (item.odds != null) facts.push("Odds: " + item.odds);
    if (item.units != null) facts.push("Units: " + item.units);
    if (item.would_be_late) facts.push("Late: posted after the start, kept out of stats");
    if (facts.length) html += '<div class="pd-facts">' + esc(facts.join(" \u00b7 ")) + "</div>";
    var res = item.resolved || {};
    if (res.status) {
      html += '<div class="pd-k">Race match: ' + esc(res.status) + "</div>";
      if (res.reason) html += '<div class="pd-facts">' + esc(res.reason) + "</div>";
      (Array.isArray(res.legs) ? res.legs : []).forEach(function (leg) {
        html += '<div class="pd-leg">' + esc(legLine(leg)) + "</div>";
      });
    }
    var ew = item.each_way;
    if (ew) {
      var terms = ew.place_terms || {};
      html += '<div class="pd-k">Each way</div><div class="pd-facts">'
        + esc((ew.stake_each_part != null ? ew.stake_each_part + "u each part \u00b7 " : "")
          + "Place odds " + (ew.place_odds != null ? ew.place_odds : "?") + " (" + (ew.place_odds_source || "") + ")"
          + " \u00b7 Terms " + (terms.fraction != null ? terms.fraction : "") + ", places " + (terms.places != null ? terms.places : "")
          + " (" + (ew.place_terms_source || "") + ")")
        + "</div>";
    }
    var pv = item.preview;
    if (pv && pv.text) html += '<div class="pd-k">Post preview</div><pre class="pd-pre">' + esc(pv.text) + "</pre>";
    html += "</div>";
    return html;
  }

  function resultHtml(body) {
    if (!body || typeof body !== "object") return '<div class="pd-err">No answer.</div>';
    if (body.ok === false) return '<div class="pd-err">' + esc(body.message || body.error || "Dry run failed.") + "</div>";
    var tips = Array.isArray(body.tips) ? body.tips : [];
    var head = (body.accepted || 0) + " of " + (body.count || tips.length) + " would post. Nothing was posted or saved.";
    if (body.paused) head += " The connector is paused.";
    var html = '<div class="pd-sum">' + esc(head) + "</div>";
    tips.forEach(function (t) { html += tipHtml(t); });
    return html;
  }

  function dryRunHtml(name) {
    return '<div class="pd-modal">'
      + '<div class="ps-k">Dry run \u00b7 ' + esc(name) + "</div>"
      + '<p class="pd-note">Paste a push body. It is checked like a real push but nothing is posted or saved.</p>'
      + '<textarea class="pd-input" data-pd-input rows="8" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder=\'{"tips":[{"id":"...","market":"Each Way"}]}\'></textarea>'
      + '<div class="pd-actions"><button type="button" class="btn" data-pd-run>Run dry run</button><button type="button" class="ghost" data-pd-close>Close</button></div>'
      + '<div class="pd-out" data-pd-out role="status" aria-live="polite"></div>'
      + "</div>";
  }

  async function runDryRun(ctx, id, text) {
    var parsed = parsePayload(text);
    if (parsed.error) return { ok: false, message: parsed.error };
    var res = await ctx.api(dryRunPath(id, ctx.gid), {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ payload: parsed.payload })
    });
    if (unauth(res, null, ctx)) return { ok: false, unauth: true, message: "" };
    var body = await readJson(res);
    if (!res || !res.ok) return { ok: false, message: (body && (body.message || body.error)) || "Dry run failed." };
    return body;
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
      + '<div class="ps-idline"><span class="ps-idk">Connector ID</span>'
      + '<code class="ps-id">' + esc(id) + '</code>'
      + '<button type="button" class="ghost ps-copy" data-ps-copy-id>Copy</button></div>'
      + '<div class="ps-status"' + (failed ? "" : ' aria-live="polite"') + '>' + esc(status) + '</div>'
      + '<span class="ps-msg" data-ps-msg role="status"></span></div>'
      + '<div class="ps-btns"><button type="button" class="' + (set && !failed ? "ghost" : "btn") + ' ps-go" data-ps-go>' + esc(failed ? "Retry" : label) + '</button>'
      + '<button type="button" class="ghost ps-go" data-ps-dry>Dry run</button>'
      + '<button type="button" class="ghost ps-go" data-ps-test>Send test tip</button></div>'
      + '</section>';
  }

  function modalHtml() {
    return '<div class="ps-modal">'
      + '<div class="ps-field"><span class="ps-k">Connector ID</span>'
      + '<div class="ps-pair">'
      + '<input class="ps-secret" data-ps-cid type="text" readonly autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Connector ID" value="">'
      + '<button type="button" class="ghost" data-ps-copy-id>Copy</button>'
      + '</div></div>'
      + '<div class="ps-field"><span class="ps-k">Push secret</span>'
      + '<p class="ps-warn">You won\'t see this again.</p>'
      + '<div class="ps-pair">'
      + '<input class="ps-secret" data-ps-secret type="text" readonly autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" aria-label="Push secret" value="">'
      + '<button type="button" class="btn" data-ps-copy-secret>Copy</button>'
      + '</div></div>'
      + '<div class="ps-actions"><button type="button" class="ghost" data-ps-done>Done</button></div>'
      + '</div>';
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
      "#ps-root .ps-name,#ps-root .ps-status,#ps-root .ps-idk{color:var(--faint);font-size:var(--t-foot);line-height:1.45;overflow-wrap:anywhere}",
      "#ps-root .ps-idline{display:flex;align-items:center;gap:8px;margin-top:6px;min-width:0}",
      "#ps-root .ps-idk{flex:none}",
      "#ps-root .ps-id{flex:1;min-width:0;overflow-wrap:anywhere;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;color:var(--txt)}",
      "#ps-root .ps-copy{flex:none;min-height:44px;padding:6px 12px;font-size:var(--t-foot)}",
      "#ps-root .ps-msg{display:block;min-height:0;margin-top:4px;font-size:var(--t-foot)}",
      "#ps-root .ps-msg:empty{display:none}",
      "#ps-root .ps-go{min-height:44px;flex:none}",
      "#ps-root .ps-err{color:var(--loss)}",
      "#ps-root .ps-btns{display:flex;gap:8px;flex-wrap:wrap}",
      ".pd-modal .pd-note{margin:0 0 8px;font-size:var(--t-foot);color:var(--faint);line-height:1.45}",
      ".pd-modal .pd-input{display:block;width:100%;min-height:140px;margin:0 0 10px;padding:10px 12px;border-radius:var(--r-sm,10px);border:1px solid var(--line);background:var(--card2);color:var(--txt);font-size:16px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;resize:vertical;box-sizing:border-box}",
      ".pd-modal .pd-actions{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}",
      ".pd-modal .pd-actions .btn,.pd-modal .pd-actions .ghost{min-height:44px;flex:1}",
      ".pd-modal .pd-sum{font-weight:700;font-size:var(--t-sub);margin:4px 0 8px;line-height:1.4}",
      ".pd-modal .pd-tip{border:1px solid var(--line);border-radius:12px;padding:10px;margin-bottom:10px;min-width:0}",
      ".pd-modal .pd-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}",
      ".pd-modal .pd-badge{font-size:12px;font-weight:700;padding:2px 8px;border-radius:999px}",
      ".pd-modal .pd-ok{background:var(--win-bg,rgba(46,160,67,.18));color:var(--win-ink,var(--txt))}",
      ".pd-modal .pd-bad{background:var(--loss-bg,rgba(229,83,75,.18));color:var(--loss-ink,var(--txt))}",
      ".pd-modal .pd-id{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;overflow-wrap:anywhere;min-width:0}",
      ".pd-modal .pd-reasons{margin:6px 0 0 18px;padding:0;font-size:13px;color:var(--loss-ink,var(--txt))}",
      ".pd-modal .pd-k{font-weight:700;font-size:12px;margin-top:8px;color:var(--txt)}",
      ".pd-modal .pd-facts,.pd-modal .pd-leg{font-size:13px;color:var(--faint);line-height:1.45;overflow-wrap:anywhere}",
      ".pd-modal .pd-pre{white-space:pre-wrap;overflow-wrap:anywhere;margin:4px 0 0;padding:8px;border-radius:8px;background:var(--card2);font-size:12px;line-height:1.45;max-width:100%}",
      ".pd-modal .pd-err{color:var(--loss);font-size:13px}",
      ".ps-modal .ps-k{display:block;font-weight:700;font-size:var(--t-sub);margin-bottom:6px;color:var(--txt)}",
      ".ps-modal .ps-field{margin:0 0 14px;min-width:0}",
      ".ps-modal .ps-warn{margin:0 0 8px;font-weight:700;font-size:var(--t-sub);line-height:1.4;color:var(--warn-ink,var(--loss-ink,var(--txt)))}",
      ".ps-modal .ps-pair{display:flex;align-items:center;gap:8px;min-width:0}",
      ".ps-modal .ps-secret{display:block;width:auto;flex:1;min-width:0;max-width:100%;min-height:44px;margin:0;padding:10px 12px;border-radius:var(--r-sm,10px);border:1px solid var(--line);background:var(--card2);color:var(--txt);font:inherit;font-size:16px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}",
      ".ps-modal .ps-pair .btn,.ps-modal .ps-pair .ghost{width:auto;flex:none;min-height:44px;padding:8px 12px}",
      ".ps-modal .ps-actions{display:flex;flex-direction:column;gap:8px}",
      ".ps-modal .ps-actions .btn,.ps-modal .ps-actions .ghost{width:100%;min-height:44px}",
      ".ps-back{position:fixed;inset:0;z-index:80;display:flex;align-items:flex-end;justify-content:center;padding:12px;padding-bottom:calc(12px + env(safe-area-inset-bottom,0px));background:rgba(15,23,38,.45)}",
      ".ps-sheet{width:min(420px,100%);max-height:min(80vh,640px);max-height:min(80dvh,640px);overflow:auto;background:var(--card);color:var(--txt);border:1px solid var(--line);border-radius:16px;padding:16px}",
      "@media(max-width:420px){#ps-root .ps-go{width:100%}}",
      "@media(min-width:480px){.ps-modal .ps-actions{flex-direction:row}.ps-modal .ps-actions .ghost{width:auto;flex:1}}",
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

  function copyText(text, btn, field) {
    var value = String(text || "");
    if (!value) return;
    var clip = root.navigator && root.navigator.clipboard;
    function mark(ok) {
      if (!btn) return;
      btn.textContent = ok ? "Copied" : "Copy";
    }
    function selectField() {
      try { if (field) { field.focus(); field.select(); } } catch (e) {}
    }
    if (clip && typeof clip.writeText === "function") {
      clip.writeText(value).then(function () { mark(true); }, function () { selectField(); mark(false); });
      return;
    }
    selectField();
    mark(false);
  }

  function showSecret(doc, connectorId, secret) {
    var held = String(secret || "");
    var cid = String(connectorId || "");
    var input = null;
    function wipe() {
      held = "";
      if (input) input.value = "";
    }
    function bind(scope) {
      input = scope.querySelector("[data-ps-secret]");
      var idInput = scope.querySelector("[data-ps-cid]");
      if (input) input.value = held;
      if (idInput) idInput.value = cid;
      var copySecret = scope.querySelector("[data-ps-copy-secret]");
      var copyId = scope.querySelector("[data-ps-copy-id]");
      if (copySecret) copySecret.onclick = function () { copyText(held, copySecret, input); };
      if (copyId) copyId.onclick = function () { copyText(cid, copyId, idInput); };
      return scope.querySelector("[data-ps-done]");
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
        initialFocus: "[data-ps-copy-secret]",
        onClose: finish
      });
      var doneBtn = bind(sh.card);
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
    function close() {
      wipe();
      if (back.parentNode) back.parentNode.removeChild(back);
      doc.removeEventListener("keydown", onKey, true);
    }
    function onKey(e) { if (e.key === "Escape") close(); }
    doc.addEventListener("keydown", onKey, true);
    back.addEventListener("click", function (e) { if (e.target === back) close(); });
    var doneBtn2 = bind(back);
    if (doneBtn2) doneBtn2.onclick = close;
    try {
      var focus = back.querySelector("[data-ps-copy-secret]");
      if (focus) focus.focus();
    } catch (e) {}
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
      var dryButtons = rootEl.querySelectorAll("[data-ps-dry]");
      Array.prototype.forEach.call(dryButtons, function (btn) {
        btn.onclick = function () {
          var row = btn.closest ? btn.closest("[data-ps-id]") : null;
          var cid = row ? row.getAttribute("data-ps-id") : "";
          var c = null;
          state.list.forEach(function (item) { if (String(item.id) === cid) c = item; });
          if (cid) openDryRun(cid, labelOf(c || { id: cid }));
        };
      });
      var testButtons = rootEl.querySelectorAll("[data-ps-test]");
      Array.prototype.forEach.call(testButtons, function (btn) {
        btn.onclick = function () { onTestTip(btn); };
      });
      var idCopies = rootEl.querySelectorAll("[data-ps-copy-id]");
      Array.prototype.forEach.call(idCopies, function (btn) {
        btn.onclick = function () {
          var row = btn.closest ? btn.closest("[data-ps-id]") : null;
          var cid = row ? row.getAttribute("data-ps-id") : "";
          copyText(cid, btn, null);
        };
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

    function openDryRun(id, name) {
      function bind(scope, close) {
        var input = scope.querySelector("[data-pd-input]");
        var out = scope.querySelector("[data-pd-out]");
        var run = scope.querySelector("[data-pd-run]");
        var shut = scope.querySelector("[data-pd-close]");
        if (shut) shut.onclick = close;
        if (run) run.onclick = async function () {
          if (run.disabled) return;
          run.disabled = true;
          if (out) out.innerHTML = '<div class="pd-note">Checking\u2026</div>';
          try {
            var body = await runDryRun(ctx, id, input ? input.value : "");
            if (body && body.unauth) return;
            if (out) out.innerHTML = resultHtml(body);
          } catch (e) {
            if (unauth(null, e, ctx)) return;
            if (out) out.innerHTML = '<div class="pd-err">Couldn\'t reach the bot.</div>';
          } finally {
            run.disabled = false;
          }
        };
      }
      var sheet = root.TBSheet;
      if (sheet && typeof sheet.open === "function") {
        var sh = sheet.open({ label: "Dry run", html: dryRunHtml(name), initialFocus: "[data-pd-input]" });
        bind(sh.card, function () { sh.close({ via: "done" }); });
        return;
      }
      var back = doc.createElement("div");
      back.className = "ps-back";
      back.innerHTML = '<div class="ps-sheet" role="dialog" aria-modal="true" aria-label="Dry run">' + dryRunHtml(name) + "</div>";
      doc.body.appendChild(back);
      function close() {
        if (back.parentNode) back.parentNode.removeChild(back);
        doc.removeEventListener("keydown", onKey, true);
      }
      function onKey(e) { if (e.key === "Escape") close(); }
      doc.addEventListener("keydown", onKey, true);
      back.addEventListener("click", function (e) { if (e.target === back) close(); });
      bind(back, close);
    }

    var testing = {};

    function say(id, text, isErr) {
      var toast = typeof ctx.toast === "function" ? ctx.toast : (typeof root.toast === "function" ? root.toast : null);
      if (toast) {
        try { toast(text, isErr ? "error" : "success"); return; } catch (e) {}
      }
      setMsg(id, text, isErr);
    }

    async function onTestTip(btn) {
      var row = btn.closest ? btn.closest("[data-ps-id]") : null;
      var id = row ? row.getAttribute("data-ps-id") : "";
      if (!id || testing[id] || btn.disabled) return;
      testing[id] = true;
      btn.disabled = true;
      setMsg(id, "", false);
      var c = null;
      state.list.forEach(function (item) { if (String(item.id) === id) c = item; });
      try {
        var ok = true;
        if (typeof ctx.confirm === "function") ok = await ctx.confirm(testTipConfirm(c));
        if (!ok) return;
        setMsg(id, "Sending\u2026", false);
        var out = await runTestTip(ctx, id);
        if (out.unauth) return;
        setMsg(id, "", false);
        say(id, out.message, !out.ok);
      } catch (e) {
        if (unauth(null, e, ctx)) return;
        setMsg(id, "", false);
        say(id, "Couldn't reach the bot.", true);
      } finally {
        testing[id] = false;
        if (btn.isConnected) btn.disabled = false;
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
        showSecret(doc, id, secret);
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
    dryRunPath: dryRunPath,
    testTipPath: testTipPath,
    testTipConfirm: testTipConfirm,
    testTipOutcome: testTipOutcome,
    runTestTip: runTestTip,
    channelLabel: channelLabel,
    parsePayload: parsePayload,
    resultHtml: resultHtml,
    tipHtml: tipHtml,
    dryRunHtml: dryRunHtml,
    runDryRun: runDryRun,
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
