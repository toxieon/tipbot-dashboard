/* Results post (admin): preview a day's graded bets as a card + copy text, then post to a channel.
   Browser global window.TBResultsPost + CommonJS export for node --test.
   mount(box, {api, gid, onUnauth}). */
(function (root) {
  "use strict";

  var CSS_ID = "rp-css";
  var CSS = [
    "#results-post-box,[data-rp]{min-width:0;max-width:100%}",
    "[data-rp]{box-sizing:border-box;border:1px solid var(--line,#3f4147);border-radius:var(--r-md,12px);background:var(--card2,#181c22);padding:12px 14px 14px;margin:0 0 12px;color:var(--txt,#f5f7fa)}",
    "[data-rp] *{box-sizing:border-box}",
    "[data-rp] .rp-title{font-weight:750;font-size:var(--t-sub,15px);margin:0 0 4px}",
    "[data-rp] .rp-lead{color:var(--faint,#9aa3ad);font-size:var(--t-foot,12px);line-height:1.45;margin:0 0 12px}",
    "[data-rp] .rp-row{display:flex;flex-wrap:wrap;align-items:flex-end;gap:8px 12px;margin:0 0 10px}",
    "[data-rp] label.rp-field{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--muted,#a8acb2);flex:1 1 140px}",
    "[data-rp] label.rp-check{display:flex;align-items:center;gap:8px;min-height:44px;font-size:14px;color:var(--txt,#f5f7fa);cursor:pointer;user-select:none}",
    "[data-rp] input[type=date],[data-rp] select,[data-rp] textarea{width:100%;min-height:44px;border-radius:10px;border:1px solid var(--line,#3f4147);background:var(--card,#12151a);color:var(--txt,#f5f7fa);padding:8px 10px;font:inherit}",
    "[data-rp] input[type=checkbox]{width:18px;height:18px;flex:none}",
    "[data-rp] textarea{min-height:120px;resize:vertical;line-height:1.45;font-size:13px}",
    "[data-rp] .rp-counts{font-size:12px;color:var(--faint,#9aa3ad);margin:0 0 8px}",
    "[data-rp] .rp-counts .rp-warn{color:var(--loss,#e55)}",
    "[data-rp] .rp-card{width:100%;max-width:540px;border-radius:10px;border:1px solid var(--line,#3f4147);background:#0d1419;display:block}",
    "[data-rp] .rp-actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:8px}",
    "[data-rp] .rp-actions .ghost,[data-rp] .rp-actions .btn{min-height:44px}",
    "[data-rp] .rp-msg{display:block;font-size:12px;color:var(--faint,#9aa3ad);margin-top:8px;min-height:1em}",
    "[data-rp] .rp-msg.rp-err{color:var(--loss,#e55)}",
    "[data-rp] .rp-msg.rp-ok{color:var(--win,#3dcc7a)}",
    "[data-rp] .rp-empty{color:var(--faint,#9aa3ad);font-size:13px;padding:8px 0}"
  ].join("");

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function injectCss(doc) {
    if (!doc || !doc.getElementById || doc.getElementById(CSS_ID)) return;
    var style = doc.createElement("style");
    style.id = CSS_ID;
    style.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(style);
  }

  function queryString(gid, ui) {
    ui = ui || {};
    var q = "guild_id=" + encodeURIComponent(String(gid || ""));
    if (ui.from) q += "&from=" + encodeURIComponent(ui.from);
    if (ui.to) q += "&to=" + encodeURIComponent(ui.to);
    if (ui.include_void) q += "&include_void=1";
    if (ui.page && ui.page !== 1) q += "&page=" + encodeURIComponent(String(ui.page));
    if (ui.header === false) q += "&header=0";
    return q;
  }

  function imagePath(gid, ui) {
    return "/api/results-post/image?" + queryString(gid, ui);
  }

  function contextPath(gid, ui) {
    var q = queryString(gid, ui).replace(/&page=[^&]+/, "").replace(/&header=[^&]+/, "");
    return "/api/results-post?" + q;
  }

  function sendPayload(gid, ui) {
    return {
      guild_id: String(gid || ""),
      from: ui.from || "",
      to: ui.to || "",
      channel_id: String(ui.channel_id || ""),
      include_text: !!ui.include_text,
      include_void: !!ui.include_void
    };
  }

  function countsNote(counts) {
    counts = counts || {};
    var bits = [];
    var listed = Number(counts.listed) || 0;
    bits.push(listed === 1 ? "1 bet" : listed + " bets");
    if (counts.void_push) bits.push(counts.void_push + " void/push hidden");
    if (counts.pending) bits.push(counts.pending + " still pending");
    if (counts.late_excluded) bits.push(counts.late_excluded + " late excluded");
    var text = bits.join(" · ");
    if (counts.over_cap) text += " · showing the first " + listed + " (cap reached)";
    return text;
  }

  function channelOptions(channels, selected) {
    var list = Array.isArray(channels) ? channels : [];
    if (!list.length) return '<option value="">No channels</option>';
    return list.map(function (ch) {
      var id = String((ch && ch.id) || "");
      var name = String((ch && ch.name) || id);
      var sel = id && id === String(selected || "") ? " selected" : "";
      return '<option value="' + esc(id) + '"' + sel + ">#" + esc(name) + "</option>";
    }).join("");
  }

  function pickChannel(channels, current) {
    var list = Array.isArray(channels) ? channels : [];
    if (current && list.some(function (c) { return String(c.id) === String(current); })) return String(current);
    var named = list.find(function (c) { return String(c.name || "").toLowerCase() === "results"; });
    if (named) return String(named.id);
    return list.length ? String(list[0].id) : "";
  }

  function isUnauth(res, err) {
    return !!(err && err.unauth) || !!(res && res.status === 401);
  }

  function shellHtml(data, ui) {
    data = data || {};
    ui = ui || {};
    var from = ui.from || data.from || data.default_day || "";
    var to = ui.to || data.to || from;
    var pages = Number(data.pages) || 0;
    var page = Math.max(1, Math.min(ui.page || 1, pages || 1));
    var empty = data.ok && pages === 0;
    var err = data.ok === false ? (data.error || "Couldn't load results.") : "";
    var img = ui.imgUrl
      ? '<img class="rp-card" alt="Results card page ' + page + '" src="' + esc(ui.imgUrl) + '">'
      : (ui.loading ? '<div class="rp-empty">Loading preview…</div>' : "");
    var nav = pages > 1
      ? '<div class="rp-actions">'
        + '<button type="button" class="ghost" data-rp-prev' + (page <= 1 ? " disabled" : "") + ">Previous page</button>"
        + '<span class="rp-counts">Page ' + page + " of " + pages + "</span>"
        + '<button type="button" class="ghost" data-rp-next' + (page >= pages ? " disabled" : "") + ">Next page</button>"
        + "</div>"
      : "";
    return '<div data-rp>'
      + '<div class="rp-title">Results post</div>'
      + '<p class="rp-lead">Preview a day of graded bets as a card image and copy text, then post it to a channel in this server. The text matches the Results DM.</p>'
      + '<div class="rp-row">'
      + '<label class="rp-field">From <input type="date" data-rp-from value="' + esc(from) + '"></label>'
      + '<label class="rp-field">To <input type="date" data-rp-to value="' + esc(to) + '"></label>'
      + '<label class="rp-check"><input type="checkbox" data-rp-void' + (ui.include_void ? " checked" : "") + "> Include void / push</label>"
      + "</div>"
      + (err ? '<div class="rp-msg rp-err">' + esc(err) + "</div>" : "")
      + (data.ok ? '<div class="rp-counts">' + esc(countsNote(data.counts)) + (data.tz ? " · " + esc(data.tz) : "") + "</div>" : "")
      + (empty ? '<div class="rp-empty">No graded bets in that range.</div>' : img)
      + nav
      + (pages ? '<label class="rp-check"><input type="checkbox" data-rp-header' + (ui.header === false ? "" : " checked") + "> Card header</label>" : "")
      + (data.text ? '<label class="rp-field">Copy text <textarea data-rp-text readonly>' + esc(data.text) + "</textarea></label>"
        + '<div class="rp-actions"><button type="button" class="ghost" data-rp-copy>Copy text</button></div>' : "")
      + (data.ok ? '<div class="rp-row">'
        + '<label class="rp-field">Post to <select data-rp-channel>' + channelOptions(data.channels, ui.channel_id) + "</select></label>"
        + '<label class="rp-check"><input type="checkbox" data-rp-texton' + (ui.include_text ? " checked" : "") + "> Also post the text</label>"
        + "</div>"
        + '<div class="rp-actions"><button type="button" class="btn" data-rp-send' + (empty || !ui.channel_id ? " disabled" : "") + ">Post to channel</button></div>"
        : "")
      + '<span class="rp-msg' + (ui.msgKind === "err" ? " rp-err" : ui.msgKind === "ok" ? " rp-ok" : "") + '" data-rp-msg">' + esc(ui.msg || "") + "</span>"
      + "</div>";
  }

  function readUi(rootEl, ui) {
    ui = Object.assign({}, ui);
    var from = rootEl.querySelector("[data-rp-from]");
    var to = rootEl.querySelector("[data-rp-to]");
    var vo = rootEl.querySelector("[data-rp-void]");
    var hd = rootEl.querySelector("[data-rp-header]");
    var ch = rootEl.querySelector("[data-rp-channel]");
    var tx = rootEl.querySelector("[data-rp-texton]");
    if (from) ui.from = from.value;
    if (to) ui.to = to.value;
    if (vo) ui.include_void = !!vo.checked;
    if (hd) ui.header = !!hd.checked;
    if (ch) ui.channel_id = ch.value;
    if (tx) ui.include_text = !!tx.checked;
    return ui;
  }

  function mount(box, ctx) {
    if (!box) return function () {};
    ctx = ctx || {};
    var api = ctx.api;
    var gid = ctx.gid;
    var doc = box.ownerDocument || (root.document);
    if (doc) injectCss(doc);
    var stopped = false;
    var timer = 0;
    var imgUrl = "";
    var data = { ok: false };
    var ui = { page: 1, header: true, include_void: false, include_text: false, loading: true };

    function alive() { return !stopped && box.isConnected !== false; }

    function revoke() {
      if (imgUrl && typeof URL !== "undefined" && URL.revokeObjectURL) {
        try { URL.revokeObjectURL(imgUrl); } catch (e) {}
      }
      imgUrl = "";
    }

    function paint(msg, kind) {
      if (!alive()) return;
      ui.imgUrl = imgUrl;
      ui.msg = msg || ui.msg || "";
      if (kind) ui.msgKind = kind;
      else if (msg) ui.msgKind = "";
      box.innerHTML = shellHtml(data, ui);
      bind();
    }

    function bind() {
      var from = box.querySelector("[data-rp-from]");
      var to = box.querySelector("[data-rp-to]");
      var vo = box.querySelector("[data-rp-void]");
      var hd = box.querySelector("[data-rp-header]");
      var ch = box.querySelector("[data-rp-channel]");
      var tx = box.querySelector("[data-rp-texton]");
      var copy = box.querySelector("[data-rp-copy]");
      var send = box.querySelector("[data-rp-send]");
      var prev = box.querySelector("[data-rp-prev]");
      var next = box.querySelector("[data-rp-next]");
      function reloadSoon() {
        ui = readUi(box, ui);
        ui.page = 1;
        if (timer) clearTimeout(timer);
        timer = setTimeout(function () { load(); }, 280);
      }
      if (from) from.onchange = reloadSoon;
      if (to) to.onchange = reloadSoon;
      if (vo) vo.onchange = reloadSoon;
      if (hd) hd.onchange = function () { ui = readUi(box, ui); loadImage(); };
      if (ch) ch.onchange = function () { ui = readUi(box, ui); };
      if (tx) tx.onchange = function () { ui = readUi(box, ui); };
      if (prev) prev.onclick = function () { ui = readUi(box, ui); ui.page = Math.max(1, (ui.page || 1) - 1); loadImage(); paint(); };
      if (next) next.onclick = function () { ui = readUi(box, ui); ui.page = (ui.page || 1) + 1; loadImage(); paint(); };
      if (copy) copy.onclick = function () {
        var area = box.querySelector("[data-rp-text]");
        var text = area ? area.value : (data.text || "");
        function done(ok) { paint(ok ? "Copied." : "Couldn't copy.", ok ? "ok" : "err"); }
        if (text && root.navigator && root.navigator.clipboard && root.navigator.clipboard.writeText) {
          root.navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
        } else if (area) {
          try { area.select(); doc.execCommand("copy"); done(true); } catch (e) { done(false); }
        } else done(false);
      };
      if (send) send.onclick = function () { post(); };
    }

    async function call(path, opts) {
      try {
        var res = await api(path, opts || {});
        if (isUnauth(res)) {
          if (typeof ctx.onUnauth === "function") ctx.onUnauth();
          return { unauth: true, res: res };
        }
        return { res: res };
      } catch (err) {
        if (isUnauth(null, err)) {
          if (typeof ctx.onUnauth === "function") ctx.onUnauth();
          return { unauth: true, err: err };
        }
        return { err: err };
      }
    }

    async function load() {
      if (!alive() || typeof api !== "function") return;
      ui.loading = true;
      ui.msg = "";
      paint("Loading…");
      var out = await call(contextPath(gid, ui));
      if (!alive() || out.unauth) return;
      if (out.err || !out.res) {
        data = { ok: false, error: "Couldn't reach TipBot." };
        ui.loading = false;
        paint(data.error, "err");
        return;
      }
      var body = {};
      try { body = await out.res.json(); } catch (e) { body = {}; }
      if (out.res.status === 404) {
        data = { ok: false, error: "Only this server's owner and admins can do this." };
        ui.loading = false;
        paint(data.error, "err");
        return;
      }
      if (!body || body.ok === false) {
        data = { ok: false, error: (body && (body.error || body.message)) || "Couldn't load results." };
        ui.loading = false;
        paint(data.error, "err");
        return;
      }
      data = body;
      if (!ui.from) ui.from = data.from || data.default_day || "";
      if (!ui.to) ui.to = data.to || ui.from;
      ui.channel_id = pickChannel(data.channels, ui.channel_id);
      ui.loading = false;
      paint();
      await loadImage();
    }

    async function loadImage() {
      if (!alive() || typeof api !== "function") return;
      if (!data || !data.pages) { revoke(); paint(); return; }
      var out = await call(imagePath(gid, ui));
      if (!alive() || out.unauth) return;
      if (out.err || !out.res || !out.res.ok) { revoke(); paint(); return; }
      try {
        var blob = await out.res.blob();
        revoke();
        if (typeof URL !== "undefined" && URL.createObjectURL) imgUrl = URL.createObjectURL(blob);
      } catch (e) { revoke(); }
      paint();
    }

    async function post() {
      ui = readUi(box, ui);
      if (!ui.channel_id) { paint("Pick a channel.", "err"); return; }
      paint("Posting…");
      var out = await call("/api/results-post/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sendPayload(gid, ui))
      });
      if (!alive() || out.unauth) return;
      if (out.err || !out.res) { paint("Couldn't reach TipBot.", "err"); return; }
      var body = {};
      try { body = await out.res.json(); } catch (e) { body = {}; }
      if (body && body.ok) paint(body.message || "Posted.", "ok");
      else paint((body && (body.error || body.message)) || "Couldn't post.", "err");
    }

    if (ctx.data) {
      data = ctx.data;
      ui = Object.assign(ui, ctx.ui || {}, { loading: false });
      ui.from = ui.from || data.from || data.default_day || "";
      ui.to = ui.to || data.to || ui.from;
      ui.channel_id = pickChannel(data.channels, ui.channel_id);
      if (ctx.ui && ctx.ui.imgUrl) imgUrl = ctx.ui.imgUrl;
      paint();
    } else {
      paint("Loading…");
      load();
    }

    return function stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      revoke();
    };
  }

  var api = {
    mount: mount,
    queryString: queryString,
    imagePath: imagePath,
    contextPath: contextPath,
    sendPayload: sendPayload,
    countsNote: countsNote,
    pickChannel: pickChannel,
    channelOptions: channelOptions,
    shellHtml: shellHtml
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.TBResultsPost = api;
})(typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : this);
