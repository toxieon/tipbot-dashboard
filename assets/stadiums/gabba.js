/* Procedural stadium spec: gabba (tipdash assets). */
(function (root) {
  "use strict";
  root.StadiumSpecs = root.StadiumSpecs || {};
  root.StadiumSpecs.gabba = {
  "id": "gabba",
  "oval": {
    "rx": 0.92,
    "ry": 0.78
  },
  "tiers": 5,
  "tierStep": 0.12,
  "tierWidth": 0.09,
  "bowlHeight": 0.42,
  "stands": {
    "n": 1.05,
    "e": 1.08,
    "s": 1.05,
    "w": 1.08
  },
  "roof": {
    "mode": "none",
    "cantilever": 0.14,
    "ribs": 20,
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
    module.exports = { id: "gabba", spec: root.StadiumSpecs.gabba };
  }
})(typeof globalThis !== "undefined" ? globalThis : globalThis);
