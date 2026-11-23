# BLUEPRINT: PayAlert

## Estado actual
- Next.js 16 (`frontend/`). Hosting migrado de Vercel al server casero (Docker Desktop + Traefik `edge`), dominio `payalert.tecnofusion.dev` (DNS/Cloudflare aparte).
- Despliegue: el deployer de home-server (`deployer/apps.json`, app `payalert`) detecta commits nuevos en `main` -> `docker compose -p payalert --env-file deploy/.env.prod -f deploy/docker-compose.yml up -d --build` en `D:/Repositorio/payalert-deploy` -> health `http://127.0.0.1:3935/` -> rollback si falla.
- Contenedores: `payalert-app` (Traefik router `payalert`, Host `payalert.tecnofusion.dev`, puerto 3000, loopback 127.0.0.1:3935) y `payalert-cron` (alpine, 09:00 UTC llama `/api/internal/webhook-worker` con `CRON_SECRET`; reemplaza el cron de `vercel.json`).
- Env de prod: `D:/Repositorio/home-server/deployer/envs/.env.payalert` en el server (gitignored; el deployer lo copia a `deploy/.env.prod`). No versionar.
- `NEXT_PUBLIC_*` entran como build args; `output: standalone` solo con `DOCKER_BUILD=1` (Dockerfile) para no afectar Vercel.
- Correos transaccionales: cliente `frontend/lib/server/correoCentral.ts` contra `correo-central` (`CORREO_CENTRAL_URL`, `CORREO_CENTRAL_KEY`), cableado en `processWebhook` (`emailNotifications.ts`) para usuarios con `email_enabled=true` sin bloquear el ACK de webhooks.

## Pendientes
- `MP_OAUTH_REDIRECT_URI` sigue apuntando a `payalert-kappa.vercel.app`; migrar la URL registrada en Mercado Pago y el webhook antes de apagar Vercel.
- Apagar Vercel (el cron de `vercel.json` duplica al de `payalert-cron`).
- Dev tenia commits propios no portados a test (`ed9de14` version.json endpoint, `ecdfc89` footer, `de802af` backup del server: docs/diagrams, investigacion). Siguen en `origin/dev-server-backup`/historia previa.
