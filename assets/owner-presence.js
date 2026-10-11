(function(W){
  "use strict";
  function esc(value){
    return String(value==null?"":value).replace(/[&<>"']/g, function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
    });
  }
  function paint(box) {
    box.innerHTML = `
      <div class="presence-section" style="margin-top:20px; border-top:1px solid var(--line); padding-top:20px;">
        <div class="switch">
          <button class="toggle" id="presence-toggle" aria-label="Who's online"></button>
          <span>Who's online <span class="badge" id="presence-count" style="display:none;"></span></span>
        </div>
        <div id="presence-body" style="display:none; margin-top:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <h3 style="margin:0; font-size:1rem; color:var(--txt);">Live</h3>
            <button class="ghost sm" id="presence-refresh">Refresh</button>
          </div>
          <div id="presence-live" style="min-height:50px; color:var(--muted); font-size:var(--t-sub);">Loading...</div>
          
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:24px; margin-bottom:12px;">
            <h3 style="margin:0; font-size:1rem; color:var(--txt);">History</h3>
            <button class="ghost sm" id="presence-export">Download CSV</button>
          </div>
          <div id="presence-history" style="min-height:50px; color:var(--muted); font-size:var(--t-sub);">Loading...</div>
        </div>
      </div>
    `;

    const toggle = box.querySelector("#presence-toggle");
    const body = box.querySelector("#presence-body");
    const refreshBtn = box.querySelector("#presence-refresh");
    const liveDiv = box.querySelector("#presence-live");
    const historyDiv = box.querySelector("#presence-history");
    const countBadge = box.querySelector("#presence-count");

    let liveTimer = null;
    let isOpen = false;

    toggle.addEventListener("click", function(){
      isOpen = !isOpen;
      if(isOpen) {
        toggle.classList.add("on");
        body.style.display = "block";
        loadLive();
        loadHistory();
        liveTimer = setInterval(loadLive, 30000);
      } else {
        toggle.classList.remove("on");
        body.style.display = "none";
        clearInterval(liveTimer);
      }
    });

    refreshBtn.addEventListener("click", function(){
      refreshBtn.textContent = "Refreshing...";
      loadLive().finally(() => refreshBtn.textContent = "Refresh");
    });

    function loadLive(){
      return fetch("https://afl-tipster-bot.onrender.com/api/ops/presence/online", {
        headers: { "Authorization": "Bearer " + W.getToken() }
      }).then(r => r.ok ? r.json() : []).then(data => {
        countBadge.textContent = data.length || 0;
        countBadge.style.display = data.length ? "inline-block" : "none";
        
        if(!data.length) {
          liveDiv.innerHTML = "No one is currently online.";
          return;
        }

        let html = '<div class="presence-list" style="display:flex; flex-direction:column; gap:12px;">';
        data.forEach(u => {
          html += `
            <div style="display:flex; align-items:center; gap:12px; padding:12px; background:var(--card2); border-radius:var(--radius);">
              <img src="${esc(u.avatar||'./assets/favicon.svg')}" style="width:40px; height:40px; border-radius:50%; object-fit:cover; background:var(--bg);">
              <div style="flex:1;">
                <div style="font-weight:600; color:var(--txt);">${esc(u.discord_name || u.id)}</div>
                <div style="font-size:var(--t-sub); color:var(--muted);">
                  Online ${Math.floor(u.session_duration_sec/60)}m · Last active ${Math.floor((Date.now() - new Date(u.last_seen))/1000)}s ago
                </div>
                <div style="font-size:11px; color:var(--faint); margin-top:4px;">Servers: ${esc((u.servers||[]).join(', ') || 'None')}</div>
              </div>
            </div>
          `;
        });
        html += '</div>';
        liveDiv.innerHTML = html;
      }).catch(err => {
        liveDiv.innerHTML = "Failed to load live presence.";
      });
    }

    function loadHistory(){
      return fetch("https://afl-tipster-bot.onrender.com/api/ops/presence/history", {
        headers: { "Authorization": "Bearer " + W.getToken() }
      }).then(r => r.ok ? r.json() : []).then(data => {
        if(!data.length) {
          historyDiv.innerHTML = "No history available.";
          return;
        }
        let html = '<table style="width:100%; text-align:left; border-collapse:collapse; font-size:var(--t-sub);"><thead><tr style="border-bottom:1px solid var(--line);"><th style="padding:8px 4px;">User</th><th style="padding:8px 4px;">Start</th><th style="padding:8px 4px;">End</th><th style="padding:8px 4px; text-align:right;">Duration</th></tr></thead><tbody>';
        data.forEach(s => {
          const start = new Date(s.start_time);
          const end = s.end_time ? new Date(s.end_time) : null;
          html += `
            <tr style="border-bottom:1px solid var(--line);">
              <td style="padding:8px 4px;">${esc(s.discord_name || s.user_id)}</td>
              <td style="padding:8px 4px;">${start.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</td>
              <td style="padding:8px 4px;">${end ? end.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : 'Active'}</td>
              <td style="padding:8px 4px; text-align:right;">${Math.floor(s.duration_sec/60)}m</td>
            </tr>
          `;
        });
        html += '</tbody></table>';
        historyDiv.innerHTML = html;
      }).catch(err => {
        historyDiv.innerHTML = "Failed to load history.";
      });
    }

    const exportBtn = box.querySelector("#presence-export");
    exportBtn.addEventListener("click", function(){
      exportBtn.textContent = "Downloading...";
      fetch("https://afl-tipster-bot.onrender.com/api/ops/presence/export.csv", {
        headers: { "Authorization": "Bearer " + W.getToken() }
      }).then(r => {
        if(!r.ok) throw new Error("Export failed");
        return r.blob();
      }).then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "presence-export.csv";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }).catch(() => {
        if(W.toast) W.toast("Failed to download CSV", "error");
      }).finally(() => {
        exportBtn.textContent = "Download CSV";
      });
    });
  }

  W.TBPresence = { paint: paint };
})(window);
