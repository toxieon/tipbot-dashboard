/* AFL / AFLW stylised isometric stadium art for builder game cards + game view. TBAflStadiums + CommonJS for node --test. */
(function (root) {
  "use strict";

  /** @typedef {{ id:string, label:string, aliases:string[], stands:{n:number,e:number,s:number,w:number}, towers:number, towerStyle:string, roof:number, tint:string }} VenueSpec */

  var VENUES = [
    {
      id: "mcg",
      label: "MCG",
      aliases: ["mcg", "m.c.g.", "melbournecricketground", "melbournecricket"],
      stands: { n: 22, e: 24, s: 23, w: 24 },
      towers: 6,
      towerStyle: "classic",
      roof: 0,
      tint: "#6b7a94",
    },
    {
      id: "marvel",
      label: "Marvel Stadium",
      aliases: ["marvel", "docklands", "etihad", "marvelstadium", "dockland"],
      stands: { n: 16, e: 14, s: 16, w: 14 },
      towers: 4,
      towerStyle: "mast",
      roof: 1,
      tint: "#5a6a82",
    },
    {
      id: "adelaide",
      label: "Adelaide Oval",
      aliases: ["adelaideoval", "adelaide"],
      stands: { n: 14, e: 20, s: 18, w: 20 },
      towers: 4,
      towerStyle: "classic",
      roof: 0.15,
      tint: "#c9d4e4",
    },
    {
      id: "optus",
      label: "Optus Stadium",
      aliases: ["optus", "perthstadium", "perth", "burswood"],
      stands: { n: 17, e: 17, s: 17, w: 17 },
      towers: 4,
      towerStyle: "sail",
      roof: 0.85,
      tint: "#7a8fa8",
    },
    {
      id: "gabba",
      label: "The Gabba",
      aliases: ["gabba", "brisbanecricketground", "woolloongabba"],
      stands: { n: 20, e: 21, s: 20, w: 21 },
      towers: 4,
      towerStyle: "cluster",
      roof: 0,
      tint: "#647089",
    },
    {
      id: "scg",
      label: "SCG",
      aliases: ["scg", "s.c.g.", "sydneycricketground"],
      stands: { n: 12, e: 26, s: 14, w: 16 },
      towers: 4,
      towerStyle: "classic",
      roof: 0.1,
      tint: "#8a9ab0",
    },
    {
      id: "giants",
      label: "Engie Stadium",
      aliases: ["giants", "showground", "sydneyshowground", "engie", "greaterwesternsydney", "manningroad"],
      stands: { n: 10, e: 22, s: 12, w: 11 },
      towers: 4,
      towerStyle: "mast",
      roof: 0.55,
      tint: "#6d7f99",
    },
    {
      id: "gmhba",
      label: "GMHBA Stadium",
      aliases: ["gmhba", "kardinia", "kardiniapark", "geelong", "skilled"],
      stands: { n: 8, e: 10, s: 26, w: 9 },
      towers: 4,
      towerStyle: "classic",
      roof: 0.35,
      tint: "#5c6d86",
    },
    {
      id: "carrara",
      label: "People First Stadium",
      aliases: ["carrara", "peoplefirst", "metricon", "heritagebank", "goldcoast"],
      stands: { n: 11, e: 13, s: 12, w: 13 },
      towers: 4,
      towerStyle: "mast",
      roof: 0.2,
      tint: "#7d93a8",
    },
    {
      id: "bellerive",
      label: "UTAS Stadium",
      aliases: ["bellerive", "belleriveoval", "blundstone", "hobart"],
      stands: { n: 15, e: 12, s: 18, w: 20 },
      towers: 4,
      towerStyle: "classic",
      roof: 0,
      tint: "#6a7f6e",
    },
    {
      id: "manuka",
      label: "Manuka Oval",
      aliases: ["manuka", "manukaoval", "canberra"],
      stands: { n: 9, e: 11, s: 10, w: 11 },
      towers: 4,
      towerStyle: "cluster",
      roof: 0,
      tint: "#6b7d6a",
    },
    {
      id: "norwood",
      label: "Norwood Oval",
      aliases: ["norwood", "norwoodoval", "redlegs"],
      stands: { n: 8, e: 9, s: 9, w: 8 },
      towers: 2,
      towerStyle: "classic",
      roof: 0,
      tint: "#8a7a6a",
    },
    {
      id: "yorkpark",
      label: "York Park",
      aliases: ["yorkpark", "utasstadium", "universityoftasmania", "launceston", "utaslaunceston"],
      stands: { n: 14, e: 16, s: 14, w: 16 },
      towers: 4,
      towerStyle: "mast",
      roof: 0.45,
      tint: "#6e7f94",
    },
    {
      id: "traeger",
      label: "Traeger Park",
      aliases: ["traeger", "traegerpark", "alice", "alicesprings", "tio"],
      stands: { n: 6, e: 7, s: 6, w: 7 },
      towers: 6,
      towerStyle: "mast",
      roof: 0,
      tint: "#c4a574",
    },
    {
      id: "marrara",
      label: "Marrara Oval",
      aliases: ["marrara", "marraraoval", "darwin", "northernterritory"],
      stands: { n: 10, e: 11, s: 10, w: 11 },
      towers: 4,
      towerStyle: "cluster",
      roof: 0.1,
      tint: "#7a8f7a",
    },
    {
      id: "barossa",
      label: "Barossa Park",
      aliases: ["barossa", "barossapark", "nuriootpa"],
      stands: { n: 5, e: 6, s: 5, w: 6 },
      towers: 2,
      towerStyle: "classic",
      roof: 0,
      tint: "#9a7a6a",
    },
    {
      id: "hands",
      label: "Hands Oval",
      aliases: ["hands", "handsoval", "ballarat"],
      stands: { n: 6, e: 7, s: 6, w: 7 },
      towers: 2,
      towerStyle: "classic",
      roof: 0,
      tint: "#7a8a7a",
    },
  ];

  var GENERIC = {
    id: "generic",
    label: "Stadium",
    aliases: [],
    stands: { n: 12, e: 12, s: 12, w: 12 },
    towers: 4,
    towerStyle: "classic",
    roof: 0,
    tint: "#5f6f88",
  };

  var _byId = {};
  for (var i = 0; i < VENUES.length; i++) _byId[VENUES[i].id] = VENUES[i];

  function normVenue(name) {
    return String(name || "")
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "");
  }

  function lookupVenue(name) {
    var k = normVenue(name);
    if (!k) return null;
    var best = null;
    var bestLen = 0;
    for (var i = 0; i < VENUES.length; i++) {
      var v = VENUES[i];
      for (var j = 0; j < v.aliases.length; j++) {
        var a = v.aliases[j];
        var ak = normVenue(a);
        if (!ak) continue;
        if (k === ak || k.indexOf(ak) >= 0 || ak.indexOf(k) >= 0) {
          if (ak.length > bestLen) {
            best = v;
            bestLen = ak.length;
          }
        }
      }
    }
    return best;
  }

  function specFor(name) {
    return lookupVenue(name) || GENERIC;
  }

  function venueId(name) {
    return specFor(name).id;
  }

  function escAttr(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  function standBand(side, h, tint) {
    var base = 68;
    var rx = 54;
    var ry = 30;
    var fill = tint;
    var stroke = "rgba(0,0,0,.22)";
    if (side === "n") {
      return (
        '<path d="M' +
        (100 - rx) +
        " " +
        (base - ry) +
        " Q100 " +
        (base - ry - h) +
        " " +
        (100 + rx) +
        " " +
        (base - ry) +
        ' Z" fill="' +
        fill +
        '" stroke="' +
        stroke +
        '" stroke-width=".6" opacity=".92"/>'
      );
    }
    if (side === "s") {
      return (
        '<path d="M' +
        (100 - rx) +
        " " +
        (base + ry) +
        " Q100 " +
        (base + ry + h) +
        " " +
        (100 + rx) +
        " " +
        (base + ry) +
        ' Z" fill="' +
        fill +
        '" stroke="' +
        stroke +
        '" stroke-width=".6" opacity=".88"/>'
      );
    }
    if (side === "w") {
      return (
        '<path d="M' +
        (100 - rx - h * 0.35) +
        " " +
        (base - ry) +
        " L" +
        (100 - rx - h * 0.55) +
        " " +
        base +
        " L" +
        (100 - rx - h * 0.35) +
        " " +
        (base + ry) +
        ' Z" fill="' +
        fill +
        '" stroke="' +
        stroke +
        '" stroke-width=".6" opacity=".86"/>'
      );
    }
    return (
      '<path d="M' +
      (100 + rx + h * 0.35) +
      " " +
      (base - ry) +
      " L" +
      (100 + rx + h * 0.55) +
      " " +
      base +
      " L" +
      (100 + rx + h * 0.35) +
      " " +
      (base + ry) +
      ' Z" fill="' +
      fill +
      '" stroke="' +
      stroke +
      '" stroke-width=".6" opacity=".86"/>'
    );
  }

  function towerMarkup(x, y, h, style) {
    var shaft =
      '<rect x="' +
      (x - 1.2) +
      '" y="' +
      (y - h) +
      '" width="2.4" height="' +
      h +
      '" fill="#3d4658" rx=".4"/>';
    var head;
    if (style === "sail") {
      head =
        '<path d="M' +
        x +
        " " +
        (y - h - 6) +
        " l5 10 h-10z\" fill=\"rgba(200,220,255,.55)\"/>";
    } else if (style === "mast") {
      head =
        '<line x1="' +
        x +
        '" y1="' +
        (y - h) +
        '" x2="' +
        x +
        '" y2="' +
        (y - h - 9) +
        '" stroke="#9eb0c8" stroke-width="1.2"/><circle cx="' +
        x +
        '" cy="' +
        (y - h - 9) +
        '" r="2.2" fill="#ffe9a8" opacity=".9"/>';
    } else if (style === "cluster") {
      head =
        '<g fill="#ffe9a8" opacity=".85"><circle cx="' +
        (x - 2) +
        '" cy="' +
        (y - h - 3) +
        '" r="1.4"/><circle cx="' +
        x +
        '" cy="' +
        (y - h - 4.5) +
        '" r="1.6"/><circle cx="' +
        (x + 2) +
        '" cy="' +
        (y - h - 3) +
        '" r="1.4"/></g>';
    } else {
      head =
        '<rect x="' +
        (x - 2.5) +
        '" y="' +
        (y - h - 5) +
        '" width="5" height="3" fill="#ffe9a8" opacity=".88" rx=".5"/>';
    }
    return shaft + head;
  }

  function towersFor(spec) {
    var pts = [
      { x: 38, y: 42 },
      { x: 162, y: 42 },
      { x: 38, y: 94 },
      { x: 162, y: 94 },
    ];
    if (spec.towers >= 6) {
      pts.push({ x: 100, y: 28 });
      pts.push({ x: 100, y: 108 });
    }
    var out = "";
    var th = 16 + (spec.stands.n + spec.stands.s) * 0.15;
    for (var i = 0; i < pts.length && i < spec.towers; i++) {
      out += towerMarkup(pts[i].x, pts[i].y, th, spec.towerStyle);
    }
    return out;
  }

  function roofFor(spec) {
    if (!spec.roof || spec.roof <= 0) return "";
    var op = Math.min(0.75, 0.25 + spec.roof * 0.45);
    if (spec.id === "marvel") {
      return (
        '<path d="M32 36 L168 36 L168 48 Q100 58 32 48 Z" fill="rgba(180,195,215,' +
        op +
        ')" stroke="rgba(255,255,255,.12)"/>'
      );
    }
    if (spec.id === "optus") {
      return (
        '<path d="M48 32 Q100 18 152 32 L140 44 Q100 36 60 44 Z" fill="rgba(210,225,245,' +
        op +
        ')"/>' +
        '<path d="M52 44 Q100 52 148 44 L136 52 Q100 48 64 52 Z" fill="rgba(180,200,225,' +
        (op * 0.7) +
        ')"/>'
      );
    }
    return (
      '<ellipse cx="100" cy="40" rx="62" ry="14" fill="rgba(200,210,225,' +
      op +
      ')" stroke="rgba(255,255,255,.08)"/>'
    );
  }

  function silhouetteExtra(spec) {
    if (spec.id === "scg") {
      return '<rect x="148" y="46" width="10" height="22" fill="#d8c8a8" opacity=".75" rx="1"/>';
    }
    if (spec.id === "gmhba") {
      return '<rect x="42" y="72" width="116" height="14" fill="#4a5a72" opacity=".9" rx="2"/>';
    }
    if (spec.id === "traeger") {
      return '<rect x="0" y="100" width="200" height="20" fill="#a08050" opacity=".35"/>';
    }
    if (spec.id === "bellerive") {
      return '<path d="M0 88 Q40 72 80 86 T200 92 V120 H0Z" fill="#4a6a58" opacity=".25"/>';
    }
    return "";
  }

  function stadiumSvg(venueName) {
    var spec = specFor(venueName);
    var s = spec.stands;
    var pitch =
      '<ellipse cx="100" cy="68" rx="48" ry="26" fill="#2f9a58" stroke="#1f6d3d" stroke-width=".8"/>' +
      '<ellipse cx="100" cy="68" rx="7" ry="3.5" fill="none" stroke="rgba(255,255,255,.32)" stroke-width=".7"/>' +
      '<line x1="100" y1="42" x2="100" y2="94" stroke="rgba(255,255,255,.18)" stroke-width=".6"/>';
    var stands =
      standBand("n", s.n, spec.tint) +
      standBand("s", s.s, spec.tint) +
      standBand("w", s.w, spec.tint) +
      standBand("e", s.e, spec.tint);
    return (
      '<svg class="afl-stadium-svg" viewBox="0 0 200 120" role="img" aria-label="' +
      escAttr(spec.label) +
      ' stylised stadium">' +
      '<defs><linearGradient id="aflPitch" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3cb268"/><stop offset="1" stop-color="#267a46"/></linearGradient></defs>' +
      '<g class="afl-stadium-scene">' +
      silhouetteExtra(spec) +
      roofFor(spec) +
      stands +
      pitch.replace("#2f9a58", "url(#aflPitch)") +
      towersFor(spec) +
      "</g></svg>"
    );
  }

  function heroWrap(venueName, variant) {
    var spec = specFor(venueName);
    var id = spec.id;
    var cls = "afl-stadium-hero afl-stadium-hero--" + (variant === "game" ? "game" : "card");
    return (
      '<div class="' +
      cls +
      '" data-venue="' +
      escAttr(id) +
      '" aria-hidden="true"><div class="afl-stadium-tilt">' +
      stadiumSvg(venueName) +
      "</div></div>"
    );
  }

  function cardHeroHtml(venueName) {
    return heroWrap(venueName, "card");
  }

  function gameHeroHtml(venueName) {
    return heroWrap(venueName, "game");
  }

  var API = {
    VENUES: VENUES,
    GENERIC: GENERIC,
    normVenue: normVenue,
    lookupVenue: lookupVenue,
    specFor: specFor,
    venueId: venueId,
    stadiumSvg: stadiumSvg,
    cardHeroHtml: cardHeroHtml,
    gameHeroHtml: gameHeroHtml,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = API;
  root.TBAflStadiums = API;
})(typeof window !== "undefined" ? window : globalThis);
