# PAY-11c — Competencia y GitHub: detección de transferencias recibidas

**Consulta:** 18/10/2026. Investigación documental de fuentes públicas. No se crearon cuentas ni se inspeccionaron APKs, permisos efectivos, código propietario o tráfico de red. Veredicto previo de MP: [`PAY-11b`](PAY-11b-mercadopago-transferencias.md): webhooks/IPN no documentan transferencias entrantes genéricas; “Todas las transacciones” (`settlement_report`) es una opción parcial, batch y por validar.

## Resumen ejecutivo

- **No hay evidencia pública suficiente para afirmar el mecanismo interno exacto de ¡Llegó!** Su web dice “vinculás tu cuenta en un clic”, no compartís contraseña y admite cobros por QR, link o transferencia; eso sugiere integración autorizada de cuenta, pero no identifica OAuth/API, webhook, polling ni notificaciones locales.
- **AvisoPago:** confirmado por su política que el dueño autoriza la conexión oficial y el servicio guarda tokens cifrados para consultar movimientos/cobros. El protocolo exacto (OAuth) y el canal de actualización no quedan especificados públicamente. No es una app Android de tienda según sus FAQ: navegador/PWA.
- **PagaVoz:** describe eventos/notificaciones de cobro de Mercado Pago, consulta directa desde PC (modalidad local) y suscripción online. No declara lectura de notificaciones Android, SMS ni mail; no se pudo verificar el mecanismo de la modalidad online. Es producto Windows según su web, no Android.
- Una app Android con `NotificationListenerService` puede captar el texto de las notificaciones de MP/Ualá si el usuario habilita “acceso a notificaciones”. Es una señal del teléfono, no un registro contable ni una confirmación API. No hay prueba de que estos tres competidores lo usen.
- **Recomendación PayAlert:** conservar webhooks para los cobros integrados que sí cubren; probar primero el reporte oficial `settlement_report` con una cuenta propia/autorizada y reconciliación batch. Para alerta inmediata de transferencias genéricas no prometer cobertura. Una app listener Android podría ser piloto opt-in como respaldo/no autoritativo, nunca sustituto de evidencia financiera.

## Competidores: mecanismos publicables

| Competidor | Estado | Evidencia y lectura |
|---|---|---|
| **¡Llegó!** | **Confirmado:** vinculación de Mercado Pago sin compartir contraseña; declara pagos por QR, link o transferencia y aviso al acreditarse. **Inferido:** autorización de cuenta a algún servicio backend. **No encontrado:** OAuth/scopes, endpoint/API, webhook/polling, permiso Android, lectura de notificaciones, SMS o email; no se halló app en Google Play con identidad verificable. | Home: https://llegopagos.com.ar/ — frases: “Vinculás tu cuenta en un clic… No compartís tu contraseña”; “Tus clientes te pagan por QR, link o transferencia”; “Apenas entra el pago, suena”. El análisis local previo ya marcaba el mecanismo exacto como no confirmado: [`competencia/llego.md`](competencia/llego.md). El resultado Google Play para `com.yallego` corresponde a una app de delivery mexicana, no a este producto: https://play.google.com/store/apps/details?id=com.yallego. No inferir identidad por nombre parecido. |
| **AvisoPago** | **Confirmado (declaración pública):** autorización oficial por el dueño; token cifrado para consultar movimientos y crear cobros habilitados; empleados entran a AvisoPago, no al MP. **No encontrado:** protocolo exacto OAuth, eventos/polling concretos y permiso Android. | Política https://avisopago.com/privacidad.php: “El dueño autoriza la conexión con Mercado Pago mediante el flujo oficial disponible”; “guarda tokens de acceso cifrados para consultar movimientos”. Home https://avisopago.com/: “usa la conexión autorizada por el dueño”. FAQ: se usa desde navegador y se puede agregar a pantalla principal; no requiere instalar desde tienda. Compatible anunciado Android/iPhone/PC, pero como web/PWA. La política no permite concluir si la actualización viene por API polling o webhook. |
| **PagaVoz** | **Confirmado (declaración pública):** Windows; modalidad local donde la PC consulta MP directamente con autorización local válida; modalidad online con cuenta PagaVoz/configuración sincronizada; solo cobros/notificaciones de MP. **No encontrado:** detalle técnico online (API/webhook/polling), permisos Android, lectura de SMS/mail/notificaciones del SO. | Home https://pagavoz.app/: “la computadora consulta Mercado Pago directamente”; FAQ: “PagaVoz solo lee notificaciones de cobro de MercadoPago” y “No almacena datos de transacciones…”. Esa palabra “notificaciones” no demuestra que lea el centro de notificaciones Android: la misma página anuncia app Windows y eventos de cobro. Privacidad https://pagavoz.app/privacy.html: integración con MP “para recibir eventos de cobro”. Términos https://pagavoz.app/terms.html: herramienta de avisos. No hay app de Play Store identificada. |

**Lectura comparativa:** ninguna fuente pública permite sostener que los competidores detecten de forma genérica cualquier transferencia entrante vía API oficial. Que sus páginas promocionen “transferencia” tampoco demuestra cobertura técnica del abono espontáneo; puede referirse a pago iniciado como parte de su flujo, a un evento de cobro integrado o a otra modalidad. En AvisoPago, la consulta de movimientos está confirmada como declaración del proveedor, pero el alcance exacto para transferencia común sigue sin demostrarse.

## GitHub: resultados y reutilización

Búsquedas de repositorios solicitadas:

- https://github.com/search?q=NotificationListenerService+mercadopago&type=repositories — **0 repositorios** en resultados extraídos el 18/10/2026.
- https://github.com/search?q=yape+notification+listener&type=repositories — **0 repositorios**.

No se encontró código open source específico para leer notificaciones de Mercado Pago/Yape con esas búsquedas. Sí hay componentes genéricos reutilizables, con el siguiente alcance (no son detectores de transferencias ni integraciones MP):

| Repo | Estrellas / licencia / actividad visible | Qué hace y pertinencia |
|---|---|---|
| [pppscn/SmsForwarder](https://github.com/pppscn/SmsForwarder) | 28.374 estrellas; BSD 2-Clause; repo indica versión compatible Android 4.4–13, última actividad/fecha de commit no capturada en esta consulta (**no confirmado**). | Reenvía SMS, llamadas y notificaciones de apps aplicando reglas hacia múltiples destinos. Sirve como referencia de listener/filtrado/forwarding, no como prueba de abono ni integración financiera. README advierte uso de aprendizaje y no comercial; revisar licencia y avisos antes de reutilizar. |
| [Ahusm/notiForward](https://github.com/Ahusm/notiForward) | Estrellas/licencia/fecha de última actividad **no capturados**; README declara MIT (extraído en segunda fuente; verificar archivo LICENSE antes de adoptar). | Flutter + `NotificationListenerService`: captura notificaciones, filtra por paquete/título/contenido con reglas, reenvía por SMTP, registra cola/logs; documenta fallos de batería/OEM y duplicados al reconectar. Candidato técnico genérico. https://github.com/Ahusm/notiForward |
| [ikeoffiah/sms_notification_listener](https://github.com/ikeoffiah/sms_notification_listener) | 0 estrellas; MIT; creado 2026-01-01, fecha de última actividad no mostrada. | Plugin Flutter que consume SMS mediante permisos `READ_SMS`/`RECEIVE_SMS`; no escucha notificaciones de apps MP. **No recomendado** como enfoque principal: SMS es permiso restringido en Google Play y exige que la app sea handler SMS/Assistant predeterminado, salvo excepciones de política. https://github.com/ikeoffiah/sms_notification_listener |

Los campos de actividad no visibles se dejan como no confirmados; no estimar “última actividad” a partir de la fecha de creación o del número de versiones. Los dos resultados exactos de búsqueda GitHub enunciados arriba no retornan proyectos aplicables.

## Android `NotificationListenerService`: mecánica y límites

### Cómo funciona

**Confirmado (Android Developers):** se implementa un servicio que extiende `NotificationListenerService`, declarado en manifest con permiso de binding del sistema `android.permission.BIND_NOTIFICATION_LISTENER_SERVICE` e intent filter `android.service.notification.NotificationListenerService`. El usuario concede el acceso desde Ajustes del sistema; el sistema llama al servicio al publicarse o retirarse una notificación. Esperar `onListenerConnected()` antes de operar. Fuente: https://developer.android.com/reference/android/service/notification/NotificationListenerService.

El listener puede filtrar por `packageName` de la app origen (p.ej. package instalado de MP/Ualá) y extraer campos visibles de `Notification.extras` (título, texto, texto expandido, líneas) y hora de publicación. **Inferencia/implementación genérica:** parsear patrones localizados como “Recibiste $X de …” o variantes; el texto real depende de la versión, idioma, privacidad en pantalla bloqueada y tipo de operación. No se encontró corpus público actual que confirme formato estable de las notificaciones argentinas de MP o Ualá: esos ejemplos son patrones a probar, no contrato.

Pipeline prudente: permitir lista explícita de paquetes; extraer texto de forma tolerante; parsear monto/moneda/nombre como datos no confiables; deduplicar por hash de paquete + timestamp + contenido normalizado; conservar evidencia mínima; mostrar como “aviso recibido”, no “pago verificado”; reconciliar con historial/reporte oficial.

### Android, batería y fiabilidad

- **Android 13+ (33):** `POST_NOTIFICATIONS` es permiso runtime para que la propia app publique notificaciones. No equivale al permiso especial de acceso a notificaciones de otras apps que usa `NotificationListenerService`. Fuente general de cambios: https://developer.android.com/about/versions/13/behavior-changes-13.
- **Android 13 y restricción de batería:** la documentación indica que si la app cae en estado “restricted”, ciertos broadcasts de arranque no se entregan hasta que se inicie por otro motivo; no asumir que el listener garantiza recuperación automática. Doze, restricciones OEM y cierre de proceso pueden causar demora/pérdida; ofrecer al usuario instrucciones de batería y monitoreo de conexión sin asegurar continuidad.
- El listener depende de que el teléfono reciba y muestre el aviso de origen. Desactivar notificaciones de MP, ocultar contenido, sesión cerrada, offline, modo ahorro, reinicio o cambio de texto rompe la señal. La notificación puede representar una alerta, ser agrupada/actualizada o reenviarse al reconectar; deduplicar y no usar como fuente de verdad.
- No leer SMS si no es necesario. La política Google Play restringe `READ_SMS`/`RECEIVE_SMS` a apps registradas como handler predeterminado de SMS o Assistant, con condiciones y uso esencial. Fuente: https://support.google.com/googleplay/android-developer/answer/16558241?hl=en. El acceso al listener de notificaciones es sensible y debe explicarse claramente, limitarse a finalidad central, obtener consentimiento y cumplir política User Data; no afirmar que está prohibido de forma general ni que está automáticamente aprobado.
- **Google Play no publica los permisos de los productos examinados porque no se identificó una listing oficial de estos competidores**. La ficha de MP no es evidencia sobre permisos de ¡Llegó!/AvisoPago/PagaVoz.

### Correo

No se encontró evidencia de lectura de correo por parte de los tres competidores. Parsear notificaciones de email o conectar una bandeja ampliaría riesgos, permisos y dependencia, y no es una vía confirmada en esta investigación.

## Veredicto para PayAlert

1. **Ahora:** mantener webhooks para operaciones de checkout/productos documentados. No anunciar que detectan toda transferencia común recibida.
2. **Mejor vía a validar:** piloto autorizado de `settlement_report` (“Todas las transacciones”) de MP, consulta diaria o frecuencia admitida, ingestión idempotente y conciliación/revisión. Ver PAY-11b: reporte refleja operaciones que afectan balance, contempla `bank_transfer`, pero la cobertura de cada transferencia espontánea, la latencia, campos del ordenante y elegibilidad OAuth no están garantizadas públicamente.
3. **Si la urgencia es inmediata:** piloto opt-in en Android con `NotificationListenerService` como canal auxiliar y etiqueta explícita “notificación detectada, pendiente de verificación”. Guardar texto mínimo con consentimiento, filtrar solo MP/Ualá, tolerar formato variable, deduplicar, detectar desconexión y nunca marcar pago como confirmado solo por monto/nombre/hora.
4. **No usar como mecanismo de producción principal:** lectura de SMS (política Play), email, ni extrapolar que “OAuth + API” de un competidor cubre todos los abonos. Pedir confirmación contractual a MP y medir contra transferencias propias antes de decidir.

**Conclusión:** la opción más defendible hoy es combinación de webhooks para pagos integrados + conciliación batch oficial como candidato a validar. Para inmediatez real de transferencias espontáneas, no se encontró una interfaz pública fiable confirmada; listener móvil es workaround débil, no confirmación financiera.

## Fuentes

- Análisis previos locales: [`competencia/llego.md`](competencia/llego.md), [`competencia/avisopago.md`](competencia/avisopago.md), [`competencia/pagavoz.md`](competencia/pagavoz.md), [`PAY-11b-mercadopago-transferencias.md`](PAY-11b-mercadopago-transferencias.md).
- ¡Llegó!: https://llegopagos.com.ar/ ; Play lookup descartado por homónimo: https://play.google.com/store/apps/details?id=com.yallego.
- AvisoPago: https://avisopago.com/ ; https://avisopago.com/privacidad.php ; https://avisopago.com/tutorial.php.
- PagaVoz: https://pagavoz.app/ ; https://pagavoz.app/privacy.html ; https://pagavoz.app/terms.html.
- Google Play MP ficha consultada, sin permisos de competidores: https://play.google.com/store/apps/details?id=com.mercadopago.wallet.
- Android listener: https://developer.android.com/reference/android/service/notification/NotificationListenerService ; Android 13: https://developer.android.com/about/versions/13/behavior-changes-13.
- Google Play permisos sensibles/SMS: https://support.google.com/googleplay/android-developer/answer/16558241?hl=en.
- GitHub queries y proyectos genéricos: links en tabla anterior.

**Alcance:** lectura documental; repositorio PayAlert no modificado salvo este informe. Sin pruebas de cuentas, permisos instalados, APKs, API ni transferencias reales. No commit.