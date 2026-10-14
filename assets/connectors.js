/* Owner-only Connectors section for a server's settings.
   Routes (TipBot, owner-only):
     GET    /api/connectors?guild_id=
     POST   /api/connectors?guild_id=                 save (create or update)
     DELETE /api/connectors?guild_id=&id=
     POST   /api/connectors/{id}/test                 fetch + first 3 mapped tips, posts nothing
     POST   /api/connectors/{id}/dry-run              embed preview, posts nothing
     POST   /api/connectors/{id}/toggle               { guild_id, enabled }
     GET    /api/connectors/{id}/events?limit=100          recent history, on open
     GET    /api/connectors/{id}/events?after=&limit=  newer lines
     GET    /api/connectors/{id}/events?before=&limit= older lines when scrolled up
     GET    /api/connectors/{id}/events/stream         text/event-stream, when the bot offers it
   The API key is write-only: it is sent only when someone types one, and it is
   never copied back into the form. A new connector stays paused until Enable.
   Each saved connector keeps a live log. Opening it loads recent history, then
   follows a stream when the response is text/event-stream. Otherwise it polls
   for newer lines every 3 seconds. Scrolling up loads older lines.
*/
(function (root) {
  "use strict";

  var DEFAULT_ENDPOINT = "https://horsepicks-tips.horsepicksai.workers.dev/tips";
  var DEFAULT_LABEL = "HorsePicks AI";
  var ALONGSIDE = "alongside";
  var POLL_MS = 3000;
  var PAGE_LIMIT = 100;
  var LOG_CAP = 400;
  var STICK_PX = 28;
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c];
    });
  }

  function enc(v) { return encodeURIComponent(v == null ? "" : String(v)); }

  function eventsQuery(q) {
    var query = {};
    if (q && typeof q === "object") query = q;
    else if (q) query = { after: q };
    var parts = [];
    if (query.before) parts.push("before=" + enc(query.before));
    else if (query.after) parts.push("after=" + enc(query.after));
    if (query.limit) parts.push("limit=" + enc(query.limit));
    return parts.length ? ("?" + parts.join("&")) : "";
  }

  function pathsFor(gid, id, after) {
    var g = enc(gid);
    var events = "/api/connectors/" + enc(id) + "/events" + eventsQuery(after);
    return {
      list: "/api/connectors?guild_id=" + g,
      save: "/api/connectors?guild_id=" + g,
      remove: "/api/connectors?guild_id=" + g + (id ? "&id=" + enc(id) : ""),
      test: "/api/connectors/" + enc(id) + "/test",
      dryRun: "/api/connectors/" + enc(id) + "/dry-run",
      toggle: "/api/connectors/" + enc(id) + "/toggle",
      events: events,
      stream: "/api/connectors/" + enc(id) + "/events/stream",
    };
  }

  function truthy(v) { return v === true || v === 1 || v === "1" || v === "true"; }

  function alongsideWord() { return "mi" + "rror"; }

  function postMode(v) {
    var m = String(v == null ? "" : v).toLowerCase();
    if (m === ALONGSIDE || m.indexOf("along") !== -1 || m === alongsideWord()) return ALONGSIDE;
    return "replace";
  }

  function postModeLabel(v) {
    return postMode(v) === ALONGSIDE ? ("Mi" + "rror alongside") : "Replace their posts";
  }

  function emptyStatus() {
    return { last_poll: null, last_success: null, last_error: null, tips_posted_today: 0, map_size: 0 };
  }

  function blankForm() {
    return {
      id: "",
      type: "horsepicks",
      endpoint_url: DEFAULT_ENDPOINT,
      api_key: "",
      api_key_last4: "",
      has_api_key: false,
      target_channel_id: "",
      tipster_label: DEFAULT_LABEL,
      poll_interval_seconds: 60,
      post_mode: "replace",
      skip_past_events: true,
      enabled: false,
      backfill_from: "",
      status: emptyStatus(),
    };
  }

  function last4Of(c) {
    if (!c || typeof c !== "object") return "";
    var v = c.api_key_last4 != null ? c.api_key_last4 : c.key_last4;
    v = String(v == null ? "" : v).replace(/\s/g, "");
    if (!v) return "";
    return v.slice(-4);
  }

  function enabledOf(c) {
    if (!c || typeof c !== "object") return false;
    if (Object.prototype.hasOwnProperty.call(c, "enabled")) return truthy(c.enabled);
    if (Object.prototype.hasOwnProperty.call(c, "paused")) return !truthy(c.paused);
    return false;
  }

  function skipOf(c) {
    if (!c || typeof c !== "object" || !Object.prototype.hasOwnProperty.call(c, "skip_past_events")) return true;
    return truthy(c.skip_past_events);
  }

  function labelOf(c) {
    var v = c && (c.tipster_label || c.tipster_name || c.avatar_label);
    v = String(v == null ? "" : v).trim();
    return v || DEFAULT_LABEL;
  }

  function pollOf(c) {
    var n = parseInt(c && (c.poll_interval_seconds != null ? c.poll_interval_seconds : c.poll_interval), 10);
    if (!Number.isFinite(n) || n < 1) return 60;
    return n;
  }

  function backfillOf(c) {
    if (!c) return "";
    var v = c.backfill_from != null ? c.backfill_from : c.backfill;
    if (v == null || v === "" || v === "none" || v === "None") return "";
    var s = String(v);
    var m = s.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
    return m ? (m[1] + "T" + m[2]) : s;
  }

  function statusOf(c) {
    var s = (c && (c.status || c.stats)) || {};
    var base = emptyStatus();
    base.last_poll = s.last_poll || s.last_polled_at || null;
    base.last_success = s.last_success || s.last_success_at || null;
    base.last_error = s.last_error || s.error || null;
    var posted = s.tips_posted_today != null ? s.tips_posted_today : s.posted_today;
    var mapN = s.map_size != null ? s.map_size : s.mapped;
    base.tips_posted_today = Number.isFinite(Number(posted)) ? Number(posted) : 0;
    base.map_size = Number.isFinite(Number(mapN)) ? Number(mapN) : 0;
    return base;
  }

  function formFrom(c) {
    var form = blankForm();
    if (!c || typeof c !== "object") return form;
    form.id = c.id != null ? String(c.id) : "";
    form.type = c.type ? String(c.type) : "horsepicks";
    if (c.endpoint_url || c.endpoint) form.endpoint_url = String(c.endpoint_url || c.endpoint);
    form.api_key = "";
    form.api_key_last4 = last4Of(c);
    form.has_api_key = !!(c.has_api_key || form.api_key_last4);
    var ch = c.target_channel_id != null ? c.target_channel_id : c.channel_id;
    form.target_channel_id = ch != null ? String(ch) : "";
    form.tipster_label = labelOf(c);
    form.poll_interval_seconds = pollOf(c);
    form.post_mode = postMode(c.post_mode);
    form.skip_past_events = skipOf(c);
    form.enabled = enabledOf(c);
    form.backfill_from = backfillOf(c);
    form.status = statusOf(c);
    return form;
  }

  function listFrom(body) {
    if (!body || typeof body !== "object") return [];
    if (body.ok === false && !body.connectors && !body.connector) return [];
    if (Array.isArray(body.connectors)) return body.connectors.filter(Boolean);
    if (body.connector && typeof body.connector === "object") return [body.connector];
    if (body.id || body.endpoint_url || body.endpoint || body.type) return [body];
    return [];
  }

  function payload(form, gid) {
    form = form || {};
    var poll = parseInt(form.poll_interval_seconds, 10);
    if (!Number.isFinite(poll) || poll < 1) poll = 60;
    var body = {
      guild_id: String(gid == null ? "" : gid),
      type: form.type || "horsepicks",
      endpoint_url: String(form.endpoint_url || "").trim(),
      target_channel_id: String(form.target_channel_id || ""),
      tipster_label: String(form.tipster_label || "").trim() || DEFAULT_LABEL,
      poll_interval_seconds: poll,
      post_mode: postMode(form.post_mode),
      skip_past_events: !!form.skip_past_events,
      enabled: !!form.enabled,
      backfill_from: form.backfill_from ? String(form.backfill_from) : null,
    };
    if (form.id) body.id = String(form.id);
    var key = String(form.api_key || "");
    if (key) body.api_key = key;
    return body;
  }

  function keyNote(form) {
    if (form && form.api_key_last4) {
      return "Saved key ends in " + form.api_key_last4 + ". Leave blank to keep it. A new key replaces it and is never shown again.";
    }
    return "Write-only. TipBot stores the key and never sends it back.";
  }

  function selectionText(sel) {
    if (sel == null) return "";
    if (typeof sel === "string") return sel;
    var num = sel.number != null && sel.number !== "" ? String(sel.number) + " " : "";
    return (num + (sel.name || "")).trim();
  }

  function confidenceText(conf) {
    if (conf == null || conf === "") return "";
    if (typeof conf !== "object") return String(conf);
    var bits = [];
    if (conf.models_agreeing != null && conf.models_total != null) bits.push(conf.models_agreeing + "/" + conf.models_total + " models");
    if (conf.rating) bits.push(String(conf.rating));
    return bits.join(" · ");
  }

  function tipLine(t) {
    if (t == null) return "";
    if (typeof t === "string") return t;
    if (t.line || t.text || t.summary) return String(t.line || t.text || t.summary);
    var bits = [
      t.event || t.event_name || "",
      selectionText(t.selection || t.runner),
      t.market || t.bet_type || "",
      t.odds != null && t.odds !== "" ? ("@" + t.odds) : "",
      t.bookie || "",
      t.stake_units != null && t.stake_units !== "" ? (t.stake_units + "u") : "",
      confidenceText(t.confidence),
    ];
    return bits.filter(Boolean).join(" · ");
  }

  function testView(body) {
    var preview = [];
    if (body && Array.isArray(body.preview)) preview = body.preview;
    else if (body && Array.isArray(body.tips)) preview = body.tips;
    var count = body && body.count != null && body.count !== "" ? body.count : preview.length;
    var lines = [];
    preview.slice(0, 3).forEach(function (t) {
      var line = tipLine(t);
      if (line) lines.push(line);
    });
    return { count: count, lines: lines };
  }

  function embedsFrom(body) {
    if (!body || typeof body !== "object") return [];
    if (Array.isArray(body.embeds)) return body.embeds;
    if (body.embed && typeof body.embed === "object") return [body.embed];
    return [];
  }

  function channelsFrom(body) {
    if (!body || typeof body !== "object") return [];
    var list = Array.isArray(body.channels) ? body.channels : [];
    return list.filter(function (c) { return c && (c.id != null || c.channel_id != null); }).map(function (c) {
      return { id: String(c.id != null ? c.id : c.channel_id), name: c.name || String(c.id || "") };
    });
  }

  function whenText(v, when) {
    if (v == null || v === "") return "—";
    if (typeof when === "function") {
      try {
        var s = when(v);
        if (s) return String(s);
      } catch (e) {}
    }
    return String(v);
  }

  function numText(v) {
    var n = Number(v);
    return Number.isFinite(n) ? String(n) : "0";
  }

  function colorCss(n) {
    var x = Number(n);
    if (!Number.isFinite(x)) return "";
    var hex = (x >>> 0).toString(16);
    hex = hex.slice(-6);
    while (hex.length < 6) hex = "0" + hex;
    return "#" + hex;
  }

  function pad2(n) {
    n = Number(n);
    if (!Number.isFinite(n)) return "00";
    return (n < 10 ? "0" : "") + n;
  }

  function clockParts(at) {
    var value = at == null || at === "" ? new Date() : at;
    var TB = root.TBTime;
    if (TB && typeof TB.parts === "function") {
      try {
        var p = TB.parts(value);
        var now = TB.parts(new Date());
        if (p && Number.isFinite(p.hour)) {
          var same = !!(now && now.year === p.year && now.month === p.month && now.day === p.day);
          return { hour: p.hour, minute: p.minute, second: p.second, day: p.day, month: p.month, today: same };
        }
      } catch (e) {}
    }
    var ms = value instanceof Date ? value.getTime() : Date.parse(String(value));
    if (!Number.isFinite(ms) && typeof value === "number") ms = value > 1e12 ? value : value * 1000;
    if (!Number.isFinite(ms)) return null;
    var d = new Date(ms);
    var n = new Date();
    var today = d.getUTCFullYear() === n.getUTCFullYear() && d.getUTCMonth() === n.getUTCMonth() && d.getUTCDate() === n.getUTCDate();
    return { hour: d.getUTCHours(), minute: d.getUTCMinutes(), second: d.getUTCSeconds(), day: d.getUTCDate(), month: d.getUTCMonth() + 1, today: today };
  }

  function clockOf(at) {
    var p = clockParts(at);
    if (!p) return "--:--:--";
    var time = pad2(p.hour) + ":" + pad2(p.minute) + ":" + pad2(p.second);
    if (p.today) return time;
    var month = MONTHS[(Number(p.month) || 1) - 1] || "";
    return String(p.day) + " " + month + " " + time;
  }

  function oddsText(v) {
    if (v == null || v === "") return "";
    var s = String(v).trim();
    if (s.charAt(0) === "@") s = s.slice(1);
    var n = Number(s);
    if (!Number.isFinite(n)) return "@" + s;
    return "@" + n.toFixed(2);
  }

  function stakeText(v) {
    if (v == null || v === "") return "";
    var s = String(v).trim();
    if (/u$/i.test(s)) return s;
    var n = Number(s);
    if (!Number.isFinite(n)) return s + "u";
    return String(n) + "u";
  }

  function bracketConf(conf) {
    if (conf == null || conf === "") return "";
    if (typeof conf !== "object") return "[" + String(conf).toUpperCase() + "]";
    var bits = [];
    if (conf.models_agreeing != null && conf.models_total != null) bits.push(conf.models_agreeing + "/" + conf.models_total);
    if (conf.rating) bits.push(String(conf.rating).toUpperCase());
    return bits.length ? ("[" + bits.join(" ") + "]") : "";
  }

  function selectionBoard(sel) {
    if (sel == null || sel === "") return "";
    if (typeof sel !== "object") return String(sel);
    var num = sel.number != null && sel.number !== "" ? ("#" + sel.number) : "";
    return [num, sel.name || ""].filter(Boolean).join(" ");
  }

  function looksLikeTip(o) {
    return !!(o && typeof o === "object" && (o.event || o.event_name || o.selection || o.runner || o.odds != null || o.bookie || o.stake_units != null));
  }

  function knownType(type) {
    if (type === "tip" || type === "recv" || type === "received") return "tip_received";
    if (type === "post") return "posted";
    if (type === "skip") return "skipped";
    if (type === "err") return "error";
    if (type === "status") return "status_update";
    if (type === "grade") return "graded";
    if (type === "poll" || type === "tip_received" || type === "posted" || type === "status_update" || type === "skipped" || type === "error" || type === "graded" || type === "mismatch") return type;
    return "";
  }

  function definedOf(obj, keys) {
    if (!obj || typeof obj !== "object") return undefined;
    for (var i = 0; i < keys.length; i++) {
      if (obj[keys[i]] != null && obj[keys[i]] !== "") return obj[keys[i]];
    }
    return undefined;
  }

  function readSide(raw, names, unitNames) {
    var outcome = "";
    var units;
    for (var i = 0; i < names.length; i++) {
      var v = raw[names[i]];
      if (v && typeof v === "object") {
        outcome = v.outcome || v.status || v.result || "";
        units = definedOf(v, ["profit_units", "units"]);
        break;
      }
      if (v != null && v !== "") { outcome = v; break; }
    }
    if (units === undefined) units = definedOf(raw, unitNames);
    return { outcome: outcome ? String(outcome) : "", units: units === undefined ? null : units };
  }

  function unitsOf(raw) {
    var units = definedOf(raw, ["profit_units", "units"]);
    var tip = raw && raw.tip;
    if (units === undefined && tip && typeof tip === "object") {
      units = definedOf(tip, ["profit_units", "units"]);
      if (units === undefined && tip.result) units = definedOf(tip.result, ["profit_units", "units"]);
    }
    if (units === undefined && raw && raw.result) units = definedOf(raw.result, ["profit_units", "units"]);
    return units === undefined ? null : units;
  }

  function normalizeEvent(raw) {
    if (!raw || typeof raw !== "object") return null;
    var type = knownType(String(raw.type || raw.event_type || "").toLowerCase());
    if (!type) return null;
    var id = raw.id != null && raw.id !== "" ? String(raw.id) : (raw.event_id != null && raw.event_id !== "" ? String(raw.event_id) : "");
    var tip = raw.tip || raw.payload || null;
    if (!tip && looksLikeTip(raw)) tip = raw;
    var status = raw.status || raw.outcome || "";
    if (!status && tip && typeof tip === "object") {
      status = tip.status || tip.outcome || "";
      if (!status && tip.result && typeof tip.result === "object") status = tip.result.outcome || "";
    }
    var clientSide = readSide(raw, ["client_result", "client_outcome", "client", "theirs"], ["client_profit_units", "client_units", "clientUnits"]);
    var ourSide = readSide(raw, ["our_result", "our_outcome", "ours", "tipbot_result"], ["our_profit_units", "profit_units", "ourUnits", "units"]);
    if (clientSide.units == null && raw.clientUnits != null && raw.clientUnits !== "") clientSide.units = raw.clientUnits;
    if (ourSide.units == null && raw.ourUnits != null && raw.ourUnits !== "") ourSide.units = raw.ourUnits;
    return {
      id: id,
      type: type,
      at: raw.at || raw.ts || raw.time || raw.created_at || raw.timestamp || null,
      tip: tip,
      status: status ? String(status) : "",
      message: raw.message || raw.error || raw.reason ? String(raw.message || raw.error || raw.reason) : "",
      count: raw.count != null ? raw.count : null,
      units: unitsOf(raw),
      client: clientSide.outcome,
      clientUnits: clientSide.units,
      ours: ourSide.outcome,
      ourUnits: ourSide.units,
    };
  }

  function outcomeOf(ev) {
    return String(ev && ev.status || "").toLowerCase();
  }

  function outcomeLabel(s) {
    s = String(s || "").toLowerCase();
    if (!s) return "";
    if (s.indexOf("scratch") !== -1 || s === "void" || s === "voided") return "SCRATCHED";
    if (s === "won" || s === "win" || s === "winner") return "WON";
    if (s === "lost" || s === "loss" || s === "lose" || s === "loser") return "LOST";
    if (s === "placed" || s === "place") return "PLACED";
    return String(s).toUpperCase();
  }

  function tagOf(ev) {
    ev = normalizeEvent(ev) || ev || {};
    if (ev.type === "tip_received") return "RECV";
    if (ev.type === "posted") return "POSTED";
    if (ev.type === "skipped") return "SKIP";
    if (ev.type === "error") return "ERR";
    if (ev.type === "poll") return "POLL";
    if (ev.type === "graded") return "GRADED";
    if (ev.type === "mismatch") return "MISMATCH";
    if (ev.type === "status_update") {
      var s = outcomeOf(ev);
      if (s.indexOf("scratch") !== -1 || s === "void" || s === "voided") return "SCRATCHED";
      if (s === "won" || s === "win" || s === "winner") return "WON";
      if (s === "lost" || s === "loss" || s === "lose" || s === "loser") return "LOST";
      if (s === "placed" || s === "place") return "PLACED";
      return "SCRATCHED";
    }
    return "POLL";
  }

  function bucketOf(tag) {
    if (tag === "RECV" || tag === "POSTED" || tag === "SKIP") return "tips";
    if (tag === "SCRATCHED" || tag === "WON" || tag === "LOST" || tag === "PLACED") return "results";
    if (tag === "GRADED" || tag === "MISMATCH") return "graded";
    if (tag === "ERR") return "errors";
    return "";
  }

  function toneOf(tag, ev) {
    if (tag === "GRADED") {
      var label = outcomeLabel(ev && ev.status);
      if (label === "WON") return "ok";
      if (label === "LOST") return "bad";
      return "warn";
    }
    if (tag === "MISMATCH") return "warn";
    if (tag === "RECV" || tag === "POSTED" || tag === "WON") return "ok";
    if (tag === "SKIP" || tag === "SCRATCHED" || tag === "PLACED") return "warn";
    if (tag === "LOST" || tag === "ERR") return "bad";
    return "dim";
  }

  function unitsText(v) {
    if (v == null || v === "") return "";
    var s = String(v).trim();
    if (/u$/i.test(s)) s = s.slice(0, -1).trim();
    var n = Number(s);
    if (!Number.isFinite(n)) return /u$/i.test(String(v).trim()) ? String(v).trim() : (String(v).trim() + "u");
    var rounded = Math.round(n * 100) / 100;
    var text = String(rounded);
    if (rounded > 0) return "+" + text + "u";
    return text + "u";
  }

  function tipIdentity(ev) {
    var tip = ev && ev.tip;
    if (typeof tip === "string") return tip;
    if (!tip || typeof tip !== "object") return "";
    return [tip.event || tip.event_name || "", selectionBoard(tip.selection || tip.runner)].filter(Boolean).join(" ");
  }

  function sideText(name, outcome, units) {
    var label = outcomeLabel(outcome);
    var unitsLabel = unitsText(units);
    if (!label && !unitsLabel) return "";
    return name + " " + [label, unitsLabel].filter(Boolean).join(" ");
  }

  function detailText(ev) {
    ev = ev || {};
    if (ev.type === "poll") {
      if (ev.count != null && ev.count !== "") return String(ev.count) + (Number(ev.count) === 1 ? " tip" : " tips");
      return ev.message ? String(ev.message) : "";
    }
    if (ev.type === "error") return ev.message ? String(ev.message) : "";
    if (ev.type === "graded") {
      return [
        outcomeLabel(ev.status),
        unitsText(ev.units),
        tipIdentity(ev),
        "by TipBot",
      ].filter(Boolean).join(" ");
    }
    if (ev.type === "mismatch") {
      var oursUnits = ev.ourUnits != null ? ev.ourUnits : ev.units;
      return [
        tipIdentity(ev),
        sideText("client", ev.client, ev.clientUnits),
        sideText("ours", ev.ours, oursUnits),
      ].filter(Boolean).join(" ");
    }
    var tip = ev.tip;
    var line = "";
    if (typeof tip === "string") line = tip;
    else if (tip && typeof tip === "object") {
      var market = tip.market || tip.bet_type || "";
      if (String(market).toLowerCase() === "win") market = "";
      line = [
        tip.event || tip.event_name || "",
        selectionBoard(tip.selection || tip.runner),
        market,
        oddsText(tip.odds),
        tip.bookie || "",
        stakeText(tip.stake_units != null ? tip.stake_units : tip.stake),
        bracketConf(tip.confidence),
      ].filter(Boolean).join(" ");
    }
    if (ev.message && ev.type === "skipped") return line ? (line + " " + ev.message) : String(ev.message);
    return line || (ev.message ? String(ev.message) : "");
  }

  function formatLine(ev) {
    var norm = normalizeEvent(ev) || ev || {};
    var tag = tagOf(norm);
    var detail = detailText(norm);
    return clockOf(norm.at) + " " + tag + (detail ? " " + detail : "");
  }

  function eventKey(ev) {
    if (ev.id) return "id:" + ev.id;
    var tip = "";
    if (ev.tip && typeof ev.tip === "object") tip = String(ev.tip.event || ev.tip.event_name || "") + "|" + String(ev.tip.odds || "");
    else if (ev.tip) tip = String(ev.tip);
    return "fp:" + ev.type + "|" + (ev.at || "") + "|" + (ev.status || "") + "|" + (ev.message || "") + "|" + tip;
  }

  function mergeEvents(prev, next, where) {
    var older = where === "prepend";
    var out = [];
    var seen = {};
    var added = 0;
    function push(raw, countAdd) {
      var ev = normalizeEvent(raw);
      if (!ev) return;
      var key = eventKey(ev);
      if (seen[key]) return;
      seen[key] = 1;
      out.push(ev);
      if (countAdd) added += 1;
    }
    if (older) {
      (next || []).forEach(function (e) { push(e, true); });
      (prev || []).forEach(function (e) { push(e, false); });
    } else {
      (prev || []).forEach(function (e) { push(e, false); });
      (next || []).forEach(function (e) { push(e, true); });
    }
    if (out.length > LOG_CAP) out = older ? out.slice(0, LOG_CAP) : out.slice(out.length - LOG_CAP);
    return { events: out, added: added };
  }

  function eventsFrom(body) {
    if (!body) return [];
    if (Array.isArray(body)) return body.map(normalizeEvent).filter(Boolean);
    if (typeof body !== "object") return [];
    if (Array.isArray(body.events)) return body.events.map(normalizeEvent).filter(Boolean);
    if (body.event && typeof body.event === "object") return [normalizeEvent(body.event)].filter(Boolean);
    var one = normalizeEvent(body);
    return one ? [one] : [];
  }

  function parseSse(text) {
    var raw = String(text == null ? "" : text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    var parts = raw.split("\n\n");
    var rest = parts.pop();
    var events = [];
    parts.forEach(function (block) {
      var data = [];
      var id = "";
      var eventName = "";
      block.split("\n").forEach(function (line) {
        if (!line || line.charAt(0) === ":") return;
        var i = line.indexOf(":");
        var field = i === -1 ? line : line.slice(0, i);
        var val = i === -1 ? "" : line.slice(i + 1).replace(/^ /, "");
        if (field === "data") data.push(val);
        else if (field === "id") id = val;
        else if (field === "event") eventName = val;
      });
      if (!data.length) return;
      var payload = data.join("\n");
      var obj;
      try { obj = JSON.parse(payload); } catch (e) { obj = { type: eventName || "error", message: payload }; }
      var list = Array.isArray(obj) ? obj : (obj && Array.isArray(obj.events) ? obj.events : [obj]);
      list.forEach(function (item) {
        if (item && typeof item === "object" && !Array.isArray(item)) {
          if (id && (item.id == null || item.id === "")) item.id = id;
          if (eventName && !item.type && !item.event_type) item.type = eventName;
        }
        var ev = normalizeEvent(item);
        if (ev) events.push(ev);
      });
    });
    return { events: events, rest: rest };
  }

  function stickToEnd(node) {
    if (!node) return true;
    return node.scrollHeight - node.scrollTop - node.clientHeight <= STICK_PX;
  }

  function passesFilter(ev, filter) {
    if (!filter || filter === "all") return true;
    return bucketOf(tagOf(ev)) === filter;
  }

  function linesHtml(log) {
    var filter = log && log.filter || "all";
    return ((log && log.events) || []).filter(function (ev) {
      return passesFilter(ev, filter);
    }).map(function (ev) {
      var tag = tagOf(ev);
      return '<div class="cx-line cx-' + toneOf(tag, ev) + '" data-tag="' + tag + '">' + esc(formatLine(ev)) + "</div>";
    }).join("");
  }

  function cursorHtml() {
    return '<div class="cx-cursor-line" aria-hidden="true"><span class="cx-cursor"></span></div>';
  }

  function boardSources(state) {
    var list = [];
    var seen = {};
    (state.list || []).forEach(function (c) {
      if (!c || c.id == null || c.id === "") return;
      var id = String(c.id);
      if (seen[id]) return;
      seen[id] = 1;
      list.push(c);
    });
    if (!list.length && state.form && state.form.id) list.push(state.form);
    return list;
  }

  function chipBtn(filter, label, on) {
    return '<button type="button" class="cx-chip' + (on ? " on" : "") + '" data-filter="' + filter + '" aria-pressed="' + (on ? "true" : "false") + '">' + esc(label) + "</button>";
  }

  function boardHtml(c, log) {
    var id = String(c.id);
    log = log || { events: [], filter: "all", follow: true };
    var filter = log.filter || "all";
    var label = c.tipster_label || c.tipster_name || "";
    var title = label ? ("Live · " + label) : "Live";
    var jumpHidden = log.follow !== false ? " hidden" : "";
    return '<section class="cx-board" data-id="' + esc(id) + '" aria-label="' + esc(title) + '">'
      + '<div class="cx-board-hd"><span>' + esc(title) + "</span></div>"
      + '<div class="cx-chips" role="toolbar" aria-label="Log filters">'
      + chipBtn("all", "All", filter === "all")
      + chipBtn("tips", "Tips", filter === "tips")
      + chipBtn("results", "Results", filter === "results")
      + chipBtn("graded", "Graded", filter === "graded")
      + chipBtn("errors", "Errors", filter === "errors")
      + "</div>"
      + '<div class="cx-log" role="log" aria-label="Connector live log" tabindex="0">' + linesHtml(log) + cursorHtml() + "</div>"
      + '<button type="button" class="cx-log-jump"' + jumpHidden + ">Latest</button>"
      + "</section>";
  }

  function boardsHtml(list, logs) {
    logs = logs || {};
    return (list || []).filter(function (c) { return c && c.id != null && c.id !== ""; }).map(function (c) {
      return boardHtml(c, logs[String(c.id)]);
    }).join("");
  }

  function injectCss() {
    if (root.document && root.document.getElementById("cx-css")) return;
    if (!root.document) return;
    var style = root.document.createElement("style");
    style.id = "cx-css";
    style.textContent = [
      "#cx-root{min-width:0;max-width:100%;overflow-wrap:anywhere}",
      "#cx-root *{box-sizing:border-box}",
      "#cx-root .cx-lead{color:var(--faint);font-size:var(--t-foot);line-height:1.45;margin:0 0 12px}",
      "#cx-root .cx-field{display:flex;flex-direction:column;gap:6px;margin:0 0 12px;min-width:0}",
      "#cx-root .cx-k{font-size:var(--t-foot);color:var(--muted);font-weight:650}",
      "#cx-root input,#cx-root select{width:100%;max-width:100%;min-width:0;min-height:44px;padding:10px 12px;border-radius:var(--r-sm);border:1px solid var(--line);background:var(--card2);color:var(--txt);font:inherit;font-size:16px}",
      "#cx-root .cx-hint{color:var(--faint);font-size:var(--t-foot);line-height:1.4}",
      "#cx-root .cx-check{display:flex;align-items:center;gap:10px;min-height:44px;cursor:pointer}",
      "#cx-root .cx-check input{width:18px;height:18px;min-height:0;flex:none;accent-color:var(--accent)}",
      "#cx-root .cx-modes{display:flex;flex-direction:column;gap:4px}",
      "#cx-root .cx-actions{display:flex;flex-direction:column;gap:8px;margin-top:4px}",
      "#cx-root .cx-actions .btn,#cx-root .cx-actions .ghost,#cx-root .cx-row .ghost{width:100%;text-align:center}",
      "#cx-root .cx-row{display:flex;flex-direction:column;gap:8px}",
      "#cx-root .cx-status{display:grid;grid-template-columns:1fr;gap:8px;margin-top:14px}",
      "#cx-root .cx-stat{border:1px solid var(--line);border-radius:var(--r-md);background:var(--card2);padding:10px 12px;min-width:0}",
      "#cx-root .cx-stat-k{color:var(--faint);font-size:var(--t-cap);text-transform:uppercase;letter-spacing:.04em}",
      "#cx-root .cx-stat-v{font-weight:700;margin-top:4px;overflow-wrap:anywhere}",
      "#cx-root .cx-err{color:var(--loss)}",
      "#cx-root .cx-pill{display:inline-flex;align-items:center;min-height:28px;padding:2px 10px;border-radius:999px;font-size:var(--t-cap);font-weight:750;letter-spacing:.03em;background:rgba(224,160,74,.18);color:#e0a04a}",
      "#cx-root .cx-pill.on{background:rgba(46,175,98,.16);color:var(--win)}",
      "#cx-root .cx-card{border:1px solid var(--line);border-radius:var(--r-md);background:var(--card2);padding:10px 12px;margin-top:8px;min-width:0}",
      "#cx-root .cx-embed{border:1px solid var(--line);border-left:4px solid var(--accent);border-radius:var(--r-md);background:var(--card2);padding:12px;margin-top:8px;min-width:0}",
      "#cx-root .cx-embed-title{font-weight:750;margin-bottom:4px}",
      "#cx-root .cx-embed-desc{white-space:pre-wrap;overflow-wrap:anywhere}",
      "#cx-root .cx-fields{display:flex;flex-direction:column;gap:8px;margin-top:8px}",
      "#cx-root .cx-fn{font-size:var(--t-cap);color:var(--muted);font-weight:700}",
      "#cx-root .cx-msg{display:block;font-size:var(--t-foot);margin-top:8px;min-height:1.2em}",
      "#cx-root .cx-board{position:relative;margin-top:14px;border:1px solid #1c3a28;border-radius:var(--r-md);background:#0c1210;color:#d7ffe4;min-width:0;max-width:100%}",
      "#cx-root .cx-board-hd{display:flex;align-items:center;padding:8px 10px 0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;color:#8fbfa2}",
      "#cx-root .cx-chips{display:flex;flex-wrap:wrap;gap:6px;padding:8px 10px;max-width:100%;min-width:0}",
      "#cx-root .cx-chip{flex:1 1 calc(33.33% - 6px);min-width:0;min-height:44px;padding:0 8px;border-radius:999px;border:1px solid #244433;background:transparent;color:#b7d7c4;font:inherit;font-size:13px;font-weight:650}",
      "#cx-root .cx-chip.on{background:#143224;color:#7dffb2;border-color:#2eaf62}",
      "#cx-root .cx-log{height:168px;max-width:100%;overflow:auto;padding:4px 10px 10px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;line-height:1.45;overflow-wrap:anywhere;word-break:break-word;white-space:pre-wrap;scrollbar-color:#244433 #0c1210}",
      "#cx-root .cx-line{overflow-wrap:anywhere;word-break:break-word}",
      "#cx-root .cx-ok{color:#3dff8a}",
      "#cx-root .cx-warn{color:#ffbf47}",
      "#cx-root .cx-bad{color:#ff5c5c}",
      "#cx-root .cx-dim{color:#6d8a78}",
      "#cx-root .cx-cursor{display:inline-block;width:8px;height:13px;margin-left:2px;background:#3dff8a;vertical-align:text-bottom;animation:cx-blink 1.05s steps(1) infinite}",
      "@keyframes cx-blink{0%,49%{opacity:1}50%,100%{opacity:0}}",
      "@media (prefers-reduced-motion:reduce){#cx-root .cx-cursor{animation:none}}",
      "#cx-root .cx-log-jump{position:absolute;right:10px;bottom:8px;min-height:44px;padding:0 12px;border-radius:999px;border:1px solid #2eaf62;background:#10281c;color:#7dffb2;font:inherit;font-weight:700}",
      "#cx-root .cx-log-jump[hidden]{display:none}",
      "@media(min-width:480px){#cx-root .cx-actions{flex-direction:row;flex-wrap:wrap}#cx-root .cx-actions .btn,#cx-root .cx-actions .ghost,#cx-root .cx-row .ghost{width:auto;flex:1 1 140px}#cx-root .cx-status{grid-template-columns:1fr 1fr}#cx-root .cx-row{flex-direction:row;align-items:flex-end}#cx-root .cx-row .cx-field{flex:1}#cx-root .cx-row .ghost{flex:none}}"
    ].join("");
    root.document.head.appendChild(style);
  }

  function statusHtml(status, when) {
    status = status || emptyStatus();
    var rows = [
      ["Last poll", whenText(status.last_poll, when), false],
      ["Last success", whenText(status.last_success, when), false],
      ["Last error", status.last_error ? String(status.last_error) : "—", !!status.last_error],
      ["Tips posted today", numText(status.tips_posted_today), false],
      ["Map size", numText(status.map_size), false],
    ];
    return '<div class="cx-status" aria-label="Connector status">' + rows.map(function (r) {
      return '<div class="cx-stat"><div class="cx-stat-k">' + esc(r[0]) + '</div><div class="cx-stat-v' + (r[2] ? " cx-err" : "") + '">' + esc(r[1]) + "</div></div>";
    }).join("") + "</div>";
  }

  function channelOptions(channels, selected, currentId) {
    var list = (channels || []).slice();
    var sel = String(selected || "");
    if (sel && !list.some(function (c) { return c.id === sel; })) list.push({ id: sel, name: currentId || sel });
    var html = '<option value="">Select a channel</option>';
    list.forEach(function (c) {
      html += '<option value="' + esc(c.id) + '"' + (c.id === sel ? " selected" : "") + ">#" + esc(c.name || c.id) + "</option>";
    });
    return html;
  }

  function field(id, label, control, hint) {
    return '<label class="cx-field" for="' + id + '"><span class="cx-k">' + esc(label) + "</span>" + control + (hint ? '<span class="cx-hint" id="' + id + '-hint">' + esc(hint) + "</span>" : "") + "</label>";
  }

  function formHtml(state) {
    var form = state.form;
    var saved = !!form.id;
    var typeOpts = '<option value="horsepicks"' + (form.type === "horsepicks" ? " selected" : "") + ">HorsePicks</option>"
      + '<option value="json" disabled>Generic JSON (later)</option>';
    var channel = state.channels.length
      ? '<select id="cx-channel" aria-label="Target channel">' + channelOptions(state.channels, form.target_channel_id) + "</select>"
      : '<input id="cx-channel" value="' + esc(form.target_channel_id) + '" placeholder="Channel id" autocomplete="off" aria-label="Target channel">';
    var mode = function (value) {
      var on = postMode(form.post_mode) === value;
      return '<label class="cx-check"><input type="radio" name="cx-mode" value="' + value + '"' + (on ? " checked" : "") + "> " + esc(postModeLabel(value)) + "</label>";
    };
    var dis = saved ? "" : " disabled";
    var pill = form.enabled ? '<span class="cx-pill on">On</span>' : '<span class="cx-pill">Paused</span>';
    return '<p class="cx-lead">Attach an external tip source for this server. It stays paused until you enable it. Test connection and Dry run post nothing.</p>'
      + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">' + pill + (form.id ? '<span class="cx-hint">Saved</span>' : '<span class="cx-hint">Not saved yet</span>') + "</div>"
      + '<form id="cx-form" autocomplete="off">'
      + field("cx-type", "Type", '<select id="cx-type" aria-label="Connector type">' + typeOpts + "</select>")
      + field("cx-endpoint", "Endpoint URL", '<input id="cx-endpoint" type="url" inputmode="url" autocomplete="off" spellcheck="false" value="' + esc(form.endpoint_url) + '" aria-label="Endpoint URL">')
      + field("cx-key", "API key", '<input id="cx-key" type="password" autocomplete="new-password" spellcheck="false" value="' + esc(form.api_key) + '" placeholder="Write-only" aria-describedby="cx-key-hint" aria-label="API key">', keyNote(form))
      + field("cx-channel-wrap", "Target channel", channel).replace('for="cx-channel-wrap"', 'for="cx-channel"')
      + field("cx-tipster", "Tipster name / avatar label", '<input id="cx-tipster" maxlength="80" autocomplete="off" value="' + esc(form.tipster_label) + '" aria-label="Tipster name">')
      + field("cx-poll", "Poll interval (seconds)", '<input id="cx-poll" type="number" inputmode="numeric" min="1" step="1" value="' + esc(String(form.poll_interval_seconds)) + '" aria-label="Poll interval in seconds">')
      + '<div class="cx-field"><span class="cx-k">Post mode</span><div class="cx-modes" role="radiogroup" aria-label="Post mode">' + mode("replace") + mode(ALONGSIDE) + "</div></div>"
      + '<label class="cx-check"><input id="cx-skip" type="checkbox"' + (form.skip_past_events ? " checked" : "") + '> <span>Skip past events</span></label>'
      + '<p class="cx-hint" style="margin:-4px 0 10px">Don\'t post tips whose event has already started.</p>'
      + '<label class="cx-check"><input id="cx-enabled" type="checkbox"' + (form.enabled ? " checked" : "") + '> <span>Enabled</span></label>'
      + '<div class="cx-field" style="margin-top:12px"><span class="cx-k">Backfill from</span><div class="cx-row">'
      + '<input id="cx-backfill" type="datetime-local" value="' + esc(form.backfill_from) + '" aria-label="Backfill from">'
      + '<button type="button" class="ghost" id="cx-backfill-none">None</button></div>'
      + '<span class="cx-hint">None by default. Set a start only when you want older tips included.</span></div>'
      + '<div class="cx-actions">'
      + '<button type="submit" class="btn" id="cx-save">Save</button>'
      + '<button type="button" class="ghost" id="cx-test"' + dis + ">Test connection</button>"
      + '<button type="button" class="ghost" id="cx-dry"' + dis + ">Dry run preview</button>"
      + '<button type="button" class="ghost" id="cx-toggle" data-on="' + (form.enabled ? "1" : "0") + '"' + dis + ">" + (form.enabled ? "Pause" : "Enable") + "</button>"
      + '<button type="button" class="ghost" id="cx-remove"' + dis + ' style="color:var(--loss)">Remove</button>'
      + "</div>"
      + '<span id="cx-msg" class="cx-msg" role="status"></span>'
      + "</form>"
      + statusHtml(form.status, state.when)
      + '<div id="cx-result"></div>'
      + boardsHtml(boardSources(state), state.logs);
  }

  function resultHtml(kind, body) {
    if (kind === "test") {
      var view = testView(body);
      var cards = view.lines.map(function (line) {
        return '<div class="cx-card">' + esc(line) + "</div>";
      }).join("");
      var shown = view.lines.length ? (" Showing the first " + view.lines.length + ".") : "";
      return '<div class="cx-result"><p class="cx-lead" style="margin-top:14px">' + esc(String(view.count)) + " tips." + shown + " Nothing was posted.</p>" + cards + "</div>";
    }
    var embeds = embedsFrom(body);
    var html = '<p class="cx-lead" style="margin-top:14px">Dry run. Nothing was posted.</p>';
    if (!embeds.length) {
      var fallback = testView(body);
      html += fallback.lines.map(function (line) { return '<div class="cx-card">' + esc(line) + "</div>"; }).join("");
      if (!fallback.lines.length) html += '<div class="empty">No preview returned.</div>';
      return '<div class="cx-result">' + html + "</div>";
    }
    html += embeds.map(function (em) {
      if (typeof em === "string") return '<div class="cx-embed">' + esc(em) + "</div>";
      var border = colorCss(em.color);
      var author = em.author && (em.author.name || em.author);
      var fields = Array.isArray(em.fields) ? em.fields : [];
      var footer = em.footer && (em.footer.text || em.footer);
      return '<div class="cx-embed"' + (border ? ' style="border-left-color:' + esc(border) + '"' : "") + ">"
        + (author ? '<div class="cx-hint">' + esc(typeof author === "string" ? author : author) + "</div>" : "")
        + (em.title ? '<div class="cx-embed-title">' + esc(em.title) + "</div>" : "")
        + (em.description ? '<div class="cx-embed-desc">' + esc(em.description) + "</div>" : "")
        + (fields.length ? '<div class="cx-fields">' + fields.map(function (f) {
          return '<div><div class="cx-fn">' + esc(f && f.name || "") + '</div><div>' + esc(f && f.value || "") + "</div></div>";
        }).join("") + "</div>" : "")
        + (footer ? '<div class="cx-hint" style="margin-top:8px">' + esc(typeof footer === "string" ? footer : footer) + "</div>" : "")
        + "</div>";
    }).join("");
    return '<div class="cx-result">' + html + "</div>";
  }

  function readControl(id) {
    var el = root.document && root.document.getElementById(id);
    return el ? el.value : "";
  }

  function readForm(state) {
    var form = state.form;
    var type = readControl("cx-type");
    if (type) form.type = type;
    form.endpoint_url = readControl("cx-endpoint");
    form.api_key = readControl("cx-key");
    form.target_channel_id = readControl("cx-channel");
    form.tipster_label = readControl("cx-tipster");
    form.poll_interval_seconds = readControl("cx-poll");
    var picked = root.document.querySelector('#cx-root input[name="cx-mode"]:checked');
    if (picked) form.post_mode = picked.value;
    var skip = root.document.getElementById("cx-skip");
    if (skip) form.skip_past_events = !!skip.checked;
    var en = root.document.getElementById("cx-enabled");
    if (en) form.enabled = !!en.checked;
    form.backfill_from = readControl("cx-backfill");
    return form;
  }

  function applyConnector(state, connector) {
    var typed = state.form.api_key;
    var next = formFrom(connector);
    if (typed && !(connector && connector.id)) next.api_key = typed;
    state.form = next;
  }

  async function readBody(res) {
    try { return await res.json(); } catch (e) { return {}; }
  }

  function messageOf(body, fallback) {
    if (body && (body.message || body.error)) return String(body.message || body.error);
    return fallback;
  }

  function mount(el, ctx) {
    if (!el) return;
    ctx = ctx || {};
    if (typeof el._cxStop === "function") el._cxStop();
    injectCss();
    var gidKey = String(ctx.gid == null ? "" : ctx.gid);
    if (!el._cxLogs) el._cxLogs = {};
    if (!el._cxLogs[gidKey]) el._cxLogs[gidKey] = {};
    var state = {
      gid: ctx.gid,
      form: blankForm(),
      list: [],
      logs: el._cxLogs[gidKey],
      channels: [],
      when: ctx.when,
      busy: false,
      note: "",
      noteErr: false,
      resultKind: "",
      resultBody: null,
    };
    var gen = 0;
    var stopped = false;
    var feeds = {};
    var sessionWatch = null;

    function stillOpen() {
      if (stopped || !root.document || !el.querySelector) return false;
      if (el.isConnected === false) return false;
      return !!el.querySelector("#cx-root");
    }

    function teardown() {
      if (stopped) return;
      stopped = true;
      gen += 1;
      if (sessionWatch) clearInterval(sessionWatch);
      Object.keys(feeds).forEach(function (id) { stopFeed(id); });
    }
    el._cxStop = teardown;

    function armWatch() {
      if (sessionWatch || stopped) return;
      sessionWatch = setInterval(function () {
        if (!stillOpen()) teardown();
      }, 1000);
    }

    function ensureLog(id) {
      id = String(id);
      if (!state.logs[id]) state.logs[id] = { events: [], filter: "all", follow: true, cursor: "", scrollTop: 0, exhausted: false, loadingOlder: false };
      return state.logs[id];
    }

    function boardEl(id) {
      if (!el.querySelectorAll) return null;
      var want = String(id);
      var nodes = el.querySelectorAll(".cx-board");
      for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].getAttribute("data-id") === want) return nodes[i];
      }
      return null;
    }

    function renderBoard(id) {
      var board = boardEl(id);
      if (!board) return;
      var log = ensureLog(id);
      var logEl = board.querySelector(".cx-log");
      var jump = board.querySelector(".cx-log-jump");
      if (logEl) {
        var pin = log.pin;
        var prevH = log._prevHeight;
        var prevTop = log._prevTop;
        log.pin = "";
        log._paint = true;
        logEl.innerHTML = linesHtml(log) + cursorHtml();
        if (pin === "prepend") {
          var delta = logEl.scrollHeight - (prevH || 0);
          logEl.scrollTop = (prevTop || 0) + (delta > 0 ? delta : 0);
        } else if (log.follow !== false) {
          logEl.scrollTop = logEl.scrollHeight;
        } else {
          logEl.scrollTop = log.scrollTop || 0;
        }
        log.scrollTop = logEl.scrollTop;
        log._paint = false;
      }
      if (jump) jump.hidden = log.follow !== false;
      var filter = log.filter || "all";
      var chips = board.querySelectorAll(".cx-chip");
      for (var i = 0; i < chips.length; i++) {
        var on = chips[i].getAttribute("data-filter") === filter;
        chips[i].classList.toggle("on", on);
        chips[i].setAttribute("aria-pressed", on ? "true" : "false");
      }
    }

    function bindBoards() {
      var boards = el.querySelectorAll(".cx-board");
      for (var i = 0; i < boards.length; i++) {
        (function (board) {
          var id = board.getAttribute("data-id");
          var log = ensureLog(id);
          var logEl = board.querySelector(".cx-log");
          var jump = board.querySelector(".cx-log-jump");
          if (logEl) {
            logEl.onscroll = function () {
              if (log._paint) return;
              log.scrollTop = logEl.scrollTop;
              log.follow = stickToEnd(logEl);
              if (jump) jump.hidden = log.follow !== false;
              if (logEl.scrollTop <= STICK_PX && !log.follow) loadOlder(id);
            };
            log._paint = true;
            logEl.scrollTop = log.follow !== false ? logEl.scrollHeight : (log.scrollTop || 0);
            log._paint = false;
            if (root.requestAnimationFrame) {
              root.requestAnimationFrame(function () {
                if (!logEl.isConnected || log.follow === false) return;
                log._paint = true;
                logEl.scrollTop = logEl.scrollHeight;
                log._paint = false;
              });
            }
          }
          if (jump) {
            jump.hidden = log.follow !== false;
            jump.onclick = function () {
              log.follow = true;
              if (logEl) {
                log._paint = true;
                logEl.scrollTop = logEl.scrollHeight;
                log.scrollTop = logEl.scrollTop;
                log._paint = false;
              }
              jump.hidden = true;
            };
          }
          var chips = board.querySelector(".cx-chips");
          if (chips) {
            chips.onclick = function (ev) {
              var btn = ev.target && ev.target.closest ? ev.target.closest(".cx-chip") : null;
              if (!btn) return;
              log.filter = btn.getAttribute("data-filter") || "all";
              renderBoard(id);
            };
          }
        })(boards[i]);
      }
    }

    function oldestId(log) {
      var events = (log && log.events) || [];
      for (var i = 0; i < events.length; i++) {
        if (events[i].id) return events[i].id;
      }
      return "";
    }

    function ingest(id, incoming, where) {
      if (!incoming || !incoming.length || stopped) return false;
      var log = ensureLog(id);
      var board = boardEl(id);
      var logEl = board && board.querySelector(".cx-log");
      if (where === "prepend" && logEl) {
        log.pin = "prepend";
        log._prevHeight = logEl.scrollHeight;
        log._prevTop = logEl.scrollTop;
      }
      var merged = mergeEvents(log.events, incoming, where);
      if (!merged.added) return false;
      log.events = merged.events;
      for (var i = log.events.length - 1; i >= 0; i--) {
        if (log.events[i].id) { log.cursor = log.events[i].id; break; }
      }
      renderBoard(id);
      return true;
    }

    async function pull(feed, query, where) {
      if (!feed || feed.stopped || stopped) return null;
      if (!stillOpen()) { teardown(); return null; }
      try {
        var r = await ctx.api(pathsFor(state.gid, feed.id, query).events, { retries: 1, timeoutMs: 8000 });
        if (feed.stopped || stopped) return null;
        if (r && r.status === 401) {
          teardown();
          if (ctx.onUnauth) ctx.onUnauth();
          return null;
        }
        if (r && r.ok) {
          var body = await readBody(r);
          var incoming = eventsFrom(body);
          if (!feed.stopped && !stopped) ingest(feed.id, incoming, where);
          return incoming;
        }
      } catch (e) {
        if (e && e.unauth) {
          teardown();
          if (ctx.onUnauth) ctx.onUnauth();
        }
      }
      return null;
    }

    async function loadOlder(id) {
      var feed = feeds[id];
      var log = state.logs[id];
      if (!feed || feed.stopped || stopped || !log || log.loadingOlder || log.exhausted) return;
      var before = oldestId(log);
      if (!before) return;
      log.loadingOlder = true;
      var size = log.events.length;
      try {
        var incoming = await pull(feed, { before: before, limit: PAGE_LIMIT }, "prepend");
        if (feed.stopped || stopped || incoming == null) return;
        if (log.events.length === size || incoming.length < PAGE_LIMIT) log.exhausted = true;
      } finally {
        log.loadingOlder = false;
      }
    }

    function stopFeed(id) {
      var feed = feeds[id];
      if (!feed) return;
      feed.stopped = true;
      if (feed.timer) clearTimeout(feed.timer);
      if (feed.abort) { try { feed.abort.abort(); } catch (e) {} }
      delete feeds[id];
    }

    function schedule(feed, ms) {
      if (feed.stopped || stopped) return;
      if (feed.timer) clearTimeout(feed.timer);
      feed.timer = setTimeout(function () { pollOnce(feed); }, ms);
    }

    function beginPoll(feed) {
      if (feed.stopped || stopped) return;
      feed.mode = "poll";
      if (feed.abort) {
        try { feed.abort.abort(); } catch (e) {}
        feed.abort = null;
      }
      schedule(feed, POLL_MS);
    }

    async function pollOnce(feed) {
      if (feed.stopped || stopped) return;
      feed.mode = "poll";
      feed.timer = null;
      var log = state.logs[feed.id];
      var query = { limit: PAGE_LIMIT };
      if (log && log.cursor) query.after = log.cursor;
      await pull(feed, query, "append");
      if (!feed.stopped && !stopped && feed.mode === "poll") schedule(feed, POLL_MS);
    }

    function isEventStream(res) {
      if (!res || !res.ok || !res.body || typeof res.body.getReader !== "function") return false;
      var ctype = "";
      try { ctype = res.headers && res.headers.get ? (res.headers.get("content-type") || "") : ""; } catch (e) { ctype = ""; }
      return /text\/event-stream/i.test(String(ctype));
    }

    async function readStream(feed, res) {
      var reader;
      try { reader = res.body.getReader(); } catch (e) { beginPoll(feed); return; }
      var Decoder = root.TextDecoder || (typeof TextDecoder !== "undefined" ? TextDecoder : null);
      var decoder = Decoder ? new Decoder() : null;
      var buf = "";
      try {
        while (!feed.stopped && !stopped) {
          var step = await reader.read();
          if (feed.stopped || stopped) return;
          if (step.done) break;
          if (decoder) buf += decoder.decode(step.value, { stream: true });
          else buf += String.fromCharCode.apply(null, step.value);
          var parsed = parseSse(buf);
          buf = parsed.rest;
          if (parsed.events.length) ingest(feed.id, parsed.events);
        }
      } catch (e) {
        if (feed.stopped || stopped) return;
      }
      if (feed.stopped || stopped) return;
      if (decoder) { try { buf += decoder.decode(); } catch (e2) {} }
      if (buf && String(buf).trim()) {
        var tail = parseSse(buf + "\n\n");
        if (tail.events.length) ingest(feed.id, tail.events);
      }
      feed.mode = "poll";
      schedule(feed, POLL_MS);
    }

    async function tryStream(feed) {
      if (feed.stopped || stopped) return;
      if (typeof ctx.fetchRaw !== "function") { beginPoll(feed); return; }
      var AC = root.AbortController || (typeof AbortController !== "undefined" ? AbortController : null);
      var ac = AC ? new AC() : null;
      feed.abort = ac;
      var res;
      try {
        res = await ctx.fetchRaw(pathsFor(state.gid, feed.id).stream, { signal: ac && ac.signal });
      } catch (e) {
        if (feed.stopped || stopped) return;
        beginPoll(feed);
        return;
      }
      if (feed.stopped || stopped) return;
      if (res && res.status === 401) {
        teardown();
        if (ctx.onUnauth) ctx.onUnauth();
        return;
      }
      if (!isEventStream(res)) {
        try { if (res && res.body && res.body.cancel) res.body.cancel(); } catch (e2) {}
        beginPoll(feed);
        return;
      }
      feed.mode = "stream";
      await readStream(feed, res);
    }

    function syncFeeds() {
      if (stopped) return;
      var keep = {};
      boardSources(state).forEach(function (c) {
        var id = String(c.id);
        keep[id] = 1;
        if (!feeds[id]) {
          var feed = { id: id, stopped: false, timer: null, abort: null, mode: "" };
          feeds[id] = feed;
          pull(feed, { limit: PAGE_LIMIT }, "append").then(function () {
            if (!feed.stopped && !stopped) tryStream(feed);
          });
        }
      });
      Object.keys(feeds).forEach(function (id) {
        if (!keep[id]) stopFeed(id);
      });
    }

    function syncFormToList() {
      var form = state.form;
      if (!form || !form.id) return;
      var id = String(form.id);
      var idx = -1;
      state.list.forEach(function (c, i) { if (c && String(c.id) === id) idx = i; });
      if (idx >= 0) state.list[idx] = form;
      else state.list.unshift(form);
    }

    function setNote(text, isErr) {
      state.note = text || "";
      state.noteErr = !!isErr;
      var msg = root.document.getElementById("cx-msg");
      if (!msg) return;
      msg.textContent = state.note;
      msg.style.color = state.noteErr ? "var(--loss)" : "var(--win)";
    }

    function paint() {
      if (stopped) return;
      el.innerHTML = '<div id="cx-root">' + formHtml(state) + "</div>";
      var result = root.document.getElementById("cx-result");
      if (result && state.resultKind) result.innerHTML = resultHtml(state.resultKind, state.resultBody);
      if (state.note) setNote(state.note, state.noteErr);
      bind();
      bindBoards();
      syncFeeds();
    }

    function bind() {
      var form = root.document.getElementById("cx-form");
      if (form) form.onsubmit = function (e) { e.preventDefault(); save(); };
      var none = root.document.getElementById("cx-backfill-none");
      if (none) none.onclick = function () {
        var input = root.document.getElementById("cx-backfill");
        if (input) input.value = "";
        state.form.backfill_from = "";
      };
      var test = root.document.getElementById("cx-test");
      if (test) test.onclick = function () { runAction("test"); };
      var dry = root.document.getElementById("cx-dry");
      if (dry) dry.onclick = function () { runAction("dry"); };
      var toggle = root.document.getElementById("cx-toggle");
      if (toggle) toggle.onclick = function () { runToggle(); };
      var remove = root.document.getElementById("cx-remove");
      if (remove) remove.onclick = function () { removeConnector(); };
    }

    function savedConnector(body) {
      if (!body) return null;
      if (body.connector && typeof body.connector === "object") return body.connector;
      var list = listFrom(body);
      if (list.length === 1) return list[0];
      if (body.id) return body;
      return null;
    }

    async function save() {
      if (state.busy) return;
      readForm(state);
      state.busy = true;
      setNote("Saving…", false);
      try {
        var r = await ctx.api(pathsFor(state.gid).save, {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify(payload(state.form, state.gid)),
        });
        var body = await readBody(r);
        if (r && r.status === 401) return ctx.onUnauth && ctx.onUnauth();
        if (!r || r.status === 404 || r.status === 501) { setNote("Connectors aren't on this bot yet.", true); return; }
        if (!r.ok || body.ok === false) { setNote(messageOf(body, "Couldn't save"), true); return; }
        var typedKey = state.form.api_key;
        var saved = savedConnector(body) || Object.assign({}, state.form, { id: state.form.id || body.id });
        state.form.api_key = "";
        applyConnector(state, saved);
        if (typedKey && !state.form.api_key_last4) {
          state.form.api_key_last4 = String(typedKey).slice(-4);
          state.form.has_api_key = true;
        }
        state.form.api_key = "";
        syncFormToList();
        state.resultKind = "";
        state.resultBody = null;
        paint();
        setNote("Saved. Still paused until you enable it.", false);
        if (state.form.enabled) setNote("Saved.", false);
      } catch (e) {
        if (e && e.unauth) return ctx.onUnauth && ctx.onUnauth();
        setNote("Couldn't reach the bot.", true);
      } finally { state.busy = false; }
    }

    async function runAction(kind) {
      if (state.busy || !state.form.id) return;
      readForm(state);
      state.busy = true;
      setNote(kind === "test" ? "Testing…" : "Building preview…", false);
      var paths = pathsFor(state.gid, state.form.id);
      try {
        var r = await ctx.api(kind === "test" ? paths.test : paths.dryRun, {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify(payload(state.form, state.gid)),
        });
        var body = await readBody(r);
        if (r && r.status === 401) return ctx.onUnauth && ctx.onUnauth();
        if (!r || r.status === 404 || r.status === 501) { setNote("Connectors aren't on this bot yet.", true); return; }
        if (!r.ok || body.ok === false) { setNote(messageOf(body, "Couldn't run that"), true); return; }
        state.form.api_key = "";
        state.resultKind = kind;
        state.resultBody = body;
        if (body.status) state.form.status = statusOf({ status: body.status });
        paint();
        setNote("", false);
        var box = root.document.getElementById("cx-result");
        if (box && box.scrollIntoView) box.scrollIntoView({ block: "nearest" });
      } catch (e) {
        if (e && e.unauth) return ctx.onUnauth && ctx.onUnauth();
        setNote("Couldn't reach the bot.", true);
      } finally { state.busy = false; }
    }

    async function runToggle() {
      if (state.busy || !state.form.id) return;
      var btn = root.document.getElementById("cx-toggle");
      var next = !(btn && btn.getAttribute("data-on") === "1");
      var typed = readControl("cx-key");
      state.busy = true;
      setNote(next ? "Enabling…" : "Pausing…", false);
      try {
        var r = await ctx.api(pathsFor(state.gid, state.form.id).toggle, {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({ guild_id: String(state.gid), enabled: next }),
        });
        var body = await readBody(r);
        if (r && r.status === 401) return ctx.onUnauth && ctx.onUnauth();
        if (!r || r.status === 404 || r.status === 501) { setNote("Connectors aren't on this bot yet.", true); return; }
        if (!r.ok || body.ok === false) { setNote(messageOf(body, "Couldn't update"), true); return; }
        var saved = savedConnector(body);
        if (saved) applyConnector(state, saved);
        else state.form.enabled = body.enabled != null ? truthy(body.enabled) : next;
        state.form.api_key = typed;
        if (body.status) state.form.status = statusOf({ status: body.status });
        paint();
        setNote(state.form.enabled ? "Enabled." : "Paused.", false);
      } catch (e) {
        if (e && e.unauth) return ctx.onUnauth && ctx.onUnauth();
        setNote("Couldn't reach the bot.", true);
      } finally { state.busy = false; }
    }

    async function removeConnector() {
      if (state.busy || !state.form.id) return;
      var ok = true;
      if (typeof ctx.confirm === "function") {
        ok = await ctx.confirm({
          title: "Remove this connector?",
          message: "Polling stops. Tips already posted stay.",
          confirmLabel: "Remove",
          destructive: true,
        });
      }
      if (!ok) return;
      state.busy = true;
      setNote("Removing…", false);
      try {
        var r = await ctx.api(pathsFor(state.gid, state.form.id).remove, { method: "DELETE" });
        var body = await readBody(r);
        if (r && r.status === 401) return ctx.onUnauth && ctx.onUnauth();
        if (!r || r.status === 404 || r.status === 501) { setNote("Connectors aren't on this bot yet.", true); return; }
        if (!r.ok || body.ok === false) { setNote(messageOf(body, "Couldn't remove"), true); return; }
        var gone = String(state.form.id);
        delete state.logs[gone];
        state.list = state.list.filter(function (c) { return c && String(c.id) !== gone; });
        state.form = state.list.length ? state.list[0] : blankForm();
        state.resultKind = "";
        state.resultBody = null;
        paint();
        setNote("Removed.", false);
      } catch (e) {
        if (e && e.unauth) return ctx.onUnauth && ctx.onUnauth();
        setNote("Couldn't reach the bot.", true);
      } finally { state.busy = false; }
    }

    async function load() {
      var mine = ++gen;
      el.innerHTML = '<div id="cx-root"><div class="empty">Loading connectors…</div></div>';
      try {
        var listed = ctx.api(pathsFor(state.gid).list);
        var chans = ctx.api("/api/channels?guild_id=" + enc(state.gid));
        var pair = await Promise.all([listed, chans]);
        if (mine !== gen) return;
        var lr = pair[0], cr = pair[1];
        if (lr && lr.status === 401) return ctx.onUnauth && ctx.onUnauth();
        var body = await readBody(lr);
        var chBody = cr && cr.ok ? await readBody(cr) : {};
        if (mine !== gen) return;
        state.channels = channelsFrom(chBody);
        if (!lr || lr.status === 404 || lr.status === 501) {
          state.list = [];
          state.form = blankForm();
          paint();
          setNote("Connectors aren't on this bot yet.", true);
          return;
        }
        if (!lr.ok || body.ok === false) {
          state.list = [];
          state.form = blankForm();
          paint();
          setNote(messageOf(body, "Couldn't load connectors"), true);
          return;
        }
        state.list = listFrom(body).map(formFrom).filter(function (c) { return c.id; });
        state.form = state.list.length ? state.list[0] : blankForm();
        state.form.api_key = "";
        paint();
      } catch (e) {
        if (mine !== gen) return;
        if (e && e.unauth) return ctx.onUnauth && ctx.onUnauth();
        el.innerHTML = '<div id="cx-root"><div class="empty">Couldn\'t reach the bot.</div></div>';
      }
    }

    armWatch();
    load();
    return { reload: load };
  }

  var API = {
    DEFAULT_ENDPOINT: DEFAULT_ENDPOINT,
    DEFAULT_LABEL: DEFAULT_LABEL,
    pathsFor: pathsFor,
    blankForm: blankForm,
    formFrom: formFrom,
    listFrom: listFrom,
    payload: payload,
    postMode: postMode,
    postModeLabel: postModeLabel,
    keyNote: keyNote,
    tipLine: tipLine,
    POLL_MS: POLL_MS,
    PAGE_LIMIT: PAGE_LIMIT,
    formatLine: formatLine,
    clockOf: clockOf,
    tagOf: tagOf,
    bucketOf: bucketOf,
    toneOf: toneOf,
    parseSse: parseSse,
    mergeEvents: mergeEvents,
    eventsFrom: eventsFrom,
    normalizeEvent: normalizeEvent,
    stickToEnd: stickToEnd,
    boardsHtml: boardsHtml,
    testView: testView,
    embedsFrom: embedsFrom,
    channelsFrom: channelsFrom,
    statusHtml: statusHtml,
    resultHtml: resultHtml,
    mount: mount,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  root.TBConnectors = API;
})(typeof window !== "undefined" ? window : globalThis);
