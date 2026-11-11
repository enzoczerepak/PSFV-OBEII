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
  const largo = lmtPq().slice(0, -1).reduce((a, x) => a + (Number(x.vano) || 0), 0);
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
  const G = lmtGeo(), adic = Number(L.cfg.adic) || 0, base = G.completo ? G.cond : I.largo, nec = base * 3 * (1 + adic / 100);
  let h = `<div class="grid g3" style="margin-bottom:14px;align-items:stretch">
    <div class="card tile"><div>${Charts.ring(I.p, '#2f6fc2', 'avance')}</div><div><h3 style="margin-bottom:6px">Línea aérea de MT</h3>
      <div class="kpis k1" style="gap:6px">${kpi('Piquetes', I.nP, 'u', 0)}${kpi('Largo de la línea', I.largo, 'm')}</div><div class="muted" style="margin-top:6px">${ets.length} etapas · cada etapa pesa lo mismo en el avance</div></div></div>
    <div class="card"><h3>Etapas de toda la línea</h3>${lin.length ? lin.map((e) => { const v = lmtAv(e.k, 'L'); return `<div class="zrow" style="align-items:center"><span>${esc(e.n)}</span>${v.ok ? `<span class="pill p-done">terminada ${fechaCorta(v.fin || v.ini)}</span>` : v.ini ? `<span class="pill p-warn">en curso desde ${fechaCorta(v.ini)}</span>` : '<span class="pill p-prov">pendiente</span>'}${ro ? '' : ` <button class="btn sm ghost" data-le="${e.k}">✎</button>`}</div>`; }).join('') : '<span class="muted">Sin etapas de línea</span>'}</div>
    <div class="card"><h3>Conductor Prysalac</h3><div class="kpis k2">${kpi('En bobinas', stock, 'm')}${kpi('Necesario', nec, 'm')}</div>
      <div class="muted" style="margin-top:6px;font-size:12px">${bLA.length} bobina${bLA.length === 1 ? '' : 's'} (${fmt(ent)} m ingresados) · necesario = ${G.completo ? 'conductor con flecha (altimetría)' : 'largo'} × 3 fases${ro ? ` + ${fmt(adic)} %` : ` + <input type="number" id="lmAdic" value="${adic}" min="0" step="0.5" style="width:56px;padding:2px 4px"> %`}${I.largo && stock < nec ? ` · <b style="color:var(--bad)">faltan ${fmt(nec - stock)} m</b>` : ''}</div></div></div>
    <div class="card" style="margin-bottom:14px"><h3>Avance por etapa</h3>${Charts.hbars(I.ets.map((x) => ({ label: x.e.n.length > 44 ? x.e.n.slice(0, 43) + '…' : x.e.n, right: `${x.ok}/${x.n} ${x.e.a === 'linea' ? '' : x.e.a === 'vano' ? 'vanos' : 'piquetes'}`, parts: [{ v: x.ok, color: FCOL.done, name: 'Terminado' }, { v: x.cur, color: FCOL.curso, name: 'En curso' }, { v: x.n - x.ok - x.cur, color: FCOL.pend, name: 'Pendiente' }] })), { labelW: 330, rightW: 110, W: 1240, unit: 'u' })}
      ${Charts.legend([[FCOL.done, 'Terminado'], [FCOL.curso, 'En curso'], [FCOL.pend, 'Pendiente']])}</div>`;
  h += lmtAltHTML(ro);
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
  el.innerHTML = h; Charts.bindTips(el); bindLmtAlt(el);
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
  const G = lmtGeo();
  if (G.nAlt) {
    const c = [['Piquete', 'Progresiva (m)', 'Cota terreno (m)', 'Altura amarre (m)', 'Vano al siguiente', 'Horizontal (m)', 'Desnivel terreno (m)', 'Pendiente %', 'Desnivel amarres (m)', 'Inclinado (m)', 'Flecha (m)', 'Conductor por fase (m)', 'Gálibo mín. (m)']];
    const r2 = (x) => (x == null || !isFinite(x) ? '' : Math.round(x * 100) / 100);
    ps.forEach((p, i) => { const v = G.vanos[i]; c.push([p.nro, r2(numO(p.prog)), r2(numO(p.cota)), r2(numO(p.alt) ?? G.A.altDef), v ? `${p.nro} → ${v.b.nro}` : '', r2(v && v.S), ...(v && v.conAlt ? [r2(v.dz), r2(v.pend), r2(v.h), r2(v.C), r2(v.f), r2(v.L), r2(v.gal)] : [])]); });
    c.push([]); c.push(['Totales', '', '', '', '', r2(G.largoH), '', '', '', r2(G.largoC), '', r2(G.cond)]); c.push(['Conductor 3 fases + adicional (m)', '', '', '', '', '', '', '', '', '', '', r2(G.cond * 3 * (1 + (Number(lmtS().cfg.adic) || 0) / 100))]);
    c.push(['Flecha supuesta % del vano', G.A.flecha]); c.push(['Gálibo mínimo exigido (m)', G.A.galibo]);
    const w3 = XLSX.utils.aoa_to_sheet(c); w3['!cols'] = [12, 13, 13, 13, 16, 12, 14, 11, 15, 12, 10, 18, 13].map((w) => ({ wch: w })); XLSX.utils.book_append_sheet(wb, w3, 'Altimetría');
  }
  const p = await window.api.saveBinary(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }), `Linea aerea MT ${today()}.xlsx`, 'xlsx', 'Excel');
  if (p) toast('Excel exportado', { action: ['Abrir', () => window.api.openPath(p)] });
}
function printLMT() {
  const I = lmtInfo(), ps = lmtPq(), cols = lmtEt().filter((e) => e.a !== 'linea');
  let h = prHead('Línea aérea de media tensión · avance por etapa') + `<div class="card"><p style="margin:0 0 8px">Avance general <b>${fmt(I.p * 100, 1)} %</b> · ${I.nP} piquetes · ${fmt(I.largo)} m</p>${Charts.hbars(I.ets.map((x) => ({ label: x.e.n.length > 50 ? x.e.n.slice(0, 49) + '…' : x.e.n, right: `${x.ok}/${x.n}`, parts: [{ v: x.ok, color: FCOL.done, name: 'Terminado' }, { v: x.cur, color: FCOL.curso, name: 'En curso' }, { v: x.n - x.ok - x.cur, color: FCOL.pend, name: 'Pendiente' }] })), { labelW: 320, rightW: 60 })}</div>
    <div class="card"><table class="tbl maqpr"><thead><tr><th>Piquete</th><th>Tipo</th>${cols.map((e, i) => `<th>${i + 1}</th>`).join('')}</tr></thead><tbody>${ps.map((p, i) => `<tr><td><b>${esc(p.nro)}</b></td><td>${esc(p.tipo || '')}</td>${cols.map((e) => { if (e.a === 'vano' && i === ps.length - 1) return '<td>–</td>'; const v = lmtAv(e.k, p.id); return `<td>${v.ok ? fechaCorta(v.fin || v.ini).slice(0, 5) : v.ini ? 'en curso' : ''}</td>`; }).join('')}</tr>`).join('')}</tbody></table>
    <p class="muted" style="font-size:7.5pt;margin:6px 0 0">${cols.map((e, i) => `${i + 1}. ${esc(e.n)}${e.a === 'vano' ? ' (vano al piquete siguiente)' : ''}`).join(' · ')} · fecha = terminada</p></div>`;
  const G = lmtGeo();
  if (G.nAlt) h += `<div class="card" style="page-break-before:always"><h3>Perfil longitudinal y cálculos</h3><p style="margin:0 0 6px">Largo horizontal <b>${fmt(G.largoH, 1)} m</b> · inclinado <b>${fmt(G.largoC, 1)} m</b> · conductor por fase <b>${fmt(G.cond, 1)} m</b> · flecha ${fmt(G.A.flecha, 1)} % · gálibo mínimo exigido ${fmt(G.A.galibo, 1)} m</p>${lmtPerfilSVG(1000, 260)}
    <table class="tbl maqpr" style="margin-top:8px"><thead><tr><th>Vano</th><th>Horiz. (m)</th><th>Desn. terreno</th><th>Pend.</th><th>Inclinado</th><th>Flecha</th><th>Conductor</th><th>Gálibo</th></tr></thead><tbody>${G.vanos.map((v) => `<tr><td><b>${esc(v.a.nro)} → ${esc(v.b.nro)}</b></td><td>${v.S ? fmt(v.S, 1) : '–'}</td>${v.conAlt ? `<td>${fmt(v.dz, 2)}</td><td>${fmt(v.pend, 1)} %</td><td>${fmt(v.C, 2)}</td><td>${fmt(v.f, 2)}</td><td>${fmt(v.L, 2)}</td><td${v.gal < G.A.galibo ? ' style="color:#c00;font-weight:700"' : ''}>${fmt(v.gal, 2)}</td>` : '<td colspan="6">sin altimetría</td>'}</tr>`).join('')}</tbody></table></div>`;
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

/* ---------- Altimetría de la línea ----------
   Cada piquete puede tener progresiva (m), cota del terreno (m) y altura de amarre del conductor sobre el terreno (m).
   cfg.perfil = [{prog, cota}] son puntos intermedios del terreno (del plano de altimetría) para controlar el gálibo.
   cfg.flecha = flecha en % del vano · cfg.galibo = distancia mínima conductor-terreno (m) · cfg.altDef = altura de amarre por defecto · cfg.plano = {archivo, nombre} */
const numO = (v) => (v === '' || v == null || isNaN(Number(v)) ? null : Number(v));
const lmtAltCfg = () => { const c = lmtS().cfg; return { flecha: numO(c.flecha) ?? 2, galibo: numO(c.galibo) ?? 6, altDef: numO(c.altDef) ?? 9, perfil: c.perfil || [] }; };
// geometría de cada vano a partir de progresivas y cotas
function lmtGeo() {
  const ps = lmtPq(), A = lmtAltCfg(), vanos = [];
  const cota = (p) => numO(p.cota), prog = (p) => numO(p.prog), alt = (p) => numO(p.alt) ?? A.altDef;
  for (let i = 0; i < ps.length - 1; i++) {
    const a = ps[i], b = ps[i + 1];
    const S = prog(a) != null && prog(b) != null ? Math.abs(prog(b) - prog(a)) : numO(a.vano);
    const v = { a, b, i, S, conAlt: false };
    if (S && cota(a) != null && cota(b) != null) {
      const yA = cota(a) + alt(a), yB = cota(b) + alt(b), h = yB - yA, C = Math.sqrt(S * S + h * h), f = (S * A.flecha) / 100;
      Object.assign(v, { conAlt: true, dz: cota(b) - cota(a), pend: ((cota(b) - cota(a)) / S) * 100, h, C, f, L: C + (8 * f * f) / (3 * C), yA, yB });
      // gálibo: conductor (parábola) contra el terreno (piquetes + puntos intermedios), cada metro
      if (prog(a) != null && prog(b) != null) {
        const x0 = Math.min(prog(a), prog(b)), dir = prog(b) >= prog(a) ? 1 : -1;
        const pts = [{ prog: prog(a), cota: cota(a) }, { prog: prog(b), cota: cota(b) }, ...A.perfil.filter((q) => q.prog > x0 && q.prog < x0 + S)].sort((m, n) => m.prog - n.prog);
        const terr = (x) => { for (let j = 0; j < pts.length - 1; j++) if (x >= pts[j].prog && x <= pts[j + 1].prog) { const t = (x - pts[j].prog) / (pts[j + 1].prog - pts[j].prog || 1); return pts[j].cota + t * (pts[j + 1].cota - pts[j].cota); } return pts[pts.length - 1].cota; };
        let gal = Infinity, gx = 0;
        for (let k = 0; k <= Math.ceil(S); k++) { const x = Math.min(k, S), X = prog(a) + dir * x, y = yA + (h * x) / S - (4 * f * x * (S - x)) / (S * S), g = y - terr(X); if (g < gal) { gal = g; gx = X; } }
        Object.assign(v, { gal, galProg: gx, intermedios: pts.length - 2 });
      } else { const g = (yA + yB) / 2 - f - (cota(a) + cota(b)) / 2; Object.assign(v, { gal: g, galProg: null, intermedios: 0 }); }
    }
    vanos.push(v);
  }
  const conA = vanos.filter((v) => v.conAlt);
  return { vanos, A, completo: vanos.length > 0 && conA.length === vanos.length, nAlt: conA.length, largoH: vanos.reduce((s, v) => s + (v.S || 0), 0), largoC: conA.reduce((s, v) => s + v.C, 0), cond: conA.reduce((s, v) => s + v.L, 0), bajos: conA.filter((v) => v.gal != null && v.gal < A.galibo) };
}
// perfil longitudinal en SVG: terreno, postes y conductor
function lmtPerfilSVG(W = 1200, H = 300) {
  const G = lmtGeo(), ps = lmtPq().filter((p) => numO(p.prog) != null && numO(p.cota) != null);
  if (ps.length < 2) return '';
  const A = G.A, alt = (p) => numO(p.alt) ?? A.altDef;
  const terr = [...ps.map((p) => ({ prog: +p.prog, cota: +p.cota })), ...A.perfil].sort((a, b) => a.prog - b.prog);
  const x0 = Math.min(...terr.map((t) => t.prog)), x1 = Math.max(...terr.map((t) => t.prog));
  const yMin = Math.min(...terr.map((t) => t.cota)) - 3, yMax = Math.max(...ps.map((p) => +p.cota + alt(p))) + 4;
  const L = 54, Rr = 14, T = 16, B = 40, sx = (x) => L + ((x - x0) / (x1 - x0 || 1)) * (W - L - Rr), sy = (y) => T + (1 - (y - yMin) / (yMax - yMin || 1)) * (H - T - B);
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px;display:block;font-family:Arial,sans-serif" xmlns="http://www.w3.org/2000/svg">`;
  // grilla de cotas
  const paso = [1, 2, 5, 10, 20, 50].find((p) => (yMax - yMin) / p <= 6) || 100;
  for (let y = Math.ceil(yMin / paso) * paso; y <= yMax; y += paso) s += `<line x1="${L}" x2="${W - Rr}" y1="${sy(y)}" y2="${sy(y)}" stroke="#e6ebf2"/><text x="${L - 6}" y="${sy(y) + 4}" font-size="11" text-anchor="end" fill="#7a8aa3">${fmt(y)}</text>`;
  s += `<text x="12" y="${T + 6}" font-size="11" fill="#7a8aa3">cota (m)</text>`;
  s += `<polygon points="${sx(x0)},${sy(yMin)} ${terr.map((t) => `${sx(t.prog)},${sy(t.cota)}`).join(' ')} ${sx(x1)},${sy(yMin)}" fill="#efe6d6"/><polyline points="${terr.map((t) => `${sx(t.prog)},${sy(t.cota)}`).join(' ')}" fill="none" stroke="#a07e4a" stroke-width="1.6"/>`;
  G.vanos.filter((v) => v.conAlt && numO(v.a.prog) != null && numO(v.b.prog) != null).forEach((v) => {
    const pa = +v.a.prog, dir = +v.b.prog >= pa ? 1 : -1, n = 24, pts = [];
    for (let k = 0; k <= n; k++) { const x = (v.S * k) / n; pts.push(`${sx(pa + dir * x)},${sy(v.yA + (v.h * x) / v.S - (4 * v.f * x * (v.S - x)) / (v.S * v.S))}`); }
    const bajo = v.gal < A.galibo;
    s += `<polyline points="${pts.join(' ')}" fill="none" stroke="${bajo ? '#d64545' : '#2f6fc2'}" stroke-width="1.8"/>`;
    if (bajo && v.galProg != null) s += `<circle cx="${sx(v.galProg)}" cy="${sy(v.yA + (v.h * Math.abs(v.galProg - pa)) / v.S - (4 * v.f * Math.abs(v.galProg - pa) * (v.S - Math.abs(v.galProg - pa))) / (v.S * v.S))}" r="4" fill="#d64545"><title>Gálibo ${fmt(v.gal, 2)} m (mínimo ${fmt(A.galibo, 1)} m)</title></circle>`;
  });
  ps.forEach((p) => { const x = sx(+p.prog); s += `<line x1="${x}" x2="${x}" y1="${sy(+p.cota)}" y2="${sy(+p.cota + alt(p))}" stroke="#333" stroke-width="2.4"/><text x="${x}" y="${H - 22}" font-size="11" text-anchor="middle" fill="#333" font-weight="700">${esc(p.nro)}</text><text x="${x}" y="${H - 8}" font-size="10" text-anchor="middle" fill="#7a8aa3">${fmt(+p.prog)}</text>`; });
  return s + '</svg>';
}
function lmtAltHTML(ro) {
  const c = lmtS().cfg, G = lmtGeo(), A = G.A, pl = c.plano;
  const btns = ro ? '' : `<button class="btn sm" id="laEd">Editar altimetría</button> <button class="btn sm" id="laImp">Importar Excel…</button> <button class="btn sm ghost" id="laPl">${pl ? 'Cambiar plano' : 'Cargar plano'}</button>`;
  let h = `<div class="card" style="margin-bottom:14px"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><h3 style="margin:0">Altimetría y cálculos</h3><span class="sp" style="flex:1"></span>
    ${pl ? `<span class="muted">Plano: <a href="#" id="laAbr">${esc(pl.nombre)}</a></span>` : '<span class="muted">Sin plano de altimetría</span>'} ${btns}</div>`;
  if (!G.nAlt) return h + `<p class="muted" style="margin:10px 0 0">Cargá la progresiva y la cota de cada piquete (a mano o desde un Excel con columnas <b>Piquete, Progresiva, Cota, Altura</b>) para calcular vanos reales, desniveles, largo del conductor con flecha y gálibo sobre el terreno. Las filas del Excel sin piquete se toman como puntos intermedios del terreno.</p></div>`;
  h += `<div class="kpis k4" style="margin:12px 0">${kpi('Largo horizontal', G.largoH, 'm')}${kpi('Largo inclinado', G.largoC, 'm')}${kpi('Conductor por fase', G.cond, 'm')}${kpi('Gálibo mínimo', Math.min(...G.vanos.filter((v) => v.conAlt).map((v) => v.gal)), 'm', 2)}</div>
    ${G.completo ? '' : `<div class="alert" style="display:block;margin-bottom:8px">Faltan datos de altimetría en ${G.vanos.length - G.nAlt} vano${G.vanos.length - G.nAlt === 1 ? '' : 's'}: los totales cubren solo los vanos completos.</div>`}
    ${G.bajos.length ? `<div class="alert" style="display:block;margin-bottom:8px;border-color:#e3a5a5;background:#fdf0f0"><b>Gálibo por debajo de ${fmt(A.galibo, 1)} m</b> en ${G.bajos.map((v) => `${esc(v.a.nro)}→${esc(v.b.nro)} (${fmt(v.gal, 2)} m)`).join(', ')}.</div>` : ''}
    <div style="overflow-x:auto">${lmtPerfilSVG()}</div>
    <div class="tblwrap" style="margin-top:10px"><table class="tbl"><thead><tr><th>Vano</th><th class="n">Horizontal (m)</th><th class="n">Desnivel terreno (m)</th><th class="n">Pendiente</th><th class="n">Desnivel amarres (m)</th><th class="n">Inclinado (m)</th><th class="n">Flecha (m)</th><th class="n">Conductor (m)</th><th class="n">Gálibo mín. (m)</th></tr></thead><tbody>
    ${G.vanos.map((v) => `<tr><td><b>${esc(v.a.nro)} → ${esc(v.b.nro)}</b></td><td class="n">${v.S ? fmt(v.S, 1) : '–'}</td>${v.conAlt ? `<td class="n">${fmt(v.dz, 2)}</td><td class="n">${fmt(v.pend, 1)} %</td><td class="n">${fmt(v.h, 2)}</td><td class="n">${fmt(v.C, 2)}</td><td class="n">${fmt(v.f, 2)}</td><td class="n">${fmt(v.L, 2)}</td><td class="n" style="${v.gal < A.galibo ? 'color:var(--bad);font-weight:700' : ''}">${fmt(v.gal, 2)}${v.intermedios ? '' : ' <small class="muted">*</small>'}</td>` : '<td class="n muted" colspan="7">sin cota o progresiva</td>'}</tr>`).join('')}
    </tbody></table></div>
    <p class="hint">Flecha supuesta ${fmt(A.flecha, 1)} % del vano · altura de amarre por defecto ${fmt(A.altDef, 1)} m · conductor = vano inclinado + 8·f²/(3·vano), por fase. Gálibo: distancia vertical más chica entre el conductor (parábola) y el terreno${A.perfil.length ? ` (${A.perfil.length} puntos intermedios del perfil)` : ''}; * = sin puntos intermedios, se controla solo a mitad del vano contra la recta entre piquetes. Valores de anteproyecto: verificar con la flecha real de la tabla de tendido.</p></div>`;
  return h;
}
function bindLmtAlt(el) {
  const ab = $('#laAbr', el); if (ab) ab.onclick = async (e) => { e.preventDefault(); if (!window.api.lmtAbrirPlano || !(await window.api.lmtAbrirPlano(lmtS().cfg.plano.archivo))) toast('El plano está guardado en la PC donde se cargó', { err: true }); };
  if (window.READONLY) return;
  const pl = $('#laPl', el); if (pl) pl.onclick = async () => { if (!window.api.lmtPlano) return; const r = await window.api.lmtPlano(); if (r) { lmtS().cfg.plano = r; commit(`Plano de altimetría cargado: ${r.nombre}`); } };
  const ed = $('#laEd', el); if (ed) ed.onclick = editAltLMT;
  const im = $('#laImp', el); if (im) im.onclick = importAltLMT;
}
async function editAltLMT() {
  const L = lmtS(), ps = lmtPq(), A = lmtAltCfg(), v = (x) => (x == null || x === '' ? '' : x);
  const res = await modal({
    title: 'Altimetría de la línea', sub: 'Progresiva y cota del terreno de cada piquete, y altura de amarre del conductor (vacía = la de por defecto)', wide: true,
    body: `<div class="form" style="grid-template-columns:repeat(3,1fr)"><label>Flecha (% del vano)<input type="number" step="0.1" min="0" name="flecha" value="${A.flecha}"></label><label>Gálibo mínimo (m)<input type="number" step="0.1" min="0" name="galibo" value="${A.galibo}"></label><label>Altura de amarre por defecto (m)<input type="number" step="0.1" min="0" name="altDef" value="${A.altDef}"></label></div>
      <div class="tblwrap" style="max-height:52vh;margin-top:10px"><table class="tbl"><thead><tr><th>Piquete</th><th>Progresiva (m)</th><th>Cota terreno (m)</th><th>Altura amarre (m)</th></tr></thead><tbody>
      ${ps.map((p) => `<tr data-id="${p.id}"><td><b>${esc(p.nro)}</b></td><td><input type="number" step="0.01" class="ap" value="${v(p.prog)}"></td><td><input type="number" step="0.01" class="ac" value="${v(p.cota)}"></td><td><input type="number" step="0.01" class="aa" value="${v(p.alt)}" placeholder="${A.altDef}"></td></tr>`).join('')}</tbody></table></div>
      <p class="hint">Con progresivas cargadas, el vano de cada piquete se calcula solo. ${A.perfil.length ? `Hay ${A.perfil.length} puntos intermedios del terreno (se reemplazan importando otro Excel). <label style="display:inline"><input type="checkbox" name="borrPerf"> borrarlos</label>` : ''}</p>`,
    buttons: [['Cancelar', 'btn', () => null], ['Guardar', 'btn pri', (box) => ({
      cfg: Object.fromEntries(['flecha', 'galibo', 'altDef'].map((n) => [n, numO($(`[name=${n}]`, box).value)])), borr: !!($('[name=borrPerf]', box) || {}).checked,
      filas: $$('tbody tr[data-id]', box).map((r) => ({ id: r.dataset.id, prog: numO($('.ap', r).value), cota: numO($('.ac', r).value), alt: numO($('.aa', r).value) })),
    })]],
  });
  if (!res) return;
  Object.assign(L.cfg, res.cfg); if (res.borr) L.cfg.perfil = [];
  res.filas.forEach((f) => { const p = ps.find((x) => x.id === f.id); if (!p) return; ['prog', 'cota', 'alt'].forEach((k) => { if (f[k] == null) delete p[k]; else p[k] = f[k]; }); });
  lmtVanosDeProg(); commit('Altimetría de la línea actualizada');
}
// los vanos salen de las progresivas cuando las hay
function lmtVanosDeProg() { const ps = lmtPq(); ps.forEach((p, i) => { const q = ps[i + 1]; if (q && numO(p.prog) != null && numO(q.prog) != null) p.vano = Math.round(Math.abs(q.prog - p.prog) * 100) / 100; }); }
async function importAltLMT() {
  const f = await window.api.pickExcel(); if (!f) return;
  let rows;
  try { const wb = XLSX.read(new Uint8Array(f.data), { type: 'array' }); rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' }); } catch (e) { toast('No se pudo leer el archivo', { err: true }); return; }
  const nrm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const hi = rows.findIndex((r) => r.some((c) => /progres/.test(nrm(c))) && r.some((c) => /cota/.test(nrm(c))));
  if (hi < 0) { toast('No encontré las columnas Progresiva y Cota', { err: true }); return; }
  const hd = rows[hi].map(nrm), col = (re) => hd.findIndex((c) => re.test(c));
  const cP = col(/piq|poste|estruct|^pq|nro|numero/), cX = col(/progres/), cZ = col(/cota/), cA = col(/altura|amarre/);
  const num = (x) => { if (typeof x === 'number') return x; const s = String(x).trim().replace(/\s/g, ''); if (!s) return null; const m = /^(\d+)\+(\d+(?:[.,]\d+)?)$/.exec(s); if (m) return Number(m[1]) * 1000 + Number(m[2].replace(',', '.')); const n = Number(s.replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')); return isNaN(n) ? null : n; };
  const datos = rows.slice(hi + 1).map((r) => ({ nro: cP >= 0 ? String(r[cP]).trim() : '', prog: num(r[cX]), cota: num(r[cZ]), alt: cA >= 0 ? num(r[cA]) : null })).filter((d) => d.prog != null && d.cota != null);
  const ps = lmtPq(), key = (s) => nrm(s).replace(/[\s\-_.]/g, '');
  const conPq = datos.filter((d) => d.nro), perf = datos.filter((d) => !d.nro).map((d) => ({ prog: d.prog, cota: d.cota }));
  const match = conPq.filter((d) => ps.some((p) => key(p.nro) === key(d.nro))), nuevos = conPq.filter((d) => !ps.some((p) => key(p.nro) === key(d.nro)));
  const res = await modal({
    title: 'Importar altimetría', sub: esc(f.path.split(/[\\/]/).pop()),
    body: `<p>Encontré <b>${conPq.length}</b> piquetes con progresiva y cota${perf.length ? ` y <b>${perf.length}</b> puntos intermedios del terreno` : ''}.</p>
      <ul style="margin:0 0 8px 18px"><li>${match.length} coinciden con piquetes cargados y se actualizan</li>${nuevos.length ? `<li>${nuevos.length} no están en la línea (${nuevos.slice(0, 8).map((d) => esc(d.nro)).join(', ')}${nuevos.length > 8 ? '…' : ''})</li>` : ''}</ul>
      ${nuevos.length ? `<label><input type="checkbox" name="crear" ${ps.length ? '' : 'checked'}> Agregar los que faltan, ordenados por progresiva</label>` : ''}
      ${perf.length ? '<p class="hint">Los puntos intermedios reemplazan a los anteriores.</p>' : ''}`,
    buttons: [['Cancelar', 'btn', () => null], ['Importar', 'btn pri', (box) => ({ crear: !!($('[name=crear]', box) || {}).checked })]],
  });
  if (!res) return;
  const L = lmtS();
  match.forEach((d) => { const p = ps.find((x) => key(x.nro) === key(d.nro)); p.prog = d.prog; p.cota = d.cota; if (d.alt != null) p.alt = d.alt; });
  if (res.crear) nuevos.forEach((d) => ps.push({ id: uid('pq'), nro: d.nro, tipo: 'Suspensión', vano: '', prog: d.prog, cota: d.cota, ...(d.alt != null ? { alt: d.alt } : {}) }));
  // con todas las progresivas cargadas, la línea se ordena por progresiva
  if (ps.every((p) => numO(p.prog) != null)) { ps.sort((a, b) => a.prog - b.prog); ps.forEach((p, i) => { if (i === 0 || i === ps.length - 1) p.tipo = 'Terminal'; else if (p.tipo === 'Terminal') p.tipo = 'Suspensión'; }); }
  if (perf.length) L.cfg.perfil = perf.sort((a, b) => a.prog - b.prog);
  lmtVanosDeProg();
  commit(`Altimetría importada: ${match.length + (res.crear ? nuevos.length : 0)} piquetes${perf.length ? `, ${perf.length} puntos de terreno` : ''}`);
}
