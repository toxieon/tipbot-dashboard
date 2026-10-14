/* Follow-emoji picker: server emojis (static + animated) and standard emojis.
   Stored value: unicode text, or <:name:id> / <a:name:id>. */
(function () {
  "use strict";
  var UNICODE = ["🫡","👍","🔥","✅","💰","🎯","⭐","💪","🚀","👀","🙌","💯","🏉","🏈","🏀","⚽","🐎","🎾","🏏","🍀","❤️","😎","🤑","📈"];
  var TOKEN = /^<(a?):([A-Za-z0-9_~\-]{1,64}):(\d{15,22})>$/;
  var LEGACY = /^:?([A-Za-z0-9_~\-]{1,64}):(\d{15,22}):?$/;

  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function parse(v) {
    v = String(v || "").trim();
    if (!v) return null;
    var m = TOKEN.exec(v);
    if (m) return { custom: true, animated: m[1] === "a", name: m[2], id: m[3], token: v };
    m = LEGACY.exec(v);
    if (m) return { custom: true, animated: false, name: m[1], id: m[2], token: "<:" + m[1] + ":" + m[2] + ">" };
    return { custom: false, token: v };
  }
  function url(p) {
    return "https://cdn.discordapp.com/emojis/" + p.id + "." + (p.animated ? "gif" : "png") + "?size=48";
  }
  function preview(v) {
    var p = parse(v);
    if (!p) return '<span style="color:var(--faint)">none</span>';
    if (p.custom) return '<img src="' + esc(url(p)) + '" alt=":' + esc(p.name) + ':" width="24" height="24" style="vertical-align:middle">';
    return esc(p.token);
  }
  function cell(inner, val, title) {
    return '<button type="button" class="ep-cell" data-v="' + esc(val) + '" title="' + esc(title || "") + '" '
      + 'style="width:40px;height:40px;display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--line);border-radius:var(--r-sm);background:var(--card2);font-size:22px;cursor:pointer;padding:0">'
      + inner + "</button>";
  }
  function gridHtml(emojis, current) {
    var cur = parse(current);
    var html = "";
    if (emojis && emojis.length) {
      html += '<div style="font-size:var(--t-foot);color:var(--muted);margin:6px 0 4px">This server</div><div style="display:flex;flex-wrap:wrap;gap:6px">';
      emojis.forEach(function (e) {
        var p = { id: e.id, animated: !!e.animated };
        var src = e.url ? String(e.url) : url(p);
        html += cell('<img src="' + esc(src) + '" alt=":' + esc(e.name) + ':" width="26" height="26" loading="lazy">',
          e.token || ("<" + (e.animated ? "a" : "") + ":" + e.name + ":" + e.id + ">"), ":" + e.name + ":" + (e.animated ? " (animated)" : ""));
      });
      html += "</div>";
    }
    html += '<div style="font-size:var(--t-foot);color:var(--muted);margin:10px 0 4px">Standard</div><div style="display:flex;flex-wrap:wrap;gap:6px">';
    UNICODE.forEach(function (u) { html += cell(esc(u), u, u); });
    html += "</div>";
    if (cur && cur.custom && emojis && !emojis.some(function (e) { return String(e.id) === cur.id; })) {
      html += '<div style="font-size:var(--t-foot);color:var(--loss);margin-top:8px">The saved server emoji isn\'t in this server any more. TipBot reacts with 🫡 until you pick another.</div>';
    }
    return html;
  }

  window.TBEmojiPicker = { parse: parse, preview: preview, gridHtml: gridHtml, UNICODE: UNICODE,
    mount: function (opts) {
      var input = opts.input, btn = opts.button, panel = opts.panel, api = opts.api, gid = opts.gid;
      var pv = opts.previewEl;
      var loaded = null;
      function refresh() { if (pv) pv.innerHTML = preview(input.value); }
      refresh();
      input.addEventListener("input", refresh);
      function paint() {
        panel.innerHTML = gridHtml(loaded || [], input.value)
          + (loaded === null ? '<div class="ep-loading" style="font-size:var(--t-foot);color:var(--faint);margin-top:6px">Loading server emojis…</div>' : "");
        panel.querySelectorAll(".ep-cell").forEach(function (b) {
          b.onclick = function () { input.value = b.getAttribute("data-v"); refresh(); panel.hidden = true; if (opts.onPick) opts.onPick(input.value); };
        });
      }
      btn.onclick = async function () {
        if (!panel.hidden) { panel.hidden = true; return; }
        panel.hidden = false;
        paint();
        if (loaded !== null) return;
        try {
          var r = await api("/api/guild-emojis?guild_id=" + encodeURIComponent(gid));
          var j = await r.json();
          loaded = (j && Array.isArray(j.emojis)) ? j.emojis : [];
        } catch (e) {
          if (e && e.unauth && opts.onUnauth) return opts.onUnauth();
          loaded = [];
        }
        if (!panel.hidden) paint();
      };
    } };
})();
