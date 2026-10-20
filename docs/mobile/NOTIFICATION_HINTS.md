# Avisos rápidos de transferencias Android

`POST /api/mobile/payment-hints` acepta avisos leídos desde Android autenticados con `Authorization: Bearer <Supabase access token>`. Solo roles con `movement:create` (owner/admin o empleado) pueden enviar; el negocio y sucursal se obtienen del perfil del servidor, nunca del cuerpo. Hay rate limit por usuario y negocio.

Body: `packageName`, `title`, `text`, `postedAt` (ISO 8601 con zona horaria) y `notificationKey`. Se acepta `com.mercadopago.wallet`; ampliar la lista exige decisión explícita. Los avisos sin frase reconocida como ingreso o monto argentino válido responden `{ accepted: false }` y no se guardan. Formatos monetarios admitidos incluyen `$1.234,56`.

El aviso reconocido se guarda en `transactions` con estado legacy `pending`, `provider_status: PENDING` y `metadata.source: device_notification`. Su id estable se deriva de negocio y notificationKey; la clave no se persiste sin hash. No es confirmación de dinero: permanece pendiente y nunca debe sumarse como venta. El dashboard histórico de `stats/dashboard` incluye todos los ingresos sin filtrar estado y debe excluir `status = pending` en cálculos/tendencias/desgloses antes de habilitar esta ruta en producción. Los reportes de movimientos pueden mostrarlo como pendiente.

Al persistirlo, `after()` de Next.js inicia la consulta en segundo plano sin retener la respuesta al celular. Se consultan conexiones Mercado Pago activas del negocio con el flujo común de sincronización y renovación OAuth; se hacen hasta 4 intentos (pausas de 5 s, duración nominal total 15 s), con tope de ruta de 60 s. Solo una sincronización por negocio se ejecuta simultáneamente en esta instancia; avisos concurrentes se coalescen. La lógica testeable está en `frontend/lib/payments/hintSync.ts`; la ruta solo la invoca. El push de confirmación se emite solo cuando un UPDATE condicional cambia `provider_status` de PENDING a CONFIRMED. Errores y resultado por intento quedan en `logStructured`; sin pago, la pista sigue PENDING.

El backend envía fanout web/Expo de inmediato con `Aviso: posible transferencia de $X (sin confirmar)`. El mensaje no constituye verificación del pago.

El módulo concilia en la ingestión tanto webhooks como sincronización: requiere pago de Mercado Pago CONFIRMED, `payment_type_id=bank_transfer`, monto exacto y timestamp dentro de ±10 minutos inclusive; solo actualiza el hint cuando existe exactamente un candidato pendiente. En ese caso reemplaza su identidad con el `external_id` confirmado para evitar una segunda fila. Ambigüedad no concilia.

No se requiere migración: campos existentes de `transactions` almacenan la fuente en metadata y permiten status pending. No se ejecutó SQL ni se contactó base de datos real.

# Avisos rápidos de transferencias Android

`POST /api/mobile/payment-hints` acepta avisos leídos desde Android autenticados con `Authorization: Bearer <Supabase access token>`. Solo roles con `movement:create` (owner/admin o empleado) pueden enviar; el negocio y sucursal se obtienen del perfil del servidor, nunca del cuerpo. Hay rate limit por usuario y negocio.

Body: `packageName`, `title`, `text`, `postedAt` (ISO 8601 con zona horaria) y `notificationKey`. Se acepta `com.mercadopago.wallet`; ampliar la lista exige decisión explícita. Los avisos sin frase reconocida como ingreso o monto argentino válido responden `{ accepted: false }` y no se guardan. Formatos monetarios admitidos incluyen `$1.234,56`.

El aviso reconocido se guarda en `transactions` con estado legacy `pending`, `provider_status: PENDING` y `metadata.source: device_notification`. Su id estable se deriva de negocio y notificationKey; la clave no se persiste sin hash. No es confirmación de dinero: permanece pendiente y nunca debe sumarse como venta. El dashboard histórico de `stats/dashboard` incluye todos los ingresos sin filtrar estado y debe excluir `status = pending` en cálculos/tendencias/desgloses antes de habilitar esta ruta en producción. Los reportes de movimientos pueden mostrarlo como pendiente.

El backend envía fanout web/Expo de inmediato con `Aviso: posible transferencia de $X (sin confirmar)`. El mensaje no constituye verificación del pago.

El módulo concilia en la ingestión tanto webhooks como sincronización: requiere pago de Mercado Pago CONFIRMED, `payment_type_id=bank_transfer`, monto exacto y timestamp dentro de ±10 minutos inclusive; solo actualiza el hint cuando existe exactamente un candidato pendiente. En ese caso reemplaza su identidad con el `external_id` confirmado para evitar una segunda fila. Ambigüedad no concilia.

No se requiere migración: campos existentes de `transactions` almacenan la fuente en metadata y permiten status pending. No se ejecutó SQL ni se contactó base de datos real.
