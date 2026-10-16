# Guía de Deploy en Vercel - PayAlert

## Requisitos Previos

- Cuenta en Vercel (https://vercel.com)
- Cuenta en GitHub/GitLab/Bitbucket
- Proyecto subido a un repositorio Git

## Paso 1: Configurar Variables de Entorno en Vercel

En el dashboard de Vercel, ve a tu proyecto → Settings → Environment Variables:

### Variables por función

```bash
# Supabase (requerido; valores del proyecto del entorno objetivo)
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key-del-entorno>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key-del-entorno>

# Cifrado de credenciales de proveedores (secreto; generar por entorno)
# openssl rand -base64 32
PAYMENTS_ENCRYPTION_KEY=<32-bytes-en-base64>

# Push (si se habilitan notificaciones; generar un par por entorno)
# npx web-push generate-vapid-keys
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<vapid-public-key>
VAPID_PRIVATE_KEY=<vapid-private-key>
VAPID_SUBJECT=mailto:<contacto-de-soporte>

# Variable opcional para pruebas aisladas, normalmente ausente en staging compartido
PAYMENTS_ENABLE_SIMULATOR=false
```

No copiar valores de ejemplo al proyecto. La guía anterior contenía valores VAPID con formato de claves; si alguno se usó en un entorno, generar un par nuevo y reemplazarlo allí antes de habilitar push. `SUPABASE_SERVICE_ROLE_KEY`, `PAYMENTS_ENCRYPTION_KEY` y `VAPID_PRIVATE_KEY` son secretos: configurarlos solo del lado servidor y nunca con prefijo `NEXT_PUBLIC_`. Guardar claves reales en un gestor seguro; no commitearlas ni pegarlas en tickets.

Las credenciales y secretos de Mercado Pago/Ualá se configuran por conexión autenticada en Integraciones y se guardan cifrados; no configurar `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` ni `UALA_WEBHOOK_SECRET` como variables globales de entorno. Ualá Bis v2 no firma webhooks; ver `docs/providers/uala.md`.


## Paso 2: Configurar Webhooks en Mercado Pago

1. Ve a https://www.mercadopago.com.ar/developers/panel/applications
2. Selecciona tu aplicación
3. Ve a "Webhooks" o "Notificaciones IPN"
4. Configura la URL:
   ```
   https://payalert-tuusuario.vercel.app/api/webhooks/mercadopago
   ```
5. Selecciona eventos: `payment` (pagos)
6. Vincula el secret a la conexión del comercio desde Integraciones; no lo agregues como variable global de Vercel.

## Paso 3: Configurar Webhooks en Ualá Bis

1. Ve al panel de desarrollador de Ualá Bis
2. Ve a sección Webhooks
3. Configura la URL:
   ```
   https://payalert-tuusuario.vercel.app/api/webhooks/uala
   ```
4. Configura el endpoint y las credenciales del comercio por la conexión Ualá Bis v2 en Integraciones. El callback v2 no requiere un webhook secret; PayAlert valida el UUID de la orden y la consulta a Ualá.

## Paso 4: Configurar Dominio Personalizado (Opcional)

Si quieres usar tu propio dominio (ej: app.tunegocio.com):

1. En Vercel: Settings → Domains
2. Agrega tu dominio
3. Configura los DNS según las instrucciones de Vercel
4. Actualiza `NEXT_PUBLIC_APP_URL` con tu dominio
5. Actualiza las URLs de webhooks en MP/Ualá

## Paso 5: Verificar Deploy

### Endpoints a probar:

1. **Dashboard**: https://tuapp.vercel.app/dashboard
2. **Webhooks MP**: https://tuapp.vercel.app/api/webhooks/mercadopago
3. **Webhooks Ualá**: https://tuapp.vercel.app/api/webhooks/uala

### Test de Webhooks:

Puedes probar los webhooks con curl:

```bash
# Test Mercado Pago
curl -X POST https://tuapp.vercel.app/api/webhooks/mercadopago \
  -H "Content-Type: application/json" \
  -d '{"data":{"id":"123"},"type":"payment"}'

# Test Ualá
curl -X POST https://tuapp.vercel.app/api/webhooks/uala \
  -H "Content-Type: application/json" \
  -d '{"id":"456","amount":100,"status":"PAID"}'
```

## Solución de Problemas

### Error: "Invalid signature" en webhooks
- Verificar que `MP_WEBHOOK_SECRET` esté correctamente configurado
- Asegurar que no haya espacios extra en las variables

### Notificaciones push no funcionan
- Verificar que `NEXT_PUBLIC_VAPID_PUBLIC_KEY` esté en variables públicas (NEXT_PUBLIC_)
- Verificar que el navegador soporte push (Chrome, Firefox, Edge)
- Asegurar que la app esté servida por HTTPS

### Service Worker no se registra
- Verificar que no haya errores en la consola del navegador
- Limpiar cache y recargar
- Verificar que `sw-push.js` esté en `/public`

## Configuración de Base de Datos (Supabase)

Asegúrate de ejecutar las migraciones en producción:

1. Ve a Supabase → SQL Editor
2. Ejecuta las migraciones en orden:
   - `001_add_dashboard_indexes.sql`
   - `002_add_audit_and_webhook_logs.sql`
   - `003_add_push_subscriptions.sql`

## Checklist Pre-Deploy

- [ ] Todas las variables de entorno configuradas en Vercel
- [ ] Migraciones SQL ejecutadas en Supabase
- [ ] Webhooks configurados en MP/Ualá con URL de producción
- [ ] Dominio personalizado configurado (opcional)
- [ ] Probar autenticación (login/logout)
- [ ] Probar creación de sucursal
- [ ] Probar webhooks con curl
- [ ] Probar notificaciones push
- [ ] Verificar HTTPS funciona correctamente

## Notas Importantes

1. **HTTPS Obligatorio**: Las notificaciones push y service workers REQUIEREN HTTPS
2. **Webhooks en desarrollo**: Para probar webhooks localmente usa ngrok:
   ```bash
   npx ngrok http 3000
   # Usa la URL https que te da ngrok en los paneles de MP/Ualá
   ```
3. **Límites Vercel**: Plan gratuito tiene límites de funciones serverless (hobby = 125k invocaciones/mes)
4. **Base de datos**: Supabase tiene límites en el plan gratuito (500MB, 2M requests/mes)

## Soporte

Si tienes problemas:
1. Revisar logs en Vercel (Deployments → View Logs)
2. Revisar logs de Supabase (Logs → API/Auth)
3. Verificar Network tab en DevTools del navegador
