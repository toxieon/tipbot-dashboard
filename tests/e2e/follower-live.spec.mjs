import { test, expect } from "@playwright/test";
import { startMockSite, authInitScript, installApiMock } from "./mock-server.mjs";
import fs from "node:fs";
import path from "node:path";

const outDir = "/opt/cursor/artifacts/follower-live";

const LIVE_GAMES = {
  ok: true,
  games: [
    {
      match_id: "aflw1",
      game_name: "North Melbourne v Carlton",
      sport: "AFLW",
      venue: "Ikon Park",
      hscore: 28,
      ascore: 22,
      concluded: false,
      phase: { key: "Q2", label: "Q2 · 8:10" },
      tip_count: 4,
    },
    {
      match_id: "afl2",
      game_name: "Geelong v Collingwood",
      sport: "AFL",
      venue: "MCG",
      hscore: 45,
      ascore: 39,
      concluded: false,
      phase: { key: "Q3", label: "Q3 · 4:02" },
      tip_count: 2,
    },
    {
      match_id: "ft1",
      game_name: "Sydney v Brisbane",
      sport: "AFL",
      venue: "SCG",
      hscore: 88,
      ascore: 74,
      concluded: true,
      phase: { key: "FT", label: "Full time" },
      tip_count: 1,
    },
  ],
};

test.use({
  launchOptions: {
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
  },
});

let baseUrl;
let server;

test.beforeAll(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  server = await startMockSite();
  baseUrl = `http://127.0.0.1:${server.address().port}/`;
});

test.afterAll(async () => {
  if (server) server.close();
});

function fulfillJson(route, body) {
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: { "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(body),
  });
}

const OWN_SERVERS = {
  role: "mod",
  ops: false,
  servers: [{ guild_id: "1", display_name: "Test", enabled: 1, subscription_active: 1, unit_size: 20, won: 1, lost: 0, profit_units: 1, roi: 10, queued: 0, listed: true }],
  follower_servers: [{ guild_id: "9", display_name: "North", enabled: 1, listed: true }],
};

const OWN_FEED = {
  ok: true,
  preview: false,
  display_name: "North",
  stats: { won: 0, lost: 0, push: 0, profit_units: 0, roi: 0, strike_rate: 0, pending: 2, staked_units: 0 },
  feed: [
    { tip_id: "soon", game_name: "North Melbourne v Carlton", bet_type: "Z. Quill 25+ disposals", odds: 2.1, result: "Pending", starts_at: "2026-10-16T05:00:00Z", tipster_name: "Midfield Mick", tipster_id: "mick" },
    { tip_id: "later", game_name: "Geelong v Collingwood", bet_type: "H. Strand 20+ disposals", odds: 1.6, result: "Pending", starts_at: "2026-10-18T05:00:00Z", tipster_name: "Tag Team Tess", tipster_id: "tess" },
    { tip_id: "old", game_name: "Sydney v Brisbane", bet_type: "Settled leg", odds: 1.4, status: "Settled", result: "Win", tipster_name: "Midfield Mick" },
  ],
  months: [],
  month: "",
};

function ownGame(name) {
  const north = /North Melbourne/.test(name);
  const legs = north
    ? ["Z. Quill|25+ disposals|8|25", "R. Okonbo|2+ goals|1|2", "T. Varga|6+ tackles|2|6", "L. Pembry|1+ goal|0|1", "H. Strand|20+ disposals|11|20", "A. Brooks|15+ disposals|4|15", "C. Dale|3+ marks|1|3", "M. King|2+ goals|0|2"]
    : ["P. Danger|22+ disposals|6|22"];
  const tipsters = north
    ? [
        { name: "Midfield Mick", user_id: "mick", legs: legs.slice(0, 4) },
        { name: "Tag Team Tess", user_id: "tess", legs: legs.slice(4) },
      ]
    : [{ name: "Tag Team Tess", user_id: "tess", legs: legs }];
  return {
    ok: true,
    game: {
      game_name: name,
      live: false,
      concluded: false,
      phase_label: "Upcoming",
      venue: north ? "Ikon Park" : "MCG",
      home: { name: name.split(" v ")[0], score: null },
      away: { name: name.split(" v ")[1], score: null },
    },
    tipsters: tipsters.map((t) => ({
      user_id: t.user_id,
      name: t.name,
      avatar: "",
      legs: t.legs.map((row, i) => {
        const [player, line, current, target] = row.split("|");
        return { id: t.user_id + i, player, line_label: line, odds: 2.1, current: Number(current), line: Number(target), status: "pending" };
      }),
    })),
  };
}

async function boot(page, opts = {}) {
  const owner = opts.owner !== false;
  const hash = opts.hash || "#/demo/game";
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  await installApiMock(page);
  if (owner) {
    await page.route("**/api/me**", async (route) => {
      await fulfillJson(route, { ok: true, ops: true });
    });
    await page.route("**/api/ops/ext.js**", async (route) => {
      const origin = route.request().headers()["origin"] || "http://127.0.0.1";
      await route.fulfill({
        status: 404,
        contentType: "text/plain",
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Credentials": "true",
        },
        body: "",
      });
    });
  }
  if (opts.slips) {
    await page.route("**/api/servers**", async (route) => {
      await fulfillJson(route, OWN_SERVERS);
    });
    await page.route("**/api/follower**", async (route) => {
      const url = route.request().url();
      if (url.includes("/api/follower/game")) {
        const game = new URL(url).searchParams.get("game") || "";
        await fulfillJson(route, ownGame(game));
        return;
      }
      await fulfillJson(route, OWN_FEED);
    });
  }
  await page.route("**/api/live-tips**", async (route) => {
    await fulfillJson(route, LIVE_GAMES);
  });
  await page.addInitScript(authInitScript());
  await page.goto(baseUrl + hash, { waitUntil: "domcontentloaded", timeout: 60000 });
  if (owner && hash.includes("demo/game")) {
    await page.waitForFunction(() => {
      const live = document.getElementById("flive");
      return live && !live.hidden && /MidfieldMick/.test(live.innerText || "");
    }, { timeout: 45000 });
  }
  return errors;
}

async function assertPinned(page) {
  return page.evaluate(() => {
    const mcg = document.getElementById("flive-mcg");
    const sc = document.getElementById("flive-scroll");
    const before = mcg.getBoundingClientRect().top;
    sc.scrollTop = sc.scrollHeight;
    const after = mcg.getBoundingClientRect();
    const cards = sc.querySelectorAll(".fl-card");
    const last = cards.length ? cards[cards.length - 1] : sc.querySelector(".fl-empty, .empty");
    const tabs = document.querySelector(".apex-tabs");
    const lastBox = last ? last.getBoundingClientRect() : null;
    const tabsShown = tabs && getComputedStyle(tabs).display !== "none";
    const tabsBox = tabsShown ? tabs.getBoundingClientRect() : null;
    return {
      before,
      afterTop: after.top,
      afterBottom: after.bottom,
      scrolled: sc.scrollTop,
      overflow: sc.scrollHeight - sc.clientHeight,
      inside: sc.contains(mcg),
      lastBottom: lastBox && lastBox.bottom,
      tabsTop: tabsBox && tabsBox.top,
    };
  });
}

async function waitForGround(page) {
  await page.waitForFunction(() => {
    const host = document.getElementById("flive-mcg");
    if (!host) return false;
    if (host.classList.contains("is-webgl")) return true;
    return !!host.dataset.mcgError;
  }, { timeout: 20000 });
  await page.waitForTimeout(500);
}

test.describe("follower live demo", () => {
  test("iphone demo start, middle, end, and the live banner", async ({ page }) => {
    const errors = await boot(page);
    await waitForGround(page);
    const ground = await page.evaluate(() => {
      const host = document.getElementById("flive-mcg");
      return {
        webgl: !!(host && host.classList.contains("is-webgl")),
        canvas: !!(host && host.querySelector("canvas")),
      };
    });
    fs.writeFileSync(path.join(outDir, "ground-iphone.json"), JSON.stringify(ground, null, 2));
    await page.screenshot({ path: path.join(outDir, "iphone-demo-start.png") });
    await page.screenshot({ path: path.join(outDir, "iphone-pin-top.png") });
    const pinned = await assertPinned(page);
    expect(pinned.inside).toBe(false);
    expect(pinned.afterBottom).toBeGreaterThan(40);
    expect(Math.abs(pinned.afterTop - pinned.before)).toBeLessThan(2);
    if (pinned.tabsTop != null && pinned.lastBottom != null) {
      expect(pinned.lastBottom).toBeLessThanOrEqual(pinned.tabsTop + 2);
    }
    await page.screenshot({ path: path.join(outDir, "iphone-pin-scrolled.png") });
    await page.evaluate(() => {
      const sc = document.getElementById("flive-scroll");
      if (sc) sc.scrollTop = 0;
    });

    await page.evaluate(() => window.FollowerLivePage.seek(0.5));
    await expect(page.locator("#flive-sum")).toHaveText("6 legs · 3 live");
    await expect(page.locator("#flive")).toContainText("Q3 · 12:41");
    await expect(page.locator("#flive")).toContainText("18/25");
    await page.screenshot({ path: path.join(outDir, "iphone-demo-middle.png") });

    await page.evaluate(() => window.FollowerLivePage.seek(1));
    await expect(page.locator("#flive-sum")).toHaveText("6 legs · 0 live");
    await expect(page.locator("#flive")).toContainText("Final");
    await expect(page.locator("#flive-pill")).toBeHidden();
    await page.screenshot({ path: path.join(outDir, "iphone-demo-end.png") });

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow).toBe(false);

    await page.evaluate(() => {
      history.pushState(null, "", "#/s/1");
      window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
    });
    await page.waitForFunction(() => {
      const detail = document.getElementById("detail");
      const bar = document.getElementById("live-now");
      return detail && !detail.hidden && bar && !bar.hidden && bar.querySelectorAll(".live-now").length === 2;
    }, { timeout: 30000 });
    const banner = await page.locator("#live-now").innerText();
    expect(banner).toContain("LIVE NOW:");
    expect(banner).toContain("North Melbourne v Carlton, tap to follow your bets");
    expect(banner).toContain("Geelong v Collingwood, tap to follow your bets");
    expect(banner).not.toContain("Sydney v Brisbane");
    await page.screenshot({ path: path.join(outDir, "iphone-server-live.png") });
    await expect(page.locator("#gameviewbtn")).toBeVisible();
    await expect(page.locator("#livedemobtn")).toBeVisible();
    await page.locator("#gameviewbtn").scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(outDir, "iphone-owner-buttons.png") });
    await page.evaluate(() => window.scrollTo(0, 0));

    await page.locator("#live-now .live-now").first().click();
    await page.waitForFunction(() => {
      const live = document.getElementById("flive");
      return live && !live.hidden && decodeURIComponent(location.hash).includes("North Melbourne v Carlton");
    });
    expect(page.url()).not.toMatch(/^about:blank/);
    const pages = page.context().pages();
    expect(pages.length).toBe(1);

    const real = errors.filter((e) => !/favicon|net::ERR|Failed to load resource/i.test(e));
    expect(real).toEqual([]);
  });
});

test.describe("follower live demo desktop", () => {
  test("desktop demo start, middle, end, and the live banner", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await boot(page);
    await waitForGround(page);
    const ground = await page.evaluate(() => {
      const host = document.getElementById("flive-mcg");
      return { webgl: !!(host && host.classList.contains("is-webgl")) };
    });
    fs.writeFileSync(path.join(outDir, "ground-desktop.json"), JSON.stringify(ground, null, 2));
    await page.screenshot({ path: path.join(outDir, "desktop-demo-start.png") });
    await page.evaluate(() => window.FollowerLivePage.seek(0.5));
    await expect(page.locator("#flive-sum")).toHaveText("6 legs · 3 live");
    await page.screenshot({ path: path.join(outDir, "desktop-demo-middle.png") });
    await page.evaluate(() => window.FollowerLivePage.seek(1));
    await expect(page.locator("#flive-sum")).toHaveText("6 legs · 0 live");
    await page.screenshot({ path: path.join(outDir, "desktop-demo-end.png") });

    await page.evaluate(() => {
      history.pushState(null, "", "#/s/1");
      window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
    });
    await page.waitForFunction(() => {
      const bar = document.getElementById("live-now");
      return bar && !bar.hidden && bar.querySelectorAll(".live-now").length === 2;
    }, { timeout: 30000 });
    await page.screenshot({ path: path.join(outDir, "desktop-server-live.png") });
    await expect(page.locator("#gameviewbtn")).toBeVisible();
    await expect(page.locator("#livedemobtn")).toBeVisible();
    await page.screenshot({ path: path.join(outDir, "desktop-owner-buttons.png") });
  });
});

test.describe("game view for a follower", () => {
  test("no demo button, real slips, and the ground stays pinned", async ({ page }) => {
    await boot(page, { owner: false, hash: "#/s/1", slips: true });
    await page.waitForFunction(() => {
      const detail = document.getElementById("detail");
      const demo = document.getElementById("livedemobtn");
      const view = document.getElementById("gameviewbtn");
      return detail && !detail.hidden && view && demo && demo.hidden;
    }, { timeout: 30000 });
    await expect(page.locator("#livedemobtn")).toBeHidden();
    await expect(page.locator("#gameviewbtn")).toBeVisible();
    await page.locator("#gameviewbtn").scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(outDir, "iphone-follower-buttons.png") });

    await page.locator("#gameviewbtn").click();
    await page.waitForFunction(() => {
      const live = document.getElementById("flive");
      const text = live && live.innerText || "";
      return live && !live.hidden && /Z\. Quill/.test(text) && /Midfield Mick/.test(text) && /Tag Team Tess/.test(text);
    }, { timeout: 30000 });
    await expect(page.locator("#flive-play")).toHaveCount(0);
    await expect(page.locator("#flive")).not.toContainText("Example data");
    await expect(page.locator("#flive")).not.toContainText("Sydney v Brisbane");
    await expect(page.locator("#flive-switch button")).toHaveCount(2);
    await expect(page.locator("#flive")).toContainText("North Melbourne");
    await waitForGround(page);
    await page.screenshot({ path: path.join(outDir, "iphone-game-top.png") });
    const pinned = await assertPinned(page);
    expect(pinned.inside).toBe(false);
    expect(pinned.overflow).toBeGreaterThan(20);
    expect(pinned.afterBottom).toBeGreaterThan(40);
    expect(Math.abs(pinned.afterTop - pinned.before)).toBeLessThan(2);
    if (pinned.tabsTop != null && pinned.lastBottom != null) {
      expect(pinned.lastBottom).toBeLessThanOrEqual(pinned.tabsTop + 2);
    }
    await page.screenshot({ path: path.join(outDir, "iphone-game-scrolled.png") });

    await page.locator("#flive-switch button").nth(1).click();
    await page.waitForFunction(() => /Geelong/.test(document.getElementById("flive").innerText || ""));
    await expect(page.locator("#flive")).toContainText("P. Danger");
    await expect(page.locator("#flive-play")).toHaveCount(0);
    const pages = page.context().pages();
    expect(pages.length).toBe(1);

    await page.evaluate(() => {
      history.pushState(null, "", "#/demo/game");
      window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
    });
    await page.waitForFunction(() => {
      const detail = document.getElementById("detail");
      const live = document.getElementById("flive");
      return detail && !detail.hidden && live && live.hidden && !/MidfieldMick/.test(document.body.innerText || "");
    }, { timeout: 30000 });
    await expect(page.locator("#livedemobtn")).toBeHidden();
    await expect(page.locator("#gameviewbtn")).toBeVisible();
    await page.screenshot({ path: path.join(outDir, "iphone-demo-blocked.png") });
  });
});

test.describe("owner game view", () => {
  test("both buttons, and an empty ground when there are no slips", async ({ page }) => {
    await boot(page, { owner: true, hash: "#/s/1" });
    await page.waitForFunction(() => {
      const detail = document.getElementById("detail");
      const demo = document.getElementById("livedemobtn");
      const view = document.getElementById("gameviewbtn");
      return detail && !detail.hidden && view && demo && !demo.hidden;
    }, { timeout: 30000 });
    await page.locator("#gameviewbtn").click();
    await page.waitForFunction(() => {
      const live = document.getElementById("flive");
      return live && !live.hidden && /Nothing coming up/.test(live.innerText || "");
    }, { timeout: 30000 });
    await expect(page.locator("#flive-play")).toHaveCount(0);
    await expect(page.locator("#flive")).toContainText("No game on");
    await expect(page.locator("#flive-switch")).toBeHidden();
    await waitForGround(page);
    const pinned = await assertPinned(page);
    expect(pinned.inside).toBe(false);
    expect(pinned.afterBottom).toBeGreaterThan(40);
    await page.screenshot({ path: path.join(outDir, "iphone-owner-game-empty.png") });
    expect(page.context().pages().length).toBe(1);
  });
});
