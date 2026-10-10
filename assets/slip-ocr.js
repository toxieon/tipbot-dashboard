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

  function extractLegs(lines) {
    var start = -1;
    var dateIdx = -1;
    for (var i = 0; i < lines.length; i++) {
      if (DATE_RE.test(lines[i])) dateIdx = i;
    }
    if (dateIdx >= 0) start = dateIdx + 1;
    else {
      for (var j = 0; j < lines.length; j++) {
        if (EVENT_RE.test(cleanSelectionLine(lines[j]))) {
          start = j + 1;
          break;
        }
      }
    }
    if (start < 0) start = 0;
    var legs = [];
    var pending = null;
    for (var k = start; k < lines.length; k++) {
      var line = lines[k];
      if (RESPONSIBLE_RE.test(line)) break;
      if (/^proposed\s*bet$/i.test(line)) continue;
      if (/^p\d+$/i.test(line)) continue;
      if (parseBetTypeLine(line)) continue;
      if (/^\d+\s*legs?$/i.test(line)) continue;
      if (EVENT_RE.test(cleanSelectionLine(line))) continue;
      if (DATE_RE.test(line)) continue;
      if (/\bsportsbet\b/i.test(line)) continue;

      if (isMarketLine(line)) {
        var market = normalizeMarket(line);
        if (pending) {
          legs.push({ selection: pending, market: market });
          pending = null;
        } else {
          legs.push({ selection: "", market: market });
        }
      } else {
        var sel = cleanSelectionLine(line);
        if (!sel) continue;
        if (pending) legs.push({ selection: pending, market: "" });
        pending = sel;
      }
    }
    if (pending) legs.push({ selection: pending, market: "" });
    return legs.filter(function (l) {
      return (l.selection && l.selection.trim()) || (l.market && l.market.trim());
    });
  }

  function detectSport(eventName, legs) {
    var blob = (eventName || "") + " " + (legs || []).map(function (l) {
      return (l.selection || "") + " " + (l.market || "");
    }).join(" ");
    if (/\(w\)/i.test(blob)) return "AFLW";
    if (/\baflw\b/i.test(blob)) return "AFLW";
    if (/\bafl\b/i.test(blob)) return "AFL";
    return "AFL";
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
    var eventName = findEventLine(lines);
    var dateTime = findDateTimeLine(lines);
    var legs = extractLegs(lines);
    if (legCount == null && legs.length) legCount = legs.length;
    return {
      bookie: detectBookie(text),
      bet_type: bet || (legs.length > 1 ? "Multi" : legs.length === 1 ? "Single" : ""),
      odds: odds,
      leg_count: legCount,
      event: eventName,
      date_time: dateTime,
      sport: detectSport(eventName, legs),
      legs: legs,
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
    var legs = (slip.legs || []).map(function (leg) {
      return legToBuilderLeg(leg);
    });
    var gameName = slip.event || "";
    return {
      bet_type: slip.bet_type || "",
      odds: slip.odds,
      leg_count: slip.leg_count != null ? slip.leg_count : legs.length,
      game_name: gameName,
      sport: slip.sport || detectSport(gameName, slip.legs),
      bookmaker: bookmakerName(slip.bookie),
      date_time: slip.date_time || "",
      legs: legs,
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
  };

  if (typeof module !== "undefined" && module.exports) module.exports = API;
  root.TBSlipOcr = API;
})(typeof window !== "undefined" ? window : globalThis);
