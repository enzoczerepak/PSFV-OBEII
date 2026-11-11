/* PSFV-OBE II · Edificio O&M: vista 3D interactiva (three.js, se carga solo al abrirla).
   Fundaciones con la geometría del plano OBEII-CI-PL-371 r2 (zapatas, troncos y vigas), coloreadas por el avance real.
   Lo que todavía no se construyó (columnas, muros, techo a dos aguas y aberturas) se ve como contorno fino;
   cada parte se vuelve sólida cuando su etapa termina. Aberturas exteriores del layout general r5 (bloque "Sala OBEII"). */
const S3 = { th: -0.62, ph: 0.5, dist: 18.5, tgt: [0, 0.4, 0], techo: true, R: null, cam: null, scene: null, raf: 0, pick: [], el: null, tip: null };
const SALA3D_LW = 12.83, SALA3D_LD = 5.93; // layout r5
// aberturas exteriores del layout r5 (m, origen esquina inferior izquierda del layout). lado: s (y=0), n (y=D), o (x=0), e (x=W)
const SALA3D_AB = [
  { lado: 'o', a: 0.26, b: 1.84, t: 'p', n: 'Puerta doble · depósito' },
  { lado: 'o', a: 2.5, b: 4.08, t: 'p', n: 'Puerta doble · sala de celdas' },
  { lado: 'n', a: 5.95, b: 7.54, t: 'p', n: 'Puerta doble · sala de tableros' },
  { lado: 's', a: 4.01, b: 5.59, t: 'p', n: 'Puerta doble · depósito' },
  { lado: 's', a: 8.73, b: 9.52, t: 'p', n: 'Puerta · sala de control' },
  { lado: 'e', a: 4.21, b: 5.8, t: 'p', n: 'Puerta doble · sala de baterías' },
  { lado: 's', a: 6.29, b: 8.03, t: 'v', n: 'Ventanas · sala de control (3)' },
  { lado: 'e', a: 1.11, b: 1.71, t: 'v', n: 'Ventana · baño' },
  { lado: 'e', a: 2.85, b: 3.36, t: 'r', n: 'Rejilla de ventilación' },
];
function sala3dCargarLib() {
  if (window.THREE) return Promise.resolve();
  if (S3.lib) return S3.lib;
  S3.lib = new Promise((ok, mal) => { const s = document.createElement('script'); s.src = 'vendor/three.min.js'; s.onload = ok; s.onerror = () => { S3.lib = null; mal(new Error('no se pudo cargar three.js')); }; document.head.appendChild(s); });
  return S3.lib;
}
function sala3dHTML() {
  return `<div class="s3d" id="s3d"><div class="s3tip" hidden></div>
    <div class="s3ctl"><button class="s3b" data-s3="techo" title="Mostrar u ocultar el techo">Techo</button><button class="s3b" data-s3="planta" title="Vista desde arriba">Arriba</button><button class="s3b" data-s3="reset" title="Volver a la vista inicial">⟲</button></div>
    <div class="s3hint">Arrastrá para girar · rueda o pellizco para acercar${window.READONLY ? '' : ' · tocá una zapata o viga para cargarla'}</div></div>`;
}
async function sala3dMontar(box, I) {
  const el = box.querySelector('#s3d'); if (!el) return;
  try { await sala3dCargarLib(); } catch (e) { el.innerHTML = '<p class="muted" style="padding:20px">No se pudo cargar la vista 3D.</p>'; return; }
  if (!el.isConnected) return;
  const T = window.THREE;
  if (!S3.R) {
    try { S3.R = new T.WebGLRenderer({ antialias: true, alpha: true }); } catch (e) { el.innerHTML = '<p class="muted" style="padding:20px">Este equipo no tiene aceleración 3D (WebGL).</p>'; return; }
    S3.R.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    S3.cam = new T.PerspectiveCamera(36, 1, 0.1, 300);
  }
  S3.el = el; S3.tip = el.querySelector('.s3tip');
  el.insertBefore(S3.R.domElement, el.firstChild);
  sala3dEscena(I || salaInfo());
  sala3dEventos(el);
  if (!S3.ro) { S3.ro = new ResizeObserver(() => sala3dTam()); }
  S3.ro.disconnect(); S3.ro.observe(el);
  sala3dTam();
  el.querySelector('[data-s3="techo"]').classList.toggle('on', S3.techo);
}
function sala3dTam() {
  const el = S3.el; if (!el || !el.isConnected) return;
  const w = el.clientWidth, h = el.clientHeight; if (!w || !h) return;
  S3.R.setSize(w, h); S3.cam.aspect = w / h; S3.cam.updateProjectionMatrix(); sala3dDibujar();
}
function sala3dDibujar() {
  if (S3.raf) return;
  S3.raf = requestAnimationFrame(() => {
    S3.raf = 0; if (!S3.scene || !S3.el || !S3.el.isConnected) return;
    const { th, ph, dist, tgt } = S3, c = S3.cam;
    c.position.set(tgt[0] + dist * Math.cos(ph) * Math.sin(th), tgt[1] + dist * Math.sin(ph), tgt[2] + dist * Math.cos(ph) * Math.cos(th));
    c.up.set(0, 1, 0); if (ph > 1.5) c.up.set(-Math.sin(th), 0, -Math.cos(th));
    c.lookAt(tgt[0], tgt[1], tgt[2]); S3.R.render(S3.scene, c);
  });
}
function sala3dEscena(I) {
  const T = window.THREE;
  if (S3.scene) S3.scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach((m) => m.dispose()); });
  const sc = new T.Scene(); S3.scene = sc; S3.pick = [];
  sc.add(new T.HemisphereLight(0xffffff, 0xb8c2cf, 0.95));
  const sol = new T.DirectionalLight(0xffffff, 0.7); sol.position.set(10, 22, 14); sc.add(sol);
  const W = 12.78, D = 7.8, H = 3.0, kx = W / SALA3D_LW, ky = D / SALA3D_LD;
  const X = (x) => x - W / 2, Z = (y) => D / 2 - y;
  const zN = SALA_ET.filter((e) => e.a === 'zap').length, vN = SALA_ET.filter((e) => e.a === 'viga').length;
  const etp = (k) => I.ets.find((x) => x.e.k === k) || { p: 0 };
  const mat = (c, o) => new T.MeshLambertMaterial(Object.assign({ color: c }, o || {}));
  const fant = new T.LineBasicMaterial({ color: 0x9aa8ba, transparent: true, opacity: 0.55 });
  const box = (w, h, d, x, y, z, m, par) => { const e = new T.Mesh(new T.BoxGeometry(w, h, d), m); e.position.set(x, y, z); (par || sc).add(e); return e; };
  const borde = (geo, x, y, z, m) => { const l = new T.LineSegments(new T.EdgesGeometry(geo), m || fant); l.position.set(x, y, z); sc.add(l); return l; };
  const caja = (w, h, d, x, y, z, est, m) => (est ? box(w, h, d, x, y, z, m) : borde(new T.BoxGeometry(w, h, d), x, y, z));
  const colEl = (n, N, cur) => (n >= N ? 0x2f9e5b : n || cur ? 0xf5a524 : 0xdfe5ec);
  // terreno: contorno fino a nivel 0
  const g0 = new T.BufferGeometry().setFromPoints([[-1, -1], [W + 1, -1], [W + 1, D + 1], [-1, D + 1], [-1, -1]].map(([a, b]) => new T.Vector3(X(a), 0, Z(b))));
  sc.add(new T.Line(g0, new T.LineBasicMaterial({ color: 0xc3ccd8 })));
  // fundaciones (siempre sólidas, color por avance)
  const pos = Object.fromEntries(I.zap.map((z) => [z.id, z]));
  I.zap.forEach((z) => {
    const L = SALA_ZT[z.t], c = colEl(z.n, zN, z.cur), m = mat(c, z.n || z.cur ? {} : { transparent: true, opacity: 0.75 });
    const g = new T.Group(); g.position.set(X(z.x), 0, Z(z.y)); sc.add(g);
    if (z.n >= 3) box(L + 0.1, 0.1, L + 0.1, 0, -1.55, 0, mat(0xb7bec8), g); // hormigón de limpieza
    const b = box(L, 0.45, L, 0, -1.28, 0, m, g); box(0.3, 0.7, 0.3, 0, -0.7, 0, m, g);
    b.userData = { t: 'zap', id: z.id }; g.children.forEach((o) => { o.userData = { t: 'zap', id: z.id }; S3.pick.push(o); });
  });
  I.vig.forEach((v) => {
    const c = colEl(v.n, vN, v.cur), m = mat(c, v.n || v.cur ? {} : { transparent: true, opacity: 0.75 });
    for (let i = 0; i < v.cs.length - 1; i++) {
      const a = pos[v.cs[i]], b = pos[v.cs[i + 1]], hor = Math.abs(b.x - a.x) > 0.01, l = Math.hypot(b.x - a.x, b.y - a.y);
      const e = box(hor ? l : 0.2, 0.4, hor ? 0.2 : l, X((a.x + b.x) / 2), -0.2, Z((a.y + b.y) / 2), m);
      e.userData = { t: 'viga', id: v.id }; S3.pick.push(e);
    }
  });
  // estructura superior: sólida cuando su etapa terminó, si no contorno
  const pCol = etp('hCS').p >= 1, pMur = etp('piso').p >= 1, pTec = etp('techo').p >= 1, pEst = etp('estT').p >= 1, pAb = etp('aber').p >= 1;
  I.zap.forEach((z) => caja(0.2, H, 0.2, X(z.x), H / 2, Z(z.y), pCol, mat(0xc4cad2)));
  if (pCol) [[0, 0, W, 0], [0, D, W, D], [0, 0, 0, D], [W, 0, W, D]].forEach(([x1, y1, x2, y2]) => { const hor = y1 === y2; box(hor ? W + 0.2 : 0.2, 0.25, hor ? 0.2 : D + 0.2, X((x1 + x2) / 2), H - 0.12, Z((y1 + y2) / 2), mat(0xc4cad2)); });
  // muros exteriores (sólidos con la mampostería terminada)
  const t = 0.2, mM = mat(0xf1eee8);
  if (pMur) {
    box(W + t, H, t, 0, H / 2, Z(0), mM); box(W + t, H, t, 0, H / 2, Z(D), mM);
    box(t, H, D, X(0), H / 2, 0, mM); box(t, H, D, X(W), H / 2, 0, mM);
  }
  // techo a dos aguas: cumbrera a lo largo del edificio, faldones hacia el frente y el fondo
  const al = 1.1, vu = 0.35, hT = H, gr = new T.Group(); gr.name = 'techo'; sc.add(gr);
  const k = al / (D / 2), fald = Math.hypot(D / 2 + vu, k * (D / 2 + vu)), ang = Math.atan(k);
  const mT = mat(0x8796aa, { side: T.DoubleSide });
  [1, -1].forEach((s) => {
    const geo = new T.BoxGeometry(W + 2 * vu, 0.06, fald);
    let o;
    if (pTec) { o = new T.Mesh(geo, mT); gr.add(o); } else { o = new T.LineSegments(new T.EdgesGeometry(geo), pEst ? new T.LineBasicMaterial({ color: 0x6b7c93 }) : fant); gr.add(o); }
    o.position.set(0, (hT + al + hT - k * vu) / 2 + 0.03, s * (D / 2 + vu) / 2); o.rotation.x = s * ang;
  });
  // hastiales (triángulos de los extremos)
  const tri = new T.BufferGeometry(); tri.setAttribute('position', new T.Float32BufferAttribute([-D / 2, 0, 0, D / 2, 0, 0, 0, al, 0], 3)); tri.computeVertexNormals();
  [X(0), X(W)].forEach((x) => {
    const o = pMur ? new T.Mesh(tri, mat(0xf1eee8, { side: T.DoubleSide })) : new T.LineSegments(new T.EdgesGeometry(tri), fant);
    o.rotation.y = Math.PI / 2; o.position.set(x, hT, 0); gr.add(o);
  });
  gr.visible = S3.techo;
  // aberturas: siempre visibles (azul = puertas, celeste = ventanas, gris = rejilla)
  const cAb = { p: 0x2f6fb0, v: 0x8fd0f5, r: 0x7b8796 }, hAb = { p: [0, 2.1], v: [1.1, 2.1], r: [2.0, 2.6] };
  SALA3D_AB.forEach((a) => {
    const [y0, y1] = hAb[a.t], h = y1 - y0, ln = a.lado === 'o' || a.lado === 'e', w = (a.b - a.a) * (ln ? ky : kx), c = ((a.a + a.b) / 2) * (ln ? ky : kx);
    const x = a.lado === 'o' ? 0 : a.lado === 'e' ? W : c, y = a.lado === 's' ? 0 : a.lado === 'n' ? D : c;
    const sol2 = pAb || pMur, prof = t + 0.06;
    const geo = new T.BoxGeometry(ln ? prof : w, h, ln ? w : prof);
    const o = new T.Mesh(geo, mat(cAb[a.t], sol2 ? {} : { transparent: true, opacity: 0.45 })); o.position.set(X(x), y0 + h / 2, Z(y)); sc.add(o);
    const lin = new T.LineSegments(new T.EdgesGeometry(geo), new T.LineBasicMaterial({ color: a.t === 'v' ? 0x3b8fc4 : 0x1f4e7e })); lin.position.copy(o.position); sc.add(lin);
    if (a.t === 'p' && w > 1.2) { const m = box(ln ? prof + 0.01 : 0.03, h, ln ? 0.03 : prof + 0.01, X(x), y0 + h / 2, Z(y), mat(0x1f4e7e)); m.userData = {}; }
    o.userData = { t: 'ab', n: a.n }; S3.pick.push(o);
  });
  sala3dDibujar();
}
function sala3dEventos(el) {
  if (el.dataset.ev) return; el.dataset.ev = '1';
  const cv = S3.R.domElement, pts = new Map(); let mov = 0, pinch = 0;
  const ray = new window.THREE.Raycaster(), v2 = new window.THREE.Vector2();
  const hit = (e) => {
    const r = cv.getBoundingClientRect(); v2.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(v2, S3.cam); const h = ray.intersectObjects(S3.pick.filter((o) => o.visible), false)[0];
    return h && h.object.userData.t ? h.object.userData : null;
  };
  const tip = (e, u) => {
    const tp = S3.tip; if (!u) { tp.hidden = true; cv.style.cursor = pts.size ? 'grabbing' : 'grab'; return; }
    let s = '';
    if (u.t === 'ab') s = esc(u.n);
    else { const I = salaInfo(), z = (u.t === 'zap' ? I.zap : I.vig).find((x) => x.id === u.id), N = SALA_ET.filter((x) => x.a === u.t).length;
      s = `<b>${u.id}</b> ${u.t === 'zap' ? `· zapata ${z.t}` : `· viga ${z.cs[0]}–${z.cs[z.cs.length - 1]}`}<br>${z.n}/${N} etapas${z.cur ? `<br>en curso: ${esc(z.cur.n)}` : z.n >= N ? '<br>terminada' : ''}`; }
    const r = el.getBoundingClientRect(); tp.innerHTML = s; tp.hidden = false;
    tp.style.left = Math.min(e.clientX - r.left + 12, r.width - 190) + 'px'; tp.style.top = (e.clientY - r.top + 12) + 'px';
    cv.style.cursor = u.t !== 'ab' && !window.READONLY ? 'pointer' : 'grab';
  };
  cv.addEventListener('pointerdown', (e) => { pts.set(e.pointerId, [e.clientX, e.clientY]); mov = 0; cv.setPointerCapture(e.pointerId); if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); } });
  cv.addEventListener('pointermove', (e) => {
    const p = pts.get(e.pointerId);
    if (!p) { if (e.pointerType === 'mouse') tip(e, hit(e)); return; }
    if (pts.size === 2) {
      pts.set(e.pointerId, [e.clientX, e.clientY]); const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch) S3.dist = Math.max(7, Math.min(60, S3.dist * pinch / d)); pinch = d; mov = 99; sala3dDibujar(); return;
    }
    const dx = e.clientX - p[0], dy = e.clientY - p[1]; mov += Math.abs(dx) + Math.abs(dy);
    S3.th -= dx * 0.008; S3.ph = Math.max(0.02, Math.min(1.56, S3.ph + dy * 0.006));
    pts.set(e.pointerId, [e.clientX, e.clientY]); S3.tip.hidden = true; sala3dDibujar();
  });
  const fin = (e) => {
    const era = pts.has(e.pointerId); pts.delete(e.pointerId); if (pts.size < 2) pinch = 0;
    if (era && mov < 6 && e.type === 'pointerup') {
      const u = hit(e);
      if (u && u.t !== 'ab' && !window.READONLY) salaEditElem(u.t, u.id);
      else if (u) tip(e, u);
    }
  };
  cv.addEventListener('pointerup', fin); cv.addEventListener('pointercancel', fin);
  cv.addEventListener('pointerleave', () => { if (!pts.size) S3.tip.hidden = true; });
  cv.addEventListener('wheel', (e) => { e.preventDefault(); S3.dist = Math.max(7, Math.min(60, S3.dist * (1 + Math.sign(e.deltaY) * 0.09))); sala3dDibujar(); }, { passive: false });
  cv.addEventListener('dblclick', () => { Object.assign(S3, { th: -0.62, ph: 0.5, dist: 18.5 }); sala3dDibujar(); });
  el.querySelectorAll('[data-s3]').forEach((b) => { b.onclick = () => {
    const k = b.dataset.s3;
    if (k === 'techo') { S3.techo = !S3.techo; b.classList.toggle('on', S3.techo); const g = S3.scene.getObjectByName('techo'); if (g) g.visible = S3.techo; }
    if (k === 'planta') { S3.ph = 1.56; S3.th = 0; S3.dist = 17; if (S3.techo) el.querySelector('[data-s3="techo"]').click(); }
    if (k === 'reset') Object.assign(S3, { th: -0.62, ph: 0.5, dist: 18.5 });
    sala3dDibujar();
  }; });
}
