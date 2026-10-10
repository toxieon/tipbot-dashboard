/* Procedural stadium spec: mcg (tipdash assets). */
(function (root) {
  "use strict";
  root.StadiumSpecs = root.StadiumSpecs || {};
  root.StadiumSpecs.mcg = {
  "id": "mcg",
  "oval": {
    "rx": 1.32,
    "ry": 1.28
  },
  "tiers": 6,
  "tierStep": 0.1,
  "tierWidth": 0.095,
  "bowlHeight": 0.42,
  "stands": {
    "n": 1,
    "e": 1,
    "s": 1,
    "w": 1
  },
  "roof": {
    "mode": "ring",
    "cantilever": 0.18,
    "ribs": 28,
    "opacity": 0.92
  },
  "towers": 4,
  "towerHeight": 0.62,
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
    module.exports = { id: "mcg", spec: root.StadiumSpecs.mcg };
  }
})(typeof globalThis !== "undefined" ? globalThis : globalThis);
