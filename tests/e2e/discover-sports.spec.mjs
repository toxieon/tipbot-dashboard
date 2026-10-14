import { test, expect } from "@playwright/test";
import { startMockSite, authInitScript, installApiMock } from "./mock-server.mjs";
import os from "node:os";
import path from "node:path";
import { mkdirSync } from "node:fs";

const SHOTS = process.env.E2E_SHOTS_DIR || path.join(os.tmpdir(), "tipdash-e2e");
mkdirSync(SHOTS, { recursive: true });

const TIPSTERS = [
  {
    guild_id: "1",
    display_name: "Footy Edge",
    settled: 40,
    wins: 24,
    losses: 16,
    units_net: 18.4,
    strike: 60,
    recent_nets: [1, -1, 2, 1.5, 0.5],
    sports: [
      { sport: "AFL", settled: 30 },
      { sport: "NRL", settled: 8 },
      { sport: "NBA", settled: 2 },
    ],
  },
  {
    guild_id: "2",
    display_name: "Railbird",
    settled: 22,
    wins: 10,
    losses: 12,
    units_net: -3.2,
    strike: 45.5,
    recent_nets: [-1, 2, -0.5, 1],
    sports: [{ sport: "Racing", settled: 22 }],
  },
  {
    guild_id: "3",
    display_name: "Sunday Sheet",
    settled: 15,
    wins: 9,
    losses: 6,
    units_net: 6.1,
    strike: 60,
    recent_nets: [1, 1, -1, 2],
    sports: ["NFL", "NBA"],
  },
  {
    guild_id: "4",
    display_name: "Pitch Side",
    settled: 12,
    wins: 7,
    losses: 5,
    units_net: 4,
    strike: 58.3,
    recent_nets: [1, -1, 0.5],
    sports: [{ sport: "Soccer", settled: 12 }],
  },
];

let baseUrl;
let server;

test.beforeAll(async () => {
  server = await startMockSite();
  baseUrl = `http://127.0.0.1:${server.address().port}/`;
});

test.afterAll(async () => {
  if (server) server.close();
});

test("Discover sport chips at 390×844 select more than one and tag cards", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = [];
  page.on("pageerror", (err) => errors.push(String(err)));
  await installApiMock(page);
  await page.route("**/api/discover", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ tipsters: TIPSTERS }),
    });
  });
  await page.addInitScript(authInitScript());
  await page.goto(baseUrl + "#/discover", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#dc-sports .dc-sport");

  const sports = await page.locator("#dc-sports .dc-sport").evaluateAll((els) => els.map((el) => el.getAttribute("data-sport")));
  expect(sports).toEqual(["", "AFL", "Horse Racing", "NRL", "NBA", "NFL", "Soccer"]);
  for (const name of ["All", "AFL", "Horse Racing", "NRL", "NBA", "NFL", "Soccer"]) {
    await expect(page.locator("#dc-sports")).toContainText(name);
  }
  await expect(page.locator('.dc-sport[data-sport=""]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".dc-card")).toHaveCount(4);
  await expect(page.locator(".dc-card", { hasText: "Footy Edge" }).locator(".dc-sport-tag")).toHaveCount(3);
  await expect(page.locator(".dc-card", { hasText: "Railbird" })).toContainText("Horse Racing");
  await expect(page.locator(".dc-spotlight")).toContainText("AFL");

  const fit = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
    chipH: document.querySelector(".dc-sport").getBoundingClientRect().height,
    searchW: document.querySelector("#dc-q").getBoundingClientRect().width,
    cardW: document.querySelector(".dc-card").getBoundingClientRect().width,
  }));
  expect(fit.scroll).toBeLessThanOrEqual(fit.client + 1);
  expect(fit.chipH).toBeGreaterThanOrEqual(44);
  expect(fit.searchW).toBeGreaterThan(300);
  expect(fit.cardW).toBeLessThanOrEqual(390);

  await page.screenshot({ path: path.join(SHOTS, "discover-sports-all.png") });

  await page.locator('.dc-sport[data-sport="AFL"]').click();
  await page.locator('.dc-sport[data-sport="NBA"]').click();
  await expect(page.locator('.dc-sport[data-sport="AFL"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('.dc-sport[data-sport="NBA"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('.dc-sport[data-sport=""]')).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".dc-card .dc-name")).toHaveText(["Footy Edge", "Sunday Sheet"]);
  await expect(page.locator(".dc-spotlight")).toContainText("Footy Edge");
  await expect(page.getByText("Matching tipsters")).toBeVisible();

  await page.screenshot({ path: path.join(SHOTS, "discover-sports-multi.png") });

  await page.locator("#dc-q").fill("zzzz");
  await expect(page.locator(".dc-card")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Show all sports" })).toBeVisible();
  await page.getByRole("button", { name: "Show all sports" }).click();
  await expect(page.locator('.dc-sport[data-sport=""]')).toHaveAttribute("aria-pressed", "true");
  await page.locator("#dc-q").fill("");
  await expect(page.locator(".dc-card")).toHaveCount(4);
  expect(errors).toEqual([]);
});
