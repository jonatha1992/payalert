# PN1 — Conexiones de cuentas de cobro y salud

## CU-01 — Conectar o desconectar cuenta

- **Actores:** ACT-01 dueño; ACT-02 manager donde la ruta lo permita; EXT-01 Mercado Pago / EXT-02 Ualá Bis. Véase [01](01-actores-y-roles.md).
- **Precondiciones:** sesión válida; conexión operable y proveedor configurado; negocio/sucursal resueltos según RN-01/02; secreto disponible únicamente en servidor.
- **Flujo principal:**
  1. Actor abre `/dashboard/integrations` (pantalla verificada `frontend/app/dashboard/integrations/page.tsx`).
  2. El cliente solicita listar conexiones mediante `GET /api/integrations`.
  3. El servidor comprueba permiso y ámbito; entrega datos de vista sin credenciales.
  4. Para MP OAuth, el usuario inicia `GET /api/integrations/mercadopago`; el servidor crea state ligado a sesión/tenant y redirige al proveedor.
  5. El callback intercambia autorización, valida state/tenant y guarda credenciales cifradas; UI indica conexión.
  6. Alternativamente, se crea conexión por API si el conector/credencial está soportado y el formulario lo permite.
  7. Al desconectar, servidor elimina/inhabilita credenciales y deja de enrutar eventos.
- **Alternativos:** A1 state expirado/consumido → no guardar y mostrar error seguro. A2 cuenta duplicada en otro negocio → rechazar. A3 proveedor no disponible/credencial inválida → conservar conexión en estado seguro, no exponer secreto. A4 usuario sin permiso/tenant → 401/403; no escribir.
- **Postcondición:** conexión queda registrada/actualizada o desconectada; logs/auditoría omiten secretos. Estado sigue RN-09.
- **Cumple:** RF-02, RF-03; RN-01, RN-02, RN-08, RN-12.
- **Relaciones UML:** «include» CU-02 cuando el actor solicita diagnosticar; OAuth solo aplica a MP. No usar «extend» para describir opción de proveedor: es variante de flujo.

## CU-02 — Consultar y diagnosticar salud de conexión

- **Actores:** ACT-01; ACT-02 si permitido; EXT-01/EXT-02.
- **Precondiciones:** conexión pertenece al tenant resuelto y no está desconectada; permiso connection:read.
- **Flujo principal:**
  1. Actor acciona diagnóstico en Integraciones.
  2. UI llama `GET /api/integrations/{id}/health`.
  3. Servidor valida sesión, permiso, tenant y pertenencia de conexión.
  4. Conector ejecuta `healthCheck` contra API del proveedor.
  5. El servidor normaliza resultado, actualiza timestamps/estado/diagnóstico permitido, sin credenciales.
  6. La UI muestra resultado, estado y última verificación.
- **Alternativos:** credencial rechazada → requiere reautorización; indisponibilidad temporal → degradada; error no clasificado → respuesta segura; tenant distinto → denegado.
- **Postcondición:** consulta registrada; representación de estado se rige por RN-09.
- **Cumple:** RF-04; RN-01, RN-02, RN-09, RN-20.
- **Relaciones UML:** CU-01 «include» CU-02 solo si el flujo de conexión solicita health-check; consulta independiente de lo contrario.

### Evidencia
`frontend/app/dashboard/integrations/page.tsx`, `frontend/app/api/integrations/route.ts`, `frontend/app/api/integrations/[id]/route.ts`, `frontend/app/api/integrations/[id]/health/route.ts`, `frontend/app/api/integrations/mercadopago/route.ts`, `frontend/lib/server/connections.ts`, `frontend/lib/payments/connectionHealth.ts`, pruebas `frontend/tests/payments/connectionHealth.test.ts` y `frontend/tests/payments/mercadopagoOAuth.test.ts`.
