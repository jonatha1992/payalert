# PayAlert Hub API (v1)

Hub de cobros genérico para apps cliente, con o sin Firebase. PayAlert no almacena ni utiliza credenciales externas de Firebase: el estado del cobro vive en Supabase (`hub_charges`). Cada app cliente se identifica con su propia API key y solo puede consultar/modificar cobros vinculados a esa app.

Todas las rutas requieren HTTP Bearer autenticando con la API key propia de la app. El Origin debe estar incluido exactamente en `client_apps.allowed_origins`. La comparación de la clave se realiza con SHA-256 y comparación en tiempo constante. Las operaciones sobre cobros deben aislar por `client_app_id`; las operaciones que consulten conexiones de pago también deben comprobar conjuntamente `connection_id` y `business_id`.

## Crear cobro

`POST /api/v1/charges` acepta JSON `{ "bookingId": "...", "payerRef": "user-opaque-id", "payerEmail": "person@example.test", "returnUrl": "https://shop.example.test/booking/123" }` y requiere autenticación API key y `Origin` permitido. `bookingId` y `payerRef` identifican la reserva/usuario en el sistema de la app cliente; PayAlert no consulta la reserva ni Firestore. `payerEmail` es opcional. El servidor siempre fija el importe a `client_apps.deposit_default`; cualquier importe enviado se ignora. `returnUrl` es obligatorio y debe comenzar con un valor de `allowed_origins`. El estado y la unicidad por app+booking se guardan en `hub_charges`; una solicitud repetida para un cobro pendiente vigente devuelve el mismo `checkoutUrl`. La preferencia usa la conexión Mercado Pago de esa app, vence en 15 minutos y lleva `X-Idempotency-Key`. Responde `{ "chargeId": "...", "checkoutUrl": "...", "expiresAt": "...", "status": "pending" }`; si `client_apps.connection_id` es `null` o la conexión está ausente/inactiva produce `409 { "error": "connection_unavailable" }` con las cabeceras CORS del Origin autorizado; no se crea un claim ni se llama a Mercado Pago. Las apps nuevas pueden registrar cobros solo después de que la dueña complete la autorización por invitación.

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

1. Aplicar manualmente las migraciones Hub requeridas, incluida `022_client_apps_connection_nullable.sql`, con credenciales administrativas. Esta documentación no aplica migraciones automáticamente.
2. Registrar primero la app con `node scripts/register-client-app.js <config.json>`. El JSON admite `{ "slug": "huellitas", "allowed_origins": ["https://huellitas.example.test"], "deposit_default": 5000, "connect_return_url": "https://huellitas.example.test/connect/return", "business_id": "...", "connection_id": "..." }`; `business_id` y `connection_id` son opcionales. Sin `business_id` se crea/reutiliza un negocio oculto `app:<slug>`; sin `connection_id`, se almacena `null`. `connect_return_url` debe ser HTTPS y su origen estar incluido exactamente en `allowed_origins`.
3. El comando muestra la API key una sola vez; guardarla como secreto y no incluirla en código versionado. Cuando la app se registra sin conexión, también muestra el enlace de invitación.
4. Compartir ese enlace con la dueña: ella autoriza Mercado Pago desde su propia cuenta y la conexión se asocia a la app. Recién entonces el endpoint de creación de cobro funciona; antes responde `409 { "error": "connection_unavailable" }`.

En modo genérico, `client_apps.firebase_project_id` y `client_apps.firebase_sa_encrypted` son nullable y PayAlert no requiere ni usa credenciales Firebase de la app cliente.

## Conexión por invitación

La dueña puede delegar la autorización de Mercado Pago sin compartir su sesión de PayAlert. El orden es alta de app → enlace de invitación → la dueña autoriza Mercado Pago → creación de cobros habilitada. El alta sin conexión ya emite el enlace; para regenerarlo para una app activa, usar:

```bash
node scripts/register-client-app.js invite --slug <slug> [--hours 24]
```

El comando muestra un enlace aleatorio una sola vez y guarda solo el hash del token. El enlace vence según `--hours` (por defecto 24 h), es de un solo uso y solo funciona mientras la app esté activa. Quien lo abra autoriza la cuenta en Mercado Pago; el callback guarda la conexión y la vincula exclusivamente a esa app. Si falla el intercambio con Mercado Pago, la invitación sigue vigente y se puede reabrir para iniciar una autorización nueva.

Configurar `client_apps.connect_return_url` con una URL absoluta HTTPS de la app cliente. Su origen debe coincidir exactamente con una entrada de `client_apps.allowed_origins` (por ejemplo, `https://huellitas.example.test/connect/return`). Tras el callback, PayAlert agrega `mp=connected` o `mp=failed` a esa URL. Si la URL no está permitida, el callback vuelve al dashboard de PayAlert. El enlace se debe tratar como un secreto: compartirlo solo con la persona encargada y no registrarlo en logs.

El flujo completo está en [docs/connect-invite-flow.md](connect-invite-flow.md).

- OAuth MP requiere MP_OAUTH_ENABLED, MP_CLIENT_ID, MP_CLIENT_SECRET, MP_OAUTH_REDIRECT_URI y MP_OAUTH_STATE_SECRET (mínimo 32 caracteres).
## Variables

- `MP_OAUTH_SCOPES`: default `offline_access read write`; permite los scopes requeridos por preferencias y reembolsos.
- `NEXT_PUBLIC_APP_URL`: URL base pública de PayAlert para la notificación Mercado Pago.
- `HUB_CRON_SECRET`: secreto para el endpoint tick.
- GitHub Actions secrets `PAYALERT_URL`, `HUB_CRON_SECRET`.
- Supabase service role ya requerido por backend.

## Tick

`POST /api/internal/hub-tick`, header `x-hub-cron-secret`. Workflow `hub-tick.yml` lo llama cada cinco minutos: solo vence cobros `pending` al superar sus 15 minutos de expiración, elimina claims `creating` antiguos y reconcilia reembolsos `refunding`. No sincroniza ni consulta Firestore.
