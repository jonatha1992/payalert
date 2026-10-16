# PN3 — Cobros esperados, matching y resolución en caja

## CU-04 — Crear y gestionar cobro esperado

- **Actores:** ACT-01 dueño, ACT-02 manager si autorizado, ACT-03 cajero para crear; EXT-01/EXT-02 para checkout si está conectado.
- **Precondiciones:** usuario autenticado; `charge:create` en crear; tenant/sucursal validado; importe positivo y moneda/referencia validados por servicio; disponibilidad de conexión al crear checkout externo.
- **Flujo principal:**
  1. Actor abre terminal `/dashboard/terminal`.
  2. Elige importe, referencia opcional y proveedor/conexión según permiso.
  3. UI envía `POST /api/expected-payments`.
  4. Servidor valida scope, sucursal y datos; persiste cobro esperado.
  5. Si se pidió checkout, connector crea orden/link y se persisten provider/order/url.
  6. La UI muestra cobro, estado, link/QR cuando corresponda y acciones permitidas.
- **Alternativos:** inválido → errores de validación; sin conexión compatible → indicar que se conecte proveedor o usar flujo sin checkout soportado; cancelación permitida → `POST .../{id}/cancel`; expirado → no se interpreta como pagado.
- **Postcondición:** cobro queda en estado inicial o cancelado; no crea movimiento hasta notificación/ingestión autorizada.
- **Cumple:** RF-08, RF-17; RN-01, RN-02, RN-10, RN-12.
- **Relaciones UML:** CU-04 «include» validar scope; checkout es flujo opcional, no requerido para registrar la expectativa.

## CU-05 — Resolver sugerencia o revisión manual

- **Actores:** ACT-01 owner, ACT-02 manager por RBAC, ACT-03 cashier según permiso `charge:resolve`; ACT-04 support solo definido como rol objetivo aún no asignable; EXT-05 DB.
- **Precondiciones:** candidato y cobro pertenecen al mismo tenant/sucursal; cobro en estado revisable; movimiento no asignado previamente; permiso; evidencia visible conforme privacidad.
- **Flujo principal:**
  1. Evento procesado por CU-03 encuentra candidato SUGGESTED o ambigüedad.
  2. UI consulta cobro/candidatos mediante `/api/expected-payments/{id}` y `/candidates`.
  3. Cajero/actor compara importe, moneda, ventana, referencia y proveedor mostrados; no se inventa identidad del pagador.
  4. Actor confirma vínculo mediante `PATCH /api/expected-payments/{id}` o descarta candidato mediante `DELETE .../{id}/candidates`.
  5. Servidor valida permisos, tenant, estado y unicidad; persiste evidencia/resultado y auditoría.
  6. Terminal actualiza el cobro y el movimiento.
- **Alternativos:** candidato ya asignado o estado cambió concurrentemente → rechazar y recargar; más de un candidato → seguir revisión, nunca elegir arbitrariamente; usuario fuera de tienda/tenant → negar; no existe confianza → dejar sin resolver.
- **Postcondición:** un único cobro esperado asociado (o candidato descartado); la decisión manual es auditable.
- **Cumple:** RF-09, RF-10, RF-17; RN-01, RN-02, RN-06, RN-07, RN-10, RN-20.
- **Relaciones UML:** CU-05 «include» obtener evidencia y comprobar unicidad; CU-05 extiende CU-03 cuando matching automático no alcanza criterio de autoasignación.

### Evidencia
`frontend/app/dashboard/terminal/page.tsx`, `frontend/app/api/expected-payments/route.ts`, `frontend/app/api/expected-payments/[id]/route.ts`, `frontend/app/api/expected-payments/[id]/cancel/route.ts`, `frontend/app/api/expected-payments/[id]/candidates/route.ts`, `frontend/lib/server/expectedPayments.ts`, `frontend/lib/payments/matching.ts`; migraciones `005_payments_hardening.sql`, `008_pay16_match_evidence.sql`. Tests `frontend/tests/payments/matching.test.ts`, `matchCandidatePersistence.test.ts`, `frontend/tests/integration/paymentsPipeline.test.ts` y `frontend/tests/server/manualResolutionAudit.test.ts`.
