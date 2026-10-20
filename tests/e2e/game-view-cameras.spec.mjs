// Job 08: Game view camera presets. Opens the demo Game view, cycles every preset at phone and
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

const CYCLE = [["broadcast", "broadcast"], ["ends", "goals-north"], ["ends", "goals-south"], ["wing", "wing"], ["blimp", "blimp"]];

for (const vp of [{ name: "390", width: 390, height: 844 }, { name: "1440", width: 1440, height: 900 }]) {
  test.describe(`camera presets at ${vp.width}x${vp.height}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("every preset, the chips, the saved choice", async ({ page, context }) => {
      test.setTimeout(90000); // five swiftshader screenshots at 1440 px ran close to the 60 s default
      const popups = [];
      context.on("page", (p) => popups.push(p.url()));
      const errors = await openGameView(page);
      await expect(page.locator("#flive-mcg")).toHaveClass(/is-webgl/);
      const chips = page.locator(".fl-cams button");
      await expect(chips).toHaveCount(4);
      await expect(chips).toHaveText(["Broadcast", "Ends", "Wing", "Blimp"]);
      for (const box of await chips.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()))) {
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.width).toBeGreaterThanOrEqual(44);
      }
      // The row fits inside the ground at this width.
      const fits = await page.evaluate(() => {
        const row = document.querySelector(".fl-cams").getBoundingClientRect();
        const host = document.getElementById("flive-mcg").getBoundingClientRect();
        return row.left >= host.left && row.right <= host.right + 0.5 && document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1;
      });
      expect(fits).toBe(true);

      for (const [chip, id] of CYCLE) {
        await page.locator(`[data-cam-chip="${chip}"]`).click();
        await expect(page.locator("#flive-mcg")).toHaveAttribute("data-cam", id);
        await expect(page.locator(`[data-cam-chip="${chip}"]`)).toHaveAttribute("aria-pressed", "true");
        expect(await page.evaluate(() => document.getElementById("flive-mcg")._mcg.cameraId)).toBe(id);
        await page.waitForTimeout(750); // let the 600 ms tween land
        await page.locator(".fl-hero").screenshot({ path: path.join(SHOTS, `${vp.name}-${id}.png`) });
      }
      await expect(page.locator('[data-cam-chip="ends"]')).toHaveText("Ends");
      expect(await page.evaluate(() => localStorage.getItem("tipdash_gv_cam"))).toBe("blimp");
      // The cartoon players only show on the broadcast camera.
      await page.locator('[data-cam-chip="broadcast"]').click();
      await expect(page.locator("#flive-mcg")).toHaveAttribute("data-cam", "broadcast");
      expect(popups).toEqual([]);
      expect(errors).toEqual([]);
    });
  });
}

test("the saved camera comes back on the next open", async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem("tipdash_gv_cam", "wing"); } catch (e) {} });
  await openGameView(page, { keepStorage: true });
  await expect(page.locator("#flive-mcg")).toHaveAttribute("data-cam", "wing");
  await expect(page.locator('[data-cam-chip="wing"]')).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => document.getElementById("flive-mcg")._mcg.cameraId)).toBe("wing");
});

test("photo fallback (the model can't load): no chip row", async ({ page }) => {
  await openGameView(page, { noModel: true });
  await expect(page.locator("#flive-mcg")).not.toHaveClass(/is-webgl/);
  await expect(page.locator(".fl-cams")).toHaveCount(0);
  await expect(page.locator("#flive-mcg .fl-mcg-fallback")).toBeVisible();
});
