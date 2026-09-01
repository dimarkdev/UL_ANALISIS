/* ============================================================
   PESTAÑA: RESUMEN
   ============================================================ */

const TabResumen = (() => {

  function render(container, ctx){
    container.innerHTML = '';
    const { quiebreFiltered, cumplimientoPivot, incumplidoresList, filters } = ctx;

    container.appendChild(UI.el('div', { class: 'panel-head' }, [
      UI.el('h2', { class: 'panel-title', text: 'Resumen del período' }),
      UI.el('p', { class: 'panel-sub', text: 'Vista general de disponibilidad de producto y carga de relevamientos por el equipo de campo, según los filtros activos.' }),
    ]));

    // ---- KPIs ----
    const totalRegistros = quiebreFiltered.length;
    const totalQuiebres = quiebreFiltered.reduce((a, r) => a + r.quiebre, 0);
    const pctQuiebreGlobal = totalRegistros ? totalQuiebres / totalRegistros : null;
    const pdvsUnicos = new Set(quiebreFiltered.map(r => r.puntoVenta)).size;
    const productosUnicos = new Set(quiebreFiltered.map(r => r.producto)).size;
    const usuariosActivos = cumplimientoPivot ? cumplimientoPivot.users.length : 0;
    const usuariosIncompletos = incumplidoresList ? incumplidoresList.length : 0;

    const kpiRow = UI.el('div', { class: 'kpi-row' }, [
      UI.kpiCard('% de quiebre global', UI.fmtPct(pctQuiebreGlobal), {
        tone: pctQuiebreGlobal == null ? '' : (pctQuiebreGlobal < 0.15 ? 'good' : pctQuiebreGlobal >= 0.35 ? 'bad' : ''),
        foot: `${UI.fmtInt(totalQuiebres)} de ${UI.fmtInt(totalRegistros)} relevamientos`,
      }),
      UI.kpiCard('Puntos de venta relevados', UI.fmtInt(pdvsUnicos)),
      UI.kpiCard('Productos relevados', UI.fmtInt(productosUnicos)),
      UI.kpiCard('Usuarios activos', UI.fmtInt(usuariosActivos), { foot: 'con al menos un reporte cargado' }),
      UI.kpiCard('Usuarios con reportes faltantes', UI.fmtInt(usuariosIncompletos), {
        tone: usuariosIncompletos ? 'bad' : 'good',
        foot: cumplimientoPivot ? `de ${cumplimientoPivot.reportTypes.length} tipos de reporte` : '',
      }),
    ]);
    container.appendChild(kpiRow);

    // ---- Peores 5 cadenas ----
    if (quiebreFiltered.length){
      const byCadena = Analysis.groupQuiebre(quiebreFiltered, 'cadena')
        .sort((a, b) => b.pct - a.pct).slice(0, 5);
      const card1 = UI.el('div', { class: 'card' }, [
        UI.el('div', { class: 'card-head' }, [
          UI.el('div', {}, [
            UI.el('h3', { text: 'Cadenas con mayor quiebre' }),
            UI.el('p', { text: 'Top 5 según el filtro activo' }),
          ]),
        ]),
      ]);
      const tbl = UI.dataTable({
        columns: [
          { key: 'key', label: 'Cadena', render: r => r.key },
          { key: 'pct', label: '% quiebre', align: 'right', render: r => UI.pctCell(r.pct, 0, 1) },
          { key: 'total', label: 'Relevamientos', align: 'right', render: r => UI.fmtInt(r.total) },
        ],
        rows: byCadena,
        initialSort: { key: 'pct', dir: 'desc' },
      });
      card1.appendChild(tbl);
      container.appendChild(card1);
    }

    // ---- Cumplimiento por tipo de reporte ----
    if (cumplimientoPivot && cumplimientoPivot.reportTypes.length){
      const totals = cumplimientoPivot.reportTypes.map(rt => {
        const conCarga = cumplimientoPivot.users.filter(u => u.byReport[rt]).length;
        return { reporte: rt, conCarga, sinCarga: cumplimientoPivot.users.length - conCarga };
      });
      const card2 = UI.el('div', { class: 'card' }, [
        UI.el('div', { class: 'card-head' }, [
          UI.el('div', {}, [
            UI.el('h3', { text: 'Cobertura por tipo de reporte' }),
            UI.el('p', { text: 'Usuarios que cargaron cada tipo de reporte, sobre el total de usuarios activos' }),
          ]),
        ]),
      ]);
      const tbl2 = UI.dataTable({
        columns: [
          { key: 'reporte', label: 'Reporte', render: r => r.reporte },
          { key: 'conCarga', label: 'Con carga', align: 'right', render: r => UI.fmtInt(r.conCarga) },
          { key: 'sinCarga', label: 'Sin carga', align: 'right', render: r => UI.el('span', { class: r.sinCarga ? 'count-zero' : '', text: UI.fmtInt(r.sinCarga) }) },
        ],
        rows: totals,
        initialSort: { key: 'sinCarga', dir: 'desc' },
      });
      card2.appendChild(tbl2);
      container.appendChild(card2);
    }
  }

  return { render };
})();
