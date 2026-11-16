# Recuperar contraseña

El flujo de recuperación usa Supabase Auth. Antes de habilitarlo, agregá estas URL en **Supabase → Authentication → URL Configuration → Redirect URLs**:

- `https://payalert-kappa.vercel.app/reset-password`
- `https://payalert.tecnofusion.dev/reset-password`

La URL de producción también requiere estar permitida en la configuración de Supabase. Esta configuración la realiza el usuario; no se modificó Supabase.
