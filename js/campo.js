/* PSFV-OBE II · Inicio "Para hoy", carga rápida de campo (botones grandes) y frentes terminados archivados en el menú. */

// ---------- pendientes del día ----------
function pendientesHoy() {
  const P = [], hoy = today(), ayer = sumDias(hoy, -1);
  const add = (ico, txt, go, col, fn) => P.push({ ico, txt, go, col: col || '#f0a23b', fn });
  try { [ayer, hoy].forEach((f) => { const e = lluEstado(f); if (e.k === 'sindato') add('🌧️', `${f === hoy ? 'Hoy' : 'Ayer'} llovió: indicar si se trabajó`, null, '#3d86d6', () => verLluvias()); }); } catch (_) {}
  try { const ec = evCurso(); if (ec.length) add('🛑', `${ec.length} parada${ec.length > 1 ? 's' : ''} / mantenimiento${ec.length > 1 ? 's' : ''} en curso`, 'maqev', '#d9573f'); } catch (_) {}
  try { const sin = maqL().filter((m) => m.activa !== false && !m.sinHoro && datoDia(m.id, ayer).v == null && !(m.sinHoro && datoDia(m.id, ayer).h != null));
    const dSem = new Date(ayer + 'T12:00:00').getDay(); if (sin.length && dSem !== 0) add('⏱️', `${sin.length} equipo${sin.length > 1 ? 's' : ''} sin horómetro de ayer`, 'maq'); } catch (_) {}
  try { const I = trkInfo(); const sinR = I.difs.filter((d) => !d.recl).length; if (sinR) add('📦', `${sinR} diferencia${sinR > 1 ? 's' : ''} de entregas sin reclamar a Trina`, 'trecl', '#d9573f');
    const borr = trkS().recl.filter((r) => r.estado === 'borrador').length; if (borr) add('✉️', `${borr} reclamo${borr > 1 ? 's' : ''} en borrador sin enviar`, 'trecl'); } catch (_) {}
  try { if (window.PLANO) { const HA = (S.hincado || {}).avance || {}, ix = monIdx(), T = monTrk();
    const fa = T.filter((t) => HA[t.id] && monEstado(ix.get('arm|' + t.id), 'arm') === 0).length, fp = T.filter((t) => monEstado(ix.get('arm|' + t.id), 'arm') === 2 && monEstado(ix.get('pan|' + t.id), 'pan') === 0).length;
    if (fa) add('🔩', `${fa} tracker${fa > 1 ? 's' : ''} hincado${fa > 1 ? 's' : ''} listos para armar`, 'tarm', '#3fb27f');
    if (fp) add('☀️', `${fp} tracker${fp > 1 ? 's' : ''} con estructura lista para paneles`, 'tpan', '#3fb27f'); } } catch (_) {}
  try { const pp = window.VISOR ? 0 : (S.partes || []).filter((p) => p.estado === 'pendiente').length; if (pp) add('📲', `${pp} parte${pp > 1 ? 's' : ''} de campo para revisar`, 'partes'); } catch (_) {}
  try { const zc = R.zlist.filter((z) => z.estado === 'abierta' && z.listoCerrar).length; if (zc) add('🚧', `${zc} zanja${zc > 1 ? 's' : ''} con cable tendido sin tapar`, 'zanjas'); } catch (_) {}
  return P;
}
function avanceGeneral() {
  const F = [];
  try { const t = R.resumen.reduce((a, r) => a + r.tendido + (r.parcial || 0), 0), q = R.resumen.reduce((a, r) => a + r.requerido, 0); if (q) F.push(['Cables', t / q, '#2fc4b2', 'cables']); } catch (_) {}
  try { const fi = STSL.map((s) => fundInfo(s)); F.push(['Fundaciones STS', fi.reduce((a, i) => a + i.done, 0) / (STSL.length * ETAPAS.length), '#f2b33d', 'fundaciones']); } catch (_) {}
  try { F.push(['Edificio O&M', salaInfo().p, '#b294ff', 'sala']); } catch (_) {}
  try { const T = foTotales(); if (T.n) F.push(['Fibra óptica', T.tubo ? T.col / T.tubo : 0, '#5ab8ff', 'fo']); } catch (_) {}
  try { if (lmtPq().length) F.push(['Línea MT', lmtInfo().p, '#8b9dff', 'lmt']); } catch (_) {}
  try { const HI = hincInfo(); if (HI) F.push(['Hincado', HI.nH / (HI.trk.length || 1), '#7c5cbf', 'hincado']); } catch (_) {}
  try { if (window.PLANO) { F.push(['Estructuras', monInfo('arm').p, '#3fb27f', 'tarm']); F.push(['Paneles', monInfo('pan').p, '#f0a23b', 'tpan']); } } catch (_) {}
  return F;
}
function paraHoyHTML() {
  const P = pendientesHoy(), F = avanceGeneral(), D = pdiaDatos(today());
  const hecho = [];
  if ((D.cab || []).length) hecho.push(`${fmt(D.cab.reduce((a, c) => a + c.m, 0))} m de cable`);
  if (D.hinc && D.hinc.trk) hecho.push(`${D.hinc.trk} trackers hincados`);
  if (D.mont && D.mont.n) hecho.push(`${D.mont.n} etapas de montaje`);
  if ((D.fund || []).length) hecho.push(`${D.fund.length} etapas de fundaciones`);
  if (D.sala.length) hecho.push(`${D.sala.length} tareas en la sala`);
  if (D.rec.length) hecho.push(`${D.rec.length} entrega${D.rec.length > 1 ? 's' : ''} recibida${D.rec.length > 1 ? 's' : ''}`);
  return `<div class="phoy">
    <div class="card phc"><div class="phh"><h3>${window.VISOR ? 'Situación de hoy' : 'Para hoy'}</h3>${window.VISOR ? '' : '<button class="btn acc" data-go="campo">⚡ Carga rápida de campo</button>'}</div>
      ${P.length ? `<div class="phl">${P.map((p, i) => `<button class="phi" style="--c:${p.col}" ${p.go ? `data-go="${p.go}"` : `data-ph="${i}"`}><span class="phe">${p.ico}</span><span>${esc(p.txt)}</span><i class="pha">›</i></button>`).join('')}</div>`
        : '<p class="muted" style="margin:6px 0">Todo al día: no hay pendientes.</p>'}
      <div class="phd"><span><b>Hoy se cargó:</b> ${hecho.length ? hecho.join(' · ') : '<span class="muted">nada todavía</span>'}</span><button class="btn sm" data-go="pdia">Parte diario</button></div></div>
    <div class="card phc"><div class="phh"><h3>Avance general</h3><button class="btn sm" data-go="avance">Detalle</button></div>
      ${F.map(([n, p, c, g]) => `<div class="mrow phr" data-go="${g}"><span>${n}</span><div class="sbt"><div style="width:${(Math.min(1, p) * 100).toFixed(1)}%;background:${c}"></div></div><b>${fmt(p * 100)}%</b></div>`).join('')}</div>
  </div>`;
}
function bindParaHoy(el) {
  const P = pendientesHoy();
  $$('[data-ph]', el).forEach((b) => { b.onclick = () => { const p = P[+b.dataset.ph]; if (p && p.fn) p.fn(); }; });
}

// ---------- carga rápida de campo ----------
const CAMPO = [
  ['hinc', '🔨', 'Hincado', 'Marcar trackers hincados', '#7c5cbf'],
  ['arm', '🔩', 'Armado de estructura', 'Etapas por rango de trackers', '#3fb27f'],
  ['pan', '☀️', 'Paneles', 'Módulos, fijación y strings', '#f0a23b'],
  ['zanjas', '🚧', 'Zanjas y cables', 'Abrir, tender y tapar', '#2fc4b2'],
  ['fundaciones', '🏗️', 'Fundaciones STS', 'Etapas de las bases', '#f2b33d'],
  ['sala', '🏢', 'Edificio O&M', 'Zapatas, vigas y muros', '#b294ff'],
  ['maq', '⏱️', 'Horas de equipos', 'Horómetro del día', '#ff8f57'],
  ['maqev', '🛑', 'Parada / mantenimiento', 'Iniciar o finalizar', '#d9573f'],
  ['rec', '📦', 'Llegó material', 'Registrar una entrega', '#4f8fe6'],
  ['llu', '🌧️', 'Lluvia / jornada', 'Marcar el día', '#3d86d6'],
  ['pdia', '📋', 'Parte diario', 'PDF y texto WhatsApp', '#556070'],
];
function vCampo(el) {
  actions([]);
  el.innerHTML = `<div class="cgrid">${CAMPO.map(([k, e, t, s, c]) => `<button class="cbtn" data-c="${k}" style="--c:${c}"><span class="ce">${e}</span><b>${t}</b><small>${s}</small></button>`).join('')}</div>
    <p class="hint">Pensada para la tablet o el celular: lo de todos los días a un toque. Hincado y montaje se cargan por rango de trackers (por ejemplo <b>120-180, 200</b>).</p>`;
  $$('[data-c]', el).forEach((b) => { b.onclick = () => campoAccion(b.dataset.c); });
}
// "120-180, 200, TRK-305" → ids de trackers existentes
function parseRango(txt) {
  const T = new Set(monTrk().map((t) => t.id)), out = new Set();
  const id = (n) => 'TRK-' + String(n).padStart(3, '0');
  String(txt || '').toUpperCase().replace(/TRK-?/g, '').replace(/\s*(?:-|\bAL\b|\bA\b)\s*/g, '-').split(/[,;\s]+/).forEach((p) => {
    const m = p.match(/^(\d+)-(\d+)$/);
    if (m) { const a = +m[1], b = +m[2]; for (let i = Math.min(a, b); i <= Math.max(a, b); i++) if (T.has(id(i))) out.add(id(i)); }
    else if (/^\d+$/.test(p) && T.has(id(+p))) out.add(id(+p));
  });
  return [...out];
}
async function campoRango(tit, sub) {
  return modal({ title: tit, sub, body: `<div class="form"><label>Trackers<input type="text" id="cR" placeholder="Ej.: 120-180, 200" style="font-size:20px;padding:10px" autofocus></label><p class="hint" id="cRn">Escribí uno o varios rangos.</p></div>`,
    buttons: [['Cancelar', 'btn', () => null], ['Seguir', 'btn pri', (b) => { const ids = parseRango($('#cR', b).value); if (!ids.length) { $('#cRn', b).textContent = 'No encontré trackers en ese rango.'; return false; } return ids; }]] });
}
document.addEventListener('input', (e) => { if (e.target && e.target.id === 'cR') { const n = parseRango(e.target.value).length, h = document.getElementById('cRn'); if (h) h.textContent = n ? `${n} tracker${n > 1 ? 's' : ''}` : 'Escribí uno o varios rangos.'; } });
async function campoAccion(k) {
  if (k === 'hinc') { const ids = await campoRango('Hincado', 'Trackers con todas sus hincas hincadas'); if (ids) setTimeout(() => marcarHincado(ids, true), 50); return; }
  if (k === 'arm' || k === 'pan') { const ids = await campoRango(MON_T[k][0], 'Después elegís las etapas y la fecha'); if (ids) setTimeout(() => monMarcar(k, ids), 50); return; }
  if (k === 'rec') { trkEditEnt(); return; }
  if (k === 'llu') { verLluvias(); return; }
  go(k);
}

// ---------- frentes terminados: se archivan al final del menú ----------
function frentesP() {
  const p = {};
  try { const fi = STSL.map((s) => fundInfo(s)); p.fundaciones = fi.reduce((a, i) => a + i.done, 0) / (STSL.length * ETAPAS.length); } catch (_) {}
  try { p.sala = salaInfo().p; } catch (_) {}
  try { const T = foTotales(); if (T.n) p.fo = T.tubo ? T.col / T.tubo : 0; } catch (_) {}
  try { if (lmtPq().length) p.lmt = lmtInfo().p; } catch (_) {}
  try { const t = R.resumen.reduce((a, r) => a + r.tendido + (r.parcial || 0), 0), q = R.resumen.reduce((a, r) => a + r.requerido, 0); if (q) p.cables = t / q; } catch (_) {}
  try { if (window.PLANO) { const HI = hincInfo(); p.trk = Math.min(HI ? HI.nH / (HI.trk.length || 1) : 0, monInfo('arm').p, monInfo('pan').p); } } catch (_) {}
  return p;
}
let archTimer = 0;
function menuArchivar() {
  clearTimeout(archTimer); archTimer = setTimeout(() => {
    const nav = document.getElementById('nav'); if (!nav) return;
    let box = document.getElementById('navArch');
    if (!box) { box = document.createElement('div'); box.id = 'navArch'; box.innerHTML = '<button class="archh" type="button"><span>Frentes terminados</span><em></em></button><div class="archb"></div>'; nav.appendChild(box);
      box.querySelector('.archh').onclick = () => box.classList.toggle('open'); }
    const body = box.querySelector('.archb'), P = frentesP();
    Object.keys(MCOL).forEach((k) => {
      const node = nav.querySelector(`:scope > .sect[data-sect="${k}"], :scope > button[data-view="${k}"]`) || body.querySelector(`.sect[data-sect="${k}"], button[data-view="${k}"]`); if (!node) return;
      const term = P[k] != null && P[k] >= 0.9999, enArch = node.parentNode === body;
      if (term && !enArch) { node._ph = document.createComment('arch-' + k); node.parentNode.insertBefore(node._ph, node); body.appendChild(node); }
      else if (!term && enArch && node._ph) { node._ph.parentNode.insertBefore(node, node._ph); node._ph.remove(); node._ph = null; }
    });
    const n = body.children.length; box.style.display = n ? '' : 'none'; box.querySelector('em').textContent = n;
  }, 400);
}
