import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const MOCK = {
  "/api/servers": {
    role: "mod",
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
        const body = mockBodyForPath(url.pathname, url.search);
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

function sydneyToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function shiftDay(day, delta) {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return dt.toISOString().slice(0, 10);
}

/** Last two Sydney race days, newest major meeting first once the page sorts them. */
export function horseResultsFixture() {
  const today = sydneyToday();
  const yesterday = shiftDay(today, -1);
  return {
    meetings: [
      {
        track: "Wagga",
        state: "NSW",
        date: today,
        races: [
          {
            number: 4,
            name: "Country Plate",
            distance: 1400,
            start_time: today + "T07:10:00Z",
            condition: "Soft 5",
            runners: [
              { position: 1, horse_name: "Night Mail", number: 3, barrier: 1, jockey: "A Joyce", trainer: "P Dunn", opening_win_price: 4.2, margin: 0, colours: "#2E6B4F, #F4E04D" },
              { position: 2, horse_name: "River Bend", number: 1, barrier: 4, jockey: "B Cole", trainer: "S Hart", opening_win_price: 6, margin: 1.5, colours: "#1B3A6B, #FFFFFF" },
            ],
          },
        ],
      },
      {
        track: "Flemington",
        state: "VIC",
        date: today,
        races: [
          {
            number: 7,
            name: "Mackinnon Stakes",
            distance: 2000,
            start_time: today + "T05:05:00Z",
            condition: "Good 4",
            runners: [
              { position: 2, horse_name: "Silver Lane", number: 4, barrier: 2, jockey: "J McNeil", trainer: "C Maher", opening_win_price: 6.5, margin: 0.4, colours: "#C0C6CE, #1A1A1A" },
              { position: 1, horse_name: "Gold Run", number: 1, barrier: 5, jockey: "D Lane", trainer: "T Busuttin", opening_win_price: 2.4, margin: 0, colours: "#0B1F4A, #E0B84A" },
              { position: 4, horse_name: "Plain Jane", number: 8, barrier: 9, jockey: "B Melham", trainer: "G Waterhouse", opening_win_price: 15, margin: 3.2, colours: "#F5F7FA, #111318" },
              { scratched: true, horse_name: "Early Bath", number: 6, barrier: 3, jockey: "H Coffey", trainer: "A Neasham", opening_win_price: 9, colours: "#888888, #DDDDDD" },
              { position: 3, horse_name: "Bronze Bill", number: 2, barrier: 7, jockey: "M Zahra", trainer: "P Moody", opening_win_price: 8, margin: 1.2, colours: "#8C4A2F, #F3D5B5" },
            ],
          },
        ],
      },
      {
        track: "Randwick",
        state: "NSW",
        date: yesterday,
        races: [
          {
            number: 8,
            name: "The Kosciuszko",
            distance: 1200,
            start_time: yesterday + "T04:40:00Z",
            condition: "Good 4",
            runners: [
              { position: 1, horse_name: "Harbour Light", number: 5, barrier: 6, jockey: "J Collett", trainer: "J O'Shea", opening_win_price: 3.1, margin: 0, colours: "#12355B, #FFFFFF" },
            ],
          },
        ],
      },
    ],
  };
}

export function mockBodyForPath(pathname, search) {
  if (pathname === "/api/racing/results") return horseResultsFixture();
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
