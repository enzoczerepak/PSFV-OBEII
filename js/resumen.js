/* PSFV-OBE II · Resumen general y avance de obra. */
// ======================= RESUMEN =======================
function zanjaCard(cat) {
  const z = R.zanjas[cat];
  return `<div class="zrow"><div class="zl"><b>${cat === 'BT' ? 'Baja tensión' : 'Media tensión'}</b><span class="muted">${z.nAbiertas + z.nCerradas}/${z.n} zanjas · ${z.nCerradas} cerradas${z.nParciales ? ` · ${z.nParciales} abierta${z.nParciales > 1 ? 's' : ''} en parte (faltan ${fmt(z.parcialFalta)} m)` : ''}</span></div>
    <div class="bar"><div class="c-done" data-w="${pct(z.cerrada, z.total)}"></div><div class="c-acc" data-w="${pct(z.abierta, z.total)}"></div></div>
    <div class="zn"><b>${fmt(z.realizada)}</b> / ${fmt(z.total)} m</div></div>`;
}
function patCard() {
  return R.resumen.filter((r) => r.cat === 'PAT').map((r) => `<div class="zrow"><div class="zl"><b>PAT ${r.seccion} mm²</b><span class="muted">${r.seccion === 25 ? 'zanjas BT' : 'zanjas MT'}</span></div>
    <div class="bar"><div class="c-done" data-w="${pct(r.tendido, r.requerido)}"></div></div><div class="zn"><b>${fmt(r.tendido)}</b> / ${fmt(r.requerido)} m</div></div>`).join('');
}
// Encabezado del inicio: cielo según la hora, el sol recorre su arco y los trackers lo siguen (±60°)
function heroHTML() {
  const ahora = new Date(), h = ahora.getHours() + ahora.getMinutes() / 60;
  // el cielo sigue el clima real del parque (estación SMN Oberá) (widget del clima); sin datos, solo la hora
  const K = typeof climaCielo === 'function' ? climaCielo() : null, cond = K ? K.cond : 'despejado';
  const salida = (K && K.salida) || 6.5, puesta = (K && K.puesta) || 19.8, dia = h >= salida && h <= puesta, f = Math.max(0, Math.min(1, (h - salida) / (puesta - salida)));
  const fase = !dia ? 'noche' : f < 0.12 ? 'alba' : f > 0.88 ? 'ocaso' : 'dia';
  const W = 1000, sx = 80 + f * (W - 160), sy = 150 - Math.sin(f * Math.PI) * 115;
  // trackers: siguen al sol; con ráfagas fuertes o tormenta van a posición de defensa
  const defensa = K && (K.rafaga >= 50 || cond === 'tormenta');
  const ang = dia && !defensa ? Math.max(-60, Math.min(60, (f - 0.5) * 150)) : 0;
  const filas = Array.from({ length: 14 }, (_, i) => i);
  const saludo = h < 5 ? 'Buenas noches' : h < 13 ? 'Buen día' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
  const ts = R.resumen.reduce((a, r) => a + r.tendido + (r.parcial || 0), 0), tr = R.resumen.reduce((a, r) => a + r.requerido, 0);
  const fi = STSL.map((x) => fundInfo(x)), fA = fi.length ? fi.reduce((a, i) => a + i.done, 0) / (fi.length * ETAPAS.length) : 0;
  const HI = window.PLANO && S.hincado ? hincInfo() : null;
  const mini = (t, v, c) => `<div class="hstat"><b style="color:${c}">${fmt(v * 100)}%</b><span>${t}</span></div>`;
  // nubes: cantidad y tono según el clima
  const nN = { despejado: 2, parcial: 5, nublado: 10, niebla: 6, llovizna: 9, lluvia: 11, tormenta: 12 }[cond] || 2;
  const grande = ['nublado', 'llovizna', 'lluvia', 'tormenta'].includes(cond) ? 1.55 : 1;
  const nube = (i) => { const x = Math.round((i + 0.5) * (1100 / nN) - 80 + ((i * 37) % 40)), y = (grande > 1 ? 8 : 18) + ((i * 37) % 4) * (grande > 1 ? 11 : 13), s = (0.8 + ((i * 7) % 5) / 6) * grande;
    return `<g class="hnube" style="animation-duration:${50 + (i % 4) * 14}s;animation-delay:-${(i * 9) % 50}s"><g transform="translate(${x} ${y}) scale(${s.toFixed(2)})"><ellipse cx="0" cy="8" rx="52" ry="13"/><ellipse cx="-18" cy="0" rx="24" ry="14"/><ellipse cx="14" cy="-3" rx="30" ry="18"/></g></g>`; };
  const lluvia = ['llovizna', 'lluvia', 'tormenta'].includes(cond);
  const nG = cond === 'llovizna' ? 40 : cond === 'lluvia' ? 90 : 120;
  const gotas = lluvia ? `<g class="hlluvia ${cond}">${Array.from({ length: nG }, (_, i) => `<line x1="${(i * 113) % W}" y1="${-20 - ((i * 29) % 160)}" x2="${(i * 113) % W - 5}" y2="${-8 - ((i * 29) % 160)}" style="animation-delay:-${((i * 0.137) % 1).toFixed(2)}s"/>`).join('')}</g>` : '';
  const rayo = cond === 'tormenta' ? '<rect class="hflash" x="0" y="0" width="1000" height="190"/><path class="hrayo" d="M640 30 l-18 40 h14 l-16 44 l38 -54 h-15 l14 -30z"/>' : '';
  const niebla = cond === 'niebla' ? `<g class="hniebla">${[70, 105, 140].map((y, i) => `<rect x="-200" y="${y}" width="1400" height="26" rx="13" style="animation-delay:-${i * 8}s"/>`).join('')}</g>` : '';
  const astro = dia ? `<g class="hsol" style="transform:translate(${sx.toFixed(0)}px,${sy.toFixed(0)}px)"><circle r="70" fill="url(#hglow)"/><circle r="17" class="hsold"/></g>`
    : `<g class="hluna" style="transform:translate(${W - 160}px,46px)"><circle r="14"/><circle r="14" cx="7" cy="-4" class="hlunas"/></g>${cond === 'despejado' || cond === 'parcial' ? Array.from({ length: 22 }, (_, i) => `<circle class="hest" cx="${(i * 97) % W}" cy="${12 + ((i * 53) % 90)}" r="${i % 3 ? 1 : 1.6}" style="animation-delay:${(i % 7) * .4}s"/>`).join('') : ''}`;
  const trk = !dia ? 'trackers en posición de reposo' : defensa ? `trackers en posición de defensa${K.rafaga >= 50 ? ` · ráfagas ${fmt(K.rafaga)} km/h` : ''}` : `trackers a ${ang >= 0 ? '+' : ''}${fmt(ang)}°`;
  return `<div class="hero hmain h-${fase} w-${cond}"><svg class="hsky" viewBox="0 0 ${W} 190" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs><radialGradient id="hglow"><stop offset="0" stop-color="#fff4c2" stop-opacity=".95"/><stop offset=".35" stop-color="#ffd166" stop-opacity=".55"/><stop offset="1" stop-color="#ffd166" stop-opacity="0"/></radialGradient>
        <linearGradient id="hpan" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#2f6aa8"/><stop offset="1" stop-color="#16365c"/></linearGradient></defs>
      ${astro}<g class="hnubes">${Array.from({ length: nN }, (_, i) => nube(i)).join('')}</g>${rayo}${gotas}
      <path d="M0 160 Q250 140 500 152 T1000 148 V190 H0z" class="hcerro"/>${niebla}
      ${filas.map((i) => { const x = 40 + i * 68; return `<g transform="translate(${x} 166)"><path d="M0 0v18" class="hposte"/><g class="htrk" style="transform:rotate(${ang.toFixed(1)}deg)"><rect x="-27" y="-4" width="54" height="7" rx="1.2" fill="url(#hpan)"/><path d="M-13.5 -4v7M0 -4v7M13.5 -4v7" class="hceld"/></g></g>`; }).join('')}
      <path d="M0 184h${W}" class="hsuelo"/></svg>
    <div class="hizq"><div class="htxt"><div class="hsal">${saludo}</div><h2>${esc(S.nombre || ED.app)}</h2><div class="hfecha">${ahora.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · ${trk}</div></div>
    <div class="hstats">${mini('tendido', tr ? ts / tr : 0, '#7fe0c4')}${(() => { const T = foTotales(); return T.tubo ? mini('fibra óptica', T.col / T.tubo, '#9fd3ff') : ''; })()}${mini('fundaciones', fA, '#ffd166')}${(() => { const I = salaInfo(); return I.done || I.curso.length ? mini('edificio O&M', I.p, '#d4c8ff') : ''; })()}${HI ? mini('hincado', HI.trk.length ? HI.nH / HI.trk.length : 0, '#c9b6ff') : ''}${(S.cronoTareas || []).length ? mini('cronograma', cronoCalc().P.pct / 100, '#9fd3ff') : ''}</div></div>
    ${typeof climaWidgetHTML === 'function' ? climaWidgetHTML() : ''}</div>`;
}
function vResumen(el) {
  actions([['Exportar Excel', 'btn', exportExcel]]);
  el.innerHTML = ghAvisoHTML() + (typeof evCursoHTML === 'function' ? evCursoHTML(true) : '') + heroHTML() + modulosHTML();
  if (typeof bindEvCurso === 'function') bindEvCurso(el);
  $$('[data-go]', el).forEach((c) => { c.onclick = () => go(c.dataset.go); });
  bindClima(); climaCarga();
}
// el clima se actualiza solo cada 30 minutos mientras el Inicio está abierto
setInterval(() => { if (typeof view !== 'undefined' && view === 'resumen') climaCarga(true); }, 30 * 60e3);
function vCables(el) {
  actions([['Exportar Excel', 'btn', exportExcel], ['Ir a zanjas', 'btn pri', () => go('zanjas')]]);
  const cnt = (cat) => { const cs = R.circuitos.filter((c) => c.cat === cat); return [cs.filter((c) => c.completo).length, cs.length, cs.filter((c) => c.estado === 'listo para tender').length]; };
  let h = `<div class="grid g3 stagger" style="margin-bottom:16px">
    <div class="card"><h3>Tendido</h3><table class="kt"><tr><th></th><th>Tendidos</th><th>Listos</th></tr>
      ${catsUso().map((c) => { const [a, b, l] = cnt(c); return `<tr><td>${ctag(c)}<b>${CATN[c]}</b></td><td><span class="mini ok"><div data-w="${pct(a, b)}" style="width:0"></div></span> ${a}/${b}</td><td>${l}</td></tr>`; }).join('')}</table></div>
    <div class="card"><h3>Zanja realizada</h3>${zanjaCard('BT')}${zanjaCard('MT')}<div class="legend" style="margin-top:6px"><span><i class="c-done"></i>Cerrada</span><span><i class="c-acc"></i>Abierta</span></div></div>
    <div class="card"><h3>Alertas</h3><div class="alerts">${R.alerts.length ? R.alerts.map((a) => `<div class="alert ${a.tipo}">${esc(a.txt)}</div>`).join('') : '<div class="alert ok">Sin observaciones</div>'}</div></div>
  </div><div class="grid g3 stagger" style="margin-bottom:16px"><div class="card"><h3>PAT tendida</h3>${patCard()}</div>`;
  R.resumen.filter((r) => r.cat !== 'LA').forEach((r) => {
    const tot = Math.max(r.stock, r.requerido);
    const st = !r.bobinas ? '<span class="pill p-warn">sin bobinas</span>' : r.faltante > 0 ? pill('falta cable').replace('p-prov', 'p-bad') : '<span class="pill p-ok">stock suficiente</span>';
    h += `<div class="card sc" data-go="${r.cat}-plan"><div class="hero"><div class="sec">${r.seccion}<small> mm² · ${ctag(r.cat)}${CATN[r.cat]}</small></div><span style="margin-left:auto">${st}</span></div><div class="muted" style="margin:-8px 0 12px">${r.bobinas} bobinas · ${fmt(r.stock)} m en stock</div>
      <div class="kpis k3">${kpi('Requerido', r.requerido)}${kpi('Tendido', r.tendido)}${r.parcial ? kpi('En tendido parcial', r.parcial) : ''}${kpi('Listo p/ cortar', r.listo)}${kpi('Balance stock', r.balance)}${kpi('Remanente útil previsto', r.remUtil)}${kpi('Descarte previsto', r.descarte)}</div>
      <div class="muted" style="margin-top:6px">Bobinas: ${r.realSinAbrir} sin abrir · ${r.realEnUso} en uso · ${r.realTerminadas} terminadas${r.noSeUsa ? ` · ${r.noSeUsa} que el plan no usa` : ''}</div>
      ${r.tendidoTeo ? `<div class="muted" style="margin-top:8px">Tirado vs lista: <span class="dv ${r.desvio > 0.005 ? 'pos' : r.desvio < -0.005 ? 'neg' : ''}">${r.desvio > 0 ? '+' : ''}${fmt(r.desvio, 1)} m (${r.desvio > 0 ? '+' : ''}${fmt(r.desvioPct * 100, 1)} %)</span> sobre ${fmt(r.tendidoTeo)} m tendidos</div>` : ''}
      <div class="bar"><div class="c-done" data-w="${pct(r.tendido, tot)}"></div><div class="c-par" data-w="${pct(r.parcial || 0, tot)}"></div><div class="c-ready" data-w="${pct(Math.max(0, r.listo - (r.parcial || 0)), tot)}"></div><div class="c-prov" data-w="${pct(r.provisorio, tot)}"></div><div class="c-bad" data-w="${pct(r.faltante, tot)}"></div><div class="c-rem" data-w="${pct(Math.max(0, r.balance), tot)}"></div></div></div>`;
  });
  el.innerHTML = h + `</div><div class="legend"><span><i class="c-done"></i>Tendido</span><span><i class="c-par"></i>Tendido parcial</span><span><i class="c-ready"></i>Listo p/ cortar</span><span><i class="c-prov"></i>Provisorio</span><span><i class="c-bad"></i>Faltante</span><span><i class="c-rem"></i>Sobrante</span></div>`;
  $$('[data-go]', el).forEach((c) => { c.onclick = () => go(c.dataset.go); });
}

// ======================= AVANCE =======================
const SERIE = { BT: '#00939a', MT: '#c97b12', PAT: '#6a5acd', LA: '#2f6fc2' };
const ST = { tend: '#00797f', par: '#3fb0a6', listo: '#a9dcdd', pend: '#dfe5ec' };
function vAvance(el) {
  actions([['Exportar Excel', 'btn', exportExcel], ['Exportar PDF', 'btn pri', printAvance]]);
  const sumCat = (cat) => { const rs = R.resumen.filter((r) => r.cat === cat); const f = (k) => rs.reduce((a, r) => a + (r[k] || 0), 0); return { req: f('requerido'), tend: f('tendido'), par: f('parcial'), listo: f('listo') }; };
  const nC = (cat) => { const cs = R.circuitos.filter((c) => c.cat === cat); return [cs.filter((c) => c.completo).length, cs.length]; };
  let h = `<h2 class="sech">Tendido y aprovechamiento de cables</h2><div class="grid g3 stagger" style="margin-bottom:16px">`;
  catsUso().forEach((cat) => {
    const t = sumCat(cat), [a, b] = nC(cat), p = t.req ? (t.tend + t.par) / t.req : 0;
    const zc = cat === 'BT' || cat === 'MT' ? R.zanjas[cat] : null;
    h += `<div class="card tile"><div>${Charts.ring(p, SERIE[cat], 'tendido')}</div><div><h3 style="margin-bottom:6px">${ctag(cat)}${CATN[cat]}</h3>
      <div class="kpis k1" style="gap:6px">${kpi('Metros tendidos', t.tend + t.par, `/ ${fmt(t.req)} m`)}${kpi('Circuitos completos', a, `/ ${b}`)}</div>
      ${t.par ? `<div class="avdet"><span><i style="background:${ST.tend}"></i>${fmt(t.tend)} m completos</span><span><i style="background:${ST.par}"></i>${fmt(t.par)} m en tendido parcial</span></div>` : ''}
      <div class="muted" style="margin-top:6px">${fmt(Math.max(0, t.listo - t.par))} m listos para cortar${zc && zc.nParciales ? ` · zanja ${cat}: ${zc.nParciales} abierta${zc.nParciales > 1 ? 's' : ''} en parte` : ''}</div></div></div>`;
  });
  h += `</div><div class="grid g2 stagger">`;
  // por STS (BT)
  const grupo = (cat, keyf) => { const m = new Map(); R.circuitos.filter((c) => c.cat === cat).forEach((c) => { const k = keyf(c); const o = m.get(k) || { tend: 0, par: 0, listo: 0, pend: 0, n: 0, ok: 0 }; c.fz.forEach((f) => { const pz = c.fasesInfo[f]; if (!pz) return; if (pz.estado === 'ejecutado') { o.tend += pz.len; return; } const pp = pz.len * (c.tendFrac || 0); o.par += pp; if (pz.estado === 'listo') o.listo += pz.len - pp; else o.pend += pz.len - pp; }); o.n++; if (c.completo) o.ok++; m.set(k, o); }); return [...m.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'es', { numeric: true })); };
  const filas = (g) => g.map(([k, o]) => { const tot = o.tend + o.par + o.listo + o.pend; return { label: k, right: `${fmt(tot ? ((o.tend + o.par) / tot) * 100 : 0)}% · ${o.ok}/${o.n} circ.`, parts: [{ v: o.tend, color: ST.tend, name: 'Tendido' }, { v: o.par, color: ST.par, name: 'Tendido parcial' }, { v: o.listo, color: ST.listo, name: 'Listo para cortar' }, { v: o.pend, color: ST.pend, name: 'Pendiente' }] }; });
  const leg = Charts.legend([[ST.tend, 'Tendido'], [ST.par, 'Tendido parcial'], [ST.listo, 'Listo para cortar'], [ST.pend, 'Pendiente']]);
  h += `<div class="card"><h3>BT por STS</h3>${Charts.hbars(filas(grupo('BT', (c) => c.hasta)))}${leg}</div>`;
  h += `<div class="card"><h3>MT por circuito</h3>${Charts.hbars(filas(grupo('MT', (c) => c.designacion)), { labelW: 70 })}${leg}</div>`;
  // línea temporal
  const series = catsUso().map((cat) => {
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
  const zf = ['BT', 'MT'].map((cat) => { const z = R.zanjas[cat]; return { label: CATN[cat], right: `${fmt(z.realizada)} / ${fmt(z.total)} m · ${fmt(z.total ? (z.realizada / z.total) * 100 : 0)}%`, parts: [{ v: z.cerrada, color: '#4b5567', name: 'Cerrada' }, { v: z.abierta, color: '#f5a524', name: 'Abierta' }, { v: Math.max(0, z.total - z.realizada), color: ST.pend, name: 'Sin abrir' }] }; });
  const bf = R.resumen.filter((r) => r.bobinas).map((r) => { const bs = R.bobinas.filter((b) => b.key === r.key); const term = bs.filter((b) => b.estadoReal === 'terminada').length, uso = bs.filter((b) => b.estadoReal === 'en uso').length, sin = bs.length - term - uso;
    return { label: `${CATS[r.cat].corto} ${r.seccion}`, right: `${term}/${bs.length} terminadas`, parts: [{ v: term, color: '#4b5567', name: 'Terminadas' }, { v: uso, color: ST.tend, name: 'En uso' }, { v: sin, color: ST.pend, name: 'Sin empezar' }] }; });
  const zpar = ['BT', 'MT'].filter((c) => R.zanjas[c].nParciales).map((c) => `${CATN[c]}: ${R.zanjas[c].nParciales} zanja${R.zanjas[c].nParciales > 1 ? 's' : ''} abierta${R.zanjas[c].nParciales > 1 ? 's' : ''} en parte, faltan ${fmt(R.zanjas[c].parcialFalta)} m`);
  h += `<div class="card"><h3>Zanjas (metros)</h3>${Charts.hbars(zf, { labelW: 120, rightW: 160 })}${Charts.legend([['#4b5567', 'Cerrada'], ['#f5a524', 'Abierta (lo excavado)'], [ST.pend, 'Sin abrir']])}${zpar.length ? `<p class="hint" style="display:block;margin:6px 0 0">${zpar.join(' · ')}</p>` : ''}
    <h3 style="margin-top:18px">Bobinas</h3>${Charts.hbars(bf, { labelW: 80, unit: 'bobinas' })}${Charts.legend([['#4b5567', 'Terminadas'], [ST.tend, 'En uso'], [ST.pend, 'Sin empezar']])}</div>`;
  const ptRows = (() => { const cs = R.circuitos.filter((c) => c.cat !== 'PAT' && c.cat !== 'LA'); const out = []; const add = (label, fn) => { let t = 0, c = 0; cs.forEach((x) => { const r = fn(x); if (r) { t += r[1]; c += r[0]; } }); if (t) out.push({ label, right: `${c}/${t}`, parts: [{ v: c, color: '#4b5567', name: 'Colocadas' }, { v: t - c, color: ST.pend, name: 'Pendientes' }] }); };
    add('BT · lado inversor', (x) => x.cat === 'BT' && [puntasDe(x).o, puntasDe(x).n]); add('BT · lado STS', (x) => x.cat === 'BT' && [puntasDe(x).d, puntasDe(x).n]);
    ['STS – STS', 'STS – Sala de celdas', 'Sala de celdas – Piquete LMT', 'Piquete – ET'].forEach((g) => add('MT · ' + g, (x) => x.cat === 'MT' && tramo(x) === g && [puntasDe(x).col, puntasDe(x).tot])); return out; })();
  h += `</div>` + foAvanceHTML() + lmtAvanceHTML() + salaAvanceHTML() + `<h2 class="sech">Puntas de cable</h2><div class="grid g2 stagger" style="margin-bottom:8px"><div class="card"><h3>Puntas colocadas por sección</h3>${(() => { const cs = R.circuitos.filter((c) => c.cat !== 'PAT'); const ks = [...new Set(cs.map((c) => `${c.cat}|${c.seccion}`))]; return Charts.hbars(ks.map((k) => { const g = cs.filter((c) => `${c.cat}|${c.seccion}` === k).map(puntasDe); const t = g.reduce((a, x) => a + x.tot, 0), cc = g.reduce((a, x) => a + x.col, 0); return { label: k.replace('|', ' '), right: `${cc}/${t} colocadas`, parts: [{ v: cc, color: '#4b5567', name: 'Colocadas' }, { v: t - cc, color: ST.pend, name: 'Pendientes' }] }; }), { labelW: 80, unit: 'puntas' }); })()}${Charts.legend([['#4b5567', 'Colocadas'], [ST.pend, 'Pendientes']])}</div><div class="card"><h3>Puntas por extremo y tramo</h3>${Charts.hbars(ptRows, { labelW: 220, rightW: 80, unit: 'puntas' })}${Charts.legend([['#4b5567', 'Colocadas'], [ST.pend, 'Pendientes']])}</div></div>` + fundAvanceHTML();
  if ((S.cronoTareas || []).length) h += `<h2 class="sech">Cronograma de obra</h2>` + cronoCurvaFases(cronoCalc());
  el.innerHTML = h;
  $$('.fz[data-k]', el).forEach((b) => { b.onclick = () => { ui.gfoco = b.dataset.k; go('gantt'); }; });
  Charts.bindTips(el);
}
