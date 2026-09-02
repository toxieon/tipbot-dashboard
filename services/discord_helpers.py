from __future__ import annotations

import json
from typing import Any

import discord

from afl_tipster_bot.database import Database
from afl_tipster_bot.services.common import format_units, iso_now


async def get_channel_ids(database: Database, guild_id: int) -> dict[str, int]:
    row = await database.fetchone("SELECT channel_ids_json FROM guild_settings WHERE guild_id = ?", (guild_id,))
    return json.loads(row["channel_ids_json"]) if row else {}


async def save_channel_ids(database: Database, guild_id: int, channel_ids: dict[str, int]) -> None:
    now = iso_now()
    await database.execute(
        """
        INSERT INTO guild_settings (guild_id, channel_ids_json, created_at, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(guild_id) DO UPDATE SET
            channel_ids_json = excluded.channel_ids_json, updated_at = excluded.updated_at
        """,
        (guild_id, json.dumps(channel_ids), now, now),
    )


async def configured_channel(
    guild: discord.Guild, database: Database, channel_name: str
) -> discord.TextChannel | None:
    channel_ids = await get_channel_ids(database, guild.id)
    channel = guild.get_channel(channel_ids.get(channel_name, 0))
    if isinstance(channel, discord.TextChannel):
        return channel
    channel = discord.utils.get(guild.text_channels, name=channel_name)
    if channel is None and channel_name == "recaps":
        channel = discord.utils.get(guild.text_channels, name="monthly-recap")
    if channel is None and channel_name == "public-bot-commands":
        channel = discord.utils.get(guild.text_channels, name="bot-commands")
    if channel is None and channel_name == "tips":
        channel = discord.utils.get(guild.text_channels, name="afl-tips")
    if channel is None and channel_name == "afl-tips":
        channel = discord.utils.get(guild.text_channels, name="tips")
    return channel


def tip_embed(tip: dict[str, Any], follow_emoji: str = "\U0001FAE1") -> discord.Embed:
    status = tip.get("status", "Pending")
    sport = (tip.get("sport") or "AFL").upper()
    title = f"{chr(0x1F3C9)} AFL PLAY" if sport == "AFL" else f"{sport} PLAY"
    embed = discord.Embed(
        title=title,
        color=discord.Color.orange() if status == "Pending" else discord.Color.blurple(),
    )
    embed.add_field(name="Sport", value=sport, inline=True)
    embed.add_field(name="Type", value=tip["bet_type"], inline=True)
    embed.add_field(name="Bookmaker", value=tip["bookmaker"], inline=True)
    embed.add_field(name="Odds", value=f"{tip['odds']:.2f}", inline=True)
    embed.add_field(name="Units", value=format_units(tip["units"]), inline=True)
    embed.add_field(name="Status", value=status, inline=True)
    if tip.get("game_name"):
        embed.add_field(name="Game", value=tip["game_name"], inline=True)
    if status == "Pending":
        embed.add_field(name="Follow Privately", value=f"React with {follow_emoji}", inline=True)
    legs = tip.get("legs", [])
    add_line_fields(
        embed,
        "Legs",
        [f"{leg['position']}. {leg['description']}" for leg in legs] or ["None"],
        separator="\n\n",
    )
    embed.set_footer(text=f"Tip ID: {tip.get('display_id') or tip['tip_id']}")
    if tip.get("screenshot_url"):
        embed.set_image(url=tip["screenshot_url"])
    return embed


def result_embed(tip: dict[str, Any]) -> discord.Embed:
    profit = tip["profit_units"] or 0
    roi = profit / tip["units"] * 100 if tip["units"] else 0
    color = discord.Color.green() if profit > 0 else discord.Color.red() if profit < 0 else discord.Color.greyple()
    marker = "Win" if profit > 0 else "Loss" if profit < 0 else "Push"
    embed = discord.Embed(title=f"{marker} {tip.get('display_id') or tip['tip_id']}", color=color)
    embed.add_field(name="Result", value=tip["result"], inline=True)
    embed.add_field(name="Odds", value=f"{tip['odds']:.2f}", inline=True)
    embed.add_field(name="Stake", value=f"{format_units(tip['units'])} Unit(s)", inline=True)
    embed.add_field(name="Profit", value=f"{format_units(profit, signed=True)} Units", inline=True)
    embed.add_field(name="ROI", value=f"{roi:+.2f}%", inline=True)
    leg_results = [
        f"{leg['description']}: {leg['leg_result']}"
        for leg in tip.get("legs", [])
        if leg.get("leg_result")
    ]
    if leg_results:
        add_line_fields(embed, "Leg grading", leg_results)
    return embed


def add_line_fields(
    embed: discord.Embed,
    name: str,
    lines: list[str],
    separator: str = "\n",
) -> None:
    chunks: list[str] = []
    current = ""
    for line in lines:
        candidate = f"{current}{separator}{line}".strip()
        if len(candidate) > 1024 and current:
            chunks.append(current)
            current = line
        else:
            current = candidate
    if current:
        chunks.append(current)
    for index, chunk in enumerate(chunks):
        field_name = name if index == 0 else f"{name} (continued)"
        embed.add_field(name=field_name, value=chunk, inline=False)


async def post_admin_log(
    guild: discord.Guild, database: Database, title: str, description: str
) -> None:
    channel = await configured_channel(guild, database, "admin-log")
    if channel:
        await channel.send(
            embed=discord.Embed(
                title=title,
                description=description,
                color=discord.Color.dark_gold(),
            )
        )
