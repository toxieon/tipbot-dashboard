/* MCG pitch in metres. Origin at the centre. +x is the east goals, +z is the
   broadcast side, y is up. Painted sponsor slots match the ground-sponsor table. */
(function (root) {
  "use strict";

  var RX = 86.5;
  var RZ = 74;
  var BOUNDARY_X = 84;
  var BOUNDARY_Z = 71.5;
  var GOAL_X = 84;
  var POST_HALF = 3.2;
  var BEHIND = 9.6;
  var SQUARE = 50;
  var ARC_R = 50;

  var SLOTS = [
    { id: "centre", type: "centre", x: 0, z: 14, w: 24, h: 8, rot: 0 },
    { id: "arc-west", type: "arc", x: -62, z: 0, w: 18, h: 6, rot: -90 },
    { id: "arc-east", type: "arc", x: 62, z: 0, w: 18, h: 6, rot: 90 },
    { id: "wing-nw", type: "general", x: -18, z: -46, w: 12, h: 4, rot: 0 },
    { id: "wing-ne", type: "general", x: 18, z: -46, w: 12, h: 4, rot: 0 },
    { id: "wing-sw", type: "general", x: -18, z: 46, w: 12, h: 4, rot: 0 },
    { id: "wing-se", type: "general", x: 18, z: 46, w: 12, h: 4, rot: 0 },
    { id: "flank-nw", type: "general", x: -38, z: -38, w: 12, h: 4, rot: 0 },
    { id: "flank-ne", type: "general", x: 38, z: -38, w: 12, h: 4, rot: 0 },
    { id: "flank-sw", type: "general", x: -38, z: 38, w: 12, h: 4, rot: 0 },
    { id: "flank-se", type: "general", x: 38, z: 38, w: 12, h: 4, rot: 0 },
    { id: "emblem-home", type: "emblem", x: -29.5, z: 0, w: 7, h: 7, rot: 0, disc: true },
    { id: "emblem-away", type: "emblem", x: 29.5, z: 0, w: 7, h: 7, rot: 0, disc: true }
  ];

  function slotById(id) {
    for (var i = 0; i < SLOTS.length; i++) if (SLOTS[i].id === id) return SLOTS[i];
    return null;
  }

  /* Text-up at rot 0 points −z. rot −90 points text-up toward +x. */
  function slotFrame(slot) {
    var t = (slot.rot || 0) * Math.PI / 180;
    var cos = Math.cos(t);
    var sin = Math.sin(t);
    return {
      right: [cos, -sin],
      down: [sin, cos]
    };
  }

  function slotCorners(slot) {
    var frame = slotFrame(slot);
    var y = 0.26;
    var hx = slot.w / 2;
    var hz = slot.h / 2;
    var local = [[-hx, hz], [hx, hz], [hx, -hz], [-hx, -hz]];
    var out = [];
    for (var i = 0; i < local.length; i++) {
      var lx = local[i][0];
      var lz = local[i][1];
      out.push([
        slot.x + lx * frame.right[0] + lz * frame.down[0],
        y,
        slot.z + lx * frame.right[1] + lz * frame.down[1]
      ]);
    }
    return out;
  }

  function textUp(slot) {
    var frame = slotFrame(slot);
    return [-frame.down[0], -frame.down[1]];
  }

  function arcClearance(slot) {
    var corners = slotCorners(slot);
    var best = Infinity;
    var centres = [[-GOAL_X, 0], [GOAL_X, 0]];
    for (var i = 0; i < corners.length; i++) {
      for (var k = 0; k < centres.length; k++) {
        var dx = corners[i][0] - centres[k][0];
        var dz = corners[i][2] - centres[k][1];
        var d = Math.hypot(dx, dz);
        if (d < best) best = d;
      }
    }
    return best;
  }

  function onPitch(x, z) {
    return (x / BOUNDARY_X) * (x / BOUNDARY_X) + (z / BOUNDARY_Z) * (z / BOUNDARY_Z) <= 1;
  }

  var api = {
    RX: RX,
    RZ: RZ,
    BOUNDARY_X: BOUNDARY_X,
    BOUNDARY_Z: BOUNDARY_Z,
    GOAL_X: GOAL_X,
    POST_HALF: POST_HALF,
    BEHIND: BEHIND,
    SQUARE: SQUARE,
    ARC_R: ARC_R,
    SLOTS: SLOTS,
    slotById: slotById,
    slotCorners: slotCorners,
    textUp: textUp,
    arcClearance: arcClearance,
    onPitch: onPitch
  };

  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.TBMcgField = api;
  if (root && root.TD && root.TD.loaded) root.TD.loaded["mcg/field"] = true;
})(typeof window !== "undefined" ? window : globalThis);
