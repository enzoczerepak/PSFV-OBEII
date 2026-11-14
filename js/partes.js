/* PSFV-OBE II · Partes de campo (app de capataces) y aprobación en oficina. */
// ======================= PARTES DE CAMPO =======================
function recibirParte(p, autor) {
  S.partes = S.partes || [];
  if (!p || !p.id || S.partes.some((x) => x.id === p.id)) return;
  S.partes.push(Object.assign({}, p, { autor, recibido: new Date().toISOString(), estado: 'pendiente', _o: Date.now() }));
  commit(`Parte de campo recibido de ${autor}`);
  toast(`📱 Nuevo parte de campo de ${autor}: ${parteTxt(p)}`, { ms: 9000, action: ['Ver', () => go('partes')] });
  badgePartes();
}
const parteTxt = (p) => p.tipo === 'fund' ? `${p.sts} · ${p.n} ${p.accion === 'fin' ? 'terminada' : 'iniciada'}` : p.tipo === 'sala' ? `Edificio O&M · ${p.n}${p.els && p.els[0] !== 'G' ? ' (' + p.els.join(', ') + ')' : ''} ${p.accion === 'fin' ? 'terminada' : 'iniciada'}` : p.tipo === 'tendido' ? `${p.designacion} · ${p.fases.length} conductor${p.fases.length > 1 ? 'es' : ''}` : p.tipo === 'pat' ? `PAT ${p.titulo} · ${fmt(p.metros, 1)} m` : p.tipo === 'zanja' ? `zanja ${p.titulo} · ${fmt(p.largo, 1)} m` : 'observación';
function badgePartes() {
  const n = (S.partes || []).filter((p) => p.estado === 'pendiente').length;
  const b = $('#nav button[data-view="partes"]'); if (!b) return;
  let i = $('.nbadge', b); if (!i) { i = document.createElement('i'); i.className = 'nbadge'; b.appendChild(i); }
  i.textContent = n || ''; i.style.display = n ? '' : 'none';
}
function vPartes(el) {
  const f = ui.pf || 'pend';
  const lista = (S.partes || []).slice().sort((a, b) => String(b.recibido).localeCompare(String(a.recibido))).filter((p) => (f === 'pend' ? p.estado === 'pendiente' : f === 'ok' ? p.estado !== 'pendiente' : true));
  const pend = (S.partes || []).filter((p) => p.estado === 'pendiente');
  actions(pend.length > 1 && !window.READONLY ? [['Aprobar todos los válidos', 'btn pri', aprobarTodos]] : []);
  const TIPO = { tendido: ['Tendido', '#00939a'], pat: ['PAT', '#6a5acd'], zanja: ['Zanja', '#c97b12'], fund: ['Civil · STS', '#f2b33d'], sala: ['Civil · O&M', '#b294ff'], obs: ['Observación', '#7a8aa3'] };
  let h = `<div class="tools"><div class="seg" id="pF"><button data-v="pend">Pendientes (${pend.length})</button><button data-v="ok">Resueltos</button><button data-v="all">Todos</button></div></div>`;
  if (!lista.length) h += `<div class="card empty"><b>${f === 'pend' ? 'No hay partes pendientes' : 'Sin partes'}</b>Los capataces cargan desde el celular en <b>campo.html</b>, en el mismo sitio del visor. Esta PC los recibe cada minuto si el programa está abierto.</div>`;
  lista.forEach((p) => {
    const t = TIPO[p.tipo] || ['', '#999'], pe = p.estado === 'pendiente' && !window.READONLY;
    let cuerpo = '';
    if (p.tipo === 'tendido') {
      const rc = R.circuitos.find((c) => c.id === p.circuito);
      const bobs = rc ? R.bobinas.filter((b) => b.key === rc.key) : [];
      cuerpo = `<div class="muted">${esc(p.desde)} → ${esc(p.hasta)}${rc ? ` · ${rc.cat} ${rc.seccion} mm² · lista ${fmt(rc.lenFase, 1)} m/conductor` : ' · <b style="color:var(--bad)">circuito inexistente</b>'}</div>
        <table class="tbl dtbl pt-f"><thead><tr><th>Fase</th><th>Bobina</th><th class="num">Metros</th><th class="num">Dif. lista</th><th>Estado actual</th></tr></thead><tbody>${p.fases.map((x, i) => { const ya = rc && rc.fasesInfo[x.f] && rc.fasesInfo[x.f].estado === 'ejecutado'; const dif = rc ? x.metros - rc.lenFase : 0;
          return `<tr data-i="${i}"><td><b>${x.f === 'C' ? 'Cu' : x.f}</b></td><td>${pe ? `<select class="pb">${bobs.map((b) => `<option ${b.codigo === x.bobina ? 'selected' : ''}>${esc(b.codigo)}</option>`).join('')}${bobs.some((b) => b.codigo === x.bobina) ? '' : `<option selected value="">${esc(x.bobina)} (no existe)</option>`}</select>` : esc(x.bobina)}</td>
            <td class="num">${pe ? `<input type="number" step="0.1" class="pm" value="${x.metros}" style="width:90px">` : fmt(x.metros, 1)}</td><td class="num ${Math.abs(dif) > 0.05 * (rc ? rc.lenFase : 1) ? 'tneg' : ''}">${rc ? (dif >= 0 ? '+' : '') + fmt(dif, 1) : ''}</td><td>${ya ? '<span class="kst" style="--c:#d64545">ya registrada</span>' : '<span class="muted">sin registrar</span>'}</td></tr>`; }).join('')}</tbody></table>`;
    } else if (p.tipo === 'pat') {
      const rz = R.zlist.find((z) => z.id === p.zanja), bobs = rz && rz.pat ? R.bobinas.filter((b) => b.key === rz.pat.key) : [];
      cuerpo = `<div class="muted">Zanja ${esc(p.titulo)}${rz ? ` · largo ${fmt(rz.largo, 1)} m · PAT ${rz.pat ? rz.pat.seccion + ' mm²' : '–'}${rz.pat && rz.pat.completo ? ' · <b style="color:var(--bad)">ya registrada</b>' : ''}` : ' · <b style="color:var(--bad)">zanja inexistente</b>'}</div>
        <div class="pt-row">Metros ${pe ? `<input type="number" step="0.1" class="pm" value="${p.metros}" style="width:100px">` : `<b>${fmt(p.metros, 1)}</b>`} &nbsp; Bobina ${pe ? `<select class="pb"><option value="">Sin bobina registrada</option>${bobs.map((b) => `<option ${b.codigo === p.bobina ? 'selected' : ''}>${esc(b.codigo)}</option>`).join('')}</select>` : `<b>${esc(p.bobina || 'sin bobina')}</b>`}</div>`;
    } else if (p.tipo === 'zanja') {
      const rz = R.zlist.find((z) => z.id === p.zanja);
      cuerpo = `<div class="muted">Zanja ${esc(p.titulo)}${rz ? ` · largo actual ${fmt(rz.largo, 1)} m (plano)` : ''}</div><div class="pt-row">Largo real ${pe ? `<input type="number" step="0.1" class="pm" value="${p.largo}" style="width:100px">` : `<b>${fmt(p.largo, 1)} m</b>`}${rz ? ` <span class="muted">dif. ${fmt(p.largo - rz.largo, 1)} m</span>` : ''}</div>`;
    } else if (p.tipo === 'fund') {
      const a = (((S.fundaciones || {})[p.sts]) || {})[p.etapa] || {};
      cuerpo = `<div class="pt-row"><b>${esc(p.n)}</b> · ${p.accion === 'fin' ? 'se terminó' : 'se inició'} el ${fechaCorta(p.fecha)} <span class="muted">· hoy figura ${a.ok ? 'terminada' : a.ini ? 'en curso desde ' + fechaCorta(a.ini) : 'sin registro'}</span></div>`;
    } else if (p.tipo === 'sala') {
      const e = SALA_ETN[p.etapa], els = p.els || [], ya = els.filter((x) => salaAv(p.etapa, x).ok);
      cuerpo = `<div class="pt-row"><b>${esc(p.n)}</b>${els[0] !== 'G' ? ` · ${els.map(esc).join(', ')}` : ''} · ${p.accion === 'fin' ? 'se terminó' : 'se inició'} el ${fechaCorta(p.fecha)}${p.pct ? ` · avance ${p.pct} %` : ''}${ya.length ? ` <span class="muted">· ya figuraban terminadas: ${ya.map(esc).join(', ')}</span>` : ''}${!e ? ' <b style="color:var(--bad)">etapa inexistente</b>' : ''}</div>`;
    } else cuerpo = p.titulo ? `<div class="muted">Sobre ${p.titulo === 'Frente civil' ? '' : 'zanja '}${esc(p.titulo)}</div>` : '';
    h += `<div class="card ptc ${p.estado}" data-id="${p.id}"><div class="pth"><span class="kst" style="--c:${t[1]}">${t[0]}</span><b>${esc(p.tipo === 'tendido' ? p.designacion : p.tipo === 'fund' ? p.sts : p.tipo === 'sala' ? 'Edificio O&M' : p.titulo || '')}</b><span class="muted">${esc(p.autor)} · ${fechaCorta(p.fecha)} · recibido ${new Date(p.recibido).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
        <span class="sp"></span>${p.estado === 'pendiente' ? '<span class="kst" style="--c:#1d5fa8">pendiente</span>' : p.estado === 'aprobado' ? '<span class="kst" style="--c:#2f9e5b">aprobado</span>' : `<span class="kst" style="--c:#d64545">rechazado</span>`}</div>
      ${cuerpo}${p.obs ? `<div class="pt-obs">«${esc(p.obs)}»</div>` : ''}${p.motivo ? `<div class="muted">Motivo: ${esc(p.motivo)}</div>` : ''}
      ${pe ? `<div class="plact"><button class="btn sm danger" data-rech="${p.id}">Rechazar</button><button class="btn sm pri" data-apr="${p.id}">${p.tipo === 'obs' ? 'Marcar como vista' : 'Aprobar y registrar'}</button></div>` : ''}</div>`;
  });
  el.innerHTML = h;
  segBind('#pF', f, (v) => { ui.pf = v; render(false); });
  $$('[data-apr]', el).forEach((b) => { b.onclick = () => aprobarParte(b.dataset.apr, b.closest('.ptc')); });
  $$('[data-rech]', el).forEach((b) => { b.onclick = () => rechazarParte(b.dataset.rech); });
  badgePartes();
}
// aplica un parte; devuelve texto de error si no se puede
function aplicarParte(p, box) {
  if (p.tipo === 'tendido') {
    const c = S.circuitos.find((x) => x.id === p.circuito), rc = R.circuitos.find((x) => x.id === p.circuito); if (!c || !rc) return 'el circuito no existe';
    const fases = p.fases.map((x, i) => { const tr = box && $(`tr[data-i="${i}"]`, box); return { f: x.f, bobina: tr ? $('.pb', tr).value : x.bobina, metros: tr ? Number($('.pm', tr).value) : x.metros }; });
    for (const x of fases) { if (!x.bobina || !R.bobinas.some((b) => b.key === rc.key && b.codigo === x.bobina)) return `la bobina de ${x.f} no existe para ${rc.seccion} mm²`; if (!(x.metros > 0)) return `faltan los metros de ${x.f}`; }
    c.real = Object.assign({}, c.real); fases.forEach((x) => { c.real[x.f] = { bobina: x.bobina, metros: Math.round(x.metros * 100) / 100, fecha: p.fecha, por: p.autor }; });
    const z = S.zanjas.find((zz) => zz.id === c.zanjaId); if (z && z.estado === 'no abierta') z.estado = 'abierta';
    p.fases = fases; return null;
  }
  if (p.tipo === 'pat') {
    const rz = R.zlist.find((z) => z.id === p.zanja); if (!rz || !rz.pat) return 'la zanja no existe o no lleva PAT';
    const m = box ? Number($('.pm', box).value) : p.metros, b = box ? $('.pb', box).value : p.bobina; if (!(m > 0)) return 'faltan los metros';
    const pc = S.circuitos.find((x) => x.id === rz.pat.id); pc.real = { C: b ? { bobina: b, metros: m, fecha: p.fecha, por: p.autor } : { sinBobina: true, metros: m, fecha: p.fecha, por: p.autor } };
    p.metros = m; p.bobina = b; return null;
  }
  // frente civil: inicio o fin de una etapa (sin pisar una fecha de inicio anterior)
  const marca = (v, ac, f, pct) => { v = Object.assign({}, v); if (ac === 'fin') { v.ok = true; v.fin = f; if (!v.ini || v.ini > f) v.ini = f; delete v.pct; } else { if (!v.ini || v.ini > f) v.ini = f; if (pct) v.pct = pct; } return v; };
  if (p.tipo === 'fund') {
    if (!ETN[p.etapa]) return 'la etapa no existe';
    S.fundaciones = S.fundaciones || {}; const o = (S.fundaciones[p.sts] = S.fundaciones[p.sts] || {});
    o[p.etapa] = marca(o[p.etapa], p.accion, p.fecha); return null;
  }
  if (p.tipo === 'sala') {
    if (!SALA_ETN[p.etapa]) return 'la etapa no existe';
    const A = salaS().av; (p.els || []).forEach((el) => { A[p.etapa + '|' + el] = marca(A[p.etapa + '|' + el], p.accion, p.fecha, p.pct); }); return null;
  }
  if (p.tipo === 'zanja') {
    const z = S.zanjas.find((x) => x.id === p.zanja); if (!z) return 'la zanja no existe';
    const m = box ? Number($('.pm', box).value) : p.largo; if (!(m > 0)) return 'falta el largo';
    if (z.largoPlano == null) z.largoPlano = z.largo; z.largo = m; z.largoReal = p.fecha; p.largo = m; return null;
  }
  return null;
}
function aprobarParte(id, box) {
  const p = S.partes.find((x) => x.id === id); if (!p) return;
  const err = aplicarParte(p, box); if (err) { toast('No se puede aprobar: ' + err, { err: true }); return; }
  p.estado = 'aprobado'; p.resuelto = new Date().toISOString();
  if (p.tipo !== 'tendido' && p.tipo !== 'pat' && p.tipo !== 'zanja') p.estado = 'aprobado';
  ui.flash = [id]; commit(`Parte de ${p.autor} aprobado: ${parteTxt(p)}`);
}
async function rechazarParte(id) {
  const p = S.partes.find((x) => x.id === id); if (!p) return;
  const m = await modal({ title: 'Rechazar parte', sub: `${esc(p.autor)} · ${esc(parteTxt(p))}`, body: `<div class="form"><label class="full">Motivo (lo ve el capataz)<input name="m" placeholder="Ej.: la bobina no corresponde, revisar metros"></label></div>`,
    buttons: [['Cancelar', 'btn', () => null], ['Rechazar', 'btn danger', (b) => $('[name=m]', b).value.trim() || 'sin motivo']] });
  if (!m) return;
  p.estado = 'rechazado'; p.motivo = m; p.resuelto = new Date().toISOString(); commit(`Parte de ${p.autor} rechazado`);
}
function aprobarTodos() {
  let ok = 0, no = 0;
  (S.partes || []).filter((p) => p.estado === 'pendiente').forEach((p) => { const box = $(`.ptc[data-id="${p.id}"]`); const e = aplicarParte(p, box); if (e) no++; else { p.estado = 'aprobado'; p.resuelto = new Date().toISOString(); ok++; } });
  commit(`${ok} partes aprobados${no ? ` · ${no} quedaron pendientes por datos inválidos` : ''}`);
}
