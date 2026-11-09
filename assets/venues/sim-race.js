// Simulated race after the jump (0.72.0): pure maths, no three.js.
//
// racePlan() turns a finish order into each runner's run: metres covered and lateral
// offset (metres from the inside rail) at any playback time. Horses break from their
// barrier stalls, find a lane within the first fifth of the trip, shuffle a little
// mid-race (a seeded, bounded wobble) and pass the post in exactly the given order, then
// pull up past it. racecourse.js maps (metres, lateral) onto the course's start route
// (named courses) or the generic ellipse.

export var LEAD_MPS = 16.5;     // race-pace metres per second for the winner, before playback rate
export var SIM_RATE = 2;        // playback runs at twice real time (1200 m in ~37 s)
export var ACCEL_S = 1.2;       // playback seconds to reach race pace out of the gates
export var PULL_UP_S = 2.5;     // playback seconds to pull up after the post
export var WOBBLE = 0.03;       // max mid-race lead/lag as a share of the trip (monotone while < 1/pi)

/** Seeded PRNG (mulberry32). */
export function seeded(seed) {
  var a = (seed >>> 0) || 1;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A stable seed from a string (the race key), so a replay runs the same race. */
export function seedOf(s) {
  var h = 2166136261;
  s = String(s || "");
  for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// Playback time with a standing start: 0 speed at t=0, race pace after ~ACCEL_S.
function warp(t) { return t <= 0 ? 0 : t - ACCEL_S * (1 - Math.exp(-t / ACCEL_S)); }
function smooth(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }

/**
 * opts: {distance (m), order: [runner index, winner first], stalls: [lateral m per runner
 * index], seed, lanes: {first, step, count}}. Runners not in ``order`` are left out.
 * Returns {distance, duration, finishAt[i], at(i, t) -> {d, lat, done}, leader(t)}.
 */
export function racePlan(opts) {
  var D = Math.max(100, +opts.distance || 1200), order = (opts.order || []).slice(), rnd = seeded(opts.seed || 1);
  var lanes = opts.lanes || {first: 1.2, step: 1.6, count: 4};
  var pace = LEAD_MPS * SIM_RATE, t0 = D / pace;
  // warp(T) = D / pace for the winner: solve T by Newton steps (warp is near t - ACCEL_S).
  function finishTime(target) {
    var T = target + ACCEL_S;
    for (var k = 0; k < 6; k++) T -= (warp(T) - target) / (1 - Math.exp(-T / ACCEL_S));
    return T;
  }
  var finishAt = {}, wobble = {}, lane = {}, place = {}, gap = 0;
  order.forEach(function (i, k) {
    if (k) gap += (0.12 + rnd() * 0.5) / SIM_RATE;     // a short head to ~2 lengths per place
    finishAt[i] = finishTime(t0 + gap * 1);
    // Leaders sit nearer the rail; the wobble is bigger for the back half so it reshuffles.
    wobble[i] = (rnd() * 2 - 1) * WOBBLE * (k < 2 ? 0.6 : 1);
    lane[i] = lanes.first + (k % lanes.count) * lanes.step;
    place[i] = k;
  });
  var last = order.length ? finishAt[order[order.length - 1]] : t0;
  function at(i, t) {
    var T = finishAt[i];
    if (T == null) return null;
    var stall = (opts.stalls || [])[i];
    if (stall == null) stall = lane[i];
    var wT = warp(T), u = Math.min(1, warp(Math.max(0, t)) / wT);
    var d = D * (u + wobble[i] * Math.sin(Math.PI * u));
    var lat = stall + (lane[i] - stall) * smooth(u / 0.2);
    if (t > T) {
      var v = D / wT;                                   // average pace; easing off past the post
      // Each place pulls up a little shorter, so the field stays in finishing order.
      var run = v * PULL_UP_S * (1 - 0.6 * place[i] / (order.length + 1));
      d = D + run * (1 - Math.exp(-(t - T) / PULL_UP_S));
    }
    return {d: d, lat: lat, done: t >= T};
  }
  function leader(t) {
    var best = -1, bd = -Infinity;
    order.forEach(function (i) {
      var p = at(i, Math.min(t, finishAt[i]));         // past the post: the first one home stays leader
      var key = p.done ? D + 1e3 - finishAt[i] : p.d;
      if (key > bd) { bd = key; best = i; }
    });
    return best;
  }
  return {distance: D, duration: last + PULL_UP_S * 2, finishAt: finishAt, at: at, leader: leader, order: order};
}
