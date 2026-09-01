/* ============================================================
   PESTAÑA: CUMPLIMIENTO
   Usuario x Tipo de reporte -> quién cargó y quién no,
   más un panel de usuarios con volumen bajo de relevamientos.
   ============================================================ */

const TabCumplimiento = (() => {

  let manualUmbral = null; // si el usuario ajusta el umbral a mano, se recuerda durante la sesión

  function render(container, ctx){
    container.innerHTML = '';
    const { cumplimientoPivot, incumplidoresList, reportTypesAll, cumplimientoReportFilter, onReportFilterChange } = ctx;

    const head = UI.el('div', { class: 'panel-head' }, [
      UI.el('h2', { class: 'panel-title', text: 'Cumplimiento de carga' }),
      UI.el('p', { class: 'panel-sub', text: 'Dos criterios distintos: reportes con cero cargas (faltante completo) y usuarios cuyo volumen total de relevamientos está muy por debajo del resto del equipo.' }),
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
    const sugerido = Analysis.sugerirUmbralBajoVolumen(cumplimientoPivot);
    const umbralActivo = manualUmbral != null ? manualUmbral : sugerido;
    const bajoVolumen = Analysis.usuariosBajoVolumen(cumplimientoPivot, umbralActivo);

    // ---- KPIs ----
    container.appendChild(UI.el('div', { class: 'kpi-row' }, [
      UI.kpiCard('Usuarios activos', UI.fmtInt(users.length)),
      UI.kpiCard('Tipos de reporte', UI.fmtInt(reportTypes.length)),
      UI.kpiCard('Con reportes faltantes', UI.fmtInt(incumplidoresList.length), {
        tone: incumplidoresList.length ? 'bad' : 'good',
        foot: 'al menos un tipo en cero',
      }),
      UI.kpiCard('Con volumen bajo', UI.fmtInt(bajoVolumen.length), {
        tone: bajoVolumen.length ? 'bad' : 'good',
        foot: `menos de ${umbralActivo} relevamientos`,
      }),
    ]));

    // ---- Usuarios con pocos relevamientos (criterio de volumen) ----
    const lowCard = UI.el('div', { class: 'card' });
    const lowHead = UI.el('div', { class: 'card-head' }, [
      UI.el('div', {}, [
        UI.el('h3', { text: 'Usuarios con pocos relevamientos cargados' }),
        UI.el('p', {
          text: `Ordenado de menor a mayor · sugerido automáticamente en ${sugerido} (mitad de la mediana del equipo), ajustable`,
        }),
      ]),
      UI.el('div', { style: 'display:flex; align-items:center; gap:10px;' }, [
        UI.el('label', { style: 'font-size:12.5px; font-weight:600; color:var(--ink-soft); display:flex; align-items:center; gap:6px;' }, [
          'Menos de',
          UI.el('input', {
            type: 'number', min: '1', value: String(umbralActivo),
            style: 'width:56px; padding:5px 7px; border:1px solid var(--line-strong); border-radius:6px; font-family:var(--font-mono);',
            onchange: (e) => {
              const v = parseInt(e.target.value, 10);
              manualUmbral = isNaN(v) || v < 1 ? 1 : v;
              render(container, ctx);
            },
          }),
          'relevamientos',
        ]),
        UI.el('button', {
          class: 'btn btn-primary',
          text: 'Exportar (CSV)',
          onclick: () => exportBajoVolumen(bajoVolumen, umbralActivo),
        }),
      ]),
    ]);
    lowCard.appendChild(lowHead);

    if (!bajoVolumen.length){
      lowCard.appendChild(UI.el('div', { class: 'table-empty', text: 'Nadie está por debajo de ese umbral en este período. 🎉' }));
    } else {
      const lowTbl = UI.dataTable({
        columns: [
          { key: 'usuario', label: 'Usuario', render: r => UI.el('b', { text: r.usuario }) },
          { key: 'total', label: 'Relevamientos', align: 'right', render: r => UI.el('span', { class: 'count-zero', text: UI.fmtInt(r.total) }) },
          { key: 'puntosVenta', label: 'Puntos de venta', render: r => r.puntosVenta || '—' },
          { key: 'faltantes', label: 'Reportes en cero', render: r => r.faltantes.length ? r.faltantes.join(', ') : '—' },
        ],
        rows: bajoVolumen,
        searchable: true,
        searchKeys: ['usuario', 'puntosVenta'],
        initialSort: { key: 'total', dir: 'asc' },
      });
      lowCard.appendChild(lowTbl);
    }
    container.appendChild(lowCard);

    // ---- Tabla pivot completa ----
    const pivotCard = UI.el('div', { class: 'card' });
    const pivotHead = UI.el('div', { class: 'card-head' }, [
      UI.el('div', {}, [
        UI.el('h3', { text: 'Relevamientos por usuario y tipo de reporte' }),
        UI.el('p', { text: 'Click en un encabezado para ordenar · las celdas en rojo indican cero cargas' }),
      ]),
      UI.el('button', {
        class: 'btn',
        text: 'Exportar incumplidores (CSV)',
        onclick: () => exportIncumplidores(incumplidoresList),
      }),
    ]);
    pivotCard.appendChild(pivotHead);

    const columns = [
      { key: 'usuario', label: 'Usuario', render: r => r.usuario },
      { key: 'puntosVenta', label: 'Puntos de venta', render: r => Array.from(r.puntosVenta).join(', ') || '—' },
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
      initialSort: { key: 'total', dir: 'asc' },
    });
    pivotCard.appendChild(tbl);
    container.appendChild(pivotCard);

    // ---- Tabla de incumplidores (reportes en cero) ----
    const incCard = UI.el('div', { class: 'card' });
    incCard.appendChild(UI.el('div', { class: 'card-head' }, [
      UI.el('div', {}, [
        UI.el('h3', { text: 'Usuarios con reportes en cero' }),
        UI.el('p', { text: 'Cargaron al menos un tipo de reporte, pero otro quedó completamente sin cargar' }),
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
          { key: 'puntosVenta', label: 'Puntos de venta', render: r => r.puntosVenta || '—' },
        ],
        rows: incumplidoresList,
        searchable: true,
        searchKeys: ['usuario', 'puntosVenta'],
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
      { label: 'Puntos de venta', value: r => r.puntosVenta },
    ]);
    UI.downloadCSV('incumplidores.csv', csv);
  }

  function exportBajoVolumen(list, umbral){
    const csv = UI.toCSV(list, [
      { label: 'Usuario', value: r => r.usuario },
      { label: 'Relevamientos', value: r => r.total },
      { label: 'Puntos de venta', value: r => r.puntosVenta },
      { label: 'Reportes en cero', value: r => r.faltantes.join(' | ') },
    ]);
    UI.downloadCSV(`usuarios_bajo_${umbral}_relevamientos.csv`, csv);
  }

  return { render };
})();
