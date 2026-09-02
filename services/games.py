from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

from afl_tipster_bot.database import Database
from afl_tipster_bot.services.common import iso_now


@dataclass(slots=True)
class ParsedGame:
    game_date: str
    game_name: str


DATE_PATTERNS = (
    ("%Y-%m-%d", re.compile(r"^\s*(\d{4}-\d{2}-\d{2})(?:\s+\d{1,2}:\d{2})?\s*[-–]\s*(.+)$")),
    ("%d/%m/%Y", re.compile(r"^\s*(\d{1,2}/\d{1,2}/\d{4})(?:\s+\d{1,2}:\d{2})?\s*[-–]\s*(.+)$")),
)


def parse_game_lines(value: str) -> tuple[list[ParsedGame], list[str]]:
    games: list[ParsedGame] = []
    rejected: list[str] = []
    seen: set[tuple[str, str]] = set()
    for raw_line in value.replace("\r\n", "\n").splitlines():
        line = " ".join(raw_line.strip().split())
        if not line or line.lower().startswith("round "):
            continue
        parsed: ParsedGame | None = None
        for date_format, pattern in DATE_PATTERNS:
            match = pattern.match(line)
            if not match:
                continue
            date_value, game_name = match.groups()
            try:
                game_date = datetime.strptime(date_value, date_format).date().isoformat()
            except ValueError:
                continue
            clean_name = " ".join(game_name.split())
            if clean_name:
                parsed = ParsedGame(game_date, clean_name)
                break
        if parsed is None:
            rejected.append(raw_line)
            continue
        key = (parsed.game_date, parsed.game_name.casefold())
        if key not in seen:
            seen.add(key)
            games.append(parsed)
    return games, rejected


class GameScheduleService:
    def __init__(self, database: Database):
        self.db = database

    async def import_games(self, guild_id: int, text: str, imported_by: int | None) -> dict[str, Any]:
        games, rejected = parse_game_lines(text)
        inserted = 0
        statuses: list[dict[str, str]] = []
        for game in games:
            before = await self.db.fetchone(
                """
                SELECT id FROM afl_games
                WHERE guild_id = ? AND game_date = ? AND game_name = ?
                """,
                (guild_id, game.game_date, game.game_name),
            )
            await self.db.execute(
                """
                INSERT OR IGNORE INTO afl_games
                    (guild_id, game_date, game_name, imported_by, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (guild_id, game.game_date, game.game_name, imported_by, iso_now()),
            )
            if before is None:
                inserted += 1
                status = "added"
            else:
                status = "already existed"
            statuses.append({"game_date": game.game_date, "game_name": game.game_name, "status": status})
        return {
            "parsed": len(games),
            "inserted": inserted,
            "duplicates": len(games) - inserted,
            "rejected": rejected[:10],
            "rejected_count": len(rejected),
            "games": [
                {"game_date": game.game_date, "game_name": game.game_name}
                for game in games
            ],
            "statuses": statuses,
        }

    async def upcoming_games(
        self,
        guild_id: int,
        now: datetime,
        days: int = 7,
        limit: int = 25,
    ) -> list[dict[str, Any]]:
        start = now.date().isoformat()
        end = (now.date() + timedelta(days=days)).isoformat()
        return await self.db.fetchall(
            """
            SELECT * FROM afl_games
            WHERE guild_id IN (0, ?) AND game_date >= ? AND game_date <= ?
            ORDER BY game_date ASC, game_name ASC
            LIMIT ?
            """,
            (guild_id, start, end, limit),
        )

    async def game_exists(self, guild_id: int, game_name: str) -> bool:
        row = await self.db.fetchone(
            """
            SELECT id FROM afl_games
            WHERE guild_id IN (0, ?) AND LOWER(TRIM(game_name)) = LOWER(?)
            LIMIT 1
            """,
            (guild_id, " ".join(game_name.split())),
        )
        return row is not None
