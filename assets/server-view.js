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
      if(!map[key]){ map[key]={key:key, value:0}; order.push(key); }
      map[key].value=round2(map[key].value+profitOf(t));
    });
    order.sort();
    if(order.length){
      var years={};
      order.forEach(function(k){ years[k.slice(0,4)]=1; });
      var multi=Object.keys(years).length>1;
      return order.map(function(k){
        return {key:k, label:monthLabel(k, multi), value:map[k].value};
      });
    }
    if(flagged) return [];
    var series=Array.isArray(detail && detail.profit_series)?detail.profit_series:[];
    var years2={};
    series.forEach(function(p){ if(p && p.month) years2[String(p.month).slice(0,4)]=1; });
    var multi2=Object.keys(years2).length>1;
    return series.filter(function(p){ return p && p.month; }).map(function(p){
      return {key:String(p.month), label:monthLabel(p.month, multi2), value:round2(Number(p.profit)||0)};
    });
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
      ?('<div class="sv-big"><b class="'+m.unitsCls+'" data-sv="units-big">'+esc(m.unitsText)+"</b> across "+esc(String(m.settled))+" settled</div><div class=\"sv-chart\">"+line+"</div>")
      :'<div class="sv-empty">Not enough settled tips to draw a line yet.</div>';
    var barBody=bar
      ?'<div class="sv-chart">'+bar+"</div>"
      :'<div class="sv-empty">No monthly results in this view yet.</div>';
    return '<div class="sv-charts">'
      +'<section class="sv-panel" aria-label="Units over time"><div class="sv-ph"><h2>Units over time</h2>'+(period?'<span class="sv-ph-s">'+esc(period)+"</span>":"")+"</div>"+lineBody+"</section>"
      +'<section class="sv-panel" aria-label="Monthly P and L"><div class="sv-ph"><h2>Monthly P&amp;L</h2>'+(period?'<span class="sv-ph-s">'+esc(period)+"</span>":"")+"</div>"+barBody+"</section>"
      +"</div>";
  }
  function splitsHtml(detail, opts){
    opts=opts||{};
    var books=bookieBreakdown(detail);
    var people=tipsterBreakdown(detail);
    if(!books && !people.length) return "";
    var period=opts.period?String(opts.period):"";
    var html='<div class="sv-split">';
    if(books){
      var C=chartsApi();
      var svg=C?C.donut({slices:books.slices, center:String(books.total), sub:"bets", aria:"Bets by bookie, "+books.total+" bets"}):"";
      html+='<section class="sv-panel" aria-label="Bets by bookie"><div class="sv-ph"><h2>Bets by bookie</h2>'+(period?'<span class="sv-ph-s">'+esc(period)+"</span>":"")+"</div>"
        +'<div class="sv-donut-row">'+svg+'<div class="sv-legend">'
        +books.slices.map(function(s){
          return '<div><i style="background:'+s.color+'"></i><span class="nm">'+esc(s.name)+'</span><b>'+s.n+"</b><em>"+s.pct+"%</em></div>";
        }).join("")
        +"</div></div></section>";
    }
    if(people.length){
      var show=people.slice(0,12);
      html+='<section class="sv-panel" aria-label="Tipsters in this server"><div class="sv-ph"><h2>Tipsters in this server</h2>'+(period?'<span class="sv-ph-s">'+esc(period)+"</span>":"")+"</div>"
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
    return {stats:statsHtml(detail, opts), charts:chartsHtml(detail, opts), splits:splitsHtml(detail, opts)};
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
    tipsterBreakdown:tipsterBreakdown,
    statsHtml:statsHtml,
    chartsHtml:chartsHtml,
    splitsHtml:splitsHtml,
    blocks:blocks,
    applyCards:applyCards,
    fmtUnits:fmtUnits,
    bookieOf:bookieOf,
    tipsterOf:tipsterOf
  };
  root.ServerView=api;
  if(typeof module!=="undefined" && module.exports) module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
