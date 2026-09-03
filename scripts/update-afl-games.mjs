// API HANDOFF NOTES
// No bot token, Discord token, or paid API key is required for this updater.
// It fetches AFL's public fixture API from GitHub Actions/Node and writes
// ../afl-games.json, which the static dashboard can read without waking Render.
// Selected teams, live player stats, and scheduling still use the bot backend.

import { writeFile } from "node:fs/promises";

const AFL_BASE = "https://aflapi.afl.com.au/afl/v2";
const AFL_COMP_ID = 1;
const HORIZON_DAYS = Number(process.env.AFL_GAMES_HORIZON_DAYS || 30);
const OUT_FILE = new URL("../afl-games.json", import.meta.url);
const FINISHED_STATUSES = new Set(["CONCLUDED", "POSTGAME", "POST_GAME", "FULL_TIME", "FULLTIME", "FINAL"]);
const LIVE_STATUSES = new Set(["LIVE", "IN_PROGRESS", "INPROGRESS"]);

function listFrom(data, keys) {
  if (Array.isArray(data)) return data;
  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key];
  }
  return [];
}

async function httpJson(url) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "TipBot Dashboard fixture updater (https://www.neilldata.com/tipbot-dashboard/)",
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${url}`);
  }
  return response.json();
}

function compSeasonForYear(seasons, year) {
  return (
    seasons.find((season) => String(season.year || "") === String(year)) ||
    seasons.find((season) => String(season.name || "").includes(String(year))) ||
    null
  );
}

function parseMatchStart(match) {
  const raw = match.utcStartTime || match.venueLocalStartTime || match.date || match.startTime;
  if (!raw) return null;
  const normal = String(raw).replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  const ms = Date.parse(normal);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

function dashboardTeamName(name) {
  return (
    {
      "Adelaide Crows": "Adelaide",
      "Geelong Cats": "Geelong",
      "Gold Coast SUNS": "Gold Coast",
      "GWS GIANTS": "Greater Western Sydney",
      "Sydney Swans": "Sydney",
      "West Coast Eagles": "West Coast",
    }[name] || name
  );
}

function sideObj(match, side) {
  const team = match[side]?.team || match[`${side}Team`]?.team || match[`${side}Team`] || {};
  const aflName = team.name || team.teamName || team.fullName || "";
  return {
    name: dashboardTeamName(aflName),
    abbrev: team.abbreviation || team.abbrev || team.shortName || "",
    players: [],
    aflTeamId: team.id || team.teamId || null,
    aflName,
    playerListType: "none",
    selectionStatus: "",
    ins: [],
    outs: [],
  };
}

function isPlaceholderSide(side) {
  const text = `${side.name || ""} ${side.abbrev || ""} ${side.aflName || ""}`.toLowerCase();
  return !text.trim() || text.includes("tbd") || text.includes("winner of") || text.includes("loser of");
}

function roundName(match) {
  return match.round?.name || match.round?.abbreviation || "";
}

function roundNumber(match) {
  return match.round?.roundNumber ?? null;
}

function scoreValue(match, side, key) {
  return match[side]?.score?.[key] ?? null;
}

function completeValue(status) {
  if (FINISHED_STATUSES.has(status)) return 100;
  if (LIVE_STATUSES.has(status)) return 50;
  return 0;
}

async function fixtureGames() {
  const seasonPayload = await httpJson(`${AFL_BASE}/competitions/${AFL_COMP_ID}/compseasons?pageSize=100`);
  const seasons = listFrom(seasonPayload, ["compSeasons", "compseasons", "seasons"]);
  const now = Date.now();
  const horizon = now + HORIZON_DAYS * 86400e3;
  const years = [...new Set([new Date(now).getFullYear(), new Date(horizon).getFullYear()])];
  const games = [];
  const seen = new Set();

  for (const year of years) {
    const season = compSeasonForYear(seasons, year);
    if (!season?.id) continue;
    const matchPayload = await httpJson(`${AFL_BASE}/matches?compSeasonId=${encodeURIComponent(season.id)}&pageSize=1000`);
    for (const match of listFrom(matchPayload, ["matches", "matchList"])) {
      const status = String(match.status || "").toUpperCase();
      if (status === "PLACEHOLDER" || FINISHED_STATUSES.has(status)) continue;
      const start = parseMatchStart(match);
      if (start == null) continue;
      const startMs = start * 1000;
      const live = LIVE_STATUSES.has(status);
      if (!live && (startMs < now - 4 * 3600e3 || startMs > horizon)) continue;

      const home = sideObj(match, "home");
      const away = sideObj(match, "away");
      if (isPlaceholderSide(home) || isPlaceholderSide(away)) continue;

      const id = String(match.providerId || match.id || `${home.name}-${away.name}-${start}`);
      if (seen.has(id)) continue;
      seen.add(id);

      games.push({
        id: match.id || id,
        date: new Date(startMs).toISOString().slice(0, 19).replace("T", " "),
        unixtime: start,
        live,
        complete: completeValue(status),
        aflMatchId: match.providerId || null,
        aflStatus: status,
        venue: match.venue?.name || match.venue?.abbreviation || "",
        round: roundNumber(match),
        roundname: roundName(match),
        game_name: `${home.name} v ${away.name}`,
        hteam: home,
        ateam: away,
        hscore: scoreValue(match, "home", "totalScore"),
        ascore: scoreValue(match, "away", "totalScore"),
        hgoals: scoreValue(match, "home", "goals"),
        hbehinds: scoreValue(match, "home", "behinds"),
        agoals: scoreValue(match, "away", "goals"),
        abehinds: scoreValue(match, "away", "behinds"),
        year,
      });
    }
  }

  games.sort((a, b) => (a.unixtime || 0) - (b.unixtime || 0));
  return games;
}

const games = await fixtureGames();
const output = {
  generatedAt: new Date().toISOString(),
  games,
  players: {
    enabled: false,
    playerCount: 0,
    matchedTeams: 0,
    selectedPlayerCount: 0,
    selectedTeamCount: 0,
    selectedGameCount: 0,
    selectionErrors: 0,
    fixtureSource: "afl-dashboard",
    warning: "Fixture-only mode from afl-games.json; bot adds selected players, live stats, and scheduling.",
    error: null,
  },
  source: {
    games: AFL_BASE,
    updater: "scripts/update-afl-games.mjs",
  },
};

await writeFile(OUT_FILE, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(`Wrote ${games.length} AFL games to ${OUT_FILE.pathname}`);
