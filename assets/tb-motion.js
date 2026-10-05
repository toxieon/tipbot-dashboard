/* tb-motion.js — TipDash motion + interaction helpers (Apple-design pass, 0.43.1+).
 *
 * Loaded eagerly from index.html. No dependencies, no build step. Everything is
 * feature-detected so it is safe in the test VM's fake DOM.
 *
 *   TBMotion.reduced()      true when the user asked for reduced motion
 *   TBMotion.bump(el)       quick 1 → 1.08 → 1 "something landed here" pulse
 *   TBMotion.tick()         10 ms haptic tick (Android Chrome; iOS Safari has no Vibration API)
 *
 * Also: tapping anywhere on a `.switch` row flips its `.toggle` (bigger hit target).
 */
(function () {
  "use strict";
  var w = typeof window !== "undefined" ? window : this;
  var doc = w.document;

  function mq(q) {
    try { return !!(w.matchMedia && w.matchMedia(q).matches); } catch (e) { return false; }
  }
  function reduced() { return mq("(prefers-reduced-motion: reduce)"); }

  function bump(el) {
    if (!el || !el.classList) return;
    el.classList.remove("tb-bump");
    // Force a reflow so re-adding the class restarts the animation.
    try { void el.offsetWidth; } catch (e) {}
    el.classList.add("tb-bump");
    var done = function () { el.classList.remove("tb-bump"); };
    if (el.addEventListener) el.addEventListener("animationend", done, { once: true });
    setTimeout(done, 600);
  }

  function tick() {
    try {
      var n = w.navigator;
      if (n && typeof n.vibrate === "function") n.vibrate(10);
    } catch (e) {}
  }

  // Whole .switch row toggles its switch: the 44×25 pill alone is a small target.
  function wireSwitchRows() {
    if (!doc || !doc.addEventListener) return;
    doc.addEventListener("click", function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var row = t.closest(".switch");
      if (!row) return;
      if (t.closest("button,input,select,textarea,a,label")) return;
      var sw = row.querySelector(".toggle");
      if (sw && !sw.disabled) sw.click();
    });
  }

  w.TBMotion = { reduced: reduced, bump: bump, tick: tick };
  wireSwitchRows();
}).call(this);
