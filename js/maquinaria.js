/* PSFV-OBE II · Maquinaria de obra: equipos, horas semanales (horómetro) y registro de paradas y mantenimientos.
   Datos: S.maquinas [{id, interno, descripcion, marca, modelo, serie, propiedad, activa, obs}]
          S.maqHoras  [{id: maq|semana, maq, semana (lunes AAAA-MM-DD), horoIni, horoFin, horas, obs}]
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
// horas trabajadas de un registro: por horómetro si están ambos, si no la cargada a mano
const hTrab = (r) => (r ? (Number(r.horoFin) > 0 && Number(r.horoIni) >= 0 && r.horoIni !== '' && r.horoIni != null && Number(r.horoFin) >= Number(r.horoIni) ? Number(r.horoFin) - Number(r.horoIni) : Number(r.horas) || 0) : 0);
const regDe = (maq, sem) => maqH().find((r) => r.maq === maq && r.semana === sem);
const evSem = (maq, sem, tipo) => maqE().filter((e) => (!maq || e.maq === maq) && enSemana(e.fecha, sem) && (!tipo || e.tipo === tipo)).reduce((a, e) => a + (Number(e.horas) || 0), 0);
const dispo = (t, p) => (t + p > 0 ? t / (t + p) : null);
// último horómetro conocido antes de una semana (para proponer el inicial)
function horoPrevio(maq, sem) {
  const rs = maqH().filter((r) => r.maq === maq && r.semana < sem && Number(r.horoFin) > 0).sort((a, b) => b.semana.localeCompare(a.semana));
  return rs.length ? Number(rs[0].horoFin) : null;
}

// ======================= HORAS SEMANALES =======================
function vMaq(el) {
  const sem = (ui.maqSem = ui.maqSem || lunesDe(today()));
  const ro = window.READONLY;
  actions([...(ro ? [] : [['+ Parada / mantenimiento', 'btn acc', () => editEvento(null)], ['+ Equipo', 'btn', () => editMaquina(null)]]),
    ['Exportar Excel', 'btn', exportMaq], ['PDF de la semana', 'btn', () => printMaqSemana(sem)]]);
  const ms = maqL().filter((m) => m.activa !== false || regDe(m.id, sem)).sort(maqOrd);
  const tot = { t: 0, p: 0, m: 0 };
  ms.forEach((m) => { tot.t += hTrab(regDe(m.id, sem)); tot.p += evSem(m.id, sem, 'parada'); tot.m += evSem(m.id, sem, 'mantenimiento'); });
  const dg = dispo(tot.t, tot.p + tot.m);
  let h = `<div class="tools"><button class="btn" id="semAnt">◀</button><b style="min-width:220px;text-align:center">Semana del ${semTxt(sem)}</b><button class="btn" id="semSig">▶</button>
    <input type="date" id="semFecha" value="${sem}" title="Ir a la semana de esta fecha"><button class="btn ghost" id="semHoy">Esta semana</button><span class="sp"></span>
    <span class="muted">${ms.length} equipo${ms.length === 1 ? '' : 's'}</span></div>
    <div class="kpis k4" style="margin-bottom:14px">${kpi('Horas trabajadas', tot.t, 'h', 1)}${kpi('Horas de parada', tot.p, 'h', 1)}${kpi('Horas de mantenimiento', tot.m, 'h', 1)}
      <div class="kpi"><span>Disponibilidad</span><b>${dg == null ? '–' : fmt(dg * 100)}<small>${dg == null ? '' : '%'}</small></b></div></div>`;
  if (!maqL().length) {
    el.innerHTML = h + `<div class="empty"><b>Todavía no hay equipos cargados</b><p>Cargá cada máquina con su número de interno, descripción, marca y modelo.</p>${ro ? '' : '<button class="btn pri" id="maqPrim">+ Cargar el primer equipo</button>'}</div>`;
    const b = $('#maqPrim'); if (b) b.onclick = () => editMaquina(null);
    bindSem(el); return;
  }
  h += `<div class="tblwrap"><table class="tbl maqt"><thead><tr><th>Interno</th><th>Equipo</th><th class="n">Horómetro inicial</th><th class="n">Horómetro final</th><th class="n">Horas trabajadas</th>
    <th class="n">Parada (h)</th><th class="n">Mant. (h)</th><th class="n">Disponib.</th><th>Observaciones</th><th></th></tr></thead><tbody>`;
  ms.forEach((m) => {
    const r = regDe(m.id, sem) || {}, prev = horoPrevio(m.id, sem), t = hTrab(r), p = evSem(m.id, sem, 'parada'), mm = evSem(m.id, sem, 'mantenimiento'), d = dispo(t, p + mm);
    const porHoro = Number(r.horoFin) > 0 && r.horoIni !== '' && r.horoIni != null;
    const evs = maqE().filter((e) => e.maq === m.id && enSemana(e.fecha, sem));
    h += `<tr data-id="${m.id}"><td class="mono"><b>${esc(m.interno)}</b></td><td>${esc(m.descripcion)}<div class="muted" style="font-size:11.5px">${esc([m.marca, m.modelo].filter(Boolean).join(' '))}</div></td>
      <td class="n"><input type="number" step="0.1" min="0" class="mi" data-f="horoIni" value="${r.horoIni ?? ''}" placeholder="${prev != null ? fmt(prev, 1) : ''}" ${ro ? 'disabled' : ''}></td>
      <td class="n"><input type="number" step="0.1" min="0" class="mi" data-f="horoFin" value="${r.horoFin ?? ''}" ${ro ? 'disabled' : ''}></td>
      <td class="n"><input type="number" step="0.5" min="0" class="mi" data-f="horas" value="${porHoro ? fmt(t, 1).replace(/\./g, '').replace(',', '.') : r.horas ?? ''}" ${porHoro || ro ? 'disabled' : ''} title="${porHoro ? 'Calculado por horómetro' : 'Horas trabajadas en la semana'}"></td>
      <td class="n">${p ? `<b style="color:var(--bad)">${fmt(p, 1)}</b>` : '–'}</td><td class="n">${mm ? `<b style="color:var(--warn)">${fmt(mm, 1)}</b>` : '–'}</td>
      <td class="n">${d == null ? '–' : `<span class="pill ${d >= 0.85 ? 'p-done' : d >= 0.6 ? 'p-prov' : 'p-bad'}">${fmt(d * 100)} %</span>`}</td>
      <td><input type="text" class="mi mo" data-f="obs" value="${esc(r.obs || '')}" ${ro ? 'disabled' : ''}>${evs.length ? `<div class="muted" style="font-size:11.5px;margin-top:3px">${evs.map((e) => `${MAQ_TIPO[e.tipo][0]} ${fechaCorta(e.fecha)}: ${esc(e.motivo)} (${fmt(e.horas, 1)} h)`).join(' · ')}</div>` : ''}</td>
      <td style="white-space:nowrap">${ro ? '' : `<button class="btn sm acc" data-a="ev" title="Registrar parada o mantenimiento">Parada / mant.</button> <button class="btn sm ghost" data-a="ed" title="Editar equipo">✎</button>`}</td></tr>`;
  });
  h += `</tbody></table></div><p class="hint">Cargá el horómetro inicial y final de la semana (el inicial se propone con el final de la semana anterior) o, si el equipo no tiene horómetro, las horas trabajadas. Las paradas y mantenimientos se registran por día con sus horas y motivo; la disponibilidad es horas trabajadas / (trabajadas + paradas + mantenimiento).</p>`;
  el.innerHTML = h;
  bindSem(el);
  if (ro) return;
  $$('tbody tr', el).forEach((tr) => {
    const id = tr.dataset.id;
    $$('.mi', tr).forEach((inp) => {
      // el inicial sugerido se toma al entrar al campo vacío
      if (inp.dataset.f === 'horoIni') inp.onfocus = () => { if (inp.value === '' && inp.placeholder) inp.value = inp.placeholder.replace(/\./g, '').replace(',', '.'); };
      inp.onchange = () => {
        const f = inp.dataset.f; let r = regDe(id, sem);
        if (!r) { r = { id: `${id}|${sem}`, maq: id, semana: sem, _o: Date.now() }; maqH().push(r); }
        r[f] = f === 'obs' ? inp.value.trim() : inp.value === '' ? '' : Number(inp.value);
        if ((f === 'horoIni' || f === 'horoFin') && Number(r.horoFin) > 0 && r.horoIni !== '' && Number(r.horoFin) < Number(r.horoIni)) toast('El horómetro final es menor que el inicial', { err: true });
        commit(`${maqDe(id).interno}: semana ${fechaCorta(sem)} actualizada`);
      };
    });
    const b1 = tr.querySelector('[data-a=ev]'); if (b1) b1.onclick = () => editEvento(null, id, sem);
    const b2 = tr.querySelector('[data-a=ed]'); if (b2) b2.onclick = () => editMaquina(id);
  });
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
    <div class="tblwrap"><table class="tbl"><thead><tr><th>Interno</th><th>Descripción</th><th>Marca</th><th>Modelo</th><th>N° serie / dominio</th><th>Propiedad</th>
    <th class="n">Horas trabajadas</th><th class="n">Paradas (h)</th><th class="n">Mant. (h)</th><th class="n">Disponib.</th><th>Último horómetro</th><th>Estado</th><th></th></tr></thead><tbody>`;
  ms.forEach((m) => {
    const rs = maqH().filter((r) => r.maq === m.id), t = rs.reduce((a, r) => a + hTrab(r), 0);
    const ev = maqE().filter((e) => e.maq === m.id), p = ev.filter((e) => e.tipo === 'parada').reduce((a, e) => a + (Number(e.horas) || 0), 0), mm = ev.filter((e) => e.tipo === 'mantenimiento').reduce((a, e) => a + (Number(e.horas) || 0), 0);
    const ult = rs.filter((r) => Number(r.horoFin) > 0).sort((a, b) => b.semana.localeCompare(a.semana))[0], d = dispo(t, p + mm);
    h += `<tr data-id="${m.id}"><td class="mono"><b>${esc(m.interno)}</b></td><td>${esc(m.descripcion)}${m.obs ? ` <span title="${esc(m.obs)}">ⓘ</span>` : ''}</td><td>${esc(m.marca || '')}</td><td>${esc(m.modelo || '')}</td><td>${esc(m.serie || '')}</td><td>${esc(m.propiedad || '')}</td>
      <td class="n">${fmt(t, 1)}</td><td class="n">${p ? fmt(p, 1) : '–'}</td><td class="n">${mm ? fmt(mm, 1) : '–'}</td><td class="n">${d == null ? '–' : fmt(d * 100) + ' %'}</td>
      <td>${ult ? `${fmt(Number(ult.horoFin), 1)} h <span class="muted">(${fechaCorta(ult.semana)})</span>` : '–'}</td><td>${m.activa === false ? '<span class="pill p-prov">de baja</span>' : '<span class="pill p-done">en obra</span>'}</td>
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
      <label class="chk"><input type="checkbox" name="activa" ${m.activa !== false ? 'checked' : ''}> En obra (sacalo cuando el equipo se retira)</label>
      <label class="full">Observaciones<input type="text" name="obs" value="${esc(m.obs || '')}"></label></div>`,
    buttons: [...(nuevo ? [] : [['Eliminar', 'btn danger', () => 'del']]), ['Cancelar', 'btn', () => null], ['Guardar', 'btn pri', (box) => {
      const g = (n) => $(`[name=${n}]`, box).value.trim();
      if (!g('interno') || !g('descripcion')) { toast('Completá el N° de interno y la descripción', { err: true }); return false; }
      if (maqL().some((x) => x !== m && String(x.interno).toLowerCase() === g('interno').toLowerCase())) { toast(`Ya existe un equipo con el interno ${g('interno')}`, { err: true }); return false; }
      Object.assign(m, { interno: g('interno'), descripcion: g('descripcion'), marca: g('marca'), modelo: g('modelo'), serie: g('serie'), propiedad: g('propiedad'), activa: $('[name=activa]', box).checked, obs: g('obs') });
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
      <label class="full">Observaciones<input type="text" name="obs" value="${esc(e.obs || '')}" placeholder="detalle, repuestos, quién lo hizo…"></label></div>`,
    buttons: [...(nuevo ? [] : [['Eliminar', 'btn danger', () => 'del']]), ['Cancelar', 'btn', () => null], ['Guardar', 'btn pri', (box) => {
      const g = (n) => $(`[name=${n}]`, box).value.trim();
      if (!g('maq') || !g('fecha') || !(Number(g('horas')) > 0) || !g('motivo')) { toast('Completá equipo, fecha, horas y motivo', { err: true }); return false; }
      Object.assign(e, { maq: g('maq'), tipo: g('tipo'), fecha: g('fecha'), horas: Number(g('horas')), motivo: g('motivo'), obs: g('obs') });
      return 'ok';
    }]],
  });
  { const box = $('#modal .mbox'), t = $('[name=tipo]', box), dl = $('#evMot', box);
    const upd = () => { dl.innerHTML = MAQ_MOT[t.value].map((x) => `<option value="${x}">`).join(''); };
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
  const a1 = [['Interno', 'Descripción', 'Marca', 'Modelo', 'N° serie / dominio', 'Propiedad', 'Estado', 'Horas trabajadas', 'Horas de parada', 'Horas de mantenimiento', 'Disponibilidad %', 'Último horómetro', 'Observaciones']];
  ms.forEach((m) => {
    const rs = maqH().filter((r) => r.maq === m.id), t = rs.reduce((a, r) => a + hTrab(r), 0), ev = maqE().filter((e) => e.maq === m.id);
    const p = ev.filter((e) => e.tipo === 'parada').reduce((a, e) => a + (Number(e.horas) || 0), 0), mm = ev.filter((e) => e.tipo === 'mantenimiento').reduce((a, e) => a + (Number(e.horas) || 0), 0);
    const ult = rs.filter((r) => Number(r.horoFin) > 0).sort((a, b) => b.semana.localeCompare(a.semana))[0], d = dispo(t, p + mm);
    a1.push([m.interno, m.descripcion, m.marca || '', m.modelo || '', m.serie || '', m.propiedad || '', m.activa === false ? 'De baja' : 'En obra', r1(t), r1(p), r1(mm), d == null ? '' : r1(d * 100), ult ? Number(ult.horoFin) : '', m.obs || '']);
  });
  sh(a1, [10, 26, 14, 16, 18, 13, 10, 15, 15, 20, 15, 15, 30], 'Equipos');
  const a2 = [['Semana (lunes)', 'Semana', 'Interno', 'Equipo', 'Horómetro inicial', 'Horómetro final', 'Horas trabajadas', 'Horas de parada', 'Horas de mantenimiento', 'Disponibilidad %', 'Observaciones']];
  maqH().slice().sort((a, b) => b.semana.localeCompare(a.semana) || maqOrd(maqDe(a.maq) || {}, maqDe(b.maq) || {})).forEach((r) => {
    const m = maqDe(r.maq) || {}, t = hTrab(r), p = evSem(r.maq, r.semana, 'parada'), mm = evSem(r.maq, r.semana, 'mantenimiento'), d = dispo(t, p + mm);
    a2.push([r.semana, semTxt(r.semana), m.interno || '', m.descripcion || '', r.horoIni ?? '', r.horoFin ?? '', r1(t), r1(p), r1(mm), d == null ? '' : r1(d * 100), r.obs || '']);
  });
  sh(a2, [13, 22, 10, 26, 16, 15, 15, 15, 20, 15, 30], 'Horas semanales');
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
  let h = prHead(`Maquinaria de obra · semana del ${semTxt(sem)}`) + `<div class="card"><table class="tbl stk"><thead><tr><th>Interno</th><th>Equipo</th><th>Marca / modelo</th><th class="n">Horóm. inicial</th><th class="n">Horóm. final</th><th class="n">Trabajadas</th><th class="n">Parada</th><th class="n">Mant.</th><th class="n">Disponib.</th><th>Observaciones</th></tr></thead><tbody>`;
  ms.forEach((m) => {
    const r = regDe(m.id, sem) || {}, t = hTrab(r), p = evSem(m.id, sem, 'parada'), mm = evSem(m.id, sem, 'mantenimiento'), d = dispo(t, p + mm); tt += t; tp += p; tm += mm;
    h += `<tr><td><b>${esc(m.interno)}</b></td><td>${esc(m.descripcion)}</td><td>${esc([m.marca, m.modelo].filter(Boolean).join(' '))}</td><td class="n">${r.horoIni !== '' && r.horoIni != null ? fmt(r.horoIni, 1) : ''}</td><td class="n">${Number(r.horoFin) > 0 ? fmt(r.horoFin, 1) : ''}</td>
      <td class="n"><b>${fmt(t, 1)}</b></td><td class="n">${p ? fmt(p, 1) : ''}</td><td class="n">${mm ? fmt(mm, 1) : ''}</td><td class="n">${d == null ? '' : fmt(d * 100) + ' %'}</td><td style="white-space:normal">${esc(r.obs || '')}</td></tr>`;
  });
  h += `<tr><td colspan="5"><b>Total</b></td><td class="n"><b>${fmt(tt, 1)}</b></td><td class="n"><b>${fmt(tp, 1)}</b></td><td class="n"><b>${fmt(tm, 1)}</b></td><td class="n">${dispo(tt, tp + tm) == null ? '' : fmt(dispo(tt, tp + tm) * 100) + ' %'}</td><td></td></tr></tbody></table></div>`;
  const evs = maqE().filter((e) => enSemana(e.fecha, sem)).sort((a, b) => a.fecha.localeCompare(b.fecha));
  if (evs.length) h += `<div class="card"><h3>Paradas y mantenimientos de la semana</h3><table class="tbl stk"><thead><tr><th>Fecha</th><th>Interno</th><th>Equipo</th><th>Tipo</th><th class="n">Horas</th><th>Motivo</th><th>Observaciones</th></tr></thead><tbody>${evs.map((e) => { const m = maqDe(e.maq) || {}; return `<tr><td>${fechaCorta(e.fecha)}</td><td><b>${esc(m.interno || '')}</b></td><td>${esc(m.descripcion || '')}</td><td>${MAQ_TIPO[e.tipo][0]}</td><td class="n">${fmt(e.horas, 1)}</td><td>${esc(e.motivo || '')}</td><td style="white-space:normal">${esc(e.obs || '')}</td></tr>`; }).join('')}</tbody></table></div>`;
  h += `<p class="muted" style="font-size:9pt">Disponibilidad = horas trabajadas / (trabajadas + paradas + mantenimiento).</p>`;
  printHTML(h, `Maquinaria semana ${sem}.pdf`, true);
}
