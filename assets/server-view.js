/* Server page stats, charts and breakdowns (tipdash 0.44.1).
 * Computed from the /api/server payload already on the page. Historical imports
 * are left out of those sums when a tip is marked as one. Headline cards use the
 * API stats unless the payload is complete enough to recompute without those tips.
 * window.ServerView + CommonJS for node --test.
 */
(function(root){
  "use strict";
  function esc(s){
    return String(s==null?"":s).replace(/[&<>"']/g, function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c];
    });
  }
  function num(v){
    if(v==null || v==="") return null;
    var n=Number(v);
    return Number.isFinite(n)?n:null;
  }
  function round1(n){ return Math.round(Number(n)*10)/10; }
  function round2(n){ return Math.round(Number(n)*100)/100; }
  function clock(){
    var g=typeof globalThis!=="undefined"?globalThis:{};
    if(g.TBTime && typeof g.TBTime.monthKey==="function") return g.TBTime;
    if(typeof require==="function"){
      try{ return require("./tbtime.js"); }catch(e){}
    }
    return null;
  }
  function chartsApi(){
    var g=typeof globalThis!=="undefined"?globalThis:{};
    if(g.SvgCharts && typeof g.SvgCharts.areaChart==="function") return g.SvgCharts;
    if(typeof require==="function"){
      try{ return require("./svg-charts.js"); }catch(e){}
    }
    return null;
  }
  var FLAG_KEYS=["historical","imported","is_import","is_imported","is_historical","historical_import","from_import","exclude_from_stats","stats_exclude"];
  var SOURCE_KEYS=["source","origin","provenance","record_source","tip_source","import_source","entry_source"];
  var SOURCE_VALS={import:1,imported:1,historical:1,history:1,historical_import:1,"historical-import":1};
  function truthyFlag(v){
    if(v===true || v===1) return true;
    if(typeof v!=="string") return false;
    var s=v.trim().toLowerCase();
    return s==="1" || s==="true" || s==="yes" || s==="y";
  }
  function isHistoricalImport(tip){
    if(!tip || typeof tip!=="object") return false;
    var i, k, v, s;
    for(i=0;i<FLAG_KEYS.length;i++){
      if(truthyFlag(tip[FLAG_KEYS[i]])) return true;
    }
    if(tip.import===true || tip.import===1 || truthyFlag(tip.import)) return true;
    if(tip.import_id!=null && String(tip.import_id).trim()!=="") return true;
    if(tip.imported_at!=null && String(tip.imported_at).trim()!=="") return true;
    if(tip.historical_at!=null && String(tip.historical_at).trim()!=="") return true;
    for(i=0;i<SOURCE_KEYS.length;i++){
      v=tip[SOURCE_KEYS[i]];
      if(v==null || typeof v==="object") continue;
      s=String(v).trim().toLowerCase().replace(/\s+/g,"_");
      if(SOURCE_VALS[s]) return true;
    }
    var flags=tip.flags;
    if(typeof flags==="string") flags=flags.split(/[,\s]+/);
    if(Array.isArray(flags)){
      for(i=0;i<flags.length;i++){
        s=String(flags[i]||"").trim().toLowerCase();
        if(s==="historical" || s==="import" || s==="imported" || s==="historical_import") return true;
      }
    }
    var meta=tip.meta;
    if(meta && typeof meta==="object" && isHistoricalImport(meta)) return true;
    return false;
  }
  function resultOf(tip){
    tip=tip||{};
    var raw=String(tip.result!=null && tip.result!=="" ? tip.result : (tip.outcome||"")).trim().toLowerCase();
    var st=String(tip.status||"").trim().toLowerCase();
    if(!raw){
      if(st==="won" || st==="win") raw="win";
      else if(st==="lost" || st==="loss") raw="loss";
      else if(st==="push" || st==="void") raw=st;
    }
    if(raw==="won" || raw==="w") return "win";
    if(raw==="lost" || raw==="l") return "loss";
    if(raw==="push" || raw==="p" || raw==="void" || raw==="v") return raw==="void"||raw==="v"?"void":"push";
    if(raw==="win" || raw==="loss") return raw;
    return "";
  }
  function isSettledTip(tip){
    if(resultOf(tip)) return true;
    var st=String((tip&&tip.status)||"").trim().toLowerCase();
    return st==="settled";
  }
  function buckets(detail){
    var tips=detail && detail.tips;
    var settled=[], queued=[];
    if(Array.isArray(tips)){
      tips.forEach(function(t){
        if(!t || typeof t!=="object") return;
        if(isSettledTip(t)) settled.push(t); else queued.push(t);
      });
    }else if(tips && typeof tips==="object"){
      settled=Array.isArray(tips.settled)?tips.settled.filter(function(t){ return t && typeof t==="object"; }):[];
      queued=Array.isArray(tips.queued)?tips.queued.filter(function(t){ return t && typeof t==="object"; }):[];
    }
    return {settled:settled, queued:queued};
  }
  function profitOf(tip){
    var p=num(tip.profit_units);
    if(p==null) p=num(tip.profit);
    if(p==null) p=num(tip.pl);
    if(p!=null) return p;
    var res=resultOf(tip);
    var u=num(tip.units), o=num(tip.odds);
    if(res==="win" && u>0 && o>1) return round2(u*(o-1));
    if(res==="loss" && u>0) return round2(-u);
    if(res==="push" || res==="void") return 0;
    return 0;
  }
  function stakeOf(tip){
    var u=num(tip.units);
    return u!=null && u>0 ? u : 0;
  }
  function whenOf(tip){
    var T=clock();
    var keys=["settled_at","graded_at","result_at","created_at","posted_at","date","ts","time"];
    for(var i=0;i<keys.length;i++){
      var v=tip[keys[i]];
      if(v==null || v==="") continue;
      if(T && typeof T.toMs==="function"){
        var ms=T.toMs(v);
        if(Number.isFinite(ms)) return ms;
      }
      var p=Date.parse(String(v));
      if(Number.isFinite(p)) return p;
    }
    return null;
  }
  function monthOf(tip){
    var ms=whenOf(tip);
    if(ms==null) return "";
    var T=clock();
    if(T && typeof T.monthKey==="function") return T.monthKey(ms)||"";
    var d=new Date(ms);
    if(!Number.isFinite(d.getTime())) return "";
    return d.getUTCFullYear()+"-"+String(d.getUTCMonth()+1).padStart(2,"0");
  }
  var MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  function monthLabel(key, withYear){
    var p=String(key||"").split("-");
    var mo=Number(p[1]);
    var name=MONTHS[(mo||1)-1]||key;
    if(withYear && p[0]) return name+" "+String(p[0]).slice(2);
    return name;
  }
  function sportOf(tip){
    var raw=tip.sport!=null?tip.sport:(tip.league!=null?tip.league:tip.comp);
    if(!raw && tip.tags && tip.tags.length) raw=tip.tags[0];
    raw=String(raw==null?"":raw).trim();
    if(!raw) return "";
    return raw;
  }
  function bookieOf(tip){
    var b=tip.bookie!=null?tip.bookie:(tip.bookmaker!=null?tip.bookmaker:(tip.book!=null?tip.book:tip.bookie_name));
    if(b && typeof b==="object") b=b.name||b.label||b.title||b.id||"";
    b=String(b==null?"":b).trim();
    if(!b || /^(no bookie|none|n\/a|na|—|-)$/i.test(b)) return "";
    return b;
  }
  function tipsterOf(tip){
    var keys=["tipster_name","tipster","author_name","posted_by_name","posted_by","username","user_name","member_name","discord_name","created_by_name","creator_name"];
    var i, v;
    for(i=0;i<keys.length;i++){
      v=tip[keys[i]];
      if(v && typeof v==="object") v=v.name||v.display_name||v.username||"";
      if(v!=null && String(v).trim()!=="") return String(v).trim();
    }
    var nests=["author","user","member","creator"];
    for(i=0;i<nests.length;i++){
      v=tip[nests[i]];
      if(v && typeof v==="object"){
        var name=v.name||v.display_name||v.username;
        if(name!=null && String(name).trim()!=="") return String(name).trim();
      }
    }
    if(tip.user_id!=null && String(tip.user_id).trim()!=="") return String(tip.user_id).trim();
    if(tip.author_id!=null && String(tip.author_id).trim()!=="") return String(tip.author_id).trim();
    return "";
  }
  function initials(name){
    var parts=String(name||"").replace(/^the\s+/i,"").split(/[^A-Za-z0-9]+/).filter(Boolean);
    if(!parts.length) return "?";
    if(parts.length===1) return parts[0].slice(0,2).toUpperCase();
    return (parts[0][0]+parts[1][0]).toUpperCase();
  }
  function fmtUnits(n){
    if(!Number.isFinite(Number(n))) return "—";
    var r=round1(n);
    var body=r.toFixed(1);
    return (r>0?"+":"")+body+"u";
  }
  function fmtPct(n, signed){
    if(!Number.isFinite(Number(n))) return "—";
    var r=round1(n);
    var body=r.toFixed(1);
    return (signed && r>0?"+":"")+body+"%";
  }
  function fmtStake(n){
    if(!Number.isFinite(Number(n))) return "0u staked";
    var r=round1(n);
    return r.toFixed(1)+"u staked";
  }
  function computeFromTips(settled){
    var won=0, lost=0, push=0, staked=0, profit=0;
    settled.forEach(function(t){
      var res=resultOf(t);
      if(res==="win") won++;
      else if(res==="loss") lost++;
      else push++;
      staked+=stakeOf(t);
      profit+=profitOf(t);
    });
    staked=round2(staked);
    profit=round2(profit);
    var decided=won+lost;
    return {
      won:won, lost:lost, push:push,
      settled:settled.length,
      staked:staked,
      profit:profit,
      roi:staked?round1((profit/staked)*100):0,
      strike:decided?round1((won/decided)*100):0
    };
  }
  function fromApiStats(st){
    st=st||{};
    var won=num(st.won)||0, lost=num(st.lost)||0, push=num(st.push)||0;
    var profit=num(st.profit_units);
    if(profit==null) profit=0;
    var staked=num(st.staked_units);
    if(staked==null) staked=0;
    var roi=num(st.roi);
    if(roi==null) roi=staked?round1((profit/staked)*100):0;
    var strike=num(st.strike_rate);
    if(strike==null){
      var decided=won+lost;
      strike=decided?round1((won/decided)*100):0;
    }
    var settled=num(st.settled);
    if(settled==null) settled=won+lost+push;
    return {won:won, lost:lost, push:push, settled:settled, staked:staked, profit:profit, roi:roi, strike:strike};
  }
  function cardModel(detail, opts){
    opts=opts||{};
    detail=detail||{};
    var b=buckets(detail);
    var raw=b.settled;
    var flagged=raw.filter(isHistoricalImport).length + b.queued.filter(isHistoricalImport).length;
    var clean=raw.filter(function(t){ return !isHistoricalImport(t); });
    var api=fromApiStats(detail.stats);
    var apiSettled=num(detail.stats && detail.stats.settled);
    if(apiSettled==null) apiSettled=(num(detail.stats && detail.stats.won)||0)+(num(detail.stats && detail.stats.lost)||0)+(num(detail.stats && detail.stats.push)||0);
    var useTips=false;
    if(flagged>0 && raw.length>0 && raw.length>=Math.max(1, apiSettled-flagged)) useTips=true;
    if(!raw.length && !detail.stats) useTips=true;
    var core=useTips?computeFromTips(clean):api;
    var qStale=!!opts.stale;
    var queued=num(detail.stats && detail.stats.queued);
    if(queued==null) queued=b.queued.filter(function(t){ return !isHistoricalImport(t); }).length;
    var followers=num(detail.stats && detail.stats.followers);
    if(followers==null) followers=0;
    return {
      source:useTips?"tips":"api",
      won:core.won, lost:core.lost, push:core.push,
      unitsText:fmtUnits(core.profit),
      unitsCls:core.profit>=0?"pos":"neg",
      stakedText:fmtStake(core.staked),
      roiText:fmtPct(core.roi, true),
      roiCls:core.roi>=0?"pos":"neg",
      strikeText:fmtPct(core.strike, false),
      strikeSub:core.won+" won · "+core.lost+" lost",
      recordText:core.won+"–"+core.lost,
      pushText:(core.push===1?"1 push":core.push+" push"),
      queuedText:qStale?"Updating…":String(queued),
      followersText:String(followers),
      settled:core.settled,
      staked:core.staked,
      profit:core.profit
    };
  }
  function unitsSeries(detail){
    var b=buckets(detail);
    var clean=b.settled.filter(function(t){ return !isHistoricalImport(t); });
    var flagged=b.settled.some(isHistoricalImport) || b.queued.some(isHistoricalImport);
    var rows=clean.map(function(t,i){ return {t:t, i:i, ms:whenOf(t)}; });
    rows.sort(function(a,b){
      if(a.ms==null && b.ms==null) return a.i-b.i;
      if(a.ms==null) return 1;
      if(b.ms==null) return -1;
      return a.ms-b.ms || a.i-b.i;
    });
    var pts=[], run=0;
    if(rows.length){
      pts.push({y:0, label:"Start"});
      rows.forEach(function(row){
        run=round2(run+profitOf(row.t));
        pts.push({y:run, label:pointLabel(row.ms), ms:row.ms});
      });
    }
    if(pts.length>=2) return {points:pts, fallback:false};
    if(flagged) return {points:[], fallback:false};
    var daily=detail && detail.daily_series;
    if(daily && typeof daily==="object"){
      var keys=Object.keys(daily).filter(function(k){ return daily[k] && num(daily[k].net)!=null; }).sort();
      if(keys.length){
        var dpts=[{y:0, label:"Start"}];
        var acc=0;
        keys.forEach(function(k){
          acc=round2(acc+Number(daily[k].net||0));
          dpts.push({y:acc, label:shortDay(k)});
        });
        if(dpts.length>=2) return {points:dpts, fallback:true};
      }
    }
    var series=Array.isArray(detail && detail.profit_series)?detail.profit_series:[];
    if(series.length){
      var mpts=[{y:0, label:"Start"}];
      var macc=0;
      series.forEach(function(p){
        macc=round2(macc+Number(p && p.profit || 0));
        mpts.push({y:macc, label:monthLabel(p && p.month, true)});
      });
      if(mpts.length>=2) return {points:mpts, fallback:true};
    }
    return {points:[], fallback:false};
  }
  function shortDay(key){
    var p=String(key||"").split("-");
    var mo=MONTHS[(Number(p[1])||1)-1]||"";
    return (p[2]?String(Number(p[2]))+" ":"")+mo;
  }
  function pointLabel(ms){
    if(ms==null) return "";
    var T=clock();
    if(T && typeof T.dayKey==="function") return shortDay(T.dayKey(ms));
    var d=new Date(ms);
    return d.getUTCDate()+" "+(MONTHS[d.getUTCMonth()]||"");
  }
  function monthlyBars(detail){
    var b=buckets(detail);
    var clean=b.settled.filter(function(t){ return !isHistoricalImport(t); });
    var flagged=b.settled.some(isHistoricalImport) || b.queued.some(isHistoricalImport);
    var map={}, order=[];
    clean.forEach(function(t){
      var key=monthOf(t);
      if(!key) return;
      if(!map[key]){ map[key]={key:key, value:0, bets:0, wins:0, losses:0}; order.push(key); }
      var row=map[key];
      row.value=round2(row.value+profitOf(t));
      row.bets++;
      var res=resultOf(t);
      if(res==="win") row.wins++;
      else if(res==="loss") row.losses++;
    });
    order.sort();
    if(order.length){
      var years={};
      order.forEach(function(k){ years[k.slice(0,4)]=1; });
      var multi=Object.keys(years).length>1;
      return order.map(function(k){
        var row=map[k];
        var decided=row.wins+row.losses;
        return {
          key:k, label:monthLabel(k, multi), value:row.value,
          bets:row.bets, wins:row.wins,
          winRate:decided?round1((row.wins/decided)*100):0
        };
      });
    }
    if(flagged) return [];
    var series=Array.isArray(detail && detail.profit_series)?detail.profit_series:[];
    var years2={};
    series.forEach(function(p){ if(p && p.month) years2[String(p.month).slice(0,4)]=1; });
    var multi2=Object.keys(years2).length>1;
    return series.filter(function(p){ return p && p.month; }).map(function(p){
      return {key:String(p.month), label:monthLabel(p.month, multi2), value:round2(Number(p.profit)||0), bets:0, wins:0, winRate:0};
    });
  }
  function sportBreakdown(detail){
    var b=buckets(detail);
    var tips=b.settled.concat(b.queued).filter(function(t){ return !isHistoricalImport(t); });
    var counts={}, named=0;
    tips.forEach(function(t){
      var name=sportOf(t);
      if(!name) return;
      named++;
      counts[name]=(counts[name]||0)+1;
    });
    if(!named) return null;
    var rows=Object.keys(counts).map(function(name){ return {name:name, n:counts[name]}; });
    rows.sort(function(a,b){ return b.n-a.n || a.name.localeCompare(b.name); });
    if(rows.length>8){
      var top=rows.slice(0,7);
      var rest=rows.slice(7).reduce(function(a,r){ return a+r.n; }, 0);
      top.push({name:"Other", n:rest});
      rows=top;
    }
    var total=rows.reduce(function(a,r){ return a+r.n; }, 0);
    return {
      total:total,
      slices:rows.map(function(r,i){
        return {name:r.name, n:r.n, pct:Math.round(r.n/total*100), color:DONUT_COLORS[i%DONUT_COLORS.length]};
      })
    };
  }
  function tipMatchesFilter(t, filter){
    if(!filter || !filter.kind) return true;
    if(filter.kind==="bookie") return bookieOf(t)===filter.key;
    if(filter.kind==="sport") return sportOf(t)===filter.key;
    if(filter.kind==="month") return monthOf(t)===filter.key;
    return true;
  }
  function detailWithFilter(detail, filter){
    if(!filter || !filter.kind) return detail;
    detail=detail||{};
    var b=buckets(detail);
    var fSettled=b.settled.filter(function(t){ return tipMatchesFilter(t, filter); });
    var fQueued=b.queued.filter(function(t){ return tipMatchesFilter(t, filter); });
    var clean=fSettled.filter(function(t){ return !isHistoricalImport(t); });
    var core=computeFromTips(clean);
    var q=fQueued.filter(function(t){ return !isHistoricalImport(t); }).length;
    var out=Object.assign({}, detail);
    out.tips={settled:fSettled, queued:fQueued};
    out.stats=Object.assign({}, detail.stats||{}, {
      won:core.won, lost:core.lost, push:core.push, settled:core.settled,
      profit_units:core.profit, staked_units:core.staked, roi:core.roi, strike_rate:core.strike,
      queued:q
    });
    out.profit_series=undefined;
    out.daily_series=undefined;
    return out;
  }
  function filterChipHtml(filter){
    if(!filter || !filter.label) return "";
    var kind=filter.kind||"";
    return '<span class="sv-filter-chip chip"><span>'+esc(filter.label)+'</span><button type="button" class="x sv-filter-clear" aria-label="Clear filter" data-sv-clear="1">×</button></span>';
  }
  function legendRow(s, kind, active){
    var on=active && active.kind===kind && active.key===s.name;
    return '<div class="sv-legend-row clk'+(on?" sv-active":"")+'" role="button" tabindex="0" data-sv-kind="'+esc(kind)+'" data-sv-key="'+esc(s.name)+'">'
      +'<i style="background:'+s.color+'"></i><span class="nm">'+esc(s.name)+'</span><b>'+s.n+"</b><em>"+s.pct+"%</em></div>";
  }
  var DONUT_COLORS=["var(--accent)","var(--accent2)","var(--win)","var(--warn, #e0a04a)","var(--push)"];
  function bookieBreakdown(detail){
    var b=buckets(detail);
    var tips=b.settled.concat(b.queued).filter(function(t){ return !isHistoricalImport(t); });
    var counts={}, named=0, blank=0;
    tips.forEach(function(t){
      var name=bookieOf(t);
      if(!name){ blank++; return; }
      named++;
      counts[name]=(counts[name]||0)+1;
    });
    if(!named) return null;
    var rows=Object.keys(counts).map(function(name){ return {name:name, n:counts[name]}; });
    rows.sort(function(a,b){ return b.n-a.n || a.name.localeCompare(b.name); });
    if(rows.length>8){
      var top=rows.slice(0,7);
      var rest=rows.slice(7).reduce(function(a,r){ return a+r.n; }, 0);
      top.push({name:"Other", n:rest});
      rows=top;
    }
    var total=rows.reduce(function(a,r){ return a+r.n; }, 0);
    return {
      total:total,
      unlabeled:blank,
      slices:rows.map(function(r,i){
        return {name:r.name, n:r.n, pct:Math.round(r.n/total*100), color:DONUT_COLORS[i%DONUT_COLORS.length]};
      })
    };
  }
  function tipsterBreakdown(detail){
    var b=buckets(detail);
    var tips=b.settled.concat(b.queued).filter(function(t){ return !isHistoricalImport(t); });
    var map={};
    var any=false;
    tips.forEach(function(t){
      var name=tipsterOf(t);
      if(!name) return;
      any=true;
      if(!map[name]) map[name]={name:name, bets:0, units:0};
      map[name].bets++;
      if(isSettledTip(t)) map[name].units=round2(map[name].units+profitOf(t));
    });
    if(!any) return [];
    return Object.keys(map).map(function(k){ return map[k]; }).sort(function(a,b){
      return b.units-a.units || b.bets-a.bets || a.name.localeCompare(b.name);
    }).map(function(row){
      return {name:row.name, bets:row.bets, units:row.units, unitsText:fmtUnits(row.units), initials:initials(row.name), cls:row.units>=0?"pos":"neg"};
    });
  }
  function xLabels(points){
    if(!points || points.length<2) return [];
    var last=points.length-1;
    var mid=Math.round(last/2);
    var out=[[0, points[0].label||"Start"]];
    if(mid!==0 && mid!==last) out.push([mid, points[mid].label||""]);
    out.push([last, points[last].label||""]);
    return out;
  }
  function yFmtUnits(v){
    var r=round1(v);
    return (r>0?"+":"")+r.toFixed(r%1?1:0).replace(/\.0$/,"") ;
  }
  function statsHtml(detail, opts){
    opts=opts||{};
    var m=cardModel(detail, opts);
    var form=opts.formHtml?String(opts.formHtml):"";
    var cards=""
      +card("Units", m.unitsText, m.unitsCls, m.stakedText, "units")
      +card("ROI", m.roiText, m.roiCls, "Profit ÷ units staked", "roi")
      +card("Strike rate", m.strikeText, "", m.strikeSub, "strike")
      +card("Record", m.recordText, "", m.pushText, "record");
    if(form){
      cards+='<div class="sv-stat sv-form"><div class="k">Form</div><div class="sv-form-body">'+form+"</div></div>";
    }
    var qCls=m.queuedText==="Updating…"?" st-updating":"";
    return '<div id="sv-stats-mount"><div class="sv-stats" id="stats-wrap">'
      +cards+"</div>"
      +'<div class="sv-jumps">'
      +'<button type="button" class="tile clk sv-jump" data-act="queued"><span class="sv-jump-k">Queued</span><b class="sv-jump-v'+qCls+'" data-sv="queued">'+esc(m.queuedText)+"</b></button>"
      +'<button type="button" class="tile clk sv-jump" data-act="followers"><span class="sv-jump-k">Followers</span><b class="sv-jump-v" data-sv="followers">'+esc(m.followersText)+"</b></button>"
      +"</div></div>";
  }
  function card(k, v, cls, sub, key){
    return '<div class="sv-stat"><div class="k">'+esc(k)+'</div><div class="v'+(cls?" "+cls:"")+'" data-sv="'+key+'">'+esc(v)+'</div><div class="s" data-sv-sub="'+key+'">'+esc(sub)+"</div></div>";
  }
  function chartsHtml(detail, opts){
    opts=opts||{};
    var C=chartsApi();
    var series=unitsSeries(detail);
    var bars=monthlyBars(detail);
    var m=cardModel(detail, opts);
    var period=opts.period?String(opts.period):"";
    var line="";
    if(C && series.points.length>=2){
      var ys=series.points.map(function(p){ return p.y; });
      line=C.areaChart({
        data:ys, w:640, h:220, id:"svu", smooth:0.65, padL:48,
        xLabels:xLabels(series.points),
        yFmt:function(v){ return yFmtUnits(v); },
        aria:"Units over time, ending "+m.unitsText
      });
    }
    var bar="";
    if(C && bars.length){
      bar=C.barChart({
        bars:bars, w:520, h:220, padL:48,
        yFmt:function(v){ return yFmtUnits(v); },
        aria:"Monthly profit and loss"
      });
    }
    var lineBody=line
      ?('<div class="sv-big"><b class="'+m.unitsCls+'" data-sv="units-big">'+esc(m.unitsText)+"</b> across "+esc(String(m.settled))+" settled</div><div class=\"sv-chart\" data-sv-chart=\"units\">"+line+"</div>")
      :'<div class="sv-empty">Not enough settled tips to draw a line yet.</div>';
    var barBody=bar
      ?'<div class="sv-chart" data-sv-chart="monthly">'+bar+"</div>"
      :'<div class="sv-empty">No monthly results in this view yet.</div>';
    return '<div class="sv-charts">'
      +'<section class="sv-panel" aria-label="Units over time"><div class="sv-ph"><h2>Units over time</h2>'+(period?'<span class="sv-ph-s">'+esc(period)+"</span>":"")+"</div>"+lineBody+"</section>"
      +'<section class="sv-panel" aria-label="Monthly P and L"><div class="sv-ph"><h2>Monthly P&amp;L</h2>'+(period?'<span class="sv-ph-s">'+esc(period)+"</span>":"")+"</div>"+barBody+"</section>"
      +"</div>";
  }
  function splitsHtml(detail, opts){
    opts=opts||{};
    var books=bookieBreakdown(detail);
    var sports=sportBreakdown(detail);
    var people=tipsterBreakdown(detail);
    if(!books && !sports && !people.length) return "";
    var period=opts.period?String(opts.period):"";
    var active=opts.filter||null;
    var html='<div class="sv-split">';
    if(books){
      var C=chartsApi();
      var svg=C?C.donut({slices:books.slices, center:String(books.total), sub:"bets", aria:"Bets by bookie, "+books.total+" bets"}):"";
      html+='<section class="sv-panel" aria-label="Bets by bookie"><div class="sv-ph"><h2>Bets by bookie</h2>'+(period?'<span class="sv-ph-s">'+esc(period)+"</span>":"")+"</div>"
        +'<div class="sv-donut-row">'+svg+'<div class="sv-legend">'
        +books.slices.map(function(s){ return legendRow(s, "bookie", active); }).join("")
        +"</div></div></section>";
    }
    if(sports){
      var C2=chartsApi();
      var svg2=C2?C2.donut({slices:sports.slices, center:String(sports.total), sub:"bets", aria:"Bets by sport, "+sports.total+" bets"}):"";
      html+='<section class="sv-panel" aria-label="Bets by sport"><div class="sv-ph"><h2>Bets by sport</h2>'+(period?'<span class="sv-ph-s">'+esc(period)+"</span>":"")+"</div>"
        +'<div class="sv-donut-row">'+svg2+'<div class="sv-legend">'
        +sports.slices.map(function(s){ return legendRow(s, "sport", active); }).join("")
        +"</div></div></section>";
    }
    if(people.length){
      var show=people.slice(0,12);
      html+='<section class="sv-panel sv-tipsters" aria-label="Tipsters in this server"><div class="sv-ph"><h2>Tipsters in this server</h2>'+(period?'<span class="sv-ph-s">'+esc(period)+"</span>":"")+"</div>"
        +'<div class="sv-ranks">'
        +show.map(function(t,i){
          return '<div class="sv-rank"><span class="sv-n">'+(i+1)+'</span><span class="sv-av" aria-hidden="true">'+esc(t.initials)+'</span>'
            +'<div class="sv-who"><div class="sv-nm">'+esc(t.name)+'</div><div class="sv-sb">'+t.bets+" tip"+(t.bets===1?"":"s")+"</div></div>"
            +'<span class="sv-pl '+t.cls+'">'+esc(t.unitsText)+"</span></div>";
        }).join("")
        +"</div></section>";
    }
    return html+"</div>";
  }
  function blocks(detail, opts){
    opts=opts||{};
    return {stats:statsHtml(detail, opts), charts:chartsHtml(detail, opts), splits:splitsHtml(detail, opts), filterChip:filterChipHtml(opts.filter)};
  }
  function filterLabel(kind, key){
    if(kind==="month") return monthLabel(key, true);
    return String(key||"");
  }
  function nearestIndex(n, len){
    if(!(len>1)) return 0;
    var i=Math.round(n*(len-1));
    if(i<0) return 0;
    if(i>len-1) return len-1;
    return i;
  }
  function chartTip(el, text, x, y){
    if(!el) return;
    var tip=el.querySelector(".sv-chart-tip");
    if(!tip){
      tip=document.createElement("div");
      tip.className="sv-chart-tip";
      tip.setAttribute("role","tooltip");
      el.appendChild(tip);
    }
    tip.textContent=text;
    tip.hidden=false;
    tip.style.left=Math.round(x)+"px";
    tip.style.top=Math.round(y)+"px";
  }
  function hideChartTip(el){
    if(!el) return;
    var tip=el.querySelector(".sv-chart-tip");
    if(tip) tip.hidden=true;
  }
  function bindUnitsChart(wrap, series){
    if(!wrap || !series || !series.points || series.points.length<2) return;
    var svg=wrap.querySelector("svg");
    if(!svg) return;
    var pts=series.points;
    var padL=48, w=640, h=220, padT=12, padB=26, padR=12;
    var data=pts.map(function(p){ return p.y; });
    var lo=Math.min.apply(null, data.concat([0]));
    var hi=Math.max.apply(null, data.concat([0]));
    if(!(hi>lo)){ lo-=1; hi+=1; }
    var pad=(hi-lo)*0.08;
    lo-=pad; hi+=pad;
    function X(i){ return padL+(w-padL-padR)*i/(data.length-1); }
    function Y(v){ return padT+(h-padT-padB)*(1-(v-lo)/(hi-lo)); }
    var cross=svg.querySelector(".sv-crosshair");
    if(!cross){
      cross=document.createElementNS("http://www.w3.org/2000/svg","g");
      cross.setAttribute("class","sv-crosshair");
      cross.setAttribute("aria-hidden","true");
      cross.innerHTML='<line class="sv-cross-v" y1="'+padT+'" y2="'+(h-padB)+'" stroke="var(--muted)" stroke-width="1" stroke-dasharray="3 3"/><circle class="sv-cross-dot" r="4" fill="var(--accent)" stroke="var(--card)" stroke-width="1.5"/>';
      svg.appendChild(cross);
    }
    var vLine=cross.querySelector(".sv-cross-v");
    var dot=cross.querySelector(".sv-cross-dot");
    function showAt(i, clientX, clientY){
      var p=pts[i];
      if(!p) return;
      var cx=X(i), cy=Y(p.y);
      vLine.setAttribute("x1", r1(cx)); vLine.setAttribute("x2", r1(cx));
      dot.setAttribute("cx", r1(cx)); dot.setAttribute("cy", r1(cy));
      cross.style.opacity="1";
      var label=(p.label||"")+(p.ms?(" · "+pointLabel(p.ms)):"");
      var tipTxt=fmtUnits(p.y)+(label?(" · "+label):"");
      var rect=wrap.getBoundingClientRect();
      chartTip(wrap, tipTxt, clientX-rect.left, clientY-rect.top-36);
    }
    function hide(){
      cross.style.opacity="0";
      hideChartTip(wrap);
    }
    function pick(ev){
      var hit=svg.querySelector(".sv-chart-hit");
      if(!hit) return;
      var box=hit.getBoundingClientRect();
      var n=(ev.clientX-box.left)/Math.max(1, box.width);
      showAt(nearestIndex(n, data.length), ev.clientX, ev.clientY);
    }
    svg.onpointermove=function(ev){
      if(ev.pointerType==="mouse") pick(ev);
      else if(wrap.hasPointerCapture&&wrap.hasPointerCapture(ev.pointerId)) pick(ev);
    };
    svg.onpointerdown=function(ev){
      if(ev.pointerType!=="mouse"&&wrap.setPointerCapture) wrap.setPointerCapture(ev.pointerId);
      pick(ev);
    };
    svg.onpointerup=function(ev){
      if(ev.pointerType!=="mouse"&&wrap.releasePointerCapture) try{ wrap.releasePointerCapture(ev.pointerId); }catch(_){}
    };
    svg.onpointerleave=hide;
    wrap.onmouseleave=hide;
  }
  function bindMonthlyChart(wrap, bars, onFilter){
    if(!wrap || !bars || !bars.length) return;
    var meta={};
    bars.forEach(function(b){ meta[b.key]=b; });
    function tipText(b){
      var wr=b.winRate!=null?(" · "+fmtPct(b.winRate, false)+" win rate"):"";
      return (b.label||b.key)+": "+fmtUnits(b.value)+" · "+(b.bets||0)+" bets"+wr;
    }
    wrap.querySelectorAll(".sv-bar").forEach(function(rect){
      rect.style.cursor="pointer";
      var key=rect.getAttribute("data-sv-month")||"";
      var b=meta[key];
      if(!b) return;
      rect.onmouseenter=function(ev){
        var box=wrap.getBoundingClientRect();
        chartTip(wrap, tipText(b), ev.clientX-box.left, ev.clientY-box.top-32);
      };
      rect.onmousemove=function(ev){
        var box=wrap.getBoundingClientRect();
        chartTip(wrap, tipText(b), ev.clientX-box.left, ev.clientY-box.top-32);
      };
      rect.onmouseleave=function(){ hideChartTip(wrap); };
      rect.onclick=function(){
        if(typeof onFilter==="function") onFilter({kind:"month", key:key, label:filterLabel("month", key)});
      };
      rect.onkeydown=function(ev){
        if(ev.key==="Enter"||ev.key===" "){ ev.preventDefault(); rect.click(); }
      };
    });
  }
  function bindLegend(mount, onFilter, active){
    mount.querySelectorAll(".sv-legend-row").forEach(function(row){
      var kind=row.getAttribute("data-sv-kind")||"";
      var key=row.getAttribute("data-sv-key")||"";
      row.onclick=function(){
        if(typeof onFilter!=="function") return;
        if(active && active.kind===kind && active.key===key) onFilter(null);
        else onFilter({kind:kind, key:key, label:filterLabel(kind, key)});
      };
      row.onkeydown=function(ev){
        if(ev.key==="Enter"||ev.key===" "){ ev.preventDefault(); row.click(); }
      };
    });
    mount.querySelectorAll(".sv-donut-slice").forEach(function(path){
      var key=path.getAttribute("data-sv-slice")||"";
      var panel=path.closest(".sv-panel");
      var kind=panel && /sport/i.test(panel.getAttribute("aria-label")||"")?"sport":"bookie";
      path.style.cursor="pointer";
      path.onclick=function(){
        if(typeof onFilter!=="function") return;
        if(active && active.kind===kind && active.key===key) onFilter(null);
        else onFilter({kind:kind, key:key, label:filterLabel(kind, key)});
      };
      path.onkeydown=function(ev){
        if(ev.key==="Enter"||ev.key===" "){ ev.preventDefault(); path.click(); }
      };
    });
  }
  function bindInteractions(mount, detail, opts, handlers){
    if(!mount || !handlers) return;
    opts=opts||{};
    handlers=handlers||{};
    var onFilter=handlers.onFilter;
    var active=opts.filter||null;
    bindUnitsChart(mount.querySelector('[data-sv-chart="units"]'), unitsSeries(detail));
    bindMonthlyChart(mount.querySelector('[data-sv-chart="monthly"]'), monthlyBars(detail), onFilter);
    bindLegend(mount, onFilter, active);
    mount.querySelectorAll(".sv-filter-clear").forEach(function(btn){
      btn.onclick=function(ev){ ev.preventDefault(); if(typeof handlers.onClear==="function") handlers.onClear(); };
    });
    if(handlers.form && typeof root.FormBadges!=="undefined" && root.FormBadges && typeof root.FormBadges.bindTooltips==="function"){
      root.FormBadges.bindTooltips(mount, handlers.form);
    }
  }
  function applyCards(rootEl, detail, opts){
    if(!rootEl || !rootEl.querySelector) return;
    var m=cardModel(detail, opts||{});
    function set(key, text, cls){
      rootEl.querySelectorAll('[data-sv="'+key+'"]').forEach(function(el){
        el.textContent=text;
        if(cls){
          el.classList.toggle("pos", cls==="pos");
          el.classList.toggle("neg", cls==="neg");
        }
      });
    }
    set("units", m.unitsText, m.unitsCls);
    set("units-big", m.unitsText, m.unitsCls);
    set("roi", m.roiText, m.roiCls);
    set("strike", m.strikeText, "");
    set("record", m.recordText, "");
    set("queued", m.queuedText, "");
    set("followers", m.followersText, "");
    var strikeSub=rootEl.querySelector('[data-sv-sub="strike"]');
    if(strikeSub) strikeSub.textContent=m.strikeSub;
    var pushSub=rootEl.querySelector('[data-sv-sub="push"]') || rootEl.querySelector('[data-sv-sub="record"]');
    if(pushSub) pushSub.textContent=m.pushText;
    var stake=rootEl.querySelector('[data-sv-sub="units"]');
    if(stake) stake.textContent=m.stakedText;
    var q=rootEl.querySelector('[data-sv="queued"]');
    if(q) q.classList.toggle("st-updating", m.queuedText==="Updating…");
  }
  var api={
    isHistoricalImport:isHistoricalImport,
    resultOf:resultOf,
    cardModel:cardModel,
    computeFromTips:computeFromTips,
    unitsSeries:unitsSeries,
    monthlyBars:monthlyBars,
    bookieBreakdown:bookieBreakdown,
    sportBreakdown:sportBreakdown,
    sportOf:sportOf,
    tipsterBreakdown:tipsterBreakdown,
    detailWithFilter:detailWithFilter,
    filterChipHtml:filterChipHtml,
    statsHtml:statsHtml,
    chartsHtml:chartsHtml,
    splitsHtml:splitsHtml,
    blocks:blocks,
    bindInteractions:bindInteractions,
    applyCards:applyCards,
    fmtUnits:fmtUnits,
    bookieOf:bookieOf,
    tipsterOf:tipsterOf
  };
  root.ServerView=api;
  if(typeof module!=="undefined" && module.exports) module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
