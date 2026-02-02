# Manual de Configuración y Despliegue del Backend (PayAlert)

Este documento detalla los pasos para configurar el backend (Supabase) y verificar la conexión con el frontend.

## 1. Configuración de Supabase

El sistema utiliza Supabase como Backend-as-a-Service (BaaS). Sigue estos pasos para inicializar el proyecto:

1.  Crea una cuenta en [supabase.com](https://supabase.com) y un nuevo proyecto.
2.  Obtén las credenciales del proyecto en **Settings > API**:
    *   **Project URL** (`NEXT_PUBLIC_SUPABASE_URL`)
    *   **anon key** (`NEXT_PUBLIC_SUPABASE_ANON_KEY`)

## 2. Configuración de Variables de Entorno

Asegúrate de tener un archivo `.env.local` en la carpeta `frontend/` con el siguiente contenido:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-larga
```

> **Nota:** Reemplaza los valores con tus credenciales reales.

## 3. Creación de la Base de Datos

Para que el sistema funcione, debes crear las tablas necesarias en PostgreSQL.

1.  Ve al **SQL Editor** en el dashboard de Supabase.
2.  Copia el contenido del archivo `docs/database_schema.sql` de este repositorio.
3.  Pega el código en el editor y haz clic en **Run**.

Esto creará la tabla `businesses` y configurará las políticas de seguridad (RLS).

## 4. Verificación y Datos de Prueba

Hemos incluído scripts automáticos para validar la conexión y cargar datos de prueba.

### Validar Conexión

Ejecuta el siguiente comando desde la carpeta `frontend/`:

```bash
# Requiere Node.js v20.6.0+
node --env-file=.env.local scripts/test-db.js
```

Si la conexión es exitosa, verás un mensaje verde. Si falla porque falta la tabla, te lo indicará.

### Cargar Datos de Prueba (Seed)

Para poblar la base de datos con negocios ficticios, ejecuta:

```bash
node --env-file=.env.local scripts/seed-db.js
```

Esto insertará 3 negocios de prueba (`Tienda Central`, `Sucursal Norte`, etc.) para que puedas probar el dashboard inmediatamente.

## 5. Solución de Problemas

*   **Error "Could not find the table"**: Significa que no ejecutaste el script SQL del paso 3.
*   **Error de credenciales**: Verifica que el `.env.local` tenga la URL y Key correctas.
