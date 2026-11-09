/* Game view racetrack data (tipdash): which race a followed racing tip is on, its field
   without scratchings, runner colours and the runner legend. Pure, no DOM; a plain
   script (global TBRacingTrack) and CommonJS for node --test. The 3D scene lives in
   assets/venues/racecourse.js. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.TBRacingTrack = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  var MAX_FIELD = 24;
  var POLL_MS = 60000;
  var PALETTE = ["#E5484D", "#5B8CFF", "#F5C542", "#2EAF62", "#FF8A3D", "#8E6CF0", "#F5F7FA", "#111318",
    "#19B5A5", "#F472B6", "#1B2A4A", "#8B93A7"];
  var NAMED = {
    red: "#D7263D", scarlet: "#D7263D", maroon: "#7A1F2B", cerise: "#DE3163", pink: "#F472B6",
    orange: "#FF8A3D", yellow: "#F5C542", gold: "#E2B13C", lime: "#9BD13B", green: "#2EAF62",
    emerald: "#1E9E5A", teal: "#19B5A5", aqua: "#2EC4D6", turquoise: "#2EC4D6", blue: "#2F5FD0",
    royal: "#2F5FD0", navy: "#1B2A4A", purple: "#8E6CF0", violet: "#8E6CF0", mauve: "#B784C9",
    lilac: "#C8A2C8", white: "#F5F7FA", silver: "#C0C6CF", grey: "#8B93A7", gray: "#8B93A7",
    black: "#111318", brown: "#6B3E1F", tan: "#C79A64", beige: "#E1C699", cream: "#F3E9D2"
  };

  function text(v) { return v == null ? "" : String(v).trim(); }
  function int(v) { var n = parseInt(v, 10); return isFinite(n) && n > 0 ? n : null; }
  function isRacingLeg(leg) {
    if (!leg || typeof leg !== "object") return false;
    return text(leg.kind).toLowerCase() === "racing" || text(leg.leg_type).toLowerCase() === "racing";
  }
  function isRacingSport(s) {
    return /^(racing|horse ?racing|horseracing|horses?|gallops|thoroughbreds?|harness)$/i.test(text(s));
  }

  /** "Flemington · R7" / "Flemington R7" / "Flemington multi" -> {meeting, race}. */
  function parseGameName(name) {
    var s = text(name);
    if (!s) return {meeting: "", race: null};
    var m = s.match(/^(.*?)\s*(?:·|-|–|—)?\s*R(?:ace)?\s*(\d{1,2})\b/i);
    if (m && m[1]) return {meeting: m[1].replace(/[·\-–—\s]+$/, "").trim(), race: int(m[2])};
    var multi = s.match(/^(.*?)\s+multi$/i);
    if (multi) return {meeting: multi[1].trim(), race: null};
    return {meeting: "", race: null};
  }

  /** The race a group of followed tips is on: the first racing leg with an event id,
      every tipped runner on that race, or (no racing fields yet) the meeting from the
      game name so the course still matches. Null when nothing says it is racing. */
  function raceRef(tips, gameName) {
    var list = Array.isArray(tips) ? tips : (tips ? [tips] : []);
    var ref = null, racing = false;
    list.forEach(function (t) {
      if (!t) return;
      if (isRacingSport(t.sport)) racing = true;
      (Array.isArray(t.legs) ? t.legs : []).forEach(function (leg) {
        if (!isRacingLeg(leg)) return;
        racing = true;
        var eid = text(leg.event_id);
        if (!ref && eid) ref = {event_id: eid, meeting_name: text(leg.meeting_name), race_number: int(leg.race_number), tipped: []};
        if (ref && eid === ref.event_id) {
          var n = int(leg.runner_number);
          if (n && ref.tipped.indexOf(n) < 0) ref.tipped.push(n);
          if (!ref.meeting_name && leg.meeting_name) ref.meeting_name = text(leg.meeting_name);
        }
      });
    });
    if (ref) return ref;
    if (!racing) return null;
    var first = list[0] || {};
    var parsed = parseGameName(gameName || first.game_name);
    var leg0 = (Array.isArray(first.legs) ? first.legs : []).find(isRacingLeg) || {};
    return {event_id: "", meeting_name: text(leg0.meeting_name) || parsed.meeting, race_number: int(leg0.race_number) || parsed.race, tipped: []};
  }

  function colourFor(runner) {
    var c = runner && runner.colours;
    var s = Array.isArray(c) ? c.join(" ") : (c && typeof c === "object" ? text(c.primary || c.body || "") : text(c));
    if (/^#[0-9a-f]{6}$/i.test(s)) return s.toUpperCase();
    var words = s.toLowerCase().split(/[^a-z]+/);
    for (var i = 0; i < words.length; i++) if (NAMED[words[i]]) return NAMED[words[i]];
    var n = int(runner && runner.number) || 1;
    return PALETTE[(n - 1) % PALETTE.length];
  }

  function safeSilk(u) {
    var s = text(u);
    return /^https:\/\//i.test(s) ? s : "";
  }

  /** Active runners (scratchings removed), sorted by barrier then number, capped at 24. */
  function fieldFromEvent(event, tipped) {
    var tip = (tipped || []).map(int).filter(Boolean);
    var runners = event && Array.isArray(event.runners) ? event.runners : [];
    var out = [];
    runners.forEach(function (r) {
      if (!r || r.scratched === true || /scratch/i.test(text(r.status))) return;
      var num = int(r.number != null ? r.number : r.runner_number);
      out.push({
        number: num,
        name: text(r.name),
        barrier: int(r.barrier),
        jockey: text(r.jockey_or_driver || r.jockey),
        silk_url: safeSilk(r.silk_url),
        colour: colourFor({colours: r.colours, number: num}),
        tipped: num != null && tip.indexOf(num) >= 0
      });
    });
    out.sort(function (a, b) {
      var ab = a.barrier == null ? 99 : a.barrier, bb = b.barrier == null ? 99 : b.barrier;
      if (ab !== bb) return ab - bb;
      return (a.number || 99) - (b.number || 99);
    });
    return out.slice(0, MAX_FIELD);
  }

  /** Same race, same runners in the same order and the same silks: nothing to redraw. */
  function sameField(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (a[i].number !== b[i].number || a[i].silk_url !== b[i].silk_url || a[i].tipped !== b[i].tipped) return false;
    }
    return true;
  }

  function silkPath(url) {
    var s = safeSilk(url);
    return s ? "/api/racing/silk?url=" + encodeURIComponent(s) : "";
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c];
    });
  }

  function title(ref, event) {
    var meet = text(event && event.meeting_name) || text(ref && ref.meeting_name);
    var rn = int(event && event.race_number) || int(ref && ref.race_number);
    return (meet || "Race") + (rn ? " R" + rn : "");
  }

  /** The runner legend under the track, in barrier order; tipped runners in bold with a Tip badge. */
  function legendHtml(ref, event, field) {
    var list = field || [];
    var dist = int(event && event.distance);
    var sub = [dist ? dist + "m" : "", list.length ? list.length + " runners" : ""].filter(Boolean).join(" · ");
    var rows = list.map(function (r) {
      var silk = r.silk_url
        ? '<img src="' + esc(r.silk_url) + '" alt="" loading="lazy" referrerpolicy="no-referrer">'
        : '<i style="background:' + esc(r.colour) + '"></i>';
      return '<li class="fl-rr' + (r.tipped ? " is-tip" : "") + '"><span class="fl-rr-silk">' + silk + "</span>"
        + '<b class="fl-rr-no">' + esc(r.number == null ? "–" : r.number) + "</b>"
        + '<span class="fl-rr-name">' + esc(r.name || "Runner") + (r.tipped ? '<em class="fl-rr-tip">Tip</em>' : "") + "</span>"
        + '<span class="fl-rr-bar">' + (r.barrier ? "Bar " + esc(r.barrier) : "") + "</span></li>";
    }).join("");
    var empty = list.length ? "" : '<p class="fl-rr-empty">' + (ref && ref.event_id ? "Loading the field…" : "Field not available for this race yet.") + "</p>";
    return '<div class="fl-race-head"><h2>' + esc(title(ref, event)) + "</h2><span>" + esc(sub) + "</span></div>"
      + (rows ? '<ul class="fl-race-list">' + rows + "</ul>" : "") + empty;
  }

  /** Parade slots before the jump: runner i trails the leader by ``gap`` metres, in
      three lanes from the inside rail. Returns [{back, lane}] in metres. */
  function paradeSlots(n, width, gap) {
    var w = Math.max(6, Number(width) || 24), g = Number(gap) || 9, out = [];
    var lanes = [0.22, 0.48, 0.74];
    for (var i = 0; i < n; i++) out.push({back: i * g * 0.8, lane: lanes[i % 3] * w});
    return out;
  }

  return {MAX_FIELD: MAX_FIELD, POLL_MS: POLL_MS, parseGameName: parseGameName, raceRef: raceRef,
    fieldFromEvent: fieldFromEvent, sameField: sameField, colourFor: colourFor, silkPath: silkPath,
    legendHtml: legendHtml, paradeSlots: paradeSlots, isRacingSport: isRacingSport};
});
