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

## CU-11 — Sincronizar manualmente una conexión

- **Actores:** ACT-01 dueño; ACT-02 gerente cuando RBAC autoriza. EXT-01 Mercado Pago (API de pagos); EXT-05 persistencia.
- **Objetivo:** consultar transacciones recientes de una conexión y procesar las que no se habían ingerido.
- **Precondiciones:** sesión válida, permiso `connection:update`, conexión activa del negocio y conector con consulta reciente.
- **Flujo principal:** actor solicita `POST /api/integrations/{id}/sync`; servidor valida permiso/tenant, consulta el proveedor, normaliza e ingiere cada transacción con el pipeline idempotente; registra fuente/fecha del chequeo, auditoría y resultado resumido.
- **Alternativos/excepciones:** error de proveedor → respuesta segura 502; fallo de ingestión → respuesta segura 500; conexión fuera del tenant/sin soporte → denegar; pago repetido → idempotencia no genera un segundo movimiento.
- **Postcondición:** transacciones revisadas quedan procesadas o duplicadas; no se altera credencial desde cliente.
- **Cumple:** RF-18; RN-01, RN-05, RN-16.

## CU-12 — Sincronizar automáticamente conexiones MP

- **Actores:** EXT-07 proceso disparador; EXT-01 Mercado Pago; EXT-05 persistencia. El endpoint no es un actor humano.
- **Precondiciones:** `CRON_SECRET` configurado; conexión MP `CONNECTED` o `DEGRADED`; credenciales vigentes o refresh OAuth disponible.
- **Flujo principal:** el disparador llama `GET/POST /api/internal/sync-connections`; servidor autoriza secreto, selecciona hasta 20 conexiones activas por última sincronización, renueva token OAuth que vence dentro de 5 min, consulta ventana reciente/cursor y limita la corrida a 45 s; procesa resultados e informa contadores.
- **Alternativos/excepciones:** secreto ausente/incorrecto → no ejecutar; fallo aislado de conexión → contabilizar fallo y continuar; refresh rechazado → marcar `REAUTH_REQUIRED`; exceder presupuesto → conexiones restantes omitidas.
- **Postcondición:** se actualiza última consulta/fuente; repetición de ejecución no duplica movimientos.
- **Cumple:** RF-19; RN-05, RN-21.
- **[Pendiente]** La frecuencia de ejecución operativa y el SLA de latencia no se deducen de la ruta; se decide en [99](99-pendientes.md).

### Consulta de transferencia común

Las transferencias comunes CVU/alias de MP no producen IPN/webhook utilizable según la evidencia PAY-11/36. El conector consulta `/v1/payments/search`; `operation_type=account_fund` y `payment_type_id=bank_transfer` son la clasificación observada en la prueba reportada del 2026-10-19. Una transferencia de $100 fue detectada por consulta y no hubo evento: `webhook_events=0`. Esta prueba reportada no está respaldada por fixture/test versionado en este paquete. La regla de exclusión y etiqueta se referencia por RN-21; cobertura basada en pocos casos queda `[Inferido]`.


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

## CU-10 — Reprocesar evento DEAD

- **Actores:** ACT-01 owner; EXT-05 persistencia; EXT-07 worker.
- **Precondiciones:** evento DEAD pertenece al tenant; sesión/permiso owner; reintento explícito y auditoría activos.
- **Flujo principal:** owner solicita replay; servidor valida owner/tenant, reencola de forma controlada y audita; worker procesa conforme CU-03.
- **Alternativos:** caller no owner o tenant no coincide → denegar; evento no DEAD/no existente → no reencolar.
- **Postcondición:** reintento registrado, sujeto a idempotencia original.
- **Cumple:** RF-07, RF-15; RN-01, RN-05, RN-11, RN-14, RN-20.

### Consulta de transferencia común

Las transferencias comunes CVU/alias de MP no producen IPN/webhook utilizable según evidencia PAY-11/36. El conector consulta `/v1/payments/search`; `operation_type=account_fund` y `payment_type_id=bank_transfer` son la clasificación observada en la prueba reportada del 2026-10-19. Una transferencia de $100 fue detectada por consulta y no hubo evento (`webhook_events=0`). La prueba reportada no está respaldada por fixture/test versionado en este paquete; cobertura basada en pocos casos queda `[Inferido]`. Regla referenciada por RN-21.

## CU-11 — Aviso rápido del celular Android

- **Actores:** ACT-03 usuario/cliente Android; EXT-05 persistencia; EXT-01 Mercado Pago como fuente posterior autoritativa.
- **Precondiciones:** permiso de acceso a notificaciones activado explícitamente en Android; sesión activa para subir avisos.
- **Flujo principal:** servicio nativo filtra notificación MP, conserva aviso local en cola acotada, aplicación envía pista a `POST /api/mobile/payment-hints`; servidor valida sesión/negocio y payload, guarda `PENDING`; al ingresar pago MP confirmado `bank_transfer`, intenta conciliar por importe exacto y ±10 min; solo coincidencia única pasa a conciliada. La pista no suma a totales.
- **Alternativos:** aviso inválido/no soportado → descartar; duplicado → no crear nueva pista; subida offline → conservar en cola local hasta reintento; candidato ambiguo/sin pago → dejar pendiente para revisión/expiración según política.
- **Postcondición:** nunca se comunica confirmación de dinero basándose solo en texto notificado; la decisión autoritativa se toma en servidor.
- **Cumple:** RF-20/RF-21; RN-22.
- **Seguridad:** una notificación puede falsificarse; permisos del sistema operativo y visibilidad dependen del dispositivo. App iOS no soportada. No probado físicamente, estado 🟡.

### Evidencia
`frontend/app/api/mobile/payment-hints/route.ts`; `frontend/lib/payments/notificationParser.ts`; `frontend/lib/payments/notificationHintReconciliation.ts`; `mobile/modules/notification-listener/android/src/main/java/com/tecnofusion/payalert/notifications/PayAlertNotificationListenerService.kt`; `mobile/app/payment-hints.tsx`; `docs/mobile/NOTIFICATION_HINTS.md`.

### Evidencia de CU-03
`frontend/app/api/webhooks/{mercadopago,uala}/route.ts`, `frontend/lib/server/webhookHandler.ts`, `frontend/lib/server/webhookQueue.ts`, `frontend/lib/server/webhookWorker.ts`, `frontend/app/api/internal/webhook-worker/route.ts`, `frontend/app/api/webhooks/replay/route.ts`, `frontend/lib/payments/{normalize,ingest}.ts`, `frontend/lib/server/paymentsRepository.ts`, migración `docs/migrations/010_pay14_webhook_queue.sql`. Pruebas: `frontend/tests/server/webhookHandler.test.ts`, `webhookQueue.test.ts`, `webhookWorker.test.ts`, `webhookReplay.test.ts`, `frontend/tests/integration/paymentsPipeline.test.ts`.
