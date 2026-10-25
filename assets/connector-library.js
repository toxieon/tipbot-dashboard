/* Owner-only Connectors library. Served inside /api/ops/ext.js.
   GET  /api/connectors/templates?guild_id=      the recipes
   POST /api/connectors?guild_id=  {template, tipster_name, channel_id, endpoint_url, api_key}
        makes a NEW paused connector in this server only; a push template
        returns its push secret once ("push_secret").
   POST /api/connectors/{id}/push-dry-run?guild_id=  {payload}   (when the bot has it)
   POST /api/connectors/{id}/toggle?guild_id=        {guild_id, enabled}
   Two ways in: "Add existing" (a template and a short form) and "Create new"
   (a step-by-step guide). Nothing opens a new tab; the secret is only held
   while the sheet is open. */
(function (root) {
  "use strict";

  var SAMPLE_TIP = {
    id: "sample-1",
    sport: "Racing",
    event: "Flemington R4",
    start: "2099-01-01T04:00:00Z",
    selection: "Example Runner",
    number: 1,
    market: "Win",
    odds: 3.5,
    stake: 1,
    status: "pending"
  };
  var STEPS = ["Type", "Details", "Create", "Signed request", "Dry run", "Enable"];

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c];
    });
  }

  function enc(v) { return encodeURIComponent(v == null ? "" : String(v)); }

  function g(gid) { return "guild_id=" + enc(gid); }

  function paths(gid, id) {
    return {
      templates: "/api/connectors/templates?" + g(gid),
      create: "/api/connectors?" + g(gid),
      dryRun: "/api/connectors/" + enc(id) + "/push-dry-run?" + g(gid),
      toggle: "/api/connectors/" + enc(id) + "/toggle?" + g(gid),
      channels: "/api/channels?" + g(gid)
    };
  }

  function templatesFrom(body) {
    var list = body && Array.isArray(body.templates) ? body.templates : [];
    return list.filter(function (t) { return t && t.id; });
  }

  function channelsFrom(body) {
    var list = body && Array.isArray(body.channels) ? body.channels : (Array.isArray(body) ? body : []);
    return list.filter(function (c) { return c && (c.id != null || c.channel_id != null); }).map(function (c) {
      var id = String(c.id != null ? c.id : c.channel_id);
      return { id: id, name: String(c.name || id) };
    });
  }

  function needs(t, key) { return !!(t && Array.isArray(t.needs) && t.needs.indexOf(key) >= 0); }
  function optional(t, key) { return !!(t && Array.isArray(t.optional) && t.optional.indexOf(key) >= 0); }

  // Checks before sending; the bot checks again.
  function formError(t, form) {
    if (!t) return "Pick a type.";
    if (!String(form.tipster_name || "").trim()) return "Give it a name.";
    if (String(form.tipster_name).trim().length > 80) return "The name is too long.";
    if (needs(t, "endpoint_url")) {
      var url = String(form.endpoint_url || "").trim();
      if (!/^https:\/\/[^\s]+$/i.test(url)) return "The feed URL must start with https://";
    }
    if (needs(t, "api_key") && !optional(t, "api_key") && !String(form.api_key || "").trim()) return "Add the key.";
    return "";
  }

  function createBody(t, form) {
    var body = { template: t.id, tipster_name: String(form.tipster_name || "").trim() };
    if (form.channel_id) body.channel_id = String(form.channel_id);
    if (needs(t, "endpoint_url") && form.endpoint_url) body.endpoint_url = String(form.endpoint_url).trim();
    if (form.api_key) body.api_key = String(form.api_key).trim();
    return body;
  }

  function pushUrl(apiBase, id, test) {
    var base = String(apiBase || "https://<your TipBot address>").replace(/\/+$/, "");
    return base + "/api/connectors/" + enc(id) + "/push" + (test ? "?test=1" : "");
  }

  function sampleBody() { return JSON.stringify({ tips: [SAMPLE_TIP] }); }

  function hex(buf) {
    var bytes = new Uint8Array(buf);
    var out = "";
    for (var i = 0; i < bytes.length; i++) out += (bytes[i] < 16 ? "0" : "") + bytes[i].toString(16);
    return out;
  }

  // HMAC-SHA256 of "<timestamp>.<body>" with the push secret, as the push route checks it.
  async function sign(secret, timestamp, body) {
    var subtle = root.crypto && root.crypto.subtle;
    if (!subtle || !root.TextEncoder) return "";
    var te = new root.TextEncoder();
    var key = await subtle.importKey("raw", te.encode(String(secret)), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    var mac = await subtle.sign("HMAC", key, te.encode(String(timestamp) + "." + String(body)));
    return hex(mac);
  }

  function sampleText(apiBase, id, timestamp, signature) {
    var body = sampleBody();
    return [
      "POST " + pushUrl(apiBase, id, true),
      "Content-Type: application/json",
      "X-Tip-Timestamp: " + timestamp,
      "X-Tip-Signature: sha256=" + (signature || "<hex HMAC-SHA256 of \"<timestamp>.<body>\" with the push secret>"),
      "",
      body,
      "",
      "Sign the exact bytes you send. The timestamp is Unix seconds and must be",
      "within 5 minutes. ?test=1 is a dry run: nothing is posted or saved.",
      "Drop ?test=1 to send real tips once the connector is enabled."
    ].join("\n");
  }

  function stepsHtml(at, guided) {
    var names = guided ? STEPS : STEPS.slice(0, 3);
    return '<ol class="cl-steps" aria-label="Steps">' + names.map(function (name, i) {
      var cls = i < at ? "cl-done" : (i === at ? "cl-now" : "");
      return '<li class="' + cls + '"' + (i === at ? ' aria-current="step"' : "") + ">" + esc(name) + "</li>";
    }).join("") + "</ol>";
  }

  function typeCards(list, chosen) {
    return '<div class="cl-cards" role="radiogroup" aria-label="Connector type">' + list.map(function (t) {
      var on = chosen && chosen.id === t.id;
      return '<button type="button" class="cl-card' + (on ? " cl-on" : "") + '" role="radio" aria-checked="' + (on ? "true" : "false") + '" data-cl-type="' + esc(t.id) + '">'
        + '<span class="cl-card-name">' + esc(t.name) + "</span>"
        + '<span class="cl-card-desc">' + esc(t.description || "") + "</span>"
        + (t.push ? '<span class="cl-tag">Push</span>' : "")
        + "</button>";
    }).join("") + "</div>";
  }

  function detailsHtml(t, form, channels) {
    var html = '<label class="cl-field">Name shown on posts<input data-cl-in="tipster_name" maxlength="80" autocomplete="off" value="' + esc(form.tipster_name || "") + '" placeholder="Example Tips"></label>';
    html += '<label class="cl-field">Post to channel<select data-cl-in="channel_id"><option value="">Server tips channel</option>'
      + channels.map(function (c) {
        return '<option value="' + esc(c.id) + '"' + (String(form.channel_id || "") === c.id ? " selected" : "") + ">#" + esc(c.name) + "</option>";
      }).join("") + "</select></label>";
    if (needs(t, "endpoint_url")) {
      html += '<label class="cl-field">Feed URL<input data-cl-in="endpoint_url" type="url" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" value="' + esc(form.endpoint_url || "") + '" placeholder="https://"></label>';
    }
    if (needs(t, "api_key")) {
      html += '<label class="cl-field">Read key' + (optional(t, "api_key") ? " (optional)" : "") + '<input data-cl-in="api_key" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" value=""></label>';
    }
    return html;
  }

  function secretHtml(created) {
    var html = '<div class="cl-made">Made <b>' + esc(created.tipster_name || "the connector") + "</b>. It is paused until you enable it.</div>";
    html += '<div class="cl-field">Connector ID<div class="cl-pair"><input readonly data-cl-cid value="' + esc(created.id) + '"><button type="button" class="ghost" data-cl-copy="cid">Copy</button></div></div>';
    if (created.push_secret) {
      html += '<div class="cl-field">Push secret<p class="cl-warn">You won\'t see this again. Copy it now.</p><div class="cl-pair"><input readonly data-cl-secret value=""><button type="button" class="btn" data-cl-copy="secret">Copy</button></div></div>';
    }
    return html;
  }

  function dryHtml(body) {
    if (!body) return "";
    if (body.unavailable) return '<div class="cl-note">Dry run isn\'t on this bot yet. You can still enable the connector.</div>';
    if (body.ok === false) return '<div class="cl-err">' + esc(body.message || body.error || "Dry run failed.") + "</div>";
    var tips = Array.isArray(body.tips) ? body.tips : [];
    var first = tips[0] || {};
    var lines = [(body.accepted || 0) + " of " + (body.count || tips.length) + " sample tips would post. Nothing was posted or saved."];
    if (first.reasons && first.reasons.length) lines.push("Reasons: " + first.reasons.join("; "));
    if (first.resolved && first.resolved.status) lines.push("Race match: " + first.resolved.status + " (the sample race is made up, so unmatched is expected)");
    return '<div class="cl-note">' + lines.map(esc).join("<br>") + "</div>";
  }

  function injectCss(doc) {
    if (!doc || !doc.getElementById || doc.getElementById("cl-css")) return;
    var style = doc.createElement("style");
    style.id = "cl-css";
    style.textContent = [
      "#cl-root{margin-bottom:14px}",
      "#cl-root .cl-add{min-height:44px;width:100%}",
      ".cl-modal{min-width:0}",
      ".cl-modal *{box-sizing:border-box}",
      ".cl-modal .cl-k{font-weight:700;font-size:var(--t-sub,14px);margin:0 0 8px;color:var(--txt)}",
      ".cl-modal .cl-two{display:flex;flex-direction:column;gap:10px}",
      ".cl-modal .cl-two .btn,.cl-modal .cl-two .ghost{min-height:52px;width:100%;text-align:left;padding:10px 12px}",
      ".cl-modal .cl-sub{display:block;font-weight:400;font-size:12px;color:var(--faint);margin-top:2px}",
      ".cl-modal .cl-steps{display:flex;flex-wrap:wrap;gap:6px;list-style:none;margin:0 0 12px;padding:0;font-size:12px;color:var(--faint)}",
      ".cl-modal .cl-steps li{padding:2px 8px;border-radius:999px;border:1px solid var(--line)}",
      ".cl-modal .cl-steps .cl-now{color:var(--txt);border-color:var(--accent,#5865f2);font-weight:700}",
      ".cl-modal .cl-steps .cl-done{opacity:.6}",
      ".cl-modal .cl-cards{display:flex;flex-direction:column;gap:8px}",
      ".cl-modal .cl-card{display:flex;flex-direction:column;align-items:flex-start;gap:4px;text-align:left;min-height:44px;padding:10px 12px;border-radius:12px;border:1px solid var(--line);background:var(--card2);color:var(--txt);font:inherit}",
      ".cl-modal .cl-card.cl-on{border-color:var(--accent,#5865f2);box-shadow:0 0 0 1px var(--accent,#5865f2) inset}",
      ".cl-modal .cl-card-name{font-weight:700}",
      ".cl-modal .cl-card-desc{font-size:13px;color:var(--faint);line-height:1.4}",
      ".cl-modal .cl-tag{font-size:11px;font-weight:700;padding:1px 8px;border-radius:999px;background:var(--card);border:1px solid var(--line)}",
      ".cl-modal .cl-field{display:flex;flex-direction:column;gap:6px;margin:10px 0;font-size:13px;color:var(--muted,var(--faint))}",
      ".cl-modal input,.cl-modal select{width:100%;min-height:44px;border-radius:10px;border:1px solid var(--line);background:var(--card2);color:var(--txt);padding:8px 10px;font:inherit;font-size:16px}",
      ".cl-modal .cl-pair{display:flex;gap:8px;align-items:center;min-width:0}",
      ".cl-modal .cl-pair input{flex:1;min-width:0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}",
      ".cl-modal .cl-pair .btn,.cl-modal .cl-pair .ghost{flex:none;min-height:44px}",
      ".cl-modal .cl-warn{margin:0;font-weight:700;color:var(--warn-ink,var(--loss-ink,var(--txt)))}",
      ".cl-modal .cl-pre{white-space:pre-wrap;overflow-wrap:anywhere;margin:6px 0;padding:8px;border-radius:8px;background:var(--card2);font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;max-width:100%}",
      ".cl-modal .cl-nav{display:flex;gap:8px;margin-top:14px}",
      ".cl-modal .cl-nav .btn,.cl-modal .cl-nav .ghost{flex:1;min-height:44px}",
      ".cl-modal .cl-err{color:var(--loss);font-size:13px;margin-top:8px}",
      ".cl-modal .cl-note{color:var(--faint);font-size:13px;line-height:1.45;margin-top:8px}",
      ".cl-modal .cl-made{font-size:14px;margin-bottom:6px}",
      ".cl-back{position:fixed;inset:0;z-index:80;display:flex;align-items:flex-end;justify-content:center;padding:12px;padding-bottom:calc(12px + env(safe-area-inset-bottom,0px));background:rgba(15,23,38,.45)}",
      ".cl-sheet{width:min(460px,100%);max-height:min(86vh,720px);max-height:min(86dvh,720px);overflow:auto;-webkit-overflow-scrolling:touch;background:var(--card);color:var(--txt);border:1px solid var(--line);border-radius:16px;padding:16px}",
      "@media(min-width:641px){.cl-back{align-items:center}}"
    ].join("");
    (doc.head || doc.documentElement).appendChild(style);
  }

  async function readJson(res) {
    try { return await res.json(); } catch (e) { return {}; }
  }

  function copy(text, btn, field) {
    var value = String(text || "");
    if (!value) return;
    var clip = root.navigator && root.navigator.clipboard;
    function mark(ok) { if (btn) btn.textContent = ok ? "Copied" : "Copy"; }
    function select() { try { if (field) { field.focus(); field.select(); } } catch (e) {} }
    if (clip && typeof clip.writeText === "function") {
      clip.writeText(value).then(function () { mark(true); }, function () { select(); mark(false); });
      return;
    }
    select();
    mark(false);
  }

  function mount(el, ctx) {
    if (!el) return;
    ctx = ctx || {};
    var doc = el.ownerDocument || root.document;
    if (!doc) return;
    injectCss(doc);
    el.innerHTML = '<div id="cl-root"><button type="button" class="btn cl-add" data-cl-add>Add connector</button></div>';
    var add = el.querySelector("[data-cl-add]");
    if (add) add.onclick = function () { open(); };

    function open() {
      var st = { mode: "", step: 0, list: [], channels: [], type: null, form: {}, created: null, secret: "", sample: "", dry: null, err: "", busy: false, enabled: false };
      var sheetCard = null;
      var closeSheet = null;

      function finish() {
        st.secret = "";
        var input = sheetCard && sheetCard.querySelector("[data-cl-secret]");
        if (input) input.value = "";
        if (st.created && typeof ctx.onAdded === "function") {
          var created = st.created, fired = false, wrap = doc.querySelector(".wrap"), timer = null;
          var fire = function () {
            if (fired) return;
            fired = true;
            if (timer) root.clearTimeout(timer);
            if (wrap) wrap.removeEventListener("transitionend", fire);
            ctx.onAdded(created);
          };
          // Re-render the panel only after the sheet and page have settled.
          if (wrap) wrap.addEventListener("transitionend", fire);
          timer = root.setTimeout(fire, 450);
        }
      }

      function read() {
        if (!sheetCard) return;
        var inputs = sheetCard.querySelectorAll("[data-cl-in]");
        Array.prototype.forEach.call(inputs, function (input) {
          var key = input.getAttribute("data-cl-in");
          if (key === "api_key" && st.created) return;  // sent once, never kept
          st.form[key] = input.value;
        });
      }

      function guided() { return st.mode === "guide"; }

      function body() {
        var html = '<div class="cl-modal">';
        if (!st.mode) {
          html += '<div class="cl-k">Add a connector</div>'
            + '<div class="cl-two">'
            + '<button type="button" class="btn" data-cl-mode="existing">Add existing<span class="cl-sub">Pick a connector type and fill in a short form.</span></button>'
            + '<button type="button" class="ghost" data-cl-mode="guide">Create new<span class="cl-sub">Step-by-step setup with a signed test request and a dry run.</span></button>'
            + "</div>"
            + '<p class="cl-note">Each server gets its own connector, secret, tips and log. Nothing is shared with another server.</p>';
        } else {
          html += stepsHtml(st.step, guided());
          if (st.step === 0) {
            html += '<div class="cl-k">What kind of connector?</div>';
            html += st.list.length ? typeCards(st.list, st.type) : '<div class="cl-note">Loading types…</div>';
          } else if (st.step === 1) {
            html += '<div class="cl-k">' + esc(st.type ? st.type.name : "Details") + "</div>" + detailsHtml(st.type, st.form, st.channels);
          } else if (st.step === 2) {
            html += secretHtml(st.created || {});
          } else if (st.step === 3) {
            html += '<div class="cl-k">Send a signed request</div>'
              + '<p class="cl-note">Your tip source signs each push with the push secret. Here is a ready-made test request for this connector.</p>'
              + '<pre class="cl-pre" data-cl-sample>' + esc(st.sample) + "</pre>"
              + '<button type="button" class="ghost" data-cl-copy="sample">Copy request</button>';
          } else if (st.step === 4) {
            html += '<div class="cl-k">Dry run</div><p class="cl-note">Checks the sample tip like a real push. Nothing is posted or saved.</p>'
              + '<button type="button" class="btn" data-cl-dry>Run dry run</button>' + dryHtml(st.dry);
          } else {
            html += '<div class="cl-k">Enable</div>'
              + (st.enabled ? '<p class="cl-note">Enabled. New tips from this connector will post.</p>' : '<p class="cl-note">The connector is paused. Enable it when the tip source is ready.</p>'
                + '<button type="button" class="btn" data-cl-enable>Enable connector</button>');
          }
          if (st.err) html += '<div class="cl-err" role="alert">' + esc(st.err) + "</div>";
          html += '<div class="cl-nav">';
          if (st.step === 0 || st.step === 1) html += '<button type="button" class="ghost" data-cl-back>Back</button>';
          if (st.step === 0) html += '<button type="button" class="btn" data-cl-next' + (st.type ? "" : " disabled") + ">Next</button>";
          else if (st.step === 1) html += '<button type="button" class="btn" data-cl-create' + (st.busy ? " disabled" : "") + ">" + (st.busy ? "Creating…" : "Create") + "</button>";
          else if (st.step >= 2 && st.step < STEPS.length - 1 && guided()) html += '<button type="button" class="btn" data-cl-next>Next</button>';
          else html += '<button type="button" class="btn" data-cl-done>Done</button>';
          html += "</div>";
        }
        html += "</div>";
        return html;
      }

      function paint() {
        if (!sheetCard) return;
        read();
        sheetCard.innerHTML = body();
        var secretIn = sheetCard.querySelector("[data-cl-secret]");
        if (secretIn) secretIn.value = st.secret;
        bind();
      }

      function on(sel, fn) {
        var nodes = sheetCard.querySelectorAll(sel);
        Array.prototype.forEach.call(nodes, function (n) { n.onclick = function () { fn(n); }; });
      }

      async function loadLists() {
        try {
          var p = paths(ctx.gid);
          var pair = await Promise.all([ctx.api(p.templates), ctx.api(p.channels)]);
          if (pair[0] && pair[0].status === 401) { if (ctx.onUnauth) ctx.onUnauth(); return; }
          st.list = templatesFrom(await readJson(pair[0]));
          st.channels = pair[1] && pair[1].ok ? channelsFrom(await readJson(pair[1])) : [];
          if (!st.list.length) st.err = "Couldn't load connector types.";
        } catch (e) {
          st.err = "Couldn't reach the bot.";
        }
        paint();
      }

      async function create() {
        read();
        var bad = formError(st.type, st.form);
        if (bad) { st.err = bad; paint(); return; }
        st.busy = true; st.err = ""; paint();
        try {
          var res = await ctx.api(paths(ctx.gid).create, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(createBody(st.type, st.form))
          });
          if (res && res.status === 401) { if (ctx.onUnauth) ctx.onUnauth(); return; }
          var out = await readJson(res);
          if (!res || !res.ok || out.ok === false || !out.id) {
            st.err = (out && (out.message || out.error)) || "Couldn't create the connector.";
            return;
          }
          st.secret = String(out.push_secret || "");
          out.push_secret = st.secret ? "shown" : "";
          st.created = out;
          st.form.api_key = "";
          st.step = 2;
          if (st.secret) {
            var ts = Math.floor(Date.now() / 1000);
            var sig = "";
            try { sig = await sign(st.secret, ts, sampleBody()); } catch (e) { sig = ""; }
            st.sample = sampleText(ctx.apiBase, out.id, ts, sig);
          } else {
            st.sample = sampleText(ctx.apiBase, out.id, "<unix seconds>", "");
          }
        } catch (e) {
          st.err = "Couldn't reach the bot.";
        } finally {
          st.busy = false;
          paint();
        }
      }

      async function dryRun() {
        if (!st.created) return;
        try {
          var res = await ctx.api(paths(ctx.gid, st.created.id).dryRun, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ payload: { tips: [SAMPLE_TIP] } })
          });
          if (res && (res.status === 404 || res.status === 405)) st.dry = { unavailable: true };
          else st.dry = await readJson(res);
        } catch (e) {
          st.dry = { ok: false, message: "Couldn't reach the bot." };
        }
        paint();
      }

      async function enable() {
        if (!st.created) return;
        try {
          var res = await ctx.api(paths(ctx.gid, st.created.id).toggle, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ guild_id: String(ctx.gid), enabled: true })
          });
          var out = await readJson(res);
          if (!res || !res.ok || out.ok === false) { st.err = (out && (out.message || out.error)) || "Couldn't enable it."; }
          else { st.enabled = true; st.err = ""; }
        } catch (e) {
          st.err = "Couldn't reach the bot.";
        }
        paint();
      }

      function bind() {
        on("[data-cl-mode]", function (n) { st.mode = n.getAttribute("data-cl-mode"); st.step = 0; paint(); if (!st.list.length) loadLists(); });
        on("[data-cl-type]", function (n) {
          var id = n.getAttribute("data-cl-type");
          st.list.forEach(function (t) { if (t.id === id) st.type = t; });
          paint();
        });
        on("[data-cl-back]", function () { st.err = ""; if (st.step === 0) { st.mode = ""; } else { st.step -= 1; } paint(); });
        on("[data-cl-next]", function () {
          st.err = "";
          if (st.step === 0 && !st.type) return;
          st.step += 1;
          // A template with no push secret has no signed request or dry run to show.
          if (st.step === 3 && st.created && !st.created.has_push_secret) st.step = STEPS.length - 1;
          paint();
        });
        on("[data-cl-create]", function () { create(); });
        on("[data-cl-dry]", function () { dryRun(); });
        on("[data-cl-enable]", function () { enable(); });
        on("[data-cl-done]", function () { if (closeSheet) closeSheet(); });
        on("[data-cl-copy]", function (n) {
          var what = n.getAttribute("data-cl-copy");
          if (what === "secret") copy(st.secret, n, sheetCard.querySelector("[data-cl-secret]"));
          else if (what === "cid") copy(st.created && st.created.id, n, sheetCard.querySelector("[data-cl-cid]"));
          else copy(st.sample, n, null);
        });
      }

      var sheet = root.TBSheet;
      if (sheet && typeof sheet.open === "function") {
        var sh = sheet.open({ label: "Add connector", html: '<div data-cl-host></div>', onClose: finish });
        sheetCard = sh.card.querySelector("[data-cl-host]") || sh.card;
        closeSheet = function () { sh.close({ via: "done" }); };
      } else {
        var back = doc.createElement("div");
        back.className = "cl-back";
        back.innerHTML = '<div class="cl-sheet" role="dialog" aria-modal="true" aria-label="Add connector"></div>';
        doc.body.appendChild(back);
        sheetCard = back.firstChild;
        var onKey = function (e) { if (e.key === "Escape" && closeSheet) closeSheet(); };
        closeSheet = function () {
          finish();
          if (back.parentNode) back.parentNode.removeChild(back);
          doc.removeEventListener("keydown", onKey, true);
        };
        doc.addEventListener("keydown", onKey, true);
        back.addEventListener("click", function (e) { if (e.target === back && closeSheet) closeSheet(); });
      }
      paint();
    }
  }

  var API = {
    STEPS: STEPS,
    SAMPLE_TIP: SAMPLE_TIP,
    paths: paths,
    templatesFrom: templatesFrom,
    channelsFrom: channelsFrom,
    formError: formError,
    createBody: createBody,
    pushUrl: pushUrl,
    sampleBody: sampleBody,
    sampleText: sampleText,
    sign: sign,
    typeCards: typeCards,
    detailsHtml: detailsHtml,
    secretHtml: secretHtml,
    dryHtml: dryHtml,
    mount: mount
  };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  root.TBConnectorLibrary = API;
  if (root.TD && root.TD.loaded) root.TD.loaded["connector-library"] = true;
})(typeof window !== "undefined" ? window : globalThis);
