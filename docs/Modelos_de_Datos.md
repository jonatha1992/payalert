# Modelos de Datos - PayAlert SaaS

Este documento describe la estructura completa de la base de datos de PayAlert, incluyendo todas las tablas, relaciones y políticas de seguridad.

## 🗂️ Esquema General

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  businesses │─────│    users    │     │   stores    │
│             │     │             │     │             │
│ - id        │     │ - id        │     │ - id        │
│ - name      │     │ - email     │     │ - name      │
│ - settings  │     │ - role      │     │ - business_id│
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
                    ┌─────────────┐
                    │  payments   │
                    │             │
                    │ - id        │
                    │ - store_id  │
                    │ - amount    │
                    │ - status    │
                    │ - provider  │
                    └─────────────┘
                           │
                           │
                    ┌─────────────┐
                    │transactions │
                    │             │
                    │ - id        │
                    │ - payment_id│
                    │ - type      │
                    │ - amount    │
                    │ - category  │
                    └─────────────┘
```

## 📋 Tablas del Sistema

### 1. businesses (Negocios)

Tabla principal que representa cada negocio/cliente del SaaS.

```sql
CREATE TABLE businesses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
```

**Campos:**

- `id`: Identificador único (UUID)
- `name`: Nombre del negocio
- `settings`: Configuraciones específicas del negocio (JSONB)
- `created_at`: Fecha de creación
- `updated_at`: Fecha de última actualización

**Ejemplo de settings:**

```json
{
  "theme": "dark",
  "currency": "ARS",
  "timezone": "America/Argentina/Buenos_Aires",
  "notifications": {
    "email": true,
    "push": true,
    "sound": true
  },
  "integrations": {
    "mercado_pago": {
      "enabled": true,
      "webhook_url": "https://api.payalert.com/webhooks/mp"
    },
    "uala": {
      "enabled": false,
      "webhook_url": "https://api.payalert.com/webhooks/uala"
    }
  }
}
```

### 2. users (Usuarios)

Tabla de usuarios del sistema con roles diferenciados.

```sql
CREATE TABLE users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('owner', 'employee')),
    first_name TEXT,
    last_name TEXT,
    avatar_url TEXT,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
```

**Campos:**

- `id`: Identificador único (UUID)
- `business_id`: Referencia al negocio (FK)
- `email`: Correo electrónico único
- `role`: Rol del usuario ('owner' o 'employee')
- `first_name`: Nombre
- `last_name`: Apellido
- `avatar_url`: URL del avatar
- `settings`: Configuraciones personales
- `created_at/updated_at`: Timestamps

### 3. stores (Tiendas/Sucursales)

Tiendas o sucursales pertenecientes a un negocio.

```sql
CREATE TABLE stores (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    manager_id UUID REFERENCES users(id),
    settings JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
```

**Campos:**

- `id`: Identificador único
- `business_id`: Negocio al que pertenece
- `name`: Nombre de la tienda
- `address`: Dirección física
- `phone`: Teléfono de contacto
- `manager_id`: Usuario encargado (FK a users)
- `settings`: Configuraciones específicas
- `is_active`: Estado de la tienda
- `created_at/updated_at`: Timestamps

### 4. payments (Pagos)

Registro de pagos procesados por los gateways de pago.

```sql
CREATE TABLE payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    external_id TEXT UNIQUE NOT NULL, -- ID del gateway
    provider TEXT NOT NULL CHECK (provider IN ('mercado_pago', 'uala')),
    amount DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'ARS',
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    description TEXT,
    payer_info JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
```

**Campos:**

- `id`: Identificador único
- `store_id`: Tienda donde se realizó el pago
- `external_id`: ID único del gateway de pago
- `provider`: Proveedor ('mercado_pago' o 'uala')
- `amount`: Monto del pago
- `currency`: Moneda (default ARS)
- `status`: Estado del pago
- `description`: Descripción del pago
- `payer_info`: Información del pagador (JSONB)
- `metadata`: Metadatos adicionales
- `processed_at`: Fecha de procesamiento
- `created_at/updated_at`: Timestamps

### 5. transactions (Transacciones)

Movimientos de caja (ingresos y egresos).

```sql
CREATE TABLE transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    category TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    description TEXT,
    notes TEXT,
    receipt_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
```

**Campos:**

- `id`: Identificador único
- `business_id`: Negocio al que pertenece
- `store_id`: Tienda donde ocurrió
- `payment_id`: Pago relacionado (opcional)
- `user_id`: Usuario que registró la transacción
- `type`: Tipo ('income' o 'expense')
- `category`: Categoría del movimiento
- `amount`: Monto
- `description`: Descripción
- `notes`: Notas adicionales
- `receipt_url`: URL del comprobante
- `created_at/updated_at`: Timestamps

### 6. payment_tokens (Tokens de Pago)

Tokens de integración con gateways de pago.

```sql
CREATE TABLE payment_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('mercado_pago', 'uala')),
    token_type TEXT NOT NULL CHECK (token_type IN ('access', 'refresh', 'webhook')),
    token_value TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
```

**Campos:**

- `id`: Identificador único
- `business_id`: Negocio propietario
- `provider`: Proveedor del token
- `token_type`: Tipo de token
- `token_value`: Valor del token (encriptado)
- `expires_at`: Fecha de expiración
- `is_active`: Estado del token
- `metadata`: Información adicional
- `created_at/updated_at`: Timestamps

## 🔒 Políticas de Seguridad (RLS)

### Políticas por Rol

#### Para Owners (Dueños)

```sql
-- Acceso completo a su negocio
CREATE POLICY "owners_full_access_businesses"
ON businesses FOR ALL USING (auth.uid() IN (
    SELECT id FROM users WHERE business_id = businesses.id AND role = 'owner'
));

-- Acceso completo a usuarios de su negocio
CREATE POLICY "owners_full_access_users"
ON users FOR ALL USING (business_id IN (
    SELECT business_id FROM users WHERE id = auth.uid() AND role = 'owner'
));
```

#### Para Employees (Empleados)

```sql
-- Solo lectura de su propio perfil
CREATE POLICY "employees_read_own_profile"
ON users FOR SELECT USING (id = auth.uid());

-- Acceso limitado a tiendas asignadas
CREATE POLICY "employees_limited_stores"
ON stores FOR SELECT USING (id IN (
    SELECT store_id FROM user_store_assignments WHERE user_id = auth.uid()
));

-- Solo ingresos de sus tiendas asignadas
CREATE POLICY "employees_limited_payments"
ON payments FOR SELECT USING (store_id IN (
    SELECT store_id FROM user_store_assignments WHERE user_id = auth.uid()
));
```

## 📊 Vistas y Funciones Útiles

### Vista: business_summary

```sql
CREATE VIEW business_summary AS
SELECT
    b.id,
    b.name,
    COUNT(DISTINCT s.id) as total_stores,
    COUNT(DISTINCT u.id) as total_users,
    COUNT(DISTINCT p.id) as total_payments,
    COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) as total_income,
    COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) as total_expenses,
    COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) as net_balance
FROM businesses b
LEFT JOIN stores s ON b.id = s.business_id
LEFT JOIN users u ON b.id = u.business_id
LEFT JOIN payments p ON s.id = p.store_id
LEFT JOIN transactions t ON b.id = t.business_id
GROUP BY b.id, b.name;
```

### Vista: store_daily_summary

```sql
CREATE VIEW store_daily_summary AS
SELECT
    s.id,
    s.name,
    DATE(t.created_at) as date,
    COUNT(CASE WHEN t.type = 'income' THEN 1 END) as income_count,
    COUNT(CASE WHEN t.type = 'expense' THEN 1 END) as expense_count,
    COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) as daily_income,
    COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) as daily_expenses
FROM stores s
LEFT JOIN transactions t ON s.id = t.store_id
GROUP BY s.id, s.name, DATE(t.created_at);
```

## 🔄 Migraciones

### Versión 1.0 (Actual)

- Tablas básicas: businesses, users, stores
- Políticas RLS iniciales
- Vistas de resumen

### Próximas Versiones

- Tabla `user_store_assignments` para asignación flexible de empleados
- Tabla `categories` para categorización personalizada
- Tabla `recurring_transactions` para gastos recurrentes
- Índices optimizados para consultas de reportes

## 📈 Consideraciones de Rendimiento

### Índices Recomendados

```sql
-- Índices para búsquedas frecuentes
CREATE INDEX idx_payments_store_status ON payments(store_id, status);
CREATE INDEX idx_payments_created_at ON payments(created_at);
CREATE INDEX idx_transactions_business_date ON transactions(business_id, created_at);
CREATE INDEX idx_transactions_store_date ON transactions(store_id, created_at);

-- Índices para RLS
CREATE INDEX idx_users_business_role ON users(business_id, role);
CREATE INDEX idx_stores_business_active ON stores(business_id, is_active);
```

### Particionamiento

Para tablas con alto volumen (payments, transactions), considerar particionamiento por fecha:

```sql
-- Particionamiento mensual para payments
CREATE TABLE payments_y2024m01 PARTITION OF payments
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

Este esquema proporciona una base sólida y escalable para el sistema PayAlert, con seguridad granular y flexibilidad para futuras expansiones.</content>
<parameter name="filePath">d:\Repositorio\jonatha1992\payalert\docs\Modelos_de_Datos.md
