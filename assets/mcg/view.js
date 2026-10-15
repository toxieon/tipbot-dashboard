/* In-app MCG page. Polls the live feed and plays each new goal. */
(function (root) {
  "use strict";

  var live = { gen: 0, timer: 0, scene: null, host: null };

  function storage() {
    try { return root.localStorage; } catch (e) { return null; }
  }

  function teamLabel(game, side) {
    var t = side === "home" ? (game.hteam || game.home) : (game.ateam || game.away);
    if (t && typeof t === "object") return String(t.name || t.team || t.abbrev || "");
    return t == null ? "" : String(t);
  }

  function initials(name) {
    var parts = String(name || "").trim().split(/\s+/);
    if (!parts[0]) return "";
    if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase();
    return (parts[0].charAt(0) + (parts[1] ? parts[1].charAt(0) : "")).toUpperCase();
  }

  function firstAfl(games) {
    var list = Array.isArray(games) ? games : [];
    var i;
    for (i = 0; i < list.length; i++) {
      if (root.TBMcgGoals && root.TBMcgGoals.isAfl(list[i])) return list[i];
    }
    return null;
  }

  function pickRotation(body, gameId) {
    if (!body || typeof body !== "object") return null;
    var rotations = Array.isArray(body.rotations) ? body.rotations : [];
    var id = body.default_rotation_id || body.defaultRotationId || "";
    var assigned = body.assignments || [];
    var i;
    if (gameId && Array.isArray(assigned)) {
      for (i = 0; i < assigned.length; i++) {
        var row = assigned[i] || {};
        var gid = row.game_id || row.match_id || row.id;
        if (gid != null && String(gid) === String(gameId) && (row.rotation_id || row.rotationId)) {
          id = row.rotation_id || row.rotationId;
        }
      }
    }
    for (i = 0; i < rotations.length; i++) {
      if (rotations[i] && String(rotations[i].id) === String(id)) return rotations[i];
    }
    return rotations[0] || body.rotation || null;
  }

  function stop() {
    live.gen += 1;
    if (live.timer) root.clearInterval(live.timer);
    live.timer = 0;
    if (live.scene && live.scene.dispose) live.scene.dispose();
    live.scene = null;
    if (live.host) live.host.innerHTML = "";
    live.host = null;
  }

  function open(host, ctx) {
    stop();
    ctx = ctx || {};
    var mine = live.gen;
    live.host = host;
    if (!host) return;
    host.innerHTML = '<div class="back" id="ground-back">← Back</div>'
      + '<h1 style="margin:0 0 8px">MCG</h1>'
      + '<div class="mcg-stage"><canvas id="ground-canvas" aria-label="MCG"></canvas></div>'
      + '<div class="mcg-bar"><button type="button" class="btn" id="ground-goal">Test goal</button></div>';
    var back = host.querySelector("#ground-back");
    if (back) back.onclick = function () { if (ctx.back) ctx.back(); };
    var canvas = host.querySelector("#ground-canvas");
    if (!root.TBMcgScene || !canvas) {
      host.innerHTML = '<div class="back" id="ground-back">← Back</div><p class="empty">The ground could not be loaded.</p>';
      var again = host.querySelector("#ground-back");
      if (again) again.onclick = function () { if (ctx.back) ctx.back(); };
      return;
    }
    var scene = root.TBMcgScene.mount(canvas, {
      token: ctx.token,
      night: function () {
        return !(root.TBTime && root.TBTime.isDaytime && root.TBTime.isDaytime());
      }
    });
    live.scene = scene;
    if (!scene || scene.failed) {
      host.innerHTML = '<div class="back" id="ground-back">← Back</div><p class="empty">The ground could not be loaded.</p>';
      var failBack = host.querySelector("#ground-back");
      if (failBack) failBack.onclick = function () { if (ctx.back) ctx.back(); };
      live.scene = null;
      return;
    }

    var ballUrl = "";
    var snap = null;
    var emblemKey = "";
    var sponsorsOnce = false;
    var nextEnd = "east";
    var pointers = {};
    var pinch = 0;

    function rememberBall(url) {
      if (!url) return;
      ballUrl = url;
      if (root.TBMcgGoals) root.TBMcgGoals.writeBallSponsor(storage(), url);
      scene.setBallSponsor(root.TBMcgGoals ? root.TBMcgGoals.absUrl(ctx.apiBase, url) : url, ctx.token);
    }

    var saved = root.TBMcgGoals ? root.TBMcgGoals.readBallSponsor(storage()) : "";
    if (saved) rememberBall(saved);

    function paintTeams(game) {
      if (!game || !root.TBAflGuernseys) return;
      var home = teamLabel(game, "home");
      var away = teamLabel(game, "away");
      var key = home + "|" + away;
      if (key === emblemKey) return;
      emblemKey = key;
      ["home", "away"].forEach(function (side) {
        var name = side === "home" ? home : away;
        var spec = root.TBAflGuernseys.lookupTeam(name) || { primary: "#16351f", secondary: "#f4f6fa" };
        scene.setEmblem(side, {
          label: initials(name),
          primary: spec.primary,
          secondary: spec.secondary
        });
      });
    }

    function applySponsors(body, gameId) {
      if (!body || !root.TBMcgGoals || mine !== live.gen) return;
      var rotation = pickRotation(body, gameId);
      var slides = root.TBMcgGoals.boardSlides(rotation, ctx.apiBase);
      if (!slides.length) slides = root.TBMcgGoals.boardSlides(body, ctx.apiBase);
      if (slides.length) scene.setBoards(slides);
      var ground = root.TBMcgGoals.groundPlacements(rotation, ctx.apiBase);
      if (ground.length) scene.setGround(ground);
      var ball = root.TBMcgGoals.ballSponsorFromPayload(body);
      if (ball) rememberBall(ball);
    }

    function loadSponsors(gameId) {
      if (typeof ctx.api !== "function") return;
      ctx.api("/api/owner/sponsors", { timeoutMs: 12000, retries: 0 }).then(function (r) {
        if (!r || !r.ok || mine !== live.gen) return null;
        return r.json();
      }).then(function (body) {
        applySponsors(body, gameId);
      }).catch(function () {});
      if (!gameId) return;
      ctx.api("/api/games/" + encodeURIComponent(gameId) + "/sponsors", { timeoutMs: 12000, retries: 0 }).then(function (r) {
        if (!r || !r.ok || mine !== live.gen) return null;
        return r.json();
      }).then(function (body) {
        if (!body || !root.TBMcgGoals || mine !== live.gen) return;
        var slides = root.TBMcgGoals.boardSlides(body, ctx.apiBase);
        if (slides.length) scene.setBoards(slides);
        var ball = root.TBMcgGoals.ballSponsorFromPayload(body);
        if (ball) rememberBall(ball);
      }).catch(function () {});
    }

    function poll() {
      if (mine !== live.gen || typeof ctx.api !== "function") return;
      var gid = "";
      try { gid = ctx.guildId ? ctx.guildId() : ""; } catch (e) { gid = ""; }
      if (!gid) {
        if (!sponsorsOnce) { sponsorsOnce = true; loadSponsors(""); }
        return;
      }
      ctx.api("/api/live-tips?guild_id=" + encodeURIComponent(gid), { timeoutMs: 10000, retries: 0 }).then(function (r) {
        if (!r || !r.ok || mine !== live.gen) return null;
        return r.json();
      }).then(function (data) {
        if (!data || mine !== live.gen || !root.TBMcgGoals) return;
        var games = data.games || [];
        var diff = root.TBMcgGoals.diff(snap, games);
        var first = snap == null;
        snap = diff.snapshot;
        var game = firstAfl(games);
        paintTeams(game);
        if (first) {
          if (!sponsorsOnce) {
            sponsorsOnce = true;
            loadSponsors(game && root.TBMcgGoals.matchId(game));
          }
          return;
        }
        var i;
        for (i = 0; i < diff.events.length; i++) {
          var ev = diff.events[i];
          scene.playGoal({
            end: ev.end,
            team: ev.team,
            teamName: ev.teamName,
            ballSponsorUrl: ballUrl
          });
        }
      }).catch(function () {});
    }

    var button = host.querySelector("#ground-goal");
    if (button) button.onclick = function () {
      scene.playGoal({ end: nextEnd, team: "home", ballSponsorUrl: ballUrl });
      nextEnd = nextEnd === "east" ? "west" : "east";
    };

    function ids() { return Object.keys(pointers); }
    canvas.addEventListener("pointerdown", function (e) {
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      if (ids().length === 2) pinch = pointerSpan();
    });
    canvas.addEventListener("pointermove", function (e) {
      var prev = pointers[e.pointerId];
      if (!prev) return;
      var both = ids();
      if (both.length >= 2) {
        pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
        var span = pointerSpan();
        if (pinch && span) scene.zoom(span < pinch ? 1 : -1);
        pinch = span;
        return;
      }
      scene.drag(e.clientX - prev.x, e.clientY - prev.y);
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    });
    function endPointer(e) {
      delete pointers[e.pointerId];
      if (ids().length < 2) pinch = 0;
    }
    canvas.addEventListener("pointerup", endPointer);
    canvas.addEventListener("pointercancel", endPointer);
    canvas.addEventListener("wheel", function (e) {
      e.preventDefault();
      scene.zoom(e.deltaY);
    }, { passive: false });

    function pointerSpan() {
      var list = ids();
      if (list.length < 2) return 0;
      var a = pointers[list[0]];
      var b = pointers[list[1]];
      return Math.hypot(a.x - b.x, a.y - b.y);
    }

    poll();
    live.timer = root.setInterval(poll, 20000);
  }

  function watching() {
    return !!(live.scene && live.host);
  }

  var api = { open: open, stop: stop, watching: watching };

  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.TBMcgView = api;
  if (root && root.TD && root.TD.loaded) root.TD.loaded["mcg/view"] = true;
})(typeof window !== "undefined" ? window : globalThis);
