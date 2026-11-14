/* App de campo para capataces: plan de corte del día y carga de partes (tendido, PAT, zanja, observaciones).
   Los partes viajan cifrados al buzón; la PC de obra los recibe y se aprueban en la oficina. */
(function () {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const W = window.WebCore, KEY = 'campo-sesion';
  let KQ = 'campo-cola', KH = 'campo-hist';
  const fmt = (n, d = 0) => Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const hoy = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
  const ls = { get(k, def) { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch (_) { return def; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* nada */ } } };
  const toast = (t, err) => { const d = document.createElement('div'); d.textContent = t; if (err) d.className = 'e'; $('#toast').appendChild(d); setTimeout(() => d.remove(), 4500); };
  let S = null, R = null, D = null, ses = null, enviar = null, tab = 'plan', ui = { cat: 'BT', carga: 'tendido', circ: null, zanja: null, modo: (() => { try { return JSON.parse(localStorage.getItem('campo-modo')) || 'inv'; } catch (_) { return 'inv'; } })() };
  const lbl = (f) => (f === 'C' ? 'Cu' : f);

  // ---------- sesión ----------
  let MGc = null, MGt = null;
  const tolF = () => Math.max(0, Math.min(100, Number(S.params && S.params.tolSeg != null ? S.params.tolSeg : 50))) / 100;
  const tolDe = (c) => { if (!MGc || !c || c.cat === 'PAT') return null; const g = MGc.find((x) => x.key === c.key); return g ? window.Margen.tolerancia(g, c.lenFase, tolF()) : null; };
  // tolerancia de un corte: margen de la sección, limitado por lo que queda en su bobina
  const tolP = (c, p) => { if (!c || c.cat === 'PAT') return null; const t = tolDe(c); if (!t && !MGc) return null; return window.Margen.topeBobina ? window.Margen.topeBobina(t, Object.assign({ key: c.key, cid: c.id }, p), R, c.lenFase) : t; };
  const bobTxt = (t) => (t && t.bob ? `<span class="tolbob ${t.bob.corto ? 'bad' : ''}">Bobina ${esc(t.bob.codigo)}: quedan ${fmt(t.bob.saldo, 1)} m${t.bob.n > 1 ? ` · sobran ${fmt(t.bob.holg, 1)} m repartidos entre sus ${t.bob.n} cortes de hoy` : ''}${t.bob.corto ? ' · no alcanza para el teórico' : ''}</span>` : '');
  const tolTxt = (t) => (!t ? '' : (t.sinMargen ? `<span class="tol bad">sin margen: no pasarse de ${fmt(Math.min(t.L, t.max), 1)} m</span>` : `<span class="tol"><i class="ok">seguro ≤ ${fmt(t.seg, 1)}</i><i class="warn">riesgo ≤ ${fmt(t.max, 1)}</i></span>`) + bobTxt(t));
  async function cargar(d, id, k, nombre, u) {
    const txt = await W.abrir(d, id, k);
    S = JSON.parse(txt); R = window.Engine.calcular(S); D = d;
    // margen de tendido (tolerancia por conductor), en segundo plano
    MGc = null; if (MGt) MGt.cancelar();
    if (window.Margen) MGt = window.Margen.enSegundoPlano(S, R, { metros: false, it: 9, cats: ['BT', 'MT', 'LA'], demora: 400 }, (dd) => { MGc = dd; MGt = null; if (tab === 'plan' || tab === 'cargar') { const y = window.scrollY; render(); window.scrollTo(0, y); } });
    if (!enviar) enviar = await W.enviador(d, id, k).catch(() => null);
    ses = { id, k, nombre, cap: !!(u && (u.cap || u.ed)) };
    KQ = 'campo-cola-' + id.slice(0, 16); KH = 'campo-hist-' + id.slice(0, 16);
  }
  async function entrar(usuario, pass, rec) {
    const d = await W.bajar();
    const r = await W.login(usuario, pass, d);
    if (!(r.u.cap || r.u.ed)) throw new Error('perm');
    await cargar(d, r.id, r.k, usuario.trim(), r.u);
    const st = { id: r.id, k: W.b64(r.k), n: usuario.trim() };
    try { (rec ? localStorage : sessionStorage).setItem(KEY, JSON.stringify(st)); } catch (_) { /* nada */ }
    arrancar();
  }
  async function auto() {
    let st = null; try { st = JSON.parse(localStorage.getItem(KEY) || sessionStorage.getItem(KEY) || 'null'); } catch (_) { st = null; }
    if (!st) return false;
    try { const d = await W.bajar(); const u = (d.usuarios || []).find((x) => x.id === st.id); if (!u || !(u.cap || u.ed)) throw 0; await cargar(d, st.id, W.b64d(st.k), st.n, u); arrancar(); return true; }
    catch (_) { return false; }
  }
  function salir() {
    const q = ls.get(KQ, []).length;
    if (q && !confirm(`Tenés ${q} parte${q > 1 ? 's' : ''} sin enviar (sin señal). Quedan guardados en este celular y se envían cuando vuelvas a entrar con tu usuario. ¿Salir igual?`)) return;
    try { localStorage.removeItem(KEY); sessionStorage.removeItem(KEY); } catch (_) { /* nada */ }
    location.reload();
  }
  function arrancar() {
    $('#hSalir').onclick = salir;
    $('#login').classList.add('hidden'); $('#app').classList.remove('hidden');
    $('#hNom').textContent = ses.nombre.split(/\s+/).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
    render(); setInterval(refrescar, 60000); setInterval(vaciarCola, 30000); window.addEventListener('online', vaciarCola); vaciarCola();
  }
  async function refrescar() {
    try { const d = await W.bajar(); if (d.actualizado === (D && D.actualizado)) return; await cargar(d, ses.id, ses.k, ses.nombre); render(); } catch (_) { /* sin red */ }
  }
  function estado() {
    const q = ls.get(KQ, []).length;
    $('#hEst').innerHTML = `${q ? `<span class="q">${q} en cola${navigator.onLine ? '' : ' · sin señal'}</span><br>` : ''}Datos al ${D ? new Date(D.actualizado).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '–'}`;
    $('#hFecha').textContent = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
    const pend = ls.get(KH, []).filter((p) => est(p) === 'cola' || est(p) === 'pend').length;
    $('#tBadge').textContent = pend || '';
  }

  // ---------- cola de envío ----------
  async function encolar(p) {
    p.id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); p.creado = new Date().toISOString();
    const h = ls.get(KH, []); h.unshift(p); ls.set(KH, h.slice(0, 200));
    const q = ls.get(KQ, []); q.push(p); ls.set(KQ, q);
    await vaciarCola(true);
  }
  let vaciando = false;
  async function vaciarCola(avisar) {
    if (vaciando) return; vaciando = true;
    try {
      let q = ls.get(KQ, []);
      while (q.length) {
        if (!enviar) throw new Error('Tu usuario no tiene permiso de carga');
        await enviar(new TextEncoder().encode(JSON.stringify(q[0])), { ext: 'parte', archivo: 'parte ' + q[0].tipo, mensaje: 'Parte de campo' });
        const h = ls.get(KH, []); const x = h.find((y) => y.id === q[0].id); if (x) x.enviado = new Date().toISOString(); ls.set(KH, h);
        q.shift(); ls.set(KQ, q);
        if (avisar) toast('Parte enviado ✓ Queda pendiente de aprobación en la oficina');
      }
    } catch (e) { if (avisar) toast(navigator.onLine ? 'No se pudo enviar ahora: queda en cola y se reintenta solo' : 'Sin señal: el parte queda guardado y se envía cuando haya conexión', !navigator.onLine ? false : true); }
    finally { vaciando = false; estado(); if (tab === 'mios') render(); }
  }
  const est = (p) => { const r = (S && S.partes || []).find((x) => x.id === p.id); if (r) return r.estado === 'aprobado' ? 'ok' : r.estado === 'rechazado' ? 'no' : 'pend'; return p.enviado ? 'pend' : 'cola'; };

  // ---------- vistas ----------
  function render() {
    estado(); $$('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === tab));
    const v = $('#v'); ({ plan: vPlan, cargar: vCargar, mios: vMios })[tab](v); window.scrollTo(0, 0);
  }
  const circ = (id) => R.circuitos.find((c) => c.id === id);
  // lo que importa en campo: a qué inversor(es) se tiende, con qué bobina y cuántos metros (teórico, seguro, riesgo); el circuito queda como dato secundario
  const destino = (c) => (c.cat === 'PAT' ? 'PAT Cu ' + c.seccion + ' mm²' : c.cat === 'BT' ? c.desde : `${c.desde} → ${c.hasta}`);
  const tolBox = (c, teo, t) => {
    t = t === undefined ? tolDe(c) : t; const m = (lbl, v, k) => `<div class="tb ${k}"><small>${lbl}</small><b>${v}</b></div>`;
    const teoB = m('Teórico', teo != null ? fmt(teo, 1) + ' m' : 'ver fases', 'teo');
    if (c.cat === 'PAT') return `<div class="tolb">${teoB}</div>`;
    if (!t) return `<div class="tolb">${teoB}${MGt ? m('Seguro / riesgo', 'calculando…', 'calc') : ''}</div>`;
    if (t.sinMargen) return `<div class="tolb">${teoB}${m(t.bob ? 'Tope de bobina' : 'Sin margen', 'no pasarse de ' + fmt(Math.min(t.L, t.max), 1) + ' m', 'bad')}</div>${bobTxt(t)}`;
    return `<div class="tolb">${teoB}${m('Seguro hasta', fmt(t.seg, 1) + ' m', 'ok')}${m('Riesgo hasta', fmt(t.max, 1) + ' m', 'warn')}</div>${bobTxt(t)}`;
  };
  function vPlan(v) {
    const cat = ui.cat, H = hoy(), modo = ui.modo || 'inv';
    const enviadosHoy = new Set(ls.get(KH, []).filter((p) => p.tipo === 'tendido' && est(p) !== 'no' && est(p) !== 'ok').flatMap((p) => p.fases.map((f) => p.circuito + '|' + f.f)));
    const ps = R.piezas.filter((p) => p.cat === cat && p.bobina && (p.estado === 'listo' || (p.estado === 'ejecutado' && p.fecha === H)));
    const porB = new Map(); ps.forEach((p) => { if (!porB.has(p.bobina)) porB.set(p.bobina, []); porB.get(p.bobina).push(p); });
    let h = `<div class="chips">${['BT', 'MT', 'PAT', ...(S.circuitos.some((x) => x.cat === 'LA') ? ['LA'] : [])].map((c) => `<button data-c="${c}" class="${c === cat ? 'on' : ''}">${c}</button>`).join('')}
</div><div class="seg2"><button data-m="inv" class="${modo === 'inv' ? 'on' : ''}">Por inversor</button><button data-m="bob" class="${modo === 'bob' ? 'on' : ''}">Por bobina</button></div>`;
    if (!porB.size) h += `<div class="card empty"><b>Sin cortes listos en ${cat}</b><br>Los cortes aparecen cuando la oficina abre las zanjas.</div>`;
    else if (modo === 'inv') {
      // bobinas a llevar hoy
      const bobs = [...porB.entries()].map(([cod, arr]) => [cod, arr.filter((p) => p.estado === 'listo').reduce((a, p) => a + p.len, 0), (R.bobinas.find((x) => x.codigo === cod && x.cat === cat) || {}).saldoActual]).filter((x) => x[1] > 0).sort((a, b) => a[0].localeCompare(b[0], 'es', { numeric: true }));
      if (bobs.length) h += `<div class="card llevar"><div class="muted"><b>Bobinas a llevar</b></div><div class="bobs">${bobs.map(([cod, m, sal]) => `<span class="bob"><b>${esc(cod)}</b> ${fmt(m, 0)} m${sal != null ? ` <small>· saldo ${fmt(sal, 0)}</small>` : ''}</span>`).join('')}</div></div>`;
      const porC = new Map(); ps.forEach((p) => { if (!porC.has(p.cid)) porC.set(p.cid, []); porC.get(p.cid).push(p); });
      [...porC.entries()].map(([cid, arr]) => [circ(cid), arr]).sort((a, b) => a[0].idx - b[0].idx).forEach(([c, arr]) => {
        arr.sort((a, b) => String(a.fase).localeCompare(String(b.fase)));
        const pend = arr.filter((p) => p.estado === 'listo'), todo = !pend.length;
        const lens = [...new Set(pend.map((p) => Math.round(p.len * 10)))], teo = pend.length && lens.length === 1 ? pend[0].len : todo ? c.lenFase : null;
        h += `<div class="card inv ${todo ? 'ok' : ''}"><div class="invh"><span class="tag t-${c.cat}">${c.cat}</span><b class="invn">${esc(destino(c))}</b>${c.cat === 'BT' ? `<span class="muted">→ ${esc(c.hasta)}</span>` : ''}${todo ? '<span class="okm">✓ tendido</span>' : ''}</div>
          ${todo ? '' : (() => { const ts = pend.map((p) => tolP(c, p)).filter(Boolean); if (!ts.length) return tolBox(c, teo);
            const w = ts.reduce((a, t) => (t.seg < a.seg || (t.seg === a.seg && t.max < a.max) ? t : a)); return tolBox(c, teo, w); })()}
          <div class="frs">${arr.map((p) => { const ya = p.estado === 'ejecutado', env = enviadosHoy.has(c.id + '|' + p.fase);
            const tp = ya ? null : tolP(c, p), dif = tp && pend.some((q) => { const o = tolP(c, q); return o && (Math.abs(o.seg - tp.seg) > 0.05 || Math.abs(o.max - tp.max) > 0.05); });
            return `<div class="fr ${ya ? 'ok' : env ? 'pend' : ''}"><b class="fl">${lbl(p.fase)}</b><span class="bob"><small>Bobina</small> <b>${esc(p.bobina)}</b></span><span class="m">${fmt(p.len, 1)} m</span>${dif ? `<span class="r2">seguro ≤ ${fmt(tp.seg, 1)} · riesgo ≤ ${fmt(tp.max, 1)}${tp.bob ? ' · tope de la bobina' : ''}</span>` : ''}${env && !ya ? '<span class="r">enviado, falta aprobar</span>' : ''}</div>`; }).join('')}</div>
          ${!todo && c.cat !== 'PAT' ? `<button class="b acc" data-cg="${c.id}">Cargar tendido</button>` : ''}
          <div class="sec">Circuito ${esc(c.designacion || '')} · ${c.seccion || ''} mm²${c.zTitulo && c.zTitulo !== `${c.desde} → ${c.hasta}` ? ` · zanja compartida: ${esc(c.zTitulo)}` : ''}</div></div>`;
      });
      h += `<p class="hint">Cada tarjeta es un tendido: el inversor, la bobina de cada conductor y los metros. <b>Seguro</b>: hasta ahí el plan de corte no se ve afectado. <b>Riesgo</b>: puede faltar cable más adelante. Más que eso, falta cable.</p>`;
    } else {
      const yaBoton = new Set();
      [...porB.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es', { numeric: true })).forEach(([cod, arr]) => {
        const b = R.bobinas.find((x) => x.codigo === cod && x.cat === cat) || {};
        arr.sort((a, c) => a.orden - c.orden);
        const tot = arr.filter((p) => p.estado === 'listo').reduce((a, p) => a + p.len, 0);
        h += `<div class="card"><h3><span><span class="tag t-${cat}">${cat}</span> Bobina ${esc(cod)}</span><span class="muted">${b.seccion || ''} mm²</span></h3>
          <div class="muted">Saldo actual ${fmt(b.saldoActual, 0)} m · a cortar hoy ${fmt(tot, 0)} m</div>
          ${arr.map((p) => { const c = circ(p.cid); const ya = p.estado === 'ejecutado', env = enviadosHoy.has(p.cid + '|' + p.fase);
            return `<div class="corte ${ya ? 'ok' : env ? 'pend' : ''}"><b>${esc(destino(c))} · ${lbl(p.fase)}</b><span class="m">${fmt(p.len, 1)} m</span>${!ya ? tolTxt(tolP(c, p)) : ''}<span class="r">${esc(c.designacion || '')}${c.cat === 'BT' ? ' → ' + esc(c.hasta) : ''}${env && !ya ? ' · enviado, falta aprobar' : ''}</span>${!ya && c.cat !== 'PAT' && !yaBoton.has(c.id) && yaBoton.add(c.id) ? `<button class="b" data-cg="${c.id}">Cargar tendido de ${esc(destino(c))}</button>` : ''}</div>`; }).join('')}</div>`;
      });
      h += `<p class="hint">Cortes listos para hoy (zanjas abiertas), en el orden de corte de cada bobina. Los tachados ya están registrados.</p>`;
    }
    v.innerHTML = h;
    $$('[data-c]', v).forEach((b) => { b.onclick = () => { ui.cat = b.dataset.c; render(); }; });
    $$('[data-m]', v).forEach((b) => { b.onclick = () => { ui.modo = b.dataset.m; ls.set('campo-modo', ui.modo); render(); }; });
    $$('[data-cg]', v).forEach((b) => { b.onclick = () => { ui.carga = 'tendido'; ui.circ = b.dataset.cg; tab = 'cargar'; render(); }; });
  }
  function vCargar(v) {
    const t = ui.carga;
    let h = `<div class="chips">${[['tendido', 'Tendido de cable'], ['pat', 'PAT'], ['zanja', 'Zanja'], ['obs', 'Observación']].map(([k, n]) => `<button data-k="${k}" class="${k === t ? 'on' : ''}">${n}</button>`).join('')}</div><div class="card"><div class="form" id="f">`;
    const zanjasAb = R.zlist.filter((z) => z.estado !== 'cerrada' || (z.pat && !z.pat.completo)).sort((a, b) => (a.estado === 'abierta' ? 0 : 1) - (b.estado === 'abierta' ? 0 : 1) || a.titulo.localeCompare(b.titulo, 'es', { numeric: true }));
    const optZ = (sel, f) => zanjasAb.filter(f || (() => true)).map((z) => `<option value="${z.id}" ${z.id === sel ? 'selected' : ''}>${esc(z.titulo)}${z.estado === 'abierta' ? ' · abierta' : z.estado === 'cerrada' ? ' · cerrada' : ''}</option>`).join('');
    if (t === 'tendido') {
      const cs = R.circuitos.filter((c) => c.cat !== 'PAT' && !c.completo).sort((a, b) => (a.listo === b.listo ? a.cat.localeCompare(b.cat) || a.idx - b.idx : a.listo ? -1 : 1));
      const c = circ(ui.circ) || null;
      h += `<label>Inversor a tender<select id="fC"><option value="">Elegí el inversor / circuito…</option>${cs.map((x) => `<option value="${x.id}" ${c && x.id === c.id ? 'selected' : ''}>${x.listo ? '● ' : ''}${esc(destino(x))}${x.cat === 'BT' ? ' → ' + esc(x.hasta) : ''} · ${esc(x.designacion)}</option>`).join('')}</select></label>`;
      if (c) {
        const bobs = R.bobinas.filter((b) => b.key === c.key);
        h += `<div class="invh"><span class="tag t-${c.cat}">${c.cat}</span><b class="invn">${esc(destino(c))}</b>${c.cat === 'BT' ? `<span class="muted">→ ${esc(c.hasta)}</span>` : ''}</div>${(() => { const ts = c.fz.filter((f) => (c.fasesInfo[f] || {}).estado !== 'ejecutado').map((f) => tolP(c, { fase: f, bobina: (c.fasesInfo[f] || {}).bobina, len: c.lenFase })).filter(Boolean);
          return tolBox(c, c.lenFase, ts.length ? ts.reduce((a, t) => (t.seg < a.seg ? t : a)) : undefined); })()}<div class="sec" style="margin-top:0">Circuito ${esc(c.designacion)} · ${c.seccion} mm²</div>`;
        c.fz.forEach((f) => {
          const pl = c.fasesInfo[f] || {}, real = pl.estado === 'ejecutado';
          h += `<div class="fase ${real ? 'off' : ''}" data-f="${f}"><label class="chk"><input type="checkbox" class="fon" ${real ? 'disabled' : 'checked'}><span class="fl">${lbl(f)}</span></label>
            <select class="fb" ${real ? 'disabled' : ''}>${bobs.map((b) => `<option value="${esc(b.codigo)}" ${b.codigo === pl.bobina ? 'selected' : ''}>${esc(b.codigo)} · ${fmt(b.saldoActual, 0)} m</option>`).join('')}</select>
            <input type="number" inputmode="decimal" step="0.1" class="fm" placeholder="${fmt(c.lenFase, 1)} m" value="${real ? fmt(pl.len, 1) : ''}" ${real ? 'disabled' : ''}></div>`;
        });
        h += `<p class="hint">Cargá los metros reales tirados de cada conductor (la bobina propuesta es la del plan). Las fases ya registradas aparecen bloqueadas.</p>`;
      }
    } else if (t === 'pat') {
      const z = R.zlist.find((x) => x.id === ui.zanja);
      h += `<label>Zanja<select id="fZ"><option value="">Elegí la zanja…</option>${optZ(ui.zanja, (x) => x.pat)}</select></label>`;
      if (z && z.pat) {
        const bobs = R.bobinas.filter((b) => b.key === z.pat.key);
        h += `<div class="muted">PAT Cu ${z.pat.seccion} mm² · largo de zanja ${fmt(z.largo, 1)} m</div>
          <div class="dos"><label>Metros de PAT<input type="number" inputmode="decimal" step="0.1" id="fPm" value="${z.largo || ''}"></label>
          <label>Bobina<select id="fPb"><option value="">Sin bobina / no sé</option>${bobs.map((b) => `<option value="${esc(b.codigo)}" ${b.codigo === (z.pat.fasesInfo.C || {}).bobina ? 'selected' : ''}>${esc(b.codigo)}</option>`).join('')}</select></label></div>`;
      }
    } else if (t === 'zanja') {
      const z = R.zlist.find((x) => x.id === ui.zanja);
      h += `<label>Zanja<select id="fZ"><option value="">Elegí la zanja…</option>${optZ(ui.zanja)}</select></label>`;
      if (z) h += `<div class="muted">${z.miembros.length} circuito${z.miembros.length > 1 ? 's' : ''} · largo actual ${fmt(z.largo, 1)} m</div><label>Largo real de la zanja terminada (m)<input type="number" inputmode="decimal" step="0.1" id="fZl" value=""></label>`;
    } else {
      h += `<label>Sobre (opcional)<select id="fZ"><option value="">General</option>${optZ(ui.zanja)}</select></label>`;
    }
    h += `<label>Fecha<input type="date" id="fD" value="${hoy()}"></label><label>Observación${t === 'obs' ? '' : ' (opcional)'}<textarea id="fO" placeholder="Ej.: se encontró roca, faltó material, quedó cable de más…"></textarea></label>
      <button class="b pri" id="fEnv">Enviar parte</button></div></div>`;
    v.innerHTML = h;
    $$('[data-k]', v).forEach((b) => { b.onclick = () => { ui.carga = b.dataset.k; render(); }; });
    const fc = $('#fC', v); if (fc) fc.onchange = () => { ui.circ = fc.value; render(); };
    const fz = $('#fZ', v); if (fz && t !== 'obs') fz.onchange = () => { ui.zanja = fz.value; render(); };
    $$('.fon', v).forEach((c) => { c.onchange = () => c.closest('.fase').classList.toggle('off', !c.checked); });
    const cc = circ(ui.circ);
    $$('.fm', v).forEach((i) => { const fila = i.closest('.fase'); const up = () => { const tt = tolP(cc, { fase: fila.dataset.f, bobina: $('.fb', fila).value, len: cc.lenFase }); const m = Number(String(i.value).replace(',', '.')); const nv = tt && m > 0 ? window.Margen.nivel(tt, m) : null; i.classList.remove('lv-ok', 'lv-riesgo', 'lv-falta'); if (nv) i.classList.add('lv-' + nv); }; i.oninput = up; $('.fb', fila).addEventListener('change', up); up(); });
    $('#fEnv', v).onclick = () => enviarForm(t, v);
  }
  async function enviarForm(t, v) {
    const fecha = $('#fD', v).value || hoy(), obs = $('#fO', v).value.trim();
    let p = null;
    if (t === 'tendido') {
      const c = circ(ui.circ); if (!c) return toast('Elegí el inversor a tender', true);
      const fases = $$('.fase', v).filter((r) => { const k = $('.fon', r); return k.checked && !k.disabled; }).map((r) => ({ f: r.dataset.f, bobina: $('.fb', r).value, metros: Number(String($('.fm', r).value).replace(',', '.')) }));
      if (!fases.length) return toast('Marcá al menos un conductor', true);
      if (fases.some((f) => !(f.metros > 0))) return toast('Completá los metros de cada conductor marcado', true);
      if (fases.some((f) => f.metros > c.lenFase * 1.5 || f.metros < c.lenFase * 0.5)) { if (!confirm('Algún valor difiere mucho de la lista (' + fmt(c.lenFase, 1) + ' m). ¿Enviar igual?')) return; }
      p = { tipo: 'tendido', circuito: c.id, designacion: c.designacion, desde: c.desde, hasta: c.hasta, cat: c.cat, fases };
    } else if (t === 'pat') {
      const z = R.zlist.find((x) => x.id === ui.zanja); if (!z) return toast('Elegí la zanja', true);
      const m = Number(String($('#fPm', v).value).replace(',', '.')); if (!(m > 0)) return toast('Cargá los metros de PAT', true);
      p = { tipo: 'pat', zanja: z.id, titulo: z.titulo, metros: m, bobina: $('#fPb', v).value };
    } else if (t === 'zanja') {
      const z = R.zlist.find((x) => x.id === ui.zanja); if (!z) return toast('Elegí la zanja', true);
      const m = Number(String($('#fZl', v).value).replace(',', '.')); if (!(m > 0)) return toast('Cargá el largo real', true);
      p = { tipo: 'zanja', zanja: z.id, titulo: z.titulo, largo: m };
    } else {
      if (!obs) return toast('Escribí la observación', true);
      const z = R.zlist.find((x) => x.id === $('#fZ', v).value);
      p = { tipo: 'obs', zanja: z ? z.id : '', titulo: z ? z.titulo : '' };
    }
    p.fecha = fecha; if (obs) p.obs = obs;
    $('#fEnv', v).disabled = true;
    await encolar(p);
    ui.circ = null; tab = 'mios'; render();
  }
  function vMios(v) {
    const h0 = ls.get(KH, []);
    if (!h0.length) { v.innerHTML = '<div class="card empty"><b>Todavía no enviaste partes</b></div>'; return; }
    const ST = { cola: ['cola', 'en cola'], pend: ['pend', 'pendiente de aprobación'], ok: ['ok', 'aprobado'], no: ['no', 'rechazado'] };
    const desc = (p) => p.tipo === 'tendido' ? `${esc(p.designacion)} · ${p.fases.map((f) => `${lbl(f.f)} ${fmt(f.metros, 1)} m (${esc(f.bobina)})`).join(' · ')}` : p.tipo === 'pat' ? `PAT · ${esc(p.titulo)} · ${fmt(p.metros, 1)} m` : p.tipo === 'zanja' ? `Zanja ${esc(p.titulo)} · largo real ${fmt(p.largo, 1)} m` : `Observación${p.titulo ? ' · ' + esc(p.titulo) : ''}`;
    v.innerHTML = h0.map((p) => { const e = est(p), r = (S.partes || []).find((x) => x.id === p.id); return `<div class="card parte"><b>${desc(p)}</b><span class="st ${ST[e][0]}">${ST[e][1]}</span><span class="muted" style="grid-column:1/-1">${new Date(p.fecha + 'T12:00').toLocaleDateString('es-AR')}${p.obs ? ' · «' + esc(p.obs) + '»' : ''}${r && r.motivo ? ' · Oficina: ' + esc(r.motivo) : ''}</span></div>`; }).join('') + '<p class="hint">El estado se actualiza solo cuando la oficina aprueba o rechaza cada parte.</p>';
  }
  $$('#tabs button').forEach((b) => { b.onclick = () => { tab = b.dataset.t; render(); }; });
  $('#lgForm').onsubmit = async (e) => {
    e.preventDefault(); $('#lgE').textContent = ''; $('#lgB').disabled = true; $('#lgB').textContent = 'Ingresando…';
    try { await entrar($('#lgU').value, $('#lgP').value, $('#lgR').checked); }
    catch (er) { $('#lgE').textContent = er.message === 'perm' ? 'Tu usuario no tiene permiso de carga de campo' : /usuario|clave/.test(er.message) ? 'Usuario o contraseña incorrectos' : er.message; }
    finally { $('#lgB').disabled = false; $('#lgB').textContent = 'Ingresar'; }
  };
  auto();
  window.__campo = { get S() { return S; }, get R() { return R; }, vaciarCola };
})();
