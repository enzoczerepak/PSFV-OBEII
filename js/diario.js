/* PSFV-OBE II · Tendido por fecha, puntas de cable y exportaciones. */
// ======================= TENDIDO POR FECHA =======================
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fechaLarga = (d) => { const t = new Date(d + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); return t.charAt(0).toUpperCase() + t.slice(1); };
const fechaCorta = (d) => new Date(d + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
// tramo y extremos de cada circuito (para puntas)
function tramo(c) {
  if (c.cat === 'BT') return c.hasta;
  const a = String(c.desde).toLowerCase(), b = String(c.hasta).toLowerCase();
  if (/fin lmt|piquete/.test(a) && /\bet\b|celda et/.test(b)) return 'Piquete – ET';
  if (/sala/.test(a) && /piquete|lmt/.test(b)) return 'Sala de celdas – Piquete LMT';
  if (/sts/.test(a) && /sala/.test(b)) return 'STS – Sala de celdas';
  if (/sts/.test(a) && /sts/.test(b)) return 'STS – STS';
  return 'Otros';
}
const ladoNom = (c, k) => (c.cat === 'BT' ? (k === 'o' ? 'Lado inversor' : 'Lado STS') : (k === 'o' ? c.desde : c.hasta));
const ladoCorto = (c, k) => (c.cat === 'BT' ? (k === 'o' ? 'Inversor' : 'STS') : (k === 'o' ? 'Origen' : 'Destino'));
function puntasDe(rc) {
  const sc = S.circuitos.find((x) => x.id === rc.id) || {}, p = sc.puntas || {}, n = rc.fz.length;
  const o = p.o ? Math.min(n, Number(p.o.n) || 0) : 0, d = p.d ? Math.min(n, Number(p.d.n) || 0) : 0;
  return { n, tot: 2 * n, o, d, col: o + d, po: p.o || null, pd: p.d || null };
}
function datosPorFecha() {
  const cMap = new Map(R.circuitos.map((c) => [c.id, c]));
  const dias = new Map(); let sinFecha = 0;
  const dia = (d) => { if (!dias.has(d)) dias.set(d, { fecha: d, m: Object.fromEntries(CATK.map((c) => [c, 0])), sec: new Map(), circ: new Map(), puntas: [], zanjas: [], fund: [], nCond: 0, bobinas: new Set() }); return dias.get(d); };
  R.piezas.filter((p) => p.estado === 'ejecutado').forEach((p) => {
    if (!p.fecha) { sinFecha += p.len; return; }
    const D = dia(p.fecha), c = cMap.get(p.cid); if (!c) return;
    D.m[p.cat] += p.len; D.nCond++; if (p.bobina) D.bobinas.add(p.bobina);
    const k = `${p.cat}|${p.seccion}`; D.sec.set(k, (D.sec.get(k) || 0) + p.len);
    const o = D.circ.get(c.id) || { c, fases: [], m: 0, bob: new Set(), teo: 0 };
    o.fases.push(p.fase); o.m += p.len; o.teo += p.teorico || 0; o.bob.add(p.bobina || 'sin bobina'); D.circ.set(c.id, o);
  });
  R.circuitos.filter((c) => c.cat !== 'PAT').forEach((c) => {
    const sc = S.circuitos.find((x) => x.id === c.id); const p = (sc && sc.puntas) || {};
    ['o', 'd'].forEach((k) => { if (p[k] && p[k].fecha && Number(p[k].n) > 0) dia(p[k].fecha).puntas.push({ c, k, n: Number(p[k].n) }); });
  });
  S.zanjas.forEach((z) => { if (z.estado === 'cerrada' && z.fechaCierre) { const rz = R.zlist.find((x) => x.id === z.id); if (rz) dia(z.fechaCierre).zanjas.push(rz); } });
  STSL.forEach((st) => ETAPAS.forEach(([k, n]) => { const v = ((S.fundaciones || {})[st] || {})[k]; if (!v) return; if (v.ini) dia(v.ini).fund.push({ st, n, t: 'inicio' }); if (v.ok && v.fin) dia(v.fin).fund.push({ st, n, t: 'fin' }); }));
  dias.forEach((D) => { D.total = CATK.reduce((a, c) => a + D.m[c], 0); D.nPuntas = D.puntas.reduce((a, x) => a + x.n, 0); });
  return { dias, sinFecha };
}
function vDiario(el) {
  const { dias, sinFecha } = datosPorFecha();
  const fechas = [...dias.keys()].sort();
  if (!ui.dia) ui.dia = fechas.length ? fechas[fechas.length - 1] : today();
  if (!ui.cal) { const [y, m] = ui.dia.split('-').map(Number); ui.cal = { y, m: m - 1 }; }
  const { y, m } = ui.cal, ym = `${y}-${String(m + 1).padStart(2, '0')}`;
  actions([['Exportar Excel', 'btn', () => exportTendidos()], ['PDF del día', 'btn', () => printDia(ui.dia)], ['PDF del mes', 'btn pri', () => printMes(ym)]]);
  const delMes = fechas.filter((d) => d.startsWith(ym)).map((d) => dias.get(d));
  const maxMes = Math.max(1, ...delMes.map((D) => D.total));
  // calendario
  const first = new Date(y, m, 1), nd = new Date(y, m + 1, 0).getDate(), off = (first.getDay() + 6) % 7, hoy = today();
  let cal = `<div class="calh"><button class="btn sm" data-cm="-1" title="Mes anterior">‹</button><b>${MESES[m]} ${y}</b><button class="btn sm" data-cm="1" title="Mes siguiente">›</button></div><div class="calg">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d) => `<span class="dow">${d}</span>`).join('')}`;
  for (let i = 0; i < off; i++) cal += '<span></span>';
  for (let d = 1; d <= nd; d++) {
    const k = `${ym}-${String(d).padStart(2, '0')}`, D = dias.get(k);
    const h = D && D.total ? 0.18 + 0.82 * (D.total / maxMes) : 0;
    cal += `<button class="cd${k === ui.dia ? ' csel' : ''}${k === hoy ? ' hoy' : ''}${D ? ' con' : ''}" data-d="${k}" style="--h:${(h * 100).toFixed(0)}%" title="${D ? `${fmt(D.total)} m tendidos${D.nPuntas ? ` · ${D.nPuntas} puntas` : ''}` : 'Sin registros'}">
      <span class="n">${d}</span>${D && D.total ? `<span class="m">${D.total >= 1000 ? fmt(D.total / 1000, 1) + 'k' : fmt(D.total)}</span>` : ''}
      <span class="dots">${catsUso().filter((c) => D && D.m[c] > 0).map((c) => `<i class="c-${c}"></i>`).join('')}${D && D.nPuntas ? '<i class="c-pt"></i>' : ''}${D && D.fund.length ? '<i class="c-fd"></i>' : ''}</span></button>`;
  }
  cal += '</div>';
  const mesTot = delMes.reduce((a, D) => a + D.total, 0), mesDias = delMes.filter((D) => D.total > 0).length;
  const mejor = delMes.reduce((a, D) => (!a || D.total > a.total ? D : a), null);
  cal += `<div class="legend" style="margin-top:10px">${catsUso().map((c) => `<span><i class="c-${c}"></i>${c}</span>`).join('')}<span><i class="c-pt"></i>Puntas</span><span><i class="c-fd"></i>Fundaciones</span></div>
    <div class="kpis" style="grid-template-columns:1fr 1fr;margin-top:14px">${kpi('Tendido en el mes', mesTot)}${kpi('Días con tendido', mesDias, '')}${kpi('Promedio por día', mesDias ? mesTot / mesDias : 0)}${kpi('Mejor día', mejor ? mejor.total : 0, mejor ? `m · ${new Date(mejor.fecha + 'T12:00:00').getDate()}/${m + 1}` : 'm')}</div>
    ${sinFecha ? `<p class="hint">${fmt(sinFecha)} m tendidos no tienen fecha cargada y no figuran en el calendario.</p>` : ''}`;
  // detalle del día
  const D = dias.get(ui.dia);
  let det = `<h3>${fechaLarga(ui.dia)}</h3>`;
  det += diaHTML(D);
  // columnas del mes
  const colsData = [];
  for (let d = 1; d <= nd; d++) { const k = `${ym}-${String(d).padStart(2, '0')}`, X = dias.get(k); colsData.push({ key: k, label: String(d), sel: k === ui.dia, tip: fechaCorta(k), parts: catsUso().map((c) => ({ v: X ? X.m[c] : 0, color: SERIE[c], name: CATN[c] })) }); }
  el.innerHTML = `<div class="diario"><div class="card calcard">${cal}</div><div class="card daycard">${det}</div></div>
    <div class="card" style="margin-top:16px"><h3>Metros tendidos por día · ${MESES[m]} ${y}</h3>${Charts.cols(colsData)}${Charts.legend(catsUso().map((c) => [SERIE[c], CATN[c]]))}</div>`;
  $$('[data-cm]', el).forEach((b) => { b.onclick = () => { let mm = ui.cal.m + Number(b.dataset.cm), yy = ui.cal.y; if (mm < 0) { mm = 11; yy--; } if (mm > 11) { mm = 0; yy++; } ui.cal = { y: yy, m: mm }; render(false); }; });
  $$('[data-d]', el).forEach((b) => { b.onclick = () => { ui.dia = b.dataset.d; render(false); }; });
  $$('[data-dkey]', el).forEach((b) => { b.onclick = () => { ui.dia = b.dataset.dkey; render(false); }; });
  Charts.bindTips(el);
}
// HTML del detalle de un día (pantalla y PDF)
function diaHTML(D, pdf) {
  if (!D) return `<div class="empty" style="padding:30px 10px"><b>Sin registros este día</b>Los tendidos aparecen acá con la fecha que se carga en Tender.</div>`;
  const sec = [...D.sec.entries()].sort((a, b) => b[1] - a[1]);
  const maxS = Math.max(1, ...sec.map((x) => x[1]));
  const circ = [...D.circ.values()].sort((a, b) => (a.c.cat === b.c.cat ? a.c.idx - b.c.idx : catsUso().indexOf(a.c.cat) - catsUso().indexOf(b.c.cat)));
  const nCirc = circ.filter((o) => o.c.cat !== 'PAT').length;
  let h = `<div class="kpis k4" style="margin-bottom:14px">${kpi('Metros tendidos', D.total)}${kpi('Circuitos', nCirc, `${circ.length - nCirc ? `+ ${circ.length - nCirc} PAT` : ''}`)}${kpi('Conductores', D.nCond, '')}${kpi('Puntas colocadas', D.nPuntas, '')}</div>`;
  if (sec.length) h += `<div class="secbars">${sec.map(([k, v]) => { const [cat, s2] = k.split('|'); return `<div class="sb"><span><i class="cdot c-${cat}"></i>${cat} ${s2} mm²</span><div class="sbt"><div style="width:${((v / maxS) * 100).toFixed(1)}%;background:${SERIE[cat]}"></div></div><b>${fmt(v, 1)} m</b></div>`; }).join('')}</div>`;
  if (circ.length) {
    h += `<table class="tbl dtbl" style="margin-top:12px"><thead><tr><th>Tipo</th><th>Circuito</th><th>Recorrido</th><th class="num">Sección</th><th class="num">Cond.</th><th class="num">Metros</th><th class="num">Lista</th><th>Bobina</th></tr></thead><tbody>
      ${circ.map((o) => { const c = o.c; const tot = c.fz.length; return `<tr><td><span class="cchip c-${c.cat}" style="margin:0;top:0">${c.cat}</span></td><td><b class="mono">${esc(c.cat === 'PAT' ? 'PAT ' + c.seccion : c.designacion)}</b></td><td>${esc(c.desde)} → ${esc(c.hasta)}</td><td class="num">${c.seccion}</td><td class="num">${o.fases.length === tot ? tot : `${o.fases.length}/${tot}`}</td><td class="num"><b>${fmt(o.m, 1)}</b></td><td class="num muted">${o.teo ? fmt(o.teo, 1) : '–'}</td><td>${[...o.bob].map(esc).join(', ')}</td></tr>`; }).join('')}
      </tbody></table>`;
  }
  if (D.puntas.length) h += `<h4 class="dh">Puntas colocadas</h4><div class="chips">${D.puntas.map((x) => `<span class="chip">${esc(x.c.designacion)} · ${esc(ladoNom(x.c, x.k))} · ${x.n}</span>`).join('')}</div>`;
  if (D.zanjas.length) h += `<h4 class="dh">Zanjas cerradas</h4><div class="chips">${D.zanjas.map((z) => `<span class="chip lista">${esc(z.titulo)} · ${fmt(z.largo, 1)} m</span>`).join('')}</div>`;
  if (D.fund.length) h += `<h4 class="dh">Fundaciones STS</h4><div class="chips">${D.fund.map((x) => `<span class="chip ${x.t === 'fin' ? 'lista' : ''}">${x.st} · ${esc(x.n)} · ${x.t === 'fin' ? 'terminada' : 'inicio'}</span>`).join('')}</div>`;
  if (D.bobinas.size) h += `<h4 class="dh">Bobinas usadas</h4><div class="chips">${[...D.bobinas].sort((a, b) => a.localeCompare(b, 'es', { numeric: true })).map((b) => `<span class="chip">${esc(b)}</span>`).join('')}</div>`;
  return h;
}
// ======================= PUNTAS DE CABLE =======================
function vPuntas(el) {
  const cat = ui.ptCat || 'BT', f = ui.ptF || 'all', q = (ui.ptQ || '').toLowerCase();
  const sel = [...ui.sel];
  const btns = [['Exportar Excel', 'btn', () => exportPuntas()], ['PDF', 'btn', () => printPuntas()]];
  if (sel.length) btns.unshift([`${cat === 'BT' ? 'Lado inversor' : 'Origen'} (${sel.length})`, 'btn acc', () => registrarPuntas(sel, ['o'])], [`${cat === 'BT' ? 'Lado STS' : 'Destino'} (${sel.length})`, 'btn acc', () => registrarPuntas(sel, ['d'])], [`Ambos lados (${sel.length})`, 'btn pri', () => registrarPuntas(sel, ['o', 'd'])]);
  actions(btns);
  const cs = R.circuitos.filter((c) => c.cat !== 'PAT' && c.cat !== 'LA');
  // tarjetas por sección
  const keys = [...new Set(cs.map((c) => `${c.cat}|${c.seccion}`))].sort((a, b) => (a[0] === b[0] ? Number(b.split('|')[1]) - Number(a.split('|')[1]) : a.localeCompare(b)));
  let h = `<div class="grid g4 stagger ptiles" style="margin-bottom:16px">${keys.map((k) => {
    const [c2, s2] = k.split('|'); const g = cs.filter((c) => `${c.cat}|${c.seccion}` === k).map(puntasDe); const tot = g.reduce((a, x) => a + x.tot, 0), col = g.reduce((a, x) => a + x.col, 0);
    return `<div class="card tile"><div>${Charts.ring(tot ? col / tot : 0, SERIE[c2], 'colocadas')}</div><div><h3 style="margin-bottom:6px">${ctag(c2)}${c2} ${s2} mm²</h3>${kpi('Puntas', col, `/ ${fmt(tot)}`)}<div class="muted" style="margin-top:4px">${g.length} circuito${g.length > 1 ? 's' : ''} · ${g.reduce((a, x) => a + x.n, 0)} conductores</div></div></div>`;
  }).join('')}</div>`;
  h += `<div class="tools"><div class="seg" id="fPtC"><button data-v="BT">${CATN.BT}</button><button data-v="MT">${CATN.MT}</button></div>
    <div class="seg" id="fPtF"><button data-v="all">Todas</button><button data-v="pend">Pendientes</button><button data-v="ok">Completas</button></div>
    <span class="sp"></span><input type="search" id="ptQ" placeholder="Buscar circuito, inversor, STS…" value="${esc(ui.ptQ || '')}" style="width:220px"></div>`;
  let rows = cs.filter((c) => c.cat === cat).map((c) => ({ c, p: puntasDe(c), g: tramo(c) }));
  if (f === 'pend') rows = rows.filter((r) => r.p.col < r.p.tot); if (f === 'ok') rows = rows.filter((r) => r.p.col === r.p.tot);
  if (q) rows = rows.filter((r) => `${r.c.designacion} ${r.c.desde} ${r.c.hasta}`.toLowerCase().includes(q));
  const grupos = new Map(); rows.forEach((r) => { if (!grupos.has(r.g)) grupos.set(r.g, []); grupos.get(r.g).push(r); });
  const orden = cat === 'MT' ? ['STS – STS', 'STS – Sala de celdas', 'Sala de celdas – Piquete LMT', 'Piquete – ET', 'Otros'] : [...grupos.keys()].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
  const btn = (r, k) => { const v = r.p[k], pp = r.p[k === 'o' ? 'po' : 'pd']; const cls = v === r.p.n ? 'on' : v > 0 ? 'part' : ''; return `<button class="ptb ${cls}" data-pt="${r.c.id}|${k}" title="${esc(ladoNom(r.c, k))}">${v === r.p.n ? '✓' : v > 0 ? '◐' : '○'} ${v}/${r.p.n}${pp && pp.fecha && v ? `<small>${fechaCorta(pp.fecha).slice(0, 5)}</small>` : ''}</button>`; };
  h += `<div class="card tblcard"><div class="tblwrap"><table class="tbl"><thead><tr><th class="cb"><input type="checkbox" id="ptAll"></th><th>Circuito</th><th>Recorrido</th><th class="num">Sección</th><th class="num">Cond.</th><th>${cat === 'BT' ? 'Lado inversor' : 'Extremo origen'}</th><th>${cat === 'BT' ? 'Lado STS' : 'Extremo destino'}</th><th class="num">Puntas</th></tr></thead><tbody>`;
  orden.filter((g) => grupos.has(g)).forEach((g) => {
    const rr = grupos.get(g), tt = rr.reduce((a, r) => a + r.p.tot, 0), cc = rr.reduce((a, r) => a + r.p.col, 0);
    h += `<tr class="grow-h"><td colspan="8"><b>${esc(g)}</b><span class="muted"> · ${cc}/${tt} puntas</span></td></tr>`;
    rr.forEach((r) => { h += `<tr data-id="${r.c.id}"><td class="cb"><input type="checkbox" class="rs" data-id="${r.c.id}" ${ui.sel.has(r.c.id) ? 'checked' : ''}></td><td><b class="mono">${esc(r.c.designacion)}</b></td><td>${esc(r.c.desde)} → ${esc(r.c.hasta)}</td><td class="num">${r.c.seccion}</td><td class="num">${r.p.n}</td><td>${btn(r, 'o')}${cat === 'MT' ? `<div class="muted" style="font-size:11px">${esc(r.c.desde)}</div>` : ''}</td><td>${btn(r, 'd')}${cat === 'MT' ? `<div class="muted" style="font-size:11px">${esc(r.c.hasta)}</div>` : ''}</td><td class="num"><b>${r.p.col}</b>/${r.p.tot}</td></tr>`; });
  });
  if (!rows.length) h += `<tr><td colspan="8" class="muted" style="padding:20px">Sin circuitos con este filtro</td></tr>`;
  h += `</tbody></table></div></div><p class="hint">Dos puntas por conductor: una en cada extremo. Tocá un extremo para registrar cuántas puntas se colocaron y la fecha, o tildá varios circuitos y usá los botones de arriba para registrar todos juntos.</p>`;
  el.innerHTML = h;
  segBind('#fPtC', cat, (v) => { ui.ptCat = v; ui.sel.clear(); render(true); });
  segBind('#fPtF', f, (v) => { ui.ptF = v; render(false); });
  searchBind('#ptQ', (v) => { ui.ptQ = v; });
  $$('.rs', el).forEach((c) => { c.onchange = () => { c.checked ? ui.sel.add(c.dataset.id) : ui.sel.delete(c.dataset.id); render(false); }; });
  const all = $('#ptAll', el); if (all) { all.checked = rows.length && rows.every((r) => ui.sel.has(r.c.id)); all.onchange = () => { rows.forEach((r) => (all.checked ? ui.sel.add(r.c.id) : ui.sel.delete(r.c.id))); render(false); }; }
  $$('[data-pt]', el).forEach((b) => { b.onclick = () => { const [id, k] = b.dataset.pt.split('|'); registrarPuntas([id], [k], true); }; });
  Charts.bindTips(el);
}
async function registrarPuntas(ids, lados, uno) {
  if (window.READONLY) return;
  const rcs = ids.map((id) => R.circuitos.find((c) => c.id === id)).filter(Boolean); if (!rcs.length) return;
  if (uno && rcs.length === 1 && lados.length === 1) {
    const rc = rcs[0], k = lados[0], p = puntasDe(rc), cur = k === 'o' ? p.po : p.pd;
    const res = await modal({ title: `Puntas · ${esc(rc.designacion)}`, sub: `${esc(ladoNom(rc, k))} · ${esc(rc.desde)} → ${esc(rc.hasta)} · ${rc.seccion} mm²`,
      body: `<div class="form"><label>Puntas colocadas (de ${p.n})<input type="number" name="n" min="0" max="${p.n}" step="1" value="${cur ? cur.n : p.n}"></label><label>Fecha<input type="date" name="f" value="${(cur && cur.fecha) || today()}"></label><label class="full">Observación<input name="obs" value="${esc((cur && cur.obs) || '')}" placeholder="Opcional"></label></div>`,
      buttons: [...(cur ? [['Quitar registro', 'btn danger', () => 'del']] : []), ['Cancelar', 'btn', () => null], ['Guardar', 'btn pri', (box) => ({ n: Math.max(0, Math.min(p.n, Math.round(Number($('[name=n]', box).value) || 0))), fecha: $('[name=f]', box).value || today(), obs: $('[name=obs]', box).value.trim() })]] });
    if (!res) return;
    const c = S.circuitos.find((x) => x.id === rc.id); c.puntas = Object.assign({}, c.puntas);
    if (res === 'del' || !res.n) delete c.puntas[k]; else { c.puntas[k] = res; if (!res.obs) delete res.obs; }
    ui.flash = [rc.id]; commit(res === 'del' || !res.n ? 'Registro de puntas quitado' : `Puntas de ${rc.designacion} · ${ladoCorto(rc, k)}: ${res.n}`);
    return;
  }
  const nom = lados.length === 2 ? 'ambos lados' : rcs[0].cat === 'BT' ? (lados[0] === 'o' ? 'lado inversor' : 'lado STS') : (lados[0] === 'o' ? 'extremo origen' : 'extremo destino');
  const tot = rcs.reduce((a, c) => a + c.fz.length * lados.length, 0);
  const fe = await modal({ title: `Registrar puntas · ${nom}`, sub: `${rcs.length} circuito${rcs.length > 1 ? 's' : ''} · ${tot} puntas`,
    body: `<p>Se marcan como colocadas todas las puntas del ${nom} de: ${rcs.map((c) => `<b>${esc(c.designacion)}</b>`).join(', ')}.</p><div class="form"><label>Fecha<input type="date" name="f" value="${today()}"></label></div>`,
    buttons: [['Cancelar', 'btn', () => null], ['Registrar', 'btn pri', (box) => $('[name=f]', box).value || today()]] });
  if (!fe) return;
  rcs.forEach((rc) => { const c = S.circuitos.find((x) => x.id === rc.id); c.puntas = Object.assign({}, c.puntas); lados.forEach((k) => { c.puntas[k] = { n: rc.fz.length, fecha: fe }; }); });
  ui.flash = ids; ui.sel.clear(); commit(`${tot} puntas registradas (${nom})`);
}
// ======================= exportaciones nuevas =======================
async function exportTendidos() {
  const { dias } = datosPorFecha();
  const p = await window.api.saveBinary(IO.exportTendidos(S, R, dias, { tramo, ladoNom, puntasDe }), `Tendido por fecha ${today()}.xlsx`, 'xlsx', 'Excel');
  if (p) toast('Excel exportado', { action: ['Abrir', () => window.api.openPath(p)] });
}
async function exportPuntas() {
  const p = await window.api.saveBinary(IO.exportPuntas(S, R, { tramo, ladoNom, puntasDe }), `Puntas de cable ${today()}.xlsx`, 'xlsx', 'Excel');
  if (p) toast('Excel exportado', { action: ['Abrir', () => window.api.openPath(p)] });
}
async function printHTML(html, name, landscape) {
  const pa = $('#printArea');
  pa.innerHTML = `<div class="prdoc">${html}</div>`;
  $$('.rfg', pa).forEach((c) => { c.style.strokeDashoffset = c.dataset.off; });
  $$('[data-w]', pa).forEach((x) => { x.style.width = x.dataset.w; });
  $$('[data-count]', pa).forEach((x) => { x.firstChild.nodeValue = fmt(Number(x.dataset.count), Number(x.dataset.dec || 0)); });
  $$('.hero, .updbar', pa).forEach((x) => x.remove());
  document.body.classList.toggle('pr-land', !!landscape);
  document.body.classList.add('imprimiendo'); await new Promise((r) => requestAnimationFrame(() => r())); aplanarTransparencias(pa);
  document.documentElement.style.background = document.body.style.background = '#fff';
  const p = await window.api.printPDF(name, { landscape });
  document.body.classList.remove('imprimiendo');
  document.documentElement.style.background = document.body.style.background = '';
  if (p) toast('PDF guardado', { action: ['Abrir', () => window.api.openPath(p)] });
}
const prHead = (t, sub) => `<div class="pr-h"><div><h1>${t}</h1>${esc(S.nombre)}${sub ? ' · ' + sub : ''}</div><div>${esc(ED.app)} · ${new Date().toLocaleString('es-AR')}</div></div>`;
function printDia(d) {
  const { dias } = datosPorFecha();
  printHTML(prHead(`Tendido del ${fechaLarga(d).replace(/^./, (x) => x.toLowerCase())}`) + `<div class="card">${diaHTML(dias.get(d), true)}</div>`, `Tendido ${d}.pdf`);
}
function printMes(ym) {
  const { dias } = datosPorFecha();
  const [y, m] = ym.split('-').map(Number), nd = new Date(y, m, 0).getDate();
  const ds = [...dias.values()].filter((D) => D.fecha.startsWith(ym)).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const colsData = []; for (let d = 1; d <= nd; d++) { const k = `${ym}-${String(d).padStart(2, '0')}`, X = dias.get(k); colsData.push({ label: String(d), parts: catsUso().map((c) => ({ v: X ? X.m[c] : 0, color: SERIE[c], name: c })) }); }
  const t = (c) => ds.reduce((a, D) => a + D.m[c], 0), tot = CATK.reduce((a, c) => a + t(c), 0);
  let h = prHead(`Tendido de ${MESES[m - 1]} ${y}`);
  h += `<div class="card"><div class="kpis k4">${kpi('Total del mes', tot)}${kpi('BT', t('BT'))}${kpi('MT', t('MT'))}${kpi('PAT', t('PAT'))}${t('LA') > 0 ? kpi('Línea aérea', t('LA')) : ''}</div>${Charts.cols(colsData, { h: 170 })}${Charts.legend(catsUso().map((c) => [SERIE[c], CATN[c]]))}</div>`;
  h += `<div class="card prday"><h3>Resumen por día</h3><table class="tbl dtbl"><thead><tr><th>Fecha</th><th class="num">BT</th><th class="num">MT</th><th class="num">PAT</th><th class="num">Total</th><th class="num">Circuitos</th><th class="num">Puntas</th><th>Zanjas cerradas</th></tr></thead><tbody>
    ${ds.map((D) => `<tr><td>${fechaCorta(D.fecha)}</td><td class="num">${fmt(D.m.BT)}</td><td class="num">${fmt(D.m.MT)}</td><td class="num">${fmt(D.m.PAT)}</td><td class="num"><b>${fmt(D.total)}</b></td><td class="num">${[...D.circ.values()].filter((o) => o.c.cat !== 'PAT').length}</td><td class="num">${D.nPuntas || ''}</td><td>${D.zanjas.length || ''}</td></tr>`).join('')}</tbody></table></div>`;
  ds.forEach((D) => { h += `<div class="card prday"><h3>${fechaLarga(D.fecha)}</h3>${diaHTML(D, true)}</div>`; });
  if (!ds.length) h += '<p>Sin tendidos registrados en el mes.</p>';
  printHTML(h, `Tendido ${ym}.pdf`);
}
function printAvance() {
  printHTML(prHead('Avance de obra') + $('#view').innerHTML, `Avance ${today()}.pdf`, true);
}
function printPuntas() {
  const cs = R.circuitos.filter((c) => c.cat !== 'PAT' && c.cat !== 'LA');
  let h = prHead('Puntas de cable colocadas');
  ['BT', 'MT'].forEach((cat) => {
    const rows = cs.filter((c) => c.cat === cat); if (!rows.length) return;
    const g = new Map(); rows.forEach((c) => { const k = tramo(c); if (!g.has(k)) g.set(k, []); g.get(k).push(c); });
    h += `<div class="card prday"><h3>${ctag(cat)}${CATN[cat]}</h3><table class="tbl dtbl"><thead><tr><th>Circuito</th><th>Recorrido</th><th class="num">Sección</th><th>${cat === 'BT' ? 'Lado inversor' : 'Origen'}</th><th>${cat === 'BT' ? 'Lado STS' : 'Destino'}</th><th class="num">Puntas</th></tr></thead><tbody>`;
    [...g.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es', { numeric: true })).forEach(([k, cc]) => {
      h += `<tr class="grow-h"><td colspan="6"><b>${esc(k)}</b></td></tr>`;
      cc.forEach((c) => { const p = puntasDe(c); const l = (v, pp) => `${v}/${p.n}${pp && pp.fecha && v ? ' · ' + fechaCorta(pp.fecha) : ''}`; h += `<tr><td>${esc(c.designacion)}</td><td>${esc(c.desde)} → ${esc(c.hasta)}</td><td class="num">${c.seccion}</td><td>${l(p.o, p.po)}</td><td>${l(p.d, p.pd)}</td><td class="num">${p.col}/${p.tot}</td></tr>`; });
    });
    h += '</tbody></table></div>';
  });
  printHTML(h, `Puntas de cable ${today()}.pdf`);
}
