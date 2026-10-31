/* tipdash owner-only: Horse profile download + Race predictor (TipBot /api/owner/horse/*).
 * Private asset (build-public ASSET_DENY). Mounted into Settings by openOwnerSettings().
 * Reports come back as printable HTML; "Download PDF" opens it and starts the browser's
 * print dialog (Save as PDF). Prediction only — not betting advice.
 */
(function(){
  const TD=(window.TD=window.TD||{});
  const H="&#8212;";
  function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
  function when(iso){ try{ return new Date(iso).toLocaleString("en-AU",{weekday:"short",hour:"numeric",minute:"2-digit",timeZone:"Australia/Melbourne"}); }catch(e){ return iso||""; } }
  async function getJson(call,path){
    const r=await call(path);
    if(r.status===401) throw Object.assign(new Error("Session expired."),{unauth:true});
    const j=await r.json().catch(()=>({}));
    if(!r.ok||j.ok===false) throw new Error(j.error==="unavailable"?"Racing feed unavailable. Try again shortly.":(j.error||"Request failed."));
    return j;
  }
  function printHtml(html,title){
    const w=window.open("","_blank");
    if(!w){ alert("Allow pop-ups for tipdash to download the PDF."); return; }
    w.document.open(); w.document.write(html); w.document.close(); w.document.title=title||"TipBot report";
    w.onload=()=>setTimeout(()=>{ try{ w.focus(); w.print(); }catch(e){} },300);
  }
  function mount(box,opt){
    const call=opt.call;
    let sec=box.querySelector("#os-horse");
    if(sec) return;
    sec=document.createElement("section");
    sec.id="os-horse"; sec.className="card";
    sec.innerHTML=
      '<h2 style="margin:0 0 4px">Horse profile &amp; race predictor <span class="gf-badge">Owner only</span></h2>'
     +'<div class="muted" style="margin-bottom:10px">Prediction only '+H+' not betting advice. Upcoming thoroughbred races from Ladbrokes; weather from Open-Meteo.</div>'
     +'<label for="oh-q" class="muted">Race</label>'
     +'<div style="display:flex;gap:8px;flex-wrap:wrap"><input id="oh-q" type="search" placeholder="Search track or race (e.g. Flemington, R7, BM78)" autocomplete="off" style="flex:1;min-width:220px">'
     +'<select id="oh-race" style="flex:2;min-width:260px"><option value="">Loading races…</option></select></div>'
     +'<div id="oh-msg" class="muted" role="status" style="margin:8px 0"></div>'
     +'<div id="oh-assume" style="display:none;margin:0 0 8px;padding:6px 10px;border-radius:8px;background:#1f2937;color:#fff;font-weight:600"></div>'
     +'<div id="oh-sortrow" style="display:none;margin:0 0 6px"><label for="oh-sort" class="muted">Sort by </label><select id="oh-sort">'
     +'<option value="position">Predicted finish</option><option value="price">Price</option><option value="score">Score</option>'
     +'<option value="place">Place chance</option><option value="number">Number</option><option value="barrier">Barrier</option></select></div>'
     +'<div id="oh-runners"></div>'
     +'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">'
     +'<select id="oh-horse" disabled style="min-width:220px"><option value="">Pick a horse</option></select>'
     +'<button id="oh-profile" class="btn" disabled>Download horse profile PDF</button>'
     +'<button id="oh-predict" class="btn primary" disabled>Download race prediction PDF</button></div>';
    box.appendChild(sec);
    const $=id=>sec.querySelector("#"+id);
    let races=[], pred=null, t=null;
    function fill(){
      const q=$("oh-q").value.trim().toLowerCase();
      const list=races.filter(r=>!q||r.label.toLowerCase().indexOf(q)>=0);
      $("oh-race").innerHTML='<option value="">'+(list.length?"Choose a race ("+list.length+")":"No upcoming races match")+'</option>'
        +list.map(r=>'<option value="'+esc(r.id)+'">'+esc(when(r.start_time)+" · "+r.label+" · "+(r.distance||"")+"m · "+(r.track_condition||""))+'</option>').join("");
    }
    async function loadRaces(){
      try{ races=(await getJson(call,"/api/owner/horse/races")).races||[]; fill(); }
      catch(e){ $("oh-msg").textContent=e.message; if(e.unauth&&opt.onUnauth) opt.onUnauth(); }
    }
    const SORT={position:r=>[r.predicted_position],price:r=>[r.price||1e9],score:r=>[-r.overall_score,r.predicted_position],
      place:r=>[-r.p_place,r.predicted_position],number:r=>[r.number||99],barrier:r=>[r.barrier||99]};
    function cmp(f){ return (a,b)=>{ const x=f(a),y=f(b); for(let i=0;i<x.length;i++){ if(x[i]!==y[i]) return x[i]<y[i]?-1:1; } return 0; }; }
    function table(){
      if(!pred) return;
      const rows=pred.runners.slice().sort(cmp(SORT[$("oh-sort").value]||SORT.position));
      $("oh-runners").innerHTML='<table class="tbl" style="width:100%"><thead><tr><th>Pred</th><th>Runner and reasoning <span class="muted" style="font-weight:400">(+ helps, − hurts; weights 0, order = market)</span></th><th>Price</th><th>Win</th><th>Place</th><th>Score</th></tr></thead><tbody>'
        +rows.map(r=>'<tr><td><b>'+r.predicted_position+'</b></td><td><b>#'+esc(r.number)+' '+esc(r.name)+'</b> <span class="muted">b'+esc(r.barrier)+'</span>'
          +'<div class="muted" style="font-size:.85em">'+esc(r.summary||"")+'</div>'
          +'<ul class="muted" style="font-size:.82em;margin:2px 0 0;padding-left:2px;list-style:none">'+(r.reasons||[]).slice(1).map(x=>'<li>'+esc(x)+'</li>').join("")+'</ul></td>'
          +'<td>'+(r.price?"$"+r.price:H)+(r.price_moves?'<div class="muted" style="font-size:.8em">'+esc(r.price_moves)+'</div>':"")+'</td>'
          +'<td>'+(100*r.p_win).toFixed(1)+'%</td><td>'+(100*r.p_place).toFixed(0)+'%</td><td><b>'+r.overall_score+'</b></td></tr>').join("")
        +'</tbody></table>';
    }
    const memo={}; let seq=0;
    async function loadRunners(id){
      const my=++seq;
      pred=null; $("oh-runners").innerHTML=""; $("oh-assume").style.display=$("oh-sortrow").style.display="none";
      $("oh-horse").disabled=$("oh-profile").disabled=$("oh-predict").disabled=true;
      if(!id){ $("oh-msg").textContent=""; return; }
      const hit=memo[id];
      if(!hit||Date.now()-hit.at>45000) $("oh-msg").textContent="Loading runners, weather and model…";
      try{
        const j=(hit&&Date.now()-hit.at<45000)?hit.j:await getJson(call,"/api/owner/horse/predict?event_id="+encodeURIComponent(id));
        if(my!==seq) return;               // a newer race was picked while this one loaded
        memo[id]={at:hit&&hit.j===j?hit.at:Date.now(),j:j}; pred=j;
        $("oh-assume").textContent=pred.assuming; $("oh-assume").style.display="";
        $("oh-msg").textContent=pred.label+" · prices as at "+when(pred.built_at);
        $("oh-sortrow").style.display=""; table();
        $("oh-horse").innerHTML='<option value="">Pick a horse</option>'+pred.runners.map(r=>'<option value="'+esc(r.id)+'">#'+esc(r.number)+' '+esc(r.name)+'</option>').join("");
        $("oh-horse").disabled=false; $("oh-predict").disabled=false;
      }catch(e){ if(my!==seq) return; $("oh-msg").textContent=e.message; if(e.unauth&&opt.onUnauth) opt.onUnauth(); }
    }
    $("oh-q").oninput=()=>{ clearTimeout(t); t=setTimeout(fill,120); };
    $("oh-race").onchange=()=>loadRunners($("oh-race").value);
    $("oh-horse").onchange=()=>{ $("oh-profile").disabled=!$("oh-horse").value; };
    $("oh-sort").onchange=table;
    $("oh-predict").onclick=async()=>{
      if(!pred) return;
      const sort=$("oh-sort").value||"position";
      if(sort==="position"){ printHtml(pred.html,"Race prediction"); return; }
      try{ const j=await getJson(call,"/api/owner/horse/predict?event_id="+encodeURIComponent($("oh-race").value)+"&sort="+encodeURIComponent(sort)); printHtml(j.html,"Race prediction"); }
      catch(e){ $("oh-msg").textContent=e.message; }
    };
    $("oh-profile").onclick=async()=>{
      const rid=$("oh-horse").value, eid=$("oh-race").value; if(!rid||!eid) return;
      $("oh-profile").disabled=true;
      try{ const j=await getJson(call,"/api/owner/horse/profile?event_id="+encodeURIComponent(eid)+"&runner_id="+encodeURIComponent(rid)); printHtml(j.html,"Horse profile"); }
      catch(e){ $("oh-msg").textContent=e.message; }
      $("oh-profile").disabled=false;
    };
    loadRaces();
  }
  window.TBOwnerHorse={mount:mount};
  TD.loaded["owner-horse"]=true;
})();
