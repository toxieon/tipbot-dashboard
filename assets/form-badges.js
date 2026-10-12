/* Tipster form badges (tipdash 0.43.6).
 * form = { last10: ["W","L","P",...] newest first (0–10),
 *          streak: { type: "W"|"L"|null, n: int }, hot: bool }
 * Missing form renders nothing. window.FormBadges + CommonJS for node --test.
 */
(function(root){
  function esc(s){
    return String(s==null?"":s).replace(/[&<>"']/g, function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c];
    });
  }
  function letter(raw){
    var s=String(raw==null?"":raw).trim().toUpperCase();
    if(s==="W"||s==="WIN") return "W";
    if(s==="L"||s==="LOSS") return "L";
    if(s==="P"||s==="PUSH"||s==="V"||s==="VOID") return "P";
    return "";
  }
  function dotColor(L){
    if(L==="W") return "var(--win)";
    if(L==="L") return "var(--loss)";
    return "var(--muted)";
  }
  function streakOf(form){
    var st=form&&form.streak;
    if(!st||typeof st!=="object") return null;
    var type=st.type==null?"":String(st.type).trim().toUpperCase();
    if(type!=="W"&&type!=="L") return null;
    var n=Number(st.n);
    if(!Number.isFinite(n)||n<=0) return null;
    return {type:type, n:Math.floor(n)};
  }
  function fmtOdds(v){
    var n=Number(v);
    if(!Number.isFinite(n)) return "—";
    return n.toFixed(2).replace(/\.00$/,"");
  }
  function fmtStake(v){
    var n=Number(v);
    if(!Number.isFinite(n)) return "—";
    return n+"u";
  }
  function fmtDate(v){
    if(v==null || v==="") return "";
    var s=String(v);
    if(/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    var p=Date.parse(s);
    if(Number.isFinite(p)){
      var d=new Date(p);
      return d.getUTCFullYear()+"-"+String(d.getUTCMonth()+1).padStart(2,"0")+"-"+String(d.getUTCDate()).padStart(2,"0");
    }
    return s;
  }
  function entryLine(ent){
    if(!ent || typeof ent!=="object") return "";
    var sel=ent.selection!=null?ent.selection:(ent.sel!=null?ent.sel:ent.pick);
    var market=ent.market!=null?ent.market:(ent.bet_type!=null?ent.bet_type:ent.market_name);
    var odds=ent.odds!=null?ent.odds:ent.price;
    var stake=ent.stake!=null?ent.stake:(ent.units!=null?ent.units:ent.stake_units);
    var res=ent.result!=null?ent.result:(ent.outcome!=null?ent.outcome:"");
    var date=ent.date!=null?ent.date:(ent.settled_at!=null?ent.settled_at:ent.graded_at);
    var parts=[];
    if(sel) parts.push(String(sel));
    if(market) parts.push(String(market));
    if(odds!=null && odds!=="") parts.push("@"+fmtOdds(odds));
    if(stake!=null && stake!=="") parts.push(fmtStake(stake));
    if(res) parts.push(String(res));
    if(date) parts.push(fmtDate(date));
    return parts.join(" · ");
  }
  function describe(letters, streak, hot){
    var parts=[];
    if(letters.length) parts.push("Last 10: "+letters.join(" "));
    if(streak){
      var word=streak.type==="W"?(streak.n===1?"win":"wins"):(streak.n===1?"loss":"losses");
      parts.push("Streak "+streak.n+" "+word);
    }
    if(hot) parts.push("Hot");
    return parts.join(" ");
  }
  function render(form){
    if(!form||typeof form!=="object"||Array.isArray(form)) return "";
    var raw=Array.isArray(form.last10)?form.last10.slice(0,10):[];
    var entries=Array.isArray(form.entries)?form.entries:[];
    var letters=[];
    for(var i=0;i<raw.length;i++){
      var L=letter(raw[i]);
      if(L) letters.push(L);
    }
    var streak=streakOf(form);
    var hot=form.hot===true;
    if(!letters.length&&!streak&&!hot) return "";
    var dots="";
    if(letters.length){
      dots='<span class="tb-form-dots" aria-hidden="true">'+letters.map(function(L, idx){
        var tip=entries[idx]?entryLine(entries[idx]):"";
        var attrs=' class="tb-form-dot" data-r="'+L+'" data-form-i="'+idx+'" style="background:'+dotColor(L)+'"';
        if(tip) attrs+=' title="'+esc(tip)+'"';
        return "<span"+attrs+"></span>";
      }).join("")+"</span>";
    }
    var tag="";
    if(hot){
      tag='<span class="tb-form-hot" aria-hidden="true">🔥'+(streak?" "+streak.n+streak.type:"")+"</span>";
    }else if(streak){
      tag='<span class="tb-form-streak" aria-hidden="true">'+streak.type+streak.n+"</span>";
    }
    var streakAttr=streak?' data-streak="'+streak.type+'" data-streak-n="'+streak.n+'"':"";
    return '<span class="tb-form"'+streakAttr+' role="img" aria-label="'+esc(describe(letters, streak, hot))+'">'+dots+tag+"</span>";
  }
  function renderList(tipsters){
    var list=Array.isArray(tipsters)?tipsters:[];
    var rows=[];
    for(var i=0;i<list.length;i++){
      var t=list[i];
      if(!t||typeof t!=="object") continue;
      var badge=render(t.form);
      if(!badge) continue;
      var name=(t.name!=null&&String(t.name)!=="")?t.name:(t.user_id!=null?t.user_id:"");
      rows.push('<div class="tb-form-row">'+badge+'<span class="tb-form-name">'+esc(name)+"</span></div>");
    }
    if(!rows.length) return "";
    return '<div class="tb-form-list">'+rows.join("")+"</div>";
  }
  function bindTooltips(scope, form){
    if(!scope || !form || typeof form!=="object") return;
    var entries=Array.isArray(form.entries)?form.entries:[];
    if(!entries.length) return;
    scope.querySelectorAll(".tb-form-dot[data-form-i]").forEach(function(dot){
      var i=Number(dot.getAttribute("data-form-i"));
      var ent=entries[i];
      var text=entryLine(ent);
      if(!text) return;
      dot.setAttribute("title", text);
      dot.setAttribute("aria-label", text);
      dot.style.cursor="help";
      dot.onpointerdown=function(ev){
        if(ev.pointerType==="mouse") return;
        ev.preventDefault();
        var tip=dot._tbTip;
        if(!tip){
          tip=document.createElement("div");
          tip.className="tb-form-tip";
          tip.setAttribute("role","tooltip");
          dot._tbTip=tip;
          (dot.offsetParent||scope).appendChild(tip);
        }
        tip.textContent=text;
        tip.hidden=false;
        var r=dot.getBoundingClientRect();
        var host=tip.offsetParent&&tip.offsetParent.getBoundingClientRect?tip.offsetParent.getBoundingClientRect():{left:0,top:0};
        tip.style.left=(r.left-host.left)+"px";
        tip.style.top=(r.top-host.top-8-tip.offsetHeight)+"px";
        clearTimeout(dot._tbTipTimer);
        dot._tbTipTimer=setTimeout(function(){ if(tip) tip.hidden=true; }, 3200);
      };
    });
  }
  var api={render:render, renderList:renderList, bindTooltips:bindTooltips, entryLine:entryLine};
  root.FormBadges=api;
  if(typeof module!=="undefined"&&module.exports) module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
