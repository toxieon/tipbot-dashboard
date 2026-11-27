// 0.73.4: Units calendar on phones — day units fully readable, month nav on one
// row. Desktop (1280) layout stays as it was. Mocked API only; no live session.
// Screenshots go to E2E_SHOTS_DIR (default: the OS temp dir), never into the repo.
import { test, expect } from "@playwright/test";
import { startMockSite, authInitScript, installApiMock } from "./mock-server.mjs";
import os from "node:os";
import path from "node:path";
import { mkdirSync } from "node:fs";

const SHOTS = process.env.E2E_SHOTS_DIR || path.join(os.tmpdir(), "tipdash-e2e");
mkdirSync(SHOTS, { recursive: true });

const daily = {
  "2026-11-01": { net: 1.2, n: 2, won: 2, lost: 0, push: 0 },
  "2026-11-02": { net: -0.8, n: 1, won: 0, lost: 1, push: 0 },
  "2026-11-03": { net: 2.4, n: 2, won: 2, lost: 0, push: 0 },
  "2026-11-04": { net: 0.5, n: 1, won: 1, lost: 0, push: 0 },
  "2026-11-05": { net: -1.5, n: 2, won: 0, lost: 2, push: 0 },
  "2026-11-07": { net: 3.0, n: 3, won: 3, lost: 0, push: 0 },
  "2026-11-08": { net: -2.0, n: 2, won: 0, lost: 2, push: 0 },
  "2026-11-10": { net: 4.8, n: 2, won: 2, lost: 0, push: 0 },
  "2026-11-11": { net: -0.5, n: 1, won: 0, lost: 1, push: 0 },
  "2026-11-14": { net: 1.0, n: 1, won: 1, lost: 0, push: 0 },
  "2026-11-15": { net: 2.2, n: 2, won: 2, lost: 0, push: 0 },
  "2026-11-18": { net: -3.1, n: 2, won: 0, lost: 2, push: 0 },
  "2026-11-21": { net: 5.5, n: 3, won: 3, lost: 0, push: 0 },
  "2026-11-22": { net: -1.2, n: 1, won: 0, lost: 1, push: 0 },
  "2026-11-25": { net: 2.0, n: 1, won: 1, lost: 0, push: 0 },
  "2026-11-26": { net: 0.8, n: 1, won: 1, lost: 0, push: 0 },
  "2026-11-27": { net: -1.0, n: 1, won: 0, lost: 1, push: 0 },
  "2026-11-28": { net: 7.9, n: 3, won: 3, lost: 0, push: 0 },
};

const SERVER = {
  settings: { guild_id: "1", display_name: "Test", enabled: 1, unit_size: 20, can_admin: true },
  stats: { won: 24, lost: 16, push: 0, settled: 40, profit_units: 21.2, roi: 18, strike_rate: 60, queued: 0, staked_units: 40, followers: 3 },
  tips: { settled: [], pending: [], queued: [] },
  months: ["2026-11"],
  month: "2026-11",
  cal_month: "2026-11",
  daily_series: daily,
};

const SERVERS = {
  role: "mod",
  servers: [{ guild_id: "1", display_name: "Test", enabled: 1, subscription_active: 1, unit_size: 20, won: 24, lost: 16, profit_units: 21.2, roi: 18, queued: 0 }],
  follower_servers: [],
};

function json(body) {
  return { status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(body) };
}

let baseUrl, server;
test.beforeAll(async () => {
  server = await startMockSite();
  baseUrl = `http://127.0.0.1:${server.address().port}/`;
});
test.afterAll(async () => { if (server) server.close(); });

async function openCalendar(page, context) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await installApiMock(page);
  await page.route(/\/api\/server(\?|$)/, (r) => r.fulfill(json(SERVER)));
  await page.route(/\/api\/servers(\?|$)/, (r) => r.fulfill(json(SERVERS)));
  await page.addInitScript(authInitScript());
  await page.addInitScript(() => {
    localStorage.setItem("tipdash_sec_calendar", "1@" + Date.now());
  });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => {
    const a = document.getElementById("app");
    return a && !a.hidden;
  });
  await page.evaluate(() => loadDetail("1"));
  const panel = page.locator('.panel[data-sec="calendar"]');
  await expect(panel).toBeVisible();
  if (await panel.evaluate((el) => el.classList.contains("is-collapsed"))) {
    await panel.locator(":scope > .panel-hd").click();
  }
  await expect(panel.locator(".calgrid")).toBeVisible();
  await panel.scrollIntoViewIfNeeded();
  return { errors, panel };
}

async function measure(page) {
  return page.evaluate(() => {
    const panel = document.querySelector('.panel[data-sec="calendar"]');
    const nav = panel && panel.querySelector(".cal-nav-row");
    const btns = nav ? [...nav.querySelectorAll(".calnav")].map((b) => b.getBoundingClientRect().toJSON()) : [];
    const month = nav && nav.querySelector(".cal-month-label, span");
    const monthR = month && month.getBoundingClientRect();
    const title = panel && panel.querySelector(".panel-hd-main");
    const titleR = title && title.getBoundingClientRect();
    const hd = panel && panel.querySelector(".panel-hd");
    const cells = [...(panel ? panel.querySelectorAll(".cal-day") : [])].map((el) => {
      const r = el.getBoundingClientRect();
      const pl = el.querySelector(".cal-pl");
      const pr = pl && pl.getBoundingClientRect();
      const visibleH = pr
        ? Math.max(0, Math.min(pr.bottom, r.bottom) - Math.max(pr.top, r.top))
        : 0;
      const visibleW = pr
        ? Math.max(0, Math.min(pr.right, r.right) - Math.max(pr.left, r.left))
        : 0;
      return {
        text: pl ? pl.textContent : "",
        cellW: r.width,
        cellH: r.height,
        overflow: el.scrollHeight - el.clientHeight,
        plH: pr ? pr.height : 0,
        plW: pr ? pr.width : 0,
        visibleH,
        visibleW,
        clipped: !pr || visibleH < pr.height - 0.6 || visibleW < pr.width - 0.6,
      };
    });
    const other = {
      hasPeriod: !!document.querySelector(".sv-period"),
      hasRecent: !!document.querySelector("#recent-panel"),
      hasSettings: !!document.querySelector("#settings-panel"),
    };
    return {
      headerH: hd ? hd.getBoundingClientRect().height : 0,
      titleAndNavSameRow: !!(titleR && monthR && Math.abs(titleR.y - monthR.y) < 8),
      navSameRow: btns.length === 2 && Math.abs(btns[0].y - btns[1].y) < 3,
      navBetween: !!(monthR && btns.length === 2 && btns[0].right <= monthR.x + 1 && monthR.right <= btns[1].x + 1),
      navH: btns.map((b) => b.height),
      monthText: month && month.textContent,
      cells,
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      other,
    };
  });
}

async function shot(page, panel, tag) {
  await panel.screenshot({ path: path.join(SHOTS, `units-cal-mobile-${tag}.png`) });
  await page.screenshot({ path: path.join(SHOTS, `units-cal-mobile-home-${tag}.png`), fullPage: true });
}

test.describe("Units calendar mobile layout (Apex)", () => {
  for (const vp of [
    { name: "390", width: 390, height: 844 },
    { name: "375", width: 375, height: 667 },
  ]) {
    test(`phone ${vp.width}x${vp.height}: units fully readable, month nav on one row`, async ({ page, context }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const { errors, panel } = await openCalendar(page, context);
      expect(errors).toEqual([]);
      const m = await measure(page);
      expect(m.monthText).toBe("November 2026");
      expect(m.navSameRow).toBe(true);
      expect(m.navBetween).toBe(true);
      expect(m.headerH).toBeLessThan(130);
      expect(m.cells.length).toBe(18);
      for (const c of m.cells) {
        expect(c.cellH, c.text).toBeGreaterThanOrEqual(56);
        expect(c.overflow, c.text).toBeLessThanOrEqual(0);
        expect(c.clipped, `${c.text} clipped`).toBe(false);
        expect(c.visibleH, c.text).toBeGreaterThanOrEqual(10);
        expect(c.visibleW, c.text).toBeGreaterThanOrEqual(12);
        expect(c.text).toMatch(/^[+-]\d+\.\d$/);
      }
      expect(m.overflowX).toBeLessThanOrEqual(1);
      expect(m.other.hasPeriod).toBe(true);
      expect(m.other.hasRecent).toBe(true);
      expect(m.other.hasSettings).toBe(true);
      await shot(page, panel, vp.name);
    });
  }

  test("desktop 1280: square cells and a single-row header stay as they were", async ({ page, context }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const { errors, panel } = await openCalendar(page, context);
    expect(errors).toEqual([]);
    const m = await measure(page);
    expect(m.monthText).toBe("November 2026");
    expect(m.navSameRow).toBe(true);
    expect(m.titleAndNavSameRow).toBe(true);
    expect(m.headerH).toBeLessThan(90);
    expect(m.cells.length).toBe(18);
    for (const c of m.cells) {
      expect(Math.abs(c.cellW - c.cellH), c.text).toBeLessThan(3);
      expect(c.cellH, c.text).toBeGreaterThan(80);
      expect(c.overflow, c.text).toBeLessThanOrEqual(0);
      expect(c.clipped, c.text).toBe(false);
    }
    expect(m.overflowX).toBeLessThanOrEqual(1);
    expect(m.other.hasPeriod).toBe(true);
    expect(m.other.hasRecent).toBe(true);
    await shot(page, panel, "1280");
  });
});
