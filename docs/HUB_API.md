# PayAlert Hub API (v1)

Hub de cobros genérico para apps cliente, con o sin Firebase. PayAlert no almacena ni utiliza credenciales externas de Firebase: el estado del cobro vive en Supabase (`hub_charges`). Cada app cliente se identifica con su propia API key y solo puede consultar/modificar cobros vinculados a esa app.

Todas las rutas requieren HTTP Bearer autenticando con la API key propia de la app. El Origin debe estar incluido exactamente en `client_apps.allowed_origins`. La comparación de la clave se realiza con SHA-256 y comparación en tiempo constante. Las operaciones sobre cobros deben aislar por `client_app_id`; las operaciones que consulten conexiones de pago también deben comprobar conjuntamente `connection_id` y `business_id`.

## Crear cobro

`POST /api/v1/charges` acepta JSON `{ "bookingId": "...", "payerRef": "user-opaque-id", "payerEmail": "person@example.test", "returnUrl": "https://shop.example.test/booking/123", "amount": 5000, "itemTitle": "Cuota" }` y requiere autenticación API key y `Origin` permitido. `bookingId` y `payerRef` identifican la reserva/usuario en el sistema de la app cliente; PayAlert no consulta la reserva ni Firestore. `payerEmail` es opcional. Por defecto el servidor fija el importe a `client_apps.deposit_default` e ignora `amount`. Solo cuando `client_apps.allow_amount_override=true`, `amount` opcional debe ser entero ARS entre `min_amount` y `max_amount` (incluidos); un valor inválido devuelve `400 invalid_amount`. `itemTitle`, opcional, admite hasta 80 caracteres sin etiquetas HTML y reemplaza el título predeterminado `Seña`. `returnUrl` es obligatorio y debe comenzar con un valor de `allowed_origins`. El estado y el importe efectivo se guardan en `hub_charges`; una solicitud repetida para un cobro pendiente vigente devuelve el mismo `checkoutUrl`, pero si cambia el importe devuelve `409 amount_mismatch`. La preferencia usa la conexión Mercado Pago de esa app, vence en 15 minutos y lleva `X-Idempotency-Key`. Responde `{ "chargeId": "...", "checkoutUrl": "...", "expiresAt": "...", "status": "pending" }`; conexión ausente/inactiva produce `409 connection_unavailable`.

El cobro es idempotente por app+booking. El navegador debe invocar esta ruta con `Origin` autorizado; `OPTIONS` debe permitir CORS solo para origins autorizados.

## Consultar estado

`GET /api/v1/charges/{bookingId}` usa la misma API key y validación de `Origin`. El segmento `{bookingId}` identifica el booking dentro de la app autenticada. Responde `{ "status": "...", "amount": 5000, "expiresAt": "...", "paymentId": "..." }`; `paymentId` solo se incluye cuando hay uno registrado. Si el booking no tiene cobro para la app autenticada, devuelve `404` sin revelar si existe para otra app.

## Reembolso

`POST /api/v1/charges/{bookingId}/refund` usa la misma API key y validación de `Origin`. El booking debe corresponder a un cobro aprobado de la app autenticada. La app puede enviar `{ "eventStartsAt": "2030-01-02T15:00:00.000Z" }`; si se incluye, PayAlert devuelve `409 refund_window_closed` cuando faltan menos de 24 horas. PayAlert no consulta Firestore ni aplica políticas de agenda propias. El reembolso usa CAS `approved -> refunding -> refunded`; el resultado ambiguo permanece `refunding` para conciliación y un rechazo definitivo del proveedor vuelve a `approved`. Responde `{ "status": "refunded" }` o `{ "status": "refunding" }`.

## Aislamiento y validaciones

Cada operación valida la API key activa y el Origin permitido, y limita el cobro por `client_app_id` de la app autenticada. Al acceder a la conexión de pago, se filtra por `connection_id` y `business_id` de esa misma app. Las respuestas de autenticación inválida/inactiva y Origin no permitido son genéricas y no revelan cuál de esas validaciones falló. PayAlert confía en la app cliente para autorizar usuarios y decidir quién puede pagar o reembolsar; no lee ni escribe Firebase/Firestore. `returnUrl` debe comenzar con una URL autorizada.

## Estado del cobro

Los registros y el estado del cobro se mantienen en Supabase (`hub_charges`). El webhook de Mercado Pago valida importe y moneda contra el registro autoritativo y actualiza el estado; `payment_id` se devuelve en el endpoint de consulta una vez disponible. Los estados posibles incluyen `creating`, `pending`, `approved`, `rejected`, `expired`, `refunding`, `refunded` y `needs_refund`.

## Alta de app

1. Aplicar `docs/migrations/017_client_apps_hub.sql`, `018_hub_creating_status.sql`, `019_hub_hardening.sql`, `020_hub_generic_mode.sql` y `021_client_apps_amount_override.sql` con credenciales administrativas. Esta documentación no aplica migraciones automáticamente.
2. Autorizar OAuth MP con `offline_access read write` (o `MP_OAUTH_SCOPES`).
3. Registrar cada app mediante un proceso administrativo que genere una API key aleatoria y almacene solo su SHA-256 en `client_apps.api_key_hash`. Guardar la clave una sola vez en el sistema de secretos de esa app; no incluirla en código cliente versionado.

En modo genérico, `client_apps.firebase_project_id` y `client_apps.firebase_sa_encrypted` son nullable y PayAlert no requiere ni usa credenciales Firebase de la app cliente. Para la app del gimnasio, configurar `allow_amount_override=true` y límites de `min_amount` / `max_amount` en pesos ARS que permitan los importes de cuota y matrícula; los valores globales de base son `1` y `1000000`.

## Variables

- `MP_OAUTH_SCOPES`: default `offline_access read write`; permite los scopes requeridos por preferencias y reembolsos.
- `NEXT_PUBLIC_APP_URL`: URL base pública de PayAlert para la notificación Mercado Pago.
- `HUB_CRON_SECRET`: secreto para el endpoint tick.
- GitHub Actions secrets `PAYALERT_URL`, `HUB_CRON_SECRET`.
- Supabase service role ya requerido por backend.

## Tick

`POST /api/internal/hub-tick`, header `x-hub-cron-secret`. Workflow `hub-tick.yml` lo llama cada cinco minutos: solo vence cobros `pending` al superar sus 15 minutos de expiración, elimina claims `creating` antiguos y reconcilia reembolsos `refunding`. No sincroniza ni consulta Firestore.
