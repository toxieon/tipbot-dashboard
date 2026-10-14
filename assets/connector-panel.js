/* Generic connector stats, failure alerts, and the JSON feed editor.
   The client-specific panel is not in this file. It is served by the bot.

   Calls (owner session, guild_id on every request):
     GET  /api/connectors?guild_id=
     POST /api/connectors?guild_id=                         create, always paused
     POST /api/connectors/{id}?guild_id=                    update, does not send enabled
     DELETE /api/connectors?guild_id=&id=
     GET  /api/connectors/{id}/stats?guild_id=&period=      day | week | month | all
     POST /api/connectors/{id}/dry-run?guild_id=            preview, posts nothing

   Stats body this panel reads (flat, or nested under stats):
     wins, losses, voids, strike_rate (0–1, or a percent above 1),
     profit_units, roi (same scale as strike_rate), average_odds,
     confidence[] {label, wins, losses, voids, strike_rate, profit_units},
     mismatches (count) and mismatch_items[] {summary, client, ours},
     best / worst {summary, odds, profit_units, result}.

   Alert fields sent on update, and read back from the connector:
     alerts_enabled, alert_failure_threshold, alert_quiet_minutes.
   Until the bot stores them, the form starts at off, 3 failures, 60 minutes.

   JSON feeds use type "json" and send:
     endpoint_url, auth_style (bearer | x-api-key | query), api_key (only when typed),
     cursor_param, field_map (JSONPath per field).
   Dry run repeats the unsaved endpoint, auth style, cursor param, field map,
   and a typed key, so the preview matches the editor. Nothing is posted.
*/
(function (root) {
  "use strict";

  var PERIODS = [
    { id: "day", label: "Day" },
    { id: "week", label: "Week" },
    { id: "month", label: "Month" },
    { id: "all", label: "All time" },
  ];
  var FIELDS = [
    { key: "tips", label: "Tips list", placeholder: "$.tips" },
    { key: "next_cursor", label: "Next cursor", placeholder: "$.next_since" },
    { key: "external_id", label: "Tip id", placeholder: "$.id" },
    { key: "event", label: "Event", placeholder: "$.event" },
    { key: "selection", label: "Selection", placeholder: "$.selection" },
    { key: "market", label: "Market", placeholder: "$.market" },
    { key: "odds", label: "Odds", placeholder: "$.odds" },
    { key: "units", label: "Stake (units)", placeholder: "$.units" },
    { key: "bookie", label: "Bookie", placeholder: "$.bookie" },
    { key: "confidence", label: "Confidence", placeholder: "$.confidence" },
    { key: "event_start", label: "Start time", placeholder: "$.event_start" },
    { key: "sport", label: "Sport", placeholder: "$.sport" },
    { key: "status", label: "Status", placeholder: "$.status" },
  ];
  var AUTH = [
    { id: "bearer", label: "Bearer token" },
    { id: "x-api-key", label: "X-API-Key header" },
    { id: "query", label: "Query parameter" },
  ];
  var PREVIEW_MS = 400;

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function enc(v) { return encodeURIComponent(v == null ? "" : String(v)); }

  function truthy(v) { return v === true || v === 1 || v === "1" || v === "true"; }

  function num(v, fallback) {
    var n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function pick(obj, keys) {
    if (!obj || typeof obj !== "object") return undefined;
    for (var i = 0; i < keys.length; i++) {
      if (obj[keys[i]] != null && obj[keys[i]] !== "") return obj[keys[i]];
    }
    return undefined;
  }

  function clampInt(v, min, max, fallback) {
    var n = parseInt(v, 10);
    if (!Number.isFinite(n)) return fallback;
    if (n < min) return min;
    if (n > max) return max;
    return n;
  }

  function isJsonType(t) {
    var s = String(t || "").toLowerCase().replace(/[\s_-]/g, "");
    return s === "json" || s === "genericjson";
  }

  function blankMap() {
    var map = {};
    FIELDS.forEach(function (f) { map[f.key] = f.placeholder; });
    return map;
  }

  function mapFrom(c) {
    var raw = c && (c.field_map || c.fieldMap || c.paths);
    var known = !!(raw && typeof raw === "object");
    var map = known ? {} : blankMap();
    if (!known) return map;
    FIELDS.forEach(function (f) {
      map[f.key] = raw[f.key] == null ? "" : String(raw[f.key]);
    });
    return map;
  }

  function alertsFrom(c) {
    var nested = c && c.alerts && typeof c.alerts === "object" ? c.alerts : {};
    var enabled = pick(c, ["alerts_enabled", "alert_enabled"]);
    if (enabled == null) enabled = nested.enabled;
    var threshold = pick(c, ["alert_failure_threshold"]);
    if (threshold == null) threshold = pick(nested, ["failure_threshold", "threshold"]);
    var quiet = pick(c, ["alert_quiet_minutes"]);
    if (quiet == null) quiet = pick(nested, ["quiet_minutes", "quiet_window_minutes"]);
    if (quiet == null) {
      var secs = pick(c, ["alert_quiet_window_seconds"]);
      if (secs == null) secs = nested.quiet_window_seconds;
      if (secs != null && secs !== "") quiet = Math.round(Number(secs) / 60);
    }
    return {
      enabled: truthy(enabled),
      failure_threshold: clampInt(threshold, 1, 50, 3),
      quiet_minutes: clampInt(quiet, 0, 10080, 60),
    };
  }

  function listFrom(body) {
    if (!body || typeof body !== "object") return [];
    if (Array.isArray(body.connectors)) return body.connectors.filter(Boolean);
    if (body.connector && typeof body.connector === "object") return [body.connector];
    if (body.id && (body.type || body.endpoint_url || body.endpoint)) return [body];
    return [];
  }

  function gidOf(gid) { return String(gid == null ? "" : gid); }

  function statsPath(gid, id, period) {
    return "/api/connectors/" + enc(id) + "/stats?guild_id=" + enc(gid) + "&period=" + enc(period || "day");
  }

  function listPath(gid) { return "/api/connectors?guild_id=" + enc(gid); }

  function savePath(gid, id) {
    return id ? ("/api/connectors/" + enc(id) + "?guild_id=" + enc(gid)) : listPath(gid);
  }

  function dryPath(gid, id) {
    return "/api/connectors/" + enc(id) + "/dry-run?guild_id=" + enc(gid);
  }

  function removePath(gid, id) {
    return "/api/connectors?guild_id=" + enc(gid) + "&id=" + enc(id);
  }

  function pct(v) {
    if (v == null || v === "") return "—";
    var n = Number(v);
    if (!Number.isFinite(n)) return "—";
    if (Math.abs(n) <= 1) n = n * 100;
    var rounded = Math.round(n * 10) / 10;
    var text = String(rounded);
    if (text.indexOf(".") >= 0) text = text.replace(/0+$/, "").replace(/\.$/, "");
    return text + "%";
  }

  function unitsText(v) {
    if (v == null || v === "") return "—";
    var n = Number(v);
    if (!Number.isFinite(n)) return "—";
    var rounded = Math.round(n * 100) / 100;
    var text = String(rounded);
    if (text.indexOf(".") >= 0) text = text.replace(/0+$/, "").replace(/\.$/, "");
    if (rounded > 0) return "+" + text + "u";
    return text + "u";
  }

  function oddsText(v) {
    if (v == null || v === "") return "—";
    var n = Number(v);
    if (!Number.isFinite(n)) return String(v);
    return n.toFixed(2);
  }

  function unitClass(v) {
    var n = Number(v);
    if (!Number.isFinite(n) || n === 0) return "";
    return n > 0 ? " cpx-up" : " cpx-down";
  }

  function selectionText(sel) {
    if (sel == null || sel === "") return "";
    if (typeof sel !== "object") return String(sel);
    var num = sel.number != null && sel.number !== "" ? ("#" + sel.number) : "";
    return [num, sel.name || ""].filter(Boolean).join(" ");
  }

  function tipSummary(t) {
    if (t == null) return "";
    if (typeof t === "string") return t;
    if (typeof t !== "object") return "";
    var direct = pick(t, ["summary", "label", "line", "text"]);
    if (direct && typeof direct !== "object") return String(direct);
    var bits = [
      t.game || t.event || t.event_name || "",
      selectionText(t.selection || t.runner),
      t.bet_type || t.market || "",
      t.odds != null && t.odds !== "" ? ("@" + oddsText(t.odds)) : "",
    ];
    return bits.filter(Boolean).join(" · ");
  }

  function confLabel(row, fallback) {
    if (!row || typeof row !== "object") return fallback || "";
    var label = pick(row, ["label", "rating", "name", "bucket"]);
    return label == null ? (fallback || "") : String(label);
  }

  function confidenceRows(raw) {
    var list = [];
    if (Array.isArray(raw)) list = raw;
    else if (raw && typeof raw === "object") {
      list = Object.keys(raw).map(function (k) {
        var row = raw[k] && typeof raw[k] === "object" ? Object.assign({ label: k }, raw[k]) : { label: k };
        return row;
      });
    }
    return list.map(function (row) {
      if (!row || typeof row !== "object") return null;
      var wins = num(pick(row, ["wins", "won"]), 0);
      var losses = num(pick(row, ["losses", "lost"]), 0);
      var voids = num(pick(row, ["voids", "void", "voided"]), 0);
      var strike = pick(row, ["strike_rate", "strike", "win_rate"]);
      if (strike == null) {
        var decided = wins + losses;
        strike = decided ? wins / decided : 0;
      }
      return {
        label: confLabel(row, "—") || "—",
        wins: wins,
        losses: losses,
        voids: voids,
        strike_rate: strike,
        profit_units: num(pick(row, ["profit_units", "pnl", "profit"]), 0),
      };
    }).filter(Boolean);
  }

  function tipOf(v) {
    if (!v || typeof v !== "object") return null;
    var summary = tipSummary(v);
    if (!summary) return null;
    return {
      summary: summary,
      odds: pick(v, ["odds", "price"]),
      profit_units: pick(v, ["profit_units", "units", "pnl"]),
      result: pick(v, ["result", "outcome"]) || "",
    };
  }

  function normalizeStats(body) {
    var src = body && typeof body === "object" ? body : {};
    if (src.stats && typeof src.stats === "object" && !Array.isArray(src.stats)) {
      src = Object.assign({}, src, src.stats);
    }
    var wins = num(pick(src, ["wins", "won", "w"]), 0);
    var losses = num(pick(src, ["losses", "lost", "l"]), 0);
    var voids = num(pick(src, ["voids", "void", "voided"]), 0);
    var strike = pick(src, ["strike_rate", "strike", "win_rate"]);
    if (strike == null) {
      var decided = wins + losses;
      strike = decided ? wins / decided : 0;
    }
    var profit = num(pick(src, ["profit_units", "pnl", "profit"]), 0);
    var staked = pick(src, ["staked_units", "staked"]);
    var roi = pick(src, ["roi"]);
    if (roi == null && staked != null && Number(staked) > 0) roi = profit / Number(staked);
    if (roi == null || roi === "") roi = 0;
    var rawM = pick(src, ["mismatches", "mismatch_count", "grade_mismatches"]);
    var items = pick(src, ["mismatch_items", "mismatch_list"]);
    if (Array.isArray(rawM)) {
      items = rawM;
      rawM = rawM.length;
    }
    if (!Array.isArray(items)) items = [];
    return {
      period: pick(src, ["period"]) || "",
      wins: wins,
      losses: losses,
      voids: voids,
      strike_rate: strike,
      profit_units: profit,
      roi: roi,
      average_odds: pick(src, ["average_odds", "avg_odds", "mean_odds"]),
      confidence: confidenceRows(pick(src, ["confidence", "confidence_breakdown", "by_confidence"])),
      mismatches: num(rawM, items.length),
      mismatch_items: items.map(function (item) {
        if (!item || typeof item !== "object") return null;
        return {
          summary: tipSummary(item) || String(pick(item, ["summary", "label"]) || ""),
          client: pick(item, ["client", "client_result", "theirs"]) || "",
          ours: pick(item, ["ours", "tipbot", "our_result"]) || "",
        };
      }).filter(function (item) { return item && (item.summary || item.client || item.ours); }),
      best: tipOf(pick(src, ["best", "best_tip"])),
      worst: tipOf(pick(src, ["worst", "worst_tip"])),
    };
  }

  function recordLine(w, l, v) {
    return String(w) + " W · " + String(l) + " L · " + String(v) + (Number(v) === 1 ? " void" : " voids");
  }

  function tipBlock(title, tip) {
    if (!tip) {
      return '<div class="cpx-row"><span class="cpx-k">' + esc(title) + '</span><span>None in this window.</span></div>';
    }
    var bits = [esc(tip.summary)];
    if (tip.odds != null && tip.odds !== "") bits.push("@" + esc(oddsText(tip.odds)));
    var profit = tip.profit_units;
    return '<div class="cpx-row"><span class="cpx-k">' + esc(title) + "</span><span>" + bits.join(" · ") + '</span><b class="' + unitClass(profit).trim() + '">' + esc(unitsText(profit)) + "</b></div>";
  }

  function statsBodyHtml(model) {
    if (!model) return '<div class="empty">Loading stats…</div>';
    if (model.error) return '<div class="empty">' + esc(model.error) + "</div>";
    var conf = model.confidence || [];
    var confHtml = conf.length
      ? conf.map(function (row) {
        return '<div class="cpx-row"><b>' + esc(row.label) + "</b><span>" + esc(recordLine(row.wins, row.losses, row.voids)) + "</span><span>" + esc(pct(row.strike_rate)) + '</span><b class="' + unitClass(row.profit_units).trim() + '">' + esc(unitsText(row.profit_units)) + "</b></div>";
      }).join("")
      : '<div class="empty">No confidence split in this window.</div>';
    var items = model.mismatch_items || [];
    var mismatchHtml = '<div class="cpx-row"><span class="cpx-k">Mismatches</span><b>' + esc(String(model.mismatches || 0)) + "</b></div>";
    mismatchHtml += items.slice(0, 3).map(function (item) {
      var sides = [];
      if (item.client) sides.push("client " + item.client);
      if (item.ours) sides.push("ours " + item.ours);
      var line = [item.summary, sides.join(" · ")].filter(Boolean).join(" · ");
      return '<div class="cpx-tip">' + esc(line) + "</div>";
    }).join("");
    return '<div class="cpx-metrics">'
      + '<div class="cpx-metric cpx-wide"><span>W / L / void</span><b>' + esc(recordLine(model.wins, model.losses, model.voids)) + "</b></div>"
      + '<div class="cpx-metric"><span>Strike rate</span><b>' + esc(pct(model.strike_rate)) + "</b></div>"
      + '<div class="cpx-metric"><span>P/L</span><b class="' + unitClass(model.profit_units).trim() + '">' + esc(unitsText(model.profit_units)) + "</b></div>"
      + '<div class="cpx-metric"><span>ROI</span><b class="' + unitClass(model.roi).trim() + '">' + esc(pct(model.roi)) + "</b></div>"
      + '<div class="cpx-metric"><span>Average odds</span><b>' + esc(oddsText(model.average_odds)) + "</b></div>"
      + "</div>"
      + "<h4>Confidence</h4>" + confHtml
      + "<h4>Mismatches</h4>" + mismatchHtml
      + "<h4>Best and worst</h4>" + tipBlock("Best", model.best) + tipBlock("Worst", model.worst);
  }

  function alertPayload(alerts, gid) {
    alerts = alerts || {};
    return {
      guild_id: gidOf(gid),
      alerts_enabled: !!alerts.enabled,
      alert_failure_threshold: clampInt(alerts.failure_threshold, 1, 50, 3),
      alert_quiet_minutes: clampInt(alerts.quiet_minutes, 0, 10080, 60),
    };
  }

  function cleanMap(map) {
    var out = {};
    FIELDS.forEach(function (f) {
      var v = map && map[f.key] != null ? String(map[f.key]).trim() : "";
      out[f.key] = v;
    });
    return out;
  }

  function validateJson(form) {
    form = form || {};
    var problems = [];
    var endpoint = String(form.endpoint_url || "").trim();
    if (!/^https:\/\/\S+$/i.test(endpoint)) problems.push("Endpoint must be an https URL.");
    var auth = String(form.auth_style || "");
    if (!AUTH.some(function (a) { return a.id === auth; })) problems.push("Choose an auth style.");
    if (!form.id && !String(form.api_key || "").trim()) problems.push("A key is required to save a new feed.");
    var cursor = String(form.cursor_param || "").trim();
    if (!/^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(cursor)) problems.push("Cursor parameter must be a short name, such as since.");
    var poll = parseInt(form.poll_interval_seconds, 10);
    if (!Number.isFinite(poll) || poll < 15 || poll > 86400) problems.push("Poll interval must be between 15 and 86400 seconds.");
    var map = form.field_map || {};
    FIELDS.forEach(function (f) {
      var v = map[f.key] == null ? "" : String(map[f.key]).trim();
      if (!v) return;
      if (v.charAt(0) !== "$" || v.length > 200 || /[\r\n<>]/.test(v)) problems.push(f.label + " needs a JSONPath starting with $.");
    });
    var mode = String(form.post_mode || "replace");
    if (mode !== "replace" && mode !== "alongside") problems.push("Post mode must be replace or alongside.");
    return problems;
  }

  function jsonPayload(form, gid) {
    form = form || {};
    var poll = parseInt(form.poll_interval_seconds, 10);
    var body = {
      guild_id: gidOf(gid),
      type: "json",
      endpoint_url: String(form.endpoint_url || "").trim(),
      auth_style: String(form.auth_style || "bearer"),
      cursor_param: String(form.cursor_param || "").trim(),
      field_map: cleanMap(form.field_map),
      channel_id: String(form.channel_id || "").trim() || null,
      tipster_name: String(form.tipster_name || "").trim() || "Feed",
      poll_interval_seconds: poll,
      post_mode: form.post_mode === "alongside" ? "alongside" : "replace",
      skip_past_events: !!form.skip_past_events,
    };
    if (form.id) body.id = String(form.id);
    var key = String(form.api_key || "").trim();
    if (key) body.api_key = key;
    return body;
  }

  function dryPayload(form, gid) {
    var body = jsonPayload(form, gid);
    delete body.type;
    delete body.channel_id;
    delete body.tipster_name;
    delete body.poll_interval_seconds;
    delete body.post_mode;
    delete body.skip_past_events;
    if (!body.api_key) delete body.api_key;
    return body;
  }

  function domId(id, key) {
    return "cpx-" + String(id == null ? "" : id).replace(/[^A-Za-z0-9_-]/g, "") + "-" + key;
  }

  function titleOf(c) {
    if (isJsonType(c && c.type)) return "Generic JSON";
    var name = c && (c.tipster_name || c.tipster_label);
    name = String(name == null ? "" : name).trim();
    return name || "Feed";
  }

  function enabledOf(c) {
    if (!c || typeof c !== "object") return false;
    if (Object.prototype.hasOwnProperty.call(c, "enabled")) return truthy(c.enabled);
    if (Object.prototype.hasOwnProperty.call(c, "paused")) return !truthy(c.paused);
    return false;
  }

  function fieldControl(id, key, label, control, hint) {
    var fid = domId(id, key);
    return '<label class="cpx-field" for="' + fid + '"><span>' + esc(label) + "</span>" + control + (hint ? '<span class="cpx-hint">' + esc(hint) + "</span>" : "") + "</label>";
  }

  function inputHtml(id, key, value, extra) {
    return '<input id="' + domId(id, key) + '" data-k="' + esc(key) + '" data-json-field="1" value="' + esc(value == null ? "" : value) + '"' + (extra || "") + ">";
  }

  function alertsHtml(id, alerts) {
    var on = !!(alerts && alerts.enabled);
    return '<form class="cpx-alerts" data-alerts="1" autocomplete="off">'
      + "<h4>Alerts</h4>"
      + '<div class="cpx-switch-row"><button type="button" class="cpx-switch" data-alert-on="1" role="switch" aria-checked="' + (on ? "true" : "false") + '" aria-label="Failure alerts">' + (on ? "On" : "Off") + "</button>"
      + "<span>Notify after repeated failed polls</span></div>"
      + fieldControl(id, "threshold", "Failure threshold", '<input id="' + domId(id, "threshold") + '" data-k="threshold" type="number" inputmode="numeric" min="1" max="50" step="1" value="' + esc(String(alerts.failure_threshold)) + '" aria-label="Failure threshold">', "Alert after this many failed polls in a row.")
      + fieldControl(id, "quiet", "Quiet window (minutes)", '<input id="' + domId(id, "quiet") + '" data-k="quiet" type="number" inputmode="numeric" min="0" max="10080" step="1" value="' + esc(String(alerts.quiet_minutes)) + '" aria-label="Quiet window in minutes">', "Wait this long after an alert before sending another.")
      + '<div class="cpx-actions"><button type="submit" class="btn" data-act="save-alerts">Save alerts</button></div>'
      + '<span class="cpx-msg" data-msg="alerts" role="status"></span>'
      + "</form>";
  }

  function jsonFormHtml(c) {
    var id = c && c.id ? String(c.id) : "new";
    var map = c && c.id ? mapFrom(c) : blankMap();
    var auth = (c && c.auth_style) || "bearer";
    var cursor = (c && (c.cursor_param || c.cursor)) || "since";
    var endpoint = (c && (c.endpoint_url || c.endpoint)) || "";
    var last4 = c && (c.api_key_last4 || "");
    var keyHint = last4 ? ("Saved key ends in " + last4 + ". Leave blank to keep it.") : "Write-only. It is never shown again.";
    var poll = c && c.poll_interval_seconds != null ? c.poll_interval_seconds : 60;
    var name = c && (c.tipster_name || c.tipster_label) || "";
    var channel = c && (c.channel_id || c.target_channel_id) || "";
    var mode = c && c.post_mode === "alongside" ? "alongside" : "replace";
    var skip = !c || c.skip_past_events !== false;
    var authOpts = AUTH.map(function (a) {
      return '<option value="' + a.id + '"' + (auth === a.id ? " selected" : "") + ">" + esc(a.label) + "</option>";
    }).join("");
    var paths = FIELDS.map(function (f) {
      return fieldControl(id, "path-" + f.key, f.label, '<input id="' + domId(id, "path-" + f.key) + '" data-path="' + f.key + '" data-json-field="1" spellcheck="false" autocomplete="off" value="' + esc(map[f.key] || "") + '" placeholder="' + esc(f.placeholder) + '" aria-label="' + esc(f.label) + ' JSONPath">');
    }).join("");
    var modeName = "cpx-mode-" + String(id).replace(/[^A-Za-z0-9_-]/g, "");
    return '<form class="cpx-json" data-json="1" autocomplete="off">'
      + "<h4>Generic JSON</h4>"
      + '<p class="cpx-hint">Map each field with a JSONPath. Dry run posts nothing.</p>'
      + fieldControl(id, "endpoint", "Endpoint", inputHtml(id, "endpoint", endpoint, ' type="url" inputmode="url" spellcheck="false" autocomplete="off" placeholder="https://" aria-label="Endpoint"'), "")
      + fieldControl(id, "auth_style", "Auth style", '<select id="' + domId(id, "auth_style") + '" data-k="auth_style" data-json-field="1" aria-label="Auth style">' + authOpts + "</select>")
      + fieldControl(id, "api_key", "Key", '<input id="' + domId(id, "api_key") + '" data-k="api_key" data-json-field="1" type="password" autocomplete="new-password" spellcheck="false" value="" placeholder="Write-only" aria-label="Key">', keyHint)
      + fieldControl(id, "cursor_param", "Cursor parameter", inputHtml(id, "cursor_param", cursor, ' spellcheck="false" autocomplete="off" aria-label="Cursor parameter"'), "Query name sent as the feed's since cursor.")
      + "<h4>Field map</h4>" + paths
      + "<h4>Posting</h4>"
      + fieldControl(id, "channel", "Channel id", inputHtml(id, "channel", channel, ' inputmode="numeric" autocomplete="off" aria-label="Channel id"'))
      + fieldControl(id, "tipster", "Tipster name", inputHtml(id, "tipster", name, ' maxlength="80" autocomplete="off" aria-label="Tipster name"'))
      + fieldControl(id, "poll", "Poll interval (seconds)", inputHtml(id, "poll", String(poll), ' type="number" inputmode="numeric" min="15" max="86400" step="1" aria-label="Poll interval in seconds"'))
      + '<div class="cpx-field"><span>Post mode</span><div role="radiogroup" aria-label="Post mode">'
      + '<label class="cpx-check"><input type="radio" name="' + modeName + '" data-k="post_mode" value="replace"' + (mode === "replace" ? " checked" : "") + "> Replace their posts</label>"
      + '<label class="cpx-check"><input type="radio" name="' + modeName + '" data-k="post_mode" value="alongside"' + (mode === "alongside" ? " checked" : "") + "> Post alongside</label>"
      + "</div></div>"
      + '<label class="cpx-check"><input id="' + domId(id, "skip") + '" data-k="skip" type="checkbox"' + (skip ? " checked" : "") + "> <span>Skip events that have already started</span></label>"
      + '<div class="cpx-actions"><button type="submit" class="btn" data-act="save-json">Save feed</button>'
      + (c && c.id ? '<button type="button" class="ghost" data-act="preview">Preview</button><button type="button" class="ghost" data-act="remove">Remove</button>' : "")
      + "</div>"
      + '<span class="cpx-msg" data-msg="json" role="status"></span>'
      + '<div class="cpx-preview" data-preview></div>'
      + "</form>";
  }

  function periodTabs(active) {
    return '<div class="tabs" role="tablist" aria-label="Stats period">' + PERIODS.map(function (p) {
      var on = p.id === active;
      return '<button type="button" class="tab' + (on ? " active" : "") + '" role="tab" data-period="' + p.id + '" aria-selected="' + (on ? "true" : "false") + '">' + esc(p.label) + "</button>";
    }).join("") + "</div>";
  }

  function cardHtml(c) {
    var id = String(c.id);
    var alerts = alertsFrom(c);
    var on = enabledOf(c);
    var sub = (on ? "On" : "Paused");
    if (c.api_key_last4) sub += " · key ends in " + c.api_key_last4;
    return '<section class="cpx-card" data-id="' + esc(id) + '">'
      + "<h3>" + esc(titleOf(c)) + "</h3>"
      + '<p class="cpx-sub">' + esc(sub) + "</p>"
      + '<div class="cpx-stats" data-stats="1"><h4>Stats</h4>' + periodTabs("day")
      + '<div class="cpx-stats-body" aria-live="polite">' + statsBodyHtml(null) + "</div></div>"
      + alertsHtml(id, alerts)
      + (isJsonType(c.type) ? jsonFormHtml(c) : "")
      + "</section>";
  }

  function newCardHtml() {
    return '<section class="cpx-card" data-id="new" hidden>' + jsonFormHtml(null) + "</section>";
  }

  function injectCss(doc) {
    if (!doc || doc.getElementById("cpx-style")) return;
    var style = doc.createElement("style");
    style.id = "cpx-style";
    style.textContent = [
      "#cpx{min-width:0;max-width:100%;margin-top:18px}",
      "#cpx *{box-sizing:border-box}",
      "#cpx .cpx-lead{margin:0 0 12px;color:var(--muted);font-size:var(--t-sub)}",
      "#cpx .cpx-card{border:1px solid var(--line);background:var(--card);border-radius:16px;padding:14px;margin:0 0 14px;min-width:0;max-width:100%}",
      "#cpx .cpx-card[hidden]{display:none}",
      "#cpx h3{margin:0 0 4px;font-size:var(--t-h3,1.15rem)}",
      "#cpx h4{margin:14px 0 8px;font-size:var(--t-callout,1rem)}",
      "#cpx .cpx-sub,#cpx .cpx-hint{color:var(--muted);font-size:var(--t-foot,12px);margin:0 0 8px;overflow-wrap:anywhere}",
      "#cpx .cpx-metrics{display:grid;grid-template-columns:1fr 1fr;gap:8px}",
      "#cpx .cpx-metric{background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:10px 12px;min-width:0}",
      "#cpx .cpx-metric span{display:block;color:var(--muted);font-size:var(--t-cap,12px)}",
      "#cpx .cpx-metric b{display:block;margin-top:2px;font-variant-numeric:tabular-nums;font-size:1.05rem;overflow-wrap:anywhere}",
      "#cpx .cpx-wide{grid-column:1 / -1}",
      "#cpx .cpx-up{color:var(--win)}",
      "#cpx .cpx-down{color:var(--loss)}",
      "#cpx .cpx-row{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:baseline;padding:8px 0;border-top:1px solid var(--line);font-size:var(--t-sub);min-width:0}",
      "#cpx .cpx-k{color:var(--muted)}",
      "#cpx .cpx-field{display:block;margin:0 0 10px;min-width:0}",
      "#cpx .cpx-field > span{display:block;color:var(--muted);font-size:var(--t-cap,12px);margin-bottom:4px}",
      "#cpx input,#cpx select{width:100%;max-width:100%;min-height:44px;font:inherit;font-size:16px;padding:8px 10px;border-radius:12px;border:1px solid var(--line);background:var(--card2);color:var(--txt)}",
      "#cpx .cpx-switch-row{display:flex;align-items:center;gap:10px;min-height:44px;margin:0 0 10px}",
      "#cpx .cpx-switch{min-height:44px;padding:0 16px;border-radius:999px;border:1px solid var(--line);background:var(--card2);color:var(--txt);font:inherit;font-weight:700}",
      "#cpx .cpx-switch[aria-checked=true]{background:var(--accent);border-color:var(--accent);color:var(--on-accent,#fff)}",
      "#cpx .cpx-check{display:flex;align-items:center;gap:10px;min-height:44px}",
      "#cpx .cpx-check input{width:22px;min-width:22px;height:22px;min-height:22px}",
      "#cpx .cpx-actions{display:flex;flex-direction:column;gap:8px}",
      "#cpx .cpx-actions .btn,#cpx .cpx-actions .ghost,#cpx > .ghost{width:100%}",
      "#cpx .cpx-msg{display:block;min-height:1.2em;margin-top:8px;font-size:var(--t-sub)}",
      "#cpx .cpx-tip{border:1px solid var(--line);border-radius:12px;padding:10px 12px;margin-top:8px;overflow-wrap:anywhere}",
      "#cpx .tabs{margin-bottom:10px}",
      "@media(min-width:480px){#cpx .cpx-actions{flex-direction:row;flex-wrap:wrap}#cpx .cpx-actions .btn,#cpx .cpx-actions .ghost{width:auto;flex:1 1 140px}#cpx > .ghost{width:auto}}",
    ].join("");
    doc.head.appendChild(style);
  }

  function previewHtml(body) {
    if (!body) return "";
    if (body.ok === false) {
      return '<p class="cpx-msg cpx-down">' + esc(body.message || body.error || "Preview failed") + '</p><p class="cpx-hint">Nothing was posted.</p>';
    }
    var tips = Array.isArray(body.preview) ? body.preview : [];
    var embeds = Array.isArray(body.embeds) ? body.embeds : [];
    var count = body.count != null && body.count !== "" ? body.count : tips.length;
    var html = '<p class="cpx-hint">' + esc(String(count)) + (Number(count) === 1 ? " tip. " : " tips. ") + "Nothing was posted.</p>";
    tips.slice(0, 3).forEach(function (t) {
      var line = tipSummary(t);
      if (line) html += '<div class="cpx-tip">' + esc(line) + "</div>";
    });
    embeds.slice(0, 3).forEach(function (em) {
      if (!em || typeof em !== "object") return;
      var author = em.author && (em.author.name || (typeof em.author === "string" ? em.author : ""));
      html += '<div class="cpx-tip">'
        + (author ? '<div class="cpx-hint">' + esc(author) + "</div>" : "")
        + (em.title ? "<b>" + esc(em.title) + "</b>" : "")
        + (em.description ? "<div>" + esc(em.description) + "</div>" : "")
        + "</div>";
    });
    if (!tips.length && !embeds.length) html += '<div class="empty">No preview returned.</div>';
    return html;
  }

  function messageOf(body, fallback) {
    if (body && (body.message || body.error)) return String(body.message || body.error);
    return fallback;
  }

  async function readBody(res) {
    try { return await res.json(); } catch (e) { return {}; }
  }

  function mount(el, ctx) {
    if (!el) return;
    ctx = ctx || {};
    if (typeof el._cpxStop === "function") el._cpxStop();
    var doc = el.ownerDocument || root.document;
    injectCss(doc);
    var stopped = false;
    var timers = {};
    var inflight = {};
    var stamps = {};
    var watch = null;
    var state = { list: [], note: "", noteErr: false };

    function alive() {
      return !stopped && el.isConnected !== false;
    }

    function teardown() {
      if (stopped) return;
      stopped = true;
      if (watch) clearInterval(watch);
      Object.keys(timers).forEach(function (id) { clearTimeout(timers[id]); });
      Object.keys(inflight).forEach(function (id) {
        try { if (inflight[id]) inflight[id].abort(); } catch (e) {}
      });
    }
    el._cpxStop = teardown;
    watch = setInterval(function () {
      if (el.isConnected === false) teardown();
    }, 1000);

    function cardEl(id) {
      var want = String(id);
      var nodes = el.querySelectorAll(".cpx-card");
      for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].getAttribute("data-id") === want) return nodes[i];
      }
      return null;
    }

    function setMsg(card, slot, text, isErr) {
      if (!card) return;
      var msg = card.querySelector('[data-msg="' + slot + '"]');
      if (!msg) return;
      msg.textContent = text || "";
      msg.classList.toggle("cpx-down", !!isErr);
      msg.classList.toggle("cpx-up", !!text && !isErr);
    }

    function paint() {
      if (!alive()) return;
      var cards = state.list.map(cardHtml).join("");
      el.innerHTML = '<div id="cpx">'
        + '<p class="cpx-lead">Stats and alerts for each feed. A generic JSON feed is edited here, including a dry run that posts nothing.</p>'
        + (cards || '<div class="empty">No feeds on this server yet.</div>')
        + '<button type="button" class="ghost" data-act="add">Add Generic JSON</button>'
        + newCardHtml()
        + '<span class="cpx-msg" data-msg="root" role="status"></span>'
        + "</div>";
      var rootMsg = el.querySelector('[data-msg="root"]');
      if (rootMsg && state.note) {
        rootMsg.textContent = state.note;
        rootMsg.classList.toggle("cpx-down", !!state.noteErr);
      }
      state.list.forEach(function (c) {
        if (c && c.id) loadStats(c.id, "day");
        if (c && c.id && isJsonType(c.type)) schedulePreview(c.id, 30);
      });
    }

    function unauth(r, err) {
      if ((r && r.status === 401) || (err && err.unauth)) {
        if (typeof ctx.onUnauth === "function") ctx.onUnauth();
        return true;
      }
      return false;
    }

    async function loadStats(id, period) {
      var token = (stamps[id] = (stamps[id] || 0) + 1);
      var card = cardEl(id);
      var bodyEl = card && card.querySelector(".cpx-stats-body");
      if (bodyEl) bodyEl.innerHTML = '<div class="empty">Loading stats…</div>';
      if (card) {
        card.querySelectorAll("[data-period]").forEach(function (btn) {
          var on = btn.getAttribute("data-period") === period;
          btn.classList.toggle("active", on);
          btn.setAttribute("aria-selected", on ? "true" : "false");
        });
      }
      try {
        var r = await ctx.api(statsPath(ctx.gid, id, period));
        if (!alive() || stamps[id] !== token) return;
        if (unauth(r)) return;
        var body = await readBody(r);
        if (!alive() || stamps[id] !== token) return;
        card = cardEl(id);
        bodyEl = card && card.querySelector(".cpx-stats-body");
        if (!bodyEl) return;
        if (!r || r.status === 404 || r.status === 501) {
          bodyEl.innerHTML = statsBodyHtml({ error: "Stats aren't available on this bot yet." });
          return;
        }
        if (!r.ok || body.ok === false) {
          bodyEl.innerHTML = statsBodyHtml({ error: messageOf(body, "Couldn't load stats.") });
          return;
        }
        bodyEl.innerHTML = statsBodyHtml(normalizeStats(body));
      } catch (err) {
        if (!alive() || stamps[id] !== token) return;
        if (unauth(null, err)) return;
        card = cardEl(id);
        bodyEl = card && card.querySelector(".cpx-stats-body");
        if (bodyEl) bodyEl.innerHTML = statsBodyHtml({ error: "Couldn't load stats." });
      }
    }

    function readAlerts(card) {
      var sw = card.querySelector("[data-alert-on]");
      var threshold = card.querySelector('[data-k="threshold"]');
      var quiet = card.querySelector('[data-k="quiet"]');
      return {
        enabled: !!(sw && sw.getAttribute("aria-checked") === "true"),
        failure_threshold: threshold ? threshold.value : "",
        quiet_minutes: quiet ? quiet.value : "",
      };
    }

    function readJson(card) {
      function val(key) {
        var node = card.querySelector('[data-k="' + key + '"]');
        return node ? node.value : "";
      }
      var map = {};
      FIELDS.forEach(function (f) {
        var node = card.querySelector('[data-path="' + f.key + '"]');
        map[f.key] = node ? node.value : "";
      });
      var picked = card.querySelector('[data-k="post_mode"]:checked');
      var skip = card.querySelector('[data-k="skip"]');
      var id = card.getAttribute("data-id");
      return {
        id: id === "new" ? "" : id,
        endpoint_url: val("endpoint"),
        auth_style: val("auth_style"),
        api_key: val("api_key"),
        cursor_param: val("cursor_param"),
        field_map: map,
        channel_id: val("channel"),
        tipster_name: val("tipster"),
        poll_interval_seconds: val("poll"),
        post_mode: picked ? picked.value : "replace",
        skip_past_events: !!(skip && skip.checked),
      };
    }

    function savedConnector(body) {
      if (!body) return null;
      if (body.connector && typeof body.connector === "object") return body.connector;
      var list = listFrom(body);
      if (list.length === 1) return list[0];
      if (body.id) return body;
      return null;
    }

    async function saveAlerts(card) {
      var id = card.getAttribute("data-id");
      var alerts = readAlerts(card);
      var threshold = parseInt(alerts.failure_threshold, 10);
      var quiet = parseInt(alerts.quiet_minutes, 10);
      if (!Number.isFinite(threshold) || threshold < 1 || threshold > 50) {
        setMsg(card, "alerts", "Failure threshold must be from 1 to 50.", true);
        return;
      }
      if (!Number.isFinite(quiet) || quiet < 0 || quiet > 10080) {
        setMsg(card, "alerts", "Quiet window must be from 0 to 10080 minutes.", true);
        return;
      }
      setMsg(card, "alerts", "Saving…", false);
      try {
        var r = await ctx.api(savePath(ctx.gid, id), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(alertPayload(alerts, ctx.gid)),
        });
        if (!alive()) return;
        if (unauth(r)) return;
        var body = await readBody(r);
        if (!r || r.status === 404 || r.status === 501) { setMsg(card, "alerts", "Alerts aren't on this bot yet.", true); return; }
        if (!r.ok || body.ok === false) { setMsg(card, "alerts", messageOf(body, "Couldn't save alerts."), true); return; }
        setMsg(card, "alerts", "Saved.", false);
      } catch (err) {
        if (unauth(null, err)) return;
        setMsg(card, "alerts", "Couldn't reach the bot.", true);
      }
    }

    async function saveJson(card) {
      var form = readJson(card);
      var problems = validateJson(form);
      if (problems.length) { setMsg(card, "json", problems[0], true); return; }
      setMsg(card, "json", "Saving…", false);
      try {
        var r = await ctx.api(savePath(ctx.gid, form.id), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(jsonPayload(form, ctx.gid)),
        });
        if (!alive()) return;
        if (unauth(r)) return;
        var body = await readBody(r);
        if (!r || r.status === 404 || r.status === 501) { setMsg(card, "json", "Connectors aren't on this bot yet.", true); return; }
        if (!r.ok || body.ok === false) { setMsg(card, "json", messageOf(body, "Couldn't save."), true); return; }
        state.note = form.id ? "Saved." : "Saved. It stays paused until you enable it.";
        state.noteErr = false;
        await load();
      } catch (err) {
        if (unauth(null, err)) return;
        setMsg(card, "json", "Couldn't reach the bot.", true);
      }
    }

    function schedulePreview(id, wait) {
      clearTimeout(timers[id]);
      timers[id] = setTimeout(function () { runPreview(id); }, wait == null ? PREVIEW_MS : wait);
    }

    async function runPreview(id) {
      if (!id || id === "new") return;
      var card = cardEl(id);
      if (!card) return;
      var form = readJson(card);
      var problems = validateJson(Object.assign({}, form, { api_key: form.api_key || "stored" }));
      var box = card.querySelector("[data-preview]");
      if (problems.length) {
        if (box) box.innerHTML = '<p class="cpx-msg cpx-down">' + esc(problems[0]) + "</p>";
        return;
      }
      if (box) box.innerHTML = '<p class="cpx-hint">Previewing…</p>';
      if (inflight[id]) { try { inflight[id].abort(); } catch (e) {} }
      var ac = typeof AbortController !== "undefined" ? new AbortController() : null;
      inflight[id] = ac;
      try {
        var r = await ctx.api(dryPath(ctx.gid, id), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dryPayload(form, ctx.gid)),
          signal: ac ? ac.signal : undefined,
        });
        if (!alive() || inflight[id] !== ac) return;
        if (unauth(r)) return;
        var body = await readBody(r);
        if (!alive() || inflight[id] !== ac) return;
        card = cardEl(id);
        box = card && card.querySelector("[data-preview]");
        if (!box) return;
        if (!r || r.status === 404 || r.status === 501) {
          box.innerHTML = '<p class="cpx-msg cpx-down">Dry run isn\'t on this bot yet.</p>';
          return;
        }
        if (!r.ok && !(body && body.ok === false)) {
          box.innerHTML = '<p class="cpx-msg cpx-down">' + esc(messageOf(body, "Couldn't preview.")) + "</p>";
          return;
        }
        box.innerHTML = previewHtml(body);
      } catch (err) {
        if (err && (err.name === "AbortError" || inflight[id] !== ac)) return;
        if (unauth(null, err)) return;
        card = cardEl(id);
        box = card && card.querySelector("[data-preview]");
        if (box) box.innerHTML = '<p class="cpx-msg cpx-down">Couldn\'t reach the bot.</p>';
      }
    }

    async function removeConnector(card) {
      var id = card.getAttribute("data-id");
      if (!id || id === "new") return;
      var ok = true;
      if (typeof ctx.confirm === "function") {
        ok = await ctx.confirm({
          title: "Remove this feed?",
          message: "Polling stops. Tips already posted stay.",
          confirmLabel: "Remove",
          destructive: true,
        });
      }
      if (!ok || !alive()) return;
      setMsg(card, "json", "Removing…", false);
      try {
        var r = await ctx.api(removePath(ctx.gid, id), { method: "DELETE" });
        if (!alive()) return;
        if (unauth(r)) return;
        var body = await readBody(r);
        if (!r || !r.ok || body.ok === false) { setMsg(card, "json", messageOf(body, "Couldn't remove."), true); return; }
        state.note = "Removed.";
        state.noteErr = false;
        await load();
      } catch (err) {
        if (unauth(null, err)) return;
        setMsg(card, "json", "Couldn't reach the bot.", true);
      }
    }

    function onClick(e) {
      var period = e.target.closest && e.target.closest("[data-period]");
      if (period && el.contains(period)) {
        var card = period.closest(".cpx-card");
        if (card) loadStats(card.getAttribute("data-id"), period.getAttribute("data-period"));
        return;
      }
      var sw = e.target.closest && e.target.closest("[data-alert-on]");
      if (sw && el.contains(sw)) {
        var next = sw.getAttribute("aria-checked") !== "true";
        sw.setAttribute("aria-checked", next ? "true" : "false");
        sw.textContent = next ? "On" : "Off";
        return;
      }
      var act = e.target.closest && e.target.closest("[data-act]");
      if (!act || !el.contains(act)) return;
      var name = act.getAttribute("data-act");
      var host = act.closest(".cpx-card");
      if (name === "add") {
        var fresh = cardEl("new");
        if (fresh) {
          fresh.hidden = false;
          var endpoint = fresh.querySelector('[data-k="endpoint"]');
          if (endpoint && endpoint.focus) endpoint.focus();
        }
        return;
      }
      if (!host) return;
      if (name === "preview") runPreview(host.getAttribute("data-id"));
      if (name === "remove") removeConnector(host);
    }

    function onSubmit(e) {
      var form = e.target;
      if (!form || !el.contains(form)) return;
      e.preventDefault();
      var card = form.closest(".cpx-card");
      if (!card) return;
      if (form.hasAttribute("data-alerts")) saveAlerts(card);
      if (form.hasAttribute("data-json")) saveJson(card);
    }

    function onInput(e) {
      var node = e.target;
      if (!node || !node.closest || !el.contains(node)) return;
      if (!node.hasAttribute("data-json-field") && !node.hasAttribute("data-path")) return;
      var card = node.closest(".cpx-card");
      if (!card) return;
      var id = card.getAttribute("data-id");
      if (!id || id === "new") return;
      schedulePreview(id);
    }

    el.addEventListener("click", onClick);
    el.addEventListener("submit", onSubmit);
    el.addEventListener("input", onInput);
    el.addEventListener("change", onInput);

    async function load() {
      el.innerHTML = '<div id="cpx"><div class="empty">Loading…</div></div>';
      try {
        var r = await ctx.api(listPath(ctx.gid));
        if (!alive()) return;
        if (unauth(r)) return;
        var body = await readBody(r);
        if (!alive()) return;
        if (!r || r.status === 404 || r.status === 501) {
          state.list = [];
          state.note = "Connectors aren't on this bot yet.";
          state.noteErr = true;
          paint();
          return;
        }
        if (!r.ok || body.ok === false) {
          state.list = [];
          state.note = messageOf(body, "Couldn't load connectors.");
          state.noteErr = true;
          paint();
          return;
        }
        state.list = listFrom(body).filter(function (c) { return c && c.id != null && c.id !== ""; });
        paint();
      } catch (err) {
        if (!alive()) return;
        if (unauth(null, err)) return;
        el.innerHTML = '<div id="cpx"><div class="empty">Couldn\'t reach the bot.</div></div>';
      }
    }

    load();
    return { reload: load, stop: teardown };
  }

  var API = {
    PERIODS: PERIODS,
    FIELDS: FIELDS,
    PREVIEW_MS: PREVIEW_MS,
    statsPath: statsPath,
    alertPayload: alertPayload,
    jsonPayload: jsonPayload,
    dryPayload: dryPayload,
    validateJson: validateJson,
    normalizeStats: normalizeStats,
    statsBodyHtml: statsBodyHtml,
    listFrom: listFrom,
    alertsFrom: alertsFrom,
    isJsonType: isJsonType,
    pct: pct,
    unitsText: unitsText,
    tipSummary: tipSummary,
    previewHtml: previewHtml,
    mount: mount,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  root.TBConnectorPanel = API;
})(typeof window !== "undefined" ? window : globalThis);
