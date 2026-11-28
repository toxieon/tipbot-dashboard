// 0.74.1: owner-only "Wet track shortlist" checkbox on the Horses page. Mocked API only,
// no live session. Screenshots go to E2E_SHOTS_DIR (default: the OS temp dir), never into the repo.
import { test, expect } from "@playwright/test";
import { startMockSite, authInitScript, installApiMock } from "./mock-server.mjs";
import os from "node:os";
import path from "node:path";
import { mkdirSync } from "node:fs";

const SHOTS = process.env.E2E_SHOTS_DIR || path.join(os.tmpdir(), "tipdash-e2e");
mkdirSync(SHOTS, { recursive: true });

const W = (starts, wins, places) => ({ starts, wins, places });
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Melbourne" }).format(new Date());
const entry = (id, name, number, price, wet, won, extra = {}) => ({ id, name, number, price, p_adj: 0.2, wet, stays: false, finish: null, won, ...extra });

const BODY = {
  ok: true, day: today, built_at: new Date().toISOString(), run: 3, upcoming: 2, wet_runs_stored: 640,
  rule: "Wet record = stored Soft/Heavy runs before today. Listed when it has 1+ wet start and placed in at least half. Ranked by the model's win chance plus a wet-form boost.",
  tally: {
    with_price: { bets: 3, wins: 1, losses: 2, units: 2.9, priced: 3, roi: 0.97, pending: 2 },
    without_price: { bets: 3, wins: 1, losses: 2, units: -0.6, priced: 3, roi: -0.2, pending: 1 },
    agree: { bets: 2, wins: 1, losses: 1, units: 3.6, priced: 2, roi: 1.8, pending: 0 },
  },
  races: [
    { id: "r1", track: "Gold Coast", race_number: 2, start: today + "T03:09:00+00:00", distance: 1722, track_condition: "Heavy10", status: "run", field: 6, winner: { name: "Fearless Win", number: 4, price: 2.6 },
      columns: {
        with_price: [entry("a", "Tisani James", 3, 9, W(1, 1, 1), false, { finish: 3 }), entry("b", "Alto Luna", 6, 10, W(1, 1, 1), false, { finish: 4 })],
        without_price: [entry("a", "Tisani James", 3, 9, W(1, 1, 1), false, { finish: 3 })],
        agree: [entry("a", "Tisani James", 3, 9, W(1, 1, 1), false, { finish: 3 })] } },
    { id: "r2", track: "Doomben", race_number: 3, start: today + "T02:53:00+00:00", distance: 2000, track_condition: "Soft5", status: "run", field: 12, winner: { name: "Savisanta", number: 1, price: 3.6 },
      columns: {
        with_price: [entry("c", "Savisanta", 1, 3.6, W(1, 1, 1), true, { finish: 1, stays: true }), entry("d", "La Rosetta", 9, 6.5, W(1, 1, 1), false), entry("e", "Half Listening", 13, 3.8, W(1, 0, 1), false, { finish: 4 })],
        without_price: [entry("c", "Savisanta", 1, 3.6, W(1, 1, 1), true, { finish: 1, stays: true }), entry("d", "La Rosetta", 9, 6.5, W(1, 1, 1), false)],
        agree: [entry("c", "Savisanta", 1, 3.6, W(1, 1, 1), true, { finish: 1, stays: true })] } },
    { id: "r3", track: "Wagga Riverside", race_number: 1, start: today + "T02:56:00+00:00", distance: 1200, track_condition: "Soft7", status: "run", field: 11, winner: { name: "Kenny's Swans", number: 2, price: 2.6 },
      columns: { with_price: [entry("f", "Forjori", 8, 9, W(1, 0, 1), false, { finish: 7 })], without_price: [], agree: [] } },
    { id: "r4", track: "Doomben", race_number: 7, start: today + "T06:10:00+00:00", distance: 1400, track_condition: "Soft5", status: "upcoming", field: 10, winner: null,
      columns: {
        with_price: [entry("g", "Rain Dancer Of The Hills", 5, 7.5, W(2, 1, 2), null, { stays: true }), entry("h", "Mudlark", 2, 12, W(1, 0, 1), null)],
        without_price: [entry("h", "Mudlark", 2, 12, W(1, 0, 1), null)],
        agree: [] } },
    { id: "r5", track: "Rosehill Gardens", race_number: 8, start: today + "T06:45:00+00:00", distance: 1600, track_condition: "Heavy9", status: "upcoming", field: 9, winner: null,
      columns: { with_price: [], without_price: [], agree: [] }, note: "no model log" },
  ],
};

const SERVERS = (ops) => ({
  role: ops ? "owner" : "mod", ops,
  servers: [{ guild_id: "1", display_name: "Test", enabled: 1, subscription_active: 1, unit_size: 20, won: 0, lost: 0, profit_units: 0, roi: 0, queued: 0 }],
  follower_servers: [],
});

function json(body, status = 200) {
  return { status, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(body) };
}

let baseUrl, server;
test.beforeAll(async () => { server = await startMockSite(); baseUrl = `http://127.0.0.1:${server.address().port}/`; });
test.afterAll(async () => { if (server) server.close(); });

async function openHorses(page, { ops }) {
  const errors = [];
  const hits = [];
  // The mock site has no owner-only scripts, so an owner session logs one "Unexpected token ':'" on every
  // load, ticked or not. It predates this page; anything else fails the test.
  page.on("pageerror", (e) => { if (!/Unexpected token ':'/.test(String(e))) errors.push(String(e)); });
  await installApiMock(page);
  await page.route(/\/api\/servers(\?|$)/, (r) => r.fulfill(json(SERVERS(ops))));
  await page.route(/\/api\/me(\?|$)/, (r) => r.fulfill(json({ ok: true, ops })));
  await page.route(/\/api\/owner\/horse\/wet-shortlist/, (r) => { hits.push(r.request().url()); r.fulfill(json(BODY)); });
  await page.addInitScript(authInitScript());
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => { const a = document.getElementById("app"); return a && !a.hidden; });
  await page.waitForFunction(() => typeof openHorseResults === "function");
  await page.evaluate(() => openHorseResults());
  await expect(page.locator("#hr-app")).toBeVisible();
  return { errors, hits };
}

test("non-owner never sees the checkbox or calls the endpoint", async ({ page }) => {
  const { errors, hits } = await openHorses(page, { ops: false });
  await expect(page.locator("#hr-q")).toBeVisible();
  await expect(page.locator("#hr-extra-cb")).toHaveCount(0);
  expect(hits).toEqual([]);
  expect(errors).toEqual([]);
});

for (const vp of [{ w: 390, h: 844 }, { w: 1280, h: 900 }]) {
  test(`owner ticks Wet track shortlist at ${vp.w}px`, async ({ page }) => {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    const { errors, hits } = await openHorses(page, { ops: true });
    const cb = page.locator("#hr-extra-cb");
    await expect(cb).toBeVisible();
    await expect(page.locator("#hr-extra-box")).toBeHidden();
    await page.screenshot({ path: path.join(SHOTS, `wet-shortlist-${vp.w}-unticked.png`), fullPage: false });
    await cb.check();
    await expect(page.locator(".ws-race")).toHaveCount(5);
    expect(hits.length).toBe(1);
    await expect(page.locator("#hr-list")).toBeHidden();
    for (const c of ["with_price", "without_price", "agree"]) {
      await expect(page.locator(`.ws-tcard[data-tally="${c}"]`)).toBeVisible();
    }
    await expect(page.locator('.ws-race[data-race="r2"] .ws-col[data-col="with_price"] .ws-win .ws-mk')).toHaveText("\u2705");
    await expect(page.locator('.ws-race[data-race="r1"] .ws-col[data-col="with_price"] .ws-lose .ws-mk').first()).toHaveText("\u274C");
    await expect(page.locator('.ws-race[data-race="r4"] .ws-ent .ws-mk').first()).toHaveText("\u2022");
    // nothing on this page runs past the viewport
    const wide = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      return [...document.querySelectorAll("#hr-app *")].filter((n) => n.getBoundingClientRect().right > vw + 1).map((n) => n.className || n.tagName);
    });
    expect(wide).toEqual([]);
    await page.locator(".ws-head").scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(SHOTS, `wet-shortlist-${vp.w}-ticked-top.png`), fullPage: false });
    await page.locator('.ws-race[data-race="r2"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(SHOTS, `wet-shortlist-${vp.w}-ticked-races.png`), fullPage: false });
    await page.screenshot({ path: path.join(SHOTS, `wet-shortlist-${vp.w}-ticked-full.png`), fullPage: true });
    await cb.uncheck();
    await expect(page.locator("#hr-list")).toBeVisible();
    expect(errors).toEqual([]);
  });
}
