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
    if (window.READONLY) btns = btns.filter(([t]) => /Exportar|PDF/.test(t));
    btns.forEach(([txt, cls, fn]) => { const b = document.createElement('button'); b.className = cls; b.innerHTML = txt; b.onclick = fn; a.appendChild(b); });
  }

  // ======================= navegación =======================
  const VIEWS = {
    resumen: ['Resumen', () => `${esc(S.nombre)}`],
    avance: ['Avance', () => 'Porcentaje tendido por apartado, por STS, en el tiempo, zanjas y bobinas'],
    propuesta: ['Propuesta de tendido', () => 'Lotes de zanjas por zona, del tamaño de una bobina, en el orden sugerido para abrir'],
    zanjas: ['Zanjas', () => 'Estado de cada zanja (BT y MT) y metros realizados. Una zanja se cierra cuando tiene el cable y la PAT tendidos'],
    'BT-plan': ['Plan de corte', () => 'Cables de aluminio inversor → STS · los cortes listos quedan fijos en su bobina'],
    'BT-circ': ['Circuitos', () => 'Tendidos inversor → STS: zanja y registro de lo ejecutado'],
    'MT-plan': ['Plan de corte', () => 'Cables de media tensión entre STS, sala de celdas y LMT · los cortes listos quedan fijos en su bobina'],
    'MT-circ': ['Circuitos', () => 'STS 4 → 3 → sala de celdas · STS 1 → 2 → sala de celdas · sala de celdas → LMT · fin LMT → ET'],
    'PAT-plan': ['Plan de corte', () => 'Cobre desnudo: 25 mm² en zanjas de BT, 95 mm² en zanjas de MT · los cortes listos quedan fijos en su bobina'],
    'PAT-circ': ['Tendidos', () => 'Un conductor de Cu desnudo por zanja (compartida o no), con el largo de la zanja'],
    bobinas: ['Bobinas', () => 'Ingreso de bobinas de BT, MT y PAT, saldo actual y remanente previsto'],
    ajustes: ['Ajustes', () => 'Parámetros del cálculo y datos del proyecto'],
  };
  function go(v) {
    view = v; ui.sel.clear();
    $$('.sfBtn').forEach((b) => b.classList.toggle('on', b.dataset.view === v)); $('#navPill').style.opacity = v === 'ajustes' ? 0 : 1;
    $$('#nav button').forEach((b) => { b.classList.toggle('on', b.dataset.view === v); if (b.dataset.view === v) { const pl = $('#navPill'); pl.style.transform = `translateY(${b.offsetTop}px)`; pl.style.left = b.offsetLeft + 'px'; pl.style.width = b.offsetWidth + 'px'; pl.style.height = b.offsetHeight + 'px'; pl.style.right = 'auto'; if (window.innerWidth > 860) b.scrollIntoView({ block: 'nearest' }); } });
    render(true);
  }
  function render(anim) {
    const [t, sub] = VIEWS[view];
    const vc = view.split('-')[0];
    $('#vMod').textContent = view === 'ajustes' ? 'General' : 'Tendido y aprovechamiento de cables';
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
    else ({ resumen: vResumen, avance: vAvance, propuesta: vPropuesta, zanjas: vZanjas, bobinas: vBobinas, ajustes: vAjustes })[view](el);
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
    actions([['Exportar Excel', 'btn', exportExcel]]);
    const sumCat = (cat) => { const rs = R.resumen.filter((r) => r.cat === cat); const f = (k) => rs.reduce((a, r) => a + r[k], 0); return { req: f('requerido'), tend: f('tendido'), listo: f('listo') }; };
    const nC = (cat) => { const cs = R.circuitos.filter((c) => c.cat === cat); return [cs.filter((c) => c.completo).length, cs.length]; };
    let h = `<div class="grid g3 stagger" style="margin-bottom:16px">`;
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
    el.innerHTML = h + '</div>';
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
        <td><div class="chips">${z.miembros.map((c) => `<span class="chip ${c.completo ? 'lista' : ''}" title="${esc(c.desde)} → ${esc(c.hasta)}">${esc(c.designacion)}</span>`).join('')}</div></td>
        <td class="n"><input type="number" class="zl" step="0.1" min="0" value="${z.largo}" title="Largo de zanja según plano"></td><td>${zSeg(z.id, z.estado, z.listoCerrar)}</td><td>${z.nReal}/${z.nCond} ${z.completo ? '✓' : ''}</td>
        <td>${patOk ? `<span class="pill p-done">${esc(z.pat.fasesInfo.C.bobina)}</span>` : '<span class="muted">pendiente</span>'}</td>
        <td style="white-space:nowrap"><button class="btn sm acc" data-a="tc">Cable</button> <button class="btn sm" data-a="tp">PAT</button><button class="btn sm ghost" data-a="ez" title="Editar zanja">✎</button></td></tr>`;
    });
    el.innerHTML = h + `</tbody></table></div><p class="hint">Si varios circuitos van por la misma zanja, tildalos y tocá <b>Misma zanja</b>: quedan con un solo estado, un solo largo y una sola PAT. El largo se carga directo en la tabla (por ejemplo, del plano); con ✎ cambiás el nombre o separás un circuito. Abierta: se puede tender y el plan le asigna bobina primero. Cerrada: requiere cable y PAT registrados (si no, pide confirmación).</p>`;
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
  const zSeg = (zid, est, okCerrar) => `<span class="zseg" data-id="${zid}">${Engine.ZANJA.map((z) => `<button data-z="${z}" class="${est === z ? 'on z' + z.replace(' ', '') : ''}" ${z === 'cerrada' && !okCerrar && est !== 'cerrada' ? 'title="Falta registrar cable o PAT"' : ''}>${z === 'no abierta' ? 'No' : z === 'abierta' ? 'Abierta' : 'Cerrada'}</button>`).join('')}</span>`;
  function bindZSeg(el) {
    $$('.zseg button', el).forEach((b) => { b.onclick = async (e) => { e.stopPropagation(); const tr = b.closest('tr[data-id]'); ui.flashKeep = tr ? [tr.dataset.id] : null; await setZanja([b.parentElement.dataset.id], b.dataset.z); }; });
  }
  async function setZanja(zids, est) {
    if (window.READONLY) return;
    zids = [...new Set(zids)].filter(Boolean);
    const zs = zids.map((id) => S.zanjas.find((x) => x.id === id)).filter(Boolean);
    const rz = zids.map((id) => R.zlist.find((x) => x.id === id)).filter(Boolean);
    if (est === 'cerrada') {
      const falt = rz.filter((z) => !z.listoCerrar && z.estado !== 'cerrada');
      if (falt.length && !(await confirmar('Cerrar zanja', `${falt.length === 1 ? `La zanja ${esc(falt[0].titulo)} no tiene` : `${falt.length} zanjas no tienen`} registrado el tendido completo del cable y la PAT. ¿Cerrar igual?`, 'Cerrar igual'))) return;
    }
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
      body: z.miembros.map((c) => `<div class="phase-row" style="grid-template-columns:1fr auto auto"><div><b class="mono">${esc(c.designacion)}</b> · ${esc(c.desde)} → ${esc(c.hasta)}</div><span>${c.nReal}/${c.fz.length}</span><button class="btn sm acc" data-id="${c.id}">Tender</button></div>`).join(''),
      buttons: [['Cerrar', 'btn', () => null]] });
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
          ${rz.miembros.length > 1 ? `<button class="btn sm" data-sep="${c.id}">Separar</button>` : ''}</div>`).join('')}`,
      buttons: [['Cancelar', 'btn', () => null], ['Guardar', 'btn pri', (box) => {
        z.nombre = $('[name=nombre]', box).value.trim() || undefined; if (!z.nombre) delete z.nombre;
        z.largo = Number($('[name=largo]', box).value) || 0; z.estado = $('[name=estado]', box).value;
        const fc = $('[name=fc]', box).value; if (fc) z.fechaCierre = fc; else delete z.fechaCierre;
        return 'ok';
      }]] });
    if (res === 'ok') commit('Zanja actualizada');
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-sep]'); if (!b) return;
    Engine.separarCircuito(S, b.dataset.sep); $('#modal').classList.add('hidden'); commit('Circuito separado: ahora tiene zanja propia');
  });
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
      if (r && r.bobina) return `<div class="phase-row" style="grid-template-columns:56px 1fr 180px"><b>${f === 'C' ? 'Cu' : f}</b><span class="muted">Ya tendida desde ${esc(r.bobina)} (${fmt(r.metros, 2)} m)</span><span></span></div>`;
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
    if (!bobs.length) { toast(`No hay bobinas de ${CATN[rc.cat]} ${rc.seccion} mm² cargadas`, { err: true }); return; }
    const opts = (sel) => `<option value="">—</option>` + bobs.map((b) => `<option value="${esc(b.codigo)}" ${sel === b.codigo ? 'selected' : ''}>${esc(b.codigo)} · saldo ${fmt(b.saldoActual, 1)} m</option>`).join('');
    const lbl = (f) => (f === 'C' ? 'Cu' : f);
    const teo = Math.round((Number(c.cantidad) || 0) / rc.fz.length * 100) / 100;
    const rows = rc.fz.map((f) => {
      const r = (c.real || {})[f], plan = rc.fasesInfo[f] || {}, done = !!(r && r.bobina);
      return `<div class="phase-row pr6" data-f="${f}"><label class="fz"><input type="checkbox" class="on" ${done ? 'checked' : ''}> ${lbl(f)}</label>
        <select class="bob">${opts(done ? r.bobina : plan.bobina || '')}</select>
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
        real[row.dataset.f] = { bobina: b, metros: m > 0 ? Math.round(m * 100) / 100 : teo, fecha: $('.d', row).value };
      }
      c.real = real;
      return 'ok';
    }
    if (res === 'ok') {
      ui.flash = [id, c.vinculo || c.zanjaId];
      const zc = S.zanjas.find((z) => z.id === (c.vinculo || c.zanjaId));
      if (Object.keys(c.real).length && zc && zc.estado === 'no abierta') zc.estado = 'abierta';
      commit(`Tendido de ${c.designacion} actualizado`);
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
      netStatus = { ok: true, msg: '', cuando: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) };
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
  function atenderRed({ id, body }) {
    try {
      if (NET.modo !== 'servidor') { window.api.netReply(id, { error: 'no es servidor' }); return; }
      const { aplicados } = Sync.atender(S, body);
      if (aplicados) { S = normalizarRed(S); commitRed(`${aplicados} cambios recibidos de ${body.nombre || 'otra PC'}`); }
      window.api.netReply(id, Sync.respuesta(S, Number(body.since) || 0));
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
      <div id="wUs">${us.map((u) => `<div class="phase-row wu" style="grid-template-columns:1fr 1fr auto"><input type="text" class="wn" value="${esc(u.nombre)}" readonly><input type="password" class="wp" placeholder="(sin cambios)"><button class="btn sm ghost danger wx">Quitar</button></div>`).join('')}</div>
      <button class="btn sm" id="wAdd" style="margin-top:6px">+ Usuario</button>
      <label style="display:flex;gap:8px;align-items:center;margin-top:12px;font-size:13px"><input type="checkbox" id="wAuto" ${WEB.auto !== false ? 'checked' : ''}> Publicar automáticamente cuando haya cambios (como máximo cada 90 segundos)</label>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn pri" id="wSave">Guardar</button><button class="btn" id="wViz">Instalar / actualizar visor</button><button class="btn acc" id="wPub" ${webListo() ? '' : 'disabled'}>Publicar ahora</button></div>
      <details class="manual"><summary>Cómo se configura (una sola vez)</summary><ol style="line-height:1.6;padding-left:18px;font-size:12.5px">
        <li>Crear una cuenta en github.com (gratis) y un repositorio <b>público</b> nuevo, por ejemplo "obera-ii", marcando "Add a README".</li>
        <li>En GitHub: <i>Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token</i>. Elegir solo ese repositorio y dar permiso <b>Contents: Read and write</b> y <b>Pages: Read and write</b>. Copiar el token.</li>
        <li>Acá: cargar usuario de GitHub, repositorio y token, agregar los usuarios del visor con su contraseña (mínimo 8 caracteres) y tocar <b>Guardar</b>.</li>
        <li>Tocar <b>Instalar / actualizar visor</b> y después <b>Publicar ahora</b>. Si GitHub Pages no se activa solo: en el repositorio, <i>Settings → Pages → Deploy from a branch → main / (root)</i>.</li>
        <li>Pasar la dirección del visor y a cada persona su usuario y contraseña. La primera publicación tarda 1 a 2 minutos en aparecer.</li></ol>
        <p class="hint">Los datos viajan y quedan guardados cifrados (AES-256); sin usuario y contraseña no se pueden leer. Para quitarle el acceso a alguien, se lo quita de la lista: desde la próxima publicación ya no puede abrir los datos.</p></details>`;
    const fila = () => `<div class="phase-row wu" style="grid-template-columns:1fr 1fr auto"><input type="text" class="wn" placeholder="usuario (ej. jgarcia)"><input type="password" class="wp" placeholder="contraseña"><button class="btn sm ghost danger wx">Quitar</button></div>`;
    $('#wAdd').onclick = () => { $('#wUs').insertAdjacentHTML('beforeend', fila()); bindX(); };
    const bindX = () => $$('.wx', box).forEach((b) => { b.onclick = () => b.closest('.wu').remove(); });
    bindX();
    if ($('#wUrl')) $('#wUrl').onclick = (e) => { e.preventDefault(); window.api.openUrl(webUrl()); };
    $('#wSave').onclick = async () => {
      const usuarios = $$('.wu', box).map((r) => ({ nombre: $('.wn', r).value.trim(), password: $('.wp', r).value }));
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
      if (r.ok) toast(`Visor instalado (${r.archivos} archivos). GitHub Pages: ${r.pages === 'manual' ? 'activalo en Settings → Pages' : r.pages}`, { ms: 8000 });
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
    const p = await window.api.printPDF(`${modo === 'listos' ? 'Hoja de corte' : 'Plan de corte'} ${cat} ${today()}.pdf`);
    if (p) toast('PDF guardado', { action: ['Abrir', () => window.api.openPath(p)] });
  }

  // ======================= inicio =======================
  async function init() {
    $$('#nav button, .sfBtn').forEach((b) => { b.onclick = () => go(b.dataset.view); });
    const r = await window.api.load();
    const st = JSON.parse(r.text);
    // migración: agregar circuitos de MT de la lista de cables si el proyecto no los tiene
    if (!r.seed && !(st.circuitos || []).some((c) => c.cat === 'MT')) {
      seedCache = JSON.parse(await window.api.seed());
      st.circuitos = (st.circuitos || []).concat(seedCache.circuitos.filter((c) => c.cat === 'MT'));
      st.fuente = seedCache.fuente;
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
  window.__app = { recargar, get S() { return S; }, get R() { return R; }, go, commit, setZanja, conectar, syncNow, get NET() { return NET; }, get netStatus() { return netStatus; } };
  init();
})();
