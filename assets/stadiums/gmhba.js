/* Procedural stadium spec: gmhba (tipdash assets). */
(function (root) {
  "use strict";
  root.StadiumSpecs = root.StadiumSpecs || {};
  root.StadiumSpecs.gmhba = {
  "id": "gmhba",
  "oval": {
    "rx": 1.22,
    "ry": 0.72
  },
  "tiers": 4,
  "tierStep": 0.11,
  "tierWidth": 0.09,
  "bowlHeight": 0.42,
  "stands": {
    "n": 0.65,
    "e": 0.7,
    "s": 1.35,
    "w": 0.65
  },
  "roof": {
    "mode": "ring",
    "cantilever": 0.12,
    "ribs": 16,
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
    "south-stand"
  ]
};
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { id: "gmhba", spec: root.StadiumSpecs.gmhba };
  }
})(typeof globalThis !== "undefined" ? globalThis : globalThis);
