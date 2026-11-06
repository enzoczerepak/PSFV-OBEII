/* PSFV-OBE II · Propuesta de tendido y zanjas (abrir, cerrar, cierre parcial, PAT). */
// ======================= PROPUESTA =======================
function vPropuesta(el) {
  const cat = ui.propCat || 'BT';
  actions([['Exportar Excel', 'btn', exportExcel]]);
  const L = Engine.propuesta(S, cat);
  const tz = L.reduce((a, l) => a + l.zanjas.length, 0), mz = L.reduce((a, l) => a + l.metrosZanja, 0), mc = L.reduce((a, l) => a + l.metrosCable, 0);
  let h = `<div class="tools"><div class="seg" id="fPC"><button data-v="BT">${CATN.BT}</button><button data-v="MT">${CATN.MT}</button></div>
    <span class="muted">${L.length} lotes · ${tz} zanjas · ${fmt(mz)} m de zanja · ${fmt(mc)} m de cable</span></div>`;
  if (!L.length) { el.innerHTML = h + `<div class="card empty"><b>No hay zanjas pendientes de abrir en ${CATN[cat]}</b>${R.bobinas.some((b) => b.cat === cat) ? '' : 'Cargá las bobinas de este tipo para poder armar la propuesta.'}</div>`; segBind('#fPC', cat, (v) => { ui.propCat = v; render(true); }); return; }
  h += `<p class="hint" style="margin:-4px 0 14px">Cada lote junta zanjas vecinas (mismo STS, inversores consecutivos) con el cable de aproximadamente una bobina. Si se abren en este orden, quedan pocas bobinas empezadas a la vez y cada lote termina las que indica. Al abrir un lote sus cortes pasan a la hoja de corte.</p><div class="lotes stagger">`;
  L.forEach((l, i) => {
    const inv = l.zanjas.flatMap((z) => z.circuitos.map((c) => c.desde));
    h += `<div class="lote card"><div class="lnum">${l.n}</div><div class="lbody">
      <div class="lhead"><b>${esc(l.zona)}</b><span class="muted">${esc(rango(inv))}</span><span class="sp"></span>
      <div class="lprog"><div style="width:${(l.acumPct * 100).toFixed(1)}%"></div></div><span class="muted" title="Cable acumulado de la propuesta">${fmt(l.acumPct * 100)}%</span></div>
      <div class="kpis k4">${kpi('Zanjas', l.zanjas.length, '')}${kpi('Zanja a abrir', l.metrosZanja)}${kpi('Cable a tender', l.metrosCable)}${kpi('Bobinas en uso al terminar', l.enUso, '')}</div>
      <div class="lrow"><span class="muted">Secciones</span>${l.porSeccion.map(([s2, v]) => `<span class="chip">${s2} mm² · ${fmt(v)} m</span>`).join('')}</div>
      <div class="lrow"><span class="muted">Bobinas</span>${Object.entries(l.usa).map(([b, v]) => `<span class="chip ${l.nuevas.includes(b) ? 'nueva' : ''}" title="${fmt(v, 1)} m de esta bobina en el lote">${l.nuevas.includes(b) ? 'empieza ' : ''}${esc(b)} · ${fmt(v)} m</span>`).join('')}</div>
      ${l.terminadas.length ? `<div class="lrow"><span class="muted">Termina</span>${l.terminadas.map((t) => `<span class="chip lista">${esc(t.codigo)} · queda ${fmt(t.remanente, 1)} m</span>`).join('')}</div>` : ''}
      ${l.faltan ? `<div class="alert error" style="margin-top:8px">${l.faltan} conductores sin bobina disponible</div>` : ''}
      <details><summary>Ver zanjas (${l.zanjas.length})</summary><div class="chips" style="margin-top:6px">${l.zanjas.map((z) => `<span class="chip" title="${fmt(z.largo, 1)} m">${esc(z.titulo)} · ${fmt(z.largo)} m</span>`).join('')}</div></details>
      <div class="lact"><button class="btn sm ${i === 0 ? 'acc' : ''}" data-lote="${i}">Abrir zanjas del lote ${l.n}</button></div></div></div>`;
  });
  el.innerHTML = h + '</div>';
  segBind('#fPC', cat, (v) => { ui.propCat = v; render(true); });
  $$('[data-lote]', el).forEach((b) => { b.onclick = async () => {
    const i = Number(b.dataset.lote), l = L[i];
    if (!(await confirmar(`Abrir lote ${l.n}`, `Se marcan como abiertas ${l.zanjas.length} zanjas de ${esc(l.zona)} (${fmt(l.metrosZanja)} m). Sus cortes pasan a la hoja de corte.${i > 0 ? '<br><br>La propuesta supone abrir los lotes en orden; abrir este antes que los anteriores puede cambiar qué bobinas se usan.' : ''}`, 'Abrir zanjas'))) return;
    const ids = new Set(l.zanjas.map((z) => z.id));
    S.zanjas.forEach((z) => { if (ids.has(z.id) && z.estado === 'no abierta') z.estado = 'abierta'; });
    commit(`Lote ${l.n}: ${ids.size} zanjas abiertas`);
  }; });
}
function rango(inv) {
  const m = inv.map((d) => String(d).match(/^(.*?)(\d+)$/));
  if (m.every(Boolean) && new Set(m.map((x) => x[1])).size === 1) {
    const ns = m.map((x) => Number(x[2])).sort((a, b) => a - b);
    return ns.length === 1 ? inv[0] : ns[ns.length - 1] - ns[0] + 1 === ns.length ? `${m[0][1]}${ns[0]} a ${ns[ns.length - 1]}` : `${m[0][1]}${ns.join(', ')}`;
  }
  return inv.join(', ');
}

// ======================= ZANJAS =======================
function vZanjas(el) {
  const n = ui.sel.size ? ` (${ui.sel.size})` : '', dis = ui.sel.size ? '' : ' dis';
  actions([[`Misma zanja${n}`, 'btn' + (ui.sel.size > 1 ? '' : ' dis'), () => unir([...ui.sel])], [`No abierta${n}`, 'btn' + dis, () => bulkZanja('no abierta')],
    [`Abrir${n}`, 'btn acc' + dis, () => bulkZanja('abierta')], [`Cerrar${n}`, 'btn pri' + dis, () => bulkZanja('cerrada')]]);
  const q = ui.zQ.toLowerCase();
  const list = R.zlist.filter((z) => (ui.zTipo === 'all' || z.cat === ui.zTipo)
    && (ui.zEst === 'all' || (ui.zEst === 'cerrar' ? z.estado === 'abierta' && z.listoCerrar : ui.zEst === 'comp' ? z.miembros.length > 1 : z.estado === ui.zEst))
    && (!q || `${z.titulo} ${z.miembros.map((c) => c.designacion + ' ' + c.desde + ' ' + c.hasta).join(' ')}`.toLowerCase().includes(q)));
  const ordZ = (z) => (z.miembros.length ? Math.min(...z.miembros.map((c) => c.idx)) : 1e9);
  list.sort((a, b) => (a.cat === b.cat ? 0 : a.cat === 'BT' ? -1 : 1) || ordZ(a) - ordZ(b));
  const zz = R.zanjas;
  const pr = (k) => R.resumen.find((r) => r.key === k) || { tendido: 0, requerido: 0 };
  const card = (lbl, a, b, extra) => `<div class="card"><div class="kpis k1">${kpi(lbl, a, `/ ${fmt(b)} m`)}</div><div class="bar">${extra}</div>`;
  let h = `<div class="grid g4 stagger" style="margin-bottom:14px">
    ${card('Zanja BT realizada', zz.BT.realizada, zz.BT.total, `<div class="c-done" data-w="${pct(zz.BT.cerrada, zz.BT.total)}"></div><div class="c-acc" data-w="${pct(zz.BT.abierta, zz.BT.total)}"></div>`)}<span class="muted">${fmt(zz.BT.cerrada)} m cerrados · ${zz.BT.n} zanjas</span></div>
    ${card('Zanja MT realizada', zz.MT.realizada, zz.MT.total, `<div class="c-done" data-w="${pct(zz.MT.cerrada, zz.MT.total)}"></div><div class="c-acc" data-w="${pct(zz.MT.abierta, zz.MT.total)}"></div>`)}<span class="muted">${fmt(zz.MT.cerrada)} m cerrados · ${zz.MT.n} zanjas</span></div>
    ${card('PAT 25 mm² tendida', pr('PAT|25').tendido, pr('PAT|25').requerido, `<div class="c-done" data-w="${pct(pr('PAT|25').tendido, pr('PAT|25').requerido)}"></div>`)}<span class="muted">una por zanja de BT</span></div>
    ${card('PAT 95 mm² tendida', pr('PAT|95').tendido, pr('PAT|95').requerido, `<div class="c-done" data-w="${pct(pr('PAT|95').tendido, pr('PAT|95').requerido)}"></div>`)}<span class="muted">una por zanja de MT</span></div></div>
    <div class="tools"><div class="seg" id="fZT"><button data-v="all">BT y MT</button><button data-v="BT">BT</button><button data-v="MT">MT</button></div>
    <div class="seg" id="fZE"><button data-v="all">Todas</button><button data-v="no abierta">No abiertas</button><button data-v="abierta">Abiertas</button><button data-v="cerrar">Para cerrar</button><button data-v="cerrada">Cerradas</button><button data-v="comp">Compartidas</button></div>
    <span class="muted">${list.length} zanjas</span><span class="sp"></span><input type="search" id="fZQ" placeholder="Buscar circuito, inversor, STS…" value="${esc(ui.zQ)}" style="width:220px"></div>
    <div class="tblwrap"><table class="tbl"><thead><tr><th><input type="checkbox" id="selAll"></th><th>Tipo</th><th>Zanja</th><th>Circuitos</th><th class="n">Largo (m)</th><th>Estado de zanja</th><th>Cable</th><th>PAT</th><th></th></tr></thead><tbody>`;
  list.forEach((z) => {
    const patOk = z.pat && z.pat.completo;
    h += `<tr data-id="${z.id}" class="${ui.sel.has(z.id) ? 'sel' : ''}"><td><input type="checkbox" class="sel" ${ui.sel.has(z.id) ? 'checked' : ''}></td><td><span class="chip">${z.cat}</span></td>
      <td class="ztit">${esc(z.titulo)}${z.miembros.length > 1 ? ' <span class="pill p-warn" title="Zanja compartida">compartida</span>' : ''}</td>
      <td><div class="chips">${z.miembros.map((c) => `<span class="chip ${c.completo ? 'lista' : ''}" title="${esc(c.desde)} → ${esc(c.hasta)}${c.completo ? ' · tendido' : ''}">${c.completo ? '✓ ' : ''}${esc(c.designacion)}${z.miembros.length > 1 && !c.completo && !window.READONLY ? `<button class="chipx" data-sacar="${c.id}" title="Sacar de esta zanja (queda con zanja propia, para más adelante)">×</button>` : ''}</span>`).join('')}</div></td>
      <td class="n"><input type="number" class="zl" step="0.1" min="0" value="${z.largo}" title="Largo de zanja según plano"></td><td>${zSeg(z.id, z.estado, z.listoCerrar)}</td><td>${z.nReal}/${z.nCond} ${z.completo ? '✓' : ''}</td>
      <td style="white-space:nowrap">${patOk ? `<button class="pill p-done pbtn" data-a="tp" title="PAT cargada · tocá para corregir">${esc(z.pat.fasesInfo.C.bobina || 'sin bobina')} · ${fmt(z.pat.fasesInfo.C.len, 1)} m</button>` : z.pat && !window.READONLY && z.estado !== 'no abierta' ? '<button class="btn sm" data-a="tp" title="Cargar los metros de PAT tendidos en esta zanja">Cargar PAT</button>' : `<span class="muted">${z.estado === 'no abierta' ? '–' : 'sin cargar'}</span>`}</td>
      <td style="white-space:nowrap"><button class="btn sm acc" data-a="tc">Cable</button><button class="btn sm ghost" data-a="ez" title="Editar zanja">✎</button></td></tr>`;
  });
  el.innerHTML = h + `</tbody></table></div><p class="hint">Si varios circuitos van por la misma zanja, tildalos y tocá <b>Misma zanja</b>: quedan con un solo estado, un solo largo y una sola PAT. El largo se carga directo en la tabla (por ejemplo, del plano); con ✎ cambiás el nombre o separás un circuito. Abierta: se puede tender, de a un circuito, y el plan se recalcula con cada tendido. <b>Cerrar</b> se habilita cuando están tendidos todos los circuitos de la zanja: ahí se registra la PAT con el largo de la zanja (editable). Si un circuito de una zanja compartida queda para más adelante, sacalo con la <b>×</b> de su nombre: pasa a zanja propia y libera su bobina para el recálculo.</p>`;
  segBind('#fZT', ui.zTipo, (v) => { ui.zTipo = v; render(false); });
  segBind('#fZE', ui.zEst, (v) => { ui.zEst = v; render(false); });
  searchBind('#fZQ', (v) => { ui.zQ = v; });
  bindSel(el, list);
  bindZSeg(el);
  $$('tbody tr', el).forEach((tr) => {
    const z = R.zlist.find((x) => x.id === tr.dataset.id);
    tr.querySelector('[data-a=tc]').onclick = () => tenderZanja(z);
    const tp = tr.querySelector('[data-a=tp]'); if (tp) tp.onclick = () => z.pat && tender(z.pat.id);
    const cp = tr.querySelector('[data-a=cp]'); if (cp) cp.onclick = () => cierreParcial(z.id);
    tr.querySelector('[data-a=ez]').onclick = () => editZanja(z.id);
    $('.zl', tr).onchange = (e) => { const sz = S.zanjas.find((x) => x.id === z.id); sz.largo = Math.max(0, Number(e.target.value) || 0); sz.largoPlano = true; commit(`Zanja ${z.titulo}: ${fmt(sz.largo, 1)} m`); };
  });
}
const zSeg = (zid, est, okCerrar) => `<span class="zseg" data-id="${zid}">${Engine.ZANJA.map((z) => `<button data-z="${z}" class="${est === z ? 'on z' + z.replace(' ', '') : ''}" ${z === 'cerrada' && !okCerrar && est !== 'cerrada' ? 'title="Faltan tender circuitos de esta zanja"' : ''}>${z === 'no abierta' ? 'No' : z === 'abierta' ? 'Abierta' : 'Cerrada'}</button>`).join('')}</span>${!window.READONLY && R && parcialPosible(R.zlist.find((x) => x.id === zid)) ? `<button class="zpar" data-zp="${zid}" title="Cerrar el tramo con los circuitos ya tendidos; los pendientes pasan a zanja propia">Cierre parcial</button>` : ''}`;
function bindZSeg(el) {
  $$('.zpar', el).forEach((b) => { b.onclick = (e) => { e.stopPropagation(); cierreParcial(b.dataset.zp); }; });
  $$('.zseg button', el).forEach((b) => { b.onclick = async (e) => { e.stopPropagation(); const tr = b.closest('tr[data-id]'); ui.flashKeep = tr ? [tr.dataset.id] : null; await setZanja([b.parentElement.dataset.id], b.dataset.z); }; });
}
async function setZanja(zids, est) {
  if (window.READONLY) return;
  zids = [...new Set(zids)].filter(Boolean);
  const zs = zids.map((id) => S.zanjas.find((x) => x.id === id)).filter(Boolean);
  const rz = zids.map((id) => R.zlist.find((x) => x.id === id)).filter(Boolean);
  if (est === 'cerrada') return cerrarZanjas(zids);
  if (est === 'no abierta') { const conT = rz.filter((z) => z.nReal > 0); if (conT.length) toast(`${conT.length} con cable ya tendido: siguen contando como listas`); }
  zs.forEach((z) => { z.estado = est; if (est === 'cerrada' && !z.fechaCierre) z.fechaCierre = today(); if (est !== 'cerrada') delete z.fechaCierre; });
  ui.flash = ui.flashKeep || [...ui.sel, ...zids]; ui.flashKeep = null;
  ui.sel.clear();
  commit(zs.length === 1 ? `Zanja ${rz[0].titulo}: ${est}` : `${zs.length} zanjas: ${est}`);
}
const zidsSel = () => (view === 'zanjas' ? [...ui.sel] : [...ui.sel].map((id) => (R.circuitos.find((c) => c.id === id) || {}).zid));
const bulkZanja = (est) => { if (!ui.sel.size) { toast('Seleccioná con las casillas'); return; } setZanja(zidsSel(), est); };
async function unir(zids) {
  if (window.READONLY) return;
  zids = [...new Set(zids)].filter(Boolean);
  if (zids.length < 2) { toast('Tildá al menos dos circuitos que vayan por zanjas distintas'); return; }
  const rz = zids.map((id) => R.zlist.find((z) => z.id === id));
  const circ = rz.flatMap((z) => z.miembros);
  const largo = Math.max(...rz.map((z) => z.largo));
  const ok = await modal({ title: 'Misma zanja', body: `<p>Estos circuitos quedan en <b>una sola zanja</b>, con un solo estado y una sola PAT:</p>
    <div class="chips" style="margin:8px 0 12px">${circ.map((c) => `<span class="chip">${esc(c.designacion)} · ${esc(c.desde)} → ${esc(c.hasta)}</span>`).join('')}</div>
    <div class="form"><label>Largo de la zanja (m)<input type="number" step="0.1" name="largo" value="${largo}"></label></div>
    <p class="hint">Se propone el largo del recorrido más largo. Ajustalo si la zanja compartida mide distinto.</p>`,
    buttons: [['Cancelar', 'btn', () => null], ['Unir', 'btn pri', (box) => ({ largo: Number($('[name=largo]', box).value) || largo })]] });
  if (!ok) return;
  const err = Engine.unirZanjas(S, zids);
  if (err) { toast(err, { err: true, ms: 6000 }); return; }
  S.zanjas.find((z) => z.id === zids[0]).largo = ok.largo;
  ui.sel.clear();
  commit(`${circ.length} circuitos en la misma zanja`);
}
async function tenderZanja(z) {
  if (window.READONLY) return;
  if (z.miembros.length === 1) return tender(z.miembros[0].id);
  const res = await modal({ title: `Cable · ${z.titulo}`, sub: 'Elegí el circuito a registrar',
    body: z.miembros.map((c) => `<div class="phase-row" style="grid-template-columns:1fr auto auto"><div><b class="mono">${esc(c.designacion)}</b> · ${esc(c.desde)} → ${esc(c.hasta)}</div><span>${c.nReal}/${c.fz.length}</span><span style="white-space:nowrap">${!c.completo ? `<button class="btn sm" data-sep="${c.id}">Sacar</button> ` : ''}<button class="btn sm acc" data-id="${c.id}">Tender</button></span></div>`).join('')
      + `<p class="hint">Se tiende de a un circuito y el plan se recalcula con cada uno. Si alguno queda para más adelante, tocá <b>Sacar</b>: pasa a zanja propia y libera su bobina.</p>`,
    buttons: [['Volver', 'btn', () => null]] });
  void res;
}
document.addEventListener('click', (e) => { const b = e.target.closest('.mbody .phase-row button[data-id]'); if (b) { const id = b.dataset.id; $('#modal').classList.add('hidden'); setTimeout(() => tender(id), 50); } });
async function editZanja(zid) {
  if (window.READONLY) return;
  const z = S.zanjas.find((x) => x.id === zid), rz = R.zlist.find((x) => x.id === zid);
  const res = await modal({ title: `Zanja ${rz.titulo}`, sub: `${rz.cat} · ${rz.miembros.length} circuito${rz.miembros.length > 1 ? 's' : ''}`,
    body: `<div class="form"><label>Nombre (opcional)<input type="text" name="nombre" value="${esc(z.nombre || '')}" placeholder="${esc(Engine.tituloZanja({}, rz.miembros))}"></label>
      <label>Largo (m)<input type="number" step="0.1" name="largo" value="${z.largo}"></label>
      <label>Estado<select name="estado">${Engine.ZANJA.map((e) => `<option ${z.estado === e ? 'selected' : ''}>${e}</option>`).join('')}</select></label>
      <label>Fecha de cierre<input type="date" name="fc" value="${esc(z.fechaCierre || '')}"></label></div>
      <h4 style="margin:16px 0 6px">Circuitos en esta zanja</h4>
      ${rz.miembros.map((c) => `<div class="phase-row" style="grid-template-columns:1fr auto"><div><b class="mono">${esc(c.designacion)}</b> · ${esc(c.desde)} → ${esc(c.hasta)} <span class="muted">· ${fmt(c.lineal, 1)} m lineales</span></div>
        ${rz.miembros.length > 1 ? `<button class="btn sm" data-sep="${c.id}">Sacar de la zanja</button>` : ''}</div>`).join('')}`,
    buttons: [['Cancelar', 'btn', () => null], ['Guardar', 'btn pri', (box) => {
      z.nombre = $('[name=nombre]', box).value.trim() || undefined; if (!z.nombre) delete z.nombre;
      z.largo = Number($('[name=largo]', box).value) || 0; const ne = $('[name=estado]', box).value; if (ne !== 'cerrada' || z.estado === 'cerrada') z.estado = ne; else z._cerrar = true;
      const fc = $('[name=fc]', box).value; if (fc) z.fechaCierre = fc; else delete z.fechaCierre;
      return 'ok';
    }]] });
  if (res === 'ok') { const cerrar = z._cerrar; delete z._cerrar; commit('Zanja actualizada'); if (cerrar) setTimeout(() => cerrarZanjas([zid]), 60); }
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-sep]'); if (!b) return;
  $('#modal').classList.add('hidden'); setTimeout(() => sacarDeZanja(b.dataset.sep), 60);
});
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-sacar]'); if (!b) return;
  e.stopPropagation(); sacarDeZanja(b.dataset.sacar);
}, true);
async function sacarDeZanja(cid) {
  if (window.READONLY) return;
  const c = S.circuitos.find((x) => x.id === cid), rc = R.circuitos.find((x) => x.id === cid); if (!c || !rc) return;
  const rz = R.zlist.find((z) => z.id === rc.zid); if (!rz || rz.miembros.length < 2) return;
  const tend = rc.nReal > 0;
  if (!(await confirmar('Sacar de la zanja', `<b>${esc(c.designacion)}</b> (${esc(c.desde)} → ${esc(c.hasta)}) sale de la zanja ${esc(rz.titulo)} y pasa a una zanja propia de ${fmt(c.lineal || 0, 1)} m${tend ? ', abierta (ya tiene conductores tendidos)' : ', <b>no abierta</b>'}.<br><br>${tend ? '' : 'Su corte deja de estar comprometido y la bobina se recalcula para los demás tendidos. '}La zanja ${esc(rz.titulo)} se puede cerrar cuando estén tendidos los circuitos que le quedan. Su PAT se registra aparte, al cerrar su propia zanja.`, 'Sacar'))) return;
  const nid = Engine.separarCircuito(S, cid);
  ui.flash = [cid, rc.zid, nid];
  commit(`${c.designacion} sacado de la zanja ${rz.titulo}`);
}

// Cerrar zanjas: solo con todos sus circuitos tendidos; registra la PAT (largo de zanja, editable)
async function cerrarZanjas(zids, auto) {
  if (window.READONLY) return;
  zids = [...new Set(zids)].filter(Boolean);
  const rz = zids.map((id) => R.zlist.find((z) => z.id === id)).filter((z) => z && z.estado !== 'cerrada');
  if (!rz.length) { toast('Ya está cerrada'); return; }
  const inc = rz.filter((z) => !z.completo), ok = rz.filter((z) => z.completo);
  if (!ok.length) {
    const z = inc[0];
    await modal({ title: inc.length === 1 ? `No se puede cerrar ${esc(z.titulo)}` : 'No se pueden cerrar', sub: 'Faltan tender circuitos',
      body: inc.map((z) => `<h4 style="margin:6px 0">${esc(z.titulo)}</h4>` + z.miembros.map((c) => `<div class="phase-row" style="grid-template-columns:1fr auto auto"><div><b class="mono">${esc(c.designacion)}</b> · ${esc(c.desde)} → ${esc(c.hasta)}</div><span class="pill ${c.completo ? 'p-done' : 'p-warn'}">${c.completo ? 'tendido' : `${c.nReal}/${c.fz.length}`}</span>${!c.completo && z.miembros.length > 1 ? `<button class="btn sm" data-sep="${c.id}">Sacar de la zanja</button>` : '<span></span>'}</div>`).join('')).join('')
        + `<p class="hint">Una zanja se cierra completa cuando están tendidos todos sus circuitos. Si es compartida y ya hay circuitos tendidos, podés hacer un <b>cierre parcial</b>: se cierra el tramo de los tendidos y los pendientes quedan en una zanja propia, abierta.</p>`,
      buttons: [['Entendido', 'btn', () => null]].concat(inc.length === 1 && parcialPosible(z) ? [['Cierre parcial…', 'btn pri', () => 'parcial']] : []) }).then((r) => { if (r === 'parcial') cierreParcial(z.id); });
    return;
  }
  const bobsDe = (k) => R.bobinas.filter((b) => b.key === k);
  const fila = (z) => {
    const p = z.pat, pf = p ? p.fasesInfo.C || {} : {}, real = p ? (S.circuitos.find((x) => x.id === p.id).real || {}).C : null;
    const bobs = p ? bobsDe(p.key) : [];
    const sel = real ? real.bobina || '' : pf.bobina || '';
    const largo = real && real.metros ? real.metros : z.largo;
    const cargada = real && (real.bobina || real.sinBobina) && real.metros > 0;
    if (cargada) return `<div class="phase-row" data-z="${z.id}" data-ok="1" style="grid-template-columns:minmax(150px,1fr) 70px 1fr 130px">
      <div><b>${esc(z.titulo)}</b><div class="muted">${z.miembros.length} circuito${z.miembros.length > 1 ? 's' : ''} · zanja ${fmt(z.largo, 1)} m</div></div>
      <span class="chip">${p.seccion} mm²</span>
      <div class="patok"><span class="pill p-done">PAT cargada ✓</span> <b>${fmt(real.metros, 1)} m</b> · ${esc(real.bobina || 'sin bobina')} · ${fechaCorta(real.fecha)}</div>
      <input type="date" class="pd" value="${today()}" title="Fecha de cierre"></div>`;
    return `<div class="phase-row" data-z="${z.id}" style="grid-template-columns:minmax(150px,1fr) 70px 200px 96px 130px">
      <div><b>${esc(z.titulo)}</b><div class="muted">${z.miembros.length} circuito${z.miembros.length > 1 ? 's' : ''} · zanja ${fmt(z.largo, 1)} m</div></div>
      <span class="chip">${p ? p.seccion + ' mm²' : '—'}</span>
      ${p ? `<select class="pb"><option value="">Sin bobina registrada</option>${bobs.map((b) => `<option value="${esc(b.codigo)}" ${sel === b.codigo ? 'selected' : ''}>${esc(b.codigo)} · saldo ${fmt(b.saldoActual, 1)} m</option>`).join('')}</select>` : '<span class="muted">sin PAT</span>'}
      <input type="number" class="pm" step="0.1" min="0" value="${largo}" title="Largo de PAT tendido" ${p ? '' : 'disabled'}>
      <input type="date" class="pd" value="${(real && real.fecha) || today()}"></div>`;
  };
  const res = await modal({ title: ok.length === 1 ? `Cerrar zanja ${esc(ok[0].titulo)}` : `Cerrar ${ok.length} zanjas`, wide: true,
    sub: (auto ? 'Están tendidos todos los circuitos de la zanja. ' : '') + 'Cerrar la zanja confirma que la PAT está tendida.',
    body: `<div class="muted phase-row prh" style="grid-template-columns:minmax(150px,1fr) 70px 200px 96px 130px"><span>Zanja</span><span>PAT</span><span>Bobina</span><span>Largo (m)</span><span>Fecha</span></div>${ok.map(fila).join('')}
      ${inc.length ? `<p class="hint" style="color:var(--warn)">No se cierran (faltan circuitos por tender): ${inc.map((z) => esc(z.titulo)).join(', ')}.</p>` : ''}
      <p class="hint">Si la PAT ya se cargó (botón <b>Cargar PAT</b> en Zanjas, o un parte de campo) solo se confirma. Si no, cargá ahora los metros tendidos: se propone el largo de la zanja y la bobina del plan.</p>`,
    buttons: [[auto ? 'Más tarde' : 'Cancelar', 'btn', () => null], [ok.length === 1 ? 'Cerrar zanja' : 'Cerrar zanjas', 'btn pri', (box) => {
      const out = [];
      for (const row of $$('.phase-row[data-z]', box)) {
        if (row.dataset.ok) { out.push({ zid: row.dataset.z, ya: true, fecha: $('.pd', row).value }); continue; }
        const pb = $('.pb', row); const m = Number($('.pm', row).value) || 0;
        if (pb && !(m > 0)) { $('.pm', row).classList.add('bad'); $('.pm', row).focus(); return false; }
        out.push({ zid: row.dataset.z, bobina: pb ? pb.value : null, metros: m, fecha: $('.pd', row).value, conPat: !!pb });
      }
      return out;
    }]] });
  if (!res) return;
  res.forEach((r) => {
    const z = S.zanjas.find((x) => x.id === r.zid), rzz = R.zlist.find((x) => x.id === r.zid);
    if (!r.ya && r.conPat && rzz.pat) {
      const pc = S.circuitos.find((x) => x.id === rzz.pat.id);
      pc.real = { C: r.bobina ? { bobina: r.bobina, metros: r.metros, fecha: r.fecha } : { sinBobina: true, metros: r.metros, fecha: r.fecha } };
    }
    z.estado = 'cerrada'; z.fechaCierre = r.fecha || today();
  });
  ui.flash = [...res.map((r) => r.zid), ...ok.flatMap((z) => z.miembros.map((c) => c.id))]; ui.sel.clear();
  commit(res.length === 1 ? `Zanja ${ok[0].titulo} cerrada${res[0].ya ? ' · PAT confirmada' : ` · PAT ${fmt(res[0].metros, 1)} m`}` : `${res.length} zanjas cerradas con su PAT`);
}
const parcialPosible = (z) => z && z.miembros.length > 1 && z.estado !== 'cerrada' && z.miembros.some((c) => c.completo) && z.miembros.some((c) => !c.completo);
// Cierre parcial de una zanja compartida: el tramo con los circuitos tendidos se cierra (con su PAT) y los
// circuitos pendientes pasan a una zanja nueva, que queda abierta con el largo que todavía falta.
async function cierreParcial(zid) {
  if (window.READONLY) return;
  const z = R.zlist.find((x) => x.id === zid);
  if (!parcialPosible(z)) { toast('El cierre parcial es para zanjas compartidas con algún circuito tendido y alguno pendiente'); return; }
  const ten = z.miembros.filter((c) => c.completo), pen = z.miembros.filter((c) => !c.completo);
  const p = z.pat, real = p ? (S.circuitos.find((x) => x.id === p.id).real || {}).C : null;
  const bobs = p ? R.bobinas.filter((b) => b.key === p.key) : [];
  const selB = real ? real.bobina || '' : p ? (p.fasesInfo.C || {}).bobina || '' : '';
  const lTen = Math.max(...ten.map((c) => Number(c.lineal) || 0)), lPen = Math.max(...pen.map((c) => Number(c.lineal) || 0));
  const cerr = Math.min(z.largo, lTen || z.largo), queda = Math.max(0, Math.round((lPen || z.largo) * 100) / 100);
  const li = (c) => `<div class="phase-row" style="grid-template-columns:1fr auto"><div><b class="mono">${esc(c.designacion)}</b> · ${esc(c.desde)} → ${esc(c.hasta)}</div><span class="muted">${fmt(c.lineal, 1)} m</span></div>`;
  const res = await modal({ title: `Cierre parcial · ${esc(z.titulo)}`, wide: true, sub: `Zanja compartida de ${fmt(z.largo, 1)} m · ${ten.length} tendido${ten.length > 1 ? 's' : ''}, ${pen.length} pendiente${pen.length > 1 ? 's' : ''}`,
    body: `<div class="grid2c"><div><h4 style="margin:4px 0">Se cierra con</h4>${ten.map(li).join('')}</div><div><h4 style="margin:4px 0">Pasan a zanja propia</h4>${pen.map(li).join('')}</div></div>
      <div class="form" style="margin-top:12px">
        <label>Largo de zanja cerrado (m)<input type="number" step="0.1" min="0" id="cpL" value="${cerr}"></label>
        <label>Fecha de cierre<input type="date" id="cpF" value="${today()}"></label>
        ${p ? `<label>PAT tendida en el tramo cerrado (m)<input type="number" step="0.1" min="0" id="cpP" value="${real && real.metros ? real.metros : cerr}"></label>
        <label>Bobina de PAT<select id="cpB"><option value="">Sin bobina registrada</option>${bobs.map((b) => `<option value="${esc(b.codigo)}" ${selB === b.codigo ? 'selected' : ''}>${esc(b.codigo)} · saldo ${fmt(b.saldoActual, 1)} m</option>`).join('')}</select></label>` : ''}
        <label>Largo que queda abierto para los pendientes (m)<input type="number" step="0.1" min="0" id="cpQ" value="${queda}"></label>
        <label>Estado de la zanja de los pendientes<select id="cpE"><option value="abierta">Abierta (sigue abierta en obra)</option><option value="no abierta">No abierta (se tapa y se reabre después)</option></select></label></div>
      <p class="hint">Cerrar confirma la PAT del tramo cerrado. La zanja nueva lleva su propia PAT con el largo que queda abierto; se carga o se confirma cuando se cierre. Si la zanja de los pendientes sigue abierta, sus cortes listos conservan la bobina; si se tapa, vuelven a provisorio.</p>`,
    buttons: [['Cancelar', 'btn', () => null], ['Cerrar tramo', 'btn pri', (box) => {
      const n = (id) => { const e = $(id, box); return e ? Number(e.value) || 0 : 0; };
      if (p && !(n('#cpP') > 0)) { $('#cpP', box).classList.add('bad'); $('#cpP', box).focus(); return false; }
      return { largo: n('#cpL') || z.largo, fecha: $('#cpF', box).value || today(), pat: n('#cpP'), bobina: p ? $('#cpB', box).value : null, queda: n('#cpQ'), estado: $('#cpE', box).value };
    }]] });
  if (!res) return;
  const sz = S.zanjas.find((x) => x.id === zid);
  const nz = { id: 'z-' + pen[0].id + '-' + Math.random().toString(36).slice(2, 6), cat: sz.cat, largo: res.queda, estado: res.estado, parcialDe: zid };
  S.zanjas.push(nz);
  pen.forEach((c) => { S.circuitos.find((x) => x.id === c.id).zanjaId = nz.id; });
  sz.largo = res.largo; sz.estado = 'cerrada'; sz.fechaCierre = res.fecha; sz.parcial = true;
  if (p) { const pc = S.circuitos.find((x) => x.id === p.id); pc.real = { C: res.bobina ? { bobina: res.bobina, metros: res.pat, fecha: res.fecha } : { sinBobina: true, metros: res.pat, fecha: res.fecha } }; }
  if (res.estado === 'no abierta') { const ids = new Set(pen.map((c) => c.id)); Object.keys(S.compromiso || {}).forEach((k) => { if (ids.has(k.split('|')[0])) delete S.compromiso[k]; }); }
  Engine.sincronizarPAT(S);
  ui.flash = [zid, nz.id]; ui.sel.clear();
  commit(`Cierre parcial de ${z.titulo}: ${ten.length} circuito${ten.length > 1 ? 's' : ''} cerrado${ten.length > 1 ? 's' : ''}${p ? ` · PAT ${fmt(res.pat, 1)} m` : ''} · ${pen.length} pendiente${pen.length > 1 ? 's' : ''} en zanja ${res.estado}`);
}
function bindSel(el, list) {
  const all = $('#selAll', el);
  if (all) { all.checked = list.length > 0 && list.every((c) => ui.sel.has(c.id)); all.onchange = (e) => { list.forEach((c) => (e.target.checked ? ui.sel.add(c.id) : ui.sel.delete(c.id))); render(false); }; }
  $$('tbody tr .sel', el).forEach((cb) => { const id = cb.closest('tr').dataset.id; cb.onchange = (e) => { e.target.checked ? ui.sel.add(id) : ui.sel.delete(id); render(false); }; });
}
