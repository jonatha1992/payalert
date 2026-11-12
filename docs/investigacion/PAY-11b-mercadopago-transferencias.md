# PAY-11b — Mercado Pago: transferencias entrantes comunes

**Consulta:** 18/10/2026. Investigación documental de fuentes públicas; no se usaron credenciales, no se consultaron cuentas reales ni se ejecutaron movimientos. Objetivo: determinar si IPN/Webhooks o APIs públicas permiten detectar un abono común entrante (transferencia bancaria/CVU o transferencia entre cuentas) a la cuenta Mercado Pago del comercio, fuera de QR/checkout.

## Veredicto

**PARCIAL.**

- **IPN/Webhooks: NO confirmado y, según el contrato documentado, no cubren transferencias genéricas entrantes.** Los eventos documentados son recursos de productos/integraciones (pagos, órdenes comerciales, integraciones Point, reclamos, contracargos, etc.). El catálogo IPN no incluye un topic `transfer` ni un topic de movimientos/abonos de cuenta. La documentación define IPN para estado de un pago, contracargo o `merchant_order`; eso no equivale a toda acreditación que modifica el saldo del usuario.
- **API Payments: no se puede confirmar que encuentre un abono genérico.** `GET /v1/payments/search` está documentado para pagos y filtros como `operation_type`; menciona valores habituales como `regular_payment`, `pos_payment`, `recurring_payment`. El valor `money_transfer` aparece en documentación de preferencias como “solicitud de dinero”, no como garantía de que una transferencia libre entrante a CVU sea un objeto Payment consultable. No asumir que `operation_type=money_transfer` resuelve el caso.
- **Reporte de cuenta: sí hay una ruta parcial de conciliación.** “Todas las transacciones” refleja operaciones que afectan el balance y documenta ingresos de dinero; puede generarse por API y programarse diaria, semanal o mensualmente. El glosario contempla `bank_transfer` como tipo de medio de pago y el reporte puede incluir transferencias, pero no encontré garantía pública de cobertura exhaustiva/latencia ni confirmación del tratamiento de cada transferencia común recibida a CVU. Es batch y no una notificación en tiempo real.
- **OAuth `read`:** es un scope válido para acceso de lectura a recursos autorizados por el vendedor. No amplía por sí mismo los recursos que un endpoint soporta. La API de reportes muestra `Authorization: Bearer ENV_ACCESS_TOKEN`; por lo tanto existe un mecanismo de API con token, pero la documentación consultada no fija expresamente en la página si basta un token OAuth seller con `read` para cada operación de reporte ni asegura que todos los tipos de movimiento estén habilitados para cualquier cuenta. Requiere prueba/confirmación de MP.

La recomendación de PAY-11 previo sigue vigente: **no prometer alerta automática instantánea de toda transferencia entrante**. Como posibilidad a validar, priorizar un piloto de conciliación por reporte oficial en modo batch; el match por importe/hora no debe tratarse como prueba inequívoca de pago.

## 1. IPN y Webhooks: catálogo y alcance

### IPN

La documentación oficial describe IPN como mecanismo para notificar el estado de un **pago específico, contracargo o `merchant_order`**, vía HTTP POST. El catálogo que expone incluye:

| Topic | Objeto/evento según documentación | Lectura para transferencia genérica |
|---|---|---|
| `payment` | Creación/actualización de pagos de Checkout API (legacy), Checkout Pro, Bricks, Suscripciones, Point legacy y Wallet Connect | Solo prueba eventos de pagos integrados; no se documenta como feed de abonos de la cuenta. |
| `point_integration_ipn` | Finalización, cancelación o error de intentos de pago en dispositivos Point legacy | Es un intento de cobro Point, no movimiento genérico entrante. |
| `merchant_order` | Creación/cierre/expiración de órdenes comerciales de Checkout Pro y QR legacy | La orden está vinculada al flujo de cobro/orden; no se documenta para cualquier transferencia. |
| `chargebacks` | Apertura/cambio de contracargo y cambios asociados | No es una señal de transferencia entrante. |
| `delivery_cancellation` | Alerta de fraude posterior al procesamiento de orden (en tabla IPN consultada) | No corresponde a crédito genérico. |

La tabla usa productos concretos. **No enumera** topic `transfer`, `account_money`, `money_requests` ni `topic_card_id` como topics IPN del catálogo consultado. `topic_card_id` es en Webhooks un evento de Card Updater, no un abono. No se halló topic documentado llamado `money_requests`; `money_transfer` aparece como valor de `operation_type` en alguna documentación histórica/relacionada con pagos/preferencias, en el sentido de solicitud de dinero, y no debe confundirse con el movimiento bancario espontáneo descrito por el comercio.

IPN no debe presentarse como una notificación universal de todo movimiento de saldo: su propia definición/catálogo limita el evento a objetos específicos. Además, la documentación indica que IPN será discontinuado próximamente y recomienda Webhooks.

### Webhooks

La tabla oficial de Webhooks incluye:

- `payment`: creación/actualización de pagos de Checkout API, Checkout Pro, Bricks, Suscripciones y Wallet Connect.
- `subscription_authorized_payment`, `subscription_preapproval`, `subscription_preapproval_plan`: eventos de suscripciones.
- `mp-connect`: vinculación/desvinculación OAuth.
- `wallet_connect`: transacciones del producto Wallet Connect.
- `stop_delivery_op_wh`: alerta de fraude posterior al procesamiento de una orden.
- `topic_claims_integration_wh`: reclamos/devoluciones según la tabla de productos.
- `topic_card_id_wh`: recuperación/actualización de información de tarjeta.
- `topic_merchant_order_wh`: creación/cierre/expiración de órdenes comerciales, Checkout Pro/QR legacy.
- `topic_chargebacks_wh`: contracargos.
- `point_integration_wh`: finalización/cancelación/error de intento de pago en Point.

Los nombres pueden variar entre generaciones de docs/productos (por ejemplo, `point_integration_ipn` en IPN vs. `point_integration_wh` en Webhooks; `merchant_order` vs. `topic_merchant_order_wh`; `chargebacks` vs. `topic_chargebacks_wh`). Ninguno de esos nombres constituye un topic genérico de transferencias entrantes. La presencia de un medio “bank transfer” dentro de pagos/órdenes integrados tampoco demuestra que una transferencia enviada fuera del checkout cree ese objeto.

**Resultado de búsqueda terminológica:** no se encontró en los catálogos oficiales revisados un topic `transfer`, `account_money`, `money_requests` ni `transfer_received` para abonos ordinarios a la cuenta. `stop_delivery_op_wh` es alerta de fraude de orden; `topic_card_id_wh` se refiere a actualización de tarjeta; `merchant_order`/`topic_merchant_order_wh` notifican órdenes; `point_integration_ipn`/`point_integration_wh` son eventos de Point. Estos temas no sirven como sustitutos documentados de un feed de movimientos.

## 2. API de pagos, movimientos y reportes

### `/v1/payments/search`

La referencia oficial documenta `GET https://api.mercadopago.com/v1/payments/search`, requiere Access Token, devuelve resultados paginados y cubre pagos dentro de una ventana de hasta doce meses según la página de referencia. La guía de pagos permite filtros, entre ellos `operation_type`, `payment_type_id`, `status`, fechas y paginación; presenta `regular_payment`, `pos_payment`, `recurring_payment`, etc. como ejemplos.

**No confirmado:** que el endpoint registre una transferencia común entrante (transferencia bancaria/CVU a la cuenta) como Payment. Las fuentes consultadas no definen su objeto, identificador, estados ni una búsqueda funcional por `operation_type=money_transfer` para ese caso. Tampoco se encontró una garantía de resultados para `operation_type=account_money`; `account_money` aparece como tipo/medio de pago en glosarios, no como prueba de soporte para movimientos genéricos. Que haya operaciones históricas llamadas `money_transfer` o una documentación de “solicitud de dinero” no basta para afirmar cobertura del abono espontáneo.

### `/v1/account/movements`

Búsqueda literal de la ruta `v1/account/movements` en documentación pública oficial consultada no localizó referencia oficial verificable. **No se afirma que exista.** No usar ni implementar este endpoint sin que MP entregue referencia oficial aplicable.

### `/v1/account/settlement_report` (reporte de Todas las transacciones / conciliación)

La documentación oficial sí expone la API de reporte bajo `/v1/account/settlement_report` y su configuración bajo `/v1/account/settlement_report/config`. Permite generar reportes manualmente o programar frecuencia `daily`, `weekly` o `monthly`; se pueden elegir columnas. La guía incluye ejemplos de bearer token, configuración y consulta/descarga del reporte. Es una salida de conciliación, no un webhook por transacción.

La introducción oficial dice que el reporte contiene operaciones que afectaron el balance (incluyendo pagos, ingresos de dinero, contracargos y devoluciones), y que los movimientos aprobados impactan automáticamente; pendientes/rechazados no aparecen. El glosario contempla:

- `PAYMENT_METHOD_TYPE`: `bank_transfer` = transferencia; también `available_money` (dinero disponible que otros usuarios pueden usar para comprar/pagar).
- `TRANSACTION_TYPE`: `SETTLEMENT`, `REFUND`, `CHARGEBACK`, `DISPUTE`, `WITHDRAWAL`, `WITHDRAWAL_CANCEL`, `PAYOUT`.
- `TRANSACTION_AMOUNT`, `TRANSACTION_CURRENCY`, `TRANSACTION_DATE`, `SETTLEMENT_DATE`, `SETTLEMENT_NET_AMOUNT`, `REAL_AMOUNT`.
- `SOURCE_ID`: ID de operación en MP.
- `EXTERNAL_REFERENCE`: puede estar vacío, entre otros casos, en un envío de dinero.

La documentación del reporte confirma una capacidad de observar/conciliar movimientos que impactaron el saldo. **No confirma** que cada transferencia entrante común a CVU aparezca con clasificación inequívoca `bank_transfer`, qué nombre/ID tenga para ese subtipo, si se informa CVU/CBU destino u ordenante con datos suficientes, cuánto tarda en aparecer, ni si el tipo de usuario/cuenta del vendedor habilita todas las columnas/descargas. La página del glosario consultada no documenta `PAYER_NAME` como columna garantizada; la investigación anterior lo mencionaba como posible campo, pero no lo tomo como confirmado aquí.

**“Reporte de liberación de dinero” y “Reporte de conciliación”:** las páginas consultadas identifican el producto como “Todas las transacciones” y llaman al reporte de balance/settlement; la API lo denomina settlement report y usa prefijo de archivo configurable (por defecto descrito como `conciliation-settlement-report`). No se halló un endpoint separado llamado `/v1/account/movements` ni evidencia de una API independiente “Reporte de liberación de dinero” que garantice detección de transferencia entrante. No confundir reportes de liquidación/release con un webhook.

### OAuth y scope read

La documentación OAuth dice que Authorization Code permite acceder en nombre del vendedor luego de su consentimiento y que los scopes válidos son `offline_access`, `write` y `read`. La guía Marketplace muestra tokens de vendedor y ejemplos de scope que contienen `read`. El reporte API documenta el header `Authorization: Bearer ENV_ACCESS_TOKEN`.

Esto permite sostener que un token autorizado puede autenticar llamadas de lectura donde el recurso lo permita; **no** demuestra que el scope `read` otorgue una API general de movimientos ni que `/v1/payments/search` contenga transferencias genéricas. El acceso al endpoint de reporte con OAuth seller `read` y su disponibilidad efectiva deben confirmarse con la app/cuenta de comercio en pruebas autorizadas o con MP. No se usaron tokens ni se probaron endpoints.

## 3. Comunidad, foros y repositorios

Se buscaron consultas/casos con combinaciones de “recibir notificación de transferencia”, “IPN transferencia”, “detectar transferencias entrantes Mercado Pago API”, Stack Overflow, GitHub y comunidad de Mercado Pago. Los resultados públicos encontrados fueron escasos o irrelevantes para el caso exacto; no se encontró un hilo de soporte/caso reproducible que demuestre que un webhook o Payment Search detecta transferencias comunes recibidas en CVU. Un resultado de GitHub sobre una gema histórica describe `money_transfer` como “money wire”, pero no documenta recepción de transferencia CVU ni constituye fuente oficial. No lo uso como prueba afirmativa.

**No encontrado** no equivale a imposibilidad técnica absoluta: solo significa que no se ubicó documentación pública/caso verificable suficiente para afirmarlo.

## 4. Confirmado / inferido / no encontrado

| Estado | Afirmación |
|---|---|
| **Confirmado por documentación oficial** | IPN se define para pagos, contracargos y merchant orders; la tabla de tópicos mapea eventos a productos específicos. |
| **Confirmado por documentación oficial** | Webhooks ofrece eventos de Payments, órdenes, Point, suscripciones, Wallet Connect, reclamos, contracargos, Card Updater y alertas de fraude; no lista un evento de transferencia genérica. |
| **Confirmado por documentación oficial** | `GET /v1/payments/search` existe para búsqueda de pagos, usa Access Token y admite filtros de pago como `operation_type`; los ejemplos no garantizan abonos arbitrarios a la cuenta. |
| **Confirmado por documentación oficial** | El reporte “Todas las transacciones” refleja operaciones que afectaron el balance, incluye ingresos de dinero, excluye pendientes/rechazadas hasta aprobación y puede generarse/programarse por API diariamente, semanalmente o mensualmente. |
| **Confirmado por documentación oficial** | El glosario del reporte contempla `bank_transfer`, `available_money`, tipos de operación, montos/fechas/IDs; `EXTERNAL_REFERENCE` puede faltar en envíos de dinero. |
| **Inferencia razonable, no garantía** | Dado el alcance declarado por tópico y la ausencia de topic de transferencia, IPN/Webhooks no son una interfaz documentada para cada transferencia entrante espontánea. |
| **Inferencia razonable, no garantía** | Una fila de “Todas las transacciones” podría incluir un movimiento entrante por transferencia al afectar balance; las fuentes no garantizan cobertura/clasificación para cada variante de CVU. |
| **No encontrado / no confirmado** | Topic `transfer` / `account_money` / `money_requests` para abonos genéricos; endpoint oficial `/v1/account/movements`; cobertura completa de `/v1/payments/search` con `money_transfer`/`account_money`; datos de ordenante/destino/latencia y acceso OAuth `read` específico al reporte. |
| **No probado** | No se hicieron transacciones, llamadas de API, pruebas sandbox ni consultas a cuentas. |

## 5. Próximo paso recomendado

1. No configurar IPN/Webhooks esperando que aparezcan transferencias fuera del checkout. Conservarlos para pagos/órdenes que sí estén soportados.
2. Consultar a Mercado Pago por escrito: “¿La transferencia bancaria entrante a CVU de una cuenta de vendedor genera algún evento/documento API? Si no, ¿qué endpoint/reporte oficial permite leerla, con qué scope OAuth, clasificación, ID, ordenante/destino, frescura, límites y cobertura para cuentas comerciales?”
3. Si MP confirma elegibilidad del reporte API, hacer una prueba autorizada por el dueño con una transferencia real mínima **solo por cuenta propia**, comparar actividad, reporte, `SOURCE_ID`/tipo/fecha y medir latencia; no exponer tokens. No hacer pruebas ni operaciones aquí.
4. Implementar primero ingestión batch/revisión humana si la fila es verificable y deduplicable. No emitir “pago confirmado” por coincidencia de monto/hora únicamente.
5. Solo adoptar polling/API o webhook para transferencia si MP confirma contrato público/privado, scopes, campos, estados, reversiones y disponibilidad y existe evidencia de prueba positiva.

## Fuentes principales (documentación oficial)

1. [IPN — definición y tópicos](https://www.mercadopago.com.ar/developers/en/docs/subscriptions/additional-content/your-integrations/notifications/ipn) — pagos, contracargos, merchant order y Point legacy.
2. [Webhooks — eventos y productos asociados](https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks) — catálogo de topics/eventos; no topic de transferencia genérica.
3. [Reporte “Todas las transacciones” — introducción](https://www.mercadopago.com.ar/developers/es/docs/reports/account-money/introduction) — ingresos al balance, aprobados, conciliación.
4. [API de generación del reporte](https://www.mercadopago.com.ar/developers/en/docs/reports/account-money/api) — `/v1/account/settlement_report`, programación diaria/semanal/mensual y bearer token.
5. [Glosario/campos del reporte](https://www.mercadopago.com.ar/developers/es/docs/reports/account-money/report-fields) — tipos de movimiento, `bank_transfer`, IDs y referencias.

Fuentes complementarias:

- [Búsqueda de pagos — guía](https://www.mercadopago.com.ar/developers/en/guides/manage-account/retrieving-payments)
- [Referencia `GET /v1/payments/search`](https://www.mercadopago.com.ar/developers/en/reference/online-payments/checkout-pro-preferences/search-payments/get)
- [OAuth — creación de token](https://www.mercadopago.com.ar/developers/es/reference/authentication/oauth/_oauth_token/post)
- [Marketplace/OAuth vendedor](https://www.mercadopago.com.ar/developers/en/guides/online-payments/marketplace/checkout-api/create-marketplace)
- [IPN indica discontinuación y recomienda Webhooks](https://www.mercadopago.com.ar/developers/en/docs/split-payments/additional-content/your-integrations/notifications)
- [Payouts: transferencias iniciadas por la integración](https://www.mercadopago.com.ar/developers/en/docs/payouts/integration-configuration/money-transfers) — prueba que hay notificaciones asociadas a transferencias/payouts originados por la propia integración; no prueba monitoreo de transferencias recibidas espontáneamente.

---

**Alcance:** no se editó código, no se accedió a cuentas, no se ejecutaron consultas/operaciones API y no se hizo commit. Las afirmaciones negativas quedan acotadas a las fuentes públicas localizadas al 18/10/2026.