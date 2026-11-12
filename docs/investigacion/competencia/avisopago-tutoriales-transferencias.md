# AvisoPago: guías dueño/empleado y transferencias

**Consulta de fuentes públicas:** 2026-10-18. Las citas describen lo publicado por AvisoPago; no son verificación independiente de funcionamiento.

## Fuentes y alcance

Se extrajo la guía, inicio/FAQ, soporte, política y términos:
- [Guía para dueño y empleado](https://avisopago.com/tutorial.php)
- [Inicio, funciones y FAQ](https://avisopago.com/)
- [Soporte](https://avisopago.com/soporte.php)
- [Privacidad](https://avisopago.com/privacidad.php)
- [Términos](https://avisopago.com/terminos.php)

## Qué hace el dueño, según la guía

1. **Crea la cuenta comercio:** usa un email real; no hace falta que coincida con el email de Mercado Pago. [Guía](https://avisopago.com/tutorial.php): “Ese email sirve para iniciar sesión y recuperar la clave”.
2. **Conecta Mercado Pago:** desde el panel autoriza la cuenta del comercio. AvisoPago afirma que no pide la clave de MP. [Guía](https://avisopago.com/tutorial.php); la [privacidad](https://avisopago.com/privacidad.php) lo llama “flujo oficial disponible para integraciones”.
3. **Agrega empleados:** crea una cuenta empleado, comparte ID y clave, y puede revocar el acceso. [Guía](https://avisopago.com/tutorial.php).
4. **Activa funciones/permisos:** permite avisos, habilita QR por empleado si quiere y decide si el empleado imprime tickets o ve totales de caja. [Guía](https://avisopago.com/tutorial.php).
5. **Carga crédito mensual:** el servicio funciona mientras haya días disponibles; al no renovar se detiene sin perder datos. [Guía](https://avisopago.com/tutorial.php); ver también [términos](https://avisopago.com/terminos.php).
6. **Consulta reportes de caja:** filtra movimientos por fecha, cliente, empleado o dirección del dinero y puede imprimir lo visible. [Guía](https://avisopago.com/tutorial.php).

## Qué hace el empleado, según la guía

1. **Entra con ID y clave** que entrega el dueño; no precisa cuenta de Mercado Pago. [Guía](https://avisopago.com/tutorial.php).
2. **Instala/abre la app web:** Android con Chrome, iPhone con Safari y “Agregar a pantalla de inicio”; también navegador en PC/Mac. [Guía](https://avisopago.com/tutorial.php). El inicio la describe como instalable desde navegador/PWA, no exige tienda.
3. **Permite avisos** en el navegador. [Guía](https://avisopago.com/tutorial.php).
4. **Verifica pagos recibidos:** la pantalla muestra importe, cliente, ID de pago y hora; puede activar sonido o voz. [Guía](https://avisopago.com/tutorial.php).
5. **Genera QR solo si el dueño lo habilitó:** QR de Mercado Pago con importe y motivo; el dinero va “directo a la cuenta del dueño”. [Guía](https://avisopago.com/tutorial.php).
6. **Imprime o descarga ticket:** impresión en computadora; PDF en celular “si está disponible”. [Guía](https://avisopago.com/tutorial.php).

## Transferencias: respuesta explícita

- **¿AvisoPago las menciona? Sí. [Confirmado]** El inicio incluye “pagos recibidos, alias, QR y transferencias visibles” y la sección de ventas por empleado dice que “también puede marcar una transferencia como ‘Mi venta’”. [Inicio](https://avisopago.com/).
- **¿Cómo las detecta? [No encontrado]** Las páginas revisadas no especifican si la detección se basa en una transferencia recibida en Mercado Pago, en alias, en QR, en una categoría de movimiento o en otra señal. La [privacidad](https://avisopago.com/privacidad.php) habla genéricamente de “consultar movimientos” y datos de método de pago; los [términos](https://avisopago.com/terminos.php) hablan de avisos de “cobros recibidos”. No describen el mecanismo de identificación de transferencias.
- **¿Es solo por QR? No parece serlo, con límite importante. [Confirmado + inferido]** El sitio menciona transferencias y QR por separado; por eso no corresponde afirmar que todo aviso depende de un QR de AvisoPago. [Inferido] “Mi venta” parece una acción para atribuir una transferencia a la venta/empleado, pero el sitio no explica qué movimiento puede marcarse, cómo se vincula ni qué validación exige. El flujo explícito de QR, en cambio, sí es una función opcional que el dueño habilita y el empleado genera.
- **¿Qué significa “Mi venta”? [No encontrado / inferencia acotada]** La expresión aparece en el inicio asociada a “Ventas por empleado”: QR generado por empleado queda asociado a su acceso y también puede marcar una transferencia como “Mi venta”. No hay definición más detallada ni pasos para esa acción. No debe interpretarse como prueba de que el cliente pagó un QR propio, ni como conciliación automática: eso no se explica en estas fuentes.
- **¿El empleado puede transferir fondos? No. [Confirmado]** El inicio/FAQ dice que el empleado no ve saldo ni transfiere; esto es distinto de que AvisoPago pueda mostrar al empleado información de transferencias recibidas. [Inicio](https://avisopago.com/).
- **Qué fuentes oficiales describen:** la [política](https://avisopago.com/privacidad.php) menciona datos necesarios para consultar cobros y movimientos autorizados; los [términos](https://avisopago.com/terminos.php) dicen que puede mostrar información operativa autorizada y, si se habilita, crear solicitudes de cobro en MP. Ninguna de ambas páginas explica explícitamente transferencias comunes no-QR.
- **Recuperación:** soporte indica que si un pago por alias no aparece de inmediato, se use “Buscar pagos ahora”. Esto confirma una vía manual para buscar pagos demorados por alias, no el mecanismo técnico de detección ni que toda transferencia común sea notificable. [Soporte](https://avisopago.com/soporte.php).

## Conclusión por nivel de evidencia

| Afirmación | Estado | Evidencia |
|---|---|---|
| AvisoPago publica que muestra pagos recibidos, alias, QR y transferencias. | Confirmado (declaración del sitio) | [Inicio](https://avisopago.com/) |
| En su guía, el dueño crea cuenta, conecta MP, agrega empleados, habilita funciones/QR, carga crédito y revisa reportes. | Confirmado | [Guía](https://avisopago.com/tutorial.php) |
| En su guía, el empleado inicia con ID/clave, habilita avisos, verifica pagos y puede generar QR si el dueño lo habilitó. | Confirmado | [Guía](https://avisopago.com/tutorial.php) |
| “Mi venta” se asocia en el sitio a atribución por empleado de QR y a marcar una transferencia. | Confirmado | [Inicio](https://avisopago.com/) |
| “Mi venta” significa que el cliente pagó un QR generado por ese empleado. | No confirmado; no debe afirmarse | [Inicio](https://avisopago.com/), [guía](https://avisopago.com/tutorial.php) |
| Los avisos de transferencias comunes se detectan sin QR generado por el sistema. | No confirmado explícitamente; separado QR/transferencias hace plausible que el producto contemple transferencias fuera de ese flujo | [Inicio](https://avisopago.com/), [privacidad](https://avisopago.com/privacidad.php), [términos](https://avisopago.com/terminos.php) |
| Detección técnica, criterios, latencia específica o dependencias para transferencias comunes. | No encontrado | [Guía](https://avisopago.com/tutorial.php), [soporte](https://avisopago.com/soporte.php), [privacidad](https://avisopago.com/privacidad.php), [términos](https://avisopago.com/terminos.php) |
| La búsqueda manual por alias puede ayudar cuando un pago no aparece de inmediato. | Confirmado (instrucción de soporte) | [Soporte](https://avisopago.com/soporte.php) |
| El empleado no ve saldo ni puede transferir fondos. | Confirmado (declaración del sitio) | [Inicio](https://avisopago.com/) |

**Respuesta corta para PayAlert:** AvisoPago sí publicita que hace visibles “transferencias” y separa esa mención de los QR por empleado; no obstante, no explica cómo detecta transferencias comunes ni define “Mi venta”. Es razonable inferir que no todo depende del QR generado por el empleado, pero no hay evidencia pública suficiente para asegurar cobertura de cualquier transferencia común, método de detección o atribución automática.
