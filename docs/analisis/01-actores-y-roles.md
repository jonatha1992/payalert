# 01 — Actores y roles

La única definición de actores/roles del paquete está aquí. Los casos de uso los referencian por identificador de rol.

## Actores primarios

| ID | Actor | Descripción y evidencia |
|---|---|---|
| ACT-01 | Dueño / owner | Usuario de negocio con rol persistido `owner`; control de conexión, negocio, sucursales y cobros con permisos definidos por RBAC. |
| ACT-02 | Gerente / manager (legacy `admin`) | Código conserva rol legacy `admin` y lo normaliza a `manager`. En `resolveScope`, admin puede seleccionar negocio; en RBAC actual manager tiene matriz igual al owner en recursos declarados. No inferir administración global de usuarios sin comprobar ruta. |
| ACT-03 | Cajero / cashier (legacy `employee`) | Rol persistido `employee`, normalizado a `cashier`; alcance tienda asignada. |
| ACT-04 | Soporte / support | Rol de producto incluido en matriz RBAC; no hay valor `support` en el tipo legacy ni flujo de asignación autenticada verificado. [Inferido] Es un actor objetivo pendiente de habilitación/definición de identidad. |

## Actores secundarios / externos

| ID | Actor | Interacción comprobada / límite |
|---|---|---|
| EXT-01 | Mercado Pago | Recibe configuración OAuth/conexión; firma webhooks y API de pagos proporciona fuente autoritativa. |
| EXT-02 | Ualá Bis v2 | Conector realiza autenticación, checkout/consulta de orden; callback se resuelve con UUID + consulta API. La guía del proveedor indica que no firma webhook. |
| EXT-03 | Servicio/navegador Web Push | Servicio de push y navegador mantienen suscripción; el envío es interno vía Web Push. |
| EXT-04 | Supabase Auth | Autenticación de sesión a través de cookies y `auth.getUser()`. |
| EXT-05 | Supabase PostgreSQL/RLS | Persistencia y aislamiento; rutas con service role deben aplicar alcance explícito. |
| EXT-06 | Supabase Realtime | Suscripciones aparecen en documentación/cliente, pero el flujo central pago→notificación actual usa webhook/cola y push; Realtime efectivo para cada pantalla no confirmado. |
| EXT-07 | Vercel Cron | Invoca endpoint worker protegido por bearer `CRON_SECRET`; no se verifica configuración del cron productivo. |

## Matriz actor × caso de uso

`X` permitido por modelo funcional; guion indica no asignado al actor en alcance actual. Toda operación queda sujeta a [RN-01](03-reglas-de-negocio.md#rn-01-aislamiento-y-alcance-de-tenant) y matriz específica más abajo.

| Actor | CU-01 conectar | CU-02 salud | CU-03 webhook/ingest | CU-04 crear cobro | CU-05 matching/resolver | CU-06 consultar reportes | CU-07 preferencias/push | CU-08 administrar | CU-09 auditoría | CU-10 worker/replay |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| ACT-01 owner | X | X | — | X | X | X | X | X | X | X (replay owner) |
| ACT-02 manager (admin) | X* | X* | — | X* | X* | X | X* | X* | X | — |
| ACT-03 cashier (employee) | — | — | — | X | X | —** | X | — | — | — |
| ACT-04 support | — | — | — | — | X* | X | — | — | — | — |
| EXT-01 MP | callback/API | API | evento/API | — | — | — | — | — | — | — |
| EXT-02 Ualá | API credencial | API | evento/API | checkout | — | — | — | — | — | — |
| EXT-03 Web Push | — | — | — | — | — | — | entrega | — | — | — |
| EXT-04 Supabase Auth | autentica | autentica | — | autentica | autentica | autentica | autentica | autentica | actor | — |
| EXT-05 Supabase DB/RLS | — | — | persiste | persiste | persiste | consulta | persiste | persiste | persiste | cola |
| EXT-06 Supabase Realtime | — | — | [Inferido] | — | — | consulta | evento | — | — | — |
| EXT-07 Vercel Cron | — | — | — | — | — | — | — | — | — | dispara |


o *El manager/admin obtiene las acciones equivalentes en el mapa RBAC, salvo endpoints OAuth que exigen `role === owner`; no se presupone UX completa. **La matriz declara reportes solo a `report:read`; cajero no tiene permiso RBAC genérico, aunque una pantalla de terminal muestra caja, y no se declara acceso amplio al módulo de reportes. Soporte puede leer reportes y resolver cobros por matriz, pero su autenticación/alcance tenant debe definirse antes de habilitarlo.*

## Matriz de permisos (lectura de `frontend/lib/server/rbac.ts` + `scope.ts`)

| Rol producto | Rol legacy | Permisos por recurso (acciones) |
|---|---|---|
| owner | `owner` | connection read/create/delete; branch read/create/update/delete; report read; movement read/create/update; charge read/create/update/resolve; support read/resolve; user read/create/update/delete/manage; configuration read/update/manage; session read; push create/delete; webhook create. |
| manager | `admin` | Misma matriz declarada que owner en `rbac.ts`. `scope.ts` concede lectura del negocio escogido para admin; su alcance exacto debe considerarse elevado. |
| cashier | `employee` | movement read/create; charge read/create; session read; push create/delete; webhook create. |
| support | sin rol legacy | report read; movement read; charge read/resolve; support read/resolve; session read. No es posible resolverlo con `requireKnownRole` hasta migrar/modelar el rol. |

La función `resolveScope` tiene comportamiento distinto por rol legacy: admin elige negocio; owner queda fijado a su `business_id` y puede pedir sucursal (validada aparte); employee queda forzado a su `assigned_store_id`. El cliente nunca es autoridad del ámbito. Los detalles normativos se centralizan en RN-01 y RN-02.

## Huecos de gobierno de roles

- [Pendiente] Definir quién puede invitar/crear gerente, soporte y cajero y cómo se asignan `business_id` y `assigned_store_id`.
- [Pendiente] Confirmar si gerente debe tener permiso de gestionar usuarios, conexiones y datos financieros igual al dueño; la matriz actual repite permisos de owner.
- [Pendiente] Definir identidad, tenant/sucursal y trazabilidad del actor externo de soporte.
- [Inferido] El hecho de que existan componentes `/admin` legacy no demuestra un panel de administración de roles implementado correctamente; ver [07](07-redundancias-y-viabilidad.md).

### Fuentes de roles

`frontend/lib/server/rbac.ts` líneas 3–27; `frontend/lib/server/scope.ts` líneas 7–75; `frontend/lib/server/session.ts` líneas 21–52; `frontend/app/api/**/route.ts` para enforcement puntual; migración `docs/migrations/007_pay17_rbac_audit.sql`.