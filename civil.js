/* PSFV-OBE II · Definiciones del frente civil (fundaciones de STS y edificio O&M), compartidas por el programa y la app de campo. */
(function (root) {
  const ETAPAS = [
    ['exc', 'Excavación'], ['encL', 'Armado de encofrado hormigón de limpieza'], ['hL', 'Carga de hormigón de limpieza'],
    ['hieP', 'Armado de estructura de hierro para platea'], ['encP', 'Armado de encofrado para platea'], ['hP', 'Carga de hormigón en platea'],
    ['hieT', 'Armado de estructura de tabiques'], ['encT', 'Armado de encofrado de tabiques'], ['hT', 'Carga de hormigón en tabiques'],
    ['frag', 'Fraguado general'], ['sts', 'Colocación de STS sobre base'],
  ];
  const SALA_ET = [
    { k: 'exc', n: 'Excavación para zapatas', g: 'Bases', a: 'zap' },
    { k: 'encL', n: 'Encofrado para hormigón de limpieza', g: 'Bases', a: 'zap' },
    { k: 'hL', n: 'Carga de hormigón de limpieza', g: 'Bases', a: 'zap' },
    { k: 'armZ', n: 'Armado de estructura de bases/zapatas', g: 'Bases', a: 'zap' },
    { k: 'encZ', n: 'Encofrado de bases/zapatas', g: 'Bases', a: 'zap' },
    { k: 'hZ', n: 'Carga de hormigón de bases/zapatas', g: 'Bases', a: 'zap' },
    { k: 'armEI', n: 'Armado de estructura de encadenado inferior', g: 'Encadenado inferior', a: 'viga' },
    { k: 'encEI', n: 'Encofrado de encadenado inferior', g: 'Encadenado inferior', a: 'viga' },
    { k: 'hEI', n: 'Carga de hormigón de encadenado inferior', g: 'Encadenado inferior', a: 'viga' },
    { k: 'trin', n: 'Ejecución de trincheras y contrapiso', g: 'Piso y muros', a: 'gral' },
    { k: 'piso', n: 'Ejecución de piso técnico y mampostería', g: 'Piso y muros', a: 'gral' },
    { k: 'revG', n: 'Revoque grueso interno y externo', g: 'Revoques', a: 'gral' },
    { k: 'revF', n: 'Revoque fino interno y externo', g: 'Revoques', a: 'gral' },
    { k: 'armCS', n: 'Armado de estructura de columnas y encadenado superior', g: 'Estructura superior', a: 'gral' },
    { k: 'hCS', n: 'Carga de columnas y encadenado superior', g: 'Estructura superior', a: 'gral' },
    { k: 'estT', n: 'Ejecución de estructura del techo', g: 'Techo', a: 'gral' },
    { k: 'techo', n: 'Techado', g: 'Techo', a: 'gral' },
    { k: 'aber', n: 'Colocación de aberturas', g: 'Terminaciones e instalaciones', a: 'gral' },
    { k: 'elec', n: 'Instalación eléctrica', g: 'Terminaciones e instalaciones', a: 'gral' },
    { k: 'sanit', n: 'Instalación sanitaria', g: 'Terminaciones e instalaciones', a: 'gral' },
  ];
  // Geometría del edificio (m, origen en C1). Zapatas: Z1 105 cm, Z2 115 cm, Z3 125 cm (lado).
  const SALA_ZAP = [
    ['C1', 0, 0, 'Z1'], ['C2', 0, 3.89, 'Z2'], ['C3', 0, 7.8, 'Z1'], ['C4', 5.88, 7.8, 'Z2'], ['C5', 10.88, 7.8, 'Z1'], ['C6', 12.78, 7.8, 'Z1'],
    ['C7', 5.88, 0, 'Z2'], ['C8', 10.88, 0, 'Z1'], ['C9', 12.78, 0, 'Z1'], ['C10', 5.88, 3.89, 'Z3'], ['C11', 10.88, 2.98, 'Z2'], ['C12', 12.78, 2.98, 'Z1'],
  ].map(([id, x, y, t]) => ({ id, x, y, t }));
  const SALA_VIG = [
    ['V1', ['C1', 'C2', 'C3']], ['V2', ['C7', 'C10', 'C4']], ['V3', ['C8', 'C11', 'C5']], ['V4', ['C9', 'C12', 'C6']],
    ['V5', ['C1', 'C7', 'C8', 'C9']], ['V6', ['C3', 'C4', 'C5', 'C6']], ['V7', ['C2', 'C10']], ['V8', ['C11', 'C12']],
  ].map(([id, cs]) => ({ id, cs }));
  const STS = ['STS 1', 'STS 2', 'STS 3', 'STS 4'];
  root.CIVIL = { ETAPAS, SALA_ET, SALA_ZAP, SALA_VIG, STS };
})(typeof window !== 'undefined' ? window : globalThis);
