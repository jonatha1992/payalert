# Panel de administrador: apps y cobros

La página `/dashboard/apps` muestra las apps configuradas, dominios permitidos, seña por defecto, cuenta de Mercado Pago asociada y cobros recientes del hub. Solo usuarios `owner` autenticados pueden consultar el panel.

Cada app activa incluye **Conectar Mercado Pago**. El endpoint `POST /api/admin/apps/[slug]/connect` crea una invitación de un solo uso con vencimiento de una hora y devuelve una URL bajo el host de PayAlert de la solicitud. El token solo se almacena como hash y nunca se registra en logs. La ruta configura el retorno `/dashboard/apps` y permite ese origen de PayAlert además de los dominios previamente permitidos. El callback de invitación admite el retorno del panel solo cuando coincide con el host que sirvió el flujo de conexión; otros retornos continúan sujetos a `allowed_origins`. Tras autorizar, el callback vuelve al panel indicando app y resultado. Reconectar una cuenta ya vinculada requiere confirmación, porque reemplaza la cuenta actual.

La API `GET /api/admin/apps` solo expone campos de configuración necesarios y datos públicos de cuenta; nunca devuelve hashes de API keys ni secretos cifrados. `GET /api/admin/charges` consulta únicamente monto, estado, fecha y relación con la app. No selecciona ni devuelve referencias del pagador, booking, pagos externos, claves de idempotencia ni errores internos.

Ambos endpoints exigen sesión y rol `owner`. Las tablas `client_apps` y `hub_charges` tienen RLS habilitado y permisos revocados para `anon` y `authenticated`; por eso las rutas usan el cliente de servicio solo después de validar el rol en servidor.
