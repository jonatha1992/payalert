# Pruebas E2E contra producción y staging — 2026-10-16

## Resumen

El deployment https://payalert-kappa.vercel.app respondió por HTTPS y /login se sirvió como HTML prerenderizado (HTTP 200, X-Matched-Path: /login, X-Vercel-Cache: HIT). No se completó E2E autenticado: el intento anterior no dejó servidor estable, por lo que no se hicieron mutaciones de staging ni se crearon usuarios/datos. No se llamaron Mercado Pago/Ualá.

La respuesta de /login acredita disponibilidad y routing, no login funcional ni consola limpia. No hay evidencia de sesión autenticada en browser.

## Casos y evidencia

| Área | Caso | Resultado | Evidencia / motivo |
|---|---|---|---|
| Producción | GET /login | PASS (solo disponibilidad) | HTTP 200, Content-Type: text/html, X-Matched-Path: /login, prerendered, Vercel cache HIT; no prueba login interactivo. |
| Staging | Proyecto autorizado | PASS (target verificado) | .env y frontend/.env.local apuntan al ref permitido aiobbjrvzhegyagthxdr; secretos no impresos. |
| A | Login UI y sesión owner | NO PROBADO | Sin usuario e2e; no se condujo browser autenticado. |
| A | API auth, 401 sin sesión / Bearer válido OK e inválido 401 | NO PROBADO | Admin Auth con credenciales deliberadamente inválidas respondió 401; no se creó usuario ni Bearer válido. |
| B | RBAC por rol y aislamiento multi-negocio | NO PROBADO | Sin usuarios, negocios ni sucursal e2e. |
| C | Crear/listar/estado de cobros esperados | NO PROBADO | Sin sesión ni fixture. |
| D | Webhook firma válida, ACK/cola, inválida, idempotencia | NO PROBADO | No se creó conexión ni se envió evento. Migración declara unique(provider,dedupe_key); handler inspeccionado delega en handleProviderWebhook, pero no es prueba runtime. No se llamó a MP. |
| D | Worker y sync provider | NO PROBADO | No se invocó worker: una cola pendiente puede provocar llamada a API real de MP. No se contactó MP. |
| E | Sync manual | NO PROBADO | Sin autenticación/conexión; no se consultó provider. |
| F | Push devices POST/DELETE | NO PROBADO | Sin sesión; no hubo mutaciones. |
| G | Métricas owner-only | NO PROBADO | Sin Bearer owner. |
| H | Rate limit 429 | NO PROBADO | No se generó carga ni se alteraron contadores. |
| I | Google OAuth | PASS (redirect únicamente) | Supabase /auth/v1/authorize?provider=google respondió 302; destino no verificado ni flujo completado. |
| I | Callback sin code | PASS (respuesta observada) | Producción /auth/callback respondió 307; destino/contenido no inspeccionado. |
| J | Dashboard, integraciones, caja; consola | NO PROBADO | No hubo sesión/browser; sólo /login se probó por HTTP. |
| Limpieza staging | Usuarios/filas e2e- | PASS (no-op) | No se crearon datos. |
| Limpieza local | Servidor/browser y $TMPDIR/e2e.json | PASS (no-op) | No se lanzó servidor/browser ni se creó archivo. |

## Limitaciones y bugs

- Proyecto permitido confirmado como aiobbjrvzhegyagthxdr. REST y Auth Admin con apikey/bearer inválidos respondieron HTTP 401; esto no valida contenido ni estado de la DB.
- OAuth authorize: HTTP 302. Callback sin code: HTTP 307.
- No se invocó /api/internal/webhook-worker ni mercadopago.com.
- No se reprodujo bug claro; no hubo corrección de código ni test de regresión.
- No se ejecutaron typecheck/tests/build en esta iteración de inspección HTTP/read-only.
- Cambios ajenos respetados: .vscode/settings.json, frontend/app/login/page.tsx (otro hijo), frontend/public/sw.js, frontend/public/workbox-4754cb34.js.

## Pendiente

Repetir el conjunto autenticado con servidor/browser duradero coordinado por el proceso padre y staging poblable. Verificar mutaciones y limpieza mediante lectura posterior. Los resultados funcionales de auth, RBAC y operaciones siguen NO PROBADO; disponibilidad HTTP no equivale a aceptación E2E.
