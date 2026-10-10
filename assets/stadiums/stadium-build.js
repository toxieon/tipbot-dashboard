/**
 * Procedural AFL stadium meshes (Apple Maps–inspired style, original geometry).
 * Browser: window.StadiumBuild.build(THREE, spec) → THREE.Group
 * Node: module.exports for tests.
 */
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
  } else {
    root.StadiumBuild = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var PALETTE = {
    concrete: 0x5c6d82,
    concreteLight: 0x7a8da3,
    roof: 0xd8e2ec,
    roofShadow: 0xa8b8c8,
    field: 0x2f9a58,
    fieldAlt: 0x278a4c,
    tower: 0x8a9aad,
    light: 0xfff4c8,
    window: 0xffe9a0,
    hill: 0x3d6b4a,
  };

  function mergeSpec(base, overrides) {
    var out = JSON.parse(JSON.stringify(base));
    var keys = Object.keys(overrides || {});
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (overrides[k] && typeof overrides[k] === "object" && !Array.isArray(overrides[k]) && out[k]) {
        Object.assign(out[k], overrides[k]);
      } else {
        out[k] = overrides[k];
      }
    }
    return out;
  }

  var BASE_SPEC = {
    id: "generic",
    oval: { rx: 1.05, ry: 0.78 },
    tiers: 4,
    tierStep: 0.11,
    tierWidth: 0.09,
    bowlHeight: 0.42,
    stands: { n: 1, e: 1, s: 1, w: 1 },
    roof: { mode: "ring", cantilever: 0.14, ribs: 20, opacity: 0.92 },
    towers: 4,
    towerHeight: 0.52,
    towerStyle: "panel",
    windows: true,
    fieldStripes: true,
    palette: PALETTE,
  };

  function mat(THREE, color, opts) {
    opts = opts || {};
    return new THREE.MeshStandardMaterial({
      color: color,
      roughness: opts.roughness != null ? opts.roughness : 0.62,
      metalness: opts.metalness != null ? opts.metalness : 0.08,
      emissive: opts.emissive || 0x000000,
      emissiveIntensity: opts.emissiveIntensity || 0,
      transparent: !!opts.transparent,
      opacity: opts.opacity != null ? opts.opacity : 1,
      side: opts.side || THREE.FrontSide,
    });
  }

  function standHeightAt(spec, angle) {
    var sn = spec.stands.n,
      ss = spec.stands.s,
      se = spec.stands.e,
      sw = spec.stands.w;
    var c = Math.cos(angle);
    var s = Math.sin(angle);
    var qn = Math.max(0, c);
    var qs = Math.max(0, -c);
    var qe = Math.max(0, s);
    var qw = Math.max(0, -s);
    var sum = qn + qs + qe + qw || 1;
    return (qn * sn + qs * ss + qe * se + qw * sw) / sum;
  }

  function createField(THREE, spec) {
    var g = new THREE.Group();
    var p = spec.palette || PALETTE;
    var rx = spec.oval.rx * 0.92;
    var ry = spec.oval.ry * 0.92;
    var base = new THREE.Mesh(
      new THREE.CircleGeometry(1, 64),
      mat(THREE, p.field, { roughness: 0.85 })
    );
    base.rotation.x = -Math.PI / 2;
    base.scale.set(rx, ry, 1);
    base.receiveShadow = true;
    g.add(base);
    if (spec.fieldStripes) {
      for (var i = 0; i < 14; i++) {
        var stripe = new THREE.Mesh(
          new THREE.PlaneGeometry(rx * 1.85, ry * 0.055),
          mat(THREE, i % 2 ? p.fieldAlt : p.field, { roughness: 0.9 })
        );
        stripe.rotation.x = -Math.PI / 2;
        stripe.position.y = 0.002;
        stripe.position.z = (i - 6.5) * ry * 0.13;
        stripe.receiveShadow = true;
        g.add(stripe);
      }
    }
    var centre = new THREE.Mesh(
      new THREE.RingGeometry(0.04, 0.055, 32),
      mat(THREE, 0xffffff, { roughness: 0.9, transparent: true, opacity: 0.35 })
    );
    centre.rotation.x = -Math.PI / 2;
    centre.scale.set(rx, ry, 1);
    g.add(centre);
    return g;
  }

  function createTierBowl(THREE, spec) {
    var group = new THREE.Group();
    var p = spec.palette || PALETTE;
    var rx0 = spec.oval.rx;
    var ry0 = spec.oval.ry;
    var segments = 64;
    for (var t = 0; t < spec.tiers; t++) {
      var y = t * spec.tierStep;
      var rx = rx0 + t * spec.tierWidth;
      var ry = ry0 + t * spec.tierWidth;
      var tube = spec.tierWidth * 0.48;
      for (var s = 0; s < segments; s++) {
        var ang = (s / segments) * Math.PI * 2;
        var sh = standHeightAt(spec, ang);
        if (sh < 0.2) continue;
        var arc = new THREE.Mesh(
          new THREE.TorusGeometry(1, tube, 6, 6, (Math.PI * 2) / segments + 0.02),
          mat(THREE, t % 2 ? p.concreteLight : p.concrete, { roughness: 0.58 })
        );
        arc.rotation.x = Math.PI / 2;
        arc.rotation.z = ang;
        arc.position.y = y + spec.tierStep * 0.45 * sh;
        arc.scale.set(rx, ry, 1);
        arc.castShadow = true;
        arc.receiveShadow = true;
        group.add(arc);
      }
      var fascia = new THREE.Mesh(
        new THREE.TorusGeometry(1, tube * 0.35, 8, segments),
        mat(THREE, p.concreteLight, { roughness: 0.5 })
      );
      fascia.rotation.x = Math.PI / 2;
      fascia.position.y = y + spec.tierStep * 0.15;
      fascia.scale.set(rx + tube * 0.6, ry + tube * 0.6, 1);
      fascia.castShadow = true;
      group.add(fascia);
    }
    return group;
  }

  function createRoof(THREE, spec) {
    var roof = spec.roof || {};
    if (roof.mode === "none") return new THREE.Group();
    var g = new THREE.Group();
    var p = spec.palette || PALETTE;
    var y = spec.tiers * spec.tierStep + 0.02;
    var rx = spec.oval.rx + spec.tiers * spec.tierWidth + roof.cantilever * 0.3;
    var ry = spec.oval.ry + spec.tiers * spec.tierWidth + roof.cantilever * 0.3;
    if (roof.mode === "full") {
      var cap = new THREE.Mesh(
        new THREE.CylinderGeometry(1, 1.02, 0.08, 64, 1, true),
        mat(THREE, p.roof, { roughness: 0.45, side: THREE.DoubleSide })
      );
      cap.position.y = y + 0.12;
      cap.scale.set(rx * 1.08, 1, ry * 1.08);
      g.add(cap);
      var inner = new THREE.Mesh(
        new THREE.CylinderGeometry(0.65, 0.68, 0.06, 48, 1, true),
        mat(THREE, p.roofShadow, { roughness: 0.5, side: THREE.DoubleSide })
      );
      inner.position.y = y + 0.05;
      inner.scale.set(rx * 0.95, 1, ry * 0.95);
      g.add(inner);
      return g;
    }
    if (roof.mode === "arch") {
      for (var i = 0; i < 5; i++) {
        var arch = new THREE.Mesh(
          new THREE.TorusGeometry(0.55 + i * 0.06, 0.018, 8, 48, Math.PI),
          mat(THREE, p.roof, { roughness: 0.4 })
        );
        arch.rotation.z = Math.PI / 2;
        arch.rotation.y = (i / 5) * Math.PI * 0.15;
        arch.position.set((i - 2) * rx * 0.22, y + 0.2 + i * 0.03, 0);
        arch.scale.set(rx * 1.1, 1, ry * 0.9);
        g.add(arch);
      }
      return g;
    }
    var ring = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.045, 12, 80),
      mat(THREE, p.roof, { roughness: 0.42 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y + 0.08;
    ring.scale.set(rx, ry, 1);
    g.add(ring);
    var ribs = roof.ribs || 16;
    for (var r = 0; r < ribs; r++) {
      var ang = (r / ribs) * Math.PI * 2;
      var rib = new THREE.Mesh(
        new THREE.BoxGeometry(rx * roof.cantilever * 1.6, 0.02, 0.025),
        mat(THREE, p.roofShadow, { roughness: 0.35 })
      );
      rib.position.set(Math.cos(ang) * rx * 0.98, y + 0.07, Math.sin(ang) * ry * 0.98);
      rib.rotation.y = -ang;
      g.add(rib);
    }
    return g;
  }

  function createTowers(THREE, spec) {
    var g = new THREE.Group();
    var p = spec.palette || PALETTE;
    var n = spec.towers || 0;
    if (!n) return g;
    var rx = spec.oval.rx + spec.tiers * spec.tierWidth + 0.12;
    var ry = spec.oval.ry + spec.tiers * spec.tierWidth + 0.12;
    for (var i = 0; i < n; i++) {
      var ang = (i / n) * Math.PI * 2 + Math.PI / 4;
      var px = Math.cos(ang) * rx;
      var pz = Math.sin(ang) * ry;
      var pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.028, spec.towerHeight, 8),
        mat(THREE, p.tower, { roughness: 0.5 })
      );
      pole.position.set(px, spec.towerHeight / 2, pz);
      pole.castShadow = true;
      g.add(pole);
      if (spec.towerStyle === "mast") {
        var mast = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), mat(THREE, p.light, { emissive: p.light, emissiveIntensity: 0.8 }));
        mast.position.set(px, spec.towerHeight + 0.04, pz);
        g.add(mast);
      } else {
        var head = new THREE.Mesh(
          new THREE.BoxGeometry(0.1, 0.04, 0.06),
          mat(THREE, p.light, { emissive: p.light, emissiveIntensity: 0.65 })
        );
        head.position.set(px, spec.towerHeight + 0.02, pz);
        g.add(head);
      }
    }
    return g;
  }

  function createWindows(THREE, spec) {
    if (!spec.windows) return new THREE.Group();
    var g = new THREE.Group();
    var p = spec.palette || PALETTE;
    var rx = spec.oval.rx + spec.tiers * spec.tierWidth * 0.9;
    var ry = spec.oval.ry + spec.tiers * spec.tierWidth * 0.9;
    for (var i = 0; i < 36; i++) {
      var ang = (i / 36) * Math.PI * 2;
      if (standHeightAt(spec, ang) < 0.4) continue;
      var win = new THREE.Mesh(
        new THREE.PlaneGeometry(0.06, 0.035),
        mat(THREE, p.window, { emissive: p.window, emissiveIntensity: 0.9, roughness: 0.3 })
      );
      var px = Math.cos(ang) * rx;
      var pz = Math.sin(ang) * ry;
      win.position.set(px, 0.08 + (i % 3) * 0.05, pz);
      win.lookAt(0, win.position.y, 0);
      g.add(win);
    }
    return g;
  }

  function applyFeatures(THREE, spec, group) {
    var p = spec.palette || PALETTE;
    var feats = spec.features || [];
    if (feats.indexOf("hill") >= 0) {
      var hill = new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2),
        mat(THREE, p.hill, { roughness: 0.88 })
      );
      hill.position.set(-spec.oval.rx * 1.35, -0.05, -spec.oval.ry * 0.35);
      hill.scale.set(1.6, 0.35, 1.1);
      hill.receiveShadow = true;
      group.add(hill);
    }
    if (feats.indexOf("scoreboard") >= 0) {
      var sb = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 0.18, 0.04),
        mat(THREE, 0x2a3548, { roughness: 0.4 })
      );
      sb.position.set(spec.oval.rx * 0.85, spec.tiers * spec.tierStep * 0.9, spec.oval.ry * 0.15);
      sb.castShadow = true;
      group.add(sb);
      var glow = new THREE.Mesh(
        new THREE.PlaneGeometry(0.28, 0.12),
        mat(THREE, 0x88aacc, { emissive: 0x6688aa, emissiveIntensity: 0.5 })
      );
      glow.position.set(spec.oval.rx * 0.85, spec.tiers * spec.tierStep * 0.9, spec.oval.ry * 0.17);
      group.add(glow);
    }
    if (feats.indexOf("south-stand") >= 0) {
      var stand = new THREE.Mesh(
        new THREE.BoxGeometry(spec.oval.rx * 1.5, spec.tiers * spec.tierStep * 1.35, 0.22),
        mat(THREE, p.concreteLight, { roughness: 0.55 })
      );
      stand.position.set(0, spec.tiers * spec.tierStep * 0.55, -spec.oval.ry - 0.35);
      stand.castShadow = true;
      group.add(stand);
    }
    if (feats.indexOf("heritage-pavilion") >= 0) {
      var pav = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, 0.35, 0.18),
        mat(THREE, 0xc9b896, { roughness: 0.7 })
      );
      pav.position.set(spec.oval.rx * 0.95, spec.tiers * spec.tierStep * 0.75, 0);
      group.add(pav);
    }
    if (feats.indexOf("rect-bowl") >= 0) {
      group.scale.x = 1.12;
    }
    if (typeof spec.customFeature === "function") {
      spec.customFeature(THREE, spec, group, mat, p);
    }
  }

  function build(THREE, spec) {
    spec = mergeSpec(BASE_SPEC, spec);
    var root = new THREE.Group();
    root.name = "stadium-" + spec.id;
    root.add(createField(THREE, spec));
    root.add(createTierBowl(THREE, spec));
    root.add(createRoof(THREE, spec));
    root.add(createTowers(THREE, spec));
    root.add(createWindows(THREE, spec));
    applyFeatures(THREE, spec, root);
    return root;
  }

  return {
    BASE_SPEC: BASE_SPEC,
    PALETTE: PALETTE,
    mergeSpec: mergeSpec,
    build: build,
  };
});
