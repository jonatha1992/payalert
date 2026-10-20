# Guía de Deploy en Vercel - PayAlert

## Requisitos Previos

- Cuenta en Vercel (https://vercel.com)
- Cuenta en GitHub/GitLab/Bitbucket
- Proyecto subido a un repositorio Git

## Paso 1: Configurar Variables de Entorno en Vercel

En el dashboard de Vercel, ve a tu proyecto → Settings → Environment Variables:

### Variables Obligatorias

```bash
# Supabase (Obligatorio)
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key

# VAPID Keys para Push Notifications (Obligatorio)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BPTvqMPsdR_obQjJDQkG_SfbgsX2iZq8rgbsK3yJp_e_w3wLsdHSCQk5iDss2R0Ug92hWV7sZT0Le4fS-V99NhA
VAPID_PRIVATE_KEY=xabyv9EYhIMWWUIM-LxpIXuPkx8HoektnbiBZSs-gQU
VAPID_SUBJECT=mailto:soporte@payalert.com

# App URL (Obligatorio - cambiar por tu dominio de Vercel)
NEXT_PUBLIC_APP_URL=https://payalert-tuusuario.vercel.app

# Mercado Pago (Opcional - para webhooks en producción)
MP_ACCESS_TOKEN=TEST-...
MP_WEBHOOK_SECRET=tu-webhook-secret-de-produccion

# Ualá (Opcional - para webhooks en producción)
UALA_WEBHOOK_SECRET=tu-webhook-secret-de-uala
```

## Paso 2: Configurar Webhooks en Mercado Pago

1. Ve a https://www.mercadopago.com.ar/developers/panel/applications
2. Selecciona tu aplicación
3. Ve a "Webhooks" o "Notificaciones IPN"
4. Configura la URL:
   ```
   https://payalert-tuusuario.vercel.app/api/webhooks/mercadopago
   ```
5. Selecciona eventos: `payment` (pagos)
6. Guarda el "Webhook Secret" que te dan y agrégalo a las variables de entorno

## Paso 3: Configurar Webhooks en Ualá Bis

1. Ve al panel de desarrollador de Ualá Bis
2. Ve a sección Webhooks
3. Configura la URL:
   ```
   https://payalert-tuusuario.vercel.app/api/webhooks/uala
   ```
4. Guarda el secret y agrégalo a variables de entorno

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
