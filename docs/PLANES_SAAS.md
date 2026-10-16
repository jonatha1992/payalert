# PAY-28 — Planes SaaS, límites y modelo de suscripción

**Estado:** propuesta de producto para revisión del dueño; no aprobada para cobro ni implementación de billing. No se fijan precios ni límites definitivos en ausencia de evidencia de costos y decisión comercial.

## Contexto y alcance

El ticket PAY-28 refiere a niveles Basic/Comercio/Propuestos en el PRD, sin precios validados. La documentación del repositorio describe PayAlert como SaaS multi-tenant, con negocios/tiendas, roles dueño/empleado, aislamiento RLS, conexiones de proveedores de pago y funcionalidades previstas de reportes/exportación. No define un catálogo comercial validado, cuotas de planes, trial ni política de cancelación.

Este documento propone un marco para validar segmento, costos de APIs y soporte, límites y medición. No integra pasarela de suscripción, no inicia cobros, no mueve fondos de clientes y no modifica código. Los valores cuantitativos quedan explícitamente como decisión pendiente, no como límites actuales.

## Planes candidatos y límites

Los nombres siguientes son etiquetas de trabajo compatibles con el ticket, no una decisión de naming. Cada celda «por definir» debe convertirse en un valor aprobado antes de comunicar o aplicar un límite. Las diferencias sugeridas son hipótesis para validar, no compromisos comerciales.

| Dimensión | Basic (candidato) | Comercio (candidato) | Pro (candidato) | Estado / criterio para definir |
|---|---|---|---|---|
| Comercios por cuenta | Por definir | Por definir | Por definir | **Decisión pendiente del dueño.** Validar si cuenta y comercio son entidades distintas y segmento objetivo. |
| Sucursales por comercio | Por definir | Por definir | Por definir | **Decisión pendiente del dueño.** La documentación contempla tiendas/sucursales; medir casos de uso. |
| Usuarios por cuenta/comercio | Por definir | Por definir | Por definir | **Decisión pendiente del dueño.** Costos de soporte, roles y seguridad; aclarar unidad de asignación. |
| Conexiones de proveedores | Por definir | Por definir | Por definir | **Decisión pendiente del dueño.** Definir si se cuenta proveedor, cuenta conectada o credencial activa y considerar costo/API. |
| Retención de historial | Por definir | Por definir | Por definir | **Decisión pendiente del dueño.** Definir por tipo de dato, obligaciones legales, respaldo y costo de almacenamiento. |
| Exportaciones | Por definir | Por definir | Por definir | **Decisión pendiente del dueño.** Aclarar formatos, frecuencia/volumen y si la función varía por plan. |

### Propuesta de segmentación (a validar)

- **Basic:** adopción por un negocio pequeño con necesidades esenciales; límites moderados para contener soporte y costos.
- **Comercio:** negocio con más de una sucursal, más usuarios o mayor necesidad de reportes; capacidad superior a Basic.
- **Pro:** operación de mayor complejidad o volumen que requiera límites y soporte superiores, sujeto a validar disposición a pagar y costo de servicio.

No se asignan cantidades, moneda, precios ni garantía de disponibilidad a estos segmentos. El orden relativo es una hipótesis para investigación; debe validarse con usuarios, costos y posicionamiento.

## Modelo de suscripción candidato

Proponer una suscripción recurrente por cuenta/organización con asignación de plan y período de facturación visible al cliente. Evaluar mensual como opción inicial por simplicidad de prueba y eventual anual solo si se valida demanda; no queda fijada frecuencia, período de prueba, renovación ni precio.

El modelo comercial debe distinguir la suscripción de PayAlert del procesamiento de cobros de los comercios: PayAlert no custodiará ni moverá fondos del cliente en el alcance de este documento. No seleccionar ni integrar pasarela hasta que el dueño apruebe proveedor, costos, flujo de alta/cancelación, tratamiento fiscal y revisión legal. El mecanismo de entitlement (qué se permite por plan) y su fuente de verdad también requiere decisión y diseño posterior.

### Qué se mide antes de fijar límites y precio

- Costos variables y fijos por cuenta: infraestructura/almacenamiento, invocaciones, notificaciones, tráfico, y APIs de proveedores cuando apliquen; registrar unidad, período y fuente.
- Soporte y operación: incidencias, tiempo de atención y costo asociado por segmento.
- Uso por cuenta y período: comercios/sucursales activos, usuarios activos, conexiones activas, eventos/webhooks procesados, datos retenidos y exportaciones ejecutadas/volumen.
- Calidad: latencia, fallos de integración, entregabilidad de notificaciones y disponibilidad observada; definir umbrales antes de usarlos como condición de plan.
- Conversión y retención de cohortes, activación, cancelaciones y motivos, con minimización de datos personales.
- Costos de facturación/impuestos y requisitos legales según jurisdicción, antes de aprobar precio o cobro.

Definir período de medición, métricas, responsables, privacidad y umbrales con el dueño; no se presume telemetría existente para cada métrica.

## Decisiones pendientes del dueño

1. Validar segmentos, nombres de planes y si el modelo será por cuenta, comercio, usuario o combinación; recomendación: probar primero el modelo por cuenta con límites transparentes por recurso, evitando cobrar por eventos de pago hasta conocer su costo y efectos.
2. Aprobar valores concretos para las seis dimensiones de la tabla tras obtener distribución de uso, costos de infraestructura/API/soporte y casos de clientes; recomendación: no publicar cuotas antes de esa medición.
3. Definir precio, moneda, impuestos, frecuencia, período de prueba, renovación, gracia por fallo de pago, cancelación, reembolsos y tratamiento de datos al terminar; todas estas decisiones están pendientes.
4. Definir qué ocurre al superar límites (aviso, bloqueo, compra de capacidad o cambio de plan), si habrá excepciones/contratos y cómo prevenir interrupciones inesperadas; recomendación: avisar antes de un bloqueo y no eliminar datos por exceder una cuota.
5. Aprobar proveedor y términos de billing tras revisión de costo, seguridad y legal; decidir mecanismo de entitlements y proceso de conciliación antes de cualquier integración.
6. Determinar obligaciones de retención/exportación y plazos de eliminación por tipo de dato y jurisdicción, con asesoría legal cuando corresponda.

## Criterio de salida a implementación

No implementar cobros ni enforcement de cuotas hasta que el dueño apruebe por escrito: segmentación y planes, unidades y límites, precio/moneda/frecuencia, trial y cancelación, manejo de exceso/fallo de pago, proveedor de billing, entitlements, medición/privacidad y revisión legal. La futura implementación debe tratarse como cambio separado y verificarse con casos de expiración, cancelación, cambio de plan, excedentes y acceso a datos.

## Fuentes

- Jira PAY-28: niveles Basic/Comercio/Pro sin precios validados; solicita validar segmento, cuentas/usuarios/sucursales, costo de APIs/soporte, trial, cancelación y métricas; billing requiere decisión comercial y revisión legal.
- `README.md`, `docs/Arquitectura.md`, `docs/Tech.md`, `docs/PLANIFICACION_DESARROLLO.md`, `docs/Ingeniería de Requerimientos.md`.
- Supuestos de segmentación y suscripción indicados como candidatos; no se presentan como capacidades o decisiones existentes.