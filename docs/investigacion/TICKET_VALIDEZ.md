# Validez del ticket de cobro generado por PayAlert

**Corte de investigación:** 2026-10-16. **Alcance:** evaluación documental preliminar para Argentina, no asesoramiento legal ni contable. **Validar con un contador** y, antes de publicar, con asesoría legal. Las conclusiones sobre un ticket PayAlert son análisis de fuentes normativas/oficiales; no constituyen dictamen. Cuando una afirmación no queda acreditada por las fuentes consultadas se indica **no confirmado**.

## Veredicto ejecutivo

**Sí, conviene ofrecer un ticket propio de uso interno**, imprimible/descargable, con identificación inequívoca de que es un comprobante informativo del pago observado por PayAlert y **no una factura, ticket fiscal ni comprobante fiscal**. Debe reflejar el estado consultado de la fuente de pago, no sustituirla; enlazar o permitir consultar el comprobante oficial del proveedor cuando exista; minimizar datos personales; guardar evidencia de reimpresión sin crear otro movimiento. No llamar “factura”, “ticket fiscal” ni insinuar autorización ARCA. La leyenda sugerida no reemplaza las obligaciones del comercio de emitir el comprobante fiscal que corresponda por la operación.

Esto alinea con `docs/analisis/05-limites-del-sistema.md`: PayAlert informa y organiza movimientos de proveedores; no hay capacidad aprobada de facturación electrónica ni de controlador fiscal. La presencia de la propuesta en `docs/investigacion/competencia/avisopago-mejoras.md` no equivale a aprobación ni a funcionalidad existente.

## 1. ¿Es comprobante fiscal? Obligaciones y rol del sistema

**No.** Un PDF o papel generado por PayAlert con datos de un pago recibido es, por sí solo, un registro/comprobante interno de cobro. No se transforma en factura, ticket fiscal, recibo fiscal autorizado ni documento emitido por controlador fiscal por llevar importe, fecha, numeración, logo o impresión. Las modalidades oficiales incluyen comprobantes electrónicos originales y/o controlador fiscal de nueva tecnología; la factura electrónica requiere solicitar autorización a ARCA por WSFE o “Comprobantes en línea”, con punto de venta y correlatividad. Un ticket que solo reproduce información de un movimiento no sigue ese procedimiento. Fuentes: ARCA, [modalidades de emisión](https://www.arca.gob.ar/facturacion/regimen-general/modalidades.asp), [autorización de comprobantes electrónicos](https://www.arca.gob.ar/fe/emision-autorizacion/solicitud-autorizacion.asp), [RG 4290, Boletín Oficial](https://www.boletinoficial.gob.ar/detalleAviso/primera/189307/20180803), [RG 4291, Boletín Oficial](https://www.boletinoficial.gob.ar/detalleAviso/primera/189308/20180803), consultadas 2026-10-16.

El contribuyente/comercio es quien debe determinar su régimen, emitir los comprobantes respaldatorios por las ventas, locaciones, prestaciones, anticipos y demás hechos alcanzados, en la clase y modalidad que correspondan a su condición fiscal y al receptor. ARCA publica clases A/B/C/E/T según emisor y receptor; indica que monotributistas emiten comprobantes electrónicos C (salvo exportación E) y describe facturación electrónica, facturador y controlador fiscal. La situación concreta, excepciones, actividad y cambios normativos —incluidos los vigentes desde 2026— requieren validación profesional; este informe no enumera excepciones exhaustivas. Fuentes: [clases de comprobantes ARCA](https://www.arca.gob.ar/facturacion/regimen-general/comprobantes.asp), [facturación monotributo ARCA](https://www.arca.gob.ar/monotributo/ayuda/facturacion.asp), [RG 5614/2024, Boletín Oficial](https://www.boletinoficial.gob.ar/detalleAviso/primera/318151/20241213), consultadas 2026-10-16.

PayAlert, como sistema de notificación/consulta, puede presentar información de movimientos y ayudar al comercio a verificar estado, importe, fecha, proveedor y referencia. No vende el bien/servicio, no determina la clase fiscal aplicable, no emite por defecto comprobantes autorizados por ARCA, ni asume la obligación fiscal del comercio. La asignación legal de obligaciones al proveedor del SaaS o al comercio en una relación específica requeriría análisis contractual; más allá de la función técnica descrita, esa cuestión individual es **no confirmado**.

## 2. Valor probatorio del comprobante de pago

- **Comprobante/registro oficial del proveedor (Mercado Pago, banco o Ualá):** evidencia más directa del asiento/operación que el propio proveedor registra, típicamente con identificador, estado, fecha e importe. Su fuerza y suficiencia en una disputa concreta dependen de autenticidad, estado, reversas/contracargos, contexto y demás evidencia: no equivale automáticamente a factura ni garantiza por sí mismo el cumplimiento de la compraventa. Mercado Pago ofrece una API para consultar el pago por ID y devuelve estado y fechas; esto respalda que se debe contrastar la información contra la fuente, no confiar en una captura presentada por quien paga. [API Mercado Pago: recuperar pagos](https://mercadopago.com.ar/developers/en/guides/manage-account/account/retrieving-payments), consultada 2026-10-16. Qué formatos concretos de comprobante descargable muestra cada cuenta/flujo de MP o Ualá Bis al corte: **no confirmado** por páginas oficiales de ayuda consultadas.
- **Transferencias inmediatas interoperables:** el BCRA caracteriza los pagos con transferencia como acreditados inmediata e irrevocablemente bajo el marco Transferencias 3.0. Eso habla de la operación liquidada, no convierte una captura o papel de PayAlert en documento fiscal ni resuelve por sí solo toda controversia contractual. [BCRA: Transferencias 3.0](https://www.bcra.gob.ar/transferencias-3-0/), consultada 2026-10-16. Aplicación a cualquier tipo de pago, plataforma o caso concreto: **no confirmado**; PayAlert debe respetar el producto/estado específico del proveedor.
- **Ticket propio de PayAlert:** puede ser evidencia auxiliar contemporánea de lo que PayAlert mostraba y del vínculo de un movimiento con su ID de proveedor; puede servir para consulta interna, caja, conciliación y para orientar una investigación. No es fuente independiente de acreditación, no reemplaza el historial/extracto del proveedor, no demuestra entrega del producto/servicio, ni sustituye la factura fiscal. Su valor probatorio concreto lo determina la autoridad competente según el caso; no se puede garantizar.
- La Ley 24.240 reconoce que en trámites de consumo pueden acompañarse documentos para acreditar un reclamo (la guía oficial del Sistema Nacional de Arbitraje menciona factura, recibo, presupuesto, solicitud y correos), sin afirmar que cualquiera sea concluyente por sí solo. [Sistema Nacional de Arbitraje de Consumo](https://www.argentina.gob.ar/produccion/consumidor/sistema-nacional-de-arbitraje-de-consumo), [Ley 24.240 texto actualizado](https://www.argentina.gob.ar/normativa/nacional/ley-24240-638/actualizacion), consultados 2026-10-16.

## 3. Texto seguro y datos

### Leyenda sugerida

> **COMPROBANTE INTERNO DE COBRO — NO ES FACTURA NI COMPROBANTE FISCAL.** Emitido por PayAlert como constancia informativa del estado consultado en el proveedor de pagos indicado. No reemplaza el comprobante fiscal que debe emitir el comercio ni el comprobante oficial del proveedor.

“Comprobante interno de cobro, no válido como factura” es una base clara, pero se recomienda explicitar que tampoco es ticket fiscal/controlador fiscal y que el estado corresponde al proveedor consultado. No colocar “ARCA”, “CAE”, punto de venta, letra fiscal A/B/C/E/T, QR de validación fiscal o logotipo que sugiera autorización si PayAlert no emitió/obtuvo realmente esos datos por el flujo habilitado. Si se muestra información fiscal provista por un sistema conectado en el futuro, presentarla como bloque separado, con trazabilidad y autorización verificable; validar diseño con contador.

### Incluir solo lo necesario

- Identificador interno del ticket y referencia/ID de movimiento del proveedor (preferible truncado o en QR/enlace con acceso controlado si la exposición lo permite).
- Comercio/cuenta conectada identificada de forma suficiente para el uso interno; importe y moneda; estado exacto tal como informado/validado por el proveedor; fecha y hora con zona horaria; proveedor y método/canal si se conoce.
- Indicación de que es una captura informativa del estado a la hora indicada, no garantía de irrevocabilidad para todos los medios. Actualizar/invalidar la vista si cambia el estado (reembolso, reversa, contracargo) y permitir reconsultar el movimiento.
- Concepto/referencia solo si ya existe y es necesario; opcionalmente código de venta esperado asociado, sin presentarlo como identificador fiscal.
- Fecha de generación, versión de plantilla y canal de ayuda del comercio (no el de PayAlert como vendedor).

### Excluir por defecto

- DNI/CUIT del pagador, domicilio, teléfono, correo, nombre completo u otros datos del pagador; datos completos de tarjeta, CVU/CBU, cuenta, token, credenciales, payload del webhook o secretos.
- No inventar información faltante ni usar datos editables del usuario como prueba de acreditación. No divulgar datos de empleado; si un uso interno exige atribución, aplicar rol/alcance y minimización.
- El CUIT/razón social del comercio solo cuando sea indispensable para identificar al comercio y aprobado por éste; no presentarlo como si acreditara emisión fiscal. Datos personales precisos exigidos por una norma o por el comprobante fiscal deben gestionarse en la factura oficial, no duplicarse por conveniencia en el ticket PayAlert.

Esta propuesta es de privacidad por diseño, no una lista de campos legalmente obligatorios para un recibo privado. La obligatoriedad aplicable al ticket interno: **no confirmado**.

## 4. ¿Integrarse con facturación electrónica ARCA?

**No como parte de este ticket inicial.** Mantener separado el comprobante interno y la factura fiscal. Si la estrategia de producto luego exige facturar, tratarlo como iniciativa aprobada independiente, con validación fiscal, privacidad, seguridad, operación y soporte.

Opciones, sin implementar:

1. **Sin integración (esfuerzo S):** ticket interno con leyenda, IDs y enlace/ayuda para que el comercio emita su factura mediante sus herramientas ARCA o su sistema actual. Menor riesgo y encaja con el alcance actual.
2. **Integración con software de facturación existente (M estimado):** estudiar API/contrato de un proveedor fiscal tercero, credenciales delegadas, modelo de datos, manejo de rechazos, notas de crédito, conciliación e idempotencia. Dependencia y costos del tercero; factibilidad/precios/permisos concretos: **no confirmado**.
3. **Integración directa con WSFE de ARCA (L estimado, no cotización):** cada comercio tendría que autorizar técnicamente su emisión; hay certificados/WSAA, asociación del servicio, punto de venta, tipos de comprobante, correlatividad, solicitud de CAE, reglas de negocio por contribuyente/receptor, homologación y producción. Manejar renovaciones de credenciales, contingencias, duplicados, rechazos, notas de crédito/débito, auditoría, seguridad y soporte. ARCA publica manuales de WSFE y requiere solicitar autorización por web service o Comprobantes en Línea. No guardar clave fiscal del usuario; diseñar delegación/certificados con revisión experta. [ARCA WSFE y manuales](https://www.arca.gob.ar/fe/ayuda/webservice.asp), [requisitos de autorización](https://www.arca.gob.ar/fe/emision-autorizacion/solicitud-autorizacion.asp), [WSAA/certificados](https://www.arca.gob.ar/ws/documentacion/wsaa.asp), consultados 2026-10-16.
4. **Controlador fiscal:** no es una simple API de impresión; ARCA lo define como equipamiento homologado con alta/configuración y requisitos propios. No recomendable para PayAlert sin un alcance comercial específico y socio/dispositivo homologado. [ARCA modalidades](https://www.arca.gob.ar/facturacion/regimen-general/modalidades.asp), consultada 2026-10-16.

Estimaciones S/M/L son relativas al equipo PayAlert y sujetas a descubrimiento; no incluyen asesoramiento, habilitaciones, certificación, costos de proveedor o aceptación ARCA. La operación y responsabilidad fiscal de una integración multi-comercio, y los alcances de autorización que cada contribuyente puede delegar: **no confirmado** en esta investigación.

## 5. Condiciones para aprobar el ticket interno

1. Mantenerlo explícitamente informativo/no fiscal y no llamarlo factura/ticket fiscal.
2. Mostrar únicamente estados confirmados por consulta autoritativa del proveedor y sus fechas; separar claramente pendiente, aprobado/acreditado, rechazado, reembolsado, reversado/contracargo cuando el conector exponga dichos estados. No declarar “pagado” solo por captura, notificación push o webhook sin verificación final. El detalle de estados disponibles varía por proveedor: **no confirmado** hasta revisar contrato de cada conector.
3. Guardar referencia al origen y al momento de consulta, sin falsificar ni modificar datos del proveedor; reimpresión no crea un pago nuevo y puede quedar registrada como evento de auditoría.
4. Minimizar PII y secretos, controlar acceso por negocio/sucursal/rol y evitar incluir datos de pagador en URL/QR público.
5. Probar pendientes/rechazados, cambio de estado, reimpresión, caracteres, impresora/PDF y móvil; aclarar que no sustituye la factura del comercio.
6. Obtener validación de contador y revisión legal del texto final antes de lanzamiento; confirmar qué retención y acceso corresponden al dato/evidencia del movimiento.

**Decisión recomendada:** sí al ticket propio interno sujeto a estas condiciones; no presentarlo como prueba fiscal ni como sustituto del comprobante de Mercado Pago/Ualá o de la factura del comercio. Integración ARCA: diferida a una decisión de producto y factibilidad separada.

## Fuentes oficiales consultadas (todas al 2026-10-16)

- ARCA, [modalidades de emisión de comprobantes](https://www.arca.gob.ar/facturacion/regimen-general/modalidades.asp).
- ARCA, [clases de comprobantes](https://www.arca.gob.ar/facturacion/regimen-general/comprobantes.asp).
- ARCA, [facturación para monotributo](https://www.arca.gob.ar/monotributo/ayuda/facturacion.asp).
- ARCA, [solicitud de autorización de factura electrónica](https://www.arca.gob.ar/fe/emision-autorizacion/solicitud-autorizacion.asp).
- ARCA, [Web Service y manuales para desarrolladores](https://www.arca.gob.ar/fe/ayuda/webservice.asp); [WSAA](https://www.arca.gob.ar/ws/documentacion/wsaa.asp).
- Boletín Oficial, [RG AFIP 4290](https://www.boletinoficial.gob.ar/detalleAviso/primera/189307/20180803), [RG AFIP 4291](https://www.boletinoficial.gob.ar/detalleAviso/primera/189308/20180803), [RG ARCA 5614/2024](https://www.boletinoficial.gob.ar/detalleAviso/primera/318151/20241213).
- BCRA, [Transferencias 3.0](https://www.bcra.gob.ar/transferencias-3-0/).
- Mercado Pago Developers, [recuperar pagos por ID/API](https://mercadopago.com.ar/developers/en/guides/manage-account/account/retrieving-payments).
- Argentina.gob.ar, [Ley 24.240 actualizada](https://www.argentina.gob.ar/normativa/nacional/ley-24240-638/actualizacion), [Sistema Nacional de Arbitraje de Consumo](https://www.argentina.gob.ar/produccion/consumidor/sistema-nacional-de-arbitraje-de-consumo).

**Fuentes oficiales de ayuda de Mercado Pago/Ualá sobre la forma exacta de descargar/entregar un recibo de cobro y su alcance legal:** no confirmado. No se extrapola que un recibo de billetera sea factura fiscal. La referencia de Ualá al recibo/captura está en [ayuda de cuenta Ualá](https://www.uala.com.ar/caja-de-ahorro), pero no es una definición normativa del valor probatorio de un comprobante de cobro comercial (consultada 2026-10-16).
