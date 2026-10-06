/* Hand-written SVG charts for the server page (tipdash 0.44.1).
 * Colours are theme variables (day / night / ochre). No chart library.
 * window.SvgCharts + CommonJS for node --test.
 */
(function(root){
  "use strict";
  function esc(s){
    return String(s==null?"":s).replace(/[&<>"']/g, function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c];
    });
  }
  function n(v){
    var x=Number(v);
    return Number.isFinite(x)?x:0;
  }
  function r1(v){ return (Math.round(v*10)/10).toFixed(1); }
  function niceStep(span, count){
    if(!(span>0)) return 1;
    var raw=span/Math.max(1, count||4);
    var pow=Math.pow(10, Math.floor(Math.log10(raw)));
    var err=raw/pow;
    var nice=err<=1?1:err<=2?2:err<=5?5:10;
    return nice*pow;
  }
  function ticksBetween(min, max, count){
    if(!(max>min)) return [min];
    var step=niceStep(max-min, count||4);
    var start=Math.ceil(min/step)*step;
    var out=[];
    for(var v=start; v<=max+step*0.01; v+=step){
      var t=Math.round(v*1000)/1000;
      if(t<min-step*0.01) continue;
      if(t>max+step*0.01) break;
      out.push(t);
      if(out.length>8) break;
    }
    if(min<=0 && max>=0 && out.indexOf(0)<0) out.push(0);
    out.sort(function(a,b){ return a-b; });
    return out;
  }
  /* Smooth line through points. smooth is the mock-up tension (about 0.65). */
  function linePath(pts, smooth){
    if(!pts.length) return "";
    if(!smooth || pts.length<3){
      return pts.map(function(p,i){ return (i?"L":"M")+r1(p[0])+" "+r1(p[1]); }).join(" ");
    }
    var d="M"+r1(pts[0][0])+" "+r1(pts[0][1]);
    var t=smooth/6;
    for(var i=0;i<pts.length-1;i++){
      var p0=pts[i-1]||pts[i], p1=pts[i], p2=pts[i+1], p3=pts[i+2]||p2;
      var c1=[p1[0]+(p2[0]-p0[0])*t, p1[1]+(p2[1]-p0[1])*t];
      var c2=[p2[0]-(p3[0]-p1[0])*t, p2[1]-(p3[1]-p1[1])*t];
      d+=" C"+r1(c1[0])+" "+r1(c1[1])+" "+r1(c2[0])+" "+r1(c2[1])+" "+r1(p2[0])+" "+r1(p2[1]);
    }
    return d;
  }
  function areaChart(opts){
    opts=opts||{};
    var data=(opts.data||[]).map(n);
    if(data.length<2) return "";
    var w=opts.w||640, h=opts.h||220;
    var padL=opts.padL!=null?opts.padL:36, padR=opts.padR!=null?opts.padR:12;
    var padT=opts.padT!=null?opts.padT:12, padB=opts.padB!=null?opts.padB:26;
    var color=opts.color||"var(--accent)";
    var id=String(opts.id||"u").replace(/[^a-zA-Z0-9_-]/g,"");
    var font=opts.fontSize||11;
    var lo=Math.min.apply(null, data.concat([0]));
    var hi=Math.max.apply(null, data.concat([0]));
    if(opts.yMin!=null) lo=opts.yMin;
    if(opts.yMax!=null) hi=opts.yMax;
    if(!(hi>lo)){ lo-=1; hi+=1; }
    var pad=(hi-lo)*0.08;
    if(opts.yMin==null) lo-=pad;
    if(opts.yMax==null) hi+=pad;
    var yTicks=opts.yTicks||ticksBetween(Math.min.apply(null, data.concat([0])), Math.max.apply(null, data.concat([0])), 4);
    var yFmt=opts.yFmt||function(v){ return (Math.round(v*10)/10); };
    var xLabels=opts.xLabels||[];
    function X(i){ return padL+(w-padL-padR)*i/(data.length-1); }
    function Y(v){ return padT+(h-padT-padB)*(1-(v-lo)/(hi-lo)); }
    var pts=data.map(function(v,i){ return [X(i), Y(v)]; });
    var line=linePath(pts, opts.smooth==null?0.65:opts.smooth);
    var area=line+" L"+r1(X(data.length-1))+" "+r1(Y(lo))+" L"+r1(padL)+" "+r1(Y(lo))+" Z";
    var label=opts.aria||"Units over time";
    var g='<svg class="sv-svg" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+esc(label)+'" preserveAspectRatio="xMidYMid meet">';
    g+='<defs><linearGradient id="'+id+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+color+'" stop-opacity="0.28"/><stop offset="1" stop-color="'+color+'" stop-opacity="0"/></linearGradient></defs>';
    yTicks.forEach(function(t){
      var yy=Y(t);
      g+='<line x1="'+padL+'" x2="'+(w-padR)+'" y1="'+r1(yy)+'" y2="'+r1(yy)+'" stroke="'+(t===0?"var(--line)":"var(--line)")+'" stroke-opacity="'+(t===0?"1":"0.55")+'" stroke-width="1"/>';
      g+='<text x="'+(padL-6)+'" y="'+r1(yy+4)+'" text-anchor="end" fill="var(--faint)" font-size="'+font+'">'+esc(yFmt(t))+'</text>';
    });
    xLabels.forEach(function(pair, k){
      var i=pair[0], lab=pair[1];
      if(i<0||i>data.length-1) return;
      var anchor=k===0?"start":(k===xLabels.length-1?"end":"middle");
      g+='<text x="'+r1(X(i))+'" y="'+(h-6)+'" text-anchor="'+anchor+'" fill="var(--faint)" font-size="'+font+'">'+esc(lab)+'</text>';
    });
    g+='<path d="'+area+'" fill="url(#'+id+')"/><path d="'+line+'" fill="none" stroke="'+color+'" stroke-width="'+(opts.strokeW||2.2)+'" stroke-linejoin="round" stroke-linecap="round"/>';
    if(opts.endDot!==false){
      var p=pts[pts.length-1];
      g+='<circle cx="'+r1(p[0])+'" cy="'+r1(p[1])+'" r="6" fill="'+color+'" opacity="0.22"/>';
      g+='<circle cx="'+r1(p[0])+'" cy="'+r1(p[1])+'" r="3.2" fill="'+color+'" stroke="var(--card)" stroke-width="1.5"/>';
    }
    return g+"</svg>";
  }
  function barChart(opts){
    opts=opts||{};
    var bars=Array.isArray(opts.bars)?opts.bars:[];
    if(!bars.length) return "";
    var w=opts.w||640, h=opts.h||220;
    var padL=opts.padL!=null?opts.padL:36, padR=opts.padR!=null?opts.padR:8;
    var padT=opts.padT!=null?opts.padT:12, padB=opts.padB!=null?opts.padB:28;
    var vals=bars.map(function(b){ return n(b.value); });
    var lo=Math.min.apply(null, vals.concat([0]));
    var hi=Math.max.apply(null, vals.concat([0]));
    if(!(hi>lo)){ lo-=1; hi+=1; }
    var pad=(hi-lo)*0.1;
    lo-=pad; hi+=pad;
    var yTicks=opts.yTicks||ticksBetween(Math.min.apply(null, vals.concat([0])), Math.max.apply(null, vals.concat([0])), 4);
    var yFmt=opts.yFmt||function(v){ return (Math.round(v*10)/10); };
    var font=opts.fontSize||11;
    function Y(v){ return padT+(h-padT-padB)*(1-(v-lo)/(hi-lo)); }
    var inner=w-padL-padR;
    var gap=bars.length>10?2:4;
    var bw=Math.max(2, (inner-(bars.length-1)*gap)/bars.length);
    var label=opts.aria||"Monthly profit and loss";
    var g='<svg class="sv-svg" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+esc(label)+'" preserveAspectRatio="xMidYMid meet">';
    yTicks.forEach(function(t){
      var yy=Y(t);
      g+='<line x1="'+padL+'" x2="'+(w-padR)+'" y1="'+r1(yy)+'" y2="'+r1(yy)+'" stroke="var(--line)" stroke-opacity="'+(t===0?"1":"0.55")+'" stroke-width="1"/>';
      g+='<text x="'+(padL-6)+'" y="'+r1(yy+4)+'" text-anchor="end" fill="var(--faint)" font-size="'+font+'">'+esc(yFmt(t))+'</text>';
    });
    var zero=Y(0);
    var step=bars.length>8?Math.ceil(bars.length/6):1;
    bars.forEach(function(b,i){
      var v=n(b.value);
      var x=padL+i*(bw+gap);
      var y=Y(v);
      var top=Math.min(y, zero), bh=Math.max(1, Math.abs(y-zero));
      var fill=v>0?"var(--win)":(v<0?"var(--loss)":"var(--faint)");
      g+='<rect x="'+r1(x)+'" y="'+r1(top)+'" width="'+r1(bw)+'" height="'+r1(bh)+'" rx="2" fill="'+fill+'"><title>'+esc((b.label||"")+" "+yFmt(v))+'</title></rect>';
      if(i%step===0 || i===bars.length-1){
        var anchor=i===0?"start":(i===bars.length-1?"end":"middle");
        var tx=i===0?x:(i===bars.length-1?x+bw:x+bw/2);
        g+='<text x="'+r1(tx)+'" y="'+(h-6)+'" text-anchor="'+anchor+'" fill="var(--faint)" font-size="'+font+'">'+esc(b.label||"")+'</text>';
      }
    });
    return g+"</svg>";
  }
  function donut(opts){
    opts=opts||{};
    var slices=Array.isArray(opts.slices)?opts.slices.filter(function(s){ return n(s.n)>0; }):[];
    if(!slices.length) return "";
    var total=slices.reduce(function(a,s){ return a+n(s.n); }, 0);
    if(!(total>0)) return "";
    var cx=50, cy=50, R=44, r=30;
    var a0=-Math.PI/2;
    var seg="";
    slices.forEach(function(s){
      var frac=n(s.n)/total;
      var a1=a0+2*Math.PI*frac;
      var gap=slices.length>1?0.04:0;
      var sA=a0+gap/2, eA=a1-gap/2;
      if(eA<=sA) eA=sA+0.01;
      var large=(eA-sA)>Math.PI?1:0;
      function p(rad, ang){ return [cx+rad*Math.cos(ang), cy+rad*Math.sin(ang)]; }
      var p1=p(R,sA), p2=p(R,eA), p3=p(r,eA), p4=p(r,sA);
      seg+='<path d="M'+r1(p1[0])+' '+r1(p1[1])+' A'+R+' '+R+' 0 '+large+' 1 '+r1(p2[0])+' '+r1(p2[1])
        +' L'+r1(p3[0])+' '+r1(p3[1])+' A'+r+' '+r+' 0 '+large+' 0 '+r1(p4[0])+' '+r1(p4[1])+' Z" fill="'+(s.color||"var(--accent)")+'"/>';
      a0=a1;
    });
    var mid=opts.center!=null?String(opts.center):String(total);
    var sub=opts.sub!=null?String(opts.sub):"bets";
    var label=opts.aria||("Bets by bookie, "+total);
    return '<svg class="sv-donut" viewBox="0 0 100 100" role="img" aria-label="'+esc(label)+'">'+seg
      +'<text x="50" y="48" text-anchor="middle" fill="var(--txt)" font-size="16" font-weight="700">'+esc(mid)+'</text>'
      +'<text x="50" y="62" text-anchor="middle" fill="var(--muted)" font-size="9">'+esc(sub)+'</text></svg>';
  }
  var api={areaChart:areaChart, barChart:barChart, donut:donut, ticksBetween:ticksBetween};
  root.SvgCharts=api;
  if(typeof module!=="undefined" && module.exports) module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
