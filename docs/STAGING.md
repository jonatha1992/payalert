# PAY-8 — Preparar staging

Esta guía no ejecuta cambios. Las migraciones, configuración de Vercel, registro de webhooks y validación de proveedores requieren aprobación y accesos de Jonatan. No usar datos ni credenciales de producción en staging.

## 0. Precondiciones y revisión de migraciones

- [ ] Confirmar que Supabase/Vercel apuntan al proyecto **staging**, con backup/snapshot recuperable. No correr comandos sobre producción.
- [ ] Confirmar que la base ya tiene el esquema base de `docs/migrations/parte1-3` (o su equivalente vigente): `businesses`, `users`, `stores`, `transactions`, `payment_tokens`, `webhook_logs`, `audit_logs` y `update_updated_at_column()`. `005` no es autónoma ni crea estas dependencias; sus policies tenant ahora consultan las columnas de `public.users`, no funciones `get_my_*` inexistentes en el repo.
- [ ] No ejecutar `docs/migrations/004_datos_prueba.sql`: contiene `TRUNCATE ... CASCADE` sobre tablas del negocio; no es una migración de staging segura.
- [ ] Revisar duplicados antes de aplicar el índice único que requiere el upsert del webhook:

  ```sql
  SELECT provider, external_id, count(*)
  FROM public.transactions
  WHERE external_id IS NOT NULL
  GROUP BY provider, external_id
  HAVING count(*) > 1;
  ```

  Debe devolver cero filas. Investigar/reconciliar duplicados antes de continuar; `005` crea `uq_transactions_provider_external` solo si aún no existe y no borra filas duplicadas.

- [ ] Verificar el orden, sin omitir el esquema base:
  1. esquema base `parte1-3` (o versión ya aplicada); asegurar `audit_logs` y `update_updated_at_column()`;
  2. `frontend/docs/update_v2_full.sql` y `frontend/docs/setup_ipn_table.sql` si el entorno aún depende de esos scripts/objetos legacy, conforme a la cabecera de `005`;
  3. `docs/migrations/005_payments_hardening.sql`;
  4. `docs/migrations/006_notification_preferences.sql`.
- [ ] En `005`, tener presente que `payment_connections` se crea sin policies RLS intencionalmente (acceso server/service role). La migración quita las policies legacy conocidas de `payment_tokens`; no elimina la tabla. No ejecutar el `DROP TABLE` comentado hasta completar migración, cotejo y aprobación aparte.
- [ ] Revisar `005`: el índice único ahora usa `CREATE UNIQUE INDEX IF NOT EXISTS` y conserva el índice existente en re-ejecución. El primer alta puede fallar si el pre-check encuentra duplicados; reconciliarlos antes de migrar. Si ya existía un índice con ese nombre pero definición distinta, verificar su definición en catálogo antes de confiar en él.
- [ ] Revisar `006`: se corrigió la idempotencia de las tres policies con `DROP POLICY IF EXISTS` y se quitó la extensión `uuid-ossp`, que la tabla no usa. El trigger también se reemplaza al re-ejecutar. Su tabla requiere `auth.users`, `businesses` y `update_updated_at_column()`. No hay rollback automático seguro.

> Rollback: no revertir a ciegas. `005` agrega columnas/tabla/índices y cambia RLS/constraints; `006` almacena preferencias de usuarios. Un rollback destructivo perdería datos o reabriría acceso a tokens. Preparar SQL inverso específico sobre una copia, preservar `payment_tokens` hasta verificar migración y definir si los webhooks/escrituras se pausan. Solicitar aprobación antes de ejecutar rollback en staging.

## 1. Secretos y variables de entorno

Inspeccionado con búsqueda de `process.env` en fuentes de `frontend/`, excluyendo `.next`, `node_modules` y artefactos. Los nombres están completos; no se incluyen valores.

| Variable | Alcance/uso | Sensibilidad y generación |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Obligatoria para cliente, proxy y servidor | No es secreto; copiar URL del proyecto staging de Supabase. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Obligatoria para cliente/proxy y sesión | Clave pública/anon; copiar solo del proyecto staging. No confundir con service role. |
| `SUPABASE_SERVICE_ROLE_KEY` | Obligatoria para APIs server-side y migrador legacy | **Secreto crítico, bypass de RLS**; obtener del proyecto staging Supabase; no exponer con prefijo `NEXT_PUBLIC_`, no registrar ni commitear. |
| `PAYMENTS_ENCRYPTION_KEY` | Obligatoria al cifrar/descifrar credenciales y correr el migrador | **Secreto crítico**; generar una clave exclusiva de staging con `openssl rand -base64 32`; 32 bytes. Guardar en gestor seguro y respaldar con control de acceso: perderla hace ilegibles las credenciales cifradas. No rotar sin plan de recifrado. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Push en cliente y servidor | Pública; generar el par con `npx web-push generate-vapid-keys` y usar la clave pública correspondiente al entorno. |
| `VAPID_PRIVATE_KEY` | Push server-side | **Secreto**; usar la clave privada del mismo par VAPID de staging; nunca `NEXT_PUBLIC_`. |
| `VAPID_SUBJECT` | Identidad del emisor push | No es secreto; `mailto:` de soporte/contacto operativo. En código tiene default. |
| `PAYMENTS_ENABLE_SIMULATOR` | Habilita simulador de pagos | Flag no secreto. Mantener ausente/`false` en staging compartido salvo prueba explícitamente aprobada; código lo evalúa como `true` literal. |
| `NODE_ENV` | Next.js y scripts | Variable de entorno del runtime, no secreto; Vercel/Next la determina. No configurarla manualmente salvo necesidad documentada. |
| `PAYMENTS_IT_URL` | Suite de integración externa | Solo tests; URL de Supabase aislada de pruebas. No hace falta para deploy. |
| `PAYMENTS_IT_KEY` | Suite de integración externa | Solo tests; **tratar como secreto** (credencial de prueba), mínimo privilegio y no producción. No hace falta para deploy. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_FIRST_NAME`, `ADMIN_LAST_NAME` | Script auxiliar `scripts/create-admin.js` | Solo tarea operativa local. `ADMIN_PASSWORD` es secreto (generar contraseña única en gestor); no se configuran en Vercel. No ejecutar en producción. |
| `SEED_USER_PASSWORD`, `SEED_OWNER_EMAIL`, `SEED_EMPLOYEE_EMAIL`, `SEED_ADMIN_EMAIL` | Script auxiliar `scripts/seed_users.js` | Solo seed local; contraseña secreta. No configurar ni correr contra staging compartido/producción. |

`MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` y `UALA_WEBHOOK_SECRET` aparecen en la guía vieja `docs/DEPLOY_VERCEL.md`, pero **no son `process.env` requeridas por el código actual**. El flujo actual captura credenciales por conexión y las cifra; MP webhook secret se guarda con la conexión. Ualá v2 no firma el webhook: valida el UUID contra la orden esperada y consulta Ualá. No cargar tokens globales en Vercel siguiendo esa guía obsoleta. Las credenciales por comercio (MP access token/webhook secret; Ualá `username`, `client_id`, `client_secret_id`) sí son secretos: obtenerlas del panel/cuenta del comercio e ingresarlas por el flujo autenticado de Integraciones; no anotarlas en tickets ni logs.

## 2. Aplicar migraciones a staging

- [ ] Jonatan confirma proyecto/URL de staging y permisos; verificar el nombre del proyecto en consola antes de cada acción.
- [ ] Confirmar prerequisitos y pre-check de duplicados de la sección 0.
- [ ] Revisar la idempotencia y seguridad de `005`/`006` ya corregidas; guardar copia del SQL aprobado y plan de recuperación.
- [ ] Ejecutar en SQL Editor de Supabase **staging** en el orden indicado. No pegar secretos al editor. Capturar resultado (sin datos sensibles) y verificar tablas/columnas/índices/policies esperados.

## 3. Variables de Vercel

Seguir `docs/DEPLOY_VERCEL.md` para Project → Settings → Environment Variables, pero usar los nombres/alcances de la tabla actual, solo para **Preview/Staging** (no Production). Requisitos mínimos del runtime: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `PAYMENTS_ENCRYPTION_KEY`; para push, el par VAPID y opcionalmente `VAPID_SUBJECT`. No copiar valores de ejemplo o credenciales publicados en documentación. Revisar que secretos no tengan `NEXT_PUBLIC_` y que cada URL/clave sea del mismo proyecto staging.

## 4. Migrar `payment_tokens` (dry-run primero)

- [ ] Tomar backup exportable de `payment_tokens`; no eliminar la tabla ni las policies de bloqueo.
- [ ] En máquina confiable, con Node instalado y únicamente credenciales del proyecto staging, cargar variables desde un gestor seguro sin escribirlas en historial/terminal. Ejecutar primero:

  ```bash
  cd frontend
  node ../scripts/migrate-payment-tokens.mjs --dry-run
  ```

  El script requiere `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y `PAYMENTS_ENCRYPTION_KEY`. **Dry-run contacta la base para leer tokens activos**, aunque no realiza inserts/updates; por eso solo usarlo tras confirmación explícita sobre staging y verificar el host/proyecto antes de ejecutar.
- [ ] Revisar conteos y advertencias: proveedor desconocido y credenciales Ualá sin `client_secret_id` se omiten/requieren reconexión. No copiar logs con IDs o datos sensibles en tickets.
- [ ] Con aprobación explícita, repetir sin `--dry-run` contra staging. El script no chequea el error de escritura de `audit_logs`; cotejar también por separado.
- [ ] Verificar conexiones por negocio/proveedor, estado y disponibilidad del descifrado en la app, sin imprimir secretos. Comparar con tokens activos y resolver faltantes/duplicados.
- [ ] Solo después del cotejo y aprobación adicional: evaluar retirar `payment_tokens`; por defecto queda preservada como rollback.

## 5. Registrar webhooks

- [ ] Desplegar Preview/branch `dev` a URL exclusiva de staging y confirmar URL HTTPS.
- [ ] Mercado Pago: Jonatan configura en aplicación de prueba el endpoint `https://<staging>/api/webhooks/mercadopago`, evento `payment`. Registrar secret en la conexión MP del comercio de prueba desde Integraciones; el handler exige firma y consulta la API del proveedor.
- [ ] Ualá Bis v2: configurar callback `https://<staging>/api/webhooks/uala` en stage, con credenciales de sandbox/stage asociadas a conexión. Ualá v2 no firma; el handler solo procesa órdenes conocidas y reconsulta el estado en API.
- [ ] No registrar webhooks en paneles productivos como parte de PAY-8. La guía `DEPLOY_VERCEL.md` describe configuración global antigua; la fuente actual por provider es `docs/providers/mercadopago.md` y `docs/providers/uala.md`.

## 6. Smoke tests post-deploy (solo staging)

- [ ] Confirmar despliegue listo, HTTPS y variables presentes desde la consola; no imprimir valores.
- [ ] Login/logout y acceso de owner; confirmar aislamiento entre dos tenants (owner A nunca consulta/escribe datos de B).
- [ ] Revisar Integraciones: conectar credenciales de prueba; confirmar que el listado no revela tokens/secrets; ejecutar health check.
- [ ] Mercado Pago sandbox: evento de pago firmado de prueba; comprobar respuesta y una única transacción tras reintento; firma ausente/inválida rechazada.
- [ ] Ualá stage: crear orden de bajo monto con aprobación; webhook de UUID conocido provoca relectura de orden y una transacción; UUID desconocido no acredita pago. Aclarar la unidad de monto con la prueba de stage antes de producción (ver `docs/providers/uala.md`).
- [ ] Crear/cancelar cobro esperado y probar matching; revisar notificación push si VAPID está configurado.
- [ ] Guardar evidencia de resultados no sensible y revisar logs de Vercel/Supabase sin volcar payloads, tokens o claves.
- [ ] No probar usando los `curl` de ejemplo de `DEPLOY_VERCEL.md` como aceptación: son payloads sintéticos sin firma y no prueban un flujo real de proveedor.

## Acciones exclusivas de Jonatan

- Acceso a Vercel/Supabase, confirmar proyectos de staging, snapshot/backup y aplicar migraciones SQL.
- Guardar secretos reales en gestor/Vercel; obtener/generar claves, nunca compartirlas en chat.
- Aprobar y correr dry-run (que lee datos) y, luego de revisar, el migrador real; decidir si conservar o retirar legacy tokens.
- Acceso a paneles Mercado Pago/Ualá para crear credenciales sandbox/stage y registrar endpoints webhook.
- Ejecutar smoke tests de proveedor, prueba aislada de dos tenants y autorizar cualquier rollback/cambio destructivo.
