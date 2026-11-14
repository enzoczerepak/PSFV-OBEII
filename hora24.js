/* PSFV-OBE II · horas siempre en formato de 24 h (13:05 y no 1:05 p. m.), aunque Windows o el celular estén configurados en 12 h. */
(function () {
  const conH = (o) => !o || o.hour !== undefined || o.timeStyle !== undefined || (o.dateStyle === undefined && o.year === undefined && o.month === undefined && o.day === undefined && o.weekday === undefined);
  const h23 = (o, def) => { if (!conH(o) && !def) return o; const r = Object.assign({}, o || {}); if (r.hour12 === undefined && r.hourCycle === undefined) r.hourCycle = 'h23'; return r; };
  const t = Date.prototype.toLocaleTimeString, s = Date.prototype.toLocaleString;
  Date.prototype.toLocaleTimeString = function (l, o) { return t.call(this, l, h23(o, true)); };
  Date.prototype.toLocaleString = function (l, o) { return s.call(this, l, o && o.hour === undefined && o.timeStyle === undefined && (o.day || o.month || o.year || o.dateStyle) ? o : h23(o, true)); };
})();
