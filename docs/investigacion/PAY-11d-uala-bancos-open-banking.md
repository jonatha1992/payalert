# PAY-11d — Ualá Bis, billeteras/bancos y Open Banking Argentina

**Consulta:** 18/10/2026. Investigación documental de fuentes públicas; no se usaron credenciales ni se consultaron cuentas. **Propósito:** alertar al comercio cuando recibe una transferencia común a su CBU/CVU/alias, no iniciada por QR ni checkout. Las conclusiones negativas se limitan a fuentes públicas localizadas: no prueban que no existan acuerdos privados.

## Veredicto ejecutivo

**No se encontró un feed público oficial, universal e instantáneo de transferencias entrantes para integrar directamente con Ualá Bis, Naranja X, Brubank, Personal Pay, Cuenta DNI, Prex, Lemon o Belo.** MODO anuncia Open Banking y OAuth 2.0, pero el material público encontrado no expone contrato de lectura de movimientos para terceros ni acceso para PayAlert. BCRA Transferencias 3.0 regula interoperabilidad/pagos, no ofrece a un SaaS un webhook de cada crédito. Belvo documenta datos de cuentas/transacciones con consentimiento y recursos por institución, pero no se confirmó cobertura argentina vigente para las cuentas del caso ni precio; Prometeo vende APIs de verificación/cash management y pagos regionales, pero no se confirmó API de lectura de movimientos de cuentas existentes de terceros en Argentina.

**Ranking recomendado** (viabilidad práctica para PayAlert):
1. **CVU/CBU/alias exclusivo por comercio en un PSP/banco que confirme oficialmente notificación de abonos** — mejor opción potencial; antes de elegir, pedir contrato, webhook/API, latencia/campos, costo y elegibilidad. No se identificó proveedor público con contrato confirmado en esta investigación.
2. **Reporte oficial de movimientos/settlement** — viable como conciliación batch, no alerta inmediata. Para Mercado Pago ya hay evidencia parcial en PAY-11b; validar inclusión y frescura del tipo de transferencia concreto. Para Ualá Bis no se halló reporte público de movimientos.
3. **Agregador/Open Banking con consentimiento** — potencialmente buena lectura para cuentas cubiertas; cobertura Argentina y acceso a movimientos exactos deben validarse por institución y cuenta. Comercial/legal/seguridad y posible scraping son riesgos relevantes.
4. **Importación manual de extracto CSV** — opción de bajo riesgo de credenciales, no automática ni inmediata; validar formato, procedencia y controles anti-duplicado.
5. **Lectura de correo de acreditación vía Gmail API con consentimiento** — posible contingencia, no confirmación financiera autoritativa: depende de que el banco emita mails consistentes, puede haber demora/ausencia/falsificación y exige scopes/retención de datos. No implementarla como prueba de pago sin corroboración.
6. **Automatización de home banking/scraping no autorizado** — descartar por fragilidad, exposición de credenciales y riesgo contractual.

## 1. Ualá Bis

- **Confirmado:** el portal oficial encontrado es “API Cobros Online” para checkout/órdenes; la documentación de creación de orden muestra `POST /checkout`, usuario/credenciales y `notification_url`. La página pública consultada no describe movimientos de cuenta ni transferencias entrantes genéricas. [Ualá Bis API Cobros Online](https://developers.ualabis.com.ar/), [Crear orden v1](https://developers.ualabis.com.ar/old-versions/v1/orders/create).
- **Confirmado:** el ejemplo de orden devuelve UUID, importe, estado y enlace checkout; `notification_url` pertenece al flujo de crear orden. **No equivale** a notificación de cualquier transferencia a CVU/CBU.
- **No encontrado:** API pública de movimientos, extracto, webhook de transferencia entrante, reporte de conciliación o mecanismo público OAuth para este uso. La evidencia local previa PAY-11 documenta API v2 de órdenes y el mismo límite. No se concluye que no exista oferta privada/habilitable por soporte.
- **Credenciales/autenticación:** el ejemplo antiguo tiene `userName`, y responde 401/403 por autorización/credenciales, pero la página consultada no basta para establecer flujo OAuth, emisión/rotación, scopes ni autenticación vigente. Solicitar documentación vigente directamente a Ualá Bis; no reutilizar el ejemplo legacy como guía de producción.
- **Recomendación:** pedir confirmación escrita de endpoint/reporte oficial para movimientos, scopes/credenciales, campos (ID, origen, destino, importe, estado), latencia, reversas, límites, tarifas y prueba autorizada. Hasta entonces, sin alerta automática de transferencia genérica.

## 2. Bancos y billeteras nombrados

Para Naranja X, Brubank, Personal Pay, Cuenta DNI, Prex, Lemon y Belo, **no se encontró en las fuentes oficiales públicas consultadas un contrato API de lectura de movimientos o webhook de transferencias entrantes a la cuenta del comercio**. Esto es “no encontrado”, no afirmación de inexistencia. La integración de cobros/QR de una billetera o el acceso visible en su app no implica API comercial para terceros.

| Proveedor | Evidencia práctica pública hallada | Estado para PayAlert |
|---|---|---|
| Naranja X | La web ofrece cuenta con CBU y cuenta/comercios para consultar liquidaciones y transacciones de cobros propios (QR/link/Tap); no se encontró en esas páginas un feed API de transferencias push genéricas. [Cuenta](https://www.naranjax.com/cuenta), [Comercios](https://www.naranjax.com/comercios) | **No encontrado** API/webhook de abono común. Dashboard de cobros no prueba movimientos bancarios. |
| Brubank | No se localizó documentación oficial pública de movimientos para integración de terceros en las búsquedas realizadas. | **No encontrado**; requerir contacto/portal oficial. |
| Personal Pay | No se localizó documentación oficial pública de feed de movimientos para terceros. | **No encontrado**. |
| Cuenta DNI / Banco Provincia | No se localizó contrato API público para leer acreditaciones comunes de una cuenta comerciante. | **No encontrado**. |
| MODO | La página oficial “Conexiones” anuncia Open Banking, OAuth 2.0 y acceso a información financiera; también afirma comercialmente cobertura de CBU amplia, sin definir universo/condiciones. No publica allí especificación de movimientos, scopes, alta, webhooks ni precios. [MODO Conexiones](https://www.modo.com.ar/conexiones) | **Confirmado** producto anunciado; **no confirmado** como API accesible/adecuada para PayAlert. PAY-21 ya recomienda discovery, no implementación. |
| Prex | No se localizó API pública oficial de movimientos de cuenta de comercio. | **No encontrado**. |
| Lemon | No se localizó API pública oficial de movimientos entrantes para comercios. APIs de cripto o trading, si las hubiera, no probarían movimientos CVU/CBU. | **No encontrado**. |
| Belo | No se localizó API pública oficial de movimientos entrantes a cuenta de comercio. | **No encontrado**. |

Estos proveedores operan en un ecosistema interoperable de cuentas CBU/CVU; que puedan recibir transferencias no supone que un tercero pueda leerlas vía API. Para cualquier oferta comercial privada, confirmar titularidad, cuenta de comercio, consentimiento/mandato, contrato SaaS, seguridad, privacidad y costos.

## 3. BCRA, Transferencias 3.0, DEBIN y Request to Pay

- **Confirmado:** BCRA describe Transferencias 3.0 como esquema interoperable de pagos por transferencia, con cuentas bancarias y de PSP (CBU/CVU/alias) y acreditación inmediata para pagos interoperables. [Preguntas y respuestas Transferencias 3.0](https://bcra.gob.ar/Noticias/transferencia-3-0-preguntas-respuestas-i.asp), [Pagos con Transferencia](https://www.bcra.gob.ar/Noticias/transferencias-3-0-pagos-con-transferencia-i.asp).
- **Límite importante:** esas reglas regulan participantes, esquemas e interoperabilidad; no publican un endpoint abierto para que PayAlert reciba notificaciones de cada crédito espontáneo en cualquier banco/billetera. La instantaneidad del rail no implica acceso API de terceros.
- **DEBIN / Request to Pay:** los esquemas de solicitud/iniciación permiten pedir o iniciar pagos con intervención/autorización del pagador; no son un mecanismo de observación general de transferencias push ya iniciadas por terceros. No se encontró una fuente BCRA que otorgue a un tercero SaaS notificación de abono a una cuenta ajena por usar DEBIN o Request to Pay. No usar estos nombres como sustituto de webhook de movimientos.
- **Unified transaction repository:** el material BCRA sobre Transferencias 3.0 menciona repositorio unificado para transacciones comprendidas en el esquema; no equivale a una API pública disponible para cada comercio ni a un feed de toda transferencia ordinaria.
- **Conclusión regulatoria:** no se encontró en las fuentes BCRA consultadas una interfaz universal de “acreditación a terceros”. Consultar siempre al banco/PSP receptor o a un proveedor autorizado que declare explícitamente cobertura y consentimiento.

## 4. Open Banking y agregadores

### Belvo

- **Confirmado:** la API documenta recursos `ACCOUNTS`, `BALANCES` y `TRANSACTIONS`, y los registros de institución incluyen código de país, recursos e `integration_type`; la documentación distingue integración `credentials` (tecnología de scraping de Belvo con credenciales del usuario) de `openfinance` (API de Open Finance del banco). [Transactions](https://developers.belvo.com/apis/belvoopenapispec/transactions), [Institutions](https://developers.belvo.com/apis/belvoopenapispec/institutions).
- **Consentimiento:** el acceso se vincula a una conexión/cuenta (`link`); verificar en el contrato y flujo de institución el consentimiento, alcance y revocación. Las fuentes citadas no prueban que cada banco argentino esté disponible ni que todos los movimientos se actualicen en tiempo real.
- **Argentina/costo:** la lista de instituciones es dinámica y debe consultarse con credenciales/entorno del cliente. No se confirmó en esta investigación cobertura argentina de una institución concreta ni tarifas públicas; pedir lista, método de conexión, frecuencia, disponibilidad, SLA y cotización. Sitio corporativo genérico no basta para afirmar presencia local.

### Prometeo

- **Confirmado:** su sitio describe operación en más de 110 países, validación de cuentas y servicios de pagos/cash management; la página de Borderless Banking menciona cuentas locales habilitadas por Prometeo y cash-ins en cuentas regionales. [Prometeo](https://prometeoapi.com/), [Borderless Banking](https://prometeoapi.com/en/borderless-banking).
- **No confirmado:** lectura de movimientos históricos de cuentas bancarias argentinas existentes de cualquier usuario/comercio mediante consentimiento, disponibilidad por institución y notificación entrante. El producto no debe equipararse sin más a un agregador de cuentas.
- **Costo:** no se encontró tarifa pública aplicable; solicitar cotización y confirmar país, producto, modelo de cuentas y elegibilidad.

### MODO, Interbanking, Mobbex y Nave

- **MODO:** oferta pública de Open Banking, OAuth 2.0; especificación, movimientos, acceso, precios y cobertura real no publicados en la fuente hallada. [MODO Conexiones](https://www.modo.com.ar/conexiones). PAY-21 ya recoge el bloqueo.
- **Interbanking:** portal técnico genérico tiene APIs que pueden requerir solicitud/evaluación y OAuth según API; no se confirmó API concreta de lectura de movimientos bancarios ni cobertura/costo. PAY-22 detalla que producto y acceso deben confirmarse con el proveedor. [Portal de desarrolladores](https://developers.interbanking.com.ar/api/prod/node/3).
- **Mobbex:** el sitio describe infraestructura de cobros y webhooks nativos para operaciones procesadas por su plataforma; no es evidencia de lectura de transferencias externas a una cuenta bancaria. [Mobbex](https://www.mobbex.com/). **No encontrado** feed de movimientos de cuenta receptor.
- **Nave:** no se encontró documentación técnica pública verificable con un feed de transferencias entrantes para este caso; la búsqueda disponible no produjo resultados útiles. No afirmar que el servicio no exista.

### Costos y riesgos de agregadores

No se hallaron precios públicos concluyentes para Belvo, Prometeo, MODO o Interbanking aplicables a PayAlert. Presupuestar solo luego de cotización. Validar consentimiento revocable, finalidad, retención/minimización, cifrado, incidentes, cobertura y frecuencia; una conexión por credenciales/scraping tiene riesgo operativo y de términos mayor que una API bancaria/Open Finance directa. Los agregadores pueden ofrecer datos de movimientos, pero no necesariamente webhook instantáneo: puede ser sincronización/polling con latencia y disponibilidad variable.

## 5. Alternativas operativas

1. **CVU/CBU/alias único por comercio:** separar fondos facilita atribución y evita asignar por monto/hora, pero no produce alerta por sí solo. Es útil solo cuando el proveedor receptor ofrece un feed/webhook/reporte documentado y un identificador estable. Preguntar si puede emitirse CVU/alias por subcuenta/orden y cómo se notifican abonos.
2. **Gmail API, correo de acreditación:** con consentimiento OAuth mínimo, leer un buzón dedicado y parsear mensajes recibidos puede servir como señal auxiliar/contingencia. El email no es fuente autoritativa: validar remitente, duplicados, demoras, cambios de plantilla y suplantación; nunca marcar “pago confirmado” solo por texto/captura. Minimizar scopes y retención; no automatizar acceso a buzones sin consentimiento explícito.
3. **Extractos CSV:** comercio descarga/exporta un extracto oficial y lo importa. Es auditable y evita compartir contraseña bancaria; es batch/manual, sujeto al formato, hora de exportación y duplicados/reversiones. Exigir identificador estable; no confirmar por coincidencia débil.
4. **Reportes settlement del PSP:** para Mercado Pago existe vía parcial documentada, típicamente diaria/semanal/mensual; no es tiempo real. PAY-11b recomienda modo revisión hasta probar la clase de transferencia.
5. **Conciliación manual:** alternativa inicial segura cuando no hay feed oficial, separada de “confirmación automática”. No scraping ni automatización de home banking.

## 6. Matriz de decisión

Escala cualitativa; costo/esfuerzo son relativos y el costo comercial real no está publicado.

| Camino | Viabilidad | Costo esperado | Esfuerzo | Riesgo | Juicio |
|---|---|---:|---:|---:|---|
| Cuenta/CVU único + webhook oficial del receptor | Alta si proveedor confirma; hoy sin proveedor confirmado aquí | $$–$$$ | M–L | Medio (dependencia/proveedor, privacidad) | Prioridad de discovery; exigir contrato y prueba real autorizada. |
| Settlement/reporte oficial | Media; MP parcial, Ualá Bis no encontrado | $–$$ | M | Medio (batch, inclusión y latencia) | Piloto de conciliación supervisada; no prometer instantaneidad. |
| Agregador con consentimiento | Media/baja hasta validar institución argentina | $$–$$$ | L | Alto (cobertura, credenciales/scraping, datos sensibles) | Discovery comercial/técnico; no iniciar con cobertura supuesta. |
| CSV de extracto | Alta como proceso manual | $ | S–M | Bajo/medio | Buen fallback/piloto, no alerta automática. |
| Gmail API de notificaciones | Baja/media como señal auxiliar | $–$$ | M | Alto para confirmar pagos | Solo complemento con consentimiento; no autoritativo. |
| Scraping/home banking | No aceptable | — | — | Inaceptable | Descartar. |

**Recomendación:** no habilitar “transferencia recibida” como confirmación automática con base en BCRA/DEBIN, MODO comercial o una app móvil. Abrir discovery con Ualá Bis y 1–2 proveedores receptores que puedan asignar CVU/CBU único y entregar webhook/API de movimientos; en paralelo validar el reporte MP ya conocido. Si no hay feed oficial, ofrecer CSV/manual; Gmail solo como aviso auxiliar y claramente no autoritativo.

## Fuentes y estado de evidencia

- **Ualá Bis:** [portal oficial](https://developers.ualabis.com.ar/), [orden v1](https://developers.ualabis.com.ar/old-versions/v1/orders/create). API pública encontrada orientada a cobros/órdenes; feed genérico no encontrado.
- **BCRA:** [Transferencias 3.0 preguntas y respuestas](https://bcra.gob.ar/Noticias/transferencia-3-0-preguntas-respuestas-i.asp), [Pagos con Transferencia](https://www.bcra.gob.ar/Noticias/transferencias-3-0-pagos-con-transferencia-i.asp). Interoperabilidad/acreditación no es API para terceros.
- **Belvo:** [Transactions](https://developers.belvo.com/apis/belvoopenapispec/transactions), [Institutions](https://developers.belvo.com/apis/belvoopenapispec/institutions), [sitio](https://www.belvo.com/). Producto de datos confirmado; Argentina/cobertura/precio concretos no confirmados.
- **Prometeo:** [sitio](https://prometeoapi.com/), [Borderless Banking](https://prometeoapi.com/en/borderless-banking). Oferta regional confirmada; lectura de cuentas argentinas externas y tarifas no confirmadas.
- **MODO:** [Conexiones](https://www.modo.com.ar/conexiones). Oferta comercial Open Banking/OAuth anunciada; especificación y acceso PayAlert no confirmados.
- **Interbanking:** [documentación de uso de APIs](https://developers.interbanking.com.ar/api/prod/node/3). APIs genéricas sujetas a acceso/evaluación; movimientos de cuentas no confirmados (ver PAY-22).
- **Mobbex:** [sitio oficial](https://www.mobbex.com/). Webhooks de su plataforma de cobros; movimientos bancarios externos no confirmados.
- **Naranja X:** [cuenta](https://www.naranjax.com/cuenta), [comercios](https://www.naranjax.com/comercios). Cuenta y vistas de transacciones de cobros propios; API de abonos genéricos no encontrada.
- **Mercado Pago:** ver [PAY-11b](PAY-11b-mercadopago-transferencias.md): webhook/IPN no documenta transferencia genérica; settlement report es vía parcial batch.
- **Contexto previo:** [PAY-11](PAY-11-transferencias-cvu-cbu.md), [PAY-21 MODO/PCT](PAY-21-modo-pct.md), [PAY-22 Interbanking](PAY-22-interbanking.md).

**Fuentes consultadas:** documentación pública y búsquedas dirigidas el 18/10/2026. No se contactó a proveedores, no se probaron APIs ni credenciales, no se realizaron transferencias. Costos comerciales, elegibilidad de PayAlert y cobertura puntual permanecen pendientes.
