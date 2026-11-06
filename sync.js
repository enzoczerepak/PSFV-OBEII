/* Sincronización en red local: una PC servidor, las demás clientes por IP.
   Cada PC guarda sus datos; los cambios se intercambian por registro (bobina, circuito, zanja, ajustes, compromisos).
   Conflictos: gana el cambio más reciente (con corrección de diferencia de reloj entre PCs). */
(function () {
  const KINDS = [['b', 'bobinas'], ['c', 'circuitos'], ['z', 'zanjas'], ['k', 'cronoTareas'], ['p', 'partes']];
  // Versión del protocolo: 2 agrega fundaciones STS ('f:') y conserva registros de tipos desconocidos.
  // Con una PC de versión anterior no se intercambian fundaciones (si no, la PC vieja las borraría).
  const PROTO = 2;
  // 'hc' catálogo y distribución de hincas, 'ht:' hincado por tracker, 'hr:' recepciones de hincas
  const nuevo = (k) => k.startsWith('f:') || k.startsWith('k:') || k.startsWith('p:') || k === 'km' || k === 'hc' || k.startsWith('ht:') || k.startsWith('hr:');
  const conocido = (k) => k === 'cfg' || k === 'comp' || k === 'km' || nuevo(k) || KINDS.some(([p]) => k.startsWith(p + ':'));

  // JSON con claves ordenadas: el orden interno de los campos no cuenta como cambio
  function canon(v) {
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
    return JSON.stringify(v === undefined ? null : v);
  }
  function records(S) {
    const m = new Map();
    KINDS.forEach(([p, col]) => (S[col] || []).forEach((x) => m.set(p + ':' + x.id, x)));
    m.set('cfg', Object.assign({ nombre: S.nombre, params: S.params, fuente: S.fuente || '' }, S.parque ? { parque: S.parque } : {}));
    m.set('comp', { compromiso: S.compromiso || {} });
    if (S.cronoMeta) m.set('km', S.cronoMeta);
    // fundaciones STS: un registro por STS y etapa
    Object.entries(S.fundaciones || {}).forEach(([sts, et]) => Object.entries(et || {}).forEach(([e, v]) => { if (v) m.set('f:' + sts + '|' + e, v); }));
    if (S.hincado) {
      m.set('hc', { catalogo: S.hincado.catalogo || [], matriz: S.hincado.matriz || {} });
      Object.entries(S.hincado.avance || {}).forEach(([id, v]) => { if (v) m.set('ht:' + id, v); });
      (S.hincado.recep || []).forEach((r) => m.set('hr:' + r.id, r));
    }
    // registros de versiones más nuevas: se guardan tal cual para no borrarlos
    Object.entries(S.__otros || {}).forEach(([k, v]) => m.set(k, v));
    return m;
  }
  function meta(S) {
    S.__sync = S.__sync || {};
    const y = S.__sync;
    y.snap = y.snap || {}; y.meta = y.meta || {}; y.pend = y.pend || {};
    y.rev = y.rev || 0; y.peerRev = y.peerRev || 0;
    return y;
  }
  const orden = (a, b) => ((a._o ?? 1e18) - (b._o ?? 1e18)) || String(a.id).localeCompare(String(b.id));
  function ordenar(S) { KINDS.forEach(([, col]) => { if (S[col]) S[col].sort(orden); }); }

  function aplicar(S, k, d, v) {
    if (k === 'cfg') { if (!d && v) { S.nombre = v.nombre; S.params = v.params; S.fuente = v.fuente; if (v.parque) S.parque = v.parque; } return; }
    if (k === 'comp') { if (!d && v) S.compromiso = v.compromiso || {}; return; }
    if (k === 'km') { S.cronoMeta = d ? null : v; return; }
    if (k === 'hc' || k.startsWith('ht:') || k.startsWith('hr:')) {
      const H = (S.hincado = S.hincado || { catalogo: [], matriz: {}, avance: {}, recep: [] });
      H.avance = H.avance || {}; H.recep = H.recep || [];
      if (k === 'hc') { if (!d && v) { H.catalogo = v.catalogo; H.matriz = v.matriz; } return; }
      if (k.startsWith('ht:')) { const id = k.slice(3); if (d) delete H.avance[id]; else H.avance[id] = v; return; }
      const id = k.slice(3), i = H.recep.findIndex((x) => x.id === id);
      if (d) { if (i >= 0) H.recep.splice(i, 1); } else if (i >= 0) H.recep[i] = v; else H.recep.push(v);
      return;
    }
    if (k.startsWith('f:')) { const [sts, e] = k.slice(2).split('|'); S.fundaciones = S.fundaciones || {}; const o = (S.fundaciones[sts] = S.fundaciones[sts] || {}); if (d) delete o[e]; else o[e] = v; return; }
    const [p, id] = [k.slice(0, 1), k.slice(2)];
    const col = (KINDS.find((x) => x[0] === p) || [])[1];
    if (!col) { S.__otros = S.__otros || {}; if (d) delete S.__otros[k]; else S.__otros[k] = v; return; }
    S[col] = S[col] || [];
    const i = S[col].findIndex((x) => x.id === id);
    if (d) { if (i >= 0) S[col].splice(i, 1); }
    else if (i >= 0) S[col][i] = v; else S[col].push(v);
  }

  // Marca lo que cambió desde la última vez (se llama en cada commit)
  function sellar(S, modo) {
    const y = meta(S), cur = records(S), now = Date.now();
    const touch = (k, d) => {
      const prev = y.meta[k] || {};
      y.meta[k] = { m: now, d: d ? 1 : 0, r: modo === 'servidor' ? ++y.rev : prev.r || 0 };
      if (modo === 'cliente') y.pend[k] = 1;
    };
    let n = 0;
    cur.forEach((v, k) => { const h = canon(v); if (y.snap[k] !== h) { y.snap[k] = h; touch(k, false); n++; } });
    Object.keys(y.snap).forEach((k) => { if (!cur.has(k)) { delete y.snap[k]; touch(k, true); n++; } });
    return n;
  }
  // Primera vez: toma el estado actual como base sin marcar cambios
  function base(S, modo) {
    const y = meta(S);
    if (Object.keys(y.snap).length) return;
    records(S).forEach((v, k) => { y.snap[k] = canon(v); y.meta[k] = { m: 0, d: 0, r: modo === 'servidor' ? ++y.rev : 0 }; });
  }
  // Al pasar a servidor: asegura número de revisión para todo
  function prepararServidor(S) {
    const y = meta(S);
    records(S).forEach((v, k) => { if (!y.meta[k]) y.meta[k] = { m: 0, d: 0, r: 0 }; if (!y.meta[k].r) y.meta[k].r = ++y.rev; y.snap[k] = canon(v); });
    y.pend = {};
  }

  // ---- servidor: atiende un pedido de un cliente
  function atender(S, body) {
    const y = meta(S), off = Date.now() - (Number(body.now) || Date.now());
    const viejo = !(Number(body.proto) >= PROTO);
    let aplicados = 0;
    (body.cambios || []).forEach((ch) => {
      if (viejo && (nuevo(ch.k) || !conocido(ch.k))) return; // una PC vieja no puede borrar ni pisar fundaciones
      const adj = ch.m + off, cur = y.meta[ch.k];
      if (!cur || adj >= cur.m) {
        aplicar(S, ch.k, ch.d, ch.v);
        y.meta[ch.k] = { m: adj, d: ch.d ? 1 : 0, r: ++y.rev };
        if (ch.d) delete y.snap[ch.k]; else y.snap[ch.k] = canon(ch.v);
        aplicados++;
      }
    });
    if (aplicados) ordenar(S);
    return { aplicados };
  }
  function respuesta(S, since, proto) {
    const y = meta(S), cur = records(S), out = [], viejo = !(Number(proto) >= PROTO);
    Object.entries(y.meta).forEach(([k, mt]) => { if (mt.r > since && !(viejo && nuevo(k))) out.push({ k, m: mt.m, d: mt.d, r: mt.r, v: mt.d ? null : cur.get(k) || null }); });
    return { rev: y.rev, now: Date.now(), proto: PROTO, cambios: out };
  }

  // ---- cliente
  function paquete(S, cfg) {
    const y = meta(S), cur = records(S);
    const keys = Object.keys(y.pend);
    const cambios = keys.map((k) => ({ k, m: (y.meta[k] || {}).m || Date.now(), d: (y.meta[k] || {}).d || (cur.has(k) ? 0 : 1), v: cur.get(k) || null }));
    return { body: { dev: cfg.devId, clave: cfg.clave, now: Date.now(), since: y.peerRev, proto: PROTO, cambios }, enviados: Object.fromEntries(keys.map((k) => [k, (y.meta[k] || {}).m])) };
  }
  function recibir(S, res, enviados, t0) {
    const y = meta(S);
    const off = res.now - Math.round((t0 + Date.now()) / 2);
    let aplicados = 0;
    const viejo = !(Number(res.proto) >= PROTO);
    (res.cambios || []).forEach((ch) => {
      if (viejo && nuevo(ch.k)) return; // servidor de versión anterior: no se aceptan sus borrados de fundaciones
      const local = y.meta[ch.k], mLocal = ch.m - off;
      const pendiente = y.pend[ch.k] && !(ch.k in enviados);
      if (pendiente && local && local.m > mLocal) return; // tengo un cambio más nuevo sin enviar
      const h = ch.d ? undefined : canon(ch.v);
      if (!ch.d && y.snap[ch.k] === h) { y.meta[ch.k] = { m: mLocal, d: 0, r: ch.r }; return; }
      aplicar(S, ch.k, ch.d, ch.v);
      y.meta[ch.k] = { m: mLocal, d: ch.d ? 1 : 0, r: ch.r };
      if (ch.d) delete y.snap[ch.k]; else y.snap[ch.k] = h;
      aplicados++;
    });
    Object.entries(enviados).forEach(([k, m]) => { if (y.meta[k] && y.meta[k].m <= m + 1) delete y.pend[k]; else if (!y.meta[k]) delete y.pend[k]; });
    y.peerRev = res.rev;
    y.srvId = res.srvId;
    if (aplicados) ordenar(S);
    return aplicados;
  }
  // Cliente que se une por primera vez
  function reemplazarPorServidor(S) {
    S.bobinas = []; S.circuitos = []; S.zanjas = []; S.compromiso = {}; S.fundaciones = {}; S.__otros = {}; S.cronoTareas = []; S.cronoMeta = null; S.partes = []; S.hincado = { catalogo: [], matriz: {}, avance: {}, recep: [] };
    S.__sync = { snap: {}, meta: {}, pend: {}, rev: 0, peerRev: 0 };
  }
  function marcarTodoPendiente(S) {
    const y = meta(S), now = Date.now();
    records(S).forEach((v, k) => { y.pend[k] = 1; y.meta[k] = Object.assign({ d: 0, r: 0 }, y.meta[k], { m: now }); y.snap[k] = canon(v); });
    y.peerRev = 0;
  }

  window.Sync = { PROTO, sellar, base, prepararServidor, atender, respuesta, paquete, recibir, reemplazarPorServidor, marcarTodoPendiente, ordenar, meta };
})();
