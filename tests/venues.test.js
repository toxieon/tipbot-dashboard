// The grounds from the 3D models pack: routing per sport, cameras, the shared kit's
// handle contract, logo placement and the stills.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const V = require("../assets/venues/select.js");

const NEW = {
  soccer: { cams: "SOCCER_CAMERAS", field: "PITCH", inside: [49, 38] },
  nfl: { cams: "NFL_CAMERAS", field: "FIELD", inside: [85, 57] },
  nrl: { cams: "NRL_CAMERAS", field: "FIELD", inside: [75, 49] },
  tennis: { cams: "TENNIS_CAMERAS", field: "SURROUND", inside: [37, 28] },
  baseball: { cams: "BASEBALL_CAMERAS", field: "OUTFIELD", inside: null },
  racecourse: { cams: "RACECOURSE_CAMERAS", field: "INFIELD", inside: null },
};

test("venueFor sends each sport to its ground", () => {
  const cases = [
    [{ sport_kind: "football", league: "nfl", sport: "NFL" }, "nfl"],
    [{ league: "nfl" }, "nfl"],
    [{ sport_kind: "mlb", sport: "MLB" }, "baseball"],
    [{ sport_kind: "eng.1", sport: "SOCCER" }, "soccer"],
    [{ league: "aus.1" }, "soccer"],
    [{ league: "uefa.champions" }, "soccer"],
    ["SOCCER", "soccer"],
    [{ sport: "NRL" }, "nrl"],
    [{ comp: "Rugby League" }, "nrl"],
    [{ sport: "Racing" }, "racecourse"],
    [{ sport: "Greyhounds" }, "racecourse"],
    [{ sport: "Tennis" }, "tennis"],
    [{ sport: "Cricket" }, "mcg"],
    [{ sport: "BBL" }, "mcg"],
    [{ sport_kind: "basketball", sport: "NBA" }, "arena"],
    [{ sport: "AFL" }, "mcg"],
    [{ sport: "Darts" }, "mcg"],
  ];
  for (const [g, want] of cases) assert.equal(V.venueFor(g), want, JSON.stringify(g));
  // The first field that names a ground wins (sport_kind before sport).
  assert.equal(V.venueFor({ sport_kind: "basketball", sport: "SOCCER" }), "arena");
});

test("every ground has a module, a still and is a known venue", () => {
  assert.deepEqual(V.VENUES.slice().sort(), ["arena", "baseball", "mcg", "nfl", "nrl", "racecourse", "soccer", "tennis"]);
  for (const v of Object.keys(NEW)) {
    assert.ok(V.isVenue(v), v);
    assert.equal(V.moduleFor(v), "./assets/venues/" + v + ".js");
    assert.equal(V.fallbackFor(v), "./assets/venues/" + v + "-fallback.png");
    assert.ok(fs.existsSync(path.join(root, V.moduleFor(v))), v + " module");
    const png = fs.statSync(path.join(root, V.fallbackFor(v)));
    assert.ok(png.size > 1000 && png.size <= 200 * 1024, v + " still <= 200 KB");
  }
  assert.equal(V.fallbackFor("nope"), "./assets/mcg/fallback.png");
});

for (const [venue, spec] of Object.entries(NEW)) {
  test(venue + ": cameras valid, chip ids reused, inside the ground", async () => {
    const C = await import("../assets/mcg/cameras.js");
    const M = await import("../assets/venues/" + venue + ".js");
    const cams = M[spec.cams];
    assert.equal(M.VENUE, venue);
    assert.deepEqual(cams.map((c) => c.id), ["broadcast", "goals-north", "goals-south", "wing", "blimp"]);
    for (const c of cams) assert.ok(C.validCamera(c), c.id);
    assert.equal(C.camerasFor({ cameras: cams }), cams);
    assert.equal(M.DEF.cameras, cams);
    assert.equal(M.DEF.outdoor, true);
    assert.equal(typeof M.DEF.build, "function");
    if (spec.inside) {
      for (const c of cams.filter((c) => c.id !== "blimp")) {
        assert.ok(Math.abs(c.pos[0]) < spec.inside[0] && Math.abs(c.pos[2]) < spec.inside[1], venue + " " + c.id + " inside the stands");
      }
    }
    // Every camera sits within the far plane of what it looks at.
    for (const c of cams) {
      const d = Math.hypot(c.pos[0] - c.look[0], c.pos[1] - c.look[1], c.pos[2] - c.look[2]);
      assert.ok(d < M.DEF.far, venue + " " + c.id + " within far");
    }
    assert.equal(C.storageKeyFor(venue), "tipdash_gv_cam:" + venue);
  });

  test(venue + ": logos stay on the field, module stays plain", async () => {
    const K = await import("../assets/venues/kit.js");
    const M = await import("../assets/venues/" + venue + ".js");
    const f = M[spec.field];
    assert.equal(M.DEF.field, f);
    for (const [x, z] of [[84, 71.5], [-84, -71.5], [0, 0]]) {
      const at = K.logoPlacement({ x, z, w: 14, d: 4.7 }, f);
      assert.ok(Math.abs(at.x - (f.x || 0)) <= f.w / 2 && Math.abs(at.z - (f.z || 0)) <= f.d / 2, venue + " logo on the field");
    }
    const src = fs.readFileSync(path.join(root, "assets/venues/" + venue + ".js"), "utf8");
    assert.match(src, /from "\.\/kit\.js"/);
    assert.match(src, /mountVenue\(host, opts, DEF\)/);
    assert.doesNotMatch(src, /OrbitControls|kits\.js|players\(|player-base|\.glb/);
    assert.doesNotMatch(src, /console\.|window\.open|target="_blank"|https?:\/\//);
    assert.deepEqual(src.match(/["'][^"']+\.(?:png|svg|jpg|webp)["']/g) || [], ['"./' + venue + '-fallback.png"']);
  });
}

test("the AFL player overlay only runs on the MCG", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(html, /shouldAnimate\(fliveAnimOn\(\), !!run, g\) && FLIVE\.venue==="mcg"/);
});
