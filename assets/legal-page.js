/* Legal pages (/privacy/, /refund/, ...): loads the text from TipBot
   (GET /api/legal/<slug>) and renders it. <body data-doc="privacy">. */
(function(){
  "use strict";
  var API_BASE="https://afl-tipster-bot.onrender.com";
  var slug=document.body.getAttribute("data-doc")||"";
  var box=document.getElementById("legal-body"), ttl=document.getElementById("legal-title"), ver=document.getElementById("legal-ver");
  function fail(msg){ box.innerHTML='<p class="legal-err" role="status">'+TBLegalMd.esc(msg)+'</p>'; }
  fetch(API_BASE+"/api/legal/"+encodeURIComponent(slug),{credentials:"omit"}).then(function(r){
    if(!r.ok) throw new Error(String(r.status)); return r.json();
  }).then(function(d){
    if(!d||!d.ok){ fail("This page isn't available right now."); return; }
    ttl.textContent=d.title||ttl.textContent; document.title=(d.title||"Legal")+" — TipBot";
    ver.textContent=d.version?("Version "+d.version):""; ver.hidden=!d.version;
    box.innerHTML=TBLegalMd.render(d.text);
  }).catch(function(){ fail("Couldn't load this page. Please try again shortly."); });
})();
