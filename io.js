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

  function parseBobinas(rows) {
    const h = findHeader(rows, ['BOBINA', 'SECCION'], [
      ['fecha', ['FECHA']], ['remito', ['REMITO']], ['codigo', ['CODIGO', 'INTERNO']],
      ['nro', ['N DE BOBINA', 'N° DE BOBINA', 'NRO', 'NUMERO', 'BOBINA'], ['CODIGO', 'INTERNO']],
      ['seccion', ['SECCION']], ['entrada', ['ENTRADA', 'CANTIDAD', 'METROS'], ['SALIDA']], ['obs', ['OBSERV']],
    ]);
    if (!h) return null;
    const out = [];
    for (let i = h.row + 1; i < rows.length; i++) {
      const r = rows[i], g = (k) => (h.cols[k] != null ? r[h.cols[k]] : null);
      const entrada = num(g('entrada'));
      if (!g('nro') || !entrada) continue;
      out.push({ fecha: fecha(g('fecha')), remito: g('remito') != null ? String(g('remito')) : '', nro: String(g('nro')).trim(),
        seccion: String(g('seccion') || '').trim(), entrada, codigo: g('codigo') ? String(g('codigo')).trim() : '', obs: g('obs') ? String(g('obs')) : '' });
    }
    return out;
  }

  function parseCircuitos(rows) {
    const h = findHeader(rows, ['DESIGNACI', 'DESDE'], [
      ['designacion', ['DESIGNACI']], ['desde', ['DESDE']], ['hasta', ['HASTA']], ['formacion', ['FORMACI']],
      ['fases', ['FASES']], ['cantidad', ['CANTIDAD', 'CAMTIDAD']], ['lineal', ['LINEAL']],
    ]);
    if (!h) return null;
    const out = [];
    for (let i = h.row + 1; i < rows.length; i++) {
      const r = rows[i], g = (k) => (h.cols[k] != null ? r[h.cols[k]] : null);
      const cant = num(g('cantidad'));
      if (!g('designacion') || !cant || !g('formacion')) continue;
      out.push({ designacion: String(g('designacion')).trim(), desde: String(g('desde') || '').trim(), hasta: String(g('hasta') || '').trim(),
        formacion: String(g('formacion')).trim(), fases: num(g('fases')) || 3, cantidad: cant, lineal: num(g('lineal')) });
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
    const CN = { BT: 'BT 0,8 kV', MT: 'MT 33 kV', PAT: 'PAT Cu desnudo' };

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
      const bs = c.fz.map((f) => { const p = c.fasesInfo[f]; return p ? (f === 'C' ? '' : f + ' ') + (p.bobina || 'FALTA') + (p.estado === 'ejecutado' ? ' ✓' : '') : ''; }).join(' | ');
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

  window.IO = { readWorkbook, exportPlan, num };
})();
