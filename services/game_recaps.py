from __future__ import annotations

import asyncio
import re
from pathlib import Path
from typing import Any

from afl_tipster_bot.calculations import roi_percent
from afl_tipster_bot.database import Database


def summarize_game(game_name: str, tips: list[dict[str, Any]]) -> dict[str, Any]:
    profits = [float(tip["profit_units"] or 0) for tip in tips]
    cumulative = [0.0]
    for profit in profits:
        cumulative.append(round(cumulative[-1] + profit, 4))

    total_staked = sum(float(tip["units"]) for tip in tips)
    total_profit = sum(profits)
    wins = sum(tip["result"] == "Win" for tip in tips)
    return {
        "game_name": game_name,
        "bets": len(tips),
        "wins": wins,
        "losses": sum(tip["result"] == "Loss" for tip in tips),
        "pushes": sum(tip["result"] == "Push" for tip in tips),
        "partial_wins": sum(tip["result"] == "Partial Win" for tip in tips),
        "total_staked": round(total_staked, 4),
        "total_profit": round(total_profit, 4),
        "roi": roi_percent(total_profit, total_staked),
        "strike_rate": round(wins / len(tips) * 100, 2) if tips else 0.0,
        "cumulative_profit": cumulative,
        "tips": tips,
    }


def normalized_game_id(game_name: str) -> str:
    return " ".join(game_name.strip().casefold().split())


class GameRecapService:
    def __init__(self, database: Database, reports_dir: Path):
        self.db = database
        self.reports_dir = reports_dir

    async def build(self, guild_id: int, game_name: str) -> dict[str, Any]:
        clean_name = " ".join(game_name.strip().split())
        if not clean_name:
            raise ValueError("Enter a game name.")
        if len(clean_name) > 100:
            raise ValueError("Game names must be 100 characters or fewer.")

        pending = await self.db.fetchone(
            """
            SELECT COUNT(*) AS count FROM tips
            WHERE guild_id = ? AND deleted_at IS NULL AND status = 'Pending'
              AND LOWER(TRIM(game_name)) = LOWER(?)
            """,
            (guild_id, clean_name),
        )
        if pending and pending["count"]:
            count = pending["count"]
            raise ValueError(
                f"{count} tip{'s are' if count != 1 else ' is'} still unsettled for {clean_name}. "
                "Settle every tip before creating the game recap."
            )

        tips = await self.db.fetchall(
            """
            SELECT * FROM tips
            WHERE guild_id = ? AND deleted_at IS NULL AND status = 'Settled'
              AND LOWER(TRIM(game_name)) = LOWER(?)
            ORDER BY settled_at ASC, created_at ASC
            """,
            (guild_id, clean_name),
        )
        if not tips:
            raise ValueError(
                f"No settled tips were found for {clean_name}. "
                "Use the same game name when creating each tip."
            )
        display_name = tips[0]["game_name"] or clean_name
        return summarize_game(display_name, tips)

    async def suggest_games(self, guild_id: int, current: str) -> list[str]:
        rows = await self.db.fetchall(
            """
            SELECT game_name, MAX(created_at) AS latest
            FROM tips
            WHERE guild_id = ? AND deleted_at IS NULL AND game_name IS NOT NULL
              AND TRIM(game_name) != '' AND LOWER(game_name) LIKE LOWER(?)
            GROUP BY LOWER(TRIM(game_name))
            ORDER BY latest DESC
            LIMIT 25
            """,
            (guild_id, f"%{current}%"),
        )
        return [row["game_name"] for row in rows]

    async def render(self, guild_id: int, recap: dict[str, Any]) -> Path:
        safe_name = re.sub(r"[^a-z0-9]+", "-", normalized_game_id(recap["game_name"])).strip("-")[:80]
        directory = self.reports_dir / str(guild_id) / "game-recaps"
        directory.mkdir(parents=True, exist_ok=True)
        path = directory / f"{safe_name or 'game'}-recap.png"
        return await asyncio.to_thread(self._render, recap, path)

    @staticmethod
    def _render(recap: dict[str, Any], path: Path) -> Path:
        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        import numpy as np
        from matplotlib.colors import LinearSegmentedColormap
        from matplotlib.patches import FancyBboxPatch

        background = "#05091B"
        card_color = "#111A30"
        muted = "#98A6BF"
        accent = "#38D6A0"
        positive = "#38D6A0"
        negative = "#FF7189"

        figure = plt.figure(figsize=(10.8, 13.5), dpi=100, facecolor=background)
        figure.text(
            0.07,
            0.94,
            "GAME RECAP",
            color=muted,
            fontsize=15,
            fontweight="bold",
            family="sans-serif",
        )
        figure.text(
            0.07,
            0.895,
            recap["game_name"][:55],
            color="white",
            fontsize=27,
            fontweight="bold",
            family="sans-serif",
        )
        figure.text(
            0.07,
            0.855,
            "Cumulative profit across settled tips",
            color=muted,
            fontsize=13,
            family="sans-serif",
        )

        chart = figure.add_axes((0.07, 0.39, 0.86, 0.42))
        values = recap["cumulative_profit"]
        x_values = list(range(len(values)))
        low = min(values)
        high = max(values)
        span = max(high - low, 2.0)
        y_min = min(low - span * 0.18, -0.4)
        y_max = max(high + span * 0.18, 0.4)
        x_max = max(len(values) - 1, 1)

        gradient = np.linspace(0, 1, 512).reshape(512, 1)
        gradient = np.repeat(gradient, 2, axis=1)
        cmap = LinearSegmentedColormap.from_list("recap", ["#08B793", "#08E0AE"])
        chart.imshow(
            gradient,
            aspect="auto",
            extent=(-0.2, x_max + 0.2, y_min, y_max),
            origin="lower",
            cmap=cmap,
            zorder=0,
        )
        chart.plot(
            x_values,
            values,
            color="white",
            linewidth=5,
            solid_capstyle="round",
            solid_joinstyle="round",
            zorder=3,
        )
        chart.scatter(
            [x_values[-1]],
            [values[-1]],
            s=145,
            color="white",
            edgecolor=accent,
            linewidth=3,
            zorder=4,
        )
        chart.axhline(0, color="white", linewidth=1.2, alpha=0.5, zorder=1)
        chart.grid(axis="y", color="white", linewidth=1, alpha=0.18)
        chart.set_xlim(-0.2, x_max + 0.2)
        chart.set_ylim(y_min, y_max)
        chart.set_xticks([])
        chart.tick_params(axis="y", colors="white", labelsize=12, length=0, pad=10)
        chart.yaxis.set_major_formatter(lambda value, _position: f"{value:g} U")
        for spine in chart.spines.values():
            spine.set_visible(False)

        metric_specs = (
            ("BETS", str(recap["bets"]), "#5A9CF8"),
            ("PROFIT", f"{recap['total_profit']:+.2f}u", positive if recap["total_profit"] >= 0 else negative),
            ("ROI", f"{recap['roi']:+.2f}%", positive if recap["roi"] >= 0 else negative),
            ("STRIKE RATE", f"{recap['strike_rate']:.2f}%", accent),
        )
        positions = ((0.07, 0.205), (0.53, 0.205), (0.07, 0.055), (0.53, 0.055))
        for (label, value, color), (left, bottom) in zip(metric_specs, positions, strict=True):
            box = FancyBboxPatch(
                (left, bottom),
                0.4,
                0.115,
                boxstyle="round,pad=0.012,rounding_size=0.02",
                transform=figure.transFigure,
                facecolor=card_color,
                edgecolor="#24314C",
                linewidth=1.4,
            )
            figure.patches.append(box)
            figure.text(
                left + 0.2,
                bottom + 0.077,
                label,
                ha="center",
                color=muted,
                fontsize=13,
                family="sans-serif",
            )
            figure.text(
                left + 0.2,
                bottom + 0.035,
                value,
                ha="center",
                color=color,
                fontsize=25,
                fontweight="bold",
                family="sans-serif",
            )

        figure.savefig(path, facecolor=background, bbox_inches=None)
        plt.close(figure)
        return path
