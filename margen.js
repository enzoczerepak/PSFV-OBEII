// Margen de tendido: cuánto más largo que el plan puede salir lo que falta tender sin quedarse sin cable,
// y la tolerancia que se acepta al tender cada conductor (seguro / riesgo / falta de cable).
// Se usa en el programa, el visor y la app de campo. Necesita Engine.
(function (root) {
  const E = () => root.Engine || (typeof require !== 'undefined' ? require('./engine.js') : null);
  const conAjuste = (st, cat, x) => {
    const aj0 = Number(((st.params || {}).ajuste || {})[cat]) || 0;
    return Object.assign({}, st, { params: Object.assign({}, st.params, { ajuste: Object.assign({}, (st.params || {}).ajuste, { [cat]: ((1 + aj0 / 100) * (1 + x / 100) - 1) * 100 }) }) });
  };
  const faltaDe = (st, key) => { const r = E().calcular(st).resumen.find((q) => q.key === key); return r ? r.faltante : 0; };
  // mayor exceso % sobre el plan, en todo lo no tendido de esa sección, que el stock todavía cubre
  function pct(st, cat, key, it) {
    it = it || 12;
    const f = (x) => faltaDe(conAjuste(st, cat, x), key);
    if (f(0) > 0) { let lo = -40, hi = 0; if (f(lo) > 0) return { x: null, ya: true }; for (let i = 0; i < 9; i++) { const m = (lo + hi) / 2; if (f(m) > 0) hi = m; else lo = m; } return { x: lo, ya: true }; }
    let lo = 0, hi = 200; if (f(hi) === 0) return { x: 200, mas: true };
    for (let i = 0; i < it; i++) { const m = (lo + hi) / 2; if (f(m) > 0) hi = m; else lo = m; }
    return { x: lo };
  }
  // mayor largo extra fijo por conductor (sobre el margen por corte actual)
  function metros(st, cat, key, it) {
    it = it || 15;
    const m0 = Number((st.params || {}).margen) || 0;
    const f = (x) => faltaDe(Object.assign({}, st, { params: Object.assign({}, st.params, { margen: m0 + x }) }), key);
    if (f(0) > 0) return { x: null, ya: true };
    let lo = 0, hi = 1000; if (f(hi) === 0) return { x: 1000, mas: true };
    for (let i = 0; i < it; i++) { const m = (lo + hi) / 2; if (f(m) > 0) hi = m; else lo = m; }
    return { x: lo };
  }
  function base(R, r) {
    const pend = R.piezas.filter((x) => x.key === r.key && x.estado !== 'ejecutado');
    return { key: r.key, cat: r.cat, seccion: r.seccion, bobinas: r.bobinas, nCond: pend.length, mPend: pend.reduce((a, x) => a + x.len, 0), faltante: r.faltante,
      sobra: (r.stock || 0) - (r.tendido || 0) - (r.listo || 0) - (r.provisorio || 0) - (r.faltante || 0) };
  }
  const secciones = (R, cats) => R.resumen.filter((r) => (!cats || cats.includes(r.cat)) && (r.requerido > 0 || r.bobinas) && R.piezas.some((x) => x.key === r.key && x.estado !== 'ejecutado'));
  // todo junto (sincrónico)
  function calcular(st, R, opts) {
    opts = opts || {};
    return secciones(R, opts.cats).map((r) => Object.assign(base(R, r), { pct: pct(st, r.cat, r.key, opts.it), m: opts.metros === false ? null : metros(st, r.cat, r.key) }));
  }
  // de a una sección por vez, sin trabar la pantalla; cancelar() corta si cambió el estado
  function enSegundoPlano(st, R, opts, cb) {
    opts = opts || {};
    const rs = secciones(R, opts.cats), out = []; let i = 0, vivo = true;
    const paso = () => {
      if (!vivo) return;
      if (i >= rs.length) { cb(out); return; }
      const r = rs[i++]; out.push(Object.assign(base(R, r), { pct: pct(st, r.cat, r.key, opts.it), m: opts.metros === false ? null : metros(st, r.cat, r.key) }));
      setTimeout(paso, 15);
    };
    setTimeout(paso, opts.demora || 50);
    return { cancelar: () => { vivo = false; } };
  }
  // tolerancia para un conductor de largo de plan L en una sección con margen g (fraccion segura f, 0..1)
  function tolerancia(g, L, f) {
    f = f == null ? 0.5 : f;
    if (!g || !(L > 0)) return null;
    if (g.faltante > 0 || !g.pct || g.pct.x == null || g.pct.x <= 0) return { L, seg: L, max: L, P: g.pct && g.pct.x != null ? g.pct.x : 0, sinMargen: true };
    const P = Math.min(g.pct.x, 200);
    const fl = (x) => Math.max(L, Math.floor(x + 1e-6));
    return { L, P, seg: fl(L * (1 + P * f / 100)), max: fl(L * (1 + P / 100)) };
  }
  // tope físico de la bobina: un conductor no puede pasar de lo que queda en su bobina.
  // seguro: la holgura de la bobina (saldo real − todos sus cortes listos) se reparte entre esos cortes en proporción a su largo,
  //   así aunque TODOS se tiendan en su seguro, el último entra igual; se recalcula con cada parte aprobado.
  // riesgo: margen de la sección, sin pasar del saldo real de la bobina (si se usa, el plan mueve otros cortes a otra bobina).
  // p: { bobina, key, cid, fase, len } (el corte a tirar); R: resultado del motor
  function topeBobina(t, p, R, L) {
    if (!p || !p.bobina || !R) return t;
    const b = (R.bobinas || []).find((x) => x.codigo === p.bobina && (!p.key || x.key === p.key)); if (!b) return t;
    const saldo = Math.max(0, Number(b.saldoActual) || 0);
    const otros = (R.piezas || []).filter((q) => q.bobina === p.bobina && q.key === b.key && q.estado === 'listo' && !(q.cid === p.cid && q.fase === p.fase)).reduce((a, q) => a + (Number(q.len) || 0), 0);
    const base = t || { L: L || p.len, seg: L || p.len, max: L || p.len, P: 0 }, LL = base.L;
    const tot = otros + LL, holg = saldo - tot, libre = Math.max(0, saldo - otros);
    const seg = Math.min(base.seg, holg >= 0 ? LL + holg * (LL / tot) : libre), max = Math.max(seg, Math.min(base.max, saldo));
    if (t && seg >= base.seg - 0.05 && max >= base.max - 0.05) return t;
    const r1 = (x) => Math.floor(x + 1e-6);
    return Object.assign({}, base, { seg: r1(seg), max: r1(max), bob: { codigo: p.bobina, saldo: r1(saldo), libre: r1(libre), holg: r1(Math.max(0, holg)), n: (R.piezas || []).filter((q) => q.bobina === p.bobina && q.key === b.key && q.estado === 'listo').length || 1, corto: libre < LL - 0.05 }, sinMargen: max <= LL + 0.05 });
  }
  // nivel de unos metros tirados: 'ok' (seguro o de menos), 'riesgo', 'falta'
  function nivel(t, m) {
    if (!t || !(m > 0)) return null;
    if (m <= t.seg + 0.05) return 'ok';
    if (m <= t.max + 0.05) return 'riesgo';
    return 'falta';
  }
  // color del margen de una sección: ok / warn / bad
  const color = (g) => (!g || g.faltante > 0 || !g.pct || g.pct.x == null || g.pct.x < 1 ? 'bad' : g.pct.x < 3 ? 'warn' : 'ok');
  const api = { pct, metros, calcular, enSegundoPlano, tolerancia, topeBobina, nivel, color, secciones };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Margen = api;
})(typeof window !== 'undefined' ? window : globalThis);
