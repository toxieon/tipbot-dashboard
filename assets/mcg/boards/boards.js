// Perimeter LED boards: oval ribbon just inside the boundary, CanvasTexture slides from boards.json.
import * as T from '../../vendor/three/three.module.min.js';
// back faces sample the emissive map with u flipped, so text reads correctly from both sides
export function ledTwoSided(m){m.onBeforeCompile=sh=>{sh.uniforms.ledOff={get value(){return m.emissiveMap?m.emissiveMap.offset.x:0;}};sh.fragmentShader='uniform float ledOff;\n'+sh.fragmentShader.replace('#include <emissivemap_fragment>',
 '#ifdef USE_EMISSIVEMAP\n vec2 eUv=vEmissiveMapUv; if(!gl_FrontFacing) eUv.x=2.0*ledOff-eUv.x;\n totalEmissiveRadiance*=texture2D(emissiveMap,eUv).rgb;\n#endif');};m.customProgramCacheKey=()=>'led2s2';return m;}
const SZ=74/86.5, RX=86.5;
export async function addBoards(scene,{rx=88.5,rz=75.7,cfgUrl='boards/boards.json',night=false}={}){
 const cfg=await (await fetch(cfgUrl+'?'+Date.now())).json(); const H=cfg.height||1.4;
 const imgs=await Promise.all(cfg.slides.map(s=>new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.onerror=()=>r(null);i.src=s.image;})));
 const cv=document.createElement('canvas');cv.width=1024;cv.height=Math.round(1024*H/cfg.tileMeters*1)||120;const x=cv.getContext('2d');
 const tex=new T.CanvasTexture(cv);tex.colorSpace=T.SRGBColorSpace;tex.wrapS=T.RepeatWrapping;tex.generateMipmaps=true;tex.minFilter=T.LinearMipmapLinearFilter;tex.anisotropy=8;
 // ring geometry (boundary boards + stand ribbons share one texture/slide clock)
 const m=new T.MeshStandardMaterial({color:0x000000,emissive:0xffffff,emissiveMap:tex,emissiveIntensity:night?1.6:1.1,roughness:0.6,side:T.DoubleSide});ledTwoSided(m);
 function ring(rx,rz,y0,h,tile,name){const N=240,pos=[],uv=[],idx=[];let len=0,prev=null;
  for(let i=0;i<=N;i++){const a=i/N*Math.PI*2,px=Math.cos(a)*rx,pz=Math.sin(a)*rz;if(prev)len+=Math.hypot(px-prev[0],pz-prev[1]);prev=[px,pz];
   pos.push(px,y0,pz,px,y0+h,pz);uv.push(len/tile,0,len/tile,1);if(i<N){const b=i*2;idx.push(b,b+2,b+1,b+1,b+2,b+3);}}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();
  const mesh=new T.Mesh(g,m);mesh.name=name;scene.add(mesh);return mesh;}
 const mesh=ring(rx,rz,0.2,H,cfg.tileMeters,'LEDBoards');
 // stand-tier ribbons: offset = metres outside the playing-oval edge (RX), y = bottom, height
 (cfg.ribbons||[]).forEach((r,i)=>{const R=RX+r.offset; ring(R,R*SZ,r.y,r.height,r.tileMeters||cfg.tileMeters*(r.height/H),'LEDRibbon'+(i+1));});
 // frame/back
 let si=0,tIn=0;
 function draw(){const s=cfg.slides[si],im=imgs[si];x.fillStyle=s.bg||'#000';x.fillRect(0,0,cv.width,cv.height);
  if(im){const iw=im.naturalWidth||im.width,ih=im.naturalHeight||im.height;let h=cv.height*(s.fill?1:0.8),w=h*iw/ih;if(w>cv.width){w=cv.width;h=w*ih/iw;}x.drawImage(im,(cv.width-w)/2,(cv.height-h)/2,w,h);}
  x.fillStyle='rgba(0,0,0,0.18)';for(let y=0;y<cv.height;y+=3)x.fillRect(0,y,cv.width,1); // LED scanlines
  tex.needsUpdate=true;}
 draw();
 const house=cfg.slides.slice(), houseImgs=imgs.slice();
 // Sponsor banners replace the house slides. An empty list brings the house slides back.
 async function setSlides(list){
  const want=(list||[]).filter(s=>s&&s.image);
  if(!want.length){cfg.slides=house;imgs.length=0;houseImgs.forEach(i=>imgs.push(i));si=0;tIn=0;draw();return;}
  const loaded=await Promise.all(want.map(s=>new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.onerror=()=>r(null);i.src=s.image;})));
  cfg.slides=want.map(s=>({image:s.image,duration:Math.max(2,Number(s.duration)||8),scroll:Number(s.scroll)||0,bg:s.bg||'#000',fill:true}));
  imgs.length=0;loaded.forEach(i=>imgs.push(i));si=0;tIn=0;tex.offset.x=0;draw();}
 return {mesh,setSlides,update(dt){tIn+=dt;const s=cfg.slides[si];tex.offset.x-=(s.scroll||0)*dt;if(tIn>=s.duration){tIn=0;si=(si+1)%cfg.slides.length;draw();}}};}
