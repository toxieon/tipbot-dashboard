// Tipster markers on the follower Game view racetrack (0.73.0) at 390 px with a mocked
// TipBot race payload: single tipster, three stacked on one horse, shared own horse,
// toggle-off hides a tipster, and a win badge. Screenshots: SHOTS=/dir.
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startMockSite, authInitScript, installApiMock } from "./mock-server.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.join(HERE, "..", "fixtures", "racetrack");
const ICONS = path.join(HERE, "..", "fixtures", "tipster-markers");
const SHOTS = process.env.SHOTS || "";
const SILKS = ["hoops", "stripes", "halves", "sash", "quarters", "plain"];

test.use({
  viewport: { width: 390, height: 844 },
  launchOptions: {
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
    ...(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {}),
  },
});

let baseUrl, server;
test.beforeAll(async () => { server = await startMockSite(); baseUrl = `http://127.0.0.1:${server.address().port}/`; });
test.afterAll(async () => { if (server) server.close(); });

function cors(route) {
  const origin = route.request().headers().origin || "*";
  const headers = { "Access-Control-Allow-Origin": origin };
  if (origin !== "*") headers["Access-Control-Allow-Credentials"] = "true";
  return headers;
}
const json = (route, body) => route.fulfill({ status: 200, contentType: "application/json", headers: cors(route), body: JSON.stringify(body) });
const png = (route, file) => route.fulfill({ status: 200, contentType: "image/png", headers: cors(route), body: fs.readFileSync(file) });

function runners(n) {
  const out = [];
  for (let i = 1; i <= n; i++) {
    out.push({ id: "r" + i, number: i, name: "Example Runner " + i, barrier: ((i * 7) % n) + 1, jockey_or_driver: "J. Example",
      silk_url: "https://silks.example/silk-" + SILKS[(i - 1) % SILKS.length] + ".png",
      colours: "", scratched: false });
  }
  return out;
}

function race(meeting, eventId, n) {
  return { id: eventId, meeting_name: meeting, race_number: 7, name: "Example Handicap", distance: 1200, status: "Open",
    start_time: "2099-01-01T05:00:00Z", category: "T", runners: runners(n) };
}

function tipster(gid, name, icon, runner, won = false) {
  return {
    guild_id: String(gid), name, icon_url: "https://cdn.discordapp.com/icons/" + gid + "/" + icon + ".png?size=64",
    runner_number: runner, runner_name: "Example Runner " + runner, won, tip_id: "t-" + gid
  };
}

async function openRace(page, { meeting, eventId, n = 8, tipped = [4], markers = [] }) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const game = meeting + " R7";
  await installApiMock(page);
  await page.route("**/api/servers**", (r) => json(r, { role: "mod", ops: false, servers: [], follower_servers: [{ guild_id: "9", display_name: "North", enabled: 1, listed: true }] }));
  await page.route("**/api/live-tips**", (r) => json(r, { ok: true, games: [] }));
  const tip = { tip_id: "t1", game_name: game, sport: "Horse Racing", status: "Pending",
    legs: tipped.map((rn) => ({ kind: "racing", event_id: eventId, meeting_name: meeting, race_number: 7, runner_number: rn, selection: "Example Runner " + rn })) };
  await page.route("**/api/follower**", (r) => {
    const url = r.request().url();
    if (url.includes("/api/follower/game")) {
      return json(r, { ok: true, guild_id: "9", refresh_after: 60,
        game: { key: game, game_name: game, sport: "Horse Racing", sport_kind: "racing", league: "", live: false, concluded: false,
          home: { name: meeting, abbr: "" }, away: { name: "R7", abbr: "" } },
        tipsters: [{ user_id: "42", name: "Example Tipster", avatar: "", legs: [{ id: "t1:0", tip_id: "t1", player: "Example Runner " + tipped[0], line_label: "Win", stat_label: "", status: "pending", odds: 3.4 }] }] });
    }
    return json(r, { ok: true, preview: false, display_name: "North", feed: [tip], months: [], month: "", stats: {} });
  });
  await page.route("**/api/racing/event/**", (r) => json(r, { ok: true, event: race(meeting, eventId, n), tipster_markers: markers }));
  await page.route("https://silks.example/**", (r) => png(r, path.join(FIX, path.basename(new URL(r.request().url()).pathname))));
  await page.route("**/api/racing/silk**", (r) => {
    const u = new URL(r.request().url()).searchParams.get("url") || "";
    const m = u.match(/silk-([a-z]+)\.png$/);
    return m ? png(r, path.join(FIX, "silk-" + m[1] + ".png")) : r.fulfill({ status: 400, headers: cors(r), body: "" });
  });
  await page.route("https://cdn.discordapp.com/icons/**", (r) => {
    const base = path.basename(new URL(r.request().url()).pathname).replace(/\.png$/, "");
    const file = path.join(ICONS, base + ".png");
    return fs.existsSync(file) ? png(r, file) : png(r, path.join(ICONS, "north.png"));
  });
  await page.route("**/api/ground/scene**", (r) => json(r, { ok: true, rev: 1, ground: [], boards: [], ball: null, hits: [], billboards: {} }));
  await page.addInitScript(authInitScript());
  await page.goto(baseUrl + "#/s/9/game/" + encodeURIComponent(game), { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => {
    const h = document.getElementById("flive-mcg");
    return h && h.dataset.venue === "racecourse" && (h.classList.contains("is-webgl") || h.dataset.mcgError);
  }, null, { timeout: 60000 });
  return { errors };
}

async function settled(page, course, n) {
  await page.waitForFunction(([c, count]) => {
    const h = document.getElementById("flive-mcg"), m = h && h._mcg;
    if (!m || m.fallback || (m.course || "") !== c || m.fieldCount() !== count) return false;
    const kinds = m.riderKinds();
    return kinds.length === count && kinds.every(Boolean);
  }, [course, n], { timeout: 60000 });
}

async function markerInfo(page) {
  return page.evaluate(() => {
    const m = document.getElementById("flive-mcg")._mcg;
    return m && m.markerInfo ? m.markerInfo() : [];
  });
}

async function shot(page, name) {
  if (!SHOTS) return;
  // Wait for tipster chip sprites (async icon load) then frame the parade from grandstand.
  await page.waitForFunction(() => {
    const m = document.getElementById("flive-mcg") && document.getElementById("flive-mcg")._mcg;
    if (!m || !m.markerInfo) return false;
    const info = m.markerInfo();
    return info.some((x) => (x.tipsters && x.tipsters.length) || x.tipped);
  }, null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const h = document.getElementById("flive-mcg");
    if (h && h._mcg && h._mcg.setCamera) h._mcg.setCamera("broadcast", { animate: false });
  });
  await page.waitForTimeout(500);
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.locator("#flive-mcg").screenshot({ path: path.join(SHOTS, "tipster-markers-" + name + ".png") });
}

test("single tipster marker on a backed horse (parade)", async ({ page }) => {
  const markers = [tipster(11, "North", "north", 4)];
  const { errors } = await openRace(page, { meeting: "Flemington", eventId: "evt-tm-1", tipped: [4], markers });
  await settled(page, "flemington", 8);
  await page.waitForTimeout(600);
  const info = await markerInfo(page);
  const on4 = info.find((m) => m.number === 4);
  expect(on4).toBeTruthy();
  expect(on4.tipped).toBe(true);
  expect(on4.tipsters.map((t) => t.guild_id)).toEqual(["11"]);
  await shot(page, "parade");
  expect(errors).toEqual([]);
});

test("three tipsters stack on one horse with +N cap path", async ({ page }) => {
  const markers = [
    tipster(11, "North", "north", 4),
    tipster(22, "South", "south", 4),
    tipster(33, "East", "east", 4),
    tipster(44, "West", "west", 4),
  ];
  // Own tip on runner 1 keeps event_id on the poll; markers target runner 4 only.
  const { errors } = await openRace(page, { meeting: "Flemington", eventId: "evt-tm-3", tipped: [1], markers });
  await settled(page, "flemington", 8);
  await page.waitForTimeout(600);
  const info = await markerInfo(page);
  const on4 = info.find((m) => m.number === 4);
  expect(on4).toBeTruthy();
  expect(on4.tipped).toBe(false);
  expect(on4.tipsters.map((t) => t.guild_id).sort()).toEqual(["11", "22", "33", "44"]);
  await shot(page, "stack");
  expect(errors).toEqual([]);
});

test("follower own horse shared with a followed tipster", async ({ page }) => {
  const markers = [
    tipster(9, "North", "north", 4),
    tipster(22, "South", "south", 4),
  ];
  const { errors } = await openRace(page, { meeting: "Flemington", eventId: "evt-tm-shared", tipped: [4], markers });
  await settled(page, "flemington", 8);
  await page.waitForTimeout(600);
  const info = await markerInfo(page);
  const on4 = info.find((m) => m.number === 4);
  expect(on4.tipped).toBe(true);
  expect(on4.tipsters.map((t) => t.guild_id).sort()).toEqual(["22", "9"]);
  await shot(page, "shared");
  expect(errors).toEqual([]);
});

test("toggle off: tipster without a marker row is hidden (server-filtered)", async ({ page }) => {
  // Server already filtered guild 44 off — only 11 remains. Tip elsewhere so the event still polls.
  const markers = [tipster(11, "North", "north", 4)];
  const { errors } = await openRace(page, { meeting: "Flemington", eventId: "evt-tm-off", tipped: [1], markers });
  await settled(page, "flemington", 8);
  await page.waitForTimeout(400);
  const info = await markerInfo(page);
  expect(info.every((m) => !m.tipsters.some((t) => t.guild_id === "44"))).toBe(true);
  expect(info.find((m) => m.number === 4).tipsters.map((t) => t.guild_id)).toEqual(["11"]);
  expect(errors).toEqual([]);
});

test("win badge on a tipster marker", async ({ page }) => {
  const markers = [
    tipster(11, "North", "north", 4, false),
    tipster(22, "South", "south", 4, true),
  ];
  const { errors } = await openRace(page, { meeting: "Flemington", eventId: "evt-tm-win", tipped: [4], markers });
  await settled(page, "flemington", 8);
  await page.waitForTimeout(600);
  const info = await markerInfo(page);
  const on4 = info.find((m) => m.number === 4);
  expect(on4.tipsters.find((t) => t.guild_id === "22").won).toBe(true);
  expect(on4.tipsters.find((t) => t.guild_id === "11").won).toBe(false);
  await shot(page, "win");
  expect(errors).toEqual([]);
});
