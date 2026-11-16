/* PSFV-OBE II · Hincado · Ramming plan: cota de terreno de cada hinca (COTAS_HINCAS), cota de cabeza, altura libre y
   empotramiento con parámetros configurables, plano de hincado y programa por hincadora.
   Parámetros en S.hincado.ram (se sincronizan con el catálogo, clave 'hc'). */
const RAM_DEF = {
  revNom: 1.25,     // altura libre nominal de la cabeza de hinca sobre el terreno (m)
  revMin: 1.00,     // altura libre mínima (despeje del módulo / ajuste) (m)
  largo: 3.46,      // largo del perfil (m) si no hay código por posición
  embMin: 2.00,     // empotramiento mínimo (m) si no hay código por posición
  pendMax: 10,      // pendiente N-S máxima del tracker (%)
  difMax: 0.30,     // diferencia máxima de altura libre entre hincas vecinas (m)
  usarCodigos: true,// si la distribución por posición está completa, usar largo / altura / empotramiento de cada código
  hincadoras: 2, rend: 120, inicio: null, sabado: true, orden: '1,2,3,4,5,6', sentido: 'OE',
};
const RAMUI = { tab: 'plano', color: 'estado', sel: null, s: 'all', q: '', f: 'all' };
const ramP = () => { const H = S.hincado || (S.hincado = {}); H.ram = Object.assign({}, RAM_DEF, H.ram || {}); return H.ram; };
const ramZ = (id) => (window.COTAS_HINCAS && window.COTAS_HINCAS.z[id]) || null;

// ---------- cálculo por tracker ----------
function ramTracker(t, P) {
  const rp = repDe(t.id), zs = ramZ(t.id); if (!rp || !rp.p || !zs || zs.length !== rp.p.length) return null;
  const cods = posDe(t), conCod = P.usarCodigos && cods.length === rp.p.length && cods.every(Boolean);
  // de norte a sur (y decreciente); la distancia se mide desde la primera hinca
  const H = rp.p.map((p, i) => ({ i, x: p[0], y: p[1], z: zs[i], cod: conCod ? cods[i] : '' })).sort((a, b) => b.y - a.y);
  const y0 = H[0].y; H.forEach((h) => { h.d = y0 - h.y; const k = h.cod && hcat(h.cod);
    h.nom = k ? k.sobre / 1000 : P.revNom; h.L = k ? k.largo / 1000 : P.largo; h.emin = k ? k.mrl / 1000 : P.embMin; h.rmin = Math.min(P.revMin, h.nom); h.rmax = h.L - h.emin; });
  // recta del terreno (mínimos cuadrados) y pendiente limitada a la máxima
  const n = H.length, md = H.reduce((a, h) => a + h.d, 0) / n, mz = H.reduce((a, h) => a + h.z, 0) / n;
  const sdd = H.reduce((a, h) => a + (h.d - md) ** 2, 0) || 1, pend = H.reduce((a, h) => a + (h.d - md) * (h.z - mz), 0) / sdd;
  const lim = P.pendMax / 100, pTub = Math.max(-lim, Math.min(lim, pend));
  H.forEach((h) => { h.rec = mz + pTub * (h.d - md); h.rev0 = h.rec + h.nom - h.z; });
  // corrimiento de toda la línea de cabezas para que todas las alturas libres entren en [mín, máx]
  const lo = Math.max(...H.map((h) => h.rmin - h.rev0)), hi = Math.min(...H.map((h) => h.rmax - h.rev0));
  const factible = lo <= hi + 1e-9, sh = factible ? Math.max(lo, Math.min(hi, 0)) : (lo + hi) / 2;
  let fuera = 0, salto = 0;
  H.forEach((h, k) => { h.rev = h.rev0 + sh; h.cab = h.z + h.rev; h.emb = h.L - h.rev;
    h.est = h.rev > h.rmax + 1e-6 ? 'corto' : h.rev < h.rmin - 1e-6 ? 'alto' : 'ok'; if (h.est !== 'ok') fuera++;
    if (k && Math.abs(h.rev - H[k - 1].rev) > P.difMax + 1e-6) { h.salto = true; salto++; } });
  const revs = H.map((h) => h.rev);
  const est = fuera ? 'fuera' : Math.abs(pend) > lim + 1e-9 ? 'pend' : salto ? 'salto' : Math.abs(sh) > 0.005 ? 'ajus' : 'ok';
  return { t, H, n, pend: pend * 100, pTub: pTub * 100, sh, fuera, salto, est, conCod, ond: Math.max(...H.map((h) => h.z - h.rec)) - Math.min(...H.map((h) => h.z - h.rec)), rmin: Math.min(...revs), rmax: Math.max(...revs), zmin: Math.min(...H.map((h) => h.z)), zmax: Math.max(...H.map((h) => h.z)) };
}
const RAM_EST = { ok: ['Dentro de tolerancia', '#2f9e5b'], ajus: ['OK con línea de cabezas corrida', '#7cc49a'], salto: ['Salto de altura entre hincas vecinas', '#f0a23b'], pend: ['Pendiente N-S mayor a la máxima', '#e07b39'], fuera: ['Hincas fuera de tolerancia', '#d64545'], sin: ['Sin cotas', '#c9d0da'] };
let RAMC = null;
function ramCalc() {
  const P = ramP(), key = JSON.stringify(P) + '|' + JSON.stringify(S.hincado.matriz || {});
  if (RAMC && RAMC.key === key) return RAMC;
  const L = (window.PLANO ? window.PLANO.trk : []).map((t) => ramTracker(t, P) || { t, est: 'sin', H: [], n: 0 });
  RAMC = { key, L, map: new Map(L.map((r) => [r.t.id, r])) };
  return RAMC;
}
// programa: trackers por orden de sector y sentido, repartidos por día según hincadoras × rendimiento (sin domingos)
function ramPrograma() {
  const P = ramP(), C = ramCalc(), HA = (S.hincado || {}).avance || {};
  const ord = String(P.orden || '').split(/[,\s]+/).filter(Boolean), oi = (s) => { const k = ord.indexOf(String(s)); return k < 0 ? 99 : k; };
  const pend = C.L.filter((r) => !HA[r.t.id]).sort((a, b) => oi(a.t.s) - oi(b.t.s) || (P.sentido === 'EO' ? b.t.x - a.t.x : a.t.x - b.t.x) || a.t.y - b.t.y);
  const cap = Math.max(1, (Number(P.hincadoras) || 1) * (Number(P.rend) || 1));
  let dia = P.inicio && P.inicio > today() ? P.inicio : today(); const lab = (f) => { const w = new Date(f + 'T12:00').getDay(); return w !== 0 && (P.sabado || w !== 6); };
  while (!lab(dia)) dia = sumDias(dia, 1);
  let usado = 0, maq = 0; const plan = new Map(), dias = [];
  pend.forEach((r) => { const nh = r.n || nHincas(r.t);
    if (usado && usado + nh > cap) { dia = sumDias(dia, 1); while (!lab(dia)) dia = sumDias(dia, 1); usado = 0; }
    if (!dias.length || dias[dias.length - 1].f !== dia) dias.push({ f: dia, trk: 0, h: 0 });
    const d = dias[dias.length - 1]; d.trk++; d.h += nh; maq = Math.floor(usado / (Number(P.rend) || 1)) % (Number(P.hincadoras) || 1);
    plan.set(r.t.id, { f: dia, maq: maq + 1 }); usado += nh; });
  return { plan, dias, fin: dias.length ? dias[dias.length - 1].f : null, cap, nPend: pend.length };
}

// ---------- vista ----------
function vRam(el) {
  const P = ramP(), C = ramCalc(), HA = (S.hincado || {}).avance || {};
  if (!window.COTAS_HINCAS) { el.innerHTML = '<div class="card empty"><b>Faltan las cotas de las hincas</b></div>'; return; }
  actions([['Plano DXF (AutoCAD)', 'btn pri', ramExportDxf], ['Exportar Excel', 'btn', ramExcel], ['PDF por sector', 'btn', ramPdf]]);
  const cnt = {}; C.L.forEach((r) => (cnt[r.est] = (cnt[r.est] || 0) + 1));
  const hF = C.L.reduce((a, r) => a + (r.fuera || 0), 0), nH = C.L.reduce((a, r) => a + r.n, 0);
  const PG = ramPrograma();
  el.innerHTML = `<div class="grid g4 stagger" style="margin-bottom:12px">
      <div class="card kpi"><div class="kl">Trackers dentro de tolerancia</div><div class="kv">${fmt((cnt.ok || 0) + (cnt.ajus || 0))}<small> / ${fmt(C.L.length)}</small></div><div class="muted">${fmt(cnt.ajus || 0)} con la línea de cabezas corrida</div></div>
      <div class="card kpi"><div class="kl">Para revisar</div><div class="kv" style="color:${(cnt.fuera || 0) + (cnt.pend || 0) ? '#d64545' : 'inherit'}">${fmt((cnt.fuera || 0) + (cnt.pend || 0) + (cnt.salto || 0))}</div><div class="muted">${fmt(cnt.fuera || 0)} con hincas fuera (${fmt(hF)} hincas) · ${fmt(cnt.pend || 0)} por pendiente · ${fmt(cnt.salto || 0)} por saltos</div></div>
      <div class="card kpi"><div class="kl">Hincas con cota</div><div class="kv">${fmt(nH)}</div><div class="muted">terreno ${fmt(Math.min(...C.L.filter((r) => r.n).map((r) => r.zmin)), 1)} a ${fmt(Math.max(...C.L.filter((r) => r.n).map((r) => r.zmax)), 1)} m</div></div>
      <div class="card kpi"><div class="kl">Fin de hincado estimado</div><div class="kv" style="font-size:22px">${PG.fin ? fechaCorta(PG.fin) : '—'}</div><div class="muted">${fmt(PG.nPend)} trackers pendientes · ${fmt(PG.dias.length)} jornadas · ${fmt(PG.cap)} hincas/día</div></div></div>
    <div class="seg rmtabs" id="rmT"><button data-v="plano">🗺️ Plano de hincado</button><button data-v="trk">📋 Trackers</button><button data-v="prog">📅 Programa</button><button data-v="par">⚙️ Parámetros</button></div>
    <div id="rmB" style="margin-top:12px"></div>`;
  segBind('#rmT', RAMUI.tab, (v) => { RAMUI.tab = v; render(false); });
  const b = $('#rmB', el);
  ({ plano: ramPlano, trk: ramTabla, prog: ramProg, par: ramPar })[RAMUI.tab](b, C, PG);
}
function ramColor(r, PG, HA) {
  const m = RAMUI.color;
  if (m === 'hinc') return HA[r.t.id] ? '#7c5cbf' : '#c9d0da';
  if (m === 'pend') { if (!r.n) return '#c9d0da'; const a = Math.min(1, Math.abs(r.pend) / Math.max(1, ramP().pendMax)); return `hsl(${130 - 130 * a},60%,${55 - 10 * a}%)`; }
  if (m === 'ond') { if (!r.n) return '#c9d0da'; const a = Math.min(1, r.ond / 1); return `hsl(${130 - 130 * a},60%,${55 - 10 * a}%)`; }
  if (m === 'prog') { if (HA[r.t.id]) return '#7c5cbf'; const p = PG.plan.get(r.t.id); if (!p) return '#c9d0da'; const sem = Math.floor((new Date(p.f) - new Date(today())) / 6048e5); return ['#2f9e5b', '#7cc49a', '#f0d35b', '#f0a23b', '#e07b39'][Math.min(4, Math.max(0, sem))]; }
  return (RAM_EST[r.est] || RAM_EST.sin)[1];
}
function ramPlano(b, C, PG) {
  const P = window.PLANO, HA = (S.hincado || {}).avance || {};
  const leg = RAMUI.color === 'estado' ? Object.entries(RAM_EST).map(([k, [n, c]]) => `<span><i style="background:${c}"></i>${n}</span>`).join('')
    : RAMUI.color === 'prog' ? '<span><i style="background:#7c5cbf"></i>Hincado</span><span><i style="background:#2f9e5b"></i>Esta semana</span><span><i style="background:#7cc49a"></i>Próxima</span><span><i style="background:#f0d35b"></i>En 2 semanas</span><span><i style="background:#f0a23b"></i>En 3</span><span><i style="background:#e07b39"></i>4 o más</span>'
    : RAMUI.color === 'hinc' ? '<span><i style="background:#7c5cbf"></i>Hincado</span><span><i style="background:#c9d0da"></i>Pendiente</span>'
    : `<span><i style="background:hsl(130,60%,55%)"></i>${RAMUI.color === 'pend' ? 'Plano' : 'Parejo'}</span><span><i style="background:hsl(65,60%,50%)"></i>Medio</span><span><i style="background:hsl(0,60%,45%)"></i>${RAMUI.color === 'pend' ? 'En la pendiente máxima' : '1 m o más de ondulación'}</span>`;
  const sel = RAMUI.sel && C.map.get(RAMUI.sel);
  b.innerHTML = `<div class="rmgrid"><div class="card rmplano"><div class="tools" style="margin:0 0 8px"><div class="seg" id="rmC"><button data-v="estado">Estado</button><button data-v="pend">Pendiente</button><button data-v="ond">Ondulación</button><button data-v="prog">Programa</button><button data-v="hinc">Avance</button></div></div>
      <div class="rmwrap"><svg viewBox="${ramVB().join(' ')}" class="rmsvg ${ramZcls()}" preserveAspectRatio="xMidYMid meet">${P.trk.map((t) => { const r = C.map.get(t.id); return `<rect data-t="${t.id}" x="${t.x}" y="${t.y}" width="${t.w}" height="${t.h}" fill="${ramColor(r, PG, HA)}" class="${RAMUI.sel === t.id ? 'on' : ''}"><title>${t.id} · ${(RAM_EST[r.est] || RAM_EST.sin)[0]}${r.n ? ` · pendiente ${fmt(r.pend, 1)} % · ondulación ${fmt(r.ond, 2)} m` : ''}</title></rect>`; }).join('')}
        <g class="rmz1">${P.trk.map((t) => `<text x="${t.x + t.w / 2}" y="${t.y - 0.8}" class="rmtid">${t.id.replace('TRK-', '')}</text>`).join('')}</g>
        <g class="rmz1">${ramHincasSVG(C, HA)}</g></svg>
        <div class="rmzb"><button class="btn sm" data-z="in" title="Acercar">＋</button><button class="btn sm" data-z="out" title="Alejar">－</button><button class="btn sm" data-z="fit" title="Ver todo el parque">⤢</button>${RAMUI.sel ? '<button class="btn sm" data-z="sel" title="Ir al tracker elegido">◎</button>' : ''}</div></div>
      <div class="legend rmleg">${leg}</div><p class="hint" style="margin:6px 0 0">Rueda del mouse o ＋/－ para hacer zoom, arrastrá para moverte. Al acercarte aparecen el número de tracker y cada hinca con su color; más cerca, el número y la altura libre de cada hinca. Tocá un tracker para ver su perfil.</p></div>
    <div class="card rmdet">${sel ? ramDetalle(sel, PG) : '<div class="empty" style="padding:30px 10px"><b>Elegí un tracker en el plano</b><p class="muted">Vas a ver el perfil del terreno, la línea de cabezas y la altura libre y el empotramiento de cada hinca.</p></div>'}</div></div>`;
  segBind('#rmC', RAMUI.color, (v) => { RAMUI.color = v; render(false); });
  ramZoomBind(b);
}
// ---------- zoom del plano ----------
const ramVB = () => { const P = window.PLANO; return RAMUI.vb || [0, 0, P.W, P.H]; };
const ramZcls = () => { const w = ramVB()[2], W = window.PLANO.W; return w < W / 14 ? 'z1 z2' : w < W / 4 ? 'z1' : ''; };
// hincas en coordenadas del plano: X real − origen; Y real ubicada dentro del rectángulo de su tracker (norte arriba)
function ramHincasSVG(C, HA) {
  const X0 = 7393788.009;
  return window.PLANO.trk.map((t) => { const r = C.map.get(t.id); if (!r || !r.n) return '';
    const ys = r.H.map((h) => h.y), yN = Math.max(...ys), off = (t.h - (yN - Math.min(...ys))) / 2, hecho = !!HA[t.id];
    return r.H.map((h, k) => { const x = h.x - X0, y = t.y + off + (yN - h.y), c = hecho ? '#7c5cbf' : h.est !== 'ok' ? '#d64545' : h.salto ? '#f0a23b' : '#1f7a46';
      return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="0.42" fill="${c}" class="rmh"><title>${t.id} · hinca ${k + 1} · terreno ${fmt(h.z, 2)} m · altura libre ${fmt(h.rev, 2)} m · empotramiento ${fmt(h.emb, 2)} m${h.cod ? ' · ' + h.cod : ''}</title></circle><text x="${(x + 0.7).toFixed(2)}" y="${(y + 0.25).toFixed(2)}" class="rmhl">${k + 1}·${h.rev.toFixed(2)}</text>`; }).join(''); }).join('');
}
function ramZoomBind(b) {
  const svg = $('.rmsvg', b); if (!svg) return; const P = window.PLANO;
  const set = (vb) => { const minW = 12, maxW = P.W * 1.2; const k = Math.max(minW, Math.min(maxW, vb[2])) / vb[2];
    const cx = vb[0] + vb[2] / 2, cy = vb[1] + vb[3] / 2, w = vb[2] * k, h = vb[3] * k; RAMUI.vb = [cx - w / 2, cy - h / 2, w, h];
    svg.setAttribute('viewBox', RAMUI.vb.join(' ')); svg.setAttribute('class', 'rmsvg ' + ramZcls()); };
  const pt = (e) => { const r = svg.getBoundingClientRect(), vb = ramVB(), s = Math.max(vb[2] / r.width, vb[3] / r.height);
    return [vb[0] + vb[2] / 2 + (e.clientX - r.left - r.width / 2) * s, vb[1] + vb[3] / 2 + (e.clientY - r.top - r.height / 2) * s, s]; };
  const zoom = (f, cx, cy) => { const vb = ramVB(); if (cx == null) { cx = vb[0] + vb[2] / 2; cy = vb[1] + vb[3] / 2; }
    set([cx - (cx - vb[0]) * f, cy - (cy - vb[1]) * f, vb[2] * f, vb[3] * f]); };
  svg.addEventListener('wheel', (e) => { e.preventDefault(); const [x, y] = pt(e); zoom(e.deltaY > 0 ? 1.25 : 0.8, x, y); }, { passive: false });
  let drag = null, movido = false;
  svg.addEventListener('mousedown', (e) => { if (e.button) return; drag = { x: e.clientX, y: e.clientY, vb: ramVB().slice(), s: pt(e)[2] }; movido = false; });
  window.addEventListener('mousemove', (e) => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 4) movido = true;
    if (movido) { const v = drag.vb; RAMUI.vb = [v[0] - dx * drag.s, v[1] - dy * drag.s, v[2], v[3]]; svg.setAttribute('viewBox', RAMUI.vb.join(' ')); svg.classList.add('arr'); } });
  window.addEventListener('mouseup', () => { if (drag) { drag = null; svg.classList.remove('arr'); } });
  svg.addEventListener('click', (e) => { if (movido) { movido = false; return; } const t = e.target.closest('[data-t]');
    const id = t ? t.dataset.t : ramTrkEn(e); if (id) { RAMUI.sel = id; render(false); } });
  svg.addEventListener('dblclick', (e) => { const [x, y] = pt(e); zoom(0.5, x, y); });
  $$('[data-z]', b).forEach((bt) => { bt.onclick = () => { const z = bt.dataset.z;
    if (z === 'in') zoom(0.6); else if (z === 'out') zoom(1.6); else if (z === 'fit') { RAMUI.vb = null; set([0, 0, P.W, P.H]); }
    else if (z === 'sel') { const t = P.trk.find((x) => x.id === RAMUI.sel); if (t) set([t.x + t.w / 2 - 45, t.y + t.h / 2 - 35, 60, 70]); } }; });
}
// tracker bajo una hinca clickeada: el rectángulo que la contiene
function ramTrkEn(e) { const els = document.elementsFromPoint(e.clientX, e.clientY); const r = els.find((x) => x.dataset && x.dataset.t); return r ? r.dataset.t : null; }
function ramPerfilSVG(r) {
  const H = r.H; if (!H.length) return '';
  const W = 520, Hh = 180, pad = 28, dMax = H[H.length - 1].d || 1;
  const zs = H.flatMap((h) => [h.z, h.cab]), z0 = Math.min(...zs) - 0.2, z1 = Math.max(...zs) + 0.2;
  const X = (d) => pad + (d / dMax) * (W - pad * 2), Y = (z) => Hh - pad - ((z - z0) / (z1 - z0)) * (Hh - pad * 1.6);
  const terr = H.map((h) => `${X(h.d).toFixed(1)},${Y(h.z).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${W} ${Hh}" class="rmperf"><polyline points="${pad},${Hh - pad + 6} ${terr} ${W - pad},${Hh - pad + 6}" fill="#efe6d6" stroke="#a0855b" stroke-width="1.5"/>
    <line x1="${X(0)}" y1="${Y(H[0].cab)}" x2="${X(dMax)}" y2="${Y(H[H.length - 1].cab)}" stroke="#1f4e5a" stroke-width="2.5"/>
    ${H.map((h) => `<line x1="${X(h.d)}" y1="${Y(h.z)}" x2="${X(h.d)}" y2="${Y(h.cab)}" stroke="${h.est === 'ok' ? (h.salto ? '#f0a23b' : '#2f9e5b') : '#d64545'}" stroke-width="3"/><circle cx="${X(h.d)}" cy="${Y(h.cab)}" r="2.6" fill="#1f4e5a"/>`).join('')}
    <text x="${pad}" y="13" font-size="10" fill="#6b7785">N · ${fmt(H[0].z, 2)} m</text><text x="${W - pad}" y="13" font-size="10" fill="#6b7785" text-anchor="end">S · ${fmt(H[H.length - 1].z, 2)} m</text>
    <text x="${W / 2}" y="${Hh - 6}" font-size="10" fill="#6b7785" text-anchor="middle">${fmt(dMax, 1)} m · terreno (marrón), cabezas (azul), altura libre por hinca</text></svg>`;
}
function ramDetalle(r, PG) {
  const HA = (S.hincado || {}).avance || {}, p = PG.plan.get(r.t.id), e = RAM_EST[r.est] || RAM_EST.sin;
  if (!r.n) return `<h3>${r.t.id}</h3><p class="muted">Este tracker no tiene coordenadas en la lista de replanteo.</p>`;
  return `<div class="rmdh"><h3>${r.t.id} <span class="muted" style="font-weight:400">· frame ${esc(repDe(r.t.id).fr)} · S${r.t.s} · ${r.t.t}</span></h3><span class="pill" style="background:${e[1]}22;color:${e[1]}">${e[0]}</span></div>
    <div class="rmkv"><span>Pendiente del terreno <b>${fmt(r.pend, 1)} %</b>${Math.abs(r.pTub - r.pend) > 0.05 ? ` → tubo ${fmt(r.pTub, 1)} %` : ''}</span><span>Ondulación <b>${fmt(r.ond, 2)} m</b></span><span>Altura libre <b>${fmt(r.rmin, 2)}–${fmt(r.rmax, 2)} m</b></span>${Math.abs(r.sh) > 0.005 ? `<span>Línea de cabezas corrida <b>${r.sh > 0 ? '+' : ''}${fmt(r.sh, 2)} m</b></span>` : ''}
      <span>${HA[r.t.id] ? `Hincado el <b>${fechaCorta(HA[r.t.id].f)}</b>` : p ? `Programado <b>${fechaCorta(p.f)}</b> · hincadora ${p.maq}` : ''}</span></div>
    ${ramPerfilSVG(r)}
    <div class="tblwrap" style="max-height:300px"><table class="tbl rmtb"><thead><tr><th>#</th><th class="n">Dist. (m)</th><th class="n">Terreno (m)</th><th class="n">Cabeza (m)</th><th class="n">Altura libre (m)</th><th class="n">Empotr. (m)</th>${r.conCod ? '<th>Código</th>' : ''}<th></th></tr></thead><tbody>
    ${r.H.map((h, k) => `<tr class="${h.est !== 'ok' ? 'bad' : h.salto ? 'warn' : ''}"><td>${k + 1}</td><td class="n">${fmt(h.d, 2)}</td><td class="n">${fmt(h.z, 3)}</td><td class="n">${fmt(h.cab, 3)}</td><td class="n"><b>${fmt(h.rev, 3)}</b></td><td class="n">${fmt(h.emb, 2)}</td>${r.conCod ? `<td>${chipH(h.cod, true)}</td>` : ''}<td>${h.est === 'corto' ? '<span class="tneg">perfil corto</span>' : h.est === 'alto' ? '<span class="tneg">terreno alto</span>' : h.salto ? '<span style="color:#b7791f">salto</span>' : '✓'}</td></tr>`).join('')}</tbody></table></div>
    <p class="hint">Hincas de norte a sur. La cabeza sigue una recta (el tubo de torsión). <b>Perfil corto</b>: el terreno está tan bajo que el perfil no llega al empotramiento mínimo. <b>Terreno alto</b>: la altura libre queda por debajo de la mínima.</p>`;
}
function ramTabla(b, C, PG) {
  const HA = (S.hincado || {}).avance || {};
  let L = C.L.slice(); if (RAMUI.s !== 'all') L = L.filter((r) => r.t.s === RAMUI.s);
  if (RAMUI.f !== 'all') L = L.filter((r) => (RAMUI.f === 'rev' ? ['fuera', 'pend', 'salto'].includes(r.est) : r.est === RAMUI.f));
  if (RAMUI.q) { const q = RAMUI.q.toUpperCase(); L = L.filter((r) => r.t.id.includes(q)); }
  L.sort((a, b) => ['fuera', 'pend', 'salto', 'ajus', 'ok', 'sin'].indexOf(a.est) - ['fuera', 'pend', 'salto', 'ajus', 'ok', 'sin'].indexOf(b.est) || b.ond - a.ond);
  const secs = [...new Set(C.L.map((r) => r.t.s))].sort();
  b.innerHTML = `<div class="tools"><div class="seg" id="rmS"><button data-v="all">Todos</button>${secs.map((s) => `<button data-v="${s}">S${s}</button>`).join('')}</div>
      <div class="seg" id="rmF"><button data-v="all">Todos</button><button data-v="rev">Para revisar</button><button data-v="ok">OK</button></div><span class="sp"></span><span class="muted">${L.length} trackers</span><input type="search" id="rmQ" placeholder="TRK-…" value="${esc(RAMUI.q)}" style="width:120px"></div>
    <div class="tblwrap" style="max-height:calc(100vh - 360px)"><table class="tbl"><thead><tr><th>Tracker</th><th>Sector</th><th>Tipo</th><th>Estado</th><th class="n">Pendiente N-S</th><th class="n">Ondulación</th><th class="n">Altura libre</th><th class="n">Hincas fuera</th><th>Hincado / programado</th></tr></thead><tbody>
    ${L.map((r) => { const e = RAM_EST[r.est] || RAM_EST.sin, p = PG.plan.get(r.t.id); return `<tr data-t="${r.t.id}" style="cursor:pointer"><td><b>${r.t.id}</b></td><td>S${r.t.s}</td><td>${r.t.t}</td><td><i class="cdot" style="background:${e[1]}"></i>${e[0]}</td>
      <td class="n">${r.n ? fmt(r.pend, 1) + ' %' : ''}</td><td class="n">${r.n ? fmt(r.ond, 2) + ' m' : ''}</td><td class="n">${r.n ? `${fmt(r.rmin, 2)}–${fmt(r.rmax, 2)} m` : ''}</td><td class="n">${r.fuera ? `<span class="tneg">${r.fuera}</span>` : ''}</td>
      <td>${HA[r.t.id] ? `<span class="tpos">✓ ${fechaCorta(HA[r.t.id].f)}</span>` : p ? `${fechaCorta(p.f)} · H${p.maq}` : ''}</td></tr>`; }).join('')}</tbody></table></div>`;
  segBind('#rmS', RAMUI.s, (v) => { RAMUI.s = v; render(false); }); segBind('#rmF', RAMUI.f, (v) => { RAMUI.f = v; render(false); });
  const q = $('#rmQ', b); q.oninput = () => { RAMUI.q = q.value.trim(); clearTimeout(q._t); q._t = setTimeout(() => render(false), 300); };
  $$('tr[data-t]', b).forEach((tr) => { tr.onclick = () => { RAMUI.sel = tr.dataset.t; RAMUI.tab = 'plano'; const t = window.PLANO.trk.find((x) => x.id === tr.dataset.t); if (t) RAMUI.vb = [t.x + t.w / 2 - 45, t.y + t.h / 2 - 35, 60, 70]; render(false); }; });
}
function ramProg(b, C, PG) {
  const P = ramP(), HA = (S.hincado || {}).avance || {};
  const hechos = Object.keys(HA).length, porDia = {}; Object.values(HA).forEach((a) => { if (a && a.f) porDia[a.f] = (porDia[a.f] || 0) + 1; });
  const maxH = Math.max(1, ...PG.dias.map((d) => d.h));
  b.innerHTML = `<div class="card"><h3>Programa de hincado</h3><p class="muted" style="margin-top:0">${fmt(P.hincadoras)} hincadora${P.hincadoras == 1 ? '' : 's'} × ${fmt(P.rend)} hincas por día · desde ${fechaCorta(P.inicio && P.inicio > today() ? P.inicio : today())} · ${P.sabado ? 'lunes a sábado' : 'lunes a viernes'} · sectores en orden ${esc(P.orden)} · ${P.sentido === 'EO' ? 'de este a oeste' : 'de oeste a este'}. Hincados: ${fmt(hechos)} trackers. Cambiá todo esto en <b>Parámetros</b>.</p>
    <div class="rmdias">${PG.dias.slice(0, 120).map((d) => `<div class="rmd" title="${fechaCorta(d.f)} · ${d.trk} trackers · ${fmt(d.h)} hincas"><div style="height:${(d.h / maxH) * 100}%"></div><small>${fechaCorta(d.f).slice(0, 5)}</small></div>`).join('')}</div>
    ${PG.dias.length > 120 ? `<p class="hint">Se muestran las primeras 120 jornadas de ${PG.dias.length}.</p>` : ''}</div>
    <div class="card" style="margin-top:12px"><h3>Por semana</h3><div class="tblwrap"><table class="tbl"><thead><tr><th>Semana del</th><th class="n">Jornadas</th><th class="n">Trackers</th><th class="n">Hincas</th></tr></thead><tbody>
    ${(() => { const W = new Map(); PG.dias.forEach((d) => { const dt = new Date(d.f + 'T12:00'), lun = sumDias(d.f, -((dt.getDay() + 6) % 7)); const w = W.get(lun) || { j: 0, t: 0, h: 0 }; w.j++; w.t += d.trk; w.h += d.h; W.set(lun, w); }); return [...W.entries()].map(([f, w]) => `<tr><td>${fechaCorta(f)}</td><td class="n">${w.j}</td><td class="n">${fmt(w.t)}</td><td class="n">${fmt(w.h)}</td></tr>`).join(''); })()}</tbody></table></div></div>`;
}
function ramPar(b) {
  const P = ramP(), ro = window.READONLY, cods = Object.keys(S.hincado.matriz || {}).every((k) => matrizOk(k));
  const f = (k, lbl, u, st, help) => `<label title="${esc(help || '')}">${lbl}<span class="rmin"><input type="number" step="${st}" data-k="${k}" value="${P[k]}" ${ro ? 'disabled' : ''}><em>${u}</em></span>${help ? `<small class="muted">${help}</small>` : ''}</label>`;
  b.innerHTML = `<div class="grid g2"><div class="card"><h3>Geometría y tolerancias</h3><div class="form rmform">
      ${f('revNom', 'Altura libre nominal de la cabeza', 'm', '0.01', 'Altura de la cabeza de hinca sobre el terreno en condición nominal.')}
      ${f('revMin', 'Altura libre mínima', 'm', '0.01', 'Por debajo de esto el terreno está muy alto (despeje del módulo / ajuste de la cabeza).')}
      ${f('largo', 'Largo del perfil', 'm', '0.005', 'Se usa cuando no hay código de hinca por posición.')}
      ${f('embMin', 'Empotramiento mínimo', 'm', '0.05', 'Del estudio geotécnico / Trina. Altura libre máxima = largo − empotramiento mínimo.')}
      ${f('pendMax', 'Pendiente N-S máxima del tracker', '%', '0.5', 'Si el terreno tiene más, el tubo se limita a esta pendiente y el tracker queda para revisar.')}
      ${f('difMax', 'Salto máximo de altura libre entre hincas vecinas', 'm', '0.05', 'Se marca como aviso.')}
      <label class="rmchk"><input type="checkbox" data-k="usarCodigos" ${P.usarCodigos ? 'checked' : ''} ${ro ? 'disabled' : ''} style="width:auto"><span>Usar largo, altura y empotramiento de cada código de hinca${cods ? '' : '<small class="muted">La distribución por posición todavía no está completa en Catálogo y distribución: mientras tanto se usan los valores de arriba.</small>'}</span></label></div></div>
    <div class="card"><h3>Programa</h3><div class="form rmform">
      ${f('hincadoras', 'Hincadoras trabajando', '', '1')}
      ${f('rend', 'Rendimiento por hincadora', 'hincas/día', '5')}
      <label>Fecha de inicio<span class="rmin"><input type="date" data-k="inicio" value="${P.inicio || ''}" ${ro ? 'disabled' : ''}></span><small class="muted">Vacía: desde hoy.</small></label>
      <label>Orden de los sectores<span class="rmin"><input type="text" data-k="orden" value="${esc(P.orden)}" ${ro ? 'disabled' : ''}></span><small class="muted">Ej.: 3,4,1,2,5,6</small></label>
      <label>Sentido de avance<select data-k="sentido" ${ro ? 'disabled' : ''}><option value="OE" ${P.sentido !== 'EO' ? 'selected' : ''}>De oeste a este</option><option value="EO" ${P.sentido === 'EO' ? 'selected' : ''}>De este a oeste</option></select></label>
      <label class="rmchk"><input type="checkbox" data-k="sabado" ${P.sabado ? 'checked' : ''} ${ro ? 'disabled' : ''} style="width:auto"><span>Se trabaja los sábados</span></label></div>
      <p class="hint">Cotas de terreno: ${esc((window.COTAS_HINCAS || {}).fuente || '')}. Coordenadas: lista de replanteo OBEII-CI-LI-211 r3.</p>
      ${ro ? '' : '<button class="btn" id="rmRes">Volver a los valores por defecto</button>'}</div></div>
    <p class="hint">Los valores por defecto son de referencia: confirmalos con el manual de instalación de Trina (Vanguard 1P) y el estudio geotécnico. Todo se recalcula al cambiar un valor.</p>`;
  $$('[data-k]', b).forEach((i) => { i.onchange = () => { const k = i.dataset.k, H = S.hincado; H.ram = Object.assign({}, ramP());
    H.ram[k] = i.type === 'checkbox' ? i.checked : i.type === 'number' ? Number(i.value) : i.value || null; RAMC = null; commit(`Ramming plan: ${k} = ${H.ram[k]}`); }; });
  const rs = $('#rmRes', b); if (rs) rs.onclick = () => { S.hincado.ram = Object.assign({}, RAM_DEF); RAMC = null; commit('Ramming plan: parámetros por defecto'); };
}
async function ramExcel() {
  const C = ramCalc(), PG = ramPrograma(), P = ramP(), HA = (S.hincado || {}).avance || {};
  const a = [['Tracker', 'Frame', 'Sector', 'Tipo', 'Hinca (N→S)', 'X', 'Y', 'Terreno (m)', 'Cabeza (m)', 'Altura libre (m)', 'Empotramiento (m)', 'Código', 'Estado']];
  C.L.forEach((r) => r.H.forEach((h, k) => a.push([r.t.id, repDe(r.t.id).fr, r.t.s, r.t.t, k + 1, h.x, h.y, +h.z.toFixed(3), +h.cab.toFixed(3), +h.rev.toFixed(3), +h.emb.toFixed(3), h.cod || '', h.est === 'ok' ? (h.salto ? 'salto' : 'ok') : h.est === 'corto' ? 'perfil corto' : 'terreno alto'])));
  const t = [['Tracker', 'Sector', 'Tipo', 'Estado', 'Pendiente terreno (%)', 'Pendiente tubo (%)', 'Ondulación (m)', 'Altura libre mín (m)', 'Altura libre máx (m)', 'Corrimiento línea (m)', 'Hincas fuera', 'Hincado', 'Programado', 'Hincadora']];
  C.L.forEach((r) => { const p = PG.plan.get(r.t.id); t.push([r.t.id, r.t.s, r.t.t, (RAM_EST[r.est] || RAM_EST.sin)[0], r.n ? +r.pend.toFixed(2) : '', r.n ? +r.pTub.toFixed(2) : '', r.n ? +r.ond.toFixed(3) : '', r.n ? +r.rmin.toFixed(3) : '', r.n ? +r.rmax.toFixed(3) : '', r.n ? +r.sh.toFixed(3) : '', r.fuera || 0, HA[r.t.id] ? HA[r.t.id].f : '', p ? p.f : '', p ? p.maq : '']); });
  const par = [['Parámetro', 'Valor']].concat(Object.entries(P).map(([k, v]) => [k, v]));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(t), 'Por tracker'); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(a), 'Por hinca'); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(par), 'Parámetros');
  const p = await window.api.saveBinary(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }), `Ramming plan ${today()}.xlsx`, 'xlsx', 'Excel');
  if (p) toast('Excel exportado', { action: ['Abrir', () => window.api.openPath(p)] });
}
function ramPdf() {
  const C = ramCalc(), PG = ramPrograma(), HA = (S.hincado || {}).avance || {};
  const secs = [...new Set(C.L.map((r) => r.t.s))].sort().filter((s) => RAMUI.s === 'all' || s === RAMUI.s);
  let h = prHead('Ramming plan · plan de hincado', 'Altura libre y empotramiento por hinca, de norte a sur');
  secs.forEach((s) => {
    h += `<h2 style="page-break-before:always">Sector ${s}</h2>`;
    C.L.filter((r) => r.t.s === s && r.n && !HA[r.t.id]).sort((a, b) => a.t.x - b.t.x).forEach((r) => { const p = PG.plan.get(r.t.id);
      h += `<div style="break-inside:avoid;margin:6px 0"><b>${r.t.id}</b> · ${r.t.t} · ${(RAM_EST[r.est] || RAM_EST.sin)[0]}${p ? ` · programado ${fechaCorta(p.f)} (H${p.maq})` : ''}
      <table class="tbl" style="font-size:8.5pt"><tr><th>Hinca</th>${r.H.map((x, k) => `<th>${k + 1}</th>`).join('')}</tr><tr><td>Altura libre (m)</td>${r.H.map((x) => `<td${x.est !== 'ok' ? ' style="color:#c00;font-weight:700"' : ''}>${fmt(x.rev, 2)}</td>`).join('')}</tr><tr><td>Cabeza (m)</td>${r.H.map((x) => `<td>${fmt(x.cab, 2)}</td>`).join('')}</tr></table></div>`; });
  });
  printHTML(h, `Ramming plan ${today()}.pdf`, true);
}

// ---------- DXF (R12, abre en AutoCAD y se guarda como DWG). Coordenadas reales del replanteo: se superpone al layout ----------
const RAM_ACI = { Rojo: 1, Azul: 5, Verde: 3, Violeta: 200, Magenta: 6, Negro: 250, Gris: 8, Blanco: 7, 'Sin marca': 9 };
function ramDxf() {
  const C = ramCalc(), HA = (S.hincado || {}).avance || {}, P = ramP(), o = [];
  const g = (...kv) => { for (let i = 0; i < kv.length; i += 2) o.push(String(kv[i]), String(kv[i + 1])); };
  const num = (v) => (Math.round(v * 1000) / 1000).toFixed(3);
  const lay = new Map([['RAM-TRACKER', 8], ['RAM-TRACKER-ID', 7], ['RAM-ALTURA-LIBRE', 4], ['RAM-FUERA', 1], ['RAM-SALTO', 30], ['RAM-HINCADO', 200],
    ['HINCA-OK', 3], ['HINCA-FUERA', 1], ['HINCA-SALTO', 30], ['HINCA-SIN-CODIGO', 9]]);
  C.L.forEach((r) => r.H.forEach((h) => { const k = h.cod && hcat(h.cod); if (k) lay.set('HINCA-' + String(k.color || 'SIN-COLOR').toUpperCase().replace(/[^A-Z0-9]+/g, '-'), RAM_ACI[k.color] || 7); }));
  // extensión del dibujo, para que AutoCAD abra centrado en el parque y no en el origen
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  C.L.forEach((r) => r.H.forEach((h) => { x0 = Math.min(x0, h.x); y0 = Math.min(y0, h.y); x1 = Math.max(x1, h.x); y1 = Math.max(y1, h.y); }));
  x0 -= 20; y0 -= 20; x1 += 20; y1 += 20;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, alto = Math.max(y1 - y0, (x1 - x0) / 1.6) * 1.05;
  g(0, 'SECTION', 2, 'HEADER', 9, '$ACADVER', 1, 'AC1009', 9, '$DWGCODEPAGE', 3, 'ANSI_1252', 9, '$INSBASE', 10, 0, 20, 0, 30, 0,
    9, '$EXTMIN', 10, num(x0), 20, num(y0), 30, 0, 9, '$EXTMAX', 10, num(x1), 20, num(y1), 30, 0,
    9, '$LIMMIN', 10, num(x0), 20, num(y0), 9, '$LIMMAX', 10, num(x1), 20, num(y1), 9, '$TEXTSTYLE', 7, 'STANDARD', 9, '$CLAYER', 8, '0', 0, 'ENDSEC');
  g(0, 'SECTION', 2, 'TABLES');
  g(0, 'TABLE', 2, 'VPORT', 70, 1, 0, 'VPORT', 2, '*ACTIVE', 70, 0, 10, 0, 20, 0, 11, 1, 21, 1, 12, num(cx), 22, num(cy), 13, 0, 23, 0, 14, 1, 24, 1, 15, 0, 25, 0,
    16, 0, 26, 0, 36, 1, 17, 0, 27, 0, 37, 0, 40, num(alto), 41, 1.6, 42, 50, 43, 0, 44, 0, 50, 0, 51, 0, 71, 0, 72, 1000, 73, 1, 74, 3, 75, 0, 76, 0, 77, 0, 78, 0, 0, 'ENDTAB');
  g(0, 'TABLE', 2, 'LTYPE', 70, 1, 0, 'LTYPE', 2, 'CONTINUOUS', 70, 0, 3, 'Solid line', 72, 65, 73, 0, 40, 0, 0, 'ENDTAB');
  g(0, 'TABLE', 2, 'LAYER', 70, lay.size + 1, 0, 'LAYER', 2, '0', 70, 0, 62, 7, 6, 'CONTINUOUS');
  lay.forEach((c, n) => g(0, 'LAYER', 2, n, 70, 0, 62, c, 6, 'CONTINUOUS')); g(0, 'ENDTAB');
  g(0, 'TABLE', 2, 'STYLE', 70, 1, 0, 'STYLE', 2, 'STANDARD', 70, 0, 40, 0, 41, 1, 50, 0, 71, 0, 42, 0.2, 3, 'txt', 4, '', 0, 'ENDTAB');
  g(0, 'ENDSEC');
  // bloque HINCA: círculo (color por capa) + atributos para extracción de datos
  const TAGS = [['TRACKER', 'Tracker'], ['N', 'Hinca N° (norte a sur)'], ['CODIGO', 'Código Trina'], ['COLOR', 'Color Trina'], ['Z_TERRENO', 'Cota terreno (m)'], ['Z_CABEZA', 'Cota cabeza (m)'], ['ALTURA_LIBRE', 'Altura libre (m)'], ['EMPOTRAMIENTO', 'Empotramiento (m)'], ['ESTADO', 'Estado']];
  g(0, 'SECTION', 2, 'BLOCKS', 0, 'BLOCK', 8, '0', 2, 'HINCA', 70, 2, 10, 0, 20, 0, 30, 0, 3, 'HINCA', 0, 'CIRCLE', 8, '0', 62, 0, 10, 0, 20, 0, 30, 0, 40, 0.12);
  TAGS.forEach(([t, p], i) => g(0, 'ATTDEF', 8, '0', 10, 0.3, 20, -0.15 - i * 0.3, 30, 0, 40, 0.2, 1, '', 3, p, 2, t, 70, 1));
  g(0, 'ENDBLK', 8, '0', 0, 'ENDSEC', 0, 'SECTION', 2, 'ENTITIES');
  C.L.forEach((r) => {
    if (!r.n) return; const H = r.H, a = H[0], z = H[H.length - 1], hecho = !!HA[r.t.id];
    g(0, 'LINE', 8, hecho ? 'RAM-HINCADO' : 'RAM-TRACKER', 10, num(a.x), 20, num(a.y), 30, 0, 11, num(z.x), 21, num(z.y), 31, 0);
    g(0, 'TEXT', 8, 'RAM-TRACKER-ID', 10, num(a.x), 20, num(a.y + 1.2), 30, 0, 40, 0.8, 1, r.t.id, 72, 1, 11, num(a.x), 21, num(a.y + 1.2), 31, 0);
    H.forEach((h, k) => {
      const kk = h.cod && hcat(h.cod), est = h.est === 'corto' ? 'Perfil corto' : h.est === 'alto' ? 'Terreno alto' : h.salto ? 'Salto' : 'OK';
      const capa = kk ? 'HINCA-' + String(kk.color || 'SIN-COLOR').toUpperCase().replace(/[^A-Z0-9]+/g, '-') : h.est !== 'ok' ? 'HINCA-FUERA' : h.salto ? 'HINCA-SALTO' : 'HINCA-OK';
      g(0, 'INSERT', 8, capa, 66, 1, 2, 'HINCA', 10, num(h.x), 20, num(h.y), 30, 0);
      const vals = [r.t.id, k + 1, h.cod || '', kk ? kk.color : '', num(h.z), num(h.cab), num(h.rev), num(h.emb), est];
      TAGS.forEach(([t], i) => g(0, 'ATTRIB', 8, capa, 10, num(h.x + 0.3), 20, num(h.y - 0.15 - i * 0.3), 30, 0, 40, 0.2, 1, vals[i], 2, t, 70, 1));
      g(0, 'SEQEND', 8, capa);
      g(0, 'TEXT', 8, 'RAM-ALTURA-LIBRE', 10, num(h.x + 0.25), 20, num(h.y - 0.1), 30, 0, 40, 0.22, 1, `${k + 1}: ${h.rev.toFixed(2)}${kk ? ' ' + String(h.cod).replace(/^26050-/, '') : ''}`);
      if (h.est !== 'ok') g(0, 'CIRCLE', 8, 'RAM-FUERA', 10, num(h.x), 20, num(h.y), 30, 0, 40, 0.35);
      else if (h.salto) g(0, 'CIRCLE', 8, 'RAM-SALTO', 10, num(h.x), 20, num(h.y), 30, 0, 40, 0.35);
    });
  });
  g(0, 'ENDSEC', 0, 'EOF');
  const s = o.join('\r\n') + '\r\n', b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); b[i] = c < 256 ? c : 63; }
  return b;
}
async function ramExportDxf() {
  const p = await window.api.saveBinary(ramDxf(), `Ramming plan ${today()}.dxf`, 'dxf', 'Dibujo DXF (AutoCAD)');
  if (p) toast('Plano DXF exportado: abrilo en AutoCAD y guardalo como DWG', { action: ['Abrir carpeta', () => window.api.showItem ? window.api.showItem(p) : window.api.openPath(p)] });
}
