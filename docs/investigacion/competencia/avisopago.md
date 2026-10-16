# Competencia: AvisoPago

**Consulta de fuentes públicas:** 2026-10-16. Las características, precios y afirmaciones siguientes son declaraciones del sitio, no pruebas independientes de implementación o rendimiento.

## 1. Qué es y a quién apunta

AvisoPago se presenta como herramienta independiente para que comercios argentinos que cobran con Mercado Pago confirmen pagos y compartan avisos con empleados sin darles acceso a la cuenta real. Apunta a comercios de mostrador (ejemplos: ferretería, panadería, kiosco) donde importa validar rápido el cobro y controlar turnos/caja. Dice no custodiar fondos ni reemplazar Mercado Pago. [Inicio](https://avisopago.com/) y [términos](https://avisopago.com/terminos.php), consultados 2026-10-16.

## 2. Cómo funciona, paso a paso y técnicamente

1. El dueño crea cuenta AvisoPago y autoriza Mercado Pago desde el flujo oficial; el sitio dice que no pide ni almacena la clave de Mercado Pago. La política describe autorización oficial, tokens cifrados y desconexión desde el panel; el tipo/protocolo concreto (OAuth explícito) no está confirmado. [Guía](https://avisopago.com/tutorial.php), [privacidad](https://avisopago.com/privacidad.php), consultadas 2026-10-16.
2. El dueño crea empleados y comparte ID/clave o código de acceso; limita permisos y dispositivos. La existencia de roles distintos dueño/empleado está publicada; otras jerarquías no están confirmadas. [Inicio](https://avisopago.com/), [guía](https://avisopago.com/tutorial.php), consultadas 2026-10-16.
3. El empleado inicia sesión en AvisoPago desde navegador/PWA y habilita notificaciones. Al llegar un pago, se muestra importe, cliente, referencia/ID y hora; puede activar sonido y voz. [Guía](https://avisopago.com/tutorial.php), consultada 2026-10-16.
4. El sitio declara confirmación “en 1 segundo” y visibilidad “al instante”, pero no publica medición, percentiles ni SLA. Los términos aclaran que rapidez depende de webhooks, sincronización manual, tiempos de Mercado Pago, conectividad y permisos del navegador. La implementación (webhook vs polling/sincronización) y permisos técnicos específicos solicitados a Mercado Pago no están confirmados. [Inicio](https://avisopago.com/), [términos](https://avisopago.com/terminos.php), consultados 2026-10-16.
5. Hay búsqueda manual (“Buscar pagos ahora”) según soporte. El aviso push requiere permiso del navegador. [Soporte](https://avisopago.com/soporte.php), consultado 2026-10-16.

## 3. Funciones publicadas

- Empleados con acceso limitado: sin saldo, transferencias ni acceso a Mercado Pago. Revocación de empleado/dispositivo. [Inicio](https://avisopago.com/), consultado 2026-10-16.
- Caja: ingresos, egresos, neto diario, pendientes, ticket promedio; movimientos filtrables por fecha, cliente, empleado, estado y dirección del dinero. [Inicio](https://avisopago.com/), consultado 2026-10-16.
- Asociación de QR generado por empleado a ese acceso; marca transferencia como “Mi venta”. QR sujeto a habilitación del dueño, con importe/motivo según tutorial. [Inicio](https://avisopago.com/), [guía](https://avisopago.com/tutorial.php), consultadas 2026-10-16.
- Edición de motivo/cliente cuando Mercado Pago no los informa. [Inicio](https://avisopago.com/), consultado 2026-10-16.
- Impresión de tickets/reportes en PC y descarga de comprobante/ticket en celular. [Inicio](https://avisopago.com/), [guía](https://avisopago.com/tutorial.php), consultadas 2026-10-16.
- Avisos con sonido y voz; depende de navegador/volumen. [Inicio](https://avisopago.com/), consultado 2026-10-16.
- Multi-sucursal: el plan de 10 dispositivos se orienta a más cajas, turnos o sucursales; administración real de sucursales separadas no está confirmada. Multi-proveedor: solo se anuncia Mercado Pago Argentina. [Inicio](https://avisopago.com/), consultado 2026-10-16.
- Conciliación formal con reglas o estados: no confirmado. Hay consulta de movimientos, búsqueda manual y caja/reportes; no se describe conciliación contable. [Inicio](https://avisopago.com/), [soporte](https://avisopago.com/soporte.php), consultados 2026-10-16.

## 4. Precios y planes publicados

- Prueba gratuita de 7 días, sin tarjeta, activada al vincular Mercado Pago.
- Inicial: ARS 10.000 cada 30 días, hasta 3 dispositivos activos; acceso limitado, avisos y reportes imprimibles.
- Más dispositivos: ARS 20.000 cada 30 días, hasta 10 dispositivos; orientado a más cajas/turnos/sucursales.
- Suscripción pagada vía Mercado Pago Checkout Pro; el crédito se activa al confirmarse pago aprobado. Al vencer la prueba o crédito, se pausan notificaciones (la página de inicio también menciona suspensión del servicio), pero se conservan datos/accesos administrables.

[Inicio](https://avisopago.com/), [términos](https://avisopago.com/terminos.php), consultados 2026-10-16. No se publica en estas fuentes precio anual, impuestos, reembolsos ni condiciones detalladas adicionales: no confirmado.

## 5. Seguridad y privacidad declaradas

La política dice almacenar datos de dueño (nombre, email, hash de contraseña, actividad), empleados (nombre, código, dispositivos/actividad), cuenta MP (identificador, país, estado, tokens cifrados), datos operativos de movimientos, IP/navegador, auditoría, push, errores y consultas de soporte. Declara cifrado de tokens/secretos, sesiones seguras, CSRF, límites de intentos, auditoría y separación dueño/empleado; indica que no vende datos personales. El dueño puede desconectar Mercado Pago, revocar dispositivos/empleados y pedir revisión o eliminación por soporte. [Privacidad](https://avisopago.com/privacidad.php), [inicio](https://avisopago.com/), consultados 2026-10-16. Algoritmos, gestión de claves, retención exacta, certificaciones y auditorías independientes: no confirmado.

## 6. Apps y dispositivos

No requiere instalación desde tienda: sitio web instalable como PWA/acceso directo en Android (Chrome), iPhone (Safari), Windows (Chrome/Edge) y Mac (Safari/Chrome/Edge). No se encontraron enlaces publicados a tiendas Android/iOS ni app nativa; la oferta descrita es navegador/PWA. [Inicio](https://avisopago.com/), [tutorial](https://avisopago.com/tutorial.php), consultados 2026-10-16.

## 7. Debilidades o huecos observables

- Dependencia publicada de Mercado Pago y disponibilidad inicial solo Argentina; no se anuncia proveedor alternativo. [Inicio](https://avisopago.com/), consultado 2026-10-16.
- “En 1 segundo” no viene acompañado de metodología ni garantía; sus términos reconocen dependencias externas y demoras. [Inicio](https://avisopago.com/), [términos](https://avisopago.com/terminos.php), consultados 2026-10-16.
- No se confirman API/webhooks, permisos OAuth exactos, arquitectura, SLA, auditoría de seguridad ni profundidad de conciliación. [Privacidad](https://avisopago.com/privacidad.php), [términos](https://avisopago.com/terminos.php), consultados 2026-10-16.
- La oferta visible tiene dos escalones por cantidad de dispositivos; límites de usuarios, sucursales, historial y reportes avanzados no confirmados. [Inicio](https://avisopago.com/), consultado 2026-10-16.
- El sitio publica política/ términos y guía; no se hallaron links a tiendas de apps en el contenido revisado. [Sitemap](https://avisopago.com/sitemap.xml), consultado 2026-10-16.

## 8. Qué aprende PayAlert

Comparación basada en el estado descrito por PayAlert: web sobre Next.js/Supabase, conectores Mercado Pago/Ualá, webhooks con consulta autoritativa al proveedor, cola/idempotencia, matching de cobros esperados, reportes/CSV y Web Push; no tiene app móvil nativa, email ni otros proveedores fuera de los implementados. Los roles actuales documentados son owner, manager legacy/admin, cashier legacy/employee y support (este último pendiente de habilitación de identidad). Los planes en `docs/PLANES_SAAS.md` son propuesta sin precio/trial/facturación aprobados. [PayAlert: descripción global](../../analisis/00-descripcion-global.md), [actores y roles](../../analisis/01-actores-y-roles.md), [planes SaaS](../../PLANES_SAAS.md), consultados 2026-10-16.

- PayAlert ya contempla más diversidad de proveedor que AvisoPago (MP y Ualá en alcance documentado); conviene mantener la ventaja solo donde los conectores estén efectivamente habilitados y probados.
- El acceso acotado por rol y la visibilidad clara de cobros son un patrón de producto útil; comparar explícitamente qué datos puede ver un cajero y qué acciones son sensibles.
- AvisoPago empaqueta señales operativas concretas para mostrador (sonido/voz, QR por empleado, ticket, dispositivo y cierre de caja). PayAlert ya contempla notificaciones/reportes, pero app nativa no está en alcance; evaluar PWA/sonido como mejora sin presentarla como implementada.
- El competidor comunica precios y trial con claridad; PayAlert no debe copiarlos como decisión: sus planes siguen sin aprobar y requieren validación comercial/legal.
- Evitar prometer latencias tipo “1 segundo” sin métricas y SLA. PayAlert tiene arquitectura asíncrona y consulta autoritativa, por lo que conviene medir extremo a extremo y distinguir recepción del webhook, procesamiento y entrega push.
- La transparencia sobre dependencia del proveedor, revocación y límites financieros ayuda a reducir riesgo percibido; PayAlert debería sostenerla con evidencia técnica propia y política pública, no solo declaraciones.
