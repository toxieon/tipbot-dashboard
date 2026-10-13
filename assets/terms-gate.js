/* Terms & Conditions acceptance gate (tipdash).
   The terms text and version come from TipBot (GET /api/terms, one file there).
   Signed-in users who haven't accepted the current version see a full-screen
   overlay with the text and an Accept button; nothing behind it is usable until
   they tick the 18+ box and accept (POST /api/terms/accept, age_confirmed). Everyone is gated, the owner too.
   Styling: assets/terms-gate.css (plain, tg-* classes, easy to reskin). */
(function(root){
  "use strict";
  var doc=root.document, STATE_T={version:"", checking:false, open:false};
  function el(id){ return doc.getElementById(id); }
  function escHtml(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];}); }
  function paragraphs(text){
    if(root.TBLegalMd) return root.TBLegalMd.render(text);
    return String(text||"").split(/\n{2,}/).map(function(p){ return "<p>"+escHtml(p).replace(/\n/g,"<br>")+"</p>"; }).join("");
  }
  function setVersionLine(v){
    var line=el("terms-ver"); if(!line) return;
    line.textContent=v?("Terms v"+v):""; line.hidden=!v;
  }
  function overlay(){
    var o=el("terms-gate");
    if(o) return o;
    o=doc.createElement("div"); o.id="terms-gate"; o.className="tg-overlay"; o.hidden=true;
    o.setAttribute("role","dialog"); o.setAttribute("aria-modal","true"); o.setAttribute("aria-labelledby","tg-title");
    o.innerHTML='<div class="tg-card"><h2 id="tg-title" class="tg-title">Terms &amp; Conditions</h2>'
      +'<div class="tg-ver" id="tg-ver"></div><div class="tg-body" id="tg-body" tabindex="0"></div>'
      +'<p class="tg-msg" id="tg-msg" role="status" aria-live="polite"></p>'
      +'<label class="tg-age"><input type="checkbox" id="tg-age"> I confirm I am 18 or older.</label>'
      +'<p class="tg-links">Also read: <a href="/privacy/" target="_blank" rel="noopener">Privacy</a> · <a href="/refund/" target="_blank" rel="noopener">Refunds</a> · <a href="/renewal/" target="_blank" rel="noopener">Renewals</a> · <a href="/cookies/" target="_blank" rel="noopener">Cookies</a> · <a href="/age/" target="_blank" rel="noopener">Age Policy</a></p>'
      +'<div class="tg-actions"><button type="button" class="tg-accept" id="tg-accept" disabled aria-describedby="tg-age-hint">Accept</button></div>'
      +'<p class="tg-hint" id="tg-age-hint">Tick the 18+ box to continue.</p></div>';
    doc.body.appendChild(o);
    return o;
  }
  function lockPage(on){ doc.documentElement.classList.toggle("tg-locked", !!on); var app=el("app"); if(app){ if(on) app.setAttribute("inert",""); else app.removeAttribute("inert"); } }
  function show(t, api){
    var o=overlay();
    el("tg-title").textContent=t.title||"Terms & Conditions";
    el("tg-ver").textContent="Version "+t.version;
    el("tg-body").innerHTML=paragraphs(t.text);
    el("tg-msg").textContent="";
    var btn=el("tg-accept"), age=el("tg-age"), hint=el("tg-age-hint");
    age.checked=false; btn.disabled=true; hint.hidden=false;
    age.onchange=function(){ btn.disabled=!age.checked; hint.hidden=age.checked; };
    btn.onclick=async function(){
      if(!age.checked){ btn.disabled=true; return; }
      btn.disabled=true; el("tg-msg").textContent="Saving…";
      try{
        var r=await api("/api/terms/accept",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({version:t.version, age_confirmed:true})});
        var j=null; try{ j=await r.json(); }catch(e){}
        if(r.status===409){ el("tg-msg").textContent=(j&&j.error)||"The terms changed."; STATE_T.open=false; return check(api); }
        if(!r.ok||!j||j.ok!==true){ el("tg-msg").textContent=(j&&j.error)||"Couldn't save. Please try again."; btn.disabled=!age.checked; return; }
        hide();
      }catch(e){ el("tg-msg").textContent="Couldn't reach TipBot. Please try again."; btn.disabled=!age.checked; }
    };
    o.hidden=false; STATE_T.open=true; lockPage(true);
    try{ age.focus(); }catch(e){}
  }
  function hide(){ var o=el("terms-gate"); if(o) o.hidden=true; STATE_T.open=false; lockPage(false); }
  async function check(api){
    if(STATE_T.checking||STATE_T.open) return;
    STATE_T.checking=true;
    try{
      var r=await api("/api/terms/status",{retries:2,timeoutMs:15000});
      if(!r||!r.ok) return;            // unknown: don't block on a transient error; re-checked next boot
      var s=await r.json();
      STATE_T.version=s.version||""; setVersionLine(STATE_T.version);
      if(!s.version||s.accepted) return;
      var tr=await api("/api/terms",{retries:2,timeoutMs:15000});
      if(!tr||!tr.ok) return;
      var t=await tr.json();
      if(t&&t.version) show(t, api);
    }catch(e){ /* unauth etc.: the page's own login flow handles it */ }
    finally{ STATE_T.checking=false; }
  }
  root.TBTerms={check:check, hide:hide, _state:STATE_T};
})(window);
