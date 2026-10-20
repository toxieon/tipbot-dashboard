/* Tip channel tiers on a server's Settings → Channels tab.
   Loads GET /api/channels?guild_id= and saves POST /api/channels
   with {guild_id, daily_free_limit, tip_channel_tiers}.
   Rows are the configured tips channel plus the other channels tips
   are routed to. Any other text channel can be added from the list.
   Blank daily limit turns tiers off. */
(function (root) {
  "use strict";

  var SKIP_KEYS = {
    recap: 1, recaps: 1, datastore: 1, datastorage: 1,
    ledger: 1, log: 1, logs: 1, alert: 1, alerts: 1,
    welcome: 1, modlog: 1, modlogs: 1
  };

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c];
    });
  }

  function enc(v) { return encodeURIComponent(v == null ? "" : String(v)); }

  function channelsPath(gid) { return "/api/channels?guild_id=" + enc(gid); }

  function normKey(v) {
    return String(v || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
  }

  function skipKey(key) { return !!SKIP_KEYS[normKey(key)]; }

  function isTipsKey(key, label) {
    var k = normKey(key);
    var l = normKey(label);
    return k === "tips" || k === "tip" || k === "tipschannel" || l === "tips" || l === "tipschannel";
  }

  function isTextChannel(c) {
    if (!c || c.id == null || String(c.id).trim() === "") return false;
    if (c.type == null || c.type === "") return true;
    var t = String(c.type).trim().toLowerCase();
    return t === "0" || t === "5" || t === "15" || t === "text" || t === "guild_text" || t === "news" || t === "announcement" || t === "guild_announcement" || t === "forum" || t === "guild_forum";
  }

  function channelName(c) {
    return String((c && c.name) || "").replace(/^#/, "");
  }

  function outputChannelId(o) {
    if (!o || typeof o !== "object") return "";
    var id = o.channel_id != null ? o.channel_id : o.channelId;
    if (id && typeof id === "object") id = id.id;
    return id == null ? "" : String(id).trim();
  }

  function limitOf(raw) {
    if (raw == null || raw === "") return null;
    var n = parseInt(raw, 10);
    if (!isFinite(n) || n < 0) return null;
    return n;
  }

  function tiersOf(raw) {
    var map = {};
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return map;
    Object.keys(raw).forEach(function (id) {
      var key = String(id).trim();
      var t = String(raw[id] || "").trim().toLowerCase();
      if (key && (t === "free" || t === "premium")) map[key] = t;
    });
    return map;
  }

  function textList(channels) {
    var out = [];
    var seen = {};
    (Array.isArray(channels) ? channels : []).forEach(function (c) {
      if (!isTextChannel(c)) return;
      var id = String(c.id).trim();
      if (seen[id]) return;
      seen[id] = true;
      out.push({id: id, name: channelName(c)});
    });
    return out;
  }

  function byId(list) {
    var m = {};
    (list || []).forEach(function (c) { m[String(c.id)] = c; });
    return m;
  }

  /* Tips channel first, then other routed channels, then channels that already have a tier. */
  function listedChannels(body, names) {
    body = body || {};
    var outputs = Array.isArray(body.outputs) ? body.outputs : [];
    var mapping = body.mapping && typeof body.mapping === "object" && !Array.isArray(body.mapping) ? body.mapping : null;
    var listed = [];
    var seen = {};
    function add(id, fallback) {
      id = String(id || "").trim();
      if (!id || seen[id]) return;
      seen[id] = true;
      var known = names[id];
      listed.push({id: id, name: (known && known.name) || fallback || ""});
    }
    ["tips_channel_id", "tip_channel_id", "tips_channel"].forEach(function (k) {
      if (body[k] != null && typeof body[k] !== "object") add(body[k], "");
    });
    outputs.forEach(function (o) {
      if (!o || !isTipsKey(o.key, o.label)) return;
      add(outputChannelId(o), channelName(o));
    });
    if (mapping) {
      Object.keys(mapping).forEach(function (key) {
        if (!isTipsKey(key, "")) return;
        var id = mapping[key];
        if (id && typeof id === "object") id = id.id;
        add(id, "");
      });
    }
    outputs.forEach(function (o) {
      if (!o || skipKey(o.key) || skipKey(o.label) || isTipsKey(o.key, o.label)) return;
      add(outputChannelId(o), channelName(o));
    });
    if (mapping) {
      Object.keys(mapping).forEach(function (key) {
        if (skipKey(key) || isTipsKey(key, "")) return;
        var id = mapping[key];
        if (id && typeof id === "object") id = id.id;
        add(id, "");
      });
    }
    var tiers = tiersOf(body.tip_channel_tiers);
    Object.keys(tiers).forEach(function (id) { add(id, ""); });
    return listed;
  }

  function tierState(body) {
    body = body || {};
    var all = textList(body.channels);
    var names = byId(all);
    (Array.isArray(body.channels) ? body.channels : []).forEach(function (c) {
      if (!c || c.id == null) return;
      var id = String(c.id).trim();
      if (id && !names[id]) names[id] = {id: id, name: channelName(c)};
    });
    return {
      daily_free_limit: limitOf(body.daily_free_limit),
      tip_channel_tiers: tiersOf(body.tip_channel_tiers),
      listed: listedChannels(body, names),
      all: all
    };
  }

  function tierBody(gid, st) {
    st = st || {};
    return {
      guild_id: String(gid),
      daily_free_limit: st.daily_free_limit == null ? null : st.daily_free_limit,
      tip_channel_tiers: st.tip_channel_tiers || {}
    };
  }

  function labelOf(c) {
    return c && c.name ? ("#" + c.name) : String(c && c.id || "");
  }

  function tierHtml(st) {
    st = st || {listed: [], all: [], tip_channel_tiers: {}, daily_free_limit: null};
    var tiers = st.tip_channel_tiers || {};
    var listed = st.listed || [];
    var listedIds = {};
    listed.forEach(function (c) { listedIds[c.id] = true; });
    var extras = (st.all || []).filter(function (c) { return !listedIds[c.id]; });
    var html = '<section class="panel" data-tt-card style="margin-top:18px">';
    html += "<h3>Tip channel tiers</h3>";
    html += '<label class="tt-limit" for="tt-limit">Daily free tip limit';
    html += '<input id="tt-limit" data-tt-limit type="number" min="0" step="1" inputmode="numeric" value="' + esc(st.daily_free_limit == null ? "" : String(st.daily_free_limit)) + '" placeholder="Off">';
    html += "</label>";
    html += '<p class="tt-hint">Premium channels get every tip. Free channels get the first N tips each day, Sydney time. Leave blank to turn tiers off.</p>';
    if (!listed.length) html += '<p class="tt-hint">No tip channels are set yet. Pick any channel.</p>';
    listed.forEach(function (c) {
      var id = String(c.id);
      var t = tiers[id] || "";
      var label = labelOf(c);
      html += '<div class="tt-row" role="group" aria-label="Tier for ' + esc(label) + '" data-tt-id="' + esc(id) + '">';
      html += '<span class="tt-name">' + esc(label) + "</span>";
      [["", "Off"], ["free", "Free"], ["premium", "Premium"]].forEach(function (pair) {
        html += '<label class="tt-opt"><input type="radio" name="tt-tier-' + esc(id) + '" data-tt-tier value="' + pair[0] + '"' + (t === pair[0] ? " checked" : "") + "><span>" + pair[1] + "</span></label>";
      });
      html += "</div>";
    });
    if (extras.length) {
      html += '<div class="tt-add"><label for="tt-pick">Add a channel</label>';
      html += '<select id="tt-pick" data-tt-pick><option value="">Pick a channel</option>';
      extras.forEach(function (c) {
        html += '<option value="' + esc(c.id) + '">' + esc(labelOf(c)) + "</option>";
      });
      html += '</select><button type="button" class="ghost" data-tt-add>Add</button></div>';
    }
    html += '<div class="tt-actions"><button type="button" class="btn" data-tt-save>Save</button><span class="tt-msg" data-tt-msg role="status"></span></div>';
    html += "</section>";
    return html;
  }

  function readTiers(section, prev) {
    prev = prev || {};
    var limEl = section && section.querySelector ? section.querySelector("[data-tt-limit]") : null;
    var raw = limEl ? String(limEl.value == null ? "" : limEl.value).trim() : "";
    var map = {};
    var nodes = section && section.querySelectorAll ? section.querySelectorAll("[data-tt-id]") : [];
    Array.prototype.forEach.call(nodes, function (g) {
      var picked = g.querySelector("[data-tt-tier]:checked");
      if (picked && (picked.value === "free" || picked.value === "premium")) map[g.getAttribute("data-tt-id")] = picked.value;
    });
    return {
      daily_free_limit: limitOf(raw),
      tip_channel_tiers: map,
      listed: prev.listed || [],
      all: prev.all || []
    };
  }

  function injectCss(doc) {
    if (!doc || !doc.getElementById || doc.getElementById("tt-css")) return;
    var style = doc.createElement("style");
    style.id = "tt-css";
    style.textContent = [
      "[data-tt-card]{min-width:0;max-width:100%}",
      "[data-tt-card] *{box-sizing:border-box}",
      "[data-tt-card] .tt-limit{display:flex;flex-direction:column;gap:6px;margin:12px 0 8px;font-size:13px;color:var(--muted,#a8acb2)}",
      "[data-tt-card] input,[data-tt-card] select{width:100%;min-height:44px;border-radius:10px;border:1px solid var(--line,#3f4147);background:var(--card2,#232428);color:var(--txt,#eee);padding:8px 10px;font:inherit}",
      "[data-tt-card] .tt-hint{margin:0 0 12px;color:var(--faint,#9aa);font-size:12px;line-height:1.45}",
      "[data-tt-card] .tt-row{display:flex;flex-wrap:wrap;align-items:center;gap:4px 12px;margin:0 0 8px}",
      "[data-tt-card] .tt-name{flex-basis:100%;font-weight:650;font-size:14px}",
      "[data-tt-card] .tt-opt{display:flex;align-items:center;gap:8px;min-height:44px;padding:4px 8px 4px 0;color:var(--txt,#eee);font-size:14px}",
      "[data-tt-card] .tt-opt input{width:22px;height:22px;flex:none}",
      "[data-tt-card] .tt-add{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:12px 0}",
      "[data-tt-card] .tt-add label{flex-basis:100%;font-size:13px;color:var(--muted,#a8acb2)}",
      "[data-tt-card] .tt-add select{flex:1;min-width:160px}",
      "[data-tt-card] .tt-actions{display:flex;align-items:center;gap:10px;margin-top:12px}",
      "[data-tt-card] .tt-msg{font-size:12px;color:var(--faint,#9aa)}",
      "[data-tt-card] .tt-msg.tt-err{color:var(--loss,#e55)}"
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

  function mount(el, ctx) {
    if (!el) return function () {};
    ctx = ctx || {};
    if (ctx.canEdit === false) {
      el.innerHTML = "";
      return function () {};
    }
    if (root.document) injectCss(root.document);
    var stopped = false;
    var gen = 0;
    var state = tierState(null);

    function alive() { return !stopped && el.isConnected !== false; }

    function paint(note) {
      if (!alive()) return;
      el.innerHTML = tierHtml(state);
      var msg = el.querySelector("[data-tt-msg]");
      if (msg && note) msg.textContent = note;
      bind();
    }

    function onAdd() {
      var pick = el.querySelector("[data-tt-pick]");
      if (!pick || !pick.value) return;
      var id = String(pick.value);
      var current = readTiers(el, state);
      state.daily_free_limit = current.daily_free_limit;
      state.tip_channel_tiers = current.tip_channel_tiers;
      if (!state.listed.some(function (c) { return c.id === id; })) {
        var found = state.all.filter(function (c) { return c.id === id; })[0];
        state.listed.push({id: id, name: found ? found.name : ""});
      }
      paint();
    }

    async function onSave() {
      if (!ctx.api) return;
      var msg = el.querySelector("[data-tt-msg]");
      var next = readTiers(el, state);
      state.daily_free_limit = next.daily_free_limit;
      state.tip_channel_tiers = next.tip_channel_tiers;
      if (msg) { msg.textContent = "Saving\u2026"; msg.classList.remove("tt-err"); }
      try {
        var res = await ctx.api("/api/channels", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify(tierBody(ctx.gid, state))
        });
        if (!alive()) return;
        if (unauth(res, null, ctx)) return;
        var body = await readJson(res);
        if (!res || !res.ok || body.ok === false) {
          var fail = el.querySelector("[data-tt-msg]");
          if (fail) { fail.textContent = (body && (body.error || body.message)) || "Could not save"; fail.classList.add("tt-err"); }
          return;
        }
        if (body && (body.daily_free_limit !== undefined || body.tip_channel_tiers)) {
          var echoed = tierState({
            daily_free_limit: body.daily_free_limit !== undefined ? body.daily_free_limit : state.daily_free_limit,
            tip_channel_tiers: body.tip_channel_tiers || state.tip_channel_tiers,
            channels: state.all,
            outputs: []
          });
          state.daily_free_limit = echoed.daily_free_limit;
          state.tip_channel_tiers = echoed.tip_channel_tiers;
          echoed.listed.forEach(function (c) {
            if (!state.listed.some(function (row) { return row.id === c.id; })) state.listed.push(c);
          });
        }
        paint("Saved");
      } catch (e) {
        if (unauth(null, e, ctx)) return;
        var err = el.querySelector("[data-tt-msg]");
        if (err) { err.textContent = "Could not save"; err.classList.add("tt-err"); }
      }
    }

    function bind() {
      var save = el.querySelector("[data-tt-save]");
      if (save) save.onclick = onSave;
      var add = el.querySelector("[data-tt-add]");
      if (add) add.onclick = onAdd;
    }

    async function load() {
      var token = ++gen;
      el.innerHTML = '<div class="empty">Loading\u2026</div>';
      if (!ctx.api) { paint(); return; }
      try {
        var res = await ctx.api(channelsPath(ctx.gid));
        if (!alive() || token !== gen) return;
        if (unauth(res, null, ctx)) return;
        if (!res || !res.ok) {
          el.innerHTML = '<div class="empty">Couldn\u2019t load tip channel tiers.</div>';
          return;
        }
        var body = await readJson(res);
        state = tierState(body);
        if (alive() && token === gen) paint();
      } catch (e) {
        if (unauth(null, e, ctx)) return;
        if (alive() && token === gen) el.innerHTML = '<div class="empty">Couldn\u2019t load tip channel tiers.</div>';
      }
    }

    load();
    return function stop() { stopped = true; };
  }

  var API = {
    mount: mount,
    tierState: tierState,
    tierBody: tierBody,
    tierHtml: tierHtml,
    readTiers: readTiers,
    channelsPath: channelsPath
  };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  root.TBTipTiers = API;
})(typeof window !== "undefined" ? window : globalThis);
