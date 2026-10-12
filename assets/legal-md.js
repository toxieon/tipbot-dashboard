/* Tiny safe markdown renderer for the legal pages and the terms prompt.
   Escapes everything first, then adds headings, lists, quotes, bold/italic,
   <sub>, and links (site paths and https only). */
(function(root){
  "use strict";
  function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];}); }
  function inline(t){
    t=esc(t);
    t=t.replace(/&lt;sub&gt;(.*?)&lt;\/sub&gt;/g,"<small>$1</small>");
    t=t.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/(^|[^*])\*([^*\s][^*]*?)\*/g,"$1<em>$2</em>");
    t=t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g,function(m,txt,href){
      var h=href.replace(/&amp;/g,"&");
      if(!/^(\/(?!\/)|#|https:\/\/|mailto:)/i.test(h)) return txt;
      var ext=/^https:/i.test(h);
      return '<a href="'+esc(h)+'"'+(ext?' rel="noopener" target="_blank"':'')+'>'+txt+'</a>';
    });
    return t;
  }
  function render(src){
    var lines=String(src||"").replace(/\r/g,"").split("\n"), out=[], list=null, para=[], quote=[];
    function flushP(){ if(para.length){ out.push("<p>"+inline(para.join(" "))+"</p>"); para=[]; } }
    function flushL(){ if(list){ out.push("<"+list.t+">"+list.items.map(function(i){return "<li>"+inline(i)+"</li>";}).join("")+"</"+list.t+">"); list=null; } }
    function flushQ(){ if(quote.length){ out.push("<blockquote>"+render(quote.join("\n"))+"</blockquote>"); quote=[]; } }
    function flush(){ flushP(); flushL(); flushQ(); }
    lines.forEach(function(raw){
      var l=raw.replace(/\s+$/,""), m;
      if(/^>\s?/.test(l)){ flushP(); flushL(); quote.push(l.replace(/^>\s?/,"")); return; }
      flushQ();
      if(!l.trim()){ flushP(); flushL(); return; }
      if((m=/^(#{1,4})\s+(.*)$/.exec(l))){ flush(); var n=Math.min(4,m[1].length+1); out.push("<h"+n+">"+inline(m[2])+"</h"+n+">"); return; }
      if(/^(-{3,}|\*{3,})$/.test(l.trim())){ flush(); out.push("<hr>"); return; }
      if((m=/^\s*([-*]|\d+\.)\s+(.*)$/.exec(l))){ flushP(); var t=/\d/.test(m[1])?"ol":"ul"; if(!list||list.t!==t){ flushL(); list={t:t,items:[]}; } list.items.push(m[2]); return; }
      if(list&&/^\s{2,}\S/.test(raw)){ list.items[list.items.length-1]+=" "+l.trim(); return; }
      flushL(); para.push(l.trim());
    });
    flush();
    return out.join("\n");
  }
  var API={render:render, esc:esc};
  if(typeof module!=="undefined"&&module.exports) module.exports=API;
  root.TBLegalMd=API;
})(typeof window!=="undefined"?window:globalThis);
