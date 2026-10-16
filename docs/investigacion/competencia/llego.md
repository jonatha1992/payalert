# Análisis de competencia: ¡Llegó!

**Consulta:** 2026-10-16. Fuente pública consultada: [sitio oficial](https://llegopagos.com.ar/). Cada dato de producto/comercial de este análisis se atribuye a esa página y a la fecha indicada. La página no expone información suficiente para confirmar detalles técnicos, legales o de plataforma; se marca **no confirmado** cuando corresponde. No se crearon cuentas ni se accedió a contenido privado.

## 1. Qué es y a quién apunta

¡Llegó! se presenta como un servicio para que comercios reciban avisos visuales y por voz al acreditarse pagos de Mercado Pago. Apunta explícitamente a comercios, kioscos, supermercados, autoservicios y bazares chinos; destaca interfaz y voz en español y chino mandarín. (Fuente: [home](https://llegopagos.com.ar/), consulta 2026-10-16.)

## 2. Cómo funciona, paso a paso, técnicamente

1. El comercio vincula su cuenta de Mercado Pago “en un clic” y el sitio afirma que no se comparte la contraseña.
2. El cliente paga como siempre mediante QR, link o transferencia, según la descripción comercial.
3. ¡Llegó! muestra el cobro y anuncia en voz alta el monto y quién pagó; declara que el aviso aparece cuando se acredita el pago.

(Fuente: [home](https://llegopagos.com.ar/), consulta 2026-10-16.)

**Detalles no confirmados por el sitio:** mecanismo de autorización exacto (OAuth u otro), permisos/scopes solicitados, uso de webhooks o polling, validación contra API del proveedor, almacenamiento de credenciales/datos, cifrado, latencia cuantificada o garantía/SLA. “En un clic”, “conexión oficial” y “al instante” son declaraciones comerciales, no especificación técnica. El sitio menciona tablet o TV como pantalla para el local; los sistemas operativos/navegadores compatibles y otros dispositivos son **no confirmado**. El aviso se describe en pantalla y por voz; no se especifica si es audio local/TTS, ni configuración de volumen, sonido o voz. (Fuente: [home](https://llegopagos.com.ar/), consulta 2026-10-16.)

## 3. Funciones verificadas

Según el sitio oficial (consulta 2026-10-16):

- Avisos de pagos en pantalla y por voz, con monto y nombre de quien pagó.
- Pantalla de cobros en grande para tablet o TV.
- Interfaz/voz en español y chino mandarín.
- Historial de cobros y total recibido durante el día; la retención depende del plan.
- Conexión declarada con Mercado Pago; el sitio cita pagos por QR, link y transferencia.
- El plan Pro anuncia usuarios para empleados y uso en dispositivos ilimitados.

**No confirmado:** roles/permisos de empleados, gestión de caja/sesiones, reportes exportables, QR propio o generación de QR, impresión, multi-sucursal, conexión con otros proveedores de pago, conciliación automática/manual, filtros y formatos del historial, API o integraciones adicionales. El sitio no describe estas funciones. (Fuente: [home](https://llegopagos.com.ar/), consulta 2026-10-16.)

## 4. Precios y planes publicados

Precios tal como aparecen en la página, sin inferir impuestos, moneda de cobro o condiciones no mostradas:

| Plan | Precio publicado | Prestaciones indicadas |
|---|---:|---|
| Free | $0, “para siempre” | Avisos en pantalla en tiempo real; voz en español; 1 dispositivo; historial de 7 días. |
| Pro | $15.000 por mes | Todo lo de Free “sin límites”; voz en español y chino; dispositivos ilimitados; usuarios para empleados; historial completo y soporte prioritario. Prueba de Pro por 14 días al crear cuenta, sin tarjeta. |

Fuente: [home](https://llegopagos.com.ar/), consulta 2026-10-16. No se aclara en la página revisada la fecha de vigencia del precio, impuestos, medios de pago, renovación/cancelación o condiciones detalladas de la prueba: **no confirmado**.

## 5. Seguridad y privacidad declaradas

El sitio afirma que la vinculación no requiere compartir la contraseña y que la conexión es oficial con Mercado Pago; también declara que los datos y el dinero siguen siendo del cliente. (Fuente: [home](https://llegopagos.com.ar/), consulta 2026-10-16.)

No se encontró en la página pública consultada una política de privacidad, términos, detalle de datos retenidos, períodos de conservación, cifrado en tránsito/reposo, revocación/desconexión, subprocesadores o procedimiento de eliminación. Todo lo anterior queda **no confirmado**; la ausencia en la home no prueba que no exista documentación en otros canales.

## 6. Apps y plataformas

La página habla de mostrar cobros en una tablet o TV, pero no enlaza desde el contenido revisado una tienda de aplicaciones ni declara versiones nativas. Disponibilidad de Android, iOS, web instalable/PWA o Windows, así como enlaces de Google Play/App Store/Microsoft Store, es **no confirmado**. Fuente: [home](https://llegopagos.com.ar/), consulta 2026-10-16.

## 7. Debilidades o huecos observables

- La propuesta pública se centra en Mercado Pago; no se publicitan otros proveedores. Cobertura de otras pasarelas **no confirmada**.
- La promesa de inmediatez no viene acompañada de latencia medida, disponibilidad o explicación de recuperación ante fallos.
- Seguridad se comunica con afirmaciones generales, sin política/detalle técnico visible en la página consultada.
- El listado comercial es breve: no define permisos de empleados ni funciones operativas como conciliación, caja, impresión o multi-sucursal.
- El sitio no permite determinar plataformas compatibles ni si existe aplicación nativa.

Son límites de la información pública revisada, no afirmaciones de que el producto carezca de esas capacidades. Fuente de cada observación: [home](https://llegopagos.com.ar/), consulta 2026-10-16.

## 8. Qué aprende PayAlert

Comparación con documentación del repositorio: [`docs/analisis/00-descripcion-global.md`](../../analisis/00-descripcion-global.md), [`docs/analisis/01-actores-y-roles.md`](../../analisis/01-actores-y-roles.md) y [`docs/PLANES_SAAS.md`](../../PLANES_SAAS.md) (lectura 2026-10-16).

- **Propuesta enfocada:** ¡Llegó! comunica una sola tarea de mostrador —enterarse del pago sin mirar el celular— y demuestra el resultado con voz/pantalla. PayAlert ya documenta webhooks, normalización y notificaciones, pero su descripción global abarca conexiones, matching, revisión y reportes. Conviene evaluar un recorrido inicial más directo sin confundirlo con una capacidad ya implementada.
- **Voz y pantalla compartida:** son diferenciales explícitos de ¡Llegó!, incluida voz en chino y pantallas múltiples de Pro. En PayAlert, PWA/preferencias de notificación están dentro del alcance documentado, mientras que una app móvil nativa figura fuera/no comprometida en la descripción global; voz y chino no están confirmados en los documentos revisados.
- **Pagos con fuente autoritativa:** el sitio afirma inmediatez, pero no publica el mecanismo. PayAlert documenta recepción asíncrona de webhooks, consulta del movimiento al proveedor como fuente autoritativa, persistencia idempotente y procesamiento diferido. Esta precisión técnica es una fortaleza documental de PayAlert; comunicarla al usuario requiere evitar prometer latencias no medidas.
- **Roles:** ¡Llegó! anuncia “usuarios para tus empleados” en Pro sin detallar permisos. PayAlert tiene roles documentados de owner, manager y cashier con matriz RBAC; la documentación también advierte huecos de gobierno y habilitación de soporte. Puede diferenciarse explicando claramente qué puede hacer cada rol, si la UX acompaña el modelo.
- **Planes comerciales:** ¡Llegó! publica Free y Pro con precio y límites visibles; PayAlert mantiene planes y límites como propuesta no aprobada, sin precios validados. Es una oportunidad de claridad comercial, pero no se debe copiar precio ni fijar cuotas sin validar costos, uso, soporte y decisión del dueño, tal como exige `docs/PLANES_SAAS.md`.
- **Alcance de proveedores:** la documentación de PayAlert contempla conectores Mercado Pago/Ualá; la página de ¡Llegó! solo destaca Mercado Pago. La cobertura adicional puede ser diferenciadora únicamente en la medida en que esté operativa y verificable.

**Fuentes de comparación PayAlert:** `docs/analisis/00-descripcion-global.md`, `docs/analisis/01-actores-y-roles.md`, `docs/PLANES_SAAS.md`, consulta local 2026-10-16. **Fuente de competencia:** [https://llegopagos.com.ar/](https://llegopagos.com.ar/), consulta 2026-10-16.
