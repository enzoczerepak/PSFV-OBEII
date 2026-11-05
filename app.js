/* Plan de Cables – interfaz (BT · MT · PAT) */
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n, d = 0) => (n == null || isNaN(n) ? '–' : Number(n).toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d }));
  const today = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  const uid = (p) => p + Math.random().toString(36).slice(2, 9);
  const CATS = Engine.CATS;
  const CATN = { BT: 'BT 0,8 kV', MT: 'MT 33 kV', PAT: 'PAT Cu desnudo' };
  const CATL = { BT: 'BT · 0,8 kV', MT: 'MT · 33 kV', PAT: 'PAT · Cu desnudo' };
  const ctag = (c) => `<i class="cdot c-${c}"></i>`;

  let S = null, R = null, view = 'resumen', seedCache = null;
  let NET = { modo: 'local' }, netStatus = { ok: null, msg: '' }, syncBusy = false, syncTimer = null;
  let WEB = null, webTimer = null;
  const ui = { sec: {}, est: {}, q: {}, sts: {}, cest: {}, zf: {}, sel: new Set(), bobCat: 'all', zTipo: 'all', zEst: 'all', zQ: '' };

  // ======================= estado =======================
  function normalizar(st) {
    st.params = Object.assign({ margen: 0, minUtil: 30, cola: 0 }, st.params || {});
    st.fundaciones = st.fundaciones || {};
    st.cronoTareas = st.cronoTareas || [];
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
    'tendido': 'p-done', 'tendido parcial': 'p-done', 'listo para tender': 'p-ready', 'en espera de zanja': 'p-prov', 'falta bobina': 'p-bad',
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
    if (window.READONLY) btns = btns.filter(([t]) => /Exportar|PDF/.test(t) || (window.__editor && /Actualizar cronograma/.test(t)));
    btns.forEach(([txt, cls, fn]) => { const b = document.createElement('button'); b.className = cls; b.innerHTML = txt; b.onclick = fn; a.appendChild(b); });
  }

  // ======================= navegación =======================
  const VIEWS = {
    resumen: ['Resumen', () => `${esc(S.nombre)} · tendido, puntas de cable y fundaciones STS`],
    cables: ['Resumen de tendido', () => 'Stock, requerido, tendido y remanente por sección · zanjas · alertas'],
    avance: ['Avance', () => 'Tendido de cables, puntas y fundaciones STS: gráficos de avance'],
    diario: ['Tendido por fecha', () => 'Elegí un día del calendario para ver qué se tendió: metros, secciones, circuitos e inversores'],
    plano: ['Plano de obra', () => 'Sectores, trackers, inversores, STS y zanjas de BT y MT con su estado · tocá un elemento para ver su información'],
    crono: ['Resumen del cronograma', () => `${esc((S.cronoMeta || {}).nombre || 'Cronograma de obra')} · avance real vs. esperado al día de hoy`],
    gantt: ['Diagrama de Gantt', () => 'Actividades del cronograma en el tiempo · tocá una para cambiar fechas o avance'],
    fundaciones: ['Fundaciones STS', () => 'Avance de las bases de los 4 STS por etapa: iniciá y finalizá cada etapa con su fecha'],
    puntas: ['Puntas de cable', () => 'Terminales colocados en cada extremo: lado inversor y lado STS en BT; entre STS, sala de celdas, piquete y ET en MT'],
    propuesta: ['Propuesta de tendido', () => 'Lotes de zanjas por zona, del tamaño de una bobina, en el orden sugerido para abrir'],
    zanjas: ['Zanjas', () => 'Estado de cada zanja (BT y MT) y metros realizados. Se tiende de a un circuito; la zanja se cierra con todos sus circuitos tendidos y ahí se registra la PAT'],
    'BT-plan': ['Plan de corte', () => 'Cables de aluminio inversor → STS · los cortes listos quedan fijos en su bobina'],
    'BT-circ': ['Circuitos', () => 'Tendidos inversor → STS: zanja y registro de lo ejecutado'],
    'MT-plan': ['Plan de corte', () => 'Cables de media tensión entre STS, sala de celdas y LMT · los cortes listos quedan fijos en su bobina'],
    'MT-circ': ['Circuitos', () => 'STS 4 → 3 → sala de celdas · STS 1 → 2 → sala de celdas · sala de celdas → LMT · fin LMT → ET'],
    'PAT-plan': ['Plan de corte', () => 'Cobre desnudo: 25 mm² en zanjas de BT, 95 mm² en zanjas de MT · los cortes listos quedan fijos en su bobina'],
    'PAT-circ': ['Tendidos', () => 'Un conductor de Cu desnudo por zanja (compartida o no), con el largo de la zanja'],
    bobinas: ['Bobinas', () => 'Ingreso de bobinas de BT, MT y PAT, saldo actual y remanente previsto'],
    ajustes: ['Ajustes', () => 'Parámetros del cálculo y datos del proyecto'],
  };
  function pillUpd(scroll) {
    const pl = $('#navPill'), b = $(`#nav button[data-view="${view}"]`);
    const vis = b && (!b.closest('.sect') || b.closest('.sect').classList.contains('open'));
    if (!b || !vis || view === 'ajustes') { pl.style.opacity = 0; return; }
    pl.style.opacity = 1; pl.style.transform = `translateY(${b.offsetTop}px)`; pl.style.left = b.offsetLeft + 'px'; pl.style.width = b.offsetWidth + 'px'; pl.style.height = b.offsetHeight + 'px'; pl.style.right = 'auto';
    if (scroll && window.innerWidth > 860) b.scrollIntoView({ block: 'nearest' });
  }
  function abrirSect(x, open) {
    x.classList.toggle('open', open);
    try { const st = JSON.parse(localStorage.getItem('navSect') || '{}'); st[x.dataset.sect] = open; localStorage.setItem('navSect', JSON.stringify(st)); } catch (_) { /* sin storage */ }
    pillUpd(); setTimeout(() => pillUpd(), 320);
  }
  function go(v) {
    view = v; ui.sel.clear();
    $$('.sfBtn').forEach((b) => b.classList.toggle('on', b.dataset.view === v)); 
    $$('#nav button[data-view]').forEach((b) => b.classList.toggle('on', b.dataset.view === v));
    const bt = $(`#nav button[data-view="${v}"]`), sec = bt && bt.closest('.sect');
    if (sec && !sec.classList.contains('open')) abrirSect(sec, true);
    $$('#nav .sect').forEach((x) => x.classList.toggle('act', x === sec));
    pillUpd(true);
    render(true);
  }
  function render(anim) {
    const [t, sub] = VIEWS[view];
    const vc = view.split('-')[0];
    $('#vMod').textContent = ['ajustes', 'resumen', 'avance', 'plano'].includes(view) ? 'General' : view === 'puntas' ? 'Puntas de cable' : view === 'fundaciones' ? 'Fundaciones STS' : view === 'crono' || view === 'gantt' ? 'Cronograma de obra' : 'Tendido y aprovechamiento de cables';
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
    else ({ resumen: vResumen, cables: vCables, avance: vAvance, diario: vDiario, puntas: vPuntas, fundaciones: vFund, crono: vCronoRes, gantt: vGantt, plano: vPlano, propuesta: vPropuesta, zanjas: vZanjas, bobinas: vBobinas, ajustes: vAjustes })[view](el);
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

  // ======================= RESUMEN =======================
  function zanjaCard(cat) {
    const z = R.zanjas[cat];
    return `<div class="zrow"><div class="zl"><b>${cat === 'BT' ? 'Baja tensión' : 'Media tensión'}</b><span class="muted">${z.nAbiertas + z.nCerradas}/${z.n} zanjas · ${z.nCerradas} cerradas</span></div>
      <div class="bar"><div class="c-done" data-w="${pct(z.cerrada, z.total)}"></div><div class="c-acc" data-w="${pct(z.abierta, z.total)}"></div></div>
      <div class="zn"><b>${fmt(z.realizada)}</b> / ${fmt(z.total)} m</div></div>`;
  }
  function patCard() {
    return R.resumen.filter((r) => r.cat === 'PAT').map((r) => `<div class="zrow"><div class="zl"><b>PAT ${r.seccion} mm²</b><span class="muted">${r.seccion === 25 ? 'zanjas BT' : 'zanjas MT'}</span></div>
      <div class="bar"><div class="c-done" data-w="${pct(r.tendido, r.requerido)}"></div></div><div class="zn"><b>${fmt(r.tendido)}</b> / ${fmt(r.requerido)} m</div></div>`).join('');
  }
  function vResumen(el) {
    actions([['Exportar Excel', 'btn', exportExcel]]);
    el.innerHTML = modulosHTML();
    $$('[data-go]', el).forEach((c) => { c.onclick = () => go(c.dataset.go); });
  }
  function vCables(el) {
    actions([['Exportar Excel', 'btn', exportExcel], ['Ir a zanjas', 'btn pri', () => go('zanjas')]]);
    const cnt = (cat) => { const cs = R.circuitos.filter((c) => c.cat === cat); return [cs.filter((c) => c.completo).length, cs.length, cs.filter((c) => c.estado === 'listo para tender').length]; };
    let h = `<div class="grid g3 stagger" style="margin-bottom:16px">
      <div class="card"><h3>Tendido</h3><table class="kt"><tr><th></th><th>Tendidos</th><th>Listos</th></tr>
        ${['BT', 'MT', 'PAT'].map((c) => { const [a, b, l] = cnt(c); return `<tr><td>${ctag(c)}<b>${CATN[c]}</b></td><td><span class="mini ok"><div data-w="${pct(a, b)}" style="width:0"></div></span> ${a}/${b}</td><td>${l}</td></tr>`; }).join('')}</table></div>
      <div class="card"><h3>Zanja realizada</h3>${zanjaCard('BT')}${zanjaCard('MT')}<div class="legend" style="margin-top:6px"><span><i class="c-done"></i>Cerrada</span><span><i class="c-acc"></i>Abierta</span></div></div>
      <div class="card"><h3>Alertas</h3><div class="alerts">${R.alerts.length ? R.alerts.map((a) => `<div class="alert ${a.tipo}">${esc(a.txt)}</div>`).join('') : '<div class="alert ok">Sin observaciones</div>'}</div></div>
    </div><div class="grid g3 stagger" style="margin-bottom:16px"><div class="card"><h3>PAT tendida</h3>${patCard()}</div>`;
    R.resumen.forEach((r) => {
      const tot = Math.max(r.stock, r.requerido);
      const st = !r.bobinas ? '<span class="pill p-warn">sin bobinas</span>' : r.faltante > 0 ? pill('falta cable').replace('p-prov', 'p-bad') : '<span class="pill p-ok">stock suficiente</span>';
      h += `<div class="card sc" data-go="${r.cat}-plan"><div class="hero"><div class="sec">${r.seccion}<small> mm² · ${ctag(r.cat)}${CATN[r.cat]}</small></div><span style="margin-left:auto">${st}</span></div><div class="muted" style="margin:-8px 0 12px">${r.bobinas} bobinas · ${fmt(r.stock)} m en stock</div>
        <div class="kpis k3">${kpi('Requerido', r.requerido)}${kpi('Tendido', r.tendido)}${kpi('Listo p/ cortar', r.listo)}${kpi('Balance stock', r.balance)}${kpi('Remanente útil previsto', r.remUtil)}${kpi('Descarte previsto', r.descarte)}</div>
        <div class="muted" style="margin-top:6px">Bobinas: ${r.realSinAbrir} sin abrir · ${r.realEnUso} en uso · ${r.realTerminadas} terminadas${r.noSeUsa ? ` · ${r.noSeUsa} que el plan no usa` : ''}</div>
        ${r.tendidoTeo ? `<div class="muted" style="margin-top:8px">Tirado vs lista: <span class="dv ${r.desvio > 0.005 ? 'pos' : r.desvio < -0.005 ? 'neg' : ''}">${r.desvio > 0 ? '+' : ''}${fmt(r.desvio, 1)} m (${r.desvio > 0 ? '+' : ''}${fmt(r.desvioPct * 100, 1)} %)</span> sobre ${fmt(r.tendidoTeo)} m tendidos</div>` : ''}
        <div class="bar"><div class="c-done" data-w="${pct(r.tendido, tot)}"></div><div class="c-ready" data-w="${pct(r.listo, tot)}"></div><div class="c-prov" data-w="${pct(r.provisorio, tot)}"></div><div class="c-bad" data-w="${pct(r.faltante, tot)}"></div><div class="c-rem" data-w="${pct(Math.max(0, r.balance), tot)}"></div></div></div>`;
    });
    el.innerHTML = h + `</div><div class="legend"><span><i class="c-done"></i>Tendido</span><span><i class="c-ready"></i>Listo p/ cortar</span><span><i class="c-prov"></i>Provisorio</span><span><i class="c-bad"></i>Faltante</span><span><i class="c-rem"></i>Sobrante</span></div>`;
    $$('[data-go]', el).forEach((c) => { c.onclick = () => go(c.dataset.go); });
  }

  // ======================= AVANCE =======================
  const SERIE = { BT: '#00939a', MT: '#c97b12', PAT: '#6a5acd' };
  const ST = { tend: '#00797f', listo: '#7fc6c9', pend: '#dfe5ec' };
  function vAvance(el) {
    actions([['Exportar Excel', 'btn', exportExcel], ['Exportar PDF', 'btn pri', printAvance]]);
    const sumCat = (cat) => { const rs = R.resumen.filter((r) => r.cat === cat); const f = (k) => rs.reduce((a, r) => a + r[k], 0); return { req: f('requerido'), tend: f('tendido'), listo: f('listo') }; };
    const nC = (cat) => { const cs = R.circuitos.filter((c) => c.cat === cat); return [cs.filter((c) => c.completo).length, cs.length]; };
    let h = `<h2 class="sech">Tendido y aprovechamiento de cables</h2><div class="grid g3 stagger" style="margin-bottom:16px">`;
    ['BT', 'MT', 'PAT'].forEach((cat) => {
      const t = sumCat(cat), [a, b] = nC(cat), p = t.req ? t.tend / t.req : 0;
      h += `<div class="card tile"><div>${Charts.ring(p, SERIE[cat], 'tendido')}</div><div><h3 style="margin-bottom:6px">${ctag(cat)}${CATN[cat]}</h3>
        <div class="kpis k1" style="gap:6px">${kpi('Metros tendidos', t.tend, `/ ${fmt(t.req)} m`)}${kpi('Circuitos completos', a, `/ ${b}`)}</div>
        <div class="muted" style="margin-top:6px">${fmt(t.listo)} m listos para cortar</div></div></div>`;
    });
    h += `</div><div class="grid g2 stagger">`;
    // por STS (BT)
    const grupo = (cat, keyf) => { const m = new Map(); R.circuitos.filter((c) => c.cat === cat).forEach((c) => { const k = keyf(c); const o = m.get(k) || { tend: 0, listo: 0, pend: 0, n: 0, ok: 0 }; c.fz.forEach((f) => { const pz = c.fasesInfo[f]; if (!pz) return; if (pz.estado === 'ejecutado') o.tend += pz.len; else if (pz.estado === 'listo') o.listo += pz.len; else o.pend += pz.len; }); o.n++; if (c.completo) o.ok++; m.set(k, o); }); return [...m.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'es', { numeric: true })); };
    const filas = (g) => g.map(([k, o]) => { const tot = o.tend + o.listo + o.pend; return { label: k, right: `${fmt(tot ? (o.tend / tot) * 100 : 0)}% · ${o.ok}/${o.n} circ.`, parts: [{ v: o.tend, color: ST.tend, name: 'Tendido' }, { v: o.listo, color: ST.listo, name: 'Listo para cortar' }, { v: o.pend, color: ST.pend, name: 'Pendiente' }] }; });
    const leg = Charts.legend([[ST.tend, 'Tendido'], [ST.listo, 'Listo para cortar'], [ST.pend, 'Pendiente']]);
    h += `<div class="card"><h3>BT por STS</h3>${Charts.hbars(filas(grupo('BT', (c) => c.hasta)))}${leg}</div>`;
    h += `<div class="card"><h3>MT por circuito</h3>${Charts.hbars(filas(grupo('MT', (c) => c.designacion)), { labelW: 70 })}${leg}</div>`;
    // línea temporal
    const series = ['BT', 'MT', 'PAT'].map((cat) => {
      const tot = sumCat(cat).req || 1;
      const ej = R.piezas.filter((p) => p.cat === cat && p.estado === 'ejecutado');
      const byDay = new Map();
      ej.forEach((p) => { const d = p.fecha || 'sin'; byDay.set(d, (byDay.get(d) || 0) + p.len); });
      const sin = byDay.get('sin') || 0; byDay.delete('sin');
      const days = [...byDay.keys()].sort();
      let acc = sin; const pts = [];
      days.forEach((d, i) => { acc += byDay.get(d) + (i === 0 ? 0 : 0); pts.push({ x: new Date(d + 'T12:00:00'), y: acc / tot, tip: `${CATN[cat]} · ${new Date(d + 'T12:00:00').toLocaleDateString('es-AR')}: ${fmt(acc)} m acumulados (${fmt((acc / tot) * 100, 1)} %)` }); });
      return { name: cat, color: SERIE[cat], pts, sin };
    });
    const nDias = new Set(R.piezas.filter((p) => p.estado === 'ejecutado' && p.fecha).map((p) => p.fecha)).size;
    h += `<div class="card"><h3>Tendido acumulado en el tiempo</h3>${nDias >= 1 ? Charts.line(series.filter((x) => x.pts.length)) + Charts.legend(series.filter((x) => x.pts.length).map((x) => [x.color, CATN[x.name]])) : ''}
      ${nDias < 2 ? `<p class="hint">La curva se completa a medida que se registran tendidos con fecha (en Tender).${series.some((x) => x.sin) ? ' Hay tendidos sin fecha: se suman al inicio.' : ''}</p>` : ''}</div>`;
    // zanjas y bobinas
    const zf = ['BT', 'MT'].map((cat) => { const z = R.zanjas[cat]; return { label: CATN[cat], right: `${fmt(z.total ? (z.realizada / z.total) * 100 : 0)}% realizada`, parts: [{ v: z.cerrada, color: '#4b5567', name: 'Cerrada' }, { v: z.abierta, color: '#f5a524', name: 'Abierta' }, { v: Math.max(0, z.total - z.realizada), color: ST.pend, name: 'Sin abrir' }] }; });
    const bf = R.resumen.filter((r) => r.bobinas).map((r) => { const bs = R.bobinas.filter((b) => b.key === r.key); const term = bs.filter((b) => b.estadoReal === 'terminada').length, uso = bs.filter((b) => b.estadoReal === 'en uso').length, sin = bs.length - term - uso;
      return { label: `${CATS[r.cat].corto} ${r.seccion}`, right: `${term}/${bs.length} terminadas`, parts: [{ v: term, color: '#4b5567', name: 'Terminadas' }, { v: uso, color: ST.tend, name: 'En uso' }, { v: sin, color: ST.pend, name: 'Sin empezar' }] }; });
    h += `<div class="card"><h3>Zanjas (metros)</h3>${Charts.hbars(zf, { labelW: 120 })}${Charts.legend([['#4b5567', 'Cerrada'], ['#f5a524', 'Abierta'], [ST.pend, 'Sin abrir']])}
      <h3 style="margin-top:18px">Bobinas</h3>${Charts.hbars(bf, { labelW: 80, unit: 'bobinas' })}${Charts.legend([['#4b5567', 'Terminadas'], [ST.tend, 'En uso'], [ST.pend, 'Sin empezar']])}</div>`;
    const ptRows = (() => { const cs = R.circuitos.filter((c) => c.cat !== 'PAT'); const out = []; const add = (label, fn) => { let t = 0, c = 0; cs.forEach((x) => { const r = fn(x); if (r) { t += r[1]; c += r[0]; } }); if (t) out.push({ label, right: `${c}/${t}`, parts: [{ v: c, color: '#4b5567', name: 'Colocadas' }, { v: t - c, color: ST.pend, name: 'Pendientes' }] }); };
      add('BT · lado inversor', (x) => x.cat === 'BT' && [puntasDe(x).o, puntasDe(x).n]); add('BT · lado STS', (x) => x.cat === 'BT' && [puntasDe(x).d, puntasDe(x).n]);
      ['STS – STS', 'STS – Sala de celdas', 'Sala de celdas – Piquete LMT', 'Piquete – ET'].forEach((g) => add('MT · ' + g, (x) => x.cat === 'MT' && tramo(x) === g && [puntasDe(x).col, puntasDe(x).tot])); return out; })();
    h += `</div><h2 class="sech">Puntas de cable</h2><div class="grid g2 stagger" style="margin-bottom:8px"><div class="card"><h3>Puntas colocadas por sección</h3>${(() => { const cs = R.circuitos.filter((c) => c.cat !== 'PAT'); const ks = [...new Set(cs.map((c) => `${c.cat}|${c.seccion}`))]; return Charts.hbars(ks.map((k) => { const g = cs.filter((c) => `${c.cat}|${c.seccion}` === k).map(puntasDe); const t = g.reduce((a, x) => a + x.tot, 0), cc = g.reduce((a, x) => a + x.col, 0); return { label: k.replace('|', ' '), right: `${cc}/${t} colocadas`, parts: [{ v: cc, color: '#4b5567', name: 'Colocadas' }, { v: t - cc, color: ST.pend, name: 'Pendientes' }] }; }), { labelW: 80, unit: 'puntas' }); })()}${Charts.legend([['#4b5567', 'Colocadas'], [ST.pend, 'Pendientes']])}</div><div class="card"><h3>Puntas por extremo y tramo</h3>${Charts.hbars(ptRows, { labelW: 220, rightW: 80, unit: 'puntas' })}${Charts.legend([['#4b5567', 'Colocadas'], [ST.pend, 'Pendientes']])}</div></div>` + fundAvanceHTML();
    if ((S.cronoTareas || []).length) h += `<h2 class="sech">Cronograma de obra</h2>` + cronoCurvaFases(cronoCalc());
    el.innerHTML = h;
    $$('.fz[data-k]', el).forEach((b) => { b.onclick = () => { ui.gfoco = b.dataset.k; go('gantt'); }; });
    Charts.bindTips(el);
  }

  // ======================= PROPUESTA =======================
  function vPropuesta(el) {
    const cat = ui.propCat || 'BT';
    actions([['Exportar Excel', 'btn', exportExcel]]);
    const L = Engine.propuesta(S, cat);
    const tz = L.reduce((a, l) => a + l.zanjas.length, 0), mz = L.reduce((a, l) => a + l.metrosZanja, 0), mc = L.reduce((a, l) => a + l.metrosCable, 0);
    let h = `<div class="tools"><div class="seg" id="fPC"><button data-v="BT">BT 0,8 kV</button><button data-v="MT">MT 33 kV</button></div>
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
        <td>${esc(z.titulo)}${z.miembros.length > 1 ? ' <span class="pill p-warn" title="Zanja compartida">compartida</span>' : ''}</td>
        <td><div class="chips">${z.miembros.map((c) => `<span class="chip ${c.completo ? 'lista' : ''}" title="${esc(c.desde)} → ${esc(c.hasta)}${c.completo ? ' · tendido' : ''}">${c.completo ? '✓ ' : ''}${esc(c.designacion)}${z.miembros.length > 1 && !c.completo && !window.READONLY ? `<button class="chipx" data-sacar="${c.id}" title="Sacar de esta zanja (queda con zanja propia, para más adelante)">×</button>` : ''}</span>`).join('')}</div></td>
        <td class="n"><input type="number" class="zl" step="0.1" min="0" value="${z.largo}" title="Largo de zanja según plano"></td><td>${zSeg(z.id, z.estado, z.listoCerrar)}</td><td>${z.nReal}/${z.nCond} ${z.completo ? '✓' : ''}</td>
        <td>${patOk ? `<span class="pill p-done">${esc(z.pat.fasesInfo.C.bobina || 'sin bobina')} · ${fmt(z.pat.fasesInfo.C.len, 1)} m</span>` : '<span class="muted">al cerrar</span>'}</td>
        <td style="white-space:nowrap"><button class="btn sm acc" data-a="tc">Cable</button> <button class="btn sm" data-a="tp">PAT</button><button class="btn sm ghost" data-a="ez" title="Editar zanja">✎</button></td></tr>`;
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
      tr.querySelector('[data-a=tp]').onclick = () => z.pat && tender(z.pat.id);
      tr.querySelector('[data-a=ez]').onclick = () => editZanja(z.id);
      $('.zl', tr).onchange = (e) => { const sz = S.zanjas.find((x) => x.id === z.id); sz.largo = Math.max(0, Number(e.target.value) || 0); sz.largoPlano = true; commit(`Zanja ${z.titulo}: ${fmt(sz.largo, 1)} m`); };
    });
  }
  const zSeg = (zid, est, okCerrar) => `<span class="zseg" data-id="${zid}">${Engine.ZANJA.map((z) => `<button data-z="${z}" class="${est === z ? 'on z' + z.replace(' ', '') : ''}" ${z === 'cerrada' && !okCerrar && est !== 'cerrada' ? 'title="Faltan tender circuitos de esta zanja"' : ''}>${z === 'no abierta' ? 'No' : z === 'abierta' ? 'Abierta' : 'Cerrada'}</button>`).join('')}</span>`;
  function bindZSeg(el) {
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
          + `<p class="hint">Una zanja se cierra cuando están tendidos todos sus circuitos. Si alguno queda para más adelante, sacalo de la zanja: pasa a zanja propia y libera su bobina.</p>`,
        buttons: [['Entendido', 'btn pri', () => null]] });
      return;
    }
    const bobsDe = (k) => R.bobinas.filter((b) => b.key === k);
    const fila = (z) => {
      const p = z.pat, pf = p ? p.fasesInfo.C || {} : {}, real = p ? (S.circuitos.find((x) => x.id === p.id).real || {}).C : null;
      const bobs = p ? bobsDe(p.key) : [];
      const sel = real ? real.bobina || '' : pf.bobina || '';
      const largo = real && real.metros ? real.metros : z.largo;
      return `<div class="phase-row" data-z="${z.id}" style="grid-template-columns:minmax(150px,1fr) 70px 200px 96px 130px">
        <div><b>${esc(z.titulo)}</b><div class="muted">${z.miembros.length} circuito${z.miembros.length > 1 ? 's' : ''} · zanja ${fmt(z.largo, 1)} m</div></div>
        <span class="chip">${p ? p.seccion + ' mm²' : '—'}</span>
        ${p ? `<select class="pb"><option value="">Sin bobina registrada</option>${bobs.map((b) => `<option value="${esc(b.codigo)}" ${sel === b.codigo ? 'selected' : ''}>${esc(b.codigo)} · saldo ${fmt(b.saldoActual, 1)} m</option>`).join('')}</select>` : '<span class="muted">sin PAT</span>'}
        <input type="number" class="pm" step="0.1" min="0" value="${largo}" title="Largo de PAT tendido" ${p ? '' : 'disabled'}>
        <input type="date" class="pd" value="${(real && real.fecha) || today()}"></div>`;
    };
    const res = await modal({ title: ok.length === 1 ? `Cerrar zanja ${esc(ok[0].titulo)}` : `Cerrar ${ok.length} zanjas`, wide: true,
      sub: auto ? 'Están tendidos todos los circuitos de la zanja' : 'PAT de Cu desnudo: 25 mm² en BT, 95 mm² en MT',
      body: `<div class="muted phase-row prh" style="grid-template-columns:minmax(150px,1fr) 70px 200px 96px 130px"><span>Zanja</span><span>PAT</span><span>Bobina</span><span>Largo (m)</span><span>Fecha</span></div>${ok.map(fila).join('')}
        ${inc.length ? `<p class="hint" style="color:var(--warn)">No se cierran (faltan circuitos por tender): ${inc.map((z) => esc(z.titulo)).join(', ')}.</p>` : ''}
        <p class="hint">La PAT se da por tendida con el largo de la zanja; corregilo si en campo fue distinto. Se propone la bobina del plan.</p>`,
      buttons: [[auto ? 'Más tarde' : 'Cancelar', 'btn', () => null], [ok.length === 1 ? 'Cerrar zanja' : 'Cerrar zanjas', 'btn pri', (box) => {
        const out = [];
        for (const row of $$('.phase-row[data-z]', box)) {
          const pb = $('.pb', row); const m = Number($('.pm', row).value) || 0;
          out.push({ zid: row.dataset.z, bobina: pb ? pb.value : null, metros: m, fecha: $('.pd', row).value, conPat: !!pb });
        }
        return out;
      }]] });
    if (!res) return;
    res.forEach((r) => {
      const z = S.zanjas.find((x) => x.id === r.zid), rzz = R.zlist.find((x) => x.id === r.zid);
      if (r.conPat && rzz.pat) {
        const pc = S.circuitos.find((x) => x.id === rzz.pat.id);
        pc.real = { C: r.bobina ? { bobina: r.bobina, metros: r.metros, fecha: r.fecha } : { sinBobina: true, metros: r.metros, fecha: r.fecha } };
      }
      z.estado = 'cerrada'; z.fechaCierre = r.fecha || today();
    });
    ui.flash = [...res.map((r) => r.zid), ...ok.flatMap((z) => z.miembros.map((c) => c.id))]; ui.sel.clear();
    commit(res.length === 1 ? `Zanja ${ok[0].titulo} cerrada · PAT ${fmt(res[0].metros, 1)} m` : `${res.length} zanjas cerradas con su PAT`);
  }
  function bindSel(el, list) {
    const all = $('#selAll', el);
    if (all) { all.checked = list.length > 0 && list.every((c) => ui.sel.has(c.id)); all.onchange = (e) => { list.forEach((c) => (e.target.checked ? ui.sel.add(c.id) : ui.sel.delete(c.id))); render(false); }; }
    $$('tbody tr .sel', el).forEach((cb) => { const id = cb.closest('tr').dataset.id; cb.onchange = (e) => { e.target.checked ? ui.sel.add(id) : ui.sel.delete(id); render(false); }; });
  }

  // ======================= PLAN =======================
  function vPlan(el, cat) {
    actions([['Replanificar', 'btn ghost', () => replanificar(cat)], ['Exportar Excel', 'btn', exportExcel], ['PDF: solo listos', 'btn', () => printPlan(cat, 'listos')], ['PDF: plan completo', 'btn pri', () => printPlan(cat, 'todo')]]);
    const secs = R.resumen.filter((r) => r.cat === cat).map((r) => r.seccion);
    const fsec = ui.sec[cat] || 'all', fest = ui.est[cat] || 'all', q = (ui.q[cat] || '').toLowerCase();
    const cMap = new Map(R.circuitos.map((c) => [c.id, c]));
    let bobs = R.bobinas.filter((b) => b.cat === cat && (fsec === 'all' || String(b.seccion) === fsec));
    if (fest === 'listos') bobs = bobs.filter((b) => b.cortes.some((p) => p.estado === 'listo'));
    if (fest === 'abiertas') bobs = bobs.filter((b) => b.cortes.length);
    if (q) bobs = bobs.filter((b) => b.codigo.toLowerCase().includes(q) || String(b.nro).includes(q) ||
      b.cortes.some((p) => { const c = cMap.get(p.cid); return (c.designacion + ' ' + c.desde + ' ' + c.hasta).toLowerCase().includes(q); }));
    bobs.sort((a, b) => (b.consumoReal > 0) - (a.consumoReal > 0) || (b.asigListo > 0) - (a.asigListo > 0) || (b.cortes.length > 0) - (a.cortes.length > 0) || a.idx - b.idx);
    const falta = R.piezas.filter((p) => p.cat === cat && p.estado === 'falta' && (fsec === 'all' || String(p.seccion) === fsec));
    let h = `<div class="tools"><div class="seg" id="fSec"><button data-v="all">Todas</button>${secs.map((s) => `<button data-v="${s}">${s} mm²</button>`).join('')}</div>
      <div class="seg" id="fEst"><button data-v="all">Todas las bobinas</button><button data-v="abiertas">Con cortes</button><button data-v="listos">Con cortes listos</button></div>
      <span class="sp"></span><input type="search" id="fQ" placeholder="Buscar bobina o circuito…" value="${esc(ui.q[cat] || '')}" style="width:240px"></div>
      <div class="legend" style="margin:-4px 0 12px"><span><i class="c-done"></i>Ejecutado</span><span><i class="c-ready"></i>Listo para cortar (zanja abierta)</span><span><i class="c-prov"></i>Provisorio</span><span><i class="c-rem"></i>Remanente</span></div>`;
    if (falta.length) {
      const sinB = secs.filter((s) => !R.bobinas.some((b) => b.cat === cat && b.seccion === s));
      h += `<div class="alert ${sinB.length ? 'aviso' : 'error'}" style="margin-bottom:14px">${falta.length} conductores sin bobina (${fmt(falta.reduce((a, p) => a + p.len, 0))} m)${sinB.length ? ` · cargá las bobinas de ${sinB.map((s) => s + ' mm²').join(', ')} en Bobinas` : ''}</div>`;
    }
    h += `<div class="plan stagger">`;
    bobs.forEach((b) => {
      const rem = Math.max(0, b.remanente);
      h += `<div class="bob"><header><div class="code">${esc(b.codigo)}</div><div class="meta">N° ${esc(b.nro)}<br>${b.seccion} mm² · ${fmt(b.entrada)} m</div><span class="pills2">${pill(b.estadoReal)}<span class="muted" title="Cómo queda al final del plan">al final: ${esc(b.estado)}</span></span></header>
        <div class="bar"><div class="c-done" data-w="${pct(b.consumoReal, b.entrada)}"></div><div class="c-ready" data-w="${pct(b.asigListo, b.entrada)}"></div><div class="c-prov" data-w="${pct(b.asigProv, b.entrada)}"></div><div class="c-rem" data-w="${pct(rem, b.entrada)}"></div></div>
        <div class="nums"><span>Saldo actual <b>${fmt(b.saldoActual, 1)} m</b></span><span>Listo <b>${fmt(b.asigListo, 1)}</b></span><span>Prov. <b>${fmt(b.asigProv, 1)}</b></span><span>Final <b>${fmt(b.remanente, 1)} m</b></span></div>`;
      if (!b.cortes.length) h += `<div class="closed">Sin cortes asignados: queda cerrada.</div>`;
      else {
        h += `<table><thead><tr><th>#</th><th>Circuito</th><th>Desde → Hasta</th><th>${cat === 'PAT' ? '' : 'Fase'}</th><th class="n">Metros</th><th class="n">Saldo</th></tr></thead><tbody>`;
        b.cortes.forEach((p) => { const c = cMap.get(p.cid); h += `<tr class="${p.estado} ${p.estado !== 'ejecutado' ? 'clk' : ''}" data-cid="${p.cid}" title="${p.estado}${p.manual ? ' · bobina elegida a mano' : ''}${p.estado !== 'ejecutado' ? ' · clic para elegir otra bobina o corregir el largo' : ''}"><td><span class="dot ${p.estado}"></span>${p.corte}${p.manual ? '<i class="pin">●</i>' : ''}</td><td class="mono">${esc(c.designacion)}</td><td>${esc(c.desde)} → ${esc(c.hasta)}</td><td>${p.fase === 'C' ? '' : p.fase}</td><td class="n">${fmt(p.len, 2)}</td><td class="n">${fmt(p.saldo, 1)}</td></tr>`; });
        h += `</tbody></table>`;
      }
      h += `</div>`;
    });
    if (!bobs.length) h += `<div class="empty"><b>${R.bobinas.some((b) => b.cat === cat) ? 'No hay bobinas con ese filtro' : 'Todavía no hay bobinas de ' + CATN[cat]}</b>${R.bobinas.some((b) => b.cat === cat) ? '' : 'Cargalas en la sección Bobinas (a mano o importando la planilla de control).'}</div>`;
    el.innerHTML = h + '</div>';
    $$('tr.clk', el).forEach((tr) => { tr.onclick = () => elegirBobina(tr.dataset.cid); });
    segBind('#fSec', fsec, (v) => { ui.sec[cat] = v; render(true); });
    segBind('#fEst', fest, (v) => { ui.est[cat] = v; render(true); });
    searchBind('#fQ', (v) => { ui.q[cat] = v; });
  }

  async function replanificar(cat) {
    if (window.READONLY) return;
    if (!(await confirmar('Replanificar', `Los cortes listos de ${CATN[cat]} se vuelven a asignar desde cero buscando el mejor aprovechamiento. Puede cambiar la bobina de cortes que ya figuran en una hoja de corte impresa. Lo ya tendido no se toca.`, 'Replanificar'))) return;
    const ids = new Set(S.circuitos.filter((c) => c.cat === cat).map((c) => c.id));
    Object.keys(S.compromiso || {}).forEach((k) => { if (ids.has(k.split('|')[0])) delete S.compromiso[k]; });
    commit(`Plan de ${CATN[cat]} recalculado`);
  }

  // ======================= CIRCUITOS =======================
  function vCircuitos(el, cat) {
    const n = ui.sel.size ? ` (${ui.sel.size})` : '', dis = ui.sel.size ? '' : ' dis';
    const isPat = cat === 'PAT';
    actions(isPat ? [] : [['Importar Excel', 'btn', () => importExcel(cat)], ['+ Circuito', 'btn', () => editCircuito(null, cat)],
      [`Misma zanja${n}`, 'btn' + (ui.sel.size > 1 ? '' : ' dis'), () => unir(zidsSel())], [`Cerrar zanja${n}`, 'btn' + dis, () => bulkZanja('cerrada')], [`Abrir zanja${n}`, 'btn acc' + dis, () => bulkZanja('abierta')]]);
    const all = R.circuitos.filter((c) => c.cat === cat);
    const stss = [...new Set(all.map((c) => c.hasta))].sort();
    const ests = ['listo para tender', 'en espera de zanja', 'tendido parcial', 'tendido', 'falta bobina'];
    const fsts = ui.sts[cat] || 'all', fce = ui.cest[cat] || 'all', zf = ui.zf[cat] || 'all', q = (ui.q['c' + cat] || '').toLowerCase();
    const list = all.filter((c) => (fsts === 'all' || c.hasta === fsts) && (fce === 'all' || c.estado === fce) && (zf === 'all' || c.zanja === zf)
      && (!q || `${c.designacion} ${c.desde} ${c.hasta}`.toLowerCase().includes(q)));
    let h = `<div class="tools"><select id="fSts"><option value="all">${cat === 'BT' ? 'Todos los STS' : 'Todos los destinos'}</option>${stss.map((s) => `<option>${esc(s)}</option>`).join('')}</select>
      <select id="fCE"><option value="all">Todos los estados</option>${ests.map((s) => `<option>${s}</option>`).join('')}</select>
      <div class="seg" id="fZ"><button data-v="all">Toda zanja</button><button data-v="no abierta">No abierta</button><button data-v="abierta">Abierta</button><button data-v="cerrada">Cerrada</button></div>
      <span class="muted">${list.length} ${isPat ? 'tendidos' : 'circuitos'}</span><span class="sp"></span><input type="search" id="fCQ" placeholder="Buscar…" value="${esc(ui.q['c' + cat] || '')}" style="width:220px"></div>
      <div class="tblwrap"><table class="tbl"><thead><tr>${isPat ? '' : '<th><input type="checkbox" id="selAll"></th>'}<th>Designación</th><th>Desde</th><th>Hasta</th><th>Sección</th><th class="n">${isPat ? 'Largo' : cat === 'MT' ? 'm / conductor' : 'm / fase'}</th>
      <th>Zanja</th><th>${isPat ? 'Bobina' : 'Conductores · bobina'}</th><th class="n">Real vs lista</th><th>Estado</th><th></th></tr></thead><tbody>`;
    list.forEach((c) => {
      h += `<tr data-id="${c.id}" class="${ui.sel.has(c.id) ? 'sel' : ''}">${isPat ? '' : `<td><input type="checkbox" class="sel" ${ui.sel.has(c.id) ? 'checked' : ''}></td>`}
        <td class="mono">${esc(c.designacion)}${c.obs ? ` <span title="${esc(c.obs)}">ⓘ</span>` : ''}</td><td>${esc(c.desde)}</td><td>${esc(c.hasta)}</td><td>${c.seccion ?? '?'}</td>
        <td class="n">${fmt(c.lenFase, 2)}</td><td>${isPat ? pill(c.zanja) : zSeg(c.zid, c.zanja, c.listoCerrar) + (c.compartida ? ` <span class="shr" title="Zanja compartida: ${esc(c.zTitulo)}">⫘</span>` : '')}</td><td>${phases(c)}</td><td class="n">${desv(c)}</td><td>${pill(c.estado)}</td>
        <td style="white-space:nowrap"><button class="btn sm acc" data-a="tender">Tender</button> <button class="btn sm" data-a="bob" title="Elegir bobina y corregir largo">Bobina / largo</button><button class="btn sm ghost" data-a="edit" title="Editar">✎</button></td></tr>`;
    });
    h += `</tbody></table>${list.length ? '' : '<div class="empty"><b>Sin resultados</b></div>'}</div>`;
    if (isPat) h += `<p class="hint">Cada zanja lleva un solo conductor de Cu desnudo (25 mm² en BT, 95 mm² en MT) con el largo de la zanja, aunque la compartan varios circuitos. El estado de zanja se toma del circuito. Con ✎ podés corregir el largo de un tendido de PAT.</p>`;
    el.innerHTML = h;
    $('#fSts').value = fsts; $('#fCE').value = fce;
    $('#fSts').onchange = (e) => { ui.sts[cat] = e.target.value; render(false); };
    $('#fCE').onchange = (e) => { ui.cest[cat] = e.target.value; render(false); };
    segBind('#fZ', zf, (v) => { ui.zf[cat] = v; render(false); });
    searchBind('#fCQ', (v) => { ui.q['c' + cat] = v; });
    if (!isPat) { bindSel(el, list); bindZSeg(el); }
    $$('tbody tr', el).forEach((tr) => {
      const id = tr.dataset.id;
      tr.querySelector('[data-a=tender]').onclick = () => tender(id);
      tr.querySelector('[data-a=bob]').onclick = () => elegirBobina(id);
      tr.querySelector('[data-a=edit]').onclick = () => (isPat ? editPat(id) : editCircuito(id, cat));
      tr.ondblclick = (e) => { if (!e.target.closest('button,input')) tender(id); };
    });
  }

  async function elegirBobina(id) {
    if (window.READONLY) return;
    const c = S.circuitos.find((x) => x.id === id), rc = R.circuitos.find((x) => x.id === id);
    const bobs = R.bobinas.filter((b) => b.key === rc.key);
    if (!bobs.length) { toast(`No hay bobinas de ${CATN[rc.cat]} ${rc.seccion} mm² cargadas`, { err: true }); return; }
    const lista = Math.round((Number(c.cantidad) || 0) / rc.fz.length * 100) / 100;
    const aj = Number(((S.params.ajuste || {})[rc.cat]) || 0);
    const conAj = Math.round(lista * (1 + aj / 100) * 100) / 100;
    const asig = c.asig || {};
    const opts = (sel) => `<option value="">Automático (mejor aprovechamiento)</option>` + bobs.map((b) => `<option value="${esc(b.codigo)}" ${sel === b.codigo ? 'selected' : ''}>${esc(b.codigo)} · saldo actual ${fmt(b.saldoActual, 1)} m${b.estadoReal === 'en uso' ? ' · en uso' : b.estadoReal === 'sin abrir' ? ' · sin abrir' : ''}</option>`).join('');
    const rows = rc.fz.map((f) => { const r = (c.real || {})[f], p = rc.fasesInfo[f] || {};
      if (r && (r.bobina || r.sinBobina)) return `<div class="phase-row" style="grid-template-columns:56px 1fr 180px"><b>${f === "C" ? "Cu" : f}</b><span class="muted">Ya tendida desde ${esc(r.bobina || "(sin bobina)")} (${fmt(r.metros, 2)} m)</span><span></span></div>`;
      return `<div class="phase-row eb" data-f="${f}" style="grid-template-columns:56px 1fr 180px"><b>${f === 'C' ? 'Cu' : f}</b><select class="bob">${opts(asig[f] || '')}</select><span class="muted">plan actual: ${esc(p.bobina || '—')}${p.manual ? ' (elegida)' : ''}</span></div>`; }).join('');
    const res = await modal({ title: `Bobina y largo · ${c.designacion}`, sub: `${esc(c.desde)} → ${esc(c.hasta)} · ${esc(c.formacion)}`, wide: true,
      body: `<div class="form"><label>Largo a cortar por conductor (m)<input type="number" step="0.01" min="0" name="largo" value="${c.largoCorte || ''}" placeholder="${fmt(conAj, 2)}"></label>
        <label>Referencia<input type="text" disabled value="Lista ${fmt(lista, 2)} m${aj ? ` · con ajuste ${aj > 0 ? '+' : ''}${fmt(aj, 1)} % = ${fmt(conAj, 2)} m` : ''}"></label></div>
        <p class="hint">Vacío = largo de la lista (con el ajuste % del tipo, si hay). Cargá un valor si en campo este circuito necesita otro largo.</p>
        <h4 style="margin:14px 0 4px">Bobina por conductor</h4>
        ${rc.fz.length > 1 ? `<div class="phase-row" style="grid-template-columns:56px 1fr 180px"><span class="muted">Todas</span><select id="ebAll"><option value="-">— elegir para todas —</option>${opts('')}</select><span></span></div>` : ''}${rows}
        <p class="hint">Elegí una bobina solo en casos especiales (por ejemplo, para no mover bobinas en el campo). El resto del plan se recalcula completo para aprovechar mejor las demás bobinas.</p>`,
      buttons: [['Quitar elecciones', 'btn', () => 'clear'], ['Cancelar', 'btn', () => null], ['Guardar y recalcular', 'btn pri', (box) => {
        const a = {}; $$('.eb', box).forEach((row) => { const v = $('.bob', row).value; if (v) a[row.dataset.f] = v; });
        const l = Number($('[name=largo]', box).value);
        return { a, l };
      }]] });
    if (!res) return;
    if (res === 'clear') { delete c.asig; }
    else { if (Object.keys(res.a).length) c.asig = res.a; else delete c.asig; if (res.l > 0) c.largoCorte = Math.round(res.l * 100) / 100; else delete c.largoCorte; }
    recalcularTodo(rc.cat);
    ui.flash = [id];
    commit(res === 'clear' ? `${c.designacion}: vuelve a bobina automática · plan recalculado` : `${c.designacion} actualizado · plan recalculado`);
  }
  document.addEventListener('change', (e) => { if (e.target.id === 'ebAll' && e.target.value !== '-') { $$('.mbox .eb .bob').forEach((s2) => { s2.value = e.target.value; }); } });
  // libera los compromisos de un tipo para que el plan se rearme completo (respetando lo tendido y lo elegido a mano)
  function recalcularTodo(cat) {
    const ids = new Set(S.circuitos.filter((c) => c.cat === cat).map((c) => c.id));
    Object.keys(S.compromiso || {}).forEach((k) => { if (ids.has(k.split('|')[0])) delete S.compromiso[k]; });
  }
  function desv(c) {
    if (!c.teoTot) return '<span class="muted">–</span>';
    const pc = c.desvio / c.teoTot * 100, cls = Math.abs(c.desvio) < 0.005 ? '' : c.desvio > 0 ? 'pos' : 'neg';
    return `<span class="dv ${cls}" title="${fmt(c.realTot, 2)} m tirados vs ${fmt(c.teoTot, 2)} m de lista">${c.desvio > 0 ? '+' : ''}${fmt(c.desvio, 1)} m · ${c.desvio > 0 ? '+' : ''}${fmt(pc, 1)}%</span>`;
  }
  async function tender(id) {
    if (window.READONLY) return;
    const c = S.circuitos.find((x) => x.id === id), rc = R.circuitos.find((x) => x.id === id);
    const bobs = R.bobinas.filter((b) => b.key === rc.key);
    if (!bobs.length && rc.cat !== 'PAT') { toast(`No hay bobinas de ${CATN[rc.cat]} ${rc.seccion} mm² cargadas`, { err: true }); return; }
    const opts = (sel) => `<option value="">—</option>${rc.cat === 'PAT' ? `<option value="__sin" ${sel === '__sin' ? 'selected' : ''}>Sin bobina registrada</option>` : ''}` + bobs.map((b) => `<option value="${esc(b.codigo)}" ${sel === b.codigo ? 'selected' : ''}>${esc(b.codigo)} · saldo ${fmt(b.saldoActual, 1)} m</option>`).join('');
    const lbl = (f) => (f === 'C' ? 'Cu' : f);
    const teo = Math.round((Number(c.cantidad) || 0) / rc.fz.length * 100) / 100;
    const rows = rc.fz.map((f) => {
      const r = (c.real || {})[f], plan = rc.fasesInfo[f] || {}, done = !!(r && (r.bobina || r.sinBobina));
      return `<div class="phase-row pr6" data-f="${f}"><label class="fz"><input type="checkbox" class="on" ${done ? 'checked' : ''}> ${lbl(f)}</label>
        <select class="bob">${opts(done ? r.bobina || '__sin' : plan.bobina || '')}</select>
        <span class="teo">${fmt(teo, 2)}</span>
        <input type="number" class="m" step="0.01" min="0" value="${done ? r.metros : rc.lenFase}" title="Metros realmente tirados">
        <span class="dif"></span>
        <input type="date" class="d" value="${done ? r.fecha || '' : today()}"></div>`;
    }).join('');
    setTimeout(() => {
      const box = $('.mbox'); if (!box) return;
      const upd = () => {
        let tr = 0, tt = 0;
        $$('.phase-row', box).forEach((row) => {
          const m = Number($('.m', row).value) || 0, d = Math.round((m - teo) * 100) / 100, on = $('.on', row).checked;
          const el = $('.dif', row); el.textContent = (d > 0 ? '+' : '') + fmt(d, 2); el.className = 'dif ' + (Math.abs(d) < 0.005 ? '' : d > 0 ? 'pos' : 'neg');
          row.classList.toggle('off', !on); if (on) { tr += m; tt += teo; }
        });
        const d = tr - tt;
        $('#tTot', box).innerHTML = tt ? `Tildado: <b>${fmt(tr, 2)} m</b> tirados vs <b>${fmt(tt, 2)} m</b> de lista · diferencia <b class="${d > 0.005 ? 'pos' : d < -0.005 ? 'neg' : ''}">${d > 0 ? '+' : ''}${fmt(d, 2)} m (${d > 0 ? '+' : ''}${fmt(d / tt * 100, 1)} %)</b>` : '';
      };
      $$('.phase-row input', box).forEach((i) => { i.addEventListener('input', upd); i.addEventListener('change', upd); });
      upd();
    }, 30);
    const nAll = rc.fz.length;
    const res = await modal({
      title: `Registrar tendido · ${c.designacion}`, wide: true, sub: `${esc(c.desde)} → ${esc(c.hasta)} · ${esc(c.formacion)} · ${fmt(rc.lenFase, 2)} m por conductor · zanja ${rc.zanja}`,
      body: `<div class="muted pr6 prh"><span>${nAll === 1 ? 'Cond.' : 'Fase'}</span><span>Bobina usada</span><span>Lista</span><span>Tirado real</span><span>Dif.</span><span>Fecha</span></div>${rows}
        <div class="tot" id="tTot"></div>
        <p class="hint">Tildá lo que ya se tendió. Se propone la bobina del plan y el largo de la lista; cargá los metros realmente tirados y el saldo de la bobina se ajusta. La diferencia con la lista queda registrada para el seguimiento.</p>`,
      buttons: [['Borrar registro', 'btn danger', (box) => { $$('.on', box).forEach((x) => { x.checked = false; }); return save(box); }],
        ['Cancelar', 'btn', () => null], [nAll === 1 ? 'Marcar y guardar' : `Marcar ${nAll === 3 ? 'las 3' : 'todas'} y guardar`, 'btn', (box) => { $$('.on', box).forEach((x) => { x.checked = true; }); return save(box); }], ['Guardar', 'btn pri', (box) => save(box)]],
    });
    function save(box) {
      const real = {};
      for (const row of $$('.phase-row', box)) {
        if (!$('.on', row).checked) continue;
        const b = $('.bob', row).value, m = Number($('.m', row).value);
        if (!b) { toast(`${lbl(row.dataset.f)}: elegí la bobina`, { err: true }); return false; }
        const met = m > 0 ? Math.round(m * 100) / 100 : rc.cat === 'PAT' ? rc.lenFase : teo;
        real[row.dataset.f] = b === '__sin' ? { sinBobina: true, metros: met, fecha: $('.d', row).value } : { bobina: b, metros: met, fecha: $('.d', row).value };
      }
      c.real = real;
      return 'ok';
    }
    if (res === 'ok') {
      ui.flash = [id, c.vinculo || c.zanjaId];
      const zc = S.zanjas.find((z) => z.id === (c.vinculo || c.zanjaId));
      if (Object.keys(c.real).length && zc && zc.estado === 'no abierta') zc.estado = 'abierta';
      const antes = zc ? (R.zlist.find((z) => z.id === zc.id) || {}).completo : false;
      commit(`Tendido de ${c.designacion} actualizado`);
      // último circuito de la zanja: ofrecer cerrarla y registrar la PAT
      const rz = zc && !c.vinculo ? R.zlist.find((z) => z.id === zc.id) : null;
      if (rz && rz.completo && !antes && rz.estado !== 'cerrada') setTimeout(() => cerrarZanjas([rz.id], true), 350);
    }
  }

  async function editCircuito(id, cat) {
    if (window.READONLY) return;
    const nuevo = !id;
    const c = nuevo ? { id: uid('c'), cat, designacion: '', desde: '', hasta: '', formacion: cat === 'MT' ? '1x50/25 mm² Al/Cu' : '1x240 mm² Al', fases: 3, cantidad: 0, lineal: 0, real: {} } : S.circuitos.find((x) => x.id === id);
    const rc = nuevo ? null : R.circuitos.find((x) => x.id === id);
    const res = await modal({
      title: nuevo ? `Nuevo circuito ${CATN[cat]}` : `Editar ${c.designacion}`, wide: true,
      body: `<div class="form"><label>Designación<input type="text" name="designacion" value="${esc(c.designacion)}"></label>
        <label>Formación<input type="text" name="formacion" value="${esc(c.formacion)}"></label>
        <label>Desde<input type="text" name="desde" value="${esc(c.desde)}"></label><label>Hasta<input type="text" name="hasta" value="${esc(c.hasta)}"></label>
        <label>Cantidad final (m, todos los conductores)<input type="number" step="0.01" name="cantidad" value="${c.cantidad}"></label>
        <label>Conductores (fases)<input type="number" name="fases" value="${c.fases || 3}" min="1" max="12"></label>
        <label>Longitud lineal (m)<input type="number" step="0.1" name="lineal" value="${c.lineal || 0}"></label>
        <label>Zanja<input type="text" disabled value="${rc ? esc(rc.zTitulo) + ' · ' + fmt(rc.zanjaLargo, 1) + ' m · ' + rc.zanja : 'propia (se crea al guardar)'}"></label>
        <label class="full">Observaciones<input type="text" name="obs" value="${esc(c.obs || '')}"></label></div>
        <p class="hint">El estado, el largo y la PAT se manejan por zanja (sección Zanjas). Para que varios circuitos compartan zanja, tildalos y tocá "Misma zanja".</p>`,
      buttons: [...(nuevo ? [] : [['Eliminar', 'btn danger', () => 'del']]), ['Cancelar', 'btn', () => null], ['Guardar', 'btn pri', (box) => {
        const g = (n) => $(`[name=${n}]`, box).value;
        if (!g('designacion').trim() || !(Number(g('cantidad')) > 0)) { toast('Completá designación y cantidad', { err: true }); return false; }
        Object.assign(c, { designacion: g('designacion').trim(), formacion: g('formacion').trim(), desde: g('desde').trim(), hasta: g('hasta').trim(),
          cantidad: Number(g('cantidad')), fases: Number(g('fases')) || 3, lineal: Number(g('lineal')) || 0, obs: g('obs').trim() });
        if (nuevo) c.zanjaLargo = c.lineal;
        return 'ok';
      }]],
    });
    if (res === 'del') { if (await confirmar('Eliminar circuito', `¿Eliminar ${esc(c.designacion)} y su tendido de PAT?`, 'Eliminar')) { S.circuitos = S.circuitos.filter((x) => x !== c); commit('Circuito eliminado'); } }
    else if (res === 'ok') { if (nuevo) { c._o = Date.now(); S.circuitos.push(c); } commit('Circuito guardado'); }
  }
  async function editPat(id) {
    if (window.READONLY) return;
    const c = S.circuitos.find((x) => x.id === id), base = R.zlist.find((x) => x.id === c.vinculo);
    const res = await modal({
      title: `Editar ${c.designacion}`, sub: `Zanja ${esc(base.titulo)} · ${fmt(base.largo, 1)} m`,
      body: `<div class="form"><label>Formación<input type="text" name="formacion" value="${esc(c.formacion)}"></label>
        <label>Largo (m) – vacío = largo de la zanja<input type="number" step="0.1" name="largo" value="${c.largoManual || ''}" placeholder="${base.largo}"></label></div>`,
      buttons: [['Cancelar', 'btn', () => null], ['Guardar', 'btn pri', (box) => {
        c.formacion = $('[name=formacion]', box).value.trim() || c.formacion;
        const l = Number($('[name=largo]', box).value); if (l > 0) c.largoManual = l; else delete c.largoManual; return 'ok';
      }]],
    });
    if (res === 'ok') commit('Tendido de PAT actualizado');
  }

  // ======================= BOBINAS =======================
  function vBobinas(el) {
    actions([['Importar Excel', 'btn', () => importExcel(null)], ['+ Bobina', 'btn pri', () => editBobina(null)]]);
    const q = (ui.q.bob || '').toLowerCase();
    const list = R.bobinas.filter((b) => (ui.bobCat === 'all' || b.cat === ui.bobCat) && (!q || `${b.codigo} ${b.nro} ${b.remito}`.toLowerCase().includes(q)));
    let h = `<div class="tools"><div class="seg" id="fBC"><button data-v="all">Todas</button><button data-v="BT">BT 0,8 kV</button><button data-v="MT">MT 33 kV</button><button data-v="PAT">PAT Cu desnudo</button></div>
      <span class="muted">${list.length} bobinas · ${list.filter((b) => b.estadoReal === 'sin abrir').length} sin abrir · ${list.filter((b) => b.estadoReal === 'en uso').length} en uso · ${list.filter((b) => b.estadoReal === 'terminada').length} terminadas</span><span class="sp"></span><input type="search" id="fBQ" placeholder="Buscar código, N°, remito…" value="${esc(ui.q.bob || '')}" style="width:240px"></div>
      <div class="tblwrap"><table class="tbl"><thead><tr><th>Tipo</th><th>Código</th><th>N° fabricante</th><th>Sección</th><th class="n">Entrada</th><th class="n">Ya tendido</th>
      <th class="n">Saldo actual</th><th>Uso real</th><th>Estado real</th><th class="n">Plan pendiente</th><th class="n">Remanente previsto</th><th>Al final</th><th></th></tr></thead><tbody>`;
    list.forEach((b) => {
      h += `<tr data-id="${b.id}"><td><span class="chip">${b.cat}</span></td><td><b>${esc(b.codigo)}</b></td><td class="mono" title="Remito ${esc(b.remito || '–')} · ingreso ${esc(b.fecha || '–')}">${esc(b.nro)}</td><td>${b.seccion ?? '?'}</td>
        <td class="n">${fmt(b.entrada)}</td><td class="n">${fmt(b.consumoReal, 1)}</td><td class="n"><b>${fmt(b.saldoActual, 1)}</b></td>
        <td><span class="mini ok"><div data-w="${(b.usoReal * 100).toFixed(1)}%" style="width:0"></div></span> <span class="muted">${fmt(b.usoReal * 100, b.usoReal > 0 && b.usoReal < 0.1 ? 1 : 0)}%</span></td><td>${pill(b.estadoReal)}</td>
        <td class="n">${fmt(b.asigListo + b.asigProv, 1)}</td><td class="n">${fmt(b.remanente, 1)}</td><td>${pill(b.estado)}</td>
        <td><button class="btn sm ghost">✎</button></td></tr>`;
    });
    el.innerHTML = h + `</tbody></table>${list.length ? '' : '<div class="empty"><b>Sin bobinas de este tipo</b>Cargalas con "+ Bobina" o importá la planilla de control.</div>'}</div>`;
    segBind('#fBC', ui.bobCat, (v) => { ui.bobCat = v; render(false); });
    searchBind('#fBQ', (v) => { ui.q.bob = v; });
    $$('tbody tr', el).forEach((tr) => { $('button', tr).onclick = () => editBobina(tr.dataset.id); tr.ondblclick = () => editBobina(tr.dataset.id); });
  }
  const SEC_DEF = { BT: '1x240', MT: '1x50/25', PAT: '1x25 Cu desnudo' };
  async function editBobina(id) {
    if (window.READONLY) return;
    const nuevo = !id, defCat = ui.bobCat !== 'all' ? ui.bobCat : 'BT';
    const b = nuevo ? { id: uid('b'), cat: defCat, fecha: today(), remito: '', nro: '', seccion: SEC_DEF[defCat], entrada: 0, codigo: '', obs: '' } : S.bobinas.find((x) => x.id === id);
    const rb = R.bobinas.find((x) => x.id === id);
    const usada = !nuevo && S.circuitos.some((c) => c.cat === b.cat && Object.values(c.real || {}).some((r) => r.bobina === rb.codigo));
    const res = await modal({
      title: nuevo ? 'Nueva bobina' : `Editar bobina ${rb.codigo} (${b.cat})`,
      body: `<div class="form"><label>Tipo<select name="cat" ${usada ? 'disabled' : ''}>${Object.keys(CATS).map((k) => `<option value="${k}" ${b.cat === k ? 'selected' : ''}>${CATN[k]}</option>`).join('')}</select></label>
        <label>Sección<input type="text" name="seccion" value="${esc(b.seccion)}" placeholder="1x240 · 1x50/25 · 1x25"></label>
        <label>Fecha de ingreso<input type="date" name="fecha" value="${esc(b.fecha || '')}"></label><label>Remito<input type="text" name="remito" value="${esc(b.remito || '')}"></label>
        <label>N° de bobina (fabricante)<input type="text" name="nro" value="${esc(b.nro)}"></label><label>Cantidad de entrada (m)<input type="number" name="entrada" value="${b.entrada}"></label>
        <label>Código interno<input type="text" name="codigo" value="${esc(b.codigo || '')}" placeholder="automático: n/sección"></label><label>Observaciones<input type="text" name="obs" value="${esc(b.obs || '')}"></label></div>
        <p class="hint">El código interno se numera por tipo y sección (ej. 1/25 para la primera bobina de Cu desnudo de 25 mm²).${usada ? ' Tiene tendidos registrados: si cambiás el código se actualizan solos.' : ''}</p>`,
      buttons: [...(nuevo ? [] : [['Eliminar', 'btn danger', () => 'del']]), ['Cancelar', 'btn', () => null], ['Guardar', 'btn pri', (box) => {
        const g = (n) => $(`[name=${n}]`, box).value.trim();
        if (!g('nro') || !(Number(g('entrada')) > 0) || Engine.parseSeccion(g('seccion')) == null) { toast('Completá N° de bobina, sección y metros', { err: true }); return false; }
        const old = rb && rb.codigo;
        Object.assign(b, { cat: usada ? b.cat : g('cat'), fecha: g('fecha'), remito: g('remito'), nro: g('nro'), seccion: g('seccion'), entrada: Number(g('entrada')), codigo: g('codigo'), obs: g('obs') });
        if (old && b.codigo && old !== b.codigo) S.circuitos.forEach((c) => { if (c.cat === b.cat) Object.values(c.real || {}).forEach((r) => { if (r.bobina === old) r.bobina = b.codigo; }); });
        return 'ok';
      }]],
    });
    if (res === 'del') {
      if (usada) { toast('No se puede eliminar: tiene tendidos registrados', { err: true }); return; }
      if (await confirmar('Eliminar bobina', `¿Eliminar la bobina ${esc(b.nro)}?`, 'Eliminar')) { S.bobinas = S.bobinas.filter((x) => x !== b); commit('Bobina eliminada'); }
    } else if (res === 'ok') {
      if (nuevo) {
        b._o = Date.now();
        if (!b.codigo) { // código fijo desde el alta, para que sea el mismo en todas las PCs
          const sec = Engine.parseSeccion(b.seccion), usados = new Set(R.bobinas.filter((x) => x.cat === b.cat).map((x) => x.codigo));
          let n = R.bobinas.filter((x) => x.cat === b.cat && x.seccion === sec).length + 1; while (usados.has(`${n}/${sec}`)) n++;
          b.codigo = `${n}/${sec}`;
        }
        S.bobinas.push(b);
      }
      commit('Bobina guardada');
    }
  }

  // ======================= AJUSTES =======================
  function vAjustes(el) {
    actions([['Abrir proyecto', 'btn', abrir], ['Guardar copia', 'btn pri', guardarComo]]);
    const p = S.params;
    el.innerHTML = `<div class="grid g2 stagger"><div class="card"><h3>Parámetros del cálculo</h3><div class="form">
      <label>Margen por corte (m por conductor)<input type="number" step="0.1" min="0" id="pM" value="${p.margen}"></label>
      <label>Remanente mínimo útil (m)<input type="number" step="1" min="0" id="pU" value="${p.minUtil}"></label>
      <label>Cola no utilizable por bobina (m)<input type="number" step="1" min="0" id="pC" value="${p.cola}"></label></div>
      <h4 style="margin:16px 0 6px">Corrección de largo por tipo (%)</h4>
      <div class="form">${['BT', 'MT', 'PAT'].map((k) => { const rs = R.resumen.filter((r) => r.cat === k && r.tendidoTeo > 0); const teo = rs.reduce((a, r) => a + r.tendidoTeo, 0), dv = rs.reduce((a, r) => a + r.desvio, 0);
        const sug = teo > 0 ? Math.round((dv / teo) * 1000) / 10 : null;
        return `<label>${CATN[k]}<input type="number" step="0.1" class="pAj" data-k="${k}" value="${(p.ajuste || {})[k] || 0}"><span class="muted" style="font-weight:400">${sug != null ? `Según lo tendido: ${sug > 0 ? '+' : ''}${fmt(sug, 1)} % (${fmt(teo)} m) <a href="#" class="useSug" data-k="${k}" data-v="${sug}">usar</a>` : 'Sin tendidos para sugerir'}</span></label>`; }).join('')}</div>
      <p class="hint">Si en campo sobra cable al tirar lo que dice la lista, poné un % negativo (por ejemplo −2 %): se corrigen todos los largos a cortar de ese tipo y el plan se recalcula. Para un circuito puntual, usá "Bobina / largo" en Circuitos. El margen por corte se suma a cada conductor solo si querés tolerancia extra.</p></div>
      <div class="card"><h3>Proyecto</h3><div class="form"><label class="full">Nombre<input type="text" id="pN" value="${esc(S.nombre)}"></label></div>
      <p class="hint">${esc(S.fuente || '')}</p><p class="hint">Los cambios se guardan solos en esta PC con un respaldo diario (se conservan 30). "Guardar copia" genera un archivo .obra para otra computadora.</p>
      <p class="hint" id="pInfo"></p><div style="display:flex;gap:8px;margin-top:10px"><button class="btn" id="pOpenData">Abrir carpeta de datos</button><button class="btn danger" id="pReset">Restaurar datos iniciales</button></div></div>
      <div class="card" id="netCard"><h3>Trabajo en red</h3><div class="muted">Cargando…</div></div>
      <div class="card" id="webCard"><h3>Publicar en la web</h3><div class="muted">Cargando…</div></div>
      <div class="card"><h3>Cómo arma el plan</h3><ol style="margin:0;padding-left:18px;line-height:1.6">
      <li>Los cortes registrados se descuentan de su bobina y no se tocan.</li>
      <li>Las bobinas <b>elegidas a mano</b> ("Bobina / largo", marcadas con <i class="pin">●</i>) se respetan siempre; al elegir una, el resto del plan de ese tipo se recalcula completo.</li>
      <li><b>Primero</b> se asignan los circuitos con zanja abierta (o ya empezados): conductores más largos primero, cada uno a la bobina del mismo tipo y sección con el menor saldo que alcance. Así se consumen los remanentes y se abren pocas bobinas.</li>
      <li><b>Después</b> se arma el plan provisorio del resto.</li>
      <li>Una pasada de <b>mejora</b> mueve e intercambia los cortes no comprometidos entre bobinas, sin abrir bobinas de más, para dejar las bobinas terminadas y el sobrante concentrado en remanentes grandes.</li>
      <li>Los cortes que ya figuran como <b>listos</b> quedan comprometidos a su bobina: al abrirse nuevas zanjas no cambian, salvo que ya no entren o uses "Replanificar".</li></ol></div></div>`;
    const setP = (k) => (e) => { S.params[k] = Math.max(0, Number(e.target.value) || 0); commit('Parámetros actualizados'); };
    $('#pM').onchange = setP('margen'); $('#pU').onchange = setP('minUtil'); $('#pC').onchange = setP('cola');
    const setAj = (k, v) => { S.params.ajuste = Object.assign({}, S.params.ajuste || {}); S.params.ajuste[k] = Math.max(-30, Math.min(30, Number(v) || 0)); recalcularTodo(k); commit(`Corrección ${CATN[k]}: ${fmt(S.params.ajuste[k], 1)} % · plan recalculado`); };
    $$('.pAj', el).forEach((i) => { i.onchange = () => setAj(i.dataset.k, i.value); });
    $$('.useSug', el).forEach((a) => { a.onclick = (e) => { e.preventDefault(); setAj(a.dataset.k, a.dataset.v); }; });
    $('#pN').onchange = (e) => { S.nombre = e.target.value.trim() || 'Obra'; window.api.netObra(S.nombre); commit(); };
    window.api.info().then((i) => { $('#pInfo') && ($('#pInfo').textContent = `Versión ${i.version} · datos en ${i.userData}`); $('#pOpenData') && ($('#pOpenData').onclick = () => window.api.openPath(i.userData)); });
    renderNet(); renderWeb();
    $('#pReset').onclick = async () => {
      if (await confirmar('Restaurar datos iniciales', 'Se reemplazan bobinas, circuitos y tendidos por los datos con que vino el programa. El estado actual queda en el respaldo del día.', 'Restaurar')) {
        const keep = S.__sync; S = normalizar(JSON.parse(await window.api.seed())); S.__sync = keep; commit('Datos iniciales restaurados');
      }
    };
  }

  // ======================= red =======================
  function netLine() {
    const el = $('#netState'); if (!el) return;
    if (NET.modo === 'local') { el.textContent = ''; el.className = ''; return; }
    el.className = 'net ' + (netStatus.ok ? 'ok' : netStatus.ok === false ? 'bad' : '');
    el.textContent = NET.modo === 'servidor' ? `Red: servidor${netStatus.msg ? ' · ' + netStatus.msg : ''}` : !Sync.meta(S).srvId ? 'Red: sin conectar (Ajustes)' : `Red: ${netStatus.ok ? 'conectado a ' + NET.ip : netStatus.msg || 'conectando…'}`;
  }
  async function renderNet() {
    const box = $('#netCard'); if (!box) return;
    NET = await window.api.netCfg();
    const m = NET.modo;
    let h = `<h3>Trabajo en red</h3><div class="seg" id="nMode"><button data-v="local">Solo esta PC</button><button data-v="servidor">Servidor</button><button data-v="cliente">Cliente</button></div>`;
    if (m === 'local') h += `<p class="hint">Los datos quedan solo en esta PC. Para trabajar entre varias PCs de la misma red, elegí una como <b>Servidor</b> (la que más tiempo esté encendida) y en las demás <b>Cliente</b>.</p>`;
    if (m === 'servidor') {
      const cl = await window.api.netClientes();
      h += `<div class="netbox"><div><span class="muted">Dirección para los clientes</span><b class="mono big">${NET.ips.length ? NET.ips.map((i) => esc(i)).join('<br>') : 'sin red'}</b><span class="muted">puerto ${NET.puerto}</span></div>
        <div><span class="muted">Clave de la obra</span><b class="mono big">${esc(NET.clave)}</b><button class="btn sm ghost" id="nNewKey">Cambiar clave</button></div></div>
        ${NET.error ? `<div class="alert error">${esc(NET.error)}</div>` : NET.escuchando ? '<div class="alert ok">Esperando clientes. Si Windows pregunta por el firewall, permití el acceso en redes privadas.</div>' : ''}
        <h4 style="margin:12px 0 6px">PCs conectadas</h4>${cl.length ? cl.map((c) => `<div class="phase-row" style="grid-template-columns:1fr auto"><span><b>${esc(c.nombre)}</b> <span class="muted">${esc(c.ip)}</span></span><span class="pill p-ok">en línea</span></div>`).join('') : '<p class="hint">Ninguna por ahora.</p>'}
        <p class="hint">Esta PC (${esc(NET.hostname)}) guarda la versión común. El programa tiene que estar abierto para que los clientes sincronicen; si está cerrado, ellos siguen trabajando y se ponen al día cuando vuelve.</p>`;
    }
    const found = await window.api.netServidores();
    const y0 = Sync.meta(S);
    if (m !== 'servidor') {
      h += `<h4 style="margin:14px 0 6px">Servidores encontrados en la red</h4>` + (found.length ? found.map((f) => `<div class="phase-row srvrow" style="grid-template-columns:1fr auto">
        <span><b>${esc(f.obra || 'Obra')}</b> <span class="muted">· ${esc(f.host)} · ${esc(f.ip)}</span></span>
        ${m === 'cliente' && y0.srvId === f.srvId && netStatus.ok ? '<span class="pill p-ok">conectado</span>' : `<button class="btn sm pri" data-srv="${esc(f.srvId)}">Conectar</button>`}</div>`).join('')
        : `<p class="hint"><span class="spin"></span> Buscando… Si no aparece, revisá que el servidor tenga el programa abierto y que estén en la misma red, o conectá por IP.</p>`);
    }
    if (m === 'cliente') {
      h += `<details class="manual" ${netStatus.ok === false && !found.length ? 'open' : ''}><summary>Conectar por IP</summary><div class="form" style="margin-top:12px"><label>IP del servidor<input type="text" id="nIp" value="${esc(NET.ip || '')}" placeholder="192.168.0.10"></label>
        <label>Clave de la obra<input type="text" id="nKey" value="${S.__sync && S.__sync.srvId ? esc(NET.clave) : ''}" placeholder="la que muestra el servidor"></label>
        <label>Puerto<input type="number" id="nPort" value="${NET.puerto}"></label><label>&nbsp;<button class="btn pri" id="nConn">${S.__sync && S.__sync.srvId ? 'Reconectar' : 'Conectar'}</button></label></div></details>
        <div class="alert ${netStatus.ok ? 'ok' : netStatus.ok === false ? 'error' : 'info'}" style="margin-top:10px">${netStatus.ok ? `Conectado a ${esc(NET.ip)} · última sincronización ${esc(netStatus.cuando || '')}` : esc(netStatus.msg || 'Sin conectar')}</div>
        <p class="hint">Esta PC guarda sus propios datos y puede trabajar sin conexión: los cambios se envían solos al volver la red. Si dos PCs cambian lo mismo, queda el cambio más reciente.</p>
        <div style="display:flex;gap:8px"><button class="btn" id="nNow">Sincronizar ahora</button></div>`;
    }
    box.innerHTML = h;
    segBind('#nMode', m, async (v) => {
      if (v === m) return;
      if (v === 'servidor' && !(await confirmar('Usar esta PC como servidor', 'Esta PC va a guardar la versión común de la obra y las demás se van a conectar a ella. Tiene que estar en la misma red y con el programa abierto.', 'Activar'))) return;
      NET = await window.api.netSetCfg({ modo: v });
      if (v === 'servidor') { Sync.prepararServidor(S); await window.api.save(JSON.stringify(S)); }
      netStatus = { ok: null, msg: '' }; netLine(); renderNet(); arrancarRed();
    });
    if (m === 'servidor') $('#nNewKey').onclick = async () => {
      if (!(await confirmar('Cambiar clave', 'Las PCs conectadas van a tener que cargar la clave nueva.', 'Cambiar'))) return;
      NET = await window.api.netSetCfg({ clave: Math.random().toString(36).slice(2, 8).toUpperCase() }); renderNet();
    };
    $$('[data-srv]', box).forEach((b) => { b.onclick = () => conectarEncontrado(found.find((f) => f.srvId === b.dataset.srv)); });
    clearTimeout(renderNet.t); renderNet.t = setTimeout(() => { if (view === 'ajustes' && $('#netCard') && !$('#netCard').contains(document.activeElement)) renderNet(); }, 3000);
    if (m === 'cliente') {
      $('#nConn').onclick = () => conectar($('#nIp').value.trim(), Number($('#nPort').value) || 47821, $('#nKey').value.trim());
      $('#nNow').onclick = () => syncNow(true);
    }
  }
  async function conectarEncontrado(f) {
    if (!f) return;
    const clave = await modal({ title: `Conectar con ${esc(f.obra || f.host)}`, sub: `Servidor ${esc(f.host)} · ${esc(f.ip)}`,
      body: `<div class="form"><label class="full">Clave de la obra<input type="text" name="clave" placeholder="la que muestra el servidor en Ajustes" autocomplete="off" style="text-transform:uppercase;font-size:18px;letter-spacing:2px"></label></div>
        <p class="hint">La clave figura en la PC servidor, en Ajustes → Trabajo en red.</p>`,
      buttons: [['Cancelar', 'btn', () => null], ['Conectar', 'btn pri', (box) => $('[name=clave]', box).value.trim() || false]] });
    if (!clave) return;
    if (NET.modo !== 'cliente') NET = await window.api.netSetCfg({ modo: 'cliente' });
    await conectar(f.ip, f.puerto || 47821, clave);
    renderNet();
  }
  async function conectar(ip, puerto, clave) {
    if (!ip || !clave) { toast('Cargá la IP y la clave que muestra el servidor', { err: true }); return; }
    const probe = await window.api.netSync(ip, puerto, { dev: NET.devId, clave, now: Date.now(), since: 0, cambios: [] });
    if (!probe.ok) { netStatus = { ok: false, msg: probe.error }; netLine(); renderNet(); toast(probe.error === 'Clave incorrecta' ? 'Clave incorrecta: revisala en la PC servidor' : probe.error, { err: true, ms: 5000 }); return; }
    NET = await window.api.netSetCfg({ ip, puerto, clave });
    const y = Sync.meta(S);
    if (y.srvId !== probe.res.srvId) {
      const op = await modal({ title: `Conectar con ${esc(probe.res.host || ip)}`,
        body: `<p>¿Qué hacemos con los datos de esta PC?</p>
          <div class="phase-row" style="grid-template-columns:1fr"><b>Usar los datos del servidor (recomendado)</b><span class="muted">Esta PC toma la obra tal como está en el servidor. Lo cargado solo acá se reemplaza (queda en el respaldo del día).</span></div>
          <div class="phase-row" style="grid-template-columns:1fr"><b>Combinar con los míos</b><span class="muted">Se envía todo lo de esta PC al servidor. Donde haya diferencias, queda lo de esta PC.</span></div>`,
        buttons: [['Cancelar', 'btn', () => null], ['Combinar con los míos', 'btn', () => 'mix'], ['Usar los del servidor', 'btn pri', () => 'srv']] });
      if (!op) return;
      if (op === 'srv') Sync.reemplazarPorServidor(S); else Sync.marcarTodoPendiente(S);
      Sync.meta(S).srvId = probe.res.srvId;
      Sync.meta(S).peerRev = 0;
    }
    await syncNow(true);
    arrancarRed();
  }
  function programarSync(ms) { clearTimeout(syncTimer); syncTimer = setTimeout(() => syncNow(false), ms); }
  async function syncNow(manual) {
    if (NET.modo !== 'cliente' || !NET.ip || syncBusy) return;
    const y = Sync.meta(S);
    if (!y.srvId) { netStatus = { ok: false, msg: 'Falta conectar (Ajustes → Trabajo en red)' }; netLine(); return; }
    syncBusy = true;
    try {
      const { body, enviados } = Sync.paquete(S, NET), t0 = Date.now();
      const r = await window.api.netSync(NET.ip, NET.puerto, body);
      if (!r.ok) {
        // ¿el servidor cambió de IP? buscarlo por su identificador entre los encontrados
        const f = (await window.api.netServidores()).find((x) => x.srvId === y.srvId && x.ip !== NET.ip);
        if (f) { NET = await window.api.netSetCfg({ ip: f.ip, puerto: f.puerto || NET.puerto }); netStatus = { ok: null, msg: `El servidor ahora está en ${f.ip}` }; syncBusy = false; programarSync(200); return; }
        netStatus = { ok: false, msg: r.error }; if (manual) toast(r.error, { err: true }); return;
      }
      if (r.res.srvId !== y.srvId) { netStatus = { ok: false, msg: 'El servidor cambió: volvé a conectar' }; return; }
      const n = Sync.recibir(S, r.res, enviados, t0);
      const viejo = !(Number(r.res.proto) >= Sync.PROTO);
      if (viejo && !avisoViejo) { avisoViejo = true; toast('El servidor tiene una versión anterior del programa: actualizalo. Hasta entonces las fundaciones STS no se sincronizan (quedan guardadas en esta PC).', { err: true, ms: 12000 }); }
      netStatus = { ok: true, msg: viejo ? 'servidor con versión anterior: actualizalo' : '', cuando: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) };
      if (n || Object.keys(enviados).length) {
        S = normalizarRed(S);
        commitRed(n ? `${n} cambios recibidos de la red` : '');
      }
      if (manual) toast('Sincronizado');
    } finally { syncBusy = false; netLine(); if (view === 'ajustes') renderNet(); }
  }
  function normalizarRed(st) { Engine.sincronizarPAT(st); Sync.ordenar(st); return st; }
  function commitRed(msg) {
    // recalcula y guarda sin interrumpir lo que el usuario está editando
    const modalAbierto = !$('#modal').classList.contains('hidden');
    R = Engine.calcular(S); S.compromiso = R.compromiso;
    const n = Sync.sellar(S, NET.modo);
    if (NET.modo === 'cliente' && n) programarSync(800);
    if (n) programarWeb();
    window.api.save(JSON.stringify(S));
    if (!modalAbierto) render(false);
    if (msg && !modalAbierto) toast(msg, { ms: 2500 });
  }
  let redTimer = null;
  function arrancarRed() {
    clearInterval(redTimer);
    netLine();
    if (NET.modo === 'cliente') { redTimer = setInterval(() => syncNow(false), 3000); syncNow(false); }
    if (NET.modo === 'servidor') redTimer = setInterval(async () => { const cl = await window.api.netClientes(); netStatus = { ok: true, msg: `${cl.length} PC${cl.length === 1 ? '' : 's'} conectada${cl.length === 1 ? '' : 's'}` }; netLine(); }, 4000);
  }
  const viejos = new Set(); let avisoViejo = false;
  function atenderRed({ id, body }) {
    try {
      if (NET.modo !== 'servidor') { window.api.netReply(id, { error: 'no es servidor' }); return; }
      const { aplicados } = Sync.atender(S, body);
      if (aplicados) { S = normalizarRed(S); commitRed(`${aplicados} cambios recibidos de ${body.nombre || 'otra PC'}`); }
      window.api.netReply(id, Sync.respuesta(S, Number(body.since) || 0, body.proto));
      if (!(Number(body.proto) >= Sync.PROTO) && !viejos.has(body.dev)) { viejos.add(body.dev); toast(`La PC ${body.nombre || body.dev || ''} tiene una versión anterior del programa: actualizala. Hasta entonces no recibe ni puede borrar las fundaciones STS.`, { err: true, ms: 12000 }); }
    } catch (e) { window.api.netReply(id, { error: String(e.message || e) }); }
  }

  // ======================= publicación web =======================
  const webListo = () => WEB && WEB.owner && WEB.repo && WEB.tieneToken && (WEB.usuarios || []).length;
  const webUrl = () => (WEB && WEB.owner && WEB.repo ? `https://${WEB.owner.toLowerCase()}.github.io/${WEB.repo}/` : '');
  function programarWeb() {
    if (window.READONLY || !webListo() || WEB.auto === false) return;
    clearTimeout(webTimer); webTimer = setTimeout(() => publicarWeb(false), 90000);
  }
  async function publicarWeb(manual) {
    clearTimeout(webTimer);
    const json = JSON.stringify(S, (k, v) => (k === '__sync' ? undefined : v));
    const r = await window.api.webPublicar(json);
    WEB = await window.api.webCfg();
    if (manual) toast(r.ok ? 'Datos publicados en la web' : 'No se pudo publicar: ' + r.error, { err: !r.ok, ms: 6000 });
    if (view === 'ajustes') renderWeb();
    return r;
  }
  async function renderWeb() {
    const box = $('#webCard'); if (!box) return;
    WEB = await window.api.webCfg();
    const us = WEB.usuarios || [];
    box.innerHTML = `<h3>Publicar en la web</h3>
      <p class="hint" style="margin-top:0">Publica una copia <b>cifrada</b> de la obra en un sitio web (GitHub Pages) para verla desde cualquier lugar, en modo solo lectura, con usuario y contraseña. Conviene configurarlo solo en la PC servidor.</p>
      ${webUrl() ? `<div class="alert ${WEB.error ? 'error' : WEB.ultimo ? 'ok' : 'info'}">${WEB.error ? 'Error al publicar: ' + esc(WEB.error) : WEB.ultimo ? 'Última publicación: ' + new Date(WEB.ultimo).toLocaleString('es-AR') : 'Todavía no se publicó en esta sesión'}
        <br>Dirección del visor: <a href="#" id="wUrl">${esc(webUrl())}</a></div>` : ''}
      <div class="form" style="margin-top:10px"><label>Usuario u organización de GitHub<input type="text" id="wOwner" value="${esc(WEB.owner || '')}" placeholder="ej. ingalfa-obras"></label>
        <label>Repositorio<input type="text" id="wRepo" value="${esc(WEB.repo || '')}" placeholder="ej. obera-ii"></label>
        <label class="full">Token de acceso de GitHub<input type="password" id="wTok" value="${esc(WEB.token || '')}" placeholder="github_pat_…"></label></div>
      <h4 style="margin:14px 0 6px">Usuarios del visor</h4>
      <div id="wUs">${us.map((u) => `<div class="phase-row wu" style="grid-template-columns:1fr 1fr auto auto"><input type="text" class="wn" value="${esc(u.nombre)}" readonly><input type="password" class="wp" placeholder="(sin cambios)"><label class="chkl wed" title="Puede enviar cronogramas actualizados desde el visor"><input type="checkbox" class="we" ${u.editor ? 'checked' : ''}> Editor</label><button class="btn sm ghost danger wx">Quitar</button></div>`).join('')}</div>
      <button class="btn sm" id="wAdd" style="margin-top:6px">+ Usuario</button>
      <label style="display:flex;gap:8px;align-items:center;margin-top:12px;font-size:13px"><input type="checkbox" id="wAuto" ${WEB.auto !== false ? 'checked' : ''}> Publicar automáticamente cuando haya cambios (como máximo cada 90 segundos)</label>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn pri" id="wSave">Guardar</button><button class="btn" id="wViz">Instalar / actualizar visor</button><button class="btn acc" id="wPub" ${webListo() ? '' : 'disabled'}>Publicar ahora</button></div>
      <details class="manual"><summary>Cómo se configura (una sola vez)</summary><ol style="line-height:1.6;padding-left:18px;font-size:12.5px">
        <li>Crear una cuenta en github.com (gratis) y un repositorio <b>público</b> nuevo, por ejemplo "obera-ii", marcando "Add a README".</li>
        <li>En GitHub: <i>Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token</i>. Elegir solo ese repositorio y dar permiso <b>Contents: Read and write</b> y <b>Pages: Read and write</b>. Copiar el token.</li>
        <li>Acá: cargar usuario de GitHub, repositorio y token, agregar los usuarios del visor con su contraseña (mínimo 8 caracteres) y tocar <b>Guardar</b>.</li>
        <li><b>Editor</b>: ese usuario puede enviar desde el visor un cronograma actualizado de MS Project (.mpp o .xml). Llega cifrado a esta PC, que lo aplica sola cada 2 minutos mientras el programa esté abierto. Los editores reciben el token de GitHub cifrado con su contraseña: marcá solo a personas de confianza.</li>
        <li>Tocar <b>Instalar / actualizar visor</b> y después <b>Publicar ahora</b>. Si GitHub Pages no se activa solo: en el repositorio, <i>Settings → Pages → Deploy from a branch → main / (root)</i>.</li>
        <li>Pasar la dirección del visor y a cada persona su usuario y contraseña. La primera publicación tarda 1 a 2 minutos en aparecer.</li></ol>
        <p class="hint">Los datos viajan y quedan guardados cifrados (AES-256); sin usuario y contraseña no se pueden leer. Para quitarle el acceso a alguien, se lo quita de la lista: desde la próxima publicación ya no puede abrir los datos.</p></details>`;
    const fila = () => `<div class="phase-row wu" style="grid-template-columns:1fr 1fr auto auto"><input type="text" class="wn" placeholder="usuario (ej. Juan Pérez)"><input type="password" class="wp" placeholder="contraseña"><label class="chkl wed" title="Puede enviar cronogramas actualizados desde el visor"><input type="checkbox" class="we"> Editor</label><button class="btn sm ghost danger wx">Quitar</button></div>`;
    $('#wAdd').onclick = () => { $('#wUs').insertAdjacentHTML('beforeend', fila()); bindX(); };
    const bindX = () => $$('.wx', box).forEach((b) => { b.onclick = () => b.closest('.wu').remove(); });
    bindX();
    if ($('#wUrl')) $('#wUrl').onclick = (e) => { e.preventDefault(); window.api.openUrl(webUrl()); };
    $('#wSave').onclick = async () => {
      const usuarios = $$('.wu', box).map((r) => ({ nombre: $('.wn', r).value.trim(), password: $('.wp', r).value, editor: $('.we', r).checked }));
      const nuevosSinClave = usuarios.filter((u) => u.nombre && !u.password && !us.some((x) => x.nombre.toLowerCase() === u.nombre.toLowerCase()));
      if (nuevosSinClave.length) { toast(`Falta la contraseña de ${nuevosSinClave.map((u) => u.nombre).join(', ')}`, { err: true }); return; }
      if (usuarios.some((u) => u.password && u.password.length < 8)) { toast('Las contraseñas deben tener al menos 8 caracteres', { err: true }); return; }
      const nombres = usuarios.filter((u) => u.nombre).map((u) => u.nombre.toLowerCase());
      if (new Set(nombres).size !== nombres.length) { toast('Hay usuarios repetidos', { err: true }); return; }
      $('#wSave').disabled = true; $('#wSave').textContent = 'Guardando…';
      await window.api.webSetCfg({ owner: $('#wOwner').value, repo: $('#wRepo').value, token: $('#wTok').value, auto: $('#wAuto').checked, usuarios });
      toast('Configuración guardada'); renderWeb();
    };
    $('#wViz').onclick = async () => {
      $('#wViz').disabled = true; $('#wViz').textContent = 'Subiendo visor…';
      const r = await window.api.webInstalarVisor();
      if (r.ok) toast(r.archivos ? `Visor actualizado (${r.archivos} archivos)${r.pages === 'activado' ? ' · GitHub Pages activado' : ''}. Los cambios se ven en la página en 1 o 2 minutos.` : 'El visor ya estaba actualizado', { ms: 8000 });
      else toast('No se pudo instalar el visor: ' + r.error, { err: true, ms: 8000 });
      renderWeb();
    };
    $('#wPub').onclick = async () => { $('#wPub').disabled = true; $('#wPub').textContent = 'Publicando…'; await publicarWeb(true); };
  }

  // ======================= archivos =======================
  async function abrir() {
    const r = await window.api.open(); if (!r) return;
    try { cargarTexto(r.text); toast('Proyecto abierto'); } catch (e) { toast('No se pudo leer el archivo', { err: true }); }
  }
  function cargarTexto(text) {
    const st = JSON.parse(text);
    if (!st.circuitos || !st.bobinas) throw new Error('formato');
    const keep = S && S.__sync;
    delete st.__sync;
    S = normalizar(st); if (keep) S.__sync = keep; commit(); go(view);
  }
  async function guardarComo() {
    const p = await window.api.saveAs(JSON.stringify(S, (k, v) => (k === '__sync' ? undefined : v), 1), (S.nombre || 'obra').replace(/[\\/:*?"<>|]/g, '') + '.obra');
    if (p) toast('Copia guardada', { action: ['Ver', () => window.api.showItem(p)] });
  }
  async function exportExcel() {
    const p = await window.api.saveBinary(IO.exportPlan(S, R), `Plan de cables ${today()}.xlsx`, 'xlsx', 'Excel');
    if (p) toast('Excel exportado', { action: ['Abrir', () => window.api.openPath(p)] });
  }
  const detectCat = (txt, def) => { const t = String(txt || '').toLowerCase(); if (/desn|cu\s*desn|cobre/.test(t)) return 'PAT'; if (/\/\s*\d+/.test(t) || /33\s*kv/.test(t)) return 'MT'; return def || 'BT'; };
  async function importExcel(ctxCat) {
    if (window.READONLY) return;
    const f = await window.api.pickExcel(); if (!f) return;
    let d;
    try { d = IO.readWorkbook(new Uint8Array(f.data)); } catch (e) { toast('No se pudo leer el Excel', { err: true }); return; }
    const found = ['bobinas', 'circuitos'].filter((k) => d[k] && d[k].length);
    if (!found.length) { toast('No encontré bobinas ni circuitos en ese archivo', { err: true }); return; }
    const res = await modal({
      title: 'Importar Excel', sub: esc(f.path.split(/[\\/]/).pop()),
      body: `<p>Encontré: ${found.map((k) => `<b>${d[k].length}</b> ${k}`).join(' y ')}.</p>
        <div class="form"><label class="full">Tipo de cable<select name="cat"><option value="auto">Detectar por la sección (Cu desnudo → PAT, 1x50/25 → MT, resto → BT)</option>${Object.keys(CATS).map((k) => `<option value="${k}" ${ctxCat === k ? 'selected' : ''}>Todo como ${CATN[k]}</option>`).join('')}</select></label></div>
        <p class="hint">Lo que ya existe se actualiza (bobinas por N° de fabricante y tipo, circuitos por designación + desde) y lo nuevo se agrega. No se borra nada ni se tocan los tendidos.</p>`,
      buttons: [['Cancelar', 'btn', () => null], ['Importar', 'btn pri', (box) => $('[name=cat]', box).value]],
    });
    if (!res) return;
    const log = [];
    if (d.bobinas) {
      let a = 0, u = 0;
      d.bobinas.forEach((nb) => {
        nb.cat = res === 'auto' ? detectCat(nb.seccion, ctxCat) : res;
        const ex = S.bobinas.find((b) => String(b.nro) === String(nb.nro) && b.cat === nb.cat);
        if (ex) { Object.assign(ex, nb, { codigo: nb.codigo || ex.codigo, obs: nb.obs || ex.obs }); u++; } else { S.bobinas.push(Object.assign({ id: uid('b'), _o: Date.now() + a }, nb)); a++; }
      });
      log.push(`bobinas: ${a} nuevas, ${u} actualizadas`);
    }
    if (d.circuitos) {
      let a = 0, u = 0;
      d.circuitos.forEach((nc) => {
        nc.cat = res === 'auto' ? detectCat(nc.formacion, ctxCat) : res;
        if (nc.cat === 'PAT') return;
        const ex = S.circuitos.find((c) => !c.vinculo && c.designacion === nc.designacion && c.desde === nc.desde);
        if (ex) { Object.assign(ex, nc, { lineal: nc.lineal ?? ex.lineal }); u++; }
        else { S.circuitos.push(Object.assign({ id: uid('c'), real: {}, zanja: 'no abierta', _o: Date.now() + a }, nc)); a++; }
      });
      log.push(`circuitos: ${a} nuevos, ${u} actualizados`);
    }
    commit('Importado · ' + log.join(' · '));
  }

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
    const dia = (d) => { if (!dias.has(d)) dias.set(d, { fecha: d, m: { BT: 0, MT: 0, PAT: 0 }, sec: new Map(), circ: new Map(), puntas: [], zanjas: [], fund: [], nCond: 0, bobinas: new Set() }); return dias.get(d); };
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
    dias.forEach((D) => { D.total = D.m.BT + D.m.MT + D.m.PAT; D.nPuntas = D.puntas.reduce((a, x) => a + x.n, 0); });
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
        <span class="dots">${['BT', 'MT', 'PAT'].filter((c) => D && D.m[c] > 0).map((c) => `<i class="c-${c}"></i>`).join('')}${D && D.nPuntas ? '<i class="c-pt"></i>' : ''}${D && D.fund.length ? '<i class="c-fd"></i>' : ''}</span></button>`;
    }
    cal += '</div>';
    const mesTot = delMes.reduce((a, D) => a + D.total, 0), mesDias = delMes.filter((D) => D.total > 0).length;
    const mejor = delMes.reduce((a, D) => (!a || D.total > a.total ? D : a), null);
    cal += `<div class="legend" style="margin-top:10px">${['BT', 'MT', 'PAT'].map((c) => `<span><i class="c-${c}"></i>${c}</span>`).join('')}<span><i class="c-pt"></i>Puntas</span><span><i class="c-fd"></i>Fundaciones</span></div>
      <div class="kpis" style="grid-template-columns:1fr 1fr;margin-top:14px">${kpi('Tendido en el mes', mesTot)}${kpi('Días con tendido', mesDias, '')}${kpi('Promedio por día', mesDias ? mesTot / mesDias : 0)}${kpi('Mejor día', mejor ? mejor.total : 0, mejor ? `m · ${new Date(mejor.fecha + 'T12:00:00').getDate()}/${m + 1}` : 'm')}</div>
      ${sinFecha ? `<p class="hint">${fmt(sinFecha)} m tendidos no tienen fecha cargada y no figuran en el calendario.</p>` : ''}`;
    // detalle del día
    const D = dias.get(ui.dia);
    let det = `<h3>${fechaLarga(ui.dia)}</h3>`;
    det += diaHTML(D);
    // columnas del mes
    const colsData = [];
    for (let d = 1; d <= nd; d++) { const k = `${ym}-${String(d).padStart(2, '0')}`, X = dias.get(k); colsData.push({ key: k, label: String(d), sel: k === ui.dia, tip: fechaCorta(k), parts: ['BT', 'MT', 'PAT'].map((c) => ({ v: X ? X.m[c] : 0, color: SERIE[c], name: CATN[c] })) }); }
    el.innerHTML = `<div class="diario"><div class="card calcard">${cal}</div><div class="card daycard">${det}</div></div>
      <div class="card" style="margin-top:16px"><h3>Metros tendidos por día · ${MESES[m]} ${y}</h3>${Charts.cols(colsData)}${Charts.legend(['BT', 'MT', 'PAT'].map((c) => [SERIE[c], CATN[c]]))}</div>`;
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
    const circ = [...D.circ.values()].sort((a, b) => (a.c.cat === b.c.cat ? a.c.idx - b.c.idx : ['BT', 'MT', 'PAT'].indexOf(a.c.cat) - ['BT', 'MT', 'PAT'].indexOf(b.c.cat)));
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
    const cs = R.circuitos.filter((c) => c.cat !== 'PAT');
    // tarjetas por sección
    const keys = [...new Set(cs.map((c) => `${c.cat}|${c.seccion}`))].sort((a, b) => (a[0] === b[0] ? Number(b.split('|')[1]) - Number(a.split('|')[1]) : a.localeCompare(b)));
    let h = `<div class="grid g4 stagger ptiles" style="margin-bottom:16px">${keys.map((k) => {
      const [c2, s2] = k.split('|'); const g = cs.filter((c) => `${c.cat}|${c.seccion}` === k).map(puntasDe); const tot = g.reduce((a, x) => a + x.tot, 0), col = g.reduce((a, x) => a + x.col, 0);
      return `<div class="card tile"><div>${Charts.ring(tot ? col / tot : 0, SERIE[c2], 'colocadas')}</div><div><h3 style="margin-bottom:6px">${ctag(c2)}${c2} ${s2} mm²</h3>${kpi('Puntas', col, `/ ${fmt(tot)}`)}<div class="muted" style="margin-top:4px">${g.length} circuito${g.length > 1 ? 's' : ''} · ${g.reduce((a, x) => a + x.n, 0)} conductores</div></div></div>`;
    }).join('')}</div>`;
    h += `<div class="tools"><div class="seg" id="fPtC"><button data-v="BT">BT 0,8 kV</button><button data-v="MT">MT 33 kV</button></div>
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
    document.body.classList.toggle('pr-land', !!landscape);
    document.documentElement.style.background = document.body.style.background = '#fff';
    const p = await window.api.printPDF(name, { landscape });
    document.documentElement.style.background = document.body.style.background = '';
    if (p) toast('PDF guardado', { action: ['Abrir', () => window.api.openPath(p)] });
  }
  const prHead = (t, sub) => `<div class="pr-h"><div><h1>${t}</h1>${esc(S.nombre)}${sub ? ' · ' + sub : ''}</div><div>PSFV-OBE II · ${new Date().toLocaleString('es-AR')}</div></div>`;
  function printDia(d) {
    const { dias } = datosPorFecha();
    printHTML(prHead(`Tendido del ${fechaLarga(d).replace(/^./, (x) => x.toLowerCase())}`) + `<div class="card">${diaHTML(dias.get(d), true)}</div>`, `Tendido ${d}.pdf`);
  }
  function printMes(ym) {
    const { dias } = datosPorFecha();
    const [y, m] = ym.split('-').map(Number), nd = new Date(y, m, 0).getDate();
    const ds = [...dias.values()].filter((D) => D.fecha.startsWith(ym)).sort((a, b) => a.fecha.localeCompare(b.fecha));
    const colsData = []; for (let d = 1; d <= nd; d++) { const k = `${ym}-${String(d).padStart(2, '0')}`, X = dias.get(k); colsData.push({ label: String(d), parts: ['BT', 'MT', 'PAT'].map((c) => ({ v: X ? X.m[c] : 0, color: SERIE[c], name: c })) }); }
    const t = (c) => ds.reduce((a, D) => a + D.m[c], 0), tot = t('BT') + t('MT') + t('PAT');
    let h = prHead(`Tendido de ${MESES[m - 1]} ${y}`);
    h += `<div class="card"><div class="kpis k4">${kpi('Total del mes', tot)}${kpi('BT', t('BT'))}${kpi('MT', t('MT'))}${kpi('PAT', t('PAT'))}</div>${Charts.cols(colsData, { h: 170 })}${Charts.legend(['BT', 'MT', 'PAT'].map((c) => [SERIE[c], CATN[c]]))}</div>`;
    h += `<div class="card prday"><h3>Resumen por día</h3><table class="tbl dtbl"><thead><tr><th>Fecha</th><th class="num">BT</th><th class="num">MT</th><th class="num">PAT</th><th class="num">Total</th><th class="num">Circuitos</th><th class="num">Puntas</th><th>Zanjas cerradas</th></tr></thead><tbody>
      ${ds.map((D) => `<tr><td>${fechaCorta(D.fecha)}</td><td class="num">${fmt(D.m.BT)}</td><td class="num">${fmt(D.m.MT)}</td><td class="num">${fmt(D.m.PAT)}</td><td class="num"><b>${fmt(D.total)}</b></td><td class="num">${[...D.circ.values()].filter((o) => o.c.cat !== 'PAT').length}</td><td class="num">${D.nPuntas || ''}</td><td>${D.zanjas.length || ''}</td></tr>`).join('')}</tbody></table></div>`;
    ds.forEach((D) => { h += `<div class="card prday"><h3>${fechaLarga(D.fecha)}</h3>${diaHTML(D, true)}</div>`; });
    if (!ds.length) h += '<p>Sin tendidos registrados en el mes.</p>';
    printHTML(h, `Tendido ${ym}.pdf`);
  }
  function printAvance() {
    printHTML(prHead('Avance de obra · Tendido y aprovechamiento de cables') + $('#view').innerHTML, `Avance ${today()}.pdf`, true);
  }
  function printPuntas() {
    const cs = R.circuitos.filter((c) => c.cat !== 'PAT');
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

  // ======================= FUNDACIONES STS =======================
  const ETAPAS = [
    ['exc', 'Excavación'], ['encL', 'Armado de encofrado hormigón de limpieza'], ['hL', 'Carga de hormigón de limpieza'],
    ['hieP', 'Armado de estructura de hierro para platea'], ['encP', 'Armado de encofrado para platea'], ['hP', 'Carga de hormigón en platea'],
    ['hieT', 'Armado de estructura de tabiques'], ['encT', 'Armado de encofrado de tabiques'], ['hT', 'Carga de hormigón en tabiques'],
    ['frag', 'Fraguado general'], ['sts', 'Colocación de STS sobre base'],
  ];
  const ETN = Object.fromEntries(ETAPAS);
  const STSL = ['STS 1', 'STS 2', 'STS 3', 'STS 4'];
  const FCOL = { done: '#2f9e5b', curso: '#f5a524', pend: '#dfe5ec' };
  function fundInfo(sts) {
    const f = (S.fundaciones || {})[sts] || {};
    const done = ETAPAS.filter(([k]) => f[k] && f[k].ok).length;
    const curso = ETAPAS.filter(([k]) => f[k] && f[k].ini && !f[k].ok);
    const sig = ETAPAS.find(([k]) => !(f[k] && f[k].ok));
    const inis = ETAPAS.map(([k]) => f[k] && f[k].ini).filter(Boolean).sort();
    const fins = ETAPAS.map(([k]) => f[k] && f[k].ok && f[k].fin).filter(Boolean).sort();
    return { f, done, n: ETAPAS.length, p: done / ETAPAS.length, curso, sig, ini: inis[0] || '', fin: done === ETAPAS.length ? fins[fins.length - 1] || '' : '' };
  }
  // Silueta de estación de transformación tipo contenedor (STS) sobre su fundación, que se llena con el avance
  let svgN = 0;
  function stsSVG(p, opts = {}) {
    const id = 'stsc' + (++svgN), top = 30, bot = 132, y = bot - (bot - top) * Math.max(0, Math.min(1, p));
    const col = p >= 1 ? FCOL.done : '#00939a';
    const shape = `<rect x="26" y="30" width="248" height="8" rx="2"/><rect x="32" y="38" width="236" height="74"/><rect x="18" y="112" width="264" height="10" rx="1"/><rect x="24" y="122" width="14" height="10"/><rect x="143" y="122" width="14" height="10"/><rect x="262" y="122" width="14" height="10"/><rect x="12" y="131" width="276" height="3" rx="1"/>`;
    let det = '';
    [[38, 30], [70, 30], [208, 30], [238, 30]].forEach(([x, w]) => { det += `<rect x="${x}" y="46" width="${w - 4}" height="60" rx="1.5" class="sd"/><line x1="${x + w - 10}" y1="74" x2="${x + w - 10}" y2="80" class="sd"/>`; });
    for (let i = 0; i < 9; i++) det += `<line x1="${110 + i * 10}" y1="50" x2="${110 + i * 10}" y2="102" class="sd"/>`;
    det += `<rect x="104" y="46" width="94" height="60" rx="1.5" class="sd"/>`;
    [[44, 52], [214, 52]].forEach(([x, y2]) => { for (let i = 0; i < 3; i++) det += `<line x1="${x}" y1="${y2 + i * 4}" x2="${x + 14}" y2="${y2 + i * 4}" class="sd"/>`; });
    return `<svg class="stssvg" viewBox="0 0 300 140" role="img" aria-label="${fmt(p * 100)} %"><defs><clipPath id="${id}">${shape}</clipPath></defs>
      <g clip-path="url(#${id})"><rect x="0" y="0" width="300" height="140" class="ssh"/><rect x="0" y="${y.toFixed(1)}" width="300" height="${(140 - y).toFixed(1)}" fill="${col}" class="sfill" style="--y:${y.toFixed(1)}px"/></g>
      <g class="sdet">${det}</g><g class="sout">${shape}</g>
      <text x="150" y="${opts.small ? 86 : 84}" text-anchor="middle" class="spct ${p > 0.55 ? 'inv' : ''}">${fmt(p * 100)}%</text></svg>`;
  }
  function vFund(el) {
    actions([['Exportar Excel', 'btn', () => exportFund()], ['Exportar PDF', 'btn pri', () => printFund()]]);
    const inf = STSL.map((s) => [s, fundInfo(s)]);
    const tot = inf.reduce((a, [, i]) => a + i.done, 0) / (STSL.length * ETAPAS.length);
    let h = `<div class="grid g4 stagger fcards">${inf.map(([s, i]) => `<div class="card fcard"><div class="fch"><b>${s}</b><span class="pill ${i.done === i.n ? 'p-done' : i.done || i.curso.length ? 'p-warn' : 'p-prov'}">${i.done === i.n ? 'terminada' : i.done || i.curso.length ? 'en ejecución' : 'sin iniciar'}</span></div>
        ${stsSVG(i.p)}
        <div class="fcm"><span><b>${i.done}</b>/${i.n} etapas</span><span class="muted">${i.ini ? 'inicio ' + fechaCorta(i.ini) : 'sin iniciar'}</span></div>
        <div class="muted fcs">${i.done === i.n ? `Base terminada${i.fin ? ' el ' + fechaCorta(i.fin) : ''}` : i.curso.length ? 'En curso: ' + i.curso.map(([k]) => esc(ETN[k])).join(', ') : 'Próxima: ' + esc(i.sig[1])}</div></div>`).join('')}</div>
      <p class="hint" style="margin:6px 0 16px">Avance total de fundaciones: <b>${fmt(tot * 100, 1)} %</b>. Cada etapa terminada suma 1/${ETAPAS.length} de la base. La silueta es una estación de transformación tipo contenedor (Jupiter 6000K) sobre su platea.</p>`;
    // matriz
    h += `<div class="card tblcard"><div class="tblwrap"><table class="tbl ftbl"><thead><tr><th>#</th><th>Etapa</th>${STSL.map((s) => `<th class="fc">${s}</th>`).join('')}</tr></thead><tbody>`;
    ETAPAS.forEach(([k, n], idx) => {
      h += `<tr><td class="muted">${idx + 1}</td><td><b>${esc(n)}</b></td>${STSL.map((s) => {
        const v = (((S.fundaciones || {})[s]) || {})[k] || {};
        const est = v.ok ? 'ok' : v.ini ? 'cur' : '';
        const tit = `${v.ini ? 'Inicio ' + fechaCorta(v.ini) : ''}${v.ok && v.fin ? ' · fin ' + fechaCorta(v.fin) : ''}${v.obs ? ' · ' + esc(v.obs) : ''}`;
        const ro = window.READONLY;
        const cuerpo = v.ok ? `<button class="fdate" data-fd="${s}|${k}" title="${tit}"><i class="fic ok">✓</i>${fechaCorta(v.ini || v.fin).slice(0, 5)}<small>→ ${fechaCorta(v.fin).slice(0, 5)}</small></button>`
          : v.ini ? `<button class="fdate" data-fd="${s}|${k}" title="${tit}"><i class="fic cur">▶</i>${fechaCorta(v.ini).slice(0, 5)}</button>${ro ? '' : `<button class="ffin" data-ff="${s}|${k}" title="Marcar la actividad como finalizada">Finalizar</button>`}`
          : ro ? '<span class="muted">–</span>' : `<button class="fini" data-fi="${s}|${k}" title="Cargar la fecha de inicio">▶ Iniciar</button>`;
        return `<td class="fc"><div class="fcell ${est}">${cuerpo}</div></td>`;
      }).join('')}</tr>`;
    });
    h += `</tbody></table></div></div><p class="hint"><b>▶ Iniciar</b> carga la fecha de inicio y la etapa queda <b style="color:#b7791f">en curso</b>. Cuando termina, <b>Finalizar</b> carga la fecha de fin y recién ahí figura <b style="color:#2f7a46">terminada</b>. Tocá la fecha para corregir inicio, fin u observación.</p>`;
    // listado
    const acts = [];
    STSL.forEach((s) => ETAPAS.forEach(([k, n], i) => { const v = (((S.fundaciones || {})[s]) || {})[k]; if (v && (v.ini || v.ok)) acts.push({ s, k, n, i, v }); }));
    acts.sort((a, b) => String(b.v.ini || b.v.fin).localeCompare(String(a.v.ini || a.v.fin)) || a.s.localeCompare(b.s) || b.i - a.i);
    h += `<div class="card" style="margin-top:16px"><h3>Actividades registradas <span class="muted" style="font-weight:400">· ${acts.length}</span></h3>${acts.length ? `<table class="tbl dtbl"><thead><tr><th>Inicio</th><th>STS</th><th>Etapa</th><th>Estado</th><th>Fin</th><th>Observación</th></tr></thead><tbody>
      ${acts.map((a) => `<tr><td>${a.v.ini ? fechaCorta(a.v.ini) : '–'}</td><td><b>${a.s}</b></td><td>${a.i + 1}. ${esc(a.n)}</td><td>${a.v.ok ? '<span class="pill p-done">terminada</span>' : '<span class="pill p-warn">en curso</span>'}</td><td>${a.v.ok && a.v.fin ? fechaCorta(a.v.fin) : '–'}</td><td class="muted">${esc(a.v.obs || '')}</td></tr>`).join('')}</tbody></table>` : '<div class="empty" style="padding:20px"><b>Sin actividades registradas</b>Tocá ▶ Iniciar en la etapa que arrancó.</div>'}</div>`;
    el.innerHTML = h;
    $$('[data-fi]', el).forEach((b) => { b.onclick = () => { const [s, k] = b.dataset.fi.split('|'); fechaEtapa(s, k, 'ini'); }; });
    $$('[data-ff]', el).forEach((b) => { b.onclick = () => { const [s, k] = b.dataset.ff.split('|'); fechaEtapa(s, k, 'fin'); }; });
    $$('[data-fd]', el).forEach((b) => { b.onclick = () => { const [s, k] = b.dataset.fd.split('|'); editEtapa(s, k); }; });
  }
  function setEtapa(s, k, ch) {
    if (window.READONLY) return;
    S.fundaciones = S.fundaciones || {}; const o = (S.fundaciones[s] = S.fundaciones[s] || {});
    const v = Object.assign({}, o[k]);
    if ('ok' in ch) { v.ok = ch.ok; if (ch.ok) v.fin = ch.fin || v.fin || today(); else delete v.fin; }
    ['ini', 'fin', 'obs'].forEach((x) => { if (x in ch) { if (ch[x]) v[x] = ch[x]; else delete v[x]; } });
    if (!v.ok) delete v.ok;
    if (!v.ok && !v.ini && !v.obs) delete o[k]; else o[k] = v;
    const i = fundInfo(s);
    commit(`${s} · ${ETN[k]}: ${v.ok ? 'terminada' : v.ini ? 'en curso' : 'sin registro'} · base ${fmt(i.p * 100)} %`);
  }
  // inicio o fin rápido de una etapa
  async function fechaEtapa(s, k, cual) {
    if (window.READONLY) return;
    const v = (((S.fundaciones || {})[s]) || {})[k] || {};
    const fin = cual === 'fin';
    const res = await modal({ title: `${s} · ${esc(ETN[k])}`, sub: fin ? 'Actividad finalizada' : 'Inicio de la actividad',
      body: `<div class="form">${fin ? `<label>Inició el<input type="date" name="ini" value="${v.ini || today()}"></label><label>Finalizó el<input type="date" name="f" value="${today()}"></label>` : `<label>Inició el<input type="date" name="f" value="${today()}"></label>`}<label class="full">Observación<input name="obs" value="${esc(v.obs || '')}" placeholder="Opcional"></label></div>`,
      buttons: [['Cancelar', 'btn', () => null], [fin ? 'Finalizar' : 'Iniciar', 'btn pri', (box) => {
        const f = $('[name=f]', box).value, ini = fin ? $('[name=ini]', box).value : f;
        if (!f || !ini) { toast('Completá la fecha', { err: true }); return false; }
        if (fin && f < ini) { toast('La fecha de fin no puede ser anterior al inicio', { err: true }); return false; }
        return { ini, fin: fin ? f : null, obs: $('[name=obs]', box).value.trim() };
      }]] });
    if (!res) return;
    setEtapa(s, k, fin ? { ini: res.ini, ok: true, fin: res.fin, obs: res.obs } : { ini: res.ini, obs: res.obs });
  }
  async function editEtapa(s, k) {
    if (window.READONLY) return;
    const v = (((S.fundaciones || {})[s]) || {})[k] || {};
    const res = await modal({ title: `${s} · ${esc(ETN[k])}`, sub: 'Fundación de STS',
      body: `<div class="form"><label>Fecha de inicio<input type="date" name="ini" value="${v.ini || today()}"></label><label class="chkl" style="align-self:end"><input type="checkbox" name="ok" ${v.ok ? 'checked' : ''}> Actividad finalizada</label>
        <label class="ffl ${v.ok ? '' : 'off'}">Fecha de fin<input type="date" name="fin" value="${v.fin || today()}" ${v.ok ? '' : 'disabled'}></label><label class="full">Observación<input name="obs" value="${esc(v.obs || '')}" placeholder="Opcional"></label></div>`,
      buttons: [...(v.ini || v.ok ? [['Quitar registro', 'btn danger', () => 'del']] : []), ['Cancelar', 'btn', () => null], ['Guardar', 'btn pri', (box) => {
        const r = { ini: $('[name=ini]', box).value, ok: $('[name=ok]', box).checked, fin: $('[name=fin]', box).value, obs: $('[name=obs]', box).value.trim() };
        if (!r.ini) { toast('Cargá la fecha de inicio', { err: true }); return false; }
        if (r.ok && (!r.fin || r.fin < r.ini)) { toast('La fecha de fin no puede ser anterior al inicio', { err: true }); return false; }
        if (!r.ok) r.fin = null;
        return r;
      }]] });
    if (!res) return;
    if (res === 'del') { delete S.fundaciones[s][k]; commit(`${s} · ${ETN[k]}: registro quitado`); return; }
    setEtapa(s, k, res);
  }
  document.addEventListener('change', (e) => { if (e.target.matches && e.target.matches('#modal [name=ok]')) { const f = $('#modal [name=fin]'); if (f) { f.disabled = !e.target.checked; f.closest('label').classList.toggle('off', !e.target.checked); } } });
  async function exportFund() {
    const p = await window.api.saveBinary(IO.exportFund(S, ETAPAS, STSL, fundInfo), `Fundaciones STS ${today()}.xlsx`, 'xlsx', 'Excel');
    if (p) toast('Excel exportado', { action: ['Abrir', () => window.api.openPath(p)] });
  }
  function printFund() {
    const v = document.createElement('div'); vFund(v);
    $$('.hint', v).forEach((x) => x.remove()); $$('.card', v).forEach((x) => { if (!x.classList.contains('fcard')) x.classList.add('prday'); });
    printHTML(prHead('Fundaciones STS · avance por etapa') + v.innerHTML, `Fundaciones STS ${today()}.pdf`, true);
    render(false);
  }
  // Tarjetas de módulos (Resumen general)
  function modulosHTML() {
    const tot = (cat, k) => R.resumen.filter((r) => r.cat === cat).reduce((a, r) => a + r[k], 0);
    const tc = ['BT', 'MT', 'PAT'].map((c) => [c, tot(c, 'tendido'), tot(c, 'requerido')]);
    const tA = tc.reduce((a, x) => a + x[1], 0), tB = tc.reduce((a, x) => a + x[2], 0);
    const cs = R.circuitos.filter((c) => c.cat !== 'PAT').map((c) => [c.cat, puntasDe(c)]);
    const pc = ['BT', 'MT'].map((c) => { const g = cs.filter((x) => x[0] === c).map((x) => x[1]); return [c, g.reduce((a, x) => a + x.col, 0), g.reduce((a, x) => a + x.tot, 0)]; });
    const pA = pc.reduce((a, x) => a + x[1], 0), pB = pc.reduce((a, x) => a + x[2], 0);
    const fi = STSL.map((s) => [s, fundInfo(s)]); const fA = fi.reduce((a, [, i]) => a + i.done, 0) / (STSL.length * ETAPAS.length);
    const fila = (lbl, a, b, col) => `<div class="mrow"><span>${lbl}</span><div class="sbt"><div style="width:${b ? ((a / b) * 100).toFixed(1) : 0}%;background:${col}"></div></div><b>${fmt(b ? (a / b) * 100 : 0)}%</b></div>`;
    return `<h2 class="sech">Resumen de obra</h2><div class="grid stagger mods" style="margin-bottom:22px">
      <div class="card mcard" data-go="cables" title="Ver detalle del tendido"><div class="mh"><div>${Charts.ring(tB ? tA / tB : 0, SERIE.BT, 'tendido')}</div><div><h3>Tendido y aprovechamiento de cables</h3><div class="muted">${fmt(tA)} / ${fmt(tB)} m</div></div></div>${tc.map(([c, a, b]) => fila(`${ctag(c)}${c}`, a, b, SERIE[c])).join('')}<div class="muted" style="margin-top:6px">Zanja BT ${fmt(R.zanjas.BT.realizada)} / ${fmt(R.zanjas.BT.total)} m · MT ${fmt(R.zanjas.MT.realizada)} / ${fmt(R.zanjas.MT.total)} m</div></div>
      <div class="card mcard" data-go="puntas" title="Ver detalle de puntas"><div class="mh"><div>${Charts.ring(pB ? pA / pB : 0, '#e0457b', 'colocadas')}</div><div><h3>Puntas de cable</h3><div class="muted">${fmt(pA)} / ${fmt(pB)} puntas</div></div></div>${pc.map(([c, a, b]) => fila(`${ctag(c)}${c}`, a, b, SERIE[c])).join('')}</div>
      <div class="card mcard" data-go="fundaciones" title="Ver detalle de fundaciones"><div class="mh" style="margin-bottom:4px"><div>${Charts.ring(fA, FCOL.done, 'bases')}</div><div><h3>Fundaciones STS</h3><div class="muted">${fi.reduce((a, [, i]) => a + i.done, 0)} / ${STSL.length * ETAPAS.length} etapas</div></div></div><div class="minists">${fi.map(([s, i]) => `<div>${stsSVG(i.p, { small: true })}<span>${s}</span></div>`).join('')}</div></div>
      ${cronoModHTML()}</div>`;
  }
  function fundAvanceHTML() {
    const fi = STSL.map((s) => [s, fundInfo(s)]);
    const rows = fi.map(([s, i]) => ({ label: s, right: `${fmt(i.p * 100)}% · ${i.done}/${i.n}`, parts: [{ v: i.done, color: FCOL.done, name: 'Terminadas' }, { v: i.curso.length, color: FCOL.curso, name: 'En curso' }, { v: i.n - i.done - i.curso.length, color: FCOL.pend, name: 'Pendientes' }] }));
    const er = ETAPAS.map(([k, n], idx) => { const d = STSL.filter((s) => ((((S.fundaciones || {})[s]) || {})[k] || {}).ok).length, c = STSL.filter((s) => { const v = (((S.fundaciones || {})[s]) || {})[k] || {}; return v.ini && !v.ok; }).length; return { label: `${idx + 1}. ${n.length > 30 ? n.slice(0, 29) + '…' : n}`, right: `${d}/${STSL.length} STS`, parts: [{ v: d, color: FCOL.done, name: 'Terminada' }, { v: c, color: FCOL.curso, name: 'En curso' }, { v: STSL.length - d - c, color: FCOL.pend, name: 'Pendiente' }] }; });
    const leg = Charts.legend([[FCOL.done, 'Terminadas'], [FCOL.curso, 'En curso'], [FCOL.pend, 'Pendientes']]);
    return `<h2 class="sech">Fundaciones STS</h2><div class="grid g2 stagger"><div class="card"><h3>Avance por STS</h3><div class="minists big">${fi.map(([s, i]) => `<div>${stsSVG(i.p)}<span>${s}</span></div>`).join('')}</div>${Charts.hbars(rows, { labelW: 60, unit: 'etapas' })}${leg}</div>
      <div class="card"><h3>Avance por etapa</h3>${Charts.hbars(er, { labelW: 230, rightW: 80, unit: 'STS' })}${leg}</div></div>`;
  }

  // ======================= CRONOGRAMA DE OBRA =======================
  const DIA = 864e5;
  const dt = (s) => new Date(s + 'T12:00:00');
  const isoD = (d) => { const x = new Date(d); return new Date(x - x.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  const dd = (a, b) => Math.round((dt(b) - dt(a)) / DIA);
  const addD = (s, n) => isoD(new Date(dt(s).getTime() + n * DIA));
  const fC = (s) => (s ? fechaCorta(s).slice(0, 5) + '/' + s.slice(2, 4) : '–');
  const KEST = { terminada: '#2f9e5b', atrasada: '#d64545', demorada: '#e8833a', 'en curso': '#00939a', 'próxima': '#7a8aa3', pendiente: '#c3ccd8' };
  const espDe = (t, D, ini, fin) => { ini = ini || t.inicio; fin = fin || t.fin; if (!ini || !fin) return 0; if (D < ini) return 0; if (D >= fin) return 100; return Math.max(0, Math.min(100, ((dd(ini, D) + 0.5) / (dd(ini, fin) + 1)) * 100)); };
  function cronoCalc(hoy) {
    hoy = hoy || today();
    const T = (S.cronoTareas || []).slice().sort((a, b) => (a._o ?? 0) - (b._o ?? 0)).map((t) => Object.assign({}, t, { hijos: [] }));
    const by = new Map(T.map((t) => [t.id, t])); const stack = [];
    T.forEach((t) => { while (stack.length && stack[stack.length - 1].nivel >= t.nivel) stack.pop(); t.padre = stack.length ? stack[stack.length - 1].id : null; if (t.padre) by.get(t.padre).hijos.push(t.id); stack.push(t); });
    for (let i = T.length - 1; i >= 0; i--) {
      const t = T[i];
      if (t.hijos.length) {
        const hs = t.hijos.map((id) => by.get(id));
        t.inicio = hs.map((h) => h.inicio).filter(Boolean).sort()[0]; t.fin = hs.map((h) => h.fin).filter(Boolean).sort().pop();
        t.bInicio = hs.map((h) => h.bInicio).filter(Boolean).sort()[0] || t.bInicio; t.bFin = hs.map((h) => h.bFin).filter(Boolean).sort().pop() || t.bFin;
        t.peso = hs.reduce((a, h) => a + h.peso, 0);
        t.pct = t.peso ? hs.reduce((a, h) => a + h.pct * h.peso, 0) / t.peso : hs.reduce((a, h) => a + h.pct, 0) / hs.length;
        t.esp = t.peso ? hs.reduce((a, h) => a + h.esp * h.peso, 0) / t.peso : hs.reduce((a, h) => a + h.esp, 0) / hs.length;
        t.esResumen = true;
      } else { t.peso = t.hito ? 0 : dd(t.inicio, t.fin) + 1; t.esp = espDe(t, hoy); t.esResumen = false; }
      t.pct = Number(t.pct) || 0;
      t.estado = t.pct >= 99.95 ? 'terminada' : t.fin < hoy ? 'atrasada' : t.inicio <= hoy ? (t.pct < t.esp - 20 ? 'demorada' : 'en curso') : dd(hoy, t.inicio) <= 14 ? 'próxima' : 'pendiente';
      t.desvio = t.bFin && t.fin ? dd(t.bFin, t.fin) : 0;
    }
    const raiz = T.filter((t) => !t.padre), peso = raiz.reduce((a, t) => a + t.peso, 0);
    const P = { inicio: raiz.map((t) => t.inicio).filter(Boolean).sort()[0], fin: raiz.map((t) => t.fin).filter(Boolean).sort().pop(), bFin: raiz.map((t) => t.bFin).filter(Boolean).sort().pop(),
      pct: peso ? raiz.reduce((a, t) => a + t.pct * t.peso, 0) / peso : 0, esp: peso ? raiz.reduce((a, t) => a + t.esp * t.peso, 0) / peso : 0 };
    return { T, by, P, hoy, hojas: T.filter((t) => !t.esResumen) };
  }
  function curvaS(C, base) {
    const H = C.hojas.filter((t) => t.peso > 0 && (base ? t.bInicio && t.bFin : true));
    const ini = H.map((t) => (base ? t.bInicio : t.inicio)).sort()[0], fin = H.map((t) => (base ? t.bFin : t.fin)).sort().pop(); if (!ini) return [];
    const tot = H.reduce((a, t) => a + t.peso, 0), pts = [];
    for (let d = ini; d <= addD(fin, 7); d = addD(d, 7)) { const y = H.reduce((a, t) => a + espDe(t, d, base ? t.bInicio : t.inicio, base ? t.bFin : t.fin) * t.peso, 0) / tot / 100; pts.push({ x: dt(d), y, tip: `${base ? 'Línea base' : 'Planificado'} al ${fechaCorta(d)}: ${fmt(y * 100, 1)} %` }); if (d > fin) break; }
    return pts;
  }
  function cronoTag(t) { return `<span class="kst" style="--c:${KEST[t.estado]}">${t.estado}</span>`; }
  function cronoCurvaFases(C) {
    const P = C.P, hoy = C.hoy; let h = '';
    const cur = curvaS(C, false), base = curvaS(C, true);
    const real = [{ x: dt(hoy), y: P.pct / 100, tip: `Real al ${fechaCorta(hoy)}: ${fmt(P.pct, 1)} %` }];
    const fases = C.T.filter((t) => t.nivel === 1 && t.esResumen);
    h += `<div class="grid g2 stagger" style="margin-bottom:16px"><div class="card"><h3>Curva S · avance acumulado</h3>${Charts.line([{ name: 'Línea base', color: '#b4bfcd', pts: base }, { name: 'Planificado', color: '#7a8aa3', pts: cur }, { name: 'Real', color: '#00939a', pts: real }], { hoy: dt(hoy), full: true, sinEtiquetas: true })}${Charts.legend([['#b4bfcd', 'Línea base'], ['#7a8aa3', 'Planificado (fechas actuales)'], ['#00939a', 'Real hoy']])}</div>
      <div class="card"><h3>Avance por etapa</h3><div class="fases">${fases.map((t) => `<div class="fz" data-k="${t.id}"><div class="fzh"><span>${esc(t.wbs)}. ${esc(t.nombre)}</span>${cronoTag(t)}</div>
        <div class="fzb"><div class="fzr" style="width:${t.pct.toFixed(1)}%"></div><i style="left:${t.esp.toFixed(1)}%" title="Esperado hoy: ${fmt(t.esp)} %"></i></div>
        <div class="fzm muted"><span>${fC(t.inicio)} → ${fC(t.fin)}</span><span><b>${fmt(t.pct)} %</b> real · ${fmt(t.esp)} % esperado</span></div></div>`).join('')}</div>
        <div class="legend"><span><i style="background:#00939a"></i>Real</span><span><i style="background:#142033;width:2px"></i>Esperado hoy</span></div></div></div>`;
    return h;
  }
  function vCronoRes(el) {
    actions([['Exportar Excel', 'btn', () => exportCrono()], ['Exportar PDF', 'btn', () => printCrono()], ['Actualizar cronograma (Project)', 'btn', importarCrono], ['Ver Gantt', 'btn pri', () => go('gantt')]]);
    if (!(S.cronoTareas || []).length) { el.innerHTML = `<div class="card empty"><b>Sin cronograma cargado</b>Importá el cronograma exportado de MS Project como XML.</div>`; return; }
    const C = cronoCalc(), P = C.P, hoy = C.hoy;
    const desv = P.pct - P.esp, finD = P.bFin ? dd(P.bFin, P.fin) : 0, resta = dd(hoy, P.fin);
    const tiempo = Math.max(0, Math.min(1, dd(P.inicio, hoy) / Math.max(1, dd(P.inicio, P.fin))));
    let h = `<div class="grid g4 stagger" style="margin-bottom:16px">
      <div class="card tile"><div>${Charts.ring(P.pct / 100, '#00939a', 'real')}</div><div><h3 style="margin-bottom:4px">Avance real</h3><div class="muted">ponderado por duración</div><div class="kdev ${desv < -2 ? 'neg' : desv > 2 ? 'pos' : ''}">${desv >= 0 ? '+' : ''}${fmt(desv, 1)} pp vs. lo esperado</div></div></div>
      <div class="card tile"><div>${Charts.ring(P.esp / 100, '#7a8aa3', 'esperado')}</div><div><h3 style="margin-bottom:4px">Avance esperado hoy</h3><div class="muted">según las fechas del cronograma</div></div></div>
      <div class="card tile"><div>${Charts.ring(tiempo, '#f5a524', 'plazo')}</div><div><h3 style="margin-bottom:4px">Plazo transcurrido</h3><div class="muted">${fechaCorta(P.inicio)} → ${fechaCorta(P.fin)}</div><div class="muted">${resta >= 0 ? `faltan <b>${resta}</b> días` : `vencido hace ${-resta} días`}</div></div></div>
      <div class="card"><h3>Fin de obra</h3><div class="bigd">${fechaCorta(P.fin)}</div><div class="muted">Línea base ${P.bFin ? fechaCorta(P.bFin) : '–'}${finD ? ` · <b class="${finD > 0 ? 'tneg' : 'tpos'}">${finD > 0 ? '+' : ''}${finD} días</b>` : ' · en fecha'}</div>
        <div class="muted" style="margin-top:6px">${esc((S.cronoMeta || {}).fuente || '')}</div></div></div>`;
    h += cronoCurvaFases(C);
    // listas
    const H = C.hojas;
    const lista = (titulo, arr, vacio, extra) => `<div class="card"><h3>${titulo} <span class="muted" style="font-weight:400">· ${arr.length}</span></h3>${arr.length ? `<div class="klist">${arr.slice(0, 14).map((t) => `<button class="kit" data-k="${t.id}"><span class="kn"><b>${esc(t.wbs)}</b> ${esc(t.nombre)}</span><span class="kd muted">${t.hito ? fC(t.inicio) : fC(t.inicio) + ' → ' + fC(t.fin)}${extra ? ' · ' + extra(t) : ''}</span>${t.hito ? '<span class="kst" style="--c:#6a5acd">hito</span>' : `<span class="kpb"><i style="width:${t.pct}%"></i></span><span class="kpc">${fmt(t.pct)}%</span>`}</button>`).join('')}${arr.length > 14 ? `<div class="muted" style="padding:6px 8px">y ${arr.length - 14} más…</div>` : ''}</div>` : `<div class="muted" style="padding:10px 0">${vacio}</div>`}</div>`;
    const enCurso = H.filter((t) => !t.hito && t.inicio <= hoy && t.fin >= hoy && t.pct < 100).sort((a, b) => a.fin.localeCompare(b.fin));
    const atras = H.filter((t) => t.estado === 'atrasada' || t.estado === 'demorada').sort((a, b) => a.fin.localeCompare(b.fin));
    const prox = H.filter((t) => !t.hito && t.inicio > hoy && dd(hoy, t.inicio) <= 21 && t.pct < 100).sort((a, b) => a.inicio.localeCompare(b.inicio));
    const hitos = H.filter((t) => t.hito && t.pct < 100).sort((a, b) => a.inicio.localeCompare(b.inicio)).slice(0, 8);
    h += `<div class="grid g2 stagger">${lista('En curso hoy', enCurso, 'No hay actividades en curso hoy.', (t) => `${fmt(t.esp)} % esperado`)}${lista('Atrasadas o demoradas', atras, 'Sin atrasos 👍', (t) => (t.fin < hoy ? `venció hace ${dd(t.fin, hoy)} d` : `${fmt(t.esp)} % esperado`))}
      ${lista('Empiezan en las próximas 3 semanas', prox, 'Nada por empezar en 3 semanas.', (t) => `en ${dd(hoy, t.inicio)} d`)}${lista('Próximos hitos', hitos, 'Sin hitos pendientes.', (t) => `en ${dd(hoy, t.inicio)} d`)}</div>
      <p class="hint">Avance esperado: proporción del tiempo transcurrido de cada tarea al día de hoy. Las barras comparan el % real cargado contra ese esperado. Tocá una actividad para cambiar sus fechas o su avance.</p>`;
    el.innerHTML = h;
    $$('[data-k]', el).forEach((b) => { b.onclick = () => { const t = C.by.get(b.dataset.k); if (t && t.esResumen) { ui.gq = ''; ui.gf = 'all'; ui.gfoco = t.id; go('gantt'); } else editTarea(b.dataset.k); }; });
    Charts.bindTips(el);
  }
  function vGantt(el) {
    actions([['Exportar Excel', 'btn', () => exportCrono()], ['Exportar PDF', 'btn', () => printCrono()], ['Actualizar cronograma (Project)', 'btn', importarCrono]]);
    if (!(S.cronoTareas || []).length) { el.innerHTML = `<div class="card empty"><b>Sin cronograma cargado</b>Importá el cronograma exportado de MS Project como XML.</div>`; return; }
    const LW = window.innerWidth <= 860 ? 230 : 470;
    const C = cronoCalc(), hoy = C.hoy, px = ui.gz || 4, f = ui.gf || 'all', q = (ui.gq || '').toLowerCase();
    ui.gcol = ui.gcol || new Set();
    const min = addD([C.P.inicio, ...C.T.map((t) => t.bInicio).filter(Boolean)].sort()[0], -7), max = addD([C.P.fin, ...C.T.map((t) => t.bFin).filter(Boolean)].sort().pop(), 10);
    const W = (dd(min, max) + 1) * px, X = (s) => dd(min, s) * px;
    // filas visibles
    const vis = (t) => { let p = t.padre; while (p) { if (ui.gcol.has(p)) return false; p = C.by.get(p).padre; } return true; };
    let rows = C.T;
    if (f !== 'all' || q) {
      const ok = new Set();
      C.T.forEach((t) => { const m = (f === 'all' || (f === 'curso' ? t.estado === 'en curso' || t.estado === 'demorada' : f === 'atr' ? t.estado === 'atrasada' || t.estado === 'demorada' : f === 'prox' ? t.estado === 'próxima' : true)) && (!q || `${t.wbs} ${t.nombre}`.toLowerCase().includes(q)); if (m && !t.esResumen) { ok.add(t.id); let p = t.padre; while (p) { ok.add(p); p = C.by.get(p).padre; } } });
      rows = C.T.filter((t) => ok.has(t.id));
    } else rows = C.T.filter(vis);
    // encabezado de meses
    let mh = '', wk = '';
    for (let d = min.slice(0, 8) + '01'; d <= max; ) { const n = addD(d.slice(0, 8) + '01', 32).slice(0, 8) + '01'; const a = d < min ? min : d, b = n > max ? max : n; mh += `<div class="gm" style="left:${X(a)}px;width:${dd(a, b) * px}px">${px >= 3 || dd(a, b) > 20 ? MESES[Number(d.slice(5, 7)) - 1].slice(0, px >= 3 ? 20 : 3) + ' ' + d.slice(2, 4) : ''}</div>`; d = n; }
    if (px >= 3) for (let d = min; d <= max; d = addD(d, 1)) if (dt(d).getDay() === 1) wk += `<div class="gw" style="left:${X(d)}px">${px >= 6 ? d.slice(8) : ''}</div>`;
    let h = `<div class="tools"><div class="seg" id="gF"><button data-v="all">Todas</button><button data-v="curso">En curso</button><button data-v="atr">Atrasadas</button><button data-v="prox">Próximas</button></div>
      <div class="seg" id="gZ"><button data-v="2">Obra</button><button data-v="4">Mes</button><button data-v="8">Semana</button><button data-v="14">Día</button></div>
      <button class="btn sm" id="gExp">Expandir todo</button><button class="btn sm" id="gCol">Solo etapas</button><button class="btn sm" id="gHoy">Ir a hoy</button>
      <span class="sp"></span><input type="search" id="gQ" placeholder="Buscar actividad…" value="${esc(ui.gq || '')}" style="width:200px"></div>
      <div class="card gcard"><div class="gwrap" id="gWrap"><div class="gin" style="width:${W + LW}px">
      <div class="grow ghead"><div class="gl"><span class="gwbs">WBS</span><span class="gnm">Actividad</span><span class="gdt">Inicio</span><span class="gdt">Fin</span><span class="gpc">%</span></div><div class="gr" style="width:${W}px">${mh}${wk}</div></div>
      <div class="gbody"><div class="gtoday" style="left:${LW + X(hoy)}px" title="Hoy ${fechaCorta(hoy)}"><span>hoy</span></div>`;
    rows.forEach((t) => {
      const ind = (t.nivel - 1) * 14, x = X(t.inicio), w = Math.max(px, (dd(t.inicio, t.fin) + 1) * px), c = KEST[t.estado];
      const bl = t.bInicio && t.bFin && (t.bInicio !== t.inicio || t.bFin !== t.fin) ? `<div class="gbl" style="left:${X(t.bInicio)}px;width:${Math.max(px, (dd(t.bInicio, t.bFin) + 1) * px)}px" title="Línea base ${fechaCorta(t.bInicio)} → ${fechaCorta(t.bFin)}"></div>` : '';
      const bar = t.hito ? `<div class="ghito" style="left:${x + px / 2 - 7}px;--c:${t.pct >= 100 ? KEST.terminada : '#6a5acd'}" title="${esc(t.nombre)} · ${fechaCorta(t.inicio)}"></div><span class="glb" style="left:${x + px / 2 + 10}px">${fC(t.inicio)}</span>`
        : t.esResumen ? `<div class="gsum" style="left:${x}px;width:${w}px" title="${esc(t.nombre)} · ${fmt(t.pct)} %"><i style="width:${t.pct}%"></i></div>`
        : `<div class="gbar" style="left:${x}px;width:${w}px;--c:${c}" title="${esc(t.nombre)}&#10;${fechaCorta(t.inicio)} → ${fechaCorta(t.fin)} · ${fmt(t.pct)} % (esperado ${fmt(t.esp)} %)"><i style="width:${t.pct}%"></i></div>${w > 60 || px >= 6 ? '' : ''}<span class="glb" style="left:${x + w + 6}px">${fmt(t.pct)}%</span>`;
      h += `<div class="grow ${t.esResumen ? 'gs' : ''} ${ui.gfoco === t.id ? 'gfoco' : ''}" data-k="${t.id}"><div class="gl" style="--ind:${ind}px">
        <span class="gwbs">${esc(t.wbs)}</span><span class="gnm">${t.esResumen ? `<button class="gcar ${ui.gcol.has(t.id) ? '' : 'op'}" data-c="${t.id}">▸</button>` : '<i class="gdot" style="background:' + c + '"></i>'}<span class="gtx" title="${esc(t.nombre)}">${esc(t.nombre)}</span></span>
        <span class="gdt">${fC(t.inicio)}</span><span class="gdt">${t.hito ? '' : fC(t.fin)}</span><span class="gpc">${t.hito ? (t.pct >= 100 ? '✓' : '') : fmt(t.pct)}</span></div>
        <div class="gr" style="width:${W}px">${bl}${bar}</div></div>`;
    });
    h += `</div></div></div></div><div class="legend" style="margin-top:8px">${Object.entries(KEST).map(([k, c]) => `<span><i style="background:${c}"></i>${k}</span>`).join('')}<span><i style="background:#6a5acd;transform:rotate(45deg)"></i>hito</span><span><i style="background:transparent;border:1px dashed #8a97aa"></i>línea base</span></div>
      <p class="hint">Tocá una actividad para cambiar inicio, fin o % de avance. Las etapas (en negrita) se calculan solas con sus actividades.</p>`;
    el.innerHTML = h;
    segBind('#gF', f, (v) => { ui.gf = v; render(false); });
    segBind('#gZ', String(px), (v) => { ui.gz = Number(v); ui.gsl = null; ui.gScrolled = false; render(false); });
    searchBind('#gQ', (v) => { ui.gq = v; });
    const wrap = $('#gWrap', el);
    const irHoy = () => { const w = $('#gWrap'); if (w) w.scrollLeft = Math.max(0, X(hoy) - (w.clientWidth - LW) / 2); };
    $('#gHoy', el).onclick = irHoy;
    $('#gExp', el).onclick = () => { ui.gcol.clear(); render(false); };
    $('#gCol', el).onclick = () => { ui.gcol = new Set(C.T.filter((t) => t.esResumen && t.nivel >= 1).map((t) => t.id)); render(false); };
    $$('[data-c]', el).forEach((b) => { b.onclick = (e) => { e.stopPropagation(); const id = b.dataset.c; ui.gcol.has(id) ? ui.gcol.delete(id) : ui.gcol.add(id); render(false); }; });
    $$('.grow[data-k]', el).forEach((r) => { r.onclick = () => { const t = C.by.get(r.dataset.k); if (t.esResumen) { ui.gcol.has(t.id) ? ui.gcol.delete(t.id) : ui.gcol.add(t.id); render(false); } else editTarea(t.id); }; });
    if (!ui.gScrolled || ui.gfoco) { ui.gScrolled = true; setTimeout(() => { irHoy(); if (ui.gfoco) { const r = $(`.grow[data-k="${ui.gfoco}"]`); if (r) r.scrollIntoView({ block: 'center' }); ui.gfoco = null; } }, 30); }
    if (wrap && ui.gsl != null) { wrap.scrollLeft = ui.gsl; wrap.scrollTop = ui.gst || 0; }
    if (wrap) wrap.onscroll = () => { ui.gsl = wrap.scrollLeft; ui.gst = wrap.scrollTop; };
  }
  async function editTarea(id) {
    if (window.READONLY) return;
    const t = (S.cronoTareas || []).find((x) => x.id === id); if (!t) return;
    const C = cronoCalc(), c = C.by.get(id);
    const res = await modal({ title: `${esc(t.wbs)} · ${esc(t.nombre)}`, sub: `${c.estado}${t.critica ? ' · ruta crítica' : ''} · esperado hoy ${fmt(c.esp)} %`,
      body: `<div class="form">${t.hito ? `<label>Fecha del hito<input type="date" name="i" value="${t.inicio}"></label><label class="chkl"><input type="checkbox" name="ok" ${t.pct >= 100 ? 'checked' : ''}> Cumplido</label>`
        : `<label>Inicio<input type="date" name="i" value="${t.inicio}"></label><label>Fin<input type="date" name="f" value="${t.fin}"></label>
        <label class="full">Avance real: <b id="kpv">${fmt(t.pct)} %</b><input type="range" name="p" min="0" max="100" step="5" value="${t.pct}"></label>`}
        <label class="full">Nota<input name="n" value="${esc(t.nota || '')}" placeholder="Opcional"></label></div>
        <p class="hint">Cronograma importado: ${fechaCorta(t.oInicio)}${t.hito ? '' : ' → ' + fechaCorta(t.oFin)} · ${t.oPct} %${t.bInicio ? ` &nbsp;|&nbsp; Línea base: ${fechaCorta(t.bInicio)}${t.hito ? '' : ' → ' + fechaCorta(t.bFin)}` : ''}${t.mod ? `<br>Modificado el ${new Date(t.mod).toLocaleString('es-AR')}` : ''}</p>`,
      buttons: [...(t.inicio !== t.oInicio || t.fin !== t.oFin || t.pct !== t.oPct ? [['Volver a lo importado', 'btn', () => 'rest']] : []), ['Cancelar', 'btn', () => null], ['Guardar', 'btn pri', (box) => {
        const i = $('[name=i]', box).value, f2 = t.hito ? i : $('[name=f]', box).value;
        if (!i || !f2) { toast('Completá las fechas', { err: true }); return false; }
        if (f2 < i) { toast('El fin no puede ser anterior al inicio', { err: true }); return false; }
        return { i, f: f2, p: t.hito ? ($('[name=ok]', box).checked ? 100 : 0) : Number($('[name=p]', box).value), n: $('[name=n]', box).value.trim() };
      }]] });
    setTimeout(() => { const r = $('#modal [name=p]'); if (r) r.oninput = () => { $('#kpv').textContent = r.value + ' %'; }; }, 0);
    if (!res) return;
    if (res === 'rest') { t.inicio = t.oInicio; t.fin = t.oFin; t.pct = t.oPct; delete t.mod; ui.flash = [id]; commit(`${t.nombre}: valores del cronograma restaurados`); return; }
    const cambio = [];
    if (res.i !== t.inicio) cambio.push(`inicio ${fC(res.i)}`); if (res.f !== t.fin && !t.hito) cambio.push(`fin ${fC(res.f)}`); if (res.p !== t.pct) cambio.push(`${res.p} %`);
    t.inicio = res.i; t.fin = res.f; t.pct = res.p; if (res.n) t.nota = res.n; else delete t.nota; t.mod = new Date().toISOString();
    ui.flash = [id]; commit(`${t.nombre}: ${cambio.join(' · ') || 'guardado'}`);
  }
  // modal: el slider muestra su valor
  document.addEventListener('input', (e) => { if (e.target.matches && e.target.matches('#modal [name=p]')) { const v = $('#kpv'); if (v) v.textContent = e.target.value + ' %'; } });
  function leerMSPDI(txt) {
    const doc = new DOMParser().parseFromString(txt, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('El archivo no es un XML válido');
    const g = (n, tag) => { const e = [...n.children].find((c) => c.localName === tag); return e ? e.textContent : null; };
    const proj = doc.documentElement; if (proj.localName !== 'Project') throw new Error('No es un XML de MS Project');
    const tasks = [...proj.getElementsByTagNameNS('*', 'Task')];
    const out = [];
    tasks.forEach((n, i) => {
      const name = g(n, 'Name'); const lvl = Number(g(n, 'OutlineLevel') || 0); if (!name || !lvl) return;
      if (g(n, 'IsNull') === '1') return;
      const bl = [...n.children].filter((c) => c.localName === 'Baseline').find((b) => g(b, 'Number') === '0');
      const d = (s) => (s ? s.slice(0, 10) : null);
      out.push({ uid: Number(g(n, 'UID')), n: Number(g(n, 'ID')), wbs: g(n, 'WBS') || g(n, 'OutlineNumber') || '', nivel: lvl, nombre: name.trim(), inicio: d(g(n, 'Start')), fin: d(g(n, 'Finish')),
        pct: Math.round(Number(g(n, 'PercentComplete') || 0)), resumen: g(n, 'Summary') === '1', hito: g(n, 'Milestone') === '1', critica: g(n, 'Critical') === '1',
        bInicio: bl ? d(g(bl, 'Start')) : null, bFin: bl ? d(g(bl, 'Finish')) : null,
        preds: [...n.children].filter((c) => c.localName === 'PredecessorLink').map((c) => Number(g(c, 'PredecessorUID'))), _o: i });
    });
    return { titulo: g(proj, 'Title') || g(proj, 'Name') || '', tareas: out };
  }
  // normaliza lo leído de Project (XML o .mpp convertido) al formato interno
  function tareasDeProject(d) {
    let T = (d.tareas || []).filter((t) => t.nivel >= 1 && t.nombre);
    const n1 = T.filter((t) => t.nivel === 1);
    if (n1.length === 1 && T[0] && T[0].resumen && T[0].nivel === 1 && T.length > 1) { T = T.slice(1).map((t) => Object.assign({}, t, { nivel: t.nivel - 1 })); }
    return T.map((t, i) => ({ id: 'k' + t.uid, uid: t.uid, n: t.n, wbs: t.wbs || '', nivel: t.nivel, nombre: String(t.nombre).trim(), inicio: t.inicio, fin: t.fin || t.inicio, pct: Math.round(Number(t.pct) || 0),
      resumen: !!t.resumen, hito: !!t.hito, critica: !!t.critica, bInicio: t.bInicio || null, bFin: t.bFin || null, preds: t.preds || [], _o: i, oInicio: t.inicio, oFin: t.fin || t.inicio, oPct: Math.round(Number(t.pct) || 0) }));
  }
  function aplicarCrono(d, opts) {
    const nuevas = tareasDeProject(d);
    const prev = new Map((S.cronoTareas || []).map((t) => [t.uid, t]));
    let cons = 0, cambF = 0;
    nuevas.forEach((o) => {
      const p = prev.get(o.uid);
      if (p && (p.inicio !== o.inicio || p.fin !== o.fin)) cambF++;
      if (opts.keep && p && p.mod) { o.inicio = p.inicio; o.fin = p.fin; o.pct = p.pct; o.mod = p.mod; cons++; }
      if (p && p.nota) o.nota = p.nota;
    });
    const nuevasIds = new Set(nuevas.map((t) => t.uid));
    const quitadas = (S.cronoTareas || []).filter((t) => !nuevasIds.has(t.uid)).length, agregadas = nuevas.filter((t) => !prev.has(t.uid)).length;
    S.cronoTareas = nuevas;
    S.cronoMeta = { nombre: d.titulo || (S.cronoMeta || {}).nombre || '', fuente: opts.fuente || '', importado: today(), por: opts.por || '' };
    commit(`Cronograma actualizado${opts.por ? ' por ' + opts.por : ''}: ${nuevas.length} tareas · ${cambF} con fechas nuevas${agregadas ? ` · ${agregadas} nuevas` : ''}${quitadas ? ` · ${quitadas} quitadas` : ''}${cons ? ` · ${cons} cambios locales conservados` : ''}`);
    return { n: nuevas.length, cambF, agregadas, quitadas, cons };
  }
  async function importarCrono() {
    if (window.READONLY) return importarCronoVisor();
    const f = await window.api.pickCrono(); if (!f) return;
    if (f.error) { toast(f.error, { err: true, ms: 9000 }); return; }
    let d; try { d = f.json || leerMSPDI(f.text); } catch (e) { toast(e.message, { err: true }); return; }
    const T = tareasDeProject(d);
    if (!T.length) { toast('No encontré tareas en el archivo', { err: true }); return; }
    const prev = new Map((S.cronoTareas || []).map((t) => [t.uid, t]));
    const cambF = T.filter((t) => prev.has(t.uid) && (prev.get(t.uid).inicio !== t.inicio || prev.get(t.uid).fin !== t.fin)).length;
    const editadas = (S.cronoTareas || []).filter((t) => t.mod);
    const nom = f.path.split(/[\\/]/).pop();
    const res = await modal({ title: 'Actualizar cronograma', sub: esc(nom),
      body: `<p>Encontré <b>${T.length}</b> tareas${d.titulo ? ` en «${esc(d.titulo)}»` : ''}: <b>${cambF}</b> cambian de fecha, ${T.filter((t) => !prev.has(t.uid)).length} son nuevas y ${(S.cronoTareas || []).filter((t) => !T.some((x) => x.uid === t.uid)).length} ya no están.</p>
        ${editadas.length ? `<label class="chkl"><input type="checkbox" name="keep" checked> Conservar lo que modifiqué en el programa (${editadas.length} actividades con fechas o avance cambiados a mano)</label>` : ''}
        <p class="hint">Acepta el archivo de MS Project (.mpp) o el XML exportado. Las actividades se reconocen por su identificador único, así que se actualizan aunque cambien de nombre o de lugar.</p>`,
      buttons: [['Cancelar', 'btn', () => null], ['Actualizar', 'btn pri', (box) => ({ keep: !!($('[name=keep]', box) || {}).checked })]] });
    if (!res) return;
    aplicarCrono(d, { keep: res.keep, fuente: nom });
  }
  // ---- visor: un usuario editor envía el archivo al buzón; la PC de obra lo aplica
  async function importarCronoVisor() {
    const E = window.__editor; if (!E) return;
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.mpp,.xml';
    inp.onchange = async () => {
      const file = inp.files[0]; if (!file) return;
      const ext = /\.mpp$/i.test(file.name) ? 'mpp' : /\.xml$/i.test(file.name) ? 'xml' : null;
      if (!ext) { toast('Elegí un archivo .mpp o .xml de MS Project', { err: true }); return; }
      let resumen = `${esc(file.name)} · ${fmt(file.size / 1048576, 1)} MB`;
      if (ext === 'xml') { try { const d = leerMSPDI(await file.text()); resumen += ` · ${tareasDeProject(d).length} tareas`; } catch (e) { toast(e.message, { err: true }); return; } }
      const ok = await modal({ title: 'Enviar cronograma actualizado', sub: resumen,
        body: `<p>El archivo se envía cifrado a la PC de obra, que actualiza las fechas del cronograma en unos minutos (tiene que estar con el programa abierto). Los cambios hechos a mano en el programa se conservan.</p>`,
        buttons: [['Cancelar', 'btn', () => null], ['Enviar', 'btn pri', () => true]] });
      if (!ok) return;
      toast('Enviando…', { ms: 2500 });
      try { await E.enviar(file, ext); toast('Cronograma enviado. Se aplicará en unos minutos y se va a ver acá solo.', { ms: 9000 }); }
      catch (e) { toast('No se pudo enviar: ' + (e.message || e), { err: true, ms: 9000 }); }
    };
    inp.click();
  }
  // ---- PC de obra: revisa el buzón cada 2 minutos
  let buzonBusy = false;
  async function revisarBuzon() {
    if (window.READONLY || buzonBusy || !webListo() || NET.modo === 'cliente') return;
    buzonBusy = true;
    try {
      const r = await window.api.webBuzon(); if (!r || !r.ok || !r.items.length) return;
      const hechos = [];
      for (const it of r.items) {
        if (it.error) { hechos.push(it.ruta); toast(`Buzón: se descartó un archivo (${it.error})`, { err: true, ms: 8000 }); continue; }
        try { const d = it.json || leerMSPDI(it.text); aplicarCrono(d, { keep: true, fuente: it.archivo, por: it.nombre }); hechos.push(it.ruta); toast(`Cronograma actualizado desde el visor por ${it.nombre} (${it.archivo})`, { ms: 9000 }); }
        catch (e) { hechos.push(it.ruta); toast(`No se pudo aplicar ${it.archivo}: ${e.message}`, { err: true, ms: 9000 }); }
      }
      if (hechos.length) { await window.api.webBuzonBorrar(hechos); publicarWeb(false); }
    } catch (_) { /* reintenta */ } finally { buzonBusy = false; }
  }
  setInterval(revisarBuzon, 120000); setTimeout(revisarBuzon, 20000);
  async function exportCrono() {
    const C = cronoCalc();
    const p = await window.api.saveBinary(IO.exportCrono(C, S.cronoMeta || {}), `Cronograma ${today()}.xlsx`, 'xlsx', 'Excel');
    if (p) toast('Excel exportado', { action: ['Abrir', () => window.api.openPath(p)] });
  }
  function printCrono() {
    const v = document.createElement('div'); vCronoRes(v);
    $$('.hint', v).forEach((x) => x.remove());
    const C = cronoCalc();
    let t = `<div class="card prday"><h3>Actividades</h3><table class="tbl dtbl"><thead><tr><th>WBS</th><th>Actividad</th><th>Inicio</th><th>Fin</th><th>Línea base fin</th><th class="num">Real</th><th class="num">Esperado</th><th>Estado</th></tr></thead><tbody>
      ${C.T.map((x) => `<tr class="${x.esResumen ? 'grow-h' : ''}"><td>${esc(x.wbs)}</td><td style="padding-left:${(x.nivel - 1) * 10 + 6}px">${x.esResumen ? '<b>' + esc(x.nombre) + '</b>' : esc(x.nombre)}</td><td>${fechaCorta(x.inicio)}</td><td>${x.hito ? '' : fechaCorta(x.fin)}</td><td>${x.bFin ? fechaCorta(x.bFin) : ''}</td><td class="num">${fmt(x.pct)} %</td><td class="num">${fmt(x.esp)} %</td><td>${x.estado}</td></tr>`).join('')}</tbody></table></div>`;
    printHTML(prHead('Cronograma de obra · ' + esc((S.cronoMeta || {}).nombre || '')) + v.innerHTML + t, `Cronograma ${today()}.pdf`, true);
    render(false);
  }
  function cronoModHTML() {
    if (!(S.cronoTareas || []).length) return '';
    const C = cronoCalc(), P = C.P, desv = P.pct - P.esp;
    const enCurso = C.hojas.filter((t) => !t.hito && t.inicio <= C.hoy && t.fin >= C.hoy && t.pct < 100).length, atr = C.hojas.filter((t) => t.estado === 'atrasada').length;
    return `<div class="card mcard" data-go="crono" title="Ver cronograma"><div class="mh"><div>${Charts.ring(P.pct / 100, '#00939a', 'real')}</div><div><h3>Cronograma de obra</h3><div class="muted">esperado hoy ${fmt(P.esp, 1)} % · <span class="${desv < -2 ? 'tneg' : 'tpos'}">${desv >= 0 ? '+' : ''}${fmt(desv, 1)} pp</span></div></div></div>
      <div class="mrow"><span>Real</span><div class="sbt"><div style="width:${P.pct.toFixed(1)}%;background:#00939a"></div></div><b>${fmt(P.pct)}%</b></div>
      <div class="mrow"><span>Esperado</span><div class="sbt"><div style="width:${P.esp.toFixed(1)}%;background:#7a8aa3"></div></div><b>${fmt(P.esp)}%</b></div>
      <div class="muted" style="margin-top:6px">${enCurso} en curso · ${atr} atrasadas · fin ${fechaCorta(P.fin)}</div></div>`;
  }

  // ======================= PLANO DE OBRA =======================
  const PL_CAPAS = [['sect', 'Sectores'], ['trk', 'Trackers'], ['bt', 'Zanjas BT'], ['mt', 'Zanjas MT'], ['inv', 'Inversores'], ['sts', 'STS'], ['ctx', 'Caminos y cerco']];
  const SECT_COL = { 1: '#4e79a7', 2: '#59a14f', 3: '#b07aa1', 4: '#f28e2b', 5: '#00939a', 6: '#e15759' };
  const ZEST = { 'no abierta': '#b9c2cf', abierta: '#f5a524', cerrada: '#2f9e5b' };
  const KWP = (n) => `${fmt(n * 0.625, 1)}–${fmt(n * 0.635, 1)} kWp`;
  function planoInfo() {
    const P = window.PLANO; if (!P) return null;
    const circ = new Map(R.circuitos.filter((c) => c.cat === 'BT').map((c) => [c.desde, c]));
    const zest = (c) => { if (!c) return null; const z = R.zlist.find((x) => x.id === c.zid); return z ? z.estado : c.zanja; };
    return { P, circ, zest };
  }
  function vPlano(el) {
    actions([['Exportar PDF', 'btn', printPlano]]);
    const I = planoInfo();
    if (!I) { el.innerHTML = '<div class="card empty"><b>Plano no disponible</b></div>'; return; }
    const { P, circ, zest } = I;
    ui.pl = ui.pl || { capas: new Set(PL_CAPAS.map((c) => c[0])), color: 'sector', zcol: 'estado', vb: null, sel: null };
    const pl = ui.pl;
    const cap = (k) => pl.capas.has(k);
    const pts = (p) => p.map((q) => q[0] + ',' + q[1]).join(' ');
    let g = '';
    if (cap('ctx')) {
      const st = { camino: 'stroke:#d8dde5;stroke-width:6;stroke-linecap:round;vector-effect:none', cerco: 'stroke:#7a8aa3;stroke-width:1.2px;stroke-dasharray:6 4', edif: 'stroke:#7a8aa3;stroke-width:1px;fill:#eef1f5', agua: 'stroke:#8ec5e8;stroke-width:2px', limite: 'stroke:#b4bfcd;stroke-width:1px;stroke-dasharray:2 6' };
      Object.entries(P.ctx).forEach(([k, arr]) => arr.forEach((p) => { g += `<polyline points="${pts(p)}" style="fill:none;${st[k]}" class="pl-ctx"/>`; }));
    }
    if (cap('sect')) P.sect.forEach((s) => { g += `<polygon points="${pts(s.p)}" class="pl-sect" style="fill:${SECT_COL[s.n]};stroke:${SECT_COL[s.n]}" data-pk="s|${s.n}"/>`; });
    if (cap('trk')) {
      const tcol = (t) => (pl.color === 'tipo' ? (t.t === '1P52' ? '#00939a' : '#f5a524') : SECT_COL[t.s]);
      P.trk.forEach((t) => { g += `<rect x="${(t.x - t.w / 2).toFixed(1)}" y="${(t.y - t.h / 2).toFixed(1)}" width="${t.w}" height="${t.h}" rx="0.6" fill="${tcol(t)}" class="pl-trk${pl.sel === 't|' + t.id ? ' pl-on' : ''}" data-pk="t|${t.id}"><title>${t.id} · ${t.t} · Sector ${t.s}</title></rect>`; });
    }
    if (cap('bt')) P.bt.forEach((z) => {
      const c = circ.get(z.inv), e = zest(c);
      const col = pl.zcol === 'estado' ? ZEST[e] || '#b9c2cf' : '#d64545';
      const w = c && c.completo ? '4.5px' : '2.6px';
      g += `<polyline points="${pts(z.p)}" class="pl-z${pl.sel === 'i|' + z.inv ? ' pl-on' : ''}" style="stroke:${col};stroke-width:${w}${pl.zcol === 'estado' && e === 'no abierta' ? ';stroke-dasharray:4 3' : ''}" data-pk="i|${z.inv}"><title>${z.inv} → ${c ? c.hasta : ''} · zanja ${e || '–'}${c && c.completo ? ' · cable tendido' : ''}</title></polyline>`;
    });
    if (cap('mt')) P.mt.forEach((z) => {
      const c = R.circuitos.find((x) => x.cat === 'MT' && x.designacion === z.c), e = zest(c);
      const col = pl.zcol === 'estado' ? ZEST[e] || '#b9c2cf' : '#2f6fd6';
      g += `<polyline points="${pts(z.p)}" class="pl-z pl-mt${pl.sel === 'm|' + z.c ? ' pl-on' : ''}" style="stroke:${col};stroke-width:5px${pl.zcol === 'estado' && e === 'no abierta' ? ';stroke-dasharray:7 4' : ''}" data-pk="m|${z.c}"><title>${z.c} · ${c ? c.desde + ' → ' + c.hasta : ''} · zanja ${e || '–'}</title></polyline>`;
    });
    if (cap('inv')) P.inv.forEach((v) => { const c = circ.get(v.id); g += `<rect x="${v.x - 1.6}" y="${v.y - 1.6}" width="3.2" height="3.2" class="pl-inv${c && c.completo ? ' ok' : ''}${pl.sel === 'i|' + v.id ? ' pl-on' : ''}" data-pk="i|${v.id}"><title>${v.id}</title></rect>`; });
    if (cap('sts')) P.sts.forEach((s) => { const f = fundInfo(s.id); g += `<g data-pk="e|${s.id}" class="pl-sts${pl.sel === 'e|' + s.id ? ' pl-on' : ''}"><rect x="${s.x - 7}" y="${s.y - 4.5}" width="14" height="9" rx="1.5"/><rect x="${s.x - 7}" y="${s.y - 4.5}" width="${(14 * f.p).toFixed(1)}" height="9" rx="1.5" class="pl-stsf"/><text x="${s.x}" y="${s.y - 7}" class="pl-stst">${s.id} · ${fmt(s.mva, 1)} MVA</text><title>${s.id} · ${fmt(s.mva, 1)} MVA · fundación ${fmt(f.p * 100)} %</title></g>`; });
    if (cap('sect')) P.sect.forEach((s) => { g += `<text x="${s.lx}" y="${s.ly}" class="pl-sectl" style="fill:${SECT_COL[s.n]}">Sector ${s.n}</text>`; });
    const vb = pl.vb || [0, 0, P.W, P.H];
    // panel lateral
    const panel = planoPanel(I);
    el.innerHTML = `<div class="tools"><div class="seg" id="plC"><button data-v="sector">Trackers por sector</button><button data-v="tipo">por tipo</button></div>
        <div class="seg" id="plZ"><button data-v="estado">Zanjas por estado</button><button data-v="tipo">BT rojo / MT azul</button></div>
        <span class="sp"></span><input type="search" id="plQ" placeholder="Buscar TRK-123, TX2-INV5, STS 3…" style="width:240px"></div>
      <div class="plwrap"><div class="card plcard"><svg id="plSvg" viewBox="${vb.join(' ')}" preserveAspectRatio="xMidYMid meet">${g}</svg>
        <div class="plctl"><button data-z="1.4" title="Acercar">+</button><button data-z="0.7" title="Alejar">−</button><button data-z="0" title="Ver todo">⤢</button></div>
        <div class="plcapas">${PL_CAPAS.map(([k, n]) => `<label><input type="checkbox" data-cap="${k}" ${cap(k) ? 'checked' : ''}> ${n}</label>`).join('')}</div>
        <div class="pllegend">${pl.zcol === 'estado' ? `<span><i style="background:${ZEST['no abierta']}"></i>Zanja no abierta</span><span><i style="background:${ZEST.abierta}"></i>abierta</span><span><i style="background:${ZEST.cerrada}"></i>cerrada</span><span><i class="lw"></i>trazo grueso: cable tendido</span>` : '<span><i style="background:#d64545"></i>Zanja BT</span><span><i style="background:#2f6fd6"></i>Zanja MT</span>'}${pl.color === 'tipo' ? '<span><i style="background:#00939a"></i>1P52</span><span><i style="background:#f5a524"></i>1P26</span>' : ''}</div></div>
        <div class="card plpanel">${panel}</div></div>`;
    segBind('#plC', pl.color, (v) => { pl.color = v; render(false); });
    segBind('#plZ', pl.zcol, (v) => { pl.zcol = v; render(false); });
    $$('[data-cap]', el).forEach((c) => { c.onchange = () => { c.checked ? pl.capas.add(c.dataset.cap) : pl.capas.delete(c.dataset.cap); render(false); }; });
    const svg = $('#plSvg', el);
    const setVB = (v) => { pl.vb = v; svg.setAttribute('viewBox', v.map((n) => n.toFixed(1)).join(' ')); };
    const zoom = (f, cx, cy) => { const v = pl.vb || [0, 0, P.W, P.H]; if (!f) { setVB([0, 0, P.W, P.H]); return; } const w = Math.max(30, Math.min(P.W * 1.5, v[2] / f)), h = w * (v[3] / v[2]); cx = cx ?? v[0] + v[2] / 2; cy = cy ?? v[1] + v[3] / 2; setVB([cx - (cx - v[0]) * (w / v[2]), cy - (cy - v[1]) * (h / v[3]), w, h]); };
    const aSvg = (e) => { const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(svg.getScreenCTM().inverse()); };
    svg.addEventListener('wheel', (e) => { e.preventDefault(); const q = aSvg(e); zoom(e.deltaY < 0 ? 1.25 : 0.8, q.x, q.y); }, { passive: false });
    let drag = null, moved = false;
    svg.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, vb: (pl.vb || [0, 0, P.W, P.H]).slice() }; moved = false; svg.setPointerCapture(e.pointerId); });
    svg.addEventListener('pointermove', (e) => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 3) moved = true; if (!moved) return; const k = drag.vb[2] / svg.clientWidth; setVB([drag.vb[0] - dx * k, drag.vb[1] - dy * k, drag.vb[2], drag.vb[3]]); });
    svg.addEventListener('pointerup', (e) => { const was = moved; drag = null; if (was) return; const t = document.elementFromPoint(e.clientX, e.clientY); const k = t && t.closest('[data-pk]'); pl.sel = k ? k.dataset.pk : null; render(false); });
    $$('[data-z]', el).forEach((b) => { b.onclick = () => zoom(Number(b.dataset.z)); });
    const q = $('#plQ', el);
    q.onkeydown = (e) => { if (e.key !== 'Enter') return; const k = planoBuscar(q.value.trim()); if (!k) { toast('No encontrado'); return; } pl.sel = k.pk; pl.vb = [k.x - 60, k.y - 45, 120, 90]; render(false); };
    $$('[data-goc]', el).forEach((b) => { b.onclick = () => { const [v, f] = b.dataset.goc.split('|'); if (f) { ui.q['c' + v.split('-')[0]] = f; ui.sts[v.split('-')[0]] = 'all'; } go(v); }; });
    $$('[data-tend]', el).forEach((b) => { b.onclick = () => tender(b.dataset.tend); });
    $$('[data-pk2]', el).forEach((b) => { b.onclick = () => { pl.sel = b.dataset.pk2; const S2 = P.sect.find((x) => 's|' + x.n === b.dataset.pk2); if (S2) { const xs = S2.p.map((q) => q[0]), ys = S2.p.map((q) => q[1]); const m = 20; pl.vb = [Math.min(...xs) - m, Math.min(...ys) - m, Math.max(...xs) - Math.min(...xs) + 2 * m, Math.max(...ys) - Math.min(...ys) + 2 * m]; } render(false); }; });
  }
  function planoBuscar(s) {
    const P = window.PLANO, u = s.toUpperCase().replace(/\s+/g, ' ');
    let m = u.match(/^TRK-?(\d+)$/) || u.match(/^(\d{1,3})$/);
    if (m) { const id = 'TRK-' + m[1].padStart(3, '0'); const t = P.trk.find((x) => x.id === id); if (t) return { pk: 't|' + id, x: t.x, y: t.y }; }
    const v = P.inv.find((x) => x.id.toUpperCase() === u.replace(/\s/g, '')); if (v) return { pk: 'i|' + v.id, x: v.x, y: v.y };
    m = u.match(/^STS ?(\d)$/); if (m) { const e = P.sts.find((x) => x.id === 'STS ' + m[1]); if (e) return { pk: 'e|' + e.id, x: e.x, y: e.y }; }
    const z = P.mt.find((x) => x.c === u); if (z) { const p = z.p[Math.floor(z.p.length / 2)]; return { pk: 'm|' + z.c, x: p[0], y: p[1] }; }
    return null;
  }
  function planoPanel(I) {
    const { P, circ, zest } = I, sel = ui.pl.sel;
    const fila = (a, b) => `<div class="plf"><span>${a}</span><b>${b}</b></div>`;
    if (!sel) {
      const tot = (f) => P.trk.filter(f).length;
      const bt = [...circ.values()];
      return `<h3>Planta PSFV Oberá II</h3>${fila('Trackers', `${P.trk.length} <small>(${tot((t) => t.t === '1P52')} × 1P52 · ${tot((t) => t.t === '1P26')} × 1P26)</small>`)}
        ${fila('Módulos', fmt(P.trk.reduce((a, t) => a + (t.t === '1P52' ? 52 : 26), 0)))}${fila('Potencia DC aprox.', `${fmt(P.trk.reduce((a, t) => a + (t.t === '1P52' ? 52 : 26), 0) * 0.63 / 1000, 2)} MWp`)}
        ${fila('Inversores', P.inv.length)}${fila('STS', P.sts.slice().sort((a, b) => a.id.localeCompare(b.id)).map((s) => `${s.id.replace('STS ', '')}: ${fmt(s.mva, 1)}`).join(' · ') + ' MVA')}
        ${(() => { const zc = (cat) => { const zs = R.zlist.filter((z) => z.cat === cat); const na = zs.filter((z) => z.estado === 'abierta').length, nc = zs.filter((z) => z.estado === 'cerrada').length; return `${na} abierta${na === 1 ? '' : 's'} · ${nc} cerrada${nc === 1 ? '' : 's'} <small>de ${zs.length}</small>`; }; return fila('Zanjas BT', zc('BT')) + fila('Zanjas MT', zc('MT')); })()}
        ${fila('Cable BT tendido', `${bt.filter((c) => c.completo).length} / ${bt.length} circuitos`)}
        <h4 class="dh">Sectores</h4><div class="plsecs">${P.sect.map((s) => { const n = P.trk.filter((t) => t.s === s.n); return `<button class="plsec" data-pk2="s|${s.n}"><i style="background:${SECT_COL[s.n]}"></i><b>Sector ${s.n}</b><span>${n.length} trackers</span></button>`; }).join('')}</div>
        <p class="hint">Rueda del mouse: zoom · arrastrar: mover · tocá un tracker, un inversor, una zanja o un STS para ver su información. Potencia con módulos de 625 a 635 W (distribución por tracker a definir).</p>`;
    }
    const [k, id] = sel.split('|');
    if (k === 't') {
      const t = P.trk.find((x) => x.id === id), n = t.t === '1P52' ? 52 : 26;
      return `<h3>${t.id}</h3>${fila('Tipo', `Trina ${t.t}${t.v ? ' ' + t.v : ''} · 60°`)}${fila('Módulos', `${n} · ${t.t === '1P52' ? '≈ 60 m' : '≈ 30 m'}`)}${fila('Potencia', KWP(n))}${fila('Sector', t.s)}
        ${fila('Hincado', '<span class="muted">módulo en preparación</span>')}<p class="hint">Potencia según el panel instalado (625, 630 o 635 W).</p>`;
    }
    if (k === 'i') {
      const c = circ.get(id); if (!c) return `<h3>${esc(id)}</h3><p class="muted">Sin circuito en la lista de cables.</p>`;
      const e = zest(c), z = R.zlist.find((x) => x.id === c.zid);
      return `<h3>${esc(id)}</h3>${fila('Circuito', esc(c.designacion))}${fila('Destino', esc(c.hasta))}${fila('Cable', `${c.seccion} mm² · ${c.fz.length} conductores`)}${fila('Largo por conductor', fmt(c.lenFase, 1) + ' m')}
        ${fila('Zanja', `<span class="kst" style="--c:${ZEST[e] === '#b9c2cf' ? '#7a8aa3' : ZEST[e]}">${e}</span>${z && z.miembros.length > 1 ? ' · compartida' : ''}`)}${fila('Largo de zanja', z ? fmt(z.largo, 1) + ' m' : '–')}
        ${fila('Tendido', c.completo ? '✓ completo' : `${c.nReal}/${c.fz.length} conductores`)}${fila('Bobinas', [...new Set(c.fz.map((f) => (c.fasesInfo[f] || {}).bobina).filter(Boolean))].map(esc).join(', ') || '–')}
        <div class="plact"><button class="btn sm" data-goc="BT-circ|${esc(id)}">Ver circuito</button>${window.READONLY ? '' : `<button class="btn sm acc" data-tend="${c.id}">Tender</button>`}</div>`;
    }
    if (k === 'm') {
      const c = R.circuitos.find((x) => x.cat === 'MT' && x.designacion === id); if (!c) return `<h3>${esc(id)}</h3>`;
      const e = zest(c);
      return `<h3>${esc(id)} · MT 33 kV</h3>${fila('Recorrido', `${esc(c.desde)} → ${esc(c.hasta)}`)}${fila('Cable', esc(c.formacion || c.seccion + ' mm²'))}${fila('Largo por conductor', fmt(c.lenFase, 1) + ' m')}${fila('Zanja', e)}${fila('Tendido', c.completo ? '✓ completo' : `${c.nReal}/${c.fz.length}`)}
        <div class="plact"><button class="btn sm" data-goc="MT-circ">Ver circuitos MT</button>${window.READONLY ? '' : `<button class="btn sm acc" data-tend="${c.id}">Tender</button>`}</div>`;
    }
    if (k === 'e') {
      const s = P.sts.find((x) => x.id === id), f = fundInfo(id), cs = R.circuitos.filter((c) => c.cat === 'BT' && c.hasta === id);
      return `<h3>${id}</h3>${fila('Potencia', fmt(s.mva, 1) + ' MVA')}${fila('Fundación', `${fmt(f.p * 100)} % · ${f.done}/${f.n} etapas`)}${fila('Etapa', f.done === f.n ? 'terminada' : f.curso.length ? 'en curso: ' + esc(f.curso.map(([kk]) => ETN[kk]).join(', ')) : 'próxima: ' + esc(f.sig[1]))}
        ${fila('Inversores', cs.length)}${fila('Cable BT tendido', `${cs.filter((c) => c.completo).length} / ${cs.length}`)}<div style="max-width:240px;margin:8px auto">${stsSVG(f.p)}</div>
        <div class="plact"><button class="btn sm" data-goc="fundaciones">Ver fundaciones</button></div>`;
    }
    if (k === 's') {
      const n = Number(id), ts = P.trk.filter((t) => t.s === id), mods = ts.reduce((a, t) => a + (t.t === '1P52' ? 52 : 26), 0);
      return `<h3><i class="cdot" style="background:${SECT_COL[n]}"></i>Sector ${id}</h3>${fila('Trackers', `${ts.length} <small>(${ts.filter((t) => t.t === '1P52').length} × 1P52 · ${ts.filter((t) => t.t === '1P26').length} × 1P26)</small>`)}${fila('Módulos', fmt(mods))}${fila('Potencia DC aprox.', fmt(mods * 0.63, 0) + ' kWp')}
        ${fila('Desde', ts[0] ? ts.map((t) => t.id).sort()[0] + ' a ' + ts.map((t) => t.id).sort().pop() : '–')}<p class="hint">El código de tracker no siempre es correlativo dentro del sector.</p>`;
    }
    return '';
  }
  function printPlano() {
    const svg = $('#plSvg'); if (!svg) return;
    const cl = svg.cloneNode(true); cl.removeAttribute('id'); cl.setAttribute('class', 'plprint');
    printHTML(prHead('Plano de obra') + `<div class="card">${cl.outerHTML}<div class="pllegend">${$('.pllegend').innerHTML}</div></div>`, `Plano de obra ${today()}.pdf`, true);
  }

  // ======================= impresión =======================
  async function printPlan(cat, modo) {
    const cMap = new Map(R.circuitos.map((c) => [c.id, c]));
    const bobs = R.bobinas.filter((b) => b.cat === cat && (modo === 'listos' ? b.cortes.some((p) => p.estado === 'listo') : b.cortes.length));
    if (!bobs.length) { toast(modo === 'listos' ? 'No hay cortes listos: falta abrir zanjas o cargar bobinas' : 'No hay cortes en el plan'); return; }
    const est = { ejecutado: 'Ejecutado', listo: 'Cortar', provisorio: 'Provisorio' };
    let h = `<div class="pr-h"><div><h1>${modo === 'listos' ? 'Hoja de corte' : 'Plan de corte'} · ${CATN[cat]}</h1>${esc(S.nombre)}</div><div>${new Date().toLocaleString('es-AR')}</div></div>`;
    bobs.forEach((b) => {
      const cortes = modo === 'listos' ? b.cortes.filter((p) => p.estado !== 'provisorio') : b.cortes;
      h += `<div class="pr-bob"><h2><span>Bobina ${esc(b.codigo)} · N° ${esc(b.nro)} · ${b.seccion} mm²</span><span>Entrada ${fmt(b.entrada)} m · saldo actual ${fmt(b.saldoActual, 1)} m</span></h2>
        <table><tr><th>#</th><th>Estado</th><th>Circuito</th><th>Desde → Hasta</th><th>Fase</th><th class="n">Metros</th><th class="n">Saldo</th><th>OK</th></tr>
        ${cortes.map((p) => { const c = cMap.get(p.cid); return `<tr class="${p.estado}"><td>${p.corte}</td><td>${est[p.estado]}</td><td>${esc(c.designacion)}</td><td>${esc(c.desde)} → ${esc(c.hasta)}</td><td>${p.fase === 'C' ? '' : p.fase}</td><td class="n">${fmt(p.len, 2)}</td><td class="n">${fmt(p.saldo, 1)}</td><td>${p.estado === 'ejecutado' ? '✓' : '<span class="chk"></span>'}</td></tr>`; }).join('')}
        </table></div>`;
    });
    $('#printArea').innerHTML = h;
    document.documentElement.style.background = document.body.style.background = '#fff';
    const p = await window.api.printPDF(`${modo === 'listos' ? 'Hoja de corte' : 'Plan de corte'} ${cat} ${today()}.pdf`);
    document.documentElement.style.background = document.body.style.background = '';
    if (p) toast('PDF guardado', { action: ['Abrir', () => window.api.openPath(p)] });
  }

  // ======================= inicio =======================
  async function init() {
    $$('#nav button[data-view], .sfBtn').forEach((b) => { b.onclick = () => go(b.dataset.view); });
    let secSt = {}; try { secSt = JSON.parse(localStorage.getItem('navSect') || '{}'); } catch (_) { /* sin storage */ }
    $$('#nav .sect').forEach((x) => { if (x.dataset.sect in secSt) x.classList.toggle('open', !!secSt[x.dataset.sect]); $('.secth', x).onclick = () => abrirSect(x, !x.classList.contains('open')); $('.sectb', x).addEventListener('transitionend', () => pillUpd()); });
    const r = await window.api.load();
    const st = JSON.parse(r.text);
    // migración: agregar circuitos de MT de la lista de cables si el proyecto no los tiene
    if (!r.seed && !(st.circuitos || []).some((c) => c.cat === 'MT')) {
      seedCache = JSON.parse(await window.api.seed());
      st.circuitos = (st.circuitos || []).concat(seedCache.circuitos.filter((c) => c.cat === 'MT'));
      st.fuente = seedCache.fuente;
    }
    // migración: cronograma de obra (Rev A s07) si el proyecto no lo tiene
    if (!window.READONLY && !st.cronoMeta && !(st.cronoTareas || []).length) {
      seedCache = seedCache || JSON.parse(await window.api.seed());
      st.cronoTareas = seedCache.cronoTareas || []; st.cronoMeta = seedCache.cronoMeta || null;
    }
    S = normalizar(st);
    Sync.ordenar(S);
    R = Engine.calcular(S); S.compromiso = R.compromiso;
    NET = await window.api.netCfg();
    if (window.READONLY) { window.api.onNetReq = () => {}; }
    Sync.base(S, NET.modo);
    if (NET.modo === 'servidor') Sync.prepararServidor(S);
    Sync.sellar(S, NET.modo);
    await window.api.save(JSON.stringify(S));
    window.api.onNetReq(atenderRed);
    if (!window.READONLY && window.api.webCfg) WEB = await window.api.webCfg();
    window.api.netObra(S.nombre);
    setTimeout(async () => {
      if (NET.modo !== 'local') return;
      const f = await window.api.netServidores();
      if (f.length) toast(`Hay un servidor de obra en la red (${f[0].obra || f[0].host})`, { action: ['Conectar', () => conectarEncontrado(f[0])], ms: 12000 });
    }, 6000);
    arrancarRed();
    window.api.onOpenFile((d) => { try { cargarTexto(d.text); toast('Proyecto abierto'); } catch (e) { toast('Archivo inválido', { err: true }); } });
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key.toLowerCase() === 's') { e.preventDefault(); guardarComo(); }
      if (e.ctrlKey && e.key.toLowerCase() === 'o') { e.preventDefault(); abrir(); }
    });
    go('resumen');
  }
  function recargar(text) { const st = JSON.parse(text); S = normalizar(st); Sync.ordenar(S); R = Engine.calcular(S); render(false); toast('Datos actualizados'); }
  window.__app = { revisarBuzon, aplicarCrono, tareasDeProject, fechaEtapa, cronoCalc, editTarea, leerMSPDI, setEtapa, printFund, exportFund, printDia, printMes, printAvance, printPuntas, exportTendidos, exportPuntas, registrarPuntas, recargar, get S() { return S; }, get R() { return R; }, go, commit, setZanja, tender, cerrarZanjas, sacarDeZanja, Engine, conectar, syncNow, get NET() { return NET; }, get netStatus() { return netStatus; } };
  init();
})();
