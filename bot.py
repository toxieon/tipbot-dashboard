from __future__ import annotations

import logging

import discord
from discord import app_commands
from discord.ext import commands

from afl_tipster_bot.config import Settings
from afl_tipster_bot.database import Database
from afl_tipster_bot.services.command_safety import CommandSafetyService
from afl_tipster_bot.services.data_ledger import DataLedgerService
from afl_tipster_bot.services.exports import ExportService
from afl_tipster_bot.services.games import GameScheduleService
from afl_tipster_bot.services.game_recaps import GameRecapService
from afl_tipster_bot.services.guild_presence import GuildPresenceService
from afl_tipster_bot.services.master_feed import MasterFeedService
from afl_tipster_bot.services.permissions import is_tipbot_administrator
from afl_tipster_bot.services.report_settings import ReportSettingsService
from afl_tipster_bot.services.reports import ReportService
from afl_tipster_bot.services.subscriptions import SubscriptionService
from afl_tipster_bot.services.tips import TipService

EXTENSIONS = (
    "afl_tipster_bot.cogs.setup",
    "afl_tipster_bot.cogs.tips",
    "afl_tipster_bot.cogs.users",
    "afl_tipster_bot.cogs.reports",
    "afl_tipster_bot.cogs.master",
    "afl_tipster_bot.cogs.squiggle",
)


class TipBotCommandTree(app_commands.CommandTree):
    async def interaction_check(self, interaction: discord.Interaction) -> bool:
        if interaction.guild_id is None:
            return True
        if self.client.settings.master_guild_id == interaction.guild_id:
            return True
        if not await self.client.subscription_service.is_enabled(interaction.guild_id):
            await interaction.response.send_message(
                "TipBot is currently disabled for this server.",
                ephemeral=True,
            )
            return False
        if is_tipbot_administrator(interaction.user):
            return True
        allowed, message = await self.client.command_safety.check(
            interaction.guild_id,
            interaction.user.id,
        )
        if allowed:
            return True
        await interaction.response.send_message(message or "TipBot commands are temporarily blocked.", ephemeral=True)
        return False


class AFLTipsterBot(commands.Bot):
    def __init__(self, settings: Settings):
        intents = discord.Intents.default()
        intents.message_content = settings.enable_message_content_intent
        super().__init__(
            command_prefix=commands.when_mentioned,
            intents=intents,
            tree_cls=TipBotCommandTree,
        )
        self.settings = settings
        self.logger = logging.getLogger("afl_tipster_bot")
        self.database = Database(
            settings.database_path,
            turso_url=settings.turso_database_url,
            turso_auth_token=settings.turso_auth_token,
            turso_sync_path=settings.turso_sync_path,
        )
        self.data_ledger_service = DataLedgerService(self)
        self.export_service = ExportService(self.database)
        self.command_safety = CommandSafetyService(self.database)
        self.subscription_service = SubscriptionService(self.database)
        self.game_schedule_service = GameScheduleService(self.database)
        self.tip_service = TipService(self.database, settings.timezone)
        self.report_service = ReportService(self.database, settings.reports_dir, settings.timezone)
        self.report_settings_service = ReportSettingsService(self.database)
        self.game_recap_service = GameRecapService(self.database, settings.reports_dir)
        self.master_feed_service = MasterFeedService(self)
        self.guild_presence_service = GuildPresenceService(self.database)
        self.tree.on_error = self.on_app_command_error
        self._ready_bootstrap_done = False

    async def setup_hook(self) -> None:
        await self.database.connect()
        await self.guild_presence_service.ensure_schema()
        for extension in EXTENSIONS:
            await self.load_extension(extension)
        await self.master_feed_service.register_persistent_views()
        if self.settings.guild_id:
            guild = discord.Object(id=self.settings.guild_id)
            self.tree.copy_global_to(guild=guild)
            await self.tree.sync(guild=guild)
            self.logger.info("Synced commands to development guild %s", self.settings.guild_id)
        else:
            await self.tree.sync()
            self.logger.info("Synced global commands")

    async def close(self) -> None:
        await self.database.close()
        await super().close()

    async def on_ready(self) -> None:
        self.logger.info("Logged in as %s (%s)", self.user, self.user.id if self.user else "unknown")
        if self._ready_bootstrap_done:
            return
        self._ready_bootstrap_done = True
        for guild in self.guilds:
            if self.settings.master_guild_id == guild.id:
                continue
            try:
                # Full replay after a wipe, recent replay otherwise.
                counts = await self.data_ledger_service.restore_on_startup(guild, recent_limit=750)
            except ValueError:
                continue
            except Exception:
                self.logger.exception("Failed to bootstrap data-store records for guild %s.", guild.id)
                continue
            if counts:
                self.logger.info("Bootstrapped data-store records for guild %s: %s", guild.id, counts)
        # Register master dashboard buttons for every customer server. This is
        # derived from the live guild list, not the database, so the dashboard
        # keeps working even directly after a database wipe.
        try:
            recorded = await self.guild_presence_service.sync_all(self.guilds)
            self.logger.info("Recorded presence for %s guild(s).", recorded)
        except Exception:
            self.logger.exception("Failed to record guild presence.")
        self.master_feed_service.register_guild_views()
        await self.master_feed_service.register_persistent_views()

    async def on_guild_join(self, guild: discord.Guild) -> None:
        try:
            await self.guild_presence_service.mark_present(guild.id, guild.name, guild.member_count)
            self.logger.info("Joined guild %s (%s).", guild.name, guild.id)
        except Exception:
            self.logger.exception("Failed to record guild join for %s.", guild.id)

    async def on_guild_remove(self, guild: discord.Guild) -> None:
        try:
            await self.guild_presence_service.mark_absent(guild.id)
            self.logger.info("Removed from guild %s (%s).", guild.name, guild.id)
        except Exception:
            self.logger.exception("Failed to record guild removal for %s.", guild.id)

    async def on_app_command_error(
        self, interaction: discord.Interaction, error: app_commands.AppCommandError
    ) -> None:
        original = getattr(error, "original", error)
        command_name = interaction.command.qualified_name if interaction.command else "unknown"
        self.logger.error(
            "Application command failed: command=%s user=%s guild=%s error=%r",
            command_name,
            interaction.user.id,
            interaction.guild_id,
            original,
            exc_info=(type(original), original, original.__traceback__),
        )
        if isinstance(error, app_commands.CheckFailure) and interaction.response.is_done():
            return
        if isinstance(error, app_commands.MissingPermissions):
            message = "Administrator permission is required."
        elif isinstance(error, app_commands.NoPrivateMessage):
            message = "This command can only be used inside a Discord server."
        elif isinstance(error, app_commands.CommandSignatureMismatch):
            message = (
                "Discord has an outdated copy of this command. The bot has logged the issue; "
                "try again after command syncing completes."
            )
        elif isinstance(original, ValueError):
            message = str(original)
        else:
            message = "Something went wrong. The error has been logged."
        try:
            if interaction.response.is_done():
                await interaction.followup.send(message, ephemeral=True)
            else:
                await interaction.response.send_message(message, ephemeral=True)
        except discord.HTTPException:
            self.logger.exception(
                "Could not send command error response: command=%s user=%s guild=%s",
                command_name,
                interaction.user.id,
                interaction.guild_id,
            )


def run() -> None:
    """Entry point used by run.py and webserver.py."""
    settings = Settings.from_env()
    logging.basicConfig(
        level=getattr(logging, settings.log_level, logging.INFO),
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    )
    AFLTipsterBot(settings).run(settings.token, log_handler=None)
