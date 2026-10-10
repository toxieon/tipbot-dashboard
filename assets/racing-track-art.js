/* Original venue hero illustrations for AU/NZ racecourses (tipdash). Browser TBRacingTrackArt + CommonJS. */
(function (root) {
  "use strict";

  var GENERIC = {
    label: "Racecourse",
    tokens: [],
    skyTop: "#5A7FA8",
    skyBot: "#B8CCE8",
    glow: "#F0D78C",
    turfA: "#1A3D2E",
    turfB: "#0F2A1F",
    rail: "#E8ECF2",
    stand: 0,
    skyline: 0,
    hills: false,
  };

  /** Ladbrokes-style meeting names → venue keys (longer tokens first where order matters). */
  var VENUES = {
    moonee_valley: {
      label: "Moonee Valley",
      tokens: ["moonee valley", "the valley"],
      skyTop: "#4E6F9C",
      skyBot: "#9BB4D4",
      glow: "#FFD27A",
      turfA: "#1B3B2C",
      turfB: "#10261C",
      rail: "#E6EAF0",
      stand: 1,
      skyline: 2,
      hills: false,
    },
    kembla_grange: {
      label: "Kembla Grange",
      tokens: ["kembla grange", "kembla"],
      skyTop: "#5C7FA6",
      skyBot: "#A8BFD9",
      glow: "#F2C96D",
      turfA: "#1A3829",
      turfB: "#0E2419",
      rail: "#E8EDF3",
      stand: 3,
      skyline: 4,
      hills: true,
    },
    sunshine_coast: {
      label: "Sunshine Coast",
      tokens: ["sunshine coast", "caloundra"],
      skyTop: "#4A90C4",
      skyBot: "#A8D4F0",
      glow: "#FFE08A",
      turfA: "#1C4030",
      turfB: "#112A1F",
      rail: "#F0F4FA",
      stand: 2,
      skyline: 5,
      hills: true,
    },
    gold_coast: {
      label: "Gold Coast",
      tokens: ["gold coast", "bundall"],
      skyTop: "#3D8BC9",
      skyBot: "#9FD0F5",
      glow: "#FFD966",
      turfA: "#1B3D2D",
      turfB: "#0F281E",
      rail: "#EEF2F8",
      stand: 4,
      skyline: 6,
      hills: false,
    },
    warwick_farm: {
      label: "Warwick Farm",
      tokens: ["warwick farm"],
      skyTop: "#5678A0",
      skyBot: "#B0C6E0",
      glow: "#F0CE7A",
      turfA: "#1A3828",
      turfB: "#0F241A",
      rail: "#E7EBF1",
      stand: 1,
      skyline: 1,
      hills: false,
    },
    eagle_farm: {
      label: "Eagle Farm",
      tokens: ["eagle farm"],
      skyTop: "#4F7AB0",
      skyBot: "#A8C4E8",
      glow: "#FFDB85",
      turfA: "#1B3A2A",
      turfB: "#10251B",
      rail: "#E9EDF3",
      stand: 2,
      skyline: 3,
      hills: false,
    },
    flemington: {
      label: "Flemington",
      tokens: ["flemington"],
      skyTop: "#5B7FA8",
      skyBot: "#B5C9E4",
      glow: "#F5D88A",
      turfA: "#1C3F2F",
      turfB: "#11281D",
      rail: "#EAEDF2",
      stand: 2,
      skyline: 1,
      hills: false,
    },
    caulfield: {
      label: "Caulfield",
      tokens: ["caulfield"],
      skyTop: "#607AA5",
      skyBot: "#B8CAE2",
      glow: "#EFD07A",
      turfA: "#1A3C2C",
      turfB: "#0F261C",
      rail: "#E8ECF1",
      stand: 1,
      skyline: 2,
      hills: false,
    },
    randwick: {
      label: "Randwick",
      tokens: ["randwick"],
      skyTop: "#4A6F9A",
      skyBot: "#A4BEDD",
      glow: "#FFD580",
      turfA: "#1B3D2D",
      turfB: "#10271C",
      rail: "#E7EBF0",
      stand: 2,
      skyline: 0,
      hills: false,
    },
    rosehill: {
      label: "Rosehill",
      tokens: ["rosehill"],
      skyTop: "#5A7CA6",
      skyBot: "#B2C7E0",
      glow: "#F2CD78",
      turfA: "#1A3B2B",
      turfB: "#0F2519",
      rail: "#E9EDF2",
      stand: 1,
      skyline: 1,
      hills: false,
    },
    canterbury: {
      label: "Canterbury",
      tokens: ["canterbury"],
      skyTop: "#566F94",
      skyBot: "#AEBFD6",
      glow: "#F0D07A",
      turfA: "#19382A",
      turfB: "#0E2419",
      rail: "#E6EAEF",
      stand: 0,
      skyline: 0,
      hills: false,
    },
    doomben: {
      label: "Doomben",
      tokens: ["doomben"],
      skyTop: "#4E78A8",
      skyBot: "#A6C0E0",
      glow: "#FFE08F",
      turfA: "#1B3C2C",
      turfB: "#10261B",
      rail: "#EBEEF4",
      stand: 3,
      skyline: 3,
      hills: false,
    },
    morphettville: {
      label: "Morphettville",
      tokens: ["morphettville"],
      skyTop: "#6A7FA0",
      skyBot: "#B8C4D8",
      glow: "#F5D68A",
      turfA: "#1D3E2E",
      turfB: "#12281E",
      rail: "#E8ECF2",
      stand: 2,
      skyline: 4,
      hills: true,
    },
    ascot: {
      label: "Ascot",
      tokens: ["ascot wa", "ascot"],
      skyTop: "#5580B0",
      skyBot: "#A8C2E4",
      glow: "#FFDC8A",
      turfA: "#1A3B2B",
      turfB: "#0F2519",
      rail: "#EAF0F6",
      stand: 4,
      skyline: 5,
      hills: false,
    },
    belmont: {
      label: "Belmont",
      tokens: ["belmont"],
      skyTop: "#5F7EA5",
      skyBot: "#B4C6DE",
      glow: "#F0CE7C",
      turfA: "#1B3A2A",
      turfB: "#102519",
      rail: "#E7EBF0",
      stand: 1,
      skyline: 2,
      hills: false,
    },
    hobart: {
      label: "Hobart",
      tokens: ["elwick", "hobart"],
      skyTop: "#4A6888",
      skyBot: "#9EB4CC",
      glow: "#E8C878",
      turfA: "#1A3628",
      turfB: "#0F2218",
      rail: "#E4E8ED",
      stand: 0,
      skyline: 7,
      hills: true,
    },
    launceston: {
      label: "Launceston",
      tokens: ["mowbray", "launceston"],
      skyTop: "#526E90",
      skyBot: "#A6B8D0",
      glow: "#EFCC76",
      turfA: "#193729",
      turfB: "#0E2118",
      rail: "#E6EAEF",
      stand: 1,
      skyline: 7,
      hills: true,
    },
    sandown: {
      label: "Sandown",
      tokens: ["sandown"],
      skyTop: "#5C7AA2",
      skyBot: "#B6C8E0",
      glow: "#F2D07A",
      turfA: "#1B3C2C",
      turfB: "#10261B",
      rail: "#E8ECF1",
      stand: 2,
      skyline: 2,
      hills: false,
    },
    pakenham: {
      label: "Pakenham",
      tokens: ["pakenham"],
      skyTop: "#607CA4",
      skyBot: "#B8CAE2",
      glow: "#EFCF7A",
      turfA: "#1A3B2B",
      turfB: "#0F2519",
      rail: "#E9EDF2",
      stand: 3,
      skyline: 1,
      hills: true,
    },
    geelong: {
      label: "Geelong",
      tokens: ["geelong"],
      skyTop: "#5678A0",
      skyBot: "#B0C4DC",
      glow: "#F5D88C",
      turfA: "#1C3D2D",
      turfB: "#11281E",
      rail: "#EAEDF2",
      stand: 1,
      skyline: 4,
      hills: true,
    },
    ballarat: {
      label: "Ballarat",
      tokens: ["ballarat"],
      skyTop: "#5A7498",
      skyBot: "#B2C2D8",
      glow: "#EECC7A",
      turfA: "#1A3829",
      turfB: "#0F241A",
      rail: "#E6EAEF",
      stand: 0,
      skyline: 6,
      hills: true,
    },
    bendigo: {
      label: "Bendigo",
      tokens: ["bendigo"],
      skyTop: "#5E789C",
      skyBot: "#B4C4D8",
      glow: "#F0CC78",
      turfA: "#1B3A2A",
      turfB: "#102519",
      rail: "#E8EBF0",
      stand: 1,
      skyline: 6,
      hills: true,
    },
    newcastle: {
      label: "Newcastle",
      tokens: ["newcastle"],
      skyTop: "#4E7098",
      skyBot: "#A8BEDD",
      glow: "#FFD67A",
      turfA: "#1A3B2B",
      turfB: "#0F2619",
      rail: "#E7EBF0",
      stand: 2,
      skyline: 0,
      hills: false,
    },
    gosford: {
      label: "Gosford",
      tokens: ["gosford"],
      skyTop: "#5580A8",
      skyBot: "#AEC4E0",
      glow: "#FFDB82",
      turfA: "#1B3C2C",
      turfB: "#10261B",
      rail: "#E9EDF3",
      stand: 1,
      skyline: 3,
      hills: true,
    },
    hawkesbury: {
      label: "Hawkesbury",
      tokens: ["hawkesbury"],
      skyTop: "#5A7CA4",
      skyBot: "#B4C6DE",
      glow: "#F2CE7A",
      turfA: "#1A3A2A",
      turfB: "#0F2519",
      rail: "#E8ECF1",
      stand: 0,
      skyline: 4,
      hills: true,
    },
    ipswich: {
      label: "Ipswich",
      tokens: ["ipswich"],
      skyTop: "#5678A2",
      skyBot: "#B0C4DC",
      glow: "#FFD87E",
      turfA: "#1B3B2B",
      turfB: "#10261A",
      rail: "#EAEDF2",
      stand: 2,
      skyline: 1,
      hills: false,
    },
    ellerslie: {
      label: "Ellerslie",
      tokens: ["ellerslie"],
      skyTop: "#4A6E96",
      skyBot: "#A2BCD8",
      glow: "#F5D080",
      turfA: "#1C3E2E",
      turfB: "#11281E",
      rail: "#E8ECF2",
      stand: 2,
      skyline: 8,
      hills: true,
    },
    trentham: {
      label: "Trentham",
      tokens: ["trentham"],
      skyTop: "#4C6E92",
      skyBot: "#A0B8D4",
      glow: "#EFCC78",
      turfA: "#1A3C2C",
      turfB: "#0F261B",
      rail: "#E6EAEF",
      stand: 1,
      skyline: 8,
      hills: true,
    },
    riccarton: {
      label: "Riccarton",
      tokens: ["riccarton"],
      skyTop: "#506C90",
      skyBot: "#A4B8D0",
      glow: "#F0CA76",
      turfA: "#1B3B2B",
      turfB: "#102519",
      rail: "#E7EBF0",
      stand: 3,
      skyline: 8,
      hills: true,
    },
  };

  /** Match order: multi-word venues before short names (e.g. eagle farm before ascot). */
  var VENUE_MATCH_ORDER = [
    "moonee_valley",
    "kembla_grange",
    "sunshine_coast",
    "gold_coast",
    "warwick_farm",
    "eagle_farm",
    "flemington",
    "caulfield",
    "randwick",
    "rosehill",
    "canterbury",
    "doomben",
    "morphettville",
    "ascot",
    "belmont",
    "hobart",
    "launceston",
    "sandown",
    "pakenham",
    "geelong",
    "ballarat",
    "bendigo",
    "newcastle",
    "gosford",
    "hawkesbury",
    "ipswich",
    "ellerslie",
    "trentham",
    "riccarton",
  ];

  function normMeeting(name) {
    return String(name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function venueKey(meetingName) {
    var n = normMeeting(meetingName);
    if (!n) return "generic";
    for (var i = 0; i < VENUE_MATCH_ORDER.length; i++) {
      var key = VENUE_MATCH_ORDER[i];
      var v = VENUES[key];
      if (!v) continue;
      for (var j = 0; j < v.tokens.length; j++) {
        if (n.indexOf(v.tokens[j]) >= 0) return key;
      }
    }
    return "generic";
  }

  function venueConfig(meetingName) {
    var key = venueKey(meetingName);
    if (key === "generic") return GENERIC;
    return VENUES[key];
  }

  function skylineSvg(variant, fill) {
    var f = fill || "rgba(12,18,28,.55)";
    switch (variant % 9) {
      case 0:
        return (
          '<path fill="' +
          f +
          '" d="M0 72 L0 52 L28 52 L28 38 L48 38 L48 52 L72 52 L72 44 L96 44 L96 58 L120 58 L120 48 L148 48 L148 62 L400 62 L400 72 Z"/>'
        );
      case 1:
        return (
          '<path fill="' +
          f +
          '" d="M0 70 L0 48 L36 48 L36 32 L58 32 L58 48 L88 48 L88 40 L112 40 L112 54 L400 54 L400 70 Z"/>'
        );
      case 2:
        return (
          '<path fill="' +
          f +
          '" d="M0 74 L0 56 L24 56 L24 42 L52 42 L52 56 L80 56 L80 36 L104 36 L104 56 L132 56 L132 46 L156 46 L156 60 L400 60 L400 74 Z"/>'
        );
      case 3:
        return (
          '<path fill="' +
          f +
          '" d="M0 68 L0 50 L40 50 L40 34 L64 34 L64 50 L100 50 L100 42 L128 42 L128 56 L400 56 L400 68 Z"/>'
        );
      case 4:
        return (
          '<path fill="' +
          f +
          '" d="M0 72 L0 54 L20 54 L20 44 L44 44 L44 54 L68 54 L68 38 L92 38 L92 54 L116 54 L116 48 L140 48 L140 58 L400 58 L400 72 Z"/>'
        );
      case 5:
        return (
          '<path fill="' +
          f +
          '" d="M0 66 L0 46 L32 46 L32 28 L56 28 L56 46 L78 46 L78 38 L102 38 L102 50 L126 50 L126 40 L150 40 L150 52 L400 52 L400 66 Z"/>'
        );
      case 6:
        return (
          '<path fill="' +
          f +
          '" d="M0 70 L0 52 L16 52 L16 36 L38 36 L38 52 L60 52 L60 44 L84 44 L84 56 L108 56 L108 32 L132 32 L132 56 L400 56 L400 70 Z"/>'
        );
      case 7:
        return (
          '<path fill="' +
          f +
          '" d="M0 74 L0 58 L30 58 L30 48 L54 48 L54 58 L78 58 L78 52 L102 52 L102 62 L126 62 L126 54 L150 54 L150 64 L400 64 L400 74 Z"/>'
        );
      default:
        return (
          '<path fill="' +
          f +
          '" d="M0 72 L0 50 L26 50 L26 40 L50 40 L50 50 L74 50 L74 42 L98 42 L98 54 L122 54 L122 46 L146 46 L146 56 L400 56 L400 72 Z"/>'
        );
    }
  }

  function grandstandSvg(variant, accent) {
    var a = accent || "#D8DEE8";
    switch (variant % 5) {
      case 0:
        return (
          '<g class="rvh-stand">' +
          '<path fill="' +
          a +
          '" opacity=".92" d="M24 78 L24 58 L88 58 L88 78 Z"/>' +
          '<path fill="rgba(0,0,0,.2)" d="M24 58 L56 48 L88 58 Z"/>' +
          '<rect x="32" y="62" width="8" height="16" fill="rgba(0,0,0,.15)"/>' +
          '<rect x="48" y="62" width="8" height="16" fill="rgba(0,0,0,.15)"/>' +
          '<rect x="64" y="62" width="8" height="16" fill="rgba(0,0,0,.15)"/>' +
          "</g>"
        );
      case 1:
        return (
          '<g class="rvh-stand">' +
          '<path fill="' +
          a +
          '" opacity=".94" d="M118 80 L118 54 L210 54 L210 80 Z"/>' +
          '<path fill="rgba(0,0,0,.22)" d="M118 54 L164 42 L210 54 Z"/>' +
          '<rect x="128" y="58" width="10" height="22" fill="rgba(0,0,0,.12)"/>' +
          '<rect x="148" y="58" width="10" height="22" fill="rgba(0,0,0,.12)"/>' +
          '<rect x="168" y="58" width="10" height="22" fill="rgba(0,0,0,.12)"/>' +
          '<rect x="188" y="58" width="10" height="22" fill="rgba(0,0,0,.12)"/>' +
          "</g>"
        );
      case 2:
        return (
          '<g class="rvh-stand">' +
          '<path fill="' +
          a +
          '" opacity=".9" d="M248 82 L248 52 L340 52 L340 82 Z"/>' +
          '<path fill="rgba(0,0,0,.2)" d="M248 52 L294 40 L340 52 Z"/>' +
          '<rect x="258" y="56" width="12" height="26" fill="rgba(0,0,0,.14)"/>' +
          '<rect x="278" y="56" width="12" height="26" fill="rgba(0,0,0,.14)"/>' +
          '<rect x="298" y="56" width="12" height="26" fill="rgba(0,0,0,.14)"/>' +
          '<rect x="318" y="56" width="12" height="26" fill="rgba(0,0,0,.14)"/>' +
          "</g>"
        );
      case 3:
        return (
          '<g class="rvh-stand">' +
          '<path fill="' +
          a +
          '" opacity=".93" d="M52 80 L52 56 L148 56 L148 80 Z"/>' +
          '<path fill="rgba(0,0,0,.18)" d="M52 56 L100 46 L148 56 Z"/>' +
          '<path fill="rgba(255,255,255,.08)" d="M60 60 L140 60 L140 64 L60 64 Z"/>' +
          "</g>"
        );
      default:
        return (
          '<g class="rvh-stand">' +
          '<path fill="' +
          a +
          '" opacity=".88" d="M280 78 L280 50 L376 50 L376 78 Z"/>' +
          '<path fill="rgba(0,0,0,.2)" d="M280 50 L328 38 L376 50 Z"/>' +
          '<rect x="292" y="54" width="14" height="24" rx="2" fill="rgba(91,140,255,.25)"/>' +
          '<rect x="314" y="54" width="14" height="24" rx="2" fill="rgba(91,140,255,.25)"/>' +
          '<rect x="336" y="54" width="14" height="24" rx="2" fill="rgba(91,140,255,.25)"/>' +
          "</g>"
        );
    }
  }

  function hillsSvg() {
    return '<path fill="rgba(8,14,10,.35)" d="M0 88 Q80 72 160 84 T320 78 T400 86 L400 100 L0 100 Z"/>';
  }

  function railsSvg(railColor) {
    var r = railColor || "#E8ECF2";
    var posts = "";
    for (var x = 8; x < 392; x += 24) {
      posts += '<circle cx="' + x + '" cy="92" r="2.2" fill="' + r + '" opacity=".85"/>';
    }
    return (
      '<g class="rvh-rail">' +
      '<line x1="0" y1="90" x2="400" y2="90" stroke="' +
      r +
      '" stroke-width="3" opacity=".95"/>' +
      '<line x1="0" y1="96" x2="400" y2="96" stroke="' +
      r +
      '" stroke-width="1.5" opacity=".55"/>' +
      posts +
      "</g>"
    );
  }

  function venueHeroSvg(meetingName) {
    var cfg = venueConfig(meetingName);
    var label = cfg.label || "Racecourse";
    var hills = cfg.hills ? hillsSvg() : "";
    return (
      '<svg class="race-venue-hero" viewBox="0 0 400 120" preserveAspectRatio="xMidYMid slice" role="img" aria-label="' +
      label +
      '">' +
      "<defs>" +
      '<linearGradient id="rvh-sky" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="' +
      cfg.skyTop +
      '"/>' +
      '<stop offset="1" stop-color="' +
      cfg.skyBot +
      '"/>' +
      "</linearGradient>" +
      '<linearGradient id="rvh-turf" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="' +
      cfg.turfA +
      '"/>' +
      '<stop offset="1" stop-color="' +
      cfg.turfB +
      '"/>' +
      "</linearGradient>" +
      '<radialGradient id="rvh-sun" cx="78%" cy="22%" r="28%">' +
      '<stop offset="0" stop-color="' +
      cfg.glow +
      '" stop-opacity=".55"/>' +
      '<stop offset="1" stop-color="' +
      cfg.glow +
      '" stop-opacity="0"/>' +
      "</radialGradient>" +
      "</defs>" +
      '<rect width="400" height="120" fill="url(#rvh-sky)"/>' +
      '<rect width="400" height="120" fill="url(#rvh-sun)"/>' +
      '<g class="rvh-skyline">' +
      skylineSvg(cfg.skyline) +
      "</g>" +
      hills +
      grandstandSvg(cfg.stand, cfg.rail) +
      '<rect y="86" width="400" height="34" fill="url(#rvh-turf)"/>' +
      '<path fill="rgba(255,255,255,.04)" d="M0 98 L400 92 L400 120 L0 120 Z"/>' +
      '<g class="rvh-turf-stripes">' +
      '<path stroke="rgba(255,255,255,.06)" stroke-width="8" d="M-20 108 L420 100"/>' +
      '<path stroke="rgba(255,255,255,.04)" stroke-width="6" d="M-40 114 L400 108"/>' +
      "</g>" +
      railsSvg(cfg.rail) +
      "</svg>"
    );
  }

  var API = {
    VENUES: VENUES,
    VENUE_MATCH_ORDER: VENUE_MATCH_ORDER,
    venueKey: venueKey,
    venueConfig: venueConfig,
    venueHeroSvg: venueHeroSvg,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = API;
  root.TBRacingTrackArt = API;
})(typeof window !== "undefined" ? window : globalThis);
