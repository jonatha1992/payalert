# 05 — Límites del sistema y directivas para agentes

## No-alcance o capacidades no aprobadas

| ID | Capacidad excluida / limitación | Fuente y justificación |
|---|---|---|
| LIM-01 | Aplicación móvil nativa React Native/Expo. La PWA no equivale a app nativa. | PAY-20; no hay proyecto Expo encontrado. |
| LIM-02 | API pública versionada ni webhooks salientes a terceros. | PAY-25; endpoints actuales son API interna de aplicación y callback de proveedor. |
| LIM-03 | MODO/PCT, Interbanking y otros proveedores no presentes en conectores. | PAY-21/22; no hay conector ni documentación oficial local verificada. |
| LIM-04 | Membresía multiempresa de usuario con selector/invitaciones/múltiples roles por tenant. | PAY-23; ADR-002 propone diseño, esquema actual usa `users.business_id` singular. |
| LIM-05 | Canal de notificación email activo. Toggle/preferencia no implica entrega; decisión en `docs/DECISIONS.md`. | PAY-19; proveedor/costo no aprobados. |
| LIM-06 | Cobertura universal de transferencias entrantes a CVU/CBU. Conectores actuales cubren contratos específicos de proveedor/checkout consultable; no declarar cobertura de transferencia sin prueba externa. | PAY-11; `docs/providers/mercadopago.md`, `docs/providers/uala.md`. |
| LIM-07 | Pricing, límites de planes SaaS, trial, billing o cobro a comercios. | PAY-28; `docs/PLANES_SAAS.md` declara propuesta no validada. |
| LIM-08 | Analytics avanzada, IA, anomalías, forecasting, Excel/PDF fuera de lo que exista en rutas actuales. | PAY-24/27; código verificado exporta CSV; PRD 23/43 no disponible. |
| LIM-09 | Scraping de home banking, captura de credenciales bancarias ajenas, o movimiento de fondos. | PAY-11/21/22/26; fuera de límites y riesgo. |
| LIM-10 | No se afirma garantía de despliegue, SLA/latencia objetivo ni validación operacional de staging/prod sin evidencia de entorno; la limitación distribuida está implementada en dev pero no validada en staging. | PAY-8/9/10/12/14; tickets y código no demuestran configuración productiva. |
| LIM-11 | Replatform PayWatch/FastAPI/Redis/Celery/Vue como arquitectura aprobada. | PAY-29; ADR-001 es análisis/propuesta, no orden de reescritura. |
| LIM-12 | Administración integral de negocio, invitación y roles conforme docs antiguos. Solo considerar operativa la ruta/pantalla localizada y RBAC comprobable. | `docs/API_Documentation.md` describe endpoints ausentes; comparar [00](00-descripcion-global.md). |
| LIM-13 | Operación PAY-14 está implementada en dev, pero no se afirma staging validado. El cron de worker en `vercel.json` es diario, no cada minuto; frecuencia de sincronización de pagos y plan Vercel habilitante requieren decisión. | Código/rutas actuales; runbook `docs/WEBHOOKS_QUEUE.md`; plan vigente no verificado en este paquete. |
| LIM-14 | Mercado Pago no envía IPN/webhook para transferencias comunes CVU/alias; este tipo de transferencia se detecta por consulta, no por webhook. | PAY-36; rutas y conector de sincronización; prueba reportada 2026-10-19 (ver [99](99-pendientes.md)). |
| LIM-15 | El cron gratuito de Vercel solo permite ejecución diaria según plan observado; la latencia máxima potencial se aproxima a 24 h sin disparador externo más frecuente. No se promete consulta cada minuto. `[Pendiente]` decidir frecuencia/disparador y verificar plan contratado. | `vercel.json`; evidencia del plan pendiente de confirmación; PAY-36. |
| LIM-16 | Los avisos Android son señales falsificables y no confirman dinero; solo el servidor puede confirmar por coincidencia con pago real. No se verificó en dispositivo físico ni con aviso real. | `docs/mobile/NOTIFICATION_HINTS.md`; `mobile/README.md`; PAY-38. |
| LIM-17 | No hay instalación/cliente nativo iOS para el listener; la implementación nativa de aviso rápido es Android. | `mobile/README.md`; módulos Kotlin en `mobile/modules/notification-listener/`. |
| LIM-18 | El registro OAuth de Google puede crear perfiles owner para cualquier cuenta no restringida por `ALLOWED_SIGNUP_EMAILS`; con allowlist vacía, el registro es abierto. `[Pendiente]` decisión de producto sobre restringir altas. | `frontend/app/auth/callback/route.ts`; `frontend/lib/server/bootstrapOwner.ts`. |
| LIM-19 | No existe bitácora genérica `error_log` verificada; varios errores se reducen a código/resultado seguro y `manualSync` registra `ingest_error` sin conservar error original. No afirmar diagnóstico detallado persistido. | `frontend/lib/payments/manualSync.ts`; búsqueda de esquema/logs pendiente de contrato. |
| LIM-20 | No asumir que dashboard estadístico filtra pistas móviles: `stats/dashboard` excluye `status=pending`, pero el handler persiste `status: pending`; reportes pueden mostrarlas como pendientes. | `frontend/app/api/stats/dashboard/route.ts`; `frontend/app/api/mobile/payment-hints/route.ts`; `docs/mobile/NOTIFICATION_HINTS.md`. |
| LIM-21 | Aviso de notificación móvil no confirma dinero; estado `PENDING` significa «sin confirmar», señal falsificable y excluida de totales. Solo servidor concilia contra pago real. No probado con aviso real/dispositivo. | PAY-38; `docs/mobile/NOTIFICATION_HINTS.md`; `frontend/lib/payments/notificationHintReconciliation.ts`. |
| LIM-22 | No hay instalación iOS para listener de notificaciones; la función nativa implementada es Android. | `mobile/README.md`; `mobile/modules/notification-listener/`. |
| LIM-23 | Registro Google puede admitir toda cuenta si `ALLOWED_SIGNUP_EMAILS` vacío/ausente. Decidir allowlist/invitaciones. | `frontend/app/auth/callback/route.ts`; `frontend/lib/server/bootstrapOwner.ts`. |
| LIM-24 | No existe bitácora genérica persistente `error_log` verificada; varios catch descartan detalle real (`manualSync` usa `ingest_error`). No prometer diagnóstico persistido. | `frontend/lib/payments/manualSync.ts`; diseño pendiente. |

## Guardrails para agentes de desarrollo y operaciones

1. No implementar LIM-* por aparecer en un documento/plan/ticket; requerir decisión explícita enlazada.
2. No inferir endpoints de PRD, ejemplos de API antiguos ni valores de proveedor; verificar rutas/código y contrato oficial vigente.
3. Tratar input de cliente como dato no confiable. En consultas con service role, filtrar explícitamente tenant/sucursal.
4. Nunca devolver/loggear credenciales, firmas, raw webhook, datos personales sensibles ni mensajes de error sin sanitizar.
5. Mantener idempotencia, autoridad de importe/estado de API proveedor y unicidad de asignación (RN enlazadas en [03](03-reglas-de-negocio.md)).
6. Nunca ejecutar migraciones en staging/prod, transferencias reales, OAuth real, deploy o replay operativo sin aprobación y entorno identificado.
7. No cambiar ni borrar `payment_tokens` hasta cutover comparado/backup/reconexión aprobados; seguir `docs/STAGING.md`.
8. No habilitar rol support hasta definir identidad, tenant/alcance, auditoría y compatibilidad del tipo legacy.
9. No tratar comentarios/estado Jira como validación de staging, producción o aceptación por usuario.
10. Antes de consolidar docs, proponer y revisar el Mapa de documentos; no editar documentos existentes como parte de este paquete.
