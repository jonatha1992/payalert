# ADR-001: Evolución de PayAlert frente a PayWatch

- Estado: **Propuesta** (requiere aprobación explícita del dueño)
- Fecha: 2026-10-15
- Alcance: dirección de arquitectura; no autoriza una reescritura ni una migración.

## Contexto

PAY-29 señala que el PRD contempla FastAPI/PostgreSQL/Redis/Celery y Vue/Expo, mientras que el repositorio PayAlert existente utiliza Next.js/Supabase/PWA. El README y `docs/Arquitectura.md` documentan Next.js App Router, Supabase (PostgreSQL, Auth, Realtime y RLS) y PWA; `docs/Tech.md` también describe Vercel y las integraciones de pagos como fuentes de notificaciones/IPN. `docs/PLANIFICACION_DESARROLLO.md` trata Redis y colas como trabajo futuro, no como infraestructura ya implantada.

La necesidad inmediata documentada es hacer evolucionar el producto existente, evitando duplicar producto, datos, integraciones y operación antes de tener un caso de negocio. No se encontró un repositorio hermano PayWatch en `D:\Repositorio`; por tanto, no se atribuyen a PayWatch capacidades, código ni estado operativo. Se toma la comparación de stacks del ticket como descripción del PRD, no como evidencia de una implementación existente.

## Decisión (estado: Propuesta)

Proponer continuar la evolución incremental del PayAlert existente sobre Next.js/Supabase/PWA como línea base, preservando las capacidades y datos existentes y evaluando necesidades concretas antes de añadir servicios. PostgreSQL es común a ambas descripciones; Redis/Celery y Vue/Expo del PRD no justifican por sí solos una migración completa. Redis y colas pueden evaluarse como componentes puntuales cuando una carga medida o requisitos operativos lo ameriten.

Esta propuesta no aprueba replatform, migración de datos, cambio de cliente móvil ni adopción de servicios nuevos. Cualquier reescritura requiere caso de negocio, comparación de costo total y operación, plan de migración y reversión, validación de seguridad/datos y aprobación explícita del dueño.

**Supuesto explícito:** el objetivo vigente es evolucionar PayAlert y mantener continuidad funcional, en lugar de iniciar un producto separado. Confirmarlo es decisión pendiente del dueño.

## Alternativas

1. **Adoptar el stack existente gradualmente (recomendado como propuesta):** menor disrupción y reutiliza el repositorio, autenticación, esquema y despliegue documentados; se conserva la opción de separar componentes después de medir límites.
2. **Reescribir todo con FastAPI, Redis/Celery y Vue/Expo:** puede ser apropiado si necesidades demostrables lo justifican, pero implica migración, doble operación temporal, riesgo de regresiones y costo de mantenimiento. Requiere aprobación y plan antes de comenzar.
3. **Separar servicios selectivamente:** mantener Next.js/Supabase como producto y extraer procesamiento asíncrono u otros componentes cuando existan señales medibles. Evita una reescritura total, aunque añade complejidad operativa y límites de servicio que deben justificarse.

## Consecuencias

- Se favorecen cambios incrementales compatibles con la arquitectura documentada y se evita asumir que componentes futuros ya están desplegados.
- Los límites de escalabilidad no se presumen: medir latencia, volumen, errores, costos de infraestructura/API, carga de webhooks y necesidades de procesamiento antes de decidir extracción o replatform.
- Para reconsiderar la propuesta: evidencia repetida de que el stack actual no satisface requisitos de disponibilidad, rendimiento, procesamiento, seguridad o costo; necesidad validada de clientes nativos; o costo de evolución superior al de migrar, con cifras comparables.
- Antes de reconsiderar: definir métricas/umbrales con el dueño, arquitectura objetivo, alcance, inventario y migración de datos, compatibilidad de integraciones, plan de transición/reversión, estimación de costo y aprobación explícita.
- No se cambian código, infraestructura, datos, proveedor de pagos ni comportamiento de cobro mediante este ADR.

### Decisiones pendientes del dueño

- Confirmar si PayAlert existente es la línea de producto que debe evolucionar o si PayWatch es un producto separado (no se encontró evidencia local de este último).
- Aprobar o rechazar esta propuesta antes de tratarla como decisión adoptada.
- Definir objetivos de escala/costo y señales cuantitativas que dispararían evaluación de servicios separados o replatform.
- Si se considera reescritura, aprobar caso de negocio y plan de migración antes de iniciar.

## Fuentes

- Jira PAY-29: descripción de la discrepancia entre PRD y repositorio y límites de alcance.
- `README.md`, `docs/Arquitectura.md`, `docs/Tech.md`, `docs/PLANIFICACION_DESARROLLO.md`, `docs/Ingeniería de Requerimientos.md`.
- Búsqueda de solo lectura de repositorios hermanos en `D:\Repositorio`: no se localizó un directorio con nombre PayWatch.