/* Owner-only Post settings for each connector in server settings.
   Toggles choose which lines a posted tip shows. The bookmaker replaces the
   one on the feed. The preview updates as the toggles change.
   Not part of the public site (scripts/build-public.mjs ASSET_DENY). */
(function (root) {
  "use strict";

  var TOGGLES = [
    ["odds", "Odds"],
    ["units", "Units"],
    ["track", "Race, track and time"],
    ["silks", "Silks image"],
    ["race_link", "Race link"],
    ["bookie", "Bookmaker"],
    ["confidence", "Confidence"],
    ["form", "Form and notes"],
    ["sport", "Sport"],
    ["bet_type", "Bet type"],
    ["status", "Status"],
    ["game", "Game"],
    ["follow", "Follow privately"],
    ["tip_id", "Tip ID"]
  ];

  var SAMPLE = {
    runner: "Fast Fleet",
    number: 7,
    race: "R4",
    track: "Flemington",
    time: "3:15pm",
    odds: "4.50",
    units: "1",
    feedBookie: "Sportsbet",
    sport: "RACING",
    betType: "Win",
    status: "Pending",
    game: "Flemington R4",
    confidence: "3/4 models · High",
    notes: "Soft ground",
    tipId: "preview",
    link: "https://www.ladbrokes.com.au/racing/flemington/00000000-0000-4000-8000-000000000004"
  };

  var FALLBACK_BOOKS = ["Sportsbet", "TAB", "bet365", "PointsBet", "Dabble", "Picklebet", "Ladbrokes", "Neds", "betr", "Unibet", "BetRight", "PlayUp", "Betfair"];

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c];
    });
  }

  function enc(v) { return encodeURIComponent(v == null ? "" : String(v)); }

  function listPath(gid) { return "/api/connectors?guild_id=" + enc(gid); }

  function settingsPath(id, gid) { return "/api/connectors/" + enc(id) + "/post-settings?guild_id=" + enc(gid); }

  function previewPath(id, gid) { return "/api/connectors/" + enc(id) + "/post-settings/preview?guild_id=" + enc(gid); }

  function booksOf(settings) {
    var list = settings && settings.bookmakers;
    if (list && list.length) return list.slice();
    return FALLBACK_BOOKS.slice();
  }

  function showOf(settings) {
    var src = (settings && settings.show) || {};
    var out = {};
    TOGGLES.forEach(function (pair) { out[pair[0]] = !!src[pair[0]]; });
    return out;
  }

  function previewModel(settings) {
    var show = showOf(settings);
    var book = String((settings && settings.bookmaker) || "").trim() || SAMPLE.feedBookie;
    var bits = [];
    if (show.track) bits.push(SAMPLE.race + " " + SAMPLE.track + " · " + SAMPLE.time);
    bits.push("#" + SAMPLE.number + " " + SAMPLE.runner);
    if (show.bet_type) bits.push(SAMPLE.betType);
    var line = bits.join(" · ");
    if (show.confidence) line += " · " + SAMPLE.confidence;
    var fields = [];
    if (show.sport) fields.push(["Sport", SAMPLE.sport]);
    if (show.bet_type) fields.push(["Type", SAMPLE.betType]);
    if (show.bookie) fields.push(["Bookmaker", book]);
    if (show.odds) fields.push(["Odds", SAMPLE.odds]);
    if (show.units) fields.push(["Units", SAMPLE.units]);
    if (show.status) fields.push(["Status", SAMPLE.status]);
    if (show.game) fields.push(["Game", SAMPLE.game]);
    if (show.follow) fields.push(["Follow privately", "React with a star"]);
    if (show.race_link) fields.push(["Race", SAMPLE.link]);
    fields.push(["Legs", "1. " + line]);
    var desc = [];
    if (show.form) desc.push(SAMPLE.notes);
    if (show.confidence) desc.push(SAMPLE.confidence);
    return {
      title: "RACING PLAY",
      description: desc.join("\n"),
      fields: fields,
      image: !!show.silks,
      footer: show.tip_id ? ("Tip ID: " + SAMPLE.tipId) : ""
    };
  }

  function previewHtml(settings, imageUrl) {
    var model = previewModel(settings);
    var html = '<div class="cp-discord"><div class="cp-embed"><div class="cp-bar"></div><div class="cp-body">';
    html += '<div class="cp-title">' + esc(model.title) + "</div>";
    if (model.description) html += '<div class="cp-desc">' + esc(model.description) + "</div>";
    html += '<div class="cp-fields">';
    model.fields.forEach(function (field) {
      var wide = field[0] === "Legs" || field[0] === "Race";
      html += '<div class="cp-field' + (wide ? " cp-wide" : "") + '"><div class="cp-fk">' + esc(field[0]) + '</div><div class="cp-v">' + esc(field[1]) + "</div></div>";
    });
    html += "</div>";
    if (model.image) {
      if (imageUrl) html += '<img class="cp-card" alt="Runner card" src="' + esc(imageUrl) + '">';
      else html += '<div class="cp-card cp-card-wait">Silks</div>';
    }
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

  function sectionHtml(c, settings) {
    var id = String(c && c.id != null ? c.id : "");
    var show = showOf(settings);
    var books = booksOf(settings);
    var current = String((settings && settings.bookmaker) || "");
    var html = '<section class="cp-sec" data-cp-id="' + esc(id) + '">';
    html += '<div class="cp-head"><div class="cp-title-row">Post settings</div><div class="cp-name">' + esc(labelOf(c)) + "</div></div>";
    html += '<label class="cp-book">Bookmaker<select data-cp-book>';
    html += '<option value="">Use the feed\'s bookie</option>';
    books.forEach(function (name) {
      html += '<option value="' + esc(name) + '"' + (name === current ? " selected" : "") + ">" + esc(name) + "</option>";
    });
    html += "</select></label>";
    html += '<div class="cp-toggles">';
    TOGGLES.forEach(function (pair) {
      html += '<label class="cp-toggle"><input type="checkbox" data-cp-key="' + esc(pair[0]) + '"' + (show[pair[0]] ? " checked" : "") + "><span>" + esc(pair[1]) + "</span></label>";
    });
    html += "</div>";
    html += '<div class="cp-preview" data-cp-preview>' + previewHtml(settings, "") + "</div>";
    html += '<div class="cp-actions"><button type="button" class="btn" data-cp-save>Save</button><span class="cp-msg" data-cp-msg role="status"></span></div>';
    html += "</section>";
    return html;
  }

  function readSettings(section, base) {
    var show = showOf(base);
    var boxes = section.querySelectorAll("[data-cp-key]");
    Array.prototype.forEach.call(boxes, function (box) {
      show[box.getAttribute("data-cp-key")] = !!box.checked;
    });
    var book = section.querySelector("[data-cp-book]");
    return {
      bookmaker: book ? book.value : "",
      show: show,
      bookmakers: booksOf(base)
    };
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
      "#cp-root .cp-book{display:flex;flex-direction:column;gap:6px;margin:12px 0;font-size:13px;color:var(--muted,#a8acb2)}",
      "#cp-root select{width:100%;min-height:44px;border-radius:10px;border:1px solid var(--line,#3f4147);background:var(--card2,#232428);color:var(--txt,#eee);padding:8px 10px;font:inherit}",
      "#cp-root .cp-toggles{display:grid;grid-template-columns:1fr;gap:8px}",
      "#cp-root .cp-toggle{display:flex;align-items:center;gap:10px;min-height:44px;padding:4px 0;color:var(--txt,#eee);font-size:14px}",
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
      "#cp-root .cp-foot{margin-top:8px;color:#949ba4;font-size:11px}",
      "#cp-root .cp-actions{display:flex;align-items:center;gap:10px;margin-top:12px}",
      "#cp-root .cp-actions .btn{min-height:44px}",
      "#cp-root .cp-msg{font-size:12px;color:var(--faint,#9aa)}",
      "#cp-root .cp-msg.cp-err{color:var(--loss,#e55)}",
      "@media(min-width:480px){#cp-root .cp-toggles{grid-template-columns:1fr 1fr}}"
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
    var state = { list: [], settings: {}, images: {} };
    var timers = {};

    function alive() { return !stopped && el.isConnected !== false; }

    function paint() {
      if (!alive()) return;
      var html = '<div id="cp-root">';
      if (!state.list.length) html += '<div class="empty">No connectors yet.</div>';
      state.list.forEach(function (c) {
        if (!c || c.id == null || c.id === "") return;
        html += sectionHtml(c, state.settings[String(c.id)] || { show: {}, bookmaker: "" });
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
      slot.innerHTML = previewHtml(state.settings[id], state.images[id] || "");
    }

    function scheduleImage(id) {
      if (timers[id]) clearTimeout(timers[id]);
      var settings = state.settings[id];
      if (!settings || !showOf(settings).silks) {
        state.images[id] = "";
        return;
      }
      timers[id] = setTimeout(function () { loadImage(id); }, 200);
    }

    async function loadImage(id) {
      if (!ctx.api) return;
      try {
        var res = await ctx.api(previewPath(id, ctx.gid), {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({ bookmaker: state.settings[id].bookmaker, show: state.settings[id].show })
        });
        if (!alive()) return;
        if (unauth(res, null, ctx)) return;
        var body = await readJson(res);
        if (body && body.image) state.images[id] = String(body.image);
        paintPreview(id);
      } catch (e) {
        unauth(null, e, ctx);
      }
    }

    function onChange(id) {
      var section = sectionEl(id);
      if (!section) return;
      state.settings[id] = readSettings(section, state.settings[id]);
      paintPreview(id);
      scheduleImage(id);
    }

    async function onSave(id) {
      var section = sectionEl(id);
      if (!section || !ctx.api) return;
      var msg = section.querySelector("[data-cp-msg]");
      state.settings[id] = readSettings(section, state.settings[id]);
      if (msg) { msg.textContent = "Saving…"; msg.classList.remove("cp-err"); }
      try {
        var res = await ctx.api(settingsPath(id, ctx.gid), {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({ bookmaker: state.settings[id].bookmaker, show: state.settings[id].show })
        });
        if (unauth(res, null, ctx)) return;
        var body = await readJson(res);
        if (!res || !res.ok || body.ok === false || !body.post_settings) {
          if (msg) { msg.textContent = "Could not save"; msg.classList.add("cp-err"); }
          return;
        }
        state.settings[id] = body.post_settings;
        if (msg) msg.textContent = "Saved";
        paintPreview(id);
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
      state.list.forEach(function (c) {
        if (c && c.id != null) scheduleImage(String(c.id));
      });
    }

    async function load() {
      var token = ++gen;
      el.innerHTML = '<div id="cp-root"><div class="empty">Loading…</div></div>';
      if (!ctx.api) { paint(); return; }
      try {
        var res = await ctx.api(listPath(ctx.gid));
        if (!alive() || token !== gen) return;
        if (unauth(res, null, ctx)) return;
        var body = await readJson(res);
        var list = body && Array.isArray(body.connectors) ? body.connectors : [];
        state.list = list.filter(Boolean);
        state.settings = {};
        state.list.forEach(function (c) {
          state.settings[String(c.id)] = c.post_settings || { show: {}, bookmaker: "", bookmakers: FALLBACK_BOOKS };
        });
        if (alive() && token === gen) paint();
      } catch (e) {
        if (unauth(null, e, ctx)) return;
        if (alive() && token === gen) el.innerHTML = '<div id="cp-root"><div class="empty">Could not load post settings.</div></div>';
      }
    }

    load();
    return function stop() { stopped = true; Object.keys(timers).forEach(function (id) { clearTimeout(timers[id]); }); };
  }

  var API = {
    mount: mount,
    previewModel: previewModel,
    previewHtml: previewHtml,
    TOGGLES: TOGGLES,
    SAMPLE: SAMPLE
  };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  root.TBConnectorPost = API;
  if (root.TD && root.TD.loaded) root.TD.loaded["connector-post"] = true;
})(typeof window !== "undefined" ? window : globalThis);
