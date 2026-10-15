/* Small WebGL drawer for the MCG. One lit shader, capped device pixel ratio. */
(function (root) {
  "use strict";

  var VERT = [
    "attribute vec3 aPos;",
    "attribute vec3 aNrm;",
    "attribute vec2 aUv;",
    "attribute vec3 aCol;",
    "uniform mat4 uMvp;",
    "uniform mat4 uModel;",
    "varying vec3 vN;",
    "varying vec3 vCol;",
    "varying vec2 vUv;",
    "void main(){",
    "  vec4 w = uModel * vec4(aPos, 1.0);",
    "  vN = mat3(uModel) * aNrm;",
    "  vCol = aCol;",
    "  vUv = aUv;",
    "  gl_Position = uMvp * vec4(aPos, 1.0);",
    "}"
  ].join("\n");

  var FRAG = [
    "precision mediump float;",
    "varying vec3 vN;",
    "varying vec3 vCol;",
    "varying vec2 vUv;",
    "uniform vec3 uSunDir;",
    "uniform vec3 uSunColor;",
    "uniform float uAmb;",
    "uniform sampler2D uMap;",
    "uniform float uHasMap;",
    "uniform float uEmissive;",
    "uniform float uAlpha;",
    "uniform float uScroll;",
    "uniform float uFlip;",
    "uniform float uDisc;",
    "void main(){",
    "  vec2 uv = vUv;",
    "  uv.x += uScroll;",
    "  if (uFlip > 0.5 && !gl_FrontFacing) uv.x = uScroll - vUv.x;",
    "  if (uDisc > 0.5) {",
    "    vec2 d = vUv - vec2(0.5);",
    "    if (dot(d, d) > 0.25) discard;",
    "  }",
    "  vec3 n = normalize(vN);",
    "  if (!gl_FrontFacing) n = -n;",
    "  float ndl = max(dot(n, uSunDir), 0.0);",
    "  vec3 albedo = vCol;",
    "  float a = uAlpha;",
    "  if (uHasMap > 0.5) {",
    "    vec4 tex = texture2D(uMap, uv);",
    "    if (tex.a < 0.04) discard;",
    "    albedo *= tex.rgb;",
    "    a *= tex.a;",
    "  }",
    "  vec3 lit = albedo * (uAmb + ndl * (1.0 - uEmissive));",
    "  lit += albedo * uEmissive * uSunColor;",
    "  gl_FragColor = vec4(lit, a);",
    "}"
  ].join("\n");

  function identity() {
    return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  }

  function multiply(a, b) {
    var o = new Float32Array(16);
    var c, r;
    for (c = 0; c < 4; c++) {
      for (r = 0; r < 4; r++) {
        o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
      }
    }
    return o;
  }

  function perspective(fovy, aspect, near, far) {
    var f = 1 / Math.tan(fovy / 2);
    var nf = 1 / (near - far);
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, 2 * far * near * nf, 0
    ]);
  }

  function normalize(v) {
    var l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  }

  function cross(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }

  function dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  }

  function lookAt(eye, target, up) {
    var z = normalize([eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]]);
    var x = normalize(cross(up, z));
    var y = cross(z, x);
    return new Float32Array([
      x[0], y[0], z[0], 0,
      x[1], y[1], z[1], 0,
      x[2], y[2], z[2], 0,
      -dot(x, eye), -dot(y, eye), -dot(z, eye), 1
    ]);
  }

  function compile(gl, type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  function pot(n) {
    return n > 0 && (n & (n - 1)) === 0;
  }

  function create(canvas, opts) {
    opts = opts || {};
    var gl = canvas.getContext("webgl", {
      antialias: true,
      alpha: false,
      depth: true,
      stencil: false,
      powerPreference: "default"
    });
    if (!gl) return null;
    var vs = compile(gl, gl.VERTEX_SHADER, VERT);
    var fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return null;
    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);

    var loc = {
      mvp: gl.getUniformLocation(prog, "uMvp"),
      model: gl.getUniformLocation(prog, "uModel"),
      sunDir: gl.getUniformLocation(prog, "uSunDir"),
      sunColor: gl.getUniformLocation(prog, "uSunColor"),
      amb: gl.getUniformLocation(prog, "uAmb"),
      map: gl.getUniformLocation(prog, "uMap"),
      hasMap: gl.getUniformLocation(prog, "uHasMap"),
      emissive: gl.getUniformLocation(prog, "uEmissive"),
      alpha: gl.getUniformLocation(prog, "uAlpha"),
      scroll: gl.getUniformLocation(prog, "uScroll"),
      flip: gl.getUniformLocation(prog, "uFlip"),
      disc: gl.getUniformLocation(prog, "uDisc")
    };
    var attr = {
      pos: gl.getAttribLocation(prog, "aPos"),
      nrm: gl.getAttribLocation(prog, "aNrm"),
      uv: gl.getAttribLocation(prog, "aUv"),
      col: gl.getAttribLocation(prog, "aCol")
    };

    var list = [];
    var eye = [0, 80, 170];
    var target = [0, 8, 0];
    var fov = 36 * Math.PI / 180;
    var night = false;
    var maxDpr = opts.maxDpr || 1.5;
    var aspect = 1;
    var idMat = identity();

    function resize() {
      var dpr = Math.min((root.devicePixelRatio || 1), maxDpr);
      var w = canvas.clientWidth || 320;
      var h = canvas.clientHeight || 240;
      var px = Math.max(1, Math.round(w * dpr));
      var py = Math.max(1, Math.round(h * dpr));
      if (canvas.width !== px || canvas.height !== py) {
        canvas.width = px;
        canvas.height = py;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
      aspect = canvas.width / Math.max(1, canvas.height);
      return dpr;
    }

    function upload(source, wrap) {
      var tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      var w = source.width || 0;
      var h = source.height || 0;
      var repeat = wrap === "repeat" && pot(w) && pot(h);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      if (pot(w) && pot(h)) {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.generateMipmap(gl.TEXTURE_2D);
      } else {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      }
      return tex;
    }

    function refresh(tex, source) {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      if (pot(source.width) && pot(source.height)) gl.generateMipmap(gl.TEXTURE_2D);
    }

    function buffer(target, data, usage) {
      var buf = gl.createBuffer();
      gl.bindBuffer(target, buf);
      gl.bufferData(target, data, usage || gl.STATIC_DRAW);
      return buf;
    }

    function mesh(desc) {
      var positions = new Float32Array(desc.positions);
      var normals = new Float32Array(desc.normals);
      var uvs = new Float32Array(desc.uvs);
      var colors = new Float32Array(desc.colors.length ? desc.colors : fillWhite(desc.positions.length));
      var indices = new Uint16Array(desc.indices);
      var handle = {
        visible: desc.alpha === 0 ? false : true,
        transparent: !!desc.transparent,
        alpha: desc.alpha == null ? 1 : desc.alpha,
        emissive: desc.emissive || 0,
        depthWrite: desc.depthWrite !== false,
        disc: desc.disc ? 1 : 0,
        flip: desc.flip ? 1 : 0,
        scroll: 0,
        polygonOffset: desc.polygonOffset || 0,
        nightOnly: !!desc.nightOnly,
        texture: null,
        model: identity(),
        count: indices.length,
        name: desc.name || "",
        slotId: desc.slotId || "",
        posBuf: buffer(gl.ARRAY_BUFFER, positions),
        nrmBuf: buffer(gl.ARRAY_BUFFER, normals),
        uvBuf: buffer(gl.ARRAY_BUFFER, uvs),
        colBuf: buffer(gl.ARRAY_BUFFER, colors),
        idxBuf: buffer(gl.ELEMENT_ARRAY_BUFFER, indices),
        posCount: positions.length
      };
      handle.setPositions = function (flat) {
        var arr = new Float32Array(flat);
        gl.bindBuffer(gl.ARRAY_BUFFER, handle.posBuf);
        if (arr.length === handle.posCount) gl.bufferSubData(gl.ARRAY_BUFFER, 0, arr);
        else {
          gl.bufferData(gl.ARRAY_BUFFER, arr, gl.DYNAMIC_DRAW);
          handle.posCount = arr.length;
        }
      };
      handle.setGeometry = function (next) {
        var ip = new Float32Array(next.positions);
        var inn = new Float32Array(next.normals);
        var iu = new Float32Array(next.uvs);
        var ic = new Float32Array(next.colors);
        var ii = new Uint16Array(next.indices);
        gl.bindBuffer(gl.ARRAY_BUFFER, handle.posBuf);
        gl.bufferData(gl.ARRAY_BUFFER, ip, gl.DYNAMIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, handle.nrmBuf);
        gl.bufferData(gl.ARRAY_BUFFER, inn, gl.DYNAMIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, handle.uvBuf);
        gl.bufferData(gl.ARRAY_BUFFER, iu, gl.DYNAMIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, handle.colBuf);
        gl.bufferData(gl.ARRAY_BUFFER, ic, gl.DYNAMIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, handle.idxBuf);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, ii, gl.DYNAMIC_DRAW);
        handle.count = ii.length;
        handle.posCount = ip.length;
      };
      list.push(handle);
      return handle;
    }

    function fillWhite(n) {
      var a = [];
      var i;
      for (i = 0; i < n; i++) a.push(1);
      return a;
    }

    function bindAttr(index, buf, size) {
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(index);
      gl.vertexAttribPointer(index, size, gl.FLOAT, false, 0, 0);
    }

    function paint(item) {
      if (!item.visible || item.alpha <= 0 || !item.count) return;
      if (item.nightOnly && !night) return;
      var model = item.model || idMat;
      var view = lookAt(eye, target, [0, 1, 0]);
      var proj = perspective(fov, aspect, 0.2, 2500);
      var mvp = multiply(proj, multiply(view, model));
      gl.uniformMatrix4fv(loc.mvp, false, mvp);
      gl.uniformMatrix4fv(loc.model, false, model);
      gl.uniform1f(loc.emissive, item.emissive || 0);
      gl.uniform1f(loc.alpha, item.alpha);
      gl.uniform1f(loc.scroll, item.scroll || 0);
      gl.uniform1f(loc.flip, item.flip || 0);
      gl.uniform1f(loc.disc, item.disc || 0);
      if (item.texture) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, item.texture);
        gl.uniform1i(loc.map, 0);
        gl.uniform1f(loc.hasMap, 1);
      } else {
        gl.uniform1f(loc.hasMap, 0);
      }
      if (item.transparent) {
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(item.depthWrite);
      } else {
        gl.disable(gl.BLEND);
        gl.depthMask(true);
      }
      if (item.polygonOffset) {
        gl.enable(gl.POLYGON_OFFSET_FILL);
        gl.polygonOffset(item.polygonOffset, item.polygonOffset);
      } else {
        gl.disable(gl.POLYGON_OFFSET_FILL);
      }
      bindAttr(attr.pos, item.posBuf, 3);
      bindAttr(attr.nrm, item.nrmBuf, 3);
      bindAttr(attr.uv, item.uvBuf, 2);
      bindAttr(attr.col, item.colBuf, 3);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, item.idxBuf);
      gl.drawElements(gl.TRIANGLES, item.count, gl.UNSIGNED_SHORT, 0);
    }

    function draw() {
      resize();
      var sky = night ? [0.03, 0.045, 0.08] : [0.62, 0.76, 0.88];
      gl.clearColor(sky[0], sky[1], sky[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      var sun = night ? normalize([-0.2, 0.9, 0.15]) : normalize([0.35, 0.86, 0.28]);
      gl.uniform3f(loc.sunDir, sun[0], sun[1], sun[2]);
      gl.uniform3f(loc.sunColor, night ? 1.0 : 1.0, night ? 0.94 : 0.98, night ? 0.82 : 0.95);
      gl.uniform1f(loc.amb, night ? 0.42 : 0.48);
      var i;
      for (i = 0; i < list.length; i++) if (!list[i].transparent) paint(list[i]);
      for (i = 0; i < list.length; i++) if (list[i].transparent) paint(list[i]);
    }

    function dispose() {
      var ext = gl.getExtension("WEBGL_lose_context");
      if (ext) ext.loseContext();
    }

    return {
      mesh: mesh,
      texture: upload,
      refresh: refresh,
      draw: draw,
      resize: resize,
      dispose: dispose,
      setCamera: function (nextEye, nextTarget, fovDeg) {
        eye = nextEye;
        target = nextTarget;
        if (fovDeg) fov = fovDeg * Math.PI / 180;
      },
      setNight: function (on) { night = !!on; },
      dprCap: maxDpr
    };
  }

  var api = {
    create: create,
    lookAt: lookAt,
    perspective: perspective,
    multiply: multiply,
    identity: identity
  };

  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.TBMcgGl = api;
  if (root && root.TD && root.TD.loaded) root.TD.loaded["mcg/gl"] = true;
})(typeof window !== "undefined" ? window : globalThis);
