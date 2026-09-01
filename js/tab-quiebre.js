/* ============================================================
   PESTAÑAS DE QUIEBRE — por PDV / Producto / Cadena, y la
   matriz cruzada Cadena x Categoría
   ============================================================ */

const TabQuiebre = (() => {

  function legend(){
    return UI.el('div', { class: 'scale-legend' }, [
      UI.el('span', { text: 'Menor quiebre' }),
      UI.el('span', { class: 'swatch', style: 'background:linear-gradient(90deg,#2F7D4F,#C98A2B,#B23B32)' }),
      UI.el('span', { text: 'Mayor quiebre' }),
    ]);
  }

  function renderGroup(container, ctx, { dimKey, dimLabel, title, sub }){
    container.innerHTML = '';
    const { quiebreFiltered } = ctx;

    container.appendChild(UI.el('div', { class: 'panel-head' }, [
      UI.el('h2', { class: 'panel-title', text: title }),
      UI.el('p', { class: 'panel-sub', text: sub }),
    ]));

    if (!quiebreFiltered.length){
      container.appendChild(UI.el('div', { class: 'card' }, UI.el('div', { class: 'table-empty', text: 'No hay datos de quiebre para este filtro.' })));
      return;
    }

    const data = Analysis.groupQuiebre(quiebreFiltered, dimKey);
    const card = UI.el('div', { class: 'card' });
    card.appendChild(UI.el('div', { class: 'card-head' }, [
      UI.el('div', {}, [
        UI.el('h3', { text: `% de quiebre por ${dimLabel}` }),
        UI.el('p', { text: `${data.length} valores distintos` }),
      ]),
      UI.el('div', {}, [
        legend(),
        UI.el('button', { class: 'btn', text: 'Exportar CSV', style: 'margin-top:6px', onclick: () => exportGroup(data, dimLabel) }),
      ]),
    ]));

    const tbl = UI.dataTable({
      columns: [
        { key: 'key', label: dimLabel, render: r => r.key },
        { key: 'pct', label: '% quiebre', align: 'right', sortValue: r => r.pct, render: r => UI.pctCell(r.pct, 0, 1) },
        { key: 'total', label: 'Relevamientos', align: 'right', sortValue: r => r.total, render: r => UI.fmtInt(r.total) },
      ],
      rows: data,
      searchable: true,
      searchKeys: ['key'],
      initialSort: { key: 'pct', dir: 'desc' },
    });
    card.appendChild(tbl);
    container.appendChild(card);
  }

  function exportGroup(data, dimLabel){
    const csv = UI.toCSV(data, [
      { label: dimLabel, value: r => r.key },
      { label: '% quiebre', value: r => (r.pct * 100).toFixed(1) + '%' },
      { label: 'Relevamientos', value: r => r.total },
    ]);
    UI.downloadCSV(`quiebre_${dimLabel.toLowerCase().replace(/\s+/g, '_')}.csv`, csv);
  }

  function renderCategoria(container, ctx){
    container.innerHTML = '';
    const { quiebreFiltered } = ctx;

    container.appendChild(UI.el('div', { class: 'panel-head' }, [
      UI.el('h2', { class: 'panel-title', text: 'Quiebre · Cadena × Categoría' }),
      UI.el('p', { class: 'panel-sub', text: 'Cruce de cadena y categoría de producto. Cada celda muestra el % de quiebre de esa combinación.' }),
    ]));

    if (!quiebreFiltered.length){
      container.appendChild(UI.el('div', { class: 'card' }, UI.el('div', { class: 'table-empty', text: 'No hay datos de quiebre para este filtro.' })));
      return;
    }

    const { rowsArr, colsArr, matrix } = Analysis.crossTabQuiebre(quiebreFiltered, 'cadena', 'categoria');

    const card = UI.el('div', { class: 'card' });
    card.appendChild(UI.el('div', { class: 'card-head' }, [
      UI.el('div', {}, [
        UI.el('h3', { text: 'Matriz de quiebre' }),
        UI.el('p', { text: `${rowsArr.length} cadenas × ${colsArr.length} categorías` }),
      ]),
      legend(),
    ]));

    const wrap = UI.el('div', { class: 'table-wrap' });
    const table = UI.el('table', { class: 'data-table' });
    const thead = UI.el('thead');
    const headRow = UI.el('tr');
    headRow.appendChild(UI.el('th', { text: 'Cadena' }));
    colsArr.forEach(c => headRow.appendChild(UI.el('th', { class: 'num', text: c })));
    headRow.appendChild(UI.el('th', { class: 'num', text: 'Total' }));
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = UI.el('tbody');
    matrix.forEach(row => {
      const tr = UI.el('tr');
      tr.appendChild(UI.el('td', { text: row.row }));
      row.cells.forEach(pct => {
        const rgb = pct == null ? null : Analysis.colorForPct(pct, 0, 1);
        tr.appendChild(UI.el('td', {
          class: 'num',
          style: rgb ? `background:${Analysis.rgbToCss(rgb, 0.16)}; color:${Analysis.rgbToCss(rgb)}; font-weight:600;` : '',
          text: pct == null ? '—' : UI.fmtPct(pct),
        }));
      });
      tr.appendChild(UI.el('td', { class: 'num', style: 'font-weight:600;', text: UI.fmtPct(row.rowPct) }));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    card.appendChild(wrap);
    container.appendChild(card);
  }

  return { renderGroup, renderCategoria };
})();
