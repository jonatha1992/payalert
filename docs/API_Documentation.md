# Documentación de API - PayAlert SaaS

Esta documentación describe todos los endpoints disponibles en la API de PayAlert, incluyendo webhooks, endpoints internos y formatos de respuesta.

## 📋 Información General

### Base URL

```
Producción: https://payalert.com/api
Desarrollo: http://localhost:3000/api
```

### Autenticación

Todos los endpoints requieren autenticación mediante JWT token en el header `Authorization`:

```
Authorization: Bearer <jwt_token>
```

### Formatos

- **Request**: JSON
- **Response**: JSON
- **Encoding**: UTF-8

### Códigos de Estado HTTP

- `200`: Éxito
- `201`: Creado
- `400`: Error de validación
- `401`: No autorizado
- `403`: Prohibido
- `404`: No encontrado
- `500`: Error interno del servidor

## 🔗 Endpoints de la API

### Autenticación

#### POST /api/auth/login

Inicia sesión de usuario.

**Request:**

```json
{
  "email": "usuario@ejemplo.com",
  "password": "contraseña_segura"
}
```

**Response (200):**

```json
{
  "user": {
    "id": "uuid",
    "email": "usuario@ejemplo.com",
    "role": "owner",
    "business_id": "uuid"
  },
  "session": {
    "access_token": "jwt_token",
    "refresh_token": "refresh_token",
    "expires_at": 1638360000
  }
}
```

#### POST /api/auth/logout

Cierra la sesión del usuario.

**Response (200):**

```json
{
  "message": "Sesión cerrada exitosamente"
}
```

#### POST /api/auth/refresh

Renueva el token de acceso.

**Request:**

```json
{
  "refresh_token": "refresh_token"
}
```

**Response (200):**

```json
{
  "access_token": "new_jwt_token",
  "expires_at": 1638360000
}
```

### Negocios (Businesses)

#### GET /api/businesses

Obtiene la lista de negocios del usuario.

**Query Parameters:**

- `page` (number): Página (default: 1)
- `limit` (number): Elementos por página (default: 10)
- `search` (string): Búsqueda por nombre

**Response (200):**

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Tienda Central",
      "settings": {
        "theme": "dark",
        "currency": "ARS"
      },
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "pages": 3
  }
}
```

#### POST /api/businesses

Crea un nuevo negocio.

**Request:**

```json
{
  "name": "Nueva Tienda",
  "settings": {
    "theme": "light",
    "currency": "ARS",
    "timezone": "America/Argentina/Buenos_Aires"
  }
}
```

**Response (201):**

```json
{
  "id": "uuid",
  "name": "Nueva Tienda",
  "settings": {
    "theme": "light",
    "currency": "ARS",
    "timezone": "America/Argentina/Buenos_Aires"
  },
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### GET /api/businesses/{id}

Obtiene detalles de un negocio específico.

**Response (200):**

```json
{
  "id": "uuid",
  "name": "Tienda Central",
  "settings": { ... },
  "stores": [...],
  "users": [...],
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### PUT /api/businesses/{id}

Actualiza un negocio.

**Request:**

```json
{
  "name": "Tienda Central Actualizada",
  "settings": {
    "theme": "dark"
  }
}
```

#### DELETE /api/businesses/{id}

Elimina un negocio.

**Response (200):**

```json
{
  "message": "Negocio eliminado exitosamente"
}
```

### Tiendas (Stores)

#### GET /api/stores

Obtiene tiendas del negocio del usuario.

**Query Parameters:**

- `business_id` (uuid): Filtrar por negocio
- `active` (boolean): Solo tiendas activas

**Response (200):**

```json
{
  "data": [
    {
      "id": "uuid",
      "business_id": "uuid",
      "name": "Sucursal Centro",
      "address": "Av. Corrientes 1234",
      "phone": "+54 11 1234-5678",
      "manager_id": "uuid",
      "is_active": true,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### POST /api/stores

Crea una nueva tienda.

**Request:**

```json
{
  "business_id": "uuid",
  "name": "Nueva Sucursal",
  "address": "Dirección completa",
  "phone": "+54 11 1234-5678",
  "manager_id": "uuid" // opcional
}
```

### Pagos (Payments)

#### GET /api/payments

Obtiene pagos con filtros.

**Query Parameters:**

- `store_id` (uuid): Filtrar por tienda
- `status` (string): pending, approved, rejected, cancelled
- `provider` (string): mercado_pago, uala
- `date_from` (date): Fecha desde
- `date_to` (date): Fecha hasta

**Response (200):**

```json
{
  "data": [
    {
      "id": "uuid",
      "store_id": "uuid",
      "external_id": "123456789",
      "provider": "mercado_pago",
      "amount": 1500.50,
      "currency": "ARS",
      "status": "approved",
      "description": "Pago por productos",
      "payer_info": {
        "name": "Juan Pérez",
        "email": "juan@email.com"
      },
      "processed_at": "2024-01-01T12:00:00Z",
      "created_at": "2024-01-01T11:59:00Z",
      "updated_at": "2024-01-01T12:00:00Z"
    }
  ],
  "summary": {
    "total_amount": 1500.50,
    "total_count": 1,
    "approved_count": 1
  }
}
```

### Transacciones (Transactions)

#### GET /api/transactions

Obtiene transacciones de caja.

**Query Parameters:**

- `business_id` (uuid): Filtrar por negocio
- `store_id` (uuid): Filtrar por tienda
- `type` (string): income, expense
- `category` (string): Categoría específica
- `date_from` (date): Fecha desde
- `date_to` (date): Fecha hasta

**Response (200):**

```json
{
  "data": [
    {
      "id": "uuid",
      "business_id": "uuid",
      "store_id": "uuid",
      "payment_id": "uuid", // opcional
      "user_id": "uuid",
      "type": "income",
      "category": "venta",
      "amount": 1500.50,
      "description": "Venta de productos",
      "notes": "Cliente frecuente",
      "receipt_url": "https://storage.com/receipt.jpg",
      "created_at": "2024-01-01T12:00:00Z",
      "updated_at": "2024-01-01T12:00:00Z"
    }
  ],
  "summary": {
    "total_income": 1500.50,
    "total_expenses": 0,
    "net_balance": 1500.50,
    "transaction_count": 1
  }
}
```

#### POST /api/transactions

Registra una nueva transacción.

**Request:**

```json
{
  "business_id": "uuid",
  "store_id": "uuid",
  "type": "expense",
  "category": "suministros",
  "amount": 250.00,
  "description": "Compra de insumos",
  "notes": "Pago en efectivo",
  "receipt_url": "https://storage.com/receipt.jpg" // opcional
}
```

### Usuarios (Users)

#### GET /api/users

Obtiene usuarios del negocio (solo owners).

**Response (200):**

```json
{
  "data": [
    {
      "id": "uuid",
      "business_id": "uuid",
      "email": "empleado@tienda.com",
      "role": "employee",
      "first_name": "María",
      "last_name": "García",
      "avatar_url": "https://avatar.com/maria.jpg",
      "settings": {
        "notifications": true,
        "theme": "light"
      },
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### POST /api/users/invite

Invita a un nuevo usuario al sistema.

**Request:**

```json
{
  "email": "nuevo@usuario.com",
  "role": "employee",
  "first_name": "Nuevo",
  "last_name": "Usuario",
  "store_ids": ["uuid1", "uuid2"] // tiendas asignadas
}
```

**Response (200):**

```json
{
  "message": "Invitación enviada exitosamente",
  "invitation_id": "uuid"
}
```

## 🔔 Webhooks

### Mercado Pago IPN

#### POST /api/webhooks/mercado-pago

Webhook para notificaciones de Mercado Pago.

**Headers:**

```
Content-Type: application/json
X-Signature: <signature>
```

**Request Body:**

```json
{
  "id": "123456789",
  "live_mode": true,
  "type": "payment",
  "date_created": "2024-01-01T12:00:00Z",
  "application_id": "123456789",
  "user_id": "987654321",
  "version": 1,
  "api_version": "v1",
  "action": "payment.updated",
  "data": {
    "id": "123456789"
  }
}
```

**Response (200):**

```json
{
  "received": true,
  "processed": true,
  "payment_id": "uuid"
}
```

### Ualá IPN

#### POST /api/webhooks/uala

Webhook para notificaciones de Ualá.

**Headers:**

```
Content-Type: application/json
X-Uala-Signature: <signature>
```

**Request Body:**

```json
{
  "event": "payment.succeeded",
  "payment": {
    "id": "uala_payment_123",
    "amount": 1500.50,
    "currency": "ARS",
    "status": "succeeded",
    "created_at": "2024-01-01T12:00:00Z",
    "payer": {
      "name": "Juan Pérez",
      "email": "juan@email.com"
    }
  },
  "metadata": {
    "store_id": "uuid",
    "external_reference": "order_123"
  }
}
```

**Response (200):**

```json
{
  "status": "processed",
  "payment_id": "uuid"
}
```

## 📊 Reportes y Analytics

### GET /api/reports/summary

Obtiene resumen general del negocio.

**Query Parameters:**

- `business_id` (uuid): ID del negocio
- `period` (string): day, week, month, year
- `date` (date): Fecha específica

**Response (200):**

```json
{
  "period": "month",
  "date": "2024-01",
  "summary": {
    "total_income": 45000.50,
    "total_expenses": 12500.75,
    "net_balance": 32499.75,
    "transaction_count": 234,
    "payment_count": 156
  },
  "breakdown": {
    "by_store": [
      {
        "store_id": "uuid",
        "store_name": "Sucursal Centro",
        "income": 25000.00,
        "expenses": 7500.00,
        "balance": 17500.00
      }
    ],
    "by_category": [
      {
        "category": "ventas",
        "amount": 35000.00,
        "percentage": 77.8
      }
    ]
  }
}
```

### GET /api/reports/daily-flow

Obtiene flujo de caja diario.

**Query Parameters:**

- `business_id` (uuid): ID del negocio
- `store_id` (uuid): ID de tienda (opcional)
- `days` (number): Número de días (default: 30)

**Response (200):**

```json
{
  "data": [
    {
      "date": "2024-01-01",
      "income": 2500.50,
      "expenses": 750.25,
      "balance": 1750.25,
      "transaction_count": 12
    },
    {
      "date": "2024-01-02",
      "income": 3200.00,
      "expenses": 950.50,
      "balance": 2250.50,
      "transaction_count": 15
    }
  ]
}
```

## ⚙️ Configuración

### GET /api/config/business

Obtiene configuración del negocio.

**Response (200):**

```json
{
  "business_id": "uuid",
  "settings": {
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
        "webhook_url": "https://payalert.com/api/webhooks/mercado-pago"
      },
      "uala": {
        "enabled": false,
        "webhook_url": "https://payalert.com/api/webhooks/uala"
      }
    }
  }
}
```

### PUT /api/config/business

Actualiza configuración del negocio.

**Request:**

```json
{
  "settings": {
    "theme": "light",
    "notifications": {
      "push": false
    }
  }
}
```

## 🔒 Rate Limiting

La API implementa rate limiting para prevenir abuso:

- **Autenticados**: 1000 requests/minuto
- **Webhooks**: 100 requests/minuto por IP
- **Reportes**: 100 requests/minuto por usuario

**Headers de respuesta:**

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1638360000
```

## 📝 Errores

### Formato de Error

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Los datos proporcionados no son válidos",
    "details": {
      "field": "email",
      "reason": "Formato de email inválido"
    }
  },
  "timestamp": "2024-01-01T12:00:00Z",
  "request_id": "req_123456"
}
```

### Códigos de Error Comunes

| Código | Descripción |
|--------|-------------|
| `VALIDATION_ERROR` | Datos de entrada inválidos |
| `AUTHENTICATION_ERROR` | Credenciales inválidas |
| `AUTHORIZATION_ERROR` | Permisos insuficientes |
| `NOT_FOUND_ERROR` | Recurso no encontrado |
| `RATE_LIMIT_ERROR` | Límite de requests excedido |
| `INTEGRATION_ERROR` | Error en integración externa |
| `DATABASE_ERROR` | Error interno de base de datos |

## 🧪 Ejemplos de Uso

### JavaScript (fetch)

```javascript
// Login
const loginResponse = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'usuario@ejemplo.com',
    password: 'password'
  })
});

const { session } = await loginResponse.json();

// Usar token en requests posteriores
const businessesResponse = await fetch('/api/businesses', {
  headers: {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json'
  }
});

const businesses = await businessesResponse.json();
```

### cURL

```bash
# Login
curl -X POST https://payalert.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"usuario@ejemplo.com","password":"password"}'

# Obtener negocios (con token)
curl -X GET https://payalert.com/api/businesses \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 🔄 Versionado

La API utiliza versionado en la URL:

- **v1** (actual): `/api/v1/`
- Futuras versiones mantendrán compatibilidad hacia atrás

## 📞 Soporte

Para soporte técnico de la API:

- **Email**: <api@payalert.com>
- **Documentación**: <https://docs.payalert.com/api>
- **Status Page**: <https://status.payalert.com>

---

**Última actualización**: Febrero 2026
**Versión**: 1.0.0</content>
<parameter name="filePath">d:\Repositorio\jonatha1992\payalert\docs/API_Documentation.md
