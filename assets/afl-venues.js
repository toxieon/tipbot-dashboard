/* AFL venue keys for stylised stadium heroes (tipdash). TBAflVenues + CommonJS for node --test. */
(function (root) {
  "use strict";

  var VENUES = {
    mcg: {
      label: "MCG",
      aliases: ["mcg", "m c g", "melbourne cricket ground", "melb cricket ground"],
    },
    marvel: {
      label: "Marvel Stadium",
      aliases: ["marvel", "docklands", "etihad", "marvel stadium", "tio stadium"],
    },
    adelaide: {
      label: "Adelaide Oval",
      aliases: ["adelaide oval", "adelaide"],
    },
    optus: {
      label: "Optus Stadium",
      aliases: ["optus", "perth stadium", "perth optus", "optus stadium"],
    },
    gabba: {
      label: "The Gabba",
      aliases: ["gabba", "the gabba", "brisbane cricket ground"],
    },
    scg: {
      label: "SCG",
      aliases: ["scg", "s c g", "sydney cricket ground"],
    },
    giants: {
      label: "ENGIE Stadium",
      aliases: ["engie", "giants", "gws", "sydney showground", "showground", "giants stadium", "engie stadium"],
    },
    gmhba: {
      label: "GMHBA Stadium",
      aliases: ["gmhba", "kardinia", "kardinia park", "gmhba stadium"],
    },
    people_first: {
      label: "People First Stadium",
      aliases: ["people first", "peoples first", "metricon", "heritage bank", "carrara"],
    },
    utas: {
      label: "UTAS Stadium",
      aliases: ["utas", "ninja", "york park", "university of tasmania", "utas stadium"],
    },
    manuka: {
      label: "Manuka Oval",
      aliases: ["manuka", "manuka oval"],
    },
    blundstone: {
      label: "Blundstone Arena",
      aliases: ["blundstone", "bellerive", "bellerive oval", "blundstone arena"],
    },
  };

  function normVenue(name) {
    return String(name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function venueKey(venueName) {
    var n = normVenue(venueName);
    if (!n) return null;
    var keys = Object.keys(VENUES);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var spec = VENUES[k];
      var label = normVenue(spec.label);
      if (n === label || n.indexOf(label) >= 0 || label.indexOf(n) >= 0) return k;
      var aliases = spec.aliases || [];
      for (var j = 0; j < aliases.length; j++) {
        var a = normVenue(aliases[j]);
        if (!a) continue;
        if (n === a || n.indexOf(a) >= 0 || a.indexOf(n) >= 0) return k;
      }
    }
    return null;
  }

  function posterPath(key, version) {
    if (!key || !VENUES[key]) return null;
    var v = version != null ? String(version) : "";
    return "./assets/stadiums/" + key + ".png?v=" + encodeURIComponent(v);
  }

  var API = {
    VENUES: VENUES,
    normVenue: normVenue,
    venueKey: venueKey,
    posterPath: posterPath,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = API;
  root.TBAflVenues = API;
  if (typeof window !== "undefined" && window.TD) window.TD.loaded = window.TD.loaded || {};
  if (typeof window !== "undefined" && window.TD) window.TD.loaded["afl-venues"] = true;
})(typeof window !== "undefined" ? window : globalThis);
