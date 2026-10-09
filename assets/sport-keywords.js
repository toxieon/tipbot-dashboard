/* Sport-routing keyword matcher (Phase 1.1). Same rules as TipBot services/sport_tags.py:
 * comma-separated terms, case-insensitive, accent-folded, whole-word, punctuation allowed.
 * Shared vectors: tests/fixtures/sport_keywords_vectors.json (identical bytes in both repos).
 * Browser global window.TBSportKeywords + CommonJS export for node --test.
 */
(function (root) {
  "use strict";
  var MAX_TERMS = 50, MAX_TERM_LEN = 60;
  var WORD = /[\p{L}\p{N}]/u;
  function fold(text) {
    var s = String(text == null ? "" : text).replace(/[‘’]/g, "'");
    s = s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
    return s.split(/\s+/).filter(Boolean).join(" ");
  }
  function parseTerms(raw) {
    var parts = Array.isArray(raw) ? raw.map(String) : String(raw == null ? "" : raw).split(",");
    var out = [];
    parts.forEach(function (p) { var t = fold(p); if (t && out.indexOf(t) === -1) out.push(t); });
    return out;
  }
  function validateTerms(raw) {
    var terms = parseTerms(raw);
    if (terms.length > MAX_TERMS) return { terms: terms.slice(0, MAX_TERMS), error: "at most " + MAX_TERMS + " keywords per tag" };
    for (var i = 0; i < terms.length; i++) {
      if (terms[i].length > MAX_TERM_LEN) return { terms: terms, error: "keyword too long (max " + MAX_TERM_LEN + " characters): " + terms[i].slice(0, 20) + "…" };
    }
    return { terms: terms, error: null };
  }
  function isWord(ch) { return !!ch && WORD.test(ch); }
  function termMatches(term, text) {
    if (!term || !text) return false;
    var start = 0, n = term.length;
    for (;;) {
      var i = text.indexOf(term, start);
      if (i < 0) return false;
      var before = i > 0 ? text.charAt(i - 1) : "";
      var after = i + n < text.length ? text.charAt(i + n) : "";
      var leftOk = !before || !isWord(before) || !isWord(term.charAt(0));
      var rightOk = !after || !isWord(after) || !isWord(term.charAt(n - 1));
      if (leftOk && rightOk) return true;
      start = i + 1;
    }
  }
  function matchingTerms(terms, text) {
    var folded = fold(text);
    return (terms || []).filter(function (t) { return termMatches(t, folded); });
  }
  var API = { fold: fold, parseTerms: parseTerms, validateTerms: validateTerms, termMatches: termMatches,
              matchingTerms: matchingTerms, MAX_TERMS: MAX_TERMS, MAX_TERM_LEN: MAX_TERM_LEN };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  root.TBSportKeywords = API;
})(typeof window !== "undefined" ? window : globalThis);
