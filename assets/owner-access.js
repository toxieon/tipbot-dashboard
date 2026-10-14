/* Owner-only Access panel for one server's Settings tab.
   Shown only for an owner session that is not using view-as — the same gate
   as the other owner-only controls on that server.
   TipBot:
     GET    /api/owner/access?guild_id=
     POST   /api/owner/access/mod   {guild_id, user_id, assign_role}
     DELETE /api/owner/access/mod   {guild_id, user_id, remove_role}
     GET    /api/owner/access/members?guild_id=&q=   member search for the picker
*/
(function (root) {
  "use strict";
  var PATHS = {
    list: "/api/owner/access",
    mod: "/api/owner/access/mod",
    search: "/api/owner/access/members"
  };
  var SOURCES = { role: "Role", manual: "Manual", permission: "Permission" };
  var GROUPS = [
    { key: "admins", label: "Admins", removable: false },
    { key: "mods", label: "Mods", removable: true },
    { key: "followers", label: "Followers", removable: false }
  ];
  var CSS = ""
    + ".oa{min-width:0;max-width:100%}"
    + ".oa-lead{color:var(--faint);font-size:var(--t-foot);line-height:1.45;margin:0 0 12px}"
    + ".oa-form{display:flex;flex-direction:column;gap:10px;min-width:0;margin-bottom:16px}"
    + ".oa-field{display:flex;flex-direction:column;gap:6px;min-width:0;color:var(--muted);font-size:var(--t-sub);font-weight:650}"
    + ".oa-field input{width:100%;max-width:100%;box-sizing:border-box;min-height:44px;padding:8px 10px;border-radius:var(--r-sm);border:1px solid var(--line);background:var(--card2);color:var(--txt);font:inherit}"
    + ".oa-check{display:flex;align-items:center;gap:8px;min-height:44px;color:var(--txt);font-size:var(--t-sub);cursor:pointer}"
    + ".oa-check input{width:18px;height:18px;margin:0;flex:none}"
    + ".oa-form .btn{width:100%;max-width:100%;box-sizing:border-box}"
    + ".oa-msg{margin:0;min-height:1.2em;font-size:var(--t-foot);color:var(--faint)}"
    + ".oa-msg.ok{color:var(--win)}.oa-msg.err{color:var(--loss)}"
    + ".oa-hits{border:1px solid var(--line);border-radius:var(--r-md);background:var(--card);overflow:auto;max-height:220px}"
    + ".oa-hit{display:flex;align-items:center;gap:10px;width:100%;min-height:44px;padding:8px 10px;box-sizing:border-box;background:transparent;border:0;border-bottom:1px solid var(--line);color:inherit;font:inherit;text-align:left;cursor:pointer}"
    + ".oa-hit:last-child{border-bottom:0}"
    + ".oa-group{margin:0 0 8px}"
    + ".oa-group h4{margin:14px 0 6px;color:var(--faint);font-size:var(--t-cap);font-weight:700;letter-spacing:.06em;text-transform:uppercase}"
    + ".oa-row{display:grid;grid-template-columns:40px minmax(0,1fr);gap:4px 10px;align-items:center;padding:10px 0;border-bottom:1px solid var(--line)}"
    + ".oa-av{width:40px;height:40px;border-radius:50%;background:var(--card2);object-fit:cover;display:block}"
    + ".oa-av-ph{width:40px;height:40px;border-radius:50%;background:var(--card2);color:var(--muted);display:grid;place-items:center;font-weight:800;font-size:var(--t-sub)}"
    + ".oa-main{min-width:0}"
    + ".oa-name{font-weight:700;font-size:var(--t-callout);overflow-wrap:anywhere}"
    + ".oa-meta{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:3px;color:var(--faint);font-size:var(--t-foot)}"
    + ".oa-badge{font-size:var(--t-cap);font-weight:700;letter-spacing:.03em;padding:2px 8px;border-radius:999px;border:1px solid var(--line);background:var(--card2);color:var(--muted)}"
    + ".oa-badge-role{color:#9db8ff;background:rgba(91,140,255,.16);border-color:transparent}"
    + ".oa-badge-manual{color:#e0a04a;background:rgba(224,160,74,.16);border-color:transparent}"
    + ".oa-badge-permission{color:#c9b8ff;background:rgba(123,91,255,.16);border-color:transparent}"
    + ".oa-side{grid-column:1 / -1}"
    + ".oa-remove{width:100%;box-sizing:border-box;min-height:44px}"
    + ".oa .empty{padding:8px 0}";

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function allowed(state) {
    return !!(state && state.ops === true && !state.viewAs);
  }
  function safeUrl(url) {
    var s = String(url || "").trim();
    if (/^https:\/\//i.test(s) || /^data:image\//i.test(s)) return s;
    return "";
  }
  function sourceKey(value) {
    var s = String(value || "").toLowerCase();
    return SOURCES[s] ? s : "";
  }
  function sourceLabel(value) {
    var key = sourceKey(value);
    return key ? SOURCES[key] : (value ? String(value) : "Unknown");
  }
  function seenLabel(value, fmt) {
    if (value == null || value === "") return "Not seen yet";
    var t = Date.parse(String(value));
    if (!Number.isFinite(t)) return String(value);
    var diff = Date.now() - t;
    if (diff < 0) diff = 0;
    var min = Math.floor(diff / 60000);
    if (min < 1) return "Just now";
    if (min < 60) return min + "m ago";
    var hr = Math.floor(min / 60);
    if (hr < 48) return hr + "h ago";
    var day = Math.floor(hr / 24);
    if (day < 14) return day + "d ago";
    if (typeof fmt === "function") {
      try { return fmt(t) || String(value); } catch (e) {}
    }
    try { return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }); }
    catch (e2) { return String(value); }
  }
  function entry(raw) {
    if (!raw || typeof raw !== "object") return null;
    var id = raw.id != null ? raw.id : raw.user_id;
    if (id == null || String(id).trim() === "") return null;
    return {
      id: String(id).trim(),
      name: String(raw.name || raw.display_name || id),
      avatar: safeUrl(raw.avatar || raw.avatar_url || ""),
      source: sourceKey(raw.source),
      sourceRaw: raw.source == null ? "" : String(raw.source),
      last_seen: raw.last_seen != null ? raw.last_seen : (raw.lastSeen != null ? raw.lastSeen : null)
    };
  }
  function listOf(value) {
    var rows = Array.isArray(value) ? value : [];
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      var row = entry(rows[i]);
      if (row) out.push(row);
    }
    return out;
  }
  function groupsFrom(payload) {
    payload = payload || {};
    if (Array.isArray(payload.groups)) {
      return payload.groups.map(function (g, i) {
        g = g || {};
        var key = String(g.key || g.id || ("group" + i));
        return {
          key: key,
          label: String(g.label || g.title || g.name || "Group"),
          removable: g.removable === true || key === "mods",
          entries: listOf(g.entries || g.members || g.people || [])
        };
      });
    }
    var bag = payload.groups && typeof payload.groups === "object" ? payload.groups : payload;
    if (bag.admins_mods && !bag.admins && !bag.mods) {
      return [
        { key: "admins_mods", label: "Admins & mods", removable: true, entries: listOf(bag.admins_mods) },
        { key: "followers", label: "Followers", removable: false, entries: listOf(bag.followers) }
      ];
    }
    return GROUPS.map(function (g) {
      return { key: g.key, label: g.label, removable: g.removable, entries: listOf(bag[g.key]) };
    });
  }
  function validUserId(value) {
    return /^[1-9][0-9]{4,24}$/.test(String(value || "").trim());
  }
  function addPayload(guildId, userId, assignRole) {
    return { guild_id: String(guildId), user_id: String(userId).trim(), assign_role: !!assignRole };
  }
  function removePayload(guildId, userId, removeRole) {
    return { guild_id: String(guildId), user_id: String(userId).trim(), remove_role: !!removeRole };
  }
  function avatarHtml(person) {
    var letter = esc((person.name || "?").trim().charAt(0).toUpperCase() || "?");
    if (!person.avatar) return '<span class="oa-av-ph" aria-hidden="true">' + letter + "</span>";
    return '<img class="oa-av" src="' + esc(person.avatar) + '" alt="" width="40" height="40" loading="lazy" decoding="async">';
  }
  function badgeHtml(person) {
    var key = person.source || "unknown";
    var label = person.source ? sourceLabel(person.source) : sourceLabel(person.sourceRaw);
    return '<span class="oa-badge oa-badge-' + esc(key) + '">' + esc(label) + "</span>";
  }
  function rowHtml(person, removable, fmt) {
    var when = seenLabel(person.last_seen, fmt);
    var time = person.last_seen ? '<time datetime="' + esc(person.last_seen) + '">' + esc(when) + "</time>" : esc(when);
    var side = removable
      ? '<div class="oa-side"><button type="button" class="ghost oa-remove" data-id="' + esc(person.id) + '" data-name="' + esc(person.name) + '">Remove mod</button></div>'
      : "";
    return '<div class="oa-row" data-id="' + esc(person.id) + '">'
      + avatarHtml(person)
      + '<div class="oa-main"><div class="oa-name">' + esc(person.name) + '</div>'
      + '<div class="oa-meta">' + badgeHtml(person) + time + "</div></div>"
      + side + "</div>";
  }
  function groupsHtml(state, fmt) {
    if (state.phase === "loading") return '<div class="empty" role="status">Loading access…</div>';
    if (state.phase === "missing") return '<div class="empty" role="status">This needs TipBot’s latest deploy.</div><button type="button" class="ghost" id="oa-retry">Retry</button>';
    if (state.phase === "error") return '<div class="empty" role="status">Couldn’t load access.</div><button type="button" class="ghost" id="oa-retry">Retry</button>';
    var groups = state.groups || [];
    if (!groups.length) return '<div class="empty">No one here yet.</div>';
    return groups.map(function (g) {
      var body = g.entries.length
        ? g.entries.map(function (person) { return rowHtml(person, g.removable, fmt); }).join("")
        : '<div class="empty">No ' + esc(g.label.toLowerCase()) + " yet.</div>";
      return '<section class="oa-group" data-group="' + esc(g.key) + '"><h4>' + esc(g.label) + " · " + g.entries.length + "</h4>" + body + "</section>";
    }).join("");
  }
  function hitsHtml(state) {
    if (state.hitsPhase === "loading") return '<div class="empty" role="status">Searching…</div>';
    if (state.hitsPhase === "missing") return '<div class="empty">Member search needs TipBot’s latest deploy. Paste a user ID instead.</div>';
    if (state.hitsPhase === "error") return '<div class="empty">Couldn’t search members.</div>';
    if (state.hitsPhase !== "ready") return "";
    if (!state.hits || !state.hits.length) return '<div class="empty">No members match.</div>';
    return state.hits.map(function (person) {
      return '<button type="button" class="oa-hit" data-id="' + esc(person.id) + '" data-name="' + esc(person.name) + '">'
        + avatarHtml(person) + "<span>" + esc(person.name) + "</span></button>";
    }).join("");
  }
  function panelHtml(state, fmt) {
    var hits = hitsHtml(state);
    return '<div class="oa">'
      + '<p class="oa-lead">Admins, mods and followers on this server. Only you can see this.</p>'
      + '<form class="oa-form" id="oa-add">'
      + '<label class="oa-field">Find a member<input id="oa-search" type="search" autocomplete="off" placeholder="Name" aria-label="Search members" aria-controls="oa-hits" aria-expanded="' + (hits ? "true" : "false") + '"></label>'
      + '<div id="oa-hits" class="oa-hits"' + (hits ? "" : " hidden") + ">" + hits + "</div>"
      + '<label class="oa-field">Discord user ID<input id="oa-uid" inputmode="numeric" autocomplete="off" placeholder="User ID" aria-label="Discord user ID"></label>'
      + '<label class="oa-check"><input type="checkbox" id="oa-assign"> Assign the Discord role</label>'
      + '<button class="btn" type="submit" id="oa-add-btn"' + (state.busy ? " disabled" : "") + ">Add mod</button>"
      + '<p id="oa-msg" class="oa-msg' + (state.error ? " err" : (state.message ? " ok" : "")) + '" role="status">' + esc(state.message || "") + "</p>"
      + "</form>"
      + '<div id="oa-groups">' + groupsHtml(state, fmt) + "</div></div>";
  }
  function membersFrom(payload) {
    payload = payload || {};
    return listOf(payload.members || payload.results || payload.users || []);
  }
  function injectCss() {
    var doc = root.document;
    if (!doc || doc.getElementById("oa-css")) return;
    var style = doc.createElement("style");
    style.id = "oa-css";
    style.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(style);
  }
  function confirmRemove(name, confirmFn) {
    var ask = confirmFn;
    if (typeof ask !== "function") {
      ask = function () { return Promise.resolve(false); };
    }
    return Promise.resolve(ask({
      title: "Remove " + name + " as a mod?",
      message: "They lose mod access on this server.",
      confirmLabel: "Remove mod",
      cancelLabel: "Cancel",
      destructive: true,
      detailHtml: '<label class="oa-check"><input type="checkbox" id="oa-remove-role"> Also remove the Discord role</label>'
    })).then(function (ok) {
      if (ok && typeof ok === "object") return { ok: ok.ok !== false, remove_role: !!ok.remove_role };
      var box = root.document && root.document.getElementById("oa-remove-role");
      return { ok: !!ok, remove_role: !!(box && box.checked) };
    });
  }

  var current = null;
  function mount(el, opts) {
    opts = opts || {};
    if (current) current.stop();
    var alive = true;
    var ctrl = { stop: function () { alive = false; if (timer) clearTimeout(timer); if (current === ctrl) current = null; }, reload: function () { return load(); } };
    current = ctrl;
    if (!el) return ctrl;
    injectCss();
    if (opts.allowed === false || (typeof opts.allowed === "function" && !opts.allowed())) {
      el.innerHTML = "";
      return ctrl;
    }
    var gid = opts.gid;
    var fmt = opts.when;
    var state = { phase: "loading", groups: null, message: "", error: false, busy: false, hits: null, hitsPhase: "idle" };
    var timer = null;
    var searchGen = 0;
    var loadGen = 0;
    function paint() {
      if (!alive) return;
      var search = el.querySelector("#oa-search");
      var uid = el.querySelector("#oa-uid");
      var assign = el.querySelector("#oa-assign");
      var keep = {
        search: search ? search.value : "",
        uid: uid ? uid.value : "",
        assign: assign ? assign.checked : false,
        focus: root.document && root.document.activeElement && root.document.activeElement.id
      };
      el.innerHTML = panelHtml(state, fmt);
      var s2 = el.querySelector("#oa-search");
      var u2 = el.querySelector("#oa-uid");
      var a2 = el.querySelector("#oa-assign");
      if (s2) s2.value = keep.search;
      if (u2) u2.value = keep.uid;
      if (a2) a2.checked = keep.assign;
      wire();
      if (keep.focus === "oa-search" && s2) s2.focus();
      if (keep.focus === "oa-uid" && u2) u2.focus();
    }
    function paintHits() {
      if (!alive) return;
      var box = el.querySelector("#oa-hits");
      var input = el.querySelector("#oa-search");
      if (!box) return;
      var html = hitsHtml(state);
      box.innerHTML = html;
      box.hidden = !html;
      if (input) input.setAttribute("aria-expanded", html ? "true" : "false");
      wireHits();
    }
    function wireHits() {
      var box = el.querySelector("#oa-hits");
      if (!box) return;
      var buttons = box.querySelectorAll(".oa-hit");
      for (var i = 0; i < buttons.length; i++) {
        buttons[i].onclick = function (ev) {
          var b = ev.currentTarget;
          var uid = el.querySelector("#oa-uid");
          if (uid) uid.value = b.getAttribute("data-id") || "";
          state.hitsPhase = "idle";
          state.hits = null;
          state.message = "Selected " + (b.getAttribute("data-name") || "member") + ".";
          state.error = false;
          paint();
        };
      }
    }
    function wire() {
      var form = el.querySelector("#oa-add");
      var search = el.querySelector("#oa-search");
      var retry = el.querySelector("#oa-retry");
      if (form) form.onsubmit = function (ev) { ev.preventDefault(); add(); };
      if (search) search.oninput = function () { queueSearch(search.value); };
      if (retry) retry.onclick = function () { load(); };
      var removes = el.querySelectorAll(".oa-remove");
      for (var i = 0; i < removes.length; i++) {
        removes[i].onclick = function (ev) {
          var b = ev.currentTarget;
          remove(b.getAttribute("data-id"), b.getAttribute("data-name") || "this mod");
        };
      }
      wireHits();
    }
    function queueSearch(raw) {
      if (timer) clearTimeout(timer);
      var q = String(raw || "").trim();
      searchGen++;
      var gen = searchGen;
      if (q.length < 2) {
        state.hitsPhase = "idle";
        state.hits = null;
        paintHits();
        return;
      }
      state.hitsPhase = "loading";
      paintHits();
      timer = setTimeout(function () { runSearch(q, gen); }, 280);
    }
    async function runSearch(q, gen) {
      try {
        var r = await opts.call(PATHS.search + "?guild_id=" + encodeURIComponent(gid) + "&q=" + encodeURIComponent(q));
        if (!alive || gen !== searchGen) return;
        if (r.status === 404 || r.status === 501) { state.hitsPhase = "missing"; paintHits(); return; }
        var j = null;
        try { j = await r.json(); } catch (e) { j = null; }
        if (!alive || gen !== searchGen) return;
        if (!r.ok || !j || j.ok === false) { state.hitsPhase = "error"; paintHits(); return; }
        state.hits = membersFrom(j);
        state.hitsPhase = "ready";
        paintHits();
      } catch (e) {
        if (e && e.unauth && opts.onUnauth) { opts.onUnauth(); return; }
        if (!alive || gen !== searchGen) return;
        state.hitsPhase = "error";
        paintHits();
      }
    }
    async function load() {
      var gen = ++loadGen;
      state.phase = "loading";
      state.groups = null;
      paint();
      try {
        var r = await opts.call(PATHS.list + "?guild_id=" + encodeURIComponent(gid));
        if (!alive || gen !== loadGen) return;
        if (r.status === 404 || r.status === 501) { state.phase = "missing"; paint(); return; }
        var j = null;
        try { j = await r.json(); } catch (e) { j = null; }
        if (!alive || gen !== loadGen) return;
        if (!r.ok || !j || j.ok === false) { state.phase = "error"; paint(); return; }
        state.groups = groupsFrom(j);
        state.phase = "ready";
        paint();
      } catch (e) {
        if (e && e.unauth && opts.onUnauth) { opts.onUnauth(); return; }
        if (!alive || gen !== loadGen) return;
        state.phase = "error";
        paint();
      }
    }
    async function add() {
      if (state.busy) return;
      var uid = el.querySelector("#oa-uid");
      var assign = el.querySelector("#oa-assign");
      var userId = uid ? uid.value.trim() : "";
      if (!validUserId(userId)) {
        state.message = "Enter a Discord user ID, or pick someone from search.";
        state.error = true;
        paint();
        return;
      }
      state.busy = true;
      state.message = "Adding…";
      state.error = false;
      paint();
      try {
        var body = addPayload(gid, userId, assign && assign.checked);
        var r = await opts.call(PATHS.mod, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        var j = null;
        try { j = await r.json(); } catch (e) { j = null; }
        if (!alive) return;
        if (r.status === 404 || r.status === 501) { state.phase = "missing"; state.busy = false; state.message = ""; paint(); return; }
        if (!r.ok || !j || j.ok === false) {
          state.busy = false;
          state.error = true;
          state.message = (j && (j.message || j.error)) || "Couldn’t add that mod.";
          paint();
          return;
        }
        state.busy = false;
        state.error = false;
        state.message = j.message || "Mod added.";
        if (j.groups || j.admins || j.mods || j.followers) {
          state.groups = groupsFrom(j);
          state.phase = "ready";
          paint();
          var field = el.querySelector("#oa-uid");
          if (field) field.value = "";
          return;
        }
        var field2 = el.querySelector("#oa-uid");
        if (field2) field2.value = "";
        var search2 = el.querySelector("#oa-search");
        if (search2) search2.value = "";
        await load();
        if (!alive || state.phase !== "ready") return;
        state.message = j.message || "Mod added.";
        state.error = false;
        paint();
      } catch (e) {
        if (e && e.unauth && opts.onUnauth) { opts.onUnauth(); return; }
        if (!alive) return;
        state.busy = false;
        state.error = true;
        state.message = "Couldn’t reach TipBot.";
        paint();
      }
    }
    async function remove(userId, name) {
      if (state.busy || !userId) return;
      var choice = await confirmRemove(name, opts.confirm);
      if (!alive || !choice.ok) return;
      state.busy = true;
      state.message = "Removing…";
      state.error = false;
      paint();
      try {
        var body = removePayload(gid, userId, choice.remove_role);
        var r = await opts.call(PATHS.mod, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        var j = null;
        try { j = await r.json(); } catch (e) { j = null; }
        if (!alive) return;
        if (!r.ok || !j || j.ok === false) {
          state.busy = false;
          state.error = true;
          state.message = (j && (j.message || j.error)) || "Couldn’t remove that mod.";
          paint();
          return;
        }
        state.busy = false;
        state.error = false;
        state.message = j.message || "Mod removed.";
        if (j.groups || j.admins || j.mods || j.followers) {
          state.groups = groupsFrom(j);
          state.phase = "ready";
          paint();
          return;
        }
        await load();
        if (!alive || state.phase !== "ready") return;
        state.message = j.message || "Mod removed.";
        state.error = false;
        paint();
      } catch (e) {
        if (e && e.unauth && opts.onUnauth) { opts.onUnauth(); return; }
        if (!alive) return;
        state.busy = false;
        state.error = true;
        state.message = "Couldn’t reach TipBot.";
        paint();
      }
    }
    load();
    return ctrl;
  }

  var api = {
    PATHS: PATHS,
    allowed: allowed,
    groupsFrom: groupsFrom,
    membersFrom: membersFrom,
    sourceLabel: sourceLabel,
    seenLabel: seenLabel,
    validUserId: validUserId,
    addPayload: addPayload,
    removePayload: removePayload,
    panelHtml: panelHtml,
    groupsHtml: groupsHtml,
    hitsHtml: hitsHtml,
    confirmRemove: confirmRemove,
    mount: mount
  };
  root.TBOwnerAccess = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
