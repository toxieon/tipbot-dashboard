import { test, expect } from "@playwright/test";
import { startMockSite, authInitScript, installApiMock } from "./mock-server.mjs";

let baseUrl;
let server;
test.beforeAll(async () => {
  server = await startMockSite();
  baseUrl = `http://127.0.0.1:${server.address().port}/`;
});
test.afterAll(async () => { if (server) server.close(); });
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

async function boot(page) {
  await installApiMock(page);
  await page.addInitScript(authInitScript());
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(() => !!window.LogoFrame, { timeout: 45000 });
}

test("square corner is opaque; circle and oval corners are clear", async ({ page }) => {
  await boot(page);
  const alpha = await page.evaluate(() => {
    const src = document.createElement("canvas");
    src.width = 64; src.height = 64;
    const sg = src.getContext("2d"); sg.fillStyle = "#e33"; sg.fillRect(0, 0, 64, 64);
    const out = {};
    for (const shape of ["square", "circle", "oval"]) {
      const cv = document.createElement("canvas");
      cv.width = 300; cv.height = 100;
      const g = cv.getContext("2d");
      window.LogoFrame.paint(g, src, 300, 100, { shape });
      out[shape] = { corner: g.getImageData(1, 1, 1, 1).data[3], centre: g.getImageData(150, 50, 1, 1).data[3] };
    }
    return out;
  });
  expect(alpha.square.corner).toBe(255);
  expect(alpha.circle.corner).toBe(0);
  expect(alpha.oval.corner).toBe(0);
  expect(alpha.circle.centre).toBe(255);
  expect(alpha.oval.centre).toBe(255);
});

test("#/marketplace/hat-1 stays in the page", async ({ page }) => {
  await boot(page);
  await page.waitForFunction(() => { const a = document.getElementById("app"); return a && !a.hidden; }, { timeout: 45000 });
  await page.evaluate(() => { location.hash = "#/marketplace/hat-1"; });
  await page.waitForTimeout(500);
  const state = await page.evaluate(() => ({ hash: location.hash, href: location.href, shown: !document.getElementById("marketplace").hidden, text: document.getElementById("marketplace").textContent }));
  expect(state.href.startsWith(baseUrl)).toBe(true);
  if (state.shown) {
    expect(state.hash).toBe("#/marketplace/hat-1");
    expect(state.text).toContain("This listing isn't available yet.");
  }
});
