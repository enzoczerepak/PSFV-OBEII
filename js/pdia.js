/* Parte diario automático: junta lo registrado en todos los frentes para una fecha.
   Salidas: PDF (printHTML) y texto listo para WhatsApp (Copiar texto). Solo lectura. */
const PDIA = { f: null };
const fLocal = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

function pdiaDatos(f) {
  const D = { f, sec: [] };
  // clima / jornada
  try { const e = lluEstado(f); D.clima = { k: e.k, txt: (LLU_EST[e.k] || [''])[0], ll: e.ll }; } catch (_) { D.clima = null; }
  // cables, zanjas, puntas, fundaciones (diario)
  try {
    const X = datosPorFecha().dias.get(f);
    if (X) {
      D.cab = CATK.filter((c) => X.m[c] > 0).map((c) => ({ c, n: CATN[c], m: X.m[c] }));
      D.circ = [...X.circ.values()].map((o) => ({ id: o.c.id, nom: o.c.nombre || o.c.id, cat: o.c.cat, m: o.m }));
      D.zanjas = X.zanjas.map((z) => ({ id: z.id, nom: z.nombre || z.id, m: z.len || z.largo || 0 }));
      D.puntas = X.nPuntas; D.bobinas = [...X.bobinas];
      D.fund = X.fund.filter((x) => x.t === 'fin' || !X.fund.some((y) => y.t === 'fin' && y.st === x.st && y.n === x.n));
    }
  } catch (_) {}
  // sala O&M
  try {
    const sa = []; Object.entries(salaS().av).forEach(([key, v]) => { const [k, el] = key.split('|'); const n = (SALA_ETN[k] || {}).n || k;
      if (v.ok && v.fin === f) sa.push({ n, el, t: 'fin' }); else if (v.ini === f) sa.push({ n, el, t: 'inicio' }); });
    const g = new Map(); sa.forEach((x) => { const k = x.n + '|' + x.t; const o = g.get(k) || { n: x.n, t: x.t, els: [] }; o.els.push(x.el); g.set(k, o); });
    D.sala = [...g.values()];
  } catch (_) { D.sala = []; }
  // fibra
  try { const z = Object.entries(foS().z).filter(([, v]) => v && v.fecha === f).map(([k]) => k); D.fibra = z; } catch (_) { D.fibra = []; }
  // hincado
  try {
    const av = (S.hincado && S.hincado.avance) || {}; const ids = Object.keys(av).filter((id) => av[id] && av[id].f === f);
    D.hinc = { trk: ids.length, hincas: ids.reduce((a, id) => { const r = repDe(id); return a + (r ? r.n || 0 : 0); }, 0),
      tot: Object.keys(av).filter((id) => av[id] && av[id].f).length };
  } catch (_) { D.hinc = null; }
  // montaje (estructuras / paneles)
  try { D.mont = typeof montDia === 'function' ? montDia(f) : null; } catch (_) { D.mont = null; }
  // recepción de materiales trackers
  try {
    const T = trkS();
    D.rec = T.ent.filter((e) => e.fecha === f).map((e) => ({ remito: e.remito || 's/remito', cont: e.cont || '', piezas: (e.lin || []).reduce((a, l) => a + (Number(l.rec) || 0), 0), lin: (e.lin || []).length,
      falt: (e.lin || []).filter((l) => (Number(l.rec) || 0) < (Number(l.decl) || 0) || Number(l.dan) > 0).length }));
    D.recl = T.recl.filter((r) => r.fecha === f).map((r) => r.num);
  } catch (_) { D.rec = []; D.recl = []; }
  // máquinas
  try {
    D.maq = maqL().filter((m) => m.activa !== false).map((m) => {
      const h = horasDia(m.id, f); const ev = maqE().filter((e) => e.maq === m.id && (e.fecha === f || e.enCurso));
      return { int: m.interno, desc: m.descripcion || '', h, ev: ev.map((e) => ({ tipo: e.tipo, curso: !!e.enCurso, h: Number(e.horas) || 0, motivo: e.motivo || '' })) };
    }).filter((x) => x.h > 0 || x.ev.length);
  } catch (_) { D.maq = []; }
  // historial (quién cargó qué)
  try {
    const H = (S.hist || []).filter((h) => h.t && fLocal(h.t) === f); const g = new Map();
    H.forEach((h) => { const o = g.get(h.s) || { s: h.s, n: 0, u: new Set() }; o.n++; if (h.u) o.u.add(h.u); g.set(h.s, o); });
    D.hist = [...g.values()].map((o) => ({ s: o.s, n: o.n, u: [...o.u] })); D.nHist = H.length;
  } catch (_) { D.hist = []; D.nHist = 0; }
  D.vacio = !((D.cab || []).length || (D.zanjas || []).length || (D.fund || []).length || D.sala.length || D.fibra.length || (D.hinc && D.hinc.trk) || (D.mont && D.mont.n) || D.rec.length || D.maq.length || D.puntas);
  return D;
}

const pdiaFechaL = (f) => { const d = new Date(f + 'T12:00:00'); return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); };

function pdiaTexto(D) {
  const L = [`*Parte diario · ${S.nombre || 'PSFV Oberá II'}*`, `_${pdiaFechaL(D.f)}_`, ''];
  if (D.clima) L.push(`☁️ Clima: ${D.clima.txt}`);
  if ((D.cab || []).length) { L.push('', '*Tendido de cables*'); D.cab.forEach((c) => L.push(`• ${c.n}: ${fmt(c.m)} m`)); if (D.puntas) L.push(`• Puntas: ${D.puntas}`); }
  if ((D.zanjas || []).length) L.push('', `*Zanjas cerradas:* ${D.zanjas.map((z) => z.nom).join(', ')}`);
  if ((D.fund || []).length) { L.push('', '*Fundaciones STS*'); D.fund.forEach((x) => L.push(`• ${x.st} · ${x.n}: ${x.t === 'fin' ? 'terminada' : 'iniciada'}`)); }
  if (D.sala.length) { L.push('', '*Sala O&M*'); D.sala.forEach((x) => L.push(`• ${x.n} (${x.els.join(', ')}): ${x.t === 'fin' ? 'terminada' : 'iniciada'}`)); }
  if (D.fibra.length) L.push('', `*Fibra óptica:* ${D.fibra.length} tramo(s)`);
  if (D.hinc && D.hinc.trk) L.push('', `*Hincado:* ${D.hinc.trk} trackers · ${fmt(D.hinc.hincas)} hincas (acumulado ${D.hinc.tot} trackers)`);
  if (D.mont && D.mont.n) { L.push('', '*Montaje*'); D.mont.lineas.forEach((t) => L.push(`• ${t}`)); }
  if (D.rec.length) { L.push('', '*Recepción de materiales*'); D.rec.forEach((r) => L.push(`• Remito ${r.remito}: ${fmt(r.piezas)} piezas${r.falt ? ` · ⚠️ ${r.falt} ítem(s) con faltante/daño` : ''}`)); }
  if (D.recl.length) L.push(`• Reclamos al fabricante: ${D.recl.join(', ')}`);
  if (D.maq.length) { L.push('', '*Equipos*'); D.maq.forEach((m) => L.push(`• ${m.int}${m.h ? `: ${fmt(m.h, 1)} h` : ''}${m.ev.map((e) => ` · ${e.tipo === 'parada' ? '🛑 parada' : '🔧 mantenimiento'}${e.curso ? ' en curso' : ` ${fmt(e.h, 1)} h`}${e.motivo ? ` (${e.motivo})` : ''}`).join('')}`)); }
  if (D.vacio) L.push('', 'Sin avances registrados.');
  return L.join('\n');
}

function pdiaHTML(D, pr) {
  const blk = (t, body) => `<div class="${pr ? 'pr-b' : 'card pdb'}"><h3>${t}</h3>${body}</div>`;
  const ul = (a) => `<ul class="pdl">${a.map((x) => `<li>${x}</li>`).join('')}</ul>`;
  const out = [];
  if ((D.cab || []).length) out.push(blk('Tendido de cables', ul(D.cab.map((c) => `${esc(c.n)}: <b>${fmt(c.m)} m</b>`).concat(D.puntas ? [`Puntas: <b>${D.puntas}</b>`] : []))
    + (D.circ.length ? `<p class="hint">Circuitos: ${D.circ.map((c) => esc(c.nom)).join(', ')}</p>` : '')));
  if ((D.zanjas || []).length) out.push(blk('Zanjas cerradas', ul(D.zanjas.map((z) => esc(z.nom)))));
  if ((D.fund || []).length) out.push(blk('Fundaciones STS', ul(D.fund.map((x) => `${esc(x.st)} · ${esc(x.n)}: <b>${x.t === 'fin' ? 'terminada' : 'iniciada'}</b>`))));
  if (D.sala.length) out.push(blk('Sala O&M', ul(D.sala.map((x) => `${esc(x.n)} <span class="hint">(${x.els.map((x) => esc(x)).join(', ')})</span>: <b>${x.t === 'fin' ? 'terminada' : 'iniciada'}</b>`))));
  if (D.fibra.length) out.push(blk('Fibra óptica', `<p>${D.fibra.length} tramo(s) tendidos</p>`));
  if (D.hinc && D.hinc.trk) out.push(blk('Hincado', `<p><b>${D.hinc.trk}</b> trackers · <b>${fmt(D.hinc.hincas)}</b> hincas<br><span class="hint">Acumulado: ${D.hinc.tot} trackers</span></p>`));
  if (D.mont && D.mont.n) out.push(blk('Montaje', ul(D.mont.lineas.map((x) => esc(x)))));
  if (D.rec.length || D.recl.length) out.push(blk('Recepción de materiales', ul(D.rec.map((r) => `Remito ${esc(r.remito)}: <b>${fmt(r.piezas)}</b> piezas en ${r.lin} ítems${r.falt ? ` · <span style="color:#d9573f">${r.falt} con faltante/daño</span>` : ''}`)
    .concat(D.recl.length ? [`Reclamos: ${D.recl.map((x) => esc(x)).join(', ')}`] : []))));
  if (D.maq.length) out.push(blk('Equipos', ul(D.maq.map((m) => `<b>${esc(m.int)}</b> ${esc(m.desc)}${m.h ? ` · ${fmt(m.h, 1)} h trabajadas` : ''}${m.ev.map((e) => ` · <span style="color:${e.tipo === 'parada' ? '#d9573f' : '#f0a23b'}">${e.tipo}${e.curso ? ' en curso' : ' ' + fmt(e.h, 1) + ' h'}</span>${e.motivo ? ' (' + esc(e.motivo) + ')' : ''}`).join('')}`))));
  if (!pr && D.hist.length) out.push(blk('Quién cargó', ul(D.hist.map((h) => `${esc(h.s || 'General')}: ${h.n} cambio(s)${h.u.length ? ' · ' + h.u.map((x) => esc(x)).join(', ') : ''}`))));
  if (!out.length) out.push(blk('Sin avances', '<p class="hint">No hay nada registrado para este día.</p>'));
  return out.join('');
}

function vPdia(el) {
  if (!PDIA.f) PDIA.f = today();
  const D = pdiaDatos(PDIA.f);
  actions([['Copiar texto (WhatsApp)', 'btn', () => pdiaCopiar()], ['PDF del parte', 'btn pri', () => pdiaPdf(PDIA.f)]]);
  el.innerHTML = `<div class="pdh card"><button class="btn sm" data-pd="-1" title="Día anterior">‹</button><input type="date" id="pdF" value="${PDIA.f}"><button class="btn sm" data-pd="1" title="Día siguiente">›</button>
    <b class="pdfl">${esc(pdiaFechaL(PDIA.f))}</b>${D.clima ? `<span class="pdcl" style="--c:${(LLU_EST[D.clima.k] || [, '#ccc'])[1]}">${esc(D.clima.txt)}</span>` : ''}${PDIA.f !== today() ? '<button class="btn sm" data-pd="0">Hoy</button>' : ''}</div>
    <div class="pdg">${pdiaHTML(D)}</div>`;
  el.querySelectorAll('[data-pd]').forEach((b) => (b.onclick = () => { const n = +b.dataset.pd; PDIA.f = n ? sumDias(PDIA.f, n) : today(); render(false); }));
  el.querySelector('#pdF').onchange = (e) => { if (e.target.value) { PDIA.f = e.target.value; render(false); } };
}
async function pdiaCopiar() {
  const t = pdiaTexto(pdiaDatos(PDIA.f || today()));
  try { await navigator.clipboard.writeText(t); toast('Parte copiado: pegalo en WhatsApp'); }
  catch (_) { modal({ title: 'Parte diario (texto)', body: `<textarea style="width:100%;height:50vh" readonly>${esc(t)}</textarea>`, buttons: [['Cerrar', 'btn']] }); }
}
function pdiaPdf(f) {
  const D = pdiaDatos(f);
  printHTML(prHead('Parte diario', esc(pdiaFechaL(f)) + (D.clima ? ' · ' + esc(D.clima.txt) : '')) + `<div class="pr-g">${pdiaHTML(D, true)}</div>`, `Parte diario ${f}.pdf`);
}
