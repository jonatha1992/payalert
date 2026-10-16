# PN4 — Reportes, movimientos, exportación y analítica

## CU-06 — Consultar movimientos/reportes y exportar CSV

- **Actores:** ACT-01 owner, ACT-02 manager; ACT-04 support según RBAC objetivo; EXT-05 DB.
- **Precondiciones:** sesión y permiso `report:read` o `movement:read`; ámbito resuelto y sucursal dentro del negocio; parámetros validados según endpoint.
- **Flujo principal:**
  1. Actor abre `/dashboard/reports` o dashboard.
  2. UI consulta `/api/reports`, `/api/stats/dashboard` o `/api/reports/movements`.
  3. El servidor aplica tenant/rol/sucursal antes de consultar la base.
  4. Usuario selecciona filtros admitidos, paginación y orden mostrado.
  5. Servidor valida y limita parámetros, consulta datos y devuelve totales/páginas.
  6. Para CSV, UI pide `format=csv`; servidor arma descarga de los resultados permitidos.
- **Alternativos:** rango o filtro inválido → 400; scope no autorizado → 401/403; página excede límites → rechazo o límite explícito; consulta sin resultados → estado vacío.
- **Postcondición:** datos agregados o movimientos filtrados se muestran/descargan; no cambia estado financiero.
- **Cumple:** RF-11, RF-12; RN-01, RN-02, RN-20.
- **Relaciones UML:** CU-06 «include» autorización y validación de filtros; export CSV es extensión opcional de la consulta. No hay evidencia de Excel/PDF implementado en endpoint actual.

### Evidencia
`frontend/app/dashboard/reports/page.tsx`, `frontend/app/dashboard/page.tsx`, `frontend/hooks/useReportMovements.ts`, `frontend/app/api/reports/route.ts`, `frontend/app/api/reports/movements/route.ts`, `frontend/app/api/stats/dashboard/route.ts`, `frontend/lib/reports/query.ts`, `frontend/lib/reports/dateRange.ts`; pruebas `frontend/tests/reports/query.test.ts` y `dateRange.test.ts`. Contradicciones de especificación documental en [00](00-descripcion-global.md#mapa-de-documentos-fuentes-duplicados-y-consolidación-propuesta) y análisis de PAY-18/PAY-24 en [07](07-redundancias-y-viabilidad.md).
