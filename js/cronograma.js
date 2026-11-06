/* PSFV-OBE II · Cronograma de obra (MS Project), Gantt y buzón del visor. */
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
  actions([['Exportar Excel', 'btn', () => exportCrono()], ['Exportar PDF', 'btn', () => printCrono()], ['Actualizar cronograma (Project)', 'btn', importarCrono], ['Resumen del cronograma', 'btn pri', () => go('crono')]]);
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
      if (it.ext === 'parte') { try { recibirParte(JSON.parse(it.text), it.nombre); hechos.push(it.ruta); } catch (e) { hechos.push(it.ruta); } continue; }
      try { const d = it.json || leerMSPDI(it.text); aplicarCrono(d, { keep: true, fuente: it.archivo, por: it.nombre }); hechos.push(it.ruta); toast(`Cronograma actualizado desde el visor por ${it.nombre} (${it.archivo})`, { ms: 9000 }); }
      catch (e) { hechos.push(it.ruta); toast(`No se pudo aplicar ${it.archivo}: ${e.message}`, { err: true, ms: 9000 }); }
    }
    if (hechos.length) { await window.api.webBuzonBorrar(hechos); publicarWeb(false); }
  } catch (_) { /* reintenta */ } finally { buzonBusy = false; }
}
setInterval(revisarBuzon, 60000); setTimeout(revisarBuzon, 15000);
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
