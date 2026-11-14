/* PSFV-OBE II · Ajustes, trabajo en red, publicación web y archivos. */
// ======================= AJUSTES =======================
function vAjustes(el) {
  actions([['Abrir proyecto', 'btn', abrir], ['Guardar copia', 'btn pri', guardarComo]]);
  const p = S.params;
  el.innerHTML = `<div class="grid g2 stagger"><div class="card"><h3>Parámetros del cálculo</h3><div class="form">
    <label>Margen por corte (m por conductor)<input type="number" step="0.1" min="0" id="pM" value="${p.margen}"></label>
    <label>Remanente mínimo útil (m)<input type="number" step="1" min="0" id="pU" value="${p.minUtil}"></label>
    <label title="El plan deja en cada bobina, después de su último corte, al menos este % del largo de ese corte, para que el que tiende tenga tolerancia. Si el stock no alcanza para respetarlo, se planifica sin holgura antes que dejar un faltante.">Holgura en el último corte de cada bobina (%)<input type="number" step="1" min="0" max="30" id="pH" value="${p.holgura != null ? p.holgura : 8}"></label>
    <label title="Del margen disponible de cada sección, qué parte se considera segura al tender. El resto es riesgo.">Tolerancia segura (% del margen)<input type="number" step="5" min="0" max="100" id="pTS" value="${p.tolSeg != null ? p.tolSeg : 50}"></label>
    <label>Cola no utilizable por bobina (m)<input type="number" step="1" min="0" id="pC" value="${p.cola}"></label></div>
    <h4 style="margin:16px 0 6px">Corrección de largo por tipo (%)</h4>
    <div class="form">${catsUso().map((k) => { const rs = R.resumen.filter((r) => r.cat === k && r.tendidoTeo > 0); const teo = rs.reduce((a, r) => a + r.tendidoTeo, 0), dv = rs.reduce((a, r) => a + r.desvio, 0);
      const sug = teo > 0 ? Math.round((dv / teo) * 1000) / 10 : null;
      return `<label>${CATN[k]}<input type="number" step="0.1" class="pAj" data-k="${k}" value="${(p.ajuste || {})[k] || 0}"><span class="muted" style="font-weight:400">${sug != null ? `Según lo tendido: ${sug > 0 ? '+' : ''}${fmt(sug, 1)} % (${fmt(teo)} m) <a href="#" class="useSug" data-k="${k}" data-v="${sug}">usar</a>` : 'Sin tendidos para sugerir'}</span></label>`; }).join('')}</div>
    <p class="hint">Si en campo sobra cable al tirar lo que dice la lista, poné un % negativo (por ejemplo −2 %): se corrigen todos los largos a cortar de ese tipo y el plan se recalcula. Para un circuito puntual, usá "Bobina / largo" en Circuitos. El margen por corte se suma a cada conductor solo si querés tolerancia extra.</p></div>
    <div class="card"><h3>Proyecto</h3>${ED.blank ? parqueResumen() : `<div class="form"><label class="full">Nombre<input type="text" id="pN" value="${esc(S.nombre)}"></label></div>`}
    <p class="hint">${esc(S.fuente || '')}</p><p class="hint">Los cambios se guardan solos en esta PC con un respaldo diario (se conservan 30). "Guardar copia" genera un archivo .obra para otra computadora.</p>
    <p class="hint" id="pInfo"></p><div style="display:flex;gap:8px;margin-top:10px"><button class="btn" id="pOpenData">Abrir carpeta de datos</button><button class="btn danger" id="pReset">Restaurar datos iniciales</button></div></div>
    <div class="card" id="netCard"><h3>Trabajo en red</h3><div class="muted">Cargando…</div></div>
    <div class="card" id="webCard"><h3>Publicar en la web</h3><div class="muted">Cargando…</div></div>
    <div class="card" id="usrCard">${usrCardHTML()}</div>
    ${window.api.bkCfg ? '<div class="card" id="bkCard"><h3>Respaldo en la nube (GitHub)</h3><div class="muted">Cargando…</div></div>' : ''}
    <div class="card" id="updCard">${updCardHTML()}</div>
    <div class="card"><h3>Cómo arma el plan</h3><ol style="margin:0;padding-left:18px;line-height:1.6">
    <li>Los cortes registrados se descuentan de su bobina y no se tocan.</li>
    <li>Las bobinas <b>elegidas a mano</b> ("Bobina / largo", marcadas con <i class="pin">●</i>) se respetan siempre; al elegir una, el resto del plan de ese tipo se recalcula completo.</li>
    <li><b>Primero</b> se asignan los circuitos con zanja abierta (o ya empezados): conductores más largos primero, cada uno a la bobina del mismo tipo y sección con el menor saldo que alcance. Así se consumen los remanentes y se abren pocas bobinas.</li>
    <li><b>Después</b> se arma el plan provisorio del resto.</li>
    <li>Una pasada de <b>mejora</b> mueve e intercambia los cortes no comprometidos entre bobinas, sin abrir bobinas de más, para dejar las bobinas terminadas y el sobrante concentrado en remanentes grandes.</li>
    <li>Los cortes que ya figuran como <b>listos</b> quedan comprometidos a su bobina: al abrirse nuevas zanjas no cambian, salvo que ya no entren o uses "Replanificar".</li></ol></div></div>`;
  const setP = (k) => (e) => { S.params[k] = Math.max(0, Number(e.target.value) || 0); commit('Parámetros actualizados'); };
  if ($('#pTS')) $('#pTS').onchange = (e) => { S.params.tolSeg = Math.max(0, Math.min(100, Number(e.target.value) || 0)); commit('Tolerancia segura: ' + S.params.tolSeg + ' % del margen'); };
  $('#pM').onchange = setP('margen'); $('#pU').onchange = setP('minUtil'); $('#pH').onchange = setP('holgura'); $('#pC').onchange = setP('cola');
  const setAj = (k, v) => { S.params.ajuste = Object.assign({}, S.params.ajuste || {}); S.params.ajuste[k] = Math.max(-30, Math.min(30, Number(v) || 0)); recalcularTodo(k); commit(`Corrección ${CATN[k]}: ${fmt(S.params.ajuste[k], 1)} % · plan recalculado`); };
  $$('.pAj', el).forEach((i) => { i.onchange = () => setAj(i.dataset.k, i.value); });
  $$('.useSug', el).forEach((a) => { a.onclick = (e) => { e.preventDefault(); setAj(a.dataset.k, a.dataset.v); }; });
  if ($('#pParque')) $('#pParque').onclick = () => asistenteParque(false);
  if ($('#pN')) $('#pN').onchange = (e) => { S.nombre = e.target.value.trim() || 'Obra'; window.api.netObra(S.nombre); commit(); };
  window.api.info().then((i) => { $('#pInfo') && ($('#pInfo').textContent = `Versión ${i.version} · datos en ${i.userData}`); $('#pOpenData') && ($('#pOpenData').onclick = () => window.api.openPath(i.userData)); });
  renderNet(); renderWeb(); renderBk(); updCardBind(); usrCardBind($('#usrCard'));
  $('#pReset').onclick = async () => {
    if (await confirmar('Restaurar datos iniciales', 'Se reemplazan bobinas, circuitos y tendidos por los datos con que vino el programa. El estado actual queda en el respaldo del día.', 'Restaurar')) {
      const keep = S.__sync, parque = S.parque, nom = S.nombre; S = JSON.parse(await window.api.seed());
      if (ED.blank && parque) { S.parque = parque; S.nombre = nom; }
      S = normalizar(S); S.__sync = keep; commit('Datos iniciales restaurados');
    }
  };
}

// ======================= red =======================
function netLine() {
  const el = $('#netState'); if (!el) return;
  if (NET.modo === 'local') { el.textContent = ''; el.className = ''; return; }
  el.className = 'net ' + (netStatus.ok ? 'ok' : netStatus.ok === false ? 'bad' : '');
  el.textContent = NET.modo === 'servidor' ? `Red: servidor${netStatus.msg ? ' · ' + netStatus.msg : ''}` : !Sync.meta(S).srvId ? 'Red: sin conectar (Ajustes)' : `Red: ${netStatus.ok ? 'conectado a ' + NET.ip : netStatus.msg || 'conectando…'}`;
}
async function renderNet() {
  const box = $('#netCard'); if (!box) return;
  NET = await window.api.netCfg();
  const m = NET.modo;
  let h = `<h3>Trabajo en red</h3><div class="seg" id="nMode"><button data-v="local">Solo esta PC</button><button data-v="servidor">Servidor</button><button data-v="cliente">Cliente</button></div>`;
  if (m === 'local') h += `<p class="hint">Los datos quedan solo en esta PC. Para trabajar entre varias PCs de la misma red, elegí una como <b>Servidor</b> (la que más tiempo esté encendida) y en las demás <b>Cliente</b>.</p>`;
  if (m === 'servidor') {
    const cl = await window.api.netClientes();
    h += `<div class="netbox"><div><span class="muted">Dirección para los clientes</span><b class="mono big">${NET.ips.length ? NET.ips.map((i) => esc(i)).join('<br>') : 'sin red'}</b><span class="muted">puerto ${NET.puerto}</span></div>
      <div><span class="muted">Clave de la obra</span><b class="mono big">${esc(NET.clave)}</b><button class="btn sm ghost" id="nNewKey">Cambiar clave</button></div></div>
      ${NET.error ? `<div class="alert error">${esc(NET.error)}</div>` : NET.escuchando ? '<div class="alert ok">Esperando clientes. Si Windows pregunta por el firewall, permití el acceso en redes privadas.</div>' : ''}
      <h4 style="margin:12px 0 6px">PCs conectadas</h4>${cl.length ? cl.map((c) => `<div class="phase-row" style="grid-template-columns:1fr auto"><span><b>${esc(c.nombre)}</b> <span class="muted">${esc(c.ip)}</span></span><span class="pill p-ok">en línea</span></div>`).join('') : '<p class="hint">Ninguna por ahora.</p>'}
      <p class="hint">Esta PC (${esc(NET.hostname)}) guarda la versión común. El programa tiene que estar abierto para que los clientes sincronicen; si está cerrado, ellos siguen trabajando y se ponen al día cuando vuelve.</p>`;
  }
  const found = await window.api.netServidores();
  const y0 = Sync.meta(S);
  if (m !== 'servidor') {
    h += `<h4 style="margin:14px 0 6px">Servidores encontrados en la red</h4>` + (found.length ? found.map((f) => `<div class="phase-row srvrow" style="grid-template-columns:1fr auto">
      <span><b>${esc(f.obra || 'Obra')}</b> <span class="muted">· ${esc(f.host)} · ${esc(f.ip)}</span></span>
      ${m === 'cliente' && y0.srvId === f.srvId && netStatus.ok ? '<span class="pill p-ok">conectado</span>' : `<button class="btn sm pri" data-srv="${esc(f.srvId)}">Conectar</button>`}</div>`).join('')
      : `<p class="hint"><span class="spin"></span> Buscando… Si no aparece, revisá que el servidor tenga el programa abierto y que estén en la misma red, o conectá por IP.</p>`);
  }
  if (m === 'cliente') {
    h += `<details class="manual" ${netStatus.ok === false && !found.length ? 'open' : ''}><summary>Conectar por IP</summary><div class="form" style="margin-top:12px"><label>IP del servidor<input type="text" id="nIp" value="${esc(NET.ip || '')}" placeholder="192.168.0.10"></label>
      <label>Clave de la obra<input type="text" id="nKey" value="${S.__sync && S.__sync.srvId ? esc(NET.clave) : ''}" placeholder="la que muestra el servidor"></label>
      <label>Puerto<input type="number" id="nPort" value="${NET.puerto}"></label><label>&nbsp;<button class="btn pri" id="nConn">${S.__sync && S.__sync.srvId ? 'Reconectar' : 'Conectar'}</button></label></div></details>
      <div class="alert ${netStatus.ok ? 'ok' : netStatus.ok === false ? 'error' : 'info'}" style="margin-top:10px">${netStatus.ok ? `Conectado a ${esc(NET.ip)} · última sincronización ${esc(netStatus.cuando || '')}` : esc(netStatus.msg || 'Sin conectar')}</div>
      <p class="hint">Esta PC guarda sus propios datos y puede trabajar sin conexión: los cambios se envían solos al volver la red. Si dos PCs cambian lo mismo, queda el cambio más reciente.</p>
      <div style="display:flex;gap:8px"><button class="btn" id="nNow">Sincronizar ahora</button></div>`;
  }
  box.innerHTML = h;
  segBind('#nMode', m, async (v) => {
    if (v === m) return;
    if (v === 'servidor' && !(await confirmar('Usar esta PC como servidor', 'Esta PC va a guardar la versión común de la obra y las demás se van a conectar a ella. Tiene que estar en la misma red y con el programa abierto.', 'Activar'))) return;
    NET = await window.api.netSetCfg({ modo: v });
    if (v === 'servidor') { Sync.prepararServidor(S); await window.api.save(JSON.stringify(S)); }
    netStatus = { ok: null, msg: '' }; netLine(); renderNet(); arrancarRed();
  });
  if (m === 'servidor') $('#nNewKey').onclick = async () => {
    if (!(await confirmar('Cambiar clave', 'Las PCs conectadas van a tener que cargar la clave nueva.', 'Cambiar'))) return;
    NET = await window.api.netSetCfg({ clave: Math.random().toString(36).slice(2, 8).toUpperCase() }); renderNet();
  };
  $$('[data-srv]', box).forEach((b) => { b.onclick = () => conectarEncontrado(found.find((f) => f.srvId === b.dataset.srv)); });
  clearTimeout(renderNet.t); renderNet.t = setTimeout(() => { if (view === 'ajustes' && $('#netCard') && !$('#netCard').contains(document.activeElement)) renderNet(); }, 3000);
  if (m === 'cliente') {
    $('#nConn').onclick = () => conectar($('#nIp').value.trim(), Number($('#nPort').value) || 47821, $('#nKey').value.trim());
    $('#nNow').onclick = () => syncNow(true);
  }
}
async function conectarEncontrado(f) {
  if (!f) return;
  const clave = await modal({ title: `Conectar con ${esc(f.obra || f.host)}`, sub: `Servidor ${esc(f.host)} · ${esc(f.ip)}`,
    body: `<div class="form"><label class="full">Clave de la obra<input type="text" name="clave" placeholder="la que muestra el servidor en Ajustes" autocomplete="off" style="text-transform:uppercase;font-size:18px;letter-spacing:2px"></label></div>
      <p class="hint">La clave figura en la PC servidor, en Ajustes → Trabajo en red.</p>`,
    buttons: [['Cancelar', 'btn', () => null], ['Conectar', 'btn pri', (box) => $('[name=clave]', box).value.trim() || false]] });
  if (!clave) return;
  if (NET.modo !== 'cliente') NET = await window.api.netSetCfg({ modo: 'cliente' });
  await conectar(f.ip, f.puerto || 47821, clave);
  renderNet();
}
async function conectar(ip, puerto, clave) {
  if (!ip || !clave) { toast('Cargá la IP y la clave que muestra el servidor', { err: true }); return; }
  const probe = await window.api.netSync(ip, puerto, { dev: NET.devId, clave, now: Date.now(), since: 0, cambios: [] });
  if (!probe.ok) { netStatus = { ok: false, msg: probe.error }; netLine(); renderNet(); toast(probe.error === 'Clave incorrecta' ? 'Clave incorrecta: revisala en la PC servidor' : probe.error, { err: true, ms: 5000 }); return; }
  NET = await window.api.netSetCfg({ ip, puerto, clave });
  const y = Sync.meta(S);
  if (y.srvId !== probe.res.srvId) {
    const op = await modal({ title: `Conectar con ${esc(probe.res.host || ip)}`,
      body: `<p>¿Qué hacemos con los datos de esta PC?</p>
        <div class="phase-row" style="grid-template-columns:1fr"><b>Usar los datos del servidor (recomendado)</b><span class="muted">Esta PC toma la obra tal como está en el servidor. Lo cargado solo acá se reemplaza (queda en el respaldo del día).</span></div>
        <div class="phase-row" style="grid-template-columns:1fr"><b>Combinar con los míos</b><span class="muted">Se envía todo lo de esta PC al servidor. Donde haya diferencias, queda lo de esta PC.</span></div>`,
      buttons: [['Cancelar', 'btn', () => null], ['Combinar con los míos', 'btn', () => 'mix'], ['Usar los del servidor', 'btn pri', () => 'srv']] });
    if (!op) return;
    if (op === 'srv') Sync.reemplazarPorServidor(S); else Sync.marcarTodoPendiente(S);
    Sync.meta(S).srvId = probe.res.srvId;
    Sync.meta(S).peerRev = 0;
  }
  await syncNow(true);
  arrancarRed();
}
function programarSync(ms) { clearTimeout(syncTimer); syncTimer = setTimeout(() => syncNow(false), ms); }
async function syncNow(manual) {
  if (NET.modo !== 'cliente' || !NET.ip || syncBusy) return;
  const y = Sync.meta(S);
  if (!y.srvId) { netStatus = { ok: false, msg: 'Falta conectar (Ajustes → Trabajo en red)' }; netLine(); return; }
  syncBusy = true;
  try {
    const { body, enviados } = Sync.paquete(S, NET), t0 = Date.now();
    const r = await window.api.netSync(NET.ip, NET.puerto, body);
    if (!r.ok) {
      // ¿el servidor cambió de IP? buscarlo por su identificador entre los encontrados
      const f = (await window.api.netServidores()).find((x) => x.srvId === y.srvId && x.ip !== NET.ip);
      if (f) { NET = await window.api.netSetCfg({ ip: f.ip, puerto: f.puerto || NET.puerto }); netStatus = { ok: null, msg: `El servidor ahora está en ${f.ip}` }; syncBusy = false; programarSync(200); return; }
      netStatus = { ok: false, msg: r.error }; if (manual) toast(r.error, { err: true }); return;
    }
    if (r.res.srvId !== y.srvId) { netStatus = { ok: false, msg: 'El servidor cambió: volvé a conectar' }; return; }
    const n = Sync.recibir(S, r.res, enviados, t0);
    const viejo = !(Number(r.res.proto) >= Sync.PROTO);
    if (viejo && !avisoViejo) { avisoViejo = true; toast('El servidor tiene una versión anterior del programa: actualizalo. Hasta entonces las fundaciones STS no se sincronizan (quedan guardadas en esta PC).', { err: true, ms: 12000 }); }
    netStatus = { ok: true, msg: viejo ? 'servidor con versión anterior: actualizalo' : '', cuando: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) };
    if (n || Object.keys(enviados).length) {
      S = normalizarRed(S);
      commitRed(n ? `${n} cambios recibidos de la red` : '');
    }
    if (manual) toast('Sincronizado');
  } finally { syncBusy = false; netLine(); if (view === 'ajustes') renderNet(); }
}
function normalizarRed(st) { Engine.sincronizarPAT(st); Sync.ordenar(st); return st; }
function commitRed(msg) {
  // recalcula y guarda sin interrumpir lo que el usuario está editando
  const modalAbierto = !$('#modal').classList.contains('hidden');
  R = Engine.calcular(S); S.compromiso = R.compromiso;
  const n = Sync.sellar(S, NET.modo);
  if (NET.modo === 'cliente' && n) programarSync(800);
  if (n) programarWeb();
  window.api.save(JSON.stringify(S));
  if (!modalAbierto) render(false);
  if (msg && !modalAbierto) toast(msg, { ms: 2500 });
}
let redTimer = null;
function arrancarRed() {
  clearInterval(redTimer);
  netLine();
  if (NET.modo === 'cliente') { redTimer = setInterval(() => syncNow(false), 3000); syncNow(false); }
  if (NET.modo === 'servidor') redTimer = setInterval(async () => { const cl = await window.api.netClientes(); netStatus = { ok: true, msg: `${cl.length} PC${cl.length === 1 ? '' : 's'} conectada${cl.length === 1 ? '' : 's'}` }; netLine(); }, 4000);
}
const viejos = new Set(); let avisoViejo = false;
function atenderRed({ id, body }) {
  try {
    if (NET.modo !== 'servidor') { window.api.netReply(id, { error: 'no es servidor' }); return; }
    const { aplicados } = Sync.atender(S, body);
    if (aplicados) { S = normalizarRed(S); commitRed(`${aplicados} cambios recibidos de ${body.nombre || 'otra PC'}`); }
    window.api.netReply(id, Sync.respuesta(S, Number(body.since) || 0, body.proto));
    if (!(Number(body.proto) >= Sync.PROTO) && !viejos.has(body.dev)) { viejos.add(body.dev); toast(`La PC ${body.nombre || body.dev || ''} tiene una versión anterior del programa: actualizala. Hasta entonces no recibe ni puede borrar las fundaciones STS.`, { err: true, ms: 12000 }); }
  } catch (e) { window.api.netReply(id, { error: String(e.message || e) }); }
}

// ======================= publicación web =======================
const webListo = () => WEB && WEB.owner && WEB.repo && WEB.tieneToken && (WEB.usuarios || []).length;
const webUrl = () => (WEB && WEB.owner && WEB.repo ? `https://${WEB.owner.toLowerCase()}.github.io/${WEB.repo}/` : '');
function programarWeb() {
  if (window.READONLY || !webListo() || WEB.auto === false) return;
  clearTimeout(webTimer); webTimer = setTimeout(() => publicarWeb(false), 90000);
}
// aviso de token de GitHub vencido o por vencer y de publicación automática que falla (solo en la PC que publica)
function ghAviso() {
  if (window.VISOR || !WEB || !WEB.tieneToken) return null;
  const f = (x) => new Date(x).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const efecto = 'el visor web y la app de campo no se actualizan y la PC no recibe los partes ni los cronogramas';
  if (WEB.tokEstado === 'invalido' || WEB.errorSt === 401) return { n: 'error', t: `<b>El token de GitHub venció o no es válido</b> (desde ${f(WEB.tokEstadoF || WEB.errorF || Date.now())}): ${efecto}. Generá uno nuevo en GitHub y cargalo en Ajustes → Publicar en la web.` };
  if (WEB.tokVence && WEB.tokVence !== 'sin') {
    const d = Math.ceil((new Date(WEB.tokVence) - Date.now()) / 864e5);
    if (d <= 0) return { n: 'error', t: `<b>El token de GitHub venció el ${f(WEB.tokVence)}</b>: ${efecto}. Generá uno nuevo y cargalo en Ajustes → Publicar en la web.` };
    if (d <= 15) return { n: 'aviso', t: `<b>El token de GitHub vence el ${f(WEB.tokVence)}</b> (${d === 1 ? 'mañana' : `en ${d} días`}). Renovalo antes para que el visor web y la app de campo no se corten: en GitHub, <i>Regenerate token</i>, y pegalo en Ajustes → Publicar en la web.` };
  }
  if (WEB.error && WEB.auto !== false) return { n: 'error', t: `<b>La publicación automática en la web está fallando</b> (${f(WEB.errorF || Date.now())}): ${esc(WEB.error)}. Revisá la conexión a internet o la configuración en Ajustes → Publicar en la web.` };
  return null;
}
function ghAvisoHTML() {
  const a = ghAviso(); if (!a) return '';
  return `<div class="alert ${a.n} ghav" style="margin-bottom:12px"><div style="flex:1">${a.t}</div>${view === 'ajustes' ? '' : '<button class="btn sm" data-ghav>Ir a Ajustes</button>'}</div>`;
}
document.addEventListener('click', (e) => { if (e.target.closest('[data-ghav]')) go('ajustes'); });
function ghBanner() {
  if (view !== 'resumen') return;
  const hero = document.querySelector('.hero.hmain'); if (!hero) return;
  const old = hero.parentNode.querySelector('.ghav'); if (old) old.remove();
  const h = ghAvisoHTML(); if (h) hero.insertAdjacentHTML('beforebegin', h);
}
let ghUltErr = null;
async function ghChequear() {
  if (window.VISOR || !window.api.webCheck || !webListo()) return;
  try { await window.api.webCheck(); WEB = await window.api.webCfg(); ghBanner(); } catch (_) { /* nada */ }
}
async function publicarWeb(manual) {
  clearTimeout(webTimer);
  const json = JSON.stringify(S, (k, v) => (k === '__sync' ? undefined : v));
  const r = await window.api.webPublicar(json);
  WEB = await window.api.webCfg();
  if (manual) toast(r.ok ? 'Datos publicados en la web' : 'No se pudo publicar: ' + r.error, { err: !r.ok, ms: 6000 });
  else if (!r.ok && r.error !== ghUltErr) toast(r.status === 401 ? 'No se pudo publicar en la web: el token de GitHub venció o no es válido' : 'No se pudo publicar en la web: ' + r.error, { err: true, ms: 8000 });
  ghUltErr = r.ok ? null : r.error;
  ghBanner();
  if (view === 'ajustes') renderWeb();
  return r;
}
async function renderWeb() {
  const box = $('#webCard'); if (!box) return;
  WEB = await window.api.webCfg();
  const us = WEB.usuarios || [];
  box.innerHTML = `<h3>Publicar en la web</h3>
    <p class="hint" style="margin-top:0">Publica una copia <b>cifrada</b> de la obra en un sitio web (GitHub Pages) para verla desde cualquier lugar, en modo solo lectura, con usuario y contraseña. Conviene configurarlo solo en la PC servidor.</p>
    ${webUrl() ? `<div class="alert ${WEB.error ? 'error' : WEB.ultimo ? 'ok' : 'info'}">${WEB.error ? 'Error al publicar: ' + esc(WEB.error) : WEB.ultimo ? 'Última publicación: ' + new Date(WEB.ultimo).toLocaleString('es-AR') : 'Todavía no se publicó en esta sesión'}
      <br>Dirección del visor: <a href="#" id="wUrl">${esc(webUrl())}</a>${WEB.tieneToken ? `<br>Token: ${WEB.tokEstado === 'invalido' ? '<b>vencido o inválido</b>' : WEB.tokVence === 'sin' ? 'sin vencimiento' : WEB.tokVence ? `vence el <b>${new Date(WEB.tokVence).toLocaleDateString('es-AR')}</b>` : 'vencimiento todavía sin consultar'}` : ''}</div>${ghAvisoHTML()}` : ''}
    <div class="form" style="margin-top:10px"><label>Usuario u organización de GitHub<input type="text" id="wOwner" value="${esc(WEB.owner || '')}" placeholder="ej. ingalfa-obras"></label>
      <label>Repositorio<input type="text" id="wRepo" value="${esc(WEB.repo || '')}" placeholder="ej. avance-obra"></label>
      <label class="full">Token de acceso de GitHub<input type="password" id="wTok" value="${esc(WEB.token || '')}" placeholder="github_pat_…"></label></div>
    <h4 style="margin:14px 0 6px">Usuarios del visor</h4>
    <div id="wUs">${us.map((u) => `<div class="phase-row wu" style="grid-template-columns:1fr 1fr auto auto auto"><input type="text" class="wn" value="${esc(u.nombre)}" readonly><input type="password" class="wp" placeholder="(sin cambios)"><label class="chkl wed" title="Puede enviar cronogramas actualizados desde el visor"><input type="checkbox" class="we" ${u.editor ? 'checked' : ''}> Editor</label><label class="chkl wed" title="Puede cargar partes de campo desde el celular (campo.html)"><input type="checkbox" class="wc" ${u.capataz ? 'checked' : ''}> Capataz</label><button class="btn sm ghost danger wx">Quitar</button></div>`).join('')}</div>
    <button class="btn sm" id="wAdd" style="margin-top:6px">+ Usuario</button>
    <label style="display:flex;gap:8px;align-items:center;margin-top:12px;font-size:13px"><input type="checkbox" id="wAuto" ${WEB.auto !== false ? 'checked' : ''}> Publicar automáticamente cuando haya cambios (como máximo cada 90 segundos)</label>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn pri" id="wSave">Guardar</button><button class="btn" id="wViz">Instalar / actualizar visor</button><button class="btn acc" id="wPub" ${webListo() ? '' : 'disabled'}>Publicar ahora</button></div>
    <details class="manual"><summary>Cómo se configura (una sola vez)</summary><ol style="line-height:1.6;padding-left:18px;font-size:12.5px">
      <li>Crear una cuenta en github.com (gratis) y un repositorio <b>público</b> nuevo, por ejemplo "avance-obra", marcando "Add a README".</li>
      <li>En GitHub: <i>Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token</i>. Elegir solo ese repositorio y dar permiso <b>Contents: Read and write</b> y <b>Pages: Read and write</b>. Copiar el token.</li>
      <li>Acá: cargar usuario de GitHub, repositorio y token, agregar los usuarios del visor con su contraseña (mínimo 8 caracteres) y tocar <b>Guardar</b>.</li>
      <li><b>Capataz</b>: entra desde el celular a <b>…/campo.html</b> (mismo sitio del visor), ve el plan de corte del día y envía partes de tendido, PAT, largo real de zanja y observaciones. Llegan a <b>Partes de campo</b> para aprobarlos.</li>
      <li><b>Editor</b>: ese usuario puede enviar desde el visor un cronograma actualizado de MS Project (.mpp o .xml). Llega cifrado a esta PC, que lo aplica sola cada 2 minutos mientras el programa esté abierto. Los editores reciben el token de GitHub cifrado con su contraseña: marcá solo a personas de confianza.</li>
      <li>Tocar <b>Instalar / actualizar visor</b> y después <b>Publicar ahora</b>. Si GitHub Pages no se activa solo: en el repositorio, <i>Settings → Pages → Deploy from a branch → main / (root)</i>.</li>
      <li>Pasar la dirección del visor y a cada persona su usuario y contraseña. La primera publicación tarda 1 a 2 minutos en aparecer.</li></ol>
      <p class="hint">Los datos viajan y quedan guardados cifrados (AES-256); sin usuario y contraseña no se pueden leer. Para quitarle el acceso a alguien, se lo quita de la lista: desde la próxima publicación ya no puede abrir los datos.</p></details>`;
  const fila = () => `<div class="phase-row wu" style="grid-template-columns:1fr 1fr auto auto auto"><input type="text" class="wn" placeholder="usuario (ej. Juan Pérez)"><input type="password" class="wp" placeholder="contraseña"><label class="chkl wed" title="Puede enviar cronogramas actualizados desde el visor"><input type="checkbox" class="we"> Editor</label><label class="chkl wed" title="Puede cargar partes de campo desde el celular (campo.html)"><input type="checkbox" class="wc"> Capataz</label><button class="btn sm ghost danger wx">Quitar</button></div>`;
  if (!$('#wAdd')) return; // la vista cambió mientras se cargaba la configuración
  $('#wAdd').onclick = () => { $('#wUs').insertAdjacentHTML('beforeend', fila()); bindX(); };
  const bindX = () => $$('.wx', box).forEach((b) => { b.onclick = () => b.closest('.wu').remove(); });
  bindX();
  if ($('#wUrl')) $('#wUrl').onclick = (e) => { e.preventDefault(); window.api.openUrl(webUrl()); };
  $('#wSave').onclick = async () => {
    const usuarios = $$('.wu', box).map((r) => ({ nombre: $('.wn', r).value.trim(), password: $('.wp', r).value, editor: $('.we', r).checked, capataz: $('.wc', r).checked }));
    const nuevosSinClave = usuarios.filter((u) => u.nombre && !u.password && !us.some((x) => x.nombre.toLowerCase() === u.nombre.toLowerCase()));
    if (nuevosSinClave.length) { toast(`Falta la contraseña de ${nuevosSinClave.map((u) => u.nombre).join(', ')}`, { err: true }); return; }
    if (usuarios.some((u) => u.password && u.password.length < 8)) { toast('Las contraseñas deben tener al menos 8 caracteres', { err: true }); return; }
    const nombres = usuarios.filter((u) => u.nombre).map((u) => u.nombre.toLowerCase());
    if (new Set(nombres).size !== nombres.length) { toast('Hay usuarios repetidos', { err: true }); return; }
    $('#wSave').disabled = true; $('#wSave').textContent = 'Guardando…';
    await window.api.webSetCfg({ owner: $('#wOwner').value, repo: $('#wRepo').value, token: $('#wTok').value, auto: $('#wAuto').checked, usuarios });
    toast('Configuración guardada'); renderWeb();
  };
  $('#wViz').onclick = async () => {
    $('#wViz').disabled = true; $('#wViz').textContent = 'Subiendo visor…';
    const r = await window.api.webInstalarVisor();
    if (r.ok) toast(r.archivos ? `Visor actualizado (${r.archivos} archivos)${r.pages === 'activado' ? ' · GitHub Pages activado' : ''}. Los cambios se ven en la página en 1 o 2 minutos.` : 'El visor ya estaba actualizado', { ms: 8000 });
    else toast('No se pudo instalar el visor: ' + r.error, { err: true, ms: 8000 });
    renderWeb();
  };
  $('#wPub').onclick = async () => { $('#wPub').disabled = true; $('#wPub').textContent = 'Publicando…'; await publicarWeb(true); };
}

// ======================= archivos =======================
async function abrir() {
  const r = await window.api.open(); if (!r) return;
  try { cargarTexto(r.text); toast('Proyecto abierto'); } catch (e) { toast('No se pudo leer el archivo', { err: true }); }
}
function cargarTexto(text) {
  const st = JSON.parse(text);
  if (!st.circuitos || !st.bobinas) throw new Error('formato');
  const keep = S && S.__sync;
  delete st.__sync;
  S = normalizar(st); if (keep) S.__sync = keep; commit(); go(view);
}
async function guardarComo() {
  const p = await window.api.saveAs(JSON.stringify(S, (k, v) => (k === '__sync' ? undefined : v), 1), (S.nombre || 'obra').replace(/[\\/:*?"<>|]/g, '') + '.obra');
  if (p) toast('Copia guardada', { action: ['Ver', () => window.api.showItem(p)] });
}
async function exportExcel() {
  const p = await window.api.saveBinary(IO.exportPlan(S, R), `Plan de cables ${today()}.xlsx`, 'xlsx', 'Excel');
  if (p) toast('Excel exportado', { action: ['Abrir', () => window.api.openPath(p)] });
}
const detectCat = (txt, def) => { const t = String(txt || '').toLowerCase(); if (/prysalac|al\s*\/\s*ac|a[eé]rea/.test(t)) return 'LA'; if (/desn|cu\s*desn|cobre/.test(t)) return 'PAT'; if (/\/\s*\d+/.test(t) || /33\s*kv/.test(t)) return 'MT'; return def || 'BT'; };
async function importExcel(ctxCat) {
  if (window.READONLY) return;
  const f = await window.api.pickExcel(); if (!f) return;
  let d;
  try { d = IO.readWorkbook(new Uint8Array(f.data)); } catch (e) { toast('No se pudo leer el Excel', { err: true }); return; }
  const found = ['bobinas', 'circuitos'].filter((k) => d[k] && d[k].length);
  if (!found.length) { toast('No encontré bobinas ni circuitos en ese archivo', { err: true }); return; }
  const res = await modal({
    title: 'Importar Excel', sub: esc(f.path.split(/[\\/]/).pop()),
    body: `<p>Encontré: ${found.map((k) => `<b>${d[k].length}</b> ${k}`).join(' y ')}.</p>
      <div class="form"><label class="full">Tipo de cable<select name="cat"><option value="auto">Usar la columna TIPO de la planilla, o detectar por la sección (Cu desnudo → PAT, 1x50/25 → MT, resto → BT)</option>${Object.keys(CATS).map((k) => `<option value="${k}" ${ctxCat === k ? 'selected' : ''}>Todo como ${CATN[k]}</option>`).join('')}</select></label></div>
      <p class="hint">Lo que ya existe se actualiza (bobinas por N° de fabricante y tipo, circuitos por designación + desde) y lo nuevo se agrega. No se borra nada ni se tocan los tendidos.</p>`,
    buttons: [['Cancelar', 'btn', () => null], ['Importar', 'btn pri', (box) => $('[name=cat]', box).value]],
  });
  if (!res) return;
  const log = [];
  if (d.bobinas) {
    let a = 0, u = 0;
    d.bobinas.forEach((nb) => {
      nb.cat = res === 'auto' ? (nb.cat || detectCat(nb.seccion, ctxCat)) : res;
      const ex = S.bobinas.find((b) => String(b.nro) === String(nb.nro) && b.cat === nb.cat);
      if (ex) { Object.assign(ex, nb, { codigo: nb.codigo || ex.codigo, obs: nb.obs || ex.obs }); u++; } else { S.bobinas.push(Object.assign({ id: uid('b'), _o: Date.now() + a }, nb)); a++; }
    });
    log.push(`bobinas: ${a} nuevas, ${u} actualizadas`);
  }
  if (d.circuitos) {
    let a = 0, u = 0;
    d.circuitos.forEach((nc) => {
      nc.cat = res === 'auto' ? (nc.cat || detectCat(nc.formacion, ctxCat)) : res;
      if (nc.cat === 'PAT') return;
      const ex = S.circuitos.find((c) => !c.vinculo && c.designacion === nc.designacion && c.desde === nc.desde);
      if (ex) { Object.assign(ex, nc, { lineal: nc.lineal ?? ex.lineal }); u++; }
      else { S.circuitos.push(Object.assign({ id: uid('c'), real: {}, zanja: 'no abierta', _o: Date.now() + a }, nc)); a++; }
    });
    log.push(`circuitos: ${a} nuevos, ${u} actualizados`);
  }
  commit('Importado · ' + log.join(' · '));
}

// ======================= respaldo en la nube =======================
async function renderBk() {
  const box = $('#bkCard'); if (!box || !window.api.bkCfg) return;
  const c = await window.api.bkCfg(), f = (x) => new Date(x).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  box.innerHTML = `<h3>Respaldo en la nube (GitHub)</h3>
    <p class="muted" style="margin:0 0 10px">Una copia por día de toda la obra, guardada fuera de esta PC: si la PC servidor se rompe o se pierde, la obra se recupera desde cualquier otra. Se conservan las últimas 90.</p>
    ${!c.listo ? '<div class="alert info" style="display:block">Primero configurá GitHub (usuario y token) en <b>Publicar en la web</b>.</div>' : `
    <div class="alert ${c.err && (!c.ult || c.err.fecha > c.ult.fecha) ? 'error' : c.ult ? 'ok' : 'info'}" style="display:block">${c.err && (!c.ult || c.err.fecha > c.ult.fecha) ? `No se pudo respaldar (${f(c.err.fecha)}): ${esc(c.err.error)}` : c.ult ? `Último respaldo: <b>${f(c.ult.fecha)}</b> en ${esc(c.ult.repo)} (${c.ult.privado ? 'privado' : 'público'}${c.ult.cifrado ? ', cifrado' : ''}) · ${fmt(c.ult.bytes / 1024)} kB` : 'Todavía no se hizo ningún respaldo en la nube.'}</div>
    <div class="form" style="margin-top:10px"><label>Repositorio de respaldo<input type="text" id="bkR" value="${esc(c.bkRepo)}" placeholder="${esc(c.repo)} (el mismo del visor)"></label>
      <label>Clave de respaldo ${c.tieneClave ? '<span class="pill p-done" style="margin-left:4px">cargada</span>' : ''}<input type="password" id="bkK" placeholder="${c.tieneClave ? '•••••••• (dejá vacío para no cambiarla)' : 'Opcional en repositorio privado'}" autocomplete="new-password"></label>
      <label style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="bkA" style="width:auto;margin:0" ${c.bkActivo ? 'checked' : ''}> Respaldar automáticamente una vez por día</label></div>
    <p class="hint">Recomendado: un repositorio <b>privado</b> nuevo (por ejemplo <i>PSFV-OBEII-respaldos</i>), con el token del visor habilitado también para él (permiso <i>Contents: Read and write</i>). Si usás el del visor, que es público, la clave es obligatoria y las copias van cifradas. <b>Anotá la clave en un lugar seguro:</b> sin ella no se puede recuperar un respaldo cifrado.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn" id="bkG">Guardar</button><button class="btn pri" id="bkN">Respaldar ahora</button><button class="btn" id="bkL">Ver respaldos y recuperar…</button>${c.tieneClave ? '<button class="btn ghost" id="bkQ">Quitar clave</button>' : ''}</div>`}`;
  if (!c.listo) return;
  const guardar = async () => { const k = $('#bkK', box).value; await window.api.bkSetCfg(Object.assign({ bkRepo: $('#bkR', box).value, bkActivo: $('#bkA', box).checked }, k ? { bkClave: k } : {})); };
  $('#bkG', box).onclick = async () => { const k = $('#bkK', box).value; if (k && k.length < 8) { toast('La clave tiene que tener al menos 8 caracteres', { err: true }); return; } await guardar(); toast('Respaldo configurado'); renderBk(); };
  const q = $('#bkQ', box); if (q) q.onclick = async () => { if (await confirmar('Quitar clave de respaldo', 'Los próximos respaldos irán sin cifrar (solo se permite en un repositorio privado). Los anteriores siguen necesitando la clave.', 'Quitar')) { await window.api.bkSetCfg({ bkClave: '' }); renderBk(); } };
  $('#bkN', box).onclick = async () => { const k = $('#bkK', box).value; if (k && k.length < 8) { toast('La clave tiene que tener al menos 8 caracteres', { err: true }); return; } await guardar(); const b = $('#bkN', box); b.disabled = true; b.textContent = 'Respaldando…';
    const r = await window.api.bkAhora(); toast(r.ok ? `Respaldo guardado en ${r.repo}` : 'No se pudo respaldar: ' + r.error, { err: !r.ok, ms: 8000 }); renderBk(); };
  $('#bkL', box).onclick = verRespaldos;
}
async function verRespaldos() {
  const r = await window.api.bkLista();
  if (!r.ok) { toast('No se pudo leer la lista: ' + r.error, { err: true }); return; }
  const c = await window.api.bkCfg();
  const res = await modal({ title: 'Respaldos en la nube', sub: `${esc(c.repo)} · ${r.items.length} copia${r.items.length === 1 ? '' : 's'}`, wide: true,
    body: r.items.length ? `<div class="tblwrap" style="max-height:50vh"><table class="tbl"><thead><tr><th>Fecha</th><th>Archivo</th><th class="n">Tamaño</th><th></th></tr></thead><tbody>${r.items.map((x, i) => `<tr><td><b>${fechaCorta(x.nombre.match(/\d{4}-\d{2}-\d{2}/)[0])}</b></td><td class="mono muted">${esc(x.nombre)}</td><td class="n">${fmt(x.bytes / 1024)} kB</td><td>${window.READONLY ? '' : `<button class="btn sm" data-i="${i}">Recuperar…</button>`}</td></tr>`).join('')}</tbody></table></div>
      <p class="hint">Recuperar reemplaza la obra de esta PC (y, si está en red, la de todas) por la del respaldo. Antes se guarda una copia local de lo actual en la carpeta de respaldos.</p>` : '<p class="muted">Todavía no hay respaldos en ese repositorio.</p>',
    buttons: [['Cerrar', 'btn', () => null]] });
  void res;
}
document.addEventListener('click', async (ev) => {
  const b = ev.target.closest('#modal [data-i]'); if (!b || !$('#modal')?.innerText.includes('Respaldos en la nube')) return;
  const r = await window.api.bkLista(), x = r.items[Number(b.dataset.i)]; if (!x) return;
  let clave = null;
  if (x.cifrado && !(await window.api.bkCfg()).tieneClave) {
    cerrarModal(); await new Promise((ok) => setTimeout(ok, 80));
    clave = await modal({ title: 'Clave de respaldo', sub: 'El respaldo está cifrado', body: '<div class="form"><label class="full">Clave<input type="password" id="bkPw"></label></div>', buttons: [['Cancelar', 'btn', () => null], ['Seguir', 'btn pri', (bx) => $('#bkPw', bx).value || false]] });
    if (!clave) return;
  }
  b.disabled = true; b.textContent = 'Bajando…';
  const d = await window.api.bkBajar({ sha: x.sha, cifrado: x.cifrado, clave });
  if (!d.ok) { toast(d.error, { err: true }); b.disabled = false; b.textContent = 'Recuperar…'; return; }
  let st; try { st = JSON.parse(d.text); } catch (_) { toast('El respaldo está dañado', { err: true }); return; }
  if ($('#modal [data-i]')) cerrarModal(); await new Promise((ok) => setTimeout(ok, 80));
  const fecha = x.nombre.match(/\d{4}-\d{2}-\d{2}/)[0];
  if (!(await confirmar('Recuperar respaldo', `Se reemplaza toda la obra por la copia del <b>${fechaCorta(fecha)}</b> (${(st.circuitos || []).length} circuitos, ${(st.bobinas || []).length} bobinas). Lo cargado después de esa fecha se pierde.<br><br>Antes se guarda una copia de lo actual en la carpeta de respaldos de esta PC.`, 'Recuperar', 'btn danger'))) return;
  try { await window.api.snapshot('antes-de-recuperar'); cargarTexto(d.text); toast(`Obra recuperada del respaldo del ${fechaCorta(fecha)}`); } catch (e) { toast('No se pudo cargar el respaldo', { err: true }); }
});
