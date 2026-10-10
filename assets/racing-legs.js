/* Racing leg contract + tray helpers (tipdash). Browser global TBRacingLegs + CommonJS for node --test. */
(function (root) {
  "use strict";

  var POST_KEY = "tipdash_racing_post_v1";
  var EXTRA_PLACES_KEY = "tipdash_racing_extra_places";

  var MAJOR_TRACKS = {
    flemington: { label: "Flemington", straight: "NW", finish: { x: 78, y: 22 } },
    caulfield: { label: "Caulfield", straight: "E", finish: { x: 88, y: 52 } },
    moonee_valley: { label: "Moonee Valley", straight: "W", finish: { x: 12, y: 48 } },
    randwick: { label: "Randwick", straight: "E", finish: { x: 86, y: 28 } },
    rosehill: { label: "Rosehill", straight: "E", finish: { x: 84, y: 34 } },
    eagle_farm: { label: "Eagle Farm", straight: "NE", finish: { x: 82, y: 38 } },
    doomben: { label: "Doomben", straight: "N", finish: { x: 50, y: 14 } },
    morphettville: { label: "Morphettville", straight: "SW", finish: { x: 18, y: 72 } },
    ascot: { label: "Ascot", straight: "E", finish: { x: 88, y: 44 } },
    warwick_farm: { label: "Warwick Farm", straight: "W", finish: { x: 14, y: 40 } },
  };

  var SILK_PALETTE = [
    { primary: "#E5484D", secondary: "#FFFFFF" },
    { primary: "#2EAF62", secondary: "#FFFFFF" },
    { primary: "#5B8CFF", secondary: "#FFFFFF" },
    { primary: "#8E6CF0", secondary: "#FFFFFF" },
    { primary: "#19B5A5", secondary: "#111318" },
    { primary: "#FF8A3D", secondary: "#1B2A4A" },
    { primary: "#F5C542", secondary: "#111318" },
    { primary: "#F5F7FA", secondary: "#111318" },
  ];

  function normMeeting(name) {
    return String(name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function trackKey(meetingName) {
    var n = normMeeting(meetingName);
    if (!n) return null;
    var keys = Object.keys(MAJOR_TRACKS);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (n.indexOf(k.replace(/_/g, " ")) >= 0 || n.indexOf(k) >= 0) return k;
      if (n.indexOf(MAJOR_TRACKS[k].label.toLowerCase()) >= 0) return k;
    }
    return null;
  }

  function coloursFromNumber(num) {
    var n = Math.abs(parseInt(num, 10) || 0);
    return SILK_PALETTE[n % SILK_PALETTE.length];
  }

  /** TipBot contract: `colours` is an optional string (e.g. "red, white"). */
  function coloursString(runner) {
    if (!runner) return null;
    var raw = runner.colours;
    if (typeof raw === "string" && raw.trim()) return raw.trim();
    var pair = coloursFromNumber(runner.number);
    return pair.primary + ", " + pair.secondary;
  }

  function coloursForDisplay(leg) {
    if (!leg) return coloursFromNumber(0);
    var raw = leg.colours;
    if (typeof raw === "string" && raw.trim()) {
      var parts = raw.split(",");
      return { primary: parts[0].trim(), secondary: (parts[1] || parts[0]).trim() };
    }
    if (raw && typeof raw === "object" && raw.primary) return raw;
    return coloursFromNumber(leg.runner_number);
  }

  function intField(v) {
    var n = parseInt(v, 10);
    return isFinite(n) && n >= 1 ? n : null;
  }

  function pick(obj, keys) {
    if (!obj) return null;
    for (var i = 0; i < keys.length; i++) {
      var v = obj[keys[i]];
      if (v != null && v !== "" && v !== 0 && v !== "0") return v;
    }
    for (var j = 0; j < keys.length; j++) {
      var w = obj[keys[j]];
      if (typeof w === "number" && isFinite(w)) return w;
    }
    return null;
  }

  function openingWin(rn) {
    var f = rn && rn.fixed && pick(rn.fixed, ["win"]);
    return f != null ? f : pick(rn, ["opening_win", "open_win", "opening_win_odds"]);
  }

  function openingPlace(rn) {
    var f = rn && rn.fixed && pick(rn.fixed, ["place"]);
    return f != null ? f : pick(rn, ["opening_place", "open_place", "opening_place_odds"]);
  }

  function openingTopN(rn, n) {
    var nn = parseInt(n, 10);
    if (!(nn >= 2)) return null;
    var f = rn && rn.fixed;
    if (f) {
      var direct = pick(f, ["top_" + nn, "top" + nn, "t" + nn]);
      if (direct != null) return direct;
    }
    return pick(rn, ["opening_top_" + nn, "open_top_" + nn]);
  }

  function fmtOdds(v) {
    var n = Number(v);
    if (!isFinite(n) || n <= 0) return null;
    return Math.round(n * 100) / 100;
  }

  function betTypeLabel(betType, n) {
    if (betType === "win") return "Win";
    if (betType === "place") return "Place";
    if (betType === "top_n" && n) return "Top " + n;
    return "Racing";
  }

  function buildLeg(opts) {
    var race = opts.race;
    var runner = opts.runner;
    var meetingName = opts.meetingName || "";
    var betType = opts.betType || "win";
    var n = opts.n;
    var price = null;
    if (betType === "win") price = fmtOdds(openingWin(runner));
    else if (betType === "place") price = fmtOdds(openingPlace(runner));
    else if (betType === "top_n") price = fmtOdds(openingTopN(runner, n));

    var leg = {
      kind: "racing",
      event_id: race && String(race.id || race.event_id || ""),
      race_number: intField(race && race.race_number),
      meeting_name: String(meetingName || ""),
      runner_number: intField(runner && runner.number),
      runner_name: String((runner && runner.name) || ""),
      bet_type: betType,
    };
    if (price != null) leg.opening_price = price;
    var colours = coloursString(runner);
    if (colours) leg.colours = colours;
    if (runner && runner.silk_url) leg.silk_url = runner.silk_url;
    if (betType === "top_n" && n) leg.n = intField(n);
    return leg;
  }

  function legLabel(leg) {
    if (!leg || leg.kind !== "racing") return "";
    var bt = betTypeLabel(leg.bet_type, leg.n);
    var num = leg.runner_number != null ? "No. " + leg.runner_number + " " : "";
    var meet = leg.meeting_name ? leg.meeting_name + " · " : "";
    var rn = leg.race_number != null ? "R" + leg.race_number + " " : "";
    var price = leg.opening_price != null ? " @ " + leg.opening_price.toFixed(2) : " @ Opening";
    return num + (leg.runner_name || "Runner") + " · " + bt + " · " + meet + rn + price.trim();
  }

  function topNRange(fieldSize) {
    var n = parseInt(fieldSize, 10);
    if (!(n >= 2)) return [];
    var out = [];
    for (var i = 2; i <= n; i++) out.push(i);
    return out;
  }

  function combinedOpeningOdds(legs) {
    if (!Array.isArray(legs) || !legs.length) return null;
    var prod = 1;
    var used = 0;
    for (var i = 0; i < legs.length; i++) {
      var leg = legs[i];
      var p =
        leg && leg.kind === "racing"
          ? leg.opening_price
          : leg && leg.price != null
            ? leg.price
            : leg && leg.odds != null
              ? leg.odds
              : null;
      var n = Number(p);
      if (!isFinite(n) || n <= 1) continue;
      prod *= n;
      used++;
    }
    if (!used) return null;
    return Math.round(prod * 100) / 100;
  }

  function trackMapSvg(meetingName) {
    var key = trackKey(meetingName);
    if (!key) return "";
    var t = MAJOR_TRACKS[key];
    var finish = t.finish;
    return (
      '<svg class="race-track-map" viewBox="0 0 100 60" role="img" aria-label="' +
      t.label +
      ' track map">' +
      '<path class="race-track-outline" d="M18 42 C18 18 42 10 62 14 C88 18 92 38 78 48 C58 58 28 56 18 42 Z" fill="none"/>' +
      '<path class="race-track-straight" d="M78 14 L88 28" fill="none"/>' +
      '<circle class="race-track-finish" cx="' +
      finish.x +
      '" cy="' +
      finish.y +
      '" r="2.8"/>' +
      '<text class="race-track-label" x="50" y="56" text-anchor="middle">' +
      t.label +
      "</text></svg>"
    );
  }

  function miniHorseSvg(leg, animate) {
    var num = leg && leg.runner_number != null ? String(leg.runner_number) : "?";
    var c = coloursForDisplay(leg);
    var silk =
      leg && leg.silk_url
        ? '<image href="' +
          String(leg.silk_url).replace(/"/g, "") +
          '" width="14" height="14" x="3" y="3"/>'
        : '<rect x="4" y="4" width="12" height="12" rx="3" fill="' +
          c.primary +
          '"/><rect x="6" y="6" width="8" height="8" rx="2" fill="' +
          c.secondary +
          '" opacity=".85"/>';
    return (
      '<span class="tray-horse' +
      (animate ? " tray-horse-gallop" : "") +
      '"' +
      (animate ? "" : ' data-reduced="1"') +
      ' aria-hidden="true">' +
      '<svg viewBox="0 0 20 20" width="20" height="20">' +
      silk +
      '<text x="10" y="17" text-anchor="middle" font-size="7" font-weight="700" fill="currentColor">' +
      num +
      "</text></svg></span>"
    );
  }

  function legChipHtml(leg, animate) {
    if (!leg || leg.kind !== "racing") return "";
    return miniHorseSvg(leg, animate) + '<span class="tray-leg-txt">' + legLabel(leg) + "</span>";
  }

  function racingPostSupported() {
    try {
      var v = localStorage.getItem(POST_KEY);
      if (v === "0") return false;
      if (v === "1") return true;
    } catch (e) {}
    return true;
  }

  function setRacingPostSupported(ok) {
    try {
      localStorage.setItem(POST_KEY, ok ? "1" : "0");
    } catch (e) {}
  }

  function extraPlacesOn() {
    try {
      return localStorage.getItem(EXTRA_PLACES_KEY) === "1";
    } catch (e) {
      return false;
    }
  }

  function setExtraPlacesOn(on) {
    try {
      localStorage.setItem(EXTRA_PLACES_KEY, on ? "1" : "0");
    } catch (e) {}
  }

  function isRacingRejection(j, raw) {
    var bits = [];
    if (j && typeof j === "object") {
      if (j.message != null) bits.push(String(j.message));
      if (j.error != null) bits.push(String(j.error));
      if (j.detail != null) bits.push(String(j.detail));
      if (Array.isArray(j.errors)) bits.push(j.errors.join("\n"));
    }
    if (raw) bits.push(String(raw));
    var text = bits.join("\n").toLowerCase();
    if (!text) return false;
    if (text.indexOf("racing") < 0) return false;
    return (
      /unknown\s+kind|invalid\s+kind|unsupported\s+kind|kind.*racing/.test(text) ||
      (text.indexOf("racing") >= 0 && (text.indexOf("not supported") >= 0 || text.indexOf("coming soon") >= 0))
    );
  }

  var API = {
    POST_KEY: POST_KEY,
    EXTRA_PLACES_KEY: EXTRA_PLACES_KEY,
    MAJOR_TRACKS: MAJOR_TRACKS,
    trackKey: trackKey,
    coloursFromNumber: coloursFromNumber,
    coloursString: coloursString,
    coloursForDisplay: coloursForDisplay,
    openingWin: openingWin,
    openingPlace: openingPlace,
    openingTopN: openingTopN,
    buildLeg: buildLeg,
    legLabel: legLabel,
    topNRange: topNRange,
    combinedOpeningOdds: combinedOpeningOdds,
    trackMapSvg: trackMapSvg,
    legChipHtml: legChipHtml,
    racingPostSupported: racingPostSupported,
    setRacingPostSupported: setRacingPostSupported,
    extraPlacesOn: extraPlacesOn,
    setExtraPlacesOn: setExtraPlacesOn,
    isRacingRejection: isRacingRejection,
    betTypeLabel: betTypeLabel,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = API;
  root.TBRacingLegs = API;
})(typeof window !== "undefined" ? window : globalThis);
