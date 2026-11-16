/* PSFV-OBE II · PAT de BT (Cu desnudo 25 mm²) independiente del zanjeo de BT: se carga por tramo (fecha, bobina, metros,
   descripción) y los accesorios aparte (saltos y jabalinas). Requerido según el plano OBEII-EL-PL-400 r1.
   Lo que se cargó antes en una zanja de BT se conserva y suma al avance. */
const patBTcfg = () => Object.assign({}, Engine.PATBT_DEF, (S.patBT || {}).cfg || {});
function patBTdatos() {
  const P = S.patBT || { reg: [] }, cfg = patBTcfg();
  const tramos = (P.reg || []).filter((x) => x.tipo === 'c').sort((a, b) => (b.f || '').localeCompare(a.f || '') || String(b.id).localeCompare(String(a.id)));
  const acc = (P.reg || []).filter((x) => x.tipo === 'a').sort((a, b) => (b.f || '').localeCompare(a.f || ''));
  // PAT cargada en zanjas de BT (antes de separarla)
  const enZanja = R.circuitos.filter((c) => c.cat === 'PAT' && c.key === 'PAT|25' && !c.patBT && c.fasesInfo && c.fasesInfo.C && c.fasesInfo.C.estado === 'ejecutado')
    .map((c) => { const z = R.zlist.find((x) => x.id === c.vinculo); const r = (c.real || {}).C || {}; return { titulo: z ? z.titulo : c.designacion, metros: Number(r.metros) || c.fasesInfo.C.len, bobina: r.bobina || '', f: r.fecha || '' }; });
  const mT = tramos.reduce((a, x) => a + (Number(x.metros) || 0), 0), mZ = enZanja.reduce((a, x) => a + (x.metros || 0), 0);
  const nS = acc.reduce((a, x) => a + (Number(x.saltos) || 0), 0), nJ = acc.reduce((a, x) => a + (Number(x.jab) || 0), 0);
  return { cfg, tramos, acc, enZanja, metros: mT + mZ, mT, mZ, nS, nJ };
}
function vPatBT(el) {
  const D = patBTdatos(), ro = window.READONLY, rp = R.resumen.find((r) => r.key === 'PAT|25') || {};
  actions(ro ? [['Exportar Excel', 'btn', patBTExcel]] : [['+ Accesorios', 'btn', () => patBTAcc()], ['+ Tramo de PAT', 'btn pri', () => patBTTramo()], ['Exportar Excel', 'btn', patBTExcel]]);
  const pc = (a, b) => (b ? Math.min(100, (a / b) * 100) : 0);
  const kp = (lbl, a, b, u, sub) => `<div class="card"><div class="kpis k1"><div class="kpi"><span>${lbl}</span><b>${fmt(a)}<small> / ${fmt(b)} ${u} · <b class="zpct">${fmt(pc(a, b), 1)} %</b></small></b></div></div>
    <div class="bar"><div class="c-done" data-w="${pc(a, b).toFixed(1)}%"></div></div><span class="muted">${sub}</span></div>`;
  let h = `<div class="grid g4 stagger" style="margin-bottom:14px">
    ${kp('Conductor PAT 25 mm² tendido', D.metros, D.cfg.req, 'm', `${fmt(D.mT)} m por tramo${D.mZ ? ` · ${fmt(D.mZ)} m cargados antes en zanjas BT` : ''}`)}
    ${kp('Saltos instalados', D.nS, D.cfg.saltos, '', 'accesorio · según plano')}
    ${kp('Jabalinas instaladas', D.nJ, D.cfg.jab, '', 'JL18 × 3 m · según plano')}
    <div class="card"><div class="kpis k1"><div class="kpi"><span>Stock PAT 25 mm²</span><b>${fmt(rp.saldoActual || 0)}<small> m en bobinas</small></b></div></div>
      <span class="muted">${rp.bobinas || 0} bobinas · ${fmt(rp.stock || 0)} m ingresados · falta tender ${fmt(Math.max(0, D.cfg.req - D.metros))} m</span></div></div>
    <p class="muted" style="margin:-4px 0 12px;font-size:12.5px">La PAT de BT va aparte del zanjeo de cables: corre entre los inversores y los tableros de BT de las STS y por las filas de trackers. Requerido según el plano <b>OBEII-EL-PL-400 r1</b>: ${fmt(D.cfg.req)} m de conductor (sin los saltos, que son accesorio).${ro ? '' : ' <a href="#" id="pbCfg">Cambiar cantidades del plano</a>'}</p>
    <div class="grid g2"><div class="card"><h3>Tramos de PAT tendidos</h3>${D.tramos.length || D.enZanja.length ? `<div class="tblwrap" style="max-height:calc(100vh - 380px)"><table class="tbl"><thead><tr><th>Fecha</th><th>Tramo</th><th>Bobina</th><th class="n">Metros</th><th></th></tr></thead><tbody>
      ${D.tramos.map((x) => `<tr><td>${x.f ? fechaCorta(x.f) : ''}</td><td style="white-space:normal">${esc(x.desc || '')}${x.por ? `<br><small class="muted">${esc(x.por)}</small>` : ''}</td><td>${esc(x.bobina || 'sin bobina')}</td><td class="n"><b>${fmt(x.metros, 1)}</b></td><td style="white-space:nowrap">${ro ? '' : `<button class="btn sm ghost" data-e="${x.id}" title="Corregir">✎</button><button class="btn sm ghost" data-d="${x.id}" title="Borrar">✕</button>`}</td></tr>`).join('')}
      ${D.enZanja.map((x) => `<tr class="muted"><td>${x.f ? fechaCorta(x.f) : ''}</td><td style="white-space:normal">${esc(x.titulo)}<br><small>cargada en la zanja (antes de separar la PAT)</small></td><td>${esc(x.bobina || 'sin bobina')}</td><td class="n">${fmt(x.metros, 1)}</td><td></td></tr>`).join('')}
      </tbody></table></div>` : '<div class="empty"><b>Todavía no hay tramos cargados</b><p class="muted">Usá <b>+ Tramo de PAT</b>: fecha, bobina, metros y por dónde va (ej. “fila TRK 204–229” o “STS 4 → INV 4.12”).</p></div>'}</div>
    <div class="card"><h3>Accesorios instalados</h3>${D.acc.length ? `<div class="tblwrap" style="max-height:calc(100vh - 380px)"><table class="tbl"><thead><tr><th>Fecha</th><th>Dónde</th><th class="n">Saltos</th><th class="n">Jabalinas</th><th></th></tr></thead><tbody>
      ${D.acc.map((x) => `<tr><td>${x.f ? fechaCorta(x.f) : ''}</td><td style="white-space:normal">${esc(x.desc || '')}${x.por ? `<br><small class="muted">${esc(x.por)}</small>` : ''}</td><td class="n">${fmt(x.saltos || 0)}</td><td class="n">${fmt(x.jab || 0)}</td><td style="white-space:nowrap">${ro ? '' : `<button class="btn sm ghost" data-ea="${x.id}" title="Corregir">✎</button><button class="btn sm ghost" data-d="${x.id}" title="Borrar">✕</button>`}</td></tr>`).join('')}
      </tbody></table></div>` : '<div class="empty"><b>Sin accesorios cargados</b><p class="muted">Usá <b>+ Accesorios</b> para registrar saltos y jabalinas instalados.</p></div>'}</div></div>`;
  el.innerHTML = h;
  $$('[data-w]', el).forEach((x) => { x.style.width = x.dataset.w; });
  $$('[data-e]', el).forEach((b) => { b.onclick = () => patBTTramo(b.dataset.e); });
  $$('[data-ea]', el).forEach((b) => { b.onclick = () => patBTAcc(b.dataset.ea); });
  $$('[data-d]', el).forEach((b) => { b.onclick = async () => {
    const x = S.patBT.reg.find((y) => y.id === b.dataset.d); if (!x) return;
    if (!(await confirmar('Borrar registro', `Se borra ${x.tipo === 'c' ? `el tramo “${esc(x.desc || '')}” (${fmt(x.metros, 1)} m)` : `la carga de accesorios “${esc(x.desc || '')}”`}.`, 'Borrar', 'btn danger'))) return;
    S.patBT.reg = S.patBT.reg.filter((y) => y.id !== x.id); commit(`PAT BT: borrado ${x.tipo === 'c' ? `tramo ${x.desc || ''} (${fmt(x.metros, 1)} m)` : `accesorios ${x.desc || ''}`}`); }; });
  const cf = $('#pbCfg', el); if (cf) cf.onclick = (e) => { e.preventDefault(); patBTCfg(); };
}
const patBTautor = () => (typeof USR !== 'undefined' && USR ? USR.nombre : '');
async function patBTTramo(id) {
  const x0 = id ? S.patBT.reg.find((y) => y.id === id) : null;
  const bobs = R.bobinas.filter((b) => b.key === 'PAT|25');
  const r = await modal({ title: x0 ? 'Corregir tramo de PAT de BT' : 'Tramo de PAT de BT tendido', sub: 'Cu desnudo 1×25 mm² · se descuenta de la bobina elegida',
    body: `<div class="form"><label>Fecha<input type="date" id="pF" value="${(x0 && x0.f) || today()}"></label>
      <label>Metros tendidos<input type="number" id="pM" step="0.1" min="0" value="${x0 ? x0.metros : ''}"></label>
      <label class="full">Bobina<select id="pB"><option value="">Sin bobina registrada</option>${bobs.map((b) => `<option value="${esc(b.codigo)}" ${x0 && x0.bobina === b.codigo ? 'selected' : ''}>${esc(b.codigo)} · saldo ${fmt(b.saldoActual, 1)} m</option>`).join('')}</select></label>
      <label class="full">Tramo (por dónde va)<input type="text" id="pD" value="${esc((x0 && x0.desc) || '')}" placeholder="Ej.: fila TRK 204–229 · STS 4 → INV 4.12 · chicote INV 3.5"></label></div>`,
    buttons: [['Cancelar', 'btn', () => null], [x0 ? 'Guardar' : 'Registrar', 'btn pri', (b) => {
      const m = Number($('#pM', b).value); if (!(m > 0)) { $('#pM', b).classList.add('bad'); return false; }
      const d = $('#pD', b).value.trim(); if (!d) { $('#pD', b).classList.add('bad'); return false; }
      return { f: $('#pF', b).value || today(), metros: Math.round(m * 10) / 10, bobina: $('#pB', b).value, desc: d }; }]] });
  if (!r) return;
  if (x0) Object.assign(x0, r); else S.patBT.reg.push(Object.assign({ id: uid('pb'), tipo: 'c', por: patBTautor() }, r));
  commit(`PAT BT: ${x0 ? 'corregido' : 'tendido'} ${r.desc} · ${fmt(r.metros, 1)} m${r.bobina ? ` (${r.bobina})` : ''}`);
}
async function patBTAcc(id) {
  const x0 = id ? S.patBT.reg.find((y) => y.id === id) : null;
  const r = await modal({ title: x0 ? 'Corregir accesorios' : 'Accesorios de PAT instalados', sub: 'Saltos y jabalinas JL18 × 3 m',
    body: `<div class="form"><label>Fecha<input type="date" id="aF" value="${(x0 && x0.f) || today()}"></label><span></span>
      <label>Saltos<input type="number" id="aS" step="1" min="0" value="${x0 ? x0.saltos || 0 : ''}"></label>
      <label>Jabalinas<input type="number" id="aJ" step="1" min="0" value="${x0 ? x0.jab || 0 : ''}"></label>
      <label class="full">Dónde<input type="text" id="aD" value="${esc((x0 && x0.desc) || '')}" placeholder="Ej.: filas TRK 204–229 · INV 3.5"></label></div>`,
    buttons: [['Cancelar', 'btn', () => null], [x0 ? 'Guardar' : 'Registrar', 'btn pri', (b) => {
      const sa = Math.max(0, Math.round(Number($('#aS', b).value) || 0)), ja = Math.max(0, Math.round(Number($('#aJ', b).value) || 0));
      if (!sa && !ja) { $('#aS', b).classList.add('bad'); return false; }
      return { f: $('#aF', b).value || today(), saltos: sa, jab: ja, desc: $('#aD', b).value.trim() }; }]] });
  if (!r) return;
  if (x0) Object.assign(x0, r); else S.patBT.reg.push(Object.assign({ id: uid('pb'), tipo: 'a', por: patBTautor() }, r));
  commit(`PAT BT: ${x0 ? 'corregidos' : 'instalados'} ${r.saltos} saltos y ${r.jab} jabalinas${r.desc ? ` (${r.desc})` : ''}`);
}
async function patBTCfg() {
  const c = patBTcfg();
  const r = await modal({ title: 'Cantidades del plano de PAT de BT', sub: 'Plano OBEII-EL-PL-400 r1 · contra esto se mide el avance',
    body: `<div class="form"><label>Conductor Cu 25 mm² (m, sin saltos)<input type="number" id="cR" step="1" value="${c.req}"></label><span></span>
      <label>Saltos<input type="number" id="cS" step="1" value="${c.saltos}"></label><label>Jabalinas<input type="number" id="cJ" step="1" value="${c.jab}"></label></div>`,
    buttons: [['Cancelar', 'btn', () => null], ['Guardar', 'btn pri', (b) => ({ req: Number($('#cR', b).value) || c.req, saltos: Number($('#cS', b).value) || 0, jab: Number($('#cJ', b).value) || 0 })]] });
  if (!r) return;
  S.patBT.cfg = r; commit(`PAT BT: cantidades del plano ${fmt(r.req)} m · ${r.saltos} saltos · ${r.jab} jabalinas`);
}
async function patBTExcel() {
  const D = patBTdatos(), wb = XLSX.utils.book_new();
  const t = [['Fecha', 'Tramo', 'Bobina', 'Metros', 'Cargó']].concat(D.tramos.map((x) => [x.f, x.desc, x.bobina, Number(x.metros), x.por || '']), D.enZanja.map((x) => [x.f, x.titulo + ' (en zanja)', x.bobina, x.metros, '']));
  const a = [['Fecha', 'Dónde', 'Saltos', 'Jabalinas', 'Cargó']].concat(D.acc.map((x) => [x.f, x.desc, x.saltos || 0, x.jab || 0, x.por || '']));
  const r = [['', 'Instalado', 'Según plano', '%'], ['Conductor Cu 25 mm² (m)', D.metros, D.cfg.req, D.cfg.req ? D.metros / D.cfg.req : 0], ['Saltos', D.nS, D.cfg.saltos, D.cfg.saltos ? D.nS / D.cfg.saltos : 0], ['Jabalinas', D.nJ, D.cfg.jab, D.cfg.jab ? D.nJ / D.cfg.jab : 0]];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(r), 'Resumen'); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(t), 'Tramos'); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(a), 'Accesorios');
  const p = await window.api.saveBinary(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }), `PAT BT ${today()}.xlsx`, 'xlsx', 'Excel');
  if (p) toast('Excel exportado', { action: ['Abrir', () => window.api.openPath(p)] });
}
