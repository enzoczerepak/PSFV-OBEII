/* Sincronización en red local: una PC servidor, las demás clientes por IP.
   Cada PC guarda sus datos; los cambios se intercambian por registro (bobina, circuito, zanja, ajustes, compromisos).
   Conflictos: gana el cambio más reciente (con corrección de diferencia de reloj entre PCs). */
(function () {
  const KINDS = [['b', 'bobinas'], ['c', 'circuitos'], ['z', 'zanjas'], ['k', 'cronoTareas'], ['p', 'partes'], ['m', 'maquinas'], ['w', 'maqHoras'], ['e', 'maqEventos'], ['hl', 'hist'], ['us', 'usuarios'], ['mo', 'montaje']];
  // Versión del protocolo: 2 agrega fundaciones STS ('f:') y conserva registros de tipos desconocidos.
  // Con una PC de versión anterior no se intercambian fundaciones (si no, la PC vieja las borraría).
  const PROTO = 5; // 3: cada cambio lleva la revisión del servidor sobre la que se hizo · 4: al actualizar, el cliente primero toma todo del servidor · 5: tipos de 2 letras (usuarios, historial, montaje) y fin del reenvío sin fin
  // 'hc' catálogo y distribución de hincas, 'ht:' hincado por tracker, 'hr:' recepciones de hincas
  const nuevo = (k) => k.startsWith('hl:') || k.startsWith('us:') || k.startsWith('mo:') || k === 'tb' || k.startsWith('te:') || k.startsWith('tn:') || k.startsWith('f:') || k.startsWith('k:') || k.startsWith('p:') || k === 'km' || k === 'hc' || k.startsWith('ht:') || k.startsWith('hr:') || k.startsWith('m:') || k.startsWith('w:') || k.startsWith('e:') || k === 'fc' || k.startsWith('fo:') || k === 'lc' || k.startsWith('lv:') || k === 'lu' || k.startsWith('lu:') || k.startsWith('la:') || k.startsWith('sv:');
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
    // fibra óptica: criterio y un registro por zanja de MT
    if (S.fibra) { if (S.fibra.cfg) m.set('fc', S.fibra.cfg); Object.entries(S.fibra.z || {}).forEach(([id, v]) => { if (v) m.set('fo:' + id, v); }); }
    // registro de lluvias: criterio ('lu') y un registro por día ('lu:fecha')
    if (S.lluvia) { if (S.lluvia.cfg) m.set('lu', S.lluvia.cfg); Object.entries(S.lluvia.dias || {}).forEach(([f, v]) => { if (v) m.set('lu:' + f, v); }); Object.entries(S.lluvia.auto || {}).forEach(([f, v]) => { if (v) m.set('la:' + f, v); }); }
    // edificio de O&M: avance por etapa y zapata/viga ('sv:etapa|elemento')
    if (S.sala) Object.entries(S.sala.av || {}).forEach(([k, v]) => { if (v) m.set('sv:' + k, v); });
    // línea aérea de MT: piquetes y etapas ('lc') y avance por etapa y piquete ('lv:')
    if (S.lmt) { if (S.lmt.cfg) m.set('lc', S.lmt.cfg); Object.entries(S.lmt.av || {}).forEach(([k, v]) => { if (v) m.set('lv:' + k, v); }); }
    // trackers: BOM del fabricante ('tb'), entregas recibidas ('te:') y reclamos al fabricante ('tn:')
    if (S.trackers) { if (S.trackers.bom) m.set('tb', S.trackers.bom); (S.trackers.ent || []).forEach((x) => m.set('te:' + x.id, x)); (S.trackers.recl || []).forEach((x) => m.set('tn:' + x.id, x)); }
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
  // versiones anteriores de cada registro en el servidor (huella corta + cuándo se reemplazó): un cliente que manda de nuevo
  // un dato que el servidor ya había reemplazado hace rato es un eco de una PC desactualizada y no se acepta
  const ECO_MS = 10 * 60e3;
  function hsh(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36) + s.length.toString(36); }
  function guardarPrev(y, k, viejo, t) {
    if (viejo == null) return; y.prev = y.prev || {};
    const a = (y.prev[k] = y.prev[k] || []); a.push([hsh(viejo), t == null ? Date.now() : t]); if (a.length > 6) a.splice(0, a.length - 6);
  }
  function esEco(y, k, h) {
    if (!y.prev || !y.prev[k] || y.snap[k] === h) return false;
    const x = hsh(h), now = Date.now();
    return y.prev[k].some(([p, t]) => p === x && now - t > ECO_MS);
  }
  // para una corrección hecha en el programa (recupero de datos): los valores que se reemplazan quedan marcados como viejos desde ya
  function recordarViejos(S, antes) {
    const y = meta(S), cur = records(S);
    antes.forEach((h, k) => { const n = cur.has(k) ? canon(cur.get(k)) : null; if (n !== h) guardarPrev(y, k, h, 0); });
  }
  // registros de tipos conocidos que una versión anterior guardó como "desconocidos" (usuarios, historial, montaje): a su lugar
  function rescatar(S) {
    const O = S.__otros; if (!O) return 0; let n = 0;
    Object.keys(O).forEach((k) => { const ix = k.indexOf(':'); if (ix > 0 && KINDS.some(([p]) => p === k.slice(0, ix))) { aplicar(S, k, false, O[k]); delete O[k]; n++; } });
    if (!Object.keys(O).length) delete S.__otros;
    return n;
  }
  const huellas = (S) => { const m = new Map(); records(S).forEach((v, k) => m.set(k, canon(v))); return m; };
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
    if (k.startsWith('la:')) { const U = (S.lluvia = S.lluvia || {}); U.auto = U.auto || {}; const f = k.slice(3); if (d) delete U.auto[f]; else U.auto[f] = v; return; }
    if (k === 'lu' || k.startsWith('lu:')) {
      const U = (S.lluvia = S.lluvia || {}); U.dias = U.dias || {};
      if (k === 'lu') { if (!d && v) U.cfg = v; return; }
      const f = k.slice(3); if (d) delete U.dias[f]; else U.dias[f] = v; return;
    }
    if (k === 'tb' || k.startsWith('te:') || k.startsWith('tn:')) {
      const T = (S.trackers = S.trackers || {}); T.ent = T.ent || []; T.recl = T.recl || [];
      if (k === 'tb') { if (!d && v) T.bom = v; return; }
      const col = k.startsWith('te:') ? T.ent : T.recl, id = k.slice(3), i = col.findIndex((x) => x.id === id);
      if (d) { if (i >= 0) col.splice(i, 1); } else if (i >= 0) col[i] = v; else col.push(v);
      return;
    }
    if (k.startsWith('sv:')) { S.sala = S.sala || {}; S.sala.av = S.sala.av || {}; const e = k.slice(3); if (d) delete S.sala.av[e]; else S.sala.av[e] = v; return; }
    if (k === 'lc' || k.startsWith('lv:')) {
      const L = (S.lmt = S.lmt || {}); L.av = L.av || {};
      if (k === 'lc') { if (!d && v) L.cfg = v; return; }
      const id = k.slice(3); if (d) delete L.av[id]; else L.av[id] = v; return;
    }
    if (k === 'fc' || k.startsWith('fo:')) {
      const F = (S.fibra = S.fibra || {}); F.z = F.z || {};
      if (k === 'fc') { if (!d && v) F.cfg = v; return; }
      const id = k.slice(3); if (d) delete F.z[id]; else F.z[id] = v; return;
    }
    if (k.startsWith('f:')) { const [sts, e] = k.slice(2).split('|'); S.fundaciones = S.fundaciones || {}; const o = (S.fundaciones[sts] = S.fundaciones[sts] || {}); if (d) delete o[e]; else o[e] = v; return; }
    const ix = k.indexOf(':'), p = k.slice(0, ix), id = k.slice(ix + 1); // prefijo de 1 o 2 letras (us:, hl:, mo:)
    const col = ix > 0 ? (KINDS.find((x) => x[0] === p) || [])[1] : null;
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
    const srv = modo !== 'cliente';
    cur.forEach((v, k) => { const h = canon(v); if (y.snap[k] !== h) { if (srv) guardarPrev(y, k, y.snap[k]); y.snap[k] = h; touch(k, false); n++; } });
    Object.keys(y.snap).forEach((k) => { if (!cur.has(k)) { if (srv) guardarPrev(y, k, y.snap[k]); delete y.snap[k]; touch(k, true); n++; } });
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
    let aplicados = 0, rechazados = 0; const rech = [];
    if (viejo) return { aplicados: 0, rechazados: (body.cambios || []).length, viejo: true }; // una PC con versión anterior solo recibe: no puede pisar datos
    const cols = records(S);
    (body.cambios || []).forEach((ch) => {
      if (ch.k === 'comp') return; // los compromisos de corte los calcula el servidor con sus propios datos
      const adj = ch.m + off, cur = y.meta[ch.k];
      if (!ch.d && ch.v && esEco(y, ch.k, canon(ch.v))) { rechazados++; rech.push(ch.k); return; } // dato que el servidor ya había reemplazado: PC desactualizada
      // el cambio se hizo sobre una versión vieja del registro (otra PC lo cambió después): no se pisa
      if (cur && cur.r && !(Number(ch.base) >= cur.r)) {
        const sv = cols.get(ch.k);
        if (ch.k.startsWith('w:') && !ch.d && !cur.d && sv && ch.v) {
          // horas de equipos: se suman las lecturas de los dos lados (lo del servidor no se pierde)
          const m = Object.assign({}, sv, ch.v); ['lect', 'hs', 'per'].forEach((f) => { if (sv[f] || ch.v[f]) m[f] = Object.assign({}, sv[f] || {}, ch.v[f] || {}); });
          if (canon(m) !== canon(sv)) { aplicar(S, ch.k, false, m); y.meta[ch.k] = { m: Math.max(adj, cur.m), d: 0, r: ++y.rev }; guardarPrev(y, ch.k, y.snap[ch.k]); y.snap[ch.k] = canon(m); aplicados++; }
        } else { rechazados++; rech.push(ch.k); }
        return;
      }
      if (!cur || adj >= cur.m || (cur && Number(ch.base) >= cur.r)) {
        aplicar(S, ch.k, ch.d, ch.v);
        y.meta[ch.k] = { m: adj, d: ch.d ? 1 : 0, r: ++y.rev };
        guardarPrev(y, ch.k, y.snap[ch.k]);
        if (ch.d) delete y.snap[ch.k]; else y.snap[ch.k] = canon(ch.v);
        aplicados++;
      }
    });
    if (aplicados) ordenar(S);
    return { aplicados, rechazados, rech };
  }
  // extra: claves que el cliente mandó y se rechazaron → se le devuelve la versión del servidor para que la tome
  function respuesta(S, since, proto, extra) {
    const y = meta(S), cur = records(S), out = [], viejo = !(Number(proto) >= PROTO), ex = new Set(extra || []);
    Object.entries(y.meta).forEach(([k, mt]) => { if ((mt.r > since || ex.has(k)) && !(viejo && nuevo(k))) out.push({ k, m: mt.m, d: mt.d, r: mt.r, v: mt.d ? null : cur.get(k) || null }); });
    return { rev: y.rev, now: Date.now(), proto: PROTO, cambios: out };
  }

  // ---- cliente
  function paquete(S, cfg) {
    const y = meta(S), cur = records(S);
    // versión nueva del programa: primero se toma todo del servidor, sin mandar nada (una versión vieja pudo quedar con
    // datos distintos de los del servidor aunque creyera tenerlos; lo cargado en ella y no enviado se descarta)
    let soloRecibir = false;
    if (y.proto !== PROTO) { y.peerRev = 0; y.proto = PROTO; y.pend = {}; soloRecibir = true; }
    // con un servidor de otra versión no se manda nada (solo se recibe) hasta que las dos PCs tengan la misma
    if (y.srvProto != null && Number(y.srvProto) !== PROTO) soloRecibir = true;
    const keys = soloRecibir ? [] : Object.keys(y.pend);
    const cambios = keys.map((k) => ({ k, m: (y.meta[k] || {}).m || Date.now(), d: (y.meta[k] || {}).d || (cur.has(k) ? 0 : 1), v: cur.get(k) || null, base: (y.meta[k] || {}).r || 0 }));
    return { body: { dev: cfg.devId, clave: cfg.clave, now: Date.now(), since: y.peerRev, proto: PROTO, cambios }, enviados: Object.fromEntries(keys.map((k) => [k, cur.has(k) ? canon(cur.get(k)) : null])) };
  }
  function recibir(S, res, enviados, t0) {
    const y = meta(S);
    const off = res.now - Math.round((t0 + Date.now()) / 2);
    let aplicados = 0;
    const viejo = !(Number(res.proto) >= PROTO);
    const cur = records(S);
    (res.cambios || []).forEach((ch) => {
      if (viejo && nuevo(ch.k)) return; // servidor de versión anterior: no se aceptan sus borrados de fundaciones
      const local = y.meta[ch.k], mLocal = ch.m - off;
      const pendiente = y.pend[ch.k] && !(ch.k in enviados);
      if (pendiente && local && local.m > mLocal) return; // tengo un cambio más nuevo sin enviar
      const h = ch.d ? undefined : canon(ch.v);
      // se compara con el dato que realmente hay en esta PC (no con lo que se creía tener)
      if (!ch.d && cur.has(ch.k) && canon(cur.get(ch.k)) === h) { y.meta[ch.k] = { m: mLocal, d: 0, r: ch.r }; y.snap[ch.k] = h; return; }
      if (ch.d && !cur.has(ch.k)) { y.meta[ch.k] = { m: mLocal, d: 1, r: ch.r }; delete y.snap[ch.k]; return; }
      aplicar(S, ch.k, ch.d, ch.v);
      y.meta[ch.k] = { m: mLocal, d: ch.d ? 1 : 0, r: ch.r };
      if (ch.d) delete y.snap[ch.k]; else y.snap[ch.k] = h;
      aplicados++;
    });
    // lo enviado deja de estar pendiente (el servidor ya lo tomó o devolvió su versión), salvo que se haya vuelto a cambiar mientras viajaba
    const cur2 = records(S), recib = new Map((res.cambios || []).map((c) => [c.k, c.d ? null : canon(c.v)]));
    Object.entries(enviados).forEach(([k, h]) => { const a = cur2.has(k) ? canon(cur2.get(k)) : null; if (a === h || (recib.has(k) && recib.get(k) === a)) { delete y.pend[k]; y.snap[k] = a == null ? undefined : a; if (a == null) delete y.snap[k]; } });
    y.peerRev = res.rev;
    y.srvId = res.srvId; y.srvProto = Number(res.proto) || 0;
    if (aplicados) ordenar(S);
    return aplicados;
  }
  // Cliente que se une por primera vez
  function reemplazarPorServidor(S) {
    S.trackers = { ent: [], recl: [] }; S.hist = []; S.usuarios = []; S.montaje = []; S.bobinas = []; S.circuitos = []; S.zanjas = []; S.compromiso = {}; S.fundaciones = {}; S.__otros = {}; S.cronoTareas = []; S.cronoMeta = null; S.partes = []; S.maquinas = []; S.maqHoras = []; S.maqEventos = []; S.fibra = { cfg: { cada: 50, adic: 0 }, z: {} }; S.lmt = { cfg: { piquetes: [], etapas: [] }, av: {} }; S.lluvia = { cfg: { desde: today(), umbral: 1 }, dias: {} }; S.sala = { cfg: {}, av: {} }; S.hincado = { catalogo: [], matriz: {}, avance: {}, recep: [] };
    S.__sync = { snap: {}, meta: {}, pend: {}, rev: 0, peerRev: 0 };
  }
  function marcarTodoPendiente(S) {
    const y = meta(S), now = Date.now();
    records(S).forEach((v, k) => { y.pend[k] = 1; y.meta[k] = Object.assign({ d: 0, r: 0 }, y.meta[k], { m: now }); y.snap[k] = canon(v); });
    y.peerRev = 0;
  }

  window.Sync = { PROTO, huellas, recordarViejos, rescatar, sellar, base, prepararServidor, atender, respuesta, paquete, recibir, reemplazarPorServidor, marcarTodoPendiente, ordenar, meta };
})();
