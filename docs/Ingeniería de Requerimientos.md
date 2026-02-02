# **Documento de Ingeniería de Requerimientos: PayAlert SaaS**

## **1\. Objetivo del Sistema**

Desarrollar una plataforma SaaS multi-inquilino para la gestión de flujo de caja mediante IPN y registro de gastos, con un sistema de permisos basado en roles.

## **2\. Requerimientos Funcionales (Actualizado)**

### **RF1: Gestión de Roles y Permisos**

* **Rol Dueño:** Acceso total. Gestión de tokens, creación de tiendas, visualización de balances totales y gestión de empleados.  
* **Rol Empleado:** Acceso limitado. Visualización de ingresos en tiempo real de su tienda asignada y registro de gastos manuales. No puede ver configuraciones sensibles.

### **RF2: Monitor de Ingresos (IPN)**

* Notificación visual y sonora para ambos roles al confirmar un pago.

### **RF3: Dashboard Diferenciado**

* El sistema debe filtrar los datos mostrados en el dashboard según el rol del usuario autenticado.

## **3\. Requerimientos No Funcionales**

* **Seguridad:** Uso de RLS (Row Level Security) para asegurar que el empleado solo vea la tienda asignada y que los tokens permanezcan invisibles para roles no administrativos.