/* PSFV-OBE II · Tendido de cable solar (corriente continua: la vinculación de los trackers con sus inversores).
   Dos trabajos que se registran por fecha, en metros, con los inversores comprometidos:
   - Tendido de monotubo PEAD
   - Tendido de cable solar Prysmian 4 / 6 mm², rojo (+) y negro (−), que descuenta de su bobina como las de BT y MT.
   Datos: S.cc.reg = [{ id, tipo: 'pead' | 'cab', f, metros, inv: ['TX1-INV1', …], desc, bobina?, por }] (sync 'cc:<id>'). */
const CC_TIPOS = {
  pead: { n: 'Tendido de monotubo PEAD', corto: 'Monotubo PEAD', ico: 'cable', col: '#4e79a7', hint: 'Monotubo de polietileno de alta densidad por el que va el cable solar de los trackers al inversor: metros instalados y los inversores comprometidos.' },
  cab: { n: 'Tendido de cable solar', corto: 'Cable solar', ico: 'cable', col: '#e15759', hint: 'Cable solar Prysmian 4 o 6 mm², rojo (+) o negro (−), que comunica los trackers con su inversor: cada tramo descuenta de su bobina, como en BT y MT.' },
};
const CC_COL = { Rojo: '#d23c3c', Negro: '#222' };
const ccReg = () => { S.cc = S.cc || { reg: [] }; S.cc.reg = S.cc.reg || []; return S.cc.reg; };
const ccVig = () => ccReg().filter((x) => CC_TIPOS[x.tipo]); // solo los trabajos vigentes (la excavación CC se dejó de registrar)
const ccInvs = () => ((window.PLANO || {}).inv || []).map((i) => i.id).sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
const ccSts = (id) => (String(id).match(/^TX(\d+)/) || [])[1] || '?';
const ccBobs = () => (R.bobinas || []).filter((b) => b.cat === 'CC');
const ccBobTxt = (b) => `${b.codigo} · ${b.seccion} mm² ${b.color || ''} · saldo ${fmt(b.saldoActual, 0)} m`;
// metros de un registro repartidos entre sus inversores (para el avance por inversor)
function ccPorInv() {
  const M = new Map(ccInvs().map((i) => [i, { pead: 0, cab: 0, n: 0, ult: '' }]));
  ccVig().forEach((x) => { const L = (x.inv || []).filter((i) => M.has(i)); if (!L.length) return; const m = (Number(x.metros) || 0) / L.length;
    L.forEach((i) => { const q = M.get(i); q[x.tipo] += m; q.n++; if ((x.f || '') > q.ult) q.ult = x.f; }); });
  return M;
}

// ---------- alta / edición de un registro ----------
async function ccEditar(tipo, id) {
  if (window.READONLY) return;
  const x0 = id ? ccReg().find((y) => y.id === id) : null, T = CC_TIPOS[tipo], invs = ccInvs(), sel = new Set(x0 ? x0.inv || [] : []);
  const bobs = ccBobs(), stss = [...new Set(invs.map(ccSts))];
  const pm = modal({ title: x0 ? `Corregir · ${T.n}` : T.n, wide: true,
    body: `<div class="form"><label>Fecha<input type="date" id="cF" value="${x0 ? x0.f : today()}"></label>
      <label>Metros<input type="number" id="cM" step="0.1" min="0" value="${x0 ? x0.metros : ''}"></label>
      ${tipo === 'cab' ? `<label class="full">Bobina<select id="cB"><option value="">Sin bobina (no descuenta stock)</option>${bobs.map((b) => `<option value="${esc(b.codigo)}" ${x0 && x0.bobina === b.codigo ? 'selected' : ''}>${esc(ccBobTxt(b))}</option>`).join('')}</select></label>
      <label>Sección<select id="cS">${['4', '6'].map((v) => `<option value="${v}" ${String((x0 && x0.sec) || 6) === v ? 'selected' : ''}>${v} mm²</option>`).join('')}</select></label>
      <label>Color<select id="cC">${['Rojo', 'Negro'].map((v) => `<option ${((x0 && x0.color) || 'Rojo') === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label>` : ''}
      <label class="full">Descripción (opcional)<input type="text" id="cD" value="${esc((x0 && x0.desc) || '')}" placeholder="tramo, string, observación…"></label></div>
      <div class="ccinvh"><b>Inversores comprometidos</b> <span class="muted" id="cN"></span><span class="sp"></span>${stss.map((s) => `<button class="btn sm ghost" data-ccs="${s}">STS ${s}</button>`).join('')}<button class="btn sm ghost" data-ccs="0">Ninguno</button></div>
      <div class="ccinv">${stss.map((s) => `<div class="ccinvg"><span>STS ${s}</span><div>${invs.filter((i) => ccSts(i) === s).map((i) => `<label class="ccchk"><input type="checkbox" value="${i}" ${sel.has(i) ? 'checked' : ''}>${i.replace(/^TX\d+-/, '')}</label>`).join('')}</div></div>`).join('')}</div>
      <p class="hint">${T.hint}${tipo === 'cab' ? ' Para el avance por inversor, los metros se reparten en partes iguales entre los inversores marcados.' : ' En el avance por inversor, los metros se reparten en partes iguales entre los inversores marcados.'}</p>`,
    buttons: [['Cancelar', 'btn', () => null], [x0 ? 'Guardar' : 'Registrar', 'btn pri', (b) => {
      const m = Number($('#cM', b).value), inv = $$('.ccinv input:checked', b).map((c) => c.value);
      if (!(m > 0)) { $('#cM', b).classList.add('bad'); return false; }
      if (!inv.length) { toast('Marcá al menos un inversor comprometido', { err: true }); return false; }
      return { f: $('#cF', b).value || today(), metros: Math.round(m * 10) / 10, inv, desc: $('#cD', b).value.trim(), bobina: tipo === 'cab' ? $('#cB', b).value : undefined,
        sec: tipo === 'cab' ? Number($('#cS', b).value) : undefined, color: tipo === 'cab' ? $('#cC', b).value : undefined }; }]],
  });
  { const b = $('#modal .mbox');
    const cnt = () => { $('#cN', b).textContent = `${$$('.ccinv input:checked', b).length} marcados`; };
    $$('.ccinv input', b).forEach((c) => { c.onchange = cnt; }); cnt();
    const cB = $('#cB', b); // la sección y el color salen de la bobina elegida
    if (cB) { const sb = () => { const bb = bobs.find((y) => y.codigo === cB.value); $('#cS', b).disabled = $('#cC', b).disabled = !!bb; if (bb) { $('#cS', b).value = String(bb.seccion); if (bb.color) $('#cC', b).value = bb.color; } }; cB.onchange = sb; sb(); }
    $$('[data-ccs]', b).forEach((bt) => { bt.onclick = () => { const s = bt.dataset.ccs; $$('.ccinv input', b).forEach((c) => { if (s === '0') c.checked = false; else if (ccSts(c.value) === s) c.checked = true; }); cnt(); }; });
  }
  const r = await pm;
  if (!r) return;
  ['bobina', 'desc', 'sec', 'color'].forEach((k) => { if (r[k] === undefined || r[k] === '') delete r[k]; });
  if (r.bobina) { const bb = bobs.find((b) => b.codigo === r.bobina), libre = bb ? bb.saldoActual + (x0 && x0.bobina === r.bobina ? Number(x0.metros) || 0 : 0) : 0;
    if (bb && r.metros > libre + 0.01 && !(await confirmar('Bobina sin saldo', `La bobina ${esc(bb.codigo)} tiene ${fmt(libre, 1)} m y el tramo es de ${fmt(r.metros, 1)} m. ¿Registrar igual?`, 'Registrar'))) return; }
  if (x0) { Object.keys(x0).forEach((k) => { if (!['id', 'tipo', '_o', 'por'].includes(k)) delete x0[k]; }); Object.assign(x0, r); }
  else ccReg().push(Object.assign({ id: uid('cc'), tipo, _o: Date.now(), por: typeof USR !== 'undefined' && USR ? USR.nombre : '' }, r));
  commit(`${T.n} ${fechaCorta(r.f)}: ${fmt(r.metros, 1)} m · ${r.inv.length} inversor${r.inv.length > 1 ? 'es' : ''}${r.bobina ? ' · bobina ' + r.bobina : ''}`);
}
async function ccBorrar(id) {
  const x = ccReg().find((y) => y.id === id); if (!x) return;
  if (!(await confirmar('Borrar registro', `Se borra ${esc(CC_TIPOS[x.tipo].n)} del ${fechaCorta(x.f)} (${fmt(x.metros, 1)} m).`, 'Borrar', 'btn danger'))) return;
  S.cc.reg = ccReg().filter((y) => y.id !== id); commit(`${CC_TIPOS[x.tipo].n}: borrado el registro del ${fechaCorta(x.f)} (${fmt(x.metros, 1)} m)`);
}

// ---------- pantallas ----------
function ccTabla(L, tipo) {
  const ro = window.READONLY;
  if (!L.length) return `<div class="empty"><b>Todavía no hay registros</b><p class="muted">Usá <b>+ Registrar</b> con la fecha, los metros y los inversores comprometidos.</p></div>`;
  return `<div class="tblwrap"><table class="tbl"><thead><tr><th>Fecha</th><th class="n">Metros</th>${tipo === 'cab' ? '<th>Cable · bobina</th>' : ''}<th>Inversores comprometidos</th><th>Descripción</th><th>Cargó</th>${ro ? '' : '<th></th>'}</tr></thead><tbody>
    ${L.map((x) => { const b = x.bobina ? ccBobs().find((y) => y.codigo === x.bobina) : null;
      return `<tr><td>${fechaCorta(x.f)}</td><td class="n"><b>${fmt(x.metros, 1)}</b></td>${tipo === 'cab' ? `<td><i class="ccsw" style="background:${CC_COL[x.color] || '#999'}"></i>${x.sec || '?'} mm² ${esc((x.color || '').toLowerCase())} · ${b ? esc(b.codigo) : x.bobina ? esc(x.bobina) : '<span class="muted">sin bobina</span>'}</td>` : ''}
        <td style="white-space:normal;max-width:380px">${(x.inv || []).map((i) => `<span class="chip">${esc(i)}</span>`).join(' ')}</td><td style="white-space:normal">${esc(x.desc || '')}</td><td>${esc(x.por || '')}</td>
        ${ro ? '' : `<td style="white-space:nowrap"><button class="btn sm ghost" data-cce="${x.id}" title="Corregir">✎</button> <button class="btn sm ghost" data-ccd="${x.id}" title="Borrar">×</button></td>`}</tr>`; }).join('')}</tbody></table></div>`;
}
function ccBind(el, tipo) {
  $$('[data-cce]', el).forEach((b) => { b.onclick = () => { const x = ccReg().find((y) => y.id === b.dataset.cce); if (x) ccEditar(x.tipo, x.id); }; });
  $$('[data-ccd]', el).forEach((b) => { b.onclick = () => ccBorrar(b.dataset.ccd); });
}
function vCC(el, tipo) {
  const ro = window.READONLY, T = CC_TIPOS[tipo], L = ccReg().filter((x) => x.tipo === tipo).sort((a, b) => (b.f || '').localeCompare(a.f || '') || (b._o || 0) - (a._o || 0));
  actions(ro ? [['Exportar Excel', 'btn', ccExcel]] : [['Exportar Excel', 'btn', ccExcel], ['+ Registrar', 'btn pri', () => ccEditar(tipo)]]);
  const m = L.reduce((a, x) => a + (Number(x.metros) || 0), 0), inv = new Set(L.flatMap((x) => x.inv || [])), N = ccInvs().length, hoy = L.filter((x) => x.f === today()).reduce((a, x) => a + (Number(x.metros) || 0), 0);
  let extra = '';
  if (tipo === 'cab') { const B = ccBobs(), st = (sec, col) => B.filter((b) => String(b.seccion) === sec && b.color === col).reduce((a, b) => a + Math.max(0, b.saldoActual), 0);
    extra = `<div class="card" style="margin-bottom:14px"><div class="phh"><h3>Stock de cable solar</h3><button class="btn sm" data-go="ccbob">Bobinas</button></div><div class="kpis k4">${['4', '6'].flatMap((sec) => ['Rojo', 'Negro'].map((c) => kpi(`${sec} mm² ${c.toLowerCase()} · saldo`, st(sec, c), 'm', 0))).join('')}</div>
      <p class="hint" style="margin:6px 0 0">${B.length} bobinas de cable solar (${B.filter((b) => b.estadoReal === 'sin abrir').length} sin abrir). Se cargan en Bobinas con tipo «Cable solar», igual que las de BT y MT: remito, N° de bobina, metros, código interno, sección y color.</p></div>`; }
  el.innerHTML = `<div class="kpis k4" style="margin-bottom:14px">${kpi('Metros registrados', m, 'm', 1)}${kpi('Inversores con avance', inv.size, `/ ${N}`, 0)}${kpi('Registros', L.length, '', 0)}${kpi('Hoy', hoy, 'm', 1)}</div>${extra}
    <div class="card"><h3>${T.n} · registros</h3>${ccTabla(L, tipo)}</div>
    <p class="hint">${T.hint} El avance de PEAD y cable de cada inversor está en «Avance por inversor».</p>`;
  ccBind(el, tipo);
  $$('[data-go]', el).forEach((b) => { b.onclick = () => go(b.dataset.go); });
}
function vCCInv(el) {
  actions([['Exportar Excel', 'btn', ccExcel]]);
  const M = ccPorInv(), invs = ccInvs(), stss = [...new Set(invs.map(ccSts))];
  const tot = (k) => [...M.values()].reduce((a, q) => a + q[k], 0), con = (k) => [...M.values()].filter((q) => q[k] > 0).length;
  el.innerHTML = `<div class="kpis k2" style="margin-bottom:14px">${Object.entries(CC_TIPOS).map(([k, T]) => kpi(`${T.corto} · inversores con avance`, con(k), `/ ${invs.length} · ${fmt(tot(k), 0)} m`, 0)).join('')}</div>
    ${stss.map((s) => `<div class="card" style="margin-bottom:12px"><h3>STS ${s}</h3><div class="tblwrap"><table class="tbl"><thead><tr><th>Inversor</th>${Object.values(CC_TIPOS).map((T) => `<th class="n">${T.corto} (m)</th>`).join('')}<th class="n">Registros</th><th>Último</th></tr></thead><tbody>
      ${invs.filter((i) => ccSts(i) === s).map((i) => { const q = M.get(i); return `<tr><td><b>${esc(i)}</b></td>${Object.keys(CC_TIPOS).map((k) => `<td class="n">${q[k] > 0 ? `<b style="color:${CC_TIPOS[k].col}">${fmt(q[k], 1)}</b>` : '<span class="muted">–</span>'}</td>`).join('')}<td class="n">${q.n || '–'}</td><td>${q.ult ? fechaCorta(q.ult) : '—'}</td></tr>`; }).join('')}
      </tbody></table></div></div>`).join('')}
    <p class="hint">Cuando un registro afecta a varios inversores, sus metros se reparten en partes iguales entre ellos.</p>`;
}


// ---------- Excel ----------
async function ccExcel() {
  const wb = XLSX.utils.book_new(), L = ccVig().slice().sort((a, b) => (a.f || '').localeCompare(b.f || ''));
  const a = [['Fecha', 'Trabajo', 'Metros', 'Bobina', 'Sección', 'Color', 'Inversores comprometidos', 'Cantidad de inversores', 'Descripción', 'Cargó']];
  L.forEach((x) => { const b = x.bobina ? ccBobs().find((y) => y.codigo === x.bobina) : null; a.push([x.f, CC_TIPOS[x.tipo].n, Number(x.metros) || 0, x.bobina || '', x.sec || (b ? b.seccion : ''), x.color || (b ? b.color || '' : ''), (x.inv || []).join(', '), (x.inv || []).length, x.desc || '', x.por || '']); });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(a), 'Registros');
  const M = ccPorInv(), b2 = [['Inversor', 'STS', ...Object.values(CC_TIPOS).map((T) => T.corto + ' (m)'), 'Registros', 'Último']];
  ccInvs().forEach((i) => { const q = M.get(i); b2.push([i, 'STS ' + ccSts(i), ...Object.keys(CC_TIPOS).map((k) => Math.round(q[k] * 10) / 10), q.n, q.ult]); });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(b2), 'Por inversor');
  const c = [['Código', 'N° de bobina', 'Remito', 'Ingreso', 'Sección (mm²)', 'Color', 'Entrada (m)', 'Tendido (m)', 'Saldo (m)', 'Estado']];
  ccBobs().forEach((b) => c.push([b.codigo, b.nro, b.remito || '', b.fecha || '', b.seccion, b.color || '', b.entrada, b.consumoReal, b.saldoActual, b.estadoReal]));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(c), 'Bobinas cable solar');
  const p = await window.api.saveBinary(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }), `Cable solar ${today()}.xlsx`, 'xlsx', 'Excel');
  if (p) toast('Excel guardado');
}
