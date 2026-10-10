/* Welcome page: example Apex phone mockups (guernseys + theme variants). */
(function () {
  "use strict";

  function paintGuernseys() {
    var G = window.TBAflGuernseys;
    if (!G) return;
    var nodes = document.querySelectorAll("[data-guernsey-team]");
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var team = el.getAttribute("data-guernsey-team");
      var num = el.getAttribute("data-guernsey-num");
      var size = parseInt(el.getAttribute("data-guernsey-size") || "28", 10);
      el.innerHTML = G.guernseySvg(team, num, size);
    }
    var legs = document.querySelectorAll("[data-guernsey-leg]");
    for (var j = 0; j < legs.length; j++) {
      var legEl = legs[j];
      try {
        var leg = JSON.parse(legEl.getAttribute("data-guernsey-leg") || "{}");
        legEl.innerHTML = G.legChipHtml(leg, false);
      } catch (e) {
        legEl.textContent = "";
      }
    }
  }

  function applyVariant(variant) {
    var screens = document.querySelectorAll(".phone-screen");
    for (var i = 0; i < screens.length; i++) {
      var scr = screens[i];
      scr.setAttribute("data-theme", "apex");
      if (variant) scr.setAttribute("data-apex-variant", variant);
      else scr.removeAttribute("data-apex-variant");
    }
  }

  function bindThemes() {
    var buttons = document.querySelectorAll("[data-apex-variant]");
    if (!buttons.length) return;
    for (var i = 0; i < buttons.length; i++) {
      (function (btn) {
        btn.addEventListener("click", function () {
          var variant = btn.getAttribute("data-apex-variant") || "";
          for (var k = 0; k < buttons.length; k++) {
            buttons[k].setAttribute("aria-pressed", buttons[k] === btn ? "true" : "false");
          }
          applyVariant(variant);
        });
      })(buttons[i]);
    }
  }

  function init() {
    paintGuernseys();
    bindThemes();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
