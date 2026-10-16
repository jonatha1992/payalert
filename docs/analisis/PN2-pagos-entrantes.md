# PN2 — Recepción y procesamiento de pagos

## CU-03 — Recibir, validar y procesar evento de pago

- **Actores:** EXT-01 Mercado Pago o EXT-02 Ualá Bis; EXT-05 persistencia; EXT-07 Cron/worker. ACT-01 es responsable de conectar cuenta pero no invoca evento entrante.
- **Precondiciones:** endpoint público en ambiente alcanzable; conexión asociada existe; en el worker la migración de cola está desplegada y `CRON_SECRET` configurado. Ver RN-03–RN-05, RN-11, RN-14.
- **Flujo principal:**
  1. Proveedor notifica webhook a `/api/webhooks/mercadopago` o `/api/webhooks/uala`.
  2. Handler limita tamaño/cuerpo y parsea señal.
  3. Conector MP valida firma antes de aceptar; Ualá v2 valida UUID/orden (sin afirmar firma).
  4. Evento se vincula con conexión/orden sin confiar en datos no autenticados.
  5. Se registra evento deduplicado y handler confirma ACK rápido.
  6. Cron invoca `POST /api/internal/webhook-worker` con autorización exacta.
  7. Worker toma lote con lock seguro y carga conexión/credenciales en servidor.
  8. Conector consulta API del proveedor para recuperar importe, moneda, tiempo y estado autoritativos.
  9. Normalizador produce movimiento; ingest verifica vínculo proveedor/cuenta/tenant y dedupe.
  10. Se persiste movimiento y log seguro; si hay cobro esperado compatible se aplica matching conforme RN-06/07.
  11. Se notifica a receptores permitidos; se marca evento terminado. Ante fallo se reintenta o pasa a estado final de cola según política.
- **Alternativos:** A1 evento inválido → rechazar sin encolar. A2 duplicado → ACK idempotente sin segunda notificación. A3 cuenta desconocida/conflictiva → no adivinar tenant ni asociar pago. A4 proveedor temporalmente no disponible → reintentar. A5 credencial inválida → actualización de salud/diagnóstico seguro. A6 movimiento sin cobro esperado → persistir sin asignación, si cumple las reglas del pipeline.
- **Postcondición:** movimiento único y estado consistente o evento deja evidencia de fallo recuperable/final; no se expone payload crudo. La semántica estado sigue RN-05/RN-11/RN-16.
- **Cumple:** RF-05, RF-06, RF-07, RF-14; RN-01, RN-03–RN-05, RN-09, RN-11, RN-13, RN-14, RN-16, RN-20.
- **Relaciones UML:** CU-03 «include» validación/autenticación, encolado, consulta autoritativa, ingestión; notificación se incluye al confirmarse movimiento elegible. Replay es extensión operativa excepcional, no flujo normal.

## CU-10 — Reprocesar evento DEAD

- **Actores:** ACT-01 owner; EXT-05 persistencia; EXT-07 worker.
- **Precondiciones:** evento DEAD pertenece al tenant; sesión/permiso owner; reintento explícito y auditoría activos.
- **Flujo principal:**
  1. Owner solicita replay de identificador.
  2. Servidor obtiene perfil, valida owner y tenant del evento.
  3. Evento pasa a estado reencolable de forma controlada y se audita.
  4. Worker vuelve a procesar según CU-03.
- **Alternativos:** caller no owner o tenant no coincide → negar sin cambiar evento; evento no DEAD/no existente → no reencolar.
- **Postcondición:** reintento registrado y queda sujeto a idempotencia original.
- **Cumple:** RF-07, RF-15; RN-01, RN-05, RN-11, RN-14, RN-20.
- **Relaciones UML:** CU-10 extiende CU-03 después de DEAD; no se incluye automáticamente en cada fallo.

### Evidencia
`frontend/app/api/webhooks/{mercadopago,uala}/route.ts`, `frontend/lib/server/webhookHandler.ts`, `frontend/lib/server/webhookQueue.ts`, `frontend/lib/server/webhookWorker.ts`, `frontend/app/api/internal/webhook-worker/route.ts`, `frontend/app/api/webhooks/replay/route.ts`, `frontend/lib/payments/{normalize,ingest}.ts`, `frontend/lib/server/paymentsRepository.ts`, migración `docs/migrations/010_pay14_webhook_queue.sql`. Pruebas: `frontend/tests/server/webhookHandler.test.ts`, `webhookQueue.test.ts`, `webhookWorker.test.ts`, `webhookReplay.test.ts`, `frontend/tests/integration/paymentsPipeline.test.ts`.
