/* Low-poly 2000 MCG: oval pitch, tiered stands, southern roof, corner light towers.
   South (+z) is the tall stand. East (+x) stays low. Towers sit outside the corners. */
(function (root) {
  "use strict";

  var F = (root && root.TBMcgField) || (typeof require === "function" ? require("./field.js") : null);

  function Mesh(name) {
    this.name = name;
    this.positions = [];
    this.normals = [];
    this.uvs = [];
    this.colors = [];
    this.indices = [];
  }

  Mesh.prototype.vert = function (x, y, z, nx, ny, nz, u, v, col) {
    var i = this.positions.length / 3;
    this.positions.push(x, y, z);
    this.normals.push(nx, ny, nz);
    this.uvs.push(u, v);
    this.colors.push(col[0], col[1], col[2]);
    return i;
  };

  Mesh.prototype.tri = function (a, b, c) {
    this.indices.push(a, b, c);
  };

  Mesh.prototype.quad = function (a, b, c, d) {
    this.indices.push(a, b, c, a, c, d);
  };

  Mesh.prototype.finish = function (extra) {
    var body = {
      name: this.name,
      positions: this.positions,
      normals: this.normals,
      uvs: this.uvs,
      colors: this.colors,
      indices: this.indices
    };
    if (extra) {
      var k;
      for (k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) body[k] = extra[k];
    }
    return body;
  };

  function face(mesh, pts, col) {
    var ax = pts[1][0] - pts[0][0], ay = pts[1][1] - pts[0][1], az = pts[1][2] - pts[0][2];
    var bx = pts[2][0] - pts[0][0], by = pts[2][1] - pts[0][1], bz = pts[2][2] - pts[0][2];
    var nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    var len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    var ids = [];
    var i;
    for (i = 0; i < pts.length; i++) {
      var u = (i === 1 || i === 2) ? 1 : 0;
      var v = i >= 2 ? 1 : 0;
      ids.push(mesh.vert(pts[i][0], pts[i][1], pts[i][2], nx, ny, nz, u, v, col));
    }
    if (pts.length === 4) mesh.quad(ids[0], ids[1], ids[2], ids[3]);
    else mesh.tri(ids[0], ids[1], ids[2]);
  }

  function addBox(mesh, cx, cy, cz, hx, hy, hz, col, yaw) {
    var c = Math.cos(yaw || 0), s = Math.sin(yaw || 0);
    function p(x, y, z) {
      return [cx + x * c - z * s, cy + y, cz + x * s + z * c];
    }
    var v = [
      p(-hx, -hy, -hz), p(hx, -hy, -hz), p(hx, hy, -hz), p(-hx, hy, -hz),
      p(-hx, -hy, hz), p(hx, -hy, hz), p(hx, hy, hz), p(-hx, hy, hz)
    ];
    face(mesh, [v[0], v[1], v[2], v[3]], col);
    face(mesh, [v[5], v[4], v[7], v[6]], col);
    face(mesh, [v[4], v[0], v[3], v[7]], col);
    face(mesh, [v[1], v[5], v[6], v[2]], col);
    face(mesh, [v[3], v[2], v[6], v[7]], col);
    face(mesh, [v[4], v[5], v[1], v[0]], col);
  }

  function addCylinder(mesh, x, z, r0, r1, y0, y1, segs, col) {
    var i;
    for (i = 0; i < segs; i++) {
      var a0 = (i / segs) * Math.PI * 2;
      var a1 = ((i + 1) / segs) * Math.PI * 2;
      var c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      face(mesh, [
        [x + c0 * r0, y0, z + s0 * r0],
        [x + c0 * r0, y1, z + s0 * r0],
        [x + c1 * r1, y1, z + s1 * r1],
        [x + c1 * r0, y0, z + s1 * r0]
      ], col);
    }
  }

  /* 1 at the southern stand, about 0.4 at the low eastern pavilion. */
  function heightFactor(a) {
    function lobe(angle, centre, width, weight) {
      var d = Math.atan2(Math.sin(angle - centre), Math.cos(angle - centre));
      var x = Math.abs(d) / width;
      if (x >= 1) return 0;
      var t = 1 - x;
      var s = t * t * (3 - 2 * t);
      return s * weight;
    }
    var h = 0.38;
    h += lobe(a, Math.PI / 2, 1.2, 0.62);
    h += lobe(a, Math.PI, 0.95, 0.28);
    h += lobe(a, -Math.PI / 2, 1.05, 0.14);
    return h > 1 ? 1 : h;
  }

  function shellColor(a) {
    var east = Math.max(0, Math.cos(a));
    return [0.55 + east * 0.22, 0.57 + east * 0.04, 0.60 - east * 0.12];
  }

  var PROFILE_R = [1.17, 1.22, 1.38, 1.38, 1.54, 1.54, 1.72, 1.76, 1.80];
  var PROFILE_Y = [0.35, 1.2, 5.4, 7.2, 12.2, 14.4, 22.8, 23.6, 0];

  function profilePoint(a, row, h) {
    var y = (row === 0 || row === 8) ? PROFILE_Y[row] : PROFILE_Y[row] * h;
    return [Math.cos(a) * F.RX * PROFILE_R[row], y, Math.sin(a) * F.RZ * PROFILE_R[row]];
  }

  function band(name, row0, row1, seats) {
    var mesh = new Mesh(name);
    var N = 64;
    var cols = N + 1;
    var pts = [[], []];
    var c, r;
    for (c = 0; c < cols; c++) {
      var a = (c / N) * Math.PI * 2;
      var h = heightFactor(a);
      pts[0][c] = profilePoint(a, row0, h);
      pts[1][c] = profilePoint(a, row1, h);
    }
    var ids = [[], []];
    for (r = 0; r < 2; r++) {
      for (c = 0; c < cols; c++) {
        var a2 = (c / N) * Math.PI * 2;
        var p = pts[r][c];
        var prev = pts[r][c === 0 ? 0 : c - 1];
        var next = pts[r][c === cols - 1 ? cols - 1 : c + 1];
        var tx = next[0] - prev[0], ty = next[1] - prev[1], tz = next[2] - prev[2];
        var ux = pts[1][c][0] - pts[0][c][0];
        var uy = pts[1][c][1] - pts[0][c][1];
        var uz = pts[1][c][2] - pts[0][c][2];
        var nx = ty * uz - tz * uy, ny = tz * ux - tx * uz, nz = tx * uy - ty * ux;
        var len = Math.hypot(nx, ny, nz) || 1;
        if (ny < 0 && seats) { nx = -nx; ny = -ny; nz = -nz; }
        var col = seats ? [1, 1, 1] : shellColor(a2);
        var u = seats ? (c / N) * 8 : c / N;
        var v = seats ? row0 / 6 : r;
        ids[r][c] = mesh.vert(p[0], p[1], p[2], nx / len, ny / len, nz / len, u, v, col);
      }
    }
    for (c = 0; c < N; c++) mesh.quad(ids[0][c], ids[0][c + 1], ids[1][c + 1], ids[1][c]);
    return mesh.finish(seats ? { map: "crowd" } : { map: "" });
  }

  function addRoof(mesh) {
    var N = 64;
    var i;
    for (i = 0; i < N; i++) {
      var a0 = (i / N) * Math.PI * 2;
      var a1 = ((i + 1) / N) * Math.PI * 2;
      var h0 = heightFactor(a0);
      var h1 = heightFactor(a1);
      if (h0 < 0.55 && h1 < 0.55) continue;
      var h = Math.max(h0, h1);
      var y = 23.6 * h + 1.6;
      var inner = h > 0.82 ? 1.22 : 1.46;
      var outer = 1.82;
      function pt(a, rad, yy) {
        return [Math.cos(a) * F.RX * rad, yy, Math.sin(a) * F.RZ * rad];
      }
      var col = h > 0.82 ? [0.86, 0.88, 0.90] : [0.62, 0.64, 0.68];
      face(mesh, [pt(a0, outer, y), pt(a1, outer, y), pt(a1, inner, y), pt(a0, inner, y)], col);
      var under = [col[0] * 0.55, col[1] * 0.55, col[2] * 0.58];
      face(mesh, [pt(a0, inner, y - 0.7), pt(a1, inner, y - 0.7), pt(a1, outer, y - 0.7), pt(a0, outer, y - 0.7)], under);
    }
  }

  function addTowers(mesh, lamps) {
    var angles = [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4];
    var steel = [0.45, 0.48, 0.52];
    var i, k;
    for (i = 0; i < angles.length; i++) {
      var a = angles[i];
      var rad = 2.08;
      var x = Math.cos(a) * F.RX * rad;
      var z = Math.sin(a) * F.RZ * rad;
      var yaw = a + Math.PI;
      var legs = [[-1.15, -1.15], [1.15, -1.15], [1.15, 1.15], [-1.15, 1.15]];
      for (k = 0; k < legs.length; k++) {
        var lx = legs[k][0], lz = legs[k][1];
        var c = Math.cos(yaw), s = Math.sin(yaw);
        addBox(mesh, x + lx * c - lz * s, 34, z + lx * s + lz * c, 0.28, 34, 0.28, steel, yaw);
      }
      addBox(mesh, x, 69.2, z, 6.2, 2.4, 3.4, steel, yaw);
      /* Lamp face points back toward the centre of the ground. */
      var ix = x - Math.cos(a) * 3.6;
      var iz = z - Math.sin(a) * 3.6;
      var tx = -Math.sin(a);
      var tz = Math.cos(a);
      face(lamps, [
        [ix - tx * 5.4, 66.6, iz - tz * 5.4],
        [ix + tx * 5.4, 66.6, iz + tz * 5.4],
        [ix + tx * 5.4, 72.2, iz + tz * 5.4],
        [ix - tx * 5.4, 72.2, iz - tz * 5.4]
      ], [1, 1, 1]);
    }
  }

  function addPosts(mesh) {
    var white = [0.93, 0.94, 0.92];
    var pad = [0.82, 0.83, 0.8];
    var ends = [-1, 1];
    var e, s;
    for (e = 0; e < ends.length; e++) {
      var x = ends[e] * F.GOAL_X;
      var posts = [[-F.BEHIND, 11, 0.12], [-F.POST_HALF, 16, 0.16], [F.POST_HALF, 16, 0.16], [F.BEHIND, 11, 0.12]];
      for (s = 0; s < posts.length; s++) {
        addCylinder(mesh, x, posts[s][0], posts[s][2], posts[s][2], 0, posts[s][1], 7, white);
        addCylinder(mesh, x, posts[s][0], 0.42, 0.42, 0, 0.35, 7, pad);
      }
    }
  }

  function addPitch(mesh) {
    var centre = mesh.vert(0, 0, 0, 0, 1, 0, 0.5, 0.5, [1, 1, 1]);
    var N = 56;
    var ring = [];
    var i;
    for (i = 0; i <= N; i++) {
      var a = (i / N) * Math.PI * 2;
      var x = Math.cos(a) * F.RX;
      var z = Math.sin(a) * F.RZ;
      ring.push(mesh.vert(x, 0, z, 0, 1, 0, 0.5 + x / (2 * F.RX), 0.5 + z / (2 * F.RZ), [1, 1, 1]));
    }
    for (i = 0; i < N; i++) mesh.tri(centre, ring[i], ring[i + 1]);
  }

  function addMarkings(mesh) {
    var y = 0.27;
    var col = [1, 1, 1];
    var a = mesh.vert(-F.RX, y, -F.RZ, 0, 1, 0, 0, 0, col);
    var b = mesh.vert(F.RX, y, -F.RZ, 0, 1, 0, 1, 0, col);
    var c = mesh.vert(F.RX, y, F.RZ, 0, 1, 0, 1, 1, col);
    var d = mesh.vert(-F.RX, y, F.RZ, 0, 1, 0, 0, 1, col);
    mesh.quad(a, b, c, d);
  }

  function addSlots(list) {
    var meshes = [];
    var i;
    for (i = 0; i < F.SLOTS.length; i++) {
      var slot = F.SLOTS[i];
      var mesh = new Mesh("slot:" + slot.id);
      var corners = F.slotCorners(slot);
      /* v=0 is the text-up edge (−z when rot is 0). Canvas top stays v=0. */
      var uv = [[0, 1], [1, 1], [1, 0], [0, 0]];
      var ids = [];
      var k;
      for (k = 0; k < 4; k++) {
        ids.push(mesh.vert(corners[k][0], corners[k][1], corners[k][2], 0, 1, 0, uv[k][0], uv[k][1], [1, 1, 1]));
      }
      mesh.quad(ids[0], ids[1], ids[2], ids[3]);
      meshes.push(mesh.finish({
        map: "slot",
        slotId: slot.id,
        transparent: true,
        alpha: 0,
        depthWrite: false,
        polygonOffset: -4,
        disc: !!slot.disc
      }));
    }
    return meshes;
  }

  function addBoards(mesh) {
    var N = 80;
    var rx = 88.7;
    var rz = 76.1;
    var y0 = 0.2;
    var h = 1.55;
    var len = 0;
    var prev = null;
    var bot = [];
    var top = [];
    var i;
    for (i = 0; i <= N; i++) {
      var a = (i / N) * Math.PI * 2;
      var x = Math.cos(a) * rx;
      var z = Math.sin(a) * rz;
      if (prev) len += Math.hypot(x - prev[0], z - prev[1]);
      prev = [x, z];
      var u = len / 12;
      var nx = Math.cos(a), nz = Math.sin(a);
      bot.push(mesh.vert(x, y0, z, nx, 0, nz, u, 0, [1, 1, 1]));
      top.push(mesh.vert(x, y0 + h, z, nx, 0, nz, u, 1, [1, 1, 1]));
    }
    for (i = 0; i < N; i++) mesh.quad(bot[i], top[i], top[i + 1], bot[i + 1]);
    return len;
  }

  function addApron(mesh) {
    var centre = mesh.vert(0, -0.04, 0, 0, 1, 0, 0.5, 0.5, [0.22, 0.24, 0.26]);
    var N = 40;
    var ring = [];
    var i;
    for (i = 0; i <= N; i++) {
      var a = (i / N) * Math.PI * 2;
      ring.push(mesh.vert(Math.cos(a) * 230, -0.04, Math.sin(a) * 210, 0, 1, 0, 0, 0, [0.22, 0.24, 0.26]));
    }
    for (i = 0; i < N; i++) mesh.tri(centre, ring[i], ring[i + 1]);
  }

  function addCones(mesh) {
    var angles = [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4];
    var i, k;
    for (i = 0; i < angles.length; i++) {
      var a = angles[i];
      var x = Math.cos(a) * F.RX * 2.08;
      var z = Math.sin(a) * F.RZ * 2.08;
      var y = 68;
      var tx = x * 0.25;
      var tz = z * 0.25;
      var segs = 6;
      for (k = 0; k < segs; k++) {
        var a0 = (k / segs) * Math.PI * 2;
        var a1 = ((k + 1) / segs) * Math.PI * 2;
        face(mesh, [
          [x + Math.cos(a0) * 1.2, y, z + Math.sin(a0) * 1.2],
          [x + Math.cos(a1) * 1.2, y, z + Math.sin(a1) * 1.2],
          [tx + Math.cos(a1) * 16, 0.5, tz + Math.sin(a1) * 16],
          [tx + Math.cos(a0) * 16, 0.5, tz + Math.sin(a0) * 16]
        ], [1, 0.94, 0.82]);
      }
    }
  }

  function ellipsoid(mesh, rx, ry, rz) {
    var su = 12, sv = 8;
    var grid = [];
    var u, v;
    for (v = 0; v <= sv; v++) {
      grid[v] = [];
      var phi = (v / sv) * Math.PI;
      for (u = 0; u <= su; u++) {
        var th = (u / su) * Math.PI * 2;
        var x = Math.sin(phi) * Math.cos(th);
        var y = Math.cos(phi);
        var z = Math.sin(phi) * Math.sin(th);
        var px = x * rx, py = y * ry, pz = z * rz;
        var nx = x / (rx * rx), ny = y / (ry * ry), nz = z / (rz * rz);
        var len = Math.hypot(nx, ny, nz) || 1;
        grid[v][u] = mesh.vert(px, py, pz, nx / len, ny / len, nz / len, u / su, v / sv, [1, 1, 1]);
      }
    }
    for (v = 0; v < sv; v++) {
      for (u = 0; u < su; u++) {
        mesh.quad(grid[v][u], grid[v][u + 1], grid[v + 1][u + 1], grid[v + 1][u]);
      }
    }
  }

  function stadium() {
    var apron = new Mesh("Apron");
    addApron(apron);
    var pitch = new Mesh("Pitch");
    addPitch(pitch);
    var marks = new Mesh("Markings");
    addMarkings(marks);
    var seats = new Mesh("Seats");
    var shell = new Mesh("Shell");
    [[1, 2, true], [3, 4, true], [5, 6, true]].forEach(function (span) {
      var part = band("seat", span[0], span[1], true);
      seats.positions.push.apply(seats.positions, part.positions);
      seats.normals.push.apply(seats.normals, part.normals);
      seats.uvs.push.apply(seats.uvs, part.uvs);
      seats.colors.push.apply(seats.colors, part.colors);
      var base = (seats.positions.length / 3) - (part.positions.length / 3);
      var i;
      for (i = 0; i < part.indices.length; i++) seats.indices.push(part.indices[i] + base);
    });
    [[0, 1], [2, 3], [4, 5], [6, 7], [7, 8]].forEach(function (span) {
      var part = band("shell", span[0], span[1], false);
      var base = shell.positions.length / 3;
      shell.positions.push.apply(shell.positions, part.positions);
      shell.normals.push.apply(shell.normals, part.normals);
      shell.uvs.push.apply(shell.uvs, part.uvs);
      shell.colors.push.apply(shell.colors, part.colors);
      var i;
      for (i = 0; i < part.indices.length; i++) shell.indices.push(part.indices[i] + base);
    });
    var roof = new Mesh("Roof");
    addRoof(roof);
    var towers = new Mesh("Towers");
    var lamps = new Mesh("Lamps");
    addTowers(towers, lamps);
    var posts = new Mesh("Posts");
    addPosts(posts);
    var boards = new Mesh("Boards");
    var boardLen = addBoards(boards);
    var cones = new Mesh("Cones");
    addCones(cones);
    var ball = new Mesh("Ball");
    ellipsoid(ball, 0.55, 0.4, 0.4);
    var meshes = [
      apron.finish({ map: "" }),
      pitch.finish({ map: "grass" }),
      seats.finish({ map: "crowd" }),
      shell.finish({ map: "" }),
      roof.finish({ map: "" }),
      towers.finish({ map: "" }),
      lamps.finish({ map: "lamps", emissive: 1 }),
      posts.finish({ map: "" }),
      boards.finish({ map: "boards", emissive: 1, flip: true })
    ].concat(addSlots());
    /* Line paint sits above the sponsor slots. */
    meshes.push(marks.finish({ map: "marks", transparent: true, alpha: 1, depthWrite: false, polygonOffset: -2 }));
    meshes.push(cones.finish({ map: "", transparent: true, alpha: 0.1, depthWrite: false, nightOnly: true }));
    meshes.push(ball.finish({ map: "ball", emissive: 0.15 }));
    var triangles = 0;
    var i;
    for (i = 0; i < meshes.length; i++) triangles += meshes[i].indices.length / 3;
    return { meshes: meshes, triangles: triangles, boardLength: boardLen };
  }

  var api = {
    heightFactor: heightFactor,
    stadium: stadium
  };

  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.TBMcgBuild = api;
  if (root && root.TD && root.TD.loaded) root.TD.loaded["mcg/build"] = true;
})(typeof window !== "undefined" ? window : globalThis);
