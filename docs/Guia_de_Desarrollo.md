# Guía de Desarrollo - PayAlert SaaS

Esta guía proporciona toda la información necesaria para desarrolladores que quieran contribuir al proyecto PayAlert, incluyendo setup del entorno, convenciones de código, y procesos de desarrollo.

## 🚀 Inicio Rápido para Desarrolladores

### Prerrequisitos

- **Node.js**: v20.6.0 o superior
- **Git**: v2.30+ para manejo de versiones
- **Cuenta Supabase**: Para desarrollo local
- **VS Code**: Recomendado con extensiones de TypeScript y React

### Configuración del Entorno

1. **Clonar el repositorio**

   ```bash
   git clone https://github.com/jonatha1992/payalert.git
   cd payalert/frontend
   ```

2. **Instalar dependencias**

   ```bash
   npm install
   ```

3. **Configurar Supabase**

   ```bash
   # Crear proyecto en https://supabase.com
   # Obtener URL y anon key
   cp .env.example .env.local
   ```

4. **Editar `.env.local`**

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
   ```

5. **Configurar base de datos**

   ```bash
   # Ejecutar el schema en Supabase SQL Editor
   # Copiar contenido de docs/database_schema.sql
   ```

6. **Cargar datos de prueba**

   ```bash
   node --env-file=.env.local scripts/seed-db.js
   ```

7. **Verificar conexión**

   ```bash
   node --env-file=.env.local scripts/test-db.js
   ```

8. **Iniciar desarrollo**

   ```bash
   npm run dev
   ```

## 🏗️ Estructura del Proyecto

```
frontend/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Rutas de autenticación
│   ├── (dashboard)/              # Rutas del dashboard
│   │   ├── admin/                # Panel de administración
│   │   └── api/                  # API Routes
│   ├── globals.css               # Estilos globales
│   ├── layout.tsx                # Layout raíz
│   └── page.tsx                  # Página de inicio
├── components/                   # Componentes React
│   ├── ui/                       # Componentes base (shadcn/ui)
│   ├── forms/                    # Formularios
│   ├── layout/                   # Layout components
│   └── providers/                # Context providers
├── lib/                          # Utilidades
│   ├── supabase/                 # Cliente y tipos de Supabase
│   ├── hooks/                    # Custom hooks
│   ├── utils/                    # Funciones utilitarias
│   └── validations/              # Esquemas de validación
├── hooks/                        # React hooks personalizados
├── stores/                       # Estado global (Zustand)
├── types/                        # Definiciones TypeScript
├── scripts/                      # Scripts de utilidad
├── public/                       # Assets estáticos
└── docs/                         # Documentación
```

## 💻 Convenciones de Código

### TypeScript

#### Tipos y Interfaces

```typescript
// ✅ Correcto: Interfaces descriptivas
interface Business {
  id: string;
  name: string;
  settings: BusinessSettings;
  createdAt: Date;
  updatedAt: Date;
}

// ❌ Incorrecto: Tipos any o sin tipado
interface Business {
  id: any;
  name: string;
  settings: any;
}
```

#### Genéricos

```typescript
// ✅ Correcto: Uso de genéricos
interface ApiResponse<T> {
  data: T;
  error: string | null;
  loading: boolean;
}

// ❌ Incorrecto: Tipos específicos cuando debería ser genérico
interface BusinessResponse {
  data: Business;
  error: string | null;
  loading: boolean;
}
```

### React Components

#### Functional Components con TypeScript

```tsx
// ✅ Correcto: Componente tipado correctamente
interface BusinessCardProps {
  business: Business;
  onEdit?: (business: Business) => void;
  onDelete?: (businessId: string) => void;
}

export function BusinessCard({ business, onEdit, onDelete }: BusinessCardProps) {
  return (
    <div className="business-card">
      <h3>{business.name}</h3>
      {onEdit && (
        <button onClick={() => onEdit(business)}>
          Editar
        </button>
      )}
    </div>
  );
}
```

#### Custom Hooks

```typescript
// ✅ Correcto: Hook personalizado con tipado
export function useBusinesses() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBusinesses = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select('*');

      if (error) throw error;
      setBusinesses(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBusinesses();
  }, [fetchBusinesses]);

  return { businesses, loading, error, refetch: fetchBusinesses };
}
```

### Estilos y CSS

#### Tailwind CSS Classes

```tsx
// ✅ Correcto: Classes organizadas y responsive
<div className="flex flex-col md:flex-row gap-4 p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
  <div className="flex-1">
    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
      Título
    </h3>
  </div>
</div>

// ❌ Incorrecto: Classes desorganizadas
<div className="bg-white p-6 flex flex-col rounded-xl dark:bg-gray-800 md:flex-row gap-4 shadow-sm border-gray-200 border dark:border-gray-700">
```

#### CSS Modules (cuando sea necesario)

```css
/* components/Button.module.css */
.button {
  @apply px-4 py-2 rounded-lg font-medium transition-colors;
}

.buttonPrimary {
  @apply bg-blue-600 hover:bg-blue-700 text-white;
}

.buttonSecondary {
  @apply bg-gray-200 hover:bg-gray-300 text-gray-900;
}
```

### Nombres de Archivos y Carpetas

```
✅ Correcto:
components/
├── BusinessCard.tsx
├── BusinessForm.tsx
├── businesses/
│   ├── BusinessList.tsx
│   └── BusinessDetail.tsx
└── ui/
    ├── Button.tsx
    └── Input.tsx

❌ Incorrecto:
components/
├── businessCard.tsx          # PascalCase para componentes
├── business_form.tsx         # snake_case
├── BusinessCard.js           # .tsx para TypeScript
└── businessCardComponent.tsx # Nombres redundantes
```

## 🗄️ Gestión de Base de Datos

### Migraciones

#### Crear nueva migración

```sql
-- migrations/001_add_user_preferences.sql
BEGIN;

-- Agregar columna de preferencias
ALTER TABLE users ADD COLUMN preferences JSONB DEFAULT '{}'::jsonb;

-- Crear índice para búsquedas
CREATE INDEX idx_users_preferences ON users USING gin(preferences);

COMMIT;
```

#### Ejecutar migraciones

```bash
# En Supabase SQL Editor, ejecutar en orden
# migrations/001_add_user_preferences.sql
# migrations/002_add_business_settings.sql
```

### Seeds y Datos de Prueba

#### Crear seed script

```javascript
// scripts/seed-businesses.js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const sampleBusinesses = [
  {
    name: 'Tienda Central',
    settings: {
      theme: 'dark',
      currency: 'ARS',
      timezone: 'America/Argentina/Buenos_Aires'
    }
  },
  {
    name: 'Sucursal Norte',
    settings: {
      theme: 'light',
      currency: 'ARS'
    }
  }
];

async function seed() {
  console.log('🌱 Creando negocios de prueba...');

  const { data, error } = await supabase
    .from('businesses')
    .insert(sampleBusinesses)
    .select();

  if (error) {
    console.error('❌ Error:', error);
  } else {
    console.log('✅ Negocios creados:', data.length);
  }
}

seed();
```

## 🧪 Testing

### Configuración de Tests

#### Jest + React Testing Library

```javascript
// __tests__/components/BusinessCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { BusinessCard } from '@/components/BusinessCard';

const mockBusiness = {
  id: '1',
  name: 'Tienda Central',
  settings: {},
  createdAt: new Date(),
  updatedAt: new Date()
};

test('renders business name', () => {
  render(<BusinessCard business={mockBusiness} />);
  expect(screen.getByText('Tienda Central')).toBeInTheDocument();
});

test('calls onEdit when edit button is clicked', () => {
  const mockOnEdit = jest.fn();
  render(<BusinessCard business={mockBusiness} onEdit={mockOnEdit} />);

  fireEvent.click(screen.getByRole('button', { name: /editar/i }));
  expect(mockOnEdit).toHaveBeenCalledWith(mockBusiness);
});
```

#### Playwright para E2E

```typescript
// e2e/business-management.spec.ts
import { test, expect } from '@playwright/test';

test('user can create and view business', async ({ page }) => {
  // Login
  await page.goto('/login');
  await page.fill('[name="email"]', 'owner@test.com');
  await page.fill('[name="password"]', 'password');
  await page.click('button[type="submit"]');

  // Navigate to businesses
  await page.goto('/admin/businesses');

  // Create business
  await page.click('text=Agregar Negocio');
  await page.fill('[placeholder="Nombre del negocio"]', 'Nueva Tienda');
  await page.click('text=Crear Negocio');

  // Verify business appears
  await expect(page.locator('text=Nueva Tienda')).toBeVisible();
});
```

### Ejecutar Tests

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Coverage report
npm run test:coverage

# Watch mode
npm run test:watch
```

## 🔄 Git Workflow

### Ramas y Commits

#### Nomenclatura de ramas

```
main                    # Rama de producción
develop                 # Rama de desarrollo
feature/auth-system     # Nuevas funcionalidades
bugfix/login-error      # Corrección de bugs
hotfix/security-patch   # Parches críticos
release/v1.2.0          # Versiones
```

#### Commits convencionales

```
feat: add user authentication system
fix: resolve payment webhook timeout issue
docs: update API documentation
style: format code with prettier
refactor: simplify business creation logic
test: add unit tests for payment processing
chore: update dependencies
```

### Pull Requests

#### Template de PR

```markdown
## Descripción
Breve descripción de los cambios realizados.

## Tipo de cambio
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Checklist
- [ ] Tests unitarios pasan
- [ ] Tests E2E pasan
- [ ] Documentación actualizada
- [ ] Linter pasa
- [ ] Build exitoso

## Issues relacionados
Closes #123
```

## 🚀 Despliegue

### Entornos

#### Desarrollo

- **URL**: <https://dev.payalert.com>
- **Base de datos**: Supabase dev project
- **Variables**: `.env.local`

#### Staging

- **URL**: <https://staging.payalert.com>
- **Base de datos**: Supabase staging project
- **Variables**: Vercel staging env

#### Producción

- **URL**: <https://payalert.com>
- **Base de datos**: Supabase prod project
- **Variables**: Vercel production env

### Proceso de Deploy

#### Automático (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main, develop]

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
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

#### Manual

```bash
# Build
npm run build

# Deploy a producción
vercel --prod

# Deploy a staging
vercel --staging
```

## 🔍 Debugging

### Herramientas de Desarrollo

#### React DevTools

```bash
npm install -g react-devtools
react-devtools
```

#### Redux DevTools (si usas Zustand)

```typescript
// stores/debugStore.ts
import { devtools } from 'zustand/middleware';

export const useDebugStore = create<DebugState>()(
  devtools(
    (set) => ({
      // store logic
    }),
    { name: 'Debug Store' }
  )
);
```

#### Supabase Logs

```bash
# Ver logs de base de datos
supabase logs

# Ver queries lentas
supabase db inspect
```

### Debugging en Producción

#### Sentry para errores

```typescript
// lib/sentry.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
  beforeSend(event) {
    // Filtrar datos sensibles
    return event;
  },
});
```

#### Logging estructurado

```typescript
// lib/logger.ts
export const logger = {
  info: (message: string, data?: any) => {
    const logData = {
      level: 'info',
      message,
      timestamp: new Date().toISOString(),
      ...data,
    };

    if (process.env.NODE_ENV === 'development') {
      console.log(JSON.stringify(logData, null, 2));
    } else {
      // Enviar a servicio de logging
      fetch('/api/logs', {
        method: 'POST',
        body: JSON.stringify(logData),
      });
    }
  },
};
```

## 📊 Performance

### Optimizaciones

#### Code Splitting

```typescript
// app/admin/businesses/page.tsx
import { lazy, Suspense } from 'react';

const BusinessList = lazy(() => import('@/components/BusinessList'));
const BusinessForm = lazy(() => import('@/components/BusinessForm'));

export default function BusinessesPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <BusinessList />
      <BusinessForm />
    </Suspense>
  );
}
```

#### Image Optimization

```tsx
import Image from 'next/image';

export function OptimizedImage({ src, alt }: { src: string; alt: string }) {
  return (
    <Image
      src={src}
      alt={alt}
      width={400}
      height={300}
      loading="lazy"
      placeholder="blur"
      blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ..."
    />
  );
}
```

#### Database Query Optimization

```typescript
// ✅ Correcto: Query optimizada
export async function getBusinessSummary(businessId: string) {
  const { data } = await supabase
    .from('business_summary') // Vista precalculada
    .select('*')
    .eq('id', businessId)
    .single();

  return data;
}

// ❌ Incorrecto: Query ineficiente
export async function getBusinessSummary(businessId: string) {
  const { data: business } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', businessId)
    .single();

  const { data: stores } = await supabase
    .from('stores')
    .select('*')
    .eq('business_id', businessId);

  // Múltiples queries innecesarias
  const { data: payments } = await supabase
    .from('payments')
    .select('*')
    .in('store_id', stores.map(s => s.id));

  return { business, stores, payments };
}
```

## 🔒 Seguridad

### Validación de Input

```typescript
// lib/validations/business.ts
import { z } from 'zod';

export const businessSchema = z.object({
  name: z.string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede exceder 100 caracteres')
    .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Solo letras, números, espacios, guiones y underscores'),
  settings: z.object({
    theme: z.enum(['light', 'dark']).optional(),
    currency: z.string().length(3).optional(),
  }).optional(),
});

export type BusinessInput = z.infer<typeof businessSchema>;
```

### Sanitización

```typescript
// lib/security/sanitize.ts
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const window = new JSDOM('').window;
const DOMPurifyInstance = DOMPurify(window);

export function sanitizeHtml(html: string): string {
  return DOMPurifyInstance.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em'],
    ALLOWED_ATTR: [],
  });
}

export function sanitizeInput(input: string): string {
  return input.trim().replace(/[<>]/g, '');
}
```

### Rate Limiting

```typescript
// middleware/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { kv } from '@vercel/kv';

const ratelimit = new Ratelimit({
  redis: kv,
  limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 requests per minute
});

export async function rateLimit(request: Request): Promise<boolean> {
  const ip = request.headers.get('x-forwarded-for') || 'anonymous';
  const { success } = await ratelimit.limit(ip);

  return success;
}
```

## 📚 Recursos Adicionales

### Documentación Oficial

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

### Herramientas Recomendadas

- **VS Code Extensions**:
  - TypeScript and JavaScript Language Features
  - Tailwind CSS IntelliSense
  - Prettier
  - ESLint
- **Chrome Extensions**:
  - React Developer Tools
  - Redux DevTools

### Comunidad

- [Next.js Discord](https://nextjs.org/discord)
- [Supabase Discord](https://supabase.com/docs/guides/getting-started)
- [Tailwind CSS Discord](https://tailwindcss.com/discord)

Siguiendo estas guías y convenciones, contribuirás a mantener PayAlert como un proyecto de alta calidad, escalable y mantenible. ¡Bienvenido al equipo! 🚀</content>
<parameter name="filePath">d:\Repositorio\jonatha1992\payalert\docs\Guia_de_Desarrollo.md
