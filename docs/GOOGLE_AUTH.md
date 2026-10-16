# Instrucciones auth Google y altas

Para activar el login social en el despliegue:

1. Crea un cliente OAuth de tipo aplicación web en Google Cloud Console. Añade el origen de tu dominio desplegado y configura como URI de redirección autorizada el callback de Supabase: `https://aiobbjrvzhegyagthxdr.supabase.co/auth/v1/callback`. Guarda Client ID y Client Secret directamente en la configuración del provider, sin ponerlos en el repositorio.
2. En Supabase Dashboard → Authentication → Providers → Google, activa Google e introduce las credenciales de Google.
3. En Authentication → URL Configuration, fija `Site URL` al origen de la aplicación desplegada y permite el callback de la aplicación, por ejemplo `https://<dominio-de-produccion>/auth/callback`, además de los orígenes de preview/desarrollo que correspondan. El `redirectTo` del cliente debe coincidir con estas URLs permitidas.
4. El callback intercambia el código y crea, mediante service-role en servidor, un negocio y el perfil `owner` solo si el usuario autenticado aún no tiene fila en `public.users`.
5. SaaS abierto: si `ALLOWED_SIGNUP_EMAILS` no se establece o queda vacío, cualquier cuenta Google verificada puede crear su propio negocio. Esto permite que cualquier persona se registre y genere su propio tenant. Para restringir el alta automática, define opcionalmente `ALLOWED_SIGNUP_EMAILS` en Vercel como lista de correos separada por comas; la comparación ignora mayúsculas y espacios. Correos fuera de la lista ven un mensaje de no autorización y su sesión se cierra.

Las credenciales de Google son secretos; configúralas únicamente en Google/Supabase. Nunca publiques service-role key en variables `NEXT_PUBLIC_*`.
