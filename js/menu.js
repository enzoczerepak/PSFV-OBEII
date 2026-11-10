/* PSFV-OBE II · Menú lateral (se arma desde esta definición), encabezado y ayuda. */
// ======================= MENÚ =======================
// [vista, texto, ícono] o una sección plegable { s: clave, t: título, ico, items: [...], grupos: true }
const MENU = [
  ['resumen', 'Inicio', 'inicio'], ['avance', 'Avance de obra', 'avance'], ['plano', 'Plano de obra', 'plano'], ['partes', 'Partes de campo', 'partes'],
  ['crono', 'Cronograma', 'crono'],
  { s: 'cables', t: 'Tendido de cables', ico: 'cable', grupos: true, items: [['cables', 'Resumen de tendido', 'barras'], ['diario', 'Tendido por fecha', 'dia'], ['zanjas', 'Zanjas', 'zanja'], ['bobinas', 'Bobinas', 'bobina'], ['propuesta', 'Propuesta de tendido', 'lista'], ['puntas', 'Puntas de cable', 'punta']] },
  ['fo', 'Fibra óptica', 'fibra'], ['fundaciones', 'Fundaciones STS', 'sts'], ['sala', 'Sala de operación y control', 'pc', 'pronto'],
  { s: 'hinc', t: 'Hincado', ico: 'hinca', items: [['hincado', 'Avance de hincado', 'barras'], ['hplano', 'Plano de hincado', 'plano'], ['htrk', 'Distribución por tracker', 'trackers'], ['hrec', 'Recepción de hincas', 'camion'], ['hcat', 'Catálogo y distribución', 'libro']] },
  { s: 'maqs', t: 'Maquinaria de obra', ico: 'maquina', items: [['maq', 'Horas mensuales', 'dia'], ['maqev', 'Paradas y mantenimientos', 'llave'], ['maqeq', 'Equipos', 'camion']] },
];
// vistas que no tienen botón propio: se marca la del menú que las contiene
const MENU_ALIAS = { gantt: 'crono' };
const GRUPOS = [['BT', 'BT · 0,8 kV', [['plan', 'Plan de corte', 'corte'], ['circ', 'Circuitos', 'circuito']]], ['MT', 'MT · 33 kV', [['plan', 'Plan de corte', 'corte'], ['circ', 'Circuitos', 'circuito']]], ['PAT', 'PAT · Cu desnudo', [['plan', 'Plan de corte', 'corte'], ['circ', 'Tendidos', 'circuito']]], ['LA', 'LA · Línea aérea', [['plan', 'Plan de corte', 'corte'], ['circ', 'Tramos', 'circuito']]]];
function menuHTML() {
  const btn = ([v, t, i, tg], tag) => `<button data-view="${v}">${ICO[i] || ''}<span>${t}</span>${tag ? `<em class="tg">${tag}</em>` : tg ? `<em class="tg pronto">${tg}</em>` : ''}</button>`;
  const grupos = `<div class="tgrp"><div class="tgh">Tendidos BT, MT, PAT y línea aérea</div>${GRUPOS.map(([c, n, its]) => `<div class="grp g-${c}" data-cat="${c}"><button class="gh" type="button"><i></i><span class="ghn">${n}</span>${ICO.chev}</button>${its.map(([k, t, i]) => btn([c + '-' + k, t, i], c)).join('')}</div>`).join('')}</div>`;
  return MENU.map((m) => (Array.isArray(m) ? btn(m)
    : `<div class="sect" data-sect="${m.s}"><button class="secth" type="button">${ICO[m.ico]}<span>${m.t}</span>${ICO.chev}</button><div class="sectb"><div class="secti">${m.items.map((x) => btn(x)).join('')}${m.grupos ? grupos : ''}</div></div></div>`)).join('') + '<span id="navPill"></span>';
}
(function armarMenu() {
  const nav = document.getElementById('nav'); if (!nav) return;
  nav.innerHTML = menuHTML();
  const lg = document.querySelector('.brand .logo'); if (lg) lg.outerHTML = LOGO;
  const aj = document.querySelector('.sfBtn[data-view="ajustes"]'); if (aj) aj.innerHTML = `${ICO.ajustes}<span>Ajustes</span>`;
  // encabezado: reloj y calculadora arriba, acciones debajo (sin superponerse)
  const top = document.getElementById('top'), topR = document.getElementById('topR'), act = document.getElementById('vActions');
  if (top && topR && act) {
    const col = document.createElement('div'); col.className = 'topcol';
    top.appendChild(col); col.appendChild(topR); col.appendChild(act);
    const ay = document.createElement('button'); ay.id = 'ayudaBtn'; ay.title = 'Mostrar u ocultar las explicaciones de cada pantalla'; ay.innerHTML = ICO.ayuda;
    topR.insertBefore(ay, topR.firstChild);
    let on = false; try { on = localStorage.getItem('ayuda') === '1'; } catch (_) { /* sin storage */ }
    document.body.classList.toggle('ayuda', on); ay.classList.toggle('on', on);
    ay.onclick = () => { const v = !document.body.classList.contains('ayuda'); document.body.classList.toggle('ayuda', v); ay.classList.toggle('on', v); try { localStorage.setItem('ayuda', v ? '1' : '0'); } catch (_) { /* nada */ } };
  }
})();
