/* Núcleo compartido del sitio web: ingreso, descifrado de datos.json y envío cifrado al buzón del repositorio */
(function () {
  const enc = new TextEncoder();
  const b64d = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
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
    const u = (d.usuarios || []).find((x) => x.id === id); if (!u) throw new Error('usuario');
    const kek = await crypto.subtle.importKey('raw', kekRaw, 'AES-GCM', false, ['decrypt']);
    let raw; try { raw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(u.iv) }, kek, b64d(u.key)); } catch (_) { throw new Error('clave'); }
    const dk = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
    const gz = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(d.iv) }, dk, b64d(d.datos));
    return new Response(new Blob([gz]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  }
  async function login(usuario, pass, d) {
    const id = await idU(usuario), u = (d.usuarios || []).find((x) => x.id === id);
    if (!u) throw new Error('usuario');
    const k = await derivar(pass, u.salt, u.iter);
    const txt = await abrir(d, id, k);
    return { id, k, txt, u };
  }
  // Envía bytes cifrados con la clave del usuario a buzon/ (un commit con la API de Git Data de GitHub)
  async function enviador(d, id, kekRaw) {
    const u = (d.usuarios || []).find((x) => x.id === id); if (!u || !u.tok || !d.repo) return null;
    const kd = await crypto.subtle.importKey('raw', kekRaw, 'AES-GCM', false, ['decrypt', 'encrypt']);
    const token = new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(u.tiv) }, kd, b64d(u.tok)));
    const R = `${d.repo.api || 'https://api.github.com'}/repos/${encodeURIComponent(d.repo.owner)}/${encodeURIComponent(d.repo.repo)}`;
    const api = async (m, p, body) => { const r = await fetch(R + p, { method: m, headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); const j = await r.json().catch(() => null); return { status: r.status, body: j }; };
    return async function enviar(bytes, meta) {
      const gz = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, kd, gz));
      const doc = JSON.stringify(Object.assign({ v: 1, id, iv: b64(iv), data: b64(ct), fecha: new Date().toISOString() }, meta));
      const ruta = `buzon/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.json`;
      const repo = await api('GET', ''); if (repo.status !== 200) throw new Error('sin acceso al repositorio (' + repo.status + ')');
      const rama = repo.body.default_branch || 'main';
      const bl = await api('POST', '/git/blobs', { content: b64(enc.encode(doc)), encoding: 'base64' }); if (bl.status !== 201) throw new Error('subida ' + bl.status);
      for (let i = 0; i < 5; i++) {
        const ref = await api('GET', `/git/ref/heads/${rama}`); const head = ref.body.object.sha;
        const cm = await api('GET', `/git/commits/${head}`);
        const tr = await api('POST', '/git/trees', { base_tree: cm.body.tree.sha, tree: [{ path: ruta, mode: '100644', type: 'blob', sha: bl.body.sha }] });
        const nc = await api('POST', '/git/commits', { message: meta.mensaje || 'Envío desde la web', tree: tr.body.sha, parents: [head] });
        const up = await api('PATCH', `/git/refs/heads/${rama}`, { sha: nc.body.sha });
        if (up.status === 200) return true;
        await new Promise((r) => setTimeout(r, 1200 + i * 800));
      }
      throw new Error('GitHub ocupado');
    };
  }
  window.WebCore = { b64, b64d, idU, derivar, bajar, abrir, login, enviador };
})();
