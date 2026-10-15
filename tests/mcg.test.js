// node --test tests/mcg.test.js   MCG pitch, goal moments, owner gate, mesh budget, in-app route.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const field = require("../assets/mcg/field.js");
const goals = require("../assets/mcg/goals.js");
const gate = require("../assets/mcg/gate.js");
const build = require("../assets/mcg/build.js");
const gl = require("../assets/mcg/gl.js");

const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const BANNED = /forward|mirror|master|consensus/i;
const CONSOLE = /console\.(?:log|debug|info|warn|error|trace)\s*\(/;

function tokenFor(id) {
  const b64 = Buffer.from(JSON.stringify({ user_id: id }), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return b64 + ".sig";
}

function game(over) {
  return Object.assign({ id: "m1", hscore: 0, ascore: 0, sport: "afl", quarter: "Q1" }, over);
}

test("painted slots match the ground table", () => {
  assert.equal(field.SLOTS.length, 13);
  const centre = field.slotById("centre");
  const zs = field.slotCorners(centre).map((p) => p[2]);
  assert.ok(Math.min.apply(null, zs) >= 10 - 0.01);
  assert.ok(Math.max.apply(null, zs) <= 18 + 0.01);
  const up = field.textUp(field.slotById("arc-west"));
  assert.ok(up[0] > 0.9, "arc-west text-up points +x");
  assert.ok(Math.abs(up[1]) < 0.05);
  field.SLOTS.forEach((slot) => {
    if (slot.type !== "general") return;
    assert.ok(field.arcClearance(slot) > 50, slot.id);
  });
  ["emblem-home", "emblem-away"].forEach((id) => {
    const slot = field.slotById(id);
    assert.ok(Math.abs(slot.x) > 25 && Math.abs(slot.x) < 34, id);
  });
});

test("a new goal is six points at the scoring end", () => {
  const base = [game({ hscore: 0, ascore: 0 })];
  assert.equal(goals.diff(null, base).events.length, 0);
  const snap = goals.snapshot(base);
  assert.equal(goals.diff(snap, [game({ hscore: 6, ascore: 0 })]).events.length, 1);
  assert.equal(goals.diff(snap, [game({ hscore: 1, ascore: 0 })]).events.length, 0);
  assert.equal(goals.diff(snap, [game({ hscore: 7, ascore: 0 })]).events.length, 1);
  assert.equal(goals.diff(snap, [game({ hscore: 12, ascore: 0 })]).events.length, 2);
  assert.equal(goals.diff(goals.snapshot([game({ hscore: 12 })]), [game({ hscore: 6 })]).events.length, 0);
  const parsed = goals.diff(snap, [game({ hscore: "2.1.13", ascore: "0.0.0" })]);
  assert.equal(parsed.events.length, 2);
  const explicit = goals.diff(
    goals.snapshot([game({ hscore: 0, hgoals: 0, agoals: 0 })]),
    [game({ hscore: 6, hgoals: 1, agoals: 0, quarter: "Q1" })]
  );
  assert.equal(explicit.events.length, 1);
  assert.equal(explicit.events[0].end, "east");
  assert.equal(explicit.events[0].team, "home");
  const q2 = goals.diff(
    goals.snapshot([game({ hscore: 0, quarter: "Q2" })]),
    [game({ hscore: 6, quarter: "Q2" })]
  );
  assert.equal(q2.events[0].end, "west");
  assert.equal(goals.scoringEnd("home", 1), "east");
  assert.equal(goals.scoringEnd("home", 3), "east");
  assert.equal(goals.scoringEnd("away", 1), "west");
  assert.equal(goals.scoringEnd("home", 4), "west");
  assert.equal(goals.diff(snap, [game({ hscore: 6, sport: "nba" })]).events.length, 0);
  assert.equal(goals.diff(snap, [game({ hscore: 30 })]).events.length, 3);
});

test("the ball passes between the big sticks", () => {
  ["east", "west"].forEach((end) => {
    const at = goals.crossesSticks(end);
    assert.equal(at.betweenPosts, true, end);
    assert.ok(Math.abs(Math.abs(at.x) - field.GOAL_X) < 0.5, end);
  });
});

test("ball sponsor reads the payload, then a saved value", () => {
  assert.equal(goals.ballSponsorFromPayload({ ballSponsorUrl: "https://cdn.example/a.png" }), "https://cdn.example/a.png");
  assert.equal(goals.ballSponsorFromPayload({ ball_sponsor: { url: "/ball.png" } }), "/ball.png");
  assert.match(goals.ballSponsorFromPayload({ assets: [{ slot: "ball", id: "abc" }] }), /abc\/file$/);
  const mem = { bag: "", getItem: (k) => (k === goals.BALL_KEY ? mem.bag : ""), setItem: (k, v) => { mem.bag = v; }, removeItem: () => { mem.bag = ""; } };
  goals.writeBallSponsor(mem, "tipdash.png");
  assert.equal(goals.readBallSponsor(mem), "tipdash.png");
  const slides = goals.boardSlides({ playlist: [{ asset_id: "aa", hold_s: 4 }] }, "https://api.example");
  assert.equal(slides.length, 1);
  assert.match(slides[0].image, /^https:\/\/api\.example\/api\/owner\/sponsors\/assets\/aa\/file$/);
  assert.equal(slides[0].duration, 4);
});

test("only Brandon's Discord user opens the ground", () => {
  assert.equal(gate.allow("274753853516283905"), true);
  assert.equal(gate.allow(tokenFor("274753853516283905")), true);
  assert.equal(gate.userIdFromToken(tokenFor("274753853516283905")), "274753853516283905");
  assert.equal(gate.allow(tokenFor("111")), false);
  assert.equal(gate.allow("111"), false);
  assert.equal(gate.allow(""), false);
  assert.equal(gate.allow(null), false);
});

test("the stadium stays a small mesh and still has the MCG parts", () => {
  const built = build.stadium();
  assert.ok(built.triangles > 200 && built.triangles < 8000, "triangles " + built.triangles);
  const names = built.meshes.map((m) => m.name);
  ["Pitch", "Markings", "Roof", "Towers", "Posts", "Boards", "Ball"].forEach((name) => {
    assert.ok(names.indexOf(name) >= 0, name);
  });
  assert.equal(names.filter((n) => n.indexOf("slot:") === 0).length, 13);
  const posts = built.meshes.find((m) => m.name === "Posts");
  let near = false;
  for (let i = 0; i < posts.positions.length; i += 3) {
    if (Math.abs(Math.abs(posts.positions[i]) - field.GOAL_X) < 0.2) near = true;
  }
  assert.equal(near, true);
  assert.ok(build.heightFactor(Math.PI / 2) > 0.9);
  assert.ok(build.heightFactor(0) < 0.45);
  assert.ok(build.heightFactor(Math.PI) > build.heightFactor(-Math.PI / 2));
  const centre = built.meshes.find((m) => m.name === "slot:centre");
  assert.ok(Math.abs(centre.uvs[1] - 1) < 0.001, "text-down edge is v=1");
  assert.ok(Math.abs(centre.uvs[5] - 0) < 0.001, "text-up edge is v=0");
});

test("a point on the camera target sits near the middle of the view", () => {
  const eye = [0, 12, 40];
  const target = [0, 4, 0];
  const view = gl.lookAt(eye, target, [0, 1, 0]);
  const proj = gl.perspective((36 * Math.PI) / 180, 1, 0.2, 2500);
  const mvp = gl.multiply(proj, view);
  const x = target[0];
  const y = target[1];
  const z = target[2];
  const cx = mvp[0] * x + mvp[4] * y + mvp[8] * z + mvp[12];
  const cy = mvp[1] * x + mvp[5] * y + mvp[9] * z + mvp[13];
  const cw = mvp[3] * x + mvp[7] * y + mvp[11] * z + mvp[15];
  assert.ok(Math.abs(cx / cw) < 0.02);
  assert.ok(Math.abs(cy / cw) < 0.02);
});

test("the ground is an in-app route for the owner menu only", () => {
  assert.match(html, /m\[0\]==="ground"/);
  assert.match(html, /id="dd-ground"/);
  assert.match(html, /<div id="ground" hidden><\/div>/);
  const panel = html.match(/const panel=p=>\{for\(const x of (\[[^\]]*\])\)/);
  assert.ok(panel);
  assert.ok(JSON.parse(panel[1]).includes("ground"));
  assert.match(html, /function swipeBackPanel\(\)\{[\s\S]{0,240}"ground"\]/);
  assert.doesNotMatch(html, /topnav-ground|id="nav-ground"/);
  assert.doesNotMatch(html, /274753853516283905/);
  assert.doesNotMatch(html, /1553952007923040309/);
  const view = fs.readFileSync(path.join(root, "assets/mcg/view.js"), "utf8");
  const scene = fs.readFileSync(path.join(root, "assets/mcg/scene.js"), "utf8");
  assert.match(view, /Test goal/);
  assert.match(view, /id="ground-goal"/);
  assert.match(scene, /playGoal/);
  assert.match(view, /\/api\/live-tips/);
});

test("shipped ground scripts stay clear of secret words and console", () => {
  const files = fs.readdirSync(path.join(root, "assets/mcg")).filter((n) => n.endsWith(".js"));
  assert.ok(files.length >= 7);
  files.forEach((name) => {
    const text = fs.readFileSync(path.join(root, "assets/mcg", name), "utf8");
    assert.doesNotMatch(text, BANNED, name);
    assert.doesNotMatch(text, CONSOLE, name);
  });
});
