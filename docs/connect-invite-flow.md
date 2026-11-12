# Conexión de Mercado Pago por invitación

Primero se registra la app, antes de que exista una conexión. El config JSON admite `slug`, `allowed_origins`, `deposit_default` y `connect_return_url`, además de `business_id` y `connection_id` opcionales. Sin `business_id`, el alta crea o reutiliza el negocio oculto `app:<slug>`; sin `connection_id`, deja el campo en `null`. La URL de retorno debe usar HTTPS y un origen de `allowed_origins`. El alta genera una API key (mostrar/guardar una sola vez) y, al no tener conexión, emite el enlace de invitación. La dueña lo abre y autoriza Mercado Pago desde su cuenta; la app puede crear cobros después de completarse el callback. Antes, `POST /api/v1/charges` responde `409 { "error": "connection_unavailable" }` sin llamar al proveedor. El enlace es aleatorio, de un solo uso y tiene vencimiento; la base solo guarda el hash del token.

```mermaid
sequenceDiagram
    actor Duena as Dueña
    participant Huellitas
    participant Payalert as PayAlert
    participant MP as Mercado Pago

    Admin->>Payalert: Registrar app sin conexión
    Payalert->>Payalert: Crear/reutilizar negocio oculto app:<slug>
    Payalert-->>Admin: API key una vez + URL de invitación
    Admin->>Duena: Compartir enlace seguro
    Huellitas->>Payalert: Abrir /connect/{token}
    Payalert->>Payalert: Validar hash, vencimiento, uso y app activa
    Payalert->>Payalert: Crear OAuth state (user_id NULL, invite_id)
    Payalert-->>Huellitas: 302 a autorización OAuth
    Huellitas->>MP: Autorizar la cuenta
    MP-->>Payalert: Callback con code y state
    Payalert->>Payalert: Validar y consumir state; validar invitación
    Payalert->>MP: Intercambiar code por tokens
    MP-->>Payalert: Tokens OAuth
    Payalert->>Payalert: Guardar conexión; connection_id deja de ser null
    Payalert->>Payalert: Marcar invitación usada y auditar
    Payalert-->>Huellitas: 302 a connect_return_url?mp=connected
```

El callback redirige solo al origen exacto permitido en `client_apps.allowed_origins`. Si el intercambio OAuth falla, la invitación sigue sin usar; el state sí se consume y se crea uno nuevo al volver a abrir el mismo enlace. El callback vuelve con `mp=failed` cuando la URL de retorno es válida; si no lo es, vuelve al dashboard de PayAlert.

La invitación no concede acceso al dashboard ni modifica otras apps. La conexión se asocia únicamente al `client_app_id` de la invitación y al negocio de esa app. Desde ese momento los cobros pueden crearse; consultar estado y reembolsar cobros ya existentes no requieren volver a crear una conexión.
