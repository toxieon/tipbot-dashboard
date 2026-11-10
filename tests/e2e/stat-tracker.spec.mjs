// Stat tracker model choice (0.72.2) at 390 px, Apex, mocked API: Settings -> Command
// access lists the Horse Predictor models (all on by default), the owner switches some off
// and saves, the tally follows; an operator sees it read-only; no Horse Predictor tally, no section.
// Screenshots: SHOTS=/dir writes stat-tracker-*.png (default: none).
import { test, expect } from "@playwright/test";
import path from "node:path";
import { startMockSite, authInitScript, installApiMock } from "./mock-server.mjs";

const SHOTS = process.env.SHOTS || "";
test.use({ viewport: { width: 390, height: 844 } });

let baseUrl, server;
test.beforeAll(async () => { server = await startMockSite(); baseUrl = `http://127.0.0.1:${server.address().port}/`; });
test.afterAll(async () => { if (server) server.close(); });

const MODELS = [
  ["with_price", "With-price", "The model's top pick using market prices.", 31, 52, -14.2],
  ["without_price", "Without-price", "The model's top pick from form alone.", 14, 101, -61.9],
  ["agree", "Agree", "Races where both models pick the same runner.", 21, 40, -9.1],
  ["pub_sheet", "Pub sheet", "The 7 am pub sheet selections.", 26, 25, -2.6],
  ["best_pick", "Best pick of the day", "One pick a day, the model's strongest.", 3, 1, 1.35],
];
function view(tracked, extra = {}) {
  const models = MODELS.map(([key, label, description, wins, losses, units]) => {
    const on = tracked.includes(key);
    return on ? { key, label, description, tracked: true, wins, losses, units, days: 5 } : { key, label, description, tracked: false };
  });
  const totals = models.filter((m) => m.tracked).reduce((t, m) => ({ wins: t.wins + m.wins, losses: t.losses + m.losses, units: Math.round((t.units + m.units) * 100) / 100 }), { wins: 0, losses: 0, units: 0 });
  return { ok: true, guild_id: "1", days: 30, tracked, models, totals, updated_at: null, can_edit: true, ...extra };
}
const ALL = MODELS.map((m) => m[0]);

async function open(page, first, onPost) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await installApiMock(page);
  const cors = (route) => ({ "Access-Control-Allow-Origin": route.request().headers().origin || "*", "Access-Control-Allow-Credentials": "true" });
  await page.route("**/api/server/predictor-tracker**", (r) => r.fulfill({ status: 200, contentType: "application/json", headers: cors(r), body: JSON.stringify(first) }));
  await page.route("**/api/server/predictor-tracking", async (r) => {
    if (r.request().method() === "OPTIONS") return r.fulfill({ status: 204, headers: { ...cors(r), "Access-Control-Allow-Headers": "authorization,content-type", "Access-Control-Allow-Methods": "GET,POST,OPTIONS" } });
    const body = JSON.parse(r.request().postData() || "{}");
    onPost && onPost(body);
    return r.fulfill({ status: 200, contentType: "application/json", headers: cors(r), body: JSON.stringify({ ...view(body.tracked), message: "Stat tracker saved." }) });
  });
  await page.addInitScript(authInitScript());
  await page.goto(baseUrl + "#/s/1", { waitUntil: "domcontentloaded" });
  const hd = page.locator("#settings-panel .panel-hd");
  await hd.waitFor({ timeout: 30000 });
  if ((await hd.getAttribute("aria-expanded")) !== "true") await hd.click();
  await page.locator("#stab-perms").click();
  return errors;
}
async function shot(page, name) {
  if (!SHOTS) return;
  const el = page.locator("#stm");
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  await el.screenshot({ path: path.join(SHOTS, "stat-tracker-" + name + ".png") });
  await page.screenshot({ path: path.join(SHOTS, "stat-tracker-" + name + "-page.png") });
}

test("owner: every model on by default, switch to Pub sheet + Best pick, save, tally follows", async ({ page }) => {
  let posted = null;
  const errors = await open(page, view(ALL), (b) => { posted = b; });
  const box = page.locator("#stm");
  await expect(box).toBeVisible();
  const toggles = box.locator(".stm-t");
  await expect(toggles).toHaveCount(5);
  for (let i = 0; i < 5; i++) await expect(toggles.nth(i)).toHaveAttribute("aria-checked", "true");
  await expect(box.locator("#stm-save")).toBeDisabled();
  await expect(box.locator(".stm-tot")).toContainText("95-219");
  await shot(page, "default");
  for (const k of ["with_price", "without_price", "agree"]) await box.locator(`.stm-t[data-k="${k}"]`).click();
  await expect(box.locator(`.stm-t[data-k="agree"]`)).toHaveAttribute("aria-checked", "false");
  await expect(box.locator("#stm-save")).toBeEnabled();
  await box.locator("#stm-save").click();
  await expect(box.locator("#stm-msg")).toHaveText("✓ saved");
  expect(posted).toEqual({ guild_id: "1", tracked: ["pub_sheet", "best_pick"] });
  await expect(box.locator(".stm-tot")).toContainText("29-26");
  await expect(box.locator(`.stm-t[data-k="with_price"]`).locator("xpath=..")).toContainText("Not tracked");
  await shot(page, "pub-best");
  await box.locator("#stm-all").click();
  for (let i = 0; i < 5; i++) await expect(toggles.nth(i)).toHaveAttribute("aria-checked", "true");
  expect(errors).toEqual([]);
});

test("operator: read-only; no Horse Predictor tally: no section", async ({ page, browser }) => {
  const errors = await open(page, view(ALL, { can_edit: false }));
  const box = page.locator("#stm");
  await expect(box).toBeVisible();
  await expect(box.locator(".stm-t").first()).toBeDisabled();
  await expect(box.locator("#stm-save")).toHaveCount(0);
  await expect(box).toContainText("Only the owner or a server admin can change this.");
  await shot(page, "readonly");
  expect(errors).toEqual([]);
  const p2 = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const empty = view(ALL);
  empty.models = empty.models.map((m) => ({ ...m, wins: 0, losses: 0, units: 0, days: 0 }));
  empty.totals = { wins: 0, losses: 0, units: 0 };
  await open(p2, empty);
  await expect(p2.locator("#perms-box")).not.toBeEmpty();
  await p2.waitForTimeout(500);
  await expect(p2.locator("#stm")).toHaveCount(0);
  await p2.close();
});
