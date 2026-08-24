# HU-027 — Ordenar los resultados

## Contexto

El sitio se llama comparador y el buscador no deja ordenar por nada. El orden lo decide
la casa: dentro de cada plataforma por valoración, y luego se alternan las dos
(`interleaveBySource`). Eso está bien como reparto por defecto —evita que Coursera, que
no publica valoraciones, quede fuera de la primera página— pero es lo contrario de lo que
pide quien entra con una idea concreta: «enséñame lo más barato» o «enséñame lo mejor
valorado».

Con 8.796 cursos y ya paginados (HU-025), no poder ordenar significa que para encontrar
el curso barato hay que recorrer páginas mirando precios a ojo.

## El conflicto que hay que resolver, no esquivar

Alternar plataformas y ordenar por precio **son incompatibles**. Si se intercalan
—uno de Udemy, uno de Coursera, uno de Udemy…— el resultado no está ordenado por precio
por mucho que cada mitad lo esté. Y si se ordena de verdad, los 4.000 cursos de Coursera,
que no tienen precio, van todos al final.

Se resuelve así: **el reparto equilibrado es el orden por defecto y sigue siendo el que
se ve al entrar**; en cuanto alguien elige un orden concreto, manda lo que ha pedido, y
Coursera cae al final porque no tiene ese dato. Es honesto: ha pedido ordenar por precio
y son cursos sin precio. No se inventa un valor para colocarlos.

## Como visitante quiero ordenar los resultados por precio o por valoración para encontrar lo que busco sin ir mirando página por página

## Criterios de aceptación

- **Given** el buscador **When** lo abro **Then** puedo elegir cómo ordenar los
  resultados

- **Given** que elijo «precio: de menor a mayor» **When** miro la lista **Then** los
  precios no bajan según voy hacia abajo

- **Given** que elijo «mejor valorados» **When** miro la lista **Then** las
  valoraciones no suben según voy hacia abajo

- **Given** un orden elegido **When** paso a la página siguiente **Then** el orden se
  mantiene, también entre el final de una página y el principio de la otra

- **Given** un orden elegido **When** comparto la dirección **Then** se abre con ese
  mismo orden

- **Given** un orden inventado en la dirección **When** la abro **Then** veo resultados
  con el orden por defecto, en vez de un error

- **Given** el orden por defecto **When** miro la lista **Then** siguen apareciendo las
  dos plataformas, como hasta ahora

## Fuera de alcance

- Ordenar por duración, por novedad o por popularidad.
- Cambiar el orden por defecto: sigue siendo el reparto equilibrado entre plataformas.
- Inventar precios o valoraciones para los cursos que no los publican.

## Cuidados

- Sin JavaScript de cliente: el buscador va con formularios y enlaces (HU-007, HU-025).
- El orden tiene que viajar en la dirección, como el resto de filtros.
- El desempate por `id` sigue siendo obligatorio: ordenar por precio deja miles de
  empates, y sin un criterio único la página 2 repetiría cursos de la 1 (HU-025).
- Los cursos sin el dato por el que se ordena van al final, nunca al principio: un
  hueco no es un cero.

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: saneado del orden (inventado, vacío, repetido)
- [x] Integración: cada orden devuelve la lista efectivamente ordenada, y dos páginas
      seguidas no se solapan ni rompen el orden en la costura
- [x] E2E: un test por cada criterio de aceptación de arriba
- [x] `/security-review` sin hallazgos críticos ni altos

## Estado

`Cerrada`

Unitarios (11 nuevos), integración (7) y e2e (7, uno por criterio). Suites completas en
verde: 334 unitarios, 88 de integración, 88 e2e. `/security-review` sin hallazgos.

## Lo que costó de verdad

**Dos caminos de consulta, un solo sitio para los filtros.** Ordenar exige una consulta
global; el reparto equilibrado exige una por fuente. Son incompatibles, así que conviven
los dos. El riesgo no es el orden: es que un filtro se aplique en un camino y no en el
otro, y entonces elegir «precio: de menor a mayor» devuelva cursos que no cumplen lo que
se pidió. Por eso los filtros salieron a `aplicarFiltros`, compartido por los dos, y hay
un test de integración que lo fija («el orden se combina con los filtros, no los
sustituye»).

**La costura entre páginas.** Cada página puede estar perfectamente ordenada por dentro y
aun así el primero de la página 2 ser más barato que el último de la página 1. Se
comprueba concatenando las dos y verificando el orden sobre la lista entera, no página a
página. Igual en el test de integración y en el e2e.

**Que las aserciones discriminen.** Comprobado a propósito: con el orden por defecto la
lista **no** sale ordenada por precio. Si lo estuviera, un `expect` de «va ordenada»
pasaría siempre y no probaría nada.

## Deuda que sigue abierta

- El buscador no dice cuántos resultados hay en total, solo si hay más.
- No se puede ordenar por duración ni por novedad.
- Ordenar por precio deja los 4.000 cursos de Coursera al final, siempre. Es correcto
  —no tienen precio— pero significa que ese orden es, en la práctica, un orden de Udemy.
