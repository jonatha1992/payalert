# Manual de Usuario - PayAlert SaaS

Bienvenido a PayAlert, la plataforma definitiva para gestionar el flujo de caja de tu negocio con notificaciones en tiempo real. Este manual te guiará paso a paso para aprovechar al máximo todas las funcionalidades del sistema.

## 🎯 ¿Qué es PayAlert?

PayAlert es una aplicación web progresiva (PWA) que te permite:

- **📱 Recibir notificaciones instantáneas** cuando llegan pagos a través de Mercado Pago o Ualá
- **👥 Gestionar múltiples roles** con permisos diferenciados (dueños y empleados)
- **🏪 Administrar varias tiendas/sucursales** desde un solo panel
- **📊 Visualizar reportes de flujo de caja** en tiempo real
- **🔒 Mantener la seguridad** con aislamiento completo entre negocios

## 🚀 Primeros Pasos

### 1. Instalación de la Aplicación

PayAlert funciona como una **Progressive Web App (PWA)**, lo que significa que puedes instalarla en tu dispositivo móvil o computadora como una aplicación nativa.

#### En Android/iOS

1. Abre PayAlert en tu navegador móvil
2. Toca el menú (⋮) → "Agregar a pantalla de inicio"
3. La app se instalará automáticamente

#### En Computadora

1. Abre PayAlert en Chrome/Firefox
2. Haz clic en el ícono de instalación en la barra de direcciones
3. La app se instalará en tu escritorio

### 2. Inicio de Sesión

1. **Accede a la aplicación** desde tu navegador o app instalada
2. **Ingresa tus credenciales**:
   - Correo electrónico
   - Contraseña
3. **Haz clic en "Ingresar"**

> **💡 Tip:** Si no tienes una cuenta, contacta al administrador de tu negocio para que te invite al sistema.

## 👑 Panel de Dueño (Owner)

Si eres el **dueño del negocio**, tienes acceso completo a todas las funcionalidades del sistema.

### 📊 Dashboard Principal

Al iniciar sesión, verás el **Panel Principal** con:

- **Total de negocios** registrados
- **Resumen de ingresos** del día/mes
- **Estado de tiendas** activas
- **Alertas importantes** del sistema

### 🏢 Gestión de Negocios

#### Crear un Nuevo Negocio

1. Ve a **"Negocios"** en el menú lateral
2. Haz clic en **"Agregar Negocio"**
3. Completa la información:
   - **Nombre del negocio**
   - **Configuraciones iniciales** (opcional)
4. Haz clic en **"Crear Negocio"**

#### Editar un Negocio Existente

1. En la lista de negocios, haz clic en el **ícono de lápiz** (✏️)
2. Modifica la información necesaria
3. Haz clic en **"Guardar Cambios"**

#### Eliminar un Negocio

1. Haz clic en el **ícono de papelera** (🗑️)
2. Confirma la eliminación

> **⚠️ Advertencia:** Eliminar un negocio borrará todos los datos asociados (tiendas, pagos, usuarios). Esta acción no se puede deshacer.

### 👥 Gestión de Usuarios

#### Invitar Empleados

1. Ve a **"Configuración"** → **"Usuarios"**
2. Haz clic en **"Invitar Usuario"**
3. Ingresa el **correo electrónico** del empleado
4. Selecciona el **rol** (Employee)
5. Asigna las **tiendas** donde trabajará
6. Haz clic en **"Enviar Invitación"**

#### Gestionar Roles y Permisos

- **Owner**: Acceso completo a todo
- **Employee**: Acceso limitado a tiendas asignadas

### 🏪 Gestión de Tiendas

#### Crear una Nueva Tienda

1. Ve a **"Negocios"** → Selecciona un negocio
2. Haz clic en **"Agregar Tienda"**
3. Completa la información:
   - **Nombre de la tienda**
   - **Dirección**
   - **Teléfono**
   - **Encargado** (opcional)
4. Haz clic en **"Crear Tienda"**

#### Configurar Integraciones de Pago

Para recibir notificaciones de pagos, necesitas configurar los tokens de los gateways:

1. Ve a **"Configuración"** → **"Integraciones"**
2. **Mercado Pago**:
   - Obtén tu Access Token en el panel de desarrolladores
   - Configura la URL de webhook: `https://tu-dominio.com/api/webhooks/mercado-pago`
3. **Ualá**:
   - Obtén tus credenciales de la API
   - Configura la URL de webhook: `https://tu-dominio.com/api/webhooks/uala`

### 📈 Reportes y Analytics

#### Ver Flujo de Caja

1. Ve a **"Reportes"** → **"Flujo de Caja"**
2. Selecciona el **período** (día, semana, mes)
3. Filtra por **tienda** o **categoría**
4. Exporta el reporte en **PDF** o **Excel**

#### Balance General

- **Ingresos totales** del período
- **Egresos totales** del período
- **Balance neto** (ingresos - egresos)
- **Comparativas** con períodos anteriores

## 👤 Panel de Empleado (Employee)

Si eres **empleado**, tienes acceso limitado pero funcional para tu trabajo diario.

### 📱 Dashboard de Empleado

Al iniciar sesión, verás:

- **Ingresos en tiempo real** de tus tiendas asignadas
- **Botón para registrar gastos** manuales
- **Historial de movimientos** recientes
- **Notificaciones** de pagos entrantes

### 💰 Registrar Gastos

1. Haz clic en **"Registrar Gasto"**
2. Selecciona la **tienda** donde ocurrió el gasto
3. Completa la información:
   - **Categoría** (Suministros, Servicios, etc.)
   - **Monto**
   - **Descripción**
   - **Comprobante** (foto opcional)
4. Haz clic en **"Guardar"**

### 📊 Ver Ingresos

- **Visualización en tiempo real** de todos los pagos que llegan
- **Sonido de "caja registradora"** cuando llega un pago
- **Notificación push** en el dispositivo
- **Historial completo** de ingresos por tienda

## 🔔 Notificaciones y Alertas

### Tipos de Notificaciones

1. **📥 Pagos Entrantes**: Cuando llega un pago vía IPN
2. **⚠️ Alertas del Sistema**: Problemas de conexión, tokens expirados
3. **📊 Reportes Automáticos**: Resúmenes diarios/semanales
4. **🔄 Recordatorios**: Gastos recurrentes, inventarios bajos

### Configuración de Notificaciones

1. Ve a **"Configuración"** → **"Notificaciones"**
2. Activa/desactiva tipos de notificaciones
3. Configura sonidos y vibraciones
4. Establece horarios de silencio

### Notificaciones Push

PayAlert utiliza **Web Push API** para enviarte notificaciones incluso cuando la app está cerrada:

- **Sonido personalizado** de caja registradora
- **Badge en el ícono** con número de notificaciones
- **Acciones rápidas** desde la notificación (marcar como leído)

## ⚙️ Configuración Personal

### Perfil de Usuario

1. Ve a **"Configuración"** → **"Perfil"**
2. Actualiza tu información:
   - Nombre y apellido
   - Foto de perfil
   - Preferencias de idioma

### Tema y Apariencia

1. Ve a **"Configuración"** → **"Apariencia"**
2. Selecciona **modo claro** o **modo oscuro**
3. Elige tu **idioma** preferido (español por defecto)

### Seguridad

1. **Cambiar contraseña** regularmente
2. **Cerrar sesión** en dispositivos compartidos
3. **Revisar actividad** reciente de tu cuenta

## 🔧 Solución de Problemas

### Problemas Comunes

#### No recibo notificaciones de pagos

1. Verifica que los **tokens de pago** estén configurados correctamente
2. Confirma que las **URLs de webhook** sean accesibles
3. Revisa el **estado de conexión** en el panel de integraciones

#### La app no se carga

1. **Actualiza la página** (F5 o Ctrl+R)
2. **Borra el caché** del navegador
3. **Reinstala la PWA** si es necesario

#### Error al guardar datos

1. Verifica tu **conexión a internet**
2. Confirma que tienes **permisos** para la acción
3. Contacta al administrador si persiste

### Contacto de Soporte

Si encuentras un problema que no puedes resolver:

- **📧 Email**: <soporte@payalert.com>
- **💬 Chat en vivo**: Disponible en horario comercial
- **📚 Documentación**: [docs.payalert.com](https://docs.payalert.com)
- **🐛 Reportar bug**: [GitHub Issues](https://github.com/payalert/issues)

## 📋 Glosario

- **IPN (Instant Payment Notification)**: Notificación instantánea de pago desde el gateway
- **PWA (Progressive Web App)**: Aplicación web que funciona como app nativa
- **RLS (Row Level Security)**: Seguridad a nivel de fila en la base de datos
- **Webhook**: URL que recibe notificaciones automáticas
- **Token de acceso**: Credencial para conectarse a APIs de pago
- **Balance neto**: Ingresos totales menos egresos totales

## 🎯 Mejores Prácticas

### Para Dueños

- **Configura todas las integraciones** al inicio
- **Revisa reportes semanalmente** para identificar tendencias
- **Asigna empleados** solo a las tiendas donde trabajan
- **Mantén tokens actualizados** para evitar interrupciones

### Para Empleados

- **Registra gastos inmediatamente** cuando ocurren
- **Toma fotos de comprobantes** para respaldo
- **Verifica notificaciones** de pagos al final del día
- **Reporta problemas técnicos** lo antes posible

---

**¡Gracias por elegir PayAlert!** Tu negocio merece la mejor gestión financiera. 💰📈</content>
<parameter name="filePath">d:\Repositorio\jonatha1992\payalert\docs\Manual_de_Usuario.md
