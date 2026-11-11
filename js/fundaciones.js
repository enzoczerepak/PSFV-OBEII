/* PSFV-OBE II · Fundaciones de STS. */
// ======================= FUNDACIONES STS =======================
const ETAPAS = [
  ['exc', 'Excavación'], ['encL', 'Armado de encofrado hormigón de limpieza'], ['hL', 'Carga de hormigón de limpieza'],
  ['hieP', 'Armado de estructura de hierro para platea'], ['encP', 'Armado de encofrado para platea'], ['hP', 'Carga de hormigón en platea'],
  ['hieT', 'Armado de estructura de tabiques'], ['encT', 'Armado de encofrado de tabiques'], ['hT', 'Carga de hormigón en tabiques'],
  ['frag', 'Fraguado general'], ['sts', 'Colocación de STS sobre base'],
];
const ETN = Object.fromEntries(ETAPAS);
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
  const tc = catsUso().map((c) => [c, tot(c, 'tendido') + tot(c, 'parcial'), tot(c, 'requerido')]), tPar = catsUso().reduce((a, c) => a + tot(c, 'parcial'), 0);
  const tA = tc.reduce((a, x) => a + x[1], 0), tB = tc.reduce((a, x) => a + x[2], 0);
  const cs = R.circuitos.filter((c) => c.cat !== 'PAT' && c.cat !== 'LA').map((c) => [c.cat, puntasDe(c)]);
  const pc = ['BT', 'MT'].map((c) => { const g = cs.filter((x) => x[0] === c).map((x) => x[1]); return [c, g.reduce((a, x) => a + x.col, 0), g.reduce((a, x) => a + x.tot, 0)]; });
  const pA = pc.reduce((a, x) => a + x[1], 0), pB = pc.reduce((a, x) => a + x[2], 0);
  const fi = STSL.map((s) => [s, fundInfo(s)]); const fA = fi.reduce((a, [, i]) => a + i.done, 0) / (STSL.length * ETAPAS.length);
  const fila = (lbl, a, b, col) => `<div class="mrow"><span>${lbl}</span><div class="sbt"><div style="width:${b ? ((a / b) * 100).toFixed(1) : 0}%;background:${col}"></div></div><b>${fmt(b ? (a / b) * 100 : 0)}%</b></div>`;
  return `<h2 class="sech">Resumen de obra</h2><div class="grid stagger mods" style="margin-bottom:22px">
    <div class="card mcard" data-go="cables" title="Ver detalle del tendido"><div class="mh"><div>${Charts.ring(tB ? tA / tB : 0, SERIE.BT, 'tendido')}</div><div><h3>Tendido y aprovechamiento de cables</h3><div class="muted">${fmt(tA)} / ${fmt(tB)} m${tPar ? `<br><span style="color:#00797f">${fmt(tPar)} m en tendido parcial</span>` : ''}</div></div></div>${tc.map(([c, a, b]) => fila(`${ctag(c)}${c}`, a, b, SERIE[c])).join('')}<div class="muted" style="margin-top:6px">Zanja BT ${fmt(R.zanjas.BT.realizada)} / ${fmt(R.zanjas.BT.total)} m · MT ${fmt(R.zanjas.MT.realizada)} / ${fmt(R.zanjas.MT.total)} m</div></div>
    <div class="card mcard" data-go="puntas" title="Ver detalle de puntas"><div class="mh"><div>${Charts.ring(pB ? pA / pB : 0, '#e0457b', 'colocadas')}</div><div><h3>Puntas de cable</h3><div class="muted">${fmt(pA)} / ${fmt(pB)} puntas</div></div></div>${pc.map(([c, a, b]) => fila(`${ctag(c)}${c}`, a, b, SERIE[c])).join('')}</div>
    <div class="card mcard" data-go="fundaciones" title="Ver detalle de fundaciones"><div class="mh" style="margin-bottom:4px"><div>${Charts.ring(fA, FCOL.done, 'bases')}</div><div><h3>Fundaciones STS</h3><div class="muted">${fi.reduce((a, [, i]) => a + i.done, 0)} / ${STSL.length * ETAPAS.length} etapas</div></div></div><div class="minists">${fi.map(([s, i]) => `<div>${stsSVG(i.p, { small: true })}<span>${s}</span></div>`).join('')}</div></div>
    ${foModHTML()}${lmtModHTML()}${hincModHTML()}${cronoModHTML()}</div>`;
}
function fundAvanceHTML() {
  const fi = STSL.map((s) => [s, fundInfo(s)]);
  const rows = fi.map(([s, i]) => ({ label: s, right: `${fmt(i.p * 100)}% · ${i.done}/${i.n}`, parts: [{ v: i.done, color: FCOL.done, name: 'Terminadas' }, { v: i.curso.length, color: FCOL.curso, name: 'En curso' }, { v: i.n - i.done - i.curso.length, color: FCOL.pend, name: 'Pendientes' }] }));
  const er = ETAPAS.map(([k, n], idx) => { const d = STSL.filter((s) => ((((S.fundaciones || {})[s]) || {})[k] || {}).ok).length, c = STSL.filter((s) => { const v = (((S.fundaciones || {})[s]) || {})[k] || {}; return v.ini && !v.ok; }).length; return { label: `${idx + 1}. ${n.length > 30 ? n.slice(0, 29) + '…' : n}`, right: `${d}/${STSL.length} STS`, parts: [{ v: d, color: FCOL.done, name: 'Terminada' }, { v: c, color: FCOL.curso, name: 'En curso' }, { v: STSL.length - d - c, color: FCOL.pend, name: 'Pendiente' }] }; });
  const leg = Charts.legend([[FCOL.done, 'Terminadas'], [FCOL.curso, 'En curso'], [FCOL.pend, 'Pendientes']]);
  return `<h2 class="sech">Fundaciones STS</h2><div class="grid g2 stagger"><div class="card"><h3>Avance por STS</h3><div class="minists big">${fi.map(([s, i]) => `<div>${stsSVG(i.p)}<span>${s}</span></div>`).join('')}</div>${Charts.hbars(rows, { labelW: 60, unit: 'etapas' })}${leg}</div>
    <div class="card"><h3>Avance por etapa</h3>${Charts.hbars(er, { labelW: 230, rightW: 80, unit: 'STS' })}${leg}</div></div>`;
}
