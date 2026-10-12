/* Cookie consent banner. Built but OFF: tipdash uses no cookies yet.
   Turn on by setting COOKIE_BANNER_ENABLED to true (or window.TB_COOKIE_BANNER=true
   before this script) once non-essential cookies are added. The choice is kept
   in localStorage ("tb_cookie_consent": "accepted" | "rejected"). */
(function(root){
  "use strict";
  var COOKIE_BANNER_ENABLED=false;
  var KEY="tb_cookie_consent";
  function enabled(){ return root.TB_COOKIE_BANNER===true||COOKIE_BANNER_ENABLED===true; }
  function choice(){ try{ return root.localStorage.getItem(KEY); }catch(e){ return null; } }
  function save(v){ try{ root.localStorage.setItem(KEY,v); }catch(e){} }
  function show(){
    var d=root.document; if(!d||!d.body||d.getElementById("cookie-banner")) return;
    var b=d.createElement("div"); b.id="cookie-banner"; b.className="cc-banner";
    b.setAttribute("role","region"); b.setAttribute("aria-label","Cookie consent");
    b.innerHTML='<p class="cc-text">We use cookies to run tipdash. See our <a href="/cookies/">Cookie Policy</a>.</p>'
      +'<div class="cc-actions"><button type="button" class="cc-btn" data-cc="rejected">Reject non-essential</button>'
      +'<button type="button" class="cc-btn cc-primary" data-cc="accepted">Accept</button></div>';
    b.addEventListener("click",function(e){ var v=e.target&&e.target.getAttribute&&e.target.getAttribute("data-cc"); if(!v) return; save(v); b.remove(); });
    d.body.appendChild(b);
  }
  function init(){ if(enabled()&&!choice()) show(); }
  root.TBCookieConsent={init:init, show:show, enabled:enabled, choice:choice, KEY:KEY};
  if(root.document){ if(root.document.readyState==="loading") root.document.addEventListener("DOMContentLoaded",init); else init(); }
})(window);
