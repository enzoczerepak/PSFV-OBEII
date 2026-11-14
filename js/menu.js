/* PSFV-OBE II · Menú lateral (se arma desde esta definición), encabezado y ayuda. */
// ======================= MENÚ =======================
// [vista, texto, ícono] o una sección plegable { s: clave, t: título, ico, items: [...], grupos: true }
const MENU = [
  ['resumen', 'Inicio', 'inicio'], ['campo', 'Carga rápida', 'llave'], ['pdia', 'Parte diario', 'dia'], ['avance', 'Avance de obra', 'avance'], ['plano', 'Plano de obra', 'plano'], ['partes', 'Partes de campo', 'partes'],
  ['crono', 'Cronograma', 'crono'], ['hist', 'Historial de cambios', 'libro'],
  { s: 'cables', t: 'Tendido de cables', ico: 'cable', grupos: true, items: [['cables', 'Resumen de tendido', 'barras'], ['diario', 'Tendido por fecha', 'dia'], ['zanjas', 'Zanjas', 'zanja'], ['bobinas', 'Bobinas', 'bobina'], ['propuesta', 'Propuesta de tendido', 'lista'], ['puntas', 'Puntas de cable', 'punta']] },
  ['fo', 'Fibra óptica', 'fibra'], ['lmt', 'Línea aérea MT (LMT)', 'poste'], ['fundaciones', 'Fundaciones STS', 'sts'], ['sala', 'Edificio O&M (sala de celdas)', 'edificio'],
  { s: 'trk', t: 'Trackers', ico: 'trackers', items: ['Materiales', ['trec', 'Recepción de materiales', 'lista'], ['tent', 'Entregas y remitos', 'camion'], ['trecl', 'Reclamos al fabricante', 'libro'], ['tstk', 'Stock en obra', 'barras'],
    'Hincado', ['hincado', 'Avance de hincado', 'barras'], ['htrk', 'Distribución por tracker', 'trackers'], ['hcat', 'Catálogo y distribución', 'libro'],
    'Montaje', ['tarm', 'Armado de estructuras', 'llave'], ['tpan', 'Instalación de paneles', 'sol']] },
  { s: 'maqs', t: 'Maquinaria de obra', ico: 'maquina', items: [['maq', 'Horas mensuales', 'dia'], ['maqev', 'Paradas y mantenimientos', 'llave'], ['maqeq', 'Equipos', 'camion']] },
];
// en el visor web (solo lectura) no van las pantallas que existen solo para cargar datos
const SOLO_PC = ['campo', 'partes'];
if (window.READONLY) MENU.splice(0, MENU.length, ...MENU.filter((m) => !(Array.isArray(m) && SOLO_PC.includes(m[0]))));
const MOV_SIN = window.READONLY ? SOLO_PC : [];
// vistas que no tienen botón propio: se marca la del menú que las contiene
const MENU_ALIAS = { gantt: 'crono' };
// color de cada frente de obra: ícono, recuadro de la sección y marca del apartado activo
const MCOL = { cables: '#2fc4b2', fo: '#5ab8ff', lmt: '#8b9dff', fundaciones: '#f2b33d', sala: '#b294ff', trk: '#3fb27f', maqs: '#ff8f57' };
const GRUPOS = [['BT', 'BT · 0,8 kV', [['plan', 'Plan de corte', 'corte'], ['circ', 'Circuitos', 'circuito']]], ['MT', 'MT · 33 kV', [['plan', 'Plan de corte', 'corte'], ['circ', 'Circuitos', 'circuito']]], ['PAT', 'PAT · Cu desnudo', [['plan', 'Plan de corte', 'corte'], ['circ', 'Tendidos', 'circuito']]]];
function menuHTML() {
  const btn = ([v, t, i, tg], tag) => `<button data-view="${v}"${MCOL[v] ? ` style="--mc:${MCOL[v]}"` : ''}>${ICO[i] || ''}<span>${t}</span>${tag ? `<em class="tg">${tag}</em>` : tg ? `<em class="tg pronto">${tg}</em>` : ''}</button>`;
  const grupos = `<div class="tgrp"><div class="tgh">Tendidos BT, MT y PAT</div>${GRUPOS.map(([c, n, its]) => `<div class="grp g-${c}" data-cat="${c}"><button class="gh" type="button"><i></i><span class="ghn">${n}</span>${ICO.chev}</button>${its.map(([k, t, i]) => btn([c + '-' + k, t, i], c)).join('')}</div>`).join('')}</div>`;
  let iFr = MENU.findIndex((m) => !Array.isArray(m) || MCOL[m[0]]);
  return '<div class="ng">General</div>' + MENU.map((m, i) => (i === iFr ? '<div class="ng">Frentes de obra</div>' : '') + (Array.isArray(m) ? btn(m)
    : `<div class="sect" data-sect="${m.s}" style="--mc:${MCOL[m.s] || 'var(--acc)'}"><button class="secth" type="button">${ICO[m.ico]}<span>${m.t}</span>${ICO.chev}</button><div class="sectb"><div class="secti">${m.items.map((x) => (typeof x === 'string' ? `<div class="sgh">${x}</div>` : btn(x))).join('')}${m.grupos ? grupos : ''}</div></div></div>`)).join('') + '<span id="navPill"></span>';
}
(function armarMenu() {
  const nav = document.getElementById('nav'); if (!nav) return;
  nav.innerHTML = menuHTML();
  const lg = document.querySelector('.brand .logo'); if (lg) lg.outerHTML = LOGO;
  const aj = document.querySelector('.sfBtn[data-view="ajustes"]'); if (aj) aj.innerHTML = `${ICO.ajustes}<span>Ajustes</span>`;
  // encabezado: reloj y calculadora arriba, acciones debajo (sin superponerse)
  const top = document.getElementById('top'), topR = document.getElementById('topR'), act = document.getElementById('vActions');
  if (top && topR && act) {
    const col = document.createElement('div'); col.className = 'topcol';
    top.appendChild(col); col.appendChild(topR); col.appendChild(act);
    const ay = document.createElement('button'); ay.id = 'ayudaBtn'; ay.title = 'Mostrar u ocultar las explicaciones de cada pantalla'; ay.innerHTML = ICO.ayuda;
    topR.insertBefore(ay, topR.firstChild);
    let on = false; try { on = localStorage.getItem('ayuda') === '1'; } catch (_) { /* sin storage */ }
    document.body.classList.toggle('ayuda', on); ay.classList.toggle('on', on);
    ay.onclick = () => { const v = !document.body.classList.contains('ayuda'); document.body.classList.toggle('ayuda', v); ay.classList.toggle('on', v); try { localStorage.setItem('ayuda', v ? '1' : '0'); } catch (_) { /* nada */ } };
  }
})();

/* ---------- Navegación en celular ----------
   Barra superior con el apartado actual, barra inferior con accesos rápidos y un menú a pantalla completa,
   agrupado por frente de obra y con buscador. Se arma con las mismas vistas del menú lateral. */
const MOV_ACCESOS = [['resumen', 'Inicio', 'inicio'], window.READONLY ? ['avance', 'Avance', 'avance'] : ['campo', 'Cargar', 'llave'], ['BT-plan', 'Plan de corte', 'corte'], ['zanjas', 'Zanjas', 'zanja']];
function movGrupos() {
  const plano = (items) => items.filter(Array.isArray).map(([v, t, i, tg]) => ({ v, t, i, tg }));
  const g = [{ t: 'General', items: plano(MENU.filter((m) => Array.isArray(m) && !MCOL[m[0]])) }];
  MENU.forEach((m) => {
    if (Array.isArray(m)) return;
    g.push({ t: m.t, ico: m.ico, items: plano(m.items) });
    if (m.grupos) g.push({ t: 'Plan de corte y circuitos', ico: 'corte', cats: true, items: GRUPOS.flatMap(([c, n, its]) => its.map(([k, t, i]) => ({ v: c + '-' + k, t, i, cat: c, cn: n }))) });
  });
  g.splice(3, 0, { t: 'Otros frentes', items: plano(MENU.filter((m) => Array.isArray(m) && MCOL[m[0]])) });
  return g;
}
const movExiste = (v) => !!document.querySelector(`#nav button[data-view="${v}"]`) && !(window.READONLY && v === 'ajustes');
function movTitulo(v) {
  for (const g of movGrupos()) { const it = g.items.find((x) => x.v === v); if (it) return { g: g.t, t: it.cat ? `${it.cat} · ${it.t}` : it.t, cat: it.cat }; }
  return { g: '', t: (typeof VIEWS !== 'undefined' && VIEWS[v] && VIEWS[v][0]) || '' };
}
function movSync(v) {
  const bar = document.getElementById('mbar'); if (!bar) return;
  const T = movTitulo(v);
  bar.querySelector('.mbt small').textContent = T.g || 'PSFV-OBE II';
  bar.querySelector('.mbt b').innerHTML = (T.cat ? `<i class="c-${T.cat}">${T.cat}</i>` : '') + String(T.t).replace(/^(BT|MT|PAT) · /, '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
  document.querySelectorAll('#mtabs button[data-v]').forEach((b) => b.classList.toggle('on', b.dataset.v === v || (b.dataset.v === 'BT-plan' && /-(plan|circ)$/.test(v))));
  document.querySelectorAll('#msheet [data-v]').forEach((b) => b.classList.toggle('on', b.dataset.v === v));
}
function movAbrir(on) {
  const sh = document.getElementById('msheet'); if (!sh) return;
  sh.classList.toggle('open', on); document.body.classList.toggle('msheet-on', on);
  if (on) { const q = sh.querySelector('#mq'); q.value = ''; movFiltrar(''); const a = sh.querySelector('[data-v].on'); if (a) a.scrollIntoView({ block: 'center' }); }
}
function movFiltrar(q) {
  const n = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const qq = n(q.trim());
  document.querySelectorAll('#msheet .mvg').forEach((g) => {
    let vis = 0;
    g.querySelectorAll('[data-v]').forEach((b) => { const ok = !qq || n(b.dataset.s).includes(qq); b.style.display = ok ? '' : 'none'; if (ok) vis++; });
    g.style.display = vis ? '' : 'none';
  });
}
(function armarMovil() {
  if (!document.getElementById('nav')) return;
  const ico = (i) => (typeof ICO !== 'undefined' && ICO[i]) || '';
  const bar = document.createElement('div'); bar.id = 'mbar';
  bar.innerHTML = `<button class="mlogo" data-v="resumen" aria-label="Inicio">${typeof LOGO !== 'undefined' ? LOGO : ''}</button><div class="mbt"><small></small><b></b></div><button class="mmenu" aria-label="Menú"><svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg><span>Menú</span></button>`;
  const tabs = document.createElement('nav'); tabs.id = 'mtabs';
  tabs.innerHTML = MOV_ACCESOS.filter(([v]) => movExiste(v)).map(([v, t, i]) => `<button data-v="${v}">${ico(i)}<span>${t}</span></button>`).join('') + `<button class="mmenu">${'<svg viewBox="0 0 24 24"><rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/></svg>'}<span>Todo</span></button>`;
  const sh = document.createElement('div'); sh.id = 'msheet';
  const tile = (it) => `<button data-v="${it.v}" data-s="${(it.t + ' ' + (it.cn || '') + ' ' + (it.cat || '')).replace(/"/g, '')}" class="${it.cat ? 'mc-' + it.cat : ''}">${ico(it.i)}<span>${it.t}</span>${it.tg ? '<em>pronto</em>' : ''}</button>`;
  sh.innerHTML = `<div class="msh"><div class="mshh"><b>¿Qué querés ver?</b><button class="mcerrar" aria-label="Cerrar">✕</button></div>
    <input type="search" id="mq" placeholder="Buscar apartado: zanjas, bobinas, PAT, hincado…" autocomplete="off">
    <div class="msb">${movGrupos().map((g) => { const its = g.items.filter((x) => movExiste(x.v)); if (!its.length) return '';
      if (g.cats) { const cs = [...new Set(its.map((x) => x.cat))]; return `<div class="mvg"><h4>${g.t}</h4>${cs.map((c) => `<div class="mcat"><span class="mct c-${c}">${c}</span>${its.filter((x) => x.cat === c).map(tile).join('')}</div>`).join('')}</div>`; }
      return `<div class="mvg"><h4>${g.t}</h4><div class="mtiles">${its.map(tile).join('')}</div></div>`; }).join('')}</div></div>`;
  document.body.appendChild(bar); document.body.appendChild(tabs); document.body.appendChild(sh);
  const ir = (v) => { movAbrir(false); if (typeof go === 'function') go(v); window.scrollTo(0, 0); };
  document.addEventListener('click', (e) => {
    const t = e.target.closest('#mbar [data-v], #mtabs [data-v], #msheet [data-v]'); if (t) { e.preventDefault(); ir(t.dataset.v); return; }
    if (e.target.closest('#mbar .mmenu, #mtabs .mmenu')) { movAbrir(!document.getElementById('msheet').classList.contains('open')); return; }
    if (e.target.closest('#msheet .mcerrar') || e.target.id === 'msheet') movAbrir(false);
  });
  sh.querySelector('#mq').addEventListener('input', (e) => movFiltrar(e.target.value));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && sh.classList.contains('open')) movAbrir(false); });
})();
