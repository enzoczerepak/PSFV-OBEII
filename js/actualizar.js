/* PSFV-OBE II · Actualización automática (barra de aviso, tarjeta en Ajustes) y visor web al día. */
// ======================= ACTUALIZACIÓN =======================
let UPD = null;
function updBarra() {
  let bar = $('#updBar');
  const u = UPD;
  const mostrar = u && !window.READONLY && (u.listo || u.bajando);
  if (!mostrar) { if (bar) bar.remove(); return; }
  if (!bar) { bar = document.createElement('div'); bar.id = 'updBar'; document.body.appendChild(bar); }
  if (u.bajando) { bar.className = 'updbar baja'; bar.innerHTML = `<span class="updic">${ICO.sol}</span><span>Bajando la versión <b>${esc(u.bajando.version)}</b> del servidor… ${fmt((u.bajando.p || 0) * 100)} %</span>`; return; }
  bar.className = 'updbar';
  bar.innerHTML = `<span class="updic">${ICO.sol}</span><span>Versión nueva <b>${esc(u.listo.version)}</b> lista para instalar <span class="muted">(${esc(u.listo.origen)})</span> · se instala sola al cerrar el programa</span>
    <button class="btn sm pri" id="updYa">Instalar y reiniciar</button><button class="btn sm ghost" id="updX" title="Ocultar hasta reiniciar">✕</button>`;
  $('#updYa', bar).onclick = updInstalar;
  $('#updX', bar).onclick = () => bar.remove();
}
async function updInstalar() {
  if (NET.modo === 'cliente' && Sync.meta(S).pend && Object.keys(Sync.meta(S).pend).length) { try { await syncNow(); } catch (_) { /* sigue */ } }
  if (!(await confirmar('Instalar actualización', `Se cierra el programa, se instala la versión ${esc(UPD.listo.version)} y vuelve a abrirse solo (tarda menos de un minuto). Los datos se conservan.`, 'Instalar y reiniciar'))) return;
  toast('Instalando… el programa se vuelve a abrir solo');
  await window.api.updInstalar();
}
function updCardHTML() {
  const u = UPD || {};
  const est = u.bajando ? `Bajando ${esc(u.bajando.version)} del servidor (${fmt((u.bajando.p || 0) * 100)} %)` : u.listo ? `<b>Versión ${esc(u.listo.version)} lista</b> (${esc(u.listo.origen)})` : 'Al día';
  return `<h3>Actualizaciones</h3><div class="pq"><div class="kv"><span>Versión instalada</span><b>${esc(u.version || '')}</b></div><div class="kv"><span>Estado</span><b>${est}</b></div>
    ${u.distribuye ? `<div class="kv"><span>Para la red</span><b>reparte la ${esc(u.distribuye.version)}</b></div>` : ''}${u.error ? `<div class="kv"><span>Último error</span><b class="tneg">${esc(u.error)}</b></div>` : ''}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">${u.listo ? '<button class="btn pri" id="uInst">Instalar y reiniciar</button>' : ''}<button class="btn" id="uRev">Buscar ahora</button><button class="btn ghost" id="uElegir">Elegir instalador…</button></div>
    <p class="hint">Cómo funciona: dejá el instalador nuevo en <b>Descargas</b> (o en Descargas\Plan de Cables BT) de la PC servidor; el programa lo detecta, se actualiza y queda <b>repartiéndolo por la red</b>. Las demás PCs (clientes) lo bajan solas del servidor, lo verifican y se instalan al reiniciar o al cerrar el programa. El visor web se actualiza solo cuando cambia la versión.</p>`;
}
function updCardBind() {
  if ($('#uInst')) $('#uInst').onclick = updInstalar;
  if ($('#uRev')) $('#uRev').onclick = async () => { $('#uRev').disabled = true; UPD = await window.api.updRevisar(); updBarra(); const c = $('#updCard'); if (c) { c.innerHTML = updCardHTML(); updCardBind(); } toast(UPD.listo ? `Versión ${UPD.listo.version} lista para instalar` : 'No hay versiones nuevas'); };
  if ($('#uElegir')) $('#uElegir').onclick = async () => {
    const f = await window.api.pickInstalador(); if (!f) return;
    const r = await window.api.updElegir(f); if (r && r.error) { toast(r.error, { err: true, ms: 7000 }); return; }
    UPD = r; updBarra(); const c = $('#updCard'); if (c) { c.innerHTML = updCardHTML(); updCardBind(); }
  };
}
async function updIniciar() {
  if (!window.api.updEstado) return;
  UPD = await window.api.updEstado(); updBarra();
  window.api.onUpd((d) => { UPD = d; updBarra(); const c = $('#updCard'); if (c) { c.innerHTML = updCardHTML(); updCardBind(); } });
  // el visor web acompaña la versión del programa (solo la PC que publica)
  try {
    const W = await window.api.webCfg();
    if (W && W.owner && W.repo && W.tieneToken && NET.modo !== 'cliente' && W.visorV !== UPD.version) {
      setTimeout(async () => { const r = await window.api.webInstalarVisor(); if (r && r.ok) toast(`Visor web actualizado a la versión ${UPD.version}`); }, 30000);
    }
  } catch (_) { /* sin web */ }
}
