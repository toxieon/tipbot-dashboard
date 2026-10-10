/* Horses under Stats: placings for the last two days from GET /api/racing/results.
 * A 404 means the endpoint is not on this TipBot yet. window.TBHorseResults + CommonJS.
 */
(function (root) {
  "use strict";

  var REFRESH_MS = 180000;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function clock() {
    if (root.TBTime && typeof root.TBTime.dayKey === "function") return root.TBTime;
    if (typeof require === "function") {
      try { return require("./tbtime.js"); } catch (e) {}
    }
    return null;
  }
  function racingLegs() {
    if (root.TBRacingLegs && typeof root.TBRacingLegs.silkChipHtml === "function") return root.TBRacingLegs;
    if (typeof require === "function") {
      try { return require("./racing-legs.js"); } catch (e2) {}
    }
    return null;
  }
  function reducedMotion() {
    if (root.TBMotion && typeof root.TBMotion.reduced === "function") return !!root.TBMotion.reduced();
    try { return !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; }
  }
  function str(v) {
    return v == null ? "" : String(v).trim();
  }
  function trackNorm(s) {
    return str(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }
  function startMs(v) {
    var T = clock();
    if (T && typeof T.toMs === "function") {
      var ms = T.toMs(v);
      if (isFinite(ms)) return ms;
    }
    var p = Date.parse(str(v));
    return isFinite(p) ? p : 0;
  }
  function prevDay(day) {
    var p = String(day || "").split("-");
    if (p.length !== 3) return "";
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    if (!isFinite(d.getTime())) return "";
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  }
  function todayKey(nowMs) {
    var T = clock();
    var now = Number.isFinite(nowMs) ? nowMs : Date.now();
    if (T && typeof T.dayKey === "function") return T.dayKey(now);
    return new Date(now).toISOString().slice(0, 10);
  }
  function windowDays(nowMs) {
    var today = todayKey(nowMs);
    return { today: today, yesterday: prevDay(today) };
  }
  function inWindow(date, nowMs) {
    if (!date) return false;
    var w = windowDays(nowMs);
    return date === w.today || date === w.yesterday;
  }
  function isGreyhound(raw) {
    var c = str(raw && (raw.category || raw.code)).toUpperCase();
    return c === "G" || c === "GREYHOUND" || c === "GREYHOUNDS";
  }
  function isMajor(track) {
    var R = racingLegs();
    if (R && typeof R.trackKey === "function") return !!R.trackKey(track);
    return false;
  }
  function ordinal(n) {
    var v = Math.abs(n) % 100;
    var suf = "th";
    if (v < 11 || v > 13) {
      var d = v % 10;
      if (d === 1) suf = "st";
      else if (d === 2) suf = "nd";
      else if (d === 3) suf = "rd";
    }
    return n + suf;
  }
  function fmtPrice(v) {
    var n = Number(v);
    if (!isFinite(n) || n <= 0) return "—";
    return (Math.round(n * 100) / 100).toFixed(2);
  }
  function fmtMargin(v) {
    if (v == null || v === "") return "—";
    if (typeof v === "number") {
      if (!isFinite(v) || v === 0) return "—";
      return String(Math.round(v * 100) / 100) + "L";
    }
    var t = str(v);
    if (!t || /^0+(\.0+)?$/.test(t)) return "—";
    if (/[a-z]/i.test(t)) return t;
    var n = Number(t);
    if (isFinite(n)) {
      if (n === 0) return "—";
      return String(Math.round(n * 100) / 100) + "L";
    }
    return t;
  }
  function fmtDistance(v) {
    if (v == null || v === "") return "";
    var t = str(v);
    if (/^\d+(\.\d+)?$/.test(t)) return t + "m";
    return t;
  }
  function fmtStart(v) {
    var T = clock();
    if (!v || !T || typeof T.fmt !== "function") return "";
    return T.fmt(v, { hour: "numeric", minute: "2-digit" }) || "";
  }
  function fmtDay(date, nowMs) {
    if (!date) return "";
    var T = clock();
    if (T && typeof T.relDay === "function") {
      var rel = T.relDay(date + "T00:00:00Z", nowMs);
      if (rel === "today") return "Today";
      if (rel === "yesterday") return "Yesterday";
    }
    if (T && typeof T.fmt === "function") {
      var pretty = T.fmt(date + "T00:00:00Z", { weekday: "short", day: "numeric", month: "short" });
      if (pretty) return pretty;
    }
    return date;
  }
  function openingWin(rn) {
    if (!rn) return null;
    if (rn.opening_win_price != null && rn.opening_win_price !== "") return rn.opening_win_price;
    if (rn.opening_win != null && rn.opening_win !== "") return rn.opening_win;
    if (rn.openingWin != null && rn.openingWin !== "") return rn.openingWin;
    if (rn.open_win != null && rn.open_win !== "") return rn.open_win;
    var R = racingLegs();
    if (R && typeof R.openingWin === "function") return R.openingWin(rn);
    var f = rn.fixed && rn.fixed.win;
    return f != null ? f : null;
  }
  function positionOf(rn) {
    if (!rn) return null;
    var raw = rn.position != null ? rn.position : (rn.finish_position != null ? rn.finish_position : rn.placing);
    if (raw == null || raw === "") return null;
    if (typeof raw === "string" && /^(scr|scratched)$/i.test(raw.trim())) return null;
    var n = Number(raw);
    return isFinite(n) && n > 0 ? n : null;
  }
  function scratchedOf(rn) {
    if (!rn) return false;
    if (rn.scratched === true || rn.scratch === true) return true;
    var raw = rn.position != null ? rn.position : rn.finish_position;
    return typeof raw === "string" && /^(scr|scratched)$/i.test(raw.trim());
  }
  function horseName(rn) {
    return str(rn.horse_name || rn.horse || rn.name || rn.runner_name);
  }
  function silkChip(rn) {
    var R = racingLegs();
    if (R && typeof R.silkChipHtml === "function") return R.silkChipHtml(rn);
    var num = rn && rn.number != null ? String(rn.number) : "?";
    return '<span class="silk"><b>' + esc(num) + "</b></span>";
  }

  function normRunner(raw) {
    if (!raw || typeof raw !== "object") return null;
    var scratched = scratchedOf(raw);
    var position = scratched ? null : positionOf(raw);
    return {
      position: position,
      name: horseName(raw),
      number: raw.number != null ? raw.number : raw.runner_number,
      barrier: raw.barrier != null ? raw.barrier : raw.barrier_number,
      jockey: str(raw.jockey || raw.jockey_or_driver || raw.driver),
      trainer: str(raw.trainer),
      openingWin: openingWin(raw),
      margin: raw.margin != null ? raw.margin : raw.beaten_margin,
      silk_url: raw.silk_url || "",
      colours: raw.colours != null ? raw.colours : raw.colors,
      scratched: scratched
    };
  }
  function runnerRank(r) {
    var num = Number(r.number);
    var tie = isFinite(num) ? num : 0;
    if (r.scratched) return 10000 + tie;
    if (r.position == null) return 5000 + tie;
    return r.position * 100 + tie / 100;
  }
  function normRace(raw) {
    if (!raw || typeof raw !== "object" || isGreyhound(raw)) return null;
    var runners = [];
    (raw.runners || raw.results || []).forEach(function (rn) {
      var n = normRunner(rn);
      if (n && (n.name || n.number != null)) runners.push(n);
    });
    runners.sort(function (a, b) { return runnerRank(a) - runnerRank(b); });
    var number = raw.number != null ? raw.number : raw.race_number;
    var start = raw.start_time || raw.startTime || raw.start || raw.advertised_start || "";
    return {
      number: number,
      name: str(raw.name || raw.race_name),
      distance: raw.distance,
      start: start,
      startMs: startMs(start),
      condition: str(raw.condition || raw.track_condition),
      runners: runners
    };
  }
  function meetingDate(raw, races) {
    var direct = str(raw.date || raw.meeting_date || raw.race_date);
    var day = direct.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(day)) return day;
    var T = clock();
    var best = 0;
    races.forEach(function (r) { if (r.startMs > best) best = r.startMs; });
    if (best && T && typeof T.dayKey === "function") return T.dayKey(best);
    return "";
  }
  function normMeeting(raw) {
    if (!raw || typeof raw !== "object" || isGreyhound(raw)) return null;
    var races = [];
    (raw.races || raw.events || []).forEach(function (r) {
      var n = normRace(r);
      if (n) races.push(n);
    });
    races.sort(function (a, b) {
      var na = Number(a.number), nb = Number(b.number);
      if (isFinite(na) && isFinite(nb) && na !== nb) return na - nb;
      return a.startMs - b.startMs;
    });
    if (!races.length) return null;
    var track = str(raw.track || raw.track_name || raw.venue || raw.name || raw.meeting);
    if (!track) return null;
    var date = meetingDate(raw, races);
    var latest = 0;
    races.forEach(function (r) { if (r.startMs > latest) latest = r.startMs; });
    var key = trackNorm(track) + "|" + date;
    return {
      key: key,
      track: track,
      trackKey: trackNorm(track),
      state: str(raw.state || raw.region).toUpperCase(),
      date: date,
      major: isMajor(track),
      latest: latest,
      races: races
    };
  }
  function meetingsOf(body) {
    if (!body) return [];
    if (Array.isArray(body)) return body;
    if (Array.isArray(body.meetings)) return body.meetings;
    if (body.data && Array.isArray(body.data.meetings)) return body.data.meetings;
    return [];
  }
  function parseMeetings(body) {
    var out = [];
    var seen = {};
    meetingsOf(body).forEach(function (raw) {
      var m = normMeeting(raw);
      if (!m) return;
      if (seen[m.key]) {
        out = out.map(function (cur) { return cur.key === m.key ? mergeOne(cur, m) : cur; });
        return;
      }
      seen[m.key] = true;
      out.push(m);
    });
    return out;
  }
  function mergeOne(prev, incoming) {
    var races = {};
    var order = [];
    (prev.races || []).forEach(function (r) {
      var k = String(r.number);
      races[k] = r;
      order.push(k);
    });
    (incoming.races || []).forEach(function (r) {
      var k = String(r.number);
      if (!races[k]) order.push(k);
      races[k] = r;
    });
    var next = [];
    order.forEach(function (k) { if (races[k]) next.push(races[k]); });
    next.sort(function (a, b) {
      var na = Number(a.number), nb = Number(b.number);
      if (isFinite(na) && isFinite(nb) && na !== nb) return na - nb;
      return a.startMs - b.startMs;
    });
    var latest = 0;
    next.forEach(function (r) { if (r.startMs > latest) latest = r.startMs; });
    return {
      key: prev.key,
      track: incoming.track || prev.track,
      trackKey: prev.trackKey,
      state: incoming.state || prev.state,
      date: prev.date || incoming.date,
      major: prev.major || incoming.major,
      latest: latest,
      races: next
    };
  }
  function mergeMeetings(base, incoming) {
    var map = {};
    var order = [];
    (base || []).forEach(function (m) {
      if (!m || !m.key) return;
      map[m.key] = m;
      order.push(m.key);
    });
    (incoming || []).forEach(function (m) {
      if (!m || !m.key) return;
      if (!map[m.key]) order.push(m.key);
      map[m.key] = map[m.key] ? mergeOne(map[m.key], m) : m;
    });
    return order.map(function (k) { return map[k]; });
  }
  function sortMeetings(list) {
    return (list || []).slice().sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      if (!!a.major !== !!b.major) return a.major ? -1 : 1;
      if (a.latest !== b.latest) return a.latest < b.latest ? 1 : -1;
      return a.track.localeCompare(b.track);
    });
  }
  function visibleMeetings(raw, nowMs) {
    return sortMeetings((raw || []).filter(function (m) { return m && inWindow(m.date, nowMs); }));
  }
  function raceMatches(race, q) {
    if (!q) return true;
    var needle = q.toLowerCase();
    return (race.runners || []).some(function (rn) {
      return str(rn.name).toLowerCase().indexOf(needle) >= 0;
    });
  }
  function filterMeetings(meetings, opts) {
    opts = opts || {};
    var day = opts.day || "";
    var track = opts.track || "";
    var q = str(opts.q).toLowerCase();
    var out = [];
    (meetings || []).forEach(function (m) {
      if (day && m.date !== day) return;
      if (track && m.trackKey !== track) return;
      var races = (m.races || []).filter(function (r) { return raceMatches(r, q); });
      if (!races.length) return;
      var copy = {};
      for (var k in m) if (Object.prototype.hasOwnProperty.call(m, k)) copy[k] = m[k];
      copy.races = races;
      out.push(copy);
    });
    return out;
  }
  function dayOptions(meetings) {
    var seen = {};
    var out = [];
    (meetings || []).forEach(function (m) {
      if (!m.date || seen[m.date]) return;
      seen[m.date] = true;
      out.push(m.date);
    });
    out.sort(function (a, b) { return a < b ? 1 : -1; });
    return out;
  }
  function trackOptions(meetings) {
    var seen = {};
    var out = [];
    (meetings || []).forEach(function (m) {
      if (!m.trackKey || seen[m.trackKey]) return;
      seen[m.trackKey] = true;
      out.push({ key: m.trackKey, label: m.track });
    });
    out.sort(function (a, b) { return a.label.localeCompare(b.label); });
    return out;
  }
  function resultsPath(since) {
    if (!since) return "/api/racing/results";
    return "/api/racing/results?since=" + encodeURIComponent(since);
  }
  function highlightName(name, q) {
    var raw = str(name);
    var query = str(q);
    if (!query) return esc(raw);
    var i = raw.toLowerCase().indexOf(query.toLowerCase());
    if (i < 0) return esc(raw);
    return esc(raw.slice(0, i)) + "<mark>" + esc(raw.slice(i, i + query.length)) + "</mark>" + esc(raw.slice(i + query.length));
  }
  function runnerHit(rn, q) {
    var query = str(q).toLowerCase();
    if (!query) return false;
    return str(rn.name).toLowerCase().indexOf(query) >= 0;
  }
  function metaLine(rn) {
    var bits = [];
    if (rn.jockey) bits.push(rn.jockey);
    if (rn.trainer) bits.push(rn.trainer);
    if (rn.barrier != null && rn.barrier !== "") bits.push("Bar " + rn.barrier);
    return bits.join(" · ");
  }
  function rowHtml(rn, q) {
    var place = rn.scratched ? "SCR" : (rn.position ? ordinal(rn.position) : "—");
    var cls = "hr-row";
    if (rn.scratched) cls += " hr-row--out";
    else if (rn.position === 1) cls += " hr-row--1";
    else if (rn.position === 2) cls += " hr-row--2";
    else if (rn.position === 3) cls += " hr-row--3";
    if (runnerHit(rn, q)) cls += " hr-row--hit";
    var who = rn.scratched ? "Scratched" : metaLine(rn);
    return '<div class="' + cls + '" role="row">'
      + '<span class="hr-pos" role="cell">' + esc(place) + "</span>"
      + '<span class="hr-who" role="cell">' + silkChip(rn)
      + '<span class="hr-id"><span class="hr-name">' + highlightName(rn.name, q) + "</span>"
      + (who ? '<span class="hr-meta">' + esc(who) + "</span>" : "")
      + "</span></span>"
      + '<span class="hr-side" role="cell"><span class="hr-margin">' + esc(rn.scratched ? "—" : fmtMargin(rn.margin)) + '</span><span class="hr-price">' + esc(rn.scratched ? "—" : fmtPrice(rn.openingWin)) + "</span></span>"
      + "</div>";
  }
  function raceHtml(race, q) {
    var bits = [];
    var dist = fmtDistance(race.distance);
    if (dist) bits.push(dist);
    if (race.condition) bits.push(race.condition);
    var when = fmtStart(race.start);
    if (when) bits.push(when);
    var title = "R" + (race.number != null && race.number !== "" ? race.number : "–");
    if (race.name) title += " " + race.name;
    return '<article class="hr-race">'
      + '<header class="hr-race-h"><b>' + esc(title) + "</b>"
      + (bits.length ? '<span class="hr-race-meta">' + esc(bits.join(" · ")) + "</span>" : "")
      + "</header>"
      + '<div class="hr-table" role="table" aria-label="' + esc(title) + ' finishing order">'
      + '<div class="hr-thead" role="row"><span role="columnheader">Place</span><span role="columnheader">Horse</span><span role="columnheader">Margin · Open</span></div>'
      + (race.runners || []).map(function (rn) { return rowHtml(rn, q); }).join("")
      + "</div></article>";
  }
  function isOpen(m, index, state) {
    if (str(state.q)) return true;
    if (state.open && Object.prototype.hasOwnProperty.call(state.open, m.key)) return !!state.open[m.key];
    return index === 0;
  }
  function meetingHtml(m, index, state) {
    var open = isOpen(m, index, state);
    var sub = [];
    if (m.state) sub.push(m.state);
    sub.push(fmtDay(m.date, state.now));
    var n = (m.races || []).length;
    sub.push(n === 1 ? "1 race" : n + " races");
    return '<details class="hr-meet" data-key="' + esc(m.key) + '"' + (open ? " open" : "") + ">"
      + '<summary class="hr-meet-sum" aria-expanded="' + (open ? "true" : "false") + '">'
      + '<span class="hr-meet-id"><span class="hr-meet-name">' + esc(m.track) + '</span><span class="hr-meet-sub">' + esc(sub.join(" · ")) + "</span></span>"
      + '<span class="hr-chev" aria-hidden="true"></span>'
      + "</summary>"
      + '<div class="hr-races">' + (m.races || []).map(function (r) { return raceHtml(r, state.q); }).join("") + "</div>"
      + "</details>";
  }
  function chip(attr, value, label, pressed) {
    return '<button type="button" class="hr-filter" ' + attr + '="' + esc(value) + '" aria-pressed="' + (pressed ? "true" : "false") + '">' + esc(label) + "</button>";
  }
  function filtersHtml(all, state) {
    var days = dayOptions(all);
    var tracks = trackOptions(all);
    var day = '<div class="hr-filters" role="group" aria-label="Day">'
      + chip("data-hr-day", "", "All days", !state.day);
    days.forEach(function (d) {
      day += chip("data-hr-day", d, fmtDay(d, state.now), state.day === d);
    });
    day += "</div>";
    var track = '<div class="hr-filters" role="group" aria-label="Track">'
      + chip("data-hr-track", "", "All tracks", !state.track);
    tracks.forEach(function (t) {
      track += chip("data-hr-track", t.key, t.label, state.track === t.key);
    });
    track += "</div>";
    return day + track;
  }
  function listInner(all, state) {
    var shown = filterMeetings(all, state);
    if (!all.length) return '<div class="hr-empty" role="status">No horse results in the last two days.</div>';
    if (!shown.length) return '<div class="hr-empty" role="status">No races match that filter.</div>';
    return shown.map(function (m, i) { return meetingHtml(m, i, state); }).join("");
  }
  function pageOpen(extra) {
    var reduce = extra && extra.reduced;
    return '<div class="hr-page' + (reduce ? " hr-reduce" : "") + '" id="hr-app"' + (reduce ? ' data-reduced="1"' : "") + ">";
  }
  function backBtn() {
    return '<div class="back" id="hr-back" role="button" tabindex="0">← Back</div>';
  }
  function shell(state, listHtml) {
    return pageOpen(state)
      + backBtn()
      + '<div class="dhead"><h1 style="margin:0">Horses</h1></div>'
      + '<p class="hr-lead">How every horse finished over the last two days.</p>'
      + '<label class="hr-search"><span>Search</span><input id="hr-q" type="search" placeholder="Search by horse name" autocomplete="off" enterkeyhint="search" value="' + esc(state.q || "") + '"></label>'
      + filtersHtml(state.all || [], state)
      + '<div id="hr-list">' + listHtml + "</div>"
      + '<p class="hr-status" id="hr-status" role="status">' + esc(state.status || "") + "</p>"
      + "</div>";
  }
  function renderReady(state) {
    var all = state.all || [];
    return shell(state, listInner(all, state));
  }
  function comingSoonHtml(reduced) {
    return pageOpen({ reduced: reduced })
      + backBtn()
      + '<div class="dhead"><h1 style="margin:0">Horses</h1></div>'
      + '<div class="hr-soon" role="status">Results coming soon</div></div>';
  }
  function errorHtml(msg, reduced) {
    return pageOpen({ reduced: reduced })
      + backBtn()
      + '<div class="dhead"><h1 style="margin:0">Horses</h1></div>'
      + '<div class="hr-empty"><p>' + esc(msg || "Couldn't load horse results.") + '</p><button type="button" class="btn sm" id="hr-retry">Try again</button></div></div>';
  }
  function skeletonHtml(reduced) {
    return pageOpen({ reduced: reduced })
      + backBtn()
      + '<div class="dhead"><h1 style="margin:0">Horses</h1></div>'
      + '<div class="hr-sk" aria-busy="true"></div><div class="hr-sk"></div><div class="hr-sk hr-sk-lg"></div></div>';
  }
  function render(state) {
    state = state || {};
    if (state.view === "soon") return comingSoonHtml(state.reduced);
    if (state.view === "error") return errorHtml(state.error, state.reduced);
    if (state.view === "loading") return skeletonHtml(state.reduced);
    return renderReady(state);
  }

  function cssText() {
    return (
      "#hr-app{min-width:0;max-width:100%;overflow-x:clip}" +
      "#hr-app .hr-lead{margin:0 0 12px;color:var(--muted);font-size:var(--t-sub)}" +
      "#hr-app .hr-search{display:block;margin:0 0 12px}" +
      "#hr-app .hr-search span{display:block;margin:0 0 6px;color:var(--muted);font-size:var(--t-cap);letter-spacing:.06em;text-transform:uppercase}" +
      "#hr-app .hr-search input{display:block;width:100%;min-height:44px;box-sizing:border-box;border:1px solid var(--line);border-radius:12px;background:var(--card);color:var(--txt);font:inherit;padding:10px 12px}" +
      "#hr-app .hr-filters{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 12px}" +
      "#hr-app .hr-filter{appearance:none;-webkit-appearance:none;min-height:44px;min-width:44px;padding:8px 14px;border-radius:var(--r-pill,999px);border:1px solid var(--line);background:var(--card);color:var(--muted);font:inherit;font-weight:650;cursor:pointer}" +
      "#hr-app .hr-filter[aria-pressed=\"true\"]{background:var(--txt);color:var(--bg);border-color:var(--txt)}" +
      "#hr-app .hr-meet{background:var(--card);border:1px solid var(--line);border-radius:var(--radius,16px);margin:0 0 12px;min-width:0}" +
      "#hr-app .hr-meet-sum{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:44px;padding:12px 14px;cursor:pointer;list-style:none}" +
      "#hr-app .hr-meet-sum::-webkit-details-marker{display:none}" +
      "#hr-app .hr-meet-id{min-width:0;flex:1 1 auto}" +
      "#hr-app .hr-meet-name{display:block;font-weight:750;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
      "#hr-app .hr-meet-sub{display:block;color:var(--muted);font-size:var(--t-foot);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
      "#hr-app .hr-chev{flex:none;width:10px;height:10px;border-right:2px solid var(--muted);border-bottom:2px solid var(--muted);transform:rotate(45deg);transition:transform .2s var(--ease-out,ease)}" +
      "#hr-app .hr-meet[open] .hr-chev{transform:rotate(225deg)}" +
      "#hr-app .hr-races{padding:0 12px 12px;min-width:0}" +
      "#hr-app .hr-race{border:1px solid var(--line);border-radius:14px;background:var(--bg);margin:0 0 10px;min-width:0;overflow:hidden}" +
      "#hr-app .hr-race-h{display:flex;flex-direction:column;gap:4px;padding:12px 12px 8px}" +
      "#hr-app .hr-race-h b{font-weight:750}" +
      "#hr-app .hr-race-meta{color:var(--muted);font-size:var(--t-foot)}" +
      "#hr-app .hr-table{min-width:0}" +
      "#hr-app .hr-thead{display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:8px;padding:0 10px 6px;color:var(--muted);font-size:var(--t-cap);letter-spacing:.06em;text-transform:uppercase}" +
      "#hr-app .hr-thead span:last-child{text-align:right}" +
      "#hr-app .hr-row{display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:8px;align-items:center;min-height:44px;padding:8px 10px;border-top:1px solid var(--line)}" +
      "#hr-app .hr-row--1{background:color-mix(in srgb,#e0b84a 28%,var(--card));box-shadow:inset 3px 0 0 #e0b84a}" +
      "#hr-app .hr-row--2{background:color-mix(in srgb,#c5ced6 26%,var(--card));box-shadow:inset 3px 0 0 #c5ced6}" +
      "#hr-app .hr-row--3{background:color-mix(in srgb,#c4844a 28%,var(--card));box-shadow:inset 3px 0 0 #c4844a}" +
      "#hr-app .hr-row--out{opacity:.5}" +
      "#hr-app .hr-row--out .hr-name{color:var(--muted);text-decoration:line-through}" +
      "#hr-app .hr-row--hit{outline:1px solid var(--accent);outline-offset:-1px}" +
      "#hr-app .hr-pos{font-weight:800;font-variant-numeric:tabular-nums}" +
      "#hr-app .hr-who{display:flex;align-items:center;gap:10px;min-width:0}" +
      "#hr-app .hr-id{min-width:0;flex:1 1 auto}" +
      "#hr-app .hr-name{display:block;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
      "#hr-app .hr-name mark{background:color-mix(in srgb,var(--accent) 32%,transparent);color:inherit;font-weight:800;border-radius:4px;padding:0 2px}" +
      "#hr-app .hr-meta{display:block;color:var(--muted);font-size:var(--t-foot);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
      "#hr-app .hr-side{display:flex;flex-direction:column;align-items:flex-end;gap:2px;font-variant-numeric:tabular-nums}" +
      "#hr-app .hr-margin{font-weight:700}" +
      "#hr-app .hr-price{color:var(--muted);font-size:var(--t-foot)}" +
      "#hr-app .silk{position:relative;flex:none;width:42px;height:42px;border-radius:12px;background:var(--bg);border:1px solid var(--line);display:grid;place-items:center}" +
      "#hr-app .silk svg,#hr-app .silk img{width:28px;height:28px}" +
      "#hr-app .silk b{position:absolute;right:-5px;bottom:-5px;min-width:17px;height:17px;padding:0 4px;border-radius:6px;background:var(--txt);color:var(--bg);font:700 var(--t-cap)/17px inherit;text-align:center}" +
      "#hr-app .hr-empty,#hr-app .hr-soon{color:var(--muted);text-align:center;padding:28px 12px}" +
      "#hr-app .hr-soon{font-size:var(--t-h3);font-weight:650}" +
      "#hr-app .hr-empty .btn{margin-top:12px}" +
      "#hr-app .hr-status{min-height:1.2em;margin:4px 0 0;color:var(--faint);font-size:var(--t-foot)}" +
      "#hr-app .hr-status:empty{display:none}" +
      "#hr-app .hr-sk{height:44px;border-radius:12px;background:rgba(127,140,170,.16);margin:0 0 10px}" +
      "#hr-app .hr-sk-lg{height:160px}" +
      "#hr-app .hr-filter:focus-visible,#hr-app .hr-meet-sum:focus-visible,#hr-app .hr-search input:focus-visible,#hr-app #hr-back:focus-visible,#hr-app #hr-retry:focus-visible{outline:2px solid var(--accent);outline-offset:2px}" +
      "@media (prefers-reduced-motion:reduce){#hr-app .hr-chev,#hr-app .hr-row,#hr-app .hr-meet{transition:none;animation:none}}" +
      "#hr-app.hr-reduce .hr-chev{transition:none}"
    );
  }
  function injectCss() {
    var doc = root.document;
    if (!doc || doc.getElementById("hr-css")) return;
    var s = doc.createElement("style");
    s.id = "hr-css";
    s.textContent = cssText();
    (doc.head || doc.documentElement).appendChild(s);
  }

  var session = 0;
  var timer = null;
  var clearFn = null;

  function stop() {
    session++;
    if (timer != null) {
      try { (clearFn || root.clearInterval || clearInterval)(timer); } catch (e) {}
      timer = null;
    }
    clearFn = null;
  }

  function mount(el, opts) {
    opts = opts || {};
    stop();
    var mine = session;
    var sinceIso = null;
    var painted = false;
    var state = {
      view: "loading",
      raw: [],
      all: [],
      q: "",
      day: "",
      track: "",
      open: {},
      now: typeof opts.now === "function" ? opts.now() : Date.now(),
      reduced: reducedMotion(),
      status: "",
      error: ""
    };
    injectCss();
    function alive() { return mine === session && el && !el.hidden; }
    function pagePresent() {
      if (!painted) return true;
      if (!el || typeof el.querySelector !== "function") return true;
      return !!el.querySelector("#hr-app");
    }
    function nowMs() {
      state.now = typeof opts.now === "function" ? opts.now() : Date.now();
      return state.now;
    }
    function applyRaw() {
      state.all = visibleMeetings(state.raw, nowMs());
      if (state.day && dayOptions(state.all).indexOf(state.day) < 0) state.day = "";
      if (state.track && !trackOptions(state.all).some(function (t) { return t.key === state.track; })) state.track = "";
    }
    function bind(rootEl) {
      var back = rootEl.querySelector("#hr-back");
      if (back) {
        back.onclick = function () { if (opts.onBack) opts.onBack(); };
        back.onkeydown = function (ev) {
          if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); if (opts.onBack) opts.onBack(); }
        };
      }
      var q = rootEl.querySelector("#hr-q");
      if (q) {
        q.oninput = function () {
          state.q = q.value;
          paintList();
        };
      }
      var retry = rootEl.querySelector("#hr-retry");
      if (retry) retry.onclick = function () { state.view = "loading"; paintFull(); load(false); };
      rootEl.querySelectorAll("[data-hr-day]").forEach(function (btn) {
        btn.onclick = function () {
          state.day = btn.getAttribute("data-hr-day") || "";
          syncChips();
          paintList();
        };
      });
      rootEl.querySelectorAll("[data-hr-track]").forEach(function (btn) {
        btn.onclick = function () {
          state.track = btn.getAttribute("data-hr-track") || "";
          syncChips();
          paintList();
        };
      });
      rootEl.querySelectorAll("details.hr-meet").forEach(function (d) {
        d.ontoggle = function () {
          var key = d.getAttribute("data-key");
          if (key) state.open[key] = d.open;
          var sum = d.querySelector(".hr-meet-sum");
          if (sum) sum.setAttribute("aria-expanded", d.open ? "true" : "false");
        };
      });
    }
    function restoreFocus() {
      var doc = el.ownerDocument || root.document;
      var prev = state._focus;
      if (!prev || !doc) return;
      var q = el.querySelector("#hr-q");
      if (prev === "q" && q) {
        try { q.focus(); } catch (e) {}
        if (state._sel && q.setSelectionRange) {
          try { q.setSelectionRange(state._sel[0], state._sel[1]); } catch (e2) {}
        }
      }
    }
    function noteFocus() {
      var doc = el.ownerDocument || root.document;
      var active = doc && doc.activeElement;
      var q = el.querySelector && el.querySelector("#hr-q");
      if (q && active === q) {
        state._focus = "q";
        state._sel = [q.selectionStart, q.selectionEnd];
      } else state._focus = "";
    }
    function paintFull() {
      if (!alive()) return;
      noteFocus();
      var scroll = 0;
      try {
        var sc = (el.ownerDocument || root.document).scrollingElement;
        if (sc) scroll = sc.scrollTop;
      } catch (e) {}
      el.innerHTML = render(state);
      painted = true;
      bind(el);
      restoreFocus();
      try {
        var sc2 = (el.ownerDocument || root.document).scrollingElement;
        if (sc2) sc2.scrollTop = scroll;
      } catch (e2) {}
    }
    function paintList() {
      if (!alive()) return;
      var list = el.querySelector("#hr-list");
      if (!list || state.view !== "ready") return paintFull();
      list.innerHTML = listInner(state.all, state);
      bind(el);
    }
    function syncChips() {
      if (!el.querySelectorAll) return;
      el.querySelectorAll("[data-hr-day]").forEach(function (btn) {
        btn.setAttribute("aria-pressed", (btn.getAttribute("data-hr-day") || "") === (state.day || "") ? "true" : "false");
      });
      el.querySelectorAll("[data-hr-track]").forEach(function (btn) {
        btn.setAttribute("aria-pressed", (btn.getAttribute("data-hr-track") || "") === (state.track || "") ? "true" : "false");
      });
    }
    function setStatus(text) {
      state.status = text || "";
      var node = el.querySelector && el.querySelector("#hr-status");
      if (node) node.textContent = state.status;
    }
    function ensurePoll() {
      if (timer || mine !== session) return;
      var ms = opts.intervalMs || REFRESH_MS;
      var setInt = opts.setInterval || root.setInterval || setInterval;
      clearFn = opts.clearInterval || root.clearInterval || clearInterval;
      timer = setInt(function () {
        if (!alive() || !pagePresent()) { stop(); return; }
        return load(true);
      }, ms);
    }
    function load(incremental) {
      var path = resultsPath(incremental ? sinceIso : null);
      var stamp = new Date(nowMs()).toISOString();
      var api = opts.api;
      if (typeof api !== "function") {
        state.view = "error";
        state.error = "Couldn't load horse results.";
        paintFull();
        return Promise.resolve();
      }
      return Promise.resolve()
        .then(function () { return api(path, incremental ? { retries: 0 } : {}); })
        .then(function (r) {
          if (!alive()) return;
          if (r && r.status === 404) {
            if (!incremental && !state.raw.length) {
              state.view = "soon";
              paintFull();
            }
            return;
          }
          if (!r || !r.ok) {
            var err = new Error("bad status");
            err.status = r && r.status;
            throw err;
          }
          return Promise.resolve(r.json()).then(function (body) {
            if (!alive()) return;
            var incoming = parseMeetings(body);
            var prevSig = dayOptions(state.all).join(",") + "|" + trackOptions(state.all).map(function (t) { return t.key; }).join(",");
            state.raw = incremental ? mergeMeetings(state.raw, incoming) : incoming;
            sinceIso = stamp;
            applyRaw();
            var nextSig = dayOptions(state.all).join(",") + "|" + trackOptions(state.all).map(function (t) { return t.key; }).join(",");
            var was = state.view;
            state.view = "ready";
            if (was !== "ready" || !el.querySelector || !el.querySelector("#hr-q") || prevSig !== nextSig) paintFull();
            else paintList();
            if (incremental) setStatus("Updated");
            ensurePoll();
          });
        })
        .catch(function (e) {
          if (e && e.unauth) {
            stop();
            if (opts.onUnauth) opts.onUnauth();
            return;
          }
          if (!alive()) return;
          if (incremental && state.view === "ready") {
            setStatus("Couldn't refresh");
            return;
          }
          state.view = "error";
          state.error = (e && e.status === 503) ? "Racing data is currently unavailable. Please try again later." : "Couldn't load horse results.";
          paintFull();
        });
    }
    paintFull();
    return load(false);
  }

  var api = {
    REFRESH_MS: REFRESH_MS,
    resultsPath: resultsPath,
    parseMeetings: parseMeetings,
    mergeMeetings: mergeMeetings,
    visibleMeetings: visibleMeetings,
    filterMeetings: filterMeetings,
    sortMeetings: sortMeetings,
    inWindow: inWindow,
    windowDays: windowDays,
    ordinal: ordinal,
    fmtMargin: fmtMargin,
    fmtPrice: fmtPrice,
    render: render,
    comingSoonHtml: comingSoonHtml,
    errorHtml: errorHtml,
    skeletonHtml: skeletonHtml,
    cssText: cssText,
    injectCss: injectCss,
    mount: mount,
    stop: stop
  };
  root.TBHorseResults = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
