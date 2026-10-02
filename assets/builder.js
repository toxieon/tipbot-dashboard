/* tipdash tip builder (2.2b, 0.40.2): moved unchanged out of index.html's main script and loaded
 * the first time it's opened (index.html TD.load("builder"), cache-busted with ?v=<VERSION>).
 * This is a plain script in the page's global scope: it uses index.html's BUILD, BATCH, STATE, $, esc,
 * api … by name, and its function declarations replace the placeholders index.html keeps for its
 * entry points (openBuilder, openCustom). Don't turn it into a module or wrap it in a closure.
 */


  /* ---------- MULTI DRAFT (localStorage, guild-scoped) ---------- */
  const MULTI_DRAFT_KEY="tipdash_multi_draft_v1";
  function readDraftStore(){
    try{ const raw=localStorage.getItem(MULTI_DRAFT_KEY); if(!raw)return {}; const o=JSON.parse(raw); return (o&&typeof o==="object")?o:{}; }
    catch(e){ return {}; }
  }
  function writeDraftStore(store){
    try{ localStorage.setItem(MULTI_DRAFT_KEY, JSON.stringify(store||{})); }catch(e){}
  }
  function clearMultiDraft(guildId){
    if(guildId==null)return;
    const store=readDraftStore();
    const k=String(guildId);
    if(store[k]){ delete store[k]; writeDraftStore(store); }
  }
  function gameSnap(g){
    if(!g)return null;
    return {
      aflMatchId:g.aflMatchId||null,
      id:g.id||g.game_id||null,
      hteam:teamName(g.hteam),
      ateam:teamName(g.ateam),
      roundname:g.roundname||"",
      unixtime:g.unixtime||null,
      complete:g.complete,
      comp:g.comp||null
    };
  }
  function saveMultiDraft(){
    const gid=BUILD&&BUILD.guildId;
    if(!gid)return;
    const legs=(BUILD.legs||[]).slice();
    const meaningful=legs.length>0 || !!(BUILD.custom&&((BUILD.customEvent||"").trim()||(BUILD.customSport||"").trim()));
    if(!meaningful){
      // Don't wipe an existing draft just because we're on the games list with 0 legs.
      return;
    }
    const store=readDraftStore();
    store[String(gid)]={
      guild_id:String(gid),
      serverName:BUILD.serverName||"",
      legs:legs,
      game:gameSnap(BUILD.game),
      custom:!!BUILD.custom,
      customEvent:BUILD.customEvent||"",
      customSport:BUILD.customSport||"",
      customStartDay:BUILD.customStartDay||"",
      tab:BUILD.tab||"Disposals",
      search:BUILD.search||"",
      sort:BUILD.sort||"number",
      assume:!!BUILD.assume,
      stakeMode:BUILD.stakeMode||"units",
      espn:!!BUILD.espn,
      espnLeague:BUILD.espnLeague||"",
      espnEvent:BUILD.espnEvent?{id:BUILD.espnEvent.id,name:BUILD.espnEvent.name,short_name:BUILD.espnEvent.short_name,date:BUILD.espnEvent.date,away:BUILD.espnEvent.away,home:BUILD.espnEvent.home}:null,
      espnPropKey:BUILD.espnPropKey||"",
      espnDate:BUILD.espnDate||"",
      espnWeekIndex:BUILD.espnWeekIndex,
      espnSeasonYear:BUILD.espnSeasonYear,
      ts:Date.now()
    };
    writeDraftStore(store);
  }
  function getMultiDraft(guildId){
    if(guildId==null)return null;
    const d=readDraftStore()[String(guildId)];
    if(!d||typeof d!=="object")return null;
    const legs=Array.isArray(d.legs)?d.legs:[];
    const meaningful=legs.length>0 || !!(d.custom&&((d.customEvent||"").trim()||(d.customSport||"").trim()));
    if(!meaningful)return null;
    return d;
  }
  function matchDraftGame(snap, games){
    if(!snap||!games||!games.length)return null;
    const mid=snap.aflMatchId||snap.id;
    if(mid){
      const hit=games.find(g=>String(g.aflMatchId||g.id||g.game_id||"")===String(mid));
      if(hit)return hit;
    }
    const ht=String(snap.hteam||"").toLowerCase(), at=String(snap.ateam||"").toLowerCase();
    if(ht&&at){
      return games.find(g=>teamName(g.hteam).toLowerCase()===ht&&teamName(g.ateam).toLowerCase()===at)||null;
    }
    return null;
  }
  function draftBannerHTML(d){
    const n=(d.legs||[]).length;
    const when=d.ts?TBTime.fmt(d.ts,{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}):"";
    const label=n? (n+" leg"+(n===1?"":"s")) : "custom draft";
    return '<div class="draft-banner" id="draftbanner" role="status">'
      +'<div class="db-msg">You have an unfinished multi (<b>'+esc(label)+'</b>)'+(when?(" · saved "+esc(when)):"")+'. Continue?</div>'
      +'<div class="db-acts"><button type="button" class="btn sm" id="draft-continue">Continue</button>'
      +'<button type="button" class="ghost" id="draft-discard">Discard</button></div></div>';
  }
  async function resumeMultiDraft(d, games){
    if(!d)return;
    BUILD.legs=(d.legs||[]).slice();
    BUILD.tab=d.tab||"Disposals";
    BUILD.search=d.search||"";
    BUILD.sort=d.sort||"number";
    BUILD.assume=!!d.assume;
    BUILD.stakeMode=d.stakeMode||"units";
    BUILD.custom=!!d.custom;
    BUILD.customEvent=d.customEvent||"";
    BUILD.customSport=d.customSport||"";
    BUILD.customStartDay=d.customStartDay||"";
    BUILD.serverName=d.serverName||BUILD.serverName;
    if(d.espn && d.espnLeague){
      BUILD.espn=true;
      BUILD.espnLeague=d.espnLeague;
      BUILD.espnEvent=d.espnEvent||null;
      BUILD.espnPropKey=d.espnPropKey||TBEspnProps.propTabs(d.espnLeague)[0].key;
      BUILD.espnDate=d.espnDate||easternYmd();
      BUILD.espnWeekIndex=(d.espnWeekIndex!=null)?d.espnWeekIndex:-1;
      BUILD.espnSeasonYear=d.espnSeasonYear||null;
      BUILD.espnEvents=[]; BUILD.espnWeeks=[]; BUILD.espnPlayers=[]; BUILD.espnTeams=[];
      BUILD.game=null;
      renderTray();
      if(BUILD.espnEvent && TBEspnProps.hasProps(BUILD.espnLeague)){
        panel("builder");
        $("builder").innerHTML='<div class="back" id="bg">← Games</div><h1 style="margin:0 0 16px">'+esc(espnEventName(BUILD.espnEvent))+'</h1>'+NDSkeleton.lines(6);
        loadEspnNflPlayers();
      }else if(BUILD.espnEvent){
        panel("builder");
        renderEspnBasketballPick();
      }else{
        openEspnBuilder(BUILD.guildId, BUILD.serverName, BUILD.espnLeague);
      }
      return;
    }
    if(d.custom){
      BUILD.game=null;
      renderCustom();
      renderTray();
      return;
    }
    let list=games||[];
    if(!list.length){
      try{
        const fx=await (await api(TBLight.FIXTURES_LEAN)).json();
        list=fx.games||[];
        STATE.playerMeta=fx.players||{};
      }catch(e){ if(e&&e.unauth)return renderLogin("Session expired."); }
    }
    const g=matchDraftGame(d.game, list);
    if(g){
      await openGame(g);
      // openGame resets tab to Disposals — restore draft tab/legs after.
      BUILD.tab=d.tab||BUILD.tab;
      BUILD.legs=(d.legs||[]).slice();
      BUILD.search=d.search||"";
      BUILD.sort=d.sort||"number";
      BUILD.assume=!!d.assume;
      renderGame();
      renderTray();
      return;
    }
    // Game no longer in fixtures — keep legs, show games list + note.
    BUILD.game=null; BUILD.custom=false;
    renderGames(list);
    renderTray();
    const box=$("builder");
    if(box){
      const note=document.createElement("div");
      note.className="draft-banner";
      note.innerHTML='<div class="db-msg">Draft restored ('+esc(String((d.legs||[]).length))+' legs), but that fixture is no longer listed — pick a game or review the tray.</div>';
      const h1=box.querySelector("h1");
      if(h1) h1.insertAdjacentElement("afterend", note);
      else box.insertBefore(note, box.firstChild);
    }
  }
  function offerDraftResume(guildId, games){
    const d=getMultiDraft(guildId);
    if(!d)return;
    const box=$("builder"); if(!box)return;
    if($("draftbanner"))return;
    const wrap=document.createElement("div");
    wrap.innerHTML=draftBannerHTML(d);
    const banner=wrap.firstChild;
    // Insert after back/h1 if present
    const h1=box.querySelector("h1");
    if(h1&&h1.nextSibling) box.insertBefore(banner, h1.nextSibling);
    else if(h1) h1.insertAdjacentElement("afterend", banner);
    else box.insertBefore(banner, box.firstChild);
    const cont=$("draft-continue"), disc=$("draft-discard");
    if(cont)cont.onclick=async()=>{ banner.remove(); await resumeMultiDraft(d, games); };
    if(disc)disc.onclick=()=>{ clearMultiDraft(guildId); banner.remove(); toast("Draft discarded"); };
  }

  /* ---------- BUILDER ---------- */
  async function openBuilder(guildId,name){
    clearDetailTimers();clearLiveTimer();clearGamesTimer();
    if(BATCH.guildId && String(BATCH.guildId)!==String(guildId)){ BATCH={guildId:null,tips:[]}; }
    BUILD={guildId,serverName:name,game:null,tab:"Disposals",legs:[],search:"",sort:"number",collapsed:{},compFilter:"All",unitSize:guildUnitSize(guildId),autoLines:false};
    panel("builder");renderTray();renderBatchTray();
    $("builder").innerHTML='<div class="back" id="bx">← Back to '+(name||"server")+'</div><h1 style="margin:0 0 16px">Build a tip</h1>'+NDSkeleton.grid(6,{cols:3,tile:"92px"});
    $("bx").onclick=()=>{$("tray").hidden=true;renderBatchTray();loadDetail(guildId);};
    // players now come live from the AFL API (attached to each game); players.json
    // is only a silent fallback for a team the roster feed couldn't match.
    // 0.40.3: players.json, bookies.json and /api/fixtures load in parallel
    // (prefetchBuilderData, index.html — warmed when the server page opened).
    let games=[];
    try{
      const res=await prefetchBuilderData();
      const fx=res[2];
      if(fx&&fx.data){ games=fx.data.games||[]; STATE.playerMeta=fx.data.players||{}; }
    }catch(e){ if(e&&e.unauth)return renderLogin("Session expired."); }
    if(!Object.keys(STATE.players||{}).length) STATE.players={};
    if(!(STATE.bookies&&STATE.bookies.length)){ try{ STATE.bookies=await TB.bookie.load(); }catch(e){} }
    renderGames(games);
    offerDraftResume(guildId, games);
    // Auto-refresh the games list every 180s so live scores update and finished
    // games drop off on their own. Pauses while you're inside a specific game
    // and while the tab is hidden (see pauseBwPolls / resumeBwPolls).
    clearGamesTimer();
    startGamesPoll();
  }

  // ── ESPN sports (NFL week · NBA/WNBA date · player props) ──────────────────
  // Scoreboard/week list: ESPN site API in-browser (fast, logos, calendar snap).
  // TipBot roster only on match click: /api/espn/nfl-players (NFL), /api/espn/players
  // (NBA/WNBA, 0.40.1). League differences live in assets/espn-props.js.
  const ESPN_SITE='https://site.api.espn.com/apis/site/v2/sports';
  const ESPN_PATH={nfl:'football/nfl',nba:'basketball/nba',wnba:'basketball/wnba'};
  function espnLeagueLabel(league){
    const hit=ESPN_SPORTS.find(s=>s.league===league);
    return hit?hit.k:String(league||"").toUpperCase();
  }
  function espnEventName(ev){
    if(!ev)return "";
    const a=(ev.away&&(ev.away.name||ev.away.abbreviation))||"";
    const h=(ev.home&&(ev.home.name||ev.home.abbreviation))||"";
    if(a&&h)return a+" v "+h;
    return ev.short_name||ev.name||"";
  }
  function espnFmtWhen(iso){
    // US games shown in Sydney time (AEST/AEDT) like everything else.
    try{return TBTime.fmtWhen(iso);}catch{return "";}
  }
  function easternYmd(value){
    const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(value||Date.now()));
    return ["year","month","day"].map(t=>parts.find(p=>p.type===t).value).join("-");
  }
  function ymdToEspnDates(ymd){ return String(ymd||"").replace(/-/g,""); }
  function espnLogoUrl(t){
    if(!t)return "";
    const u=t.logo||(t.logos&&t.logos[0]&&t.logos[0].href)||"";
    return (typeof u==="string"&&/^https:\/\//i.test(u))?u:"";
  }
  function espnLogoHtml(t){
    const u=espnLogoUrl(t);
    return u?'<img class="espn-logo" src="'+esc(u)+'" alt="" loading="lazy" width="32" height="32">':'<span class="espn-logo-ph" aria-hidden="true"></span>';
  }
  function espnTeamFromCompetitor(c){
    const t=(c&&c.team)||{};
    return {
      id:t.id||"",
      name:t.displayName||t.name||t.shortDisplayName||"",
      abbreviation:t.abbreviation||"",
      short_name:t.shortDisplayName||t.name||"",
      score:c&&c.score,
      homeAway:c&&c.homeAway,
      logo:espnLogoUrl(t)
    };
  }
  function normalizeEspnEvent(e){
    const comp=(e&&e.competitions&&e.competitions[0])||{};
    const comps=comp.competitors||[];
    const away=comps.find(c=>c.homeAway==="away")||comps[1]||comps[0]||null;
    const home=comps.find(c=>c.homeAway==="home")||comps[0]||null;
    const st=(e&&e.status&&e.status.type)||{};
    return {
      id:e&&e.id,
      name:e&&e.name,
      short_name:(e&&(e.shortName||e.short_name))||"",
      date:e&&e.date,
      venue:(comp.venue&&comp.venue.fullName)||"",
      status:{state:st.state||"",detail:st.detail||st.shortDetail||""},
      away:espnTeamFromCompetitor(away),
      home:espnTeamFromCompetitor(home)
    };
  }
  function espnScoreboardUrl(league, opts){
    opts=opts||{};
    const path=ESPN_PATH[league]||ESPN_PATH.nfl;
    const q=new URLSearchParams({limit:"100"});
    if(league==="nfl"){
      if(opts.season!=null) q.set("dates", String(opts.season));
      if(opts.seasontype!=null) q.set("seasontype", String(opts.seasontype));
      if(opts.week!=null) q.set("week", String(opts.week));
    }else if(opts.dates){
      q.set("dates", String(opts.dates));
    }
    return ESPN_SITE+"/"+path+"/scoreboard?"+q.toString();
  }
  async function espnFetchJson(url){
    const r=await fetch(url,{mode:"cors",cache:"no-store"});
    if(!r.ok) throw new Error("ESPN HTTP "+r.status);
    return r.json();
  }
  function resetEspnBuild(guildId,name,league){
    BUILD={guildId,serverName:name,game:null,tab:TBEspnProps.propTabs(league)[0].stat,legs:[],search:"",sort:"name",collapsed:{},compFilter:"All",custom:false,customEvent:"",customSport:"",customStartDay:"",unitSize:guildUnitSize(guildId),
      espn:true,espnLeague:league,espnEvent:null,espnEvents:[],espnWeeks:[],espnWeekIndex:-1,espnSeasonYear:null,espnDate:easternYmd(),espnPlayers:[],espnTeams:[],espnPropKey:TBEspnProps.propTabs(league)[0].key,espnErr:"",espnPropsMissing:false};
  }
  async function openEspnBuilder(guildId,name,league){
    clearDetailTimers();clearLiveTimer();clearGamesTimer();
    if(BATCH.guildId && String(BATCH.guildId)!==String(guildId)){ BATCH={guildId:null,tips:[]}; }
    resetEspnBuild(guildId,name,league);
    panel("builder");renderTray();renderBatchTray();
    $("builder").innerHTML='<div class="back" id="bx">← Back to '+esc(name||"server")+'</div><h1 style="margin:0 0 16px">Build a tip · '+esc(espnLeagueLabel(league))+'</h1>'+NDSkeleton.grid(6,{cols:3,tile:"92px"});
    await loadEspnScoreboard(true);
  }
  async function loadEspnScoreboard(initial){
    const league=BUILD.espnLeague;
    try{
      let d;
      if(league==="nfl"){
        const w=BUILD.espnWeeks[BUILD.espnWeekIndex];
        if(!initial && w && BUILD.espnSeasonYear!=null && BUILD.espnWeekIndex>=0){
          d=await espnFetchJson(espnScoreboardUrl(league,{season:BUILD.espnSeasonYear,seasontype:w.type,week:w.value}));
        }else{
          d=await espnFetchJson(espnScoreboardUrl(league,{}));
        }
        const leagueObj=(d.leagues||[])[0]||{};
        if(initial || !(BUILD.espnWeeks||[]).length){
          // GPT: weeks from scoreboard calendar phases (type 1 pre / 2 regular / 3 post)
          BUILD.espnWeeks=(leagueObj.calendar||[]).flatMap(p=>(p.entries||[]).map(w=>({...w,type:String(p.value),phase:p.label})));
          BUILD.espnSeasonYear=(d.season&&d.season.year)||(leagueObj.season&&leagueObj.season.year)||BUILD.espnSeasonYear;
        }
        if(initial && BUILD.espnWeekIndex<0 && BUILD.espnWeeks.length){
          const currentType=String((d.season&&d.season.type)||(leagueObj.season&&leagueObj.season.type&&leagueObj.season.type.type)||2);
          let idx=BUILD.espnWeeks.findIndex(w=>w.type===currentType&&Number(w.value)===Number(d.week&&d.week.number));
          if(idx<0){
            const now=Date.now();
            // Prefer regular-season (type "2") date window over preseason when snapping default
            idx=BUILD.espnWeeks.findIndex(w=>String(w.type)==="2"&&now>=Date.parse(w.startDate)&&now<=Date.parse(w.endDate));
            if(idx<0) idx=BUILD.espnWeeks.findIndex(w=>now>=Date.parse(w.startDate)&&now<=Date.parse(w.endDate));
          }
          BUILD.espnWeekIndex=Math.max(0,idx);
          const rawEvents=d.events||[];
          const allPost=rawEvents.length&&rawEvents.every(e=>((e.status&&e.status.type&&e.status.type.state)||"")==="post");
          if(allPost && BUILD.espnWeekIndex<BUILD.espnWeeks.length-1){
            BUILD.espnWeekIndex++;
          }
          const sel=BUILD.espnWeeks[BUILD.espnWeekIndex];
          if(sel && BUILD.espnSeasonYear!=null){
            d=await espnFetchJson(espnScoreboardUrl(league,{season:BUILD.espnSeasonYear,seasontype:sel.type,week:sel.value}));
          }
        }
        BUILD.espnEvents=(d.events||[]).map(normalizeEspnEvent);
      }else{
        // GPT-style: initial fetch without dates so ESPN returns the current/next
        // game day (not an empty ET "today"). Then snap via calendar dates.
        function validYmd(v){ return /^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+"T12:00Z"))&&new Date(v+"T12:00Z").toISOString().slice(0,10)===v; }
        function parseEspnCalendar(leagueObj){
          const cal=(leagueObj&&leagueObj.calendar)||[];
          return [...new Set(cal.filter(x=>typeof x==="string").map(x=>String(x).slice(0,10)).filter(validYmd))].sort();
        }
        function snapBasketballDate(cal, d){
          const today=easternYmd();
          if(cal.includes(today)) return today;
          const next=cal.find(x=>x>=today);
          if(next) return next;
          if(d.day&&d.day.date&&validYmd(String(d.day.date).slice(0,10))) return String(d.day.date).slice(0,10);
          if((d.events||[])[0]&&(d.events||[])[0].date) return easternYmd((d.events||[])[0].date);
          return today;
        }
        if(initial){
          d=await espnFetchJson(espnScoreboardUrl(league,{}));
          let leagueObj=(d.leagues||[])[0]||{};
          BUILD.espnCalendar=parseEspnCalendar(leagueObj);
          const snap=snapBasketballDate(BUILD.espnCalendar, d);
          const fetched=d.day&&d.day.date?String(d.day.date).slice(0,10):"";
          BUILD.espnDate=snap;
          if(snap&&snap!==fetched){
            d=await espnFetchJson(espnScoreboardUrl(league,{dates:ymdToEspnDates(snap)}));
            leagueObj=(d.leagues||[])[0]||{};
            const cal2=parseEspnCalendar(leagueObj);
            if(cal2.length) BUILD.espnCalendar=cal2;
          }
        }else{
          const dates=BUILD.espnDate?ymdToEspnDates(BUILD.espnDate):"";
          d=await espnFetchJson(espnScoreboardUrl(league, dates?{dates}:{}));
          const leagueObj=(d.leagues||[])[0]||{};
          const cal=parseEspnCalendar(leagueObj);
          if(cal.length) BUILD.espnCalendar=cal;
          if(d.day&&d.day.date) BUILD.espnDate=String(d.day.date).slice(0,10);
        }
        BUILD.espnEvents=(d.events||[]).map(normalizeEspnEvent);
      }
      BUILD.espnErr="";
      renderEspnGames();
    }catch(e){
      BUILD.espnErr="Couldn't reach ESPN scoreboard.";
      renderEspnGames();
    }
  }
  function renderEspnGames(){
    const league=BUILD.espnLeague;
    const label=espnLeagueLabel(league);
    let html='<div class="back" id="bx">← Back to '+esc(BUILD.serverName||"server")+'</div>'
      +'<div class="dhead"><h1 style="margin:0">Build a tip · '+esc(label)+'</h1><div style="display:flex;gap:8px"><button class="ghost" id="espnbackafl">🏉 AFL</button><button class="ghost" id="espnrefresh">↻ Refresh</button></div></div>'
      +'<p style="color:var(--muted);margin:0 0 12px">'+(league==="nfl"?"Pick an NFL game, then add player props (yards / TDs / completions / INTs / receptions).":"Pick a "+label+" game, then add player props (points / rebounds / assists / threes / PRA) or free-text selections.")+'</p>';
    html+='<div style="display:flex;gap:8px;margin:0 0 14px;flex-wrap:wrap;align-items:center">'
      +'<button class="compchip" id="espnaflchip">🏉 AFL</button>'
      +ESPN_SPORTS.map(s=>'<button class="compchip espnsport'+(s.league===league?" on":"")+'" data-league="'+esc(s.league)+'">'+esc(s.k)+'</button>').join("")
      +SPORT_STUBS.map(s=>'<button class="compchip sportstub" data-s="'+esc(s.k)+'">'+esc(s.k)+'</button>').join("")
      +'<button class="compchip sportstub" data-s="">＋ Other</button></div>';
    if(league==="nfl"){
      const weeks=BUILD.espnWeeks||[];
      html+='<div style="display:flex;gap:8px;align-items:center;margin:0 0 14px;flex-wrap:wrap">'
        +'<button class="ghost" id="espnprevw" '+(BUILD.espnWeekIndex<=0?"disabled":"")+'>‹</button>'
        +'<select id="espnweek" style="background:var(--card2);border:1px solid var(--line);color:var(--txt);border-radius:10px;padding:10px 12px;font:inherit;min-width:min(100%,280px)">'
        +(weeks.length?weeks.map((w,i)=>'<option value="'+i+'">'+esc((BUILD.espnSeasonYear?BUILD.espnSeasonYear+" · ":"")+(w.label||("Week "+w.value))+(w.phase&&String(w.type)!=="2"?" · "+w.phase:""))+'</option>').join(""):'<option>Loading weeks…</option>')
        +'</select>'
        +'<button class="ghost" id="espnnextw" '+(BUILD.espnWeekIndex>=weeks.length-1?"disabled":"")+'>›</button></div>';
    }else{
      html+='<div style="display:flex;gap:8px;align-items:center;margin:0 0 14px;flex-wrap:wrap">'
        +'<button class="ghost" id="espnprevd">‹</button>'
        +'<input type="date" id="espndate" value="'+esc(BUILD.espnDate||"")+'" style="background:var(--card2);border:1px solid var(--line);color:var(--txt);border-radius:10px;padding:10px 12px;font:inherit">'
        +'<button class="ghost" id="espnnextd">›</button>'
        +'<button class="ghost" id="espntoday">Today (ET)</button>'
        +'<span style="color:var(--faint);font-size:12px">Schedule date · US Eastern</span></div>';
    }
    if(BUILD.espnErr){ html+='<div class="panel"><div class="empty">'+esc(BUILD.espnErr)+'</div></div>'; }
    else if(!(BUILD.espnEvents||[]).length){ html+='<div class="panel"><div class="empty">No '+esc(label)+' games in this view.</div></div>'; }
    else{
      html+='<div class="gcards">'+BUILD.espnEvents.map((ev,i)=>{
        const st=(ev.status&&ev.status.state)||"";
        const live=st==="in"?' <span style="color:#e5484d;font-weight:800;font-size:11px">● LIVE</span>':'';
        const final=st==="post"?' <span style="color:var(--faint);font-size:11px">FINAL</span>':'';
        const when=espnFmtWhen(ev.date);
        const a=ev.away||{}, h=ev.home||{};
        const aScore=st==="pre"?"—":((a.score!=null&&a.score!=="")?a.score:"—");
        const hScore=st==="pre"?"—":((h.score!=null&&h.score!=="")?h.score:"—");
        return '<div class="gcard" data-i="'+i+'"'+(st==="in"?' style="border-color:#e5484d;box-shadow:0 0 0 1px rgba(229,72,77,.25)"':'')+'>'
          +'<div class="rd">'+esc(when||label)+live+final+'</div>'
          +'<div class="espn-teamrow">'+espnLogoHtml(a)+'<span class="espn-tname">'+esc(a.name||a.abbreviation||"Away")+'</span><span class="espn-score">'+esc(String(aScore))+'</span></div>'
          +'<div class="espn-teamrow">'+espnLogoHtml(h)+'<span class="espn-tname">'+esc(h.name||h.abbreviation||"Home")+'<small>Home</small></span><span class="espn-score">'+esc(String(hScore))+'</span></div>'
          +'<div class="vn">'+esc(ev.venue||"")+'</div></div>';
      }).join("")+'</div>';
    }
    $("builder").innerHTML=html;
    $("bx").onclick=()=>{$("tray").hidden=true;renderBatchTray();loadDetail(BUILD.guildId);};
    const ba=$("espnbackafl"); if(ba)ba.onclick=()=>openBuilder(BUILD.guildId,BUILD.serverName);
    const ac=$("espnaflchip"); if(ac)ac.onclick=()=>openBuilder(BUILD.guildId,BUILD.serverName);
    const rr=$("espnrefresh"); if(rr)rr.onclick=()=>loadEspnScoreboard(false);
    $("builder").querySelectorAll(".espnsport").forEach(b=>b.onclick=()=>{ if(b.dataset.league!==BUILD.espnLeague) openEspnBuilder(BUILD.guildId,BUILD.serverName,b.dataset.league); });
    $("builder").querySelectorAll(".sportstub").forEach(b=>b.onclick=()=>openCustom(BUILD.guildId,BUILD.serverName,b.dataset.s));
    if(league==="nfl"){
      const sel=$("espnweek"); if(sel){ sel.value=String(BUILD.espnWeekIndex); sel.onchange=()=>{BUILD.espnWeekIndex=+sel.value;BUILD.espnEvents=[];loadEspnScoreboard(false);}; }
      const pw=$("espnprevw"); if(pw)pw.onclick=()=>{ if(BUILD.espnWeekIndex>0){ BUILD.espnWeekIndex--; loadEspnScoreboard(false);} };
      const nw=$("espnnextw"); if(nw)nw.onclick=()=>{ if(BUILD.espnWeekIndex<BUILD.espnWeeks.length-1){ BUILD.espnWeekIndex++; loadEspnScoreboard(false);} };
    }else{
      const di=$("espndate"); if(di)di.onchange=()=>{BUILD.espnDate=di.value;loadEspnScoreboard(false);};
      const pd=$("espnprevd"); if(pd)pd.onclick=()=>{ const d=new Date((BUILD.espnDate||easternYmd())+"T12:00Z"); d.setUTCDate(d.getUTCDate()-1); BUILD.espnDate=d.toISOString().slice(0,10); loadEspnScoreboard(false); };
      const nd=$("espnnextd"); if(nd)nd.onclick=()=>{ const d=new Date((BUILD.espnDate||easternYmd())+"T12:00Z"); d.setUTCDate(d.getUTCDate()+1); BUILD.espnDate=d.toISOString().slice(0,10); loadEspnScoreboard(false); };
      const td=$("espntoday"); if(td)td.onclick=()=>{BUILD.espnDate=easternYmd();loadEspnScoreboard(false);};
    }
    $("builder").querySelectorAll(".gcard").forEach(c=>c.onclick=()=>openEspnEvent(BUILD.espnEvents[+c.dataset.i]));
  }
  async function openEspnEvent(ev){
    if(!ev)return;
    BUILD.espnEvent=ev;
    BUILD.search="";
    BUILD.collapsed={};
    BUILD.espnPropKey=TBEspnProps.propTabs(BUILD.espnLeague)[0].key;
    BUILD.tab=TBEspnProps.propTabs(BUILD.espnLeague)[0].stat;
    BUILD.espnPropsMissing=false;
    saveMultiDraft();
    if(TBEspnProps.hasProps(BUILD.espnLeague)){
      $("builder").innerHTML='<div class="back" id="bg">← Games</div><h1 style="margin:0 0 16px">'+esc(espnEventName(ev))+'</h1>'+NDSkeleton.lines(6);
      await loadEspnNflPlayers();
    }else{
      renderEspnBasketballPick();
    }
  }
  // Prop roster for the open ESPN event (NFL, NBA, WNBA). Name kept from the NFL-only days.
  async function loadEspnNflPlayers(){
    const ev=BUILD.espnEvent; if(!ev)return;
    const league=BUILD.espnLeague, label=espnLeagueLabel(league);
    try{
      const r=await api(TBEspnProps.playersUrl(league, ev.id));
      if(r.status===404 && TBEspnProps.isBasketball(league)){
        // Older TipBot deploy: no basketball props yet. Keep the free-text pick working.
        BUILD.espnPropsMissing=true; BUILD.espnPlayers=[]; BUILD.espnTeams=[];
        return renderEspnBasketballPick();
      }
      const d=await r.json();
      BUILD.espnPropsMissing=false;
      if(!r.ok||d.ok===false){ BUILD.espnErr=(d&&(d.message||d.error))||("Couldn't load "+label+" players"); BUILD.espnPlayers=[]; BUILD.espnTeams=[]; }
      else{
        BUILD.espnErr="";
        BUILD.espnPlayers=d.players||[];
        BUILD.espnTeams=d.teams||[];
        // Prefer TipBot labels when provided.
        TBEspnProps.applyMarketLabels(league, d.prop_markets);
      }
    }catch(e){
      if(e&&e.unauth)return renderLogin("Session expired.");
      BUILD.espnErr="Couldn't reach TipBot "+label+" players.";
      BUILD.espnPlayers=[]; BUILD.espnTeams=[];
    }
    renderEspnNflProps();
  }
  function renderEspnBasketballPick(){
    const ev=BUILD.espnEvent;
    const label=espnLeagueLabel(BUILD.espnLeague);
    BUILD.custom=true; // free-text legs on a known ESPN fixture
    BUILD.customSport=label;
    BUILD.customEvent=espnEventName(ev);
    if(ev&&ev.date){ try{ BUILD.customStartDay=String(ev.date).slice(0,10);}catch(e){} }
    $("builder").innerHTML='<div class="back" id="bg">← Games</div>'
      +'<div class="dhead"><h1 style="margin:0">'+esc(espnEventName(ev))+'</h1><span class="plan">'+esc(label)+'</span></div>'
      +(BUILD.espnPropsMissing
        ?'<div class="panel"><div class="empty">'+esc(label)+' player props need TipBot\'s latest deploy. <button class="ghost" id="espnpropretry">Retry</button></div></div>'
        :'')
      +'<p style="color:var(--muted);margin:0 0 14px">'+(BUILD.espnPropsMissing?'Match pick only — add free-text selections for this '+esc(label)+' game.':'Free-text selections for this '+esc(label)+' game. <button class="ghost" id="espnpropsback">Player props</button>')+'</p>'
      +'<div class="panel">'
      +'<div class="field"><label>Event</label><input id="c_event" value="'+esc(BUILD.customEvent||"")+'"></div>'
      +'<div class="field"><label>Add a selection</label><div style="display:flex;gap:8px"><input id="c_leg" placeholder="e.g. Lakers -4.5 · Over 224.5" style="flex:1"><button class="btn sm" id="c_add">Add</button></div></div>'
      +'<div style="color:var(--faint);font-size:12px">Tip payload includes <code>espn_event_id</code> '+esc(String(ev.id||""))+'.</div>'
      +'</div>';
    $("bg").onclick=()=>{ BUILD.custom=false; BUILD.espnEvent=null; BUILD.espnPlayers=[]; BUILD.espnTeams=[]; BUILD.espnErr=""; renderEspnGames(); };
    const rt=$("espnpropretry"); if(rt)rt.onclick=()=>{ BUILD.custom=false; openEspnEvent(ev); };
    const pb=$("espnpropsback"); if(pb)pb.onclick=()=>{ BUILD.custom=false; openEspnEvent(ev); };
    const evEl=$("c_event"); if(evEl)evEl.oninput=()=>{BUILD.customEvent=evEl.value;saveMultiDraft();};
    const add=()=>{ const inp=$("c_leg"); const v=(inp.value||"").trim(); if(!v)return;
      addLeg({custom:true,desc:v,espn_event_id:String(ev.id),game_id:String(ev.id),league:BUILD.espnLeague});
      inp.value=""; inp.focus(); };
    const ab=$("c_add"); if(ab)ab.onclick=add;
    const li=$("c_leg"); if(li)li.addEventListener("keydown",e=>{ if(e.key==="Enter"){ e.preventDefault(); add(); } });
  }
  function espnSkillPlayers(list){
    // NFL: skill positions for props (full roster if that empties). Basketball: everyone.
    return TBEspnProps.propPlayers(list, BUILD.espnLeague);
  }
  // Prop picker for any prop league (NFL, NBA, WNBA). Name kept from the NFL-only days.
  function renderEspnNflProps(){
    const ev=BUILD.espnEvent;
    const TABS=TBEspnProps.propTabs(BUILD.espnLeague);
    const bball=TBEspnProps.isBasketball(BUILD.espnLeague);
    const prop=TABS.find(t=>t.key===BUILD.espnPropKey)||TABS[0];
    BUILD.tab=prop.stat;
    BUILD.espnPropKey=prop.key;
    const tabs=TABS.map(t=>'<div class="tab '+(t.key===prop.key?"active":"")+'" data-pk="'+t.key+'">'+esc(t.stat)+'</div>').join("");
    let html='<div class="back" id="bg">← Games</div><div class="dhead"><h1 style="margin:0">'+esc(espnEventName(ev))+'</h1><div style="display:flex;gap:8px">'+(bball?'<button class="ghost" id="espnfreetext">＋ Free text</button>':'')+'<button class="ghost" id="espnplayref">↻ Players</button></div></div>'
      +'<div class="tabs" style="flex-wrap:wrap">'+tabs+'</div>'
      +'<div class="builder-tools">'
      +'<input id="psearch" placeholder="Search players… e.g. '+(bball?'Gilgeous-Alexander, Shai':'Hill, Tyreek')+'" value="'+esc(BUILD.search||"")+'" style="background:var(--bg2);border:1px solid var(--line);color:var(--txt);border-radius:10px;padding:10px 12px;font:inherit;flex:1">'
      +'</div>';
    if(BUILD.espnErr) html+='<div class="empty" style="margin-bottom:12px">'+esc(BUILD.espnErr)+'</div>';
    html+='<div id="players"></div>';
    $("builder").innerHTML=html;
    $("bg").onclick=()=>{ BUILD.espnEvent=null; BUILD.espnPlayers=[]; BUILD.espnTeams=[]; BUILD.espnErr=""; renderEspnGames(); };
    const pr=$("espnplayref"); if(pr)pr.onclick=()=>loadEspnNflPlayers();
    const ft=$("espnfreetext"); if(ft)ft.onclick=()=>renderEspnBasketballPick();
    $("builder").querySelectorAll(".tab[data-pk]").forEach(t=>t.onclick=()=>{BUILD.espnPropKey=t.dataset.pk;BUILD.tab=(TABS.find(x=>x.key===t.dataset.pk)||prop).stat;saveMultiDraft();renderEspnNflProps();});
    const pq=$("psearch"); if(pq){ pq.oninput=()=>{BUILD.search=pq.value;paintEspnNflPlayers();}; }
    paintEspnNflPlayers();
  }
  function paintEspnNflPlayers(){
    const box=$("players"); if(!box)return;
    const TABS=TBEspnProps.propTabs(BUILD.espnLeague);
    const prop=TABS.find(t=>t.key===BUILD.espnPropKey)||TABS[0];
    const shown=list=>TBEspnProps.visiblePlayers(list, BUILD.espnLeague, BUILD.search, nameMatchesSearch);
    const teams=BUILD.espnTeams&&BUILD.espnTeams.length?BUILD.espnTeams:(()=>{
      // Fallback: group flat players list.
      const map=new Map();
      (BUILD.espnPlayers||[]).forEach(p=>{
        const tid=String(p.team_id||p.team||"team");
        if(!map.has(tid)) map.set(tid,{id:tid,name:p.team||tid,abbreviation:p.team_abbreviation||"",players:[]});
        map.get(tid).players.push(p);
      });
      return Array.from(map.values());
    })();
    BUILD.collapsed=BUILD.collapsed||{};
    let html="";
    teams.forEach((team,ti)=>{
      const nm=team.name||team.abbreviation||("Team "+(ti+1));
      const slug=String(team.id||nm).replace(/\W/g,"");
      const list=shown(team.players||[]);
      const collapsed=!!BUILD.collapsed[slug];
      html+='<div class="thdr" data-slug="'+slug+'" role="button" tabindex="0" aria-expanded="'+(!collapsed)+'" aria-controls="tp_'+slug+'"><span class="tcaret" aria-hidden="true">'+(collapsed?"▹":"▾")+'</span>'+esc(nm)+' <small style="color:var(--muted);font-weight:400">· '+list.length+'</small></div>';
      html+='<div class="teamplayers" id="tp_'+slug+'"'+(collapsed?" hidden":"")+'>';
      if(!list.length){ html+='<div class="empty" style="margin:0 0 12px">No players match.</div>'; }
      list.forEach((p,idx)=>{
        const rid="er_"+slug+"_"+idx;
        const def=prop.def, mx=prop.max;
        html+='<div class="prow"><div class="pnum" style="min-width:40px;color:var(--muted);font-weight:700">'+esc(p.position||"—")+'</div>'
          +'<div class="pname-block"><div class="pname">'+esc(p.name)+(p.number?' <small style="color:var(--muted)">#'+esc(String(p.number))+'</small>':'')+'</div></div>'
          +'<div class="linectl"><input type="range" min="0" max="'+mx+'" step="0.5" value="'+def+'" id="'+rid+'_s"><input type="number" id="'+rid+'_v" min="0" step="0.5" value="'+def+'" style="width:72px;background:var(--bg2);border:1px solid var(--line);color:var(--txt);border-radius:8px;padding:6px 8px;font:inherit;font-weight:800;font-size:16px;text-align:center"></div>'
          +'<div class="prow-actions"><div class="ou" id="'+rid+'_ou"><button data-s="Over" class="on">Over</button><button data-s="Under">Under</button></div>'
          +'<input id="'+rid+'_odds" type="number" step="0.01" min="1.01" placeholder="Odds" title="Leg odds (optional)" style="width:72px;background:var(--bg2);border:1px solid var(--line);color:var(--txt);border-radius:8px;padding:6px 8px;font:inherit">'
          +'<button class="addbtn" id="'+rid+'_a">Add</button></div></div>';
      });
      html+='</div>';
    });
    box.innerHTML=html||'<div class="empty">No roster players yet — try Refresh closer to kickoff.</div>';
    box.querySelectorAll(".thdr").forEach(h=>h.onclick=()=>{const slug=h.dataset.slug;const tp=$("tp_"+slug);if(!tp)return;const c=!tp.hidden;tp.hidden=c;BUILD.collapsed[slug]=c;h.setAttribute("aria-expanded",String(!c));const cr=h.querySelector(".tcaret");if(cr)cr.textContent=c?"▹":"▾";});
    teams.forEach((team,ti)=>{
      const nm=team.name||team.abbreviation||("Team "+(ti+1));
      const slug=String(team.id||nm).replace(/\W/g,"");
      // Same list as the render above, so row ids line up (this loop used an undeclared
      // `q` from f5a94cf on, which threw before any Add button was wired).
      const list=shown(team.players||[]);
      list.forEach((p,idx)=>{
        const rid="er_"+slug+"_"+idx;
        const sl=$(rid+"_s"),vv=$(rid+"_v"),ou=$(rid+"_ou"); let side="Over";
        if(!sl||!vv)return;
        function curLine(){ const n=parseFloat(vv.value); return isNaN(n)?0:Math.max(0,n); }
        sl.oninput=()=>{vv.value=sl.value;};
        vv.oninput=()=>{ let n=parseFloat(vv.value); if(isNaN(n))return; if(n<0){n=0;vv.value=0;} sl.value=Math.min(n,+sl.max); };
        ou.querySelectorAll("button").forEach(b=>b.onclick=()=>{side=b.dataset.s;ou.querySelectorAll("button").forEach(x=>x.classList.remove("on"));b.classList.add("on");});
        $(rid+"_a").onclick=()=>{
          const oddsRaw=parseFloat(($(rid+"_odds")||{}).value);
          addLeg(TBEspnProps.buildLeg({player:p, team:nm, prop:prop, line:curLine(), side:side,
            league:BUILD.espnLeague, eventId:BUILD.espnEvent.id, odds:oddsRaw}));
        };
      });
    });
  }

  // ── Custom (non-AFL) tips ────────────────────────────────────────────────
  // Skips the AFL game/player picker: type the event + your selections, add odds/
  // units/bookmaker + an optional screenshot, and it posts through the same queue.
  // ESPN sports: scoreboard via ESPN site API; player props via TipBot (/api/espn/nfl-players,
  // /api/espn/players for NBA/WNBA). Stubs → Custom.
  const ESPN_SPORTS=[{k:"NFL",league:"nfl",hint:"NFL · week picker + player props"},{k:"NBA",league:"nba",hint:"NBA · date picker + player props"},{k:"WNBA",league:"wnba",hint:"WNBA · date picker + player props"}];
  const SPORT_STUBS=[{k:"Soccer",hint:"EPL · A-League"},{k:"NRL",hint:"NRL"}];
  const NFL_PROP_TABS=TBEspnProps.NFL_PROP_TABS;   // assets/espn-props.js (values unchanged)
  function openCustom(guildId,name,presetSport){
    clearDetailTimers();clearLiveTimer();clearGamesTimer();
    if(BATCH.guildId && String(BATCH.guildId)!==String(guildId)){ BATCH={guildId:null,tips:[]}; }
    BUILD={guildId,serverName:name,game:null,tab:"Disposals",legs:[],search:"",sort:"number",collapsed:{},compFilter:"All",custom:true,customEvent:"",customSport:presetSport||"",customStartDay:"",unitSize:guildUnitSize(guildId),autoLines:false};
    panel("builder");renderTray();renderBatchTray();
    renderCustom();
    offerDraftResume(guildId, null);
  }
  function renderCustom(){
    $("builder").innerHTML='<div class="back" id="bx">← Back to '+esc(BUILD.serverName||"server")+'</div>'
      +'<div class="dhead"><h1 style="margin:0">Custom tip</h1></div>'
      +'<p style="color:var(--muted);margin:0 0 14px">For any non-AFL bet. Type the event and each selection, then review to add odds, units and a screenshot.</p>'
      +'<div class="panel">'
      +'<div class="field"><label>Event / match</label><input id="c_event" placeholder="e.g. Lakers v Celtics · Race 5 Flemington · Man City v Arsenal" value="'+esc(BUILD.customEvent||"")+'"></div>'
      +'<div class="field"><label>Sport / league (optional)</label><input id="c_sport" placeholder="e.g. NBA · EPL · UFC · Racing · NRL" value="'+esc(BUILD.customSport||"")+'"></div>'
      +'<div class="field"><label>Start day (optional)</label><input id="c_start" type="date" value="'+esc(BUILD.customStartDay||"")+'"><div style="color:var(--faint);font-size:12px;margin-top:6px">When the event tips off — sent as <code>start_date</code> when TipBot supports it.</div></div>'
      +'<div class="field"><label>Add a selection</label><div style="display:flex;gap:8px"><input id="c_leg" placeholder="e.g. LeBron James 25+ points" style="flex:1"><button class="btn sm" id="c_add">Add</button></div><div style="color:var(--faint);font-size:12px;margin-top:6px">Add one line per leg. They collect in the tray below — then hit Review.</div></div>'
      +'</div>';
    $("bx").onclick=()=>{$("tray").hidden=true;renderBatchTray();loadDetail(BUILD.guildId);};
    const ev=$("c_event"); if(ev)ev.oninput=()=>{BUILD.customEvent=ev.value;saveMultiDraft();};
    const sp=$("c_sport"); if(sp)sp.oninput=()=>{BUILD.customSport=sp.value;saveMultiDraft();};
    const sd=$("c_start"); if(sd)sd.onchange=()=>{BUILD.customStartDay=sd.value||"";saveMultiDraft();};
    const add=()=>{ const inp=$("c_leg"); const v=(inp.value||"").trim(); if(!v)return; addLeg({custom:true,desc:v}); inp.value=""; inp.focus(); };
    const ab=$("c_add"); if(ab)ab.onclick=add;
    const li=$("c_leg"); if(li)li.addEventListener("keydown",e=>{ if(e.key==="Enter"){ e.preventDefault(); add(); } });
  }
  function teamPlayers(t){ if(t&&typeof t==="object"&&Array.isArray(t.players)&&t.players.length)return t.players; return STATE.players[teamName(t)]||[]; }
  // match the backend's _text_key so we can look a live player up by name
  function tkey(s){ return String(s||"").toLowerCase().replace(/&/g,"and").replace(/[^a-z0-9]/g,""); }
  const LIVE_KEYS={Disposals:"disposals",Goals:"goals","Fantasy Points":"dreamTeamPoints",Hitouts:"hitouts",Marks:"marks",Tackles:"tackles",Kicks:"kicks",Handballs:"handballs",Clearances:"totalClearances"};
  // live value for a player on the active stat tab, or null when not live
  function liveVal(name){ const L=BUILD.live; if(!L||!L.available)return null; const p=L.players[tkey(name)]; if(!p)return null; const v=p.summary?.[LIVE_KEYS[BUILD.tab]]; return (typeof v==="number")?v:null; }
  function gameComp(g){ return (g&&g.comp)||"AFL"; }

  function renderGames(games){
    // Which competitions are present? (AFL always; AFLW when the season is on.)
    const comps=[]; games.forEach(g=>{const c=gameComp(g); if(!comps.includes(c))comps.push(c);});
    const hasMulti=comps.length>1;
    if(!BUILD.compFilter||(BUILD.compFilter!=="All"&&!comps.includes(BUILD.compFilter)))BUILD.compFilter="All";
    let html='<div class="back" id="bx">← Back to '+(BUILD.serverName||"server")+'</div>'
      +'<div class="dhead"><h1 style="margin:0">Build a tip</h1><div style="display:flex;gap:8px"><button class="ghost" id="customgames">＋ Custom (non-AFL)</button><button class="ghost" id="refreshgames">↻ Refresh</button></div></div>'
      +'<p style="color:var(--muted);margin:0 0 12px">Upcoming games (next 7 days) · pick one · live games show here too · or add a Custom tip for any other sport</p>';
    // Sport switcher: AFL live · NFL/NBA/WNBA via TipBot ESPN · stubs → custom.
    html+='<div style="display:flex;gap:8px;margin:0 0 14px;flex-wrap:wrap;align-items:center">'
      +'<span class="compchip on" title="Live AFL/AFLW data">🏉 AFL <span style="opacity:.7;font-size:11px">live</span></span>'
      +ESPN_SPORTS.map(s=>'<button class="compchip espnsport" data-league="'+esc(s.league)+'" title="'+esc(s.hint)+'">'+esc(s.k)+' <span style="opacity:.7;font-size:11px">ESPN</span></button>').join("")
      +SPORT_STUBS.map(s=>'<button class="compchip sportstub" data-s="'+esc(s.k)+'" title="'+esc(s.hint)+' — custom tip">'+esc(s.k)+'</button>').join("")
      +'<button class="compchip sportstub" data-s="" title="Any other sport" style="opacity:.85">＋ Other</button></div>';
    if(hasMulti){
      const chip=(v,l)=>'<button class="compchip'+(BUILD.compFilter===v?" on":"")+'" data-c="'+v+'">'+l+'</button>';
      html+='<div class="compfilter" style="display:flex;gap:8px;margin:0 0 16px;flex-wrap:wrap">'
        +chip("All","All")+comps.map(c=>chip(c,c)).join("")+'</div>';
    }
    const shown=games.filter(g=>BUILD.compFilter==="All"||gameComp(g)===BUILD.compFilter);
    if(!games.length){
      const err=(STATE.playerMeta&&STATE.playerMeta.error)||"";
      html+='<div class="panel"><div class="empty">'+(err?("Couldn't load games — "+err+". If the bot was just redeployed, give it a minute and refresh."):"No games in the next 7 days (off-season or none scheduled). Live games show here too.")+'</div></div>';
    }
    else if(!shown.length){ html+='<div class="panel"><div class="empty">No '+BUILD.compFilter+' games in the next 7 days.</div></div>'; }
    else{ html+='<div class="gcards">'+shown.map((g,i)=>{
      const liveBadge=g.live?' <span style="color:#e5484d;font-weight:800;font-size:11px;letter-spacing:.03em">● LIVE</span>':'';
      const compBadge=hasMulti?' <span class="compbadge'+(gameComp(g)==="AFLW"?" aflw":"")+'">'+gameComp(g)+'</span>':'';
      const ht=g.hteam, at=g.ateam;
      return '<div class="gcard" data-i="'+i+'"'+(g.live?' style="border-color:#e5484d;box-shadow:0 0 0 1px rgba(229,72,77,.25)"':'')+'>'
        +'<div class="rd">'+(g.roundname||"")+' · '+fmtGameWhen(g)+liveBadge+compBadge+'</div>'
        +'<div class="espn-teamrow">'+aflLogoHtml(ht)+'<span class="espn-tname">'+esc(teamName(ht)||"Home")+'<small>Home</small></span></div>'
        +'<div class="espn-teamrow">'+aflLogoHtml(at)+'<span class="espn-tname">'+esc(teamName(at)||"Away")+'</span></div>'
        +'<div class="vn">'+(g.venue||"")+'</div></div>';
    }).join("")+'</div>'; }
    $("builder").innerHTML=html;
    $("bx").onclick=()=>{$("tray").hidden=true;renderBatchTray();loadDetail(BUILD.guildId);};
    const rg=$("refreshgames"); if(rg)rg.onclick=()=>openBuilder(BUILD.guildId,BUILD.serverName);
    const cg=$("customgames"); if(cg)cg.onclick=()=>openCustom(BUILD.guildId,BUILD.serverName);
    $("builder").querySelectorAll(".compchip[data-c]").forEach(b=>b.onclick=()=>{BUILD.compFilter=b.dataset.c;renderGames(games);});
    $("builder").querySelectorAll(".sportstub").forEach(b=>b.onclick=()=>openCustom(BUILD.guildId,BUILD.serverName,b.dataset.s));
    $("builder").querySelectorAll(".espnsport").forEach(b=>b.onclick=()=>openEspnBuilder(BUILD.guildId,BUILD.serverName,b.dataset.league));
    $("builder").querySelectorAll(".gcard").forEach(c=>c.onclick=()=>openGame(shown[+c.dataset.i]));
  }

  async function openGame(g){
    clearLiveTimer();clearGamesTimer();
    BUILD.game=g; BUILD.tab="Disposals"; BUILD.live=null;
    saveMultiDraft();
    // 6.1c: the games list has no players; fetch only this game's (cached per game).
    if(TBLight.needsRoster(g)){
      $("builder").innerHTML='<div class="back" id="bg">← Games</div><div class="panel"><div class="empty">Loading players…</div></div>';
      const bg=$("bg"); if(bg) bg.onclick=()=>openBuilder(BUILD.guildId,BUILD.serverName);
      try{ await TBLight.loadRoster(g, function(p){ return sharedGet(p,120000); }); }
      catch(e){ if(e&&e.unauth) return renderLogin("Session expired."); }
      if(BUILD.game!==g) return;
    }
    renderGame();
    // Prefetch TipBot player-lines cache for Auto (session-cached; no spam).
    // Always paint in finally so "Loading book lines…" cannot stick (esp. Auto OFF).
    ensurePlayerLines(g).then(function(){
      if(BUILD.game===g){ if(BUILD.autoLines) renderPlayers(); }
    }).catch(function(e){ if(e&&e.unauth) return renderLogin("Session expired."); })
     .finally(function(){ if(BUILD.game===g) paintAutoBarStatus(); });
    // If the game is in progress, pull live stats now and refresh them every 30s.
    // Skip the timer entirely for pre-game / finished matches (bandwidth cut A).
    const c=Number(g.complete)||0;
    if(g.aflMatchId&&c>0&&c<100){
      await refreshLive(g);
      startLivePoll(g);
    }
  }
  // P2b: never stack builder live refreshes — a poll tick or ↻ tap while the previous
  // refresh for the same game is still running just waits on that one.
  let LIVE_REFRESH=null;
  function refreshLive(g){
    if(LIVE_REFRESH && LIVE_REFRESH.g===g) return LIVE_REFRESH.p;
    const job={g:g,p:null};
    job.p=(async()=>{
      const c=Number(g.complete)||0;
      try{ const data=await (await api("/api/live-stats?match="+encodeURIComponent(g.aflMatchId)+"&complete="+c)).json();
        if(BUILD.game===g){ BUILD.live=data; renderPlayers(); } }
      catch(e){ /* keep the last snapshot on a hiccup */ }
      finally{ if(LIVE_REFRESH===job) LIVE_REFRESH=null; }
    })();
    LIVE_REFRESH=job;
    return job.p;
  }
  function renderGame(){
    const g=BUILD.game;
    const tabs=Object.keys(STATS).map(t=>'<div class="tab '+(t===BUILD.tab?"active":"")+'" data-t="'+t+'">'+t+'</div>').join("");
    const mtabs=Object.keys(MARKETS).map(t=>'<div class="tab mkt '+(t===BUILD.tab?"active":"")+'" data-t="'+t+'">'+t+'</div>').join("");
    const isLive=g.aflMatchId&&Number(g.complete)>0&&Number(g.complete)<100;
    $("builder").innerHTML='<div class="back" id="bg">← Games</div><div class="dhead"><h1 style="margin:0;display:flex;align-items:center;gap:10px;flex-wrap:wrap">'+aflLogoHtml(g.hteam)+'<span>'+esc(teamName(g.hteam))+'</span><span style="color:var(--muted);font-weight:600">v</span>'+aflLogoHtml(g.ateam)+'<span>'+esc(teamName(g.ateam))+'</span></h1><div style="display:flex;align-items:center;gap:10px"><span class="plan">'+(g.roundname||"")+'</span>'+(isLive?'<button class="ghost" id="refreshlive">↻ Live</button>':"")+'</div></div>'
      +(gameNeedsAssume(g)?('<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin:10px 0 4px;padding:10px 12px;border:1px solid var(--warn,#e0a04a);border-radius:12px;background:color-mix(in srgb,var(--warn,#e0a04a) 8%,transparent)">'
        +'<div><div style="color:var(--warn,#e0a04a);font-weight:700;font-size:13px">△ Assumption mode</div><div style="color:var(--muted);font-size:12px;margin-top:2px">A side isn\'t named yet. Turn on to build off the full squad — legs on players who don\'t get named auto-void when the team drops.</div></div>'
        +'<button id="assumetoggle" class="toggle '+(BUILD.assume?"on":"")+'" style="flex:none"></button></div>'):"")
      +'<div class="tabs">'+tabs+'</div>'
      +'<div style="color:var(--faint);font-size:11px;text-transform:uppercase;letter-spacing:.05em;margin:2px 0 6px">First / last markets</div>'
      +'<div class="tabs">'+mtabs+'</div>'
      +'<div class="builder-tools">'
      +'<input id="psearch" placeholder="Search players… e.g. Dangerfield Cameron" value="'+esc(BUILD.search||"")+'" style="background:var(--bg2);border:1px solid var(--line);color:var(--txt);border-radius:10px;padding:10px 12px;font:inherit">'
      +'<select id="psort" style="background:var(--card2);border:1px solid var(--line);color:var(--txt);border-radius:10px;padding:10px 12px;font:inherit;cursor:pointer;min-width:0"><option value="number">Sort: Number</option><option value="name">Sort: Name (A–Z)</option></select>'
      +'</div>'
      +'<div class="auto-bar" id="auto-bar">'
      +'<span class="auto-lab">Auto</span>'
      +'<button type="button" class="toggle'+(BUILD.autoLines?" on":"")+'" id="autolines-toggle" aria-pressed="'+(BUILD.autoLines?"true":"false")+'" title="Seed lines from TipBot book cache"></button>'
      +'<span class="auto-hint">Book line + ~under from TipBot cache (Sportsbet first). Manual O/U still works.</span>'
      +'<span class="auto-status" id="auto-status"></span>'
      +(STATE.role==="owner"&&!STATE.viewAs?'<button type="button" class="ghost" id="autolines-refresh" title="Refresh TipBot cache (owner)" style="padding:6px 10px;font-size:12px">↻</button>':"")
      +'</div><div id="players"></div>';
    $("bg").onclick=()=>openBuilder(BUILD.guildId,BUILD.serverName);
    { const atg=$("assumetoggle"); if(atg)atg.onclick=()=>{BUILD.assume=!BUILD.assume;renderGame();}; }
    const rl=$("refreshlive"); if(rl)rl.onclick=()=>refreshLive(g);
    $("builder").querySelectorAll(".tab").forEach(t=>t.onclick=()=>{BUILD.tab=t.dataset.t;saveMultiDraft();renderGame();});
    const ps=$("psort"); if(ps){ ps.value=BUILD.sort||"number"; ps.onchange=()=>{BUILD.sort=ps.value;renderPlayers();}; }
    const pq=$("psearch"); if(pq){ pq.oninput=()=>{BUILD.search=pq.value;renderPlayers();}; }
    const autoBtn=$("autolines-toggle");
    if(autoBtn){
      autoBtn.onclick=()=>{
        BUILD.autoLines=!BUILD.autoLines;
        autoBtn.classList.toggle("on", BUILD.autoLines);
        autoBtn.setAttribute("aria-pressed", BUILD.autoLines?"true":"false");
        if(BUILD.autoLines){
          paintAutoBarStatus();
          ensurePlayerLines(g).then(function(){ if(BUILD.game===g) renderPlayers(); })
            .catch(function(e){ if(e&&e.unauth) return renderLogin("Session expired."); })
            .finally(function(){ if(BUILD.game===g) paintAutoBarStatus(); });
        }else{
          paintAutoBarStatus();
        }
        renderPlayers();
      };
    }
    const autoRef=$("autolines-refresh");
    if(autoRef){
      autoRef.onclick=()=>{
        autoRef.disabled=true;
        paintAutoBarStatus();
        ensurePlayerLines(g,{refresh:true}).then(function(){
          if(BUILD.game===g && BUILD.autoLines) renderPlayers();
        }).catch(function(e){ if(e&&e.unauth) return renderLogin("Session expired."); })
         .finally(function(){ autoRef.disabled=false; if(BUILD.game===g) paintAutoBarStatus(); });
      };
    }
    paintAutoBarStatus();
    renderPlayers();
  }
  // Only ever show the NAMED side (playerListType==="selected"); before teams are
  // announced we show nothing rather than a full/มismatched squad.
  function isNamed(team){ return team&&typeof team==="object"&&team.playerListType==="selected"; }
  // Assumption mode (#40): before a side is named, optionally build off the FULL
  // squad (the static players.json list). Legs on unnamed players auto-void once
  // the real side drops.
  function fullSquad(team){ const live=(team&&Array.isArray(team.players))?team.players:[]; const stat=STATE.players[teamName(team)]||[]; return (stat.length>=live.length?stat:live); }
  function isAssumed(team){ return !isNamed(team)&&!!BUILD.assume&&fullSquad(team).length>0; }
  function gameNeedsAssume(g){ return g&&(!isNamed(g.hteam)||!isNamed(g.ateam)); }
  function sortPlayers(list){
    const arr=list.slice();
    if(BUILD.sort==="name"){ arr.sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""))); }
    else { arr.sort((a,b)=>{ const na=parseInt(a.number,10),nb=parseInt(b.number,10);
      const va=isNaN(na)?9999:na, vb=isNaN(nb)?9999:nb; return va-vb||String(a.name||"").localeCompare(String(b.name||"")); }); }
    return arr;
  }
  // Multi-token shortlist: "Dangerfield Cameron" or "Dangerfield, Cameron"
  // → OR across tokens (name/number contains any token). Each token is a
  // contiguous substring match (AND within the token itself).
  function searchTokens(q){
    return String(q||"").trim().toLowerCase().split(/[\s,]+/).filter(Boolean);
  }
  function nameMatchesSearch(name, number, q){
    const tokens=searchTokens(q);
    if(!tokens.length) return true;
    const hay=String(name||"").toLowerCase();
    const num=String(number==null?"":number).toLowerCase();
    return tokens.some(t=>hay.includes(t)||num.includes(t));
  }
  function filterPlayers(list){
    const q=BUILD.search||"";
    if(!String(q).trim())return list;
    return list.filter(p=>nameMatchesSearch(p.name, p.number, q));
  }
  // The deterministic, displayed roster for a side — used by BOTH the render and
  // wiring loops so row ids line up.
  function displayList(team){
    if(isNamed(team)){ return filterPlayers(sortPlayers(Array.isArray(team.players)?team.players:[])); }
    if(isAssumed(team)){ return filterPlayers(sortPlayers(fullSquad(team))); }
    return [];
  }
  // Team colours for the guernsey icon (most specific keys first).
  const TEAMCOLORS=[["adelaide","#0a2240"],["brisbanelions","#7a002e"],["brisbane","#7a002e"],["carlton","#0e1e3d"],["collingwood","#0b0b0b"],["essendon","#c8102e"],["fremantle","#33006f"],["goldcoast","#d0112b"],["greaterwesternsydney","#f47a20"],["gwsgiants","#f47a20"],["gws","#f47a20"],["giants","#f47a20"],["hawthorn","#4d2004"],["northmelbourne","#013a81"],["kangaroos","#013a81"],["portadelaide","#01b3ac"],["power","#01b3ac"],["geelong","#0a2240"],["richmond","#141414"],["stkilda","#ed1b2e"],["saints","#ed1b2e"],["sydneyswans","#e1231f"],["swans","#e1231f"],["westcoast","#062f6c"],["eagles","#062f6c"],["westernbulldogs","#0a37a0"],["bulldogs","#0a37a0"],["sydney","#e1231f"],["melbourne","#0b1a4d"],["demons","#0b1a4d"]];
  function teamColor(name){ const k=String(name||"").toLowerCase().replace(/[^a-z]/g,""); for(var i=0;i<TEAMCOLORS.length;i++){ if(k.indexOf(TEAMCOLORS[i][0])>=0)return TEAMCOLORS[i][1]; } return "#2a3550"; }
  function textOn(hex){ const c=hex.replace("#",""); const r=parseInt(c.substr(0,2),16),gg=parseInt(c.substr(2,2),16),b=parseInt(c.substr(4,2),16); return (0.299*r+0.587*gg+0.114*b)>140?"#111":"#fff"; }
  function guernsey(num,name){ const col=teamColor(name),tc=textOn(col); return '<svg width="34" height="34" viewBox="0 0 40 40" style="flex:none" aria-hidden="true"><path d="M13 4 L20 8 L27 4 L34 11 L29.5 17 L29.5 34 Q29.5 37 26.5 37 L13.5 37 Q10.5 37 10.5 34 L10.5 17 L6 11 Z" fill="'+col+'" stroke="rgba(255,255,255,.18)"/><text x="20" y="26" text-anchor="middle" font-family="inherit" font-size="13" font-weight="800" fill="'+tc+'">'+(num!=null&&num!==""?num:"")+'</text></svg>'; }
  // Player form chips (Sportsbet-like last5 / vs opp). Reads in-page caches if TipBot
  // or fixtures ever attach history; otherwise muted "—" placeholders keep layout.
  // Needed TipBot API (document in PR): GET /api/player-form?player=&stat=&vs=
  // returning { last5:[n…], vsOpp:[n…], seasonAvg, last10:[n…] } newest-last.
  function playerForm(player, stat, vsTeam){
    const name=typeof player==="string"?player:(player&&player.name)||"";
    const key=String(name||"").toLowerCase().trim();
    const statKey=String(stat||BUILD.tab||"Disposals");
    const store=STATE.playerForm||STATE.form||null;
    let hit=null;
    if(store&&typeof store==="object"){
      const bucket=store[key]||store[name]||null;
      if(bucket){
        hit=bucket[statKey]||bucket[statKey.toLowerCase()]||bucket.stats||bucket;
      }
    }
    // Optional per-player fields on roster objects from fixtures/live.
    if(!hit&&player&&typeof player==="object"){
      const pf=player.form||player.history||player.stats;
      if(pf){
        hit=(pf[statKey]||pf[statKey.toLowerCase()]||pf);
      }
    }
    function nums(arr){
      if(!Array.isArray(arr))return null;
      const out=arr.map(function(v){ const n=Number(v); return isNaN(n)?null:n; }).filter(function(v){return v!==null;});
      return out.length?out:null;
    }
    if(!hit||typeof hit!=="object"){
      return { last5:null, vsOpp:null, seasonAvg:null, last10:null, placeholder:true };
    }
    const last5=nums(hit.last5||hit.last_5||hit.recent||hit.form)||null;
    let vsOpp=null;
    const vsMap=hit.vs||hit.vsOpp||hit.vs_opp||hit.against||null;
    if(Array.isArray(vsMap)) vsOpp=nums(vsMap);
    else if(vsMap&&typeof vsMap==="object"&&vsTeam){
      const vk=String(vsTeam).toLowerCase().replace(/[^a-z]/g,"");
      for(const k of Object.keys(vsMap)){
        if(String(k).toLowerCase().replace(/[^a-z]/g,"")===vk||String(k).toLowerCase().includes(vk)||vk.includes(String(k).toLowerCase().replace(/[^a-z]/g,""))){
          vsOpp=nums(vsMap[k]); break;
        }
      }
    }
    const seasonAvg=(hit.seasonAvg!=null?Number(hit.seasonAvg):hit.season_avg!=null?Number(hit.season_avg):hit.avg!=null?Number(hit.avg):null);
    const last10=nums(hit.last10||hit.last_10)||null;
    return {
      last5: last5, vsOpp: vsOpp,
      seasonAvg: (seasonAvg!=null&&!isNaN(seasonAvg))?seasonAvg:null,
      last10: last10,
      placeholder: !(last5||vsOpp||(seasonAvg!=null&&!isNaN(seasonAvg))||last10)
    };
  }
  function formChipCells(arr, maxN){
    maxN=maxN||5;
    if(!arr||!arr.length){
      return Array(Math.min(5,maxN)).fill(0).map(function(){ return '<span class="pform-chip ph" title="Form data not loaded yet">—</span>'; }).join("");
    }
    const slice=arr.slice(-maxN);
    return slice.map(function(n,i){
      const recent=i===slice.length-1;
      return '<span class="pform-chip'+(recent?" recent":"")+'" title="'+(recent?"Most recent":"Recent form")+'">'+esc(String(n))+'</span>';
    }).join("");
  }
  function hitRateUnderLine(last10, line){
    if(!last10||!last10.length||!(line>=0))return null;
    const n=last10.length;
    let hits=0;
    last10.forEach(function(v){ if(v>line)hits++; }); // over-line hit rate
    return { hits:hits, n:n, pct:Math.round(hits/n*100) };
  }
  function formChipsHTML(player, teamNm, oppNm, lineHint){
    const form=playerForm(player, BUILD.tab, oppNm);
    let meta="";
    if(form.seasonAvg!=null){
      meta+='<div class="pform-meta">Season avg <b style="color:var(--muted)">'+esc(String(Math.round(form.seasonAvg*10)/10))+'</b></div>';
    }
    const hr=hitRateUnderLine(form.last10||form.last5, lineHint);
    if(hr){
      meta+='<div class="pform-meta">Hit over line (L'+hr.n+') <b style="color:var(--muted)">'+hr.hits+'/'+hr.n+' · '+hr.pct+'%</b></div>';
    }
    return '<div class="pform" aria-label="Recent form">'
      +'<div class="pform-row"><span class="pform-lab">L5</span>'+formChipCells(form.last5,5)+'</div>'
      +'<div class="pform-row"><span class="pform-lab">vs</span>'+formChipCells(form.vsOpp,5)+'</div>'
      +meta+'</div>';
  }
  function renderPlayers(){
    const g=BUILD.game;const box=$("players");let html="";
    const mkt=MARKETS[BUILD.tab];const isMarket=!!mkt;
    const sd=isMarket?[0,0,0]:STATS[BUILD.tab];const mx=sd[1],def=sd[2];
    BUILD.collapsed=BUILD.collapsed||{};
    const sides=[g.hteam,g.ateam];
    const meta=STATE.playerMeta||{};
    if(meta.enabled===false&&meta.error){ html+='<div class="empty" style="margin-bottom:14px">⚠ '+meta.error+'</div>'; }
    const L=BUILD.live;
    if(L&&L.available){ html+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;font-size:12.5px;color:var(--muted)"><span style="width:8px;height:8px;border-radius:50%;background:#e5484d;box-shadow:0 0 0 3px rgba(229,72,77,.2);display:inline-block"></span> LIVE · '+(L.phase&&L.phase.label||"in progress")+' — rows tint by projected pace vs your line</div>'; }
    sides.forEach(team=>{
      const nm=teamName(team),slug=nm.replace(/\W/g,"");
      const status=((team&&team.selectionStatus)||"").replace(/_/g," ").toLowerCase();
      if(!isNamed(team)&&!isAssumed(team)){
        html+='<div class="teamhdr">'+nm+' <span style="background:#5a4a1f;color:#f0d78a;font-size:10.5px;font-weight:800;letter-spacing:.03em;padding:2px 8px;border-radius:999px;vertical-align:middle">NOT NAMED</span></div>'
          +'<div class="empty" style="margin:0 0 14px">Team not announced yet — players appear once the side is named (usually 1\u20132 days before the game)'+(status?" \u00b7 "+status:"")+'.</div>';
        return;
      }
      const assumed=isAssumed(team);
      const list=displayList(team);
      const collapsed=!!BUILD.collapsed[slug];
      const sideBadge=assumed
        ? '<span style="background:#5a4a1f;color:#f0d78a;font-size:10.5px;font-weight:800;letter-spacing:.03em;padding:2px 8px;border-radius:999px;vertical-align:middle">\u25b3 ASSUMED \u00b7 FULL SQUAD</span>'
        : '<span style="background:#1f6f43;color:#fff;font-size:10.5px;font-weight:800;letter-spacing:.03em;padding:2px 8px;border-radius:999px;vertical-align:middle">NAMED SIDE</span>';
      html+='<div class="thdr" data-slug="'+slug+'" role="button" tabindex="0" aria-expanded="'+(!collapsed)+'" aria-controls="tp_'+slug+'"><span class="tcaret" aria-hidden="true">'+(collapsed?"\u25b8":"\u25be")+'</span>'+nm+' '+sideBadge+' <small style="color:var(--muted);font-weight:400">\u00b7 '+list.length+' player'+(list.length===1?"":"s")+(status?" \u00b7 "+status:"")+'</small></div>';
      html+='<div class="teamplayers" id="tp_'+slug+'"'+(collapsed?' hidden':'')+'>';
      const ins=(team&&team.ins)||[],outs=(team&&team.outs)||[];
      if(ins.length||outs.length){
        html+='<div style="display:flex;gap:16px;flex-wrap:wrap;margin:-2px 0 12px;font-size:12.5px;line-height:1.5">';
        if(outs.length)html+='<div><span style="color:#e5695b;font-weight:800">OUT</span> <span style="color:var(--muted)">'+outs.map(p=>p.name).join(", ")+'</span></div>';
        if(ins.length)html+='<div><span style="color:#42b06f;font-weight:800">IN</span> <span style="color:var(--muted)">'+ins.map(p=>p.name).join(", ")+'</span></div>';
        html+='</div>';
      }
      if(!list.length){ html+='<div class="empty" style="margin:0 0 12px">No players match your search.</div>'; }
      const oppNm=teamName(sides[0]===team?sides[1]:sides[0]);
      list.forEach((p,idx)=>{const rid="r_"+slug+"_"+idx;const lv=liveVal(p.name);
        const liveChip=(lv!==null)?' <span style="color:#f0b73f;font-weight:800">· '+lv+' now</span>':"";
        const hit=(!isMarket && BUILD.autoLines)?lookupPlayerLine(p.name, BUILD.tab):null;
        const seedLine=(hit&&hit.primary&&hit.primary.line!=null)?Number(hit.primary.line):null;
        const rowDef=(seedLine!=null&&!isNaN(seedLine))?seedLine:def;
        const formHtml=isMarket?"":formChipsHTML(p, nm, oppNm, rowDef);
        const nameCell='<div class="pname-block"><div class="pname">'+esc(p.name)+(p.captain?' <span style="color:#f0b73f;font-weight:800">(C)</span>':"")+(p.position?' <small style="color:var(--muted)">'+esc(p.position)+'</small>':"")+liveChip+'</div>'+formHtml+'</div>';
        // Compare hidden behind FEATURE_COMPARE (see top of script). Empty string = no element, no gap.
        const cmp=FEATURE_COMPARE?'<a class="compare-btn" data-player="'+esc(p.name)+'" href="'+esc(compareHref(p.name, BUILD.tab, g))+'" target="_blank" rel="noopener">Compare</a>':'';
        if(isMarket){
          html+='<div class="prow"><div class="pnum">'+guernsey(p.number,nm)+'</div>'+nameCell
            +'<div class="prow-actions" style="margin-left:auto">'+cmp+'<button class="addbtn" id="'+rid+'_a">Add</button></div></div>';
          return;
        }
        const step=(BUILD.autoLines || (rowDef!=null && Math.abs(rowDef-Math.round(rowDef))>1e-9))?"0.5":"1";
        const rangeMax=Math.max(mx, Math.ceil(rowDef||0)+5);
        const autoMeta=(BUILD.autoLines?autoPriceHtml(hit):"");
        html+='<div class="prow" data-player="'+esc(p.name)+'"><div class="pnum">'+guernsey(p.number,nm)+'</div>'+nameCell
          +'<div class="linectl-wrap"><div class="linectl"><input type="range" min="0" max="'+rangeMax+'" step="'+step+'" value="'+rowDef+'" id="'+rid+'_s"><input type="number" id="'+rid+'_v" min="0" step="'+step+'" value="'+rowDef+'" style="width:64px;background:var(--bg2);border:1px solid var(--line);color:var(--txt);border-radius:8px;padding:6px 8px;font:inherit;font-weight:800;font-size:16px;text-align:center"></div>'
          +autoMeta+'</div>'
          +'<div class="prow-actions">'+cmp+'<div class="ou" id="'+rid+'_ou"><button data-s="Over" class="on">Over</button><button data-s="Under">Under</button></div>'
          +'<button class="addbtn" id="'+rid+'_a">Add</button></div></div>';
      });
      html+='</div>';
    });
    box.innerHTML=html||'<div class="empty">No players listed for either team yet.</div>';
    box.querySelectorAll(".thdr").forEach(h=>h.onclick=()=>{const slug=h.dataset.slug;const tp=$("tp_"+slug);if(!tp)return;const c=!tp.hidden;tp.hidden=c;BUILD.collapsed[slug]=c;h.setAttribute("aria-expanded",String(!c));const cr=h.querySelector(".tcaret");if(cr)cr.textContent=c?"\u25b8":"\u25be";});
    // wire each row
    const frac=(L&&L.available&&L.phase&&L.phase.fraction>0)?L.phase.fraction:0;
    sides.forEach(team=>{const nm=teamName(team),slug=nm.replace(/\W/g,""),teamAssumed=isAssumed(team);displayList(team).forEach((p,idx)=>{
      const rid="r_"+slug+"_"+idx;
      if(isMarket){ const a=$(rid+"_a"); if(a)a.onclick=()=>addLeg({player:p.name,number:p.number||null,team:nm,market:BUILD.tab,desc:mkt.d(p.name,nm),assumed:teamAssumed}); return; }
      const sl=$(rid+"_s"),vv=$(rid+"_v"),ou=$(rid+"_ou");let side="Over";
      if(!sl||!vv)return;
      const row=sl.closest(".prow");const lv=liveVal(p.name);
      function curLine(){ const n=parseFloat(vv.value); return isNaN(n)?0:Math.max(0,n); }
      // tint by projected finish vs the typed line, from the BET's point of view.
      function tint(){ if(!window.NDStatusTint||lv===null||!frac||!row){return;} const projected=lv/frac,line=curLine();
        if(side==="Under") NDStatusTint.apply(row,line,projected); else NDStatusTint.apply(row,projected,line); }
      tint();
      sl.oninput=()=>{vv.value=sl.value;tint();};
      vv.oninput=()=>{ let n=parseFloat(vv.value); if(isNaN(n)){tint();return;} if(n<0){n=0;vv.value=0;} sl.value=Math.min(n,+sl.max); tint(); };
      ou.querySelectorAll("button").forEach(b=>b.onclick=()=>{side=b.dataset.s;ou.querySelectorAll("button").forEach(x=>x.classList.remove("on"));b.classList.add("on");tint();});
      $(rid+"_a").onclick=()=>addLeg({player:p.name,number:p.number||null,team:nm,stat:BUILD.tab,line:curLine(),side,assumed:teamAssumed});
    });});
    if(BUILD.pendingComparePick) applyComparePick(BUILD.pendingComparePick);
  }
  /** Whole-number player-prop lines → N−0.5 (Over/Under). .5 lines unchanged.
   *  Lives in assets/lines.js (shared parity vectors with TipBot's services/lines.py). */
  function applyHalfPointLine(leg){ return TBLines.applyHalfPointLine(leg); }
  function normalizePropLines(legs){ return TBLines.normalizePropLines(legs); }
  function lineAdjustNote(l){ return TBLines.lineAdjustNote(l); }
  function addLeg(leg){
    let next=Object.assign({},leg);
    if(!BUILD.custom&&!TB.gameId(next)){
      const gameId=TB.gameId({game:BUILD.game});
      if(gameId)next.game_id=gameId;
    }
    next=applyHalfPointLine(next);
    BUILD.legs.push(next);renderTray();saveMultiDraft();
  }
  function legText(l){ if(l.desc)return l.desc; return l.player+" "+(l.side==="Over"?l.line+"+ ":"under "+l.line+" ")+l.stat; }
  function renderTray(){
    const t=$("tray");
    if(!BUILD.legs.length){ t.hidden=true; syncTrayStack(); return; }
    t.hidden=false;
    t.innerHTML='<div class="tray-in"><div class="legchips">'+BUILD.legs.map((l,i)=>'<span class="chip">'+esc(legText(l))+' <button type="button" class="x" data-i="'+i+'" aria-label="Remove leg '+(i+1)+'">✕</button></span>').join("")+'</div>'
      +'<button class="btn" id="reviewbtn">Review multi ('+BUILD.legs.length+')</button>'+TB.multiSummary(BUILD.legs)+'</div>';
    t.querySelectorAll(".x").forEach(x=>x.onclick=()=>{BUILD.legs.splice(+x.dataset.i,1);renderTray(); if(BUILD.legs.length)saveMultiDraft(); else clearMultiDraft(BUILD.guildId);});
    $("reviewbtn").onclick=renderConfirm;
    syncTrayStack();
  }
  function batchTipLabel(tip){
    const legs=tip.legs||[];
    const name=tip.game_name||(tip.custom?"Custom tip":"Tip");
    const n=legs.length;
    return name+" · "+n+" leg"+(n===1?"":"s")+" @ "+tip.odds+" · "+tip.units+"u";
  }
  // Stake entry: units always available; dollars mode appears when the guild has
  // a unit size configured, and shows a live half-up "= X.XXu" preview.
  function stakeFieldHTML(){
    const us=BUILD.unitSize||0;
    if(!(us>0)){
      return '<div class="field"><label>Units</label><input id="f_units" type="number" step="0.5" placeholder="e.g. 1">'
        +'<div style="color:var(--faint);font-size:12px;margin-top:6px">Set a unit size in Settings → General to stake in dollars.</div></div>';
    }
    const mode=BUILD.stakeMode||"units";
    const seg='<div id="stakeseg" style="display:inline-flex;border:1px solid var(--line);border-radius:10px;overflow:hidden;margin-bottom:8px">'
      +'<button type="button" class="stakemode" data-mode="units">Units</button>'
      +'<button type="button" class="stakemode" data-mode="dollars">Dollars</button></div>';
    return '<div class="field"><label>Stake</label>'+seg
      +'<div id="stake_units_wrap"><input id="f_units" type="number" step="0.5" placeholder="e.g. 1"></div>'
      +'<div id="stake_dollars_wrap"><div style="display:flex;align-items:center;gap:8px">'
      +'<span style="color:var(--muted)">$</span><input id="f_dollars" type="number" step="1" placeholder="e.g. 100" style="flex:1"></div>'
      +'<div id="f_units_prev" style="color:var(--muted);font-size:13px;margin-top:6px">= —</div>'
      +'<div style="color:var(--faint);font-size:12px;margin-top:2px">Unit size $'+(us%1?us.toFixed(2):us)+' · rounded to 2 dp</div></div></div>';
  }
  function wireStakeField(){
    const us=BUILD.unitSize||0; if(!(us>0))return;
    const seg=$("stakeseg"); if(!seg)return;
    const btns=seg.querySelectorAll(".stakemode");
    const uw=$("stake_units_wrap"),dw=$("stake_dollars_wrap"),prev=$("f_units_prev");
    function paint(){
      const mode=BUILD.stakeMode||"units";
      btns.forEach(b=>{const on=b.dataset.mode===mode;
        b.style.background=on?"var(--accent)":"transparent";
        b.style.color=on?"#fff":"var(--muted)";
        b.style.padding="7px 14px";b.style.border="none";b.style.cursor="pointer";b.style.fontWeight="600";b.style.fontSize="13px";});
      uw.hidden=(mode!=="units"); dw.hidden=(mode!=="dollars");
      updateStakePrev();
    }
    function updateStakePrev(){
      const d=parseFloat(($("f_dollars")||{}).value);
      const u=dollarsToUnits(d,us);
      prev.innerHTML=(d>0)?("= <b style=\"color:var(--txt)\">"+u.toFixed(2)+"u</b>"):"= —";
    }
    btns.forEach(b=>b.onclick=()=>{BUILD.stakeMode=b.dataset.mode;paint();});
    const df=$("f_dollars"); if(df)df.oninput=updateStakePrev;
    paint();
  }
  // Resolve the final stake in units from whichever mode is active. Returns
  // {units, error}. Dollars mode divides by the guild unit size (half-up 2dp).
  function resolveStakeUnits(){
    const us=BUILD.unitSize||0;
    if(us>0 && (BUILD.stakeMode||"units")==="dollars"){
      const d=parseFloat(($("f_dollars")||{}).value);
      if(!(d>0))return {units:0,error:"Enter a dollar amount greater than 0."};
      const u=dollarsToUnits(d,us);
      if(!(u>0))return {units:0,error:"That dollar amount rounds to 0 units."};
      return {units:u,error:null};
    }
    const u=parseFloat(($("f_units")||{}).value);
    if(!(u>0))return {units:0,error:"Units must be greater than 0."};
    return {units:u,error:null};
  }
  function renderConfirm(){
    clearLiveTimer();
    // Resolve half-points before review so Discord matches what Brandon sees.
    BUILD.legs=normalizePropLines(BUILD.legs);
    saveMultiDraft();
    panel("builder");
    const lt=$("tray"); if(lt)lt.hidden=true; syncTrayStack();
    const bk=TB.bookie.options();
    const title=BUILD.espn?(espnEventName(BUILD.espnEvent)||BUILD.customEvent||espnLeagueLabel(BUILD.espnLeague)):(BUILD.game?teamName(BUILD.game.hteam)+" v "+teamName(BUILD.game.ateam):(BUILD.custom?(BUILD.customEvent||"Custom tip"):"Multi"));
    const adjustNotes=BUILD.legs.map(lineAdjustNote).filter(Boolean);
    const adjustBanner=adjustNotes.length
      ?'<div style="margin:0 0 12px;padding:10px 12px;border-radius:10px;border:1px solid rgba(91,140,255,.35);background:rgba(91,140,255,.10);font-size:13px;line-height:1.45">'
        +'<b>Half-point lines</b> — whole numbers become N−0.5 (Over &amp; Under).<br>'
        +adjustNotes.map(n=>esc(n)).join("<br>")+'</div>'
      :'';
    $("builder").innerHTML='<div class="back" id="bc">← Keep building</div><h1 style="margin:0 0 16px">Confirm & schedule</h1>'
      +adjustBanner
      +'<div class="panel"><h3>'+esc(title)+' — '+BUILD.legs.length+' leg'+(BUILD.legs.length>1?"s":"")+'</h3><div class="tb-review-kind">'+TB.multiSummary(BUILD.legs)+'</div>'
      +BUILD.legs.map(l=>{
        const note=lineAdjustNote(l);
        return '<div class="tip"><div class="g">'+esc(legText(l))+'</div>'
          +'<div class="meta">'+esc(l.team||(BUILD.custom?(BUILD.customSport||""):""))+'</div>'
          +(note?'<div class="meta" style="color:var(--accent);margin-top:4px">'+esc(note)+'</div>':'')
          +'</div>';
      }).join("")+'</div>'
      +'<div class="panel"><h3>Details</h3>'
      +'<div class="field"><label>Total odds</label><input id="f_odds" type="number" step="0.01" placeholder="e.g. 3.20"></div>'
      +stakeFieldHTML()
      +'<div class="field"><label for="f_book">Bookmaker</label><div class="tb-bookmaker-picker"><select id="f_book">'+bk+'</select><div id="f_book_preview" class="tb-bookmaker-selected" aria-live="polite"></div></div></div>'
      +'<div class="field"><label>Post delay (minutes, 0 = now)</label><input id="f_delay" type="number" step="1" value="0"></div>'
      +'<div class="field"><label>Screenshot (optional)</label><input id="f_img" type="file" accept="image/*"><div id="f_img_prev" style="margin-top:8px"></div></div>'
      +'<div class="sched-actions"><button class="btn secondary" id="batchaddbtn" type="button">Add to batch</button>'
      +'<button class="btn" id="schedbtn" type="button">Schedule tip →</button></div>'
      +'<div id="scherr" class="err" style="margin-top:10px"></div>'
      +'<div style="color:var(--faint);font-size:12px;margin-top:10px">One-off uses delay above. Or add several tips to a batch and schedule them together (optional Trickle stagger).</div></div>';
    $("bc").onclick=()=>{ if(BUILD.espn && BUILD.espnEvent && TBEspnProps.hasProps(BUILD.espnLeague) && !BUILD.custom){renderEspnNflProps();} else if(BUILD.espn && BUILD.espnEvent){renderEspnBasketballPick();} else if(BUILD.espn){renderEspnGames();} else if(BUILD.custom){renderCustom();} else {renderGame();} };
    wireStakeField();
    if(BUILD.compareBook&&$("f_book")&&!$("f_book").value){
      const want=String(BUILD.compareBook).toLowerCase();
      const opt=[...$("f_book").options].find(o=>o.value&&o.value.toLowerCase().replace(/\s/g,"").startsWith(want.replace(/\s/g,"")));
      if(opt)$("f_book").value=opt.value;
    }
    TB.bookie.wireSelect($("f_book"),$("f_book_preview"));
    $("schedbtn").onclick=scheduleTip;
    $("batchaddbtn").onclick=addCurrentTipToBatch;
    const fi=$("f_img");
    if(fi)fi.onchange=async()=>{
      const prev=$("f_img_prev");const file=fi.files&&fi.files[0];
      if(!file){ BUILD.image=null; prev.innerHTML=""; return; }
      prev.innerHTML='<span style="color:var(--muted);font-size:12px">Compressing…</span>';
      try{ BUILD.image=await compressImage(file);
        prev.innerHTML='<img src="'+BUILD.image+'" style="max-height:120px;border-radius:8px;border:1px solid var(--line)"> <span style="color:var(--faint);font-size:12px">attached — the bot posts it with the tip</span>';
      }catch(e){ BUILD.image=null; prev.innerHTML='<span class="err" style="font-size:12px">Couldn\'t read that image.</span>'; }
    };
  }
  function readTipForm(){
    const odds=parseFloat(($("f_odds")||{}).value);
    if(!(odds>1))return {error:"Odds must be greater than 1."};
    const st=resolveStakeUnits();
    if(st.error)return {error:st.error};
    const units=st.units;
    const bookmaker=(($("f_book")||{}).value)||"";
    const espnId=BUILD.espnEvent&&BUILD.espnEvent.id?String(BUILD.espnEvent.id):(BUILD.legs.find(l=>l&&l.espn_event_id)||{}).espn_event_id||"";
    const game_name=BUILD.espn?(espnEventName(BUILD.espnEvent)||((BUILD.customEvent||"").trim())):(BUILD.custom?((BUILD.customEvent||"").trim()):(BUILD.game?teamName(BUILD.game.hteam)+" v "+teamName(BUILD.game.ateam):""));
    const sport=BUILD.espn?(espnLeagueLabel(BUILD.espnLeague)||"NFL"):(BUILD.custom?(((BUILD.customSport||"").trim()||"Other").toUpperCase()):"AFL");
    BUILD.legs=normalizePropLines(BUILD.legs);
    const start_date=BUILD.espn?(BUILD.espnEvent&&BUILD.espnEvent.date?String(BUILD.espnEvent.date).slice(0,10):(BUILD.customStartDay||"").trim()):(BUILD.custom?((BUILD.customStartDay||"").trim()):"");
    const out={odds,units,bookmaker,game_name,sport,legs:BUILD.legs.slice(),image_b64:BUILD.image||""};
    if(BUILD.espn&&BUILD.espnLeague){ out.league=BUILD.espnLeague; }
    if(espnId){ out.espn_event_id=String(espnId); out.event_id=String(espnId); }
    // TipBot may accept start_date / game_start; ignore-unknown on lagging deploys.
    if(start_date){ out.start_date=start_date; out.game_start=start_date; }
    // 0.42.2: AFL fixture games carry their real start (Squiggle unixtime) as game_start,
    // so Upcoming Bets shows the time even when /api/upcoming can't be reached.
    else if(!BUILD.espn && !BUILD.custom){ const gs=aflGameStartIso(BUILD.game); if(gs) out.game_start=gs; }
    return out;
  }
  function aflGameStartIso(g){
    const u=g&&Number(g.unixtime);
    if(!u||!isFinite(u)||u<=0) return "";
    try{ return new Date(u*1000).toISOString().replace(".000Z","Z"); }catch(e){ return ""; }
  }
  function addCurrentTipToBatch(){
    const tip=readTipForm();
    if(tip.error){ $("scherr").textContent=tip.error; return; }
    $("scherr").textContent="";
    if(BATCH.guildId && String(BATCH.guildId)!==String(BUILD.guildId)){ BATCH={guildId:null,tips:[]}; }
    BATCH.guildId=BUILD.guildId;
    BATCH.tips.push({
      legs:tip.legs, odds:tip.odds, units:tip.units, bookmaker:tip.bookmaker,
      game_name:tip.game_name, sport:tip.sport, image_b64:tip.image_b64||"",
      start_date:tip.start_date||"", game_start:tip.game_start||"",
      league:tip.league||"", espn_event_id:tip.espn_event_id||"", event_id:tip.event_id||""
    });
    BUILD.legs=[]; BUILD.image=null;
    clearMultiDraft(BUILD.guildId);
    renderTray();
    renderBatchTray();
    toast("Added to batch ("+BATCH.tips.length+")");
    // Keep building the next tip on the same game / custom / ESPN form.
    if(BUILD.espn && BUILD.espnEvent && TBEspnProps.hasProps(BUILD.espnLeague) && !BUILD.custom){ renderEspnNflProps(); }
    else if(BUILD.espn && BUILD.espnEvent){ renderEspnBasketballPick(); }
    else if(BUILD.espn){ renderEspnGames(); }
    else if(BUILD.custom){ BUILD.customEvent=BUILD.customEvent||""; renderCustom(); }
    else if(BUILD.game){ renderGame(); }
    else { openBuilder(BUILD.guildId, BUILD.serverName); }
  }
  function renderBatchConfirm(){
    if(!BATCH.tips.length){ renderBatchTray(); return; }
    clearLiveTimer();
    // Ensure every batched prop line is half-point before review/schedule.
    BATCH.tips=BATCH.tips.map(tip=>Object.assign({},tip,{legs:normalizePropLines(tip.legs||[])}));
    panel("builder");
    const t=$("tray"); if(t)t.hidden=true;
    const bt=$("batchtray"); if(bt)bt.hidden=true;
    const n=BATCH.tips.length;
    const batchNotes=[];
    BATCH.tips.forEach((tip,ti)=>{(tip.legs||[]).forEach(l=>{const nte=lineAdjustNote(l); if(nte) batchNotes.push("Tip "+(ti+1)+": "+nte);});});
    const adjustBanner=batchNotes.length
      ?'<div style="margin:0 0 12px;padding:10px 12px;border-radius:10px;border:1px solid rgba(91,140,255,.35);background:rgba(91,140,255,.10);font-size:13px;line-height:1.45">'
        +'<b>Half-point lines</b> — whole numbers become N−0.5 (Over &amp; Under).<br>'
        +batchNotes.map(n=>esc(n)).join("<br>")+'</div>'
      :'';
    $("builder").innerHTML='<div class="back" id="bcb">← Back to batch</div><h1 style="margin:0 0 16px">Schedule batch</h1>'
      +adjustBanner
      +'<div class="panel"><h3>'+n+' tip'+(n===1?"":"s")+' ready</h3>'
      +BATCH.tips.map((tip,i)=>'<div class="tip"><div style="flex:1;min-width:0"><div class="g">'+esc(batchTipLabel(tip))+'</div>'
      +'<div class="meta">'+(tip.legs||[]).map(l=>{
        const nte=lineAdjustNote(l);
        return esc(legText(l))+(nte?' <span style="color:var(--accent)">('+esc(nte)+')</span>':'');
      }).join(" · ")+'</div></div>'
      +'<button type="button" class="ghost" data-rm="'+i+'" aria-label="Remove tip '+(i+1)+'">Remove</button></div>').join("")
      +'</div>'
      +'<div class="panel"><h3>When to post</h3>'
      +'<div class="field"><label>Post delay (minutes, 0 = now)</label><input id="f_delay" type="number" step="1" value="0"></div>'
      +'<label class="trickle-row" for="f_trickle"><input id="f_trickle" type="checkbox">'
      +'<div><div class="title">Trickle</div><div class="thint">Stagger tips ~30s apart so followers can get on</div></div></label>'
      +'<div style="color:var(--faint);font-size:12px;margin:12px 0 0">Off → all tips share the same delay. On → tip i posts at base delay + i×30s.</div>'
      +'<div class="sched-actions" style="margin-top:16px"><button class="btn" id="batchgo" type="button">Schedule '+n+' tips →</button></div>'
      +'<div id="scherr" class="err" style="margin-top:10px"></div></div>';
    $("bcb").onclick=()=>{ renderBatchTray(); if(BUILD.espn && BUILD.espnEvent && TBEspnProps.hasProps(BUILD.espnLeague) && !BUILD.custom){renderEspnNflProps();} else if(BUILD.espn && BUILD.espnEvent){renderEspnBasketballPick();} else if(BUILD.espn){renderEspnGames();} else if(BUILD.custom){renderCustom();} else if(BUILD.game){renderGame();} else {openBuilder(BATCH.guildId||BUILD.guildId,BUILD.serverName);} };
    $("builder").querySelectorAll("[data-rm]").forEach(b=>b.onclick=()=>{
      BATCH.tips.splice(+b.dataset.rm,1);
      if(!BATCH.tips.length){ BATCH.guildId=null; renderBatchTray(); if(BUILD.custom)renderCustom(); else if(BUILD.game)renderGame(); else openBuilder(BUILD.guildId,BUILD.serverName); return; }
      renderBatchConfirm();
    });
    $("batchgo").onclick=scheduleBatch;
  }
  function scheduleBatch(){
    const go=$("batchgo");
    if(go && (go.disabled || go.dataset.busy==="1")) return;
    const n=BATCH.tips.length;
    if(!n){ $("scherr").textContent="Batch is empty."; return; }
    const delay=parseInt(($("f_delay")||{}).value||"0",10)||0;
    const trickle=!!(($("f_trickle")||{}).checked);
    $("scherr").textContent="";
    if(go){ go.disabled=true; }
    routeBeforePost(BATCH.guildId||BUILD.guildId,BATCH.tips).then(rt=>{
      if(go){ go.disabled=false; }
      if(!rt||rt.cancelled){ return; }
      const chips=(rt.chips||[]).map((c,i)=>c?("Tip "+(i+1)+" "+c):"").filter(Boolean);
      NDCountdownConfirm.open({
        title:"Schedule "+n+" tip"+(n===1?"":"s")+"?",
        message:n+" tip"+(n===1?"":"s")+" · delay <b>"+delay+"m</b> · Trickle <b>"+(trickle?"on (~30s stagger)":"off (same time)")+"</b> — posts to Discord."
          +(chips.length?'<br>'+chips.map(c=>'<span class="chip">'+esc(c)+'</span>').join(" "):'')
          +(rt.note?'<br><span style="color:var(--faint)">'+esc(rt.note)+'</span>':''),
        seconds:5,confirmLabel:"Schedule batch",secondaryLabel:"Cancel",accent:"#5b8cff",
        onConfirm:()=>doBatchSchedule(delay,trickle,rt.routes),
      });
    });
  }
  async function doBatchSchedule(delay,trickle,routes){
    const btn=$("batchgo");
    if(btn){ if(btn.disabled||btn.dataset.busy==="1") return; }
    const errEl=$("scherr");
    const nTips=BATCH.tips.length;
    const prog=SubmitProgress.open({
      btn:btn, anchor:errEl, id:"batchprog",
      busyLabel:"Scheduling "+nTips+" tip"+(nTips===1?"":"s")+"…",
      sendingLabel:"Sending "+nTips+" tip"+(nTips===1?"":"s")+" to TipBot…",
    });
    function setErr(msg){ if(errEl)errEl.textContent=msg||""; prog.fail(msg||""); }
    function unlockBtn(){ /* SubmitProgress.fail() already unlocks */ }
    const batchRequestId=newClientRequestId();
    const guildId=BATCH.guildId||BUILD.guildId;
    const tips=BATCH.tips.map((t,ti)=>{
      const row={legs:t.legs, odds:t.odds, units:t.units, bookmaker:t.bookmaker,
        game_name:t.game_name, sport:t.sport, image_b64:t.image_b64||""};
      if(routes&&routes[ti]) row.route=routes[ti];
      if(t.league) row.league=t.league;
      if(t.espn_event_id){ row.espn_event_id=t.espn_event_id; row.event_id=t.espn_event_id; }
      if(t.start_date){ row.start_date=t.start_date; row.game_start=t.game_start||t.start_date; }
      else if(t.game_start){ row.game_start=t.game_start; }
      return row;
    });
    const payload={
      guild_id:guildId,
      delay_minutes:delay,
      trickle:!!trickle,
      trickle_seconds:30,
      tips:tips
    };
    async function readBody(r){
      const raw=await r.text();
      let j=null;
      try{ j=raw?JSON.parse(raw):null; }catch(e){ j=null; }
      return { j:j, raw:raw };
    }
    function failMsg(r, j, raw){
      if(r && r.status===404){
        return "Bot is updating — Trickle API not live yet. Try again in a minute.";
      }
      const bodyMsg=(j&&(j.message||j.error||j.detail))||"";
      if(bodyMsg) return (r&&r.status?("HTTP "+r.status+": "):"")+bodyMsg;
      if(r&&!r.ok) return "Couldn't schedule batch (HTTP "+r.status+")."+(raw&&raw.length<180?" "+raw:"");
      return "Couldn't schedule batch.";
    }
    async function sequentialFallback(){
      // Trickle OFF + 404: post each tip via legacy /api/queue-tip with same delay.
      let ok=0, lastErr="";
      for(let i=0;i<tips.length;i++){
        prog.set(10+Math.round(80*i/Math.max(1,tips.length)),
                 "Posting tip "+(i+1)+" of "+tips.length+"…");
        const t=tips[i];
        const tipRequestId=batchRequestId+"-"+i;
        const one={
          guild_id:guildId, legs:t.legs, odds:t.odds, units:t.units, bookmaker:t.bookmaker,
          game_name:t.game_name, sport:t.sport, delay_minutes:delay, image_b64:t.image_b64||"",
          client_request_id:tipRequestId
        };
        if(t.league) one.league=t.league;
        if(t.espn_event_id){ one.espn_event_id=t.espn_event_id; one.event_id=t.espn_event_id; }
        if(t.start_date){ one.start_date=t.start_date; one.game_start=t.game_start||t.start_date; }
        else if(t.game_start){ one.game_start=t.game_start; }
        if(t.route) one.route=t.route;
        try{
          const r=await api("/api/queue-tip",{
            method:"POST",
            headers:{"Content-Type":"application/json","Idempotency-Key":tipRequestId},
            body:JSON.stringify(one),
            idempotent:true, retries:3,
          });
          const {j,raw}=await readBody(r);
          if(r.ok&&j&&j.ok){ ok++; }
          else{ lastErr=failMsg(r,j,raw); break; }
        }catch(e){
          if(e&&e.unauth)throw e;
          lastErr="Couldn't reach the bot.";
          break;
        }
      }
      return {ok:ok, lastErr:lastErr};
    }
    payload.client_request_id=batchRequestId;
    try{
      // Idempotency-Key makes this safe to retry: TipBot replays the stored
      // response rather than creating a second set of queue rows. Without it a
      // transient `503 db_busy` was a dead end for the tipster.
      const r=await api("/api/queue-tips",{
        method:"POST",
        headers:{"Content-Type":"application/json","Idempotency-Key":batchRequestId},
        body:JSON.stringify(payload),
        idempotent:true, retries:4, onAttempt:prog.onAttempt,
      });
      const {j,raw}=await readBody(r);
      if(r.ok&&j&&j.ok){
        prog.set(85,"TipBot accepted the batch…");
        // Partial: some tips could not be written. Keep exactly those in the
        // tray so a resubmit sends the shortfall and nothing double-posts.
        const queuedN=(j.queued!=null)?j.queued:nTips;
        if(j.busy||(j.errors&&j.errors.length)){
          const failedIdx=[];
          (j.errors||[]).forEach(function(e){
            const m=/^tip\s+(\d+)\s*:/.exec(String(e||""));
            if(m) failedIdx.push(parseInt(m[1],10));
          });
          if(failedIdx.length){
            const keep=failedIdx.map(function(i){ return BATCH.tips[i]; }).filter(Boolean);
            if(keep.length===failedIdx.length){
              const note="Queued "+queuedN+"/"+nTips+". "+keep.length+" tip"+(keep.length===1?"":"s")
                        +" couldn't be written (database busy) and "+(keep.length===1?"is":"are")
                        +" still in the tray — press Schedule again.";
              // Close the bar BEFORE re-rendering: renderBatchConfirm() rebuilds
              // the panel, detaching #batchprog and #scherr.
              prog.fail(note);
              BATCH.tips=keep;
              renderBatchConfirm();
              const fresh=$("scherr");
              if(fresh) fresh.textContent=note;
              toast(queuedN+" of "+nTips+" scheduled — "+keep.length+" left in the tray");
              loadDetail(guildId);
              return;
            }
          }
          setErr("Queued "+queuedN+"/"+nTips+": "+((j.errors||[]).join("; ")||"some tips failed"));
          loadDetail(guildId);
          return;
        }
        const n=BATCH.tips.length;
        prog.ok(n+" tip"+(n===1?"":"s")+" scheduled");
        clearBatch();
        BUILD.legs=[]; BUILD.image=null;
        clearMultiDraft(guildId);
        if($("tray"))$("tray").hidden=true;
        if(window.NDConfirmPop)NDConfirmPop.show({label:n+" tips scheduled",color:"#2eaf62"});
        toast(n+" tip"+(n===1?"":"s")+" scheduled"+(trickle?" (trickle on)":""));
        loadDetail(guildId);
        return;
      }
      if(r.status===404){
        if(trickle){
          setErr("Bot is updating — Trickle API not live yet. Try again in a minute.");
          unlockBtn();
          return;
        }
        // Fallback: sequential queue-tip (same delay_minutes, no fake stagger).
        setErr("Trickle API not live — falling back to sequential schedule…");
        const fb=await sequentialFallback();
        if(fb.ok===tips.length){
          const n=tips.length;
          prog.ok(n+" tip"+(n===1?"":"s")+" scheduled");
          clearBatch();
          BUILD.legs=[]; BUILD.image=null;
          clearMultiDraft(guildId);
          if($("tray"))$("tray").hidden=true;
          if(window.NDConfirmPop)NDConfirmPop.show({label:n+" tips scheduled",color:"#2eaf62"});
          toast(n+" tip"+(n===1?"":"s")+" scheduled (legacy fallback)");
          loadDetail(guildId);
          return;
        }
        setErr(fb.lastErr||("Bot is updating — Trickle API not live yet. Try again in a minute."+(fb.ok?" ("+fb.ok+"/"+tips.length+" queued)":"")));
        unlockBtn();
        return;
      }
      setErr(failMsg(r,j,raw));
      unlockBtn();
    }catch(e){
      if(e&&e.unauth)return renderLogin("Session expired.");
      setErr("Couldn't reach the bot.");
      unlockBtn();
    }
  }
  // Downscale + JPEG-compress client-side so only a small image ever travels.
  function compressImage(file,maxDim,quality){
    maxDim=maxDim||1600; quality=quality||0.7;
    return new Promise((res,rej)=>{
      const img=new Image(),url=URL.createObjectURL(file);
      img.onload=()=>{ URL.revokeObjectURL(url);
        let w=img.naturalWidth,h=img.naturalHeight; const sc=Math.min(1,maxDim/Math.max(w,h));
        w=Math.max(1,Math.round(w*sc)); h=Math.max(1,Math.round(h*sc));
        const c=document.createElement("canvas"); c.width=w; c.height=h;
        c.getContext("2d").drawImage(img,0,0,w,h);
        try{ res(c.toDataURL("image/jpeg",quality)); }catch(e){ rej(e); } };
      img.onerror=()=>{ URL.revokeObjectURL(url); rej(new Error("bad image")); };
      img.src=url;
    });
  }
  function scheduleTip(){
    const go=$("schedbtn");
    if(go && (go.disabled || go.dataset.busy==="1")) return;
    const odds=parseFloat($("f_odds").value);
    if(!(odds>1)){$("scherr").textContent="Odds must be greater than 1.";return;}
    const st=resolveStakeUnits();
    if(st.error){$("scherr").textContent=st.error;return;}
    const units=st.units;
    $("scherr").textContent="";
    const dollarNote=(BUILD.unitSize>0 && (BUILD.stakeMode||"units")==="dollars")
      ? " ($"+parseFloat($("f_dollars").value)+")" : "";
    const fields=readTipForm();
    if(fields.error){$("scherr").textContent=fields.error;return;}
    if(go){ go.disabled=true; }
    routeBeforePost(BUILD.guildId,[fields]).then(rt=>{
      if(go){ go.disabled=false; }
      if(!rt||rt.cancelled){ return; }
      const chipTxt=(rt.chips&&rt.chips[0])?' <span class="chip">'+esc(rt.chips[0])+'</span>':'';
      NDCountdownConfirm.open({
        title:"Schedule this tip?",
        message:BUILD.legs.length+"-leg "+(BUILD.custom?"custom tip":"multi")+" @ <b>"+odds+"</b> for <b>"+units+"u</b>"+dollarNote+" — posts to Discord."+chipTxt+(rt.note?'<br><span style="color:var(--faint)">'+esc(rt.note)+'</span>':''),
        seconds:5,confirmLabel:"Schedule now",secondaryLabel:"Cancel",accent:"#5b8cff",
        onConfirm:()=>doSchedule(odds,units,rt.routes?rt.routes[0]:null),
      });
    });
  }
  // Sport routing (Phase 1.1): ask TipBot where each tip goes before the confirm step.
  // Routing off / older TipBot → {routes:null} and the post is exactly as before.
  async function routeBeforePost(guildId,tips){
    if(!window.TBRouting) return {routes:null,chips:[]};
    try{ return await TBRouting.beforePost({api:api,guildId:guildId,tips:tips}); }
    catch(e){ if(e&&e.unauth){ renderLogin("Session expired."); return {cancelled:true}; } return {routes:null,chips:[]}; }
  }
  async function doSchedule(odds,units,route){
    const btn=$("schedbtn");
    if(btn){ if(btn.disabled||btn.dataset.busy==="1") return; }
    const prog=SubmitProgress.open({
      btn:btn, anchor:$("scherr"), id:"tipprog",
      busyLabel:"Scheduling…", sendingLabel:"Sending tip to TipBot…",
    });
    const clientRequestId=newClientRequestId();
    const tipFields=readTipForm();
    if(tipFields.error){ $("scherr").textContent=tipFields.error; prog.fail(tipFields.error); return; }
    const payload={guild_id:BUILD.guildId,legs:tipFields.legs,odds:tipFields.odds,units:tipFields.units,bookmaker:tipFields.bookmaker,
      game_name:tipFields.game_name, sport:tipFields.sport,
      delay_minutes:parseInt($("f_delay").value||"0",10),
      image_b64:tipFields.image_b64||"",
      client_request_id:clientRequestId};
    if(tipFields.league) payload.league=tipFields.league;
    if(tipFields.espn_event_id){ payload.espn_event_id=tipFields.espn_event_id; payload.event_id=tipFields.espn_event_id; }
    if(tipFields.start_date){ payload.start_date=tipFields.start_date; payload.game_start=tipFields.game_start||tipFields.start_date; }
    else if(tipFields.game_start){ payload.game_start=tipFields.game_start; }
    if(route) payload.route=route;
    try{
      // Safe to retry: the Idempotency-Key replays instead of double-posting.
      const r=await api("/api/queue-tip",{
        method:"POST",
        headers:{"Content-Type":"application/json","Idempotency-Key":clientRequestId},
        body:JSON.stringify(payload),
        idempotent:true, retries:4, onAttempt:prog.onAttempt,
      });
      let j=null; try{ j=await r.json(); }catch(e){ j=null; }
      if(r.ok&&j&&j.ok){
        prog.ok("Tip scheduled");
        if(window.NDConfirmPop)NDConfirmPop.show({label:"Tip scheduled",color:"#2eaf62"});
        BUILD.legs=[]; BUILD.image=null; clearMultiDraft(BUILD.guildId); $("tray").hidden=true; renderBatchTray(); loadDetail(BUILD.guildId);
      }
      else{
        const m=(j&&(j.message||j.error))||"Couldn't schedule.";
        $("scherr").textContent=m; prog.fail(m);
      }
    }catch(e){ if(e.unauth)return renderLogin("Session expired."); $("scherr").textContent="Couldn't reach the bot."; prog.fail("Couldn't reach the bot."); }
  }
  TD.loaded.builder=true;
