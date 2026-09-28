/* Brandon's half-point rule (moved unchanged from index.html so TipBot can share parity vectors).
 * Whole-number player-prop lines → N−0.5 on Over and Under; line_adjusted_from records N.
 * Python twin: TipBot services/lines.apply_half_point. Vectors: tests/fixtures/half_point_vectors.json.
 * Browser global window.TBLines + CommonJS export for node --test.
 */
(function (root) {
  "use strict";
  /** Whole-number player-prop lines → N−0.5 (Over/Under). .5 lines unchanged. */
  function applyHalfPointLine(leg){
    if(!leg||leg.market||leg.custom) return leg;
    if(leg.line==null||leg.line==="") return leg;
    // Markets/custom use desc; player props have stat + line.
    if(!leg.stat && leg.desc) return leg;
    const n=parseFloat(leg.line);
    if(!(n>0)||!isFinite(n)) return leg;
    if(Math.abs(n-Math.round(n))>1e-9) return leg; // already a half-point (or fractional)
    const adjusted=Math.round(n)-0.5;
    if(leg.line_adjusted_from!=null && Number(leg.line)===adjusted) return leg;
    return Object.assign({},leg,{line:adjusted,line_adjusted_from:Math.round(n)});
  }
  function normalizePropLines(legs){
    return (legs||[]).map(l=>applyHalfPointLine(l));
  }
  function lineAdjustNote(l){
    if(l==null||l.line_adjusted_from==null) return "";
    return "Line adjusted "+l.line_adjusted_from+" → "+l.line+" (half-point)";
  }
  var API = {applyHalfPointLine: applyHalfPointLine, normalizePropLines: normalizePropLines, lineAdjustNote: lineAdjustNote};
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  root.TBLines = API;
})(typeof window !== "undefined" ? window : globalThis);
