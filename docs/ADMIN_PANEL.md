# Panel de administrador: apps y cobros

La página `/dashboard/apps` es de solo lectura y está disponible para dueños autenticados. Muestra las apps configuradas, dominios permitidos, seña por defecto y el identificador de cuenta de Mercado Pago cuando la conexión está activa. También lista hasta 100 cobros recientes del hub con monto, estado, fecha y slug de app.

La API `GET /api/admin/apps` solo expone campos de configuración necesarios y datos públicos de cuenta; nunca devuelve hashes de API keys ni secretos cifrados. `GET /api/admin/charges` consulta únicamente monto, estado, fecha y relación con la app. No selecciona ni devuelve referencias del pagador, booking, pagos externos, claves de idempotencia ni errores internos.

Ambos endpoints exigen sesión y rol `owner`. Las tablas `client_apps` y `hub_charges` tienen RLS habilitado y permisos revocados para `anon` y `authenticated`; por eso las rutas usan el cliente de servicio solo después de validar el rol en servidor.
