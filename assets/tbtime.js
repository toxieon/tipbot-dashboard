/* tbtime.js: Tipdash's one clock. Every day, month, "today" and displayed time
 * is Australia/Sydney (DST-aware), whatever timezone the viewer's device is in.
 * TipBot stores UTC; a timestamp with no zone ("2026-09-27 09:30:00") is UTC,
 * same rule as the bot (afl_tipster_bot/timeutil.py).
 *
 * Plain script (window.TBTime) and CommonJS (tests: node --test tests/).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.TBTime = api;
}(typeof window !== "undefined" ? window : null, function () {
  "use strict";
  var TZ = "Australia/Sydney";
  var partsFmt = null;
  function fmtParts() {
    if (!partsFmt) {
      partsFmt = new Intl.DateTimeFormat("en-AU", {
        timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", weekday: "short"
      });
    }
    return partsFmt;
  }
  function pad(n) { return String(n).padStart(2, "0"); }

  /** Anything time-like → epoch ms (NaN if not parseable). Zone-less = UTC. */
  function toMs(v) {
    if (v == null || v === "") return NaN;
    if (v instanceof Date) return v.getTime();
    if (typeof v === "number") return v > 1e12 ? v : v * 1000;
    var s = String(v).trim();
    if (/^\d+(\.\d+)?$/.test(s)) return toMs(Number(s));
    var m = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?))?(Z|[+-]\d{2}:?\d{2})?$/i.exec(s);
    if (m) {
      var time = m[2] || "00:00:00";
      if (time.length === 5) time += ":00";
      var zone = m[3] || "Z";
      return Date.parse(m[1] + "T" + time + zone);
    }
    return Date.parse(s);
  }

  /** Sydney wall-clock parts for an instant. */
  function parts(v) {
    var ms = v === undefined ? Date.now() : toMs(v);
    if (!isFinite(ms)) return null;
    var out = {};
    fmtParts().formatToParts(new Date(ms)).forEach(function (p) { out[p.type] = p.value; });
    return {
      year: +out.year, month: +out.month, day: +out.day,
      hour: (+out.hour) % 24, minute: +out.minute, second: +out.second, weekday: out.weekday
    };
  }
  function dayKey(v) { var p = parts(v); return p ? p.year + "-" + pad(p.month) + "-" + pad(p.day) : ""; }
  function monthKey(v) { var k = dayKey(v); return k ? k.slice(0, 7) : ""; }
  function hour(v) { var p = parts(v); return p ? p.hour : NaN; }

  /** Offset (ms) of Sydney from UTC at an instant. */
  function offsetMs(ms) {
    var p = parts(ms);
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
  }
  /** Epoch ms of a Sydney wall-clock time (handles the DST jump). */
  function fromLocal(y, mo, d, h, mi) {
    var guess = Date.UTC(y, mo - 1, d, h || 0, mi || 0);
    var first = guess - offsetMs(guess);
    return guess - offsetMs(first);
  }
  /** ms until the next Sydney hh:00 (today or tomorrow). */
  function msUntilHour(targetHour, now) {
    var n = now === undefined ? Date.now() : toMs(now);
    var p = parts(n);
    var at = fromLocal(p.year, p.month, p.day, targetHour, 0);
    if (at <= n) {
      var next = new Date(Date.UTC(p.year, p.month - 1, p.day + 1));
      at = fromLocal(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), targetHour, 0);
    }
    return at - n;
  }
  /** "today" / "tomorrow" / "yesterday" / "" relative to now, in Sydney days. */
  function relDay(v, now) {
    var k = dayKey(v); if (!k) return "";
    var t = dayKey(now === undefined ? Date.now() : now);
    var a = Date.parse(k + "T00:00:00Z"), b = Date.parse(t + "T00:00:00Z");
    var diff = Math.round((a - b) / 864e5);
    return diff === 0 ? "today" : diff === 1 ? "tomorrow" : diff === -1 ? "yesterday" : "";
  }
  /** toLocaleString in Sydney. opts as Intl (timeZone forced). */
  function fmt(v, opts, locale) {
    var ms = toMs(v);
    if (!isFinite(ms)) return "";
    var o = {};
    for (var k in (opts || {})) o[k] = opts[k];
    o.timeZone = TZ;
    try { return new Date(ms).toLocaleString(locale || "en-AU", o); } catch (e) { return ""; }
  }
  /** Short game time: "Sat 27 Sep, 7:30 pm" (Sydney). */
  function fmtWhen(v) {
    return fmt(v, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  }
  /** Day/night theme: 7 am to 7 pm Sydney is "day". */
  function isDaytime(v) { var h = hour(v); return h >= 7 && h < 19; }

  return { TZ: TZ, toMs: toMs, parts: parts, dayKey: dayKey, monthKey: monthKey, hour: hour,
           fromLocal: fromLocal, msUntilHour: msUntilHour, relDay: relDay, fmt: fmt, fmtWhen: fmtWhen,
           isDaytime: isDaytime };
}));
