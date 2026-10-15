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

async function boot(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  await installApiMock(page);
  await page.route("**/api/live-tips**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(LIVE_GAMES),
    });
  });
  await page.addInitScript(authInitScript());
  await page.goto(baseUrl + "#/demo/game", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(() => {
    const live = document.getElementById("flive");
    return live && !live.hidden && /MidfieldMick/.test(live.innerText || "");
  }, { timeout: 45000 });
  return errors;
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
  });
});
