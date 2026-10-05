/* tipdash Admin Tools · Paste tip sheet (2.2b, 0.40.2): moved unchanged out of index.html's main script and loaded
 * the first time it's opened (index.html TD.load("admin"), cache-busted with ?v=<VERSION>).
 * This is a plain script in the page's global scope: it uses index.html's BUILD, BATCH, STATE, $, esc,
 * api … by name, and its function declarations replace the placeholders index.html keeps for its
 * entry points (pasteSheetPreview, pasteSheetConfirm). Don't turn it into a module or wrap it in a closure.
 */

  /* ---------- Paste tip sheet (owner · Admin Tools · POST /api/owner/import-tips) ---------- */
  const PASTE_SHEET={guildId:null, text:"", preview:null, sheetHash:null, apiPending:false};

  function parseTipSheetYamlFrontmatter(raw){
    const text=String(raw||"").replace(/^\uFEFF/,"");
    const m=text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    const meta={};
    let body=text;
    if(m){
      body=m[2];
      m[1].split(/\r?\n/).forEach(line=>{
        const t=line.trim(); if(!t||t.startsWith("#")) return;
        const i=t.indexOf(":");
        if(i<0) return;
        const k=t.slice(0,i).trim().toLowerCase();
        let v=t.slice(i+1).trim();
        if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'"))) v=v.slice(1,-1);
        meta[k]=v;
      });
    }
    return {meta:meta, body:body};
  }
  function splitTipSheetRow(line){
    if(line.indexOf("\t")>=0) return line.split("\t").map(function(c){ return c.trim(); });
    return line.split(/ {2,}|\t/).map(function(c){ return c.trim(); });
  }
  // 6.5: a sheet whose first line starts "kind," (no tab) is the CSV template, filled in.
  // Same detection as TipBot's parse_tipsheet; TSV / two-space sheets are read as before.
  function splitCsvRow(line){
    const out=[]; let cur="", q=false;
    for(let i=0;i<line.length;i++){
      const ch=line[i];
      if(q){
        if(ch==='"'){ if(line[i+1]==='"'){ cur+='"'; i++; } else q=false; }
        else cur+=ch;
      }else if(ch==='"') q=true;
      else if(ch===","){ out.push(cur.trim()); cur=""; }
      else cur+=ch;
    }
    out.push(cur.trim());
    return out;
  }
  function parseTipSheet(raw){
    const parsedFm=parseTipSheetYamlFrontmatter(raw);
    const meta=parsedFm.meta, body=parsedFm.body;
    const lines=body.split(/\r?\n/).map(function(l){ return l.trimEnd(); }).filter(function(l){ return l.trim() && !l.trim().startsWith("#"); });
    const csvMode=lines.length>0 && lines[0].indexOf("\t")<0 && /^kind,/i.test(lines[0].trim());
    if(csvMode){
      for(let i=0;i<lines.length;i++) lines[i]=splitCsvRow(lines[i]).join("\t");
    }
    const errors=[];
    const rows=[];
    let header=null;
    for(let i=0;i<lines.length;i++){
      const cells=splitTipSheetRow(lines[i]);
      const low=cells.map(function(c){ return String(c||"").toLowerCase(); });
      if(!header && low[0]==="kind"){ header=low; continue; }
      const get=function(name, idx){
        if(header){ const hi=header.indexOf(name); return hi>=0?(cells[hi]||""):""; }
        return cells[idx]!=null?cells[idx]:"";
      };
      const kind=String(get("kind",0)||"").toUpperCase();
      const rowNum=i+1;
      if(kind!=="SINGLE" && kind!=="MULTI"){
        errors.push({row:rowNum, message:"kind must be SINGLE or MULTI", hard:true});
        continue;
      }
      const game=get("game",1), player=get("player",2), stat=get("stat",3);
      const lineRaw=get("line",4), side=get("side",5), oddsRaw=get("odds",6), unitsRaw=get("units",7), group=get("group",8);
      const line=lineRaw===""?null:Number(lineRaw);
      const odds=oddsRaw===""?null:Number(oddsRaw);
      const units=unitsRaw===""?null:Number(unitsRaw);
      const missing=[];
      if(!game) missing.push("game");
      if(!player) missing.push("player");
      if(!stat) missing.push("stat");
      if(line==null||!Number.isFinite(line)) missing.push("line");
      if(!side) missing.push("side");
      if(odds==null||!Number.isFinite(odds)||odds<=1) missing.push("odds");
      if(units==null||!Number.isFinite(units)||units<=0) missing.push("units");
      if(kind==="MULTI" && !String(group||"").trim()) missing.push("group");
      const hard=missing.length>0;
      if(hard) errors.push({row:rowNum, message:"Incomplete: missing "+missing.join(", "), hard:true});
      rows.push({row:rowNum, kind:kind, game:game, player:player, stat:stat, line:line, side:side, odds:odds, units:units, group:kind==="MULTI"?String(group||"").trim():"", hard:hard, missing:missing});
    }
    const singles=[];
    const multiMap=new Map();
    rows.forEach(function(r){
      if(r.kind==="SINGLE"){
        singles.push({kind:"SINGLE", game_name:r.game, odds:r.odds, units:r.units, legs:[{player:r.player,stat:r.stat,line:r.line,side:r.side,game:r.game}], rows:[r.row], hard:r.hard, errors:r.hard?[r.missing.join(", ")]:[]});
      }else{
        if(!multiMap.has(r.group)) multiMap.set(r.group,{kind:"MULTI", group:r.group, legs:[], rows:[], hard:false, errors:[]});
        const m=multiMap.get(r.group);
        m.legs.push({player:r.player,stat:r.stat,line:r.line,side:r.side,game:r.game,odds:r.odds,units:r.units});
        m.rows.push(r.row);
        if(r.hard){ m.hard=true; m.errors.push("row "+r.row+": "+(r.missing||[]).join(", ")); }
      }
    });
    const multis=Array.from(multiMap.values()).map(function(m){
      const odds=m.legs.reduce(function(acc,l){ return acc*(Number(l.odds)||1); }, 1);
      const units=Number(m.legs[0]&&m.legs[0].units)||1;
      const games=[];
      m.legs.forEach(function(l){ if(l.game && games.indexOf(l.game)<0) games.push(l.game); });
      const hard=m.hard || m.legs.length<2;
      const errs=m.errors.slice();
      if(m.legs.length<2){ errs.push("MULTI needs ≥2 legs"); errors.push({row:m.rows[0]||0, message:"MULTI group "+m.group+" needs ≥2 legs", hard:true}); }
      return {kind:"MULTI", group:m.group, game_name:games.length===1?games[0]:(games.length+" games"), odds:Math.round(odds*100)/100, units:units, legs:m.legs.map(function(l){ return {player:l.player,stat:l.stat,line:l.line,side:l.side,game:l.game}; }), rows:m.rows, hard:hard, errors:errs};
    });
    const tipCount=singles.length+multis.length;
    const hardErrors=errors.filter(function(e){ return e.hard; });
    return {meta:meta, rows:rows, singles:singles, multis:multis, tips:singles.concat(multis), errors:errors, hardErrors:hardErrors, tipCount:tipCount, ok:hardErrors.length===0 && tipCount>0};
  }
  async function sheetHash(text){
    const norm=String(text||"").replace(/\r\n/g,"\n").trim();
    try{
      if(typeof crypto!=="undefined" && crypto.subtle){
        const buf=await crypto.subtle.digest("SHA-256", new TextEncoder().encode(norm));
        return Array.from(new Uint8Array(buf)).map(function(b){ return b.toString(16).padStart(2,"0"); }).join("").slice(0,40);
      }
    }catch(e){}
    let h=2166136261>>>0;
    for(let i=0;i<norm.length;i++){ h^=norm.charCodeAt(i); h=Math.imul(h,16777619)>>>0; }
    return ("00000000"+h.toString(16)).slice(-8)+"-"+norm.length;
  }
  function renderPastePreview(parsed){
    const box=$("paste-preview");
    if(!box) return;
    if(!parsed || (!parsed.tips.length && !parsed.errors.length)){
      box.innerHTML='<div class="empty">Nothing to preview — paste a TipSheet and hit Preview.</div>';
      return;
    }
    const metaBits=[];
    if(parsed.meta.guild) metaBits.push("guild "+parsed.meta.guild);
    if(parsed.meta.channel) metaBits.push("#"+parsed.meta.channel);
    if(parsed.meta.memo) metaBits.push(parsed.meta.memo);
    if(parsed.meta.trickle_seconds!=null && parsed.meta.trickle_seconds!=="") metaBits.push("trickle "+parsed.meta.trickle_seconds+"s");
    let html="";
    if(metaBits.length) html+='<div style="font-size:var(--t-foot);color:var(--faint);margin-bottom:4px">'+esc(metaBits.join(" · "))+'</div>';
    if(parsed.hardErrors.length){
      html+='<div class="tbwarn" style="margin-bottom:8px">'+parsed.hardErrors.length+' row error'+(parsed.hardErrors.length===1?"":"s")+' — fix before confirm.</div>';
    }
    parsed.singles.forEach(function(t){
      html+='<div class="paste-card'+(t.hard?' paste-card--err':'')+'"><div class="paste-card-hd"><span class="paste-card-kind">SINGLE</span><span class="paste-card-meta">'+esc(String(t.units))+'u @ '+esc(String(t.odds))+'</span></div>';
      html+='<div style="font-weight:700;font-size:var(--t-sub);margin-bottom:4px">'+esc(t.game_name||"")+'</div>';
      (t.legs||[]).forEach(function(l){
        html+='<div class="paste-leg">'+esc(l.player)+' · '+esc(l.stat)+' '+esc(String(l.side))+' '+esc(String(l.line))+'</div>';
      });
      if(t.hard) html+='<div class="paste-err">Incomplete row</div>';
      html+='</div>';
    });
    parsed.multis.forEach(function(t){
      html+='<div class="paste-card paste-card--multi'+(t.hard?' paste-card--err':'')+'"><div class="paste-card-hd"><span class="paste-card-kind">MULTI · '+esc(t.group||"")+'</span><span class="paste-card-meta">'+(t.legs||[]).length+' legs · '+esc(String(t.units))+'u @ ~'+esc(String(t.odds))+'</span></div>';
      html+='<div style="font-weight:700;font-size:var(--t-sub);margin-bottom:4px">'+esc(t.game_name||"")+'</div>';
      (t.legs||[]).forEach(function(l){
        html+='<div class="paste-leg">'+esc(l.player)+' · '+esc(l.stat)+' '+esc(String(l.side))+' '+esc(String(l.line))+(l.game&&l.game!==t.game_name?' <span style="color:var(--faint)">('+esc(l.game)+')</span>':'')+'</div>';
      });
      if(t.hard) html+='<div class="paste-err">'+esc((t.errors||["Incomplete"]).join("; "))+'</div>';
      html+='</div>';
    });
    if(!html) html='<div class="empty">No tips parsed.</div>';
    box.innerHTML=html;
    const conf=$("paste-confirm");
    if(conf){
      const block=!parsed.ok || parsed.hardErrors.length>0 || parsed.tipCount===0;
      conf.disabled=block;
      conf.style.opacity=block?".45":"1";
      conf.style.cursor=block?"not-allowed":"pointer";
    }
    const sum=$("paste-summary");
    if(sum){
      sum.textContent=parsed.tipCount+" tip"+(parsed.tipCount===1?"":"s")+" · "+parsed.singles.length+" single · "+parsed.multis.length+" multi"+(parsed.hardErrors.length?" · "+parsed.hardErrors.length+" error"+(parsed.hardErrors.length===1?"":"s"):"");
    }
  }
  async function pasteSheetPreview(guildId){
    const ta=$("paste-sheet-ta"), msg=$("paste-sheet-msg");
    const text=(ta&&ta.value)||"";
    if(!text.trim()){ if(msg){ msg.style.color="var(--faint)"; msg.textContent="Paste a TipSheet first."; } return; }
    const parsed=parseTipSheet(text);
    PASTE_SHEET.guildId=guildId;
    PASTE_SHEET.text=text;
    PASTE_SHEET.preview=parsed;
    PASTE_SHEET.sheetHash=await sheetHash(text);
    renderPastePreview(parsed);
    if(msg){ msg.style.color="var(--faint)"; msg.textContent="Previewing…"; }
    try{
      const r=await api("/api/owner/import-tips",{
        method:"POST",
        headers:{"Content-Type":"application/json","Idempotency-Key":"dry-"+PASTE_SHEET.sheetHash},
        body:JSON.stringify({text:text, dry_run:true, guild_id:String(guildId)}),
        idempotent:true
      });
      const raw=await r.text();
      let j=null; try{ j=raw?JSON.parse(raw):null; }catch(e){ j=null; }
      if(r.status===404){
        PASTE_SHEET.apiPending=true;
        if(msg){ msg.style.color="var(--warn,#e0a04a)"; msg.textContent="API pending deploy — client preview only. Confirm will retry TipBot."; }
        return;
      }
      PASTE_SHEET.apiPending=false;
      if(r.ok && j){
        const srvErrs=j.errors || (j.preview&&j.preview.errors) || [];
        if(Array.isArray(srvErrs) && srvErrs.length){
          srvErrs.forEach(function(e){
            const row=e.row||e.line||0;
            const message=e.message||e.error||String(e);
            parsed.errors.push({row:row, message:message, hard:e.hard!==false});
            if(e.hard!==false) parsed.hardErrors.push({row:row, message:message, hard:true});
          });
          parsed.ok=parsed.hardErrors.length===0 && parsed.tipCount>0;
          renderPastePreview(parsed);
        }
        if(msg){ msg.style.color="var(--faint)"; msg.textContent=j.message||("Dry-run ok · "+parsed.tipCount+" tip(s)"); }
      }else{
        if(msg){ msg.style.color="#f0857f"; msg.textContent=(j&&(j.message||j.error))||("Dry-run failed (HTTP "+r.status+")"); }
      }
    }catch(e){
      if(e&&e.unauth){ renderLogin("Session expired."); return; }
      if(msg){ msg.style.color="var(--warn,#e0a04a)"; msg.textContent="Couldn't reach TipBot — showing client preview."; }
    }
  }
  async function pasteSheetConfirm(guildId){
    const msg=$("paste-sheet-msg"), conf=$("paste-confirm");
    const text=PASTE_SHEET.text || (($("paste-sheet-ta")||{}).value)||"";
    const parsed=PASTE_SHEET.preview || parseTipSheet(text);
    if(!parsed.ok || parsed.hardErrors.length){
      if(msg){ msg.style.color="#f0857f"; msg.textContent="Fix incomplete rows before confirm."; }
      return;
    }
    if(!text.trim()){ if(msg) msg.textContent="Nothing to import."; return; }
    const prog=SubmitProgress.open({
      btn:conf, anchor:msg, id:"sheetprog",
      busyLabel:"Importing…", sendingLabel:"Importing tip sheet…",
    });
    if(msg){ msg.style.color="var(--faint)"; msg.textContent="Importing…"; }
    const hash=PASTE_SHEET.sheetHash || await sheetHash(text);
    try{
      const r=await api("/api/owner/import-tips",{
        method:"POST",
        headers:{"Content-Type":"application/json","Idempotency-Key":"sheet-"+hash},
        body:JSON.stringify({text:text, dry_run:false, guild_id:String(guildId)}),
        idempotent:true, retries:4, onAttempt:prog.onAttempt
      });
      const raw=await r.text();
      let j=null; try{ j=raw?JSON.parse(raw):null; }catch(e){ j=null; }
      if(r.status===404){
        if(msg){ msg.style.color="var(--warn,#e0a04a)"; msg.textContent="API pending deploy — TipBot /api/owner/import-tips not live yet."; }
        toast("API pending deploy");
        prog.fail("API pending deploy");
        return;
      }
      if(r.ok && j && (j.ok!==false)){
        const q=j.queued!=null?j.queued:(j.count!=null?j.count:(j.tips_queued!=null?j.tips_queued:parsed.tipCount));
        prog.ok("Queued "+q+" tip(s)");
        if(msg){ msg.style.color="var(--win-ink)"; msg.textContent=(j.message||("Queued "+q+" tip(s)"))+(j.replayed?" (replayed)":""); }
        toast((q!=null?q+" tip(s) queued":"Import queued"),"success");
        if(window.NDConfirmPop) NDConfirmPop.show({label:String(q)+" queued", color:"#2eaf62"});
        loadDetail(guildId);
        return;
      }
      const im=(j&&(j.message||j.error||j.detail))||("Import failed (HTTP "+r.status+")");
      if(msg){ msg.style.color="#f0857f"; msg.textContent=im; }
      prog.fail(im);
    }catch(e){
      if(e&&e.unauth) return renderLogin("Session expired.");
      if(msg){ msg.style.color="#f0857f"; msg.textContent="Couldn't reach TipBot."; }
      prog.fail("Couldn't reach TipBot.");
    }
  }
  async function pasteSheetTemplate(){
    const msg=$("paste-sheet-msg");
    try{
      const r=await api("/api/owner/tipsheet-template");
      if(r.status===404){
        if(msg){ msg.style.color="var(--warn,#e0a04a)"; msg.textContent="This needs TipBot's latest deploy. Retry with the button once it's live."; }
        return;
      }
      if(!r.ok){
        if(msg){ msg.style.color="#f0857f"; msg.textContent=r.status===403?"Owner only.":"Couldn't get the template (HTTP "+r.status+")."; }
        return;
      }
      const text=await r.text();
      const url=URL.createObjectURL(new Blob([text],{type:"text/csv"}));
      const a=document.createElement("a");
      a.href=url; a.download="tipsheet-template.csv";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function(){ URL.revokeObjectURL(url); }, 2000);
      if(msg){ msg.style.color="var(--faint)"; msg.textContent="Template downloaded. Fill it in, then paste the rows (or the whole file) above."; }
    }catch(e){
      if(e&&e.unauth) return renderLogin("Session expired.");
      if(msg){ msg.style.color="#f0857f"; msg.textContent="Couldn't reach TipBot."; }
    }
  }
  TD.loaded.admin=true;
