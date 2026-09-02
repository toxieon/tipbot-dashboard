from __future__ import annotations


def parse_sport_game(value: str) -> tuple[str, str | None]:
    clean = " ".join(value.split())
    if not clean:
        return "AFL", None
    for separator in ("|", ":"):
        if separator in clean:
            sport, game = clean.split(separator, 1)
            sport = " ".join(sport.split()).upper() or "AFL"
            game = " ".join(game.split()) or None
            return sport, game
    return "AFL", clean


def _decimal_odds(value: str) -> float | None:
    try:
        odds = float(value.strip())
    except ValueError:
        return None
    return odds if odds > 1 else None


def _is_decimal_odds(value: str) -> bool:
    return _decimal_odds(value) is not None


def clean_pasted_bets(value: str) -> tuple[list[str], list[float]]:
    normalized = value.replace("\r\n", "\n").strip()
    if not normalized:
        return [], []

    blocks = [block for block in normalized.split("\n\n") if block.strip()]
    block_lines = [[line.strip() for line in block.splitlines() if line.strip()] for block in blocks]
    recognized = [len(lines) == 3 and _is_decimal_odds(lines[-1]) for lines in block_lines]
    if len(blocks) > 1:
        if all(recognized):
            return [lines[0] for lines in block_lines], [float(lines[-1]) for lines in block_lines]
        if any(recognized):
            raise ValueError(
                "Some pasted bet blocks could not be recognized. Separate each copied bet with a blank line, "
                "or list exactly one finished leg per line."
            )
        return [line for lines in block_lines for line in lines], []

    lines = block_lines[0]
    if len(lines) == 3 and _is_decimal_odds(lines[-1]):
        return [lines[0]], [float(lines[-1])]
    if len(lines) % 3 == 0 and all(_is_decimal_odds(lines[index]) for index in range(2, len(lines), 3)):
        return [lines[index] for index in range(0, len(lines), 3)], [
            float(lines[index]) for index in range(2, len(lines), 3)
        ]
    return lines, []


def clean_pasted_legs(value: str) -> list[str]:
    descriptions, _ = clean_pasted_bets(value)
    return descriptions


def parse_units(value: str) -> float:
    clean = value.strip()
    if not clean:
        return 1.0
    try:
        units = float(clean)
        if units <= 0:
            raise ValueError
    except ValueError as exc:
        raise ValueError("Units must be a number above zero, for example `1` or `0.25`.") from exc
    return units


def parse_delay_minutes(value: str) -> int:
    clean = value.strip()
    if not clean:
        return 0
    try:
        minutes = int(clean)
        if not 0 <= minutes <= 1440:
            raise ValueError
    except ValueError as exc:
        raise ValueError("Post delay must be a whole number from 0 to 1440 minutes.") from exc
    return minutes


def parse_total_odds(odds_value: str, single_pasted_odds: float | None = None) -> float:
    clean = odds_value.strip()
    odds = _decimal_odds(clean) if clean else single_pasted_odds
    if odds is None:
        raise ValueError(
            f"`{odds_value}` is not valid total odds. Use decimal odds above 1.00, "
            "for example `1.33`."
        )
    return odds


def parse_tip_builder(
    legs_value: str,
    odds_value: str,
    units_value: str,
    delay_value: str,
) -> tuple[int, list[str], float, float, int]:
    descriptions, pasted_odds = clean_pasted_bets(legs_value)
    if not descriptions:
        raise ValueError("Enter at least one leg.")
    if len(descriptions) > 20:
        raise ValueError("A tip can have at most 20 legs.")
    single_pasted_odds = pasted_odds[0] if len(descriptions) == 1 and len(pasted_odds) == 1 else None
    odds = parse_total_odds(odds_value, single_pasted_odds)
    return (
        len(descriptions),
        descriptions,
        odds,
        parse_units(units_value),
        parse_delay_minutes(delay_value),
    )


def parse_quick_tip(
    leg_count_value: str,
    legs_value: str,
    odds_value: str,
) -> tuple[int, list[str], float]:
    try:
        count = int(leg_count_value.strip() or "1")
        if not 1 <= count <= 20:
            raise ValueError
    except ValueError as exc:
        raise ValueError("Leg count must be a whole number between 1 and 20.") from exc

    descriptions = clean_pasted_legs(legs_value)
    if len(descriptions) != count:
        raise ValueError(
            f"You entered {count} leg(s), but I found {len(descriptions)} leg(s) after cleaning the paste. "
            "Check the leg count or separate each copied bet with a blank line."
        )
    return count, descriptions, parse_total_odds(odds_value)


def parse_bulk_create(
    amount_value: int,
    legs_value: str,
    odds_value: str,
    units_value: str,
    delay_value: str,
) -> tuple[list[str], list[float], float, int]:
    if not 1 <= amount_value <= 20:
        raise ValueError("Bulk create amount must be between 1 and 20.")
    descriptions, pasted_odds = clean_pasted_bets(legs_value)
    if len(descriptions) != amount_value:
        raise ValueError(
            f"You asked for {amount_value} single(s), but I found {len(descriptions)} after cleaning the paste."
        )

    odds_lines = [line.strip() for line in odds_value.replace("\r\n", "\n").splitlines() if line.strip()]
    if odds_lines:
        parsed_odds = [parse_total_odds(line) for line in odds_lines]
        if len(parsed_odds) == 1 and amount_value > 1:
            parsed_odds = parsed_odds * amount_value
        elif len(parsed_odds) != amount_value:
            raise ValueError("Enter one odds value per single, or one odds value to apply to all singles.")
    elif len(pasted_odds) == amount_value:
        parsed_odds = pasted_odds
    else:
        raise ValueError("Enter odds for each single, or paste Sportsbet-style blocks that include odds.")

    return descriptions, parsed_odds, parse_units(units_value), parse_delay_minutes(delay_value)
