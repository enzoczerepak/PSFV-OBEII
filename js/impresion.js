/* Antes de imprimir: todo color semitransparente pasa a su equivalente sólido sobre blanco (sin máscaras ni alfa en el PDF) */
function aplanarTransparencias(root) {
  const cv = document.createElement('canvas').getContext('2d');
  const rgba = (c) => { if (!c || c === 'none' || c.startsWith('url')) return null; cv.fillStyle = '#000'; cv.fillStyle = c; const v = cv.fillStyle; if (v.startsWith('#')) return [parseInt(v.slice(1, 3), 16), parseInt(v.slice(3, 5), 16), parseInt(v.slice(5, 7), 16), 1]; const m = v.match(/[\d.]+/g); return m ? m.map(Number) : null; };
  const solido = (c, a) => { const x = rgba(c); if (!x) return null; const al = (x[3] ?? 1) * a; if (al >= 0.999) return a < 1 || x[3] < 1 ? `rgb(${x[0]},${x[1]},${x[2]})` : null; const m = (v) => Math.round(255 - (255 - v) * al); return `rgb(${m(x[0])},${m(x[1])},${m(x[2])})`; };
  $$('*', root).forEach((e) => {
    const c = getComputedStyle(e), svg = e instanceof SVGElement && e.tagName !== 'svg';
    let op = 1; if (svg) for (let n = e; n && n !== root && n instanceof SVGElement; n = n.parentNode) op *= Number(getComputedStyle(n).opacity || 1);
    if (svg) {
      const fo = Number(c.fillOpacity || 1) * op, so = Number(c.strokeOpacity || 1) * op;
      const f = solido(c.fill, fo), st = solido(c.stroke, so);
      if (f) e.style.setProperty('fill', f, 'important'); if (e.tagName === 'text') e.style.setProperty('stroke', 'none', 'important'); else if (st) e.style.setProperty('stroke', st, 'important');
      e.style.setProperty('fill-opacity', '1', 'important'); e.style.setProperty('stroke-opacity', '1', 'important'); e.style.setProperty('opacity', '1', 'important');
      if (e.tagName === 'g' || e.tagName === 'svg') e.style.setProperty('opacity', '1', 'important');
    } else {
      [['background-color', c.backgroundColor], ['color', c.color], ['border-top-color', c.borderTopColor], ['border-right-color', c.borderRightColor], ['border-bottom-color', c.borderBottomColor], ['border-left-color', c.borderLeftColor]].forEach(([k, v]) => { const x = rgba(v); if (x && x[3] < 1) { if (x[3] === 0) return; e.style.setProperty(k, solido(v, 1), 'important'); } });
      if (c.backgroundImage && c.backgroundImage !== 'none' && /gradient/.test(c.backgroundImage)) e.style.setProperty('background-image', 'none', 'important');
    }
  });
  $$('g, svg', root).forEach((g) => g.style.setProperty('opacity', '1', 'important'));
}
/* PSFV-OBE II · Impresión a PDF, datos del parque e importación de circuitos desde PDF. */
// ======================= impresión =======================
async function printPlan(cat, modo) {
  const cMap = new Map(R.circuitos.map((c) => [c.id, c]));
  const bobs = R.bobinas.filter((b) => b.cat === cat && (modo === 'listos' ? b.cortes.some((p) => p.estado === 'listo') : b.cortes.length));
  if (!bobs.length) { toast(modo === 'listos' ? 'No hay cortes listos: falta abrir zanjas o cargar bobinas' : 'No hay cortes en el plan'); return; }
  const est = { ejecutado: 'Ejecutado', listo: 'Cortar', provisorio: 'Provisorio' };
  const tolOn = cat !== 'PAT' && MG.R === R && MG.datos;
  let h = `<div class="pr-h"><div><h1>${modo === 'listos' ? 'Hoja de corte' : 'Plan de corte'} · ${CATN[cat]}</h1>${esc(S.nombre)}</div><div>${new Date().toLocaleString('es-AR')}</div></div>`;
  bobs.forEach((b) => {
    const cortes = modo === 'listos' ? b.cortes.filter((p) => p.estado !== 'provisorio') : b.cortes;
    h += `<div class="pr-bob"><h2><span>Bobina ${esc(b.codigo)} · N° ${esc(b.nro)} · ${b.seccion} mm²</span><span>Entrada ${fmt(b.entrada)} m · saldo actual ${fmt(b.saldoActual, 1)} m</span></h2>
      <table><tr><th>#</th><th>Estado</th><th>Circuito</th><th>Desde → Hasta</th><th>Fase</th><th class="n">Metros</th>${tolOn ? '<th class="n">Seguro ≤</th><th class="n">Riesgo ≤</th>' : ''}<th class="n">Saldo</th><th>OK</th></tr>
      ${cortes.map((p) => { const c = cMap.get(p.cid); const t = tolOn && p.estado === 'listo' ? Margen.tolerancia(mgDe(c.key), c.lenFase, tolF()) : null; return `<tr class="${p.estado}"><td>${p.corte}</td><td>${est[p.estado]}</td><td>${esc(c.designacion)}</td><td>${esc(c.desde)} → ${esc(c.hasta)}</td><td>${p.fase === 'C' ? '' : p.fase}</td><td class="n">${fmt(p.len, 2)}</td>${tolOn ? `<td class="n">${t ? (t.sinMargen ? '—' : fmt(t.seg, 1)) : ''}</td><td class="n">${t ? (t.sinMargen ? 'sin margen' : fmt(t.max, 1)) : ''}</td>` : ''}<td class="n">${fmt(p.saldo, 1)}</td><td>${p.estado === 'ejecutado' ? '<span class="chk ok"></span>' : '<span class="chk"></span>'}</td></tr>`; }).join('')}
      </table></div>`;
  });
  if (tolOn) h += `<p style="font-size:9pt;color:#555;margin-top:8px">Seguro / Riesgo: metros por conductor que se pueden tirar sin comprometer el cable que falta tender (seguro = ${fmt(tolF() * 100)} % del margen; riesgo = todo el margen; más que eso, falta de cable). Tirar de menos siempre es favorable.</p>`;
  $('#printArea').innerHTML = h; aplanarTransparencias($('#printArea'));
  document.documentElement.style.background = document.body.style.background = '#fff';
  const p = await window.api.printPDF(`${modo === 'listos' ? 'Hoja de corte' : 'Plan de corte'} ${cat} ${today()}.pdf`);
  document.documentElement.style.background = document.body.style.background = '';
  if (p) toast('PDF guardado', { action: ['Abrir', () => window.api.openPath(p)] });
}


// ======================= DATOS DEL PARQUE (versión en blanco) =======================
function parqueResumen() {
  const P = S.parque || {};
  const f = (l, v) => (v ? `<div class="kv"><span>${l}</span><b>${esc(v)}</b></div>` : '');
  return `<div class="pq">${f('Proyecto', P.nombre)}${f('Ubicación', P.ubicacion)}${f('Comitente', P.comitente)}${f('Contratista', P.contratista)}
    ${f('Potencia', [P.mwp ? fmt(P.mwp, 2) + ' MWp' : '', P.mwac ? fmt(P.mwac, 2) + ' MWac' : ''].filter(Boolean).join(' · '))}${f('Inicio de obra', P.inicio ? fechaCorta(P.inicio) : '')}
    ${f('Tensiones', `BT ${kvTxt(P.kvBT || 0.8)} kV · MT ${kvTxt(P.kvMT || 33)} kV`)}${f('PAT', `${P.patBT || 25} mm² en BT · ${P.patMT || 95} mm² en MT`)}
    ${f('Estaciones (STS)', (P.sts || []).length ? P.sts.map((x) => `${x.id}${x.mva ? ' (' + fmt(x.mva, 1) + ' MVA)' : ''}`).join(' · ') : 'sin cargar')}</div>
    ${window.READONLY ? '' : '<div style="margin-top:10px"><button class="btn" id="pParque">Editar datos del parque</button></div>'}`;
}
async function asistenteParque(primera) {
  const P = Object.assign({ kvBT: 0.8, kvMT: 33, patBT: 25, patMT: 95, sts: [] }, S.parque || {});
  const filasSts = (n, prev) => Array.from({ length: n }, (_, i) => { const o = prev[i] || {}; return `<div class="stsr"><input type="text" class="sId" value="${esc(o.id || 'STS ' + (i + 1))}"><input type="number" class="sMva" step="0.1" min="0" placeholder="MVA" value="${o.mva || ''}"><span class="muted">MVA</span></div>`; }).join('');
  const res = await modal({
    title: primera ? 'Bienvenido · datos del parque' : 'Datos del parque', wide: true,
    sub: primera ? 'Cargá los datos básicos de la obra. Después vas a poder cargar las bobinas y los circuitos del plan de cables. Todo se puede cambiar más adelante en Ajustes.' : '',
    body: `<div class="form pqf">
      <label class="full">Nombre del proyecto *<input type="text" name="nombre" placeholder="Ej.: PSFV Los Algarrobos" value="${esc(P.nombre || '')}"></label>
      <label>Ubicación<input type="text" name="ubicacion" placeholder="Localidad, provincia" value="${esc(P.ubicacion || '')}"></label>
      <label>Inicio de obra<input type="date" name="inicio" value="${esc(P.inicio || '')}"></label>
      <label>Comitente / cliente<input type="text" name="comitente" value="${esc(P.comitente || '')}"></label>
      <label>Empresa contratista<input type="text" name="contratista" value="${esc(P.contratista || '')}"></label>
      <label>Potencia DC (MWp)<input type="number" step="0.01" min="0" name="mwp" value="${P.mwp || ''}"></label>
      <label>Potencia AC (MW)<input type="number" step="0.01" min="0" name="mwac" value="${P.mwac || ''}"></label>
      <label>Tensión BT (kV)<input type="number" step="0.01" min="0" name="kvBT" value="${P.kvBT}"></label>
      <label>Tensión MT (kV)<input type="number" step="0.1" min="0" name="kvMT" value="${P.kvMT}"></label>
      <label>PAT en zanjas BT (mm² Cu desnudo)<input type="number" step="1" min="0" name="patBT" value="${P.patBT}"></label>
      <label>PAT en zanjas MT (mm² Cu desnudo)<input type="number" step="1" min="0" name="patMT" value="${P.patMT}"></label>
      <label class="full">Estaciones transformadoras (STS / centros de transformación)<span class="stsn"><input type="number" min="0" max="60" name="nSts" value="${P.sts.length}"> <span class="muted">cantidad · nombre y potencia de cada una:</span></span></label>
      <div class="full" id="stsL">${filasSts(P.sts.length, P.sts)}</div></div>
      <p class="hint">Las STS se usan en Fundaciones (avance de bases por etapa). Las tensiones y secciones de PAT aparecen en los títulos, planes de corte y exportaciones.</p>`,
    buttons: (primera ? [] : [['Cancelar', 'btn', () => null]]).concat([[primera ? 'Empezar' : 'Guardar', 'btn pri', (box) => {
      const v = (n) => $(`[name=${n}]`, box).value.trim(), nn = (n) => { const x = parseFloat(v(n).replace(',', '.')); return isFinite(x) && x > 0 ? x : null; };
      if (!v('nombre')) { $('[name=nombre]', box).focus(); $('[name=nombre]', box).classList.add('bad'); return false; }
      const sts = $$('.stsr', box).map((r) => ({ id: $('.sId', r).value.trim(), mva: parseFloat($('.sMva', r).value) || null })).filter((x) => x.id);
      return { nombre: v('nombre'), ubicacion: v('ubicacion'), inicio: v('inicio'), comitente: v('comitente'), contratista: v('contratista'), mwp: nn('mwp'), mwac: nn('mwac'),
        kvBT: nn('kvBT') || 0.8, kvMT: nn('kvMT') || 33, patBT: nn('patBT') || 25, patMT: nn('patMT') || 95, sts };
    }]]),
    onOpen: null,
  });
  if (!res) { if (primera && !S.parque) setTimeout(() => asistenteParque(true), 50); return; }
  S.parque = res; S.nombre = res.nombre; aplicarParque(S);
  window.api.netObra(S.nombre); marca();
  commit(primera ? `Parque "${res.nombre}" creado` : 'Datos del parque actualizados');
  if (primera) setTimeout(() => toast('Siguiente paso: cargá las bobinas (Tendido → Bobinas) y los circuitos (Circuitos → Importar PDF o Excel)', { ms: 9000 }), 600);
}
// el modal no tiene gancho de apertura: se engancha la lista de STS por delegación
document.addEventListener('input', (e) => {
  if (!e.target.matches('.pqf [name=nSts]')) return;
  const box = e.target.closest('.mbody'), L = $('#stsL', box), n = Math.max(0, Math.min(60, parseInt(e.target.value, 10) || 0));
  const prev = $$('.stsr', L).map((r) => ({ id: $('.sId', r).value, mva: $('.sMva', r).value }));
  const mva = (prev[prev.length - 1] || {}).mva || '';
  L.innerHTML = Array.from({ length: n }, (_, i) => { const o = prev[i] || { id: 'STS ' + (i + 1), mva }; return `<div class="stsr"><input type="text" class="sId" value="${esc(o.id)}"><input type="number" class="sMva" step="0.1" min="0" placeholder="MVA" value="${esc(o.mva)}"><span class="muted">MVA</span></div>`; }).join('');
});
document.addEventListener('change', (e) => { if (e.target.id === 'pAll') $$('.pdfimp .pS').forEach((c) => (c.checked = e.target.checked)); });
function marca() {
  const P = S.parque;
  if ($('#brandN')) { $('#brandN').textContent = ED.app; if (ED.app.length > 18) $('#brandN').style.fontSize = '14px'; }
  $('#brandS') && ($('#brandS').textContent = ED.blank ? (P && P.nombre) || 'Gestión de obra' : 'Gestión de obra');
  document.title = ED.blank && P && P.nombre ? `${P.nombre} · ${ED.app}` : document.title.replace(/^PSFV-OBE II/, ED.app);
  // tensiones en el menú
  $$('#nav .g-BT .ghn').forEach((x) => (x.textContent = CATL.BT)); $$('#nav .g-MT .ghn').forEach((x) => (x.textContent = CATL.MT));
  // sin plano cargado no se muestra "Plano de obra"
  $$('[data-view="plano"]').forEach((b) => (b.style.display = window.PLANO ? '' : 'none'));
}

// ======================= IMPORTAR CIRCUITOS DESDE PDF =======================
async function importarPdf(ctxCat, archivo) {
  if (window.READONLY) return;
  const f = await window.api.pickPdfPlan(archivo); if (!f) return;
  if (f.error) { toast('No se pudo leer el PDF: ' + f.error, { err: true, ms: 7000 }); return; }
  const { filas, avisos } = window.PdfPlan.leer(f.paginas);
  if (!filas.length) {
    await modal({ title: 'Importar PDF', sub: esc(f.path.split(/[\\/]/).pop()), body: `<p>${esc(avisos[0] || 'No encontré circuitos.')}</p><p class="hint">Si el PDF es una imagen escaneada no tiene texto para leer. En ese caso pasá los circuitos a la planilla modelo (botón "Plantilla Excel") e importala con "Importar Excel".</p>` });
    return;
  }
  // el circuito ya cargado: misma designación y origen; si no, misma designación cuando es única (en MT los nombres de origen cambian entre revisiones)
  const ex = (r) => S.circuitos.find((c) => !c.vinculo && c.designacion === r.designacion && c.desde === r.desde)
    || (() => { const m = S.circuitos.filter((c) => !c.vinculo && c.designacion === r.designacion); return m.length === 1 && filas.filter((x) => x.designacion === r.designacion).length === 1 ? m[0] : null; })();
  const num2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
  const cambia = (e, r) => num2(e.cantidad) !== num2(r.cantidad) || num2(e.lineal) !== num2(r.lineal) || String(e.formacion || '').replace(/\s/g, '') !== String(r.formacion || '').replace(/\s/g, '') || Number(e.fases || 3) !== Number(r.fases || 3);
  const estado = (r) => { const e = ex(r); if (!e) return '<span class="tag ok">nuevo</span>';
    const lc = Number(e.largoCorte) > 0 ? `<label class="lcq" title="Este circuito tiene un largo de corte cargado a mano (${fmt(e.largoCorte, 1)} m por conductor), que manda sobre la lista"><input type="checkbox" class="pLc" checked> quitar largo a mano (${fmt(e.largoCorte, 1)} m) → ${fmt((Number(r.cantidad) || 0) / (Number(r.fases) || 3), 1)} m</label>` : '';
    return `${cambia(e, r) ? `<span class="tag" title="Antes: ${fmt(e.cantidad, 2)} m · ${esc(e.formacion)}">actualiza</span>` : '<span class="tag muted">sin cambios</span>'}${lc}`; };
  const fila = (r, i) => `<tr data-i="${i}"><td><input type="checkbox" class="pS" ${ctxCat && ctxCat !== r.cat ? '' : 'checked'}></td>
    <td><select class="pC"><option ${r.cat === 'BT' ? 'selected' : ''}>BT</option><option ${r.cat === 'MT' ? 'selected' : ''}>MT</option></select></td>
    <td><input class="pD" value="${esc(r.designacion)}"></td><td><input class="pDe" value="${esc(r.desde)}"></td><td><input class="pT" value="${esc(r.tablero)}"></td><td><input class="pH" value="${esc(r.hasta)}"></td>
    <td><input class="pL n" value="${r.lineal ?? ''}"></td><td><input class="pE n" value="${r.efectiva ?? ''}"></td><td><input class="pF" value="${esc(r.formacion)}"></td>
    <td><input class="pFa n" value="${r.fases}"></td><td><input class="pQ n" value="${r.cantidad ?? ''}"></td><td class="muted">${r.pag}</td><td>${estado(r)}</td></tr>`;
  const nBT = filas.filter((r) => r.cat === 'BT').length, nMT = filas.length - nBT;
  const nUp = filas.filter((r) => { const e = ex(r); return e && cambia(e, r); }).length, nNew = filas.filter((r) => !ex(r)).length, nLc = filas.filter((r) => { const e = ex(r); return e && Number(e.largoCorte) > 0; }).length;
  const res = await modal({
    title: 'Importar circuitos desde PDF', wide: true, sub: `${esc(f.path.split(/[\\/]/).pop())} · ${filas.length} circuitos encontrados (${nBT} BT · ${nMT} MT)`,
    body: `<div class="alert info" style="display:block;margin-bottom:8px"><b>${nNew}</b> circuitos nuevos · <b>${nUp}</b> con cambios · <b>${filas.length - nNew - nUp}</b> sin cambios${nLc ? ` · <b>${nLc}</b> con largo de corte cargado a mano` : ''}. Lo tendido no se toca.</div><p class="hint">Revisá la tabla antes de importar: podés corregir cualquier celda, cambiar el tipo o destildar filas. Largo efectivo y cantidad (m totales = largo × conductores) son los que usa el plan de corte.</p>
      <div class="pdfimp"><table class="tbl"><thead><tr><th><input type="checkbox" id="pAll" checked></th><th>Tipo</th><th>Designación</th><th>Desde</th><th>Tablero</th><th>Hasta</th><th>Lineal (m)</th><th>Efectiva (m)</th><th>Formación</th><th>Cond.</th><th>Cantidad (m)</th><th>Pág.</th><th></th></tr></thead>
      <tbody>${filas.map(fila).join('')}</tbody></table></div>`,
    buttons: [['Cancelar', 'btn', () => null], ['Importar seleccionados', 'btn pri', (box) => $$('tbody tr', box).filter((tr) => $('.pS', tr).checked).map((tr) => {
      const g = (c) => $(c, tr).value.trim(), n = (c) => { const v = parseFloat(g(c).replace(',', '.')); return isFinite(v) ? v : null; };
      const o = { cat: g('.pC'), designacion: g('.pD'), desde: g('.pDe'), hasta: g('.pH'), formacion: g('.pF'), fases: n('.pFa') || 3, lineal: n('.pL'), cantidad: n('.pQ') };
      if (g('.pT')) o.tablero = g('.pT'); if (n('.pE')) o.efectiva = n('.pE');
      o._i = Number(tr.dataset.i); const lc = $('.pLc', tr); if (lc && lc.checked) o._sinLc = true;
      if (!o.cantidad && (o.efectiva || o.lineal)) o.cantidad = Math.round((o.efectiva || o.lineal) * o.fases * 100) / 100;
      return o;
    }).filter((o) => o.designacion && o.formacion && o.cantidad)]],
  });
  if (!res || !res.length) return;
  let a = 0, u = 0;
  let lcq = 0;
  res.forEach((nc, k) => {
    const sinLc = nc._sinLc, fi = filas[nc._i]; delete nc._sinLc; delete nc._i;
    const e = S.circuitos.find((c) => !c.vinculo && c.designacion === nc.designacion && c.desde === nc.desde) || (fi && ex(fi));
    if (e) {
      // coincidió solo por designación: se conservan los nombres de origen y destino ya cargados
      if (e.desde !== nc.desde) { delete nc.desde; delete nc.hasta; delete nc.tablero; }
      if (sinLc && e.largoCorte) { delete e.largoCorte; lcq++; }
      Object.assign(e, nc); u++; }
    else { S.circuitos.push(Object.assign({ id: uid('c'), real: {}, zanja: 'no abierta', zanjaLargo: nc.lineal || null, _o: Date.now() + k }, nc)); a++; }
  });
  if (!S.fuente) S.fuente = 'Circuitos: ' + f.path.split(/[\\/]/).pop();
  if (lcq) recalcularTodo('BT'), recalcularTodo('MT');
  commit(`Importado del PDF · ${a} circuitos nuevos, ${u} actualizados${lcq ? ` · ${lcq} largo${lcq > 1 ? 's' : ''} a mano quitado${lcq > 1 ? 's' : ''}` : ''}`);
}
async function menuImportar(cat, soloBobinas) {
  const op = [];
  if (!soloBobinas && window.api.pickPdfPlan) op.push(['pdf', 'Desde el plan de cables en PDF', 'Lee la tabla de circuitos del PDF (lista de cables) y te deja revisarla antes de importar.']);
  op.push(['xls', 'Desde una planilla Excel', soloBobinas ? 'Planilla de ingreso de bobinas (la plantilla o una propia con títulos N° de bobina, sección, entrada…).' : 'Planilla con circuitos y/o bobinas (la plantilla o una propia con títulos Designación, Desde, Hasta, Formación…).']);
  if (window.api.plantilla) op.push(['tpl', 'Descargar plantilla Excel vacía', 'Para pasar a mano los circuitos y las bobinas e importarlos después.']);
  const r = await modal({ title: 'Importar', body: `<div class="impop">${op.map(([k, t, d]) => `<button class="impo" data-k="${k}"><b>${t}</b><span>${d}</span></button>`).join('')}</div>`, buttons: [['Cancelar', 'btn', () => null]] });
  void r;
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('.impo'); if (!b) return;
  const k = b.dataset.k, cat = ['BT', 'MT'].includes((view || '').split('-')[0]) ? view.split('-')[0] : null;
  $('#modal').classList.add('hidden');
  if (k === 'pdf') importarPdf(cat); else if (k === 'xls') importExcel(cat); else guardarPlantilla();
});
async function guardarPlantilla() {
  const p = await window.api.plantilla(); if (p) toast('Plantilla guardada', { action: ['Abrir', () => window.api.openPath(p)] });
}
