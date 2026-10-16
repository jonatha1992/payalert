# PN5 — Notificaciones y preferencias

## CU-07 — Administrar preferencias y suscripción push

- **Actores:** ACT-01/ACT-02/ACT-03, EXT-03 navegador/servicio Web Push, EXT-05 DB.
- **Precondiciones:** autenticación, sesión activa y permisos de notificación; push necesita navegador compatible/permiso explícito y HTTPS para producción.
- **Flujo principal:**
  1. Actor visita `/dashboard/settings`.
  2. Lee preferencias vía `GET /api/notification-preferences` y actualiza push/sonido/email vía PATCH.
  3. El servidor valida alcance del usuario y persiste preferencias asociadas a usuario+negocio.
  4. Si activa push, cliente solicita permiso de navegador y registra suscripción en `/api/push/subscribe`.
  5. Para desactivar/eliminar dispositivo, llama `/api/push/unsubscribe`.
  6. Durante CU-03, servidor selecciona destinatarios elegibles y envía aviso por Web Push de acuerdo a suscripción/preferencia.
- **Alternativos:** permiso navegador denegado → no registrar; suscripción inválida/expirada → fallo seguro y limpieza según capacidad; usuario no autorizado → no consultar preferencias ajenas; email activado en UI no dispara email si no hay transportista implementado.
- **Postcondición:** preferencias persistidas y/o suscripción Web Push gestionada; ninguna afirmación de entrega garantizada fuera del resultado técnico de envío.
- **Cumple:** RF-13, RF-14; RN-01, RN-02, RN-13, RN-17, RN-20.
- **Relaciones UML:** CU-07 «include» consultar/actualizar preferencias; alta de push es opcional; aviso se incluye al completar CU-03 cuando hay destinatario válido. Email pendiente, no actor de envío.

### Evidencia
`frontend/app/dashboard/settings/page.tsx`, `frontend/app/api/notification-preferences/route.ts`, `frontend/lib/server/notificationPreferences.ts`, `frontend/app/api/push/{subscribe,unsubscribe,send}/route.ts`, `frontend/lib/server/push.ts`, migraciones `006_notification_preferences.sql` y esquema inicial de `push_subscriptions`. Decisión email en `docs/DECISIONS.md`. Tests de preferencias/push: [Pendiente: pruebas E2E/dispositivos no identificadas en suite revisada].
