/* PSFV-OBE II · Arranque de la aplicación. */
// ======================= inicio =======================
async function init() {
  $$('#nav button[data-view], .sfBtn').forEach((b) => { b.onclick = () => go(b.dataset.view); });
  let secSt = {}; try { secSt = JSON.parse(localStorage.getItem('navSect') || '{}'); } catch (_) { /* sin storage */ }
  $$('#nav .sect').forEach((x) => { if (x.dataset.sect in secSt) x.classList.toggle('open', !!secSt[x.dataset.sect]); $('.secth', x).onclick = () => abrirSect(x, !x.classList.contains('open')); $('.sectb', x).addEventListener('transitionend', () => pillUpd()); });
  const r = await window.api.load();
  const st = JSON.parse(r.text);
  // migración: agregar circuitos de MT de la lista de cables si el proyecto no los tiene
  if (!r.seed && !(st.circuitos || []).some((c) => c.cat === 'MT')) {
    seedCache = JSON.parse(await window.api.seed());
    st.circuitos = (st.circuitos || []).concat(seedCache.circuitos.filter((c) => c.cat === 'MT'));
    st.fuente = seedCache.fuente;
  }
  // migración: cronograma de obra (Rev A s07) si el proyecto no lo tiene
  if (!window.READONLY && !st.cronoMeta && !(st.cronoTareas || []).length) {
    seedCache = seedCache || JSON.parse(await window.api.seed());
    st.cronoTareas = seedCache.cronoTareas || []; st.cronoMeta = seedCache.cronoMeta || null;
  }
  S = normalizar(st);
  Sync.ordenar(S);
  R = Engine.calcular(S); S.compromiso = R.compromiso;
  NET = await window.api.netCfg();
  if (window.READONLY) { window.api.onNetReq = () => {}; }
  Sync.base(S, NET.modo);
  if (NET.modo === 'servidor') Sync.prepararServidor(S);
  Sync.sellar(S, NET.modo);
  await window.api.save(JSON.stringify(S));
  window.api.onNetReq(atenderRed);
  if (!window.READONLY && window.api.webCfg) WEB = await window.api.webCfg();
  window.api.netObra(S.nombre);
  setTimeout(async () => {
    if (NET.modo !== 'local') return;
    const f = await window.api.netServidores();
    if (f.length) toast(`Hay un servidor de obra en la red (${f[0].obra || f[0].host})`, { action: ['Conectar', () => conectarEncontrado(f[0])], ms: 12000 });
  }, 6000);
  arrancarRed();
  window.api.onOpenFile((d) => { try { cargarTexto(d.text); toast('Proyecto abierto'); } catch (e) { toast('Archivo inválido', { err: true }); } });
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key.toLowerCase() === 's') { e.preventDefault(); guardarComo(); }
    if (e.ctrlKey && e.key.toLowerCase() === 'o') { e.preventDefault(); abrir(); }
  });
  marca();
  go('resumen');
  if (!window.READONLY) updIniciar();
  if (ED.blank && !S.parque && !window.READONLY) setTimeout(() => asistenteParque(true), 400);
}
function recargar(text) { const st = JSON.parse(text); S = normalizar(st); Sync.ordenar(S); R = Engine.calcular(S); render(false); toast('Datos actualizados'); }
window.__app = { editFibra, exportFibra, printFibra, registrarHoras, exportMaq, editMaquina, editEvento, printMaqMes, exportStock, printStock, stockConsolidado, verMargenes, MG, cierreParcial, cerrarZanjas, simularTendido, margenStock, importarPdf, asistenteParque, recibirParte, aprobarParte, revisarBuzon, aplicarCrono, tareasDeProject, fechaEtapa, cronoCalc, editTarea, leerMSPDI, setEtapa, printFund, exportFund, printDia, printMes, printAvance, printPuntas, exportTendidos, exportPuntas, registrarPuntas, recargar, get S() { return S; }, get R() { return R; }, go, commit, setZanja, tender, cerrarZanjas, sacarDeZanja, Engine, conectar, syncNow, get NET() { return NET; }, get netStatus() { return netStatus; } };
init();
