/* Club intro metadata — colours come from assets/afl-guernseys.js (no logos). */
(function (root) {
  "use strict";

  var AFL_MEN = [
    { id: "adelaide", line1: "Adelaide", line2: "Crows" },
    { id: "brisbane", line1: "Brisbane", line2: "Lions" },
    { id: "carlton", line1: "Carlton", line2: "Blues" },
    { id: "collingwood", line1: "Collingwood", line2: "Magpies" },
    { id: "essendon", line1: "Essendon", line2: "Bombers" },
    { id: "fremantle", line1: "Fremantle", line2: "Dockers" },
    { id: "geelong", line1: "Geelong", line2: "Cats" },
    { id: "goldcoast", line1: "Gold Coast", line2: "Suns" },
    { id: "gws", line1: "GWS", line2: "Giants" },
    { id: "hawthorn", line1: "Hawthorn", line2: "Hawks" },
    { id: "melbourne", line1: "Melbourne", line2: "Demons" },
    { id: "northmelbourne", line1: "North Melbourne", line2: "Kangaroos" },
    { id: "portadelaide", line1: "Port Adelaide", line2: "Power" },
    { id: "richmond", line1: "Richmond", line2: "Tigers" },
    { id: "stkilda", line1: "St Kilda", line2: "Saints" },
    { id: "sydney", line1: "Sydney", line2: "Swans" },
    { id: "westcoast", line1: "West Coast", line2: "Eagles" },
    { id: "westernbulldogs", line1: "Western Bulldogs", line2: "Bulldogs" },
  ];

  var AFLW_EXTRA = [{ id: "tasmania", line1: "Tasmania", line2: "Devils", aflwOnly: true }];

  function galleryEntries() {
    var out = [];
    var i;
    for (i = 0; i < AFL_MEN.length; i++) {
      out.push({ clubId: AFL_MEN[i].id, league: "afl", label: AFL_MEN[i].line1 + " " + AFL_MEN[i].line2 });
    }
    for (i = 0; i < AFL_MEN.length; i++) {
      out.push({
        clubId: AFL_MEN[i].id,
        league: "aflw",
        label: AFL_MEN[i].line1 + " " + AFL_MEN[i].line2 + " (AFLW)",
      });
    }
    for (i = 0; i < AFLW_EXTRA.length; i++) {
      var e = AFLW_EXTRA[i];
      out.push({ clubId: e.id, league: "aflw", label: e.line1 + " " + e.line2 + " (AFLW)" });
    }
    return out;
  }

  function copyFor(clubId) {
    var i;
    for (i = 0; i < AFL_MEN.length; i++) {
      if (AFL_MEN[i].id === clubId) return AFL_MEN[i];
    }
    for (i = 0; i < AFLW_EXTRA.length; i++) {
      if (AFLW_EXTRA[i].id === clubId) return AFLW_EXTRA[i];
    }
    return { id: clubId, line1: "Club", line2: "" };
  }

  function menIds() {
    return AFL_MEN.map(function (c) {
      return c.id;
    });
  }

  var API = {
    AFL_MEN: AFL_MEN,
    AFLW_EXTRA: AFLW_EXTRA,
    galleryEntries: galleryEntries,
    copyFor: copyFor,
    menIds: menIds,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = API;
  root.TDClubIntroClubs = API;
})(typeof window !== "undefined" ? window : globalThis);
