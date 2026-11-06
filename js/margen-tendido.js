/* PSFV-OBE II · Simulación de tendido, margen de stock y reloj de margen. */
// ======================= SIMULAR TENDIDO =======================
// Prueba sin guardar nada: los circuitos listos para tender se dan por tendidos con un exceso sobre la lista,
// se recalcula el plan y se compara el aprovechamiento (faltantes, remanentes, margen de stock para lo que falta).
const clonEstado = () => JSON.parse(JSON.stringify(S, (k, v) => (k === '__sync' ? undefined : v)));
const margenStock = (st, cat, key) => Margen.pct(st, cat, key);
const margenMetros = (st, cat, key) => Margen.metros(st, cat, key);
// ---- reloj de margen: se recalcula en segundo plano cada vez que cambia el plan
const MG = { R: null, datos: null, tarea: null };
const tolF = () => Math.max(0, Math.min(100, Number(S.params.tolSeg != null ? S.params.tolSeg : 50))) / 100;
const mgDe = (key) => (MG.R === R && MG.datos ? MG.datos.find((g) => g.key === key) : null);
function margenAlDia() {
  if (MG.R === R || !R) return;
  if (MG.tarea && MG.tarea.R === R) return;
  if (MG.tarea) MG.tarea.cancelar();
  const R0 = R; dibujarReloj(true);
  MG.tarea = Margen.enSegundoPlano(clonEstado(), R0, { demora: 250 }, (d) => {
    if (R !== R0) return;
    MG.R = R0; MG.datos = d; MG.tarea = null; dibujarReloj();
    if (/^(BT|MT)-plan$/.test(view)) render(false);
    else { const box = $('#mgStrip'); if (box && /-plan$/.test(view)) box.innerHTML = margenStrip(view.split('-')[0]); }
    const tb = $('#tolBox'); if (tb && tb.dataset.key) tb.innerHTML = tolHTML(mgDe(tb.dataset.key), Number(tb.dataset.l));
  });
  MG.tarea.R = R0;
}
const enFalta = (g) => g.faltante > 0 || g.pct.x == null;
function peorMargen() {
  // la aguja muestra la sección más ajustada que todavía tiene margen; las que ya no alcanzan van aparte, en rojo
  const ds = (MG.datos || []).filter((g) => g.nCond > 0 && !enFalta(g));
  return ds.length ? ds.slice().sort((a, b) => a.pct.x - b.pct.x)[0] : null;
}
// dibujo del reloj: aguja en la sección más ajustada con margen; las que no alcanzan, en rojo aparte
function relojHTML(ds, calc) {
  const vivas = ds.filter((g) => g.nCond > 0 && !enFalta(g)), fal = ds.filter((g) => g.nCond > 0 && enFalta(g));
  const g = vivas.length ? vivas.slice().sort((a, b) => a.pct.x - b.pct.x)[0] : null, MAX = 15;
  const avisoF = fal.length ? `<div class="rlj-f">⚠ ${fal.map((x) => `${x.cat} ${x.seccion} mm²: faltan ${fmt(x.faltante)} m`).join('<br>⚠ ')}</div>` : '';
  if (!g && !fal.length) return { cls: 'rlj', html: '', vacio: true };
  if (!g) return { cls: 'rlj bad', html: `<div class="rlj-v">Falta cable</div>${avisoF}` };
  const v = Math.max(0, Math.min(MAX, g.pct.x));
  const ang = Math.PI * (1 - v / MAX), cx = 70, cy = 66, r = 52;
  const px = (a, rr) => [cx + rr * Math.cos(a), cy - rr * Math.sin(a)];
  const pt = (a, rr) => px(a, rr).map((n) => n.toFixed(1)).join(',');
  const arco = (a0, a1, cls) => `<path class="${cls}" d="M${pt(Math.PI * (1 - a0 / MAX), r)} A${r},${r} 0 0 1 ${pt(Math.PI * (1 - a1 / MAX), r)}"/>`;
  const n = px(ang, r - 10);
  return { cls: 'rlj ' + Margen.color(g) + (fal.length ? ' conf' : '') + (calc ? ' calc' : ''),
    html: `<svg viewBox="0 0 140 76">${arco(0, 1, 'z-bad')}${arco(1, 3, 'z-warn')}${arco(3, MAX, 'z-ok')}
      <line class="ndl" x1="${cx}" y1="${cy}" x2="${n[0].toFixed(1)}" y2="${n[1].toFixed(1)}"/><circle class="hub" cx="${cx}" cy="${cy}" r="4.5"/>
      <text x="${cx - r}" y="${cy + 9}" class="tk" text-anchor="middle">0</text><text x="${cx + r}" y="${cy + 9}" class="tk" text-anchor="middle">${MAX}%</text></svg>
      <div class="rlj-v">+${fmt(g.pct.x, 1)} %${g.pct.mas ? '+' : ''}</div>
      <div class="rlj-t">margen · ${esc(g.cat + ' ' + g.seccion)} mm²${g.m && g.m.x != null ? ` · ${fmt(g.m.x, 1)} m/cond.` : ''}</div>${avisoF}` };
}
function dibujarReloj(calc) {
  // un reloj por grupo, dentro del plan de corte de BT, MT o PAT (junto a las tarjetas de margen)
  const el = $('#mgReloj'); if (!el) return;
  const cat = el.dataset.cat;
  if (!MG.datos || MG.R !== R) { el.className = 'mgr rlj calc'; el.innerHTML = '<div class="rlj-t">Calculando el margen…</div>'; return; }
  const sec = (ui.sec || {})[cat] || 'all';
  const o = relojHTML(MG.datos.filter((g) => g.cat === cat && (sec === 'all' || String(g.seccion) === sec)), calc);
  const tit = `Reloj de margen · ${CATN[cat]}${sec === 'all' ? '' : ` · ${sec} mm²`}`;
  el.className = 'mgr ' + o.cls; el.innerHTML = o.vacio ? `<div class="mgrh">${tit}</div><div class="rlj-t">Todo tendido</div>` : `<div class="mgrh">${tit}</div>` + o.html; el.onclick = verMargenes;
}
function tolHTML(g, L) {
  if (!g) return '<span class="muted">Calculando la tolerancia…</span>';
  const t = Margen.tolerancia(g, L, tolF());
  if (!t) return '';
  if (t.sinMargen) return `<span class="tl bad">Sin margen en ${g.seccion} mm²</span> · no conviene pasarse de <b>${fmt(L, 1)} m</b> por conductor (tirar de menos siempre suma)`;
  return `<span class="tl">Tolerancia ${g.cat} ${g.seccion} mm² (margen +${fmt(t.P, 1)} %)</span>
    <span class="tlv ok">Seguro ≤ <b>${fmt(t.seg, 1)} m</b></span><span class="tlv warn">Riesgo ≤ <b>${fmt(t.max, 1)} m</b></span><span class="tlv bad">Más: falta de cable</span>`;
}
async function verMargenes() {
  margenAlDia();
  const ds = MG.datos || [];
  const f = tolF();
  const fila = (g) => { const c = Margen.color(g), fal = g.faltante > 0 || g.pct.x == null;
    return `<tr><td><span class="chip">${g.cat}</span> <b>${g.seccion} mm²</b></td><td class="n"><span class="sv ${c}">${fal ? 'falta' : `+${fmt(g.pct.x, 1)} %${g.pct.mas ? ' o más' : ''}`}</span></td>
      <td class="n">${g.m && g.m.x != null ? `+${fmt(g.m.x, 1)} m${g.m.mas ? '+' : ''}` : '–'}</td><td class="n">${fal ? '–' : `+${fmt(g.pct.x * f, 1)} %`}</td>
      <td class="n">${fmt(g.nCond)} · ${fmt(g.mPend)} m</td><td class="n ${g.sobra < 0 ? 'neg' : ''}">${fmt(g.sobra)} m</td><td>${fal ? `<span class="pill p-bad">faltan ${fmt(g.faltante)} m</span>` : c === 'ok' ? '<span class="pill p-done">holgado</span>' : c === 'warn' ? '<span class="pill p-warn">ajustado</span>' : '<span class="pill p-bad">crítico</span>'}</td></tr>`; };
  await modal({ title: 'Margen de tendido', wide: true, sub: 'Cuánto más largo que el plan puede salir lo que falta tender, con el cable que hay, sin que falte al final. Cambia con cada zanja que se abre y cada tendido que se registra.',
    body: ds.length ? `<table class="tbl"><thead><tr><th>Sección</th><th class="n">Margen</th><th class="n">o por conductor</th><th class="n">Tolerancia segura</th><th class="n">Por tender</th><th class="n">Sobrante final</th><th>Estado</th></tr></thead><tbody>${ds.map(fila).join('')}</tbody></table>
      <div class="tolx"><div><span class="tlv ok">Seguro</span> hasta el plan + ${fmt(f * 100)} % del margen</div><div><span class="tlv warn">Riesgo</span> hasta el plan + todo el margen</div><div><span class="tlv bad">Falta de cable</span> más que eso: si todo lo que falta saliera así, no alcanza</div></div>
      <p class="hint">Tirar de menos siempre es favorable. Los valores de cada conductor (seguro / riesgo) aparecen al registrar el tendido, en el plan de corte y en la app de campo. La parte "segura" del margen se ajusta en Ajustes (hoy ${fmt(f * 100)} %).</p>`
      : '<p class="muted">Calculando… volvé a abrir en unos segundos.</p>', buttons: [['Cerrar', 'btn pri', () => null]] });
}
const margenesCache = (cat) => (MG.datos || []).filter((g) => g.cat === cat);
const nivel = (g) => (g.pct.x == null || g.m.x == null || g.faltante > 0 ? 'bad' : g.pct.x < 1 || g.m.x < 0.5 ? 'bad' : g.pct.x < 3 ? 'warn' : 'ok');
function margenStrip(cat) {
  const sec = (ui.sec || {})[cat] || 'all';
  const gs = margenesCache(cat).filter((g) => sec === 'all' || String(g.seccion) === sec);
  if (!gs.length) return '';
  setTimeout(() => dibujarReloj(), 0);
  return `<div class="mgrow"><div class="mgs">${gs.map((g) => {
    const nv = nivel(g);
    const cuerpo = g.faltante > 0 || g.pct.x == null
      ? `<b class="bad">No alcanza</b><span>faltan ${fmt(g.faltante)} m aun cortando justo</span>`
      : `<b class="${nv}">+${fmt(g.pct.x, 1)} %${g.pct.mas ? ' o más' : ''}</b><span>o <b>+${fmt(g.m.x, 1)} m</b>${g.m.mas ? ' o más' : ''} por conductor</span>`;
    return `<div class="mg ${nv}" title="Cuánto más largo que el plan puede salir, en promedio, cada conductor que falta tender sin que se acabe el cable de ${g.seccion} mm² (contando cómo entran los cortes en cada bobina). El % es proporcional al largo de cada circuito; los metros son fijos por conductor. Son alternativas, no se suman.">
      <div class="mgt">${g.seccion} mm² <small>${CATN[cat].split(' ')[0]} · margen disponible</small></div>${cuerpo}
      <small>${g.nCond ? `${g.nCond} conductores por tender (${fmt(g.mPend)} m)` : 'todo tendido'} · sobrante ${fmt(g.sobra)} m${g.nCond ? ` ≈ ${fmt(g.sobra / g.nCond, 1)} m/cond.` : ''}</small>
      ${g.faltante > 0 || g.pct.x == null ? '' : `<small>Al tender: <b class="ok">seguro</b> hasta +${fmt(g.pct.x * tolF(), 1)} % · <b class="warn">riesgo</b> hasta +${fmt(g.pct.x, 1)} %</small>`}</div>`;
  }).join('')}</div><button class="mgr rlj calc" id="mgReloj" data-cat="${cat}" title="Margen de tendido de ${CATN[cat]}: tocá para ver el detalle"></button></div>`;
}
function simAplicar(base, cat, filas, opts) {
  const T = JSON.parse(JSON.stringify(base));
  T.params = Object.assign({}, T.params, { margen: opts.margen, ajuste: Object.assign({}, T.params.ajuste, { [cat]: opts.ajuste }) });
  const hoy = today();
  filas.forEach((f) => {
    const c = T.circuitos.find((x) => x.id === f.id); if (!c) return; c.real = Object.assign({}, c.real);
    f.fases.forEach((fz) => { if (fz.bobina) c.real[fz.f] = { bobina: fz.bobina, metros: f.m, fecha: hoy, sim: true }; });
  });
  if (opts.peor) { const aj = Number(T.params.ajuste[cat]) || 0; T.params.ajuste[cat] = ((1 + aj / 100) * (1 + opts.pct / 100) - 1) * 100; }
  return T;
}
async function simularTendido(cat) {
  const base = clonEstado();
  const cands = R.circuitos.filter((c) => c.cat === cat && !c.vinculo && c.listo && c.nReal < c.fz.length);
  const sel = cands.filter((c) => ui.sel.has(c.id));
  const ajIni = Number((S.params.ajuste || {})[cat]) || 0, mgIni = Number(S.params.margen) || 0;
  // exceso observado en lo ya tendido de este tipo (sugerencia inicial)
  const rs = R.resumen.filter((r) => r.cat === cat && r.tendidoTeo > 0);
  const obs = rs.reduce((a, r) => a + r.tendidoTeo, 0) ? rs.reduce((a, r) => a + r.desvio, 0) / rs.reduce((a, r) => a + r.tendidoTeo, 0) * 100 : 0;
  const st = { pct: Math.max(0, Math.round(obs * 10) / 10) || 2, mas: 0, peor: false, margen: mgIni, ajuste: ajIni, solo: sel.length ? 'sel' : 'listos', man: {} };
  const filasDe = () => (st.solo === 'sel' ? sel : cands).map((c) => {
    const fases = c.fz.filter((f) => !(c.real && c.real[f] && (c.real[f].bobina || c.real[f].sinBobina))).map((f) => ({ f, bobina: (c.fasesInfo[f] || {}).bobina }));
    const lista = Math.round((c.lenFase - (Number(S.params.margen) || 0)) * 100) / 100; // corte previsto por el plan (lista con corrección, o largo elegido a mano)
    const m = st.man[c.id] != null ? st.man[c.id] : Math.round((lista * (1 + st.pct / 100) + st.mas) * 100) / 100;
    return { id: c.id, c, fases, lista, m };
  });
  const secs = R.resumen.filter((r) => r.cat === cat && (r.requerido > 0 || r.bobinas)).map((r) => r.key);
  const margenAct = {}, margenActM = {}; secs.forEach((k) => { margenAct[k] = margenStock(base, cat, k); margenActM[k] = margenMetros(base, cat, k); });
  const mmtxt = (o) => (o && o.x != null ? `<br><small>o +${fmt(o.x, 1)} m/cond.${o.mas ? ' o más' : ''}</small>` : '');
  const mtxt = (o, k) => { if (!o) return '–'; if (o.x == null) return '<span class="sv bad">ya no alcanza</span>'; const r = R.resumen.find((q) => q.key === k);
    const pend = r ? Math.max(0, r.requerido - r.tendido) : 0; const v = `${o.x >= 0 ? '+' : ''}${fmt(o.x, 1)} %${o.mas ? ' o más' : ''}`;
    return `<span class="sv ${o.ya || o.x < 1 ? 'bad' : o.x < 3 ? 'warn' : 'ok'}">${v}</span><small> ≈ ${fmt(Math.abs(o.x) / 100 * pend)} m</small>`; };
  const sobra = (r) => (r.stock || 0) - (r.tendido || 0) - (r.listo || 0) - (r.provisorio || 0) - (r.faltante || 0);
  const flecha = (a, b, d = 0, malo = 'up') => { const ch = Math.abs(b - a) > 0.004; const peor = malo === 'up' ? b > a : b < a;
    return `${fmt(a, d)}${ch ? ` <span class="ar ${peor ? 'bad' : 'ok'}">→ ${fmt(b, d)}</span>` : ''}`; };
  const body = `<div class="simw">
    <div class="simc"><div class="simh">1 · Qué se simula</div>
      <div class="seg sm" id="sScope"><button data-v="listos" class="${st.solo === 'listos' ? 'on' : ''}">Listos para tender (${cands.length})</button>${sel.length ? `<button data-v="sel" class="${st.solo === 'sel' ? 'on' : ''}">Seleccionados (${sel.length})</button>` : ''}</div>
      <div class="form simf"><label>Exceso por conductor (% sobre la lista)<input type="number" step="0.5" id="sPct" value="${st.pct}"></label><label>Metros extra por conductor<input type="number" step="0.5" id="sMas" value="0"></label></div>
      <p class="hint">Sugerido: ${obs ? `${obs > 0 ? '+' : ''}${fmt(obs, 1)} % es lo que viene dando lo tendido de ${CATN[cat]} contra la lista` : 'todavía no hay tendidos para comparar'}. El exceso se aplica sobre el corte previsto por el plan. Cada fila se puede corregir a mano.</p>
      <div class="simt" id="sFilas"></div></div>
    <div class="simc"><div class="simh">2 · Escenario y parámetros</div>
      <label class="chkl"><input type="checkbox" id="sPeor"> Aplicar el mismo exceso a <b>todo lo que falta tender</b> de ${CATN[cat]} (peor caso)</label>
      <div class="simh" style="margin-top:14px">Probar parámetros más estrictos</div>
      <div class="form simf"><label>Margen por corte (m por conductor)<input type="number" step="0.1" min="0" id="sMg" value="${mgIni}"></label><label>Corrección de largo ${CATN[cat]} (%)<input type="number" step="0.1" id="sAj" value="${ajIni}"></label></div>
      <p class="hint">El margen y la corrección agrandan los cortes que todavía no se hicieron: se reserva más cable por circuito y el plan avisa antes si no alcanza.</p></div>
    <div class="simc simfull"><div class="simh">Resultado <span class="muted" id="sCalc"></span></div><div id="sRes"></div></div></div>`;
  const calcular = () => {
    const box = $('.mbox'); if (!box || !$('#sRes', box)) return;
    const filas = filasDe();
    const T = simAplicar(base, cat, filas, st);
    const RT = Engine.calcular(T);
    // filas
    $('#sFilas', box).innerHTML = filas.length ? `<table class="tbl"><thead><tr><th>Circuito</th><th>Bobina (plan)</th><th class="r" title="Largo de corte previsto por el plan (lista con la corrección %, o el largo corregido a mano)">Plan m/cond.</th><th class="r">Simulado m/cond.</th><th class="r">Exceso</th></tr></thead><tbody>${filas.map((f) =>
      `<tr><td><b>${esc(f.c.designacion)}</b> <span class="muted">${esc(f.c.desde)}</span>${f.fases.length < f.c.fz.length ? ` <small class="muted">(${f.fases.map((x) => x.f).join(',')})</small>` : ''}</td><td>${[...new Set(f.fases.map((x) => x.bobina || 'sin bobina'))].map(esc).join(' · ')}</td><td class="r">${fmt(f.lista, 2)}</td>
      <td class="r"><input type="number" step="0.1" class="sM" data-id="${f.id}" value="${f.m}"></td><td class="r ${f.m > f.lista ? 'pos' : ''}">${f.m >= f.lista ? '+' : ''}${fmt((f.m - f.lista) * f.fases.length, 1)} m</td></tr>`).join('')}</tbody></table>`
      : `<p class="muted">No hay circuitos de ${CATN[cat]} listos para tender (con zanja abierta y sin tender). Igual podés probar el peor caso y los parámetros.</p>`;
    $$('.sM', box).forEach((i) => { i.onchange = () => { st.man[i.dataset.id] = Number(i.value) || 0; prog(); }; });
    // resultado por sección
    const opts2 = Object.assign({}, st); // margen de stock luego de simular (sin el peor caso: lo calcula la función)
    const T2 = simAplicar(base, cat, filas, Object.assign({}, opts2, { peor: false }));
    const filasR = secs.map((k) => {
      const a = R.resumen.find((q) => q.key === k) || {}, b = RT.resumen.find((q) => q.key === k) || {};
      const mb = margenStock(T2, cat, k), mm = margenMetros(T2, cat, k);
      return `<tr><td><b>${a.seccion || b.seccion} mm²</b><small class="muted"> · ${a.bobinas || 0} bob.</small></td>
        <td class="r">${flecha(a.faltante || 0, b.faltante || 0)}</td><td class="r">${flecha(sobra(a), sobra(b), 0, 'down')}</td>
        <td class="r">${flecha(a.remUtil || 0, b.remUtil || 0, 0, 'down')}</td><td class="r">${flecha(a.descarte || 0, b.descarte || 0)}</td><td class="r">${flecha(a.noSeUsa || 0, b.noSeUsa || 0, 0, 'down')}</td>
        <td class="r">${mtxt(margenAct[k], k)}${mmtxt(margenActM[k])}</td><td class="r">${mtxt(mb, k)}${mmtxt(mm)}</td></tr>`;
    }).join('');
    // bobinas que no alcanzan y conductores sin bobina
    const neg = RT.bobinas.filter((b) => b.cat === cat && (b.saldoActual || 0) < -0.01);
    const faltaA = new Set(R.piezas.filter((x) => x.cat === cat && x.estado === 'falta').map((x) => x.cid + x.fase));
    const faltaB = RT.piezas.filter((x) => x.cat === cat && x.estado === 'falta' && !faltaA.has(x.cid + x.fase));
    const cirN = [...new Set(faltaB.map((x) => x.cid))].map((id) => RT.circuitos.find((c) => c.id === id)).filter(Boolean);
    const tot = filas.reduce((a, f) => a + (f.m - f.lista) * f.fases.length, 0);
    $('#sRes', box).innerHTML = `<div class="simk"><div><span>Exceso simulado</span><b>${tot >= 0 ? '+' : ''}${fmt(tot, 1)} m</b><small>${filas.length} circuito${filas.length === 1 ? '' : 's'}</small></div>
        <div><span>Faltante ${CATN[cat]}</span><b class="${RT.resumen.filter((r) => r.cat === cat).reduce((a, r) => a + r.faltante, 0) > 0 ? 'bad' : 'ok'}">${fmt(RT.resumen.filter((r) => r.cat === cat).reduce((a, r) => a + r.faltante, 0))} m</b><small>hoy ${fmt(R.resumen.filter((r) => r.cat === cat).reduce((a, r) => a + r.faltante, 0))} m</small></div></div>
      <table class="tbl simr"><thead><tr><th>Sección</th><th class="r">Faltante (m)</th><th class="r" title="Stock de bobinas menos lo tendido y lo que falta cortar. Negativo: no alcanza.">Sobrante final (m)</th><th class="r">Remanente útil</th><th class="r">Descarte</th><th class="r">Bobinas sin usar</th><th class="r" title="Cuánto más largo que la lista puede salir, en promedio, todo lo que falta tender sin que se acabe el cable">Margen hoy</th><th class="r">Margen tras simular</th></tr></thead><tbody>${filasR}</tbody></table>
      <p class="hint"><b>Margen</b>: cuánto más largo que el plan puede salir cada conductor que falta tender de esa sección antes de quedarse sin cable (contando todas las bobinas y cómo entran los cortes). En % (proporcional al largo de cada circuito) o en metros fijos por conductor: son alternativas, no se suman. En rojo, menos de 1 %; en amarillo, menos de 3 %.</p>
      ${neg.length ? `<div class="alert error">${neg.map((b) => `Bobina <b>${esc(b.codigo)}</b> quedaría en ${fmt(b.saldoActual, 1)} m: el último corte habría que completarlo con otra bobina.`).join('<br>')}</div>` : ''}
      ${cirN.length ? `<div class="alert error">Se quedarían sin cable: ${cirN.map((c) => `<b>${esc(c.designacion)}</b> ${esc(c.desde)}`).join(', ')}</div>` : ''}
      ${!neg.length && !cirN.length ? '<div class="alert ok">Con este escenario el cable alcanza para todo el plan de ' + CATN[cat] + '.</div>' : ''}`;
    $('#sCalc', box).textContent = '';
    const bAp = $$('.mfoot button', box).pop();
    if (bAp) { const ch = st.margen !== mgIni || st.ajuste !== ajIni; bAp.disabled = !ch || window.READONLY; bAp.style.display = window.READONLY ? 'none' : ''; }
  };
  let tm = null; const prog = () => { const c = $('#sCalc'); if (c) c.textContent = 'calculando…'; clearTimeout(tm); tm = setTimeout(calcular, 120); };
  setTimeout(() => {
    const box = $('.mbox'); if (!box) return;
    const num = (id, k) => { $(id, box).oninput = () => { st[k] = Number($(id, box).value) || 0; if (k === 'pct' || k === 'mas') st.man = {}; prog(); }; };
    num('#sPct', 'pct'); num('#sMas', 'mas'); num('#sMg', 'margen'); num('#sAj', 'ajuste');
    $('#sPeor', box).onchange = (e) => { st.peor = e.target.checked; prog(); };
    $$('#sScope button', box).forEach((b) => { b.onclick = () => { st.solo = b.dataset.v; $$('#sScope button', box).forEach((x) => x.classList.toggle('on', x === b)); prog(); }; });
    calcular();
  }, 30);
  const r = await modal({ title: `Simular tendido · ${CATN[cat]}`, wide: true,
    sub: 'Prueba sin registrar nada: se dan por tendidos los circuitos listos con el exceso que indiques y se recalcula el aprovechamiento de las bobinas. Al cerrar no queda ningún cambio.',
    body, buttons: [['Cerrar', 'btn', () => null], ['Aplicar margen y corrección', 'btn pri', () => 'ap']] });
  if (r !== 'ap' || window.READONLY) return;
  S.params.margen = Math.max(0, st.margen); S.params.ajuste = Object.assign({}, S.params.ajuste || {}, { [cat]: Math.max(-30, Math.min(30, st.ajuste)) });
  recalcularTodo(cat);
  commit(`Parámetros de ${CATN[cat]} actualizados (margen ${fmt(S.params.margen, 1)} m · corrección ${fmt(S.params.ajuste[cat], 1)} %) · plan recalculado`);
}
