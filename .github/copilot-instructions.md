# PayAlert SaaS - Copilot Instructions

## Architecture Overview

PayAlert is a multi-tenant SaaS for cash flow management via IPN (Instant Payment Notification) from Mercado Pago and Ualá. The frontend is in `frontend/` using Next.js 16+ App Router with Supabase as BaaS.

**Key architectural decisions:**
- **Single Next.js project** handles both dashboard (frontend) and API routes (webhooks)
- **Supabase** provides PostgreSQL, Auth, Realtime subscriptions, and Row Level Security (RLS)
- **PWA-enabled** via `next-pwa` for installable mobile experience with background notifications
- **Multi-tenant isolation** via RLS policies on all tables

## Project Structure

```
frontend/
├── app/                    # Next.js App Router pages
│   ├── admin/              # Protected admin dashboard (requires auth)
│   │   └── businesses/     # CRUD for businesses (dynamic routes)
│   └── login/              # Auth pages
├── components/             # React components (AuthProvider, AdminSidebar)
├── lib/                    # Utilities (supabaseClient.ts)
└── scripts/                # DB utilities (seed-db.js, test-db.js)
docs/                       # Database schema, requirements, setup guides
```

## Development Commands

```bash
cd frontend
npm run dev          # Start dev server (uses --webpack flag)
npm run build        # Production build
npm run lint         # ESLint

# Database scripts (require Node.js v20.6.0+)
node --env-file=.env.local scripts/test-db.js   # Verify Supabase connection
node --env-file=.env.local scripts/seed-db.js   # Insert sample businesses
```

## Environment Setup

Create `frontend/.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Database schema must be created via `docs/database_schema.sql` in Supabase SQL Editor.

## Code Patterns

### Supabase Client Usage
Use the singleton client from `@/lib/supabaseClient`:
```typescript
import { supabase } from '@/lib/supabaseClient';
const { data, error } = await supabase.from('businesses').select('*');
```

### Authentication Pattern
- `AuthProvider` wraps the app and provides `useAuth()` hook
- Middleware (`middleware.ts`) protects `/admin/*` routes server-side
- Use `supabase.auth.signInWithPassword()` for login

### Data Fetching in Client Components
```typescript
'use client';
const [data, setData] = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
    fetchData();
}, []);
```

### Form Handling
- Controlled inputs with `useState`
- Loading state with `Loader2` spinner from lucide-react
- Error display in red alert box: `<div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">`

## UI Conventions

- **Language**: Spanish for all user-facing text
- **Styling**: Tailwind CSS v4 with dark mode support (`dark:` prefix)
- **Icons**: Lucide React (`lucide-react`) - use size prop, not className for dimensions
- **Component styling**: `rounded-xl shadow-sm border border-gray-200 dark:border-gray-700`
- **Buttons**: Primary is `bg-blue-600 hover:bg-blue-700`, destructive is `text-red-600`

## Role System (Future)

Two roles defined in requirements:
- **Dueño (Owner)**: Full access - tokens, stores, balances, employee management
- **Empleado (Employee)**: Limited - real-time income view, expense registration for assigned store only

RLS policies must enforce role-based data access.

## Important Files

- [middleware.ts](frontend/middleware.ts) - Auth protection and redirects
- [components/AuthProvider.tsx](frontend/components/AuthProvider.tsx) - Auth context with `useAuth()` hook
- [lib/supabaseClient.ts](frontend/lib/supabaseClient.ts) - Supabase client singleton
- [docs/database_schema.sql](docs/database_schema.sql) - PostgreSQL schema with RLS
