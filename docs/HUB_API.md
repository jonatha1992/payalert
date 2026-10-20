# PayAlert Hub API (v1)

Hub de cobros genérico para apps cliente, con o sin Firebase. PayAlert no almacena ni utiliza credenciales externas de Firebase: el estado del cobro vive en Supabase (`hub_charges`). Cada app cliente se identifica con su propia API key y solo puede consultar/modificar cobros vinculados a esa app.

Todas las rutas requieren HTTP Bearer autenticando con la API key propia de la app. El Origin debe estar incluido exactamente en `client_apps.allowed_origins`. La comparación de la clave se realiza con SHA-256 y comparación en tiempo constante. Las operaciones sobre cobros deben aislar por `client_app_id`; las operaciones que consulten conexiones de pago también deben comprobar conjuntamente `connection_id` y `business_id`.

## Crear cobro

`POST /api/v1/charges` acepta JSON `{ "bookingId": "...", "amount": 1000, "payerRef": "user-opaque-id", "payerEmail": "person@example.test", "returnUrl": "https://shop.example.test/booking/123" }` y requiere autenticación API key y `Origin` permitido. `bookingId` y `payerRef` identifican la reserva/usuario en el sistema de la app cliente; `payerRef` es opaco para PayAlert. `payerEmail` y `amount` son opcionales. El servidor siempre fija el importe a `client_apps.deposit_default`; el valor `amount` enviado por el cliente se ignora en este contrato. `returnUrl`, cuando se envía, debe comenzar con uno de los valores exactos de `allowed_origins` de la app. Responde `{ "chargeId": "...", "checkoutUrl": "...", "expiresAt": "...", "status": "pending" }`.

El cobro es idempotente por app+booking. El navegador debe invocar esta ruta con `Origin` autorizado; `OPTIONS` debe permitir CORS solo para origins autorizados.

## Consultar estado

`GET /api/v1/charges/{bookingId}` usa la misma API key y validación de `Origin`. El segmento `{bookingId}` identifica el booking dentro de la app autenticada. Responde `{ "status": "...", "amount": 5000, "expiresAt": "...", "paymentId": "..." }`; `paymentId` solo se incluye cuando hay uno registrado. Si el booking no tiene cobro para la app autenticada, devuelve `404` sin revelar si existe para otra app.

## Reembolso

`POST /api/v1/charges/{bookingId}/refund` usa la misma API key y validación de `Origin`. El booking debe corresponder a un cobro de la app autenticada. Responde `{ "status": "refunded" }` cuando finaliza o `{ "status": "refunding" }` mientras el resultado continúa en conciliación.

## Aislamiento y validaciones

Cada operación valida la API key activa y el Origin permitido, y limita el cobro por `client_app_id` de la app autenticada. Al acceder a la conexión de pago, se filtra por `connection_id` y `business_id` de esa misma app. Las respuestas de autenticación inválida/inactiva y Origin no permitido son genéricas y no revelan cuál de esas validaciones falló. La URL de retorno debe comenzar con un `allowed_origin` de la app.

## Estado del cobro

Los registros y el estado del cobro se mantienen en Supabase (`hub_charges`). El webhook de Mercado Pago valida importe y moneda contra el registro autoritativo y actualiza el estado; `payment_id` se devuelve en el endpoint de consulta una vez disponible. Los estados posibles incluyen `creating`, `pending`, `approved`, `rejected`, `expired`, `refunding`, `refunded` y `needs_refund`.

## Alta de app

1. Aplicar `docs/migrations/017_client_apps_hub.sql`, `018_hub_creating_status.sql`, `019_hub_hardening.sql` y `020_hub_generic_mode.sql` con credenciales administrativas. Esta documentación no aplica migraciones automáticamente.
2. Autorizar OAuth MP con `offline_access read write` (o `MP_OAUTH_SCOPES`).
3. Registrar cada app mediante un proceso administrativo que genere una API key aleatoria y almacene solo su SHA-256 en `client_apps.api_key_hash`. Guardar la clave una sola vez en el sistema de secretos de esa app; no incluirla en código cliente versionado.

En modo genérico, `client_apps.firebase_project_id` y `client_apps.firebase_sa_encrypted` son nullable y PayAlert no requiere ni usa credenciales Firebase de la app cliente.

## Variables

- `MP_OAUTH_SCOPES`: default `offline_access read write`; permite los scopes requeridos por preferencias y reembolsos.
- `NEXT_PUBLIC_APP_URL`: URL base pública de PayAlert para la notificación Mercado Pago.
- `HUB_CRON_SECRET`: secreto para el endpoint tick.
- GitHub Actions secrets `PAYALERT_URL`, `HUB_CRON_SECRET`.
- Supabase service role ya requerido por backend.

## Tick

`POST /api/internal/hub-tick`, header `x-hub-cron-secret`. Workflow `hub-tick.yml` lo llama cada cinco minutos para procesar cobros vencidos y conciliaciones pendientes.
