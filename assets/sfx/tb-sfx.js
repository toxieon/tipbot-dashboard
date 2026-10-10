/* tb-sfx.js — TipDash Web Audio micro-synth (no samples). Browser global TBSfx + CommonJS for tests.
 *
 *   TBSfx.play("tap") | .tap() …  synthesized UI / outcome sounds
 *   TBSfx.setMuted(bool)          user mute (persisted when storage is available)
 *   TBSfx.reduced()               prefers-reduced-motion
 *   TBSfx.silent()                muted, hidden tab, or reduced motion
 *   TBSfx.canPlay()               audio allowed right now
 */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.TBSfx = api;
}(typeof window !== "undefined" ? window : null, function (env) {
  "use strict";
  var w = env || (typeof window !== "undefined" ? window : {});
  var doc = w.document;
  var LS_KEY = "tipdash.sfx.muted";
  var muted = false;
  var ac = null;

  try {
    if (w.localStorage && w.localStorage.getItem(LS_KEY) === "1") muted = true;
  } catch (e) {}

  function mq(q) {
    try { return !!(w.matchMedia && w.matchMedia(q).matches); } catch (e2) { return false; }
  }
  function reduced() { return mq("(prefers-reduced-motion: reduce)"); }
  function hiddenTab() {
    try { return !!(doc && doc.visibilityState === "hidden"); } catch (e3) { return false; }
  }
  function silent() { return muted || reduced() || hiddenTab(); }
  function canPlay() { return !silent() && !!(w.AudioContext || w.webkitAudioContext); }

  function vibe(pattern) {
    if (muted || reduced()) return;
    try {
      var n = w.navigator;
      if (n && typeof n.vibrate === "function") n.vibrate(pattern);
    } catch (e4) {}
  }

  var HAPTIC = {
    tap: 10,
    addToTray: [8, 36, 14],
    post: [12, 28, 22],
    win: [18, 42, 16, 48, 36],
    loss: [28, 72, 24],
    goalSiren: [40, 60, 40, 60, 40, 60, 80],
    horseRaceBugle: [14, 28, 14, 28, 14, 56, 22, 44, 30]
  };

  function setMuted(on) {
    muted = !!on;
    try {
      if (w.localStorage) w.localStorage.setItem(LS_KEY, muted ? "1" : "0");
    } catch (e5) {}
  }

  function ctx() {
    if (!canPlay()) return null;
    var Ctor = w.AudioContext || w.webkitAudioContext;
    if (!Ctor) return null;
    if (!ac) ac = new Ctor();
    if (ac.state === "suspended") {
      try { ac.resume(); } catch (e6) {}
    }
    return ac;
  }

  function tone(c, freq, t0, dur, type, peak, pan) {
    var o = c.createOscillator();
    var g = c.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(freq, t0);
    var p = peak == null ? 0.22 : peak;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, p), t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    if (pan != null && c.createStereoPanner) {
      var sp = c.createStereoPanner();
      sp.pan.value = pan;
      g.connect(sp);
      sp.connect(c.destination);
    } else {
      g.connect(c.destination);
    }
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  function noiseBurst(c, t0, dur, peak) {
    var len = Math.max(1, Math.floor(c.sampleRate * dur));
    var buf = c.createBuffer(1, len, c.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = c.createBufferSource();
    src.buffer = buf;
    var g = c.createGain();
    var p = peak == null ? 0.08 : peak;
    g.gain.setValueAtTime(p, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(g);
    g.connect(c.destination);
    src.start(t0);
    src.stop(t0 + dur + 0.01);
  }

  function sweep(c, f0, f1, t0, dur, peak) {
    var o = c.createOscillator();
    var g = c.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t0 + dur);
    var p = peak == null ? 0.12 : peak;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(p, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  function playTap(c, t) {
    tone(c, 920, t, 0.05, "sine", 0.18);
    tone(c, 1380, t + 0.018, 0.04, "sine", 0.08);
  }

  function playAddToTray(c, t) {
    tone(c, 520, t, 0.07, "triangle", 0.2);
    tone(c, 780, t + 0.07, 0.09, "triangle", 0.18);
    tone(c, 1040, t + 0.15, 0.11, "triangle", 0.14);
  }

  function playPost(c, t) {
    noiseBurst(c, t, 0.04, 0.06);
    tone(c, 440, t + 0.02, 0.12, "square", 0.07);
    tone(c, 660, t + 0.08, 0.14, "sine", 0.16);
  }

  function playWin(c, t) {
    var notes = [523.25, 659.25, 783.99, 1046.5];
    for (var i = 0; i < notes.length; i++) tone(c, notes[i], t + i * 0.09, 0.22, "sine", 0.17 - i * 0.02);
  }

  function playLoss(c, t) {
    tone(c, 392, t, 0.18, "sine", 0.16);
    tone(c, 330, t + 0.14, 0.22, "sine", 0.14);
    tone(c, 262, t + 0.32, 0.28, "triangle", 0.12);
  }

  function playGoalSiren(c, t) {
    var cycles = 4;
    var step = 0.22;
    for (var i = 0; i < cycles; i++) {
      sweep(c, 280, 720, t + i * step * 2, step, 0.11);
      sweep(c, 720, 280, t + i * step * 2 + step, step, 0.1);
    }
  }

  function playHorseRaceBugle(c, t) {
    var bugle = [392, 392, 523.25, 392, 523.25, 659.25, 392];
    var lens = [0.14, 0.1, 0.18, 0.1, 0.16, 0.2, 0.28];
    var at = t;
    for (var j = 0; j < bugle.length; j++) {
      tone(c, bugle[j], at, lens[j], "sawtooth", 0.11);
      tone(c, bugle[j] * 2, at, lens[j] * 0.85, "square", 0.03);
      at += lens[j] * 0.92;
    }
  }

  var ALIAS = {
    "add-to-tray": "addToTray",
    "goal-siren": "goalSiren",
    "horse-race-bugle": "horseRaceBugle"
  };

  var FN = {
    tap: playTap,
    addToTray: playAddToTray,
    post: playPost,
    win: playWin,
    loss: playLoss,
    goalSiren: playGoalSiren,
    horseRaceBugle: playHorseRaceBugle
  };

  function resolveKey(name) {
    if (!name) return "";
    var s = String(name);
    if (FN[s]) return s;
    if (ALIAS[s]) return ALIAS[s];
    var camel = s.replace(/-([a-z])/g, function (_, ch) { return ch.toUpperCase(); });
    return FN[camel] ? camel : s;
  }

  function play(name) {
    var key = resolveKey(name);
    var fn = FN[key];
    if (HAPTIC[key]) vibe(HAPTIC[key]);
    if (!fn) return false;
    var c = ctx();
    if (!c) return false;
    var t = c.currentTime + 0.001;
    try { fn(c, t); } catch (e7) { return false; }
    return true;
  }

  var api = {
    get muted() { return muted; },
    setMuted: setMuted,
    reduced: reduced,
    hiddenTab: hiddenTab,
    silent: silent,
    canPlay: canPlay,
    play: play,
    tap: function () { return play("tap"); },
    addToTray: function () { return play("addToTray"); },
    post: function () { return play("post"); },
    win: function () { return play("win"); },
    loss: function () { return play("loss"); },
    goalSiren: function () { return play("goalSiren"); },
    horseRaceBugle: function () { return play("horseRaceBugle"); },
    haptic: function (name) {
      var key = resolveKey(name);
      if (!HAPTIC[key]) return false;
      vibe(HAPTIC[key]);
      return true;
    },
    _resetForTests: function () {
      muted = false;
      ac = null;
    }
  };

  return api;
}));
