# PAY-22 — Viabilidad de integrar Interbanking

**Consulta de fuentes: 16/10/2026.** Investigación documental; no se contactó a Interbanking ni se probaron credenciales o servicios. Las afirmaciones de producto y autenticación se limitan a lo publicado oficialmente; toda capacidad no documentada queda indicada como no confirmada.

## 1. Pregunta que responde el ticket

¿PayAlert puede conectarse oficialmente a Interbanking para importar movimientos/cuentas bancarias y conciliarlos, y bajo qué condiciones comerciales, técnicas y legales? PAY-22 pide confirmar acceso comercial, autenticación/OAuth/certificados, cuentas y movimientos, polling/webhooks, límites, sandbox y restricciones. No automatizar Home Banking ni usar interfaces no confirmadas.

## 2. Hallazgos verificados

- El portal oficial para desarrolladores describe APIs con planes que pueden tener acceso restringido y requerir solicitud y evaluación; los planes exponen límites de velocidad y consumo. También documenta prueba interactiva (“Probar”) para APIs REST. No implica que exista un plan habilitado para PayAlert ni un sandbox separado. Fuente: [Cómo utilizar nuestras API](https://developers.interbanking.com.ar/api/prod/node/3), consultada 16/10/2026.
- El mismo documento oficial contempla OAuth2 con flujos `client_credentials` o `password`; aplicación registrada con Client ID/Secret, scope y URL de token específicos de cada API. Describe token bearer con expiración y refresh token. Para APIs que usan `password` requiere crear un Operador API con permisos administrativos; la guía indica permiso “Transferencias” y, para administración conjunta, autorización adicional. Estos son requisitos condicionales a la API concreta, no prueba de que la API bancaria buscada use ese flujo o requiera ese permiso. Fuente: [Cómo utilizar nuestras API](https://developers.interbanking.com.ar/api/prod/node/3), consultada 16/10/2026.
- La documentación oficial de aplicaciones dice que el secreto se muestra una vez y, si se pierde, hay que eliminar y crear otra aplicación para obtener uno nuevo. Fuente: [Aplicaciones](https://developers.interbanking.com.ar/api/prod/node/4), consultada 16/10/2026.
- El portal publica orientación sobre certificados raíz e intermedios Sectigo y su instalación si el sistema no los confía; no es una especificación de mTLS ni de certificados cliente. Fuente: [Certificados](https://developers.interbanking.com.ar/api/prod/node/1059), consultada 16/10/2026.
- Interbanking describe en su sitio corporativo servicios de tesorería, centralización de cuentas/saldos y operación multi-banco, así como planes comerciales. La descripción funcional no acredita que esas funciones estén expuestas a terceros mediante API. Fuente: [Interbanking](https://www.interbanking.com.ar/), consultada 16/10/2026.
- El catálogo oficial del BCRA consultado enumera APIs de información pública (Central de Deudores, Cheques denunciados, estadísticas y Régimen de Transparencia). No es una API para consultar los movimientos privados de cuentas de una empresa ni evidencia de un marco de acceso aplicable a este conector. Fuente: [API del BCRA](https://www.bcra.gob.ar/apis-banco-central/), consultada 16/10/2026.

## 3. Qué no se pudo confirmar

No se pudo confirmar en documentación oficial pública accesible qué producto/API permite leer movimientos y saldos bancarios empresariales, su cobertura de bancos/cuentas, permisos y modelo de consentimiento/mandato, endpoints o esquema de respuesta, paginación e incrementalidad, disponibilidad histórica, frecuencia, rate limits concretos, webhooks/eventos, política de reintentos, sandbox y datos de prueba, costo/plan, condiciones de reventa o uso por un SaaS multiempresa, ni restricciones contractuales para almacenar/procesar esos datos. Tampoco se confirmó si la autenticación del producto de consulta requiere OAuth específico, certificados cliente, VPN u otro mecanismo. El portal genérico no resuelve estos puntos; no se infieren endpoints ni tarifas.

## 4. Opciones de integración

| Opción | Pros | Contras | Esfuerzo | Riesgo legal-comercial |
|---|---|---|---|---|
| A. Discovery con Interbanking; no construir hasta recibir respuestas y acceso de prueba | Valida producto, contrato, elegibilidad, seguridad y sandbox antes de invertir; mantiene PAY-22 en alcance acotado | Depende de respuesta y eventual aprobación comercial; todavía no entrega integración | S | Bajo durante discovery; medio hasta revisar contrato y tratamiento de datos |
| B. Conector API oficial, por cuenta/empresa autorizada, solo tras confirmar APIs y términos | Reutilizaría autenticación oficial y capacidad de consulta que el proveedor confirme; posibilita automatizar conciliación | Credenciales, permisos, refresco/rotación y posiblemente polling; cobertura/frecuencia y costo desconocidos | L | Alto hasta revisión contractual, privacidad, consentimiento/mandato y seguridad de secretos; reducible con aprobación escrita |
| C. Carga manual de extracto/archivo autorizado como alternativa temporal | Evita credenciales bancarias y automatización de Home Banking; puede validar valor del matching | No es integración Interbanking ni automatización; formato, frecuencia y soporte manual por definir | M | Medio: revisar procedencia, autorización, retención y minimización de datos |
| D. Automatizar portal/Home Banking, scraping o API no documentada | Ninguna ventaja aceptable frente a canales autorizados | No oficial, frágil, expone credenciales y puede evadir controles; explícitamente fuera del ticket | — | Inaceptable; descartar |

## 5. RECOMENDACIÓN

**Veredicto: Hacer con condiciones** — hacer ahora únicamente discovery oficial (opción A); **NO-GO para construir el conector** hasta confirmar acceso comercial, API de lectura de movimientos/saldos, sandbox o método seguro de prueba, términos que permitan el uso SaaS multiempresa y revisión legal/privacidad.

Fases:
1. El dueño solicita a Interbanking confirmación escrita del producto/API aplicable, elegibilidad de PayAlert, costo/plan, modelo de autorización por cliente, cobertura y términos de tratamiento/retención.
2. Con esa respuesta, registrar una aplicación de prueba y obtener documentación específica por API (scopes, autenticación, certificado si aplica, límites, sandbox, movimientos/saldos, cursor/fechas y errores). No compartir secretos en tickets/chat.
3. Seguridad/legal revisa contrato, consentimiento/mandato, roles de operadores, minimización, cifrado, aislamiento por negocio, revocación y borrado. Bloquear cualquier acción de pago/transferencia; alcance inicial solo lectura.
4. Prototipo aislado contra sandbox aprobado o cuenta de prueba autorizada: verificar autenticación, datos de cuenta y movimientos, duplicados, paginación/recuperación, límites, revocación y aislamiento entre negocios. No usar datos reales de clientes sin autorización y aprobación separada.
5. Solo con evidencias y aceptación del dueño: estimar implementación, monitoreo y plan de despliegue; mantener carga manual como alternativa si el proveedor no habilita API adecuada.

## 6. Qué necesita decidir o proveer el dueño y prueba en sandbox

- Contacto/relación comercial con Interbanking y confirmación de elegibilidad de PayAlert como integrador SaaS; contrato/plan y permiso explícito de uso multiempresa.
- Cuenta empresarial propietaria para el piloto, operador administrador autorizado y confirmación de quién puede otorgar/revocar acceso. No reutilizar credenciales personales ni pedirlas por chat.
- Documentación oficial específica de la API de consulta, scopes, autenticación, requisitos de certificados, límites, retención permitida y soporte; confirmación del sandbox y datos/cuentas de prueba. Si solo hay producción, detenerse y pedir un mecanismo de prueba aprobado, no experimentar con cuentas reales.
- Decisión de alcance: solo lectura (recomendado), frecuencia aceptable y datos que PayAlert necesita persistir; aprobación legal/privacidad y del dueño antes de manejar datos bancarios.
- En sandbox: obtener consentimiento/alta según procedimiento oficial; probar cuentas autorizadas, consulta inicial e incremental, paginación, actualización/reversas, reintentos y límites documentados; comprobar que revocar acceso detiene ingesta y que una cuenta/negocio no ve datos de otro. Guardar evidencia redactada sin secretos ni datos financieros identificables.

## 7. Impacto en PayAlert

Impacto potencial, mapeado a archivos existentes verificados con `git grep`:

- `frontend/lib/payments/types.ts`: `Provider`, `PaymentConnection`, `NormalizedTransaction` y `PaymentConnector` son el contrato conceptual donde habría que decidir si Interbanking es proveedor/conector de solo lectura. No se debe forzar el flujo actual de webhook si el API confirmado requiere polling.
- `frontend/lib/payments/connectors/mercadopago.ts` y `frontend/lib/payments/connectors/uala.ts`: ejemplos existentes de conector y consulta autenticada; no son reutilizables como API de Interbanking y no confirman compatibilidad.
- `frontend/lib/payments/normalize.ts`: contiene `normalizeMercadoPagoPayment` y `normalizeUalaOrder`; un conector aprobado necesitaría mapeo específico de movimientos bancarios al tipo normalizado, incluyendo signo/débito-crédito, moneda, fecha, referencia e identificador idempotente con semántica documentada.
- `frontend/lib/payments/ingest.ts` y `frontend/lib/server/paymentsRepository.ts`: ingestión, deduplicación, persistencia y matching; habría que diseñar una entrada batch/polling e idempotencia antes de integrar eventos no webhook.
- `frontend/lib/server/connections.ts` y `frontend/app/api/integrations/route.ts`: alta/gestión de conexiones y secretos por negocio; revisar UX de consentimiento y ciclo de revocación. La ruta OAuth actual es específica a Mercado Pago (`frontend/app/api/integrations/mercadopago/route.ts`), no sirve como prueba de OAuth Interbanking.
- Persistencia/modelo: revisar `payment_connections` y `transactions` junto con las migraciones antes de añadir campos de cursor, última sincronización o referencias bancarias; no se verificó aquí una migración existente para Interbanking ni se propone editarla.

**Fuentes y fecha de consulta:** enlaces oficiales listados en Hallazgos verificados; todas consultadas el 16/10/2026. El documento de viabilidad previo del repo, `docs/analisis/07-redundancias-y-viabilidad.md` sección C, clasifica PAY-22 como bloqueado hasta evidencias oficiales, decisión comercial y sandbox; `docs/providers/` contiene guías de Mercado Pago y Ualá, no de Interbanking. `docs/PLANES_SAAS.md` y `docs/DECISIONS.md` no autorizan costos o tratamiento de datos de un proveedor nuevo. Sin cambios de código ni pruebas ejecutadas.
