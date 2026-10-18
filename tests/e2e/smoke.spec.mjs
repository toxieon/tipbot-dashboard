import { test, expect } from "@playwright/test";
import { startMockSite, authInitScript, installApiMock } from "./mock-server.mjs";

let baseUrl;
let server;

test.beforeAll(async () => {
  server = await startMockSite();
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}/`;
});

test.afterAll(async () => {
  if (server) server.close();
});

async function boot(page) {
  const pageErrors = [];
  const consoleErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  await installApiMock(page);
  await page.addInitScript(authInitScript());
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(() => {
    const app = document.getElementById("app");
    return app && !app.hidden;
  }, { timeout: 45000 });
  return { pageErrors, consoleErrors };
}

function assertNoConsoleErrors(report) {
  // Quarantine only the browser's resource-load line ("Failed to load resource").
  // Chromium prints that when an optional file, often a favicon, is missing. It is
  // not an application exception, and it flakes this 390px check. pageerror events
  // and every other console error still fail the check.
  expect(report.pageErrors).toEqual([]);
  const real = report.consoleErrors.filter((e) => !/^Failed to load resource\b/i.test(e));
  expect(real).toEqual([]);
}

async function assertNoOverflow(page) {
  const overflow = await page.evaluate(() => {
    const el = document.documentElement;
    return el.scrollWidth > el.clientWidth + 1;
  });
  expect(overflow).toBe(false);
}

test("Home at 390px: no overflow or console errors", async ({ page }) => {
  const errors = await boot(page);
  await expect(page.locator("#overview")).toBeVisible();
  await assertNoOverflow(page);
  assertNoConsoleErrors(errors);
});

test("Stats at 390px: no overflow or console errors", async ({ page }) => {
  const errors = await boot(page);
  await page.locator(".home-stats-tile").click();
  await page.waitForFunction(() => {
    const stats = document.getElementById("stats");
    return stats && !stats.hidden && stats.querySelector(".ds-page");
  });
  await assertNoOverflow(page);
  assertNoConsoleErrors(errors);
});

test("Build at 390px: no overflow or console errors", async ({ page }) => {
  const errors = await boot(page);
  await page.locator("#overview .scard").filter({ hasText: "Test" }).click();
  await page.waitForFunction(() => {
    const detail = document.getElementById("detail");
    return detail && !detail.hidden;
  });
  await page.locator("#buildbtn").click();
  await page.waitForFunction(() => {
    const builder = document.getElementById("builder");
    return builder && !builder.hidden;
  }, { timeout: 30000 });
  await assertNoOverflow(page);
  assertNoConsoleErrors(errors);
});

test("Upcoming at 390px: no overflow or console errors", async ({ page }) => {
  const errors = await boot(page);
  await page.evaluate(() => {
    if (typeof openUpcomingHome === "function") openUpcomingHome();
  });
  await page.waitForFunction(() => {
    const upc = document.getElementById("upcoming");
    return upc && !upc.hidden;
  });
  await assertNoOverflow(page);
  assertNoConsoleErrors(errors);
});

test("Horses at 390px: placings, search, no overflow or console errors", async ({ page }) => {
  const errors = await boot(page);
  await page.locator(".home-stats-tile").click();
  await page.waitForSelector("#ds-horses");
  await page.locator("#ds-horses").click();
  await page.waitForFunction(() => {
    const stats = document.getElementById("stats");
    return stats && !stats.hidden && /Flemington/.test(stats.innerText || "");
  });
  await expect(page.locator(".hr-row--1").first()).toBeVisible();
  await expect(page.locator(".hr-row--out").first()).toBeVisible();
  await page.locator("#hr-q").fill("Silver");
  await expect(page.locator(".hr-row--hit")).toContainText("Silver");
  await page.locator(".hr-meet-sum").first().click();
  await assertNoOverflow(page);
  assertNoConsoleErrors(errors);
});

test("Racing at 390px: no overflow or console errors", async ({ page }) => {
  const errors = await boot(page);
  await page.locator(".home-racing-tile").click();
  await page.waitForFunction(() => {
    const builder = document.getElementById("builder");
    return builder && !builder.hidden && builder.innerHTML.includes("Gallops");
  }, { timeout: 30000 });
  await assertNoOverflow(page);
  assertNoConsoleErrors(errors);
});
