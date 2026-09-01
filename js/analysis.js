/* ============================================================
   ANALYSIS — filtros, agrupaciones (pivots) y escala de color
   ============================================================ */

const Analysis = (() => {

  function inRange(fecha, from, to){
    if (!fecha) return true; // sin fecha no se excluye por rango
    if (from && fecha < from) return false;
    if (to && fecha > to) return false;
    return true;
  }

  function matchesSet(value, set){
    if (!set || !set.size) return true;
    return set.has(value);
  }

  function filterRows(rows, filters){
    const { from, to, cadenas, canales, clusters } = filters;
    return rows.filter(r =>
      inRange(r.fecha, from, to) &&
      matchesSet(r.cadena, cadenas) &&
      matchesSet(r.canal, canales) &&
      matchesSet(r.cluster, clusters)
    );
  }

  function distinctValues(rows, key){
    const s = new Set();
    rows.forEach(r => { if (r[key]) s.add(r[key]); });
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'es'));
  }

  function dateExtent(rows){
    let min = null, max = null;
    rows.forEach(r => {
      if (!r.fecha) return;
      if (!min || r.fecha < min) min = r.fecha;
      if (!max || r.fecha > max) max = r.fecha;
    });
    return { min, max };
  }

  // Agrupa filas de quiebre por una dimensión -> % quiebre
  function groupQuiebre(rows, dimKey){
    const map = new Map();
    rows.forEach(r => {
      const key = r[dimKey] || '(Sin dato)';
      if (!map.has(key)) map.set(key, { key, total: 0, quiebres: 0 });
      const g = map.get(key);
      g.total += 1;
      g.quiebres += r.quiebre;
    });
    return Array.from(map.values()).map(g => ({
      ...g,
      pct: g.total ? g.quiebres / g.total : 0,
    }));
  }

  // Matriz Cadena x Categoria -> % quiebre
  function crossTabQuiebre(rows, rowKey, colKey){
    const rowSet = new Set(), colSet = new Set();
    const cellMap = new Map(); // "row||col" -> {total, quiebres}
    rows.forEach(r => {
      const rv = r[rowKey] || '(Sin dato)';
      const cv = r[colKey] || '(Sin dato)';
      rowSet.add(rv); colSet.add(cv);
      const k = rv + '||' + cv;
      if (!cellMap.has(k)) cellMap.set(k, { total: 0, quiebres: 0 });
      const c = cellMap.get(k);
      c.total += 1; c.quiebres += r.quiebre;
    });
    const rowsArr = Array.from(rowSet).sort((a, b) => a.localeCompare(b, 'es'));
    const colsArr = Array.from(colSet).sort((a, b) => a.localeCompare(b, 'es'));
    const matrix = rowsArr.map(rv => {
      const cells = colsArr.map(cv => {
        const c = cellMap.get(rv + '||' + cv);
        return c && c.total ? c.quiebres / c.total : null;
      });
      const rowTotal = colsArr.reduce((acc, cv) => {
        const c = cellMap.get(rv + '||' + cv);
        if (!c) return acc;
        acc.total += c.total; acc.quiebres += c.quiebres;
        return acc;
      }, { total: 0, quiebres: 0 });
      return { row: rv, cells, rowPct: rowTotal.total ? rowTotal.quiebres / rowTotal.total : null };
    });
    return { rowsArr, colsArr, matrix };
  }

  // Cumplimiento: Usuario x TipoDeReporte -> conteo de registros
  function pivotCumplimiento(records, reportTypes){
    const users = new Map(); // key -> {usuario, byReport, total, cadenas:Set, puntosVenta:Set, diasVisitados:Set, fechas...}
    records.forEach(r => {
      if (!users.has(r.usuarioKey)){
        users.set(r.usuarioKey, {
          usuario: r.usuario,
          byReport: {},
          total: 0,
          cadenas: new Set(),
          puntosVenta: new Set(),
          diasVisitados: new Set(),
          minFecha: null, maxFecha: null,
        });
      }
      const u = users.get(r.usuarioKey);
      u.byReport[r.reporte] = (u.byReport[r.reporte] || 0) + 1;
      u.total += 1;
      if (r.cadena) u.cadenas.add(r.cadena);
      if (r.puntoVenta) u.puntosVenta.add(r.puntoVenta);
      if (r.fecha){
        u.diasVisitados.add(r.fecha.toDateString());
        if (!u.minFecha || r.fecha < u.minFecha) u.minFecha = r.fecha;
        if (!u.maxFecha || r.fecha > u.maxFecha) u.maxFecha = r.fecha;
      }
    });
    const list = Array.from(users.values()).sort((a, b) => a.usuario.localeCompare(b.usuario, 'es'));
    return { users: list, reportTypes };
  }

  // Lista de usuarios que no cargaron uno o más tipos de reporte seleccionados
  function incumplidores(pivot){
    const out = [];
    pivot.users.forEach(u => {
      const faltantes = pivot.reportTypes.filter(rt => !u.byReport[rt]);
      if (faltantes.length){
        out.push({
          usuario: u.usuario,
          faltantes,
          total: u.total,
          cadenas: Array.from(u.cadenas).join(', '),
          puntosVenta: Array.from(u.puntosVenta).join(', '),
        });
      }
    });
    return out;
  }

  // Usuarios con volumen bajo de relevamientos (independiente de si les falta
  // algún tipo de reporte por completo). El umbral se calcula como la mitad
  // de la mediana del total de relevamientos entre todos los usuarios, salvo
  // que se pase un umbral explícito.
  function medianOf(nums){
    if (!nums.length) return 0;
    const sorted = [...nums].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function sugerirUmbralBajoVolumen(pivot){
    const totales = pivot.users.map(u => u.total);
    const mediana = medianOf(totales);
    return Math.max(1, Math.round(mediana / 2));
  }

  function sugerirUmbralCobertura(pivot){
    const conteos = pivot.users.map(u => u.puntosVenta.size);
    const mediana = medianOf(conteos);
    // La cobertura de PDV suele moverse en números chicos (1 a 5), así que
    // "la mitad de la mediana" la aplasta a 0-1 y no sirve como corte. Acá
    // se usa la mediana entera: marca a quien cubre menos PDV que la mitad
    // del equipo, ajustable igual que el resto.
    return Math.max(2, Math.round(mediana));
  }

  function userRow(u, umbralVolumen, umbralCobertura){
    return {
      usuario: u.usuario,
      total: u.total,
      pdvCount: u.puntosVenta.size,
      diasCount: u.diasVisitados.size,
      puntosVenta: Array.from(u.puntosVenta).join(', '),
      cadenas: Array.from(u.cadenas).join(', '),
      faltantes: [], // se completa afuera si hace falta
      bajoVolumen: umbralVolumen != null ? u.total < umbralVolumen : false,
      bajaCobertura: umbralCobertura != null ? u.puntosVenta.size < umbralCobertura : false,
    };
  }

  function usuariosBajoVolumen(pivot, umbral, umbralCobertura){
    return pivot.users
      .filter(u => u.total < umbral)
      .map(u => Object.assign(userRow(u, umbral, umbralCobertura), {
        faltantes: pivot.reportTypes.filter(rt => !u.byReport[rt]),
      }))
      .sort((a, b) => a.total - b.total);
  }

  function usuariosBajaCobertura(pivot, umbral, umbralVolumen){
    return pivot.users
      .filter(u => u.puntosVenta.size < umbral)
      .map(u => Object.assign(userRow(u, umbralVolumen, umbral), {
        faltantes: pivot.reportTypes.filter(rt => !u.byReport[rt]),
      }))
      .sort((a, b) => a.pdvCount - b.pdvCount);
  }

  // ---- escala de color (verde -> ámbar -> rojo), relativa al min/max visible ----
  function hexToRgb(hex){
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbToCss([r, g, b], alpha = 1){
    return `rgba(${r},${g},${b},${alpha})`;
  }
  function lerp(a, b, t){ return a + (b - a) * t; }
  function lerpColor(c1, c2, t){
    return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
  }

  const GOOD = hexToRgb('#2F7D4F');
  const MID = hexToRgb('#C98A2B');
  const BAD = hexToRgb('#B23B32');

  function colorForPct(pct, domainMin = 0, domainMax = 1){
    if (pct == null || isNaN(pct)) return null;
    const span = domainMax - domainMin || 1;
    let t = (pct - domainMin) / span;
    t = Math.max(0, Math.min(1, t));
    const rgb = t < 0.5 ? lerpColor(GOOD, MID, t / 0.5) : lerpColor(MID, BAD, (t - 0.5) / 0.5);
    return rgb;
  }

  function badgeClass(pct){
    if (pct == null) return '';
    if (pct < 0.15) return 'badge-good';
    if (pct < 0.35) return 'badge-mid';
    return 'badge-bad';
  }

  return {
    filterRows, distinctValues, dateExtent,
    groupQuiebre, crossTabQuiebre,
    pivotCumplimiento, incumplidores,
    sugerirUmbralBajoVolumen, sugerirUmbralCobertura,
    usuariosBajoVolumen, usuariosBajaCobertura,
    colorForPct, rgbToCss, badgeClass,
  };
})();
