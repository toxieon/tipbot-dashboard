/* Build → Import from screenshot (lazy). Uses TBSlipOcr parsers + vendored tesseract.js.
 * Attaches image_b64 on the tip via the same BUILD.image path as manual screenshot upload.
 */
(function () {
  "use strict";

  var SLIP = {
    guildId: null,
    serverName: null,
    file: null,
    imageData: null,
    draft: null,
    parsed: null,
    parsedLegs: [],
    fixtures: [],
    ocrText: "",
  };
  var tessPromise = null;

  function slipBase() {
    return "./assets/vendor/tesseract/";
  }

  function ensureSlipOcr() {
    if (window.TBSlipOcr) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = TD.src("slip-ocr");
      s.onload = function () {
        window.TBSlipOcr ? resolve() : reject(new Error("slip-ocr missing"));
      };
      s.onerror = function () {
        reject(new Error("slip-ocr load failed"));
      };
      document.head.appendChild(s);
    });
  }

  function loadTesseract() {
    if (window.Tesseract) return Promise.resolve();
    if (tessPromise) return tessPromise;
    tessPromise = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = slipBase() + "tesseract.min.js?v=" + encodeURIComponent(TD.version);
      s.onload = function () {
        window.Tesseract ? resolve() : reject(new Error("tesseract missing"));
      };
      s.onerror = function () {
        reject(new Error("tesseract load failed"));
      };
      document.head.appendChild(s);
    });
    return tessPromise;
  }

  function compressImage(file, maxDim, quality) {
    maxDim = maxDim || 1600;
    quality = quality || 0.7;
    return new Promise(function (res, rej) {
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () {
        URL.revokeObjectURL(url);
        var w = img.naturalWidth;
        var h = img.naturalHeight;
        var sc = Math.min(1, maxDim / Math.max(w, h));
        w = Math.max(1, Math.round(w * sc));
        h = Math.max(1, Math.round(h * sc));
        var c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        c.getContext("2d").drawImage(img, 0, 0, w, h);
        try {
          res(c.toDataURL("image/jpeg", quality));
        } catch (e) {
          rej(e);
        }
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        rej(new Error("bad image"));
      };
      img.src = url;
    });
  }

  // Same pipeline the fixture harness runs (tests/slip-harness/run.mjs): preprocess + tesseract
  // with word boxes, then the structured slip parser.
  async function runOcr(file) {
    await loadTesseract();
    return TBSlipOcr.recognizeImage(Tesseract, file, slipBase());
  }

  async function loadAflFixtures() {
    try {
      var res = await prefetchBuilderData();
      var fx = res[2];
      if (fx && fx.data && fx.data.games) return fx.data.games || [];
    } catch (e) {
      if (e && e.unauth) {
        renderLogin("Session expired.");
        return [];
      }
    }
    return [];
  }

  async function fetchEspnJson(url) {
    var r = await fetch(url, { mode: "cors", cache: "no-store" });
    if (!r.ok) throw new Error("scoreboard " + r.status);
    return r.json();
  }

  // AFL uses /api/fixtures. NBA, NBL, WNBA and NFL use the same public scoreboard
  // the builder already reads, for the slip date and the day either side of it.
  async function loadFixtureGames(sport, when, eventName) {
    await ensureSlipOcr();
    return TBSlipOcr.loadSportFixtures(sport, when, eventName, {
      loadAfl: loadAflFixtures,
      fetchJson: fetchEspnJson,
    });
  }

  function escAttr(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  function renderPickScreen() {
    panel("builder");
    var lt = $("tray");
    if (lt) lt.hidden = true;
    $("builder").innerHTML =
      '<div class="back" id="slip-back">← Back</div>' +
      '<h1 style="margin:0 0 12px">Import from screenshot</h1>' +
      '<p style="color:var(--muted);margin:0 0 14px">Upload or paste a bookie slip image. We read it on your device, then you review every field before scheduling.</p>' +
      '<div class="panel">' +
      '<div class="field"><label for="slip-file">Screenshot</label><input id="slip-file" type="file" accept="image/*"></div>' +
      '<div id="slip-paste-zone" tabindex="0" style="margin-top:10px;padding:14px;border:1px dashed var(--line);border-radius:var(--r-md);color:var(--muted);font-size:var(--t-sub)">Or paste an image here (⌘V / Ctrl+V)</div>' +
      '<p id="slip-supported" style="color:var(--faint);font-size:var(--t-foot);margin:12px 0 0">' +
      esc(window.TBSlipOcr && TBSlipOcr.supportedSlipsNote ? TBSlipOcr.supportedSlipsNote() : "") +
      "</p>" +
      '<div id="slip-status" style="margin-top:12px;font-size:var(--t-sub);color:var(--muted)"></div>' +
      '<div id="slip-preview" style="margin-top:10px"></div>' +
      "</div>";
    $("slip-back").onclick = function () {
      openSportsBuilder(SLIP.guildId, SLIP.serverName, true);
    };
    var fi = $("slip-file");
    if (fi) fi.onchange = function () {
      var f = fi.files && fi.files[0];
      if (f) startImport(f);
    };
    var zone = $("slip-paste-zone");
    if (zone) {
      zone.onpaste = function (e) {
        var items = e.clipboardData && e.clipboardData.items;
        if (!items) return;
        for (var i = 0; i < items.length; i++) {
          if (items[i].type && items[i].type.indexOf("image/") === 0) {
            e.preventDefault();
            var blob = items[i].getAsFile();
            if (blob) startImport(blob);
            return;
          }
        }
      };
    }
    bindShareTarget();
  }

  function bindShareTarget() {
    if (!window.__slipPasteBound) {
      window.__slipPasteBound = true;
      document.addEventListener("paste", function (e) {
        if (!$("builder") || $("builder").hidden) return;
        if (!$("slip-paste-zone")) return;
        var items = e.clipboardData && e.clipboardData.items;
        if (!items) return;
        for (var i = 0; i < items.length; i++) {
          if (items[i].type && items[i].type.indexOf("image/") === 0) {
            e.preventDefault();
            var blob = items[i].getAsFile();
            if (blob) startImport(blob);
            return;
          }
        }
      });
    }
  }

  // Diagnostics: failed imports go to TipBot so the parser can be improved. Fire-and-forget:
  // never awaited, never shown, never changes the import flow.
  var diagSent = 0;
  function reportDiagnostics(kind, err, extra) {
    try {
      extra = extra || {};
      if (diagSent >= 5 || typeof fetch !== "function" || typeof FormData !== "function") return;
      if (typeof getToken !== "function" || typeof API === "undefined" || !getToken()) return;
      diagSent++;
      var file = extra.file || SLIP.file;
      var ocr = extra.ocr || SLIP.ocr || null;
      var parsed = extra.parsed || SLIP.parsed || null;
      var fd = new FormData();
      var put = function (k, v) { fd.append(k, v == null ? "" : String(v).slice(0, 200000)); };
      put("kind", kind);
      put("error", err && err.message ? err.message : err);
      put("ocr_text", (ocr && ocr.text) || SLIP.ocrText || "");
      try { put("ocr_lines", ocr && ocr.lines ? JSON.stringify({ text: ocr.text || "", lines: ocr.lines, width: ocr.width }) : ""); } catch (_e) {}
      try { put("parsed", parsed ? JSON.stringify(parsed) : ""); } catch (_e) {}
      put("sport", extra.sport || (parsed && parsed.sport) || "");
      put("bookie", extra.bookie || (parsed && parsed.bookie) || "");
      put("guild_id", extra.guildId || SLIP.guildId || "");
      put("client_ts", new Date().toISOString());
      if (file && file.size && file.size <= 8 * 1024 * 1024 && /^image\//.test(file.type || "")) fd.append("image", file, "slip");
      setTimeout(function () {
        try {
          fetch(API + "/api/diagnostics/slip", {
            method: "POST", body: fd, credentials: "include", cache: "no-store",
            headers: { Authorization: "Bearer " + getToken() },
          }).catch(function () {});
        } catch (_e) {}
      }, 0);
    } catch (_e) {}
  }

  async function startImport(file) {
    diagSent = 0;
    SLIP.ocr = null;
    SLIP.parsed = null;
    SLIP.file = file;
    var st = $("slip-status");
    var prev = $("slip-preview");
    if (st) st.textContent = "Reading text from image…";
    if (prev) {
      try {
        var url = URL.createObjectURL(file);
        prev.innerHTML =
          '<img src="' + escAttr(url) + '" alt="" style="max-height:160px;border-radius:var(--r-sm);border:1px solid var(--line)">';
      } catch (_e) {
        prev.innerHTML = "";
      }
    }
    var stage = "ocr_failed";
    var ocr = null;
    try {
      await ensureSlipOcr();
      ocr = await runOcr(file);
      SLIP.ocrText = ocr.text || "";
      SLIP.ocr = ocr;
      stage = "parse_failed";
      SLIP.parsed = TBSlipOcr.parseSlipLines(ocr);
      if (!(SLIP.parsed.legs || []).length) reportDiagnostics("nothing_recognised", "No legs recognised.");
      stage = "done";
      SLIP.fixtureSport = SLIP.parsed.sport || "";
      SLIP.fixtures = await loadFixtureGames(SLIP.parsed.sport, SLIP.parsed.start_local || SLIP.parsed.date_time, SLIP.parsed.event);
      SLIP.parsedLegs = TBSlipOcr.attachFixtureMatches(SLIP.parsed.legs || [], SLIP.fixtures);
      SLIP.parsed = Object.assign({}, SLIP.parsed, { legs: SLIP.parsedLegs });
      SLIP.draft = TBSlipOcr.slipToTipDraft(SLIP.parsed);
      SLIP.imageData = await compressImage(file);
      renderReviewScreen();
    } catch (e) {
      reportDiagnostics(stage === "done" ? "parse_failed" : stage, e, { ocr: ocr });
      if (st) st.textContent = "Couldn't read that screenshot. Try a clearer image or enter the tip manually.";
    }
  }

  function fixturePickerOptions(games, selectedId) {
    var html = '<option value="">Match from fixtures…</option>';
    (games || []).forEach(function (g) {
      var id = TBSlipOcr.fixtureGameId(g);
      var label = TBSlipOcr.fixtureEventLabel(g);
      var comp = TBSlipOcr.fixtureComp(g);
      if (!id || !label) return;
      html +=
        '<option value="' +
        escAttr(id) +
        '"' +
        (String(selectedId) === String(id) ? " selected" : "") +
        ">" +
        esc(label) +
        " · " +
        esc(comp) +
        "</option>";
    });
    return html;
  }

  function legFlagFields(leg) {
    var out = {};
    ((leg && leg.flags) || []).forEach(function (f) { out[f.field] = f.reason; });
    return out;
  }
  function flagStyle(on) { return on ? ";outline:2px solid var(--warn, #e0a100);outline-offset:1px" : ""; }
  function legSnapshot(leg) {
    leg = leg || {};
    return {
      event: leg.event || "",
      selection: leg.player || leg.team || leg.selection || "",
      market: leg.stat || leg.market || "",
      line: leg.line != null ? leg.line : null,
      game_id: leg.game_id || "",
    };
  }
  function legRowHtml(leg, idx) {
    leg = leg || {};
    var who = leg.player || leg.team || leg.selection || "";
    var stat = leg.stat || leg.market || "";
    var ev = leg.event != null ? leg.event : "";
    var gid = leg.game_id != null ? leg.game_id : "";
    var ff = legFlagFields(leg);
    var reasons = Object.keys(ff).map(function (k) { return ff[k]; });
    var side = leg.side || "";
    var whoFlag = ff.selection || ff.player || ff.team;
    var statFlag = ff.market || ff.stat;
    var linked = window.TBSlipOcr && TBSlipOcr.legAutoLinked ? TBSlipOcr.legAutoLinked(leg) : true;
    var open = !linked;
    return (
      '<div class="paste-card slip-leg-row' + (open ? " slip-leg-unmatched" : "") + '" data-i="' + idx + '" data-kind="' + escAttr(leg.kind || "") + '" data-open="' + (open ? "1" : "0") + '" data-raw="' + escAttr(JSON.stringify(legSnapshot(leg))) + '" style="margin-top:10px">' +
      (open ? '<div class="slip-leg-need">This leg needs a game, player, market and line, or skip matching.</div>' : "") +
      (reasons.length
        ? '<div class="slip-leg-flags" style="color:var(--warn, #e0a100);font-size:var(--t-foot);margin-bottom:6px">⚠ ' + esc(reasons.join(" · ")) + "</div>"
        : "") +
      '<div class="field" style="margin-bottom:8px"><label>Game / event</label>' +
      '<input class="slip-leg-event" data-i="' + idx + '" value="' + esc(ev) + '" placeholder="e.g. Geelong v Carlton" style="width:100%' + flagStyle(ff.event) + '">' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;align-items:center">' +
      '<select class="slip-leg-fixture" data-i="' + idx + '" style="flex:1;min-width:200px">' + fixturePickerOptions(SLIP.fixtures, gid) + "</select>" +
      '<span class="slip-leg-sport" style="font-size:var(--t-foot);color:var(--muted)">' + esc(leg.sport || "") + "</span>" +
      '<input type="hidden" class="slip-leg-gid" data-i="' + idx + '" value="' + escAttr(gid) + '">' +
      "</div></div>" +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<input class="slip-leg-sel" data-i="' + idx + '" placeholder="Player / team / runner" aria-label="Player or team" value="' + esc(who) + '" style="flex:2;min-width:140px' + flagStyle(whoFlag) + '">' +
      '<input class="slip-leg-mkt" data-i="' + idx + '" placeholder="Stat / market" aria-label="Stat or market" value="' + esc(stat) + '" style="flex:2;min-width:120px' + flagStyle(statFlag) + '">' +
      '<input class="slip-leg-line" data-i="' + idx + '" type="number" step="0.5" placeholder="Line" aria-label="Line" value="' + esc(leg.line != null ? String(leg.line) : "") + '" style="width:76px' + flagStyle(ff.line) + '">' +
      '<select class="slip-leg-side" data-i="' + idx + '" aria-label="Over or under" style="width:92px' + flagStyle(ff.side) + '">' +
      ["", "Over", "Under"].map(function (o) { return '<option value="' + o + '"' + (o === side ? " selected" : "") + ">" + (o || "—") + "</option>"; }).join("") +
      "</select>" +
      '<input class="slip-leg-odds" data-i="' + idx + '" type="number" step="0.01" placeholder="Leg odds" aria-label="Leg odds" value="' + esc(leg.odds != null ? String(leg.odds) : "") + '" style="width:92px">' +
      "</div>" +
      (open ? '<div style="margin-top:8px"><button type="button" class="ghost sm slip-leg-skip">Skip matching</button></div>' : "") +
      "</div>"
    );
  }
  function rowToLeg(row) {
    var q = function (c) { var el = row.querySelector(c); return el && el.value != null ? String(el.value).trim() : ""; };
    var line = parseFloat(q(".slip-leg-line"));
    return {
      kind: row.getAttribute("data-kind") || "",
      event: q(".slip-leg-event"),
      game_id: q(".slip-leg-gid"),
      selection: q(".slip-leg-sel"),
      player: q(".slip-leg-sel"),
      market: q(".slip-leg-mkt"),
      stat: q(".slip-leg-mkt"),
      line: isFinite(line) ? line : null,
      flags: [],
    };
  }
  function refreshLegMatch(row) {
    if (!row) return;
    if (row.getAttribute("data-skipped") === "1" || row.getAttribute("data-open") !== "1") {
      row.classList.remove("slip-leg-unmatched");
      return;
    }
    var linked = window.TBSlipOcr && TBSlipOcr.legAutoLinked && TBSlipOcr.legAutoLinked(rowToLeg(row));
    row.classList.toggle("slip-leg-unmatched", !linked);
  }

  function wireLegFixturePickers() {
    var box = $("slip-legs");
    if (!box) return;
    box.querySelectorAll(".slip-leg-fixture").forEach(function (sel) {
      sel.onchange = function () {
        var row = sel.closest(".slip-leg-row");
        if (!row) return;
        var id = sel.value || "";
        var hid = row.querySelector(".slip-leg-gid");
        var evIn = row.querySelector(".slip-leg-event");
        var sport = row.querySelector(".slip-leg-sport");
        if (hid) hid.value = id;
        if (!id) return;
        var g = (SLIP.fixtures || []).find(function (x) {
          return TBSlipOcr.fixtureGameId(x) === id;
        });
        if (g && evIn) evIn.value = TBSlipOcr.fixtureEventLabel(g);
        if (g && sport) sport.textContent = TBSlipOcr.fixtureComp(g);
      };
    });
    box.querySelectorAll(".slip-leg-event").forEach(function (inp) {
      inp.onchange = inp.oninput = function () {
        var row = inp.closest(".slip-leg-row");
        if (!row) return;
        var hit = TBSlipOcr.matchEventToFixture(SLIP.fixtures, inp.value.trim(), "");
        var hid = row.querySelector(".slip-leg-gid");
        var pick = row.querySelector(".slip-leg-fixture");
        var sport = row.querySelector(".slip-leg-sport");
        if (hit) {
          var id = TBSlipOcr.fixtureGameId(hit);
          if (hid) hid.value = id;
          if (pick) pick.value = id;
          if (sport) sport.textContent = TBSlipOcr.fixtureComp(hit);
        } else {
          if (hid) hid.value = "";
          if (pick) pick.value = "";
        }
      };
    });
  }

  function slipFlagsHtml() {
    var fl = ((SLIP.parsed && SLIP.parsed.flags) || []).filter(function (f) { return f.leg == null; });
    if (!fl.length) return "";
    return '<div id="slip-flags" class="paste-card" style="margin-bottom:12px;color:var(--warn, #e0a100);font-size:var(--t-foot)">' +
      fl.map(function (f) { return "⚠ " + esc(f.reason); }).join("<br>") + "</div>";
  }
  function slipFlagged(field) {
    return ((SLIP.parsed && SLIP.parsed.flags) || []).some(function (f) { return f.leg == null && f.field === field; });
  }
  function renderReviewScreen() {
    var d = SLIP.draft || {};
    var legs = (SLIP.parsedLegs && SLIP.parsedLegs.length ? SLIP.parsedLegs : d.parsed_legs || []).slice();
    var multiEvent = (SLIP.parsed && SLIP.parsed.bet_type) === "Multi" && TBSlipOcr.uniqueEvents(legs).length > 1;
    panel("builder");
    $("builder").innerHTML =
      '<div class="back" id="slip-back">← Back</div>' +
      '<h1 style="margin:0 0 12px">Review imported slip</h1>' +
      '<p style="color:var(--muted);margin:0 0 14px">Fix anything the OCR misread. Highlighted fields were read with low confidence or not found. Cross-game multis need the right fixture on each leg.</p>' +
      slipFlagsHtml() +
      '<div class="panel">' +
      '<div class="field"><label>Bet type</label><input id="slip-bet-type" style="' + flagStyle(slipFlagged("bet_type")).slice(1) + '" value="' +
      esc(d.bet_type || "") +
      '"></div>' +
      '<div class="field"><label>Total odds</label><input id="slip-odds" style="' + flagStyle(slipFlagged("odds")).slice(1) + '" type="number" step="0.01" value="' +
      esc(d.odds != null ? String(d.odds) : "") +
      '"></div>' +
      (multiEvent
        ? ""
        : '<div class="field"><label>Event</label><input id="slip-event" style="' + flagStyle(slipFlagged("event")).slice(1) + '" value="' + esc(d.game_name || "") + '"></div>') +
      '<div class="field"><label>Date & time</label><input id="slip-when" style="' + flagStyle(slipFlagged("date_time")).slice(1) + '" value="' +
      esc(d.date_time || "") +
      '"></div>' +
      '<div class="field"><label>Sport</label><input id="slip-sport" style="' + flagStyle(slipFlagged("sport")).slice(1) + '" value="' +
      esc(d.sport || "") +
      '"></div>' +
      '<div class="field"><label>Bookmaker</label><input id="slip-book" value="' +
      esc(d.bookmaker || "") +
      '"></div>' +
      stakeFieldHtml() +
      '<h3 style="margin:18px 0 8px">' +
      esc(String(legs.length)) +
      " leg" +
      (legs.length === 1 ? "" : "s") +
      "</h3>" +
      '<div id="slip-legs">' +
      legs.map(legRowHtml).join("") +
      "</div>" +
      '<p style="color:var(--faint);font-size:var(--t-foot);margin-top:10px">Screenshot will attach to the tip (same as the manual upload on the confirm step).</p>' +
      '<div class="sched-actions" style="margin-top:16px"><button class="btn secondary" type="button" id="slip-retry">Try another image</button>' +
      '<button class="btn" type="button" id="slip-apply">Continue to schedule →</button></div>' +
      '<div id="slip-err" class="err" style="margin-top:10px"></div>' +
      "</div>";
    $("slip-back").onclick = renderPickScreen;
    $("slip-retry").onclick = renderPickScreen;
    $("slip-apply").onclick = applyToBuilder;
    wireLegFixturePickers();
    wireStakeField();
    wireLegMatch();
  }
  function stakeFieldHtml() {
    var dollars = SLIP.parsed && SLIP.parsed.stake_dollars;
    var mode = SLIP.stakeMode || (dollars > 0 ? "dollars" : "units");
    SLIP.stakeMode = mode;
    var us = typeof guildUnitSize === "function" ? guildUnitSize(SLIP.guildId) : 0;
    var shown = mode === "dollars" && dollars > 0 ? String(dollars) : (SLIP.parsed && SLIP.parsed.stake != null ? String(SLIP.parsed.stake) : "");
    var hint = mode === "dollars"
      ? (us > 0 ? "Dollars convert with your unit size of $" + us + "." : "No unit size yet, so dollars stay as dollars until one is set. Switch to units to enter a stake.")
      : "Enter units, or switch to dollars.";
    return '<div class="field"><label>Stake</label>' +
      '<div class="stake-toggle" role="group" aria-label="Stake in dollars or units">' +
      '<button type="button" class="ghost slip-stake-mode' + (mode === "dollars" ? " on" : "") + '" data-mode="dollars">$</button>' +
      '<button type="button" class="ghost slip-stake-mode' + (mode === "units" ? " on" : "") + '" data-mode="units">Units</button></div>' +
      '<input id="slip-stake" type="number" step="0.5" inputmode="decimal" placeholder="' + (mode === "dollars" ? "Dollars" : "Units") + '" value="' + esc(shown) + '">' +
      '<div id="slip-stake-hint" style="color:var(--faint);font-size:var(--t-foot);margin-top:6px">' + esc(hint) + "</div>" +
      '<div id="slip-stake-prev" style="color:var(--muted);font-size:var(--t-foot);margin-top:4px"></div></div>';
  }
  function paintStakePreview() {
    var prev = $("slip-stake-prev");
    if (!prev) return;
    var raw = parseFloat(($("slip-stake") || {}).value);
    if (SLIP.stakeMode !== "dollars" || !(raw > 0)) { prev.textContent = ""; return; }
    var us = typeof guildUnitSize === "function" ? guildUnitSize(SLIP.guildId) : 0;
    if (!(us > 0) || typeof dollarsToUnits !== "function") { prev.textContent = ""; return; }
    var units = dollarsToUnits(raw, us);
    prev.textContent = units > 0 ? ("= " + units + " units") : "";
  }
  function wireStakeField() {
    document.querySelectorAll(".slip-stake-mode").forEach(function (b) {
      b.onclick = function () {
        SLIP.stakeMode = b.getAttribute("data-mode") || "units";
        var input = $("slip-stake");
        var keep = input ? input.value : "";
        var wrap = b.parentNode && b.parentNode.parentNode;
        if (!wrap) return;
        var parsed = SLIP.parsed || {};
        if (SLIP.stakeMode === "dollars") parsed.stake_dollars = parseFloat(keep) > 0 ? parseFloat(keep) : parsed.stake_dollars;
        else parsed.stake = parseFloat(keep) > 0 ? parseFloat(keep) : parsed.stake;
        SLIP.parsed = parsed;
        wrap.outerHTML = stakeFieldHtml();
        wireStakeField();
      };
    });
    var input = $("slip-stake");
    if (input) input.oninput = paintStakePreview;
    paintStakePreview();
  }
  function wireLegMatch() {
    var box = $("slip-legs");
    if (!box) return;
    box.querySelectorAll(".slip-leg-row").forEach(function (row) {
      row.querySelectorAll("input,select").forEach(function (el) {
        var prev = el.oninput;
        el.addEventListener("input", function () { refreshLegMatch(row); });
        el.addEventListener("change", function () { refreshLegMatch(row); if (prev) prev(); });
      });
      var skip = row.querySelector(".slip-leg-skip");
      if (skip) skip.onclick = function () {
        row.setAttribute("data-skipped", "1");
        row.classList.remove("slip-leg-unmatched");
        skip.disabled = true;
        skip.textContent = "Skipped";
      };
    });
  }
  function stakeUnitsValue() {
    var raw = parseFloat(($("slip-stake") || {}).value);
    if (!(raw > 0)) return null;
    if ((SLIP.stakeMode || "units") === "dollars") {
      var us = typeof guildUnitSize === "function" ? guildUnitSize(SLIP.guildId) : 0;
      if (!(us > 0) || typeof dollarsToUnits !== "function") return null;
      var units = dollarsToUnits(raw, us);
      return units > 0 ? units : null;
    }
    return raw;
  }
  function noteOpenLegs() {
    /* public-omit:slip-leg-note */
    if (typeof STATE === "undefined" || STATE.ops !== true) return;
    var box = $("slip-legs");
    if (!box || typeof api !== "function") return;
    box.querySelectorAll('.slip-leg-row[data-open="1"]').forEach(function (row) {
      var skipped = row.getAttribute("data-skipped") === "1";
      if (!skipped && row.classList.contains("slip-leg-unmatched")) return;
      var raw = {};
      try { raw = JSON.parse(row.getAttribute("data-raw") || "{}"); } catch (e) { raw = {}; }
      var entered = skipped ? null : rowToLeg(row);
      api("/api/slip/leg-note", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          guild_id: SLIP.guildId,
          image_b64: SLIP.imageData || "",
          raw: raw,
          skipped: skipped,
          entered: entered,
        }),
      }).catch(function () {});
    });
    /* /public-omit:slip-leg-note */
  }

  function readReviewDraft() {
    var legsBox = $("slip-legs");
    var legs = [];
    if (legsBox) {
      legsBox.querySelectorAll(".slip-leg-row").forEach(function (row) {
        var q = function (c) { var el = row.querySelector(c); return el && el.value != null ? String(el.value).trim() : ""; };
        var sportEl = row.querySelector(".slip-leg-sport");
        var kind = row.getAttribute("data-kind") || "";
        var skipped = row.getAttribute("data-skipped") === "1";
        var event = q(".slip-leg-event");
        var who = q(".slip-leg-sel"), stat = q(".slip-leg-mkt");
        var line = parseFloat(q(".slip-leg-line")), lo = parseFloat(q(".slip-leg-odds"));
        var leg = {
          kind: kind,
          selection: who,
          market: stat,
          stat: stat,
          line: isFinite(line) ? line : null,
          side: q(".slip-leg-side"),
          odds: isFinite(lo) && lo > 1 ? lo : null,
          event: event,
          game_id: q(".slip-leg-gid"),
          skipped: skipped,
        };
        if (kind === "team") leg.team = who;
        else if (kind !== "racing" && leg.line != null) leg.player = who;
        leg.sport = sportEl && sportEl.textContent ? sportEl.textContent.trim() : TBSlipOcr.detectSport(event, [leg]);
        legs.push(leg);
      });
    }
    var odds = parseFloat(($("slip-odds") || {}).value);
    var events = TBSlipOcr.uniqueEvents(legs);
    return {
      bet_type: (($("slip-bet-type") || {}).value || "").trim(),
      odds: isFinite(odds) ? odds : null,
      game_name: $("slip-event")
        ? (($("slip-event") || {}).value || "").trim()
        : events.length === 1
          ? events[0]
          : events.length
            ? events.length + " games"
            : "",
      date_time: (($("slip-when") || {}).value || "").trim(),
      sport: (($("slip-sport") || {}).value || "").trim(),
      bookmaker: (($("slip-book") || {}).value || "").trim(),
      stake: stakeUnitsValue(),
      stake_mode: SLIP.stakeMode || "units",
      stake_dollars: (SLIP.stakeMode === "dollars" && parseFloat(($("slip-stake") || {}).value) > 0)
        ? parseFloat(($("slip-stake") || {}).value)
        : null,
      legs: legs,
    };
  }

  function resolvePrimaryGame(legs) {
    var ids = [];
    (legs || []).forEach(function (l) {
      if (l.game_id && ids.indexOf(l.game_id) < 0) ids.push(l.game_id);
    });
    if (ids.length !== 1) return null;
    return (SLIP.fixtures || []).find(function (g) {
      return TBSlipOcr.fixtureGameId(g) === ids[0];
    }) || null;
  }

  async function applyToBuilder() {
    var err = $("slip-err");
    var reviewed = readReviewDraft();
    if (!(reviewed.odds > 1)) {
      if (err) err.textContent = "Odds must be greater than 1.";
      return;
    }
    var legsBox = $("slip-legs");
    if (legsBox && legsBox.querySelector(".slip-leg-unmatched")) {
      if (err) err.textContent = "Match each highlighted leg, or skip matching.";
      return;
    }
    var active = reviewed.legs.filter(function (l) { return !l.skipped; });
    if (!active.length || active.some(function (l) {
      return !l.selection && !l.market;
    })) {
      if (err) err.textContent = "Each leg needs a selection or market.";
      return;
    }
    if (err) err.textContent = "";
    noteOpenLegs();
    reviewed.legs = reviewed.legs.filter(function (l) { return !l.skipped; });
    await ensureSlipOcr();
    if (SLIP.fixtureSport !== (reviewed.sport || "") || !SLIP.fixtures.length) {
      SLIP.fixtures = await loadFixtureGames(reviewed.sport, reviewed.date_time, reviewed.game_name);
      SLIP.fixtureSport = reviewed.sport || "";
    }
    var matchedLegs = TBSlipOcr.attachFixtureMatches(reviewed.legs, SLIP.fixtures);
    var tip = TBSlipOcr.slipToTipDraft({
      bet_type: reviewed.bet_type,
      odds: reviewed.odds,
      event: reviewed.game_name,
      date_time: reviewed.date_time,
      sport: reviewed.sport,
      bookie: TBSlipOcr.detectBookie(SLIP.ocrText || reviewed.bookmaker),
      start_local: (SLIP.parsed && SLIP.parsed.start_local) || "",
      legs: matchedLegs,
    });
    tip.bookmaker = reviewed.bookmaker || tip.bookmaker;
    var editedWhen = TBSlipOcr.parseSlipDate(reviewed.date_time);
    if (editedWhen.local) tip.game_start = editedWhen.local;
    else if (!tip.game_start && SLIP.parsed && SLIP.parsed.start_local) tip.game_start = SLIP.parsed.start_local;
    var gid = SLIP.guildId;
    var name = SLIP.serverName;
    if (!BUILD || String(BUILD.guildId) !== String(gid)) {
      BUILD = {
        guildId: gid,
        serverName: name,
        game: null,
        tab: "Disposals",
        legs: [],
        search: "",
        sort: "number",
        collapsed: {},
        compFilter: "All",
        unitSize: guildUnitSize(gid),
        autoLines: false,
      };
    }
    BUILD.image = SLIP.imageData || null;
    BUILD._slipDiag = { file: SLIP.file, ocr: SLIP.ocr, parsed: SLIP.parsed, guildId: gid, sport: tip.sport || reviewed.sport || "", bookie: tip.bookmaker || "" };
    var primary = resolvePrimaryGame(matchedLegs);
    var state = TBSlipOcr.builderStateForSlip(tip, primary, { parsedLegs: matchedLegs });
    BUILD.legs = state.legs;
    BUILD.custom = state.custom;
    BUILD.espn = state.espn;
    BUILD.espnLeague = state.espnLeague || "";
    BUILD.espnEvent = state.espnEvent;
    BUILD.game = state.game;
    BUILD.customEvent = state.customEvent || "";
    BUILD.customSport = state.customSport || "";
    BUILD.customStartDay = state.customStartDay || "";
    BUILD._importGameName = tip.game_name || reviewed.game_name || "";
    BUILD._importGameStart = (state.espn || state.custom) ? (state.game_start || "") : "";
    panel("builder");
    renderTray();
    renderConfirm();
    var fu = $("f_units");
    if (fu && reviewed.stake > 0) fu.value = String(reviewed.stake);
    var fo = $("f_odds");
    if (fo && reviewed.odds > 1) fo.value = String(reviewed.odds);
    var fb = $("f_book");
    if (fb && tip.bookmaker) {
      var want = String(tip.bookmaker).toLowerCase();
      var opt = Array.prototype.slice.call(fb.options).find(function (o) {
        return o.value && o.value.toLowerCase().replace(/\s/g, "").indexOf(want.replace(/\s/g, "")) >= 0;
      });
      if (opt) fb.value = opt.value;
      else fb.value = tip.bookmaker;
    }
    if (BUILD.image && $("f_img_prev")) {
      $("f_img_prev").innerHTML =
        '<img src="' +
        escAttr(BUILD.image) +
        '" style="max-height:120px;border-radius:var(--r-sm);border:1px solid var(--line)"> <span style="color:var(--faint);font-size:var(--t-foot)">attached from screenshot</span>';
    }
    toast("Slip imported — check legs and schedule when ready.", "success");
  }

  async function openSlipImport(guildId, name) {
    if (typeof buildTipsShown === "function" && !buildTipsShown()) return;
    navNote("#/s/" + encodeURIComponent(guildId) + "/build/import", function () {
      openSlipImport(guildId, name);
    });
    SLIP.guildId = guildId;
    SLIP.serverName = name;
    SLIP.file = null;
    SLIP.imageData = null;
    SLIP.draft = null;
    SLIP.parsed = null;
    SLIP.parsedLegs = [];
    SLIP.fixtures = [];
    SLIP.fixtureSport = "";
    SLIP.ocrText = "";
    SLIP.stakeMode = "";
    await TD.load("builder");
    await ensureSlipOcr();
    renderPickScreen();
  }

  window.openSlipImport = openSlipImport;
  window.TDSlipDiag = { report: reportDiagnostics };
  TD.loaded["slip-ocr-ui"] = true;
})();
