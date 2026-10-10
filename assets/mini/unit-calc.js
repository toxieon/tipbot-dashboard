/* Bankroll unit calculator widget. TBMini.unitCalc + TBMini.mountUnitCalc */
(function (root) {
  "use strict";

  function num(v) {
    var n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function money(n) {
    if (!Number.isFinite(n)) return "—";
    return "$" + n.toFixed(2);
  }

  function unitCalc(input) {
    var bankroll = num(input && input.bankroll);
    var unitPct = num(input && input.unitPct);
    var odds = num(input && input.odds);
    var units = num(input && input.units);
    if (units == null || units <= 0) units = 1;
    if (!(bankroll > 0) || !(unitPct > 0)) {
      return { ok: false, error: "Enter a bankroll and unit % above zero." };
    }
    var unitDollars = bankroll * (unitPct / 100);
    var stake = unitDollars * units;
    var out = {
      ok: true,
      bankroll: bankroll,
      unitPct: unitPct,
      units: units,
      unitDollars: unitDollars,
      stake: stake,
      odds: odds,
      toWin: null,
      totalReturn: null,
    };
    if (odds != null && odds > 1) {
      out.totalReturn = Math.round(stake * odds * 100) / 100;
      out.toWin = Math.round(stake * (odds - 1) * 100) / 100;
    }
    return out;
  }

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function readForm(wrap) {
    var q = function (name) {
      return wrap.querySelector('[data-field="' + name + '"]');
    };
    return {
      bankroll: q("bankroll") ? q("bankroll").value : "",
      unitPct: q("unitPct") ? q("unitPct").value : "",
      units: q("units") ? q("units").value : "",
      odds: q("odds") ? q("odds").value : "",
    };
  }

  function renderOut(wrap, result) {
    var box = wrap.querySelector("[data-out]");
    if (!box) return;
    if (!result.ok) {
      box.innerHTML = '<span>' + esc(result.error) + "</span>";
      return;
    }
    var extra = "";
    if (result.totalReturn != null) {
      extra =
        "<span>Potential return " +
        esc(money(result.totalReturn)) +
        " (profit " +
        esc(money(result.toWin)) +
        ")</span>";
    } else {
      extra = "<span>Enter odds above 1.00 to see return.</span>";
    }
    box.innerHTML =
      "<b>Stake " +
      esc(money(result.stake)) +
      "</b>" +
      "<span>" +
      esc(result.units + "u") +
      " · 1u = " +
      esc(money(result.unitDollars)) +
      "</span>" +
      extra;
  }

  function mountUnitCalc(host, opts) {
    opts = opts || {};
    var init = opts.values || {};
    if (!host) return null;
    host.innerHTML =
      '<div class="tb-mini-unit" data-unit-root>' +
      '<label>Bankroll<input data-field="bankroll" type="number" min="0" step="1" placeholder="10000" value="' +
      esc(init.bankroll != null ? init.bankroll : "") +
      '"></label>' +
      '<label>Unit size %<input data-field="unitPct" type="number" min="0" step="0.1" placeholder="1" value="' +
      esc(init.unitPct != null ? init.unitPct : "") +
      '"></label>' +
      '<label>Units<input data-field="units" type="number" min="0" step="0.5" placeholder="1" value="' +
      esc(init.units != null ? init.units : "") +
      '"></label>' +
      '<label>Decimal odds<input data-field="odds" type="number" min="1" step="0.01" placeholder="1.91" value="' +
      esc(init.odds != null ? init.odds : "") +
      '"></label>' +
      '<div class="tb-mini-unit-out" data-out aria-live="polite"></div>' +
      "</div>";
    var wrap = host.querySelector("[data-unit-root]");
    function refresh() {
      renderOut(wrap, unitCalc(readForm(wrap)));
    }
    wrap.querySelectorAll("input").forEach(function (inp) {
      inp.addEventListener("input", refresh);
    });
    refresh();
    return { refresh: refresh, calc: function () { return unitCalc(readForm(wrap)); } };
  }

  var api = root.TBMini = root.TBMini || {};
  api.unitCalc = unitCalc;
  api.mountUnitCalc = mountUnitCalc;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { unitCalc: unitCalc, mountUnitCalc: mountUnitCalc, money: money };
  }
})(typeof window !== "undefined" ? window : globalThis);
