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
    {key: "receiving_tds", stat: "Receiving TDs", def: 0.5, max: 4}
  ];
  // NBA and WNBA share one table (same ESPN box score).
  var NBA_PROP_TABS = [
    {key: "points", stat: "Points", def: 19.5, max: 60},
    {key: "rebounds", stat: "Rebounds", def: 6.5, max: 25},
    {key: "assists", stat: "Assists", def: 4.5, max: 20},
    {key: "threes_made", stat: "Threes Made", def: 1.5, max: 12},
    {key: "pra", stat: "Points + Rebounds + Assists", def: 29.5, max: 80}
  ];
  var PROP_LEAGUES = {nfl: true, nba: true, wnba: true};
  var NFL_SKILL = {QB: 1, RB: 1, FB: 1, WR: 1, TE: 1, HB: 1};

  function lg(league) { return String(league || "").toLowerCase(); }
  /** True when TipBot has structured player props for this ESPN league. */
  function hasProps(league) { return !!PROP_LEAGUES[lg(league)]; }
  function isBasketball(league) { var k = lg(league); return k === "nba" || k === "wnba"; }
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
  function visiblePlayers(list, league, search, matches) {
    var out = propPlayers(list, league);
    if (String(search || "").trim()) {
      out = out.filter(function (p) {
        return matches(p.name, p.number, search) || matches(p.position || "", "", search);
      });
    }
    return out.slice().sort(function (a, b) { return String(a.name || "").localeCompare(String(b.name || "")); });
  }
  /** The leg the picker adds (same shape as NFL legs; league is the event's league). */
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
    return leg;
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
  var API = {
    NFL_PROP_TABS: NFL_PROP_TABS, NBA_PROP_TABS: NBA_PROP_TABS, hasProps: hasProps, isBasketball: isBasketball,
    propTabs: propTabs, playersUrl: playersUrl, propPlayers: propPlayers, visiblePlayers: visiblePlayers,
    buildLeg: buildLeg, applyMarketLabels: applyMarketLabels
  };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  root.TBEspnProps = API;
})(typeof window !== "undefined" ? window : globalThis);
