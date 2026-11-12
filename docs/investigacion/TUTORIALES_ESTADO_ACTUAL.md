# PayAlert: tutoriales basados en la app actual

**Revisión:** código del frontend y manual `docs/Manual_de_Usuario.md`. Alcance: flujo que la interfaz y las rutas actuales permiten; no se ejecutó una prueba con credenciales reales ni se certificó configuración del despliegue. No asumir funciones sólo porque las mencione el manual.

## Hallazgos críticos

- **Sí existe alta de empleados, pero no invitación por email:** el dueño crea la cuenta indicando nombre, apellido, correo y una contraseña, y opcionalmente asigna sucursal. `frontend/app/dashboard/employees/page.tsx:73-124, 246-274`. No se envía invitación automática ni correo con link; el dueño debe comunicar las credenciales por un medio seguro. La pantalla dice “Crear Empleado”, no “Invitar”.
- **El empleado sí tiene camino de ingreso:** usa `/login` con ese correo y contraseña creados. Login por contraseña redirige a `/dashboard` (`frontend/app/login/page.tsx:28-52`). Google también está disponible en login, pero no es el flujo de alta de empleado; el callback de Google provisiona un owner, no invita ni crea employee (`frontend/app/auth/callback/route.ts`, `frontend/lib/server/bootstrapOwner.ts:27-41`).
- **Bloqueo funcional importante:** al empleado se lo puede dar de alta sin sucursal (“-- Sin asignar --”, `employees/page.tsx:255-264`); el dashboard de caja/terminal depende de `assigned_store_id` (`terminal/page.tsx:83-85, 114-125, 194-221`). Sin sucursal muestra “Sin tienda asignada” y no carga feed de esa tienda.
- **Push configurable, no prometer entrega sin condiciones:** en Configuración hay activar/desactivar push y preferencias de avisos visuales/sonido (`settings/page.tsx:53-60, 93-123`; `PushNotificationSettings.tsx:17-35, 55-117`). Se necesita navegador compatible, permiso del usuario, service worker/VAPID y suscripción válida (`hooks/usePushNotifications.ts:27-59, 73-80, 105-137`). El sonido/toast de pago observado en terminal ocurre con la app abierta y evento confirmado (`terminal/page.tsx:194-219`); no es lo mismo que push. El envío push está disponible en API con permiso de owner/admin, no hay prueba en esta revisión de que un pago dispare automáticamente el envío (`app/api/push/send/route.ts:7-36`).

## Pasos reales: tutorial del dueño (8)

1. **Entrá** a PayAlert en el navegador. Si tu cuenta todavía no existe, usá “Continuar con Google” y completá el flujo si está habilitado para tu correo; el primer ingreso provisiona negocio y owner. Si ya tenés usuario, ingresá con correo y contraseña. El acceso público puede estar limitado por la lista de altas habilitadas.
2. En **Mis Sucursales**, elegí **Nueva Sucursal** y completá nombre; dirección y teléfono son opcionales. Guardá con **Crear Sucursal**.
3. En **Integraciones**, conectá la cuenta que corresponda: Mercado Pago (OAuth si está habilitado o credenciales manuales) o Ualá Bis con sus datos. El proveedor de prueba/mock no representa una integración real. Confirmá el estado mostrado en la lista.
4. En **Empleados**, elegí **Agregar Empleado**. Completá nombre, apellido, correo y una contraseña (mínimo validado por el formulario); elegí **Sucursal Asignada** y presioná **Crear Empleado**.
5. Compartí con esa persona el correo y la contraseña temporal por un canal seguro. No hay envío de invitación desde la app. Indicále que entre por **Ingresar** en `/login`; no usar “Continuar con Google” como invitación.
6. Para avisos en tu dispositivo, andá a **Configuración → Notificaciones** y tocá **Activar** en Push; aceptá el permiso del navegador. Si no está soportado o falta configuración del servidor, la pantalla lo informa. Las alertas visuales/toast y sonido se pueden activar o desactivar allí.
7. Usá **Terminal** para registrar un cobro: monto en ARS, referencia opcional y **Crear cobro**. Compartí/abrí el enlace generado; seguí el estado. Si aparece revisión manual con candidatos, la interfaz permite confirmar o descartar. La terminal también lista cobros de hoy.
8. Consultá **Reportes** para filtrar fechas, sucursal, tipo y agrupación, actualizar y exportar CSV o Excel; cargá egresos desde **Gastos** cuando corresponda.

## Pasos reales: tutorial del empleado (5)

1. Pedile al dueño que te cree en **Empleados** y te pase por un canal seguro el correo y la contraseña. La app no manda invitación automática.
2. Abrí PayAlert y entrá con ese correo y contraseña en **Ingresar**. Si las credenciales fallan, pedile al dueño que revise/edite tu usuario; el manual no describe recuperación de contraseña y no se ofrece en la pantalla revisada.
3. Verificá que el dueño te haya asignado una sucursal. En el menú lateral vas a ver **Terminal** y **Cerrar Sesión**; el inicio de `/dashboard` también muestra la terminal de empleado. Sin sucursal, no tendrás feed de esa tienda.
4. En **Terminal**, cargá monto, agregá una referencia si sirve y tocá **Crear cobro**. Abrí o copiá el enlace para el cliente; mirá el estado y los cobros de hoy. El rol empleado no tiene selector de proveedor, ni puede resolver candidatos de coincidencia; eso requiere permiso de owner.
5. Si querés push, en **Configuración** (no aparece en el menú del empleado) no está disponible para empleado. Por lo tanto, para avisos en pantalla mientras usás Terminal, dejala abierta: los pagos confirmados muestran toast/sonido. **[FALTA]** acceso de empleado a la suscripción/configuración push y un camino soportado de avisos push para ese rol.

## Qué ve y puede hacer cada rol (según el código)

| Área | Dueño | Empleado |
|---|---|---|
| Inicio | Dashboard de dueño con métricas, accesos a sucursales/integraciones/gastos y empleados. | Se renderiza `EmployeeTerminal` en `/dashboard` (`dashboard/page.tsx:56-65`); el sidebar sólo expone Terminal. |
| Menú | Mi Dashboard, Mis Sucursales, Reportes, Integraciones, Gastos, Empleados, Configuración y cerrar sesión (`DashboardSidebar.tsx:14-22`). | Terminal y cerrar sesión (`DashboardSidebar.tsx:24-29, 63-75`). Historial aparece comentado/no implementado. |
| Empleados | Crear con contraseña, listar, editar nombre/apellido/sucursal y eliminar (`employees/page.tsx:73-135, 178-224`). | No administra empleados. |
| Sucursales | Crear, editar, borrar y ver detalles; nombre requerido, dirección/teléfono opcionales (`stores/page.tsx:67-125, 139-149`). | No menú de sucursales; sucursal asignada por el dueño. |
| Gastos | Alta, lista y eliminación; categoría/importe/descripción/sucursal. Sin carga de comprobante en formulario (`expenses/page.tsx:33-36, 73-114, 212-255`). | Sin acceso de menú ni formulario de gastos. Contradice el manual. |
| Reportes | Reporte financiero, filtros, gráficos y exportación CSV/Excel (`reports/page.tsx:109-180, 203-227`). | Sin acceso; RBAC deniega `report:read` (`lib/server/rbac.ts:14-17`). |
| Integraciones | Gestionar conexiones de proveedores; configuración depende del proveedor y OAuth habilitado. | Sin acceso; RBAC deniega gestionar conexiones (`rbac.ts:14-17`). |
| Terminal | Puede crear cobros; si corresponde, seleccionar proveedor y resolver/descartar candidatos; simular pago sólo fuera de producción (`terminal/page.tsx:340-346, 354-361, 375`). | Crear cobro y consultar cobros; sin selección de proveedor y sin resolución manual. Con sucursal asignada puede ver eventos en tiempo real, sonido y toast (`terminal/page.tsx:194-219`). |
| Notificaciones | Push activar/desactivar desde Configuración, además de preferencia visual/sonido. Push requiere soporte/permiso/VAPID. | Configuración no está en su menú; no puede activar push desde el dashboard de empleado. En Terminal hay toast y sonido con la app abierta, si se recibe evento confirmado. |
| Perfil/tema | El manual promete perfil, idioma, tema, cambio de contraseña y actividad, pero no se observan esas opciones en Configuración actual: ésta ofrece editar nombre del negocio y notificaciones. | Ídem; Configuración no aparece. |

## Diferencias con el manual

| Manual | Realidad observable | Evaluación |
|---|---|---|
| “Contactá al administrador para que te invite” y “Invitar Usuario” por correo (líneas 41, 82-89). | Alta manual por owner con contraseña (no email/link de invitación), formulario Empleados. | Incorrecto; cambiar “invitar” por “crear usuario y compartir acceso”. |
| Empleado ve ingresos en tiempo real, botón de gastos e historial (141-148). | Menú employee sólo Terminal; dashboard dirige a terminal. Gastos, reportes e historial no aparecen para ese rol; RBAC empleado no puede reportar ni administrar. | Incorrecto. El empleado registra cobros esperados, no gastos. |
| Registrar gasto con comprobante/foto (150-159). | Formulario real sin archivo/comprobante; sí importe, descripción, categoría y sucursal. Sólo dueño tiene el menú Gastos. | Incorrecto y falta función de comprobante. |
| Sonido de caja y notificación push para empleado (161-166). | Sonido/toast al confirmarse pago en Terminal abierto; push configurable en Configuración, menú owner. | Parcial/incorrecto para employee y no afirmar push automático al pago. |
| Tipos de alertas automáticas: reportes, recordatorios de gastos/inventario (170-175). | No hay evidencia de esas funciones en pantallas/API revisadas. | Quitar o marcar [FALTA]. |
| Configuración de horarios silencio, vibraciones, preferencias de email (177-190). | Push y preferencias visual/sonido; email aparece deshabilitado “Próximamente”. | Parcial; horarios/sonidos personalizados/badge/acciones rápidas no están acreditados. |
| Perfil, idioma, apariencia, seguridad, actividad (192-212). | Configuración actual: perfil del negocio (editar nombre) y notificaciones. | Incorrecto; quitar esas instrucciones. |
| “Negocios” como sección para crear/editar/eliminar negocios (56-78). | No hay esa pantalla en el sidebar del dueño. `bootstrapOwner.ts` crea automáticamente el primer negocio al provisionar owner. | Incorrecto. Dueño edita nombre en Configuración; sucursales en Mis Sucursales. |
| Tienda con encargado y pasos/configuración de webhooks manuales (96-119). | El alta de sucursal pide nombre y permite dirección/teléfono; el flujo actual de Integraciones gestiona conexiones/token y muestra ayuda/webhook. | Parcial/desactualizado: no campo encargado en formulario; no dictar URLs genéricas sin seguir pantalla actual. |
| Reporte “Flujo de Caja”, exportar PDF/Excel (121-135). | Reportes Financieros con resumen, gráficos, filtros y exportar CSV/Excel. | Nombre y formatos incorrectos; no se observa PDF. |
| PWA se instala como app nativa en Android/iOS/PC (17-31). | No verificado por esta inspección de interfaz/código; no incluirlo como paso imprescindible sin probar instalación por navegador/plataforma. | Necesita validación aparte. |
| Soporte email/chat/docs/GitHub (236-243). | No verificado como canal vigente desde el código revisado. | Quitar o validar canales/URLs antes de publicar. |

## Propuesta de checklist “Primeros pasos” (dueño)

No existe hoy un checklist de onboarding integrado en el dashboard: esto es una propuesta. Mostrar sólo estado/atajos; no marcar listo por el mero clic.

| Ítem sugerido | Cómo detectar que está hecho | Destino/nota |
|---|---|---|
| Crear primera sucursal | Existe al menos una fila `stores` para `profile.business_id`. | Mis Sucursales. |
| Conectar un medio de cobro | Existe al menos una conexión del negocio con estado de conexión usable/activa, según el estado que la pantalla ya presenta; no contar `mock` como real. | Integraciones. |
| Crear primer empleado | Existe al menos un `users` del negocio con `role='employee'`. | Empleados; recordar asignar sucursal y compartir contraseña por canal seguro. |
| Activar push en este dispositivo | Suscripción actual `PushManager.getSubscription()` no nula y servidor aceptó `/api/push/subscribe`; sólo para el dispositivo/navegador actual. | Configuración. No decir que ya está hecho para empleados. |
| Registrar primer cobro | Existe al menos un cobro esperado creado para el negocio. | Terminal. No equivale a pago confirmado. |
| Ver primer reporte | Reporte carga correctamente para el negocio. | Reportes; no bloquear onboarding si aún no hay datos. |

**No agregar como checklist actual:** crear negocio a mano (se provisiona al primer alta owner), invitar por correo, asignar permisos granulares a empleados, comprobantes de gastos, reportes programados, push de empleado o exportación PDF: son funciones ausentes/no acreditadas.

## Referencias de código principales

- Manual: `docs/Manual_de_Usuario.md`.
- Login/provisionamiento: `frontend/app/login/page.tsx:28-52`; `frontend/app/auth/callback/route.ts`; `frontend/lib/server/bootstrapOwner.ts:15-59`.
- Alta empleados: `frontend/app/dashboard/employees/page.tsx:73-135, 231-275`.
- Menús/ruteo: `frontend/components/DashboardSidebar.tsx:14-29`; `frontend/app/dashboard/layout.tsx:17-44`; `frontend/app/dashboard/page.tsx:56-65`.
- Terminal/avisos: `frontend/app/dashboard/terminal/page.tsx:88-125, 194-221, 330-382`.
- Push y permisos: `frontend/components/PushNotificationSettings.tsx`; `frontend/hooks/usePushNotifications.ts`; `frontend/app/api/push/send/route.ts`; `frontend/lib/server/rbac.ts:8-22`.
