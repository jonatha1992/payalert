# Decisiones

## PAY-42: Asignación de roles en administración

La tabla `users` tiene una única columna `role`, por lo que una persona no puede ser simultáneamente administradora del sistema y dueña/empleada de un negocio. La API asigna `admin` como rol global sin negocio; para usuarios de negocio escribe `owner` o `employee` junto con `business_id`, y exige sucursal para `employee`. Si se requieren roles simultáneos, deberá modelarse una asignación independiente de roles globales y de negocio antes de ampliar el flujo.
