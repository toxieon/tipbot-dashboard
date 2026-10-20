/* tipdash follower views (job 03): moved unchanged out of index.html's main script and loaded
 * the first time one of them is opened (index.html lazyView -> TD.call("follower-views"),
 * cache-busted with ?v=<VERSION>). Holds the Followers view, the all-communities rollup,
 * the promo chip and My Tips. This is a plain script in the page's global scope: it uses
 * index.html's STATE, $, esc, api, panel, show, navNote … by name, and its function
 * declarations replace the placeholders index.html keeps for its entry points
 * (openFollowerView, openFollowerAllView, openMyTips). Don't turn it into a module or wrap
 * it in a closure.
 */

  /* ---------- FOLLOWER SURFACE (read-only, #31 / #45) ---------- */
  async function openFollowerView(gid,name,month){
    navNote("#/s/"+encodeURIComponent(gid)+"/follow", ()=>openFollowerView(gid,name,month));
    clearDetailTimers();clearLiveTimer();clearGamesTimer();
    panel("follower");show("app");
    $("follower").innerHTML='<div style="margin-bottom:18px">'+NDSkeleton.box("220px","28px")+'</div>'+NDSkeleton.grid(4,{cols:2,tile:"70px"})+'<div style="margin-top:18px">'+NDSkeleton.box("100%","120px")+'</div>';
    try{
      const r=await api("/api/follower?guild_id="+encodeURIComponent(gid)+(month?"&month="+encodeURIComponent(month):""));
      if(!r.ok){ $("follower").innerHTML='<div class="back" id="flbx">← Back</div><div class="empty">You don\'t have a follower view here yet.</div>'; $("flbx").onclick=enterHome; return; }
      renderFollowerView(gid,name,await r.json());
    }catch(e){ if(e&&e.unauth)return renderLogin("Session expired.");
      $("follower").innerHTML='<div class="back" id="flbx">← Back</div><div class="empty">Couldn\'t reach the bot.</div>'; $("flbx").onclick=enterHome; }
  }
  function rememberAllTime(key, month, profit){
    STATE._allTimeUnits=STATE._allTimeUnits||{};
    const id=String(key);
    if(!month) STATE._allTimeUnits[id]=Number(profit||0);
    return Object.prototype.hasOwnProperty.call(STATE._allTimeUnits, id)?STATE._allTimeUnits[id]:null;
  }
  function followerUnitsBlock(feed, month, allTime){
    if(!window.FollowerUnits) return "";
    const pts=FollowerUnits.series(feed||[], month||"", window.TBTime||null);
    return FollowerUnits.heroHtml(allTime==null?0:allTime)+FollowerUnits.chartHtml(pts);
  }
  function paintAllTimeHero(n){
    const el=document.querySelector("#follower .fl-units-num");
    if(!el||!window.FollowerUnits) return;
    const h=FollowerUnits.heroText(n);
    el.textContent=h.text;
    el.className="fl-units-num "+h.cls;
  }
  function refreshAllTimeHero(key, gid){
    api("/api/follower?guild_id="+encodeURIComponent(gid)).then(async function(r){
      if(!r.ok) return;
      const j=await r.json();
      const n=Number((j.stats&&j.stats.profit_units)||0);
      rememberAllTime(key, "", n);
      paintAllTimeHero(n);
    }).catch(function(){});
  }
  function followerUpcomingHtml(feed){
    if(!window.FollowerLive||typeof FollowerLive.upcomingNames!=="function") return "";
    const names=FollowerLive.upcomingNames(feed)||[];
    if(!names.length) return "";
    const rows=names.map(function(n){
      const tip=(feed||[]).find(function(t){ return t&&String(t.game_name||t.event||"")===n; });
      const gid=tip&&tip.guild_id||"";
      return '<div class="fl-up-row"><div style="font-weight:700;min-width:0">'+esc(n)+'</div><button type="button" class="btn sm flive-open" data-game="'+esc(n)+'" data-gid="'+esc(String(gid))+'">Game view</button></div>';
    }).join("");
    return '<div class="panel" data-sec="follower-upcoming" data-sec-sum="'+names.length+'"><h3>Upcoming</h3>'+rows+'</div>';
  }
  function renderFollowerView(gid,name,d){
    const st=d.stats||{},nm=d.display_name||name||"Community";
    const total=Math.max(st.won+st.lost+st.push,1);
    const preview=!!d.preview;
    const homeCount=(STATE.servers||[]).length+(STATE.followerServers||[]).length;
    const showBack=preview||homeCount>1;
    const backTo=()=>preview?loadDetail(gid):enterHome();
    const months=d.months||[],curMonth=d.month||"";
    const period=curMonth?fmtMonth(curMonth):"All time";
    const monthSel='<select id="fmonthsel" style="background:var(--card2);color:var(--txt);border:1px solid var(--line);border-radius:var(--r-sm);padding:7px 10px;font:inherit;cursor:pointer"><option value="">All time</option>'+months.map(m=>'<option value="'+m+'"'+(m===curMonth?' selected':'')+'>'+fmtMonth(m)+'</option>').join("")+'</select>';
    const wl='<span style="width:'+(st.won/total*100)+'%;background:var(--win)"></span><span style="width:'+(st.lost/total*100)+'%;background:var(--loss)"></span><span style="width:'+(st.push/total*100)+'%;background:var(--push)"></span>';
    const tiles=[["Profit",u(st.profit_units||0),(st.profit_units||0)>=0?"pos":"neg"],["ROI",(st.roi||0)+"%",(st.roi||0)>=0?"pos":"neg"],["Success",(st.strike_rate||0)+"%",""],["Pending",st.pending||0,""]]
      .map(t=>'<div class="tile"><div class="tv '+t[2]+'">'+t[1]+'</div><div class="tl">'+t[0]+'</div></div>').join("");
    ingestFollowTipGrades(gid, d.feed||[]);
    const fgrades=tipGradeMapForGuild(gid);
    const feed=(d.feed&&d.feed.length)?d.feed.map(t=>followerFeedRow(t,{tipGrade:t&&t.tip_id!=null?fgrades[String(t.tip_id)]:null})).join(""):
      '<div class="empty">No tracked bets yet. In Discord, react to a tip with the follow emoji and it\'ll appear here.</div>';
    const profForm=(window.FormBadges&&typeof FormBadges.render==="function")?FormBadges.render(d.form):"";
    const profTitle=profForm?'<div class="tb-form-title"><h1 style="margin:0">'+esc(nm)+'</h1>'+profForm+'</div>':'<h1 style="margin:0">'+esc(nm)+'</h1>';
    const allTime=rememberAllTime(String(gid), curMonth, st.profit_units||0);
    const unitsBlock=followerUnitsBlock(d.feed||[], curMonth, allTime!=null?allTime:(curMonth?0:(st.profit_units||0)));
    $("follower").innerHTML=(showBack?'<div class="back" id="flbx">← '+(preview?"Back to server":"All communities")+'</div>':'')
      +(d.trial_mode?'<div class="trial-banner" role="status">Tracking is off during this server\'s trial. Reactions aren\'t recorded yet; existing tracked bets still settle.</div>':'')
      +(preview?'<div class="viewas" style="margin-bottom:16px"><div>👁 Previewing the <b>follower view</b> — this is what a follower of '+esc(nm)+' sees.</div><span class="link" id="fpv-exit">Exit preview</span></div>':'')
      +unitsBlock
      +'<div class="dhead">'+profTitle+'<div class="dhead-actions">'+(showBack?'':'<button type="button" class="ghost" id="flstatsbtn">Stats</button><button type="button" class="ghost" id="flracebtn">Racing</button>')+'<span style="font-size:var(--t-cap);font-weight:700;letter-spacing:.03em;background:var(--card2);color:var(--accent);border:1px solid var(--line);padding:3px 9px;border-radius:999px">FOLLOWER</span></div></div>'
      +'<button type="button" class="game-view-cta" id="flgameviewbtn">Game view <span>open the ground</span></button>'
      +'<div class="fl-showing" style="display:flex;align-items:center;gap:10px;margin:6px 0 16px;flex-wrap:wrap"><span style="color:var(--muted);font-size:var(--t-sub)">Showing</span>'+monthSel+'<span style="color:var(--faint);font-size:var(--t-foot)">'+period+' · your results</span></div>'
      +followerUpcomingHtml(d.feed||[])
      +'<div class="stats-wrap" id="stats-wrap"><button type="button" class="stats-toggle" id="stats-toggle" aria-expanded="true"><div class="st-sum" id="stats-sum"><span>Profit <b class="'+((st.profit_units||0)>=0?"pos":"neg")+'">'+esc(u(st.profit_units||0))+'</b></span><span>ROI <b class="'+((st.roi||0)>=0?"pos":"neg")+'">'+esc(String(st.roi||0))+'%</b></span><span>Pending <b>'+esc(String(st.pending||0))+'</b></span></div><span class="st-caret">▾</span></button><div class="tiles">'+tiles+'</div></div>'
      +'<div class="panel" data-sec="follower-tips" data-sec-sum="'+((d.feed||[]).length)+'"><h3>Your tips</h3><div id="ffeed">'+feed+'</div></div>'
      +'<div class="panel" data-sec="follower-wlp" data-sec-sum="'+(st.won||0)+'–'+(st.lost||0)+'–'+(st.push||0)+'"><h3>Your Win / Loss / Push · '+period+'</h3><div class="wlbar">'+wl+'</div><div class="wl-legend"><span class="lg"><span class="sw" style="background:var(--win)"></span>Won '+st.won+'</span><span class="lg"><span class="sw" style="background:var(--loss)"></span>Lost '+st.lost+'</span><span class="lg"><span class="sw" style="background:var(--push)"></span>Push '+st.push+'</span><span class="lg" style="margin-left:auto">'+st.staked_units+'u staked</span></div></div>'
      +renderCalendar(d.cal_month,d.daily_series,"","follower-calendar");
    if(showBack){ const b=$("flbx"); if(b)b.onclick=backTo; }
    { const stb=$("flstatsbtn"); if(stb) stb.onclick=()=>openStats(); }
    { const fgv=$("flgameviewbtn"); if(fgv) fgv.onclick=()=>openGameView(); }
    if(curMonth && allTime==null) refreshAllTimeHero(String(gid), gid);
    { const rb=$("flracebtn"); if(rb){ rb.hidden=!buildTipsShown(); rb.onclick=()=>{ if(buildTipsShown()) openRacingBuilder(gid,nm); }; } }
    { const pe=$("fpv-exit"); if(pe)pe.onclick=()=>loadDetail(gid); }
    { const ms=$("fmonthsel"); if(ms)ms.onchange=()=>openFollowerView(gid,nm,ms.value||null); }
    $("follower").querySelectorAll(".calnav").forEach(b=>b.onclick=()=>{
      openFollowerView(gid,nm,calMonthShift(d.cal_month,b.dataset.cal==="next"?1:-1));
    });
    wireCalendarDays($("follower"), d.feed||[], d.daily_series||{}, {follower:true,guildId:gid});
    wireFliveOpens($("follower"), gid);
    wireStatsCollapse($("follower"),"follower-stats");
    wirePanelCollapse($("follower"));
    mountFollowerPromoChip(gid,nm);
  }

  /* ---------- ALL COMMUNITIES ROLLUP (client-side merge of /api/follower) ---------- */
  const ROLLUP_CONCURRENCY=4;
  async function openFollowerAllView(month){
    navNote("#/following", ()=>openFollowerAllView(month));
    clearDetailTimers();clearLiveTimer();clearGamesTimer();
    const follows=STATE.viewAs?[]:(STATE.followerServers||[]);
    if(follows.length<=1){
      if(follows.length===1) return openFollowerView(follows[0].guild_id,follows[0].display_name,month);
      return enterHome();
    }
    panel("follower");show("app");
    $("follower").innerHTML='<div style="margin-bottom:18px">'+NDSkeleton.box("240px","28px")+'</div>'+NDSkeleton.grid(4,{cols:2,tile:"70px"})+'<div style="margin-top:18px">'+NDSkeleton.box("100%","120px")+'</div>';
    let unauth=false;
    const q=month?"&month="+encodeURIComponent(month):"";
    // P2b: at most 4 communities in flight at once (was every follow in parallel).
    const loadOne=async s=>{
      try{
        const r=await api("/api/follower?guild_id="+encodeURIComponent(s.guild_id)+q);
        if(!r.ok) return {ok:false,s};
        return {ok:true,s,d:await r.json()};
      }catch(e){ if(e&&e.unauth){unauth=true;} return {ok:false,s}; }
    };
    const results=(window.ReqPool&&window.ReqPool.mapLimit)
      ? await window.ReqPool.mapLimit(follows, ROLLUP_CONCURRENCY, loadOne)
      : await Promise.all(follows.map(loadOne));
    if(unauth) return renderLogin("Session expired.");
    const ok=results.filter(r=>r.ok);
    const failed=results.filter(r=>!r.ok).map(r=>r.s.display_name||String(r.s.guild_id));
    if(!ok.length){
      $("follower").innerHTML='<div class="back" id="flbx">← Back</div><div class="empty">Couldn\'t load any follower communities.</div>';
      $("flbx").onclick=enterHome; return;
    }
    const stats={won:0,lost:0,push:0,pending:0,profit_units:0,staked_units:0};
    const monthsSet=new Set();
    const daily={};
    const feed=[];
    let calPick=null;
    ok.forEach(({s,d})=>{
      const st=d.stats||{};
      stats.won+=Number(st.won||0); stats.lost+=Number(st.lost||0); stats.push+=Number(st.push||0);
      stats.pending+=Number(st.pending||0); stats.profit_units+=Number(st.profit_units||0); stats.staked_units+=Number(st.staked_units||0);
      (d.months||[]).forEach(m=>monthsSet.add(m));
      if(!calPick && d.cal_month) calPick=d.cal_month;
      const ds=d.daily_series||{};
      Object.keys(ds).forEach(k=>{
        const e=ds[k]||{};
        if(!daily[k]) daily[k]={net:0,n:0,won:0,lost:0,push:0};
        daily[k].net+=Number(e.net||0); daily[k].n+=Number(e.n||0);
        daily[k].won+=Number(e.won||0); daily[k].lost+=Number(e.lost||0); daily[k].push+=Number(e.push||0);
      });
      const cname=s.display_name||d.display_name||"Community";
      (d.feed||[]).forEach(t=>{
        feed.push(Object.assign({},t,{community_name:cname,_community:cname,guild_id:t.guild_id||s.guild_id}));
      });
    });
    const denom=stats.won+stats.lost;
    stats.roi=stats.staked_units?Math.round((stats.profit_units/stats.staked_units)*1000)/10:0;
    stats.strike_rate=denom?Math.round((stats.won/denom)*1000)/10:0;
    const months=[...monthsSet].sort().reverse();
    const anyTs=feed.some(t=>tipTimeMs(t)!=null);
    if(anyTs) feed.sort((a,b)=>(tipTimeMs(b)||0)-(tipTimeMs(a)||0));
    const curCal=(month && /^\d{4}-\d{2}$/.test(month))?month:(calPick||months[0]||TBTime.monthKey(Date.now()));
    renderFollowerAllView({
      stats, months, month:month||"", cal_month:curCal, daily_series:daily, feed,
      failed, communityCount:follows.length, follows
    });
  }
  function renderFollowerAllView(d){
    const st=d.stats||{}, nm="All communities";
    const total=Math.max(st.won+st.lost+st.push,1);
    const months=d.months||[], curMonth=d.month||"";
    const period=curMonth?fmtMonth(curMonth):"All time";
    const monthSel='<select id="fmonthsel" style="background:var(--card2);color:var(--txt);border:1px solid var(--line);border-radius:var(--r-sm);padding:7px 10px;font:inherit;cursor:pointer"><option value="">All time</option>'+months.map(m=>'<option value="'+m+'"'+(m===curMonth?' selected':'')+'>'+fmtMonth(m)+'</option>').join("")+'</select>';
    const wl='<span style="width:'+(st.won/total*100)+'%;background:var(--win)"></span><span style="width:'+(st.lost/total*100)+'%;background:var(--loss)"></span><span style="width:'+(st.push/total*100)+'%;background:var(--push)"></span>';
    const tiles=[["Profit",u(st.profit_units||0),(st.profit_units||0)>=0?"pos":"neg"],["ROI",(st.roi||0)+"%",(st.roi||0)>=0?"pos":"neg"],["Success",(st.strike_rate||0)+"%",""],["Pending",st.pending||0,""]]
      .map(t=>'<div class="tile"><div class="tv '+t[2]+'">'+t[1]+'</div><div class="tl">'+t[0]+'</div></div>').join("");
    const feed=(d.feed&&d.feed.length)?d.feed.map(t=>{
      const gid=t&&(t._guild_id||t.guild_id)||null;
      if(gid) ingestFollowTipGrades(gid, [t]);
      const g=t&&t.tip_id!=null&&gid?tipGradeMapForGuild(gid)[String(t.tip_id)]:null;
      return followerFeedRow(t,{tipGrade:g});
    }).join(""):
      '<div class="empty">No tracked bets yet across your communities.</div>';
    const failNote=(d.failed&&d.failed.length)?'<div style="margin:0 0 14px;padding:10px 12px;border-radius:var(--r-md);border:1px dashed var(--line);color:var(--faint);font-size:var(--t-foot)">Couldn\'t load: '+esc(d.failed.join(", "))+' — showing the rest.</div>':'';
    const allTime=rememberAllTime("all", curMonth, st.profit_units||0);
    const unitsBlock=followerUnitsBlock(d.feed||[], curMonth, allTime!=null?allTime:(curMonth?0:(st.profit_units||0)));
    $("follower").innerHTML='<div class="back" id="flbx">← Home</div>'
      +unitsBlock
      +'<div class="dhead"><h1 style="margin:0">'+esc(nm)+'</h1><span style="font-size:var(--t-cap);font-weight:700;letter-spacing:.03em;background:var(--card2);color:var(--accent);border:1px solid var(--line);padding:3px 9px;border-radius:999px">FOLLOWER</span></div>'
      +'<button type="button" class="game-view-cta" id="flallgamebtn">Game view <span>open the ground</span></button>'
      +'<div style="color:var(--muted);font-size:var(--t-sub);margin:4px 0 12px">Combined · '+(d.communityCount||0)+' communities</div>'
      +failNote
      +'<div class="fl-showing" style="display:flex;align-items:center;gap:10px;margin:6px 0 16px;flex-wrap:wrap"><span style="color:var(--muted);font-size:var(--t-sub)">Showing</span>'+monthSel+'<span style="color:var(--faint);font-size:var(--t-foot)">'+period+' · your results</span></div>'
      +followerUpcomingHtml(d.feed||[])
      +'<div class="stats-wrap" id="stats-wrap"><button type="button" class="stats-toggle" id="stats-toggle" aria-expanded="true"><div class="st-sum" id="stats-sum"><span>Profit <b class="'+((st.profit_units||0)>=0?"pos":"neg")+'">'+esc(u(st.profit_units||0))+'</b></span><span>ROI <b class="'+((st.roi||0)>=0?"pos":"neg")+'">'+esc(String(st.roi||0))+'%</b></span><span>Pending <b>'+esc(String(st.pending||0))+'</b></span></div><span class="st-caret">▾</span></button><div class="tiles">'+tiles+'</div></div>'
      +'<div class="panel" data-sec="follower-tips" data-sec-sum="'+((d.feed||[]).length)+'"><h3>Your tips</h3><div id="ffeed">'+feed+'</div></div>'
      +'<div class="panel" data-sec="follower-wlp" data-sec-sum="'+(st.won||0)+'–'+(st.lost||0)+'–'+(st.push||0)+'"><h3>Your Win / Loss / Push · '+period+'</h3><div class="wlbar">'+wl+'</div><div class="wl-legend"><span class="lg"><span class="sw" style="background:var(--win)"></span>Won '+st.won+'</span><span class="lg"><span class="sw" style="background:var(--loss)"></span>Lost '+st.lost+'</span><span class="lg"><span class="sw" style="background:var(--push)"></span>Push '+st.push+'</span><span class="lg" style="margin-left:auto">'+(st.staked_units||0)+'u staked</span></div></div>'
      +renderCalendar(d.cal_month,d.daily_series,(d.follows&&d.follows.length)?'<div class="tb-comm-chips" style="margin-top:8px">'+d.follows.map(s=>'<span class="tb-comm-chip">'+esc(s.display_name||"Community")+'</span>').join("")+'</div>':'',"follower-calendar");
    { const b=$("flbx"); if(b)b.onclick=enterHome; }
    { const ag=$("flallgamebtn"); if(ag) ag.onclick=()=>openGameView(); }
    { const ms=$("fmonthsel"); if(ms)ms.onchange=()=>openFollowerAllView(ms.value||null); }
    if(curMonth && allTime==null && d.follows){
      Promise.all(d.follows.map(async function(s){
        try{
          const r=await api("/api/follower?guild_id="+encodeURIComponent(s.guild_id));
          if(!r.ok) return 0;
          const j=await r.json();
          return Number((j.stats&&j.stats.profit_units)||0);
        }catch(e){ return 0; }
      })).then(function(nums){
        const n=nums.reduce(function(a,b){ return a+Number(b||0); }, 0);
        rememberAllTime("all", "", n);
        paintAllTimeHero(n);
      });
    }
    $("follower").querySelectorAll(".calnav").forEach(b=>b.onclick=()=>{
      openFollowerAllView(calMonthShift(d.cal_month,b.dataset.cal==="next"?1:-1));
    });
    wireCalendarDays($("follower"), d.feed||[], d.daily_series||{}, {follower:true});
    wireFliveOpens($("follower"), "");
    wireStatsCollapse($("follower"),"follower-stats");
    wirePanelCollapse($("follower"));
    const first=(d.follows&&d.follows[0])||null;
    mountFollowerPromoChip(first?first.guild_id:null, first?(first.display_name||"All communities"):"All communities");
  }

  function promoChipHidden(key){ try{ return localStorage.getItem(key)==="1"; }catch(e){ return false; } }
  function dismissPromoSlot(slot, key){
    try{ localStorage.setItem(key,"1"); }catch(e){}
    if(!slot) return;
    slot.classList.add("tb-promo-out");
    const done=()=>{
      slot.remove();
      const w=$("tb-promo-wrap");
      if(w && !w.querySelector(".tb-promo-slot:not(.tb-promo-out)")) w.remove();
    };
    slot.addEventListener("transitionend", function te(ev){
      if(ev.target!==slot) return;
      slot.removeEventListener("transitionend", te);
      done();
    });
    setTimeout(done, 380); // fallback if transitionend skipped
  }
  function mountFollowerPromoChip(gid,nm){
    const old=$("tb-promo-wrap"); if(old)old.remove();
    const hideDisc=promoChipHidden("tb_promo_discover_hide");
    const hideTips=promoChipHidden("tb_promo_mytips_hide");
    if(hideDisc && hideTips) return;
    const wrap=document.createElement("div");
    wrap.id="tb-promo-wrap"; wrap.className="tb-promo-wrap tb-promo-dock";
    let html="";
    if(!hideDisc){
      html+='<div class="tb-promo-slot" id="tb-discover-slot">'
        +'<button type="button" class="tb-promo-x" data-chip="discover" title="Hide Discover" aria-label="Hide Discover">×</button>'
        +'<button type="button" class="tb-promo-chip tb-promo-chip--discover" id="tb-discover-chip" aria-label="Discover tipsters">'
        +'<span class="tb-promo-chev" aria-hidden="true">›</span>'
        +'<span class="tb-promo-bag" aria-hidden="true">🔎</span>'
        +'<span class="tb-promo-copy">'
        +'<span class="tb-promo-kicker">Free</span>'
        +'<span class="tb-promo-title">Discover</span>'
        +'<span class="tb-promo-sub">Find tipsters</span>'
        +'</span></button></div>';
    }
    if(!hideTips){
      html+='<div class="tb-promo-slot" id="tb-mytips-slot">'
        +'<button type="button" class="tb-promo-x" data-chip="mytips" title="Hide My Tips" aria-label="Hide My Tips">×</button>'
        +'<button type="button" class="tb-promo-chip" id="tb-promo-chip" aria-label="Log your own tips">'
        +'<span class="tb-promo-chev" aria-hidden="true">›</span>'
        +'<span class="tb-promo-bag" aria-hidden="true">📝</span>'
        +'<span class="tb-promo-copy">'
        +'<span class="tb-promo-kicker">Free</span>'
        +'<span class="tb-promo-title">My Tips</span>'
        +'<span class="tb-promo-sub">Log your own tips</span>'
        +'</span></button></div>';
    }
    wrap.innerHTML=html;
    const host=$("follower");
    if(!host) return;
    host.appendChild(wrap);
    const disc=$("tb-discover-chip"); if(disc) disc.onclick=()=>openDiscover(gid,nm);
    const tips=$("tb-promo-chip"); if(tips) tips.onclick=()=>openMyTips(gid,nm);
    wrap.querySelectorAll(".tb-promo-x").forEach(btn=>btn.onclick=(e)=>{
      e.stopPropagation();
      const kind=btn.dataset.chip;
      const slot=btn.closest(".tb-promo-slot");
      dismissPromoSlot(slot, kind==="discover"?"tb_promo_discover_hide":"tb_promo_mytips_hide");
    });
  }

  async function openMyTips(fromGid,fromName,month){
    navNote("#/mytips", ()=>openMyTips(fromGid,fromName,month));
    unmountFollowerPromoChip();
    clearDetailTimers();clearLiveTimer();clearGamesTimer();
    panel("mytips");show("app");
    const back=()=>{ if(fromGid) openFollowerView(fromGid,fromName); else enterHome(); };
    $("mytips").innerHTML='<div class="back" id="mt-back">← Back</div>'
      +'<div class="dhead"><h1 style="margin:0">My Tips</h1><span style="font-size:var(--t-cap);font-weight:700;letter-spacing:.03em;background:rgba(224,160,74,.18);color:#e0a04a;padding:2px 8px;border-radius:999px">FREE</span></div>'
      +'<p style="color:var(--muted);font-size:var(--t-sub);margin:8px 0 16px;line-height:1.45">Personal tip log — settle tips to grow your month units. Pending tips stay out of the calendar.</p>'
      +'<div id="mt-cal"></div>'
      +'<div class="panel" data-sec="mytips-add" data-sec-open="1"><h3>Add a tip</h3>'
      +'<div class="field"><label>Selection</label><input id="mt-sel" placeholder="e.g. Collingwood 1–12" style="width:100%"></div>'
      +'<div style="display:flex;gap:10px;flex-wrap:wrap">'
      +'<div class="field" style="flex:1;min-width:100px"><label>Odds</label><input id="mt-odds" type="number" step="0.01" placeholder="2.10"></div>'
      +'<div class="field" style="flex:1;min-width:100px"><label>Units</label><input id="mt-units" type="number" step="0.1" placeholder="1"></div></div>'
      +'<div class="field"><label>Note (optional)</label><input id="mt-note" placeholder="Bookie / market" style="width:100%"></div>'
      +'<button class="btn sm" id="mt-add" type="button">Add tip</button> <span id="mt-msg" style="font-size:var(--t-foot)"></span></div>'
      +'<div class="panel" data-sec="mytips-log" style="margin-top:14px"><h3>Your log</h3><div id="mt-list"><div class="empty">Loading…</div></div></div>';
    TDSec.upgrade($("mytips"));
    $("mt-back").onclick=back;
    let STATE_MONTH=month||null;
    const paint=async()=>{
      const box=$("mt-list"), cal=$("mt-cal");
      try{
        const q=STATE_MONTH?("&month="+encodeURIComponent(STATE_MONTH)):"";
        const r=await api("/api/my-tips"+(q?"?"+q.slice(1):""));
        if(!r.ok) throw new Error("api");
        const j=await r.json();
        STATE_MONTH=j.cal_month||STATE_MONTH;
        if(cal){
          cal.innerHTML='<div style="display:flex;align-items:baseline;gap:10px;margin:0 0 10px;flex-wrap:wrap">'
            +'<span style="font-size:var(--t-h2);font-weight:800;font-variant-numeric:tabular-nums;color:'+(j.month_net>=0?"var(--win)":"var(--loss)")+'">'
            +(j.month_net>0?"+":"")+((Math.round((j.month_net||0)*100)/100).toFixed(2))+'u</span>'
            +'<span style="color:var(--faint);font-size:var(--t-sub)">settled this month</span></div>'
            +renderCalendar(j.cal_month,j.daily_series||{},"","mytips-calendar");
          cal.querySelectorAll(".calnav").forEach(b=>b.onclick=()=>{
            openMyTips(fromGid,fromName,calMonthShift(j.cal_month,b.dataset.cal==="next"?1:-1));
          });
          wirePanelCollapse(cal);
        }
        const tips=(j&&j.tips)||[];
        if(!tips.length){ box.innerHTML='<div class="empty">No personal tips yet — add one above.</div>'; return; }
        box.innerHTML=tips.map(t=>{
          const oc=tipOutcome(t,false);
          const res=oc.settled?String(oc.result).toLowerCase():"pending";
          const col=res==="win"?"var(--win)":res==="loss"?"var(--loss)":"var(--muted)";
          const profit=t.profit_units!=null?(' · <span style="color:'+col+'">'+(t.profit_units>0?"+":"")+t.profit_units+'u</span>'):"";
          const settle=res==="pending"
            ?('<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">'
              +'<button type="button" class="mt-settlebtn" data-id="'+esc(t.id)+'" data-r="win">Win</button>'
              +'<button type="button" class="mt-settlebtn" data-id="'+esc(t.id)+'" data-r="loss">Loss</button>'
              +'<button type="button" class="mt-settlebtn" data-id="'+esc(t.id)+'" data-r="push">Push</button>'
              +'<button type="button" class="mt-settlebtn" data-id="'+esc(t.id)+'" data-r="void">Void</button></div>')
            :"";
          const actualBits=[];
          const act=pickNum(t.actual,t.actual_count,t.current);
          const line=pickNum(t.line,t.line_value);
          if(act!=null||line!=null) actualBits.push((act!=null?act:"—")+" / "+(line!=null?line:"—"));
          return '<div class="mt-row"><div style="flex:1"><div style="font-weight:700">'+esc(t.selection||"—")+'</div>'
            +'<div style="font-size:var(--t-foot);color:var(--faint)">'+esc(String(t.odds||"—"))+' · '+esc(String(t.units||"—"))+'u'
            +profit+(t.note?(" · "+esc(t.note)):"")
            +(actualBits.length?(' · <span style="color:var(--accent)">'+esc(actualBits[0])+'</span>'):"")
            +'</div>'+settle+'</div>'
            +'<div style="font-weight:700;color:'+col+';text-transform:capitalize">'+esc(res)+'</div></div>';
        }).join("");
        box.querySelectorAll(".mt-settlebtn").forEach(b=>b.onclick=async()=>{
          b.disabled=true;
          try{
            const j=await settlePost("/api/my-tips/settle",{id:b.dataset.id,result:b.dataset.r},
              function(n,max){ toast("Saving… (bot busy, retry "+n+"/"+max+")"); });
            if(!j.ok) toast(j.message||j.error||"Settle failed","error");
            await paint();
          }catch(e){ if(e&&e.unauth){ toast("Session expired — sign in again, then re-settle.","error"); return renderLogin("Session expired — sign in again to settle (not saved)."); } toast("Couldn't settle","error"); }
        });
      }catch(e){ if(e&&e.unauth)return renderLogin("Session expired.");
        box.innerHTML='<div class="empty">Couldn\'t load My Tips.</div>'; if(cal)cal.innerHTML=""; }
    };
    $("mt-add").onclick=async()=>{
      const selection=($("mt-sel").value||"").trim();
      const odds=parseFloat($("mt-odds").value);
      const units=parseFloat($("mt-units").value);
      const note=($("mt-note").value||"").trim();
      const m=$("mt-msg");
      if(!selection){ if(m){m.textContent="Need a selection";m.style.color="var(--loss)";} return; }
      $("mt-add").disabled=true; if(m)m.textContent="";
      try{
        const r=await api("/api/my-tips",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({selection,odds:odds||null,units:units||null,result:"pending",note})});
        const j=await r.json();
        if(j&&j.ok){ if(m){m.textContent="✓ saved";m.style.color="var(--win)";} $("mt-sel").value=""; await paint(); }
        else { if(m){m.textContent=j.message||"error";m.style.color="var(--loss)";} }
      }catch(e){ if(e&&e.unauth)return renderLogin("Session expired."); if(m){m.textContent="couldn't save";m.style.color="var(--loss)";} }
      finally{ $("mt-add").disabled=false; }
    };
    await paint();
  }

  TD.loaded["follower-views"]=true;
