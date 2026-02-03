# Guía de Despliegue - PayAlert SaaS

Esta guía proporciona instrucciones completas para desplegar PayAlert en diferentes entornos, desde desarrollo hasta producción.

## 🏗️ Arquitectura de Despliegue

### Componentes del Sistema

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Vercel        │    │   Supabase      │    │   External      │
│   (Frontend)    │    │   (Backend)     │    │   Services      │
│                 │    │                 │    │                 │
│ • Next.js App   │    │ • PostgreSQL    │    │ • Mercado Pago  │
│ • API Routes    │    │ • Auth          │    │ • Ualá          │
│ • Edge Runtime  │    │ • Realtime       │    │ • Email Service │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Entornos

#### Desarrollo (Development)

- **Frontend**: `http://localhost:3000`
- **Base de datos**: Supabase dev project
- **Variables**: `.env.local`

#### Staging

- **Frontend**: `https://staging.payalert.com`
- **Base de datos**: Supabase staging project
- **Variables**: Vercel staging environment

#### Producción (Production)

- **Frontend**: `https://payalert.com`
- **Base de datos**: Supabase prod project
- **Variables**: Vercel production environment

## 🚀 Despliegue con Vercel

### Prerrequisitos

1. **Cuenta en Vercel**
   - Regístrate en [vercel.com](https://vercel.com)
   - Conecta tu cuenta de GitHub

2. **Cuenta en Supabase**
   - Crea cuenta en [supabase.com](https://supabase.com)
   - Crea proyectos para cada entorno

3. **Dominio personalizado** (opcional)
   - Compra dominio en proveedor como Namecheap, GoDaddy
   - Configura DNS en Vercel

### Configuración Inicial

#### 1. Conectar Repositorio

```bash
# En Vercel Dashboard:
# 1. Click "New Project"
# 2. Import Git Repository
# 3. Seleccionar "jonatha1992/payalert"
# 4. Configurar build settings
```

#### 2. Configurar Build Settings

```json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "nodeVersion": "20.x"
}
```

#### 3. Configurar Variables de Entorno

En Vercel Dashboard → Project Settings → Environment Variables:

```env
# Base
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Production overrides
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://payalert.com

# Analytics (opcional)
VERCEL_ANALYTICS_ID=your-analytics-id

# Error tracking
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project
```

### Despliegue Automático

#### GitHub Integration

```yaml
# .github/workflows/deploy.yml
name: Deploy to Vercel
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm run test
        env:
          CI: true

      - name: Build
        run: npm run build

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

#### Preview Deployments

Vercel automáticamente crea preview deployments para cada PR:

- **URL**: `https://payalert-git-feature-branch.vercel.app`
- **Comentario automático** en el PR con el enlace
- **Variables de entorno** compartidas con producción

### Configuración de Dominio

#### Dominio Personalizado

1. **En Vercel Dashboard**:
   - Project Settings → Domains
   - Add `payalert.com`
   - Vercel generará records DNS

2. **Configurar DNS** en tu proveedor de dominio:

   ```
   Tipo: CNAME
   Nombre: @
   Valor: cname.vercel-dns.com

   Tipo: CNAME
   Nombre: www
   Valor: cname.vercel-dns.com
   ```

3. **SSL Automático**:
   - Vercel proporciona SSL gratis
   - Se configura automáticamente

## 🗄️ Configuración de Supabase

### Crear Proyectos

#### Proyecto de Desarrollo

```bash
# Crear proyecto
supabase projects create "payalert-dev"

# Configurar base de datos
supabase db push
```

#### Proyecto de Producción

```bash
# Crear proyecto
supabase projects create "payalert-prod"

# Configurar base de datos
supabase db push
```

### Configuración de Base de Datos

#### Ejecutar Schema Inicial

1. **En Supabase Dashboard** → SQL Editor
2. **Ejecutar** `docs/database_schema.sql`

#### Configurar Row Level Security

```sql
-- Verificar que RLS esté habilitado
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('businesses', 'users', 'stores', 'payments', 'transactions');
```

#### Crear Usuario Admin Inicial

```sql
-- Crear usuario admin (ejecutar en SQL Editor)
INSERT INTO auth.users (email, encrypted_password, email_confirmed_at, created_at, updated_at)
VALUES (
  'admin@payalert.com',
  crypt('temporary_password', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
);

-- Crear perfil de usuario
INSERT INTO public.users (id, email, role, first_name, last_name)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'admin@payalert.com'),
  'admin@payalert.com',
  'owner',
  'Admin',
  'PayAlert'
);
```

### Configurar Autenticación

#### En Supabase Dashboard → Authentication

1. **Site URL**: `https://payalert.com`
2. **Redirect URLs**:
   - `https://payalert.com/auth/callback`
   - `https://payalert.com/admin`
3. **JWT Expiry**: 3600 seconds (1 hour)
4. **Refresh Token Rotation**: Enabled

### Configurar Realtime

#### En Supabase Dashboard → Database → Replication

1. **Enable Realtime** para las tablas:
   - `payments`
   - `transactions`
   - `users`

2. **Configurar políticas de realtime**:

```sql
-- Permitir realtime solo para usuarios autenticados
ALTER PUBLICATION supabase_realtime ADD TABLE payments;
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
```

## 🔧 Configuración de Integraciones

### Mercado Pago

#### 1. Crear Aplicación

1. Ir a [Mercado Pago Developers](https://developers.mercadopago.com)
2. Crear nueva aplicación
3. Configurar credenciales

#### 2. Configurar Webhooks

```bash
# URL del webhook
https://payalert.com/api/webhooks/mercado-pago

# Eventos a notificar
payment.created
payment.updated
payment.approved
payment.cancelled
```

#### 3. Almacenar Credenciales

En Supabase → Settings → Secrets:

```env
MERCADO_PAGO_ACCESS_TOKEN=your_access_token
MERCADO_PAGO_PUBLIC_KEY=your_public_key
```

### Ualá

#### 1. Configurar API

1. Contactar a Ualá para credenciales de API
2. Configurar webhook URL

#### 2. Configurar Webhook

```bash
# URL del webhook
https://payalert.com/api/webhooks/uala

# Eventos
payment.succeeded
payment.failed
payment.cancelled
```

#### 3. Almacenar Credenciales

```env
UALA_API_KEY=your_api_key
UALA_WEBHOOK_SECRET=your_webhook_secret
```

## 📊 Monitoreo y Analytics

### Vercel Analytics

#### Configuración

1. **En Vercel Dashboard** → Project Settings
2. **Enable Analytics**
3. **Configurar variables**:

```env
NEXT_PUBLIC_VERCEL_ANALYTICS=true
```

#### Métricas Disponibles

- **Page Views**: Visitas por página
- **Unique Visitors**: Usuarios únicos
- **Bounce Rate**: Tasa de rebote
- **Performance**: Core Web Vitals

### Error Tracking con Sentry

#### Configuración

```typescript
// lib/sentry.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.VERCEL_ENV || 'development',
  tracesSampleRate: 1.0,
  beforeSend(event) {
    // Filtrar datos sensibles
    if (event.request?.data) {
      delete event.request.data.password;
      delete event.request.data.token;
    }
    return event;
  },
});
```

#### Variables de Entorno

```env
SENTRY_DSN=https://your-dsn@sentry.io/project
SENTRY_AUTH_TOKEN=your-auth-token
```

### Database Monitoring

#### Supabase Dashboard

- **Query Performance**: Queries lentas
- **Connection Pool**: Estado de conexiones
- **Storage Usage**: Uso de almacenamiento
- **Realtime Metrics**: Conexiones activas

#### Custom Monitoring

```sql
-- Crear vista de performance
CREATE VIEW system_performance AS
SELECT
  schemaname,
  tablename,
  n_tup_ins AS inserts,
  n_tup_upd AS updates,
  n_tup_del AS deletes,
  n_live_tup AS live_rows,
  n_dead_tup AS dead_rows
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;
```

## 🔄 Estrategia de Backup

### Base de Datos

#### Backup Automático (Supabase)

- **Diario**: Backups automáticos incluidos
- **Point-in-time recovery**: Hasta 7 días
- **Export**: Datos en SQL o CSV

#### Backup Manual

```bash
# Exportar esquema
pg_dump --schema-only postgresql://user:pass@host:port/db > schema.sql

# Exportar datos
pg_dump --data-only --exclude-table=audit_logs postgresql://user:pass@host:port/db > data.sql
```

### Aplicación

#### Configuración como Código

- **Environment variables** versionadas
- **Database schema** en control de versiones
- **Infrastructure as Code** con scripts

## 🚨 Plan de Contingencia

### Rollback Strategy

#### Para Aplicación

```bash
# Rollback en Vercel
vercel rollback

# O especificar deployment
vercel rollback <deployment-id>
```

#### Para Base de Datos

```sql
-- Crear savepoint antes de cambios críticos
SAVEPOINT before_migration;

-- Si algo falla
ROLLBACK TO SAVEPOINT before_migration;
```

### Disaster Recovery

#### Paso 1: Evaluar el Impacto

- Verificar servicios afectados
- Comunicar con usuarios
- Activar plan de contingencia

#### Paso 2: Recuperación

```bash
# Restaurar desde backup
pg_restore -d payalert_prod backup.sql

# Verificar integridad
# Ejecutar tests de smoke
npm run test:smoke
```

#### Paso 3: Comunicación

- Notificar resolución
- Documentar incidente
- Implementar mejoras preventivas

## 📈 Optimización de Performance

### Frontend

#### Core Web Vitals

- **LCP** < 2.5s
- **FID** < 100ms
- **CLS** < 0.1

#### Optimizaciones Implementadas

```typescript
// next.config.ts
const nextConfig = {
  // Image optimization
  images: {
    domains: ['supabase.co'],
    formats: ['image/webp', 'image/avif'],
  },

  // Compression
  compress: true,

  // Headers de seguridad
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ];
  },
};
```

### Backend

#### Database Optimization

```sql
-- Índices optimizados
CREATE INDEX CONCURRENTLY idx_payments_composite
ON payments(store_id, status, created_at DESC);

-- Partitioning para tablas grandes
CREATE TABLE payments_y2024 PARTITION OF payments
FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
```

#### API Optimization

```typescript
// API Routes con caching
export const revalidate = 300; // 5 minutes

export async function GET() {
  // Implementar caching con Redis si es necesario
  const data = await getCachedData();

  return Response.json(data, {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=59'
    }
  });
}
```

## 🔒 Seguridad en Producción

### Configuración SSL/TLS

#### Vercel SSL Automático

- **Certificado gratuito** de Let's Encrypt
- **Renovación automática**
- **HTTP/2** habilitado

### Variables Sensibles

#### Nunca commitear

```env
# ❌ MAL - No commitear
SUPABASE_SERVICE_ROLE_KEY=sk-123456789

# ✅ BIEN - Usar variables de entorno
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
```

#### Rotación de Secrets

```bash
# Rotar tokens cada 90 días
# 1. Generar nuevos tokens
# 2. Actualizar en Supabase
# 3. Actualizar en Vercel
# 4. Probar funcionalidad
# 5. Remover tokens antiguos
```

### Rate Limiting

#### Implementación

```typescript
// middleware/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { kv } from '@vercel/kv';

const ratelimit = new Ratelimit({
  redis: kv,
  limiter: Ratelimit.slidingWindow(100, '1 h'), // 100 requests per hour
});

export async function rateLimit(request: Request) {
  const ip = request.ip || 'anonymous';
  const { success } = await ratelimit.limit(ip);

  if (!success) {
    return new Response('Too Many Requests', { status: 429 });
  }

  return null;
}
```

## 📋 Checklist de Despliegue

### Pre-despliegue

- [ ] Tests pasan en CI/CD
- [ ] Build exitoso
- [ ] Variables de entorno configuradas
- [ ] Base de datos migrada
- [ ] Backups realizados
- [ ] Dominio configurado

### Durante despliegue

- [ ] Monitorear logs en tiempo real
- [ ] Verificar health checks
- [ ] Probar funcionalidades críticas
- [ ] Monitorear performance metrics

### Post-despliegue

- [ ] Ejecutar smoke tests
- [ ] Verificar integraciones externas
- [ ] Monitorear errores
- [ ] Comunicar lanzamiento a usuarios

## 🆘 Solución de Problemas

### Problemas Comunes

#### Build Fails

```bash
# Verificar Node.js version
node --version

# Limpiar cache
rm -rf .next node_modules
npm install
npm run build
```

#### Database Connection Issues

```bash
# Verificar variables de entorno
echo $NEXT_PUBLIC_SUPABASE_URL

# Probar conexión
node scripts/test-db.js
```

#### SSL Issues

```bash
# Forzar renovación SSL en Vercel
vercel certs issue
```

### Logs y Debugging

#### Vercel Logs

```bash
# Ver logs en tiempo real
vercel logs --follow

# Ver logs de función específica
vercel logs --function api/webhooks/mercado-pago
```

#### Supabase Logs

```bash
# Ver logs de base de datos
supabase db logs

# Ver queries lentas
supabase db inspect
```

## 📞 Soporte y Mantenimiento

### Monitoreo Continuo

- **Uptime monitoring**: 99.9% SLA
- **Error alerting**: Notificaciones automáticas
- **Performance monitoring**: Métricas en tiempo real

### Actualizaciones

- **Security patches**: Aplicar inmediatamente
- **Dependency updates**: Revisiones mensuales
- **Database migrations**: Con rollback plan

### Contactos de Emergencia

- **Desarrollador principal**: <dev@payalert.com>
- **Soporte infraestructura**: <infra@payalert.com>
- **Atención al cliente**: <support@payalert.com>

---

**Esta guía asegura un despliegue seguro y escalable de PayAlert en cualquier entorno.** 🚀</content>
<parameter name="filePath">d:\Repositorio\jonatha1992\payalert\docs\Guia_de_Despliegue.md
