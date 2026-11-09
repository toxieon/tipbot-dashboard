// Runtime helpers for the procedural racecourse horses (tipdash assets/venues/racecourse.js). MIT.
// Needs: GLTFLoader + MeshoptDecoder (jockey.glb is EXT_meshopt_compression + KHR_mesh_quantization),
// SkeletonUtils.clone for per-horse copies. All in tipdash's vendored three addons.
export const SEAT = {               // jockey placement on racecourse.js horse(): child of userData.body
  position: [0, 0.45, -0.05],       // body-local: top of the 0.9 x 0.9 x 2.2 body box, just behind centre
  scale: 1.3                        // jockey metres -> horse-local units (the horse group is then x1.6)
};
export const STRIDE_S = 2 * Math.PI / 11; // racecourse.js gallop: g = t*11 -> one stride = 0.5712 s
export const FALLBACK_SILK = '#5E6E8C';   // Silks.DEFAULT.c1 (silks.js) when there is no icon and no colour

const texCache = new Map();
/** Load a front-view silk icon (Ladbrokes silk_url_64x64 or a 128 px icon). Needs CORS (or a same-origin proxy). */
export function loadSilkTexture(THREE, url) {
  if (!url) return Promise.resolve(null);
  if (texCache.has(url)) return texCache.get(url);
  const p = new Promise((res) => {
    const l = new THREE.TextureLoader(); l.setCrossOrigin('anonymous');
    l.load(url, (t) => {
      t.flipY = false;                       // glTF UV convention (v = 0 at the top of the icon)
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
      t.anisotropy = 4; res(t);
    }, undefined, () => res(null));          // 404 / CORS -> flat-colour fallback
  });
  texCache.set(url, p); return p;
}
/** Give one jockey copy its runner's silk. tex = icon texture or null; colour = flat fallback (#RRGGBB). */
export function applySilk(THREE, jockey, tex, colour) {
  jockey.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((m, i) => {
      if (m.name !== 'Silk') return;
      const mm = m.userData.perRunner ? m : m.clone();   // clones share materials: make it per runner once
      mm.userData.perRunner = true;
      mm.map = tex || null;
      mm.color.set(tex ? '#ffffff' : (colour || FALLBACK_SILK));
      mm.needsUpdate = true;
      if (Array.isArray(o.material)) o.material[i] = mm; else o.material = mm;
    });
  });
}
/** Seat a jockey clone on a racecourse.js horse group (delete the old placeholder box rider + cap lines in horse() first). */
export function seatJockey(horse, jockey) {
  const body = horse.userData.body;
  jockey.position.fromArray(SEAT.position); jockey.scale.setScalar(SEAT.scale);
  jockey.traverse((o) => { if (o.isSkinnedMesh) { o.frustumCulled = false; o.castShadow = true; } });
  body.add(jockey);   // follows the body bob (body.position.y = 1.6 + |sin g| * 0.12)
  return jockey;
}
/** Lock the ride_gallop clip to the horse's gallop phase g (same g racecourse.js uses for the legs). */
export function syncGallop(action, g) {
  const d = action.getClip().duration;
  action.time = (((g % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / (2 * Math.PI) * d;
}
