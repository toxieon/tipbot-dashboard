from __future__ import annotations

import csv
import io
from typing import Any

from afl_tipster_bot.database import Database


def _csv_bytes(rows: list[dict[str, Any]], fieldnames: list[str]) -> bytes:
    buffer = io.StringIO(newline="")
    writer = csv.DictWriter(buffer, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()
    for row in rows:
        writer.writerow(row)
    return buffer.getvalue().encode("utf-8")


class ExportService:
    def __init__(self, database: Database):
        self.db = database

    async def guild_exports(self, guild_id: int) -> list[tuple[str, bytes]]:
        tips = await self.db.fetchall(
            """
            SELECT
                COALESCE(t.display_id, t.tip_id) AS tip_id,
                t.guild_id, t.sport, t.bet_type, t.bookmaker, t.odds, t.units,
                t.game_name, t.status, t.result, t.profit_units, t.post_at, t.posted_at,
                t.settled_at, t.deleted_at,
                GROUP_CONCAT(l.description, ' | ') AS legs
            FROM tips t
            LEFT JOIN tip_legs l ON l.tip_id = t.tip_id
            WHERE t.guild_id = ?
            GROUP BY t.tip_id
            ORDER BY t.created_at ASC
            """,
            (guild_id,),
        )
        follows = await self.db.fetchall(
            """
            SELECT f.guild_id, f.user_id,
                   COALESCE(t.display_id, f.tip_id) AS tip_id,
                   f.stake_units, f.result, f.profit_units, f.followed_at, f.settled_at
            FROM user_follows f
            LEFT JOIN tips t ON t.tip_id = f.tip_id
            WHERE f.guild_id = ?
            ORDER BY f.followed_at ASC
            """,
            (guild_id,),
        )
        users = await self.db.fetchall(
            """
            SELECT guild_id, discord_id, username, unit_size, starting_bankroll,
                   current_bankroll, created_at, updated_at
            FROM users
            WHERE guild_id = ?
            ORDER BY username ASC
            """,
            (guild_id,),
        )
        return [
            (
                f"tipbot-{guild_id}-tips.csv",
                _csv_bytes(
                    tips,
                    [
                        "tip_id",
                        "guild_id",
                        "sport",
                        "bet_type",
                        "bookmaker",
                        "odds",
                        "units",
                        "game_name",
                        "status",
                        "result",
                        "profit_units",
                        "post_at",
                        "posted_at",
                        "settled_at",
                        "deleted_at",
                        "legs",
                    ],
                ),
            ),
            (
                f"tipbot-{guild_id}-follows.csv",
                _csv_bytes(
                    follows,
                    [
                        "guild_id",
                        "user_id",
                        "tip_id",
                        "stake_units",
                        "result",
                        "profit_units",
                        "followed_at",
                        "settled_at",
                    ],
                ),
            ),
            (
                f"tipbot-{guild_id}-users.csv",
                _csv_bytes(
                    users,
                    [
                        "guild_id",
                        "discord_id",
                        "username",
                        "unit_size",
                        "starting_bankroll",
                        "current_bankroll",
                        "created_at",
                        "updated_at",
                    ],
                ),
            ),
        ]
