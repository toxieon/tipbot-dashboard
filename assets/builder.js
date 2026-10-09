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
    // (h1 can be nested in a .dhead, so insert relative to h1 itself, not to box.)
    if(h1) h1.insertAdjacentElement("afterend", banner);
    else box.insertBefore(banner, box.firstChild);
    const cont=$("draft-continue"), disc=$("draft-discard");
    if(cont)cont.onclick=async()=>{ banner.remove(); await resumeMultiDraft(d, games); };
    if(disc)disc.onclick=()=>{ clearMultiDraft(guildId); banner.remove(); toast("Draft discarded","success"); };
  }

  /* ---------- BUILDER ---------- */
  
  async function openBuilder(guildId, name) {
    navNote("#/s/"+encodeURIComponent(guildId)+"/build", ()=>openBuilder(guildId,name));
    return openSportsBuilder(guildId, name, true);
  }

  function builderBackToServer(){
    const gid=BUILD&&BUILD.guildId;
    $("tray").hidden=true;
    renderBatchTray();
    if(gid!=null) loadDetail(gid);
  }

  async function openSportsBuilder(guildId,name,skipNav){
    if(!skipNav) navNote("#/s/"+encodeURIComponent(guildId)+"/build/sports", ()=>openSportsBuilder(guildId,name));
    clearDetailTimers();clearLiveTimer();clearGamesTimer();
    try{ stopRacingCountdown(); stopRacingHero(); }catch(e){}
    if(BATCH.guildId && String(BATCH.guildId)!==String(guildId)){ BATCH={guildId:null,tips:[]}; }
    // Keep legs already in the tray for this server (same rule as openBuilder).
    const keepLegs = BUILD && String(BUILD.guildId) === String(guildId) && BUILD.legs && BUILD.legs.length > 0;
    if(!keepLegs){
      BUILD={guildId,serverName:name,game:null,tab:"Disposals",legs:[],search:"",sort:"number",collapsed:{},compFilter:"All",unitSize:guildUnitSize(guildId),autoLines:false};
    }else{ BUILD.game=null; }
    panel("builder");renderTray();renderBatchTray();
    $("builder").innerHTML='<div class="back" id="bx">← Back to '+esc(name||"server")+'</div><h1 style="margin:0 0 16px">Build a tip</h1>'+NDSkeleton.grid(6,{cols:3,tile:"92px"});
    $("bx").onclick=builderBackToServer;
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
    navNote("#/s/"+encodeURIComponent(guildId)+"/build/"+encodeURIComponent(league), ()=>openEspnBuilder(guildId,name,league));
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
      +'<div class="dhead"><h1 style="margin:0">Build a tip · '+esc(sportLabel(label))+'</h1><div style="display:flex;gap:8px"><button class="ghost" id="espnbackafl">'+esc(sportLabel("AFL"))+'</button><button class="ghost" id="espnrefresh">↻ Refresh</button></div></div>'
      +'<p style="color:var(--muted);margin:0 0 12px">'+(league==="nfl"?"Pick an NFL game, then add player props (yards / TDs / completions / INTs / receptions).":"Pick a "+label+" game, then add player props (points / rebounds / assists / threes / PRA) or free-text selections.")+'</p>';
    html+='<div style="display:flex;gap:8px;margin:0 0 14px;flex-wrap:wrap;align-items:center">'
      +'<button class="compchip" id="espnaflchip">'+esc(sportLabel("AFL"))+'</button>'
      +ESPN_SPORTS.map(s=>'<button class="compchip espnsport'+(s.league===league?" on":"")+'" data-league="'+esc(s.league)+'">'+esc(sportLabel(s.k))+'</button>').join("")
      +SPORT_STUBS.map(s=>'<button class="compchip sportstub" data-s="'+esc(s.k)+'">'+esc(sportLabel(s.k))+'</button>').join("")
      +'<button class="compchip sportstub" data-s="">'+esc(sportLabel("Other"))+'</button></div>';
    if(league==="nfl"){
      const weeks=BUILD.espnWeeks||[];
      html+='<div style="display:flex;gap:8px;align-items:center;margin:0 0 14px;flex-wrap:wrap">'
        +'<button class="ghost" id="espnprevw" '+(BUILD.espnWeekIndex<=0?"disabled":"")+'>‹</button>'
        +'<select id="espnweek" style="background:var(--card2);border:1px solid var(--line);color:var(--txt);border-radius:var(--r-md);padding:10px 12px;font:inherit;min-width:min(100%,280px)">'
        +(weeks.length?weeks.map((w,i)=>'<option value="'+i+'">'+esc((BUILD.espnSeasonYear?BUILD.espnSeasonYear+" · ":"")+(w.label||("Week "+w.value))+(w.phase&&String(w.type)!=="2"?" · "+w.phase:""))+'</option>').join(""):'<option>Loading weeks…</option>')
        +'</select>'
        +'<button class="ghost" id="espnnextw" '+(BUILD.espnWeekIndex>=weeks.length-1?"disabled":"")+'>›</button></div>';
    }else{
      html+='<div style="display:flex;gap:8px;align-items:center;margin:0 0 14px;flex-wrap:wrap">'
        +'<button class="ghost" id="espnprevd">‹</button>'
        +'<input type="date" id="espndate" value="'+esc(BUILD.espnDate||"")+'" style="background:var(--card2);border:1px solid var(--line);color:var(--txt);border-radius:var(--r-md);padding:10px 12px;font:inherit">'
        +'<button class="ghost" id="espnnextd">›</button>'
        +'<button class="ghost" id="espntoday">Today (ET)</button>'
        +'<span style="color:var(--faint);font-size:var(--t-foot)">Schedule date · US Eastern</span></div>';
    }
    if(BUILD.espnErr){ html+='<div class="panel"><div class="empty">'+esc(BUILD.espnErr)+'</div></div>'; }
    else if(!(BUILD.espnEvents||[]).length){ html+='<div class="panel"><div class="empty">No '+esc(label)+' games in this view.</div></div>'; }
    else{
      html+='<div class="gcards">'+BUILD.espnEvents.map((ev,i)=>{
        const st=(ev.status&&ev.status.state)||"";
        const live=st==="in"?' <span style="color:#e5484d;font-weight:800;font-size:var(--t-cap)">● LIVE</span>':'';
        const final=st==="post"?' <span style="color:var(--faint);font-size:var(--t-cap)">FINAL</span>':'';
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
    $("bx").onclick=()=>{$("tray").hidden=true;renderBatchTray();openSportsBuilder(BUILD.guildId, BUILD.serverName);};
    const ba=$("espnbackafl"); if(ba)ba.onclick=()=>openSportsBuilder(BUILD.guildId,BUILD.serverName);
    const ac=$("espnaflchip"); if(ac)ac.onclick=()=>openSportsBuilder(BUILD.guildId,BUILD.serverName);
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
    navNote("#/s/"+encodeURIComponent(BUILD.guildId)+"/build/"+encodeURIComponent(BUILD.espnLeague||"espn")+"/"+encodeURIComponent((ev&&ev.id)||""), ()=>openEspnEvent(ev));
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
      +'<div style="color:var(--faint);font-size:var(--t-foot)">Tip payload includes <code>espn_event_id</code> '+esc(String(ev.id||""))+'.</div>'
      +'</div>';
    $("bg").onclick=()=>navBack(()=>{ BUILD.custom=false; BUILD.espnEvent=null; BUILD.espnPlayers=[]; BUILD.espnTeams=[]; BUILD.espnErr=""; renderEspnGames(); });
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
      +'<input id="psearch" placeholder="Search players… e.g. '+(bball?'Gilgeous-Alexander, Shai':'Hill, Tyreek')+'" value="'+esc(BUILD.search||"")+'" style="background:var(--bg2);border:1px solid var(--line);color:var(--txt);border-radius:var(--r-md);padding:10px 12px;font:inherit;flex:1">'
      +'</div>';
    if(BUILD.espnErr) html+='<div class="empty" style="margin-bottom:12px">'+esc(BUILD.espnErr)+'</div>';
    html+='<div id="players"></div>';
    $("builder").innerHTML=html;
    $("bg").onclick=()=>navBack(()=>{ BUILD.espnEvent=null; BUILD.espnPlayers=[]; BUILD.espnTeams=[]; BUILD.espnErr=""; renderEspnGames(); });
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
          +'<div class="linectl"><input type="range" min="0" max="'+mx+'" step="0.5" value="'+def+'" id="'+rid+'_s"><input type="number" id="'+rid+'_v" min="0" step="0.5" value="'+def+'" style="width:72px;background:var(--bg2);border:1px solid var(--line);color:var(--txt);border-radius:var(--r-sm);padding:6px 8px;font:inherit;font-weight:800;font-size:var(--t-h3);text-align:center"></div>'
          +'<div class="prow-actions"><div class="ou" id="'+rid+'_ou"><button data-s="Over" class="on">Over</button><button data-s="Under">Under</button></div>'
          +'<input id="'+rid+'_odds" type="number" step="0.01" min="1.01" placeholder="Odds" title="Leg odds (optional)" style="width:72px;background:var(--bg2);border:1px solid var(--line);color:var(--txt);border-radius:var(--r-sm);padding:6px 8px;font:inherit">'
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
    navNote("#/s/"+encodeURIComponent(guildId)+"/build/custom", ()=>openCustom(guildId,name,presetSport));
    clearDetailTimers();clearLiveTimer();clearGamesTimer();
    try{ stopRacingCountdown(); stopRacingHero(); }catch(e){}
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
      +'<div class="field"><label>Start day (optional)</label><input id="c_start" type="date" value="'+esc(BUILD.customStartDay||"")+'"><div style="color:var(--faint);font-size:var(--t-foot);margin-top:6px">When the event tips off — sent as <code>start_date</code> when TipBot supports it.</div></div>'
      +'<div class="field"><label>Add a selection</label><div style="display:flex;gap:8px"><input id="c_leg" placeholder="e.g. LeBron James 25+ points" style="flex:1"><button class="btn sm" id="c_add">Add</button></div><div style="color:var(--faint);font-size:var(--t-foot);margin-top:6px">Add one line per leg. They collect in the tray below — then hit Review.</div></div>'
      +'</div>';
    $("bx").onclick=builderBackToServer;
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
    let html='<div class="back" id="bx">← Back to '+esc(BUILD.serverName||"server")+'</div>'
      +'<div class="dhead"><h1 style="margin:0">Build a tip</h1><div style="display:flex;gap:8px"><button class="ghost" id="customgames">＋ Custom (non-AFL)</button><button class="ghost" id="refreshgames">↻ Refresh</button></div></div>'
      +'<p style="color:var(--muted);margin:0 0 12px">Upcoming games (next 7 days) · pick one · live games show here too · or add a Custom tip for any other sport</p>';
    // Sport switcher: AFL live · NFL/NBA/WNBA via TipBot ESPN · stubs → custom.
    html+='<div style="display:flex;gap:8px;margin:0 0 14px;flex-wrap:wrap;align-items:center">'
      +'<span class="compchip on" title="Live AFL/AFLW data">'+esc(sportLabel("AFL"))+' <span style="opacity:.7;font-size:var(--t-cap)">live</span></span>'
      +ESPN_SPORTS.map(s=>'<button class="compchip espnsport" data-league="'+esc(s.league)+'" title="'+esc(s.hint)+'">'+esc(sportLabel(s.k))+' <span style="opacity:.7;font-size:var(--t-cap)">ESPN</span></button>').join("")
      +SPORT_STUBS.map(s=>'<button class="compchip sportstub" data-s="'+esc(s.k)+'" title="'+esc(s.hint)+' — custom tip">'+esc(sportLabel(s.k))+'</button>').join("")
      +'<button class="compchip sportstub" data-s="" title="Any other sport" style="opacity:.85">'+esc(sportLabel("Other"))+'</button>'
      +'<button type="button" class="compchip" id="build-racing-switch" title="Gallops and harness">Racing</button></div>';
    if(hasMulti){
      const chip=(v,l)=>'<button class="compchip'+(BUILD.compFilter===v?" on":"")+'" data-c="'+esc(v)+'">'+esc(l)+'</button>';
      html+='<div class="compfilter" style="display:flex;gap:8px;margin:0 0 16px;flex-wrap:wrap">'
        +chip("All","All")+comps.map(c=>chip(c,sportLabel(c))).join("")+'</div>';
    }
    const shown=games.filter(g=>BUILD.compFilter==="All"||gameComp(g)===BUILD.compFilter);
    if(!games.length){
      const err=(STATE.playerMeta&&STATE.playerMeta.error)||"";
      html+='<div class="panel"><div class="empty">'+(err?("Couldn't load games — "+err+". If the bot was just redeployed, give it a minute and refresh."):"No games in the next 7 days (off-season or none scheduled). Live games show here too.")+'</div></div>';
    }
    else if(!shown.length){ html+='<div class="panel"><div class="empty">No '+BUILD.compFilter+' games in the next 7 days.</div></div>'; }
    else{ html+='<div class="gcards">'+shown.map((g,i)=>{
      const liveBadge=g.live?' <span style="color:#e5484d;font-weight:800;font-size:var(--t-cap);letter-spacing:.03em">● LIVE</span>':'';
      const compName=gameComp(g);
      const compBadge=hasMulti?' <span class="compbadge'+(compName==="AFLW"?" aflw":"")+'">'+esc(sportLabel(compName))+'</span>':'';
      const ht=g.hteam, at=g.ateam;
      return '<div class="gcard" data-i="'+i+'"'+(g.live?' style="border-color:#e5484d;box-shadow:0 0 0 1px rgba(229,72,77,.25)"':'')+'>'
        +'<div class="rd">'+(g.roundname||"")+' · '+fmtGameWhen(g)+liveBadge+compBadge+'</div>'
        +'<div class="espn-teamrow">'+aflLogoHtml(ht)+'<span class="espn-tname">'+esc(teamName(ht)||"Home")+'<small>Home</small></span></div>'
        +'<div class="espn-teamrow">'+aflLogoHtml(at)+'<span class="espn-tname">'+esc(teamName(at)||"Away")+'</span></div>'
        +'<div class="vn">'+(g.venue||"")+'</div></div>';
    }).join("")+'</div>'; }
    $("builder").innerHTML=html;
    $("bx").onclick=builderBackToServer;
    const rs=$("build-racing-switch"); if(rs) rs.onclick=()=>openRacingBuilder(BUILD.guildId, BUILD.serverName);
    const rg=$("refreshgames"); if(rg)rg.onclick=()=>openSportsBuilder(BUILD.guildId,BUILD.serverName);
    const cg=$("customgames"); if(cg)cg.onclick=()=>openCustom(BUILD.guildId,BUILD.serverName);
    $("builder").querySelectorAll(".compchip[data-c]").forEach(b=>b.onclick=()=>{BUILD.compFilter=b.dataset.c;renderGames(games);});
    $("builder").querySelectorAll(".sportstub").forEach(b=>b.onclick=()=>openCustom(BUILD.guildId,BUILD.serverName,b.dataset.s));
    $("builder").querySelectorAll(".espnsport").forEach(b=>b.onclick=()=>openEspnBuilder(BUILD.guildId,BUILD.serverName,b.dataset.league));
    $("builder").querySelectorAll(".gcard").forEach(c=>c.onclick=()=>openGame(shown[+c.dataset.i]));
  }

  async function openGame(g){
    navNote("#/s/"+encodeURIComponent(BUILD.guildId)+"/build/g/"+encodeURIComponent((g&&(g.id||g.gameid))||""), ()=>openGame(g));
    clearLiveTimer();clearGamesTimer();
    BUILD.game=g; BUILD.tab="Disposals"; BUILD.live=null;
    BUILD.compareSel=null; BUILD.compareCache=null; BUILD.compareSeq=(BUILD.compareSeq||0)+1;
    saveMultiDraft();
    // 6.1c: the games list has no players; fetch only this game's (cached per game).
    if(TBLight.needsRoster(g)){
      $("builder").innerHTML='<div class="back" id="bg">← Games</div><div class="panel"><div class="empty">Loading players…</div></div>';
      const bg=$("bg"); if(bg) bg.onclick=()=>openSportsBuilder(BUILD.guildId,BUILD.serverName);
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
    if(BUILD.compareSel&&BUILD.compareSel.stat!==BUILD.tab){ BUILD.compareSel=null; BUILD.compareCache=null; }
    const tabs=Object.keys(STATS).map(t=>'<div class="tab '+(t===BUILD.tab?"active":"")+'" data-t="'+t+'">'+t+'</div>').join("");
    const mtabs=Object.keys(MARKETS).map(t=>'<div class="tab mkt '+(t===BUILD.tab?"active":"")+'" data-t="'+t+'">'+t+'</div>').join("");
    const isLive=g.aflMatchId&&Number(g.complete)>0&&Number(g.complete)<100;
    $("builder").innerHTML='<div class="back" id="bg">← Games</div><div class="dhead"><h1 style="margin:0;display:flex;align-items:center;gap:10px;flex-wrap:wrap">'+aflLogoHtml(g.hteam)+'<span>'+esc(teamName(g.hteam))+'</span><span style="color:var(--muted);font-weight:600">v</span>'+aflLogoHtml(g.ateam)+'<span>'+esc(teamName(g.ateam))+'</span></h1><div style="display:flex;align-items:center;gap:10px"><span class="plan">'+(g.roundname||"")+'</span>'+(isLive?'<button class="ghost" id="refreshlive">↻ Live</button>':"")+'</div></div>'
      +(gameNeedsAssume(g)?('<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin:10px 0 4px;padding:10px 12px;border:1px solid var(--warn,#e0a04a);border-radius:var(--r-md);background:color-mix(in srgb,var(--warn,#e0a04a) 8%,transparent)">'
        +'<div><div style="color:var(--warn,#e0a04a);font-weight:700;font-size:var(--t-sub)">△ Assumption mode</div><div style="color:var(--muted);font-size:var(--t-foot);margin-top:2px">A side isn\'t named yet. Turn on to build off the full squad — legs on players who don\'t get named auto-void when the team drops.</div></div>'
        +'<button id="assumetoggle" class="toggle '+(BUILD.assume?"on":"")+'" style="flex:none"></button></div>'):"")
      +'<div class="tabs">'+tabs+'</div>'
      +'<div style="color:var(--faint);font-size:var(--t-cap);text-transform:uppercase;letter-spacing:.05em;margin:2px 0 6px">First / last markets</div>'
      +'<div class="tabs">'+mtabs+'</div>'
      +'<div class="builder-tools">'
      +'<input id="psearch" placeholder="Search players… e.g. Dangerfield Cameron" value="'+esc(BUILD.search||"")+'" style="background:var(--bg2);border:1px solid var(--line);color:var(--txt);border-radius:var(--r-md);padding:10px 12px;font:inherit">'
      +'<select id="psort" style="background:var(--card2);border:1px solid var(--line);color:var(--txt);border-radius:var(--r-md);padding:10px 12px;font:inherit;cursor:pointer;min-width:0"><option value="number">Sort: Number</option><option value="name">Sort: Name (A–Z)</option></select>'
      +'</div>'
      +'<div class="auto-bar" id="auto-bar">'
      +'<span class="auto-lab">Auto</span>'
      +'<button type="button" class="toggle'+(BUILD.autoLines?" on":"")+'" id="autolines-toggle" aria-pressed="'+(BUILD.autoLines?"true":"false")+'" title="Seed lines from TipBot book cache"></button>'
      +'<span class="auto-hint">Book line + ~under from TipBot cache (Sportsbet first). Manual O/U still works.</span>'
      +'<span class="auto-status" id="auto-status"></span>'
      +(STATE.role==="owner"&&!STATE.viewAs?'<button type="button" class="ghost" id="autolines-refresh" title="Refresh TipBot cache (owner)" style="padding:6px 10px;font-size:var(--t-foot)">↻</button>':"")
      +'</div>'
      +(!MARKETS[BUILD.tab]?'<div class="panel" id="compare-panel" data-sec="builder-compare"><h3>Compare</h3><div id="compare-body"></div></div>':'')
      +'<div id="players"></div>';
    $("bg").onclick=()=>openSportsBuilder(BUILD.guildId,BUILD.serverName);
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
    if($("compare-panel")){
      wirePanelCollapse($("builder"));
      paintComparePanel();
    }
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
    if(L&&L.available){ html+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;font-size:var(--t-foot);color:var(--muted)"><span style="width:8px;height:8px;border-radius:50%;background:#e5484d;box-shadow:0 0 0 3px rgba(229,72,77,.2);display:inline-block"></span> LIVE · '+(L.phase&&L.phase.label||"in progress")+' — rows tint by projected pace vs your line</div>'; }
    sides.forEach(team=>{
      const nm=teamName(team),slug=nm.replace(/\W/g,"");
      const status=((team&&team.selectionStatus)||"").replace(/_/g," ").toLowerCase();
      if(!isNamed(team)&&!isAssumed(team)){
        html+='<div class="teamhdr">'+nm+' <span style="background:#5a4a1f;color:#f0d78a;font-size:var(--t-cap);font-weight:800;letter-spacing:.03em;padding:2px 8px;border-radius:999px;vertical-align:middle">NOT NAMED</span></div>'
          +'<div class="empty" style="margin:0 0 14px">Team not announced yet — players appear once the side is named (usually 1\u20132 days before the game)'+(status?" \u00b7 "+status:"")+'.</div>';
        return;
      }
      const assumed=isAssumed(team);
      const list=displayList(team);
      const collapsed=!!BUILD.collapsed[slug];
      const sideBadge=assumed
        ? '<span style="background:#5a4a1f;color:#f0d78a;font-size:var(--t-cap);font-weight:800;letter-spacing:.03em;padding:2px 8px;border-radius:999px;vertical-align:middle">\u25b3 ASSUMED \u00b7 FULL SQUAD</span>'
        : '<span style="background:#1f6f43;color:#fff;font-size:var(--t-cap);font-weight:800;letter-spacing:.03em;padding:2px 8px;border-radius:999px;vertical-align:middle">NAMED SIDE</span>';
      html+='<div class="thdr" data-slug="'+slug+'" role="button" tabindex="0" aria-expanded="'+(!collapsed)+'" aria-controls="tp_'+slug+'"><span class="tcaret" aria-hidden="true">'+(collapsed?"\u25b8":"\u25be")+'</span>'+nm+' '+sideBadge+' <small style="color:var(--muted);font-weight:400">\u00b7 '+list.length+' player'+(list.length===1?"":"s")+(status?" \u00b7 "+status:"")+'</small></div>';
      html+='<div class="teamplayers" id="tp_'+slug+'"'+(collapsed?' hidden':'')+'>';
      const ins=(team&&team.ins)||[],outs=(team&&team.outs)||[];
      if(ins.length||outs.length){
        html+='<div style="display:flex;gap:16px;flex-wrap:wrap;margin:-2px 0 12px;font-size:var(--t-foot);line-height:1.5">';
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
        const cmp=isMarket?'':'<button type="button" class="compare-btn" data-player="'+esc(p.name)+'">Compare</button>';
        const cmpOn=!isMarket&&BUILD.compareSel&&BUILD.compareSel.player===p.name&&BUILD.compareSel.stat===BUILD.tab;
        if(isMarket){
          html+='<div class="prow"><div class="pnum">'+guernsey(p.number,nm)+'</div>'+nameCell
            +'<div class="prow-actions" style="margin-left:auto">'+cmp+'<button class="addbtn" id="'+rid+'_a">Add</button></div></div>';
          return;
        }
        const step=(BUILD.autoLines || (rowDef!=null && Math.abs(rowDef-Math.round(rowDef))>1e-9))?"0.5":"1";
        const rangeMax=Math.max(mx, Math.ceil(rowDef||0)+5);
        const autoMeta=(BUILD.autoLines?autoPriceHtml(hit):"");
        html+='<div class="prow'+(cmpOn?' compare-on':'')+'" data-player="'+esc(p.name)+'"><div class="pnum">'+guernsey(p.number,nm)+'</div>'+nameCell
          +'<div class="linectl-wrap"><div class="linectl"><input type="range" min="0" max="'+rangeMax+'" step="'+step+'" value="'+rowDef+'" id="'+rid+'_s"><input type="number" id="'+rid+'_v" min="0" step="'+step+'" value="'+rowDef+'" style="width:64px;background:var(--bg2);border:1px solid var(--line);color:var(--txt);border-radius:var(--r-sm);padding:6px 8px;font:inherit;font-weight:800;font-size:var(--t-h3);text-align:center"></div>'
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
      const cmpBtn=row.querySelector(".compare-btn");
      if(cmpBtn) cmpBtn.onclick=function(){ openPlayerCompare(p.name, curLine(), side); };
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
    try{ TBMotion.bump($("reviewbtn")); TBMotion.tick(); }catch(_){}
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
        +'<div style="color:var(--faint);font-size:var(--t-foot);margin-top:6px">Set a unit size in Settings → General to stake in dollars.</div></div>';
    }
    const mode=BUILD.stakeMode||"units";
    const seg='<div id="stakeseg" style="display:inline-flex;border:1px solid var(--line);border-radius:var(--r-md);overflow:hidden;margin-bottom:8px">'
      +'<button type="button" class="stakemode" data-mode="units">Units</button>'
      +'<button type="button" class="stakemode" data-mode="dollars">Dollars</button></div>';
    return '<div class="field"><label>Stake</label>'+seg
      +'<div id="stake_units_wrap"><input id="f_units" type="number" step="0.5" placeholder="e.g. 1"></div>'
      +'<div id="stake_dollars_wrap"><div style="display:flex;align-items:center;gap:8px">'
      +'<span style="color:var(--muted)">$</span><input id="f_dollars" type="number" step="1" placeholder="e.g. 100" style="flex:1"></div>'
      +'<div id="f_units_prev" style="color:var(--muted);font-size:var(--t-sub);margin-top:6px">= —</div>'
      +'<div style="color:var(--faint);font-size:var(--t-foot);margin-top:2px">Unit size $'+(us%1?us.toFixed(2):us)+' · rounded to 2 dp</div></div></div>';
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
    navNote("#/s/"+encodeURIComponent(BUILD.guildId)+"/build/review", ()=>renderConfirm());
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
      ?'<div style="margin:0 0 12px;padding:10px 12px;border-radius:var(--r-md);border:1px solid rgba(91,140,255,.35);background:rgba(91,140,255,.10);font-size:var(--t-sub);line-height:1.45">'
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
      +'<div style="color:var(--faint);font-size:var(--t-foot);margin-top:10px">One-off uses delay above. Or add several tips to a batch and schedule them together (optional Trickle stagger).</div></div>';
    $("bc").onclick=()=>navBack(()=>{ if(BUILD.espn && BUILD.espnEvent && TBEspnProps.hasProps(BUILD.espnLeague) && !BUILD.custom){renderEspnNflProps();} else if(BUILD.espn && BUILD.espnEvent){renderEspnBasketballPick();} else if(BUILD.espn){renderEspnGames();} else if(BUILD.custom){renderCustom();} else {renderGame();} });
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
      prev.innerHTML='<span style="color:var(--muted);font-size:var(--t-foot)">Compressing…</span>';
      try{ BUILD.image=await compressImage(file);
        prev.innerHTML='<img src="'+BUILD.image+'" style="max-height:120px;border-radius:var(--r-sm);border:1px solid var(--line)"> <span style="color:var(--faint);font-size:var(--t-foot)">attached — the bot posts it with the tip</span>';
      }catch(e){ BUILD.image=null; prev.innerHTML='<span class="err" style="font-size:var(--t-foot)">Couldn\'t read that image.</span>'; }
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
    toast("Added to batch ("+BATCH.tips.length+")","success");
    try{ TBMotion.bump(document.querySelector("#batchtray .batch-label")); TBMotion.tick(); }catch(_){}
    // Keep building the next tip on the same game / custom / ESPN form.
    if(BUILD.espn && BUILD.espnEvent && TBEspnProps.hasProps(BUILD.espnLeague) && !BUILD.custom){ renderEspnNflProps(); }
    else if(BUILD.espn && BUILD.espnEvent){ renderEspnBasketballPick(); }
    else if(BUILD.espn){ renderEspnGames(); }
    else if(BUILD.custom){ BUILD.customEvent=BUILD.customEvent||""; renderCustom(); }
    else if(BUILD.game){ renderGame(); }
    else { openBuilder(BUILD.guildId, BUILD.serverName); }
  }
  function renderBatchConfirm(){
    navNote("#/s/"+encodeURIComponent(BATCH.guildId||BUILD.guildId)+"/batch", ()=>renderBatchConfirm());
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
      ?'<div style="margin:0 0 12px;padding:10px 12px;border-radius:var(--r-md);border:1px solid rgba(91,140,255,.35);background:rgba(91,140,255,.10);font-size:var(--t-sub);line-height:1.45">'
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
      +'<div style="color:var(--faint);font-size:var(--t-foot);margin:12px 0 0">Off → all tips share the same delay. On → tip i posts at base delay + i×30s.</div>'
      +'<div class="sched-actions" style="margin-top:16px"><button class="btn" id="batchgo" type="button">Schedule '+n+' tips →</button></div>'
      +'<div id="scherr" class="err" style="margin-top:10px"></div></div>';
    $("bcb").onclick=()=>navBack(()=>{ renderBatchTray(); if(BUILD.espn && BUILD.espnEvent && TBEspnProps.hasProps(BUILD.espnLeague) && !BUILD.custom){renderEspnNflProps();} else if(BUILD.espn && BUILD.espnEvent){renderEspnBasketballPick();} else if(BUILD.espn){renderEspnGames();} else if(BUILD.custom){renderCustom();} else if(BUILD.game){renderGame();} else {openBuilder(BATCH.guildId||BUILD.guildId,BUILD.serverName);} });
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
      const blocked=scheduleRefusal(j, raw);
      if(blocked) return blocked;
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
              toast(queuedN+" of "+nTips+" scheduled — "+keep.length+" left in the tray","success");
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
        toast(n+" tip"+(n===1?"":"s")+" scheduled"+(trickle?" (trickle on)":""),"success");
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
          toast(n+" tip"+(n===1?"":"s")+" scheduled (legacy fallback)","success");
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
  // TipBot 0.55.1: a handmade game is refused with this sentence.
  function scheduleRefusal(j, raw){
    const exact="Custom games aren't available in this server.";
    const bits=[];
    if(j&&typeof j==="object"){
      if(j.message!=null) bits.push(String(j.message));
      if(j.error!=null) bits.push(String(j.error));
      if(j.detail!=null) bits.push(String(j.detail));
      if(Array.isArray(j.errors)) bits.push(j.errors.map(function(e){ return e==null?"":String(e); }).join("\n"));
    }
    if(raw) bits.push(String(raw));
    return bits.join("\n").indexOf(exact)>=0?exact:"";
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
      let raw=""; let j=null;
      try{ raw=await r.text(); }catch(e){ raw=""; }
      try{ j=raw?JSON.parse(raw):null; }catch(e){ j=null; }
      if(r.ok&&j&&j.ok){
        prog.ok("Tip scheduled");
        if(window.NDConfirmPop)NDConfirmPop.show({label:"Tip scheduled",color:"#2eaf62"});
        BUILD.legs=[]; BUILD.image=null; clearMultiDraft(BUILD.guildId); $("tray").hidden=true; renderBatchTray(); loadDetail(BUILD.guildId);
      }
      else{
        const blocked=scheduleRefusal(j, raw);
        const m=blocked||(j&&(j.message||j.error))||"Couldn't schedule.";
        $("scherr").textContent=m; prog.fail(m);
      }
    }catch(e){ if(e.unauth)return renderLogin("Session expired."); $("scherr").textContent="Couldn't reach the bot."; prog.fail("Couldn't reach the bot."); }
  }
  function compareCacheKey(sel){
    return [sel.player, sel.stat, sel.line, sel.side, sel.game].join("|");
  }
  function compareWhen(data){
    try{
      if(data&&data.scraped_at&&window.TBTime) return TBTime.fmtWhen(data.scraped_at)||"";
    }catch(e){}
    return "";
  }
  function setCompareSum(text){
    const panel=$("compare-panel"); if(!panel) return;
    const hd=panel.querySelector(".panel-hd-main"); if(!hd) return;
    let sm=hd.querySelector(".panel-hd-sum");
    if(!sm){
      sm=document.createElement("span");
      sm.className="panel-hd-sum";
      hd.appendChild(sm);
    }
    sm.textContent=text||"";
  }
  function paintCompareFromView(view){
    const body=$("compare-body"); if(!body||!window.TBCompare) return;
    body.innerHTML=TBCompare.html(view);
    setCompareSum(TBCompare.summary(view));
    wireCompareRows();
  }
  function paintComparePanel(){
    if(!window.TBCompare) return;
    const sel=BUILD.compareSel;
    if(!sel){ paintCompareFromView(TBCompare.prompt()); return; }
    const key=compareCacheKey(sel);
    if(BUILD.compareCache&&BUILD.compareCache.key===key&&BUILD.compareCache.view){
      paintCompareFromView(BUILD.compareCache.view);
      return;
    }
    paintCompareFromView(TBCompare.loading(sel));
  }
  function compareFromSessionLines(sel){
    const g=BUILD.game; if(!g||!window.TBCompare) return null;
    const key=playerLinesCacheKey(BUILD.guildId, g);
    const pack=STATE._playerLinesCache[key];
    if(!pack||!pack.raw) return null;
    const when=compareWhen(pack.raw);
    const view=TBCompare.fromPlayerLines(pack.raw, Object.assign({}, sel, {when:when}));
    if(!view||view.kind!=="prices") return null;
    return view;
  }
  function wireCompareRows(){
    const body=$("compare-body"); if(!body) return;
    body.querySelectorAll(".compare-row").forEach(function(btn){
      btn.onclick=function(){
        const sel=BUILD.compareSel||{};
        applyComparePick({
          player:sel.player, stat:sel.stat, line:+btn.dataset.line,
          side:btn.dataset.side||sel.side||"Over", book:btn.dataset.book,
          price:+btn.dataset.price, game:sel.game,
          game_id:(window.TB&&TB.gameId({game:BUILD.game}))||"",
          ts:Date.now()
        }, {scroll:false});
      };
    });
    const retry=$("compare-retry");
    if(retry) retry.onclick=function(){ fetchPlayerCompare(true); };
  }
  function openPlayerCompare(player, line, side){
    BUILD.compareSel={
      player:player, stat:BUILD.tab, line:line,
      side:side==="Under"?"Under":"Over",
      game:builderGameName(BUILD.game)
    };
    document.querySelectorAll("#players .prow.compare-on").forEach(function(el){ el.classList.remove("compare-on"); });
    const row=[...document.querySelectorAll("#players .prow[data-player]")].find(function(r){ return r.dataset.player===player; });
    if(row) row.classList.add("compare-on");
    const panel=$("compare-panel");
    if(panel&&window.TDSec) TDSec.open(panel);
    setCompareSum(window.TBCompare?TBCompare.summary(TBCompare.loading(BUILD.compareSel)):"");
    try{ if(panel) panel.scrollIntoView({block:"nearest", behavior:"smooth"}); }catch(e){}
    fetchPlayerCompare(false);
  }
  async function fetchPlayerCompare(force){
    const sel=BUILD.compareSel;
    if(!sel||!BUILD.game||!window.TBCompare) return;
    const key=compareCacheKey(sel);
    if(!force&&BUILD.compareCache&&BUILD.compareCache.key===key&&BUILD.compareCache.view){
      paintCompareFromView(BUILD.compareCache.view);
      return;
    }
    const seq=(BUILD.compareSeq=(BUILD.compareSeq||0)+1);
    paintCompareFromView(TBCompare.loading(sel));
    let view=null;
    try{
      const q=new URLSearchParams();
      q.set("game", builderGameName(BUILD.game));
      q.set("player", sel.player);
      q.set("stat", sel.stat);
      if(sel.line!=null&&sel.line!=="") q.set("line", String(sel.line));
      if(BUILD.guildId) q.set("guild_id", String(BUILD.guildId));
      const r=await api("/api/compare?"+q.toString(), {timeoutMs:20000, retries:1});
      if(BUILD.compareSeq!==seq) return;
      let data=null;
      try{ data=await r.json(); }catch(e){ data=null; }
      const picked=Object.assign({}, sel, {when:compareWhen(data)});
      if(r.ok){
        view=TBCompare.fromCompare(data, picked)||compareFromSessionLines(sel)||TBCompare.empty(picked);
      }else{
        view=compareFromSessionLines(sel)||((r.status===404||r.status===501)?TBCompare.empty(picked):TBCompare.error(picked));
      }
    }catch(e){
      if(e&&e.unauth) return renderLogin("Session expired.");
      if(BUILD.compareSeq!==seq) return;
      view=compareFromSessionLines(sel)||TBCompare.error(sel);
    }
    if(BUILD.compareSeq!==seq) return;
    if(!BUILD.compareSel||compareCacheKey(BUILD.compareSel)!==key) return;
    BUILD.compareCache={key:key, view:view};
    paintCompareFromView(view);
  }

  const RACING_HERO_HTML = '  <section class="hero" aria-label="Race 8 preview animation" role="img">\n    <div class="glow"></div>\n    <div class="eyebrow"><span><b>R8</b> · 1200m · Good 4</span><span>Kensington Stakes</span></div>\n    <div class="rail"><div class="strip"></div></div>\n    <div class="marker"><div><span>400</span><i></i></div></div>\n    <div class="turf"><div class="strip"></div></div>\n    <div class="speed"><i></i><i></i><i></i><i></i></div>\n    <div class="shadow"><i></i></div>\n    <div class="horse"><div class="win"><div class="sprite"><svg viewBox="-60 -14 2760 300" preserveAspectRatio="xMinYMin meet" aria-hidden="true"><defs><linearGradient id="coat" x1="0" y1="20" x2="0" y2="280" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="var(--horse-top)"/><stop offset="1" stop-color="var(--horse-bot)"/></linearGradient></defs><g transform="translate(0 0)"><g class="pose" data-pose="1" transform="translate(0 -9) rotate(-1.5 200 110)"><g class="h-far"><path d="M108.2 134.4L127.7 152.9A16 16 0 0 0 152 132.5L137.2 110.2A19 19 0 0 0 108.2 134.4Z"/><path d="M123.2 145.3L137.7 202.9A7.8 7.8 0 0 0 153 201.2L154.7 141.8A16 16 0 0 0 123.2 145.3Z"/><path d="M151.2 204.4L154.9 197.7A4.4 4.4 0 0 0 149.2 191.6L142.3 194.9A6.8 6.8 0 0 0 151.2 204.4Z"/><path d="M140.2 205.3L176.3 248A5.4 5.4 0 0 0 184.7 241.2L150.5 197A6.6 6.6 0 0 0 140.2 205.3Z"/><path d="M173.6 244.5a6.9 6.9 0 1 0 13.8 0a6.9 6.9 0 1 0 -13.8 0Z"/><path d="M175.1 246.1L180.3 263.4A4.6 4.6 0 0 0 189.2 261.2L186 243.5A5.6 5.6 0 0 0 175.1 246.1Z"/><path d="M189.7 260.8L193.8 270.1L181.7 270.2L180.2 263.1Z"/><path d="M232.9 127.6L223.4 149.7A13 13 0 0 0 246.3 161.9L259.3 141.6A15 15 0 0 0 232.9 127.6Z"/><path d="M225.9 164.5L265.7 203.4A7.2 7.2 0 0 0 276.8 194.4L246.7 147.6A13.5 13.5 0 0 0 225.9 164.5Z"/><path d="M263.3 198.3a7.4 7.4 0 1 0 14.8 0a7.4 7.4 0 1 0 -14.8 0Z"/><path d="M265.7 195L240.4 233.3A5.2 5.2 0 0 0 248.9 239.2L275.6 201.7A6 6 0 0 0 265.7 195Z"/><path d="M237.8 236.2a6.9 6.9 0 1 0 13.8 0a6.9 6.9 0 1 0 -13.8 0Z"/><path d="M245.7 230.7L229 227.7A4.6 4.6 0 0 0 226.8 236.6L243.1 241.6A5.6 5.6 0 0 0 245.7 230.7Z"/><path d="M227 237.3L216.8 236.7L222.3 225.9L229.3 227.8Z"/><path d="M319 32C320 27.3 320.5 22 322 18C323.5 14 326 11.3 328 8C329 12.3 330 16.7 331 21C332 25.3 333 29.7 334 34C329 33.3 324 32.7 319 32Z"/></g><path class="h-body" d="M61 75.6C57.4 73.5 48.3 74.8 41.4 76.2C34.5 77.6 26.7 80.8 19.6 84.1C12.6 87.3 5.7 92.3 -1.1 95.5C-7.8 98.8 -14.3 101.5 -20.8 103.7C-27.3 105.8 -33.6 106.8 -40 108.4C-40 109.2 -43.5 109.6 -40 110.8C-36.5 112 -26.7 115.3 -19.2 115.5C-11.7 115.8 -2.9 114.5 5.1 112.5C13 110.4 21.4 106.3 28.4 103.1C35.3 100 40.9 95.9 46.6 93.4C52.4 91 60.6 91.4 63 88.4C65.4 85.5 64.6 77.6 61 75.6Z"/><g class="h-body"><path d="M60 80C65.3 73.8 76.7 65.2 88 63C99.3 60.8 115 65.2 128 67C141 68.8 154.3 73.8 166 74C177.7 74.2 188.7 70.8 198 68C207.3 65.2 212.7 60.5 222 57C231.3 53.5 243.2 51 254 47C264.8 43 277.8 36.7 287 33C296.2 29.3 304.2 26 309 25C313.8 24 313.7 26.3 316 27C322 28.7 328 28.2 334 32C340 35.8 346.3 43.3 352 50C357.7 56.7 363.3 65.3 368 72C372.7 78.7 377.8 85.5 380 90C382.2 94.5 382.5 96.7 381 99C379.5 101.3 375.2 104.2 371 104C366.8 103.8 361.2 100.7 356 98C350.8 95.3 345 91.8 340 88C335 84.2 331 75.8 326 75C321 74.2 316.2 79 310 83C303.8 87 295.8 93.5 289 99C282.2 104.5 274 109.8 269 116C264 122.2 262.8 130 259 136C255.2 142 253.2 148 246 152C238.8 156 227 159.2 216 160C205 160.8 191.3 158.7 180 157C168.7 155.3 157.3 152.5 148 150C138.7 147.5 132.7 144.7 124 142C115.3 139.3 105.3 137.7 96 134C86.7 130.3 74.7 125.7 68 120C61.3 114.3 57.3 106.7 56 100C54.7 93.3 54.7 86.2 60 80Z"/><path d="M312 30C312.3 25.3 312.2 20.3 313 16C313.8 11.7 315.7 8 317 4C319 8.3 321.2 12.5 323 17C324.8 21.5 326.3 26.3 328 31C322.7 30.7 317.3 30.3 312 30Z"/><path d="M88 121.8L130.8 153.2A17 17 0 0 0 155.2 130.4L126.8 85.6A27 27 0 0 0 88 121.8Z"/><path d="M127 147.6L157.1 198.9A7.8 7.8 0 0 0 171.3 193L156.3 135.4A16 16 0 0 0 127 147.6Z"/><path d="M170.4 196.5L172.1 189A4.4 4.4 0 0 0 164.9 184.8L159.2 189.9A6.8 6.8 0 0 0 170.4 196.5Z"/><path d="M158.9 199.4L196.7 240.7A5.4 5.4 0 0 0 204.8 233.6L168.8 190.7A6.6 6.6 0 0 0 158.9 199.4Z"/><path d="M193.8 237.1a6.9 6.9 0 1 0 13.8 0a6.9 6.9 0 1 0 -13.8 0Z"/><path d="M195.7 239.6L203.7 255.6A4.6 4.6 0 0 0 212.2 252L205.9 235.1A5.6 5.6 0 0 0 195.7 239.6Z"/><path d="M212.6 251.5L218.3 259.9L206.3 262.1L203.6 255.4Z"/><path d="M236.9 107.2L218.7 146.6A14 14 0 0 0 241.6 162.1L271.3 130.4A21 21 0 0 0 236.9 107.2Z"/><path d="M221.4 161.5L258.6 202.8A7.2 7.2 0 0 0 270.3 194.5L243.2 145.9A13.5 13.5 0 0 0 221.4 161.5Z"/><path d="M256.6 198a7.4 7.4 0 1 0 14.8 0a7.4 7.4 0 1 0 -14.8 0Z"/><path d="M260 193.5L225.5 223.9A5.2 5.2 0 0 0 232.2 231.8L267.8 202.7A6 6 0 0 0 260 193.5Z"/><path d="M222 227.8a6.9 6.9 0 1 0 13.8 0a6.9 6.9 0 1 0 -13.8 0Z"/><path d="M232.9 223.8L220.9 211.8A4.6 4.6 0 0 0 214 217.9L224.5 231.3A5.6 5.6 0 0 0 232.9 223.8Z"/><path d="M213.8 218.5L205.8 212.2L216.5 206.5L221.1 212Z"/></g><path class="h-cut" d="M341 51.5c2.6-2.2 6.4-2.2 8.4.4c-2.6 1.6-6 1.6-8.4-.4Z"/><path class="h-cut" d="M371.5 86.5c1.6-1.2 3.6-.6 4.2 1c-1.6.6-3.2.4-4.2-1Z"/><path class="h-tack" d="M332 40C340 60 352 80 362 98M357 89c3 6 7 10 12 12M336 42c4-6 9-9 14-9"/><path class="h-rein" d="M275 55.2C315 73.2 326 87 372 93"/><path class="h-cloth" d="M170 72C176 66.8 197.3 70 204 70C210.7 70 208 71.3 210 72C209.3 81.3 213.7 94.7 208 100C202.3 105.3 182.7 103.8 176 104C169.3 104.2 170.7 102 168 101C168.7 91.3 164 77.2 170 72Z"/><text class="h-num" x="189" y="96" text-anchor="middle">2</text><path class="h-iron" d="M208 99.5L223 99.5M212 99L201 73"/><g class="j-halo"><path d="M242 55.8L197.5 32.5A11.8 11.8 0 0 0 187.9 54.1L235 71.5A8.6 8.6 0 0 0 242 55.8Z"/><path d="M232.4 58.6L223.3 69.3A6.4 6.4 0 0 0 232.5 78.2L242.9 68.9A7.4 7.4 0 0 0 232.4 58.6Z"/><path d="M224.8 67.7L207.2 87.7A5 5 0 0 0 214.4 94.7L233.9 76.7A6.4 6.4 0 0 0 224.8 67.7Z"/><path d="M209.6 95.4L222 99.2A3.4 3.4 0 0 0 224.6 93L213.2 86.9A4.6 4.6 0 0 0 209.6 95.4Z"/><path d="M270.6 55.2a4.4 4.4 0 1 0 8.8 0a4.4 4.4 0 1 0 -8.8 0Z"/><path d="M194.6 55.2L241.1 45.2A14.5 14.5 0 0 0 233.8 17.1L188.3 31A12.5 12.5 0 0 0 194.6 55.2Z"/><path d="M235.4 37.2L249.2 52.1A5.2 5.2 0 0 0 257.2 45.5L245 29.3A6.2 6.2 0 0 0 235.4 37.2Z"/><path d="M251.7 53.4L273.9 59.3A4.2 4.2 0 0 0 276.3 51.2L254.6 43.9A5 5 0 0 0 251.7 53.4Z"/><path d="M247.6 21a9.4 9.4 0 1 0 18.8 0a9.4 9.4 0 1 0 -18.8 0Z"/><path d="M260.3 25L271.6 24.5A2 2 0 0 0 272.7 20.9L263.6 14.2A6 6 0 0 0 260.3 25Z"/></g><g class="j-breeches"><path d="M242 55.8L197.5 32.5A11.8 11.8 0 0 0 187.9 54.1L235 71.5A8.6 8.6 0 0 0 242 55.8Z"/><path d="M232.4 58.6L223.3 69.3A6.4 6.4 0 0 0 232.5 78.2L242.9 68.9A7.4 7.4 0 0 0 232.4 58.6Z"/></g><g class="j-dark"><path d="M224.8 67.7L207.2 87.7A5 5 0 0 0 214.4 94.7L233.9 76.7A6.4 6.4 0 0 0 224.8 67.7Z"/><path d="M209.6 95.4L222 99.2A3.4 3.4 0 0 0 224.6 93L213.2 86.9A4.6 4.6 0 0 0 209.6 95.4Z"/><path d="M270.6 55.2a4.4 4.4 0 1 0 8.8 0a4.4 4.4 0 1 0 -8.8 0Z"/></g><g class="j-silk"><path d="M194.6 55.2L241.1 45.2A14.5 14.5 0 0 0 233.8 17.1L188.3 31A12.5 12.5 0 0 0 194.6 55.2Z"/><path d="M235.4 37.2L249.2 52.1A5.2 5.2 0 0 0 257.2 45.5L245 29.3A6.2 6.2 0 0 0 235.4 37.2Z"/><path d="M251.7 53.4L273.9 59.3A4.2 4.2 0 0 0 276.3 51.2L254.6 43.9A5 5 0 0 0 251.7 53.4Z"/></g><path class="j-face" d="M259.8 32L264.3 32.2A4.2 4.2 0 0 0 266.1 24.1L261.9 22.4A5 5 0 0 0 259.8 32Z"/><g class="j-silk"><path d="M247.6 21a9.4 9.4 0 1 0 18.8 0a9.4 9.4 0 1 0 -18.8 0Z"/><path d="M260.3 25L271.6 24.5A2 2 0 0 0 272.7 20.9L263.6 14.2A6 6 0 0 0 260.3 25Z"/></g><g class="j-silk2"><path d="M202.5 27.9L209 25.1L227.9 46L221.2 47.8Z"/><path d="M257.5 55.1L262.4 56.3A4.7 4.7 0 0 0 265.1 47.3L260.3 45.7A4.9 4.9 0 0 0 257.5 55.1Z"/><path d="M250.5 22.1L262.4 13.8A2.4 2.4 0 0 0 259.7 9.8L247.6 17.8A2.6 2.6 0 0 0 250.5 22.1Z"/></g></g></g><g transform="translate(460 0)"><g class="pose" data-pose="2" transform="translate(0 1.8) rotate(-0.5 200 110)"><g class="h-far"><path d="M105.8 134.7L123.9 154.5A16 16 0 0 0 149.6 135.8L136.4 112.5A19 19 0 0 0 105.8 134.7Z"/><path d="M119.8 144.5L122.7 203.8A7.8 7.8 0 0 0 138.1 205.2L151.3 147.3A16 16 0 0 0 119.8 144.5Z"/><path d="M135.6 207.9L140.6 202.1A4.4 4.4 0 0 0 136.2 195L128.8 196.9A6.8 6.8 0 0 0 135.6 207.9Z"/><path d="M124.7 206.7L152.2 255.5A5.4 5.4 0 0 0 161.7 250.4L136.4 200.5A6.6 6.6 0 0 0 124.7 206.7Z"/><path d="M150 252.8a6.9 6.9 0 1 0 13.8 0a6.9 6.9 0 1 0 -13.8 0Z"/><path d="M152.7 256.6L164.6 270A4.6 4.6 0 0 0 171.8 264.3L161.4 249.6A5.6 5.6 0 0 0 152.7 256.6Z"/><path d="M172.2 263.7L179.8 270.4L168.8 275.6L164.5 269.8Z"/><path d="M237 133.5L234 157.4A13 13 0 0 0 259.3 162.8L266.2 139.7A15 15 0 0 0 237 133.5Z"/><path d="M243.9 172.2L298.2 184.4A7.2 7.2 0 0 0 302.9 170.9L252.7 146.9A13.5 13.5 0 0 0 243.9 172.2Z"/><path d="M292.4 177.4a7.4 7.4 0 1 0 14.8 0a7.4 7.4 0 1 0 -14.8 0Z"/><path d="M293.8 178.2L299.9 223.8A5.2 5.2 0 0 0 310.2 222.6L305.7 176.8A6 6 0 0 0 293.8 178.2Z"/><path d="M298.1 223.1a6.9 6.9 0 1 0 13.8 0a6.9 6.9 0 1 0 -13.8 0Z"/><path d="M299.5 222L296.2 238.7A4.6 4.6 0 0 0 305.1 241L310.3 224.8A5.6 5.6 0 0 0 299.5 222Z"/><path d="M305.8 240.9L305 251L294.3 245.3L296.3 238.4Z"/><path d="M319 32C320 27.3 320.5 22 322 18C323.5 14 326 11.3 328 8C329 12.3 330 16.7 331 21C332 25.3 333 29.7 334 34C329 33.3 324 32.7 319 32Z"/></g><path class="h-body" d="M60.8 75.6C57.2 73.7 48.5 75.6 41.8 76.7C35 77.7 27.7 79.4 20.6 81.9C13.4 84.4 5.8 88 -1.3 91.6C-8.4 95.2 -15.5 99.8 -22 103.6C-28.5 107.3 -34.2 110.6 -40.3 114.1C-40.1 114.8 -43.4 116.2 -39.7 116.3C-35.9 116.5 -25.5 116.2 -18 114.8C-10.5 113.5 -2.3 110.6 5.3 108.4C12.9 106.2 20.6 104.1 27.4 101.7C34.3 99.3 40.3 96.3 46.2 94.1C52.2 91.9 60.8 91.5 63.2 88.4C65.6 85.3 64.4 77.6 60.8 75.6Z"/><g class="h-body"><path d="M60 80C65.3 73.8 76.7 65.2 88 63C99.3 60.8 115 65.2 128 67C141 68.8 154.3 73.8 166 74C177.7 74.2 188.7 70.8 198 68C207.3 65.2 212.7 60.5 222 57C231.3 53.5 243.2 51 254 47C264.8 43 277.8 36.7 287 33C296.2 29.3 304.2 26 309 25C313.8 24 313.7 26.3 316 27C322 28.7 328 28.2 334 32C340 35.8 346.3 43.3 352 50C357.7 56.7 363.3 65.3 368 72C372.7 78.7 377.8 85.5 380 90C382.2 94.5 382.5 96.7 381 99C379.5 101.3 375.2 104.2 371 104C366.8 103.8 361.2 100.7 356 98C350.8 95.3 345 91.8 340 88C335 84.2 331 75.8 326 75C321 74.2 316.2 79 310 83C303.8 87 295.8 93.5 289 99C282.2 104.5 274 109.8 269 116C264 122.2 262.8 130 259 136C255.2 142 253.2 148 246 152C238.8 156 227 159.2 216 160C205 160.8 191.3 158.7 180 157C168.7 155.3 157.3 152.5 148 150C138.7 147.5 132.7 144.7 124 142C115.3 139.3 105.3 137.7 96 134C86.7 130.3 74.7 125.7 68 120C61.3 114.3 57.3 106.7 56 100C54.7 93.3 54.7 86.2 60 80Z"/><path d="M312 30C312.3 25.3 312.2 20.3 313 16C313.8 11.7 315.7 8 317 4C319 8.3 321.2 12.5 323 17C324.8 21.5 326.3 26.3 328 31C322.7 30.7 317.3 30.3 312 30Z"/><path d="M84.8 119L122.1 156.7A17 17 0 0 0 149.8 138L128.8 89.3A27 27 0 0 0 84.8 119Z"/><path d="M120 152.2L147.7 204.8A7.8 7.8 0 0 0 162.3 199.5L149.8 141.4A16 16 0 0 0 120 152.2Z"/><path d="M161.2 203L163.3 195.7A4.4 4.4 0 0 0 156.2 191.1L150.3 195.9A6.8 6.8 0 0 0 161.2 203Z"/><path d="M150.2 206L191.2 244.1A5.4 5.4 0 0 0 198.7 236.3L159.3 196.5A6.6 6.6 0 0 0 150.2 206Z"/><path d="M188 240.1a6.9 6.9 0 1 0 13.8 0a6.9 6.9 0 1 0 -13.8 0Z"/><path d="M190 242.8L198.6 258.6A4.6 4.6 0 0 0 206.9 254.6L200 238A5.6 5.6 0 0 0 190 242.8Z"/><path d="M207.3 254.1L213.2 262.4L201.4 265L198.5 258.4Z"/><path d="M235 115L232.9 158.3A14 14 0 0 0 259.9 164.1L275.6 123.6A21 21 0 0 0 235 115Z"/><path d="M244.9 172.4L300 180.3A7.2 7.2 0 0 0 303.6 166.4L251.7 146.4A13.5 13.5 0 0 0 244.9 172.4Z"/><path d="M293.7 173.1a7.4 7.4 0 1 0 14.8 0a7.4 7.4 0 1 0 -14.8 0Z"/><path d="M295.1 173.5L297.9 219.4A5.2 5.2 0 0 0 308.3 218.9L307 173A6 6 0 0 0 295.1 173.5Z"/><path d="M296.2 219.1a6.9 6.9 0 1 0 13.8 0a6.9 6.9 0 1 0 -13.8 0Z"/><path d="M297.9 216.8L291 232.3A4.6 4.6 0 0 0 299.2 236.5L307.9 222A5.6 5.6 0 0 0 297.9 216.8Z"/><path d="M299.8 236.6L296.8 246.3L287.6 238.3L291.1 232Z"/></g><path class="h-cut" d="M341 51.5c2.6-2.2 6.4-2.2 8.4.4c-2.6 1.6-6 1.6-8.4-.4Z"/><path class="h-cut" d="M371.5 86.5c1.6-1.2 3.6-.6 4.2 1c-1.6.6-3.2.4-4.2-1Z"/><path class="h-tack" d="M332 40C340 60 352 80 362 98M357 89c3 6 7 10 12 12M336 42c4-6 9-9 14-9"/><path class="h-rein" d="M275 55.6C315 73.6 326 87 372 93"/><path class="h-cloth" d="M170 72C176 66.8 197.3 70 204 70C210.7 70 208 71.3 210 72C209.3 81.3 213.7 94.7 208 100C202.3 105.3 182.7 103.8 176 104C169.3 104.2 170.7 102 168 101C168.7 91.3 164 77.2 170 72Z"/><text class="h-num" x="189" y="96" text-anchor="middle">2</text><path class="h-iron" d="M208 99.5L223 99.5M212 99L201 73"/><g class="j-halo"><path d="M241.9 56L197.3 33.5A11.8 11.8 0 0 0 188.1 55.1L235.1 71.8A8.6 8.6 0 0 0 241.9 56Z"/><path d="M232.4 58.9L223.3 69.5A6.4 6.4 0 0 0 232.4 78.5L242.9 69.3A7.4 7.4 0 0 0 232.4 58.9Z"/><path d="M224.8 68L207.3 87.7A5 5 0 0 0 214.4 94.7L233.9 77A6.4 6.4 0 0 0 224.8 68Z"/><path d="M209.6 95.4L222 99.2A3.4 3.4 0 0 0 224.6 93L213.2 86.9A4.6 4.6 0 0 0 209.6 95.4Z"/><path d="M270.6 55.6a4.4 4.4 0 1 0 8.8 0a4.4 4.4 0 1 0 -8.8 0Z"/><path d="M194.6 56.2L241.1 46.2A14.5 14.5 0 0 0 233.8 18.1L188.3 32A12.5 12.5 0 0 0 194.6 56.2Z"/><path d="M235.5 38.2L249.2 52.9A5.2 5.2 0 0 0 257.1 46.1L244.9 30.2A6.2 6.2 0 0 0 235.5 38.2Z"/><path d="M251.8 54.2L274 59.7A4.2 4.2 0 0 0 276.3 51.6L254.5 44.5A5 5 0 0 0 251.8 54.2Z"/><path d="M247.6 22a9.4 9.4 0 1 0 18.8 0a9.4 9.4 0 1 0 -18.8 0Z"/><path d="M260.3 26L271.6 25.5A2 2 0 0 0 272.7 21.9L263.6 15.2A6 6 0 0 0 260.3 26Z"/></g><g class="j-breeches"><path d="M241.9 56L197.3 33.5A11.8 11.8 0 0 0 188.1 55.1L235.1 71.8A8.6 8.6 0 0 0 241.9 56Z"/><path d="M232.4 58.9L223.3 69.5A6.4 6.4 0 0 0 232.4 78.5L242.9 69.3A7.4 7.4 0 0 0 232.4 58.9Z"/></g><g class="j-dark"><path d="M224.8 68L207.3 87.7A5 5 0 0 0 214.4 94.7L233.9 77A6.4 6.4 0 0 0 224.8 68Z"/><path d="M209.6 95.4L222 99.2A3.4 3.4 0 0 0 224.6 93L213.2 86.9A4.6 4.6 0 0 0 209.6 95.4Z"/><path d="M270.6 55.6a4.4 4.4 0 1 0 8.8 0a4.4 4.4 0 1 0 -8.8 0Z"/></g><g class="j-silk"><path d="M194.6 56.2L241.1 46.2A14.5 14.5 0 0 0 233.8 18.1L188.3 32A12.5 12.5 0 0 0 194.6 56.2Z"/><path d="M235.5 38.2L249.2 52.9A5.2 5.2 0 0 0 257.1 46.1L244.9 30.2A6.2 6.2 0 0 0 235.5 38.2Z"/><path d="M251.8 54.2L274 59.7A4.2 4.2 0 0 0 276.3 51.6L254.5 44.5A5 5 0 0 0 251.8 54.2Z"/></g><path class="j-face" d="M259.8 33L264.3 33.2A4.2 4.2 0 0 0 266.1 25.1L261.9 23.4A5 5 0 0 0 259.8 33Z"/><g class="j-silk"><path d="M247.6 22a9.4 9.4 0 1 0 18.8 0a9.4 9.4 0 1 0 -18.8 0Z"/><path d="M260.3 26L271.6 25.5A2 2 0 0 0 272.7 21.9L263.6 15.2A6 6 0 0 0 260.3 26Z"/></g><g class="j-silk2"><path d="M202.5 28.9L209 26.1L227.9 47L221.2 48.8Z"/><path d="M257.6 55.7L262.5 56.9A4.7 4.7 0 0 0 265 47.9L260.3 46.3A4.9 4.9 0 0 0 257.6 55.7Z"/><path d="M250.5 23.1L262.4 14.8A2.4 2.4 0 0 0 259.7 10.8L247.6 18.8A2.6 2.6 0 0 0 250.5 23.1Z"/></g></g></g><g transform="translate(920 0)"><g class="pose" data-pose="3" transform="translate(0 5.8) rotate(1.2 200 110)"><g class="h-far"><path d="M97.4 134.1L110.2 157.7A16 16 0 0 0 139.6 145.8L132.4 119.9A19 19 0 0 0 97.4 134.1Z"/><path d="M109.6 143.5L85.4 197.8A7.8 7.8 0 0 0 98.5 206L136.5 160.3A16 16 0 0 0 109.6 143.5Z"/><path d="M95.1 207.3L102.2 204.4A4.4 4.4 0 0 0 101.4 196L94 194.4A6.8 6.8 0 0 0 95.1 207.3Z"/><path d="M86.3 203.2L104.6 256.1A5.4 5.4 0 0 0 114.9 252.7L98.8 199.1A6.6 6.6 0 0 0 86.3 203.2Z"/><path d="M102.8 254.3a6.9 6.9 0 1 0 13.8 0a6.9 6.9 0 1 0 -13.8 0Z"/><path d="M106.1 258.6L119.9 270.1A4.6 4.6 0 0 0 126.2 263.4L113.8 250.4A5.6 5.6 0 0 0 106.1 258.6Z"/><path d="M126.4 262.8L134.9 268.3L124.8 275L119.7 270Z"/><path d="M243.7 138.7L248.6 162.3A13 13 0 0 0 274.4 159.2L273.4 135.1A15 15 0 0 0 243.7 138.7Z"/><path d="M253.6 170.7L299 202.8A7.2 7.2 0 0 0 308.5 192.1L271.4 150.7A13.5 13.5 0 0 0 253.6 170.7Z"/><path d="M295.8 196.9a7.4 7.4 0 1 0 14.8 0a7.4 7.4 0 1 0 -14.8 0Z"/><path d="M297.9 199.8L320.1 240.1A5.2 5.2 0 0 0 329.3 235.2L308.5 194.2A6 6 0 0 0 297.9 199.8Z"/><path d="M317.8 237.6a6.9 6.9 0 1 0 13.8 0a6.9 6.9 0 1 0 -13.8 0Z"/><path d="M319.3 238.9L323.4 255.4A4.6 4.6 0 0 0 332.4 253.7L330.3 236.9A5.6 5.6 0 0 0 319.3 238.9Z"/><path d="M333 253.3L336.6 262.8L324.5 262.2L323.4 255.1Z"/><path d="M319 32C320 27.3 320.5 22 322 18C323.5 14 326 11.3 328 8C329 12.3 330 16.7 331 21C332 25.3 333 29.7 334 34C329 33.3 324 32.7 319 32Z"/></g><path class="h-body" d="M60.4 75.7C56.7 74 48.2 76.8 41.6 77.9C34.9 79.1 27.8 80.3 20.6 82.8C13.4 85.2 5.6 88.8 -1.6 92.8C-8.8 96.7 -16.1 102.1 -22.6 106.6C-29.1 111.1 -34.5 115.5 -40.5 119.9C-40.2 120.6 -43.4 122.5 -39.5 122.1C-35.7 121.7 -24.9 119.6 -17.4 117.4C-9.9 115.3 -1.9 111.7 5.6 109.2C13.1 106.8 20.6 105 27.4 102.6C34.2 100.3 40.4 97.7 46.4 95.3C52.5 92.9 61.3 91.6 63.6 88.3C65.9 85 64.1 77.4 60.4 75.7Z"/><g class="h-body"><path d="M60 80C65.3 73.8 76.7 65.2 88 63C99.3 60.8 115 65.2 128 67C141 68.8 154.3 73.8 166 74C177.7 74.2 188.7 70.8 198 68C207.3 65.2 212.7 60.5 222 57C231.3 53.5 243.2 51 254 47C264.8 43 277.8 36.7 287 33C296.2 29.3 304.2 26 309 25C313.8 24 313.7 26.3 316 27C322 28.7 328 28.2 334 32C340 35.8 346.3 43.3 352 50C357.7 56.7 363.3 65.3 368 72C372.7 78.7 377.8 85.5 380 90C382.2 94.5 382.5 96.7 381 99C379.5 101.3 375.2 104.2 371 104C366.8 103.8 361.2 100.7 356 98C350.8 95.3 345 91.8 340 88C335 84.2 331 75.8 326 75C321 74.2 316.2 79 310 83C303.8 87 295.8 93.5 289 99C282.2 104.5 274 109.8 269 116C264 122.2 262.8 130 259 136C255.2 142 253.2 148 246 152C238.8 156 227 159.2 216 160C205 160.8 191.3 158.7 180 157C168.7 155.3 157.3 152.5 148 150C138.7 147.5 132.7 144.7 124 142C115.3 139.3 105.3 137.7 96 134C86.7 130.3 74.7 125.7 68 120C61.3 114.3 57.3 106.7 56 100C54.7 93.3 54.7 86.2 60 80Z"/><path d="M312 30C312.3 25.3 312.2 20.3 313 16C313.8 11.7 315.7 8 317 4C319 8.3 321.2 12.5 323 17C324.8 21.5 326.3 26.3 328 31C322.7 30.7 317.3 30.3 312 30Z"/><path d="M85.5 119.6L124.1 156.1A17 17 0 0 0 151.1 136.4L128.4 88.4A27 27 0 0 0 85.5 119.6Z"/><path d="M119.8 144.4L122.4 203.8A7.8 7.8 0 0 0 137.8 205.2L151.3 147.3A16 16 0 0 0 119.8 144.4Z"/><path d="M135.4 207.9L140.4 202.1A4.4 4.4 0 0 0 136 195L128.6 196.8A6.8 6.8 0 0 0 135.4 207.9Z"/><path d="M124.7 207.1L155.8 253.6A5.4 5.4 0 0 0 165 247.8L135.9 200A6.6 6.6 0 0 0 124.7 207.1Z"/><path d="M153.4 250.6a6.9 6.9 0 1 0 13.8 0a6.9 6.9 0 1 0 -13.8 0Z"/><path d="M156.2 254.4L168.2 267.8A4.6 4.6 0 0 0 175.4 262L164.9 247.4A5.6 5.6 0 0 0 156.2 254.4Z"/><path d="M175.7 261.4L183.3 268.1L172.4 273.3L168 267.6Z"/><path d="M235.1 117.9L239 161.2A14 14 0 0 0 266.6 163.1L276.4 120.8A21 21 0 0 0 235.1 117.9Z"/><path d="M252.2 173.4L307.8 176.2A7.2 7.2 0 0 0 310.1 162.1L256.6 146.9A13.5 13.5 0 0 0 252.2 173.4Z"/><path d="M300.8 169a7.4 7.4 0 1 0 14.8 0a7.4 7.4 0 1 0 -14.8 0Z"/><path d="M303 172L325.6 212A5.2 5.2 0 0 0 334.7 207.1L313.5 166.3A6 6 0 0 0 303 172Z"/><path d="M323.2 209.5a6.9 6.9 0 1 0 13.8 0a6.9 6.9 0 1 0 -13.8 0Z"/><path d="M325.1 207L317.7 222.3A4.6 4.6 0 0 0 325.7 226.8L334.8 212.5A5.6 5.6 0 0 0 325.1 207Z"/><path d="M326.4 226.8L323 236.4L314.1 228.2L317.8 222.1Z"/></g><path class="h-cut" d="M341 51.5c2.6-2.2 6.4-2.2 8.4.4c-2.6 1.6-6 1.6-8.4-.4Z"/><path class="h-cut" d="M371.5 86.5c1.6-1.2 3.6-.6 4.2 1c-1.6.6-3.2.4-4.2-1Z"/><path class="h-tack" d="M332 40C340 60 352 80 362 98M357 89c3 6 7 10 12 12M336 42c4-6 9-9 14-9"/><path class="h-rein" d="M275 56.4C315 74.4 326 87 372 93"/><path class="h-cloth" d="M170 72C176 66.8 197.3 70 204 70C210.7 70 208 71.3 210 72C209.3 81.3 213.7 94.7 208 100C202.3 105.3 182.7 103.8 176 104C169.3 104.2 170.7 102 168 101C168.7 91.3 164 77.2 170 72Z"/><text class="h-num" x="189" y="96" text-anchor="middle">2</text><path class="h-iron" d="M208 99.5L223 99.5M212 99L201 73"/><g class="j-halo"><path d="M241.7 56.5L197.1 35.3A11.8 11.8 0 0 0 188.4 57.2L235.3 72.5A8.6 8.6 0 0 0 241.7 56.5Z"/><path d="M232.4 59.4L223.2 69.9A6.4 6.4 0 0 0 232.2 79L242.8 69.9A7.4 7.4 0 0 0 232.4 59.4Z"/><path d="M224.7 68.4L207.3 87.6A5 5 0 0 0 214.3 94.7L233.7 77.5A6.4 6.4 0 0 0 224.7 68.4Z"/><path d="M209.6 95.4L222 99.2A3.4 3.4 0 0 0 224.6 93L213.2 86.9A4.6 4.6 0 0 0 209.6 95.4Z"/><path d="M270.6 56.4a4.4 4.4 0 1 0 8.8 0a4.4 4.4 0 1 0 -8.8 0Z"/><path d="M194.6 58.2L241.1 48.2A14.5 14.5 0 0 0 233.8 20.1L188.3 34A12.5 12.5 0 0 0 194.6 58.2Z"/><path d="M235.6 40.3L249.3 54.3A5.2 5.2 0 0 0 257.1 47.5L244.8 32.1A6.2 6.2 0 0 0 235.6 40.3Z"/><path d="M251.9 55.6L274.1 60.5A4.2 4.2 0 0 0 276.2 52.4L254.4 45.9A5 5 0 0 0 251.9 55.6Z"/><path d="M247.6 24a9.4 9.4 0 1 0 18.8 0a9.4 9.4 0 1 0 -18.8 0Z"/><path d="M260.3 28L271.6 27.5A2 2 0 0 0 272.7 23.9L263.6 17.2A6 6 0 0 0 260.3 28Z"/></g><g class="j-breeches"><path d="M241.7 56.5L197.1 35.3A11.8 11.8 0 0 0 188.4 57.2L235.3 72.5A8.6 8.6 0 0 0 241.7 56.5Z"/><path d="M232.4 59.4L223.2 69.9A6.4 6.4 0 0 0 232.2 79L242.8 69.9A7.4 7.4 0 0 0 232.4 59.4Z"/></g><g class="j-dark"><path d="M224.7 68.4L207.3 87.6A5 5 0 0 0 214.3 94.7L233.7 77.5A6.4 6.4 0 0 0 224.7 68.4Z"/><path d="M209.6 95.4L222 99.2A3.4 3.4 0 0 0 224.6 93L213.2 86.9A4.6 4.6 0 0 0 209.6 95.4Z"/><path d="M270.6 56.4a4.4 4.4 0 1 0 8.8 0a4.4 4.4 0 1 0 -8.8 0Z"/></g><g class="j-silk"><path d="M194.6 58.2L241.1 48.2A14.5 14.5 0 0 0 233.8 20.1L188.3 34A12.5 12.5 0 0 0 194.6 58.2Z"/><path d="M235.6 40.3L249.3 54.3A5.2 5.2 0 0 0 257.1 47.5L244.8 32.1A6.2 6.2 0 0 0 235.6 40.3Z"/><path d="M251.9 55.6L274.1 60.5A4.2 4.2 0 0 0 276.2 52.4L254.4 45.9A5 5 0 0 0 251.9 55.6Z"/></g><path class="j-face" d="M259.8 35L264.3 35.2A4.2 4.2 0 0 0 266.1 27.1L261.9 25.4A5 5 0 0 0 259.8 35Z"/><g class="j-silk"><path d="M247.6 24a9.4 9.4 0 1 0 18.8 0a9.4 9.4 0 1 0 -18.8 0Z"/><path d="M260.3 28L271.6 27.5A2 2 0 0 0 272.7 23.9L263.6 17.2A6 6 0 0 0 260.3 28Z"/></g><g class="j-silk2"><path d="M202.5 30.9L209 28.1L227.9 49L221.2 50.8Z"/><path d="M257.8 57L262.7 58.1A4.7 4.7 0 0 0 265 49L260.2 47.5A4.9 4.9 0 0 0 257.8 57Z"/><path d="M250.5 25.1L262.4 16.8A2.4 2.4 0 0 0 259.7 12.8L247.6 20.8A2.6 2.6 0 0 0 250.5 25.1Z"/></g></g></g><g transform="translate(1380 0)"><g class="pose" data-pose="4" transform="translate(0 4.5) rotate(2.2 200 110)"><g class="h-far"><path d="M79.5 124.5L76.8 151.3A16 16 0 0 0 108 157.9L116.4 132.4A19 19 0 0 0 79.5 124.5Z"/><path d="M79.2 144.4L47.8 194.9A7.8 7.8 0 0 0 59.7 204.8L103.6 164.6A16 16 0 0 0 79.2 144.4Z"/><path d="M56.2 205.6L63.6 203.6A4.4 4.4 0 0 0 64 195.3L56.8 192.6A6.8 6.8 0 0 0 56.2 205.6Z"/><path d="M48.7 202.3L76.5 250.9A5.4 5.4 0 0 0 86 245.7L60.3 196A6.6 6.6 0 0 0 48.7 202.3Z"/><path d="M74.3 248.2a6.9 6.9 0 1 0 13.8 0a6.9 6.9 0 1 0 -13.8 0Z"/><path d="M77.4 244.1L64.3 256.3A4.6 4.6 0 0 0 70.1 263.4L84.6 252.7A5.6 5.6 0 0 0 77.4 244.1Z"/><path d="M70.7 263.7L64.2 271.5L58.8 260.6L64.4 256.2Z"/><path d="M236.4 132.8L232.5 156.6A13 13 0 0 0 257.7 162.9L265.4 140A15 15 0 0 0 236.4 132.8Z"/><path d="M235.8 168.2L275.2 207.6A7.2 7.2 0 0 0 286.4 198.6L256.8 151.5A13.5 13.5 0 0 0 235.8 168.2Z"/><path d="M272.9 202.5a7.4 7.4 0 1 0 14.8 0a7.4 7.4 0 1 0 -14.8 0Z"/><path d="M274.6 204.4L289.3 248A5.2 5.2 0 0 0 299.2 244.8L286 200.8A6 6 0 0 0 274.6 204.4Z"/><path d="M287.3 246.3a6.9 6.9 0 1 0 13.8 0a6.9 6.9 0 1 0 -13.8 0Z"/><path d="M289.5 249.4L298.8 263.6A4.6 4.6 0 0 0 306.8 259L299.3 243.8A5.6 5.6 0 0 0 289.5 249.4Z"/><path d="M307.2 258.5L313.7 266.3L302.1 269.7L298.7 263.3Z"/><path d="M319 32C320 27.3 320.5 22 322 18C323.5 14 326 11.3 328 8C329 12.3 330 16.7 331 21C332 25.3 333 29.7 334 34C329 33.3 324 32.7 319 32Z"/></g><path class="h-body" d="M60.2 75.8C56.4 74.2 47.7 77 40.9 78.7C34.1 80.5 26.6 83.1 19.5 86.4C12.4 89.7 5.2 94.9 -1.7 98.8C-8.6 102.7 -15.4 106.5 -21.8 109.9C-28.3 113.3 -34.1 116.3 -40.3 119.4C-40.1 120.2 -43.4 121.5 -39.7 121.8C-36 122.1 -25.7 122.4 -18.2 121.3C-10.6 120.2 -2.1 117.9 5.7 115.2C13.4 112.6 21.6 108.7 28.5 105.4C35.4 102.1 41.2 98.5 47.1 95.7C53 92.8 61.6 91.6 63.8 88.2C66 84.9 64 77.3 60.2 75.8Z"/><g class="h-body"><path d="M60 80C65.3 73.8 76.7 65.2 88 63C99.3 60.8 115 65.2 128 67C141 68.8 154.3 73.8 166 74C177.7 74.2 188.7 70.8 198 68C207.3 65.2 212.7 60.5 222 57C231.3 53.5 243.2 51 254 47C264.8 43 277.8 36.7 287 33C296.2 29.3 304.2 26 309 25C313.8 24 313.7 26.3 316 27C322 28.7 328 28.2 334 32C340 35.8 346.3 43.3 352 50C357.7 56.7 363.3 65.3 368 72C372.7 78.7 377.8 85.5 380 90C382.2 94.5 382.5 96.7 381 99C379.5 101.3 375.2 104.2 371 104C366.8 103.8 361.2 100.7 356 98C350.8 95.3 345 91.8 340 88C335 84.2 331 75.8 326 75C321 74.2 316.2 79 310 83C303.8 87 295.8 93.5 289 99C282.2 104.5 274 109.8 269 116C264 122.2 262.8 130 259 136C255.2 142 253.2 148 246 152C238.8 156 227 159.2 216 160C205 160.8 191.3 158.7 180 157C168.7 155.3 157.3 152.5 148 150C138.7 147.5 132.7 144.7 124 142C115.3 139.3 105.3 137.7 96 134C86.7 130.3 74.7 125.7 68 120C61.3 114.3 57.3 106.7 56 100C54.7 93.3 54.7 86.2 60 80Z"/><path d="M312 30C312.3 25.3 312.2 20.3 313 16C313.8 11.7 315.7 8 317 4C319 8.3 321.2 12.5 323 17C324.8 21.5 326.3 26.3 328 31C322.7 30.7 317.3 30.3 312 30Z"/><path d="M80.8 113.8L107.8 159.4A17 17 0 0 0 139.2 148L130.6 95.6A27 27 0 0 0 80.8 113.8Z"/><path d="M107.1 146.3L90.6 203.4A7.8 7.8 0 0 0 104.8 209.7L136.1 159.2A16 16 0 0 0 107.1 146.3Z"/><path d="M101.6 211.5L108.2 207.6A4.4 4.4 0 0 0 106.3 199.4L98.7 198.8A6.8 6.8 0 0 0 101.6 211.5Z"/><path d="M91.8 207.4L107.2 261.2A5.4 5.4 0 0 0 117.6 258.5L104.6 204A6.6 6.6 0 0 0 91.8 207.4Z"/><path d="M105.5 259.7a6.9 6.9 0 1 0 13.8 0a6.9 6.9 0 1 0 -13.8 0Z"/><path d="M109.3 264.4L124.2 274.4A4.6 4.6 0 0 0 129.7 267.1L116 255.5A5.6 5.6 0 0 0 109.3 264.4Z"/><path d="M129.9 266.5L138.9 271.1L129.6 278.8L124 274.3Z"/><path d="M242.8 132.4L276.7 159.6A14 14 0 0 0 297.2 141.1L273.6 104.6A21 21 0 0 0 242.8 132.4Z"/><path d="M277.1 159.3L320.7 193.8A7.2 7.2 0 0 0 330.8 183.7L296 140.2A13.5 13.5 0 0 0 277.1 159.3Z"/><path d="M317.8 188.2a7.4 7.4 0 1 0 14.8 0a7.4 7.4 0 1 0 -14.8 0Z"/><path d="M320.4 191.8L348.5 228.2A5.2 5.2 0 0 0 356.9 222L330.1 184.7A6 6 0 0 0 320.4 191.8Z"/><path d="M345.8 225a6.9 6.9 0 1 0 13.8 0a6.9 6.9 0 1 0 -13.8 0Z"/><path d="M347.1 224.8L346.2 241.7A4.6 4.6 0 0 0 355.4 242.7L358.2 226A5.6 5.6 0 0 0 347.1 224.8Z"/><path d="M356 242.5L356.7 252.6L345.3 248.6L346.3 241.4Z"/></g><path class="h-cut" d="M341 51.5c2.6-2.2 6.4-2.2 8.4.4c-2.6 1.6-6 1.6-8.4-.4Z"/><path class="h-cut" d="M371.5 86.5c1.6-1.2 3.6-.6 4.2 1c-1.6.6-3.2.4-4.2-1Z"/><path class="h-tack" d="M332 40C340 60 352 80 362 98M357 89c3 6 7 10 12 12M336 42c4-6 9-9 14-9"/><path class="h-rein" d="M275 56.8C315 74.8 326 87 372 93"/><path class="h-cloth" d="M170 72C176 66.8 197.3 70 204 70C210.7 70 208 71.3 210 72C209.3 81.3 213.7 94.7 208 100C202.3 105.3 182.7 103.8 176 104C169.3 104.2 170.7 102 168 101C168.7 91.3 164 77.2 170 72Z"/><text class="h-num" x="189" y="96" text-anchor="middle">2</text><path class="h-iron" d="M208 99.5L223 99.5M212 99L201 73"/><g class="j-halo"><path d="M241.6 56.8L196.9 36.3A11.8 11.8 0 0 0 188.5 58.3L235.5 72.8A8.6 8.6 0 0 0 241.6 56.8Z"/><path d="M232.5 59.7L223.2 70.1A6.4 6.4 0 0 0 232.1 79.3L242.8 70.2A7.4 7.4 0 0 0 232.5 59.7Z"/><path d="M224.7 68.7L207.3 87.6A5 5 0 0 0 214.3 94.8L233.6 77.8A6.4 6.4 0 0 0 224.7 68.7Z"/><path d="M209.6 95.4L222 99.2A3.4 3.4 0 0 0 224.6 93L213.2 86.9A4.6 4.6 0 0 0 209.6 95.4Z"/><path d="M270.6 56.8a4.4 4.4 0 1 0 8.8 0a4.4 4.4 0 1 0 -8.8 0Z"/><path d="M194.6 59.2L241.1 49.2A14.5 14.5 0 0 0 233.8 21.1L188.3 35A12.5 12.5 0 0 0 194.6 59.2Z"/><path d="M235.6 41.4L249.3 55.1A5.2 5.2 0 0 0 257 48.1L244.8 33.1A6.2 6.2 0 0 0 235.6 41.4Z"/><path d="M252 56.3L274.1 60.9A4.2 4.2 0 0 0 276.1 52.8L254.4 46.6A5 5 0 0 0 252 56.3Z"/><path d="M247.6 25a9.4 9.4 0 1 0 18.8 0a9.4 9.4 0 1 0 -18.8 0Z"/><path d="M260.3 29L271.6 28.5A2 2 0 0 0 272.7 24.9L263.6 18.2A6 6 0 0 0 260.3 29Z"/></g><g class="j-breeches"><path d="M241.6 56.8L196.9 36.3A11.8 11.8 0 0 0 188.5 58.3L235.5 72.8A8.6 8.6 0 0 0 241.6 56.8Z"/><path d="M232.5 59.7L223.2 70.1A6.4 6.4 0 0 0 232.1 79.3L242.8 70.2A7.4 7.4 0 0 0 232.5 59.7Z"/></g><g class="j-dark"><path d="M224.7 68.7L207.3 87.6A5 5 0 0 0 214.3 94.8L233.6 77.8A6.4 6.4 0 0 0 224.7 68.7Z"/><path d="M209.6 95.4L222 99.2A3.4 3.4 0 0 0 224.6 93L213.2 86.9A4.6 4.6 0 0 0 209.6 95.4Z"/><path d="M270.6 56.8a4.4 4.4 0 1 0 8.8 0a4.4 4.4 0 1 0 -8.8 0Z"/></g><g class="j-silk"><path d="M194.6 59.2L241.1 49.2A14.5 14.5 0 0 0 233.8 21.1L188.3 35A12.5 12.5 0 0 0 194.6 59.2Z"/><path d="M235.6 41.4L249.3 55.1A5.2 5.2 0 0 0 257 48.1L244.8 33.1A6.2 6.2 0 0 0 235.6 41.4Z"/><path d="M252 56.3L274.1 60.9A4.2 4.2 0 0 0 276.1 52.8L254.4 46.6A5 5 0 0 0 252 56.3Z"/></g><path class="j-face" d="M259.8 36L264.3 36.2A4.2 4.2 0 0 0 266.1 28.1L261.9 26.4A5 5 0 0 0 259.8 36Z"/><g class="j-silk"><path d="M247.6 25a9.4 9.4 0 1 0 18.8 0a9.4 9.4 0 1 0 -18.8 0Z"/><path d="M260.3 29L271.6 28.5A2 2 0 0 0 272.7 24.9L263.6 18.2A6 6 0 0 0 260.3 29Z"/></g><g class="j-silk2"><path d="M202.5 31.9L209 29.1L227.9 50L221.2 51.8Z"/><path d="M257.9 57.6L262.7 58.6A4.7 4.7 0 0 0 265 49.5L260.2 48.1A4.9 4.9 0 0 0 257.9 57.6Z"/><path d="M250.5 26.1L262.4 17.8A2.4 2.4 0 0 0 259.7 13.8L247.6 21.8A2.6 2.6 0 0 0 250.5 26.1Z"/></g></g></g><g transform="translate(1840 0)"><g class="pose" data-pose="5" transform="translate(0 6) rotate(2 200 110)"><g class="h-far"><path d="M74.3 117.9L65.3 143.2A16 16 0 0 0 93.8 157.1L108.2 134.4A19 19 0 0 0 74.3 117.9Z"/><path d="M71.3 135.3L22.2 168.9A7.8 7.8 0 0 0 29.1 182.7L85.4 163.7A16 16 0 0 0 71.3 135.3Z"/><path d="M25.5 182L33.1 183.2A4.4 4.4 0 0 0 36.8 175.7L31.4 170.4A6.8 6.8 0 0 0 25.5 182Z"/><path d="M20.3 177L34.9 231.1A5.4 5.4 0 0 0 45.3 228.5L33.1 173.8A6.6 6.6 0 0 0 20.3 177Z"/><path d="M33.2 229.7a6.9 6.9 0 1 0 13.8 0a6.9 6.9 0 1 0 -13.8 0Z"/><path d="M38.8 224.2L21.3 228.3A4.6 4.6 0 0 0 22.9 237.3L40.7 235.2A5.6 5.6 0 0 0 38.8 224.2Z"/><path d="M23.3 237.9L13.7 241.4L14.4 229.3L21.6 228.2Z"/><path d="M237 133.5L234 157.4A13 13 0 0 0 259.3 162.8L266.2 139.7A15 15 0 0 0 237 133.5Z"/><path d="M234.6 164.7L258 215.2A7.2 7.2 0 0 0 271.6 210.7L260.1 156.2A13.5 13.5 0 0 0 234.6 164.7Z"/><path d="M257.2 212.2a7.4 7.4 0 1 0 14.8 0a7.4 7.4 0 1 0 -14.8 0Z"/><path d="M259.3 209.3L237.3 249.7A5.2 5.2 0 0 0 246.4 254.8L269.7 215.2A6 6 0 0 0 259.3 209.3Z"/><path d="M235 252.2a6.9 6.9 0 1 0 13.8 0a6.9 6.9 0 1 0 -13.8 0Z"/><path d="M238.4 256.5L251.6 267.1A4.6 4.6 0 0 0 257.8 260.3L245.9 248.2A5.6 5.6 0 0 0 238.4 256.5Z"/><path d="M258 259.7L266.6 265L256.6 271.9L251.4 267Z"/><path d="M319 32C320 27.3 320.5 22 322 18C323.5 14 326 11.3 328 8C329 12.3 330 16.7 331 21C332 25.3 333 29.7 334 34C329 33.3 324 32.7 319 32Z"/></g><path class="h-body" d="M60.3 75.7C56.4 74.1 47.4 76.4 40.5 78.6C33.5 80.9 25.6 85.1 18.6 89.3C11.6 93.5 5 100.1 -1.5 103.7C-8.1 107.3 -14.2 109.2 -20.6 111C-27 112.9 -33.5 113.5 -39.9 114.8C-40 115.6 -43.5 115.8 -40.1 117.2C-36.6 118.6 -27 122.5 -19.4 123C-11.8 123.5 -2.6 122.9 5.5 120.3C13.7 117.7 22.4 111.5 29.4 107.3C36.4 103.1 41.8 98.3 47.5 95.2C53.3 92 61.6 91.5 63.7 88.3C65.8 85 64.2 77.3 60.3 75.7Z"/><g class="h-body"><path d="M60 80C65.3 73.8 76.7 65.2 88 63C99.3 60.8 115 65.2 128 67C141 68.8 154.3 73.8 166 74C177.7 74.2 188.7 70.8 198 68C207.3 65.2 212.7 60.5 222 57C231.3 53.5 243.2 51 254 47C264.8 43 277.8 36.7 287 33C296.2 29.3 304.2 26 309 25C313.8 24 313.7 26.3 316 27C322 28.7 328 28.2 334 32C340 35.8 346.3 43.3 352 50C357.7 56.7 363.3 65.3 368 72C372.7 78.7 377.8 85.5 380 90C382.2 94.5 382.5 96.7 381 99C379.5 101.3 375.2 104.2 371 104C366.8 103.8 361.2 100.7 356 98C350.8 95.3 345 91.8 340 88C335 84.2 331 75.8 326 75C321 74.2 316.2 79 310 83C303.8 87 295.8 93.5 289 99C282.2 104.5 274 109.8 269 116C264 122.2 262.8 130 259 136C255.2 142 253.2 148 246 152C238.8 156 227 159.2 216 160C205 160.8 191.3 158.7 180 157C168.7 155.3 157.3 152.5 148 150C138.7 147.5 132.7 144.7 124 142C115.3 139.3 105.3 137.7 96 134C86.7 130.3 74.7 125.7 68 120C61.3 114.3 57.3 106.7 56 100C54.7 93.3 54.7 86.2 60 80Z"/><path d="M312 30C312.3 25.3 312.2 20.3 313 16C313.8 11.7 315.7 8 317 4C319 8.3 321.2 12.5 323 17C324.8 21.5 326.3 26.3 328 31C322.7 30.7 317.3 30.3 312 30Z"/><path d="M77 98.4L74 151.4A17 17 0 0 0 106.4 159.5L128.5 111.3A27 27 0 0 0 77 98.4Z"/><path d="M77.9 143.1L43.4 191.5A7.8 7.8 0 0 0 54.6 202.1L101 164.9A16 16 0 0 0 77.9 143.1Z"/><path d="M51 202.7L58.5 201.2A4.4 4.4 0 0 0 59.5 192.9L52.5 189.8A6.8 6.8 0 0 0 51 202.7Z"/><path d="M43.6 198.4L63.7 250.6A5.4 5.4 0 0 0 73.9 246.9L56 193.9A6.6 6.6 0 0 0 43.6 198.4Z"/><path d="M61.9 248.7a6.9 6.9 0 1 0 13.8 0a6.9 6.9 0 1 0 -13.8 0Z"/><path d="M66 243.8L50.3 252.5A4.6 4.6 0 0 0 54.4 260.8L70.9 253.8A5.6 5.6 0 0 0 66 243.8Z"/><path d="M54.9 261.2L46.7 267.2L44 255.4L50.6 252.4Z"/><path d="M240.7 130.4L270.4 162.1A14 14 0 0 0 293.3 146.6L275.1 107.2A21 21 0 0 0 240.7 130.4Z"/><path d="M270.7 161.7L308.7 202.4A7.2 7.2 0 0 0 320.2 193.8L292.3 145.7A13.5 13.5 0 0 0 270.7 161.7Z"/><path d="M306.6 197.4a7.4 7.4 0 1 0 14.8 0a7.4 7.4 0 1 0 -14.8 0Z"/><path d="M308.7 200.4L331.1 240.5A5.2 5.2 0 0 0 340.3 235.6L319.3 194.7A6 6 0 0 0 308.7 200.4Z"/><path d="M328.8 238a6.9 6.9 0 1 0 13.8 0a6.9 6.9 0 1 0 -13.8 0Z"/><path d="M330.5 240.2L337.3 255.8A4.6 4.6 0 0 0 345.9 252.7L341.1 236.4A5.6 5.6 0 0 0 330.5 240.2Z"/><path d="M346.4 252.2L351.5 261L339.5 262.4L337.2 255.5Z"/></g><path class="h-cut" d="M341 51.5c2.6-2.2 6.4-2.2 8.4.4c-2.6 1.6-6 1.6-8.4-.4Z"/><path class="h-cut" d="M371.5 86.5c1.6-1.2 3.6-.6 4.2 1c-1.6.6-3.2.4-4.2-1Z"/><path class="h-tack" d="M332 40C340 60 352 80 362 98M357 89c3 6 7 10 12 12M336 42c4-6 9-9 14-9"/><path class="h-rein" d="M275 56.4C315 74.4 326 87 372 93"/><path class="h-cloth" d="M170 72C176 66.8 197.3 70 204 70C210.7 70 208 71.3 210 72C209.3 81.3 213.7 94.7 208 100C202.3 105.3 182.7 103.8 176 104C169.3 104.2 170.7 102 168 101C168.7 91.3 164 77.2 170 72Z"/><text class="h-num" x="189" y="96" text-anchor="middle">2</text><path class="h-iron" d="M208 99.5L223 99.5M212 99L201 73"/><g class="j-halo"><path d="M241.7 56.5L197.1 35.3A11.8 11.8 0 0 0 188.4 57.2L235.3 72.5A8.6 8.6 0 0 0 241.7 56.5Z"/><path d="M232.4 59.4L223.2 69.9A6.4 6.4 0 0 0 232.2 79L242.8 69.9A7.4 7.4 0 0 0 232.4 59.4Z"/><path d="M224.7 68.4L207.3 87.6A5 5 0 0 0 214.3 94.7L233.7 77.5A6.4 6.4 0 0 0 224.7 68.4Z"/><path d="M209.6 95.4L222 99.2A3.4 3.4 0 0 0 224.6 93L213.2 86.9A4.6 4.6 0 0 0 209.6 95.4Z"/><path d="M270.6 56.4a4.4 4.4 0 1 0 8.8 0a4.4 4.4 0 1 0 -8.8 0Z"/><path d="M194.6 58.2L241.1 48.2A14.5 14.5 0 0 0 233.8 20.1L188.3 34A12.5 12.5 0 0 0 194.6 58.2Z"/><path d="M235.6 40.3L249.3 54.3A5.2 5.2 0 0 0 257.1 47.5L244.8 32.1A6.2 6.2 0 0 0 235.6 40.3Z"/><path d="M251.9 55.6L274.1 60.5A4.2 4.2 0 0 0 276.2 52.4L254.4 45.9A5 5 0 0 0 251.9 55.6Z"/><path d="M247.6 24a9.4 9.4 0 1 0 18.8 0a9.4 9.4 0 1 0 -18.8 0Z"/><path d="M260.3 28L271.6 27.5A2 2 0 0 0 272.7 23.9L263.6 17.2A6 6 0 0 0 260.3 28Z"/></g><g class="j-breeches"><path d="M241.7 56.5L197.1 35.3A11.8 11.8 0 0 0 188.4 57.2L235.3 72.5A8.6 8.6 0 0 0 241.7 56.5Z"/><path d="M232.4 59.4L223.2 69.9A6.4 6.4 0 0 0 232.2 79L242.8 69.9A7.4 7.4 0 0 0 232.4 59.4Z"/></g><g class="j-dark"><path d="M224.7 68.4L207.3 87.6A5 5 0 0 0 214.3 94.7L233.7 77.5A6.4 6.4 0 0 0 224.7 68.4Z"/><path d="M209.6 95.4L222 99.2A3.4 3.4 0 0 0 224.6 93L213.2 86.9A4.6 4.6 0 0 0 209.6 95.4Z"/><path d="M270.6 56.4a4.4 4.4 0 1 0 8.8 0a4.4 4.4 0 1 0 -8.8 0Z"/></g><g class="j-silk"><path d="M194.6 58.2L241.1 48.2A14.5 14.5 0 0 0 233.8 20.1L188.3 34A12.5 12.5 0 0 0 194.6 58.2Z"/><path d="M235.6 40.3L249.3 54.3A5.2 5.2 0 0 0 257.1 47.5L244.8 32.1A6.2 6.2 0 0 0 235.6 40.3Z"/><path d="M251.9 55.6L274.1 60.5A4.2 4.2 0 0 0 276.2 52.4L254.4 45.9A5 5 0 0 0 251.9 55.6Z"/></g><path class="j-face" d="M259.8 35L264.3 35.2A4.2 4.2 0 0 0 266.1 27.1L261.9 25.4A5 5 0 0 0 259.8 35Z"/><g class="j-silk"><path d="M247.6 24a9.4 9.4 0 1 0 18.8 0a9.4 9.4 0 1 0 -18.8 0Z"/><path d="M260.3 28L271.6 27.5A2 2 0 0 0 272.7 23.9L263.6 17.2A6 6 0 0 0 260.3 28Z"/></g><g class="j-silk2"><path d="M202.5 30.9L209 28.1L227.9 49L221.2 50.8Z"/><path d="M257.8 57L262.7 58.1A4.7 4.7 0 0 0 265 49L260.2 47.5A4.9 4.9 0 0 0 257.8 57Z"/><path d="M250.5 25.1L262.4 16.8A2.4 2.4 0 0 0 259.7 12.8L247.6 20.8A2.6 2.6 0 0 0 250.5 25.1Z"/></g></g></g><g transform="translate(2300 0)"><g class="pose" data-pose="6" transform="translate(0 1.6) rotate(0.4 200 110)"><g class="h-far"><path d="M85.1 129.1L88.1 155.8A16 16 0 0 0 119.9 155.8L122.9 129.1A19 19 0 0 0 85.1 129.1Z"/><path d="M92.8 142.6L50.4 184.2A7.8 7.8 0 0 0 59.6 196.6L111.7 168A16 16 0 0 0 92.8 142.6Z"/><path d="M55.9 196.6L63.6 196.4A4.4 4.4 0 0 0 65.9 188.4L59.6 184.1A6.8 6.8 0 0 0 55.9 196.6Z"/><path d="M52 195.1L97.7 227.5A5.4 5.4 0 0 0 104.1 218.9L59.9 184.5A6.6 6.6 0 0 0 52 195.1Z"/><path d="M93.9 223.1a6.9 6.9 0 1 0 13.8 0a6.9 6.9 0 1 0 -13.8 0Z"/><path d="M96.7 219.3L84.4 232.4A4.6 4.6 0 0 0 90.7 239L104.4 227.4A5.6 5.6 0 0 0 96.7 219.3Z"/><path d="M91.3 239.3L85.3 247.5L79.2 237L84.6 232.2Z"/><path d="M231 122.5L217.1 142.2A13 13 0 0 0 237 158.9L253.9 141.7A15 15 0 0 0 231 122.5Z"/><path d="M216.9 157.7L249.9 202.5A7.2 7.2 0 0 0 262.3 195.4L240.1 144.3A13.5 13.5 0 0 0 216.9 157.7Z"/><path d="M248.3 198.2a7.4 7.4 0 1 0 14.8 0a7.4 7.4 0 1 0 -14.8 0Z"/><path d="M250.4 195.4L228.3 235.7A5.2 5.2 0 0 0 237.4 240.9L260.8 201.3A6 6 0 0 0 250.4 195.4Z"/><path d="M226 238.2a6.9 6.9 0 1 0 13.8 0a6.9 6.9 0 1 0 -13.8 0Z"/><path d="M233.6 232.6L216.7 230.6A4.6 4.6 0 0 0 215.1 239.6L231.6 243.6A5.6 5.6 0 0 0 233.6 232.6Z"/><path d="M215.2 240.2L205.1 240.2L210 229.1L217 230.6Z"/><path d="M319 32C320 27.3 320.5 22 322 18C323.5 14 326 11.3 328 8C329 12.3 330 16.7 331 21C332 25.3 333 29.7 334 34C329 33.3 324 32.7 319 32Z"/></g><path class="h-body" d="M60.7 75.6C57 73.8 48.1 75.6 41.2 77.1C34.4 78.7 26.7 81.6 19.6 84.9C12.5 88.1 5.5 93.1 -1.3 96.6C-8.1 100.1 -14.8 103.3 -21.2 105.9C-27.7 108.6 -33.8 110.4 -40.1 112.6C-40 113.4 -43.4 114.1 -39.9 115C-36.3 115.8 -26.3 117.9 -18.8 117.7C-11.2 117.4 -2.5 115.7 5.3 113.4C13.2 111.1 21.5 107.1 28.4 103.9C35.3 100.8 41 96.9 46.8 94.3C52.6 91.7 61 91.5 63.3 88.4C65.6 85.3 64.4 77.5 60.7 75.6Z"/><g class="h-body"><path d="M60 80C65.3 73.8 76.7 65.2 88 63C99.3 60.8 115 65.2 128 67C141 68.8 154.3 73.8 166 74C177.7 74.2 188.7 70.8 198 68C207.3 65.2 212.7 60.5 222 57C231.3 53.5 243.2 51 254 47C264.8 43 277.8 36.7 287 33C296.2 29.3 304.2 26 309 25C313.8 24 313.7 26.3 316 27C322 28.7 328 28.2 334 32C340 35.8 346.3 43.3 352 50C357.7 56.7 363.3 65.3 368 72C372.7 78.7 377.8 85.5 380 90C382.2 94.5 382.5 96.7 381 99C379.5 101.3 375.2 104.2 371 104C366.8 103.8 361.2 100.7 356 98C350.8 95.3 345 91.8 340 88C335 84.2 331 75.8 326 75C321 74.2 316.2 79 310 83C303.8 87 295.8 93.5 289 99C282.2 104.5 274 109.8 269 116C264 122.2 262.8 130 259 136C255.2 142 253.2 148 246 152C238.8 156 227 159.2 216 160C205 160.8 191.3 158.7 180 157C168.7 155.3 157.3 152.5 148 150C138.7 147.5 132.7 144.7 124 142C115.3 139.3 105.3 137.7 96 134C86.7 130.3 74.7 125.7 68 120C61.3 114.3 57.3 106.7 56 100C54.7 93.3 54.7 86.2 60 80Z"/><path d="M312 30C312.3 25.3 312.2 20.3 313 16C313.8 11.7 315.7 8 317 4C319 8.3 321.2 12.5 323 17C324.8 21.5 326.3 26.3 328 31C322.7 30.7 317.3 30.3 312 30Z"/><path d="M79.9 112.1L103.7 159.5A17 17 0 0 0 135.8 150.3L130.9 97.5A27 27 0 0 0 79.9 112.1Z"/><path d="M103.7 146.8L84.6 203A7.8 7.8 0 0 0 98.4 210L132.1 161A16 16 0 0 0 103.7 146.8Z"/><path d="M95.1 211.6L101.9 208A4.4 4.4 0 0 0 100.4 199.7L92.8 198.8A6.8 6.8 0 0 0 95.1 211.6Z"/><path d="M88.9 211.4L138.3 237.6A5.4 5.4 0 0 0 143.6 228.2L95.3 199.8A6.6 6.6 0 0 0 88.9 211.4Z"/><path d="M134 232.8a6.9 6.9 0 1 0 13.8 0a6.9 6.9 0 1 0 -13.8 0Z"/><path d="M135.3 231.9L132.5 249.7A4.6 4.6 0 0 0 141.4 251.7L146.3 234.3A5.6 5.6 0 0 0 135.3 231.9Z"/><path d="M142.1 251.5L141.7 261.7L130.8 256.4L132.5 249.4Z"/><path d="M235 115.7L234.4 159.1A14 14 0 0 0 261.6 163.9L275.8 122.9A21 21 0 0 0 235 115.7Z"/><path d="M237 166.6L267.1 213.4A7.2 7.2 0 0 0 279.9 207.1L261.1 154.8A13.5 13.5 0 0 0 237 166.6Z"/><path d="M265.8 209.5a7.4 7.4 0 1 0 14.8 0a7.4 7.4 0 1 0 -14.8 0Z"/><path d="M267.2 209.5L266.5 255.4A5.2 5.2 0 0 0 276.9 255.8L279.2 209.8A6 6 0 0 0 267.2 209.5Z"/><path d="M264.8 255.5a6.9 6.9 0 1 0 13.8 0a6.9 6.9 0 1 0 -13.8 0Z"/><path d="M267.9 259.6L280.3 271.2A4.6 4.6 0 0 0 287 264.9L276 251.9A5.6 5.6 0 0 0 267.9 259.6Z"/><path d="M287.2 264.2L295.4 270.2L284.9 276.3L280.1 271Z"/></g><path class="h-cut" d="M341 51.5c2.6-2.2 6.4-2.2 8.4.4c-2.6 1.6-6 1.6-8.4-.4Z"/><path class="h-cut" d="M371.5 86.5c1.6-1.2 3.6-.6 4.2 1c-1.6.6-3.2.4-4.2-1Z"/><path class="h-tack" d="M332 40C340 60 352 80 362 98M357 89c3 6 7 10 12 12M336 42c4-6 9-9 14-9"/><path class="h-rein" d="M275 55.6C315 73.6 326 87 372 93"/><path class="h-cloth" d="M170 72C176 66.8 197.3 70 204 70C210.7 70 208 71.3 210 72C209.3 81.3 213.7 94.7 208 100C202.3 105.3 182.7 103.8 176 104C169.3 104.2 170.7 102 168 101C168.7 91.3 164 77.2 170 72Z"/><text class="h-num" x="189" y="96" text-anchor="middle">2</text><path class="h-iron" d="M208 99.5L223 99.5M212 99L201 73"/><g class="j-halo"><path d="M241.9 56L197.3 33.5A11.8 11.8 0 0 0 188.1 55.1L235.1 71.8A8.6 8.6 0 0 0 241.9 56Z"/><path d="M232.4 58.9L223.3 69.5A6.4 6.4 0 0 0 232.4 78.5L242.9 69.3A7.4 7.4 0 0 0 232.4 58.9Z"/><path d="M224.8 68L207.3 87.7A5 5 0 0 0 214.4 94.7L233.9 77A6.4 6.4 0 0 0 224.8 68Z"/><path d="M209.6 95.4L222 99.2A3.4 3.4 0 0 0 224.6 93L213.2 86.9A4.6 4.6 0 0 0 209.6 95.4Z"/><path d="M270.6 55.6a4.4 4.4 0 1 0 8.8 0a4.4 4.4 0 1 0 -8.8 0Z"/><path d="M194.6 56.2L241.1 46.2A14.5 14.5 0 0 0 233.8 18.1L188.3 32A12.5 12.5 0 0 0 194.6 56.2Z"/><path d="M235.5 38.2L249.2 52.9A5.2 5.2 0 0 0 257.1 46.1L244.9 30.2A6.2 6.2 0 0 0 235.5 38.2Z"/><path d="M251.8 54.2L274 59.7A4.2 4.2 0 0 0 276.3 51.6L254.5 44.5A5 5 0 0 0 251.8 54.2Z"/><path d="M247.6 22a9.4 9.4 0 1 0 18.8 0a9.4 9.4 0 1 0 -18.8 0Z"/><path d="M260.3 26L271.6 25.5A2 2 0 0 0 272.7 21.9L263.6 15.2A6 6 0 0 0 260.3 26Z"/></g><g class="j-breeches"><path d="M241.9 56L197.3 33.5A11.8 11.8 0 0 0 188.1 55.1L235.1 71.8A8.6 8.6 0 0 0 241.9 56Z"/><path d="M232.4 58.9L223.3 69.5A6.4 6.4 0 0 0 232.4 78.5L242.9 69.3A7.4 7.4 0 0 0 232.4 58.9Z"/></g><g class="j-dark"><path d="M224.8 68L207.3 87.7A5 5 0 0 0 214.4 94.7L233.9 77A6.4 6.4 0 0 0 224.8 68Z"/><path d="M209.6 95.4L222 99.2A3.4 3.4 0 0 0 224.6 93L213.2 86.9A4.6 4.6 0 0 0 209.6 95.4Z"/><path d="M270.6 55.6a4.4 4.4 0 1 0 8.8 0a4.4 4.4 0 1 0 -8.8 0Z"/></g><g class="j-silk"><path d="M194.6 56.2L241.1 46.2A14.5 14.5 0 0 0 233.8 18.1L188.3 32A12.5 12.5 0 0 0 194.6 56.2Z"/><path d="M235.5 38.2L249.2 52.9A5.2 5.2 0 0 0 257.1 46.1L244.9 30.2A6.2 6.2 0 0 0 235.5 38.2Z"/><path d="M251.8 54.2L274 59.7A4.2 4.2 0 0 0 276.3 51.6L254.5 44.5A5 5 0 0 0 251.8 54.2Z"/></g><path class="j-face" d="M259.8 33L264.3 33.2A4.2 4.2 0 0 0 266.1 25.1L261.9 23.4A5 5 0 0 0 259.8 33Z"/><g class="j-silk"><path d="M247.6 22a9.4 9.4 0 1 0 18.8 0a9.4 9.4 0 1 0 -18.8 0Z"/><path d="M260.3 26L271.6 25.5A2 2 0 0 0 272.7 21.9L263.6 15.2A6 6 0 0 0 260.3 26Z"/></g><g class="j-silk2"><path d="M202.5 28.9L209 26.1L227.9 47L221.2 48.8Z"/><path d="M257.6 55.7L262.5 56.9A4.7 4.7 0 0 0 265 47.9L260.3 46.3A4.9 4.9 0 0 0 257.6 55.7Z"/><path d="M250.5 23.1L262.4 14.8A2.4 2.4 0 0 0 259.7 10.8L247.6 18.8A2.6 2.6 0 0 0 250.5 23.1Z"/></g></g></g></svg></div></div></div>\n    <div class="runners"><span class="lbl">Barrier<br>order</span><div class="chips"><span class="chip" style="--i:0;--to:0;--from:3" title="No. 4, barrier 1"><svg viewBox="0 0 32 32" aria-hidden="true"><clipPath id="j4c"><path d="M9 5.5 13 4c1 1.6 5 1.6 6 0l4 1.5 6 6.2-3.6 3.9L23 13.4V28H9V13.4l-2.4 2.2L3 11.7z"/></clipPath><path d="M9 5.5 13 4c1 1.6 5 1.6 6 0l4 1.5 6 6.2-3.6 3.9L23 13.4V28H9V13.4l-2.4 2.2L3 11.7z" fill="#2EAF62"/><g clip-path="url(#j4c)" fill="#FFFFFF" color="#FFFFFF" style="color:#FFFFFF"><circle cx="12.5" cy="15" r="2"/><circle cx="19.5" cy="15" r="2"/><circle cx="16" cy="21.5" r="2"/></g><path d="M9 5.5 13 4c1 1.6 5 1.6 6 0l4 1.5 6 6.2-3.6 3.9L23 13.4V28H9V13.4l-2.4 2.2L3 11.7z" fill="none" stroke="rgba(0,0,0,.25)" stroke-width=".8"/></svg><b>4</b></span><span class="chip sel" style="--i:1;--to:1;--from:4" title="No. 2, barrier 2"><svg viewBox="0 0 32 32" aria-hidden="true"><clipPath id="j2c"><path d="M9 5.5 13 4c1 1.6 5 1.6 6 0l4 1.5 6 6.2-3.6 3.9L23 13.4V28H9V13.4l-2.4 2.2L3 11.7z"/></clipPath><path d="M9 5.5 13 4c1 1.6 5 1.6 6 0l4 1.5 6 6.2-3.6 3.9L23 13.4V28H9V13.4l-2.4 2.2L3 11.7z" fill="var(--accent)"/><g clip-path="url(#j2c)" fill="var(--on-accent)" color="var(--on-accent)" style="color:var(--on-accent)"><path d="M9 13 23 27M23 13 9 27" stroke-width="3" stroke="currentColor"/></g><path d="M9 5.5 13 4c1 1.6 5 1.6 6 0l4 1.5 6 6.2-3.6 3.9L23 13.4V28H9V13.4l-2.4 2.2L3 11.7z" fill="none" stroke="rgba(0,0,0,.25)" stroke-width=".8"/></svg><b>2</b></span><span class="chip" style="--i:2;--to:2;--from:5" title="No. 6, barrier 3"><svg viewBox="0 0 32 32" aria-hidden="true"><clipPath id="j6c"><path d="M9 5.5 13 4c1 1.6 5 1.6 6 0l4 1.5 6 6.2-3.6 3.9L23 13.4V28H9V13.4l-2.4 2.2L3 11.7z"/></clipPath><path d="M9 5.5 13 4c1 1.6 5 1.6 6 0l4 1.5 6 6.2-3.6 3.9L23 13.4V28H9V13.4l-2.4 2.2L3 11.7z" fill="#8E6CF0"/><g clip-path="url(#j6c)" fill="#FFFFFF" color="#FFFFFF" style="color:#FFFFFF"><path d="M11.5 0h3v32h-3zM17.5 0h3v32h-3z"/></g><path d="M9 5.5 13 4c1 1.6 5 1.6 6 0l4 1.5 6 6.2-3.6 3.9L23 13.4V28H9V13.4l-2.4 2.2L3 11.7z" fill="none" stroke="rgba(0,0,0,.25)" stroke-width=".8"/></svg><b>6</b></span><span class="chip" style="--i:3;--to:3;--from:6" title="No. 8, barrier 4"><svg viewBox="0 0 32 32" aria-hidden="true"><clipPath id="j8c"><path d="M9 5.5 13 4c1 1.6 5 1.6 6 0l4 1.5 6 6.2-3.6 3.9L23 13.4V28H9V13.4l-2.4 2.2L3 11.7z"/></clipPath><path d="M9 5.5 13 4c1 1.6 5 1.6 6 0l4 1.5 6 6.2-3.6 3.9L23 13.4V28H9V13.4l-2.4 2.2L3 11.7z" fill="#19B5A5"/><g clip-path="url(#j8c)" fill="#FFFFFF" color="#FFFFFF" style="color:#FFFFFF"><path d="M16 0h16v17H16zM0 17h16v15H0z"/></g><path d="M9 5.5 13 4c1 1.6 5 1.6 6 0l4 1.5 6 6.2-3.6 3.9L23 13.4V28H9V13.4l-2.4 2.2L3 11.7z" fill="none" stroke="rgba(0,0,0,.25)" stroke-width=".8"/></svg><b>8</b></span><span class="chip" style="--i:4;--to:4;--from:7" title="No. 1, barrier 5"><svg viewBox="0 0 32 32" aria-hidden="true"><clipPath id="j1c"><path d="M9 5.5 13 4c1 1.6 5 1.6 6 0l4 1.5 6 6.2-3.6 3.9L23 13.4V28H9V13.4l-2.4 2.2L3 11.7z"/></clipPath><path d="M9 5.5 13 4c1 1.6 5 1.6 6 0l4 1.5 6 6.2-3.6 3.9L23 13.4V28H9V13.4l-2.4 2.2L3 11.7z" fill="#E5484D"/><g clip-path="url(#j1c)" fill="#FFFFFF" color="#FFFFFF" style="color:#FFFFFF"><circle cx="16" cy="17" r="4.6"/></g><path d="M9 5.5 13 4c1 1.6 5 1.6 6 0l4 1.5 6 6.2-3.6 3.9L23 13.4V28H9V13.4l-2.4 2.2L3 11.7z" fill="none" stroke="rgba(0,0,0,.25)" stroke-width=".8"/></svg><b>1</b></span><span class="chip" style="--i:5;--to:5;--from:8" title="No. 7, barrier 6"><svg viewBox="0 0 32 32" aria-hidden="true"><clipPath id="j7c"><path d="M9 5.5 13 4c1 1.6 5 1.6 6 0l4 1.5 6 6.2-3.6 3.9L23 13.4V28H9V13.4l-2.4 2.2L3 11.7z"/></clipPath><path d="M9 5.5 13 4c1 1.6 5 1.6 6 0l4 1.5 6 6.2-3.6 3.9L23 13.4V28H9V13.4l-2.4 2.2L3 11.7z" fill="#FF8A3D"/><g clip-path="url(#j7c)" fill="#1B2A4A" color="#1B2A4A" style="color:#1B2A4A"><path d="M16 11.5l5 6-5 6-5-6z"/></g><path d="M9 5.5 13 4c1 1.6 5 1.6 6 0l4 1.5 6 6.2-3.6 3.9L23 13.4V28H9V13.4l-2.4 2.2L3 11.7z" fill="none" stroke="rgba(0,0,0,.25)" stroke-width=".8"/></svg><b>7</b></span><span class="chip" style="--i:6;--to:6;--from:9" title="No. 3, barrier 7"><svg viewBox="0 0 32 32" aria-hidden="true"><clipPath id="j3c"><path d="M9 5.5 13 4c1 1.6 5 1.6 6 0l4 1.5 6 6.2-3.6 3.9L23 13.4V28H9V13.4l-2.4 2.2L3 11.7z"/></clipPath><path d="M9 5.5 13 4c1 1.6 5 1.6 6 0l4 1.5 6 6.2-3.6 3.9L23 13.4V28H9V13.4l-2.4 2.2L3 11.7z" fill="#F5F7FA"/><g clip-path="url(#j3c)" fill="#111318" color="#111318" style="color:#111318"><path d="M0 12h32v3.2H0zM0 19h32v3.2H0zM0 26h32v3H0z"/></g><path d="M9 5.5 13 4c1 1.6 5 1.6 6 0l4 1.5 6 6.2-3.6 3.9L23 13.4V28H9V13.4l-2.4 2.2L3 11.7z" fill="none" stroke="rgba(0,0,0,.25)" stroke-width=".8"/></svg><b>3</b></span><span class="chip" style="--i:7;--to:7;--from:10" title="No. 5, barrier 8"><svg viewBox="0 0 32 32" aria-hidden="true"><clipPath id="j5c"><path d="M9 5.5 13 4c1 1.6 5 1.6 6 0l4 1.5 6 6.2-3.6 3.9L23 13.4V28H9V13.4l-2.4 2.2L3 11.7z"/></clipPath><path d="M9 5.5 13 4c1 1.6 5 1.6 6 0l4 1.5 6 6.2-3.6 3.9L23 13.4V28H9V13.4l-2.4 2.2L3 11.7z" fill="#F5C542"/><g clip-path="url(#j5c)" fill="#111318" color="#111318" style="color:#111318"><path d="M9 13l7 6 7-6v4l-7 6-7-6z"/></g><path d="M9 5.5 13 4c1 1.6 5 1.6 6 0l4 1.5 6 6.2-3.6 3.9L23 13.4V28H9V13.4l-2.4 2.2L3 11.7z" fill="none" stroke="rgba(0,0,0,.25)" stroke-width=".8"/></svg><b>5</b></span></div></div>\n  </section>\n';

  // ── Racing (gallops T + harness H; opening prices only; no odds polling) ──
  const RACING_ALLOWED = { T:true, H:true };
  const RACING_SILK = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M9 5.5 13 4c1 1.6 5 1.6 6 0l4 1.5 6 6.2-3.6 3.9L23 13.4V28H9V13.4l-2.4 2.2L3 11.7z" fill="var(--accent)"/><path d="M9 5.5 13 4c1 1.6 5 1.6 6 0l4 1.5 6 6.2-3.6 3.9L23 13.4V28H9V13.4l-2.4 2.2L3 11.7z" fill="none" stroke="rgba(0,0,0,.25)" stroke-width=".8"/></svg>';
  let racingTimer = null;
  let racingHeroTimers = [];

  function racingCat(item){
    if(!item) return "";
    const c = item.category || (item.meeting && item.meeting.category) || "";
    return String(c).toUpperCase();
  }
  function racingAllowed(item){ return !!RACING_ALLOWED[racingCat(item)]; }
  function racingPick(obj, keys){
    if(!obj) return null;
    for(let i=0;i<keys.length;i++){
      const v = obj[keys[i]];
      if(v!=null && v!=="" && v!==0 && v!=="0") return v;
    }
    for(let i=0;i<keys.length;i++){
      const v = obj[keys[i]];
      if(typeof v==="number" && Number.isFinite(v)) return v;
    }
    return null;
  }
  // TipBot 0.58.1 sends runner.fixed {win, place}: the opening price, captured once.
  function racingOpeningWin(rn){
    const f = rn && rn.fixed && racingPick(rn.fixed, ["win"]);
    return f!=null ? f : racingPick(rn, ["opening_win","open_win","opening_win_odds"]);
  }
  function racingOpeningPlace(rn){
    const f = rn && rn.fixed && racingPick(rn.fixed, ["place"]);
    return f!=null ? f : racingPick(rn, ["opening_place","open_place","opening_place_odds"]);
  }
  // Final results: TipBot sends event.results [{runner_id, position}] and
  // event.dividends [{type:"win"|"place", runner_id, amount}].
  function racingPosition(r, rn){
    if(rn && Number(rn.finishing_position)>0) return Number(rn.finishing_position);
    const hit = ((r && r.results) || []).find(function(x){ return x && String(x.runner_id)===String(rn && rn.id); });
    if(hit && Number(hit.position)>0) return Number(hit.position);
    if(rn && Number(rn.result)>0) return Number(rn.result);
    return 0;
  }
  function racingDividend(r, rn, type){
    const own = rn && rn[type+"_dividend"];
    if(own!=null && own!=="") return own;
    const hit = ((r && r.dividends) || []).find(function(x){ return x && String(x.type).toLowerCase()===type && String(x.runner_id)===String(rn && rn.id); });
    return hit && hit.amount!=null ? hit.amount : "—";
  }
  function racingFmtOdds(v){
    const n = Number(v);
    if(!Number.isFinite(n) || n<=0) return "—";
    return n.toFixed(2);
  }
  function racingSilk(rn){
    if(rn && rn.silk_url) return '<img src="'+esc(rn.silk_url)+'" alt="">';
    return RACING_SILK;
  }
  function racingIsFinal(r){
    return /^(final|result|official|results)$/i.test(String((r&&r.status)||""));
  }
  function stopRacingCountdown(){
    if(racingTimer){ clearInterval(racingTimer); racingTimer=null; }
  }
  function stopRacingHero(){
    racingHeroTimers.forEach(function(id){ clearTimeout(id); });
    racingHeroTimers = [];
  }
  function tickRacingCountdown(){
    const badges = Array.prototype.filter.call(document.querySelectorAll(".time-badge[data-time]"), function(el){ return !el.closest("[hidden]"); });
    if(!badges.length){ stopRacingCountdown(); return; }
    badges.forEach(function(el){
      const time = parseInt(el.dataset.time, 10);
      if(isNaN(time)) return;
      const diff = Math.max(0, Math.floor((time - Date.now()) / 1000));
      if(diff===0){
        el.textContent = "LIVE";
        el.className = "live-badge";
        el.style.color = "#e5484d";
      }else{
        const mins = Math.floor(diff / 60);
        const secs = diff % 60;
        el.textContent = (mins>0 ? mins+"m " : "") + secs + "s";
      }
    });
  }
  function startRacingCountdown(){
    stopRacingCountdown();
    tickRacingCountdown();
    racingTimer = setInterval(tickRacingCountdown, 1000);
  }

  async function fetchRacingApi(path){
    try{
      const res = await api(path);
      if(!res.ok){
        if(res.status===503) return { error: "Racing data is currently unavailable. Please try again later." };
        if(res.status===400) return { error: "Greyhounds aren't listed. Gallops and harness only." };
        return { error: "Failed to load racing data." };
      }
      return await res.json();
    }catch(e){
      if(e&&e.unauth) throw e;
      return { error: "Failed to connect to racing service." };
    }
  }

  function racingToday(){
    try{ if(window.TBTime && TBTime.dayKey) return TBTime.dayKey(Date.now()); }catch(e){}
    return new Date().toISOString().slice(0,10);
  }
  function racingMeetingsPath(cat){
    return "/api/racing/meetings?category="+cat+"&date="+encodeURIComponent(racingToday());
  }
  // "All" asks for gallops and harness separately and merges them.
  async function fetchRacingMeetings(cat){
    const cats = (cat==="T" || cat==="H") ? [cat] : ["T","H"];
    const res = await Promise.all(cats.map(function(c){ return fetchRacingApi(racingMeetingsPath(c)); }));
    const ok = res.filter(function(d){ return d && !d.error; });
    if(!ok.length) return res[0] || { error: "Failed to load." };
    let meetings = [];
    ok.forEach(function(d, i){
      const c = cats[res.indexOf(d)];
      ((d.data && d.data.meetings) || d.meetings || []).forEach(function(m){
        if(!m) return;
        if(!m.category) m.category = c;
        const key = String(m.id || m.meeting || m.name || "");
        if(key && meetings.some(function(x){ return String(x.id || x.meeting || x.name || "")===key; })) return;
        meetings.push(m);
      });
    });
    return { meetings: meetings };
  }

  async function loadNextToGo(){
    const list = $("next-to-go-list");
    if(!list) return;
    const data = await fetchRacingApi("/api/racing/next?limit=10");
    if(list.isConnected === false) return;
    if(!data || data.error){
      list.innerHTML = '<div class="empty">'+esc(data && data.error ? data.error : "Failed to load.")+'</div>';
      return;
    }
    const races = ((data.data && data.data.races) || data.races || []).filter(racingAllowed);
    if(!races.length){
      list.innerHTML = '<div class="empty">No upcoming gallops or harness races.</div>';
      return;
    }
    let html = '<div class="race-list">';
    races.forEach(function(r){
      const meetingName = r.meeting ? r.meeting.name : (r.meeting_name || "Unknown");
      const cat = racingCat(r) || "T";
      const label = cat==="H" ? "Harness" : "Gallops";
      const time = new Date(r.start_time);
      const ts = time.getTime();
      html += '<div class="race-ntg" data-id="'+esc(String(r.id||""))+'" data-cat="'+esc(cat)+'" data-meeting="'+esc(meetingName)+'">'
        + '<div style="display:flex;justify-content:space-between;align-items:center">'
        + '<div>'
        + '<div style="font-weight:700;font-size:var(--t-body);margin-bottom:4px">'+esc(meetingName)+'</div>'
        + '<div style="font-size:var(--t-foot);color:var(--muted)">'+esc(label)+' · R'+esc(String(r.race_number||""))+(r.distance ? ' · '+esc(String(r.distance))+'m' : '')
        + (r.track_condition ? ' · '+esc(r.track_condition) : '')+'</div>'
        + '</div>'
        + '<div class="time-badge" data-time="'+ts+'" style="font-size:var(--t-cap);font-weight:700;padding:4px 8px;border-radius:4px;background:var(--surface,var(--card));color:var(--accent)">—</div>'
        + '</div></div>';
    });
    html += '</div>';
    list.innerHTML = html;
    list.querySelectorAll(".race-ntg").forEach(function(el){
      el.onclick = function(){ openRaceEvent(el.dataset.id, el.dataset.cat, el.dataset.meeting); };
    });
    startRacingCountdown();
  }

  async function openRacingBuilder(guildId, name, category){
    stopRacingCountdown();
    stopRacingHero();
    navNote("#/s/"+encodeURIComponent(guildId)+"/build/racing", function(){ openRacingBuilder(guildId,name,category); });
    // Also opened straight from the Home Racing tile or a deep link, so own the panel.
    clearDetailTimers();clearLiveTimer();clearGamesTimer();
    if(BATCH.guildId && String(BATCH.guildId)!==String(guildId)){ BATCH={guildId:null,tips:[]}; }
    if(!BUILD || String(BUILD.guildId)!==String(guildId)){
      BUILD={guildId,serverName:name,game:null,tab:"Disposals",legs:[],search:"",sort:"number",collapsed:{},compFilter:"All",unitSize:guildUnitSize(guildId),autoLines:false};
    }
    panel("builder");renderTray();renderBatchTray();
    BUILD.isRacing = true;
    const cat = (category==="T"||category==="H") ? category : "";
    $("builder").innerHTML = '<div class="back" id="bx">← Back to '+esc(name||"server")+'</div><h1 style="margin:0 0 16px">Racing</h1>'
      + '<div style="display:flex;gap:8px;margin:0 0 16px;flex-wrap:wrap" id="racing-cat-tabs">'
      + '<button class="compchip'+(cat===""?" on":"")+'" data-c="">All</button>'
      + '<button class="compchip'+(cat==="T"?" on":"")+'" data-c="T">Gallops</button>'
      + '<button class="compchip'+(cat==="H"?" on":"")+'" data-c="H">Harness</button>'
      + '</div>'
      + '<div id="racing-meetings-list">'+NDSkeleton.grid(6,{cols:1,tile:"72px"})+'</div>'
      + '<div class="rg" style="text-align:center;color:var(--muted);font-size:var(--t-cap);font-weight:500;margin-top:32px;padding-bottom:32px">18+ · Gamble responsibly</div>';
    $("bx").onclick = function(){ openSportsBuilder(guildId, name); };
    $("racing-cat-tabs").onclick = function(e){
      const btn = e.target.closest("[data-c]");
      if(!btn) return;
      openRacingBuilder(guildId, name, btn.dataset.c);
    };
    const data = await fetchRacingMeetings(cat);
    const list = $("racing-meetings-list");
    if(!list) return;
    if(!data || data.error){
      list.innerHTML = '<div class="empty">'+esc(data && data.error ? data.error : "Failed to load.")+'</div>';
      return;
    }
    const meetings = ((data.data && data.data.meetings) || data.meetings || []).filter(racingAllowed)
      .filter(function(m){ return !cat || racingCat(m)===cat; });
    if(!meetings.length){
      list.innerHTML = '<div class="empty">No meetings found.</div>';
      return;
    }
    let html = '<div class="race-list">';
    meetings.forEach(function(m){
      const n = (m.races && m.races.length) || m.race_count || 0;
      const kind = racingCat(m)==="H" ? "Harness" : "Gallops";
      html += '<div class="race-mtg" data-id="'+esc(String(m.meeting||m.id||""))+'">'
        + '<div style="font-weight:700;font-size:var(--t-body);margin-bottom:4px">'+esc(m.name)+'</div>'
        + '<div style="font-size:var(--t-foot);color:var(--muted)">'+esc(kind)+' · '+n+(n===1?' race':' races')+'</div>'
        + '</div>';
    });
    html += '</div>';
    list.innerHTML = html;
    list.querySelectorAll(".race-mtg").forEach(function(el){
      el.onclick = function(){ openRacingMeeting(el.dataset.id); };
    });
  }

  async function openRacingMeeting(meetingId){
    stopRacingHero();
    navNote("#/s/"+encodeURIComponent(BUILD.guildId)+"/build/racing/meeting/"+meetingId, function(){ openRacingMeeting(meetingId); });
    $("builder").innerHTML = '<div class="back" id="bx">← Back to Racing</div><h1 style="margin:0 0 16px">Meeting</h1>'
      + '<div id="racing-meeting-detail">'+NDSkeleton.grid(6,{cols:1,tile:"72px"})+'</div>'
      + '<div class="rg" style="text-align:center;color:var(--muted);font-size:var(--t-cap);font-weight:500;margin-top:32px;padding-bottom:32px">18+ · Gamble responsibly</div>';
    $("bx").onclick = function(){ openRacingBuilder(BUILD.guildId, BUILD.serverName); };
    const data = await fetchRacingApi("/api/racing/meeting/"+encodeURIComponent(meetingId));
    const detail = $("racing-meeting-detail");
    if(!detail) return;
    if(!data || data.error){
      detail.innerHTML = '<div class="empty">'+esc(data && data.error ? data.error : "Failed to load.")+'</div>';
      return;
    }
    const m = (data.data && (data.data.meeting || data.data)) || data.meeting;
    if(!m){
      detail.innerHTML = '<div class="empty">Meeting not found.</div>';
      return;
    }
    if(!racingAllowed(m)){
      detail.innerHTML = '<div class="empty">Greyhounds aren\'t listed. Gallops and harness only.</div>';
      return;
    }
    const h1 = $("builder").querySelector("h1");
    if(h1) h1.textContent = m.name;
    BUILD.racingMeetingName = m.name;
    BUILD.racingCategory = racingCat(m);
    let html = '<div class="race-list">';
    (m.races || []).forEach(function(r){
      html += '<div class="race-evt" data-id="'+esc(String(r.id||""))+'">'
        + '<div style="font-weight:700;font-size:var(--t-body);margin-bottom:4px">Race '+esc(String(r.race_number||""))+'</div>'
        + '<div style="font-size:var(--t-foot);color:var(--muted)">'+esc(r.name||"")+(r.distance ? ' · '+esc(String(r.distance))+'m' : '')+'</div>'
        + '</div>';
    });
    html += '</div>';
    detail.innerHTML = html;
    detail.querySelectorAll(".race-evt").forEach(function(el){
      el.onclick = function(){ openRaceEvent(el.dataset.id, racingCat(m), m.name); };
    });
  }

  async function openRaceEvent(eventId, category, meetingName){
    stopRacingHero();
    category = String(category||"").toUpperCase();
    meetingName = meetingName || BUILD.racingMeetingName || "Racing";
    navNote("#/s/"+encodeURIComponent(BUILD.guildId)+"/build/racing/event/"+eventId, function(){ openRaceEvent(eventId, category, meetingName); });
    if(category==="G"){
      $("builder").innerHTML = '<div class="back" id="bx">← Back</div><div class="empty">Greyhounds aren\'t listed. Gallops and harness only.</div>';
      $("bx").onclick = function(){ openRacingBuilder(BUILD.guildId, BUILD.serverName); };
      return;
    }
    let html = '<div class="app'+(category==="T"?"":" no-hero")+'" id="race-app">'
      + '<header class="top">'
      + '<a class="back" id="bx" aria-label="Back"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></a>'
      + '<h2>'+esc(meetingName)+'</h2>'
      + '</header>';
    if (category === 'T') {
      html += RACING_HERO_HTML;
    }
    html += '<main class="race-card" id="race-card-main">'+NDSkeleton.grid(6,{cols:1,tile:"72px"})+'</main></div>';
    $("builder").innerHTML = html;
    $("bx").onclick = function(){ navBack(function(){ openRacingBuilder(BUILD.guildId, BUILD.serverName); }); };
    const app = $("race-app");
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduce';
    if (category === 'T') {
      if (reduce) {
        app.classList.add('is-in', 'is-compact');
      } else {
        requestAnimationFrame(function(){ requestAnimationFrame(function(){ app.classList.add('is-in'); }); });
        racingHeroTimers.push(setTimeout(function(){ app.classList.add('is-compact'); }, 1100));
        racingHeroTimers.push(setTimeout(function(){
          document.querySelectorAll('#race-app .hero').forEach(function(h){
            (h.getAnimations ? h.getAnimations({ subtree: true }) : []).forEach(function(a){ a.updatePlaybackRate ? a.updatePlaybackRate(.62) : (a.playbackRate = .62); });
          });
        }, 1800));
      }
    } else if(app){
      app.classList.add('is-in', 'is-compact');
    }

    const data = await fetchRacingApi("/api/racing/event/"+encodeURIComponent(eventId));
    const main = $("race-card-main");
    if(!main) return;
    if(!data || data.error){
      main.innerHTML = '<div class="empty">'+esc(data && data.error ? data.error : "Failed to load.")+'</div>';
      return;
    }
    const r = data.event || data.race || (data.data && (data.data.event || data.data.race || data.data));
    if(!r){
      main.innerHTML = '<div class="empty">Race not found.</div>';
      return;
    }
    const raceCat = racingCat(r) || category;
    if(raceCat==="G"){
      main.innerHTML = '<div class="empty">Greyhounds aren\'t listed. Gallops and harness only.</div>';
      return;
    }
    if (category === 'T') {
      const chips = document.querySelector('#race-app .chips');
      if(chips){
        let chipsHtml = '';
        (r.runners || []).filter(function(rn){ return !rn.scratched; }).forEach(function(rn, i){
          chipsHtml += '<span class="chip" style="--i:'+i+';--to:'+i+';--from:'+(i+3)+'" title="No. '+esc(String(rn.number))+', barrier '+esc(String(rn.barrier||""))+'">'
            + racingSilk(rn) + '<b>'+esc(String(rn.number))+'</b></span>';
        });
        chips.innerHTML = chipsHtml;
      }
      const eyebrow = document.querySelector('#race-app .eyebrow');
      if(eyebrow){
        eyebrow.innerHTML = '<span><b>R'+esc(String(r.race_number||""))+'</b> · '+esc(String(r.distance||""))+'m'
          + (r.track_condition ? ' · '+esc(r.track_condition) : '')+'</span><span>'+esc(r.name||"")+'</span>';
      }
    }

    let cardHtml = '<div class="race-eyebrow"><b>Race '+esc(String(r.race_number||""))+'</b>'
      + (r.distance ? ' · '+esc(String(r.distance))+'m' : '')+' · '+esc(meetingName)+'</div>'
      + '<h1>'+esc(r.name||"Race")+'</h1>'
      + '<div class="meta"><span>'+esc(r.track_condition||"")+'</span>'
      + (r.start_time ? '<span>·</span><span>'+esc((function(){ try{ return new Date(r.start_time).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"}); }catch(e){ return ""; } })())+'</span>' : '')
      + '</div>';

    const runners = r.runners || [];
    if(racingIsFinal(r)){
      cardHtml += '<h3 style="margin-top:24px">Placings</h3>';
      runners.filter(function(rn){ return racingPosition(r, rn)>0; })
        .sort(function(a,b){ return racingPosition(r, a)-racingPosition(r, b); })
        .slice(0,3)
        .forEach(function(rn, i){
          cardHtml += '<div class="race-row" style="--i:'+i+'">'
            + '<div style="width:24px;font-weight:700;color:var(--accent)">'+esc(String(racingPosition(r, rn)))+'</div>'
            + '<span class="silk">'+racingSilk(rn)+'<b>'+esc(String(rn.number))+'</b></span>'
            + '<span class="who"><strong>'+esc(rn.name)+'</strong></span>'
            + '<div style="text-align:right"><div style="font-size:var(--t-cap);color:var(--muted);text-transform:uppercase;margin-bottom:4px">Win</div><div style="font-weight:700">'+esc(String(racingDividend(r, rn, "win")))+'</div></div>'
            + '<div style="text-align:right;margin-left:12px"><div style="font-size:var(--t-cap);color:var(--muted);text-transform:uppercase;margin-bottom:4px">Place</div><div style="font-weight:700">'+esc(String(racingDividend(r, rn, "place")))+'</div></div>'
            + '</div>';
        });
    }else{
      cardHtml += '<div class="cols"><em>Opening</em><span>Win</span><span>Place</span></div>';
      runners.forEach(function(rn, i){
        if(rn.scratched){
          cardHtml += '<div class="race-row" style="--i:'+i+';opacity:0.5">'
            + '<span class="silk" style="background:var(--hairline,var(--line))"><b>'+esc(String(rn.number))+'</b></span>'
            + '<span class="who"><strong>'+esc(rn.name)+'</strong><small>Scratched</small></span>'
            + '</div>';
        }else{
          const jock = rn.jockey_or_driver || rn.jockey || rn.driver || "";
          const bar = rn.barrier!=null ? rn.barrier : "";
          cardHtml += '<div class="race-row race-tip" data-i="'+i+'" style="--i:'+i+';cursor:pointer">'
            + '<span class="silk">'+racingSilk(rn)+'<b>'+esc(String(rn.number))+'</b></span>'
            + '<span class="who"><strong>'+esc(rn.name)+'</strong><small>'
            + (jock ? (raceCat==="H" ? "D: " : "J: ")+esc(jock) : "")
            + (bar!=="" ? (jock ? " · " : "")+"Bar "+esc(String(bar)) : "")
            + '</small></span>'
            + '<span class="odds">'+racingFmtOdds(racingOpeningWin(rn))+'</span>'
            + '<span class="odds">'+racingFmtOdds(racingOpeningPlace(rn))+'</span>'
            + '</div>';
        }
      });
    }
    cardHtml += '<div class="rg">18+ · Gamble responsibly</div>';
    main.innerHTML = cardHtml;
    main.querySelectorAll(".race-tip").forEach(function(el){
      el.onclick = function(){
        const rn = runners[+el.dataset.i];
        if(rn && !rn.scratched) addRacingTip(r, rn, meetingName);
      };
    });
  }

  function addRacingTip(race, runner, meetingName){
    const odds = racingOpeningWin(runner);
    const price = Number(odds);
    const locked = Number.isFinite(price) && price>0 ? price : null;
    const meeting = meetingName || BUILD.racingMeetingName || "Racing";
    const eventName = meeting + " · R" + (race && race.race_number ? race.race_number : "") + (race && race.name ? " " + race.name : "");
    const desc = (runner.name || "Runner") + " (Win)" + (locked!=null ? " @ " + racingFmtOdds(locked) : " @ Opening");
    const day = race && race.start_time ? String(race.start_time).slice(0,10) : "";
    const gid = BUILD.guildId, sname = BUILD.serverName;
    openCustom(gid, sname, "Racing");
    BUILD.customEvent = eventName;
    BUILD.customSport = "Racing";
    BUILD.customStartDay = day;
    BUILD.legs = [];
    addLeg({ custom:true, desc:desc, price:locked });
    renderCustom();
    const ev = $("c_event"); if(ev) ev.value = BUILD.customEvent;
    const sp = $("c_sport"); if(sp) sp.value = BUILD.customSport;
    const sd = $("c_start"); if(sd && day) sd.value = day;
  }

  TD.loaded.builder=true;
