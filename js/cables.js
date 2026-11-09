/* PSFV-OBE II · Plan de corte, circuitos y bobinas. */
// ======================= PLAN =======================
function vPlan(el, cat) {
  actions([...(cat !== 'PAT' ? [['Simular tendido', 'btn acc', () => simularTendido(cat)]] : []), ['Replanificar', 'btn ghost', () => replanificar(cat)], ['Exportar Excel', 'btn', exportExcel], ['PDF: solo listos', 'btn', () => printPlan(cat, 'listos')], ['PDF: plan completo', 'btn pri', () => printPlan(cat, 'todo')]]);
  const secs = R.resumen.filter((r) => r.cat === cat).map((r) => r.seccion);
  const fsec = ui.sec[cat] || 'all', fest = ui.est[cat] || 'all', q = (ui.q[cat] || '').toLowerCase();
  const cMap = new Map(R.circuitos.map((c) => [c.id, c]));
  let bobs = R.bobinas.filter((b) => b.cat === cat && (fsec === 'all' || String(b.seccion) === fsec));
  if (fest === 'listos') bobs = bobs.filter((b) => b.cortes.some((p) => p.estado === 'listo'));
  if (fest === 'abiertas') bobs = bobs.filter((b) => b.cortes.length);
  if (q) bobs = bobs.filter((b) => b.codigo.toLowerCase().includes(q) || String(b.nro).includes(q) ||
    b.cortes.some((p) => { const c = cMap.get(p.cid); return (c.designacion + ' ' + c.desde + ' ' + c.hasta).toLowerCase().includes(q); }));
  bobs.sort((a, b) => (b.consumoReal > 0) - (a.consumoReal > 0) || (b.asigListo > 0) - (a.asigListo > 0) || (b.cortes.length > 0) - (a.cortes.length > 0) || a.idx - b.idx);
  const falta = R.piezas.filter((p) => p.cat === cat && p.estado === 'falta' && (fsec === 'all' || String(p.seccion) === fsec));
  let h = `<div class="tools"><div class="seg" id="fSec"><button data-v="all">Todas</button>${secs.map((s) => `<button data-v="${s}">${s} mm²</button>`).join('')}</div>
    <div class="seg" id="fEst"><button data-v="all">Todas las bobinas</button><button data-v="abiertas">Con cortes</button><button data-v="listos">Con cortes listos</button></div>
    <span class="sp"></span><input type="search" id="fQ" placeholder="Buscar bobina o circuito…" value="${esc(ui.q[cat] || '')}" style="width:240px"></div>
    <div class="legend" style="margin:-4px 0 12px"><span><i class="c-done"></i>Ejecutado</span><span><i class="c-ready"></i>Listo para cortar (${cat === 'LA' ? 'postes listos' : 'zanja abierta'})</span><span><i class="c-prov"></i>Provisorio</span><span><i class="c-rem"></i>Remanente</span>${cat !== 'PAT' ? '<span class="lperm">Permitido: <b class="tl-ok">seguro</b> / <b class="tl-riesgo">máximo</b> por conductor (m)</span>' : ''}</div>
    <div id="mgStrip">${MG.R === R && MG.datos ? margenStrip(cat) : '<div class="mgs"><div class="mg muted">Calculando el margen disponible…</div></div>'}</div>`;
  if (falta.length) {
    const sinB = secs.filter((s) => !R.bobinas.some((b) => b.cat === cat && b.seccion === s));
    h += `<div class="alert ${sinB.length ? 'aviso' : 'error'}" style="margin-bottom:14px">${falta.length} conductores sin bobina (${fmt(falta.reduce((a, p) => a + p.len, 0))} m)${sinB.length ? ` · cargá las bobinas de ${sinB.map((s) => s + ' mm²').join(', ')} en Bobinas` : ''}</div>`;
  }
  h += `<div class="plan stagger">`;
  // largo permitido por conductor según el margen de la sección (seguro / máximo)
  const tolCol = cat !== 'PAT';
  const permTxt = (p, c) => {
    if (p.estado === 'ejecutado') { const t = Margen.tolerancia(mgDe(c.key), c.lenFase, tolF()); const nv = t ? Margen.nivel(t, p.len) : null; return nv ? `<span class="tl-${nv}" title="tirado ${fmt(p.len, 2)} m">${nv === 'ok' ? '✓' : nv === 'riesgo' ? 'riesgo' : 'excedido'}</span>` : ''; }
    const g = mgDe(c.key); if (!g) return '<span class="muted">…</span>';
    const t = Margen.tolerancia(g, p.len - (Number(S.params.margen) || 0), tolF()); if (!t) return '';
    if (t.sinMargen) return `<span class="tl-falta" title="Sin margen en la sección: no pasarse del plan">≤ ${fmt(p.len, 1)}</span>`;
    return `<span class="tl-ok" title="Seguro: hasta ${fmt(t.seg, 1)} m">${fmt(t.seg, 1)}</span> / <span class="tl-riesgo" title="Máximo (riesgo): hasta ${fmt(t.max, 1)} m">${fmt(t.max, 1)}</span>`;
  };
  bobs.forEach((b) => {
    const rem = Math.max(0, b.remanente);
    h += `<div class="bob"><header><div class="code">${esc(b.codigo)}</div><div class="meta">N° ${esc(b.nro)}<br>${b.seccion} mm² · ${fmt(b.entrada)} m</div><span class="pills2">${pill(b.estadoReal)}<span class="muted" title="Cómo queda al final del plan">al final: ${esc(b.estado)}</span></span></header>
      <div class="bar"><div class="c-done" data-w="${pct(b.consumoReal, b.entrada)}"></div><div class="c-ready" data-w="${pct(b.asigListo, b.entrada)}"></div><div class="c-prov" data-w="${pct(b.asigProv, b.entrada)}"></div><div class="c-rem" data-w="${pct(rem, b.entrada)}"></div></div>
      <div class="nums"><span>Saldo actual <b>${fmt(b.saldoActual, 1)} m</b></span><span>Listo <b>${fmt(b.asigListo, 1)}</b></span><span>Prov. <b>${fmt(b.asigProv, 1)}</b></span><span>Final <b>${fmt(b.remanente, 1)} m</b></span></div>`;
    if (!b.cortes.length) h += `<div class="closed">Sin cortes asignados: queda cerrada.</div>`;
    else {
      h += `<table><thead><tr><th>#</th><th>Circuito</th><th>Desde → Hasta</th><th>${cat === 'PAT' ? '' : 'Fase'}</th><th class="n" title="Largo de corte del conductor (en los ejecutados, lo tirado real)">${cat === 'PAT' ? 'Metros' : 'A tender'}</th>${tolCol ? '<th class="n" title="Largo máximo que se puede tirar: seguro / máximo (riesgo). Más que el máximo, falta cable al final.">Permitido</th>' : ''}<th class="n">Saldo</th></tr></thead><tbody>`;
      b.cortes.forEach((p) => { const c = cMap.get(p.cid); h += `<tr class="${p.estado} ${p.estado !== 'ejecutado' ? 'clk' : ''}" data-cid="${p.cid}" title="${p.estado}${p.manual ? ' · bobina elegida a mano' : ''}${p.estado !== 'ejecutado' ? ' · clic para elegir otra bobina o corregir el largo' : ''}"><td><span class="dot ${p.estado}"></span>${p.corte}${p.manual ? '<i class="pin">●</i>' : ''}</td><td class="mono">${esc(c.designacion)}</td><td>${esc(c.desde)} → ${esc(c.hasta)}</td><td>${p.fase === 'C' ? '' : p.fase}</td><td class="n">${fmt(p.len, 2)}</td>${tolCol ? `<td class="n tolc2">${permTxt(p, c)}</td>` : ''}<td class="n">${fmt(p.saldo, 1)}</td></tr>`; });
      h += `</tbody></table>`;
    }
    h += `</div>`;
  });
  if (!bobs.length) h += `<div class="empty"><b>${R.bobinas.some((b) => b.cat === cat) ? 'No hay bobinas con ese filtro' : 'Todavía no hay bobinas de ' + CATN[cat]}</b>${R.bobinas.some((b) => b.cat === cat) ? '' : 'Cargalas en la sección Bobinas (a mano o importando la planilla de control).'}</div>`;
  el.innerHTML = h + '</div>';
  $$('tr.clk', el).forEach((tr) => { tr.onclick = () => elegirBobina(tr.dataset.cid); });
  segBind('#fSec', fsec, (v) => { ui.sec[cat] = v; render(true); });

  segBind('#fEst', fest, (v) => { ui.est[cat] = v; render(true); });
  searchBind('#fQ', (v) => { ui.q[cat] = v; });
}

async function replanificar(cat) {
  if (window.READONLY) return;
  if (!(await confirmar('Replanificar', `Los cortes listos de ${CATN[cat]} se vuelven a asignar desde cero buscando el mejor aprovechamiento. Puede cambiar la bobina de cortes que ya figuran en una hoja de corte impresa. Lo ya tendido no se toca.`, 'Replanificar'))) return;
  const ids = new Set(S.circuitos.filter((c) => c.cat === cat).map((c) => c.id));
  Object.keys(S.compromiso || {}).forEach((k) => { if (ids.has(k.split('|')[0])) delete S.compromiso[k]; });
  commit(`Plan de ${CATN[cat]} recalculado`);
}

// ======================= CIRCUITOS =======================
function vCircuitos(el, cat) {
  const n = ui.sel.size ? ` (${ui.sel.size})` : '', dis = ui.sel.size ? '' : ' dis';
  const isPat = cat === 'PAT', isLA = cat === 'LA';
  if (isLA) actions([['+ Tramo', 'btn pri', () => editCircuito(null, cat)], [`Listo para tender${n}`, 'btn acc' + dis, () => habilitarLA(true)], [`Quitar habilitación${n}`, 'btn' + dis, () => habilitarLA(false)]]);
  else actions(isPat ? [] : [['Importar…', 'btn', () => menuImportar(cat)], ['+ Circuito', 'btn', () => editCircuito(null, cat)],
    [`Misma zanja${n}`, 'btn' + (ui.sel.size > 1 ? '' : ' dis'), () => unir(zidsSel())], [`Cerrar zanja${n}`, 'btn' + dis, () => bulkZanja('cerrada')], [`Abrir zanja${n}`, 'btn acc' + dis, () => bulkZanja('abierta')]]);
  const all = R.circuitos.filter((c) => c.cat === cat);
  const stss = [...new Set(all.map((c) => c.hasta))].sort();
  const ests = ['listo para tender', isLA ? 'en espera de postes' : 'en espera de zanja', 'tendido parcial', 'tendido', 'falta bobina'];
  const fsts = ui.sts[cat] || 'all', fce = ui.cest[cat] || 'all', zf = ui.zf[cat] || 'all', q = (ui.q['c' + cat] || '').toLowerCase();
  const list = all.filter((c) => (fsts === 'all' || c.hasta === fsts) && (fce === 'all' || c.estado === fce) && (zf === 'all' || c.zanja === zf)
    && (!q || `${c.designacion} ${c.desde} ${c.hasta}`.toLowerCase().includes(q)));
  let h = `<div class="tools"><select id="fSts"><option value="all">${cat === 'BT' ? 'Todos los STS' : 'Todos los destinos'}</option>${stss.map((s) => `<option>${esc(s)}</option>`).join('')}</select>
    <select id="fCE"><option value="all">Todos los estados</option>${ests.map((s) => `<option>${s}</option>`).join('')}</select>
    ${isLA ? '' : `<div class="seg" id="fZ"><button data-v="all">Toda zanja</button><button data-v="no abierta">No abierta</button><button data-v="abierta">Abierta</button><button data-v="cerrada">Cerrada</button></div>`}
    <span class="muted">${list.length} ${isPat ? 'tendidos' : isLA ? 'tramos' : 'circuitos'}</span><span class="sp"></span><input type="search" id="fCQ" placeholder="Buscar…" value="${esc(ui.q['c' + cat] || '')}" style="width:220px"></div>
    <div class="tblwrap"><table class="tbl"><thead><tr>${isPat ? '' : '<th><input type="checkbox" id="selAll"></th>'}<th>Designación</th><th>Desde</th><th>Hasta</th><th>Sección</th><th class="n">${isPat ? 'Largo' : cat === 'MT' || isLA ? 'm / conductor' : 'm / fase'}</th>
    <th>${isLA ? 'Postes' : 'Zanja'}</th><th>${isPat ? 'Bobina' : 'Conductores · bobina'}</th><th class="n">Real vs lista</th><th>Estado</th><th></th></tr></thead><tbody>`;
  list.forEach((c) => {
    h += `<tr data-id="${c.id}" class="${ui.sel.has(c.id) ? 'sel' : ''}">${isPat ? '' : `<td><input type="checkbox" class="sel" ${ui.sel.has(c.id) ? 'checked' : ''}></td>`}
      <td class="mono">${esc(c.designacion)}${c.obs ? ` <span title="${esc(c.obs)}">ⓘ</span>` : ''}</td><td>${esc(c.desde)}</td><td>${esc(c.hasta)}</td><td>${c.seccion ?? '?'}</td>
      <td class="n">${fmt(c.lenFase, 2)}</td><td>${isLA ? `<button class="pill ${c.habilitado ? 'p-ready' : 'p-prov'} pbtn" data-a="hab" title="Tocá para cambiar">${c.habilitado ? 'Listos' : 'Pendientes'}</button>` : isPat ? pill(c.zanja) : zSeg(c.zid, c.zanja, c.listoCerrar) + (c.compartida ? ` <span class="shr" title="Zanja compartida: ${esc(c.zTitulo)}">⫘</span>` : '')}</td><td>${phases(c)}</td><td class="n">${desv(c)}</td><td>${pill(c.estado)}</td>
      <td style="white-space:nowrap"><button class="btn sm acc" data-a="tender">Tender</button> <button class="btn sm" data-a="bob" title="Elegir bobina y corregir largo">Bobina / largo</button><button class="btn sm ghost" data-a="edit" title="Editar">✎</button></td></tr>`;
  });
  h += `</tbody></table>${list.length ? '' : '<div class="empty"><b>Sin resultados</b></div>'}</div>`;
  if (isPat) h += `<p class="hint">Cada zanja lleva un solo conductor de Cu desnudo (25 mm² en BT, 95 mm² en MT) con el largo de la zanja, aunque la compartan varios circuitos. El estado de zanja se toma del circuito. Con ✎ podés corregir el largo de un tendido de PAT.</p>`;
  el.innerHTML = h;
  $('#fSts').value = fsts; $('#fCE').value = fce;
  $('#fSts').onchange = (e) => { ui.sts[cat] = e.target.value; render(false); };
  $('#fCE').onchange = (e) => { ui.cest[cat] = e.target.value; render(false); };
  if (!isLA) segBind('#fZ', zf, (v) => { ui.zf[cat] = v; render(false); });
  searchBind('#fCQ', (v) => { ui.q['c' + cat] = v; });
  if (!isPat) { bindSel(el, list); if (!isLA) bindZSeg(el); }
  if (isLA) $$('[data-a=hab]', el).forEach((b) => { b.onclick = (e) => { e.stopPropagation(); const c = S.circuitos.find((x) => x.id === b.closest('tr').dataset.id); c.habilitado = !c.habilitado; commit(`${c.designacion}: ${c.habilitado ? 'listo para tender' : 'en espera de postes'}`); }; });
  $$('tbody tr', el).forEach((tr) => {
    const id = tr.dataset.id;
    tr.querySelector('[data-a=tender]').onclick = () => tender(id);
    tr.querySelector('[data-a=bob]').onclick = () => elegirBobina(id);
    tr.querySelector('[data-a=edit]').onclick = () => (isPat ? editPat(id) : editCircuito(id, cat));
    tr.ondblclick = (e) => { if (!e.target.closest('button,input')) tender(id); };
  });
}

async function elegirBobina(id) {
  if (window.READONLY) return;
  const c = S.circuitos.find((x) => x.id === id), rc = R.circuitos.find((x) => x.id === id);
  const bobs = R.bobinas.filter((b) => b.key === rc.key);
  if (!bobs.length) { toast(`No hay bobinas de ${CATN[rc.cat]} ${rc.seccion} mm² cargadas`, { err: true }); return; }
  const lista = Math.round((Number(c.cantidad) || 0) / rc.fz.length * 100) / 100;
  const aj = Number(((S.params.ajuste || {})[rc.cat]) || 0);
  const conAj = Math.round(lista * (1 + aj / 100) * 100) / 100;
  const asig = c.asig || {};
  const opts = (sel) => `<option value="">Automático (mejor aprovechamiento)</option>` + bobs.map((b) => `<option value="${esc(b.codigo)}" ${sel === b.codigo ? 'selected' : ''}>${esc(b.codigo)} · saldo actual ${fmt(b.saldoActual, 1)} m${b.estadoReal === 'en uso' ? ' · en uso' : b.estadoReal === 'sin abrir' ? ' · sin abrir' : ''}</option>`).join('');
  const rows = rc.fz.map((f) => { const r = (c.real || {})[f], p = rc.fasesInfo[f] || {};
    if (r && (r.bobina || r.sinBobina)) return `<div class="phase-row" style="grid-template-columns:56px 1fr 180px"><b>${f === "C" ? "Cu" : f}</b><span class="muted">Ya tendida desde ${esc(r.bobina || "(sin bobina)")} (${fmt(r.metros, 2)} m)</span><span></span></div>`;
    return `<div class="phase-row eb" data-f="${f}" style="grid-template-columns:56px 1fr 180px"><b>${f === 'C' ? 'Cu' : f}</b><select class="bob">${opts(asig[f] || '')}</select><span class="muted">plan actual: ${esc(p.bobina || '—')}${p.manual ? ' (elegida)' : ''}</span></div>`; }).join('');
  const res = await modal({ title: `Bobina y largo · ${c.designacion}`, sub: `${esc(c.desde)} → ${esc(c.hasta)} · ${esc(c.formacion)}`, wide: true,
    body: `<div class="form"><label>Largo a cortar por conductor (m)<input type="number" step="0.01" min="0" name="largo" value="${c.largoCorte || ''}" placeholder="${fmt(conAj, 2)}"></label>
      <label>Referencia<input type="text" disabled value="Lista ${fmt(lista, 2)} m${aj ? ` · con ajuste ${aj > 0 ? '+' : ''}${fmt(aj, 1)} % = ${fmt(conAj, 2)} m` : ''}"></label></div>
      <p class="hint">Vacío = largo de la lista (con el ajuste % del tipo, si hay). Cargá un valor si en campo este circuito necesita otro largo.</p>
      <h4 style="margin:14px 0 4px">Bobina por conductor</h4>
      ${rc.fz.length > 1 ? `<div class="phase-row" style="grid-template-columns:56px 1fr 180px"><span class="muted">Todas</span><select id="ebAll"><option value="-">— elegir para todas —</option>${opts('')}</select><span></span></div>` : ''}${rows}
      <p class="hint">Elegí una bobina solo en casos especiales (por ejemplo, para no mover bobinas en el campo). El resto del plan se recalcula completo para aprovechar mejor las demás bobinas.</p>`,
    buttons: [['Quitar elecciones', 'btn', () => 'clear'], ['Cancelar', 'btn', () => null], ['Guardar y recalcular', 'btn pri', (box) => {
      const a = {}; $$('.eb', box).forEach((row) => { const v = $('.bob', row).value; if (v) a[row.dataset.f] = v; });
      const l = Number($('[name=largo]', box).value);
      return { a, l };
    }]] });
  if (!res) return;
  if (res === 'clear') { delete c.asig; }
  else { if (Object.keys(res.a).length) c.asig = res.a; else delete c.asig; if (res.l > 0) c.largoCorte = Math.round(res.l * 100) / 100; else delete c.largoCorte; }
  recalcularTodo(rc.cat);
  ui.flash = [id];
  commit(res === 'clear' ? `${c.designacion}: vuelve a bobina automática · plan recalculado` : `${c.designacion} actualizado · plan recalculado`);
}
document.addEventListener('change', (e) => { if (e.target.id === 'ebAll' && e.target.value !== '-') { $$('.mbox .eb .bob').forEach((s2) => { s2.value = e.target.value; }); } });
// libera los compromisos de un tipo para que el plan se rearme completo (respetando lo tendido y lo elegido a mano)
function recalcularTodo(cat) {
  const ids = new Set(S.circuitos.filter((c) => c.cat === cat).map((c) => c.id));
  Object.keys(S.compromiso || {}).forEach((k) => { if (ids.has(k.split('|')[0])) delete S.compromiso[k]; });
}
function desv(c) {
  if (!c.teoTot) return '<span class="muted">–</span>';
  const pc = c.desvio / c.teoTot * 100, cls = Math.abs(c.desvio) < 0.005 ? '' : c.desvio > 0 ? 'pos' : 'neg';
  return `<span class="dv ${cls}" title="${fmt(c.realTot, 2)} m tirados vs ${fmt(c.teoTot, 2)} m de lista">${c.desvio > 0 ? '+' : ''}${fmt(c.desvio, 1)} m · ${c.desvio > 0 ? '+' : ''}${fmt(pc, 1)}%</span>`;
}
async function tender(id) {
  if (window.READONLY) return;
  const c = S.circuitos.find((x) => x.id === id), rc = R.circuitos.find((x) => x.id === id);
  const bobs = R.bobinas.filter((b) => b.key === rc.key);
  if (!bobs.length && rc.cat !== 'PAT') { toast(`No hay bobinas de ${CATN[rc.cat]} ${rc.seccion} mm² cargadas`, { err: true }); return; }
  const opts = (sel) => `<option value="">—</option>${rc.cat === 'PAT' ? `<option value="__sin" ${sel === '__sin' ? 'selected' : ''}>Sin bobina registrada</option>` : ''}` + bobs.map((b) => `<option value="${esc(b.codigo)}" ${sel === b.codigo ? 'selected' : ''}>${esc(b.codigo)} · saldo ${fmt(b.saldoActual, 1)} m</option>`).join('');
  const lbl = (f) => (f === 'C' ? 'Cu' : f);
  const teo = Math.round((Number(c.cantidad) || 0) / rc.fz.length * 100) / 100;
  const rows = rc.fz.map((f) => {
    const r = (c.real || {})[f], plan = rc.fasesInfo[f] || {}, done = !!(r && (r.bobina || r.sinBobina));
    return `<div class="phase-row pr6" data-f="${f}"><label class="fz"><input type="checkbox" class="on" ${done ? 'checked' : ''}> ${lbl(f)}</label>
      <select class="bob">${opts(done ? r.bobina || '__sin' : plan.bobina || '')}</select>
      <span class="teo">${fmt(teo, 2)}</span>
      <input type="number" class="m" step="0.01" min="0" value="${done ? r.metros : rc.lenFase}" title="Metros realmente tirados">
      <span class="dif"></span>
      <input type="date" class="d" value="${done ? r.fecha || '' : today()}"></div>`;
  }).join('');
  setTimeout(() => {
    const box = $('.mbox'); if (!box) return;
    const upd = () => {
      let tr = 0, tt = 0;
      $$('.phase-row', box).forEach((row) => {
        const m = Number($('.m', row).value) || 0, d = Math.round((m - teo) * 100) / 100, on = $('.on', row).checked;
        const el = $('.dif', row); el.textContent = (d > 0 ? '+' : '') + fmt(d, 2); el.className = 'dif ' + (Math.abs(d) < 0.005 ? '' : d > 0 ? 'pos' : 'neg');
        const nv = rc.cat !== 'PAT' && m > 0 ? Margen.nivel(Margen.tolerancia(mgDe(rc.key), rc.lenFase, tolF()), m) : null;
        $('.m', row).classList.remove('lv-ok', 'lv-riesgo', 'lv-falta'); if (nv) $('.m', row).classList.add('lv-' + nv);
        row.classList.toggle('off', !on); if (on) { tr += m; tt += teo; }
      });
      const d = tr - tt;
      $('#tTot', box).innerHTML = tt ? `Tildado: <b>${fmt(tr, 2)} m</b> tirados vs <b>${fmt(tt, 2)} m</b> de lista · diferencia <b class="${d > 0.005 ? 'pos' : d < -0.005 ? 'neg' : ''}">${d > 0 ? '+' : ''}${fmt(d, 2)} m (${d > 0 ? '+' : ''}${fmt(d / tt * 100, 1)} %)</b>` : '';
    };
    $$('.phase-row input', box).forEach((i) => { i.addEventListener('input', upd); i.addEventListener('change', upd); });
    upd();
  }, 30);
  const nAll = rc.fz.length;
  const res = await modal({
    title: `Registrar tendido · ${c.designacion}`, wide: true, sub: `${esc(c.desde)} → ${esc(c.hasta)} · ${esc(c.formacion)} · ${fmt(rc.lenFase, 2)} m por conductor · ${rc.cat === 'LA' ? (rc.listo ? 'postes listos' : 'postes pendientes') : 'zanja ' + rc.zanja}`,
    body: `<div class="muted pr6 prh"><span>${nAll === 1 ? 'Cond.' : 'Fase'}</span><span>Bobina usada</span><span>Lista</span><span>Tirado real</span><span>Dif.</span><span>Fecha</span></div>${rows}
      <div class="tot" id="tTot"></div>
      ${rc.cat !== 'PAT' ? `<div class="tolb" id="tolBox" data-key="${rc.key}" data-l="${rc.lenFase}">${tolHTML(mgDe(rc.key), rc.lenFase)}</div>` : ''}
      <p class="hint">Tildá lo que ya se tendió. Se propone la bobina del plan y el largo de la lista; cargá los metros realmente tirados y el saldo de la bobina se ajusta. La diferencia con la lista queda registrada para el seguimiento.</p>`,
    buttons: [['Borrar registro', 'btn danger', (box) => { $$('.on', box).forEach((x) => { x.checked = false; }); return save(box); }],
      ['Cancelar', 'btn', () => null], [nAll === 1 ? 'Marcar y guardar' : `Marcar ${nAll === 3 ? 'las 3' : 'todas'} y guardar`, 'btn', (box) => { $$('.on', box).forEach((x) => { x.checked = true; }); return save(box); }], ['Guardar', 'btn pri', (box) => save(box)]],
  });
  function save(box) {
    const real = {};
    for (const row of $$('.phase-row', box)) {
      if (!$('.on', row).checked) continue;
      const b = $('.bob', row).value, m = Number($('.m', row).value);
      if (!b) { toast(`${lbl(row.dataset.f)}: elegí la bobina`, { err: true }); return false; }
      const met = m > 0 ? Math.round(m * 100) / 100 : rc.cat === 'PAT' ? rc.lenFase : teo;
      real[row.dataset.f] = b === '__sin' ? { sinBobina: true, metros: met, fecha: $('.d', row).value } : { bobina: b, metros: met, fecha: $('.d', row).value };
    }
    c.real = real;
    return 'ok';
  }
  if (res === 'ok') {
    ui.flash = [id, c.vinculo || c.zanjaId];
    const zc = S.zanjas.find((z) => z.id === (c.vinculo || c.zanjaId));
    if (Object.keys(c.real).length && zc && zc.estado === 'no abierta') zc.estado = 'abierta';
    const antes = zc ? (R.zlist.find((z) => z.id === zc.id) || {}).completo : false;
    commit(`Tendido de ${c.designacion} actualizado`);
    // último circuito de la zanja: ofrecer cerrarla y registrar la PAT
    const rz = zc && !c.vinculo ? R.zlist.find((z) => z.id === zc.id) : null;
    if (rz && rz.completo && !antes && rz.estado !== 'cerrada') setTimeout(() => cerrarZanjas([rz.id], true), 350);
  }
}

async function editCircuito(id, cat) {
  if (window.READONLY) return;
  const nuevo = !id;
  const isLA = cat === 'LA' || (!nuevo && (S.circuitos.find((x) => x.id === id) || {}).cat === 'LA');
  const c = nuevo ? { id: uid('c'), cat, designacion: isLA ? 'LMT-' : '', desde: '', hasta: '', formacion: isLA ? 'Prysalac 120/20 mm² Al/Ac' : cat === 'MT' ? '1x50/25 mm² Al/Cu' : '1x240 mm² Al', fases: 3, cantidad: 0, lineal: 0, real: {} } : S.circuitos.find((x) => x.id === id);
  const rc = nuevo ? null : R.circuitos.find((x) => x.id === id);
  const res = await modal({
    title: nuevo ? `Nuevo circuito ${CATN[cat]}` : `Editar ${c.designacion}`, wide: true,
    body: `<div class="form"><label>Designación<input type="text" name="designacion" value="${esc(c.designacion)}"></label>
      <label>Formación<input type="text" name="formacion" ${isLA ? 'list="secOpcC"' : ''} value="${esc(c.formacion)}">${isLA ? `<datalist id="secOpcC">${Engine.PRYSALAC.map((p) => `<option value="Prysalac ${p.sec} mm² Al/Ac">`).join('')}</datalist>` : ''}</label>
      <label>Desde<input type="text" name="desde" value="${esc(c.desde)}"></label><label>Hasta<input type="text" name="hasta" value="${esc(c.hasta)}"></label>
      <label>Cantidad final (m, todos los conductores)<input type="number" step="0.01" name="cantidad" value="${c.cantidad}"></label>
      <label>Conductores (fases)<input type="number" name="fases" value="${c.fases || 3}" min="1" max="12"></label>
      <label>Longitud lineal (m)<input type="number" step="0.1" name="lineal" value="${c.lineal || 0}"></label>
      ${isLA ? `<label class="chk"><input type="checkbox" name="habilitado" ${c.habilitado ? 'checked' : ''}> Postes listos: habilitar el corte</label>` : `<label>Zanja<input type="text" disabled value="${rc ? esc(rc.zTitulo) + ' · ' + fmt(rc.zanjaLargo, 1) + ' m · ' + rc.zanja : 'propia (se crea al guardar)'}"></label>`}
      <label class="full">Observaciones<input type="text" name="obs" value="${esc(c.obs || '')}"></label></div>
      <p class="hint">${isLA ? 'Tramo de línea aérea (ej. entre retenciones). Cantidad final = largo de un conductor × conductores, con flecha y puentes incluidos; el ajuste % del tipo LA se suma en Ajustes. Sin zanja: se corta cuando el tramo tiene los postes listos.' : 'El estado, el largo y la PAT se manejan por zanja (sección Zanjas). Para que varios circuitos compartan zanja, tildalos y tocá "Misma zanja".'}</p>`,
    buttons: [...(nuevo ? [] : [['Eliminar', 'btn danger', () => 'del']]), ['Cancelar', 'btn', () => null], ['Guardar', 'btn pri', (box) => {
      const g = (n) => $(`[name=${n}]`, box).value;
      if (!g('designacion').trim() || !(Number(g('cantidad')) > 0)) { toast('Completá designación y cantidad', { err: true }); return false; }
      Object.assign(c, { designacion: g('designacion').trim(), formacion: g('formacion').trim(), desde: g('desde').trim(), hasta: g('hasta').trim(),
        cantidad: Number(g('cantidad')), fases: Number(g('fases')) || 3, lineal: Number(g('lineal')) || 0, obs: g('obs').trim() });
      if (isLA) c.habilitado = $('[name=habilitado]', box).checked; else if (nuevo) c.zanjaLargo = c.lineal;
      return 'ok';
    }]],
  });
  if (res === 'del') { if (await confirmar('Eliminar circuito', `¿Eliminar ${esc(c.designacion)} y su tendido de PAT?`, 'Eliminar')) { S.circuitos = S.circuitos.filter((x) => x !== c); commit('Circuito eliminado'); } }
  else if (res === 'ok') { if (nuevo) { c._o = Date.now(); S.circuitos.push(c); } commit('Circuito guardado'); }
}
// línea aérea: habilitar / quitar habilitación de corte de los tramos tildados
function habilitarLA(v) {
  const ids = [...ui.sel]; if (!ids.length) return;
  S.circuitos.forEach((c) => { if (ids.includes(c.id) && c.cat === 'LA') c.habilitado = v; });
  ui.sel.clear(); commit(`${ids.length} tramo${ids.length > 1 ? 's' : ''} ${v ? 'listo' + (ids.length > 1 ? 's' : '') + ' para tender' : 'en espera de postes'}`);
}
async function editPat(id) {
  if (window.READONLY) return;
  const c = S.circuitos.find((x) => x.id === id), base = R.zlist.find((x) => x.id === c.vinculo);
  const res = await modal({
    title: `Editar ${c.designacion}`, sub: `Zanja ${esc(base.titulo)} · ${fmt(base.largo, 1)} m`,
    body: `<div class="form"><label>Formación<input type="text" name="formacion" value="${esc(c.formacion)}"></label>
      <label>Largo (m) – vacío = largo de la zanja<input type="number" step="0.1" name="largo" value="${c.largoManual || ''}" placeholder="${base.largo}"></label></div>`,
    buttons: [['Cancelar', 'btn', () => null], ['Guardar', 'btn pri', (box) => {
      c.formacion = $('[name=formacion]', box).value.trim() || c.formacion;
      const l = Number($('[name=largo]', box).value); if (l > 0) c.largoManual = l; else delete c.largoManual; return 'ok';
    }]],
  });
  if (res === 'ok') commit('Tendido de PAT actualizado');
}

// ======================= BOBINAS =======================
// Stock consolidado por tipo y sección (para exportar)
function stockConsolidado() {
  const g = new Map();
  R.bobinas.forEach((b) => {
    const k = `${b.cat}|${b.seccion}`;
    if (!g.has(k)) g.set(k, { cat: b.cat, seccion: b.seccion, n: 0, sinAbrir: 0, enUso: 0, term: 0, entrada: 0, tendido: 0, saldo: 0, saldoSA: 0, saldoUso: 0, plan: 0, remUtil: 0, descarte: 0, falta: 0 });
    const f = g.get(k);
    f.n++; f.entrada += b.entrada; f.tendido += b.consumoReal; f.saldo += b.saldoActual; f.plan += b.asigListo + b.asigProv;
    if (b.estadoReal === 'sin abrir') { f.sinAbrir++; f.saldoSA += b.saldoActual; } else if (b.estadoReal === 'en uso') { f.enUso++; f.saldoUso += b.saldoActual; } else f.term++;
    if (b.estado === 'remanente útil') f.remUtil += b.remanente; else if (b.estado === 'descarte') f.descarte += b.remanente;
  });
  const orden = { BT: 0, MT: 1, PAT: 2, LA: 3 };
  const out = [...g.values()].sort((a, b) => (orden[a.cat] ?? 9) - (orden[b.cat] ?? 9) || a.seccion - b.seccion);
  out.forEach((f) => { const r = R.resumen.find((x) => x.cat === f.cat && x.seccion === f.seccion); f.falta = r ? r.faltante || 0 : 0; });
  return out;
}
// Cada corte del plan con su bobina, circuito y zanja (ejecutado / listo / provisorio)
const EST_CORTE = { ejecutado: 'Tendido', listo: 'Listo p/ cortar', provisorio: 'Provisorio' };
function cortesDetalle() {
  const cM = new Map(R.circuitos.map((c) => [c.id, c])), zM = new Map(R.zlist.map((z) => [z.id, z])), out = [];
  R.bobinas.forEach((b) => b.cortes.forEach((p) => { const c = cM.get(p.cid) || {}; const z = zM.get(c.zid) || null; out.push({ b, p, c, z, zt: z ? z.titulo : (c.zTitulo || '–'), zcat: z ? z.cat : (c.cat === 'PAT' ? '' : c.cat), ze: z ? z.estado : (c.zanja || '') }); }));
  const ordZ = (r) => (r.z && r.z.miembros.length ? Math.min(...r.z.miembros.map((x) => x.idx)) : 1e9);
  return out.sort((a, b) => (a.zcat || 'Z').localeCompare(b.zcat || 'Z') || ordZ(a) - ordZ(b) || a.zt.localeCompare(b.zt) || (a.c.idx ?? 0) - (b.c.idx ?? 0) || a.p.cat.localeCompare(b.p.cat));
}
// Resumen por zanja: circuitos, bobinas y metros por estado
function stockPorZanja() {
  const g = new Map();
  cortesDetalle().forEach((r) => {
    const k = r.z ? r.z.id : 'sin:' + r.zt;
    if (!g.has(k)) g.set(k, { zt: r.zt, zcat: r.zcat, ze: r.ze, largo: r.z ? r.z.largo : 0, circ: new Set(), bob: new Set(), m: { ejecutado: 0, listo: 0, provisorio: 0 }, porCab: {} });
    const f = g.get(k); f.circ.add(r.c.designacion); f.bob.add(`${r.p.cat} ${r.b.codigo}`); f.m[r.p.estado] += r.p.len;
    const kc = `${r.p.cat} ${r.p.seccion}`; f.porCab[kc] = (f.porCab[kc] || 0) + r.p.len;
  });
  return [...g.values()];
}
async function exportStock() {
  const p = await window.api.saveBinary(IO.exportStock(S, R, { stockConsolidado, cortesDetalle, stockPorZanja, EST_CORTE }), `Stock de bobinas ${today()}.xlsx`, 'xlsx', 'Excel');
  if (p) toast('Excel exportado', { action: ['Abrir', () => window.api.openPath(p)] });
}
function printStock() {
  const F = stockConsolidado(), m = (x) => fmt(x, 0), cM = new Map(R.circuitos.map((c) => [c.id, c])), zM = new Map(R.zlist.map((z) => [z.id, z]));
  const circBob = (b) => { const g = new Map(); b.cortes.forEach((p) => { const c = cM.get(p.cid) || {}; const z = zM.get(c.zid); const k = `${c.designacion}${z ? ' (' + z.titulo + ')' : ''}`; g.set(k, (g.get(k) || 0) + p.len); }); return [...g].map(([k, v]) => `${esc(k)} ${fmt(v, 0)} m`).join(' · '); };
  let h = prHead('Stock de bobinas · consolidado') + `<div class="card"><table class="tbl stk"><thead><tr><th>Tipo</th><th>Sección</th><th class="n">Bobinas</th><th class="n">Sin abrir</th><th class="n">En uso</th><th class="n">Term.</th><th class="n">Entrada</th><th class="n">Tendido</th><th class="n">Saldo actual</th><th class="n">Plan pendiente</th><th class="n">Saldo libre</th><th class="n">Rem. útil prev.</th><th class="n">Descarte prev.</th><th class="n">Falta</th></tr></thead><tbody>`;
  F.forEach((f) => { h += `<tr><td><b>${f.cat}</b></td><td>${f.seccion} mm²</td><td class="n">${f.n}</td><td class="n">${f.sinAbrir}</td><td class="n">${f.enUso}</td><td class="n">${f.term}</td><td class="n">${m(f.entrada)}</td><td class="n">${m(f.tendido)}</td><td class="n"><b>${m(f.saldo)}</b></td><td class="n">${m(f.plan)}</td><td class="n">${m(f.saldo - f.plan)}</td><td class="n">${m(f.remUtil)}</td><td class="n">${m(f.descarte)}</td><td class="n" style="${f.falta > 0 ? 'color:#c0392b;font-weight:700' : ''}">${f.falta > 0 ? m(f.falta) : '–'}</td></tr>`; });
  h += `</tbody></table><p class="muted" style="font-size:9pt;margin:8px 0 0">Metros por conductor. Saldo libre = saldo actual − plan pendiente (listo + provisorio). Falta = cable que no alcanza para completar la sección según el plan actual.</p></div>`;
  const Z = stockPorZanja();
  h += `<div class="card" style="break-inside:auto"><h3>Discriminado por zanja</h3><table class="tbl stk"><thead><tr><th>Zanja</th><th>Tipo</th><th>Estado</th><th>Circuitos</th><th>Bobinas</th><th>Cable por sección (m)</th><th class="n">Tendido</th><th class="n">Listo</th><th class="n">Provisorio</th></tr></thead><tbody>${Z.map((z) => `<tr><td style="white-space:normal;max-width:170px"><b>${esc(z.zt)}</b></td><td>${z.zcat || '–'}</td><td>${esc(z.ze || '')}</td><td style="white-space:normal;max-width:190px">${[...z.circ].map(esc).join(', ')}</td><td style="white-space:normal;max-width:120px">${[...z.bob].map(esc).join(', ')}</td><td style="white-space:normal">${Object.entries(z.porCab).map(([k, v]) => `${k}: ${m(v)}`).join(' · ')}</td><td class="n">${m(z.m.ejecutado)}</td><td class="n">${m(z.m.listo)}</td><td class="n">${m(z.m.provisorio)}</td></tr>`).join('')}</tbody></table></div>`;
  CATK.forEach((cat) => {
    const bs = R.bobinas.filter((b) => b.cat === cat).sort((a, b) => a.seccion - b.seccion || String(a.codigo).localeCompare(String(b.codigo), 'es', { numeric: true }));
    if (!bs.length) return;
    h += `<div class="card" style="break-inside:auto"><h3>${CATN[cat]} · detalle por bobina</h3><table class="tbl"><thead><tr><th>Código</th><th>N° fabricante</th><th>Sección</th><th class="n">Entrada</th><th class="n">Tendido</th><th class="n">Saldo</th><th>Estado</th><th class="n">Plan pend.</th><th class="n">Rem. prev.</th><th>Al final</th><th>Circuitos (zanja)</th></tr></thead><tbody>${bs.map((b) => `<tr><td><b>${esc(b.codigo)}</b></td><td>${esc(b.nro)}</td><td>${b.seccion}</td><td class="n">${m(b.entrada)}</td><td class="n">${fmt(b.consumoReal, 1)}</td><td class="n"><b>${fmt(b.saldoActual, 1)}</b></td><td>${b.estadoReal}</td><td class="n">${fmt(b.asigListo + b.asigProv, 1)}</td><td class="n">${fmt(b.remanente, 1)}</td><td>${b.estado}</td><td style="white-space:normal;font-size:7pt">${circBob(b)}</td></tr>`).join('')}</tbody></table></div>`;
  });
  printHTML(h, `Stock de bobinas ${today()}.pdf`, true);
}
function vBobinas(el) {
  actions([['Importar…', 'btn', () => menuImportar(null, true)], ['Stock consolidado · Excel', 'btn', exportStock], ['Stock consolidado · PDF', 'btn', printStock], ['+ Bobina', 'btn pri', () => editBobina(null)]]);
  const q = (ui.q.bob || '').toLowerCase();
  const list = R.bobinas.filter((b) => (ui.bobCat === 'all' || b.cat === ui.bobCat) && (!q || `${b.codigo} ${b.nro} ${b.remito}`.toLowerCase().includes(q)));
  let h = `<div class="tools"><div class="seg" id="fBC"><button data-v="all">Todas</button><button data-v="BT">${CATN.BT}</button><button data-v="MT">${CATN.MT}</button><button data-v="PAT">PAT Cu desnudo</button><button data-v="LA">${CATN.LA}</button></div>
    <span class="muted">${list.length} bobinas · ${list.filter((b) => b.estadoReal === 'sin abrir').length} sin abrir · ${list.filter((b) => b.estadoReal === 'en uso').length} en uso · ${list.filter((b) => b.estadoReal === 'terminada').length} terminadas</span><span class="sp"></span><input type="search" id="fBQ" placeholder="Buscar código, N°, remito…" value="${esc(ui.q.bob || '')}" style="width:240px"></div>
    <div class="tblwrap"><table class="tbl"><thead><tr><th>Tipo</th><th>Código</th><th>N° fabricante</th><th>Sección</th><th class="n">Entrada</th><th class="n">Ya tendido</th>
    <th class="n">Saldo actual</th><th>Uso real</th><th>Estado real</th><th class="n">Plan pendiente</th><th class="n">Remanente previsto</th><th>Al final</th><th></th></tr></thead><tbody>`;
  list.forEach((b) => {
    h += `<tr data-id="${b.id}"><td><span class="chip">${b.cat}</span></td><td><b>${esc(b.codigo)}</b></td><td class="mono" title="Remito ${esc(b.remito || '–')} · ingreso ${esc(b.fecha || '–')}">${esc(b.nro)}</td><td>${b.seccion ?? '?'}</td>
      <td class="n">${fmt(b.entrada)}</td><td class="n">${fmt(b.consumoReal, 1)}</td><td class="n"><b>${fmt(b.saldoActual, 1)}</b></td>
      <td><span class="mini ok"><div data-w="${(b.usoReal * 100).toFixed(1)}%" style="width:0"></div></span> <span class="muted">${fmt(b.usoReal * 100, b.usoReal > 0 && b.usoReal < 0.1 ? 1 : 0)}%</span></td><td>${pill(b.estadoReal)}</td>
      <td class="n">${fmt(b.asigListo + b.asigProv, 1)}</td><td class="n">${fmt(b.remanente, 1)}</td><td>${pill(b.estado)}</td>
      <td><button class="btn sm ghost">✎</button></td></tr>`;
  });
  el.innerHTML = h + `</tbody></table>${list.length ? '' : '<div class="empty"><b>Sin bobinas de este tipo</b>Cargalas con "+ Bobina" o importá la planilla de control.</div>'}</div>`;
  segBind('#fBC', ui.bobCat, (v) => { ui.bobCat = v; render(false); });
  searchBind('#fBQ', (v) => { ui.q.bob = v; });
  $$('tbody tr', el).forEach((tr) => { $('button', tr).onclick = () => editBobina(tr.dataset.id); tr.ondblclick = () => editBobina(tr.dataset.id); });
}
const SEC_DEF = { BT: '1x240', MT: '1x50/25', PAT: '1x25 Cu desnudo', LA: 'Prysalac 120/20' };
// opciones de sección por tipo para la carga (la línea aérea usa el catálogo Prysalac Al/Ac)
const SEC_OPC = { BT: ['1x240', '1x185', '1x150', '1x120', '1x95'], MT: ['1x50/25', '1x120/25', '1x150/25', '1x185/25', '1x240/25'], PAT: ['1x25 Cu desnudo', '1x35 Cu desnudo', '1x50 Cu desnudo', '1x95 Cu desnudo'],
  LA: Engine.PRYSALAC.map((p) => `Prysalac ${p.sec}`) };
const prysDe = (txt) => { const m = String(txt || '').match(/(\d+)\s*\/\s*(\d+(?:[.,]\d+)?)/); return m ? Engine.PRYSALAC.find((p) => p.sec.replace(',', '.') === `${m[1]}/${m[2].replace(',', '.')}`) || null : null; };
async function editBobina(id) {
  if (window.READONLY) return;
  const nuevo = !id, defCat = ui.bobCat !== 'all' ? ui.bobCat : 'BT';
  const b = nuevo ? { id: uid('b'), cat: defCat, fecha: today(), remito: '', nro: '', seccion: SEC_DEF[defCat], entrada: 0, codigo: '', obs: '' } : S.bobinas.find((x) => x.id === id);
  const rb = R.bobinas.find((x) => x.id === id);
  const usada = !nuevo && S.circuitos.some((c) => c.cat === b.cat && Object.values(c.real || {}).some((r) => r.bobina === rb.codigo));
  const pm = modal({
    title: nuevo ? 'Nueva bobina' : `Editar bobina ${rb.codigo} (${b.cat})`,
    body: `<div class="form"><label>Tipo<select name="cat" ${usada ? 'disabled' : ''}>${Object.keys(CATS).map((k) => `<option value="${k}" ${b.cat === k ? 'selected' : ''}>${CATN[k]}</option>`).join('')}</select></label>
      <label>Sección<input type="text" name="seccion" list="secOpc" value="${esc(b.seccion)}" placeholder="1x240 · 1x50/25 · 1x25 · Prysalac 120/20"><datalist id="secOpc"></datalist></label>
      <div class="full" id="prysInfo" style="display:none"></div>
      <label>Fecha de ingreso<input type="date" name="fecha" value="${esc(b.fecha || '')}"></label><label>Remito<input type="text" name="remito" value="${esc(b.remito || '')}"></label>
      <label>N° de bobina (fabricante)<input type="text" name="nro" value="${esc(b.nro)}"></label><label>Cantidad de entrada (m)<input type="number" name="entrada" value="${b.entrada}"></label>
      <label>Código interno<input type="text" name="codigo" value="${esc(b.codigo || '')}" placeholder="automático: n/sección"></label><label>Observaciones<input type="text" name="obs" value="${esc(b.obs || '')}"></label></div>
      <p class="hint">El código interno lo asignan ustedes (si lo dejás vacío se numera por tipo y sección, ej. 1/25). Línea aérea: conductor desnudo Prysalac (aluminio con alma de acero); la sección Al/Ac sale de la lista.${usada ? ' Tiene tendidos registrados: si cambiás el código se actualizan solos.' : ''}</p>`,
    buttons: [...(nuevo ? [] : [['Eliminar', 'btn danger', () => 'del']]), ['Cancelar', 'btn', () => null], ['Guardar', 'btn pri', (box) => {
      const g = (n) => $(`[name=${n}]`, box).value.trim();
      if (!g('nro') || !(Number(g('entrada')) > 0) || Engine.parseSeccion(g('seccion')) == null) { toast('Completá N° de bobina, sección y metros', { err: true }); return false; }
      if (g('cat') === 'LA' && !prysDe(g('seccion'))) { toast('Línea aérea: elegí una sección Prysalac de la lista (ej. Prysalac 120/20)', { err: true }); return false; }
      const old = rb && rb.codigo;
      Object.assign(b, { cat: usada ? b.cat : g('cat'), fecha: g('fecha'), remito: g('remito'), nro: g('nro'), seccion: g('seccion'), entrada: Number(g('entrada')), codigo: g('codigo'), obs: g('obs') });
      if (old && b.codigo && old !== b.codigo) S.circuitos.forEach((c) => { if (c.cat === b.cat) Object.values(c.real || {}).forEach((r) => { if (r.bobina === old) r.bobina = b.codigo; }); });
      return 'ok';
    }]],
  });
  { // opciones según el tipo: datalist de secciones y ficha Prysalac para línea aérea
    const box = $('#modal .mbox'), sc = $('[name=cat]', box), si = $('[name=seccion]', box), en = $('[name=entrada]', box), inf = $('#prysInfo', box);
    const upd = (cambioTipo) => {
      const k = sc.value; $('#secOpc', box).innerHTML = (SEC_OPC[k] || []).map((o) => `<option value="${o}">`).join('');
      if (cambioTipo && nuevo) si.value = SEC_DEF[k] || '';
      const p = k === 'LA' ? prysDe(si.value) : null;
      inf.style.display = k === 'LA' ? '' : 'none';
      inf.innerHTML = k === 'LA' ? (p ? `<div class="alert info" style="margin:0">Prysalac ${p.sec} mm² Al/Ac · Ø ${String(p.d).replace('.', ',')} mm · ${p.kg} kg/km · carga de rotura ${String(p.kn).replace('.', ',')} kN · bobina habitual ${fmt(p.largo)} m</div>` : '<div class="alert aviso" style="margin:0">Elegí la sección Al/Ac de la lista (ej. Prysalac 120/20)</div>') : '';
      if (k === 'LA' && p && nuevo && !(Number(en.value) > 0)) en.placeholder = `habitual ${p.largo} m`;
    };
    sc.onchange = () => upd(true); si.oninput = () => upd(false); upd(false);
  }
  const res = await pm;
  if (res === 'del') {
    if (usada) { toast('No se puede eliminar: tiene tendidos registrados', { err: true }); return; }
    if (await confirmar('Eliminar bobina', `¿Eliminar la bobina ${esc(b.nro)}?`, 'Eliminar')) { S.bobinas = S.bobinas.filter((x) => x !== b); commit('Bobina eliminada'); }
  } else if (res === 'ok') {
    if (nuevo) {
      b._o = Date.now();
      if (!b.codigo) { // código fijo desde el alta, para que sea el mismo en todas las PCs
        const sec = Engine.parseSeccion(b.seccion), usados = new Set(R.bobinas.filter((x) => x.cat === b.cat).map((x) => x.codigo));
        let n = R.bobinas.filter((x) => x.cat === b.cat && x.seccion === sec).length + 1; while (usados.has(`${n}/${sec}`)) n++;
        b.codigo = `${n}/${sec}`;
      }
      S.bobinas.push(b);
    }
    commit('Bobina guardada');
  }
}
