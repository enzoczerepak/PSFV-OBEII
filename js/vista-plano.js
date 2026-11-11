/* PSFV-OBE II · Plano de obra interactivo. */
// ======================= PLANO DE OBRA =======================
const PL_CAPAS = [['sect', 'Sectores'], ['trk', 'Trackers'], ['bt', 'Zanjas BT'], ['mt', 'Zanjas MT'], ['inv', 'Inversores'], ['sts', 'STS'], ['sala', 'Edificio O&M'], ['ctx', 'Caminos y cerco']];
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
    const HA = (S.hincado || {}).avance || {};
    const tcol = (t) => (pl.color === 'tipo' ? (t.t === '1P52' ? '#00939a' : '#f5a524') : pl.color === 'disc' ? CFGCOL[t.t + '|' + (t.z || 'Outer')] : pl.color === 'hinc' ? (HA[t.id] ? '#7c5cbf' : '#c9d0da') : SECT_COL[t.s]);
    P.trk.forEach((t) => { g += `<rect x="${(t.x - t.w / 2).toFixed(1)}" y="${(t.y - t.h / 2).toFixed(1)}" width="${t.w}" height="${t.h}" rx="0.6" fill="${tcol(t)}" class="pl-trk${pl.sel === 't|' + t.id ? ' pl-on' : ''}${pl.color === 'disc' && t.sl === 'B' ? ' pl-soft' : ''}" data-pk="t|${t.id}"><title>${t.id} · ${t.t} · Sector ${t.s}${t.z ? ' · ' + cfgTxt(cfgDe(t)) : ''}</title></rect>`; });
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
  // edificio de O&M (layout r5): planta con sus salas, pintada con el avance de obra
  if (cap('sala') && P.sala && typeof salaInfo === 'function') { const B = P.sala, SI = salaInfo(), q = (p) => p.map(([a, b]) => `${(B.x + a).toFixed(2)},${(B.y - b).toFixed(2)}`).join(' ');
    g += `<g data-pk="o|sala" class="pl-sala${pl.sel === 'o|sala' ? ' pl-on' : ''}"><rect x="${B.x}" y="${(B.y - B.h).toFixed(2)}" width="${B.w}" height="${B.h}" class="pl-salab"/><rect x="${B.x}" y="${(B.y - B.h).toFixed(2)}" width="${(B.w * SI.p).toFixed(2)}" height="${B.h}" class="pl-salaf"/>${B.rooms.map((r) => `<polygon points="${q(r.p)}" class="pl-salar"/>`).join('')}<text x="${(B.x + B.w / 2).toFixed(2)}" y="${(B.y - B.h - 1.5).toFixed(2)}" class="pl-stst pl-salat">Edificio O&amp;M · ${fmt(SI.p * 100)} %</text><title>Edificio de operación y mantenimiento · ${fmt(SI.p * 100)} % de avance</title></g>`; }
  if (cap('sect')) P.sect.forEach((s) => { g += `<text x="${s.lx}" y="${s.ly}" class="pl-sectl" style="fill:${SECT_COL[s.n]}">Sector ${s.n}</text>`; });
  const vb = pl.vb || [0, 0, P.W, P.H];
  // panel lateral
  const panel = planoPanel(I);
  el.innerHTML = `<div class="tools"><div class="seg" id="plC"><button data-v="sector">Trackers por sector</button><button data-v="tipo">por tipo</button><button data-v="disc">discretización</button><button data-v="hinc">hincado</button></div>
      <div class="seg" id="plZ"><button data-v="estado">Zanjas por estado</button><button data-v="tipo">BT rojo / MT azul</button></div>
      <span class="sp"></span><input type="search" id="plQ" placeholder="Buscar TRK-123, TX2-INV5, STS 3…" style="width:240px"></div>
    <div class="plwrap"><div class="card plcard"><svg id="plSvg" viewBox="${vb.join(' ')}" preserveAspectRatio="xMidYMid meet">${g}</svg>
      <div class="plctl"><button data-z="1.4" title="Acercar">+</button><button data-z="0.7" title="Alejar">−</button><button data-z="0" title="Ver todo">⤢</button></div>
      <div class="plcapas">${PL_CAPAS.map(([k, n]) => `<label><input type="checkbox" data-cap="${k}" ${cap(k) ? 'checked' : ''}> ${n}</label>`).join('')}</div>
      <div class="pllegend">${pl.zcol === 'estado' ? `<span><i style="background:${ZEST['no abierta']}"></i>Zanja no abierta</span><span><i style="background:${ZEST.abierta}"></i>abierta</span><span><i style="background:${ZEST.cerrada}"></i>cerrada</span><span><i class="lw"></i>trazo grueso: cable tendido</span>` : '<span><i style="background:#d64545"></i>Zanja BT</span><span><i style="background:#2f6fd6"></i>Zanja MT</span>'}${pl.color === 'tipo' ? '<span><i style="background:#00939a"></i>1P52</span><span><i style="background:#f5a524"></i>1P26</span>' : ''}${pl.color === 'disc' ? Object.entries(CFGCOL).map(([k, c]) => `<span><i style="background:${c}"></i>${k.replace('|', ' ').replace('Border', 'Borde').replace('Outer', 'Exterior').replace('Inner', 'Interior')}</span>`).join('') + '<span><i class="lsoft"></i>rayado: suelo blando</span>' : ''}${pl.color === 'hinc' ? '<span><i style="background:#7c5cbf"></i>Hincado</span><span><i style="background:#c9d0da"></i>Pendiente</span>' : ''}</div></div>
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
  $$('[data-hinc]', el).forEach((b) => { b.onclick = () => marcarHincado([b.dataset.hinc], !S.hincado.avance[b.dataset.hinc]); });
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
      ${repDe(t.id) ? fila('Replanteo', `frame ${esc(repDe(t.id).fr)} · ${repDe(t.id).n} hincas${repDe(t.id).mix || repDe(t.id).dif ? ' <span class="pill p-warn">revisar</span>' : ''}`) : ''}
      ${t.z ? fila('Discretización', `${cfgTxt(cfgDe(t))}${t.rev ? ' <span class="pill p-warn">verificar</span>' : ''}`) : ''}
      ${(() => { const av = S.hincado.avance[t.id], ps = posDe(t); return fila('Hincado', av ? `<span class="pill p-done">✓ ${fechaCorta(av.f)}</span>` : 'pendiente') + (ps.some(Boolean) ? `<h4 class="dh">Hincas (1 = norte)</h4><div class="hpanel">${ps.map((c, i) => `<div class="hpr"><span>${i + 1}</span>${c ? chipH(c, true) : '<span class="muted">sin definir</span>'}</div>`).join('')}</div>` : '<p class="muted" style="margin:6px 0">Distribución de hincas a cargar (Hincado → Catálogo y distribución).</p>') + (window.READONLY ? '' : `<div class="plact"><button class="btn sm ${av ? '' : 'acc'}" data-hinc="${t.id}">${av ? 'Quitar hincado' : 'Marcar hincado'}</button></div>`); })()}
      <p class="hint">Potencia según el panel instalado (625, 630 o 635 W).</p>`;
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
    return `<h3>${esc(id)} · ${CATN.MT}</h3>${fila('Recorrido', `${esc(c.desde)} → ${esc(c.hasta)}`)}${fila('Cable', esc(c.formacion || c.seccion + ' mm²'))}${fila('Largo por conductor', fmt(c.lenFase, 1) + ' m')}${fila('Zanja', e)}${fila('Tendido', c.completo ? '✓ completo' : `${c.nReal}/${c.fz.length}`)}
      <div class="plact"><button class="btn sm" data-goc="MT-circ">Ver circuitos MT</button>${window.READONLY ? '' : `<button class="btn sm acc" data-tend="${c.id}">Tender</button>`}</div>`;
  }
  if (k === 'e') {
    const s = P.sts.find((x) => x.id === id), f = fundInfo(id), cs = R.circuitos.filter((c) => c.cat === 'BT' && c.hasta === id);
    return `<h3>${id}</h3>${fila('Potencia', fmt(s.mva, 1) + ' MVA')}${fila('Fundación', `${fmt(f.p * 100)} % · ${f.done}/${f.n} etapas`)}${fila('Etapa', f.done === f.n ? 'terminada' : f.curso.length ? 'en curso: ' + esc(f.curso.map(([kk]) => ETN[kk]).join(', ')) : 'próxima: ' + esc(f.sig[1]))}
      ${fila('Inversores', cs.length)}${fila('Cable BT tendido', `${cs.filter((c) => c.completo).length} / ${cs.length}`)}<div style="max-width:240px;margin:8px auto">${stsSVG(f.p)}</div>
      <div class="plact"><button class="btn sm" data-goc="fundaciones">Ver fundaciones</button></div>`;
  }
  if (k === 'o') {
    const SI = salaInfo(), B = P.sala;
    return `<h3>Edificio de O&amp;M</h3>${fila('Salas', B.rooms.filter((r) => r.n).map((r) => esc(r.n)).join(', '))}${fila('Planta', `${fmt(B.w, 2)} × ${fmt(B.h, 2)} m`)}${fila('Avance', `${fmt(SI.p * 100, 1)} % · ${SI.done}/${SI.ets.length} etapas`)}${fila('Zapatas hormigonadas', `${SI.nZH} / 12`)}${fila('Etapa', SI.curso.length ? 'en curso: ' + esc(SI.curso.map((x) => x.e.n).join(', ')) : SI.sig ? 'próxima: ' + esc(SI.sig.e.n) : 'terminado')}
      <div style="margin:8px 0">${salaPlantaSVG(SI, { ro: true, w: 300 })}</div><div class="plact"><button class="btn sm" data-goc="sala">Ver edificio</button></div><p class="hint">Ubicación según el layout general r5.</p>`;
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
