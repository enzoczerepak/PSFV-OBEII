/* PSFV-OBE II · Hincado · Ramming plan: cota de terreno de cada hinca (COTAS_HINCAS), cota de cabeza, altura libre y
   empotramiento con parámetros configurables, plano de hincado y programa por hincadora.
   Parámetros en S.hincado.ram (se sincronizan con el catálogo, clave 'hc'). */
const RAM_DEF = {
  revNom: 1.315,    // hinca general (Standard/Damper): altura libre nominal (m), manual Trina
  regMenos: 100,    // regulación Trina (manual ARI-GR-MN-4301-0A §3.4.3): se puede hincar hasta 100 mm más que la nominal (altura libre −100 mm)
  regMas: 200,      // … y hasta 200 mm menos (altura libre +200 mm), sin bajar del empotramiento mínimo
  largo: 3.515,     // hinca general: largo del perfil (m) si no hay código por posición (PW610-1A, suelo N)
  embMin: 2.00,     // hinca general: empotramiento mínimo (m)
  drNom: 1.23, drLargo: 3.43, drEmb: 2.00, // hinca motor (Drive): altura libre nominal, largo, empotramiento mínimo (PW614-1A, suelo N)
  mot52: 7, mot26: 4, // posición de la hinca motor contando de norte a sur (central)
  pendMax: 15,      // pendiente N-S máxima del tracker (%): Vanguard 1P hasta 15 % / 9° N-S y E-O (manual ARI-GR-MN-4301-0A §3.2)
  difMax: 0.30,     // diferencia máxima de altura libre entre hincas vecinas (m)
  usarCodigos: true,// si la distribución por posición está completa, usar largo / altura / empotramiento de cada código
  hincadoras: 2, rend: 120, inicio: null, sabado: true, orden: '1,2,3,4,5,6', sentido: 'OE',
  precarga: true,   // plan en precarga: alturas orientativas, no apto para hincar (se levanta en Parámetros)
};
const RAM_PRE_TXT = 'PRECARGA · alturas orientativas · no apto para hincar';
const RAMUI = { tab: 'plano', color: 'estado', sel: null, s: 'all', q: '', f: 'all' };
const ramP = () => { const H = S.hincado || (S.hincado = {}); const r = H.ram || {};
  if (r.revNom === 1.25 && r.largo === 3.46) { r.revNom = 1.315; r.largo = 3.515; }
  if (r.pendMax === 10) r.pendMax = 5; // valores provisorios anteriores
  if (!r.trv) { if (r.pendMax === 5) r.pendMax = 15; delete r.revMin; r.trv = 1; } // criterios del manual de montaje Trina (15 %, regulación −200/+100)
  H.ram = Object.assign({}, RAM_DEF, r); return H.ram; };
// cota del terreno en cada hinca, según el terreno elegido para el sector: 'layout' (cotas del replanteo), 'mov' (terreno final
// del cálculo de movimiento de suelos) o el id de una topografía cargada (relevamiento después del movimiento: el que vale para hincar)
const ramTerrSrc = (s) => ((ramP().terr || {})[s]) || 'layout';
let RAMZC = new Map();
function ramZ(t) {
  const id = t.id, src = ramTerrSrc(t.s), lay = (window.COTAS_HINCAS && window.COTAS_HINCAS.z[id]) || null;
  if (src === 'layout' || typeof msCalc !== 'function') return lay;
  if (src === 'mov') { const R = msCalc(t.s), r = R && R.map.get(id); if (!r) return lay; const z = []; r.H.forEach((h) => { z[h.i] = h.zf; }); return z; }
  let terr = RAMZC.get(t.s + '|' + src); if (terr === undefined) { terr = msSets().some((x) => x.id === src) ? msTerreno(t.s, src) : null; RAMZC.set(t.s + '|' + src, terr); }
  const rp = repDe(id); if (!terr || !rp || !rp.p) return lay;
  return rp.p.map((p, i) => { const q = terr.pila({ x: p[0], y: p[1], zt: lay ? lay[i] : null }); return q.z; });
}
const ramTerrTxt = (src) => (src === 'layout' ? 'cotas del replanteo (layout)' : src === 'mov' ? 'terreno final del cálculo de movimiento de suelos' : ((msSets().find((x) => x.id === src) || {}).nombre || 'topografía'));

// ---------- cálculo por tracker ----------
function ramTracker(t, P) {
  const rp = repDe(t.id), zs = ramZ(t); if (!rp || !rp.p || !zs || zs.length !== rp.p.length) return null;
  const cods = posDe(t), conCod = P.usarCodigos && cods.length === rp.p.length && cods.every(Boolean);
  // de norte a sur (y decreciente); la distancia se mide desde la primera hinca
  const H = rp.p.map((p, i) => ({ i, x: p[0], y: p[1], z: zs[i], cod: conCod ? cods[i] : '' })).sort((a, b) => b.y - a.y);
  const y0 = H[0].y, mot = t.t === '1P26' ? P.mot26 : P.mot52;
  H.forEach((h, i) => { h.d = y0 - h.y; const k = h.cod && hcat(h.cod);
    h.motor = k ? /drive/i.test(k.tipo || '') : i + 1 === Number(mot);
    h.nom = k ? k.sobre / 1000 : h.motor ? P.drNom : P.revNom; h.L = k ? k.largo / 1000 : h.motor ? P.drLargo : P.largo;
    h.emin = k ? k.mrl / 1000 : h.motor ? P.drEmb : P.embMin; h.rmin = h.nom - P.regMenos / 1000; h.rmax = Math.min(h.nom + P.regMas / 1000, h.L - h.emin); });
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
  const P = ramP(), usaMov = Object.values(P.terr || {}).includes('mov'), key = JSON.stringify(P) + '|' + JSON.stringify(S.hincado.matriz || {}) + '|' + (S.topo || []).map((x) => x.id + x.n + x.cargado).join(',') + (usaMov ? '|' + JSON.stringify(S.hincado.mov || {}) : '');
  if (RAMC && RAMC.key === key) return RAMC; RAMZC = new Map();
  const L = (window.PLANO ? window.PLANO.trk : []).map((t) => ramTracker(t, P) || { t, est: 'sin', H: [], n: 0 });
  RAMC = { key, L, map: new Map(L.map((r) => [r.t.id, r])) }; RAMCAB = null;
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
  PUI = RAMUI; if (RAMUI.color === 'trina') RAMUI.color = 'estado';
  const P = ramP(), C = ramCalc(), HA = (S.hincado || {}).avance || {};
  if (!window.COTAS_HINCAS) { el.innerHTML = '<div class="card empty"><b>Faltan las cotas de las hincas</b></div>'; return; }
  actions([['PDF · ramming plan para imprimir', 'btn', () => ramImprimir('ram')], ['Exportar DXF (AutoCAD)', 'btn', () => ramExportDxf('ram')], ['Exportar Excel', 'btn', ramExcel], ['PDF · tabla de alturas por sector', 'btn', ramPdf]]);
  const cnt = {}; C.L.forEach((r) => (cnt[r.est] = (cnt[r.est] || 0) + 1));
  const hF = C.L.reduce((a, r) => a + (r.fuera || 0), 0), nH = C.L.reduce((a, r) => a + r.n, 0);
  const PG = ramPrograma();
  el.innerHTML = (P.precarga ? ramPrecargaHTML(C) : '') + `<div class="grid g4 stagger" style="margin-bottom:12px">
      <div class="card kpi"><div class="kl">Trackers dentro de tolerancia</div><div class="kv">${fmt((cnt.ok || 0) + (cnt.ajus || 0))}<small> / ${fmt(C.L.length)}</small></div><div class="muted">${fmt(cnt.ajus || 0)} con la línea de cabezas corrida</div></div>
      <div class="card kpi"><div class="kl">Para revisar</div><div class="kv" style="color:${(cnt.fuera || 0) + (cnt.pend || 0) ? '#d64545' : 'inherit'}">${fmt((cnt.fuera || 0) + (cnt.pend || 0) + (cnt.salto || 0))}</div><div class="muted">${fmt(cnt.fuera || 0)} con hincas fuera (${fmt(hF)} hincas) · ${fmt(cnt.pend || 0)} por pendiente · ${fmt(cnt.salto || 0)} por saltos</div></div>
      <div class="card kpi"><div class="kl">Hincas con cota</div><div class="kv">${fmt(nH)}</div><div class="muted">terreno ${fmt(Math.min(...C.L.filter((r) => r.n).map((r) => r.zmin)), 1)} a ${fmt(Math.max(...C.L.filter((r) => r.n).map((r) => r.zmax)), 1)} m</div></div>
      <div class="card kpi"><div class="kl">Fin de hincado estimado</div><div class="kv" style="font-size:22px">${PG.fin ? fechaCorta(PG.fin) : '—'}</div><div class="muted">${fmt(PG.nPend)} trackers pendientes · ${fmt(PG.dias.length)} jornadas · ${fmt(PG.cap)} hincas/día</div></div></div>
    <div class="seg rmtabs" id="rmT"><button data-v="plano">🗺️ Plano (alturas)</button><button data-v="trk">📋 Trackers</button><button data-v="prog">📅 Programa</button><button data-v="par">⚙️ Parámetros</button></div>
    <div id="rmB" style="margin-top:12px"></div>`;
  segBind('#rmT', RAMUI.tab, (v) => { RAMUI.tab = v; render(false); });
  const b = $('#rmB', el);
  ({ plano: ramPlano, trk: ramTabla, prog: ramProg, par: ramPar })[RAMUI.tab](b, C, PG);
}
// cartel de precarga del ramming plan: qué está cargado y qué falta para que el plan sea definitivo
function ramPrecargaHTML(C) {
  const RP = window.REPLANTEO || {}, CO = window.COTAS_HINCAS || {}, rev = C.L.filter((r) => r.t.rev).length;
  const cods = Object.keys(S.hincado.matriz || {}).every((k) => matrizOk(k));
  return `<div class="card hpre"><div class="hpreh"><span class="pill p-warn">PRECARGA</span><b>Ramming plan en condición de precarga</b><span class="muted">· las alturas son orientativas: no usar para hincar</span></div>
    <div class="hprec"><div><h4>Datos cargados</h4><ul>
      <li>✓ Posición de cada hinca: <b>${esc((RP.fuente || '').split(' · ')[0])}</b>, numeración de mesas OBEII-GR-PL-003 r1 · ${fmt(RP.nHincas || 0)} hincas.</li>
      <li>✓ Cota de terreno por hinca: ${[...new Set((window.PLANO.trk || []).map((t) => t.s))].sort().map((x) => `S${x} ${esc(ramTerrTxt(ramTerrSrc(x)))}`).join(' · ')}.</li>
      <li>${cods ? '✓' : '·'} Código, largo y altura libre de cada hinca: Trina CIV-DW-26050-2402-0B y MEC-DW-26050-3401-0A${cods ? '' : ' (distribución incompleta)'}.</li>
      <li>✓ Pendiente N-S del tracker hasta ${fmt(ramP().pendMax, 1)} % y regulación de hincado −200 / +100 mm (manual Trina ARI-GR-MN-4301-0A).</li></ul></div>
    <div><h4>Falta para que sea definitivo</h4><ol>
      <li><b>Topografía final del terreno</b> (después del movimiento de suelos / malla de rugosidad): hoy las alturas se calculan sobre terreno natural.</li>
      <li><b>Confirmación de la discretización</b> de los ${rev} trackers que se movieron en el replanteo r4 (zona y suelo definen el código y el largo de cada hinca).</li>
      <li><b>Validación de Trina</b> del ramming plan: alturas libres, empotramientos y tolerancias de montaje.</li></ol></div></div>
    <p class="hint" style="margin:6px 0 0">Los PDF, el DXF y el Excel salen con la marca de precarga. Cuando estén los datos, se levanta en la pestaña Parámetros.</p></div>`;
}
function vHDist(el) {
  PUI = DISTUI;
  if (!window.REPLANTEO) { el.innerHTML = '<div class="card empty"><b>Falta el replanteo de hincas</b></div>'; return; }
  const C = ramCalc(), HA = (S.hincado || {}).avance || {}, tubo = DISTUI.tab === 'tubo', secs = [...new Set(C.L.map((r) => r.t.s))].sort();
  if (DISTUI.tab === 'acc') return vHAcc(el, C, secs);
  if (DISTUI.tab === 'tipo') return vHTipos(el, C, secs);
  actions(tubo ? [['PDF · plano de tubos de torque para imprimir', 'btn', () => ramImprimir('tubo')], ['Exportar Excel', 'btn', tuboExcel]]
    : [['PDF · plano de distribución para imprimir', 'btn', () => ramImprimir('dist')], ['Exportar DXF (AutoCAD)', 'btn', () => ramExportDxf('dist')], ['Exportar Excel', 'btn', distExcel]]);
  const nH = C.L.reduce((a, r) => a + r.n, 0), nCod = C.L.filter((r) => r.conCod).length, cods = new Set(); C.L.forEach((r) => r.H.forEach((h) => h.cod && cods.add(h.cod)));
  const hech = C.L.filter((r) => HA[r.t.id]).reduce((a, r) => a + r.n, 0), tabs = `<div class="tools" style="margin-bottom:12px"><div class="seg" id="dT"><button data-v="hinc">Hincas</button><button data-v="tubo">Tubos de torque</button><button data-v="acc">Accesorios</button><button data-v="tipo">Tipos de tracker</button></div></div>`;
  let kpi;
  if (tubo) {
    const m = ramConteo(C, 'tubo'), sum = (x) => Object.values(x).reduce((a, b) => a + b, 0), nT = [...m.values()].reduce((a, x) => a + sum(x), 0);
    const conT = C.L.filter((r) => tubosDe(r.t).length).length, metros = C.L.reduce((a, r) => a + tubosDe(r.t).reduce((q, c) => q + TUBO_LARGO[c], 0), 0) / 1000;
    kpi = `<div class="card kpi"><div class="kl">Trackers con tubos</div><div class="kv">${fmt(conT)}<small> / ${fmt(C.L.length)}</small></div><div class="muted">Trina ${esc(TUBO_DOC)}</div></div>
      <div class="card kpi"><div class="kl">Tubos de torque</div><div class="kv">${fmt(nT)}</div><div class="muted">${m.size} tipos · ${fmt(metros, 0)} m de viga</div></div>
      <div class="card kpi"><div class="kl">Marcas de color de los tubos</div><div class="kv" style="font-size:16px">${(() => { const n = TUBO_ORD.filter((c) => m.has(c) && tuboMarca(c).length).length; return n ? `${n} de ${m.size} tipos` : '<span class="muted">sin cargar</span>'; })()}</div><div class="muted">pintura en los extremos, según lo recibido en obra</div></div>
      <div class="card kpi"><div class="kl">Referencia</div><div class="kv" style="font-size:16px">${(window.PLANO.sts || []).length} STS · ${(window.PLANO.inv || []).length} inversores</div><div class="muted">ubicados en el plano</div></div>`;
  } else kpi = `<div class="card kpi"><div class="kl">Trackers con distribución</div><div class="kv">${fmt(nCod)}<small> / ${fmt(C.L.length)}</small></div><div class="muted">Trina ${esc(TRINA_DIST_DOC)}</div></div>
      <div class="card kpi"><div class="kl">Hincas en el plano</div><div class="kv">${fmt(nH)}</div><div class="muted">${cods.size} códigos distintos</div></div>
      <div class="card kpi"><div class="kl">Hincadas</div><div class="kv">${fmt(hech)}</div><div class="muted">${fmt(nH ? (hech / nH) * 100 : 0, 1)} % · trackers tachados en el plano</div></div>
      <div class="card kpi"><div class="kl">Referencia</div><div class="kv" style="font-size:16px">${(window.PLANO.sts || []).length} STS · ${(window.PLANO.inv || []).length} inversores</div><div class="muted">ubicados en el plano</div></div>`;
  el.innerHTML = `${tabs}<div class="grid g4 stagger" style="margin-bottom:12px">${kpi}</div>
    <div id="rmB"></div>
    <div class="card" style="margin-top:16px"><div style="display:flex;align-items:center;gap:10px"><h3 style="margin:0;flex:1">${tubo ? 'Tubos de torque' : 'Hincas'} por sector · resumen</h3>${tubo && !window.READONLY ? '<button class="btn sm" id="tcE">Cargar marcas de pintura…</button>' : ''}</div><div class="tblwrap">${ramResTabla(C, tubo ? 'tubo' : 'dist', secs, 'tbl')}</div></div>`;
  segBind('#dT', DISTUI.tab || 'hinc', (v) => { DISTUI.tab = v; render(false); });
  const tcE = $('#tcE', el); if (tcE) tcE.onclick = tuboMarcaEdit;
  ramPlano($('#rmB', el), C, null, tubo ? 'tubo' : 'dist');
}
async function distExcel() {
  const C = ramCalc(), HA = (S.hincado || {}).avance || {}, wb = XLSX.utils.book_new();
  const secs = [...new Set(C.L.map((r) => r.t.s))].sort(), cnt = new Map();
  C.L.forEach((r) => r.H.forEach((h) => { if (!h.cod) return; const x = cnt.get(h.cod) || {}; x[r.t.s] = (x[r.t.s] || 0) + 1; cnt.set(h.cod, x); }));
  const a = [['Código', 'Tipo', 'Suelo', 'Color arriba', 'Color abajo', 'Largo (mm)'].concat(secs.map((s) => 'Sector ' + s), ['Total'])];
  [...cnt.keys()].sort().forEach((c) => { const k = hcat(c) || {}, x = cnt.get(c); a.push([c, k.tipo, k.suelo === 'B' ? 'Blando' : 'Normal', hColSup(k) || 'sin color', k.color, k.largo].concat(secs.map((s) => x[s] || 0), [secs.reduce((t, s) => t + (x[s] || 0), 0)])); });
  const b = [['Tracker', 'Frame', 'Sector', 'Configuración', 'Hincado'].concat(Array.from({ length: 13 }, (_, i) => 'Pos ' + (i + 1)))];
  C.L.forEach((r) => b.push([r.t.id, (repDe(r.t.id) || {}).fr || '', r.t.s, cfgTxt(cfgDe(r.t)), HA[r.t.id] ? HA[r.t.id].f : ''].concat(r.H.map((h) => ramCodCorto(h.cod)))));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(a), 'Por código y sector'); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(b), 'Por tracker');
  const p = await window.api.saveBinary(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }), `Distribución de hincas ${today()}.xlsx`, 'xlsx', 'Excel');
  if (p) toast('Excel exportado', { action: ['Abrir', () => window.api.openPath(p)] });
}
// ============ tubos de torque (vigas) por configuración: Trina MEC-DW-26050-3401-0A, de norte a sur ============
const TUBO_DOC = 'MEC-DW-26050-3401-0A';
const TUBO_CFG = {
  '1P52|Outer': ['PG132-2A', 'PG132-1A', 'PG133-1A', 'PG133-1A', 'PG132-1A', 'PG132-2A'],
  '1P52|Border': ['PG132-5A', 'PG132-4A', 'PG132-3A', 'PG132-3A', 'PG132-4A', 'PG132-5A'],
  '1P52|Inner': ['PG132-5A', 'PG132-4A', 'PG132-3A', 'PG132-3A', 'PG132-4A', 'PG132-5A'],
  '1P26|Outer': ['PG132-7A', 'PG132-6A', 'PG132-6A', 'PG132-7A'],
  '1P26|Border': ['PG132-7A', 'PG132-6A', 'PG132-6A', 'PG132-7A'],
};
const TUBO_COL = { 'PG132-1A': '#e15759', 'PG132-2A': '#f28e2b', 'PG133-1A': '#8c564b', 'PG132-3A': '#4e79a7', 'PG132-4A': '#76b7b2', 'PG132-5A': '#59a14f', 'PG132-6A': '#b07aa1', 'PG132-7A': '#e6b800' };
const TUBO_ORD = ['PG132-1A', 'PG132-2A', 'PG133-1A', 'PG132-3A', 'PG132-4A', 'PG132-5A', 'PG132-6A', 'PG132-7A'];
const tubosDe = (t) => TUBO_CFG[`${t.t}|${t.z || 'Outer'}`] || [];
// marca de pintura de cada tipo de tubo (en los extremos), cargada en obra: no figura en los planos de Trina
const TCOL = Object.assign({ Amarillo: '#f2c200', Naranja: '#f28e2b', Marrón: '#8c564b', Celeste: '#5ab8ff' }, HCOL);
const tuboMarca = (c) => (((S.hincado || {}).tuboCol || {})[c] || []).filter((x) => x && x !== 'Sin marca');
const tuboMarcaH = (c) => { const L = tuboMarca(c); return L.length ? L.map((x) => `<i class="rmsw" style="background:${TCOL[x] || '#fff'}"></i>${esc(x)}`).join(' ') : '<span class="muted">sin dato</span>'; };
async function tuboMarcaEdit() {
  if (window.READONLY) return;
  const M = (S.hincado.tuboCol = S.hincado.tuboCol || {}), opts = (v) => ['', ...Object.keys(TCOL).filter((x) => x !== 'Sin marca')].map((x) => `<option value="${x}" ${x === (v || '') ? 'selected' : ''}>${x || '—'}</option>`).join('');
  const r = await modal({ title: 'Marcas de pintura de los tubos de torque', sub: 'Los planos de Trina no traen código de colores para las vigas. Cargá la pintura que trae cada tipo en los extremos, según lo recibido en obra.', wide: true,
    body: `<div class="tblwrap"><table class="tbl"><thead><tr><th>Tubo</th><th>Sección · largo</th><th>Color 1</th><th>Color 2</th></tr></thead><tbody>${TUBO_ORD.map((c) => { const i = tuboInfo(c), v = M[c] || []; return `<tr data-c="${c}"><td><i class="rmsw" style="background:${i.col}"></i><b>26050-${c}</b></td><td>${esc(i.size)} · ${fmt(i.largo)} mm</td><td><select class="tc1">${opts(v[0])}</select></td><td><select class="tc2">${opts(v[1])}</select></td></tr>`; }).join('')}</tbody></table></div>`,
    buttons: [['Cancelar', 'btn', () => null], ['Guardar', 'btn pri', (b) => { const o = {}; $$('tr[data-c]', b).forEach((tr) => { const L = [$('.tc1', tr).value, $('.tc2', tr).value].filter(Boolean); if (L.length) o[tr.dataset.c] = L; }); return o; }]] });
  if (!r) return; S.hincado.tuboCol = r; commit('Marcas de pintura de los tubos de torque actualizadas');
}
// datos de la viga en el BOM de Trina (sección, largo, cantidades); sin BOM, los largos del plano
const TUBO_LARGO = { 'PG132-1A': 11500, 'PG132-2A': 9097, 'PG133-1A': 10000, 'PG132-3A': 10000, 'PG132-4A': 11500, 'PG132-5A': 9097, 'PG132-6A': 9000, 'PG132-7A': 6428 };
function tuboInfo(c) {
  const B = (S.trackers && S.trackers.bom) || window.BOM_TRINA, it = B && (B.items || []).find((i) => (i.dib || []).some((d) => String(d).toUpperCase() === '26050-' + c));
  return { c, k: it ? it.k : '', size: it ? it.size : '', largo: (it && it.largo) || TUBO_LARGO[c] || 0, neto: it ? it.neto : null, tot: it ? it.tot : null, col: TUBO_COL[c] || '#999' };
}
// conteo por código y sector: hincas (código Trina) o tubos de torque
function ramConteo(C, modo) {
  const m = new Map(), add = (c, s, n = 1) => { const x = m.get(c) || {}; x[s] = (x[s] || 0) + n; m.set(c, x); };
  C.L.forEach((r) => { if (modo === 'tubo') tubosDe(r.t).forEach((c) => add(c, r.t.s)); else r.H.forEach((h) => h.cod && add(ramCodCorto(h.cod), r.t.s)); });
  return m;
}
// una viga por tramo, centrada en la hinca motor, con su largo real; hincas en gris de referencia
function ramTuboSVG(t, L, txt) {
  const xs = L[0].x, mot = L.find((q) => q.h.motor) || L[Math.floor(L.length / 2)], tub = tubosDe(t);
  const tot = tub.reduce((a, c) => a + TUBO_LARGO[c] / 1000, 0); let y = mot.y - tot / 2, g = ramTxt(xs, Math.min(y, L[0].y) - txt * 0.45, t.id.replace('TRK-', 'TR '), txt * 1.05, 'text-anchor="middle" font-weight="700" class="rmtid2"');
  tub.forEach((c) => { const l = TUBO_LARGO[c] / 1000, ym = y + l / 2;
    const mk = tuboMarca(c), band = (y0) => mk.map((x, q) => `<rect x="${(xs - 0.55 + q * 1.1 / mk.length).toFixed(2)}" y="${y0.toFixed(2)}" width="${(1.1 / mk.length).toFixed(2)}" height="0.7" fill="${TCOL[x] || '#fff'}" stroke="#222" stroke-width="0.04"/>`).join('');
    g += `<rect x="${(xs - 0.55).toFixed(2)}" y="${y.toFixed(2)}" width="1.1" height="${l.toFixed(2)}" fill="${TUBO_COL[c]}" stroke="#222" stroke-width="0.06"/>` + (mk.length ? band(y + 0.05) + band(y + l - 0.75) : '')
      + ramTxt(xs + 0.8, ym + txt * 0.3, esc(c.replace('PG13', '13')), txt * 0.8, 'text-anchor="start" class="rmhl"');
    y += l; });
  L.forEach(({ h, x, y: yy }) => { g += `<rect x="${(x - 0.35).toFixed(2)}" y="${(yy - 0.35).toFixed(2)}" width="0.7" height="0.7" fill="${h.motor ? '#000' : '#fff'}" stroke="#555" stroke-width="0.06"/>`; });
  if (mot.h.motor) g += ramTxt(xs - 0.9, mot.y + txt * 0.35, 'M', txt, 'text-anchor="end" font-weight="700"');
  return g;
}
// hoja de resumen al principio del PDF: nomograma (colores / sección) y cantidades por sector
function ramResumen(C, o, secs, A) {
  const tubo = o.modo === 'tubo';
  return `<section class="rmpg rmres-pg" data-o="L" style="width:${A.pw}mm;height:${A.ph}mm">
    <div class="rmpgh"><div><b>${tubo ? 'Distribución de tubos de torque' : 'Distribución de hincas'} · resumen por sector</b><br>${esc(S.nombre || '')}</div><div style="text-align:right">${tubo ? `Trina ${esc(TUBO_DOC)}` : `Trina ${esc(TRINA_DIST_DOC)} · CIV-DW-26050-2402-0B`}<br>${o.pre ? '<span class="rmpre">PRECARGA</span> · ' : ''}${new Date().toLocaleDateString('es-AR')}</div></div>
    ${ramResTabla(C, o.modo, secs, 'rmres')}</section>`;
}
// tabla de resumen: nomograma (colores o sección) y cantidades por sector; cls 'rmres' (PDF) o 'tbl' (pantalla)
function ramResTabla(C, modo, secs, cls) {
  const tubo = modo === 'tubo', m = ramConteo(C, modo), cods = [...m.keys()].filter((c) => secs.some((s) => (m.get(c)[s] || 0) > 0)).sort((a, b) => (tubo ? TUBO_ORD.indexOf(a) - TUBO_ORD.indexOf(b) : a.localeCompare(b)));
  const nT = (s) => C.L.filter((r) => r.t.s === s).length, sum = (x) => secs.reduce((a, s) => a + (x[s] || 0), 0);
  let head, fila;
  if (tubo) {
    head = '<th>Color en el plano</th><th>Marca de pintura (obra)</th><th>Tubo (plano Trina)</th><th>Sección</th><th class="n">Largo (mm)</th>';
    fila = (c) => { const i = tuboInfo(c); return `<td><i style="background:${i.col}"></i></td><td>${tuboMarcaH(c)}</td><td><b>26050-${esc(c)}</b></td><td>${esc(i.size)}</td><td class="n">${fmt(i.largo)}</td>`; };
  } else {
    head = '<th>Colores</th><th>Código</th><th>Tipo</th><th>Suelo</th><th>Perfil</th><th class="n">Largo (mm)</th><th>Cabeza (arriba)</th><th>Punta (abajo)</th>';
    const full = new Map(); C.L.forEach((r) => r.H.forEach((h) => h.cod && full.set(ramCodCorto(h.cod), h.cod)));
    fila = (c) => { const k = hcat(full.get(c)) || {};
      return `<td>${ramDosCol(k)}</td><td><b>${esc(c)}</b></td><td>${esc(k.tipo || '')}</td><td>${k.suelo === 'B' ? 'blando' : 'normal'}</td><td>${esc(k.perfil || '')}</td><td class="n">${fmt(k.largo || 0)}</td><td>${esc(hColSup(k) || 'sin color')}</td><td>${esc(k.color || '')}</td>`; };
  }
  const tot = secs.map((s) => cods.reduce((a, c) => a + (m.get(c)[s] || 0), 0));
  const tabla = `<table class="${cls} rmrestb"><thead><tr>${head}${secs.map((s) => `<th class="n">Sector ${s}</th>`).join('')}<th class="n">Total</th></tr></thead><tbody>
    ${cods.map((c) => { const x = m.get(c), t = sum(x); return `<tr>${fila(c)}${secs.map((s) => `<td class="n">${x[s] ? fmt(x[s]) : '–'}</td>`).join('')}<td class="n"><b>${fmt(t)}</b></td></tr>`; }).join('')}
    <tr class="rmrest"><td colspan="${tubo ? 5 : 8}"><b>Total ${tubo ? 'tubos' : 'hincas'}</b></td>${tot.map((n) => `<td class="n"><b>${fmt(n)}</b></td>`).join('')}<td class="n"><b>${fmt(tot.reduce((a, b) => a + b, 0))}</b></td></tr>
    <tr class="rmrest"><td colspan="${tubo ? 5 : 8}">Trackers</td>${secs.map((s) => `<td class="n">${fmt(nT(s))}</td>`).join('')}<td class="n">${fmt(secs.reduce((a, s) => a + nT(s), 0))}</td></tr></tbody></table>`;
  const cfg = tubo ? `<h4>Tubos por configuración de tracker (de norte a sur)</h4><table class="${cls} rmrestb rmcfg"><thead><tr><th>Configuración</th><th>Tubos</th>${secs.map((s) => `<th class="n">Trackers S${s}</th>`).join('')}</tr></thead><tbody>
      ${Object.entries(TUBO_CFG).map(([k, L]) => `<tr><td>${esc(cfgTxt(k + '|N').replace(/ · suelo normal/, ''))}</td><td>${L.map((c) => `<i style="background:${TUBO_COL[c]}"></i>${esc(c)}`).join(' ')}</td>${secs.map((s) => { const n = C.L.filter((r) => r.t.s === s && `${r.t.t}|${r.t.z || 'Outer'}` === k).length; return `<td class="n">${n ? fmt(n) : '–'}</td>`; }).join('')}</tr>`).join('')}</tbody></table>
      <p class="rmrnota">Vigas □130 de acero galvanizado; el espesor cambia con la posición: 3,0 mm la PG133-1A del centro de los 1P52 exteriores; 2,2 mm la PG132-4A, 5A y 7A; 2,5 mm el resto. Las cantidades salen de la configuración de cada tracker en el layout. Color en el plano: solo para distinguir los tubos en el dibujo; marca de pintura: la que traen los tubos en los extremos, cargada en obra.</p>`
    : `<p class="rmrnota"><b>Nomograma de colores Trina:</b> cada hinca lleva dos marcas de pintura. Cabeza (triángulo de arriba en el plano): rojo = general en suelo normal, azul = general en suelo blando, sin color = hinca motor. Punta (triángulo de abajo): color del largo y perfil según la tabla. Código Trina arriba de cada hinca; M = hinca motor.</p>`;
  return tabla + cfg;
}
// ============ accesorios por sector: BOM de Trina, cantidades por tracker de cada tipo (configuración × suelo) ============
const ACC_TIPOS = ['1P52|Outer|N', '1P52|Border|N', '1P52|Inner|N', '1P26|Outer|N', '1P26|Border|N', '1P52|Outer|B', '1P52|Border|B', '1P52|Inner|B', '1P26|Outer|B', '1P26|Border|B'];
const ACC_ORD = ['DRIVE UNIT', 'MECH. PARTS', 'BEARING', 'DAMPER', 'PURLIN', 'FASTENER', 'TCU', 'ACCESSORIES'];
function accItems() {
  const B = (S.trackers && S.trackers.bom) || window.BOM_TRINA, B0 = window.BOM_TRINA || { items: [] }; if (!B) return { items: [], tipos: ACC_TIPOS };
  const q0 = new Map(B0.items.filter((i) => i.q).map((i) => [i.k, i.q])), tipos = B.tipos || B0.tipos || ACC_TIPOS;
  return { tipos, items: B.items.map((i) => Object.assign({}, i, { q: i.q || q0.get(i.k) })).filter((i) => i.q && i.q.some(Boolean) && !/^(POST|BEAM)$/i.test(i.cat)) };
}
// cantidad de cada accesorio por sector = Σ trackers del sector × cantidad por tracker de su tipo
function accConteo(C) {
  const A = accItems(), ix = (t) => A.tipos.indexOf(`${t.t}|${t.z || 'Outer'}|${t.sl || 'N'}`), m = new Map();
  C.L.forEach((r) => { const j = ix(r.t); if (j < 0) return; A.items.forEach((it) => { const v = it.q[j]; if (!v) return; const x = m.get(it.k) || {}; x[r.t.s] = (x[r.t.s] || 0) + v; m.set(it.k, x); }); });
  return { A, m };
}
const accCat = (c) => (typeof trkCat === 'function' ? trkCat(c)[0] : c);
function ramAccTabla(C, secs, cls, parte) {
  const { A, m } = accConteo(C), its = A.items.filter((i) => m.has(i.k) && secs.some((s) => (m.get(i.k)[s] || 0) > 0)).sort((a, b) => (ACC_ORD.indexOf(String(a.cat).toUpperCase()) - ACC_ORD.indexOf(String(b.cat).toUpperCase())) || String(a.desc).localeCompare(String(b.desc)));
  if (!its.length) return '<p class="muted">Falta el BOM de Trina con las cantidades por tipo de tracker.</p>';
  let cat = '', h = []; const NP = 40, pan = ramPaneles(C);
  h.push(`<tr class="rmacat"><td colspan="${3 + secs.length + 1}"><b>Módulos fotovoltaicos</b></td></tr>`, `<tr data-tag="module"><td>—</td><td>Panel solar 2.382 × 1.134 mm (1P, vertical)</td><td class="n">52 / 26</td>${secs.map((s) => `<td class="n">${fmt(pan[s] || 0)}</td>`).join('')}<td class="n"><b>${fmt(secs.reduce((a, s) => a + (pan[s] || 0), 0))}</b></td></tr>`);
  its.forEach((i) => { const x = m.get(i.k), c = String(i.cat).toUpperCase();
    if (c !== cat) { cat = c; h.push(`<tr class="rmacat"><td colspan="${3 + secs.length + 1}"><b>${esc(accCat(i.cat))}</b></td></tr>`); }
    h.push(`<tr data-tag="${accTag(i)}"><td>${esc(i.k)}</td><td>${esc(i.desc)}${i.size ? ` <span class="muted">${esc(i.size)}</span>` : ''}</td><td class="n">${esc(A.tipos.map((t, j) => i.q[j]).filter((v, j, L) => L.indexOf(v) === j).join(' / '))}</td>${secs.map((s) => `<td class="n">${x[s] ? fmt(x[s]) : '–'}</td>`).join('')}<td class="n"><b>${fmt(secs.reduce((a, s) => a + (x[s] || 0), 0))}</b></td></tr>`); });
  if (parte === 'n') return Math.ceil(h.length / NP);
  const filas = parte == null ? h : h.slice(parte * NP, (parte + 1) * NP), ult = parte == null || (parte + 1) * NP >= h.length;
  return `<table class="${cls} rmrestb rmacc"><thead><tr><th>Material</th><th>Descripción</th><th class="n">Por tracker</th>${secs.map((s) => `<th class="n">Sector ${s}</th>`).join('')}<th class="n">Total</th></tr></thead><tbody>${filas.join('')}</tbody></table>${ult ? `
    <p class="rmrnota">Cantidades por tracker según su tipo (1P52 / 1P26 · exterior, borde, interior · suelo normal o blando) en el BOM de Trina ${esc(((S.trackers && S.trackers.bom) || window.BOM_TRINA || {}).doc || '')}, multiplicadas por los trackers de cada sector en el layout. Sin repuestos ni extras. "Por tracker": los valores distintos según el tipo.</p>` : ''}`;
}
function ramAccPag(C, o, secs, A) {
  const n = ramAccTabla(C, secs, 'rmres', 'n') || 1;
  return Array.from({ length: n }, (_, k) => `<section class="rmpg rmres-pg" data-o="L" style="width:${A.pw}mm;height:${A.ph}mm">
    <div class="rmpgh"><div><b>Accesorios por sector · motores, rodamientos, bulonería y demás${n > 1 ? ` (${k + 1} de ${n})` : ''}</b><br>${esc(S.nombre || '')}</div><div style="text-align:right">BOM Trina · ${new Date().toLocaleDateString('es-AR')}</div></div>
    ${ramAccTabla(C, secs, 'rmres', k)}</section>`);
}
// línea corta de accesorios principales del sector para el recuadro de cada hoja
function ramAccRot(C, sec) {
  const { A, m } = accConteo(C), v = (re) => A.items.filter((i) => re.test(`${i.cat} ${i.desc}`)).reduce((a, i) => a + ((m.get(i.k) || {})[sec] || 0), 0);
  const L = [['motores 5"', /Drive Unit.*\(5"\)/i], ['motores 7"', /Drive Unit.*\(7"\)/i], ['rodamientos', /^BEARING Bearing\(130/i], ['amortiguadores', /^DAMPER Damper$/i], ['TCU', /^TCU Plastic/i], ['correas Ω', /^PURLIN/i], ['U-bolts de correa', /Purlin U-bolt/i], ['tapas de tubo', /End Cap/i]]
    .map(([n, re]) => [n, v(re)]).filter(([, x]) => x);
  L.unshift(['paneles solares', C.L.filter((r) => r.t.s === sec).reduce((a, r) => a + (r.t.t === '1P26' ? 26 : 52), 0)]);
  return L.length ? `<p class="rmrnota"><b>Accesorios del sector ${sec}:</b> ${L.map(([n, x]) => `${fmt(x)} ${n}`).join(' · ')}. Bulonería y demás desde la pág. 2.</p>` : '';
}
const ramDosCol = (k) => { const t = HCOL[hColSup(k)] || '#fff', b = HCOL[k.color] && HCOL[k.color] !== 'transparent' ? HCOL[k.color] : '#fff';
  return `<svg viewBox="0 0 10 10" width="12" height="12" style="vertical-align:-2px;margin-right:4px"><rect x=".5" y=".5" width="9" height="9" fill="#fff" stroke="#666"/><path d="M.5 .5H9.5L5 5Z" fill="${t}" stroke="#888" stroke-width=".4"/><path d="M.5 9.5H9.5L5 5Z" fill="${b}" stroke="#888" stroke-width=".4"/></svg>`; };
function ramLeyTrina(C) {
  const m = new Map(); C.L.forEach((r) => r.H.forEach((h) => { const k = h.cod && hcat(h.cod); if (k) m.set(ramCodCorto(h.cod), k); }));
  return m.size ? '<span class="muted">Triángulo de arriba: color de la cabeza · de abajo: color de la punta ·</span>' + [...m.entries()].sort().map(([c, k]) => `<span title="${esc(hColTxt(k))}">${ramDosCol(k)}${esc(c)}</span>`).join('')
    : '<span><b>Sin distribución de Trina cargada:</b> las hincas se pintan por estado (<i style="background:#58b368"></i>bien <i style="background:#f0a23b"></i>salto <i style="background:#d64545"></i>fuera) hasta que cargues los códigos por posición en Catálogo y distribución.</span>';
}
function ramColor(r, PG, HA) {
  const m = RAMUI.color;
  if (m === 'trina' && r.conCod) return HA[r.t.id] ? '#d9d2ec' : '#e3e8ee';
  if (m === 'trina') return (RAM_EST[r.est] || RAM_EST.sin)[1];
  if (m === 'hinc') return HA[r.t.id] ? '#7c5cbf' : '#c9d0da';
  if (m === 'pend') { if (!r.n) return '#c9d0da'; const a = Math.min(1, Math.abs(r.pend) / Math.max(1, ramP().pendMax)); return `hsl(${130 - 130 * a},60%,${55 - 10 * a}%)`; }
  if (m === 'ond') { if (!r.n) return '#c9d0da'; const a = Math.min(1, r.ond / 1); return `hsl(${130 - 130 * a},60%,${55 - 10 * a}%)`; }
  if (m === 'prog') { if (HA[r.t.id]) return '#7c5cbf'; const p = PG.plan.get(r.t.id); if (!p) return '#c9d0da'; const sem = Math.floor((new Date(p.f) - new Date(today())) / 6048e5); return ['#2f9e5b', '#7cc49a', '#f0d35b', '#f0a23b', '#e07b39'][Math.min(4, Math.max(0, sem))]; }
  return (RAM_EST[r.est] || RAM_EST.sin)[1];
}
// ============ planos: DISTRIBUCIÓN (códigos y colores Trina) y RAMMING PLAN (alturas) ============
// estado de la vista de cada plano (zoom y tracker elegido)
const DISTUI = { sel: null, vb: null, tab: 'hinc' };
let PUI = RAMUI;
const ramVB = () => { const P = window.PLANO; return PUI.vb || [0, 0, P.W, P.H]; };
const ramZcls = () => { const w = ramVB()[2], W = window.PLANO.W; return w < W / 14 ? 'z1 z2' : w < W / 4 ? 'z1' : ''; };
const RAM_LADO = 1.9;
const ramColEst = (h) => (h.est !== 'ok' ? '#d64545' : h.salto ? '#f0a23b' : '#58b368');
// texto con halo blanco: se lee aunque pase por encima de una línea u otra hinca
const ramTxt = (x, y, t, sz, extra = '') => `<text x="${(+x).toFixed(2)}" y="${(+y).toFixed(2)}" font-size="${(+sz).toFixed(2)}" stroke="#fff" stroke-width="${(sz * 0.22).toFixed(2)}" stroke-linejoin="round" paint-order="stroke" ${extra}>${t}</text>`;
// una hinca. modo 'dist': cuadrado con triángulo de arriba (color de la cabeza) y de abajo (color de la punta), código arriba.
// modo 'ram': cuadrado pintado por estado, abajo "número · altura libre". En los dos: M a la izquierda de la motor, cruz si está hincado.
function ramPilaSVG(h, k, x, y, o, hecho, txt) {
  const kk = h.cod && hcat(h.cod), L = RAM_LADO, a = L / 2, dist = o.modo === 'dist' && kk;
  const hx = (c) => (HCOL[c] && HCOL[c] !== 'transparent' ? HCOL[c] : '#ffffff');
  const stroke = `stroke="${h.motor ? '#000' : '#555'}" stroke-width="${h.motor ? 0.25 : 0.08}"`, X = x.toFixed(2), Y = y.toFixed(2), x0 = (x - a).toFixed(2), x1 = (x + a).toFixed(2), y0 = (y - a).toFixed(2), y1 = (y + a).toFixed(2);
  let g = dist ? `<rect x="${x0}" y="${y0}" width="${L}" height="${L}" fill="#fff" ${stroke} class="rmh"/><path d="M${x0} ${y0}H${x1}L${X} ${Y}Z" fill="${hx(hColSup(kk))}" stroke="#777" stroke-width="0.04"/><path d="M${x0} ${y1}H${x1}L${X} ${Y}Z" fill="${hx(kk.color)}" stroke="#777" stroke-width="0.04"/><rect x="${x0}" y="${y0}" width="${L}" height="${L}" fill="none" ${stroke}/>`
    : `<rect x="${x0}" y="${y0}" width="${L}" height="${L}" fill="${ramColEst(h)}" ${stroke} class="rmh"/>`;
  if (h.motor) g += ramTxt(x - a - txt * 0.2, y + txt * 0.38, 'M', txt * 1.1, 'text-anchor="end" font-weight="700" class="rmhm"');
  if (hecho) g += `<path d="M${x0} ${y0}L${x1} ${y1}M${x1} ${y0}L${x0} ${y1}" stroke="#c0392b" stroke-width="0.18" class="rmhm"/>`;
  // o.lat: hinca de cabecera con inversor -> el rótulo va al costado (izquierda) para no pisar el inversor
  if (o.modo === 'dist') { if (kk) g += o.lat ? ramTxt(x - a - txt * 0.25, y + txt * 0.35, esc(ramCodCorto(h.cod)), txt, 'text-anchor="end" class="rmhl"') : ramTxt(x, y - a - txt * 0.3, esc(ramCodCorto(h.cod)), txt, `text-anchor="middle" class="rmhl"${h.motor ? ' font-weight="700"' : ''}`); }
  else g += o.lat ? ramTxt(x - a - txt * 0.25, y + txt * 0.35, `${k + 1} · ${h.rev.toFixed(2)}`, txt * 0.9, `text-anchor="end" class="rmhl" fill="${h.est !== 'ok' ? '#c0392b' : '#333'}"`)
    : ramTxt(x, y + a + txt * 0.95, `${k + 1} · ${h.rev.toFixed(2)}`, txt * 0.9, `text-anchor="middle" class="rmhl" fill="${h.est !== 'ok' ? '#c0392b' : '#333'}"`);
  return g;
}
// rótulo del tracker: arriba de la primera hinca, por encima del código si lo hay
const ramTrkTxt = (t, L, o, txt) => { const top = Math.min(...L.map((q) => q.y)), invN = ramInvCab().get(t.id) === 'N';
  return ramTxt(L[0].x, invN ? top - 2.0 - 0.6 - txt * 0.35 : top - RAM_LADO / 2 - txt * (o.modo === 'dist' ? 1.55 : 0.45), t.id.replace('TRK-', 'TR '), txt * 1.05, 'text-anchor="middle" font-weight="700" class="rmtid2"'); };
// ¿la hinca k es la de la cabecera donde está el inversor?
const ramLat = (t, L, k) => { const c = ramInvCab().get(t.id); return !!c && (c === 'N' ? k === 0 : k === L.length - 1); };
// STS e inversores (referencia): rectángulo solo con borde y el nombre en la esquina de arriba a la izquierda
const ramInvNom = (id) => { const m = /^TX(\d+)-INV(\d+)$/.exec(id); return m ? `INV ${m[1]}.${m[2]}` : id; };
// todo se dibuja en coordenadas reales (replanteo de hincas y plano de canalización), igual que el DXF: x = X − origen, y = origen − Y
function ramLocal(X, Y) { const [OX, OY] = window.PLANO.origen; return { x: X - OX, y: OY - Y }; }
// rectángulo de cada tracker a partir de sus hincas reales (si no tiene coordenadas, el del plano general)
// cabecera de cada tracker donde está su inversor ('N' o 'S'), según coordenadas reales
let RAMCAB = null;
function ramInvCab() {
  if (RAMCAB) return RAMCAB; RAMCAB = new Map(); const C = ramCalc(), [OX, OY] = window.PLANO.origen;
  (window.PLANO.inv || []).forEach((v) => { const X = OX + v.x, Y = OY - v.y; let b = null, bd = Infinity;
    C.L.forEach((r) => { if (!r.n) return; const ys = r.H.map((h) => h.y), yN = Math.max(...ys), yS = Math.min(...ys), xm = r.H[0].x;
      const dy = Y > yN ? Y - yN : Y < yS ? yS - Y : 0, d = Math.hypot(xm - X, dy); if (d < bd) { bd = d; b = { id: r.t.id, lado: Y > (yN + yS) / 2 ? 'N' : 'S' }; } });
    if (b && bd < 6) RAMCAB.set(b.id, b.lado); });
  return RAMCAB;
}
function ramRect(t) {
  const r = ramCalc().map.get(t.id); if (!r || !r.n) return { x: t.x - t.w / 2, y: t.y - t.h / 2, w: t.w, h: t.h }; // PLANO.trk: x, y = centro del tracker
  const [OX, OY] = window.PLANO.origen, ys = r.H.map((h) => h.y), yN = Math.max(...ys), yS = Math.min(...ys), xm = r.H.reduce((q, h) => q + h.x, 0) / r.n;
  return { x: xm - OX - t.w / 2, y: OY - yN - 1.75, w: t.w, h: yN - yS + 3.5 };
}
function ramRefSVG(tx, conInv) {
  const P = window.PLANO, [OX, OY] = P.origen, L = (o) => Object.assign({}, o, ramLocal(OX + o.x, OY - o.y));
  const sts = (P.sts || []).map(L).map((s) => `<g class="rmsts"><rect x="${s.x - 4}" y="${s.y - 2}" width="8" height="4" fill="none" stroke="#1f2a37" stroke-width="0.3"/>${ramTxt(s.x - 4, s.y - 2 - tx * 0.35, esc(s.id), tx * 1.6, 'font-weight="700" fill="#1f2a37"')}</g>`).join('');
  const inv = (P.inv || []).map(L).map((v) => `<g class="rminv"><rect x="${v.x - 1.3}" y="${v.y - 0.6}" width="2.6" height="1.2" fill="none" stroke="#c25e00" stroke-width="0.2"/>${(() => { const [a1, a2] = ramInvNom(v.id).split(' '); const c = `font-weight="700" fill="#a34e00" class="${conInv ? '' : 'rminvl'}"`; return ramTxt(v.x + 1.5, v.y - 0.05, a1, tx * 0.8, c) + ramTxt(v.x + 1.5, v.y + tx * 0.8, a2 || '', tx * 0.8, c); })()}</g>`).join('');
  return inv + sts;
}
function ramHincasSVG(C, HA, modo) {
  const o = { modo };
  return window.PLANO.trk.map((t) => { const r = C.map.get(t.id); if (!r || !r.n) return '';
    const L = ramPilesLocal(t, r);
    if (modo === 'tubo') return `<g data-t="${t.id}"><title>${t.id}</title>${ramTuboSVG(t, L, 0.85)}</g>`;
    return `<g data-t="${t.id}"><title>${t.id}</title>${ramTrkTxt(t, L, o, 0.85)}` + L.map(({ h, k, x, y }) => ramPilaSVG(h, k, x, y, Object.assign({}, o, { lat: ramLat(t, L, k) }), !!HA[t.id], 0.85)).join('') + '</g>'; }).join('');
}
// referencias (leyenda) de cada plano
function ramRefs(C, modo, dosCol) {
  const ref = '<span><i style="background:#fff;border:2px solid #000"></i>M = hinca motor</span><span><i style="background:#fff;border:1.5px solid #c25e00"></i>Inversor</span><span><i style="background:#fff;border:1.5px solid #1f2a37"></i>STS</span><span>✕ tracker hincado</span>';
  if (modo === 'dist') {
    const m = new Map(); C.L.forEach((r) => r.H.forEach((h) => { const k = h.cod && hcat(h.cod); if (k) { const c = ramCodCorto(h.cod), x = m.get(c) || { k, n: 0 }; x.n++; m.set(c, x); } }));
    if (!m.size) return '<span><b>Falta la distribución de Trina:</b> cargala en Catálogo y distribución.</span>' + ref;
    return '<span class="muted">Triángulo de arriba: color de la cabeza (rojo = general suelo normal, azul = general suelo blando, sin color = motor) · de abajo: color de la punta ·</span>'
      + [...m.entries()].sort().map(([c, x]) => `<span title="${esc(hColTxt(x.k))}">${dosCol(x.k)}${esc(c)} <small class="muted">(${fmt(x.n)})</small></span>`).join('') + ref;
  }
  return '<span><i style="background:#58b368"></i>Dentro de tolerancia</span><span><i style="background:#f0a23b"></i>Salto con la hinca vecina</span><span><i style="background:#d64545"></i>Fuera de tolerancia</span><span class="muted">Rótulo: número de hinca (norte a sur) · altura libre (m)</span>' + ref;
}
// vista del plano (pantalla). modo 'dist' o 'ram'
function ramPlano(b, C, PG, modo = 'ram') {
  const P = window.PLANO, HA = (S.hincado || {}).avance || {}, UI = PUI;
  const dist = modo === 'dist' || modo === 'tubo';
  const leg = modo === 'tubo' ? ramRefsTubo(C) : modo === 'dist' ? ramRefs(C, 'dist', ramDosCol) : RAMUI.color === 'estado' ? '<span class="muted">Trackers:</span>' + Object.entries(RAM_EST).map(([k, [n, c]]) => `<span><i style="background:${c}"></i>${n}</span>`).join('') + '<span class="muted">· hincas: </span>' + ramRefs(C, 'ram')
    : RAMUI.color === 'prog' ? '<span><i style="background:#7c5cbf"></i>Hincado</span><span><i style="background:#2f9e5b"></i>Esta semana</span><span><i style="background:#7cc49a"></i>Próxima</span><span><i style="background:#f0d35b"></i>En 2 semanas</span><span><i style="background:#f0a23b"></i>En 3</span><span><i style="background:#e07b39"></i>4 o más</span>'
    : RAMUI.color === 'hinc' ? '<span><i style="background:#7c5cbf"></i>Hincado</span><span><i style="background:#c9d0da"></i>Pendiente</span>'
    : `<span><i style="background:hsl(130,60%,55%)"></i>${RAMUI.color === 'pend' ? 'Plano' : 'Parejo'}</span><span><i style="background:hsl(65,60%,50%)"></i>Medio</span><span><i style="background:hsl(0,60%,45%)"></i>${RAMUI.color === 'pend' ? 'En la pendiente máxima' : '1 m o más de ondulación'}</span>`;
  const sel = UI.sel && C.map.get(UI.sel);
  const fillT = (r) => (dist ? (HA[r.t.id] ? '#d9d2ec' : r.conCod ? '#e3e8ee' : '#c9d0da') : ramColor(r, PG, HA));
  b.innerHTML = `<div class="rmgrid"><div class="card rmplano">${dist ? '' : `<div class="tools" style="margin:0 0 8px"><div class="seg" id="rmC"><button data-v="estado">Estado</button><button data-v="pend">Pendiente</button><button data-v="ond">Ondulación</button><button data-v="prog">Programa</button><button data-v="hinc">Avance</button></div></div>`}
      <div class="rmwrap"><svg viewBox="${ramVB().join(' ')}" class="rmsvg ${ramZcls()}" preserveAspectRatio="xMidYMid meet" font-family="Arial">${P.trk.map((t) => { const r = C.map.get(t.id), q = ramRect(t); return `<rect data-t="${t.id}" x="${q.x}" y="${q.y}" width="${q.w}" height="${q.h}" fill="${fillT(r)}" class="${UI.sel === t.id ? 'on' : ''}"><title>${t.id}${dist ? ` · ${cfgTxt(cfgDe(t))}` : ` · ${(RAM_EST[r.est] || RAM_EST.sin)[0]}${r.n ? ` · pendiente ${fmt(r.pend, 1)} % · ondulación ${fmt(r.ond, 2)} m` : ''}`}</title></rect>`; }).join('')}
        <g class="rmz1">${ramHincasSVG(C, HA, modo)}</g><g class="rmref">${ramRefSVG(1.2, false)}</g></svg>
        <div class="rmzb"><button class="btn sm" data-z="in" title="Acercar">＋</button><button class="btn sm" data-z="out" title="Alejar">－</button><button class="btn sm" data-z="fit" title="Ver todo el parque">⤢</button>${UI.sel ? '<button class="btn sm" data-z="sel" title="Ir al tracker elegido">◎</button>' : ''}</div></div>
      <div class="legend rmleg">${leg}</div><p class="hint" style="margin:6px 0 0">Rueda del mouse o ＋/－ para hacer zoom, arrastrá para moverte. Al acercarte aparecen los trackers y cada hinca; más cerca, los rótulos.</p></div>
    <div class="card rmdet">${modo === 'tubo' ? (sel ? ramDetTubo(sel) : '<div class="empty" style="padding:30px 10px"><b>Elegí un tracker en el plano</b><p class="muted">Vas a ver su configuración y los tubos de torque de norte a sur, con sección y largo.</p></div>') : modo === 'dist' ? (sel ? ramDetDist(sel) : '<div class="empty" style="padding:30px 10px"><b>Elegí un tracker en el plano</b><p class="muted">Vas a ver su configuración y el código y los colores de cada hinca, de norte a sur.</p></div>')
      : sel ? ramDetalle(sel, PG) : '<div class="empty" style="padding:30px 10px"><b>Elegí un tracker en el plano</b><p class="muted">Vas a ver el perfil del terreno, la línea de cabezas y la altura libre y el empotramiento de cada hinca.</p></div>'}</div></div>`;
  if (!dist) segBind('#rmC', RAMUI.color, (v) => { RAMUI.color = v; render(false); });
  ramZoomBind(b);
}
// ---------- vistas del tracker (esquema a partir de MEC-DW-26050-3401-0A y el manual de montaje) ----------
// cada pieza lleva data-p con su grupo; al pasar sobre un accesorio del listado se resaltan las piezas de su grupo
const TRKV_GEO = {
  '1P52': { luces: [4600, 4650, 4700, 5300, 4600, 4350, 4350, 4600, 5300, 4700, 4650, 4600], mot: 6, mods: 52, damp: [0, 1, 11, 12] },
  '1P26': { luces: [4750, 5150, 4500, 4500, 5150, 4750], mot: 3, mods: 26, damp: [] },
};
const ACC_TAG = [
  [/Drive Unit|Motor Support|M16x50|Wide Flat Washer M16|Hex Flange Nut M16|M20x70|Washer M20|Nut M20/i, 'drive', 'Motor y soporte'],
  [/Post Connection|M12x35|Nut M12|Flange Bolt M16x35/i, 'postc', 'Conector de poste'],
  [/Bearing|Grounding Wire|M6\.3x25/i, 'bearing', 'Rodamiento'],
  [/Rivet/i, 'union', 'Unión de tubos (remaches)'],
  [/Beam plate|Head Bolt M16x35|Flat Washer M16 Steel DIN125/i, 'plate', 'Placas de unión al motor'],
  [/End Cap/i, 'endcap', 'Tapa de tubo'],
  [/Purlin|Nut M10/i, 'purlin', 'Correa Ω y U-bolt'],
  [/M6x16|Nut M6|M8x16|Nut M8 /i, 'modfix', 'Fijación módulo-correa'],
  [/TCU|Terminal|LORA|M8x20|fuse/i, 'tcu', 'TCU y cables'],
  [/Damper|Split Pin/i, 'damper', 'Amortiguador'],
  [/Module|panel/i, 'module', 'Módulo FV'],
];
const accTag = (i) => { const t = ACC_TAG.find(([re]) => re.test(`${i.desc} ${i.cat}`)); return t ? t[1] : ''; };
function trkVistas(tipo) {
  const G = TRKV_GEO[tipo] || TRKV_GEO['1P52'], L = G.luces, X = [0]; L.forEach((l) => X.push(X[X.length - 1] + l));
  const tot = X[X.length - 1], over = tipo === '1P52' ? 2400 : 2150, x0 = -over, x1 = tot + over, W = x1 - x0, mw = 1134, gap = 13, mot = X[G.mot];
  const P = (tag, s) => `<g data-p="${tag}">${s}</g>`;
  // planta: módulos repartidos a cada lado del motor
  const nL = G.mods / 2, Lm = nL * mw + (nL - 1) * gap, mx = []; for (let i = 0; i < nL; i++) { mx.push(mot - 200 - Lm + i * (mw + gap)); mx.push(mot + 200 + i * (mw + gap)); }
  const HM = 2382, yT = HM / 2;
  let pl = P('module', mx.map((x) => `<rect x="${x}" y="0" width="${mw}" height="${HM}" class="tvmod"/>`).join(''));
  pl += P('beam', `<rect x="${x0 + 300}" y="${yT - 65}" width="${W - 600}" height="130" class="tvtube"/>`);
  pl += P('purlin', mx.map((x) => `<rect x="${x + mw / 2 - 25}" y="120" width="50" height="${HM - 240}" class="tvpur"/>`).join(''));
  pl += P('modfix', mx.map((x) => [300, HM - 300].map((y) => `<circle cx="${x + mw / 2}" cy="${y}" r="70" class="tvbolt"/>`).join('')).join(''));
  pl += P('postc', X.map((x, i) => (i === G.mot ? '' : `<rect x="${x - 110}" y="${yT - 160}" width="220" height="320" class="tvpost"/>`)).join(''));
  pl += P('drive', `<rect x="${mot - 330}" y="${yT - 420}" width="660" height="840" class="tvdrive"/>`);
  pl += P('tcu', `<rect x="${mot + 520}" y="${yT + 260}" width="420" height="300" class="tvtcu"/>`);
  pl += P('endcap', [x0 + 300, x1 - 300].map((x) => `<rect x="${x - 60}" y="${yT - 90}" width="120" height="180" class="tvcap"/>`).join(''));
  // vista lateral (escala vertical ×4)
  const ex = 4, H0 = 1315 * ex, gnd = H0 + 900;
  let la = `<line x1="${x0}" y1="${gnd}" x2="${x1}" y2="${gnd}" class="tvgnd"/>`;
  la += P('post', X.map((x, i) => `<rect x="${x - 75}" y="${gnd - H0 + (i === G.mot ? 300 : 0)}" width="150" height="${H0 - (i === G.mot ? 300 : 0) + 1800}" class="tvpostl"/>`).join(''));
  la += P('module', `<rect x="${x0 + 300}" y="${gnd - H0 - 520}" width="${W - 600}" height="90" class="tvmod"/>`);
  la += P('beam', `<rect x="${x0 + 300}" y="${gnd - H0 - 260}" width="${W - 600}" height="260" class="tvtube"/>`);
  la += P('purlin', mx.map((x) => `<rect x="${x + mw / 2 - 40}" y="${gnd - H0 - 430}" width="80" height="170" class="tvpur"/>`).join(''));
  la += P('bearing', X.map((x, i) => (i === G.mot ? '' : `<circle cx="${x}" cy="${gnd - H0 - 130}" r="300" class="tvbear"/>`)).join(''));
  la += P('postc', X.map((x, i) => (i === G.mot ? '' : `<rect x="${x - 130}" y="${gnd - H0 + 170}" width="260" height="560" class="tvpost"/>`)).join(''));
  la += P('drive', `<rect x="${mot - 380}" y="${gnd - H0 - 600}" width="760" height="1500" class="tvdrive"/>`);
  la += P('plate', [mot - 470, mot + 410].map((x) => `<rect x="${x}" y="${gnd - H0 - 330}" width="60" height="400" class="tvplate"/>`).join(''));
  // uniones remachadas entre tubos (los cambios de tubo que no son el motor)
  const tub = tubosDe({ t: tipo, z: 'Outer' }), tl = tub.reduce((a, c) => a + TUBO_LARGO[c], 0); let u = mot - tl / 2; const J = [];
  tub.forEach((c, i) => { u += TUBO_LARGO[c]; if (i < tub.length - 1 && Math.abs(u - mot) > 50) J.push(u); });
  la += P('union', J.map((x) => `<rect x="${x - 120}" y="${gnd - H0 - 300}" width="240" height="340" class="tvunion"/>`).join(''));
  la += P('endcap', [x0 + 300, x1 - 300].map((x) => `<rect x="${x - 70}" y="${gnd - H0 - 290}" width="140" height="320" class="tvcap"/>`).join(''));
  la += P('damper', G.damp.map((i) => `<line x1="${X[i] + 120}" y1="${gnd - H0 + 1200}" x2="${X[i] + 1300}" y2="${gnd - H0 - 100}" class="tvdamp"/>`).join(''));
  la += P('tcu', `<rect x="${mot + 520}" y="${gnd - H0 + 200}" width="420" height="700" class="tvtcu"/>`);
  la += X.map((x, i) => `<text x="${x}" y="${gnd + 900}" class="tvtx" text-anchor="middle">${i + 1}${i === G.mot ? ' M' : ''}</text>`).join('') + L.map((l, i) => `<text x="${(X[i] + X[i + 1]) / 2}" y="${gnd + 1900}" class="tvtx tvmut" text-anchor="middle">${fmt(l)}</text>`).join('');
  // corte E-O por una hinca con amortiguador (escala real, mm)
  const cx = 1700, tY = 1315 + 300, gY = tY + 1315;
  let co = `<line x1="0" y1="${gY}" x2="3400" y2="${gY}" class="tvgnd"/>`;
  co += P('post', `<rect x="${cx - 75}" y="${tY + 230}" width="150" height="${1315 + 400}" class="tvpostl"/>`);
  co += P('postc', `<rect x="${cx - 110}" y="${tY + 120}" width="220" height="380" class="tvpost"/><circle cx="${cx - 50}" cy="${tY + 220}" r="22" class="tvbolt"/><circle cx="${cx + 50}" cy="${tY + 220}" r="22" class="tvbolt"/><circle cx="${cx - 50}" cy="${tY + 400}" r="22" class="tvbolt"/><circle cx="${cx + 50}" cy="${tY + 400}" r="22" class="tvbolt"/>`);
  co += P('bearing', `<circle cx="${cx}" cy="${tY}" r="135" class="tvbear"/>`);
  co += P('beam', `<rect x="${cx - 65}" y="${tY - 65}" width="130" height="130" class="tvtube"/>`);
  co += P('purlin', `<rect x="${cx - 1150}" y="${tY - 95}" width="2300" height="30" class="tvpur"/><path d="M${cx - 80} ${tY - 65} v-30 M${cx + 80} ${tY - 65} v-30" class="tvub"/>`);
  co += P('module', `<rect x="${cx - 1191}" y="${tY - 135}" width="2382" height="40" class="tvmod"/><g transform="rotate(-60 ${cx} ${tY})"><rect x="${cx - 1191}" y="${tY - 135}" width="2382" height="40" class="tvmodr"/></g>`);
  co += P('modfix', [cx - 900, cx + 900].map((x) => `<circle cx="${x}" cy="${tY - 100}" r="28" class="tvbolt"/>`).join(''));
  co += P('damper', `<line x1="${cx + 70}" y1="${tY + 650}" x2="${cx + 520}" y2="${tY - 20}" class="tvdamp"/>`);
  co += `<line x1="${cx + 596}" y1="${tY + 1032 - 120}" x2="${cx + 596}" y2="${gY}" class="tvdim"/><text x="${cx + 640}" y="${(tY + 1032 + gY) / 2}" class="tvtx tvmut">≥ 500 a 60°</text>`;
  const vista = (t, vb, inner, h) => `<div class="tvbox"><div class="tvtit">${t}</div><svg viewBox="${vb}" style="height:${h}px" preserveAspectRatio="xMidYMid meet" font-family="Arial">${inner}</svg></div>`;
  return `<div class="trkv">${vista(`Vista en planta · ${tipo} · ${G.mods} módulos · ${X.length} hincas (M = motor)`, `${x0} -300 ${W} ${HM + 600}`, pl, 92)}
    ${vista('Vista lateral N-S · escala vertical ×4 · luces entre hincas (mm)', `${x0} ${gnd - H0 - 900} ${W} ${H0 + 3200}`, la, 150)}
    <div class="tvrow">${vista('Corte E-O por hinca con amortiguador · módulo a 0° y a 60°', `0 ${tY - 1300} 3400 ${gY - tY + 1500}`, co, 230)}<div class="tvley">${ACC_TAG.map(([, t, n]) => `<span data-tag="${t}"><i class="tvsw tv-${t}"></i>${n}</span>`).join('')}<span data-tag="post"><i class="tvsw tv-post"></i>Hinca</span><span data-tag="beam"><i class="tvsw tv-beam"></i>Tubo de torque</span><p class="hint">Pasá el mouse sobre un accesorio del listado o de esta lista para ver dónde va. Esquema según Trina MEC-DW-26050-3401-0A y el manual de montaje; no es un plano de fabricación.</p></div></div></div>`;
}
const trkvHL = (root, tag) => { const v = $('.trkv', root); if (!v) return; v.classList.toggle('tvon', !!tag); $$('[data-p]', v).forEach((g) => g.classList.toggle('tvhl', !!tag && g.dataset.p === tag)); $$('.tvley [data-tag]', v).forEach((x) => x.classList.toggle('on', x.dataset.tag === tag)); };
// ---------- apartado Tipos de tracker: cantidad por configuración (1P52 / 1P26 · exterior, borde, interior · suelo) y sector ----------
const TIPO_COL = { '1P52|Outer': '#e15759', '1P52|Border': '#f28e2b', '1P52|Inner': '#4e79a7', '1P26|Outer': '#b07aa1', '1P26|Border': '#59a14f' };
const TIPO_ORD = ['1P52|Outer|N', '1P52|Outer|B', '1P52|Border|N', '1P52|Border|B', '1P52|Inner|N', '1P52|Inner|B', '1P26|Outer|N', '1P26|Outer|B', '1P26|Border|N', '1P26|Border|B'];
const tipoTxt = (k) => { const [t, z, sl] = k.split('|'); return `${t} ${HZ[z] || z} (${z})${sl ? ` · ${HSL[sl]}` : ''}`; };
function tipoConteo(C) { const m = new Map(); C.L.forEach((r) => { const k = cfgDe(r.t), x = m.get(k) || {}; x[r.t.s] = (x[r.t.s] || 0) + 1; m.set(k, x); }); return m; }
function tipoSVG(C, sel, txt = 30, solo = false) {
  const P = window.PLANO, cen = {}, T = solo && sel ? P.trk.filter((t) => t.s === sel) : P.trk, xs = T.map((t) => ramRect(t));
  const R = T.map((t, i) => { const q = xs[i], c = cen[t.s] = cen[t.s] || { x: 0, y: 0, n: 0 }; c.x += q.x + q.w / 2; c.y += q.y + q.h / 2; c.n++; const k = `${t.t}|${t.z || 'Outer'}`, bl = (t.sl || 'N') === 'B';
    return `<rect data-s="${t.s}" x="${q.x}" y="${q.y}" width="${q.w}" height="${q.h}" fill="${TIPO_COL[k] || '#999'}" fill-opacity="${!sel || sel === t.s ? 0.9 : 0.25}" stroke="${bl ? '#111' : 'none'}" stroke-width="${bl ? 0.9 : 0}" stroke-dasharray="${bl ? '2 1.2' : ''}"><title>${t.id} · S${t.s} · ${esc(tipoTxt(cfgDe(t)))}</title></rect>`; }).join('');
  const L = Object.entries(cen).map(([s, c]) => ramTxt(c.x / c.n, c.y / c.n + txt * 0.35, 'S' + s, txt, 'text-anchor="middle" font-weight="700" fill="#111" class="rmhl" pointer-events="none"')).join('');
  const bb = [Math.min(...xs.map((q) => q.x)) - 10, Math.min(...xs.map((q) => q.y)) - 10, Math.max(...xs.map((q) => q.x + q.w)) - Math.min(...xs.map((q) => q.x)) + 20, Math.max(...xs.map((q) => q.y + q.h)) - Math.min(...xs.map((q) => q.y)) + 20];
  return { svg: R + L + (solo ? '' : `<g class="rmref">${ramRefSVG(2.4, false)}</g>`), bb };
}
function tipoTabla(C, secs, cls) {
  const m = tipoConteo(C), ks = TIPO_ORD.filter((k) => m.has(k)).concat([...m.keys()].filter((k) => !TIPO_ORD.includes(k))), sum = (x) => secs.reduce((a, s) => a + (x[s] || 0), 0);
  const sec = (s) => C.L.filter((r) => r.t.s === s), pan = (L) => L.reduce((a, r) => a + (r.t.t === '1P26' ? 26 : 52), 0), hin = (L) => L.reduce((a, r) => a + r.n, 0);
  const fila = (k) => { const x = m.get(k), [t, z] = k.split('|'); return `<tr><td><i class="rmsw" style="background:${TIPO_COL[t + '|' + z] || '#999'}"></i><b>${esc(t)}</b></td><td>${esc(HZ[z] || z)} <span class="muted">(${esc(z)})</span></td><td>${esc(HSL[k.split('|')[2]] || '')}</td><td class="n">${t === '1P26' ? 26 : 52}</td>${secs.map((s) => `<td class="n">${x[s] ? fmt(x[s]) : '–'}</td>`).join('')}<td class="n"><b>${fmt(sum(x))}</b></td></tr>`; };
  const sub = (t) => { const L = C.L.filter((r) => r.t.t === t); return L.length ? `<tr class="rmrest"><td colspan="4">Subtotal ${t}</td>${secs.map((s) => `<td class="n">${fmt(L.filter((r) => r.t.s === s).length)}</td>`).join('')}<td class="n"><b>${fmt(L.filter((r) => secs.includes(r.t.s)).length)}</b></td></tr>` : ''; };
  return `<table class="${cls} rmrestb"><thead><tr><th>Tracker</th><th>Posición</th><th>Suelo</th><th class="n">Paneles por tracker</th>${secs.map((s) => `<th class="n">Sector ${s}</th>`).join('')}<th class="n">Total</th></tr></thead><tbody>
    ${ks.filter((k) => k.startsWith('1P52')).map(fila).join('')}${sub('1P52')}${ks.filter((k) => k.startsWith('1P26')).map(fila).join('')}${sub('1P26')}
    <tr class="rmrest"><td colspan="4"><b>Total trackers</b></td>${secs.map((s) => `<td class="n"><b>${fmt(sec(s).length)}</b></td>`).join('')}<td class="n"><b>${fmt(secs.reduce((a, s) => a + sec(s).length, 0))}</b></td></tr>
    <tr class="rmrest"><td colspan="4">Paneles solares</td>${secs.map((s) => `<td class="n">${fmt(pan(sec(s)))}</td>`).join('')}<td class="n">${fmt(secs.reduce((a, s) => a + pan(sec(s)), 0))}</td></tr>
    <tr class="rmrest"><td colspan="4">Hincas</td>${secs.map((s) => `<td class="n">${fmt(hin(sec(s)))}</td>`).join('')}<td class="n">${fmt(secs.reduce((a, s) => a + hin(sec(s)), 0))}</td></tr></tbody></table>
    <p class="rmrnota">Exterior (Outer), Borde (Border) e Interior (Inner): posición del tracker en el bloque según la discretización de Trina; los exteriores llevan motor de 7" y el tubo central de 3,0 mm. Suelo blando: trackers con hincas para suelo blando (borde punteado en el plano).</p>`;
}
const tipoLeyenda = () => Object.entries(TIPO_COL).map(([k, c]) => `<span><i style="background:${c}"></i>${esc(tipoTxt(k))}</span>`).join('') + '<span><i style="background:#fff;border:1.5px dashed #111"></i>suelo blando</span>';
function vHTipos(el, C, secs) {
  const sel = DISTUI.tipoSec && secs.includes(DISTUI.tipoSec) ? DISTUI.tipoSec : null, M = tipoSVG(C, sel), ss = sel ? [sel] : secs, m = tipoConteo(C);
  actions([['PDF · todo el parque', 'btn', () => tipoPdf(C, secs)], ['PDF · todo el parque + una hoja por sector', 'btn', () => tipoPdf(C, secs, 'all')],
    ...(sel ? [[`PDF · sector ${sel}`, 'btn', () => tipoPdf(C, secs, sel)], [`Exportar Excel · sector ${sel}`, 'btn', () => tipoExcel(C, [sel])]] : []),
    ['Exportar Excel · todo el parque (con una hoja por sector)', 'btn', () => tipoExcel(C, secs)]]);
  const L = C.L.filter((r) => ss.includes(r.t.s)), n = (f) => L.filter(f).length;
  el.innerHTML = `<div class="tools" style="margin-bottom:12px"><div class="seg" id="dT"><button data-v="hinc">Hincas</button><button data-v="tubo">Tubos de torque</button><button data-v="acc">Accesorios</button><button data-v="tipo">Tipos de tracker</button></div></div>
    <div class="grid g4 stagger" style="margin-bottom:12px">
      <div class="card kpi"><div class="kl">Trackers${sel ? ` · sector ${sel}` : ''}</div><div class="kv">${fmt(L.length)}</div><div class="muted">${fmt(n((r) => r.t.t === '1P52'))} 1P52 · ${fmt(n((r) => r.t.t === '1P26'))} 1P26</div></div>
      <div class="card kpi"><div class="kl">Exterior · Borde · Interior</div><div class="kv" style="font-size:18px">${fmt(n((r) => (r.t.z || 'Outer') === 'Outer'))} · ${fmt(n((r) => r.t.z === 'Border'))} · ${fmt(n((r) => r.t.z === 'Inner'))}</div><div class="muted">Outer · Border · Inner</div></div>
      <div class="card kpi"><div class="kl">Suelo blando</div><div class="kv">${fmt(n((r) => r.t.sl === 'B'))}</div><div class="muted">${fmt(n((r) => r.t.sl !== 'B'))} en suelo normal</div></div>
      <div class="card kpi"><div class="kl">Paneles solares</div><div class="kv">${fmt(L.reduce((a, r) => a + (r.t.t === '1P26' ? 26 : 52), 0))}</div><div class="muted">52 por 1P52 · 26 por 1P26</div></div></div>
    <div class="rmgrid"><div class="card rmplano"><div class="tools" style="margin:0 0 8px"><div class="seg" id="dS"><button data-v="">Todo el parque</button>${secs.map((s) => `<button data-v="${s}">S${s}</button>`).join('')}</div></div>
      <div class="rmwrap"><svg viewBox="${M.bb.join(' ')}" class="rmsvg rmsecs" preserveAspectRatio="xMidYMid meet" font-family="Arial">${M.svg}</svg></div>
      <div class="rmley">${tipoLeyenda()}</div></div>
    <div class="card rmdet"><h3>${sel ? `Sector ${sel}` : 'Todo el parque'} · trackers por tipo</h3><div class="tblwrap"><table class="tbl rmrestb"><thead><tr><th>Tipo</th><th class="n">Suelo normal</th><th class="n">Suelo blando</th><th class="n">Total</th></tr></thead><tbody>
      ${['1P52|Outer', '1P52|Border', '1P52|Inner', '1P26|Outer', '1P26|Border'].map((k) => { const c = (sl) => L.filter((r) => `${r.t.t}|${r.t.z || 'Outer'}` === k && (r.t.sl || 'N') === sl).length, t = c('N') + c('B'); return t ? `<tr><td><i class="rmsw" style="background:${TIPO_COL[k]}"></i><b>${k.split('|')[0]}</b> ${esc(HZ[k.split('|')[1]])} <span class="muted">(${k.split('|')[1]})</span></td><td class="n">${c('N') ? fmt(c('N')) : '–'}</td><td class="n">${c('B') ? fmt(c('B')) : '–'}</td><td class="n"><b>${fmt(t)}</b></td></tr>` : ''; }).join('')}
      <tr class="rmrest"><td><b>Total</b></td><td class="n">${fmt(n((r) => r.t.sl !== 'B'))}</td><td class="n">${fmt(n((r) => r.t.sl === 'B'))}</td><td class="n"><b>${fmt(L.length)}</b></td></tr></tbody></table></div>
      <p class="hint">Tocá un sector en el plano o arriba. ${fmt(L.reduce((a, r) => a + r.n, 0))} hincas y ${fmt(L.reduce((a, r) => a + (r.t.t === '1P26' ? 26 : 52), 0))} paneles en ${sel ? 'el sector' : 'el parque'}.</p></div></div>
    <div class="card" style="margin-top:16px"><h3>Trackers por tipo y sector</h3><div class="tblwrap">${tipoTabla(C, secs, 'tbl')}</div></div>
    <h2 class="sech" style="margin-top:22px">Catálogo y distribución de hincas por configuración (Trina)</h2><div id="hcatB"></div>`;
  segBind('#dT', 'tipo', (v) => { DISTUI.tab = v; render(false); });
  segBind('#dS', sel || '', (v) => { DISTUI.tipoSec = v || null; render(false); });
  $$('.rmsecs rect[data-s]', el).forEach((r) => { r.style.cursor = 'pointer'; r.onclick = () => { DISTUI.tipoSec = DISTUI.tipoSec === r.dataset.s ? null : r.dataset.s; render(false); }; });
  if (typeof vHCat === 'function') { const a0 = window.actions; window.actions = () => {}; try { vHCat($('#hcatB', el)); } finally { window.actions = a0; } }
}
async function tipoExcel(C, secs) {
  const m = tipoConteo(C), wb = XLSX.utils.book_new(), ks = TIPO_ORD.filter((k) => m.has(k) && secs.some((s) => m.get(k)[s])), uno = secs.length === 1;
  C = { ...C, L: C.L.filter((r) => secs.includes(r.t.s)) };
  const a = [['Tracker', 'Posición', 'Posición (Trina)', 'Suelo', 'Paneles por tracker'].concat(secs.map((s) => 'Sector ' + s), ['Total'])];
  ks.forEach((k) => { const [t, z, sl] = k.split('|'), x = m.get(k); a.push([t, HZ[z] || z, z, HSL[sl], t === '1P26' ? 26 : 52].concat(secs.map((s) => x[s] || 0), [secs.reduce((q, s) => q + (x[s] || 0), 0)])); });
  const sec = (s) => C.L.filter((r) => r.t.s === s);
  a.push([], ['Total trackers', '', '', '', ''].concat(secs.map((s) => sec(s).length), [C.L.length]), ['Paneles solares', '', '', '', ''].concat(secs.map((s) => sec(s).reduce((q, r) => q + (r.t.t === '1P26' ? 26 : 52), 0)), [C.L.reduce((q, r) => q + (r.t.t === '1P26' ? 26 : 52), 0)]), ['Hincas', '', '', '', ''].concat(secs.map((s) => sec(s).reduce((q, r) => q + r.n, 0)), [C.L.reduce((q, r) => q + r.n, 0)]));
  const b = [['Tracker', 'Frame', 'Sector', 'Tipo', 'Posición', 'Posición (Trina)', 'Suelo', 'Hincas', 'Paneles']];
  C.L.forEach((r) => b.push([r.t.id, (repDe(r.t.id) || {}).fr || '', r.t.s, r.t.t, HZ[r.t.z || 'Outer'], r.t.z || 'Outer', HSL[r.t.sl || 'N'], r.n, r.t.t === '1P26' ? 26 : 52]));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(a), uno ? 'Sector ' + secs[0] : 'Tipos por sector');
  if (!uno) secs.forEach((s) => { const Ls = C.L.filter((r) => r.t.s === s), c = [['Sector ' + s], [], ['Tracker', 'Posición', 'Posición (Trina)', 'Suelo', 'Paneles por tracker', 'Cantidad']];
    ks.forEach((k) => { const [t, z, sl] = k.split('|'), q = m.get(k)[s] || 0; if (q) c.push([t, HZ[z] || z, z, HSL[sl], t === '1P26' ? 26 : 52, q]); });
    c.push([], ['Total trackers', '', '', '', '', Ls.length], ['Paneles solares', '', '', '', '', Ls.reduce((q, r) => q + (r.t.t === '1P26' ? 26 : 52), 0)], ['Hincas', '', '', '', '', Ls.reduce((q, r) => q + r.n, 0)], [], ['Tracker', 'Frame', 'Tipo', 'Posición', 'Suelo', 'Hincas']);
    Ls.forEach((r) => c.push([r.t.id, (repDe(r.t.id) || {}).fr || '', r.t.t, HZ[r.t.z || 'Outer'], HSL[r.t.sl || 'N'], r.n]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(c), 'Sector ' + s); });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(b), 'Por tracker');
  const p = await window.api.saveBinary(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }), `Tipos de tracker ${uno ? 'sector ' + secs[0] : 'por sector'} ${today()}.xlsx`, 'xlsx', 'Excel');
  if (p) toast('Excel exportado', { action: ['Abrir', () => window.api.openPath(p)] });
}
function tipoPdf(C, secs, modo) {
  const A = ramArea('A3', false), M = tipoSVG(C, null, 34);
  const hoja = (s) => { const Ms = tipoSVG(C, s, 18, true), Ls = C.L.filter((r) => r.t.s === s), q = (f) => Ls.filter(f).length;
    return `<section class="rmpg rmres-pg" data-o="L" style="width:${A.pw}mm;height:${A.ph}mm"><div class="rmpgh"><div><b>Tipos de tracker · Sector ${s}</b><br>${esc(S.nombre || '')}</div><div style="text-align:right">${fmt(Ls.length)} trackers · ${fmt(q((r) => (r.t.z || 'Outer') === 'Outer'))} exteriores · ${fmt(q((r) => r.t.z === 'Border'))} de borde · ${fmt(q((r) => r.t.z === 'Inner'))} interiores · ${fmt(q((r) => r.t.sl === 'B'))} en suelo blando<br>Layout · BOM Trina · ${new Date().toLocaleDateString('es-AR')}</div></div>
    <svg viewBox="${Ms.bb.join(' ')}" style="display:block;width:${A.pw - 16}mm;height:165mm" preserveAspectRatio="xMidYMid meet" font-family="Arial">${Ms.svg}</svg>
    <div class="rmrcod" style="margin:2mm 0">${tipoLeyenda()}</div>${tipoTabla(C, [s], 'rmres')}</section>`; };
  if (modo && modo !== 'all') return ramPrintPaginas(hoja(modo), `Tipos de tracker sector ${modo} ${today()}.pdf`, 'A3', ['L']);
  const p1 = `<section class="rmpg rmres-pg" data-o="L" style="width:${A.pw}mm;height:${A.ph}mm"><div class="rmpgh"><div><b>Tipos de tracker por sector</b><br>${esc(S.nombre || '')}</div><div style="text-align:right">Layout · BOM Trina · ${new Date().toLocaleDateString('es-AR')}</div></div>
    <svg viewBox="${M.bb.join(' ')}" style="display:block;width:${A.pw - 16}mm;height:135mm" preserveAspectRatio="xMidYMid meet" font-family="Arial">${M.svg}</svg>
    <div class="rmrcod" style="margin:2mm 0">${tipoLeyenda()}</div>${tipoTabla(C, secs, 'rmres')}</section>`;
  const pags = [p1].concat(modo === 'all' ? secs.map(hoja) : []);
  ramPrintPaginas(pags.join(''), `Tipos de tracker ${modo === 'all' ? 'parque y sectores' : 'por sector'} ${today()}.pdf`, 'A3', pags.map(() => 'L'));
}
// ---------- apartado Accesorios: plano de sectores y resumen del sector elegido ----------
const SEC_COL = ['#4e79a7', '#f28e2b', '#59a14f', '#e15759', '#b07aa1', '#edc948', '#76b7b2', '#9c755f'];
function ramSecSVG(C, secs, sel, txt = 30) {
  const P = window.PLANO, col = (s) => SEC_COL[secs.indexOf(s) % SEC_COL.length], cen = {};
  const R = P.trk.map((t) => { const q = ramRect(t); const c = cen[t.s] = cen[t.s] || { x: 0, y: 0, n: 0 }; c.x += q.x + q.w / 2; c.y += q.y + q.h / 2; c.n++;
    return `<rect data-s="${t.s}" x="${q.x}" y="${q.y}" width="${q.w}" height="${q.h}" fill="${col(t.s)}" fill-opacity="${!sel || sel === t.s ? 0.85 : 0.25}" stroke="${sel === t.s ? '#111' : 'none'}" stroke-width="0.6"><title>Sector ${t.s} · ${t.id}</title></rect>`; }).join('');
  const L = Object.entries(cen).map(([s, c]) => ramTxt(c.x / c.n, c.y / c.n + txt * 0.35, 'S' + s, txt, 'text-anchor="middle" font-weight="700" fill="#111" pointer-events="none"')).join('');
  const xs = P.trk.map((t) => ramRect(t)), bb = [Math.min(...xs.map((q) => q.x)) - 10, Math.min(...xs.map((q) => q.y)) - 10, Math.max(...xs.map((q) => q.x + q.w)) - Math.min(...xs.map((q) => q.x)) + 20, Math.max(...xs.map((q) => q.y + q.h)) - Math.min(...xs.map((q) => q.y)) + 20];
  return { svg: R + L + `<g class="rmref">${ramRefSVG(2.4, false)}</g>`, bb };
}
// resumen del sector: principales accesorios en tarjetas y la tabla completa
const ramPaneles = (C) => { const o = {}; C.L.forEach((r) => { o[r.t.s] = (o[r.t.s] || 0) + (r.t.t === '1P26' ? 26 : 52); }); return o; };
function ramAccRes(C, sec) {
  const { A, m } = accConteo(C), v = (re) => A.items.filter((i) => re.test(`${i.cat} ${i.desc}`)).reduce((a, i) => a + Object.entries(m.get(i.k) || {}).filter(([s]) => !sec || s === sec).reduce((q, [, x]) => q + x, 0), 0);
  const pan = Object.entries(ramPaneles(C)).filter(([s]) => !sec || s === sec).reduce((a, [, n]) => a + n, 0);
  const K = [['Motores 5"', /Drive Unit.*\(5"\)/i], ['Motores 7"', /Drive Unit.*\(7"\)/i], ['Rodamientos', /^BEARING Bearing\(130/i], ['Rodamientos exteriores', /Outer Bearing/i], ['Amortiguadores', /^DAMPER Damper$/i], ['TCU', /^TCU Plastic/i], ['Correas Ω', /^PURLIN/i], ['U-bolts de correa', /Purlin U-bolt/i], ['Tapas de tubo', /End Cap/i], ['Remaches T8-9', /Rivet LMB/i], ['Bulones', /^FASTENER .*Bolt/i], ['Tuercas', /^FASTENER .*Nut/i]];
  const nT = C.L.filter((r) => !sec || r.t.s === sec).length;
  return `<div class="rmacck"><div class="rmpan"><small>Paneles solares</small><b>${fmt(pan)}</b></div>${K.map(([n, re]) => `<div><small>${n}</small><b>${fmt(v(re))}</b></div>`).join('')}</div><p class="muted" style="margin:6px 0 10px">${sec ? `Sector ${sec}` : 'Todo el parque'} · ${fmt(nT)} trackers · cantidades del BOM de Trina por tipo de tracker, sin repuestos.</p>`;
}
function vHAcc(el, C, secs) {
  const sel = DISTUI.accSec && secs.includes(DISTUI.accSec) ? DISTUI.accSec : null, M = ramSecSVG(C, secs, sel);
  actions([['PDF · accesorios por sector', 'btn', () => ramAccPdf(C, secs)], ['Exportar Excel', 'btn', () => accExcel(C, secs)]]);
  el.innerHTML = `<div class="tools" style="margin-bottom:12px"><div class="seg" id="dT"><button data-v="hinc">Hincas</button><button data-v="tubo">Tubos de torque</button><button data-v="acc">Accesorios</button><button data-v="tipo">Tipos de tracker</button></div></div>
    <div class="rmgrid"><div class="card rmplano"><div class="tools" style="margin:0 0 8px"><div class="seg" id="dS"><button data-v="">Todo el parque</button>${secs.map((s) => `<button data-v="${s}">S${s}</button>`).join('')}</div></div>
      <div class="rmwrap"><svg viewBox="${M.bb.join(' ')}" class="rmsvg rmsecs" preserveAspectRatio="xMidYMid meet" font-family="Arial">${M.svg}</svg></div>
      <p class="hint" style="margin:6px 0 0">Tocá un sector en el plano (o arriba) para ver sus accesorios.</p></div>
    <div class="card rmdet"><h3>${sel ? `Sector ${sel}` : 'Todo el parque'} · accesorios</h3>${ramAccRes(C, sel)}<div class="tblwrap" style="max-height:52vh">${ramAccTabla(C, sel ? [sel] : secs, 'tbl')}</div></div></div>
    <div class="card" style="margin-top:16px"><div style="display:flex;align-items:center;gap:10px"><h3 style="margin:0;flex:1">Tracker · vistas principales</h3><div class="seg" id="dV"><button data-v="1P52">1P52</button><button data-v="1P26">1P26</button></div></div>${trkVistas(DISTUI.accTipo || '1P52')}</div>
    <div class="card" style="margin-top:16px"><h3>Accesorios por sector · motores, rodamientos, bulonería y demás</h3><div class="tblwrap" style="max-height:560px">${ramAccTabla(C, secs, 'tbl')}</div></div>`;
  segBind('#dV', DISTUI.accTipo || '1P52', (v) => { DISTUI.accTipo = v; render(false); });
  $$('[data-tag]', el).forEach((x) => { x.onmouseenter = () => trkvHL(el, x.dataset.tag); x.onmouseleave = () => trkvHL(el, null); });
  segBind('#dT', 'acc', (v) => { DISTUI.tab = v; render(false); });
  segBind('#dS', sel || '', (v) => { DISTUI.accSec = v || null; render(false); });
  $$('.rmsecs rect[data-s]', el).forEach((r) => { r.style.cursor = 'pointer'; r.onclick = () => { DISTUI.accSec = DISTUI.accSec === r.dataset.s ? null : r.dataset.s; render(false); }; });
}
async function accExcel(C, secs) {
  const { A, m } = accConteo(C), wb = XLSX.utils.book_new();
  const a = [['Categoría', 'Material', 'Descripción', 'Tamaño'].concat(A.tipos.map((t) => 'Por tracker ' + cfgTxt(t)), secs.map((s) => 'Sector ' + s), ['Total'])];
  A.items.filter((i) => m.has(i.k)).forEach((i) => { const x = m.get(i.k); a.push([accCat(i.cat), i.k, i.desc, i.size || ''].concat(i.q, secs.map((s) => x[s] || 0), [secs.reduce((q, s) => q + (x[s] || 0), 0)])); });
  const b = [['Sector'].concat(A.tipos.map(cfgTxt), ['Trackers'])]; secs.forEach((s) => { const L = C.L.filter((r) => r.t.s === s); b.push([s].concat(A.tipos.map((t) => L.filter((r) => `${r.t.t}|${r.t.z || 'Outer'}|${r.t.sl || 'N'}` === t).length), [L.length])); });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(a), 'Accesorios por sector'); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(b), 'Trackers por tipo');
  const p = await window.api.saveBinary(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }), `Accesorios por sector ${today()}.xlsx`, 'xlsx', 'Excel');
  if (p) toast('Excel exportado', { action: ['Abrir', () => window.api.openPath(p)] });
}
// PDF: plano de sectores con el resumen de cada uno y la tabla completa
function ramAccPdf(C, secs) {
  const A = ramArea('A3', false), M = ramSecSVG(C, secs, null, 34);
  const k = secs.map((s) => `<div class="rmaccs"><b style="color:${SEC_COL[secs.indexOf(s) % SEC_COL.length]}">Sector ${s}</b>${ramAccRes(C, s)}</div>`).join('');
  const p1 = `<section class="rmpg rmres-pg" data-o="L" style="width:${A.pw}mm;height:${A.ph}mm"><div class="rmpgh"><div><b>Accesorios por sector · plano de sectores y resumen</b><br>${esc(S.nombre || '')}</div><div style="text-align:right">BOM Trina · ${new Date().toLocaleDateString('es-AR')}</div></div>
    <svg viewBox="${M.bb.join(' ')}" style="display:block;width:${A.pw - 16}mm;height:120mm" preserveAspectRatio="xMidYMid meet" font-family="Arial">${M.svg}</svg><div class="rmaccg">${k}</div></section>`;
  const pags = [p1].concat(ramAccPag(C, {}, secs, A));
  ramPrintPaginas(pags.join(''), `Accesorios por sector ${today()}.pdf`, 'A3', pags.map(() => 'L'));
}
function ramRefsTubo(C) {
  const m = ramConteo(C, 'tubo'), sum = (x) => Object.values(x).reduce((a, b) => a + b, 0);
  return [...m.keys()].sort((a, b) => TUBO_ORD.indexOf(a) - TUBO_ORD.indexOf(b)).map((c) => { const i = tuboInfo(c); return `<span title="${esc(i.size)}"><i style="background:${i.col}"></i>${esc(c)} <small class="muted">${fmt(i.largo / 1000, 2)} m · ${fmt(sum(m.get(c)))}${tuboMarca(c).length ? ' · pintura ' + esc(tuboMarca(c).join(' y ').toLowerCase()) : ''}</small></span>`; }).join('')
    + '<span><i style="background:#000;border:1px solid #000"></i>hinca motor (M)</span><span><i style="background:#fff;border:1.5px solid #c25e00"></i>Inversor</span><span><i style="background:#fff;border:1.5px solid #1f2a37"></i>STS</span>';
}
function ramDetTubo(r) {
  const HA = (S.hincado || {}).avance || {}, L = tubosDe(r.t);
  return `<div class="rmdh"><h3>${r.t.id} <span class="muted" style="font-weight:400">· frame ${esc((repDe(r.t.id) || {}).fr || '')} · S${r.t.s}</span></h3>${HA[r.t.id] ? `<span class="pill p-done">hincado ${fechaCorta(HA[r.t.id].f)}</span>` : ''}</div>
    <div class="rmkv"><span>Configuración <b>${esc(cfgTxt(cfgDe(r.t)))}</b></span><span>${L.length} tubos · ${fmt(L.reduce((a, c) => a + TUBO_LARGO[c], 0) / 1000, 2)} m</span></div>
    <div class="tblwrap" style="max-height:60vh"><table class="tbl"><thead><tr><th>#</th><th>Tubo (plano Trina)</th><th>Marca de pintura</th><th>Sección</th><th class="n">Largo (mm)</th></tr></thead><tbody>
    ${L.map((c, k) => { const i = tuboInfo(c); return `<tr><td>${k + 1}</td><td><i class="rmsw" style="background:${i.col}"></i><b>26050-${esc(c)}</b></td><td>${tuboMarcaH(c)}</td><td>${esc(i.size)}</td><td class="n">${fmt(i.largo)}</td></tr>`; }).join('')}</tbody></table></div>
    <p class="hint">Tubos de norte a sur según Trina ${esc(TUBO_DOC)}.</p>`;
}
async function tuboExcel() {
  const C = ramCalc(), wb = XLSX.utils.book_new(), secs = [...new Set(C.L.map((r) => r.t.s))].sort(), m = ramConteo(C, 'tubo');
  const a = [['Plano Trina', 'Material', 'Sección', 'Largo (mm)', 'Marca de pintura'].concat(secs.map((s) => 'Sector ' + s), ['Total'])];
  TUBO_ORD.filter((c) => m.has(c)).forEach((c) => { const i = tuboInfo(c), x = m.get(c), t = secs.reduce((q, s) => q + (x[s] || 0), 0); a.push(['26050-' + c, i.k, i.size, i.largo, tuboMarca(c).join(' y ') || 'sin dato'].concat(secs.map((s) => x[s] || 0), [t])); });
  const b = [['Tracker', 'Frame', 'Sector', 'Configuración'].concat(Array.from({ length: 6 }, (_, i) => 'Tubo ' + (i + 1) + ' (N→S)'))];
  C.L.forEach((r) => b.push([r.t.id, (repDe(r.t.id) || {}).fr || '', r.t.s, cfgTxt(cfgDe(r.t))].concat(tubosDe(r.t).map((c) => '26050-' + c))));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(a), 'Por tubo y sector'); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(b), 'Por tracker');
  const p = await window.api.saveBinary(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }), `Distribución de tubos de torque ${today()}.xlsx`, 'xlsx', 'Excel');
  if (p) toast('Excel exportado', { action: ['Abrir', () => window.api.openPath(p)] });
}
function ramDetDist(r) {
  const HA = (S.hincado || {}).avance || {};
  if (!r.n) return `<h3>${r.t.id}</h3><p class="muted">Sin coordenadas en la lista de replanteo.</p>`;
  return `<div class="rmdh"><h3>${r.t.id} <span class="muted" style="font-weight:400">· frame ${esc(repDe(r.t.id).fr)} · S${r.t.s}</span></h3>${HA[r.t.id] ? `<span class="pill p-done">hincado ${fechaCorta(HA[r.t.id].f)}</span>` : ''}</div>
    <div class="rmkv"><span>Configuración <b>${esc(cfgTxt(cfgDe(r.t)))}</b></span><span>${r.n} hincas</span></div>
    <div class="tblwrap" style="max-height:60vh"><table class="tbl"><thead><tr><th>#</th><th>Código</th><th>Tipo</th><th>Color arriba</th><th>Color abajo</th><th class="n">Largo (mm)</th></tr></thead><tbody>
    ${r.H.map((h, k) => { const kk = h.cod && hcat(h.cod); return `<tr><td>${k + 1}${h.motor ? ' <b>M</b>' : ''}</td><td>${kk ? `${ramDosCol(kk)}<b>${esc(ramCodCorto(h.cod))}</b>` : '—'}</td><td>${kk ? (h.motor ? 'Motor' : 'General') : ''}</td><td>${kk ? (hColSup(kk) ? colorChip(hColSup(kk)) : '<span class="muted">sin color</span>') : ''}</td><td>${kk ? colorChip(kk.color) : ''}</td><td class="n">${kk ? fmt(kk.largo) : ''}</td></tr>`; }).join('')}</tbody></table></div>
    <p class="hint">Hincas de norte a sur según Trina ${esc(TRINA_DIST_DOC)}.</p>`;
}
function ramZoomBind(b) {
  const svg = $('.rmsvg', b); if (!svg) return; const P = window.PLANO;
  const set = (vb) => { const minW = 12, maxW = P.W * 1.2; const k = Math.max(minW, Math.min(maxW, vb[2])) / vb[2];
    const cx = vb[0] + vb[2] / 2, cy = vb[1] + vb[3] / 2, w = vb[2] * k, h = vb[3] * k; PUI.vb = [cx - w / 2, cy - h / 2, w, h];
    svg.setAttribute('viewBox', PUI.vb.join(' ')); svg.setAttribute('class', 'rmsvg ' + ramZcls()); };
  const pt = (e) => { const r = svg.getBoundingClientRect(), vb = ramVB(), s = Math.max(vb[2] / r.width, vb[3] / r.height);
    return [vb[0] + vb[2] / 2 + (e.clientX - r.left - r.width / 2) * s, vb[1] + vb[3] / 2 + (e.clientY - r.top - r.height / 2) * s, s]; };
  const zoom = (f, cx, cy) => { const vb = ramVB(); if (cx == null) { cx = vb[0] + vb[2] / 2; cy = vb[1] + vb[3] / 2; }
    set([cx - (cx - vb[0]) * f, cy - (cy - vb[1]) * f, vb[2] * f, vb[3] * f]); };
  svg.addEventListener('wheel', (e) => { e.preventDefault(); const [x, y] = pt(e); zoom(e.deltaY > 0 ? 1.25 : 0.8, x, y); }, { passive: false });
  let drag = null, movido = false;
  svg.addEventListener('mousedown', (e) => { if (e.button) return; drag = { x: e.clientX, y: e.clientY, vb: ramVB().slice(), s: pt(e)[2] }; movido = false; });
  window.addEventListener('mousemove', (e) => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 4) movido = true;
    if (movido) { const v = drag.vb; PUI.vb = [v[0] - dx * drag.s, v[1] - dy * drag.s, v[2], v[3]]; svg.setAttribute('viewBox', PUI.vb.join(' ')); svg.classList.add('arr'); } });
  window.addEventListener('mouseup', () => { if (drag) { drag = null; svg.classList.remove('arr'); } });
  svg.addEventListener('click', (e) => { if (movido) { movido = false; return; } const t = e.target.closest('[data-t]');
    const id = t ? t.dataset.t : ramTrkEn(e); if (id) { PUI.sel = id; render(false); } });
  svg.addEventListener('dblclick', (e) => { const [x, y] = pt(e); zoom(0.5, x, y); });
  $$('[data-z]', b).forEach((bt) => { bt.onclick = () => { const z = bt.dataset.z;
    if (z === 'in') zoom(0.6); else if (z === 'out') zoom(1.6); else if (z === 'fit') { PUI.vb = null; set([0, 0, P.W, P.H]); }
    else if (z === 'sel') { const t0 = P.trk.find((x) => x.id === PUI.sel); if (t0) { const t = ramRect(t0); set([t.x + t.w / 2 - 45, t.y + t.h / 2 - 35, 60, 70]); } } }; });
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
    ${H.map((h) => `<line x1="${X(h.d)}" y1="${Y(h.z)}" x2="${X(h.d)}" y2="${Y(h.cab)}" stroke="${h.est === 'ok' ? (h.salto ? '#f0a23b' : '#2f9e5b') : '#d64545'}" stroke-width="3"/>${h.motor ? `<rect x="${X(h.d) - 4}" y="${Y(h.cab) - 4}" width="8" height="8" fill="#1f4e5a"/>` : `<circle cx="${X(h.d)}" cy="${Y(h.cab)}" r="2.6" fill="#1f4e5a"/>`}`).join('')}
    <text x="${pad}" y="13" font-size="10" fill="#6b7785">N · ${fmt(H[0].z, 2)} m</text><text x="${W - pad}" y="13" font-size="10" fill="#6b7785" text-anchor="end">S · ${fmt(H[H.length - 1].z, 2)} m</text>
    <text x="${W / 2}" y="${Hh - 6}" font-size="10" fill="#6b7785" text-anchor="middle">${fmt(dMax, 1)} m · terreno (marrón), cabezas (azul), altura libre por hinca · ■ hinca motor</text></svg>`;
}
function ramDetalle(r, PG) {
  const HA = (S.hincado || {}).avance || {}, p = PG.plan.get(r.t.id), e = RAM_EST[r.est] || RAM_EST.sin;
  if (!r.n) return `<h3>${r.t.id}</h3><p class="muted">Este tracker no tiene coordenadas en la lista de replanteo.</p>`;
  return `<div class="rmdh"><h3>${r.t.id} <span class="muted" style="font-weight:400">· frame ${esc(repDe(r.t.id).fr)} · S${r.t.s} · ${r.t.t}</span></h3><span class="pill" style="background:${e[1]}22;color:${e[1]}">${e[0]}</span></div>
    <div class="rmkv"><span>Pendiente del terreno <b>${fmt(r.pend, 1)} %</b>${Math.abs(r.pTub - r.pend) > 0.05 ? ` → tubo ${fmt(r.pTub, 1)} %` : ''}</span><span>Ondulación <b>${fmt(r.ond, 2)} m</b></span><span>Altura libre <b>${fmt(r.rmin, 2)}–${fmt(r.rmax, 2)} m</b></span>${Math.abs(r.sh) > 0.005 ? `<span>Línea de cabezas corrida <b>${r.sh > 0 ? '+' : ''}${fmt(r.sh, 2)} m</b></span>` : ''}
      <span>${HA[r.t.id] ? `Hincado el <b>${fechaCorta(HA[r.t.id].f)}</b>` : p ? `Programado <b>${fechaCorta(p.f)}</b> · hincadora ${p.maq}` : ''}</span></div>
    ${ramPerfilSVG(r)}
    <div class="tblwrap" style="max-height:300px"><table class="tbl rmtb"><thead><tr><th>#</th><th class="n">Dist. (m)</th><th class="n">Terreno (m)</th><th class="n">Cabeza (m)</th><th class="n">Altura libre (m)</th><th class="n">Empotr. (m)</th><th>Tipo</th>${r.conCod ? '<th>Código</th>' : ''}<th></th></tr></thead><tbody>
    ${r.H.map((h, k) => `<tr class="${h.est !== 'ok' ? 'bad' : h.salto ? 'warn' : ''}"><td>${k + 1}</td><td class="n">${fmt(h.d, 2)}</td><td class="n">${fmt(h.z, 3)}</td><td class="n">${fmt(h.cab, 3)}</td><td class="n"><b>${fmt(h.rev, 3)}</b></td><td class="n">${fmt(h.emb, 2)}</td><td>${h.motor ? '<b>Motor</b>' : 'General'}</td>${r.conCod ? `<td>${chipH(h.cod, true)}</td>` : ''}<td>${h.est === 'corto' ? '<span class="tneg">perfil corto</span>' : h.est === 'alto' ? '<span class="tneg">terreno alto</span>' : h.salto ? '<span style="color:#b7791f">salto</span>' : '✓'}</td></tr>`).join('')}</tbody></table></div>
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
  $$('tr[data-t]', b).forEach((tr) => { tr.onclick = () => { RAMUI.sel = tr.dataset.t; RAMUI.tab = 'plano'; const t0 = window.PLANO.trk.find((x) => x.id === tr.dataset.t), t = t0 && ramRect(t0); if (t) RAMUI.vb = [t.x + t.w / 2 - 45, t.y + t.h / 2 - 35, 60, 70]; render(false); }; });
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
      <h4 class="rmsub">Hinca general (Standard / Damper)</h4>
      ${f('revNom', 'Altura libre nominal', 'm', '0.005', 'Manual Trina: 1,315 m.')}
      ${f('largo', 'Largo del perfil', 'm', '0.005', 'Ej.: PW610-1A suelo N = 3,515 m.')}
      ${f('embMin', 'Empotramiento mínimo', 'm', '0.05', 'Altura libre máxima = largo − empotramiento mínimo.')}
      <h4 class="rmsub">Hinca motor (Drive)</h4>
      ${f('drNom', 'Altura libre nominal', 'm', '0.005', 'Manual Trina: 1,23–1,26 m (más baja: el motor ocupa esa altura).')}
      ${f('drLargo', 'Largo del perfil', 'm', '0.005', 'Ej.: PW614-1A suelo N = 3,43 m.')}
      ${f('drEmb', 'Empotramiento mínimo', 'm', '0.05', '')}
      ${f('mot52', 'Posición de la hinca motor en 1P52', 'de 13', '1', 'Contando de norte a sur. Central = 7.')}
      ${f('mot26', 'Posición de la hinca motor en 1P26', 'de 7', '1', 'Contando de norte a sur. Central = 4.')}
      <h4 class="rmsub">Tolerancias</h4>
      ${f('regMenos', 'Regulación: hincar más que la nominal', 'mm', '10', 'Manual Trina §3.4.3: hasta 100 mm más (altura libre nominal −100 mm). Si el terreno queda más alto, hay que cortar.')}
      ${f('regMas', 'Regulación: hincar menos que la nominal', 'mm', '10', 'Manual Trina §3.4.3: hasta 200 mm menos (altura libre nominal +200 mm), sin bajar del empotramiento mínimo. Si el terreno queda más bajo, hay que rellenar.')}
      ${f('pendMax', 'Pendiente N-S máxima del tracker', '%', '0.5', 'Manual Trina ARI-GR-MN-4301-0A §3.2: hasta 15 % (9°) N-S y E-O. Si el terreno tiene más, el tubo se limita a esta pendiente y el tracker queda para revisar.')}
      ${f('difMax', 'Salto máximo de altura libre entre hincas vecinas', 'm', '0.05', 'Se marca como aviso.')}
      <label class="rmchk"><input type="checkbox" data-k="usarCodigos" ${P.usarCodigos ? 'checked' : ''} ${ro ? 'disabled' : ''} style="width:auto"><span>Usar largo, altura y empotramiento de cada código de hinca (cuando esté cargada la distribución de Trina, reemplaza a los valores de arriba)${cods ? '' : '<small class="muted">La distribución por posición todavía no está completa en Catálogo y distribución: mientras tanto se usan los valores de arriba, motor y general por separado.</small>'}</span></label></div></div>
    <div><div class="card" style="margin-bottom:12px"><h3>Estado del plan</h3><label class="rmchk"><input type="checkbox" data-k="precarga" ${P.precarga ? 'checked' : ''} ${ro ? 'disabled' : ''} style="width:auto"><span><b>Ramming plan en precarga</b>: alturas orientativas, no apto para hincar. Destildar recién cuando estén la topografía final, la discretización confirmada y la validación de Trina.</span></label></div>
    <div class="card" style="margin-bottom:12px"><h3>Terreno para el ramming plan</h3><p class="hint" style="margin:0 0 8px">Proceso: limpieza → pre nivelación → relevamiento → cálculo y ejecución del movimiento de suelos (nivelación y compactación) → <b>nuevo relevamiento punto a punto</b> → rugosidad y control de niveles y pendientes → ramming plan sobre el terreno trabajado. Cargá el relevamiento posterior en Movimiento de suelos › Topografías y elegilo acá.</p><div class="form rmform">
      ${[...new Set((window.PLANO.trk || []).map((t) => t.s))].sort().map((x) => { const v = ramTerrSrc(x); return `<label>Sector ${x}<select class="rmTerr" data-s="${x}" ${ro ? 'disabled' : ''}><option value="layout" ${v === 'layout' ? 'selected' : ''}>Cotas del replanteo (layout)</option><option value="mov" ${v === 'mov' ? 'selected' : ''}>Terreno final calculado (movimiento de suelos)</option>${(typeof msSetsA === 'function' ? msSetsA() : []).map((t) => `<option value="${t.id}" ${v === t.id ? 'selected' : ''}>Topografía: ${esc(t.nombre)}</option>`).join('')}</select></label>`; }).join('')}</div></div>
    <div class="card"><h3>Programa</h3><div class="form rmform">
      ${f('hincadoras', 'Hincadoras trabajando', '', '1')}
      ${f('rend', 'Rendimiento por hincadora', 'hincas/día', '5')}
      <label>Fecha de inicio<span class="rmin"><input type="date" data-k="inicio" value="${P.inicio || ''}" ${ro ? 'disabled' : ''}></span><small class="muted">Vacía: desde hoy.</small></label>
      <label>Orden de los sectores<span class="rmin"><input type="text" data-k="orden" value="${esc(P.orden)}" ${ro ? 'disabled' : ''}></span><small class="muted">Ej.: 3,4,1,2,5,6</small></label>
      <label>Sentido de avance<select data-k="sentido" ${ro ? 'disabled' : ''}><option value="OE" ${P.sentido !== 'EO' ? 'selected' : ''}>De oeste a este</option><option value="EO" ${P.sentido === 'EO' ? 'selected' : ''}>De este a oeste</option></select></label>
      <label class="rmchk"><input type="checkbox" data-k="sabado" ${P.sabado ? 'checked' : ''} ${ro ? 'disabled' : ''} style="width:auto"><span>Se trabaja los sábados</span></label></div>
      <p class="hint">Cotas de terreno: ${esc((window.COTAS_HINCAS || {}).fuente || '')}. Coordenadas: ${esc(((window.REPLANTEO || {}).fuente || '').split(' · ')[0])}.</p>
      ${ro ? '' : '<button class="btn" id="rmRes">Volver a los valores por defecto</button>'}</div></div></div>
    <p class="hint">Los valores por defecto son de referencia: confirmalos con el manual de instalación de Trina (Vanguard 1P) y el estudio geotécnico. Todo se recalcula al cambiar un valor.</p>`;
  $$('[data-k]', b).forEach((i) => { i.onchange = () => { const k = i.dataset.k, H = S.hincado; H.ram = Object.assign({}, ramP());
    H.ram[k] = i.type === 'checkbox' ? i.checked : i.type === 'number' ? Number(i.value) : i.value || null; RAMC = null; commit(`Ramming plan: ${k} = ${H.ram[k]}`); }; });
  $$('.rmTerr', b).forEach((sel) => { sel.onchange = () => { const H = S.hincado; H.ram = Object.assign({}, ramP()); H.ram.terr = Object.assign({}, H.ram.terr || {}, { [sel.dataset.s]: sel.value }); RAMC = null; commit(`Ramming plan: terreno del sector ${sel.dataset.s} = ${ramTerrTxt(sel.value)}`); }; });
  const rs = $('#rmRes', b); if (rs) rs.onclick = () => { S.hincado.ram = Object.assign({}, RAM_DEF); RAMC = null; commit('Ramming plan: parámetros por defecto'); };
}
async function ramExcel() {
  const C = ramCalc(), PG = ramPrograma(), P = ramP(), HA = (S.hincado || {}).avance || {};
  const a = [['Tracker', 'Frame', 'Sector', 'Tipo', 'Hinca (N→S)', 'X', 'Y', 'Terreno (m)', 'Cabeza (m)', 'Altura libre (m)', 'Empotramiento (m)', 'Tipo', 'Código', 'Color arriba', 'Color abajo', 'Estado']];
  C.L.forEach((r) => r.H.forEach((h, k) => a.push([r.t.id, repDe(r.t.id).fr, r.t.s, r.t.t, k + 1, h.x, h.y, +h.z.toFixed(3), +h.cab.toFixed(3), +h.rev.toFixed(3), +h.emb.toFixed(3), h.motor ? 'Motor' : 'General', h.cod || '', h.cod && hcat(h.cod) ? hColSup(hcat(h.cod)) || 'sin color' : '', h.cod && hcat(h.cod) ? hcat(h.cod).color : '', h.est === 'ok' ? (h.salto ? 'salto' : 'ok') : h.est === 'corto' ? 'perfil corto' : 'terreno alto'])));
  const t = [['Tracker', 'Sector', 'Tipo', 'Estado', 'Pendiente terreno (%)', 'Pendiente tubo (%)', 'Ondulación (m)', 'Altura libre mín (m)', 'Altura libre máx (m)', 'Corrimiento línea (m)', 'Hincas fuera', 'Hincado', 'Programado', 'Hincadora']];
  C.L.forEach((r) => { const p = PG.plan.get(r.t.id); t.push([r.t.id, r.t.s, r.t.t, (RAM_EST[r.est] || RAM_EST.sin)[0], r.n ? +r.pend.toFixed(2) : '', r.n ? +r.pTub.toFixed(2) : '', r.n ? +r.ond.toFixed(3) : '', r.n ? +r.rmin.toFixed(3) : '', r.n ? +r.rmax.toFixed(3) : '', r.n ? +r.sh.toFixed(3) : '', r.fuera || 0, HA[r.t.id] ? HA[r.t.id].f : '', p ? p.f : '', p ? p.maq : '']); });
  const par = [['Parámetro', 'Valor']].concat(P.precarga ? [['ESTADO', RAM_PRE_TXT]] : []).concat(Object.entries(P).map(([k, v]) => [k, v]));
  if (P.precarga) { t.unshift([RAM_PRE_TXT]); a.unshift([RAM_PRE_TXT]); }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(t), 'Por tracker'); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(a), 'Por hinca'); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(par), 'Parámetros');
  const p = await window.api.saveBinary(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }), `Ramming plan${P.precarga ? ' PRECARGA' : ''} ${today()}.xlsx`, 'xlsx', 'Excel');
  if (p) toast('Excel exportado', { action: ['Abrir', () => window.api.openPath(p)] });
}
function ramPdf() {
  const C = ramCalc(), PG = ramPrograma(), HA = (S.hincado || {}).avance || {};
  const secs = [...new Set(C.L.map((r) => r.t.s))].sort().filter((s) => RAMUI.s === 'all' || s === RAMUI.s);
  let h = prHead('Ramming plan · plan de hincado' + (ramP().precarga ? ' · PRECARGA' : ''), 'Altura libre y empotramiento por hinca, de norte a sur');
  if (ramP().precarga) h += `<p style="border:2px solid #c0392b;color:#c0392b;font-weight:700;padding:6px 10px;margin:6px 0">${RAM_PRE_TXT}. Calculado sobre terreno natural; falta topografía final, confirmación de la discretización y validación de Trina.</p>`;
  secs.forEach((s) => {
    h += `<h2 style="page-break-before:always">Sector ${s}</h2>`;
    C.L.filter((r) => r.t.s === s && r.n && !HA[r.t.id]).sort((a, b) => a.t.x - b.t.x).forEach((r) => { const p = PG.plan.get(r.t.id);
      h += `<div style="break-inside:avoid;margin:6px 0"><b>${r.t.id}</b> · ${r.t.t} · ${(RAM_EST[r.est] || RAM_EST.sin)[0]}${p ? ` · programado ${fechaCorta(p.f)} (H${p.maq})` : ''}
      <table class="tbl" style="font-size:8.5pt"><tr><th>Hinca</th>${r.H.map((x, k) => `<th>${k + 1}</th>`).join('')}</tr><tr><td>Altura libre (m)</td>${r.H.map((x) => `<td${x.est !== 'ok' ? ' style="color:#c00;font-weight:700"' : ''}>${fmt(x.rev, 2)}</td>`).join('')}</tr><tr><td>Cabeza (m)</td>${r.H.map((x) => `<td>${fmt(x.cab, 2)}</td>`).join('')}</tr></table></div>`; });
  });
  printHTML(h, `Ramming plan${ramP().precarga ? ' PRECARGA' : ''} ${today()}.pdf`, true);
}

// ---------- DXF (R12, abre en AutoCAD y se guarda como DWG). Coordenadas reales del replanteo: se superpone al layout ----------
const RAM_ACI = { Rojo: 1, Azul: 5, Verde: 3, Violeta: 202, Magenta: 6, Negro: 250, Gris: 8, Blanco: 7, 'Sin marca': 9 };
function ramDxf(modo = 'ram') {
  const dist = modo === 'dist';
  const C = ramCalc(), HA = (S.hincado || {}).avance || {}, P = ramP(), o = [];
  const g = (...kv) => { for (let i = 0; i < kv.length; i += 2) o.push(String(kv[i]), String(kv[i + 1])); };
  const num = (v) => (Math.round(v * 1000) / 1000).toFixed(3);
  const lay = new Map([['RAM-TRACKER', 8], ['RAM-TRACKER-ID', 7], ['RAM-ALTURA-LIBRE', 4], ['RAM-FUERA', 1], ['RAM-SALTO', 30], ['RAM-HINCADO', 200],
    ['HINCA-OK', 3], ['HINCA-FUERA', 1], ['HINCA-SALTO', 30], ['HINCA-SIN-CODIGO', 9]]);
  const capaCod = (c) => 'HINCA-' + ramCodCorto(c).toUpperCase().replace(/[^A-Z0-9]+/g, '-');
  C.L.forEach((r) => r.H.forEach((h) => { const k = h.cod && hcat(h.cod); if (k) lay.set(capaCod(h.cod), 7); }));
  lay.set('HINCA-MOTOR', 7); lay.set('HINCA-CODIGO', 7); lay.set('RAM-STS', 5); lay.set('RAM-INVERSOR', 30); lay.set('RAM-REFERENCIAS', 7);
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
  const TAGS = [['TRACKER', 'Tracker'], ['N', 'Hinca N° (norte a sur)'], ['TIPO', 'Motor o general'], ['CODIGO', 'Código Trina'], ['COLOR_ARRIBA', 'Color cabeza'], ['COLOR', 'Color punta'], ['Z_TERRENO', 'Cota terreno (m)'], ['Z_CABEZA', 'Cota cabeza (m)'], ['ALTURA_LIBRE', 'Altura libre (m)'], ['EMPOTRAMIENTO', 'Empotramiento (m)'], ['ESTADO', 'Estado']];
  g(0, 'SECTION', 2, 'BLOCKS', 0, 'BLOCK', 8, '0', 2, 'HINCA', 70, 2, 10, 0, 20, 0, 30, 0, 3, 'HINCA', 0, 'POINT', 8, '0', 62, 0, 10, 0, 20, 0, 30, 0);
  TAGS.forEach(([t, p], i) => g(0, 'ATTDEF', 8, '0', 10, 0.3, 20, -0.15 - i * 0.3, 30, 0, 40, 0.2, 1, '', 3, p, 2, t, 70, 1));
  g(0, 'ENDBLK', 8, '0', 0, 'ENDSEC', 0, 'SECTION', 2, 'ENTITIES');
  C.L.forEach((r) => {
    if (!r.n) return; const H = r.H, a = H[0], z = H[H.length - 1], hecho = !!HA[r.t.id];
    g(0, 'LINE', 8, hecho ? 'RAM-HINCADO' : 'RAM-TRACKER', 10, num(a.x), 20, num(a.y), 30, 0, 11, num(z.x), 21, num(z.y), 31, 0);
    const cab = ramInvCab().get(r.t.id), yT = cab === 'N' ? a.y + 2.0 + 0.6 + 0.3 : a.y + RAM_LADO / 2 + (dist ? 1.35 : 0.45);
    g(0, 'TEXT', 8, 'RAM-TRACKER-ID', 10, num(a.x), 20, num(yT), 30, 0, 40, 0.8, 1, r.t.id, 72, 1, 11, num(a.x), 21, num(yT), 31, 0);
    H.forEach((h, k) => {
      const kk = h.cod && hcat(h.cod), est = h.est === 'corto' ? 'Perfil corto' : h.est === 'alto' ? 'Terreno alto' : h.salto ? 'Salto' : 'OK';
      const capa = kk ? capaCod(h.cod) : h.est !== 'ok' ? 'HINCA-FUERA' : h.salto ? 'HINCA-SALTO' : 'HINCA-OK';
      // moño: cuadrado con triángulo superior (color de la cabeza) e inferior (color de la punta); norte arriba (+Y)
      const A = RAM_LADO / 2, X = h.x, Y = h.y, P = (dx, dy) => [num(X + dx), num(Y + dy)];
      const tri = (sg, col) => { const [ax, ay] = P(-A, sg * A), [bx, by] = P(A, sg * A), [cx, cy] = P(0, 0);
        if (col && RAM_ACI[col] && col !== 'Blanco' && col !== 'Sin marca') g(0, 'SOLID', 8, capa, 62, RAM_ACI[col], 10, ax, 20, ay, 30, 0, 11, bx, 21, by, 31, 0, 12, cx, 22, cy, 32, 0, 13, cx, 23, cy, 33, 0);
        [[ax, ay, bx, by], [bx, by, cx, cy], [cx, cy, ax, ay]].forEach(([x1, y1, x2, y2]) => g(0, 'LINE', 8, capa, 62, 8, 10, x1, 20, y1, 30, 0, 11, x2, 21, y2, 31, 0)); };
      if (dist && kk) { tri(1, hColSup(kk)); tri(-1, kk.color); }
      if (!dist) { const [ax, ay] = P(-A, -A), [bx, by] = P(A, -A), [cx2, cy2] = P(-A, A), [dx2, dy2] = P(A, A);
        g(0, 'SOLID', 8, capa, 62, h.est !== 'ok' ? 1 : h.salto ? 30 : 3, 10, ax, 20, ay, 30, 0, 11, bx, 21, by, 31, 0, 12, cx2, 22, cy2, 32, 0, 13, dx2, 23, dy2, 33, 0); }
      const sq = (d, ly) => { const c = [P(-d, -d), P(d, -d), P(d, d), P(-d, d)]; c.forEach((p, i) => { const q = c[(i + 1) % 4]; g(0, 'LINE', 8, ly, 10, p[0], 20, p[1], 30, 0, 11, q[0], 21, q[1], 31, 0); }); };
      sq(A, capa); if (h.motor) { sq(A + 0.08, 'HINCA-MOTOR'); sq(A + 0.16, 'HINCA-MOTOR'); g(0, 'TEXT', 8, 'HINCA-MOTOR', 10, num(X - A - 0.35), 20, num(Y - 0.3), 30, 0, 40, 0.65, 1, 'M', 72, 2, 11, num(X - A - 0.35), 21, num(Y - 0.3), 31, 0); }
      const lat = !!cab && (cab === 'N' ? k === 0 : k === H.length - 1);
      if (dist && kk) { if (lat) g(0, 'TEXT', 8, 'HINCA-CODIGO', 10, num(X - A - 0.25), 20, num(Y - 0.25), 30, 0, 40, 0.5, 1, ramCodCorto(h.cod), 72, 2, 11, num(X - A - 0.25), 21, num(Y - 0.25), 31, 0);
        else g(0, 'TEXT', 8, 'HINCA-CODIGO', 10, num(X), 20, num(Y + A + 0.25), 30, 0, 40, 0.5, 1, ramCodCorto(h.cod), 72, 1, 11, num(X), 21, num(Y + A + 0.25), 31, 0); }
      g(0, 'INSERT', 8, capa, 66, 1, 2, 'HINCA', 10, num(h.x), 20, num(h.y), 30, 0);
      const vals = [r.t.id, k + 1, h.motor ? 'Motor' : 'General', h.cod || '', kk ? hColSup(kk) || 'sin color' : '', kk ? kk.color : '', num(h.z), num(h.cab), num(h.rev), num(h.emb), est];
      TAGS.forEach(([t], i) => g(0, 'ATTRIB', 8, capa, 10, num(h.x + 0.3), 20, num(h.y - 0.15 - i * 0.3), 30, 0, 40, 0.2, 1, vals[i], 2, t, 70, 1));
      g(0, 'SEQEND', 8, capa);
      if (!dist) { if (lat) g(0, 'TEXT', 8, 'RAM-ALTURA-LIBRE', 10, num(X - A - 0.25), 20, num(Y - 0.22), 30, 0, 40, 0.45, 1, `${k + 1} · ${h.rev.toFixed(2)}`, 72, 2, 11, num(X - A - 0.25), 21, num(Y - 0.22), 31, 0);
        else g(0, 'TEXT', 8, 'RAM-ALTURA-LIBRE', 10, num(X), 20, num(Y - A - 0.6), 30, 0, 40, 0.45, 1, `${k + 1} · ${h.rev.toFixed(2)}`, 72, 1, 11, num(X), 21, num(Y - A - 0.6), 31, 0); }
      if (HA[r.t.id]) g(0, 'LINE', 8, 'RAM-HINCADO', 10, num(X - A), 20, num(Y - A), 30, 0, 11, num(X + A), 21, num(Y + A), 31, 0), g(0, 'LINE', 8, 'RAM-HINCADO', 10, num(X - A), 20, num(Y + A), 30, 0, 11, num(X + A), 21, num(Y - A), 31, 0);
    });
  });
  // STS e inversores como referencia (coordenadas reales: origen del layout)
  const [OX, OY] = window.PLANO.origen, rq = (cx, cy, w, h, ly, col) => { const c = [[cx - w / 2, cy - h / 2], [cx + w / 2, cy - h / 2], [cx + w / 2, cy + h / 2], [cx - w / 2, cy + h / 2]];
    c.forEach((p, i) => { const q = c[(i + 1) % 4]; g(0, 'LINE', 8, ly, 10, num(p[0]), 20, num(p[1]), 30, 0, 11, num(q[0]), 21, num(q[1]), 31, 0); }); };
  (window.PLANO.sts || []).forEach((st) => { const X = OX + st.x, Y = OY - st.y; rq(X, Y, 8, 4, 'RAM-STS', 5);
    g(0, 'TEXT', 8, 'RAM-STS', 10, num(X - 4), 20, num(Y + 2.35), 30, 0, 40, 1.6, 1, st.id); });
  (window.PLANO.inv || []).forEach((v) => { const X = OX + v.x, Y = OY - v.y; rq(X, Y, 2.6, 1.2, 'RAM-INVERSOR', 30);
    const [a1, a2] = ramInvNom(v.id).split(' '); g(0, 'TEXT', 8, 'RAM-INVERSOR', 10, num(X + 1.5), 20, num(Y + 0.05), 30, 0, 40, 0.8, 1, a1); g(0, 'TEXT', 8, 'RAM-INVERSOR', 10, num(X + 1.5), 20, num(Y - 0.95), 30, 0, 40, 0.8, 1, a2 || ''); });
  // referencias, a la derecha del plano
  { let ly = y1 - 5; const lx = x1 + 15, T = (t, h = 1.2, dx = 0) => { g(0, 'TEXT', 8, 'RAM-REFERENCIAS', 10, num(lx + dx), 20, num(ly), 30, 0, 40, h, 1, t); ly -= h * 1.9; };
    T(dist ? 'PLANO DE DISTRIBUCION DE HINCAS - REFERENCIAS' : 'RAMMING PLAN - REFERENCIAS', 2.2); T(`${S.nombre || ''} · ${new Date().toLocaleDateString('es-AR')}${dist ? ' · Trina ' + TRINA_DIST_DOC : ''}`, 1.2);
    if (!dist && ramP().precarga) { T('PRECARGA - ALTURAS ORIENTATIVAS - NO APTO PARA HINCAR', 1.8); T('Terreno natural: falta topografia final, discretizacion confirmada y validacion de Trina', 1.0); }
    ly -= 2;
    const box = (col1, col2, fillOne) => { const X = lx + 1, Y = ly + 0.4, A = 0.9, P = (dx, dy) => [num(X + dx), num(Y + dy)];
      if (fillOne != null) { const [ax, ay] = P(-A, -A), [bx, by] = P(A, -A), [cx2, cy2] = P(-A, A), [dx2, dy2] = P(A, A); g(0, 'SOLID', 8, 'RAM-REFERENCIAS', 62, fillOne, 10, ax, 20, ay, 30, 0, 11, bx, 21, by, 31, 0, 12, cx2, 22, cy2, 32, 0, 13, dx2, 23, dy2, 33, 0); }
      [[1, col1], [-1, col2]].forEach(([sg, col]) => { if (col && RAM_ACI[col] && col !== 'Blanco' && col !== 'Sin marca') { const [ax, ay] = P(-A, sg * A), [bx, by] = P(A, sg * A), [cx2, cy2] = P(0, 0); g(0, 'SOLID', 8, 'RAM-REFERENCIAS', 62, RAM_ACI[col], 10, ax, 20, ay, 30, 0, 11, bx, 21, by, 31, 0, 12, cx2, 22, cy2, 32, 0, 13, cx2, 23, cy2, 33, 0); } });
      const c = [P(-A, -A), P(A, -A), P(A, A), P(-A, A)]; c.forEach((p, i) => { const q = c[(i + 1) % 4]; g(0, 'LINE', 8, 'RAM-REFERENCIAS', 10, p[0], 20, p[1], 30, 0, 11, q[0], 21, q[1], 31, 0); }); };
    if (dist) {
      T('Triangulo de arriba: color de la cabeza (rojo = general suelo normal, azul = general suelo blando, sin color = motor)', 1.0);
      T('Triangulo de abajo: color de la punta (identifica el codigo)', 1.0); ly -= 1;
      const m = new Map(); C.L.forEach((r) => r.H.forEach((h) => { if (h.cod) m.set(h.cod, (m.get(h.cod) || 0) + 1); }));
      [...m.entries()].sort((p, q) => ramCodCorto(p[0]).localeCompare(ramCodCorto(q[0]))).forEach(([c, n]) => { const k = hcat(c); box(hColSup(k), k.color); T(`${ramCodCorto(c)}  ${/drive/i.test(k.tipo) ? 'MOTOR' : 'general'} · suelo ${k.suelo === 'B' ? 'blando' : 'normal'} · arriba ${hColSup(k) || 'sin color'} / abajo ${k.color} · ${n} hincas`, 1.0, 3); });
    } else { [['Dentro de tolerancia', 3], ['Salto con la hinca vecina', 30], ['Fuera de tolerancia (perfil corto o terreno alto)', 1]].forEach(([t, c]) => { box(null, null, c); T(t, 1.0, 3); }); T('Rotulo debajo de cada hinca: numero (norte a sur) · altura libre (m)', 1.0); }
    ly -= 1; T('M = hinca motor (doble recuadro) · X = tracker hincado', 1.0); T('Rectangulo naranja: inversor · rectangulo azul: STS', 1.0); T('Coordenadas reales del layout · norte arriba', 1.0); }
  g(0, 'ENDSEC', 0, 'EOF');
  const s = o.join('\r\n') + '\r\n', b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); b[i] = c < 256 ? c : 63; }
  return b;
}
async function ramExportDxf(modo = 'ram') {
  const p = await window.api.saveBinary(ramDxf(modo), `${modo === 'dist' ? 'Plano de distribución de hincas' : 'Ramming plan' + (ramP().precarga ? ' PRECARGA' : '')} ${today()}.dxf`, 'dxf', 'Dibujo DXF (AutoCAD)');
  if (p) toast('Plano DXF exportado: abrilo en AutoCAD y guardalo como DWG', { action: ['Abrir carpeta', () => window.api.showItem ? window.api.showItem(p) : window.api.openPath(p)] });
}

// ---------- plano de hincado imprimible (por sector, en hojas A3/A4 a escala) ----------
const RAMPR = { sec: 'all', size: 'A3', n: 4, menos: true, hech: true };
// posición de cada hinca en coordenadas del plano (m, norte arriba), dentro del rectángulo de su tracker
function ramPilesLocal(t, r) {
  const [OX, OY] = window.PLANO.origen;
  return r.H.map((h, k) => ({ h, k, x: h.x - OX, y: OY - h.y }));
}
const ramCodCorto = (c) => String(c || '').replace(/^26050-/, '').replace(/^MS\d-/, '');
async function ramImprimir(modo = 'ram') {
  const C = ramCalc(), secs = [...new Set(C.L.map((r) => r.t.s))].sort(), dist = modo !== 'ram';
  const pr = modal({
    title: modo === 'tubo' ? 'Imprimir plano de tubos de torque' : dist ? 'Imprimir plano de distribución de hincas' : 'Imprimir ramming plan',
    sub: (modo === 'tubo' ? 'Tipo de tubo de torque (viga) de cada tramo, con la hoja de resumen por sector' : dist ? 'Código y colores Trina de cada hinca, con la hoja de resumen por sector' : 'Altura libre y estado de cada hinca') + ', con STS e inversores de referencia. Cada sector se reparte en la cantidad de hojas que elijas, a la escala más grande que entra; la orientación (vertical o apaisada) se elige sola para cada sector.',
    body: `<div class="form">
      <label>Sector<select id="pS"><option value="all">Todos (un juego de hojas por sector)</option>${secs.map((s) => `<option value="${s}" ${RAMPR.sec === s ? 'selected' : ''}>Sector ${s}</option>`).join('')}</select></label>
      <label>Hoja<select id="pT"><option value="A3" ${RAMPR.size === 'A3' ? 'selected' : ''}>A3</option><option value="A4" ${RAMPR.size === 'A4' ? 'selected' : ''}>A4</option></select></label>
      <label>Hojas por sector<select id="pN">${[1, 2, 4, 6, 8].map((n) => `<option value="${n}" ${RAMPR.n === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="rmchk" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="pM" ${RAMPR.menos !== false ? 'checked' : ''} style="width:auto"><span>Usar menos hojas si el sector entra a escala 1:${RAM_ESC_MAX} o mayor (por ejemplo, el sector 2 en una sola hoja)</span></label>
      <label class="rmchk" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="pH" ${RAMPR.hech ? 'checked' : ''} style="width:auto"><span>Tachar con una cruz las hincas de trackers ya hincados</span></label></div>
      <div class="hint" id="pInf"></div>`,
    buttons: [['Cancelar', 'btn', () => null], ['Generar PDF', 'btn pri', (m) => ramLeerPr(m)]] });
  setTimeout(() => { const m = $('#modal .mbox'); if (!m || !$('#pS', m)) return;
    const upd = () => { const o = Object.assign(ramLeerPr(m), { modo }), H = ramHojas(C, o), por = new Map(); H.forEach((h) => por.set(h.s, h));
      $('#pInf', m).innerHTML = `Salen <b>${H.length} hojas ${o.size}</b>:<br>` + [...por.values()].map((h) => `Sector ${h.s}: ${h.de} hojas ${h.port ? 'verticales' : 'apaisadas'} (${h.cols} × ${h.filas}) · escala 1:${h.esc}`).join('<br>'); };
    $$('select,input', m).forEach((i) => (i.onchange = upd)); upd(); }, 0);
  const o = await pr; if (!o) return; Object.assign(RAMPR, o); ramPdfPlano(Object.assign({}, RAMPR, { modo }));
}
function ramLeerPr(m) { return { sec: $('#pS', m).value, size: $('#pT', m).value, n: Number($('#pN', m).value), menos: $('#pM', m).checked, hech: $('#pH', m).checked }; }
// medidas de la hoja (mm): área de dibujo descontando márgenes, encabezado y referencias
const RAM_HOJA = { A3: [420, 297], A4: [297, 210] };
function ramArea(size, port) { const [a, b] = RAM_HOJA[size] || RAM_HOJA.A3, pw = port ? b : a, ph = port ? a : b; return { pw, ph, W: pw - 16, H: ph - 16 - 4 }; } // 4 mm de holgura: si el contenido se pasa aunque sea un poco, el PDF parte la hoja en dos }
// cortes posibles a lo largo de un eje: huecos entre trackers (nunca se corta un tracker)
function ramCortes(T, ax) {
  const iv = T.map((t) => (ax === 'x' ? [t.x, t.x + t.w] : [t.y, t.y + t.h])).sort((a, b) => a[0] - b[0]), c = [];
  let e = iv.length ? iv[0][1] : 0; for (let i = 1; i < iv.length; i++) { if (iv[i][0] > e + 0.3) c.push((e + iv[i][0]) / 2); e = Math.max(e, iv[i][1]); }
  return c;
}
function ramCaja(T) { // marco de un grupo de trackers, con lugar para rótulos e inversores
  return { x0: Math.min(...T.map((t) => t.x)) - 3, x1: Math.max(...T.map((t) => t.x + t.w)) + 5, y0: Math.min(...T.map((t) => t.y)) - 4.5, y1: Math.max(...T.map((t) => t.y + t.h)) + 4.5 };
}
function* ramComb(n, k, d = 0, acc = []) { if (acc.length === k) { yield acc; return; } for (let i = d; i <= n - (k - acc.length); i++) yield* ramComb(n, k, i + 1, acc.concat(i)); }
// parte T en 'partes' trozos a lo largo de 'ax' maximizando f(trozo) mínimo; devuelve {v, grupos}
function ramPartir(T, ax, partes, f) {
  if (partes === 1) return { v: f(T), grupos: [T] };
  // programación dinámica sobre los huecos entre trackers: maximiza el mínimo f(trozo) en milisegundos (antes se probaban todas las
  // combinaciones de cortes, que con 6 u 8 hojas en un sector grande eran millones y trababan el programa)
  const cs = ramCortes(T, ax), cen = (t) => (ax === 'x' ? t.x + t.w / 2 : t.y + t.h / 2);
  if (cs.length < partes - 1) return { v: -1, grupos: null };
  const L = T.slice().sort((p, q) => cen(p) - cen(q)), B = [0]; let j = 0;
  cs.forEach((c) => { while (j < L.length && cen(L[j]) < c) j++; B.push(j); }); B.push(L.length); // B: índice de corte en L para cada borde
  const nb = B.length, memo = new Map(), F = (i, k) => { if (B[k] <= B[i]) return -1; const key = i * nb + k; if (!memo.has(key)) memo.set(key, f(L.slice(B[i], B[k]))); return memo.get(key); };
  const D = [Array.from({ length: nb }, (_, k) => (k ? F(0, k) : -1))], P = [[]];
  for (let p = 1; p < partes; p++) { D[p] = new Array(nb).fill(-1); P[p] = new Array(nb).fill(-1);
    for (let k = p + 1; k < nb; k++) for (let i = p; i < k; i++) { if (D[p - 1][i] <= D[p][k]) continue; const v = Math.min(D[p - 1][i], F(i, k)); if (v > D[p][k]) { D[p][k] = v; P[p][k] = i; } } }
  const v = D[partes - 1][nb - 1]; if (v <= 0) return { v: -1, grupos: null };
  // segunda pasada: con esa misma escala, emparejar los trozos (minimizar el más largo sobre el eje) para que no quede una hoja casi vacía
  const ext = (i, k) => { const g = L.slice(B[i], B[k]), b = ramCaja(g); return ax === 'x' ? b.x1 - b.x0 : b.y1 - b.y0; };
  const ok = (i, k) => F(i, k) >= v * (1 - 3e-3), E = [Array.from({ length: nb }, (_, k) => (k && B[k] > 0 && ok(0, k) ? ext(0, k) : Infinity))], Q = [[]];
  for (let p = 1; p < partes; p++) { E[p] = new Array(nb).fill(Infinity); Q[p] = new Array(nb).fill(-1);
    for (let k = p + 1; k < nb; k++) for (let i = p; i < k; i++) { if (E[p - 1][i] >= E[p][k] || B[k] <= B[i] || !ok(i, k)) continue; const w = Math.max(E[p - 1][i], ext(i, k)); if (w < E[p][k]) { E[p][k] = w; Q[p][k] = i; } } }
  const R = E[partes - 1][nb - 1] < Infinity ? Q : P;
  const G = []; let k = nb - 1; for (let p = partes - 1; p > 0; p--) { const i = R[p][k]; G.unshift(L.slice(B[i], B[k])); k = i; } G.unshift(L.slice(0, B[k]));
  return { v, grupos: G };
}
// mejor grilla columnas × filas para repartir T en k hojas (cortes por huecos entre trackers), hoja vertical o apaisada
function ramGrilla(T, k, size) {
  const grillas = []; for (let c = 1; c <= k; c++) if (k % c === 0) grillas.push([c, k / c]);
  let best = null; const todas = [];
  [false, true].forEach((port) => { const A = ramArea(size, port), f = (g) => { const b = ramCaja(g), sx = A.W / (b.x1 - b.x0), sy = A.H / (b.y1 - b.y0); return Math.min(sx, sy) * (1 + 1e-4 * Math.min(sx / sy, sy / sx)) + 1e-6 * (sx + sy); };
    grillas.forEach(([c, r]) => { const memo = new Map(), fc = (g) => { const kk = g.map((t) => t.id).join(); if (!memo.has(kk)) memo.set(kk, ramPartir(g, 'y', r, f)); return memo.get(kk).v; };
      const X = ramPartir(T, 'x', c, fc); if (X.v <= 0) return;
      const cand = { v: X.v, port, c, r, A, G: X.grupos.map((g) => memo.get(g.map((t) => t.id).join()).grupos) }; todas.push(cand);
      if (!best || X.v > best.v * 1.0001) best = cand; }); });
  return todas.sort((a, b) => b.v - a.v);
}
// tamaño del recuadro de referencias (mm), según la hoja y cuántos códigos hay que listar
function ramRotDim(size, nCod, dist, croqAsp, comp) {
  if (comp) { // compacto, para sectores llenos sin hueco grande: códigos en 3 columnas y esquema más chico
    const W = size === 'A4' ? 64 : 76, cw = W - 7, ch = Math.min(22, cw * croqAsp), lin = dist ? Math.ceil(Math.max(nCod, 1) / 2) + 4 : 4;
    return { W, ch, comp: true, H: 21 + ch + 6 + lin * 3.4 + 12 + (dist ? 22 : 0) };
  }
  const W = size === 'A4' ? 80 : 96, cw = W - 8, ch = Math.min(size === 'A4' ? 30 : 40, cw * croqAsp);
  const lin = dist ? Math.ceil(Math.max(nCod, 1) / 2) + 5 : 5;
  return { W, ch, H: 25 + ch + 7 + lin * 3.7 + 16 + (dist ? 23 : 0) };
}
const RAM_ESC_MAX = 400; // con "usar menos hojas": una hoja más solo si sin ella la escala queda más chica que 1:400
// obstáculos de la hoja (en metros): trackers con su rótulo, inversores y STS
function ramObst(T) {
  const P = window.PLANO, O = T.map((t) => ramCaja([t]));
  (P.inv || []).forEach((v) => O.push({ x0: v.x - 1.5, x1: v.x + 6.5, y0: v.y - 1.5, y1: v.y + 2 }));
  (P.sts || []).forEach((v) => O.push({ x0: v.x - 4.5, x1: v.x + 4.5, y0: v.y - 4.5, y1: v.y + 2.5 }));
  return O;
}
const ramChoca = (R, O) => O.some((b) => b.x0 < R.x1 && b.x1 > R.x0 && b.y0 < R.y1 && b.y1 > R.y0);
// ubica la hoja a escala esc: prueba correr el dibujo dentro de la hoja y busca un lugar libre sobre los bordes para el recuadro
function ramUbicar(p, esc, O) {
  const m = esc / 1000, W = p.A.W * m, H = p.A.H * m, b = p.caja, rw = (p.rot.W + 3) * m, rh = (p.rot.H + 3) * m;
  if (rw > W || rh > H) return null;
  const hx = Math.max(0, W - (b.x1 - b.x0)) / 2, hy = Math.max(0, H - (b.y1 - b.y0)) / 2, cx = (b.x0 + b.x1) / 2 - W / 2, cy = (b.y0 + b.y1) / 2 - H / 2;
  const pos = [[1, 1], [0, 1], [1, 0], [0, 0]]; [0.25, 0.5, 0.75].forEach((t) => pos.push([t, 1], [t, 0], [1, t], [0, t]));
  // desplazamientos del dibujo (centrado primero) y posiciones del recuadro: esquinas primero, después el resto del borde
  for (const [dx, dy] of [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const x0 = cx - dx * hx, y0 = cy - dy * hy;
    for (const [tx, ty] of pos) {
      const rx = x0 + tx * (W - rw), ry = y0 + ty * (H - rh), R = { x0: rx, x1: rx + rw, y0: ry, y1: ry + rh };
      // rl/rt: posición del recuadro (mm) desde el borde del área de dibujo, con 3 mm de separación del dibujo
      if (!ramChoca(R, O)) return { x0, y0, W, H, rl: (rx - x0) / m + (tx > 0.5 ? 3 : 0), rt: (ry - y0) / m + (ty > 0.5 ? 3 : 0) };
    }
  }
  return null;
}
// reparte cada sector en hojas: grilla con la escala más grande y lugar libre para el recuadro de referencias en cada hoja.
// Con o.menos, usa menos hojas que o.n si el sector entra igual a 1:400 o mejor (p. ej. el sector 2 en una sola A3).
function ramHojas(C, o) {
  const n = o.n || 4, hojas = [], secs = o.sec === 'all' ? [...new Set(C.L.map((r) => r.t.s))].sort() : [o.sec], dist = o.modo !== 'ram';
  const ks = o.menos === false ? [n] : [1, 2, 4, 6, 8].filter((k) => k <= n).concat([1, 2, 4, 6, 8].includes(n) ? [] : [n]);
  secs.forEach((s) => {
    const T = C.L.filter((r) => r.t.s === s && r.n).map((r) => Object.assign({}, ramRect(r.t), { id: r.t.id, s: r.t.s }));
    if (!T.length) return; const O = ramObst(T), cj = ramCaja(T), asp = (cj.y1 - cj.y0) / (cj.x1 - cj.x0);
    let sel = null;
    for (const k of ks) {
      let cands = ramGrilla(T, k, o.size);
      if (!cands.length) { if (k !== n) continue; const A = ramArea(o.size, false), bb = ramCaja(T); cands = [{ v: Math.min(A.W / (bb.x1 - bb.x0), A.H / (bb.y1 - bb.y0)), port: false, c: 1, r: 1, A, G: [[T]] }]; }
      // cada grilla candidata con su recuadro de referencias: gana la que queda a mayor escala
      let mejor = null;
      for (const comp of [false, true]) for (const best of cands) {
        const e0 = Math.ceil(1000 / best.v / 25) * 25; if (mejor && e0 >= mejor.esc - (comp && !mejor.comp ? 50 : 0)) continue;
        const pz = []; best.G.forEach((col, ci) => col.forEach((g, ri) => {
          const ids = new Set(g.map((t) => t.id)), nCod = !dist ? 0 : o.modo === 'tubo' ? new Set(C.L.filter((r) => ids.has(r.t.id)).flatMap((r) => tubosDe(r.t))).size : new Set(C.L.filter((r) => ids.has(r.t.id)).flatMap((r) => r.H.map((h) => ramCodCorto(h.cod)))).size;
          pz.push({ s, port: best.port, A: best.A, cols: best.c, filas: best.r, ci, ri, caja: ramCaja(g), ids, rot: ramRotDim(o.size, nCod, dist, asp, comp) }); }));
        // obstáculos de cada hoja: sus trackers, inversores y STS (los trackers de las hojas vecinas van en gris y se pueden tapar)
        const OP = pz.map((p) => O.filter((b, j) => j >= T.length || p.ids.has(T[j].id)));
        // el compacto solo si mejora la escala en al menos 1:50
        let esc = e0, ub = null, tope = mejor ? mejor.esc - (comp && !mejor.comp ? 50 : 0) : e0 * 3;
        for (; esc < tope; esc += 25) { ub = pz.map((p, j) => ramUbicar(p, esc, OP[j])); if (ub.every(Boolean)) break; }
        if (esc >= tope || !ub || !ub.every(Boolean)) continue;
        pz.forEach((p, i) => Object.assign(p, ub[i], { esc })); mejor = { esc, pz, comp };
      }
      if (!mejor) { // sin esquina libre en ninguna grilla: la de mayor escala, recuadro abajo a la derecha
        const best = cands[0], esc = Math.ceil(1000 / best.v / 25) * 25, m = esc / 1000, pz = [];
        best.G.forEach((col, ci) => col.forEach((g, ri) => { const cj2 = ramCaja(g), W = best.A.W * m, H = best.A.H * m;
          pz.push({ s, port: best.port, A: best.A, cols: best.c, filas: best.r, ci, ri, caja: cj2, ids: new Set(g.map((t) => t.id)), rot: ramRotDim(o.size, 20, dist, asp), x0: (cj2.x0 + cj2.x1) / 2 - W / 2, y0: (cj2.y0 + cj2.y1) / 2 - H / 2, W, H, rl: best.A.W - ramRotDim(o.size, 20, dist, asp).W, rt: best.A.H - ramRotDim(o.size, 20, dist, asp).H, esc }); }));
        mejor = { esc, pz };
      }
      const pz = mejor.pz, esc = mejor.esc;
      sel = pz; if (esc <= RAM_ESC_MAX || k === ks[ks.length - 1]) break;
    }
    // orden de lectura: de norte a sur y de oeste a este
    sel.sort((a, b) => a.ri - b.ri || a.ci - b.ci).forEach((p, i, L) => { p.i = i + 1; p.de = L.length; p.todas = L; p.T = T; hojas.push(p); });
  });
  return hojas;
}
// croquis de ubicación de la hoja dentro del sector
function ramCroquis(p, mw = 46, mh = 15) {
  const b = ramCaja(p.T), w = b.x1 - b.x0, h = b.y1 - b.y0, k = Math.min(mw / w, mh / h), sw = (0.35 / k).toFixed(2);
  return `<svg viewBox="${b.x0} ${b.y0} ${w} ${h}" style="width:${(w * k).toFixed(1)}mm;height:${(h * k).toFixed(1)}mm" class="rmcroq">`
    + p.T.map((t) => `<rect x="${t.x}" y="${t.y}" width="${t.w}" height="${t.h}" fill="#bbb"/>`).join('')
    + p.todas.map((q) => { const c = q.caja; return `<rect x="${c.x0}" y="${c.y0}" width="${c.x1 - c.x0}" height="${c.y1 - c.y0}" fill="${q === p ? 'rgba(194,94,0,.35)' : 'none'}" stroke="${q === p ? '#c25e00' : '#555'}" stroke-width="${sw}"/><text x="${(c.x0 + c.x1) / 2}" y="${(c.y0 + c.y1) / 2}" font-size="${(Math.min(5.5, Math.max(3, Math.min(c.x1 - c.x0, c.y1 - c.y0) * k * 0.45)) / k).toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-weight="700" fill="${q === p ? '#7a3a00' : '#333'}">${q.i}</text>`; }).join('') + '</svg>';
}
function ramPdfPlano(o) {
  const C = ramCalc(), HA = (S.hincado || {}).avance || {}, hojas = ramHojas(C, o), tubo = o.modo === 'tubo', dist = o.modo === 'dist' || tubo;
  const secsR = [...new Set(hojas.map((h) => h.s))], nPre = dist && hojas.length ? 1 + (ramAccTabla(C, secsR, 'rmres', 'n') || 1) : 0;
  const tit = tubo ? 'Plano de distribución de tubos de torque' : dist ? 'Plano de distribución de hincas' : 'Ramming plan · altura libre', pre = !dist && ramP().precarga;
  const pags = hojas.map((p, i) => {
    const txt = Math.max(0.55, Math.min(1.2, 2.6 * p.esc / 1000)), A = p.A;
    let g = '';
    p.T.forEach((t) => { if (t.x > p.x0 + p.W || t.x + t.w < p.x0 || t.y > p.y0 + p.H || t.y + t.h < p.y0) return;
      const r = C.map.get(t.id), L = ramPilesLocal(t, r), top = Math.min(...L.map((q) => q.y)), bot = Math.max(...L.map((q) => q.y));
      if (!p.ids.has(t.id)) { // tracker de otra hoja: solo el eje, en gris, como contexto
        g += `<line x1="${L[0].x}" y1="${top}" x2="${L[0].x}" y2="${bot}" stroke="#d5d5d5" stroke-width="0.25"/>` + ramTxt(L[0].x, top - 1, t.id.replace('TRK-', 'TR '), txt, 'text-anchor="middle" fill="#aaa"'); return; }
      g += `<line x1="${L[0].x}" y1="${top}" x2="${L[0].x}" y2="${bot}" stroke="#d09060" stroke-width="0.12"/>`;
      if (tubo) { g += ramTuboSVG(r.t, L, txt); return; }
      g += ramTrkTxt(t, L, o, txt);
      L.forEach(({ h, k, x, y }) => { g += ramPilaSVG(h, k, x, y, Object.assign({}, o, { lat: ramLat(t, L, k) }), o.hech && !!HA[t.id], txt); });
    });
    g += ramRefSVG(txt, true);
    if (pre) g += `<text x="${p.x0 + p.W / 2}" y="${p.y0 + p.H / 2}" font-size="${(p.W / 9).toFixed(1)}" text-anchor="middle" dominant-baseline="middle" fill="#c0392b" fill-opacity="0.10" font-weight="700" transform="rotate(-30 ${p.x0 + p.W / 2} ${p.y0 + p.H / 2})">PRECARGA</text>`;
    return `<section class="rmpg" data-o="${p.port ? 'P' : 'L'}" style="width:${A.pw}mm;height:${A.ph}mm">
      <svg viewBox="${p.x0.toFixed(2)} ${p.y0.toFixed(2)} ${p.W.toFixed(2)} ${p.H.toFixed(2)}" style="display:block;width:${A.W}mm;height:${A.H}mm" font-family="Arial">${g}</svg>
      ${ramRotulo(p, i + nPre, hojas.length + nPre, { tit, dist, tubo, pre, size: o.size, C })}</section>`;
  });
  // distribución: primera hoja con el nomograma y las cantidades por sector
  const accP = dist && hojas.length ? ramAccPag(C, o, secsR, ramArea(o.size, false)) : [];
  if (dist && hojas.length) pags.unshift(ramResumen(C, o, secsR, ramArea(o.size, false)), ...accP);
  const orden = (dist && hojas.length ? ['L'].concat(accP.map(() => 'L')) : []).concat(hojas.map((p) => (p.port ? 'P' : 'L')));
  // hojas verticales y apaisadas: se imprimen por separado y se unen en orden (Chromium no mezcla bien orientaciones)
  ramPrintPaginas(pags.join(''), `${tubo ? 'Plano de distribución de tubos de torque' : dist ? 'Plano de distribución de hincas' : 'Ramming plan' + (pre ? ' PRECARGA' : '')} ${o.sec === 'all' ? 'todos los sectores' : 'sector ' + o.sec} ${today()}.pdf`, o.size, orden);
}
const esc_ = (s) => esc(s);
// recuadro de referencias de la hoja: título, esquema de hojas del sector, referencias y datos de la hoja
function ramRotulo(p, i, tot, o) {
  const R = p.rot, L = o.C.L.filter((r) => p.ids.has(r.t.id)), nH = L.reduce((q, r) => q + r.n, 0), nM = L.reduce((q, r) => q + r.H.filter((h) => h.motor).length, 0);
  const sum = (x) => Object.values(x || {}).reduce((a, b) => a + b, 0), RP = window.REPLANTEO || {}, pos = `left:${(8 + Math.max(0, p.rl)).toFixed(1)}mm;top:${(8 + Math.max(0, p.rt)).toFixed(1)}mm`;
  let ref;
  const LS = o.C.L.filter((r) => r.t.s === p.s);
  if (o.tubo) { const m = new Map(), ms = ramConteo({ L: LS }, 'tubo'); L.forEach((r) => tubosDe(r.t).forEach((c) => m.set(c, (m.get(c) || 0) + 1)));
    ref = `<div class="rmrcod rmrcnt"><span class="rmrch">Tubo · hoja / sector</span><span class="rmrch">Tubo · hoja / sector</span>${[...m.keys()].sort((a, b) => TUBO_ORD.indexOf(a) - TUBO_ORD.indexOf(b)).map((c) => { const i = tuboInfo(c); return `<span><i style="background:${i.col}"></i><b>${esc(c)}</b> <small>${R.comp ? '' : esc(String(i.size).replace('□', '□ ')) + ' · '}${fmt(i.largo / 1000, 2)} m</small>${tuboMarca(c).map((x) => `<i style="background:${TCOL[x] || '#fff'};width:2.2mm;height:2.2mm;margin:0 0 0 0.8mm"></i>`).join('')} <em>${fmt(m.get(c))} / ${fmt(sum(ms.get(c)))}</em></span>`; }).join('')}</div>`
      + `<p class="rmrnota">Vigas □130 de norte a sur, con su largo real, centradas en la hinca motor (M). Color y código del plano Trina 26050-PGxxx (${esc(TUBO_DOC)}). Bandas en los extremos: marca de pintura de obra. Resumen por sector en la pág. 1.</p>`;
  } else if (o.dist) { const m = new Map(), ms = ramConteo({ L: LS }, 'dist'); L.forEach((r) => r.H.forEach((h) => { const k = h.cod && hcat(h.cod); if (k) { const c = ramCodCorto(h.cod), x = m.get(c) || { k, n: 0 }; x.n++; m.set(c, x); } }));
    ref = (m.size ? `<div class="rmrcod rmrcnt"><span class="rmrch">Código · hoja / sector</span><span class="rmrch">Código · hoja / sector</span>${[...m.entries()].sort().map(([c, x]) => `<span>${ramDosCol(x.k)}<b>${esc(c)}</b> <em>${fmt(x.n)} / ${fmt(sum(ms.get(c)))}</em></span>`).join('')}</div>` : '<p><b>Falta la distribución de Trina</b> (Catálogo y distribución).</p>')
      + `<p class="rmrnota">Colores: triángulo de arriba = cabeza (rojo general suelo normal, azul general suelo blando, sin color motor); de abajo = punta (largo y perfil). Sector ${p.s}: ${fmt([...ms.values()].reduce((q, x) => q + sum(x), 0))} hincas. Nomograma y cantidades por sector en la pág. 1.</p>`;
  } else ref = '<div class="rmrcod"><span><i style="background:#58b368"></i>Dentro de tolerancia</span><span><i style="background:#f0a23b"></i>Salto con la vecina</span><span><i style="background:#d64545"></i>Fuera de tolerancia</span></div><p class="rmrnota">Rótulo de cada hinca: número (norte a sur) · altura libre (m).</p>';
  if (o.dist) ref += ramAccRot(o.C, p.s);
  ref += '<div class="rmrcod"><span><i style="background:#fff;border:0.5mm solid #000"></i>M = hinca motor</span><span><i style="background:#fff;border:0.35mm solid #c25e00"></i>Inversor</span><span><i style="background:#fff;border:0.35mm solid #1f2a37"></i>STS</span><span>✕ tracker hincado</span></div>';
  return `<div class="rmrot${R.comp ? ' rmrc' : ''}" style="${pos};width:${R.W}mm;max-height:${R.H.toFixed(0)}mm;overflow:hidden">
    <div class="rmrt"><b>${o.tit}</b>${o.pre ? '<span class="rmpre">PRECARGA · no apto para hincar</span>' : ''}<div>${esc(S.nombre || '')}</div></div>
    <div class="rmrg"><div><small>Sector</small><b>${p.s}</b></div><div><small>Hoja</small><b>${p.i} de ${p.de}</b></div><div><small>Escala</small><b>1:${p.esc}</b></div><div><small>Norte</small><b class="rmrn">▲</b></div></div>
    <h5>Esquema de hojas del sector ${p.s}</h5>${ramCroquis(p, R.W - (R.comp ? 7 : 8), R.ch)}
    <h5>Referencias${o.tubo ? ' · tubos de torque' : o.dist ? ' · hincas por código' : ''}</h5>${ref}
    <div class="rmrpie">${L.length} trackers · ${o.tubo ? `${fmt(L.reduce((q, r) => q + tubosDe(r.t).length, 0))} tubos` : `${fmt(nH)} hincas (${fmt(nM)} de motor)`} en esta hoja<br>${o.tubo ? `Tubos: Trina ${esc(TUBO_DOC)} · ` : o.dist ? `Distribución: Trina ${esc(TRINA_DIST_DOC)} · ` : ''}Replanteo: ${esc((RP.fuente || '').split(' · ')[0])} · numeración OBEII-GR-PL-003 r1<br>Hoja ${o.size} · ${new Date().toLocaleDateString('es-AR')} · pág. ${i + 1}/${tot}</div></div>`;
}
async function ramPrintPaginas(html, name, size, orden) {
  // 1 mm menos de alto que la hoja: con el redondeo a píxeles, una hoja exacta a veces desborda y Chromium agrega una página en blanco
  html = html.replace(/(<section class="rmpg[^"]*"[^>]*?height:)([\d.]+)mm/g, (m, a, h) => `${a}${(Number(h) - 1).toFixed(1)}mm`);
  const pa = $('#printArea'); pa.innerHTML = html;
  document.body.classList.add('pr-land', 'imprimiendo', 'pr-plano');
  await new Promise((r) => requestAnimationFrame(() => r()));
  document.documentElement.style.background = document.body.style.background = '#fff';
  const p = await window.api.printPDF(name, orden && orden.length ? { size, orden } : { landscape: true, size });
  document.body.classList.remove('imprimiendo', 'pr-plano');
  document.documentElement.style.background = document.body.style.background = '';
  pa.innerHTML = '';
  if (p) toast('PDF guardado', { action: ['Abrir', () => window.api.openPath(p)] });
}
