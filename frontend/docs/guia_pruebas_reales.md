# Guía de Pruebas Reales y Configuración de IPN

Para que PayAlert funcione con **pagos reales**, usaremos el sistema de **IPN (Instant Payment Notification)** de Mercado Pago. Esto permite que el servidor reciba avisos automáticos cada vez que cambia el estado de un pago.

## 1. El Desafío: El Servidor Local
Como estás desarrollando en tu computadora (`localhost`), los servidores de Mercado Pago no pueden "ver" tu terminal.

### Solución: Un Túnel (Ngrok o LocalTunnel)
Necesitas una URL pública temporal que apunte a tu computadora.
1.  **Instala Ngrok**: [ngrok.com](https://ngrok.com/)
2.  **Ejecuta**: `ngrok http 3000`
3.  **Resultado**: Obtendrás una URL como `https://xyz-123.ngrok-free.app`. Esta es la URL que pondrás en los paneles de desarrollador de MP/Ualá.

---

## 2. Requerimientos Técnicos

### A. Endpoints de IPN (El "Receptor")
Necesitamos crear archivos en `app/api/webhooks/mercadopago/route.ts` y `app/api/webhooks/uala/route.ts`.
Estos archivos harán:
1.  Recibir la señal IPN de la pasarela.
2.  Extraer el `id` y `topic` (para MP).
3.  Consultar a la API para verificar la transacción.
4.  Actualizar la tabla `transactions` en Supabase.

### B. Credenciales Reales
Debes obtener estas llaves de tus paneles:
- **Mercado Pago**: `Access Token` y `Public Key`.
- **Ualá Bis**: `Client ID` y `Client Secret`.

---

## 3. Pasos para Probar HOY

### Paso 1: Configurar IPN en Mercado Pago
1.  Entra a [Mercado Pago Developers](https://www.mercadopago.com.ar/developers/panel/applications).
2.  Crea una aplicación o entra a una existente.
3.  Busca **Notificaciones IPN**.
4.  En "URL de destino", pega tu URL de Ngrok + el endpoint: `https://TU_URL.ngrok-free.app/api/webhooks/mercadopago`.
5.  Selecciona el evento: `Pagos` (merchant_order no es necesario para alertas simples).

### Paso 2: El "Puente" de Datos
¿Quieres que yo implemente ahora mismo el código para recibir estos pagos? Puedo crear los **Endpoints de Recepción** en tu proyecto Next.js para que cuando Mercado Pago envíe la señal, la tabla de Supabase se actualice sola y la Terminal suene.

### Paso 3: El Archivo de Sonido
Asegúrate de tener un archivo llamado `notification.mp3` en la carpeta `public/sounds/`. Sin esto, la terminal no podrá avisarte con audio.

---

## ¿Deseas que proceda a crear los Endpoints de Recepción (API Routes)?
Esto permitirá que tu aplicación empiece a escuchar señales reales del exterior.
