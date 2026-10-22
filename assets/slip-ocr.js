/* Client-side bet-slip OCR (Sportsbet layout first; Ladbrokes, Neds, TAB, Pointsbet share it).
 * Browser global TBSlipOcr + CommonJS for node --test. No console.*.
 *
 * Pipeline: recognizeImage() (browser: canvas preprocess + tesseract.js with word boxes)
 *   -> cleanOcrLines() (drops leading icon glyphs by box gap, or by shape for plain text)
 *   -> parseSlipLines() (header, per-leg game detection, structured legs, confidence flags).
 * Nothing low-confidence is filled in silently: every doubt becomes an entry in slip.flags
 * (and leg.flags) that the review screen highlights for the tipster to edit.
 */
(function (root) {
  "use strict";

  var LOW_CONF = 70;            // tesseract line confidence below this is flagged
  var RESPONSIBLE_RE = /think\.|is this a bet|deposit\s*limit|gamble\s*responsibly|set\s*a\s*limit|want\s*to\s*place/i;
  var DATE_RE = /^(?:mon|tues|wednes|thurs|fri|satur|sun)day\b|^(?:mon|tue|wed|thu|fri|sat|sun)\b[ ,]|^\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)|^(?:today|tomorrow|tonight)\b/i;
  var DATE_PARTS_RE = /^(mon|tue|wed|thu|fri|sat|sun)[a-z]*,?\s+(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})[:.](\d{2})/i;
  var REL_DATE_RE = /^(today|tomorrow|tonight)\b(?:[,\s]+(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?)?(?:[,\s]+(\d{1,2})[:.](\d{2})\s*(am|pm)?)?/i;
  var DM_DATE_RE = /^(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(?:[,\s]+(\d{1,2})[:.](\d{2})\s*(am|pm)?)?/i;
  var BARE_TIME_RE = /^(\d{1,2})[:.](\d{2})\s*(am|pm)?$/i;
  // Public bookmaker labels only. The import screen prints supportedSlipsNote() from this list.
  var SLIP_REGISTRY = [
    { id: "sportsbet", label: "Sportsbet" },
    { id: "ladbrokes", label: "Ladbrokes" },
    { id: "neds", label: "Neds" },
    { id: "tab", label: "TAB" },
    { id: "pointsbet", label: "PointsBet" },
    { id: "bet365", label: "bet365" }
  ];
  var NBA_ABBR = {
    atl: "hawks", bos: "celtics", bkn: "nets", cha: "hornets", chi: "bulls",
    cle: "cavaliers", dal: "mavericks", den: "nuggets", det: "pistons",
    gsw: "warriors", hou: "rockets", ind: "pacers", lac: "clippers", lal: "lakers",
    mem: "grizzlies", mia: "heat", mil: "bucks", min: "timberwolves", nop: "pelicans",
    nyk: "knicks", okc: "thunder", orl: "magic", phi: "76ers", phx: "suns",
    por: "trail blazers", sac: "kings", sas: "spurs", tor: "raptors", uta: "jazz",
    was: "wizards"
  };
  var PROP_FOOTER_RE = /^(cash\s*out|reuse(\s+\S+){0,4}|share(\s+\S+){0,4}|copy(\s+bet)?|bet\s+with\s+mates|add\s+to\s+(the\s+)?(bet\s*)?slip)$/i;
  var BET_RE = /\b(same\s*game\s*multi|sgm|multi(?:\s*bet)?|single)\b\s*@\s*([\d.,]+)/i;
  var BET_WORD_RE = /^(same\s*game\s*multi|sgm|multi(?:\s*bet)?|single)\b/i;
  var TITLE_AT_RE = /^(.+?)\s*@\s*(\d+(?:[.,]\d+)?)\s*$/;
  var RACE_EVENT_RE = /^(.+?)\s*(?:[•·\-–—*]|\.)?\s*\bRace\s*(\d{1,2})\b\s*$/i;
  var EVENT_RE = /^(.+?)\s+(v|vs\.?|@)\s+(.+)$/i;
  var RUNNER_RE = /^(\d{1,2})\s*[.)]\s*(.+)$/;
  var MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  var DOW = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

  // Canonical stat names. `unit` is the word a Sportsbet title uses for it ("70+ Yards").
  var STATS = [
    { stat: "Disposals", re: /^disposals?$/i, sport: "AFL" },
    { stat: "Goals", re: /^goals?$/i, sport: "AFL" },
    { stat: "Marks", re: /^marks?$/i, sport: "AFL" },
    { stat: "Tackles", re: /^tackles?$/i, sport: "AFL" },
    { stat: "Kicks", re: /^kicks?$/i, sport: "AFL" },
    { stat: "Handballs", re: /^handballs?$/i, sport: "AFL" },
    { stat: "Fantasy Points", re: /^(afl\s*)?fantasy(\s*points)?$/i, sport: "AFL" },
    { stat: "Points", re: /^(points?|pts|player\s*points)$/i, sport: "BASKETBALL" },
    { stat: "Rebounds", re: /^(rebounds?|rebs?|player\s*rebounds)$/i, sport: "BASKETBALL" },
    { stat: "Assists", re: /^(assists?|asts?|player\s*assists)$/i, sport: "BASKETBALL" },
    { stat: "Threes Made", re: /^(threes?(\s*made)?|3\s*pointers?(\s*made)?)$/i, sport: "BASKETBALL" },
    { stat: "Steals", re: /^steals?$/i, sport: "BASKETBALL" },
    { stat: "Blocks", re: /^blocks?$/i, sport: "BASKETBALL" },
    { stat: "Points + Assists", re: /^(pa|p\s*\+\s*a|(points?|pts)\s*(\+|&|and)\s*(assists?|asts?))$/i, sport: "BASKETBALL" },
    { stat: "Points + Rebounds", re: /^(pr|p\s*\+\s*r|(points?|pts)\s*(\+|&|and)\s*(rebounds?|rebs?))$/i, sport: "BASKETBALL" },
    { stat: "Rebounds + Assists", re: /^(ra|r\s*\+\s*a|(rebounds?|rebs?)\s*(\+|&|and)\s*(assists?|asts?))$/i, sport: "BASKETBALL" },
    { stat: "Points + Rebounds + Assists", re: /^(pra|points\s*\+\s*rebounds\s*\+\s*assists|pts\s*\+\s*reb\s*\+\s*ast)$/i, sport: "BASKETBALL" },
    { stat: "Passing Yards", re: /^pass(ing)?\s*(yds|yards)$/i, sport: "NFL", unit: "yards" },
    { stat: "Rushing Yards", re: /^rush(ing)?\s*(yds|yards)$/i, sport: "NFL", unit: "yards" },
    { stat: "Receiving Yards", re: /^rec(eiving)?\s*(yds|yards)$/i, sport: "NFL", unit: "yards" },
    { stat: "Receptions", re: /^receptions?$/i, sport: "NFL", unit: "receptions" },
    { stat: "Passing TDs", re: /^pass(ing)?\s*(tds?|touchdowns?)$/i, sport: "NFL", unit: "touchdowns" },
    { stat: "Rushing TDs", re: /^rush(ing)?\s*(tds?|touchdowns?)$/i, sport: "NFL", unit: "touchdowns" },
    { stat: "Receiving TDs", re: /^rec(eiving)?\s*(tds?|touchdowns?)$/i, sport: "NFL", unit: "touchdowns" },
    { stat: "Completions", re: /^(pass(ing)?\s*)?completions?$/i, sport: "NFL", unit: "completions" },
    { stat: "Interceptions", re: /^(interceptions?|ints?)$/i, sport: "NFL" }
  ];
  // Long spellings used to finish a label cut short with "..." (unique prefix only).
  var STAT_SPELLINGS = [
    ["Passing Yards", "passing yds"], ["Passing Yards", "passing yards"], ["Rushing Yards", "rushing yds"],
    ["Rushing Yards", "rushing yards"], ["Receiving Yards", "receiving yds"], ["Receiving Yards", "receiving yards"],
    ["Receptions", "receptions"], ["Passing TDs", "passing touchdowns"], ["Passing TDs", "passing tds"],
    ["Rushing TDs", "rushing touchdowns"], ["Rushing TDs", "rushing tds"], ["Receiving TDs", "receiving touchdowns"],
    ["Receiving TDs", "receiving tds"], ["Completions", "completions"], ["Interceptions", "interceptions"],
    ["Disposals", "disposals"], ["Goals", "goals"], ["Marks", "marks"], ["Tackles", "tackles"],
    ["Points", "points"], ["Rebounds", "rebounds"], ["Assists", "assists"],
    ["Threes Made", "threes"], ["Steals", "steals"], ["Blocks", "blocks"]
  ];
  var H2H_MARKETS = [
    { re: /^(head\s*to\s*head|h2h|match\s*betting|money\s*line|moneyline|to\s*win)$/i, market: "Head to Head" },
    { re: /^(win\s*-?\s*draw\s*-?\s*win|match\s*result|1x2|full\s*time\s*result)$/i, market: "Win-Draw-Win" }
  ];
  var LINE_MARKET_RE = /^(?:alt(?:ernate)?\s+)?(?:line|spread|point\s*spread|handicap)\b/i;
  // "Los Angeles Lakers Total Points" / "Lakers Team Total" (a club's own score).
  var TEAM_TOTAL_MARKET_RE = /^(?!(?:alt(?:ernate)?\s+)?(?:game\s+)?total\b)(.+?)\s+(?:team\s+total(?:\s*points)?|total\s*points)\b/i;
  var TOTAL_MARKET_RE = /^(?:alt(?:ernate)?\s+)?(?:total(?:\s*points|\s*score)?|game\s*total)\b/i;
  var RACE_MARKETS = /^(win|place|each\s*way|win\s*&\s*place|top\s*\d)$/i;

  // Team names for sport detection (clubs only; nothing slip-specific).
  var TEAMS = {
    AFL: ["adelaide", "crows", "brisbane", "lions", "carlton", "blues", "collingwood", "magpies", "essendon", "bombers",
      "fremantle", "dockers", "geelong", "cats", "gold coast", "suns", "gws", "giants", "hawthorn", "hawks", "melbourne",
      "demons", "north melbourne", "kangaroos", "port adelaide", "power", "richmond", "tigers", "st kilda", "saints",
      "sydney", "swans", "west coast", "eagles", "western bulldogs", "bulldogs"],
    NFL: ["cardinals", "falcons", "ravens", "bills", "panthers", "bears", "bengals", "browns", "cowboys", "broncos",
      "lions", "packers", "texans", "colts", "jaguars", "chiefs", "raiders", "chargers", "rams", "dolphins", "vikings",
      "patriots", "saints", "giants", "jets", "eagles", "steelers", "49ers", "seahawks", "buccaneers", "titans", "commanders"],
    WNBA: ["dream", "sky", "sun", "wings", "valkyries", "fever", "aces", "sparks", "lynx", "liberty", "mercury", "storm",
      "mystics", "tempo", "fire"],
    NBA: ["hawks", "celtics", "nets", "hornets", "bulls", "cavaliers", "mavericks", "nuggets", "pistons", "warriors",
      "rockets", "pacers", "clippers", "lakers", "grizzlies", "heat", "bucks", "timberwolves", "pelicans", "knicks",
      "thunder", "magic", "76ers", "suns", "trail blazers", "kings", "spurs", "raptors", "jazz", "wizards"],
    NBL: ["36ers", "adelaide 36ers", "bullets", "brisbane bullets", "taipans", "cairns taipans", "illawarra hawks",
      "melbourne united", "breakers", "new zealand breakers", "wildcats", "perth wildcats", "phoenix",
      "south east melbourne", "sydney kings", "jackjumpers", "tasmania jackjumpers"],
    Soccer: ["arsenal", "aston villa", "bournemouth", "brentford", "brighton", "burnley", "chelsea", "crystal palace",
      "everton", "fulham", "leeds", "liverpool", "manchester city", "man city", "manchester united", "man utd",
      "newcastle", "nottingham forest", "sunderland", "tottenham", "west ham", "wolves", "wolverhampton"]
  };

  function normalizeText(text) {
    return String(text || "")
      .replace(/^\uFEFF/, "")
      .replace(/\r\n/g, "\n")
      .replace(/[|]/g, "I")
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/\u2026/g, "...")
      .trim();
  }
  function squash(s) { return String(s || "").replace(/\s+/g, " ").trim(); }
  function low(s) { return squash(s).toLowerCase(); }

  // ── Line cleaning ─────────────────────────────────────────────────────────
  function letters(s) { return (String(s).match(/[A-Za-z]/g) || []).length; }
  /** A token that looks like an icon glyph tesseract turned into text ("®", "[\", "2]", "a%"). */
  function iconish(tok) {
    var t = String(tok || "");
    if (!t) return true;
    if (!/[A-Za-z0-9]/.test(t)) return true;                       // pure symbols
    if (/[^A-Za-z0-9'().,+\-&]/.test(t) && t.length <= 4) return true; // short, odd symbols
    if (/^\d\]$/.test(t)) return true;
    return false;
  }
  /** Drop leading icon tokens. With word boxes: a short token followed by a wide gap
   *  (icons sit in their own column). Plain text: only tokens that cannot be words. */
  function stripLeadingIcons(words, width) {
    var w = words.slice();
    var gapMin = Math.max(8, (width || 600) * 0.03);
    while (w.length > 1) {
      var a = w[0], b = w[1];
      var hasBox = a.x1 != null && b.x0 != null;
      var gap = hasBox ? b.x0 - a.x1 : 0;
      var shortTok = a.text.length <= 4;
      var dropBox = hasBox && shortTok && gap >= gapMin && !/^\d+(\.\d+)?\+?$/.test(a.text) && !/^\d{1,2}\.$/.test(a.text);
      var dropShape = iconish(a.text) || (/^[a-z]{1,4}$/.test(a.text) && /^[A-Z]/.test(b.text)) ||
        (/^\d$/.test(a.text) && /^[A-Z][a-z]/.test(b.text) && !/^legs?$/i.test(b.text));
      if (dropBox || dropShape) { w.shift(); continue; }
      break;
    }
    if (w.length === 1 && iconish(w[0].text)) w = [];
    return w;
  }
  /** OCR result -> [{text, conf}] with icon glyphs and pure-noise lines removed. */
  function cleanOcrLines(input) {
    var raw = [];
    var width = 0;
    if (input && typeof input === "object" && Array.isArray(input.lines)) {
      width = input.width || 0;
      input.lines.forEach(function (ln) {
        var words = (ln.words || []).map(function (wd) {
          return { text: String(wd.text || "").trim(), conf: wd.conf, x0: wd.x0, x1: wd.x1 };
        }).filter(function (wd) { return wd.text; });
        if (!words.length && ln.text) words = squash(ln.text).split(" ").map(function (t) { return { text: t, conf: ln.conf }; });
        raw.push({ words: words, conf: ln.conf });
      });
    } else {
      normalizeText(input && input.text != null ? input.text : input).split("\n").forEach(function (l) {
        var t = squash(l);
        if (t) raw.push({ words: t.split(" ").map(function (x) { return { text: x }; }), conf: null });
      });
    }
    var out = [];
    raw.forEach(function (ln) {
      var words = stripLeadingIcons(ln.words.map(function (w) { return Object.assign({}, w, { text: normalizeText(w.text) }); }), width);
      var text = squash(words.map(function (w) { return w.text; }).join(" "));
      // A short leftover glyph in front of a market line ("SO Head to Head").
      if (words.length > 1 && words[0].text.length <= 3 && !/\d/.test(words[0].text) && !isSubLine(text)) {
        var rest = squash(words.slice(1).map(function (w) { return w.text; }).join(" "));
        if (isSubLine(rest)) { words = words.slice(1); text = rest; }
      }
      // Trailing icon junk on short lines ("8% %"), and lines with no real word left.
      if (!text) return;
      if (!/[A-Za-z]{3,}|[A-Za-z]+\s*@|^\d+\s*legs?$|^\d+\s*\+|@\s*\d/i.test(text) && !/^(v|vs)$/i.test(text)) {
        if (!/^[A-Za-z]{1,2}$/.test(text)) return;
      }
      if (/^[A-Za-z0-9]{6,}$/.test(text) && !/[aeiou]/i.test(text)) return;   // "PI999999999"-style icon strips
      if (/^\d{5,}$/.test(text)) return;
      var confs = words.map(function (w) { return w.conf; }).filter(function (c) { return typeof c === "number"; });
      var conf = confs.length ? Math.min.apply(null, confs) : (typeof ln.conf === "number" ? ln.conf : null);
      out.push({ text: text, conf: conf });
    });
    return out;
  }

  // ── Small parsers ─────────────────────────────────────────────────────────
  function num(s) {
    var m = String(s == null ? "" : s).replace(",", ".").match(/\d+(?:\.\d+)?/);
    return m ? parseFloat(m[0]) : null;
  }
  function normalizeBetType(raw) {
    var s = low(raw);
    if (s.indexOf("same game") >= 0 || s.replace(/\s/g, "") === "samegamemulti" || s === "sgm") return "Same Game Multi";
    if (s.indexOf("single") >= 0) return "Single";
    return "Multi";
  }
  function parseBetTypeLine(line) {
    var t = String(line || "");
    var m = t.match(BET_RE);
    if (m) return { bet_type: normalizeBetType(m[1]), odds: num(m[2]) };
    m = t.match(BET_WORD_RE);
    if (m) {
      var o = t.match(/@\s*([\d.,]+)/);
      return { bet_type: normalizeBetType(m[1]), odds: o ? num(o[1]) : null };
    }
    return null;
  }
  function parseLegCount(t) { var m = String(t).match(/(\d{1,2})\s*legs?\b/i); return m ? parseInt(m[1], 10) : null; }
  function isDateLine(t) { return DATE_RE.test(String(t || "")); }
  function isEventLine(t) {
    var s = String(t || "");
    if (TITLE_AT_RE.test(s) || isDateLine(s)) return false;
    if (RACE_EVENT_RE.test(s)) return true;
    var m = s.match(EVENT_RE);
    return !!(m && letters(m[1]) >= 3 && letters(m[3]) >= 3);
  }
  function canonicalEvent(t) {
    var s = squash(t);
    var r = s.match(RACE_EVENT_RE);
    if (r) return squash(r[1]).replace(/[•·\-–—*.]+$/, "").trim() + " R" + parseInt(r[2], 10);
    var m = s.match(EVENT_RE);
    if (!m) return s;
    var sep = m[2] === "@" ? "@" : "v";
    return squash(m[1]) + " " + sep + " " + squash(m[3]);
  }
  function nearestYear(mon, day, now) {
    var y0 = now.getUTCFullYear(), best = y0, bestDiff = Infinity;
    [y0 - 1, y0, y0 + 1].forEach(function (y) {
      var diff = Math.abs(Date.UTC(y, mon, day) - now.getTime());
      if (diff < bestDiff) { best = y; bestDiff = diff; }
    });
    return best;
  }
  function slipDateParts(year, mon, day, hh, mm) {
    var pad = function (n) { return (n < 10 ? "0" : "") + n; };
    var dow = new Date(Date.UTC(year, mon, day)).getUTCDay();
    var dname = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dow];
    var mname = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][mon];
    var timeOk = hh != null && mm != null && hh < 24 && mm < 60;
    var dateOk = day >= 1 && day <= 31 && mon >= 0 && mon <= 11;
    var ok = dateOk && timeOk;
    return {
      display: dname + " " + day + " " + mname + (timeOk ? " " + pad(hh) + ":" + pad(mm) : ""),
      local: ok ? year + "-" + pad(mon + 1) + "-" + pad(day) + "T" + pad(hh) + ":" + pad(mm) : "",
      ok: ok
    };
  }
  function applyAmPm(hh, ampm) {
    if (hh == null || !ampm) return hh;
    var ap = String(ampm).toLowerCase();
    if (ap === "pm" && hh < 12) return hh + 12;
    if (ap === "am" && hh === 12) return 0;
    return hh;
  }
  /** Calendar day in Australia/Melbourne (AEDT/AEST), not UTC. */
  function melbourneYmd(ms) {
    var parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Australia/Melbourne", year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(new Date(ms));
    var o = { year: 1970, month: 1, day: 1 };
    parts.forEach(function (p) {
      if (p.type === "year" || p.type === "month" || p.type === "day") o[p.type] = parseInt(p.value, 10);
    });
    return { year: o.year, mon: o.month - 1, day: o.day };
  }
  function addCalendarDays(year, mon, day, n) {
    var d = new Date(Date.UTC(year, mon, day + (n || 0)));
    return { year: d.getUTCFullYear(), mon: d.getUTCMonth(), day: d.getUTCDate() };
  }
  /** "Today"/"Tomorrow"/"Tonight", with or without "16 Oct 11:16".
   *  A bare Tomorrow/Today is the next (or same) calendar day in Australia/Melbourne. */
  function parseRelativeSlipDate(m, nowMs) {
    var word = m[1].toLowerCase();
    var now = new Date(nowMs != null ? nowMs : Date.now());
    var day = m[2] ? parseInt(m[2], 10) : null;
    var mon = m[3] ? MONTHS[m[3].toLowerCase()] : null;
    var hh = m[4] != null && m[4] !== "" ? parseInt(m[4], 10) : null;
    var mm = m[5] != null && m[5] !== "" ? parseInt(m[5], 10) : null;
    hh = applyAmPm(hh, m[6]);
    var year;
    if (day != null && mon != null) year = nearestYear(mon, day, now);
    else {
      var mel = melbourneYmd(now.getTime());
      var ymd = addCalendarDays(mel.year, mel.mon, mel.day, word === "tomorrow" ? 1 : 0);
      year = ymd.year;
      mon = ymd.mon;
      day = ymd.day;
    }
    return slipDateParts(year, mon, day, hh, mm);
  }
  /** "Friday, 16 Oct 19:15" or "Tomorrow 16 Oct 11:16" -> { display, local, ok } */
  function parseSlipDate(t, nowMs) {
    var rel = String(t || "").match(REL_DATE_RE);
    if (rel) return parseRelativeSlipDate(rel, nowMs);
    var dm = String(t || "").match(DM_DATE_RE);
    if (dm && !DATE_PARTS_RE.test(String(t || ""))) {
      var dDay = parseInt(dm[1], 10), dMon = MONTHS[dm[2].toLowerCase()];
      var dHh = dm[3] != null && dm[3] !== "" ? parseInt(dm[3], 10) : null;
      var dMm = dm[4] != null && dm[4] !== "" ? parseInt(dm[4], 10) : null;
      dHh = applyAmPm(dHh, dm[5]);
      var melNow = melbourneYmd(nowMs != null ? nowMs : Date.now());
      var dYear = nearestYear(dMon, dDay, new Date(Date.UTC(melNow.year, melNow.mon, melNow.day, 12)));
      return slipDateParts(dYear, dMon, dDay, dHh, dMm);
    }
    var m = String(t || "").match(DATE_PARTS_RE);
    if (!m) return { display: squash(t), local: "", ok: false };
    var dow = DOW[m[1].toLowerCase()], day = parseInt(m[2], 10), mon = MONTHS[m[3].toLowerCase()];
    var hh = parseInt(m[4], 10), mm = parseInt(m[5], 10);
    var now = new Date(nowMs != null ? nowMs : Date.now());
    var y0 = now.getUTCFullYear(), year = null;
    // The year whose calendar puts that date on the shown weekday, nearest to now.
    [y0, y0 + 1, y0 - 1].some(function (y) {
      if (new Date(Date.UTC(y, mon, day)).getUTCDay() === dow) { year = y; return true; }
      return false;
    });
    var pad = function (n) { return (n < 10 ? "0" : "") + n; };
    var dname = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dow];
    var mname = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][mon];
    var ok = year != null && hh < 24 && mm < 60 && day >= 1 && day <= 31;
    return {
      display: dname + " " + day + " " + mname + " " + pad(hh) + ":" + pad(mm),
      local: ok ? year + "-" + pad(mon + 1) + "-" + pad(day) + "T" + pad(hh) + ":" + pad(mm) : "",
      ok: ok
    };
  }
  /** "Assists + Rebounds" and "Rebounds + Assists" are the same sum. */
  function canonCombo(s) {
    var parts = String(s || "").split(/\s*(?:\+|\/|&|\band\b)\s*/);
    if (parts.length !== 2) return "";
    var map = {
      points: "points", pts: "points", point: "points",
      rebounds: "rebounds", rebound: "rebounds", rebs: "rebounds", reb: "rebounds",
      assists: "assists", assist: "assists", asts: "assists", ast: "assists"
    };
    var a = map[parts[0]], b = map[parts[1]];
    if (!a || !b || a === b) return "";
    var key = [a, b].sort().join("+");
    var names = {
      "assists+points": "Points + Assists",
      "points+rebounds": "Points + Rebounds",
      "assists+rebounds": "Rebounds + Assists"
    };
    return names[key] || "";
  }
  function canonStat(raw, titleUnit) {
    var s = low(raw).replace(/^alt(ernate)?\s+/, "").replace(/\s*(o\/u|over\s*\/\s*under)\s*$/i, "").replace(/\.+$/, "").trim();
    var comboEarly = canonCombo(s);
    if (comboEarly) {
      var comboDef = STATS.find(function (x) { return x.stat === comboEarly; });
      return { stat: comboEarly, sport: comboDef ? comboDef.sport : "BASKETBALL", truncated: false };
    }
    var truncated = /\.\.\.$|…$/.test(squash(raw));
    for (var i = 0; i < STATS.length; i++) if (STATS[i].re.test(s)) return { stat: STATS[i].stat, sport: STATS[i].sport, truncated: false };
    if (truncated || titleUnit) {
      var hits = [];
      STAT_SPELLINGS.forEach(function (p) { if (s && p[1].indexOf(s) === 0 && hits.indexOf(p[0]) < 0) hits.push(p[0]); });
      if (titleUnit && hits.length > 1) {
        hits = hits.filter(function (h) {
          var def = STATS.find(function (x) { return x.stat === h; });
          return def && def.unit === titleUnit;
        });
      }
      if (hits.length === 1) {
        var d = STATS.find(function (x) { return x.stat === hits[0]; });
        return { stat: hits[0], sport: d ? d.sport : "", truncated: true };
      }
    }
    return { stat: squash(raw).replace(/\.\.\.$/, ""), sport: "", truncated: truncated, unknown: true };
  }
  function titleUnit(title) {
    var m = low(title).replace(/\.\.\.$/, "").match(/\d+(?:\.\d+)?\+\s*([a-z]+)/);
    if (!m) return "";
    var u = m[1];
    if (/^yard/.test(u)) return "yards";
    if (/^recep/.test(u)) return "receptions";
    if (/^(passing|rushing|receiving)$/.test(u)) {
      var rest = low(title).match(/\d+\+\s*\w+\s+([a-z]+)/);
      if (rest && /^touch/.test(rest[1])) return "touchdowns";
      if (rest && /^(yds|yard)/.test(rest[1])) return "yards";
    }
    if (/^touch/.test(u)) return "touchdowns";
    if (/^complet/.test(u)) return "completions";
    return "";
  }

  // ── Sport detection ───────────────────────────────────────────────────────
  function teamHits(text, sport) {
    var s = " " + low(text).replace(/[^a-z0-9 ]/g, " ") + " ";
    return (TEAMS[sport] || []).filter(function (t) { return s.indexOf(" " + t + " ") >= 0; }).length;
  }
  function multiWordTeamHits(text, sport) {
    var s = " " + low(text).replace(/[^a-z0-9 ]/g, " ") + " ";
    return (TEAMS[sport] || []).filter(function (t) { return t.indexOf(" ") >= 0 && s.indexOf(" " + t + " ") >= 0; }).length;
  }
  function expandNbaAbbr(text) {
    return String(text || "").replace(/\b([A-Za-z]{3})\b/g, function (m) {
      return NBA_ABBR[m.toLowerCase()] || m;
    });
  }
  function detectSport(eventName, legs) {
    legs = legs || [];
    var ev = String(eventName || "");
    var blob = ev + " " + legs.map(function (l) { return (l.selection || "") + " " + (l.market || "") + " " + (l.event || ""); }).join(" ");
    if (RACE_EVENT_RE.test(ev) || legs.some(function (l) { return l.kind === "racing"; })) return "Racing";
    if (/\bnrl\b/i.test(blob)) return "NRL";
    if (/\bnbl\b/i.test(blob)) return "NBL";
    if (/\(w\)/i.test(ev || blob) || /\baflw\b/i.test(blob)) return "AFLW";
    if (/\bafl\b/i.test(blob)) return "AFL";
    var statSports = legs.map(function (l) { return l.stat_sport; }).filter(Boolean);
    if (legs.some(function (l) { return l.market === "Win-Draw-Win"; })) return "Soccer";
    var scores = {};
    ["AFL", "NFL", "WNBA", "NBA", "NBL", "Soccer"].forEach(function (k) { scores[k] = teamHits(ev, k); });
    var expanded = expandNbaAbbr(ev);
    if (expanded !== ev) scores.NBA = Math.max(scores.NBA, teamHits(expanded, "NBA"));
    if (statSports.indexOf("NFL") >= 0) scores.NFL += 3;
    if (statSports.indexOf("AFL") >= 0) scores.AFL += 3;
    if (statSports.indexOf("BASKETBALL") >= 0) { scores.WNBA += 1; scores.NBA += 1; scores.NBL += 1; }
    // A full NBL club name ("Sydney Kings", "Illawarra Hawks") beats a shared nickname.
    if (multiWordTeamHits(ev, "NBL")) scores.NBL += 2;
    var best = "", bestN = 0, tie = false;
    Object.keys(scores).forEach(function (k) {
      if (scores[k] > bestN) { best = k; bestN = scores[k]; tie = false; } else if (scores[k] === bestN && bestN > 0) tie = true;
    });
    if (!bestN || tie) return "";
    return best;
  }

  // ── Leg builder ───────────────────────────────────────────────────────────
  function legFromPair(title, sub) {
    var t = squash(title && title.text), s = squash(sub && sub.text);
    var conf = [title && title.conf, sub && sub.conf].filter(function (c) { return typeof c === "number"; });
    var leg = { selection: t, market: s, player: "", team: "", stat: "", line: null, side: "", plus: false,
      odds: null, kind: "", flags: [], conf: conf.length ? Math.min.apply(null, conf) : null };
    var m;
    // Racing: "2. Royal Press" (odds already stripped) + "Win".
    var rt = t.replace(/^\S{1,2}\s+(?=\d{1,2}\s*[.)]\s*[A-Z])/, "");
    if (RACE_MARKETS.test(s) && RUNNER_RE.test(rt)) {
      m = rt.match(RUNNER_RE);
      leg.kind = "racing"; leg.runner_number = parseInt(m[1], 10); leg.runner = squash(m[2]);
      leg.selection = leg.runner_number + ". " + leg.runner; leg.market = s.replace(/^./, function (c) { return c.toUpperCase(); });
      leg.stat = leg.market;
      return leg;
    }
    for (var i = 0; i < H2H_MARKETS.length; i++) {
      if (H2H_MARKETS[i].re.test(s)) {
        leg.kind = "team"; leg.team = t; leg.market = H2H_MARKETS[i].market; leg.stat = H2H_MARKETS[i].market; return leg;
      }
    }
    // "Win" on a team (not "2. Royal Press" / Win) is head to head.
    if (/^win$/i.test(s) && !RUNNER_RE.test(rt)) {
      leg.kind = "team"; leg.team = t; leg.market = "Head to Head"; leg.stat = "Head to Head"; return leg;
    }
    if (LINE_MARKET_RE.test(s)) {
      var signed = t.match(/^(.+?)\s+([+-]\d+(?:\.\d+)?)$/);
      var subLine = s.match(/([+-]\d+(?:\.\d+)?)/);
      leg.kind = "team"; leg.market = "Line"; leg.stat = "Line";
      leg.team = signed ? squash(signed[1]) : t;
      leg.selection = leg.team;
      leg.line = signed ? parseFloat(signed[2]) : (subLine ? parseFloat(subLine[1]) : null);
      if (leg.line == null) leg.flags.push({ field: "line", reason: "No line found" });
      return leg;
    }
    var ttm = s.match(TEAM_TOTAL_MARKET_RE);
    if (ttm) {
      var tt = t.match(/\b(over|under)\s+(\d+(?:\.\d+)?)/i) || s.match(/\b(over|under)\s+(\d+(?:\.\d+)?)/i);
      leg.kind = "team"; leg.market = "Team Total"; leg.stat = "Team Total";
      leg.team = squash((ttm[1] || "").replace(/^(?:alt(?:ernate)?\s+)/i, ""));
      if (tt) { leg.side = wordCap(tt[1]); leg.line = parseFloat(tt[2]); }
      else leg.flags.push({ field: "line", reason: "No line found" });
      if (!leg.team) leg.flags.push({ field: "team", reason: "Team not found" });
      leg.selection = leg.team;
      return leg;
    }
    if (TOTAL_MARKET_RE.test(s)) {
      var tot = t.match(/^(over|under)\s+(\d+(?:\.\d+)?)/i) || s.match(/\b(over|under)\s+(\d+(?:\.\d+)?)/i);
      leg.kind = "total"; leg.market = "Total"; leg.stat = "Total"; leg.selection = t;
      if (tot) {
        leg.side = tot[1].charAt(0).toUpperCase() + tot[1].slice(1).toLowerCase();
        leg.line = parseFloat(tot[2]);
      } else leg.flags.push({ field: "line", reason: "No line found" });
      return leg;
    }
    if (/^any\s*time\s*(touchdown|td)\s*(scorer)?$/i.test(s) || /^anytime\s*(touchdown|td)/i.test(s)) {
      leg.kind = "player"; leg.player = t; leg.stat = "Anytime TD"; leg.stat_sport = "NFL";
      leg.line = 1; leg.side = "Over"; leg.plus = true; return leg;
    }
    // "To Score 15+ Points", "15+ Disposals", "1+ Goal"
    m = s.match(/^(?:to\s+(?:score|get|have|record)\s+)?(\d+(?:\.\d+)?)\s*\+\s*(.+)$/i);
    if (m) {
      var cs = canonStat(m[2]);
      leg.kind = "player"; leg.player = t; leg.stat = cs.stat; leg.stat_sport = cs.sport;
      leg.line = parseFloat(m[1]); leg.side = "Over"; leg.plus = true;
      if (cs.unknown) leg.flags.push({ field: "stat", reason: "Unrecognised market \u201c" + cs.stat + "\u201d" });
      return leg;
    }
    // "Jaxon Smith-Njigba - Alt Receiving Yds" with the line in the title.
    m = s.match(/^(.+?)\s+[-–—]\s+(.+)$/);
    if (m) {
      var unit = titleUnit(t);
      var cs2 = canonStat(m[2], unit);
      leg.kind = "player"; leg.player = squash(m[1]); leg.stat = cs2.stat; leg.stat_sport = cs2.sport;
      var tl = t.replace(/\.\.\.$/, "");
      var plus = tl.match(/(\d+(?:\.\d+)?)\s*\+/);
      var ou = tl.match(/\b(over|under)\b\s*\(?\s*\+?\s*(\d+(?:\.\d+)?)?\s*\)?/i);
      if (ou) { leg.side = ou[1].charAt(0).toUpperCase() + ou[1].slice(1).toLowerCase(); leg.line = ou[2] != null ? parseFloat(ou[2]) : null; }
      else if (plus) { leg.side = "Over"; leg.line = parseFloat(plus[1]); leg.plus = true; }
      if (leg.line == null) leg.flags.push({ field: "line", reason: "No line found" });
      if (cs2.unknown) leg.flags.push({ field: "stat", reason: "Unrecognised market \u201c" + cs2.stat + "\u201d" });
      // Title should name the same player (catches a paired-up wrong line).
      if (tl.toLowerCase().indexOf(leg.player.toLowerCase().slice(0, 4)) !== 0) leg.flags.push({ field: "player", reason: "Title and subtitle name different players" });
      return leg;
    }
    if (/^(over|under)\b/i.test(s)) {
      m = s.match(/^(over|under)\s*\(?\+?(\d+(?:\.\d+)?)\)?\s*(.*)$/i);
      if (m) {
        var cs3 = canonStat(m[3] || "");
        leg.kind = "player"; leg.player = t; leg.side = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
        leg.line = parseFloat(m[2]); leg.stat = cs3.stat; leg.stat_sport = cs3.sport;
        if (cs3.unknown) leg.flags.push({ field: "stat", reason: "Unrecognised market" });
        return leg;
      }
    }
    leg.kind = "unknown";
    leg.flags.push({ field: "market", reason: "Couldn't work out this market \u2014 check it" });
    return leg;
  }
  function isSubLine(t) {
    var s = squash(t);
    if (RACE_MARKETS.test(s)) return true;
    if (H2H_MARKETS.some(function (h) { return h.re.test(s); })) return true;
    if (/^win$/i.test(s)) return true;
    if (LINE_MARKET_RE.test(s) || TOTAL_MARKET_RE.test(s) || TEAM_TOTAL_MARKET_RE.test(s)) return true;
    if (/^any\s*time\s*(touchdown|td)/i.test(s) || /^anytime\s*(touchdown|td)/i.test(s)) return true;
    if (/^(?:to\s+(?:score|get|have|record)\s+)?\d+(?:\.\d+)?\s*\+\s*[A-Za-z]/i.test(s)) return true;
    if (/^(over|under)\s*\(?\+?\d/i.test(s)) return true;
    if (/^.+?\s+[-–—]\s+(alt(ernate)?\s+)?[A-Za-z]/.test(s)) return true;
    return false;
  }

  // ── Slip parser ───────────────────────────────────────────────────────────
  function detectBookie(text) {
    var s = low(text);
    if (/\bsports\s*b[ae]t\b|\bsportsb[ae]t|\bsportshet|^sports\b|\bsports\b/m.test(s)) return "sportsbet";
    if (/\bbet\s*365\b|\bbet365\b/.test(s)) return "bet365";
    if (/\bladbrokes\b/.test(s)) return "ladbrokes";
    if (/\bneds\b/.test(s)) return "neds";
    if (/\bpointsbet\b|\bpoints\s*bet\b/.test(s)) return "pointsbet";
    if (/\btab\b/.test(s) && !/\btable\b/.test(s)) return "tab";
    return "unknown";
  }
  function flag(list, field, reason, leg) {
    var f = { field: field, reason: reason };
    if (leg != null) f.leg = leg;
    list.push(f);
  }
  function lowConf(line) { return line && typeof line.conf === "number" && line.conf < LOW_CONF; }

  function isNoiseTitle(ln) {
    var letters = String(ln.text || "").replace(/[^A-Za-z]/g, "");
    if (letters.length <= 4) return true;
    return ln.conf != null && ln.conf < LOW_CONF && !/\s/.test(String(ln.text).trim());
  }
  function parseSlipLines(input, opts) {
    opts = opts || {};
    var lines = cleanOcrLines(input);
    var flags = [];
    var rawText = input && typeof input === "object" && input.text != null ? input.text : (typeof input === "string" ? input : lines.map(function (l) { return l.text; }).join("\n"));
    var claimed = claimPlayerPropSingle(input, rawText, opts);
    if (claimed) return claimed;
    var slip = { bookie: detectBookie(rawText), bet_type: "", odds: null, leg_count: null, stake: null, sport: "",
      event: "", date_time: "", start_local: "", legs: [], flags: flags, raw_text: normalizeText(rawText) };
    var end = lines.length;
    for (var e = 0; e < lines.length; e++) if (RESPONSIBLE_RE.test(lines[e].text)) { end = e; break; }
    lines = lines.slice(0, end).filter(function (l) {
      return !/^proposed(\s*bet)?$/i.test(l.text) && !/^(sports|sportsbet|sportshet)[^a-z]*$/i.test(l.text) && !/^(v|vs)$/i.test(l.text);
    });
    // Header: bet type @ odds (or "Selection @ odds" for singles / racing), legs, event, date.
    var idx = 0, headTitle = null, betLine = null;
    for (; idx < lines.length; idx++) {
      var bt = parseBetTypeLine(lines[idx].text);
      if (bt) { betLine = lines[idx]; slip.bet_type = bt.bet_type; slip.odds = bt.odds; idx++; break; }
      var ta = lines[idx].text.match(TITLE_AT_RE);
      if (ta && letters(ta[1]) >= 2) { headTitle = { text: squash(ta[1]), conf: lines[idx].conf }; betLine = lines[idx]; slip.odds = num(ta[2]); idx++; break; }
    }
    if (!betLine) { flag(flags, "bet_type", "No bet type / odds line found"); idx = 0; }
    else if (lowConf(betLine)) { flag(flags, "odds", "Odds read with low confidence"); }
    if (slip.odds == null || !(slip.odds > 1)) flag(flags, "odds", "Total odds not read");
    if (idx < lines.length && lines[idx].text.length < 20 && /\b\d{1,2}\s*legs?\s*$/i.test(lines[idx].text)) {
      slip.leg_count = parseLegCount(lines[idx].text); idx++;
    }
    var body = lines.slice(idx);

    if (headTitle) {
      // Single / racing: title, market, event, date.
      var sub = body.length && !isEventLine(body[0].text) && !isDateLine(body[0].text) ? body.shift() : null;
      var leg = legFromPair(headTitle, sub || { text: "" });
      var evL = body.find(function (l) { return isEventLine(l.text); });
      var dtL = body.find(function (l) { return isDateLine(l.text); });
      leg.event = evL ? canonicalEvent(evL.text) : "";
      if (leg.kind === "racing" || RACE_EVENT_RE.test(leg.event)) {
        slip.bet_type = slip.bet_type || "Racing";
        if (leg.kind !== "racing") { leg.kind = "racing"; }
        var rr = leg.event.match(/^(.+?) • Race (\d+)$/);
        if (rr) { leg.venue = rr[1]; leg.race = parseInt(rr[2], 10); }
      } else slip.bet_type = slip.bet_type || "Single";
      leg.odds = slip.odds;
      if (dtL) { var pd = parseSlipDate(dtL.text, opts.now); leg.date_time = pd.display; leg.start_local = pd.local; }
      if (lowConf(evL)) flag(leg.flags, "event", "Event read with low confidence");
      slip.legs = [leg];
      slip.leg_count = 1;
      slip.event = leg.event;
      if (dtL) { slip.date_time = leg.date_time; slip.start_local = leg.start_local; if (!parseSlipDate(dtL.text, opts.now).ok) flag(flags, "date_time", "Date/time not understood"); }
      else flag(flags, "date_time", "No date/time found");
      if (!evL) flag(flags, "event", "No event found");
    } else {
      // Multi / SGM. Event + date lines either head the slip (SGM) or sit with each leg.
      var curEvent = null, curDate = null, legs = [], pendingTitle = null, dropped = [];
      var evBefore = null;   // multi layout: event block before (true) or after (false) its leg
      var attach = function (leg) { leg.event = curEvent ? canonicalEvent(curEvent.text) : ""; leg.event_conf = curEvent ? curEvent.conf : null; leg._date = curDate; legs.push(leg); };
      for (var k = 0; k < body.length; k++) {
        var ln = body[k];
        if (isEventLine(ln.text)) {
          if (evBefore === null) evBefore = legs.length === 0 && !pendingTitle;
          if (pendingTitle) { attach(legFromPair(pendingTitle, null)); pendingTitle = null; }
          if (!evBefore && legs.length) {
            // Event-after layout: this block belongs to legs collected since the last block.
            var dt = body[k + 1] && isDateLine(body[k + 1].text) ? body[k + 1] : null;
            for (var q = legs.length - 1; q >= 0 && !legs[q]._evAfter; q--) {
              legs[q].event = canonicalEvent(ln.text); legs[q].event_conf = ln.conf; legs[q]._date = dt; legs[q]._evAfter = true;
            }
            if (dt) k++;
            continue;
          }
          // A date that heads the slip ("Tomorrow 16 Oct 11:16" then the game) stays with the event.
          var keepDate = (legs.length === 0 && !pendingTitle) ? curDate : null;
          curEvent = ln;
          curDate = keepDate;
          continue;
        }
        if (isDateLine(ln.text)) { curDate = ln; continue; }
        if (slip.leg_count == null && ln.text.length < 20 && /\b\d{1,2}\s*legs?\s*$/i.test(ln.text)) { slip.leg_count = parseInt(ln.text.match(/(\d{1,2})\s*legs?\s*$/i)[1], 10); continue; }
        // "Over 220.5" / "Total Points": the over line is the selection, not a player-prop subtitle.
        var totalTitle = /^(over|under)\s+\(?\+?\d+(?:\.\d+)?\)?\s*$/i.test(ln.text) && body[k + 1] && (TOTAL_MARKET_RE.test(body[k + 1].text) || TEAM_TOTAL_MARKET_RE.test(body[k + 1].text));
        if (isSubLine(ln.text) && !totalTitle) {
          if (pendingTitle) { attach(legFromPair(pendingTitle, ln)); pendingTitle = null; }
          else { var orphan = legFromPair({ text: "", conf: ln.conf }, ln); orphan.flags.push({ field: "selection", reason: "Selection missing" }); attach(orphan); }
        } else {
          // A title with no market under it, followed by another title, is usually icon/header
          // noise. Drop it only when it is clearly noise (tiny or low-confidence); otherwise keep it
          // as a leg and let the market flag ask the user.
          if (pendingTitle) {
            if (isNoiseTitle(pendingTitle)) dropped.push(pendingTitle.text);
            else attach(legFromPair(pendingTitle, null));
          }
          pendingTitle = ln;
        }
      }
      if (pendingTitle) attach(legFromPair(pendingTitle, null));
      legs.forEach(function (leg) {
        if (leg._date) { var p = parseSlipDate(leg._date.text, opts.now); leg.date_time = p.display; leg.start_local = p.local;
          if (!p.ok) flag(leg.flags, "date_time", "Date/time not understood"); }
        else { leg.date_time = ""; leg.start_local = ""; }
        if (!leg.event) flag(leg.flags, "event", "No game found for this leg");
        if (lowConf({ conf: leg.event_conf })) flag(leg.flags, "event", "Game read with low confidence");
        delete leg._date; delete leg._evAfter; delete leg.event_conf;
      });
      slip.legs = legs;
      if (dropped.length) slip.dropped_lines = dropped;
      if (!slip.bet_type) slip.bet_type = legs.length > 1 ? "Multi" : "Single";
    }

    return finishSlip(slip, lines, rawText);
  }

  function finishSlip(slip, lines, rawText) {
    var flags = slip.flags;
    slip.legs.forEach(function (leg, i) {
      leg.sport = detectSport(leg.event, [leg]);
      if (!leg.sport) flag(leg.flags, "sport", "Sport not recognised");
      if (lowConf({ conf: leg.conf })) flag(leg.flags, "selection", "Leg read with low confidence");
      if (!leg.flags.some(function (f) { return f.field === "line"; }) && leg.kind === "player" && leg.line == null) flag(leg.flags, "line", "No line found");
      leg.flags.forEach(function (f) { flag(flags, f.field, f.reason, i); });
    });
    var evs = uniqueEvents(slip.legs);
    if (!slip.event) slip.event = evs.length === 1 ? evs[0] : evs.length ? evs.join(" · ") : "";
    if (!slip.date_time && slip.legs.length) {
      var dts = slip.legs.map(function (l) { return l.start_local; }).filter(Boolean).sort();
      var first = slip.legs.find(function (l) { return l.start_local === dts[0]; });
      if (first) { slip.date_time = first.date_time; slip.start_local = first.start_local; }
    }
    var sports = slip.legs.map(function (l) { return l.sport; }).filter(Boolean);
    slip.sport = sports.length && sports.every(function (s) { return s === sports[0]; }) ? sports[0] : (sports.length ? "Mixed" : "");
    if (!slip.sport) flag(flags, "sport", "Sport not recognised");
    if (slip.bet_type === "Same Game Multi" && evs.length > 1) flag(flags, "event", "Same game multi shows more than one game");
    if (slip.leg_count != null && slip.leg_count !== slip.legs.length) flag(flags, "legs", "Slip says " + slip.leg_count + " legs but " + slip.legs.length + " were read");
    if (slip.leg_count == null) slip.leg_count = slip.legs.length;
    var dollars = readStake(lines, rawText);
    if (!(dollars > 0) && slip.stake_dollars > 0) dollars = slip.stake_dollars;
    if (dollars > 0) {
      slip.stake_dollars = dollars;
      slip.stake_mode = "dollars";
    } else {
      slip.stake_dollars = null;
      slip.stake_mode = "units";
      flag(flags, "stake", "Stake isn't on the slip \u2014 enter it");
    }
    if (!(slip.returns_dollars > 0)) {
      var ret = readReturns(lines, rawText);
      if (ret > 0) slip.returns_dollars = ret;
    }
    slip.game_groups = groupLegsByEvent(slip.legs);
    return slip;
  }

  function moneyBlob(lines, rawText) {
    var parts = (lines || []).map(function (l) {
      if (l == null) return "";
      if (typeof l === "string") return l;
      return String(l.text || "");
    });
    parts.push(String(rawText || ""));
    return parts.join("\n");
  }
  function readStake(lines, rawText) {
    var blob = moneyBlob(lines, rawText);
    var m = blob.match(/(?:stake|staked|bet\s*amount|wager)\s*[:\-]?\s*(?:\n\s*)?\$\s*(\d+(?:\.\d{1,2})?)/i);
    if (m) return num(m[1]);
    var sources = blob.split("\n");
    var i, text;
    for (i = 0; i < sources.length; i++) {
      text = sources[i];
      m = text.match(/\$\s*(\d+(?:\.\d{1,2})?)/);
      if (m && /stake|staked|wager|bet\s*amount/i.test(text)) return num(m[1]);
    }
    return null;
  }
  function readReturns(lines, rawText) {
    var blob = moneyBlob(lines, rawText);
    var m = blob.match(/(?:potential\s*returns?|est\.?\s*returns?|to\s*return|returns?)\s*[:\-]?\s*(?:\n\s*)?\$\s*(\d+(?:\.\d{1,2})?)/i);
    return m ? num(m[1]) : null;
  }

  function supportedSlipsNote() {
    return "Supported slips: " + SLIP_REGISTRY.map(function (row) { return row.label; }).join(", ") + ".";
  }
  function looksLikeNbaProp(text) {
    var s = low(text);
    if (/\b(same\s*game\s*multi|sgm|\d+\s*legs?\b|multi(?:\s*bet)?)\b/.test(s)) return false;
    var prop = /(\d+(?:\.\d+)?\s*\+\s*(?:threes?(?:\s*made)?|points|rebounds?|assists?|steals?|blocks?))|((?:over|under)\s+\d+(?:\.\d+)?)|((?:over|under)\s+\d+(?:\.\d+)?\s+\S+)/.test(s);
    var stat = /(assists?|rebounds?|points|threes?(?:\s*made)?|steals?|blocks?)/.test(s);
    return prop && stat;
  }
  function confMap(input) {
    var map = {};
    var src = input && input.lines ? input.lines : [];
    src.forEach(function (ln) {
      if (!ln || typeof ln.conf !== "number") return;
      var t = squash(ln.text || "");
      if (!t) return;
      if (map[t] == null || ln.conf < map[t]) map[t] = ln.conf;
    });
    return map;
  }
  function isMarketLabel(t) {
    var s = low(t).replace(/\s*(o\/u|over\s*\/\s*under)\s*$/i, "").replace(/^player\s+/, "").trim();
    if (canonCombo(s)) return true;
    return /^(points|rebounds?|assists?|threes?(?:\s*made)?|steals?|blocks?|pra|pts|reb|ast)$/i.test(s);
  }
  function tagPropLine(text, index, confs) {
    var t = squash(text);
    var tag = { text: t, index: index, conf: Object.prototype.hasOwnProperty.call(confs, t) ? confs[t] : null };
    if (/^single$/i.test(t)) { tag.kind = "bet"; return tag; }
    if (/^(ladbrokes|bet\s*365|bet365|points\s*bet|pointsbet|neds|tab|sportsbet|my bets|open|pending)$/i.test(t)) { tag.kind = "noise"; return tag; }
    if (PROP_FOOTER_RE.test(t) || RESPONSIBLE_RE.test(t)) { tag.kind = "footer"; return tag; }
    if (isEventLine(t)) { tag.kind = "event"; tag.event = canonicalEvent(t); return tag; }
    if (isDateLine(t)) { tag.kind = "date"; return tag; }
    if (BARE_TIME_RE.test(t)) { tag.kind = "time"; return tag; }
    var at = t.match(/^@\s*(\d+(?:[.,]\d+)?)\s*$/);
    if (at) { tag.kind = "odds"; tag.odds = num(at[1]); return tag; }
    var ouTitle = t.match(/^(.+?)\s+(over|under)\s+(\d+(?:\.\d+)?)$/i);
    if (ouTitle && letters(ouTitle[1]) >= 2 && !isMarketLabel(ouTitle[1])) {
      tag.kind = "ouTitle"; tag.player = squash(ouTitle[1]); tag.side = wordCap(ouTitle[2]); tag.line = parseFloat(ouTitle[3]); return tag;
    }
    var ouStat = t.match(/^(over|under)\s+(\d+(?:\.\d+)?)\s+(.+)$/i);
    if (ouStat) { tag.kind = "ouStat"; tag.side = wordCap(ouStat[1]); tag.line = parseFloat(ouStat[2]); tag.statRaw = squash(ouStat[3]); return tag; }
    var plus = t.match(/^(\d+(?:\.\d+)?)\s*\+\s+(.+)$/);
    if (plus && /[A-Za-z]/.test(plus[2])) { tag.kind = "plus"; tag.line = parseFloat(plus[1]); tag.statRaw = squash(plus[2]); return tag; }
    if (isMarketLabel(t)) { tag.kind = "market"; tag.statRaw = t; return tag; }
    if (/^[A-Za-z][A-Za-z'’. -]{1,60}$/.test(t) && letters(t) >= 3) { tag.kind = "name"; tag.name = t; return tag; }
    tag.kind = "other";
    return tag;
  }
  function tagIsLow(tag) { return tag && typeof tag.conf === "number" && tag.conf < LOW_CONF; }
  function bareTimeText(text) {
    var m = String(text || "").match(BARE_TIME_RE);
    if (!m) return "";
    var hh = applyAmPm(parseInt(m[1], 10), m[3]);
    var mm = parseInt(m[2], 10);
    if (hh > 23 || mm > 59) return "";
    var pad = function (n) { return (n < 10 ? "0" : "") + n; };
    return pad(hh) + ":" + pad(mm);
  }
  /** NBA player-prop singles (Ladbrokes O/U label, bet365 N+ line, PointsBet away @ home).
   *  Returns null when the text is not one of those slips, so the Sportsbet parser still runs.
   *  A missing or header-only time is flagged, never copied in as the game time. */
  function claimPlayerPropSingle(input, rawText, opts) {
    var bookie = detectBookie(rawText);
    if (bookie !== "ladbrokes" && bookie !== "bet365" && bookie !== "pointsbet") return null;
    if (!looksLikeNbaProp(rawText)) return null;
    opts = opts || {};
    var confs = confMap(input);
    var raw = normalizeText(rawText).split("\n").map(squash).filter(Boolean);
    var tags = [], sawProp = false;
    for (var i = 0; i < raw.length; i++) {
      if (RESPONSIBLE_RE.test(raw[i])) break;
      var tag = tagPropLine(raw[i], i, confs);
      if (tag.kind === "footer" && sawProp) break;
      if (tag.kind === "footer" || tag.kind === "noise") continue;
      if (tag.kind === "ouTitle" || tag.kind === "ouStat" || tag.kind === "plus") sawProp = true;
      tags.push(tag);
    }
    var flags = [];
    var slip = {
      bookie: bookie, bet_type: "Single", odds: null, leg_count: 1, stake: null, sport: "",
      event: "", date_time: "", start_local: "", legs: [], flags: flags, raw_text: normalizeText(rawText)
    };
    var nameBefore = null, player = "", side = "", line = null, statRaw = "", plus = false;
    var playerConf = null, statConf = null;
    tags.forEach(function (tag, idx) {
      if (tag.kind === "name") { nameBefore = tag; return; }
      if (tag.kind === "ouTitle") {
        player = tag.player; side = tag.side; line = tag.line; playerConf = tag.conf;
        var nxt = tags[idx + 1];
        if (nxt && nxt.kind === "market") { statRaw = nxt.statRaw; statConf = nxt.conf; }
        return;
      }
      if (tag.kind === "ouStat" || tag.kind === "plus") {
        if (!player && nameBefore) { player = nameBefore.name; playerConf = nameBefore.conf; }
        side = tag.kind === "plus" ? "Over" : tag.side;
        line = tag.line;
        plus = tag.kind === "plus";
        statRaw = tag.statRaw;
        statConf = tag.conf;
      }
    });
    var cs = statRaw ? canonStat(statRaw) : { stat: "", unknown: true };
    var leg = {
      selection: player, market: cs.stat || statRaw, player: player, team: "", stat: cs.stat || "",
      line: line, side: side, plus: plus, odds: null, kind: "player", flags: [],
      conf: typeof playerConf === "number" ? playerConf : null, stat_sport: cs.sport || ""
    };
    if (!player) leg.flags.push({ field: "selection", reason: "Selection missing" });
    if (!statRaw || cs.unknown) leg.flags.push({ field: "stat", reason: statRaw ? ("Unrecognised market \u201c" + (cs.stat || statRaw) + "\u201d") : "Market not on the slip" });
    else if (tagIsLow({ conf: statConf })) leg.flags.push({ field: "stat", reason: "Market read with low confidence" });
    if (line == null) leg.flags.push({ field: "line", reason: "No line found" });
    if (!side) leg.flags.push({ field: "side", reason: "Side not on the slip" });
    var evTag = null, oddsTag = null;
    tags.forEach(function (tag) {
      if (tag.kind === "event" && !evTag) evTag = tag;
      if (tag.kind === "odds" && !oddsTag) oddsTag = tag;
    });
    leg.event = evTag ? evTag.event : "";
    if (!evTag) flag(flags, "event", "No event found");
    else if (tagIsLow(evTag)) flag(flags, "event", "Event read with low confidence");
    var propTag = null;
    tags.forEach(function (tag) {
      if (!propTag && (tag.kind === "ouTitle" || tag.kind === "ouStat" || tag.kind === "plus" || tag.kind === "name")) propTag = tag;
    });
    var whens = tags.filter(function (tag) { return tag.kind === "date" || tag.kind === "time"; });
    var afterEvent = evTag ? whens.filter(function (tag) { return tag.index > evTag.index; }) : [];
    var afterProp = propTag ? whens.filter(function (tag) { return tag.index > propTag.index; }) : [];
    var chosen = afterEvent[0] || afterProp[0] || (bookie === "bet365" ? null : (whens[0] || null));
    if (!chosen) flag(flags, "date_time", "No date/time found");
    else if (chosen.kind === "time") {
      var clock = bareTimeText(chosen.text);
      leg.date_time = clock || squash(chosen.text);
      leg.start_local = "";
      flag(flags, "date_time", "Date not on the slip");
      if (tagIsLow(chosen)) flag(flags, "date_time", "Date/time read with low confidence");
    } else {
      var pd = parseSlipDate(chosen.text, opts.now);
      leg.date_time = pd.ok ? pd.display : squash(chosen.text);
      leg.start_local = pd.local || "";
      if (!pd.ok) flag(flags, "date_time", "Date/time not understood");
      if (tagIsLow(chosen)) flag(flags, "date_time", "Date/time read with low confidence");
    }
    slip.event = leg.event;
    slip.date_time = leg.date_time || "";
    slip.start_local = leg.start_local || "";
    if (oddsTag && oddsTag.odds > 1) {
      slip.odds = oddsTag.odds;
      leg.odds = oddsTag.odds;
      if (tagIsLow(oddsTag)) flag(flags, "odds", "Odds read with low confidence");
    } else flag(flags, "odds", "Total odds not read");
    slip.legs = [leg];
    var kept = tags.map(function (tag) { return tag.text; });
    return finishSlip(slip, kept, kept.join("\n"));
  }

  function legHasFlag(leg, field) {
    return ((leg && leg.flags) || []).some(function (f) { return f && f.field === field; });
  }

  function legAutoLinked(leg) {
    if (!leg) return false;
    var game = !!String(leg.game_id || "").trim() || (!!String(leg.event || "").trim() && !legHasFlag(leg, "event"));
    var who = String(leg.player || leg.selection || leg.team || "").trim();
    var player = !!who && !legHasFlag(leg, "selection") && !legHasFlag(leg, "player") && !legHasFlag(leg, "team");
    var marketName = String(leg.market || leg.stat || "").trim();
    var market = !!marketName && !legHasFlag(leg, "market") && !legHasFlag(leg, "stat");
    var lineApplies = leg.kind === "player" || legHasFlag(leg, "line") || (leg.line != null && leg.line !== "");
    var line = !lineApplies || (leg.line != null && leg.line !== "" && !legHasFlag(leg, "line"));
    return !!(game && player && market && line);
  }

  function parseSlipText(text, opts) { return parseSlipLines(String(text || ""), opts); }
  function parseSportsbet(text, opts) { var s = parseSlipLines(text, opts); s.bookie = "sportsbet"; return s; }

  // ── Browser OCR (same code path the harness drives in headless Chromium) ──
  /** Preprocess on a canvas: upscale small shots (tesseract wants ~30px glyphs), grayscale,
   *  and invert dark-mode slips so text is dark on light. Returns a canvas. */
  function preprocessToCanvas(img, doc) {
    doc = doc || root.document;
    var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    var scale = w < 1000 ? Math.min(3, 1000 / w) : 1;
    var c = doc.createElement("canvas");
    c.width = Math.round(w * scale); c.height = Math.round(h * scale);
    var ctx = c.getContext("2d");
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, c.width, c.height);
    var d = ctx.getImageData(0, 0, c.width, c.height), p = d.data, lumSum = 0, n = 0;
    for (var i = 0; i < p.length; i += 4) {
      var y = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
      p[i] = p[i + 1] = p[i + 2] = y; lumSum += y; n++;
    }
    // Dark slip: the card itself is dark. Sample the central band (cards sit there).
    var cx0 = Math.round(c.width * 0.2), cx1 = Math.round(c.width * 0.8), cy0 = Math.round(c.height * 0.25), cy1 = Math.round(c.height * 0.75);
    var cs = 0, cn = 0;
    for (var yy = cy0; yy < cy1; yy += 4) for (var xx = cx0; xx < cx1; xx += 4) { cs += p[(yy * c.width + xx) * 4]; cn++; }
    var invert = cn && cs / cn < 110;
    if (invert) for (var j = 0; j < p.length; j += 4) { p[j] = p[j + 1] = p[j + 2] = 255 - p[j]; }
    ctx.putImageData(d, 0, 0);
    c._slipInverted = !!invert; c._slipScale = scale;
    return c;
  }
  function loadImage(src, doc) {
    doc = doc || root.document;
    return new Promise(function (res, rej) {
      var img = new root.Image();
      var url = typeof src === "string" ? src : root.URL.createObjectURL(src);
      img.onload = function () { if (typeof src !== "string") root.URL.revokeObjectURL(url); res(img); };
      img.onerror = function () { rej(new Error("bad image")); };
      img.src = url;
    });
  }
  /** Run tesseract on an image (File/Blob/URL). Returns { text, lines:[{text, conf, words}], width }. */
  async function recognizeImage(Tesseract, src, base) {
    var img = await loadImage(src);
    var canvas = preprocessToCanvas(img);
    var worker = await Tesseract.createWorker("eng", 1, {
      workerPath: base + "worker.min.js", corePath: base + "core/", langPath: base + "lang/", gzip: true
    });
    try {
      await worker.setParameters({ tessedit_pageseg_mode: "6", preserve_interword_spaces: "1" });
      var out = await worker.recognize(canvas, {}, { text: true, blocks: true });
      var data = (out && out.data) || {};
      var lines = [];
      (data.blocks || []).forEach(function (b) {
        (b.paragraphs || []).forEach(function (pp) {
          (pp.lines || []).forEach(function (l) {
            lines.push({
              text: l.text, conf: l.confidence,
              words: (l.words || []).map(function (wd) { return { text: wd.text, conf: wd.confidence, x0: wd.bbox.x0, x1: wd.bbox.x1 }; })
            });
          });
        });
      });
      return { text: data.text || "", lines: lines, width: canvas.width, inverted: canvas._slipInverted };
    } finally {
      await worker.terminate();
    }
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

  function sideMatch(fixtureSide, slipSide) {
    if (!fixtureSide || !slipSide) return false;
    if (fixtureSide === slipSide) return true;
    if (fixtureSide.indexOf(slipSide) >= 0 || slipSide.indexOf(fixtureSide) >= 0) return true;
    return false;
  }
  function teamsMatchEvent(game, eventName) {
    var teams = splitEventTeams(eventName);
    if (!teams.home || !teams.away) return false;
    var ht = normTeamToken(teams.home);
    var at = normTeamToken(teams.away);
    var gh = normTeamToken(fixtureTeamName(game.hteam));
    var ga = normTeamToken(fixtureTeamName(game.ateam));
    var htBare = ht.replace(/\bw\b/g, "").trim();
    var atBare = at.replace(/\bw\b/g, "").trim();
    return (sideMatch(gh, ht) && sideMatch(ga, at)) || (sideMatch(gh, htBare) && sideMatch(ga, atBare));
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
        if (hit.espn_event_id) copy.espn_event_id = String(hit.espn_event_id);
        if (hit.league) copy.league = hit.league;
        if (hit.date) copy.game_start = hit.date;
      }
      return copy;
    });
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
      start_local: slip.start_local || "",
      game_start: slip.game_start || slip.start_local || "",
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
      bet365: "bet365",
    };
    return map[slug] || "";
  }

  var NFL_PROP_KEYS = { "Passing Yards": "passing_yards", "Rushing Yards": "rushing_yards", "Receiving Yards": "receiving_yards",
    "Receptions": "receptions", "Passing TDs": "passing_tds", "Rushing TDs": "rushing_tds", "Receiving TDs": "receiving_tds",
    "Completions": "completions", "Interceptions": "interceptions", "Anytime TD": "anytime_td" };
  var BASKETBALL_PROP_KEYS = {
    "Points": "points", "Rebounds": "rebounds", "Assists": "assists", "Threes Made": "threes_made", "Threes": "threes_made",
    "Steals": "steals", "Blocks": "blocks", "Points + Rebounds + Assists": "pra", "PRA": "pra",
    "Points + Assists": "pa", "Points + Rebounds": "pr", "Rebounds + Assists": "ra"
  };
  var AFL_STATS = { Disposals: 1, Goals: 1, Marks: 1, Tackles: 1, Kicks: 1, Handballs: 1, "Fantasy Points": 1 };
  var ESPN_PATH = { nfl: "football/nfl", nba: "basketball/nba", wnba: "basketball/wnba", nbl: "basketball/nbl" };
  var ESPN_SITE = "https://site.api.espn.com/apis/site/v2/sports";
  /** Human description of a structured leg ("Megan Fitzsimon 15+ Disposals"). */
  function legDescription(leg) {
    leg = leg || {};
    if (leg.kind === "racing") return String(leg.selection || "") + (leg.market ? " (" + leg.market + ")" : "");
    if (leg.kind === "team" && leg.market === "Team Total" && leg.line != null) return String(leg.team || "") + " Team Total " + (leg.side === "Under" ? "Under " : "Over ") + leg.line;
    if (leg.kind === "team" && leg.market === "Line" && leg.line != null && leg.team) return String(leg.team) + " " + (Number(leg.line) > 0 ? "+" : "") + leg.line;
    if (leg.kind === "team") return String(leg.team || leg.selection || "") + " " + (leg.market || "");
    if (leg.player && leg.stat) {
      if (leg.stat === "Anytime TD") return leg.player + " Anytime TD";
      var ln = leg.line != null ? String(leg.line) : "?";
      if (leg.side === "Under") return leg.player + " Under " + ln + " " + leg.stat;
      if (leg.plus || leg.side !== "Over") return leg.player + " " + ln + "+ " + leg.stat;
      return leg.player + " Over " + ln + " " + leg.stat;
    }
    var sel = String(leg.selection || "").trim(), mkt = String(leg.market || "").trim();
    return sel && mkt ? sel + " \u2014 " + mkt : sel || mkt;
  }
  function espnLeagueForSport(sport) {
    var s = String(sport || "").toLowerCase();
    if (s === "nfl" || s === "nba" || s === "wnba" || s === "nbl") return s;
    return "";
  }
  function wordCap(s) {
    s = String(s || "");
    return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "";
  }
  /** Over/Under plus a numeric line. A missing piece must not be invented. */
  function propComplete(leg) {
    var side = String(leg && leg.side || "").toLowerCase();
    if (side !== "over" && side !== "under") return false;
    if (leg.line == null || leg.line === "") return false;
    var n = Number(leg.line);
    return isFinite(n);
  }
  /** Builder leg. Recognised props, head-to-head, line and total stay structured.
   *  A recognised prop with no line or side stays custom so the tip is not rejected.
   *  A leg is custom only when none of those match. Racing stays a free-text leg. */
  function legToBuilderLeg(leg) {
    leg = leg || {};
    var out = { desc: legDescription(leg) };
    if (leg.game_id) out.game_id = String(leg.game_id);
    if (leg.espn_event_id) out.espn_event_id = String(leg.espn_event_id);
    if (leg.event) out.game = leg.event;
    if (leg.odds > 1) out.odds = leg.odds;
    if (leg.kind === "racing") { out.custom = true; return out; }

    var sport = String(leg.sport || "").toUpperCase();
    var league = leg.league || espnLeagueForSport(sport);
    var mkt = String(leg.market || leg.stat || "");
    var who = leg.team || leg.selection || leg.player || "";
    var matched = false;
    var incompleteProp = false;
    var side = String(leg.side || "").toLowerCase() === "under" ? "Under" : (String(leg.side || "").toLowerCase() === "over" ? "Over" : "");

    if (leg.player && BASKETBALL_PROP_KEYS[leg.stat] && sport !== "NFL" && sport !== "AFL" && sport !== "AFLW") {
      if (!league) league = espnLeagueForSport(sport);
      if (propComplete(leg)) {
        out.player = leg.player; out.stat = leg.stat; out.prop = BASKETBALL_PROP_KEYS[leg.stat]; out.prop_key = out.prop;
        out.line = Number(leg.line); out.side = side;
        if (leg.plus && leg.stat === "Threes Made") {
          var nPlus = Math.round(Number(leg.line));
          if (nPlus >= 1 && nPlus <= 6 && Math.abs(Number(leg.line) - nPlus) < 1e-9) {
            out.stat = nPlus + "+ Threes Made";
            out.market = out.stat;
            out.plus = true;
            out.desc = leg.player + " " + out.stat;
          }
        }
        matched = true;
      } else incompleteProp = true;
    } else if (leg.player && NFL_PROP_KEYS[leg.stat] && sport !== "AFL" && sport !== "AFLW" && sport !== "NBA" && sport !== "WNBA" && sport !== "NBL") {
      if (!league) league = "nfl";
      if (propComplete(leg)) {
        out.player = leg.player; out.stat = leg.stat; out.prop = NFL_PROP_KEYS[leg.stat]; out.prop_key = out.prop;
        out.line = Number(leg.line); out.side = side;
        matched = true;
      } else incompleteProp = true;
    } else if ((sport === "AFL" || sport === "AFLW") && leg.player && AFL_STATS[leg.stat]) {
      if (propComplete(leg)) {
        out.player = leg.player; out.stat = leg.stat; out.line = Number(leg.line); out.side = side;
        matched = true;
      } else incompleteProp = true;
    } else if (/head\s*to\s*head|^h2h$|match\s*betting|money\s*line|^moneyline$|^to\s*win$|^win$|win\s*-?\s*draw\s*-?\s*win|match\s*result|^1x2$/i.test(mkt) && who) {
      out.kind = "team";
      out.market = /win\s*-?\s*draw|match\s*result|^1x2$/i.test(mkt) ? "Win-Draw-Win" : "Head to Head";
      out.team = who;
      matched = true;
    } else if (LINE_MARKET_RE.test(mkt) || leg.market === "Line" || leg.kind === "line") {
      var signed = String(leg.selection || leg.team || "").match(/^(.+?)\s+([+-]\d+(?:\.\d+)?)$/);
      out.kind = "team"; out.market = "Line";
      out.team = signed ? squash(signed[1]) : (leg.team || leg.selection || "");
      out.line = leg.line != null ? leg.line : (signed ? parseFloat(signed[2]) : null);
      matched = !!(out.team || out.line != null);
    } else if (leg.market === "Team Total" && leg.team) {
      out.kind = "team"; out.market = "Team Total"; out.team = leg.team;
      out.side = side; out.line = leg.line != null ? leg.line : null;
      matched = out.line != null && !!side;
    } else if (TOTAL_MARKET_RE.test(mkt) || leg.market === "Total" || leg.kind === "total") {
      var tot = String(leg.selection || leg.desc || "").match(/\b(over|under)\s+(\d+(?:\.\d+)?)/i);
      out.kind = "total"; out.market = "Total";
      out.side = leg.side || (tot ? wordCap(tot[1]) : "");
      out.line = leg.line != null ? leg.line : (tot ? parseFloat(tot[2]) : null);
      matched = out.line != null || !!out.side;
    }

    if (league && (matched || incompleteProp)) out.league = league;
    if (!matched) {
      out.custom = true;
      // A recognised prop with no line or side stays free text. Player and stat
      // are left off so it is not queued as a prop.
      if (!incompleteProp && leg.player && leg.stat) {
        out.player = leg.player; out.stat = leg.stat; out.line = leg.line;
        if (side) out.side = side;
      }
    }
    return out;
  }

  function ymdFromWhen(when) {
    var s = String(when || "");
    var iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
    if (iso) return iso[1];
    var parsed = parseSlipDate(s);
    return parsed.local ? parsed.local.slice(0, 10) : "";
  }
  function datesAround(ymd) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return [""];
    var d = new Date(ymd + "T12:00:00Z");
    return [-1, 0, 1].map(function (n) {
      var x = new Date(d.getTime());
      x.setUTCDate(x.getUTCDate() + n);
      return x.toISOString().slice(0, 10).replace(/-/g, "");
    });
  }
  function espnScoreboardUrl(league, yyyymmdd) {
    var path = ESPN_PATH[String(league || "").toLowerCase()];
    if (!path) return "";
    var q = "limit=100";
    if (yyyymmdd) q += "&dates=" + yyyymmdd;
    return ESPN_SITE + "/" + path + "/scoreboard?" + q;
  }
  function espnLeaguesToLoad(sport, eventName) {
    var one = espnLeagueForSport(sport);
    if (one) return [one];
    var s = String(sport || "").toUpperCase();
    if (s === "AFL" || s === "AFLW" || s === "NRL" || s === "SOCCER" || s === "RACING") return [];
    var scored = [];
    ["NFL", "NBA", "WNBA", "NBL"].forEach(function (k) {
      var n = teamHits(eventName || "", k);
      if (n > 0) scored.push({ league: espnLeagueForSport(k), n: n });
    });
    if (!scored.length) return [];
    var top = scored.reduce(function (m, row) { return row.n > m ? row.n : m; }, 0);
    return scored.filter(function (row) { return row.n === top; }).map(function (row) { return row.league; });
  }
  function eventsFromScoreboard(data, league) {
    var lg = String(league || "").toLowerCase();
    return ((data && data.events) || []).map(function (e) {
      var comp = (e && e.competitions && e.competitions[0]) || {};
      var comps = comp.competitors || [];
      var awayC = null, homeC = null;
      comps.forEach(function (c) {
        if (c && c.homeAway === "away") awayC = c;
        if (c && c.homeAway === "home") homeC = c;
      });
      if (!awayC) awayC = comps[1] || comps[0] || {};
      if (!homeC) homeC = comps[0] || {};
      var awayName = (awayC.team && (awayC.team.displayName || awayC.team.name)) || "";
      var homeName = (homeC.team && (homeC.team.displayName || homeC.team.name)) || "";
      var id = e && e.id != null ? String(e.id) : "";
      return {
        id: id,
        espn_event_id: id,
        game_id: id,
        comp: lg.toUpperCase(),
        league: lg,
        date: (e && e.date) || "",
        game_name: awayName && homeName ? awayName + " @ " + homeName : ((e && e.name) || ""),
        hteam: { name: homeName },
        ateam: { name: awayName }
      };
    }).filter(function (g) { return g.id; });
  }
  async function loadEspnFixtures(leagues, when, fetchJson) {
    if (!fetchJson) return [];
    var dates = datesAround(ymdFromWhen(when));
    var seen = {};
    var out = [];
    for (var i = 0; i < leagues.length; i++) {
      for (var d = 0; d < dates.length; d++) {
        var url = espnScoreboardUrl(leagues[i], dates[d]);
        if (!url) continue;
        try {
          var data = await fetchJson(url);
          eventsFromScoreboard(data, leagues[i]).forEach(function (g) {
            if (seen[g.id]) return;
            seen[g.id] = true;
            out.push(g);
          });
        } catch (err) { /* this date missed; queue still sends the slip time */ }
      }
    }
    return out;
  }
  /** AFL fixture list, or the ESPN scoreboard for NBA/NBL/WNBA/NFL around the slip date. */
  async function loadSportFixtures(sport, when, eventName, deps) {
    if (eventName && typeof eventName === "object" && !deps) { deps = eventName; eventName = ""; }
    deps = deps || {};
    var leagues = espnLeaguesToLoad(sport, eventName || "");
    var games = [];
    if (!espnLeagueForSport(sport) && deps.loadAfl) {
      var afl = await deps.loadAfl();
      if (afl && afl.length) games = games.concat(afl);
    }
    if (leagues.length) games = games.concat(await loadEspnFixtures(leagues, when, deps.fetchJson));
    return games;
  }
  /** BUILD fields for a reviewed slip. A unique ESPN game is not a custom tip. */
  function builderStateForSlip(tip, primaryGame, opts) {
    tip = tip || {};
    opts = opts || {};
    var legs = (tip.legs || []).map(function (l) { return Object.assign({}, l); });
    var slipStart = (primaryGame && primaryGame.date) || tip.game_start || tip.start_local || "";
    var state = {
      custom: false, espn: false, espnLeague: "", espnEvent: null, game: primaryGame || null,
      customEvent: "", customSport: "", customStartDay: "", game_start: slipStart, legs: legs
    };
    var eid = primaryGame && (primaryGame.espn_event_id || (primaryGame.league && primaryGame.id));
    if (primaryGame && eid) {
      var id = String(primaryGame.espn_event_id || primaryGame.id);
      var league = primaryGame.league || espnLeagueForSport(primaryGame.comp || tip.sport);
      if (league && id) {
        state.espn = true;
        state.espnLeague = league;
        state.game = null;
        state.game_start = primaryGame.date || slipStart;
        state.espnEvent = {
          id: id,
          date: state.game_start,
          name: primaryGame.game_name || tip.game_name || "",
          away: primaryGame.ateam || null,
          home: primaryGame.hteam || null
        };
        state.legs = legs.map(function (l) {
          l.espn_event_id = id;
          l.game_id = id;
          if (!l.league) l.league = league;
          return l;
        });
        return state;
      }
    }
    if (primaryGame) return state;
    var events = uniqueEvents(opts.parsedLegs || []);
    var anyId = legs.some(function (l) { return l && (l.game_id || l.espn_event_id); });
    if (events.length <= 1 && !anyId) {
      state.custom = true;
      state.customEvent = events[0] || tip.game_name || "";
      state.customSport = tip.sport || "";
      state.customStartDay = String(slipStart || "").slice(0, 10);
    }
    return state;
  }

  /** "A v B" -> home A, away B. "A @ B" (US style) -> away A, home B. */
  function splitEventTeams(eventName) {
    var m = String(eventName || "").match(EVENT_RE);
    if (!m) return { home: "", away: "" };
    if (m[2] === "@") return { home: m[3].trim(), away: m[1].trim() };
    return { home: m[1].trim(), away: m[3].trim() };
  }


  function parseLadbrokes(text, opts) { return parseSlipLines(text, opts); }
  function parseNeds(text, opts) { return parseSlipLines(text, opts); }
  function parseTab(text, opts) { return parseSlipLines(text, opts); }
  function parsePointsbet(text, opts) { return parseSlipLines(text, opts); }

  var API = {
    LOW_CONF: LOW_CONF,
    normalizeText: normalizeText,
    detectBookie: detectBookie,
    detectSport: detectSport,
    cleanOcrLines: cleanOcrLines,
    parseSlipLines: parseSlipLines,
    parseSlipText: parseSlipText,
    supportedSlipsNote: supportedSlipsNote,
    SLIP_REGISTRY: SLIP_REGISTRY,
    readReturns: readReturns,
    parseSlipDate: parseSlipDate,
    parseSportsbet: parseSportsbet,
    parseLadbrokes: parseLadbrokes,
    parseNeds: parseNeds,
    parseTab: parseTab,
    parsePointsbet: parsePointsbet,
    recognizeImage: recognizeImage,
    preprocessToCanvas: preprocessToCanvas,
    slipToTipDraft: slipToTipDraft,
    legToBuilderLeg: legToBuilderLeg,
    legDescription: legDescription,
    splitEventTeams: splitEventTeams,
    bookmakerName: bookmakerName,
    uniqueEvents: uniqueEvents,
    groupLegsByEvent: groupLegsByEvent,
    fixtureEventLabel: fixtureEventLabel,
    fixtureGameId: fixtureGameId,
    fixtureComp: fixtureComp,
    matchEventToFixture: matchEventToFixture,
    attachFixtureMatches: attachFixtureMatches,
    readStake: readStake,
    legAutoLinked: legAutoLinked,
    teamsMatchEvent: teamsMatchEvent,
    espnLeagueForSport: espnLeagueForSport,
    espnScoreboardUrl: espnScoreboardUrl,
    espnLeaguesToLoad: espnLeaguesToLoad,
    eventsFromScoreboard: eventsFromScoreboard,
    loadSportFixtures: loadSportFixtures,
    builderStateForSlip: builderStateForSlip,
    datesAround: datesAround,
    ymdFromWhen: ymdFromWhen,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = API;
  root.TBSlipOcr = API;
})(typeof window !== "undefined" ? window : globalThis);
