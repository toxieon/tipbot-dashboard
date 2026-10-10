/* Procedural stadium spec: marvel (tipdash assets). */
(function (root) {
  "use strict";
  root.StadiumSpecs = root.StadiumSpecs || {};
  root.StadiumSpecs.marvel = {
  "id": "marvel",
  "oval": {
    "rx": 1.05,
    "ry": 0.72
  },
  "tiers": 5,
  "tierStep": 0.09,
  "tierWidth": 0.09,
  "bowlHeight": 0.42,
  "stands": {
    "n": 0.95,
    "e": 0.9,
    "s": 0.95,
    "w": 0.9
  },
  "roof": {
    "mode": "full",
    "cantilever": 0.1,
    "ribs": 0,
    "opacity": 0.92
  },
  "towers": 0,
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
    module.exports = { id: "marvel", spec: root.StadiumSpecs.marvel };
  }
})(typeof globalThis !== "undefined" ? globalThis : globalThis);
