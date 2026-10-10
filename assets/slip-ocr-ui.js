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

  async function runOcr(file) {
    await loadTesseract();
    var base = slipBase();
    var worker = await Tesseract.createWorker("eng", 1, {
      workerPath: base + "worker.min.js",
      corePath: base + "core/",
      langPath: base + "lang/",
      gzip: true,
    });
    try {
      var out = await worker.recognize(file);
      return out && out.data && out.data.text ? out.data.text : "";
    } finally {
      await worker.terminate();
    }
  }

  async function loadFixtureGames() {
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

  async function startImport(file) {
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
    try {
      await ensureSlipOcr();
      SLIP.ocrText = await runOcr(file);
      SLIP.parsed = TBSlipOcr.parseSlipText(SLIP.ocrText);
      SLIP.fixtures = await loadFixtureGames();
      SLIP.parsedLegs = TBSlipOcr.attachFixtureMatches(SLIP.parsed.legs || [], SLIP.fixtures);
      SLIP.parsed = Object.assign({}, SLIP.parsed, { legs: SLIP.parsedLegs });
      SLIP.draft = TBSlipOcr.slipToTipDraft(SLIP.parsed);
      SLIP.imageData = await compressImage(file);
      renderReviewScreen();
    } catch (e) {
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

  function legRowHtml(leg, idx) {
    var sel = leg && leg.selection != null ? leg.selection : "";
    var mkt = leg && leg.market != null ? leg.market : "";
    var ev = leg && leg.event != null ? leg.event : "";
    var gid = leg && leg.game_id != null ? leg.game_id : "";
    return (
      '<div class="paste-card slip-leg-row" data-i="' +
      idx +
      '" style="margin-top:10px">' +
      '<div class="field" style="margin-bottom:8px"><label>Game / event</label>' +
      '<input class="slip-leg-event" data-i="' +
      idx +
      '" value="' +
      esc(ev) +
      '" placeholder="e.g. Geelong v Carlton" style="width:100%">' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;align-items:center">' +
      '<select class="slip-leg-fixture" data-i="' +
      idx +
      '" style="flex:1;min-width:200px">' +
      fixturePickerOptions(SLIP.fixtures, gid) +
      "</select>" +
      '<span class="slip-leg-sport" style="font-size:var(--t-foot);color:var(--muted)">' +
      esc(leg && leg.sport ? leg.sport : "") +
      "</span>" +
      '<input type="hidden" class="slip-leg-gid" data-i="' +
      idx +
      '" value="' +
      escAttr(gid) +
      '">' +
      "</div></div>" +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<input class="slip-leg-sel" data-i="' +
      idx +
      '" placeholder="Selection" value="' +
      esc(sel) +
      '" style="flex:1;min-width:140px">' +
      '<input class="slip-leg-mkt" data-i="' +
      idx +
      '" placeholder="Market / line" value="' +
      esc(mkt) +
      '" style="flex:1;min-width:140px">' +
      "</div></div>"
    );
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

  function renderReviewScreen() {
    var d = SLIP.draft || {};
    var legs = (SLIP.parsedLegs && SLIP.parsedLegs.length ? SLIP.parsedLegs : d.parsed_legs || []).slice();
    var multiEvent = (SLIP.parsed && SLIP.parsed.bet_type) === "Multi" && TBSlipOcr.uniqueEvents(legs).length > 1;
    panel("builder");
    $("builder").innerHTML =
      '<div class="back" id="slip-back">← Back</div>' +
      '<h1 style="margin:0 0 12px">Review imported slip</h1>' +
      '<p style="color:var(--muted);margin:0 0 14px">Fix anything the OCR misread. Cross-game multis need the right fixture on each leg.</p>' +
      '<div class="panel">' +
      '<div class="field"><label>Bet type</label><input id="slip-bet-type" value="' +
      esc(d.bet_type || "") +
      '"></div>' +
      '<div class="field"><label>Total odds</label><input id="slip-odds" type="number" step="0.01" value="' +
      esc(d.odds != null ? String(d.odds) : "") +
      '"></div>' +
      (multiEvent
        ? ""
        : '<div class="field"><label>Event</label><input id="slip-event" value="' + esc(d.game_name || "") + '"></div>') +
      '<div class="field"><label>Date & time</label><input id="slip-when" value="' +
      esc(d.date_time || "") +
      '"></div>' +
      '<div class="field"><label>Sport</label><input id="slip-sport" value="' +
      esc(d.sport || "") +
      '"></div>' +
      '<div class="field"><label>Bookmaker</label><input id="slip-book" value="' +
      esc(d.bookmaker || "") +
      '"></div>' +
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
  }

  function readReviewDraft() {
    var legsBox = $("slip-legs");
    var legs = [];
    if (legsBox) {
      legsBox.querySelectorAll(".slip-leg-row").forEach(function (row) {
        var selIn = row.querySelector(".slip-leg-sel");
        var mktIn = row.querySelector(".slip-leg-mkt");
        var evIn = row.querySelector(".slip-leg-event");
        var gidIn = row.querySelector(".slip-leg-gid");
        var sportEl = row.querySelector(".slip-leg-sport");
        var event = (evIn && evIn.value ? evIn.value : "").trim();
        legs.push({
          selection: (selIn && selIn.value ? selIn.value : "").trim(),
          market: (mktIn && mktIn.value ? mktIn.value : "").trim(),
          event: event,
          sport: sportEl && sportEl.textContent ? sportEl.textContent.trim() : TBSlipOcr.detectSport(event, []),
          game_id: gidIn && gidIn.value ? gidIn.value.trim() : "",
        });
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
    if (!reviewed.legs.length || reviewed.legs.some(function (l) {
      return !l.selection && !l.market;
    })) {
      if (err) err.textContent = "Each leg needs a selection or market.";
      return;
    }
    if (err) err.textContent = "";
    await ensureSlipOcr();
    if (!SLIP.fixtures.length) SLIP.fixtures = await loadFixtureGames();
    var matchedLegs = TBSlipOcr.attachFixtureMatches(reviewed.legs, SLIP.fixtures);
    var tip = TBSlipOcr.slipToTipDraft({
      bet_type: reviewed.bet_type,
      odds: reviewed.odds,
      event: reviewed.game_name,
      date_time: reviewed.date_time,
      sport: reviewed.sport,
      bookie: TBSlipOcr.detectBookie(SLIP.ocrText || reviewed.bookmaker),
      legs: matchedLegs,
    });
    tip.bookmaker = reviewed.bookmaker || tip.bookmaker;
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
    BUILD.legs = (tip.legs || []).slice();
    BUILD.image = SLIP.imageData || null;
    BUILD.custom = false;
    BUILD.espn = false;
    BUILD._importGameName = tip.game_name || reviewed.game_name || "";
    var primary = resolvePrimaryGame(matchedLegs);
    BUILD.game = primary;
    if (!primary && TBSlipOcr.uniqueEvents(matchedLegs).length === 1 && !matchedLegs.some(function (l) {
      return l.game_id;
    })) {
      BUILD.custom = true;
      BUILD.customEvent = matchedLegs[0] && matchedLegs[0].event ? matchedLegs[0].event : reviewed.game_name;
      BUILD.customSport = reviewed.sport || "AFL";
    }
    panel("builder");
    renderTray();
    renderConfirm();
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
    SLIP.ocrText = "";
    await TD.load("builder");
    await ensureSlipOcr();
    renderPickScreen();
  }

  window.openSlipImport = openSlipImport;
  TD.loaded["slip-ocr-ui"] = true;
})();
