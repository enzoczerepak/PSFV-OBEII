/* PSFV-OBE II · Base: utilidades, estado de la obra, interfaz común (modales, avisos) y navegación. */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n, d = 0) => (n == null || isNaN(n) ? '–' : Number(n).toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d }));
const today = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const uid = (p) => p + Math.random().toString(36).slice(2, 9);
const CATS = Engine.CATS;
const ED = window.EDICION || { blank: false, app: 'PSFV-OBE II', corto: 'PSFV-OBEII' };
const CATN = { BT: 'BT 0,8 kV', MT: 'MT 33 kV', PAT: 'PAT Cu desnudo', LA: 'LA 33 kV Prysalac' };
const CATL = { BT: 'BT · 0,8 kV', MT: 'MT · 33 kV', PAT: 'PAT · Cu desnudo', LA: 'LA · Línea aérea' };
const CATK = Object.keys(CATS); // BT, MT, PAT, LA
// categorías a mostrar: la línea aérea aparece cuando se cargó algún tramo o bobina
// la línea aérea (LA) no tiene plan de corte: su avance se lleva en el apartado LMT; sus bobinas Prysalac siguen en Bobinas
const catsUso = () => CATK.filter((c) => c !== 'LA');
window.CATN = CATN;
let STSL = ['STS 1', 'STS 2', 'STS 3', 'STS 4'];
const kvTxt = (v) => String(v).replace('.', ',');
// datos del parque (versión en blanco): tensiones, sección de PAT y estaciones transformadoras
function aplicarParque(st) {
  const P = st.parque; if (!P) return;
  const bt = P.kvBT || 0.8, mt = P.kvMT || 33;
  CATN.BT = `BT ${kvTxt(bt)} kV`; CATN.MT = `MT ${kvTxt(mt)} kV`; CATL.BT = `BT · ${kvTxt(bt)} kV`; CATL.MT = `MT · ${kvTxt(mt)} kV`;
  Engine.CATS.BT.nombre = `Baja tensión ${kvTxt(bt)} kV`; Engine.CATS.MT.nombre = `Media tensión ${kvTxt(mt)} kV`;
  Engine.PAT_SEC.BT = `1x${P.patBT || 25} mm² Cu desnudo`; Engine.PAT_SEC.MT = `1x${P.patMT || 95} mm² Cu desnudo`;
  STSL = (P.sts || []).map((x) => x.id);
}
const ctag = (c) => `<i class="cdot c-${c}"></i>`;

let S = null, R = null, view = 'resumen', seedCache = null;
let NET = { modo: 'local' }, netStatus = { ok: null, msg: '' }, syncBusy = false, syncTimer = null;
let WEB = null, webTimer = null;
const ui = { sec: {}, est: {}, q: {}, sts: {}, cest: {}, zf: {}, sel: new Set(), bobCat: 'all', zTipo: 'all', zEst: 'all', zQ: '' };

// ======================= estado =======================
function normalizar(st) {
  st.params = Object.assign({ margen: 0, minUtil: 30, cola: 0 }, st.params || {});
  st.fundaciones = st.fundaciones || {};
  normalizarHincado(st);
  st.cronoTareas = st.cronoTareas || [];
  st.partes = st.partes || [];
  // una vez: descartar borrados de fundaciones que generaba una versión anterior en red (no eran borrados reales)
  const y0 = st.__sync;
  if (y0 && !y0.fmig) { Object.keys(y0.meta || {}).forEach((k) => { if (k.startsWith('f:') && y0.meta[k].d) { delete y0.meta[k]; if (y0.pend) delete y0.pend[k]; if (y0.snap) delete y0.snap[k]; } }); y0.fmig = 1; }
  st.bobinas = (st.bobinas || []).map((b, i) => Object.assign({ id: uid('b'), cat: 'BT', _o: i }, b));
  st.circuitos = (st.circuitos || []).map((c) => {
    const o = Object.assign({ id: uid('c'), real: {}, fases: 3 }, c);
    if (o._o == null && !o.vinculo) o._o = st.circuitos.indexOf(c);
    if (!o.cat) o.cat = o.vinculo ? 'PAT' : 'BT';
    if (!o.vinculo && !o.zanjaId && !o.zanja) o.zanja = o.zanjaOk || Object.keys(o.real || {}).length ? 'abierta' : 'no abierta';
    delete o.zanjaOk; delete o.recorrido;
    return o;
  });
  delete st.tramos;
  st.nombre = (st.nombre || 'Obra').replace(/ – Cables BT$/, ' – Cables');
  Engine.sincronizarPAT(st);
  // ajustes de obra informados (se aplican una sola vez)
  st.migr = st.migr || {};
  if (ED.blank) Object.assign(st.migr, { mt120: true, lista0110: true, tx2_12: true });
  aplicarParque(st);
  if (!st.migr.mt120) {
    const c = st.circuitos.find((x) => x.cat === 'MT' && x.designacion === 'C33-02');
    if (c && /95\/25/.test(c.formacion) && !Object.keys(c.real || {}).length) { c.formacion = '1x120/25 mm² Al/Cu'; c.obs = 'Sección reemplazada a 120 mm² (la lista rev.3 indica 95)'; }
    st.migr.mt120 = true;
  }
  if (!st.migr.lista0110) {
    // lista de cables actualizada (01/10/2026): cambios en MT y nuevo circuito C33-06
    const MT = { 'C33-01': ['STS 1', 'STS 2', '1x50/25 mm² Al/Cu', 3, 2874, 950, ''], 'C33-02': ['STS 2', 'Sala de celdas MT (celda S3)', '1x120/25 mm² Al/Cu', 3, 474, 150, ''],
      'C33-03': ['STS 4', 'STS 3', '1x50/25 mm² Al/Cu', 3, 1164, 380, ''], 'C33-04': ['STS 3', 'Sala de celdas MT (celda S4)', '1x150/25 mm² Al/Cu', 3, 744, 240, ''],
      'C33-05': ['Sala de celdas MT (celda S1)', '1er piquete LMT aérea', '2x1x120/25 mm² Al/Cu', 6, 648, 100, 'Dos ternas (6 conductores)'],
      'C33-06': ['Fin LMT aérea', 'Celda ET', '2x1x120/25 mm² Al/Cu', 6, 948, 150, 'Dos ternas (6 conductores). Nuevo en la lista del 01/10/2026'] };
    Object.entries(MT).forEach(([d, [de, ha, fo, n, q, L, ob]]) => {
      let c = st.circuitos.find((x) => x.cat === 'MT' && !x.vinculo && x.designacion === d);
      if (!c) { c = { id: 'm6', cat: 'MT', designacion: d, real: {}, zanja: 'no abierta', _o: 1e6 }; st.circuitos.push(c); }
      const tendido = Object.keys(c.real || {}).length > 0;
      if (!tendido) Object.assign(c, { formacion: fo, fases: n });
      Object.assign(c, { desde: de, hasta: ha, cantidad: q, lineal: L, obs: ob });
      const z = (st.zanjas || []).find((x) => x.id === c.zanjaId);
      if (z && !z.largoPlano && st.circuitos.filter((x) => x.zanjaId === z.id).length === 1) z.largo = L;
    });
    st.fuente = 'Circuitos BT y MT: OBEII-EL-LI-101 rev.3 (versión del 01/10/2026). Bobinas BT: planilla de control de ingreso. PAT: un conductor de Cu desnudo por zanja (25 mm² en BT, 95 mm² en MT) con el largo de la zanja.';
    st.migr.lista0110 = true;
    Engine.sincronizarPAT(st);
  }
  if (!st.migr.tx2_12) {
    const a = st.circuitos.find((x) => x.cat === 'BT' && !x.vinculo && x.desde === 'TX2-INV1'), b = st.circuitos.find((x) => x.cat === 'BT' && !x.vinculo && x.desde === 'TX2-INV2');
    if (a && b && a.zanjaId !== b.zanjaId) Engine.unirZanjas(st, [a.zanjaId, b.zanjaId]);
    st.migr.tx2_12 = true;
    Engine.sincronizarPAT(st);
  }
  return st;
}
let saveT = null;
function commit(msg) {
  if (window.READONLY) { Engine.sincronizarPAT(S); R = Engine.calcular(S); render(false); return; }
  Engine.sincronizarPAT(S);
  R = Engine.calcular(S);
  S.compromiso = R.compromiso;
  const nCambios = Sync.sellar(S, NET.modo);
  if (NET.modo === 'cliente' && nCambios) programarSync(400);
  if (nCambios) programarWeb();
  $('#saveState').textContent = 'Guardando…'; $('#saveState').classList.add('dirty');
  clearTimeout(saveT);
  saveT = setTimeout(async () => {
    S.modificado = new Date().toISOString();
    await window.api.save(JSON.stringify(S));
    $('#saveState').textContent = 'Guardado ' + new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    $('#saveState').classList.remove('dirty');
  }, 350);
  render(false);
  if (msg) toast(msg);
}

// ======================= utilidades UI =======================
function toast(msg, opts = {}) {
  const t = document.createElement('div');
  t.className = 'toast' + (opts.err ? ' err' : '');
  t.innerHTML = esc(msg);
  if (opts.action) { const a = document.createElement('a'); a.textContent = opts.action[0]; a.onclick = opts.action[1]; t.appendChild(a); }
  $('#toasts').appendChild(t);
  setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = 0; setTimeout(() => t.remove(), 300); }, opts.ms || 3600);
}
function modal({ title, sub, body, wide, buttons }) {
  return new Promise((resolve) => {
    const m = $('#modal'), box = $('.mbox', m);
    box.className = 'mbox' + (wide ? ' wide' : '');
    box.innerHTML = `<h2>${esc(title)}</h2>${sub ? `<div class="msub">${sub}</div>` : ''}<div class="mbody">${body || ''}</div><div class="mfoot"></div>`;
    const close = (v) => { m.classList.add('hidden'); document.removeEventListener('keydown', key); resolve(v); };
    (buttons || [['Cerrar', 'btn', () => true]]).forEach(([txt, cls, fn]) => {
      const b = document.createElement('button'); b.className = cls; b.textContent = txt;
      b.onclick = () => { const v = fn ? fn(box) : true; if (v !== false) close(v); };
      $('.mfoot', box).appendChild(b);
    });
    const key = (e) => { if (e.key === 'Escape') close(null); };
    document.addEventListener('keydown', key);
    m.classList.remove('hidden');
    m.onclick = (e) => { if (e.target === m) close(null); };
    setTimeout(() => $('input:not([type=checkbox]), select', box)?.focus(), 50);
  });
}
const confirmar = (title, txt, ok = 'Confirmar', cls = 'btn pri') => modal({ title, body: `<p>${txt}</p>`, buttons: [['Cancelar', 'btn', () => null], [ok, cls, () => true]] });
function countUp(root) {
  $$('[data-count]', root).forEach((el) => {
    const to = Number(el.dataset.count), d = Number(el.dataset.dec || 0), t0 = performance.now(), dur = 700;
    const step = (t) => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.firstChild.nodeValue = fmt(to * e, d); if (k < 1) requestAnimationFrame(step); };
    el.firstChild.nodeValue = fmt(0, d); requestAnimationFrame(step);
  });
}
function growBars(root) { requestAnimationFrame(() => requestAnimationFrame(() => $$('[data-w]', root).forEach((el) => { el.style.width = el.dataset.w; }))); }
const pct = (a, b) => (b > 0 ? Math.max(0, Math.min(100, (a / b) * 100)) : 0).toFixed(2) + '%';
const kpi = (label, val, unit = 'm', dec = 0) => `<div class="kpi"><span>${label}</span><b data-count="${val}" data-dec="${dec}">${fmt(val, dec)}<small>${unit}</small></b></div>`;
const estPill = {
  'tendido': 'p-done', 'tendido parcial': 'p-done', 'listo para tender': 'p-ready', 'en espera de zanja': 'p-prov', 'en espera de postes': 'p-prov', 'falta bobina': 'p-bad',
  'sin abrir': 'p-prov', 'no se usa': 'p-prov', 'se usa completa': 'p-done', 'en uso': 'p-ready', 'terminada': 'p-done', 'descarte': 'p-bad', 'remanente útil': 'p-ok', 'no abierta': 'p-prov', 'abierta': 'p-warn', 'cerrada': 'p-done',
};
const pill = (t) => `<span class="pill ${estPill[t] || 'p-prov'}">${esc(t)}</span>`;
const phCls = { ejecutado: 'done', listo: 'ready', provisorio: 'prov', falta: 'bad' };
const phases = (c) => `<span class="ph">${c.fz.map((f) => { const p = c.fasesInfo[f] || {}; return `<span class="${phCls[p.estado] || 'prov'}" title="${f} · ${p.estado || ''} · ${fmt(p.len, 2)} m${p.manual ? ' · bobina elegida a mano' : ''}"><b>${f === 'C' ? '' : f}</b> ${esc(p.bobina || '—')}${p.manual ? '<i class="pin">●</i>' : ''}</span>`; }).join('')}</span>`;
function segBind(sel, cur, fn) { $$(`${sel} button`).forEach((b) => { b.classList.toggle('on', b.dataset.v === String(cur)); b.onclick = () => fn(b.dataset.v); }); }
function searchBind(sel, set) {
  const i = $(sel); if (!i) return; let t;
  i.oninput = () => { clearTimeout(t); t = setTimeout(() => { set(i.value); const pos = i.selectionStart; render(false); const n = $(sel); n.focus(); n.setSelectionRange(pos, pos); }, 200); };
}
function actions(btns) {
  const a = $('#vActions'); a.innerHTML = '';
  if (window.READONLY) btns = btns.filter(([t]) => /Exportar|PDF|Simular|Stock consolidado/.test(t) || (window.__editor && /Actualizar cronograma/.test(t)));
  // las exportaciones (Excel / PDF) van juntas en un solo botón "Exportar"
  const esExp = ([t]) => /^(Exportar|PDF)/.test(t);
  const exp = btns.filter(esExp), resto = btns.filter((b) => !esExp(b));
  const mk = ([txt, cls, fn]) => { const b = document.createElement('button'); b.className = cls; b.innerHTML = txt; b.onclick = fn; return b; };
  if (exp.length >= 2) {
    const w = document.createElement('div'); w.className = 'expdd';
    const b = mk([`${ICO.exportar}<span>Exportar</span>${ICO.chev}`, 'btn', null]);
    const m = document.createElement('div'); m.className = 'expm';
    exp.forEach(([t, , fn]) => { const it = document.createElement('button'); it.textContent = t.replace(/^Exportar /, ''); it.onclick = () => { w.classList.remove('on'); fn(); }; m.appendChild(it); });
    b.onclick = (e) => { e.stopPropagation(); w.classList.toggle('on'); };
    w.appendChild(b); w.appendChild(m); a.appendChild(w);
  } else exp.forEach((x) => a.appendChild(mk(x)));
  resto.forEach((x) => a.appendChild(mk(x)));
}
document.addEventListener('click', () => $$('.expdd.on').forEach((x) => x.classList.remove('on')));

// ======================= navegación =======================
const VIEWS = {
  lmt: ['Línea aérea de media tensión (LMT)', () => 'Parque → ET · conductor desnudo Prysalac: el cable no se corta, el avance se lleva por etapas en cada piquete y vano'],
  fo: ['Fibra óptica', () => 'Tubo PEAD de fibra sobre los cables de MT (zanja cerrada o cargada) y cámaras de inspección · comunicaciones entre CTs y sala de celdas'],
  trec: ['Recepción de materiales de trackers', () => 'Control de lo que llega a obra contra el Bill of Materials de Trina · recibido, dañado y faltante por código'],
  tent: ['Entregas de materiales de trackers', () => 'Remitos y packing lists recibidos: lo declarado, lo contado conforme y lo dañado en cada entrega'],
  trecl: ['Reclamos al fabricante', () => 'Faltantes, dañados y códigos fuera del BOM de cada entrega · reportes para Trina y seguimiento hasta la reposición'],
  tarm: ['Armado de estructuras', () => 'Montaje de la estructura de los trackers: motores, vigas, correas y amortiguadores · próximamente'],
  tpan: ['Instalación de paneles solares', () => 'Montaje de los módulos fotovoltaicos sobre los trackers · próximamente'],
  sala: ['Edificio de operación y mantenimiento', () => 'Sala de celdas de MT, comunicaciones y control · avance de obra civil por etapa, zapata y viga de fundación'],
  maq: ['Horas de máquinas', () => 'Registro mensual con detalle diario por equipo: horómetro, horas trabajadas, paradas, mantenimientos y disponibilidad'],
  maqev: ['Paradas y mantenimientos', () => 'Horas de parada y de mantenimiento de cada equipo, con motivo y observaciones'],
  maqeq: ['Equipos', () => 'Máquinas de la obra: N° de interno, descripción, marca, modelo y horas acumuladas'],
  hincado: ['Avance de hincado', () => 'Trackers e hincas por sector y configuración de la discretización Trina · recepciones verificadas'],
  htrk: ['Distribución de hincas por tracker', () => 'Qué hinca va en cada posición de cada tracker, por color y código · registro de hincado'],
  hrec: ['Recepción de hincas', () => 'Cada entrega se verifica contra el manual de Trina: código, color de punta, largo y perfil'],
  hcat: ['Catálogo y distribución Trina', () => 'Hincas del manual CIV-DW-26050-2402-0B y código por posición para cada configuración de tracker'],
  resumen: ['Resumen', () => `${esc(S.nombre)} · tendido de cables, fibra óptica, fundaciones STS, hincado y cronograma`],
  cables: ['Resumen de tendido', () => 'Stock, requerido, tendido y remanente por sección · zanjas · alertas'],
  avance: ['Avance', () => 'Gráficos de avance: tendido de cables, fibra óptica, puntas, fundaciones STS y cronograma'],
  diario: ['Tendido por fecha', () => 'Elegí un día del calendario para ver qué se tendió: metros, secciones, circuitos e inversores'],
  partes: ['Partes de campo', () => 'Lo que cargan los capataces desde el celular: revisá, corregí si hace falta y aprobá para registrarlo'],
  plano: ['Plano de obra', () => 'Sectores, trackers, inversores, STS y zanjas de BT y MT con su estado · tocá un elemento para ver su información'],
  crono: ['Resumen del cronograma', () => `${esc((S.cronoMeta || {}).nombre || 'Cronograma de obra')} · avance real vs. esperado al día de hoy`],
  gantt: ['Diagrama de Gantt', () => 'Actividades del cronograma en el tiempo · tocá una para cambiar fechas o avance'],
  fundaciones: ['Fundaciones STS', () => `Avance de las bases de ${STSL.length === 1 ? 'la STS' : `las ${STSL.length} STS`} por etapa: iniciá y finalizá cada etapa con su fecha`],
  puntas: ['Puntas de cable', () => 'Terminales colocados en cada extremo: lado inversor y lado STS en BT; entre STS, sala de celdas, piquete y ET en MT'],
  propuesta: ['Propuesta de tendido', () => 'Lotes de zanjas por zona, del tamaño de una bobina, en el orden sugerido para abrir'],
  zanjas: ['Zanjas', () => 'Estado de cada zanja (BT y MT). Se tiende de a un circuito; la PAT se carga por zanja y al cerrar se confirma (si no se cargó, se pide ahí). Las compartidas admiten cierre parcial'],
  'BT-plan': ['Plan de corte', () => 'Cables de aluminio inversor → STS · los cortes listos quedan fijos en su bobina'],
  'BT-circ': ['Circuitos', () => 'Tendidos inversor → STS: zanja y registro de lo ejecutado'],
  'MT-plan': ['Plan de corte', () => 'Cables de media tensión entre STS, sala de celdas y LMT · los cortes listos quedan fijos en su bobina'],
  'MT-circ': ['Circuitos', () => (ED.blank ? 'Circuitos de media tensión: zanja y registro de lo ejecutado' : 'STS 4 → 3 → sala de celdas · STS 1 → 2 → sala de celdas · sala de celdas → LMT · fin LMT → ET')],
  'PAT-plan': ['Plan de corte', () => `Cobre desnudo: ${(S.parque && S.parque.patBT) || 25} mm² en zanjas de BT, ${(S.parque && S.parque.patMT) || 95} mm² en zanjas de MT · los cortes listos quedan fijos en su bobina`],
  'PAT-circ': ['Tendidos', () => 'Un conductor de Cu desnudo por zanja (compartida o no), con el largo de la zanja'],
  'LA-plan': ['Plan de corte', () => 'Línea aérea de 33 kV parque → ET · conductor desnudo Prysalac (Al/Ac) · los cortes de los tramos listos quedan fijos en su bobina'],
  'LA-circ': ['Tramos', () => 'Tramos de la línea aérea (entre retenciones): sin zanja; se habilitan para cortar cuando los postes están listos'],
  bobinas: ['Bobinas', () => 'Ingreso de bobinas de BT, MT, PAT y línea aérea, saldo actual y remanente previsto'],
  ajustes: ['Ajustes', () => 'Parámetros del cálculo y datos del proyecto'],
};
function pillUpd(scroll) {
  const pl = $('#navPill'), b = $(`#nav button[data-view="${navKey}"]`);
  const vis = b && (!b.closest('.sect') || b.closest('.sect').classList.contains('open'));
  if (!b || !vis || view === 'ajustes') { pl.style.opacity = 0; return; }
  pl.style.setProperty('--pc', (getComputedStyle(b).getPropertyValue('--mc') || '').trim() || 'var(--acc)');
  pl.style.opacity = 1; pl.style.transform = `translateY(${b.offsetTop}px)`; pl.style.left = b.offsetLeft + 'px'; pl.style.width = b.offsetWidth + 'px'; pl.style.height = b.offsetHeight + 'px'; pl.style.right = 'auto';
  if (scroll && window.innerWidth > 860) b.scrollIntoView({ block: 'nearest' });
}
function abrirSect(x, open) {
  x.classList.toggle('open', open);
  try { const st = JSON.parse(localStorage.getItem('navSect') || '{}'); st[x.dataset.sect] = open; localStorage.setItem('navSect', JSON.stringify(st)); } catch (_) { /* sin storage */ }
  pillUpd(); setTimeout(() => pillUpd(), 320);
}
// grupos BT / MT / PAT del menú: se abren y cierran
const grpAbiertos = () => { try { return JSON.parse(localStorage.getItem('navGrp') || '[]'); } catch (_) { return []; } };
function grpToggle(cat, abrir) {
  const g = $(`#nav .grp[data-cat="${cat}"]`); if (!g) return;
  const on = abrir == null ? !g.classList.contains('open') : abrir;
  g.classList.toggle('open', on);
  try { const a = new Set(grpAbiertos()); on ? a.add(cat) : a.delete(cat); localStorage.setItem('navGrp', JSON.stringify([...a])); } catch (_) { /* nada */ }
}
setTimeout(() => {
  const ab = grpAbiertos();
  $$('#nav .grp[data-cat]').forEach((g) => { g.classList.toggle('open', ab.includes(g.dataset.cat)); const h = $('.gh', g); if (h) h.onclick = () => grpToggle(g.dataset.cat); });
}, 0);
let navKey = 'resumen';
const HINC_V = ['hincado', 'hplano', 'htrk', 'hrec', 'hcat'];
function go(v) {
  // al entrar al menú Hincado desde otra sección, cartel de precarga
  if (HINC_V.includes(v) && !HINC_V.includes(navKey)) setTimeout(hincAvisoEntrada, 450);
  const gc = /^(BT|MT|PAT|LA)-/.exec(v); if (gc) { const g = $(`#nav .grp[data-cat="${gc[1]}"]`); if (g && !g.classList.contains('open')) grpToggle(gc[1], true); }
  if (v === 'hplano') { ui.pl = ui.pl || { capas: new Set(PL_CAPAS.map((c) => c[0])), color: 'disc', zcol: 'estado', vb: null, sel: null }; ui.pl.color = ui.pl.color === 'hinc' ? 'hinc' : 'disc'; view = 'plano'; navKey = 'hplano'; ui.sel.clear();
    $$('#nav button[data-view]').forEach((b) => b.classList.toggle('on', b.dataset.view === 'hplano')); $$('.sfBtn').forEach((b) => b.classList.remove('on'));
    const sec = $('#nav [data-sect="trk"]'); if (sec && !sec.classList.contains('open')) abrirSect(sec, true); $$('#nav .sect').forEach((x) => x.classList.toggle('act', x === sec)); pillUpd(true); render(true); if (typeof movSync === 'function') movSync('hplano'); return; }
  view = v; ui.sel.clear(); navKey = MENU_ALIAS[v] || v;
  $$('.sfBtn').forEach((b) => b.classList.toggle('on', b.dataset.view === v));
  $$('#nav button[data-view]').forEach((b) => b.classList.toggle('on', b.dataset.view === navKey));
  const bt = $(`#nav button[data-view="${navKey}"]`), sec = bt && bt.closest('.sect');
  if (sec && !sec.classList.contains('open')) abrirSect(sec, true);
  $$('#nav .sect').forEach((x) => x.classList.toggle('act', x === sec));
  pillUpd(true);
  render(true);
  if (typeof movSync === 'function') movSync(v);
}
function render(anim) {
  setTimeout(margenAlDia, 0);
  if (S && S.parque) aplicarParque(S);
  const [t, sub] = VIEWS[view];
  const vc = view.split('-')[0];
  setTimeout(badgePartes, 0);
  $('#vMod').textContent = ['ajustes', 'resumen', 'avance', 'plano', 'partes'].includes(view) ? 'General' : view === 'puntas' ? 'Puntas de cable' : ['trec', 'tent', 'trecl', 'tarm', 'tpan'].includes(view) ? 'Trackers' : view === 'fundaciones' ? 'Fundaciones STS' : view === 'fo' ? 'Fibra óptica' : view === 'lmt' ? 'Línea aérea MT' : view === 'sala' ? 'Edificio O&M' : ['hincado', 'htrk', 'hrec', 'hcat'].includes(view) ? 'Trackers · Hincado' : MAQ_V.includes(view) ? 'Maquinaria de obra' : view === 'crono' || view === 'gantt' ? 'Cronograma de obra' : 'Tendido y aprovechamiento de cables';
  $('#vTitle').innerHTML = (CATN[vc] && view.includes('-') ? `<span class="cchip c-${vc}">${CATL[vc]}</span>` : '') + esc(t); $('#vSub').innerHTML = sub();
  $('#projName').textContent = S.nombre;
  const el = $('#view'), sc = el.scrollTop;
  // posición de las listas con scroll propio, para no perder el lugar al redibujar
  const inner = $$('.tblwrap', el).map((x) => [x.scrollTop, x.scrollLeft]);
  const det = $$('details', el).map((d) => d.open);
  el.classList.remove('enter');
  const [cat, kind] = view.split('-');
  if (kind === 'plan') vPlan(el, cat);
  else if (kind === 'circ') vCircuitos(el, cat);
  else ({ resumen: vResumen, cables: vCables, avance: vAvance, diario: vDiario, puntas: vPuntas, fundaciones: vFund, crono: vCronoRes, gantt: vGantt, plano: vPlano, partes: vPartes, hincado: vHincado, htrk: vHTrk, hrec: vHRec, hcat: vHCat, fo: vFibra, lmt: vLMT, sala: vSala, trec: vTrkRec, tent: vTrkEnt, trecl: vTrkRecl, tarm: vPronto, tpan: vPronto, maq: vMaq, maqev: vMaqEv, maqeq: vMaqEq, propuesta: vPropuesta, zanjas: vZanjas, bobinas: vBobinas, ajustes: vAjustes })[view](el);
  if (anim) { void el.offsetWidth; el.classList.add('enter'); el.scrollTop = 0; countUp(el); }
  else {
    el.scrollTop = sc;
    $$('.tblwrap', el).forEach((x, i) => { if (inner[i]) { x.scrollTop = inner[i][0]; x.scrollLeft = inner[i][1]; } });
    $$('details', el).forEach((d, i) => { if (det[i]) d.open = true; });
  }
  if (ui.flash && ui.flash.length) {
    const f = new Set(ui.flash); ui.flash = null;
    $$('[data-id]', el).forEach((r) => { if (f.has(r.dataset.id)) { r.classList.add('flash'); } });
  }
  growBars(el);
}
