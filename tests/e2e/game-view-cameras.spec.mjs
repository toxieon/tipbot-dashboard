// Job 08: Game view camera presets. Opens the demo Game view, cycles every preset with the change-view button at phone and
// desktop size, and saves a screenshot per preset to tests/e2e/__screens__/cameras/ (tests/ is in
// the public build's DENY_DIRS, so these never ship).
import { test, expect } from "@playwright/test";
import { startMockSite, authInitScript, installApiMock } from "./mock-server.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SHOTS = path.join(path.dirname(fileURLToPath(import.meta.url)), "__screens__", "cameras");
fs.mkdirSync(SHOTS, { recursive: true });

test.use({
  launchOptions: {
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
    ...(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {}),
  },
});

let baseUrl, server;
test.beforeAll(async () => { server = await startMockSite(); baseUrl = `http://127.0.0.1:${server.address().port}/`; });
test.afterAll(async () => { if (server) server.close(); });

async function openGameView(page, opts = {}) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await installApiMock(page);
  await page.route("**/api/me**", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    headers: { "Access-Control-Allow-Origin": route.request().headers().origin || "*", "Access-Control-Allow-Credentials": "true" },
    body: JSON.stringify({ ok: true, ops: true }),
  }));
  // Owner-only extension script: absent here (same stub as follower-live.spec.mjs).
  await page.route("**/api/ops/ext.js**", (route) => route.fulfill({
    status: 404, contentType: "text/plain",
    headers: { "Access-Control-Allow-Origin": route.request().headers().origin || "*", "Access-Control-Allow-Credentials": "true" }, body: "",
  }));
  if (opts.noModel) await page.route("**/assets/mcg/mcg.glb**", (route) => route.fulfill({ status: 404, body: "" }));
  if (!opts.keepStorage) await page.addInitScript(() => { try { localStorage.removeItem("tipdash_gv_cam"); } catch (e) {} });
  // Player animations default to off (0.66.7 basketball job). This spec was written with the
  // cartoon players running on the demo, so keep them on here.
  await page.addInitScript(() => { try { localStorage.setItem("tipdash_gv_anim", "1"); } catch (e) {} });
  await page.addInitScript(authInitScript());
  await page.goto(baseUrl + "#/demo/game", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => {
    const h = document.getElementById("flive-mcg");
    return h && (h.classList.contains("is-webgl") || h.dataset.mcgError);
  }, null, { timeout: 45000 });
  await page.waitForTimeout(400);
  return errors;
}

const CYCLE = ["goals-north", "goals-south", "wing", "blimp", "broadcast"];

async function buttonBox(page) {
  return page.evaluate(() => {
    const b = document.querySelector(".fl-camcycle").getBoundingClientRect();
    const host = document.getElementById("flive-mcg").getBoundingClientRect();
    return { b: b.toJSON(), host: host.toJSON(), vw: document.documentElement.clientWidth, vh: window.innerHeight,
      noHScroll: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1 };
  });
}
function expectOnScreen(m) {
  expect(m.b.width).toBeGreaterThanOrEqual(36);
  expect(m.b.width).toBeLessThanOrEqual(44);
  expect(Math.abs(m.b.width - m.b.height)).toBeLessThan(1);
  expect(m.b.left).toBeGreaterThanOrEqual(m.host.left);
  expect(m.b.right).toBeLessThanOrEqual(m.host.right + 0.5);
  expect(m.b.top).toBeGreaterThanOrEqual(m.host.top);
  expect(m.b.bottom).toBeLessThanOrEqual(m.host.bottom + 0.5);
  expect(m.b.left).toBeGreaterThanOrEqual(0);
  expect(m.b.right).toBeLessThanOrEqual(m.vw);
  // A corner, not the middle of the ground.
  expect(m.b.left - m.host.left).toBeLessThan(m.host.width / 4);
  expect(m.noHScroll).toBe(true);
}

for (const vp of [{ name: "390", width: 390, height: 844 }, { name: "1440", width: 1440, height: 900 }]) {
  test.describe(`change-view button at ${vp.width}x${vp.height}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("one round button; each tap goes to the next preset and wraps; the choice is saved", async ({ page, context }) => {
      test.setTimeout(90000); // five swiftshader screenshots at 1440 px ran close to the 60 s default
      const popups = [];
      context.on("page", (p) => popups.push(p.url()));
      const errors = await openGameView(page);
      await expect(page.locator("#flive-mcg")).toHaveClass(/is-webgl/);
      await expect(page.locator(".fl-cams button")).toHaveCount(1);
      const btn = page.getByRole("button", { name: "Change view" });
      await expect(btn).toHaveCount(1);
      await expect(page.locator("[data-cam-chip]")).toHaveCount(0);
      expectOnScreen(await buttonBox(page));
      await expect(page.locator("#flive-mcg")).toHaveAttribute("data-cam", "broadcast");

      for (const id of CYCLE) {
        await btn.click();
        await expect(page.locator("#flive-mcg")).toHaveAttribute("data-cam", id);
        expect(await page.evaluate(() => document.getElementById("flive-mcg")._mcg.cameraId)).toBe(id);
        await page.waitForTimeout(750); // let the 600 ms tween land
        await page.locator(".fl-hero").screenshot({ path: path.join(SHOTS, `${vp.name}-${id}.png`) });
      }
      expect(await page.evaluate(() => localStorage.getItem("tipdash_gv_cam"))).toBe("broadcast");
      await expect(btn).toHaveAttribute("title", "Change view: Broadcast");
      // Still in its corner after a scroll and a rotation.
      await page.evaluate(() => window.scrollBy(0, 400));
      await page.waitForTimeout(100);
      const afterScroll = await buttonBox(page);
      expect(afterScroll.b.left - afterScroll.host.left).toBeLessThan(afterScroll.host.width / 4);
      await page.setViewportSize({ width: vp.height, height: vp.width });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(300);
      expectOnScreen(await buttonBox(page));
      expect(popups).toEqual([]);
      expect(errors).toEqual([]);
    });
  });
}

test("the saved camera comes back on the next open", async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem("tipdash_gv_cam", "wing"); } catch (e) {} });
  await openGameView(page, { keepStorage: true });
  await expect(page.locator("#flive-mcg")).toHaveAttribute("data-cam", "wing");
  await expect(page.getByRole("button", { name: "Change view" })).toHaveAttribute("title", "Change view: Wing");
  expect(await page.evaluate(() => document.getElementById("flive-mcg")._mcg.cameraId)).toBe("wing");
});

test("photo fallback (the model can't load): no change-view button", async ({ page }) => {
  await openGameView(page, { noModel: true });
  await expect(page.locator("#flive-mcg")).not.toHaveClass(/is-webgl/);
  await expect(page.locator(".fl-cams")).toHaveCount(0);
  await expect(page.locator("#flive-mcg .fl-mcg-fallback")).toBeVisible();
});
