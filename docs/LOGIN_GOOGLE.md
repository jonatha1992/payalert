# Login con Google (GIS)

Configura `NEXT_PUBLIC_GOOGLE_CLIENT_ID` en el entorno de frontend con el OAuth 2.0 Client ID de tipo Aplicación web de Google Cloud. En Google Cloud Console, configura la pantalla de consentimiento OAuth y agrega a **Orígenes autorizados de JavaScript** los orígenes exactos donde se sirve la app (por ejemplo `http://localhost:3000` y `https://app.ejemplo.com`, sin rutas). Habilita el proveedor Google en Supabase Auth.

Con Client ID configurado, el login usa Google Identity Services y entrega el ID token a `supabase.auth.signInWithIdToken`; nonce es aleatorio y se envía hasheado a GIS. Si falta el Client ID o falla la carga del script GIS, se conserva el flujo OAuth con redirect a `/auth/callback`.
