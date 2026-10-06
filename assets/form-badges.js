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
      dots='<span class="tb-form-dots" aria-hidden="true">'+letters.map(function(L){
        return '<span class="tb-form-dot" style="background:'+dotColor(L)+'"></span>';
      }).join("")+"</span>";
    }
    var tag="";
    if(hot){
      tag='<span class="tb-form-hot" aria-hidden="true">🔥'+(streak?" "+streak.n+streak.type:"")+"</span>";
    }else if(streak){
      tag='<span class="tb-form-streak" aria-hidden="true">'+streak.type+streak.n+"</span>";
    }
    return '<span class="tb-form" role="img" aria-label="'+esc(describe(letters, streak, hot))+'">'+dots+tag+"</span>";
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
  var api={render:render, renderList:renderList};
  root.FormBadges=api;
  if(typeof module!=="undefined"&&module.exports) module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
