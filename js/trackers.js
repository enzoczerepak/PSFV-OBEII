/* PSFV-OBE II · Trackers: recepción de materiales en obra contra el Bill of Materials (BOM) de Trina,
   entregas (remitos / packing lists) con lo declarado, lo recibido conforme y lo dañado, y reclamos al fabricante
   por faltantes, daños y sobrantes. El BOM se agrupa por número de material (el fabricante despacha por código). */
const TRK_CAT = {
  POST: ['Hincas (postes)', '#ec7fd0'], BEAM: ['Vigas (tubo de torsión)', '#5ab8ff'], PURLIN: ['Correas Ω', '#8b9dff'], 'MECH. PARTS': ['Piezas mecánicas', '#f2b33d'],
  BEARING: ['Rodamientos', '#2fc4b2'], FASTENER: ['Bulonería y fijaciones', '#9aa7b8'], 'DRIVE UNIT': ['Motores (slewing drive)', '#ff8f57'], DAMPER: ['Amortiguadores', '#b294ff'],
  TCU: ['TCU (control del tracker)', '#3fb27f'], NCU: ['NCU y estación meteorológica', '#4f8fe6'], ACCESSORIES: ['Accesorios y herramientas', '#c5a17a'], COMPUTER: ['Computadora de control', '#7d8796'],
};
const trkCat = (c) => TRK_CAT[String(c || '').toUpperCase()] || [c || 'Otros', '#9aa7b8'];
const TRK_TIPO = { falt: ['Faltante', 'Shortage'], dan: ['Dañado', 'Damaged'], sobr: ['Sobrante', 'Surplus'], fuera: ['Fuera del BOM', 'Not in BOM'], cod: ['Código equivocado', 'Wrong part'] };
const trkS = () => { S.trackers = S.trackers || {}; const T = S.trackers; T.ent = T.ent || []; T.recl = T.recl || []; if (!T.bom && window.BOM_TRINA) T.bom = window.BOM_TRINA; return T; };
const trkKey = (s) => String(s == null ? '' : s).replace(/\s+/g, '').toUpperCase();

// ---------- lectura del BOM de Trina (Excel) ----------
function trkParseBOM(wb, nombre) {
  const nrm = (s) => String(s == null ? '' : s).toLowerCase().replace(/[\s\n\r]+/g, '').replace(/（/g, '(').replace(/）/g, ')');
  for (const sn of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '', raw: true });
    const hi = rows.findIndex((r) => r.some((c) => nrm(c) === 'materialnumber') && r.some((c) => /^totalamount/.test(nrm(c))));
    if (hi < 0) continue;
    const hd = rows[hi].map(nrm), col = (f) => hd.findIndex(f);
    const C = { dib: col((c) => c === 'drawingnumber'), mat: col((c) => c === 'materialnumber'), cat: col((c) => c === 'category'), desc: col((c) => /description/.test(c)), size: col((c) => c === 'size'),
      matl: col((c) => c === 'material'), trat: col((c) => /surface/.test(c)), largo: col((c) => c === 'length'), peso: col((c) => c === 'weight'), neto: col((c) => c === 'quantity'),
      rep: col((c) => /^spareparts/.test(c)), ext: col((c) => c === 'extraparts'), tot: col((c) => /^totalamount/.test(c)) };
    if (C.mat < 0 || C.tot < 0) continue;
    const num = (v) => { const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : 0; };
    const txt = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
    // datos del proyecto (encabezado de Trina): el valor está a la derecha o debajo del rótulo
    const ROT = /projectname|projectno|documentname|documentno|totalamountoftrackers|totalcapacity|designer|uncertain|modification/;
    const dato = (re) => { for (let i = 0; i < hi; i++) { const r = rows[i]; for (let j = 0; j < r.length; j++) if (re.test(nrm(r[j]))) {
      for (let k = j + 1; k < r.length; k++) { const v = txt(r[k]); if (v && !ROT.test(nrm(v))) return v; if (v) break; }
      if (rows[i + 1] && txt(rows[i + 1][j])) return txt(rows[i + 1][j]); } } return ''; };
    const m = new Map();
    rows.slice(hi + 1).forEach((r) => {
      const mat = trkKey(r[C.mat]) || trkKey(r[C.dib]); const tot = num(r[C.tot]), neto = num(r[C.neto]);
      if (!mat || mat === 'NA' || (!tot && !neto)) return;
      const o = m.get(mat) || { k: mat, dib: [], cat: txt(r[C.cat]), desc: txt(r[C.desc]), size: txt(r[C.size]), mat: txt(r[C.matl]), trat: txt(r[C.trat]), largo: num(r[C.largo]) || null, peso: num(r[C.peso]) || null, neto: 0, rep: 0, ext: 0, tot: 0, n: 0 };
      const d = txt(r[C.dib]); if (d && d !== 'NA' && !o.dib.includes(d)) o.dib.push(d);
      o.neto += neto; o.rep += num(r[C.rep]); o.ext += num(r[C.ext]); o.tot += tot || neto; o.n++;
      if (o.mat === '0') o.mat = ''; if (o.trat === '0') o.trat = '';
      m.set(mat, o);
    });
    if (!m.size) continue;
    const items = [...m.values()];
    return { fuente: nombre || '', hoja: sn, proyecto: dato(/projectname/), nro: dato(/projectno/), doc: dato(/documentno/), nTrk: Number(dato(/totalamountoftrackers/)) || null,
      mw: Number(dato(/totalcapacity/)) || null, fecha: today(), items };
  }
  return null;
}
async function trkImportBOM() {
  if (window.READONLY) return;
  const f = await window.api.pickExcel(); if (!f) return;
  let b; try { b = trkParseBOM(XLSX.read(new Uint8Array(f.data), { type: 'array' }), String(f.path || '').split(/[\\/]/).pop()); } catch (e) { b = null; }
  if (!b) { toast('No encontré el BOM: el Excel tiene que tener las columnas "Material Number" y "Total amount" de Trina', { err: true, ms: 8000 }); return; }
  const T = trkS(), viejo = T.bom;
  const noEsta = viejo ? viejo.items.filter((i) => !b.items.some((x) => x.k === i.k)) : [];
  const ok = await confirmar('Cargar Bill of Materials', `<b>${esc(b.fuente)}</b><br>${b.items.length} materiales${b.proyecto ? ` · ${esc(b.proyecto)}` : ''}${b.nTrk ? ` · ${b.nTrk} trackers` : ''}${b.doc ? ` · ${esc(b.doc)}` : ''}.
    ${viejo ? `<br><br>Reemplaza al BOM actual (${viejo.items.length} materiales). Las entregas y reclamos cargados se conservan.${noEsta.length ? ` <b>${noEsta.length} código${noEsta.length > 1 ? 's' : ''} del BOM anterior no está${noEsta.length > 1 ? 'n' : ''} en el nuevo</b>: lo recibido de ellos queda como "fuera del BOM".` : ''}` : ''}`, 'Cargar BOM');
  if (!ok) return;
  T.bom = b; commit(`BOM de trackers cargado: ${b.items.length} materiales`);
}

// ---------- cálculo ----------
function trkInfo() {
  const T = trkS(), B = T.bom, items = B ? B.items : [], idx = new Map(items.map((i) => [i.k, i]));
  const por = new Map(items.map((i) => [i.k, { it: i, decl: 0, rec: 0, dan: 0, ents: [] }]));
  const difs = [], fuera = new Map();
  T.ent.forEach((e) => (e.lin || []).forEach((l) => {
    const k = trkKey(l.mat); const decl = Number(l.decl) || 0, rec = Number(l.rec) || 0, dan = Number(l.dan) || 0;
    let o = por.get(k);
    if (!o) { o = fuera.get(k) || { it: { k, desc: l.desc || '', cat: '', tot: 0 }, decl: 0, rec: 0, dan: 0, ents: [], fuera: true }; fuera.set(k, o); }
    o.decl += decl; o.rec += rec; o.dan += dan; o.ents.push({ e, l });
    const base = { ent: e.id, mat: k, e, l, desc: (idx.get(k) || {}).desc || l.desc || '' };
    if (!idx.has(k)) difs.push(Object.assign({ key: `${e.id}|${k}|fuera`, tipo: 'fuera', cant: rec + dan || decl }, base));
    const f = decl - rec - dan;
    if (decl && f > 0.0001) difs.push(Object.assign({ key: `${e.id}|${k}|falt`, tipo: 'falt', cant: f }, base));
    if (decl && f < -0.0001 && idx.has(k)) difs.push(Object.assign({ key: `${e.id}|${k}|sobr`, tipo: 'sobr', cant: -f }, base));
    if (dan > 0) difs.push(Object.assign({ key: `${e.id}|${k}|dan`, tipo: 'dan', cant: dan }, base));
  }));
  const enRecl = new Map(); T.recl.forEach((r) => (r.items || []).forEach((x) => enRecl.set(x.key, r)));
  difs.forEach((d) => { d.recl = enRecl.get(d.key) || null; });
  const mats = [...por.values(), ...fuera.values()].map((o) => {
    const tot = o.it.tot || 0, pend = Math.max(0, tot - o.rec);
    o.tot = tot; o.pend = pend; o.p = tot ? Math.min(1, o.rec / tot) : 0;
    o.est = o.fuera ? 'fuera' : o.rec > tot + 0.0001 ? 'exc' : o.rec >= tot - 0.0001 && tot > 0 ? 'ok' : o.rec > 0 ? 'par' : 'pend';
    o.dif = difs.some((d) => d.mat === o.it.k);
    return o;
  });
  const pesoT = items.reduce((a, i) => a + (i.peso || 0) * i.tot, 0);
  const pesoR = mats.filter((o) => !o.fuera).reduce((a, o) => a + (o.it.peso || 0) * Math.min(o.rec, o.tot), 0);
  const uT = items.reduce((a, i) => a + i.tot, 0), uR = mats.filter((o) => !o.fuera).reduce((a, o) => a + Math.min(o.rec, o.tot), 0);
  const cats = {}; mats.filter((o) => !o.fuera).forEach((o) => { const c = String(o.it.cat || 'Otros').toUpperCase(); const x = (cats[c] = cats[c] || { c, n: 0, ok: 0, pt: 0, pr: 0, ut: 0, ur: 0 });
    x.n++; if (o.est === 'ok' || o.est === 'exc') x.ok++; x.pt += (o.it.peso || 0) * o.tot; x.pr += (o.it.peso || 0) * Math.min(o.rec, o.tot); x.ut += o.tot; x.ur += Math.min(o.rec, o.tot); });
  Object.values(cats).forEach((x) => { x.p = x.pt > 0 ? x.pr / x.pt : x.ut ? x.ur / x.ut : 0; });
  return { T, B, mats, difs, sinRecl: difs.filter((d) => !d.recl && d.tipo !== 'sobr'), cats: Object.values(cats).sort((a, b) => b.pt - a.pt), pesoT, pesoR, p: pesoT ? pesoR / pesoT : uT ? uR / uT : 0, uT, uR,
    nOk: mats.filter((o) => o.est === 'ok' || o.est === 'exc').length, nItems: items.length, abiertos: T.recl.filter((r) => r.estado !== 'resuelto') };
}
const TRK_EST = { ok: ['completo', 'p-done'], exc: ['excedente', 'p-ready'], par: ['parcial', 'p-warn'], pend: ['sin recibir', 'p-prov'], fuera: ['fuera del BOM', 'p-bad'] };
const trkDescH = (i) => `${esc(i.desc || '')}${i.size ? ` <span class="muted">${esc(i.size)}</span>` : ''}${i.largo ? ` <span class="muted">· ${fmt(i.largo)} mm</span>` : ''}`;
const trkKg = (kg) => (kg >= 10000 ? `${fmt(kg / 1000, 1)} t` : `${fmt(kg)} kg`);

// ---------- sin BOM ----------
function trkSinBOM(el) {
  actions([['Cargar BOM (Excel)', 'btn pri', trkImportBOM]]);
  el.innerHTML = `<div class="card empty" style="padding:34px"><b>Falta el Bill of Materials del fabricante</b><p class="muted" style="max-width:560px;margin:8px auto 16px">Cargá el Excel del BOM de Trina (hoja con las columnas <i>Material Number</i>, <i>Quantity</i>, <i>Spare Parts</i> y <i>Total amount</i>). Con él se controla cada entrega que llega a obra.</p>${window.READONLY ? '' : '<button class="btn pri" id="tBom">Cargar BOM (Excel)</button>'}</div>`;
  const b = $('#tBom', el); if (b) b.onclick = trkImportBOM;
}

// ---------- vista: recepción de materiales (estado por material) ----------
const trkUI = { cat: 'all', est: 'all', q: '' };
function vTrkRec(el) {
  const I = trkInfo(); if (!I.B) return trkSinBOM(el);
  actions([['Exportar Excel', 'btn', trkExport], ['Importar packing list…', 'btn', () => trkImportPL()], ['+ Recepción', 'btn pri', () => trkEditEnt(null)]]);
  const q = trkUI.q.toLowerCase();
  const list = I.mats.filter((o) => (trkUI.cat === 'all' || String(o.it.cat).toUpperCase() === trkUI.cat)
    && (trkUI.est === 'all' || (trkUI.est === 'dif' ? o.dif : trkUI.est === 'falta' ? o.est === 'pend' || o.est === 'par' : o.est === trkUI.est))
    && (!q || `${o.it.k} ${o.it.desc} ${o.it.size} ${(o.it.dib || []).join(' ')}`.toLowerCase().includes(q)));
  const B = I.B, nEnt = I.T.ent.length, ult = I.T.ent.map((e) => e.fecha).sort().pop();
  let h = `<div class="grid trktop stagger" style="margin-bottom:14px">
    <div class="card tile"><div>${Charts.ring(I.p, '#3fb27f', 'recibido')}</div><div><h3 style="margin-bottom:6px">Materiales de trackers</h3>
      <div class="kpis k1" style="gap:6px">${kpi('Recibido (por peso)', I.pesoR / 1000, ` / ${fmt(I.pesoT / 1000, 1)} t`, 1)}${kpi('Códigos completos', I.nOk, ` / ${I.nItems}`, 0)}</div>
      <div class="muted" style="margin-top:8px;font-size:12.5px">${nEnt ? `${nEnt} entrega${nEnt > 1 ? 's' : ''} registrada${nEnt > 1 ? 's' : ''} · última ${fechaCorta(ult)}` : 'Todavía no se registraron entregas'}<br>BOM ${esc(B.doc || B.fuente || '')}${B.proyecto ? ` · ${esc(B.proyecto)}` : ''}${B.nTrk ? ` · ${B.nTrk} trackers` : ''}</div></div></div>
    <div class="card"><h3>Por tipo de material</h3><div class="trkcats">${I.cats.map((x) => { const [n, c] = trkCat(x.c); return `<button class="trkcat ${trkUI.cat === x.c ? 'on' : ''}" data-cat="${esc(x.c)}" title="${esc(n)}: ${x.ok} de ${x.n} códigos completos · ${trkKg(x.pr)} de ${trkKg(x.pt)} · tocá para filtrar"><span><i style="background:${c}"></i>${esc(n)}</span><div class="sbt"><div style="width:${(x.p * 100).toFixed(1)}%;background:${c}"></div></div><b>${fmt(x.p * 100)}%</b></button>`; }).join('')}</div></div>
    <div class="card trkalert">${I.sinRecl.length ? `<div class="alert error"><div><b>${I.sinRecl.length} diferencia${I.sinRecl.length > 1 ? 's' : ''} sin reclamar</b><br>Faltantes, dañados o códigos fuera del BOM de las entregas.<br><button class="btn sm" data-go="trecl" style="margin-top:6px">Ver y reclamar</button></div></div>` : '<div class="alert ok"><div><b>Sin diferencias pendientes de reclamo</b></div></div>'}
      ${I.abiertos.length ? `<div class="alert aviso" style="margin-top:8px"><div><b>${I.abiertos.length} reclamo${I.abiertos.length > 1 ? 's' : ''} abierto${I.abiertos.length > 1 ? 's' : ''}</b> a Trina: ${I.abiertos.map((r) => esc(r.num)).join(', ')}</div></div>` : ''}</div></div>
    <div class="tools"><div class="seg" id="tE"><button data-v="all">Todos</button><button data-v="falta">Falta recibir</button><button data-v="ok">Completos</button><button data-v="dif">Con diferencias</button><button data-v="exc">Excedentes</button>${I.mats.some((o) => o.fuera) ? '<button data-v="fuera">Fuera del BOM</button>' : ''}</div>
    ${trkUI.cat !== 'all' ? `<button class="chip" id="tCat0" title="Quitar filtro">${esc(trkCat(trkUI.cat)[0])} ✕</button>` : ''}<span class="muted">${list.length} códigos</span><span class="sp"></span><input type="search" id="tQ" placeholder="Buscar código, descripción, plano…" value="${esc(trkUI.q)}" style="width:240px"></div>
    <div class="tblwrap"><table class="tbl trktbl"><thead><tr><th>Código</th><th>Descripción</th><th>Tipo</th><th class="n" title="Cantidad del BOM incluidos repuestos (spare) y extras">BOM total</th><th class="n">Recibido</th><th class="n">Dañado</th><th class="n">Falta</th><th style="width:150px">Avance</th><th>Estado</th></tr></thead><tbody>`;
  list.forEach((o) => { const [cn, cc] = trkCat(o.it.cat), [en, ec] = TRK_EST[o.est];
    h += `<tr data-k="${esc(o.it.k)}" class="trow"><td class="mono">${esc(o.it.k)}${o.it.dib && o.it.dib.length ? `<small class="muted" style="display:block">${esc(o.it.dib[0])}${o.it.dib.length > 1 ? ' +' + (o.it.dib.length - 1) : ''}</small>` : ''}</td><td>${trkDescH(o.it)}</td>
      <td><span class="tcat"><i style="background:${cc}"></i>${esc(cn)}</span></td><td class="n">${o.fuera ? '–' : fmt(o.tot)}</td><td class="n"><b>${fmt(o.rec)}</b></td><td class="n ${o.dan ? 'tneg' : 'muted'}">${o.dan ? fmt(o.dan) : '–'}</td><td class="n">${o.fuera ? '–' : o.pend ? fmt(o.pend) : '<span class="muted">0</span>'}</td>
      <td><div class="sbt"><div style="width:${(o.p * 100).toFixed(1)}%;background:${o.est === 'ok' || o.est === 'exc' ? '#2f9e5b' : '#f5a524'}"></div></div><small class="muted">${fmt(o.p * 100)} %</small></td>
      <td><span class="pill ${ec}">${en}</span>${o.dif ? ' <span class="pill p-bad" title="Hay faltantes o dañados en alguna entrega">dif.</span>' : ''}</td></tr>`; });
  h += `</tbody></table>${list.length ? '' : '<div class="empty"><b>Sin resultados</b></div>'}</div>
    <p class="hint">El total del BOM incluye los repuestos (<i>spare parts</i>) y extras que manda Trina. <b>Recibido</b> es lo que llegó conforme; lo dañado no cuenta como recibido y queda para reclamar. El avance general se mide por peso. Tocá un código para ver en qué entregas llegó.</p>`;
  el.innerHTML = h;
  segBind('#tE', trkUI.est, (v) => { trkUI.est = v; render(false); });
  searchBind('#tQ', (v) => { trkUI.q = v; });
  $$('.trkcat', el).forEach((b) => { b.onclick = () => { trkUI.cat = trkUI.cat === b.dataset.cat ? 'all' : b.dataset.cat; render(false); }; });
  const c0 = $('#tCat0', el); if (c0) c0.onclick = () => { trkUI.cat = 'all'; render(false); };
  $$('[data-go]', el).forEach((b) => { b.onclick = () => go(b.dataset.go); });
  $$('tr.trow', el).forEach((tr) => { tr.onclick = () => trkVerMat(tr.dataset.k); });
}
function trkVerMat(k) {
  const I = trkInfo(), o = I.mats.find((x) => x.it.k === k); if (!o) return;
  const ds = I.difs.filter((d) => d.mat === k);
  modal({ title: `${k} · ${o.it.desc || ''}`, sub: `${esc(trkCat(o.it.cat)[0])}${o.it.size ? ' · ' + esc(o.it.size) : ''}${o.it.largo ? ` · ${fmt(o.it.largo)} mm` : ''}${o.it.peso ? ` · ${fmt(o.it.peso, 2)} kg c/u` : ''}${o.it.dib && o.it.dib.length ? ' · plano ' + o.it.dib.map(esc).join(', ') : ''}`, wide: true,
    body: `<div class="kpis k4" style="margin-bottom:12px">${kpi('BOM neto', o.it.neto || 0, '', 0)}${kpi('Repuestos + extra', (o.it.rep || 0) + (o.it.ext || 0), '', 0)}${kpi('Recibido', o.rec, ` / ${fmt(o.tot)}`, 0)}${kpi('Falta', o.pend, '', 0)}</div>
      <table class="tbl"><thead><tr><th>Fecha</th><th>Remito / packing list</th><th>Transporte</th><th class="n">Declarado</th><th class="n">Recibido</th><th class="n">Dañado</th><th>Observación</th></tr></thead><tbody>
      ${o.ents.map(({ e, l }) => `<tr><td>${fechaCorta(e.fecha)}</td><td>${esc(e.remito || '–')}</td><td>${esc(e.cont || '')}</td><td class="n">${fmt(l.decl)}</td><td class="n">${fmt(l.rec)}</td><td class="n ${l.dan ? 'tneg' : ''}">${l.dan ? fmt(l.dan) : '–'}</td><td>${esc(l.obs || '')}</td></tr>`).join('') || '<tr><td colspan="7" class="muted" style="padding:14px">Todavía no llegó en ninguna entrega.</td></tr>'}</tbody></table>
      ${ds.length ? `<h4 style="margin:14px 0 6px">Diferencias</h4>${ds.map((d) => `<div>${TRK_TIPO[d.tipo][0]}: <b>${fmt(d.cant)}</b> · remito ${esc(d.e.remito || '–')} (${fechaCorta(d.e.fecha)}) · ${d.recl ? `reclamo <b>${esc(d.recl.num)}</b> (${d.recl.estado})` : '<span class="tneg">sin reclamar</span>'}</div>`).join('')}` : ''}`,
    buttons: [['Cerrar', 'btn', () => true]] });
}

// ---------- entregas ----------
function trkEntResumen(e, I) {
  const ds = I.difs.filter((d) => d.ent === e.id && d.tipo !== 'sobr');
  return { n: (e.lin || []).length, piezas: (e.lin || []).reduce((a, l) => a + (Number(l.rec) || 0), 0), ds };
}
function vTrkEnt(el) {
  const I = trkInfo(); if (!I.B) return trkSinBOM(el);
  actions([['Exportar Excel', 'btn', trkExport], ['Importar packing list…', 'btn', () => trkImportPL()], ['+ Recepción', 'btn pri', () => trkEditEnt(null)]]);
  const es = I.T.ent.slice().sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)) || (b._o || 0) - (a._o || 0));
  el.innerHTML = `<div class="tblwrap"><table class="tbl"><thead><tr><th>Fecha</th><th>Remito / packing list</th><th>Contenedor / camión</th><th>Recibió</th><th class="n">Códigos</th><th class="n">Piezas recibidas</th><th>Control</th><th></th></tr></thead><tbody>
    ${es.map((e) => { const r = trkEntResumen(e, I), sr = r.ds.filter((d) => !d.recl);
      return `<tr data-id="${e.id}" class="trow"><td>${fechaCorta(e.fecha)}</td><td><b>${esc(e.remito || '–')}</b>${e.obs ? `<small class="muted" style="display:block">${esc(e.obs)}</small>` : ''}</td><td>${esc(e.cont || '')}${e.transp ? `<small class="muted" style="display:block">${esc(e.transp)}</small>` : ''}</td><td>${esc(e.resp || '')}</td>
        <td class="n">${r.n}</td><td class="n">${fmt(r.piezas)}</td>
        <td>${r.ds.length ? `<span class="pill p-bad">${r.ds.length} diferencia${r.ds.length > 1 ? 's' : ''}</span>${sr.length ? ' <small class="tneg">sin reclamar</small>' : ' <small class="muted">reclamadas</small>'}` : '<span class="pill p-done">✓ conforme</span>'}</td>
        <td style="white-space:nowrap"><button class="btn sm ghost" data-a="pdf" title="Constancia de recepción en PDF">PDF</button>${window.READONLY ? '' : '<button class="btn sm ghost" data-a="e">✎</button>'}</td></tr>`; }).join('') || '<tr><td colspan="8" class="muted" style="padding:20px">Todavía no se registraron entregas. Usá <b>+ Recepción</b> o <b>Importar packing list…</b></td></tr>'}
    </tbody></table></div>
    <div class="card" style="margin-top:16px"><h3>Cómo controlar una entrega</h3><ol class="hlist"><li>Con el remito o el <i>packing list</i> en mano, tocá <b>+ Recepción</b> (o <b>Importar packing list…</b> si lo tenés en Excel: se cargan solos los códigos y cantidades declaradas).</li>
      <li>Por cada código, cargá lo <b>declarado</b> en el remito, lo que <b>contaste</b> conforme y lo que llegó <b>dañado</b>. Si coincide, el botón <b>= declarado</b> lo completa.</li>
      <li>Las diferencias (faltantes, dañados, códigos que no están en el BOM) quedan marcadas y pasan a <b>Reclamos al fabricante</b>, desde donde se arma el reporte para Trina.</li></ol></div>`;
  $$('tr.trow', el).forEach((tr) => { tr.onclick = (ev) => { const a = ev.target.closest('[data-a]'); if (a && a.dataset.a === 'pdf') return trkPdfEnt(tr.dataset.id); trkEditEnt(tr.dataset.id); }; });
}
// formulario de una entrega: encabezado del remito y una línea por código
async function trkEditEnt(id, pre) {
  const I = trkInfo(), T = I.T, e0 = id ? T.ent.find((x) => x.id === id) : null;
  if (window.READONLY) { if (e0) trkPdfEnt(id); return; }
  const idx = new Map(I.B.items.map((i) => [i.k, i])), est = new Map(I.mats.map((o) => [o.it.k, o]));
  const e = e0 ? JSON.parse(JSON.stringify(e0)) : Object.assign({ fecha: today(), remito: '', cont: '', transp: '', resp: '', obs: '', lin: [] }, pre || {});
  const opt = I.B.items.map((i) => `<option value="${esc(i.k)}">${esc(i.desc)}${i.size ? ' ' + esc(i.size) : ''}${i.largo ? ' · ' + i.largo + ' mm' : ''}</option>`).join('');
  const fila = (l) => { const k = trkKey(l.mat), it = idx.get(k), o = est.get(k), propio = e0 && (e0.lin || []).find((x) => trkKey(x.mat) === k);
    const pend = o ? Math.max(0, o.tot - o.rec + (propio ? Number(propio.rec) || 0 : 0)) : null;
    return `<tr data-k="${esc(k)}"><td class="mono">${esc(k)}${it ? '' : ' <span class="pill p-bad">fuera del BOM</span>'}</td><td>${it ? trkDescH(it) : `<input type="text" class="tl-desc" value="${esc(l.desc || '')}" placeholder="Descripción del remito">`}<small class="muted" style="display:block">${it ? `falta recibir ${fmt(pend)} de ${fmt(it.tot)}` : ''}</small></td>
      <td><input type="number" class="tl-decl" min="0" step="1" value="${l.decl ?? ''}"></td><td><input type="number" class="tl-rec" min="0" step="1" value="${l.rec ?? ''}"></td><td><input type="number" class="tl-dan" min="0" step="1" value="${l.dan || ''}" placeholder="0"></td>
      <td class="tl-dif"></td><td><input type="text" class="tl-obs" value="${esc(l.obs || '')}" placeholder="Opcional"></td><td><button class="btn sm ghost tl-eq" title="Recibido = declarado">=</button><button class="btn sm ghost tl-x" title="Quitar">✕</button></td></tr>`; };
  setTimeout(() => trkEntBind(fila), 30);
  const res = await modal({ title: e0 ? `Entrega ${e0.remito || ''}` : 'Recepción de materiales de trackers', sub: 'Controlá cada código contra el remito o packing list de Trina', wide: true,
    body: `<div class="form"><label>Fecha<input type="date" id="teF" value="${e.fecha}"></label><label>Remito / packing list N°<input type="text" id="teR" value="${esc(e.remito || '')}" placeholder="ej. PL-498P26050-012"></label>
      <label>Contenedor / patente<input type="text" id="teC" value="${esc(e.cont || '')}" placeholder="ej. MSKU 123456-7"></label><label>Transporte<input type="text" id="teT" value="${esc(e.transp || '')}"></label>
      <label>Recibió<input type="text" id="teP" value="${esc(e.resp || '')}"></label><label>Observación<input type="text" id="teO" value="${esc(e.obs || '')}" placeholder="Estado general, embalaje, precintos…"></label></div>
      <div class="trkadd"><input type="text" id="teQ" list="teL" placeholder="Agregar código: escribí el número de material o la descripción…" autocomplete="off"><datalist id="teL">${opt}</datalist><button class="btn sm" id="teA">Agregar</button><button class="btn sm ghost" id="teEq" title="Completa lo recibido con lo declarado en todas las líneas vacías">Recibido = declarado en todo</button></div>
      <div class="tblwrap" style="max-height:46vh"><table class="tbl trkent"><thead><tr><th>Código</th><th>Descripción</th><th class="n">Declarado</th><th class="n">Recibido OK</th><th class="n">Dañado</th><th>Diferencia</th><th>Observación</th><th></th></tr></thead><tbody id="teB">${(e.lin || []).map(fila).join('')}</tbody></table></div>
      <div id="teS" class="muted" style="margin-top:8px"></div>`,
    buttons: (e0 ? [['Eliminar', 'btn danger', () => 'del']] : []).concat([['Cancelar', 'btn', () => null], ['Guardar entrega', 'btn pri', (box) => {
      const lin = $$('#teB tr', box).map((tr) => ({ mat: tr.dataset.k, decl: Number($('.tl-decl', tr).value) || 0, rec: Number($('.tl-rec', tr).value) || 0, dan: Number($('.tl-dan', tr).value) || 0, obs: $('.tl-obs', tr).value.trim(),
        ...(idx.has(tr.dataset.k) ? {} : { desc: ($('.tl-desc', tr) || { value: '' }).value.trim() }) })).filter((l) => l.decl || l.rec || l.dan);
      if (!lin.length) { toast('Agregá al menos un código con cantidades', { err: true }); return false; }
      return { fecha: $('#teF', box).value || today(), remito: $('#teR', box).value.trim(), cont: $('#teC', box).value.trim(), transp: $('#teT', box).value.trim(), resp: $('#teP', box).value.trim(), obs: $('#teO', box).value.trim(), lin };
    }]]) });
  if (res === 'del') {
    const enR = T.recl.filter((r) => (r.items || []).some((x) => x.ent === id));
    if (await confirmar('Eliminar entrega', `Se borra la entrega ${esc(e0.remito || '')} con sus ${(e0.lin || []).length} códigos.${enR.length ? ` Está citada en ${enR.map((r) => esc(r.num)).join(', ')}.` : ''}`, 'Eliminar', 'btn danger')) { T.ent = T.ent.filter((x) => x.id !== id); commit(`Entrega ${e0.remito || ''} eliminada`); }
    return;
  }
  if (!res) return;
  if (e0) Object.assign(e0, res); else T.ent.push(Object.assign({ id: uid('te'), _o: Date.now() }, res));
  const I2 = trkInfo(), ent = e0 || T.ent[T.ent.length - 1], nd = I2.difs.filter((d) => d.ent === ent.id && d.tipo !== 'sobr').length;
  commit(`Entrega ${res.remito || fechaCorta(res.fecha)}: ${res.lin.length} códigos${nd ? ` · ${nd} diferencia${nd > 1 ? 's' : ''} para reclamar` : ' · conforme'}`);
  if (nd) toast(`${nd} diferencia${nd > 1 ? 's' : ''} registrada${nd > 1 ? 's' : ''}: quedan en Reclamos al fabricante`, { action: ['Ver', () => go('trecl')], ms: 9000 });
}
function trkEntBind(fila) {
  const box = $('#modal'); if (!box || !$('#teB', box)) return;
  const upd = () => {
    let nOk = 0, nDif = 0;
    $$('#teB tr', box).forEach((tr) => { const d = Number($('.tl-decl', tr).value) || 0, r = Number($('.tl-rec', tr).value) || 0, dn = Number($('.tl-dan', tr).value) || 0, f = d - r - dn, c = $('.tl-dif', tr);
      const t = []; if (d && f > 0) t.push(`<span class="tneg">faltan ${fmt(f)}</span>`); if (d && f < 0) t.push(`<span class="tpos">sobran ${fmt(-f)}</span>`); if (dn) t.push(`<span class="tneg">${fmt(dn)} dañad${dn > 1 ? 'os' : 'o'}</span>`);
      c.innerHTML = t.length ? t.join('<br>') : d || r ? '<span class="tpos">✓</span>' : ''; tr.classList.toggle('tdif', t.length > 0); if (t.length) nDif++; else if (d || r) nOk++; });
    $('#teS', box).innerHTML = `${$$('#teB tr', box).length} códigos · ${nOk} conformes${nDif ? ` · <b class="tneg">${nDif} con diferencias</b> (se registran para reclamar a Trina)` : ''}`;
  };
  const add = () => { const q = $('#teQ', box), k = trkKey(q.value.split(/\s/)[0] || q.value); if (!k) return;
    const B = trkS().bom, hit = B.items.find((i) => i.k === k) || B.items.find((i) => `${i.desc} ${i.size}`.toUpperCase().includes(q.value.trim().toUpperCase()));
    const kk = hit ? hit.k : k; if ($(`#teB tr[data-k="${CSS.escape(kk)}"]`, box)) { toast('Ese código ya está en la entrega'); q.value = ''; return; }
    $('#teB', box).insertAdjacentHTML('afterbegin', fila({ mat: kk })); q.value = ''; $('#teB tr .tl-decl', box).focus(); upd(); };
  $('#teA', box).onclick = add;
  $('#teQ', box).onkeydown = (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); add(); } };
  $('#teEq', box).onclick = () => { $$('#teB tr', box).forEach((tr) => { const r = $('.tl-rec', tr); if (r.value === '') r.value = Math.max(0, (Number($('.tl-decl', tr).value) || 0) - (Number($('.tl-dan', tr).value) || 0)); }); upd(); };
  $('#teB', box).addEventListener('input', (ev) => { const tr = ev.target.closest('tr'); if (ev.target.classList.contains('tl-decl') && tr.dataset.auto === '1') $('.tl-rec', tr).value = ev.target.value; upd(); });
  $('#teB', box).addEventListener('click', (ev) => { const tr = ev.target.closest('tr'); if (!tr) return;
    if (ev.target.closest('.tl-x')) { tr.remove(); upd(); }
    if (ev.target.closest('.tl-eq')) { $('.tl-rec', tr).value = Math.max(0, (Number($('.tl-decl', tr).value) || 0) - (Number($('.tl-dan', tr).value) || 0)); upd(); } });
  upd();
}
// packing list en Excel: se buscan las columnas de código y cantidad, y se abre la entrega con lo declarado
async function trkImportPL(f0) {
  if (window.READONLY) return;
  const f = f0 && f0.data ? f0 : await window.api.pickExcel(); if (!f) return;
  const nombre = String(f.path || '').split(/[\\/]/).pop().replace(/\.[^.]+$/, '');
  let rows = []; try { const wb = XLSX.read(new Uint8Array(f.data), { type: 'array' }); wb.SheetNames.forEach((sn) => { rows = rows.concat(XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '' })); }); } catch (e) { toast('No se pudo leer el archivo', { err: true }); return; }
  const nrm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
  const reC = /material ?(number|no|n°|code|nr)|part ?(number|no)|item code|codigo|^material$|sap/, reQ = /q'?ty|quantity|cantidad|pcs|cant\b/;
  const B = trkS().bom, idx = new Map(B.items.map((i) => [i.k, i]));
  const tot = new Map(); let hi = -1, cC = -1, cQ = -1, cD = -1;
  rows.forEach((r, i) => {
    const hd = r.map(nrm), c1 = hd.findIndex((c) => reC.test(c)), c2 = hd.findIndex((c, j) => j !== c1 && reQ.test(c));
    if (c1 >= 0 && c2 >= 0) { hi = i; cC = c1; cQ = c2; cD = hd.findIndex((c) => /descrip/.test(c)); return; }
    if (hi < 0) return;
    const k = trkKey(r[cC]), q = Number(String(r[cQ]).replace(',', '.'));
    if (!k || !isFinite(q) || q <= 0 || /total/i.test(k)) return;
    const o = tot.get(k) || { mat: k, decl: 0, desc: cD >= 0 ? String(r[cD]).trim() : '' }; o.decl += q; tot.set(k, o);
  });
  // sin encabezado reconocible: se buscan códigos del BOM en cualquier columna, con la cantidad numérica de la misma fila
  if (!tot.size) rows.forEach((r) => { const j = r.findIndex((c) => idx.has(trkKey(c))); if (j < 0) return; const q = r.slice(j + 1).map((c) => Number(c)).find((n) => isFinite(n) && n > 0); if (!q) return; const k = trkKey(r[j]); const o = tot.get(k) || { mat: k, decl: 0 }; o.decl += q; tot.set(k, o); });
  if (!tot.size) { toast('No encontré códigos de material y cantidades en el archivo', { err: true, ms: 7000 }); return; }
  const lin = [...tot.values()].map((o) => Object.assign(o, { rec: o.decl }));
  const fuera = lin.filter((l) => !idx.has(l.mat)).length;
  toast(`${lin.length} códigos leídos del packing list${fuera ? ` · ${fuera} no están en el BOM` : ''}: revisá lo recibido y guardá`, { ms: 8000 });
  trkEditEnt(null, { remito: nombre, lin });
}

// ---------- reclamos al fabricante ----------
const reclUI = { sel: new Set() };
function vTrkRecl(el) {
  const I = trkInfo(); if (!I.B) return trkSinBOM(el);
  actions([['Exportar Excel', 'btn', trkExport]]);
  const pend = I.difs.filter((d) => !d.recl).sort((a, b) => String(b.e.fecha).localeCompare(String(a.e.fecha)));
  [...reclUI.sel].forEach((k) => { if (!pend.some((d) => d.key === k)) reclUI.sel.delete(k); });
  const n = reclUI.sel.size, ro = window.READONLY;
  const rs = I.T.recl.slice().sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)) || String(b.num).localeCompare(String(a.num)));
  const EST = { borrador: ['borrador', 'p-prov'], enviado: ['enviado a Trina', 'p-warn'], resuelto: ['resuelto', 'p-done'] };
  el.innerHTML = `<div class="card" style="margin-bottom:16px"><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><h3 style="margin:0">Diferencias sin reclamar</h3><span class="muted">${pend.length}</span><span class="sp" style="flex:1"></span>
      ${ro || !pend.length ? '' : `<button class="btn sm ghost" id="rSelT">${n && n === pend.filter((d) => d.tipo !== 'sobr').length ? 'Ninguna' : 'Elegir todas'}</button><button class="btn sm pri ${n ? '' : 'dis'}" id="rNew" ${n ? '' : 'disabled'}>Armar reclamo${n ? ` (${n})` : ''}</button>`}</div>
    ${pend.length ? `<div class="tblwrap" style="margin-top:10px"><table class="tbl"><thead><tr>${ro ? '' : '<th></th>'}<th>Tipo</th><th>Código</th><th>Descripción</th><th class="n">Cantidad</th><th>Entrega</th><th>Observación</th></tr></thead><tbody>
      ${pend.map((d) => `<tr data-k="${esc(d.key)}" class="${reclUI.sel.has(d.key) ? 'sel' : ''}">${ro ? '' : `<td><input type="checkbox" class="rsel" ${reclUI.sel.has(d.key) ? 'checked' : ''}></td>`}<td><span class="pill ${d.tipo === 'sobr' ? 'p-ready' : 'p-bad'}">${TRK_TIPO[d.tipo][0]}</span></td><td class="mono">${esc(d.mat)}</td><td>${esc(d.desc)}</td><td class="n"><b>${fmt(d.cant)}</b></td>
        <td>${fechaCorta(d.e.fecha)} · ${esc(d.e.remito || '–')}</td><td class="muted">${esc(d.l.obs || '')}</td></tr>`).join('')}</tbody></table></div>
      <p class="hint">Faltante: lo declarado en el remito menos lo recibido y lo dañado. Los sobrantes se informan solo si los incluís.</p>` : '<p class="muted" style="margin:10px 0 0">No hay diferencias pendientes: todo lo recibido coincide con los remitos o ya está reclamado.</p>'}</div>
    <h2 class="sech">Reclamos</h2>
    <div class="tblwrap"><table class="tbl"><thead><tr><th>N°</th><th>Fecha</th><th>Ítems</th><th>Detalle</th><th>Estado</th><th></th></tr></thead><tbody>
    ${rs.map((r) => { const [en, ec] = EST[r.estado] || EST.borrador, c = {}; (r.items || []).forEach((x) => { c[x.tipo] = (c[x.tipo] || 0) + 1; });
      return `<tr data-id="${r.id}"><td><b>${esc(r.num)}</b></td><td>${fechaCorta(r.fecha)}</td><td>${(r.items || []).length}</td><td>${Object.entries(c).map(([t, k]) => `${k} ${({ falt: ['faltante', 'faltantes'], dan: ['dañado', 'dañados'], sobr: ['sobrante', 'sobrantes'], fuera: ['fuera del BOM', 'fuera del BOM'], cod: ['código equivocado', 'códigos equivocados'] })[t][k > 1 ? 1 : 0]}`).join(' · ')}${r.enviadoF ? `<small class="muted" style="display:block">enviado ${fechaCorta(r.enviadoF)}${r.ref ? ' · ref. ' + esc(r.ref) : ''}</small>` : ''}${r.resol ? `<small class="muted" style="display:block">${esc(r.resol)}</small>` : ''}</td>
        <td><span class="pill ${ec}">${en}</span></td><td style="white-space:nowrap"><button class="btn sm ghost" data-a="pdf">PDF</button><button class="btn sm ghost" data-a="xls">Excel</button>${ro ? '' : '<button class="btn sm ghost" data-a="e">Estado…</button>'}</td></tr>`; }).join('') || '<tr><td colspan="6" class="muted" style="padding:20px">Todavía no hay reclamos.</td></tr>'}</tbody></table></div>
    <p class="hint">El reporte sale en inglés y castellano con los datos del proyecto del BOM (${esc(I.B.proyecto || '')} ${esc(I.B.nro || '')}), el código de material, el plano, el remito y las cantidades. Cuando lo mandes, marcalo <b>enviado</b>; cuando Trina reponga, registrá la reposición como una entrega más y marcá el reclamo <b>resuelto</b>.</p>`;
  if (!ro) {
    $$('.rsel', el).forEach((c) => { c.onchange = () => { const k = c.closest('tr').dataset.k; if (c.checked) reclUI.sel.add(k); else reclUI.sel.delete(k); render(false); }; });
    const st = $('#rSelT', el); if (st) st.onclick = () => { const ks = pend.filter((d) => d.tipo !== 'sobr').map((d) => d.key); reclUI.sel = reclUI.sel.size === ks.length ? new Set() : new Set(ks); render(false); };
    const nb = $('#rNew', el); if (nb) nb.onclick = () => trkNuevoRecl(pend.filter((d) => reclUI.sel.has(d.key)));
  }
  $$('tr[data-id]', el).forEach((tr) => { const r = I.T.recl.find((x) => x.id === tr.dataset.id);
    $$('[data-a]', tr).forEach((b) => { b.onclick = () => (b.dataset.a === 'pdf' ? trkPdfRecl(r) : b.dataset.a === 'xls' ? trkXlsRecl(r) : trkEstadoRecl(r)); }); });
}
async function trkNuevoRecl(ds) {
  if (!ds.length) return;
  const T = trkS(), n = T.recl.reduce((a, r) => Math.max(a, Number(String(r.num).replace(/\D/g, '')) || 0), 0) + 1, num = `NC-${String(n).padStart(3, '0')}`;
  const res = await modal({ title: `Reclamo ${num} a Trina`, sub: `${ds.length} diferencia${ds.length > 1 ? 's' : ''} de ${[...new Set(ds.map((d) => d.ent))].length} entrega${[...new Set(ds.map((d) => d.ent))].length > 1 ? 's' : ''}`, wide: true,
    body: `<div class="form"><label>Fecha<input type="date" id="rcF" value="${today()}"></label><label>Contacto en Trina (opcional)<input type="text" id="rcC" placeholder="Nombre / mail"></label><label class="full">Comentario para el fabricante (inglés o castellano)<input type="text" id="rcO" placeholder="ej. Please replace damaged parts in the next shipment"></label></div>
      <table class="tbl" style="margin-top:10px"><thead><tr><th>Tipo</th><th>Código</th><th>Descripción</th><th class="n">Cantidad</th><th>Remito</th><th>Detalle (va en el reporte)</th></tr></thead><tbody>
      ${ds.map((d) => `<tr data-k="${esc(d.key)}"><td>${TRK_TIPO[d.tipo][0]}</td><td class="mono">${esc(d.mat)}</td><td>${esc(d.desc)}</td><td class="n">${fmt(d.cant)}</td><td>${esc(d.e.remito || '–')}</td><td><input type="text" class="rc-o" value="${esc(d.l.obs || '')}" placeholder="ej. tubo abollado, caja abierta…"></td></tr>`).join('')}</tbody></table>`,
    buttons: [['Cancelar', 'btn', () => null], ['Crear reclamo', 'btn pri', (box) => ({ fecha: $('#rcF', box).value || today(), contacto: $('#rcC', box).value.trim(), obs: $('#rcO', box).value.trim(), det: Object.fromEntries($$('tbody tr', box).map((tr) => [tr.dataset.k, $('.rc-o', tr).value.trim()])) })]] });
  if (!res) return;
  const r = { id: uid('tn'), num, fecha: res.fecha, estado: 'borrador', contacto: res.contacto, obs: res.obs, _o: Date.now(),
    items: ds.map((d) => ({ key: d.key, ent: d.ent, mat: d.mat, tipo: d.tipo, cant: d.cant, desc: d.desc, remito: d.e.remito || '', fechaEnt: d.e.fecha, decl: Number(d.l.decl) || 0, rec: Number(d.l.rec) || 0, dan: Number(d.l.dan) || 0, det: res.det[d.key] || '' })) };
  T.recl.push(r); reclUI.sel.clear();
  commit(`Reclamo ${num} armado: ${ds.length} ítem${ds.length > 1 ? 's' : ''}`);
  toast(`Reclamo ${num} creado: exportalo en PDF o Excel para mandarlo a Trina`, { action: ['PDF', () => trkPdfRecl(r)], ms: 9000 });
}
async function trkEstadoRecl(r) {
  const res = await modal({ title: `Reclamo ${r.num}`, sub: `${(r.items || []).length} ítems · ${fechaCorta(r.fecha)}`,
    body: `<div class="form"><label>Estado<select id="reE"><option value="borrador" ${r.estado === 'borrador' ? 'selected' : ''}>Borrador</option><option value="enviado" ${r.estado === 'enviado' ? 'selected' : ''}>Enviado a Trina</option><option value="resuelto" ${r.estado === 'resuelto' ? 'selected' : ''}>Resuelto</option></select></label>
      <label>Fecha de envío<input type="date" id="reF" value="${r.enviadoF || today()}"></label><label>Referencia / N° de caso de Trina<input type="text" id="reR" value="${esc(r.ref || '')}"></label><label>Fecha de resolución<input type="date" id="reS" value="${r.resolF || today()}"></label>
      <label class="full">Resolución<input type="text" id="reT" value="${esc(r.resol || '')}" placeholder="ej. Repuesto en el contenedor del 20/12, packing list PL-…"></label></div>`,
    buttons: [['Eliminar reclamo', 'btn danger', () => 'del'], ['Cancelar', 'btn', () => null], ['Guardar', 'btn pri', (box) => ({ estado: $('#reE', box).value, enviadoF: $('#reF', box).value, ref: $('#reR', box).value.trim(), resolF: $('#reS', box).value, resol: $('#reT', box).value.trim() })]] });
  if (res === 'del') { if (await confirmar('Eliminar reclamo', `Se borra ${esc(r.num)}; sus diferencias vuelven a quedar sin reclamar.`, 'Eliminar', 'btn danger')) { const T = trkS(); T.recl = T.recl.filter((x) => x.id !== r.id); commit(`Reclamo ${r.num} eliminado`); } return; }
  if (!res) return;
  r.estado = res.estado; r.ref = res.ref; r.resol = res.resol;
  if (res.estado !== 'borrador') r.enviadoF = res.enviadoF || today(); else delete r.enviadoF;
  if (res.estado === 'resuelto') r.resolF = res.resolF || today(); else delete r.resolF;
  commit(`Reclamo ${r.num}: ${res.estado === 'enviado' ? 'enviado a Trina' : res.estado}`);
}

// ---------- reportes ----------
const trkProy = () => { const B = trkS().bom || {}; return { p: B.proyecto || S.nombre, nro: B.nro || '', doc: B.doc || '' }; };
function trkPdfRecl(r) {
  const P = trkProy(), it = r.items || [];
  const tot = (t) => it.filter((x) => x.tipo === t).reduce((a, x) => a + x.cant, 0);
  const html = `<div class="pr-h"><div><h1>Material receipt non-conformity report · Reclamo por recepción de materiales</h1>Report N° <b>${esc(r.num)}</b> · ${fechaCorta(r.fecha)} · ${esc(S.nombre)}</div><div>${esc(ED.app)}</div></div>
    <table class="tbl" style="margin:8px 0 12px;width:auto"><tbody><tr><td>Supplier / Proveedor</td><td><b>ChangZhou Trina Solar Energy Co., Ltd.</b></td></tr><tr><td>Project / Proyecto</td><td><b>${esc(P.p)}</b>${P.nro ? ' · Project No ' + esc(P.nro) : ''}</td></tr>
      <tr><td>Reference BOM</td><td>${esc(P.doc)}</td></tr>${r.contacto ? `<tr><td>Attention / Atención</td><td>${esc(r.contacto)}</td></tr>` : ''}<tr><td>Summary / Resumen</td><td>${['falt', 'dan', 'fuera', 'sobr'].filter((t) => tot(t)).map((t) => `${TRK_TIPO[t][1]} / ${TRK_TIPO[t][0]}: <b>${fmt(tot(t))}</b> pcs`).join(' · ')}</td></tr></tbody></table>
    <table class="tbl"><thead><tr><th>#</th><th>Issue / Tipo</th><th>Material Number</th><th>Drawing</th><th>Description</th><th>Delivery note / Packing list</th><th>Date</th><th class="n">Qty on PL</th><th class="n">Received OK</th><th class="n">Damaged</th><th class="n">Claimed qty</th><th>Remarks / Detalle</th></tr></thead><tbody>
    ${it.map((x, i) => { const b = (trkS().bom || { items: [] }).items.find((q) => q.k === x.mat) || {}; return `<tr><td>${i + 1}</td><td>${TRK_TIPO[x.tipo][1]}<br><small>${TRK_TIPO[x.tipo][0]}</small></td><td class="mono">${esc(x.mat)}</td><td class="mono">${esc((b.dib || [])[0] || '')}</td><td>${esc(b.desc || x.desc || '')}${b.size ? ' ' + esc(b.size) : ''}${b.largo ? ` · L=${b.largo} mm` : ''}</td><td>${esc(x.remito)}</td><td>${fechaCorta(x.fechaEnt)}</td><td class="n">${fmt(x.decl)}</td><td class="n">${fmt(x.rec)}</td><td class="n">${x.dan ? fmt(x.dan) : '–'}</td><td class="n"><b>${fmt(x.cant)}</b></td><td>${esc(x.det || '')}</td></tr>`; }).join('')}</tbody></table>
    ${r.obs ? `<p style="margin-top:12px"><b>Comments / Comentarios:</b> ${esc(r.obs)}</p>` : ''}
    <p style="margin-top:12px;font-size:11px">We kindly request the replacement of the parts listed above (shortages and damaged items) in the next shipment, or the corresponding credit note. · Solicitamos la reposición de los materiales indicados (faltantes y dañados) en el próximo envío o la nota de crédito correspondiente.</p>
    <div style="display:flex;gap:60px;margin-top:46px"><div style="border-top:1px solid #999;padding-top:4px;width:240px;font-size:11px">Received by / Recibió (${esc(S.nombre)})</div><div style="border-top:1px solid #999;padding-top:4px;width:240px;font-size:11px">Trina Solar acknowledgment</div></div>`;
  printHTML(html, `Reclamo ${r.num} Trina ${P.p}.pdf`, true);
}
async function trkXlsRecl(r) {
  const P = trkProy(), B = trkS().bom || { items: [] }, wb = XLSX.utils.book_new();
  const a = [['Material receipt non-conformity report · Reclamo por recepción de materiales'], ['Report N°', r.num, 'Date', r.fecha], ['Supplier', 'ChangZhou Trina Solar Energy Co., Ltd.'], ['Project', P.p, 'Project No', P.nro], ['Reference BOM', P.doc], ['Contractor', S.nombre], [],
    ['#', 'Issue', 'Tipo', 'Material Number', 'Drawing', 'Description', 'Size', 'Length (mm)', 'Delivery note / Packing list', 'Delivery date', 'Qty on PL', 'Received OK', 'Damaged', 'Claimed qty', 'Remarks']];
  (r.items || []).forEach((x, i) => { const b = B.items.find((q) => q.k === x.mat) || {}; a.push([i + 1, TRK_TIPO[x.tipo][1], TRK_TIPO[x.tipo][0], x.mat, (b.dib || [])[0] || '', b.desc || x.desc || '', b.size || '', b.largo || '', x.remito, x.fechaEnt, x.decl, x.rec, x.dan, x.cant, x.det || '']); });
  if (r.obs) { a.push([]); a.push(['Comments', r.obs]); }
  const w = XLSX.utils.aoa_to_sheet(a); w['!cols'] = [4, 11, 13, 16, 22, 40, 14, 10, 26, 11, 9, 11, 9, 11, 40].map((x) => ({ wch: x })); XLSX.utils.book_append_sheet(wb, w, r.num);
  const p = await window.api.saveBinary(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }), `Reclamo ${r.num} Trina ${P.p}.xlsx`, 'xlsx', 'Excel');
  if (p) toast('Reclamo exportado', { action: ['Abrir', () => window.api.openPath(p)] });
}
function trkPdfEnt(id) {
  const I = trkInfo(), e = I.T.ent.find((x) => x.id === id); if (!e) return;
  const idx = new Map(I.B.items.map((i) => [i.k, i]));
  const html = prHead('Constancia de recepción de materiales · trackers', `${fechaCorta(e.fecha)} · remito ${esc(e.remito || '–')}`) +
    `<p>Contenedor / patente: <b>${esc(e.cont || '–')}</b> · Transporte: ${esc(e.transp || '–')} · Recibió: ${esc(e.resp || '–')}${e.obs ? ` · ${esc(e.obs)}` : ''}</p>
    <table class="tbl"><thead><tr><th>Código</th><th>Descripción</th><th class="n">Declarado</th><th class="n">Recibido OK</th><th class="n">Dañado</th><th class="n">Diferencia</th><th>Observación</th></tr></thead><tbody>
    ${(e.lin || []).map((l) => { const it = idx.get(trkKey(l.mat)), f = (Number(l.decl) || 0) - (Number(l.rec) || 0) - (Number(l.dan) || 0);
      return `<tr><td class="mono">${esc(l.mat)}</td><td>${it ? trkDescH(it) : esc(l.desc || '') + ' <b>(fuera del BOM)</b>'}</td><td class="n">${fmt(l.decl)}</td><td class="n">${fmt(l.rec)}</td><td class="n">${l.dan ? fmt(l.dan) : '–'}</td><td class="n">${f > 0 ? `<b>faltan ${fmt(f)}</b>` : f < 0 ? `sobran ${fmt(-f)}` : '✓'}</td><td>${esc(l.obs || '')}</td></tr>`; }).join('')}</tbody></table>
    <div style="display:flex;gap:60px;margin-top:46px"><div style="border-top:1px solid #999;padding-top:4px;width:220px;font-size:11px">Recibió</div><div style="border-top:1px solid #999;padding-top:4px;width:220px;font-size:11px">Transportista</div></div>`;
  printHTML(html, `Recepcion trackers ${e.fecha} ${e.remito || ''}.pdf`.replace(/\s+\.pdf$/, '.pdf'), true);
}
async function trkExport() {
  const I = trkInfo(); if (!I.B) return;
  const wb = XLSX.utils.book_new();
  const a = [['Código', 'Plano', 'Tipo', 'Descripción', 'Tamaño', 'Largo (mm)', 'Peso unit. (kg)', 'BOM neto', 'Repuestos', 'Extra', 'BOM total', 'Recibido OK', 'Dañado', 'Falta recibir', 'Avance %', 'Estado']];
  I.mats.forEach((o) => a.push([o.it.k, (o.it.dib || []).join(', '), trkCat(o.it.cat)[0], o.it.desc, o.it.size || '', o.it.largo || '', o.it.peso || '', o.it.neto || '', o.it.rep || '', o.it.ext || '', o.tot, o.rec, o.dan, o.pend, Math.round(o.p * 1000) / 10, TRK_EST[o.est][0]]));
  const w1 = XLSX.utils.aoa_to_sheet(a); w1['!cols'] = [16, 22, 22, 40, 14, 10, 10, 9, 9, 7, 10, 11, 8, 11, 9, 12].map((x) => ({ wch: x })); XLSX.utils.book_append_sheet(wb, w1, 'Estado por código');
  const b = [['Fecha', 'Remito / packing list', 'Contenedor / patente', 'Transporte', 'Recibió', 'Código', 'Descripción', 'Declarado', 'Recibido OK', 'Dañado', 'Diferencia', 'Observación']];
  I.T.ent.slice().sort((x, y) => String(x.fecha).localeCompare(String(y.fecha))).forEach((e) => (e.lin || []).forEach((l) => { const it = I.B.items.find((q) => q.k === trkKey(l.mat)) || {}; b.push([e.fecha, e.remito, e.cont, e.transp, e.resp, l.mat, it.desc || l.desc || '', l.decl, l.rec, l.dan || 0, (Number(l.decl) || 0) - (Number(l.rec) || 0) - (Number(l.dan) || 0), l.obs || '']); }));
  const w2 = XLSX.utils.aoa_to_sheet(b); w2['!cols'] = [11, 22, 18, 16, 16, 16, 36, 10, 11, 8, 10, 30].map((x) => ({ wch: x })); XLSX.utils.book_append_sheet(wb, w2, 'Entregas');
  const c = [['Diferencia', 'Código', 'Descripción', 'Cantidad', 'Remito', 'Fecha entrega', 'Reclamo', 'Estado del reclamo']];
  I.difs.forEach((d) => c.push([TRK_TIPO[d.tipo][0], d.mat, d.desc, d.cant, d.e.remito, d.e.fecha, d.recl ? d.recl.num : 'sin reclamar', d.recl ? d.recl.estado : '']));
  const w3 = XLSX.utils.aoa_to_sheet(c); w3['!cols'] = [14, 16, 36, 9, 22, 12, 10, 14].map((x) => ({ wch: x })); XLSX.utils.book_append_sheet(wb, w3, 'Diferencias');
  const p = await window.api.saveBinary(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }), `Recepcion materiales trackers ${today()}.xlsx`, 'xlsx', 'Excel');
  if (p) toast('Excel exportado', { action: ['Abrir', () => window.api.openPath(p)] });
}
// ---------- Inicio ----------
function trkModHTML() {
  const I = trkInfo(); if (!I.B) return '';
  return `<div class="card mcard" data-go="trec" title="Ver recepción de materiales"><div class="mh"><div>${Charts.ring(I.p, '#3fb27f', 'recibido')}</div><div><h3>Materiales de trackers</h3><div class="muted">${fmt(I.pesoR / 1000, 1)} / ${fmt(I.pesoT / 1000, 1)} t recibidas · ${I.nOk}/${I.nItems} códigos completos${I.sinRecl.length ? `<br><b class="tneg">${I.sinRecl.length} diferencia${I.sinRecl.length > 1 ? 's' : ''} sin reclamar</b>` : ''}${I.abiertos.length ? `<br>${I.abiertos.length} reclamo${I.abiertos.length > 1 ? 's' : ''} abierto${I.abiertos.length > 1 ? 's' : ''}` : ''}</div></div></div>
    ${I.cats.slice(0, 5).map((x) => { const [n, c] = trkCat(x.c); return `<div class="mrow"><span>${esc(n)}</span><div class="sbt"><div style="width:${(x.p * 100).toFixed(1)}%;background:${c}"></div></div><b>${fmt(x.p * 100)}%</b></div>`; }).join('')}</div>`;
}

// apartados de Trackers todavía en preparación
function vPronto(el) {
  actions([]);
  const t = view === 'tarm' ? ['Armado de estructuras', 'Avance por tracker del montaje de la estructura: motor (slewing drive), vigas de torsión, correas, rodamientos, amortiguadores y TCU, con el material recibido de cada código.']
    : ['Instalación de paneles solares', 'Avance por tracker del montaje de los módulos (52 o 26 por tracker), con conexionado de strings y control de bulonería.'];
  el.innerHTML = `<div class="card" style="padding:44px 24px;text-align:center"><span class="pill p-warn" style="text-transform:uppercase;letter-spacing:.4px">Pronto</span><h3 style="margin:14px 0 8px;font-size:18px">${t[0]}</h3><p class="muted" style="max-width:560px;margin:0 auto">${t[1]}</p></div>`;
}
