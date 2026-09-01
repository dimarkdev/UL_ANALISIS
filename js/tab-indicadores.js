/* ============================================================
   PESTAÑA: OTROS INDICADORES
   Todo lo que se puede sacar de las pestañas que no son ni
   quiebre ni cumplimiento: Innovaciones, Línea de góndola,
   Espacios adicionales, Materiales POP (y Surtido/Precios el
   mes que tengan datos cargados).
   ============================================================ */

const TabIndicadores = (() => {

  function legend(){
    return UI.el('div', { class: 'scale-legend' }, [
      UI.el('span', { text: 'Peor' }),
      UI.el('span', { class: 'swatch', style: 'background:linear-gradient(90deg,#B23B32,#C98A2B,#2F7D4F)' }),
      UI.el('span', { text: 'Mejor' }),
    ]);
  }

  function render(container, ctx){
    container.innerHTML = '';
    const { indicadoresFiltered } = ctx;
    const { disponibilidad, cumplimientoItem, conteo } = indicadoresFiltered;

    container.appendChild(UI.el('div', { class: 'panel-head' }, [
      UI.el('h2', { class: 'panel-title', text: 'Otros indicadores' }),
      UI.el('p', { class: 'panel-sub', text: 'Todo lo que hay disponible en el archivo además de quiebre y cumplimiento de carga: innovaciones, espacio en góndola, espacios adicionales y materiales POP. Cada tabla explica arriba qué mide y cómo se calcula.' }),
    ]));

    if (!disponibilidad.length && !cumplimientoItem.length && !conteo.length){
      container.appendChild(UI.el('div', { class: 'card' }, UI.el('div', {
        class: 'table-empty',
        text: 'Este archivo no trae pestañas adicionales reconocibles (Innovaciones, Línea de góndola, Espacios adicionales, Materiales POP, Surtido o Precios).',
      })));
      return;
    }

    disponibilidad.forEach(sheet => renderDisponibilidad(container, sheet));
    cumplimientoItem.forEach(sheet => renderCumplimientoItem(container, sheet));
    conteo.forEach(sheet => renderConteo(container, sheet));
  }

  function pctTable(rows, dimLabel){
    if (!rows.length) return UI.el('div', { class: 'table-empty', text: 'Sin datos para este filtro.' });
    return UI.dataTable({
      columns: [
        { key: 'key', label: dimLabel, render: r => r.key },
        { key: 'pct', label: '%', align: 'right', sortValue: r => r.pct, render: r => UI.pctCell(r.pct, 0, 1, true) },
        { key: 'total', label: 'Relevamientos', align: 'right', sortValue: r => r.total, render: r => UI.fmtInt(r.total) },
      ],
      rows,
      searchable: rows.length > 8,
      searchKeys: ['key'],
      initialSort: { key: 'pct', dir: 'asc' },
    });
  }

  function renderDisponibilidad(container, sheet){
    const { label, rows } = sheet;
    const porCadena = Analysis.groupFlagPct(rows, 'cadena', 'disponibleFlag');
    const porProducto = Analysis.groupFlagPct(rows, 'producto', 'disponibleFlag');

    const card = UI.el('div', { class: 'card' });
    card.appendChild(UI.el('div', { class: 'card-head' }, [
      UI.el('div', {}, [
        UI.el('h3', { text: `${label}: % de disponibilidad` }),
        UI.el('p', { text: `Sobre cada relevamiento con columna "Disponible": % marcado como "Si", sobre el total relevado. Igual que el quiebre pero enfocado solo en los productos de esta pestaña (no en todo el surtido).` }),
      ]),
      legend(),
    ]));

    const grid = UI.el('div', { class: 'indicator-grid' });
    const colCadena = UI.el('div', { class: 'indicator-grid-col' }, [
      UI.el('div', { style: 'padding:12px 18px 0; font-size:12px; font-weight:600; color:var(--ink-soft);', text: 'Por cadena' }),
      pctTable(porCadena, 'Cadena'),
    ]);
    const colProducto = UI.el('div', {}, [
      UI.el('div', { style: 'padding:12px 18px 0; font-size:12px; font-weight:600; color:var(--ink-soft);', text: 'Por producto' }),
      pctTable(porProducto, 'Producto'),
    ]);
    grid.appendChild(colCadena);
    grid.appendChild(colProducto);
    card.appendChild(grid);
    container.appendChild(card);
  }

  function renderCumplimientoItem(container, sheet){
    const { label, rows, hasShare } = sheet;
    const porCadena = Analysis.groupFlagPct(rows, 'cadena', 'cumpleFlag');
    const porGrupo = Analysis.groupFlagPct(rows, 'grupo', 'cumpleFlag');
    const tieneGrupos = porGrupo.some(g => g.key !== '(Sin dato)');

    const card = UI.el('div', { class: 'card' });
    card.appendChild(UI.el('div', { class: 'card-head' }, [
      UI.el('div', {}, [
        UI.el('h3', { text: `${label}: % de cumplimiento` }),
        UI.el('p', { text: '% de relevamientos marcados como "Cumple: Si", sobre el total relevado.' }),
      ]),
      legend(),
    ]));

    if (tieneGrupos){
      const grid = UI.el('div', { class: 'indicator-grid' });
      grid.appendChild(UI.el('div', { class: 'indicator-grid-col' }, [
        UI.el('div', { style: 'padding:12px 18px 0; font-size:12px; font-weight:600; color:var(--ink-soft);', text: 'Por cadena' }),
        pctTable(porCadena, 'Cadena'),
      ]));
      grid.appendChild(UI.el('div', {}, [
        UI.el('div', { style: 'padding:12px 18px 0; font-size:12px; font-weight:600; color:var(--ink-soft);', text: 'Por grupo / categoría' }),
        pctTable(porGrupo, 'Grupo'),
      ]));
      card.appendChild(grid);
    } else {
      card.appendChild(UI.el('div', { style: 'padding:12px 18px 0; font-size:12px; font-weight:600; color:var(--ink-soft);', text: 'Por cadena' }));
      card.appendChild(pctTable(porCadena, 'Cadena'));
    }
    container.appendChild(card);

    // Share de góndola (solo si la pestaña lo trae, ej. Línea de góndola)
    if (hasShare){
      const shareRows = Analysis.groupAverage(rows, 'cadena', 'shareUL')
        .map(r => ({ key: r.key, pct: r.promedio, total: r.n }))
        .sort((a, b) => a.pct - b.pct);
      const shareCard = UI.el('div', { class: 'card' });
      shareCard.appendChild(UI.el('div', { class: 'card-head' }, [
        UI.el('div', {}, [
          UI.el('h3', { text: `${label}: share de espacio en góndola` }),
          UI.el('p', { text: 'Promedio de "Share UL" (centímetros lineales de Unilever ÷ centímetros lineales de la categoría) por cadena. No es cuántas veces está disponible el producto, sino cuánto espacio físico ocupa frente a la competencia.' }),
        ]),
        legend(),
      ]));
      shareCard.appendChild(pctTable(shareRows, 'Cadena'));
      container.appendChild(shareCard);
    }
  }

  function renderConteo(container, sheet){
    const { label, rows } = sheet;
    const porCadena = Analysis.groupSum(rows, 'cadena', 'cantidad');
    const porItem = Analysis.groupSum(rows, 'item', 'cantidad');

    const card = UI.el('div', { class: 'card' });
    card.appendChild(UI.el('div', { class: 'card-head' }, [
      UI.el('div', {}, [
        UI.el('h3', { text: `${label}: cantidad relevada` }),
        UI.el('p', { text: 'Suma de espacios adicionales relevados en el período (islas, puntas de góndola, laterales, etc.). No es un porcentaje — es la cantidad total conseguida, así que más es mejor.' }),
      ]),
    ]));

    const grid = UI.el('div', { class: 'indicator-grid' });
    grid.appendChild(UI.el('div', { class: 'indicator-grid-col' }, [
      UI.el('div', { style: 'padding:12px 18px 0; font-size:12px; font-weight:600; color:var(--ink-soft);', text: 'Por cadena' }),
      countTable(porCadena, 'Cadena'),
    ]));
    grid.appendChild(UI.el('div', {}, [
      UI.el('div', { style: 'padding:12px 18px 0; font-size:12px; font-weight:600; color:var(--ink-soft);', text: 'Por tipo de espacio' }),
      countTable(porItem, 'Tipo de espacio'),
    ]));
    card.appendChild(grid);
    container.appendChild(card);
  }

  function countTable(rows, dimLabel){
    if (!rows.length) return UI.el('div', { class: 'table-empty', text: 'Sin datos para este filtro.' });
    return UI.dataTable({
      columns: [
        { key: 'key', label: dimLabel, render: r => r.key },
        { key: 'total', label: 'Cantidad', align: 'right', render: r => UI.fmtInt(r.total) },
      ],
      rows,
      searchable: rows.length > 8,
      searchKeys: ['key'],
      initialSort: { key: 'total', dir: 'desc' },
    });
  }

  return { render };
})();
