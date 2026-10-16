# PAY-11 — Transferencias entrantes a CVU/CBU

**Consulta de fuentes:** 16/10/2026. Investigación documental; no se accedió a cuentas ni se enviaron transferencias reales.

## 1. Pregunta

¿Las transferencias entrantes genéricas a una CVU/CBU generan webhook o pueden consultarse por API en Mercado Pago o Ualá Bis, fuera de pagos iniciados con QR, checkout o una orden? ¿Qué datos permiten identificar origen, monto, destino y estado? Si no hay webhook, ¿sirve un reporte para conciliar?

## 2. Hallazgos verificados

### Mercado Pago

- La documentación oficial de Webhooks enumera los topics y productos asociados. `payment` corresponde a Checkout API legacy, Checkout Pro, Bricks, Suscripciones y Wallet Connect; `orders` corresponde a Checkout API, Point y QR. No aparece un topic específico para una transferencia bancaria/CVU genérica. El evento de webhook trae `user_id`, `type`, `action` y `data.id`; el objeto se recupera de la API del producto que lo creó. **Esto confirma cobertura de productos de cobro listados, no cobertura general de abonos entrantes a la cuenta.** [Webhooks (MP Developers)](https://www.mercadopago.com.ar/developers/en/docs/your-integrations/notifications/webhooks) (consulta: 16/10/2026).
- **No se confirma** que `GET /v1/payments/search` o `GET /v1/payments/{id}` incluyan transferencias espontáneas a CVU. La búsqueda de pagos es para objetos de pago de la integración; no encontré documentación oficial que garantice que una transferencia entrante genérica sea un `payment` consultable por esa API. Tampoco hay base para asumir que `operation_type`, `payment_type_id` o el `status` resuelvan el caso sin probarlo.
- Sí existe una alternativa oficial de conciliación: reporte de Todas las transacciones / settlement. Puede generarse manualmente o programarse por API en frecuencia diaria, semanal o mensual; el reporte incluye movimientos que afectaron el balance y se usa para conciliación. La guía indica que los movimientos ingresan al reporte cuando se aprueba la operación; pendientes/rechazados no aparecen. [Introducción del reporte](https://www.mercadopago.com.ar/developers/es/docs/reports/account-money/introduction), [API de reportes](https://www.mercadopago.com.ar/developers/es/docs/reports/account-money/api) (consulta: 16/10/2026).
- Campos útiles documentados: `SOURCE_ID` (ID MP), `TRANSACTION_AMOUNT`, `TRANSACTION_CURRENCY`, `TRANSACTION_DATE`, `TRANSACTION_TYPE`, `PAYMENT_METHOD_TYPE`, `PAYER_NAME` (disponible para cobros QR, transferencias o donaciones), y `POI_BANK_NAME`/`POI_WALLET_NAME` cuando se trata de pagos QR interoperables. `EXTERNAL_REFERENCE` puede estar vacío, por ejemplo en envío de dinero. El glosario no documenta una columna de CVU/CBU destino ni afirma que `PAYER_NAME` venga completo para todo crédito de transferencia. [Glosario del reporte](https://www.mercadopago.com.ar/developers/es/docs/reports/account-money/report-fields) (consulta: 16/10/2026).
- La configuración de reporte acepta columnas, `frequency` (daily/weekly/monthly) y `sftp_info`; documenta configuración y reportes, no un webhook instantáneo de cada transferencia. No se confirmó el tiempo de publicación, endpoint de descarga automatizada aplicable a la cuenta/caso, ni que cada abono por transferencia venga etiquetado de forma distinguible para este uso. [API de reportes](https://www.mercadopago.com.ar/developers/es/docs/reports/account-money/api) (consulta: 16/10/2026).

### Ualá Bis

- La documentación pública oficial consultada es **API Cobros Online v2**: crea órdenes `/checkout`, admite `notification_url` y permite consultar/listar órdenes (`GET /orders/:uuid`, `GET /orders?...`). El webhook de orden contiene `uuid`, `external_reference`, `status`, `created_date`, `api_version`; los estados listados son los de esa orden. No encontré endpoint/topic oficial de movimientos de cuenta, extracto, transferencias entrantes genéricas o saldo en esta API. Por eso no se puede afirmar que una transferencia directa a CVU/CBU se notifique o aparezca en esas búsquedas de órdenes. [Crear orden](https://developers.ualabis.com.ar/v2/orders/create), [Webhook de orden](https://developers.ualabis.com.ar/v2/orders/create/webhook), [Obtener orden](https://developers.ualabis.com.ar/v2/orders/get), [Filtrar órdenes](https://developers.ualabis.com.ar/v2/orders/find) (consulta: 16/10/2026).
- Para una **orden creada por la integración**, están documentados monto, UUID, referencia externa, estado y fechas; el receptor/destino CVU/CBU no está expuesto en esos ejemplos/contratos consultados. No son campos que permitan conciliar una transferencia entrante genérica.
- No se encontró documentación oficial pública de reporte de conciliación/movimientos Ualá Bis v2 ni reporte programado/salida SFTP para transferencias entrantes. Esto es “no confirmado en la documentación pública consultada”, no prueba de que Ualá no ofrezca un producto privado o habilitable por soporte.

### Contexto regulatorio (no equivale a API de proveedor)

- BCRA define transferencias y datos que se informan a clientes/sistemas participantes, incluyendo ordenante, cuenta beneficiaria, importe/moneda e identificación de movimiento; las reglas del sistema y la interoperabilidad no implican por sí mismas que un tercero tenga acceso a una API comercial de cada PSP. [Texto ordenado “Sistema Nacional de Pagos — Transferencias”](https://www.bcra.gob.ar/archivos/Pdfs/texord/t-snp-tr.pdf) (consulta: 16/10/2026; texto consultado indica última comunicación incorporada “A” 8295, al 07/08/2025).
- BCRA describe CBU/CVU/alias y pagos interoperables por QR en Transferencias 3.0; esa definición del esquema no promete webhook de movimientos para PayAlert. [Preguntas y respuestas Transferencias 3.0](https://bcra.gob.ar/Noticias/transferencia-3-0-preguntas-respuestas-i.asp) (consulta: 16/10/2026; publicación 12/11/2021).

## 3. Qué NO se pudo confirmar

- Si las transferencias push entrantes a la CVU de Mercado Pago disparan un topic de webhook de la app, aparecen en Payments API, o se incluyen consistentemente en el settlement report con identificador y estado útiles para vincularlas.
- Si existe para Ualá Bis un API privado/no publicado o un reporte de cuenta habilitable por soporte para movimientos entrantes; ni la latencia, paginación, campos/semántica de estado o elegibilidad de CVU/CBU.
- Campo API verificable para CVU/CBU destino en ambos productos; identificación confiable del ordenante en cada transferencia; manejo de devoluciones/reversiones; y si una fila de reporte ofrece un ID estable y suficiente para deduplicar.
- No se ejecutaron pruebas con credenciales sandbox ni cuentas reales. Un sandbox que simule un `payment` o una orden prueba solamente esos productos, no una transferencia interbancaria real.

## 4. Opciones

| Opción | Pros | Contras | Esfuerzo | Riesgo |
|---|---|---|---|---|
| Webhook de transferencia | Potencialmente rápido; dispara el flujo existente. | No documentado para transferencias genéricas en MP; Ualá Bis documenta webhook de órdenes. No implementar hasta obtener contrato y señal real. | M–L por proveedor y seguridad, si el proveedor lo confirma. | Muy alto: promesa falsa, eventos omitidos o falsos positivos. |
| Polling API de movimientos | Puede ofrecer conciliación frecuente si existe endpoint oficial y campos estables. | MP Payments no está confirmado para transferencias genéricas; Ualá Bis v2 pública consultada solo expone órdenes. Costo/rate limits, cursor y ventanas aún desconocidos. | M por proveedor una vez confirmado. | Alto: omisiones, duplicados, límites y cambios tardíos. |
| Reporte programado (MP) | Hay soporte oficial para reporte de balance, filtros/columnas y frecuencia programada; auditable y apto para importar. | Batch, no tiempo real; inclusión y metadatos de transferencia requieren validación. Integrar descarga/ingestión y reconciliar filas. Para Ualá Bis, no confirmado. | M para MP; bloqueado para Ualá hasta respuesta oficial. | Medio-alto: demora, campos ausentes, filas no clasificables. |
| Ingreso manual / conciliación asistida | Permite operar sin inferir acceso API; útil como contingencia o piloto. | Trabajo humano, evidencia/comprobantes falsificables, riesgo de carga errónea; no equivale a detección automática. No automatizar home banking ni scraping. | S–M; proceso y auditoría. | Medio; alto si se usa como confirmación automática. |

## 5. RECOMENDACIÓN

**Veredicto: NO-GO para prometer o lanzar detección automática de transferencias entrantes genéricas en ambos proveedores.** La documentación pública confirma webhooks/API de pagos u órdenes específicos y reportes de balance de MP, pero no prueba una ruta automática completa de transferencia genérica; en Ualá Bis no se confirmó feed de movimientos.

Plan por fases:
1. Mantener fuera del alcance de “cobro confirmado automáticamente” cualquier transferencia no originada por una integración de pago soportada. No asociar una fila de reporte por monto/horario como confirmación inequívoca.
2. Pedir al dueño ejecutar la matriz de abajo y solicitar por canal oficial a MP/Ualá Bis confirmación escrita del producto/API, acceso, campos, disponibilidad, estados, límites y condiciones comerciales.
3. Si MP reporta incluye la transferencia, prototipar **importación de reporte** en modo revisión; registrar IDs y evidencias, probar duplicados/reversiones y medir frescura antes de habilitar notificaciones. Solo considerar polling/webhook si contrato oficial y prueba positiva lo sustentan.
4. Si Ualá Bis no ofrece feed oficial utilizable, declarar la transferencia fuera de cobertura de Ualá Bis; ofrecer conciliación manual controlada, no scraping ni automatización de home banking.
5. Habilitar producción por proveedor solo tras evidencia de pruebas, política de datos y aceptación explícita del dueño.

## 6. Matriz de pruebas a ejecutar por el dueño

No se hicieron movimientos ni pruebas de cuenta. Usar cuentas propias/de prueba autorizadas, importes mínimos y autorización expresa antes de cualquier movimiento real. Guardar fecha/hora, ambiente, IDs, payloads sin secretos, response codes y export de reporte; ocultar datos personales al compartir.

| Proveedor / prueba | Pasos concretos | Observar y criterio |
|---|---|---|
| MP — control de webhook | En aplicación MP, configurar URL de test y eventos `payment`/`orders`; disparar la simulación oficial. | Confirmar topic, firma, IDs y que PayAlert procesa solo el objeto de pago/orden consultado. **No** tomarlo como prueba de transferencia genérica. |
| MP — transferencia real a CVU | Con autorización del dueño, enviar monto pequeño desde cuenta bancaria/PSP ajeno a la CVU del negocio. No iniciar desde Checkout/QR/orden. Revisar dashboard de Webhooks y registros de entrega durante la ventana acordada. | ¿Llegó evento? topic/action/data.id/user_id, HTTP y firma. Si no llega, anotarlo como evidencia negativa limitada a esa cuenta/fecha; no generalizar a todas las cuentas. |
| MP — API de pagos | Con token de esa cuenta, consultar la búsqueda oficial de pagos por rango temporal y revisar objetos candidatos; recuperar cada uno por ID. No exponer token. | Si aparece, guardar ID, `status`, `operation_type`, `payment_type_id`, monto/moneda/fechas, payer, destino si existe y criterios que distinguen transferencia de QR/checkout. Verificar que sea el mismo movimiento en actividad de cuenta. Si no hay objeto, API no confirmada para esa prueba. |
| MP — reporte | Generar settlement/“Todas las transacciones” con rango que incluya la transferencia; seleccionar `SOURCE_ID`, `EXTERNAL_REFERENCE`, `TRANSACTION_TYPE`, `PAYMENT_METHOD_TYPE`, `TRANSACTION_AMOUNT`, `TRANSACTION_CURRENCY`, `TRANSACTION_DATE`, `PAYER_NAME`, `POI_BANK_NAME`, `POI_WALLET_NAME`, según disponibilidad. Repetir tras completar la generación. | ¿Hay fila? tiempo hasta aparecer; ID estable; clasificación; bruto/neto; ordenante y CVU destino disponibles; aparece reversa/devolución. Comparar con panel y comprobante. No concluir cobertura por una sola fila QR. |
| Ualá Bis — orden de control | En stage, crear orden API propia con `notification_url`; recibir webhook y consultar `GET /orders/:uuid` y listado por fecha. | Confirmar credenciales stage, `uuid`, importe, `external_reference`, estado/fechas; esto solo valida la ruta orden/webhook. |
| Ualá Bis — transferencia real a CVU | Solicitar confirmación escrita a soporte Ualá Bis sobre endpoint/reporte y campos. Si el dueño autoriza y soporte indica el procedimiento, hacer transferencia mínima de una cuenta propia externa; revisar producto oficial disponible y respuesta API/reporte. | Buscar evento no asociado a una orden, transacción consultable, origen, monto/moneda, CVU destino, estado final/reversión y latencia. Sin endpoint/report oficial, marcar “no disponible/no confirmado”, no intentar scraping. |
| Ambos — deduplicación y reversa | Reprocesar el mismo evento/fila/importación y observar una devolución/reversa válida controlada si el proveedor permite. | Mismo identificador debe producir un solo movimiento; reversa debe cambiar estado sin duplicar el abono; tenant/cuenta destino deben coincidir. |

## 7. Impacto en PayAlert (archivos verificados)

- `frontend/lib/payments/ingest.ts`: `ingestWebhook` obtiene la transacción autoritativa con `connector.fetchTransaction`, persiste vía `upsertTransaction`, aplica transición y matching solo cuando la transacción queda `CONFIRMED`. Una integración de polling/reporte no debe fingir que recibió webhook; necesitaría entrada de ingesta propia y validación de cuenta/tenant equivalente.
- `frontend/lib/server/webhookHandler.ts`: `handleProviderWebhook` resuelve conexión, valida/parsing del conector, encola y deduplica por `parsed.externalId`; `processWebhook` ejecuta la ingesta y notifica. Sirve para notificaciones soportadas, no es un consumidor genérico de archivos/reportes.
- `frontend/lib/server/webhookQueue.ts`: el upsert de `webhook_events` usa conflicto `provider,dedupe_key` con `ignoreDuplicates: true`; preservar la semántica idempotente si se añade feed batch.
- `frontend/lib/payments/connectors/mercadopago.ts`: extrae el ID de `data.id` y obtiene `GET /v1/payments/{id}`. El código implementa recurso `payment`, no consulta movimientos de cuenta ni settlement reports.
- `frontend/lib/payments/connectors/uala.ts`: interpreta `uuid` como ID de orden y hace `GET /orders/{uuid}`; no existe conector de transacciones entrantes genéricas según el código consultado.
- `docs/providers/mercadopago.md` y `docs/providers/uala.md` documentan el mismo límite actual: pagos/órdenes y transferencias genéricas no verificadas/no cubiertas. `docs/analisis/07-redundancias-y-viabilidad.md` marca PAY-11 bloqueado por falta de confirmación. El archivo de análisis no se modificó.

---

**Fuentes primarias consultadas:** Mercado Pago Developers, Ualá Bis Developers y BCRA. Las afirmaciones de ausencia están acotadas a la documentación pública localizada y se etiquetan como no confirmadas; no implican inexistencia de productos privados.