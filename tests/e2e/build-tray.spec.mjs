import { test, expect } from "@playwright/test";
import { startMockSite, authInitScript, installApiMock } from "./mock-server.mjs";

let baseUrl, server;
test.beforeAll(async () => { server = await startMockSite(); baseUrl = `http://127.0.0.1:${server.address().port}/`; });
test.afterAll(async () => { if (server) server.close(); });

test("NFL build at 390x844: compact tray never covers the last card's controls", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await installApiMock(page);
  await page.addInitScript(authInitScript());
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => { const a = document.getElementById("app"); return a && !a.hidden; });
  await page.evaluate(async () => {
    await TD.load("builder");
    const pos = ["QB", "RB", "WR", "TE", "WR", "RB"];
    const players = Array.from({ length: 12 }, (_, i) => ({ name: "Player " + String(i).padStart(2, "0"), position: pos[i % pos.length], player_id: "p" + i }));
    Object.assign(BUILD, { guildId: "1", espnLeague: "nfl", espnEvent: { id: "e1", name: "A at B" }, espnTeams: [{ id: "t1", name: "Team A", players }], espnPlayers: [], espnErr: "", search: "", collapsed: {}, espnPropKey: "anytime_td", legs: [] });
    panel("builder"); show("app");
    renderEspnNflProps();
  });
  // QBs pinned first, filter defaults to All.
  await expect(page.locator(".pos-filter .tab.active")).toHaveText("All");
  const firstPos = await page.locator("#players .prow .pnum").first().textContent();
  expect(firstPos).toBe("QB");
  // Add two legs.
  const adds = page.locator("#players .addbtn");
  await adds.nth(0).click(); await adds.nth(1).click();
  await expect(page.locator("#traytoggle")).toContainText("Review multi (2)");
  await expect(page.locator("#traybody")).toBeHidden();
  // Last card: scroll it into view and click Under + Add (fails if the tray intercepts).
  const last = page.locator("#players .prow").last();
  await last.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await last.locator('button[data-s="Under"]').click({ timeout: 3000 });
  await last.locator(".addbtn").click({ timeout: 3000 });
  await expect(page.locator("#traytoggle")).toContainText("Review multi (3)");
  const boxes = await page.evaluate(() => {
    const r = document.querySelector("#players .prow:last-child .addbtn").getBoundingClientRect();
    const t = document.getElementById("tray").getBoundingClientRect();
    return { addBottom: r.bottom, trayTop: t.top };
  });
  expect(boxes.addBottom).toBeLessThanOrEqual(boxes.trayTop);
  // Expand shows chips.
  await page.locator("#traytoggle").click();
  await expect(page.locator("#traybody .chip")).toHaveCount(3);
  expect(errors).toEqual([]);
});
