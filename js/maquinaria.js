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
function vMaq(el) {
  const sem = (ui.maqSem = ui.maqSem || lunesDe(today()));
  const ro = window.READONLY;
  actions([...(ro ? [] : [['Registrar horas', 'btn pri', () => registrarHoras(null, null)], ['+ Parada / mantenimiento', 'btn acc', () => editEvento(null)], ['+ Equipo', 'btn', () => editMaquina(null)]]),
    ['Exportar Excel', 'btn', exportMaq], ['PDF de la semana', 'btn', () => printMaqSemana(sem)]]);
  const ms = maqL().filter((m) => m.activa !== false || regDe(m.id, sem)).sort(maqOrd);
  const tot = { t: 0, p: 0, m: 0 };
  ms.forEach((m) => { tot.t += horasSem(m.id, sem); tot.p += evSem(m.id, sem, 'parada'); tot.m += evSem(m.id, sem, 'mantenimiento'); });
  const dg = dispo(tot.t, tot.p + tot.m);
  let h = `<div class="tools"><button class="btn" id="semAnt">◀</button><b style="min-width:220px;text-align:center">Semana del ${semTxt(sem)}</b><button class="btn" id="semSig">▶</button>
    <input type="date" id="semFecha" value="${sem}" title="Ir a la semana de esta fecha"><button class="btn ghost" id="semHoy">Esta semana</button><span class="sp"></span>
    <span class="muted">${ms.length} equipo${ms.length === 1 ? '' : 's'}</span></div>
    <div class="kpis k4" style="margin-bottom:14px">${kpi('Horas trabajadas', tot.t, 'h', 1)}${kpi('Horas de parada', tot.p, 'h', 1)}${kpi('Horas de mantenimiento', tot.m, 'h', 1)}
      <div class="kpi"><span>Disponibilidad</span><b>${dg == null ? '–' : fmt(dg * 100)}<small>${dg == null ? '' : '%'}</small></b></div></div>`;
  const avis = maqL().filter((m) => m.activa !== false).map((m) => [m, servicio(m)]).filter(([, x]) => x && !x.sinBase && x.nivel !== 'ok').sort((a, b) => a[1].faltan - b[1].faltan);
  if (avis.length) h += `<div class="alerts" style="margin-bottom:12px">${avis.map(([m, x]) => `<div class="alert ${x.nivel === 'venc' ? 'error' : 'aviso'}" style="display:block"><b>${esc(m.interno)} · ${esc(m.descripcion)}</b>: ${x.faltan <= 0 ? `service vencido hace ${fmt(-x.faltan, 1)} h` : `faltan ${fmt(x.faltan, 1)} h para el service`} (cada ${fmt(x.N)} h${x.prox != null && !m.sinHoro ? `, a los ${fmt(x.prox, 1)} h de horómetro` : ''})</div>`).join('')}</div>`;
  if (!maqL().length) {
    el.innerHTML = h + `<div class="empty"><b>Todavía no hay equipos cargados</b><p>Cargá cada máquina con su número de interno, descripción, marca y modelo.</p>${ro ? '' : '<button class="btn pri" id="maqPrim">+ Cargar el primer equipo</button>'}</div>`;
    const b = $('#maqPrim'); if (b) b.onclick = () => editMaquina(null);
    bindSem(el); return;
  }
  const ds = diasSem(sem), hoy = today();
  h += `<div class="tblwrap"><table class="tbl maqt"><thead><tr><th>Interno</th><th>Equipo</th>${ds.map((d, k) => `<th class="n dcol ${d === hoy ? 'hoy' : ''}">${DIAS[k]} ${d.slice(8)}</th>`).join('')}
    <th class="n">Horas semana</th><th>Próx. service</th><th class="n">Parada (h)</th><th class="n">Mant. (h)</th><th class="n">Disponib.</th><th>Observaciones</th><th></th></tr></thead><tbody>`;
  ms.forEach((m) => {
    const r = regDe(m.id, sem) || {}, L = lecturas(m.id), t = horasSem(m.id, sem), p = evSem(m.id, sem, 'parada'), mm = evSem(m.id, sem, 'mantenimiento'), d = dispo(t, p + mm);
    const evs = maqE().filter((e) => e.maq === m.id && enSemana(e.fecha, sem));
    const sinBase = !m.sinHoro && horoAntes(m.id, ds[0], L) == null;
    h += `<tr data-id="${m.id}"><td class="mono"><b>${esc(m.interno)}</b></td><td>${esc(m.descripcion)}<div class="muted" style="font-size:11.5px">${esc([m.marca, m.modelo].filter(Boolean).join(' '))}${m.sinHoro ? ' · sin horómetro' : ''}</div></td>
      ${ds.map((f) => {
        const pd = (r.per || {})[f], pTxt = pd ? `período desde ${fechaCorta(pd)}` : '';
        if (m.sinHoro) { const v = (r.hs || {})[f]; return `<td class="n dcol"><button class="dcel ${vacio(v) ? 'vac' : ''} ${pd ? 'per' : ''}" data-d="${f}" ${ro ? 'disabled' : ''} title="${pd ? 'Horas del ' + pTxt : 'Horas trabajadas el ' + fechaCorta(f)}">${vacio(v) ? '·' : `<b>${fmt(Number(v), 1)} h</b>${pd ? '<small>período</small>' : ''}`}</button></td>`; }
        const v = (r.lect || {})[f], ant = horoAntes(m.id, f, L), hd = horasDia(m.id, f, L);
        return `<td class="n dcol"><button class="dcel ${vacio(v) ? 'vac' : ''} ${pd ? 'per' : ''}" data-d="${f}" ${ro ? 'disabled' : ''} title="${vacio(v) ? 'Sin registro' : `${pd ? pTxt.charAt(0).toUpperCase() + pTxt.slice(1) + ' · ' : ''}Horómetro ${fmt(Number(v), 1)} (inicio ${ant != null ? fmt(ant, 1) : '?'})`}">${vacio(v) ? '·' : `<b>${ant == null ? 'inicio?' : `${fmt(hd, 1)} h`}</b><small>${pd ? 'período' : fmt(Number(v), 1)}</small>`}</button></td>`;
      }).join('')}
      <td class="n"><b>${fmt(t, 1)}</b>${sinBase && L.some((x) => x[0] >= ds[0] && x[0] <= ds[6]) ? '<div class="hd" style="color:var(--warn)">cargá el horómetro al ingreso</div>' : ''}</td>
      <td>${servHTML(m, true)}</td>
      <td class="n">${p ? `<b style="color:var(--bad)">${fmt(p, 1)}</b>` : '–'}</td><td class="n">${mm ? `<b style="color:var(--warn)">${fmt(mm, 1)}</b>` : '–'}</td>
      <td class="n">${d == null ? '–' : `<span class="pill ${d >= 0.85 ? 'p-done' : d >= 0.6 ? 'p-prov' : 'p-bad'}">${fmt(d * 100)} %</span>`}</td>
      <td><input type="text" class="mi mo" data-f="obs" value="${esc(r.obs || '')}" ${ro ? 'disabled' : ''}>${evs.length ? `<div class="muted" style="font-size:11.5px;margin-top:3px">${evs.map((e) => `${MAQ_TIPO[e.tipo][0]} ${fechaCorta(e.fecha)}: ${esc(e.motivo)} (${fmt(e.horas, 1)} h)`).join(' · ')}</div>` : ''}</td>
      <td style="white-space:nowrap">${ro ? '' : `<button class="btn sm acc" data-a="ev" title="Registrar parada o mantenimiento">Parada / mant.</button> <button class="btn sm ghost" data-a="ed" title="Editar equipo">✎</button>`}</td></tr>`;
  });
  h += `</tbody></table></div><p class="hint">Con <b>Registrar horas</b> (o tocando un día de la planilla) se carga <b>un solo dato por jornada: el horómetro al terminar el día</b>. El inicio de cada jornada es el fin de la anterior y las horas del día salen de la diferencia (en la planilla: horas del día y, debajo, el horómetro). Si un día no se carga, esas horas se suman a la próxima lectura. La primera vez se toma el horómetro al ingreso del equipo (en ✎). Los equipos sin horómetro cargan las horas trabajadas de cada día. Disponibilidad = trabajadas / (trabajadas + paradas + mantenimiento).</p>`;
  el.innerHTML = h;
  bindSem(el);
  if (ro) return;
  $$('tbody tr', el).forEach((tr) => {
    const id = tr.dataset.id, m = maqDe(id);
    const reg = () => { let r = regDe(id, sem); if (!r) { r = { id: `${id}|${sem}`, maq: id, semana: sem, _o: Date.now() }; maqH().push(r); } return r; };
    $$('.dcel', tr).forEach((b) => { b.onclick = () => registrarHoras(id, b.dataset.d); });
    const ob = tr.querySelector('[data-f=obs]'); ob.onchange = () => { reg().obs = ob.value.trim(); commit(`${m.interno}: observación de la semana`); };
    const b1 = tr.querySelector('[data-a=ev]'); if (b1) b1.onclick = () => editEvento(null, id, sem);
    const b2 = tr.querySelector('[data-a=ed]'); if (b2) b2.onclick = () => editMaquina(id);
  });
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
    ui.maqSem = lunesDe(f);
    if (otro) setTimeout(() => registrarHoras(null, f), 250);
  }
}
function bindSem(el) {
  const set = (v) => { ui.maqSem = lunesDe(v); render(false); };
  $('#semAnt').onclick = () => set(sumDias(ui.maqSem, -7));
  $('#semSig').onclick = () => set(sumDias(ui.maqSem, 7));
  $('#semHoy').onclick = () => set(today());
  $('#semFecha').onchange = (e) => { if (e.target.value) set(e.target.value); };
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
    <th class="n">Horas trabajadas</th><th class="n">Paradas (h)</th><th class="n">Mant. (h)</th><th class="n">Disponib.</th><th>Último horómetro</th><th>Mant. programado</th><th>Estado</th><th></th></tr></thead><tbody>`;
  ms.forEach((m) => {
    const t = horasTot(m.id);
    const ev = maqE().filter((e) => e.maq === m.id), p = ev.filter((e) => e.tipo === 'parada').reduce((a, e) => a + (Number(e.horas) || 0), 0), mm = ev.filter((e) => e.tipo === 'mantenimiento').reduce((a, e) => a + (Number(e.horas) || 0), 0);
    const ult = ultLect(m.id), d = dispo(t, p + mm);
    h += `<tr data-id="${m.id}"><td class="mono"><b>${esc(m.interno)}</b></td><td>${esc(m.descripcion)}${m.obs ? ` <span title="${esc(m.obs)}">ⓘ</span>` : ''}</td><td>${esc(m.marca || '')}</td><td>${esc(m.modelo || '')}</td><td>${esc(m.serie || '')}</td><td>${esc(m.propiedad || '')}</td><td>${m.fechaIngreso ? fechaCorta(m.fechaIngreso) : '–'}${vacio(m.horoIngreso) ? '' : `<div class="muted" style="font-size:11.5px">horómetro ${fmt(Number(m.horoIngreso), 1)}</div>`}</td>
      <td class="n">${fmt(t, 1)}</td><td class="n">${p ? fmt(p, 1) : '–'}</td><td class="n">${mm ? fmt(mm, 1) : '–'}</td><td class="n">${d == null ? '–' : fmt(d * 100) + ' %'}</td>
      <td>${m.sinHoro ? '<span class="muted">sin horómetro</span>' : ult ? `${fmt(ult[1], 1)} h <span class="muted">(${fechaCorta(ult[0])})</span>` : '–'}</td><td>${servHTML(m, false)}</td><td>${m.activa === false ? '<span class="pill p-prov">de baja</span>' : '<span class="pill p-done">en obra</span>'}</td>
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
  const ro = window.READONLY;
  actions([...(ro ? [] : [['+ Parada / mantenimiento', 'btn pri', () => editEvento(null)]]), ['Exportar Excel', 'btn', exportMaq]]);
  const fm = ui.evMaq || 'all', ft = ui.evTipo || 'all', fmes = ui.evMes || 'all';
  const meses = [...new Set(maqE().map((e) => e.fecha.slice(0, 7)))].sort().reverse();
  const list = maqE().filter((e) => (fm === 'all' || e.maq === fm) && (ft === 'all' || e.tipo === ft) && (fmes === 'all' || e.fecha.startsWith(fmes)))
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || maqOrd(maqDe(a.maq) || {}, maqDe(b.maq) || {}));
  const hs = (t) => list.filter((e) => e.tipo === t).reduce((a, e) => a + (Number(e.horas) || 0), 0);
  // motivos más frecuentes (por horas)
  const mot = {}; list.forEach((e) => { const k = `${MAQ_TIPO[e.tipo][0]} · ${e.motivo}`; mot[k] = (mot[k] || 0) + (Number(e.horas) || 0); });
  const top = Object.entries(mot).sort((a, b) => b[1] - a[1]).slice(0, 5);
  let h = `<div class="tools"><select id="fEM"><option value="all">Todos los equipos</option>${maqL().slice().sort(maqOrd).map((m) => `<option value="${m.id}">${esc(maqNom(m))}</option>`).join('')}</select>
    <div class="seg" id="fET"><button data-v="all">Todo</button><button data-v="parada">Paradas</button><button data-v="mantenimiento">Mantenimientos</button></div>
    <select id="fEMes"><option value="all">Todos los meses</option>${meses.map((x) => `<option value="${x}">${MESES[Number(x.slice(5, 7)) - 1]} ${x.slice(0, 4)}</option>`).join('')}</select><span class="sp"></span>
    <span class="muted">${list.length} registro${list.length === 1 ? '' : 's'}</span></div>
    <div class="grid g3" style="margin-bottom:14px;align-items:start"><div class="card"><div class="kpis k1">${kpi('Horas de parada', hs('parada'), 'h', 1)}</div></div><div class="card"><div class="kpis k1">${kpi('Horas de mantenimiento', hs('mantenimiento'), 'h', 1)}</div></div>
    <div class="card"><h3>Principales motivos (horas)</h3>${top.length ? top.map(([k, v]) => `<div class="zrow"><span>${esc(k)}</span><b>${fmt(v, 1)} h</b></div>`).join('') : '<span class="muted">Sin registros</span>'}</div></div>
    <div class="tblwrap"><table class="tbl"><thead><tr><th>Fecha</th><th>Interno</th><th>Equipo</th><th>Tipo</th><th class="n">Horas</th><th>Motivo</th><th>Observaciones</th><th></th></tr></thead><tbody>`;
  list.forEach((e) => {
    const m = maqDe(e.maq) || {};
    h += `<tr data-id="${e.id}"><td>${fechaCorta(e.fecha)}</td><td class="mono"><b>${esc(m.interno || '?')}</b></td><td>${esc(m.descripcion || '')}</td><td><span class="pill ${MAQ_TIPO[e.tipo][1]}">${MAQ_TIPO[e.tipo][0]}</span></td>
      <td class="n">${fmt(e.horas, 1)}</td><td>${esc(e.motivo || '')}</td><td>${esc(e.obs || '')}</td><td>${ro ? '' : '<button class="btn sm ghost" data-a="ed">✎</button>'}</td></tr>`;
  });
  h += `</tbody></table>${list.length ? '' : '<div class="empty"><b>Sin paradas ni mantenimientos registrados</b></div>'}</div>`;
  el.innerHTML = h;
  $('#fEM').value = fm; $('#fEMes').value = fmes;
  $('#fEM').onchange = (ev) => { ui.evMaq = ev.target.value; render(false); };
  $('#fEMes').onchange = (ev) => { ui.evMes = ev.target.value; render(false); };
  segBind('#fET', ft, (v) => { ui.evTipo = v; render(false); });
  if (!ro) $$('[data-a=ed]', el).forEach((b) => { b.onclick = () => editEvento(b.closest('tr').dataset.id); });
}
async function editEvento(id, maq, sem) {
  if (window.READONLY) return;
  if (!maqL().length) { toast('Primero cargá los equipos', { err: true }); return; }
  const nuevo = !id;
  const e = nuevo ? { id: uid('e'), maq: maq || '', tipo: 'parada', fecha: sem && !enSemana(today(), sem) ? sem : today(), horas: '', motivo: '', obs: '' } : maqE().find((x) => x.id === id);
  const pm = modal({
    title: nuevo ? 'Registrar parada o mantenimiento' : 'Editar registro',
    body: `<div class="form"><label class="full">Equipo<select name="maq"><option value="">— elegí el equipo —</option>${maqL().filter((m) => m.activa !== false || m.id === e.maq).sort(maqOrd).map((m) => `<option value="${m.id}" ${m.id === e.maq ? 'selected' : ''}>${esc(maqNom(m))}${m.marca ? ' · ' + esc(m.marca) : ''}</option>`).join('')}</select></label>
      <label>Tipo<select name="tipo"><option value="parada" ${e.tipo === 'parada' ? 'selected' : ''}>Parada</option><option value="mantenimiento" ${e.tipo === 'mantenimiento' ? 'selected' : ''}>Mantenimiento</option></select></label>
      <label>Fecha<input type="date" name="fecha" value="${esc(e.fecha)}"></label>
      <label>Horas<input type="number" step="0.5" min="0" name="horas" value="${e.horas}"></label>
      <label>Motivo<input type="text" name="motivo" list="evMot" value="${esc(e.motivo || '')}"><datalist id="evMot"></datalist></label>
      <div id="evSvc" style="grid-column:1/-1;display:none"><label style="display:flex;gap:8px;align-items:center;flex-direction:row;font-weight:500"><input type="checkbox" name="reinicia" style="width:auto;margin:0" ${e.reinicia ? 'checked' : ''}> Es el <b>service programado</b>: reinicia el contador de horas para el próximo</label>
        <label style="margin-top:8px">Horómetro al hacer el service<input type="number" step="0.1" min="0" name="horo" value="${numIn(e.horo)}" placeholder="si no se carga, se toma la lectura de ese día"></label></div>
      <label class="full">Observaciones<input type="text" name="obs" value="${esc(e.obs || '')}" placeholder="detalle, repuestos, quién lo hizo…"></label></div>`,
    buttons: [...(nuevo ? [] : [['Eliminar', 'btn danger', () => 'del']]), ['Cancelar', 'btn', () => null], ['Guardar', 'btn pri', (box) => {
      const g = (n) => $(`[name=${n}]`, box).value.trim();
      if (!g('maq') || !g('fecha') || !(Number(g('horas')) > 0) || !g('motivo')) { toast('Completá equipo, fecha, horas y motivo', { err: true }); return false; }
      Object.assign(e, { maq: g('maq'), tipo: g('tipo'), fecha: g('fecha'), horas: Number(g('horas')), motivo: g('motivo'), obs: g('obs') });
      const rei = g('tipo') === 'mantenimiento' && $('[name=reinicia]', box).checked;
      if (rei) { e.reinicia = true; e.horo = g('horo') === '' ? '' : Number(g('horo')); } else { delete e.reinicia; delete e.horo; }
      return 'ok';
    }]],
  });
  { const box = $('#modal .mbox'), t = $('[name=tipo]', box), dl = $('#evMot', box);
    const sv = $('#evSvc', box), sm = $('[name=maq]', box);
    const upd = () => { dl.innerHTML = MAQ_MOT[t.value].map((x) => `<option value="${x}">`).join(''); const m = maqDe(sm.value); sv.style.display = t.value === 'mantenimiento' && m && Number(m.mantCada) > 0 ? '' : 'none'; };
    sm.addEventListener('change', upd);
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
    const ult = ultLect(m.id), d = dispo(t, p + mm);
    a1.push([m.interno, m.descripcion, m.marca || '', m.modelo || '', m.serie || '', m.propiedad || '', m.fechaIngreso || '', vacio(m.horoIngreso) ? '' : Number(m.horoIngreso), m.activa === false ? 'De baja' : 'En obra', r1(t), r1(p), r1(mm), d == null ? '' : r1(d * 100), m.sinHoro ? 'sin horómetro' : ult ? ult[1] : '', ...(() => { const x = servicio(m); return x && !x.sinBase ? [x.N, r1(x.usado), r1(x.faltan), x.prox != null && !m.sinHoro ? r1(x.prox) : ''] : [x ? x.N : '', '', '', '']; })(), m.obs || '']);
  });
  sh(a1, [10, 26, 14, 16, 18, 13, 13, 15, 10, 15, 15, 20, 15, 15, 14, 18, 18, 20, 30], 'Equipos');
  // horas por semana y día
  const a2 = [['Semana (lunes)', 'Semana', 'Interno', 'Equipo', ...DIAS.map((d) => d + ' (h)'), 'Horas semana', 'Horas de parada', 'Horas de mantenimiento', 'Disponibilidad %', 'Observaciones']];
  maqH().slice().sort((a, b) => b.semana.localeCompare(a.semana) || maqOrd(maqDe(a.maq) || {}, maqDe(b.maq) || {})).forEach((r) => {
    const m = maqDe(r.maq) || {}, L = lecturas(r.maq), t = horasSem(r.maq, r.semana), p = evSem(r.maq, r.semana, 'parada'), mm = evSem(r.maq, r.semana, 'mantenimiento'), d = dispo(t, p + mm);
    a2.push([r.semana, semTxt(r.semana), m.interno || '', m.descripcion || '', ...diasSem(r.semana).map((f) => r1(horasDia(r.maq, f, L))), r1(t), r1(p), r1(mm), d == null ? '' : r1(d * 100), r.obs || '']);
  });
  sh(a2, [13, 22, 10, 26, 8, 8, 8, 8, 8, 8, 8, 13, 15, 20, 15, 30], 'Horas semanales');
  // lecturas diarias de horómetro: inicio (= fin de la jornada anterior), fin y horas
  const a4 = [['Fecha', 'Interno', 'Equipo', 'Horómetro inicio', 'Horómetro fin', 'Horas trabajadas', 'Período sin registro diario desde']];
  ms.forEach((m) => {
    if (m.sinHoro) { maqH().filter((r) => r.maq === m.id).forEach((r) => Object.entries(r.hs || {}).forEach(([f, v]) => a4.push([f, m.interno, m.descripcion, '', '', r1(Number(v) || 0), (r.per || {})[f] || '']))); return; }
    const L = lecturas(m.id); L.forEach(([f, v]) => { const a = horoAntes(m.id, f, L); a4.push([f, m.interno, m.descripcion, a == null ? '' : a, v, a == null ? '' : r1(Math.max(0, v - a)), perDe(m.id, f) || '']); });
  });
  a4.sort((x, y) => (x[0] === 'Fecha' ? -1 : y[0] === 'Fecha' ? 1 : y[0].localeCompare(x[0]) || String(x[1]).localeCompare(String(y[1]), 'es', { numeric: true })));
  sh(a4, [12, 10, 26, 17, 15, 17, 28], 'Horómetro por jornada');
  const a3 = [['Fecha', 'Semana (lunes)', 'Interno', 'Equipo', 'Tipo', 'Horas', 'Motivo', 'Observaciones']];
  maqE().slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).forEach((e) => { const m = maqDe(e.maq) || {}; a3.push([e.fecha, lunesDe(e.fecha), m.interno || '', m.descripcion || '', MAQ_TIPO[e.tipo][0], r1(Number(e.horas) || 0), e.motivo || '', e.obs || '']); });
  sh(a3, [12, 14, 10, 26, 15, 8, 28, 40], 'Paradas y mantenimientos');
  const p = await window.api.saveBinary(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }), `Maquinaria de obra ${today()}.xlsx`, 'xlsx', 'Excel');
  if (p) toast('Excel exportado', { action: ['Abrir', () => window.api.openPath(p)] });
}
function printMaqSemana(sem) {
  const ms = maqL().filter((m) => m.activa !== false || regDe(m.id, sem)).sort(maqOrd);
  if (!ms.length) { toast('No hay equipos cargados', { err: true }); return; }
  let tt = 0, tp = 0, tm = 0;
  const ds = diasSem(sem);
  let h = prHead(`Maquinaria de obra · semana del ${semTxt(sem)}`) + `<div class="card"><table class="tbl stk"><thead><tr><th>Interno</th><th>Equipo</th>${ds.map((d, k) => `<th class="n">${DIAS[k]} ${d.slice(8)}</th>`).join('')}<th class="n">Semana</th><th class="n">Parada</th><th class="n">Mant.</th><th class="n">Disponib.</th><th>Observaciones</th></tr></thead><tbody>`;
  ms.forEach((m) => {
    const r = regDe(m.id, sem) || {}, L = lecturas(m.id), t = horasSem(m.id, sem), p = evSem(m.id, sem, 'parada'), mm = evSem(m.id, sem, 'mantenimiento'), d = dispo(t, p + mm); tt += t; tp += p; tm += mm;
    h += `<tr><td><b>${esc(m.interno)}</b></td><td>${esc(m.descripcion)}<br><span style="font-size:7pt;color:#666">${esc([m.marca, m.modelo].filter(Boolean).join(' '))}</span></td>
      ${ds.map((f) => { const hd = horasDia(m.id, f, L), v = (r.lect || {})[f]; return `<td class="n">${hd ? `<b>${fmt(hd, 1)}</b>` : ''}${!m.sinHoro && !vacio(v) ? `<br><span style="font-size:6.5pt;color:#666">${fmt(Number(v), 1)}</span>` : ''}</td>`; }).join('')}
      <td class="n"><b>${fmt(t, 1)}</b></td><td class="n">${p ? fmt(p, 1) : ''}</td><td class="n">${mm ? fmt(mm, 1) : ''}</td><td class="n">${d == null ? '' : fmt(d * 100) + ' %'}</td><td style="white-space:normal">${esc(r.obs || '')}</td></tr>`;
  });
  h += `<tr><td colspan="9"><b>Total</b></td><td class="n"><b>${fmt(tt, 1)}</b></td><td class="n"><b>${fmt(tp, 1)}</b></td><td class="n"><b>${fmt(tm, 1)}</b></td><td class="n">${dispo(tt, tp + tm) == null ? '' : fmt(dispo(tt, tp + tm) * 100) + ' %'}</td><td></td></tr></tbody></table>
    <p class="muted" style="font-size:8pt;margin:6px 0 0">Por día: horas trabajadas y, debajo, el horómetro al fin de la jornada (el inicio de cada jornada es el fin de la anterior).</p></div>`;
  const evs = maqE().filter((e) => enSemana(e.fecha, sem)).sort((a, b) => a.fecha.localeCompare(b.fecha));
  if (evs.length) h += `<div class="card"><h3>Paradas y mantenimientos de la semana</h3><table class="tbl stk"><thead><tr><th>Fecha</th><th>Interno</th><th>Equipo</th><th>Tipo</th><th class="n">Horas</th><th>Motivo</th><th>Observaciones</th></tr></thead><tbody>${evs.map((e) => { const m = maqDe(e.maq) || {}; return `<tr><td>${fechaCorta(e.fecha)}</td><td><b>${esc(m.interno || '')}</b></td><td>${esc(m.descripcion || '')}</td><td>${MAQ_TIPO[e.tipo][0]}</td><td class="n">${fmt(e.horas, 1)}</td><td>${esc(e.motivo || '')}</td><td style="white-space:normal">${esc(e.obs || '')}</td></tr>`; }).join('')}</tbody></table></div>`;
  h += `<p class="muted" style="font-size:9pt">Disponibilidad = horas trabajadas / (trabajadas + paradas + mantenimiento).</p>`;
  printHTML(h, `Maquinaria semana ${sem}.pdf`, true);
}
