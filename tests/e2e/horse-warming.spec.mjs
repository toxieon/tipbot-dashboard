// 0.74.2: Horses page while TipBot's results copy is warming. Mocked API only, no live session.
// Screenshots go to E2E_SHOTS_DIR (default: the OS temp dir), never into the repo.
import { test, expect } from "@playwright/test";
import { startMockSite, authInitScript, installApiMock } from "./mock-server.mjs";
import os from "node:os";
import path from "node:path";
import { mkdirSync } from "node:fs";

const SHOTS = process.env.E2E_SHOTS_DIR || path.join(os.tmpdir(), "tipdash-e2e");
mkdirSync(SHOTS, { recursive: true });

const json = (body, status = 200) => ({ status, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(body) });
let baseUrl, server;
test.beforeAll(async () => { server = await startMockSite(); baseUrl = `http://127.0.0.1:${server.address().port}/`; });
test.afterAll(async () => { if (server) server.close(); });

for (const vp of [{ w: 390, h: 844 }, { w: 1280, h: 900 }]) {
  test(`warming shows the checkbox and Refreshing, then the list at ${vp.w}px`, async ({ page }) => {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    const errors = [];
    page.on("pageerror", (e) => { if (!/Unexpected token ':'/.test(String(e))) errors.push(String(e)); });
    await installApiMock(page);
    let warm = true;
    await page.route(/\/api\/servers(\?|$)/, (r) => r.fulfill(json({ role: "owner", ops: true, servers: [{ guild_id: "1", display_name: "Test", enabled: 1, subscription_active: 1, unit_size: 20, won: 0, lost: 0, profit_units: 0, roi: 0, queued: 0 }], follower_servers: [] })));
    await page.route(/\/api\/me(\?|$)/, (r) => r.fulfill(json({ ok: true, ops: true })));
    await page.route(/\/api\/racing\/results/, async (r) => {
      if (warm) return r.fulfill(json({ ok: true, meetings: [], warming: true }));
      return r.fallback();
    });
    await page.addInitScript(authInitScript());
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => { const a = document.getElementById("app"); return a && !a.hidden; });
    await page.waitForFunction(() => typeof openHorseResults === "function");
    await page.evaluate(() => openHorseResults());
    await expect(page.locator("#hr-extra-cb")).toBeVisible();
    await expect(page.getByText("Refreshing results")).toBeVisible();
    await expect(page.locator(".hr-sk").first()).toBeVisible();
    await page.screenshot({ path: path.join(SHOTS, `horses-warming-${vp.w}.png`), fullPage: false });
    warm = false;
    await expect(page.locator("#hr-list")).toBeVisible({ timeout: 8000 });
    await expect(page.getByText("Refreshing results")).toHaveCount(0);
    await expect(page.locator("#hr-extra-cb")).toBeVisible();
    await page.screenshot({ path: path.join(SHOTS, `horses-ready-${vp.w}.png`), fullPage: false });
    expect(errors).toEqual([]);
  });
}
