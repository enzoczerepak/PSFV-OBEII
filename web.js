/* Visor web: ingreso con usuario y contraseña, descifrado de datos.json en el navegador y modo solo lectura */
window.READONLY = true;
(function () {
  const $ = (s) => document.querySelector(s);
  const enc = new TextEncoder();
  const KEY = 'plancables-sesion';
  const b64d = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const b64e = (u8) => btoa(String.fromCharCode(...new Uint8Array(u8)));
  const store = { get() { try { return JSON.parse(localStorage.getItem(KEY) || sessionStorage.getItem(KEY) || 'null'); } catch (_) { return null; } },
    set(v, rec) { try { (rec ? localStorage : sessionStorage).setItem(KEY, JSON.stringify(v)); } catch (_) { /* sin almacenamiento */ } },
    clear() { try { localStorage.removeItem(KEY); sessionStorage.removeItem(KEY); } catch (_) { /* nada */ } } };
  async function idU(u) { const h = await crypto.subtle.digest('SHA-256', enc.encode('plan-cables:' + u.trim().toLowerCase())); return [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, '0')).join(''); }
  async function derivar(pass, salt, iter) {
    const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveBits']);
    return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: b64d(salt), iterations: iter }, base, 256));
  }
  async function bajar() {
    const r = await fetch('datos.json?t=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error(r.status === 404 ? 'Todavía no hay datos publicados' : 'No se pudieron descargar los datos');
    return r.json();
  }
  async function abrir(d, id, kekRaw) {
    const u = (d.usuarios || []).find((x) => x.id === id);
    if (!u) throw new Error('usuario');
    const kek = await crypto.subtle.importKey('raw', kekRaw, 'AES-GCM', false, ['decrypt']);
    let raw;
    try { raw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(u.iv) }, kek, b64d(u.key)); } catch (_) { throw new Error('clave'); }
    const dk = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
    const gz = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(d.iv) }, dk, b64d(d.datos));
    const txt = await new Response(new Blob([gz]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
    return txt;
  }
  let sesion = null, ultimo = null, resolver = null;
  const cargado = new Promise((r) => { resolver = r; });
  function marca(d) {
    ultimo = d.actualizado;
    const t = new Date(d.actualizado);
    const el = $('#saveState'); if (el) { el.textContent = 'Datos al ' + t.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); el.classList.remove('dirty'); }
  }
  function saludo(nombre) {
    const h = new Date().getHours(), sal = h < 6 ? 'Buenas noches' : h < 13 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
    const n = String(nombre || '').trim().split(/[\s._-]+/).filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    const fecha = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const g = document.createElement('div'); g.id = 'greet';
    g.innerHTML = `<div class="gb"><div class="gi">👋</div><div><b>${sal}${n ? ', ' + n.replace(/[<>&"]/g, '') : ''}</b><span>${fecha.charAt(0).toUpperCase() + fecha.slice(1)}</span><small>Bienvenido/a al visor de avance de obra · PSFV-OBEII</small></div></div>`;
    document.body.appendChild(g);
    requestAnimationFrame(() => g.classList.add('show'));
    const fuera = () => { g.classList.remove('show'); setTimeout(() => g.remove(), 500); };
    g.onclick = fuera; setTimeout(fuera, 3800);
  }
  async function entrar(id, kekRaw, d, nombre) {
    const txt = await abrir(d, id, kekRaw);
    document.getElementById('login').classList.add('ok');
    setTimeout(() => { const l = document.getElementById('login'); if (l) l.style.display = 'none'; }, 400);
    resolver({ text: txt, path: null });
    setTimeout(() => saludo(nombre), 450);
    setTimeout(() => {
      marca(d);
      const f = document.querySelector('.side-foot');
      if (f && !document.getElementById('salir')) { const b = document.createElement('button'); b.id = 'salir'; b.textContent = 'Salir'; b.onclick = () => window.api.salir(); f.appendChild(b); }
    }, 50);
    // actualización automática
    setInterval(async () => {
      try {
        const n = await bajar(); if (n.actualizado === ultimo) return;
        const t = await abrir(n, id, kekRaw); marca(n);
        if (window.__app && window.__app.recargar) window.__app.recargar(t);
      } catch (_) { /* reintenta en el próximo ciclo */ }
    }, 60000);
  }
  async function auto() {
    const s = store.get(); if (!s) return false;
    try { const d = await bajar(); await entrar(s.id, b64d(s.k), d, s.n); return true; } catch (_) { store.clear(); return false; }
  }
  document.addEventListener('DOMContentLoaded', async () => {
    const f = $('#lgForm'), err = $('#lgE'), btn = $('#lgB');
    if (await auto()) return;
    $('#login').classList.add('show');
    f.onsubmit = async (e) => {
      e.preventDefault(); err.textContent = ''; btn.disabled = true; btn.textContent = 'Verificando…';
      try {
        const d = await bajar();
        const id = await idU($('#lgU').value);
        const u = (d.usuarios || []).find((x) => x.id === id);
        if (!u) throw new Error('usuario');
        const k = await derivar($('#lgP').value, u.salt, u.iter);
        await entrar(id, k, d, $('#lgU').value);
        store.set({ id, k: b64e(k), n: $('#lgU').value.trim() }, $('#lgR').checked);
      } catch (ex) {
        err.textContent = ex.message === 'usuario' || ex.message === 'clave' ? 'Usuario o contraseña incorrectos' : ex.message;
        btn.disabled = false; btn.textContent = 'Ingresar';
      }
    };
  });
  const no = async () => null;
  window.api = {
    load: () => cargado, seed: async () => (await cargado).text, save: async () => true, open: no, saveAs: no, pickExcel: no,
    saveBinary: async (data, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data])); a.download = name; document.body.appendChild(a); a.click(); a.remove(); return null; },
    printPDF: async () => { window.print(); return null; }, openPath: no, showItem: no,
    info: async () => ({ version: 'visor web', userData: '' }), onOpenFile: () => {},
    netCfg: async () => ({ modo: 'local', ips: [], puerto: 0 }), netSetCfg: async () => ({ modo: 'local', ips: [] }), netClientes: async () => [], netSync: async () => ({ ok: false }),
    onNetReq: () => {}, netReply: () => {}, netServidores: async () => [], netObra: async () => true,
    salir: () => { store.clear(); location.reload(); },
  };
})();
