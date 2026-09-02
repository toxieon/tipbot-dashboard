from __future__ import annotations

import json
import re
from datetime import datetime, timedelta
from typing import Any

SQUIGGLE_URL = "https://api.squiggle.com.au/"
USER_AGENT = "AFL-Tipster-Discord-Bot (data-source: Squiggle API)"

# Aliases people commonly type; the first entry is the Squiggle team name.
TEAM_ALIASES: dict[str, tuple[str, ...]] = {
    "adelaide": ("adelaide", "adelaide crows", "crows"),
    "brisbane lions": ("brisbane lions", "brisbane", "lions"),
    "carlton": ("carlton", "blues"),
    "collingwood": ("collingwood", "magpies", "pies"),
    "essendon": ("essendon", "bombers"),
    "fremantle": ("fremantle", "dockers", "freo"),
    "geelong": ("geelong", "geelong cats", "cats"),
    "gold coast": ("gold coast", "gold coast suns", "suns"),
    "greater western sydney": ("greater western sydney", "gws giants", "gws", "giants"),
    "hawthorn": ("hawthorn", "hawks"),
    "melbourne": ("melbourne", "demons", "dees"),
    "north melbourne": ("north melbourne", "kangaroos", "roos", "north"),
    "port adelaide": ("port adelaide", "port", "power"),
    "richmond": ("richmond", "tigers"),
    "st kilda": ("st kilda", "saints"),
    "sydney": ("sydney", "sydney swans", "swans"),
    "west coast": ("west coast", "west coast eagles", "eagles"),
    "western bulldogs": ("western bulldogs", "bulldogs", "dogs", "footscray"),
}

# Player-prop words that make a leg ungradeable from a final score alone.
PLAYER_MARKET_WORDS = (
    "disposal",
    "goal",
    "mark",
    "tackle",
    "fantasy",
    "kick",
    "handball",
    "possession",
    "hitout",
    "clearance",
    "behind",
)

LINE_RE = re.compile(r"(?<![\d.])([+-]\d+(?:\.\d+)?)")
TOTAL_RE = re.compile(r"\b(over|under)\b\s*([+-]?\d+(?:\.\d+)?)")
GAME_SPLIT_RE = re.compile(r"\s+(?:v|vs|vs\.)\s+", re.IGNORECASE)


def normalize(text: str) -> str:
    return " ".join(text.split()).casefold()


def aliases_for(team_name: str) -> tuple[str, ...]:
    key = normalize(team_name)
    for canonical, aliases in TEAM_ALIASES.items():
        if key == canonical or key in aliases:
            return aliases
    return (key,)


def _best_alias_match(text: str, team_name: str) -> str | None:
    """Return the longest alias of the team found in the text with word boundaries."""
    best: str | None = None
    for alias in aliases_for(team_name):
        if re.search(rf"\b{re.escape(alias)}\b", text):
            if best is None or len(alias) > len(best):
                best = alias
    return best


def find_team(description: str, home_team: str, away_team: str) -> str | None:
    """Return 'home' or 'away' when the description clearly names one of the teams."""
    text = normalize(description)
    home_match = _best_alias_match(text, home_team)
    away_match = _best_alias_match(text, away_team)
    if home_match and away_match:
        # e.g. 'Melbourne' also matching inside 'North Melbourne': trust the longer alias.
        if len(home_match) > len(away_match):
            return "home"
        if len(away_match) > len(home_match):
            return "away"
        return None
    if home_match:
        return "home"
    if away_match:
        return "away"
    return None


def split_game_name(game_name: str) -> tuple[str, str] | None:
    parts = GAME_SPLIT_RE.split(" ".join(game_name.split()), maxsplit=1)
    if len(parts) != 2:
        return None
    first, second = parts[0].strip(), parts[1].strip()
    if not first or not second:
        return None
    return first, second


def game_matches_tip(tip_game_name: str | None, game: dict[str, Any]) -> bool:
    """True when the tip's game name names both teams of this Squiggle game."""
    if not tip_game_name:
        return False
    teams = split_game_name(tip_game_name)
    if teams is None:
        return False
    home, away = game.get("hteam") or "", game.get("ateam") or ""
    first = find_team(teams[0], home, away)
    second = find_team(teams[1], home, away)
    return first is not None and second is not None and first != second


def grade_leg(description: str, game: dict[str, Any]) -> str | None:
    """Grade one leg from a final score. Returns Win/Loss/Push, or None if ungradeable."""
    text = normalize(description)
    if any(word in text for word in PLAYER_MARKET_WORDS):
        return None
    home, away = game.get("hteam") or "", game.get("ateam") or ""
    hscore, ascore = game.get("hscore"), game.get("ascore")
    if hscore is None or ascore is None:
        return None
    total_match = TOTAL_RE.search(text)
    side = find_team(text, home, away)

    if total_match and side is None:
        direction, line_raw = total_match.groups()
        line = float(line_raw)
        total = hscore + ascore
        if abs(total - line) < 1e-9:
            return "Push"
        if direction == "over":
            return "Win" if total > line else "Loss"
        return "Win" if total < line else "Loss"

    if side is None:
        return None

    team_margin = (hscore - ascore) if side == "home" else (ascore - hscore)
    line_match = LINE_RE.search(text)
    if line_match:
        line = float(line_match.group(1))
        adjusted = team_margin + line
        if abs(adjusted) < 1e-9:
            return "Push"
        return "Win" if adjusted > 0 else "Loss"

    # Plain head-to-head: any leftover digits mean an unknown market.
    remainder = text
    for team in (home, away):
        alias = _best_alias_match(remainder, team)
        if alias:
            remainder = remainder.replace(alias, " ")
    for market_word in ("head to head", "h2h", "match winner", "to win", "winner", "win"):
        remainder = remainder.replace(market_word, " ")
    if re.search(r"\d", remainder):
        return None
    if team_margin == 0:
        return "Push"
    return "Win" if team_margin > 0 else "Loss"


def grade_tip(tip: dict[str, Any], game: dict[str, Any]) -> tuple[str, list[str]] | None:
    """Grade a whole tip. Returns (result, leg_results), or None when manual review is needed."""
    legs = tip.get("legs") or []
    if not legs:
        return None
    leg_results: list[str] = []
    for leg in legs:
        graded = grade_leg(leg["description"], game)
        if graded is None:
            return None
        leg_results.append(graded)
    if any(result == "Loss" for result in leg_results):
        return "Loss", leg_results
    if all(result == "Win" for result in leg_results):
        return "Win", leg_results
    if len(leg_results) == 1:
        return leg_results[0], leg_results
    # A pushed leg inside a multi changes the odds; leave it for a human.
    return None


def parse_game_date(game: dict[str, Any]) -> datetime | None:
    raw = game.get("date")
    if not raw:
        return None
    try:
        return datetime.strptime(raw, "%Y-%m-%d %H:%M:%S")
    except ValueError:
        return None


def fixture_rows(games: list[dict[str, Any]]) -> list[dict[str, str]]:
    """Convert Squiggle games into afl_games rows (venue-local date, 'Home v Away')."""
    rows: list[dict[str, str]] = []
    for game in games:
        when = parse_game_date(game)
        home, away = game.get("hteam"), game.get("ateam")
        if when is None or not home or not away:
            continue
        rows.append({"game_date": when.date().isoformat(), "game_name": f"{home} v {away}"})
    return rows


def completed_games(games: list[dict[str, Any]], within_days: int = 10) -> list[dict[str, Any]]:
    cutoff = datetime.now() - timedelta(days=within_days)
    selected = []
    for game in games:
        if game.get("complete") != 100:
            continue
        when = parse_game_date(game)
        if when is not None and when >= cutoff:
            selected.append(game)
    return selected


def match_game_for_tip(tip: dict[str, Any], games: list[dict[str, Any]]) -> dict[str, Any] | None:
    """The completed game matching this tip's game name, nearest to its post date."""
    candidates = [game for game in games if game_matches_tip(tip.get("game_name"), game)]
    if not candidates:
        return None
    if len(candidates) == 1:
        return candidates[0]
    posted = tip.get("post_at") or tip.get("created_at") or ""
    try:
        posted_at = datetime.fromisoformat(posted).replace(tzinfo=None)
    except ValueError:
        return None

    def distance(game: dict[str, Any]) -> float:
        when = parse_game_date(game)
        return abs((when - posted_at).total_seconds()) if when else float("inf")

    best = min(candidates, key=distance)
    # Never settle from a game more than 4 days away from the tip's post time.
    return best if distance(best) <= 4 * 86400 else None


class SquiggleClient:
    """Small async client for the free Squiggle AFL API (no key required)."""

    def __init__(self, logger: Any = None):
        self.logger = logger

    async def fetch_games(self, year: int) -> list[dict[str, Any]]:
        import aiohttp

        params = {"q": f"games;year={year}"}
        headers = {"User-Agent": USER_AGENT}
        timeout = aiohttp.ClientTimeout(total=30)
        try:
            async with aiohttp.ClientSession(timeout=timeout, headers=headers) as session:
                async with session.get(SQUIGGLE_URL, params=params) as response:
                    response.raise_for_status()
                    payload = json.loads(await response.text())
        except Exception:
            if self.logger:
                self.logger.exception("Squiggle API request failed for year %s.", year)
            return []
        return payload.get("games", []) or []
