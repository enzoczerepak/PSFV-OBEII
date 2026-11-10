/* PSFV-OBE II · Íconos propios con temática de parque solar (trazo 24×24, color = currentColor). */
const svgI = (p, cls = 'ni') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
const ICO = {
  // sol sobre un panel
  inicio: svgI('<circle cx="16.5" cy="6.5" r="2.6"/><path d="M16.5 1.8v1.1M21.2 6.5h-1.1M19.8 3.2l-.8.8M13.2 3.2l.8.8"/><path d="M3 20.5 6 12h10l3 8.5z"/><path d="M4.8 16.2h12.4M9.4 12l-.9 8.5M12.6 12l.9 8.5"/>'),
  avance: svgI('<path d="M4 20V5M4 20h16"/><path d="M7 16l3.5-4 3 2.2L19 8"/><circle cx="19" cy="8" r="1.4"/>'),
  plano: svgI('<path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20z"/><path d="M9 4v13.5M15 6.5V20"/>'),
  partes: svgI('<rect x="7" y="2.8" width="10" height="18.4" rx="2.2"/><path d="M10 6.5h4M9.8 10.5h4.4M9.8 14h2.6"/><circle cx="12" cy="18.3" r=".6"/>'),
  crono: svgI('<rect x="3.5" y="5" width="17" height="15.5" rx="2.2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><path d="M7.5 13.5h4M7.5 16.8h7"/>'),
  cable: svgI('<circle cx="8" cy="12" r="5"/><circle cx="8" cy="12" r="1.6"/><path d="M8 7c4 0 6 1.2 8 3.5s3 4.5 5 4.5"/>'),
  barras: svgI('<path d="M4 20h16"/><rect x="5" y="12" width="3.2" height="8" rx=".6"/><rect x="10.4" y="7.5" width="3.2" height="12.5" rx=".6"/><rect x="15.8" y="4" width="3.2" height="16" rx=".6"/>'),
  dia: svgI('<rect x="3.5" y="5" width="17" height="15.5" rx="2.2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><rect x="11.5" y="12.5" width="4" height="4" rx=".8"/>'),
  zanja: svgI('<path d="M2.5 9h5l1.5 6h6l1.5-6h5"/><path d="M10.5 12.5h3"/><circle cx="12" cy="12.5" r=".4"/>'),
  bobina: svgI('<ellipse cx="12" cy="12" rx="8.5" ry="8.5"/><ellipse cx="12" cy="12" rx="3" ry="3"/><path d="M12 3.5v5.5M12 15v5.5"/>'),
  lista: svgI('<rect x="4.5" y="3.5" width="15" height="17" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>'),
  corte: svgI('<circle cx="6" cy="6.5" r="2.7"/><circle cx="6" cy="17.5" r="2.7"/><path d="M8.3 8 20 18M8.3 16 20 6"/>'),
  circuito: svgI('<path d="M4 7.5h13l-3-3M20 16.5H7l3 3"/>'),
  punta: svgI('<path d="M2.5 12h7"/><path d="M9.5 8.5h5.5l4 3.5-4 3.5H9.5z"/><circle cx="15.5" cy="12" r="1.1"/>'),
  sts: svgI('<circle cx="9" cy="12" r="5"/><circle cx="15" cy="12" r="5"/><path d="M9 3v4M15 3v4M9 17v4M15 17v4"/>'),
  hinca: svgI('<path d="M9 2.8h6v3H9z"/><path d="M10.2 5.8v12.5L12 21l1.8-2.7V5.8"/><path d="M4 13.5h16" stroke-dasharray="2 2"/>'),
  trackers: svgI('<path d="M5 3.5v17M12 3.5v17M19 3.5v17"/><rect x="3.4" y="6" width="3.2" height="12" rx=".6"/><rect x="10.4" y="6" width="3.2" height="12" rx=".6"/><rect x="17.4" y="6" width="3.2" height="12" rx=".6"/>'),
  fibra: svgI('<path d="M2.5 20c3.5 0 4.5-7.5 9-7.5"/><path d="M2.5 16.5c3 0 4-6.5 9-6.5"/><path d="M11.5 10v2.5h2.2l1.3-1.25-1.3-1.25z"/><path d="M17 11.25h4.5M16.6 8l3.6-2.2M16.6 14.5l3.6 2.2"/>'),
  pc: svgI('<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M9 20h6M12 16v4"/>'),
  edificio: svgI('<path d="M4 21V8l8-5 8 5v13"/><path d="M2 21h20"/><rect x="9" y="13" width="6" height="8"/><path d="M8 9h2M14 9h2"/>'),
  maquina: svgI('<path d="M3 17.5h11"/><circle cx="5.5" cy="17.5" r="2"/><circle cx="11.5" cy="17.5" r="2"/><path d="M3.5 15.5v-4h6l1.5-4h3v8"/><path d="M14 9.5l4-3 3 4-2.5 1.5"/><path d="M18.5 12v3l2 1.5"/>'),
  llave: svgI('<path d="M14.5 6.5a4 4 0 0 0 5 5l-8.5 8.5a2 2 0 0 1-3-3l8.5-8.5a4 4 0 0 0-2-2z"/><path d="M15.5 4.5l2.5 2.5"/>'),
  camion: svgI('<path d="M2.5 6.5h12v10h-12z"/><path d="M14.5 9.5h3.5l3 3.5v3.5h-6.5"/><circle cx="6.5" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>'),
  libro: svgI('<path d="M4 5.5c2.7-1.3 5.3-1.3 8 0v14c-2.7-1.3-5.3-1.3-8 0z"/><path d="M12 5.5c2.7-1.3 5.3-1.3 8 0v14c-2.7-1.3-5.3-1.3-8 0"/>'),
  ajustes: svgI('<path d="M4 6.5h10M18 6.5h2M4 12h4M12 12h8M4 17.5h12"/><circle cx="16" cy="6.5" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="17.5" r="2"/>'),
  sol: svgI('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/>'),
  ayuda: svgI('<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.5v.6"/><circle cx="12" cy="16.9" r=".5"/>'),
  exportar: svgI('<path d="M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5"/><path d="M4 16.5v3h16v-3"/>'),
  chev: '<svg class="chev" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
};
// logo: sol que sale sobre una fila de paneles (con rayos que giran despacio)
const LOGO = `<svg viewBox="0 0 44 40" class="logo" aria-hidden="true">
  <g class="lg-sol"><circle cx="27" cy="14" r="6.2" class="lg-disco"/><g class="lg-rayos">${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<path d="M27 3.2v2.6" transform="rotate(${a} 27 14)"/>`).join('')}</g></g>
  <path d="M5 35 10.5 22h19L35 35z" class="lg-panel"/><path d="M7.7 28.7h24.6M15 22l-1.7 13M23.5 22l1.7 13" class="lg-grid"/></svg>`;
