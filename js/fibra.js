/* PSFV-OBE II · Fibra óptica (comunicaciones entre centros de transformación y sala de celdas / operación).
   El tubo PEAD de la fibra acompaña al tendido de media tensión, por encima de los cables: se coloca al cerrar o cargar la zanja de MT.
   Cámaras de inspección cada N metros (50 m por defecto).
   Datos: S.fibra = { cfg: {cada, adic}, z: { zid: {cargada, fecha, sinFibra, cam, camCol, obs} } } */
const FO_V = ['fo'];
const foS = () => { S.fibra = S.fibra || {}; S.fibra.cfg = S.fibra.cfg || { cada: 50, adic: 0 }; S.fibra.z = S.fibra.z || {}; return S.fibra; };
const foZ = (zid) => foS().z[zid] || {};
// tramos de la línea aérea / ET: la fibra une CTs y sala de celdas, por defecto no lleva tubo (se puede cambiar en la ficha)
const foDefSin = (z) => /LMT|piquete|\bET\b/i.test(z.titulo || '');
const foSin = (z) => { const f = foZ(z.id); return !!f.sinFibra || (foDefSin(z) && !f.conFibra); };
const foCada = () => Number(foS().cfg.cada) > 0 ? Number(foS().cfg.cada) : 50;
// cámaras intermedias del tramo: una cada N m (un tramo de 120 m lleva 2: a los 50 y a los 100)
const foCamPrev = (z) => { const f = foZ(z.id); if (f.cam != null && f.cam !== '') return Number(f.cam); return z.largo > 0 ? Math.max(0, Math.ceil(z.largo / foCada() - 1e-9) - 1) : 0; };
// tubo colocado: zanja de MT cerrada o marcada como cargada (el tubo va por encima de los cables)
const foColocado = (z) => !foSin(z) && (z.estado === 'cerrada' || !!foZ(z.id).cargada);
// las cámaras se cargan a mano (se colocan aparte del tubo)
const foCamCol = (z) => Math.min(Number(foZ(z.id).camCol) || 0, foCamPrev(z));
const foTubo = (z) => z.largo * (1 + (Number(foS().cfg.adic) || 0) / 100);
const foFecha = (z) => foZ(z.id).fecha || (z.estado === 'cerrada' ? z.fechaCierre || '' : '');
function foZanjas() { return R.zlist.filter((z) => z.cat === 'MT').sort((a, b) => (Math.min(...a.miembros.map((c) => c.idx), 1e9) - Math.min(...b.miembros.map((c) => c.idx), 1e9))); }
function foTotales() {
  const zs = foZanjas().filter((z) => !foSin(z)), t = { n: zs.length, tubo: 0, col: 0, cam: 0, camCol: 0, nCol: 0 };
  zs.forEach((z) => { t.tubo += foTubo(z); t.cam += foCamPrev(z); t.camCol += foCamCol(z); if (foColocado(z)) { t.col += foTubo(z); t.nCol++; } });
  return t;
}
function foGuardar(zid, cambios, msg) {
  const F = foS(); const o = Object.assign({}, F.z[zid] || {}, cambios);
  Object.keys(o).forEach((k) => { if (o[k] === '' || o[k] == null || o[k] === false) delete o[k]; });
  if (Object.keys(o).length) F.z[zid] = o; else delete F.z[zid];
  commit(msg);
}

function vFibra(el) {
  const ro = window.READONLY;
  actions([['Exportar Excel', 'btn', exportFibra], ['PDF de fibra óptica', 'btn', printFibra]]);
  const zs = foZanjas(), T = foTotales(), F = foS(), fe = ui.foEst || 'all';
  if (!zs.length) { el.innerHTML = '<div class="empty"><b>No hay zanjas de media tensión</b><p>El tubo de fibra acompaña a las zanjas de MT: cargá primero los circuitos de MT.</p></div>'; return; }
  const pctT = T.tubo ? T.col / T.tubo : 0, pctC = T.cam ? T.camCol / T.cam : 0;
  const list = zs.filter((z) => fe === 'all' || (fe === 'col' ? foColocado(z) : fe === 'pend' ? !foColocado(z) && !foSin(z) : foSin(z)));
  let h = `<div class="grid g3" style="margin-bottom:14px;align-items:stretch">
    <div class="card"><h3>Tubo PEAD de fibra</h3><div class="kpis k2">${kpi('Colocado', T.col, 'm')}${kpi('Previsto', T.tubo, 'm')}</div>
      <div class="bar" style="margin-top:10px"><div style="width:${(pctT * 100).toFixed(1)}%;background:var(--cMT)"></div></div><div class="muted" style="margin-top:4px">${fmt(pctT * 100)} % · ${T.nCol} de ${T.n} tramos</div></div>
    <div class="card"><h3>Cámaras de inspección</h3><div class="kpis k2">${kpi('Colocadas', T.camCol, 'u', 0)}${kpi('Previstas', T.cam, 'u', 0)}</div>
      <div class="bar" style="margin-top:10px"><div style="width:${(pctC * 100).toFixed(1)}%;background:#2f6fc2"></div></div><div class="muted" style="margin-top:4px">${fmt(pctC * 100)} % · una cada ${fmt(foCada())} m</div></div>
    <div class="card" style="min-width:0"><h3>Criterio</h3><div class="form foCfg" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr)">
      <label>Cámara cada (m)<input type="number" min="1" step="1" id="foCada" value="${foCada()}" ${ro ? 'disabled' : ''}></label>
      <label>Adicional de tubo (%)<input type="number" min="0" step="0.5" id="foAdic" value="${Number(F.cfg.adic) || 0}" ${ro ? 'disabled' : ''}></label></div>
      <p class="muted" style="font-size:12px;margin:8px 0 0">El tubo se cuenta colocado cuando la zanja de MT está <b>cerrada</b> o marcada como <b>cargada</b> (va por encima de los cables). Largo del tubo = largo de la zanja + adicional. Las cámaras colocadas se cargan a mano (− / + en la tabla).</p></div></div>
    <div class="tools"><div class="seg" id="fFO"><button data-v="all">Todos</button><button data-v="col">Colocado</button><button data-v="pend">Pendiente</button><button data-v="sin">Sin fibra</button></div>
    <span class="muted">${list.length} tramo${list.length === 1 ? '' : 's'} de MT</span><span class="sp"></span>${ro ? '' : `<button class="btn" id="foCarg" disabled>Marcar cargadas (tubo colocado)</button>`}</div>
    <div class="tblwrap"><table class="tbl"><thead><tr>${ro ? '' : '<th style="width:28px"><input type="checkbox" id="foAll"></th>'}<th>Zanja de MT</th><th>Circuitos</th><th class="n">Largo zanja</th><th>Estado zanja</th>
    <th class="n">Tubo PEAD (m)</th><th>Tubo</th><th class="n">Cámaras</th><th>Fecha</th><th>Observaciones</th><th></th></tr></thead><tbody>`;
  list.forEach((z) => {
    const f = foZ(z.id), sin = foSin(z), col = foColocado(z), cp = foCamPrev(z), cc = foCamCol(z);
    const est = sin ? '<span class="pill p-prov">sin fibra</span>' : col ? `<span class="pill p-done">colocado${z.estado !== 'cerrada' ? ' (cargada)' : ''}</span>` : '<span class="pill p-prov">pendiente</span>';
    h += `<tr data-id="${z.id}" ${sin ? 'style="opacity:.55"' : ''}>${ro ? '' : `<td><input type="checkbox" class="fosel" ${sin || z.estado === 'cerrada' ? 'disabled' : ''}></td>`}
      <td><b>${esc(z.titulo)}</b></td><td style="white-space:normal;max-width:240px;font-size:12px">${z.miembros.map((c) => esc(c.designacion)).join(', ')}</td>
      <td class="n">${fmt(z.largo, 1)}</td><td>${pill(z.estado)}</td><td class="n">${sin ? '–' : fmt(foTubo(z), 1)}</td><td>${est}</td>
      <td class="n" style="white-space:nowrap">${sin ? '–' : `${ro ? '' : `<button class="btn sm ghost camb" data-d="-1" ${cc <= 0 ? 'disabled' : ''} title="Una cámara menos">−</button>`}<b style="display:inline-block;min-width:44px;text-align:center">${cc} / ${cp}</b>${ro ? '' : `<button class="btn sm ghost camb" data-d="1" ${cc >= cp ? 'disabled' : ''} title="Una cámara colocada más">+</button>`}`}</td>
      <td>${foFecha(z) ? fechaCorta(foFecha(z)) : ''}</td><td style="font-size:12px">${esc(f.obs || '')}</td>
      <td style="white-space:nowrap">${ro ? '' : `${!sin && z.estado !== 'cerrada' ? `<button class="btn sm ${f.cargada ? 'ghost' : 'acc'}" data-a="carg">${f.cargada ? 'Quitar cargada' : 'Zanja cargada'}</button> ` : ''}<button class="btn sm ghost" data-a="ed">✎</button>`}</td></tr>`;
  });
  h += `</tbody></table></div>
    <div class="card" style="margin-top:14px"><h3>Tendido del cable de fibra y fusiones <span class="pill p-prov">próximamente</span></h3><p class="muted" style="margin:0">Enhebrado o soplado de la fibra dentro del tubo entre centros de transformación y la sala de celdas, cajas de empalme, fusiones y certificación (OTDR).</p></div>`;
  el.innerHTML = h;
  segBind('#fFO', fe, (v) => { ui.foEst = v; render(false); });
  if (ro) return;
  const setCfg = (k, v) => { foS().cfg[k] = v; commit('Fibra óptica: criterio actualizado'); };
  $('#foCada').onchange = (e) => { const v = Number(e.target.value); if (v > 0) setCfg('cada', v); };
  $('#foAdic').onchange = (e) => setCfg('adic', Math.max(0, Number(e.target.value) || 0));
  const bC = $('#foCarg'), sel = () => $$('.fosel:checked', el).map((x) => x.closest('tr').dataset.id);
  const upd = () => { const n = sel().length; bC.disabled = !n; bC.textContent = n ? `Marcar ${n} cargada${n > 1 ? 's' : ''} (tubo colocado)` : 'Marcar cargadas (tubo colocado)'; };
  $$('.fosel', el).forEach((c) => { c.onchange = upd; });
  const all = $('#foAll'); if (all) all.onchange = () => { $$('.fosel:not(:disabled)', el).forEach((c) => { c.checked = all.checked; }); upd(); };
  bC.onclick = () => { const ids = sel(); const F2 = foS(); ids.forEach((id) => { F2.z[id] = Object.assign({}, F2.z[id] || {}, { cargada: true, fecha: (F2.z[id] || {}).fecha || today() }); }); commit(`Tubo de fibra colocado en ${ids.length} tramo${ids.length > 1 ? 's' : ''}`); };
  $$('tbody tr', el).forEach((tr) => {
    const id = tr.dataset.id, z = zs.find((x) => x.id === id);
    const b1 = tr.querySelector('[data-a=carg]'); if (b1) b1.onclick = () => { const c = !foZ(id).cargada; foGuardar(id, { cargada: c, fecha: c ? foZ(id).fecha || today() : '' }, `${z.titulo}: ${c ? 'zanja cargada, tubo de fibra colocado' : 'tubo de fibra pendiente'}`); };
    const b2 = tr.querySelector('[data-a=ed]'); if (b2) b2.onclick = () => editFibra(z);
    $$('.camb', tr).forEach((b) => { b.onclick = () => { const n = Math.max(0, Math.min(foCamPrev(z), foCamCol(z) + Number(b.dataset.d))); foGuardar(id, { camCol: n }, `${z.titulo}: ${n} de ${foCamPrev(z)} cámaras colocadas`); }; });
  });
}
async function editFibra(z) {
  const f = foZ(z.id), auto = Math.max(0, Math.ceil(z.largo / foCada() - 1e-9) - 1);
  const res = await modal({
    title: `Fibra óptica · ${z.titulo}`,
    sub: `Zanja de MT de ${fmt(z.largo, 1)} m · ${z.estado} · ${z.miembros.map((c) => c.designacion).join(', ')}`,
    body: `<div class="form"><label class="chk" style="grid-column:1/-1"><input type="checkbox" name="sinFibra" ${foSin(z) ? 'checked' : ''}> Este tramo no lleva tubo de fibra${foDefSin(z) ? ' (tramo de línea aérea / ET: sin fibra por defecto)' : ''}</label>
      <label class="chk" style="grid-column:1/-1"><input type="checkbox" name="cargada" ${f.cargada || z.estado === 'cerrada' ? 'checked' : ''} ${z.estado === 'cerrada' ? 'disabled' : ''}> Tubo colocado (zanja cargada)${z.estado === 'cerrada' ? ' — la zanja ya está cerrada' : ''}</label>
      <label>Fecha de colocación<input type="date" name="fecha" value="${esc(foFecha(z))}"></label>
      <label>Cámaras previstas<input type="number" min="0" step="1" name="cam" value="${f.cam != null ? f.cam : ''}" placeholder="${auto} (una cada ${fmt(foCada())} m)"></label>
      <label>Cámaras colocadas<input type="number" min="0" step="1" name="camCol" value="${f.camCol != null ? f.camCol : ''}" placeholder="0"></label>
      <label class="full">Observaciones<input type="text" name="obs" value="${esc(f.obs || '')}"></label></div>
      <p class="hint">Las cámaras previstas se calculan solas (una cada ${fmt(foCada())} m del tramo) si dejás el campo vacío. Las colocadas se cargan a mano, acá o con los botones − / + de la tabla.</p>`,
    buttons: [['Cancelar', 'btn', () => null], ['Guardar', 'btn pri', (box) => {
      const g = (n) => $(`[name=${n}]`, box).value.trim(), num = (n) => (g(n) === '' ? '' : Math.max(0, Math.round(Number(g(n)))));
      const prev = g('cam') === '' ? auto : num('cam'); if (num('camCol') !== '' && num('camCol') > prev) { toast(`Hay ${prev} cámaras previstas en el tramo: no pueden colocarse más`, { err: true }); return false; }
      const sinF = $('[name=sinFibra]', box).checked;
      return { sinFibra: foDefSin(z) ? '' : sinF, conFibra: foDefSin(z) ? !sinF : '', cargada: z.estado !== 'cerrada' && $('[name=cargada]', box).checked, fecha: g('fecha'), cam: num('cam'), camCol: num('camCol'), obs: g('obs') };
    }]],
  });
  if (res) foGuardar(z.id, res, `${z.titulo}: fibra óptica actualizada`);
}
async function exportFibra() {
  const wb = XLSX.utils.book_new(), r1 = (x) => Math.round(x * 10) / 10, T = foTotales();
  const a = [['Zanja de MT', 'Circuitos', 'Largo zanja (m)', 'Estado zanja', 'Tubo PEAD (m)', 'Tubo', 'Cámaras previstas', 'Cámaras colocadas', 'Fecha', 'Observaciones']];
  foZanjas().forEach((z) => { const f = foZ(z.id), sin = foSin(z); a.push([z.titulo, z.miembros.map((c) => c.designacion).join(', '), r1(z.largo), z.estado, sin ? '' : r1(foTubo(z)), sin ? 'Sin fibra' : foColocado(z) ? 'Colocado' : 'Pendiente', sin ? '' : foCamPrev(z), sin ? '' : foCamCol(z), foFecha(z), f.obs || '']); });
  a.push([]); a.push(['TOTAL', '', '', '', r1(T.tubo), `${r1(T.col)} m colocados`, T.cam, T.camCol]);
  a.push([`Cámaras de inspección cada ${foCada()} m · adicional de tubo ${Number(foS().cfg.adic) || 0} %`]);
  const ws = XLSX.utils.aoa_to_sheet(a); ws['!cols'] = [28, 40, 14, 12, 14, 12, 16, 17, 12, 30].map((w) => ({ wch: w })); XLSX.utils.book_append_sheet(wb, ws, 'Tubo y cámaras');
  const p = await window.api.saveBinary(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }), `Fibra optica ${today()}.xlsx`, 'xlsx', 'Excel');
  if (p) toast('Excel exportado', { action: ['Abrir', () => window.api.openPath(p)] });
}
function printFibra() {
  const T = foTotales();
  let h = prHead('Fibra óptica · tubo PEAD y cámaras de inspección') + `<div class="card"><p style="margin:0 0 8px">Tubo colocado <b>${fmt(T.col)} m</b> de ${fmt(T.tubo)} m (${fmt(T.tubo ? (T.col / T.tubo) * 100 : 0)} %) · Cámaras colocadas <b>${T.camCol}</b> de ${T.cam} · una cada ${fmt(foCada())} m</p>
    <table class="tbl stk"><thead><tr><th>Zanja de MT</th><th>Circuitos</th><th class="n">Largo zanja</th><th>Estado zanja</th><th class="n">Tubo (m)</th><th>Tubo</th><th class="n">Cámaras</th><th>Fecha</th></tr></thead><tbody>${foZanjas().map((z) => { const sin = foSin(z); return `<tr><td><b>${esc(z.titulo)}</b></td><td style="white-space:normal;max-width:220px">${z.miembros.map((c) => esc(c.designacion)).join(', ')}</td><td class="n">${fmt(z.largo, 1)}</td><td>${z.estado}</td><td class="n">${sin ? '–' : fmt(foTubo(z), 1)}</td><td>${sin ? 'sin fibra' : foColocado(z) ? 'colocado' : 'pendiente'}</td><td class="n">${sin ? '–' : `${foCamCol(z)} / ${foCamPrev(z)}`}</td><td>${foFecha(z) ? fechaCorta(foFecha(z)) : ''}</td></tr>`; }).join('')}</tbody></table></div>`;
  printHTML(h, `Fibra optica ${today()}.pdf`, true);
}

// ---- tarjeta del Inicio y bloque de Avance de obra ----
function foModHTML() {
  const T = foTotales(); if (!T.n) return '';
  const fila = (lbl, a, b, col, u) => `<div class="mrow"><span>${lbl}</span><div class="sbt"><div style="width:${b ? ((a / b) * 100).toFixed(1) : 0}%;background:${col}"></div></div><b>${fmt(b ? (a / b) * 100 : 0)}%</b></div>`;
  return `<div class="card mcard" data-go="fo" title="Ver detalle de fibra óptica"><div class="mh"><div>${Charts.ring(T.tubo ? T.col / T.tubo : 0, '#2f6fc2', 'tubo')}</div><div><h3>Fibra óptica</h3><div class="muted">${fmt(T.col)} / ${fmt(T.tubo)} m de tubo PEAD</div></div></div>
    ${fila('Tubo PEAD', T.col, T.tubo, '#2f6fc2')}${fila(`Cámaras ${T.camCol}/${T.cam}`, T.camCol, T.cam, '#c97b12')}<div class="muted" style="margin-top:6px">${T.nCol} de ${T.n} tramos de MT con tubo · cámara cada ${fmt(foCada())} m</div></div>`;
}
function foAvanceHTML() {
  const zs = foZanjas().filter((z) => !foSin(z)); if (!zs.length) return '';
  const T = foTotales(), C = { col: '#2f6fc2', pend: ST.pend };
  const rows = zs.map((z) => { const c = foColocado(z); return { label: z.titulo.length > 34 ? z.titulo.slice(0, 33) + '…' : z.titulo, right: `${c ? 'colocado' : 'pendiente'} · ${foCamCol(z)}/${foCamPrev(z)} cám.`, parts: [{ v: c ? foTubo(z) : 0, color: C.col, name: 'Tubo colocado' }, { v: c ? 0 : foTubo(z), color: C.pend, name: 'Pendiente' }] }; });
  return `<h2 class="sech">Fibra óptica</h2><div class="grid g2 stagger" style="margin-bottom:16px">
    <div class="card tile"><div>${Charts.ring(T.tubo ? T.col / T.tubo : 0, C.col, 'tubo')}</div><div><h3 style="margin-bottom:6px">Tubo PEAD y cámaras</h3>
      <div class="kpis k1" style="gap:6px">${kpi('Tubo colocado', T.col, `/ ${fmt(T.tubo)} m`)}${kpi('Cámaras de inspección', T.camCol, `/ ${T.cam}`)}</div>
      <div class="muted" style="margin-top:6px">${T.nCol} de ${T.n} tramos · cámara cada ${fmt(foCada())} m${Number(foS().cfg.adic) ? ` · tubo + ${fmt(foS().cfg.adic)} %` : ''}</div></div></div>
    <div class="card"><h3>Tubo por tramo de MT (m)</h3>${Charts.hbars(rows, { labelW: 230, rightW: 150 })}${Charts.legend([[C.col, 'Tubo colocado'], [C.pend, 'Pendiente']])}</div></div>`;
}

// ======================= SALA DE OPERACIÓN Y CONTROL =======================
