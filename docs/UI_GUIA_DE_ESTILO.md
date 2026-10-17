# Guía de estilo de interfaz

## Escala
- Base: 14 px desde 768 px; móvil conserva 16 px para legibilidad y controles táctiles.
- Títulos de pantalla: text-3xl (30 px móvil, 26.25 px escritorio); secciones text-xl/text-2xl; datos KPI text-2xl como máximo.
- Texto corriente: 1 rem; auxiliar text-sm o text-xs solo para metadatos.

## Espaciado y formas
- Gutter de contenido: 1.25 rem móvil y 1.5 rem escritorio.
- Padding de tarjeta: 1.25 rem móvil y 1.5 rem escritorio. Usar gap-4 por defecto; gap-6 para grupos principales.
- Radios: tarjetas entre rounded-xl y rounded-2xl; controles rounded-lg/rounded-xl.
- Sidebar: 14 rem expandido y 4 rem contraído en escritorio; en móvil funciona como drawer off-canvas con fondo y cierre por navegación o Escape.
- En layouts flex/grid de dashboard y admin, usar `min-w-0` en cada contenedor que comparte ancho; en tarjetas KPI, 1 columna en móvil, 2 en tablet y ampliar a 4 en escritorio. Tablas anchas deben desplazarse dentro de su propio contenedor `overflow-x-auto`.

## Componentes y reglas
- Mantener jerarquía de títulos, tarjetas, tablas, estados vacíos y botones compartidos entre dashboard y admin.
- Contenedores flex/grid deben permitir encogimiento (min-w-0); tablas anchas se envuelven con overflow-x-auto.
- No aplicar escalado global en móvil ni deshabilitar zoom del navegador.
- No mostrar un nombre vacío: usar first_name, email y luego un saludo neutro.
## Validación de formularios
- Usar `useFormValidation` con un esquema de `frontend/lib/validation`; mostrar el error de un campo después del blur y validar todos al enviar.
- Deshabilitar el envío si hay errores o una solicitud en curso; enviar siempre el valor normalizado que devuelve el esquema.
- Representar inputs con `FormField`, incluyendo `maxLength`, `inputMode` y `step` adecuados; enlazar errores con `aria-invalid` y `aria-describedby`.
- Los mensajes de validación se redactan en español rioplatense y los errores visuales usan los tonos rojos del sistema (`text-red-600`, `dark:text-red-400`, `border-red-500`).
