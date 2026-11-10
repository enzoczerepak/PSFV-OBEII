/* PSFV-OBE II · Línea de media tensión aérea (LMT) parque → ET.
   El conductor desnudo (Prysalac) no se corta: el avance se lleva por etapas.
   Ámbito de cada etapa: 'linea' (una vez para toda la línea), 'piquete' (por cada poste) o 'vano' (entre un piquete y el siguiente).
   Datos: S.lmt = { cfg: { piquetes: [{id, nro, tipo, vano, obs}], etapas: [{k, n, a}], adic }, av: { 'etapa|piquete': {ini, fin, ok, obs} } }
          (las etapas de línea usan el piquete 'L') */
const LMT_V = ['lmt'];
const LMT_TIPOS = ['Suspensión', 'Retención', 'Angular', 'Terminal', 'Derivación'];
const LMT_ETAPAS_DEF = [
  ['traza', 'Definición de traza', 'linea'], ['marc', 'Marcado de piquetes', 'piquete'], ['exc', 'Excavación para fundaciones', 'piquete'],
  ['fund', 'Carga de fundaciones (hormigonado)', 'piquete'], ['izaje', 'Izaje de postes', 'piquete'], ['vinc', 'Vinculación de postes (crucetas, ménsulas, riendas)', 'piquete'],
  ['acc', 'Colocación de accesorios (aisladores y morsetería)', 'piquete'], ['pat', 'Puesta a tierra de estructuras', 'piquete'],
  ['tend', 'Tendido de conductores', 'vano'], ['tens', 'Tensado, flechado y engrapado', 'vano'], ['insp', 'Inspección y pruebas finales', 'linea'],
].map(([k, n, a]) => ({ k, n, a }));
const LMT_AMB = { linea: 'Toda la línea', piquete: 'Por piquete', vano: 'Por vano' };
const lmtS = () => { S.lmt = S.lmt || {}; S.lmt.cfg = S.lmt.cfg || {}; const c = S.lmt.cfg; c.piquetes = c.piquetes || []; c.etapas = c.etapas && c.etapas.length ? c.etapas : LMT_ETAPAS_DEF.map((x) => ({ ...x })); S.lmt.av = S.lmt.av || {}; return S.lmt; };
const lmtPq = () => lmtS().cfg.piquetes;
const lmtEt = () => lmtS().cfg.etapas;
const lmtAv = (k, pid) => lmtS().av[`${k}|${pid}`] || {};
// unidades de una etapa: la línea (1), cada piquete, o cada vano (todos menos el último piquete)
const lmtUnid = (e) => (e.a === 'linea' ? [{ id: 'L', nro: 'Línea' }] : e.a === 'vano' ? lmtPq().slice(0, -1) : lmtPq());
const vanoTxt = (p) => { const ps = lmtPq(), i = ps.indexOf(p); return i >= 0 && ps[i + 1] ? `${p.nro} → ${ps[i + 1].nro}` : p.nro; };
function lmtInfo() {
  const ets = lmtEt().map((e) => { const us = lmtUnid(e), ok = us.filter((u) => lmtAv(e.k, u.id).ok).length, cur = us.filter((u) => { const v = lmtAv(e.k, u.id); return v.ini && !v.ok; }).length; return { e, n: us.length, ok, cur, p: us.length ? ok / us.length : 0 }; });
  const p = ets.length ? ets.reduce((a, x) => a + x.p, 0) / ets.length : 0;
  const largo = lmtPq().reduce((a, x) => a + (Number(x.vano) || 0), 0);
  return { ets, p, largo, nP: lmtPq().length };
}
function lmtSet(k, pid, v, msg) {
  const L = lmtS(), key = `${k}|${pid}`;
  if (!v || (!v.ini && !v.ok && !v.obs)) delete L.av[key]; else L.av[key] = v;
  if (msg) commit(msg);
}

function vLMT(el) {
  const ro = window.READONLY, L = lmtS(), ps = lmtPq();
  if (!ps.length) {
    actions([]);
    el.innerHTML = `<div class="card" style="max-width:640px">${ro ? '<p class="muted">Todavía no se cargaron los piquetes de la línea.</p>' : `<h3>Cargar los piquetes de la línea</h3>
      <p class="muted" style="margin-top:0">Cada piquete es un poste de la línea aérea de MT entre el parque y la ET. Después se pueden editar uno por uno (tipo, vano, observaciones).</p>
      <div class="form"><label>Cantidad de piquetes<input type="number" min="2" step="1" id="lpN" value="20"></label><label>Prefijo<input type="text" id="lpP" value="P"></label>
      <label>Largo total de la línea (m)<input type="number" min="0" step="1" id="lpL" placeholder="opcional: se reparte en los vanos"></label>
      <label>Tipo de los intermedios<select id="lpT">${LMT_TIPOS.map((t) => `<option>${t}</option>`).join('')}</select></label></div>
      <p class="hint">El primero y el último quedan como <b>Terminal</b>. Las etapas propuestas (traza, marcado, excavación, fundaciones, izaje, vinculación, accesorios, puesta a tierra, tendido, tensado e inspección) se pueden modificar.</p>
      <button class="btn pri" id="lpOk">Crear piquetes</button>`}</div>`;
    const b = $('#lpOk'); if (b) b.onclick = () => {
      const n = Math.max(2, Math.round(Number($('#lpN').value) || 0)), pre = $('#lpP').value.trim(), lt = Number($('#lpL').value) || 0, t = $('#lpT').value;
      L.cfg.piquetes = Array.from({ length: n }, (_, i) => ({ id: uid('pq'), nro: `${pre}${i + 1}`, tipo: i === 0 || i === n - 1 ? 'Terminal' : t, vano: lt && i < n - 1 ? Math.round((lt / (n - 1)) * 10) / 10 : '' }));
      commit(`Línea aérea: ${n} piquetes creados`);
    };
    return;
  }
  actions([...(ro ? [] : [['+ Piquete', 'btn', () => editPiquete(null)], ['Etapas…', 'btn', editEtapasLMT]]), ['Exportar Excel', 'btn', exportLMT], ['PDF de la línea', 'btn', printLMT]]);
  const I = lmtInfo(), ets = lmtEt(), cols = ets.filter((e) => e.a !== 'linea'), lin = ets.filter((e) => e.a === 'linea');
  // conductor Prysalac
  const bLA = R.bobinas.filter((b) => b.cat === 'LA'), stock = bLA.reduce((a, b) => a + b.saldoActual, 0), ent = bLA.reduce((a, b) => a + b.entrada, 0);
  const adic = Number(L.cfg.adic) || 0, nec = I.largo * 3 * (1 + adic / 100);
  let h = `<div class="grid g3" style="margin-bottom:14px;align-items:stretch">
    <div class="card tile"><div>${Charts.ring(I.p, '#2f6fc2', 'avance')}</div><div><h3 style="margin-bottom:6px">Línea aérea de MT</h3>
      <div class="kpis k1" style="gap:6px">${kpi('Piquetes', I.nP, 'u', 0)}${kpi('Largo de la línea', I.largo, 'm')}</div><div class="muted" style="margin-top:6px">${ets.length} etapas · cada etapa pesa lo mismo en el avance</div></div></div>
    <div class="card"><h3>Etapas de toda la línea</h3>${lin.length ? lin.map((e) => { const v = lmtAv(e.k, 'L'); return `<div class="zrow" style="align-items:center"><span>${esc(e.n)}</span>${v.ok ? `<span class="pill p-done">terminada ${fechaCorta(v.fin || v.ini)}</span>` : v.ini ? `<span class="pill p-warn">en curso desde ${fechaCorta(v.ini)}</span>` : '<span class="pill p-prov">pendiente</span>'}${ro ? '' : ` <button class="btn sm ghost" data-le="${e.k}">✎</button>`}</div>`; }).join('') : '<span class="muted">Sin etapas de línea</span>'}</div>
    <div class="card"><h3>Conductor Prysalac</h3><div class="kpis k2">${kpi('En bobinas', stock, 'm')}${kpi('Necesario', nec, 'm')}</div>
      <div class="muted" style="margin-top:6px;font-size:12px">${bLA.length} bobina${bLA.length === 1 ? '' : 's'} (${fmt(ent)} m ingresados) · necesario = largo × 3 conductores${ro ? ` + ${fmt(adic)} %` : ` + <input type="number" id="lmAdic" value="${adic}" min="0" step="0.5" style="width:56px;padding:2px 4px"> %`}${I.largo && stock < nec ? ` · <b style="color:var(--bad)">faltan ${fmt(nec - stock)} m</b>` : ''}</div></div></div>
    <div class="card" style="margin-bottom:14px"><h3>Avance por etapa</h3>${Charts.hbars(I.ets.map((x) => ({ label: x.e.n.length > 44 ? x.e.n.slice(0, 43) + '…' : x.e.n, right: `${x.ok}/${x.n} ${x.e.a === 'linea' ? '' : x.e.a === 'vano' ? 'vanos' : 'piquetes'}`, parts: [{ v: x.ok, color: FCOL.done, name: 'Terminado' }, { v: x.cur, color: FCOL.curso, name: 'En curso' }, { v: x.n - x.ok - x.cur, color: FCOL.pend, name: 'Pendiente' }] })), { labelW: 330, rightW: 110, W: 1240, unit: 'u' })}
      ${Charts.legend([[FCOL.done, 'Terminado'], [FCOL.curso, 'En curso'], [FCOL.pend, 'Pendiente']])}</div>`;
  // carga masiva
  if (!ro) h += `<div class="tools"><b>Tildá piquetes y</b><select id="lmEt">${cols.map((e) => `<option value="${e.k}">${esc(e.n)}</option>`).join('')}</select><input type="date" id="lmF" value="${today()}">
    <button class="btn" id="lmIni" disabled>Iniciar</button><button class="btn acc" id="lmFin" disabled>Finalizar</button><span class="sp"></span><span class="muted" id="lmSel">0 tildados</span></div>`;
  h += `<div class="card tblcard"><div class="tblwrap"><table class="tbl ftbl lmtt"><thead><tr>${ro ? '' : '<th style="width:28px"><input type="checkbox" id="lmAll"></th>'}<th>Piquete</th><th>Tipo</th><th class="n">Vano (m)</th>
    ${cols.map((e, i) => `<th class="fc" title="${esc(e.n)} · ${LMT_AMB[e.a]}">${i + 1}. ${esc(e.n.split(' (')[0])}${e.a === 'vano' ? '<br><small>(vano)</small>' : ''}</th>`).join('')}<th class="n">Avance</th><th></th></tr></thead><tbody>`;
  ps.forEach((p, i) => {
    const ultimo = i === ps.length - 1;
    const hechas = cols.filter((e) => !(e.a === 'vano' && ultimo)), nOk = hechas.filter((e) => lmtAv(e.k, p.id).ok).length;
    h += `<tr data-id="${p.id}">${ro ? '' : '<td><input type="checkbox" class="lmsel"></td>'}<td><b>${esc(p.nro)}</b></td><td><span class="pill ${p.tipo === 'Suspensión' ? 'p-prov' : 'p-ready'}">${esc(p.tipo || '')}</span></td>
      <td class="n">${!ultimo && Number(p.vano) ? fmt(Number(p.vano), 1) : ''}</td>
      ${cols.map((e) => {
        if (e.a === 'vano' && ultimo) return '<td class="fc"><span class="muted">–</span></td>';
        const v = lmtAv(e.k, p.id), est = v.ok ? 'ok' : v.ini ? 'cur' : '';
        const tit = `${esc(e.n)}${e.a === 'vano' ? ' · vano ' + esc(vanoTxt(p)) : ' · ' + esc(p.nro)}${v.ini ? ' · inicio ' + fechaCorta(v.ini) : ''}${v.ok && v.fin ? ' · fin ' + fechaCorta(v.fin) : ''}${v.obs ? ' · ' + esc(v.obs) : ''}`;
        return `<td class="fc"><button class="lmc ${est}" data-k="${e.k}" ${ro ? 'disabled' : ''} title="${tit}">${v.ok ? `<b>✓</b><small>${fechaCorta(v.fin || v.ini).slice(0, 5)}</small>` : v.ini ? `<b>▶</b><small>${fechaCorta(v.ini).slice(0, 5)}</small>` : '·'}</button></td>`;
      }).join('')}
      <td class="n"><b>${fmt(hechas.length ? (nOk / hechas.length) * 100 : 0)}%</b></td><td>${ro ? '' : '<button class="btn sm ghost" data-a="ed">✎</button>'}</td></tr>`;
  });
  h += `</tbody></table></div></div><p class="hint">Tocá un casillero para cargar inicio y fin de la etapa en ese piquete (▶ en curso, ✓ terminada). Las etapas <b>por vano</b> (tendido, tensado) se marcan en el piquete donde arranca el vano. Para varias a la vez, tildá los piquetes, elegí la etapa y tocá Iniciar o Finalizar. El conductor de la línea no se corta: se controla el stock de Prysalac contra el largo de la línea.</p>`;
  el.innerHTML = h; Charts.bindTips(el);
  if (ro) return;
  $$('[data-le]', el).forEach((b) => { b.onclick = () => editAvLMT(b.dataset.le, 'L'); });
  const ad = $('#lmAdic'); if (ad) ad.onchange = () => { L.cfg.adic = Math.max(0, Number(ad.value) || 0); commit('Línea aérea: adicional de conductor actualizado'); };
  $$('.lmc', el).forEach((b) => { b.onclick = () => editAvLMT(b.dataset.k, b.closest('tr').dataset.id); });
  $$('[data-a=ed]', el).forEach((b) => { b.onclick = () => editPiquete(b.closest('tr').dataset.id); });
  const sel = () => $$('.lmsel:checked', el).map((c) => c.closest('tr').dataset.id);
  const upd = () => { const n = sel().length; $('#lmSel').textContent = `${n} tildado${n === 1 ? '' : 's'}`; $('#lmIni').disabled = $('#lmFin').disabled = !n; };
  $$('.lmsel', el).forEach((c) => { c.onchange = upd; });
  $('#lmAll').onchange = (e) => { $$('.lmsel', el).forEach((c) => { c.checked = e.target.checked; }); upd(); };
  const masivo = (fin) => {
    const k = $('#lmEt').value, f = $('#lmF').value || today(), e = ets.find((x) => x.k === k), ids = sel().filter((id) => !(e.a === 'vano' && id === ps[ps.length - 1].id));
    ids.forEach((id) => { const v = Object.assign({}, lmtAv(k, id)); if (!v.ini) v.ini = f; if (fin) { v.ok = true; v.fin = f; } lmtSet(k, id, v); });
    commit(`${e.n}: ${ids.length} ${e.a === 'vano' ? 'vano' : 'piquete'}${ids.length === 1 ? '' : 's'} ${fin ? 'terminado' : 'iniciado'}${ids.length === 1 ? '' : 's'}`);
  };
  $('#lmIni').onclick = () => masivo(false); $('#lmFin').onclick = () => masivo(true);
}
async function editAvLMT(k, pid) {
  const e = lmtEt().find((x) => x.k === k), p = lmtPq().find((x) => x.id === pid), v = lmtAv(k, pid);
  const res = await modal({
    title: e.n, sub: pid === 'L' ? 'Toda la línea' : e.a === 'vano' ? `Vano ${vanoTxt(p)}` : `Piquete ${p.nro} · ${p.tipo || ''}`,
    body: `<div class="form"><label>Inicio<input type="date" name="ini" value="${esc(v.ini || '')}"></label><label>Fin<input type="date" name="fin" value="${esc(v.ok ? v.fin || '' : '')}"></label>
      <label class="full">Observaciones<input type="text" name="obs" value="${esc(v.obs || '')}"></label></div><p class="hint">Con solo el inicio la etapa queda en curso; con la fecha de fin queda terminada.</p>`,
    buttons: [['Borrar', 'btn danger', () => 'del'], ['Cancelar', 'btn', () => null], ['Hoy: terminada', 'btn', () => 'hoy'], ['Guardar', 'btn pri', (box) => {
      const g = (n) => $(`[name=${n}]`, box).value; if (g('fin') && g('ini') && g('fin') < g('ini')) { toast('La fecha de fin es anterior al inicio', { err: true }); return false; }
      return { ini: g('ini') || g('fin'), fin: g('fin'), ok: !!g('fin'), obs: g('obs').trim() };
    }]],
  });
  const lbl = `${e.n} · ${pid === 'L' ? 'línea' : e.a === 'vano' ? 'vano ' + vanoTxt(p) : p.nro}`;
  if (res === 'del') lmtSet(k, pid, null, `${lbl}: borrado`);
  else if (res === 'hoy') lmtSet(k, pid, { ini: v.ini || today(), fin: today(), ok: true, obs: v.obs || '' }, `${lbl}: terminada`);
  else if (res) { if (!res.ok) delete res.fin; lmtSet(k, pid, res, `${lbl}: ${res.ok ? 'terminada' : res.ini ? 'en curso' : 'actualizada'}`); }
}
async function editPiquete(id) {
  const L = lmtS(), nuevo = !id, ps = lmtPq(), p = nuevo ? { id: uid('pq'), nro: `P${ps.length + 1}`, tipo: 'Suspensión', vano: '', obs: '' } : ps.find((x) => x.id === id);
  const res = await modal({
    title: nuevo ? 'Nuevo piquete' : `Piquete ${p.nro}`,
    body: `<div class="form"><label>Número / nombre<input type="text" name="nro" value="${esc(p.nro)}"></label><label>Tipo de estructura<select name="tipo">${LMT_TIPOS.map((t) => `<option ${p.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <label>Vano al siguiente piquete (m)<input type="number" min="0" step="0.1" name="vano" value="${p.vano ?? ''}"></label>
      ${nuevo ? `<label>Ubicar después de<select name="pos"><option value="">al final</option>${ps.map((x) => `<option value="${x.id}">${esc(x.nro)}</option>`).join('')}</select></label>` : ''}
      <label class="full">Observaciones<input type="text" name="obs" value="${esc(p.obs || '')}"></label></div>`,
    buttons: [...(nuevo ? [] : [['Eliminar', 'btn danger', () => 'del']]), ['Cancelar', 'btn', () => null], ['Guardar', 'btn pri', (box) => {
      const g = (n) => ($(`[name=${n}]`, box) || {}).value;
      if (!g('nro').trim()) { toast('Poné el número del piquete', { err: true }); return false; }
      Object.assign(p, { nro: g('nro').trim(), tipo: g('tipo'), vano: g('vano') === '' ? '' : Number(g('vano')), obs: g('obs').trim() });
      return { pos: g('pos') };
    }]],
  });
  if (res === 'del') {
    if (!(await confirmar('Eliminar piquete', `¿Eliminar el piquete ${esc(p.nro)} y su avance?`, 'Eliminar', 'btn danger'))) return;
    L.cfg.piquetes = ps.filter((x) => x !== p); Object.keys(L.av).forEach((k) => { if (k.endsWith('|' + p.id)) delete L.av[k]; }); commit(`Piquete ${p.nro} eliminado`);
  } else if (res) {
    if (nuevo) { const i = res.pos ? ps.findIndex((x) => x.id === res.pos) + 1 : ps.length; ps.splice(i, 0, p); }
    commit(`Piquete ${p.nro} guardado`);
  }
}
async function editEtapasLMT() {
  const L = lmtS(), ets = lmtEt().map((e) => ({ ...e }));
  const fila = (e, i) => `<div class="etrow" data-k="${e.k}" style="display:grid;grid-template-columns:26px 1fr 150px 30px;gap:6px;align-items:center;margin-bottom:6px"><span class="muted">${i + 1}</span><input type="text" class="etn" value="${esc(e.n)}"><select class="eta">${Object.entries(LMT_AMB).map(([a, t]) => `<option value="${a}" ${e.a === a ? 'selected' : ''}>${t}</option>`).join('')}</select><button class="btn sm ghost etx" title="Quitar">✕</button></div>`;
  const pm = modal({
    title: 'Etapas de la línea aérea', sub: 'Nombre y ámbito de cada etapa, en orden. Quitar una etapa borra su avance.',
    body: `<div id="etList">${ets.map(fila).join('')}</div><button class="btn sm" id="etAdd">+ Agregar etapa</button><button class="btn sm ghost" id="etDef" style="margin-left:6px">Volver a las propuestas</button>`,
    buttons: [['Cancelar', 'btn', () => null], ['Guardar', 'btn pri', (box) => {
      const out = $$('.etrow', box).map((r) => ({ k: r.dataset.k, n: $('.etn', r).value.trim(), a: $('.eta', r).value })).filter((e) => e.n);
      if (!out.length) { toast('Dejá al menos una etapa', { err: true }); return false; }
      return out;
    }]],
  });
  const box = $('#modal .mbox'), list = $('#etList', box);
  const bindX = () => $$('.etx', list).forEach((b) => { b.onclick = () => b.closest('.etrow').remove(); });
  bindX();
  $('#etAdd', box).onclick = () => { list.insertAdjacentHTML('beforeend', fila({ k: uid('et'), n: '', a: 'piquete' }, $$('.etrow', list).length)); bindX(); $$('.etn', list).pop().focus(); };
  $('#etDef', box).onclick = () => { list.innerHTML = LMT_ETAPAS_DEF.map(fila).join(''); bindX(); };
  const res = await pm;
  if (!res) return;
  const ks = new Set(res.map((e) => e.k));
  Object.keys(L.av).forEach((k) => { if (!ks.has(k.split('|')[0])) delete L.av[k]; });
  L.cfg.etapas = res; commit('Etapas de la línea aérea actualizadas');
}
async function exportLMT() {
  const wb = XLSX.utils.book_new(), ets = lmtEt(), ps = lmtPq(), I = lmtInfo();
  const est = (v) => (v.ok ? 'Terminada' : v.ini ? 'En curso' : '');
  const a = [['Piquete', 'Tipo', 'Vano (m)', ...ets.filter((e) => e.a !== 'linea').flatMap((e) => [e.n, 'Inicio', 'Fin']), 'Observaciones']];
  ps.forEach((p, i) => a.push([p.nro, p.tipo || '', i < ps.length - 1 ? p.vano || '' : '', ...ets.filter((e) => e.a !== 'linea').flatMap((e) => { if (e.a === 'vano' && i === ps.length - 1) return ['–', '', '']; const v = lmtAv(e.k, p.id); return [est(v), v.ini || '', v.ok ? v.fin || '' : '']; }), p.obs || '']));
  const ws = XLSX.utils.aoa_to_sheet(a); ws['!cols'] = [10, 12, 9, ...ets.filter((e) => e.a !== 'linea').flatMap(() => [16, 11, 11]), 30].map((w) => ({ wch: w })); XLSX.utils.book_append_sheet(wb, ws, 'Por piquete');
  const b = [['Etapa', 'Ámbito', 'Terminadas', 'En curso', 'Total', 'Avance %']]; I.ets.forEach((x) => b.push([x.e.n, LMT_AMB[x.e.a], x.ok, x.cur, x.n, Math.round(x.p * 1000) / 10]));
  b.push([]); b.push(['Avance general %', '', '', '', '', Math.round(I.p * 1000) / 10]); b.push(['Largo de la línea (m)', '', '', '', '', I.largo]);
  lmtEt().filter((e) => e.a === 'linea').forEach((e) => { const v = lmtAv(e.k, 'L'); b.push([e.n, 'Toda la línea', est(v), v.ini || '', v.ok ? v.fin || '' : '', v.obs || '']); });
  const w2 = XLSX.utils.aoa_to_sheet(b); w2['!cols'] = [44, 14, 12, 12, 12, 12].map((w) => ({ wch: w })); XLSX.utils.book_append_sheet(wb, w2, 'Avance por etapa');
  const p = await window.api.saveBinary(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }), `Linea aerea MT ${today()}.xlsx`, 'xlsx', 'Excel');
  if (p) toast('Excel exportado', { action: ['Abrir', () => window.api.openPath(p)] });
}
function printLMT() {
  const I = lmtInfo(), ps = lmtPq(), cols = lmtEt().filter((e) => e.a !== 'linea');
  let h = prHead('Línea aérea de media tensión · avance por etapa') + `<div class="card"><p style="margin:0 0 8px">Avance general <b>${fmt(I.p * 100, 1)} %</b> · ${I.nP} piquetes · ${fmt(I.largo)} m</p>${Charts.hbars(I.ets.map((x) => ({ label: x.e.n.length > 50 ? x.e.n.slice(0, 49) + '…' : x.e.n, right: `${x.ok}/${x.n}`, parts: [{ v: x.ok, color: FCOL.done, name: 'Terminado' }, { v: x.cur, color: FCOL.curso, name: 'En curso' }, { v: x.n - x.ok - x.cur, color: FCOL.pend, name: 'Pendiente' }] })), { labelW: 320, rightW: 60 })}</div>
    <div class="card"><table class="tbl maqpr"><thead><tr><th>Piquete</th><th>Tipo</th>${cols.map((e, i) => `<th>${i + 1}</th>`).join('')}</tr></thead><tbody>${ps.map((p, i) => `<tr><td><b>${esc(p.nro)}</b></td><td>${esc(p.tipo || '')}</td>${cols.map((e) => { if (e.a === 'vano' && i === ps.length - 1) return '<td>–</td>'; const v = lmtAv(e.k, p.id); return `<td>${v.ok ? fechaCorta(v.fin || v.ini).slice(0, 5) : v.ini ? 'en curso' : ''}</td>`; }).join('')}</tr>`).join('')}</tbody></table>
    <p class="muted" style="font-size:7.5pt;margin:6px 0 0">${cols.map((e, i) => `${i + 1}. ${esc(e.n)}${e.a === 'vano' ? ' (vano al piquete siguiente)' : ''}`).join(' · ')} · fecha = terminada</p></div>`;
  printHTML(h, `Linea aerea MT ${today()}.pdf`, true);
}
// tarjeta del Inicio y bloque del Avance
function lmtModHTML() {
  if (!lmtPq().length) return '';
  const I = lmtInfo();
  const fila = (x) => `<div class="mrow"><span>${esc(x.e.n.split(' (')[0])}</span><div class="sbt"><div style="width:${(x.p * 100).toFixed(1)}%;background:#2f6fc2"></div></div><b>${x.ok}/${x.n}</b></div>`;
  return `<div class="card mcard" data-go="lmt" title="Ver detalle de la línea aérea"><div class="mh"><div>${Charts.ring(I.p, '#2f6fc2', 'línea')}</div><div><h3>Línea aérea de MT</h3><div class="muted">${I.nP} piquetes · ${fmt(I.largo)} m</div></div></div>${I.ets.slice(0, 6).map(fila).join('')}${I.ets.length > 6 ? `<div class="muted" style="margin-top:4px">+ ${I.ets.length - 6} etapas más</div>` : ''}</div>`;
}
function lmtAvanceHTML() {
  if (!lmtPq().length) return '';
  const I = lmtInfo();
  return `<h2 class="sech">Línea aérea de MT</h2><div class="grid g2 stagger" style="margin-bottom:16px"><div class="card tile"><div>${Charts.ring(I.p, '#2f6fc2', 'avance')}</div><div><h3 style="margin-bottom:6px">Línea aérea parque → ET</h3>
    <div class="kpis k1" style="gap:6px">${kpi('Piquetes', I.nP, 'u', 0)}${kpi('Largo', I.largo, 'm')}</div></div></div>
    <div class="card"><h3>Avance por etapa</h3>${Charts.hbars(I.ets.map((x) => ({ label: x.e.n.length > 40 ? x.e.n.slice(0, 39) + '…' : x.e.n, right: `${x.ok}/${x.n}`, parts: [{ v: x.ok, color: FCOL.done, name: 'Terminado' }, { v: x.cur, color: FCOL.curso, name: 'En curso' }, { v: x.n - x.ok - x.cur, color: FCOL.pend, name: 'Pendiente' }] })), { labelW: 260, rightW: 60 })}${Charts.legend([[FCOL.done, 'Terminado'], [FCOL.curso, 'En curso'], [FCOL.pend, 'Pendiente']])}</div></div>`;
}
