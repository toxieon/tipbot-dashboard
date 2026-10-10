/* Procedural stadium spec: traeger (tipdash assets). */
(function (root) {
  "use strict";
  root.StadiumSpecs = root.StadiumSpecs || {};
  root.StadiumSpecs.traeger = {
  "id": "traeger",
  "oval": {
    "rx": 0.78,
    "ry": 0.72
  },
  "tiers": 2,
  "tierStep": 0.11,
  "tierWidth": 0.09,
  "bowlHeight": 0.42,
  "stands": {
    "n": 1,
    "e": 1,
    "s": 1,
    "w": 1
  },
  "roof": {
    "mode": "none",
    "cantilever": 0.14,
    "ribs": 20,
    "opacity": 0.92
  },
  "towers": 6,
  "towerHeight": 0.58,
  "towerStyle": "panel",
  "windows": false,
  "fieldStripes": true,
  "palette": {
    "concrete": 6057346,
    "concreteLight": 8031651,
    "roof": 14213868,
    "roofShadow": 11057352,
    "field": 3119704,
    "fieldAlt": 2591308,
    "tower": 9083565,
    "light": 16774344,
    "window": 16771488,
    "hill": 4025162
  }
};
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { id: "traeger", spec: root.StadiumSpecs.traeger };
  }
})(typeof globalThis !== "undefined" ? globalThis : globalThis);
