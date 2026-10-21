// Basketball Game view (P1-P3): a mocked NBA /api/follower/game at 390 px and desktop,
// the indoor arena with its four chips, AFL still on the MCG, and the Player
// animations setting (off by default, toggles with no reload).
import { test, expect } from "@playwright/test";
import { startMockSite, authInitScript, installApiMock } from "./mock-server.mjs";

test.use({
  launchOptions: {
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
    ...(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {}),
  },
});

let baseUrl, server;
test.beforeAll(async () => { server = await startMockSite(); baseUrl = `http://127.0.0.1:${server.address().port}/`; });
test.afterAll(async () => { if (server) server.close(); });

const GAME_NAME = "Northside Hawks @ Bayside Owls";

function fulfillJson(route, body) {
  const origin = route.request().headers().origin || "*";
  const headers = { "Access-Control-Allow-Origin": origin };
  if (origin !== "*") headers["Access-Control-Allow-Credentials"] = "true";
  return route.fulfill({ status: 200, contentType: "application/json", headers, body: JSON.stringify(body) });
}

function player(id, name, min, starter, pts, reb, ast, tpm, stl, blk, leg) {
  return { player_id: id, name, min, starter, has_leg: !!leg, pts, reb, ast, "3pm": tpm, stl, blk, pra: pts + reb + ast };
}

const BASKETBALL = {
  ok: true,
  guild_id: "9",
  game: {
    key: GAME_NAME, game_name: GAME_NAME, match_id: "401000001", sport: "NBA", league: "nba", sport_kind: "basketball",
    venue: "", live: true, concluded: false, phase_label: "Q3 5:32", period: 3, clock_display: "5:32", phase_key: "P3",
    home: { name: "Bayside Owls", abbr: "BAY", score: 87, period_scores: [30, 28, 29] },
    away: { name: "Northside Hawks", abbr: "NOR", score: 80, period_scores: [27, 25, 28] },
    box: {
      home: { abbr: "BAY", name: "Bayside Owls", players: [
        player("11", "Avery Longname-Hyphenated", 31, true, 22, 6, 4, 3, 1, 0),
        player("12", "Ben Carter", 28, true, 12, 9, 2, 0, 0, 2),
        player("13", "Cole Drummond", 26, true, 9, 3, 7, 1, 2, 0),
        player("14", "Dev Ellis", 24, true, 14, 4, 1, 2, 1, 1),
        player("15", "Eli Ford", 22, true, 6, 8, 1, 0, 0, 1),
        player("16", "Finn Grady", 15, false, 8, 2, 2, 2, 0, 0),
      ] },
      away: { abbr: "NOR", name: "Northside Hawks", players: [
        player("21", "Gus Hart", 30, true, 18, 3, 0, 1, 3, 1, true),
        player("22", "Hal Irwin", 29, true, 20, 3, 0, 1, 5, 1),
        player("23", "Ike Jones", 27, true, 11, 7, 3, 1, 0, 0),
        player("24", "Jay Kim", 25, true, 7, 5, 6, 1, 1, 0),
        player("25", "Kai Lund", 21, true, 9, 6, 1, 1, 0, 2),
      ] },
    },
  },
  tipsters: [{ user_id: "42", name: "Hoops Tipster", avatar: "", legs: [
    { id: "t1:0", tip_id: "t1", player: "Gus Hart", line_label: "25+", stat_label: "PTS", current: 18, line: 25, status: "pending", odds: 1.9, player_id: "21" },
    { id: "t1:1", tip_id: "t1", player: "Ike Jones", line_label: "Under 8.5", stat_label: "REB", current: 7, line: 8.5, status: "pending", odds: 1.8 },
    { id: "t1:2", tip_id: "t1", player: "Hal Irwin", line_label: "Under 15.5", stat_label: "PTS", current: 20, line: 15.5, status: "miss", odds: 1.8 },
  ] }],
  refresh_after: 30,
};

const SERVERS = {
  role: "mod", ops: false,
  servers: [{ guild_id: "1", display_name: "Test", enabled: 1, subscription_active: 1, unit_size: 20, won: 1, lost: 0, profit_units: 1, roi: 10, queued: 0, listed: true }],
  follower_servers: [{ guild_id: "9", display_name: "North", enabled: 1, listed: true }],
};

async function openBasketball(page, opts = {}) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await installApiMock(page);
  await page.route("**/api/servers**", (route) => fulfillJson(route, SERVERS));
  await page.route("**/api/follower**", (route) => {
    const url = route.request().url();
    if (url.includes("/api/follower/game")) return fulfillJson(route, BASKETBALL);
    return fulfillJson(route, { ok: true, preview: false, display_name: "North", feed: [], months: [], month: "", stats: {} });
  });
  await page.route("**/api/live-tips**", (route) => fulfillJson(route, { ok: true, games: [] }));
  // Clear once per tab: init scripts run again on reload, and the reload test needs the saved camera.
  if (!opts.keepStorage) await page.addInitScript(() => { try { if (!sessionStorage.getItem("bk_init")) { localStorage.removeItem("tipdash_gv_cam:arena"); localStorage.removeItem("tipdash_gv_anim"); sessionStorage.setItem("bk_init", "1"); } } catch (e) {} });
  await page.addInitScript(authInitScript());
  await page.goto(baseUrl + "#/s/9/game/" + encodeURIComponent(GAME_NAME), { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => /Gus Hart/.test((document.getElementById("flive") || {}).innerText || ""), null, { timeout: 45000 });
  return errors;
}

async function waitGround(page) {
  await page.waitForFunction(() => {
    const h = document.getElementById("flive-mcg");
    return h && (h.classList.contains("is-webgl") || h.dataset.mcgError);
  }, null, { timeout: 45000 });
}

for (const vp of [{ name: "390", width: 390, height: 844 }, { name: "desktop", width: 1280, height: 800 }]) {
  test.describe(`basketball game view at ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("score, clock, 18/25 PTS, box score, arena", async ({ page, context }) => {
      const popups = [];
      context.on("page", (p) => popups.push(p.url()));
      const requested = [];
      page.on("request", (r) => requested.push(r.url()));
      const errors = await openBasketball(page);
      const flive = page.locator("#flive");
      await expect(page.locator("#flive-score")).toContainText("87");
      await expect(page.locator("#flive-score")).toContainText("Q3 5:32");
      await expect(page.locator("#flive-score .fl-qs").first()).toHaveText("30 · 28 · 29");
      await expect(flive).toContainText("18/25 PTS");
      await expect(flive).toContainText("Gus Hart 25+ PTS");
      await expect(page.locator("#flive .fl-card.miss")).toHaveCount(1);

      const box = page.locator("#flive-box");
      await expect(box).toBeVisible();
      await expect(box.locator(".fl-bx-tabs button")).toHaveText(["BAY", "NOR"]);
      await expect(box.locator("thead th")).toHaveCount(9);
      await box.locator('[data-box-team="away"]').click();
      await expect(box.locator("tr.fl-bx-leg")).toHaveCount(1);
      await expect(box.locator("tr.fl-bx-leg")).toContainText("Gus Hart");
      await box.locator('[data-box-sort="pts"]').click();
      await expect(box.locator("tbody tr").first()).toContainText("Hal Irwin");

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      expect(overflow).toBe(false);
      const boxFits = await page.evaluate(() => {
        const b = document.getElementById("flive-box").getBoundingClientRect();
        return b.left >= -0.5 && b.right <= document.documentElement.clientWidth + 0.5;
      });
      expect(boxFits).toBe(true);

      await expect(page.locator("#flive-mcg")).toHaveAttribute("data-venue", "arena");
      await waitGround(page);
      expect(requested.some((u) => /\/assets\/venues\/arena\.js/.test(u))).toBe(true);
      expect(requested.some((u) => /afl-match\.js/.test(u))).toBe(false);
      await expect(page.locator("#flive-mcg")).not.toHaveClass(/is-live-play/);
      expect(popups).toEqual([]);
      expect(errors).toEqual([]);
    });
  });
}

test("arena change-view button cycles the court views; the choice sticks after a reload", async ({ page }) => {
  await openBasketball(page);
  await waitGround(page);
  await expect(page.locator("#flive-mcg")).toHaveClass(/is-webgl/);
  const btn = page.getByRole("button", { name: "Change view" });
  await expect(page.locator(".fl-cams button")).toHaveCount(1);
  for (const id of ["goals-north", "goals-south", "wing", "blimp"]) {
    await btn.click();
    await expect(page.locator("#flive-mcg")).toHaveAttribute("data-cam", id);
  }
  await expect(btn).toHaveAttribute("title", "Change view: Overhead");
  expect(await page.evaluate(() => localStorage.getItem("tipdash_gv_cam:arena"))).toBe("blimp");
  expect(await page.evaluate(() => localStorage.getItem("tipdash_gv_cam"))).toBeNull();
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => /Gus Hart/.test((document.getElementById("flive") || {}).innerText || ""), null, { timeout: 45000 });
  await page.waitForFunction(() => {
    const h = document.getElementById("flive-mcg");
    return h && h.dataset.venue === "arena" && h.dataset.cam === "blimp";
  }, null, { timeout: 45000 });
});

async function openDemo(page, anim) {
  const requested = [];
  page.on("request", (r) => requested.push(r.url()));
  await installApiMock(page);
  await page.route("**/api/me**", (route) => fulfillJson(route, { ok: true, ops: true }));
  await page.route("**/api/ops/ext.js**", (route) => route.fulfill({
    status: 404, contentType: "text/plain",
    headers: { "Access-Control-Allow-Origin": route.request().headers().origin || "*", "Access-Control-Allow-Credentials": "true" }, body: "",
  }));
  await page.route("**/api/live-tips**", (route) => fulfillJson(route, { ok: true, games: [] }));
  await page.addInitScript((v) => { try { if (v == null) localStorage.removeItem("tipdash_gv_anim"); else localStorage.setItem("tipdash_gv_anim", v); } catch (e) {} }, anim);
  await page.addInitScript(authInitScript());
  await page.goto(baseUrl + "#/demo/game", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => /MidfieldMick/.test((document.getElementById("flive") || {}).innerText || ""), null, { timeout: 45000 });
  await waitGround(page);
  return requested;
}

test("AFL stays on the MCG; player animations are off by default and toggle with no reload", async ({ page }) => {
  const requested = await openDemo(page, null);
  await expect(page.locator("#flive-mcg")).toHaveAttribute("data-venue", "mcg");
  await page.waitForTimeout(800);
  await expect(page.locator("#flive-mcg")).not.toHaveClass(/is-live-play/);
  expect(requested.some((u) => /afl-match\.js/.test(u))).toBe(false);
  expect(requested.some((u) => /\/assets\/venues\/arena\.js/.test(u))).toBe(false);
  expect(await page.locator("#dd-gv-anim-on").isChecked()).toBe(false);

  await page.evaluate(() => { const c = document.getElementById("dd-gv-anim-on"); c.checked = true; c.dispatchEvent(new Event("change")); });
  await expect(page.locator("#flive-mcg")).toHaveClass(/is-live-play/, { timeout: 15000 });
  expect(await page.evaluate(() => localStorage.getItem("tipdash_gv_anim"))).toBe("1");

  await page.evaluate(() => { const c = document.getElementById("dd-gv-anim-on"); c.checked = false; c.dispatchEvent(new Event("change")); });
  await expect(page.locator("#flive-mcg")).not.toHaveClass(/is-live-play/);
  expect(await page.evaluate(() => localStorage.getItem("tipdash_gv_anim"))).toBe("0");
});

test("a saved 'on' runs the overlay on a live AFL game", async ({ page }) => {
  await openDemo(page, "1");
  await expect(page.locator("#flive-mcg")).toHaveClass(/is-live-play/, { timeout: 15000 });
});
