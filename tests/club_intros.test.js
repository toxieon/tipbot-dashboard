const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const Clubs = require("../assets/club-intros/clubs.js");
const Intro = require("../assets/club-intros/intro.js");
const Motifs = require("../assets/club-intros/motifs.js");
const Gallery = require("../assets/club-intros/gallery.js");
const Guernseys = require("../assets/afl-guernseys.js");

const AFL_MEN_IDS = [
  "adelaide",
  "brisbane",
  "carlton",
  "collingwood",
  "essendon",
  "fremantle",
  "geelong",
  "goldcoast",
  "gws",
  "hawthorn",
  "melbourne",
  "northmelbourne",
  "portadelaide",
  "richmond",
  "stkilda",
  "sydney",
  "westcoast",
  "westernbulldogs",
];

test("club intros: eighteen AFL clubs and AFLW gallery entries", () => {
  assert.deepEqual(Clubs.menIds(), AFL_MEN_IDS);
  const entries = Clubs.galleryEntries();
  assert.equal(entries.filter((e) => e.league === "afl").length, 18);
  assert.equal(entries.filter((e) => e.league === "aflw").length, 19);
  assert.ok(entries.some((e) => e.clubId === "tasmania" && e.league === "aflw"));
});

test("club intros: render uses guernsey and typographic reveal markup", () => {
  const html = Intro.renderHtml({ clubId: "carlton", league: "afl", animate: false });
  assert.match(html, /class="ci-intro/);
  assert.match(html, /class="guernsey-svg"/);
  assert.match(html, /ci-word-inner/);
  assert.match(html, /Carlton/);
  assert.match(html, /Blues/);
  assert.match(html, />AFL</);
  assert.doesNotMatch(html, /logo|mascot/i);
  const spec = Guernseys.lookupTeam("Carlton");
  assert.match(html, new RegExp(spec.primary.replace("#", "#"), "i"));
});

test("club intros: AFLW league tag and tasmania copy", () => {
  const w = Intro.renderHtml({ clubId: "hawthorn", league: "aflw", animate: false });
  assert.match(w, /ci-aflw/);
  assert.match(w, />AFLW</);
  const t = Intro.renderHtml({ clubId: "tasmania", league: "aflw", animate: false });
  assert.match(t, /Tasmania/);
  assert.match(t, /Devils/);
});

test("club intros: motif SVG is geometry only", () => {
  const svg = Motifs.motifSvg("hoops", "#0e1e3d", "#ffffff", 1);
  assert.match(svg, /<svg/);
  assert.doesNotMatch(svg, /logo|eagle|lion|tiger/i);
});

test("club intros: reduced motion uses static class", () => {
  const html = Intro.renderHtml({ clubId: "richmond", league: "afl", reducedMotion: true });
  assert.match(html, /ci-static/);
  assert.doesNotMatch(html, /ci-play/);
});

test("club intros: intro.css honours prefers-reduced-motion", () => {
  const css = fs.readFileSync(path.join(root, "assets/club-intros/intro.css"), "utf8");
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

test("club intros: labs path denied from public build", async () => {
  const { DENY_DIRS, isDeniedRel } = await import("../scripts/build-public.mjs");
  assert.ok(DENY_DIRS.has("labs"));
  assert.equal(isDeniedRel("labs/club-intros/index.html"), true);
  assert.equal(isDeniedRel("assets/club-intros/intro.js"), false);
});

test("club intros: lab page script loads gallery", () => {
  const html = fs.readFileSync(path.join(root, "labs/club-intros/index.html"), "utf8");
  assert.match(html, /club-intros\/intro\.css/);
  assert.match(html, /TDClubIntroGallery\.mountGallery/);
  const scriptMatch = html.match(/<script>\s*([\s\S]*?)<\/script>\s*<\/body>/);
  assert.ok(scriptMatch, "inline boot script");
  const sandbox = {
    document: {
      getElementById: () => ({ innerHTML: "", addEventListener: () => {} }),
    },
    TDClubIntroGallery: Gallery,
  };
  vm.runInNewContext(scriptMatch[1], sandbox);
});

test("club intros: no console logging in modules", () => {
  const dir = path.join(root, "assets/club-intros");
  for (const name of fs.readdirSync(dir)) {
    if (!/\.js$/.test(name)) continue;
    const text = fs.readFileSync(path.join(dir, name), "utf8");
    assert.doesNotMatch(text, /console\./);
  }
});
