/* Goal / behind stadium FX hook (tipdash). window.TBMatchFx — pairs with match-centre + bc-2a44bb8b. */
(function (root) {
  "use strict";

  var _bound = null;

  function reduced() {
    try {
      return (
        (root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches) ||
        (root.document && root.document.documentElement && root.document.documentElement.dataset.motion === "reduce")
      );
    } catch (e) {
      return false;
    }
  }

  function venueKey(venue) {
    if (root.TBAflStadiums && TBAflStadiums.venueId) return TBAflStadiums.venueId(venue);
    return String(venue || "generic").toLowerCase().replace(/[^a-z0-9]+/g, "") || "generic";
  }

  function findStage(venue) {
    var key = venueKey(venue);
    var mc =
      (root.document &&
        root.document.querySelector('.match-centre[data-venue-id="' + key + '"]')) ||
      (root.document && root.document.querySelector(".match-centre"));
    if (mc) return mc.querySelector(".mc-stadium-stage");
    return _bound && _bound.querySelector ? _bound.querySelector(".mc-stadium-stage") : null;
  }

  function clearAnim(stage) {
    if (!stage) return;
    stage.classList.remove("mc-anim-goal", "mc-anim-behind", "mc-anim-push", "mc-flash-goal", "mc-flash-behind");
    var ball = stage.querySelector(".mc-ball");
    if (ball) ball.classList.remove("mc-ball-fly", "mc-ball-fly-behind");
    var burst = stage.querySelector(".mc-burst");
    if (burst) burst.classList.remove("mc-burst-on");
  }

  function play(kind, venue, opts) {
    opts = opts || {};
    var stage = opts.stage || findStage(venue);
    if (!stage) return false;
    clearAnim(stage);
    var isGoal = kind === "goal";
    if (reduced()) {
      stage.classList.add(isGoal ? "mc-flash-goal" : "mc-flash-behind");
      root.setTimeout(function () {
        clearAnim(stage);
      }, 420);
      return true;
    }
    stage.classList.add("mc-anim-push", isGoal ? "mc-anim-goal" : "mc-anim-behind");
    var ball = stage.querySelector(".mc-ball");
    if (ball) ball.classList.add(isGoal ? "mc-ball-fly" : "mc-ball-fly-behind");
    var burst = stage.querySelector(".mc-burst");
    if (burst) burst.classList.add("mc-burst-on");
    var ms = isGoal ? 1400 : 900;
    root.setTimeout(function () {
      if (opts.stage === stage || findStage(venue) === stage) clearAnim(stage);
    }, ms);
    return true;
  }

  var API = {
    bind: function (matchCentreEl) {
      _bound = matchCentreEl || null;
    },
    unbind: function () {
      _bound = null;
    },
    goal: function (venue, opts) {
      return play("goal", venue, opts || {});
    },
    behind: function (venue, opts) {
      return play("behind", venue, opts || {});
    },
    reduced: reduced,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = API;
  root.TBMatchFx = API;
})(typeof window !== "undefined" ? window : globalThis);
