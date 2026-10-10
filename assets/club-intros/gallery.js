/* Preview gallery helper for labs/club-intros (not shipped). */
(function (root) {
  "use strict";

  var Clubs = typeof require !== "undefined" ? require("./clubs.js") : root.TDClubIntroClubs;
  var Intro = typeof require !== "undefined" ? require("./intro.js") : root.TDClubIntros;

  function mountGallery(gridEl, opts) {
    if (!gridEl) return;
    var entries = Clubs.galleryEntries();
    var html = "";
    var i;
    var cardH = (opts && opts.cardHeight) || 280;
    for (i = 0; i < entries.length; i++) {
      var e = entries[i];
      html +=
        '<article class="ci-card" data-club="' +
        e.clubId +
        '" data-league="' +
        e.league +
        '">' +
        '<header class="ci-card-head">' +
        '<span class="ci-card-title">' +
        e.label +
        "</span>" +
        '<button type="button" class="ci-replay" aria-label="Replay intro for ' +
        e.label.replace(/"/g, "") +
        '">Replay</button>' +
        "</header>" +
        '<div class="ci-card-stage" style="min-height:' +
        cardH +
        'px">' +
        Intro.renderHtml({ clubId: e.clubId, league: e.league, animate: true }) +
        "</div></article>";
    }
    gridEl.innerHTML = html;
    gridEl.addEventListener("click", function (ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest(".ci-replay") : null;
      if (!btn) return;
      var card = btn.closest(".ci-card");
      if (!card) return;
      var stage = card.querySelector(".ci-stage") || card.querySelector(".ci-intro");
      var panel = card.querySelector(".ci-intro");
      if (panel) Intro.replay(panel);
    });
  }

  var API = { mountGallery: mountGallery };

  if (typeof module !== "undefined" && module.exports) module.exports = API;
  root.TDClubIntroGallery = API;
})(typeof window !== "undefined" ? window : globalThis);
