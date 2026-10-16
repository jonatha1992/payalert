# 06 — Matriz de trazabilidad

Estados se declaran **solo aquí**: ✅ implementado en código observado; 🟡 parcial o dependiente de validación/configuración externa; ⬜ no implementado o sin evidencia de código. Estos estados no equivalen a staging/prod/aceptación. CU y reglas se enlazan por ID.

| Req | Estado | CU | Pantalla | Ruta API | Archivo de código principal | Tests verificados | Ticket |
|---|---|---|---|---|---|---|---|
| RF-01 | ✅ | CU-08 | `/login`, layouts admin/dashboard | — | `frontend/lib/server/session.ts`; `frontend/proxy.ts` | `frontend/tests/server/scope.test.ts`, `rbac.test.ts` | PAY-17 |
| RF-02 | 🟡 | CU-01 | `/dashboard/integrations` | `GET/POST /api/integrations`, `DELETE /api/integrations/{id}` | `frontend/lib/server/connections.ts` | `frontend/tests/payments/connectors.test.ts` [parcial] | PAY-7, PAY-8 |
| RF-03 | 🟡 | CU-01 | `/dashboard/integrations` | `GET/PUT /api/integrations/mercadopago` | `frontend/app/api/integrations/mercadopago/route.ts` | `frontend/tests/payments/mercadopagoOAuth.test.ts` | PAY-15 |
| RF-04 | 🟡 | CU-02 | `/dashboard/integrations` | `GET /api/integrations/{id}/health` | `frontend/lib/payments/connectionHealth.ts`; `frontend/lib/server/connections.ts` | `frontend/tests/payments/connectionHealth.test.ts`, `connectors-health.test.ts` | PAY-13 |
| RF-05 | 🟡 | CU-03 | N/A (externo) | `POST /api/webhooks/mercadopago`; `POST /api/webhooks/uala` | `frontend/lib/server/webhookHandler.ts`; connectors; migración 010 | `frontend/tests/server/webhookHandler.test.ts`, `frontend/tests/payments/connectors.test.ts` | PAY-9, PAY-10, PAY-14 |
| RF-06 | 🟡 | CU-03 | Dashboard/terminal | worker `POST /api/internal/webhook-worker` | `frontend/lib/payments/ingest.ts`; `frontend/lib/server/paymentsRepository.ts` | `frontend/tests/payments/ingest.test.ts`, `frontend/tests/integration/paymentsPipeline.test.ts` | PAY-9, PAY-10 |
| RF-07 | 🟡 | CU-03, CU-10 | N/A | `POST /api/internal/webhook-worker`; `POST /api/webhooks/replay`; `GET /api/internal/webhook-metrics` (owner-only) | `frontend/lib/server/webhookQueue.ts`; `webhookWorker.ts`; migraciones 010–011; `vercel.json` | `frontend/tests/server/webhookQueue.test.ts`, `webhookWorker.test.ts`, `webhookReplay.test.ts`, `webhookMetricsRoute.test.ts` | PAY-14 |
| RF-08 | ✅ | CU-04 | `/dashboard/terminal` | `GET/POST /api/expected-payments`; `GET/PATCH /api/expected-payments/{id}`; cancel | `frontend/lib/server/expectedPayments.ts` | `frontend/tests/payments/ingest.test.ts` [indirecto] | PAY-16 |
| RF-09 | ✅ | CU-05 | `/dashboard/terminal` | `GET .../{id}/candidates` o consulta de cobro | `frontend/lib/payments/matching.ts`; `frontend/lib/server/expectedPayments.ts` | `frontend/tests/payments/matching.test.ts`, `matchCandidatePersistence.test.ts` | PAY-16 (comentario Jira dice completado) |
| RF-10 | 🟡 | CU-05 | `/dashboard/terminal` | `PATCH /api/expected-payments/{id}`; `DELETE .../{id}/candidates` | `frontend/lib/server/expectedPayments.ts`; `frontend/lib/server/audit.ts` | `frontend/tests/server/manualResolutionAudit.test.ts` | PAY-16 |
| RF-11 | 🟡 | CU-06 | `/dashboard/reports`, `/dashboard` | `GET /api/reports`, `/api/stats/dashboard`, `/api/reports/movements` | `frontend/lib/reports/query.ts`; handlers | `frontend/tests/reports/query.test.ts`, `dateRange.test.ts` | PAY-18, PAY-24 |
| RF-12 | ✅ | CU-06 | `/dashboard/reports` | `GET /api/reports/movements?format=csv` | `frontend/app/api/reports/movements/route.ts` | [Pendiente: test específico de serialización CSV no encontrado] | PAY-18 |
| RF-13 | ✅ | CU-07 | `/dashboard/settings` | `GET/PATCH /api/notification-preferences` | `frontend/lib/server/notificationPreferences.ts` | [Pendiente: test de integración de preferencias no localizado] | PAY-19 |
| RF-14 | 🟡 | CU-07, CU-03 | `/dashboard/settings`, pantalla de terminal | `POST /api/push/subscribe`, `/unsubscribe`, `/send` | `frontend/lib/server/push.ts`; webhook handler | [Pendiente: prueba de navegador/dispositivo/staging] | PAY-19 |
| RF-15 | 🟡 | CU-09 | No se encontró pantalla completa de auditoría | No se verificó ruta de lectura completa | `frontend/lib/server/audit.ts` | `frontend/tests/server/manualResolutionAudit.test.ts` | PAY-17 |
| RF-16 | ✅ | CU-08 | `/dashboard/terminal` | `POST /api/dev/simulate-payment` | `frontend/app/api/dev/simulate-payment/route.ts`; `frontend/proxy.ts` | `frontend/tests/payments/connectors.test.ts` (mock) | PAY-9, PAY-12 |
| RF-17 | ✅ | CU-04, CU-05 | `/dashboard/terminal` | expected-payments y candidates | `frontend/app/dashboard/terminal/page.tsx` | `frontend/tests/payments/matching.test.ts`; `frontend/tests/payments/ingest.test.ts` | PAY-16 |
| RNF-01 | 🟡 | CU-08 | rutas servidor | múltiples API | `frontend/lib/server/scope.ts`; `session.ts` | `frontend/tests/server/scope.test.ts` | PAY-12, PAY-17 |
| RNF-02 | 🟡 | CU-01 | integraciones (sin secreto en UI) | integrations/OAuth | `frontend/lib/payments/secretBox.ts`; `connections.ts` | `frontend/tests/payments/secretBox.test.ts` | PAY-7, PAY-15 |
| RNF-03 | ✅ | CU-03 | N/A | webhook/worker | `frontend/lib/payments/ingest.ts` | `frontend/tests/integration/paymentsPipeline.test.ts` | PAY-14 |
| RNF-04 | ✅ | CU-03 | N/A | webhooks | `frontend/lib/server/webhookHandler.ts` | `frontend/tests/server/webhookHandler.test.ts` | PAY-14 |
| RNF-05 | 🟡 | CU-03 | N/A | worker | `frontend/lib/server/webhookQueue.ts`; migración 010 | `frontend/tests/server/webhookQueue.test.ts`, `webhookWorker.test.ts` | PAY-14, PAY-8 |
| RNF-06 | ✅ | CU-06 | `/dashboard/reports` | movements | `frontend/lib/reports/query.ts` | `frontend/tests/reports/query.test.ts` | PAY-18 |
| RNF-07 | 🟡 | CU-02 | Integraciones | health | `frontend/lib/payments/connectionHealth.ts` | tests health | PAY-13 |
| RNF-08 | 🟡 | CU-03 | N/A | webhook ACK + worker | `frontend/lib/server/webhookHandler.ts` | `frontend/tests/server/webhookHandler.test.ts` | PAY-14 |
| RNF-09 | 🟡 | CU-03/06 | N/A | rutas con wrapper aplicable | `frontend/lib/security/rateLimiter.ts`; `withRateLimit.ts`; migración 011 (RPC `rate_limit_hit`, fallback memoria) | [Pendiente: validación de entorno staging/cobertura] | PAY-14 |
| RNF-10 | 🟡 | CU-08 | UI auth | API interna | `frontend/lib/server/session.ts`; `frontend/proxy.ts` | `frontend/tests/server/scope.test.ts` | PAY-17 |

## Casos de uso y vínculo con tickets

| CU | Proceso | RF | Tickets asociados |
|---|---|---|---|
| CU-01 | PN1 | RF-02, RF-03 | PAY-7, PAY-15 |
| CU-02 | PN1 | RF-04 | PAY-13 |
| CU-03 | PN2 | RF-05, RF-06, RF-07, RF-14 | PAY-9, PAY-10, PAY-14 |
| CU-04 | PN3 | RF-08, RF-17 | PAY-16 |
| CU-05 | PN3 | RF-09, RF-10, RF-17 | PAY-16 |
| CU-06 | PN4 | RF-11, RF-12 | PAY-18, PAY-24 |
| CU-07 | PN5 | RF-13, RF-14 | PAY-19 |
| CU-08 | PN6 | RF-01, RF-02, RF-08, RF-10, RF-16 | PAY-17 |
| CU-09 | PN6 | RF-15 | PAY-17 |
| CU-10 | PN2 | RF-07, RF-15 | PAY-14 |

Los tickets PAY-8 a PAY-12 son principalmente despliegue, aceptación o validación externa; se evalúan en [07](07-redundancias-y-viabilidad.md), no se convierten en requisito funcional sin aprobación.
