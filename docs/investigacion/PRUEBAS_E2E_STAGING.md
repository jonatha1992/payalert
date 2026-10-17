# Pruebas E2E contra staging — 2026-10-16

## Alcance y resultado

No se ejecutaron mutaciones de staging ni se crearon identidades de prueba. El servidor Next local no llegó a estar disponible en `localhost:3100` tras dos intentos de arranque; el proceso de servidor iniciado como tarea de subagente terminó con el ciclo de vida de esa tarea. Sin servidor web y sin acceso validado al proyecto staging, continuar con auth, escritura o browser no sería una prueba E2E segura ni verificable. No se llamó a Mercado Pago/Ualá.

El único endpoint consultado del dominio de staging fue `/auth/v1/health`; respondió HTTP 401 (no autenticado), lo cual no valida conectividad autorizada ni estado del proyecto. No se expusieron claves.

## Casos

| Área | Caso | Resultado | Evidencia / motivo |
|---|---|---|---|
| Local | Arranque de `npm run dev -- -p 3100` | FAIL | `curl http://localhost:3100/login` no pudo conectar; HTTP 000. Intento interactivo detectado como servidor de larga duración y proceso de subagente concluido sin servicio persistente. |
| A | UI auth (email/password) | NO PROBADO | Requiere servidor local operativo y usuario de staging. |
| A | API auth; sin sesión 401 / Bearer válido e inválido | NO PROBADO | No se crearon usuarios ni se realizó login contra staging. |
| B | RBAC owner/manager/cashier, rutas y aislamiento multi-negocio | NO PROBADO | No se escribieron datos de prueba ni se autenticaron roles. |
| C | Cobros esperados: crear/listar/estado | NO PROBADO | No se escribieron datos. |
| D | Webhook MP: firma válida/inválida, ACK, cola e idempotencia | NO PROBADO | Handler inspeccionado; no se creó conexión de prueba ni se envió evento. No se invocó proveedor real. |
| D | Worker y movimiento/match | NO PROBADO | Sin datos del proveedor/fixture ni worker probado. |
| E | Sync manual y última consulta con stub | NO PROBADO | No se creó conexión ni stub. |
| F | Push devices POST/DELETE y scope | NO PROBADO | No se creó sesión ni se enviaron escrituras. |
| G | Métricas internas owner-only | NO PROBADO | Sin sesión autenticada. |
| H | Rate limit y respuesta 429 | NO PROBADO | No se usó la tabla/RPC de staging. |
| I | Google OAuth redirect y callback sin code | NO PROBADO | No se llamó a Supabase Auth. |
| J | Dashboard, integraciones y caja; consola/browser | NO PROBADO | Servidor local no disponible. |
| Limpieza staging | Borrar usuarios/filas e2e- | PASS (no-op) | No se creó ningún dato de staging. |
| Limpieza local | Detener servidor / eliminar `$TMPDIR/e2e.json` | PASS (no-op) | No hubo servidor persistente ni se creó `e2e.json`. |

## Verificación local

- `frontend`: `npm run typecheck` — PASS (`tsc --noEmit`).
- `frontend`: `npm test -- --reporter=dot` — PASS: 32 archivos aprobados, 1 omitido; 187 pruebas aprobadas, 6 omitidas.
- No se encontró ni corrigió un bug de aplicación: no se alcanzó ejecución funcional.
- Cambios ajenos preexistentes respetados: `.vscode/settings.json`, `frontend/app/login/page.tsx` (otro hijo), `frontend/public/sw.js`, `frontend/public/workbox-4754cb34.js`.

## Pendiente

Reintentar con servidor local duradero administrado por el proceso padre y confirmar credenciales/estado de staging de forma segura; completar los casos marcados NO PROBADO y ejecutar limpieza verificable. No se reportan hashes de commit porque este documento no se ha comprometido; no se creó ningún commit.
