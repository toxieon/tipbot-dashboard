// Ground scene: stands, light banks, markings, and goal posts.
import * as T from '../vendor/three/three.module.min.js';
export const RX=86.5, RZ=74;
const mip=t=>{t.colorSpace=T.SRGBColorSpace;t.generateMipmaps=true;t.minFilter=T.LinearMipmapLinearFilter;t.anisotropy=8;return t;};

// ---- stands: crowd specks, seat rows, aisles, section breaks (texture on existing lathe tiers) ----
export function upgradeStands(S,night){
 const W=2048,H=512,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');
 x.fillStyle='#8b9097';x.fillRect(0,0,W,H);                         // concrete risers / lips
 const y0=H*0.34,y1=H*0.66,rows=16,rh=(y1-y0)/rows;
 x.fillStyle='#22324a';x.fillRect(0,y0,W,y1-y0);
 const pal=['#d9d9d9','#1a1a1a','#0b2a5b','#f4f4f4','#c23b3b','#e2c044','#5a7bb8','#7a5236','#e8b598','#3c3c3c'];
 let seed=7;const rnd=()=>((seed=(seed*16807)%2147483647)/2147483647);
 for(let r=0;r<rows;r++){const yy=y0+r*rh; x.fillStyle='#2c3e58';x.fillRect(0,yy+rh*0.72,W,rh*0.28);   // seat row edge
  for(let px=0;px<W;px+=5){if(rnd()<0.78){x.fillStyle=pal[(rnd()*pal.length)|0];x.fillRect(px,yy+rh*0.15,3.5,rh*0.55);}}}
 for(let a=0;a<W;a+=128){x.fillStyle='#9aa0a8';x.fillRect(a,y0,7,y1-y0);}                         // stair aisles
 for(let a=0;a<W;a+=1024){x.fillStyle='#b9bec5';x.fillRect(a,y0-4,22,y1-y0+8);}                    // section breaks (vomitory walls)
 const tex=mip(new T.CanvasTexture(c));tex.wrapS=T.RepeatWrapping;tex.repeat.x=10;
 S.traverse(o=>{if(/^(Lower|Middle|Upper)Tier$/.test(o.name)){o.material=new T.MeshStandardMaterial({map:tex,roughness:0.95,side:T.DoubleSide,color:night?0xb8c0cc:0xffffff});}});}

// ---- light towers: angled light banks with emissive lamp grid ----
export function upgradeTowers(S,night){
 const c=document.createElement('canvas');c.width=512;c.height=320;const x=c.getContext('2d'),e=document.createElement('canvas');e.width=512;e.height=320;const y=e.getContext('2d');
 x.fillStyle='#2a2f36';x.fillRect(0,0,512,320);y.fillStyle='#000';y.fillRect(0,0,512,320);
 for(let r=0;r<5;r++)for(let k=0;k<8;k++){const cx=32+k*64,cy=32+r*64;
  x.fillStyle='#d9dde2';x.beginPath();x.arc(cx,cy,24,0,7);x.fill();x.fillStyle='#f5f2e8';x.beginPath();x.arc(cx,cy,16,0,7);x.fill();
  const g=y.createRadialGradient(cx,cy,2,cx,cy,26);g.addColorStop(0,'#fff');g.addColorStop(0.7,'#fff3d6');g.addColorStop(1,'#000');y.fillStyle=g;y.beginPath();y.arc(cx,cy,26,0,7);y.fill();}
 const map=mip(new T.CanvasTexture(c)),em=mip(new T.CanvasTexture(e));
 const face=new T.MeshStandardMaterial({map,emissive:0xfff2d6,emissiveMap:em,emissiveIntensity:night?4:0.0,roughness:0.5});
 const steel=new T.MeshStandardMaterial({color:0x5d646d,roughness:0.5,metalness:0.4});
 S.traverse(o=>{if(!/^LightTower\d$/.test(o.name))return;
  [...o.children].slice(1).forEach(ch=>o.remove(ch));                            // drop old paddle head
  const yawG=new T.Group();yawG.position.set(0,116,0);yawG.rotation.y=Math.PI;o.add(yawG); // tower +z points outward; flip to face the field
  const bank=new T.Group();bank.rotation.x=0.55;yawG.add(bank);
  const frame=new T.Mesh(new T.BoxGeometry(17,11,1.4),steel);bank.add(frame);
  const f=new T.Mesh(new T.PlaneGeometry(16,10),face);f.position.z=0.72;bank.add(f);
  const visor=new T.Mesh(new T.BoxGeometry(17,0.4,2.4),steel);visor.position.set(0,5.6,1.2);bank.add(visor);
  for(const s of[-1,1]){const arm=new T.Mesh(new T.BoxGeometry(0.5,0.5,4),steel);arm.position.set(s*6,-4,-2.5);bank.add(arm);}});}

// ---- ground markings + goalposts ----
export function addGround(S){
 ['CentrePitch','CentreSquare'].forEach(n=>{const o=S.getObjectByName(n);if(o)o.visible=false;}); // cricket bits off for footy
 const ppm=12,W=Math.round(2*RX*ppm),H=Math.round(2*RZ*ppm),c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');
 const X=m=>W/2+m*ppm,Z=m=>H/2+m*ppm;x.strokeStyle='#fff';x.lineWidth=0.4*ppm;x.lineCap='round';
 const gl=RX-2.5,glz=RZ-2.5;
 x.beginPath();x.ellipse(X(0),Z(0),gl*ppm,glz*ppm,0,0,7);x.stroke();                               // boundary line
 x.strokeRect(X(-25),Z(-25),50*ppm,50*ppm);                                                         // centre square
 x.beginPath();x.arc(X(0),Z(0),5*ppm,0,7);x.stroke();x.beginPath();x.arc(X(0),Z(0),1.5*ppm,0,7);x.stroke();
 x.beginPath();x.moveTo(X(-5),Z(0));x.lineTo(X(5),Z(0));x.stroke();
 x.save();x.beginPath();x.ellipse(X(0),Z(0),gl*ppm,glz*ppm,0,0,7);x.clip();
 for(const s of[-1,1]){x.beginPath();x.arc(X(s*gl),Z(0),50*ppm,0,7);x.stroke();                     // 50 m arcs
  x.strokeRect(X(s>0?gl-9:-gl),Z(-3.2),9*ppm,6.4*ppm);                                             // goal squares
  x.beginPath();x.moveTo(X(s*gl),Z(-9.6));x.lineTo(X(s*gl),Z(9.6));x.stroke();}                    // goal line
 x.restore();
 const tex=mip(new T.CanvasTexture(c));
 const pl=new T.Mesh(new T.PlaneGeometry(2*RX,2*RZ),new T.MeshStandardMaterial({map:tex,transparent:true,roughness:0.9,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));
 pl.rotation.x=-Math.PI/2;pl.position.y=0.27;pl.name='GroundMarkings';pl.receiveShadow=true;S.add(pl);
 const white=new T.MeshStandardMaterial({color:0xf4f4f2,roughness:0.6});
 for(const s of[-1,1])for(const [z,h] of [[-9.6,12],[-3.2,19],[3.2,19],[9.6,12]]){const g=new T.Group();g.name='Post';
  const post=new T.Mesh(new T.CylinderGeometry(0.28,0.32,h,10),white);post.position.y=h/2;g.add(post);
  const pad=new T.Mesh(new T.CylinderGeometry(0.75,0.75,3,12),white);pad.position.y=1.5;g.add(pad);
  g.position.set(s*gl,0,z);g.traverse(m=>{if(m.isMesh)m.castShadow=true;});S.add(g);}}
