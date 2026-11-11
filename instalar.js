/* Instalar el visor / la app de campo en el celular: APK en Android, "Agregar a inicio" en iPhone */
(function () {
  const ua = navigator.userAgent || '';
  const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  const instalada = window.AndroidApp || window.navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  const apk = document.getElementById('lgApk');
  if (apk) apk.style.display = android && !instalada ? '' : 'none';
  const btn = document.getElementById('lgIos');
  if (!btn) return;
  btn.style.display = ios && !instalada ? '' : 'none';
  const campo = /campo\.html/.test(location.pathname);
  btn.onclick = (e) => {
    e.preventDefault();
    const ov = document.createElement('div'); ov.className = 'iosov';
    const comp = '<svg viewBox="0 0 24 24" class="iosi"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>';
    const mas = '<svg viewBox="0 0 24 24" class="iosi"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8v8M8 12h8"/></svg>';
    ov.innerHTML = `<div class="iosbox"><img src="apple-touch-icon.png" alt=""><h3>Instalar en el iPhone</h3>
      <p class="iossub">Queda como una app más, con su ícono, a pantalla completa y siempre actualizada.</p>
      <ol><li>Abrí esta página en <b>Safari</b> (no funciona desde Chrome ni desde WhatsApp).</li>
        <li>Tocá <b>Compartir</b> ${comp} en la barra de abajo (en iPad, arriba a la derecha).</li>
        <li>Deslizá y elegí <b>Agregar a pantalla de inicio</b> ${mas}.</li>
        <li>Tocá <b>Agregar</b>. Abrí <b>${campo ? 'Campo OBEII' : 'OBE II'}</b> desde el ícono e ingresá con tu usuario.</li></ol>
      <button type="button" class="iosok">Entendido</button></div><div class="iosflecha">▼</div>`;
    document.body.appendChild(ov);
    ov.onclick = (ev) => { if (ev.target === ov || ev.target.classList.contains('iosok')) ov.remove(); };
  };
})();
