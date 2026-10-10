/* Animated club intro panels — TBAflGuernseys + TDClubIntroClubs + TDClubIntroMotifs. */
(function (root) {
  "use strict";

  var Guernseys = typeof require !== "undefined" ? require("../afl-guernseys.js") : root.TBAflGuernseys;
  var Clubs = typeof require !== "undefined" ? require("./clubs.js") : root.TDClubIntroClubs;
  var Motifs = typeof require !== "undefined" ? require("./motifs.js") : root.TDClubIntroMotifs;

  var _uid = 0;

  function specForClubId(clubId) {
    var list = Guernseys.CLUBS;
    var i;
    for (i = 0; i < list.length; i++) {
      if (list[i].id === clubId) return list[i];
    }
    return Guernseys.fallbackSpec();
  }

  function leagueLabel(league) {
    return league === "aflw" ? "AFLW" : "AFL";
  }

  function wordHtml(text, accent) {
    return (
      '<span class="ci-word' +
      (accent ? " ci-word--accent" : "") +
      '"><span class="ci-word-inner">' +
      escapeHtml(text) +
      "</span></span>"
    );
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderHtml(opts) {
    var clubId = opts.clubId || "carlton";
    var league = opts.league === "aflw" ? "aflw" : "afl";
    var copy = Clubs.copyFor(clubId);
    var spec = specForClubId(clubId);
    var uid = ++_uid;
    var guernsey = Guernseys.guernseySvg(copy.line1, null, 88);
    var motif = Motifs.motifSvg(spec.pattern, spec.primary, spec.secondary, uid);
    var reduced = opts.reducedMotion === true;
    var play = opts.animate !== false && !reduced;

    return (
      '<div class="ci-intro' +
      (league === "aflw" ? " ci-aflw" : "") +
      (play ? " ci-play" : " ci-static") +
      '" data-club="' +
      escapeHtml(clubId) +
      '" data-league="' +
      league +
      '" style="--ci-primary:' +
      spec.primary +
      ";--ci-secondary:" +
      spec.secondary +
      ";--ci-accent:" +
      (spec.accent || spec.secondary) +
      '">' +
      '<div class="ci-motif">' +
      motif +
      "</div>" +
      '<div class="ci-stage">' +
      '<div class="ci-guernsey-wrap">' +
      guernsey +
      "</div>" +
      '<h1 class="ci-title">' +
      wordHtml(copy.line1, false) +
      (copy.line2 ? wordHtml(copy.line2, true) : "") +
      "</h1>" +
      '<p class="ci-league">' +
      escapeHtml(leagueLabel(league)) +
      "</p>" +
      "</div></div>"
    );
  }

  function prefersReducedMotion() {
    try {
      return !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch (e) {
      return false;
    }
  }

  function mount(el, opts) {
    if (!el) return null;
    var o = opts || {};
    if (o.reducedMotion == null) o.reducedMotion = prefersReducedMotion();
    el.innerHTML = renderHtml(o);
    return el.firstElementChild || el;
  }

  function replay(panel) {
    if (!panel || !panel.classList) return;
    panel.classList.remove("ci-play", "ci-static");
    try {
      void panel.offsetWidth;
    } catch (e) {}
    if (prefersReducedMotion()) panel.classList.add("ci-static");
    else panel.classList.add("ci-play");
  }

  var API = {
    renderHtml: renderHtml,
    mount: mount,
    replay: replay,
    specForClubId: specForClubId,
    prefersReducedMotion: prefersReducedMotion,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = API;
  root.TDClubIntros = API;
})(typeof window !== "undefined" ? window : globalThis);
