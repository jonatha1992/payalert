# 02 — Requerimientos

IDs únicos y verificables. La definición vive aquí; el estado de cada requisito aparece exclusivamente en [06-trazabilidad.md](06-trazabilidad.md). La etiqueta `[Inferido]` distingue criterio derivado del comportamiento existente, no una promesa de producto.

## Requerimientos funcionales

| ID | Requisito y criterio verificable | Fuente |
|---|---|---|
| RF-01 | Autenticar al usuario mediante Supabase Auth y no continuar la operación protegida sin perfil válido. | `frontend/lib/server/session.ts:21-53`; `frontend/proxy.ts`; `docs/Ingeniería de Requerimientos.md` RF1 |
| RF-02 | Asociar conexiones de proveedor con negocio/sucursal y permitir consultar/crear/desconectar según permiso. | `frontend/app/api/integrations/route.ts`; `frontend/app/api/integrations/[id]/route.ts`; `frontend/lib/server/connections.ts`; `docs/migrations/005_payments_hardening.sql` |
| RF-03 | Completar el flujo OAuth MP con state ligado al usuario/tenant, expiración y consumo de un solo uso. | `frontend/app/api/integrations/mercadopago/route.ts`; `docs/migrations/009_pay15_mp_oauth.sql`; `docs/OAUTH_MERCADOPAGO.md`; PAY-15 |
| RF-04 | Consultar la salud de una conexión, traducir resultados a estado operacional y mostrar diagnóstico seguro. | `frontend/app/api/integrations/[id]/health/route.ts`; `frontend/lib/payments/connectionHealth.ts`; `frontend/lib/server/connections.ts`; PAY-13 |
| RF-05 | Recibir notificación; verificar autenticidad (cuando el proveedor lo soporta) antes de encolar el evento deduplicado; ACK rápido solo después de verificación y aceptación en cola. | `frontend/app/api/webhooks/mercadopago/route.ts`; `frontend/app/api/webhooks/uala/route.ts`; `frontend/lib/server/webhookHandler.ts`; `frontend/lib/payments/connectors/mercadopago.ts`; `docs/migrations/010_pay14_webhook_queue.sql`; `docs/WEBHOOKS_QUEUE.md` |
| RF-06 | Recuperar la transacción autoritativa desde API del proveedor, normalizarla e ingerirla idempotentemente. | `frontend/lib/payments/connectors/mercadopago.ts`; `frontend/lib/payments/connectors/uala.ts`; `frontend/lib/payments/normalize.ts`; `frontend/lib/payments/ingest.ts`; `frontend/lib/server/paymentsRepository.ts` |
| RF-07 | Procesar eventos en cola con exclusión/lock, reintentos y resultado final; controlar acceso al worker. | `frontend/app/api/internal/webhook-worker/route.ts`; `frontend/lib/server/webhookQueue.ts`; `frontend/lib/server/webhookWorker.ts`; `docs/migrations/010_pay14_webhook_queue.sql` |
| RF-08 | Crear, consultar, cancelar y actualizar cobros esperados dentro del ámbito autorizado. | `frontend/app/api/expected-payments/route.ts`; `frontend/app/api/expected-payments/[id]/route.ts`; `frontend/app/api/expected-payments/[id]/cancel/route.ts`; `frontend/lib/server/expectedPayments.ts` |
| RF-09 | Calcular decisión/candidatos de matching y hacer disponible evidencia de sugerencia/revisión. | `frontend/lib/payments/matching.ts`; `frontend/lib/payments/ingest.ts`; `frontend/lib/server/expectedPayments.ts`; `docs/migrations/008_pay16_match_evidence.sql`; PAY-16 |
| RF-10 | Permitir resolución manual (confirmar/descartar candidato) con permiso autorizado, persistencia y auditoría. | `frontend/app/api/expected-payments/[id]/route.ts`; `frontend/app/api/expected-payments/[id]/candidates/route.ts`; `frontend/lib/server/expectedPayments.ts`; `frontend/lib/server/audit.ts`; PAY-16 |
| RF-11 | Consultar movimientos y reportes agregados con ámbito servidor y filtros/paginación soportados. | `frontend/app/api/reports/movements/route.ts`; `frontend/app/api/reports/route.ts`; `frontend/app/api/stats/dashboard/route.ts`; `frontend/lib/reports/query.ts`; `frontend/lib/reports/dateRange.ts`; PAY-18/PAY-24 |
| RF-12 | Exportar movimientos filtrados en CSV respetando las mismas restricciones de datos. | `frontend/app/api/reports/movements/route.ts`; `frontend/hooks/useReportMovements.ts` |
| RF-13 | Leer/actualizar preferencias de canales implementados, por usuario y negocio. | `frontend/app/api/notification-preferences/route.ts`; `frontend/lib/server/notificationPreferences.ts`; `docs/migrations/006_notification_preferences.sql`; PAY-19 |
| RF-14 | Gestionar suscripción push y enviar notificaciones de pagos a destinatarios de la sucursal/negocio permitidos. | `frontend/app/api/push/subscribe/route.ts`; `frontend/app/api/push/unsubscribe/route.ts`; `frontend/lib/server/push.ts`; `frontend/lib/server/webhookHandler.ts` |
| RF-15 | Registrar acciones sensibles de negocio con actor/acción/entidad y permitir lectura autorizada de auditoría. | `frontend/lib/server/audit.ts`; `frontend/lib/server/rbac.ts`; `docs/migrations/007_pay17_rbac_audit.sql`; PAY-17 |
| RF-16 | Simular un pago solo en entorno/despliegue de desarrollo habilitado y con permiso; no habilitarlo en producción. | `frontend/app/api/dev/simulate-payment/route.ts`; `frontend/app/dashboard/terminal/page.tsx`; `frontend/proxy.ts` |
| RF-17 | Exponer la resolución/manual review de cobros esperados en la UI de terminal a los perfiles permitidos. | `frontend/app/dashboard/terminal/page.tsx`; rutas RF-08/RF-10; PAY-16 |

## Requerimientos no funcionales

| ID | Requisito verificable | Fuente |
|---|---|---|
| RNF-01 | El aislamiento de tenant y sucursal se verifica en servidor, incluso cuando se usa service role; ninguna entrada de cliente autoriza por sí misma el ámbito. | `frontend/lib/server/session.ts:10-17`; `frontend/lib/server/scope.ts`; `frontend/lib/server/connections.ts`; `docs/Ingeniería de Requerimientos.md` §3 |
| RNF-02 | Credenciales de proveedor se cifran en reposo con AEAD y no se envían al navegador ni se registran en logs. | `frontend/lib/payments/secretBox.ts`; `frontend/lib/server/connections.ts`; `scripts/payment-token-migration.mjs`; `docs/migrations/005_payments_hardening.sql` |
| RNF-03 | Eventos repetidos/concurrentes no crean más de un movimiento ni duplican avisos; preservar transición válida de estado. | `frontend/lib/payments/ingest.ts`; `frontend/lib/server/paymentsRepository.ts`; `docs/migrations/005_payments_hardening.sql`; pruebas `frontend/tests/integration/paymentsPipeline.test.ts` |
| RNF-04 | Webhook inválido o sobredimensionado no pasa al procesamiento; fallos se registran con código seguro, sin secreto/payload sensible. | `frontend/lib/server/webhookHandler.ts`; `frontend/lib/server/webhookQueue.ts`; pruebas `frontend/tests/server/webhookHandler.test.ts` |
| RNF-05 | La cola permite claim concurrente seguro y recuperación de locks expirados, con estado recuperable y telemetría consultable. | `docs/migrations/010_pay14_webhook_queue.sql`; `frontend/lib/server/webhookQueue.ts`; `frontend/lib/server/webhookWorker.ts` |
| RNF-06 | Las entradas de consulta/exportación se validan, tamaño de página acotado y resultados limitados/paginados. | `frontend/lib/reports/query.ts`; `frontend/app/api/reports/movements/route.ts`; pruebas `frontend/tests/reports/query.test.ts` |
| RNF-07 | Los fallos de proveedor y permisos se traducen a respuestas/diagnósticos sin revelar credenciales ni información de otro tenant. | `frontend/lib/payments/connectionHealth.ts`; `frontend/lib/server/session.ts`; `frontend/lib/server/connections.ts` |
| RNF-08 | Operación pública de webhook confirma recepción rápidamente al encolar, no bloqueada por llamadas proveedor/push; la entrega efectiva y objetivo de latencia requieren validación de despliegue. | `frontend/lib/server/webhookHandler.ts`; PAY-14; `[Pendiente]` evidencia de staging y SLO aprobado. |
| RNF-09 | La protección distribuida entre instancias usa RPC Supabase `rate_limit_hit` con fallback en memoria; despliegue/configuración y comportamiento ante fallos deben validarse en staging. | `frontend/lib/security/rateLimiter.ts`; `frontend/lib/security/withRateLimit.ts`; `docs/migrations/011_pay14_rate_limit.sql`; PAY-14 |
| RNF-10 | Las rutas usan sesión protegida por cookies/refresh configurado en proxy; no documentar API pública autenticada por Bearer si no existe contrato implementado. | `frontend/lib/server/session.ts`; `frontend/proxy.ts`; contraste con `docs/API_Documentation.md` |

## Trazabilidad

La fuente normativa de estados, implementación verificable, ruta, test y Jira está en [06-trazabilidad.md](06-trazabilidad.md). Las reglas referidas se identifican como RN en [03](03-reglas-de-negocio.md); no repetir sus definiciones aquí.
