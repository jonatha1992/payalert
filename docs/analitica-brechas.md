# Brechas de analítica vs. PRD 23/43

## Base verificable

En `docs/Ingeniería de Requerimientos.md`, la analítica tiene que filtrar el dashboard por rol (RF3); el dueño puede ver balances totales y el empleado solo ingresos de su tienda asignada (RF1). El PRD disponible no especifica métricas por proveedor, moneda o un formato de exportación. No encontré documentos identificados como PRD 23 o PRD 43 en `docs/`; por ello, esos detalles no se pueden atribuir como requisitos textuales y se registran como faltantes por validar.

El dashboard ya ofrece resumen de ingresos/gastos, tendencias, movimientos recientes y agregación por sucursal (`/api/stats/dashboard`). Reportes existentes permiten agrupar por día/semana/mes/sucursal/categoría, filtrar fechas y sucursal, y presentar promedios/categorías (`/api/reports`). El reporte de movimientos ya soporta filtros y descarga CSV (`/api/reports/movements`).

## Brechas priorizadas y estado

1. **Límites del rango por día local y zona horaria AR** — implementada en estadísticas y reportes. Los rangos inclusivos se convierten a instantes UTC con `America/Argentina/Buenos_Aires`, evitando depender de la zona del servidor y cubriendo todo el último día.
2. **Exportación Excel** — implementada en movimientos usando la dependencia `xlsx` ya presente. Conserva los filtros y permisos del CSV, y exporta las columnas retornadas por el endpoint sin crear una vista duplicada.
3. **Métricas por proveedor / moneda** — pendiente. El reporte actual filtra y agrupa por categorías/sucursal, pero no ofrece desglose por proveedor o moneda; falta confirmar el alcance esperado y la semántica de importes multidivisa antes de consolidar totales.
4. **Agregaciones por operación** — parcialmente cubiertas por totales, conteos y filtros de tipo/estado en movimientos; no hay breakdown dedicado por operación/proveedor. No se duplicó la UI existente.
5. **Validación de requisitos PRD 23/43** — pendiente obtener esos documentos. La búsqueda en `docs/` no encontró especificaciones identificadas como 23/43; se usó el documento de requerimientos disponible como evidencia.

## Seguridad y límites

Ambos endpoints conservan `requirePermission` y `resolveScope`; el Excel se genera sobre el mismo endpoint protegido de movimientos, respetando negocio y sucursal asignada. Validaciones realizadas exclusivamente con tests y mocks locales; no se consultaron bases de datos ni servicios reales.
