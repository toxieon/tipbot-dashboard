/* Discover sport chips and card tags.
 * GET /api/discover tipsters currently have no sport breakdown
 * (list_discover_tipsters returns guild_id, display_name, icon_url,
 * settled, wins, losses, units_net, strike, recent_nets, and sometimes form).
 * Preferred field, settled tips only, highest settled first:
 *   sports: [{ "sport": "AFL", "settled": 42 }, { "sport": "NRL", "settled": 9 }]
 * Also read: sport_stats, by_sport, top_sports, sport_counts,
 * stats.sports, stats.by_sport, stats.sport_breakdown, stats.sports_breakdown.
 * If none of those yield a sport, derive from tips[].sport (or league/comp),
 * tips.settled / pending / queued, recent_tips, form.entries, then a single sport string.
 * Browser global window.DiscoverSports + CommonJS for node --test.
 */
(function (root) {
  "use strict";

  var PREFERRED = ["AFL", "Horse Racing", "NRL", "NBA", "NFL", "Soccer"];
  var CANON = {
    AFL: "AFL",
    AUSTRALIANRULES: "AFL",
    AUSSIERULES: "AFL",
    AFLW: "AFLW",
    NRL: "NRL",
    NBA: "NBA",
    WNBA: "WNBA",
    NFL: "NFL",
    NBL: "NBL",
    MLB: "MLB",
    NHL: "NHL",
    SOCCER: "Soccer",
    EPL: "Soccer",
    ALEAGUE: "Soccer",
    PREMIERLEAGUE: "Soccer",
    BUNDESLIGA: "Soccer",
    LALIGA: "Soccer",
    SERIEA: "Soccer",
    MLS: "Soccer",
    HORSERACING: "Horse Racing",
    RACING: "Horse Racing",
    GALLOPS: "Horse Racing",
    HARNESS: "Horse Racing",
    THOROUGHBRED: "Horse Racing",
    HORSES: "Horse Racing",
    CRICKET: "Cricket",
    TENNIS: "Tennis",
    GOLF: "Golf",
    UFC: "UFC/MMA",
    MMA: "UFC/MMA",
    UFCMMA: "UFC/MMA",
    BOXING: "Boxing",
    HOCKEY: "Hockey",
    ICEHOCKEY: "Hockey",
    GREYHOUND: "Greyhounds",
    GREYHOUNDS: "Greyhounds",
    OTHER: "Other",
    CUSTOM: "Other"
  };
  var EXPLICIT = ["sports", "sport_stats", "by_sport", "top_sports", "sport_counts"];
  var STATS_KEYS = ["sports", "by_sport", "sport_breakdown", "sports_breakdown"];
  var COUNT_KEYS = ["settled", "n", "count", "volume", "bets"];
  var REJECT_WORD = /\b(tipster|server|discord|settled|units|strike)\b/i;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return {"&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"}[c];
    });
  }
  function keyOf(name) {
    return String(name == null ? "" : name)
      .trim()
      .toUpperCase()
      .replace(/[/_-]+/g, " ")
      .replace(/[^A-Z0-9]+/g, "");
  }
  function displayOf(raw) {
    var body = String(raw == null ? "" : raw).trim().replace(/\s+/g, " ");
    if (!body) return "";
    var k = keyOf(body);
    if (!k || k === "ALL" || k === "MIXED") return "";
    if (CANON[k]) return CANON[k];
    if (body.length > 24 || /[.!?]/.test(body) || REJECT_WORD.test(body)) return "";
    if (body.split(" ").length > 3) return "";
    return body;
  }
  function marked(name) {
    var api = root.TBSports;
    if (api && typeof api.label === "function") {
      var out = api.label(name);
      if (out) return out;
    }
    return name;
  }
  function emptyBag() {
    return { map: {}, seq: 0 };
  }
  function countOf(entry) {
    if (!entry || typeof entry !== "object") return 1;
    for (var i = 0; i < COUNT_KEYS.length; i++) {
      var raw = entry[COUNT_KEYS[i]];
      if (raw == null || raw === "") continue;
      var n = Number(raw);
      if (Number.isFinite(n)) return n > 0 ? n : 0;
    }
    if (Array.isArray(entry.tips) && entry.tips.length) return entry.tips.length;
    return 1;
  }
  function add(bag, raw, n) {
    var name = displayOf(raw);
    if (!name) return;
    var count = Number(n);
    if (!Number.isFinite(count) || count <= 0) return;
    var row = bag.map[name];
    if (!row) bag.map[name] = { n: count, order: bag.seq++ };
    else row.n += count;
  }
  function rowName(value) {
    if (value.sport != null && String(value.sport).trim()) return value.sport;
    if (value.league != null && String(value.league).trim()) return value.league;
    if (value.comp != null && String(value.comp).trim()) return value.comp;
    if (value.label != null && String(value.label).trim()) return value.label;
    if (value.name != null && String(value.name).trim()) return value.name;
    return "";
  }
  function ingest(bag, value) {
    if (value == null || value === "") return;
    if (Array.isArray(value)) {
      for (var i = 0; i < value.length; i++) ingest(bag, value[i]);
      return;
    }
    if (typeof value === "number") return;
    if (typeof value !== "object") {
      add(bag, value, 1);
      return;
    }
    var named = rowName(value);
    if (named) {
      add(bag, named, countOf(value));
      return;
    }
    var keys = Object.keys(value);
    for (var k = 0; k < keys.length; k++) {
      var key = keys[k];
      if (key === "total" || key === "units" || key === "net" || key === "profit") continue;
      var child = value[key];
      if (typeof child === "number") add(bag, key, child);
      else if (child && typeof child === "object" && !Array.isArray(child)) add(bag, key, countOf(child));
    }
  }
  function flagTrue(v) {
    return v === true || v === 1 || v === "1" || v === "true" || v === "yes";
  }
  function isImport(tip) {
    if (!tip || typeof tip !== "object") return false;
    if (flagTrue(tip.imported) || flagTrue(tip.is_historical)) return true;
    return String(tip.source == null ? "" : tip.source).trim().toLowerCase() === "import";
  }
  function tipSport(tip) {
    if (!tip || typeof tip !== "object" || isImport(tip)) return "";
    if (tip.sport != null && String(tip.sport).trim()) return tip.sport;
    if (tip.league != null && String(tip.league).trim()) return tip.league;
    if (tip.comp != null && String(tip.comp).trim()) return tip.comp;
    return "";
  }
  function hasOwn(obj, key) {
    return !!obj && Object.prototype.hasOwnProperty.call(obj, key) && obj[key] != null;
  }
  function fillExplicit(tipster) {
    var bag = emptyBag();
    var used = false;
    function take(value) {
      var before = Object.keys(bag.map).length;
      ingest(bag, value);
      if (Object.keys(bag.map).length > before) used = true;
    }
    for (var i = 0; i < EXPLICIT.length && !used; i++) {
      if (hasOwn(tipster, EXPLICIT[i])) take(tipster[EXPLICIT[i]]);
    }
    if (!used && tipster.stats && typeof tipster.stats === "object") {
      for (var j = 0; j < STATS_KEYS.length && !used; j++) {
        if (hasOwn(tipster.stats, STATS_KEYS[j])) take(tipster.stats[STATS_KEYS[j]]);
      }
    }
    return used ? bag : null;
  }
  function fillFromTips(tipster) {
    var bag = emptyBag();
    function takeTip(tip) {
      var sport = tipSport(tip);
      if (sport) add(bag, sport, 1);
    }
    var tips = tipster.tips;
    if (Array.isArray(tips)) tips.forEach(takeTip);
    else if (tips && typeof tips === "object") {
      ["settled", "pending", "queued"].forEach(function (key) {
        if (Array.isArray(tips[key])) tips[key].forEach(takeTip);
      });
    }
    if (Array.isArray(tipster.recent_tips)) tipster.recent_tips.forEach(takeTip);
    if (tipster.form && Array.isArray(tipster.form.entries)) tipster.form.entries.forEach(takeTip);
    if (!Object.keys(bag.map).length && tipster.sport != null) add(bag, tipster.sport, 1);
    return bag;
  }
  function bagFor(tipster) {
    if (!tipster || typeof tipster !== "object") return emptyBag();
    return fillExplicit(tipster) || fillFromTips(tipster);
  }
  function ranked(bag) {
    var rows = [];
    Object.keys(bag.map).forEach(function (name) {
      rows.push({ name: name, n: bag.map[name].n, order: bag.map[name].order });
    });
    rows.sort(function (a, b) {
      if (b.n !== a.n) return b.n - a.n;
      var ai = PREFERRED.indexOf(a.name);
      var bi = PREFERRED.indexOf(b.name);
      if (ai < 0) ai = 1000;
      if (bi < 0) bi = 1000;
      if (ai !== bi) return ai - bi;
      if (a.order !== b.order) return a.order - b.order;
      return a.name < b.name ? -1 : (a.name > b.name ? 1 : 0);
    });
    return rows;
  }
  function sportsOf(tipster) {
    return ranked(bagFor(tipster));
  }
  function topSports(tipster, limit) {
    var n = limit == null ? 3 : Number(limit);
    if (!(n > 0)) return [];
    return sportsOf(tipster).slice(0, n).map(function (row) { return row.name; });
  }
  function catalog(list) {
    var seen = {};
    (Array.isArray(list) ? list : []).forEach(function (tipster) {
      sportsOf(tipster).forEach(function (row) { seen[row.name] = true; });
    });
    return Object.keys(seen).sort(function (a, b) {
      var ai = PREFERRED.indexOf(a);
      var bi = PREFERRED.indexOf(b);
      if (ai < 0) ai = 1000;
      if (bi < 0) bi = 1000;
      if (ai !== bi) return ai - bi;
      return a < b ? -1 : (a > b ? 1 : 0);
    });
  }
  function selectedSet(selected) {
    var list = Array.isArray(selected) ? selected : [];
    var out = [];
    list.forEach(function (item) {
      if (item == null || item === "" || item === "All") return;
      var name = displayOf(item) || String(item);
      if (name && name !== "All" && out.indexOf(name) < 0) out.push(name);
    });
    return out;
  }
  function matches(tipster, selected) {
    var want = selectedSet(selected);
    if (!want.length) return true;
    var have = sportsOf(tipster);
    for (var i = 0; i < want.length; i++) {
      for (var j = 0; j < have.length; j++) {
        if (have[j].name === want[i]) return true;
      }
    }
    return false;
  }
  function toggle(selected, sport) {
    if (!sport || sport === "All") return [];
    var cur = selectedSet(selected);
    var name = displayOf(sport) || String(sport);
    var i = cur.indexOf(name);
    if (i >= 0) cur.splice(i, 1);
    else if (name) cur.push(name);
    return cur;
  }
  function chipsHtml(names, selected) {
    var want = selectedSet(selected);
    var allOn = want.length === 0;
    function btn(sport, text, on) {
      return '<button type="button" class="dc-sport' + (on ? " on" : "") + '" data-sport="' + esc(sport) + '" aria-pressed="' + (on ? "true" : "false") + '">' + text + "</button>";
    }
    var html = btn("", "All", allOn);
    (names || []).forEach(function (name) {
      html += btn(name, esc(marked(name)), want.indexOf(name) !== -1);
    });
    return html;
  }
  function tagsHtml(names) {
    var list = names || [];
    if (!list.length) return "";
    return '<div class="dc-sport-tags">' + list.map(function (name) {
      return '<span class="dc-sport-tag">' + esc(marked(name)) + "</span>";
    }).join("") + "</div>";
  }

  var API = {
    PREFERRED: PREFERRED,
    displayOf: displayOf,
    sportsOf: sportsOf,
    topSports: topSports,
    catalog: catalog,
    matches: matches,
    toggle: toggle,
    chipsHtml: chipsHtml,
    tagsHtml: tagsHtml
  };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  root.DiscoverSports = API;
})(typeof window !== "undefined" ? window : globalThis);
