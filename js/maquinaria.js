/* PSFV-OBE II · Maquinaria de obra: equipos, horas semanales (horómetro) y registro de paradas y mantenimientos.
   Datos: S.maquinas [{id, interno, descripcion, marca, modelo, serie, propiedad, activa, obs}]
          S.maqHoras  [{id: maq|semana, maq, semana (lunes AAAA-MM-DD), lect {fecha: horómetro al fin de la jornada}, hs {fecha: horas} (equipos sin horómetro), obs}]
   El horómetro de fin de una jornada es el de inicio de la siguiente: se carga un solo dato por día.
          S.maqEventos [{id, maq, tipo: 'parada'|'mantenimiento', fecha, horas, motivo, obs}] */
const MAQ_V = ['maq', 'maqeq', 'maqev'];
const MAQ_MOT = {
  parada: ['Rotura / falla', 'Falta de operador', 'Lluvia / clima', 'Falta de combustible', 'Falta de frente de trabajo', 'Traslado', 'Espera de repuestos', 'Otro'],
  mantenimiento: ['Service preventivo', 'Cambio de aceite y filtros', 'Engrase', 'Neumáticos / orugas', 'Correctivo / reparación', 'Hidráulico', 'Eléctrico', 'Otro'],
};
const MAQ_TIPO = { parada: ['Parada', 'p-bad'], mantenimiento: ['Mantenimiento', 'p-warn'] };
const maqL = () => (S.maquinas = S.maquinas || []);
const maqH = () => (S.maqHoras = S.maqHoras || []);
const maqE = () => (S.maqEventos = S.maqEventos || []);
const maqDe = (id) => maqL().find((m) => m.id === id);
const maqNom = (m) => (m ? `${m.interno} · ${m.descripcion}` : '–');
const maqOrd = (a, b) => String(a.interno).localeCompare(String(b.interno), 'es', { numeric: true });
// semana: lunes de la fecha (AAAA-MM-DD, hora local)
function lunesDe(f) {
  const d = new Date((f || today()) + 'T12:00:00'); const w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w);
  return d.toISOString().slice(0, 10);
}
const sumDias = (f, n) => { const d = new Date(f + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const semTxt = (l) => `${fechaCorta(l)} al ${fechaCorta(sumDias(l, 6))}`;
const enSemana = (f, l) => f >= l && f <= sumDias(l, 6);
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const diasSem = (l) => DIAS.map((_, i) => sumDias(l, i));
const regDe = (maq, sem) => maqH().find((r) => r.maq === maq && r.semana === sem);
const vacio = (v) => v === '' || v == null || isNaN(Number(v));
// todas las lecturas de horómetro (fin de jornada) de un equipo, ordenadas por fecha
function lecturas(maq) {
  const out = [];
  maqH().filter((r) => r.maq === maq).forEach((r) => {
    Object.entries(r.lect || {}).forEach(([d, v]) => { if (!vacio(v)) out.push([d, Number(v)]); });
    if (!r.lect && Number(r.horoFin) > 0) { if (!vacio(r.horoIni)) out.push([sumDias(r.semana, -1), Number(r.horoIni)]); out.push([sumDias(r.semana, 6), Number(r.horoFin)]); } // formato semanal anterior
  });
  return out.sort((a, b) => a[0].localeCompare(b[0]));
}
// horómetro al inicio de la jornada f = última lectura anterior (o el horómetro al ingreso a obra)
function horoAntes(maq, f, L) {
  L = L || lecturas(maq); let v = null;
  for (const [d, x] of L) { if (d < f) v = x; else break; }
  if (v == null) { const m = maqDe(maq); if (m && !vacio(m.horoIngreso)) v = Number(m.horoIngreso); }
  return v;
}
// horas trabajadas en el día f (si un día no se cargó, las horas se acumulan en la próxima lectura)
function horasDia(maq, f, L) {
  const m = maqDe(maq) || {};
  if (m.sinHoro) return Number((((regDe(maq, lunesDe(f)) || {}).hs) || {})[f]) || 0;
  L = L || lecturas(maq); const e = L.find((x) => x[0] === f); if (!e) return 0;
  const a = horoAntes(maq, f, L); return a == null ? 0 : Math.max(0, e[1] - a);
}
function horasSem(maq, sem) {
  const L = lecturas(maq), r = regDe(maq, sem);
  let t = diasSem(sem).reduce((a, d) => a + horasDia(maq, d, L), 0);
  if (r && !r.lect && !r.hs && !(Number(r.horoFin) > 0)) t += Number(r.horas) || 0; // formato semanal anterior
  return t;
}
const horasTot = (maq) => [...new Set(maqH().filter((r) => r.maq === maq).map((r) => r.semana))].reduce((a, sm) => a + horasSem(maq, sm), 0);
const ultLect = (maq) => { const L = lecturas(maq); return L.length ? L[L.length - 1] : null; };
const evSem = (maq, sem, tipo) => maqE().filter((e) => (!maq || e.maq === maq) && enSemana(e.fecha, sem) && (!tipo || e.tipo === tipo)).reduce((a, e) => a + (Number(e.horas) || 0), 0);
const dispo = (t, p) => (t + p > 0 ? t / (t + p) : null);
const numIn = (v) => (vacio(v) ? '' : String(Number(v)));

// ---- mantenimiento programado: cada N horas de uso desde el último service ----
// base: el último mantenimiento marcado como "service programado" (con su horómetro), si no el horómetro del último service
// cargado en la ficha, si no el horómetro al ingreso.
function servicio(m) {
  const N = Number(m.mantCada); if (!(N > 0)) return null;
  const sv = maqE().filter((e) => e.maq === m.id && e.tipo === 'mantenimiento' && e.reinicia).sort((a, b) => a.fecha.localeCompare(b.fecha)).pop();
  let base = null, desde = m.fechaIngreso || '';
  if (sv) { desde = sv.fecha; base = !vacio(sv.horo) ? Number(sv.horo) : m.sinHoro ? null : horoAntes(m.id, sumDias(sv.fecha, 1)); }
  else if (!vacio(m.horoUltMant)) base = Number(m.horoUltMant);
  else if (!vacio(m.horoIngreso)) base = Number(m.horoIngreso);
  let usado;
  if (m.sinHoro) usado = maqH().filter((r) => r.maq === m.id).reduce((a, r) => a + Object.entries(r.hs || {}).filter(([f]) => !desde || f > desde).reduce((x, [, v]) => x + (Number(v) || 0), 0), 0);
  else { const u = ultLect(m.id); if (base == null) return { N, sinBase: true }; usado = Math.max(0, (u && u[0] >= (sv ? sv.fecha : '') ? u[1] : base) - base); }
  const faltan = N - usado;
  return { N, base, usado, faltan, prox: base != null ? base + N : null, desde, sv, nivel: faltan <= 0 ? 'venc' : faltan <= Math.max(20, N * 0.1) ? 'prox' : 'ok' };
}
function servHTML(m, corto) {
  const s = servicio(m); if (!s) return corto ? '<span class="muted">–</span>' : '';
  if (s.sinBase) return '<span class="muted" title="Cargá el horómetro al ingreso o del último service">sin base</span>';
  const pct = Math.max(0, Math.min(100, (s.usado / s.N) * 100));
  const txt = s.faltan <= 0 ? `vencido ${fmt(-s.faltan, 1)} h` : `faltan ${fmt(s.faltan, 1)} h`;
  return `<div class="svc ${s.nivel}" title="Service cada ${fmt(s.N)} h · usadas ${fmt(s.usado, 1)} h${s.prox != null && !m.sinHoro ? ` · próximo a los ${fmt(s.prox, 1)} h de horómetro` : ''}"><b>${txt}</b><span class="svb"><i style="width:${pct.toFixed(0)}%"></i></span>${corto ? '' : `<small>cada ${fmt(s.N)} h${s.prox != null && !m.sinHoro ? ` · a los ${fmt(s.prox, 1)}` : ''}</small>`}</div>`;
}

// ======================= HORAS SEMANALES =======================
// ---- mes: días AAAA-MM-DD del mes 'AAAA-MM' ----
const MESL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const mesTxt = (ym) => `${MESL[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
function diasMes(ym) { const [y, m] = ym.split('-').map(Number), n = new Date(y, m, 0).getDate(); return Array.from({ length: n }, (_, i) => `${ym}-${String(i + 1).padStart(2, '0')}`); }
const mesMas = (ym, k) => { const [y, m] = ym.split('-').map(Number), d = new Date(y, m - 1 + k, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const DSEM = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const dowDe = (f) => new Date(f + 'T12:00:00').getDay();
function horasMes(maq, ym, L) { L = L || lecturas(maq); return diasMes(ym).reduce((a, d) => a + horasDia(maq, d, L), 0); }
const solMes = (maq, ym) => maqE().filter((e) => (!maq || e.maq === maq) && e.fecha.startsWith(ym)).reduce((a, e) => a + (Number(e.sol) || 0), 0);
const solTot = (maq) => maqE().filter((e) => e.maq === maq).reduce((a, e) => a + (Number(e.sol) || 0), 0);
const evMes = (maq, ym, tipo) => maqE().filter((e) => (!maq || e.maq === maq) && e.fecha.startsWith(ym) && (!tipo || e.tipo === tipo)).reduce((a, e) => a + (Number(e.horas) || 0), 0);
const tieneMes = (maq, ym) => maqH().some((r) => r.maq === maq && (Object.keys(r.lect || {}).some((f) => f.startsWith(ym)) || Object.keys(r.hs || {}).some((f) => f.startsWith(ym))));
const datoDia = (maq, f) => { const r = regDe(maq, lunesDe(f)) || {}; return { v: (r.lect || {})[f], h: (r.hs || {})[f], per: (r.per || {})[f] }; };

// ======================= HORAS MENSUALES (registro diario) =======================
function vMaq(el) {
  setTimeout(maqMigrJor, 0);
  const ym = (ui.maqMes = ui.maqMes || today().slice(0, 7));
  const ro = window.READONLY;
  actions([...(ro ? [] : [['Registrar horas', 'btn pri', () => registrarHoras(null, null)], ['▶ Iniciar parada / mant.', 'btn acc', () => iniciarEvento(null)], ['+ Cargar parada a mano', 'btn', () => editEvento(null)], ['+ Equipo', 'btn', () => editMaquina(null)]]),
    ['Exportar Excel', 'btn', exportMaq], ['PDF del mes', 'btn', () => printMaqMes(ym)]]);
  const ms = maqL().filter((m) => m.activa !== false || tieneMes(m.id, ym)).sort(maqOrd);
  const tot = { t: 0, p: 0, m: 0 };
  ms.forEach((m) => { tot.t += horasMes(m.id, ym); tot.p += evMes(m.id, ym, 'parada'); tot.m += evMes(m.id, ym, 'mantenimiento'); tot.s = (tot.s || 0) + solMes(m.id, ym); });
  const dg = dispo(tot.t, tot.p + tot.m - (tot.s || 0));
  let h = `<div class="tools"><button class="btn" id="mesAnt">◀</button><b style="min-width:160px;text-align:center">${mesTxt(ym)}</b><button class="btn" id="mesSig">▶</button>
    <input type="month" id="mesSel" value="${ym}" title="Ir al mes"><button class="btn ghost" id="mesHoy">Este mes</button><span class="sp"></span>
    <span class="muted">${ms.length} equipo${ms.length === 1 ? '' : 's'}</span></div>
    <div class="kpis k4" style="margin-bottom:14px">${kpi('Horas trabajadas en el mes', tot.t, 'h', 1)}${kpi('Horas de parada', tot.p, 'h', 1)}${kpi('Horas de mantenimiento', tot.m, 'h', 1)}
      <div class="kpi"><span>Disponibilidad</span><b>${dg == null ? '–' : fmt(dg * 100)}<small>${dg == null ? '' : '%'}</small></b></div></div>`;
  h += evCursoHTML();
  const avis = maqL().filter((m) => m.activa !== false).map((m) => [m, servicio(m)]).filter(([, x]) => x && !x.sinBase && x.nivel !== 'ok').sort((a, b) => a[1].faltan - b[1].faltan);
  if (avis.length) h += `<div class="alerts" style="margin-bottom:12px">${avis.map(([m, x]) => `<div class="alert ${x.nivel === 'venc' ? 'error' : 'aviso'}" style="display:block"><b>${esc(m.interno)} · ${esc(m.descripcion)}</b>: ${x.faltan <= 0 ? `service vencido hace ${fmt(-x.faltan, 1)} h` : `faltan ${fmt(x.faltan, 1)} h para el service`} (cada ${fmt(x.N)} h${x.prox != null && !m.sinHoro ? `, a los ${fmt(x.prox, 1)} h de horómetro` : ''})</div>`).join('')}</div>`;
  if (!maqL().length) {
    el.innerHTML = h + `<div class="empty"><b>Todavía no hay equipos cargados</b><p>Cargá cada máquina con su número de interno, descripción, marca y modelo.</p>${ro ? '' : '<button class="btn pri" id="maqPrim">+ Cargar el primer equipo</button>'}</div>`;
    const b = $('#maqPrim'); if (b) b.onclick = () => editMaquina(null);
    bindMes(); return;
  }
  const ds = diasMes(ym), hoy = today();
  h += `<div class="tblwrap maqwrap"><table class="tbl maqt maqm"><thead><tr><th class="fx1">Interno</th><th class="fx2">Equipo</th><th class="n fx3">Mes (h)</th><th class="fx4">Próx. service</th><th class="n fx5">Parada</th><th class="n fx6">Mant.</th><th class="n fx7">Disp.</th>
    ${ds.map((d) => { const w = dowDe(d); return `<th class="n dcol ${d === hoy ? 'hoy' : ''} ${w === 0 || w === 6 ? 'fds' : ''}">${DSEM[w]}<br>${Number(d.slice(8))}</th>`; }).join('')}<th></th></tr></thead><tbody>`;
  ms.forEach((m) => {
    const L = lecturas(m.id), t = horasMes(m.id, ym, L), p = evMes(m.id, ym, 'parada'), mm = evMes(m.id, ym, 'mantenimiento'), d = dispo(t, p + mm - solMes(m.id, ym));
    const evD = {}; maqE().filter((e) => e.maq === m.id && e.fecha.startsWith(ym)).forEach((e) => { (evD[e.fecha] = evD[e.fecha] || []).push(e); });
    h += `<tr data-id="${m.id}"><td class="mono fx1"><b>${esc(m.interno)}</b></td><td class="fx2">${esc(m.descripcion)}${evsDeMaq(m.id).map((x) => ` <span class="pill ${MAQ_TIPO[x.tipo][1]}" title="${MAQ_TIPO[x.tipo][0]} en curso">⏱ ${x.tipo === 'parada' ? 'parada' : 'mant.'} ${tmrHTML(x)}</span>`).join('')}<div class="muted" style="font-size:11px">${esc([m.marca, m.modelo].filter(Boolean).join(' '))}${m.sinHoro ? ' · sin horómetro' : ''}</div></td>
      <td class="n fx3"><b>${fmt(t, 1)}</b></td><td class="fx4">${servHTML(m, true)}</td>
      <td class="n fx5">${p ? `<b style="color:var(--bad)">${fmt(p, 1)}</b>` : '–'}</td><td class="n fx6">${mm ? `<b style="color:var(--warn)">${fmt(mm, 1)}</b>` : '–'}</td>
      <td class="n fx7">${d == null ? '–' : `<span class="pill ${d >= 0.85 ? 'p-done' : d >= 0.6 ? 'p-prov' : 'p-bad'}">${fmt(d * 100)}%</span>`}</td>
      ${ds.map((f) => {
        const x = datoDia(m.id, f), w = dowDe(f), ev = evD[f] || [], evT = ev.map((e) => `${MAQ_TIPO[e.tipo][0]}: ${e.motivo} (${fmt(e.horas, 1)} h${vacio(e.horo) ? '' : ` a los ${fmt(Number(e.horo), 1)}`})`).join(' · ');
        const evI = ev.length ? `<i class="evd ${ev.some((e) => e.tipo === 'parada') ? 'par' : 'man'}"></i>` : '';
        const cls = `dcol ${w === 0 || w === 6 ? 'fds' : ''} ${f === hoy ? 'hoy' : ''}`;
        if (m.sinHoro) return `<td class="n ${cls}"><button class="dcel ${vacio(x.h) ? 'vac' : ''} ${x.per ? 'per' : ''}" data-d="${f}" ${ro || f > hoy ? 'disabled' : ''} title="${fechaCorta(f)}${vacio(x.h) ? ' · sin registro' : ` · ${fmt(Number(x.h), 1)} h${x.per ? ' (período desde ' + fechaCorta(x.per) + ')' : ''}`}${evT ? ' · ' + evT : ''}">${vacio(x.h) ? '·' : `<b>${fmt(Number(x.h), 1)}</b>${x.per ? '<small>per.</small>' : ''}`}${evI}</button></td>`;
        const ant = horoAntes(m.id, f, L), hd = horasDia(m.id, f, L);
        return `<td class="n ${cls}"><button class="dcel ${vacio(x.v) ? 'vac' : ''} ${x.per ? 'per' : ''}" data-d="${f}" ${ro || f > hoy ? 'disabled' : ''} title="${fechaCorta(f)}${vacio(x.v) ? ' · sin registro' : ` · horómetro ${fmt(Number(x.v), 1)} (inicio ${ant != null ? fmt(ant, 1) : '?'}) → ${fmt(hd, 1)} h${x.per ? ' · período desde ' + fechaCorta(x.per) : ''}`}${evT ? ' · ' + evT : ''}">${vacio(x.v) ? '·' : `<b>${ant == null ? '?' : fmt(hd, 1)}</b><small>${x.per ? 'per.' : fmt(Number(x.v), 1)}</small>`}${evI}</button></td>`;
      }).join('')}
      <td style="white-space:nowrap">${ro ? '' : `${evsDeMaq(m.id).map((x) => `<button class="btn sm pri" data-fin="${x.id}" title="Finalizar ${MAQ_TIPO[x.tipo][0].toLowerCase()} en curso">■ Fin ${x.tipo === 'parada' ? 'parada' : 'mant.'}</button> `).join('')}${tipoLibre(m.id) ? `<button class="btn sm acc" data-a="ev" title="Iniciar el contador de una parada o un mantenimiento">▶ ${evsDeMaq(m.id).length ? (tipoLibre(m.id) === 'parada' ? 'Parada' : 'Mantenimiento') : 'Parada / mant.'}</button>` : ''} <button class="btn sm ghost" data-a="ed" title="Editar equipo">✎</button>`}</td></tr>`;
  });
  h += `</tbody></table></div><p class="hint">Cada casillero es una jornada: arriba las horas del día y abajo el horómetro al terminar (el inicio de cada jornada es el fin de la anterior). Se carga con <b>Registrar horas</b> o tocando el día. Si un día no se carga, esas horas se suman a la próxima lectura. Puntito rojo = parada, naranja = mantenimiento (pasá el mouse para ver el detalle). Sábados y domingos sombreados. Disponibilidad = trabajadas / (trabajadas + paradas + mantenimiento).</p>`;
  if (!ro) h += cargaRapidaHTML();
  el.innerHTML = h;
  bindMes(); bindEvCurso(el); if (!ro) bindCargaRapida(el);
  // ubicar el día de hoy a la vista
  const wrap = $('.maqwrap', el), th = $('th.hoy', el); if (wrap && th) wrap.scrollLeft = Math.max(0, th.offsetLeft - 590 - (wrap.clientWidth - 590) / 2);
  if (ro) return;
  $$('tbody tr', el).forEach((tr) => {
    const id = tr.dataset.id;
    $$('.dcel', tr).forEach((b) => { b.onclick = () => registrarHoras(id, b.dataset.d); });
    const b1 = tr.querySelector('[data-a=ev]'); if (b1) b1.onclick = () => iniciarEvento(id);
    $$('[data-fin]', tr).forEach((b) => { b.onclick = () => finalizarEvento(b.dataset.fin); });
    const b2 = tr.querySelector('[data-a=ed]'); if (b2) b2.onclick = () => editMaquina(id);
  });
}
function bindMes() {
  const set = (v) => { ui.maqMes = v; render(false); };
  $('#mesAnt').onclick = () => set(mesMas(ui.maqMes, -1));
  $('#mesSig').onclick = () => set(mesMas(ui.maqMes, 1));
  $('#mesHoy').onclick = () => set(today().slice(0, 7));
  $('#mesSel').onchange = (e) => { if (e.target.value) set(e.target.value); };
}

// ======================= CARGA RÁPIDA (debajo del calendario) =======================
// La carga del día con un casillero por equipo y, si quedaron jornadas sin cargar, una tarjeta por cada día pendiente.
const MQC = { f: null };
// equipo en obra pero sin uso (ej. hincadoras hasta que empiece el hincado): no se le piden horas
// m.inact = [{ d: desde, h: hasta|null }] (el último sin "hasta" = inactivo hoy)
const inactEn = (m, f) => (m.inact || []).some((p) => f >= p.d && (!p.h || f <= p.h));
const inactHoy = (m) => (m.inact || []).some((p) => !p.h);
function setInactivo(id, si) {
  const m = maqDe(id); if (!m) return; m.inact = (m.inact || []).slice(); const hoy = today();
  if (si) { if (!inactHoy(m)) m.inact.push({ d: hoy, h: null }); }
  else { const p = m.inact.find((x) => !x.h); if (p) { if (p.d >= hoy) m.inact = m.inact.filter((x) => x !== p); else p.h = sumDias(hoy, -1); } }
  if (!m.inact.length) delete m.inact;
  commit(`${m.interno}: ${si ? 'inactivo (sin uso, no se le piden horas)' : 'vuelve a trabajar'}`);
}
const DIAL = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const diaTxt = (f) => `${DIAL[dowDe(f)]} ${fechaCorta(f).slice(0, 5)}`;
const tieneDato = (m, f) => { const x = datoDia(m.id, f); return !vacio(m.sinHoro ? x.h : x.v); };
// jornadas sin cargar: de lunes a sábado, de los últimos 21 días hasta ayer, después del primer registro del equipo
function diasPendientes(ms) {
  const hoy = today(), out = [];
  const desde = {}; ms.forEach((m) => { const L = lecturas(m.id), hs = maqH().filter((r) => r.maq === m.id).flatMap((r) => Object.keys(r.hs || {})).sort(); desde[m.id] = (m.sinHoro ? hs[0] : L.length ? L[0][0] : null) || null; });
  for (let i = 21; i >= 1; i--) {
    const f = sumDias(hoy, -i); if (dowDe(f) === 0) continue;
    const faltan = ms.filter((m) => desde[m.id] && f > desde[m.id] && !tieneDato(m, f) && !perCubre(m.id, f) && !inactEn(m, f));
    if (faltan.length) out.push({ f, ms: faltan });
  }
  return out.slice(-10);
}
// un período sin registro diario cubre los días que abarca
function perCubre(maq, f) { return maqH().some((r) => r.maq === maq && Object.entries(r.per || {}).some(([fin, ini]) => f >= ini && f <= fin)); }
function filaCarga(m, f) {
  const x = datoDia(m.id, f), ya = m.sinHoro ? x.h : x.v, L = lecturas(m.id).filter((y) => y[0] !== f), ant = m.sinHoro ? null : horoAntes(m.id, f, L), prevD = L.filter((y) => y[0] < f).pop();
  const ref = m.sinHoro ? 'sin horómetro: horas del día' : ant == null ? 'sin horómetro inicial' : `inicio ${fmt(ant, 1)}${prevD ? ` (${fechaCorta(prevD[0]).slice(0, 5)})` : ''}`;
  return `<div class="mqr${vacio(ya) ? '' : ' ya'}" data-m="${m.id}" data-f="${f}"><b class="mono">${esc(m.interno)}</b><span class="muted mqd">${esc(m.descripcion || '')}</span>
    <span class="muted mqref">${ref}</span><input type="number" inputmode="decimal" step="${m.sinHoro ? '0.5' : '0.1'}" min="0" class="mqv" placeholder="${m.sinHoro ? 'horas' : 'horómetro'}" value="${vacio(ya) ? '' : Number(ya)}"><span class="mqh"></span>
    <button class="btn sm ghost mqin" data-inact="${m.id}" title="Equipo en obra sin uso (por ejemplo, una hincadora hasta que empiece el hincado): deja de pedir horas hasta que lo reactives">💤 Inactiva</button></div>`;
}
function tarjetaCarga(f, ms, pend, extra) {
  return `<div class="card mqcard${pend ? ' pend' : ''}" data-f="${f}"><div class="mqhd"><h3>${pend ? '⚠ Pendiente · ' : ''}Carga del ${diaTxt(f)}</h3>${pend ? '' : `<input type="date" id="mqF" value="${f}" max="${today()}">`}
    <span class="sp"></span><button class="btn pri" data-reg="${f}">Registrar</button></div>
    <div class="mqrows">${ms.map((m) => filaCarga(m, f)).join('')}</div>${extra || ''}</div>`;
}
function cargaRapidaHTML() {
  const enObra = maqL().filter((m) => m.activa !== false).sort(maqOrd); if (!enObra.length) return '';
  const f = MQC.f && MQC.f <= today() ? MQC.f : today();
  const act = enObra.filter((m) => !inactEn(m, f) || tieneDato(m, f)), ina = enObra.filter((m) => inactHoy(m));
  const pend = diasPendientes(enObra).filter((p) => p.f !== f);
  const inaHTML = ina.length ? `<div class="mqina">💤 Inactivas (no se les piden horas): ${ina.map((m) => `<span class="mqi"><b class="mono">${esc(m.interno)}</b> <span class="muted">desde ${fechaCorta((m.inact.find((x) => !x.h) || {}).d || today()).slice(0, 5)}</span> <button class="btn sm" data-react="${m.id}">Reactivar</button></span>`).join('')}</div>` : '';
  return `<div class="mqcarga">${tarjetaCarga(f, act, false, inaHTML)}${pend.length ? `<div class="muted" style="margin:6px 2px">Jornadas sin cargar (${pend.length}), de la más vieja a la más nueva:</div>${pend.map((p) => tarjetaCarga(p.f, p.ms, true)).join('')}` : ''}</div>`;
}
function bindCargaRapida(el) {
  const calc = (row) => {
    const m = maqDe(row.dataset.m), f = row.dataset.f, i = $('.mqv', row), o = $('.mqh', row), v = i.value === '' ? null : Number(i.value);
    row.classList.remove('bad'); o.textContent = '';
    if (v == null || !m) return;
    if (m.sinHoro) { o.textContent = v > 24 ? 'más de 24 h' : ''; row.classList.toggle('bad', v > 24); return; }
    const L = lecturas(m.id).filter((y) => y[0] !== f), ant = horoAntes(m.id, f, L), sig = L.find((y) => y[0] > f);
    if (ant == null) return;
    const h = v - ant, prevD = L.filter((y) => y[0] < f).pop(), dias = prevD ? Math.round((new Date(f) - new Date(prevD[0])) / 864e5) : 1;
    if (h < 0) { o.textContent = 'menor que el inicio'; row.classList.add('bad'); return; }
    if (h > 24 * dias) { o.textContent = `${fmt(h, 1)} h: revisar`; row.classList.add('bad'); return; }
    if (sig && v > sig[1]) { o.textContent = `mayor que el ${fechaCorta(sig[0]).slice(0, 5)}`; row.classList.add('bad'); return; }
    o.textContent = `= ${fmt(h, 1)} h${dias > 1 ? ` (${dias} días)` : ''}`;
  };
  $$('.mqr', el).forEach((row) => { const i = $('.mqv', row); i.oninput = () => calc(row); calc(row);
    i.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); const rs = $$('.mqv', row.closest('.mqcard')), k = rs.indexOf(i); if (k < rs.length - 1) rs[k + 1].focus(); else $('[data-reg]', row.closest('.mqcard')).click(); } }; });
  const fd = $('#mqF', el); if (fd) fd.onchange = () => { if (fd.value) { MQC.f = fd.value; render(false); } };
  $$('[data-inact]', el).forEach((b) => { b.onclick = () => setInactivo(b.dataset.inact, true); });
  $$('[data-react]', el).forEach((b) => { b.onclick = () => setInactivo(b.dataset.react, false); });
  $$('[data-reg]', el).forEach((b) => { b.onclick = () => {
    const card = b.closest('.mqcard'), f = b.dataset.reg, rows = $$('.mqr', card);
    if (rows.some((r) => r.classList.contains('bad'))) { toast('Hay valores para revisar (en rojo)', { err: true }); return; }
    let n = 0, borr = 0;
    rows.forEach((r) => { const m = maqDe(r.dataset.m), v = $('.mqv', r).value, x = datoDia(m.id, f), ya = m.sinHoro ? x.h : x.v;
      if (v === '') { if (!vacio(ya)) { guardarLectura(m.id, f, ''); borr++; } return; }
      if (!vacio(ya) && Number(ya) === Number(v)) return;
      guardarLectura(m.id, f, Number(v)); n++; });
    if (!n && !borr) { toast('No hay horas nuevas para registrar'); return; }
    commit(`Horas del ${fechaCorta(f)}: ${n} equipo${n === 1 ? '' : 's'}${borr ? ` · ${borr} borrado${borr === 1 ? '' : 's'}` : ''}`);
  }; });
}

// ======================= REGISTRAR HORAS =======================
// Un dato por equipo y jornada: el horómetro al terminar (o las horas, si el equipo no tiene horómetro).
// El inicio de la jornada es la lectura anterior; las horas del día salen de la diferencia.
// desde: si el dato cierra un período sin registro diario (ej. el mes previo al registro diario), fecha de inicio de ese período
function guardarLectura(id, f, v, desde) {
  const m = maqDe(id), sem = lunesDe(f);
  let r = regDe(id, sem); if (!r) { r = { id: `${id}|${sem}`, maq: id, semana: sem, _o: Date.now() }; maqH().push(r); }
  const k = m.sinHoro ? 'hs' : 'lect'; r[k] = r[k] || {};
  if (v === '') delete r[k][f]; else r[k][f] = v;
  r.per = r.per || {};
  if (v !== '' && desde) r.per[f] = desde; else delete r.per[f];
  if (!Object.keys(r.per).length) delete r.per;
}
const perDe = (maq, f) => (((regDe(maq, lunesDe(f)) || {}).per) || {})[f] || null;
async function registrarHoras(maq, fecha) {
  if (window.READONLY) return;
  const act = maqL().filter((m) => m.activa !== false || m.id === maq).sort(maqOrd);
  if (!act.length) { toast('Primero cargá los equipos', { err: true }); return; }
  let otro = false;
  const pm = modal({
    title: 'Registrar horas de máquina',
    sub: 'Un dato por jornada: el horómetro al terminar el día. El inicio es el fin de la jornada anterior.',
    body: `<div class="form"><label class="full">Equipo<select name="maq"><option value="">— elegí el equipo —</option>${act.map((m) => `<option value="${m.id}" ${m.id === maq ? 'selected' : ''}>${esc(maqNom(m))}${m.marca ? ' · ' + esc(m.marca) : ''}${m.sinHoro ? ' (sin horómetro)' : ''}</option>`).join('')}</select></label>
      <label>Fecha (jornada)<input type="date" name="fecha" value="${fecha || today()}" max="${today()}"></label>
      <label><span id="rhLbl">Horómetro al fin de la jornada</span><input type="number" step="0.1" min="0" name="valor" inputmode="decimal"></label>
      <label style="grid-column:1/-1;display:flex;gap:8px;align-items:center;flex-direction:row;font-weight:500"><input type="checkbox" name="per" style="width:auto;margin:0"> Período sin registro diario (ej. el mes antes de empezar a registrar por día): el dato cierra todo el período</label>
      <label id="rhDesdeL" style="display:none">Período desde<input type="date" name="desde"></label>
      <div id="rhCalc" style="grid-column:1/-1"></div></div>`,
    buttons: [['Borrar registro', 'btn danger', (box) => (vacio(cur(box)) ? (toast('Ese día no tiene registro', { err: true }), false) : 'del')], ['Cancelar', 'btn', () => null],
      ['Guardar y cargar otro', 'btn', (box) => (validar(box) ? ((otro = true), 'ok') : false)], ['Guardar', 'btn pri', (box) => (validar(box) ? 'ok' : false)]],
  });
  const box = $('#modal .mbox'), sM = $('[name=maq]', box), sF = $('[name=fecha]', box), sV = $('[name=valor]', box), calc = $('#rhCalc', box), lbl = $('#rhLbl', box);
  const cP = $('[name=per]', box), sD = $('[name=desde]', box), lD = $('#rhDesdeL', box);
  const esPer = () => cP.checked && !!sD.value;
  // valor ya registrado para ese equipo y día
  function cur() { const m = maqDe(sM.value); if (!m || !sF.value) return ''; const r = regDe(m.id, lunesDe(sF.value)) || {}; return ((m.sinHoro ? r.hs : r.lect) || {})[sF.value]; }
  function upd(cargar) {
    const m = maqDe(sM.value), f = sF.value;
    if (!m || !f) { calc.innerHTML = ''; return; }
    lbl.textContent = m.sinHoro ? 'Horas trabajadas en la jornada' : 'Horómetro al fin de la jornada';
    sV.step = m.sinHoro ? '0.5' : '0.1';
    if (cargar) {
      const c = cur(); sV.value = vacio(c) ? '' : String(Number(c));
      const pd = perDe(m.id, f); cP.checked = !!pd; sD.value = pd || m.fechaIngreso || '';
    }
    lD.style.display = cP.checked ? '' : 'none';
    if (cP.checked) lbl.textContent = m.sinHoro ? 'Horas trabajadas en todo el período' : 'Horómetro al cierre del período';
    const v = sV.value === '' ? null : Number(sV.value), ya = !vacio(cur());
    if (m.sinHoro) { calc.innerHTML = `<div class="alert info" style="margin:0;display:block">${m.interno} no tiene horómetro: se cargan las horas trabajadas ${esPer() ? `en el período del ${fechaCorta(sD.value)} al ${fechaCorta(f)}` : `del ${fechaCorta(f)}`}.${ya ? ' Ya hay un registro ese día: se reemplaza.' : ''}</div>`; return; }
    const L = lecturas(m.id).filter((x) => x[0] !== f), ant = horoAntes(m.id, f, L), prevD = L.filter((x) => x[0] < f).pop(), sig = L.find((x) => x[0] > f);
    const ini = ant == null ? '<b style="color:var(--warn)">sin dato</b> (cargá el horómetro al ingreso en la ficha del equipo)' : `<b>${fmt(ant, 1)}</b> ${prevD ? `(fin de la jornada del ${fechaCorta(prevD[0])})` : '(horómetro al ingreso a obra)'}`;
    let res = '';
    if (v != null && ant != null) res = v < ant ? `<div style="color:var(--bad);margin-top:4px"><b>Es menor que el inicio${esPer() ? ' del período' : ' de la jornada'}</b>: revisá el valor.</div>`
      : esPer() ? `<div style="margin-top:4px">Horas del período ${fechaCorta(sD.value)} al ${fechaCorta(f)}: <b style="font-size:16px">${fmt(v - ant, 1)} h</b> <span class="muted">(un solo registro, sin detalle por día)</span></div>`
      : `<div style="margin-top:4px">Horas trabajadas: <b style="font-size:16px">${fmt(v - ant, 1)} h</b>${prevD && sumDias(prevD[0], 1) !== f ? ` <span class="muted">(desde el ${fechaCorta(prevD[0])}: incluye los días sin registro)</span>` : ''}</div>`;
    if (v != null && sig && v > sig[1]) res += `<div style="color:var(--warn);margin-top:4px">Ojo: es mayor que la lectura del ${fechaCorta(sig[0])} (${fmt(sig[1], 1)}).</div>`;
    calc.innerHTML = `<div class="alert ${v != null && ant != null && v < ant ? 'error' : 'info'}" style="margin:0;display:block">Inicio ${esPer() ? 'del período' : 'de la jornada'}: ${ini}${res}${ya ? '<div class="muted" style="margin-top:4px">Ya hay un registro ese día: se reemplaza.</div>' : ''}</div>`;
  }
  function validar() {
    const m = maqDe(sM.value), f = sF.value, v = sV.value === '' ? null : Number(sV.value);
    if (!m || !f || v == null || !(v >= 0)) { toast('Completá equipo, fecha y valor', { err: true }); return false; }
    if (f > today()) { toast('La fecha no puede ser futura', { err: true }); return false; }
    if (cP.checked && (!sD.value || sD.value > f)) { toast('Indicá desde qué fecha va el período (anterior o igual a la fecha de cierre)', { err: true }); return false; }
    const diasPer = esPer() ? Math.round((new Date(f) - new Date(sD.value)) / 864e5) + 1 : 1;
    if (m.sinHoro) { if (v > 24 * diasPer) { toast(`Más de 24 h por día: revisá el valor`, { err: true }); return false; } return true; }
    const L = lecturas(m.id).filter((x) => x[0] !== f), ant = horoAntes(m.id, f, L);
    if (ant != null && v < ant) { toast(`El horómetro (${fmt(v, 1)}) es menor que el inicio de la jornada (${fmt(ant, 1)})`, { err: true }); return false; }
    const prevD = L.filter((x) => x[0] < f).pop(), dias = esPer() ? diasPer : prevD ? Math.round((new Date(f) - new Date(prevD[0])) / 864e5) : 1;
    if (ant != null && v - ant > 24 * dias) { toast(`${fmt(v - ant, 1)} h en ${dias} día${dias > 1 ? 's' : ''}: revisá el valor`, { err: true }); return false; }
    return true;
  }
  sM.onchange = () => upd(true); sF.onchange = () => upd(true); sV.oninput = () => upd(false); cP.onchange = () => upd(false); sD.onchange = () => upd(false); upd(true);
  setTimeout(() => (sM.value ? sV : sM).focus(), 60);
  const res = await pm;
  if (!res) return;
  const m = maqDe(sM.value), f = sF.value;
  if (res === 'del') { guardarLectura(m.id, f, ''); commit(`${m.interno}: registro del ${fechaCorta(f)} borrado`); }
  else {
    const v = Number(sV.value), L = lecturas(m.id).filter((x) => x[0] !== f), ant = m.sinHoro ? null : horoAntes(m.id, f, L);
    const per = esPer() ? sD.value : null;
    guardarLectura(m.id, f, v, per);
    const cuando = per ? `período ${fechaCorta(per)} al ${fechaCorta(f)}` : fechaCorta(f);
    commit(m.sinHoro ? `${m.interno} · ${cuando}: ${fmt(v, 1)} h` : `${m.interno} · ${cuando}: horómetro ${fmt(v, 1)}${ant != null ? ` → ${fmt(v - ant, 1)} h` : ''}`);
    ui.maqMes = f.slice(0, 7);
    if (otro) setTimeout(() => registrarHoras(null, f), 250);
  }
}
// ======================= EQUIPOS =======================
function vMaqEq(el) {
  const ro = window.READONLY;
  actions([...(ro ? [] : [['+ Equipo', 'btn pri', () => editMaquina(null)]]), ['Exportar Excel', 'btn', exportMaq]]);
  const q = (ui.maqQ || '').toLowerCase(), est = ui.maqEst || 'act';
  const ms = maqL().filter((m) => (est === 'all' || (est === 'act' ? m.activa !== false : m.activa === false))
    && (!q || `${m.interno} ${m.descripcion} ${m.marca} ${m.modelo} ${m.serie || ''}`.toLowerCase().includes(q))).sort(maqOrd);
  let h = `<div class="tools"><div class="seg" id="fME"><button data-v="act">En obra</button><button data-v="baja">De baja</button><button data-v="all">Todos</button></div>
    <span class="muted">${ms.length} equipo${ms.length === 1 ? '' : 's'}</span><span class="sp"></span><input type="search" id="fMQ" placeholder="Buscar interno, equipo, marca…" value="${esc(ui.maqQ || '')}" style="width:240px"></div>
    <div class="tblwrap"><table class="tbl"><thead><tr><th>Interno</th><th>Descripción</th><th>Marca</th><th>Modelo</th><th>N° serie / dominio</th><th>Propiedad</th><th>Ingreso a obra</th>
    <th class="n">Horas trabajadas</th><th class="n">Paradas (h)</th><th class="n">Mant. (h)</th><th class="n">Disponib.</th><th>Último horómetro</th><th>Último mantenimiento</th><th>Mant. programado</th><th>Estado</th><th></th></tr></thead><tbody>`;
  ms.forEach((m) => {
    const t = horasTot(m.id);
    const ev = maqE().filter((e) => e.maq === m.id), p = ev.filter((e) => e.tipo === 'parada').reduce((a, e) => a + (Number(e.horas) || 0), 0), mm = ev.filter((e) => e.tipo === 'mantenimiento').reduce((a, e) => a + (Number(e.horas) || 0), 0);
    const ult = ultLect(m.id), d = dispo(t, p + mm - solTot(m.id));
    h += `<tr data-id="${m.id}"><td class="mono"><b>${esc(m.interno)}</b></td><td>${esc(m.descripcion)}${m.obs ? ` <span title="${esc(m.obs)}">ⓘ</span>` : ''}</td><td>${esc(m.marca || '')}</td><td>${esc(m.modelo || '')}</td><td>${esc(m.serie || '')}</td><td>${esc(m.propiedad || '')}</td><td>${m.fechaIngreso ? fechaCorta(m.fechaIngreso) : '–'}${vacio(m.horoIngreso) ? '' : `<div class="muted" style="font-size:11.5px">horómetro ${fmt(Number(m.horoIngreso), 1)}</div>`}</td>
      <td class="n">${fmt(t, 1)}</td><td class="n">${p ? fmt(p, 1) : '–'}</td><td class="n">${mm ? fmt(mm, 1) : '–'}</td><td class="n">${d == null ? '–' : fmt(d * 100) + ' %'}</td>
      <td>${m.sinHoro ? '<span class="muted">sin horómetro</span>' : ult ? `${fmt(ult[1], 1)} h <span class="muted">(${fechaCorta(ult[0])})</span>` : '–'}</td><td>${(() => { const u = maqE().filter((e) => e.maq === m.id && e.tipo === 'mantenimiento').sort((a, b) => a.fecha.localeCompare(b.fecha)).pop(); return u ? `${fechaCorta(u.fecha)}${vacio(u.horo) ? '' : ` · <b>${fmt(Number(u.horo), 1)} h</b>`}<div class="muted" style="font-size:11.5px">${esc(u.motivo)}</div>` : '–'; })()}</td><td>${servHTML(m, false)}</td><td>${m.activa === false ? '<span class="pill p-prov">de baja</span>' : '<span class="pill p-done">en obra</span>'}</td>
      <td>${ro ? '' : '<button class="btn sm ghost" data-a="ed">✎</button>'}</td></tr>`;
  });
  h += `</tbody></table>${ms.length ? '' : '<div class="empty"><b>Sin equipos</b></div>'}</div>`;
  el.innerHTML = h;
  segBind('#fME', est, (v) => { ui.maqEst = v; render(false); });
  searchBind('#fMQ', (v) => { ui.maqQ = v; });
  if (!ro) $$('[data-a=ed]', el).forEach((b) => { b.onclick = () => editMaquina(b.closest('tr').dataset.id); });
}
async function editMaquina(id) {
  if (window.READONLY) return;
  const nuevo = !id, m = nuevo ? { id: uid('m'), interno: '', descripcion: '', marca: '', modelo: '', serie: '', propiedad: 'Propio', activa: true, obs: '' } : maqDe(id);
  const res = await modal({
    title: nuevo ? 'Nuevo equipo' : `Editar equipo ${m.interno}`,
    body: `<div class="form"><label>N° de interno<input type="text" name="interno" value="${esc(m.interno)}" placeholder="ej. EX-01"></label>
      <label>Descripción<input type="text" name="descripcion" list="maqDesc" value="${esc(m.descripcion)}" placeholder="ej. Retroexcavadora"><datalist id="maqDesc">${['Retroexcavadora', 'Excavadora', 'Minicargadora', 'Hincadora', 'Manipulador telescópico', 'Grúa', 'Camión', 'Camioneta', 'Tractor', 'Motoniveladora', 'Rodillo compactador', 'Zanjadora', 'Grupo electrógeno', 'Hidroelevador', 'Autoelevador'].map((x) => `<option value="${x}">`).join('')}</datalist></label>
      <label>Marca<input type="text" name="marca" value="${esc(m.marca || '')}"></label><label>Modelo<input type="text" name="modelo" value="${esc(m.modelo || '')}"></label>
      <label>N° de serie / dominio<input type="text" name="serie" value="${esc(m.serie || '')}"></label>
      <label>Propiedad<select name="propiedad">${['Propio', 'Alquilado', 'Subcontratista'].map((x) => `<option ${m.propiedad === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
 <label>Fecha de ingreso a obra<input type="date" name="fechaIngreso" value="${esc(m.fechaIngreso || '')}"></label>
      <label>Horómetro al ingreso a obra (h)<input type="number" step="0.1" min="0" name="horoIngreso" value="${numIn(m.horoIngreso)}" placeholder="inicio de la primera jornada"></label>
      <label>Mantenimiento programado cada (h)<input type="number" step="1" min="0" name="mantCada" value="${numIn(m.mantCada)}" placeholder="ej. 200"></label>
      <label>Horómetro del último service<input type="number" step="0.1" min="0" name="horoUltMant" value="${numIn(m.horoUltMant)}" placeholder="si no, se cuenta desde el ingreso"></label>
      <label class="chk"><input type="checkbox" name="sinHoro" ${m.sinHoro ? 'checked' : ''}> Sin horómetro: cargar horas trabajadas por día</label>
      <label class="chk"><input type="checkbox" name="activa" ${m.activa !== false ? 'checked' : ''}> En obra (sacalo cuando el equipo se retira)</label>
      <label class="full">Observaciones<input type="text" name="obs" value="${esc(m.obs || '')}"></label></div>`,
    buttons: [...(nuevo ? [] : [['Eliminar', 'btn danger', () => 'del']]), ['Cancelar', 'btn', () => null], ['Guardar', 'btn pri', (box) => {
      const g = (n) => $(`[name=${n}]`, box).value.trim();
      if (!g('interno') || !g('descripcion')) { toast('Completá el N° de interno y la descripción', { err: true }); return false; }
      if (maqL().some((x) => x !== m && String(x.interno).toLowerCase() === g('interno').toLowerCase())) { toast(`Ya existe un equipo con el interno ${g('interno')}`, { err: true }); return false; }
      Object.assign(m, { interno: g('interno'), descripcion: g('descripcion'), marca: g('marca'), modelo: g('modelo'), serie: g('serie'), propiedad: g('propiedad'), activa: $('[name=activa]', box).checked, obs: g('obs'),
        mantCada: g('mantCada') === '' ? '' : Number(g('mantCada')), horoUltMant: g('horoUltMant') === '' ? '' : Number(g('horoUltMant')),
        fechaIngreso: g('fechaIngreso'), horoIngreso: g('horoIngreso') === '' ? '' : Number(g('horoIngreso')), sinHoro: $('[name=sinHoro]', box).checked });
      return 'ok';
    }]],
  });
  if (res === 'del') {
    const usado = maqH().some((r) => r.maq === m.id) || maqE().some((e) => e.maq === m.id);
    if (usado) { toast('El equipo tiene horas o paradas registradas: marcalo como "de baja" en lugar de eliminarlo', { err: true }); return; }
    if (await confirmar('Eliminar equipo', `¿Eliminar el equipo ${esc(m.interno)}?`, 'Eliminar', 'btn danger')) { S.maquinas = maqL().filter((x) => x !== m); commit('Equipo eliminado'); }
  } else if (res === 'ok') { if (nuevo) { m._o = Date.now(); maqL().push(m); } commit(`Equipo ${m.interno} guardado`); }
}

// ======================= PARADAS Y MANTENIMIENTOS =======================
function vMaqEv(el) {
  const ro = window.READONLY; setTimeout(maqMigrJor, 0);
  actions([...(ro ? [] : [['▶ Iniciar parada / mantenimiento', 'btn pri', () => iniciarEvento(null)], ['+ Cargar a mano', 'btn', () => editEvento(null)]]), ['Exportar Excel', 'btn', exportMaq]]);
  const fm = ui.evMaq || 'all', ft = ui.evTipo || 'all', fmes = ui.evMes || 'all';
  const meses = [...new Set(maqE().map((e) => e.fecha.slice(0, 7)))].sort().reverse();
  const list = maqE().filter((e) => (fm === 'all' || e.maq === fm) && (ft === 'all' || e.tipo === ft) && (fmes === 'all' || e.fecha.startsWith(fmes)))
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || maqOrd(maqDe(a.maq) || {}, maqDe(b.maq) || {}));
  const hs = (t) => list.filter((e) => e.tipo === t).reduce((a, e) => a + (Number(e.horas) || 0), 0);
  // motivos más frecuentes (por horas)
  const mot = {}; list.filter((e) => !e.enCurso).forEach((e) => { const k = `${MAQ_TIPO[e.tipo][0]} · ${e.motivo}`; mot[k] = (mot[k] || 0) + (Number(e.horas) || 0); });
  const top = Object.entries(mot).sort((a, b) => b[1] - a[1]).slice(0, 5);
  let h = `${evCursoHTML()}<div class="tools"><select id="fEM"><option value="all">Todos los equipos</option>${maqL().slice().sort(maqOrd).map((m) => `<option value="${m.id}">${esc(maqNom(m))}</option>`).join('')}</select>
    <div class="seg" id="fET"><button data-v="all">Todo</button><button data-v="parada">Paradas</button><button data-v="mantenimiento">Mantenimientos</button></div>
    <select id="fEMes"><option value="all">Todos los meses</option>${meses.map((x) => `<option value="${x}">${MESES[Number(x.slice(5, 7)) - 1]} ${x.slice(0, 4)}</option>`).join('')}</select><span class="sp"></span>
    <button class="btn sm ghost solo-pc" id="evJor" title="Las horas con contador cuentan solo dentro de la jornada de obra" ${ro ? 'disabled' : ''}>🕕 Jornada ${jorTxt()}</button><span class="muted">${list.length} registro${list.length === 1 ? '' : 's'}</span></div>
    <div class="grid g3" style="margin-bottom:14px;align-items:start"><div class="card"><div class="kpis k1">${kpi('Horas de parada (en jornada)', hs('parada'), 'h', 1)}</div></div><div class="card"><div class="kpis k1">${kpi('Horas de mantenimiento (en jornada)', hs('mantenimiento'), 'h', 1)}</div></div>
    <div class="card"><h3>Principales motivos (horas)</h3>${top.length ? top.map(([k, v]) => `<div class="zrow"><span>${esc(k)}</span><b>${fmt(v, 1)} h</b></div>`).join('') : '<span class="muted">Sin registros</span>'}</div></div>
    <div class="tblwrap"><table class="tbl"><thead><tr><th>Fecha</th><th>Interno</th><th>Equipo</th><th>Tipo</th><th class="n">Horas</th><th class="n">Horómetro</th><th>Motivo</th><th>Observaciones</th><th></th></tr></thead><tbody>`;
  list.forEach((e) => {
    const m = maqDe(e.maq) || {};
    h += `<tr data-id="${e.id}" class="${e.enCurso ? 'evrun' : ''}"><td>${fechaCorta(e.fecha)}${e.inicio ? `<small class="muted" style="display:block">${hhmm(e.inicio)} → ${e.enCurso ? 'en curso' : (e.fin.slice(0, 10) !== e.inicio.slice(0, 10) ? fechaCorta(e.fin.slice(0, 10)).slice(0, 5) + ' ' : '') + hhmm(e.fin)}</small>` : ''}</td><td class="mono"><b>${esc(m.interno || '?')}</b></td><td>${esc(m.descripcion || '')}</td><td><span class="pill ${MAQ_TIPO[e.tipo][1]}">${MAQ_TIPO[e.tipo][0]}</span></td>
      <td class="n">${e.enCurso ? tmrHTML(e) : fmt(e.horas, e.inicio ? 2 : 1)}${!e.enCurso && e.horasRel != null && e.horasRel - e.horas > 0.009 ? `<small class="muted" style="display:block" title="Tiempo total de reloj; solo cuentan las horas dentro de la jornada de obra (${jorTxt(e.jor)})">reloj ${fmt(e.horasRel, 1)}</small>` : ''}</td><td class="n">${vacio(e.horo) ? '<span class="muted">–</span>' : `<b>${fmt(Number(e.horo), 1)}</b>`}</td><td>${esc(e.motivo || '')}${e.reinicia ? ' <span class="pill p-ready" title="Reinicia el contador del mantenimiento programado">service</span>' : ''}</td><td>${esc(e.obs || '')}</td><td>${ro ? '' : '<button class="btn sm ghost" data-a="ed">✎</button>'}</td></tr>`;
  });
  h += `</tbody></table>${list.length ? '' : '<div class="empty"><b>Sin paradas ni mantenimientos registrados</b></div>'}</div>`;
  el.innerHTML = h;
  $('#fEM').value = fm; $('#fEMes').value = fmes;
  $('#fEM').onchange = (ev) => { ui.evMaq = ev.target.value; render(false); };
  $('#fEMes').onchange = (ev) => { ui.evMes = ev.target.value; render(false); };
  segBind('#fET', ft, (v) => { ui.evTipo = v; render(false); });
  bindEvCurso(el); const bj = $('#evJor', el); if (bj && !ro) bj.onclick = editJornada;
  if (!ro) $$('[data-a=ed]', el).forEach((b) => { b.onclick = () => { const id = b.closest('tr').dataset.id, e = maqE().find((x) => x.id === id); if (e && e.enCurso) finalizarEvento(id); else editEvento(id); }; });
}
async function editEvento(id, maq, sem) {
  if (window.READONLY) return;
  if (!maqL().length) { toast('Primero cargá los equipos', { err: true }); return; }
  const nuevo = !id;
  if (id && (maqE().find((x) => x.id === id) || {}).enCurso) return finalizarEvento(id);
  const e = nuevo ? { id: uid('e'), maq: maq || '', tipo: 'parada', fecha: sem && !enSemana(today(), sem) ? sem : today(), horas: '', motivo: '', obs: '' } : maqE().find((x) => x.id === id);
  const pm = modal({
    title: nuevo ? 'Registrar parada o mantenimiento' : 'Editar registro',
    body: `<div class="form"><label class="full">Equipo<select name="maq"><option value="">— elegí el equipo —</option>${maqL().filter((m) => m.activa !== false || m.id === e.maq).sort(maqOrd).map((m) => `<option value="${m.id}" ${m.id === e.maq ? 'selected' : ''}>${esc(maqNom(m))}${m.marca ? ' · ' + esc(m.marca) : ''}</option>`).join('')}</select></label>
      <label>Tipo<select name="tipo"><option value="parada" ${e.tipo === 'parada' ? 'selected' : ''}>Parada</option><option value="mantenimiento" ${e.tipo === 'mantenimiento' ? 'selected' : ''}>Mantenimiento</option></select></label>
      <label>Fecha<input type="date" name="fecha" value="${esc(e.fecha)}"></label>
      <label>Horas<input type="number" step="0.5" min="0" name="horas" value="${e.horas}"></label>
      <label>Motivo<input type="text" name="motivo" list="evMot" value="${esc(e.motivo || '')}"><datalist id="evMot"></datalist></label>
      <label id="evHoroL"><span id="evHoroT">Horómetro al realizarlo</span><input type="number" step="0.1" min="0" name="horo" value="${numIn(e.horo)}"></label>
      <div id="evHoroRef" class="muted" style="align-self:end;font-size:12px;padding-bottom:9px"></div>
      <div id="evSvc" style="grid-column:1/-1;display:none"><label style="display:flex;gap:8px;align-items:center;flex-direction:row;font-weight:500"><input type="checkbox" name="reinicia" style="width:auto;margin:0" ${e.reinicia ? 'checked' : ''}> Es el <b>service programado</b>: reinicia el contador de horas para el próximo</label></div>
      <label class="full">Observaciones<input type="text" name="obs" value="${esc(e.obs || '')}" placeholder="detalle, repuestos, quién lo hizo…"></label></div>`,
    buttons: [...(nuevo ? [] : [['Eliminar', 'btn danger', () => 'del']]), ['Cancelar', 'btn', () => null], ['Guardar', 'btn pri', (box) => {
      const g = (n) => $(`[name=${n}]`, box).value.trim();
      if (!g('maq') || !g('fecha') || !(Number(g('horas')) > 0) || !g('motivo')) { toast('Completá equipo, fecha, horas y motivo', { err: true }); return false; }
      const mq = maqDe(g('maq'));
      if (g('tipo') === 'mantenimiento' && !mq.sinHoro && g('horo') === '') { toast('Cargá el horómetro al que se hizo el mantenimiento', { err: true }); return false; }
      if (g('horo') !== '' && !mq.sinHoro) {
        const L = lecturas(mq.id), ant = horoAntes(mq.id, g('fecha'), L), fin = (L.find((x) => x[0] === g('fecha')) || [])[1], h = Number(g('horo'));
        if (ant != null && h < ant - 0.05) { toast(`El horómetro (${fmt(h, 1)}) es menor que el del inicio de esa jornada (${fmt(ant, 1)})`, { err: true }); return false; }
        if (fin != null && h > fin + 0.05) { toast(`El horómetro (${fmt(h, 1)}) es mayor que el del fin de esa jornada (${fmt(fin, 1)})`, { err: true }); return false; }
      }
      Object.assign(e, { maq: g('maq'), tipo: g('tipo'), fecha: g('fecha'), horas: Number(g('horas')), motivo: g('motivo'), obs: g('obs') });
      if (g('horo') !== '' && !mq.sinHoro) e.horo = Number(g('horo')); else delete e.horo;
      if (g('tipo') === 'mantenimiento' && $('[name=reinicia]', box).checked) e.reinicia = true; else delete e.reinicia;
      return 'ok';
    }]],
  });
  { const box = $('#modal .mbox'), t = $('[name=tipo]', box), dl = $('#evMot', box);
    const sv = $('#evSvc', box), sm = $('[name=maq]', box), sf = $('[name=fecha]', box), hl = $('#evHoroL', box), ht = $('#evHoroT', box), hr = $('#evHoroRef', box), hi = $('[name=horo]', box);
    const upd = () => {
      dl.innerHTML = MAQ_MOT[t.value].map((x) => `<option value="${x}">`).join('');
      const m = maqDe(sm.value), conH = m && !m.sinHoro;
      sv.style.display = t.value === 'mantenimiento' && m && Number(m.mantCada) > 0 ? '' : 'none';
      hl.style.display = conH ? '' : 'none'; hr.style.display = conH ? '' : 'none';
      ht.textContent = t.value === 'mantenimiento' ? 'Horómetro al hacer el mantenimiento' : 'Horómetro al producirse la parada (opcional)';
      if (!conH || !sf.value) { hr.innerHTML = ''; return; }
      const L = lecturas(m.id), ant = horoAntes(m.id, sf.value, L), fin = (L.find((x) => x[0] === sf.value) || [])[1];
      hr.innerHTML = ant == null && fin == null ? 'sin lecturas cerca de esa fecha' : `Ese día: ${ant != null ? `inicio <a href="#" data-h="${ant}">${fmt(ant, 1)}</a>` : ''}${ant != null && fin != null ? ' · ' : ''}${fin != null ? `fin <a href="#" data-h="${fin}">${fmt(fin, 1)}</a>` : ''}`;
      $$('a[data-h]', hr).forEach((a) => { a.onclick = (ev) => { ev.preventDefault(); hi.value = a.dataset.h; }; });
    };
    sm.addEventListener('change', upd); sf.addEventListener('change', upd);
    t.onchange = upd; upd(); }
  const res = await pm;
  if (res === 'del') { if (await confirmar('Eliminar registro', '¿Eliminar este registro de parada / mantenimiento?', 'Eliminar', 'btn danger')) { S.maqEventos = maqE().filter((x) => x !== e); commit('Registro eliminado'); } }
  else if (res === 'ok') { if (nuevo) { e._o = Date.now(); maqE().push(e); } const m = maqDe(e.maq); commit(`${MAQ_TIPO[e.tipo][0]} de ${m.interno}: ${fmt(e.horas, 1)} h`); }
}

// ======================= EXPORTAR =======================
async function exportMaq() {
  const wb = XLSX.utils.book_new(), r1 = (x) => Math.round(x * 10) / 10;
  const sh = (aoa, w, n) => { const ws = XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = w.map((x) => ({ wch: x })); XLSX.utils.book_append_sheet(wb, ws, n); };
  const ms = maqL().slice().sort(maqOrd);
  const a1 = [['Interno', 'Descripción', 'Marca', 'Modelo', 'N° serie / dominio', 'Propiedad', 'Ingreso a obra', 'Horómetro al ingreso', 'Estado', 'Horas trabajadas', 'Horas de parada', 'Horas de mantenimiento', 'Disponibilidad %', 'Último horómetro', 'Service cada (h)', 'Horas desde el último service', 'Faltan para el service (h)', 'Próximo service (horómetro)', 'Observaciones']];
  ms.forEach((m) => {
    const t = horasTot(m.id), ev = maqE().filter((e) => e.maq === m.id);
    const p = ev.filter((e) => e.tipo === 'parada').reduce((a, e) => a + (Number(e.horas) || 0), 0), mm = ev.filter((e) => e.tipo === 'mantenimiento').reduce((a, e) => a + (Number(e.horas) || 0), 0);
    const ult = ultLect(m.id), d = dispo(t, p + mm - solTot(m.id));
    a1.push([m.interno, m.descripcion, m.marca || '', m.modelo || '', m.serie || '', m.propiedad || '', m.fechaIngreso || '', vacio(m.horoIngreso) ? '' : Number(m.horoIngreso), m.activa === false ? 'De baja' : 'En obra', r1(t), r1(p), r1(mm), d == null ? '' : r1(d * 100), m.sinHoro ? 'sin horómetro' : ult ? ult[1] : '', ...(() => { const x = servicio(m); return x && !x.sinBase ? [x.N, r1(x.usado), r1(x.faltan), x.prox != null && !m.sinHoro ? r1(x.prox) : ''] : [x ? x.N : '', '', '', '']; })(), m.obs || '']);
  });
  sh(a1, [10, 26, 14, 16, 18, 13, 13, 15, 10, 15, 15, 20, 15, 15, 14, 18, 18, 20, 30], 'Equipos');
  // horas por mes y día
  const meses = [...new Set(maqH().flatMap((r) => [...Object.keys(r.lect || {}), ...Object.keys(r.hs || {})].map((f) => f.slice(0, 7))))].sort().reverse();
  const a2 = [['Mes', 'Interno', 'Equipo', ...Array.from({ length: 31 }, (_, i) => String(i + 1)), 'Horas mes', 'Horas de parada', 'Horas de mantenimiento', 'Disponibilidad %']];
  meses.forEach((ym) => ms.forEach((m) => {
    if (!tieneMes(m.id, ym) && !evMes(m.id, ym)) return;
    const L = lecturas(m.id), ds = diasMes(ym), t = horasMes(m.id, ym, L), p = evMes(m.id, ym, 'parada'), mm = evMes(m.id, ym, 'mantenimiento'), d = dispo(t, p + mm - solMes(m.id, ym));
    a2.push([mesTxt(ym), m.interno, m.descripcion, ...Array.from({ length: 31 }, (_, i) => (ds[i] ? (horasDia(m.id, ds[i], L) ? r1(horasDia(m.id, ds[i], L)) : '') : '')), r1(t), r1(p), r1(mm), d == null ? '' : r1(d * 100)]);
  }));
  sh(a2, [15, 10, 24, ...Array(31).fill(5), 11, 14, 20, 15], 'Horas mensuales');
  // lecturas diarias de horómetro: inicio (= fin de la jornada anterior), fin y horas
  const a4 = [['Fecha', 'Interno', 'Equipo', 'Horómetro inicio', 'Horómetro fin', 'Horas trabajadas', 'Período sin registro diario desde']];
  ms.forEach((m) => {
    if (m.sinHoro) { maqH().filter((r) => r.maq === m.id).forEach((r) => Object.entries(r.hs || {}).forEach(([f, v]) => a4.push([f, m.interno, m.descripcion, '', '', r1(Number(v) || 0), (r.per || {})[f] || '']))); return; }
    const L = lecturas(m.id); L.forEach(([f, v]) => { const a = horoAntes(m.id, f, L); a4.push([f, m.interno, m.descripcion, a == null ? '' : a, v, a == null ? '' : r1(Math.max(0, v - a)), perDe(m.id, f) || '']); });
  });
  a4.sort((x, y) => (x[0] === 'Fecha' ? -1 : y[0] === 'Fecha' ? 1 : y[0].localeCompare(x[0]) || String(x[1]).localeCompare(String(y[1]), 'es', { numeric: true })));
  sh(a4, [12, 10, 26, 17, 15, 17, 28], 'Horómetro por jornada');
  const a3 = [['Fecha', 'Mes', 'Interno', 'Equipo', 'Tipo', 'Inicio', 'Fin', 'Horas (en jornada)', 'Horas de reloj', 'Jornada', 'Horómetro', 'Motivo', 'Service programado', 'Observaciones']];
  maqE().slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).forEach((e) => { const m = maqDe(e.maq) || {}; a3.push([e.fecha, mesTxt(e.fecha.slice(0, 7)), m.interno || '', m.descripcion || '', MAQ_TIPO[e.tipo][0], e.inicio ? e.inicio.replace('T', ' ') : '', e.enCurso ? 'en curso' : e.fin ? e.fin.replace('T', ' ') : '', e.inicio && !e.enCurso ? Math.round((Number(e.horas) || 0) * 100) / 100 : r1(Number(e.horas) || 0), e.horasRel != null ? e.horasRel : '', e.jor ? jorTxt(e.jor) : '', vacio(e.horo) ? '' : Number(e.horo), e.motivo || '', e.reinicia ? 'Sí' : '', e.obs || '']); });
  sh(a3, [12, 14, 10, 26, 15, 17, 17, 10, 10, 14, 11, 28, 17, 40], 'Paradas y mantenimientos');
  const p = await window.api.saveBinary(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }), `Maquinaria de obra ${today()}.xlsx`, 'xlsx', 'Excel');
  if (p) toast('Excel exportado', { action: ['Abrir', () => window.api.openPath(p)] });
}
function printMaqMes(ym) {
  const ms = maqL().filter((m) => m.activa !== false || tieneMes(m.id, ym)).sort(maqOrd);
  if (!ms.length) { toast('No hay equipos cargados', { err: true }); return; }
  const ds = diasMes(ym); let tt = 0, tp = 0, tm = 0;
  let h = prHead(`Maquinaria de obra · ${mesTxt(ym)}`) + `<div class="card"><table class="tbl maqpr"><thead><tr><th>Interno</th><th>Equipo</th>${ds.map((d) => { const w = dowDe(d); return `<th class="n ${w === 0 || w === 6 ? 'fds' : ''}">${DSEM[w]}<br>${Number(d.slice(8))}</th>`; }).join('')}<th class="n">Mes</th><th class="n">Parada</th><th class="n">Mant.</th><th class="n">Disp.</th></tr></thead><tbody>`;
  ms.forEach((m) => {
    const L = lecturas(m.id), t = horasMes(m.id, ym, L), p = evMes(m.id, ym, 'parada'), mm = evMes(m.id, ym, 'mantenimiento'), d = dispo(t, p + mm - solMes(m.id, ym)); tt += t; tp += p; tm += mm;
    h += `<tr><td><b>${esc(m.interno)}</b></td><td>${esc(m.descripcion)}</td>${ds.map((f) => { const hd = horasDia(m.id, f, L), w = dowDe(f), x = datoDia(m.id, f); return `<td class="n ${w === 0 || w === 6 ? 'fds' : ''}">${hd ? fmt(hd, 1) : vacio(x.v) && vacio(x.h) ? '' : '0'}${x.per ? '*' : ''}</td>`; }).join('')}
      <td class="n"><b>${fmt(t, 1)}</b></td><td class="n">${p ? fmt(p, 1) : ''}</td><td class="n">${mm ? fmt(mm, 1) : ''}</td><td class="n">${d == null ? '' : fmt(d * 100) + '%'}</td></tr>`;
  });
  h += `<tr><td colspan="${ds.length + 2}"><b>Total</b></td><td class="n"><b>${fmt(tt, 1)}</b></td><td class="n"><b>${fmt(tp, 1)}</b></td><td class="n"><b>${fmt(tm, 1)}</b></td><td class="n">${dispo(tt, tp + tm - solMes(null, ym)) == null ? '' : fmt(dispo(tt, tp + tm - solMes(null, ym)) * 100) + '%'}</td></tr></tbody></table>
    <p class="muted" style="font-size:7.5pt;margin:6px 0 0">Horas trabajadas por jornada (horómetro al fin del día menos el del día anterior). * = período sin registro diario. Disponibilidad = trabajadas / (trabajadas + paradas + mantenimiento).</p></div>`;
  // lecturas del mes por equipo
  h += `<div class="card"><h3>Horómetro al fin de cada jornada</h3><table class="tbl stk"><thead><tr><th>Interno</th><th>Equipo</th><th class="n">Inicio del mes</th><th class="n">Última lectura</th><th>Fecha</th><th class="n">Horas del mes</th><th>Próximo service</th></tr></thead><tbody>${ms.map((m) => {
    const L = lecturas(m.id), ini = m.sinHoro ? null : horoAntes(m.id, ds[0], L), ul = L.filter((x) => x[0] <= ds[ds.length - 1]).pop(), sv = servicio(m);
    return `<tr><td><b>${esc(m.interno)}</b></td><td>${esc(m.descripcion)}</td><td class="n">${ini != null ? fmt(ini, 1) : m.sinHoro ? 'sin horómetro' : '–'}</td><td class="n">${ul && !m.sinHoro ? fmt(ul[1], 1) : '–'}</td><td>${ul && !m.sinHoro ? fechaCorta(ul[0]) : ''}</td><td class="n"><b>${fmt(horasMes(m.id, ym, L), 1)}</b></td><td>${sv && !sv.sinBase ? (sv.faltan <= 0 ? `vencido ${fmt(-sv.faltan, 1)} h` : `faltan ${fmt(sv.faltan, 1)} h`) + (sv.prox != null && !m.sinHoro ? ` (a los ${fmt(sv.prox, 1)})` : '') : '–'}</td></tr>`;
  }).join('')}</tbody></table></div>`;
  const evs = maqE().filter((e) => e.fecha.startsWith(ym)).sort((a, b) => a.fecha.localeCompare(b.fecha));
  if (evs.length) h += `<div class="card"><h3>Paradas y mantenimientos del mes</h3><table class="tbl stk"><thead><tr><th>Fecha</th><th>Interno</th><th>Equipo</th><th>Tipo</th><th class="n">Horas</th><th class="n">Horómetro</th><th>Motivo</th><th>Observaciones</th></tr></thead><tbody>${evs.map((e) => { const m = maqDe(e.maq) || {}; return `<tr><td>${fechaCorta(e.fecha)}</td><td><b>${esc(m.interno || '')}</b></td><td>${esc(m.descripcion || '')}</td><td>${MAQ_TIPO[e.tipo][0]}${e.reinicia ? ' (service)' : ''}</td><td class="n">${fmt(e.horas, 1)}</td><td class="n">${vacio(e.horo) ? '' : fmt(Number(e.horo), 1)}</td><td>${esc(e.motivo || '')}</td><td style="white-space:normal">${esc(e.obs || '')}</td></tr>`; }).join('')}</tbody></table></div>`;
  printHTML(h, `Maquinaria ${mesTxt(ym)}.pdf`, true);
}

// ======================= CONTADOR DE PARADAS Y MANTENIMIENTOS =======================
// Se inicia con la hora del reloj (o la que se indique) y al finalizar se calculan las horas que demandó.
// En curso: {…evento, inicio: 'AAAA-MM-DDTHH:MM', enCurso: true, horas: 0}; al finalizar se agrega fin y horas = fin − inicio.
// jornada de obra: solo esas horas cuentan como parada efectiva (las de noche no se trabaja igual)
const jorObra = () => { const j = (S.params && S.params.jornada) || {}; return { ini: j.ini || '06:00', fin: j.fin || '19:00' }; };
const jorTxt = (j) => `${(j || jorObra()).ini} a ${(j || jorObra()).fin}`;
function horasJornada(a, b, j) {
  j = j || jorObra(); const t0 = new Date(a).getTime(), t1 = new Date(b).getTime(); if (!(t1 > t0)) return 0;
  let tot = 0, d = a.slice(0, 10);
  for (let k = 0; k < 400 && d <= b.slice(0, 10); k++, d = sumDias(d, 1)) {
    const j0 = new Date(`${d}T${j.ini}`).getTime(), j1 = new Date(`${d}T${j.fin}`).getTime();
    tot += Math.max(0, Math.min(t1, j1) - Math.max(t0, j0));
  }
  return tot / 36e5;
}
// lo registrado antes con hora de inicio y fin pasa a contar solo las horas de jornada (se guarda la jornada usada)
function maqMigrJor() {
  if (window.VISOR) return; let n = 0;
  maqE().forEach((e) => { if (e.inicio && e.fin && !e.enCurso && e.horasRel == null) { e.horasRel = Math.round(horasEntre(e.inicio, e.fin) * 100) / 100; e.jor = jorObra(); e.horas = Math.round(horasJornada(e.inicio, e.fin, e.jor) * 100) / 100; n++; } });
  if (n) commit(`${n} parada${n > 1 ? 's' : ''} / mantenimiento${n > 1 ? 's' : ''} recalculado${n > 1 ? 's' : ''} con la jornada de obra (${jorTxt()})`);
}
async function editJornada() {
  if (window.READONLY) return; const j = jorObra();
  const r = await modal({ title: 'Jornada de obra', sub: 'Las horas de parada y mantenimiento con contador cuentan solo dentro de este horario',
    body: `<div class="form"><label>Inicio<input type="time" name="ini" value="${j.ini}"></label><label>Fin<input type="time" name="fin" value="${j.fin}"></label></div><p class="hint" style="display:block">Se aplica a lo que se finalice de ahora en adelante; lo ya registrado conserva la jornada con la que se calculó.</p>`,
    buttons: [['Cancelar', 'btn', () => null], ['Guardar', 'btn pri', (box) => { const a = $('[name=ini]', box).value, b = $('[name=fin]', box).value; if (!a || !b || b <= a) { toast('El fin de la jornada tiene que ser posterior al inicio', { err: true }); return false; } return { ini: a, fin: b }; }]] });
  if (!r) return; S.params.jornada = r; commit(`Jornada de obra: ${jorTxt(r)}`);
}
const evCurso = () => maqE().filter((e) => e.enCurso);
// horas de jornada en que este evento coincide con uno ya finalizado del otro tipo en el mismo equipo (cada superposición se cuenta una vez: la guarda el que termina último)
function solapeCon(e, ini, fin) {
  return maqE().filter((o) => o !== e && o.maq === e.maq && o.tipo !== e.tipo && o.inicio && o.fin && !o.enCurso)
    .reduce((a, o) => { const a0 = ini > o.inicio ? ini : o.inicio, a1 = fin < o.fin ? fin : o.fin; return a + (a1 > a0 ? horasJornada(a0, a1) : 0); }, 0);
}
const evDeMaq = (maq, tipo) => evCurso().find((e) => e.maq === maq && (!tipo || e.tipo === tipo));
const evsDeMaq = (maq) => evCurso().filter((e) => e.maq === maq).sort((a, b) => (a.tipo === 'parada' ? -1 : 1));
const tipoLibre = (maq) => ['mantenimiento', 'parada'].find((t) => !evDeMaq(maq, t));
const ahoraLocal = () => { const d = new Date(); d.setSeconds(0, 0); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16); };
const horasEntre = (a, b) => Math.max(0, (new Date(b) - new Date(a)) / 36e5);
const hhmm = (s) => (s ? String(s).slice(11, 16) : '');
const durTxt = (h) => { const m = Math.round(h * 60); return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`; };
const tmrHTML = (e) => `<span class="tmr" data-ini="${esc(e.inicio)}">${tmrFmt(e.inicio)}</span>`;
function tmrFmt(ini) { const s = Math.max(0, Math.floor((Date.now() - new Date(ini).getTime()) / 1000)); return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }
const jorVivo = (ini) => { const h = horasJornada(ini, ahoraSeg()); const m = Math.floor(h * 60); return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
const ahoraSeg = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 19); };
setInterval(() => { document.querySelectorAll('.tmr[data-ini]').forEach((x) => { x.textContent = tmrFmt(x.dataset.ini); }); document.querySelectorAll('.tjor[data-ini]').forEach((x) => { x.textContent = jorVivo(x.dataset.ini); }); }, 1000);
// tarjetas de lo que está en curso (Maquinaria, Paradas y mantenimientos e Inicio)
function evCursoHTML(compacto) {
  const es = evCurso().sort((a, b) => String(a.inicio).localeCompare(String(b.inicio))); if (!es.length) return '';
  const ro = window.READONLY;
  if (compacto) return `<div class="alert aviso evcban"><div style="flex:1"><b>⏱ ${es.length === 1 ? 'Un equipo detenido' : `${es.length} equipos detenidos`} ahora:</b> ${es.map((e) => { const m = maqDe(e.maq) || {}; return `${esc(m.interno || '?')} (${MAQ_TIPO[e.tipo][0].toLowerCase()}) ${tmrHTML(e)}`; }).join(' · ')}</div><button class="btn sm" data-evgo>Ver</button></div>`;
  return `<div class="evcur">${es.map((e) => { const m = maqDe(e.maq) || {};
    return `<div class="card evc ${e.tipo}" data-id="${e.id}"><div class="evch"><span class="pill ${MAQ_TIPO[e.tipo][1]}">${MAQ_TIPO[e.tipo][0]} en curso</span><span class="muted">desde ${hhmm(e.inicio)}${e.inicio.slice(0, 10) !== today() ? ` del ${fechaCorta(e.inicio.slice(0, 10))}` : ''}</span></div>
      <div class="evcm"><b class="mono">${esc(m.interno || '?')}</b> ${esc(m.descripcion || '')}</div><div class="evcmot">${esc(e.motivo || '')}${e.obs ? ` · <span class="muted">${esc(e.obs)}</span>` : ''}</div>
      <div class="evct">${tmrHTML(e)}<div class="evcj">en jornada de obra (${jorTxt()}): <b class="tjor" data-ini="${esc(e.inicio)}">${jorVivo(e.inicio)}</b> h</div></div>${ro ? '' : `<div class="evcb"><button class="btn pri" data-a="fin">■ Finalizar</button><button class="btn ghost" data-a="edc">✎</button></div>`}</div>`; }).join('')}</div>`;
}
function bindEvCurso(el) {
  $$('[data-evgo]', el).forEach((b) => { b.onclick = () => go('maqev'); });
  if (window.READONLY) return;
  $$('.evc[data-id]', el).forEach((c) => { const id = c.dataset.id;
    const f = $('[data-a=fin]', c); if (f) f.onclick = () => finalizarEvento(id);
    const d = $('[data-a=edc]', c); if (d) d.onclick = () => iniciarEvento(null, id); });
}
async function iniciarEvento(maq, idEd) {
  if (window.READONLY) return;
  if (!maqL().length) { toast('Primero cargá los equipos', { err: true }); return; }
  const e0 = idEd ? maqE().find((x) => x.id === idEd) : null;
  if (!e0 && maq && !tipoLibre(maq)) { toast('Ese equipo ya tiene una parada y un mantenimiento en curso', { err: true }); return; }
  const libres = maqL().filter((m) => m.activa !== false && (tipoLibre(m.id) || (e0 && e0.maq === m.id))).sort(maqOrd);
  if (!libres.length) { toast('Todos los equipos ya tienen una parada o mantenimiento en curso', { err: true }); return; }
  const e = e0 || { maq: maq || '', tipo: (maq && tipoLibre(maq)) || 'mantenimiento', inicio: ahoraLocal(), motivo: '', obs: '' };
  const pm = modal({ title: e0 ? 'Editar parada / mantenimiento en curso' : '▶ Iniciar parada o mantenimiento', sub: 'El contador arranca a la hora de inicio y al finalizar se calculan las horas',
    body: `<div class="form"><label class="full">Equipo<select name="maq"><option value="">— elegí el equipo —</option>${libres.map((m) => `<option value="${m.id}" ${m.id === e.maq ? 'selected' : ''}>${esc(maqNom(m))}</option>`).join('')}</select></label>
      <label>Tipo<select name="tipo"><option value="mantenimiento" ${e.tipo === 'mantenimiento' ? 'selected' : ''}>Mantenimiento</option><option value="parada" ${e.tipo === 'parada' ? 'selected' : ''}>Parada</option></select></label>
      <label>Inicio<span style="display:flex;gap:6px"><input type="datetime-local" name="inicio" value="${esc(e.inicio)}" max="${ahoraLocal()}" style="flex:1"><button class="btn sm ghost" type="button" id="evAhora" title="Tomar la hora del reloj">🕒 Ahora</button></span></label>
      <label>Motivo<input type="text" name="motivo" list="evMot2" value="${esc(e.motivo || '')}"><datalist id="evMot2"></datalist></label>
      <label>Observaciones<input type="text" name="obs" value="${esc(e.obs || '')}" placeholder="quién, qué se hace…"></label></div>`,
    buttons: [...(e0 ? [['Descartar', 'btn danger', () => 'del']] : []), ['Cancelar', 'btn', () => null], [e0 ? 'Guardar' : '▶ Iniciar', 'btn pri', (box) => {
      const g = (n) => $(`[name=${n}]`, box).value.trim();
      if (!g('maq') || !g('inicio') || !g('motivo')) { toast('Completá equipo, inicio y motivo', { err: true }); return false; }
      const ya = evDeMaq(g('maq'), g('tipo')); if (ya && ya !== e0) { toast(`Ese equipo ya tiene un${g('tipo') === 'parada' ? 'a parada' : ' mantenimiento'} en curso: finalizalo o elegí el otro tipo`, { err: true }); return false; }
      if (new Date(g('inicio')) > new Date(Date.now() + 6e4)) { toast('El inicio no puede ser posterior a la hora actual', { err: true }); return false; }
      return { maq: g('maq'), tipo: g('tipo'), inicio: g('inicio'), motivo: g('motivo'), obs: g('obs') }; }]] });
  { const box = $('#modal .mbox'), t = $('[name=tipo]', box), sm = $('[name=maq]', box), dl = $('#evMot2', box), upd = () => { dl.innerHTML = MAQ_MOT[t.value].map((x) => `<option value="${x}">`).join(''); };
    const updM = () => { const id = sm.value; [...t.options].forEach((o) => { const r = id && evDeMaq(id, o.value); o.disabled = !!(r && r !== e0); o.textContent = MAQ_TIPO[o.value][0] + (o.disabled ? ' (ya en curso)' : ''); });
      if (t.selectedOptions[0] && t.selectedOptions[0].disabled) { const l = [...t.options].find((o) => !o.disabled); if (l) t.value = l.value; } upd();
      const otro = id && evsDeMaq(id).find((x) => x !== e0); let n = $('#evPar', box); if (!n) { n = document.createElement('div'); n.id = 'evPar'; n.className = 'hint'; n.style.cssText = 'display:block;grid-column:1/-1'; $('.form', box).appendChild(n); }
      n.innerHTML = otro ? `Este equipo tiene un${otro.tipo === 'parada' ? 'a parada' : ' mantenimiento'} en curso desde las ${hhmm(otro.inicio)}: corren en paralelo y el tiempo superpuesto se descuenta una sola vez de la disponibilidad.` : ''; };
    sm.onchange = updM; t.onchange = upd; updM(); $('#evAhora', box).onclick = () => { $('[name=inicio]', box).value = ahoraLocal(); }; }
  const res = await pm;
  if (res === 'del') { if (await confirmar('Descartar', 'Se descarta esta parada / mantenimiento en curso sin registrar horas.', 'Descartar', 'btn danger')) { S.maqEventos = maqE().filter((x) => x !== e0); commit('Parada / mantenimiento descartado'); } return; }
  if (!res) return;
  const m = maqDe(res.maq);
  if (e0) { Object.assign(e0, res, { fecha: res.inicio.slice(0, 10) }); commit(`${MAQ_TIPO[res.tipo][0]} en curso de ${m.interno}: desde ${hhmm(res.inicio)}`); return; }
  maqE().push(Object.assign({ id: uid('e'), _o: Date.now(), fecha: res.inicio.slice(0, 10), horas: 0, enCurso: true }, res));
  commit(`${MAQ_TIPO[res.tipo][0]} de ${m.interno} iniciado a las ${hhmm(res.inicio)}`);
}
async function finalizarEvento(id) {
  if (window.READONLY) return;
  const e = maqE().find((x) => x.id === id); if (!e) return;
  const m = maqDe(e.maq) || {}, conH = !m.sinHoro, svc = e.tipo === 'mantenimiento' && Number(m.mantCada) > 0;
  const pm = modal({ title: `■ Finalizar ${MAQ_TIPO[e.tipo][0].toLowerCase()} · ${m.interno || ''}`, sub: `${esc(m.descripcion || '')} · ${esc(e.motivo || '')} · inició ${fechaCorta(e.inicio.slice(0, 10))} ${hhmm(e.inicio)}`,
    body: `<div class="form"><label>Inicio<input type="datetime-local" name="inicio" value="${esc(e.inicio)}"></label>
      <label>Fin<span style="display:flex;gap:6px"><input type="datetime-local" name="fin" value="${ahoraLocal()}" style="flex:1"><button class="btn sm ghost" type="button" id="evAhora2" title="Tomar la hora del reloj">🕒 Ahora</button></span></label>
      <div class="full evdur" id="evDur"></div>
      ${conH ? `<label>${e.tipo === 'mantenimiento' ? 'Horómetro al hacer el mantenimiento' : 'Horómetro (opcional)'}<input type="number" step="0.1" min="0" name="horo" value="${numIn(e.horo)}"></label>` : ''}
      ${svc ? `<label style="display:flex;gap:8px;align-items:center;flex-direction:row;font-weight:500;align-self:end"><input type="checkbox" name="reinicia" style="width:auto;margin:0" ${e.reinicia ? 'checked' : ''}> Es el <b>service programado</b> (reinicia el contador)</label>` : ''}
      <label class="full">Observaciones<input type="text" name="obs" value="${esc(e.obs || '')}" placeholder="qué se hizo, repuestos…"></label></div>`,
    buttons: [['Cancelar', 'btn', () => null], ['Finalizar y registrar', 'btn pri', (box) => {
      const g = (n) => { const x = $(`[name=${n}]`, box); return x ? x.value.trim() : ''; };
      const h = horasEntre(g('inicio'), g('fin'));
      if (!g('inicio') || !g('fin') || !(new Date(g('fin')) > new Date(g('inicio')))) { toast('El fin tiene que ser posterior al inicio', { err: true }); return false; }
      if (e.tipo === 'mantenimiento' && conH && g('horo') === '') { toast('Cargá el horómetro al que se hizo el mantenimiento', { err: true }); return false; }
      const jo = jorObra();
      return { inicio: g('inicio'), fin: g('fin'), horas: Math.round(horasJornada(g('inicio'), g('fin'), jo) * 100) / 100, horasRel: Math.round(h * 100) / 100, jor: jo, sol: Math.round(solapeCon(e, g('inicio'), g('fin')) * 100) / 100, horo: g('horo'), obs: g('obs'), reinicia: !!($('[name=reinicia]', box) || {}).checked }; }]] });
  { const box = $('#modal .mbox'), i = $('[name=inicio]', box), f = $('[name=fin]', box), d = $('#evDur', box);
    const upd = () => { const ok = i.value && f.value && new Date(f.value) > new Date(i.value), h = ok ? horasEntre(i.value, f.value) : 0;
      const hj = ok ? horasJornada(i.value, f.value) : 0, so = ok ? solapeCon(e, i.value, f.value) : 0;
      d.innerHTML = ok ? `Horas de ${e.tipo} en la jornada de obra (${jorTxt()}): <b>${fmt(hj, 2)} h</b> <span class="muted">(${durTxt(hj)})</span><br><span class="muted">Tiempo total de reloj: ${fmt(h, 2)} h (${durTxt(h)})${i.value.slice(0, 10) !== f.value.slice(0, 10) ? ' · abarca más de un día' : ''}${h - hj > 0.009 ? ` · ${fmt(h - hj, 2)} h fuera de jornada no se cuentan` : ''}</span>${so > 0.009 ? `<br><span class="muted">${fmt(so, 2)} h coinciden con ${e.tipo === 'parada' ? 'el mantenimiento' : 'la parada'} del mismo equipo: se registran en los dos, pero la disponibilidad las descuenta una sola vez.</span>` : ''}` : '<span class="tneg">El fin tiene que ser posterior al inicio</span>'; };
    i.oninput = upd; f.oninput = upd; $('#evAhora2', box).onclick = () => { f.value = ahoraLocal(); upd(); }; upd(); }
  const res = await pm; if (!res) return;
  Object.assign(e, { inicio: res.inicio, fin: res.fin, fecha: res.inicio.slice(0, 10), horas: res.horas, horasRel: res.horasRel, jor: res.jor, obs: res.obs }); delete e.enCurso;
  if (res.sol > 0) e.sol = res.sol; else delete e.sol;
  if (res.horo !== '' && conH) e.horo = Number(res.horo); else delete e.horo;
  if (res.reinicia) e.reinicia = true; else delete e.reinicia;
  commit(`${MAQ_TIPO[e.tipo][0]} de ${m.interno}: ${fmt(e.horas, 2)} h en jornada${e.horasRel - e.horas > 0.009 ? ` (${fmt(e.horasRel, 2)} h de reloj)` : ''} · ${hhmm(e.inicio)} a ${hhmm(e.fin)}`);
}
