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

## CU-08 — Aviso rápido móvil (PAY-38)

- **Actores:** ACT-03 usuario Android; EXT-05 persistencia; EXT-01 Mercado Pago como fuente autoritativa posterior.
- **Flujo principal:** servicio nativo filtra notificación MP y app sincroniza pista con `POST /api/mobile/payment-hints`; se almacena `PENDING` («sin confirmar»). El servidor reconcilia solo con pago MP `bank_transfer` confirmado, importe igual, ±10 minutos y una única pista candidata.
- **Reglas:** una notificación puede falsificarse; nunca confirma dinero por sí sola y no debe sumar a ventas/totales. La decisión la toma el servidor comparando con pago real.
- **Alternativos:** sin permiso Android no hay captura; offline, conserva cola local acotada; duplicado se deduplica; sin match queda pendiente. No hay listener iOS. Flujo no probado en dispositivo físico ni con aviso real (🟡).
- **Cumple:** RF-20/RF-21; RN-22.
- **Evidencia:** `frontend/app/api/mobile/payment-hints/route.ts`; `frontend/lib/payments/notificationParser.ts`; `frontend/lib/payments/notificationHintReconciliation.ts`; `mobile/modules/notification-listener/android/src/main/java/com/tecnofusion/payalert/notifications/PayAlertNotificationListenerService.kt`; `mobile/app/payment-hints.tsx`; `docs/mobile/NOTIFICATION_HINTS.md`.

`frontend/app/dashboard/settings/page.tsx`, `frontend/app/api/notification-preferences/route.ts`, `frontend/lib/server/notificationPreferences.ts`, `frontend/app/api/push/{subscribe,unsubscribe,send}/route.ts`, `frontend/lib/server/push.ts`, migraciones `006_notification_preferences.sql` y esquema inicial de `push_subscriptions`. Decisión email en `docs/DECISIONS.md`. Tests de preferencias/push: [Pendiente: pruebas E2E/dispositivos no identificadas en suite revisada].
