/* Sport routing in tipdash (Phase 1.1): post-time popups + the Settings → Channels section.
 *
 * Post time: before a tip (or batch) is scheduled, TBRouting.beforePost() asks TipBot
 * where each tip would go (POST /api/routing/preview):
 *   single   → no popup, just a chip ("→ #afl-plays") on the confirm step
 *   conflict → popup listing each candidate channel and why it matched, checkboxes,
 *              "Remember this choice" (admins)
 *   none     → "No sport channel matched. Post to #tips (default) / pick a channel / cancel"
 *   >1 channel in the end (incl. a "post to all" rule) → confirm popup listing the channels
 * With routing off, or an older TipBot without the endpoint, nothing changes (no route sent).
 *
 * Reuses the existing tipdash styles (NDCountdownConfirm sheet classes, panels, buttons).
 * Browser global window.TBRouting + CommonJS export (pure helpers) for node --test.
 */
(function (root) {
  "use strict";
  var K = root.TBSportKeywords || (typeof require === "function" ? require("./sport-keywords.js") : null);
  var UNAVAILABLE = "This needs TipBot’s latest deploy.";

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c];
    });
  }

  // ── pure helpers ──────────────────────────────────────────────────────────
  function fromPreview(status, body) {
    if ([404, 405, 501].indexOf(status) !== -1) return {state: "unavailable", results: []};
    if (!body || status >= 400 || body.ok === false) return {state: "error", results: [], error: (body && (body.error || body.message)) || ("HTTP " + status)};
    if (!body.enabled) return {state: "off", results: []};
    return {state: "ok", results: body.results || [], canAdmin: !!body.can_admin, allChannels: body.all_channels || []};
  }
  function decide(result) {
    if (!result) return {kind: "single", channelIds: []};
    if (result.needs_choice) return {kind: "conflict", channelIds: (result.auto_channel_ids || []).slice(), candidates: result.candidates || []};
    if (result.status === "none") return {kind: "none", channelIds: (result.channel_ids || []).slice()};
    var ids = (result.channel_ids || []).slice();
    return {kind: ids.length > 1 ? "confirm" : "single", channelIds: ids};
  }
  function nameMap(result, allChannels) {
    var m = {};
    (allChannels || []).forEach(function (c) { m[String(c.id)] = c.name; });
    (result && result.candidates || []).forEach(function (c) { m[String(c.channel_id)] = c.name || m[c.channel_id]; });
    (result && result.channels || []).forEach(function (c) { m[String(c.id)] = c.name || m[c.id]; });
    if (result && result.default_channel_id) m[String(result.default_channel_id)] = result.default_channel_name || m[result.default_channel_id];
    return m;
  }
  function chip(ids, names) {
    if (!ids || !ids.length) return "";
    return "→ " + ids.map(function (id) { return "#" + ((names && names[id]) || id); }).join(", ");
  }
  function route(result, channelIds, opts) {
    opts = opts || {};
    return {channel_ids: (channelIds || []).map(String), tags: (result && result.tags) || [],
            remember: !!opts.remember, source: opts.source || "single"};
  }
  function previewTip(t) {
    t = t || {};
    return {sport: t.sport || "", league: t.league || "", game_name: t.game_name || "",
            legs: (t.legs || []).map(function (l) {
              return {desc: l.desc, player: l.player, stat: l.stat, market: l.market, custom: l.custom,
                      game_id: l.game_id, league: l.league, espn_event_id: l.espn_event_id};
            })};
  }

  // ── sheet (reuses the NDCountdownConfirm styles) ─────────────────────────
  function ensureStyles() {
    try { if (root.NDCountdownConfirm && root.NDCountdownConfirm.injectStyles) root.NDCountdownConfirm.injectStyles(); } catch (e) {}
  }
  function row(inner) {
    return '<label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;padding:8px 10px;border:1px solid var(--line);border-radius:10px;background:var(--card2);margin:6px 0">' + inner + "</label>";
  }
  function sheet(opts) {
    ensureStyles();
    return new Promise(function (resolve) {
      var backdrop = document.createElement("div");
      backdrop.className = "ndcc-backdrop";
      backdrop.innerHTML = '<div class="ndcc-sheet" role="dialog" aria-modal="true" style="max-height:85vh;overflow:auto"><h3></h3>'
        + '<div class="ndcc-msg"></div><div class="tbr-body"></div><div class="ndcc-acts" style="flex-wrap:wrap"></div></div>';
      backdrop.querySelector("h3").textContent = opts.title || "";
      backdrop.querySelector(".ndcc-msg").innerHTML = opts.message || "";
      backdrop.querySelector(".tbr-body").innerHTML = opts.body || "";
      var acts = backdrop.querySelector(".ndcc-acts");
      var done = false;
      function finish(value) {
        if (done) return;
        done = true;
        backdrop.classList.remove("ndcc-in");
        document.removeEventListener("keydown", onKey);
        setTimeout(function () { backdrop.remove(); }, 200);
        resolve(value);
      }
      function onKey(e) { if (e.key === "Escape") finish(null); }
      (opts.buttons || []).forEach(function (b) {
        var el = document.createElement("button");
        el.type = "button";
        el.className = "ndcc-b " + (b.primary ? "primary" : "ghost");
        if (b.primary) el.style.background = "#5b8cff";
        el.textContent = b.label;
        el.addEventListener("click", function () {
          var v = typeof b.value === "function" ? b.value(backdrop) : b.value;
          if (v === undefined) return; // validation kept the sheet open
          finish(v);
        });
        acts.appendChild(el);
      });
      backdrop.addEventListener("click", function (e) { if (e.target === backdrop) finish(null); });
      document.addEventListener("keydown", onKey);
      document.body.appendChild(backdrop);
      requestAnimationFrame(function () { backdrop.classList.add("ndcc-in"); });
      if (opts.onMount) opts.onMount(backdrop);
    });
  }
  function checked(backdrop) {
    return Array.prototype.slice.call(backdrop.querySelectorAll("input.tbr-ch:checked")).map(function (x) { return x.value; });
  }

  function conflictSheet(result, prefix, canAdmin, names) {
    var d = decide(result);
    var cands = (result.candidates || []).slice();
    if (result.default_channel_id && !cands.some(function (c) { return c.channel_id === result.default_channel_id; })) {
      cands.push({channel_id: result.default_channel_id, reasons: ["default channel"], tags: []});
    }
    var body = cands.map(function (c) {
      var on = d.channelIds.indexOf(c.channel_id) !== -1;
      return row('<input type="checkbox" class="tbr-ch" value="' + esc(c.channel_id) + '"' + (on ? " checked" : "") + ' style="width:16px;height:16px;margin-top:2px">'
        + '<span style="flex:1"><span style="font-weight:600;font-size:13px">#' + esc(names[c.channel_id] || c.channel_id) + "</span>"
        + '<span style="display:block;color:var(--faint);font-size:11px;margin-top:2px">' + esc((c.reasons || []).join(" · ")) + "</span></span>");
    }).join("");
    if (canAdmin && result.tags && result.tags.length) {
      body += '<label style="display:flex;gap:8px;align-items:center;font-size:13px;margin:10px 0 0"><input type="checkbox" id="tbr-remember"> Remember this choice for ' + esc(result.tags.join(" + ")) + " tips</label>";
    }
    body += '<div class="err" id="tbr-err" style="margin-top:8px;font-size:12px"></div>';
    return sheet({
      title: prefix + "Which channel?",
      message: "The routing rules matched more than one channel (" + esc((result.tags || []).join(", ")) + "). Pick where this tip posts.",
      body: body,
      buttons: [{label: "Cancel", value: null}, {label: "Use these channels", primary: true, value: function (b) {
        var ids = checked(b);
        if (!ids.length) { b.querySelector("#tbr-err").textContent = "Pick at least one channel."; return undefined; }
        var rem = b.querySelector("#tbr-remember");
        return {ids: ids, remember: !!(rem && rem.checked)};
      }}]
    });
  }

  function noneSheet(result, prefix, names, allChannels) {
    var def = result.default_channel_id;
    var opts = (allChannels || []).map(function (c) {
      return '<option value="' + esc(c.id) + '">#' + esc(c.name) + (c.category ? " (" + esc(c.category) + ")" : "") + "</option>";
    }).join("");
    var body = '<div class="field" style="margin-top:8px"><label for="tbr-pick">Or pick a channel</label>'
      + '<select id="tbr-pick" style="width:100%;background:var(--card2);color:var(--txt);border:1px solid var(--line);border-radius:9px;padding:8px 10px;font:inherit"><option value="">—</option>' + opts + "</select></div>"
      + '<div class="err" id="tbr-err" style="margin-top:8px;font-size:12px"></div>';
    var buttons = [{label: "Cancel", value: null}];
    buttons.push({label: "Post to picked channel", value: function (b) {
      var v = b.querySelector("#tbr-pick").value;
      if (!v) { b.querySelector("#tbr-err").textContent = "Pick a channel first."; return undefined; }
      return {ids: [v], source: "popup"};
    }});
    if (def) buttons.push({label: "Post to #" + (names[def] || "tips") + " (default)", primary: true, value: {ids: [def], source: "none"}});
    return sheet({title: prefix + "No sport channel matched", message: "None of this server’s sport rules matched this tip.", body: body, buttons: buttons});
  }

  function confirmSheet(ids, names, prefix) {
    var body = ids.map(function (id) { return row('<span style="font-weight:600;font-size:13px">#' + esc(names[id] || id) + "</span>"); }).join("");
    return sheet({title: prefix + "Post to " + ids.length + " channels?", message: "This tip will be posted once in each channel below. Edits, grades and deletes update every copy.",
                  body: body, buttons: [{label: "Cancel", value: null}, {label: "Post to " + ids.length + " channels", primary: true, value: true}]});
  }

  /** → {routes: [route|null…] | null, chips: [..], note, cancelled} */
  async function beforePost(ctx) {
    var tips = ctx.tips || [];
    var r, body = null;
    try {
      r = await ctx.api("/api/routing/preview", {method: "POST", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({guild_id: String(ctx.guildId), tips: tips.map(previewTip)}), retries: 2, idempotent: true, timeoutMs: 15000});
      try { body = await r.json(); } catch (e) { body = null; }
    } catch (e) {
      if (e && e.unauth) throw e;
      return {routes: null, chips: [], note: "Couldn’t check sport routing — TipBot will pick the channel."};
    }
    var p = fromPreview(r.status, body);
    if (p.state === "unavailable" || p.state === "off") return {routes: null, chips: []};
    if (p.state === "error") return {routes: null, chips: [], note: "Couldn’t check sport routing (" + p.error + ") — TipBot will pick the channel."};
    var ui = ctx.ui || {conflict: conflictSheet, none: noneSheet, confirm: confirmSheet};
    var routes = [], chips = [], n = p.results.length;
    for (var i = 0; i < n; i++) {
      var res = p.results[i], names = nameMap(res, p.allChannels), d = decide(res);
      var prefix = n > 1 ? "Tip " + (i + 1) + " of " + n + ": " : "";
      var ids = d.channelIds, source = d.kind === "single" ? "single" : "confirm", remember = false;
      if (d.kind === "conflict") {
        var c = await ui.conflict(res, prefix, p.canAdmin, names);
        if (!c) return {cancelled: true};
        ids = c.ids; remember = c.remember; source = "popup";
      } else if (d.kind === "none") {
        var nn = await ui.none(res, prefix, names, p.allChannels);
        if (!nn) return {cancelled: true};
        ids = nn.ids; source = nn.source;
      }
      if (ids.length > 1) {
        var ok = await ui.confirm(ids, names, prefix);
        if (!ok) return {cancelled: true};
      }
      routes.push(ids.length ? route(res, ids, {remember: remember, source: source}) : null);
      chips.push(chip(ids, names));
    }
    return {routes: routes, chips: chips};
  }

  // ── Settings → Channels: sport routing section ──────────────────────────
  function mountSettings(box, ctx) {
    var S = {data: null, busy: false, msg: "", err: false, unavailable: false, forget: [], deleted: [], test: ""};
    function sel(style) { return 'style="background:var(--card2);color:var(--txt);border:1px solid var(--line);border-radius:9px;padding:8px 10px;font:inherit' + (style || "") + '"'; }
    async function load() {
      S.unavailable = false;
      box.innerHTML = '<div class="empty">Loading sport routing…</div>';
      try {
        var r = await ctx.api("/api/routing?guild_id=" + encodeURIComponent(ctx.gid));
        if ([404, 405, 501].indexOf(r.status) !== -1) { S.unavailable = true; return paint(); }
        var j = await r.json();
        if (!r.ok || !j.ok) { box.innerHTML = '<div class="empty">' + esc(j && (j.error || j.message) || "Couldn’t load sport routing.") + "</div>"; return; }
        S.data = j; S.forget = []; S.deleted = [];
        paint();
      } catch (e) {
        if (e && e.unauth) return ctx.onUnauth && ctx.onUnauth();
        box.innerHTML = '<div class="empty">Couldn’t reach the bot.</div>';
      }
    }
    function chanChecks(tag, all, selected, disabled) {
      return '<details style="min-width:180px"><summary style="cursor:pointer;font-size:13px">' + (selected.length ? selected.map(function (id) { var c = all.find(function (x) { return x.id === id; }); return "#" + esc(c ? c.name : id); }).join(", ") : '<span style="color:var(--faint)">No channel</span>') + "</summary>"
        + '<div style="max-height:180px;overflow:auto;padding:6px 0">' + all.map(function (c) {
          return '<label style="display:flex;gap:6px;align-items:center;font-size:12.5px;padding:2px 0"><input type="checkbox" class="sr-ch" data-tag="' + esc(tag) + '" value="' + esc(c.id) + '"' + (selected.indexOf(c.id) !== -1 ? " checked" : "") + (disabled ? " disabled" : "") + "> #" + esc(c.name) + "</label>";
        }).join("") + "</div></details>";
    }
    function paint() {
      if (S.unavailable) {
        box.innerHTML = '<div class="panel" style="margin-top:18px"><h3>Sport routing (beta)</h3><div class="empty">' + UNAVAILABLE + '</div><button class="ghost" id="sr-retry" type="button">Retry</button></div>';
        box.querySelector("#sr-retry").onclick = load;
        return;
      }
      var d = S.data, ro = !d.can_admin || S.busy, all = d.channels || [];
      var html = '<div class="panel" style="margin-top:18px"><h3>Sport routing (beta)</h3>'
        + '<label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:8px 10px;border:1px solid var(--line);border-radius:10px;background:var(--card2)">'
        + '<input type="checkbox" id="sr-enabled"' + (d.enabled ? " checked" : "") + (ro ? " disabled" : "") + ' style="width:16px;height:16px">'
        + '<span style="flex:1"><span style="font-weight:600;font-size:13px">Enable sport routing (beta)</span><span style="display:block;color:var(--faint);font-size:11px;margin-top:2px">feat.sport_routing · off = every tip goes to the Tips channel above</span></span></label>';
      if (!d.can_admin) html += '<div style="color:var(--faint);font-size:12px;margin:8px 0">Only a server admin can change sport routing.</div>';
      if (d.enabled) {
        var def = all.find(function (c) { return c.id === d.default_channel_id; });
        html += '<div style="color:var(--faint);font-size:12px;margin:12px 0">Default channel: <b>' + (def ? "#" + esc(def.name) : "the Tips output") + "</b> (the Tips picker above). Tips that match no rule go there, flagged.</div>"
          + '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="text-align:left;color:var(--faint);font-size:11px;text-transform:uppercase;letter-spacing:.05em">'
          + "<th>On</th><th>Tag</th><th>Channels</th><th>Keywords</th><th>Priority</th><th>If several channels</th><th></th></tr></thead><tbody>";
        d.tags.forEach(function (t) {
          if (S.deleted.indexOf(t.tag) !== -1) return;
          html += '<tr data-tag="' + esc(t.tag) + '" style="border-top:1px solid var(--line);vertical-align:top">'
            + '<td style="padding:8px 6px"><input type="checkbox" class="sr-on"' + (t.enabled ? " checked" : "") + (ro ? " disabled" : "") + "></td>"
            + '<td style="padding:8px 6px"><b>' + esc(t.label) + '</b><div style="color:var(--faint);font-size:11px">' + esc(t.tag) + (t.custom ? " · custom" : "") + "</div></td>"
            + '<td style="padding:8px 6px">' + chanChecks(t.tag, all, t.channel_ids, ro) + "</td>"
            + '<td style="padding:8px 6px;min-width:200px"><input class="sr-kw" ' + sel(";width:100%") + ' value="' + esc(t.keywords) + '" placeholder="' + esc(t.default_keywords || "comma, separated") + '"' + (ro ? " disabled" : "") + '><div class="sr-kw-err err" style="font-size:11px"></div></td>'
            + '<td style="padding:8px 6px"><input class="sr-prio" type="number" step="1" ' + sel(";width:80px") + ' value="' + esc(t.priority) + '"' + (ro ? " disabled" : "") + "></td>"
            + '<td style="padding:8px 6px"><select class="sr-mode" ' + sel() + (ro ? " disabled" : "") + '><option value="ask"' + (t.mode !== "post_all" ? " selected" : "") + '>Ask</option><option value="post_all"' + (t.mode === "post_all" ? " selected" : "") + ">Post to all</option></select></td>"
            + '<td style="padding:8px 6px">' + (t.custom && !ro ? '<button type="button" class="ghost sr-del">Delete</button>' : "") + "</td></tr>";
        });
        html += "</tbody></table></div>";
        if (!ro) {
          html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0"><input id="sr-newtag" ' + sel(";width:140px") + ' placeholder="TAG (e.g. DARTS)"><input id="sr-newlabel" ' + sel(";width:160px") + ' placeholder="Label"><button type="button" class="ghost" id="sr-add">Add custom tag</button></div>';
        }
        html += '<div class="field" style="margin-top:12px"><label for="sr-multi">Bets across several sports</label><select id="sr-multi" ' + sel() + (ro ? " disabled" : "") + '><option value="ask"' + (d.multi_sport_mode !== "post_all" ? " selected" : "") + '>Ask which channel</option><option value="post_all"' + (d.multi_sport_mode === "post_all" ? " selected" : "") + ">Post to every matching channel</option></select></div>"
          + '<div style="color:var(--faint);font-size:12px;margin:6px 0 12px">When nobody can answer a popup (imports, Paste sheet, slips, slash commands): remembered choice → highest-priority tag’s channel → default channel, flagged.</div>';
        var mem = (d.memory || []).filter(function (m) { return S.forget.indexOf(m.signature) === -1; });
        html += "<h4 style=\"margin:14px 0 6px\">Remembered choices</h4>" + (mem.length ? mem.map(function (m) {
          return '<div style="display:flex;gap:10px;align-items:center;margin:4px 0;font-size:13px"><b>' + esc(m.signature.replace(/\+/g, " + ")) + "</b> " + esc(chip(m.channel_ids, all.reduce(function (o, c) { o[c.id] = c.name; return o; }, {}))) + (ro ? "" : ' <button type="button" class="ghost sr-forget" data-sig="' + esc(m.signature) + '">Delete</button>') + "</div>";
        }).join("") : '<div style="color:var(--faint);font-size:12px">None yet. Tick “Remember this choice” in a routing popup.</div>')
          + '<h4 style="margin:14px 0 6px">Test</h4><div style="display:flex;gap:8px;flex-wrap:wrap"><input id="sr-test" ' + sel(";flex:1;min-width:220px") + ' placeholder="e.g. NFL: Chiefs v Bills" value="' + esc(S.test) + '"><button type="button" class="ghost" id="sr-test-go">Where would this go?</button></div><div id="sr-test-out" style="font-size:13px;margin:8px 0"></div>';
      }
      html += (d.can_admin && d.enabled ? '<div style="margin-top:14px"><button class="btn sm" id="sr-save"' + (S.busy ? " disabled" : "") + ">Save sport routing</button>" : "<div>")
        + ' <span id="sr-msg" style="font-size:12px;margin-left:8px;color:' + (S.err ? "var(--loss)" : "var(--win)") + '">' + esc(S.msg) + "</span></div></div>";
      box.innerHTML = html;
      wire();
    }
    function collect() {
      var tags = [], err = null;
      box.querySelectorAll("tr[data-tag]").forEach(function (tr) {
        var tag = tr.getAttribute("data-tag"), t = S.data.tags.find(function (x) { return x.tag === tag; }) || {};
        var kw = tr.querySelector(".sr-kw").value;
        var v = K ? K.validateTerms(kw) : {error: null};
        tr.querySelector(".sr-kw-err").textContent = v.error || "";
        if (v.error && !err) err = tag + ": " + v.error;
        tags.push({tag: tag, label: t.label, enabled: tr.querySelector(".sr-on").checked,
                   channel_ids: Array.prototype.slice.call(tr.querySelectorAll(".sr-ch:checked")).map(function (x) { return x.value; }),
                   keywords: kw.trim() ? kw : (t.custom ? "" : null), priority: tr.querySelector(".sr-prio").value,
                   mode: tr.querySelector(".sr-mode").value});
      });
      return {tags: tags, error: err};
    }
    function wire() {
      var en = box.querySelector("#sr-enabled");
      if (en) en.onchange = async function () {
        S.busy = true; S.msg = "Saving…"; S.err = false; paint();
        try {
          var r = await ctx.api("/api/feature-flags", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({guild_id: ctx.gid, flags: {"feat.sport_routing": en.checked}})});
          var j = await r.json();
          S.busy = false;
          if (!j.ok) { S.msg = j.message || "Couldn’t save"; S.err = true; return paint(); }
          S.msg = en.checked ? "Sport routing is on" : "Sport routing is off"; await load();
        } catch (e) { S.busy = false; if (e && e.unauth) return ctx.onUnauth && ctx.onUnauth(); S.msg = "Couldn’t reach the bot"; S.err = true; paint(); }
      };
      box.querySelectorAll(".sr-kw").forEach(function (inp) {
        inp.oninput = function () { var v = K ? K.validateTerms(inp.value) : {error: null}; inp.parentNode.querySelector(".sr-kw-err").textContent = v.error || ""; };
      });
      box.querySelectorAll(".sr-del").forEach(function (b) {
        b.onclick = function () { S.deleted.push(b.closest("tr").getAttribute("data-tag")); paint(); };
      });
      box.querySelectorAll(".sr-forget").forEach(function (b) {
        b.onclick = function () { S.forget.push(b.getAttribute("data-sig")); paint(); };
      });
      var add = box.querySelector("#sr-add");
      if (add) add.onclick = function () {
        var tag = String(box.querySelector("#sr-newtag").value || "").trim().toUpperCase().replace(/[^A-Z0-9_]/g, "");
        var label = String(box.querySelector("#sr-newlabel").value || "").trim();
        if (tag.length < 2 || S.data.tags.some(function (t) { return t.tag === tag; })) { S.msg = "Pick a new tag name (A–Z, 0–9, 2+ characters)."; S.err = true; return paint(); }
        S.data.tags.push({tag: tag, label: label || tag, enabled: true, channel_ids: [], keywords: label ? label.toLowerCase() : tag.toLowerCase(), default_keywords: "", priority: 10, mode: "ask", custom: true});
        S.msg = ""; paint();
      };
      var go = box.querySelector("#sr-test-go");
      if (go) go.onclick = async function () {
        var out = box.querySelector("#sr-test-out");
        S.test = box.querySelector("#sr-test").value;
        out.textContent = "Checking…";
        try {
          var r = await ctx.api("/api/routing/preview", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({guild_id: ctx.gid, text: S.test, sport: "Custom"})});
          var p = fromPreview(r.status, await r.json().catch(function () { return null; }));
          if (p.state !== "ok") { out.textContent = p.state === "unavailable" ? UNAVAILABLE : p.state === "off" ? "Sport routing is off." : "Couldn’t check (" + p.error + ")."; return; }
          var res = p.results[0], names = nameMap(res, p.allChannels), dd = decide(res);
          out.innerHTML = "<b>" + esc(dd.kind === "conflict" ? "Ask (several channels match)" : dd.kind === "none" ? "No rule matched → default channel" : chip(dd.channelIds, names)) + "</b>"
            + (res.tags && res.tags.length ? ' <span style="color:var(--faint)">· tags ' + esc(res.tags.join(", ")) + " · " + esc(Object.keys(res.reasons || {}).map(function (k) { return res.reasons[k].join(", "); }).join("; ")) + "</span>" : "");
        } catch (e) { if (e && e.unauth) return ctx.onUnauth && ctx.onUnauth(); out.textContent = "Couldn’t reach the bot."; }
      };
      var save = box.querySelector("#sr-save");
      if (save) save.onclick = async function () {
        var c = collect();
        if (c.error) { S.msg = c.error; S.err = true; box.querySelector("#sr-msg").textContent = c.error; box.querySelector("#sr-msg").style.color = "var(--loss)"; return; }
        var body = {guild_id: ctx.gid, tags: c.tags, multi_sport_mode: box.querySelector("#sr-multi").value,
                    delete_tags: S.deleted.slice(), forget: S.forget.slice()};
        S.busy = true; S.msg = "Saving…"; S.err = false; paint();
        try {
          var r = await ctx.api("/api/routing", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(body)});
          if ([404, 405, 501].indexOf(r.status) !== -1) { S.busy = false; S.unavailable = true; return paint(); }
          var j = await r.json();
          S.busy = false;
          if (!r.ok || !j.ok) { S.msg = (j && (j.error || j.message)) || "Couldn’t save"; S.err = true; return paint(); }
          S.data = j; S.forget = []; S.deleted = []; S.msg = "✓ saved"; S.err = false; paint();
          if (root.NDConfirmPop) root.NDConfirmPop.show({label: "Sport routing saved", color: "#2eaf62"});
        } catch (e) { S.busy = false; if (e && e.unauth) return ctx.onUnauth && ctx.onUnauth(); S.msg = "Couldn’t reach the bot"; S.err = true; paint(); }
      };
    }
    load();
    return {reload: load};
  }

  var API = {fromPreview: fromPreview, decide: decide, route: route, chip: chip, nameMap: nameMap, previewTip: previewTip,
             beforePost: beforePost, mountSettings: mountSettings, UNAVAILABLE: UNAVAILABLE};
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  root.TBRouting = API;
})(typeof window !== "undefined" ? window : globalThis);
