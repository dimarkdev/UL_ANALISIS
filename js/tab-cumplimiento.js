/* ============================================================
   PESTAÑA: CUMPLIMIENTO
   Usuario x Tipo de reporte -> quién cargó y quién no
   ============================================================ */

const TabCumplimiento = (() => {

  function render(container, ctx){
    container.innerHTML = '';
    const { cumplimientoPivot, incumplidoresList, reportTypesAll, cumplimientoReportFilter, onReportFilterChange } = ctx;

    const head = UI.el('div', { class: 'panel-head' }, [
      UI.el('h2', { class: 'panel-title', text: 'Cumplimiento de carga' }),
      UI.el('p', { class: 'panel-sub', text: 'Cantidad de relevamientos cargados por usuario y tipo de reporte. Se considera "faltante" al tipo de reporte con cero cargas dentro del período y tipo filtrados.' }),
    ]);

    if (reportTypesAll && reportTypesAll.length > 1){
      const selectRow = UI.el('div', { style: 'margin-top:12px; display:flex; align-items:center; gap:8px;' }, [
        UI.el('label', { style: 'font-size:12.5px; font-weight:600; color:var(--ink-soft);', text: 'Tipo de reporte:' }),
        UI.el('select', {
          class: 'filter-select',
          onchange: (e) => onReportFilterChange(e.target.value || null),
        }, [
          UI.el('option', { value: '', text: 'Todos' }),
          ...reportTypesAll.map(rt => UI.el('option', { value: rt, text: rt, selected: cumplimientoReportFilter === rt ? 'selected' : null })),
        ]),
      ]);
      head.appendChild(selectRow);
    }
    container.appendChild(head);

    if (!cumplimientoPivot){
      container.appendChild(UI.el('div', { class: 'card' }, UI.el('div', { class: 'table-empty', text: 'No se detectaron pestañas con columna "Usuario" en este archivo.' })));
      return;
    }

    const { users, reportTypes } = cumplimientoPivot;

    // ---- KPIs ----
    container.appendChild(UI.el('div', { class: 'kpi-row' }, [
      UI.kpiCard('Usuarios activos', UI.fmtInt(users.length)),
      UI.kpiCard('Tipos de reporte', UI.fmtInt(reportTypes.length)),
      UI.kpiCard('Con al menos un faltante', UI.fmtInt(incumplidoresList.length), {
        tone: incumplidoresList.length ? 'bad' : 'good',
      }),
      UI.kpiCard('Relevamientos totales', UI.fmtInt(users.reduce((a, u) => a + u.total, 0))),
    ]));

    // ---- Tabla pivot ----
    const pivotCard = UI.el('div', { class: 'card' });
    const pivotHead = UI.el('div', { class: 'card-head' }, [
      UI.el('div', {}, [
        UI.el('h3', { text: 'Relevamientos por usuario' }),
        UI.el('p', { text: 'Click en un encabezado para ordenar · las celdas en rojo indican cero cargas' }),
      ]),
      UI.el('button', {
        class: 'btn btn-primary',
        text: 'Exportar incumplidores (CSV)',
        onclick: () => exportIncumplidores(incumplidoresList),
      }),
    ]);
    pivotCard.appendChild(pivotHead);

    const columns = [
      { key: 'usuario', label: 'Usuario', render: r => r.usuario },
      ...reportTypes.map(rt => ({
        key: rt,
        label: rt,
        align: 'right',
        sortValue: r => r.byReport[rt] || 0,
        render: r => {
          const n = r.byReport[rt] || 0;
          return UI.el('span', { class: n ? '' : 'count-zero', text: n ? UI.fmtInt(n) : '0' });
        },
      })),
      { key: 'total', label: 'Total', align: 'right', sortValue: r => r.total, render: r => UI.fmtInt(r.total) },
    ];

    const tbl = UI.dataTable({
      columns,
      rows: users,
      searchable: true,
      searchKeys: ['usuario'],
      initialSort: { key: 'total', dir: 'desc' },
    });
    pivotCard.appendChild(tbl);
    container.appendChild(pivotCard);

    // ---- Tabla de incumplidores ----
    const incCard = UI.el('div', { class: 'card' });
    incCard.appendChild(UI.el('div', { class: 'card-head' }, [
      UI.el('div', {}, [
        UI.el('h3', { text: 'Usuarios con reportes faltantes' }),
        UI.el('p', { text: 'Para accionar directamente con el equipo de campo' }),
      ]),
    ]));
    if (!incumplidoresList.length){
      incCard.appendChild(UI.el('div', { class: 'table-empty', text: 'Todos los usuarios cargaron los tipos de reporte disponibles en este período. 🎉' }));
    } else {
      const incTbl = UI.dataTable({
        columns: [
          { key: 'usuario', label: 'Usuario', render: r => r.usuario },
          { key: 'faltantes', label: 'Reportes faltantes', render: r => r.faltantes.join(', ') },
          { key: 'total', label: 'Cargas totales', align: 'right', render: r => UI.fmtInt(r.total) },
          { key: 'cadenas', label: 'Cadenas donde trabaja', render: r => r.cadenas || '—' },
        ],
        rows: incumplidoresList,
        searchable: true,
        searchKeys: ['usuario', 'cadenas'],
        initialSort: { key: 'usuario', dir: 'asc' },
      });
      incCard.appendChild(incTbl);
    }
    container.appendChild(incCard);
  }

  function exportIncumplidores(list){
    const csv = UI.toCSV(list, [
      { label: 'Usuario', value: r => r.usuario },
      { label: 'Reportes faltantes', value: r => r.faltantes.join(' | ') },
      { label: 'Cargas totales', value: r => r.total },
      { label: 'Cadenas', value: r => r.cadenas },
    ]);
    UI.downloadCSV('incumplidores.csv', csv);
  }

  return { render };
})();
