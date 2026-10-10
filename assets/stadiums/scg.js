/* Procedural stadium spec: scg (tipdash assets). */
(function (root) {
  "use strict";
  root.StadiumSpecs = root.StadiumSpecs || {};
  root.StadiumSpecs.scg = {
  "id": "scg",
  "oval": {
    "rx": 0.98,
    "ry": 0.8
  },
  "tiers": 4,
  "tierStep": 0.11,
  "tierWidth": 0.09,
  "bowlHeight": 0.42,
  "stands": {
    "n": 0.75,
    "e": 1.25,
    "s": 0.8,
    "w": 0.9
  },
  "roof": {
    "mode": "ring",
    "cantilever": 0.1,
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
  },
  "features": [
    "heritage-pavilion"
  ]
};
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { id: "scg", spec: root.StadiumSpecs.scg };
  }
})(typeof globalThis !== "undefined" ? globalThis : globalThis);
