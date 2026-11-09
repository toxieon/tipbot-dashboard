// Simulated race after the jump (0.72.0) at 390 px with a mocked API: the field breaks
// from the barrier stalls and runs the trip, finishing in result order, else the
// With-price model rank (TipBot 0.92.24), else barrier order; the Grandstand view follows
// the leader; Replay re-runs it; scratched runners never run; before the jump the parade
// stays. Screenshots: SHOTS=/dir writes simrace-*.png (default: none).
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startMockSite, authInitScript, installApiMock } from "./mock-server.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.join(HERE, "..", "fixtures", "racetrack");
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
const png = (route, file) => route.fulfill({ status: 200, contentType: "image/png", headers: cors(route), body: fs.readFileSync(path.join(FIX, file)) });

const PAST = new Date(Date.now() - 60000).toISOString(), FUTURE = "2099-01-01T05:00:00Z";
// Model ranks (made up): runner 6 is the model's pick, then 2, 9, 4...
const MODEL = { 6: 1, 2: 2, 9: 3, 4: 4, 1: 5, 8: 6, 3: 7, 5: 8, 7: 9, 10: 10 };

function runners(n, { scratched = [], model = false } = {}) {
  const out = [];
  for (let i = 1; i <= n; i++) {
    const r = { id: "r" + i, number: i, name: "Example Runner " + i, barrier: ((i * 7) % n) + 1, jockey_or_driver: "J. Example",
      silk_url: "https://silks.example/silk-" + SILKS[(i - 1) % SILKS.length] + ".png", scratched: scratched.includes(i) };
    if (model && MODEL[i]) { r.model_rank = MODEL[i]; r.p_win = +(0.3 / MODEL[i]).toFixed(4); }
    out.push(r);
  }
  return out;
}

async function openRace(page, { meeting, eventId, state }) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const game = meeting + " R7";
  await installApiMock(page);
  await page.route("**/api/servers**", (r) => json(r, { role: "mod", ops: false, servers: [], follower_servers: [{ guild_id: "9", display_name: "North", enabled: 1, listed: true }] }));
  await page.route("**/api/live-tips**", (r) => json(r, { ok: true, games: [] }));
  const tip = { tip_id: "t1", game_name: game, sport: "Horse Racing", status: "Pending",
    legs: [{ kind: "racing", event_id: eventId, meeting_name: meeting, race_number: 7, runner_number: 4, selection: "Example Runner 4" }] };
  await page.route("**/api/follower**", (r) => {
    if (r.request().url().includes("/api/follower/game")) {
      return json(r, { ok: true, guild_id: "9", refresh_after: 60,
        game: { key: game, game_name: game, sport: "Horse Racing", sport_kind: "racing", league: "", live: false, concluded: false,
          home: { name: meeting, abbr: "" }, away: { name: "R7", abbr: "" } },
        tipsters: [{ user_id: "42", name: "Example Tipster", avatar: "", legs: [{ id: "t1:0", tip_id: "t1", player: "Example Runner 4", line_label: "Win", stat_label: "", status: "pending", odds: 3.4 }] }] });
    }
    return json(r, { ok: true, preview: false, display_name: "North", feed: [tip], months: [], month: "", stats: {} });
  });
  await page.route("**/api/racing/event/**", (r) => json(r, { ok: true, event: {
    id: eventId, meeting_name: meeting, race_number: 7, name: "Example Handicap", distance: state.distance || 1200,
    status: state.status, start_time: state.start, category: "T",
    runners: runners(state.n || 10, { scratched: state.scratched || [], model: state.model }),
    ...(state.results ? { results: state.results } : {}) } }));
  await page.route("https://silks.example/**", (r) => png(r, path.basename(new URL(r.request().url()).pathname)));
  await page.route("**/api/racing/silk**", (r) => {
    const m = (new URL(r.request().url()).searchParams.get("url") || "").match(/silk-([a-z]+)\.png$/);
    return m ? png(r, "silk-" + m[1] + ".png") : r.fulfill({ status: 400, headers: cors(r), body: "" });
  });
  await page.route("**/api/ground/scene**", (r) => json(r, { ok: true, rev: 1, ground: [], boards: [], ball: null, hits: [] }));
  await page.addInitScript(authInitScript());
  await page.goto(baseUrl + "#/s/9/game/" + encodeURIComponent(game), { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => {
    const h = document.getElementById("flive-mcg");
    return h && h.dataset.venue === "racecourse" && (h.classList.contains("is-webgl") || h.dataset.mcgError);
  }, null, { timeout: 60000 });
  return errors;
}

async function settled(page, course, n) {
  await page.waitForFunction(([c, count]) => {
    const m = document.getElementById("flive-mcg")?._mcg;
    if (!m || m.fallback || (m.course || "") !== c || m.fieldCount() !== count) return false;
    const kinds = m.riderKinds();
    return kinds.length === count && kinds.every(Boolean);
  }, [course, n], { timeout: 60000 });
}

const header = (page) => page.locator("#flive-score .fl-clock b");
const race = (page) => page.evaluate(() => document.getElementById("flive-mcg")._mcg.raceState());

async function seekShot(page, t, name) {
  await page.evaluate((at) => document.getElementById("flive-mcg")._mcg.seekRace(at), t);
  if (!SHOTS) return;
  await page.waitForTimeout(250);
  await page.locator("#flive-mcg").screenshot({ path: path.join(SHOTS, "simrace-" + name + ".png") });
}

test("Flemington after the jump: breaks from the stalls, runs to the model order, camera follows, replay", async ({ page }) => {
  const state = { status: "Closed", start: PAST, model: true, scratched: [3], n: 10 };
  const errors = await openRace(page, { meeting: "Flemington", eventId: "evt-sim-flem", state });
  await settled(page, "flemington", 9);
  await page.waitForFunction(() => document.getElementById("flive-mcg")._mcg.raceState().phase !== "parade", null, { timeout: 30000 });
  let st = await race(page);
  expect(st.source).toBe("model");
  expect(st.start).toBe("d1200");
  expect(st.distance).toBe(1200);
  // Model order with the scratched runner (3) left out.
  expect(st.order).toEqual([6, 2, 9, 4, 1, 8, 5, 7, 10]);
  const bar = page.locator("#flive-sim");
  await expect(bar).toContainText("Model order");
  await expect(bar.locator("button.fl-sim-replay")).toBeVisible();
  // The header follows the sim, not the game's live flag (live: false here).
  await expect(header(page)).toHaveText("Running");
  await expect(page.locator("#flive-score")).not.toContainText("Upcoming");

  // In the gates: every horse sits in its own barrier stall (behind the start line).
  await seekShot(page, -1, "start");
  // Mid-race the Grandstand camera has moved off its preset to follow the leader.
  const pre = await page.evaluate(() => document.getElementById("flive-mcg")._mcg.raceState());
  await seekShot(page, pre.duration * 0.5, "mid");
  st = await race(page);
  expect(st.phase).toBe("race");
  expect(st.leader).not.toBeNull();
  // The winner on the line, then everyone pulled up.
  await seekShot(page, pre.winnerAt + 0.2, "finish");
  await page.evaluate((d) => document.getElementById("flive-mcg")._mcg.seekRace(d), pre.duration);
  st = await race(page);
  expect(st.phase).toBe("finished");
  expect(st.leader).toBe(6);
  await expect(header(page)).toHaveText("Result");
  await expect(page.locator("#flive-score")).not.toContainText("Upcoming");
  // A board refresh repaints the header from the game; the sim's label stays.
  await page.evaluate(() => flivePaint(FLIVE.board));
  await expect(header(page)).toHaveText("Result");

  await bar.locator("button.fl-sim-replay").click();
  st = await race(page);
  expect(st.phase).toBe("race");
  expect(st.t).toBeLessThan(5);
  await expect(header(page)).toHaveText("Running");
  expect(errors).toEqual([]);
});

test("results replace the model order and re-run the race; the winner leads at the finish", async ({ page }) => {
  const state = { status: "Interim", start: PAST, model: true, n: 8 };
  const errors = await openRace(page, { meeting: "Flemington", eventId: "evt-sim-res", state });
  await settled(page, "flemington", 8);
  await page.waitForFunction(() => document.getElementById("flive-mcg")._mcg.raceState().source === "model", null, { timeout: 30000 });
  state.status = "Final";
  state.results = [{ runner_number: 5, position: 1 }, { runner_id: "r1", position: 2 }, { runner_number: 8, position: 3 }];
  await page.evaluate(() => fliveRaceRead(FLIVE.race));
  await page.waitForFunction(() => document.getElementById("flive-mcg")._mcg.raceState().source === "results", null, { timeout: 30000 });
  const st = await race(page);
  expect(st.order.slice(0, 3)).toEqual([5, 1, 8]);
  await expect(page.locator("#flive-sim")).toContainText("Result order");
  await page.evaluate((d) => document.getElementById("flive-mcg")._mcg.seekRace(d), st.duration);
  expect((await race(page)).leader).toBe(5);
  expect(errors).toEqual([]);
});

test("before the jump the field parades; unknown course runs on the generic loop in barrier order", async ({ page }) => {
  const state = { status: "Open", start: FUTURE, n: 8 };
  const errors = await openRace(page, { meeting: "Randwick", eventId: "evt-sim-gen", state });
  await settled(page, "", 8);
  expect((await race(page)).phase).toBe("parade");
  await expect(page.locator("#flive-sim")).toHaveCount(0);
  await expect(header(page)).toHaveText("Upcoming");   // the parade keeps the game's own header
  // The jump: the start time passes (the next read sees it).
  state.start = PAST;
  state.status = "Closed";
  await page.evaluate(() => fliveRaceRead(FLIVE.race));
  await page.waitForFunction(() => document.getElementById("flive-mcg")._mcg.raceState().phase !== "parade", null, { timeout: 30000 });
  const st = await race(page);
  expect(st.source).toBe("barrier");
  expect(st.start).toBe("generic-1200");
  // Barrier order: runner numbers sorted by barrier ((i*7)%8)+1.
  const want = [1, 2, 3, 4, 5, 6, 7, 8].sort((a, b) => ((a * 7) % 8) - ((b * 7) % 8));
  expect(st.order).toEqual(want);
  await expect(header(page)).toHaveText("Running");
  await seekShot(page, -1, "start-generic");
  await seekShot(page, st.duration * 0.45, "generic-mid");
  expect(errors).toEqual([]);
});

for (const [meeting, course] of [["Caulfield", "caulfield"], ["Moonee Valley", "moonee-valley"], ["Sandown", "sandown-hillside"]]) {
  test(`${meeting} after the jump: in the stalls at the start, Running then Result`, async ({ page }) => {
    const state = { status: "Closed", start: PAST, n: 10 };
    const errors = await openRace(page, { meeting, eventId: "evt-sim-" + course, state });
    await settled(page, course, 10);
    await page.waitForFunction(() => document.getElementById("flive-mcg")._mcg.raceState().phase !== "parade", null, { timeout: 30000 });
    await expect(header(page)).toHaveText("Running");
    await seekShot(page, -1, "start-" + course);
    const st = await race(page);
    await page.evaluate((d) => document.getElementById("flive-mcg")._mcg.seekRace(d), st.duration);
    await expect(header(page)).toHaveText("Result");
    await expect(page.locator("#flive-score")).not.toContainText("Upcoming");
    expect(errors).toEqual([]);
  });
}
