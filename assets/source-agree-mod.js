/* Server settings -> Command access -> Predictor Call (TipBot 0.92.33+):
 * when enabled, this server can multi-select automatic horse sources and a
 * dest channel. A selected source tip is reposted there with whether Horse
 * Predictor agrees. GET/POST /api/server/predictor-agree.
 * window.TBSourceAgree + CommonJS. Not part of the public site.
 */
(function (root) {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function selectedIds(view, state) {
    return (view.picker || []).filter(function (s) { return !!state.src[s.id]; }).map(function (s) { return s.id; });
  }

  function dirty(view, state) {
    var have = (view.sources || []).slice().sort().join(",");
    var want = selectedIds(view, state).slice().sort().join(",");
    var ch = state.channel_id || "";
    var saved = view.channel_id || "";
    return !!state.enabled !== !!view.enabled || have !== want || ch !== saved;
  }

  function html(view, state, opts) {
    opts = opts || {};
    var edit = !!view.can_edit;
    var on = !!state.enabled;
    var out = '<div class="sam" id="sam">'
      + '<div class="sam-cap">Predictor Call</div>'
      + '<div class="sam-lead">When a selected automatic horse source posts a tip, TipBot reposts it in the channel below and says whether Horse Predictor agrees. Close means a p_win gap of 5.0pp or less between our pick and theirs on that model. This is not the Agree channel (both models, same horse).</div>'
      + '<div class="switch sam-row">'
      + '<button type="button" class="toggle sam-t' + (on ? " on" : "") + '" id="sam-on" role="switch" aria-checked="' + (on ? "true" : "false") + '" aria-label="Enable Predictor Call"' + (edit ? "" : " disabled") + '></button>'
      + '<span class="sam-txt"><b>Enable Predictor Call</b><span>Uses the models this server tracks (Command access \u2192 Stat tracker). Default: every model on.</span></span>'
      + '</div>';
    if (on) {
      var picker = view.picker || [];
      out += '<div class="sam-k">Automatic horse sources</div>';
      if (!picker.length) {
        out += '<div class="sam-note">No automatic horse sources to select yet.</div>';
      } else {
        out += '<div class="sam-list" role="group" aria-label="Automatic horse sources">';
        picker.forEach(function (s) {
          var checked = !!state.src[s.id];
          var sub = [s.guild_name, s.enabled ? "On" : "Paused"].filter(Boolean).join(" \u00b7 ");
          out += '<label class="sam-src"><input type="checkbox" data-src="' + esc(s.id) + '"'
            + (checked ? " checked" : "") + (edit ? "" : " disabled") + "> <span><b>"
            + esc(s.tipster_name || s.id) + "</b>" + (sub ? "<span>" + esc(sub) + "</span>" : "") + "</span></label>";
        });
        out += "</div>";
      }
      out += '<label class="sam-field" for="sam-ch"><span class="sam-k">Repost channel</span>'
        + '<select id="sam-ch" aria-label="Repost channel"' + (edit ? "" : " disabled") + ">"
        + '<option value="">Select a channel</option>';
      (view.channels || []).forEach(function (c) {
        var id = String(c.id);
        out += '<option value="' + esc(id) + '"' + (state.channel_id === id ? " selected" : "") + ">#"
          + esc(c.name || id) + "</option>";
      });
      out += "</select></label>";
    }
    if (edit) {
      out += '<div class="sam-act"><button class="btn sm" id="sam-save"' + (dirty(view, state) ? "" : " disabled") + ">Save</button>"
        + '<span id="sam-msg" class="sam-msg" role="status">' + esc(opts.msg || "") + "</span></div>";
    } else {
      out += '<div class="sam-note">Only the owner or a server admin can change this.</div>';
    }
    return out + "</div>";
  }

  var CSS = ".sam{margin-top:20px;padding-top:14px;border-top:1px solid var(--line)}"
    + ".sam-cap{color:var(--faint);font-size:var(--t-cap);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px}"
    + ".sam-lead,.sam-note{color:var(--faint);font-size:var(--t-foot);line-height:1.4;margin-bottom:10px}"
    + ".sam-row{justify-content:flex-start;gap:12px;margin-bottom:10px}"
    + ".sam-txt{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}"
    + ".sam-txt b{font-size:var(--t-callout);font-weight:600}"
    + ".sam-txt span{color:var(--faint);font-size:var(--t-foot);line-height:1.3}"
    + ".sam-k{color:var(--faint);font-size:var(--t-cap);text-transform:uppercase;letter-spacing:.06em;margin:10px 0 6px}"
    + ".sam-list{display:flex;flex-direction:column;gap:8px}"
    + ".sam-src{display:flex;align-items:flex-start;gap:8px;font-size:var(--t-callout)}"
    + ".sam-src span{display:flex;flex-direction:column;gap:1px}"
    + ".sam-src span span{color:var(--faint);font-size:var(--t-foot)}"
    + ".sam-field{display:flex;flex-direction:column;gap:6px;margin-top:8px}"
    + ".sam-field select{background:var(--card2);color:var(--txt);border:1px solid var(--line);border-radius:var(--r-sm);padding:8px 10px;font:inherit;cursor:pointer;max-width:100%}"
    + ".sam-act{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:12px;padding-bottom:calc(72px + env(safe-area-inset-bottom, 0px))}"
    + ".sam-msg{font-size:var(--t-foot)}"
    + ".sam-t[disabled]{cursor:not-allowed;opacity:.6}";

  function injectCss() {
    var doc = root.document;
    if (!doc || doc.getElementById("sam-css")) return;
    var st = doc.createElement("style");
    st.id = "sam-css"; st.textContent = CSS;
    doc.head.appendChild(st);
  }

  function visible(v) {
    return !!(v && v.ok && v.has_predictor);
  }

  function takeState(view) {
    var src = {};
    (view.picker || []).forEach(function (s) { src[s.id] = (view.sources || []).indexOf(s.id) !== -1; });
    return { enabled: !!view.enabled, src: src, channel_id: view.channel_id ? String(view.channel_id) : "" };
  }

  function mount(box, opts) {
    if (!box) return Promise.resolve(null);
    injectCss();
    var gid = String(opts.gid);
    var view = null, state = { enabled: false, src: {}, channel_id: "" };
    function paint(msg, ok) {
      if (!box.isConnected && root.document) return;
      box.innerHTML = html(view, state, { msg: msg });
      var m = box.querySelector("#sam-msg");
      if (m && msg) m.style.color = ok ? "var(--win)" : "var(--loss)";
      var tog = box.querySelector("#sam-on");
      if (tog) tog.onclick = function () { if (tog.disabled) return; state.enabled = !state.enabled; paint(); };
      box.querySelectorAll("[data-src]").forEach(function (node) {
        node.onchange = function () { state.src[node.getAttribute("data-src")] = !!node.checked; paint(); };
      });
      var ch = box.querySelector("#sam-ch");
      if (ch) ch.onchange = function () { state.channel_id = ch.value || ""; paint(); };
      var save = box.querySelector("#sam-save");
      if (save) save.onclick = function () { doSave(save); };
    }
    function doSave(btn) {
      btn.disabled = true;
      var body = JSON.stringify({
        guild_id: gid,
        enabled: !!state.enabled,
        sources: selectedIds(view, state),
        channel_id: state.channel_id || null,
      });
      return opts.api("/api/server/predictor-agree", { method: "POST", headers: { "Content-Type": "application/json" }, body: body })
        .then(function (r) { return r.json().then(function (j) { return { r: r, j: j }; }); })
        .then(function (x) {
          if (x.r.ok && x.j && x.j.ok) { view = x.j; state = takeState(view); paint("\u2713 saved", true); }
          else paint((x.j && (x.j.message || x.j.error)) || "Couldn\u2019t save.", false);
        })
        .catch(function (e) {
          if (e && e.unauth && opts.onUnauth) return opts.onUnauth();
          paint("Couldn\u2019t reach the bot.", false);
        });
    }
    return opts.api("/api/server/predictor-agree?guild_id=" + encodeURIComponent(gid))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (v) {
        if (!visible(v)) { box.innerHTML = ""; return null; }
        view = v; state = takeState(v); paint();
        return v;
      })
      .catch(function (e) {
        if (e && e.unauth && opts.onUnauth) opts.onUnauth();
        box.innerHTML = "";
        return null;
      });
  }

  var api = { mount: mount, visible: visible, html: html, selectedIds: selectedIds, dirty: dirty, takeState: takeState, injectCss: injectCss };
  if (typeof module === "object" && module.exports) module.exports = api;
  root.TBSourceAgree = api;
})(typeof window !== "undefined" ? window : globalThis);
