/* Recap switches for the Features list (daily / weekly / monthly).
   Schedule defaults stay on TipBot: Sydney 09:00, Monday, the 1st. */
(function () {
  "use strict";
  var PERIODS = [
    { key: "daily", label: "Daily", flag: "feat.daily_recap" },
    { key: "weekly", label: "Weekly", flag: "feat.weekly_recap" },
    { key: "monthly", label: "Monthly", flag: "feat.monthly_recap" },
  ];

  function isRecapKey(k) {
    return PERIODS.some(function (p) { return p.flag === k; });
  }

  function flagOn(flags, key) {
    if (!flags || !Object.prototype.hasOwnProperty.call(flags, key)) return false;
    return flags[key] === true || flags[key] === 1;
  }

  function baseSettings(data) {
    var s = (data && data.ok && data.settings) || {};
    function period(key, extra) {
      var p = s[key] || {};
      var out = {
        enabled: !!p.enabled,
        hour: p.hour != null ? p.hour : 9,
        minute: p.minute != null ? p.minute : 0,
      };
      if (extra) Object.keys(extra).forEach(function (k) { out[k] = p[k] != null ? p[k] : extra[k]; });
      return out;
    }
    return {
      daily: period("daily"),
      weekly: period("weekly", { weekday: 0 }),
      monthly: period("monthly", { day: 1 }),
      channel_key: s.channel_key || "recaps",
      skip_empty: s.skip_empty !== false,
      available: !!(data && data.ok),
    };
  }

  function checked(recap, flags) {
    var s = baseSettings(recap);
    function on(key, flag) {
      var fromFlag = flagOn(flags, flag);
      if (!s.available) return key === "daily" ? fromFlag : false;
      return !!(s[key] && s[key].enabled) || fromFlag;
    }
    return {
      daily: on("daily", "feat.daily_recap"),
      weekly: on("weekly", "feat.weekly_recap"),
      monthly: on("monthly", "feat.monthly_recap"),
      skip_empty: s.skip_empty,
    };
  }

  function groupHtml(state) {
    state = state || { daily: false, weekly: false, monthly: false, skip_empty: true };
    function box(key, label) {
      return '<label style="display:flex;align-items:center;gap:8px;flex:1 1 96px;min-height:44px;cursor:pointer;user-select:none">'
        + '<input type="checkbox" class="recap-cb" data-period="' + key + '"' + (state[key] ? " checked" : "") + ' style="width:18px;height:18px">'
        + '<span style="font-weight:650">' + label + "</span></label>";
    }
    return '<div id="recap-group" style="border:1px solid var(--line);border-radius:var(--r-md);padding:10px 12px;background:var(--card2)">'
      + '<div style="font-weight:700;font-size:var(--t-sub);margin-bottom:4px">Recaps</div>'
      + '<div style="color:var(--faint);font-size:var(--t-foot);line-height:1.4;margin-bottom:8px">Rich results go to the Recaps channel. Sydney time, 9:00am. Weekly on Monday, monthly on the 1st. Off until you turn one on.</div>'
      + '<div style="display:flex;flex-wrap:wrap;gap:4px 12px">'
      + box("daily", "Daily") + box("weekly", "Weekly") + box("monthly", "Monthly")
      + "</div>"
      + '<label style="display:flex;align-items:center;gap:8px;margin-top:6px;min-height:36px;cursor:pointer;font-size:var(--t-foot)">'
      + '<input type="checkbox" id="recap-skip"' + (state.skip_empty ? " checked" : "") + ' style="width:16px;height:16px">'
      + "Skip empty periods</label>"
      + '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">'
      + '<button type="button" class="ghost sm recap-preview" data-k="daily">Preview daily</button>'
      + '<button type="button" class="ghost sm recap-preview" data-k="weekly">Preview weekly</button>'
      + '<button type="button" class="ghost sm recap-preview" data-k="monthly">Preview monthly</button>'
      + "</div>"
      + '<span id="recap-msg" style="display:block;font-size:var(--t-foot);margin-top:6px"></span>'
      + "</div>";
  }

  function payload(root, recap) {
    var base = baseSettings(recap && recap.ok ? recap : { ok: true, settings: {} });
    function on(key) {
      var el = root.querySelector('.recap-cb[data-period="' + key + '"]');
      return !!(el && el.checked);
    }
    var skip = root.querySelector("#recap-skip");
    return {
      daily: Object.assign({}, base.daily, { enabled: on("daily") }),
      weekly: Object.assign({}, base.weekly, { enabled: on("weekly") }),
      monthly: Object.assign({}, base.monthly, { enabled: on("monthly") }),
      channel_key: base.channel_key,
      skip_empty: skip ? !!skip.checked : base.skip_empty,
    };
  }

  window.TBAutoRecaps = {
    PERIODS: PERIODS,
    isRecapKey: isRecapKey,
    baseSettings: baseSettings,
    checked: checked,
    groupHtml: groupHtml,
    payload: payload,
  };
})();
