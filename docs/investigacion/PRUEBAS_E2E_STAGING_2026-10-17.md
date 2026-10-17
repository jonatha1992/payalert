# Pruebas E2E reales contra payalert-kappa y staging — 2026-10-17

## Resumen

Se probaron endpoints desplegados de `https://payalert-kappa.vercel.app` con cuatro usuarios sintéticos creados por Auth Admin y fixtures temporales solo en el proyecto staging `aiobbjrvzhegyagthxdr`. No se invocaron APIs reales de Mercado Pago/Ualá ni se ejecutó el worker con eventos pendientes. Los cuatro usuarios Auth y todas las filas e2e fueron borrados; la lectura final confirmó cero perfiles `e2e-*` y cero negocios `e2e-*`.

No se desplegó ni modificó código. El informe solicitado existente no pudo actualizarse: en el checkout aparece marcado `assume-unchanged` y el editor de archivos rechazó sobrescribirlo tras la lectura completa. Para conservar evidencia sin alterar estado oculto del índice ni tocar archivos ajenos, este es un reporte fechado nuevo.

## Casos y evidencia

| Área | Caso | Resultado | Evidencia / motivo |
|---|---|---|---|
| A | Auth API sin sesión | PASS | `GET /api/expected-payments` sin Authorization → HTTP 401 `No autenticado`. |
| A | Bearer inválido | PASS | El mismo GET con Bearer inválido → HTTP 401 `No autenticado`. |
| A | Bearer válido | PASS | Owner e2e autenticado por password-grant → GET HTTP 200, respuesta `expectedPayments: []` antes de crear fixtures de pagos. |
| A | Login UI, dashboard y consola | NO PROBADO | Se abrió `/login` y se capturó la pantalla. No se consiguió completar login desde el browser; no hay evidencia de dashboard ni de consola/red autenticada limpia. |
| B | Owner/manager: crear cobro y leer reportes | PASS | `POST /api/expected-payments` HTTP 201 y `GET /api/reports` HTTP 200. Manager corresponde al rol de esquema `admin`. |
| B | Cashier: permisos | PASS | El rol de esquema `employee` (cashier) creó cobro HTTP 201; `GET /api/reports` devolvió HTTP 403 `Permiso insuficiente`. |
| B | Aislamiento entre negocio A y B | PASS | Owner B consultó `GET /api/expected-payments`, `/api/reports/movements` y `/api/reports`; HTTP 200, listas vacías y resumen cero pese a fixtures temporales en A. |
| C | Crear cobro esperado | PASS | Owner A `POST /api/expected-payments` HTTP 201; cuerpo resumido: 1234.56 ARS, estado WAITING. |
| C | Listar cobros esperados | PASS | Owner A `GET /api/expected-payments?status=WAITING` HTTP 200; incluyó el cobro creado. No se halló/probó una transición de estado separada. |
| D | Webhook firmado y cola | FAIL | Conexión staging creada con secreto cifrado AES-256-GCM; webhooks sintéticos firmados con manifest `id;request-id;ts` devolvieron HTTP 500 `received:false`. No se insertó evento. Se repitió con timestamp segundos y milisegundos. |
| D | Firma inválida | FAIL | Hash incorrecto también devolvió HTTP 500, en vez del rechazo HTTP 401 esperado. No se insertó evento. No hay logs del deployment para aislar causa raíz, por lo que no se hizo fix especulativo. |
| D | Idempotencia | NO PROBADO | Falló la entrega válida inicial; lectura staging encontró cero eventos para las claves probadas. |
| E | Worker sin secreto | PASS | `POST /api/internal/webhook-worker` sin Authorization → HTTP 401 `unauthorized`. |
| E | Worker autorizado/procesamiento | NO PROBADO | No se llamó con secreto; una cola pendiente podría efectuar una llamada a proveedor real, prohibida para esta prueba. |
| F | Push POST/DELETE y propiedad de sesión | PASS | POST `/api/push/devices` HTTP 200; DB confirmó `user_id` y `business_id` del owner autenticado pese a `user_id` falsificado en body. DELETE HTTP 200. |
| G | Métricas solo owner | PASS | Owner `GET /api/internal/webhook-metrics` HTTP 200; cashier HTTP 403. |
| H | Rate limit | FAIL | 50 GET a `/api/expected-payments` devolvieron HTTP 200; no se observó 429. No se puede separar desde esta evidencia configuración distinta/IP/contador de un defecto del límite. |
| I | Inicio OAuth Google | PASS (solo inicio) | Supabase `/auth/v1/authorize?provider=google` HTTP 200 HTML con base en `accounts.google.com`; el backend no devolvió 302. No se completó OAuth. |
| I | Callback sin code | NO PROBADO | `/auth/callback` en producción devolvió HTTP 200 HTML; no se certificó redirección a login ni ejecución cliente. |
| Limpieza staging | Usuarios/filas e2e | PASS | Cuatro Auth users borrados (HTTP 200). Verificación: Auth e2e 0, `public.users` e2e 0, negocios/tiendas e2e 0, conexiones/eventos/push/cobros/transacciones e2e 0. Cuenta real y negocio real no fueron modificados. |
| Limpieza local | Browser y `$TMPDIR/e2e.json` | PASS | Browser en `about:blank`, storage local/session limpiado. `$TMPDIR/e2e.json` no existía. No se inició servidor local. |

## Bugs y límites

- El webhook devuelve 500 para firma válida e inválida. Defecto reproducido en deployment; causa raíz sin confirmar. Requiere logs Vercel/Supabase o reproducción local antes de corregir.
- No se observó 429 en la ráfaga de 50 solicitudes; requiere revisar el límite/configuración del deployment.
- `/auth/callback` respondió HTML HTTP 200 sin code; no se inspeccionó si el cliente redirige.
- La pantalla de login sí se capturó, pero no se logró sesión UI ni dashboard.
- No se ejecutó el worker autorizado ni hubo llamadas a Mercado Pago/Ualá.
- No se desplegó nada; el deployment puede no corresponder al código local actual.

## Rutas y roles probados

`/api/expected-payments` (GET/POST), `/api/reports` (GET), `/api/reports/movements` (GET), `/api/push/devices` (POST/DELETE), `/api/internal/webhook-metrics` (GET), `/api/internal/webhook-worker` (POST), `/api/webhooks/mercadopago` (POST). Roles válidos en el esquema: `owner`, `admin`, `employee`; `rbac.ts` los traduce a `owner`, `manager`, `cashier`.

## Código y commits

No hubo cambio de código, test de regresión ni corrección; por ello no se ejecutaron `tsc`, Vitest ni build. No se creó commit: el informe histórico solicitado no pudo modificarse sin forzar estado de índice protegido. El nuevo reporte fechado se conserva como evidencia no comprometida.
