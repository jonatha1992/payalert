# ADR-002: Membresías multiempresa por usuario

- **Estado:** Propuesta
- **Fecha:** 2026-10-15
- **Ticket:** PAY-23
- **Decisión pendiente:** validar el caso de uso y los permisos con Producto antes de implementar.

## Contexto y evidencia

El ticket PAY-23 indica que el PRD, requisito 8/35, permite que un usuario pertenezca a más de una empresa, mientras el modelo actual guarda un único `users.business_id`. En el repositorio consultado no se encontró un documento del PRD que exponga el requisito 8/35; se toma esa afirmación del ticket, sin atribuirle detalles adicionales.

La evidencia actual confirma el acoplamiento al tenant único:

- `docs/database_schema.sql` define `users.business_id`, `users.role` y `email UNIQUE`; `assigned_store_id` existe en `docs/migrations/parte2_tablas.sql` y `docs/migrations/RESET_COMPLETO.sql`.
- Las migraciones `docs/migrations/parte3_indices_rls.sql` y `docs/migrations/007_pay17_rbac_audit.sql` definen policies sobre `users.business_id` y roles guardados directamente en `users`.
- `frontend/lib/server/session.ts` carga rol, negocio y tienda desde `users`; `frontend/lib/server/scope.ts` resuelve ese solo negocio, salvo el usuario `admin`, y rechaza otro `businessId` solicitado.
- `frontend/lib/server/rbac.ts` establece permisos según el rol global de perfil (`owner`, `admin`, `employee`), no un rol asociado a cada tenant.
- `frontend/proxy.ts` renueva sesión Supabase y protege rutas; no selecciona ni valida tenant activo.
- `frontend/app/dashboard/page.tsx` escucha `payments` mediante Realtime sin filtro de negocio en la suscripción, y filtra en el callback usando `myStores`. `frontend/app/dashboard/terminal/page.tsx` suscribe cambios de `transactions` filtrados por `store_id`.
- `frontend/lib/server/push.ts` elige destinatarios desde `users.business_id`, y luego subscriptions por `user_id`; `frontend/lib/server/audit.ts` escribe `business_id` y actor en `audit_logs`.
- El cliente Supabase con service role en `frontend/lib/server/session.ts` omite RLS; sus consultas requieren filtros/validaciones explícitos. La migración de RLS no reemplaza esas comprobaciones.

## Propuesta de diseño

### Modelo

Agregar `public.memberships` con, como mínimo:

- `id UUID PRIMARY KEY` (o clave compuesta decidida al definir las migraciones), `user_id UUID NOT NULL REFERENCES public.users(id)`, `business_id UUID NOT NULL REFERENCES public.businesses(id)`, `role` por tenant, `assigned_store_id UUID NULL` donde aplique, estado (`invited`, `active`, `suspended` o equivalente por validar), `created_at`, `updated_at`.
- Restricción única `(user_id, business_id)` para evitar membresías duplicadas; índices por `(user_id, status)` y `(business_id, role)`.
- Las membresías activas, no el valor de tenant enviado por el navegador, serán la autoridad para autorizar acceso. Definir integridad para que `assigned_store_id`, si existe, pertenezca al mismo `business_id`.
- `users` conserva identidad global (id de Auth, email único, nombre, avatar y preferencias verdaderamente personales). `role`, `business_id` y `assigned_store_id` dejan de ser la fuente final de autorización cuando finalice el corte. El caso `admin` global debe tener un mecanismo distinto y explícito; no convertirlo en membresía ordinaria sin decisión de producto/seguridad.

Una invitación pendiente puede representarse en una tabla `invitations` con negocio, email normalizado, rol propuesto, tienda opcional, creador, token de aceptación almacenado de forma segura, expiración, estado y timestamps. No conceder acceso de tenant antes de aceptación y creación/activación de la membresía. Email case-folding, expiración, revocación y comportamiento para email ya registrado quedan por decidir.

### Tenant activo y selector

Al iniciar sesión, listar únicamente negocios con membresía activa. Si hay más de uno, exigir selección; si hay uno, puede proponerse selección automática. Mostrar el negocio activo en UI y permitir cambiarlo mediante acción server-side que compruebe membresía vigente.

Propuesta inicial: cookie `active_business_id` opaca, `HttpOnly`, `Secure` en producción, `SameSite=Lax`, con vida limitada; treat it as a selector no confiable, nunca como autorización. En cada request sensible, cargar `getUser()`, obtener membresía activa del usuario para el negocio seleccionado y derivar desde ella rol y tienda; rechazar selección ausente/revocada. No se recomienda un custom JWT claim sin flujo explícito de refresco/invalidez de sesiones: la cookie evita depender de claims persistentes, pero requiere validación server-side por request. El proxy puede propagar/renovar la cookie, pero no debe ser el único control de acceso. Evitar poner tenant en URL como autoridad; aceptar `businessId` de parámetros solo como filtro solicitado y contrastarlo con membresía autorizada.

### Migración de datos sin downtime (propuesta)

1. Crear `memberships` e `invitations`, índices y constraints de forma compatible y aditiva. Backfill `users.business_id IS NOT NULL` como membership activa con `role` y `assigned_store_id` actuales; usuarios `admin` sin negocio quedan fuera y se tratan según decisión explícita. Validar filas faltantes, duplicados y tienda que no corresponda.
2. Desplegar lecturas duales temporalmente: membership primero con fallback documentado al campo legado solo para usuarios aún no migrados. Toda escritura de rol/tienda/negocio actualiza membership y mantiene espejo legado de forma transitoria. No habilitar usuarios en dos negocios hasta que todos los caminos críticos lean membership.
3. Migrar endpoints y consumidores por área; instrumentar discrepancias entre resultado legado y nuevo. Mantener RLS compatible con ambas fuentes solo durante la ventana acotada.
4. Cambiar autorización/RLS a memberships, activar selector y luego habilitar invitaciones/múltiples memberships tras validación. Verificar conteos, RLS y pruebas cross-tenant antes de cambiar el tráfico.
5. Dejar de escribir legacy; observar errores y discrepancias. En una release posterior, retirar columnas legacy y policies antiguas. La reversión consiste en volver al binario anterior mientras se conserva la tabla nueva; antes de permitir membresías múltiples, congelar nuevas asignaciones múltiples o definir qué membership se reflejaría en el único `users.business_id`. No borrar datos nuevos durante rollback.

## Impacto por área

- **RLS:** reescribir policies de negocios, usuarios, tiendas, pagos, transacciones, tokens, auditoría, webhooks y push para comprobar `auth.uid()` contra `memberships` activas y rol de la membresía correspondiente. Revisar `docs/database_schema.sql` y `docs/migrations/parte3_indices_rls.sql`, además de la política endurecida más reciente en `docs/migrations/007_pay17_rbac_audit.sql`. Definir si la identidad de DB recibe tenant activo (por claim/contexto validado) o si cada policy permite todos los memberships activos del usuario; la segunda opción puede devolver filas de varias empresas en una misma consulta y no basta para la UX del tenant activo. Probar `USING` y `WITH CHECK` en cada operación. Revisar vistas y funciones, y privilegios/service role por separado.
- **Queries / autorización server-side:** reemplazar el `SessionProfile` de `frontend/lib/server/session.ts` y el contrato `resolveScope` de `frontend/lib/server/scope.ts` para derivar `role`/tienda de la membership del tenant activo. Auditar handlers y repositorios que usan `businessId`, incluyendo `frontend/lib/server/paymentsRepository.ts`, `connections.ts`, `expectedPayments.ts`, `notificationPreferences.ts` y las rutas API. Validar ownership de tiendas y cada ID relacionado bajo el tenant resuelto antes de consultas service-role. No confiar en query/body/cookie sin verificación.
- **Roles:** `frontend/lib/server/rbac.ts` y `requireKnownRole` deben recibir el rol contextual, no el perfil global. Definir si se mantiene el mapa actual (`owner/admin/employee`) o se introduce granularidad; no asumir que `admin` significa manager por tenant.
- **Realtime:** añadir filtro tenant/tienda en `frontend/app/dashboard/page.tsx`; mantener o validar filtro de `store_id` en `frontend/app/dashboard/terminal/page.tsx`. Asegurar policies Realtime/RLS antes de emitir eventos y al cambiar tenant, retirar canales antiguos y volver a suscribir; filtrar solo en callback no debe considerarse frontera de seguridad.
- **Push:** actualizar `frontend/lib/server/push.ts` para calcular destinatarios desde memberships activas del negocio, verificar relación membership-tienda y evitar que un usuario con varios tenants reciba notificaciones de otro tenant si su configuración lo excluye. `push_subscriptions` hoy se consulta por `user_id`; decidir si preferencias/subscriptions son globales por usuario o configurables por negocio, y si los payloads necesitan contexto de tenant. La limpieza por endpoint debe conservar la propiedad del recurso.
- **Auditoría:** `frontend/lib/server/audit.ts` ya persiste `business_id` y `actorId`; al cambiar rol/invitar/revocar/cambiar tenant, conservar tenant explícito, actor, sujeto afectado y acción sin depender del tenant global del usuario. Añadir eventos para cambios de membresía y aceptar/revocar invitación; aplicar RLS/indexes en `audit_logs` y definir retención. No registrar tokens de invitación ni secretos.
- **Selector y sesiones:** adaptar provider/perfil de UI (por ejemplo `frontend/components/AuthProvider.tsx`, actualmente con rol/business_id), estados de carga/error y consultas cacheadas al cambiar de tenant; limpiar cache y canales para no mostrar datos del anterior.

## Plan de pruebas cross-tenant

1. Fixtures: mismo usuario activo en A como owner y B como employee, usuario solo A, usuario sin membership activa, membership revocada, invitación pendiente, admin global y employee con tienda asignada. Datos de negocio/tienda/pago/transacción distintos por tenant.
2. RLS con JWT real de cada usuario: SELECT/INSERT/UPDATE/DELETE en cada tabla y vista; A no lee ni altera filas de B; `WITH CHECK` rechaza `business_id` falsificado y referencias cruzadas (tienda, pago, tokens). Confirmar permisos de un rol no se heredan de otro tenant. Probar también función/vistas y Realtime.
3. API/server: alterar parámetros, body, IDs de recursos y cookie de tenant activo; sin membership o con membership revocada debe denegar; solicitud de B con rol A no debe elevar privilegios ni cambiar scope. Repetir con service role y confirmar filtros explícitos.
4. UI/Realtime: cambio A→B limpia estado/caché, termina canal de A y solo recibe eventos de B; manipulación de canal/filtro no filtra datos ajenos.
5. Push: envío A alcanza únicamente destinatarios elegibles de A; usuario compartido recibe solo conforme a preferencias definidas; endpoint inscrito por usuario no provoca fuga de payload entre tenants.
6. Invitaciones: expiración, revocación, reuso, email existente, aceptación concurrente/duplicada, rol/t tienda modificados y acceso antes de aceptar. Probar rollback/reconciliación del backfill y métricas de lecturas duales.

## Riesgos y mitigaciones

- **Fuga entre tenants** por policies o consultas service-role incompletas: migración por área, deny-by-default, tests negativos y revisión de todos los callsites.
- **Permisos ambiguos** por rol hoy global y semántica admin diferente en `rbac.ts`: acordar matriz de permisos antes de migrar.
- **Desfase cookie/estado de sesión** al cambiar o revocar membership: validar en servidor cada request sensible, expiración corta, invalidación/caché controlada y revalidación al cambiar tenant.
- **Downtime o bloqueo de escritura** por backfill/índices/policies: cambios aditivos, backfill por lotes, constraints validadas por fases y rollback con columnas conservadas.
- **Notificaciones o canales cruzados** aun cuando la UI filtre: aplicar autorización del lado servidor/DB y cancelar suscripciones anteriores.
- **Ambigüedad en cuentas sin business_id**, sobre todo admin y usuarios incompletos: inventario y tratamiento explícito, no membership inventada.
- **Inconsistencia de tienda asignada** al trasladar campo a membership: constraint/validación de pertenencia y datos inválidos resueltos antes del corte.

## Preguntas abiertas para Producto / dueño

1. ¿El usuario multiempresa necesita cambiar de empresa manualmente, y hay empresa predeterminada? ¿Puede operar en varias simultáneamente o solo una activa por sesión?
2. ¿Cuáles son los roles por tenant y su matriz exacta? ¿`admin` es rol global, de soporte, o se elimina/transforma? ¿Se permiten varios owners por empresa?
3. ¿Los empleados pueden pertenecer a varias empresas y tener una tienda distinta en cada una?
4. ¿Cómo se identifica y acepta una invitación (email, link, SSO), cuánto dura, quién puede invitar, revocar o cambiar rol, y qué ocurre si el email ya tiene cuenta/membership?
5. ¿Preferencias, notificaciones push, conexiones de pago y configuración son globales o específicas por empresa? ¿Un usuario compartido recibe push de todas las empresas?
6. ¿Qué debe ocurrir con usuarios existentes sin `business_id`, admins actuales, memberships duplicadas o `assigned_store_id` inconsistente?
7. ¿La cookie de tenant activo satisface requisitos de seguridad y producto, o se requiere tenant en sesión/claim? ¿Hay requisito de cambio de tenant en todas las pestañas/dispositivos?
8. ¿Se necesita auditoría de inicio/cambio de tenant, invitación aceptada y cambios de rol; cuál es la retención y quién puede consultarla?
9. ¿Qué comportamiento se espera al eliminar una membership/empresa mientras hay sesiones, canales Realtime o notificaciones push activos?
10. ¿Producto valida explícitamente el escenario PAY-23 del requisito 8/35 antes de iniciar la implementación y quién es el responsable de esa aprobación?
