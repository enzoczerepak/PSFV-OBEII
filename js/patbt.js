/* PSFV-OBE II · PAT de BT (Cu desnudo 25 mm²) independiente del zanjeo de BT: se carga por tramo (fecha, bobina, metros,
   descripción) y los accesorios aparte (saltos y jabalinas). Requerido según el plano OBEII-EL-PL-400 r1.
   Lo que se cargó antes en una zanja de BT se conserva y suma al avance. */
// anillo de PAT perimetral de cada sector (Cu desnudo 25 mm²) según OBEII-EL-PL-400 r1: largo del anillo sin los saltos a los
// trackers y su trazado en coordenadas del plano de obra (x = E − origen, y = origen − N)
const PAT_PERIM = {"1":{"m":1194.4,"saltos":107,"geo":[[[129.52,377.56],[167.9,377.54],[168.9,377.54],[168.9,347.9],[180.9,347.92],[180.9,315.82],[104.53,315.73],[104.53,347.91],[128.52,347.91],[128.52,377.56],[129.52,377.56]],[[86.52,304.55],[162.9,304.61]],[[162.9,304.61],[162.9,276.51]],[[162.9,276.51],[258.9,276.42],[261.86,275.71],[267.7,270.19],[336.9,207.32]],[[336.9,207.32],[336.9,86.75],[336.9,85.75]],[[333.52,85.75],[333.52,85.75],[336.9,85.75]],[[333.52,85.75],[261.52,148.98]],[[261.52,148.98],[257.9,153.84]],[[257.9,153.84],[236.52,153.84],[236.52,183.48]],[[236.52,183.48],[195.52,183.46],[192.52,183.46],[192.52,214.55],[165.52,214.7],[164.52,214.7]],[[164.52,214.7],[164.52,242.8]],[[122.52,242.8],[164.52,242.8]],[[122.52,242.8],[122.52,272.46]],[[86.52,272.46],[86.52,272.46],[122.52,272.46]],[[86.52,272.46],[86.52,304.55]],[[262.71,270.37],[264.78,272.95]],[[268.71,265.13],[268.71,269.27]],[[274.71,260.01],[274.71,263.82]],[[280.71,254.74],[280.71,258.37]],[[286.71,249.47],[286.71,252.92]],[[292.71,244.19],[292.71,247.47]],[[298.71,238.92],[298.71,242.01]],[[142.71,304.6],[142.71,315.78]],[[261.86,275.71],[267.7,270.19],[270.75,273.41],[264.91,278.94],[261.86,275.71]],[[225.99,158.67],[229.35,158.82]]]},"2":{"m":359.9,"saltos":38,"geo":[[[554.49,229.04],[654.87,229.09],[654.87,258.71]],[[666.87,258.71],[654.87,258.71]],[[666.87,290.82],[666.87,258.71]],[[554.49,229.04],[554.49,290.82],[666.87,290.82]],[[568.68,290.82],[568.68,302.48]]]},"3":{"m":693.6,"saltos":75,"geo":[[[554.49,302.48],[554.49,302.48],[554.49,302.48],[708.87,302.5]],[[708.87,332.16],[708.87,302.5]],[[708.87,332.16],[726.87,332.16],[726.87,363.01]],[[750.87,363.01],[726.87,363.01]],[[750.87,363.01],[750.87,392.67]],[[756.87,392.67],[750.87,392.67]],[[756.87,424.83],[756.87,392.67]],[[554.49,424.83],[756.87,424.83]],[[554.49,302.48],[554.49,424.83]],[[568.68,437.29],[568.68,424.83]],[[663.13,426.55],[663.13,429.05],[663.13,430.05],[670.13,430.05],[671.13,430.05],[671.13,426.55],[671.13,425.55],[663.13,425.55],[663.13,426.55]],[[694.4,428.39],[697.76,428.54]],[[769.68,407.36],[769.72,404.0]]]},"4":{"m":1563.0,"saltos":178,"geo":[[[554.49,437.24],[554.49,587.93]],[[512.49,587.93],[554.49,587.93]],[[512.49,618.76],[512.49,587.93]],[[470.49,618.76],[512.49,618.76]],[[470.49,648.42],[470.49,618.76]],[[428.49,648.42],[470.49,648.42]],[[428.49,680.59],[428.49,648.42]],[[948.87,680.59],[428.49,680.59]],[[948.87,648.42],[948.87,680.59]],[[924.87,648.42],[948.87,648.42]],[[924.87,618.74],[924.87,648.42]],[[906.87,618.74],[924.87,618.74]],[[906.87,588.07],[906.87,618.74]],[[882.87,588.07],[906.87,588.07]],[[882.87,558.23],[882.87,588.07]],[[858.87,558.23],[882.87,558.23]],[[858.87,527.41],[858.87,558.23]],[[840.87,527.41],[858.87,527.41]],[[840.87,497.73],[840.87,527.41]],[[804.87,497.73],[840.87,497.73]],[[804.87,466.91],[804.87,497.73]],[[786.87,466.91],[804.87,466.91]],[[786.87,437.24],[786.87,466.91]],[[554.49,437.24],[786.87,437.24]],[[708.96,682.01],[708.96,684.51],[708.96,685.51],[715.96,685.51],[716.96,685.51],[716.96,682.01],[716.96,681.01],[708.96,681.01],[708.96,682.01]],[[671.13,430.05],[671.13,437.24]],[[725.36,684.64],[728.72,684.79]]]},"5":{"m":1611.3,"saltos":203,"geo":[[[410.49,694.23],[410.49,694.23],[984.87,694.23]],[[984.87,724.32],[984.87,694.23]],[[996.87,724.32],[984.87,724.32]],[[996.87,754.45],[996.87,724.32]],[[1008.87,754.45],[996.87,754.45]],[[1008.87,786.81],[1008.87,754.45]],[[978.87,786.81],[1008.87,786.81]],[[978.87,816.55],[978.87,786.81]],[[930.87,816.55],[978.87,816.55]],[[930.87,816.55],[930.87,847.38]],[[900.87,847.38],[930.87,847.38]],[[900.87,847.38],[900.87,877.05]],[[530.49,877.05],[900.87,877.05]],[[530.49,847.38],[530.49,877.05]],[[506.49,847.38],[530.49,847.38]],[[506.49,816.55],[506.49,847.38]],[[482.49,816.55],[506.49,816.55]],[[482.49,786.88],[482.49,816.55]],[[458.49,786.88],[482.49,786.88]],[[458.49,756.05],[434.49,756.05]],[[434.49,726.38],[410.49,726.38]],[[458.49,756.05],[458.49,786.88]],[[434.49,726.38],[434.49,756.05]],[[410.49,694.23],[410.49,726.38]],[[442.68,680.59],[442.68,694.21]],[[716.96,685.51],[716.96,694.33]],[[698.72,877.11],[698.72,879.61],[698.72,880.61],[705.72,880.61],[706.72,880.61],[706.72,877.1],[706.72,877.05],[698.72,877.05],[698.72,877.11]],[[714.9,882.03],[718.26,882.18]]]},"6":{"m":852.9,"saltos":81,"geo":[[[590.49,889.72],[590.49,889.72],[590.49,889.72],[852.87,889.72]],[[852.87,921.88],[852.87,889.72]],[[810.87,921.88],[852.87,921.88]],[[810.87,921.88],[810.87,951.55]],[[768.87,951.55],[810.87,951.55]],[[768.87,982.38],[768.87,951.55]],[[732.87,982.38],[768.87,982.38]],[[732.87,982.38],[732.87,1011.79]],[[696.87,1011.79],[732.87,1011.79]],[[696.87,1011.79],[696.87,1042.88]],[[650.49,1042.88],[696.87,1042.88]],[[650.49,1012.05],[650.49,1042.88]],[[626.49,1012.05],[650.49,1012.05]],[[626.49,982.38],[626.49,1012.05]],[[608.49,982.38],[626.49,982.38]],[[608.49,921.88],[608.49,982.38]],[[590.49,921.88],[608.49,921.88]],[[590.49,889.72],[590.49,921.88]],[[838.68,877.1],[838.68,889.78]],[[706.72,880.61],[706.68,889.75]]]}};
// avance del perímetro por sector: tramos cargados con su sector (proporcional) o la marca de completo
function patPerim() {
  const reg = ((S.patBT || {}).reg || []).filter((x) => x.tipo === 'c' && x.sec);
  return Object.keys(PAT_PERIM).map((sec) => { const T = reg.filter((x) => String(x.sec) === sec).sort((a, b) => (a.f || '').localeCompare(b.f || '')), m = T.reduce((a, x) => a + (Number(x.metros) || 0), 0), req = PAT_PERIM[sec].m;
    return { sec, req, m, p: req ? Math.min(1, m / req) : 0, ok: T.some((x) => x.completo) || m >= req - 0.5, T, ult: T.length ? T[T.length - 1].f : '' }; });
}
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
    ${patPerimHTML()}
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
  patPerimBind(el);
  const cf = $('#pbCfg', el); if (cf) cf.onclick = (e) => { e.preventDefault(); patBTCfg(); };
}
const patBTautor = () => (typeof USR !== 'undefined' && USR ? USR.nombre : '');
async function patBTTramo(id, secIni, completo) {
  const x0 = id ? S.patBT.reg.find((y) => y.id === id) : null, PP = patPerim(), pq = (sec) => PP.find((q) => q.sec === String(sec));
  const sec0 = x0 ? x0.sec || '' : secIni || '', falta0 = sec0 && !x0 ? Math.max(0, pq(sec0).req - pq(sec0).m) : 0;
  const bobs = R.bobinas.filter((b) => b.key === 'PAT|25');
  const r = await modal({ title: x0 ? 'Corregir tramo de PAT de BT' : 'Tramo de PAT de BT tendido', sub: 'Cu desnudo 1×25 mm² · se descuenta de la bobina elegida',
    body: `<div class="form"><label>Fecha<input type="date" id="pF" value="${(x0 && x0.f) || today()}"></label>
      <label>Metros tendidos<input type="number" id="pM" step="0.1" min="0" value="${x0 ? x0.metros : completo ? falta0.toFixed(1) : ''}"></label>
      <label class="full">Perímetro de sector<select id="pS"><option value="">No es del perímetro (fila, inversor, chicote…)</option>${PP.map((q) => `<option value="${q.sec}" ${String(sec0) === q.sec ? 'selected' : ''}>Sector ${q.sec} · ${fmt(q.m)} de ${fmt(q.req)} m tendidos</option>`).join('')}</select></label>
      <label class="full rmchk"><input type="checkbox" id="pC" ${(x0 && x0.completo) || completo ? 'checked' : ''}> Con este tramo el perímetro del sector queda completo</label>
      <label class="full">Bobina<select id="pB"><option value="">Sin bobina registrada</option>${bobs.map((b) => `<option value="${esc(b.codigo)}" ${x0 && x0.bobina === b.codigo ? 'selected' : ''}>${esc(b.codigo)} · saldo ${fmt(b.saldoActual, 1)} m</option>`).join('')}</select></label>
      <label class="full">Tramo (por dónde va)<input type="text" id="pD" value="${esc((x0 && x0.desc) || (sec0 ? `Perímetro sector ${sec0}` : ''))}" placeholder="Ej.: fila TRK 204–229 · STS 4 → INV 4.12 · chicote INV 3.5"></label></div>`,
    buttons: [['Cancelar', 'btn', () => null], [x0 ? 'Guardar' : 'Registrar', 'btn pri', (b) => {
      const m = Number($('#pM', b).value); if (!(m > 0)) { $('#pM', b).classList.add('bad'); return false; }
      const sc = $('#pS', b).value, d = $('#pD', b).value.trim() || (sc ? `Perímetro sector ${sc}` : ''); if (!d) { $('#pD', b).classList.add('bad'); return false; }
      return { f: $('#pF', b).value || today(), metros: Math.round(m * 10) / 10, bobina: $('#pB', b).value, desc: d, sec: sc || undefined, completo: sc && $('#pC', b).checked ? true : undefined }; }]] });
  if (r && !r.sec) { delete r.sec; delete r.completo; } if (r && !r.completo) delete r.completo;
  if (r && x0) { if (!r.sec) delete x0.sec; if (!r.completo) delete x0.completo; }
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

function patPerimBind(el) {
  const ro = window.READONLY;
  $$('[data-ppa]', el).forEach((b) => { b.onclick = (e) => { e.stopPropagation(); patBTTramo(null, b.dataset.ppa, false); }; });
  $$('[data-ppc]', el).forEach((b) => { b.onclick = (e) => { e.stopPropagation(); patBTTramo(null, b.dataset.ppc, true); }; });
  $$('[data-pps]', el).forEach((g) => { g.onclick = () => { if (!ro) patBTTramo(null, g.dataset.pps, false); }; });
  $$('[data-ppe]', el).forEach((b) => { b.onclick = () => patBTTramo(b.dataset.ppe); });
  $$('[data-ppd]', el).forEach((b) => { b.onclick = async () => { const x = S.patBT.reg.find((y) => y.id === b.dataset.ppd); if (!x) return;
    if (!(await confirmar('Borrar tramo', `Se borra “${esc(x.desc || '')}” (${fmt(x.metros, 1)} m).`, 'Borrar', 'btn danger'))) return;
    S.patBT.reg = S.patBT.reg.filter((y) => y.id !== x.id); commit(`PAT perimetral: borrado ${x.desc || ''} (${fmt(x.metros, 1)} m)`); }; });
}
// apartado propio dentro de PAT · Cu desnudo: panel de perímetros + historial de tramos de perímetro
function vPatPerim(el) {
  const ro = window.READONLY; S.patBT = S.patBT || { reg: [] }; S.patBT.reg = S.patBT.reg || [];
  actions(ro ? [['Exportar Excel', 'btn', patBTExcel]] : [['+ Tramo de perímetro', 'btn pri', () => patBTTramo(null, (patPerim().find((q) => !q.ok) || {}).sec || '', false)], ['Exportar Excel', 'btn', patBTExcel]]);
  const T = patPerim().flatMap((q) => q.T).sort((a, b) => (b.f || '').localeCompare(a.f || ''));
  el.innerHTML = patPerimHTML() + `<div class="card"><h3>Tramos de perímetro cargados</h3>${T.length ? `<div class="tblwrap"><table class="tbl"><thead><tr><th>Fecha</th><th>Sector</th><th>Tramo</th><th>Bobina</th><th class="n">Metros</th><th>Cargó</th>${ro ? '' : '<th></th>'}</tr></thead><tbody>
    ${T.map((x) => `<tr><td>${x.f ? fechaCorta(x.f) : ''}</td><td>Sector ${esc(x.sec)}</td><td style="white-space:normal">${esc(x.desc || '')}${x.completo ? ' <b style="color:#2f9e5b">· completo</b>' : ''}</td><td>${esc(x.bobina || 'sin bobina')}</td><td class="n"><b>${fmt(x.metros, 1)}</b></td><td>${esc(x.por || '')}</td>${ro ? '' : `<td style="white-space:nowrap"><button class="btn sm ghost" data-ppe="${x.id}" title="Corregir">✎</button> <button class="btn sm ghost" data-ppd="${x.id}" title="Borrar">×</button></td>`}</tr>`).join('')}
    </tbody></table></div>` : '<div class="empty"><b>Todavía no hay tramos de perímetro</b><p class="muted">Usá <b>+ m</b> en la fila del sector, o <b>✓ Completo</b> cuando el anillo está terminado.</p></div>'}</div>`;
  patPerimBind(el);
}
// panel de perímetros: plano de los anillos coloreados por avance + tabla por sector con carga proporcional o completa
const PPCOL = (q) => (q.ok ? '#2f9e5b' : q.m > 0 ? '#f59e0b' : '#9aa5b1');
function patPerimSVG(PP, ancho) {
  const P = window.PLANO || {}, xs = [], ys = []; Object.values(PAT_PERIM).forEach((v) => v.geo.forEach((l) => l.forEach(([x, y]) => { xs.push(x); ys.push(y); })));
  if (!xs.length) return ''; const x0 = Math.min(...xs) - 20, x1 = Math.max(...xs) + 20, y0 = Math.min(...ys) - 20, y1 = Math.max(...ys) + 20, fs = Math.round((y1 - y0) / 22), sw = (y1 - y0) / 260;
  let g = (P.sect || []).map((s) => `<polygon points="${s.p.map((q) => q.join(',')).join(' ')}" fill="#eef2f6" stroke="none"/>`).join('');
  g += (P.trk || []).map((t) => `<rect x="${(t.x - t.w / 2).toFixed(1)}" y="${(t.y - t.h / 2).toFixed(1)}" width="${t.w}" height="${t.h}" fill="#d8dee6"/>`).join('');
  PP.forEach((q) => { const v = PAT_PERIM[q.sec], c = PPCOL(q), cx = [], cy = [];
    g += `<g data-pps="${q.sec}" class="ppsec" style="cursor:pointer">${v.geo.map((l) => { l.forEach(([x, y]) => { cx.push(x); cy.push(y); }); return `<polyline points="${l.map((p) => p.join(',')).join(' ')}" fill="none" stroke="${c}" stroke-width="${(q.ok ? 1.3 : 1) * sw}" ${!q.ok && q.m > 0 ? `stroke-dasharray="${sw * 3} ${sw * 2}"` : ''} stroke-linejoin="round"/>`; }).join('')}
      <text x="${((Math.min(...cx) + Math.max(...cx)) / 2).toFixed(1)}" y="${((Math.min(...cy) + Math.max(...cy)) / 2).toFixed(1)}" text-anchor="middle" font-size="${fs}" font-weight="700" fill="#334155">S${q.sec}</text>
      <text x="${((Math.min(...cx) + Math.max(...cx)) / 2).toFixed(1)}" y="${((Math.min(...cy) + Math.max(...cy)) / 2 + fs).toFixed(1)}" text-anchor="middle" font-size="${fs * 0.8}" fill="${c}" font-weight="700">${fmt(q.p * 100)} %</text></g>`; });
  return `<svg viewBox="${x0} ${y0} ${x1 - x0} ${y1 - y0}" style="width:100%;max-height:${ancho || 360}px" font-family="Arial">${g}</svg>`;
}
function patPerimHTML() {
  const PP = patPerim(), ro = window.READONLY, req = PP.reduce((a, q) => a + q.req, 0), m = PP.reduce((a, q) => a + Math.min(q.m, q.req), 0);
  return `<div class="card ppcard" style="margin-bottom:14px"><div class="phh"><h3>Perímetros de PAT de los sectores</h3><span class="muted">${fmt(m)} de ${fmt(req)} m · ${fmt(req ? (m / req) * 100 : 0, 1)} % · ${PP.filter((q) => q.ok).length} de ${PP.length} sectores completos</span></div>
    <div class="ppgrid"><div>${patPerimSVG(PP)}<div class="pplegend"><span><i style="background:#9aa5b1"></i>sin tender</span><span><i style="background:#f59e0b"></i>parcial (punteado)</span><span><i style="background:#2f9e5b"></i>completo</span>${ro ? '' : '<span class="muted">· tocá un sector para cargar avance</span>'}</div></div>
    <div class="tblwrap"><table class="tbl"><thead><tr><th>Sector</th><th class="n">Plano</th><th class="n">Tendido</th><th>Avance</th><th>Último</th>${ro ? '' : '<th></th>'}</tr></thead><tbody>
      ${PP.map((q) => `<tr><td><b>Sector ${q.sec}</b></td><td class="n">${fmt(q.req)} m</td><td class="n"><b>${fmt(q.m, 1)} m</b></td>
        <td style="min-width:120px"><div class="sbt"><div style="width:${(q.p * 100).toFixed(1)}%;background:${PPCOL(q)}"></div></div><small style="color:${PPCOL(q)};font-weight:600">${q.ok ? 'completo' : q.m > 0 ? fmt(q.p * 100, 1) + ' %' : 'sin tender'}</small></td>
        <td>${q.ult ? fechaCorta(q.ult) : '—'}</td>
        ${ro ? '' : `<td style="white-space:nowrap"><button class="btn sm" data-ppa="${q.sec}" ${q.ok ? 'disabled' : ''} title="Cargar metros tendidos">+ m</button> <button class="btn sm" data-ppc="${q.sec}" ${q.ok ? 'disabled' : ''} title="Carga lo que falta y marca el perímetro completo">✓ Completo</button></td>`}</tr>`).join('')}
      <tr class="rmrest"><td><b>Total</b></td><td class="n">${fmt(req)} m</td><td class="n"><b>${fmt(m, 1)} m</b></td><td colspan="${ro ? 2 : 3}"></td></tr></tbody></table></div></div>
    <p class="hint" style="margin:8px 0 0">Anillo de Cu desnudo 25 mm² que rodea cada sector, medido del plano OBEII-EL-PL-400 r1 (sin los saltos a los trackers). Se carga por avance en metros, con su fecha y bobina, o con <b>Completo</b>, que carga lo que falta. Los tramos suman también al total de PAT de BT y al tendido por fecha.</p></div>`;
}
