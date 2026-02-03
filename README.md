# PayAlert SaaS - Gestión de Flujo de Caja

[![Next.js](https://img.shields.io/badge/Next.js-16.1.6-black)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-2.93.3-green)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-blue)](https://tailwindcss.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)

PayAlert es una plataforma SaaS multi-inquilino diseñada para la gestión integral del flujo de caja de negocios mediante notificaciones de pago en tiempo real (IPN) de Mercado Pago y Ualá.

## 🚀 Características Principales

- **📱 Dashboard Multi-rol**: Interfaces diferenciadas para dueños y empleados
- **⚡ Notificaciones en Tiempo Real**: Alertas instantáneas de pagos vía IPN
- **🔒 Seguridad Multi-tenant**: Aislamiento completo entre negocios usando RLS
- **📊 Reportes de Flujo de Caja**: Visualización de ingresos y gastos
- **🔔 PWA**: Aplicación instalable con notificaciones push
- **🌙 Modo Oscuro**: Interfaz adaptable a preferencias del usuario

## 🏗️ Arquitectura del Sistema

### Componentes Principales

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Base de       │
│   (Next.js)     │◄──►│   (Supabase)    │◄──►│   Datos         │
│                 │    │                 │    │   (PostgreSQL)  │
│ • Dashboard     │    │ • Auth          │    │                 │
│ • PWA           │    │ • Realtime      │    │ • Businesses    │
│ • Admin Panel   │    │ • RLS Security  │    │ • Stores        │
└─────────────────┘    └─────────────────┘    │ • Payments      │
                                              │ • Users         │
                                              │ • Transactions  │
                                              └─────────────────┘
```

### Tecnologías

- **Frontend**: Next.js 16+, React 19, TypeScript, Tailwind CSS v4
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **UI/UX**: Lucide React, Framer Motion
- **PWA**: Next-PWA, Service Workers, Web Push API
- **Integraciones**: Mercado Pago SDK, Ualá Bis API

## 📋 Requisitos del Sistema

### Roles de Usuario

#### 👑 Dueño (Owner)

- Acceso completo al sistema
- Gestión de tokens de pago
- Creación y administración de tiendas
- Visualización de balances totales
- Gestión de empleados
- Configuración del negocio

#### 👤 Empleado (Employee)

- Acceso limitado a su tienda asignada
- Visualización de ingresos en tiempo real
- Registro manual de gastos
- Sin acceso a configuraciones sensibles

## 🗂️ Estructura del Proyecto

```
payalert/
├── frontend/                    # Aplicación Next.js
│   ├── app/                     # App Router
│   │   ├── admin/               # Panel de administración
│   │   ├── login/               # Autenticación
│   │   └── api/                 # API Routes (webhooks)
│   ├── components/              # Componentes React
│   ├── lib/                     # Utilidades
│   └── scripts/                 # Scripts de BD
├── docs/                        # Documentación
│   ├── database_schema.sql      # Esquema de BD
│   ├── Arquitectura.md          # Arquitectura técnica
│   ├── Modelos_de_Datos.md      # Modelos de datos
│   └── Manual_de_Usuario.md     # Guía de usuario
└── .github/                     # Configuración GitHub
```

## 🚀 Inicio Rápido

### Prerrequisitos

- Node.js v20.6.0+
- Cuenta en [Supabase](https://supabase.com)
- Cuenta en [Vercel](https://vercel.com) (opcional)

### Instalación

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
   - Crear proyecto en Supabase
   - Ejecutar `docs/database_schema.sql` en SQL Editor
   - Obtener credenciales de API

4. **Configurar variables de entorno**

   ```bash
   cp .env.example .env.local
   # Editar .env.local con tus credenciales
   ```

5. **Cargar datos de prueba**

   ```bash
   node --env-file=.env.local scripts/seed-db.js
   ```

6. **Iniciar servidor de desarrollo**

   ```bash
   npm run dev
   ```

7. **Acceder a la aplicación**
   - Abrir [http://localhost:3000](http://localhost:3000)

## 📖 Documentación

- **[Manual de Usuario](docs/Manual_de_Usuario.md)** - Guía completa para usuarios
- **[Arquitectura Técnica](docs/Arquitectura.md)** - Detalles de implementación
- **[Modelos de Datos](docs/Modelos_de_Datos.md)** - Esquema de base de datos
- **[Guía de Desarrollo](docs/Guia_de_Desarrollo.md)** - Para contribuidores
- **[API Documentation](docs/API_Documentation.md)** - Referencia de APIs

## 🔧 Scripts Disponibles

```bash
# Desarrollo
npm run dev          # Servidor de desarrollo
npm run build        # Build de producción
npm run start        # Servidor de producción
npm run lint         # Ejecutar ESLint

# Base de datos
node --env-file=.env.local scripts/test-db.js    # Probar conexión
node --env-file=.env.local scripts/seed-db.js    # Cargar datos de prueba
```

## 🌐 Despliegue

### Vercel (Recomendado)

1. Conectar repositorio a Vercel
2. Configurar variables de entorno
3. Desplegar automáticamente

### Configuración Manual

```bash
npm run build
npm run start
```

## 🤝 Contribuir

1. Fork el proyecto
2. Crear rama feature (`git checkout -b feature/AmazingFeature`)
3. Commit cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abrir Pull Request

## 📝 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para más detalles.

## 📞 Soporte

- **Email**: <soporte@payalert.com>
- **Issues**: [GitHub Issues](https://github.com/jonatha1992/payalert/issues)
- **Documentación**: [docs/](docs/)

---

**PayAlert** - Gestiona tu flujo de caja con inteligencia artificial 💡</content>
<parameter name="filePath">d:\Repositorio\jonatha1992\payalert\README.md
