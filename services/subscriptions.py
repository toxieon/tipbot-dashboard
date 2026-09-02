from __future__ import annotations

from typing import Any

from afl_tipster_bot.database import Database
from afl_tipster_bot.services.common import iso_now


class SubscriptionService:
    def __init__(self, database: Database):
        self.db = database

    async def ensure_customer(self, guild_id: int, display_name: str | None = None) -> dict[str, Any]:
        now = iso_now()
        await self.db.execute(
            """
            INSERT INTO customer_settings (guild_id, display_name, created_at, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(guild_id) DO UPDATE SET
                display_name = COALESCE(excluded.display_name, customer_settings.display_name),
                updated_at = excluded.updated_at
            """,
            (guild_id, display_name, now, now),
        )
        return await self.get_customer(guild_id) or {}

    async def get_customer(self, guild_id: int) -> dict[str, Any] | None:
        return await self.db.fetchone(
            "SELECT * FROM customer_settings WHERE guild_id = ?",
            (guild_id,),
        )

    async def is_enabled(self, guild_id: int) -> bool:
        row = await self.get_customer(guild_id)
        return True if row is None else bool(row["enabled"]) and bool(row["subscription_active"])

    async def subscription_active(self, guild_id: int) -> bool:
        row = await self.get_customer(guild_id)
        return True if row is None else bool(row["subscription_active"])

    async def results_graph_enabled(self, guild_id: int) -> bool:
        row = await self.get_customer(guild_id)
        return bool(row and row["results_graph_enabled"])

    async def allow_custom_games(self, guild_id: int) -> bool:
        row = await self.get_customer(guild_id)
        return True if row is None else bool(row["allow_custom_games"])

    async def preset_games_enabled(self, guild_id: int) -> bool:
        row = await self.get_customer(guild_id)
        return True if row is None else bool(row["preset_games_enabled"])

    async def set_enabled(self, guild_id: int, enabled: bool) -> dict[str, Any]:
        await self.ensure_customer(guild_id)
        await self.db.execute(
            "UPDATE customer_settings SET enabled = ?, updated_at = ? WHERE guild_id = ?",
            (int(enabled), iso_now(), guild_id),
        )
        return await self.get_customer(guild_id) or {}

    async def set_subscription_active(self, guild_id: int, active: bool) -> dict[str, Any]:
        await self.ensure_customer(guild_id)
        await self.db.execute(
            "UPDATE customer_settings SET subscription_active = ?, updated_at = ? WHERE guild_id = ?",
            (int(active), iso_now(), guild_id),
        )
        return await self.get_customer(guild_id) or {}

    async def set_results_graph_enabled(self, guild_id: int, enabled: bool) -> dict[str, Any]:
        await self.ensure_customer(guild_id)
        await self.db.execute(
            """
            UPDATE customer_settings
            SET results_graph_enabled = ?, updated_at = ?
            WHERE guild_id = ?
            """,
            (int(enabled), iso_now(), guild_id),
        )
        return await self.get_customer(guild_id) or {}

    async def set_allow_custom_games(self, guild_id: int, enabled: bool) -> dict[str, Any]:
        await self.ensure_customer(guild_id)
        await self.db.execute(
            """
            UPDATE customer_settings
            SET allow_custom_games = ?, updated_at = ?
            WHERE guild_id = ?
            """,
            (int(enabled), iso_now(), guild_id),
        )
        return await self.get_customer(guild_id) or {}

    async def set_preset_games_enabled(self, guild_id: int, enabled: bool) -> dict[str, Any]:
        await self.ensure_customer(guild_id)
        await self.db.execute(
            """
            UPDATE customer_settings
            SET preset_games_enabled = ?, updated_at = ?
            WHERE guild_id = ?
            """,
            (int(enabled), iso_now(), guild_id),
        )
        return await self.get_customer(guild_id) or {}

    async def save_master_channels(
        self,
        guild_id: int,
        display_name: str,
        category_id: int,
        upcoming_channel_id: int,
        results_channel_id: int,
        settings_channel_id: int,
        data_channel_id: int,
        game_import_channel_id: int,
    ) -> dict[str, Any]:
        await self.ensure_customer(guild_id, display_name)
        await self.db.execute(
            """
            UPDATE customer_settings
            SET display_name = ?, master_category_id = ?, master_upcoming_channel_id = ?,
                master_results_channel_id = ?, master_settings_channel_id = ?,
                master_data_channel_id = ?, master_game_import_channel_id = ?,
                updated_at = ?
            WHERE guild_id = ?
            """,
            (
                display_name,
                category_id,
                upcoming_channel_id,
                results_channel_id,
                settings_channel_id,
                data_channel_id,
                game_import_channel_id,
                iso_now(),
                guild_id,
            ),
        )
        return await self.get_customer(guild_id) or {}

    async def save_settings_message(self, guild_id: int, message_id: int) -> None:
        await self.ensure_customer(guild_id)
        await self.db.execute(
            """
            UPDATE customer_settings
            SET master_settings_message_id = ?, updated_at = ?
            WHERE guild_id = ?
            """,
            (message_id, iso_now(), guild_id),
        )

    async def customer_by_game_import_channel(self, channel_id: int) -> dict[str, Any] | None:
        return await self.db.fetchone(
            "SELECT * FROM customer_settings WHERE master_game_import_channel_id = ?",
            (channel_id,),
        )

    async def get_follow_emoji(self, guild_id: int) -> str:
        row = await self.db.fetchone(
            "SELECT follow_emoji FROM guild_settings WHERE guild_id = ?",
            (guild_id,),
        )
        return row["follow_emoji"] if row and row["follow_emoji"] else "\U0001FAE1"

    async def set_follow_emoji(self, guild_id: int, emoji: str) -> None:
        now = iso_now()
        await self.db.execute(
            """
            INSERT INTO guild_settings (guild_id, channel_ids_json, follow_emoji, created_at, updated_at)
            VALUES (?, '{}', ?, ?, ?)
            ON CONFLICT(guild_id) DO UPDATE SET
                follow_emoji = excluded.follow_emoji,
                updated_at = excluded.updated_at
            """,
            (guild_id, emoji, now, now),
        )
