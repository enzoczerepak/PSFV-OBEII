/* Importación / exportación de Excel (SheetJS) */
(function () {
  const norm = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
  const num = (v) => {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return v;
    let s = String(v).trim();
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(',', '.');
    const n = Number(s.replace(/[^\d.\-]/g, ''));
    return isNaN(n) ? null : n;
  };
  const fecha = (v) => {
    if (!v) return '';
    if (v instanceof Date) { const d = new Date(v.getTime() - v.getTimezoneOffset() * 60000); return d.toISOString().slice(0, 10); }
    const m = String(v).match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
    if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
    return String(v).slice(0, 10);
  };

  function sheetRows(ws) { return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: false }); }

  // Busca la fila de encabezado que contiene todas las claves y devuelve el mapa columna -> campo
  function findHeader(rows, required, map) {
    for (let i = 0; i < Math.min(rows.length, 40); i++) {
      const h = rows[i].map(norm);
      if (!required.every((k) => h.some((x) => x.includes(k)))) continue;
      const cols = {};
      for (const [field, keys, excl] of map) {
        const j = h.findIndex((x) => x && keys.some((k) => x.includes(k)) && !(excl || []).some((e) => x.includes(e)));
        if (j >= 0 && !Object.values(cols).includes(j)) cols[field] = j;
      }
      return { row: i, cols };
    }
    return null;
  }

  const tipo = (v) => { const t = String(v || '').toUpperCase(); return /PRYSALAC|AL\s*\/\s*AC|A[EÉ]REA|\bLA\b/.test(t) ? 'LA' : /PAT|DESN/.test(t) ? 'PAT' : /MT|MEDIA/.test(t) ? 'MT' : /BT|BAJA/.test(t) ? 'BT' : null; };
  function parseBobinas(rows) {
    const h = findHeader(rows, ['BOBINA', 'SECCION'], [
      ['fecha', ['FECHA']], ['remito', ['REMITO']], ['codigo', ['CODIGO', 'INTERNO']],
      ['nro', ['N DE BOBINA', 'N° DE BOBINA', 'NRO', 'NUMERO', 'BOBINA'], ['CODIGO', 'INTERNO']],
      ['seccion', ['SECCION']], ['entrada', ['ENTRADA', 'CANTIDAD', 'METROS'], ['SALIDA']], ['obs', ['OBSERV']], ['tipo', ['TIPO']],
    ]);
    if (!h) return null;
    const out = [];
    for (let i = h.row + 1; i < rows.length; i++) {
      const r = rows[i], g = (k) => (h.cols[k] != null ? r[h.cols[k]] : null);
      const entrada = num(g('entrada'));
      if (!g('nro') || !entrada) continue;
      out.push({ fecha: fecha(g('fecha')), remito: g('remito') != null ? String(g('remito')) : '', nro: String(g('nro')).trim(),
        seccion: String(g('seccion') || '').trim(), entrada, codigo: g('codigo') ? String(g('codigo')).trim() : '', obs: g('obs') ? String(g('obs')) : '' });
      const t = tipo(g('tipo')); if (t) out[out.length - 1].cat = t;
    }
    return out;
  }

  function parseCircuitos(rows) {
    const h = findHeader(rows, ['DESIGNACI', 'DESDE'], [
      ['designacion', ['DESIGNACI']], ['desde', ['DESDE']], ['hasta', ['HASTA']], ['formacion', ['FORMACI']],
      ['fases', ['FASES']], ['cantidad', ['CANTIDAD', 'CAMTIDAD']], ['lineal', ['LINEAL']], ['efectiva', ['EFECTIVA']], ['tablero', ['TABLERO']], ['tipo', ['TIPO']],
    ]);
    if (!h) return null;
    const out = [];
    for (let i = h.row + 1; i < rows.length; i++) {
      const r = rows[i], g = (k) => (h.cols[k] != null ? r[h.cols[k]] : null);
      const fases = num(g('fases')) || 3, lin = num(g('lineal')), ef = num(g('efectiva'));
      const cant = num(g('cantidad')) || ((ef || lin) ? Math.round((ef || lin) * fases * 100) / 100 : null);
      if (!g('designacion') || !cant || !g('formacion')) continue;
      const c = { designacion: String(g('designacion')).trim(), desde: String(g('desde') || '').trim(), hasta: String(g('hasta') || '').trim(),
        formacion: String(g('formacion')).trim(), fases, cantidad: cant, lineal: lin };
      if (ef) c.efectiva = ef;
      if (g('tablero')) c.tablero = String(g('tablero')).trim();
      const t = tipo(g('tipo')); if (t) c.cat = t;
      out.push(c);
    }
    return out;
  }

  function parseTramos(rows) {
    const h = findHeader(rows, ['TRAMO', 'LARGO'], [
      ['id', ['TRAMO', 'CODIGO']], ['descripcion', ['DESCRIP', 'UBICACION']], ['largo', ['LARGO', 'LONGITUD']],
      ['abierto', ['ABIERTO', 'AVANCE', 'EJECUTADO']], ['obs', ['OBSERV']],
    ]);
    if (!h) return null;
    const out = [];
    for (let i = h.row + 1; i < rows.length; i++) {
      const r = rows[i], g = (k) => (h.cols[k] != null ? r[h.cols[k]] : null);
      if (!g('id') || !num(g('largo'))) continue;
      out.push({ id: String(g('id')).trim(), descripcion: g('descripcion') ? String(g('descripcion')) : '', largo: num(g('largo')),
        abierto: num(g('abierto')) || 0, obs: g('obs') ? String(g('obs')) : '' });
    }
    return out;
  }

  function parseRecorridos(rows) {
    const h = findHeader(rows, ['TRAMOS'], [['designacion', ['DESIGNACI', 'CIRCUITO']], ['desde', ['DESDE', 'INVERSOR']], ['tramos', ['TRAMOS']]]);
    if (!h || h.cols.designacion == null) return null;
    const out = [];
    for (let i = h.row + 1; i < rows.length; i++) {
      const r = rows[i], g = (k) => (h.cols[k] != null ? r[h.cols[k]] : null);
      if (!g('designacion')) continue;
      const tr = String(g('tramos') || '').split(/[;,\s|]+/).map((x) => x.trim()).filter(Boolean);
      out.push({ designacion: String(g('designacion')).trim(), desde: g('desde') ? String(g('desde')).trim() : '', tramos: tr });
    }
    return out;
  }

  function readWorkbook(data) {
    const wb = XLSX.read(data, { type: 'array', cellDates: true });
    const res = { bobinas: null, circuitos: null, tramos: null, recorridos: null };
    for (const name of wb.SheetNames) {
      const rows = sheetRows(wb.Sheets[name]);
      const tests = [['recorridos', parseRecorridos], ['tramos', parseTramos], ['circuitos', parseCircuitos], ['bobinas', parseBobinas]];
      for (const [k, fn] of tests) {
        if (res[k]) continue;
        const v = fn(rows);
        if (v && v.length) { res[k] = v; break; }
      }
    }
    return res;
  }

  // ---------- exportación ----------
  function sheet(aoa, widths) {
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    if (widths) ws['!cols'] = widths.map((w) => ({ wch: w }));
    return ws;
  }

  function exportPlan(state, R) {
    const wb = XLSX.utils.book_new();
    const cMap = new Map(R.circuitos.map((c) => [c.id, c]));
    const est = { ejecutado: 'Ejecutado', listo: 'Listo para cortar', provisorio: 'Provisorio (espera zanja)', falta: 'SIN BOBINA' };
    const CN = (typeof window !== 'undefined' && window.CATN) || { BT: 'BT 0,8 kV', MT: 'MT 33 kV', PAT: 'PAT Cu desnudo', LA: 'LA 33 kV Prysalac' };

    const res = [['Resumen – ' + (state.nombre || '')], ['Ver la hoja "Explicación" para el significado de cada columna.'], [],
      ['Tipo', 'Sección mm²', 'Bobinas (total)', 'Sin abrir (real)', 'En uso (real)', 'Terminadas (real)', 'Stock ingresado (m)', 'Requerido (m)', 'Tendido (m)', 'Saldo actual en bobinas (m)',
        'Listo para cortar (m)', 'Provisorio (m)', 'Faltante (m)', 'Balance stock − requerido (m)', 'Bobinas que el plan no usa', 'Remanente útil previsto (m)', 'Descarte previsto (m)']];
    R.resumen.forEach((r) => res.push([CN[r.cat], r.seccion, r.bobinas, r.realSinAbrir, r.realEnUso, r.realTerminadas, r.stock, r.requerido, r.tendido, r.saldoActual,
      r.listo, r.provisorio, r.faltante, r.balance, r.noSeUsa, r.remUtil, r.descarte]));
    res.push([], ['Zanjas', 'Total (m)', 'Realizada (m)', 'Abierta (m)', 'Cerrada (m)', 'Zanjas', 'Abiertas', 'Cerradas']);
    ['BT', 'MT'].forEach((k) => { const z = R.zanjas[k]; res.push([CN[k], z.total, z.realizada, z.abierta, z.cerrada, z.n, z.nAbiertas, z.nCerradas]); });
    res.push([], ['Parámetros', `Margen por corte ${R.params.margen} m`, `Remanente mínimo útil ${R.params.minUtil} m`, `Cola no utilizable ${R.params.cola} m`,
      `Corrección de largo BT ${((R.params.ajuste || {}).BT || 0)} % · MT ${((R.params.ajuste || {}).MT || 0)} % · PAT ${((R.params.ajuste || {}).PAT || 0)} %`]);
    res.push(['Generado', new Date().toLocaleString('es-AR')]);
    XLSX.utils.book_append_sheet(wb, sheet(res, [16, 11, 10, 10, 10, 11, 14, 13, 11, 16, 14, 12, 11, 16, 14, 16, 14]), 'Resumen');

    const plan = [['Tipo', 'Bobina', 'N° fabricante', 'Sección', 'Corte N°', 'Estado', 'Circuito', 'Desde', 'Hasta', 'Fase', 'Metros', 'Saldo tras corte', 'Fecha']];
    R.bobinas.forEach((b) => b.cortes.forEach((p) => {
      const c = cMap.get(p.cid);
      plan.push([b.cat, b.codigo, b.nro, b.seccion, p.corte, est[p.estado], c.designacion, c.desde, c.hasta, p.fase === 'C' ? '' : p.fase, p.len, p.saldo, p.fecha || '']);
    }));
    R.piezas.filter((p) => p.estado === 'falta').forEach((p) => { const c = cMap.get(p.cid); plan.push([p.cat, '—', '', p.seccion, '', est.falta, c.designacion, c.desde, c.hasta, p.fase === 'C' ? '' : p.fase, p.len, '', '']); });
    XLSX.utils.book_append_sheet(wb, sheet(plan, [6, 9, 12, 8, 8, 22, 15, 22, 22, 6, 10, 14, 11]), 'Plan de corte');

    const bob = [['Tipo', 'Código', 'N° fabricante', 'Remito', 'Fecha ingreso', 'Sección', 'Entrada (m)',
      'Estado real', 'Tendido real (m)', 'Saldo actual (m)', 'Uso real (%)', 'Cortes hechos',
      'Plan: listo para cortar (m)', 'Plan: provisorio (m)', 'Cortes pendientes', 'Remanente final previsto (m)', 'Uso previsto (%)', 'Destino previsto', 'Observaciones']];
    R.bobinas.forEach((b) => bob.push([b.cat, b.codigo, b.nro, b.remito, b.fecha, b.seccion, b.entrada,
      b.estadoReal, b.consumoReal, b.saldoActual, Math.round(b.usoReal * 1000) / 10, b.cortesHechos,
      b.asigListo, b.asigProv, b.cortesPend, b.remanente, Math.round(b.aprovech * 1000) / 10, b.estado, b.obs || '']));
    XLSX.utils.book_append_sheet(wb, sheet(bob, [6, 9, 12, 10, 12, 8, 11, 11, 13, 13, 11, 11, 18, 16, 14, 20, 14, 15, 24]), 'Bobinas');

    const cir = [['Tipo', 'Designación', 'Desde', 'Hasta', 'Formación', 'Cantidad (m)', 'm por conductor', 'Largo zanja (m)', 'Zanja', 'Bobinas', 'Estado']];
    R.circuitos.forEach((c) => {
      const bs = c.fz.map((f) => { const p = c.fasesInfo[f]; return p ? (f === 'C' ? '' : f + ' ') + (p.bobina || (p.sinBobina ? 'sin bobina' : 'FALTA')) + (p.estado === 'ejecutado' ? ' ✓' : '') : ''; }).join(' | ');
      cir.push([c.cat, c.designacion, c.desde, c.hasta, c.formacion, c.cantidad, c.lenFase, c.zanjaLargo, c.zanja, bs, c.estado]);
    });
    XLSX.utils.book_append_sheet(wb, sheet(cir, [6, 16, 24, 24, 20, 12, 14, 14, 11, 50, 18]), 'Circuitos');

    const zan = [['Tipo', 'Zanja', 'Circuitos', 'Largo zanja (m)', 'Estado', 'Fecha cierre', 'Cable tendido', 'PAT tendida', 'Bobina PAT']];
    R.zlist.forEach((z) => zan.push([z.cat, z.titulo, z.miembros.map((c) => c.designacion).join(' + '), z.largo, z.estado, z.fechaCierre || '', `${z.nReal}/${z.nCond}`,
      z.pat && z.pat.completo ? 'Sí' : 'No', z.pat && z.pat.fasesInfo.C ? z.pat.fasesInfo.C.bobina || '' : '']));
    XLSX.utils.book_append_sheet(wb, sheet(zan, [6, 30, 30, 14, 11, 12, 13, 11, 10]), 'Zanjas');
    ['BT', 'MT'].forEach((cat) => {
      const L = Engine.propuesta(state, cat); if (!L.length) return;
      const pr = [['Lote', 'Zona', 'Zanjas', 'Circuitos', 'Zanja a abrir (m)', 'Cable a tender (m)', 'Bobinas que empieza', 'Bobinas que termina', 'Bobinas en uso al terminar', '% acumulado']];
      L.forEach((l) => pr.push([l.n, l.zona, l.zanjas.map((z) => z.titulo).join(' | '), l.zanjas.flatMap((z) => z.circuitos.map((c) => c.designacion)).join(', '), l.metrosZanja, l.metrosCable,
        l.nuevas.join(', '), l.terminadas.map((t) => `${t.codigo} (queda ${t.remanente} m)`).join(', '), l.enUso, Math.round(l.acumPct * 1000) / 10]));
      XLSX.utils.book_append_sheet(wb, sheet(pr, [6, 14, 60, 50, 16, 16, 24, 34, 14, 12]), 'Propuesta ' + cat);
    });
    const ex = [['Hoja', 'Columna', 'Qué significa'],
      ['Todas', 'Real / Plan', 'REAL es lo que ya pasó en obra (tendidos registrados con Tender). PLAN es lo previsto por el programa para lo que falta tender.'],
      ['Resumen', 'Sin abrir (real)', 'Bobinas de las que todavía no se cortó nada.'],
      ['Resumen', 'En uso (real)', 'Bobinas empezadas que todavía tienen cortes pendientes en el plan.'],
      ['Resumen', 'Terminadas (real)', 'Bobinas empezadas a las que ya no les queda ningún corte en el plan (lo que sobra es su remanente).'],
      ['Resumen', 'Stock ingresado', 'Metros de todas las bobinas cargadas de esa sección.'],
      ['Resumen', 'Requerido', 'Metros que piden todos los circuitos de esa sección (lista de cables con las correcciones cargadas).'],
      ['Resumen', 'Tendido', 'Metros ya tendidos (registrados con Tender), con los metros reales.'],
      ['Resumen', 'Saldo actual en bobinas', 'Metros que quedan físicamente en las bobinas: stock ingresado menos tendido.'],
      ['Resumen', 'Listo para cortar', 'Metros asignados a cortes de circuitos con zanja abierta: lo que se puede tender ahora.'],
      ['Resumen', 'Provisorio', 'Metros asignados a circuitos cuya zanja todavía no está abierta. Puede cambiar de bobina al recalcular.'],
      ['Resumen', 'Faltante', 'Metros que no entran en ninguna bobina cargada: hay que pedir o cargar más bobinas.'],
      ['Resumen', 'Balance stock − requerido', 'Si es positivo sobra cable en total; si es negativo falta.'],
      ['Resumen', 'Bobinas que el plan no usa', 'Bobinas que, con el plan actual, no hacen falta para terminar la obra (no es lo mismo que "sin abrir").'],
      ['Resumen', 'Remanente útil previsto', 'Suma de lo que quedará en las bobinas al terminar, en las que queden con al menos el remanente mínimo útil.'],
      ['Resumen', 'Descarte previsto', 'Suma de las puntas de 1 m o más que quedarán por debajo del remanente mínimo útil.'],
      ['Bobinas', 'Estado real', 'Sin abrir / En uso / Terminada (ver arriba).'],
      ['Bobinas', 'Tendido real', 'Metros que ya salieron de esa bobina según los tendidos registrados.'],
      ['Bobinas', 'Saldo actual', 'Metros que le quedan hoy a la bobina: entrada menos tendido real.'],
      ['Bobinas', 'Uso real (%)', 'Tendido real / entrada. Una bobina sin tocar da 0 %.'],
      ['Bobinas', 'Plan: listo para cortar', 'Metros de esa bobina asignados a cortes que ya se pueden hacer (zanja abierta).'],
      ['Bobinas', 'Plan: provisorio', 'Metros de esa bobina reservados para circuitos que esperan zanja.'],
      ['Bobinas', 'Remanente final previsto', 'Lo que quedaría en la bobina si se cumple todo el plan.'],
      ['Bobinas', 'Uso previsto (%)', '(Tendido real + listo + provisorio) / entrada: cuánto se va a usar de la bobina al terminar la obra según el plan.'],
      ['Bobinas', 'Destino previsto', 'Se usa completa (sobra menos de 1 m) / Remanente útil / Descarte (sobra menos que el remanente mínimo útil) / No se usa: cómo quedaría la bobina al terminar la obra.'],
      ['Plan de corte', 'Estado', 'Ejecutado (ya tendido) · Listo para cortar (zanja abierta) · Provisorio (espera zanja) · SIN BOBINA (falta cable).'],
      ['Plan de corte', 'Saldo tras corte', 'Metros que quedan en la bobina después de ese corte, siguiendo el orden de la lista.'],
      ['Circuitos', 'Bobinas', 'Bobina de cada fase; ✓ = ya tendida.'],
      ['Zanjas', 'Cable tendido / PAT tendida', 'Conductores registrados sobre el total, y si la PAT de esa zanja ya se registró.'],
      ['Propuesta', 'Lote', 'Grupo de zanjas vecinas sugerido para abrir junto; en orden. Indica qué bobinas empieza y cuáles termina.']];
    XLSX.utils.book_append_sheet(wb, sheet(ex, [14, 28, 110]), 'Explicación');
    return XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  }


  const r1 = (v) => Math.round((v || 0) * 10) / 10;
  function exportTendidos(state, R, dias, H) {
    const wb = XLSX.utils.book_new();
    const ds = [...dias.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
    const res = [['Fecha', 'BT (m)', 'MT (m)', 'PAT (m)', 'Total (m)', 'Circuitos', 'Conductores', 'Puntas colocadas', 'Zanjas cerradas', 'Bobinas usadas']];
    ds.forEach((D) => res.push([D.fecha, r1(D.m.BT), r1(D.m.MT), r1(D.m.PAT), r1(D.total), [...D.circ.values()].filter((o) => o.c.cat !== 'PAT').length, D.nCond, D.nPuntas, D.zanjas.length, [...D.bobinas].join(', ')]));
    if (ds.length) res.push(['Total', r1(ds.reduce((a, D) => a + D.m.BT, 0)), r1(ds.reduce((a, D) => a + D.m.MT, 0)), r1(ds.reduce((a, D) => a + D.m.PAT, 0)), r1(ds.reduce((a, D) => a + D.total, 0)), '', ds.reduce((a, D) => a + D.nCond, 0), ds.reduce((a, D) => a + D.nPuntas, 0), ds.reduce((a, D) => a + D.zanjas.length, 0), '']);
    XLSX.utils.book_append_sheet(wb, sheet(res, [12, 10, 10, 10, 11, 10, 11, 15, 14, 40]), 'Por día');
    const sec = new Set(); ds.forEach((D) => D.sec.forEach((v, k) => sec.add(k)));
    const ks = [...sec].sort();
    const ps = [['Fecha', ...ks.map((k) => k.replace('|', ' ') + ' mm² (m)')]];
    ds.forEach((D) => ps.push([D.fecha, ...ks.map((k) => r1(D.sec.get(k) || 0))]));
    XLSX.utils.book_append_sheet(wb, sheet(ps, [12, ...ks.map(() => 16)]), 'Por sección');
    const det = [['Fecha', 'Tipo', 'Circuito', 'Desde (inversor / origen)', 'Hasta', 'Sección (mm²)', 'Conductores tendidos', 'De', 'Metros reales', 'Metros lista', 'Diferencia (m)', 'Bobinas']];
    ds.forEach((D) => [...D.circ.values()].forEach((o) => { const c = o.c; det.push([D.fecha, c.cat, c.cat === 'PAT' ? 'PAT ' + c.seccion : c.designacion, c.desde, c.hasta, c.seccion, o.fases.length, c.fz.length, r1(o.m), r1(o.teo), r1(o.m - o.teo), [...o.bob].join(', ')]); }));
    XLSX.utils.book_append_sheet(wb, sheet(det, [12, 6, 14, 26, 26, 12, 12, 5, 12, 11, 12, 22]), 'Circuitos por día');
    const pu = [['Fecha', 'Tipo', 'Circuito', 'Recorrido', 'Extremo', 'Puntas']];
    ds.forEach((D) => D.puntas.forEach((x) => pu.push([D.fecha, x.c.cat, x.c.designacion, `${x.c.desde} → ${x.c.hasta}`, H.ladoNom(x.c, x.k), x.n])));
    XLSX.utils.book_append_sheet(wb, sheet(pu, [12, 6, 14, 40, 26, 8]), 'Puntas por día');
    const zj = [['Fecha de cierre', 'Zanja', 'Largo (m)', 'Circuitos']];
    ds.forEach((D) => D.zanjas.forEach((z) => zj.push([D.fecha, z.titulo, r1(z.largo), z.miembros.map((c) => c.designacion).join(', ')])));
    XLSX.utils.book_append_sheet(wb, sheet(zj, [14, 34, 10, 40]), 'Zanjas cerradas');
    return XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  }
  function exportPuntas(state, R, H) {
    const wb = XLSX.utils.book_new();
    const cs = R.circuitos.filter((c) => c.cat !== 'PAT' && c.cat !== 'LA');
    const ks = [...new Set(cs.map((c) => `${c.cat}|${c.seccion}`))].sort();
    const res = [['Tipo', 'Sección (mm²)', 'Circuitos', 'Conductores', 'Puntas totales', 'Colocadas', 'Pendientes', '% colocadas']];
    ks.forEach((k) => { const [cat, s2] = k.split('|'); const g = cs.filter((c) => `${c.cat}|${c.seccion}` === k).map(H.puntasDe); const t = g.reduce((a, x) => a + x.tot, 0), cc = g.reduce((a, x) => a + x.col, 0); res.push([cat, Number(s2), g.length, g.reduce((a, x) => a + x.n, 0), t, cc, t - cc, t ? Math.round((cc / t) * 1000) / 10 : 0]); });
    XLSX.utils.book_append_sheet(wb, sheet(res, [6, 12, 10, 12, 14, 11, 11, 12]), 'Resumen');
    const det = [['Tipo', 'Tramo / STS', 'Circuito', 'Desde', 'Hasta', 'Sección (mm²)', 'Conductores', 'Extremo origen', 'Colocadas origen', 'Fecha origen', 'Extremo destino', 'Colocadas destino', 'Fecha destino', 'Total colocadas', 'De', 'Observaciones']];
    cs.forEach((c) => { const p = H.puntasDe(c); det.push([c.cat, H.tramo(c), c.designacion, c.desde, c.hasta, c.seccion, p.n, H.ladoNom(c, 'o'), p.o, (p.po && p.o && p.po.fecha) || '', H.ladoNom(c, 'd'), p.d, (p.pd && p.d && p.pd.fecha) || '', p.col, p.tot, [p.po && p.po.obs, p.pd && p.pd.obs].filter(Boolean).join(' · ')]); });
    XLSX.utils.book_append_sheet(wb, sheet(det, [6, 26, 14, 26, 26, 12, 11, 24, 15, 12, 24, 15, 12, 14, 5, 30]), 'Por circuito');
    return XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  }

  // Stock de bobinas consolidado: por tipo y sección + detalle por bobina
  function exportStock(state, R, F) {
    const wb = XLSX.utils.book_new(), r1 = (x) => Math.round(x * 10) / 10;
    const filas = F.stockConsolidado();
    const h1 = [['Tipo', 'Sección (mm²)', 'Bobinas', 'Sin abrir', 'En uso', 'Terminadas', 'Entrada (m)', 'Tendido (m)', 'Saldo actual (m)', 'Saldo sin abrir (m)', 'Saldo en uso (m)', 'Plan pendiente (m)', 'Saldo libre (m)', 'Remanente útil previsto (m)', 'Descarte previsto (m)', 'Falta cable (m)', 'Uso %']];
    filas.forEach((f) => h1.push([f.cat, f.seccion, f.n, f.sinAbrir, f.enUso, f.term, r1(f.entrada), r1(f.tendido), r1(f.saldo), r1(f.saldoSA), r1(f.saldoUso), r1(f.plan), r1(f.saldo - f.plan), r1(f.remUtil), r1(f.descarte), r1(f.falta), f.entrada ? r1((f.tendido / f.entrada) * 100) : 0]));
    const T = (k) => filas.reduce((a, f) => a + f[k], 0);
    h1.push(['TOTAL', '', T('n'), T('sinAbrir'), T('enUso'), T('term'), '', '', '', '', '', '', '', '', '', '', '']);
    XLSX.utils.book_append_sheet(wb, sheet(h1, [7, 12, 9, 10, 9, 11, 12, 12, 15, 17, 15, 16, 14, 22, 18, 14, 8]), 'Consolidado');
    const h2 = [['Tipo', 'Código', 'N° fabricante', 'Sección (mm²)', 'Remito', 'Fecha ingreso', 'Entrada (m)', 'Tendido (m)', 'Saldo actual (m)', 'Uso %', 'Estado', 'Plan pendiente (m)', 'Remanente previsto (m)', 'Al final', 'Observaciones']];
    R.bobinas.slice().sort((a, b) => a.cat.localeCompare(b.cat) || (a.seccion - b.seccion) || String(a.codigo).localeCompare(String(b.codigo), 'es', { numeric: true })).forEach((b) => {
      const o = state.bobinas.find((x) => x.id === b.id) || {};
      h2.push([b.cat, b.codigo, b.nro, b.seccion, o.remito || '', o.fecha || '', b.entrada, r1(b.consumoReal), r1(b.saldoActual), r1(b.usoReal * 100), b.estadoReal, r1(b.asigListo + b.asigProv), r1(b.remanente), b.estado, o.obs || '']);
    });
    XLSX.utils.book_append_sheet(wb, sheet(h2, [6, 10, 16, 12, 12, 12, 11, 11, 14, 8, 11, 16, 20, 16, 30]), 'Detalle por bobina');
    // discriminado por zanja y por circuito
    const Z = F.stockPorZanja();
    const h3 = [['Zanja', 'Tipo zanja', 'Estado zanja', 'Largo zanja (m)', 'Circuitos', 'Bobinas', 'Cable por sección (m)', 'Tendido (m)', 'Listo p/ cortar (m)', 'Provisorio (m)', 'Total (m)']];
    Z.forEach((z) => h3.push([z.zt, z.zcat, z.ze, r1(z.largo || 0), [...z.circ].join(', '), [...z.bob].join(', '), Object.entries(z.porCab).map(([k, v]) => `${k}: ${r1(v)}`).join(' · '), r1(z.m.ejecutado), r1(z.m.listo), r1(z.m.provisorio), r1(z.m.ejecutado + z.m.listo + z.m.provisorio)]));
    XLSX.utils.book_append_sheet(wb, sheet(h3, [26, 10, 12, 13, 40, 30, 40, 12, 16, 13, 11]), 'Por zanja');
    const D = F.cortesDetalle();
    const h4 = [['Zanja', 'Tipo zanja', 'Estado zanja', 'Circuito', 'Desde', 'Hasta', 'Tipo cable', 'Sección (mm²)', 'Fase', 'Bobina', 'N° fabricante', 'Corte #', 'Metros', 'Estado', 'Fecha tendido', 'Saldo bobina luego (m)']];
    D.forEach((r) => h4.push([r.zt, r.zcat, r.ze, r.c.designacion, r.c.desde, r.c.hasta, r.p.cat, r.p.seccion, r.p.fase === 'C' ? '' : r.p.fase, r.b.codigo, r.b.nro, r.p.corte, r1(r.p.len), F.EST_CORTE[r.p.estado] || r.p.estado, r.p.fecha || '', r1(r.p.saldo)]));
    XLSX.utils.book_append_sheet(wb, sheet(h4, [26, 10, 12, 18, 22, 22, 9, 12, 6, 9, 14, 8, 10, 15, 12, 18]), 'Por circuito y bobina');
    const gc = new Map();
    D.forEach((r) => { const k = r.c.id + '|' + r.p.cat; if (!gc.has(k)) gc.set(k, { r, bob: new Set(), m: { ejecutado: 0, listo: 0, provisorio: 0 } }); const g = gc.get(k); g.bob.add(r.b.codigo); g.m[r.p.estado] += r.p.len; });
    const h5 = [['Circuito', 'Desde', 'Hasta', 'Zanja', 'Estado zanja', 'Tipo cable', 'Sección (mm²)', 'Bobinas', 'Tendido (m)', 'Listo p/ cortar (m)', 'Provisorio (m)', 'Total (m)']];
    gc.forEach(({ r, bob, m }) => h5.push([r.c.designacion, r.c.desde, r.c.hasta, r.zt, r.ze, r.p.cat, r.p.seccion, [...bob].join(', '), r1(m.ejecutado), r1(m.listo), r1(m.provisorio), r1(m.ejecutado + m.listo + m.provisorio)]));
    XLSX.utils.book_append_sheet(wb, sheet(h5, [26, 22, 22, 26, 12, 9, 12, 20, 12, 16, 13, 11]), 'Resumen por circuito');
    return XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  }

  function exportHincado(state, I, F) {
    const wb = XLSX.utils.book_new(), H = state.hincado;
    const cods = Object.keys(I.req).sort();
    const r1 = [['Código', 'Tipo', 'Suelo', 'Perfil', 'Largo (mm)', 'Color', 'Requeridas', 'Recibidas OK', 'A revisar', 'Hincadas', 'Stock en obra', 'Faltan recibir']];
    cods.forEach((c) => { const k = F.hcat(c) || {}, rq = I.req[c] || 0, rc = I.rec[c] || 0, hh = I.hecho[c] || 0; r1.push([c, k.tipo, k.suelo === 'B' ? 'Blando' : 'Normal', k.perfil, k.largo, k.color, rq, rc, I.recDud[c] || 0, hh, rc - hh, Math.max(0, rq - rc)]); });
    XLSX.utils.book_append_sheet(wb, sheet(r1, [22, 16, 8, 10, 10, 10, 11, 12, 10, 10, 12, 12]), 'Resumen por código');
    const maxN = Math.max(0, ...I.trk.map((t) => F.posDe(t).length));
    const r2 = [['Tracker', 'Sector', 'Tipo', 'Zona', 'Suelo', 'Configuración', 'Hincado', 'Fecha', ...Array.from({ length: maxN }, (_, i) => `Pos ${i + 1}`), ...Array.from({ length: maxN }, (_, i) => `Color ${i + 1}`)]];
    I.trk.forEach((t) => { const ps = F.posDe(t), av = H.avance[t.id]; r2.push([t.id, t.s, t.t, t.z, t.sl === 'B' ? 'Blando' : 'Normal', F.cfgTxt(F.cfgDe(t)), av ? 'sí' : '', av ? av.f : '', ...Array.from({ length: maxN }, (_, i) => ps[i] || ''), ...Array.from({ length: maxN }, (_, i) => (F.hcat(ps[i]) || {}).color || '')]); });
    XLSX.utils.book_append_sheet(wb, sheet(r2, [10, 7, 7, 8, 8, 26, 8, 11, ...Array.from({ length: maxN * 2 }, () => 18)]), 'Por tracker');
    const r3 = [['Fecha', 'Remito', 'Código', 'Color observado', 'Color según manual', 'Largo medido', 'Perfil medido', 'Cantidad', 'Verificación', 'Detalle', 'Observación']];
    H.recep.forEach((r) => { const v = F.verificar(r), k = F.hcat(r.codigo) || {}; r3.push([r.fecha, r.remito, r.codigo, r.color, k.color, r.largo || '', r.perfil || '', r.cant, v.ok ? 'coincide' : 'NO coincide', v.msgs.join(' · ') + (v.sug.length ? ' · coincide con ' + v.sug.join(', ') : ''), r.obs || '']); });
    XLSX.utils.book_append_sheet(wb, sheet(r3, [11, 12, 22, 14, 14, 12, 12, 9, 13, 60, 30]), 'Recepciones');
    const r4 = [['Código', 'Tipo', 'Suelo', 'Perfil', 'Largo total', 'Sobre terreno', 'NRL', 'MRL', 'Color de punta']];
    H.catalogo.forEach((k) => r4.push([k.codigo, k.tipo, k.suelo === 'B' ? 'Blando' : 'Normal', k.perfil, k.largo, k.sobre, k.nrl, k.mrl, k.color]));
    XLSX.utils.book_append_sheet(wb, sheet(r4, [22, 16, 8, 10, 10, 12, 8, 8, 14]), 'Catálogo Trina');
    return XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  }
  function exportFund(state, ETAPAS, STSL, fundInfo) {
    const wb = XLSX.utils.book_new();
    const F = state.fundaciones || {};
    const res = [['STS', 'Etapas terminadas', 'De', '% avance', 'En curso', 'Inicio de obra', 'Base terminada', 'Próxima etapa']];
    STSL.forEach((s) => { const i = fundInfo(s); res.push([s, i.done, i.n, Math.round(i.p * 1000) / 10, i.curso.map(([, n]) => n).join(', '), i.ini, i.fin, i.done === i.n ? '' : i.sig[1]]); });
    XLSX.utils.book_append_sheet(wb, sheet(res, [8, 16, 5, 10, 40, 14, 14, 40]), 'Resumen');
    const mx = [['#', 'Etapa', ...STSL.flatMap((s) => [s + ' estado', s + ' inicio', s + ' fin'])]];
    ETAPAS.forEach(([k, n], i) => mx.push([i + 1, n, ...STSL.flatMap((s) => { const v = (F[s] || {})[k] || {}; return [v.ok ? 'terminada' : v.ini ? 'en curso' : 'pendiente', v.ini || '', v.ok ? v.fin || '' : '']; })]));
    XLSX.utils.book_append_sheet(wb, sheet(mx, [4, 42, ...STSL.flatMap(() => [11, 11, 11])]), 'Por etapa');
    const ac = [['Fecha de inicio', 'STS', 'N°', 'Etapa', 'Estado', 'Fecha de fin', 'Observación']];
    const rows = [];
    STSL.forEach((s) => ETAPAS.forEach(([k, n], i) => { const v = (F[s] || {})[k]; if (v && (v.ini || v.ok)) rows.push([v.ini || '', s, i + 1, n, v.ok ? 'terminada' : 'en curso', v.ok ? v.fin || '' : '', v.obs || '']); }));
    rows.sort((a, b) => String(a[0]).localeCompare(String(b[0])) || a[1].localeCompare(b[1]) || a[2] - b[2]);
    XLSX.utils.book_append_sheet(wb, sheet(ac.concat(rows), [14, 8, 4, 42, 11, 13, 30]), 'Actividades');
    return XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  }

  function exportCrono(C, meta) {
    const wb = XLSX.utils.book_new(); const P = C.P;
    const r1v = (v) => Math.round(v * 10) / 10;
    const res = [['Cronograma', meta.nombre || ''], ['Archivo', meta.fuente || ''], ['Fecha del informe', C.hoy], ['Inicio', P.inicio], ['Fin actual', P.fin], ['Fin línea base', P.bFin || ''], ['Avance real (%)', r1v(P.pct)], ['Avance esperado hoy (%)', r1v(P.esp)], ['Desvío (pp)', r1v(P.pct - P.esp)]];
    XLSX.utils.book_append_sheet(wb, sheet(res, [24, 50]), 'Resumen');
    const rows = [['WBS', 'Nivel', 'Actividad', 'Tipo', 'Inicio', 'Fin', 'Duración (días)', 'Inicio importado', 'Fin importado', 'Inicio línea base', 'Fin línea base', 'Desvío fin vs base (días)', '% real', '% esperado hoy', 'Estado', 'Ruta crítica', 'Modificado', 'Nota']];
    C.T.forEach((t) => rows.push([t.wbs, t.nivel, '   '.repeat(t.nivel - 1) + t.nombre, t.esResumen ? 'Etapa' : t.hito ? 'Hito' : 'Actividad', t.inicio, t.fin, t.hito ? 0 : Math.round((new Date(t.fin) - new Date(t.inicio)) / 864e5) + 1, t.oInicio || '', t.oFin || '', t.bInicio || '', t.bFin || '', t.desvio || 0, r1v(t.pct), r1v(t.esp), t.estado, t.critica ? 'sí' : '', t.mod ? t.mod.slice(0, 10) : '', t.nota || '']));
    XLSX.utils.book_append_sheet(wb, sheet(rows, [9, 6, 60, 10, 11, 11, 10, 12, 12, 12, 12, 12, 8, 10, 11, 8, 11, 30]), 'Actividades');
    return XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  }
  window.IO = { readWorkbook, exportPlan, exportTendidos, exportPuntas, exportStock, exportFund, exportHincado, exportCrono, num };
})();
