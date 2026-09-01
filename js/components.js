/* ============================================================
   COMPONENTS — helpers de render reutilizables entre pestañas
   ============================================================ */

const UI = (() => {

  function el(tag, attrs = {}, children = []){
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (v !== null && v !== undefined) node.setAttribute(k, v);
    });
    (Array.isArray(children) ? children : [children]).forEach(c => {
      if (c == null) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  function fmtPct(v){
    if (v == null || isNaN(v)) return '—';
    return (v * 100).toFixed(1) + '%';
  }
  function fmtInt(v){
    if (v == null || isNaN(v)) return '—';
    return Number(v).toLocaleString('es-PY');
  }

  function pctCell(pct, domainMin, domainMax, invert){
    const rgb = Analysis.colorForPct(pct, domainMin, domainMax, invert);
    const wrap = el('span', { class: 'pct-cell' });
    const track = el('span', { class: 'pct-bar-track' });
    if (rgb){
      const fill = el('span', {
        class: 'pct-bar-fill',
        style: `width:${Math.round((pct) * 100)}%; background:${Analysis.rgbToCss(rgb)}`,
      });
      track.appendChild(fill);
    }
    wrap.appendChild(track);
    wrap.appendChild(el('span', {
      class: 'pct-num',
      style: rgb ? `color:${Analysis.rgbToCss(rgb)}` : '',
      text: fmtPct(pct),
    }));
    return wrap;
  }

  function kpiCard(label, value, opts = {}){
    return el('div', { class: 'kpi-card' }, [
      el('div', { class: 'kpi-label', text: label }),
      el('div', { class: `kpi-value ${opts.tone || ''}`, text: value }),
      opts.foot ? el('div', { class: 'kpi-foot', text: opts.foot }) : null,
    ]);
  }

  /**
   * Tabla genérica con orden por click-en-encabezado y buscador opcional.
   * columns: [{ key, label, align:'left'|'right', render(row) -> Node|string, sortValue(row) -> number|string }]
   */
  function dataTable({ columns, rows, searchable = false, searchKeys = [], initialSort = null, csvName = null }){
    let sortState = initialSort || { key: columns[0].key, dir: 'desc' };
    let searchTerm = '';

    const wrap = el('div', { class: 'table-wrap' });
    const table = el('table', { class: 'data-table' });
    const thead = el('thead');
    const tbody = el('tbody');
    table.appendChild(thead);
    table.appendChild(tbody);

    function currentRows(){
      let out = rows;
      if (searchable && searchTerm){
        const t = searchTerm.toLowerCase();
        out = out.filter(r => searchKeys.some(k => String(r[k] ?? '').toLowerCase().includes(t)));
      }
      const col = columns.find(c => c.key === sortState.key);
      if (col){
        out = [...out].sort((a, b) => {
          const av = col.sortValue ? col.sortValue(a) : a[col.key];
          const bv = col.sortValue ? col.sortValue(b) : b[col.key];
          if (av == null && bv == null) return 0;
          if (av == null) return 1;
          if (bv == null) return -1;
          if (typeof av === 'string') return av.localeCompare(bv, 'es') * (sortState.dir === 'asc' ? 1 : -1);
          return (av - bv) * (sortState.dir === 'asc' ? 1 : -1);
        });
      }
      return out;
    }

    function renderHead(){
      thead.innerHTML = '';
      const tr = el('tr');
      columns.forEach(col => {
        const th = el('th', {
          class: [
            col.align === 'right' ? 'num' : '',
            sortState.key === col.key ? (sortState.dir === 'asc' ? 'sorted-asc' : 'sorted') : '',
          ].join(' ').trim(),
          text: col.label,
          onclick: () => {
            if (sortState.key === col.key) sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
            else sortState = { key: col.key, dir: 'desc' };
            renderHead(); renderBody();
          },
        });
        tr.appendChild(th);
      });
      thead.appendChild(tr);
    }

    function renderBody(){
      tbody.innerHTML = '';
      const data = currentRows();
      if (!data.length){
        tbody.appendChild(el('tr', {}, el('td', {
          colspan: columns.length, class: 'table-empty', text: 'Sin resultados para este filtro.',
        })));
        return;
      }
      data.forEach(row => {
        const tr = el('tr');
        columns.forEach(col => {
          const td = el('td', { class: col.align === 'right' ? 'num' : '' });
          const content = col.render ? col.render(row) : (row[col.key] ?? '—');
          if (content instanceof Node) td.appendChild(content);
          else td.textContent = content;
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
    }

    renderHead();
    renderBody();
    wrap.appendChild(table);

    const container = el('div', {}, [wrap]);
    container._getRows = currentRows;

    if (searchable){
      const bar = el('input', {
        class: 'table-search', placeholder: 'Buscar…', type: 'text',
        oninput: (e) => { searchTerm = e.target.value; renderBody(); },
      });
      container.insertBefore(bar, wrap);
      container._searchBar = bar;
    }

    return container;
  }

  function toCSV(rows, columns){
    const esc = v => {
      const s = v == null ? '' : String(v);
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = columns.map(c => esc(c.label)).join(';');
    const lines = rows.map(r => columns.map(c => esc(c.value(r))).join(';'));
    return [header, ...lines].join('\n');
  }

  function downloadCSV(filename, csvString){
    const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return { el, fmtPct, fmtInt, pctCell, kpiCard, dataTable, toCSV, downloadCSV };
})();
