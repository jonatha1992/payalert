# Runbook de la cola de webhooks

## Flujo y componentes

Los endpoints de entrada `frontend/app/api/webhooks/mercadopago/route.ts` y `frontend/app/api/webhooks/uala/route.ts` validan el evento y lo encolan; responden rápido sin ejecutar procesamiento de pagos en línea. `frontend/lib/server/webhookQueue.ts` encapsula la persistencia, el claim, los reintentos y las métricas. El cron llama a `frontend/app/api/internal/webhook-worker/route.ts`, que autoriza `CRON_SECRET` antes de invocar `frontend/lib/server/webhookWorker.ts`. El worker reclama un lote y procesa eventos usando `frontend/lib/server/webhookHandler.ts`.

```text
Proveedor -> endpoint webhook -> ACK + webhook_events -> cron/worker -> procesamiento -> DONE
                                                        └-> FAILED / DEAD -> replay owner
```

La deduplicación usa la restricción única `(provider, dedupe_key)`; el ACK puede reconocer eventos duplicados sin volver a encolarlos. `frontend/app/api/webhooks/replay/route.ts` permite a un dueño reencolar un evento DEAD de su propio negocio y deja auditoría mediante `frontend/lib/server/audit.ts`.

## Persistencia y estados

Aplicar `docs/migrations/010_pay14_webhook_queue.sql`. Crea `public.webhook_events` con `id`, `provider`, `connection_id`, `dedupe_key`, `payload`, `status`, `attempts`, `next_attempt_at`, `locked_at`, `last_error_code`, `created_at` y `updated_at`. La tabla tiene RLS y acceso de servicio; los RPC `claim_webhook_events` y `webhook_queue_metrics` están reservados a `service_role`.

| Estado | Significado / transición |
| --- | --- |
| `PENDING` | Nuevo y listo para procesar. |
| `PROCESSING` | Reclamado por un worker; locks expirados pueden reclamarse de nuevo. |
| `DONE` | Procesamiento completado. |
| `FAILED` | Fallo reintentable; se reintenta al llegar `next_attempt_at`. |
| `DEAD` | Alcanzó el máximo de 8 intentos; requiere revisión/replay manual. |

Los fallos usan backoff exponencial con jitter, con demora base limitada a una hora; `last_error_code` guarda códigos seguros, no mensajes de error. El replay reinicia intentos y estado a `PENDING`, y sólo está disponible al dueño autenticado del negocio al que pertenece la conexión.

## Worker y cron

`vercel.json` programa `GET /api/internal/webhook-worker` con `*/1 * * * *`. El worker procesa hasta 25 eventos por lote. Vercel documenta que Hobby permite como máximo un cron diario, con precisión por hora (±59 min); una programación cada minuto no está permitida en Hobby y puede fallar al desplegar. Pro y Enterprise admiten una frecuencia mínima de un minuto, con precisión por minuto. Mantener el cron actual requiere un plan compatible; no se modificó `vercel.json`.

Configurar `CRON_SECRET` en los entornos de despliegue y local como secreto aleatorio de al menos 16 caracteres. Vercel lo envía como `Authorization: Bearer …`; el worker devuelve 503 si falta el secreto, 401 ante autorización inválida y procesa sólo tras comparación constante. No registrar ni compartir su valor.

La entrega de cron es best-effort: Vercel no reintenta automáticamente una invocación fallida y puede perder o duplicar ejecuciones. La reclamación idempotente, deduplicación y recuperación de locks permiten que el worker reconcilie el trabajo pendiente en ejecuciones posteriores.

## Rate limit distribuido

Aplicar `docs/migrations/011_pay14_rate_limit.sql` además de 010. El RPC `rate_limit_hit` y la tabla `rate_limit_counters` mantienen contadores de ventana compartidos entre instancias, accesibles sólo por `service_role`. `frontend/lib/security/rateLimiter.ts` configura límites para endpoints; `frontend/lib/security/withRateLimit.ts` responde 429 y `Retry-After` cuando corresponde. Si falla el RPC, el limitador usa fallback en memoria y emite sólo un evento seguro. Las métricas usan el limitador de API.

## Métricas, logs y alertas

`GET /api/internal/webhook-metrics` devuelve únicamente `pending`, `dead` y `oldestPendingAgeSeconds`; requiere sesión autenticada con rol `owner` y está rate-limited. Nunca expone payloads, firmas ni secretos.

Los logs estructurados usan `frontend/lib/server/structuredLog.ts` y eventos con campos seleccionados; los fallos de procesamiento usan códigos seguros. No añadir payloads, firmas, tokens, secretos ni mensajes de excepciones sin filtrar.

Alertas recomendadas:

- `dead > 0`: revisar los eventos DEAD y códigos de error; replay sólo después de corregir la causa.
- `oldestPendingAgeSeconds` supera el SLO operativo acordado: investigar cron, locks y capacidad del worker. Definir el umbral según el objetivo de servicio del despliegue.
- Incremento sostenido de respuestas 429 o 401 en logs: distinguir abuso/configuración de clientes de una credencial de cron inválida o vencida. Los logs no deben incluir la credencial.

## Checklist de staging

1. Verificar variables de entorno requeridas por Supabase y definir `CRON_SECRET` en staging; usar un valor distinto al de producción.
2. Aplicar en orden `docs/migrations/010_pay14_webhook_queue.sql` y `docs/migrations/011_pay14_rate_limit.sql`.
3. Verificar que las funciones RPC existen y que el endpoint del worker responde 503 sin secreto y 401 con bearer incorrecto (sin iniciar procesamiento).
4. Enviar eventos de prueba de Mercado Pago y Ualá con conexiones de staging: verificar ACK rápido, deduplicación y filas correspondientes en `webhook_events`, sin datos reales sensibles.
5. Ejecutar una vez el worker autenticado en staging; confirmar transición a `DONE` y métricas agregadas. Probar un fallo controlado hasta `FAILED` y validar el backoff; no generar carga real de proveedores.
6. Verificar que el acceso anónimo/sin sesión a métricas da 401, un rol distinto de owner da 403, y el dueño ve sólo agregados; comprobar que una persona de otro negocio no puede hacer replay de eventos.
7. Revisar logs y alertas sin payloads ni credenciales. Confirmar frecuencia del cron frente al plan: Hobby no admite cada minuto.

## Validación del dueño antes de replay

El dueño debe confirmar que el evento pertenece a su conexión/negocio, leer el código seguro y el contexto operativo del fallo, corregir la causa raíz y verificar que volver a procesarlo no duplicará el efecto de negocio. Después puede solicitar replay desde la ruta autenticada; la acción se audita. No copiar secretos ni payloads a tickets o logs.

## Referencias oficiales de Vercel

- [Uso y precios de Cron Jobs](https://vercel.com/docs/cron-jobs/usage-and-pricing): frecuencia mínima y precisión por plan (documentación consultada el 2026-10-16).
- [Administrar Cron Jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs): configuración y envío de `CRON_SECRET` como bearer token; entrega best-effort y ausencia de reintento automático.
