# PAY-20 — Plan de app móvil

**Estado:** F1 completado el 2026-10-16: app Expo SDK 58 Android en `mobile/`, login Supabase con SecureStore, API tipada con Bearer y pantallas Inicio/Notificaciones; pruebas API/push y bundle Android verificados. No hay selector empresarial: `users.business_id` es único por usuario. Distribución actual: APK development/preview instalada directamente vía EAS Build o build local; publicación en tienda es fase futura, no ahora. `com.tecnofusion.payalert` es inferido y requiere confirmar titularidad antes de publicar. Expo version: `58.0.12`; no verificado en teléfono físico. Commits: `399cb907a25bff6f26a94e2bf4e48db9ec975a80` (app) y `c8592038ed5b8abc32c1ffe53b6235b662212244` (plan).


## 1. Objetivo y alcance

Crear una app Android con React Native y Expo para iniciar sesión, consultar feed/búsqueda/detalle de movimientos, gestionar cobros esperados y revisar matches, recibir push nativo, y administrar perfil, preferencias y configuración. La web sigue siendo un producto soportado; la app móvil no la reemplaza. La publicación en tienda es fase futura, no ahora; la distribución actual se limita a APK de desarrollo/preview instalado directamente en teléfonos Android.

El cliente consume los contratos HTTP existentes cuando sean compatibles. La autorización, el alcance de tenant/sucursal y toda operación financiera siguen en el servidor. La aplicación no accede con credenciales privilegiadas a Supabase.

## 2. Arquitectura: monorepo

**Recomendación: `mobile/` dentro de este repositorio**. No conviene un repositorio separado: web y móvil comparten backend, modelo, nombres de campos y evolución de contratos; mantenerlos juntos facilita cambios coordinados y reduce tipos duplicados y drift. No compartir componentes web con React Native ni importar módulos server-only al bundle móvil.

Expo Router para navegación/deep links; `@supabase/supabase-js` para Auth en React Native, con almacenamiento seguro apropiado para sesión (SecureStore o adaptador documentado por Supabase). La app llama las rutas Next.js por HTTPS; `EXPO_PUBLIC_*` solo puede contener valores públicos, nunca service-role ni secretos. Extraer tipos/DTOs puros y validadores de contratos —no la implementación Next, DB ni dominio de pagos— al paquete compartido. Evolucionar rutas con compatibilidad y pruebas de contrato.

## 3. Autenticación móvil, empresa y RBAC

**Hallazgo:** `frontend/lib/server/session.ts` construye `createServerClient` de `@supabase/ssr` leyendo exclusivamente cookies de `NextRequest`; `getSessionProfile()` llama `supabase.auth.getUser()` y resuelve el usuario/rol/empresa/sucursal desde `users`. El hook web llama `/api/push/subscribe` con `fetch` same-origin sin bearer explícito. Por lo tanto, la app nativa no puede autenticarse contra las rutas actuales enviando solo el JWT: necesita cookie compatible o el cambio mínimo siguiente.

**F0 requerido:** ampliar el resolvedor de sesión para aceptar `Authorization: Bearer <access_token>` de Supabase Auth además de la cookie web; validar el token con Supabase Auth (no decodificarlo sin verificar), resolver luego el mismo perfil en servidor y ejecutar el mismo `requirePermission` + `resolveScope`. Respuestas no autenticadas 401, sin ampliar permisos. No aceptar `businessId`/`storeId` enviados por el cliente como autoridad. El cliente obtiene y refresca su sesión mediante Supabase Auth, almacena tokens con almacenamiento seguro y adjunta el access token a cada request a la API. **Nunca usar `SUPABASE_SERVICE_ROLE_KEY` en móvil.** Alternativa de token exchange/cookies móviles no es necesaria si se implementa este bearer.

El esquema actual del perfil expone un solo `business_id` por usuario; memberships multiempresa no forman parte del modelo disponible para esta fase, por lo que F1 no muestra selector. La sucursal asignada limita el alcance de empleados. Cada ruta debe volver a aplicar `resolveScope`, comprobar pertenencia de sucursal y permisos de `rbac.ts`; el cliente no reemplaza RBAC. Confirmar en PAY-17 la matriz efectiva: `admin` se mapea a manager, hoy con permisos equivalentes a owner en la matriz; support figura en RBAC pero no en el tipo de sesión legacy.

## 4. Notificaciones nativas

Hoy existe Web Push: `frontend/lib/server/push.ts` elige usuarios owner o empleados de la sucursal y envía a `push_subscriptions`; `frontend/lib/server/webhookHandler.ts` invoca ese envío tras ingestión/matching. Las rutas `/api/push/subscribe|unsubscribe|send` y `/api/notification-preferences` son cookie-auth. PAY-19 ya tiene preferencias por `(user_id, business_id)` (`push_enabled`, `sound_enabled`, `email_enabled`); en el código observado, `sendPushToBusiness` no consulta esa tabla, así que F0 debe cerrar la brecha y filtrar por preferencia antes de ambos canales.

Agregar migración idempotente `device_push_tokens`: id, `business_id` (tenant), `user_id`, plataforma (`android`), `expo_push_token`, `last_used_at`, `revoked_at`, `created_at`/`updated_at`; índice/constraint de unicidad del token y consultas por usuario/empresa. Validar que el `user_id` venga de sesión, que la empresa sea la del scope autenticado y no aceptar tenant arbitrario. Endpoint autenticado de registro hace upsert y refresca último uso; baja revoca/elimina solo el token del dispositivo asociado al usuario autenticado. Revocar tokens de sesión/dispositivo al cerrar sesión si el producto así lo define; no desactivar otros dispositivos del usuario.

Expo Push Service entrega Android vía FCM. El canal móvil envía `ExpoPushToken` detrás de una interfaz para permitir FCM directo si luego hiciera falta. Mantener filtrado server-side por tenant/sucursal/rol y payload no sensible; la app obtiene detalles autenticada desde la API. F1 solo implementa registro, baja y prueba local en Android.

Tratar tickets y recibos como estados distintos: un ticket `ok` confirma recepción por Expo, no entrega al dispositivo. Registrar IDs de ticket de forma acotada, consultar recibos de forma diferida y limpiar/revocar tokens ante `DeviceNotRegistered`; reintentar errores transitorios con backoff y límites. No loguear tokens ni payloads sensibles. Mantener conteos/errores por canal para observabilidad sin PII.

## 5. Fases, aceptación y esfuerzo

Estimación relativa: **S** acotado; **M** varias capas; **L** integración/migración o alta incertidumbre. Las fases se ejecutan después de estabilizar web y en orden.

| Fase | Alcance | Criterio de aceptación | Esfuerzo |
|---|---|---|---|
| **F0 — Prerequisitos backend** | Bearer Supabase en resolvedor de sesión; tabla/índices y endpoints de dispositivos; sender Expo junto al canal web; preferencias respetadas por ambos; payload mínimo; pruebas de auth/tenant/RBAC, registro/baja, preferencias, fanout y tokens inválidos. | JWT válido permite lo mismo que cookie según RBAC; expirado/inválido da 401; tenant/sucursal cruzados dan 403; web no regresa; Expo recibe por mismo evento y usuarios con `push_enabled=false` no reciben en ningún canal; token revocado/no registrado se deja de usar. | **L** |
| **F1 — Esqueleto Expo Android** | `mobile/`, Expo Router, login/logout, sesión segura, cliente API bearer, registro/baja de token y notificación local de prueba; APK development/preview distribuible directamente por EAS, sin tienda. | Bundle Android, typecheck y tests automatizados; teléfono real requerido para confirmar login/push. Un usuario corresponde a un `business_id`, no hay selector. | **M** |
| **F2 — Movimientos** | Feed paginado, búsqueda/filtros existentes, detalle de movimiento. | Datos/orden/filtros coinciden con contratos web/API; paginación estable; acceso cross-tenant/sucursal negado por servidor; estados de carga/error/vacío probados. | **M** |
| **F3 — Cobro esperado y caja** | Crear/listar/consultar cobro esperado; mostrar candidatos; resolver/descartar match según permisos. | Crear y resolver invocan rutas existentes; cliente no realiza matching; conflictos/duplicados y permisos denegados se manejan sin asignaciones dobles; escritura auditable server-side. | **L** |
| **F4 — Perfil y configuración** | Perfil, preferencias de notificación, configuración autorizada y administración del dispositivo. | Cambios persisten vía API; preferencias aplican a web y móvil; funciones/controles respetan RBAC; cierre de sesión permite baja del token propio. | **S–M** |
| **F5 — Publicación en tienda (fase futura, no ahora)** | Build firmado y distribución pública en Google Play, políticas, ficha, privacidad y publicación gradual. | Solo iniciar cuando se decida publicar en tienda y el dueño aporte cuentas/credenciales; no bloquea APK preview por distribución interna. | **M** |

## 6. Qué no duplica el cliente

- Ingesta/verificación de webhooks, consulta autoritativa al proveedor, normalización e idempotencia: solo backend.
- Matching automático, candidatos, unicidad y resolución/auditoría: solo backend; el cliente presenta evidencia y envía la decisión humana autorizada.
- Firma/verificación de eventos, cifrado y descifrado de credenciales/tokens de pago, secretos y claves: siempre backend.
- Scoping multi-tenant, permisos, preferencias efectivas y selección de destinatarios: siempre backend.

## 7. Lo que necesita el dueño

- El dueño no necesita cuenta de Google Play Console ni pagar la tasa de tienda en esta fase; la distribución actual es APK de desarrollo/preview instalado directamente desde EAS o build local. La publicación en Google Play es fase futura, no ahora; sus requisitos y costos se confirmarán al retomarla.
- Aprobar nombre, `applicationId` Android (`com.tecnofusion.payalert`, inferido de Tecnofusión; confirmar titularidad antes de publicar), equipo propietario y enlaces de privacidad/soporte.
- Crear/configurar proyecto Expo/EAS y proyecto Firebase gratuito para FCM v1. Guardar claves privadas únicamente en EAS/gestor de secretos; no escribir valores en repo, issue ni documentación.
- Definir testers, política de datos/retención, texto de permisos push y modelo de memberships multiempresa si se requiere más de una empresa por usuario.

## 8. Riesgos y mitigaciones

- **Publicación en tienda (fase futura, no ahora):** no es requisito para el APK preview de instalación directa; revisar cuentas, privacidad y políticas cuando se apruebe esa fase.

- **Privacidad financiera:** push aparece en pantalla bloqueada y puede duplicarse o demorarse; usar texto genérico, no PII ni importes, y tratar aviso como señal para volver a consultar API autenticada.
- **Auth/RBAC:** bearer amplía superficie de API; validar firma/expiración con Auth, rate-limit, no registrar tokens, y cubrir cada ruta; no confiar en selector de empresa de UI.
- **Doble mantenimiento y contratos:** mantener tipos/DTOs compartidos y pruebas de contrato; no compartir lógica server-only ni crear endpoints móviles paralelos sin necesidad.
- **Entrega no garantizada:** Expo/FCM son best-effort; diseñar feed como fuente de verdad y reintentos/limpieza por recibos, sin prometer entrega push instantánea.

## 9. Relación con PAY-19 y PAY-17

- **PAY-19:** reutilizar `user_notification_preferences` y `GET/PATCH /api/notification-preferences`; F0 debe hacer que `push_enabled` se aplique en el pipeline actual y al nuevo canal Expo. No duplicar una configuración separada para móvil sin decisión de producto.
- **PAY-17:** usar la sesión/perfil y autorización server-side existentes (`getSessionProfile`, `requirePermission`, `resolveScope`, `rbac.ts`); F0 agrega bearer sin saltarse auditoría ni elevar permisos. Revisar las brechas de roles/scope señaladas antes de exponer capacidades en móvil.

## Fuentes técnicas oficiales consultadas

Fuentes oficiales consultadas el **2026-10-16** (fecha de consulta; los precios/requisitos pueden cambiar):

- Expo Notifications/FCM Android: <https://docs.expo.dev/push-notifications/push-notifications-setup/> y <https://docs.expo.dev/push-notifications/fcm-credentials/>. Push remoto requiere permiso, token Expo y credenciales FCM; desde SDK 53 no está disponible en Expo Go para Android y requiere development build.

- Expo Push Service, tickets/recibos y errores `DeviceNotRegistered`: <https://docs.expo.dev/push-notifications/sending-notifications/>. Expo informa best-effort, no SLA; `ok` del ticket significa aceptado por Expo, no recibido por el usuario.
- Expo Router y deep links: <https://docs.expo.dev/router/introduction/> y <https://docs.expo.dev/router/basics/core-concepts/>.
- Supabase React Native/Expo: <https://supabase.com/docs/guides/getting-started/quickstarts/expo-react-native>; SecureStore: <https://docs.expo.dev/versions/latest/sdk/securestore/>. Supabase recomienda storage seguro para sesión/tokens; el adaptador concreto se debe validar con tamaño/refresh del SDK elegido.
- Supabase JWT, sesiones y SSR cookies: <https://supabase.com/docs/guides/auth/jwts>, <https://supabase.com/docs/guides/auth/sessions>, <https://supabase.com/docs/guides/auth/server-side/nextjs>. Supabase admite JWT de usuario como `Authorization: Bearer`; el repo hoy resuelve por cookies, de ahí el cambio mínimo F0.
- EAS Build/Submit e internal distribution/: <https://docs.expo.dev/build/introduction/>, <https://docs.expo.dev/build/internal-distribution/> y <https://docs.expo.dev/submit/introduction/>.
- Google Play Console: <https://support.google.com/googleplay/android-developer/answer/4536273>. Publicación en tienda es fase futura, no ahora; confirmar costo/requisitos vigentes al aprobarla.

**No confirmado:** si PayAlert ya tiene proyecto EAS/Firebase, dominio de publicación o presupuesto; si el backend desplegado y el proyecto Supabase tienen membresías multiempresa activas; configuración vigente de autenticación/keys del proyecto. No se incluyen valores de secretos.