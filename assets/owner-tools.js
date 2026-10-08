/* Platform session tools. Loaded only after the session is confirmed
   (index.html TD.load("owner-tools")). Plain script, same globals as the page.
   Not part of the public copy. */
(function(){
  function adminHtml(s, sw){
    const on=godOn();
    const dbgBtn=(kind,label,hint)=>'<button class="dbgbtn" data-k="'+kind+'" title="'+hint+'" style="border:1px solid var(--line);background:var(--card2);color:var(--txt);border-radius:var(--r-sm);padding:8px 12px;cursor:pointer;font:inherit;font-size:var(--t-foot);font-weight:600">'+label+'</button>';
    const debugMenu='<div style="margin-top:16px;border-top:1px solid var(--line);padding-top:14px"><div style="color:#b9a5ff;font-size:var(--t-foot);text-transform:uppercase;letter-spacing:.05em;font-weight:700;margin-bottom:4px">🛠️ Debug menu</div>'
      +'<div style="color:var(--faint);font-size:var(--t-foot);margin-bottom:10px">Each button asks the bot to act and reports back in your tips channel — use these to see exactly where a problem is.</div>'
      +'<div style="display:flex;gap:8px;flex-wrap:wrap">'
      +dbgBtn("ping","Ping Discord","Posts a test message to confirm the bot + tips channel are wired up")
      +dbgBtn("diagnostics","Health check","Posts channels, follow emoji, and bot permissions")
      +dbgBtn("debug_tip","Post debug tip","Posts a dummy tip you can react to")
      +dbgBtn("follow_selftest","Test follow → DM","Traces the follow/DM pipeline and reports where it stops")
      +'<button class="dbgqbtn" title="Shows whether the bot is draining the dashboard queues" style="border:1px solid #5a3a7a;background:#241b3a;color:#c9a5ff;border-radius:var(--r-sm);padding:8px 12px;cursor:pointer;font:inherit;font-size:var(--t-foot);font-weight:600">Queue status</button>'
      +'</div><div id="dbgstatus" style="font-size:var(--t-foot);color:var(--faint);margin-top:8px;white-space:pre-wrap;font-family:ui-monospace,monospace"></div></div>';
    const godZone='<div style="margin-top:16px;border-top:1px solid var(--warn,#e0a04a);padding-top:14px">'
      +'<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">'
      +'<div><div style="color:var(--warn,#e0a04a);font-size:var(--t-foot);text-transform:uppercase;letter-spacing:.05em;font-weight:700">🔱 God mode</div>'
      +'<div style="color:var(--faint);font-size:var(--t-foot);margin-top:2px">Override or re-grade any tip, including settled ones. Grades post as <b>God</b>.</div></div>'
      +'<button id="godtoggle" aria-label="God mode" class="toggle '+(STATE.god?"on":"")+'" style="flex:none"></button></div>'
      +'<div id="godhint" style="font-size:var(--t-foot);margin-top:8px;color:'+(on?'var(--warn,#e0a04a)':'var(--faint)')+'">'+(on?"● ON — use grade controls on any tip to re-grade it, or ✕ to delete settled tips.":"Off — tips grade normally.")+'</div>'
      +'<div style="margin-top:12px;display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap">'
      +'<button id="godresyncbtn" type="button" '+(on?"":"disabled ")+'title="Durable DB repair only — no Discord posts" style="border:1px solid var(--warn,#e0a04a);background:rgba(224,160,74,.12);color:'+(on?"var(--warn,#e0a04a)":"#7a6a4a")+';border-radius:var(--r-sm);padding:8px 12px;cursor:'+(on?"pointer":"not-allowed")+';font:inherit;font-size:var(--t-foot);font-weight:650">Resync all bets</button>'
      +'<div style="color:var(--faint);font-size:var(--t-foot);line-height:1.4;flex:1;min-width:180px">Re-apply durable status/result/profit/actuals for every tip on this server and repair follower bankrolls. <b>No Discord messages.</b> Turn God mode on first. Pending tips with no recoverable grade stay Pending.</div>'
      +'</div><div id="godresyncmsg" style="font-size:var(--t-foot);color:var(--faint);margin-top:8px"></div>'
      +'<div id="godresyncprog" hidden style="margin-top:10px">'
      +'<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;flex-wrap:wrap">'
      +'<div id="godresyncprogtext" style="font-size:var(--t-foot);color:var(--faint);font-variant-numeric:tabular-nums">0/0 · follows 0 · skipped Pending 0</div>'
      +'<div id="godresyncprogpct" style="font-size:var(--t-cap);font-weight:700;color:var(--faint);font-variant-numeric:tabular-nums">0%</div></div>'
      +'<div role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" id="godresyncprobar" style="height:8px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden">'
      +'<i id="godresyncprobarfill" style="display:block;height:100%;width:0%;border-radius:999px;background:var(--warn,#e0a04a);transition:width .2s ease"></i></div></div>'
      +'<details id="godresynclogwrap" style="margin-top:10px">'
      +'<summary style="cursor:pointer;color:var(--faint);font-size:var(--t-foot);font-weight:650;user-select:none">Resync log</summary>'
      +'<pre id="godresynclog" style="margin:8px 0 0;padding:10px 12px;max-height:180px;overflow:auto;font:11.5px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:var(--muted);background:var(--card2);border:1px solid var(--line);border-radius:var(--r-sm);white-space:pre-wrap;word-break:break-word"></pre>'
      +'</details></div>';
    const inviteZone='<div style="margin-top:16px;border-top:1px solid var(--line);padding-top:14px">'
      +'<div style="color:#b9a5ff;font-size:var(--t-foot);text-transform:uppercase;letter-spacing:.05em;font-weight:700;margin-bottom:4px">Invite me</div>'
      +'<div style="color:var(--faint);font-size:var(--t-foot);margin-bottom:10px">Create a Discord invite for <b>this server</b> so you can join and inspect it. Platform owner only. Needs bot Create Instant Invite (or Administrator).</div>'
      +'<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">'
      +'<button id="inviteMeBtn" type="button" style="border:1px solid #5a3a7a;background:#241b3a;color:#c9a5ff;border-radius:var(--r-sm);padding:8px 12px;cursor:pointer;font:inherit;font-size:var(--t-foot);font-weight:600">Generate invite</button>'
      +'<a id="inviteMeLink" href="#" target="_blank" rel="noopener" hidden style="font-size:var(--t-sub);color:var(--accent)"></a>'
      +'</div><div id="inviteMeMsg" style="font-size:var(--t-foot);color:var(--faint);margin-top:8px"></div></div>';
    const leaveToken=(s.display_name||"").trim()||"LEAVE";
    const dangerZone='<div style="margin-top:16px;border-top:1px solid #7a2a2a;padding-top:14px">'
      +'<div style="color:#ff8a8a;font-size:var(--t-foot);text-transform:uppercase;letter-spacing:.05em;font-weight:700;margin-bottom:4px">Danger zone</div>'
      +'<div style="color:var(--faint);font-size:var(--t-foot);margin-bottom:10px">Removes TipBot from this Discord server — the bot leaves and it disappears from the dashboard. Re-invite it and run <code>/setup-server</code> to bring it back. Type <b style="color:#ffb3b3">'+esc(leaveToken)+'</b> to confirm.</div>'
      +'<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">'
      +'<input id="leaveconfirm" placeholder="'+esc(leaveToken)+'" autocomplete="off" style="flex:1;min-width:160px;padding:8px 10px;border-radius:var(--r-sm);border:1px solid #7a2a2a;background:#1c1414;color:var(--txt);font:inherit">'
      +'<button id="leaveserverbtn" data-g="'+s.guild_id+'" data-n="'+esc(s.display_name||"this server")+'" data-token="'+esc(leaveToken)+'" disabled style="border:1px solid #7a2a2a;background:#2a1717;color:#7a5252;border-radius:var(--r-sm);padding:9px 14px;cursor:not-allowed;font:inherit;font-size:var(--t-sub);font-weight:700">🗑 Remove this server</button>'
      +'</div><div id="leaveservermsg" style="font-size:var(--t-foot);color:var(--faint);margin-top:8px"></div></div>';
    const pasteSheetZone='<div style="margin-top:16px;border-top:1px solid var(--line);padding-top:14px">'
      +'<div id="pastesheettoggle" role="button" tabindex="0" style="display:flex;align-items:center;justify-content:space-between;gap:10px;cursor:pointer;user-select:none">'
      +'<div><div style="color:#b9a5ff;font-size:var(--t-foot);text-transform:uppercase;letter-spacing:.05em;font-weight:700">Paste tip sheet</div>'
      +'<div style="color:var(--faint);font-size:var(--t-foot);margin-top:2px">Owner-only TipSheet import (TSV or CSV + YAML). Collapsed so Admin Tools stays short.</div></div>'
      +'<span id="pastesheetcaret" style="color:#b9a5ff;font-size:var(--t-callout);flex:none">▸</span></div>'
      +'<div id="pastesheetbody" hidden style="margin-top:10px">'
      +'<textarea id="paste-sheet-ta" class="paste-sheet-ta" spellcheck="false" placeholder="---\nguild: …\nchannel: tips\nmemo: Optional sheet note\ntrickle_seconds: 8\n---\nkind\tgame\tplayer\tstat\tline\tside\todds\tunits\tgroup\nSINGLE\tSydney Swans v Fremantle\tChad Warner\tDisposals\t24.5\tOver\t1.85\t1\t"></textarea>'
      +'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;align-items:center">'
      +'<button type="button" id="paste-preview-btn" style="border:1px solid #5a3a7a;background:#241b3a;color:#c9a5ff;border-radius:var(--r-sm);padding:8px 12px;cursor:pointer;font:inherit;font-size:var(--t-foot);font-weight:600">Preview</button>'
      +'<button type="button" id="paste-confirm" disabled style="border:1px solid rgba(46,175,98,.45);background:rgba(46,175,98,.12);color:#7ee0a6;border-radius:var(--r-sm);padding:8px 12px;cursor:not-allowed;font:inherit;font-size:var(--t-foot);font-weight:600;opacity:.45">Confirm import</button>'
      +'<button type="button" id="paste-template" style="border:1px solid #5a3a7a;background:#241b3a;color:#c9a5ff;border-radius:var(--r-sm);padding:8px 12px;cursor:pointer;font:inherit;font-size:var(--t-foot);font-weight:600">Download CSV template</button>'
      +'<span id="paste-summary" style="font-size:var(--t-foot);color:var(--faint)"></span></div>'
      +'<div id="paste-preview" class="paste-preview"></div>'
      +'<div id="paste-sheet-msg" style="font-size:var(--t-foot);color:var(--faint);margin-top:8px"></div>'
      +'</div></div>';
    const adminFeatures='<div style="margin-top:16px;border-top:1px solid var(--line);padding-top:14px">'
      +'<div id="featurestoggle" role="button" tabindex="0" style="display:flex;align-items:center;justify-content:space-between;gap:10px;cursor:pointer;user-select:none">'
      +'<div><div style="color:#b9a5ff;font-size:var(--t-foot);text-transform:uppercase;letter-spacing:.05em;font-weight:700">Features</div>'
      +'<div style="color:var(--faint);font-size:var(--t-foot);margin-top:2px">Feature flags for this guild (owner only). Collapsed so Admin Tools stays short.</div></div>'
      +'<span id="featurescaret" style="color:#b9a5ff;font-size:var(--t-callout);flex:none">▸</span></div>'
      +'<div id="featuresbody" hidden style="margin-top:10px">'
      +'<div style="color:var(--faint);font-size:var(--t-foot);margin-bottom:10px">Platform-owner feature flags for this guild. Tipsters do not see this section.</div>'
      +'<div id="features-box"><div class="empty">Open to load…</div></div></div></div>';
    return '<div class="panel" id="adminpanel" data-sec="admin" style="border-color:#7b5bff;box-shadow:0 0 0 1px rgba(123,91,255,.28)"><h3 id="admintoggle" style="color:#b9a5ff;display:flex;align-items:center;gap:8px;margin:0">🔒 Admin Tools <span style="font-size:var(--t-cap);font-weight:700;letter-spacing:.03em;background:#2c2350;color:#c9b8ff;padding:2px 8px;border-radius:999px">VISIBLE TO YOU ONLY</span></h3><div id="adminbody" style="margin-top:10px"><div class="switches">'+sw+'</div>'+debugMenu+godZone+inviteZone+pasteSheetZone+dangerZone+adminFeatures+'</div></div>';
  }

  function bindAdmin(s, tips){
    tips=tips||{settled:[]};
    { const pt=$("pastesheettoggle"), b=$("pastesheetbody");
      if(pt&&b){ pt.classList.add("tdsec-sub"); TDSec.bind(pt.parentNode, pt, {id:"admin-paste", body:b, hideBody:true, caret:$("pastesheetcaret")}); } }
    { const pb=$("paste-preview-btn"); if(pb)pb.onclick=()=>pasteSheetPreview(s.guild_id); }
    { const pc=$("paste-confirm"); if(pc)pc.onclick=()=>pasteSheetConfirm(s.guild_id); }
    { const pt=$("paste-template"); if(pt)pt.onclick=()=>pasteSheetTemplate(); }
    { const ft=$("featurestoggle"), b=$("featuresbody");
      if(ft&&b){ ft.classList.add("tdsec-sub"); TDSec.bind(ft.parentNode, ft, {id:"admin-features", body:b, hideBody:true, caret:$("featurescaret"), onToggle:function(open){ if(open) loadFeatures(s.guild_id); }}); } }
    { const gt=$("godtoggle"); if(gt)gt.onclick=()=>{ STATE.god=!STATE.god; gt.classList.toggle("on",STATE.god);
      const on=godOn();
      const gh=$("godhint"); if(gh){ gh.textContent=on?"● ON — use grade controls on any tip to re-grade it, or ✕ to delete settled tips.":"Off — tips grade normally."; gh.style.color=on?"var(--warn,#e0a04a)":"var(--faint)"; }
      const rb2=$("godresyncbtn"); if(rb2){ rb2.disabled=!on; rb2.style.cursor=on?"pointer":"not-allowed"; rb2.style.color=on?"var(--warn,#e0a04a)":"#7a6a4a"; }
      const rb=$("recent-box"); if(rb){ rb.innerHTML=tips.settled.length?tips.settled.map(t=>recentTipRow(t)).join(""):'<div class="empty">No settled tips yet.</div>'; wireTipRows(rb,s.guild_id); hydrateTipCards(rb,s.guild_id,tips.settled); }
      try{
        if($("followers")&&!$("followers").hidden){
          $("followers").querySelectorAll(".fbets").forEach(box=>{
            if(box.hidden) return;
            const uid=(box.id||"").replace(/^fbets_/,"");
            const bets=followerBetsCached(s.guild_id, uid);
            if(bets){ box.innerHTML=renderFollowerBetsHtml(s.guild_id, bets); wireFollowerBetGrades(s.guild_id, box); }
          });
          const fc=$("fcount"); const head=fc&&fc.parentNode;
          let hint=document.getElementById("fgodhint");
          if(on){
            if(!hint&&head){ hint=document.createElement("span"); hint.id="fgodhint"; hint.style.cssText="color:var(--warn,#e0a04a);font-size:var(--t-cap);margin-left:8px;font-weight:700"; hint.textContent="🔱 God — expand a member to re-grade / settle"; head.appendChild(hint); }
            else if(hint) hint.hidden=false;
          }else if(hint) hint.remove();
        }
      }catch(e6){}
    }; }
    { const gr=$("godresyncbtn"); if(gr)gr.onclick=async()=>{
      if(!godOn()){ toast("Turn God mode on first"); return; }
      if(!(await tbConfirm({title:"🔱 Resync all bets on this server?",
        message:"Durable DB repair of tip status, result, profit and actuals, plus follower bankrolls.\nDoesn't post or edit anything on Discord.\nPending tips with no recoverable grade stay Pending.",
        confirmLabel:"Resync"}))) return;
      const m=$("godresyncmsg"), prog=$("godresyncprog"), logEl=$("godresynclog");
      const bar=$("godresyncprobar"), fill=$("godresyncprobarfill");
      const ptxt=$("godresyncprogtext"), ppct=$("godresyncprogpct");
      gr.disabled=true;
      if(m){m.style.color="var(--faint)"; m.textContent="Resyncing…";}
      if(logEl) logEl.textContent="";
      let lastLineLen=0;
      const paintProg=(j)=>{
        if(!j||typeof j!=="object") return;
        const processed=j.processed!=null?Number(j.processed):(j.tips_touched!=null?Number(j.tips_touched):0);
        const total=j.total!=null?Number(j.total):(processed||0);
        const follows=j.follows!=null?Number(j.follows):(j.follows_repaired!=null?Number(j.follows_repaired):0);
        const skipped=j.skipped_pending!=null?Number(j.skipped_pending):(j.skipped_pending_no_grade!=null?Number(j.skipped_pending_no_grade):0);
        const p=Number.isFinite(processed)?processed:0;
        const t=Number.isFinite(total)?total:0;
        const pct=t>0?Math.min(100,Math.round((p/t)*100)):(p>0?100:0);
        if(ptxt) ptxt.textContent=p+"/"+t+" · follows "+(Number.isFinite(follows)?follows:0)+" · skipped Pending "+(Number.isFinite(skipped)?skipped:0);
        if(ppct) ppct.textContent=pct+"%";
        if(fill) fill.style.width=pct+"%";
        if(bar) bar.setAttribute("aria-valuenow", String(pct));
        if(Array.isArray(j.lines)&&logEl){
          if(j.lines.length>lastLineLen){
            const neu=j.lines.slice(lastLineLen).map(x=>String(x==null?"":x));
            const chunk=neu.join("\n");
            if(chunk){
              logEl.textContent+=(logEl.textContent&&!logEl.textContent.endsWith("\n")?"\n":"")+chunk;
              try{ logEl.scrollTop=logEl.scrollHeight; }catch(e3){}
            }
            lastLineLen=j.lines.length;
          }
        }
      };
      if(prog){
        prog.hidden=false;
        paintProg({processed:0,total:0,follows:0,skipped_pending:0,lines:[]});
      }
      let pollTimer=null;
      const stopPoll=()=>{ if(pollTimer){ clearInterval(pollTimer); pollTimer=null; } };
      const tickProg=async()=>{
        try{
          const pr=await api("/api/god-resync-progress?guild_id="+encodeURIComponent(s.guild_id),{timeoutMs:8000,retries:1});
          if(!pr||pr.status===404) return;
          let pj=null; try{ pj=await pr.json(); }catch(e4){ return; }
          paintProg(pj);
          if(pj&&pj.durability_warning&&m){
            m.textContent=String(pj.durability_warning);
            m.style.color="var(--warn,#e0a04a)";
          }
        }catch(e5){}
      };
      pollTimer=setInterval(tickProg,500);
      tickProg();
      try{
        const r=await api("/api/god-resync-bets",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({guild_id:s.guild_id, dry_run:false}), timeoutMs:180000, idempotent:true, retries:3});
        const j=await r.json();
        paintProg(j);
        if(j.ok){
          const msg="Resynced "+(j.tips_touched||0)+" tip(s) · follows repaired "+(j.follows_repaired||0)+(j.skipped_pending_no_grade?(" · "+j.skipped_pending_no_grade+" Pending left"):"")+" — no Discord";
          if(m){m.textContent=msg; m.style.color="var(--win)";}
          if(j.durability_warning&&m){
            m.textContent=msg+" — "+j.durability_warning;
            m.style.color="var(--warn,#e0a04a)";
          }
          toast("🔱 "+msg,"success");
          try{ await loadDetail(s.guild_id); }catch(e2){}
        }else{
          let err=j.message||j.error||"Resync failed";
          if(j.error && j.message && j.error!==j.message) err=j.message+" ("+j.error+")";
          if(j.retry_after!=null && (j.error==="db_busy"||j.error==="warming")) err+=" — retry in ~"+j.retry_after+"s";
          if(m){m.textContent=err; m.style.color="var(--loss)";}
          if(j.durability_warning&&m){
            m.textContent=err+" — "+j.durability_warning;
            m.style.color="var(--warn,#e0a04a)";
          }
          toast(err,"error");
        }
      }catch(e){ if(e&&e.unauth)return renderLogin("Session expired."); if(m){m.textContent="Couldn't reach the bot."; m.style.color="var(--loss)";} toast("Couldn't reach the bot","error"); }
      finally{ stopPoll(); gr.disabled=!godOn(); }
    }; }
    { const ib=$("inviteMeBtn"); if(ib)ib.onclick=async()=>{
      const m=$("inviteMeMsg"), link=$("inviteMeLink");
      ib.disabled=true; if(m)m.textContent="Creating invite…"; if(link){link.hidden=true;link.removeAttribute("href");link.textContent="";}
      try{
        const r=await api("/api/owner-invite",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({guild_id:s.guild_id})});
        const j=await r.json();
        if(j.ok&&j.invite_url){
          if(link){link.href=j.invite_url;link.textContent=j.invite_url;link.hidden=false;}
          if(m){m.textContent="Invite ready — open the link to join.";m.style.color="var(--win)";}
        }else{
          if(m){m.textContent=j.message||"Couldn't create invite";m.style.color="var(--loss)";}
        }
      }catch(e){ if(e&&e.unauth)return renderLogin("Session expired."); if(m){m.textContent="Couldn't reach the bot.";m.style.color="var(--loss)";} }
      finally{ ib.disabled=false; }
    }; }
    $("detail").querySelectorAll(".dbgbtn").forEach(b=>b.onclick=async()=>{
      const st=$("dbgstatus"); b.disabled=true; if(st)st.textContent="Asking the bot to run: "+b.textContent+"…";
      try{ const r=await api("/api/debug",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({guild_id:s.guild_id,kind:b.dataset.k})});
        const j=await r.json();
        if(st)st.textContent=j.ok?("✅ Queued — check your Discord tips channel in a few seconds ("+(j.message||"")+")"):("⚠️ "+(j.message||"couldn't queue that"));
      }catch(e){ if(e&&e.unauth)return renderLogin("Session expired."); if(st)st.textContent="⚠️ Couldn't reach the bot."; }
      finally{ b.disabled=false; }
    });
    { const qb=$("detail").querySelector(".dbgqbtn"); if(qb)qb.onclick=async()=>{
      const st=$("dbgstatus"); qb.disabled=true; if(st)st.textContent="Reading the queues…";
      try{ const d=await (await api("/api/queue-status?guild_id="+encodeURIComponent(s.guild_id))).json();
        const fmt=(q,label)=>{ const c=Object.entries(q.counts||{}).map(([k,v])=>k+":"+v).join(", ")||"empty";
          const rows=(q.recent||[]).slice(0,6).map(r=>"  • "+(r.action||r.game_name||"?")+" → "+(r.status||"?")+(r.result?(" ("+String(r.result).slice(0,60)+")"):"")+(r.error?(" ("+String(r.error).slice(0,60)+")"):"")).join("\n");
          return label+" ["+c+"]\n"+(rows||"  (none)"); };
        if(st)st.textContent="ACTION QUEUE (delete/debug/moderate/settle)\n"+fmt(d.action_queue||{},"")+"\n\nTIP QUEUE (web-built tips)\n"+fmt(d.tip_queue||{},"");
      }catch(e){ if(e&&e.unauth)return renderLogin("Session expired."); if(st)st.textContent="⚠️ Couldn't read queue status."; }
      finally{ qb.disabled=false; }
    }; }
    { const lb=$("leaveserverbtn"), ci=$("leaveconfirm"); if(lb&&ci){
      const gid=lb.dataset.g, nm=lb.dataset.n, token=lb.dataset.token, m=$("leaveservermsg");
      const armed=()=>ci.value.trim()===token;
      const paint=()=>{ const on=armed();
        lb.disabled=!on; lb.style.cursor=on?"pointer":"not-allowed";
        lb.style.color=on?"#ff8a8a":"#7a5252"; lb.style.background=on?"#3a1a1a":"#2a1717"; };
      ci.oninput=paint; paint();
      const go=async()=>{ lb.disabled=true; ci.disabled=true; if(m)m.textContent="Removing — the bot is leaving now…";
        try{ const r=await api("/api/leave-server",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({guild_id:gid})});
          const j=await r.json();
          if(r.ok&&j.ok){
            if(m)m.textContent="✅ Removed "+nm+" from the dashboard.";
            STATE.servers=(STATE.servers||[]).filter(x=>String(x.guild_id)!==String(gid));
            setTimeout(()=>enterHome(),700);
          }
          else{ if(m)m.textContent="⚠️ "+(j.message||"couldn't remove that server"); ci.disabled=false; paint(); }
        }catch(e){ if(e&&e.unauth)return renderLogin("Session expired."); if(m)m.textContent="⚠️ Couldn't reach the bot."; ci.disabled=false; paint(); }
      };
      lb.onclick=()=>{ if(!armed())return;
        if(window.NDConfirmPop)NDConfirmPop.show({label:"Removing "+nm,color:"#ff6b6b"});
        go();
      };
      ci.onkeydown=(e)=>{ if(e.key==="Enter"&&armed())lb.click(); };
    }}
  }

  function closeFollowerMap(){ const el=$("fmap-backdrop"); if(el)el.remove(); }
  async function openFollowerMap(follower){
    if(!(STATE.ops===true&&!STATE.viewAs)) return;
    closeFollowerMap();
    const uid=String(follower.user_id||"");
    const name=follower.name||follower.username||uid;
    const av=follower.avatar||"";
    const backdrop=document.createElement("div");
    backdrop.id="fmap-backdrop";
    backdrop.style.cssText="position:fixed;inset:0;z-index:80;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center;padding:0;";
    backdrop.innerHTML='<div role="dialog" aria-modal="true" aria-label="Follower server map" style="background:var(--card);border:1px solid var(--line);border-bottom:0;border-radius:18px 18px 0 0;width:100%;max-width:520px;max-height:85vh;overflow:auto;padding:18px 18px 28px;box-shadow:0 -12px 40px rgba(0,0,0,.45)">'
      +'<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">'
      +'<img src="'+esc(av)+'" alt="" style="width:48px;height:48px;border-radius:50%;background:var(--card2);object-fit:cover" onerror="this.style.visibility=\'hidden\'">'
      +'<div style="flex:1;min-width:0"><div style="font-weight:800;font-size:var(--t-h3)">'+esc(name)+'</div></div>'
      +'<button type="button" id="fmap-x" class="ghost" style="padding:8px 12px">Close</button></div>'
      +'<div id="fmap-body" style="color:var(--faint);font-size:var(--t-sub)">Loading map…</div>'
      +'<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--line);color:var(--faint);font-size:var(--t-cap)">TipBot-mutual servers only. Search filters this list. Invite when the bot is present.</div>'
      +'</div>';
    document.body.appendChild(backdrop);
    backdrop.addEventListener("click",e=>{ if(e.target===backdrop) closeFollowerMap(); });
    const xb=$("fmap-x"); if(xb) xb.onclick=closeFollowerMap;
    const body=$("fmap-body");
    try{
      const r=await api("/api/owner/follower-map?user_id="+encodeURIComponent(uid));
      if(r.status===403){ body.innerHTML='<div class="empty">Platform owner only.</div>'; return; }
      const data=await r.json();
      if(data&&data.error){ body.innerHTML='<div class="empty">'+esc(data.error)+'</div>'; return; }
      const guilds=(data&&data.tipbot_guilds)||[];
      if(!guilds.length){ body.innerHTML='<div class="empty">No TipBot-mutual servers for this user yet.</div>'; return; }
      const bindInvites=()=>{
        body.querySelectorAll(".fmap-inv").forEach(btn=>btn.onclick=async()=>{
          const gid=btn.dataset.g; const msg=$("fmap-msg");
          btn.disabled=true; if(msg){msg.textContent="Creating invite…";msg.style.color="var(--faint)";}
          try{
            const rr=await api("/api/owner-invite",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({guild_id:gid})});
            const j=await rr.json();
            if(j.ok&&j.invite_url){
              if(msg){ msg.innerHTML='Invite ready — <a href="'+esc(j.invite_url)+'" target="_blank" rel="noopener" style="color:var(--accent)">'+esc(j.invite_url)+'</a>'; msg.style.color="var(--win)"; }
              try{ window.open(j.invite_url,"_blank","noopener"); }catch(_){}
            }else{
              if(msg){ msg.textContent=j.message||"Couldn't create invite"; msg.style.color="var(--loss)"; }
            }
          }catch(e){ if(e&&e.unauth)return renderLogin("Session expired."); if(msg){msg.textContent="Couldn't reach the bot.";msg.style.color="var(--loss)";} }
          finally{ btn.disabled=false; }
        });
      };
      const renderList=(q)=>{
        const needle=(q||"").trim().toLowerCase();
        const filtered=guilds.filter(g=>{
          if(!needle) return true;
          const name=String(g.display_name||g.guild_id||"").toLowerCase();
          const id=String(g.guild_id||"");
          return name.includes(needle) || id.includes(needle);
        });
        let html='<input id="fmap-q" type="search" placeholder="Search servers…" value="'+esc(q||"")+'" style="width:100%;box-sizing:border-box;margin:0 0 12px;padding:10px 12px;border-radius:var(--r-md);border:1px solid var(--line);background:var(--card2);color:var(--text);font:inherit;font-size:var(--t-sub)">';
        html+='<div style="font-weight:700;font-size:var(--t-sub);color:var(--muted);margin:4px 0 6px">Servers they share with TipBot · '+filtered.length+'/'+guilds.length+'</div>';
        if(!filtered.length) html+='<div class="empty">No servers match that search.</div>';
        else html+=filtered.map(g=>{
          const present=!!g.bot_present;
          const inv=present
            ?('<button type="button" class="fmap-inv" data-g="'+esc(g.guild_id)+'" style="border:1px solid #5a3a7a;background:#241b3a;color:#c9a5ff;border-radius:var(--r-sm);padding:7px 11px;cursor:pointer;font:inherit;font-size:var(--t-foot);font-weight:600">Invite</button>')
            :('<span style="color:var(--faint);font-size:var(--t-foot)">Bot not present</span>');
          return '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--line)">'
            +'<div style="flex:1;min-width:0"><div style="font-weight:700">'+esc(g.display_name||g.guild_id)+'</div>'
            +'<div style="color:var(--faint);font-size:var(--t-foot)">'+esc(String(g.follow_count||0))+' follow'+(g.follow_count===1?"":"s")
            +(present?" · bot present":" · bot absent")+'</div></div>'+inv+'</div>';
        }).join("");
        html+='<div id="fmap-msg" style="font-size:var(--t-foot);color:var(--faint);margin-top:10px"></div>';
        body.innerHTML=html;
        const inp=$("fmap-q");
        if(inp){ inp.oninput=()=>renderList(inp.value); }
        bindInvites();
      };
      renderList("");
    }catch(e){ if(e&&e.unauth)return renderLogin("Session expired."); body.innerHTML='<div class="empty">Couldn\'t load follower map.</div>'; }
  }

  function ensureNode(id, html){
    let n=$(id);
    if(!n){
      const hold=document.createElement("div");
      hold.innerHTML=html;
      n=hold.firstElementChild;
    }
    return n;
  }
  function ensureSettingsMarkup(box){
    if(!box) return;
    if(!box.querySelector(".os-body")){
      box.innerHTML='<div class="back" id="osback">← Back</div><div class="dhead"><h1>Owner settings</h1></div>'
        +'<p class="os-lead">Platform-owner tools. Only you can see these.</p><div class="os-body"></div>';
      const back=$("osback"); if(back) back.onclick=()=>navBack(()=>enterHome());
    }
    const body=box.querySelector(".os-body");
    if(!body) return;
    const quota=ensureNode("dd-odds-quota",
      '<div class="dd-quota" id="dd-odds-quota" hidden title="The Odds API monthly quota (TipBot cache)">'
      +'<span class="dq-main" id="dd-odds-quota-main">Odds API · —</span>'
      +'<span class="dq-meta" id="dd-odds-quota-meta">not pulled yet</span></div>');
    const markets=ensureNode("dd-odds-markets",
      '<div class="dd-mk" id="dd-odds-markets" hidden>'
      +'<div class="dd-mk-head" id="dd-mk-toggle" role="button" tabindex="0" aria-expanded="false" aria-controls="dd-mk-body">'
      +'<span>Odds API markets</span><span class="caret">▸</span></div>'
      +'<div class="dd-mk-body" id="dd-mk-body" hidden></div></div>');
    const gate=ensureNode("dd-signup-gate",
      '<div class="dd-gate" id="dd-signup-gate" hidden>'
      +'<label class="dd-gate-toggle"><input type="checkbox" id="dd-signup-gate-on"> Australia-only sign-ups</label>'
      +'<div class="dd-gate-note" id="dd-signup-gate-note">Soft gate for new sign-ups. Existing users aren\'t affected.</div>'
      +'<form class="dd-gate-override" id="dd-signup-override">'
      +'<input id="dd-signup-uid" inputmode="numeric" placeholder="Discord user ID" aria-label="Discord user ID to override">'
      +'<button type="submit" value="allowed">Allow</button><button type="submit" value="declined">Block</button><button type="submit" value="clear">Clear</button>'
      +'</form></div>');
    if(!body.querySelector(".os-card")){
      [["Odds API", quota, markets],["Sign-ups", gate]].forEach(function(row){
        const card=document.createElement("section"); card.className="panel os-card";
        card.innerHTML='<h3>'+esc(row[0])+'</h3>';
        for(let i=1;i<row.length;i++) if(row[i]) card.appendChild(row[i]);
        body.appendChild(card);
      });
    }
  }

  async function paintSignup(){
    const row=$("dd-signup-gate"); if(!row) return;
    const show=STATE.ops===true&&!STATE.viewAs;
    row.hidden=!show; if(!show) return;
    const chk=$("dd-signup-gate-on"), note=$("dd-signup-gate-note");
    try{
      const r=await api("/api/owner/signup-gate",{retries:1,timeoutMs:20000});
      if(!r.ok){ if(note) note.textContent="Couldn't load ("+r.status+")"; return; }
      const j=await r.json();
      if(chk) chk.checked=!!j.enabled;
      const n=(j.decisions||[]).length;
      if(note) note.textContent=(j.enabled?"On: new sign-ups must be in Australia":"Off: anyone can sign up")+(n?" · "+n+" recent decision"+(n===1?"":"s"):"");
    }catch(e){ if(note) note.textContent="Couldn't reach TipBot"; }
  }
  function wireSignup(){
    const chk=$("dd-signup-gate-on"); if(!chk||chk._wired) return; chk._wired=true;
    chk.onchange=async()=>{
      const want=chk.checked; chk.disabled=true;
      try{
        const r=await api("/api/owner/signup-gate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({enabled:want})});
        if(!r.ok) chk.checked=!want;
      }catch(e){ chk.checked=!want; }
      chk.disabled=false; paintSignup();
    };
    const form=$("dd-signup-override");
    if(!form) return;
    form.onsubmit=async(e)=>{
      e.preventDefault();
      const uid=$("dd-signup-uid").value.trim(), dec=e.submitter&&e.submitter.value||"allowed", out=$("dd-signup-gate-note");
      if(!/^\d{5,25}$/.test(uid)){ if(out) out.textContent="Enter a Discord user ID (digits)."; return; }
      try{
        const r=await api("/api/owner/signup-override",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({user_id:uid,decision:dec})});
        const j=await r.json().catch(()=>({}));
        if(out) out.textContent=r.ok&&j.ok?("User "+uid+": "+(j.decision||"cleared")):(j.error||("Failed ("+r.status+")"));
        if(r.ok) $("dd-signup-uid").value="";
      }catch(err){ if(out) out.textContent="Couldn't reach TipBot"; }
    };
  }

  window.TBOwner={
    adminHtml:adminHtml,
    bindAdmin:bindAdmin,
    openFollowerMap:openFollowerMap,
    closeFollowerMap:closeFollowerMap,
    ensureSettingsMarkup:ensureSettingsMarkup,
    paintSignup:paintSignup,
    wireSignup:wireSignup,
    settlePath:function(){ return "/api/god-settle"; },
    gradeLabel:function(){ return "🔱 God re-grade:"; },
    settledDeleteTitle:function(){ return "God-delete & redact"; },
    gradeTitle:function(result){ return "🔱 God-mode grade: "+result+"?"; },
    gradeConfirm:function(result){ return "Override as "+result; },
    gradeToast:function(result){ return "🔱 Overriding as "+result; },
    followerHint:function(){
      return '<span id="fgodhint" style="color:var(--warn,#e0a04a);font-size:var(--t-cap);margin-left:8px;font-weight:700">🔱 God — expand a member to re-grade / settle</span>';
    }
  };
  TD.loaded["owner-tools"]=true;
})();
