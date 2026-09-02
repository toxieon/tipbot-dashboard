"""Tracks which Discord servers the bot is currently in, so the web control
panel (and anything else) can read a live, self-maintaining server list from
the database instead of only knowing about servers that ran /setup.

The table is created on demand, so this needs no change to database.py.
"""
from __future__ import annotations

from typing import Any, Iterable

from afl_tipster_bot.services.common import iso_now


class GuildPresenceService:
    def __init__(self, database: Any):
        self.db = database

    async def ensure_schema(self) -> None:
        await self.db.executescript(
            """
            CREATE TABLE IF NOT EXISTS bot_guilds (
                guild_id INTEGER PRIMARY KEY,
                name TEXT,
                member_count INTEGER,
                present INTEGER NOT NULL DEFAULT 1,
                first_seen TEXT,
                updated_at TEXT
            );
            """
        )

    async def mark_present(
        self, guild_id: int, name: str | None, member_count: int | None
    ) -> None:
        now = iso_now()
        await self.db.execute(
            """
            INSERT INTO bot_guilds (guild_id, name, member_count, present, first_seen, updated_at)
            VALUES (?, ?, ?, 1, ?, ?)
            ON CONFLICT(guild_id) DO UPDATE SET
                name = excluded.name,
                member_count = excluded.member_count,
                present = 1,
                updated_at = excluded.updated_at
            """,
            (guild_id, name, member_count, now, now),
        )

    async def mark_absent(self, guild_id: int) -> None:
        await self.db.execute(
            "UPDATE bot_guilds SET present = 0, updated_at = ? WHERE guild_id = ?",
            (iso_now(), guild_id),
        )

    async def sync_all(self, guilds: Iterable[Any]) -> int:
        count = 0
        for guild in guilds:
            await self.mark_present(guild.id, getattr(guild, "name", None), getattr(guild, "member_count", None))
            count += 1
        return count

    async def list_guilds(self, present_only: bool = True) -> list[dict[str, Any]]:
        if present_only:
            return await self.db.fetchall(
                "SELECT * FROM bot_guilds WHERE present = 1 ORDER BY COALESCE(name, CAST(guild_id AS TEXT))"
            )
        return await self.db.fetchall(
            "SELECT * FROM bot_guilds ORDER BY present DESC, COALESCE(name, CAST(guild_id AS TEXT))"
        )
