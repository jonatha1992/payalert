# Arquitectura Técnica - PayAlert SaaS

Este documento describe la arquitectura técnica completa de PayAlert, incluyendo decisiones de diseño, patrones implementados y consideraciones de escalabilidad.

## 🏗️ Arquitectura General

PayAlert sigue una arquitectura **multi-tenant SaaS** con separación clara entre frontend y backend, utilizando servicios en la nube para máxima escalabilidad.

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT LAYER                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐  │
│  │   Web Browser   │  │ Mobile Browser  │  │    PWA      │  │
│  │   (Responsive)  │  │   (Responsive)  │  │  (Offline)  │  │
│  └─────────────────┘  └─────────────────┘  └─────────────┘  │
└─────────────────────────────────────────────────────────────┘
                                 │
┌─────────────────────────────────────────────────────────────┐
│                   EDGE LAYER (Vercel)                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐  │
│  │   Next.js App   │  │  API Routes     │  │ Middleware  │  │
│  │   (Pages)       │  │  (Webhooks)     │  │  (Auth)     │  │
│  └─────────────────┘  └─────────────────┘  └─────────────┘  │
└─────────────────────────────────────────────────────────────┘
                                 │
┌─────────────────────────────────────────────────────────────┐
│                 BACKEND LAYER (Supabase)                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐  │
│  │ PostgreSQL DB   │  │   Auth System   │  │ Realtime    │  │
│  │   (Data)        │  │   (JWT)         │  │ (WebSocket) │  │
│  └─────────────────┘  └─────────────────┘  └─────────────┘  │
└─────────────────────────────────────────────────────────────┘
                                 │
┌─────────────────────────────────────────────────────────────┐
│               INTEGRATION LAYER                             │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │ Mercado Pago    │  │     Ualá       │                   │
│  │   IPN Webhook   │  │  IPN Webhook   │                   │
│  └─────────────────┘  └─────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

## 🛠️ Tecnologías Principales

### Frontend Layer

#### Next.js 16+ App Router

- **Server Components** para renderizado inicial rápido
- **Client Components** para interactividad
- **API Routes** para webhooks y endpoints internos
- **Middleware** para autenticación y protección de rutas

#### React 19

- **Concurrent Features** para mejor UX
- **Server Components** para optimización de performance
- **Suspense** para loading states

#### TypeScript

- **Type Safety** en toda la aplicación
- **IntelliSense** mejorado en desarrollo
- **Database Types** generados automáticamente desde Supabase

### Backend Layer

#### Supabase

- **PostgreSQL** como base de datos principal
- **Row Level Security (RLS)** para multi-tenancy
- **Realtime subscriptions** para notificaciones live
- **Auth** con JWT y refresh tokens
- **Edge Functions** para procesamiento serverless

#### PostgreSQL

- **JSONB** para configuraciones flexibles
- **RLS Policies** para aislamiento de datos
- **Views** para consultas complejas
- **Triggers** para auditoría automática

### UI/UX Layer

#### Tailwind CSS v4

- **Utility-first** approach
- **Dark mode** support nativo
- **Responsive design** con breakpoints
- **Custom themes** por negocio

#### Lucide React

- **Iconos consistentes** en toda la app
- **SVG-based** para escalabilidad
- **Tree-shaking** para bundle optimization

#### Framer Motion

- **Micro-interactions** para mejor UX
- **Performance optimized** animations
- **Gesture support** para mobile

### PWA Layer

#### Next-PWA

- **Service Workers** para offline capability
- **Web App Manifest** para instalación
- **Background sync** para datos offline
- **Push notifications** vía Web Push API

## 🔒 Seguridad y Multi-tenancy

### Row Level Security (RLS)

Cada tabla tiene políticas RLS que garantizan que los usuarios solo accedan a datos de su negocio:

```sql
-- Ejemplo: Solo owners pueden ver todos los usuarios de su negocio
CREATE POLICY "owners_full_access_users" ON users
FOR ALL USING (business_id IN (
    SELECT business_id FROM users
    WHERE id = auth.uid() AND role = 'owner'
));
```

### Autenticación

- **JWT Tokens** con refresh automático
- **Session management** vía Supabase Auth
- **Password hashing** automático
- **MFA support** opcional

### Autorización

- **Role-based access control** (RBAC)
- **Business-level isolation**
- **Store-level permissions** para empleados
- **API-level restrictions**

## 📡 APIs y Integraciones

### Webhooks de Pago

#### Mercado Pago IPN

```typescript
// api/webhooks/mercado-pago/route.ts
export async function POST(request: Request) {
  const payload = await request.json();

  // 1. Validar firma del webhook
  const isValid = validateMercadoPagoSignature(request.headers, payload);

  // 2. Procesar pago
  if (isValid && payload.action === 'payment.updated') {
    await processPayment(payload.data.id, 'mercado_pago');
  }

  return Response.json({ received: true });
}
```

#### Ualá IPN

```typescript
// api/webhooks/uala/route.ts
export async function POST(request: Request) {
  const payload = await request.json();

  // 1. Validar autenticidad
  const isValid = validateUalaSignature(request.headers, payload);

  // 2. Procesar pago
  if (isValid && payload.event === 'payment.succeeded') {
    await processPayment(payload.payment.id, 'uala');
  }

  return Response.json({ status: 'ok' });
}
```

### Realtime Subscriptions

```typescript
// Componente de notificaciones en tiempo real
'use client';

useEffect(() => {
  const channel = supabase
    .channel('payments')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'payments',
      filter: `store_id=in.(${userStoreIds.join(',')})`
    }, (payload) => {
      // Mostrar notificación
      showPaymentNotification(payload.new);
    })
    .subscribe();

  return () => channel.unsubscribe();
}, [userStoreIds]);
```

## 🗃️ Gestión de Estado

### Client State (React)

#### Zustand para estado global

```typescript
// stores/businessStore.ts
interface BusinessState {
  businesses: Business[];
  currentBusiness: Business | null;
  setBusinesses: (businesses: Business[]) => void;
  setCurrentBusiness: (business: Business) => void;
}

export const useBusinessStore = create<BusinessState>((set) => ({
  businesses: [],
  currentBusiness: null,
  setBusinesses: (businesses) => set({ businesses }),
  setCurrentBusiness: (business) => set({ currentBusiness: business }),
}));
```

#### React Query para server state

```typescript
// hooks/usePayments.ts
export function usePayments(storeId: string) {
  return useQuery({
    queryKey: ['payments', storeId],
    queryFn: () => fetchPayments(storeId),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
```

### Server State (Database)

#### Optimistic Updates

```typescript
// Actualización optimista para mejor UX
const mutation = useMutation({
  mutationFn: updateBusiness,
  onMutate: async (newBusiness) => {
    // Cancelar queries
    await queryClient.cancelQueries({ queryKey: ['businesses'] });

    // Snapshot del estado anterior
    const previousBusinesses = queryClient.getQueryData(['businesses']);

    // Optimistic update
    queryClient.setQueryData(['businesses'], (old) =>
      old.map(b => b.id === newBusiness.id ? newBusiness : b)
    );

    return { previousBusinesses };
  },
  onError: (err, newBusiness, context) => {
    // Revertir en caso de error
    queryClient.setQueryData(['businesses'], context.previousBusinesses);
  },
  onSettled: () => {
    // Refetch para asegurar consistencia
    queryClient.invalidateQueries({ queryKey: ['businesses'] });
  },
});
```

## 🚀 Despliegue y Escalabilidad

### Vercel (Frontend + API)

#### Edge Functions

- **Global CDN** para baja latencia
- **Auto-scaling** basado en demanda
- **Environment variables** por entorno
- **Preview deployments** para PRs

#### Configuración de build

```javascript
// next.config.ts
const nextConfig = {
  // PWA configuration
  experimental: {
    serverComponentsExternalPackages: ['@supabase/supabase-js'],
  },
  // API optimizations
  api: {
    responseLimit: '8mb',
  },
};
```

### Supabase (Backend)

#### Database Scaling

- **Connection pooling** automático
- **Read replicas** para consultas pesadas
- **Point-in-time recovery** para backups
- **Horizontal scaling** con múltiples instancias

#### Realtime

- **WebSocket connections** para notificaciones
- **Broadcast channels** para comunicación
- **Presence** para usuarios online

## 📊 Monitoreo y Observabilidad

### Logging

#### Client-side logging

```typescript
// lib/logger.ts
export const logger = {
  info: (message: string, data?: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[INFO] ${message}`, data);
    }
    // Enviar a servicio de logging en producción
  },
  error: (message: string, error?: Error) => {
    console.error(`[ERROR] ${message}`, error);
    // Reportar a error tracking service
  },
};
```

#### Server-side logging

```typescript
// middleware.ts
export async function middleware(request: NextRequest) {
  const start = Date.now();

  // Procesar request
  const response = await processRequest(request);

  // Log performance
  const duration = Date.now() - start;
  logger.info('Request processed', {
    path: request.nextUrl.pathname,
    method: request.method,
    duration,
    status: response.status,
  });

  return response;
}
```

### Error Tracking

#### Sentry integration

```typescript
// lib/sentry.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
});
```

### Performance Monitoring

#### Core Web Vitals

- **LCP (Largest Contentful Paint)** < 2.5s
- **FID (First Input Delay)** < 100ms
- **CLS (Cumulative Layout Shift)** < 0.1

#### Database performance

- **Query optimization** con EXPLAIN ANALYZE
- **Index monitoring** y mantenimiento
- **Connection pooling** metrics

## 🔄 CI/CD Pipeline

### GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy to Vercel
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build
      - run: npm run test
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

### Testing Strategy

#### Unit Tests

```typescript
// __tests__/components/BusinessCard.test.tsx
import { render, screen } from '@testing-library/react';
import BusinessCard from '@/components/BusinessCard';

test('renders business name', () => {
  render(<BusinessCard business={{ name: 'Test Business' }} />);
  expect(screen.getByText('Test Business')).toBeInTheDocument();
});
```

#### Integration Tests

```typescript
// __tests__/api/businesses.test.ts
import { createMocks } from 'node-mocks-http';
import handler from '@/pages/api/businesses';

test('creates business', async () => {
  const { req, res } = createMocks({
    method: 'POST',
    body: { name: 'New Business' },
  });

  await handler(req, res);
  expect(res._getStatusCode()).toBe(201);
});
```

#### E2E Tests (Playwright)

```typescript
// e2e/business-management.spec.ts
test('user can create business', async ({ page }) => {
  await page.goto('/admin/businesses');
  await page.click('text=Agregar Negocio');
  await page.fill('[placeholder="Nombre del negocio"]', 'Mi Negocio');
  await page.click('text=Crear Negocio');

  await expect(page.locator('text=Mi Negocio')).toBeVisible();
});
```

## 📈 Estrategia de Escalabilidad

### Horizontal Scaling

#### Database

- **Read replicas** para consultas de reportes
- **Sharding** por business_id para tenants grandes
- **Connection pooling** con PgBouncer

#### Application

- **Stateless design** para fácil scaling
- **CDN** para assets estáticos
- **Edge computing** para latencia baja

### Caching Strategy

#### Redis (futuro)

- **Session storage** para auth
- **API response caching** para datos frecuentemente accedidos
- **Rate limiting** para protección

#### Browser caching

- **Service Worker** para offline-first
- **HTTP caching headers** optimizados
- **IndexedDB** para datos locales

## 🔮 Consideraciones Futuras

### Microservicios

- **Payment processing service** separado
- **Notification service** independiente
- **Analytics service** para reportes avanzados

### Advanced Features

- **Machine Learning** para predicción de flujo de caja
- **OCR** para digitalización de comprobantes
- **Multi-currency** support
- **API marketplace** para integraciones de terceros

### Compliance

- **GDPR compliance** para datos europeos
- **SOX compliance** para reportes financieros
- **PCI DSS** para manejo de datos de pago

Esta arquitectura proporciona una base sólida y escalable para PayAlert, permitiendo crecimiento orgánico mientras mantiene la simplicidad y performance que necesitan los usuarios finales.</content>
<parameter name="filePath">d:\Repositorio\jonatha1992\payalert\docs\Arquitectura.md
