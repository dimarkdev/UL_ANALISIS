/* ============================================================
   APP — estado global, filtros, carga de archivo y ruteo de
   pestañas
   ============================================================ */

(() => {
  const state = {
    parsed: null,          // { quiebre, cumplimiento, warnings }
    fileName: '',
    activeTab: 'resumen',
    filters: { from: null, to: null, cadenas: new Set(), canales: new Set(), clusters: new Set() },
    cumplimientoReportFilter: null,
  };

  const $ = sel => document.querySelector(sel);

  const uploadScreen = $('#uploadScreen');
  const mainScreen = $('#mainScreen');
  const fileInput = $('#fileInput');
  const dropZone = $('#dropZone');
  const uploadStatus = $('#uploadStatus');
  const fileChip = $('#fileChip');
  const filterBar = $('#filterBar');

  const panels = {
    resumen: $('#panel-resumen'),
    cumplimiento: $('#panel-cumplimiento'),
    'quiebre-pdv': $('#panel-quiebre-pdv'),
    'quiebre-producto': $('#panel-quiebre-producto'),
    'quiebre-cadena': $('#panel-quiebre-cadena'),
    'quiebre-categoria': $('#panel-quiebre-categoria'),
    indicadores: $('#panel-indicadores'),
  };

  /* ---------------- Carga de archivo ---------------- */

  function setStatus(msg, tone){
    uploadStatus.textContent = msg;
    uploadStatus.className = 'upload-status' + (tone ? ' ' + tone : '');
  }

  async function handleFile(file){
    if (!file) return;
    if (!/\.(xlsx|xls)$/i.test(file.name)){
      setStatus('Ese archivo no parece un Excel (.xlsx). Probá con otro.', 'error');
      return;
    }
    setStatus('Leyendo ' + file.name + '…', '');
    try {
      const buf = await file.arrayBuffer();
      const parsed = Parser.parseWorkbook(buf);
      if (!parsed.quiebre && !parsed.cumplimiento){
        setStatus('No se reconoció ninguna pestaña de quiebre o cumplimiento en este archivo.', 'error');
        return;
      }
      state.parsed = parsed;
      state.fileName = file.name;
      state.filters = { from: null, to: null, cadenas: new Set(), canales: new Set(), clusters: new Set() };
      state.cumplimientoReportFilter = null;
      state.activeTab = 'resumen';
      if (parsed.warnings.length) setStatus(parsed.warnings.join(' '), 'error');
      showMainScreen();
    } catch (err){
      console.error(err);
      setStatus('No se pudo leer el archivo. Verificá que sea un .xlsx válido.', 'error');
    }
  }

  fileInput.addEventListener('change', e => handleFile(e.target.files[0]));
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    handleFile(e.dataTransfer.files[0]);
  });

  $('#changeFileBtn').addEventListener('click', () => {
    mainScreen.classList.add('hidden');
    uploadScreen.classList.remove('hidden');
    fileInput.value = '';
    setStatus('', '');
  });

  /* ---------------- Navegación de pestañas ---------------- */

  document.querySelectorAll('.rail-item').forEach(btn => {
    btn.addEventListener('click', () => {
      state.activeTab = btn.dataset.tab;
      document.querySelectorAll('.rail-item').forEach(b => b.classList.toggle('active', b === btn));
      renderPanels();
    });
  });

  /* ---------------- Filtros globales ---------------- */

  function allSourceRows(){
    const qRows = state.parsed.quiebre ? state.parsed.quiebre.rows : [];
    const cRecords = state.parsed.cumplimiento ? state.parsed.cumplimiento.records : [];
    const ind = state.parsed.indicadores || { disponibilidad: [], cumplimientoItem: [], conteo: [] };
    const indRows = [].concat(
      ...ind.disponibilidad.map(s => s.rows),
      ...ind.cumplimientoItem.map(s => s.rows),
      ...ind.conteo.map(s => s.rows)
    );
    return qRows.concat(cRecords, indRows);
  }

  function buildFilterBar(){
    filterBar.innerHTML = '';
    const all = allSourceRows();
    const cadenaOpts = Analysis.distinctValues(all, 'cadena');
    const canalOpts = Analysis.distinctValues(all, 'canal');
    const clusterOpts = Analysis.distinctValues(all, 'cluster');

    // Nota: es un filtro de selección única por ahora (guardado en un Set
    // para poder ampliarlo a múltiple selección más adelante sin tocar Analysis.filterRows).
    function multiSelect(label, options, selectedSet, onChange){
      const sel = UI.el('select', {
        class: 'filter-select',
        onchange: (e) => {
          const v = e.target.value;
          if (v === '__ALL__') selectedSet.clear();
          else { selectedSet.clear(); selectedSet.add(v); }
          onChange();
        },
      }, [
        UI.el('option', { value: '__ALL__', text: `${label}: Todas` }),
        ...options.map(o => UI.el('option', { value: o, text: o, selected: selectedSet.has(o) ? 'selected' : null })),
      ]);
      return sel;
    }

    if (cadenaOpts.length > 1) filterBar.appendChild(multiSelect('Cadena', cadenaOpts, state.filters.cadenas, onFiltersChanged));
    if (canalOpts.length > 1) filterBar.appendChild(multiSelect('Canal', canalOpts, state.filters.canales, onFiltersChanged));
    if (clusterOpts.length > 1) filterBar.appendChild(multiSelect('Cluster', clusterOpts, state.filters.clusters, onFiltersChanged));

    const { min, max } = Analysis.dateExtent(all);
    if (min && max){
      const fromInput = UI.el('input', {
        type: 'date', class: 'filter-select', style: 'padding:6px 10px;',
        value: state.filters.from ? isoDate(state.filters.from) : '',
        onchange: e => { state.filters.from = e.target.value ? new Date(e.target.value) : null; onFiltersChanged(); },
      });
      const toInput = UI.el('input', {
        type: 'date', class: 'filter-select', style: 'padding:6px 10px;',
        value: state.filters.to ? isoDate(state.filters.to) : '',
        onchange: e => { state.filters.to = e.target.value ? new Date(e.target.value) : null; onFiltersChanged(); },
      });
      filterBar.appendChild(UI.el('span', { style: 'font-size:12px; color:var(--ink-soft);', text: 'Desde' }));
      filterBar.appendChild(fromInput);
      filterBar.appendChild(UI.el('span', { style: 'font-size:12px; color:var(--ink-soft);', text: 'hasta' }));
      filterBar.appendChild(toInput);
    }

    filterBar.appendChild(UI.el('button', {
      class: 'filter-reset', text: 'Limpiar filtros',
      onclick: () => {
        state.filters = { from: null, to: null, cadenas: new Set(), canales: new Set(), clusters: new Set() };
        buildFilterBar();
        renderPanels();
      },
    }));
  }

  function isoDate(d){
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  function onFiltersChanged(){
    renderPanels();
  }

  /* ---------------- Render principal ---------------- */

  function showMainScreen(){
    uploadScreen.classList.add('hidden');
    mainScreen.classList.remove('hidden');
    fileChip.innerHTML = '';
    fileChip.appendChild(UI.el('span', { class: 'dot' }));
    fileChip.appendChild(UI.el('span', {}, [document.createTextNode('Archivo: '), UI.el('b', { text: state.fileName })]));
    buildFilterBar();
    document.querySelectorAll('.rail-item').forEach(b => b.classList.toggle('active', b.dataset.tab === 'resumen'));
    renderPanels();
  }

  function buildContext(){
    const quiebreRows = state.parsed.quiebre ? state.parsed.quiebre.rows : [];
    const quiebreFiltered = Analysis.filterRows(quiebreRows, state.filters);

    let cumplimientoPivot = null, incumplidoresList = [], reportTypesAll = [];
    if (state.parsed.cumplimiento){
      reportTypesAll = state.parsed.cumplimiento.reportTypes;
      let records = Analysis.filterRows(state.parsed.cumplimiento.records, state.filters);
      let reportTypes = reportTypesAll;
      if (state.cumplimientoReportFilter){
        records = records.filter(r => r.reporte === state.cumplimientoReportFilter);
        reportTypes = [state.cumplimientoReportFilter];
      }
      cumplimientoPivot = Analysis.pivotCumplimiento(records, reportTypes);
      incumplidoresList = Analysis.incumplidores(cumplimientoPivot);
    }

    const indRaw = state.parsed.indicadores || { disponibilidad: [], cumplimientoItem: [], conteo: [] };
    const indicadoresFiltered = {
      disponibilidad: indRaw.disponibilidad.map(s => ({ ...s, rows: Analysis.filterRows(s.rows, state.filters) })),
      cumplimientoItem: indRaw.cumplimientoItem.map(s => ({ ...s, rows: Analysis.filterRows(s.rows, state.filters) })),
      conteo: indRaw.conteo.map(s => ({ ...s, rows: Analysis.filterRows(s.rows, state.filters) })),
    };

    return {
      quiebreFiltered,
      cumplimientoPivot,
      incumplidoresList,
      reportTypesAll,
      cumplimientoReportFilter: state.cumplimientoReportFilter,
      onReportFilterChange: (v) => { state.cumplimientoReportFilter = v; renderPanels(); },
      filters: state.filters,
      indicadoresFiltered,
    };
  }

  function renderPanels(){
    if (!state.parsed) return;
    Object.entries(panels).forEach(([key, node]) => node.classList.toggle('hidden', key !== state.activeTab));
    const ctx = buildContext();

    switch (state.activeTab){
      case 'resumen':
        TabResumen.render(panels.resumen, ctx);
        break;
      case 'cumplimiento':
        TabCumplimiento.render(panels.cumplimiento, ctx);
        break;
      case 'quiebre-pdv':
        TabQuiebre.renderGroup(panels['quiebre-pdv'], ctx, {
          dimKey: 'puntoVenta', dimLabel: 'Punto de venta',
          title: 'Quiebre por punto de venta',
          sub: 'Porcentaje de relevamientos donde el producto no estaba disponible, por punto de venta.',
        });
        break;
      case 'quiebre-producto':
        TabQuiebre.renderGroup(panels['quiebre-producto'], ctx, {
          dimKey: 'producto', dimLabel: 'Producto',
          title: 'Quiebre por producto',
          sub: 'Porcentaje de relevamientos donde el producto no estaba disponible, por SKU.',
        });
        break;
      case 'quiebre-cadena':
        TabQuiebre.renderGroup(panels['quiebre-cadena'], ctx, {
          dimKey: 'cadena', dimLabel: 'Cadena',
          title: 'Quiebre por cadena',
          sub: 'Porcentaje de relevamientos donde el producto no estaba disponible, por cadena.',
        });
        break;
      case 'quiebre-categoria':
        TabQuiebre.renderCategoria(panels['quiebre-categoria'], ctx);
        break;
      case 'indicadores':
        TabIndicadores.render(panels.indicadores, ctx);
        break;
    }
  }
})();
