# 05 — Límites del sistema y directivas para agentes

## No-alcance o capacidades no aprobadas

| ID | Capacidad excluida / limitación | Fuente y justificación |
|---|---|---|
| LIM-01 | Aplicación móvil nativa React Native/Expo. La PWA no equivale a app nativa. | PAY-20; no hay proyecto Expo encontrado. |
| LIM-02 | API pública versionada ni webhooks salientes a terceros. | PAY-25; endpoints actuales son API interna de aplicación y callback de proveedor. |
| LIM-03 | MODO/PCT, Interbanking y otros proveedores no presentes en conectores. | PAY-21/22; no hay conector ni documentación oficial local verificada. |
| LIM-04 | Membresía multiempresa de usuario con selector/invitaciones/múltiples roles por tenant. | PAY-23; ADR-002 propone diseño, esquema actual usa `users.business_id` singular. |
| LIM-05 | Canal de notificación email activo. Toggle/preferencia no implica entrega; decisión en `docs/DECISIONS.md`. | PAY-19; proveedor/costo no aprobados. |
| LIM-06 | Cobertura universal de transferencias entrantes a CVU/CBU. Conectores actuales cubren contratos específicos de proveedor/checkout consultable; no declarar cobertura de transferencia sin prueba externa. | PAY-11; `docs/providers/mercadopago.md`, `docs/providers/uala.md`. |
| LIM-07 | Pricing, límites de planes SaaS, trial, billing o cobro a comercios. | PAY-28; `docs/PLANES_SAAS.md` declara propuesta no validada. |
| LIM-08 | Analytics avanzada, IA, anomalías, forecasting, Excel/PDF fuera de lo que exista en rutas actuales. | PAY-24/27; código verificado exporta CSV; PRD 23/43 no disponible. |
| LIM-09 | Scraping de home banking, captura de credenciales bancarias ajenas, o movimiento de fondos. | PAY-11/21/22/26; fuera de límites y riesgo. |
| LIM-10 | Garantía de despliegue, SLA/latencia objetivo, rate limit distribuido, seguridad operacional de staging/prod sin evidencia de ambiente. | PAY-8/9/10/12/14; tickets y código no demuestran configuración productiva. |
| LIM-11 | Replatform PayWatch/FastAPI/Redis/Celery/Vue como arquitectura aprobada. | PAY-29; ADR-001 es análisis/propuesta, no orden de reescritura. |
| LIM-12 | Administración integral de negocio, invitación y roles conforme docs antiguos. Solo considerar operativa la ruta/pantalla localizada y RBAC comprobable. | `docs/API_Documentation.md` describe endpoints ausentes; comparar [00](00-descripcion-global.md). |

## Guardrails para agentes de desarrollo y operaciones

1. No implementar LIM-* por aparecer en un documento/plan/ticket; requerir decisión explícita enlazada.
2. No inferir endpoints de PRD, ejemplos de API antiguos ni valores de proveedor; verificar rutas/código y contrato oficial vigente.
3. Tratar input de cliente como dato no confiable. En consultas con service role, filtrar explícitamente tenant/sucursal.
4. Nunca devolver/loggear credenciales, firmas, raw webhook, datos personales sensibles ni mensajes de error sin sanitizar.
5. Mantener idempotencia, autoridad de importe/estado de API proveedor y unicidad de asignación (RN enlazadas en [03](03-reglas-de-negocio.md)).
6. Nunca ejecutar migraciones en staging/prod, transferencias reales, OAuth real, deploy o replay operativo sin aprobación y entorno identificado.
7. No cambiar ni borrar `payment_tokens` hasta cutover comparado/backup/reconexión aprobados; seguir `docs/STAGING.md`.
8. No habilitar rol support hasta definir identidad, tenant/alcance, auditoría y compatibilidad del tipo legacy.
9. No tratar comentarios/estado Jira como validación de staging, producción o aceptación por usuario.
10. Antes de consolidar docs, proponer y revisar el Mapa de documentos; no editar documentos existentes como parte de este paquete.
