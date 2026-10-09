/* Compare: best price for one player prop, plus nearby lines.
 * Reads odds TipBot has already saved (GET /api/compare, or the player-lines
 * payload already on the page). No new requests of its own.
 * Browser global window.TBCompare + CommonJS export for node --test.
 */
(function (root) {
  "use strict";

  var EXPLAIN = "Best price for this exact line across bookies we have, plus nearby lines.";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return {"&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"}[c];
    });
  }
  function num(v) {
    if (v == null || v === "") return null;
    var n = +v;
    return isFinite(n) ? n : null;
  }
  function normName(s) {
    return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }
  function normStat(s) {
    return String(s || "").toLowerCase().replace(/[^a-z]/g, "").replace(/s$/, "");
  }
  function normBook(s) {
    return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  }
  function playerMatch(a, b) {
    var na = normName(a), nb = normName(b);
    if (!na || !nb) return false;
    if (na === nb) return true;
    var pa = na.split(" "), pb = nb.split(" ");
    if (pa.length < 2 || pb.length < 2) return false;
    return pa.slice(1).join(" ") === pb.slice(1).join(" ") && pa[0].charAt(0) === pb[0].charAt(0);
  }
  function statMatch(a, b) {
    var na = normStat(a), nb = normStat(b);
    return !!na && na === nb;
  }
  function sideOf(pick) {
    return pick && String(pick.side || "").toLowerCase() === "under" ? "Under" : "Over";
  }
  function fmtLine(n) {
    if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
    var r = Math.round(n * 100) / 100;
    return String(r);
  }
  function lineLabel(line, side) {
    var n = num(line);
    if (n == null) return "";
    var text = fmtLine(n);
    return side === "Under" ? "under " + text : text + "+";
  }
  function statShow(stat) {
    return String(stat || "").trim().toLowerCase();
  }
  function propText(pick) {
    if (!pick) return "";
    var bits = [];
    if (pick.player) bits.push(String(pick.player).trim());
    var line = lineLabel(pick.line, sideOf(pick));
    if (line) bits.push(line);
    var st = statShow(pick.stat);
    if (st) bits.push(st);
    return bits.join(" ");
  }
  function summaryFromPick(pick) {
    if (!pick || !pick.player) return "";
    var line = lineLabel(pick.line, sideOf(pick));
    return line ? String(pick.player).trim() + " · " + line : String(pick.player).trim();
  }
  function bookRank(key) {
    var n = normBook(key);
    if (n.indexOf("sportsbet") >= 0 || n === "sb") return 0;
    if (n.indexOf("pointsbet") >= 0 || n === "pb") return 1;
    if (n.indexOf("ladbroke") >= 0 || n === "lad") return 2;
    return 50;
  }
  function bookLabel(key, books) {
    var k = String(key || "");
    var list = books || [];
    var i;
    for (i = 0; i < list.length; i++) {
      if (list[i] && String(list[i].key) === k && list[i].label) return String(list[i].label);
    }
    var n = normBook(k);
    if (n.indexOf("sportsbet") >= 0 || n === "sb") return "Sportsbet";
    if (n.indexOf("pointsbet") >= 0 || n === "pb") return "PointsBet";
    if (n.indexOf("ladbroke") >= 0 || n === "lad") return "Ladbrokes";
    if (!k) return "Book";
    return k.replace(/_/g, " ");
  }
  function fmtPrice(v) {
    var n = num(v);
    if (n == null) return "";
    return n.toFixed(2);
  }
  function lineKey(n) {
    return String(Math.round(n * 1000));
  }
  function sameLine(a, b) {
    return Math.abs(a - b) < 0.001;
  }

  function base(kind, pick) {
    return {
      kind: kind,
      explain: EXPLAIN,
      player: pick && pick.player ? String(pick.player) : "",
      prop: propText(pick),
      summary: summaryFromPick(pick),
      when: pick && pick.when ? String(pick.when) : "",
      exactRows: [],
      nearby: []
    };
  }
  function prompt() { return base("prompt", null); }
  function loading(pick) { return base("loading", pick); }
  function error(pick) { return base("error", pick); }
  function empty(pick) { return base("empty", pick); }

  function pushOffer(list, bookKey, line, over, under, side, books) {
    var price = side === "Under" ? under : over;
    var n = num(line);
    var p = num(price);
    if (n == null || p == null || !(p > 1) || !bookKey) return;
    list.push({
      line: n,
      bookKey: String(bookKey),
      book: bookLabel(bookKey, books),
      price: p,
      side: side
    });
  }

  function fromOffers(pick, offers) {
    var side = sideOf(pick);
    var requested = num(pick && pick.line);
    var dedup = {};
    offers.forEach(function (o) {
      var k = lineKey(o.line) + "|" + normBook(o.bookKey);
      var prev = dedup[k];
      if (!prev || o.price > prev.price) dedup[k] = o;
    });
    var rows = [];
    Object.keys(dedup).forEach(function (k) { rows.push(dedup[k]); });
    if (!rows.length) return empty(pick);

    var byLine = {};
    rows.forEach(function (o) {
      var k = lineKey(o.line);
      if (!byLine[k]) byLine[k] = {line: o.line, rows: []};
      byLine[k].rows.push(o);
    });

    var exactLine = null;
    if (requested != null) {
      Object.keys(byLine).forEach(function (k) {
        if (sameLine(byLine[k].line, requested)) exactLine = byLine[k].line;
      });
    } else {
      var bestCount = -1;
      Object.keys(byLine).forEach(function (k) {
        var g = byLine[k];
        if (g.rows.length > bestCount || (g.rows.length === bestCount && (exactLine == null || g.line < exactLine))) {
          bestCount = g.rows.length;
          exactLine = g.line;
        }
      });
    }

    function rank(list) {
      list.sort(function (a, b) {
        if (b.price !== a.price) return b.price - a.price;
        var d = bookRank(a.bookKey) - bookRank(b.bookKey);
        if (d) return d;
        return String(a.book).localeCompare(String(b.book));
      });
      return list;
    }
    function markBest(list) {
      if (!list.length) return list;
      var top = list[0].price;
      list.forEach(function (r) { r.best = r.price === top; });
      return list;
    }

    var view = base("prices", pick);
    var exactRows = [];
    var nearbyLines = [];
    Object.keys(byLine).forEach(function (k) {
      var g = byLine[k];
      var ranked = rank(g.rows.slice());
      if (exactLine != null && sameLine(g.line, exactLine)) exactRows = markBest(ranked);
      else nearbyLines.push({line: g.line, rows: ranked});
    });
    var anchor = exactLine != null ? exactLine : (requested != null ? requested : 0);
    nearbyLines.sort(function (a, b) {
      var da = Math.abs(a.line - anchor), db = Math.abs(b.line - anchor);
      if (Math.abs(da - db) > 1e-9) return da - db;
      return a.line - b.line;
    });
    view.exactRows = exactRows;
    view.exactQuoted = exactRows.length > 0;
    view.nearby = nearbyLines.map(function (g) {
      return {
        line: g.line,
        title: (lineLabel(g.line, side) + " " + statShow(pick.stat)).trim(),
        rows: g.rows
      };
    });
    return view;
  }

  function fromCompare(data, pick) {
    if (!data || data.available !== true || !pick) return null;
    var side = sideOf(pick);
    var offers = [];
    (data.table || []).forEach(function (row) {
      if (!row) return;
      var cells = row.cells || {};
      Object.keys(cells).forEach(function (key) {
        var cell = cells[key];
        if (!cell) return;
        pushOffer(offers, key, row.line, cell.over, cell.under, side, data.books);
      });
    });
    if (!offers.length) return empty(pick);
    return fromOffers(pick, offers);
  }

  function fromPlayerLines(data, pick) {
    if (!data || !pick || !pick.player) return null;
    var side = sideOf(pick);
    var players = data.players || data.lines || [];
    if (!Array.isArray(players)) return null;
    var offers = [];
    players.forEach(function (p) {
      if (!p || !playerMatch(p.player || p.name, pick.player)) return;
      if (pick.stat && p.stat && !statMatch(p.stat, pick.stat)) return;
      var book = p.bookie || p.bookmaker || p.book || "sportsbet";
      pushOffer(offers, book, p.line, p.over_price, p.under_price, side, null);
      var better = p.better_under || p.betterUnder || null;
      if (better) {
        pushOffer(offers, better.bookie || better.book || better.bookmaker, better.line,
          better.over_price, better.under_price, side, null);
      }
      var by = p.by_bookie || null;
      if (by && typeof by === "object" && !Array.isArray(by)) {
        Object.keys(by).forEach(function (key) {
          var b = by[key] || {};
          var over = b.over_price != null ? b.over_price : b.over;
          var under = b.under_price != null ? b.under_price : b.under;
          pushOffer(offers, b.bookie || key, b.line != null ? b.line : p.line, over, under, side, null);
        });
      }
      if (Array.isArray(p.lines)) {
        p.lines.forEach(function (L) {
          if (!L) return;
          var ls = String(L.side || "Over").toLowerCase() === "under" ? "Under" : "Over";
          if (ls !== side) return;
          var price = L.price != null ? L.price : L.over_price;
          if (side === "Under") pushOffer(offers, L.bookie || book, L.line, null, price, side, null);
          else pushOffer(offers, L.bookie || book, L.line, price, null, side, null);
        });
      }
    });
    if (!offers.length) return null;
    return fromOffers(pick, offers);
  }

  function rowHtml(r, allowBest) {
    var best = !!(allowBest && r.best);
    return '<button type="button" class="compare-row' + (best ? " is-best" : "") + '"'
      + ' data-line="' + esc(r.line) + '" data-side="' + esc(r.side) + '" data-book="' + esc(r.book) + '" data-price="' + esc(r.price) + '">'
      + '<span class="compare-book">' + esc(r.book) + (best ? '<span class="compare-best-tag">Best</span>' : "") + "</span>"
      + '<span class="compare-price">' + esc(fmtPrice(r.price)) + "</span></button>";
  }

  function html(view) {
    view = view || prompt();
    var out = '<p class="compare-lead">' + esc(view.explain || EXPLAIN) + "</p>";
    if (view.kind === "prompt") {
      return out + '<p class="empty">Pick a player and a line, then tap Compare.</p>';
    }
    if (view.prop) out += '<p class="compare-prop">' + esc(view.prop) + "</p>";
    if (view.kind === "loading") return out + '<p class="empty">Loading prices…</p>';
    if (view.kind === "error") {
      return out + '<p class="empty">Couldn\'t load prices. Try again in a moment.</p>'
        + '<button type="button" class="ghost" id="compare-retry">Try again</button>';
    }
    if (view.kind === "empty") {
      return out + '<div class="compare-empty"><p class="compare-empty-title">No prices saved for this yet</p>'
        + '<p class="empty">Nothing is saved for this prop. Bookies with no price are left out.</p></div>';
    }
    out += '<section class="compare-block"><h4>This line</h4>';
    if (!view.exactRows || !view.exactRows.length) {
      out += '<p class="compare-note">No bookie has this exact line saved.</p>';
    } else {
      out += view.exactRows.map(function (r) { return rowHtml(r, true); }).join("");
    }
    out += "</section>";
    if (view.nearby && view.nearby.length) {
      out += '<section class="compare-block"><h4>Nearby lines</h4>';
      view.nearby.forEach(function (g) {
        out += '<p class="compare-line">' + esc(g.title) + "</p>";
        out += (g.rows || []).map(function (r) { return rowHtml(r, false); }).join("");
      });
      out += "</section>";
    }
    if (view.when) out += '<p class="compare-note">As of ' + esc(view.when) + ".</p>";
    return out;
  }

  function summary(view) {
    if (!view || view.kind === "prompt") return "";
    return view.summary || "";
  }

  function samplePick() {
    return {player: "Errol Gulden", stat: "Disposals", line: 25, side: "Over", when: "Wed, 8 Oct, 2:00 pm"};
  }
  function sampleCompare() {
    return {
      ok: true,
      available: true,
      player: "Errol Gulden",
      stat: "Disposals",
      books: [
        {key: "sportsbet", label: "Sportsbet"},
        {key: "pointsbetau", label: "PointsBet"},
        {key: "ladbrokes_au", label: "Ladbrokes"}
      ],
      table: [
        {line: 20, cells: {
          sportsbet: {over: 1.36, under: 2.9},
          pointsbetau: null,
          ladbrokes_au: {over: 1.42, under: 2.75}
        }},
        {line: 25, cells: {
          sportsbet: {over: 1.91, under: 1.91},
          pointsbetau: {over: 1.87, under: 1.95},
          ladbrokes_au: {over: 2.05, under: 1.78}
        }},
        {line: 30, cells: {
          sportsbet: null,
          pointsbetau: {over: 2.8, under: 1.4},
          ladbrokes_au: {over: 2.45, under: 1.52}
        }}
      ]
    };
  }

  var API = {
    EXPLAIN: EXPLAIN,
    esc: esc,
    lineLabel: lineLabel,
    propText: propText,
    summary: summary,
    prompt: prompt,
    loading: loading,
    error: error,
    empty: empty,
    fromCompare: fromCompare,
    fromPlayerLines: fromPlayerLines,
    html: html,
    samplePick: samplePick,
    sampleCompare: sampleCompare,
    playerMatch: playerMatch
  };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  root.TBCompare = API;
})(typeof window !== "undefined" ? window : globalThis);
