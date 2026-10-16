# Decisiones — payalert

Registro de decisiones del repo (se actualiza en cada `promote-to-test`).

Formato por entrada: `## YYYY-MM-DD — título` con Contexto, Decisión, Alternativas descartadas, Motivo, Impacto, Ticket/commit.

---

## 2026-10-15 — PAY-8: endurecer migraciones y preparar staging

**Contexto:** La preparación de staging requiere aplicar `005_payments_hardening.sql` y `006_notification_preferences.sql`, migrar de forma segura los tokens legacy y configurar variables/webhooks sin tocar servicios reales.

**Decisión:** Mantener el esquema base como prerrequisito explícito; reemplazar en `005` referencias a helpers `get_my_*` no definidos por scoping contra `public.users`; no borrar `payment_tokens` durante el cutover. Hacer idempotente la creación del índice de transacciones sin eliminar el índice vigente; hacer idempotentes las policies de preferencias y retirar la extensión UUID que la tabla no utiliza. Documentar secretos, orden, dry-run primero, smoke tests y aprobaciones de Jonatan en `docs/STAGING.md`.

**Alternativas descartadas:** Ejecutar 005/006 directamente sin pre-check ni backup; eliminar el índice único antes de recrearlo; dropear `payment_tokens` junto con el deploy; tratar claves de proveedores como variables globales de Vercel.

**Motivo:** Reducir riesgo de ventana sin protección de duplicados, re-ejecución fallida, pérdida de credenciales legacy o exposición de secretos. El dry-run del migrador lee datos con service role, por eso sigue requiriendo aprobación y entorno staging verificado.

**Impacto:** `005` conserva el índice existente al re-ejecutarse, aunque el primer alta aún exige cero duplicados; `006` ya recrea sus tres policies de manera repetible y no pide `uuid-ossp`. `DEPLOY_VERCEL.md` ya no contiene valores de VAPID con apariencia de claves reales ni recomienda secretos globales obsoletos de proveedores. No se aplicaron migraciones ni se llamaron servicios externos. Sigue pendiente validar SQL y migrador contra staging real.

**Ticket/commit:** PAY-8 / commits locales `PAY-8 fix(migrations)` y `PAY-8 docs(staging)`.
