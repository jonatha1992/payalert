# Análisis funcional de PayAlert → PayWatch

**Estado del documento:** Borrador basado en fuentes del repositorio/código y tickets disponibles. No aprobado por Producto. La propuesta PayAlert vs PayWatch del ADR continúa pendiente de aprobación.

## Orden de lectura

| Orden | Documento | Contenido |
|---:|---|---|
| 1 | [00-descripcion-global.md](00-descripcion-global.md) | Propósito, alcance, glosario y mapa de documentos |
| 2 | [01-actores-y-roles.md](01-actores-y-roles.md) | Actores y matriz RBAC |
| 3 | [02-requerimientos.md](02-requerimientos.md) | RF/RNF verificables |
| 4 | [03-reglas-de-negocio.md](03-reglas-de-negocio.md) | Invariantes y restricciones |
| 5 | [04-diagramas.md](04-diagramas.md) | Catálogo UML, fuentes/PNG y limitaciones visuales |
| 6 | [PN1-conexiones-y-salud.md](PN1-conexiones-y-salud.md) | Conexión de cuentas y diagnóstico |
| 7 | [PN2-pagos-entrantes.md](PN2-pagos-entrantes.md) | Webhooks, cola, ingestión y aviso |
| 8 | [PN3-cobros-esperados.md](PN3-cobros-esperados.md) | Creación, matching y resolución en caja |
| 9 | [PN4-reportes-y-movimientos.md](PN4-reportes-y-movimientos.md) | Dashboard, movimientos, reportes y exportación |
| 10 | [PN5-notificaciones.md](PN5-notificaciones.md) | Push y preferencias |
| 11 | [PN6-administracion-y-auditoria.md](PN6-administracion-y-auditoria.md) | Administración, permisos y auditoría |
| 12 | [05-limites-del-sistema.md](05-limites-del-sistema.md) | No-alcance y guardrails para agentes |
| 13 | [06-trazabilidad.md](06-trazabilidad.md) | RF ↔ CU ↔ pantallas/rutas ↔ código/tests/tickets; estado único |
| 14 | [07-redundancias-y-viabilidad.md](07-redundancias-y-viabilidad.md) | Duplicaciones de código, documentos y viabilidad PAY-7..29 |
| 15 | [99-pendientes.md](99-pendientes.md) | Lista consolidada de decisiones e inferencias pendientes |

## Referencias operativas relacionadas

- [Runbook de cola de webhooks](../WEBHOOKS_QUEUE.md): operación y diagnóstico PAY-14.
- [Guía OAuth Mercado Pago](../OAUTH_MERCADOPAGO.md): flujo OAuth específico del proveedor.
- Implementación PAY-14 y requisitos pendientes de staging: [07](07-redundancias-y-viabilidad.md) y [99](99-pendientes.md).

## Reglas para agentes

- Antes de modificar comportamiento, leer este paquete y seguir los RF/RN/CU; el código observado es evidencia de implementación, no aprobación de producto.
- No implementar capacidades de 05 ni tratar lo planificado en tickets como ya implementado.
- No adivinar payloads, importes, estados ni identidades del proveedor; consultar la fuente oficial vía conectores existentes.
- No leer credenciales desde el cliente ni exponer secretos, payloads crudos o PII en logs.
- Confirmar tenant, rol, sucursal y ownership en servidor en toda operación; el service role omite RLS.
- Mantener deduplicación/idempotencia y estados monotónicos de ingestión. No asignar un movimiento a más de un cobro esperado.
- No llamar servicios reales, aplicar migraciones, desplegar ni cambiar proveedores sin aprobación explícita y entorno validado.
- La línea evolutiva actual se propone sobre PayAlert (Next.js/Supabase). No iniciar una reescritura PayWatch sin aprobación, caso de negocio y plan de migración.
- `[Inferido]` no está confirmado; `[Pendiente]` indica evidencia/decisión faltante. Solo el dueño puede aprobar este análisis.

## Decisiones y estado de fuentes

| Tema | Estado |
|---|---|
| Evolución incremental PayAlert frente a replatform PayWatch | Propuesta en `docs/adr/ADR-001-payalert-vs-paywatch.md`, requiere aprobación |
| Membresías multiempresa por usuario | Propuesta en `docs/adr/ADR-002-multiempresa-memberships.md`; hoy no implementado |
| Planes y billing | Propuesta sin precios/quotas aprobadas en `docs/PLANES_SAAS.md` |
| Nivel de implementación | La matriz de `06-trazabilidad.md` diferencia código visible, tarea Jira y validación externa/de despliegue; no equivale a aceptación de producción |

## Convención de IDs

Este paquete usa `RF-XX`, `RNF-XX`, `RN-XX`, `CU-XX` globales. `PN1`…`PN6` nombran procesos. El estado de RF/RNF se declara **solo** en trazabilidad: ✅ implementado en código observado; 🟡 parcial, dependiente de despliegue/validación o con brecha; ⬜ no implementado/pendiente. Un ticket Jira no es prueba de código ni de aceptación externa.
