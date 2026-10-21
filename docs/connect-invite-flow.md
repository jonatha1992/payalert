# Conexión de Mercado Pago por invitación

La dueña inicia la conexión y se la delega a quien administra la app cliente, sin compartir su sesión de PayAlert. El enlace es aleatorio, de un solo uso y tiene vencimiento. El token original se muestra una única vez; la base de datos guarda su hash.

```mermaid
sequenceDiagram
    actor Duena as Dueña
    participant Huellitas
    participant Payalert as PayAlert
    participant MP as Mercado Pago

    Duena->>Payalert: Crear invitación para client_app
    Payalert-->>Duena: URL de invitación (token una sola vez)
    Duena->>Huellitas: Compartir enlace seguro
    Huellitas->>Payalert: Abrir /connect/{token}
    Payalert->>Payalert: Validar hash, vencimiento, uso y app activa
    Payalert->>Payalert: Crear OAuth state (user_id NULL, invite_id)
    Payalert-->>Huellitas: 302 a autorización OAuth
    Huellitas->>MP: Autorizar la cuenta
    MP-->>Payalert: Callback con code y state
    Payalert->>Payalert: Validar y consumir state; validar invitación
    Payalert->>MP: Intercambiar code por tokens
    MP-->>Payalert: Tokens OAuth
    Payalert->>Payalert: Guardar conexión y vincular solo la app invitada
    Payalert->>Payalert: Marcar invitación usada y auditar
    Payalert-->>Huellitas: 302 a connect_return_url?mp=connected
```

El callback redirige solo al origen exacto permitido en `client_apps.allowed_origins`. Si el intercambio OAuth falla, la invitación sigue sin usar; el state sí se consume y se crea uno nuevo al volver a abrir el mismo enlace. El callback vuelve con `mp=failed` cuando la URL de retorno es válida; si no lo es, vuelve al dashboard de PayAlert.

La invitación no concede acceso al dashboard ni modifica otras apps. La conexión se asocia únicamente al `client_app_id` de la invitación y al mismo negocio.
