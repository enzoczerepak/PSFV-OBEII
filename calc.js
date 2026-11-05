/* Reloj y calculadora embebida (programa y visor web). Sin eval: parser propio. */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const fmtN = (n) => (isFinite(n) ? Number(n.toPrecision(12)).toLocaleString('es-AR', { maximumFractionDigits: 10 }) : 'Error');
  // ---------- reloj ----------
  function reloj() {
    const el = $('#clock'); if (!el) return;
    const d = new Date();
    const f = d.toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }).replace('.', '');
    const h = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    el.innerHTML = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg><span class="cf">${f.charAt(0).toUpperCase() + f.slice(1)}</span><b>${h}</b>`;
  }
  // ---------- calculadora ----------
  let expr = '', ultimo = null, abierta = false;
  function evaluar(s) {
    const t = s.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/\./g, '').replace(/,/g, '.');
    let i = 0;
    const num = () => { let m = t.slice(i).match(/^\d*\.?\d+(e[+-]?\d+)?%?|^\d+\.?%?/i); if (!m) throw 0; i += m[0].length; let v = parseFloat(m[0]); if (m[0].endsWith('%')) v /= 100; return v; };
    const fac = () => { if (t[i] === '-') { i++; return -fac(); } if (t[i] === '+') { i++; return fac(); } if (t[i] === '(') { i++; const v = sum(); if (t[i] === ')') i++; return v; } return num(); };
    const prod = () => { let v = fac(); while (t[i] === '*' || t[i] === '/') { const o = t[i++]; const w = fac(); v = o === '*' ? v * w : v / w; } return v; };
    const sum = () => { let v = prod(); while (t[i] === '+' || t[i] === '-') { const o = t[i++]; const j = i; let w = prod(); if (/^\d*\.?\d+%$/.test(t.slice(j, i))) w = v * w; v = o === '+' ? v + w : v - w; } return v; };
    const v = sum(); if (i < t.length) throw 0; return v;
  }
  const pantalla = () => {
    const p = $('#calcP'); if (!p) return;
    let prev = ''; try { if (expr && /[+\-−×÷*/%]/.test(expr.slice(1))) prev = '= ' + fmtN(evaluar(expr)); } catch (_) { prev = ''; }
    $('.kexp', p).textContent = expr || (ultimo != null ? '' : '0');
    $('.kres', p).textContent = expr ? prev : ultimo != null ? fmtN(ultimo) : '';
  };
  function tecla(k) {
    const ops = '+−×÷';
    if (k === 'C') { expr = ''; ultimo = null; }
    else if (k === '⌫') expr = expr.slice(0, -1);
    else if (k === '=') { if (!expr) return; try { ultimo = evaluar(expr); hist(expr, ultimo); expr = ''; } catch (_) { $('#calcP .kres').textContent = 'Expresión incompleta'; return; } }
    else if (k === '±') { const m = expr.match(/(-?)([\d.,]+%?)$/); if (m) expr = expr.slice(0, -m[0].length) + (m[1] ? '' : '-') + m[2]; else if (ultimo != null && !expr) { ultimo = -ultimo; } }
    else if (ops.includes(k)) { if (!expr && ultimo != null) expr = fmtN(ultimo).replace(/\./g, ''); if (!expr && k !== '−') return; if (ops.includes(expr.slice(-1))) expr = expr.slice(0, -1); expr += k; }
    else if (k === ',') { const m = expr.match(/[\d,]*$/)[0]; if (m.includes(',')) return; expr += m ? ',' : '0,'; }
    else if (k === '%') { if (/\d$/.test(expr)) expr += '%'; }
    else if (k === '(' || k === ')') expr += k;
    else { if (!expr && ultimo != null) ultimo = null; expr += k; }
    pantalla();
  }
  function hist(e, v) { const h = $('#calcH'); if (!h) return; const d = document.createElement('div'); d.innerHTML = `<span>${e}</span><b>${fmtN(v)}</b>`; d.onclick = () => { expr = fmtN(v).replace(/\./g, ''); pantalla(); }; h.prepend(d); while (h.children.length > 6) h.lastChild.remove(); }
  function crear() {
    const p = document.createElement('div'); p.id = 'calcP'; p.className = 'hidden';
    const K = ['C', '⌫', '%', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '±', '0', ',', '='];
    p.innerHTML = `<div class="kh"><b>Calculadora</b><span class="muted">F2</span><button class="kcp" title="Copiar resultado">⧉</button><button class="kcl" title="Cerrar (Esc)">✕</button></div>
      <div class="kdsp"><div class="kexp">0</div><div class="kres"></div></div><div class="kkeys">${K.map((k) => `<button data-k="${k}" class="${'+−×÷'.includes(k) ? 'op' : k === '=' ? 'eq' : k === 'C' || k === '⌫' || k === '%' ? 'fn' : ''}">${k}</button>`).join('')}</div><div id="calcH"></div>`;
    document.body.appendChild(p);
    p.addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (b) tecla(b.dataset.k); });
    $('.kcl', p).onclick = () => toggle(false);
    $('.kcp', p).onclick = async () => { const v = expr ? (() => { try { return evaluar(expr); } catch (_) { return null; } })() : ultimo; if (v == null) return; try { await navigator.clipboard.writeText(fmtN(v)); $('.kcp', p).textContent = '✓'; setTimeout(() => { $('.kcp', p).textContent = '⧉'; }, 900); } catch (_) { /* sin portapapeles */ } };
    // arrastrar
    let dx = 0, dy = 0, drag = false;
    $('.kh', p).addEventListener('mousedown', (e) => { if (e.target.closest('button')) return; drag = true; const r = p.getBoundingClientRect(); dx = e.clientX - r.left; dy = e.clientY - r.top; e.preventDefault(); });
    document.addEventListener('mousemove', (e) => { if (!drag) return; p.style.left = Math.max(0, Math.min(window.innerWidth - p.offsetWidth, e.clientX - dx)) + 'px'; p.style.top = Math.max(0, Math.min(window.innerHeight - 60, e.clientY - dy)) + 'px'; p.style.right = 'auto'; p.style.bottom = 'auto'; });
    document.addEventListener('mouseup', () => { drag = false; });
    return p;
  }
  function toggle(v) {
    const p = $('#calcP') || crear();
    abierta = v == null ? !abierta : v; p.classList.toggle('hidden', !abierta);
    const b = $('#calcBtn'); if (b) b.classList.toggle('on', abierta);
    if (abierta) pantalla();
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'F2') { e.preventDefault(); toggle(); return; }
    if (!abierta) return;
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag) || !document.getElementById('modal').classList.contains('hidden')) return;
    const map = { '*': '×', x: '×', '/': '÷', '-': '−', '+': '+', Enter: '=', '=': '=', Backspace: '⌫', Delete: 'C', '.': ',', ',': ',', '%': '%', '(': '(', ')': ')' };
    if (e.key === 'Escape') { toggle(false); return; }
    if (/^\d$/.test(e.key)) { tecla(e.key); e.preventDefault(); } else if (map[e.key]) { tecla(map[e.key]); e.preventDefault(); }
  });
  document.addEventListener('DOMContentLoaded', () => {
    reloj(); setInterval(reloj, 1000);
    const b = $('#calcBtn'); if (b) b.onclick = () => toggle();
  });
  window.Calc = { toggle, evaluar };
})();
