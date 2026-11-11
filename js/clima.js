/* PSFV-OBE II · Clima en Oberá (Open-Meteo, sin clave) y registro de días de lluvia de la obra.
   Datos: S.lluvia = { cfg: { desde (AAAA-MM-DD), umbral (mm) }, dias: { fecha: { mm, man } } }
   Un día cuenta como "de lluvia" si se marcó a mano (man = true) o, sin marca, si llovió al menos el umbral (mm). man = false lo descarta. */
const OBERA = { lat: -27.4871, lon: -55.1199, nombre: 'Oberá, Misiones' };
const CLIMA_Q = `latitude=${OBERA.lat}&longitude=${OBERA.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,is_day`
  + '&hourly=temperature_2m,precipitation_probability,precipitation,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,sunrise,sunset'
  + '&timezone=America%2FArgentina%2FBuenos_Aires&past_days=14&forecast_days=16';
let CLIMA = null, climaPend = null;
// códigos WMO → ícono y texto
const WMO = { 0: ['☀️', 'Despejado'], 1: ['🌤️', 'Mayormente despejado'], 2: ['⛅', 'Parcialmente nublado'], 3: ['☁️', 'Nublado'], 45: ['🌫️', 'Niebla'], 48: ['🌫️', 'Niebla con escarcha'],
  51: ['🌦️', 'Llovizna débil'], 53: ['🌦️', 'Llovizna'], 55: ['🌧️', 'Llovizna intensa'], 56: ['🌧️', 'Llovizna helada'], 57: ['🌧️', 'Llovizna helada'], 61: ['🌦️', 'Lluvia débil'], 63: ['🌧️', 'Lluvia'], 65: ['🌧️', 'Lluvia intensa'],
  66: ['🌧️', 'Lluvia helada'], 67: ['🌧️', 'Lluvia helada'], 71: ['🌨️', 'Nevada débil'], 73: ['🌨️', 'Nevada'], 75: ['❄️', 'Nevada intensa'], 77: ['🌨️', 'Granizo fino'],
  80: ['🌦️', 'Chaparrones'], 81: ['🌧️', 'Chaparrones fuertes'], 82: ['⛈️', 'Chaparrones violentos'], 85: ['🌨️', 'Nevadas'], 86: ['🌨️', 'Nevadas fuertes'], 95: ['⛈️', 'Tormenta'], 96: ['⛈️', 'Tormenta con granizo'], 99: ['⛈️', 'Tormenta con granizo'] };
const wmo = (c, noche) => { const w = WMO[c] || ['🌡️', '—']; return noche && (c === 0 || c === 1) ? ['🌙', w[1]] : w; };
const DIRV = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
const dirV = (g) => DIRV[Math.round(((g % 360) + 360) % 360 / 45) % 8];
const lluS = () => { S.lluvia = S.lluvia || {}; S.lluvia.cfg = S.lluvia.cfg || { desde: '2026-11-10', umbral: 1 }; S.lluvia.dias = S.lluvia.dias || {}; return S.lluvia; };
const esLluvia = (f) => { const L = lluS(), d = L.dias[f]; if (!d) return false; if (d.man === true) return true; if (d.man === false) return false; return (Number(d.mm) || 0) >= (Number(L.cfg.umbral) || 1); };
function lluCuenta() {
  const L = lluS(), hoy = today(), lun = lunesDe(hoy), dom = sumDias(lun, 6);
  const fs = Object.keys(L.dias).filter((f) => f >= L.cfg.desde && f <= hoy).sort();
  const lluv = fs.filter(esLluvia);
  const dias = Math.max(1, Math.round((new Date(hoy) - new Date(L.cfg.desde)) / 864e5) + 1);
  return { semana: lluv.filter((f) => f >= lun && f <= dom).length, obra: lluv.length, dias, mmObra: fs.reduce((a, f) => a + (Number(L.dias[f].mm) || 0), 0), lista: lluv, desde: L.cfg.desde };
}
// guarda los mm diarios desde el inicio del registro (solo días ya transcurridos); conserva las marcas manuales
function lluActualizar(d) {
  if (window.READONLY || !d || !d.daily) return;
  const L = lluS(), hoy = today(); let cambio = false;
  d.daily.time.forEach((f, i) => {
    if (f < L.cfg.desde || f > hoy) return;
    // hoy: solo lo que ya llovió (horas transcurridas), no lo pronosticado para el resto del día
    let v = Number(d.daily.precipitation_sum[i]) || 0;
    if (f === hoy && d.hourly) { const hh = new Date().getHours(); v = d.hourly.time.reduce((a, t, k) => a + (t.slice(0, 10) === f && Number(t.slice(11, 13)) <= hh ? Number(d.hourly.precipitation[k]) || 0 : 0), 0); }
    const mm = Math.round(v * 10) / 10, o = L.dias[f] || {};
    if (o.mm !== mm) { L.dias[f] = Object.assign({}, o, { mm }); cambio = true; }
  });
  if (cambio) commit();
}
async function climaCarga(forzar) {
  if (!forzar && CLIMA && Date.now() - (CLIMA.got || 0) < 30 * 60e3) return CLIMA;
  if (climaPend) return climaPend;
  climaPend = (async () => {
    try {
      let o;
      if (window.api && window.api.clima) o = await window.api.clima(CLIMA_Q);
      else { const r = await fetch(`https://api.open-meteo.com/v1/forecast?${CLIMA_Q}`); o = { ts: Date.now(), d: await r.json() }; }
      if (o && o.d) { CLIMA = Object.assign(o, { got: Date.now() }); lluActualizar(o.d); }
      else if (!CLIMA || !CLIMA.d) CLIMA = { error: (o && o.error) || 'sin datos', ts: Date.now(), got: Date.now() };
    } catch (e) { if (!CLIMA || !CLIMA.d) CLIMA = { error: String(e.message || e), ts: Date.now(), got: Date.now() }; }
    climaPend = null;
    const w = $('#climaW'); if (w) { w.outerHTML = climaWidgetHTML(); bindClima(); }
    return CLIMA;
  })();
  return climaPend;
}
// ---- tarjeta del Inicio ----
function climaWidgetHTML() {
  const C = lluCuenta();
  const pie = `<div class="clluv"><span>🌧️ Días de lluvia</span><div><b>${C.semana}</b><small>esta semana</small></div><div><b>${C.obra}</b><small>en la obra · desde ${fechaCorta(C.desde).slice(0, 5)}</small></div></div>`;
  if (!CLIMA || !CLIMA.d) return `<div class="card climaw" id="climaW" data-clima="1" title="Pronóstico extendido"><div class="mh"><div class="cico">🌡️</div><div><h3>Clima en Oberá</h3><div class="muted">${CLIMA && CLIMA.error ? 'Sin conexión para traer el pronóstico' : 'Cargando el pronóstico…'}</div></div></div>${pie}</div>`;
  const d = CLIMA.d, c = d.current, [ic, tx] = wmo(c.weather_code, !c.is_day), i0 = d.daily.time.indexOf(today());
  const di = i0 >= 0 ? i0 : 0, dd = d.daily;
  const prox = [1, 2, 3].map((k) => dd.time[di + k] ? `<div class="cmini"><span>${['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][new Date(dd.time[di + k] + 'T12:00').getDay()]}</span><i>${wmo(dd.weather_code[di + k])[0]}</i><b>${Math.round(dd.temperature_2m_max[di + k])}°</b><small>${Math.round(dd.temperature_2m_min[di + k])}°</small>${dd.precipitation_probability_max[di + k] >= 30 ? `<em>${dd.precipitation_probability_max[di + k]}%</em>` : ''}</div>` : '').join('');
  return `<div class="card climaw" id="climaW" data-clima="1" title="Ver el pronóstico extendido"><div class="chead"><h3>Clima en Oberá</h3><span class="muted">pronóstico ›</span></div><div class="cnow"><div class="cico">${ic}</div><div class="ctemp">${Math.round(c.temperature_2m)}°<small>sensación ${Math.round(c.apparent_temperature)}°</small></div>
      <div class="cdat"><div><b>${tx}</b></div><div class="muted">↑${Math.round(dd.temperature_2m_max[di])}° ↓${Math.round(dd.temperature_2m_min[di])}° · 💧 ${dd.precipitation_probability_max[di]}%</div><div class="muted">💨 ${Math.round(c.wind_speed_10m)} km/h ${dirV(c.wind_direction_10m)} · ${c.relative_humidity_2m}% hum.</div></div></div>
    <div class="cprox">${prox}</div>${pie}<div class="muted cfoot">${CLIMA.offline ? 'Sin conexión: último pronóstico de ' + new Date(CLIMA.ts).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : 'Actualizado ' + new Date(CLIMA.ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} · tocá para el pronóstico extendido</div></div>`;
}
function bindClima() { const w = $('#climaW'); if (w) w.onclick = () => verClima(); }
// ---- pronóstico extendido y registro de lluvias ----
async function verClima() {
  await climaCarga();
  const C = lluCuenta(), L = lluS(), ro = window.READONLY;
  let cuerpo = '';
  if (CLIMA && CLIMA.d) {
    const dd = CLIMA.d.daily, i0 = Math.max(0, dd.time.indexOf(today()));
    const dias = dd.time.map((f, i) => i).filter((i) => i >= i0);
    cuerpo += `<div class="cext">${dias.map((i) => { const f = dd.time[i], dt = new Date(f + 'T12:00'), [ic, tx] = wmo(dd.weather_code[i]);
      return `<div class="cday ${dd.precipitation_sum[i] >= (Number(L.cfg.umbral) || 1) ? 'lluv' : ''}"><b>${i === i0 ? 'Hoy' : ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][dt.getDay()]}</b><small>${fechaCorta(f).slice(0, 5)}</small><i title="${tx}">${ic}</i>
        <span class="cmx">${Math.round(dd.temperature_2m_max[i])}°</span><span class="cmn">${Math.round(dd.temperature_2m_min[i])}°</span><span class="cpr" title="Probabilidad de lluvia">💧${dd.precipitation_probability_max[i]}%</span><span class="cmm">${dd.precipitation_sum[i] ? fmt(dd.precipitation_sum[i], 1) + ' mm' : '–'}</span><span class="cvi" title="Viento máximo / ráfagas">${Math.round(dd.wind_speed_10m_max[i])}/${Math.round(dd.wind_gusts_10m_max[i])}</span></div>`; }).join('')}</div>
      <p class="muted" style="font-size:12px;margin:6px 0 14px">Pronóstico de 16 días para ${OBERA.nombre} (Open-Meteo). Viento en km/h (máximo / ráfagas). Los días con lluvia prevista ≥ ${fmt(L.cfg.umbral, 1)} mm van resaltados. ${CLIMA.offline ? '<b>Sin conexión:</b> se muestra el último pronóstico guardado.' : ''}</p>`;
    // próximas 24 h
    const h = CLIMA.d.hourly, ah = new Date(), k0 = h.time.findIndex((t) => new Date(t) >= new Date(ah.getFullYear(), ah.getMonth(), ah.getDate(), ah.getHours()));
    if (k0 >= 0) cuerpo += `<h3 style="margin:0 0 6px">Próximas 24 horas</h3><div class="chor">${h.time.slice(k0, k0 + 24).map((t, j) => { const k = k0 + j; return `<div><small>${t.slice(11, 13)} h</small><i>${wmo(h.weather_code[k], Number(t.slice(11, 13)) < 7 || Number(t.slice(11, 13)) > 19)[0]}</i><b>${Math.round(h.temperature_2m[k])}°</b><em style="opacity:${h.precipitation_probability[k] >= 20 ? 1 : 0.35}">${h.precipitation_probability[k]}%</em></div>`; }).join('')}</div>`;
  } else cuerpo += `<div class="alert aviso" style="display:block">No se pudo traer el pronóstico (${esc((CLIMA && CLIMA.error) || 'sin conexión')}). Revisá la conexión a internet de esta PC.</div>`;
  // registro de lluvias
  const fs = []; for (let f = today(); f >= L.cfg.desde; f = sumDias(f, -1)) fs.push(f);
  cuerpo += `<h3 style="margin:18px 0 6px">Días de lluvia de la obra</h3>
    <div class="kpis k3" style="margin-bottom:10px">${kpi('Esta semana', C.semana, 'días', 0)}${kpi('Desde el ' + fechaCorta(C.desde), C.obra, `de ${C.dias} días`, 0)}${kpi('Lluvia acumulada', C.mmObra, 'mm', 1)}</div>
    <div class="form" style="grid-template-columns:repeat(2,minmax(0,220px));margin-bottom:8px"><label>Registro desde<input type="date" id="lluDesde" value="${L.cfg.desde}" ${ro ? 'disabled' : ''}></label><label>Día de lluvia desde (mm)<input type="number" id="lluUmb" min="0.1" step="0.5" value="${L.cfg.umbral}" ${ro ? 'disabled' : ''}></label></div>
    <div class="tblwrap" style="max-height:260px"><table class="tbl"><thead><tr><th>Fecha</th><th class="n">Lluvia (mm)</th><th>Día de lluvia</th><th></th></tr></thead><tbody>${fs.map((f) => { const o = L.dias[f] || {}, si = esLluvia(f);
      return `<tr><td>${['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][new Date(f + 'T12:00').getDay()]} ${fechaCorta(f)}${f === today() ? ' <span class="muted">(hoy, parcial)</span>' : ''}</td><td class="n">${o.mm != null ? fmt(o.mm, 1) : '–'}</td>
        <td>${si ? '<span class="pill p-bad">🌧️ sí</span>' : '<span class="pill p-prov">no</span>'}${o.man != null ? ' <small class="muted">(a mano)</small>' : ''}</td>
        <td>${ro ? '' : `<button class="btn sm ghost" data-lf="${f}">${si ? 'No fue día de lluvia' : 'Marcar día de lluvia'}</button>${o.man != null ? ` <button class="btn sm ghost" data-lr="${f}" title="Volver al criterio automático">↺</button>` : ''}`}</td></tr>`; }).join('')}</tbody></table></div>
    <p class="hint">Se cuenta automáticamente con la lluvia medida en Oberá: un día es de lluvia si cayeron al menos ${fmt(L.cfg.umbral, 1)} mm. Si en la obra fue distinto (por ejemplo, se perdió la jornada con menos lluvia), marcalo a mano.</p>`;
  const pm = modal({ title: '🌦️ Clima en Oberá · pronóstico extendido', wide: true, body: cuerpo, buttons: [['Actualizar', 'btn', () => 'upd'], ['Cerrar', 'btn pri', () => null]] });
  const box = $('#modal .mbox'); box.classList.add('wide');
  if (!ro) {
    $('#lluDesde', box).onchange = (e) => { if (e.target.value) { L.cfg.desde = e.target.value; commit('Registro de lluvias desde ' + fechaCorta(e.target.value)); cerrarModal(); climaCarga(true).then(() => verClima()); } };
    $('#lluUmb', box).onchange = (e) => { const v = Number(e.target.value); if (v > 0) { L.cfg.umbral = v; commit(`Día de lluvia: desde ${fmt(v, 1)} mm`); cerrarModal(); verClima(); } };
    $$('[data-lf]', box).forEach((b) => { b.onclick = () => { const f = b.dataset.lf; L.dias[f] = Object.assign({}, L.dias[f] || {}, { man: !esLluvia(f) }); commit(`${fechaCorta(f)}: ${esLluvia(f) ? 'día de lluvia' : 'sin lluvia'}`); cerrarModal(); verClima(); }; });
    $$('[data-lr]', box).forEach((b) => { b.onclick = () => { const f = b.dataset.lr; const o = Object.assign({}, L.dias[f]); delete o.man; L.dias[f] = o; commit(`${fechaCorta(f)}: criterio automático`); cerrarModal(); verClima(); }; });
  }
  const r = await pm;
  if (r === 'upd') { await climaCarga(true); verClima(); }
}
function cerrarModal() { const b = [...document.querySelectorAll('#modal .mfoot button')].find((x) => x.textContent === 'Cerrar'); if (b) b.click(); }
