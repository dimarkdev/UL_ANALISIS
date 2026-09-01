/* ============================================================
   PESTAÑA: CUMPLIMIENTO
   Tres criterios sobre el mismo pivot Usuario x Tipo de reporte:
     1) reportes con cero cargas (faltante completo)
     2) volumen bajo de relevamientos totales
     3) cobertura baja de puntos de venta distintos visitados
   ============================================================ */

const TabCumplimiento = (() => {

  let manualUmbralVol = null;
  let manualUmbralPdv = null;

  function render(container, ctx){
    container.innerHTML = '';
    const { cumplimientoPivot, incumplidoresList, reportTypesAll, cumplimientoReportFilter, onReportFilterChange } = ctx;

    const head = UI.el('div', { class: 'panel-head' }, [
      UI.el('h2', { class: 'panel-title', text: 'Cumplimiento de carga' }),
      UI.el('p', { class: 'panel-sub', text: 'Tres formas de mirar al equipo: reportes que quedaron en cero, volumen total de relevamientos, y cantidad de puntos de venta distintos visitados. Un usuario puede tener pocos relevamientos por visitar pocos PDV, o por visitar los mismos PDV muchas veces — son cosas distintas.' }),
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
    const sugeridoVol = Analysis.sugerirUmbralBajoVolumen(cumplimientoPivot);
    const sugeridoPdv = Analysis.sugerirUmbralCobertura(cumplimientoPivot);
    const umbralVol = manualUmbralVol != null ? manualUmbralVol : sugeridoVol;
    const umbralPdv = manualUmbralPdv != null ? manualUmbralPdv : sugeridoPdv;

    const bajoVolumen = Analysis.usuariosBajoVolumen(cumplimientoPivot, umbralVol, umbralPdv);
    const bajaCobertura = Analysis.usuariosBajaCobertura(cumplimientoPivot, umbralPdv, umbralVol);
    const dobleAlerta = bajoVolumen.filter(u => u.bajaCobertura).length;

    // ---- KPIs ----
    container.appendChild(UI.el('div', { class: 'kpi-row' }, [
      UI.kpiCard('Usuarios activos', UI.fmtInt(users.length)),
      UI.kpiCard('Reportes en cero', UI.fmtInt(incumplidoresList.length), {
        tone: incumplidoresList.length ? 'bad' : 'good',
      }),
      UI.kpiCard('Volumen bajo', UI.fmtInt(bajoVolumen.length), {
        tone: bajoVolumen.length ? 'bad' : 'good',
        foot: `< ${umbralVol} relevamientos`,
      }),
      UI.kpiCard('Cobertura de PDV baja', UI.fmtInt(bajaCobertura.length), {
        tone: bajaCobertura.length ? 'bad' : 'good',
        foot: `< ${umbralPdv} PDV distintos`,
      }),
      UI.kpiCard('Bajo en ambos a la vez', UI.fmtInt(dobleAlerta), {
        tone: dobleAlerta ? 'bad' : 'good',
        foot: 'cargan poco y cubren poco',
      }),
    ]));

    // ---- Card: volumen bajo ----
    container.appendChild(buildThresholdCard({
      title: 'Usuarios con pocos relevamientos cargados',
      subtitle: `Ordenado de menor a mayor · sugerido en ${sugeridoVol} (mitad de la mediana del equipo)`,
      inputLabel: 'Menos de', inputSuffix: 'relevamientos',
      umbral: umbralVol,
      onUmbralChange: (v) => { manualUmbralVol = v; render(container, ctx); },
      rows: bajoVolumen,
      valueKey: 'total', valueLabel: 'Relevamientos',
      crossLabel: 'También baja cobertura',
      crossKey: 'bajaCobertura',
      exportName: `usuarios_bajo_${umbralVol}_relevamientos.csv`,
    }));

    // ---- Card: cobertura de PDV baja ----
    container.appendChild(buildThresholdCard({
      title: 'Usuarios que visitan menos puntos de venta',
      subtitle: `Ordenado de menor a mayor · sugerido en ${sugeridoPdv} PDV distintos (mitad de la mediana del equipo)`,
      inputLabel: 'Menos de', inputSuffix: 'PDV distintos',
      umbral: umbralPdv,
      onUmbralChange: (v) => { manualUmbralPdv = v; render(container, ctx); },
      rows: bajaCobertura,
      valueKey: 'pdvCount', valueLabel: 'PDV distintos',
      crossLabel: 'También volumen bajo',
      crossKey: 'bajoVolumen',
      exportName: `usuarios_bajo_${umbralPdv}_pdv.csv`,
    }));

    // ---- Tabla pivot completa ----
    const pivotCard = UI.el('div', { class: 'card' });
    pivotCard.appendChild(UI.el('div', { class: 'card-head' }, [
      UI.el('div', {}, [
        UI.el('h3', { text: 'Detalle completo por usuario' }),
        UI.el('p', { text: 'Click en un encabezado para ordenar · las celdas en rojo indican cero cargas' }),
      ]),
      UI.el('button', {
        class: 'btn',
        text: 'Exportar reportes en cero (CSV)',
        onclick: () => exportIncumplidores(incumplidoresList),
      }),
    ]));

    const columns = [
      { key: 'usuario', label: 'Usuario', render: r => r.usuario },
      { key: 'pdvCount', label: 'PDV distintos', align: 'right', sortValue: r => r.puntosVenta.size, render: r => UI.fmtInt(r.puntosVenta.size) },
      { key: 'diasCount', label: 'Días distintos', align: 'right', sortValue: r => r.diasVisitados.size, render: r => UI.fmtInt(r.diasVisitados.size) },
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
  }

  function buildThresholdCard({ title, subtitle, inputLabel, inputSuffix, umbral, onUmbralChange, rows, valueKey, valueLabel, crossLabel, crossKey, exportName }){
    const card = UI.el('div', { class: 'card' });
    card.appendChild(UI.el('div', { class: 'card-head' }, [
      UI.el('div', {}, [
        UI.el('h3', { text: title }),
        UI.el('p', { text: subtitle }),
      ]),
      UI.el('div', { style: 'display:flex; align-items:center; gap:10px;' }, [
        UI.el('label', { style: 'font-size:12.5px; font-weight:600; color:var(--ink-soft); display:flex; align-items:center; gap:6px;' }, [
          inputLabel,
          UI.el('input', {
            type: 'number', min: '1', value: String(umbral),
            style: 'width:52px; padding:5px 7px; border:1px solid var(--line-strong); border-radius:6px; font-family:var(--font-mono);',
            onchange: (e) => {
              const v = parseInt(e.target.value, 10);
              onUmbralChange(isNaN(v) || v < 1 ? 1 : v);
            },
          }),
          inputSuffix,
        ]),
        UI.el('button', {
          class: 'btn btn-primary',
          text: 'Exportar (CSV)',
          onclick: () => exportRows(rows, valueKey, valueLabel, exportName),
        }),
      ]),
    ]));

    if (!rows.length){
      card.appendChild(UI.el('div', { class: 'table-empty', text: 'Nadie está por debajo de ese umbral en este período. 🎉' }));
      return card;
    }

    const tbl = UI.dataTable({
      columns: [
        { key: 'usuario', label: 'Usuario', render: r => UI.el('b', { text: r.usuario }) },
        { key: valueKey, label: valueLabel, align: 'right', render: r => UI.el('span', { class: 'count-zero', text: UI.fmtInt(r[valueKey]) }) },
        { key: 'puntosVenta', label: 'Puntos de venta', render: r => r.puntosVenta || '—' },
        { key: 'cross', label: crossLabel, render: r => r[crossKey] ? UI.el('span', { class: 'badge badge-bad', text: 'Sí' }) : '—' },
        { key: 'faltantes', label: 'Reportes en cero', render: r => r.faltantes.length ? r.faltantes.join(', ') : '—' },
      ],
      rows,
      searchable: true,
      searchKeys: ['usuario', 'puntosVenta'],
      initialSort: { key: valueKey, dir: 'asc' },
    });
    card.appendChild(tbl);
    return card;
  }

  function exportRows(rows, valueKey, valueLabel, filename){
    const csv = UI.toCSV(rows, [
      { label: 'Usuario', value: r => r.usuario },
      { label: valueLabel, value: r => r[valueKey] },
      { label: 'Puntos de venta', value: r => r.puntosVenta },
      { label: 'Reportes en cero', value: r => r.faltantes.join(' | ') },
    ]);
    UI.downloadCSV(filename, csv);
  }

  function exportIncumplidores(list){
    const csv = UI.toCSV(list, [
      { label: 'Usuario', value: r => r.usuario },
      { label: 'Reportes faltantes', value: r => r.faltantes.join(' | ') },
      { label: 'Cargas totales', value: r => r.total },
      { label: 'Puntos de venta', value: r => r.puntosVenta },
    ]);
    UI.downloadCSV('reportes_en_cero.csv', csv);
  }

  return { render };
})();
