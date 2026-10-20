/* tipdash Discover (job 03): moved unchanged out of index.html's main script and loaded the
 * first time Discover is opened (index.html lazyView -> TD.call("discover"), cache-busted with
 * ?v=<VERSION>). This is a plain script in the page's global scope: it uses index.html's STATE,
 * $, esc, api, panel, show, navNote … by name, and its openDiscover replaces the placeholder
 * index.html keeps. Don't turn it into a module or wrap it in a closure.
 */

  function dcGuildAvatar(t, name, size){
    const url=t&&(t.icon_url||t.guild_icon||"");
    const init=(function(n){ const s=String(n||"?").trim(); const p=s.split(/\s+/).filter(Boolean); if(p.length>=2) return (p[0][0]+p[1][0]).toUpperCase(); return (s.slice(0,2).toUpperCase()||"?"); })(name);
    if(url) return '<img class="dc-av" src="'+esc(url)+'" alt="Profile picture" width="'+size+'" height="'+size+'" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement(\'div\'),{className:\'dc-av\',textContent:\''+esc(init)+'\'}))">';
    return '<div class="dc-av" aria-hidden="true">'+esc(init)+'</div>';
  }
  function dcRecentVals(t){
    let vals=null;
    if(Array.isArray(t.recent_nets)&&t.recent_nets.length) vals=t.recent_nets;
    else if(Array.isArray(t.recent_series)&&t.recent_series.length) vals=t.recent_series;
    else if(t.daily_series&&typeof t.daily_series==="object"){
      const keys=Object.keys(t.daily_series).sort();
      vals=keys.slice(-30).map(k=>{ const e=t.daily_series[k]; return e&&typeof e==="object"?(e.net||0):Number(e||0); });
    }
    if(!vals||vals.length<2) return null;
    return vals.map(v=>{
      if(v==null) return 0;
      if(typeof v==="number") return v;
      if(typeof v==="object") return Number(v.net!=null?v.net:(v.profit!=null?v.profit:(v.units!=null?v.units:0)));
      return Number(v)||0;
    });
  }
  // Discover sparkline. Green when the run finishes up, red when it finishes down.
  function dcMiniSpark(t, wide){
    const vals=dcRecentVals(t); if(!vals||!window.TBCharts) return "";
    return TBCharts.spark({
      data:vals,
      height:wide?36:32,
      unit:"u",
      signed:true,
      colorMode:"trend",
      aria:"Recent units",
      className:"dc-mini"+(wide?" dc-mini--wide":"")
    });
  }
  function pickFeaturedTipster(list){
    if(!list||!list.length) return null;
    const settled=list.filter(t=>Number(t.settled||0)>=20);
    const pool=settled.length?settled:list;
    return pool.slice().sort((a,b)=>Number(b.units_net||0)-Number(a.units_net||0))[0]||null;
  }
  async function openDiscover(fromGid,fromName){
    navNote("#/discover", ()=>openDiscover(fromGid,fromName));
    unmountFollowerPromoChip();
    clearDetailTimers();clearLiveTimer();clearGamesTimer();
    panel("discover");show("app");
    const back=()=>{ if(fromGid) openFollowerView(fromGid,fromName); else enterHome(); };
    $("discover").innerHTML='<div class="back" id="dc-back">← Back</div>'
      +'<div class="dc-hero"><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:4px">'
      +'<h1>Discover tipsters</h1><span style="font-size:var(--t-cap);font-weight:700;letter-spacing:.03em;background:rgba(91,140,255,.18);color:var(--accent);padding:2px 8px;border-radius:999px">FREE</span></div>'
      +'<p>Browse tipsters who opted in — ranked by <b>settled</b> units only. Pending tips never count. Join their Discord to follow.</p></div>'
      +'<div id="dc-sports" class="dc-sports" role="group" aria-label="Filter by sport" hidden></div>'
      +'<div id="dc-spot"></div><div id="dc-tools" class="dc-tools" hidden>'
      +'<input id="dc-q" placeholder="Search tipsters" autocomplete="off">'
      +'<select id="dc-sort">'
      +'<option value="net">Settled net</option><option value="strike">Strike</option><option value="volume">Volume</option></select></div>'
      +'<div id="dc-list"><div class="empty">Loading…</div></div>';
    $("dc-back").onclick=back;
    const wireOpen=(root)=>{
      root.querySelectorAll(".dc-open").forEach(b=>b.onclick=()=>{
        const gid=b.dataset.g, nm=b.dataset.n;
        const follows=(STATE.followerServers||[]).some(s=>String(s.guild_id)===String(gid));
        if(follows) openFollowerView(gid,nm);
        else toast("Join their Discord to follow — invite deep-link coming soon.");
      });
    };
    const card=(t)=>{
      const net=Number(t.units_net||0);
      const col=net>=0?"var(--win)":"var(--loss)";
      const name=t.display_name||t.guild_id;
      const form=(window.FormBadges&&typeof FormBadges.render==="function")?FormBadges.render(t.form):"";
      const tags=(window.DiscoverSports&&typeof DiscoverSports.tagsHtml==="function")?DiscoverSports.tagsHtml(DiscoverSports.topSports(t,3)):"";
      return '<div class="dc-card">'
        +'<div class="dc-top">'+dcGuildAvatar(t,name,40)
        +'<div style="min-width:0;flex:1"><div class="dc-name">'+esc(name)+'</div>'
        +tags
        +'<div class="dc-pills"><span class="dc-pill dc-pill--w">'+(t.wins||0)+'W</span><span class="dc-pill dc-pill--l">'+(t.losses||0)+'L</span>'
        +'<span style="font-size:var(--t-cap);color:var(--faint);align-self:center">'+(t.strike!=null?t.strike+"% strike":"")+'</span></div>'
        +form+'</div></div>'
        +dcMiniSpark(t,false)
        +'<div class="dc-stats"><span class="dc-net" style="color:'+col+'">'+(net>0?"+":"")+net+'u</span>'
        +'<button type="button" class="btn sm dc-open" data-g="'+esc(t.guild_id)+'" data-n="'+esc(name)+'">View</button></div></div>';
    };
    let list=[];
    let picked=[];
    let apply=function(){};
    const paint=(visible)=>{
      const spot=$("dc-spot"), box=$("dc-list"), tools=$("dc-tools"), bar=$("dc-sports");
      if(!visible.length && !list.length){
        if(tools) tools.hidden=true;
        if(bar){ bar.hidden=true; bar.innerHTML=""; }
        spot.innerHTML="";
        box.innerHTML='<div class="dc-empty"><div class="dc-empty-mark" aria-hidden="true">🏆</div>'
          +'<h3>No tipsters to show yet</h3>'
          +'<p>Opt-in tipsters with settled form will land here.</p>'
          +'<button type="button" class="btn sm" id="dc-empty-back" style="margin-top:14px">Back to my tips</button></div>';
        const eb=$("dc-empty-back"); if(eb) eb.onclick=()=>openMyTips(fromGid,fromName);
        return;
      }
      if(tools) tools.hidden=false;
      if(!visible.length){
        spot.innerHTML="";
        const qOn=!!(($("dc-q")||{}).value||"").trim();
        box.innerHTML=picked.length
          ?('<div class="dc-empty"><h3>'+(qOn?"No matches":"No tipsters for those sports")+'</h3>'
            +'<p>'+(qOn?"Nothing matches that name in the selected sports.":"Try another sport, or show everyone.")+'</p>'
            +'<button type="button" class="btn sm" id="dc-sports-clear" style="margin-top:14px">Show all sports</button></div>')
          :('<div class="dc-empty"><h3>No matches</h3><p>Try a different name.</p></div>');
        const clr=$("dc-sports-clear"); if(clr) clr.onclick=()=>{ picked=[]; apply(); };
        return;
      }
      const featured=pickFeaturedTipster(visible);
      if(featured){
        const topNet=Number(featured.units_net||0);
        const topCol=topNet>=0?"var(--win)":"var(--loss)";
        const topName=featured.display_name||featured.guild_id;
        const featForm=(window.FormBadges&&typeof FormBadges.render==="function")?FormBadges.render(featured.form):"";
        const featTags=(window.DiscoverSports&&typeof DiscoverSports.tagsHtml==="function")?DiscoverSports.tagsHtml(DiscoverSports.topSports(featured,3)):"";
        spot.innerHTML='<div class="dc-spotlight" style="flex-direction:column;align-items:stretch">'
          +'<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">'
          +dcGuildAvatar(featured,topName,56)
          +'<div style="min-width:0;flex:1"><div style="font-size:var(--t-cap);font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--faint);margin-bottom:4px">Featured</div>'
          +'<div style="font-size:var(--t-h3);font-weight:800">'+esc(topName)+'</div>'
          +featTags
          +'<div class="dc-pills" style="margin-top:6px"><span class="dc-pill dc-pill--w">'+(featured.wins||0)+'W</span><span class="dc-pill dc-pill--l">'+(featured.losses||0)+'L</span>'
          +'<span style="font-size:var(--t-foot);color:var(--muted);align-self:center">'+(featured.settled||0)+' settled</span></div>'
          +featForm+'</div>'
          +'<div class="dc-net" style="color:'+topCol+'">'+(topNet>0?"+":"")+topNet+'u</div>'
          +'<button type="button" class="btn sm dc-open" data-g="'+esc(featured.guild_id)+'" data-n="'+esc(topName)+'">View</button></div>'
          +dcMiniSpark(featured,true)+'</div>';
      } else spot.innerHTML="";
      box.innerHTML='<div style="color:var(--faint);font-size:var(--t-foot);font-weight:700;letter-spacing:.04em;text-transform:uppercase;margin:0 0 10px">'+(picked.length?"Matching tipsters":"All tipsters")+'</div>'
        +'<div class="dc-grid">'+visible.map(card).join("")+'</div>';
      wireOpen($("discover"));
      if(window.TBCharts&&TBCharts.mountAll) TBCharts.mountAll($("discover"));
    };
    try{
      const r=await api("/api/discover");
      if(!r.ok){ $("dc-list").innerHTML='<div class="empty">Couldn\'t load Discover. <button type="button" class="btn sm" id="dc-retry">Retry</button></div>'; const rb=$("dc-retry"); if(rb)rb.onclick=()=>openDiscover(fromGid,fromName); return; }
      const j=await r.json();
      list=(j&&j.tipsters)||[];
      picked=[];
      let chipSig="";
      const syncChips=()=>{
        const bar=$("dc-sports");
        if(!bar||!window.DiscoverSports) return;
        const names=DiscoverSports.catalog(list);
        if(!names.length){ bar.hidden=true; bar.innerHTML=""; chipSig=""; return; }
        const sig=names.join("\0")+"|"+picked.join("\0");
        bar.hidden=false;
        if(sig===chipSig) return;
        const left=bar.scrollLeft;
        const focusEl=document.activeElement;
        const focusSport=focusEl&&bar.contains(focusEl)?(focusEl.getAttribute("data-sport")||""):null;
        bar.innerHTML=DiscoverSports.chipsHtml(names, picked);
        bar.scrollLeft=left;
        bar.querySelectorAll(".dc-sport").forEach(b=>b.onclick=()=>{
          picked=DiscoverSports.toggle(picked, b.getAttribute("data-sport")||"");
          apply();
        });
        if(focusSport!=null){
          bar.querySelectorAll(".dc-sport").forEach(el=>{
            if((el.getAttribute("data-sport")||"")===focusSport) el.focus();
          });
        }
        chipSig=sig;
      };
      apply=()=>{
        syncChips();
        const q=(($("dc-q")||{}).value||"").trim().toLowerCase();
        const sort=(($("dc-sort")||{}).value)||"net";
        let out=list.slice();
        if(q) out=out.filter(t=>String(t.display_name||t.guild_id||"").toLowerCase().includes(q));
        if(window.DiscoverSports) out=out.filter(t=>DiscoverSports.matches(t, picked));
        out.sort((a,b)=>{
          if(sort==="strike") return Number(b.strike||0)-Number(a.strike||0);
          if(sort==="volume") return Number(b.settled||0)-Number(a.settled||0);
          return Number(b.units_net||0)-Number(a.units_net||0);
        });
        paint(out);
      };
      { const qi=$("dc-q"); if(qi) qi.oninput=apply; }
      { const si=$("dc-sort"); if(si) si.onchange=apply; }
      apply();
    }catch(e){ if(e&&e.unauth)return renderLogin("Session expired."); $("dc-list").innerHTML='<div class="empty">Couldn\'t load Discover. <button type="button" class="btn sm" id="dc-retry">Retry</button></div>'; const rb=$("dc-retry"); if(rb)rb.onclick=()=>openDiscover(fromGid,fromName); }
  }

  TD.loaded["discover"]=true;
