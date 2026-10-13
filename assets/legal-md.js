/* Tiny safe markdown renderer for the legal pages and the terms prompt.
   Escapes everything first, then adds headings, lists, quotes, bold/italic,
   <sub>, and links (site paths and https only). */
(function(root){
  "use strict";
  function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];}); }
  var DOC_LINKS={"terms-draft.md":"/terms/","privacy-policy.md":"/privacy/","refund-policy.md":"/refund/","renewal-terms.md":"/renewal/","cookie-policy.md":"/cookies/","accessibility.md":"/accessibility/","age-policy.md":"/age/","user-content-licence.md":"/content-licence/"};
  function relink(h){
    var m=/^\.?\/?([A-Za-z0-9_-]+\.md)(#.*)?$/.exec(h);
    return m&&DOC_LINKS[m[1]]?DOC_LINKS[m[1]]+(m[2]||""):h;
  }
  function slug(t){ return String(t).toLowerCase().replace(/<[^>]+>/g,"").replace(/&[a-z#0-9]+;/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"")||"section"; }
  function cells(l){ return l.replace(/^\s*\|/,"").replace(/\|\s*$/,"").split("|").map(function(c){return c.trim();}); }
  function inline(t){
    t=esc(t);
    t=t.replace(/&lt;sub&gt;(.*?)&lt;\/sub&gt;/g,"<small>$1</small>");
    t=t.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/(^|[^*])\*([^*\s][^*]*?)\*/g,"$1<em>$2</em>");
    t=t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g,function(m,txt,href){
      var h=relink(href.replace(/&amp;/g,"&"));
      if(!/^(\/(?!\/)|#|https:\/\/|mailto:)/i.test(h)) return txt;
      var ext=/^https:/i.test(h);
      return '<a href="'+esc(h)+'"'+(ext?' rel="noopener" target="_blank"':'')+'>'+txt+'</a>';
    });
    return t;
  }
  function render(src, ids){
    ids=ids||{};
    var lines=String(src||"").replace(/\r/g,"").split("\n"), out=[], list=null, para=[], quote=[], table=null;
    function flushT(){ if(table){ var h=table.shift()||[]; out.push('<div class="legal-table-wrap"><table class="legal-table"><thead><tr>'+h.map(function(c){return '<th scope="col">'+inline(c)+"</th>";}).join("")+"</tr></thead><tbody>"+table.map(function(r){return "<tr>"+r.map(function(c){return "<td>"+inline(c)+"</td>";}).join("")+"</tr>";}).join("")+"</tbody></table></div>"); table=null; } }
    function flushP(){ if(para.length){ out.push("<p>"+inline(para.join(" "))+"</p>"); para=[]; } }
    function flushL(){ if(list){ out.push("<"+list.t+">"+list.items.map(function(i){return "<li>"+inline(i)+"</li>";}).join("")+"</"+list.t+">"); list=null; } }
    function flushQ(){ if(quote.length){ out.push("<blockquote>"+render(quote.join("\n"),ids)+"</blockquote>"); quote=[]; } }
    function flush(){ flushP(); flushL(); flushQ(); flushT(); }
    lines.forEach(function(raw){
      var l=raw.replace(/\s+$/,""), m;
      if(!quote.length&&/^\s*\|.*\|\s*$/.test(l)){
        flushP(); flushL();
        if(/^\s*\|?\s*:?-{2,}/.test(l)&&table) return;   // separator row
        (table=table||[]).push(cells(l)); return;
      }
      flushT();
      if(/^>\s?/.test(l)){ flushP(); flushL(); quote.push(l.replace(/^>\s?/,"")); return; }
      flushQ();
      if(!l.trim()){ flushP(); flushL(); return; }
      if((m=/^(#{1,4})\s+(.*)$/.exec(l))){ flush(); var n=Math.min(4,m[1].length+1), txt=m[2], num=/^(\d+)\.\s+(.*)$/.exec(txt), id;
        if(n===3&&num){ id="s"+num[1]; } else { id=slug(txt); }
        if(ids[id]){ var k=2; while(ids[id+"-"+k]) k++; id=id+"-"+k; } ids[id]=1;
        out.push('<h'+n+' id="'+esc(id)+'">'+(n===3&&num?'<span class="legal-num">'+esc(num[1])+'.</span>'+inline(num[2]):inline(txt))+"</h"+n+">"); return; }
      if(/^(-{3,}|\*{3,})$/.test(l.trim())){ flush(); out.push("<hr>"); return; }
      if((m=/^\s*([-*]|\d+\.)\s+(.*)$/.exec(l))){ flushP(); var t=/\d/.test(m[1])?"ol":"ul"; if(!list||list.t!==t){ flushL(); list={t:t,items:[]}; } list.items.push(m[2]); return; }
      if(list&&/^\s{2,}\S/.test(raw)){ list.items[list.items.length-1]+=" "+l.trim(); return; }
      flushL(); para.push(l.trim());
    });
    flush();
    return out.join("\n");
  }
  function toc(html){
    var re=/<h3 id="([^"]+)">(.*?)<\/h3>/g, m, items=[];
    while((m=re.exec(html))) items.push('<li><a href="#'+m[1]+'">'+m[2].replace(/<span class="legal-num">([^<]*)<\/span>/,'<span class="cc-n">$1</span> ')+"</a></li>");
    return items;
  }
  var API={render:render, esc:esc, toc:toc, slug:slug};
  if(typeof module!=="undefined"&&module.exports) module.exports=API;
  root.TBLegalMd=API;
})(typeof window!=="undefined"?window:globalThis);
