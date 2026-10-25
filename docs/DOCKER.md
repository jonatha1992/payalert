# Docker

La imagen ejecuta Next.js en modo `standalone`; la configuración normal de Next/Vercel no cambia. Node 22 Alpine, proceso `nextjs` no root, puerto 3000 y healthcheck HTTP a `/login`.

## Build y ejecución

Desde la raíz del repositorio:

```sh
docker compose build
docker compose up -d
docker compose ps
curl -i http://localhost:3000/login
docker compose down
```

Compose lee secretos únicamente en runtime desde `frontend/.env.local`. No se copian a la imagen. Los valores `NEXT_PUBLIC_*` se incrustan en el bundle cliente durante el build y se entregan como build args; exportarlos antes de compilar, por ejemplo:

```sh
export NEXT_PUBLIC_APP_URL=https://app.ejemplo.com
export NEXT_PUBLIC_SUPABASE_URL=https://proyecto.supabase.co
export NEXT_PUBLIC_SUPABASE_ANON_KEY=...
export NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
docker compose build
```

Mantener en `frontend/.env.local` los secretos de servidor (`SUPABASE_SERVICE_ROLE_KEY`, `PAYMENTS_ENCRYPTION_KEY`, `MP_*`, `CRON_SECRET`, `VAPID_PRIVATE_KEY`, etc.). No pasarlos como build args ni guardarlos en la imagen. El archivo queda excluido del contexto Docker.

## Diferencias frente a Vercel

La app Next.js corre como un contenedor persistente y no usa el runtime serverless de Vercel. Vercel ejecutaba diariamente el `webhook-worker`; al migrar hay que configurar un cron externo que llame a su ruta con `CRON_SECRET` en la cabecera que la API espera. La imagen no programa ese cron. Los assets públicos y las variables públicas se fijan al construir; reconstruir para cambiarlos.
