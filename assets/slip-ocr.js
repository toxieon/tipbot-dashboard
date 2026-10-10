/* Client-side bet-slip OCR parsers (Sportsbet, Ladbrokes, Neds, TAB, Pointsbet).
 * Browser global TBSlipOcr + CommonJS for node --test. No console.*.
 */
(function (root) {
  "use strict";

  var MARKET_RE = /^(head\s*to\s*head|line|margin|total\s*(?:points|goals|match)|handicap|match\s*result|winner|1st\s*goal|any\s*time\s*goalscorer|\d+\+\s*(?:disposals?|goals?|marks?|tackles?|kicks?|hitouts?|fantasy|points?|rebounds?|assists?|threes?|steals?|blocks?)|over\s*\d|under\s*\d|to\s*score)/i;
  var RESPONSIBLE_RE = /think\.|deposit\s*limit|gamble\s*responsibly|set\s*a\s*limit/i;
  var EVENT_RE = /^(.+?)\s+v\s+(.+)$/i;
  var DATE_RE = /^(?:mon|tues|wednes|thurs|fri|satur|sun)day\b|^\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i;

  function normalizeText(text) {
    return String(text || "")
      .replace(/^\uFEFF/, "")
      .replace(/\r\n/g, "\n")
      .replace(/[|]/g, "I")
      .replace(/\u2019/g, "'")
      .trim();
  }

  function linesOf(text) {
    return normalizeText(text)
      .split("\n")
      .map(function (l) {
        return l.replace(/\s+/g, " ").trim();
      })
      .filter(Boolean);
  }

  function cleanSelectionLine(line) {
    return String(line || "")
      .replace(/^[^\w(']+/, "")
      .replace(/^\d+\]\s*/, "")
      .replace(/^o\s+/i, "")
      .replace(/^SO\s+/i, "")
      .replace(/^\d+\s+(?=[A-Za-z])/,"")
      .trim();
  }

  function detectBookie(text) {
    var low = normalizeText(text).toLowerCase();
    if (/\bsportsbet\b/.test(low) || /\bsports\s*bet\b/.test(low) || /^sports\b/m.test(low)) return "sportsbet";
    if (/\bladbrokes\b/.test(low)) return "ladbrokes";
    if (/\bneds\b/.test(low)) return "neds";
    if (/\bpointsbet\b|\bpoints\s*bet\b/.test(low)) return "pointsbet";
    if (/\btab\b/.test(low) && !/\btable\b/.test(low)) return "tab";
    return "unknown";
  }

  function parseBetTypeLine(line) {
    var m = String(line || "").match(/(same\s*game\s*multi|sgm|multi(?:\s*bet)?|single)\b[^@]*@\s*([\d.]+)/i);
    if (!m) {
      m = String(line || "").match(/(same\s*game\s*multi|sgm|multi(?:\s*bet)?|single)\b/i);
      if (!m) return null;
      var oddsM = String(line || "").match(/@\s*([\d.]+)/);
      return {
        bet_type: normalizeBetType(m[1]),
        odds: oddsM ? parseFloat(oddsM[1]) : null,
      };
    }
    return { bet_type: normalizeBetType(m[1]), odds: parseFloat(m[2]) };
  }

  function normalizeBetType(raw) {
    var s = String(raw || "").toLowerCase().replace(/\s+/g, " ");
    if (s.indexOf("same game") >= 0 || s === "sgm") return "Same Game Multi";
    if (s.indexOf("single") >= 0) return "Single";
    return "Multi";
  }

  function parseLegCount(lines) {
    for (var i = 0; i < lines.length; i++) {
      var m = lines[i].match(/(\d+)\s*legs?\b/i);
      if (m) return parseInt(m[1], 10);
    }
    return null;
  }

  function findEventLine(lines) {
    for (var i = 0; i < lines.length; i++) {
      var cleaned = cleanSelectionLine(lines[i]);
      if (EVENT_RE.test(cleaned) && !DATE_RE.test(cleaned)) return cleaned;
    }
    return "";
  }

  function findDateTimeLine(lines) {
    for (var i = 0; i < lines.length; i++) {
      if (DATE_RE.test(lines[i])) return lines[i];
    }
    return "";
  }

  function isMarketLine(line) {
    var c = cleanSelectionLine(line);
    if (!c) return false;
    if (MARKET_RE.test(c)) return true;
    if (/^\d+\s*\+\s*/.test(c)) return true;
    return false;
  }

  function normalizeMarket(line) {
    var c = cleanSelectionLine(line);
    if (/^head\s*to\s*head$/i.test(c)) return "Head to Head";
    var plus = c.match(/^(\d+)\s*\+\s*(disposals?|goals?|marks?|tackles?|kicks?|hitouts?|fantasy|points?)/i);
    if (plus) {
      var stat = plus[2].charAt(0).toUpperCase() + plus[2].slice(1).toLowerCase();
      if (stat.toLowerCase().indexOf("disposal") >= 0) stat = "Disposals";
      if (stat.toLowerCase().indexOf("goal") >= 0 && stat !== "Goals") stat = "Goals";
      return plus[1] + "+ " + stat;
    }
    return c;
  }

  function isHeaderNoise(line) {
    if (!line) return true;
    if (/^proposed\s*bet$/i.test(line)) return true;
    if (/^p\d+$/i.test(line)) return true;
    if (parseBetTypeLine(line)) return true;
    if (/^\d+\s*legs?$/i.test(line)) return true;
    if (/\bsportsbet\b/i.test(line)) return true;
    if (/^sports$/i.test(line)) return true;
    if (/^v$/i.test(line)) return true;
    return false;
  }

  function makeParsedLeg(selection, market, event, dateTime) {
    var ev = String(event || "").trim();
    return {
      selection: String(selection || "").trim(),
      market: String(market || "").trim(),
      event: ev,
      date_time: String(dateTime || "").trim(),
      sport: detectSport(ev, [{ selection: selection, market: market }]),
    };
  }

  function pushLeg(legs, selection, market, event, dateTime) {
    if (!selection && !market) return;
    legs.push(makeParsedLeg(selection, market, event, dateTime));
  }

  function bodyStartIndex(lines) {
    for (var i = 0; i < lines.length; i++) {
      if (/^\d+\s*legs?\b/i.test(lines[i])) return i + 1;
    }
    for (var j = 0; j < lines.length; j++) {
      if (parseBetTypeLine(lines[j])) return j + 1;
    }
    return 0;
  }

  /** Same-game multi: one event header, then selection/market pairs. */
  function extractLegsSgm(lines, headerEvent, headerDate) {
    var start = bodyStartIndex(lines);
    var dateIdx = -1;
    for (var i = start; i < lines.length; i++) {
      if (DATE_RE.test(lines[i])) {
        dateIdx = i;
        break;
      }
    }
    if (dateIdx >= 0) start = dateIdx + 1;
    else {
      for (var j = start; j < lines.length; j++) {
        if (EVENT_RE.test(cleanSelectionLine(lines[j]))) {
          start = j + 1;
          break;
        }
      }
    }
    var legs = [];
    var pending = null;
    var ev = headerEvent || "";
    var when = headerDate || "";
    for (var k = start; k < lines.length; k++) {
      var line = lines[k];
      if (RESPONSIBLE_RE.test(line)) break;
      if (isHeaderNoise(line)) continue;
      if (EVENT_RE.test(cleanSelectionLine(line))) continue;
      if (DATE_RE.test(line)) continue;
      if (isMarketLine(line)) {
        var market = normalizeMarket(line);
        if (pending) {
          pushLeg(legs, pending, market, ev, when);
          pending = null;
        } else pushLeg(legs, "", market, ev, when);
      } else {
        var sel = cleanSelectionLine(line);
        if (!sel) continue;
        if (pending) pushLeg(legs, pending, "", ev, when);
        pending = sel;
      }
    }
    if (pending) pushLeg(legs, pending, "", ev, when);
    return legs;
  }

  /** Regular multi: event + date headers repeat per game; legs sit under each block. */
  function extractLegsMulti(lines) {
    var start = bodyStartIndex(lines);
    var legs = [];
    var pending = null;
    var curEvent = "";
    var curDate = "";
    for (var k = start; k < lines.length; k++) {
      var line = lines[k];
      if (RESPONSIBLE_RE.test(line)) break;
      if (isHeaderNoise(line)) continue;
      var cleaned = cleanSelectionLine(line);
      if (EVENT_RE.test(cleaned) && !DATE_RE.test(cleaned)) {
        if (pending) {
          pushLeg(legs, pending, "", curEvent, curDate);
          pending = null;
        }
        curEvent = cleaned;
        curDate = "";
        continue;
      }
      if (DATE_RE.test(line)) {
        curDate = line;
        continue;
      }
      if (isMarketLine(line)) {
        var market = normalizeMarket(line);
        if (pending) {
          pushLeg(legs, pending, market, curEvent, curDate);
          pending = null;
        } else pushLeg(legs, "", market, curEvent, curDate);
      } else {
        var sel = cleanSelectionLine(line);
        if (!sel) continue;
        if (pending) pushLeg(legs, pending, "", curEvent, curDate);
        pending = sel;
      }
    }
    if (pending) pushLeg(legs, pending, "", curEvent, curDate);
    return legs;
  }

  function uniqueEvents(legs) {
    var seen = [];
    (legs || []).forEach(function (l) {
      var e = (l && l.event) || "";
      if (e && seen.indexOf(e) < 0) seen.push(e);
    });
    return seen;
  }

  function groupLegsByEvent(legs) {
    var map = new Map();
    (legs || []).forEach(function (leg, idx) {
      var key = (leg && leg.event) || "";
      if (!map.has(key)) map.set(key, { event: key, date_time: leg.date_time || "", sport: leg.sport || "", legs: [] });
      var g = map.get(key);
      if (!g.date_time && leg.date_time) g.date_time = leg.date_time;
      g.legs.push({ leg: leg, index: idx });
    });
    return Array.from(map.values());
  }

  function detectSport(eventName, legs) {
    var blob = (eventName || "") + " " + (legs || []).map(function (l) {
      return (l.selection || "") + " " + (l.market || "") + " " + (l.event || "");
    }).join(" ");
    if (/\bnrl\b/i.test(blob)) return "NRL";
    if (/\(w\)/i.test(blob)) return "AFLW";
    if (/\baflw\b/i.test(blob)) return "AFLW";
    if (/\bafl\b/i.test(blob)) return "AFL";
    return "AFL";
  }

  function normTeamToken(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/\s*\(w\)\s*/g, " w ")
      .replace(/[^a-z0-9 ]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function fixtureTeamName(t) {
    if (!t) return "";
    if (typeof t === "string") return t.trim();
    return String(t.name || t.aflName || t.abbrev || "").trim();
  }

  function fixtureEventLabel(g) {
    if (!g) return "";
    if (g.game_name) return String(g.game_name).trim();
    var h = fixtureTeamName(g.hteam);
    var a = fixtureTeamName(g.ateam);
    if (h && a) return h + " v " + a;
    return "";
  }

  function fixtureComp(g) {
    return String((g && g.comp) || "AFL").trim();
  }

  function teamsMatchEvent(game, eventName) {
    var teams = splitEventTeams(eventName);
    if (!teams.home || !teams.away) return false;
    var ht = normTeamToken(teams.home);
    var at = normTeamToken(teams.away);
    var gh = normTeamToken(fixtureTeamName(game.hteam));
    var ga = normTeamToken(fixtureTeamName(game.ateam));
    if (gh === ht && ga === at) return true;
    if (gh.indexOf(ht) >= 0 && ga.indexOf(at) >= 0) return true;
    var htBare = ht.replace(/\bw\b/g, "").trim();
    var atBare = at.replace(/\bw\b/g, "").trim();
    if (gh.indexOf(htBare) >= 0 && ga.indexOf(atBare) >= 0) return true;
    return false;
  }

  function fixtureGameId(g) {
    if (!g) return "";
    return String(g.aflMatchId || g.id || g.game_id || "").trim();
  }

  /** Match one event string to a row from /api/fixtures (AFL, AFLW, NRL, …). */
  function matchEventToFixture(games, eventName, sportHint) {
    var list = Array.isArray(games) ? games : [];
    if (!eventName || !list.length) return null;
    var hint = String(sportHint || "").toUpperCase();
    var hits = list.filter(function (g) {
      return teamsMatchEvent(g, eventName);
    });
    if (!hits.length) return null;
    if (hint) {
      var byComp = hits.filter(function (g) {
        return fixtureComp(g).toUpperCase() === hint || (hint === "AFLW" && fixtureComp(g) === "AFLW");
      });
      if (byComp.length) hits = byComp;
    }
    if (hits.length > 1 && /\(w\)/i.test(eventName)) {
      var w = hits.filter(function (g) {
        return fixtureComp(g) === "AFLW";
      });
      if (w.length) hits = w;
    }
    return hits[0] || null;
  }

  function attachFixtureMatches(legs, games) {
    return (legs || []).map(function (leg) {
      var copy = Object.assign({}, leg);
      var hit = matchEventToFixture(games, copy.event, copy.sport);
      if (hit) {
        copy.fixture_id = fixtureGameId(hit);
        copy.game_id = copy.fixture_id;
        copy.sport = fixtureComp(hit);
        copy.matched_event = fixtureEventLabel(hit);
      }
      return copy;
    });
  }

  function parseAuSlip(text) {
    var lines = linesOf(text);
    var bet = null;
    var odds = null;
    lines.forEach(function (line) {
      var hit = parseBetTypeLine(line);
      if (hit) {
        bet = hit.bet_type;
        if (hit.odds != null && isFinite(hit.odds)) odds = hit.odds;
      }
    });
    if (odds == null) {
      lines.forEach(function (line) {
        var m = line.match(/@\s*([\d.]+)/);
        if (m) odds = parseFloat(m[1]);
      });
    }
    var legCount = parseLegCount(lines);
    var betType = bet || "";
    var eventName = findEventLine(lines);
    var dateTime = findDateTimeLine(lines);
    var isSgm = betType === "Same Game Multi";
    var isMulti = betType === "Multi" || (!isSgm && legCount > 1 && betType !== "Single");
    var legs = isSgm
      ? extractLegsSgm(lines, eventName, dateTime)
      : isMulti
        ? extractLegsMulti(lines)
        : extractLegsSgm(lines, eventName, dateTime);
    if (legCount == null && legs.length) legCount = legs.length;
    var events = uniqueEvents(legs);
    if (isMulti && events.length) {
      eventName = events.length === 1 ? events[0] : events.join(" · ");
    }
    return {
      bookie: detectBookie(text),
      bet_type: betType || (legs.length > 1 ? "Multi" : legs.length === 1 ? "Single" : ""),
      odds: odds,
      leg_count: legCount,
      event: eventName,
      date_time: dateTime,
      sport: detectSport(eventName, legs),
      legs: legs,
      game_groups: groupLegsByEvent(legs),
      raw_text: normalizeText(text),
    };
  }

  function parseSportsbet(text) {
    var slip = parseAuSlip(text);
    slip.bookie = "sportsbet";
    return slip;
  }

  function parseLadbrokes(text) {
    return parseAuSlip(text);
  }

  function parseNeds(text) {
    return parseAuSlip(text);
  }

  function parseTab(text) {
    return parseAuSlip(text);
  }

  function parsePointsbet(text) {
    return parseAuSlip(text);
  }

  function parseSlipText(text) {
    var bookie = detectBookie(text);
    if (bookie === "ladbrokes") return parseLadbrokes(text);
    if (bookie === "neds") return parseNeds(text);
    if (bookie === "tab") return parseTab(text);
    if (bookie === "pointsbet") return parsePointsbet(text);
    return parseSportsbet(text);
  }

  /** Tip import draft — same fields the builder review / queue-tip path expects. */
  function slipToTipDraft(slip) {
    slip = slip || {};
    var parsedLegs = slip.legs || [];
    var legs = parsedLegs.map(function (leg) {
      return legToBuilderLeg(leg);
    });
    var events = uniqueEvents(parsedLegs);
    var gameName = slip.event || "";
    if (!gameName && events.length) gameName = events.length === 1 ? events[0] : events.length + " games";
    var sports = parsedLegs.map(function (l) {
      return l.sport || detectSport(l.event, [l]);
    }).filter(Boolean);
    var sport = slip.sport || "";
    if (!sport && sports.length) {
      var same = sports.every(function (s) {
        return s === sports[0];
      });
      sport = same ? sports[0] : "Custom";
    }
    return {
      bet_type: slip.bet_type || "",
      odds: slip.odds,
      leg_count: slip.leg_count != null ? slip.leg_count : legs.length,
      game_name: gameName,
      sport: sport || detectSport(gameName, parsedLegs),
      bookmaker: bookmakerName(slip.bookie),
      date_time: slip.date_time || "",
      legs: legs,
      parsed_legs: parsedLegs,
      bookie: slip.bookie || "unknown",
    };
  }

  function bookmakerName(slug) {
    var map = {
      sportsbet: "Sportsbet",
      ladbrokes: "Ladbrokes",
      neds: "Neds",
      tab: "TAB",
      pointsbet: "PointsBet",
    };
    return map[slug] || "";
  }

  function legToBuilderLeg(leg) {
    var sel = String((leg && leg.selection) || "").trim();
    var mkt = String((leg && leg.market) || "").trim();
    var desc = sel && mkt ? sel + " — " + mkt : sel || mkt;
    var out = { custom: true, desc: desc };
    if (leg && leg.game_id) out.game_id = String(leg.game_id);
    if (leg && leg.event) out.game = leg.event;
    if (/head\s*to\s*head/i.test(mkt)) {
      out.market = "Head to Head";
      out.player = sel;
    }
    var disp = mkt.match(/^(\d+)\+\s*Disposals$/i);
    if (disp) {
      out.player = sel;
      out.stat = "Disposals";
      out.line = parseFloat(disp[1]);
      out.side = "Over";
      delete out.custom;
    }
    return out;
  }

  function splitEventTeams(eventName) {
    var m = String(eventName || "").match(EVENT_RE);
    if (!m) return { home: "", away: "" };
    return { home: m[1].trim(), away: m[2].trim() };
  }

  var API = {
    normalizeText: normalizeText,
    detectBookie: detectBookie,
    parseSlipText: parseSlipText,
    parseSportsbet: parseSportsbet,
    parseLadbrokes: parseLadbrokes,
    parseNeds: parseNeds,
    parseTab: parseTab,
    parsePointsbet: parsePointsbet,
    slipToTipDraft: slipToTipDraft,
    legToBuilderLeg: legToBuilderLeg,
    splitEventTeams: splitEventTeams,
    bookmakerName: bookmakerName,
    uniqueEvents: uniqueEvents,
    groupLegsByEvent: groupLegsByEvent,
    fixtureEventLabel: fixtureEventLabel,
    fixtureGameId: fixtureGameId,
    fixtureComp: fixtureComp,
    matchEventToFixture: matchEventToFixture,
    attachFixtureMatches: attachFixtureMatches,
    teamsMatchEvent: teamsMatchEvent,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = API;
  root.TBSlipOcr = API;
})(typeof window !== "undefined" ? window : globalThis);
