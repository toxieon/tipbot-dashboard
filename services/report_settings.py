from __future__ import annotations

import json
from typing import Any

from afl_tipster_bot.database import Database
from afl_tipster_bot.services.common import iso_now


REPORT_FIELD_LABELS = {
    "total_tips": "Total Tips",
    "record": "Wins / Losses / Pushes",
    "strike_rate": "Strike Rate",
    "total_units_staked": "Total Units Staked",
    "total_profit": "Total Profit",
    "total_roi": "Total ROI",
    "units_won": "Units Won",
    "units_lost": "Units Lost",
    "best_bet": "Best Bet",
    "worst_bet": "Worst Bet",
    "best_game": "Best Game",
    "worst_game": "Worst Game",
    "most_profitable_team": "Most Profitable Team",
    "least_profitable_team": "Least Profitable Team",
    "most_profitable_bet_type": "Most Profitable Bet Type",
    "least_profitable_bet_type": "Least Profitable Bet Type",
    "best_bookmaker": "Best Bookmaker",
    "worst_bookmaker": "Worst Bookmaker",
    "average_odds": "Average Odds",
    "average_stake": "Average Stake",
    "biggest_roi_tip": "Best ROI Tip",
}

GRAPH_TYPE_LABELS = {
    "cumulative-profit": "Cumulative Profit",
    "bet-by-bet-profit": "Bet-by-Bet Profit",
    "roi": "Running ROI",
    "win-loss-ratio": "Win/Loss Ratio",
    "bet-type-performance": "Bet Type Performance",
    "bookmaker-profit": "Bookmaker Profit",
    "sport-profit": "Sport Profit",
    "stake-vs-profit": "Stake vs Profit",
}

DEFAULT_REPORT_FIELDS = tuple(REPORT_FIELD_LABELS)
DEFAULT_GRAPH_TYPES = tuple(GRAPH_TYPE_LABELS)


def normalize_report_settings(raw: dict[str, Any] | None = None) -> dict[str, list[str]]:
    raw = raw or {}
    fields = [field for field in raw.get("fields", DEFAULT_REPORT_FIELDS) if field in REPORT_FIELD_LABELS]
    graphs = [graph for graph in raw.get("graphs", DEFAULT_GRAPH_TYPES) if graph in GRAPH_TYPE_LABELS]
    return {
        "fields": fields or list(DEFAULT_REPORT_FIELDS),
        "graphs": graphs or list(DEFAULT_GRAPH_TYPES),
    }


class ReportSettingsService:
    def __init__(self, database: Database):
        self.db = database

    async def get(self, guild_id: int) -> dict[str, list[str]]:
        row = await self.db.fetchone(
            "SELECT report_settings_json FROM guild_settings WHERE guild_id = ?",
            (guild_id,),
        )
        if not row:
            return normalize_report_settings()
        try:
            raw = json.loads(row["report_settings_json"] or "{}")
        except json.JSONDecodeError:
            raw = {}
        return normalize_report_settings(raw)

    async def set(self, guild_id: int, fields: list[str], graphs: list[str]) -> dict[str, list[str]]:
        settings = normalize_report_settings({"fields": fields, "graphs": graphs})
        now = iso_now()
        await self.db.execute(
            """
            INSERT INTO guild_settings
                (guild_id, channel_ids_json, report_settings_json, created_at, updated_at)
            VALUES (?, '{}', ?, ?, ?)
            ON CONFLICT(guild_id) DO UPDATE SET
                report_settings_json = excluded.report_settings_json,
                updated_at = excluded.updated_at
            """,
            (guild_id, json.dumps(settings), now, now),
        )
        return settings

    async def set_fields(self, guild_id: int, fields: list[str]) -> dict[str, list[str]]:
        current = await self.get(guild_id)
        return await self.set(guild_id, fields, current["graphs"])

    async def set_graphs(self, guild_id: int, graphs: list[str]) -> dict[str, list[str]]:
        current = await self.get(guild_id)
        return await self.set(guild_id, current["fields"], graphs)
