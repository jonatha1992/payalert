# PN6 — Administración, roles y auditoría

## CU-08 — Aplicar permisos en operaciones de administración

- **Actores:** ACT-01 dueño, ACT-02 gerente/admin legacy, ACT-03 cajero; ACT-04 soporte aún no asignable.
- **Precondiciones:** sesión válida, perfil conocido; acción debe tener permiso en RBAC y ámbito tenant/sucursal resuelto.
- **Flujo principal:**
  1. Actor inicia operación en su pantalla/API.
  2. Ruta lee sesión mediante `getSessionProfile`.
  3. Ruta valida acción/recurso con RBAC o control específico documentado.
  4. Resuelve business/sucursal usando scope server-side y comprueba pertenencia.
  5. Ejecuta lectura/cambio con tenant explícito, persiste auditoría cuando acción sensible lo contempla.
  6. Devuelve respuesta limitada al permiso y dominio autorizado.
- **Alternativos:** perfil desconocido, rol inválido, usuario anónimo, acción no autorizada o business/store discrepante → error 401/403/400 y sin efecto.
- **Postcondición:** lectura/cambio autorizado o rechazo sin side effect.
- **Cumple:** RF-01, RF-02, RF-08, RF-10, RF-15, RF-16; RN-01, RN-02, RN-14, RN-20.
- **Relaciones UML:** «include» sesión, permiso y resolución de scope en operaciones protegidas; no se modela gestión de invitaciones/roles como CU implementado porque las rutas correspondientes no se encontraron en `frontend/app/api`.

## CU-09 — Registrar y consultar auditoría

- **Actores:** ACT-01/ACT-02 para ver información de su ámbito; ACT-04 soporte solo si autenticación/permiso se habilitan; EXT-05 DB.
- **Precondiciones:** evento sensible tiene actor/tenant/acción/entidad; lectura requiere permiso y RLS.
- **Flujo principal:**
  1. Acción sensible llama writer común `recordAuditEvent`.
  2. El writer inserta registro con tenant, user, acción, tipo/ID entidad y datos permitidos.
  3. La política RLS permite leer solo roles/negocios autorizados.
- **Alternativos:** escritura no debe convertir éxito en exposición de secreto; error de persistencia se maneja según acción y su criticidad [Pendiente: política uniforme]. Datos sensibles se excluyen o se redaccionan.
- **Postcondición:** evento consultable dentro de política, o falla controlada; no se amplía por sí sola la autorización de acción.
- **Cumple:** RF-15; RN-01, RN-02, RN-20.
- **Relaciones UML:** CU-09 «include» en acciones que llaman el writer; no todas las vistas o acciones del sistema se asumen auditadas.

### Evidencia
`frontend/lib/server/rbac.ts`, `frontend/lib/server/scope.ts`, `frontend/lib/server/session.ts`, `frontend/lib/server/audit.ts`, migración `docs/migrations/007_pay17_rbac_audit.sql`, `docs/migrations/008_pay16_match_evidence.sql`, pruebas `frontend/tests/server/rbac.test.ts`, `scope.test.ts`, `manualResolutionAudit.test.ts`. El endpoint de administración de usuarios/roles no se verificó; ver [07](07-redundancias-y-viabilidad.md).
