// Settings → Studio: "Show my marker on followers' racetracks" (feat.racetrack_marker).
// TipBot owns the flag; tipdash paints it here (and brand-owner Studio → Track). Not on Features.
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startMockSite, authInitScript, installApiMock } from "./mock-server.mjs";

const SHOTS = process.env.SHOTS || "";

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });

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

test("Settings → Studio shows racetrack marker toggle (default on)", async ({ page }) => {
  const posts = [];
  await installApiMock(page);
  // More specific than **/api/server** so /api/servers is not swallowed.
  await page.route("**/api/servers**", (r) => json(r, {
    role: "mod", ops: false,
    servers: [{ guild_id: "1", display_name: "North", enabled: 1, listed: true, role: "mod", can_admin: true, subscription_active: 1, unit_size: 100, won: 1, lost: 0, profit_units: 1, roi: 10, queued: 0 }],
    follower_servers: []
  }));
  await page.route(/\/api\/server(\?|$)/, (r) => json(r, {
    settings: { guild_id: "1", display_name: "North", enabled: 1, can_admin: true, unit_size: 100, follow_emoji: "👍" },
    stats: { won: 1, lost: 0, push: 0, profit_units: 1, roi: 10, queued: 0, strike_rate: 100, followers: 1, settled: 1, staked_units: 1 },
    tips: { settled: [], queued: [] }, months: [], month: ""
  }));
  await page.route("**/api/feature-flags**", async (r) => {
    if (r.request().method() === "OPTIONS") {
      return r.fulfill({ status: 204, headers: { ...cors(r), "Access-Control-Allow-Headers": "authorization,content-type", "Access-Control-Allow-Methods": "GET,POST,OPTIONS" } });
    }
    if (r.request().method() === "POST") {
      let body = {};
      try { body = JSON.parse(r.request().postData() || "{}"); } catch { body = {}; }
      posts.push(body);
      return json(r, { ok: true, flags: Object.assign({ "feat.racetrack_marker": true }, body.flags || {}) });
    }
    return json(r, {
      ok: true,
      flags: { "feat.racetrack_marker": true, "feat.livestats": true },
      labels: { "feat.racetrack_marker": "Show my marker on followers' racetracks", "feat.livestats": "Live stats" },
      keys: ["feat.livestats"],
      categories: { "feat.livestats": "Live" },
      categoryOrder: ["Live"]
    });
  });
  await page.addInitScript(authInitScript());
  await page.addInitScript(() => { try { localStorage.setItem("tipbot_theme", "apex"); } catch (e) {} });
  await page.goto(baseUrl + "#/s/1", { waitUntil: "domcontentloaded" });
  const hd = page.locator("#settings-panel .panel-hd");
  await hd.waitFor({ timeout: 30000 });
  if ((await hd.getAttribute("aria-expanded")) !== "true") await hd.click();
  await expect(page.locator("#stab-studio")).toBeVisible({ timeout: 15000 });
  await page.locator("#stab-studio").click();
  await page.waitForSelector("#studio-marker-cb", { timeout: 15000 });
  const cb = page.locator("#studio-marker-cb");
  await expect(cb).toBeChecked();
  await expect(page.locator("#studio-marker-card")).toContainText("Show my marker on followers' racetracks");
  await expect(page.locator("#studio-marker-card")).toContainText("Sponsor Studio");
  if (SHOTS) {
    fs.mkdirSync(SHOTS, { recursive: true });
    await page.locator("#studio-marker-card").screenshot({ path: path.join(SHOTS, "studio-marker-toggle.png") });
  }
  await page.locator("#studio-marker-save").click();
  await expect(page.locator("#studio-marker-msg")).toContainText("saved");
  expect(posts.some((p) => p.flags && p.flags["feat.racetrack_marker"] === true)).toBe(true);
});
