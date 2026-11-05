/* Gráficos SVG livianos: barras horizontales apiladas, línea temporal y anillo. Tooltip común por data-tip. */
(function () {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n, d = 0) => Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d });

  // Barras horizontales apiladas (100 % = total de cada fila)
  // rows: [{label, parts:[{v, color, name}], right}], opts: {labelW}
  function hbars(rows, opts = {}) {
    const W = 640, lw = opts.labelW || 110, rw = opts.rightW || 150, bh = 18, gap = 14, top = 4;
    const H = top + rows.length * (bh + gap);
    const bw = W - lw - rw;
    let s = `<svg class="ch" viewBox="0 0 ${W} ${H}" role="img">`;
    rows.forEach((r, i) => {
      const y = top + i * (bh + gap), tot = r.parts.reduce((a, p) => a + p.v, 0) || 1;
      s += `<text x="0" y="${y + bh / 2 + 4}" class="lbl">${esc(r.label)}</text>`;
      s += `<rect x="${lw}" y="${y}" width="${bw}" height="${bh}" rx="4" class="track"/>`;
      let x = lw;
      r.parts.forEach((p) => {
        const w = (p.v / tot) * bw; if (w <= 0.1) return;
        const ww = Math.max(0, w - 2);
        s += `<rect x="${x}" y="${y}" width="${ww}" height="${bh}" rx="3" fill="${p.color}" class="mk grow" style="--w:${ww}px" data-tip="${esc(r.label)} · ${esc(p.name)}: ${fmt(p.v)} ${opts.unit || 'm'} (${fmt((p.v / tot) * 100, 1)} %)"/>`;
        x += w;
      });
      s += `<text x="${W}" y="${y + bh / 2 + 4}" class="val" text-anchor="end">${r.right || ''}</text>`;
    });
    return s + '</svg>';
  }

  // Línea acumulada en % (un eje), series: [{name, color, pts:[{x:Date, y:0..1, tip}]}]
  function line(series, opts = {}) {
    const W = 640, H = 230, L = 40, Rm = 70, T = 10, B = 26;
    const xs = series.flatMap((s) => s.pts.map((p) => +p.x));
    if (!xs.length) return '';
    let x0 = Math.min(...xs), x1 = Math.max(...xs); if (x1 === x0) { x0 -= 864e5; x1 += 864e5; }
    const ymax = Math.max(0.1, Math.min(1, Math.ceil(Math.max(...series.flatMap((s) => s.pts.map((p) => p.y))) * 10 + 0.5) / 10));
    const X = (v) => L + ((v - x0) / (x1 - x0)) * (W - L - Rm), Y = (v) => T + (1 - v / ymax) * (H - T - B);
    let s = `<svg class="ch" viewBox="0 0 ${W} ${H}" role="img">`;
    for (let i = 0; i <= 4; i++) { const v = (ymax * i) / 4, y = Y(v); s += `<line x1="${L}" x2="${W - Rm}" y1="${y}" y2="${y}" class="grid"/><text x="${L - 6}" y="${y + 4}" class="ax" text-anchor="end">${fmt(v * 100)}%</text>`; }
    const nT = Math.min(6, Math.max(2, Math.round((x1 - x0) / 864e5) + 1));
    for (let i = 0; i < nT; i++) { const v = x0 + ((x1 - x0) * i) / (nT - 1); s += `<text x="${X(v)}" y="${H - 6}" class="ax" text-anchor="middle">${new Date(v).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}</text>`; }
    series.forEach((se) => {
      if (!se.pts.length) return;
      const d = se.pts.map((p, i) => `${i ? 'L' : 'M'}${X(+p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ');
      s += `<path d="${d}" fill="none" stroke="${se.color}" stroke-width="2" stroke-linejoin="round" class="draw"/>`;
      se.pts.forEach((p) => { s += `<circle cx="${X(+p.x)}" cy="${Y(p.y)}" r="4" fill="${se.color}" stroke="var(--card)" stroke-width="2" class="mk" data-tip="${esc(p.tip)}"/><circle cx="${X(+p.x)}" cy="${Y(p.y)}" r="11" fill="transparent" data-tip="${esc(p.tip)}"/>`; });
      const last = se.pts[se.pts.length - 1];
      s += `<text x="${X(+last.x) + 8}" y="${Y(last.y) + 4}" class="lbl">${esc(se.name)} ${fmt(last.y * 100, 1)}%</text>`;
    });
    return s + '</svg>';
  }

  // Anillo de porcentaje
  function ring(p, color, label) {
    const C = 2 * Math.PI * 42, off = C * (1 - Math.max(0, Math.min(1, p)));
    return `<svg class="ring2" viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" class="rbg"/><circle cx="50" cy="50" r="42" class="rfg" stroke="${color}" stroke-dasharray="${C}" stroke-dashoffset="${C}" data-off="${off}"/>
      <text x="50" y="54" class="rv">${fmt(p * 100, p < 0.1 && p > 0 ? 1 : 0)}%</text>${label ? `<text x="50" y="70" class="rl">${esc(label)}</text>` : ''}</svg>`;
  }


  // Columnas apiladas por día. days: [{label, sub, parts:[{v,color,name}], tip, sel}]
  function cols(days, opts = {}) {
    const W = 640, H = opts.h || 190, L = 44, R = 6, T = 10, B = 24;
    const max = Math.max(10, ...days.map((d) => d.parts.reduce((a, p) => a + p.v, 0)));
    const nice = (() => { const e = Math.pow(10, Math.floor(Math.log10(max))); return Math.ceil(max / e) * e; })();
    const bw = (W - L - R) / Math.max(1, days.length), Y = (v) => T + (1 - v / nice) * (H - T - B);
    let s = `<svg class="ch" viewBox="0 0 ${W} ${H}" role="img">`;
    for (let i = 0; i <= 4; i++) { const v = (nice * i) / 4, y = Y(v); s += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" class="grid"/><text x="${L - 6}" y="${y + 4}" class="ax" text-anchor="end">${fmt(v)}</text>`; }
    days.forEach((d, i) => {
      const x = L + i * bw + bw * 0.15, w = Math.max(2, bw * 0.7);
      let acc = 0;
      if (d.sel) s += `<rect x="${L + i * bw}" y="${T}" width="${bw}" height="${H - T - B}" class="selcol"/>`;
      d.parts.forEach((p) => { if (!(p.v > 0)) return; const y0 = Y(acc), y1 = Y(acc + p.v); s += `<rect x="${x}" y="${y1}" width="${w}" height="${Math.max(0.5, y0 - y1)}" fill="${p.color}" rx="2" class="mk" data-tip="${esc(d.tip || d.label)} · ${esc(p.name)}: ${fmt(p.v)} m"/>`; acc += p.v; });
      if (d.label && (days.length <= 16 || i % 2 === 0)) s += `<text x="${x + w / 2}" y="${H - 8}" class="ax" text-anchor="middle">${esc(d.label)}</text>`;
      if (d.key) s += `<rect x="${L + i * bw}" y="${T}" width="${bw}" height="${H - T}" fill="transparent" data-dkey="${d.key}" style="cursor:pointer" data-tip="${esc(d.tip || d.label)}: ${fmt(acc)} m"/>`;
    });
    return s + '</svg>';
  }

  function legend(items) { return `<div class="legend">${items.map(([c, n]) => `<span><i style="background:${c}"></i>${esc(n)}</span>`).join('')}</div>`; }

  // tooltip global
  function bindTips(root) {
    let tip = document.getElementById('tip');
    if (!tip) { tip = document.createElement('div'); tip.id = 'tip'; document.body.appendChild(tip); }
    root.querySelectorAll('[data-tip]').forEach((el) => {
      el.addEventListener('mousemove', (e) => { tip.textContent = el.getAttribute('data-tip'); tip.style.opacity = 1; tip.style.left = Math.min(window.innerWidth - tip.offsetWidth - 12, e.clientX + 12) + 'px'; tip.style.top = (e.clientY - 34) + 'px'; });
      el.addEventListener('mouseleave', () => { tip.style.opacity = 0; });
    });
    requestAnimationFrame(() => requestAnimationFrame(() => {
      root.querySelectorAll('.rfg').forEach((c) => { c.style.strokeDashoffset = c.dataset.off; });
      root.querySelectorAll('.grow').forEach((r) => r.classList.add('in'));
    }));
  }

  window.Charts = { hbars, line, ring, legend, bindTips, cols };
})();
