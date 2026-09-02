from __future__ import annotations

from collections import defaultdict, deque
from datetime import UTC, datetime, timedelta

from afl_tipster_bot.database import Database

WINDOW_SECONDS = 15
COMMAND_LIMIT = 5
BLOCK_MINUTES = (5, 15, 30, 24 * 60)
STRIKE_RESET_DAYS = 7


def block_minutes_for_strike(strike_count: int) -> int:
    index = min(max(strike_count, 1), len(BLOCK_MINUTES)) - 1
    return BLOCK_MINUTES[index]


def format_block_duration(minutes: int) -> str:
    if minutes >= 24 * 60:
        return "24 hours"
    return f"{minutes} minutes"


class CommandSafetyService:
    def __init__(self, database: Database):
        self.db = database
        self._recent: dict[tuple[int, int], deque[datetime]] = defaultdict(deque)

    async def check(self, guild_id: int, user_id: int) -> tuple[bool, str | None]:
        now = datetime.now(UTC)
        row = await self.db.fetchone(
            "SELECT * FROM command_abuse WHERE guild_id = ? AND user_id = ?",
            (guild_id, user_id),
        )
        if row and row["blocked_until"]:
            blocked_until = datetime.fromisoformat(row["blocked_until"])
            if blocked_until > now:
                remaining = max(1, int((blocked_until - now).total_seconds() / 60) + 1)
                return False, f"TipBot command access is temporarily blocked for about {remaining} more minutes."

        key = (guild_id, user_id)
        recent = self._recent[key]
        cutoff = now - timedelta(seconds=WINDOW_SECONDS)
        while recent and recent[0] < cutoff:
            recent.popleft()
        recent.append(now)
        if len(recent) < COMMAND_LIMIT:
            return True, None
        recent.clear()

        strike_count = 1
        if row:
            last_strike = datetime.fromisoformat(row["last_strike_at"])
            if last_strike >= now - timedelta(days=STRIKE_RESET_DAYS):
                strike_count = row["strike_count"] + 1
        minutes = block_minutes_for_strike(strike_count)
        blocked_until = now + timedelta(minutes=minutes)
        await self.db.execute(
            """
            INSERT INTO command_abuse
                (guild_id, user_id, strike_count, blocked_until, last_strike_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(guild_id, user_id) DO UPDATE SET
                strike_count = excluded.strike_count,
                blocked_until = excluded.blocked_until,
                last_strike_at = excluded.last_strike_at
            """,
            (guild_id, user_id, strike_count, blocked_until.isoformat(), now.isoformat()),
        )
        return (
            False,
            f"Command spam detected. TipBot command access is blocked for "
            f"{format_block_duration(minutes)}.",
        )
