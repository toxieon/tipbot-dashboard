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
    async function loadRunners(id){
      pred=null; $("oh-runners").innerHTML=""; $("oh-horse").disabled=$("oh-profile").disabled=$("oh-predict").disabled=true;
      if(!id) return;
      $("oh-msg").textContent="Loading runners, weather and model…";
      try{
        pred=await getJson(call,"/api/owner/horse/predict?event_id="+encodeURIComponent(id));
        $("oh-msg").innerHTML='<b>'+esc(pred.assuming)+'</b> · '+esc(pred.label);
        $("oh-runners").innerHTML='<table class="tbl" style="width:100%"><thead><tr><th>Pred</th><th>Runner</th><th>Win</th><th>Place</th><th>Score</th></tr></thead><tbody>'
          +pred.runners.map(r=>'<tr><td>'+r.predicted_position+'</td><td>#'+esc(r.number)+' '+esc(r.name)+'<div class="muted" style="font-size:.85em">'+esc((r.reasons||[]).slice(1,4).join("; "))+'</div></td><td>'+(100*r.p_win).toFixed(1)+'%</td><td>'+(100*r.p_place).toFixed(0)+'%</td><td>'+r.overall_score+'</td></tr>').join("")
          +'</tbody></table>';
        $("oh-horse").innerHTML='<option value="">Pick a horse</option>'+pred.runners.map(r=>'<option value="'+esc(r.id)+'">#'+esc(r.number)+' '+esc(r.name)+'</option>').join("");
        $("oh-horse").disabled=false; $("oh-predict").disabled=false;
      }catch(e){ $("oh-msg").textContent=e.message; if(e.unauth&&opt.onUnauth) opt.onUnauth(); }
    }
    $("oh-q").oninput=()=>{ clearTimeout(t); t=setTimeout(fill,120); };
    $("oh-race").onchange=()=>loadRunners($("oh-race").value);
    $("oh-horse").onchange=()=>{ $("oh-profile").disabled=!$("oh-horse").value; };
    $("oh-predict").onclick=()=>{ if(pred) printHtml(pred.html,"Race prediction"); };
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
