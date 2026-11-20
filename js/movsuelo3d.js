/* PSFV-OBE II · Movimiento de suelos: vista 3D del sector (three.js, se carga solo al abrirla).
   Relieve del terreno (superficie del layout o topografía elegida) con exageración vertical, curvas de nivel,
   franjas de corte (rojo) y relleno (azul) de cada tracker según el cálculo, hincas con su altura libre y
   trackers (tubo de torque y mesa de módulos) a su altura de diseño, con el giro que se elija.
   Terreno natural: cómo está hoy, con lo que hay que cortar o rellenar pintado encima.
   Terreno final: las franjas a la cota después del movimiento, con las hincas y los trackers como quedarían. */
const M3 = { th: 0.65, ph: 0.62, dist: 0, tgt: [0, 0, 0], exag: 3, giro: 30, modo: 'nat', ver: { mov: true, iso: true, curvas: true, hinc: true, trk: true, eq: true },
  R: null, cam: null, scene: null, raf: 0, pick: [], el: null, tip: null, key: '', obj: {}, info: null };

function ms3Tab(b, R) {
  const V = M3.ver, on = (k) => (V[k] ? 'on' : '');
  b.innerHTML = `<div class="card m3card">
    <div class="m3bar">
      <div class="seg sm" id="m3Modo"><button data-v="nat">Terreno natural</button><button data-v="fin">Terreno final (después del movimiento)</button></div>
      <div class="seg sm m3cap" id="m3Cap"><button data-k="mov" class="${on('mov')}">Corte / relleno</button><button data-k="iso" class="${on('iso')}" title="Curvas de igual espesor de corte y relleno cada 5 cm, en degradé">Curvas de corte / relleno</button><button data-k="curvas" class="${on('curvas')}">Curvas de nivel</button><button data-k="hinc" class="${on('hinc')}">Hincas</button><button data-k="trk" class="${on('trk')}">Trackers</button><button data-k="eq" class="${on('eq')}">STS e inversores</button></div>
      <label class="m3sl">Exageración vertical <b id="m3Ev">×${M3.exag}</b><input type="range" id="m3E" min="1" max="10" step="1" value="${M3.exag}"></label>
      <label class="m3sl">Giro de los trackers <b id="m3Gv">${M3.giro}°</b><input type="range" id="m3G" min="-60" max="60" step="5" value="${M3.giro}"></label>
    </div>
    <div class="s3d m3d" id="m3d"><div class="s3tip" hidden></div>
      <div class="s3ctl"><button class="s3b" data-m3="planta" title="Vista desde arriba">Arriba</button><button class="s3b" data-m3="norte" title="Mirar hacia el norte">Norte</button><button class="s3b" data-m3="reset" title="Volver a la vista inicial">⟲</button></div>
      <div class="m3ley"><div class="m3esc"><span>corte</span><i></i><span>relleno</span></div><div class="m3esct"><span>−0,40 m</span><span>0</span><span>+0,40 m</span></div></div>
      <div class="m3norte" title="Norte"><svg viewBox="-12 -12 24 24"><path d="M0 -10 L5 6 L0 3 L-5 6Z" fill="#334155"/><text y="11" text-anchor="middle" font-size="7" font-weight="700" fill="#334155">N</text></svg></div>
      <div class="s3hint">Arrastrá para girar · clic derecho o Shift + arrastrar para mover · rueda o pellizco para acercar · pasá el mouse sobre una hinca o un tracker</div></div>
    <p class="hint" id="m3Res"></p></div>`;
  $$('#m3Modo button', b).forEach((x) => { x.classList.toggle('on', x.dataset.v === M3.modo); x.onclick = () => { M3.modo = x.dataset.v; $$('#m3Modo button', b).forEach((y) => y.classList.toggle('on', y === x)); ms3Escena(R); }; });
  $$('#m3Cap button', b).forEach((x) => { x.onclick = () => { const k = x.dataset.k; V[k] = !V[k]; x.classList.toggle('on', V[k]); ms3Vis(); }; });
  let te = 0; $('#m3E', b).oninput = (e) => { M3.exag = Number(e.target.value); $('#m3Ev', b).textContent = '×' + M3.exag; clearTimeout(te); te = setTimeout(() => ms3Escena(R), 150); };
  let tg = 0; $('#m3G', b).oninput = (e) => { M3.giro = Number(e.target.value); $('#m3Gv', b).textContent = M3.giro + '°'; clearTimeout(tg); tg = setTimeout(() => ms3Paneles(), 60); };
  ms3Montar(b, R);
}

async function ms3Montar(b, R) {
  const el = b.querySelector('#m3d'); if (!el) return;
  try { await sala3dCargarLib(); } catch (e) { el.innerHTML = '<p class="muted" style="padding:20px">No se pudo cargar la vista 3D.</p>'; return; }
  if (!el.isConnected) return;
  const T = window.THREE;
  if (!M3.R) {
    try { M3.R = new T.WebGLRenderer({ antialias: true, alpha: true }); } catch (e) { el.innerHTML = '<p class="muted" style="padding:20px">Este equipo no tiene aceleración 3D (WebGL).</p>'; return; }
    M3.R.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    M3.cam = new T.PerspectiveCamera(38, 1, 0.5, 8000);
  }
  M3.el = el; M3.tip = el.querySelector('.s3tip');
  el.insertBefore(M3.R.domElement, el.firstChild);
  const key = R.sec + '|' + R.fuente;
  if (M3.key !== key) { M3.key = key; M3.dist = 0; M3.th = 0.65; M3.ph = 0.62; }
  ms3Escena(R);
  ms3Eventos(el);
  if (!M3.ro) M3.ro = new ResizeObserver(() => ms3Tam());
  M3.ro.disconnect(); M3.ro.observe(el);
  ms3Tam();
  el.querySelectorAll('[data-m3]').forEach((x) => { x.onclick = () => {
    const k = x.dataset.m3; if (k === 'planta') { M3.ph = 1.55; } else if (k === 'norte') { M3.th = 0; M3.ph = 0.5; } else { M3.th = 0.65; M3.ph = 0.62; M3.dist = M3.info.d0; M3.tgt = [0, M3.info.yc, 0]; }
    ms3Dibujar(); }; });
}
function ms3Tam() {
  const el = M3.el; if (!el || !el.isConnected) return;
  const w = el.clientWidth, h = el.clientHeight; if (!w || !h) return;
  M3.R.setSize(w, h); M3.cam.aspect = w / h; M3.cam.updateProjectionMatrix(); ms3Dibujar();
}
function ms3Dibujar() {
  if (M3.raf) return;
  M3.raf = requestAnimationFrame(() => {
    M3.raf = 0; if (!M3.scene || !M3.el || !M3.el.isConnected) return;
    const { th, ph, dist, tgt } = M3, c = M3.cam;
    c.position.set(tgt[0] + dist * Math.cos(ph) * Math.sin(th), tgt[1] + dist * Math.sin(ph), tgt[2] + dist * Math.cos(ph) * Math.cos(th));
    c.up.set(0, 1, 0); if (ph > 1.5) c.up.set(-Math.sin(th), 0, -Math.cos(th));
    c.lookAt(tgt[0], tgt[1], tgt[2]); M3.R.render(M3.scene, c);
    const n = M3.el.querySelector('.m3norte svg'); if (n) n.style.transform = `rotate(${(th * 180 / Math.PI).toFixed(1)}deg)`;
  });
}

// color de corte (rojo) / relleno (azul): satura a 0,40 m
function ms3Col(T, v) {
  const a = Math.min(1, Math.abs(v) / 0.4);
  if (Math.abs(v) < 0.005) return new T.Color('#e9ece4');
  return v < 0 ? new T.Color().setHSL(4 / 360, 0.55 + 0.3 * a, 0.86 - 0.42 * a) : new T.Color().setHSL(212 / 360, 0.5 + 0.35 * a, 0.86 - 0.42 * a);
}

function ms3Escena(R) {
  const T = window.THREE; if (!T || !M3.R) return;
  if (M3.scene) M3.scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach((m) => m.dispose()); });
  const sc = new T.Scene(); M3.scene = sc; M3.pick = []; M3.obj = {}; M3.Rc = R;
  sc.add(new T.HemisphereLight(0xffffff, 0x8d8470, 0.9));
  const sol = new T.DirectionalLight(0xffffff, 0.85); sol.position.set(-120, 200, 90); sc.add(sol);
  const P = R.P, terr = R.terr, k = M3.exag, fin = M3.modo === 'fin';
  // origen: centro del sector; cota base: la menor del terreno bajo los trackers
  const xs = R.L.map((r) => r.xA), ysA = R.L.flatMap((r) => [r.H[0].y, r.H[r.H.length - 1].y]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ysA) + Math.max(...ysA)) / 2;
  const zAll = R.L.flatMap((r) => r.M.map((m) => Math.min(m.z, m.zf))), z0 = Math.min(...zAll), z1 = Math.max(...R.L.flatMap((r) => r.M.map((m) => Math.max(m.z, m.zf))));
  const X = (x) => x - cx, Z = (y) => cy - y, Y = (z) => (z - z0) * k;
  const bb = { x0: Math.min(...xs) - 18, x1: Math.max(...xs) + 18, y0: Math.min(...ysA) - 18, y1: Math.max(...ysA) + 18 };
  // ---- terreno: malla regular sobre la superficie ----
  const sup = terr.sup, area = (bb.x1 - bb.x0) * (bb.y1 - bb.y0), st = Math.max(1, Math.sqrt(area / 45000));
  const nx = Math.ceil((bb.x1 - bb.x0) / st) + 1, ny = Math.ceil((bb.y1 - bb.y0) / st) + 1;
  if (sup) {
    const pos = new Float32Array(nx * ny * 3), col = new Float32Array(nx * ny * 3), ok = new Uint8Array(nx * ny), ca = new T.Color('#b9cf9a'), cb = new T.Color('#d8c49a'), c = new T.Color();
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const x = bb.x0 + i * st, y = bb.y1 - j * st, z = sup(x, y), n = j * nx + i;
      if (z == null) continue; ok[n] = 1; pos[3 * n] = X(x); pos[3 * n + 1] = Y(z); pos[3 * n + 2] = Z(y);
      c.copy(ca).lerp(cb, Math.max(0, Math.min(1, (z - z0) / Math.max(0.5, z1 - z0)))); col[3 * n] = c.r; col[3 * n + 1] = c.g; col[3 * n + 2] = c.b; }
    const idx = [];
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b2 = a + 1, d = a + nx, e = d + 1;
      if (ok[a] && ok[d] && ok[b2]) idx.push(a, d, b2); if (ok[b2] && ok[d] && ok[e]) idx.push(b2, d, e); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('color', new T.BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new T.Mesh(g, new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 })); sc.add(m); M3.obj.terreno = m;
  }
  const lift = 0.04 + 0.015 * k;
  // ---- curvas de nivel (terreno natural) ----
  if (terr.tri && terr.tri.length) {
    const fina = [], mae = [], eq = P.equi || 0.5;
    const zs = terr.tri.flatMap((t) => [t.a[2], t.b[2], t.c[2]]), zmin = Math.min(...zs), zmax = Math.max(...zs);
    for (let z = Math.ceil(zmin / eq) * eq; z <= zmax; z += eq) {
      const out = Math.abs(z / (eq * 5) - Math.round(z / (eq * 5))) < 1e-6 ? mae : fina;
      terr.tri.forEach((t) => { const Pp = [t.a, t.b, t.c], q = [];
        for (let i = 0; i < 3; i++) { const p1 = Pp[i], p2 = Pp[(i + 1) % 3]; if ((p1[2] - z) * (p2[2] - z) < 0) { const f = (z - p1[2]) / (p2[2] - p1[2]); q.push([p1[0] + f * (p2[0] - p1[0]), p1[1] + f * (p2[1] - p1[1])]); } }
        if (q.length === 2 && q.every(([x, y]) => x > bb.x0 && x < bb.x1 && y > bb.y0 && y < bb.y1)) out.push(X(q[0][0]), Y(z) + lift, Z(q[0][1]), X(q[1][0]), Y(z) + lift, Z(q[1][1])); });
    }
    const lin = (arr, color, op) => { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(arr, 3)); return new T.LineSegments(g, new T.LineBasicMaterial({ color, transparent: true, opacity: op })); };
    const grp = new T.Group(); grp.add(lin(fina, 0x7a6a50, 0.3)); grp.add(lin(mae, 0x5a4a32, 0.6)); sc.add(grp); M3.obj.curvas = grp;
  }
  // ---- curvas de corte / relleno (isopacas cada 5 cm) en degradé: rojo = corte, azul = relleno ----
  if (typeof Delaunator !== 'undefined') {
    const Q = []; R.L.forEach((r) => r.M.forEach((m, i) => { if (i % 2 === 0 || i === r.M.length - 1) Q.push([r.xA, m.y, m.mov, fin ? m.zf : m.z]); }));
    if (Q.length > 3) {
      const d = Delaunator.from(Q, (p) => p[0], (p) => p[1]), Tt = d.triangles, pos = [], col = [], c = new T.Color(), paso = 0.05;
      const vmin = Math.min(...Q.map((p) => p[2])), vmax = Math.max(...Q.map((p) => p[2]));
      const niveles = []; for (let v = Math.ceil(vmin / paso) * paso; v <= vmax + 1e-9; v += paso) niveles.push(Math.round(v * 100) / 100);
      for (let i = 0; i < Tt.length; i += 3) {
        const A = Q[Tt[i]], B = Q[Tt[i + 1]], C = Q[Tt[i + 2]];
        if (Math.max(Math.hypot(A[0] - B[0], A[1] - B[1]), Math.hypot(B[0] - C[0], B[1] - C[1]), Math.hypot(C[0] - A[0], C[1] - A[1])) > 9) continue; // no unir por encima de huecos
        const lo = Math.min(A[2], B[2], C[2]), hi = Math.max(A[2], B[2], C[2]); if (hi - lo < 1e-6) continue;
        niveles.forEach((v) => { if (v <= lo || v >= hi) return; const P3 = [A, B, C], q = [];
          for (let e = 0; e < 3; e++) { const p1 = P3[e], p2 = P3[(e + 1) % 3]; if ((p1[2] - v) * (p2[2] - v) < 0) { const f = (v - p1[2]) / (p2[2] - p1[2]); q.push([p1[0] + f * (p2[0] - p1[0]), p1[1] + f * (p2[1] - p1[1]), p1[3] + f * (p2[3] - p1[3])]); } }
          if (q.length !== 2) return;
          if (Math.abs(v) < 1e-9) c.set('#334155'); else { const a = Math.min(1, Math.abs(v) / 0.4); c.setHSL((v < 0 ? 4 : 212) / 360, 0.75 + 0.2 * a, 0.62 - 0.32 * a); }
          q.forEach(([x, y, z]) => { pos.push(X(x), Y(z) + lift * 2.4, Z(y)); col.push(c.r, c.g, c.b); }); });
      }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
      const ls = new T.LineSegments(g, new T.LineBasicMaterial({ vertexColors: true })); sc.add(ls); M3.obj.iso = ls; M3.isoRango = [vmin, vmax];
    }
  }
  // ---- franjas de corte / relleno por tracker ----
  { const pos = [], col = [], triT = [], triS = [], ix = [];
    R.L.forEach((r, ti) => { const xl = X(r.xA - P.franja / 2), xr = X(r.xA + P.franja / 2), base = pos.length / 3;
      r.M.forEach((m) => { const zz = fin ? m.zf : m.z, yy = Y(zz) + lift * 1.6, c = ms3Col(T, m.mov); pos.push(xl, yy, Z(m.y), xr, yy, Z(m.y)); col.push(c.r, c.g, c.b, c.r, c.g, c.b); });
      for (let i = 0; i < r.M.length - 1; i++) { const a = base + 2 * i; triT.push(ti, ti); triS.push(i, i); ix.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } });
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); g.setIndex(ix); g.computeVertexNormals();
    const m = new T.Mesh(g, new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide })); m.userData = { t: 'franja', triT, triS }; sc.add(m); M3.obj.mov = m; M3.pick.push(m); }
  // ---- hincas y trackers ----
  const umb = P.umbral / 1000, top = (h) => Y(h.zf) + (h.cab - h.zf), pilas = [];
  R.L.forEach((r, ti) => r.H.forEach((h) => pilas.push({ r, ti, h })));
  { const geo = new T.CylinderGeometry(0.09, 0.09, 1, 8); geo.translate(0, 0.5, 0);
    const im = new T.InstancedMesh(geo, new T.MeshLambertMaterial({ color: 0xffffff }), pilas.length), mt = new T.Matrix4(), c = new T.Color();
    pilas.forEach(({ h }, i) => { const yb = Y(fin ? h.zf : h.z), yt = top(h), L = Math.max(0.05, yt - yb);
      mt.makeScale(1, L, 1); mt.setPosition(X(h.x), yb, Z(h.y)); im.setMatrixAt(i, mt);
      im.setColorAt(i, c.set(h.motor ? '#1e293b' : Math.abs(h.mov) > umb + 1e-6 ? '#d97706' : '#7b8794')); });
    im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.userData = { t: 'hinca', pilas }; sc.add(im); M3.obj.hinc = im; M3.pick.push(im); }
  // tubo de torque: de la primera a la última cabeza de hinca
  { const geo = new T.CylinderGeometry(0.075, 0.075, 1, 8), im = new T.InstancedMesh(geo, new T.MeshLambertMaterial({ color: 0x9aa5b1 }), R.L.length), mt = new T.Matrix4(), q = new T.Quaternion(), up = new T.Vector3(0, 1, 0);
    M3.tubos = R.L.map((r) => { const a = r.H[0], b = r.H[r.H.length - 1], ext = P.ext;
      const A = new T.Vector3(X(a.x), top(a) + 0.05, Z(a.y)), B = new T.Vector3(X(b.x), top(b) + 0.05, Z(b.y)), d = B.clone().sub(A), L0 = d.length(), u = d.clone().normalize();
      const A2 = A.clone().addScaledVector(u, -ext * L0 / Math.max(1e-6, b.d || L0)), B2 = B.clone().addScaledVector(u, ext * L0 / Math.max(1e-6, b.d || L0));
      return { A: A2, B: B2, u, L: A2.distanceTo(B2), c: A2.clone().add(B2).multiplyScalar(0.5) }; });
    M3.tubos.forEach((tb, i) => { q.setFromUnitVectors(up, tb.u); mt.compose(tb.c, q, new T.Vector3(1, tb.L, 1)); im.setMatrixAt(i, mt); });
    im.instanceMatrix.needsUpdate = true; const grp = new T.Group(); grp.add(im);
    const pm = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), new T.MeshLambertMaterial({ color: 0x23416f }), R.L.length); pm.userData = { t: 'trk' }; grp.add(pm); M3.panel = pm; M3.pick.push(pm);
    sc.add(grp); M3.obj.trk = grp; }
  ms3Paneles(true);
  // ---- STS (estación de transformación tipo contenedor sobre su platea) e inversores de string ----
  { const PL = window.PLANO || {}, [OX, OY] = msOrigen(), grp = new T.Group(), E = 40;
    const zAt = (x, y) => { const z = sup ? sup(x, y) : null; if (z != null) return z; let bz = null, bd = 1e9; R.L.forEach((r) => r.M.forEach((m) => { const d = Math.hypot(r.xA - x, m.y - y); if (d < bd) { bd = d; bz = m.z; } })); return bz; };
    const dentro = (x, y) => x > bb.x0 - E && x < bb.x1 + E && y > bb.y0 - E && y < bb.y1 + E;
    const etiqueta = (txt, x, y, z) => { const cv = document.createElement('canvas'), ctx = cv.getContext('2d'); cv.width = 256; cv.height = 64;
      ctx.fillStyle = 'rgba(20,32,51,.88)'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(4, 8, 248, 48, 12) : ctx.rect(4, 8, 248, 48); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = 'bold 30px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, 128, 33);
      const sp = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(cv), depthTest: false, transparent: true })); sp.scale.set(10, 2.5, 1); sp.position.set(x, z, y); sp.renderOrder = 10; return sp; };
    const mPlat = new T.MeshLambertMaterial({ color: 0xbfc5cc }), mCont = new T.MeshLambertMaterial({ color: 0xe8edf2 }), mTec = new T.MeshLambertMaterial({ color: 0x00939a }), mInv = new T.MeshLambertMaterial({ color: 0xdfe3e8 }), mPos = new T.MeshLambertMaterial({ color: 0x8a96a3 });
    (PL.sts || []).forEach((st) => { const x = OX + st.x, y = OY - st.y; if (!dentro(x, y)) return; const z = zAt(x, y); if (z == null) return;
      const g = new T.Group(), y0 = Y(z), Lc = st.mva >= 6 ? 12.19 : 6.06, Wc = 2.44, Hc = 2.9;
      const pl = new T.Mesh(new T.BoxGeometry(Lc + 1.2, 0.35, Wc + 1.2), mPlat); pl.position.y = 0.175; g.add(pl);
      const c = new T.Mesh(new T.BoxGeometry(Lc, Hc, Wc), mCont); c.position.y = 0.35 + Hc / 2; g.add(c);
      const fr = new T.Mesh(new T.BoxGeometry(Lc + 0.02, 0.25, Wc + 0.02), mTec); fr.position.y = 0.35 + Hc - 0.125; g.add(fr);
      g.position.set(X(x), y0, Z(y)); g.children.forEach((o) => { o.userData = { t: 'sts', st, z }; M3.pick.push(o); }); grp.add(g);
      grp.add(etiqueta(st.id, X(x), Z(y), y0 + Hc + 3)); });
    (PL.inv || []).forEach((iv) => { const x = OX + iv.x, y = OY - iv.y; if (!dentro(x, y)) return; const z = zAt(x, y); if (z == null) return;
      const g = new T.Group(); [-0.45, 0.45].forEach((dx) => { const p = new T.Mesh(new T.BoxGeometry(0.06, 1.6, 0.06), mPos); p.position.set(dx, 0.8, 0); g.add(p); });
      const b = new T.Mesh(new T.BoxGeometry(1.05, 0.75, 0.32), mInv); b.position.y = 1.2; g.add(b);
      const t2 = new T.Mesh(new T.BoxGeometry(1.06, 0.08, 0.33), mTec); t2.position.y = 1.6; g.add(t2);
      g.position.set(X(x), Y(z), Z(y)); g.children.forEach((o) => { o.userData = { t: 'inv', iv, z }; M3.pick.push(o); }); grp.add(g); });
    sc.add(grp); M3.obj.eq = grp; }
  // cámara inicial
  const diag = Math.hypot(bb.x1 - bb.x0, bb.y1 - bb.y0), yc = Y((z0 + z1) / 2);
  M3.info = { d0: diag * 0.7, yc, z0, z1, cx, cy };
  if (!M3.dist) { M3.dist = diag * 0.7; M3.tgt = [0, yc, 0]; }
  ms3Vis();
  const res = document.getElementById('m3Res');
  if (res) res.innerHTML = `Sector ${R.sec} · ${esc(terr.nombre)} · ${fmt(R.L.length)} trackers · ${fmt(pilas.length)} hincas · desnivel ${fmt(z1 - z0, 2)} m (cotas ${fmt(z0, 2)} a ${fmt(z1, 2)} m) · relieve exagerado ×${k}; las hincas y los trackers van a su altura real sobre el terreno.
    ${fin ? 'Terreno final: las franjas están a la cota después del movimiento y cada hinca nace del terreno ya nivelado.' : 'Terreno natural: las franjas muestran sobre el terreno de hoy cuánto cortar (rojo) o rellenar (azul); las hincas nacen del terreno natural.'} Curvas de corte / relleno: igual espesor cada 5 cm, en degradé (rojo más intenso = más corte, azul más intenso = más relleno, gris = sin movimiento), interpoladas entre las franjas de los trackers. Hincas en naranja: más de ${fmt(P.umbral)} mm de movimiento (validar postes); en negro, la del motor.`;
}
// mesa de módulos: ancho del módulo (E-O), largo del tracker, girada alrededor del tubo
function ms3Paneles(sin) {
  const T = window.THREE, pm = M3.panel, R = M3.Rc; if (!T || !pm || !R) return;
  const w = R.P.anchoMod / 1000, mt = new T.Matrix4(), q = new T.Quaternion(), qr = new T.Quaternion(), z = new T.Vector3(0, 0, 1), m = new T.Matrix4();
  M3.tubos.forEach((tb, i) => { const L = Math.max(tb.L, R.L[i].t.h || tb.L);
    q.setFromUnitVectors(z, tb.u); qr.setFromAxisAngle(z, -M3.giro * Math.PI / 180); q.multiply(qr);
    const off = new T.Vector3(0, 0.16, 0).applyQuaternion(q); mt.compose(tb.c.clone().add(off), q, new T.Vector3(w, 0.04, L)); pm.setMatrixAt(i, mt); });
  pm.instanceMatrix.needsUpdate = true; if (!sin) ms3Dibujar();
}
function ms3Vis() {
  const o = M3.obj, V = M3.ver; if (o.mov) o.mov.visible = V.mov; if (o.iso) o.iso.visible = V.iso; if (o.curvas) o.curvas.visible = V.curvas; if (o.hinc) o.hinc.visible = V.hinc; if (o.trk) o.trk.visible = V.trk; if (o.eq) o.eq.visible = V.eq;
  ms3Dibujar();
}
// circuitos BT de un inversor (estado global del cálculo de cables)
const ms3CircInv = (id) => { try { return R.circuitos.filter((c) => c.cat === 'BT' && (c.desde === id || String(c.designacion).includes(id))); } catch (_) { return []; } };
function ms3Eventos(el) {
  if (el.dataset.ev) return; el.dataset.ev = '1';
  const T = window.THREE, cv = M3.R.domElement, pts = new Map(); let mov = 0, pinch = 0, pan = false;
  const ray = new T.Raycaster(), v2 = new T.Vector2();
  const hit = (e) => { const r = cv.getBoundingClientRect(); v2.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(v2, M3.cam); const objs = M3.pick.filter((o) => o.visible && (!o.parent || o.parent.visible)); return ray.intersectObjects(objs, false)[0] || null; };
  const sg = (v) => (v < 0 ? '−' : '+') + fmt(Math.abs(v), 2);
  const tip = (e, h) => {
    const tp = M3.tip; if (!h) { tp.hidden = true; cv.style.cursor = pts.size ? 'grabbing' : 'grab'; return; }
    const R = M3.Rc, u = h.object.userData; let s = '';
    if (u.t === 'sts') s = `<b>${esc(u.st.id)}</b> · estación de transformación ${fmt(u.st.mva, 1)} MVA<br>cota del terreno ${fmt(u.z, 2)} m`;
    else if (u.t === 'inv') { const cs = ms3CircInv(u.iv.id);
      s = `<b>${esc(u.iv.id)}</b> · inversor de string<br>cota del terreno ${fmt(u.z, 2)} m${cs.length ? `<br>circuito BT ${cs.map((c) => esc(c.designacion)).join(', ')} → ${esc(cs[0].hasta)}${cs[0].completo ? ' · tendido' : ''}` : ''}`; }
    else if (u.t === 'hinca') { const { r, h: p } = u.pilas[h.instanceId];
      s = `<b>${esc(r.t.id)}</b> · hinca ${p.n}${p.motor ? ' (motor)' : ''}<br>${Math.abs(p.mov) < 0.005 ? 'sin movimiento' : p.mov < 0 ? `cortar <b>${sg(p.mov)} m</b>` : `rellenar <b>${sg(p.mov)} m</b>`}<br>terreno ${fmt(p.z, 2)} → ${fmt(p.zf, 2)} m · cabeza ${fmt(p.cab, 2)} m<br>altura libre ${fmt((p.cab - p.zf) * 1000, 0)} mm${p.cod ? ' · ' + esc(p.cod) : ''}`; }
    else { const ti = u.t === 'trk' ? h.instanceId : u.triT[h.faceIndex], r = R.L[ti]; if (!r) { tp.hidden = true; return; }
      const mm = u.t === 'franja' ? r.M[u.triS[h.faceIndex]] : null;
      s = `<b>${esc(r.t.id)}</b> · ${esc(r.t.t)}<br>pendiente de diseño ${fmt(r.pend, 1)} % (terreno ${fmt(r.pendT, 1)} %)<br>corte ${fmt(r.corte, 1)} m³ · relleno ${fmt(r.relleno, 1)} m³${mm ? `<br>en este punto: ${Math.abs(mm.mov) < 0.005 ? 'sin movimiento' : (mm.mov < 0 ? 'cortar ' : 'rellenar ') + sg(mm.mov) + ' m'}` : ''}${r.nVal ? `<br><span style="color:#fbbf24">${r.nVal} hinca${r.nVal > 1 ? 's' : ''} &gt; ${R.P.umbral} mm</span>` : ''}`; }
    const rb = el.getBoundingClientRect(); tp.innerHTML = s; tp.hidden = false;
    tp.style.left = Math.min(e.clientX - rb.left + 14, rb.width - 230) + 'px'; tp.style.top = Math.min(e.clientY - rb.top + 14, rb.height - 110) + 'px'; cv.style.cursor = 'crosshair';
  };
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  cv.addEventListener('pointerdown', (e) => { pts.set(e.pointerId, [e.clientX, e.clientY]); mov = 0; pan = e.button === 2 || e.button === 1 || e.shiftKey; cv.setPointerCapture(e.pointerId);
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); } });
  cv.addEventListener('pointermove', (e) => {
    const p = pts.get(e.pointerId);
    if (!p) { if (e.pointerType === 'mouse') tip(e, hit(e)); return; }
    if (pts.size === 2) { pts.set(e.pointerId, [e.clientX, e.clientY]); const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch) M3.dist = Math.max(8, Math.min(M3.info.d0 * 3, M3.dist * pinch / d)); pinch = d; mov = 99; ms3Dibujar(); return; }
    const dx = e.clientX - p[0], dy = e.clientY - p[1]; mov += Math.abs(dx) + Math.abs(dy);
    if (pan) { const kk = M3.dist * 0.0016, th = M3.th; M3.tgt[0] -= Math.cos(th) * dx * kk + Math.sin(th) * dy * kk; M3.tgt[2] -= -Math.sin(th) * dx * kk + Math.cos(th) * dy * kk; }
    else { M3.th -= dx * 0.006; M3.ph = Math.max(0.05, Math.min(1.56, M3.ph + dy * 0.005)); }
    pts.set(e.pointerId, [e.clientX, e.clientY]); M3.tip.hidden = true; ms3Dibujar();
  });
  const fin = (e) => { const era = pts.has(e.pointerId); pts.delete(e.pointerId); if (pts.size < 2) pinch = 0; if (era && mov < 6 && e.type === 'pointerup') tip(e, hit(e)); };
  cv.addEventListener('pointerup', fin); cv.addEventListener('pointercancel', fin);
  cv.addEventListener('pointerleave', () => { if (!pts.size) M3.tip.hidden = true; });
  cv.addEventListener('wheel', (e) => { e.preventDefault(); M3.dist = Math.max(8, Math.min(M3.info.d0 * 3, M3.dist * (e.deltaY > 0 ? 1.12 : 0.89))); ms3Dibujar(); }, { passive: false });
}
