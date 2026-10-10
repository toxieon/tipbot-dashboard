/* Mascot-free geometric motifs keyed by guernsey pattern id. */
(function (root) {
  "use strict";

  function motifSvg(pattern, primary, secondary, uid) {
    var p = primary || "#2a3550";
    var s = secondary || "#8b93a7";
    var gid = "ci-motif-" + uid;
    var inner = "";
    switch (pattern) {
      case "hoops":
        inner =
          '<g opacity=".22">' +
          '<rect x="0" y="24" width="120" height="8" fill="' +
          s +
          '" rx="2"/>' +
          '<rect x="0" y="44" width="120" height="8" fill="' +
          s +
          '" rx="2"/>' +
          '<rect x="0" y="64" width="120" height="8" fill="' +
          s +
          '" rx="2"/>' +
          "</g>";
        break;
      case "sash":
      case "sash-v":
        inner =
          '<polygon opacity=".2" points="8,8 112,96 96,104 4,20" fill="' +
          s +
          '"/>' +
          '<polygon opacity=".12" points="20,0 120,72 108,84 12,16" fill="' +
          p +
          '"/>';
        break;
      case "split-v":
      case "split-h":
        inner =
          '<rect x="0" y="0" width="60" height="112" fill="' +
          p +
          '" opacity=".14"/>' +
          '<rect x="60" y="0" width="60" height="112" fill="' +
          s +
          '" opacity=".14"/>';
        break;
      case "yoke":
        inner =
          '<path opacity=".18" d="M12 28 L60 56 L108 28 L108 44 L60 72 L12 44 Z" fill="' +
          s +
          '"/>';
        break;
      case "band":
        inner = '<rect x="0" y="40" width="120" height="28" fill="' + s + '" opacity=".16" rx="4"/>';
        break;
      case "panel":
        inner =
          '<rect x="0" y="0" width="18" height="112" fill="' +
          s +
          '" opacity=".18"/>' +
          '<rect x="102" y="0" width="18" height="112" fill="' +
          s +
          '" opacity=".18"/>';
        break;
      case "chevron":
        inner =
          '<polygon opacity=".2" points="60,16 88,48 72,48 60,36 48,48 32,48" fill="' +
          s +
          '"/>' +
          '<rect x="44" y="48" width="32" height="40" fill="' +
          p +
          '" opacity=".12" rx="2"/>';
        break;
      case "monogram":
        inner = '<ellipse cx="60" cy="56" rx="32" ry="36" fill="' + s + '" opacity=".14"/>';
        break;
      default:
        inner = '<circle cx="60" cy="56" r="40" fill="' + p + '" opacity=".1"/>';
    }
    return (
      '<svg class="ci-motif-svg" viewBox="0 0 120 112" aria-hidden="true" focusable="false">' +
      '<defs><linearGradient id="' +
      gid +
      '" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0%" stop-color="' +
      p +
      '"/>' +
      '<stop offset="100%" stop-color="' +
      s +
      '"/>' +
      "</linearGradient></defs>" +
      '<rect width="120" height="112" fill="url(#' +
      gid +
      ')" opacity=".06"/>' +
      inner +
      "</svg>"
    );
  }

  var API = { motifSvg: motifSvg };

  if (typeof module !== "undefined" && module.exports) module.exports = API;
  root.TDClubIntroMotifs = API;
})(typeof window !== "undefined" ? window : globalThis);
