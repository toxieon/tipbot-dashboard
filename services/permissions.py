from __future__ import annotations

import discord

TIPBOT_ADMIN_ROLE = "TipBotAdmin"


def is_discord_administrator(user: discord.abc.User) -> bool:
    """Return whether a Discord interaction user has server Administrator permission."""
    permissions = getattr(user, "guild_permissions", None)
    return bool(permissions and permissions.administrator)


def is_tipbot_administrator(user: discord.abc.User) -> bool:
    if is_discord_administrator(user):
        return True
    roles = getattr(user, "roles", ())
    return any(getattr(role, "name", "") == TIPBOT_ADMIN_ROLE for role in roles)


async def require_discord_administrator(interaction: discord.Interaction) -> bool:
    """Send a private denial after acknowledgement instead of failing a pre-command check."""
    if is_discord_administrator(interaction.user):
        return True

    message = "You need the Discord **Administrator** permission to use this command."
    if interaction.response.is_done():
        await interaction.followup.send(message, ephemeral=True)
    else:
        await interaction.response.send_message(message, ephemeral=True)
    return False


async def require_tipbot_administrator(interaction: discord.Interaction) -> bool:
    if is_tipbot_administrator(interaction.user):
        return True

    message = f"You need the Discord **Administrator** permission or the **{TIPBOT_ADMIN_ROLE}** role."
    if interaction.response.is_done():
        await interaction.followup.send(message, ephemeral=True)
    else:
        await interaction.response.send_message(message, ephemeral=True)
    return False
