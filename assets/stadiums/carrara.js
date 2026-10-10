/* Procedural stadium spec: carrara (tipdash assets). */
(function (root) {
  "use strict";
  root.StadiumSpecs = root.StadiumSpecs || {};
  root.StadiumSpecs.carrara = {
  "id": "carrara",
  "oval": {
    "rx": 1,
    "ry": 0.76
  },
  "tiers": 4,
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
    "mode": "ring",
    "cantilever": 0.11,
    "ribs": 14,
    "opacity": 0.92
  },
  "towers": 4,
  "towerHeight": 0.52,
  "towerStyle": "panel",
  "windows": true,
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
    module.exports = { id: "carrara", spec: root.StadiumSpecs.carrara };
  }
})(typeof globalThis !== "undefined" ? globalThis : globalThis);
