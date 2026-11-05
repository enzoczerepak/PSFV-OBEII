/* Motor de cálculo: aprovechamiento de bobinas y plan de corte para BT, MT y PAT.
   Funciona en navegador (window.Engine) y en Node (module.exports). */
(function (root) {
  const r2 = (x) => Math.round(x * 100) / 100;
  const CATS = {
    BT: { nombre: 'Baja tensión 0,8 kV', corto: 'BT', zanja: true },
    MT: { nombre: 'Media tensión 33 kV', corto: 'MT', zanja: true },
    PAT: { nombre: 'Puesta a tierra (Cu desnudo)', corto: 'PAT', zanja: false },
  };
  const ZANJA = ['no abierta', 'abierta', 'cerrada'];

  function parseSeccion(txt) {
    if (txt === null || txt === undefined || txt === '') return null;
    if (typeof txt === 'number') return txt;
    const s = String(txt).toLowerCase().replace(',', '.');
    const xs = [...s.matchAll(/x\s*(\d+(?:\.\d+)?)/g)];
    if (xs.length) return Number(xs[xs.length - 1][1]);
    const m = s.match(/(\d+(?:\.\d+)?)/);
    return m ? Number(m[1]) : null;
  }
  function fasesDe(c) {
    const n = Number(c.fases) || 3;
    if (n === 1) return ['C'];
    if (n === 3) return ['R', 'S', 'T'];
    if (n === 6) return ['R1', 'S1', 'T1', 'R2', 'S2', 'T2'];
    return Array.from({ length: n }, (_, i) => String(i + 1));
  }
  const catDe = (x) => (CATS[x.cat] ? x.cat : 'BT');
  const clave = (cat, sec) => `${cat}|${sec}`;

  // Largo a cortar por conductor: el corregido en campo si existe; si no, la lista con el ajuste % del tipo; más el margen.
  function largoFase(c, p) {
    const aj = Number(((p.ajuste || {})[catDe(c)]) || 0);
    const base = Number(c.largoCorte) > 0 ? Number(c.largoCorte) : (Number(c.cantidad) || 0) / fasesDe(c).length * (1 + aj / 100);
    return r2(base + (Number(p.margen) || 0));
  }
  const teorico = (c) => r2((Number(c.cantidad) || 0) / fasesDe(c).length);

  // Mejora local del plan provisorio: mover o intercambiar conductores entre bobinas del mismo tipo/sección
  // sin abrir bobinas nuevas, para bajar el descarte y concentrar el sobrante en remanentes útiles.
  function mejorar(prov, bob, minUtil) {
    const bk = new Map(bob.map((b) => [b.codigo + '|' + b.key, b]));
    bob.forEach((b) => { b.nProv = 0; });
    const asg = prov.filter((x) => x.bobina);
    asg.forEach((x) => { bk.get(x.bobina + '|' + x.key).nProv++; });
    const cost = (b, saldo, nProv) => {
      if (!(b.fijo || nProv > 0)) return 0;
      return 1e9 + (saldo > 0.01 && saldo < minUtil ? saldo * 1000 : 0) - saldo * saldo;
    };
    const cur = (b) => cost(b, b.saldo, b.nProv);
    let mejoras = 0;
    for (let pass = 0; pass < 40; pass++) {
      let cambio = false;
      // reubicar
      for (const x of asg) {
        const A = bk.get(x.bobina + '|' + x.key);
        let best = null, bestD = -1e-6;
        for (const B of bob) {
          if (B === A || B.key !== x.key || B.saldo + 1e-9 < x.len || !(B.fijo || B.nProv > 0)) continue;
          const d = cost(A, A.saldo + x.len, A.nProv - 1) + cost(B, B.saldo - x.len, B.nProv + 1) - cur(A) - cur(B);
          if (d < bestD) { bestD = d; best = B; }
        }
        if (best) { A.saldo = r2(A.saldo + x.len); A.nProv--; best.saldo = r2(best.saldo - x.len); best.nProv++; x.bobina = best.codigo; cambio = true; mejoras++; }
      }
      // intercambiar
      for (let i = 0; i < asg.length; i++) {
        const x = asg[i], A = bk.get(x.bobina + '|' + x.key);
        for (let j = i + 1; j < asg.length; j++) {
          const y = asg[j]; if (y.key !== x.key || Math.abs(y.len - x.len) < 0.01) continue;
          const B = bk.get(y.bobina + '|' + y.key); if (B === A) continue;
          const sa = A.saldo + x.len - y.len, sb = B.saldo + y.len - x.len;
          if (sa < -1e-9 || sb < -1e-9) continue;
          const d = cost(A, sa, A.nProv) + cost(B, sb, B.nProv) - cur(A) - cur(B);
          if (d < -1e-6) { A.saldo = r2(sa); B.saldo = r2(sb); x.bobina = B.codigo; y.bobina = A.codigo; cambio = true; mejoras++; break; }
        }
      }
      if (!cambio) break;
    }
    return mejoras;
  }

  // Best Fit Decreasing
  function bfd(piezas, bob) {
    piezas.sort((a, b) => b.len - a.len || a.orden - b.orden);
    for (const pz of piezas) {
      let best = -1;
      for (let j = 0; j < bob.length; j++) {
        const b = bob[j];
        if (b.key !== pz.key || b.saldo + 1e-9 < pz.len) continue;
        if (best < 0 || b.saldo < bob[best].saldo - 1e-9) best = j;
      }
      if (best < 0) { pz.bobina = null; pz.estado = 'falta'; continue; }
      bob[best].saldo = r2(bob[best].saldo - pz.len);
      pz.bobina = bob[best].codigo;
    }
  }

  function calcular(state) {
    const p = Object.assign({ margen: 0, minUtil: 30, cola: 0 }, state.params || {});
    const alerts = [];

    // ---- bobinas
    const codigos = new Map();
    const cnt = {};
    const bobinas = (state.bobinas || []).map((b, i) => {
      const cat = catDe(b), seccion = parseSeccion(b.seccion);
      const o = Object.assign({}, b, { idx: i, cat, seccion, key: clave(cat, seccion), entrada: Number(b.entrada) || 0 });
      cnt[o.key] = (cnt[o.key] || 0) + 1;
      if (!o.codigo) o.codigo = `${cnt[o.key]}/${seccion}`;
      const k = clave(cat, o.codigo);
      if (codigos.has(k)) alerts.push({ tipo: 'error', txt: `Código de bobina repetido en ${CATS[cat].corto}: ${o.codigo}` });
      codigos.set(k, o);
      o.consumoReal = 0; o.asigListo = 0; o.asigProv = 0; o.cortes = [];
      return o;
    });

    // ---- zanjas y circuitos (los circuitos BT/MT pertenecen a una zanja; la PAT es una por zanja)
    const zlist = (state.zanjas || []).map((z) => Object.assign({}, z, { cat: catDe(z), largo: Number(z.largo) || 0,
      estado: ZANJA.includes(z.estado) ? z.estado : 'no abierta', miembros: [] }));
    const zMap = new Map(zlist.map((z) => [z.id, z]));
    const circuitos = (state.circuitos || []).map((c, i) => {
      const cat = catDe(c), seccion = parseSeccion(c.formacion);
      const real = c.real || {}, fz = fasesDe(c);
      const nReal = fz.filter((f) => real[f] && (real[f].bobina || real[f].sinBobina)).length;
      const z = zMap.get(c.vinculo || c.zanjaId);
      const zanja = z ? z.estado : 'no abierta';
      const listo = zanja !== 'no abierta' || nReal > 0;
      return Object.assign({}, c, { idx: i, cat, seccion, key: clave(cat, seccion), fz, nReal, zanja, listo, zid: z ? z.id : null,
        zanjaLargo: z ? z.largo : 0, lenFase: largoFase(c, p), fasesInfo: {} });
    });
    circuitos.forEach((c) => { if (!c.vinculo && c.zid) zMap.get(c.zid).miembros.push(c); });

    // designaciones repetidas
    const dc = {};
    circuitos.filter((c) => !c.vinculo).forEach((c) => { dc[c.designacion] = (dc[c.designacion] || 0) + 1; });
    const dups = Object.keys(dc).filter((k) => k && dc[k] > 1);
    if (dups.length) alerts.push({ tipo: 'info', txt: 'La lista de cables usa la misma designación en dos circuitos distintos: ' +
      dups.map((k) => `${k} (${circuitos.filter((c) => c.designacion === k && !c.vinculo).map((c) => c.desde).join(' y ')})`).join(', ') +
      '. No afecta el cálculo: cada circuito se identifica también por su inversor.' });
    circuitos.forEach((c) => { if (c.seccion === null) alerts.push({ tipo: 'error', txt: `Sección no reconocida en ${c.designacion}` }); });

    // ---- cortes ejecutados
    const piezas = [], ejecutados = [];
    let orden = 0;
    circuitos.forEach((c) => {
      c.fz.forEach((f) => {
        const r = (c.real || {})[f];
        if (!(r && (r.bobina || r.sinBobina))) return;
        const len = r2(Number(r.metros) > 0 ? Number(r.metros) : c.lenFase);
        if (!r.bobina) { const pz = { cid: c.id, cidx: c.idx, cat: c.cat, key: c.key, fase: f, len, teorico: teorico(c), seccion: c.seccion, bobina: null, sinBobina: true, estado: 'ejecutado', fecha: r.fecha || '', orden: orden++ }; ejecutados.push(pz); piezas.push(pz); return; }
        const b = codigos.get(clave(c.cat, r.bobina));
        const pz = { cid: c.id, cidx: c.idx, cat: c.cat, key: c.key, fase: f, len, teorico: teorico(c), seccion: c.seccion, bobina: r.bobina, estado: 'ejecutado', fecha: r.fecha || '', orden: orden++ };
        if (!b) { alerts.push({ tipo: 'error', txt: `${c.designacion} ${f}: la bobina ${r.bobina} no existe` }); pz.bobina = null; pz.estado = 'falta'; }
        else { b.consumoReal = r2(b.consumoReal + len); if (b.seccion !== c.seccion) alerts.push({ tipo: 'aviso', txt: `${c.designacion} ${f}: la bobina ${r.bobina} es de otra sección` }); }
        ejecutados.push(pz); piezas.push(pz);
      });
    });
    ejecutados.sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '') || a.orden - b.orden);

    const bobCalc = bobinas.map((b) => ({ codigo: b.codigo, key: b.key, saldo: r2(Math.max(0, b.entrada - p.cola - b.consumoReal)), fijo: b.consumoReal > 0 }));
    // etapa 0: bobinas elegidas a mano (casos especiales): se respetan siempre
    const manuales = [], manKeys = new Set();
    circuitos.forEach((c) => {
      c.fz.forEach((f) => {
        const r = (c.real || {})[f], cod = (c.asig || {})[f];
        if ((r && (r.bobina || r.sinBobina)) || !cod || !(c.lenFase > 0)) return;
        const b = bobCalc.find((x) => x.codigo === cod && x.key === c.key);
        if (!b) { alerts.push({ tipo: 'error', txt: `${c.designacion} ${f}: la bobina elegida ${cod} no existe o es de otra sección` }); return; }
        if (b.saldo + 1e-9 < c.lenFase) { alerts.push({ tipo: 'error', txt: `${c.designacion} ${f}: a la bobina elegida ${cod} no le alcanza (${b.saldo} m para ${c.lenFase} m)` }); return; }
        b.saldo = r2(b.saldo - c.lenFase); b.fijo = true;
        manuales.push({ cid: c.id, cidx: c.idx, cat: c.cat, key: c.key, fase: f, len: c.lenFase, seccion: c.seccion, estado: c.listo ? 'listo' : 'provisorio', bobina: cod, manual: true, orden: orden++ });
        manKeys.add(c.id + '|' + f);
      });
    });
    const pend = (filtro, estado) => {
      const out = [];
      circuitos.forEach((c) => {
        if (!filtro(c)) return;
        c.fz.forEach((f) => {
          const r = (c.real || {})[f];
          if (r && (r.bobina || r.sinBobina)) return;
          if (manKeys.has(c.id + '|' + f)) return;
          if (!(c.lenFase > 0)) return;
          out.push({ cid: c.id, cidx: c.idx, cat: c.cat, key: c.key, fase: f, len: c.lenFase, seccion: c.seccion, estado, orden: orden++ });
        });
      });
      return out;
    };
    // etapa 1: lo tendible ahora. Los cortes ya comprometidos en una hoja de corte mantienen su bobina si siguen entrando.
    const comp = state.compromiso || {};
    const etapa1 = pend((c) => c.listo, 'listo');
    const libres = [];
    etapa1.slice().sort((a, b) => b.len - a.len).forEach((pz) => {
      const cod = comp[pz.cid + '|' + pz.fase];
      const b = cod && bobCalc.find((x) => x.codigo === cod && x.key === pz.key);
      if (b && b.saldo + 1e-9 >= pz.len) { b.saldo = r2(b.saldo - pz.len); pz.bobina = b.codigo; pz.fijado = true; } else libres.push(pz);
    });
    bfd(libres, bobCalc);
    // etapa 2: plan provisorio; después mejora de todo lo que no está ejecutado ni comprometido
    bobCalc.forEach((b) => { b.fijo = b.fijo || etapa1.some((x) => x.bobina === b.codigo && x.key === b.key); });
    const etapa2 = pend((c) => !c.listo, 'provisorio'); bfd(etapa2, bobCalc);
    const mejoras = p.mejorar === false ? 0 : mejorar(etapa2, bobCalc, p.minUtil);
    manuales.forEach((pz) => (pz.estado === 'listo' ? etapa1 : etapa2).push(pz));
    const compromiso = {};
    etapa1.forEach((pz) => { if (pz.bobina) compromiso[pz.cid + '|' + pz.fase] = pz.bobina; });
    piezas.push(...etapa1, ...etapa2);

    // ---- secuencia por bobina
    const saldoFis = new Map(bobinas.map((b) => [b, r2(b.entrada - p.cola)]));
    etapa1.sort((a, b) => b.len - a.len || a.orden - b.orden); etapa2.sort((a, b) => b.len - a.len || a.orden - b.orden);
    for (const pz of [...ejecutados, ...etapa1, ...etapa2]) {
      if (!pz.bobina) continue;
      const b = codigos.get(clave(pz.cat, pz.bobina)); if (!b) continue;
      const s = r2(saldoFis.get(b) - pz.len); saldoFis.set(b, s);
      pz.saldo = s; pz.corte = b.cortes.length + 1; b.cortes.push(pz);
      if (pz.estado === 'listo') b.asigListo = r2(b.asigListo + pz.len);
      if (pz.estado === 'provisorio') b.asigProv = r2(b.asigProv + pz.len);
    }
    bobinas.forEach((b) => {
      b.saldoActual = r2(b.entrada - b.consumoReal);
      b.salidaTotal = r2(b.consumoReal + b.asigListo + b.asigProv);
      b.remanente = r2(b.entrada - b.salidaTotal);
      // estado previsto al final del plan
      b.estado = b.salidaTotal === 0 ? 'no se usa' : b.remanente < 1 ? 'se usa completa' : b.remanente < p.minUtil ? 'descarte' : 'remanente útil';
      // estado real en obra
      b.cortesHechos = b.cortes.filter((x) => x.estado === 'ejecutado').length;
      b.cortesPend = b.cortes.length - b.cortesHechos;
      b.estadoReal = b.consumoReal <= 0 ? 'sin abrir' : b.cortesPend === 0 ? 'terminada' : 'en uso';
      b.usoReal = b.entrada > 0 ? b.consumoReal / b.entrada : 0;
      b.abierta = b.consumoReal > 0;
      b.aprovech = b.entrada > 0 ? b.salidaTotal / b.entrada : 0;
      if (b.remanente < -0.01) alerts.push({ tipo: 'error', txt: `Bobina ${b.codigo} (${CATS[b.cat].corto}) con saldo negativo (${b.remanente} m): revisar tendidos cargados` });
    });
    piezas.forEach((pz) => { circuitos[pz.cidx].fasesInfo[pz.fase] = pz; });
    const cMap = new Map(circuitos.map((c) => [c.id, c]));
    circuitos.forEach((c) => {
      const es = c.fz.map((f) => (c.fasesInfo[f] || {}).estado);
      c.completo = es.length > 0 && es.every((e) => e === 'ejecutado');
      const ej = c.fz.map((f) => c.fasesInfo[f]).filter((x) => x && x.estado === 'ejecutado');
      c.realTot = r2(ej.reduce((a, x) => a + x.len, 0)); c.teoTot = r2(ej.reduce((a, x) => a + x.teorico, 0)); c.desvio = r2(c.realTot - c.teoTot);
      c.estado = c.completo ? 'tendido' : es.some((e) => e === 'falta') ? 'falta bobina'
        : es.some((e) => e === 'ejecutado') ? 'tendido parcial' : c.listo ? 'listo para tender' : 'en espera de zanja';
    });
    // PAT y cierre por zanja
    circuitos.forEach((c) => { if (c.vinculo && zMap.has(c.vinculo)) zMap.get(c.vinculo).pat = c; });
    zlist.forEach((z) => {
      z.titulo = tituloZanja(z, z.miembros);
      z.nReal = z.miembros.reduce((a, c) => a + c.nReal, 0); z.nCond = z.miembros.reduce((a, c) => a + c.fz.length, 0);
      z.completo = z.miembros.length > 0 && z.miembros.every((c) => c.completo);
      z.listoCerrar = z.completo; // la PAT se registra al cerrar
      z.miembros.forEach((c) => { c.pat = z.pat; c.listoCerrar = z.listoCerrar; c.compartida = z.miembros.length > 1; c.zTitulo = z.titulo; });
    });

    // ---- resumen por tipo de cable
    const keys = [...new Set([...bobinas.map((b) => b.key), ...circuitos.map((c) => c.key)])].filter((k) => !k.endsWith('|null'));
    const ordenCat = { BT: 0, MT: 1, PAT: 2 };
    keys.sort((a, b) => ordenCat[a.split('|')[0]] - ordenCat[b.split('|')[0]] || Number(b.split('|')[1]) - Number(a.split('|')[1]));
    const sum = (arr, k) => r2(arr.reduce((a, x) => a + (Number(x[k]) || 0), 0));
    const resumen = keys.map((key) => {
      const [cat, s] = key.split('|');
      const bs = bobinas.filter((b) => b.key === key), ps = piezas.filter((x) => x.key === key);
      const req = r2(circuitos.filter((c) => c.key === key).reduce((a, c) => a + c.lenFase * c.fz.length, 0));
      return {
        key, cat, seccion: Number(s), bobinas: bs.length, stock: sum(bs, 'entrada'), requerido: req, balance: r2(sum(bs, 'entrada') - req),
        tendido: sum(ps.filter((x) => x.estado === 'ejecutado'), 'len'), tendidoTeo: sum(ps.filter((x) => x.estado === 'ejecutado'), 'teorico'), listo: sum(ps.filter((x) => x.estado === 'listo'), 'len'),
        provisorio: sum(ps.filter((x) => x.estado === 'provisorio'), 'len'), faltante: sum(ps.filter((x) => x.estado === 'falta'), 'len'),
        tramosFalta: ps.filter((x) => x.estado === 'falta').length,
        usadas: bs.filter((b) => b.salidaTotal > 0).length, sinAbrir: bs.filter((b) => b.salidaTotal === 0).length, noSeUsa: bs.filter((b) => b.salidaTotal === 0).length,
        realSinAbrir: bs.filter((b) => b.estadoReal === 'sin abrir').length, realEnUso: bs.filter((b) => b.estadoReal === 'en uso').length, realTerminadas: bs.filter((b) => b.estadoReal === 'terminada').length,
        saldoActual: sum(bs, 'saldoActual'),
        remUtil: sum(bs.filter((b) => b.estado === 'remanente útil'), 'remanente'), descarte: sum(bs.filter((b) => b.estado === 'descarte'), 'remanente'),
      };
    });
    const sinBob = resumen.filter((r) => !r.bobinas && r.requerido > 0);
    if (sinBob.length) alerts.push({ tipo: 'aviso', txt: 'Sin bobinas cargadas: ' + sinBob.map((r) => `${CATS[r.cat].corto} ${r.seccion} mm² (${r.requerido.toLocaleString('es-AR')} m)`).join(', ') });
    resumen.forEach((r) => {
      if (r.faltante > 0 && r.bobinas) alerts.push({ tipo: 'error', txt: `${CATS[r.cat].corto} ${r.seccion} mm²: faltan ${r.faltante.toLocaleString('es-AR')} m (${r.tramosFalta} conductores sin bobina)` });
    });

    // ---- zanjas
    const zanjas = {};
    ['BT', 'MT'].forEach((cat) => {
      const zs = zlist.filter((z) => z.cat === cat);
      const m = (st) => r2(zs.filter((z) => st.includes(z.estado)).reduce((a, z) => a + z.largo, 0));
      zanjas[cat] = { total: r2(zs.reduce((a, z) => a + z.largo, 0)), realizada: m(['abierta', 'cerrada']), abierta: m(['abierta']), cerrada: m(['cerrada']),
        n: zs.length, nAbiertas: zs.filter((z) => z.estado === 'abierta').length, nCerradas: zs.filter((z) => z.estado === 'cerrada').length,
        nParaCerrar: zs.filter((z) => z.estado === 'abierta' && z.listoCerrar).length, nCompartidas: zs.filter((z) => z.miembros.length > 1).length };
    });
    const sinZ = circuitos.filter((c) => !c.listo && !c.vinculo).length;
    if (sinZ) alerts.push({ tipo: 'info', txt: `${sinZ} circuitos sin zanja abierta: su plan es provisorio hasta que se abra la zanja` });
    const paraCerrar = zanjas.BT.nParaCerrar + zanjas.MT.nParaCerrar;
    if (paraCerrar) alerts.push({ tipo: 'ok', txt: `${paraCerrar} zanja${paraCerrar > 1 ? "s" : ""} con todos sus circuitos tendidos: se pueden cerrar (ahí se registra la PAT)` });

    resumen.forEach((r) => { r.desvio = r2(r.tendido - r.tendidoTeo); r.desvioPct = r.tendidoTeo > 0 ? r.desvio / r.tendidoTeo : 0; });
    return { params: p, bobinas, circuitos, piezas, resumen, alerts, zanjas, zlist, compromiso, mejoras, nManuales: manuales.length };
  }

  const PAT_SEC = { BT: '1x25 mm² Cu desnudo', MT: '1x95 mm² Cu desnudo' };
  function tituloZanja(z, miembros) {
    if (z.nombre) return z.nombre;
    if (!miembros.length) return z.id;
    const hs = [...new Set(miembros.map((c) => c.hasta))];
    if (miembros.length === 1) return `${miembros[0].desde} → ${miembros[0].hasta}`;
    // agrupa "TX2-INV1 + INV2" cuando comparten prefijo
    const pre = (d) => (String(d).match(/^(.*?)(\d+)$/) || [null, d, ''])[1];
    const p0 = pre(miembros[0].desde), mismo = miembros.every((c) => pre(c.desde) === p0);
    const ds = miembros.map((c, i) => (i && mismo ? String(c.desde).slice(p0.lastIndexOf('-') + 1) : c.desde));
    return `${ds.join(' + ')} → ${hs.join(' / ')}`;
  }
  const baseCirc = (c) => !c.vinculo && (catDe(c) === 'BT' || catDe(c) === 'MT');

  // Mantiene la estructura: cada circuito BT/MT en una zanja, una PAT por zanja. Modifica el estado.
  function sincronizarPAT(state) {
    state.zanjas = state.zanjas || [];
    let cs = state.circuitos || [];
    const zMap = new Map(state.zanjas.map((z) => [z.id, z]));
    cs.filter(baseCirc).forEach((c) => {
      if (!c.zanjaId || !zMap.has(c.zanjaId)) {
        const z = { id: 'z-' + c.id, cat: catDe(c), largo: Number(c.zanjaLargo != null ? c.zanjaLargo : c.lineal) || 0, estado: ZANJA.includes(c.zanja) ? c.zanja : 'no abierta' };
        if (c.fechaCierre) z.fechaCierre = c.fechaCierre;
        if (zMap.has(z.id)) z.id = z.id + '-' + Math.random().toString(36).slice(2, 6);
        state.zanjas.push(z); zMap.set(z.id, z); c.zanjaId = z.id;
      }
      if (c.lineal == null && c.zanjaLargo != null) c.lineal = Number(c.zanjaLargo) || 0;
      delete c.zanja; delete c.zanjaLargo; delete c.fechaCierre;
    });
    const usadas = new Set(cs.filter(baseCirc).map((c) => c.zanjaId));
    state.zanjas = state.zanjas.filter((z) => usadas.has(z.id));
    const zIds = new Set(state.zanjas.map((z) => z.id));
    // PAT de versiones anteriores (vinculada al circuito) -> pasa a su zanja
    const cById = new Map(cs.map((c) => [c.id, c]));
    cs.forEach((c) => { if (c.vinculo && !zIds.has(c.vinculo) && cById.has(c.vinculo)) c.vinculo = cById.get(c.vinculo).zanjaId; });
    const vistos = new Set();
    cs = cs.filter((c) => {
      if (!c.vinculo) return true;
      if (!zIds.has(c.vinculo) || vistos.has(c.vinculo)) return false;
      vistos.add(c.vinculo); return true;
    });
    const pats = new Map(cs.filter((c) => c.vinculo).map((c) => [c.vinculo, c]));
    state.zanjas.forEach((z) => {
      const miembros = cs.filter((c) => c.zanjaId === z.id);
      let pt = pats.get(z.id);
      if (!pt) { pt = { id: 'pat-' + z.id, cat: 'PAT', vinculo: z.id, formacion: PAT_SEC[catDe(z)], fases: 1, real: {} }; cs.push(pt); }
      Object.assign(pt, { designacion: 'PAT ' + miembros.map((c) => c.designacion).join(' + '), desde: miembros.map((c) => c.desde).join(' + '),
        hasta: [...new Set(miembros.map((c) => c.hasta))].join(' / '), cantidad: pt.largoManual > 0 ? pt.largoManual : Number(z.largo) || 0 });
      if (!pt.formacion) pt.formacion = PAT_SEC[catDe(z)];
    });
    state.circuitos = cs;
    return state;
  }

  // Une varias zanjas en una (la primera). Devuelve un mensaje de error o null.
  function unirZanjas(state, ids) {
    const zs = [...new Set(ids)].map((id) => state.zanjas.find((z) => z.id === id)).filter(Boolean);
    if (zs.length < 2) return 'Elegí al menos dos zanjas (o circuitos de zanjas distintas)';
    if (new Set(zs.map(catDe)).size > 1) return 'No se pueden unir zanjas de BT con zanjas de MT';
    const [t, ...otras] = zs;
    const patT = otras.map((z) => state.circuitos.find((c) => c.vinculo === z.id)).filter((pt) => pt && Object.keys(pt.real || {}).length);
    if (patT.length) return `La PAT de ${patT.map((x) => x.desde).join(', ')} ya está registrada: borrá ese registro antes de unir`;
    const rank = { 'no abierta': 0, abierta: 1, cerrada: 2 };
    const est = zs.map((z) => z.estado || 'no abierta');
    t.estado = est.every((e) => e === 'cerrada') ? 'cerrada' : est.some((e) => rank[e] > 0) ? 'abierta' : 'no abierta';
    t.largo = Math.max(...zs.map((z) => Number(z.largo) || 0));
    const ids2 = new Set(otras.map((z) => z.id));
    state.circuitos.forEach((c) => { if (ids2.has(c.zanjaId)) c.zanjaId = t.id; });
    state.circuitos = state.circuitos.filter((c) => !(c.vinculo && ids2.has(c.vinculo)));
    state.zanjas = state.zanjas.filter((z) => !ids2.has(z.id));
    return null;
  }
  // Saca un circuito de una zanja compartida y le da zanja propia
  function separarCircuito(state, cid) {
    const c = state.circuitos.find((x) => x.id === cid); if (!c) return;
    const z = state.zanjas.find((x) => x.id === c.zanjaId);
    if (!z || state.circuitos.filter((x) => x.zanjaId === z.id).length < 2) return;
    // si el circuito todavía no se tendió, su zanja nueva queda "no abierta" y su plan vuelve a provisorio
    const tendido = Object.values(c.real || {}).some((r) => r && (r.bobina || r.sinBobina));
    const nz = { id: 'z-' + c.id + '-' + Math.random().toString(36).slice(2, 6), cat: catDe(c), largo: Number(c.lineal) || 0, estado: tendido ? (z.estado === 'cerrada' ? 'abierta' : z.estado) : 'no abierta' };
    state.zanjas.push(nz); c.zanjaId = nz.id;
    return nz.id;
  }

  // Propuesta de tendidos: lotes de zanjas por zona (STS, inversores consecutivos), del tamaño de una bobina,
  // simulando su apertura en orden con el mismo cálculo del plan.
  function propuesta(state, cat) {
    const st = JSON.parse(JSON.stringify(state, (k, v) => (k === '__sync' ? undefined : v)));
    sincronizarPAT(st);
    let R = calcular(st); st.compromiso = R.compromiso;
    const num = (t) => { const m = String(t || '').match(/(\d+)\s*$/); return m ? Number(m[1]) : 0; };
    const pend = R.zlist.filter((z) => z.cat === cat && z.estado === 'no abierta' && z.miembros.length && !z.miembros.every((c) => c.completo));
    const zona = (z) => z.miembros[0].hasta;
    pend.sort((a, b) => String(zona(a)).localeCompare(String(zona(b)), 'es', { numeric: true }) || Math.min(...a.miembros.map((c) => num(c.desde))) - Math.min(...b.miembros.map((c) => num(c.desde))) || String(a.miembros[0].designacion).localeCompare(b.miembros[0].designacion));
    const largoBob = {};
    R.bobinas.filter((b) => b.cat === cat).forEach((b) => { (largoBob[b.key] = largoBob[b.key] || []).push(b.entrada); });
    Object.keys(largoBob).forEach((k) => { const v = largoBob[k]; largoBob[k] = v.reduce((x, y) => x + y, 0) / v.length; });
    const cableZ = (z) => { const o = {}; z.miembros.forEach((c) => { o[c.key] = (o[c.key] || 0) + c.lenFase * c.fz.length; }); return o; };
    const grupos = []; let cur = null, acc = {};
    pend.forEach((z) => {
      if (!cur || zona(z) !== cur.zona) { cur = { zona: zona(z), zanjas: [] }; grupos.push(cur); acc = {}; }
      cur.zanjas.push(z);
      const cz = cableZ(z); Object.keys(cz).forEach((k) => { acc[k] = (acc[k] || 0) + cz[k]; });
      if (Object.keys(acc).some((k) => acc[k] >= 0.95 * (largoBob[k] || 1500))) { cur = null; }
    });
    const lotes = [];
    let prevUsadas = new Set(R.bobinas.filter((b) => b.cat === cat && b.consumoReal + b.asigListo > 0).map((b) => b.codigo));
    let prevTerm = new Set(R.bobinas.filter((b) => b.cat === cat && b.cortes.length && b.cortes.every((p) => p.estado !== 'provisorio')).map((b) => b.codigo));
    grupos.forEach((g, i) => {
      const ids = new Set(g.zanjas.map((z) => z.id));
      st.zanjas.forEach((z) => { if (ids.has(z.id)) z.estado = 'abierta'; });
      R = calcular(st); st.compromiso = R.compromiso;
      const cids = new Set(g.zanjas.flatMap((z) => z.miembros.map((c) => c.id)));
      const pz = R.piezas.filter((p) => cids.has(p.cid) && p.estado !== 'ejecutado');
      const usa = {}; pz.forEach((p) => { if (p.bobina) usa[p.bobina] = r2((usa[p.bobina] || 0) + p.len); });
      const bs = R.bobinas.filter((b) => b.cat === cat);
      const usadas = new Set(bs.filter((b) => b.consumoReal + b.asigListo > 0).map((b) => b.codigo));
      const term = new Set(bs.filter((b) => b.cortes.length && b.cortes.every((p) => p.estado !== 'provisorio')).map((b) => b.codigo));
      lotes.push({
        n: i + 1, zona: g.zona, zanjas: g.zanjas.map((z) => ({ id: z.id, titulo: z.titulo, largo: z.largo, circuitos: z.miembros.map((c) => ({ id: c.id, designacion: c.designacion, desde: c.desde, hasta: c.hasta, seccion: c.seccion })) })),
        metrosZanja: r2(g.zanjas.reduce((a, z) => a + z.largo, 0)), metrosCable: r2(pz.reduce((a, p) => a + p.len, 0)),
        porSeccion: Object.entries(pz.reduce((o, p) => { o[p.seccion] = (o[p.seccion] || 0) + p.len; return o; }, {})).map(([k, v]) => [Number(k), r2(v)]).sort((a, b) => b[0] - a[0]),
        usa, nuevas: [...usadas].filter((c) => !prevUsadas.has(c)), terminadas: [...term].filter((c) => !prevTerm.has(c)).map((c) => { const b = bs.find((x) => x.codigo === c); return { codigo: c, remanente: b.remanente, estado: b.estado }; }),
        faltan: pz.filter((p) => p.estado === 'falta').length,
        enUso: usadas.size - term.size,
      });
      prevUsadas = usadas; prevTerm = term;
    });
    const tot = lotes.reduce((a, l) => a + l.metrosCable, 0); let acum = 0;
    lotes.forEach((l) => { acum += l.metrosCable; l.acumPct = tot ? acum / tot : 0; });
    return lotes;
  }

  const Engine = { calcular, propuesta, sincronizarPAT, unirZanjas, separarCircuito, tituloZanja, PAT_SEC, parseSeccion, fasesDe, CATS, ZANJA };
  if (typeof module !== 'undefined' && module.exports) module.exports = Engine; else root.Engine = Engine;
})(typeof window !== 'undefined' ? window : globalThis);
