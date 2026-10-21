/* Zoom, pan and the shape cut-out for one logo, shared by every renderer.
   The frame is the logo's rectangle. Zoom 1 fills that frame. Pan is a
   fraction of the spare travel, from -1 to 1, so it survives a new image
   and any frame size. Square leaves the picture as it is. Circle uses the
   shorter side. Oval is the ellipse inscribed in the frame. */
(function (root, factory) {
  var api = factory();
  var cjs = false;
  try { cjs = typeof module === "object" && module && module.exports; } catch (e) { cjs = false; }
  if (cjs) module.exports = api;
  if (root) root.LogoFrame = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function finite(n, fallback) {
    n = Number(n);
    return isFinite(n) ? n : fallback;
  }
  function read(view) {
    view = view || {};
    var shape = view.shape === "circle" || view.shape === "oval" ? view.shape : "square";
    var panX = view.pan_x != null ? view.pan_x : view.panX;
    var panY = view.pan_y != null ? view.pan_y : view.panY;
    return {
      zoom: clamp(finite(view.zoom, 1), 1, 4),
      panX: clamp(finite(panX, 0), -1, 1),
      panY: clamp(finite(panY, 0), -1, 1),
      shape: shape
    };
  }
  // Top-left origin. The image is zoom times the frame, shifted by pan.
  function placement(fw, fh, view) {
    var v = read(view);
    var dw = fw * v.zoom;
    var dh = fh * v.zoom;
    return {
      x: (fw - dw) / 2 + v.panX * (dw - fw) / 2,
      y: (fh - dh) / 2 + v.panY * (dh - fh) / 2,
      w: dw,
      h: dh,
      zoom: v.zoom,
      panX: v.panX,
      panY: v.panY,
      shape: v.shape
    };
  }
  // Same rectangle with the origin at the centre of the frame.
  function localImage(fw, fh, view) {
    var p = placement(fw, fh, view);
    return {
      x: p.x - fw / 2, y: p.y - fh / 2, w: p.w, h: p.h,
      zoom: p.zoom, panX: p.panX, panY: p.panY, shape: p.shape
    };
  }
  // rx and ry as fractions of the frame. 0.5 fills that side.
  function maskRadii(shape, frameW, frameH) {
    var w = Number(frameW) || 1, h = Number(frameH) || 1;
    if (shape === "circle") {
      var r = Math.min(w, h) / 2;
      return { rx: r / w, ry: r / h };
    }
    if (shape === "oval") return { rx: 0.5, ry: 0.5 };
    return null;
  }
  function clipCss(shape, frameW, frameH) {
    var m = maskRadii(shape, frameW, frameH);
    if (!m) return "none";
    return "ellipse(" + (m.rx * 100) + "% " + (m.ry * 100) + "% at 50% 50%)";
  }
  function covers(shape, frameW, frameH, x, y) {
    var m = maskRadii(shape, frameW, frameH);
    if (!m) return true;
    var nx = (x + 0.5 - frameW / 2) / (m.rx * frameW);
    var ny = (y + 0.5 - frameH / 2) / (m.ry * frameH);
    return nx * nx + ny * ny <= 1;
  }
  function plain(view) {
    var v = read(view);
    return v.shape === "square" && v.zoom === 1 && v.panX === 0 && v.panY === 0;
  }
  function clip(ctx, w, h, shape, frameW, frameH) {
    ctx.beginPath();
    var m = maskRadii(shape, frameW || w, frameH || h);
    if (!m) ctx.rect(0, 0, w, h);
    else ctx.ellipse(w / 2, h / 2, Math.max(0.01, m.rx * w), Math.max(0.01, m.ry * h), 0, 0, Math.PI * 2);
    ctx.clip();
  }
  // frameW/frameH are the logo's real sides when the canvas is a square stand-in
  // for that rectangle (the still photo). Omit them when the canvas matches the frame.
  function paint(ctx, image, fw, fh, view, frameW, frameH) {
    var p = placement(fw, fh, view);
    ctx.clearRect(0, 0, fw, fh);
    ctx.save();
    clip(ctx, fw, fh, p.shape, frameW || fw, frameH || fh);
    ctx.drawImage(image, p.x, p.y, p.w, p.h);
    ctx.restore();
  }
  return {
    read: read,
    placement: placement,
    localImage: localImage,
    maskRadii: maskRadii,
    clipCss: clipCss,
    covers: covers,
    plain: plain,
    clip: clip,
    paint: paint
  };
});
