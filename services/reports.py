from __future__ import annotations

import asyncio
import json
from collections import defaultdict
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from afl_tipster_bot.calculations import roi_percent
from afl_tipster_bot.database import Database
from afl_tipster_bot.services.common import iso_now


def _extreme_name(values: dict[str, float], best: bool) -> str:
    if not values:
        return "N/A"
    function = max if best else min
    key = function(values, key=values.get)
    return f"{key} ({values[key]:+.2f}u)"


def _parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    normalized = value.strip().replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed


class ReportService:
    def __init__(self, database: Database, reports_dir: Path, timezone: ZoneInfo):
        self.db = database
        self.reports_dir = reports_dir
        self.timezone = timezone

    def local_month_boundaries(self, year: int, month: int) -> tuple[datetime, datetime]:
        start = datetime(year, month, 1, tzinfo=self.timezone)
        if month == 12:
            end = datetime(year + 1, 1, 1, tzinfo=self.timezone)
        else:
            end = datetime(year, month + 1, 1, tzinfo=self.timezone)
        return start, end

    def boundaries(self, year: int, month: int) -> tuple[str, str]:
        start, end = self.local_month_boundaries(year, month)
        return start.astimezone(UTC).isoformat(), end.astimezone(UTC).isoformat()

    def week_boundaries(self, weeks_ago: int) -> tuple[datetime, datetime]:
        local_now = datetime.now(self.timezone)
        start = (local_now - timedelta(days=local_now.weekday() + (weeks_ago * 7))).replace(
            hour=0,
            minute=0,
            second=0,
            microsecond=0,
        )
        return start, start + timedelta(days=7)

    async def _settled_tip_rows(self, guild_id: int) -> list[dict[str, Any]]:
        return await self.db.fetchall(
            """
            SELECT * FROM tips
            WHERE guild_id = ? AND status = 'Settled' AND deleted_at IS NULL
            ORDER BY settled_at ASC, created_at ASC
            """,
            (guild_id,),
        )

    def _tips_in_range(
        self,
        rows: list[dict[str, Any]],
        start: datetime,
        end: datetime,
    ) -> tuple[list[dict[str, Any]], int, int]:
        tips: list[dict[str, Any]] = []
        missing_settled_at = 0
        invalid_settled_at = 0
        for row in rows:
            settled_at = row.get("settled_at")
            parsed = _parse_datetime(settled_at)
            if parsed is None:
                if settled_at:
                    invalid_settled_at += 1
                else:
                    missing_settled_at += 1
                continue
            local_settled_at = parsed.astimezone(self.timezone)
            if start <= local_settled_at < end:
                row["settled_at_local"] = local_settled_at.isoformat()
                tips.append(row)
        return tips, missing_settled_at, invalid_settled_at

    async def _build_range(self, guild_id: int, start: datetime, end: datetime) -> dict[str, Any]:
        all_settled_tips = await self._settled_tip_rows(guild_id)
        tips, missing_settled_at, invalid_settled_at = self._tips_in_range(
            all_settled_tips,
            start,
            end,
        )
        type_profit: dict[str, float] = defaultdict(float)
        game_profit: dict[str, float] = defaultdict(float)
        team_profit: dict[str, float] = defaultdict(float)
        bookmaker_profit: dict[str, float] = defaultdict(float)
        sport_profit: dict[str, float] = defaultdict(float)
        for tip in tips:
            profit = tip["profit_units"] or 0
            type_profit[tip["bet_type"]] += profit
            bookmaker_profit[tip["bookmaker"]] += profit
            sport_profit[tip.get("sport") or "AFL"] += profit
            if tip["game_name"]:
                game_profit[tip["game_name"]] += profit
            legs = await self.db.fetchall(
                "SELECT metadata_json FROM tip_legs WHERE tip_id = ?", (tip["tip_id"],)
            )
            for leg in legs:
                metadata = json.loads(leg["metadata_json"])
                if metadata.get("team"):
                    team_profit[metadata["team"]] += profit / max(len(legs), 1)

        total_staked = sum(tip["units"] for tip in tips)
        total_profit = sum(tip["profit_units"] or 0 for tip in tips)
        wins = sum(tip["result"] == "Win" for tip in tips)
        losses = sum(tip["result"] == "Loss" for tip in tips)
        pushes = sum(tip["result"] == "Push" for tip in tips)
        best = max(tips, key=lambda row: row["profit_units"] or 0, default=None)
        worst = min(tips, key=lambda row: row["profit_units"] or 0, default=None)
        best_roi = max(
            tips,
            key=lambda row: ((row["profit_units"] or 0) / row["units"]) if row["units"] else -999999,
            default=None,
        )
        return {
            "total_tips": len(tips),
            "wins": wins,
            "losses": losses,
            "pushes": pushes,
            "partial_wins": sum(tip["result"] == "Partial Win" for tip in tips),
            "strike_rate": round(wins / len(tips) * 100, 2) if tips else 0,
            "total_units_staked": round(total_staked, 4),
            "total_profit": round(total_profit, 4),
            "total_roi": roi_percent(total_profit, total_staked),
            "units_won": round(sum(max(tip["profit_units"] or 0, 0) for tip in tips), 4),
            "units_lost": round(abs(sum(min(tip["profit_units"] or 0, 0) for tip in tips)), 4),
            "best_bet": (best.get("display_id") or best["tip_id"]) if best else "N/A",
            "worst_bet": (worst.get("display_id") or worst["tip_id"]) if worst else "N/A",
            "best_game": _extreme_name(game_profit, True),
            "worst_game": _extreme_name(game_profit, False),
            "most_profitable_team": _extreme_name(team_profit, True),
            "least_profitable_team": _extreme_name(team_profit, False),
            "most_profitable_bet_type": _extreme_name(type_profit, True),
            "least_profitable_bet_type": _extreme_name(type_profit, False),
            "best_bookmaker": _extreme_name(bookmaker_profit, True),
            "worst_bookmaker": _extreme_name(bookmaker_profit, False),
            "most_profitable_sport": _extreme_name(sport_profit, True),
            "least_profitable_sport": _extreme_name(sport_profit, False),
            "average_odds": round(sum(tip["odds"] for tip in tips) / len(tips), 2) if tips else 0,
            "average_stake": round(total_staked / len(tips), 4) if tips else 0,
            "biggest_roi_tip": (
                f"{best_roi.get('display_id') or best_roi['tip_id']} "
                f"({roi_percent(best_roi['profit_units'] or 0, best_roi['units']):+.2f}%)"
                if best_roi
                else "N/A"
            ),
            "tips": tips,
            "bet_type_profit": dict(type_profit),
            "bookmaker_profit": dict(bookmaker_profit),
            "sport_profit": dict(sport_profit),
            "stored_settled_tips": len(all_settled_tips),
            "skipped_missing_settled_at": missing_settled_at,
            "skipped_invalid_settled_at": invalid_settled_at,
            "period_start": start.isoformat(),
            "period_end": end.isoformat(),
            "diagnostic_note": self._diagnostic_note(
                tips,
                all_settled_tips,
                missing_settled_at,
                invalid_settled_at,
            ),
        }

    async def build(self, guild_id: int, year: int, month: int) -> dict[str, Any]:
        start, end = self.local_month_boundaries(year, month)
        report = await self._build_range(guild_id, start, end)
        report.update(
            {
                "year": year,
                "month": month,
                "title": f"Monthly Recap - {year}-{month:02d}",
                "report_id": f"{year}-{month:02d}",
            }
        )
        await self.db.execute(
            """
            INSERT INTO monthly_reports
                (guild_id, year, month, report_json, profit, roi, units_won, units_lost, generated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(guild_id, year, month) DO UPDATE SET
                report_json = excluded.report_json, profit = excluded.profit,
                roi = excluded.roi, units_won = excluded.units_won,
                units_lost = excluded.units_lost, generated_at = excluded.generated_at
            """,
            (
                guild_id,
                year,
                month,
                json.dumps({key: value for key, value in report.items() if key != "tips"}),
                report["total_profit"],
                report["total_roi"],
                report["units_won"],
                report["units_lost"],
                iso_now(),
            ),
        )
        return report

    async def build_week(self, guild_id: int, weeks_ago: int = 0) -> dict[str, Any]:
        start, end = self.week_boundaries(weeks_ago)
        report = await self._build_range(guild_id, start, end)
        end_inclusive = end - timedelta(days=1)
        report.update(
            {
                "title": f"Weekly Recap - {start:%d %b} to {end_inclusive:%d %b %Y}",
                "report_id": f"week-{start:%Y-%m-%d}",
                "period_start": start.isoformat(),
                "period_end": end.isoformat(),
            }
        )
        return report

    def _diagnostic_note(
        self,
        period_tips: list[dict[str, Any]],
        all_settled_tips: list[dict[str, Any]],
        missing_settled_at: int,
        invalid_settled_at: int,
    ) -> str | None:
        notes: list[str] = []
        if not period_tips and not all_settled_tips:
            notes.append(
                "No settled tips are currently stored in the bot database. If Discord still shows result posts, "
                "the Render free filesystem was likely reset and the recap cannot recover those old rows."
            )
        elif not period_tips:
            notes.append(
                f"The database has {len(all_settled_tips)} settled tip(s), but none settled inside this recap period."
            )
        skipped = missing_settled_at + invalid_settled_at
        if skipped:
            notes.append(
                f"{skipped} settled tip(s) were skipped because their settled date is missing or unreadable."
            )
        return "\n".join(notes) if notes else None

    async def diagnostics(self, guild_id: int, year: int, month: int) -> dict[str, Any]:
        start, end = self.local_month_boundaries(year, month)
        status_rows = await self.db.fetchall(
            """
            SELECT status, COUNT(*) AS count
            FROM tips
            WHERE guild_id = ? AND deleted_at IS NULL
            GROUP BY status
            ORDER BY status
            """,
            (guild_id,),
        )
        total_row = await self.db.fetchone(
            "SELECT COUNT(*) AS count FROM tips WHERE guild_id = ?",
            (guild_id,),
        )
        all_settled_tips = await self._settled_tip_rows(guild_id)
        period_tips, missing_settled_at, invalid_settled_at = self._tips_in_range(
            all_settled_tips,
            start,
            end,
        )
        parsed_dates = [
            parsed
            for parsed in (_parse_datetime(tip.get("settled_at")) for tip in all_settled_tips)
            if parsed is not None
        ]
        parsed_dates.sort()
        return {
            "database_path": str(self.db.path),
            "total_tips": total_row["count"] if total_row else 0,
            "status_counts": {row["status"]: row["count"] for row in status_rows},
            "stored_settled_tips": len(all_settled_tips),
            "period_tips": len(period_tips),
            "missing_settled_at": missing_settled_at,
            "invalid_settled_at": invalid_settled_at,
            "first_settled_at": parsed_dates[0].astimezone(self.timezone).isoformat()
            if parsed_dates
            else None,
            "last_settled_at": parsed_dates[-1].astimezone(self.timezone).isoformat()
            if parsed_dates
            else None,
            "period_start": start.isoformat(),
            "period_end": end.isoformat(),
            "note": self._diagnostic_note(
                period_tips,
                all_settled_tips,
                missing_settled_at,
                invalid_settled_at,
            ),
        }

    async def graphs(
        self,
        guild_id: int,
        report: dict[str, Any],
        graph_types: list[str] | None = None,
    ) -> list[Path]:
        directory = self.reports_dir / str(guild_id) / report["report_id"]
        directory.mkdir(parents=True, exist_ok=True)
        return await asyncio.to_thread(self._render_graphs, report, directory, graph_types)

    @staticmethod
    def _render_graphs(
        report: dict[str, Any],
        directory: Path,
        graph_types: list[str] | None = None,
    ) -> list[Path]:
        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        tips = report["tips"]
        enabled = set(graph_types or [
            "cumulative-profit",
            "bet-by-bet-profit",
            "roi",
            "win-loss-ratio",
            "bet-type-performance",
        ])
        profits = [tip["profit_units"] or 0 for tip in tips]
        cumulative: list[float] = []
        total = 0.0
        for profit in profits:
            total += profit
            cumulative.append(total)
        x_values = list(range(1, len(tips) + 1))
        created: list[Path] = []

        def save(name: str, title: str) -> None:
            path = directory / f"{name}.png"
            plt.title(title)
            plt.tight_layout()
            plt.savefig(path, dpi=160)
            plt.close()
            created.append(path)

        if "cumulative-profit" in enabled:
            plt.figure()
            plt.plot(x_values, cumulative, marker="o")
            plt.axhline(0, color="black", linewidth=0.8)
            plt.xlabel("Bet")
            plt.ylabel("Cumulative profit (units)")
            save("cumulative-profit", "Cumulative Profit")

        if "bet-by-bet-profit" in enabled:
            plt.figure()
            plt.bar(x_values, profits, color=["#2eaf62" if value >= 0 else "#d44747" for value in profits])
            plt.xlabel("Bet")
            plt.ylabel("Profit (units)")
            save("bet-by-bet-profit", "Bet-by-Bet Profit")

        running_roi: list[float] = []
        running_profit = running_stake = 0.0
        for tip in tips:
            running_profit += tip["profit_units"] or 0
            running_stake += tip["units"]
            running_roi.append(roi_percent(running_profit, running_stake))
        if "roi" in enabled:
            plt.figure()
            plt.plot(x_values, running_roi, marker="o", color="#8557d3")
            plt.axhline(0, color="black", linewidth=0.8)
            plt.xlabel("Bet")
            plt.ylabel("ROI (%)")
            save("roi", "Running ROI")

        if "win-loss-ratio" in enabled:
            plt.figure()
            values = [report["wins"], report["losses"], report["pushes"], report["partial_wins"]]
            labels = ["Wins", "Losses", "Pushes", "Partial Wins"]
            if sum(values):
                plt.pie(values, labels=labels, autopct="%1.0f%%")
            else:
                plt.text(0.5, 0.5, "No settled tips", ha="center", va="center")
                plt.axis("off")
            save("win-loss-ratio", "Win/Loss Ratio")

        if "bet-type-performance" in enabled:
            plt.figure()
            type_names = list(report["bet_type_profit"])
            type_values = [report["bet_type_profit"][name] for name in type_names]
            if type_names:
                plt.bar(type_names, type_values)
                plt.xticks(rotation=20, ha="right")
            else:
                plt.text(0.5, 0.5, "No settled tips", ha="center", va="center")
                plt.axis("off")
            plt.ylabel("Profit (units)")
            save("bet-type-performance", "Bet Type Performance")

        if "bookmaker-profit" in enabled:
            plt.figure()
            names = list(report["bookmaker_profit"])
            values = [report["bookmaker_profit"][name] for name in names]
            if names:
                plt.bar(names, values, color="#2f7ed8")
                plt.xticks(rotation=20, ha="right")
            else:
                plt.text(0.5, 0.5, "No settled tips", ha="center", va="center")
                plt.axis("off")
            plt.ylabel("Profit (units)")
            save("bookmaker-profit", "Bookmaker Profit")

        if "sport-profit" in enabled:
            plt.figure()
            names = list(report["sport_profit"])
            values = [report["sport_profit"][name] for name in names]
            if names:
                plt.bar(names, values, color="#0fa987")
            else:
                plt.text(0.5, 0.5, "No settled tips", ha="center", va="center")
                plt.axis("off")
            plt.ylabel("Profit (units)")
            save("sport-profit", "Sport Profit")

        if "stake-vs-profit" in enabled:
            plt.figure()
            stakes = [tip["units"] for tip in tips]
            if stakes:
                plt.scatter(stakes, profits, color="#8557d3")
                plt.axhline(0, color="black", linewidth=0.8)
            else:
                plt.text(0.5, 0.5, "No settled tips", ha="center", va="center")
                plt.axis("off")
            plt.xlabel("Stake (units)")
            plt.ylabel("Profit (units)")
            save("stake-vs-profit", "Stake vs Profit")
        return created
