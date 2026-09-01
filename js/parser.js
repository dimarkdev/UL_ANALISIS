/* ============================================================
   PARSER — lee el .xlsx y detecta el rol de cada pestaña
   por sus columnas (no por el nombre exacto), para que siga
   funcionando aunque el archivo mensual cambie levemente.
   ============================================================ */

const Parser = (() => {

  function normKey(s){
    return String(s || '')
      .trim()
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // sin acentos
  }

  // Busca una columna por una lista de nombres candidatos (normalizados)
  function findHeaderKey(headers, candidates){
    const normed = headers.map(h => ({ raw: h, n: normKey(h) }));
    for (const cand of candidates){
      const hit = normed.find(h => h.n === cand);
      if (hit) return hit.raw;
    }
    return null;
  }

  function parseFecha(value){
    if (value == null || value === '') return null;
    if (value instanceof Date && !isNaN(value)) return value;
    if (typeof value === 'number'){
      // serial de Excel
      const d = XLSX.SSF.parse_date_code(value);
      if (d) return new Date(d.y, d.m - 1, d.d);
      return null;
    }
    const s = String(value).trim();
    let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/); // dd/mm/yyyy
    if (m){
      let [, dd, mm, yy] = m;
      if (yy.length === 2) yy = '20' + yy;
      const d = new Date(Number(yy), Number(mm) - 1, Number(dd));
      return isNaN(d) ? null : d;
    }
    m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); // yyyy-mm-dd
    if (m){
      const [, yy, mm, dd] = m;
      const d = new Date(Number(yy), Number(mm) - 1, Number(dd));
      return isNaN(d) ? null : d;
    }
    const d = new Date(s);
    return isNaN(d) ? null : d;
  }

  function fmtFecha(d){
    if (!d) return '—';
    const p = n => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
  }

  function cleanName(s){
    return String(s || '').trim().replace(/\s+/g, ' ');
  }

  function tidyReportLabel(sheetName){
    return cleanName(sheetName).replace(/^reporte\s+de\s+/i, '').replace(/^reporte\s+/i, '');
  }

  /**
   * Lee el workbook y devuelve:
   *  - quiebre: { rows: [...] } | null
   *  - cumplimiento: { records: [...], reportTypes: [...] } | null
   *  - warnings: [string]
   */
  function parseWorkbook(arrayBuffer){
    const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
    const warnings = [];
    let quiebre = null;
    const complianceRecords = [];
    const reportTypesFound = new Set();

    wb.SheetNames.forEach(sheetName => {
      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });
      if (!rows.length) return;
      const headers = Object.keys(rows[0]);

      const disponibleKey = findHeaderKey(headers, ['disponible']);
      const usuarioKey = findHeaderKey(headers, ['usuario']);
      const fechaKey = findHeaderKey(headers, ['fecha']);
      const pdvKey = findHeaderKey(headers, ['punto de venta', 'pdv']);
      const cadenaKey = findHeaderKey(headers, ['cadena']);
      const canalKey = findHeaderKey(headers, ['canal']);
      const clusterKey = findHeaderKey(headers, ['cluster']);
      const productoKey = findHeaderKey(headers, ['producto']);
      const categoriaKey = findHeaderKey(headers, ['categoria']);
      const subCategoriaKey = findHeaderKey(headers, ['sub categoria']);

      // --- Pestaña de QUIEBRES: tiene "Disponible" pero no "Usuario" ---
      if (disponibleKey && !usuarioKey && !quiebre){
        const parsed = rows.map(r => ({
          fecha: parseFecha(r[fechaKey]),
          canal: cleanName(r[canalKey]),
          cluster: cleanName(r[clusterKey]),
          cadena: cleanName(r[cadenaKey]),
          puntoVenta: cleanName(r[pdvKey]),
          producto: cleanName(r[productoKey]),
          categoria: cleanName(r[categoriaKey]),
          subCategoria: cleanName(r[subCategoriaKey]),
          disponible: cleanName(r[disponibleKey]),
        })).filter(r => r.puntoVenta || r.producto);
        parsed.forEach(r => { r.quiebre = /^no$/i.test(r.disponible) ? 1 : 0; });
        quiebre = { rows: parsed, sheetName };
      }
      // --- Pestaña de CUMPLIMIENTO: tiene "Usuario" ---
      else if (usuarioKey){
        const label = tidyReportLabel(sheetName);
        reportTypesFound.add(label);
        rows.forEach(r => {
          const usuario = cleanName(r[usuarioKey]);
          if (!usuario) return;
          complianceRecords.push({
            fecha: parseFecha(r[fechaKey]),
            usuario,
            usuarioKey: usuario.toUpperCase(),
            reporte: label,
            cadena: cleanName(r[cadenaKey]),
            canal: cleanName(r[canalKey]),
            cluster: cleanName(r[clusterKey]),
            puntoVenta: cleanName(r[pdvKey]),
          });
        });
      }
    });

    if (!quiebre) warnings.push('No se encontró una pestaña de quiebres (se espera una columna "Disponible").');
    if (!complianceRecords.length) warnings.push('No se encontraron pestañas de cumplimiento (se espera una columna "Usuario").');

    return {
      quiebre,
      cumplimiento: complianceRecords.length
        ? { records: complianceRecords, reportTypes: Array.from(reportTypesFound).sort() }
        : null,
      warnings,
    };
  }

  return { parseWorkbook, parseFecha, fmtFecha, cleanName };
})();
