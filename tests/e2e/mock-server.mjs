import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const MOCK = {
  "/api/servers": {
    role: "owner",
    servers: [{ guild_id: "1", display_name: "Test", enabled: 1, subscription_active: 1, unit_size: 20, won: 1, lost: 0, profit_units: 1, roi: 10, queued: 0 }],
    follower_servers: [],
  },
  "/api/server/settled-summary": {
    ok: true,
    tips: {
      settled: [
        {
          tip_id: "t1",
          result: "Win",
          units: 1,
          odds: 2,
          profit_units: 1,
          settled_at: "2026-10-08T04:00:00Z",
          sport: "AFL",
          bet_type: "H2H",
        },
      ],
    },
  },
  "/api/server": {
    settings: { guild_id: "1", display_name: "Test", enabled: 1, unit_size: 20 },
    stats: { won: 1, lost: 0, profit_units: 1, roi: 10, queued: 0 },
    tips: { settled: [], pending: [], queued: [] },
    months: [],
    month: "",
  },
  "/api/fixtures": { games: [], players: {} },
  "/api/upcoming": { ok: true, tips: [] },
  "/api/racing/next": {
    ok: true,
    races: [
      {
        id: "evt-t",
        race_number: 8,
        name: "Stakes",
        start_time: "2099-01-01T03:00:00Z",
        category: "T",
        meeting: { name: "Randwick", category: "T" },
      },
    ],
  },
  "/api/racing/meetings": {
    data: {
      meetings: [
        { id: "mtg-t", name: "Randwick", category: "T", races: [{ id: "evt-t", race_number: 8, name: "Stakes" }] },
      ],
    },
  },
  "/api/racing/meetings?category=T": {
    ok: true,
    category: "T",
    meetings: [{ id: "mtg-t", name: "Randwick", category: "T", races: [{ id: "evt-t", race_number: 8, name: "Stakes" }] }],
  },
  "/api/racing/meetings?category=H": { ok: true, category: "H", meetings: [] },
  "/api/racing/event/evt-t": {
    ok: true,
    event: {
      id: "evt-t",
      race_number: 8,
      name: "Stakes",
      start_time: "2099-01-01T03:00:00Z",
      distance: 1200,
      track_condition: "Good 4",
      status: "Open",
      category: "T",
      runners: [{ id: "r1", number: 1, name: "Runner", jockey_or_driver: "J", barrier: 1, fixed: { win: 2.4, place: 1.25 }, scratched: false }],
    },
  },
  "/api/logout": { ok: true },
};

export function startMockSite() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url || "/", "http://127.0.0.1");
      if (url.pathname.startsWith("/api/")) {
        const key = url.pathname + (url.search && url.search.startsWith("?guild_id=") ? "?" + url.search.slice(1).split("&")[0] : "");
        let body = MOCK[url.pathname] || MOCK[key];
        if (!body && url.pathname === "/api/server") body = MOCK["/api/server"];
        if (!body && url.pathname === "/api/servers") body = MOCK["/api/servers"];
        if (!body) body = { ok: true };
        res.writeHead(200, {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "authorization,content-type",
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        });
        res.end(JSON.stringify(body));
        return;
      }
      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "authorization,content-type",
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        });
        res.end();
        return;
      }
      let file = url.pathname === "/" ? "/index.html" : url.pathname;
      const fp = path.join(root, file.replace(/^\//, ""));
      try {
        const data = readFileSync(fp);
        const ext = path.extname(fp);
        const types = {
          ".html": "text/html",
          ".js": "text/javascript",
          ".css": "text/css",
          ".json": "application/json",
          ".svg": "image/svg+xml",
          ".woff2": "font/woff2",
          ".png": "image/png",
          ".ico": "image/x-icon",
          ".webmanifest": "application/manifest+json",
        };
        res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
        res.end(data);
      } catch {
        res.writeHead(404);
        res.end("not found");
      }
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

export function authInitScript() {
  return () => {
    localStorage.setItem("tipbot_token", "t." + btoa('{"exp":4102444800}') + ".x");
    localStorage.setItem("tipbot_auth_epoch", "2");
    localStorage.setItem("tipbot_theme", "apex");
  };
}

export function mockBodyForPath(pathname, search) {
  const guildQ = search && search.startsWith("?guild_id=") ? "?" + search.slice(1).split("&")[0] : "";
  const key = pathname + guildQ;
  let body = MOCK[pathname] || MOCK[key];
  if (!body && pathname === "/api/server") body = MOCK["/api/server"];
  if (!body && pathname === "/api/servers") body = MOCK["/api/servers"];
  if (!body && pathname.startsWith("/api/racing/")) body = { ok: true };
  if (!body) body = { ok: true };
  return body;
}

/** Intercept TipBot API calls so the dashboard never hits the network. */
export async function installApiMock(page) {
  await page.route("**/*", async (route) => {
    const url = route.request().url();
    if (!url.includes("afl-tipster-bot.onrender.com")) {
      await route.continue();
      return;
    }
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "authorization,content-type",
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        },
      });
      return;
    }
    const parsed = new URL(url);
    const body = mockBodyForPath(parsed.pathname, parsed.search);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(body),
    });
  });
}
