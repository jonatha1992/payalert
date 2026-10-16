# PAY-21 — Viabilidad de integración MODO / PCT

**Consulta de fuentes:** 2026-10-16. **Alcance:** investigación documental; no se contactó a MODO ni se probaron cuentas/sandbox. Ticket PAY-21 (Jira; consultado 2026-10-16): relevar autorización/scopes, lectura de movimientos, webhook/firma, límites, sandbox y condiciones; no inventar endpoints ni implementar sin documentación/acceso. El ticket no tiene comentarios.

## 1. Pregunta que responde

¿Puede PayAlert integrar MODO/Open Banking para observar y conciliar pagos por transferencia (PCT) con documentación y acceso oficialmente verificables, y conviene iniciar esa integración ahora?

## 2. Hallazgos verificados con fuente

- MODO publica una propuesta de Open Banking para acceder a información financiera mediante APIs; la página menciona vinculación de cuentas con OAuth 2.0 y pagos acreditados de forma inmediata. No publica en esa página contrato técnico, endpoints ni permisos/scopes concretos. Fuente oficial: [Open Banking con MODO: PCT y validación de tarjetas](https://www.modo.com.ar/conexiones), consultada 2026-10-16.
- La página de MODO declara «una sola API para acceder al 95% de los CBUs» como afirmación comercial; no define universo, cobertura vigente ni condiciones. No tratarlo como cobertura garantizada para PayAlert. Misma fuente/fecha: [MODO Conexiones](https://www.modo.com.ar/conexiones).
- El BCRA describe el PCT en el contexto de billeteras, PSP y entidades financieras, e indica registro/certificación y requisitos de seguridad para quienes ofrecen esos servicios. La nota no establece que una app de conciliación como PayAlert acceda a movimientos de cuentas mediante una API ni que pueda actuar como iniciador/PSP. Fuente oficial: [Medidas para evitar fraudes en billeteras electrónicas](https://www.bcra.gob.ar/Noticias/Medidas-para-evitar-fraudes-billeteras-electronicas-i.asp), publicada 2022-02-24, consultada 2026-10-16.
- En el repositorio, el registro de proveedores permite únicamente `mercado_pago`, `uala` y `mock`; el modelo de transacción es normalizado y proveedor-agnóstico. Referencias verificadas: `frontend/lib/payments/types.ts` (`Provider`, `NormalizedTransaction`); `frontend/lib/payments/connectors/index.ts` (registro); `frontend/lib/server/connections.ts` (conexiones); `frontend/lib/payments/normalize.ts` (normalización). Búsqueda por «modo|pct» no encontró conector/documentación MODO local. La sección C de `docs/analisis/07-redundancias-y-viabilidad.md` también clasifica PAY-21 como bloqueado por falta de conector/guía y evidencia de acceso.

## 3. Qué NO se pudo confirmar

En las fuentes oficiales públicas revisadas no se confirmó documentación para desarrolladores ni se pudo obtener evidencia de: flujo de alta/acceso de PayAlert; OAuth completo, scopes, consentimiento y revocación; API de consulta/historial de movimientos, campos, paginación o ventana histórica; webhooks, firma, reintentos o idempotencia; cuotas/ratelimits; ambiente sandbox, credenciales o simulador; precios, comisiones, elegibilidad, contrato, SLA, soporte o aprobación de uso para terceros. No se confirmó si «MODO» y «PCT» refieren en el ticket al producto Open Banking de MODO o a otra modalidad comercial. La búsqueda pública no sustituye contacto ni portal privado del proveedor.

## 4. Opciones de integración

| Opción | Pros | Contras | Esfuerzo | Riesgo legal-comercial |
|---|---|---|---|---|
| A. Mantener bloqueado y solicitar documentación/acceso oficial | Evita diseñar sobre supuestos; permite decidir con contrato y sandbox reales. | Sin avance técnico hasta respuesta; disponibilidad/cobertura no asegurada. | S (discovery) | Medio: revisar términos, privacidad y roles regulatorios antes de manejar datos. |
| B. Conector de lectura de movimientos vía Open Banking | Potencial conciliación automática; MODO anuncia OAuth 2.0 y acceso a información financiera. | API, scopes, producto, formato, acceso y soporte no verificados; puede requerir cambios de consentimiento/seguridad. | L | Alto hasta revisión contractual, privacidad y elegibilidad. |
| C. Integración de cobro PCT/QR | Podría cubrir cobros iniciados por QR si existe oferta habilitada para comercios. | No equivale a leer movimientos entrantes de cualquier CBU/CVU ni prueba cobertura del caso PayAlert; producto y contrato no identificados. | L | Alto: condiciones comerciales, responsabilidades y alcance operativo sin confirmar. |

## 5. RECOMENDACIÓN

**Veredicto: Hacer con condiciones — solo discovery; NO-GO para implementación por ahora.** La página comercial oficial acredita que existe una propuesta de Open Banking con OAuth 2.0, pero no hay evidencia pública suficiente para verificar el contrato de integración requerido ni la elegibilidad/acceso de PayAlert.

Plan por fases:
1. Pedir a MODO documentación oficial vigente y una reunión/contacto técnico-comercial; separar explícitamente lectura de movimientos de iniciación/cobro PCT.
2. Validar contrato, roles, consentimiento, tratamiento/retención de datos, costos y cobertura con dueño y asesoría legal antes de recibir datos reales.
3. Si habilitan sandbox, prototipar solo lectura en entorno aislado y con datos de prueba; documentar campos, límites, revocación, firma/notificaciones y reconciliación. No inventar llamadas ni endpoints mientras no exista especificación.
4. Aprobar alcance y riesgo; recién entonces estimar con precisión e implementar con pruebas de contrato, tenant isolation, duplicados y revocación. Si no hay acceso/documentación oficial o el modelo no cubre el caso de negocio, cerrar como NO-GO.

## 6. Qué necesita decidir o proveer el dueño; prueba en sandbox

El dueño debe confirmar qué busca PAY-21 (leer transferencias recibidas para conciliar, iniciar pagos PCT, o ambas); autorizar contacto con MODO; aportar entidad/comercio elegible, contacto contractual y documentación/contrato si dispone; decidir si acepta costos y obligaciones de privacidad/retención tras revisión. No compartir secretos en tickets o chats.

Solicitar a MODO acceso de prueba, documentación de API y credenciales de sandbox por canal oficial. En ese ambiente, verificar consentimiento OAuth y scopes concedidos, listado/consulta de movimientos de prueba, revocación, deduplicación, firma/autenticidad y reintentos de webhook si ese mecanismo está documentado, cuotas, errores y límites históricos. Registrar evidencia sin datos personales innecesarios. Si MODO no ofrece sandbox, dejarlo como no confirmado y no sustituirlo por pruebas en producción sin autorización explícita y controles acordados.

## 7. Impacto en PayAlert

Si se aprueba, el alcance tocaría como mínimo:

- `frontend/lib/payments/types.ts`: agregar el identificador del proveedor al tipo `Provider` y confirmar si el contrato de `NormalizedTransaction` representa los campos documentados.
- `frontend/lib/payments/connectors/index.ts`: registrar el conector; `frontend/lib/payments/connectors/` alojaría su implementación.
- `frontend/lib/payments/normalize.ts`: mapear estados/campos solo según contrato oficial.
- `frontend/lib/server/connections.ts`: flujo de conexión, credenciales/token y cuenta de proveedor; requerirá adaptar al OAuth autorizado y almacenamiento existente.
- `frontend/lib/server/webhookHandler.ts` y rutas `frontend/app/api/webhooks/`: solo si MODO documenta notificaciones entrantes verificables. Firma/endpoint no inferidos.

Estos archivos existen y fueron verificados con búsqueda en el árbol. No se modificaron. La arquitectura concreta puede variar si la documentación del proveedor exige un modelo distinto.

## Fuentes

- MODO, [Open Banking con MODO: PCT y validación de tarjetas](https://www.modo.com.ar/conexiones), consultado 2026-10-16.
- MODO, [Preguntas frecuentes](https://www.modo.com.ar/ayuda/preguntas-frecuentes), consultado 2026-10-16. La página pública revisada es de ayuda general/comercial; no confirmó contrato API para el caso PayAlert.
- BCRA, [Medidas para evitar fraudes en billeteras electrónicas](https://www.bcra.gob.ar/Noticias/Medidas-para-evitar-fraudes-billeteras-electronicas-i.asp), publicada 2022-02-24; consultada 2026-10-16.
- Repositorio PayAlert: Jira PAY-21; `docs/analisis/07-redundancias-y-viabilidad.md` sección C; `frontend/lib/payments/types.ts`, `frontend/lib/payments/connectors/index.ts`, `frontend/lib/payments/normalize.ts`, `frontend/lib/server/connections.ts`, `frontend/lib/server/webhookHandler.ts` (lecturas/búsquedas realizadas 2026-10-16).
