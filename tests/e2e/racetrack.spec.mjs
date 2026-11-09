// Racing on the Game view track (0.71.0) at 390 px with a mocked API: a Flemington race
// on its course model with Cinna's jockeys in proxied silks, an unknown course on the
// generic ellipse, a scratching taking a horse off, and the Sponsor Studio billboard
// slots painted from /api/ground/scene. Screenshots: SHOTS=/dir (default: none).
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

function runners(n, scratched = []) {
  const out = [];
  for (let i = 1; i <= n; i++) {
    out.push({ id: "r" + i, number: i, name: "Example Runner " + i, barrier: ((i * 7) % n) + 1, jockey_or_driver: "J. Example",
      silk_url: i === n ? "" : "https://silks.example/silk-" + SILKS[(i - 1) % SILKS.length] + ".png",
      colours: i === n ? "Emerald green" : "", scratched: scratched.includes(i) });
  }
  return out;
}

function race(meeting, eventId, n, scratched) {
  return { id: eventId, meeting_name: meeting, race_number: 7, name: "Example Handicap", distance: 1200, status: "Open",
    start_time: "2099-01-01T05:00:00Z", category: "T", runners: runners(n, scratched) };
}

async function openRace(page, { meeting, eventId, n = 10, scene = {} }) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const game = meeting + " R7";
  const state = { scratched: [] };
  await installApiMock(page);
  await page.route("**/api/servers**", (r) => json(r, { role: "mod", ops: false, servers: [], follower_servers: [{ guild_id: "9", display_name: "North", enabled: 1, listed: true }] }));
  await page.route("**/api/live-tips**", (r) => json(r, { ok: true, games: [] }));
  const tip = { tip_id: "t1", game_name: game, sport: "Horse Racing", status: "Pending",
    legs: [{ kind: "racing", event_id: eventId, meeting_name: meeting, race_number: 7, runner_number: 4, selection: "Example Runner 4" }] };
  await page.route("**/api/follower**", (r) => {
    const url = r.request().url();
    if (url.includes("/api/follower/game")) {
      return json(r, { ok: true, guild_id: "9", refresh_after: 60,
        game: { key: game, game_name: game, sport: "Horse Racing", sport_kind: "racing", league: "", live: false, concluded: false,
          home: { name: meeting, abbr: "" }, away: { name: "R7", abbr: "" } },
        tipsters: [{ user_id: "42", name: "Example Tipster", avatar: "", legs: [{ id: "t1:0", tip_id: "t1", player: "Example Runner 4", line_label: "Win", stat_label: "", status: "pending", odds: 3.4 }] }] });
    }
    return json(r, { ok: true, preview: false, display_name: "North", feed: [tip], months: [], month: "", stats: {} });
  });
  await page.route("**/api/racing/event/**", (r) => json(r, { ok: true, event: race(meeting, eventId, n, state.scratched) }));
  // The legend shows the CDN silk as a plain <img> (no CORS needed); the 3D jockeys use the proxy.
  await page.route("https://silks.example/**", (r) => png(r, path.basename(new URL(r.request().url()).pathname)));
  await page.route("**/api/racing/silk**", (r) => {
    const u = new URL(r.request().url()).searchParams.get("url") || "";
    const m = u.match(/silk-([a-z]+)\.png$/);
    return m ? png(r, "silk-" + m[1] + ".png") : r.fulfill({ status: 400, headers: cors(r), body: "" });
  });
  await page.route("**/api/ground/scene**", (r) => json(r, Object.assign({ ok: true, rev: 1, ground: [], boards: [], ball: null, hits: [] }, scene)));
  await page.route("**/api/ground/files/**", (r) => png(r, path.basename(new URL(r.request().url()).pathname)));
  await page.addInitScript(authInitScript());
  await page.goto(baseUrl + "#/s/9/game/" + encodeURIComponent(game), { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => {
    const h = document.getElementById("flive-mcg");
    return h && h.dataset.venue === "racecourse" && (h.classList.contains("is-webgl") || h.dataset.mcgError);
  }, null, { timeout: 60000 });
  return { errors, state };
}

async function settled(page, course, n) {
  await page.waitForFunction(([c, count]) => {
    const h = document.getElementById("flive-mcg"), m = h && h._mcg;
    if (!m || m.fallback || (m.course || "") !== c || m.fieldCount() !== count) return false;
    const kinds = m.riderKinds();
    return kinds.length === count && kinds.every(Boolean);
  }, [course, n], { timeout: 60000 });
}

async function shot(page, name) {
  if (!SHOTS) return;
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(SHOTS, "racetrack-" + name + ".png"), fullPage: false });
  await page.locator("#flive-mcg").screenshot({ path: path.join(SHOTS, "racetrack-" + name + "-track.png") });
}

async function blimp(page, name) {
  if (!SHOTS) return;
  await page.evaluate(() => document.getElementById("flive-mcg")._mcg.setCamera("blimp", { animate: false }));
  await page.waitForTimeout(400);
  await page.locator("#flive-mcg").screenshot({ path: path.join(SHOTS, "racetrack-" + name + ".png") });
}

const SCENE = { billboards: {
  flemington: { rooftop_A: { sponsor: "Sample", url: "/api/ground/files/board-rooftop.png" }, led_3: { sponsor: "Sample", url: "/api/ground/files/board-led.png" }, "tall_1.main": { sponsor: "Sample", url: "/api/ground/files/board-tall.png" },
    rail_2: { sponsor: "Sample", url: "/api/ground/files/board-rail.png" } },
  generic: { led_6: { sponsor: "Sample", url: "/api/ground/files/board-led.png" }, led_2: { sponsor: "Sample", url: "/api/ground/files/board-led.png" },
    rooftop_A: { sponsor: "Sample", url: "/api/ground/files/board-rooftop.png" }, "tall_2.main": { sponsor: "Sample", url: "/api/ground/files/board-tall.png" } },
} };

test("Flemington: course model, whole field in silks on Cinna's jockeys, billboards painted", async ({ page }) => {
  const { errors } = await openRace(page, { meeting: "Flemington", eventId: "evt-flem", scene: SCENE });
  await expect(page.locator("#flive-mcg")).toHaveAttribute("data-course", "flemington", { timeout: 60000 });
  await settled(page, "flemington", 10);
  const info = await page.evaluate(() => { const m = document.getElementById("flive-mcg")._mcg; return { kinds: m.riderKinds(), slots: m.billboardSlots() }; });
  expect(info.kinds.every((k) => k === "gltf")).toBe(true);
  expect(info.slots).toEqual(expect.arrayContaining(["led_3", "rail_2", "tall_1.main", "finish_1.front", "gate_1", "rooftop_A", "rooftop_B", "infield_C"]));
  const legend = page.locator("#flive-race");
  await expect(legend).toContainText("Flemington R7");
  await expect(legend.locator("li.fl-rr")).toHaveCount(10);
  await expect(legend.locator("li.fl-rr.is-tip")).toContainText("Example Runner 4");
  await shot(page, "flemington-v2");
  await blimp(page, "flemington-blimp");
  expect(errors).toEqual([]);
});

test("unknown course falls back to the generic ellipse with its billboards", async ({ page }) => {
  const { errors } = await openRace(page, { meeting: "Randwick", eventId: "evt-rand", n: 8, scene: SCENE });
  await settled(page, "", 8);
  await expect(page.locator("#flive-mcg")).toHaveAttribute("data-course", "");
  const slots = await page.evaluate(() => document.getElementById("flive-mcg")._mcg.billboardSlots());
  expect(slots.filter((s) => /^led_/.test(s)).sort()).toEqual(["led_1", "led_2", "led_3", "led_4", "led_5", "led_6"]);
  expect(slots).toEqual(expect.arrayContaining(["rooftop_A", "rooftop_B", "infield_C", "led_1", "led_6", "rail_1", "tall_1.main", "finish_1.front"]));
  await expect(page.locator("#flive-race")).toContainText("Randwick R7");
  await shot(page, "generic-v2");
  await blimp(page, "generic-blimp");
  expect(errors).toEqual([]);
});

test("a scratching takes its horse off the track and the legend", async ({ page }) => {
  const { errors, state } = await openRace(page, { meeting: "Flemington", eventId: "evt-scr", n: 10, scene: SCENE });
  await settled(page, "flemington", 10);
  await shot(page, "scratching-before");
  state.scratched = [3];
  await page.evaluate(() => fliveRaceRead(FLIVE.race));
  await settled(page, "flemington", 9);
  await expect(page.locator("#flive-race li.fl-rr")).toHaveCount(9);
  await expect(page.locator("#flive-race")).not.toContainText("Example Runner 3");
  await shot(page, "scratching-after");
  expect(errors).toEqual([]);
});

for (const [meeting, course, ev] of [["Caulfield", "caulfield", "evt-caul"], ["Moonee Valley", "moonee-valley", "evt-mv"], ["Sandown Hillside", "sandown-hillside", "evt-san"]]) {
  test(`${meeting}: course model with the rooftop and infield boards`, async ({ page }) => {
    const { errors } = await openRace(page, { meeting, eventId: ev, n: 8, scene: SCENE });
    await settled(page, course, 8);
    const slots = await page.evaluate(() => document.getElementById("flive-mcg")._mcg.billboardSlots());
    expect(slots).toEqual(expect.arrayContaining(["rooftop_A", "rooftop_B", "infield_C", "led_1", "rail_1", "tall_1.main", "finish_1.front"]));
    await shot(page, course + "-v2");
    expect(errors).toEqual([]);
  });
}
