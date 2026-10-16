# AvisoPago: análisis competitivo y oportunidades para PayAlert

**Corte de fuentes públicas:** 2026-10-16. Lo publicado por AvisoPago se atribuye al sitio; no equivale a verificación independiente del funcionamiento. El código de PayAlert se inspeccionó en `frontend/` y `mobile/` en la rama local `dev`; “hecho en dev” no implica despliegue/validación productiva. Si la fuente no lo explica, se indica **no confirmado**.

## 1. Recorrido verificable de AvisoPago

1. **Alta y conexión.** El dueño crea cuenta con email y contraseña propia (el email no tiene que ser el de Mercado Pago) y luego autoriza la conexión con MP desde la pantalla oficial. La política dice que no solicita ni guarda la clave de MP y que cifra tokens; el protocolo concreto no está explicitado por AvisoPago (**no confirmado** OAuth, aunque declara flujo oficial). [Alta](https://avisopago.com/register.php), [guía](https://avisopago.com/tutorial.php), [privacidad](https://avisopago.com/privacidad.php), 2026-10-16.
2. **Empleados y permisos.** Desde el panel, dueño crea acceso de empleado con ID/clave, decide si habilita QR, tickets o totales de caja, limita dispositivos y revoca accesos. Empleado no entra a la cuenta MP ni ve saldo/transfiere. No se publica una matriz detallada más allá de estas capacidades (**no confirmado** permisos finos por acción). [Inicio](https://avisopago.com/), [guía](https://avisopago.com/tutorial.php), [términos](https://avisopago.com/terminos.php), 2026-10-16.
3. **Aviso de pago.** El empleado usa web instalable/PWA; al llegar un movimiento se muestra importe, estado, cliente, referencia/ID y hora, con sonido/voz opcionales y permiso push del navegador. Hay acción “Buscar pagos ahora” para movimientos por alias que demoran. El claim “1 segundo” no informa medición/SLA: sus términos reconocen dependencia de webhooks, sincronización manual, MP, red y permisos del navegador. **[Inferido]** el servicio podría combinar webhook y búsqueda/consulta periódica o manual; los mecanismos exactos y la latencia real son **no confirmados**. [Inicio](https://avisopago.com/), [guía](https://avisopago.com/tutorial.php), [soporte](https://avisopago.com/soporte.php), [términos](https://avisopago.com/terminos.php), 2026-10-16.
4. **QR y atribución.** Si el dueño lo activa, el empleado genera QR de Mercado Pago con importe/motivo; los fondos ingresan a la cuenta MP vinculada. El QR generado se asocia a ese acceso y una transferencia puede marcarse “Mi venta”. Tarifas/comisiones de MP pueden aplicar; AvisoPago afirma no agregar comisión propia. [Inicio](https://avisopago.com/), [guía](https://avisopago.com/tutorial.php), 2026-10-16.
5. **Caja y revisión.** El panel dueño ofrece ingresos, egresos, neto, pendientes, ticket promedio y filtros por fecha, cliente, empleado, estado y dirección. Motivo/cliente se pueden completar si MP no los informó. No se describe un flujo formal de conciliación con ventas esperadas, reglas de tolerancia o resolución de excepciones (**no confirmado**). [Inicio](https://avisopago.com/), 2026-10-16.
6. **Comprobantes.** Desde computadora anuncia impresión de ticket/reporte; desde móvil descarga de comprobante/ticket (la guía lo califica “si está disponible”). [Inicio](https://avisopago.com/), [guía](https://avisopago.com/tutorial.php), 2026-10-16.
7. **Crédito/suscripción.** Prueba de 7 días sin tarjeta que inicia al vincular MP. Plan publicado: ARS 10.000 por 30 días, hasta 3 dispositivos; ARS 20.000 por 30 días, hasta 10. Pago por Mercado Pago Checkout Pro y crédito tras confirmación aprobada; al expirar se pausan notificaciones/búsqueda (el sitio también dice que se suspende el servicio), pero los datos/accesos siguen administrables. Precio/impuestos cambian potencialmente; se registra lo publicado al corte, no una oferta garantizada. [Inicio](https://avisopago.com/), [términos](https://avisopago.com/terminos.php), 2026-10-16.
8. **Dispositivos y canal.** No requiere descarga de tienda: navegador/PWA en Android, iPhone, Windows y Mac. Dueño limita/revoca dispositivos. No encontramos ficha identificable de AvisoPago en Play Store o App Store; app nativa **no confirmada**. [Inicio](https://avisopago.com/), [guía](https://avisopago.com/tutorial.php), búsqueda de tiendas, 2026-10-16.

## 2. Comparación función por función

Estados PayAlert basados en inspección de código/paths y límites del sistema. 🟡 indica parcial, de alcance acotado o no validado operacionalmente. En PayAlert no se debe leer presencia de tabla/plan como funcionalidad terminada.

| Capacidad | AvisoPago (declarado públicamente) | PayAlert (`dev`) | Evidencia/alcance PayAlert |
|---|---|---:|---|
| Cuenta y conexión MP con autorización | Sí, conexión autorizada | 🟡 | OAuth MP en `frontend/app/api/integrations/mercadopago/route.ts`; código disponible, operación real depende de credenciales/despliegue. |
| Ualá u otro proveedor | Solo MP Argentina anunciado | ✅ | Conector y webhook Ualá Bis v2; otros proveedores no implementados. `frontend/lib/payments/connectors/uala.ts`, `frontend/app/api/webhooks/uala/route.ts`. |
| Evento y verificación autoritativa | Aviso, implementación interna no confirmada | ✅ | Webhook validado cuando el proveedor soporta firma, cola/worker y consulta autoritativa; código en `frontend/lib/server/webhookHandler.ts`, `webhookWorker.ts`, conectores. Staging no confirmado. |
| Empleados/roles y aislamiento | Acceso empleado acotado, dispositivos revocables | 🟡 | Owner/manager/cashier; el rol support está pendiente y hay límites de gobierno de roles. `frontend/lib/server/rbac.ts`, `scope.ts`, `frontend/app/dashboard/employees/`. |
| Alerta web push | Sí, push de navegador | ✅ | Suscripción y envío web push en `frontend/app/api/push/`, `frontend/lib/server/push.ts`. Entrega/latencia de prod no garantizada. |
| Push nativo | Web/PWA | 🟡 | Hay app móvil Expo y registro/envío de push Expo (código Android); no equivale a publicar/listo en tiendas ni demuestra operación real. `mobile/`, `frontend/app/api/push/devices/`. |
| Sonido de aviso | Sí | 🟡 | Sonido en terminal web y preferencia `soundEnabled`; voz narrada no hallada en UI/código. `frontend/app/dashboard/terminal/page.tsx`, settings. |
| Voz que dice importe | Sí, condicionado al navegador | ⬜ | No se encontró `speechSynthesis` ni implementación equivalente en UI web o móvil. |
| Pantalla grande/terminal de caja | Sí | ✅ | Pantalla de terminal web con pagos esperados, estados y actualización local/Realtime visible en código (`frontend/app/dashboard/terminal/page.tsx`). Realtime global no confirmado. |
| Cobro esperado y matching | Caja/reporte descritos, matching formal no confirmado | ✅ | Crear, consultar, cancelar y resolver cobros esperados con candidatos/evidencia y auditoría. `frontend/app/api/expected-payments/`, `frontend/lib/payments/matching.ts`. |
| QR por empleado / “Mi venta” | Sí, QR MP habilitable y atribución | ⬜ | Búsqueda en UI/API de `frontend/` y `mobile/` no halló creación QR ni atribución individual “Mi venta”. |
| Motivo/cliente editable | Sí | 🟡 | Se edita cobro esperado; no se verificó edición equivalente de cliente/motivo sobre movimiento ya recibido. |
| Caja: ingreso/egreso/neto/ticket promedio | Reportado por AvisoPago | 🟡 | Reportes agregados y gastos/movimientos existen; ticket promedio/cierre equivalente de la competencia no se confirmó como métrica explícita de producto. |
| Tickets imprimibles/descargables | Sí | ⬜ | No se halló función de ticket/recibo en UI web ni móvil. |
| Reportes filtrables | Sí, imprimir | ✅ | Dashboard de reportes, filtros y agregaciones en `frontend/app/dashboard/reports/page.tsx`, rutas `/api/reports*`. |
| Exportar CSV | No confirmado en el sitio | ✅ | Endpoint/cliente de exportación en `frontend/app/api/reports/movements/route.ts`, hook `useReportMovements`. |
| Auditoría de acciones | Declara registros de auditoría en política | ✅ | Escritura y uso de auditoría para acciones sensibles; `frontend/lib/server/audit.ts`, migración 007 y rutas. No es evidencia de certificación externa. |
| Sucursales | Plan de 10 dispositivos orientado a sucursales; gestión separada no confirmada | 🟡 | PayAlert tiene `store_id`, alcance asignado y filtros; no afirmar administración multi-sucursal completa en toda UX. `scope.ts`, reportes y terminal. |
| API pública para terceros | No confirmada | ⬜ | APIs actuales son internas de la app/proveedor; LIM-02 excluye API pública versionada. |
| Suscripción, trial, billing | Sí, precio/trial publicado | ⬜ | `docs/PLANES_SAAS.md` es propuesta sin aprobación; sin billing/planes/trial comprometidos. No implementar por comparación. |
| Seguridad y privacidad públicas | Política declara controles y datos tratados | 🟡 | Controles de servidor/cifrado/auditoría en el código; política pública, retención y evidencia operacional requieren trabajo separado. |
| Multiempresa/membresías | No confirmado | ⬜ | `users.business_id` singular; multiempresa/membresías no aprobadas (LIM-04). |

**Base de alcance PayAlert:** `docs/analisis/00-descripcion-global.md`, `01-actores-y-roles.md`, `02-requerimientos.md`, `05-limites-del-sistema.md`, `docs/PLANES_SAAS.md`; grep directo en `frontend/` y `mobile/`, fecha 2026-10-16. No se consultaron/modificaron fuentes fuera del alcance autorizado.

## 3. Huecos de AvisoPago y señales de usuario

### Huecos verificables como “no publicados”, no como prueba de inexistencia

- **Multi-proveedor/Ualá:** solo declara Mercado Pago Argentina; no encontramos Ualá ni otros proveedores en páginas indexadas/revisadas. La conclusión segura es “no anunciado/no confirmado”, no “imposible”. [Inicio](https://avisopago.com/), 2026-10-16.
- **Conciliación con ventas esperadas:** no hay explicación pública de crear una venta previa, matching por importe/referencia, tolerancias, candidatos ni resolución auditada. Tiene caja/movimientos y búsqueda manual, que no bastan para afirmar conciliación. [Inicio](https://avisopago.com/), [soporte](https://avisopago.com/soporte.php), 2026-10-16.
- **Auditoría visible, exportación/API, push nativo:** la política menciona “registros de auditoría”, pero no se documenta un ledger/exportación CSV o API pública. Notificaciones descritas son de navegador/PWA; app nativa en tiendas no hallada. Detalle de auditoría y disponibilidad en tienda: **no confirmado**. [Privacidad](https://avisopago.com/privacidad.php), [inicio](https://avisopago.com/), consultas públicas, 2026-10-16.
- **Multi-sucursal:** el plan de 10 dispositivos se vende para más cajas/turnos/sucursales, pero no se muestran sucursales como entidades con permisos, reportes o aislamiento separados (**no confirmado**). [Inicio](https://avisopago.com/), 2026-10-16.
- **Reportes avanzados/conciliación contable, SLA:** se publican filtros y métricas operativas; no hay contrato de latencia/SLA ni reglas contables descritas. “En un segundo” es claim publicitario, contradicho como garantía por las salvedades de términos. [Inicio](https://avisopago.com/), [términos](https://avisopago.com/terminos.php), 2026-10-16.
- **Dependencia en MP:** claramente declarada; límites de cuotas de API, continuidad de permisos y granularidad de acceso a datos del proveedor no se explican en la oferta. [Términos](https://avisopago.com/terminos.php), [términos Developers MP](https://mercadopago.com.ar/developers/en/docs/resources/legal/terms-and-conditions), 2026-10-16.

### Dolor del cliente / señales públicas

La propia propuesta de valor aborda miedos concretos: no compartir cuenta real, evitar comprobantes dudosos, confirmar rápido en hora pico, cortar acceso al cambiar un empleado y rescatar pagos por alias con “Buscar pagos ahora”. Son **problemas que AvisoPago dice resolver**, no evidencia independiente de su frecuencia o gravedad. [Inicio](https://avisopago.com/), [soporte](https://avisopago.com/soporte.php), 2026-10-16.

En las búsquedas públicas no localizamos reseñas identificables de usuarios en tiendas, foros, prensa, YouTube o redes sociales que podamos atribuir con confianza a este AvisoPago; aparecieron homónimos/no relacionados. Por eso no afirmamos ratings ni transcribimos quejas: **señales de dolor por reseñas externas, no confirmadas**. Búsquedas públicas “AvisoPago opiniones/reseñas”, tiendas, YouTube, Instagram, 2026-10-16. No hay base para inferir satisfacción, churn o fallos reales.

## 4. Diferenciales de AvisoPago que valdría evaluar

| Idea funcional (sin copiar marca/texto) | Valor potencial | Esfuerzo | Encaje con PayAlert |
|---|---|---:|---|
| QR de cobro por cajero + atribución “Mi venta” | Alto: asigna autoría y reduce trabajo manual en caja | L | Requiere confirmar API/flujo oficial MP para crear cobro/QR, autorización por rol, vínculo estable entre QR y cajero, estados y auditoría. No es la UI de QR actual. |
| Ticket/recibo imprimible por pago y descarga móvil | Alto en mostrador y para disputa/cierre | M | Puede usar detalle normalizado del movimiento/cobro esperado; diseñar privacidad/minimización y plantilla propia. |
| Voz opcional que anuncia importe | Medio-alto en caja concurrida/accesibilidad | S | Web Speech API/PWA, fallback y preferencia por dispositivo; nunca tratar voz como confirmación autoritativa. |
| Modo caja “pantalla grande” + cola de últimos cobros | Alto para un monitor compartido | M | PayAlert ya tiene terminal; mejorar legibilidad, estado, reconocimiento de coincidencia y UX de pantalla fija sin exposición excesiva. |
| Atribución de venta al empleado/turno | Alto para gestión operativa | M | Extender `expected_payments`/auditoría con actor y turno; separar autor de cobro del usuario que revisa. |
| Búsqueda manual de sincronización con indicador de frescura | Alto para confianza cuando webhook se retrasa | M | PayAlert ya consulta proveedor por evento autoritativo; agregar acción segura y limitada de reconciliación/refresh, sin polling ciego. |
| Prueba/onboarding y entitlements | Alto en activación comercial | L | Solo tras decisión explícita: planes/billing están fuera de alcance y no aprobados; no replicar cifras del competidor. |

QR, tickets, voz y “Mi venta” son funciones publicadas por AvisoPago; su calidad/uso real no está validada por fuentes independientes. [Inicio](https://avisopago.com/), [guía](https://avisopago.com/tutorial.php), 2026-10-16.

## 5. Cinco mejoras prioritarias para PayAlert

Ordenadas por diferenciación, riesgo controlable y reutilización de capacidades existentes; no son decisiones aprobadas de producto.

1. **“Cobro esperado → pago recibido” como flujo central visible (valor alto / esfuerzo M).** PayAlert ya tiene matching; cerrar la brecha de producto con pantalla de caja accionable. **Aceptación:** cajero autorizado crea importe/referencia; al llegar evento autoritativo, se enlaza automáticamente solo si la regla produce coincidencia única; ambigüedad pasa a revisión; resolución manual exige permiso y queda auditada; ningún evento duplicado duplica el cobro ni aviso; pruebas de importe igual/ambiguo/repetido y fuera de ventana.
2. **Modo caja compartido con aviso accesible y voz opcional (alto / M).** Aprovechar terminal/sonido, sin confundir confirmación con push. **Aceptación:** vista de monitor presenta importe/estado/fecha y señal de pago confirmado; configuración por dispositivo para sonido/voz; voz anuncia solo datos mínimos, no se repite al refrescar ni en eventos pendientes; el usuario puede silenciar y operar sin audio; prueba de navegadores sin Speech API y pestaña en segundo plano.
3. **Ticket propio imprimible/descargable (medio-alto / M).** Ayuda en mostrador y en búsqueda posterior. **Aceptación:** ticket muestra identificador interno, importe, moneda, estado autoritativo, proveedor y hora; no expone token ni datos personales no necesarios; imprimir y descargar en móvil; reimpresión rastreable/no crea movimientos; prueba de pago rechazado/pendiente y caracteres especiales.
4. **Atribución de caja/empleado/turno (alto / M-L).** Llevar la ventaja de “Mi venta” a pagos recibidos y ventas esperadas con separación auditable. **Aceptación:** cada cobro esperado guarda actor y sucursal desde sesión/alcance servidor (no input confiado); reportes agregan por empleado/turno; cambios registran actor/antes-después; acceso cajero limitado a su ámbito; reasignación/turno cerrado no altera historia.
5. **Recuperación explícita de pagos atrasados + confianza de frescura (alto / M).** Convertir la robustez asíncrona existente en UX honesta. **Aceptación:** usuario autorizado solicita sincronizar conexión dentro de rate limit; interfaz muestra última consulta y fuente; recuperación consulta proveedor y pasa por ingestión idempotente; no declara acreditado hasta respuesta autoritativa; muestra error/reintento, sin reintentos ilimitados; tests de timeout, rate limit, duplicado y pago tardío.

## 6. Qué no copiar

- No copiar nombre, logo, paleta distintiva, textos, ilustraciones, layout exacto, capturas ni código de AvisoPago. Tomar solo patrones funcionales y diseñar experiencia/texto propios.
- No prometer “1 segundo” o “instantáneo” sin métricas representativas y SLO operativo; medir recepción webhook, procesamiento y entrega por canal por separado.
- No copiar sus precios, prueba de siete días, crédito mensual, límites por dispositivo ni Checkout Pro como decisión automática: PayAlert tiene billing/pricing fuera de alcance, no aprobado (`docs/PLANES_SAAS.md`, LIM-07).
- No generar QR/cobros por empleado antes de revisar permisos OAuth, alcance de creación de cobros, privacidad, fraude, reembolsos y términos vigentes de Mercado Pago.
- No sustituir webhook/consulta autoritativa por polling agresivo o por el contenido del evento recibido; respetar idempotencia, límites de API y fuente de verdad.
- No ampliar datos visibles a cajeros por conveniencia; definir mínimo necesario, RLS/alcance por sucursal, revocación y auditoría.

## 7. Riesgos y mitigaciones

- **Dependencia de Mercado Pago:** interrupción, cambio de API/permisos o revocación puede afectar el flujo. Mantener conectores desacoplados, salud de conexión, degradación honesta y ruta de soporte. AvisoPago declara MP como fuente oficial y reconoce tiempos externos. [Términos AvisoPago](https://avisopago.com/terminos.php), 2026-10-16.
- **Términos API para terceros:** la documentación de MP Developers define licencia limitada/revocable, condiciones de uso, límites discrecionales de llamadas, seguridad y rol de tratamiento de datos; revisar versión vigente, alcance aprobado de aplicación y permisos antes de ampliar uso (sobre todo creación de cobros/QR). [Términos Developers](https://mercadopago.com.ar/developers/en/docs/resources/legal/terms-and-conditions), [OAuth](https://mercadopago.com.ar/developers/en/docs/security/oauth/introduction), [restricciones Smart Apps](https://mercadopago.com.ar/developers/en/docs/smartapps/restrictions), 2026-10-16.
- **Privacidad/datos financieros operativos:** importe, pagador, identificadores, empleado, IP y push son datos sensibles en contexto comercial. Minimizar contenido push/voz/ticket, retención por propósito, control de acceso, cifrado, eliminación, registro seguro y revisión legal local. AvisoPago describe datos y medidas; esos enunciados no acreditan auditoría independiente. [Privacidad AvisoPago](https://avisopago.com/privacidad.php), [Términos Developers MP](https://mercadopago.com.ar/developers/en/docs/resources/legal/terms-and-conditions), 2026-10-16.
- **Falsa confirmación:** capturas/QR/push no son fuente financiera; mostrar claramente estado del proveedor y distinguir recibido, pendiente y conciliado. Los términos de AvisoPago también reservan MP como referencia oficial. [Términos](https://avisopago.com/terminos.php), 2026-10-16.
- **Dependencia de navegador/PWA:** permisos, suspensión de pestaña, audio y push varían por plataforma. Dar estado visible, acción de recuperación, fallback y no vender push como garantía. [Inicio](https://avisopago.com/), [soporte](https://avisopago.com/soporte.php), 2026-10-16.
- **Marca y contenido:** no usar “AvisoPago” como nombre/endorsement ni reutilizar textos o assets. Comunicar integración con proveedor de forma veraz, sin sugerir afiliación. AvisoPago se declara independiente en sus términos. [Términos](https://avisopago.com/terminos.php), 2026-10-16.
- **Precios/operación SaaS:** adoptar trial o cobro requiere decisión comercial, costos, impuestos, cancelación, tratamiento de datos y soporte; no se resuelve copiando al competidor. `docs/PLANES_SAAS.md`, 2026-10-16.

## 8. Preguntas para el dueño de PayAlert

1. ¿Qué segmento priorizamos primero: comercio de mostrador con un cajero, negocio de varias sucursales o integrador con más de un proveedor?
2. ¿La prioridad es conciliación de cobros esperados o velocidad/legibilidad de alerta en caja? ¿Qué métrica de éxito medimos en piloto?
3. ¿Atribución por empleado/turno es requisito de auditoría operativa o solo análisis agregado? ¿Qué puede consultar un cajero y por cuánto tiempo?
4. ¿Queremos tickets digitales/fiscales-operativos? ¿Qué datos incluir, cuáles excluir y qué obligación de retención aplica?
5. ¿Se aprueba investigar creación de QR/cobros MP por OAuth? ¿Quién revisa términos, permisos de aplicación, comisiones y manejo de contracargos antes de un prototipo?
6. ¿Debe el modo caja funcionar en móvil/web únicamente o se desea publicar app nativa? ¿Plataformas/dispositivos objetivo y quién operaría credenciales de tienda?
7. ¿Qué canales quedan oficiales para avisos (web push, Expo, audio) y cuáles serán best effort? ¿Qué frescura/latencia podemos medir sin prometer SLA todavía?
8. ¿Multi-sucursal y memberships son prioridad aprobada, o alcanza el `assigned_store_id` actual mientras se valida el segmento?
9. ¿Hay decisión comercial para pricing, prueba y billing? Si no, confirmar que queda fuera de esta hoja de ruta hasta aprobar PAY-28.
10. ¿Quién será responsable de confirmar con MP y asesoría legal la vigencia de términos, scopes, retención y textos públicos antes de lanzar estas capacidades?

## Apéndice A — URLs públicas consultadas

Todas consultadas el **2026-10-16**. Páginas revisadas (contenido extraído salvo errores explícitos):

1. https://avisopago.com/ — home, funciones, precios y FAQ (consultada completa).
2. https://avisopago.com/terminos.php — términos.
3. https://avisopago.com/privacidad.php — privacidad.
4. https://avisopago.com/tutorial.php — guía dueño/empleado.
5. https://avisopago.com/soporte.php — ayuda.
6. https://avisopago.com/register.php — alta pública, sin crear cuenta.
7. https://avisopago.com/owner_login.php — login dueño, sin iniciar sesión.
8. https://avisopago.com/login.php — extracción falló (422); no se enviaron credenciales.
9. https://avisopago.com/precios.php — 404; precios están en home.
10. https://avisopago.com/planes.php — 404.
11. https://avisopago.com/ayuda.php — 404; soporte y guía están en URLs separadas.
12. https://avisopago.com/empleado_login.php — 404; login empleado público no encontrado en esa ruta.
13. https://avisopago.com/ferreteria.php — 404; rubro aparece como ejemplo en home.
14. https://avisopago.com/panaderia.php — 404; rubro aparece como ejemplo en home.
15. https://avisopago.com/kiosco.php — 404; rubro aparece como ejemplo en home.
16. https://avisopago.com/sitemap.xml — consultada; extracción no devolvió contenido utilizable.
17. https://mercadopago.com.ar/developers/en/docs/resources/legal/terms-and-conditions — términos públicos API MP.
18. https://mercadopago.com.ar/developers/en/docs/security/oauth/introduction — documentación OAuth MP.
19. https://mercadopago.com.ar/developers/en/docs/smartapps/restrictions — restricciones publicadas para Smart Apps/terminales.
20. https://mercadopago.com.ar/developers/en/docs/subscriptions/resources/credentials-best-practices/secure-credentials — prácticas de credenciales.

Búsquedas públicas adicionales (2026-10-16): `AvisoPago opiniones/reseñas`, `"avisopago.com"`, “AvisoPago Google Play App Store”, AvisoPago YouTube/Instagram/Facebook, AvisoPago foros y notas. No se identificaron fichas de tienda, demo/red oficial ni reseñas atribuibles inequívocamente; resultados homónimos no relacionados descartados. Rutas `/blog/` y páginas específicas por rubro/login de empleado no confirmadas por búsqueda/extracción; sitemap sin lista parseable. No se accedió a panel autenticado, no se creó cuenta y no se realizaron pagos.
