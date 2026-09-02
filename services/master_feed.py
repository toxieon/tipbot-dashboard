from __future__ import annotations

import re
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    import discord


def safe_channel_name(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9-]+", "-", value.casefold())
    normalized = re.sub(r"-+", "-", normalized).strip("-")
    return normalized[:90] or "server"


def _on_off(value: bool) -> str:
    return "On" if value else "Off"


class MasterSettingsView:
    def __new__(cls, bot: Any, source_guild_id: int):
        import discord

        prefix = f"tipbot:master:{source_guild_id}"

        class _View(discord.ui.View):
            def __init__(self) -> None:
                super().__init__(timeout=None)
                self.bot = bot
                self.source_guild_id = source_guild_id

            async def _refresh(self, interaction: discord.Interaction, message: str) -> None:
                source_guild = self.bot.get_guild(self.source_guild_id)
                if source_guild:
                    await self.bot.master_feed_service.refresh_settings_panel(source_guild)
                if interaction.response.is_done():
                    await interaction.followup.send(message, ephemeral=True)
                else:
                    await interaction.response.send_message(message, ephemeral=True)

            async def _record_customer_settings(
                self,
                interaction: discord.Interaction,
                settings: dict[str, Any],
            ) -> None:
                source_guild = self.bot.get_guild(self.source_guild_id)
                if source_guild is None:
                    return
                await self.bot.master_feed_service.record_customer_settings(
                    source_guild, settings, interaction.user.id
                )

            @discord.ui.button(
                label="Request Invite",
                style=discord.ButtonStyle.blurple,
                custom_id=f"{prefix}:invite",
            )
            async def request_invite(
                self,
                interaction: discord.Interaction,
                button: discord.ui.Button,
            ) -> None:
                await interaction.response.defer(ephemeral=True, thinking=True)
                source_guild = self.bot.get_guild(self.source_guild_id)
                if source_guild is None:
                    await interaction.followup.send(
                        "The bot is not currently connected to that customer server.",
                        ephemeral=True,
                    )
                    return
                invite = await self.bot.master_feed_service.create_source_invite(source_guild)
                if invite is None:
                    await interaction.followup.send(
                        "I could not create an invite. Give the bot Create Invite permission in that server.",
                        ephemeral=True,
                    )
                    return
                await interaction.followup.send(str(invite), ephemeral=True)

            @discord.ui.button(
                label="Toggle Bot",
                style=discord.ButtonStyle.danger,
                custom_id=f"{prefix}:toggle-bot",
            )
            async def toggle_bot(
                self,
                interaction: discord.Interaction,
                button: discord.ui.Button,
            ) -> None:
                await interaction.response.defer(ephemeral=True, thinking=True)
                settings = await self.bot.subscription_service.ensure_customer(self.source_guild_id)
                current = bool(settings["enabled"])
                updated = await self.bot.subscription_service.set_enabled(self.source_guild_id, not current)
                await self._record_customer_settings(interaction, updated)
                await self._refresh(interaction, f"Bot access is now {_on_off(not current)}.")

            @discord.ui.button(
                label="Toggle Subscription",
                style=discord.ButtonStyle.danger,
                custom_id=f"{prefix}:toggle-subscription",
            )
            async def toggle_subscription(
                self,
                interaction: discord.Interaction,
                button: discord.ui.Button,
            ) -> None:
                await interaction.response.defer(ephemeral=True, thinking=True)
                current = await self.bot.subscription_service.subscription_active(self.source_guild_id)
                updated = await self.bot.subscription_service.set_subscription_active(
                    self.source_guild_id,
                    not current,
                )
                await self._record_customer_settings(interaction, updated)
                await self._refresh(interaction, f"Subscription is now {_on_off(not current)}.")

            @discord.ui.button(
                label="Toggle Results Graph",
                style=discord.ButtonStyle.green,
                custom_id=f"{prefix}:toggle-results-graph",
            )
            async def toggle_results_graph(
                self,
                interaction: discord.Interaction,
                button: discord.ui.Button,
            ) -> None:
                await interaction.response.defer(ephemeral=True, thinking=True)
                current = await self.bot.subscription_service.results_graph_enabled(self.source_guild_id)
                updated = await self.bot.subscription_service.set_results_graph_enabled(
                    self.source_guild_id,
                    not current,
                )
                await self._record_customer_settings(interaction, updated)
                await self._refresh(interaction, f"Results graph tier is now {_on_off(not current)}.")

            @discord.ui.button(
                label="Toggle Custom Games",
                style=discord.ButtonStyle.secondary,
                custom_id=f"{prefix}:toggle-custom-games",
            )
            async def toggle_custom_games(
                self,
                interaction: discord.Interaction,
                button: discord.ui.Button,
            ) -> None:
                await interaction.response.defer(ephemeral=True, thinking=True)
                current = await self.bot.subscription_service.allow_custom_games(self.source_guild_id)
                updated = await self.bot.subscription_service.set_allow_custom_games(
                    self.source_guild_id,
                    not current,
                )
                await self._record_customer_settings(interaction, updated)
                await self._refresh(interaction, f"Custom game names are now {_on_off(not current)}.")

            @discord.ui.button(
                label="Toggle Preset Games",
                style=discord.ButtonStyle.secondary,
                custom_id=f"{prefix}:toggle-preset-games",
            )
            async def toggle_preset_games(
                self,
                interaction: discord.Interaction,
                button: discord.ui.Button,
            ) -> None:
                await interaction.response.defer(ephemeral=True, thinking=True)
                current = await self.bot.subscription_service.preset_games_enabled(self.source_guild_id)
                updated = await self.bot.subscription_service.set_preset_games_enabled(
                    self.source_guild_id,
                    not current,
                )
                await self._record_customer_settings(interaction, updated)
                await self._refresh(interaction, f"Preset game picker is now {_on_off(not current)}.")

        return _View()


class MasterFeedService:
    def __init__(self, bot: Any):
        self.bot = bot
        self._registered_message_ids: set[int] = set()
        self._registered_guild_ids: set[int] = set()
        self._channel_cache: dict[int, dict[str, Any]] = {}
        self.last_failure_reason: str | None = None

    @property
    def enabled(self) -> bool:
        return self.bot.settings.master_guild_id is not None

    async def register_persistent_views(self) -> None:
        rows = await self.bot.database.fetchall(
            """
            SELECT guild_id, master_settings_message_id
            FROM customer_settings
            WHERE master_settings_message_id IS NOT NULL
            """
        )
        for row in rows:
            self.register_settings_view(row["guild_id"], row["master_settings_message_id"])

    def register_guild_views(self) -> None:
        """Register a persistent settings view for every known customer server.

        This runs at on_ready and does NOT depend on the local database, so the
        dashboard buttons keep working after a free-host wipe removes the stored
        message IDs. The custom_ids embed the guild ID, so one registration per
        guild handles every panel message ever posted for it.
        """
        if not self.enabled:
            return
        for guild in self.bot.guilds:
            if guild.id == self.bot.settings.master_guild_id:
                continue
            if guild.id in self._registered_guild_ids:
                continue
            self.bot.add_view(MasterSettingsView(self.bot, guild.id))
            self._registered_guild_ids.add(guild.id)

    def register_settings_view(self, source_guild_id: int, message_id: int | None) -> None:
        if source_guild_id in self._registered_guild_ids:
            return
        if message_id is None or message_id in self._registered_message_ids:
            return
        self.bot.add_view(MasterSettingsView(self.bot, source_guild_id), message_id=message_id)
        self._registered_message_ids.add(message_id)

    async def record_customer_settings(
        self,
        source_guild: discord.Guild,
        settings: dict[str, Any] | None = None,
        actor_id: int | None = None,
    ) -> None:
        """Mirror the full customer row (including master channel/message IDs)
        into the customer's #data-store so it survives a database wipe."""
        if settings is None:
            settings = await self.bot.subscription_service.get_customer(source_guild.id) or {}
        if not settings:
            return
        await self.bot.data_ledger_service.record(
            source_guild,
            "settings.customer",
            {
                "guild_id": source_guild.id,
                "display_name": settings.get("display_name"),
                "enabled": settings.get("enabled", 1),
                "subscription_active": settings.get("subscription_active", 1),
                "plan_name": settings.get("plan_name") or "starter",
                "results_graph_enabled": settings.get("results_graph_enabled", 0),
                "allow_custom_games": settings.get("allow_custom_games", 1),
                "preset_games_enabled": settings.get("preset_games_enabled", 1),
                "master_category_id": settings.get("master_category_id"),
                "master_upcoming_channel_id": settings.get("master_upcoming_channel_id"),
                "master_results_channel_id": settings.get("master_results_channel_id"),
                "master_settings_channel_id": settings.get("master_settings_channel_id"),
                "master_data_channel_id": settings.get("master_data_channel_id"),
                "master_game_import_channel_id": settings.get("master_game_import_channel_id"),
                "master_settings_message_id": settings.get("master_settings_message_id"),
            },
            actor_id,
        )

    def _find_channel(
        self,
        guild: discord.Guild,
        category: discord.CategoryChannel,
        name: str,
    ) -> discord.TextChannel | None:
        for channel in guild.text_channels:
            if channel.category_id == category.id and channel.name == name:
                return channel
        return None

    async def _ensure_channel(
        self,
        guild: discord.Guild,
        category: discord.CategoryChannel,
        name: str,
    ) -> discord.TextChannel:
        existing = self._find_channel(guild, category, name)
        if existing:
            return existing
        return await guild.create_text_channel(
            name,
            category=category,
            reason="TipBot master feed setup",
        )

    async def ensure_global_game_import_channel(self) -> discord.TextChannel | None:
        import discord

        master_guild_id = self.bot.settings.master_guild_id
        if master_guild_id is None:
            return None
        master_guild = self.bot.get_guild(master_guild_id)
        if master_guild is None:
            return None
        category = discord.utils.get(master_guild.categories, name="TipBot Master")
        try:
            if category is None:
                category = await master_guild.create_category("TipBot Master", reason="TipBot global setup")
            channel = await self._ensure_channel(master_guild, category, "afl-game-import")
            await self.seed_game_import_channel(channel)
            return channel
        except discord.HTTPException:
            self.bot.logger.exception("Failed to prepare global AFL game import channel.")
            return None

    async def is_global_game_import_channel(self, channel: discord.TextChannel) -> bool:
        if self.bot.settings.master_guild_id != channel.guild.id:
            return False
        global_channel = await self.ensure_global_game_import_channel()
        return bool(global_channel and global_channel.id == channel.id)

    def _cached_channels(self, source_guild_id: int) -> dict[str, Any] | None:
        cached = self._channel_cache.get(source_guild_id)
        if not cached:
            return None
        master_guild = self.bot.get_guild(self.bot.settings.master_guild_id or 0)
        if master_guild is None:
            return None
        # Confirm the cached channels still exist before trusting them.
        for channel in cached.values():
            if master_guild.get_channel(channel.id) is None:
                del self._channel_cache[source_guild_id]
                return None
        return cached

    async def ensure_channels(
        self,
        source_guild: discord.Guild,
        use_cache: bool = True,
    ) -> dict[str, discord.TextChannel] | None:
        import discord

        self.last_failure_reason = None
        master_guild_id = self.bot.settings.master_guild_id
        if master_guild_id is None or source_guild.id == master_guild_id:
            self.last_failure_reason = "MASTER_GUILD_ID is not set."
            return None

        if use_cache:
            cached = self._cached_channels(source_guild.id)
            if cached is not None:
                return cached

        master_guild = self.bot.get_guild(master_guild_id)
        if master_guild is None:
            self.last_failure_reason = (
                f"MASTER_GUILD_ID is set to {master_guild_id}, but the bot is not in that server."
            )
            self.bot.logger.warning(self.last_failure_reason)
            return None

        category_name = f"Owner - {source_guild.name}"[:100]
        category = discord.utils.get(master_guild.categories, name=category_name)
        try:
            if category is None:
                category = await master_guild.create_category(
                    category_name,
                    reason="TipBot master feed setup",
                )
            upcoming = await self._ensure_channel(master_guild, category, "upcoming-bets")
            results = await self._ensure_channel(master_guild, category, "results")
            settings = await self._ensure_channel(master_guild, category, "settings")
            data = await self._ensure_channel(master_guild, category, "data")
            game_import = await self.ensure_global_game_import_channel()
            if game_import is None:
                self.last_failure_reason = "Could not prepare the global #afl-game-import channel."
                return None
        except discord.Forbidden:
            self.last_failure_reason = (
                "TipBot needs the Manage Channels permission in the master server."
            )
            self.bot.logger.warning(self.last_failure_reason)
            return None
        except discord.HTTPException:
            self.last_failure_reason = "Discord rejected the master channel setup; check the logs."
            self.bot.logger.exception("Failed to prepare master-feed channels.")
            return None

        await self.bot.subscription_service.save_master_channels(
            source_guild.id,
            source_guild.name,
            category.id,
            upcoming.id,
            results.id,
            settings.id,
            data.id,
            game_import.id,
        )
        await self.refresh_settings_panel(source_guild, settings)
        await self.seed_data_channel(source_guild, data)
        await self.record_customer_settings(source_guild)
        channels = {
            "upcoming": upcoming,
            "results": results,
            "settings": settings,
            "data": data,
            "game_import": game_import,
        }
        self._channel_cache[source_guild.id] = channels
        return channels

    async def settings_embed(self, source_guild: discord.Guild) -> discord.Embed:
        import discord

        settings = await self.bot.subscription_service.ensure_customer(source_guild.id, source_guild.name)
        embed = discord.Embed(
            title=f"{source_guild.name} Settings",
            description="Owner controls for this customer server.",
            color=discord.Color.blurple(),
        )
        embed.add_field(name="Server ID", value=str(source_guild.id), inline=True)
        embed.add_field(name="Bot Enabled", value=_on_off(bool(settings["enabled"])), inline=True)
        embed.add_field(name="Subscription Active", value=_on_off(bool(settings["subscription_active"])), inline=True)
        embed.add_field(name="Plan", value=settings.get("plan_name") or "starter", inline=True)
        embed.add_field(
            name="Results Graph Tier",
            value=_on_off(bool(settings["results_graph_enabled"])),
            inline=True,
        )
        embed.add_field(
            name="Custom Game Names",
            value=_on_off(bool(settings["allow_custom_games"])),
            inline=True,
        )
        embed.add_field(
            name="Preset Game Picker",
            value=_on_off(bool(settings.get("preset_games_enabled", 1))),
            inline=True,
        )
        embed.set_footer(text="Discord presence is global, so Toggle Bot disables behaviour for this server only.")
        return embed

    async def refresh_settings_panel(
        self,
        source_guild: discord.Guild,
        settings_channel: discord.TextChannel | None = None,
    ) -> None:
        settings = await self.bot.subscription_service.ensure_customer(source_guild.id, source_guild.name)
        if settings_channel is None:
            import discord

            master_guild = self.bot.get_guild(self.bot.settings.master_guild_id or 0)
            if master_guild is None or not settings.get("master_settings_channel_id"):
                return
            channel = master_guild.get_channel(settings["master_settings_channel_id"])
            settings_channel = channel if isinstance(channel, discord.TextChannel) else None
        if settings_channel is None:
            return
        embed = await self.settings_embed(source_guild)
        view = MasterSettingsView(self.bot, source_guild.id)
        message_id = settings.get("master_settings_message_id")
        if message_id:
            self.register_settings_view(source_guild.id, message_id)
        if message_id:
            try:
                message = await settings_channel.fetch_message(message_id)
                await message.edit(embed=embed, view=view)
                return
            except Exception:
                self.bot.logger.info("Refreshing missing master settings panel for %s.", source_guild.id)
        message = await settings_channel.send(embed=embed, view=view)
        await self.bot.subscription_service.save_settings_message(source_guild.id, message.id)
        self.register_settings_view(source_guild.id, message.id)
        await self.record_customer_settings(source_guild)

    async def seed_data_channel(self, source_guild: discord.Guild, channel: discord.TextChannel) -> None:
        if channel.last_message_id:
            return
        await channel.send(
            "Data note: TipBot stores tips, follows, reports, settings, and imported games in SQLite rows keyed by "
            f"`guild_id={source_guild.id}`. This keeps each customer server's results separate."
        )

    async def seed_game_import_channel(self, channel: discord.TextChannel) -> None:
        if channel.last_message_id:
            return
        await channel.send(
            "Paste AFL games here for all connected customer servers, one per line.\n\n"
            "Example:\n"
            "```text\n"
            "2026-03-12 - Carlton v Richmond\n"
            "2026-03-13 19:40 - Collingwood v Sydney\n"
            "14/03/2026 - Brisbane v Geelong\n"
            "```"
        )

    async def create_source_invite(self, source_guild: discord.Guild) -> Any | None:
        from afl_tipster_bot.services.discord_helpers import configured_channel

        channel = await configured_channel(source_guild, self.bot.database, "admin-settings")
        if channel is None:
            me = source_guild.me
            channel = next(
                (
                    item
                    for item in source_guild.text_channels
                    if me and item.permissions_for(me).create_instant_invite
                ),
                None,
            )
        if channel is None:
            return None
        try:
            return await channel.create_invite(
                max_age=86400,
                max_uses=1,
                unique=True,
                reason="TipBot master settings invite request",
            )
        except Exception:
            self.bot.logger.exception("Could not create invite for guild %s.", source_guild.id)
            return None

    async def mirror_upcoming(self, source_guild: discord.Guild, tip: dict[str, Any]) -> None:
        import discord

        from afl_tipster_bot.services.discord_helpers import tip_embed

        channels = await self.ensure_channels(source_guild)
        if channels is None:
            return
        upcoming = channels["upcoming"]
        try:
            await upcoming.send(
                content=f"Queued from **{source_guild.name}**.",
                embed=tip_embed(tip),
            )
        except discord.HTTPException:
            self.bot.logger.exception("Failed to mirror queued tip %s.", tip.get("tip_id"))

    async def mirror_result(
        self,
        source_guild: discord.Guild,
        tip: dict[str, Any],
        correction: bool = False,
    ) -> None:
        import discord

        from afl_tipster_bot.services.discord_helpers import result_embed

        channels = await self.ensure_channels(source_guild)
        if channels is None:
            return
        results = channels["results"]
        prefix = "Corrected result from" if correction else "Result from"
        try:
            await results.send(
                content=f"{prefix} **{source_guild.name}**.",
                embed=result_embed(tip),
            )
        except discord.HTTPException:
            self.bot.logger.exception("Failed to mirror result for %s.", tip.get("tip_id"))
