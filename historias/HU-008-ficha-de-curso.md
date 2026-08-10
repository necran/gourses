# HU-008 — Ficha de curso

## Contexto

Fase 1. Página de detalle a la que se llega desde un resultado del buscador (`HU-007`). Es también la base visual que reutilizará el comparador en Fase 2.

## Como visitante quiero ver el detalle completo de un curso para decidir si me interesa antes de ir a comprarlo a la plataforma original

## Criterios de aceptación

- **Given** un resultado de búsqueda **When** hago clic en un curso **Then** llego a su ficha con título, descripción completa, precio, valoración, nivel, idioma, instructor, fuente e imagen.
- **Given** la ficha de un curso **When** reviso el botón de acción principal **Then** enlaza a `affiliate_url` (el enlace de afiliado de la fuente correspondiente, Udemy o Coursera) y no a la URL genérica del curso.
- **Given** un curso cuyo precio bajó respecto a una ingesta anterior **When** veo la ficha **Then** se muestra el precio anterior tachado junto al nuevo, usando `course_price_history`.
- **Given** una URL de ficha con un identificador de curso que no existe **When** se visita **Then** se muestra una página de "curso no encontrado", no un error sin manejar.

## Fuera de alcance

Guardar como favorito o comparar desde la ficha — llegan en Fase 2 y 3, aunque el diseño de la ficha puede dejar hueco visual para esos botones.

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: función que decide si mostrar precio anterior tachado (según si hay bajada real en el histórico) (`src/lib/courses/price-display.test.ts`)
- [x] Integración: la ruta de ficha devuelve los datos completos de un curso real de test, incluyendo su histórico de precio (`tests/integration/course-detail.test.ts`)
- [x] E2E: un test por criterio de aceptación (`e2e/curso.spec.ts`) — navegación desde el buscador con todos los campos, botón a la URL de afiliado, bajada de precio tachada, y ficha inexistente/malformada con "no encontrado"
- [x] `/security-review`: sin hallazgos — el id se valida contra un UUID anclado antes de tocar la base de datos, y llega a `.eq()` como parámetro, no concatenado a un filtro

## Notas de implementación

- Ruta `/curso/[id]`, server component que lee vía Supabase/anon respetando la RLS pública de `HU-004`. El identificador se valida contra un UUID anclado **antes** de consultar: un id con otra forma se trata como "no existe" y no llega a la base de datos.
- **Precio anterior tachado solo si hubo bajada real** (`src/lib/courses/price-display.ts`): si el precio subió o no cambió no se tacha nada, porque tachar un importe menor que el actual sugeriría una oferta inexistente. Tampoco se comparan monedas distintas: 20 USD frente a 20 EUR no es una rebaja.
- **`safeExternalUrl`**: `affiliate_url` viene de las APIs externas y acaba en el `href` del botón principal, que sí es un sink peligroso (a diferencia del `src` de una imagen). Se restringe a `http`/`https`, de modo que un `javascript:` guardado en base de datos nunca llegaría a ejecutarse. El enlace sale con `target="_blank"` y `rel="noopener noreferrer nofollow sponsored"`.
- Los cursos sin precio (los de Coursera) muestran "Precio no disponible en esta plataforma" en lugar de un hueco vacío.
- Los resultados del buscador enlazan ahora a la ficha, que era el punto de entrada que faltaba de `HU-007`.

### Corregido de camino

Los tests de integración contra las APIs reales fallaban 1 de cada 5 veces: encadenan varias llamadas de red y se pasaban del timeout por defecto de 5s, y al quedar trabajo en vuelo contaminaban el test siguiente (de ahí que el fallo apareciera a veces en un test distinto del que lo causaba). Se les da un presupuesto acorde a lo que hacen; verificado con 6 ejecuciones seguidas en verde.

## Pendiente (no bloquea esta historia)

El botón principal enlaza a `affiliate_url`, que hoy contiene la URL directa del curso en ambas fuentes, **no un enlace de afiliado real** — es decir, todavía no genera comisión. Falta confirmar el formato de tracking de Impact (Coursera) y el de Udemy; cuando se sepa, basta con cambiar ese valor en la ingesta, sin tocar la ficha.

## Estado

Cerrada.
