/* PSFV-OBE II · Trackers · Montaje: armado de estructuras e instalación de paneles, por tracker y por etapa.
   Datos: S.montaje [{id: 'arm|TRK-001', tipo: 'arm'|'pan', trk, et: {etapa: fecha}, o?}] (se sincroniza por tracker).
   También: stock de materiales en obra = recibido conforme − consumido por la ejecución (hincado y montaje). */
const MON_ET = {
  arm: [['cab', 'Rodamientos y piezas mecánicas', ['BEARING', 'MECH. PARTS']], ['mot', 'Motor (slewing drive)', ['DRIVE UNIT']], ['tub', 'Vigas de torsión', ['BEAM']],
    ['amo', 'Amortiguadores', ['DAMPER']], ['cor', 'Correas Ω', ['PURLIN']], ['tcu', 'TCU', ['TCU']], ['ajt', 'Torqueado y control final', ['FASTENER']]],
  pan: [['mod', 'Módulos colocados', []], ['fij', 'Fijación y torqueado', []], ['str', 'Conexionado de strings', []]],
};
const MON_T = { arm: ['Armado de estructuras', '#3fb27f', 'armado'], pan: ['Instalación de paneles', '#f0a23b', 'paneles'] };
const monL = () => (S.montaje = Array.isArray(S.montaje) ? S.montaje : []);
const monIdx = () => new Map(monL().map((r) => [r.id, r]));
const modsDe = (t) => (t.t === '1P26' ? 26 : 52);
const monTrk = () => (window.PLANO ? window.PLANO.trk : []);
// estado de un tracker: 0 sin empezar, 1 en curso, 2 terminado
function monEstado(r, tipo) { const n = MON_ET[tipo].length, h = r ? MON_ET[tipo].filter(([k]) => r.et && r.et[k]).length : 0; return h === 0 ? 0 : h === n ? 2 : 1; }
function monInfo(tipo) {
  const T = monTrk(), ix = monIdx(), et = MON_ET[tipo];
  const porEt = Object.fromEntries(et.map(([k]) => [k, 0])); let term = 0, curso = 0, hechas = 0, mods = 0;
  const porSec = {};
  T.forEach((t) => { const r = ix.get(tipo + '|' + t.id), e = monEstado(r, tipo); const s = (porSec[t.s] = porSec[t.s] || { n: 0, h: 0, p: 0 });
    s.n++; if (e === 2) { term++; s.h++; } else if (e === 1) curso++;
    et.forEach(([k]) => { if (r && r.et && r.et[k]) { porEt[k]++; hechas++; s.p++; if (k === 'mod') mods += modsDe(t); } }); });
  const n = T.length, p = n ? hechas / (n * et.length) : 0;
  Object.values(porSec).forEach((s) => { s.p = s.n ? s.p / (s.n * et.length) : 0; });
  return { n, term, curso, porEt, p, mods, modsTot: T.reduce((a, t) => a + modsDe(t), 0), porSec };
}
// para el parte diario
function montDia(f) {
  const lineas = []; let n = 0;
  ['arm', 'pan'].forEach((tipo) => {
    const c = {}; let mods = 0, comp = 0; const T = new Map(monTrk().map((t) => [t.id, t])), nE = MON_ET[tipo].length;
    monL().filter((r) => r.tipo === tipo).forEach((r) => { const ks = Object.entries(r.et || {}).filter(([, v]) => v === f).map(([k]) => k); if (!ks.length) return; n += ks.length;
      if (ks.includes('mod') && T.get(r.trk)) mods += modsDe(T.get(r.trk));
      if (ks.length === nE) comp++; else ks.forEach((k) => (c[k] = (c[k] || 0) + 1)); });
    if (comp) lineas.push(`${tipo === 'arm' ? 'Estructura completa' : 'Paneles completos'}: ${comp} tracker${comp > 1 ? 's' : ''}`);
    MON_ET[tipo].forEach(([k, nom]) => { if (c[k]) lineas.push(`${tipo === 'arm' ? 'Estructura' : 'Paneles'} · ${nom}: ${c[k]} tracker${c[k] > 1 ? 's' : ''}${k === 'mod' ? ` (${fmt(mods)} módulos)` : ''}`); });
    if (mods && !c.mod) lineas.push(`Módulos colocados: ${fmt(mods)}`);
  });
  return { n, lineas };
}

const MUI = { s: 'all', e: 'all', q: '', modo: 'tabla' };
function vMont(el, tipo) {
  const T = monTrk(); if (!T.length) { el.innerHTML = '<div class="card empty"><b>Sin plano cargado</b></div>'; return; }
  const I = monInfo(tipo), ix = monIdx(), et = MON_ET[tipo], [tit, col] = MON_T[tipo], HA = (S.hincado || {}).avance || {};
  const n = ui.sel.size ? ` (${ui.sel.size})` : '', dis = ui.sel.size ? '' : ' dis';
  actions([['Exportar Excel', 'btn', () => monExcel(tipo)], ['PDF para campo', 'btn', () => monPdf(tipo)], [`Cargar avance${n}`, 'btn acc' + dis, () => monMarcar(tipo, [...ui.sel])]]);
  let list = T.slice();
  if (MUI.s !== 'all') list = list.filter((t) => t.s === MUI.s);
  if (MUI.e !== 'all') list = list.filter((t) => { const e = monEstado(ix.get(tipo + '|' + t.id), tipo); return MUI.e === 'p' ? e === 0 : MUI.e === 'c' ? e === 1 : MUI.e === 't' ? e === 2 : !HA[t.id] ? false : e < 2; });
  if (MUI.q) { const q = MUI.q.toUpperCase(); const m = q.match(/(\d+)\s*(?:-|A|AL|\.\.)\s*(\d+)/); if (m) { const a = +m[1], b = +m[2]; list = list.filter((t) => { const k = +t.id.replace(/\D/g, ''); return k >= Math.min(a, b) && k <= Math.max(a, b); }); } else list = list.filter((t) => t.id.includes(q)); }
  const secs = [...new Set(T.map((t) => t.s))].sort();
  const pct = (a, b) => (b ? (a / b) * 100 : 0);
  const prev = tipo === 'pan' ? monInfo('arm') : null;
  el.innerHTML = `<div class="grid g4 stagger" style="margin-bottom:14px">
      <div class="card kpi"><div class="kl">Avance ${tipo === 'arm' ? 'de estructura' : 'de paneles'}</div><div class="kv">${fmt(I.p * 100, 1)}<small> %</small></div><div class="sbt"><div style="width:${(I.p * 100).toFixed(1)}%;background:${col}"></div></div><div class="muted">etapas cumplidas sobre el total</div></div>
      <div class="card kpi"><div class="kl">Trackers terminados</div><div class="kv">${fmt(I.term)}<small> / ${fmt(I.n)}</small></div><div class="muted">${fmt(I.curso)} en curso</div></div>
      ${tipo === 'pan' ? `<div class="card kpi"><div class="kl">Módulos colocados</div><div class="kv">${fmt(I.mods)}<small> / ${fmt(I.modsTot)}</small></div><div class="muted">${fmt(pct(I.mods, I.modsTot), 1)} %</div></div>
        <div class="card kpi"><div class="kl">Frente disponible</div><div class="kv">${fmt(Math.max(0, prev.term - I.term))}</div><div class="muted">trackers con estructura terminada sin paneles</div></div>`
      : `<div class="card kpi"><div class="kl">Hincados sin estructura</div><div class="kv">${fmt(T.filter((t) => HA[t.id] && monEstado(ix.get('arm|' + t.id), 'arm') === 0).length)}</div><div class="muted">frente disponible para armar</div></div>
        <div class="card kpi"><div class="kl">Hincado</div><div class="kv">${fmt(Object.keys(HA).length)}<small> / ${fmt(I.n)}</small></div><div class="muted">trackers hincados</div></div>`}
    </div>
    <div class="card" style="margin-bottom:14px"><h3>Avance por etapa</h3><div class="moet">${et.map(([k, nom]) => `<div class="mrow"><span>${esc(nom)}</span><div class="sbt"><div style="width:${pct(I.porEt[k], I.n).toFixed(1)}%;background:${col}"></div></div><b>${fmt(I.porEt[k])}</b></div>`).join('')}</div></div>
    <div class="tools"><div class="seg" id="mS"><button data-v="all">Todos</button>${secs.map((s) => `<button data-v="${s}">S${s}</button>`).join('')}</div>
      <div class="seg" id="mE"><button data-v="all">Todos</button><button data-v="p">Sin empezar</button><button data-v="c">En curso</button><button data-v="t">Terminados</button>${tipo === 'arm' ? '<button data-v="f">Hincados pendientes</button>' : ''}</div>
      <span class="sp"></span><span class="muted">${list.length} trackers</span><input type="search" id="mQ" placeholder="TRK-12 o rango 100-150" value="${esc(MUI.q)}" style="width:190px"></div>
    <div class="tblwrap" style="max-height:calc(100vh - 420px)"><table class="tbl motbl"><thead><tr><th><input type="checkbox" id="selAll"></th><th>Tracker</th><th>Sector</th><th>Tipo</th>${tipo === 'arm' ? '<th>Hincado</th>' : '<th>Estructura</th>'}${et.map(([, nom]) => `<th class="moth" title="${esc(nom)}">${esc(nom.split(' ')[0])}</th>`).join('')}<th>Estado</th></tr></thead><tbody>
    ${list.map((t) => { const r = ix.get(tipo + '|' + t.id), e = monEstado(r, tipo), pre = tipo === 'arm' ? HA[t.id] : monEstado(ix.get('arm|' + t.id), 'arm') === 2;
      return `<tr data-id="${t.id}" class="${ui.sel.has(t.id) ? 'sel' : ''}"><td><input type="checkbox" class="sel" ${ui.sel.has(t.id) ? 'checked' : ''}></td><td><b>${t.id}</b></td><td>S${t.s}</td><td>${t.t}</td>
        <td>${pre ? '<span class="tpos">✓</span>' : '<span class="muted">–</span>'}</td>
        ${et.map(([k]) => { const f = r && r.et && r.et[k]; return `<td class="moc">${f ? `<span class="mod" style="--c:${col}" title="${fechaCorta(f)}">${fechaCorta(f).slice(0, 5)}</span>` : '<span class="mop"></span>'}</td>`; }).join('')}
        <td>${e === 2 ? '<span class="pill p-done">terminado</span>' : e === 1 ? '<span class="pill p-warn">en curso</span>' : '<span class="muted">pendiente</span>'}</td></tr>`; }).join('')}
    </tbody></table></div>
    <p class="hint">Tildá trackers (o escribí un rango como <b>100-150</b> y tildá todos) y tocá <b>Cargar avance</b>: elegís las etapas y la fecha. ${tipo === 'arm' ? 'Avisa si algún tracker no está hincado.' : 'Avisa si algún tracker no tiene la estructura terminada.'} En el <b>Plano de obra</b> se puede pintar por ${MON_T[tipo][2]}.</p>`;
  segBind('#mS', MUI.s, (v) => { MUI.s = v; render(false); });
  segBind('#mE', MUI.e, (v) => { MUI.e = v; render(false); });
  const q = $('#mQ', el); q.oninput = () => { MUI.q = q.value.trim(); clearTimeout(q._t); q._t = setTimeout(() => render(false), 350); };
  bindSel(el, list);
}
async function monMarcar(tipo, ids) {
  if (window.READONLY || !ids.length) return;
  const ix = monIdx(), et = MON_ET[tipo], HA = (S.hincado || {}).avance || {};
  const sinPre = ids.filter((id) => (tipo === 'arm' ? !HA[id] : monEstado(ix.get('arm|' + id), 'arm') < 2));
  const hechas = Object.fromEntries(et.map(([k]) => [k, ids.filter((id) => { const r = ix.get(tipo + '|' + id); return r && r.et && r.et[k]; }).length]));
  const res = await modal({ title: `${MON_T[tipo][0]} · ${ids.length} tracker${ids.length > 1 ? 's' : ''}`, sub: ids.slice(0, 12).join(', ') + (ids.length > 12 ? '…' : ''),
    body: `<div class="form"><div class="moch">${et.map(([k, nom]) => `<label class="chk"><input type="checkbox" value="${k}"> ${esc(nom)}${hechas[k] ? ` <small class="muted">(${hechas[k] === ids.length ? 'ya cargada' : hechas[k] + ' ya cargados'})</small>` : ''}</label>`).join('')}
      <label class="chk" style="margin-top:6px"><input type="checkbox" id="moAll"> <b>Todas las etapas</b></label></div>
      <label>Fecha<input type="date" id="moF" value="${today()}"></label>
      ${sinPre.length ? `<p class="hint" style="color:#b9532f">⚠ ${sinPre.length} tracker${sinPre.length > 1 ? 's' : ''} ${tipo === 'arm' ? 'sin hincado registrado' : 'sin la estructura terminada'}: ${sinPre.slice(0, 8).join(', ')}${sinPre.length > 8 ? '…' : ''}</p>` : ''}</div>`,
    buttons: [['Cancelar', 'btn', () => null], ['Quitar etapas', 'btn danger', (b) => ({ q: 1, ks: [...b.querySelectorAll('.moch input[value]:checked')].map((x) => x.value) })],
      ['Registrar', 'btn pri', (b) => ({ f: $('#moF', b).value || today(), ks: [...b.querySelectorAll('.moch input[value]:checked')].map((x) => x.value) })]] });
  if (!res || !res.ks.length) { if (res) toast('Elegí al menos una etapa', { err: true }); return; }
  ids.forEach((id) => { const key = tipo + '|' + id; let r = ix.get(key);
    if (!r) { if (res.q) return; r = { id: key, tipo, trk: id, et: {} }; monL().push(r); ix.set(key, r); }
    r.et = r.et || {}; res.ks.forEach((k) => { if (res.q) delete r.et[k]; else r.et[k] = res.f; }); });
  S.montaje = monL().filter((r) => Object.keys(r.et || {}).length);
  ui.sel.clear();
  const noms = res.ks.map((k) => et.find((x) => x[0] === k)[1]).join(', ');
  commit(`${MON_T[tipo][0]}: ${noms} ${res.q ? 'quitadas' : '· ' + fechaCorta(res.f)} en ${ids.length} tracker${ids.length > 1 ? 's' : ''}`);
}
// el tilde "Todas las etapas" del modal
document.addEventListener('change', (e) => { if (e.target && e.target.id === 'moAll') document.querySelectorAll('.moch input[value]').forEach((x) => (x.checked = e.target.checked)); });

function monExcel(tipo) {
  const ix = monIdx(), et = MON_ET[tipo];
  const rows = [['Tracker', 'Sector', 'Tipo', ...et.map((x) => x[1]), 'Estado']].concat(monTrk().map((t) => { const r = ix.get(tipo + '|' + t.id), e = monEstado(r, tipo);
    return [t.id, t.s, t.t, ...et.map(([k]) => (r && r.et && r.et[k]) || ''), ['pendiente', 'en curso', 'terminado'][e]]; }));
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), MON_T[tipo][0].slice(0, 30));
  monGuardar(wb, `${MON_T[tipo][0]} ${today()}.xlsx`);
}
function monPdf(tipo) {
  const ix = monIdx(), et = MON_ET[tipo];
  let list = monTrk(); if (MUI.s !== 'all') list = list.filter((t) => t.s === MUI.s);
  const I = monInfo(tipo);
  printHTML(prHead(MON_T[tipo][0], `${MUI.s === 'all' ? 'Todos los sectores' : 'Sector ' + MUI.s} · avance ${fmt(I.p * 100, 1)} %`) + `<table class="tbl"><thead><tr><th>Tracker</th><th>Sector</th><th>Tipo</th>${et.map(([, n]) => `<th>${esc(n)}</th>`).join('')}</tr></thead><tbody>
    ${list.map((t) => { const r = ix.get(tipo + '|' + t.id); return `<tr><td>${t.id}</td><td>${t.s}</td><td>${t.t}</td>${et.map(([k]) => `<td>${r && r.et && r.et[k] ? fechaCorta(r.et[k]) : '☐'}</td>`).join('')}</tr>`; }).join('')}</tbody></table>`, `${MON_T[tipo][0]} ${today()}.pdf`, true);
}

// ---------- stock de materiales en obra ----------
// consumido: hincas por código según el hincado (si la distribución está completa) o la proporción de trackers hincados; el resto, según la etapa de montaje que los usa
function stockInfo() {
  const TI = trkInfo(), T = monTrk(), nT = T.length || 1, ix = monIdx();
  const frEt = {}; Object.entries(MON_ET).forEach(([tipo, ets]) => ets.forEach(([k, , cats]) => { const h = T.filter((t) => { const r = ix.get(tipo + '|' + t.id); return r && r.et && r.et[k]; }).length; cats.forEach((c) => (frEt[c] = { f: h / nT, n: ets.find((x) => x[0] === k)[1] })); }));
  const HI = window.PLANO && S.hincado && typeof hincInfo === 'function' ? hincInfo() : null;
  const frH = HI ? HI.nH / (HI.trk.length || 1) : 0;
  return TI.mats.filter((o) => !o.fuera).map((o) => {
    const it = o.it, cat = String(it.cat || '').toUpperCase(), neto = Number(it.neto) || Number(it.tot) || 0;
    let cons = null, base = '';
    if (cat === 'POST') { const code = (it.dib || [])[0]; if (HI && HI.completa && code) { cons = HI.hecho[code] || 0; base = 'hincado por código'; } else { cons = Math.round(neto * frH); base = 'proporción de trackers hincados'; } }
    else if (frEt[cat]) { cons = Math.round(neto * frEt[cat].f); base = frEt[cat].n; }
    const stock = cons == null ? null : o.rec - cons;
    return { k: it.k, desc: it.desc, cat: it.cat, tot: it.tot || 0, neto, rec: o.rec, dan: o.dan, pend: o.pend, cons, base, stock, falta: cons == null ? false : stock < 0 };
  });
}
const STK = { c: 'all', q: '', f: 'all' };
function vStock(el) {
  actions([['Exportar Excel', 'btn', stockExcel]]);
  const L = stockInfo(); if (!L.length) { el.innerHTML = '<div class="card empty"><b>Sin BOM cargado</b><p class="muted">Cargá el Bill of Materials en Recepción de materiales.</p></div>'; return; }
  const cats = [...new Set(L.map((x) => x.cat))];
  let list = L; if (STK.c !== 'all') list = list.filter((x) => x.cat === STK.c);
  if (STK.f === 'neg') list = list.filter((x) => x.falta); if (STK.f === 'pend') list = list.filter((x) => x.pend > 0);
  if (STK.q) { const q = STK.q.toLowerCase(); list = list.filter((x) => (x.k + ' ' + x.desc).toLowerCase().includes(q)); }
  const neg = L.filter((x) => x.falta).length, sinRec = L.filter((x) => !x.rec).length;
  el.innerHTML = `<div class="grid g4 stagger" style="margin-bottom:14px">
      <div class="card kpi"><div class="kl">Códigos del BOM</div><div class="kv">${fmt(L.length)}</div><div class="muted">${fmt(sinRec)} sin recibir todavía</div></div>
      <div class="card kpi"><div class="kl">Piezas recibidas conformes</div><div class="kv">${fmt(L.reduce((a, x) => a + x.rec, 0))}</div><div class="muted">de ${fmt(L.reduce((a, x) => a + x.tot, 0))} del BOM</div></div>
      <div class="card kpi"><div class="kl">Piezas consumidas (estimado)</div><div class="kv">${fmt(L.reduce((a, x) => a + (x.cons || 0), 0))}</div><div class="muted">por hincado y montaje registrados</div></div>
      <div class="card kpi"><div class="kl">Códigos en negativo</div><div class="kv" style="color:${neg ? '#d9573f' : 'inherit'}">${fmt(neg)}</div><div class="muted">se usó más de lo recibido conforme: revisar recepción</div></div></div>
    <div class="tools"><select id="kC" class="sel"><option value="all">Todas las categorías</option>${cats.map((c) => `<option value="${esc(c)}" ${STK.c === c ? 'selected' : ''}>${esc(trkCat(c)[0])}</option>`).join('')}</select>
      <div class="seg" id="kF"><button data-v="all">Todos</button><button data-v="pend">Falta recibir</button><button data-v="neg">En negativo</button></div>
      <span class="sp"></span><input type="search" id="kQ" placeholder="Código o descripción" value="${esc(STK.q)}" style="width:200px"></div>
    <div class="tblwrap" style="max-height:calc(100vh - 300px)"><table class="tbl"><thead><tr><th>Código</th><th>Descripción</th><th>Categoría</th><th class="n">BOM</th><th class="n">Recibido OK</th><th class="n">Dañado</th><th class="n">Consumido</th><th class="n">Stock en obra</th><th class="n">Falta recibir</th><th>Se descuenta por</th></tr></thead><tbody>
    ${list.map((x) => `<tr><td><b>${esc(x.k)}</b></td><td>${esc(x.desc)}</td><td><i class="cdot" style="background:${trkCat(x.cat)[1]}"></i>${esc(trkCat(x.cat)[0])}</td><td class="n">${fmt(x.tot)}</td><td class="n">${fmt(x.rec)}</td><td class="n">${x.dan ? `<span class="tneg">${fmt(x.dan)}</span>` : ''}</td>
      <td class="n">${x.cons == null ? '<span class="muted">–</span>' : fmt(x.cons)}</td><td class="n">${x.stock == null ? fmt(x.rec) : `<b class="${x.stock < 0 ? 'tneg' : ''}">${fmt(x.stock)}</b>`}</td><td class="n">${x.pend ? fmt(x.pend) : '<span class="tpos">✓</span>'}</td><td class="muted">${esc(x.base || 'no se descuenta')}</td></tr>`).join('')}
    </tbody></table></div>
    <p class="hint">Stock en obra = recibido conforme − consumido. El consumo es una estimación: las hincas salen del hincado registrado (por código si la distribución está completa) y el resto de la etapa de montaje que las usa, en proporción a los trackers cargados. Los repuestos y extras del BOM quedan como stock.</p>`;
  $('#kC', el).onchange = (e) => { STK.c = e.target.value; render(false); };
  segBind('#kF', STK.f, (v) => { STK.f = v; render(false); });
  const q = $('#kQ', el); q.oninput = () => { STK.q = q.value.trim(); clearTimeout(q._t); q._t = setTimeout(() => render(false), 300); };
}
function stockExcel() {
  const rows = [['Código', 'Descripción', 'Categoría', 'BOM', 'Recibido OK', 'Dañado', 'Consumido (estimado)', 'Stock en obra', 'Falta recibir', 'Se descuenta por']]
    .concat(stockInfo().map((x) => [x.k, x.desc, trkCat(x.cat)[0], x.tot, x.rec, x.dan, x.cons == null ? '' : x.cons, x.stock == null ? x.rec : x.stock, x.pend, x.base]));
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Stock');
  monGuardar(wb, `Stock de materiales ${today()}.xlsx`);
}
async function monGuardar(wb, nom) {
  const p = await window.api.saveBinary(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }), nom, 'xlsx', 'Excel');
  if (p) toast('Excel exportado', { action: ['Abrir', () => window.api.openPath(p)] });
}
