# PayAlert Hub API (v1)

Servicio de cobros Checkout Pro para apps cliente Firebase (sin backend propio). La app solo envía su `slug` y `bookingId`; PayAlert determina importe y credencial desde registros del servidor.

## Crear cobro
`POST /api/v1/charges` JSON `{ "app": "huellitas", "bookingId": "..." }`, `Authorization: Bearer <Firebase ID token>` y `Origin` permitido. Lee `bookings/{id}` y exige `uid` del token y estado `pendiente`. Importe `config/pagos.senia` entero en centavos (1..1.000.000) o `deposit_default`; no se acepta importe del cliente. Devuelve `{ "init_point": "..." }`; idempotente por app+booking, expira en 15 minutos. Se requiere `OPTIONS` desde origen autorizado para CORS.

## Reembolso
`POST /api/v1/charges/{bookingId}/refund` JSON `{ "app": "huellitas" }`, Firebase ID token cuyo email esté en `admin_emails`. Reembolsa el total, únicamente con pago aprobado y al menos 24 horas antes del turno. Se marca booking `reembolsada`.

## Firebase / MP
Se espera documento `bookings/{id}` con `uid`, `status`, `date`, `time` y opcional `config.pagos.senia`. PayAlert accede a Firestore y Admin Auth con service account cifrada AES-256-GCM; las credenciales MP se reutilizan desde `payment_connections`. Webhook valida datos consultando el pago a Mercado Pago; cuando su `external_reference` coincide con un cobro del hub, valida importe y moneda autoritativos y actualiza el cobro. Aprobados dentro del plazo confirman la reserva en Firestore (`status=confirmada`, pago aprobado y `paymentId`); aprobaciones tardías quedan `needs_refund` sin confirmar. Rechazados/cancelados marcan el pago del booking como rechazado. Errores de sincronización Firestore quedan registrados (`firestore_synced=false`, `last_error`) para reintento por `hub-tick`; los pagos no asociados al hub mantienen su flujo de transacciones habitual.

## Alta de app
1. Aplicar `docs/migrations/017_client_apps_hub.sql` con credenciales administrativas.
2. Autorizar OAuth MP con `offline_access read write` (o `MP_OAUTH_SCOPES`).
  - Preparar localmente `client_apps.json` con slug, business_id, connection_id, firebase_project_id, allowed_origins, admin_emails, deposit_default y ruta de `firebase_service_account_file` relativa al archivo de configuración. Ejecutar `node scripts/register-client-app.js client_apps.json`; el JSON no se versiona. Configurar `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y `PAYMENTS_ENCRYPTION_KEY`. El script cifra la service account con `encryptSecret`, genera una API key aleatoria de 256 bits y almacena únicamente su SHA-256; imprime la clave una sola vez para guardarla de forma segura. Nunca imprime la service account.

## Variables
- `PAYMENTS_ENCRYPTION_KEY` y opcional `PAYMENTS_ENCRYPTION_KEYS`: claves AES-256-GCM existentes.
- `MP_OAUTH_SCOPES`: default `offline_access read write`; permite los scopes requeridos por preferencias y reembolsos.
- `NEXT_PUBLIC_APP_URL`: URL base pública de PayAlert para la notificación Mercado Pago.
- `HUB_CRON_SECRET`: secreto para el endpoint tick.
- GitHub Actions secrets `PAYALERT_URL`, `HUB_CRON_SECRET`.
- Supabase service role ya requerido por backend.

## Tick
`POST /api/internal/hub-tick`, header `x-hub-cron-secret`. Workflow `hub-tick.yml` lo llama cada cinco minutos; expira cobros pendientes, libera slots y reintenta sincronizaciones fallidas.
