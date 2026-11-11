/* PSFV-OBE II · Edificio de operación y mantenimiento (sala de celdas de MT, comunicaciones y control).
   Plano de referencia: OBEII-CI-PL-371 r2 "Estructura sala eléctrica": 12 columnas con zapata (C1…C12) en 3 tipos y
   8 vigas de fundación (encadenado inferior). Las etapas de bases van por zapata, las del encadenado inferior por viga
   y el resto por avance general (%). Cada etapa pesa lo mismo en el avance del edificio. */
const SALA_ET = [
  { k: 'exc', n: 'Excavación para zapatas', g: 'Bases', a: 'zap' },
  { k: 'encL', n: 'Encofrado para hormigón de limpieza', g: 'Bases', a: 'zap' },
  { k: 'hL', n: 'Carga de hormigón de limpieza', g: 'Bases', a: 'zap' },
  { k: 'armZ', n: 'Armado de estructura de bases/zapatas', g: 'Bases', a: 'zap' },
  { k: 'encZ', n: 'Encofrado de bases/zapatas', g: 'Bases', a: 'zap' },
  { k: 'hZ', n: 'Carga de hormigón de bases/zapatas', g: 'Bases', a: 'zap' },
  { k: 'armEI', n: 'Armado de estructura de encadenado inferior', g: 'Encadenado inferior', a: 'viga' },
  { k: 'encEI', n: 'Encofrado de encadenado inferior', g: 'Encadenado inferior', a: 'viga' },
  { k: 'hEI', n: 'Carga de hormigón de encadenado inferior', g: 'Encadenado inferior', a: 'viga' },
  { k: 'trin', n: 'Ejecución de trincheras y contrapiso', g: 'Piso y muros', a: 'gral' },
  { k: 'piso', n: 'Ejecución de piso técnico y mampostería', g: 'Piso y muros', a: 'gral' },
  { k: 'revG', n: 'Revoque grueso interno y externo', g: 'Revoques', a: 'gral' },
  { k: 'revF', n: 'Revoque fino interno y externo', g: 'Revoques', a: 'gral' },
  { k: 'armCS', n: 'Armado de estructura de columnas y encadenado superior', g: 'Estructura superior', a: 'gral' },
  { k: 'hCS', n: 'Carga de columnas y encadenado superior', g: 'Estructura superior', a: 'gral' },
  { k: 'estT', n: 'Ejecución de estructura del techo', g: 'Techo', a: 'gral' },
  { k: 'techo', n: 'Techado', g: 'Techo', a: 'gral' },
  { k: 'aber', n: 'Colocación de aberturas', g: 'Terminaciones e instalaciones', a: 'gral' },
  { k: 'elec', n: 'Instalación eléctrica', g: 'Terminaciones e instalaciones', a: 'gral' },
  { k: 'sanit', n: 'Instalación sanitaria', g: 'Terminaciones e instalaciones', a: 'gral' },
];
const SALA_ETN = Object.fromEntries(SALA_ET.map((e) => [e.k, e]));
// Geometría del plano (m, origen en C1). Zapatas: Z1 105 cm, Z2 115 cm, Z3 125 cm (lado).
const SALA_ZAP = [
  ['C1', 0, 0, 'Z1'], ['C2', 0, 3.89, 'Z2'], ['C3', 0, 7.8, 'Z1'], ['C4', 5.88, 7.8, 'Z2'], ['C5', 10.88, 7.8, 'Z1'], ['C6', 12.78, 7.8, 'Z1'],
  ['C7', 5.88, 0, 'Z2'], ['C8', 10.88, 0, 'Z1'], ['C9', 12.78, 0, 'Z1'], ['C10', 5.88, 3.89, 'Z3'], ['C11', 10.88, 2.98, 'Z2'], ['C12', 12.78, 2.98, 'Z1'],
].map(([id, x, y, t]) => ({ id, x, y, t }));
const SALA_ZT = { Z1: 1.05, Z2: 1.15, Z3: 1.25 };
const SALA_VIG = [
  ['V1', ['C1', 'C2', 'C3']], ['V2', ['C7', 'C10', 'C4']], ['V3', ['C8', 'C11', 'C5']], ['V4', ['C9', 'C12', 'C6']],
  ['V5', ['C1', 'C7', 'C8', 'C9']], ['V6', ['C3', 'C4', 'C5', 'C6']], ['V7', ['C2', 'C10']], ['V8', ['C11', 'C12']],
].map(([id, cs]) => ({ id, cs }));
const SALA_AMB = { zap: 'por zapata', viga: 'por viga', gral: 'general' };
const SALA_COL = { ok: '#2f9e5b', cur: '#f5a524', pend: '#dfe5ec' };

const salaS = () => { S.sala = S.sala || {}; S.sala.cfg = S.sala.cfg || {}; S.sala.av = S.sala.av || {}; return S.sala; };
const salaEls = (e) => (e.a === 'zap' ? SALA_ZAP.map((z) => z.id) : e.a === 'viga' ? SALA_VIG.map((v) => v.id) : ['G']);
const salaAv = (k, el) => (salaS().av[k + '|' + el]) || {};
function salaEtInfo(e) {
  const els = salaEls(e);
  if (e.a === 'gral') {
    const v = salaAv(e.k, 'G'), p = v.ok ? 1 : v.ini ? Math.max(0, Math.min(99, Number(v.pct) || 0)) / 100 : 0;
    return { e, n: 1, ok: v.ok ? 1 : 0, cur: !v.ok && v.ini ? 1 : 0, p, v, ini: v.ini || '', fin: v.ok ? v.fin || '' : '' };
  }
  const vs = els.map((x) => salaAv(e.k, x)), ok = vs.filter((v) => v.ok).length, cur = vs.filter((v) => v.ini && !v.ok).length;
  const inis = vs.map((v) => v.ini).filter(Boolean).sort(), fins = vs.map((v) => v.ok && v.fin).filter(Boolean).sort();
  return { e, n: els.length, ok, cur, p: ok / els.length, ini: inis[0] || '', fin: ok === els.length ? fins[fins.length - 1] || '' : '' };
}
function salaInfo() {
  const ets = SALA_ET.map(salaEtInfo);
  const p = ets.reduce((a, x) => a + x.p, 0) / ets.length;
  const curso = ets.filter((x) => (x.cur || (x.ok && x.ok < x.n)) && x.p < 1);
  const sig = ets.find((x) => x.p < 1);
  const done = ets.filter((x) => x.p >= 1).length;
  const inis = ets.map((x) => x.ini).filter(Boolean).sort();
  // por zapata: última etapa de bases terminada
  const zEts = SALA_ET.filter((e) => e.a === 'zap');
  const zap = SALA_ZAP.map((z) => { let n = 0; zEts.forEach((e, i) => { if (salaAv(e.k, z.id).ok && n === i) n = i + 1; }); const cur = zEts.find((e) => { const v = salaAv(e.k, z.id); return v.ini && !v.ok; }); return Object.assign({}, z, { n, cur }); });
  const vEts = SALA_ET.filter((e) => e.a === 'viga');
  const vig = SALA_VIG.map((g) => { let n = 0; vEts.forEach((e, i) => { if (salaAv(e.k, g.id).ok && n === i) n = i + 1; }); const cur = vEts.find((e) => { const v = salaAv(e.k, g.id); return v.ini && !v.ok; }); return Object.assign({}, g, { n, cur }); });
  return { ets, p, curso, sig, done, ini: inis[0] || '', zap, vig, nZH: zap.filter((z) => z.n === zEts.length).length };
}
// ---- planta esquemática: zapatas coloreadas por avance y vigas de fundación ----
function salaPlantaSVG(I, opts = {}) {
  I = I || salaInfo();
  const pad = 1.4, W = 12.78 + pad * 2, H = 7.8 + pad * 2, sc = opts.w ? opts.w / W : 46, X = (x) => (x + pad) * sc, Y = (y) => (7.8 - y + pad) * sc;
  const zN = SALA_ET.filter((e) => e.a === 'zap').length, vN = SALA_ET.filter((e) => e.a === 'viga').length;
  const colZ = (z) => (z.n >= zN ? SALA_COL.ok : z.n || z.cur ? `rgba(245,165,36,${0.35 + 0.65 * (z.n / zN)})` : '#e9eef4');
  const pos = Object.fromEntries(SALA_ZAP.map((z) => [z.id, z]));
  let s = `<svg class="salasvg" viewBox="0 0 ${(W * sc).toFixed(0)} ${(H * sc).toFixed(0)}" role="img" aria-label="Planta de fundaciones del edificio">`;
  s += `<rect x="${X(-0.3)}" y="${Y(8.1)}" width="${13.38 * sc}" height="${8.4 * sc}" class="salamuro" rx="3"/>`;
  I.vig.forEach((g) => {
    const pts = g.cs.map((c) => `${X(pos[c].x).toFixed(1)},${Y(pos[c].y).toFixed(1)}`).join(' ');
    const col = g.n >= vN ? SALA_COL.ok : g.n || g.cur ? SALA_COL.cur : '#c9d3df';
    s += `<polyline points="${pts}" class="salaviga${opts.ro ? '' : ' clk'}" data-sv="${g.id}" style="stroke:${col}"><title>${g.id} (${g.cs.join('–')}) · ${g.n}/${vN} etapas${g.cur ? ' · en curso: ' + esc(g.cur.n) : ''}</title></polyline>`;
    const m = pos[g.cs[Math.floor((g.cs.length - 1) / 2)]], m2 = pos[g.cs[Math.floor((g.cs.length - 1) / 2) + 1]];
    s += `<text x="${((X(m.x) + X(m2.x)) / 2).toFixed(1)}" y="${((Y(m.y) + Y(m2.y)) / 2 - 5).toFixed(1)}" class="salavt">${g.id}</text>`;
  });
  I.zap.forEach((z) => {
    const L = SALA_ZT[z.t] * sc;
    s += `<g class="salazap${opts.ro ? '' : ' clk'}" data-sz="${z.id}"><title>${z.id} · zapata ${z.t} (${fmt(SALA_ZT[z.t] * 100)} cm) · ${z.n}/${zN} etapas${z.cur ? ' · en curso: ' + esc(z.cur.n) : ''}</title>
      <rect x="${(X(z.x) - L / 2).toFixed(1)}" y="${(Y(z.y) - L / 2).toFixed(1)}" width="${L.toFixed(1)}" height="${L.toFixed(1)}" rx="3" style="fill:${colZ(z)}" class="${z.cur ? 'cur' : ''}"/>
      <rect x="${(X(z.x) - 0.09 * sc).toFixed(1)}" y="${(Y(z.y) - 0.09 * sc).toFixed(1)}" width="${(0.18 * sc).toFixed(1)}" height="${(0.18 * sc).toFixed(1)}" class="salacol"/>
      <text x="${X(z.x).toFixed(1)}" y="${(Y(z.y) + L / 2 + 13).toFixed(1)}" class="salazt">${z.id}</text>
      <text x="${X(z.x).toFixed(1)}" y="${(Y(z.y) - L / 2 - 4).toFixed(1)}" class="salazn">${z.n}/${zN}</text></g>`;
  });
  return s + '</svg>';
}
// ---- vista ----
const salaModo = () => { try { return localStorage.getItem('sala3d') || '3d'; } catch (_) { return '3d'; } };
function vSala(el) {
  const ro = window.READONLY, I = salaInfo();
  actions([['Exportar Excel', 'btn', exportSala], ['Exportar PDF', 'btn pri', printSala]]);
  const zEts = SALA_ET.filter((e) => e.a === 'zap'), vEts = SALA_ET.filter((e) => e.a === 'viga');
  const estP = (x) => (x.p >= 1 ? '<span class="pill p-done">terminada</span>' : x.ok || x.cur || x.p > 0 ? '<span class="pill p-warn">en curso</span>' : '<span class="pill p-prov">pendiente</span>');
  let h = `<div class="grid salatop" style="margin-bottom:14px">
    <div class="card tile"><div>${Charts.ring(I.p, '#7a5af8', 'edificio')}</div><div><h3 style="margin-bottom:6px">Edificio de O&amp;M</h3>
      <div class="kpis k1" style="gap:6px">${kpi('Etapas terminadas', I.done, `/ ${SALA_ET.length}`, 0)}${kpi('Zapatas hormigonadas', I.nZH, `/ ${SALA_ZAP.length}`, 0)}</div>
      <div class="muted" style="margin-top:8px;font-size:12.5px">${I.curso.length ? `<b>En curso:</b> ${I.curso.map((x) => esc(x.e.n)).join(', ')}` : I.sig ? `<b>Próxima:</b> ${esc(I.sig.e.n)}` : '<b>Edificio terminado</b>'}${I.ini ? `<br>Inicio de obra ${fechaCorta(I.ini)}` : ''}</div></div></div>
    <div class="card"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><h3 style="margin:0">Fundaciones</h3><span class="muted" style="font-size:12px">12 zapatas · 8 vigas · plano OBEII-CI-PL-371 r2</span><span style="flex:1"></span>
      <div class="seg s3seg"><button data-sm="3d" class="${salaModo() === '3d' ? 'on' : ''}">3D</button><button data-sm="pl" class="${salaModo() === 'pl' ? 'on' : ''}">Planta</button></div></div>
      ${salaModo() === '3d' ? sala3dHTML() : `<div class="salaplanta">${salaPlantaSVG(I, { ro })}</div>`}
      <div class="legend"><span><i style="background:#e9eef4"></i>Sin iniciar</span><span><i style="background:${SALA_COL.cur}"></i>Bases en ejecución (más intenso = más avanzada)</span><span><i style="background:${SALA_COL.ok}"></i>Zapata hormigonada / viga terminada</span>${salaModo() === '3d' ? '<span><i style="background:#2f6fb0"></i>Puertas</span><span><i style="background:#8fd0f5"></i>Ventanas</span><span class="muted">· en contorno lo que falta construir</span>' : ro ? '' : '<span class="muted">· tocá una zapata o una viga para cargar su avance</span>'}</div></div></div>`;
  // etapas
  let g0 = '';
  h += `<div class="card" style="margin-bottom:14px"><h3>Etapas del edificio</h3><div class="tblwrap" style="max-height:none"><table class="tbl salatbl"><thead><tr><th>#</th><th>Etapa</th><th>Avance</th><th>Estado</th><th>Inicio</th><th>Fin</th>${ro ? '' : '<th></th>'}</tr></thead><tbody>`;
  I.ets.forEach((x, i) => {
    if (x.e.g !== g0) { g0 = x.e.g; h += `<tr class="salag"><td colspan="${ro ? 6 : 7}">${esc(g0)}</td></tr>`; }
    const det = x.e.a === 'gral' ? (x.v.obs ? ` <span class="muted" title="${esc(x.v.obs)}">· ${esc(x.v.obs.length > 40 ? x.v.obs.slice(0, 39) + '…' : x.v.obs)}</span>` : '') : ` <span class="muted">${x.ok}/${x.n}${x.cur ? ` · ${x.cur} en curso` : ''}</span>`;
    h += `<tr><td class="muted">${i + 1}</td><td><b>${esc(x.e.n)}</b> <small class="muted">· ${SALA_AMB[x.e.a]}</small></td>
      <td><div class="salabar"><div style="width:${(x.p * 100).toFixed(1)}%;background:${x.p >= 1 ? SALA_COL.ok : SALA_COL.cur}"></div></div><small>${fmt(x.p * 100)} %</small>${det}</td>
      <td>${estP(x)}</td><td>${x.ini ? fechaCorta(x.ini) : '–'}</td><td>${x.fin ? fechaCorta(x.fin) : '–'}</td>
      ${ro ? '' : `<td style="white-space:nowrap">${x.e.a === 'gral' ? `<button class="btn sm ghost" data-sg="${x.e.k}">Cargar avance</button>` : `<button class="btn sm ghost" data-st="${x.e.k}">Marcar todas…</button>`}</td>`}</tr>`;
  });
  h += `</tbody></table></div><p class="hint">Cada etapa pesa lo mismo en el avance del edificio (${SALA_ET.length} etapas). Las de bases avanzan por zapata y las del encadenado inferior por viga; el resto se carga con un % de avance hasta darla por terminada.</p></div>`;
  // matrices por zapata y por viga
  const matriz = (ets, els, tit, lbl) => `<div class="card tblcard" style="margin-bottom:14px"><h3>${tit}</h3><div class="tblwrap"><table class="tbl ftbl salamx"><thead><tr><th>Etapa</th>${els.map((e) => `<th class="fc">${lbl(e)}</th>`).join('')}</tr></thead><tbody>
    ${ets.map((e) => `<tr><td><b>${esc(e.n)}</b></td>${els.map((x) => { const v = salaAv(e.k, x.id), est = v.ok ? 'ok' : v.ini ? 'cur' : '';
      const tit2 = `${x.id} · ${e.n}${v.ini ? ' · inicio ' + fechaCorta(v.ini) : ''}${v.ok && v.fin ? ' · fin ' + fechaCorta(v.fin) : ''}${v.obs ? ' · ' + v.obs : ''}`;
      return `<td class="fc"><button class="smx ${est}" ${ro ? 'disabled' : ''} data-sc="${e.k}|${x.id}" title="${esc(tit2)}${ro ? '' : est === 'ok' ? ' · tocá para corregir' : est === 'cur' ? ' · tocá para finalizar hoy' : ' · tocá para iniciar hoy'}">${v.ok ? `✓<small>${fechaCorta(v.fin || v.ini).slice(0, 5)}</small>` : v.ini ? `▶<small>${fechaCorta(v.ini).slice(0, 5)}</small>` : '·'}</button></td>`; }).join('')}</tr>`).join('')}</tbody></table></div></div>`;
  h += matriz(zEts, SALA_ZAP, 'Bases por zapata', (z) => `${z.id}<small>${z.t}</small>`);
  h += matriz(vEts, SALA_VIG, 'Encadenado inferior por viga de fundación', (g) => `${g.id}<small>${g.cs[0]}–${g.cs[g.cs.length - 1]}</small>`);
  if (!ro) h += `<p class="hint">En las tablas: un toque en <b>·</b> inicia la etapa con fecha de hoy, un toque en <b>▶</b> la finaliza hoy y un toque en <b>✓</b> abre la carga para corregir fechas, agregar una observación o quitar el registro. <b>Marcar todas…</b> carga la misma fecha a todas las zapatas o vigas juntas.</p>`;
  el.innerHTML = h; Charts.bindTips(el);
  $$('[data-sm]', el).forEach((b) => { b.onclick = () => { try { localStorage.setItem('sala3d', b.dataset.sm); } catch (_) { /* sin storage */ } vSala(el); }; });
  if (salaModo() === '3d') sala3dMontar(el, I);
  if (ro) return;
  $$('[data-sc]', el).forEach((b) => { b.onclick = () => { const [k, x] = b.dataset.sc.split('|'); salaToque(k, x); }; });
  $$('[data-sg]', el).forEach((b) => { b.onclick = () => salaEditGral(b.dataset.sg); });
  $$('[data-st]', el).forEach((b) => { b.onclick = () => salaTodas(b.dataset.st); });
  $$('[data-sz]', el).forEach((g) => { g.onclick = () => salaEditElem('zap', g.dataset.sz); });
  $$('[data-sv]', el).forEach((g) => { g.onclick = () => salaEditElem('viga', g.dataset.sv); });
}
// ---- carga ----
function salaSet(k, x, ch, msg) {
  const A = salaS().av, key = k + '|' + x, v = Object.assign({}, A[key]);
  ['ini', 'fin', 'obs', 'pct'].forEach((f) => { if (f in ch) { if (ch[f] || ch[f] === 0) v[f] = ch[f]; else delete v[f]; } });
  if ('ok' in ch) { if (ch.ok) { v.ok = true; v.fin = v.fin || today(); v.ini = v.ini || v.fin; } else { delete v.ok; delete v.fin; } }
  if (!v.ok && !v.ini && !v.obs) delete A[key]; else A[key] = v;
  if (msg !== false) commit(msg || `${x === 'G' ? '' : x + ' · '}${SALA_ETN[k].n}: ${v.ok ? 'terminada' : v.ini ? 'en curso' : 'sin registro'} · edificio ${fmt(salaInfo().p * 100)} %`);
}
function salaToque(k, x) {
  if (window.READONLY) return;
  const v = salaAv(k, x);
  if (v.ok) return salaEditCelda(k, x);
  if (v.ini) salaSet(k, x, { ok: true, fin: today() < v.ini ? v.ini : today() });
  else salaSet(k, x, { ini: today() });
}
const salaEstSel = (v) => `<select name="est"><option value="">Pendiente</option><option value="cur" ${v.ini && !v.ok ? 'selected' : ''}>En curso</option><option value="ok" ${v.ok ? 'selected' : ''}>Terminada</option></select>`;
async function salaEditCelda(k, x) {
  const v = salaAv(k, x), e = SALA_ETN[k];
  const res = await modal({ title: `${x} · ${esc(e.n)}`, sub: 'Edificio de O&M',
    body: `<div class="form"><label>Estado${salaEstSel(v)}</label><label>Inicio<input type="date" name="ini" value="${v.ini || today()}"></label><label>Fin<input type="date" name="fin" value="${v.fin || today()}"></label><label class="full">Observación<input name="obs" value="${esc(v.obs || '')}" placeholder="Opcional"></label></div>`,
    buttons: [['Cancelar', 'btn', () => null], ['Guardar', 'btn pri', (box) => salaLeer(box)]] });
  if (!res) return;
  salaAplicar(k, x, res);
}
function salaLeer(box) {
  const est = $('[name=est]', box).value, ini = $('[name=ini]', box).value, fin = $('[name=fin]', box).value, obs = ($('[name=obs]', box) || { value: '' }).value.trim();
  const pctI = $('[name=pct]', box), pct = pctI ? Math.max(0, Math.min(100, Number(pctI.value) || 0)) : null;
  if (est && !ini) { toast('Cargá la fecha de inicio', { err: true }); return false; }
  if (est === 'ok' && fin && fin < ini) { toast('La fecha de fin no puede ser anterior al inicio', { err: true }); return false; }
  return { est, ini, fin, obs, pct };
}
function salaAplicar(k, x, r, msg) {
  if (!r.est) { const o = salaS().av; delete o[k + '|' + x]; if (r.obs) o[k + '|' + x] = { obs: r.obs }; if (msg !== false) commit(msg || `${x === 'G' ? '' : x + ' · '}${SALA_ETN[k].n}: sin registro`); return; }
  salaSet(k, x, { ini: r.ini, obs: r.obs, ...(r.pct != null ? { pct: r.est === 'ok' ? 100 : r.pct } : {}), ...(r.est === 'ok' ? { ok: true, fin: r.fin || today() } : { ok: false }) }, msg);
}
async function salaEditGral(k) {
  const v = salaAv(k, 'G'), e = SALA_ETN[k];
  const res = await modal({ title: esc(e.n), sub: `Edificio de O&M · ${esc(e.g)}`,
    body: `<div class="form"><label>Estado${salaEstSel(v)}</label><label>Avance (%)<input type="number" name="pct" min="0" max="100" step="5" value="${v.ok ? 100 : Number(v.pct) || 0}"></label>
      <label>Inicio<input type="date" name="ini" value="${v.ini || today()}"></label><label>Fin<input type="date" name="fin" value="${v.fin || today()}"></label>
      <label class="full">Observación<input name="obs" value="${esc(v.obs || '')}" placeholder="Opcional: frente, sector, faltantes…"></label></div>
      <p class="hint" style="display:block">El % cuenta mientras la etapa está en curso; al marcarla <b>Terminada</b> pasa a 100 %.</p>`,
    buttons: [['Cancelar', 'btn', () => null], ['Guardar', 'btn pri', (box) => { const r = salaLeer(box); if (r && r.pct > 0 && !r.est) r.est = 'cur'; if (r && r.est === 'cur' && r.pct >= 100) r.est = 'ok'; return r; }]] });
  if (!res) return;
  salaAplicar(k, 'G', res);
}
async function salaTodas(k) {
  const e = SALA_ETN[k], els = e.a === 'zap' ? SALA_ZAP.map((z) => z.id) : SALA_VIG.map((g) => g.id);
  const res = await modal({ title: esc(e.n), sub: `Marcar ${e.a === 'zap' ? 'las 12 zapatas' : 'las 8 vigas'} juntas`,
    body: `<div class="form"><label>Estado${salaEstSel({})}</label><label>Inicio<input type="date" name="ini" value="${today()}"></label><label>Fin<input type="date" name="fin" value="${today()}"></label><label class="full">Observación<input name="obs" placeholder="Opcional"></label></div>
      <div class="salachk">${els.map((x) => `<label><input type="checkbox" value="${x}" ${salaAv(k, x).ok ? '' : 'checked'}> ${x}${salaAv(k, x).ok ? ' ✓' : salaAv(k, x).ini ? ' ▶' : ''}</label>`).join('')}</div>
      <p class="hint" style="display:block">Se aplica a las tildadas. Las que ya están terminadas vienen sin tildar.</p>`,
    buttons: [['Cancelar', 'btn', () => null], ['Aplicar', 'btn pri', (box) => { const r = salaLeer(box); if (!r) return false; if (!r.est) { toast('Elegí el estado', { err: true }); return false; } r.els = $$('.salachk input:checked', box).map((i) => i.value); if (!r.els.length) { toast('Tildá al menos una', { err: true }); return false; } return r; }]] });
  if (!res) return;
  res.els.forEach((x) => salaAplicar(k, x, res, false));
  commit(`${e.n}: ${res.els.length} ${e.a === 'zap' ? 'zapatas' : 'vigas'} ${res.est === 'ok' ? 'terminadas' : 'en curso'} · edificio ${fmt(salaInfo().p * 100)} %`);
}
// todas las etapas de una zapata o una viga juntas (desde la planta)
async function salaEditElem(tipo, x) {
  if (window.READONLY) return;
  const ets = SALA_ET.filter((e) => e.a === tipo), z = SALA_ZAP.find((q) => q.id === x), g = SALA_VIG.find((q) => q.id === x);
  const res = await modal({ title: tipo === 'zap' ? `Zapata ${x}` : `Viga de fundación ${x}`, sub: tipo === 'zap' ? `Tipo ${z.t} · ${fmt(SALA_ZT[z.t] * 100)} × ${fmt(SALA_ZT[z.t] * 100)} cm · columna 18 × 18` : `Tramo ${g.cs.join(' – ')}`, wide: true,
    body: `<table class="tbl salaed"><thead><tr><th>Etapa</th><th>Estado</th><th>Inicio</th><th>Fin</th></tr></thead><tbody>${ets.map((e) => { const v = salaAv(e.k, x);
      return `<tr data-k="${e.k}"><td><b>${esc(e.n)}</b></td><td>${salaEstSel(v)}</td><td><input type="date" name="ini" value="${v.ini || ''}"></td><td><input type="date" name="fin" value="${v.ok ? v.fin || '' : ''}"></td></tr>`; }).join('')}</tbody></table>
      <p class="hint" style="display:block">Si dejás la fecha vacía al cambiar el estado, se carga la de hoy.</p>`,
    buttons: [['Cancelar', 'btn', () => null], ['Guardar', 'btn pri', (box) => $$('tbody tr', box).map((tr) => ({ k: tr.dataset.k, est: $('[name=est]', tr).value, ini: $('[name=ini]', tr).value || today(), fin: $('[name=fin]', tr).value || today(), obs: salaAv(tr.dataset.k, x).obs || '' }))]] });
  if (!res) return;
  res.forEach((r) => { const v = salaAv(r.k, x); if (!r.est && !v.ini && !v.ok) return; salaAplicar(r.k, x, r, false); });
  commit(`${tipo === 'zap' ? 'Zapata' : 'Viga'} ${x} actualizada · edificio ${fmt(salaInfo().p * 100)} %`);
}
// ---- exportes ----
async function exportSala() {
  const wb = XLSX.utils.book_new(), I = salaInfo(), est = (v) => (v.ok ? 'Terminada' : v.ini ? 'En curso' : '');
  const a = [['#', 'Grupo', 'Etapa', 'Se carga', 'Terminadas', 'En curso', 'Total', 'Avance %', 'Inicio', 'Fin', 'Observación']];
  I.ets.forEach((x, i) => a.push([i + 1, x.e.g, x.e.n, SALA_AMB[x.e.a], x.ok, x.cur, x.n, Math.round(x.p * 1000) / 10, x.ini, x.fin, x.e.a === 'gral' ? x.v.obs || '' : '']));
  a.push([]); a.push(['', '', 'Avance del edificio %', '', '', '', '', Math.round(I.p * 1000) / 10]);
  const w1 = XLSX.utils.aoa_to_sheet(a); w1['!cols'] = [4, 26, 52, 12, 11, 9, 7, 10, 11, 11, 36].map((w) => ({ wch: w })); XLSX.utils.book_append_sheet(wb, w1, 'Etapas');
  const mx = (ets, els, nom) => { const b = [['Etapa', ...els.flatMap((x) => [x, 'Inicio', 'Fin'])]]; ets.forEach((e) => b.push([e.n, ...els.flatMap((x) => { const v = salaAv(e.k, x); return [est(v), v.ini || '', v.ok ? v.fin || '' : '']; })])); const w = XLSX.utils.aoa_to_sheet(b); w['!cols'] = [44, ...els.flatMap(() => [10, 11, 11])].map((c) => ({ wch: c })); XLSX.utils.book_append_sheet(wb, w, nom); };
  mx(SALA_ET.filter((e) => e.a === 'zap'), SALA_ZAP.map((z) => z.id), 'Zapatas');
  mx(SALA_ET.filter((e) => e.a === 'viga'), SALA_VIG.map((g) => g.id), 'Vigas de fundación');
  const p = await window.api.saveBinary(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }), `Edificio OyM ${today()}.xlsx`, 'xlsx', 'Excel');
  if (p) toast('Excel exportado', { action: ['Abrir', () => window.api.openPath(p)] });
}
function printSala() {
  const v = document.createElement('div'); const ro = window.READONLY; window.READONLY = true; vSala(v); window.READONLY = ro;
  $$('.hint', v).forEach((x) => x.remove()); $$('.card', v).forEach((x) => x.classList.add('prday'));
  printHTML(prHead('Edificio de operación y mantenimiento · avance de obra') + v.innerHTML, `Edificio OyM ${today()}.pdf`, true);
  render(false);
}
// ---- Inicio y Avance de obra ----
function salaModHTML() {
  const I = salaInfo(), grupos = [...new Set(SALA_ET.map((e) => e.g))];
  const fila = (g) => { const xs = I.ets.filter((x) => x.e.g === g), p = xs.reduce((a, x) => a + x.p, 0) / xs.length; return `<div class="mrow"><span>${esc(g)}</span><div class="sbt"><div style="width:${(p * 100).toFixed(1)}%;background:#7a5af8"></div></div><b>${fmt(p * 100)}%</b></div>`; };
  return `<div class="card mcard" data-go="sala" title="Ver detalle del edificio"><div class="mh"><div>${Charts.ring(I.p, '#7a5af8', 'edificio')}</div><div><h3>Edificio de O&amp;M</h3><div class="muted">${I.done}/${SALA_ET.length} etapas · ${I.nZH}/${SALA_ZAP.length} zapatas${I.curso.length ? `<br>en curso: ${esc(I.curso[0].e.n)}${I.curso.length > 1 ? ' y ' + (I.curso.length - 1) + ' más' : ''}` : ''}</div></div></div>${grupos.slice(0, 5).map(fila).join('')}</div>`;
}
function salaAvanceHTML() {
  const I = salaInfo();
  return `<h2 class="sech">Edificio de operación y mantenimiento</h2><div class="grid g2 stagger" style="margin-bottom:16px"><div class="card"><h3>Planta de fundaciones</h3><div class="salaplanta">${salaPlantaSVG(I, { ro: true })}</div>
    <div class="kpis k3" style="margin-top:8px">${kpi('Avance del edificio', I.p * 100, '%', 1)}${kpi('Etapas terminadas', I.done, `/ ${SALA_ET.length}`, 0)}${kpi('Zapatas hormigonadas', I.nZH, `/ ${SALA_ZAP.length}`, 0)}</div></div>
    <div class="card"><h3>Avance por etapa</h3>${Charts.hbars(I.ets.map((x) => ({ label: x.e.n.length > 40 ? x.e.n.slice(0, 39) + '…' : x.e.n, right: x.e.a === 'gral' ? `${fmt(x.p * 100)} %` : `${x.ok}/${x.n}`, parts: x.e.a === 'gral' ? [{ v: x.p, color: x.p >= 1 ? FCOL.done : FCOL.curso, name: 'Avance' }, { v: 1 - x.p, color: FCOL.pend, name: 'Pendiente' }] : [{ v: x.ok, color: FCOL.done, name: 'Terminado' }, { v: x.cur, color: FCOL.curso, name: 'En curso' }, { v: x.n - x.ok - x.cur, color: FCOL.pend, name: 'Pendiente' }] })), { labelW: 260, rightW: 60 })}${Charts.legend([[FCOL.done, 'Terminado'], [FCOL.curso, 'En curso'], [FCOL.pend, 'Pendiente']])}</div></div>`;
}
