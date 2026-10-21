// Game view: the ground follows the chosen game (MCG <-> arena), also when its read fails.
import { test, expect } from "@playwright/test";
import { startMockSite, authInitScript, installApiMock } from "./mock-server.mjs";
let baseUrl, server;
test.beforeAll(async () => { server = await startMockSite(); baseUrl = `http://127.0.0.1:${server.address().port}/`; });
test.afterAll(async () => { if (server) server.close(); });
const j = (route, body) => { const o = route.request().headers().origin || "*"; return route.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": o, "Access-Control-Allow-Credentials": "true" }, body: JSON.stringify(body) }); };
const FEED = { ok: true, preview: false, display_name: "North", stats: {}, months: [], month: "", feed: [
  { tip_id: "a", game_name: "North Melbourne v Carlton", bet_type: "X 25+ disposals", sport: "AFL", odds: 2, result: "Pending", starts_at: "2026-10-22T05:00:00Z", tipster_name: "M", tipster_id: "m" },
  { tip_id: "b", game_name: "Northside Hawks @ Bayside Owls", bet_type: "Y 25+ points", sport: "NBA", odds: 2, result: "Pending", starts_at: "2026-10-23T05:00:00Z", tipster_name: "M", tipster_id: "m" } ] };
const game = (n) => /Hawks/.test(n)
  ? { game_name: n, sport: "NBA", league: "nba", sport_kind: "basketball", live: false, home: { name: "Bayside Owls" }, away: { name: "Northside Hawks" } }
  : { game_name: n, sport: "AFL", live: false, home: { name: "North Melbourne" }, away: { name: "Carlton" } };
for (const failNba of [false, true]) test("switching games changes the ground" + (failNba ? " when the game read fails" : ""), async ({ page }) => {
  await installApiMock(page);
  await page.route("**/api/servers**", (r) => j(r, { role: "mod", ops: false, servers: [], follower_servers: [{ guild_id: "9", display_name: "North", enabled: 1, listed: true }] }));
  await page.route("**/api/follower**", (r) => { const u = r.request().url(); if (u.includes("/api/follower/game")) { const n = new URL(u).searchParams.get("game"); if (failNba && /Hawks/.test(n)) return r.fulfill({ status: 500, headers: { "Access-Control-Allow-Origin": r.request().headers().origin || "*", "Access-Control-Allow-Credentials": "true" }, body: "{}" }); return j(r, { ok: true, game: game(n), tipsters: [] }); } return j(r, FEED); });
  await page.route("**/api/live-tips**", (r) => j(r, { ok: true, games: [] }));
  await page.addInitScript(authInitScript());
  await page.goto(baseUrl + "#/game", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#flive-switch button")).toHaveCount(2, { timeout: 30000 });
  const v = () => page.evaluate(() => document.getElementById("flive-mcg").dataset.venue);
  await expect.poll(v).toBe("mcg");
  await page.locator("#flive-switch button").nth(1).click();
  await expect.poll(v, { timeout: 15000 }).toBe("arena");
  await page.locator("#flive-switch button").nth(0).click();
  await expect.poll(v, { timeout: 15000 }).toBe("mcg");
  await page.reload(); await expect(page.locator("#flive-switch button")).toHaveCount(2, { timeout: 30000 });
  await page.locator("#flive-switch button").nth(1).click();
  await expect.poll(v, { timeout: 15000 }).toBe("arena");
  expect(page.context().pages().length).toBe(1);
});
