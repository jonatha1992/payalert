# Sincronización automática Mercado Pago

Un cron externo debe invocar `GET /api/internal/sync-connections` con `Authorization: Bearer <CRON_SECRET>` cada minuto. La ruta admite también `POST`, limita cada corrida a 20 conexiones activas y tiene un máximo de 50 segundos para Vercel. Vercel Hobby solo permite crons diarios; la frecuencia por minuto requiere otro plan o un cron externo.

La consulta utiliza `GET /v1/payments/search` dentro de una ventana de hasta 24 horas (o desde el cursor si es más reciente), y el ingreso reutiliza la deduplicación por proveedor e ID ya aplicada a IPN/webhooks. Los errores de cada conexión no detienen a las demás.

**Pendiente de confirmar con Mercado Pago:** si `/v1/payments/search` devuelve transferencias comunes entrantes a CVU; se registran únicamente tipos de operación y de pago para observar la cobertura. No se debe prometer detección de transferencias comunes hasta validarlo con una cuenta autorizada. También falta validar el refresh automático de tokens expirados en esta ruta.
