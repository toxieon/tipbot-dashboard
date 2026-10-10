/* AFL venue stadium art — isometric SVG heroes + game-card thumbs (tipdash). TBAflStadiums + CommonJS. */
(function (root) {
  "use strict";

  var VENUES = [
    {
      id: "mcg",
      aliases: ["mcg", "melbournecricketground", "melbournecricket", "jolimont"],
      label: "MCG",
      sky: "#1a2844",
      grass: ["#1e5c38", "#164a2e"],
      stand: "#3d4a62",
      accent: "#f0c14a",
      feature: "towers",
    },
    {
      id: "marvel",
      aliases: ["marvel", "marvelstadium", "docklands", "etihad", "colonial", "telenet"],
      label: "Marvel",
      sky: "#141c2e",
      grass: ["#1a5536", "#123d28"],
      stand: "#4a5568",
      accent: "#7eb8ff",
      feature: "roof",
    },
    {
      id: "adelaide_oval",
      aliases: ["adelaideoval", "adelaide"],
      label: "Adelaide Oval",
      sky: "#1e2a3a",
      grass: ["#2a6b42", "#1f5233"],
      stand: "#c8cdd6",
      accent: "#ffffff",
      feature: "whiteband",
    },
    {
      id: "optus",
      aliases: ["optus", "optusstadium", "perthstadium", "burswood"],
      label: "Optus",
      sky: "#1a2230",
      grass: ["#1f5a38", "#17482d"],
      stand: "#5c4a3a",
      accent: "#c49a6c",
      feature: "arches",
    },
    {
      id: "gabba",
      aliases: ["gabba", "brisbanecricketground", "thegabba", "woolloongabba"],
      label: "Gabba",
      sky: "#182030",
      grass: ["#1d5535", "#154228"],
      stand: "#3a4558",
      accent: "#e8edf5",
      feature: "flood",
    },
    {
      id: "scg",
      aliases: ["scg", "sydneycricketground", "sydney cricket"],
      label: "SCG",
      sky: "#1c2436",
      grass: ["#226040", "#1a4d32"],
      stand: "#4b5565",
      accent: "#d4dae4",
      feature: "pavilion",
    },
    {
      id: "sydney_showground",
      aliases: [
        "sydneyshowground",
        "showground",
        "engie",
        "engiestadium",
        "giantsstadium",
        "skoda",
        "spotless",
      ],
      label: "Showground",
      sky: "#1a2438",
      grass: ["#1f5c3a", "#17472e"],
      stand: "#3f4d62",
      accent: "#9ec5ff",
      feature: "cantilever",
    },
    {
      id: "people_first",
      aliases: ["peoplefirst", "peoplefirststadium", "metricon", "carrara", "heritagebank"],
      label: "People First",
      sky: "#1e2838",
      grass: ["#22844a", "#1a6b3c"],
      stand: "#465268",
      accent: "#ff9a5c",
      feature: "sweep",
    },
    {
      id: "gmhba",
      aliases: ["gmhba", "gmhbastadium", "kardinia", "kardiniapark", "shell"],
      label: "GMHBA",
      sky: "#182232",
      grass: ["#1e5638", "#16442c"],
      stand: "#3e4a5c",
      accent: "#b8c8e8",
      feature: "grandstand",
    },
    {
      id: "utas",
      aliases: ["utas", "utasstadium", "yorkpark", "universityoftasmaniastadium"],
      label: "UTAS",
      sky: "#1c2636",
      grass: ["#2a643e", "#1f4f31"],
      stand: "#4a5568",
      accent: "#c8d4e8",
      feature: "regional",
    },
    {
      id: "blundstone",
      aliases: ["blundstone", "blundstonearena", "bellerive", "aurora"],
      label: "Blundstone",
      sky: "#1a2434",
      grass: ["#1a5234", "#134028"],
      stand: "#3d4858",
      accent: "#8ec4a8",
      feature: "hill",
    },
    {
      id: "manuka",
      aliases: ["manuka", "manukaoval", "canberra"],
      label: "Manuka",
      sky: "#1e2c3a",
      grass: ["#2d6b44", "#225535"],
      stand: "#4a5a4a",
      accent: "#7ab87a",
      feature: "trees",
    },
    {
      id: "tio_marrara",
      aliases: ["tio", "tiostadium", "marrara", "tiotraeger", "darwin"],
      label: "TIO",
      sky: "#243040",
      grass: ["#3a7a48", "#2d6238"],
      stand: "#556070",
      accent: "#f0d080",
      feature: "tropical",
    },
    {
      id: "ninja",
      aliases: ["ninja", "ninjastadium"],
      label: "Ninja",
      sky: "#161e2c",
      grass: ["#1c5236", "#154028"],
      stand: "#3a4458",
      accent: "#6ee7b7",
      feature: "modern",
    },
  ];

  var GENERIC = {
    id: "generic",
    label: "Oval",
    sky: "#1a2230",
    grass: ["#1e5638", "#16442c"],
    stand: "#3a4558",
    accent: "#8b93a7",
    feature: "plain",
  };

  var _uid = 0;

  function normKey(name) {
    return String(name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  }

  function lookupVenue(name) {
    var k = normKey(name);
    if (!k) return null;
    var best = null;
    var bestLen = 0;
    for (var i = 0; i < VENUES.length; i++) {
      var v = VENUES[i];
      for (var j = 0; j < v.aliases.length; j++) {
        var a = v.aliases[j];
        if (k === a || k.indexOf(a) >= 0 || a.indexOf(k) >= 0) {
          if (a.length > bestLen) {
            best = v;
            bestLen = a.length;
          }
        }
      }
    }
    return best;
  }

  function specFor(name) {
    return lookupVenue(name) || GENERIC;
  }

  function uid() {
    _uid += 1;
    return "afs" + _uid;
  }

  function ovalPath(cx, cy, rx, ry) {
    return (
      "M" +
      (cx - rx) +
      " " +
      cy +
      " C" +
      (cx - rx) +
      " " +
      (cy - ry) +
      " " +
      (cx + rx) +
      " " +
      (cy - ry) +
      " " +
      (cx + rx) +
      " " +
      cy +
      " C" +
      (cx + rx) +
      " " +
      (cy + ry) +
      " " +
      (cx - rx) +
      " " +
      (cy + ry) +
      " " +
      (cx - rx) +
      " " +
      cy +
      " Z"
    );
  }

  function standBlock(x, y, w, h, depth, color) {
    return (
      '<path fill="' +
      color +
      '" opacity=".92" d="M' +
      x +
      " " +
      y +
      " h" +
      w +
      " v" +
      h +
      " l" +
      depth +
      " " +
      (-depth * 0.55) +
      " v-" +
      h +
      'z"/>'
    );
  }

  function lightTower(x, y, h, accent) {
    return (
      '<g class="afs-tower">' +
      '<rect x="' +
      (x - 2) +
      '" y="' +
      (y - h) +
      '" width="4" height="' +
      h +
      '" fill="#2a3040" rx="1"/>' +
      '<circle cx="' +
      x +
      '" cy="' +
      (y - h - 3) +
      '" r="5" fill="' +
      accent +
      '" opacity=".85"/>' +
      '<ellipse cx="' +
      x +
      '" cy="' +
      (y - h - 3) +
      '" rx="14" ry="6" fill="' +
      accent +
      '" opacity=".12"/>' +
      "</g>"
    );
  }

  function featureLayer(spec, compact) {
    var f = spec.feature || "plain";
    var a = spec.accent;
    if (compact) {
      if (f === "roof" || f === "arches" || f === "sweep" || f === "modern") {
        return '<path fill="' + a + '" opacity=".35" d="M20 32 Q60 22 100 32 v6 Q60 42 20 36 Z"/>';
      }
      if (f === "towers" || f === "flood" || f === "tropical") {
        return lightTower(28, 48, 18, a) + lightTower(92, 48, 18, a);
      }
      return "";
    }
    var out = "";
    if (f === "towers") {
      out +=
        lightTower(92, 158, 48, a) +
        lightTower(308, 158, 48, a) +
        lightTower(112, 208, 42, a) +
        lightTower(288, 208, 42, a);
    } else if (f === "roof") {
      out +=
        '<path class="afs-roof" fill="' +
        a +
        '" opacity=".35" d="M70 78 Q200 42 330 78 L310 98 Q200 72 90 98 Z"/>' +
        '<path fill="none" stroke="' +
        a +
        '" stroke-width="2" opacity=".55" d="M75 82 Q200 48 325 82"/>';
    } else if (f === "whiteband") {
      out +=
        '<path fill="' +
        a +
        '" opacity=".55" d="M58 108 Q200 88 342 108 v10 Q200 128 58 118 Z"/>' +
        '<path fill="none" stroke="#fff" stroke-width="1.2" opacity=".4" d="M62 112 Q200 94 338 112"/>';
    } else if (f === "arches") {
      out +=
        '<path fill="none" stroke="' +
        a +
        '" stroke-width="3.5" opacity=".75" d="M95 95 Q200 35 305 95"/>' +
        '<path fill="none" stroke="' +
        a +
        '" stroke-width="2" opacity=".45" d="M110 100 Q200 55 290 100"/>' +
        '<path fill="' +
        a +
        '" opacity=".18" d="M95 95 Q200 35 305 95 L305 108 Q200 72 95 108 Z"/>';
    } else if (f === "flood") {
      out +=
        lightTower(120, 92, 36, a) +
        lightTower(280, 92, 36, a) +
        standBlock(40, 118, 320, 22, 14, spec.stand);
    } else if (f === "pavilion") {
      out +=
        '<path fill="' +
        spec.stand +
        '" d="M248 96 l52 -18 v28 l-52 16 z"/>' +
        '<path fill="' +
        a +
        '" opacity=".5" d="M252 98 l44 -14 v8 l-44 12 z"/>';
    } else if (f === "cantilever") {
      out +=
        '<path fill="' +
        a +
        '" opacity=".4" d="M60 86 h120 v14 l80 -22 v-8 l-80 22 h-120 z"/>' +
        '<path fill="none" stroke="' +
        a +
        '" stroke-width="1.5" d="M60 100 h200"/>';
    } else if (f === "sweep") {
      out +=
        '<path fill="' +
        a +
        '" opacity=".38" d="M55 90 Q140 62 220 88 Q300 110 345 82 v20 Q220 118 55 108 Z"/>';
    } else if (f === "grandstand") {
      out +=
        '<path fill="' +
        spec.stand +
        '" d="M52 112 h88 v26 l16 -8 v-18 z"/>' +
        '<path fill="' +
        a +
        '" opacity=".45" d="M56 114 h80 v6 z"/>';
    } else if (f === "regional") {
      out += standBlock(70, 120, 260, 18, 10, spec.stand);
    } else if (f === "hill") {
      out +=
        '<path fill="#2d4a38" opacity=".7" d="M48 150 Q120 128 200 142 Q280 156 352 138 L352 168 L48 168 Z"/>' +
        standBlock(220, 118, 100, 20, 8, spec.stand);
    } else if (f === "trees") {
      out +=
        '<g fill="#2d5a3a" opacity=".75">' +
        '<circle cx="42" cy="148" r="10"/><circle cx="58" cy="156" r="8"/><circle cx="358" cy="150" r="9"/><circle cx="342" cy="158" r="7"/>' +
        "</g>";
    } else if (f === "tropical") {
      out += lightTower(200, 88, 40, a) + lightTower(160, 100, 28, a) + lightTower(240, 100, 28, a);
    } else if (f === "modern") {
      out +=
        '<path fill="' +
        a +
        '" opacity=".32" d="M90 92 Q200 68 310 92 v16 Q200 112 90 104 Z"/>' +
        '<rect x="188" y="78" width="24" height="8" rx="2" fill="' +
        a +
        '" opacity=".6"/>';
    }
    return out;
  }

  function stadiumSvg(spec, variant) {
    var compact = variant === "card";
    var w = compact ? 120 : 400;
    var h = compact ? 72 : 220;
    var gid = uid();
    var g0 = spec.grass[0];
    var g1 = spec.grass[1];
    var cx = w / 2;
    var cy = compact ? 44 : 132;
    var rx = compact ? 38 : 128;
    var ry = compact ? 22 : 52;
    var skyH = compact ? 36 : 100;
    var stands =
      standBlock(compact ? 8 : 28, compact ? 38 : 108, compact ? 104 : 344, compact ? 12 : 28, compact ? 6 : 18, spec.stand) +
      standBlock(compact ? 14 : 48, compact ? 50 : 138, compact ? 92 : 304, compact ? 8 : 18, compact ? 5 : 12, spec.stand);

    return (
      '<svg class="afs-svg afs-svg--' +
      (compact ? "card" : "hero") +
      '" viewBox="0 0 ' +
      w +
      " " +
      h +
      '" role="img" aria-hidden="true" data-stadium="' +
      spec.id +
      '">' +
      "<defs>" +
      '<linearGradient id="' +
      gid +
      'sky" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="' +
      spec.sky +
      '"/>' +
      '<stop offset="1" stop-color="#0a0e14"/>' +
      "</linearGradient>" +
      '<linearGradient id="' +
      gid +
      'grass" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="' +
      g0 +
      '"/>' +
      '<stop offset="1" stop-color="' +
      g1 +
      '"/>' +
      "</linearGradient>" +
      '<radialGradient id="' +
      gid +
      'glow" cx="50%" cy="45%" r="55%">' +
      '<stop offset="0" stop-color="' +
      spec.accent +
      '" stop-opacity=".14"/>' +
      '<stop offset="1" stop-color="transparent"/>' +
      "</radialGradient>" +
      "</defs>" +
      '<rect width="' +
      w +
      '" height="' +
      h +
      '" fill="url(#' +
      gid +
      'sky)"/>' +
      '<rect x="0" y="' +
      skyH +
      '" width="' +
      w +
      '" height="' +
      (h - skyH) +
      '" fill="#121820" opacity=".35"/>' +
      '<ellipse cx="' +
      cx +
      '" cy="' +
      (cy + (compact ? 4 : 8)) +
      '" rx="' +
      (rx + (compact ? 8 : 24)) +
      '" ry="' +
      (ry + (compact ? 6 : 16)) +
      '" fill="url(#' +
      gid +
      'glow)"/>' +
      stands +
      '<path fill="url(#' +
      gid +
      'grass)" d="' +
      ovalPath(cx, cy, rx, ry) +
      '"/>' +
      '<path fill="none" stroke="#0d1810" stroke-width="' +
      (compact ? 1 : 2) +
      '" opacity=".55" d="' +
      ovalPath(cx, cy, rx - 4, ry - 3) +
      '"/>' +
      '<ellipse cx="' +
      cx +
      '" cy="' +
      cy +
      '" rx="' +
      (rx * 0.12) +
      '" ry="' +
      (ry * 0.18) +
      '" fill="#1a3828" opacity=".5"/>' +
      featureLayer(spec, compact) +
      "</svg>"
    );
  }

  function heroHtml(venueName) {
    var spec = specFor(venueName);
    return (
      '<div class="afs-scene" data-stadium="' +
      spec.id +
      '">' +
      stadiumSvg(spec, "hero") +
      '<div class="afs-glow"></div></div>'
    );
  }

  function cardHtml(venueName) {
    var spec = specFor(venueName);
    return '<div class="afs-card-scene" data-stadium="' + spec.id + '">' + stadiumSvg(spec, "card") + "</div>";
  }

  var API = {
    VENUES: VENUES,
    GENERIC: GENERIC,
    normKey: normKey,
    lookupVenue: lookupVenue,
    specFor: specFor,
    stadiumSvg: stadiumSvg,
    heroHtml: heroHtml,
    cardHtml: cardHtml,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = API;
  root.TBAflStadiums = API;
})(typeof window !== "undefined" ? window : globalThis);
