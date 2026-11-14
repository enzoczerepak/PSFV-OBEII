/* PSFV-OBE II · Usuarios con PIN y permisos por sección, e historial de cambios (quién cambió qué y cuándo).
   Sin usuarios cargados todo queda como antes (cualquiera edita). Con usuarios, cada PC pide entrar con nombre y PIN;
   el administrador define qué secciones puede editar cada uno. Los usuarios y el historial se sincronizan en la red. */
window.VISOR = !!window.READONLY; // el visor web es de solo lectura siempre; READONLY pasa a depender también del permiso de cada vista
let USR = null;
const SECCIONES = [['general', 'General (partes, cronograma, lluvias)'], ['cables', 'Tendido de cables'], ['fo', 'Fibra óptica'], ['lmt', 'Línea aérea MT'], ['fundaciones', 'Fundaciones STS'], ['sala', 'Edificio O&M'], ['trk', 'Trackers (materiales, hincado, montaje)'], ['maqs', 'Maquinaria'], ['ajustes', 'Ajustes y usuarios']];
const ROLES = { admin: ['Administrador', 'Edita todo y maneja usuarios y ajustes'], edita: ['Carga datos', 'Edita las secciones que se le habiliten'], lectura: ['Solo consulta', 'Ve todo, no cambia nada'] };
const usrL = () => (S.usuarios = S.usuarios || []);
const usersOn = () => usrL().length > 0;
function secDe(v) {
  if (/^(BT|MT|PAT|LA)-/.test(v)) return 'cables';
  if (v === 'ajustes') return 'ajustes';
  v = (typeof MENU_ALIAS !== 'undefined' && MENU_ALIAS[v]) || v;
  for (const it of MENU) {
    if (Array.isArray(it)) { if (it[0] === v) return ['fo', 'lmt', 'fundaciones', 'sala'].includes(v) ? v : 'general'; }
    else if (it.items.some((x) => Array.isArray(x) && x[0] === v)) return it.s;
  }
  return 'general';
}
function puedeEditar(v) {
  if (window.VISOR) return false;
  if (!usersOn()) return true;
  if (!USR) return false;
  const u = usrL().find((x) => x.id === USR.id) || USR;
  if (u.rol === 'admin') return true;
  if (u.rol !== 'edita') return false;
  const s = secDe(v || view);
  return s !== 'ajustes' && (!(u.secciones || []).length || u.secciones.includes(s));
}
function aplicarPermiso(v) { window.READONLY = window.VISOR || !puedeEditar(v || view); }
async function pinHash(id, pin) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`obeii:${id}:${pin}`)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join(''); }

// ---------- entrar ----------
function usrPie() {
  const el = $('#usrState'); if (!el) return;
  if (window.VISOR || !usersOn()) { el.innerHTML = ''; return; }
  el.innerHTML = USR ? `<span title="${esc(ROLES[USR.rol] ? ROLES[USR.rol][0] : '')}">👤 ${esc(USR.nombre)}</span> <button class="lnk" id="usrCambiar">cambiar</button>` : '<button class="lnk" id="usrCambiar">👤 Entrar</button>';
  $('#usrCambiar').onclick = () => usrEntrar(true);
}
// Cada vez que se abre el programa hay que entrar (la sesión no sobrevive al cierre). Esta PC recuerda el usuario
// y, si se tilda, el PIN: entrar es un toque. Antes de entrar se exige instalar la versión nueva si hay una lista.
// saludo al entrar (mismo cartel que el visor web)
function usrBienvenida(nombre) {
  const fecha = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  const g = document.createElement('div'); g.id = 'greet';
  g.innerHTML = `<div class="gb"><div class="gi">👋</div><div><b>Hola ${esc(nombre)}, ¡bienvenido de nuevo!</b><span>${fecha.charAt(0).toUpperCase() + fecha.slice(1)}</span><small>${esc(S.nombre || 'PSFV Oberá II')} · Gestión de obra</small></div></div>`;
  document.body.appendChild(g); requestAnimationFrame(() => g.classList.add('show'));
  const fuera = () => { g.classList.remove('show'); setTimeout(() => g.remove(), 500); };
  g.onclick = fuera; setTimeout(fuera, 3000);
}
const usrRec = () => { try { return JSON.parse(localStorage.getItem('obeii-usr') || 'null') || {}; } catch (_) { return {}; } };
async function usrEntrar(forzar) {
  usrPedido = true;
  if (window.VISOR || !usersOn()) { USR = null; usrPie(); return; }
  if (!USR) { aplicarPermiso(); render(false); } // hasta entrar, solo lectura
  if (typeof updObligatoria === 'function' && (await updObligatoria())) return;
  const rec = usrRec(), recU = usrL().find((x) => x.id === rec.id), recPin = recU && rec.pin && rec.pin === recU.pin;
  const us = usrL().slice().sort((a, b) => a.nombre.localeCompare(b.nombre));
  const pm = modal({ title: '👤 ¿Quién está usando el programa?', sub: 'Elegí tu usuario e ingresá tu PIN. Lo que cargues queda registrado con tu nombre.',
    body: `<div class="form"><label class="full">Usuario<select id="uS">${us.map((u) => `<option value="${u.id}" ${(USR ? USR.id === u.id : rec.id === u.id) ? 'selected' : ''}>${esc(u.nombre)} · ${ROLES[u.rol][0]}</option>`).join('')}</select></label>
      <label class="full">PIN<input type="password" inputmode="numeric" id="uP" autocomplete="off" placeholder="${recPin ? '•••• recordado: tocá Entrar' : ''}"></label>
      <label style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="uR" style="width:auto;margin:0" ${recPin || !rec.id ? 'checked' : ''}> Recordar mi PIN en esta PC</label>
      <p class="hint" style="margin:0">La sesión se cierra al cerrar el programa: cada vez que se abre hay que entrar.</p></div>`,
    buttons: [['Entrar solo a consultar', 'btn', () => 'ro'], ['Entrar', 'btn pri', (box) => {
      const u = usrL().find((x) => x.id === $('#uS', box).value);
      const okRec = !$('#uP', box).value && rec.id === (u && u.id) && rec.pin && u && rec.pin === u.pin;
      if (!u || (!okRec && (box.dataset.h !== u.pin || box.dataset.hu !== u.id))) { toast('PIN incorrecto', { err: true }); return false; }
      return { u, rec: $('#uR', box).checked }; }]] });
  { const box = $('#modal .mbox'), p = $('#uP', box), sel = $('#uS', box);
    const calc = async () => { const id = sel.value, h = await pinHash(id, p.value.trim()); if (sel.value === id) { box.dataset.h = h; box.dataset.hu = id; } };
    const ph = () => { const r2 = usrRec(), uu = usrL().find((x) => x.id === sel.value); p.placeholder = r2.id === sel.value && r2.pin && uu && r2.pin === uu.pin ? '•••• recordado: tocá Entrar' : ''; };
    p.oninput = calc; sel.onchange = () => { calc(); ph(); }; p.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); calc().then(() => $$('.mfoot .btn.pri', box)[0].click()); } };
    box.onkeydown = (e) => { if (e.key === 'Enter' && e.target !== p) { e.preventDefault(); $$('.mfoot .btn.pri', box)[0].click(); } };
    setTimeout(() => p.focus(), 50); }
  const res = await pm;
  // se recuerda siempre el usuario; el PIN solo si se tildó (igual hay que entrar en cada apertura)
  if (res && res.u) { USR = res.u; try { localStorage.setItem('obeii-usr', JSON.stringify(res.rec ? { id: res.u.id, pin: res.u.pin } : { id: res.u.id })); } catch (_) { /* nada */ } usrBienvenida(res.u.nombre); }
  else USR = null;
  aplicarPermiso(); usrPie(); render(false);
}
setTimeout(() => { const el = $('#nav') && document.querySelector('.side-foot'); if (el && !$('#usrState')) el.insertAdjacentHTML('beforeend', '<div id="usrState"></div>'); usrPie(); }, 0);

// ---------- administrar usuarios (Ajustes) ----------
function usrCardHTML() {
  if (window.VISOR) return '';
  const us = usrL(), admin = !usersOn() || (USR && USR.rol === 'admin');
  return `<h3>Usuarios y permisos</h3>
    <p class="muted" style="margin:0 0 10px">${usersOn() ? 'Cada PC entra con un usuario y su PIN. Lo que se carga queda en el Historial con su nombre, y cada uno edita solo las secciones habilitadas.' : 'Todavía no hay usuarios: cualquiera puede editar y el historial registra los cambios sin nombre. Al crear el primer usuario (administrador), cada PC va a pedir entrar con usuario y PIN.'}</p>
    ${us.length ? `<table class="tbl"><thead><tr><th>Usuario</th><th>Rol</th><th>Puede editar</th><th></th></tr></thead><tbody>${us.map((u) => `<tr><td><b>${esc(u.nombre)}</b>${USR && USR.id === u.id ? ' <span class="pill p-done">vos</span>' : ''}</td><td>${ROLES[u.rol][0]}</td><td class="muted" style="font-size:12.5px">${u.rol === 'admin' ? 'Todo' : u.rol === 'lectura' ? 'Nada' : (u.secciones || []).length ? u.secciones.map((s) => (SECCIONES.find((x) => x[0] === s) || [, s])[1]).join(' · ') : 'Todas las secciones (menos Ajustes)'}</td><td>${admin ? `<button class="btn sm ghost" data-ue="${u.id}">✎</button>` : ''}</td></tr>`).join('')}</tbody></table>` : ''}
    ${admin ? `<div style="margin-top:10px"><button class="btn ${usersOn() ? '' : 'pri'}" id="uNuevo">+ ${usersOn() ? 'Usuario' : 'Crear el primer usuario (administrador)'}</button></div>` : '<p class="hint">Solo un administrador puede cambiar los usuarios.</p>'}`;
}
function usrCardBind(box) {
  if (!box) return;
  const n = $('#uNuevo', box); if (n) n.onclick = () => usrEditar(null);
  $$('[data-ue]', box).forEach((b) => { b.onclick = () => usrEditar(b.dataset.ue); });
}
async function usrEditar(id) {
  const u0 = id ? usrL().find((x) => x.id === id) : null, primero = !usersOn();
  const u = u0 || { nombre: '', rol: primero ? 'admin' : 'edita', secciones: [] };
  const res = modal({ title: u0 ? `Usuario ${u0.nombre}` : primero ? 'Primer usuario (administrador)' : 'Nuevo usuario', sub: 'El PIN se pide al entrar en cada PC',
    body: `<div class="form"><label>Nombre<input type="text" id="unN" value="${esc(u.nombre)}" placeholder="ej. Enzo"></label>
      <label>PIN (4 a 8 números)<input type="password" inputmode="numeric" id="unP" placeholder="${u0 ? 'dejá vacío para no cambiarlo' : ''}" autocomplete="new-password"></label>
      <label class="full">Rol<select id="unR" ${primero ? 'disabled' : ''}>${Object.entries(ROLES).map(([k, [t, d]]) => `<option value="${k}" ${u.rol === k ? 'selected' : ''}>${t} — ${d}</option>`).join('')}</select></label>
      <div class="full" id="unSecs" style="${u.rol === 'edita' ? '' : 'display:none'}"><div class="muted" style="font-size:12.5px;margin-bottom:6px">Secciones que puede editar (ninguna marcada = todas, menos Ajustes):</div>
        <div class="unsecs">${SECCIONES.filter((s) => s[0] !== 'ajustes').map(([k, t]) => `<label><input type="checkbox" value="${k}" ${(u.secciones || []).includes(k) ? 'checked' : ''}> ${t}</label>`).join('')}</div></div></div>`,
    buttons: (u0 ? [['Eliminar', 'btn danger', () => 'del']] : []).concat([['Cancelar', 'btn', () => null], ['Guardar', 'btn pri', (box) => {
      const nombre = $('#unN', box).value.trim(), pin = $('#unP', box).value.trim(), rol = primero ? 'admin' : $('#unR', box).value;
      if (!nombre) { toast('Poné el nombre', { err: true }); return false; }
      if (usrL().some((x) => x !== u0 && x.nombre.toLowerCase() === nombre.toLowerCase())) { toast('Ya hay un usuario con ese nombre', { err: true }); return false; }
      if ((!u0 || pin) && !/^\d{4,8}$/.test(pin)) { toast('El PIN tiene que tener de 4 a 8 números', { err: true }); return false; }
      if (u0 && u0.rol === 'admin' && rol !== 'admin' && usrL().filter((x) => x.rol === 'admin').length === 1) { toast('Tiene que quedar al menos un administrador', { err: true }); return false; }
      return { nombre, pin, rol, secciones: rol === 'edita' ? $$('.unsecs input:checked', box).map((x) => x.value) : [] }; }]]) });
  { const b = $('#modal .mbox'), r = b && $('#unR', b); if (r) r.onchange = () => { $('#unSecs', b).style.display = r.value === 'edita' ? '' : 'none'; }; }
  const r = await Promise.resolve(res);
  if (r === 'del') {
    if (u0.rol === 'admin' && usrL().filter((x) => x.rol === 'admin').length === 1 && usrL().length > 1) { toast('Es el único administrador: primero nombrá otro', { err: true }); return; }
    if (!(await confirmar('Eliminar usuario', `Se elimina ${esc(u0.nombre)}. Lo que cargó sigue en el historial con su nombre.${usrL().length === 1 ? ' Es el último usuario: el programa vuelve a funcionar sin usuarios.' : ''}`, 'Eliminar', 'btn danger'))) return;
    S.usuarios = usrL().filter((x) => x !== u0); if (USR && USR.id === u0.id) USR = null;
    commit(`Usuario ${u0.nombre} eliminado`); aplicarPermiso(); usrPie(); return;
  }
  if (!r) return;
  const x = u0 || { id: uid('u'), _o: Date.now() };
  Object.assign(x, { nombre: r.nombre, rol: r.rol, secciones: r.secciones }); if (r.pin) x.pin = await pinHash(x.id, r.pin);
  if (!u0) usrL().push(x);
  if (primero || (USR && USR.id === x.id)) { USR = x; try { localStorage.setItem('obeii-usr', JSON.stringify({ id: x.id, pin: x.pin })); } catch (_) { /* nada */ } }
  commit(u0 ? `Usuario ${x.nombre} actualizado (${ROLES[x.rol][0].toLowerCase()})` : `Usuario ${x.nombre} creado (${ROLES[x.rol][0].toLowerCase()})`);
  aplicarPermiso(); usrPie();
}

// ---------- historial ----------
const HIST_MAX = 6000;
function histAnotar(msg) {
  if (window.VISOR || !msg) return;
  const t = String(msg).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(); if (!t) return;
  const H = (S.hist = S.hist || []);
  H.push({ id: uid('h'), _o: Date.now(), t: new Date().toISOString(), u: USR ? USR.nombre : '', s: secDe(view), v: view, m: t.slice(0, 300) });
  if (H.length > HIST_MAX) H.splice(0, H.length - HIST_MAX);
}
const histUI = { u: '', s: '', d: '', q: '', n: 300 };
function vHist(el) {
  actions([['Exportar Excel', 'btn', histExcel]]);
  const H = (S.hist || []).slice().sort((a, b) => b.t.localeCompare(a.t));
  const q = histUI.q.toLowerCase(), list = H.filter((h) => (!histUI.u || (h.u || '—') === histUI.u) && (!histUI.s || h.s === histUI.s) && (!histUI.d || h.t.slice(0, 10) >= histUI.d) && (!q || h.m.toLowerCase().includes(q)));
  const us = [...new Set(H.map((h) => h.u || '—'))].sort(), hoyN = H.filter((h) => h.t.slice(0, 10) === today()).length;
  const fh = (t) => { const d = new Date(t); return `${fechaCorta(new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10))} ${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`; };
  el.innerHTML = `<div class="kpis k3" style="margin-bottom:12px">${kpi('Cambios registrados', H.length, '', 0)}${kpi('Hoy', hoyN, 'cambios', 0)}${kpi('Personas', us.filter((x) => x !== '—').length, usersOn() ? 'con usuario' : 'sin usuarios cargados', 0)}</div>
    <div class="tools"><select id="hU"><option value="">Todas las personas</option>${us.map((x) => `<option ${histUI.u === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>
    <select id="hS"><option value="">Todas las secciones</option>${SECCIONES.map(([k, t]) => `<option value="${k}" ${histUI.s === k ? 'selected' : ''}>${t}</option>`).join('')}</select>
    <label class="muted" style="display:flex;align-items:center;gap:6px">desde <input type="date" id="hD" value="${histUI.d}"></label><span class="sp"></span><span class="muted">${list.length} cambios</span><input type="search" id="hQ" placeholder="Buscar en los cambios…" value="${esc(histUI.q)}" style="width:220px"></div>
    <div class="tblwrap"><table class="tbl"><thead><tr><th style="width:130px">Fecha y hora</th><th style="width:130px">Persona</th><th style="width:170px">Sección</th><th>Cambio</th></tr></thead><tbody>
    ${list.slice(0, histUI.n).map((h) => `<tr><td class="mono" style="font-size:12px">${fh(h.t)}</td><td>${h.u ? esc(h.u) : '<span class="muted">sin usuario</span>'}</td><td class="muted" style="font-size:12.5px">${esc((SECCIONES.find((x) => x[0] === h.s) || [, h.s])[1])}</td><td>${esc(h.m)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted" style="padding:18px">Sin cambios registrados con ese filtro. El historial empieza a registrarse desde esta versión.</td></tr>'}</tbody></table></div>
    ${list.length > histUI.n ? `<div style="text-align:center;margin-top:10px"><button class="btn" id="hMas">Ver ${Math.min(300, list.length - histUI.n)} más</button></div>` : ''}
    <p class="hint">Se registran los cambios con su descripción (tendidos, zanjas, hincado, recepciones, máquinas, lluvias…). Se conservan los últimos ${fmt(HIST_MAX)} y se ven en todas las PCs de la red.</p>`;
  $('#hU', el).onchange = (e) => { histUI.u = e.target.value; histUI.n = 300; render(false); };
  $('#hS', el).onchange = (e) => { histUI.s = e.target.value; histUI.n = 300; render(false); };
  $('#hD', el).onchange = (e) => { histUI.d = e.target.value; histUI.n = 300; render(false); };
  searchBind('#hQ', (v) => { histUI.q = v; histUI.n = 300; });
  const m = $('#hMas', el); if (m) m.onclick = () => { histUI.n += 300; render(false); };
}
async function histExcel() {
  const wb = XLSX.utils.book_new(), a = [['Fecha y hora', 'Persona', 'Sección', 'Cambio']];
  (S.hist || []).slice().sort((x, y) => y.t.localeCompare(x.t)).forEach((h) => { const d = new Date(h.t); a.push([`${d.toLocaleDateString('es-AR')} ${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`, h.u || '', (SECCIONES.find((x) => x[0] === h.s) || [, h.s])[1], h.m]); });
  const w = XLSX.utils.aoa_to_sheet(a); w['!cols'] = [17, 16, 26, 90].map((x) => ({ wch: x })); XLSX.utils.book_append_sheet(wb, w, 'Historial');
  const p = await window.api.saveBinary(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }), `Historial de cambios ${today()}.xlsx`, 'xlsx', 'Excel');
  if (p) toast('Historial exportado', { action: ['Abrir', () => window.api.openPath(p)] });
}

// si los usuarios llegan por la red después de abrir (PC cliente nueva), se pide entrar una vez
let usrPedido = false;
setInterval(() => { if (!window.VISOR && usersOn() && !USR && !usrPedido && !$('#modal:not(.hidden) .mbox')) { usrPedido = true; usrEntrar(false); } if (!usersOn() && USR) { USR = null; aplicarPermiso(); usrPie(); } }, 4000);
