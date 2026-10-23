/* ESPN player-prop picker helpers for the tip builder: NFL (unchanged) + NBA/WNBA (0.40.1).
 * The builder's NFL prop picker is reused for basketball; this file holds the parts that
 * differ by league so node --test can check them. TipBot twin: services/espn.py
 * (NFL_PROP_MARKETS / NBA_PROP_MARKETS). Browser global window.TBEspnProps + CommonJS.
 */
(function (root) {
  "use strict";
  var NFL_PROP_TABS = [
    {key: "passing_yards", stat: "Passing Yards", def: 249.5, max: 450},
    {key: "passing_tds", stat: "Passing TDs", def: 1.5, max: 6},
    {key: "completions", stat: "Completions", def: 22.5, max: 50},
    {key: "interceptions", stat: "Interceptions", def: 0.5, max: 5},
    {key: "rushing_yards", stat: "Rushing Yards", def: 64.5, max: 200},
    {key: "rushing_tds", stat: "Rushing TDs", def: 0.5, max: 4},
    {key: "receiving_yards", stat: "Receiving Yards", def: 54.5, max: 200},
    {key: "receptions", stat: "Receptions", def: 4.5, max: 15},
    {key: "receiving_tds", stat: "Receiving TDs", def: 0.5, max: 4},
    // TipBot grades this as rushing + receiving TDs (services/espn.py anytime_td).
    {key: "anytime_td", stat: "Anytime TD", def: 0.5, max: 4, posFilter: true}
  ];
  var NFL_POSITIONS = ["All", "QB", "RB", "WR", "TE"];
  /** Position bucket for the Anytime TD filter (HB/FB count as RB). */
  function posBucket(p) {
    var x = String((p && p.position) || "").toUpperCase();
    return x === "HB" || x === "FB" ? "RB" : x;
  }
  // NBA, WNBA and NBL share one table (same ESPN box score).
  var NBA_PROP_TABS = [
    {key: "points", stat: "Points", def: 19.5, max: 60},
    {key: "rebounds", stat: "Rebounds", def: 6.5, max: 25},
    {key: "assists", stat: "Assists", def: 4.5, max: 20},
    {key: "threes_made", stat: "Threes Made", def: 1.5, max: 12},
    {key: "pra", stat: "Points + Rebounds + Assists", def: 29.5, max: 80},
    {key: "pa", stat: "Points + Assists", def: 24.5, max: 70},
    {key: "pr", stat: "Points + Rebounds", def: 24.5, max: 70},
    {key: "ra", stat: "Rebounds + Assists", def: 10.5, max: 40},
    // Yes = Over 0.5, No = Under 0.5. TipBot grades it 1/0 from the box score.
    {key: "double_double", stat: "Double Double", def: 0.5, max: 1, yesNo: true}
  ];
  /** Q control on prop rows. Blank = full game (no period on the leg). */
  var PERIODS = ["Q1", "Q2", "Q3", "Q4", "H1", "H2"];
  var PERIOD_OPTIONS = [{value: "", label: "Full"}].concat(PERIODS.map(function (p) { return {value: p, label: p}; }));
  var ORD = {"1": 1, "1st": 1, first: 1, "2": 2, "2nd": 2, second: 2, "3": 3, "3rd": 3, third: 3, "4": 4, "4th": 4, fourth: 4};
  var N = "(1st|2nd|3rd|4th|first|second|third|fourth|[1-4])";
  // Same phrases as TipBot services/periods.py: "1st Qtr", "Q1", "1Q", "first quarter",
  // "quarter 1", "1st Half", "1H", "H2", "second half", "half 2".
  var PERIOD_SRC = "(?:" + N + "\\s*\\.?\\s*(?:quarter|qtr|qrt|qt|q)\\.?" +
    "|(?:quarter|qtr|qrt|qt|q)\\s*([1-4])|quarter\\s+" + N +
    "|(1st|2nd|first|second|[12])\\s*\\.?\\s*(?:half|hlf|h)\\.?|h([12])|half\\s+(1st|2nd|first|second|[12]))";
  function periodRe(flags) { return new RegExp("(^|[^a-z0-9])" + PERIOD_SRC + "(?![a-z0-9])", flags); }
  function codeFrom(m) {
    var q = m[2] || m[3] || m[4];
    if (q) { var n = ORD[q.toLowerCase()]; return n ? "Q" + n : null; }
    var h = m[5] || m[6] || m[7];
    if (h) { var k = ORD[h.toLowerCase()]; return k === 1 || k === 2 ? "H" + k : null; }
    return null;
  }
  /** "Q1".."Q4", "H1", "H2" from a code or bookie wording; "" for blank / full game / unknown. */
  function normalizePeriod(v) {
    var t = String(v == null ? "" : v).replace(/_/g, " ").replace(/\s+/g, " ").trim();
    if (!t) return "";
    if (PERIODS.indexOf(t.toUpperCase()) >= 0) return t.toUpperCase();
    var m = new RegExp("^" + PERIOD_SRC + "$", "i").exec(t);
    // codeFrom reads periodRe groups, which start after its leading boundary group.
    return m ? (codeFrom(["", ""].concat(m.slice(1))) || "") : "";
  }
  /** {period:"Q1", rest:"Points"} from "1st Qtr Points". No (or two different) phrases: period "". */
  function splitPeriodText(text) {
    var raw = String(text == null ? "" : text);
    var re = periodRe("gi"), m, codes = {};
    while ((m = re.exec(raw))) { var c = codeFrom(m); if (c) codes[c] = 1; }
    var keys = Object.keys(codes);
    if (keys.length !== 1) return {period: "", rest: raw};
    var rest = raw.replace(periodRe("gi"), "$1 ")
      .replace(/^\s*[-–—:|,]\s*/, "").replace(/\s*[-–—:|,]\s*$/, "").replace(/\s+/g, " ").trim();
    return {period: keys[0], rest: rest};
  }
  // "Double Double NO", "No Double Double", "To Record A Double Double", "Double Double - Yes".
  var DD_RE = /^(?:(yes|no)\s*[-:]?\s*)?(?:to\s+record\s+(?:a\s+)?)?(double[\s-]*doubles?)(?:\s*[-:(]?\s*(yes|no)\)?)?$/i;
  /** {side:"Over"|"Under"|""} when text is a Double Double market; null otherwise. */
  function parseDoubleDouble(text) {
    var t = String(text == null ? "" : text).replace(/\s+/g, " ").trim();
    var m = DD_RE.exec(t);
    if (!m) return null;
    var yn = (m[1] || m[3] || "").toLowerCase();
    var side = yn === "no" ? "Under" : (yn === "yes" || /^to\s+record/i.test(t.replace(/^(yes|no)\s*[-:]?\s*/i, "")) ? "Over" : "");
    return {side: side};
  }
  /** "Cameron Boozer & Ty Jerome Double Double NO" -> {players:[...], side:"Under"}; null if not DD. */
  function parseDoubleDoubleLine(text) {
    var t = String(text == null ? "" : text).replace(/\s+/g, " ").trim();
    var m = /^(.+?)\s+((?:(?:yes|no)\s+)?(?:to\s+record\s+(?:a\s+)?)?double[\s-]*doubles?.*)$/i.exec(t);
    if (!m) return null;
    var dd = parseDoubleDouble(m[2]);
    var who = m[1].replace(/\s*[-–—:]\s*$/, "").trim();
    if (!dd || !who) return null;
    var tail = /^(.*?)\s+(yes|no)$/i.exec(who);
    if (tail && !dd.side) { dd.side = tail[2].toLowerCase() === "no" ? "Under" : "Over"; who = tail[1]; }
    var players = who.split(/\s+(?:&|and)\s+/i).map(function (x) { return x.trim(); }).filter(Boolean);
    return players.length ? {players: players, side: dd.side} : null;
  }
  var PROP_LEAGUES = {nfl: true, nba: true, wnba: true, nbl: true};
  var NFL_SKILL = {QB: 1, RB: 1, FB: 1, WR: 1, TE: 1, HB: 1};

  function lg(league) { return String(league || "").toLowerCase(); }
  /** True when TipBot has structured player props for this ESPN league. */
  function hasProps(league) { return !!PROP_LEAGUES[lg(league)]; }
  function isBasketball(league) { var k = lg(league); return k === "nba" || k === "wnba" || k === "nbl"; }
  /** Prop tabs for a league (NFL, else the shared basketball table). */
  function propTabs(league) { return lg(league) === "nfl" ? NFL_PROP_TABS : NBA_PROP_TABS; }
  /** TipBot roster URL. NFL keeps its original endpoint so older deploys still work. */
  function playersUrl(league, eventId) {
    var ev = encodeURIComponent(String(eventId == null ? "" : eventId));
    if (lg(league) === "nfl") return "/api/espn/nfl-players?event=" + ev;
    return "/api/espn/players?league=" + encodeURIComponent(lg(league)) + "&event=" + ev;
  }
  /** NFL shows skill positions only (full roster if that empties); basketball shows everyone. */
  function propPlayers(list, league) {
    list = list || [];
    if (lg(league) !== "nfl") return list;
    var filtered = list.filter(function (p) { return NFL_SKILL[String(p.position || "").toUpperCase()]; });
    return filtered.length ? filtered : list;
  }
  /** The displayed list for one team: used by BOTH the render and the button wiring so row ids line up. */
  function visiblePlayers(list, league, search, matches, pos, pinQB) {
    var out = propPlayers(list, league);
    if (pos && pos !== "All") out = out.filter(function (p) { return posBucket(p) === pos; });
    if (String(search || "").trim()) {
      out = out.filter(function (p) {
        return matches(p.name, p.number, search) || matches(p.position || "", "", search);
      });
    }
    out = out.slice().sort(function (a, b) { return String(a.name || "").localeCompare(String(b.name || "")); });
    // Anytime TD: QBs first, everyone else below in the usual order.
    if (pinQB) out = out.filter(function (p) { return posBucket(p) === "QB"; })
      .concat(out.filter(function (p) { return posBucket(p) !== "QB"; }));
    return out;
  }
  /** The leg the picker adds (same shape as NFL legs; league is the event's league). */
  var THREES_PLUS_LINES = [1, 2, 3, 4, 5, 6];
  /** Over/Under threes are .5 lines. A whole number steps down to the .5 below it. */
  function snapHalfLine(line) {
    var n = Number(line);
    if (!isFinite(n)) return null;
    var half = Math.round(n * 2) / 2;
    if (Math.abs(half - Math.round(half)) < 1e-9) half = Math.round(half) - 0.5;
    if (!(half > 0)) return null;
    return half;
  }
  function threesPlusLine(line) {
    var n = Math.round(Number(line));
    return THREES_PLUS_LINES.indexOf(n) >= 0 ? n : null;
  }
  /** TipBot 0.70.24 grades both labels as 3PM: "Threes Made" and "2+ Threes Made". */
  function buildThreesLeg(o) {
    o = o || {};
    var prop = null;
    for (var i = 0; i < NBA_PROP_TABS.length; i++) if (NBA_PROP_TABS[i].key === "threes_made") prop = NBA_PROP_TABS[i];
    if (!prop || !o.player) return null;
    var plus = o.mode === "plus";
    var line = plus ? threesPlusLine(o.line) : snapHalfLine(o.line);
    if (line == null) return null;
    var label = plus ? (line + "+ Threes Made") : "Threes Made";
    var side = plus ? "Over" : (String(o.side || "").toLowerCase() === "under" ? "Under" : "Over");
    var leg = buildLeg({
      player: o.player, team: o.team, prop: { key: "threes_made", stat: label },
      line: line, side: side, league: o.league, eventId: o.eventId, odds: o.odds, period: o.period
    });
    leg.prop = "threes_made";
    leg.prop_key = "threes_made";
    leg.stat = label;
    if (plus) {
      leg.plus = true;
      leg.market = label;
      if (o.player.name) leg.desc = o.player.name + " " + label;
    }
    return leg;
  }
  function buildLeg(o) {
    var leg = {
      player: o.player.name,
      player_id: String(o.player.player_id || o.player.id || ""),
      number: o.player.number || null,
      team: o.team,
      position: o.player.position || "",
      prop: o.prop.key,
      prop_key: o.prop.key,
      stat: o.prop.stat,
      line: o.line,
      side: o.side,
      league: lg(o.league),
      espn_event_id: String(o.eventId),
      game_id: String(o.eventId)
    };
    if (o.odds > 1) leg.odds = o.odds;
    var period = normalizePeriod(o.period);
    if (period) leg.period = period;
    return leg;
  }
  /** Q control beside Over/Under on a prop row (id <rid>_q). Full = whole game: no period on the leg. */
  function periodSelectHtml(rid) {
    return '<label class="qlbl" style="display:inline-flex;align-items:center;gap:4px;color:var(--muted);font-weight:700">Q <select id="' + rid + '_q" class="qsel" aria-label="Period" title="Period (Full = whole game)" style="background:var(--bg2);border:1px solid var(--line);color:var(--txt);border-radius:var(--r-sm);padding:6px 4px;font:inherit">' +
      PERIOD_OPTIONS.map(function (o) { return '<option value="' + o.value + '">' + o.label + '</option>'; }).join("") + '</select></label>';
  }
  /** Leg text with the period and Yes/No wording ("Isaiah Jackson under 2.5 Q1 Points"). */
  function propLegText(l) {
    var stat = (l.period ? l.period + " " : "") + l.stat;
    if ((l.prop_key || l.prop) === "double_double") return l.player + " " + stat + " " + (l.side === "Under" ? "No" : "Yes");
    return l.player + " " + (l.side === "Over" ? l.line + "+ " : "under " + l.line + " ") + stat;
  }
  /** Prefer TipBot's labels when the roster response carries prop_markets. */
  function applyMarketLabels(league, markets) {
    var tabs = propTabs(league);
    (markets || []).forEach(function (m) {
      if (!m || typeof m !== "object") return;
      var hit = tabs.find(function (t) { return t.key === m.key; });
      if (hit && m.stat) hit.stat = m.stat;
    });
    return tabs;
  }
  /** Free-text leg TipBot tracks and grades from the score: line, game total, team total. */
  function teamMarketText(market, team, side, line) {
    var n = Number(line);
    if (String(line == null ? "" : line).trim() === "" || !isFinite(n)) return "";
    var t = String(team || "").trim();
    var sd = String(side || "").toLowerCase() === "under" ? "Under" : "Over";
    if (market === "line") return t ? t + " " + (n > 0 ? "+" : "") + n : "";
    if (market === "total") return n > 0 ? sd + " " + n : "";
    if (market === "team_total") return t && n > 0 ? t + " Team Total " + sd + " " + n : "";
    return "";
  }
  var LINE_LEAGUES = {nfl: true, nba: true, wnba: true, nbl: true};
  function hasLines(league) { return !!LINE_LEAGUES[lg(league)]; }
  var API = {
    teamMarketText: teamMarketText, hasLines: hasLines,
    NFL_PROP_TABS: NFL_PROP_TABS, NBA_PROP_TABS: NBA_PROP_TABS, "hasProps": hasProps, isBasketball: isBasketball,
    propTabs: propTabs, playersUrl: playersUrl, propPlayers: propPlayers, visiblePlayers: visiblePlayers,
    buildLeg: buildLeg, buildThreesLeg: buildThreesLeg, THREES_PLUS_LINES: THREES_PLUS_LINES,
    snapHalfLine: snapHalfLine, applyMarketLabels: applyMarketLabels, NFL_POSITIONS: NFL_POSITIONS, posBucket: posBucket,
    PERIODS: PERIODS, PERIOD_OPTIONS: PERIOD_OPTIONS, normalizePeriod: normalizePeriod, splitPeriodText: splitPeriodText,
    parseDoubleDouble: parseDoubleDouble, parseDoubleDoubleLine: parseDoubleDoubleLine, propLegText: propLegText, periodSelectHtml: periodSelectHtml
  };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  root.TBEspnProps = API;
})(typeof window !== "undefined" ? window : globalThis);
