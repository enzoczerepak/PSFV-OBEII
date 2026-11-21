/* Cálculo de movimiento de suelos (corte y relleno) para el hincado de trackers Trina Vanguard 1P.
   Para cada tracker se busca la recta de diseño (pendiente N-S hasta la máxima) que deja el terreno de todas las hincas dentro de la
   regulación de hincado con el MENOR movimiento de suelo. Criterios Trina (manual de montaje ARI-GR-MN-4301-0A):
   · pendiente máxima 15 % (9°) N-S y E-O (§3.2, §3.3.1)
   · regulación de hincado −200 / +100 mm respecto de la longitud nominal (§3.4.3): altura libre entre nominal −100 y nominal +200 mm
   · tolerancia de altura de la hinca ±30 mm (§3.4.1) · movimientos de tierra > 200 mm requieren pruebas de validación de postes (§3.1)
   · posición de los amortiguadores según la inclinación del tracker (§4.8.3)
   Terreno: superficie del layout (cota de cada hinca) o una topografía / malla de rugosidad cargada desde CSV o Excel. */
const MS_DEF = {
  pendNS: 15,      // pendiente N-S máxima del tracker (%) · Trina 15 % / 9°
  pendEO: 15,      // pendiente E-O máxima del terreno (%) · Trina 15 % / 9° (control)
  regMenos: 100,   // se puede hincar hasta 100 mm MÁS que la nominal (altura libre −100 mm)
  regMas: 200,     // se puede hincar hasta 200 mm MENOS que la nominal (altura libre +200 mm)
  tolAlt: 30,      // tolerancia de altura de la hinca (mm), se reserva de la banda
  usarTol: true,
  franja: 3.0,     // ancho de la franja de movimiento por tracker (m)
  paso: 0.5,       // paso del perfil a lo largo del tracker (m)
  ext: 1.75,       // largo de la franja más allá de la primera y la última hinca (m)
  todoLargo: true, // controlar el terreno en todo el largo del tracker (no solo en las hincas)
  esponj: 15,      // esponjamiento / compactación del relleno (%)
  umbral: 200,     // espesor desde el que Trina pide validar los postes (mm)
  pesoRell: 1.0,   // (anterior) costo relativo del relleno
  prior: 'corte',  // qué se prefiere cuando hay que mover: 'corte' (el relleno pesa 3 veces), 'igual' o 'relleno'
  limUmb: true,    // evitar movimientos de más de 'umbral' mm (así no hay que validar postes): pesa 50 veces más que el volumen
  equi: 0.5,       // equidistancia de las curvas de nivel (m)
  usarDesp: true,  // despeje mínimo módulo-suelo con el tracker girado al máximo (MEC-DW-26050-3401-0A, vista lateral ±60°)
  despMin: 500,    // despeje mínimo exigido (mm)
  despNom: 500,    // despeje con la hinca a su altura libre nominal y terreno plano (mm), según el plano de Trina
  angMax: 60,      // giro máximo del tracker (°)
  anchoMod: 2382,  // ancho del módulo en sentido E-O (mm): el borde queda a ancho/2 · cos(giro) del eje
  fuente: {},      // terreno por sector: 'tin' (layout) o id de una topografía cargada
  rugMax: 300,     // rugosidad máxima admisible por tracker (mm), método de topografía (planilla RugosidadArea)
  modo: 'trina',   // 'trina': solo se mueve donde la hinca no llega a su regulación (franja) · 'completa': nivelación completa del área como Civil 3D
  compensar: true, // nivelación completa: subir o bajar todo el diseño del sector hasta que el corte alcance para el relleno (con esponjamiento)
  areaNiv: 'topo', // nivelación completa: 'topo' = toda el área relevada (contorno de la topografía, como Civil 3D) · 'filas' = solo el ancho entre filas
  dzNiv: 0,        // nivelación completa sin compensar: subir (+) o bajar (−) todo el diseño (cm), p. ej. para igualar una superficie de Civil 3D
  maxLado: 30,     // topografía: lado máximo de los triángulos de la superficie (m); más grande = cubre más área entre puntos lejanos
  anchoNiv: 0,     // nivelación completa: ancho nivelado por fila (m); 0 = la distancia entre filas del sector
  final: {},       // superficie final de diseño a verificar por sector (PVCase / Civil 3D), id de una topografía de tipo 'final'
};
const MSUI = { tab: 'plano', sec: null, sel: null, vb: null, pend: null, ver: { curvas: true, lim: true, vol: true, ptos: false } };
let MSC = null; // caché del cálculo por sector
const msP = () => { const H = (S.hincado = S.hincado || {}); const m = Object.assign({}, MS_DEF, H.mov || {}); m.fuente = Object.assign({}, (H.mov || {}).fuente || {}); m.final = Object.assign({}, (H.mov || {}).final || {}); return m; };
const msGuardarP = (m, msg) => { S.hincado.mov = m; MSC = null; commit(msg); };
const msSets = () => S.topo || [];
const msSetsA = () => msSets().filter((x) => x.tipo !== 'final'); // terreno actual (relevamiento / rugosidad)
const msSetsF = () => msSets().filter((x) => x.tipo === 'final'); // superficies finales de diseño (PVCase / Civil 3D)
const msSecs = () => [...new Set(((window.PLANO || {}).trk || []).map((t) => t.s))].sort();
const msOrigen = () => (window.PLANO || {}).origen || [0, 0];
// terreno elegido para un sector: lo guardado, si no la topografía más nueva que lo cubre, si no el layout
function msFuente(sec, P) {
  const f = P.fuente[sec]; if (f === 'tin') return 'tin';
  if (f && msSetsA().some((x) => x.id === f)) return f;
  const c = msSetsA().filter((x) => (x.sectores || []).includes(sec)).sort((a, b) => String(b.fecha || b.cargado).localeCompare(String(a.fecha || a.cargado)));
  return c.length ? c[0].id : 'tin';
}

// ---------- superficie: triangulación de Delaunay con índice por celdas ----------
function msSuperficie(pts, maxLado = 25) {
  if (pts.length < 3 || typeof Delaunator === 'undefined') return null;
  const d = Delaunator.from(pts, (p) => p[0], (p) => p[1]), T = d.triangles, tri = [], G = new Map(), C = 10;
  for (let i = 0; i < T.length; i += 3) {
    const a = pts[T[i]], b = pts[T[i + 1]], c = pts[T[i + 2]];
    const L = Math.max(Math.hypot(a[0] - b[0], a[1] - b[1]), Math.hypot(b[0] - c[0], b[1] - c[1]), Math.hypot(c[0] - a[0], c[1] - a[1]));
    if (L > maxLado) continue; // fuera del relevamiento (borde de la triangulación)
    const det = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]); if (Math.abs(det) < 1e-9) continue;
    // gradiente del plano del triángulo (dz/dx = E-O, dz/dy = N-S)
    const gx = ((b[1] - c[1]) * (a[2] - c[2]) + (c[1] - a[1]) * (b[2] - c[2])) / det, gy = ((c[0] - b[0]) * (a[2] - c[2]) + (a[0] - c[0]) * (b[2] - c[2])) / det;
    const k = tri.length; tri.push({ a, b, c, det, gx, gy, fino: Math.abs(det) / L < 0.6 }); // fino: altura < 0,6 m (puntos casi alineados, el gradiente no sirve)
    const x0 = Math.floor(Math.min(a[0], b[0], c[0]) / C), x1 = Math.floor(Math.max(a[0], b[0], c[0]) / C), y0 = Math.floor(Math.min(a[1], b[1], c[1]) / C), y1 = Math.floor(Math.max(a[1], b[1], c[1]) / C);
    for (let gx_ = x0; gx_ <= x1; gx_++) for (let gy_ = y0; gy_ <= y1; gy_++) { const kk = gx_ + ',' + gy_; let l = G.get(kk); if (!l) G.set(kk, (l = [])); l.push(k); }
  }
  const buscar = (x, y) => { for (const k of G.get(Math.floor(x / C) + ',' + Math.floor(y / C)) || []) { const t = tri[k], { a, b, c, det } = t;
    const l1 = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / det, l2 = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / det, l3 = 1 - l1 - l2;
    if (l1 >= -1e-9 && l2 >= -1e-9 && l3 >= -1e-9) return { t, z: l1 * a[2] + l2 * b[2] + l3 * c[2] }; } return null; };
  return { tri, z: (x, y) => { const r = buscar(x, y); return r ? r.z : null; }, en: buscar };
}

// ---------- datos de las hincas de un tracker (largo, altura libre nominal y empotramiento según código Trina) ----------
function msPilas(t, RP) {
  const rp = repDe(t.id); if (!rp || !rp.p) return null;
  const cods = posDe(t), conCod = RP.usarCodigos && cods.length === rp.p.length && cods.every(Boolean), mot = t.t === '1P26' ? RP.mot26 : RP.mot52;
  const zs = (window.COTAS_HINCAS && window.COTAS_HINCAS.z[t.id]) || [];
  const H = rp.p.map((p, i) => ({ i, x: p[0], y: p[1], zt: zs[i], cod: conCod ? cods[i] : '' })).sort((a, b) => b.y - a.y);
  const y0 = H[0].y;
  H.forEach((h, k) => { h.d = y0 - h.y; h.n = k + 1; const c = h.cod && hcat(h.cod);
    h.motor = c ? /drive/i.test(c.tipo || '') : k + 1 === Number(mot);
    h.nom = c ? c.sobre / 1000 : h.motor ? RP.drNom : RP.revNom; h.L = c ? c.largo / 1000 : h.motor ? RP.drLargo : RP.largo; h.emin = c ? c.mrl / 1000 : h.motor ? RP.drEmb : RP.embMin; });
  return H;
}

// mínimo en a de una suma de bisagras convexas: corte Σ w·max(0, c−a) (tipo 0) y relleno Σ w·max(0, a−c) (tipo 1).
// Es lineal por tramos: se recorren los quiebres ordenados hasta que la derivada pasa a ≥ 0. Devuelve el intervalo de mínimo [aL, aR] y el costo.
function msOptA(c, w, tp) {
  const n = c.length, ix = Array.from({ length: n }, (_, i) => i).sort((p, q) => c[p] - c[q]);
  let der = 0; for (let i = 0; i < n; i++) if (!tp[i]) der -= w[i];
  let aL = c[ix[0]], aR = aL;
  for (let j = 0; j < n; j++) { const prev = der; der += w[ix[j]];
    if (prev < -1e-12 && der >= -1e-12) { aL = c[ix[j]]; aR = der <= 1e-12 ? (j + 1 < n ? c[ix[j + 1]] : aL) : aL; break; } }
  let k = 0; for (let i = 0; i < n; i++) k += w[i] * (tp[i] ? Math.max(0, aL - c[i]) : Math.max(0, c[i] - aL));
  return { aL, aR, c: k };
}

// ---------- cálculo de un tracker ----------
function msTracker(t, H, P, terr, pend) {
  const reg0 = P.regMenos / 1000, reg1 = P.regMas / 1000, tol = P.usarTol ? P.tolAlt / 1000 : 0, lim = pend / 100;
  // banda del terreno respecto de la línea de diseño G (terreno teórico a altura libre nominal): z ∈ [G + lo, G + hi]
  H.forEach((h) => { h.rmin = h.nom - reg0 + tol; h.rmax = Math.min(h.nom + reg1, h.L - h.emin) - tol; h.lo = h.nom - h.rmax; h.hi = h.nom - h.rmin; });
  const gen = H.filter((h) => !h.motor), loG = gen.length ? Math.max(...gen.map((h) => h.lo)) : -reg1, hiG = gen.length ? Math.min(...gen.map((h) => h.hi)) : reg0;
  // despeje módulo-suelo con el tracker girado al máximo: el borde bajo del módulo queda a 'lat' m al costado del eje y a despNom sobre el
  // terreno de diseño. El terreno del lado alto (eje + lat × pendiente E-O) no puede subir más de despNom − despMin (− tolerancia) sobre el diseño.
  const lat = P.anchoMod / 2000 * Math.cos(P.angMax * Math.PI / 180), mDesp = (P.despNom - P.despMin) / 1000 - tol;
  const xA = H.reduce((a, h) => a + h.x, 0) / H.length, dMax = H[H.length - 1].d;
  // cota del terreno en cada hinca: punto del relevamiento sobre la hinca (≤ 0,5 m) o superficie; si no hay, la del layout
  H.forEach((h) => { const r = terr.pila(h); h.z = r.z; h.fz = r.f; });
  // si la topografía elegida no cubre alguna hinca, se interpola (o extrapola) con las hincas medidas del mismo tracker:
  // mezclar con la cota del layout inventa desniveles cuando las dos superficies no coinciden
  if (terr.fuente !== 'tin') { const med = H.filter((h) => h.fz !== 'layout');
    if (med.length >= 2) H.forEach((h) => { if (h.fz !== 'layout') return; let a = med[0], b = med[1];
      const ant = med.filter((q) => q.d < h.d), sig = med.filter((q) => q.d > h.d);
      if (ant.length && sig.length) { a = ant[ant.length - 1]; b = sig[0]; } else if (sig.length >= 2) { a = sig[0]; b = sig[1]; } else if (ant.length >= 2) { a = ant[ant.length - 2]; b = ant[ant.length - 1]; }
      h.z = a.z + (b.z - a.z) * (h.d - a.d) / (b.d - a.d); h.fz = 'interpolado'; }); }
  const zLin = (d) => { if (d <= 0) return H[0].z; if (d >= dMax) return H[H.length - 1].z; let k = 1; while (H[k].d < d) k++; const a = H[k - 1], b = H[k]; return a.z + (b.z - a.z) * (d - a.d) / (b.d - a.d); };
  // muestras del perfil
  const M = [];
  if (P.todoLargo) {
    const n = Math.max(2, Math.round((dMax + 2 * P.ext) / P.paso));
    for (let i = 0; i <= n; i++) { const d = -P.ext + (dMax + 2 * P.ext) * i / n, y = H[0].y - d;
      let h = null, bd = 1e9; H.forEach((q) => { const e = Math.abs(q.d - d); if (e < bd) { bd = e; h = q; } });
      const pila = bd < P.paso / 2 + 1e-6 ? h : null, fuera = d < 0 || d > dMax, zs = terr.sup && !fuera ? terr.sup(pila ? pila.x : xA, y) : null; // en las puntas (más allá de la primera/última hinca) la superficie puede unir puntos lejanos: se prolonga el perfil de las hincas
      M.push({ d, y, z: pila ? pila.z : zs != null ? zs : zLin(d), lo: pila ? pila.lo : loG, hi: pila ? pila.hi : hiG, w: (dMax + 2 * P.ext) / n * (i === 0 || i === n ? 0.5 : 1), pila });
    }
  } else H.forEach((h, k) => { const a = k ? (h.d - H[k - 1].d) / 2 : P.ext, b = k < H.length - 1 ? (H[k + 1].d - h.d) / 2 : P.ext; M.push({ d: h.d, y: h.y, z: h.z, lo: h.lo, hi: h.hi, w: a + b, pila: h }); });
  // pendiente E-O del terreno: diferencia de cota a 1,5 m a cada lado del eje (sobre la línea de hincas los triángulos son finos y engañan)
  const eoAt = (x, y) => { if (!terr.sup) return null; const zr = terr.sup(x + 1.5, y), zl = terr.sup(x - 1.5, y); return zr != null && zl != null ? Math.abs(zr - zl) / 3 : null; };
  // donde no hay dato a los costados (puntas del tracker, fuera del relevamiento) se usa la pendiente E-O de la muestra más cercana con dato
  const eoM = M.map((m) => eoAt(xA, m.y)), conE = eoM.map((v, i) => (v == null ? -1 : i)).filter((i) => i >= 0);
  M.forEach((m, i) => { let s0 = eoM[i]; if (s0 == null && conE.length) { let j = conE[0]; conE.forEach((k) => { if (Math.abs(k - i) < Math.abs(j - i)) j = k; }); s0 = eoM[j]; } m.sEO = s0 == null ? 0 : s0;
    if (P.usarDesp) { m.hiD = mDesp - lat * m.sEO; if (m.hiD < m.hi) { m.hi = Math.max(m.lo, m.hiD); m.porDesp = true; } } });
  // pendiente del terreno (ajuste por mínimos cuadrados sobre las hincas, en % y positiva hacia el sur que baja)
  const md = H.reduce((a, h) => a + h.d, 0) / H.length, mz = H.reduce((a, h) => a + h.z, 0) / H.length;
  const bT = H.reduce((a, h) => a + (h.d - md) * (h.z - mz), 0) / (H.reduce((a, h) => a + (h.d - md) ** 2, 0) || 1);
  const bC = Math.max(-lim, Math.min(lim, bT));
  // nivelación completa: el terreno queda exactamente sobre la recta de mínimos cuadrados (pendiente limitada); el volumen y la compensación se calculan en msNivelar
  if (P.modo === 'completa') {
    const b = bC, a = mz - b * md;
    M.forEach((m) => { m.zf = a + b * m.d; m.mov = m.zf - m.z; m.desp = P.despNom / 1000 - lat * m.sEO; });
    H.forEach((h) => { const G = a + b * h.d; h.cab = G + h.nom; h.zf = G; h.mov = G - h.z; h.rev0 = h.cab - h.z; h.rev = h.nom; });
    let eo = null; H.forEach((h) => { const s0 = eoAt(h.x, h.y); if (s0 != null) eo = Math.max(eo || 0, s0 * 100); });
    const grad = Math.abs(Math.atan(b) * 180 / Math.PI), amort = grad <= 1.5 ? 51 : grad <= 4.5 ? 83.5 : grad <= 7.5 ? 116 : grad <= 9 ? 148 : null;
    return { t, H, M, a, b, pend: b * 100, pendT: bT * 100, eo, despMin: Math.min(...M.map((m) => m.desp)), nDespC: 0, corte: 0, relleno: 0, cMax: 0, rMax: 0, nMov: 0, nVal: 0, xA, amort, grad, sinDato: H.filter((h) => h.fz === 'layout' || h.fz === 'interpolado').length };
  }
  // costo: volumen de corte + relleno × 3 si se prioriza el corte (o ÷3 si se prioriza el relleno)
  const n = M.length, kf = P.prior === 'corte' ? 3 : P.prior === 'relleno' ? 1 / 3 : 1, umb = P.umbral / 1000;
  const cc = new Float64Array(2 * n), ww = new Float64Array(2 * n), tp = new Uint8Array(2 * n), ip = M.map((m, i) => (m.pila ? i : -1)).filter((i) => i >= 0);
  for (let i = 0; i < n; i++) { ww[2 * i] = M[i].w; ww[2 * i + 1] = kf * M[i].w; tp[2 * i + 1] = 1; }
  const costo = (a) => { let k = 0; for (let i = 0; i < n; i++) k += ww[2 * i] * Math.max(0, cc[2 * i] - a) + ww[2 * i + 1] * Math.max(0, a - cc[2 * i + 1]); return k; };
  const prueba = (b) => { for (let i = 0; i < n; i++) { const r = M[i].z - b * M[i].d; cc[2 * i] = r - M[i].hi; cc[2 * i + 1] = r - M[i].lo; }
    const o = msOptA(cc, ww, tp); if (!P.limUmb) return Object.assign(o, { k: 0 });
    // limitar el espesor: en cada hinca, la altura a de la línea que la deja con ≤ umbral es un intervalo; se busca la que cubre más hincas
    // (menos hincas que validar) y, dentro de esa, la de menor costo
    const ev = []; ip.forEach((i) => { ev.push([cc[2 * i] - umb, 1], [cc[2 * i + 1] + umb, -1]); }); ev.sort((p, q) => p[0] - q[0] || q[1] - p[1]);
    let cur = 0, mx = -1, seg = []; for (let j = 0; j < ev.length; j++) { cur += ev[j][1];
      if (ev[j][1] === 1) { if (cur > mx) { mx = cur; seg = [[ev[j][0], ev[j + 1][0]]]; } else if (cur === mx) seg.push([ev[j][0], ev[j + 1][0]]); } }
    let best = null; seg.forEach(([s0, s1]) => { const a = Math.max(s0, Math.min(s1, o.aL)), k = costo(a); if (!best || k < best.c) best = { aL: a, aR: Math.max(a, Math.min(s1, o.aR)), c: k }; });
    return Object.assign(best, { k: ip.length - mx }); };
  // se compara primero la cantidad de hincas que pasan el umbral (si se limita), después el costo; a igualdad, la pendiente más parecida al terreno
  let best = null; const evalb = (b) => { const r = prueba(b); if (!best || r.k < best.k || (r.k === best.k && (r.c < best.c - 1e-9 || (Math.abs(r.c - best.c) <= 1e-9 && Math.abs(b - bC) < Math.abs(best.b - bC))))) best = Object.assign(r, { b }); };
  const paso1 = 0.0025; for (let b = -lim; b <= lim + 1e-12; b += paso1) evalb(b); evalb(bC);
  const b0 = best.b; for (let b = Math.max(-lim, b0 - paso1); b <= Math.min(lim, b0 + paso1) + 1e-12; b += 0.0002) evalb(b);
  // dentro del intervalo sin costo extra, la línea que deja el terreno lo más cerca posible de la altura libre nominal
  const b = best.b, prom = M.reduce((a, m) => a + (m.z - b * m.d - (m.lo + m.hi) / 2) * m.w, 0) / M.reduce((a, m) => a + m.w, 0);
  const a = Math.max(best.aL, Math.min(best.aR, prom));
  let corte = 0, relleno = 0, cMax = 0, rMax = 0;
  M.forEach((m) => { const G = a + b * m.d; m.zf = Math.min(G + m.hi, Math.max(G + m.lo, m.z)); m.mov = m.zf - m.z;
    if (m.mov < 0) { corte -= m.mov * m.w * P.franja; cMax = Math.max(cMax, -m.mov); } else { relleno += m.mov * m.w * P.franja; rMax = Math.max(rMax, m.mov); } });
  M.forEach((m) => { m.desp = P.despNom / 1000 + (a + b * m.d) - m.zf - lat * m.sEO; }); // despeje a giro máximo, lado alto (m)
  const despMin = Math.min(...M.map((m) => m.desp)), nDespC = M.filter((m) => m.porDesp && m.mov < -1e-4).length;
  // en la hinca vale el movimiento de la franja en ese punto (incluye el despeje del módulo, que puede pedir bajar más que la regulación)
  H.forEach((h) => { const G = a + b * h.d, mp = M.find((m) => m.pila === h); h.cab = G + h.nom; h.zf = mp ? mp.zf : Math.min(G + h.hi, Math.max(G + h.lo, h.z)); h.mov = h.zf - h.z; h.rev0 = h.cab - h.z; h.rev = h.cab - h.zf; });
  const nVal = H.filter((h) => Math.abs(h.mov) > umb + 1e-6).length;
  // pendiente E-O del terreno bajo el tracker (gradiente de la superficie)
  let eo = null; H.forEach((h) => { const s0 = eoAt(h.x, h.y); if (s0 != null) eo = Math.max(eo || 0, s0 * 100); });
  const grad = Math.abs(Math.atan(b) * 180 / Math.PI), amort = grad <= 1.5 ? 51 : grad <= 4.5 ? 83.5 : grad <= 7.5 ? 116 : grad <= 9 ? 148 : null;
  return { t, H, M, a, b, pend: b * 100, pendT: bT * 100, eo, despMin, nDespC, corte, relleno, cMax, rMax, nMov: H.filter((h) => Math.abs(h.mov) > 1e-4).length, nVal, xA, amort, grad, sinDato: H.filter((h) => h.fz === 'layout' || h.fz === 'interpolado').length };
}

// ---------- nivelación completa (criterio Civil 3D) ----------
// Cada fila queda sobre su recta de diseño (mínimos cuadrados del terreno, pendiente N-S limitada) y entre dos filas vecinas el diseño
// es un plano que une sus rectas (pendiente E-O = diferencia entre filas / distancia). Se nivela todo el ancho entre filas, no solo la
// franja del tracker, y el volumen se mide contra el terreno real en 4 bandas por fila. Si se compensa, todo el diseño del sector sube o
// baja lo mismo hasta que el corte alcanza para el relleno compactado (esponjamiento incluido).
function msNivelar(L, P, terr) {
  const xs = L.map((r) => r.xA).sort((a, b) => a - b), gaps = []; for (let i = 1; i < xs.length; i++) { const g = xs[i] - xs[i - 1]; if (g > 2 && g < 15) gaps.push(g); }
  gaps.sort((a, b) => a - b); const W = P.anchoNiv > 0 ? P.anchoNiv : gaps.length ? gaps[Math.floor(gaps.length / 2)] : P.franja;
  const yR = (r) => [r.H[r.H.length - 1].y - P.ext, r.H[0].y + P.ext], Gd = (r, y) => r.a + r.b * (r.H[0].y - y);
  const vec = (r, lado) => { let best = null, bd = 1e9; const [y0, y1] = yR(r); L.forEach((q) => { const dx = (q.xA - r.xA) * lado; if (q === r || dx < 0.5 * W || dx > 1.6 * W) return; const [q0, q1] = yR(q); if (q1 < y0 || q0 > y1) return; if (dx < bd) { bd = dx; best = q; } }); return best; };
  const OF = [-0.375, -0.125, 0.125, 0.375].map((k) => k * W), E = [];
  L.forEach((r) => { const ve = vec(r, 1), vo = vec(r, -1);
    r.M.forEach((m) => { const G = Gd(r, m.y); m.of = OF.map((o) => { const q = o > 0 ? ve : vo; let zd = G;
        if (q) { const [q0, q1] = yR(q); if (m.y >= q0 && m.y <= q1) zd = G + (Math.abs(o) / Math.abs(q.xA - r.xA)) * (Gd(q, m.y) - G); }
        const fuera = m.d < 0 || m.d > r.H[r.H.length - 1].d, zt0 = terr.sup && !fuera ? terr.sup(r.xA + o, m.y) : null, lim = 0.3 * Math.abs(o), zt = zt0 == null ? m.z : m.z + Math.max(-lim, Math.min(lim, zt0 - m.z)), e = zd - zt; E.push([e, m.w * W / 4]); return [o, e]; }); }); });
  // toda el área relevada: grilla de 1 m dentro de la superficie del terreno; el diseño entre y fuera de las filas se interpola de las dos
  // rectas de fila más cercanas (inverso de la distancia al tramo de cada fila, prolongando su pendiente más allá de las puntas)
  let grid = null;
  if (P.areaNiv === 'topo' && terr.sup && terr.tri && terr.tri.length && terr.fuente !== 'tin') {
    E.length = 0; grid = [];
    const seg = L.map((r) => { const [y0, y1] = yR(r); return { r, y0, y1 }; });
    const dis = (s0, x, y) => { const dy = y < s0.y0 ? s0.y0 - y : y > s0.y1 ? y - s0.y1 : 0; return Math.hypot(x - s0.r.xA, dy); };
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; terr.tri.forEach((t) => [t.a, t.b, t.c].forEach((p) => { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }));
    for (let x = Math.floor(x0) + 0.5; x < x1; x += 1) for (let y = Math.floor(y0) + 0.5; y < y1; y += 1) {
      const zt = terr.sup(x, y); if (zt == null) continue;
      let a = null, b = null; for (const s0 of seg) { const d = dis(s0, x, y); if (!a || d < a.d) { b = a; a = { s: s0, d }; } else if (!b || d < b.d) b = { s: s0, d }; }
      const za = Gd(a.s.r, y); let zd = za; if (b && a.d > 1e-6) { const wa = 1 / a.d, wb = 1 / b.d; zd = (za * wa + Gd(b.s.r, y) * wb) / (wa + wb); }
      E.push([zd - zt, 1]); grid.push([x, y, zd - zt]); }
  }
  const fe = 1 + P.esponj / 100, bal = (dz) => { let c = 0, f = 0; for (const [e, w] of E) { const v = e + dz; if (v < 0) c -= v * w; else f += v * w; } return { c, f, k: f * fe - c }; };
  let dz = (Number(P.dzNiv) || 0) / 100; if (P.compensar) { let lo = -3, hi = 3; for (let i = 0; i < 50; i++) { const mid = (lo + hi) / 2; if (bal(mid).k > 0) hi = mid; else lo = mid; } dz = (lo + hi) / 2; }
  const umb = P.umbral / 1000, area = grid ? grid.length : L.reduce((a, r) => a + r.M.reduce((q, m) => q + m.w, 0) * W, 0);
  if (grid) grid.forEach((g) => { g[2] += dz; });
  L.forEach((r) => { r.a += dz; let c = 0, f = 0, cM = 0, rM = 0;
    r.M.forEach((m) => { m.zf = Gd(r, m.y); m.mov = m.zf - m.z; m.of = m.of.map(([o, e]) => [o, e + dz]); m.desp = P.despNom / 1000 - (P.anchoMod / 2000 * Math.cos(P.angMax * Math.PI / 180)) * m.sEO;
      m.of.forEach(([, v]) => { if (v < 0) { c -= v * m.w * W / 4; cM = Math.max(cM, -v); } else { f += v * m.w * W / 4; rM = Math.max(rM, v); } }); });
    r.H.forEach((h) => { const G = Gd(r, h.y); h.cab = G + h.nom; h.zf = G; h.mov = G - h.z; h.rev0 = h.cab - h.z; h.rev = h.nom; });
    Object.assign(r, { corte: c, relleno: f, cMax: cM, rMax: rM, nMov: r.H.filter((h) => Math.abs(h.mov) > 1e-4).length, nVal: r.H.filter((h) => Math.abs(h.mov) > umb + 1e-6).length, despMin: Math.min(...r.M.map((m) => m.desp)) }); });
  // volumen total: con toda el área, el de la grilla (las filas quedan como detalle por tracker)
  let cT = null, fT = null; if (grid) { cT = 0; fT = 0; grid.forEach((g) => { if (g[2] < 0) cT -= g[2]; else fT += g[2]; }); }
  return { W, dz, area, grid, cT, fT, topo: !!grid };
}

// ---------- terreno de un sector ----------
function msTerreno(sec, fuente) {
  const P0 = (window.PLANO || {}).trk || [], T = P0.filter((t) => t.s === sec), [OX, OY] = msOrigen();
  const piles = []; T.forEach((t) => { const rp = repDe(t.id), z = (window.COTAS_HINCAS && window.COTAS_HINCAS.z[t.id]) || []; if (rp && rp.p) rp.p.forEach((p, i) => { if (z[i] != null) piles.push([p[0], p[1], z[i]]); }); });
  if (!piles.length) return null;
  const xs = piles.map((p) => p[0]), ys = piles.map((p) => p[1]), bb = { x0: Math.min(...xs) - 30, x1: Math.max(...xs) + 30, y0: Math.min(...ys) - 30, y1: Math.max(...ys) + 30 };
  let pts, nombre, set = null;
  if (fuente === 'tin') { pts = piles; nombre = 'Superficie del layout (cota de cada hinca)'; }
  else { set = msSets().find((x) => x.id === fuente); pts = set ? set.pts.filter((p) => p[0] > bb.x0 && p[0] < bb.x1 && p[1] > bb.y0 && p[1] < bb.y1) : piles; nombre = set ? set.nombre : 'Superficie del layout'; }
  const sup = msSuperficie(pts, fuente === 'tin' ? 25 : (msP().maxLado || 30)); // lado máximo de triángulo: Civil 3D por defecto no lo limita
  // índice de puntos para "punto sobre la hinca"
  const G = new Map(); pts.forEach((p) => { const k = Math.round(p[0]) + ',' + Math.round(p[1]); let l = G.get(k); if (!l) G.set(k, (l = [])); l.push(p); });
  const cerca = (x, y) => { let b = null, bd = 0.5; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const p of G.get((Math.round(x) + i) + ',' + (Math.round(y) + j)) || []) { const d = Math.hypot(p[0] - x, p[1] - y); if (d < bd) { bd = d; b = p; } } return b; };
  // relevamiento: el punto tomado sobre la hinca (≤ 0,5 m); superficie final de diseño (densa): la superficie en la posición exacta de la hinca
  const pila = (h) => { if (fuente !== 'tin') { const p = set && set.tipo === 'final' ? null : cerca(h.x, h.y); if (p) return { z: p[2], f: 'punto' }; const z = sup && sup.z(h.x, h.y); if (z != null) return { z, f: 'superficie' }; }
    return { z: h.zt, f: fuente === 'tin' ? 'layout' : 'layout' }; };
  return { sec, fuente, nombre, set, pts, sup: sup ? sup.z : null, en: sup ? sup.en : null, tri: sup ? sup.tri : [], pila, OX, OY, bb };
}

// ---------- cálculo de un sector (con caché) ----------
function msCalc(sec, pendOver, modoOver) {
  const P = msP(); if (modoOver) P.modo = modoOver; const RP = ramP(), fuente = msFuente(sec, P), pend = pendOver != null ? pendOver : P.pendNS;
  const set = msSets().find((x) => x.id === fuente), key = [sec, fuente, set ? set.n + '|' + set.cargado : '', pend, JSON.stringify(Object.assign({}, P, { fuente: 0 })), JSON.stringify(RP), JSON.stringify(S.hincado.matriz || {})].join('§');
  MSC = MSC || new Map(); if (MSC.has(key)) return MSC.get(key);
  const terr = msTerreno(sec, fuente); if (!terr) return null;
  const L = []; (window.PLANO.trk || []).filter((t) => t.s === sec).forEach((t) => { const H = msPilas(t, RP); if (H && H.every((h) => h.zt != null || terr.pila(h).z != null)) L.push(msTracker(t, H, P, terr, pend)); });
  let niv = null; if (P.modo === 'completa' && L.length) { niv = msNivelar(L, P, terr); P.franja = niv.W; }
  const corte = niv && niv.topo ? niv.cT : L.reduce((a, r) => a + r.corte, 0), relleno = niv && niv.topo ? niv.fT : L.reduce((a, r) => a + r.relleno, 0), mat = relleno * (1 + P.esponj / 100);
  const R = { sec, fuente, terr, pend, P, L, map: new Map(L.map((r) => [r.t.id, r])), corte, relleno, mat, aporte: Math.max(0, mat - corte), sobra: Math.max(0, corte - mat),
    nTrk: L.filter((r) => r.corte + r.relleno > 0.01).length, nH: L.reduce((a, r) => a + r.H.length, 0), nMov: L.reduce((a, r) => a + r.nMov, 0), nVal: L.reduce((a, r) => a + r.nVal, 0),
    eoFuera: L.filter((r) => r.eo != null && r.eo > P.pendEO).length, nsFuera: L.filter((r) => Math.abs(r.pendT) > pend).length,
    cMax: Math.max(0, ...L.map((r) => r.cMax)), rMax: Math.max(0, ...L.map((r) => r.rMax)), sinDato: L.reduce((a, r) => a + r.sinDato, 0), niv };
  if (MSC.size > 30) MSC.clear(); MSC.set(key, R); return R;
}

// ---------- curvas de nivel ----------
function msCurvas(tri, equi, OX, OY) {
  if (!tri.length) return { fina: '', maestra: '', rot: [] };
  let zmin = Infinity, zmax = -Infinity; tri.forEach((t) => { [t.a, t.b, t.c].forEach((p) => { if (p[2] < zmin) zmin = p[2]; if (p[2] > zmax) zmax = p[2]; }); });
  const f = [], m = [], rot = [], vistos = new Set(), X = (x) => (x - OX).toFixed(2), Y = (y) => (OY - y).toFixed(2);
  for (let z = Math.ceil(zmin / equi) * equi; z <= zmax; z += equi) {
    const mae = Math.abs(z / (equi * 5) - Math.round(z / (equi * 5))) < 1e-6, out = mae ? m : f;
    tri.forEach((t) => { const P = [t.a, t.b, t.c], q = [];
      for (let i = 0; i < 3; i++) { const p1 = P[i], p2 = P[(i + 1) % 3]; if ((p1[2] - z) * (p2[2] - z) < 0) { const k = (z - p1[2]) / (p2[2] - p1[2]); q.push([p1[0] + k * (p2[0] - p1[0]), p1[1] + k * (p2[1] - p1[1])]); } }
      if (q.length === 2) { out.push(`M${X(q[0][0])} ${Y(q[0][1])}L${X(q[1][0])} ${Y(q[1][1])}`);
        if (mae) { const cx = (q[0][0] + q[1][0]) / 2, cy = (q[0][1] + q[1][1]) / 2, k = Math.round(cx / 70) + ',' + Math.round(cy / 70) + ',' + z.toFixed(1);
          if (!vistos.has(k)) { vistos.add(k); rot.push([cx - OX, OY - cy, z, Math.atan2(-(q[1][1] - q[0][1]), q[1][0] - q[0][0]) * 180 / Math.PI]); } } } });
  }
  return { fina: f.join(''), maestra: m.join(''), rot };
}

// color de corte (rojo) / relleno (azul) según el espesor
function msColor(v) {
  if (Math.abs(v) < 0.005) return '#e3e7ec';
  const a = Math.min(1, Math.abs(v) / 1.5), L = 88 - 50 * a;
  return v < 0 ? `hsl(4,${62 + 18 * a}%,${L}%)` : `hsl(212,${55 + 25 * a}%,${L}%)`;
}

// ---------- vista ----------
function vMovSuelo(el) {
  const secs = msSecs(); if (!secs.length) { el.innerHTML = '<div class="card empty">Sin plano de trackers.</div>'; return; }
  if (!MSUI.sec || !secs.includes(MSUI.sec)) MSUI.sec = secs[0];
  const P = msP(), pend = MSUI.pend != null ? MSUI.pend : P.pendNS, R = msCalc(MSUI.sec, pend), ro = window.READONLY;
  actions([['Cargar topografía (CSV / Excel / LandXML)', 'btn pri', msImportar], ['Exportar Excel', 'btn', () => msExcel(MSUI.sec, pend)], ['PDF del plano y detalle punto a punto', 'btn', () => msPdf(MSUI.sec, pend)], ['Replanteo para topografía (CSV)', 'btn', () => msReplanteoCSV(MSUI.sec, pend)], ['Terreno final para Civil 3D / PVCase', 'btn', () => msExportTF(MSUI.sec, pend)]]);
  if (!R) { el.innerHTML = '<div class="card empty">Faltan las cotas de las hincas del sector.</div>'; return; }
  const f3 = (v) => fmt(v, 0) + ' m³', fu = R.terr.set;
  el.innerHTML = `<div class="card mstop">
      <label>Sector<select id="msSec">${secs.map((s) => `<option value="${s}" ${s === MSUI.sec ? 'selected' : ''}>Sector ${s}</option>`).join('')}</select></label>
      <label>Terreno<select id="msFu" ${ro ? 'disabled' : ''}><option value="tin" ${R.fuente === 'tin' ? 'selected' : ''}>Superficie del layout (cota de cada hinca)</option>${msSetsA().map((x) => `<option value="${x.id}" ${R.fuente === x.id ? 'selected' : ''}>${esc(x.nombre)}${x.fecha ? ' · ' + esc(x.fecha) : ''} · ${fmt(x.n)} ptos${(x.sectores || []).includes(MSUI.sec) ? '' : ' (no cubre el sector)'}</option>`).join('')}</select></label>
      <label class="msslider">Pendiente N-S máxima del tracker <b id="msPv">${fmt(pend, 1)} %</b> <small class="muted">(${fmt(Math.atan(pend / 100) * 180 / Math.PI, 1)}°)</small>
        <input type="range" id="msPend" min="0" max="15" step="0.5" value="${pend}"></label>
      <div class="msbtns"><div class="seg sm" id="msModo" title="Criterio del movimiento de suelos"><button data-v="trina" class="${P.modo !== 'completa' ? 'on' : ''}" ${ro ? 'disabled' : ''}>Criterio Trina (franja)</button><button data-v="completa" class="${P.modo === 'completa' ? 'on' : ''}" ${ro ? 'disabled' : ''}>Nivelación completa</button></div></div>
      <div class="msbtns" ${P.modo === 'completa' ? 'style="display:none"' : ''}><label class="rmchk" title="Primero evita superar el espesor de validación de postes"><input type="checkbox" id="msLim" ${P.limUmb ? 'checked' : ''} ${ro ? 'disabled' : ''} style="width:auto"><span>Hasta ${P.umbral} mm</span></label>
        <select id="msPri" ${ro ? 'disabled' : ''}>${[['corte', 'Priorizar corte'], ['igual', 'Menor volumen'], ['relleno', 'Priorizar relleno']].map(([v, t]) => `<option value="${v}" ${P.prior === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div class="msbtns">${MSUI.pend != null && MSUI.pend !== P.pendNS ? `<button class="btn" id="msPg" ${ro ? 'disabled' : ''}>Guardar ${fmt(pend, 1)} % como parámetro</button><button class="btn" id="msPr">Volver a ${fmt(P.pendNS, 1)} %</button>` : `<span class="muted">Trina admite hasta 15 % (9°) N-S y E-O</span>`}</div></div>
    <div class="grid g4 stagger" style="margin:12px 0">
      <div class="card kpi"><div class="kl">Corte</div><div class="kv" style="color:#c0392b">${f3(R.corte)}</div><div class="muted">máx. ${fmt(R.cMax, 2)} m · ${R.niv ? `nivelación completa, ${fmt(R.niv.W, 1)} m entre filas` : `franja ${fmt(P.franja, 1)} m`}</div></div>
      <div class="card kpi"><div class="kl">Relleno</div><div class="kv" style="color:#1f5fa8">${f3(R.relleno)}</div><div class="muted">máx. ${fmt(R.rMax, 2)} m · con ${fmt(P.esponj)} % esponj.: ${f3(R.mat)}</div></div>
      <div class="card kpi"><div class="kl">${R.aporte > 0 ? 'Aporte de material' : 'Sobrante de corte'}</div><div class="kv">${f3(R.aporte > 0 ? R.aporte : R.sobra)}</div><div class="muted">${R.aporte > 0 ? 'el corte no alcanza para rellenar' : 'todo el relleno sale del corte'}</div></div>
      <div class="card kpi"><div class="kl">Hincas con movimiento</div><div class="kv">${fmt(R.nMov)}<small> / ${fmt(R.nH)}</small></div><div class="muted">${fmt(R.nTrk)} de ${fmt(R.L.length)} trackers · <span style="color:${R.nVal ? '#b45309' : 'inherit'};font-weight:600">${fmt(R.nVal)} con más de ${P.umbral} mm (validación Trina)</span></div></div></div>
    ${(() => { const O = msCalc(MSUI.sec, pend, R.niv ? 'trina' : 'completa'); if (!O) return '';
      return `<div class="card hint mscomp">${R.niv ? `<b>Nivelación completa</b> (como Civil 3D): cada fila queda sobre una recta de diseño y entre filas el terreno se nivela en plano; se mueve ${R.niv.topo ? 'toda el área relevada' : 'todo el ancho entre filas'} (${fmt(R.niv.area)} m²), aunque la hinca absorbiera la diferencia con su regulación.${P.compensar ? ` Diseño ${R.niv.dz >= 0 ? 'subido' : 'bajado'} ${fmt(Math.abs(R.niv.dz) * 100, 1)} cm para compensar corte y relleno.` : ' Sin compensar.'}` : '<b>Criterio Trina</b>: solo se mueve la franja del tracker donde la hinca no llega a su altura libre con la regulación.'}
        Con el otro criterio (${R.niv ? 'Trina, franja ' + fmt(O.P.franja, 1) + ' m' : 'nivelación completa'}): corte <b style="color:#c0392b">${f3(O.corte)}</b> · relleno <b style="color:#1f5fa8">${f3(O.relleno)}</b> · ${fmt(O.nMov)} hincas con movimiento.</div>`; })()}
    ${R.eoFuera || R.nsFuera || R.sinDato ? `<div class="card hint mswarn">${R.nsFuera ? `<b>${R.nsFuera}</b> trackers tienen terreno con pendiente N-S mayor que ${fmt(pend, 1)} % (se corrige con el movimiento). ` : ''}${R.eoFuera ? `<b>${R.eoFuera}</b> trackers tienen terreno con pendiente E-O mayor que ${fmt(P.pendEO, 1)} %: Trina pide consultar a su ingeniería (no se corrige con este cálculo). ` : ''}${R.sinDato ? `<b>${R.sinDato}</b> hincas no tienen punto en la topografía elegida: se interpolaron con las hincas medidas del mismo tracker.` : ''}</div>` : ''}
    <div class="seg rmtabs" id="msT"><button data-v="plano">🗺️ Plano</button><button data-v="trk">📋 Trackers</button><button data-v="esc">📈 Escenarios</button><button data-v="rug">📏 Rugosidad</button><button data-v="m3d">🧊 Vista 3D</button><button data-v="ver">✅ Verificación</button><button data-v="topo">📍 Topografías</button><button data-v="par">⚙️ Parámetros</button></div>
    <div id="msB" style="margin-top:12px"></div>`;
  $('#msSec', el).onchange = (e) => { MSUI.sec = e.target.value; MSUI.sel = null; MSUI.vb = null; render(false); };
  $('#msFu', el).onchange = (e) => { const m = msP(); m.fuente[MSUI.sec] = e.target.value; msGuardarP(m, `Movimiento de suelos: terreno del sector ${MSUI.sec} = ${e.target.selectedOptions[0].textContent}`); };
  let tm = null; $('#msPend', el).oninput = (e) => { $('#msPv', el).textContent = fmt(Number(e.target.value), 1) + ' %'; clearTimeout(tm); tm = setTimeout(() => { MSUI.pend = Number(e.target.value); render(false); }, 120); };
  $$('#msModo button', el).forEach((x) => { x.onclick = () => { const m = msP(); if (m.modo === x.dataset.v || (x.dataset.v === 'trina' && m.modo !== 'completa')) return; m.modo = x.dataset.v; msGuardarP(m, `Movimiento de suelos: criterio ${x.dataset.v === 'completa' ? 'nivelación completa (Civil 3D)' : 'Trina (solo franja donde la hinca no llega)'}`); }; });
  $('#msLim', el).onchange = (e) => { const m = msP(); m.limUmb = e.target.checked; msGuardarP(m, `Movimiento de suelos: ${m.limUmb ? 'evitar' : 'permitir'} movimientos de más de ${m.umbral} mm`); };
  $('#msPri', el).onchange = (e) => { const m = msP(); m.prior = e.target.value; msGuardarP(m, `Movimiento de suelos: preferir ${e.target.selectedOptions[0].textContent.toLowerCase()}`); };
  const pg = $('#msPg', el); if (pg) pg.onclick = () => { const m = msP(); m.pendNS = pend; MSUI.pend = null; msGuardarP(m, `Movimiento de suelos: pendiente N-S máxima = ${pend} %`); };
  const pr = $('#msPr', el); if (pr) pr.onclick = () => { MSUI.pend = null; render(false); };
  segBind('#msT', MSUI.tab, (v) => { MSUI.tab = v; render(false); });
  ({ m3d: (b, R) => (typeof ms3Tab === 'function' ? ms3Tab(b, R) : (b.innerHTML = '<div class="card empty">Vista 3D no disponible.</div>')), plano: msPlano, trk: msTabla, esc: msEscen, rug: msRugTab, ver: msVerTab, topo: msTopos, par: msPar })[MSUI.tab]($('#msB', el), R);
}

// plano: curvas de nivel, franjas de corte/relleno y zonas fuera de pendiente
function msPlanoSVG(R, o = {}) {
  const { OX, OY } = R.terr, P = R.P, V = o.ver || MSUI.ver, mm = o.mpm || 0; // mm: metros por mm de papel al imprimir (tamaños fijos en el papel)
  const tT = mm ? 2.1 * mm : 1.3, tV = mm ? 1.6 * mm : 0.95, tZ = mm ? 1.7 * mm : 1.1, sF = mm ? 0.12 * mm : 0.12, sM = mm ? 0.3 * mm : 0.28;
  let g = '';
  if (V.curvas) { const C = msCurvas(R.terr.tri, P.equi, OX, OY);
    g += `<path d="${C.fina}" stroke="#cfc6b6" stroke-width="${sF.toFixed(3)}" fill="none"/><path d="${C.maestra}" stroke="#9c8f78" stroke-width="${sM.toFixed(3)}" fill="none"/>`;
    g += C.rot.map(([x, y, z, a]) => `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" transform="rotate(${(a > 90 || a < -90 ? a + 180 : a).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})" class="mscz" font-size="${tZ.toFixed(2)}" style="stroke-width:${(tZ * 0.3).toFixed(2)}px" text-anchor="middle" dominant-baseline="middle">${fmt(z, 1)}</text>`).join(''); }
  if (V.lim) { const eo = P.pendEO / 100, ns = R.pend / 100;
    g += R.terr.tri.filter((t) => !t.fino && (Math.abs(t.gx) > eo || Math.abs(t.gy) > Math.max(ns, 0.15))).map((t) => `<path d="M${(t.a[0] - OX).toFixed(2)} ${(OY - t.a[1]).toFixed(2)}L${(t.b[0] - OX).toFixed(2)} ${(OY - t.b[1]).toFixed(2)}L${(t.c[0] - OX).toFixed(2)} ${(OY - t.c[1]).toFixed(2)}Z" fill="url(#msHatch)" stroke="none"><title>Terreno E-O ${fmt(Math.abs(t.gx) * 100, 1)} % · N-S ${fmt(Math.abs(t.gy) * 100, 1)} %</title></path>`).join(''); }
  // franjas por tracker: tramos del mismo color (cada 5 cm de espesor)
  R.L.forEach((r) => { const x = r.xA - OX - P.franja / 2, y0 = OY - r.H[0].y, M = r.M; let i = 0;
    while (i < M.length) { const q = Math.round(M[i].mov / 0.05); let j = i; while (j + 1 < M.length && Math.round(M[j + 1].mov / 0.05) === q) j++;
      const ya = y0 + (i ? (M[i - 1].d + M[i].d) / 2 : M[i].d - M[i].w), yb = y0 + (j < M.length - 1 ? (M[j].d + M[j + 1].d) / 2 : M[j].d + M[j].w);
      g += `<rect x="${x.toFixed(2)}" y="${ya.toFixed(2)}" width="${P.franja}" height="${(yb - ya).toFixed(2)}" fill="${msColor(q * 0.05)}"/>`; i = j + 1; }
    const sel = !o.print && MSUI.sel === r.t.id;
    g += `<g data-t="${r.t.id}" class="mstrk${sel ? ' sel' : ''}"><rect x="${x.toFixed(2)}" y="${(y0 - P.ext).toFixed(2)}" width="${P.franja}" height="${(r.H[r.H.length - 1].d + 2 * P.ext).toFixed(2)}" fill="transparent" stroke="${sel ? '#c25e00' : '#7d8794'}" stroke-width="${sel ? 0.45 : 0.12}"/>`;
    g += r.H.map((h) => `<circle cx="${(h.x - OX).toFixed(2)}" cy="${(OY - h.y).toFixed(2)}" r="${Math.abs(h.mov) > P.umbral / 1000 ? 0.55 : 0.32}" fill="${Math.abs(h.mov) > P.umbral / 1000 ? '#b45309' : '#333'}"/>`).join('');
    // punto a punto: cuánto bajar (corte, rojo) o subir (relleno, azul) el terreno en cada hinca, en metros
    if (o.det || !o.print) { const tp = mm ? 1.45 * mm : 0.55, cls = o.print ? '' : ' class="mspl"';
      g += r.H.map((h) => { const v = Math.round(h.mov * 100) / 100, c = v < 0 ? '#b3261e' : v > 0 ? '#1f5fa8' : '#888', t = v ? (v < 0 ? '−' : '+') + fmt(Math.abs(v), 2) : '0';
        return ramTxt(h.x - OX + P.franja / 2 + tp * 0.25, OY - h.y + tp * 0.35, t, tp, `fill="${c}" font-weight="${v ? 700 : 400}"${cls}`); }).join('');
      // entre hincas: el punto de mayor espesor de cada tramo con movimiento (cruz chica y valor en cursiva)
      g += msInter(r).map((q) => { const v = Math.round(q.mov * 100) / 100, c = v < 0 ? '#b3261e' : '#1f5fa8', X = r.xA - OX, Y = OY - q.y;
        return `<path d="M${(X - 0.3).toFixed(2)} ${Y.toFixed(2)}h0.6M${X.toFixed(2)} ${(Y - 0.3).toFixed(2)}v0.6" stroke="${c}" stroke-width="0.12"${cls}/>` + ramTxt(X + P.franja / 2 + tp * 0.25, Y + tp * 0.35, (v < 0 ? '−' : '+') + fmt(Math.abs(v), 2), tp * 0.85, `fill="${c}" font-style="italic"${cls}`); }).join(''); }
    g += ramTxt(r.xA - OX, y0 - P.ext - tT * 0.7, r.t.id.replace('TRK-', ''), tT, 'text-anchor="middle" font-weight="700"');
    if (V.vol && r.corte + r.relleno >= 1) g += ramTxt(r.xA - OX, y0 + r.H[r.H.length - 1].d + P.ext + tV * 1.6, `C ${fmt(r.corte)} · R ${fmt(r.relleno)}`, tV, 'text-anchor="middle" class="msvol"');
    g += '</g>'; });
  if (V.ptos && R.terr.set) g += R.terr.pts.map((p) => `<circle cx="${(p[0] - OX).toFixed(2)}" cy="${(OY - p[1]).toFixed(2)}" r="0.22" fill="#2f855a"/>`).join('');
  const xs = R.L.map((r) => r.xA - OX), ys = R.L.flatMap((r) => [OY - r.H[0].y, OY - r.H[r.H.length - 1].y]), bb = [Math.min(...xs) - 8, Math.min(...ys) - 8, Math.max(...xs) - Math.min(...xs) + 16, Math.max(...ys) - Math.min(...ys) + 16];
  return { g, bb, defs: '<defs><pattern id="msHatch" width="2" height="2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="2" fill="rgba(245,158,11,.10)"/><line x1="0" y1="0" x2="0" y2="2" stroke="rgba(217,119,6,.55)" stroke-width="0.35"/></pattern></defs>' };
}
function msPlano(b, R) {
  const S0 = msPlanoSVG(R), vb = MSUI.vb || S0.bb, sel = MSUI.sel && R.map.get(MSUI.sel);
  b.innerHTML = `<div class="msplano"><div class="card msmap">
      <div class="mstb"><div class="seg sm" id="msV">${[['curvas', 'Curvas de nivel'], ['lim', 'Fuera de pendiente Trina'], ['vol', 'Volúmenes'], ['ptos', 'Puntos de topografía']].map(([k, t]) => `<button data-k="${k}" class="${MSUI.ver[k] ? 'on' : ''}">${t}</button>`).join('')}</div>
        <span class="mszb"><button class="btn sm" data-z="in">＋</button><button class="btn sm" data-z="out">－</button><button class="btn sm" data-z="fit">Todo el sector</button></span></div>
      <svg class="mssvg" viewBox="${vb.map((v) => v.toFixed(2)).join(' ')}" preserveAspectRatio="xMidYMid meet" font-family="Arial">${S0.defs}${S0.g}</svg>
      <div class="msley"><span><i style="background:${msColor(-1.2)}"></i>Corte</span><span><i style="background:${msColor(-0.3)}"></i></span><span><i style="background:#e3e7ec"></i>Sin movimiento</span><span><i style="background:${msColor(0.3)}"></i></span><span><i style="background:${msColor(1.2)}"></i>Relleno</span>
        <span><i class="msdot"></i>Hinca con más de ${R.P.umbral} mm (validación Trina)</span><span><i style="background:url(#)" class="mshat"></i>Terreno con pendiente fuera del límite Trina</span><span class="muted">Curvas cada ${fmt(R.P.equi, 2)} m · ${esc(R.terr.nombre)}</span></div></div>
    <div class="card msdet">${sel ? msDetalle(sel, R) : '<p class="muted">Tocá un tracker en el plano para ver su perfil: terreno actual, terreno final, línea de diseño y banda de regulación de Trina.</p>'}</div></div>`;
  $$('#msV button', b).forEach((x) => { x.onclick = () => { MSUI.ver[x.dataset.k] = !MSUI.ver[x.dataset.k]; render(false); }; });
  msZoom(b, S0.bb);
}
function msZoom(b, bb) {
  const svg = $('.mssvg', b); if (!svg) return;
  const vbA = () => svg.getAttribute('viewBox').split(' ').map(Number), set = (v) => { MSUI.vb = v; svg.setAttribute('viewBox', v.map((x) => x.toFixed(2)).join(' ')); svg.classList.toggle('msdet', v[2] < 160); };
  svg.classList.toggle('msdet', vbA()[2] < 160);
  const pt = (e) => { const r = svg.getBoundingClientRect(), v = vbA(), s = Math.max(v[2] / r.width, v[3] / r.height); return [v[0] + v[2] / 2 + (e.clientX - r.left - r.width / 2) * s, v[1] + v[3] / 2 + (e.clientY - r.top - r.height / 2) * s, s]; };
  const zoom = (f, cx, cy) => { const v = vbA(); if (cx == null) { cx = v[0] + v[2] / 2; cy = v[1] + v[3] / 2; } if (v[2] * f < 15 && f < 1) return; set([cx - (cx - v[0]) * f, cy - (cy - v[1]) * f, v[2] * f, v[3] * f]); };
  svg.addEventListener('wheel', (e) => { e.preventDefault(); const [x, y] = pt(e); zoom(e.deltaY > 0 ? 1.25 : 0.8, x, y); }, { passive: false });
  let drag = null, mov = false;
  svg.addEventListener('mousedown', (e) => { if (e.button) return; drag = { x: e.clientX, y: e.clientY, v: vbA(), s: pt(e)[2] }; mov = false; });
  const mm = (e) => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 4) mov = true; if (mov) set([drag.v[0] - dx * drag.s, drag.v[1] - dy * drag.s, drag.v[2], drag.v[3]]); };
  const mu = () => { drag = null; }; window.addEventListener('mousemove', mm); window.addEventListener('mouseup', mu);
  svg.addEventListener('click', (e) => { if (mov) { mov = false; return; } const t = e.target.closest('[data-t]'); if (t) { MSUI.sel = t.dataset.t; render(false); } });
  $$('[data-z]', b).forEach((x) => { x.onclick = () => { const z = x.dataset.z; if (z === 'in') zoom(0.6); else if (z === 'out') zoom(1.6); else { MSUI.vb = null; set(bb); } }; });
}
// perfil del tracker elegido
function msPerfilSVG(r, P, W = 560, Hh = 230) {
  const M = r.M, H = r.H, d0 = M[0].d, d1 = M[M.length - 1].d, zs = [...M.map((m) => m.z), ...M.map((m) => m.zf), ...H.map((h) => h.cab), ...M.map((m) => r.a + r.b * m.d + m.lo)];
  const z0 = Math.min(...zs) - 0.25, z1 = Math.max(...zs) + 0.25, pl = 46, pr = 10, pt = 12, pb = 26;
  const X = (d) => pl + (d - d0) / (d1 - d0) * (W - pl - pr), Y = (z) => pt + (z1 - z) / (z1 - z0) * (Hh - pt - pb);
  const pts = (f) => M.map((m) => `${X(m.d).toFixed(1)},${Y(f(m)).toFixed(1)}`).join(' ');
  let g = `<polygon points="${pts((m) => r.a + r.b * m.d + m.hi)} ${M.slice().reverse().map((m) => `${X(m.d).toFixed(1)},${Y(r.a + r.b * m.d + m.lo).toFixed(1)}`).join(' ')}" fill="rgba(46,160,67,.12)" stroke="none"/>`;
  // relleno / corte entre terreno actual y final
  for (let i = 0; i + 1 < M.length; i++) { const a = M[i], b = M[i + 1]; if (Math.abs(a.mov) + Math.abs(b.mov) < 1e-4) continue;
    g += `<polygon points="${X(a.d).toFixed(1)},${Y(a.z).toFixed(1)} ${X(b.d).toFixed(1)},${Y(b.z).toFixed(1)} ${X(b.d).toFixed(1)},${Y(b.zf).toFixed(1)} ${X(a.d).toFixed(1)},${Y(a.zf).toFixed(1)}" fill="${(a.mov + b.mov) < 0 ? 'rgba(192,57,43,.45)' : 'rgba(31,95,168,.40)'}"/>`; }
  g += `<polyline points="${pts((m) => r.a + r.b * m.d)}" fill="none" stroke="#2e7d32" stroke-width="1" stroke-dasharray="4 3"/>`;
  g += `<polyline points="${pts((m) => m.z)}" fill="none" stroke="#8a6d3b" stroke-width="1.6"/><polyline points="${pts((m) => m.zf)}" fill="none" stroke="#111" stroke-width="1"/>`;
  H.forEach((h) => { const x = X(h.d); g += `<line x1="${x.toFixed(1)}" y1="${Y(h.zf).toFixed(1)}" x2="${x.toFixed(1)}" y2="${Y(h.cab).toFixed(1)}" stroke="${h.motor ? '#7c3aed' : '#475569'}" stroke-width="${h.motor ? 2.4 : 1.6}"/>`
    + `<text x="${x.toFixed(1)}" y="${(Y(h.cab) - 3).toFixed(1)}" font-size="8" text-anchor="middle" fill="#334155">${h.n}</text>`
    + (Math.abs(h.mov) > 0.005 ? `<text x="${x.toFixed(1)}" y="${(Hh - 13).toFixed(1)}" font-size="7.5" text-anchor="middle" fill="${h.mov < 0 ? '#c0392b' : '#1f5fa8'}">${h.mov > 0 ? '+' : ''}${fmt(h.mov, 2)}</text>` : ''); });
  for (let z = Math.ceil(z0); z <= z1; z += Math.max(1, Math.round((z1 - z0) / 6))) g += `<line x1="${pl}" x2="${W - pr}" y1="${Y(z).toFixed(1)}" y2="${Y(z).toFixed(1)}" stroke="#e5e7eb"/><text x="${pl - 4}" y="${(Y(z) + 3).toFixed(1)}" font-size="8" text-anchor="end" fill="#64748b">${z}</text>`;
  g += `<text x="${pl}" y="${Hh - 2}" font-size="8" fill="#64748b">Norte</text><text x="${W - pr}" y="${Hh - 2}" font-size="8" text-anchor="end" fill="#64748b">Sur · ${fmt(d1 - d0, 1)} m · escala vertical exagerada</text>`;
  return `<svg viewBox="0 0 ${W} ${Hh}" class="msperf" font-family="Arial">${g}</svg>`;
}
function msDetalle(r, R) {
  const P = R.P;
  return `<div class="msdh"><b>${r.t.id}</b> <span class="muted">${r.t.t} · sector ${r.t.s}</span><button class="btn sm" id="msX" style="margin-left:auto">✕</button></div>
    <div class="msdk"><div><small>Pendiente terreno</small><b>${fmt(Math.abs(r.pendT), 1)} %</b></div><div><small>Pendiente tracker</small><b>${fmt(Math.abs(r.pend), 1)} %</b><small>${fmt(r.grad, 1)}°</small></div>
      <div><small>Corte</small><b style="color:#c0392b">${fmt(r.corte, 1)} m³</b></div><div><small>Relleno</small><b style="color:#1f5fa8">${fmt(r.relleno, 1)} m³</b></div>
      <div><small>Amortiguadores</small><b>${r.amort ? 'L ' + fmt(r.amort, 1) + ' mm' : 'fuera de 9°'}</b><small>${r.grad > 1.5 ? 'mismo lado, hacia abajo' : 'lados alternados'}</small></div>
      <div><small>E-O terreno</small><b style="color:${r.eo > P.pendEO ? '#b45309' : 'inherit'}">${r.eo == null ? '—' : fmt(r.eo, 1) + ' %'}</b></div>
      <div><small>Despeje mín. a ${P.angMax}°</small><b style="color:${r.despMin < P.despMin / 1000 - 0.005 ? '#c0392b' : 'inherit'}">${fmt(r.despMin * 1000)} mm</b><small>terreno final, lado alto</small></div></div>
    ${msPerfilSVG(r, P)}
    <div class="msley sm"><span><i style="background:#8a6d3b;height:2px"></i>Terreno actual</span><span><i style="background:#111;height:2px"></i>Terreno final</span><span><i style="border-top:1px dashed #2e7d32;background:none"></i>Diseño (altura libre nominal)</span><span><i style="background:rgba(46,160,67,.25)"></i>Banda de regulación</span></div>
    <div class="tblwrap" style="max-height:260px"><table class="tbl sm"><thead><tr><th>Hinca</th><th class="n">Terreno actual</th><th class="n">Cota cabeza</th><th class="n">Alt. libre sin mover</th><th class="n">Movimiento</th><th class="n">Alt. libre final</th><th>Dato</th></tr></thead><tbody>
    ${r.H.map((h) => `<tr><td>${h.n}${h.motor ? ' <b title="motor">M</b>' : ''}</td><td class="n">${fmt(h.z, 3)}</td><td class="n">${fmt(h.cab, 3)}</td><td class="n" style="color:${h.rev0 < h.rmin || h.rev0 > h.rmax ? '#c0392b' : 'inherit'}">${fmt(h.rev0, 3)}</td>
      <td class="n" style="color:${h.mov < -0.004 ? '#c0392b' : h.mov > 0.004 ? '#1f5fa8' : 'inherit'};font-weight:${Math.abs(h.mov) > P.umbral / 1000 ? 700 : 400}">${Math.abs(h.mov) < 0.0005 ? '—' : (h.mov > 0 ? '+' : '') + fmt(h.mov, 3)}</td><td class="n">${fmt(h.rev, 3)}</td><td class="muted">${h.fz}</td></tr>`).join('')}</tbody></table></div>
    <p class="hint">Altura libre admitida: nominal −${P.regMenos} / +${P.regMas} mm${P.usarTol ? `, reservando ±${P.tolAlt} mm de tolerancia de hincado` : ''}${P.usarDesp ? `. Despeje módulo-suelo a ${P.angMax}° de al menos ${P.despMin} mm: el terreno bajo el borde del módulo no puede quedar más alto que la línea de diseño${P.despNom > P.despMin ? ` + ${P.despNom - P.despMin} mm` : ''}` : ''}. Movimiento: + relleno · − corte (m).</p>`;
}
// tabla por tracker
function msTabla(b, R) {
  const L = R.L.slice().sort((p, q) => (q.corte + q.relleno) - (p.corte + p.relleno));
  b.innerHTML = `<div class="card"><div class="tblwrap" style="max-height:640px"><table class="tbl"><thead><tr><th>Tracker</th><th>Tipo</th><th class="n">Pend. terreno N-S</th><th class="n">Pend. tracker</th><th class="n">E-O terreno</th><th class="n">Corte (m³)</th><th class="n">Relleno (m³)</th><th class="n">Corte máx. (m)</th><th class="n">Relleno máx. (m)</th><th class="n">Hincas con mov.</th><th class="n">&gt; ${R.P.umbral} mm</th><th class="n">Despeje mín.</th><th class="n">Amortiguador L</th></tr></thead><tbody>
    ${L.map((r) => `<tr data-t="${r.t.id}" class="clk"><td><b>${r.t.id}</b>${r.t.rev ? ' <span class="pill p-warn" title="discretización a verificar">rev</span>' : ''}</td><td>${r.t.t}</td><td class="n" style="color:${Math.abs(r.pendT) > R.pend ? '#c0392b' : 'inherit'}">${fmt(Math.abs(r.pendT), 1)} %</td><td class="n">${fmt(Math.abs(r.pend), 1)} %</td>
      <td class="n" style="color:${r.eo > R.P.pendEO ? '#b45309' : 'inherit'}">${r.eo == null ? '—' : fmt(r.eo, 1) + ' %'}</td><td class="n">${fmt(r.corte, 1)}</td><td class="n">${fmt(r.relleno, 1)}</td><td class="n">${fmt(r.cMax, 2)}</td><td class="n">${fmt(r.rMax, 2)}</td><td class="n">${r.nMov} / ${r.H.length}</td><td class="n">${r.nVal || ''}</td><td class="n" style="color:${r.despMin < R.P.despMin / 1000 - 0.005 ? '#c0392b' : 'inherit'}">${fmt(r.despMin * 1000)} mm</td><td class="n">${r.amort ? fmt(r.amort, 1) + ' mm' : '—'}</td></tr>`).join('')}
    </tbody></table></div></div>`;
  $$('tr[data-t]', b).forEach((tr) => { tr.onclick = () => { MSUI.sel = tr.dataset.t; MSUI.tab = 'plano'; render(false); }; });
}
// ---------- rugosidad (método de topografía, planilla RugosidadArea) ----------
// Por tracker, con las hincas de norte a sur: pendiente = (cota 1ª − cota última) / distancia horizontal entre ellas;
// cota de referencia de cada hinca = cota 1ª + (Norte − Norte 1ª) × pendiente (recta entre las hincas extremas);
// delta = cota ref − cota; rugosidad = máx(delta) − mín(delta). Se marca si supera rugMax (0,30 m).
function msRug(H, campo = 'z') {
  const a = H[0], b = H[H.length - 1], dist = Math.hypot(a.x - b.x, a.y - b.y); if (!dist || H.some((h) => h[campo] == null)) return null;
  const G = (a[campo] - b[campo]) / dist, D = H.map((h) => a[campo] + (h.y - a.y) * G - h[campo]);
  return { G, D, rug: Math.max(...D) - Math.min(...D) };
}
function msRugTab(b, R) {
  const P = R.P, lim = (P.rugMax || 300) / 1000, F = R.L.map((r) => ({ r, tn: msRug(r.H, 'z'), fin: msRugDis(r) })).filter((x) => x.tn).sort((p, q) => q.tn.rug - p.tn.rug);
  const nS = F.filter((x) => x.tn.rug > lim).length, nF = F.filter((x) => x.fin && x.fin.rug > lim + 1e-6).length, med = F.length ? F.map((x) => x.tn.rug).sort((p, q) => p - q)[Math.floor(F.length / 2)] : 0;
  b.innerHTML = `<div class="grid g4" style="margin-bottom:12px">
      <div class="card kpi"><div class="kl">Trackers analizados</div><div class="kv">${fmt(F.length)}</div><div class="muted">${esc(R.terr.nombre)}</div></div>
      <div class="card kpi"><div class="kl">Superan ${fmt(lim, 2)} m en terreno natural</div><div class="kv" style="color:${nS ? '#c0392b' : 'inherit'}">${fmt(nS)}</div><div class="muted">${fmt(F.length ? nS / F.length * 100 : 0, 0)} % de los trackers</div></div>
      <div class="card kpi"><div class="kl">Rugosidad del terreno natural</div><div class="kv">${fmt(F.length ? F[0].tn.rug : 0, 2)} m</div><div class="muted">máxima · mediana ${fmt(med, 2)} m</div></div>
      <div class="card kpi"><div class="kl">Superan ${fmt(lim, 2)} m después del movimiento</div><div class="kv" style="color:${nF ? '#c0392b' : '#2f9e5b'}">${fmt(nF)}</div><div class="muted">terreno final contra la línea de diseño (${fmt(R.pend, 1)} %)</div></div></div>
    <div class="card"><div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><h3 style="margin:0;flex:1">Rugosidad por tracker · método de topografía</h3>
      <label class="rmchk" style="display:flex;gap:6px;align-items:center">Rugosidad máxima <input type="number" id="msRgM" value="${P.rugMax || 300}" min="50" max="1000" step="10" style="width:80px" ${window.READONLY ? 'disabled' : ''}> mm</label>
      <button class="btn sm" id="msRgX">Excel con el formato de topografía</button></div>
      <p class="hint" style="margin:6px 0 10px">Igual que la planilla de topografía: por tracker se traza la recta entre la primera y la última hinca (de norte a sur); en cada hinca, delta = cota de esa recta − cota del terreno; rugosidad = delta máximo − delta mínimo. Se marca en rojo si supera ${fmt(lim, 2)} m (la regulación de la hinca, −100 / +200 mm, cubre 300 mm). La columna "después del movimiento" mide el terreno final de este módulo contra la línea de diseño del tracker (la que siguen las cabezas de hinca), que no es la recta entre extremos.</p>
      <div class="tblwrap" style="max-height:600px"><table class="tbl"><thead><tr><th>Tracker</th><th>Tipo</th><th class="n">Hincas</th><th class="n">Pendiente (recta extremos)</th><th class="n">Rugosidad terreno natural (m)</th><th class="n">Delta mín / máx (m)</th><th class="n">Rugosidad después del movimiento (m)</th><th class="n">Corte + relleno (m³)</th></tr></thead><tbody>
      ${F.map(({ r, tn, fin }) => `<tr data-t="${r.t.id}" class="clk"><td><b>${r.t.id}</b></td><td>${r.t.t}</td><td class="n">${r.H.length}</td><td class="n">${fmt(tn.G * 100, 2)} %</td><td class="n" style="${tn.rug > lim ? 'color:#c0392b;font-weight:700' : ''}">${fmt(tn.rug, 3)}</td><td class="n">${fmt(Math.min(...tn.D), 3)} / ${fmt(Math.max(...tn.D), 3)}</td><td class="n" style="${fin && fin.rug > lim + 1e-6 ? 'color:#c0392b;font-weight:700' : ''}">${fin ? fmt(fin.rug, 3) : '—'}</td><td class="n">${fmt(r.corte + r.relleno, 1)}</td></tr>`).join('')}
      </tbody></table></div></div>`;
  $$('tr[data-t]', b).forEach((tr) => { tr.onclick = () => { MSUI.sel = tr.dataset.t; MSUI.tab = 'plano'; render(false); }; });
  $('#msRgX', b).onclick = () => msRugExcel(R);
  const im = $('#msRgM', b); if (im) im.onchange = () => { const m = msP(), v = Number(im.value); if (!(v > 0)) return; m.rugMax = v; msGuardarP(m, `Movimiento de suelos: rugosidad máxima = ${v} mm`); };
}
// rugosidad del terreno final respecto de la línea de diseño del tracker (la que siguen las cabezas): delta = terreno final − línea
function msRugDis(r) { const D = r.H.map((h) => h.zf - (r.a + r.b * h.d)); return { D, rug: Math.max(...D) - Math.min(...D) }; }
// Excel igual a la planilla de topografía, con fórmulas: Tracker, Hinca, Punto, Norte, Este, Elevación, Pendiente, Cota ref, Delta H, Rugosidad
async function msRugExcel(R) {
  const lim = (R.P.rugMax || 300) / 1000, ws = {}, set = (c, v) => { ws[c] = typeof v === 'object' && v ? v : { v, t: typeof v === 'number' ? 'n' : 's' }; };
  set('A2', `Sector ${R.sec}`); set('C3', 'Analisis de rugosidad de terreno'); set('L3', `Terreno: ${R.terr.nombre}`);
  ['Tracker', 'Hinca', 'Punto', 'Norte', 'Este', 'Elevacion', 'Pendiente', 'Cota ref', 'Delta H.', 'Rugosidad', 'Estado', 'Rugosidad final'].forEach((h, j) => set(String.fromCharCode(65 + j) + 5, h));
  let row = 6;
  R.L.forEach((r) => { const r0 = row, r1 = row + r.H.length - 1, fin = msRugDis(r);
    r.H.forEach((h, k) => { const i = row;
      if (!k) { set('A' + i, Number(String(r.t.id).replace(/\D/g, '')) || r.t.id); set('G' + i, { f: `(F${i}-F${r1})/(SQRT((D${i}-D${r1})^2+(E${i}-E${r1})^2))`, t: 'n', z: '0.00%' }); set('H' + i, { f: `F${i}`, t: 'n' });
        set('J' + i, { f: `MAX(I${r0}:I${r1})-MIN(I${r0}:I${r1})`, t: 'n', z: '0.000' }); set('K' + i, { f: `IF(J${i}>${lim},"Supera","OK")`, t: 's' }); if (fin) set('L' + i, { v: Math.round(fin.rug * 1000) / 1000, t: 'n', z: '0.000' }); }
      else set('H' + i, { f: `H${r0}+(D${i}-D${r0})*G${r0}`, t: 'n' });
      set('B' + i, h.n); set('D' + i, { v: Math.round(h.y * 1000) / 1000, t: 'n', z: '0.000' }); set('E' + i, { v: Math.round(h.x * 1000) / 1000, t: 'n', z: '0.000' }); set('F' + i, { v: Math.round(h.z * 1000) / 1000, t: 'n', z: '0.000' });
      set('I' + i, { f: `H${i}-F${i}`, t: 'n', z: '0.000' }); row++; }); });
  ws['!ref'] = `A1:L${row - 1}`; ws['!cols'] = [8, 6, 7, 13, 13, 10, 10, 10, 9, 10, 8, 12].map((w) => ({ wch: w }));
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Hoja1');
  const p = await window.api.saveBinary(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }), `Rugosidad sector ${R.sec} ${today()}.xlsx`, 'xlsx', 'Excel');
  if (p) toast('Excel guardado', { action: ['Abrir', () => window.api.openPath(p)] });
}
// escenarios de pendiente máxima para comparar
function msEscen(b, R) {
  const E = [5, 6, 8, 10, 12, 15].map((p) => msCalc(R.sec, p)).filter(Boolean);
  const mx = Math.max(...E.map((e) => e.corte + e.relleno), 1);
  b.innerHTML = `<div class="card"><h3>¿Cuánto movimiento según la pendiente máxima del tracker? · sector ${R.sec}</h3>
    <div class="tblwrap"><table class="tbl"><thead><tr><th>Pendiente N-S máx.</th><th class="n">Corte (m³)</th><th class="n">Relleno (m³)</th><th class="n">Aporte (m³)</th><th class="n">Hincas con mov.</th><th class="n">&gt; ${R.P.umbral} mm</th><th class="n">Corte máx.</th><th class="n">Relleno máx.</th><th style="width:28%"></th></tr></thead><tbody>
    ${E.map((e) => `<tr class="clk" data-p="${e.pend}"${e.pend === R.pend ? ' style="background:#fff3e0"' : ''}><td><b>${e.pend} %</b> <small class="muted">${fmt(Math.atan(e.pend / 100) * 180 / Math.PI, 1)}°</small></td><td class="n">${fmt(e.corte)}</td><td class="n">${fmt(e.relleno)}</td><td class="n">${fmt(e.aporte)}</td><td class="n">${fmt(e.nMov)}</td><td class="n">${fmt(e.nVal)}</td><td class="n">${fmt(e.cMax, 2)}</td><td class="n">${fmt(e.rMax, 2)}</td>
      <td><div class="msbar"><i style="width:${(e.corte / mx * 100).toFixed(1)}%;background:#d9534f"></i><i style="width:${(e.relleno / mx * 100).toFixed(1)}%;background:#3b7dd8"></i></div></td></tr>`).join('')}</tbody></table></div>
    <p class="hint">Tocá una fila para verla en el plano. Mismo terreno y parámetros; solo cambia la pendiente máxima del tracker.</p></div>`;
  $$('tr[data-p]', b).forEach((tr) => { tr.onclick = () => { MSUI.pend = Number(tr.dataset.p); MSUI.tab = 'plano'; render(false); }; });
}
// topografías cargadas
function msTopos(b, R) {
  const ro = window.READONLY, L = msSets();
  b.innerHTML = `<div class="card"><h3>Topografías y mallas de rugosidad</h3>
    ${L.length ? `<div class="tblwrap"><table class="tbl"><thead><tr><th>Nombre</th><th>Tipo</th><th>Fecha</th><th class="n">Puntos</th><th>Sectores</th><th class="n">Sobre hincas</th><th class="n">Cota</th><th>Cargado</th><th></th></tr></thead><tbody>
      ${L.map((x) => `<tr><td><b>${esc(x.nombre)}</b><br><small class="muted">${esc(x.archivo || '')}</small></td><td>${x.tipo === 'final' ? '<span class="pill p-info">Terreno final (verificar)</span>' : 'Terreno actual'}</td><td>${esc(x.fecha || '—')}</td><td class="n">${fmt(x.n)}</td><td>${(x.sectores || []).join(', ') || '—'}</td><td class="n">${x.sobre != null ? fmt(x.sobre) : '—'}</td><td class="n">${fmt(x.zmin, 2)} – ${fmt(x.zmax, 2)}</td><td><small>${esc((x.cargado || '').slice(0, 10))} · ${esc(x.usuario || '')}</small></td>
        <td>${ro ? '' : `<button class="btn sm" data-del="${x.id}">Borrar</button>`}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Todavía no hay topografías cargadas. Mientras tanto se usa la superficie del layout (cota de cada hinca del relevamiento de proyecto).</p>'}
    <p class="hint">Formato: CSV, TXT, Excel o LandXML (exportado de PVCase o Civil 3D). En CSV/Excel, una fila por punto: nombre (opcional), Norte, Este y cota, en metros o en milímetros (se detecta solo, también el orden Norte/Este). Puede ser un punto por hinca o una malla de rugosidad: el cálculo usa el punto que cae sobre cada hinca (a menos de 0,5 m) y entre hincas la superficie triangulada.</p>
    ${ro ? '' : '<button class="btn pri" id="msImp">Cargar topografía</button>'}</div>`;
  const bi = $('#msImp', b); if (bi) bi.onclick = msImportar;
  $$('[data-del]', b).forEach((x) => { x.onclick = async () => { const s = msSets().find((q) => q.id === x.dataset.del); if (!s) return;
    const ok = await modal({ title: 'Borrar topografía', sub: s.nombre, body: `<p>Se borran sus ${fmt(s.n)} puntos. Los sectores que la usaban vuelven a la topografía más nueva que tengan, o a la del layout.</p>`, buttons: [['Cancelar', 'btn', () => null], ['Borrar', 'btn danger', () => true]] });
    if (!ok) return; S.topo = msSets().filter((q) => q.id !== s.id); MSC = null; commit(`Movimiento de suelos: topografía "${s.nombre}" borrada`); }; });
}
function msPar(b, R) {
  const P = msP(), ro = window.READONLY;
  const f = (k, lbl, u, st, help) => `<label title="${esc(help || '')}">${lbl}<span class="rmin"><input type="number" step="${st}" data-k="${k}" value="${P[k]}" ${ro ? 'disabled' : ''}><em>${u}</em></span><small class="muted">${help || ''}</small></label>`;
  const c = (k, lbl, help) => `<label class="rmchk"><input type="checkbox" data-k="${k}" ${P[k] ? 'checked' : ''} ${ro ? 'disabled' : ''} style="width:auto"><span><b>${lbl}</b> ${help || ''}</span></label>`;
  b.innerHTML = `<div class="grid g2"><div class="card"><h3>Criterios de Trina</h3><div class="form rmform">
      ${f('pendNS', 'Pendiente N-S máxima del tracker', '%', '0.5', 'Manual ARI-GR-MN-4301-0A §3.2: hasta 15 % (9°). Con el control del plano se prueba sin guardar.')}
      ${f('pendEO', 'Pendiente E-O máxima del terreno', '%', '0.5', 'Manual §3.2/§3.3.1: hasta 15 % (9°). Se controla y se marca; si se supera, consultar a Trina.')}
      ${f('regMenos', 'Regulación: hincar más que la nominal', 'mm', '10', 'Manual §3.4.3: hasta +100 mm de hincado (altura libre −100 mm).')}
      ${f('regMas', 'Regulación: hincar menos que la nominal', 'mm', '10', 'Manual §3.4.3: hasta −200 mm de hincado (altura libre +200 mm); nunca menos que el empotramiento mínimo del poste.')}
      ${f('tolAlt', 'Tolerancia de altura de la hinca', 'mm', '5', 'Manual §3.4.1: ±30 mm.')}
      ${c('usarTol', 'Reservar la tolerancia de hincado', 'dentro de la banda (el terreno queda 30 mm adentro de cada límite).')}
      ${f('umbral', 'Espesor que requiere validar postes', 'mm', '10', 'Manual §3.1: áreas con movimiento de tierra de más de 200 mm.')}
      ${c('usarDesp', 'Controlar el despeje módulo-suelo', 'con el tracker girado al máximo (vista lateral del plano MEC-DW-26050-3401-0A).')}
      ${f('despMin', 'Despeje mínimo exigido', 'mm', '10', 'Distancia mínima del borde del módulo al suelo con el tracker girado al máximo.')}
      ${f('despNom', 'Despeje del diseño en terreno plano', 'mm', '10', 'MEC-DW-26050-3401-0A: 500 mm a ±60° con la hinca a su altura libre nominal (1.315 mm).')}
      ${f('angMax', 'Giro máximo del tracker', '°', '1', 'MEC-DW-26050-3401-0A: ±60°.')}
      ${f('anchoMod', 'Ancho del módulo (E-O)', 'mm', '1', 'MEC-DW-26050-3401-0A: 2.382 mm. A 60°, el borde queda a ancho/2 × cos 60° ≈ 0,6 m al costado del eje.')}</div></div>
    <div class="card"><h3>Cálculo</h3><div class="form rmform">
      <label>Criterio<span class="rmin"><select data-k="modo" ${ro ? 'disabled' : ''}><option value="trina" ${P.modo !== 'completa' ? 'selected' : ''}>Trina: solo la franja donde la hinca no llega</option><option value="completa" ${P.modo === 'completa' ? 'selected' : ''}>Nivelación completa del área (como Civil 3D)</option></select></span><small class="muted">La nivelación completa deja todo el terreno sobre el diseño (rectas por fila y planos entre filas), sin aprovechar la regulación de la hinca.</small></label>
      ${c('compensar', 'Nivelación completa: compensar corte y relleno', 'subiendo o bajando todo el diseño del sector hasta que el corte alcance para el relleno compactado.')}
      <label>Nivelación completa: área<span class="rmin"><select data-k="areaNiv" ${ro ? 'disabled' : ''}><option value="topo" ${P.areaNiv !== 'filas' ? 'selected' : ''}>Toda el área relevada (contorno de la topografía, como Civil 3D)</option><option value="filas" ${P.areaNiv === 'filas' ? 'selected' : ''}>Solo el ancho entre filas de trackers</option></select></span><small class="muted">Con el layout como terreno se usa siempre el ancho entre filas.</small></label>
      ${f('dzNiv', 'Nivelación completa sin compensar: ajuste de cota del diseño', 'cm', '0.5', 'Sube (+) o baja (−) todo el diseño del sector. Con "compensar" activo se calcula solo.')}
      ${f('maxLado', 'Topografía: lado máximo de triángulo', 'm', '5', 'Superficie del relevamiento: no se unen puntos más lejanos que esto. Para igualar el área de Civil 3D usar el mismo criterio que topografía (sin límite ≈ casco convexo).')}
      ${f('anchoNiv', 'Nivelación completa: ancho por fila', 'm', '0.5', '0 = la distancia entre filas del sector (todo el terreno).')}
      ${f('franja', 'Ancho de la franja por tracker (criterio Trina)', 'm', '0.5', 'Ancho de terreno que se mueve a lo largo de cada tracker.')}
      ${f('ext', 'Franja más allá de las puntas', 'm', '0.25', 'Largo extra al norte de la primera hinca y al sur de la última.')}
      ${f('paso', 'Paso del perfil', 'm', '0.25', 'Cada cuánto se controla el terreno a lo largo del tracker.')}
      ${c('todoLargo', 'Controlar todo el largo del tracker', '(si no, solo en las hincas y el terreno entre hincas se toma recto).')}
      ${f('esponj', 'Esponjamiento / compactación del relleno', '%', '1', 'Material suelto necesario por m³ de relleno compactado.')}
      <label>Cuando hay que mover, preferir<span class="rmin"><select data-k="prior" ${ro ? 'disabled' : ''}>${[['corte', 'Cortar (el relleno pesa 3 veces)'], ['igual', 'Lo que mueva menos volumen'], ['relleno', 'Rellenar']].map(([v, t]) => `<option value="${v}" ${P.prior === v ? 'selected' : ''}>${t}</option>`).join('')}</select></span><small class="muted">Se elige la pendiente y la altura de la línea de cada tracker con este criterio.</small></label>
      ${c('limUmb', 'Evitar movimientos de más del espesor de validación', `(${P.umbral} mm): primero se busca la pendiente y la altura que no lo superen, aunque mueva más volumen.`)}
      ${f('equi', 'Equidistancia de curvas de nivel', 'm', '0.1', 'Curva maestra cada 5.')}
      ${ro ? '' : '<button class="btn" id="msRes">Volver a los valores por defecto</button>'}</div>
      <p class="hint">La altura libre nominal, el largo y el empotramiento mínimo de cada hinca salen del catálogo Trina (o de los parámetros del Ramming plan si falta la distribución).</p></div></div>`;
  $$('[data-k]', b).forEach((i) => { i.onchange = () => { const m = msP(), k = i.dataset.k; m[k] = i.type === 'checkbox' ? i.checked : i.tagName === 'SELECT' ? i.value : Number(i.value); if (k === 'pendNS') MSUI.pend = null; msGuardarP(m, `Movimiento de suelos: ${k} = ${m[k]}`); }; });
  const rs = $('#msRes', b); if (rs) rs.onclick = () => { const m = Object.assign({}, MS_DEF, { fuente: msP().fuente }); MSUI.pend = null; msGuardarP(m, 'Movimiento de suelos: parámetros por defecto'); };
}

// ---------- importación de topografía ----------
// cota del plano z = a + b·x + c·y ajustado por mínimos cuadrados a los puntos Q, en (x, y)
function msPlanoZ(Q, x, y) {
  const mx = Q.reduce((s, q) => s + q[0], 0) / Q.length, my = Q.reduce((s, q) => s + q[1], 0) / Q.length, mz = Q.reduce((s, q) => s + q[2], 0) / Q.length;
  let sxx = 0, sxy = 0, syy = 0, sxz = 0, syz = 0; Q.forEach((q) => { const dx = q[0] - mx, dy = q[1] - my, dz = q[2] - mz; sxx += dx * dx; sxy += dx * dy; syy += dy * dy; sxz += dx * dz; syz += dy * dz; });
  const det = sxx * syy - sxy * sxy; if (Math.abs(det) < 1e-6) return null; // puntos alineados: no hay plano
  const b = (sxz * syy - syz * sxy) / det, c = (syz * sxx - sxz * sxy) / det; return mz + b * (x - mx) + c * (y - my);
}
// detecta columnas (nombre, Norte, Este, cota), unidades (m o mm) y descarta lo que no cae en el parque
function msLeerFilas(rows) {
  const [OX, OY] = msOrigen(), P = window.PLANO, x0 = OX - 200, x1 = OX + (P.W || 3000) + 200, y0 = OY - (P.H || 3000) - 200, y1 = OY + 200;
  const num = (v) => { if (typeof v === 'number') return v; if (v == null) return NaN; const s = String(v).trim().replace(/\s/g, ''); if (!/^[-+]?\d+([.,]\d+)?$/.test(s)) return NaN; return Number(s.replace(',', '.')); };
  const R = rows.filter((r) => r && r.length >= 3).map((r) => r.map(num)), nc = Math.max(...R.map((r) => r.length));
  const nombres = rows.filter((r) => r && r.length >= 3).map((r) => r.find((v) => typeof v === 'string' && isNaN(num(v))) || '');
  // por columna: escala de coordenadas (m o mm) por valor; se prueban todas las parejas de columnas como Este/Norte
  const coord = (v) => (Math.abs(v) > 1e8 ? v / 1000 : v), cota = (v) => (Math.abs(v) > 1e4 ? v / 1000 : v);
  let best = null;
  for (let ce = 0; ce < nc; ce++) for (let cn = 0; cn < nc; cn++) { if (ce === cn) continue; let k = 0;
    R.forEach((r) => { const x = coord(r[ce]), y = coord(r[cn]); if (x > x0 && x < x1 && y > y0 && y < y1) k++; }); if (!best || k > best.k) best = { ce, cn, k }; }
  if (!best || best.k < 3) return { err: 'No se encontraron coordenadas dentro del parque (Este ~' + Math.round(OX) + ', Norte ~' + Math.round(OY) + ').' };
  // columna de cota: entre las que tienen valores de cota válidos, la de menor rango (las cotas varían unos metros; un número de punto, cientos o miles)
  const cand = []; for (let c = 0; c < nc; c++) { if (c === best.ce || c === best.cn) continue; const v = R.map((r) => cota(r[c])).filter((z) => z > 0 && z < 9000); if (v.length) { v.sort((p, q) => p - q); cand.push({ c, k: v.length, rg: v[Math.floor(v.length * 0.98)] - v[Math.floor(v.length * 0.02)] }); } }
  const kmax = Math.max(0, ...cand.map((x) => x.k)), cz = cand.filter((x) => x.k >= 0.9 * kmax).sort((p, q) => p.rg - q.rg).map((x) => x.c)[0] ?? -1;
  if (cz < 0) return { err: 'No se encontró la columna de cota.' };
  const pts = [], fuera = [], mm = { c: 0, z: 0 };
  R.forEach((r, i) => { const x = coord(r[best.ce]), y = coord(r[best.cn]), z = cota(r[cz]);
    if (!(x > x0 && x < x1 && y > y0 && y < y1 && z > 0 && z < 9000)) { if (!isNaN(r[best.ce])) fuera.push(nombres[i] || `fila ${i + 1}`); return; }
    if (Math.abs(r[best.ce]) > 1e8) mm.c++; if (Math.abs(r[cz]) > 1e4) mm.z++; pts.push([Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000, Math.round(z * 1000) / 1000, nombres[i] || `fila ${i + 1}`]); });
  // cotas anómalas: puntos que se apartan más de 0,6 m del plano ajustado a sus vecinos (a menos de 12 m; respeta la pendiente) · error de carga típico
  const G = new Map(), C = 12; pts.forEach((p) => { const k = Math.floor(p[0] / C) + ',' + Math.floor(p[1] / C); (G.get(k) || G.set(k, []).get(k)).push(p); });
  // se descarta de a uno, el peor primero, y se vuelve a evaluar: un punto muy errado no arrastra a sus vecinos
  const vec = new Map(); pts.forEach((p) => { const v = [], gx = Math.floor(p[0] / C), gy = Math.floor(p[1] / C);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const q of G.get((gx + i) + ',' + (gy + j)) || []) if (q !== p && Math.hypot(q[0] - p[0], q[1] - p[1]) < C) v.push(q); vec.set(p, v); });
  const anom = [], malos = new Set(), res = (p) => { const v = vec.get(p).filter((q) => !malos.has(q)); if (v.length < 4) return null;
    const med = msPlanoZ(v, p[0], p[1]); if (med == null) return null;
    const rms = Math.sqrt(v.reduce((s0, q) => s0 + (q[2] - msPlanoZ(v, q[0], q[1])) ** 2, 0) / v.length); // dispersión local: en bordes o terreno quebrado se tolera más
    return { med, e: Math.abs(p[2] - med), lim: Math.max(0.6, 4 * rms) }; };
  for (let it = 0; it < 200; it++) { let peor = null;
    pts.forEach((p) => { if (malos.has(p)) return; const r = res(p); if (r && r.e > r.lim && (!peor || r.e - r.lim > peor.r.e - peor.r.lim)) peor = { p, r }; });
    if (!peor) break; malos.add(peor.p); anom.push({ p: peor.p, med: peor.r.med }); }
  return { pts: pts.filter((p) => !malos.has(p)).map((p) => p.slice(0, 3)), anom: anom.map((a) => ({ n: a.p[3], x: a.p[0], y: a.p[1], z: a.p[2], med: a.med })), todos: pts.map((p) => p.slice(0, 3)), fuera, mm, col: { e: best.ce + 1, n: best.cn + 1, z: cz + 1 }, nFil: R.length };
}
async function msImportar() {
  if (window.READONLY) { toast('Tu usuario no tiene permiso para cargar topografías', { err: true }); return; }
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.csv,.txt,.xlsx,.xls,.xml,.landxml';
  inp.onchange = async () => {
    const file = inp.files[0]; if (!file) return; let rows;
    try {
      if (/\.(land)?xml$/i.test(file.name)) rows = msLandXML(await file.text());
      else if (/\.xlsx?$/i.test(file.name)) { const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' }); rows = []; wb.SheetNames.forEach((n) => { rows = rows.concat(XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true })); }); }
      else { const t = await file.text(), sep = /;/.test(t.split('\n')[0]) ? ';' : /\t/.test(t.split('\n')[0]) ? '\t' : /,/.test(t.split('\n')[0]) && !/\d,\d{1,3}[;\t ]/.test(t.split('\n')[0]) ? ',' : /\s+/; rows = t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => l.split(sep)); }
    } catch (e) { toast('No se pudo leer el archivo: ' + e.message, { err: true }); return; }
    const L = msLeerFilas(rows); if (L.err) { toast(L.err, { err: true }); return; }
    msRalear(L); // superficies muy densas (PVCase / Civil 3D): un punto cada 0,5 m alcanza y no satura la sincronización
    // cobertura por sector y puntos sobre hincas
    const PL = window.PLANO.trk, G = new Map(); L.pts.forEach((p) => { const k = Math.round(p[0]) + ',' + Math.round(p[1]); (G.get(k) || G.set(k, []).get(k)).push(p); });
    const porSec = {}; let sobre = 0;
    PL.forEach((t) => { const rp = repDe(t.id); if (!rp || !rp.p) return; rp.p.forEach(([x, y]) => { let ok = false; for (let i = -1; i <= 1 && !ok; i++) for (let j = -1; j <= 1 && !ok; j++) for (const p of G.get((Math.round(x) + i) + ',' + (Math.round(y) + j)) || []) if (Math.hypot(p[0] - x, p[1] - y) < 0.5) { ok = true; break; }
      const s = (porSec[t.s] = porSec[t.s] || { h: 0, c: 0 }); s.h++; if (ok) { s.c++; sobre++; } }); });
    // un sector está cubierto si tiene puntos sobre sus hincas o puntos dentro de su área
    const cub = Object.entries(porSec).filter(([s, v]) => v.c / v.h > 0.3 || (() => { const T = PL.filter((t) => t.s === s); const R0 = T.map((t) => ramRect(t)); const [OX, OY] = msOrigen();
      const xa = Math.min(...R0.map((r) => r.x)) + OX, xb = Math.max(...R0.map((r) => r.x + r.w)) + OX, ya = OY - Math.max(...R0.map((r) => r.y + r.h)), yb = OY - Math.min(...R0.map((r) => r.y));
      return L.pts.filter((p) => p[0] > xa && p[0] < xb && p[1] > ya && p[1] < yb).length > 0.3 * v.h; })()).map(([s]) => s);
    const zs = L.pts.map((p) => p[2]), nombre0 = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
    const r = await modal({ title: 'Cargar topografía', sub: `${esc(file.name)} · ${fmt(L.nFil)} filas`,
      body: `<div class="form"><label>Nombre<input id="tpN" value="${esc(nombre0)}"></label><label>Fecha<input type="date" id="tpF" value="${today()}"></label>
          <label>Qué es<select id="tpT"><option value="actual">Terreno actual (relevamiento / malla de rugosidad): base del cálculo</option><option value="final" ${/final|propos|proyect|dise[nñ]|grad|pvcase|civil|\bfg\b|terminad/i.test(file.name) ? 'selected' : ''}>Terreno final de diseño (PVCase, Civil 3D): para verificar contra Trina</option></select></label></div>
        ${L.ral ? `<p class="hint">Superficie densa: se tomó un punto cada 0,5 m (${fmt(L.ral)} de ${fmt(L.ral0)} puntos).</p>` : ''}
        <ul class="mschk"><li><b>${fmt(L.pts.length)}</b> puntos válidos · columnas Este ${L.col.e}, Norte ${L.col.n}, cota ${L.col.z}${L.mm.c || L.mm.z ? ` · ${fmt(L.mm.c)} coordenadas y ${fmt(L.mm.z)} cotas venían en milímetros` : ''}</li>
          <li>Cota de ${fmt(Math.min(...zs), 2)} a ${fmt(Math.max(...zs), 2)} m</li>
          <li><b>${fmt(sobre)}</b> puntos caen sobre hincas (a menos de 0,5 m)${Object.entries(porSec).filter(([, v]) => v.c).map(([s, v]) => ` · sector ${s}: ${fmt(v.c)} de ${fmt(v.h)}`).join('')}</li>
          <li>Sectores cubiertos: <b>${cub.join(', ') || 'ninguno completo'}</b> (se usa en el cálculo de esos sectores)</li>
          ${L.anom.length ? `<li class="warn"><b>${fmt(L.anom.length)}</b> con cota anómala (más de 1 m distinta de sus vecinos), se descartan: ${L.anom.slice(0, 6).map((a) => `${esc(a.n)} ${fmt(a.z, 2)} m (vecinos ~${fmt(a.med, 2)})`).join(' · ')}${L.anom.length > 6 ? '…' : ''}
            <label class="rmchk" style="margin-top:4px"><input type="checkbox" id="tpA" style="width:auto"><span>Cargarlos igual</span></label></li>` : ''}
          ${L.fuera.length ? `<li class="warn">${fmt(L.fuera.length)} filas fuera del parque o sin cota, no se cargan: ${esc(L.fuera.slice(0, 8).join(', '))}${L.fuera.length > 8 ? '…' : ''}</li>` : ''}</ul>`,
      buttons: [['Cancelar', 'btn', () => null], ['Cargar', 'btn pri', (m) => ({ nombre: $('#tpN', m).value.trim() || nombre0, fecha: $('#tpF', m).value, tipo: $('#tpT', m).value, anom: !!($('#tpA', m) || {}).checked })]] });
    if (!r) return; if (r.anom) L.pts = L.todos;
    const id = 'tp' + Date.now().toString(36);
    S.topo = msSets().concat([{ id, tipo: r.tipo, nombre: r.nombre, fecha: r.fecha, archivo: file.name, n: L.pts.length, pts: L.pts, sectores: cub, sobre, descartados: r.anom ? [] : L.anom.map((a) => a.n), zmin: Math.min(...zs), zmax: Math.max(...zs), cargado: new Date().toISOString(), usuario: (window.USUARIO && window.USUARIO.nombre) || '' }]);
    const m = msP(); cub.forEach((s) => { if (r.tipo === 'final') m.final[s] = id; else m.fuente[s] = id; }); S.hincado.mov = m; MSC = null;
    if (cub.length && !cub.includes(MSUI.sec)) MSUI.sec = cub[0]; MSUI.tab = r.tipo === 'final' ? 'ver' : 'plano'; MSUI.vb = null; MSUI.sel = null;
    commit(`Movimiento de suelos: topografía "${r.nombre}" cargada (${fmt(L.pts.length)} puntos${cub.length ? ', sector ' + cub.join(', ') : ''})`);
  };
  inp.click();
}

// ---------- exportaciones ----------
async function msExcel(sec, pend) {
  const R = msCalc(sec, pend); if (!R) return; const P = R.P, wb = XLSX.utils.book_new(), r3 = (v) => (v == null ? null : Math.round(v * 1000) / 1000);
  const res = [['PSFV Oberá II · Movimiento de suelos para hincado · sector ' + sec], ['Terreno', R.terr.nombre], ['Pendiente N-S máx. del tracker (%)', pend], ['Pendiente E-O máx. (%)', P.pendEO],
    ['Regulación (mm)', `−${P.regMenos} / +${P.regMas}` + (P.usarTol ? ` · tolerancia ±${P.tolAlt} reservada` : '')], ['Franja (m)', P.franja],
    ['Despeje módulo-suelo', P.usarDesp ? `≥ ${P.despMin} mm a ±${P.angMax}° (diseño ${P.despNom} mm, módulo ${P.anchoMod} mm)` : 'no se controla'],
    ['Criterio', (P.limUmb ? `evitar más de ${P.umbral} mm · ` : '') + ({ corte: 'priorizar corte (relleno ×3)', igual: 'menor volumen', relleno: 'priorizar relleno' }[P.prior] || '')], [],
    ['Corte (m³)', r3(R.corte)], ['Relleno (m³)', r3(R.relleno)], [`Material para relleno ×${1 + P.esponj / 100} (m³)`, r3(R.mat)], ['Aporte externo (m³)', r3(R.aporte)], ['Sobrante de corte (m³)', r3(R.sobra)],
    ['Trackers con movimiento', R.nTrk], ['Hincas con movimiento', R.nMov], [`Hincas con más de ${P.umbral} mm (validación Trina)`, R.nVal], ['Trackers con terreno E-O > límite', R.eoFuera], [],
    ['Criterios: manual Trina ARI-GR-MN-4301-0A (§3.1, §3.2, §3.3.1, §3.4.1, §3.4.3, §4.8.3)']];
  const esc0 = [['Pendiente N-S máx. (%)', 'Corte (m³)', 'Relleno (m³)', 'Aporte (m³)', 'Hincas con mov.', `> ${P.umbral} mm`]].concat([5, 6, 8, 10, 12, 15].map((p) => { const e = msCalc(sec, p); return [p, r3(e.corte), r3(e.relleno), r3(e.aporte), e.nMov, e.nVal]; }));
  const trk = [['Tracker', 'Tipo', 'Pend. terreno N-S (%)', 'Pend. tracker (%)', 'Inclinación (°)', 'E-O terreno (%)', 'Corte (m³)', 'Relleno (m³)', 'Corte máx. (m)', 'Relleno máx. (m)', 'Hincas con mov.', `> ${P.umbral} mm`, 'Despeje mín. (mm)', 'Amortiguador L (mm)']]
    .concat(R.L.map((r) => [r.t.id, r.t.t, r3(Math.abs(r.pendT)), r3(Math.abs(r.pend)), r3(r.grad), r3(r.eo), r3(r.corte), r3(r.relleno), r3(r.cMax), r3(r.rMax), r.nMov, r.nVal, Math.round(r.despMin * 1000), r.amort]));
  const hin = [['Tracker', 'Hinca', 'Motor', 'Código', 'X', 'Y', 'Terreno actual', 'Dato', 'Cota cabeza', 'Alt. libre nominal', 'Alt. libre sin mover', 'Terreno final', 'Movimiento (+ relleno / − corte)', 'Alt. libre final', 'Alt. libre mín.', 'Alt. libre máx.']]
    .concat(R.L.flatMap((r) => r.H.map((h) => [r.t.id, h.n, h.motor ? 'M' : '', h.cod || '', r3(h.x), r3(h.y), r3(h.z), h.fz, r3(h.cab), r3(h.nom), r3(h.rev0), r3(h.zf), r3(h.mov), r3(h.rev), r3(h.rmin), r3(h.rmax)])));
  const rpl = [['Punto', 'Tracker', 'Norte', 'Este', 'Cota terreno actual', 'Cota de proyecto', 'Acción', 'Bajar (m)', 'Subir (m)']].concat(msReplanteo(R).map((q) => [q.p, q.t, r3(q.y), r3(q.x), r3(q.z), r3(q.zf), Math.abs(q.mov) < 0.005 ? 'sin movimiento' : q.mov < 0 ? 'bajar (corte)' : 'subir (relleno)', q.mov < -0.005 ? r3(-q.mov) : null, q.mov > 0.005 ? r3(q.mov) : null]));
  [['Resumen', res, [44, 30]], ['Replanteo punto a punto', rpl, [16, 10, 13, 13, 12, 12, 15, 10, 10]], ['Escenarios', esc0, [22, 12, 12, 12, 14, 12]], ['Trackers', trk, [10, 7, 12, 12, 11, 11, 10, 10, 11, 11, 11, 9, 13]], ['Hincas', hin, [10, 6, 6, 10, 12, 12, 11, 10, 11, 10, 11, 11, 14, 10, 10, 10]]].forEach(([n, a, w]) => {
    const s = XLSX.utils.aoa_to_sheet(a); s['!cols'] = w.map((x) => ({ wch: x })); XLSX.utils.book_append_sheet(wb, s, n); });
  const p = await window.api.saveBinary(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }), `Movimiento de suelos sector ${sec} ${pend} % ${today()}.xlsx`, 'xlsx', 'Excel');
  if (p) toast('Excel guardado');
}
function msPdf(sec, pend) {
  const R = msCalc(sec, pend); if (!R) return; const P = R.P, bb = msPlanoSVG(R, { print: true }).bb;
  // hoja A3 vertical u horizontal, la que deja el plano más grande
  const opc = [[404, 249, 420, 297, 'L'], [281, 372, 297, 420, 'P']].map(([W, Hm, pw, ph, o]) => ({ W, Hm, pw, ph, o, k: Math.min(W / bb[2], Hm / bb[3]) })).sort((a, b) => b.k - a.k)[0];
  const { W, Hm, pw, ph } = opc, esc = Math.ceil(1000 / opc.k / 50) * 50, mW = W * esc / 1000, mH = Hm * esc / 1000, vb = [bb[0] + bb[2] / 2 - mW / 2, bb[1] + bb[3] / 2 - mH / 2, mW, mH];
  const S0 = msPlanoSVG(R, { print: true, mpm: esc / 1000, ver: { curvas: true, lim: true, vol: true, ptos: false } });
  const kp = (l, v, c) => `<div><small>${l}</small><b${c ? ` style="color:${c}"` : ''}>${v}</b></div>`;
  let h = `<section class="rmpg" data-o="${opc.o}" style="width:${pw}mm;height:${ph}mm"><div class="mspdfh"><div><b>Movimiento de suelos para hincado · Sector ${sec}</b><br>${esc_(S.nombre || '')} · ${esc_(R.terr.nombre)}</div>
      <div class="mspdfk">${kp('Corte', fmt(R.corte) + ' m³', '#c0392b')}${kp('Relleno', fmt(R.relleno) + ' m³', '#1f5fa8')}${kp(R.aporte > 0 ? 'Aporte' : 'Sobrante', fmt(R.aporte > 0 ? R.aporte : R.sobra) + ' m³')}${kp('Hincas con mov.', fmt(R.nMov) + ' / ' + fmt(R.nH))}${kp('> ' + P.umbral + ' mm', fmt(R.nVal), '#b45309')}${kp('Pend. N-S máx.', fmt(pend, 1) + ' %')}${kp('Escala', '1:' + esc)}</div></div>
    <svg viewBox="${vb.map((v) => v.toFixed(2)).join(' ')}" style="display:block;width:${W}mm;height:${Hm}mm" font-family="Arial">${S0.defs}${S0.g}</svg>
    <div class="msley pr"><span><i style="background:${msColor(-1.2)}"></i>Corte</span><span><i style="background:${msColor(-0.3)}"></i></span><span><i style="background:#e3e7ec"></i>Sin movimiento</span><span><i style="background:${msColor(0.3)}"></i></span><span><i style="background:${msColor(1.2)}"></i>Relleno</span><span><i class="msdot"></i>Hinca con más de ${P.umbral} mm (validación Trina)</span><span><i class="mshat"></i>Terreno fuera de pendiente Trina</span>
      <span>${P.limUmb ? `Evitando más de ${P.umbral} mm · ` : ''}${{ corte: 'priorizando corte', igual: 'menor volumen', relleno: 'priorizando relleno' }[P.prior] || ''} · Curvas cada ${fmt(P.equi, 2)} m · C/R: m³ por tracker (franja ${fmt(P.franja, 1)} m) · regulación −${P.regMenos}/+${P.regMas} mm${P.usarTol ? ` (±${P.tolAlt} reservados)` : ''} · Trina ARI-GR-MN-4301-0A · ${new Date().toLocaleDateString('es-AR')}</span><span class="rmnorte">▲ N</span></div></section>`;
  const L = R.L.slice().sort((p, q) => (q.corte + q.relleno) - (p.corte + p.relleno)).filter((r) => r.corte + r.relleno > 0.01);
  for (let i = 0; i < L.length; i += 34) h += `<section class="rmpg" data-o="L" style="width:420mm;height:297mm"><div class="mspdfh"><div><b>Trackers con movimiento · Sector ${sec} · pendiente N-S máx. ${fmt(pend, 1)} %</b></div></div>
    <table class="tbl mspdft"><thead><tr><th>Tracker</th><th>Tipo</th><th>Pend. terreno</th><th>Pend. tracker</th><th>E-O terreno</th><th>Corte (m³)</th><th>Relleno (m³)</th><th>Corte máx. (m)</th><th>Relleno máx. (m)</th><th>Hincas con mov.</th><th>&gt; ${P.umbral} mm</th><th>Amortiguador L</th></tr></thead><tbody>
    ${L.slice(i, i + 34).map((r) => `<tr><td>${r.t.id}</td><td>${r.t.t}</td><td>${fmt(Math.abs(r.pendT), 1)} %</td><td>${fmt(Math.abs(r.pend), 1)} %</td><td>${r.eo == null ? '—' : fmt(r.eo, 1) + ' %'}</td><td>${fmt(r.corte, 1)}</td><td>${fmt(r.relleno, 1)}</td><td>${fmt(r.cMax, 2)}</td><td>${fmt(r.rMax, 2)}</td><td>${r.nMov} / ${r.H.length}</td><td>${r.nVal || ''}</td><td>${r.amort ? fmt(r.amort, 1) + ' mm' : '—'}</td></tr>`).join('')}</tbody></table></section>`;
  // hojas de detalle a escala 1:250 o mayor: cuánto bajar o subir en cada hinca
  const DT = msHojasDet(R); h += DT.html;
  const orden = [opc.o].concat(DT.orden, Array(Math.ceil(L.length / 34)).fill('L'));
  ramPrintPaginas(h, `Movimiento de suelos sector ${sec} ${pend} % ${today()}.pdf`, 'A3', orden);
}

// puntos intermedios del perfil (entre hincas) donde también hay que mover: el de mayor espesor de cada tramo continuo con movimiento
function msInter(r, umb = 0.01) {
  const M = r.M, out = []; let i = 0;
  while (i < M.length) { if (Math.abs(M[i].mov) < umb || M[i].pila) { i++; continue; } let j = i, b = i; const sg = Math.sign(M[i].mov);
    while (j + 1 < M.length && Math.abs(M[j + 1].mov) >= umb && Math.sign(M[j + 1].mov) === sg) { j++; if (Math.abs(M[j].mov) > Math.abs(M[b].mov)) b = j; }
    if (!M.slice(i, j + 1).some((m) => m.pila)) out.push(M[b]); i = j + 1; }
  return out;
}
// hojas de detalle del movimiento: el sector partido entre trackers (como el plano de hincas) hasta llegar a 1:250 o mejor
function msHojasDet(R) {
  const T = R.L.map((r) => Object.assign({}, ramRect(r.t), { id: r.t.id })), sec = R.sec, P = R.P;
  // A3 vertical a 1:250: franjas por columnas de trackers (cortes en los huecos E-O) y, dentro de cada franja, cortes N-S entre filas de trackers
  const esc = 250, m = esc / 1000, port = true, pw = 297, ph = 420, W = pw - 16, Hm = ph - 16 - 24, Wm = W * m - 6, HmM = Hm * m - 8;
  const cj = (t) => ramCaja([t]), grupos = [];
  const xs = T.slice().sort((p, q) => cj(p).x0 - cj(q).x0); let col = [];
  const cortaY = (G) => { const L = G.slice().sort((p, q) => cj(p).y0 - cj(q).y0); let cur = [], y0 = null;
    L.forEach((t) => { const c = cj(t); if (!cur.length) { cur = [t]; y0 = c.y0; return; } if (c.y1 - y0 > HmM && (c.y0 >= Math.max(...cur.map((q) => cj(q).y1)) - 0.5 || c.y0 - y0 > HmM * 0.55)) { grupos.push(cur); cur = [t]; y0 = c.y0; } else cur.push(t); });
    if (cur.length) grupos.push(cur); };
  let x0 = null; xs.forEach((t) => { const c = cj(t); if (!col.length) { col = [t]; x0 = c.x0; return; } if (c.x1 - x0 > Wm) { cortaY(col); col = [t]; x0 = c.x0; } else col.push(t); });
  if (col.length) cortaY(col);
  const S0 = msPlanoSVG(R, { print: true, det: true, mpm: m, ver: { curvas: true, lim: false, vol: true, ptos: false } });
  const todas = grupos.map((g) => ramCaja(g)), BB = ramCaja(T);
  const croq = (i) => { const w = BB.x1 - BB.x0, hh = BB.y1 - BB.y0, k = Math.min(46 / w, 16 / hh);
    return `<svg viewBox="${BB.x0} ${BB.y0} ${w} ${hh}" style="width:${(w * k).toFixed(1)}mm;height:${(hh * k).toFixed(1)}mm">${T.map((t) => `<rect x="${t.x}" y="${t.y}" width="${t.w}" height="${t.h}" fill="#bbb"/>`).join('')}${todas.map((c, j) => `<rect x="${c.x0}" y="${c.y0}" width="${c.x1 - c.x0}" height="${c.y1 - c.y0}" fill="${j === i ? 'rgba(194,94,0,.35)' : 'none'}" stroke="${j === i ? '#c25e00' : '#555'}" stroke-width="${(0.3 / k).toFixed(2)}"/><text x="${(c.x0 + c.x1) / 2}" y="${(c.y0 + c.y1) / 2}" font-size="${(3.2 / k).toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-weight="700">${j + 1}</text>`).join('')}</svg>`; };
  const html = grupos.map((g, i) => { const c = todas[i], vb = [c.x0 - 3, c.y0 - 3, W * m, Hm * m];
    const L = R.L.filter((r) => g.some((t) => t.id === r.t.id)), co = L.reduce((a, r) => a + r.corte, 0), re = L.reduce((a, r) => a + r.relleno, 0), nb = L.reduce((a, r) => a + r.H.filter((h) => h.mov < -0.005).length, 0), ns = L.reduce((a, r) => a + r.H.filter((h) => h.mov > 0.005).length, 0);
    return `<section class="rmpg" data-o="P" style="width:${pw}mm;height:${ph}mm"><div class="mspdfh" style="height:20mm;box-sizing:border-box"><div><b>Movimiento de suelos · detalle punto a punto · Sector ${sec} · hoja ${i + 1} de ${grupos.length}</b><br>Escala 1:${esc} · en cada hinca: <b style="color:#b3261e">−0,00 bajar (corte)</b> · <b style="color:#1f5fa8">+0,00 subir (relleno)</b> · <i>+ entre hincas: punto de mayor espesor del tramo</i> · metros, respecto del terreno actual (${esc_(R.terr.nombre)})</div>
      <div style="display:flex;gap:4mm;align-items:flex-end">${croq(i)}<div class="mspdfk"><div><small>Corte</small><b style="color:#c0392b">${fmt(co)} m³</b></div><div><small>Relleno</small><b style="color:#1f5fa8">${fmt(re)} m³</b></div><div><small>Hincas a bajar / subir</small><b>${nb} / ${ns}</b></div><div><small>Norte</small><b>▲</b></div></div></div></div>
      <svg viewBox="${vb.map((v) => v.toFixed(2)).join(' ')}" style="display:block;width:${W}mm;height:${Hm}mm" font-family="Arial">${S0.defs}${S0.g}</svg>
      <div class="msley pr"><span><i style="background:${msColor(-1.2)}"></i>Corte</span><span><i style="background:${msColor(-0.3)}"></i></span><span><i style="background:#e3e7ec"></i>Sin movimiento</span><span><i style="background:${msColor(0.3)}"></i></span><span><i style="background:${msColor(1.2)}"></i>Relleno</span><span>Franja ${fmt(P.franja, 1)} m · curvas cada ${fmt(P.equi, 2)} m · pendiente N-S máx. ${fmt(R.pend, 1)} % · ${new Date().toLocaleDateString('es-AR')}</span></div></section>`; }).join('');
  return { html, orden: grupos.map(() => 'P') };
}
// replanteo punto a punto para topografía: hincas y puntas de la franja, con cota actual, cota de proyecto y cuánto bajar o subir
function msReplanteo(R) {
  const L = []; R.L.forEach((r) => { const x = r.xA, s = r.M[0], e = r.M[r.M.length - 1], pr = (m, nom, y) => L.push({ p: nom, t: r.t.id, x, y, z: m.z, zf: m.zf, mov: m.mov });
    const I = msInter(r).filter((q) => q !== r.M[0] && q !== r.M[r.M.length - 1]); pr(s, `${r.t.id}-N`, r.H[0].y - s.d);
    r.H.forEach((h, k) => { L.push({ p: `${r.t.id}-H${h.n}`, t: r.t.id, x: h.x, y: h.y, z: h.z, zf: h.zf, mov: h.mov }); const nx = r.H[k + 1]; I.filter((q) => q.d > h.d && (!nx || q.d < nx.d)).forEach((q, j) => pr(q, `${r.t.id}-H${h.n}${nx ? '-' + nx.n : 'S'}${I.length > 1 ? '' : ''}${j ? '.' + (j + 1) : ''}`, r.H[0].y - q.d)); });
    I.filter((q) => q.d < r.H[0].d).forEach((q) => pr(q, `${r.t.id}-N-H1`, r.H[0].y - q.d)); pr(e, `${r.t.id}-S`, r.H[0].y - e.d); });
  return L;
}
async function msReplanteoCSV(sec, pend) {
  const R = msCalc(sec, pend); if (!R) return; const r3 = (v) => (Math.round(v * 1000) / 1000).toFixed(3);
  const txt = ['Punto,Norte,Este,Cota proyecto,Descripcion'].concat(msReplanteo(R).map((q) => `${q.p},${r3(q.y)},${r3(q.x)},${r3(q.zf)},${Math.abs(q.mov) < 0.005 ? 'SIN MOV' : (q.mov < 0 ? 'BAJAR ' : 'SUBIR ') + Math.abs(q.mov).toFixed(2)}`)).join('\r\n');
  const p = await window.api.saveBinary(new TextEncoder().encode(txt), `Replanteo movimiento de suelos sector ${sec} ${today()}.csv`, 'csv', 'CSV');
  if (p) toast('Replanteo guardado: Punto, Norte, Este, Cota de proyecto y BAJAR / SUBIR en metros');
}
// ---------- superficie final de diseño (PVCase / Civil 3D): lectura, verificación contra Trina y comparación ----------
// LandXML: <P id="..">Norte Este Cota</P> (superficies TIN) y <CgPoint name="..">Norte Este Cota</CgPoint> (puntos)
function msLandXML(t) {
  const rows = [], re = /<(P|CgPoint)\b([^>]*)>([^<]+)<\/\1>/g; let m;
  while ((m = re.exec(t))) { const v = m[3].trim().split(/\s+/).map(Number); if (v.length < 3 || v.some(isNaN)) continue; const nm = (m[2].match(/(?:id|name)="([^"]*)"/) || [])[1] || ''; rows.push([nm, v[0], v[1], v[2]]); }
  if (!rows.length) throw new Error('el LandXML no tiene puntos de superficie (<P>) ni puntos (<CgPoint>)');
  return rows;
}
// ralear superficies densas a un punto por celda de 0,5 m (los relevamientos por hinca no se tocan)
function msRalear(L) {
  if (L.pts.length < 60000) return; const G = new Map(), C = 0.5;
  L.pts.forEach((p) => { const k = Math.floor(p[0] / C) + ',' + Math.floor(p[1] / C); if (!G.has(k)) G.set(k, p); });
  L.ral0 = L.pts.length; L.pts = [...G.values()]; L.todos = L.pts; L.ral = L.pts.length;
}
// verificación: con la superficie final, ¿queda cada hinca dentro de la regulación, con despeje y pendiente de Trina?
// Se vuelve a correr el cálculo sobre esa superficie: lo que todavía habría que mover es lo que le falta al diseño para cumplir.
function msVerif(sec, pend) {
  const P = msP(), fid = P.final[sec], set = msSetsF().find((x) => x.id === fid); if (!set) return null;
  const R = msCalc(sec, pend); if (!R) return null;
  const key = ['V', sec, fid, set.n, pend, JSON.stringify(Object.assign({}, P, { fuente: 0, final: 0 })), R.fuente].join('§'); MSC = MSC || new Map(); if (MSC.has(key)) return MSC.get(key);
  const TF = msTerreno(sec, fid); if (!TF || !TF.sup) return null;
  const Pv = Object.assign({}, P, { limUmb: false, prior: 'igual' }), RP = ramP(), umb = P.umbral / 1000, lat = P.anchoMod / 2000 * Math.cos(P.angMax * Math.PI / 180);
  const L = [];
  R.L.forEach((r0) => { const H = msPilas(r0.t, RP); if (!H) return; const rv = msTracker(r0.t, H, Pv, TF, pend);
    // movimiento del diseño (final − actual) en las mismas muestras de la franja
    let corte = 0, relleno = 0, n200 = 0, sinF = 0;
    rv.M.forEach((m, i) => { const e = r0.M[i]; if (!e) return; const dz = m.z - e.z; if (dz < 0) corte -= dz * m.w * P.franja; else relleno += dz * m.w * P.franja; });
    rv.H.forEach((h, k) => { if (h.fz === 'layout' || h.fz === 'interpolado') sinF++; if (Math.abs(h.z - r0.H[k].z) > umb + 0.01) n200++; });
    // despeje con la superficie final tal cual, sobre la mejor línea del tracker
    const desp = Math.min(...rv.M.map((m) => P.despNom / 1000 + (rv.a + rv.b * m.d) - m.z - lat * m.sEO));
    // tolerancia de comparación: 1 cm (las superficies exportadas se redondean e interpolan; menos de eso no se puede ejecutar en obra)
    const TV = 0.01, fuera = rv.H.filter((h) => Math.abs(h.mov) > TV).length, falta = rv.M.reduce((a, m) => a + (Math.abs(m.mov) > TV ? Math.abs(m.mov) * m.w * P.franja : 0), 0);
    L.push({ t: r0.t, r0, rv, cumple: fuera === 0 && desp >= P.despMin / 1000 - TV, fuera, falta, desp, corte, relleno, n200, sinF }); });
  // volumen del diseño en toda el área del sector (grilla de 1 m entre la superficie actual y la final)
  const bb = R.terr.bb; let cA = 0, fA = 0, aA = 0;
  if (R.terr.sup) for (let x = bb.x0 + 20; x < bb.x1 - 20; x += 1) for (let y = bb.y0 + 20; y < bb.y1 - 20; y += 1) { const ze = R.terr.sup(x, y); if (ze == null) continue; const zf = TF.sup(x, y); if (zf == null) continue; const d = zf - ze; aA++; if (d < 0) cA -= d; else fA += d; }
  const V = { sec, set, R, TF, L, nOk: L.filter((v) => v.cumple).length, fuera: L.reduce((a, v) => a + v.fuera, 0), falta: L.reduce((a, v) => a + v.falta, 0), corte: L.reduce((a, v) => a + v.corte, 0), relleno: L.reduce((a, v) => a + v.relleno, 0),
    n200: L.reduce((a, v) => a + v.n200, 0), despBajo: L.filter((v) => v.desp < P.despMin / 1000 - 0.01).length, sinF: L.reduce((a, v) => a + v.sinF, 0), corteA: cA, rellenoA: fA, areaA: aA };
  MSC.set(key, V); return V;
}
function msVerTab(b, R) {
  const P = msP(), ro = window.READONLY, F = msSetsF(), V = msVerif(R.sec, R.pend), umbT = `${P.umbral} mm`;
  const sel = `<label>Superficie final a verificar<select id="msVf" ${ro ? 'disabled' : ''}><option value="">— ninguna —</option>${F.map((x) => `<option value="${x.id}" ${P.final[R.sec] === x.id ? 'selected' : ''}>${esc(x.nombre)}${x.fecha ? ' · ' + esc(x.fecha) : ''} · ${fmt(x.n)} ptos${(x.sectores || []).includes(R.sec) ? '' : ' (no cubre el sector)'}</option>`).join('')}</select></label>`;
  if (!V) {
    b.innerHTML = `<div class="card"><h3>Verificar una superficie final de diseño</h3><div class="mstop" style="box-shadow:none;padding:0">${sel}${ro ? '' : '<button class="btn pri" id="msVi">Cargar superficie final (CSV / Excel / LandXML)</button>'}</div>
      <p>Cargá la superficie final que diseñó topografía o el proyectista (en PVCase: Grading heatmap › exportar el terreno propuesto como CSV o LandXML; en Civil 3D: exportar la superficie como LandXML o sus puntos como CSV). Al cargarla, elegí <b>"Terreno final de diseño"</b>.</p>
      <p class="muted">El programa revisa cada hinca contra Trina con esa superficie (regulación −${P.regMenos}/+${P.regMas} mm, despeje ≥ ${P.despMin} mm a ${P.angMax}°, pendiente N-S ≤ ${fmt(R.pend, 1)} %), cuenta las hincas con más de ${umbT} de movimiento y compara los volúmenes tracker por tracker con el cálculo del programa.</p></div>`;
  } else {
    const L = V.L.slice().sort((p, q) => (p.cumple - q.cumple) || q.falta - p.falta), f3 = (v) => fmt(v) + ' m³';
    b.innerHTML = `<div class="card"><div class="mstop" style="box-shadow:none;padding:0">${sel}${ro ? '' : '<button class="btn" id="msVi">Cargar otra superficie final</button>'}<span class="muted">comparada con: ${esc(R.terr.nombre)}</span></div></div>
      <div class="grid g4 stagger" style="margin:12px 0">
        <div class="card kpi"><div class="kl">Trackers que cumplen Trina</div><div class="kv" style="color:${V.nOk === V.L.length ? '#2e7d32' : '#c0392b'}">${fmt(V.nOk)}<small> / ${fmt(V.L.length)}</small></div><div class="muted">${fmt(V.fuera)} hincas fuera · faltaría mover ${f3(V.falta)}</div></div>
        <div class="card kpi"><div class="kl">Despeje &lt; ${P.despMin} mm</div><div class="kv" style="color:${V.despBajo ? '#c0392b' : '#2e7d32'}">${fmt(V.despBajo)}<small> trackers</small></div><div class="muted">con el módulo girado a ${P.angMax}°</div></div>
        <div class="card kpi"><div class="kl">Movimiento del diseño</div><div class="kv"><span style="color:#c0392b">${fmt(V.corte)}</span> / <span style="color:#1f5fa8">${fmt(V.relleno)}</span><small> m³</small></div><div class="muted">corte / relleno en las franjas · programa: ${fmt(R.corte)} / ${fmt(R.relleno)}</div></div>
        <div class="card kpi"><div class="kl">Hincas con más de ${umbT}</div><div class="kv">${fmt(V.n200)}</div><div class="muted">programa: ${fmt(R.nVal)} · en toda el área: ${fmt(V.corteA)} / ${fmt(V.rellenoA)} m³</div></div></div>
      ${V.sinF ? `<div class="card hint mswarn"><b>${fmt(V.sinF)}</b> hincas quedan fuera de la superficie final cargada (se interpolaron).</div>` : ''}
      <div class="card"><div class="tblwrap" style="max-height:600px"><table class="tbl"><thead><tr><th>Tracker</th><th>Estado</th><th class="n">Hincas fuera</th><th class="n">Faltaría mover (m³)</th><th class="n">Despeje mín.</th><th class="n">Diseño: corte</th><th class="n">Diseño: relleno</th><th class="n">Programa: corte</th><th class="n">Programa: relleno</th><th class="n">&gt; ${umbT} diseño</th><th class="n">&gt; ${umbT} programa</th></tr></thead><tbody>
        ${L.map((v) => `<tr data-t="${v.t.id}" class="clk"><td><b>${v.t.id}</b></td><td>${v.cumple ? '<span class="pill p-ok">Cumple</span>' : '<span class="pill p-bad">No cumple</span>'}</td><td class="n">${v.fuera || ''}</td><td class="n">${!v.cumple && v.falta > 0.05 ? fmt(v.falta, 1) : ''}</td>
          <td class="n" style="color:${v.desp < P.despMin / 1000 - 0.01 ? '#c0392b' : 'inherit'}">${fmt(v.desp * 1000)} mm</td><td class="n">${fmt(v.corte, 1)}</td><td class="n">${fmt(v.relleno, 1)}</td><td class="n">${fmt(v.r0.corte, 1)}</td><td class="n">${fmt(v.r0.relleno, 1)}</td><td class="n">${v.n200 || ''}</td><td class="n">${v.r0.nVal || ''}</td></tr>`).join('')}
      </tbody></table></div>
      <p class="hint">"Faltaría mover": volumen que todavía habría que cortar o rellenar sobre la superficie final para que todas las hincas del tracker queden dentro de la regulación y con despeje. Volúmenes del diseño: diferencia entre la superficie final y el terreno actual en la misma franja de ${fmt(P.franja, 1)} m que usa el programa (comparables); "en toda el área" incluye la nivelación entre filas.</p></div>`;
  }
  const s = $('#msVf', b); if (s) s.onchange = () => { const m = msP(); m.final[R.sec] = s.value; msGuardarP(m, `Movimiento de suelos: superficie final a verificar en sector ${R.sec}: ${s.selectedOptions[0].textContent}`); };
  const bi = $('#msVi', b); if (bi) bi.onclick = msImportar;
  $$('tr[data-t]', b).forEach((tr) => { tr.onclick = () => { MSUI.sel = tr.dataset.t; MSUI.tab = 'plano'; render(false); }; });
}
// exportar el terreno final del programa: puntos en el eje y los bordes de cada franja + terreno actual fuera de las franjas
async function msExportTF(sec, pend) {
  const R = msCalc(sec, pend); if (!R) return; const P = R.P, sup = R.terr.sup;
  const fmtE = await modal({ title: 'Exportar terreno final', sub: `Sector ${sec} · pendiente N-S máx. ${fmt(pend, 1)} %`,
    body: `<p>Terreno final calculado por el programa, para cargarlo en Civil 3D o PVCase como superficie de diseño: puntos en el eje y en los bordes de la franja de cada tracker (cada ${fmt(P.paso, 2)} m) y el terreno actual alrededor.</p>
      <div class="form"><label>Formato<select id="tfF"><option value="csv">CSV PNEZD (puntos, Civil 3D)</option><option value="xml">LandXML (superficie TIN)</option></select></label></div>`,
    buttons: [['Cancelar', 'btn', () => null], ['Exportar', 'btn pri', (m) => $('#tfF', m).value]] });
  if (!fmtE) return;
  const pts = [], cajas = [];
  R.L.forEach((r) => { const x0 = r.xA - P.franja / 2, x1 = r.xA + P.franja / 2; cajas.push([x0 - 0.3, x1 + 0.3, r.H[r.H.length - 1].y - P.ext - 0.3, r.H[0].y + P.ext + 0.3]);
    r.M.forEach((m) => { const y = r.H[0].y - m.d; pts.push([r.xA, y, m.zf, r.t.id + ' eje']);
      [x0, x1].forEach((x) => { const z = sup ? sup(x, y) : null; pts.push([x, y, (z != null ? z : m.z) + m.mov, r.t.id + ' borde']); }); }); });
  (R.terr.pts || []).forEach((p) => { if (!cajas.some((c) => p[0] > c[0] && p[0] < c[1] && p[1] > c[2] && p[1] < c[3])) pts.push([p[0], p[1], p[2], 'terreno actual']); });
  const f = (v) => v.toFixed(3), nombre = `Terreno final sector ${sec} ${pend} % ${today()}`;
  let txt;
  if (fmtE === 'csv') txt = 'P,N,E,Z,D\r\n' + pts.map((p, i) => `${i + 1},${f(p[1])},${f(p[0])},${f(p[2])},${p[3]}`).join('\r\n') + '\r\n';
  else {
    const d = Delaunator.from(pts, (p) => p[0], (p) => p[1]), T = d.triangles, F = [];
    for (let i = 0; i < T.length; i += 3) { const a = pts[T[i]], b = pts[T[i + 1]], c = pts[T[i + 2]]; if (Math.max(Math.hypot(a[0] - b[0], a[1] - b[1]), Math.hypot(b[0] - c[0], b[1] - c[1]), Math.hypot(c[0] - a[0], c[1] - a[1])) <= 30) F.push(`<F>${T[i] + 1} ${T[i + 1] + 1} ${T[i + 2] + 1}</F>`); }
    txt = `<?xml version="1.0" encoding="UTF-8"?>\n<LandXML xmlns="http://www.landxml.org/schema/LandXML-1.2" version="1.2" date="${today()}" time="00:00:00">\n<Units><Metric areaUnit="squareMeter" linearUnit="meter" volumeUnit="cubicMeter" temperatureUnit="celsius" pressureUnit="HPA"/></Units>\n`
      + `<Application name="PSFV-OBE II" manufacturer="Ingalfa"/>\n<Surfaces><Surface name="${esc(nombre)}" desc="Terreno final para hincado Trina (programa PSFV-OBE II)"><Definition surfType="TIN">\n<Pnts>\n`
      + pts.map((p, i) => `<P id="${i + 1}">${f(p[1])} ${f(p[0])} ${f(p[2])}</P>`).join('\n') + `\n</Pnts>\n<Faces>\n${F.join('\n')}\n</Faces>\n</Definition></Surface></Surfaces>\n</LandXML>\n`;
  }
  const p = await window.api.saveBinary(new TextEncoder().encode(txt), `${nombre}.${fmtE === 'csv' ? 'csv' : 'xml'}`, fmtE === 'csv' ? 'csv' : 'xml', fmtE === 'csv' ? 'CSV' : 'LandXML');
  if (p) toast(`Terreno final exportado (${fmt(pts.length)} puntos)`);
}
