# HU-032 — Priorizar el idioma del visitante

## Contexto

La home y `/buscar` muestran cursos en cualquier idioma sin ningún criterio que
tenga en cuenta al visitante. Con catálogo mayoritariamente en inglés, alguien que
busca en español ve sobre todo cursos que no entiende antes que los pocos que sí.

**Decisión de detección: cabecera `Accept-Language`, no IP.** Es la señal que el
propio protocolo HTTP define para esto exactamente (RFC 9110 §12.5.4): el
navegador ya la manda en cada petición, refleja lo que la persona configuró de
verdad (idioma del sistema/navegador), y no hace falta ni guardar su IP ni
depender de un servicio externo de geolocalización — que además acertaría peor:
alguien en España con el navegador en inglés probablemente quiere cursos en
inglés, no en español porque la IP resuelva a Madrid. Coherente con el resto del
proyecto: sin servicios externos nuevos, sin dato personal nuevo que manejar.

**No es un filtro, es una prioridad.** Los cursos en otro idioma siguen apareciendo
— solo después. Filtrar de verdad ya existe (`language` en `CourseSearchFilters`,
un campo de texto en el buscador) y es una elección explícita de quien busca; esto
es un orden implícito por defecto, y desaparece en cuanto alguien pide un orden
explícito (precio o valoración), igual que ya le pasa al reparto equilibrado entre
plataformas de HU-007 — quien pide un orden ha pedido justo ese orden.

## Como visitante quiero ver antes los cursos en mi idioma, sin dejar de ver los demás

## Criterios de aceptación

- **Given** un visitante cuyo navegador prefiere español **When** entra en la home o
  en `/buscar` sin pedir un orden concreto **Then** los cursos en español de cada
  plataforma aparecen antes que los de otros idiomas, sin desaparecer estos últimos
- **Given** un visitante sin cabecera `Accept-Language` reconocible **When** entra
  **Then** ve el mismo orden de siempre (reparto equilibrado, sin priorizar nada)
- **Given** que se pide un orden explícito (precio o valoración) **When** se aplica
  **Then** manda ese orden tal cual, sin que el idioma lo altere — igual criterio
  que ya tiene el reparto equilibrado entre plataformas (HU-007/HU-027)
- **Given** una cabecera `Accept-Language` con varios idiomas y valores `q`
  **When** se interpreta **Then** se respeta cuál prefiere más la persona, no el
  primero que aparece en la cabecera

## Fuera de alcance

- Detectar el idioma por IP/geolocalización: descartado, ver "Contexto".
- Traducir contenido o interfaz: esto solo reordena cursos que ya existen en el
  idioma que sea.
- Guardar la preferencia de idioma en una cuenta o cookie: se recalcula en cada
  visita desde la cabecera, sin estado que mantener.
- Tocar el filtro de idioma explícito que ya existe en `/buscar`.

## Cuidados

- La cabecera la manda el visitante: es entrada externa. Se sanea a un código de
  dos letras con una expresión regular antes de usarla para nada — nunca entra en
  una cadena de consulta a PostgREST, solo se compara en memoria contra
  `course.language` después de traer los datos, así que no hay ninguna superficie
  de inyección nueva.
- No debe vaciar ni desequilibrar página alguna: el criterio de HU-025 sobre
  paginación estable (mismo resultado si se recalcula desde cero) se mantiene, es
  una reordenación pura sobre lo ya traído, no una consulta incremental nueva.

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: interpretación de `Accept-Language` (varios idiomas, `q`,
      mayúsculas, regiones/scripts, cabecera ausente o rara, intentos de inyección)
      — `preferred-language.test.ts`
- [x] Unitarios: la priorización reordena sin descartar ni reordenar dentro de cada
      grupo — `search-courses.test.ts`
- [x] Integración: `searchCourses` con un idioma preferido, contra datos reales de
      prueba, incluido el caso límite de la costura entre páginas —
      `tests/integration/priorizar-idioma.test.ts`
- [x] E2E: la home y `/buscar` muestran antes los cursos del idioma pedido; sin
      cabecera reconocible no se pierde ninguno; con orden explícito, no cambia
      nada — `e2e/priorizar-idioma.spec.ts`
- [x] `/security-review` sin hallazgos críticos ni altos

## Estado

**Cerrada.**

- Unitarios: 402 pasan.
- Integración: 5 pasan (incluido el test de regresión de más abajo).
- E2E: 107 pasan (2 fallos intermitentes ajenos, ya conocidos: la carga
  compartida del entorno de dev — ver más abajo).
- Revisión de seguridad: sin hallazgos.

## El diseño que se descartó, y por qué

La primera versión reordenaba cada fuente **antes** de intercalar/paginar, para
que el reparto equilibrado entre plataformas (HU-007) quedara intacto y solo
cambiara qué iba primero dentro de cada una. Parecía la solución más limpia y
pasó los tests unitarios y el primer test de integración — pero tenía un fallo
real de paginación: el curso "de más" que se trae solo para saber si hay página
siguiente (nunca se muestra) podía ser del idioma preferido, colarse delante por
la reordenación, y empujar fuera de la página 1 a un curso que sí tocaba
mostrar. Ese curso desaparecía sin más: la página 2 sigue desde el corte real de
la consulta sin priorizar, no desde donde el reordenado lo hubiera dejado. Se
detectó porque rompió un test **ajeno** (`paginacion.spec.ts`, HU-025) al correr
la suite completa, no por un test propio de esta historia — hasta que se
construyó a propósito un caso que lo reprodujera de forma determinista (ver
`tests/integration/priorizar-idioma.test.ts`, el describe "el curso 'de más'
nunca se cuela en la página 1").

La solución que se quedó reordena el array **ya paginado**, después de que
`paginarIntercalado` haya decidido qué cursos tocan en esa página. Así es
estructuralmente imposible que la priorización cambie qué se muestra, solo el
orden en que se ve — nunca puede romper el "sin repetir, sin saltarse ninguno"
de HU-025, sea cual sea la forma del catálogo.

## Un detalle de Playwright que costó encontrar

Los primeros e2e controlaban el idioma con `extraHTTPHeaders: { "Accept-Language": "es" }`
y fallaban en el orden aunque la lógica del servidor era correcta (comprobado
con una petición `fetch` directa, sin navegador, que sí daba el orden esperado).
`extraHTTPHeaders` no fuerza de forma fiable esa cabecera en la propia
navegación de Chromium; la forma documentada por Playwright para esto es la
opción `locale` del contexto (`browser.newContext({ locale: "es-ES" })`), que sí
la controla también para la petición de navegación.

## Deuda que sigue abierta

- Con el catálogo actual, la mayoría de cursos son "en": la home puede mostrar
  pocos o ningún curso "es" entre los primeros doce si el catálogo real todavía
  no tiene suficientes para ese idioma — no es un fallo, es un reflejo honesto
  de qué hay.
- No se ha medido el efecto en el reparto equilibrado entre plataformas
  (HU-007) cuando una plataforma tiene muchos más cursos del idioma preferido
  que la otra: la página 1 puede temporalmente inclinarse hacia esa plataforma.
  Es una consecuencia esperada del pedido de esta historia (priorizar idioma
  importa más que el reparto en la primera pantalla), pero convendría vigilarlo
  si algún día se nota demasiado.
