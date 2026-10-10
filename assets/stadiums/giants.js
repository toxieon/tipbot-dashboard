/* Procedural stadium spec: giants (tipdash assets). */
(function (root) {
  "use strict";
  root.StadiumSpecs = root.StadiumSpecs || {};
  root.StadiumSpecs.giants = {
  "id": "giants",
  "oval": {
    "rx": 1.02,
    "ry": 0.75
  },
  "tiers": 4,
  "tierStep": 0.11,
  "tierWidth": 0.09,
  "bowlHeight": 0.42,
  "stands": {
    "n": 0.7,
    "e": 1.2,
    "s": 0.75,
    "w": 0.7
  },
  "roof": {
    "mode": "ring",
    "cantilever": 0.16,
    "ribs": 18,
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
    module.exports = { id: "giants", spec: root.StadiumSpecs.giants };
  }
})(typeof globalThis !== "undefined" ? globalThis : globalThis);
