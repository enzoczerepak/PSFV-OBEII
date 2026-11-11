/* PSFV-OBE II · Hincado: catálogo Trina, discretización, distribución, recepciones y avance. */
// ======================= HINCADO =======================
// Catálogo de hincas (Trina CIV-DW-26050-2402-0B "Post details"): código, tipo, suelo, perfil, largos y color de punta.
// La distribución por tracker sale de la discretización (Border / Outer / Inner, suelo normal / blando) y de la
// matriz de hincas por configuración (qué código va en cada posición), que se carga del documento de Trina.
const HCOL = { Rojo: '#e53935', Azul: '#1f5fd6', Verde: '#2db34a', Violeta: '#7c3aed', Magenta: '#e03fc6', Negro: '#1f2328', Gris: '#9aa0a6', Blanco: '#ffffff', 'Sin marca': 'transparent' };
const HCAT_SEED = [
  ['26050-MS7-PW614-1A', 'Drive', 'N', '152×152', 3430, 1230, 2200, 2000, 'Rojo'], ['26050-MS5-PW608-1A', 'Drive', 'N', '148×100', 3460, 1260, 2200, 2000, 'Azul'],
  ['26050-MS5-PW608-2A', 'Drive', 'N', '148×100', 3260, 1260, 2000, 1800, 'Verde'], ['26050-MS7-PW610-1A', 'Drive', 'N', '151×100', 3730, 1230, 2500, 2300, 'Violeta'],
  ['26050-MS5-PW609-1A', 'Drive', 'N', '150×100', 3260, 1260, 2000, 1800, 'Blanco'],
  ['26050-PW610-1A', 'Standard/Damper', 'N', '151×100', 3515, 1315, 2200, 2000, 'Rojo'], ['26050-PW610-2A', 'Standard/Damper', 'N', '151×100', 3815, 1315, 2500, 2300, 'Azul'],
  ['26050-PW606-1A', 'Standard/Damper', 'N', '146×95', 3515, 1315, 2200, 2000, 'Verde'], ['26050-PW608-1A', 'Standard/Damper', 'N', '148×100', 3615, 1315, 2300, 2100, 'Violeta'],
  ['26050-PW606-2A', 'Standard/Damper', 'N', '146×95', 3315, 1315, 2000, 1800, 'Blanco'], ['26050-PW611-1A', 'Standard/Damper', 'N', '152×102', 3815, 1315, 2500, 2300, 'Negro'],
  ['26050-PW609-1A', 'Standard/Damper', 'N', '150×100', 3615, 1315, 2300, 2100, 'Magenta'],
  ['26050-MS7-PW614-1B', 'Drive', 'B', '152×152', 3730, 1230, 2500, 2300, 'Sin marca'], ['26050-MS5-PW608-1B', 'Drive', 'B', '148×100', 3660, 1260, 2400, 2200, 'Negro'],
  ['26050-MS7-PW610-1B', 'Drive', 'B', '151×100', 4330, 1230, 3100, 2900, 'Magenta'], ['26050-MS5-PW609-1B', 'Drive', 'B', '150×100', 3660, 1260, 2400, 2200, 'Gris'],
  ['26050-PW610-1B', 'Standard/Damper', 'B', '151×100', 4115, 1315, 2800, 2600, 'Gris'], ['26050-PW610-2B', 'Standard/Damper', 'B', '151×100', 4515, 1315, 3200, 3000, 'Verde'],
  ['26050-PW606-1B', 'Standard/Damper', 'B', '146×95', 3615, 1315, 2300, 2100, 'Violeta'], ['26050-PW608-1B', 'Standard/Damper', 'B', '148×100', 4215, 1315, 2900, 2700, 'Blanco'],
  ['26050-PW606-2B', 'Standard/Damper', 'B', '146×95', 4115, 1315, 2800, 2600, 'Negro'], ['26050-PW611-1B', 'Standard/Damper', 'B', '152×102', 4515, 1315, 3200, 3000, 'Magenta'],
  ['26050-PW609-1B', 'Standard/Damper', 'B', '150×100', 4315, 1315, 3000, 2800, 'Gris'],
].map(([codigo, tipo, suelo, perfil, largo, sobre, nrl, mrl, color]) => ({ codigo, tipo, suelo, perfil, largo, sobre, nrl, mrl, color }));
const HZ = { Border: 'Borde', Outer: 'Exterior', Inner: 'Interior' }, HSL = { N: 'suelo normal', B: 'suelo blando' };
const HCFGS = [['1P52', 'Border'], ['1P52', 'Outer'], ['1P52', 'Inner'], ['1P26', 'Border'], ['1P26', 'Outer']].flatMap(([t, z]) => ['N', 'B'].map((sl) => `${t}|${z}|${sl}`));
const cfgDe = (t) => `${t.t}|${t.z || 'Outer'}|${t.sl || 'N'}`;
const cfgTxt = (k) => { const [t, z, sl] = k.split('|'); return `${t} ${HZ[z] || z} · ${HSL[sl]}`; };
const CFGCOL = { '1P52|Border': '#e15759', '1P52|Outer': '#f28e2b', '1P52|Inner': '#4e79a7', '1P26|Border': '#b07aa1', '1P26|Outer': '#59a14f' };
function normalizarHincado(st) {
  const H = (st.hincado = st.hincado || {});
  H.catalogo = H.catalogo && H.catalogo.length ? H.catalogo : HCAT_SEED.map((x) => Object.assign({}, x));
  H.matriz = H.matriz || {};
  HCFGS.forEach((k) => { if (!H.matriz[k]) H.matriz[k] = { n: k.startsWith('1P52') ? 12 : 10, pos: [], conf: false }; });
  H.avance = H.avance || {}; H.recep = H.recep || [];
}
const hcat = (c) => (S.hincado.catalogo || []).find((x) => x.codigo === c);
const chipH = (c, small) => { const k = hcat(c); const col = k ? k.color : ''; return `<span class="hchip${small ? ' sm' : ''}" title="${esc(c)}${k ? ' · ' + k.tipo + ' · ' + k.perfil + ' · ' + fmt(k.largo) + ' mm · ' + col : ''}"><i class="hc" style="--hc:${HCOL[col] || '#ccc'}" data-c="${esc(col)}"></i>${esc(String(c || '–').replace(/^26050-/, ''))}</span>`; };
const colorChip = (col) => `<span class="hcol"><i class="hc" style="--hc:${HCOL[col] || '#ccc'}" data-c="${esc(col)}"></i>${esc(col)}</span>`;
// posiciones de un tracker según la matriz de su configuración
const posDe = (t) => { const m = S.hincado.matriz[cfgDe(t)] || {}; return Array.from({ length: m.n || 0 }, (_, i) => (m.pos || [])[i] || ''); };
// replanteo de hincas (OBEII-CI-LI-211 r3): frame de la lista, cantidad y coordenadas de cada hinca
const repDe = (id) => (window.REPLANTEO && window.REPLANTEO.trk[id]) || null;
const nHincas = (t) => { const r = repDe(t.id); return r ? r.n : (S.hincado.matriz[cfgDe(t)] || {}).n || 0; };
const matrizOk = (k) => { const m = S.hincado.matriz[k]; return m && m.n > 0 && Array.from({ length: m.n }, (_, i) => (m.pos || [])[i]).every(Boolean); };
function hincInfo() {
  const P = window.PLANO; if (!P) return null;
  const H = S.hincado, trk = P.trk;
  const cfgN = {}; trk.forEach((t) => { const k = cfgDe(t); cfgN[k] = (cfgN[k] || 0) + 1; });
  const usadas = Object.keys(cfgN), completa = usadas.every(matrizOk);
  const req = {}, hecho = {}, porSec = {};
  trk.forEach((t) => {
    const ps = posDe(t), av = H.avance[t.id];
    const s = (porSec[t.s] = porSec[t.s] || { n: 0, h: 0, pil: 0, pilH: 0 });
    s.n++; if (av) s.h++;
    ps.forEach((c) => { if (!c) return; req[c] = (req[c] || 0) + 1; s.pil++; if (av) { hecho[c] = (hecho[c] || 0) + 1; s.pilH++; } });
  });
  const rec = {}, recDud = {};
  H.recep.forEach((r) => { const v = verificar(r); (v.ok ? rec : recDud)[r.codigo] = ((v.ok ? rec : recDud)[r.codigo] || 0) + (Number(r.cant) || 0); });
  const nH = Object.keys(H.avance).filter((id) => trk.some((t) => t.id === id)).length;
  // cantidad de hincas: del replanteo (aunque falte el código de cada posición)
  const RP = window.REPLANTEO, nRep = RP ? trk.reduce((a, t) => a + nHincas(t), 0) : 0, nRepH = RP ? trk.filter((t) => H.avance[t.id]).reduce((a, t) => a + nHincas(t), 0) : 0;
  trk.forEach((t) => { const s = porSec[t.s]; s.rep = (s.rep || 0) + nHincas(t); if (H.avance[t.id]) s.repH = (s.repH || 0) + nHincas(t); });
  const repObs = RP ? { mix: trk.filter((t) => (repDe(t.id) || {}).mix), dif: trk.filter((t) => (repDe(t.id) || {}).dif), extra: RP.extra || [] } : null;
  if (repObs) repObs.n = trk.filter((t) => { const r = repDe(t.id) || {}; return r.mix || r.dif; }).length;
  return { P, trk, cfgN, usadas, completa, req, hecho, rec, recDud, porSec, nH, nPil: completa ? Object.values(req).reduce((a, b) => a + b, 0) : nRep, nPilH: completa ? Object.values(hecho).reduce((a, b) => a + b, 0) : nRepH, nRep, nRepH, RP, repObs };
}
// verificación de una recepción contra el manual: color, largo y perfil
function verificar(r) {
  const k = hcat(r.codigo), out = { ok: true, msgs: [], sug: [] };
  if (!k) { out.ok = false; out.msgs.push('Código que no está en el manual'); return out; }
  if (r.color && r.color !== k.color) { out.ok = false; out.msgs.push(`Color ${r.color}: el manual indica ${k.color} para ${k.codigo.replace(/^26050-/, '')}`); }
  if (r.largo && Math.abs(Number(r.largo) - k.largo) > 25) { out.ok = false; out.msgs.push(`Largo ${fmt(r.largo)} mm: el manual indica ${fmt(k.largo)} mm`); }
  if (r.perfil && String(r.perfil).replace(/\s|x|X|×/g, '') !== k.perfil.replace(/×/g, '')) { out.ok = false; out.msgs.push(`Perfil ${esc(r.perfil)}: el manual indica ${k.perfil}`); }
  if (!out.ok) {
    // qué código coincide con lo que se recibió
    out.sug = S.hincado.catalogo.filter((x) => x.codigo !== k.codigo && (!r.color || x.color === r.color) && (!r.largo || Math.abs(x.largo - Number(r.largo)) <= 25) && (!r.perfil || String(r.perfil).replace(/\s|x|X|×/g, '') === x.perfil.replace(/×/g, ''))).map((x) => x.codigo);
  }
  return out;
}
// ---- vistas
// Aviso de precarga: qué datos ya están y qué documentos faltan para determinar la distribución
function hincPrecargaHTML(I) {
  if (!I || I.completa) return '';
  const inc = HCFGS.filter((k) => I.cfgN[k] && !matrizOk(k)).length, rev = I.trk.filter((t) => t.rev).map((t) => t.id);
  return `<div class="card hpre"><div class="hpreh"><span class="pill p-warn">PRECARGA</span><b>Hincado en condición de precarga</b><span class="muted">· la distribución de hincas por tracker todavía no está determinada</span></div>
    <div class="hprec"><div><h4>Datos cargados</h4><ul>
      <li>✓ Catálogo de hincas: Trina <b>CIV-DW-26050-2402-0B</b> "Post details" (rev. 0B, 25/08/2026) · ${S.hincado.catalogo.length} códigos con perfil, largos y color de punta.</li>
      ${I.RP ? `<li>✓ Replanteo de hincas: <b>OBEII-CI-LI-211 r3</b> (21/10/2026) · ${fmt(I.RP.nHincas)} hincas en ${fmt(I.RP.nFrames)} frames, con coordenadas: 13 por tracker 1P52 y 7 por 1P26.${I.repObs.mix.length || I.repObs.dif.length || I.repObs.extra.length ? ` <a href="#" data-go="htrk">${I.repObs.n} trackers a revisar</a>` : ''}</li>` : ''}
      <li>✓ Discretización: Trina <b>TT-OPP-094140_5</b> "General Layout Discretization" (opción 3, rev. 02) · ${fmt(I.trk.length)} trackers en ${I.usadas.length} configuraciones (zona y suelo).</li></ul></div>
    <div><h4>Documentos que faltan para determinar</h4><ol>
      <li><b>Distribución de hincas por tracker</b> (Trina, probablemente CIV-DW-26050-2401 · "Post layout" / "Pile distribution" / "Ramming plan"): cantidad de hincas y código en cada posición para las ${I.usadas.length} configuraciones. <span class="muted">Faltan ${inc} de ${I.usadas.length}.</span></li>
      ${I.RP ? '' : '<li><b>Replanteo de estructuras · hincado de perfiles</b> (OBEII-CI-PL-211-rA): posición de cada hinca en obra.</li>'}
      <li><b>Confirmación de la discretización</b> contra el layout vigente (OBEII-GR-PL-001-r4)${rev.length ? `: ${rev.length} trackers no coinciden (${rev.join(', ')})` : ''}.</li>
      <li><b>Packing list / remitos de Trina</b> por código: para controlar cantidades en la recepción.</li></ol></div></div>
    <p class="hint" style="margin:6px 0 0">Hasta tener el punto 1 se registra el avance por tracker (con la cantidad de hincas del replanteo) y las recepciones verificadas contra el catálogo, pero no se calculan las hincas requeridas por código, el stock ni la secuencia de colores. La distribución se carga en <a href="#" data-go="hcat">Catálogo y distribución</a>.</p></div>`;
}
// cartel al entrar al menú Hincado mientras la distribución no esté completa
let hincAvisoVisto = false;
async function hincAvisoEntrada() {
  const I = hincInfo(); if (!I || I.completa || $('#modal:not(.hidden)')) return;
  const inc = HCFGS.filter((k) => I.cfgN[k] && !matrizOk(k)).length;
  await modal({ title: 'Hincado · fase de precarga', wide: true,
    sub: 'La distribución de hincas por tracker todavía no está determinada: los conteos por código, el stock y la secuencia de colores se completan cuando lleguen los documentos que faltan.',
    body: `<div class="hpremod">${ICO.hinca}<div>
      <p><b>Ya se puede usar:</b> registrar el avance de hincado tracker por tracker, ver el plano por discretización y verificar las recepciones de hincas contra el manual de Trina (código, color, largo y perfil).</p>
      <p><b>Faltan para determinar:</b></p><ol>
        <li>Distribución de hincas por tracker de Trina (probablemente CIV-DW-26050-2401): ${inc} de ${I.usadas.length} configuraciones sin cargar.</li>
        ${I.RP ? '' : '<li>Replanteo de estructuras · hincado de perfiles (OBEII-CI-PL-211-rA).</li>'}
        <li>Confirmación de la discretización contra el layout vigente (${I.trk.filter((t) => t.rev).length} trackers a verificar).</li>
        <li>Packing list / remitos de Trina por código.</li></ol></div></div>`,
    buttons: [['Ver detalle', 'btn', () => 'det'], ['Entendido', 'btn pri', () => null]] }).then((r) => { if (r === 'det') go('hincado'); });
  hincAvisoVisto = true;
}
function vHincado(el) {
  actions([['Exportar Excel', 'btn', exportHinc], ['Distribución por tracker', 'btn pri', () => go('htrk')]]);
  const I = hincInfo(); if (!I) { el.innerHTML = '<div class="card empty"><b>Sin plano cargado</b></div>'; return; }
  const pct = (a, b) => (b ? (a / b) * 100 : 0);
  const secs = Object.keys(I.porSec).sort();
  const H = S.hincado;
  // avance por fecha
  const porF = {}; Object.entries(H.avance).forEach(([, v]) => { if (v && v.f) porF[v.f] = (porF[v.f] || 0) + 1; });
  const fs = Object.keys(porF).sort();
  let ac = 0; const curva = fs.map((f) => [f, (ac += porF[f])]);
  const cods = Object.keys(I.req).sort((a, b) => (hcat(a) || {}).suelo?.localeCompare((hcat(b) || {}).suelo) || a.localeCompare(b));
  el.innerHTML = `${hincPrecargaHTML(I)}
    <div class="grid g4 stagger" style="margin-bottom:16px">
      <div class="card kpi"><div class="kl">Trackers hincados</div><div class="kv">${fmt(I.nH)}<small> / ${fmt(I.trk.length)}</small></div><div class="sbt"><div style="width:${pct(I.nH, I.trk.length).toFixed(1)}%;background:#00939a"></div></div><div class="muted">${fmt(pct(I.nH, I.trk.length), 1)} %</div></div>
      <div class="card kpi"><div class="kl">Hincas hincadas</div><div class="kv">${I.nPil ? `${fmt(I.nPilH)}<small> / ${fmt(I.nPil)}</small>` : '–'}</div><div class="sbt"><div style="width:${pct(I.nPilH, I.nPil).toFixed(1)}%;background:#00939a"></div></div><div class="muted">${I.nPil ? fmt(pct(I.nPilH, I.nPil), 1) + ' %' + (I.completa ? '' : ' · cantidades del replanteo') : 'falta la distribución'}</div></div>
      <div class="card kpi"><div class="kl">Hincas recibidas (verificadas)</div><div class="kv">${fmt(Object.values(I.rec).reduce((a, b) => a + b, 0))}</div><div class="muted">${Object.values(I.recDud).reduce((a, b) => a + b, 0) ? `<b class="tneg">${fmt(Object.values(I.recDud).reduce((a, b) => a + b, 0))} a revisar</b> (no coinciden con el manual)` : 'todo coincide con el manual'}</div></div>
      <div class="card kpi"><div class="kl">Discretización</div><div class="kv">${I.usadas.length}<small> configuraciones</small></div><div class="muted">${fmt(I.trk.filter((t) => t.sl === 'B').length)} trackers en suelo blando</div></div>
    </div>
    <div class="grid g2" style="margin-bottom:16px">
      <div class="card"><h3>Avance por sector</h3>${secs.map((s) => { const x = I.porSec[s]; return `<div class="mrow"><span><i class="cdot" style="background:${SECT_COL[s]}"></i>Sector ${s}</span><div class="sbt"><div style="width:${pct(x.h, x.n).toFixed(1)}%;background:${SECT_COL[s]}"></div></div><b>${x.h}/${x.n}</b></div>${x.rep ? `<div class="muted" style="font-size:11.5px;margin:-4px 0 6px 16px">${fmt(x.repH || 0)} de ${fmt(x.rep)} hincas</div>` : ''}`; }).join('')}
        <p class="hint">Trackers con hincado completo sobre el total del sector.</p></div>
      <div class="card"><h3>Hincado por fecha</h3>${curva.length ? Charts.line([{ name: 'Hincado', color: '#7c5cbf', pts: curva.map(([f, v]) => ({ x: new Date(f + 'T12:00:00'), y: v / I.trk.length, tip: `${fechaCorta(f)}: ${v} trackers (${fmt(v / I.trk.length * 100, 1)} %)` })) }]) : '<p class="muted">Todavía no hay trackers hincados.</p>'}
        ${fs.length ? `<div class="muted">Último día: ${fechaCorta(fs[fs.length - 1])} · ${porF[fs[fs.length - 1]]} trackers</div>` : ''}</div></div>
    <div class="card" style="margin-bottom:16px"><h3>Trackers por configuración y sector</h3><div class="tblwrap"><table class="tbl"><thead><tr><th>Configuración</th>${secs.map((s) => `<th class="n">Sector ${s}</th>`).join('')}<th class="n">Total</th><th class="n">Hincados</th><th>Distribución</th></tr></thead><tbody>
      ${HCFGS.filter((k) => I.cfgN[k]).map((k) => `<tr><td><i class="cdot" style="background:${CFGCOL[k.split('|').slice(0, 2).join('|')]}"></i>${cfgTxt(k)}</td>${secs.map((s) => `<td class="n">${I.trk.filter((t) => t.s === s && cfgDe(t) === k).length || ''}</td>`).join('')}<td class="n"><b>${I.cfgN[k]}</b></td><td class="n">${I.trk.filter((t) => cfgDe(t) === k && H.avance[t.id]).length}</td><td>${matrizOk(k) ? `<span class="pill p-done">${H.matriz[k].n} hincas</span>` : '<span class="pill p-warn">a cargar</span>'}</td></tr>`).join('')}
      </tbody></table></div></div>
    <div class="card"><h3>Hincas por código</h3>${cods.length ? `<div class="tblwrap"><table class="tbl"><thead><tr><th>Código</th><th>Tipo</th><th>Perfil · largo</th><th class="n">Requeridas</th><th class="n">Recibidas OK</th><th class="n">A revisar</th><th class="n">Hincadas</th><th class="n">Stock en obra</th><th class="n">Faltan recibir</th></tr></thead><tbody>
      ${cods.map((c) => { const k = hcat(c) || {}, rq = I.req[c] || 0, rc = I.rec[c] || 0, hh = I.hecho[c] || 0; return `<tr><td>${chipH(c)}</td><td>${esc(k.tipo || '')}</td><td>${esc(k.perfil || '')} · ${fmt(k.largo)} mm</td><td class="n">${fmt(rq)}</td><td class="n">${fmt(rc)}</td><td class="n ${I.recDud[c] ? 'neg' : ''}">${I.recDud[c] ? fmt(I.recDud[c]) : ''}</td><td class="n">${fmt(hh)}</td><td class="n">${fmt(rc - hh)}</td><td class="n ${rq - rc > 0 ? 'neg' : ''}">${rq - rc > 0 ? fmt(rq - rc) : '✓'}</td></tr>`; }).join('')}</tbody></table></div>`
      : '<p class="muted">Se calcula cuando esté cargada la distribución de hincas por configuración.</p>'}</div>`;
  $$('[data-go]', el).forEach((b) => { b.onclick = (e) => { e.preventDefault(); go(b.dataset.go); }; });
}
function vHTrk(el) {
  const I = hincInfo(); if (!I) { el.innerHTML = '<div class="card empty"><b>Sin plano cargado</b></div>'; return; }
  const H = S.hincado;
  ui.hf = ui.hf || { s: 'all', c: 'all', e: 'all', q: '' };
  const f = ui.hf;
  const n = ui.sel.size ? ` (${ui.sel.size})` : '', dis = ui.sel.size ? '' : ' dis';
  actions([['Exportar Excel', 'btn', exportHinc], ['PDF para campo', 'btn', printHinc], [`Desmarcar${n}`, 'btn' + dis, () => marcarHincado([...ui.sel], false)], [`Marcar hincados${n}`, 'btn acc' + dis, () => marcarHincado([...ui.sel], true)]]);
  let list = I.trk.slice();
  if (f.s !== 'all') list = list.filter((t) => t.s === f.s);
  if (f.c !== 'all') list = list.filter((t) => cfgDe(t) === f.c);
  if (f.e === 'h' || f.e === 'p') list = list.filter((t) => (f.e === 'h' ? !!H.avance[t.id] : !H.avance[t.id]));
  if (f.q) { const q = f.q.toUpperCase().replace(/^F(RAME)?\s*/, ''); list = list.filter((t) => t.id.includes(q) || ((repDe(t.id) || {}).fr || '') === q); }
  if (f.e === 'r') list = list.filter((t) => { const r = repDe(t.id) || {}; return r.mix || r.dif; });
  const secs = Object.keys(I.porSec).sort();
  el.innerHTML = `${hincPrecargaHTML(I)}<div class="tools"><div class="seg" id="hS"><button data-v="all">Todos los sectores</button>${secs.map((s) => `<button data-v="${s}">S${s}</button>`).join('')}</div>
      <select id="hC" class="sel"><option value="all">Todas las configuraciones</option>${HCFGS.filter((k) => I.cfgN[k]).map((k) => `<option value="${k}" ${f.c === k ? 'selected' : ''}>${cfgTxt(k)} (${I.cfgN[k]})</option>`).join('')}</select>
      <div class="seg" id="hE"><button data-v="all">Todos</button><button data-v="p">Pendientes</button><button data-v="h">Hincados</button>${I.repObs && I.repObs.n ? `<button data-v="r">Replanteo a revisar (${I.repObs.n})</button>` : ''}</div>
      <span class="sp"></span><span class="muted">${list.length} trackers</span><input type="search" id="hQ" placeholder="TRK-123 o frame…" value="${esc(f.q)}" style="width:170px"></div>
    <div class="tblwrap" style="max-height:calc(100vh - 250px)"><table class="tbl htbl"><thead><tr><th><input type="checkbox" id="selAll"></th><th>Tracker</th><th title="N° de frame en la lista de replanteo OBEII-CI-LI-211 r3">Frame</th><th>Sector</th><th>Configuración</th><th class="n">Hincas</th><th>Hincas en orden (norte → sur)</th><th>Hincado</th></tr></thead><tbody>
    ${list.map((t) => { const ps = posDe(t), av = H.avance[t.id], k = cfgDe(t);
      const r = repDe(t.id) || {}, rTit = r.mix ? `En la lista de replanteo las hincas de este tracker figuran repartidas entre los frames ${r.mix.join(', ')}: la numeración de frames de la lista está corrida en este sector` : r.dif ? `El replanteo tiene ${r.n} hincas en la posición de este tracker y el layout espera ${r.dif}` : '';
      return `<tr data-id="${t.id}" class="${ui.sel.has(t.id) ? 'sel' : ''}"><td><input type="checkbox" class="sel" ${ui.sel.has(t.id) ? 'checked' : ''}></td><td><b>${t.id}</b>${t.rev ? ' <span class="pill p-warn" title="La discretización no coincide con el layout en este tracker: verificar">verificar</span>' : ''}</td><td>${r.fr ? esc(r.fr) : '–'}${rTit ? ` <span class="pill p-warn" title="${esc(rTit)}">revisar</span>` : ''}</td><td>${t.s}</td>
        <td><i class="cdot" style="background:${CFGCOL[k.split('|').slice(0, 2).join('|')]}"></i>${cfgTxt(k)}</td>
        <td class="n">${r.n != null ? r.n : ''}</td><td class="hseq">${ps.some(Boolean) ? ps.map((c, i) => `<span class="hp" title="Posición ${i + 1}: ${esc(c || 'sin definir')}${c && hcat(c) ? ' · ' + hcat(c).color : ''}"><i class="hc" style="--hc:${HCOL[(hcat(c) || {}).color] || '#ddd'}" data-c="${esc((hcat(c) || {}).color || '')}"></i></span>`).join('') : '<span class="muted">distribución a cargar</span>'}</td>
        <td>${av ? `<span class="pill p-done">✓ ${fechaCorta(av.f)}</span>` : '<span class="muted">pendiente</span>'}</td></tr>`; }).join('')}
    </tbody></table></div>
    <p class="hint">Tildá los trackers terminados y tocá <b>Marcar hincados</b> (pide la fecha). El orden de las hincas sigue la matriz de su configuración (posición 1 al norte). <b>PDF para campo</b> saca la lista del sector filtrado con los colores, para distribuir las hincas.</p>`;
  $$('[data-go]', el).forEach((b) => { b.onclick = (e) => { e.preventDefault(); go(b.dataset.go); }; });
  segBind('#hS', f.s, (v) => { f.s = v; render(false); });
  segBind('#hE', f.e, (v) => { f.e = v; render(false); });
  $('#hC', el).onchange = (e) => { f.c = e.target.value; render(false); };
  const q = $('#hQ', el); q.oninput = () => { f.q = q.value.trim(); clearTimeout(q._t); q._t = setTimeout(() => render(false), 300); };
  bindSel(el, list);
  $$('tbody tr', el).forEach((tr) => { tr.ondblclick = () => { ui.pl = ui.pl || { capas: new Set(PL_CAPAS.map((c) => c[0])), color: 'disc', zcol: 'estado', vb: null, sel: null }; ui.pl.color = 'disc'; ui.pl.sel = 't|' + tr.dataset.id; const t = I.trk.find((x) => x.id === tr.dataset.id); ui.pl.vb = [t.x - 60, t.y - 45, 120, 90]; go('plano'); }; });
}
async function marcarHincado(ids, si) {
  if (window.READONLY || !ids.length) return;
  const H = S.hincado;
  if (!si) { if (!(await confirmar('Desmarcar hincado', `Se quita el registro de hincado de ${ids.length} tracker${ids.length > 1 ? 's' : ''}.`))) return; ids.forEach((id) => delete H.avance[id]); ui.sel.clear(); commit(`${ids.length} tracker${ids.length > 1 ? 's' : ''} sin registro de hincado`); return; }
  const r = await modal({ title: `Hincado completo · ${ids.length} tracker${ids.length > 1 ? 's' : ''}`, sub: ids.slice(0, 12).join(', ') + (ids.length > 12 ? '…' : ''),
    body: `<div class="form"><label>Fecha<input type="date" id="hF" value="${today()}"></label><label>Observación (opcional)<input type="text" id="hO" placeholder="Ej.: rechazo en hinca 4, se usó MRL"></label></div>`,
    buttons: [['Cancelar', 'btn', () => null], ['Registrar', 'btn pri', (b) => ({ f: $('#hF', b).value || today(), o: $('#hO', b).value.trim() })]] });
  if (!r) return;
  ids.forEach((id) => { H.avance[id] = Object.assign({ f: r.f }, r.o ? { o: r.o } : {}); });
  ui.flash = ids.slice(); ui.sel.clear();
  commit(`${ids.length} tracker${ids.length > 1 ? 's' : ''} hincado${ids.length > 1 ? 's' : ''} · ${fechaCorta(r.f)}`);
}
function vHRec(el) {
  const H = S.hincado;
  actions([['Exportar Excel', 'btn', exportHinc], ['+ Recepción', 'btn pri', () => editRecep(null)]]);
  const rs = H.recep.slice().sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)) || (b._o || 0) - (a._o || 0));
  const malos = rs.filter((r) => !verificar(r).ok);
  el.innerHTML = `${hincPrecargaHTML(hincInfo())}${malos.length ? `<div class="alert error" style="margin-bottom:14px"><b>${malos.length} recepción${malos.length > 1 ? 'es' : ''} no coincide${malos.length > 1 ? 'n' : ''} con el manual de Trina.</b>&nbsp;Revisá el color, el largo y el perfil antes de distribuir esas hincas.</div>` : ''}
    <div class="tblwrap"><table class="tbl"><thead><tr><th>Fecha</th><th>Remito</th><th>Código (etiqueta)</th><th>Color en punta</th><th class="n">Largo medido</th><th>Perfil</th><th class="n">Cantidad</th><th>Verificación</th><th></th></tr></thead><tbody>
    ${rs.map((r) => { const v = verificar(r), k = hcat(r.codigo) || {};
      return `<tr data-id="${r.id}"><td>${fechaCorta(r.fecha)}</td><td>${esc(r.remito || '')}</td><td>${chipH(r.codigo)}</td><td>${r.color ? colorChip(r.color) : '<span class="muted">–</span>'}${r.color && r.color !== k.color ? ` <small class="muted">(manual: ${esc(k.color || '?')})</small>` : ''}</td>
        <td class="n">${r.largo ? fmt(r.largo) + ' mm' : '–'}</td><td>${esc(r.perfil || '–')}</td><td class="n">${fmt(r.cant)}</td>
        <td>${v.ok ? '<span class="pill p-done">✓ coincide</span>' : `<span class="pill p-bad">no coincide</span><div class="hmsg">${v.msgs.join('<br>')}${v.sug.length ? `<br>Coincide con: ${v.sug.map((c) => chipH(c, true)).join(' ')}` : ''}</div>`}</td>
        <td style="white-space:nowrap">${window.READONLY ? '' : '<button class="btn sm ghost" data-a="e">✎</button>'}</td></tr>`; }).join('') || '<tr><td colspan="9" class="muted" style="padding:20px">Todavía no se registraron recepciones de hincas.</td></tr>'}
    </tbody></table></div>
    <div class="card" style="margin-top:16px"><h3>Cómo verificar una entrega</h3><ol class="hlist"><li>Leé el código de la etiqueta del paquete (por ejemplo 26050-PW610-1A).</li><li>Mirá el color pintado en la punta de las hincas y, en una muestra, medí el largo total y el perfil.</li><li>Cargalo con <b>+ Recepción</b>: el programa lo compara con el manual de Trina (CIV-DW-26050-2402) y avisa si no coincide y con qué código sí coincide.</li></ol>
      <p class="hint">Ojo: en el manual hay colores repetidos entre códigos (por ejemplo Gris en MS5-PW609-1B, PW610-1B y PW609-1B). En esos casos el largo y el perfil son los que confirman el código.</p></div>`;
  $$('[data-a=e]', el).forEach((b) => { b.onclick = () => editRecep(b.closest('tr').dataset.id); });
  $$('[data-go]', el).forEach((b) => { b.onclick = (e) => { e.preventDefault(); go(b.dataset.go); }; });
}
async function editRecep(id) {
  if (window.READONLY) return;
  const H = S.hincado, r0 = id ? H.recep.find((x) => x.id === id) : null;
  const cols = Object.keys(HCOL);
  const box0 = { codigo: r0 ? r0.codigo : '', color: r0 ? r0.color : '' };
  const res = await modal({ title: r0 ? 'Editar recepción de hincas' : 'Recepción de hincas', wide: true,
    body: `<div class="form"><label>Fecha<input type="date" id="rF" value="${r0 ? r0.fecha : today()}"></label><label>Remito<input type="text" id="rR" value="${esc(r0 ? r0.remito || '' : '')}"></label>
      <label class="full">Código de la etiqueta<select id="rC"><option value="">Elegí el código…</option>${['N', 'B'].map((sl) => `<optgroup label="${sl === 'N' ? 'Suelo normal (…A)' : 'Suelo blando (…B)'}">${H.catalogo.filter((k) => k.suelo === sl).map((k) => `<option value="${esc(k.codigo)}" ${box0.codigo === k.codigo ? 'selected' : ''}>${esc(k.codigo)} · ${k.tipo === 'Drive' ? 'Drive' : 'Estándar'} · ${k.perfil} · ${fmt(k.largo)} mm</option>`).join('')}</optgroup>`).join('')}</select></label>
      <div class="full"><div class="lbl">Color pintado en la punta (lo que se ve)</div><div class="hcolsel" id="rCol">${cols.map((c) => `<button type="button" data-col="${c}" class="${box0.color === c ? 'on' : ''}"><i class="hc" style="--hc:${HCOL[c]}" data-c="${c}"></i>${c}</button>`).join('')}</div></div>
      <label>Largo total medido (mm, opcional)<input type="number" id="rL" step="1" min="0" value="${r0 && r0.largo ? r0.largo : ''}"></label><label>Perfil medido (opcional, ej. 151x100)<input type="text" id="rP" value="${esc(r0 ? r0.perfil || '' : '')}"></label>
      <label>Cantidad de hincas<input type="number" id="rN" step="1" min="0" value="${r0 ? r0.cant : ''}"></label><label>Observación<input type="text" id="rO" value="${esc(r0 ? r0.obs || '' : '')}"></label></div>
      <div id="rVer" class="hver"></div>`,
    buttons: (r0 ? [['Eliminar', 'btn danger', () => 'del']] : []).concat([['Cancelar', 'btn', () => null], ['Guardar', 'btn pri', (b) => {
      const o = { fecha: $('#rF', b).value || today(), remito: $('#rR', b).value.trim(), codigo: $('#rC', b).value, color: ($('#rCol .on', b) || {}).dataset ? $('#rCol .on', b).dataset.col : '', largo: Number($('#rL', b).value) || null, perfil: $('#rP', b).value.trim(), cant: Number($('#rN', b).value) || 0, obs: $('#rO', b).value.trim() };
      if (!o.codigo) { $('#rC', b).focus(); return false; } if (!o.cant) { $('#rN', b).focus(); return false; }
      return o;
    }]]) });
  if (res === 'del') { if (await confirmar('Eliminar recepción', 'Se borra este registro de recepción.')) { H.recep = H.recep.filter((x) => x.id !== id); commit('Recepción de hincas eliminada'); } return; }
  if (!res) return;
  const v = verificar(res);
  if (r0) Object.assign(r0, res); else H.recep.push(Object.assign({ id: uid('hr'), _o: Date.now() }, res));
  commit(`Recepción ${res.codigo.replace(/^26050-/, '')} × ${res.cant}${v.ok ? ' · coincide con el manual' : ' · NO coincide con el manual'}`);
  if (!v.ok) toast('⚠ La recepción no coincide con el manual de Trina: ' + v.msgs.join(' · '), { err: true, ms: 10000 });
}
// verificación en vivo dentro del formulario de recepción
document.addEventListener('click', (e) => { const b = e.target.closest('#rCol button'); if (!b) return; $$('#rCol button').forEach((x) => x.classList.toggle('on', x === b)); verRecepVivo(); });
document.addEventListener('input', (e) => { if (e.target.closest('#rL, #rP, #rC')) verRecepVivo(); });
document.addEventListener('change', (e) => { if (e.target.id === 'rC') verRecepVivo(); });
function verRecepVivo() {
  const box = $('#rVer'); if (!box) return;
  const r = { codigo: $('#rC').value, color: ($('#rCol .on') || { dataset: {} }).dataset.col || '', largo: Number($('#rL').value) || null, perfil: $('#rP').value.trim() };
  if (!r.codigo) { box.innerHTML = ''; return; }
  const k = hcat(r.codigo), v = verificar(r);
  box.innerHTML = `<div class="hverk">Según el manual: ${chipH(r.codigo)} · ${esc(k.tipo)} · perfil ${k.perfil} · largo ${fmt(k.largo)} mm (sobre terreno ${fmt(k.sobre)} · NRL ${fmt(k.nrl)} · MRL ${fmt(k.mrl)}) · color ${colorChip(k.color)}</div>
    ${!r.color && !r.largo && !r.perfil ? '<div class="muted">Elegí el color que se ve en la punta para verificar.</div>' : v.ok ? '<div class="alert ok">✓ Coincide con el manual de Trina</div>' : `<div class="alert error"><div><b>No coincide con el manual.</b><br>${v.msgs.join('<br>')}${v.sug.length ? `<br>Lo recibido coincide con: ${v.sug.map((c) => chipH(c, true)).join(' ')}` : '<br>No hay ningún código del manual con esas características.'}</div></div>`}`;
}
function vHCat(el) {
  const H = S.hincado, I = hincInfo();
  actions([['Exportar Excel', 'btn', exportHinc]]);
  const opts = (sl, sel) => `<option value="">—</option>${H.catalogo.filter((k) => k.suelo === sl).map((k) => `<option value="${esc(k.codigo)}" ${sel === k.codigo ? 'selected' : ''}>${esc(k.codigo.replace(/^26050-/, ''))} · ${k.color}</option>`).join('')}`;
  el.innerHTML = `${hincPrecargaHTML(I)}<div class="card" style="margin-bottom:16px"><h3>Distribución de hincas por configuración</h3>
      <p class="hint" style="margin-top:0">Para cada configuración de la discretización de Trina, la cantidad de hincas del tracker y el código en cada posición (1 = extremo norte). Se completa con el documento de distribución de hincas de Trina. Los conteos, la lista por tracker y el plano salen de acá.</p>
      <div class="tblwrap"><table class="tbl hmat"><thead><tr><th>Configuración</th><th class="n">Trackers</th><th class="n">Hincas</th><th>Código por posición (norte → sur)</th><th></th></tr></thead><tbody>
      ${HCFGS.filter((k) => I && I.cfgN[k]).map((k) => { const m = H.matriz[k], sl = k.split('|')[2];
        return `<tr data-k="${k}"><td><i class="cdot" style="background:${CFGCOL[k.split('|').slice(0, 2).join('|')]}"></i><b>${cfgTxt(k)}</b>${matrizOk(k) ? '' : ' <span class="pill p-warn">incompleta</span>'}</td><td class="n">${I.cfgN[k]}</td>
          <td class="n"><input type="number" class="mN" min="0" max="30" value="${m.n}" ${window.READONLY ? 'disabled' : ''}></td>
          <td><div class="mpos">${Array.from({ length: m.n }, (_, i) => { const c = (m.pos || [])[i] || ''; return `<label class="mp"><span>${i + 1}</span><i class="hc" style="--hc:${HCOL[(hcat(c) || {}).color] || '#eee'}" data-c="${esc((hcat(c) || {}).color || '')}"></i><select data-i="${i}" ${window.READONLY ? 'disabled' : ''}>${opts(sl, c)}</select></label>`; }).join('')}</div></td>
          <td style="white-space:nowrap">${window.READONLY ? '' : `<button class="btn sm ghost" data-a="all" title="Poner el mismo código en todas las posiciones vacías">Rellenar</button> <button class="btn sm ghost" data-a="copy" title="Copiar desde otra configuración">Copiar…</button>`}</td></tr>`; }).join('')}
      </tbody></table></div></div>
    <div class="card"><h3>Catálogo de hincas · Trina CIV-DW-26050-2402-0B</h3><div class="tblwrap"><table class="tbl"><thead><tr><th>Código</th><th>Tipo</th><th>Suelo</th><th>Perfil</th><th class="n">Largo total</th><th class="n">Sobre terreno</th><th class="n">NRL</th><th class="n">MRL</th><th>Color de punta</th><th class="n">Requeridas</th></tr></thead><tbody>
      ${H.catalogo.map((k) => `<tr data-c="${esc(k.codigo)}"><td><b>${esc(k.codigo)}</b></td><td>${esc(k.tipo)}</td><td>${k.suelo === 'B' ? 'Blando' : 'Normal'}</td><td>${esc(k.perfil)}</td><td class="n">${fmt(k.largo)}</td><td class="n">${fmt(k.sobre)}</td><td class="n">${fmt(k.nrl)}</td><td class="n">${fmt(k.mrl)}</td>
        <td>${window.READONLY ? colorChip(k.color) : `<select class="kc">${Object.keys(HCOL).map((c) => `<option ${c === k.color ? 'selected' : ''}>${c}</option>`).join('')}</select>`}</td><td class="n">${I && I.req[k.codigo] ? fmt(I.req[k.codigo]) : ''}</td></tr>`).join('')}
      </tbody></table></div>
      <p class="hint">Medidas en mm. NRL: largo nominal de hincado · MRL: mínimo. Regulación en obra ±200 mm según Trina. Colores leídos del plano de Trina; si el fabricante cambia un color, corregilo acá y la verificación de recepciones se actualiza.</p></div>`;
  $$('tr[data-k]', el).forEach((tr) => {
    const k = tr.dataset.k, m = H.matriz[k];
    const n = $('.mN', tr); if (n) n.onchange = () => { m.n = Math.max(0, Math.min(30, Number(n.value) || 0)); m.pos = (m.pos || []).slice(0, m.n); commit(`${cfgTxt(k)}: ${m.n} hincas por tracker`); };
    $$('select[data-i]', tr).forEach((s) => { s.onchange = () => { m.pos = m.pos || []; m.pos[Number(s.dataset.i)] = s.value; m.conf = matrizOk(k); commit(`${cfgTxt(k)} · posición ${Number(s.dataset.i) + 1}: ${s.value.replace(/^26050-/, '') || 'sin definir'}`); }; });
    const ba = $('[data-a=all]', tr); if (ba) ba.onclick = async () => {
      const sl = k.split('|')[2];
      const r = await modal({ title: `Rellenar · ${cfgTxt(k)}`, body: `<div class="form"><label class="full">Código para las posiciones vacías<select id="fa">${opts(sl, '')}</select></label></div>`, buttons: [['Cancelar', 'btn', () => null], ['Rellenar', 'btn pri', (b) => $('#fa', b).value || false]] });
      if (!r) return; m.pos = Array.from({ length: m.n }, (_, i) => (m.pos || [])[i] || r); commit(`${cfgTxt(k)}: posiciones vacías con ${r.replace(/^26050-/, '')}`);
    };
    const bc = $('[data-a=copy]', tr); if (bc) bc.onclick = async () => {
      const r = await modal({ title: `Copiar a ${cfgTxt(k)}`, body: `<div class="form"><label class="full">Desde<select id="fc">${HCFGS.filter((x) => x !== k).map((x) => `<option value="${x}">${cfgTxt(x)}</option>`).join('')}</select></label></div><p class="hint">Si los suelos son distintos, se cambia el sufijo del código (…A ↔ …B) cuando existe en el catálogo.</p>`, buttons: [['Cancelar', 'btn', () => null], ['Copiar', 'btn pri', (b) => $('#fc', b).value]] });
      if (!r) return; const src = H.matriz[r], sl = k.split('|')[2];
      m.n = src.n; m.pos = (src.pos || []).map((c) => { if (!c) return ''; const alt = c.replace(/-(\d)[AB]$/, (x, d) => `-${d}${sl === 'B' ? 'B' : 'A'}`); return hcat(alt) ? alt : c; });
      commit(`${cfgTxt(k)}: copiada de ${cfgTxt(r)}`);
    };
  });
  $$('tr[data-c] .kc', el).forEach((s) => { s.onchange = () => { const k = hcat(s.closest('tr').dataset.c); k.color = s.value; commit(`Color de ${k.codigo.replace(/^26050-/, '')}: ${s.value}`); }; });
}
async function exportHinc() {
  const I = hincInfo(); if (!I) return;
  const p = await window.api.saveBinary(IO.exportHincado(S, I, { posDe, cfgDe, cfgTxt, hcat, verificar }), `Hincado ${today()}.xlsx`, 'xlsx', 'Excel');
  if (p) toast('Excel exportado', { action: ['Abrir', () => window.api.openPath(p)] });
}
function printHinc() {
  const I = hincInfo(); if (!I) return;
  const f = ui.hf || { s: 'all', c: 'all' };
  let list = I.trk.slice(); if (f.s !== 'all') list = list.filter((t) => t.s === f.s); if (f.c !== 'all') list = list.filter((t) => cfgDe(t) === f.c);
  list.sort((a, b) => a.s.localeCompare(b.s) || a.id.localeCompare(b.id));
  const cods = {}; list.forEach((t) => posDe(t).forEach((c) => { if (c) cods[c] = (cods[c] || 0) + 1; }));
  const ley = Object.keys(cods).sort().map((c) => `<span style="margin-right:12px;white-space:nowrap">${chipH(c)} × ${cods[c]}</span>`).join('');
  const rows = list.map((t) => `<tr><td><b>${t.id}</b>${(repDe(t.id) || {}).fr ? `<br><small>frame ${repDe(t.id).fr}</small>` : ''}</td><td>${t.s}</td><td>${cfgTxt(cfgDe(t))}</td><td>${posDe(t).map((c, i) => `<span class="hpp"><small>${i + 1}</small><i class="hc" style="--hc:${HCOL[(hcat(c) || {}).color] || '#ddd'}" data-c="${esc((hcat(c) || {}).color || '')}"></i><small>${esc(String(c).replace(/^26050-/, ''))}</small></span>`).join('')}</td><td>${S.hincado.avance[t.id] ? '✓' : ''}</td></tr>`).join('');
  printHTML(prHead(`Distribución de hincas${f.s !== 'all' ? ' · Sector ' + f.s : ''}`) + `<div class="card prday"><div style="margin-bottom:8px">${ley}</div><table class="tbl dtbl hprint"><thead><tr><th>Tracker</th><th>Sector</th><th>Configuración</th><th>Hincas (posición 1 = norte)</th><th>Hincado</th></tr></thead><tbody>${rows}</tbody></table></div>`, `Distribucion de hincas ${f.s !== 'all' ? 'S' + f.s + ' ' : ''}${today()}.pdf`, true);
}
function hincModHTML() {
  const I = hincInfo(); if (!I) return '';
  const p = I.trk.length ? I.nH / I.trk.length : 0;
  return `<div class="card mcard" data-go="hincado" title="Ver hincado"><div class="mh"><div>${Charts.ring(p, '#7c5cbf', 'trackers')}</div><div><h3>Hincado${I.completa ? '' : ' <span class="pill p-warn" style="font-size:10.5px">precarga</span>'}</h3><div class="muted">${fmt(I.nH)} de ${fmt(I.trk.length)} trackers${I.completa ? ` · ${fmt(I.nPilH)} de ${fmt(I.nPil)} hincas` : ''}</div></div></div>
    ${Object.keys(I.porSec).sort().map((s) => { const x = I.porSec[s]; return `<div class="mrow"><span>Sector ${s}</span><div class="sbt"><div style="width:${(x.n ? (x.h / x.n) * 100 : 0).toFixed(1)}%;background:${SECT_COL[s]}"></div></div><b>${x.h}/${x.n}</b></div>`; }).join('')}
    ${Object.values(I.recDud).reduce((a, b) => a + b, 0) ? `<div class="muted" style="margin-top:6px"><b class="tneg">⚠ hay recepciones que no coinciden con el manual</b></div>` : ''}</div>`;
}
