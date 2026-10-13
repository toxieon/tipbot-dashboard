import { test, expect } from "@playwright/test";
import path from "node:path";
import { startMockSite, authInitScript, installApiMock } from "./mock-server.mjs";

const FIX = path.resolve(new URL("../fixtures/slips/real", import.meta.url).pathname);
let baseUrl, server;
test.beforeAll(async () => { server = await startMockSite(); baseUrl = `http://127.0.0.1:${server.address().port}/`; });
test.afterAll(async () => { if (server) server.close(); });

test("390x844: import the AFLW SGM screenshot through real OCR into the builder", async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await installApiMock(page);
  await page.addInitScript(authInitScript());
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => { const a = document.getElementById("app"); return a && !a.hidden; });
  await page.evaluate(() => { show("app"); return openSlipImport("1", "Test server"); });
  await page.locator("#slip-file").setInputFiles(path.join(FIX, "02-aflw-mel-ric-sgm-80.50.png"));
  await expect(page.locator("#slip-legs .slip-leg-row")).toHaveCount(5, { timeout: 60000 });
  await expect(page.locator("#slip-odds")).toHaveValue("80.5");
  const sels = await page.locator("#slip-legs .slip-leg-sel").evaluateAll((els) => els.map((e) => e.value));
  expect(sels).toEqual(["Richmond (W)", "Ryleigh Wotherspoon", "Georgia Gall", "Megan Fitzsimon", "Maeve Chaplin"]);
  const lines = await page.locator("#slip-legs .slip-leg-line").evaluateAll((els) => els.map((e) => e.value));
  expect(lines).toEqual(["", "1", "1", "15", "15"]);
  await expect(page.locator("#slip-flags")).toContainText("Stake");
  await page.locator("#slip-stake").fill("1");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow).toBe(false);
  await page.locator("#slip-apply").click();
  await expect(page.locator("#f_odds")).toHaveValue("80.5");
  expect(await page.evaluate(() => BUILD.legs.length)).toBe(5);
  expect(errors).toEqual([]);
});
