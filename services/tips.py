from __future__ import annotations

import json
import sqlite3
from datetime import datetime
from typing import Any

from afl_tipster_bot.calculations import profit_for_result, scaled_user_profit, streaks
from afl_tipster_bot.database import Database
from afl_tipster_bot.models import TipDraft
from afl_tipster_bot.services.common import iso_now


def tip_prefix(sport: str) -> str:
    clean = "".join(character for character in sport.upper() if character.isalnum())
    return (clean or "TIP")[:4]


def internal_tip_id(guild_id: int, display_id: str) -> str:
    return f"{guild_id}:{display_id}"


def with_display(tip: dict[str, Any] | None) -> dict[str, Any] | None:
    """Guarantee a human-facing display_id on a tip row (legacy rows lack one)."""
    if tip is not None and not tip.get("display_id"):
        tip["display_id"] = tip["tip_id"]
    return tip


class TipService:
    def __init__(self, database: Database, timezone: Any | None = None):
        self.db = database
        self.timezone = timezone

    async def audit(
        self,
        guild_id: int,
        actor_id: int | None,
        action: str,
        entity_type: str,
        entity_id: str | None = None,
        before: Any = None,
        after: Any = None,
        details: str | None = None,
    ) -> None:
        await self.db.execute(
            """
            INSERT INTO audit_log
                (guild_id, actor_id, action, entity_type, entity_id,
                 before_json, after_json, details, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                guild_id,
                actor_id,
                action,
                entity_type,
                entity_id,
                json.dumps(before, default=str) if before is not None else None,
                json.dumps(after, default=str) if after is not None else None,
                details,
                iso_now(),
            ),
        )

    async def create_tip(self, draft: TipDraft) -> str:
        now = iso_now()
        local_post_at = draft.post_at.astimezone(self.timezone) if self.timezone else draft.post_at
        tip_year = local_post_at.year
        prefix = tip_prefix(draft.sport)

        def operation(connection: sqlite3.Connection) -> str:
            row = connection.execute(
                """
                SELECT COALESCE(MAX(sequence_number), 0) + 1
                FROM tips WHERE guild_id = ? AND tip_year = ?
                """,
                (draft.guild_id, tip_year),
            ).fetchone()
            sequence = int(row[0])
            display_id = f"{prefix}-{tip_year}-{sequence:03d}"
            tip_id = internal_tip_id(draft.guild_id, display_id)
            connection.execute(
                """
                INSERT INTO tips
                    (tip_id, display_id, guild_id, tip_year, sequence_number, sport, bet_type, bookmaker, odds,
                     units, game_name, screenshot_url, screenshot_path, post_at, created_by, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    tip_id,
                    display_id,
                    draft.guild_id,
                    tip_year,
                    sequence,
                    draft.sport,
                    draft.bet_type,
                    draft.bookmaker,
                    draft.odds,
                    draft.units,
                    draft.game_name,
                    draft.screenshot_url,
                    draft.screenshot_path,
                    draft.post_at.isoformat(),
                    draft.created_by,
                    now,
                ),
            )
            for position, leg in enumerate(draft.legs, start=1):
                connection.execute(
                    """
                    INSERT INTO tip_legs
                        (tip_id, position, leg_type, description, metadata_json, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        tip_id,
                        position,
                        leg.leg_type,
                        leg.description,
                        json.dumps(leg.metadata),
                        now,
                    ),
                )
            connection.execute(
                """
                INSERT INTO audit_log
                    (guild_id, actor_id, action, entity_type, entity_id, after_json, created_at)
                VALUES (?, ?, 'Tip Created', 'tip', ?, ?, ?)
                """,
                (
                    draft.guild_id,
                    draft.created_by,
                    tip_id,
                    json.dumps(
                        {
                            "bet_type": draft.bet_type,
                            "sport": draft.sport,
                            "bookmaker": draft.bookmaker,
                            "odds": draft.odds,
                            "units": draft.units,
                            "legs": [leg.description for leg in draft.legs],
                            "post_at": draft.post_at.isoformat(),
                        }
                    ),
                    now,
                ),
            )
            return tip_id

        return await self.db.run(operation)

    async def get_tip(self, tip_id: str, include_deleted: bool = False) -> dict[str, Any] | None:
        deleted_clause = "" if include_deleted else "AND deleted_at IS NULL"
        tip = await self.db.fetchone(
            f"SELECT * FROM tips WHERE tip_id = ? {deleted_clause}", (tip_id,)
        )
        if tip:
            tip["legs"] = await self.db.fetchall(
                "SELECT * FROM tip_legs WHERE tip_id = ? ORDER BY position", (tip_id,)
            )
        return with_display(tip)

    async def resolve_tip(
        self, guild_id: int, reference: str, include_deleted: bool = False
    ) -> dict[str, Any] | None:
        """Look up a tip by the ID an admin sees (display ID), scoped to this server.

        Falls back to legacy rows whose primary key is the display ID itself.
        """
        clean = " ".join(reference.split()).upper()
        tip = await self.get_tip(internal_tip_id(guild_id, clean), include_deleted)
        if tip is None:
            tip = await self.get_tip(clean, include_deleted)
            if tip is not None and tip["guild_id"] != guild_id:
                return None
        return tip

    async def get_tip_by_message_id(self, guild_id: int, message_id: int) -> dict[str, Any] | None:
        tip = await self.db.fetchone(
            """
            SELECT * FROM tips
            WHERE guild_id = ? AND discord_message_id = ? AND deleted_at IS NULL
            """,
            (guild_id, message_id),
        )
        if tip:
            tip["legs"] = await self.db.fetchall(
                "SELECT * FROM tip_legs WHERE tip_id = ? ORDER BY position",
                (tip["tip_id"],),
            )
        return with_display(tip)

    async def list_pending(self, guild_id: int, limit: int = 25) -> list[dict[str, Any]]:
        rows = await self.db.fetchall(
            """
            SELECT * FROM tips
            WHERE guild_id = ? AND status = 'Pending' AND deleted_at IS NULL
            ORDER BY created_at ASC LIMIT ?
            """,
            (guild_id, limit),
        )
        return [with_display(row) for row in rows]

    async def list_pending_posted(self, guild_id: int, limit: int = 100) -> list[dict[str, Any]]:
        """Pending tips that are already public, with legs (used by auto-settlement)."""
        rows = await self.db.fetchall(
            """
            SELECT * FROM tips
            WHERE guild_id = ? AND status = 'Pending' AND posted_at IS NOT NULL
              AND deleted_at IS NULL
            ORDER BY created_at ASC LIMIT ?
            """,
            (guild_id, limit),
        )
        for row in rows:
            row["legs"] = await self.db.fetchall(
                "SELECT * FROM tip_legs WHERE tip_id = ? ORDER BY position", (row["tip_id"],)
            )
        return [with_display(row) for row in rows]

    async def list_recent_settled(self, guild_id: int, limit: int = 25) -> list[dict[str, Any]]:
        rows = await self.db.fetchall(
            """
            SELECT * FROM tips
            WHERE guild_id = ? AND status = 'Settled' AND deleted_at IS NULL
            ORDER BY settled_at DESC LIMIT ?
            """,
            (guild_id, limit),
        )
        return [with_display(row) for row in rows]

    async def list_due(self, now: datetime) -> list[dict[str, Any]]:
        rows = await self.db.fetchall(
            """
            SELECT * FROM tips
            WHERE status = 'Pending' AND posted_at IS NULL AND deleted_at IS NULL
              AND post_at <= ?
            ORDER BY post_at ASC
            """,
            (now.isoformat(),),
        )
        return [with_display(row) for row in rows]

    async def mark_posted(
        self, tip_id: str, message_id: int, screenshot_url: str | None = None
    ) -> None:
        await self.db.execute(
            """
            UPDATE tips SET posted_at = ?, discord_message_id = ?,
                screenshot_url = COALESCE(?, screenshot_url)
            WHERE tip_id = ?
            """,
            (iso_now(), message_id, screenshot_url, tip_id),
        )

    async def mark_incoming_message(self, tip_id: str, message_id: int) -> None:
        await self.db.execute(
            "UPDATE tips SET incoming_message_id = ? WHERE tip_id = ?",
            (message_id, tip_id),
        )

    async def edit_tip(
        self,
        tip_id: str,
        actor_id: int,
        bookmaker: str | None,
        odds: float | None,
        units: float | None,
    ) -> dict[str, Any]:
        before = await self.get_tip(tip_id)
        if not before:
            raise ValueError("Tip not found.")
        if before["status"] != "Pending":
            raise ValueError("Only pending tips can be edited.")
        after_values = {
            "bookmaker": bookmaker or before["bookmaker"],
            "odds": odds if odds is not None else before["odds"],
            "units": units if units is not None else before["units"],
        }
        if after_values["odds"] <= 1 or after_values["units"] <= 0:
            raise ValueError("Odds must exceed 1.00 and units must exceed zero.")
        await self.db.execute(
            "UPDATE tips SET bookmaker = ?, odds = ?, units = ? WHERE tip_id = ?",
            (after_values["bookmaker"], after_values["odds"], after_values["units"], tip_id),
        )
        await self.audit(
            before["guild_id"], actor_id, "Tip Edited", "tip", tip_id, before, after_values
        )
        return (await self.get_tip(tip_id)) or {}

    async def delete_tip(self, tip_id: str, actor_id: int, reason: str) -> None:
        tip = await self.get_tip(tip_id)
        if not tip:
            raise ValueError("Tip not found.")
        if tip["status"] == "Settled":
            raise ValueError("Settled tips cannot be deleted; their history must remain intact.")
        await self.db.execute(
            """
            UPDATE tips SET status = 'Deleted', deleted_by = ?, deleted_at = ?, delete_reason = ?
            WHERE tip_id = ?
            """,
            (actor_id, iso_now(), reason, tip_id),
        )
        await self.audit(
            tip["guild_id"], actor_id, "Tip Deleted", "tip", tip_id, tip, details=reason
        )

    async def settle_tip(
        self,
        tip_id: str,
        actor_id: int,
        result: str,
        partial_profit_units: float | None = None,
        leg_results: list[str] | None = None,
    ) -> dict[str, Any]:
        tip = await self.get_tip(tip_id)
        if not tip:
            raise ValueError("Tip not found.")
        if tip["status"] != "Pending":
            raise ValueError("Only pending tips can be settled.")
        profit = profit_for_result(result, tip["odds"], tip["units"], partial_profit_units)
        now = iso_now()

        def operation(connection: sqlite3.Connection) -> None:
            connection.execute(
                """
                UPDATE tips SET status = 'Settled', result = ?, profit_units = ?,
                    settled_by = ?, settled_at = ?
                WHERE tip_id = ?
                """,
                (result, profit, actor_id, now, tip_id),
            )
            if leg_results:
                for position, leg_result in enumerate(leg_results, start=1):
                    connection.execute(
                        "UPDATE tip_legs SET leg_result = ? WHERE tip_id = ? AND position = ?",
                        (leg_result, tip_id, position),
                    )
            follows = connection.execute(
                "SELECT * FROM user_follows WHERE tip_id = ? AND settled_at IS NULL", (tip_id,)
            ).fetchall()
            for follow in follows:
                user_profit = scaled_user_profit(
                    result, tip["odds"], follow["stake_units"], tip["units"], profit
                )
                connection.execute(
                    """
                    UPDATE user_follows
                    SET result = ?, profit_units = ?, settled_at = ?
                    WHERE id = ?
                    """,
                    (result, user_profit, now, follow["id"]),
                )
                user = connection.execute(
                    "SELECT unit_size FROM users WHERE guild_id = ? AND discord_id = ?",
                    (follow["guild_id"], follow["user_id"]),
                ).fetchone()
                if user and user["unit_size"] is not None:
                    connection.execute(
                        """
                        UPDATE users SET current_bankroll = current_bankroll + ?, updated_at = ?
                        WHERE guild_id = ? AND discord_id = ?
                        """,
                        (
                            user_profit * user["unit_size"],
                            now,
                            follow["guild_id"],
                            follow["user_id"],
                        ),
                    )
            connection.execute(
                """
                INSERT INTO audit_log
                    (guild_id, actor_id, action, entity_type, entity_id,
                     before_json, after_json, created_at)
                VALUES (?, ?, 'Tip Settled', 'tip', ?, ?, ?, ?)
                """,
                (
                    tip["guild_id"],
                    actor_id,
                    tip_id,
                    json.dumps({"status": "Pending"}),
                    json.dumps({"result": result, "profit_units": profit}),
                    now,
                ),
            )

        await self.db.run(operation)
        return (await self.get_tip(tip_id)) or {}

    async def correct_result(
        self,
        tip_id: str,
        actor_id: int,
        result: str,
        partial_profit_units: float | None = None,
    ) -> dict[str, Any]:
        tip = await self.get_tip(tip_id)
        if not tip or tip["status"] != "Settled":
            raise ValueError("Only settled tips can have a result correction.")
        new_profit = profit_for_result(result, tip["odds"], tip["units"], partial_profit_units)
        now = iso_now()

        def operation(connection: sqlite3.Connection) -> None:
            follows = connection.execute(
                "SELECT * FROM user_follows WHERE tip_id = ? AND settled_at IS NOT NULL", (tip_id,)
            ).fetchall()
            for follow in follows:
                old_user_profit = follow["profit_units"] or 0
                new_user_profit = scaled_user_profit(
                    result, tip["odds"], follow["stake_units"], tip["units"], new_profit
                )
                connection.execute(
                    "UPDATE user_follows SET result = ?, profit_units = ? WHERE id = ?",
                    (result, new_user_profit, follow["id"]),
                )
                user = connection.execute(
                    "SELECT unit_size FROM users WHERE guild_id = ? AND discord_id = ?",
                    (follow["guild_id"], follow["user_id"]),
                ).fetchone()
                if user and user["unit_size"] is not None:
                    connection.execute(
                        """
                        UPDATE users SET current_bankroll = current_bankroll + ?, updated_at = ?
                        WHERE guild_id = ? AND discord_id = ?
                        """,
                        (
                            (new_user_profit - old_user_profit) * user["unit_size"],
                            now,
                            follow["guild_id"],
                            follow["user_id"],
                        ),
                    )
            connection.execute(
                """
                UPDATE tips SET result = ?, profit_units = ?, settled_by = ?
                WHERE tip_id = ?
                """,
                (result, new_profit, actor_id, tip_id),
            )
            connection.execute(
                """
                INSERT INTO audit_log
                    (guild_id, actor_id, action, entity_type, entity_id,
                     before_json, after_json, created_at)
                VALUES (?, ?, 'Result Changed', 'tip', ?, ?, ?, ?)
                """,
                (
                    tip["guild_id"],
                    actor_id,
                    tip_id,
                    json.dumps({"result": tip["result"], "profit_units": tip["profit_units"]}),
                    json.dumps({"result": result, "profit_units": new_profit}),
                    now,
                ),
            )

        await self.db.run(operation)
        return (await self.get_tip(tip_id)) or {}

    async def upsert_user(
        self,
        guild_id: int,
        user_id: int,
        username: str,
        unit_size: float | None = None,
        starting_bankroll: float | None = None,
    ) -> None:
        now = iso_now()
        existing = await self.db.fetchone(
            "SELECT * FROM users WHERE guild_id = ? AND discord_id = ?", (guild_id, user_id)
        )
        if existing:
            values = (
                username,
                unit_size if unit_size is not None else existing["unit_size"],
                starting_bankroll if starting_bankroll is not None else existing["starting_bankroll"],
                starting_bankroll if starting_bankroll is not None else existing["current_bankroll"],
                now,
                guild_id,
                user_id,
            )
            await self.db.execute(
                """
                UPDATE users SET username = ?, unit_size = ?, starting_bankroll = ?,
                    current_bankroll = ?, updated_at = ?
                WHERE guild_id = ? AND discord_id = ?
                """,
                values,
            )
        else:
            bankroll = starting_bankroll or 0.0
            await self.db.execute(
                """
                INSERT INTO users
                    (guild_id, discord_id, username, unit_size, starting_bankroll,
                     current_bankroll, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (guild_id, user_id, username, unit_size, bankroll, bankroll, now, now),
            )

    async def get_user(self, guild_id: int, user_id: int) -> dict[str, Any] | None:
        return await self.db.fetchone(
            "SELECT * FROM users WHERE guild_id = ? AND discord_id = ?",
            (guild_id, user_id),
        )

    async def follow_tip(
        self, guild_id: int, user_id: int, username: str, tip_id: str, stake_units: float
    ) -> None:
        if stake_units <= 0:
            raise ValueError("Stake units must be greater than zero.")
        tip = await self.get_tip(tip_id)
        if not tip or tip["guild_id"] != guild_id or tip["status"] != "Pending":
            raise ValueError("That tip is not active.")
        await self.upsert_user(guild_id, user_id, username)
        try:
            await self.db.execute(
                """
                INSERT INTO user_follows (guild_id, user_id, tip_id, stake_units, followed_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (guild_id, user_id, tip_id, stake_units, iso_now()),
            )
        except sqlite3.IntegrityError as exc:
            raise ValueError("You already follow this tip.") from exc

    async def unfollow_tip(self, guild_id: int, user_id: int, tip_id: str) -> bool:
        """Remove an unsettled follow. Returns True when a follow was removed."""

        def operation(connection: sqlite3.Connection) -> bool:
            cursor = connection.execute(
                """
                DELETE FROM user_follows
                WHERE guild_id = ? AND user_id = ? AND tip_id = ? AND settled_at IS NULL
                """,
                (guild_id, user_id, tip_id),
            )
            return cursor.rowcount > 0

        return await self.db.run(operation)

    async def update_follow_stake(
        self, guild_id: int, user_id: int, tip_id: str, stake_units: float
    ) -> dict[str, Any] | None:
        """Change the stake on an unsettled follow. Returns the updated follow row."""
        if stake_units <= 0:
            raise ValueError("Stake units must be greater than zero.")
        tip = await self.get_tip(tip_id)
        if not tip or tip["status"] != "Pending":
            raise ValueError("That tip is no longer pending, so its stake cannot be changed.")

        def operation(connection: sqlite3.Connection) -> bool:
            cursor = connection.execute(
                """
                UPDATE user_follows SET stake_units = ?
                WHERE guild_id = ? AND user_id = ? AND tip_id = ? AND settled_at IS NULL
                """,
                (stake_units, guild_id, user_id, tip_id),
            )
            return cursor.rowcount > 0

        updated = await self.db.run(operation)
        if not updated:
            raise ValueError("You are not currently following this tip.")
        return await self.db.fetchone(
            "SELECT * FROM user_follows WHERE guild_id = ? AND user_id = ? AND tip_id = ?",
            (guild_id, user_id, tip_id),
        )

    async def follows_for_tip(self, tip_id: str) -> list[dict[str, Any]]:
        return await self.db.fetchall(
            "SELECT * FROM user_follows WHERE tip_id = ? AND settled_at IS NULL",
            (tip_id,),
        )

    async def set_leaderboard_opt_in(
        self, guild_id: int, user_id: int, username: str, opted_in: bool
    ) -> None:
        await self.upsert_user(guild_id, user_id, username)
        await self.db.execute(
            """
            UPDATE users SET leaderboard_opt_in = ?, updated_at = ?
            WHERE guild_id = ? AND discord_id = ?
            """,
            (int(opted_in), iso_now(), guild_id, user_id),
        )

    async def leaderboard(self, guild_id: int, limit: int = 10) -> list[dict[str, Any]]:
        """Opt-in members ranked by settled profit in units. No dollar values."""
        rows = await self.db.fetchall(
            """
            SELECT u.discord_id, u.username,
                   COUNT(f.id) AS settled_count,
                   SUM(f.stake_units) AS total_staked,
                   SUM(COALESCE(f.profit_units, 0)) AS total_profit,
                   SUM(CASE WHEN f.result = 'Win' THEN 1 ELSE 0 END) AS wins
            FROM users u
            JOIN user_follows f ON f.guild_id = u.guild_id AND f.user_id = u.discord_id
            WHERE u.guild_id = ? AND u.leaderboard_opt_in = 1 AND f.settled_at IS NOT NULL
            GROUP BY u.discord_id, u.username
            HAVING COUNT(f.id) > 0
            ORDER BY total_profit DESC
            LIMIT ?
            """,
            (guild_id, limit),
        )
        for row in rows:
            staked = row["total_staked"] or 0
            row["roi"] = (row["total_profit"] / staked * 100) if staked else 0.0
            row["win_rate"] = (row["wins"] / row["settled_count"] * 100) if row["settled_count"] else 0.0
        return rows

    async def settled_follow_history(self, guild_id: int, user_id: int) -> list[dict[str, Any]]:
        """Settled follows in settlement order (used for the personal profit graph)."""
        return await self.db.fetchall(
            """
            SELECT f.settled_at, f.profit_units, f.stake_units,
                   COALESCE(t.display_id, t.tip_id) AS display_id
            FROM user_follows f JOIN tips t ON t.tip_id = f.tip_id
            WHERE f.guild_id = ? AND f.user_id = ? AND f.settled_at IS NOT NULL
            ORDER BY f.settled_at ASC
            """,
            (guild_id, user_id),
        )

    async def user_stats(self, guild_id: int, user_id: int) -> dict[str, Any] | None:
        user = await self.db.fetchone(
            "SELECT * FROM users WHERE guild_id = ? AND discord_id = ?", (guild_id, user_id)
        )
        if not user:
            return None
        follows = await self.db.fetchall(
            """
            SELECT f.*, t.odds, t.bookmaker, t.game_name,
                   COALESCE(t.display_id, t.tip_id) AS tip_display_id
            FROM user_follows f JOIN tips t ON t.tip_id = f.tip_id
            WHERE f.guild_id = ? AND f.user_id = ?
            ORDER BY f.followed_at ASC
            """,
            (guild_id, user_id),
        )
        settled = [row for row in follows if row["settled_at"]]
        total_staked = sum(row["stake_units"] for row in settled)
        total_profit = sum(row["profit_units"] or 0 for row in settled)
        wins = sum(row["result"] == "Win" for row in settled)
        longest_win, longest_loss = streaks([row["result"] for row in settled])
        best = max(settled, key=lambda row: row["profit_units"] or 0, default=None)
        worst = min(settled, key=lambda row: row["profit_units"] or 0, default=None)
        return {
            **user,
            "tips_followed": len(follows),
            "settled_tips": len(settled),
            "total_staked": total_staked,
            "total_profit": total_profit,
            "roi": (total_profit / total_staked * 100) if total_staked else 0,
            "win_rate": (wins / len(settled) * 100) if settled else 0,
            "best_bet": best["tip_display_id"] if best else "N/A",
            "worst_bet": worst["tip_display_id"] if worst else "N/A",
            "longest_winning_streak": longest_win,
            "longest_losing_streak": longest_loss,
        }

    async def tip_history(
        self,
        guild_id: int,
        limit: int = 10,
        result: str | None = None,
        year: int | None = None,
        month: int | None = None,
    ) -> list[dict[str, Any]]:
        clauses = ["guild_id = ?", "deleted_at IS NULL"]
        parameters: list[Any] = [guild_id]
        if result == "Pending":
            clauses.append("status = 'Pending'")
        elif result:
            clauses.append("result = ?")
            parameters.append(result)
        if year:
            clauses.append("substr(created_at, 1, 4) = ?")
            parameters.append(f"{year:04d}")
        if month:
            clauses.append("substr(created_at, 6, 2) = ?")
            parameters.append(f"{month:02d}")
        parameters.append(limit)
        rows = await self.db.fetchall(
            f"""
            SELECT * FROM tips WHERE {' AND '.join(clauses)}
            ORDER BY created_at DESC LIMIT ?
            """,
            tuple(parameters),
        )
        return [with_display(row) for row in rows]

    async def audit_history(self, guild_id: int, limit: int = 20) -> list[dict[str, Any]]:
        return await self.db.fetchall(
            "SELECT * FROM audit_log WHERE guild_id = ? ORDER BY created_at DESC LIMIT ?",
            (guild_id, limit),
        )
