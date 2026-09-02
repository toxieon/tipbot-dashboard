from __future__ import annotations

import base64
import json
import uuid
import zlib
from typing import TYPE_CHECKING, Any

from afl_tipster_bot.services.common import iso_now

if TYPE_CHECKING:
    import discord


LEDGER_PREFIX = "TB1:"
CHUNK_PREFIX = "TB1C:"
MAX_MESSAGE_LENGTH = 1900
CHUNK_DATA_LENGTH = 1800


def pack_record(record: dict[str, Any]) -> str:
    payload = json.dumps(record, separators=(",", ":"), default=str).encode("utf-8")
    return LEDGER_PREFIX + base64.urlsafe_b64encode(zlib.compress(payload, level=9)).decode("ascii")


def unpack_record(value: str) -> dict[str, Any] | None:
    clean = value.strip()
    if not clean.startswith(LEDGER_PREFIX):
        return None
    try:
        payload = base64.urlsafe_b64decode(clean[len(LEDGER_PREFIX) :].encode("ascii"))
        return json.loads(zlib.decompress(payload).decode("utf-8"))
    except Exception:
        return None


def pack_messages(record: dict[str, Any]) -> list[str]:
    """Pack a record into one or more Discord-safe messages.

    Records that fit in one message use the classic ``TB1:`` format. Larger
    records are split into ``TB1C:<id>:<part>:<total>:<data>`` chunks so no
    record is ever silently dropped for being too big.
    """
    content = pack_record(record)
    if len(content) <= MAX_MESSAGE_LENGTH:
        return [content]
    body = content[len(LEDGER_PREFIX) :]
    record_id = uuid.uuid4().hex[:8]
    chunks = [body[index : index + CHUNK_DATA_LENGTH] for index in range(0, len(body), CHUNK_DATA_LENGTH)]
    total = len(chunks)
    return [
        f"{CHUNK_PREFIX}{record_id}:{position}:{total}:{chunk}"
        for position, chunk in enumerate(chunks, start=1)
    ]


class ChunkAssembler:
    """Reassembles multi-message ledger records during a channel scan."""

    def __init__(self) -> None:
        self._parts: dict[str, dict[int, str]] = {}
        self._totals: dict[str, int] = {}

    def add(self, content: str) -> dict[str, Any] | None:
        clean = content.strip()
        if not clean.startswith(CHUNK_PREFIX):
            return None
        try:
            record_id, position_raw, total_raw, data = clean[len(CHUNK_PREFIX) :].split(":", 3)
            position = int(position_raw)
            total = int(total_raw)
        except ValueError:
            return None
        if total < 1 or not 1 <= position <= total:
            return None
        self._parts.setdefault(record_id, {})[position] = data
        self._totals[record_id] = total
        parts = self._parts[record_id]
        if len(parts) < total:
            return None
        body = "".join(parts[index] for index in range(1, total + 1))
        del self._parts[record_id]
        del self._totals[record_id]
        return unpack_record(LEDGER_PREFIX + body)


class DataLedgerService:
    def __init__(self, bot: Any):
        self.bot = bot

    async def channel_for_guild(self, guild: discord.Guild) -> discord.TextChannel | None:
        from afl_tipster_bot.services.discord_helpers import configured_channel

        return await configured_channel(guild, self.bot.database, "data-store")

    async def record(
        self,
        guild: discord.Guild,
        event: str,
        data: dict[str, Any] | list[Any] | None = None,
        actor_id: int | None = None,
    ) -> None:
        channel = await self.channel_for_guild(guild)
        if channel is None:
            return
        record = {
            "v": 1,
            "guild_id": guild.id,
            "event": event,
            "actor_id": actor_id,
            "created_at": iso_now(),
            "data": data or {},
        }
        try:
            for content in pack_messages(record):
                await channel.send(content)
        except Exception:
            self.bot.logger.exception("Failed to write data ledger event %s for guild %s.", event, guild.id)

    async def preview_channel(self, guild: discord.Guild) -> dict[str, int]:
        return await self._scan_channel(guild, replay=False)

    async def restore_recent(self, guild: discord.Guild, limit: int = 500) -> dict[str, int]:
        return await self._scan_channel(guild, replay=True, limit=limit)

    async def restore_from_channel(self, guild: discord.Guild) -> dict[str, int]:
        return await self._scan_channel(guild, replay=True)

    async def guild_has_local_data(self, guild_id: int) -> bool:
        """Return whether the local database already holds rows for this guild."""
        tip = await self.bot.database.fetchone(
            "SELECT tip_id FROM tips WHERE guild_id = ? LIMIT 1", (guild_id,)
        )
        if tip:
            return True
        settings = await self.bot.database.fetchone(
            "SELECT guild_id FROM guild_settings WHERE guild_id = ? LIMIT 1", (guild_id,)
        )
        return settings is not None

    async def restore_on_startup(self, guild: discord.Guild, recent_limit: int = 750) -> dict[str, int]:
        """Full replay after a wipe (empty local database), recent replay otherwise."""
        if await self.guild_has_local_data(guild.id):
            return await self._scan_channel(guild, replay=True, limit=recent_limit)
        return await self._scan_channel(guild, replay=True)

    async def _scan_channel(
        self,
        guild: discord.Guild,
        replay: bool,
        limit: int | None = None,
    ) -> dict[str, int]:
        channel = await self.channel_for_guild(guild)
        if channel is None:
            raise ValueError("No #data-store channel is configured for this server.")

        if limit is None:
            messages = [message async for message in channel.history(limit=None, oldest_first=True)]
        else:
            messages = [message async for message in channel.history(limit=limit, oldest_first=False)]
            messages.reverse()

        counts: dict[str, int] = {}
        assembler = ChunkAssembler()
        for message in messages:
            content = message.content
            if content.startswith(CHUNK_PREFIX):
                record = assembler.add(content)
            else:
                record = unpack_record(content)
            if not record or record.get("guild_id") != guild.id:
                continue
            event = record.get("event", "")
            data = record.get("data") or {}
            if replay:
                try:
                    await self._replay_event(event, data)
                except Exception:
                    counts["errors"] = counts.get("errors", 0) + 1
                    self.bot.logger.exception(
                        "Failed to replay data-store event %s for guild %s.", event, guild.id
                    )
                    continue
            counts[event] = counts.get(event, 0) + 1
        return counts

    async def _replay_event(self, event: str, data: Any) -> None:
        if event in {"tip.created", "tip.posted", "tip.edited", "tip.settled", "tip.corrected", "tip.deleted"}:
            await self._restore_tip(data)
        elif event == "user.upsert":
            await self._restore_user(data)
        elif event == "follow.created":
            await self._restore_follow(data)
        elif event == "follow.removed":
            await self.bot.database.execute(
                "DELETE FROM user_follows WHERE guild_id = ? AND user_id = ? AND tip_id = ?",
                (data["guild_id"], data["user_id"], data["tip_id"]),
            )
        elif event == "games.imported":
            for game in data.get("games", []):
                await self._restore_game(data["guild_id"], game, data.get("imported_by"))
        elif event == "settings.follow_emoji":
            await self.bot.subscription_service.set_follow_emoji(data["guild_id"], data["follow_emoji"])
        elif event == "settings.channels":
            now = iso_now()
            await self.bot.database.execute(
                """
                INSERT INTO guild_settings (guild_id, channel_ids_json, created_at, updated_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(guild_id) DO UPDATE SET
                    channel_ids_json = excluded.channel_ids_json,
                    updated_at = excluded.updated_at
                """,
                (data["guild_id"], json.dumps(data.get("channel_ids", {})), now, now),
            )
        elif event == "settings.customer":
            await self._restore_customer_settings(data)
        elif event == "settings.report":
            await self.bot.report_settings_service.set(
                data["guild_id"],
                data.get("fields", []),
                data.get("graphs", []),
            )

    async def _restore_tip(self, tip: dict[str, Any]) -> None:
        if not tip:
            return
        await self.bot.database.execute(
            """
            INSERT INTO tips
                (tip_id, display_id, guild_id, tip_year, sequence_number, sport, bet_type, bookmaker, odds,
                 units, game_name, screenshot_url, screenshot_path, status, result, profit_units,
                 post_at, posted_at, discord_message_id, incoming_message_id, created_by, created_at,
                 settled_by, settled_at, deleted_by, deleted_at, delete_reason)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(tip_id) DO UPDATE SET
                display_id = excluded.display_id,
                sport = excluded.sport,
                bet_type = excluded.bet_type,
                bookmaker = excluded.bookmaker,
                odds = excluded.odds,
                units = excluded.units,
                game_name = excluded.game_name,
                screenshot_url = excluded.screenshot_url,
                screenshot_path = excluded.screenshot_path,
                status = excluded.status,
                result = excluded.result,
                profit_units = excluded.profit_units,
                post_at = excluded.post_at,
                posted_at = excluded.posted_at,
                discord_message_id = excluded.discord_message_id,
                incoming_message_id = excluded.incoming_message_id,
                settled_by = excluded.settled_by,
                settled_at = excluded.settled_at,
                deleted_by = excluded.deleted_by,
                deleted_at = excluded.deleted_at,
                delete_reason = excluded.delete_reason
            """,
            (
                tip["tip_id"],
                tip.get("display_id") or tip["tip_id"],
                tip["guild_id"],
                tip["tip_year"],
                tip["sequence_number"],
                tip.get("sport") or "AFL",
                tip["bet_type"],
                tip["bookmaker"],
                tip["odds"],
                tip["units"],
                tip.get("game_name"),
                tip.get("screenshot_url"),
                tip.get("screenshot_path"),
                tip.get("status", "Pending"),
                tip.get("result"),
                tip.get("profit_units"),
                tip["post_at"],
                tip.get("posted_at"),
                tip.get("discord_message_id"),
                tip.get("incoming_message_id"),
                tip["created_by"],
                tip["created_at"],
                tip.get("settled_by"),
                tip.get("settled_at"),
                tip.get("deleted_by"),
                tip.get("deleted_at"),
                tip.get("delete_reason"),
            ),
        )
        await self.bot.database.execute("DELETE FROM tip_legs WHERE tip_id = ?", (tip["tip_id"],))
        for leg in tip.get("legs", []):
            await self.bot.database.execute(
                """
                INSERT OR REPLACE INTO tip_legs
                    (tip_id, position, leg_type, description, metadata_json, leg_result, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    tip["tip_id"],
                    leg["position"],
                    leg.get("leg_type", "Custom"),
                    leg["description"],
                    leg.get("metadata_json") or "{}",
                    leg.get("leg_result"),
                    leg.get("created_at") or tip["created_at"],
                ),
            )

    async def _restore_user(self, user: dict[str, Any]) -> None:
        if not user:
            return
        await self.bot.database.execute(
            """
            INSERT OR REPLACE INTO users
                (guild_id, discord_id, username, unit_size, starting_bankroll,
                 current_bankroll, leaderboard_opt_in, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user["guild_id"],
                user["discord_id"],
                user["username"],
                user.get("unit_size"),
                user.get("starting_bankroll", 0),
                user.get("current_bankroll", 0),
                user.get("leaderboard_opt_in", 0),
                user.get("created_at") or iso_now(),
                user.get("updated_at") or iso_now(),
            ),
        )

    async def _restore_customer_settings(self, settings: dict[str, Any]) -> None:
        if not settings:
            return
        now = iso_now()
        await self.bot.database.execute(
            """
            INSERT INTO customer_settings
                (guild_id, display_name, enabled, subscription_active, plan_name,
                 results_graph_enabled, allow_custom_games, preset_games_enabled,
                 master_category_id, master_upcoming_channel_id, master_results_channel_id,
                 master_settings_channel_id, master_data_channel_id, master_game_import_channel_id,
                 master_settings_message_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(guild_id) DO UPDATE SET
                display_name = COALESCE(excluded.display_name, customer_settings.display_name),
                enabled = excluded.enabled,
                subscription_active = excluded.subscription_active,
                plan_name = excluded.plan_name,
                results_graph_enabled = excluded.results_graph_enabled,
                allow_custom_games = excluded.allow_custom_games,
                preset_games_enabled = excluded.preset_games_enabled,
                master_category_id = COALESCE(excluded.master_category_id, customer_settings.master_category_id),
                master_upcoming_channel_id = COALESCE(
                    excluded.master_upcoming_channel_id, customer_settings.master_upcoming_channel_id),
                master_results_channel_id = COALESCE(
                    excluded.master_results_channel_id, customer_settings.master_results_channel_id),
                master_settings_channel_id = COALESCE(
                    excluded.master_settings_channel_id, customer_settings.master_settings_channel_id),
                master_data_channel_id = COALESCE(
                    excluded.master_data_channel_id, customer_settings.master_data_channel_id),
                master_game_import_channel_id = COALESCE(
                    excluded.master_game_import_channel_id, customer_settings.master_game_import_channel_id),
                master_settings_message_id = COALESCE(
                    excluded.master_settings_message_id, customer_settings.master_settings_message_id),
                updated_at = excluded.updated_at
            """,
            (
                settings["guild_id"],
                settings.get("display_name"),
                int(settings.get("enabled", 1)),
                int(settings.get("subscription_active", 1)),
                settings.get("plan_name") or "starter",
                int(settings.get("results_graph_enabled", 0)),
                int(settings.get("allow_custom_games", 1)),
                int(settings.get("preset_games_enabled", 1)),
                settings.get("master_category_id"),
                settings.get("master_upcoming_channel_id"),
                settings.get("master_results_channel_id"),
                settings.get("master_settings_channel_id"),
                settings.get("master_data_channel_id"),
                settings.get("master_game_import_channel_id"),
                settings.get("master_settings_message_id"),
                settings.get("created_at") or now,
                settings.get("updated_at") or now,
            ),
        )

    async def _restore_follow(self, follow: dict[str, Any]) -> None:
        if not follow:
            return
        tip = await self.bot.database.fetchone(
            "SELECT tip_id FROM tips WHERE tip_id = ?", (follow["tip_id"],)
        )
        if tip is None:
            # The follow's tip record has not been replayed (or is outside a
            # recent-window replay). Skip instead of failing the whole restore.
            raise ValueError(f"Cannot restore follow: tip {follow['tip_id']} is not in the local database.")
        user = await self.bot.database.fetchone(
            "SELECT discord_id FROM users WHERE guild_id = ? AND discord_id = ?",
            (follow["guild_id"], follow["user_id"]),
        )
        if user is None:
            now = iso_now()
            await self.bot.database.execute(
                """
                INSERT OR IGNORE INTO users
                    (guild_id, discord_id, username, starting_bankroll, current_bankroll, created_at, updated_at)
                VALUES (?, ?, ?, 0, 0, ?, ?)
                """,
                (follow["guild_id"], follow["user_id"], f"member-{follow['user_id']}", now, now),
            )
        await self.bot.database.execute(
            """
            INSERT OR REPLACE INTO user_follows
                (guild_id, user_id, tip_id, stake_units, result, profit_units, followed_at, settled_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                follow["guild_id"],
                follow["user_id"],
                follow["tip_id"],
                follow["stake_units"],
                follow.get("result"),
                follow.get("profit_units"),
                follow.get("followed_at") or iso_now(),
                follow.get("settled_at"),
            ),
        )

    async def _restore_game(self, guild_id: int, game: dict[str, Any], imported_by: int | None) -> None:
        await self.bot.database.execute(
            """
            INSERT OR IGNORE INTO afl_games
                (guild_id, game_date, game_name, imported_by, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                guild_id,
                game["game_date"],
                game["game_name"],
                imported_by,
                game.get("created_at") or iso_now(),
            ),
        )
