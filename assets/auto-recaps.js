/* Auto recaps settings (daily / weekly / monthly Discord embeds). Admin-only preview. */
(function () {
  "use strict";
  var DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function timeInputs(kind, cfg) {
    cfg = cfg || {};
    var h = cfg.hour != null ? cfg.hour : 9;
    var m = cfg.minute != null ? cfg.minute : 0;
    var html = '<label style="font-size:var(--t-foot);color:var(--muted)">Post at (Sydney)</label>'
      + '<span style="display:inline-flex;align-items:center;gap:4px">'
      + '<input type="number" min="0" max="23" class="ar-hour" data-k="' + kind + '" value="' + esc(h) + '" style="width:52px;padding:6px 8px;border-radius:var(--r-sm);border:1px solid var(--line);background:var(--card2);color:var(--txt)">'
      + '<span>:</span>'
      + '<input type="number" min="0" max="59" class="ar-min" data-k="' + kind + '" value="' + esc(m) + '" style="width:52px;padding:6px 8px;border-radius:var(--r-sm);border:1px solid var(--line);background:var(--card2);color:var(--txt)">'
      + '</span>';
    if (kind === "weekly") {
      var wd = cfg.weekday != null ? cfg.weekday : 0;
      html += '<label style="font-size:var(--t-foot);color:var(--muted);margin-left:8px">On</label>'
        + '<select class="ar-weekday" data-k="weekly" style="padding:6px 8px;border-radius:var(--r-sm);border:1px solid var(--line);background:var(--card2);color:var(--txt);font:inherit">'
        + DAYS.map(function (d, i) { return '<option value="' + i + '"' + (i === wd ? " selected" : "") + ">" + d + "</option>"; }).join("")
        + "</select>";
    }
    if (kind === "monthly") {
      var day = cfg.day != null ? cfg.day : 1;
      html += '<label style="font-size:var(--t-foot);color:var(--muted);margin-left:8px">Day</label>'
        + '<input type="number" min="1" max="28" class="ar-mday" data-k="monthly" value="' + esc(day) + '" style="width:52px;padding:6px 8px;border-radius:var(--r-sm);border:1px solid var(--line);background:var(--card2);color:var(--txt)">';
    }
    return html;
  }

  function periodRow(kind, label, cfg) {
    cfg = cfg || {};
    var on = !!cfg.enabled;
    return '<div class="ar-row" data-period="' + kind + '" style="border:1px solid var(--line);border-radius:var(--r-md);padding:10px 12px;margin-top:8px">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">'
      + '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:650">'
      + '<input type="checkbox" class="ar-en" data-k="' + kind + '"' + (on ? " checked" : "") + ' style="width:16px;height:16px">'
      + esc(label) + "</label>"
      + '<button type="button" class="ghost sm ar-preview" data-k="' + kind + '">Send preview now</button>'
      + "</div>"
      + '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px">' + timeInputs(kind, cfg) + "</div>"
      + "</div>";
  }

  function panelHTML(data) {
    var s = (data && data.settings) || {};
    var outs = Array.isArray(data && data.outputs) ? data.outputs : [];
    var chans = Array.isArray(data && data.channels) ? data.channels : [];
    var ck = s.channel_key || "recaps";
    var skip = s.skip_empty !== false;
    var optOuts = outs.map(function (o) {
      return '<option value="' + esc(o.key) + '"' + (o.key === ck ? " selected" : "") + ">" + esc(o.label || o.key) + "</option>";
    }).join("");
    return '<div id="auto-recap-box" style="margin-top:14px;padding-top:12px;border-top:1px solid var(--line)">'
      + '<div style="font-weight:700;font-size:var(--t-sub);margin-bottom:4px">Auto recaps</div>'
      + '<div style="color:var(--faint);font-size:var(--t-foot);line-height:1.45;margin-bottom:8px">'
      + "TipBot posts a rich results embed to Discord on a schedule (Sydney time). All periods default off. "
      + "Daily posts yesterday; weekly posts the previous week; monthly posts the previous month.</div>"
      + periodRow("daily", "Daily", s.daily)
      + periodRow("weekly", "Weekly", s.weekly)
      + periodRow("monthly", "Monthly", s.monthly)
      + '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:12px">'
      + '<label style="color:var(--muted);font-size:var(--t-sub)">Channel</label>'
      + '<select id="ar-channel" style="padding:6px 8px;border-radius:var(--r-sm);border:1px solid var(--line);background:var(--card2);color:var(--txt);font:inherit">' + optOuts + "</select>"
      + '<span style="color:var(--faint);font-size:var(--t-foot)">Uses your Channels routing for that output.</span></div>'
      + '<label style="display:flex;align-items:center;gap:8px;margin-top:10px;cursor:pointer;font-size:var(--t-sub)">'
      + '<input type="checkbox" id="ar-skip"' + (skip ? " checked" : "") + ' style="width:16px;height:16px">'
      + "Skip empty periods (off = post a short “no tips” note)</label>"
      + '<div style="display:flex;align-items:center;gap:10px;margin-top:12px">'
      + '<button type="button" class="btn sm" id="ar-save">Save recaps</button>'
      + '<span id="ar-msg" style="font-size:var(--t-foot)"></span></div>'
      + (chans.length ? "" : '<div style="color:var(--faint);font-size:var(--t-foot);margin-top:6px">Tip: set the Recaps channel under the Channels tab.</div>')
      + "</div>";
  }

  function readSettings(root) {
    function num(sel, def) {
      var el = root.querySelector(sel);
      var v = el ? parseInt(el.value, 10) : def;
      return Number.isFinite(v) ? v : def;
    }
    var out = { daily: {}, weekly: {}, monthly: {} };
    ["daily", "weekly", "monthly"].forEach(function (k) {
      var en = root.querySelector('.ar-en[data-k="' + k + '"]');
      out[k].enabled = !!(en && en.checked);
      out[k].hour = num('.ar-hour[data-k="' + k + '"]', 9);
      out[k].minute = num('.ar-min[data-k="' + k + '"]', 0);
    });
    out.weekly.weekday = num(".ar-weekday", 0);
    out.monthly.day = num(".ar-mday", 1);
    var ch = root.querySelector("#ar-channel");
    out.channel_key = ch ? ch.value : "recaps";
    var sk = root.querySelector("#ar-skip");
    out.skip_empty = !!(sk && sk.checked);
    return out;
  }

  function setMsg(text, ok) {
    var m = document.getElementById("ar-msg");
    if (!m) return;
    m.textContent = text || "";
    m.style.color = ok ? "var(--win)" : "var(--loss)";
  }

  async function mount(slot, ctx) {
    if (!slot || !ctx || !ctx.api || !ctx.gid) return;
    if (ctx.canAdmin === false) { slot.innerHTML = ""; return; }
    slot.innerHTML = '<div style="color:var(--faint);font-size:var(--t-foot);margin-top:14px">Loading auto recaps…</div>';
    var data;
    try {
      var r = await ctx.api("/api/auto-recap?guild_id=" + encodeURIComponent(ctx.gid));
      if (r.status === 404) { slot.innerHTML = ""; return; }
      data = await r.json();
      if (!data || data.ok !== true) {
        slot.innerHTML = '<div style="color:var(--loss);font-size:var(--t-foot);margin-top:14px">' + esc((data && data.error) || "Couldn't load auto recaps.") + "</div>";
        return;
      }
    } catch (e) {
      if (e && e.unauth && ctx.onUnauth) return ctx.onUnauth();
      slot.innerHTML = '<div style="color:var(--loss);font-size:var(--t-foot);margin-top:14px">Couldn\'t reach TipBot.</div>';
      return;
    }
    slot.innerHTML = panelHTML(data);
    var root = slot.querySelector("#auto-recap-box");
    var save = root.querySelector("#ar-save");
    if (save) save.onclick = async function () {
      save.disabled = true; setMsg("Saving…", true);
      try {
        var body = Object.assign({ guild_id: ctx.gid }, readSettings(root));
        var r = await ctx.api("/api/auto-recap", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        var j = await r.json();
        if (r.status === 404) { setMsg("Not available.", false); return; }
        setMsg(j && j.ok ? "✓ saved" : (j && (j.message || j.error)) || "error", !!(j && j.ok));
      } catch (e) {
        if (e && e.unauth && ctx.onUnauth) return ctx.onUnauth();
        setMsg("couldn't save", false);
      } finally { save.disabled = false; }
    };
    root.querySelectorAll(".ar-preview").forEach(function (btn) {
      btn.onclick = async function () {
        if (btn.disabled) return;
        btn.disabled = true; setMsg("Sending preview…", true);
        try {
          var r = await ctx.api("/api/auto-recap/preview", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ guild_id: ctx.gid, kind: btn.getAttribute("data-k") }),
          });
          var j = await r.json();
          if (r.status === 404) { setMsg("Admins only.", false); return; }
          setMsg(j && j.ok ? (j.message || "Preview sent.") : (j && (j.error || j.message)) || "Couldn't send.", !!(j && j.ok));
        } catch (e) {
          if (e && e.unauth && ctx.onUnauth) return ctx.onUnauth();
          setMsg("couldn't reach TipBot", false);
        } finally { btn.disabled = false; }
      };
    });
  }

  window.TBAutoRecaps = { mount: mount };
})();
