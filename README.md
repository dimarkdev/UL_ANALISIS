# Rastreo de Campo — Cumplimiento y Quiebres

Panel web para que quien monitorea al equipo de campo pueda, cada mes, subir el
Excel de relevamiento y ver al instante:

- **Resumen**: KPIs generales (quiebre global, PDVs y productos relevados, usuarios activos, faltantes).
- **Cumplimiento**: quién cargó cada tipo de reporte y quién no, con export a CSV de incumplidores.
- **Quiebre · Punto de venta / Producto / Cadena**: % de quiebre por dimensión, ordenable y exportable.
- **Quiebre · Cadena × Categoría**: matriz cruzada con semáforo de color.

## Cómo funciona

Es un sitio **100% estático** (HTML + CSS + JS, sin backend ni base de datos).
El archivo Excel se lee y procesa **en el navegador del usuario** con la
librería [SheetJS](https://sheetjs.com/) — nunca se sube a ningún servidor.
Cada vez que alguien abre el sitio, sube su propio archivo del mes y trabaja
sobre esos datos durante la sesión. No hay histórico entre archivos (ver
"Próximos pasos" más abajo si eso es algo que van a necesitar).

## Estructura de archivo esperada

La app **detecta automáticamente** el rol de cada pestaña por sus columnas,
no por su nombre, así que sigue funcionando aunque cambie el orden de
pestañas o se agreguen nuevas:

- Se toma como **pestaña de quiebres** la primera que tenga una columna
  `Disponible` (Si/No) y no tenga columna `Usuario`. Además usa, si existen:
  `Fecha`, `Canal`, `Cluster`, `Cadena`, `Punto De Venta`/`PDV`, `Producto`,
  `Categoria`.
- Se toma como **pestaña de cumplimiento** cualquier pestaña que tenga
  columna `Usuario` (Innovaciones, Línea de góndola, Espacios adicionales,
  Materiales POP, Surtido, Precios, etc.). El nombre del reporte que se
  muestra en las tablas sale del nombre de la pestaña, quitándole el prefijo
  "Reporte de ".

Si el archivo no tiene ninguna pestaña reconocible, la app avisa qué faltó.

## Cómo desplegarlo

Al ser un sitio estático, se puede alojar en cualquier hosting de archivos
estáticos sin configuración de servidor:

**Opción rápida (gratis):**
1. Arrastrá esta carpeta a [Netlify Drop](https://app.netlify.com/drop), o
2. Subí la carpeta a un repositorio de GitHub y activá **GitHub Pages**, o
3. `npx serve .` para probarlo localmente.

**Servidor propio:** copiá la carpeta completa (`index.html`, `css/`, `js/`)
a la raíz del sitio en tu servidor Apache/Nginx/IIS — no requiere ningún
proceso corriendo, solo servir archivos estáticos. El único requisito es que
el navegador de quien lo usa tenga acceso a internet, porque `index.html`
carga la librería SheetJS desde un CDN (`cdn.jsdelivr.net`). Si tu red
corporativa bloquea CDNs externos, descargá
`https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js` y guardalo
como `js/xlsx.full.min.js`, reemplazando esa línea en `index.html` por
`<script src="js/xlsx.full.min.js"></script>`.

## Archivos

```
quiebre-dashboard/
├── index.html              estructura de la página
├── css/styles.css           estilos
└── js/
    ├── parser.js            lee el .xlsx y detecta pestañas
    ├── analysis.js           agrupaciones, filtros, escala de color
    ├── components.js         tabla ordenable/buscable, KPIs, export CSV
    ├── tab-resumen.js
    ├── tab-cumplimiento.js
    ├── tab-quiebre.js
    └── app.js                estado global y orquestación
```

## Próximos pasos posibles (no incluidos en esta versión)

- **Histórico entre meses**: hoy cada archivo se analiza solo, de forma
  aislada. Para comparar tendencias mes a mes hace falta guardar los datos
  en algún lado (backend + base de datos, o una hoja de cálculo compartida).
- **Roster de usuarios esperados**: hoy "incumplidor" significa "aparece en
  al menos un reporte pero no en todos". Si querés detectar usuarios que
  directamente no cargaron *nada* en el mes, hace falta una lista maestra de
  supervisores/promotores contra la cual comparar.
- **Autenticación**: si el link se va a compartir con más gente de la que
  debería ver estos datos, conviene ponerle login (por ejemplo con Netlify
  Identity, Auth0, o un proxy con contraseña).
