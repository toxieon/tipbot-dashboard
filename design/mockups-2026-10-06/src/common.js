const ICON={
 shield:`<svg viewBox="0 0 24 24"><path d="M12 2.2 19.6 5v6.1c0 4.9-3.2 9-7.6 10.7C7.6 20.1 4.4 16 4.4 11.1V5L12 2.2Z" fill="#5B8CFF"/><path d="M8.4 12.1l2.5 2.5 4.9-5.1" fill="none" stroke="#fff" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
 flame:`<svg viewBox="0 0 24 24"><defs><linearGradient id="fl" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#f0663a"/><stop offset=".55" stop-color="#f59e42"/><stop offset="1" stop-color="#ffd27a"/></linearGradient></defs><path d="M12.6 2c.4 2.9-.9 4.6-2.3 6.2C8.7 10 6.5 12 6.5 15.2A5.5 5.5 0 0 0 12 21a5.5 5.5 0 0 0 5.5-5.6c0-2.4-1.1-4.2-2.2-5.6-.3 1.5-1 2.5-2.1 3 .6-3.7-.2-7.1-.6-10.8Z" fill="url(#fl)"/><path d="M12 21a2.9 2.9 0 0 1-2.9-3c0-1.7 1.2-2.7 2.1-3.7.2 1 .8 1.6 1.5 1.9.9.5 2.2 1.2 2.2 2.6A2.9 2.9 0 0 1 12 21Z" fill="#ffe3a3" opacity=".85"/></svg>`,
 chat:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12.5a7.5 7.5 0 0 1-11 6.6L4 20.5l1.4-4.6A7.5 7.5 0 1 1 20 12.5Z"/><path d="M9 12h.01M12.5 12h.01M16 12h.01" stroke-width="2.6"/></svg>`,
 plus:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`,
 share:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>`,
 lock:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>`,
 bell:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9Z"/><path d="M10 20a2.2 2.2 0 0 0 4 0"/></svg>`,
 doc:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>`,
 ext:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>`,
 chev:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>`,
 check:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>`,
};
const fmtU=v=>(v>=0?'+':'−')+Math.abs(v).toFixed(1)+'u';
const fmtU2=v=>(v>=0?'+':'−')+Math.abs(v).toFixed(2)+'u';
const fmtA=(v,dp=2)=>(v>=0?'+':'−')+'A$'+Math.abs(v).toLocaleString('en-AU',{minimumFractionDigits:dp,maximumFractionDigits:dp});
const money=(v)=>'A$'+v.toLocaleString('en-AU',{minimumFractionDigits:2,maximumFractionDigits:2});
const vbadge=(label='Verified by TipBot')=>`<span class="vbadge">${ICON.shield}${label}</span>`;
const streakChip=n=>`<span class="streak">${ICON.flame}${n} win streak</span>`;
const dots=arr=>`<div class="dots">${arr.map(r=>`<span class="dot ${r}">${r}</span>`).join('')}</div>`;
/* line/area chart -> svg string */
function areaChart({w,h,data,padL=40,padR=12,padT=12,padB=26,color='#5B8CFF',yTicks=[],yFmt=v=>v,xLabels=[],id='g',zero=true,endDot=true,grid=true,fontSize=11,smooth=false,yMax=null,yMin=null,strokeW=2.2}){
  const min=yMin??Math.min(0,...data,...yTicks),max=yMax??Math.max(...data,...yTicks);
  const X=i=>padL+(w-padL-padR)*i/(data.length-1), Y=v=>padT+(h-padT-padB)*(1-(v-min)/(max-min));
  const pts=data.map((v,i)=>[X(i),Y(v)]);
  let line;
  if(!smooth) line=pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
  else { line='M'+pts[0][0].toFixed(1)+' '+pts[0][1].toFixed(1);
    for(let i=0;i<pts.length-1;i++){const p0=pts[i-1]||pts[i],p1=pts[i],p2=pts[i+1],p3=pts[i+2]||p2,t=smooth/6;
      const c1=[p1[0]+(p2[0]-p0[0])*t,p1[1]+(p2[1]-p0[1])*t],c2=[p2[0]-(p3[0]-p1[0])*t,p2[1]-(p3[1]-p1[1])*t];
      line+=` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;}}
  const area=line+` L${X(data.length-1).toFixed(1)} ${Y(min)} L${padL} ${Y(min)} Z`;
  let g=`<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block;overflow:visible"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".28"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>`;
  if(grid) yTicks.forEach(t=>{g+=`<line x1="${padL}" x2="${w-padR}" y1="${Y(t)}" y2="${Y(t)}" stroke="${t===0?'#33405e':'#1f2740'}" stroke-width="1" ${t===0?'':'stroke-dasharray="0"'}/><text x="${padL-10}" y="${Y(t)+4}" text-anchor="end" fill="#5c6785" font-size="${fontSize}" font-family="Inter">${yFmt(t)}</text>`});
  xLabels.forEach(([i,l],k)=>{const anchor=k===0?'start':(k===xLabels.length-1?'end':'middle');g+=`<text x="${X(i)}" y="${h-6}" text-anchor="${anchor}" fill="#5c6785" font-size="${fontSize}" font-family="Inter">${l}</text>`});
  g+=`<path d="${area}" fill="url(#${id})"/><path d="${line}" fill="none" stroke="${color}" stroke-width="${strokeW}" stroke-linejoin="round" stroke-linecap="round"/>`;
  if(endDot){const p=pts[pts.length-1];g+=`<circle cx="${p[0]}" cy="${p[1]}" r="7" fill="${color}" opacity=".22"/><circle cx="${p[0]}" cy="${p[1]}" r="3.6" fill="${color}" stroke="#0f1420" stroke-width="1.5"/>`}
  return g+'</svg>';
}
const STATUS=(t='7:42')=>`<div class="status"><span>${t}</span><span class="ic">
<svg width="18" height="12" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1" fill="#f4f6fa"/><rect x="5" y="5.5" width="3" height="6.5" rx="1" fill="#f4f6fa"/><rect x="10" y="3" width="3" height="9" rx="1" fill="#f4f6fa"/><rect x="15" y="0" width="3" height="12" rx="1" fill="#f4f6fa"/></svg>
<svg width="16" height="12" viewBox="0 0 16 12"><path d="M8 11.5 5.6 9a3.4 3.4 0 0 1 4.8 0L8 11.5Z M3.4 6.8a6.5 6.5 0 0 1 9.2 0l-1.4 1.4a4.5 4.5 0 0 0-6.4 0L3.4 6.8Z M1.1 4.5a9.7 9.7 0 0 1 13.8 0l-1.4 1.4a7.7 7.7 0 0 0-11 0L1.1 4.5Z" fill="#f4f6fa"/></svg>
<svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.5" fill="none" stroke="#f4f6fa" opacity=".45"/><rect x="2.5" y="2.5" width="16" height="8" rx="2" fill="#f4f6fa"/><path d="M25 4.5v4c.8-.3 1.3-1.1 1.3-2s-.5-1.7-1.3-2Z" fill="#f4f6fa" opacity=".45"/></svg></span></div>`;
