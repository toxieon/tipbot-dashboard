// Job 03: Followers view, My Tips and Discover open from a cold load at 390x844 now that
// they live in lazy files. Back navigation stays in the app and nothing opens a new tab.
// Screenshots go to E2E_SHOTS_DIR (default: the OS temp dir), never into the repo.
import { test, expect } from "@playwright/test";
import { startMockSite, authInitScript, installApiMock } from "./mock-server.mjs";
import os from "node:os";
import path from "node:path";
import { mkdirSync } from "node:fs";

const SHOTS = process.env.E2E_SHOTS_DIR || path.join(os.tmpdir(), "tipdash-e2e");
mkdirSync(SHOTS, { recursive: true });

const FOLLOWS = [
  { guild_id: "11", display_name: "Test Tipster", enabled: 1, subscription_active: 1 },
  { guild_id: "12", display_name: "Demo Server", enabled: 1, subscription_active: 1 },
];
const FOLLOWER = {
  display_name: "Test Tipster",
  stats: { won: 3, lost: 1, push: 0, pending: 1, profit_units: 2.5, roi: 12, strike_rate: 75, staked_units: 4 },
  feed: [], months: ["2026-10"], month: "", cal_month: "2026-10", daily_series: {},
};
const TIPSTERS = [
  { guild_id: "7", display_name: "Footy Edge", settled: 40, wins: 24, losses: 16, units_net: 18.4, strike: 60, recent_nets: [1, -1, 2] },
  { guild_id: "8", display_name: "Railbird", settled: 22, wins: 10, losses: 12, units_net: -3.2, strike: 45.5, recent_nets: [-1, 2] },
];

let baseUrl, server;
test.beforeAll(async () => { server = await startMockSite(); baseUrl = `http://127.0.0.1:${server.address().port}/`; });
test.afterAll(async () => { if (server) server.close(); });

const json = (body) => ({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(body) });

async function boot(page, context, hash = "") {
  const errors = [], popups = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  context.on("page", (p) => popups.push(p.url()));
  await installApiMock(page);
  await page.route(/\/api\/servers(\?|$)/, (r) => r.fulfill(json({ role: "follower", servers: [], follower_servers: FOLLOWS })));
  await page.route("**/api/follower?**", (r) => r.fulfill(json(FOLLOWER)));
  await page.route("**/api/my-tips**", (r) => r.fulfill(json({ ok: true, tips: [], months: [], month: "" })));
  await page.route(/\/api\/discover(\?|$)/, (r) => r.fulfill(json({ tipsters: TIPSTERS })));
  await page.addInitScript(authInitScript());
  await page.goto(baseUrl + hash, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => { const a = document.getElementById("app"); return a && !a.hidden; });
  return { errors, popups };
}

async function noOverflow(page) {
  const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(o).toBeLessThanOrEqual(1);
}

test.describe("lazy follower views at 390x844", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("Followers view, My Tips and Discover open from a cold load; Back stays in the app", async ({ page, context }) => {
    const { errors, popups } = await boot(page, context);
    await page.evaluate(() => openFollowerView("11", "Test Tipster"));
    await expect(page.locator("#follower")).toBeVisible();
    await expect(page.locator("#follower")).toContainText("Your tips");
    await expect(page.locator("#follower h1").first()).toHaveText("Test Tipster");
    await noOverflow(page);
    await page.screenshot({ path: path.join(SHOTS, "lazy-follower.png") });

    await page.locator("#tb-promo-chip").click();
    await expect(page.locator("#mytips")).toBeVisible();
    await expect(page.locator("#mytips")).toContainText("My Tips");
    await noOverflow(page);
    await page.screenshot({ path: path.join(SHOTS, "lazy-mytips.png") });

    await page.goBack();
    await expect(page.locator("#follower")).toBeVisible();
    await expect(page.locator("#follower")).toContainText("Your tips");

    await page.locator("#tb-discover-chip").click();
    await expect(page.locator("#discover")).toBeVisible();
    await expect(page.locator(".dc-card")).toHaveCount(2);
    await noOverflow(page);
    await page.screenshot({ path: path.join(SHOTS, "lazy-discover.png") });

    await page.goBack();
    await expect(page.locator("#follower")).toBeVisible();
    expect(page.url().startsWith(baseUrl)).toBe(true);
    expect(popups).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("All-communities rollup opens from a cold load", async ({ page, context }) => {
    const { errors, popups } = await boot(page, context);
    await page.evaluate(() => openFollowerAllView());
    await expect(page.locator("#follower")).toContainText("All communities");
    await expect(page.locator("#follower")).toContainText("Combined · 2 communities");
    await noOverflow(page);
    await page.screenshot({ path: path.join(SHOTS, "lazy-follower-all.png") });
    expect(popups).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("hard refresh on a deep link to each view still renders it", async ({ page, context }) => {
    const { errors } = await boot(page, context, "#/discover");
    await expect(page.locator(".dc-card")).toHaveCount(2);
    await page.goto(baseUrl + "#/mytips", { waitUntil: "domcontentloaded" });
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("#mytips")).toBeVisible();
    await expect(page.locator("#mytips")).toContainText("My Tips");
    expect(errors).toEqual([]);
  });
});
