/* Owner-only Post settings for each connector in server settings.
   Reads and writes post_bookmaker, post_style, and tiers on the connector.
   Quiet is the default. Full is stored as post_style "standard".
   Tiering is off until enabled. TIER_FIELDS is the one place to rename
   the tiers payload when the bot contract settles.
   Not part of the public site (scripts/build-public.mjs ASSET_DENY). */
(function (root) {
  "use strict";

  var BOOKS = ["Sportsbet", "TAB", "bet365", "PointsBet", "Dabble", "Picklebet", "Ladbrokes", "Neds", "betr", "Unibet", "BetRight", "PlayUp", "Betfair"];
  var DEFAULT_BOOK = "Ladbrokes";
  var TIER_FIELDS = {
    tiers: "tiers",
    enabled: "enabled",
    limit: "daily_free_limit",
    channels: "channels",
    channelList: "tip_channels"
  };

  var SAMPLE = {
    runner: "Fast Fleet",
    number: 7,
    race: "R4",
    track: "Flemington",
    odds: "4.50",
    units: "1",
    sport: "RACING",
    betType: "Win",
    status: "Pending",
    game: "Flemington R4",
    tipId: "preview",
    link: "https://www.ladbrokes.com.au/racing/flemington/00000000-0000-4000-8000-000000000004"
  };

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c];
    });
  }

  function enc(v) { return encodeURIComponent(v == null ? "" : String(v)); }

  function listPath(gid) { return "/api/connectors?guild_id=" + enc(gid); }

  function updatePath(id, gid) { return "/api/connectors/" + enc(id) + "?guild_id=" + enc(gid); }

  function bookOf(settings) {
    var text = String((settings && settings.post_bookmaker) || "").trim();
    return text || DEFAULT_BOOK;
  }

  function styleCode(value) {
    var text = String(value || "").trim().toLowerCase();
    if (text === "full" || text === "standard") return "standard";
    return "quiet";
  }

  function styleOf(settings) {
    return styleCode(settings && settings.post_style);
  }

  function tierCode(value) {
    return String(value || "").trim().toLowerCase() === "premium" ? "premium" : "free";
  }

  function limitOf(value) {
    var n = parseInt(value, 10);
    if (!isFinite(n) || n < 0) return 0;
    return n;
  }

  function flagOn(value) {
    return value === true || value === 1 || value === "1" || value === "true";
  }

  function tiersOf(settings) {
    var raw = settings && settings[TIER_FIELDS.tiers];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) raw = {};
    var src = raw[TIER_FIELDS.channels];
    var channels = {};
    if (src && typeof src === "object" && !Array.isArray(src)) {
      Object.keys(src).forEach(function (id) {
        var key = String(id || "").trim();
        if (!key) return;
        channels[key] = tierCode(src[id]);
      });
    }
    var out = {};
    out[TIER_FIELDS.enabled] = flagOn(raw[TIER_FIELDS.enabled]);
    out[TIER_FIELDS.limit] = limitOf(raw[TIER_FIELDS.limit]);
    out[TIER_FIELDS.channels] = channels;
    return out;
  }

  function tipChannels(connector, tiers) {
    var list = [];
    var seen = {};
    function add(id, name) {
      id = String(id == null ? "" : id).trim();
      if (!id || seen[id]) return;
      seen[id] = true;
      list.push({id: id, name: String(name || "").trim()});
    }
    var rows = connector && connector[TIER_FIELDS.channelList];
    if (Array.isArray(rows)) {
      rows.forEach(function (row) {
        if (row && typeof row === "object") add(row.id != null ? row.id : row.channel_id, row.name || row.channel_name);
        else add(row, "");
      });
    }
    if (connector && connector.channel_id != null && String(connector.channel_id).trim()) {
      add(connector.channel_id, connector.channel_name || "");
    }
    var map = tiers && tiers[TIER_FIELDS.channels];
    if (map && typeof map === "object" && !Array.isArray(map)) {
      Object.keys(map).forEach(function (id) { add(id, ""); });
    }
    return list;
  }

  function channelLabel(ch) {
    var name = String(ch && ch.name || "").trim();
    if (name) return name.charAt(0) === "#" ? name : ("#" + name);
    return String(ch && ch.id || "");
  }

  function mergeChannelNames(prev, next) {
    var names = {};
    (prev || []).forEach(function (ch) {
      if (ch && ch.name) names[String(ch.id)] = ch.name;
    });
    return (next || []).map(function (ch) {
      var id = String(ch.id);
      return {id: id, name: ch.name || names[id] || ""};
    });
  }

  function tierBlockHtml(connectorId, channels, tiers) {
    var wrap = {};
    wrap[TIER_FIELDS.tiers] = tiers;
    var spec = tiersOf(wrap);
    var on = spec[TIER_FIELDS.enabled];
    var limit = spec[TIER_FIELDS.limit];
    var map = spec[TIER_FIELDS.channels];
    var html = '<div class="cp-tiers">';
    html += '<div class="cp-style">';
    html += '<span class="cp-style-label">Tip channel tiers</span>';
    html += '<label class="cp-toggle"><input type="checkbox" data-cp-tier-on' + (on ? " checked" : "") + "><span>Enabled</span></label>";
    html += "</div>";
    html += '<label class="cp-book">Daily free tip limit<input class="cp-num" type="number" min="0" step="1" inputmode="numeric" data-cp-tier-limit value="' + esc(String(limit)) + '"></label>';
    html += '<div class="cp-hint">That many tips each day, Sydney time, also go to free channels. Off until tiering is on.</div>';
    (channels || []).forEach(function (ch) {
      if (!ch || ch.id == null || String(ch.id).trim() === "") return;
      var id = String(ch.id).trim();
      var tier = map[id] === "premium" ? "premium" : "free";
      var group = "cp-tier-" + String(connectorId) + "-" + id;
      var label = channelLabel({id: id, name: ch.name});
      html += '<div class="cp-style" role="group" aria-label="Tier for ' + esc(label) + '" data-cp-tier-id="' + esc(id) + '">';
      html += '<span class="cp-style-label">' + esc(label) + "</span>";
      html += '<label class="cp-toggle"><input type="radio" name="' + esc(group) + '" data-cp-tier value="free"' + (tier === "free" ? " checked" : "") + "><span>Free</span></label>";
      html += '<label class="cp-toggle"><input type="radio" name="' + esc(group) + '" data-cp-tier value="premium"' + (tier === "premium" ? " checked" : "") + "><span>Premium</span></label>";
      html += "</div>";
    });
    if (!channels || !channels.length) html += '<div class="cp-hint">No tip channel on this connector yet.</div>';
    html += "</div>";
    return html;
  }

  function saveBody(settings) {
    var body = {post_bookmaker: bookOf(settings), post_style: styleOf(settings)};
    body[TIER_FIELDS.tiers] = tiersOf(settings);
    return body;
  }

  function fromConnector(c) {
    var raw = {
      post_bookmaker: c && c.post_bookmaker,
      post_style: c && c.post_style
    };
    raw[TIER_FIELDS.tiers] = c && c[TIER_FIELDS.tiers];
    return saveBody(raw);
  }

  function previewModel(settings) {
    var book = bookOf(settings);
    var quiet = styleOf(settings) === "quiet";
    if (quiet) {
      var bet = book.toLowerCase() === "ladbrokes" ? ("Bet on " + book + " \u2192") : "Race page \u2192";
      return {
        title: "\uD83C\uDFC7 " + SAMPLE.race + " " + SAMPLE.track,
        description: [
          "#" + SAMPLE.number + " " + SAMPLE.runner + " \u2014 " + SAMPLE.betType + " @ $" + SAMPLE.odds + " (" + book + ")",
          SAMPLE.units + "u \u00b7 Pending"
        ].join("\n"),
        link: {text: bet, url: SAMPLE.link},
        fields: [],
        image: true,
        footer: "Tip ID " + SAMPLE.tipId,
        button: book.toLowerCase() === "ladbrokes" ? ("Bet on " + book) : "Race page"
      };
    }
    return {
      title: "RACING PLAY",
      description: "",
      fields: [
        ["Sport", SAMPLE.sport],
        ["Type", SAMPLE.betType],
        ["Bookmaker", book],
        ["Odds", SAMPLE.odds],
        ["Units", SAMPLE.units],
        ["Status", SAMPLE.status],
        ["Game", SAMPLE.game],
        ["Legs", "1. " + SAMPLE.race + " " + SAMPLE.track + " \u00b7 #" + SAMPLE.number + " " + SAMPLE.runner]
      ],
      image: false,
      footer: "Tip ID: " + SAMPLE.tipId,
      button: ""
    };
  }

  function previewHtml(settings) {
    var model = previewModel(settings);
    var html = '<div class="cp-discord"><div class="cp-embed"><div class="cp-bar"></div><div class="cp-body">';
    html += '<div class="cp-title">' + esc(model.title) + "</div>";
    if (model.description) html += '<div class="cp-desc">' + esc(model.description) + "</div>";
    if (model.link) html += '<div class="cp-link"><a href="' + esc(model.link.url) + '" target="_blank" rel="noopener noreferrer">' + esc(model.link.text) + "</a></div>";
    if (model.fields.length) {
      html += '<div class="cp-fields">';
      model.fields.forEach(function (field) {
        var wide = field[0] === "Legs";
        html += '<div class="cp-field' + (wide ? " cp-wide" : "") + '"><div class="cp-fk">' + esc(field[0]) + '</div><div class="cp-v">' + esc(field[1]) + "</div></div>";
      });
      html += "</div>";
    }
    if (model.image) html += '<div class="cp-card cp-card-wait">Silk card</div>';
    if (model.button) html += '<div class="cp-btn">' + esc(model.button) + "</div>";
    if (model.footer) html += '<div class="cp-foot">' + esc(model.footer) + "</div>";
    html += "</div></div></div>";
    return html;
  }

  function labelOf(c) {
    var name = String((c && (c.tipster_name || c.name)) || "").trim();
    if (name) return name;
    var id = String(c && c.id != null ? c.id : "");
    return id ? ("Connector " + id.slice(-4)) : "Connector";
  }

  function bookOptions(current) {
    var books = BOOKS.slice();
    if (books.indexOf(current) < 0) books.unshift(current);
    return books;
  }

  function sectionHtml(c, settings, channels) {
    var id = String(c && c.id != null ? c.id : "");
    var current = bookOf(settings);
    var style = styleOf(settings);
    var html = '<section class="cp-sec" data-cp-id="' + esc(id) + '">';
    html += '<div class="cp-head"><div class="cp-title-row">Post settings</div><div class="cp-name">' + esc(labelOf(c)) + "</div></div>";
    html += '<label class="cp-book">Bookmaker<select data-cp-book>';
    bookOptions(current).forEach(function (name) {
      html += '<option value="' + esc(name) + '"' + (name === current ? " selected" : "") + ">" + esc(name) + "</option>";
    });
    html += "</select></label>";
    html += '<div class="cp-style" role="group" aria-label="Post style">';
    html += '<span class="cp-style-label">Post style</span>';
    html += '<label class="cp-toggle"><input type="radio" name="cp-style-' + esc(id) + '" data-cp-style value="quiet"' + (style === "quiet" ? " checked" : "") + "><span>Quiet</span></label>";
    html += '<label class="cp-toggle"><input type="radio" name="cp-style-' + esc(id) + '" data-cp-style value="standard"' + (style === "standard" ? " checked" : "") + "><span>Full</span></label>";
    html += "</div>";
    html += tierBlockHtml(id, channels, settings && settings[TIER_FIELDS.tiers]);
    html += '<div class="cp-preview" data-cp-preview>' + previewHtml(settings) + "</div>";
    html += '<div class="cp-actions"><button type="button" class="btn" data-cp-save>Save</button><span class="cp-msg" data-cp-msg role="status"></span></div>';
    html += "</section>";
    return html;
  }

  function readSettings(section) {
    var book = section.querySelector("[data-cp-book]");
    var chosen = section.querySelector("[data-cp-style]:checked");
    var on = section.querySelector("[data-cp-tier-on]");
    var limit = section.querySelector("[data-cp-tier-limit]");
    var channels = {};
    var groups = section.querySelectorAll("[data-cp-tier-id]");
    Array.prototype.forEach.call(groups, function (group) {
      var id = group.getAttribute("data-cp-tier-id");
      var picked = group.querySelector("[data-cp-tier]:checked");
      if (id) channels[id] = picked ? picked.value : "free";
    });
    var raw = {
      post_bookmaker: book ? book.value : "",
      post_style: chosen ? chosen.value : "quiet"
    };
    var tiers = {};
    tiers[TIER_FIELDS.enabled] = !!(on && on.checked);
    tiers[TIER_FIELDS.limit] = limit ? limit.value : 0;
    tiers[TIER_FIELDS.channels] = channels;
    raw[TIER_FIELDS.tiers] = tiers;
    return saveBody(raw);
  }

  function injectCss(doc) {
    if (!doc || !doc.getElementById || doc.getElementById("cp-css")) return;
    var style = doc.createElement("style");
    style.id = "cp-css";
    style.textContent = [
      "#cp-root{min-width:0;max-width:100%}",
      "#cp-root *{box-sizing:border-box}",
      "#cp-root .cp-sec{margin-top:16px;padding-top:14px;border-top:1px solid var(--line,#3f4147);min-width:0}",
      "#cp-root .cp-sec:first-child{margin-top:0;padding-top:0;border-top:0}",
      "#cp-root .cp-title-row{font-weight:700;font-size:var(--t-sub,14px);color:var(--txt,#eee)}",
      "#cp-root .cp-name{color:var(--faint,#9aa);font-size:var(--t-foot,12px);margin-top:2px}",
      "#cp-root .cp-book,#cp-root .cp-style{display:flex;flex-direction:column;gap:6px;margin:12px 0;font-size:13px;color:var(--muted,#a8acb2)}",
      "#cp-root .cp-style{flex-direction:row;flex-wrap:wrap;align-items:center}",
      "#cp-root .cp-style-label{flex-basis:100%}",
      "#cp-root select,#cp-root .cp-num{width:100%;min-height:44px;border-radius:10px;border:1px solid var(--line,#3f4147);background:var(--card2,#232428);color:var(--txt,#eee);padding:8px 10px;font:inherit}",
      "#cp-root .cp-hint{margin:-4px 0 12px;color:var(--faint,#9aa);font-size:12px;line-height:1.45}",
      "#cp-root .cp-toggle{display:flex;align-items:center;gap:10px;min-height:44px;padding:4px 12px 4px 0;color:var(--txt,#eee);font-size:14px}",
      "#cp-root .cp-toggle input{width:22px;height:22px;flex:none}",
      "#cp-root .cp-preview{margin-top:12px}",
      "#cp-root .cp-discord{background:#313338;border-radius:12px;padding:10px}",
      "#cp-root .cp-embed{display:flex;background:#2b2d31;border-radius:8px;overflow:hidden}",
      "#cp-root .cp-bar{width:4px;background:#f0b232;flex:none}",
      "#cp-root .cp-body{padding:10px 12px;min-width:0;flex:1}",
      "#cp-root .cp-title{font-weight:700;color:#f2f3f5;font-size:15px}",
      "#cp-root .cp-desc{margin-top:6px;color:#dbdee1;font-size:13px;white-space:pre-wrap}",
      "#cp-root .cp-fields{display:flex;flex-wrap:wrap;gap:8px 12px;margin-top:8px}",
      "#cp-root .cp-field{min-width:42%}",
      "#cp-root .cp-wide{flex-basis:100%}",
      "#cp-root .cp-fk{color:#b5bac1;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.02em}",
      "#cp-root .cp-v{color:#f2f3f5;font-size:13px;overflow-wrap:anywhere}",
      "#cp-root .cp-card{display:block;width:100%;margin-top:8px;border-radius:8px}",
      "#cp-root .cp-card-wait{height:72px;background:#232428;color:#b5bac1;display:flex;align-items:center;justify-content:center;font-size:12px}",
      "#cp-root .cp-link{margin-top:4px;font-size:13px;font-weight:700}",
      "#cp-root .cp-link a{color:#00a8fc;text-decoration:none}",
      "#cp-root .cp-btn{display:inline-block;margin-top:8px;padding:6px 10px;border-radius:8px;background:#4e5058;color:#fff;font-size:13px}",
      "#cp-root .cp-foot{margin-top:8px;color:#949ba4;font-size:11px}",
      "#cp-root .cp-actions{display:flex;align-items:center;gap:10px;margin-top:12px}",
      "#cp-root .cp-actions .btn{min-height:44px}",
      "#cp-root .cp-msg{font-size:12px;color:var(--faint,#9aa)}",
      "#cp-root .cp-msg.cp-err{color:var(--loss,#e55)}"
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
    if (!el) return;
    ctx = ctx || {};
    var doc = el.ownerDocument || root.document;
    if (!doc) return;
    injectCss(doc);
    var stopped = false;
    var gen = 0;
    var state = { list: [], settings: {}, channels: {} };

    function alive() { return !stopped && el.isConnected !== false; }

    function paint() {
      if (!alive()) return;
      var html = '<div id="cp-root">';
      if (!state.list.length) html += '<div class="empty">No connectors yet.</div>';
      state.list.forEach(function (c) {
        if (!c || c.id == null || c.id === "") return;
        html += sectionHtml(c, state.settings[String(c.id)] || fromConnector(null), state.channels[String(c.id)] || []);
      });
      html += "</div>";
      el.innerHTML = html;
      bind();
    }

    function sectionEl(id) {
      var want = String(id);
      var nodes = el.querySelectorAll("[data-cp-id]");
      for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].getAttribute("data-cp-id") === want) return nodes[i];
      }
      return null;
    }

    function paintPreview(id) {
      var section = sectionEl(id);
      if (!section) return;
      var slot = section.querySelector("[data-cp-preview]");
      if (!slot) return;
      slot.innerHTML = previewHtml(state.settings[id]);
    }

    function onChange(id) {
      var section = sectionEl(id);
      if (!section) return;
      state.settings[id] = readSettings(section);
      paintPreview(id);
    }

    async function onSave(id) {
      var section = sectionEl(id);
      if (!section || !ctx.api) return;
      var msg = section.querySelector("[data-cp-msg]");
      state.settings[id] = readSettings(section);
      if (msg) { msg.textContent = "Saving\u2026"; msg.classList.remove("cp-err"); }
      try {
        var res = await ctx.api(updatePath(id, ctx.gid), {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify(saveBody(state.settings[id]))
        });
        if (unauth(res, null, ctx)) return;
        var body = await readJson(res);
        if (!res || !res.ok || body.ok === false || body.post_bookmaker == null || !body.post_style) {
          if (msg) { msg.textContent = "Could not save"; msg.classList.add("cp-err"); }
          return;
        }
        var posted = state.settings[id];
        var next = fromConnector(body);
        if (body[TIER_FIELDS.tiers] == null) next[TIER_FIELDS.tiers] = posted[TIER_FIELDS.tiers];
        state.settings[id] = next;
        state.channels[id] = mergeChannelNames(state.channels[id], tipChannels(body, next[TIER_FIELDS.tiers]));
        if (msg) msg.textContent = "Saved";
        paint();
      } catch (e) {
        if (unauth(null, e, ctx)) return;
        if (msg) { msg.textContent = "Could not save"; msg.classList.add("cp-err"); }
      }
    }

    function bind() {
      var sections = el.querySelectorAll("[data-cp-id]");
      Array.prototype.forEach.call(sections, function (section) {
        var id = section.getAttribute("data-cp-id");
        section.addEventListener("change", function () { onChange(id); });
        var save = section.querySelector("[data-cp-save]");
        if (save) save.onclick = function () { onSave(id); };
      });
    }

    async function load() {
      var token = ++gen;
      el.innerHTML = '<div id="cp-root"><div class="empty">Loading\u2026</div></div>';
      if (!ctx.api) { paint(); return; }
      try {
        var res = await ctx.api(listPath(ctx.gid));
        if (!alive() || token !== gen) return;
        if (unauth(res, null, ctx)) return;
        var body = await readJson(res);
        var list = body && Array.isArray(body.connectors) ? body.connectors : [];
        state.list = list.filter(Boolean);
        state.settings = {};
        state.channels = {};
        state.list.forEach(function (c) {
          var id = String(c.id);
          state.settings[id] = fromConnector(c);
          state.channels[id] = tipChannels(c, state.settings[id][TIER_FIELDS.tiers]);
        });
        if (alive() && token === gen) paint();
      } catch (e) {
        if (unauth(null, e, ctx)) return;
        if (alive() && token === gen) el.innerHTML = '<div id="cp-root"><div class="empty">Could not load post settings.</div></div>';
      }
    }

    load();
    return function stop() { stopped = true; };
  }

  var API = {
    mount: mount,
    previewModel: previewModel,
    previewHtml: previewHtml,
    saveBody: saveBody,
    styleCode: styleCode,
    bookOf: bookOf,
    tipChannels: tipChannels,
    tierBlockHtml: tierBlockHtml,
    TIER_FIELDS: TIER_FIELDS,
    BOOKS: BOOKS,
    SAMPLE: SAMPLE
  };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  root.TBConnectorPost = API;
  if (root.TD && root.TD.loaded) root.TD.loaded["connector-post"] = true;
})(typeof window !== "undefined" ? window : globalThis);
