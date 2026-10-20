// Job 11: Settings → Channels → Sport routing shows "+ #channel" suggestion chips under each
// tag (from the `suggestions` list TipBot adds to GET /api/routing). A tap only ticks the
// channel; Save sends the same request shape as before. Screenshots go to E2E_SHOTS_DIR.
import { test, expect } from "@playwright/test";
import { startMockSite, authInitScript, installApiMock } from "./mock-server.mjs";
import os from "node:os";
import path from "node:path";
import { mkdirSync } from "node:fs";

const SHOTS = process.env.E2E_SHOTS_DIR || path.join(os.tmpdir(), "tipdash-e2e");
mkdirSync(SHOTS, { recursive: true });

function routingPayload(withSuggestions) {
  const body = {
    ok: true, enabled: true, can_admin: true, default_channel_id: "99", multi_sport_mode: "ask", memory: [],
    channels: [{ id: "99", name: "tips" }, { id: "11", name: "afl-tips" }, { id: "12", name: "nrl-multis" }, { id: "13", name: "🏇racing" }, { id: "14", name: "general" }],
    tags: [
      { tag: "AFL", label: "AFL", enabled: true, channel_ids: [], keywords: "", default_keywords: "afl, footy", priority: 10, mode: "ask" },
      { tag: "NRL", label: "NRL", enabled: true, channel_ids: [], keywords: "", default_keywords: "nrl", priority: 10, mode: "ask" },
      { tag: "RACING", label: "Racing", enabled: true, channel_ids: [], keywords: "", default_keywords: "racing", priority: 10, mode: "ask" },
      { tag: "NBA", label: "NBA", enabled: true, channel_ids: [], keywords: "", default_keywords: "nba", priority: 10, mode: "ask" },
    ],
  };
  if (withSuggestions) body.suggestions = [
    { tag: "AFL", channel_id: "11", channel_name: "afl-tips", score: 0.95, reason: "channel name contains 'afl'" },
    { tag: "NRL", channel_id: "12", channel_name: "nrl-multis", score: 0.9, reason: "channel name contains 'nrl'" },
    { tag: "RACING", channel_id: "13", channel_name: "🏇racing", score: 0.9, reason: "channel name contains 'racing'" },
  ];
  return body;
}

let baseUrl, server;
test.beforeAll(async () => { server = await startMockSite(); baseUrl = `http://127.0.0.1:${server.address().port}/`; });
test.afterAll(async () => { if (server) server.close(); });

async function openChannels(page, context, withSuggestions) {
  const errors = [], posts = [], popups = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  context.on("page", (p) => popups.push(p.url()));
  await installApiMock(page);
  await page.route(/\/api\/routing(\?|$)/, async (route) => {
    const req = route.request();
    if (req.method() === "POST") posts.push(JSON.parse(req.postData() || "{}"));
    await route.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(routingPayload(withSuggestions)) });
  });
  await page.addInitScript(authInitScript());
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => { const a = document.getElementById("app"); return a && !a.hidden; });
  await page.evaluate(() => loadDetail("1"));
  await page.locator("#settings-panel .panel-hd").click();   // Settings starts collapsed
  await page.locator("#stab-channels").click();
  await expect(page.locator("#sport-routing-box")).toContainText("Sport routing (beta)");
  return { errors, posts, popups };
}

test.describe("sport routing suggestions at 390x844", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("chips appear per tag; a tap ticks the channel; Save sends the usual shape", async ({ page, context }) => {
    const { errors, posts, popups } = await openChannels(page, context, true);
    await expect(page.locator(".sr-sugg-chip")).toHaveCount(3);
    await expect(page.locator('tr.sr-sugg[data-sugg-tag="NBA"]')).toHaveCount(0);
    const h = await page.locator(".sr-sugg-chip").first().evaluate((el) => el.getBoundingClientRect().height);
    expect(h).toBeGreaterThanOrEqual(44);
    await expect(page.locator("#sr-sugg-all")).toHaveText("Apply all suggestions (3)");
    await page.locator("#sport-routing-box").scrollIntoViewIfNeeded();
    const box = await page.locator("#sport-routing-box").boundingBox();
    const top = await page.evaluate(() => window.scrollY);
    await page.screenshot({ path: path.join(SHOTS, "routing-suggest.png"), fullPage: true, clip: { x: 0, y: box.y + top, width: 390, height: Math.min(box.height, 900) } });

    await page.locator('.sr-sugg-chip[data-tag="AFL"]').click();
    await expect(page.locator('tr[data-tag="AFL"] .sr-ch[value="11"]')).toBeChecked();
    await expect(page.locator('tr[data-tag="AFL"] summary')).toHaveText("#afl-tips");
    await expect(page.locator(".sr-sugg-chip")).toHaveCount(2);
    expect(posts).toEqual([]);   // nothing saved yet

    await page.locator("#sr-save").click();
    await expect.poll(() => posts.length).toBe(1);
    const body = posts[0];
    expect(Object.keys(body)).toEqual(["guild_id", "tags", "multi_sport_mode", "delete_tags", "forget"]);
    expect(Object.keys(body.tags[0])).toEqual(["tag", "label", "enabled", "channel_ids", "keywords", "priority", "mode"]);
    expect(body.tags.find((t) => t.tag === "AFL").channel_ids).toEqual(["11"]);
    expect(body.tags.find((t) => t.tag === "NRL").channel_ids).toEqual([]);
    expect(popups).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("Apply all ticks every suggestion; no suggestions means no chips", async ({ page, context }) => {
    const { errors, posts } = await openChannels(page, context, true);
    await page.locator("#sr-sugg-all").click();
    await expect(page.locator(".sr-sugg-chip")).toHaveCount(0);
    await expect(page.locator("#sr-sugg-all")).toHaveCount(0);
    await page.locator("#sr-save").click();
    await expect.poll(() => posts.length).toBe(1);
    const ch = Object.fromEntries(posts[0].tags.map((t) => [t.tag, t.channel_ids]));
    expect(ch).toEqual({ AFL: ["11"], NRL: ["12"], RACING: ["13"], NBA: [] });
    expect(errors).toEqual([]);
  });

  test("an older TipBot payload (no suggestions) shows no chips and saves as before", async ({ page, context }) => {
    const { errors, posts } = await openChannels(page, context, false);
    await expect(page.locator(".sr-sugg-chip")).toHaveCount(0);
    await expect(page.locator("#sr-sugg-all")).toHaveCount(0);
    await page.locator("#sr-save").click();
    await expect.poll(() => posts.length).toBe(1);
    expect(Object.keys(posts[0])).toEqual(["guild_id", "tags", "multi_sport_mode", "delete_tags", "forget"]);
    expect(errors).toEqual([]);
  });
});
