# TipBot business plan visuals (6 Oct 2026)

PNG, 2x. Every image has an "Example data" label. Sources are in `src/`, all built from one data file (`src/data.js`, produced by `gen_data.py` and `build_data.py`). Re-render with `src/shot.sh <page>.html ../<out>.png W H`.

Example data: tipster MidfieldMick (Footy Edge Discord, AFL), 148 settled tips, 87W–61L, strike rate 58.8%, +29.8u from 245.5u staked, ROI +12.1%, last 10 8–2 (W L W W L W W W W W), 5 win streak.
Pending tip: Rd 24 Sydney v Collingwood, Sydney −12.5 @ 1.90 (Sportsbet), 2u.
Follower jess_k ("Jess"): bankroll A$1,284.50, September P&L +A$186.40 (+17.0% on A$1,098.10), 55 bets: Sportsbet 21, TAB 13, Ladbrokes 10, Neds 7, Pointsbet 4.
Tipster P&L for Jess: MidfieldMick +142.80, The Punting Prof +61.20, RaceDayRhi +18.90, Longshot Larry −36.50.
Indicative pricing (Ray / Kevin's model, 6 Oct 2026): Free A$0; My TipBot A$29/yr (about A$2.42/mo billed yearly) or A$3/mo monthly; My TipBot Pro A$8/mo; Tipster free to join, earns 25% of My TipBot subs from followers they bring. Money-flow slide: A$3/mo or A$29/yr, 25% back to the tipster.
Fonts and tools: Inter variable (SIL OFL 1.1, licence in src/fonts), Google Chrome headless for screenshots, Python + Pillow (crop checks only). No third-party JS libraries; charts are hand-written inline SVG.
