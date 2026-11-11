/* PSFV-OBE II · Clima en el parque (pronóstico Open-Meteo, observación de la estación SMN Oberá) y registro de días de lluvia de la obra.
   Datos: S.lluvia = { cfg: { desde (AAAA-MM-DD), umbral (mm) }, dias: { fecha: { mm, man } } }
   dias[f] = { mm (estimación de Open-Meteo, solo referencia), man (true/false: el día se marcó a mano como de lluvia o no), trab ('si' | 'parcial' | 'no': si se trabajó) }
   Un día es "de lluvia" si se marcó a mano; sin marca se sugiere con la estimación (≥ umbral mm). */
const OBERA = { lat: -27.4857, lon: -55.0692, nombre: 'el parque (27°29′08″S 55°04′09″O)' };
// estación meteorológica más cercana con datos abiertos: SMN Oberá (observación horaria, "tiempo presente")
const SMN_EST = 'Oberá';
let SMN = null;
const smnLluvia = (t) => /tormenta|lluv|llovizn|chaparr|precipit|granizo/i.test(t || '');
const smnFresco = () => { if (!SMN || !SMN.fecha || SMN.error) return null; const t = new Date(`${SMN.fecha}T${SMN.hora || '00:00'}:00`); return Date.now() - t.getTime() < 3 * 3600e3 ? SMN : null; };
function smnCond(t) {
  t = (t || '').toLowerCase();
  return /tormenta/.test(t) ? 'tormenta' : /llovizn/.test(t) ? 'llovizna' : /lluv|chaparr|precipit|granizo/.test(t) ? 'lluvia' : /niebla|neblina|bruma/.test(t) ? 'niebla'
    : /parcial|algo nublado|poco nublado/.test(t) ? 'parcial' : /nublado|cubierto/.test(t) ? 'nublado' : /despejado|claro|ninguno/.test(t) ? 'despejado' : null;
}
const SMN_DIR = { norte: 'N', noreste: 'NE', este: 'E', sudeste: 'SE', sureste: 'SE', sur: 'S', sudoeste: 'SO', suroeste: 'SO', oeste: 'O', noroeste: 'NO', calma: 'calma' };
const smnDir = (t) => SMN_DIR[String(t || '').toLowerCase().trim()] || t || '';
const SMN_ICO = { despejado: '☀️', parcial: '⛅', nublado: '☁️', niebla: '🌫️', llovizna: '🌦️', lluvia: '🌧️', tormenta: '⛈️' };
// registra en el día las observaciones de la estación con lluvia (sirven para sugerir el "¿Llovió?")
function smnRegistrar(o) {
  if (window.READONLY || !o || !o.fecha || o.offline || !smnLluvia(o.estado)) return;
  const L = lluS(); if (o.fecha < L.cfg.desde) return;
  const d = Object.assign({}, L.dias[o.fecha] || {}), obs = (d.smn || []).slice(), txt = `${o.hora} ${o.estado}`;
  if (obs.includes(txt)) return;
  obs.push(txt); d.smn = obs; L.dias[o.fecha] = d; commit();
}
async function smnCarga() {
  if (!window.api || !window.api.smn) return null;
  try { const o = await window.api.smn(SMN_EST); if (o && !o.error) { SMN = o; smnRegistrar(o); } else if (!SMN) SMN = o; } catch (e) { if (!SMN) SMN = { error: String(e.message || e) }; }
  return SMN;
}
if (typeof window !== 'undefined' && window.api && window.api.smn) setInterval(() => { smnCarga().then(() => { if (typeof view !== 'undefined' && view === 'resumen') heroRefrescar(); }); }, 30 * 60e3);
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
const esLluvia = (f) => { const L = lluS(), d = L.dias[f]; if (!d) return false; if (d.man === true) return true; if (d.man === false) return false; return (Number(d.mm) || 0) >= (Number(L.cfg.umbral) || 1) || !!(d.smn && d.smn.length); };
function lluCuenta() {
  const L = lluS(), hoy = today(), lun = lunesDe(hoy), dom = sumDias(lun, 6);
  const fs = []; for (let f = L.cfg.desde; f <= hoy; f = sumDias(f, 1)) fs.push(f);
  const lluv = fs.filter(esLluvia), tr = (f) => (L.dias[f] || {}).trab, sem = (f) => f >= lun && f <= dom;
  const perd = lluv.filter((f) => tr(f) === 'no'), parc = lluv.filter((f) => tr(f) === 'parcial');
  return { semana: lluv.filter(sem).length, obra: lluv.length, dias: fs.length, lista: lluv, desde: L.cfg.desde,
    perdSem: perd.filter(sem).length, perdObra: perd.length, parcObra: parc.length, sinDato: lluv.filter((f) => !tr(f)).length,
    mmObra: fs.reduce((a, f) => a + (Number((L.dias[f] || {}).mm) || 0), 0) };
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
      const ps = smnCarga();
      if (window.api && window.api.clima) o = await window.api.clima(CLIMA_Q);
      else { const r = await fetch(`https://api.open-meteo.com/v1/forecast?${CLIMA_Q}`); o = { ts: Date.now(), d: await r.json() }; }
      await ps;
      if (o && o.d) { CLIMA = Object.assign(o, { got: Date.now() }); lluActualizar(o.d); }
      else if (!CLIMA || !CLIMA.d) CLIMA = { error: (o && o.error) || 'sin datos', ts: Date.now(), got: Date.now() };
    } catch (e) { if (!CLIMA || !CLIMA.d) CLIMA = { error: String(e.message || e), ts: Date.now(), got: Date.now() }; }
    climaPend = null;
    heroRefrescar();
    return CLIMA;
  })();
  return climaPend;
}
// ---- cielo del banner según el clima real ----
// cond: despejado | parcial | nublado | niebla | llovizna | lluvia | tormenta
function climaCielo() {
  if (!CLIMA || !CLIMA.d || !CLIMA.d.current) return null;
  const d = CLIMA.d, c = d.current, k = Number(c.weather_code);
  let cond = k <= 1 ? 'despejado' : k === 2 ? 'parcial' : k === 3 ? 'nublado' : k === 45 || k === 48 ? 'niebla' : (k >= 51 && k <= 57) ? 'llovizna'
    : k >= 95 ? 'tormenta' : (k >= 61 && k <= 67) || (k >= 80 && k <= 82) || (k >= 71 && k <= 77) || k === 85 || k === 86 ? 'lluvia' : 'nublado';
  const sm = smnFresco(), sc = sm && smnCond(sm.estado);
  if (sc) cond = sc;
  const i = Math.max(0, d.daily.time.indexOf(today())), hh = (t) => { if (!t) return null; const m = /T(\d\d):(\d\d)/.exec(t); return m ? Number(m[1]) + Number(m[2]) / 60 : null; };
  return { cond, k, dia: !!c.is_day, rafaga: Number(c.wind_gusts_10m) || 0, viento: Number(c.wind_speed_10m) || 0, salida: hh(d.daily.sunrise && d.daily.sunrise[i]), puesta: hh(d.daily.sunset && d.daily.sunset[i]), lluviaAhora: Number(c.precipitation) || 0, smn: !!sc };
}
function heroRefrescar() {
  const h = document.querySelector('.hero.hmain'); if (!h || typeof heroHTML !== 'function') return;
  h.outerHTML = heroHTML(); bindClima();
}
// ---- panel del clima (dentro del banner del Inicio) ----
function climaWidgetHTML() {
  const C = lluCuenta();
  const pie = `<div class="clluv"><span>🌧️ Lluvia en la obra <small>desde ${fechaCorta(C.desde).slice(0, 5)}</small></span><div><b>${C.semana}</b><small>días esta semana</small></div><div><b>${C.obra}</b><small>días en total</small></div><div><b class="perd">${C.perdSem}</b><small>jornadas perdidas (sem.)</small></div><div><b class="perd">${C.perdObra}</b><small>jornadas perdidas</small></div></div>`;
  if (!CLIMA || !CLIMA.d) return `<div class="hclima" id="climaW" title="Pronóstico extendido"><div class="chead"><b>Clima en la obra</b><span>pronóstico ›</span></div><div class="cnow"><div class="cico">🌡️</div><div class="cdat">${CLIMA && CLIMA.error ? 'Sin conexión para traer el pronóstico' : 'Cargando el pronóstico…'}</div></div>${pie}</div>`;
  const d = CLIMA.d, c = d.current, sm = smnFresco(), sc = sm && smnCond(sm.estado);
  let [ic, tx] = wmo(c.weather_code, !c.is_day);
  if (sm) { tx = sm.estado; if (sc) ic = !c.is_day && (sc === 'despejado' || sc === 'parcial') ? '🌙' : SMN_ICO[sc]; }
  const tA = sm && sm.temp != null ? sm.temp : c.temperature_2m, stA = sm && sm.st != null ? sm.st : sm ? null : c.apparent_temperature;
  const vA = sm && sm.vvel != null ? `${Math.round(sm.vvel)} km/h ${smnDir(sm.vdir)}` : `${Math.round(c.wind_speed_10m)} km/h ${dirV(c.wind_direction_10m)}`;
  const hA = sm && sm.hum != null ? sm.hum : c.relative_humidity_2m, i0 = d.daily.time.indexOf(today());
  const di = i0 >= 0 ? i0 : 0, dd = d.daily;
  const prox = [1, 2, 3].map((k) => dd.time[di + k] ? `<div class="cmini"><span>${['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][new Date(dd.time[di + k] + 'T12:00').getDay()]}</span><i>${wmo(dd.weather_code[di + k])[0]}</i><b>${Math.round(dd.temperature_2m_max[di + k])}°</b><small>${Math.round(dd.temperature_2m_min[di + k])}°</small>${dd.precipitation_probability_max[di + k] >= 30 ? `<em>${dd.precipitation_probability_max[di + k]}%</em>` : ''}</div>` : '').join('');
  const act = (sm ? `estación SMN ${esc(sm.est)} ${sm.hora} h · ` : '') + (CLIMA.offline ? 'sin conexión · pronóstico de ' + new Date(CLIMA.ts).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : 'pronóstico ' + new Date(CLIMA.ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }));
  return `<div class="hclima" id="climaW" title="Ver el pronóstico extendido"><div class="chead"><b>Clima en la obra</b><span>pronóstico ›</span></div>
    <div class="cnow"><div class="cico">${ic}</div><div class="ctemp">${Math.round(tA)}°${stA != null ? `<small>ST ${Math.round(stA)}°</small>` : ''}</div>
      <div class="cdat"><b>${tx}</b><div>↑${Math.round(dd.temperature_2m_max[di])}° ↓${Math.round(dd.temperature_2m_min[di])}° · 💧 ${dd.precipitation_probability_max[di]}%</div><div>💨 ${vA}${c.wind_gusts_10m >= 30 ? ` · ráf. ${Math.round(c.wind_gusts_10m)}` : ''} · ${hA}%</div></div></div>
    <div class="cprox">${prox}</div>${pie}<div class="cfoot">${act}</div></div>`;
}
function bindClima() { const w = $('#climaW'); if (w) w.onclick = (e) => { e.stopPropagation(); verClima(); }; }
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
      <p class="muted" style="font-size:12px;margin:6px 0 14px">Pronóstico de 16 días para ${OBERA.nombre} (Open-Meteo).${SMN && !SMN.error ? ` Ahora (estación SMN ${esc(SMN.est)}, ${fechaCorta(SMN.fecha).slice(0, 5)} ${SMN.hora} h): <b>${esc(SMN.estado)}</b>, ${SMN.temp != null ? fmt(SMN.temp, 1) + ' °C' : ''}${SMN.hum != null ? ', ' + SMN.hum + ' % de humedad' : ''}${SMN.vvel != null ? `, viento ${esc(SMN.vdir)} ${SMN.vvel} km/h` : ''}${SMN.pres != null ? `, ${fmt(SMN.pres, 1)} hPa` : ''}.` : ''} Viento en km/h (máximo / ráfagas). Los días con lluvia prevista ≥ ${fmt(L.cfg.umbral, 1)} mm van resaltados. ${CLIMA.offline ? '<b>Sin conexión:</b> se muestra el último pronóstico guardado.' : ''}</p>`;
    // próximas 24 h
    const h = CLIMA.d.hourly, ah = new Date(), k0 = h.time.findIndex((t) => new Date(t) >= new Date(ah.getFullYear(), ah.getMonth(), ah.getDate(), ah.getHours()));
    if (k0 >= 0) cuerpo += `<h3 style="margin:0 0 6px">Próximas 24 horas</h3><div class="chor">${h.time.slice(k0, k0 + 24).map((t, j) => { const k = k0 + j; return `<div><small>${t.slice(11, 13)} h</small><i>${wmo(h.weather_code[k], Number(t.slice(11, 13)) < 7 || Number(t.slice(11, 13)) > 19)[0]}</i><b>${Math.round(h.temperature_2m[k])}°</b><em style="opacity:${h.precipitation_probability[k] >= 20 ? 1 : 0.35}">${h.precipitation_probability[k]}%</em></div>`; }).join('')}</div>`;
  } else cuerpo += `<div class="alert aviso" style="display:block">No se pudo traer el pronóstico (${esc((CLIMA && CLIMA.error) || 'sin conexión')}). Revisá la conexión a internet de esta PC.</div>`;
  // registro de lluvias: por día, ¿llovió? y ¿se trabajó?
  const fs = []; for (let f = today(); f >= L.cfg.desde; f = sumDias(f, -1)) fs.push(f);
  const seg = (f, campo, val, txt, on, cls) => `<button class="btn sm ${on ? cls || 'pri' : 'ghost'}" data-f="${f}" data-c="${campo}" data-v="${val}" ${ro ? 'disabled' : ''}>${txt}</button>`;
  cuerpo += `<h3 style="margin:18px 0 6px">Días de lluvia y jornadas de la obra</h3>
    <div class="kpis k4" style="margin-bottom:10px">${kpi('Días de lluvia esta semana', C.semana, 'días', 0)}${kpi('Días de lluvia desde el ' + fechaCorta(C.desde), C.obra, `de ${C.dias} días`, 0)}${kpi('Jornadas perdidas por lluvia', C.perdObra, `días${C.parcObra ? ` + ${C.parcObra} parcial${C.parcObra === 1 ? '' : 'es'}` : ''}`, 0)}${kpi('Jornadas perdidas esta semana', C.perdSem, 'días', 0)}</div>
    ${C.sinDato && !ro ? `<div class="alert" style="display:block;margin-bottom:8px">Hay ${C.sinDato} día${C.sinDato === 1 ? '' : 's'} de lluvia sin indicar si se trabajó.</div>` : ''}
    <div class="tblwrap" style="max-height:320px"><table class="tbl"><thead><tr><th>Fecha</th><th>¿Llovió?</th><th>¿Se trabajó?</th><th title="Observaciones con lluvia de la estación SMN Oberá (se registran mientras el programa está abierto)">Estación SMN</th><th class="n" title="Estimación del servicio de clima para el parque, solo de referencia">Estimado (mm)</th></tr></thead><tbody>${fs.map((f) => { const o = L.dias[f] || {}, si = esLluvia(f), sug = o.man == null;
      return `<tr><td>${['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][new Date(f + 'T12:00').getDay()]} ${fechaCorta(f)}${f === today() ? ' <span class="muted">(hoy)</span>' : ''}</td>
        <td style="white-space:nowrap">${seg(f, 'man', '1', '🌧️ Sí', si, sug ? 'csug' : 'pri')} ${seg(f, 'man', '0', 'No', !si, sug ? 'csug' : 'pri')}${sug ? ' <small class="muted">sugerido</small>' : ''}</td>
        <td style="white-space:nowrap">${seg(f, 'trab', 'si', 'Sí', o.trab === 'si')} ${seg(f, 'trab', 'parcial', 'Parcial', o.trab === 'parcial')} ${seg(f, 'trab', 'no', 'No', o.trab === 'no', 'danger')}</td>
        <td class="muted" style="font-size:12px">${o.smn && o.smn.length ? `🌧️ ${esc(o.smn.slice(0, 3).join(' · '))}${o.smn.length > 3 ? ` (+${o.smn.length - 3})` : ''}` : '–'}</td>
        <td class="n muted">${o.mm != null ? fmt(o.mm, 1) : '–'}</td></tr>`; }).join('')}</tbody></table></div>
    <div class="form" style="grid-template-columns:repeat(2,minmax(0,220px));margin:10px 0 0"><label>Registro desde<input type="date" id="lluDesde" value="${L.cfg.desde}" ${ro ? 'disabled' : ''}></label><label>Sugerir lluvia desde (mm estimados)<input type="number" id="lluUmb" min="0.1" step="0.5" value="${L.cfg.umbral}" ${ro ? 'disabled' : ''}></label></div>
    <p class="hint">No hace falta pluviómetro: marcá cada día si llovió y si se pudo trabajar. Mientras no lo marques, el "¿Llovió?" se sugiere (en gris) si la estación SMN Oberá informó lluvia, llovizna o tormenta en alguna observación del día, o si la lluvia estimada para el parque supera el umbral. Las jornadas perdidas son los días de lluvia en que no se trabajó.</p>`;
  const pm = modal({ title: '🌦️ Clima en la obra · pronóstico extendido', wide: true, body: cuerpo, buttons: [['Actualizar', 'btn', () => 'upd'], ['Cerrar', 'btn pri', () => null]] });
  const box = $('#modal .mbox'); box.classList.add('wide');
  if (!ro) {
    $('#lluDesde', box).onchange = (e) => { if (e.target.value) { L.cfg.desde = e.target.value; commit('Registro de lluvias desde ' + fechaCorta(e.target.value)); cerrarModal(); climaCarga(true).then(() => verClima()); } };
    $('#lluUmb', box).onchange = (e) => { const v = Number(e.target.value); if (v > 0) { L.cfg.umbral = v; commit(`Día de lluvia: desde ${fmt(v, 1)} mm`); cerrarModal(); verClima(); } };
    $$('[data-c]', box).forEach((b) => { b.onclick = () => {
      const f = b.dataset.f, o = Object.assign({}, L.dias[f] || {}), sc = box.querySelector('.mbody') || box, top = sc.scrollTop;
      if (b.dataset.c === 'man') o.man = b.dataset.v === '1'; else if (o.trab === b.dataset.v) delete o.trab; else o.trab = b.dataset.v;
      if (b.dataset.c === 'trab' && o.trab && o.trab !== 'si' && o.man == null) o.man = true;
      L.dias[f] = o; commit(`${fechaCorta(f)}: ${esLluvia(f) ? 'día de lluvia' : 'sin lluvia'}${o.trab ? ' · se trabajó: ' + o.trab : ''}`);
      cerrarModal(); verClima().then(() => {}); setTimeout(() => { const n = $('#modal .mbody') || $('#modal .mbox'); if (n) n.scrollTop = top; }, 60);
    }; });
  }
  const r = await pm;
  if (r === 'upd') { await climaCarga(true); verClima(); }
}
function cerrarModal() { const b = [...document.querySelectorAll('#modal .mfoot button')].find((x) => x.textContent === 'Cerrar'); if (b) b.click(); }
