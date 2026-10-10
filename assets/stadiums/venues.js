/* AFL stadium asset registry (tipdash). CommonJS + browser StadiumVenues. */
(function (root) {
  "use strict";
  var VENUES = [
  {
    "id": "mcg",
    "label": "MCG",
    "aliases": [
      "mcg",
      "m.c.g.",
      "melbournecricketground",
      "melbournecricket"
    ]
  },
  {
    "id": "marvel",
    "label": "Marvel Stadium",
    "aliases": [
      "marvel",
      "docklands",
      "etihad",
      "marvelstadium",
      "dockland"
    ]
  },
  {
    "id": "adelaide",
    "label": "Adelaide Oval",
    "aliases": [
      "adelaideoval",
      "adelaide"
    ]
  },
  {
    "id": "optus",
    "label": "Optus Stadium",
    "aliases": [
      "optus",
      "perthstadium",
      "perth",
      "burswood"
    ]
  },
  {
    "id": "gabba",
    "label": "The Gabba",
    "aliases": [
      "gabba",
      "brisbanecricketground",
      "woolloongabba"
    ]
  },
  {
    "id": "scg",
    "label": "SCG",
    "aliases": [
      "scg",
      "s.c.g.",
      "sydneycricketground"
    ]
  },
  {
    "id": "giants",
    "label": "Engie Stadium",
    "aliases": [
      "giants",
      "showground",
      "sydneyshowground",
      "engie",
      "greaterwesternsydney",
      "manningroad"
    ]
  },
  {
    "id": "gmhba",
    "label": "GMHBA Stadium",
    "aliases": [
      "gmhba",
      "kardinia",
      "kardiniapark",
      "geelong",
      "skilled"
    ]
  },
  {
    "id": "carrara",
    "label": "People First Stadium",
    "aliases": [
      "carrara",
      "peoplefirst",
      "metricon",
      "heritagebank",
      "goldcoast"
    ]
  },
  {
    "id": "bellerive",
    "label": "UTAS Stadium",
    "aliases": [
      "bellerive",
      "belleriveoval",
      "blundstone",
      "hobart"
    ]
  },
  {
    "id": "manuka",
    "label": "Manuka Oval",
    "aliases": [
      "manuka",
      "manukaoval",
      "canberra"
    ]
  },
  {
    "id": "norwood",
    "label": "Norwood Oval",
    "aliases": [
      "norwood",
      "norwoodoval",
      "redlegs"
    ]
  },
  {
    "id": "yorkpark",
    "label": "York Park",
    "aliases": [
      "yorkpark",
      "utasstadium",
      "universityoftasmania",
      "launceston",
      "utaslaunceston"
    ]
  },
  {
    "id": "traeger",
    "label": "Traeger Park",
    "aliases": [
      "traeger",
      "traegerpark",
      "alice",
      "alicesprings",
      "tio"
    ]
  },
  {
    "id": "marrara",
    "label": "Marrara Oval",
    "aliases": [
      "marrara",
      "marraraoval",
      "darwin",
      "northernterritory"
    ]
  },
  {
    "id": "barossa",
    "label": "Barossa Park",
    "aliases": [
      "barossa",
      "barossapark",
      "nuriootpa"
    ]
  },
  {
    "id": "hands",
    "label": "Hands Oval",
    "aliases": [
      "hands",
      "handsoval",
      "ballarat"
    ]
  }
];
  var GENERIC_ID = "generic";
  function normVenue(name) {
    return String(name || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "");
  }
  function venueId(name) {
    var k = normVenue(name);
    if (!k) return GENERIC_ID;
    var best = null, bestLen = 0;
    for (var i = 0; i < VENUES.length; i++) {
      var v = VENUES[i];
      for (var j = 0; j < v.aliases.length; j++) {
        var a = normVenue(v.aliases[j]);
        if (!a) continue;
        if (k === a || k.indexOf(a) >= 0 || a.indexOf(k) >= 0) {
          if (a.length > bestLen) { best = v.id; bestLen = a.length; }
        }
      }
    }
    return best || GENERIC_ID;
  }
  function svgFile(id) { return (id || GENERIC_ID) + ".svg"; }
  var STADIUM_IDS = VENUES.map(function (v) { return v.id; }).concat([GENERIC_ID]);
  var API = { VENUES: VENUES, GENERIC_ID: GENERIC_ID, STADIUM_IDS: STADIUM_IDS, normVenue: normVenue, venueId: venueId, svgFile: svgFile };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  root.StadiumVenues = API;
})(typeof window !== "undefined" ? window : globalThis);
