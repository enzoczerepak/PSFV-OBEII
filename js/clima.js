/* PSFV-OBE II · Clima en el parque (pronóstico Open-Meteo, observación de la estación SMN Oberá) y registro de días de lluvia de la obra.
   Datos: S.lluvia = { cfg: { desde (AAAA-MM-DD), umbral (mm) }, dias: { fecha: { mm, man } } }
   dias[f] = { man (true/false: el día se marcó a mano como de lluvia o no), trab ('si' | 'parcial' | 'no': si se trabajó) }
   auto[f] = { mm (estimación de Open-Meteo, solo referencia), smn (observaciones con lluvia de la estación SMN Oberá) } · solo lo escribe el servidor
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
  if (!lluRegistra() || !o || !o.fecha || o.offline || !smnLluvia(o.estado)) return;
  const L = lluS(); if (o.fecha < L.cfg.desde) return;
  const a = Object.assign({}, L.auto[o.fecha] || {}), obs = (lluAuto(o.fecha).smn || []).slice(), txt = `${o.hora} ${o.estado}`;
  if (obs.includes(txt)) return;
  obs.push(txt); a.smn = obs; L.auto[o.fecha] = a; commit();
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
const lluS = () => { S.lluvia = S.lluvia || {}; S.lluvia.cfg = S.lluvia.cfg || { desde: '2026-11-10', umbral: 1 }; S.lluvia.dias = S.lluvia.dias || {}; S.lluvia.auto = S.lluvia.auto || {}; return S.lluvia; };
// lo automático (mm estimados y observaciones del SMN) va aparte de lo que se marca a mano, y cada uno se sincroniza por separado:
// así una PC que refresca el clima nunca pisa el "¿Llovió?" / "¿Se trabajó?" que se cargó en otra. Los días viejos pueden tenerlo mezclado.
const lluAuto = (f) => { const L = lluS(), a = L.auto[f], d = L.dias[f] || {}; return { mm: a && a.mm != null ? a.mm : d.mm, smn: (a && a.smn) || d.smn || null }; };
const lluMan = (f) => { const d = lluS().dias[f] || {}; return { man: d.man, trab: d.trab }; };
// el clima automático lo registra solo la PC servidor (o la única PC si no hay red)
const lluRegistra = () => !window.READONLY && !(typeof NET !== 'undefined' && NET && NET.modo === 'cliente');
const esLluvia = (f) => { const L = lluS(), m = lluMan(f); if (m.man === true) return true; if (m.man === false) return false; const a = lluAuto(f); return (Number(a.mm) || 0) >= (Number(L.cfg.umbral) || 1) || !!(a.smn && a.smn.length); };
function lluCuenta() {
  const L = lluS(), hoy = today(), lun = lunesDe(hoy), dom = sumDias(lun, 6);
  const fs = []; for (let f = L.cfg.desde; f <= hoy; f = sumDias(f, 1)) fs.push(f);
  const lluv = fs.filter(esLluvia), tr = (f) => (L.dias[f] || {}).trab, sem = (f) => f >= lun && f <= dom;
  const perd = lluv.filter((f) => tr(f) === 'no'), parc = lluv.filter((f) => tr(f) === 'parcial');
  return { semana: lluv.filter(sem).length, obra: lluv.length, dias: fs.length, lista: lluv, desde: L.cfg.desde,
    perdSem: perd.filter(sem).length, perdObra: perd.length, parcObra: parc.length, parcSem: parc.filter(sem).length, sinDato: lluv.filter((f) => !tr(f)).length,
    mmObra: fs.reduce((a, f) => a + (Number(lluAuto(f).mm) || 0), 0) };
}
// guarda los mm diarios desde el inicio del registro (solo días ya transcurridos); conserva las marcas manuales
function lluActualizar(d) {
  if (!lluRegistra() || !d || !d.daily) return;
  const L = lluS(), hoy = today(); let cambio = false;
  d.daily.time.forEach((f, i) => {
    if (f < L.cfg.desde || f > hoy) return;
    // hoy: solo lo que ya llovió (horas transcurridas), no lo pronosticado para el resto del día
    let v = Number(d.daily.precipitation_sum[i]) || 0;
    if (f === hoy && d.hourly) { const hh = new Date().getHours(); v = d.hourly.time.reduce((a, t, k) => a + (t.slice(0, 10) === f && Number(t.slice(11, 13)) <= hh ? Number(d.hourly.precipitation[k]) || 0 : 0), 0); }
    const mm = Math.round(v * 10) / 10, a = L.auto[f] || {};
    if (a.mm !== mm || lluAuto(f).mm !== mm) { L.auto[f] = Object.assign({}, a, { mm }); cambio = true; }
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
  const pie = `<div class="clluv" data-llu title="Ver el registro de lluvias y jornadas"><span>🌧️ Lluvia en la obra <small>desde ${fechaCorta(C.desde).slice(0, 5)}</small></span><div><b>${C.semana}</b><small>días esta semana</small></div><div><b>${C.obra}</b><small>días en total</small></div><div><b class="perd">${C.perdSem}</b><small>jornadas perdidas (sem.)${C.parcSem ? `<br>+ ${C.parcSem} parcial${C.parcSem > 1 ? 'es' : ''}` : ''}</small></div><div><b class="perd">${C.perdObra}</b><small>jornadas perdidas${C.parcObra ? `<br>+ ${C.parcObra} parcial${C.parcObra > 1 ? 'es' : ''}` : ''}</small></div></div>`;
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
function bindClima() { const w = $('#climaW'); if (w) w.onclick = (e) => { e.stopPropagation(); if (e.target.closest('[data-llu]')) verLluvias(); else verClima(); }; }
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
  cuerpo += `<div style="display:flex;align-items:center;gap:10px;margin:18px 0 6px"><h3 style="margin:0">Días de lluvia y jornadas de la obra</h3><button class="btn sm" id="lluCal">📅 Ver calendario y resumen</button></div>
    <div class="kpis k4" style="margin-bottom:10px">${kpi('Días de lluvia esta semana', C.semana, 'días', 0)}${kpi('Días de lluvia desde el ' + fechaCorta(C.desde), C.obra, `de ${C.dias} días`, 0)}${kpi('Jornadas perdidas por lluvia', C.perdObra, `días${C.parcObra ? ` + ${C.parcObra} parcial${C.parcObra === 1 ? '' : 'es'}` : ''}`, 0)}${kpi('Jornadas perdidas esta semana', C.perdSem, 'días', 0)}</div>
    ${C.sinDato && !ro ? `<div class="alert" style="display:block;margin-bottom:8px">Hay ${C.sinDato} día${C.sinDato === 1 ? '' : 's'} de lluvia sin indicar si se trabajó.</div>` : ''}
    <div class="tblwrap" style="max-height:320px"><table class="tbl"><thead><tr><th>Fecha</th><th>¿Llovió?</th><th>¿Se trabajó?</th><th title="Observaciones con lluvia de la estación SMN Oberá (se registran mientras el programa está abierto)">Estación SMN</th><th class="n" title="Estimación del servicio de clima para el parque, solo de referencia">Estimado (mm)</th></tr></thead><tbody>${fs.map((f) => { const o = Object.assign({}, lluAuto(f), lluMan(f)), si = esLluvia(f), sug = o.man == null;
      return `<tr><td>${['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][new Date(f + 'T12:00').getDay()]} ${fechaCorta(f)}${f === today() ? ' <span class="muted">(hoy)</span>' : ''}</td>
        <td style="white-space:nowrap">${seg(f, 'man', '1', '🌧️ Sí', si, sug ? 'csug' : 'pri')} ${seg(f, 'man', '0', 'No', !si, sug ? 'csug' : 'pri')}${sug ? ' <small class="muted">sugerido</small>' : ''}</td>
        <td style="white-space:nowrap">${seg(f, 'trab', 'si', 'Sí', o.trab === 'si')} ${seg(f, 'trab', 'parcial', 'Parcial', o.trab === 'parcial')} ${seg(f, 'trab', 'no', 'No', o.trab === 'no', 'danger')}</td>
        <td class="muted" style="font-size:12px">${o.smn && o.smn.length ? `🌧️ ${esc(o.smn.slice(0, 3).join(' · '))}${o.smn.length > 3 ? ` (+${o.smn.length - 3})` : ''}` : '–'}</td>
        <td class="n muted">${o.mm != null ? fmt(o.mm, 1) : '–'}</td></tr>`; }).join('')}</tbody></table></div>
    <div class="form" style="grid-template-columns:repeat(2,minmax(0,220px));margin:10px 0 0"><label>Registro desde<input type="date" id="lluDesde" value="${L.cfg.desde}" ${ro ? 'disabled' : ''}></label><label>Sugerir lluvia desde (mm estimados)<input type="number" id="lluUmb" min="0.1" step="0.5" value="${L.cfg.umbral}" ${ro ? 'disabled' : ''}></label></div>
    <p class="hint">No hace falta pluviómetro: marcá cada día si llovió y si se pudo trabajar. Mientras no lo marques, el "¿Llovió?" se sugiere (en gris) si la estación SMN Oberá informó lluvia, llovizna o tormenta en alguna observación del día, o si la lluvia estimada para el parque supera el umbral. Las jornadas perdidas son los días de lluvia en que no se trabajó.</p>`;
  const pm = modal({ title: '🌦️ Clima en la obra · pronóstico extendido', wide: true, body: cuerpo, buttons: [['Actualizar', 'btn', () => 'upd'], ['Cerrar', 'btn pri', () => null]] });
  const box = $('#modal .mbox'); box.classList.add('wide');
  const lc = $('#lluCal', box); if (lc) lc.onclick = () => { cerrarModal(); setTimeout(verLluvias, 60); };
  if (!ro) {
    $('#lluDesde', box).onchange = (e) => { if (e.target.value) { L.cfg.desde = e.target.value; commit('Registro de lluvias desde ' + fechaCorta(e.target.value)); cerrarModal(); climaCarga(true).then(() => verClima()); } };
    $('#lluUmb', box).onchange = (e) => { const v = Number(e.target.value); if (v > 0) { L.cfg.umbral = v; commit(`Día de lluvia: desde ${fmt(v, 1)} mm`); cerrarModal(); verClima(); } };
    $$('[data-c]', box).forEach((b) => { b.onclick = () => {
      const f = b.dataset.f, o = lluMan(f), vie = L.dias[f] || {};
      if ((vie.mm != null || vie.smn) && !L.auto[f]) L.auto[f] = Object.assign({}, vie.mm != null ? { mm: vie.mm } : {}, vie.smn ? { smn: vie.smn } : {});
      const sc = box.querySelector('.mbody') || box, top = sc.scrollTop;
      if (b.dataset.c === 'man') o.man = b.dataset.v === '1'; else if (o.trab === b.dataset.v) delete o.trab; else o.trab = b.dataset.v;
      if (b.dataset.c === 'trab' && o.trab && o.trab !== 'si' && o.man == null) o.man = true;
      if (o.man == null) delete o.man; if (!o.trab) delete o.trab;
      if (Object.keys(o).length) L.dias[f] = o; else delete L.dias[f];
      commit(`${fechaCorta(f)}: ${esLluvia(f) ? 'día de lluvia' : 'sin lluvia'}${o.trab ? ' · se trabajó: ' + o.trab : ''}`);
      cerrarModal(); verClima().then(() => {}); setTimeout(() => { const n = $('#modal .mbody') || $('#modal .mbox'); if (n) n.scrollTop = top; }, 60);
    }; });
  }
  const r = await pm;
  if (r === 'upd') { await climaCarga(true); verClima(); }
}
function cerrarModal() { const b = [...document.querySelectorAll('#modal .mfoot button')].find((x) => x.textContent === 'Cerrar'); if (b) b.click(); }

// ---------- registro de lluvias: calendario y lista de días de lluvia y jornadas perdidas ----------
const LLU_UI = { mes: null, modo: 'cal', sel: null };
const LLU_MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const LLU_DSEM = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
// estado de un día para el calendario: perdida (llovió y no se trabajó), parcial, trabajado (llovió y se trabajó), sindato (llovió sin decir si se trabajó), seco
function lluEstado(f) {
  const m = lluMan(f), ll = esLluvia(f);
  if (!ll) return { k: m.trab === 'no' ? 'noTrab' : 'seco', ll, sug: false, m };
  const sug = m.man == null;
  return { k: m.trab === 'no' ? 'perdida' : m.trab === 'parcial' ? 'parcial' : m.trab === 'si' ? 'trabajado' : 'sindato', ll, sug, m };
}
const LLU_EST = { perdida: ['Jornada perdida', '#d9573f'], parcial: ['Trabajo parcial', '#f0a23b'], trabajado: ['Llovió, se trabajó', '#3d86d6'], sindato: ['Llovió, falta indicar si se trabajó', '#9cc2ec'], seco: ['Sin lluvia', '#e9eef4'], noTrab: ['Sin lluvia, no se trabajó', '#c9ced6'] };
function verLluvias() {
  const L = lluS(); LLU_UI.mes = LLU_UI.mes || today().slice(0, 7); LLU_UI.sel = null;
  modal({ title: '🌧️ Registro de lluvias y jornadas', sub: `Desde el ${fechaCorta(L.cfg.desde)} · se guarda con los datos de la obra y se ve en todas las PCs y en el visor`, wide: true,
    body: '<div id="lluBox"></div>', buttons: [['Exportar Excel', 'btn', () => { lluExcel(); return false; }], ['PDF', 'btn', () => { lluPdf(); return false; }], ['Cerrar', 'btn pri', () => null]] });
  setTimeout(lluRender, 10);
}
function lluRender() {
  const box = $('#lluBox'); if (!box) return;
  const L = lluS(), C = lluCuenta(), hoy = today(), ro = window.READONLY;
  const [y, mo] = LLU_UI.mes.split('-').map(Number), ini = `${LLU_UI.mes}-01`, nDias = new Date(y, mo, 0).getDate();
  const fsMes = Array.from({ length: nDias }, (_, i) => `${LLU_UI.mes}-${String(i + 1).padStart(2, '0')}`).filter((f) => f >= L.cfg.desde && f <= hoy);
  const cMes = { ll: fsMes.filter(esLluvia).length, perd: fsMes.filter((f) => lluEstado(f).k === 'perdida').length, parc: fsMes.filter((f) => lluEstado(f).k === 'parcial').length };
  const prev = sumDias(ini, -1).slice(0, 7), next = sumDias(`${LLU_UI.mes}-${nDias}`, 1).slice(0, 7);
  let h = `<div class="kpis k4" style="margin-bottom:12px">${kpi('Días de lluvia', C.obra, `de ${C.dias} días de obra`, 0)}${kpi('Jornadas perdidas', C.perdObra, 'días sin trabajar por lluvia', 0)}${kpi('Jornadas parciales', C.parcObra, 'días con trabajo parcial', 0)}${kpi('Esta semana', C.semana, `días de lluvia · ${C.perdSem} perdida${C.perdSem === 1 ? '' : 's'}`, 0)}</div>
    ${C.sinDato && !ro ? `<div class="alert aviso" style="display:block;margin-bottom:10px">Hay ${C.sinDato} día${C.sinDato === 1 ? '' : 's'} de lluvia sin indicar si se trabajó: tocalos en el calendario para completarlos.</div>` : ''}
    <div class="tools" style="margin-bottom:8px"><div class="seg" id="lluModo"><button data-v="cal" class="${LLU_UI.modo === 'cal' ? 'on' : ''}">Calendario</button><button data-v="lista" class="${LLU_UI.modo === 'lista' ? 'on' : ''}">Lista</button></div>`;
  if (LLU_UI.modo === 'cal') {
    h += `<span class="sp"></span><button class="btn sm ghost" data-mes="${prev}" ${prev < L.cfg.desde.slice(0, 7) ? 'disabled' : ''}>‹</button><b style="min-width:150px;text-align:center">${LLU_MES[mo - 1]} ${y}</b><button class="btn sm ghost" data-mes="${next}" ${next > hoy.slice(0, 7) ? 'disabled' : ''}>›</button></div>
      <div class="llucal">${['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => `<div class="lch">${d}</div>`).join('')}`;
    const off = (new Date(y, mo - 1, 1).getDay() + 6) % 7; for (let i = 0; i < off; i++) h += '<div></div>';
    for (let d = 1; d <= nDias; d++) {
      const f = `${LLU_UI.mes}-${String(d).padStart(2, '0')}`, fuera = f < L.cfg.desde || f > hoy;
      if (fuera) { h += `<div class="lcd fuera"><span>${d}</span></div>`; continue; }
      const e = lluEstado(f), [tx, col] = LLU_EST[e.k], a = lluAuto(f);
      h += `<button class="lcd e-${e.k} ${e.sug ? 'sug' : ''} ${LLU_UI.sel === f ? 'sel' : ''} ${f === hoy ? 'hoy' : ''}" data-f="${f}" title="${fechaCorta(f)} · ${tx}${e.sug ? ' (sugerido)' : ''}${a.mm ? ` · ${fmt(a.mm, 1)} mm est.` : ''}" style="--c:${col}"><span>${d}</span><i>${e.ll ? (e.k === 'perdida' ? '⛔' : e.k === 'parcial' ? '◐' : '🌧️') : e.k === 'noTrab' ? '·' : ''}</i>${a.mm ? `<small>${fmt(a.mm, 1)}</small>` : ''}</button>`;
    }
    h += `</div><div class="llucl">${['perdida', 'parcial', 'trabajado', 'sindato', 'seco'].map((k) => `<span><i style="background:${LLU_EST[k][1]}"></i>${LLU_EST[k][0]}</span>`).join('')}<span><i class="sugi"></i>Sugerido por el clima (sin confirmar)</span></div>
      <div class="muted" style="margin:6px 0 0;font-size:12.5px">${LLU_MES[mo - 1]}: ${cMes.ll} día${cMes.ll === 1 ? '' : 's'} de lluvia · ${cMes.perd} jornada${cMes.perd === 1 ? '' : 's'} perdida${cMes.perd === 1 ? '' : 's'} · ${cMes.parc} parcial${cMes.parc === 1 ? '' : 'es'}</div>`;
    if (LLU_UI.sel) {
      const f = LLU_UI.sel, e = lluEstado(f), a = lluAuto(f);
      const b = (c, v, t, on, cls) => `<button class="btn sm ${on ? cls || 'pri' : 'ghost'}" data-c="${c}" data-v="${v}" ${ro ? 'disabled' : ''}>${t}</button>`;
      h += `<div class="lluday"><b>${LLU_DSEM[new Date(f + 'T12:00').getDay()]} ${fechaCorta(f)}</b>
        <span>¿Llovió? ${b('man', '1', '🌧️ Sí', e.ll, e.sug ? 'csug' : 'pri')} ${b('man', '0', 'No', !e.ll, e.sug ? 'csug' : 'pri')}${e.sug ? ' <small class="muted">sugerido</small>' : ''}</span>
        <span>¿Se trabajó? ${b('trab', 'si', 'Sí', e.m.trab === 'si')} ${b('trab', 'parcial', 'Parcial', e.m.trab === 'parcial')} ${b('trab', 'no', 'No', e.m.trab === 'no', 'danger')}</span>
        <small class="muted">${a.mm != null ? `${fmt(a.mm, 1)} mm estimados` : ''}${a.smn && a.smn.length ? ` · SMN: ${esc(a.smn.join(' · '))}` : ''}</small></div>`;
    }
  } else {
    const fs = []; for (let f = hoy; f >= L.cfg.desde; f = sumDias(f, -1)) { const e = lluEstado(f); if (e.ll || e.k === 'noTrab') fs.push([f, e]); }
    h += `</div><div class="tblwrap" style="max-height:52vh"><table class="tbl"><thead><tr><th>Fecha</th><th>Estado</th><th>¿Llovió?</th><th>¿Se trabajó?</th><th class="n">mm est.</th><th>Estación SMN</th></tr></thead><tbody>
      ${fs.map(([f, e]) => { const a = lluAuto(f); return `<tr class="trow" data-f="${f}"><td>${LLU_DSEM[new Date(f + 'T12:00').getDay()]} ${fechaCorta(f)}</td><td><span class="llupill" style="--c:${LLU_EST[e.k][1]}">${LLU_EST[e.k][0]}</span></td>
        <td>${e.ll ? 'Sí' : 'No'}${e.sug ? ' <small class="muted">(sugerido)</small>' : ''}</td><td>${{ si: 'Sí', parcial: 'Parcial', no: 'No' }[e.m.trab] || '<span class="muted">sin indicar</span>'}</td><td class="n">${a.mm != null ? fmt(a.mm, 1) : '–'}</td><td class="muted" style="font-size:12px">${a.smn ? esc(a.smn.slice(0, 2).join(' · ')) : '–'}</td></tr>`; }).join('') || '<tr><td colspan="6" class="muted" style="padding:16px">Sin días de lluvia registrados.</td></tr>'}</tbody></table></div>
      <p class="hint">Tocá un día para corregirlo en el calendario.</p>`;
  }
  box.innerHTML = h;
  $$('#lluModo button', box).forEach((x) => { x.onclick = () => { LLU_UI.modo = x.dataset.v; lluRender(); }; });
  $$('[data-mes]', box).forEach((x) => { x.onclick = () => { LLU_UI.mes = x.dataset.mes; LLU_UI.sel = null; lluRender(); }; });
  $$('.lcd[data-f]', box).forEach((x) => { x.onclick = () => { LLU_UI.sel = LLU_UI.sel === x.dataset.f ? null : x.dataset.f; lluRender(); }; });
  $$('tr.trow[data-f]', box).forEach((x) => { x.onclick = () => { LLU_UI.modo = 'cal'; LLU_UI.mes = x.dataset.f.slice(0, 7); LLU_UI.sel = x.dataset.f; lluRender(); }; });
  if (!ro) $$('.lluday [data-c]', box).forEach((x) => { x.onclick = () => { lluMarcar(LLU_UI.sel, x.dataset.c, x.dataset.v); lluRender(); }; });
}
// marca a mano un día (lo mismo que la tabla del pronóstico extendido)
function lluMarcar(f, campo, val) {
  const L = lluS(), o = lluMan(f), vie = L.dias[f] || {};
  if ((vie.mm != null || vie.smn) && !L.auto[f]) L.auto[f] = Object.assign({}, vie.mm != null ? { mm: vie.mm } : {}, vie.smn ? { smn: vie.smn } : {});
  if (campo === 'man') o.man = val === '1'; else if (o.trab === val) delete o.trab; else o.trab = val;
  if (campo === 'trab' && o.trab && o.trab !== 'si' && o.man == null) o.man = true;
  if (o.man == null) delete o.man; if (!o.trab) delete o.trab;
  if (Object.keys(o).length) L.dias[f] = o; else delete L.dias[f];
  commit(`${fechaCorta(f)}: ${esLluvia(f) ? 'día de lluvia' : 'sin lluvia'}${o.trab ? ' · se trabajó: ' + o.trab : ''}`);
  if (typeof view !== 'undefined' && view === 'resumen' && typeof heroRefrescar === 'function') heroRefrescar();
}
function lluFilas() {
  const L = lluS(), fs = []; for (let f = L.cfg.desde; f <= today(); f = sumDias(f, 1)) fs.push(f);
  return fs.map((f) => { const e = lluEstado(f), a = lluAuto(f); return { f, e, a }; });
}
async function lluExcel() {
  const C = lluCuenta(), wb = XLSX.utils.book_new();
  const a = [['Registro de lluvias y jornadas', S.nombre], ['Desde', C.desde, 'Días de obra', C.dias], ['Días de lluvia', C.obra, 'Jornadas perdidas', C.perdObra, 'Jornadas parciales', C.parcObra], [],
    ['Fecha', 'Día', '¿Llovió?', 'Confirmado a mano', '¿Se trabajó?', 'Estado', 'mm estimados', 'Estación SMN Oberá']];
  lluFilas().forEach(({ f, e, a: au }) => a.push([f, LLU_DSEM[new Date(f + 'T12:00').getDay()], e.ll ? 'Sí' : 'No', e.m.man == null ? 'No (sugerido)' : 'Sí', { si: 'Sí', parcial: 'Parcial', no: 'No' }[e.m.trab] || '', LLU_EST[e.k][0], au.mm != null ? au.mm : '', au.smn ? au.smn.join(' · ') : '']));
  const w = XLSX.utils.aoa_to_sheet(a); w['!cols'] = [12, 6, 9, 16, 12, 30, 12, 40].map((x) => ({ wch: x })); XLSX.utils.book_append_sheet(wb, w, 'Lluvias');
  const p = await window.api.saveBinary(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }), `Registro de lluvias ${today()}.xlsx`, 'xlsx', 'Excel');
  if (p) toast('Registro de lluvias exportado', { action: ['Abrir', () => window.api.openPath(p)] });
}
function lluPdf() {
  const C = lluCuenta(), fs = lluFilas().filter((x) => x.e.ll || x.e.k === 'noTrab').reverse();
  printHTML(prHead('Registro de lluvias y jornadas', `Desde el ${fechaCorta(C.desde)} · ${C.dias} días de obra`) +
    `<div class="kpis k4" style="margin:8px 0 12px">${kpi('Días de lluvia', C.obra, '', 0)}${kpi('Jornadas perdidas', C.perdObra, '', 0)}${kpi('Jornadas parciales', C.parcObra, '', 0)}${kpi('Lluvia estimada', C.mmObra, 'mm', 1)}</div>
    <table class="tbl"><thead><tr><th>Fecha</th><th>Estado</th><th>¿Llovió?</th><th>¿Se trabajó?</th><th class="n">mm est.</th><th>Estación SMN</th></tr></thead><tbody>
    ${fs.map(({ f, e, a }) => `<tr><td>${LLU_DSEM[new Date(f + 'T12:00').getDay()]} ${fechaCorta(f)}</td><td>${LLU_EST[e.k][0]}</td><td>${e.ll ? 'Sí' : 'No'}${e.sug ? ' (sugerido)' : ''}</td><td>${{ si: 'Sí', parcial: 'Parcial', no: 'No' }[e.m.trab] || 'sin indicar'}</td><td class="n">${a.mm != null ? fmt(a.mm, 1) : '–'}</td><td>${a.smn ? esc(a.smn.join(' · ')) : '–'}</td></tr>`).join('') || '<tr><td colspan="6">Sin días de lluvia.</td></tr>'}</tbody></table>`, `Registro de lluvias ${today()}.pdf`);
}
