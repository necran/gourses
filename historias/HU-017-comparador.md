# HU-017 — Comparador de cursos

## Contexto

Fase 2, y la funcionalidad que da nombre al producto. Hasta ahora el sitio **agrega** cursos y permite buscarlos, pero comparar dos opciones obliga a abrir dos fichas y recordar los datos de una mientras se lee la otra.

La ficha de `HU-008` se diseñó explícitamente pensando en reutilizar aquí su presentación de datos, y el esquema común de `HU-004` existe justamente para que cursos de plataformas distintas puedan ponerse uno al lado del otro sin que el usuario note la diferencia de origen.

Decisión de diseño coherente con el resto del sitio: **la selección viaja en la URL**, no en estado del navegador. El buscador ya funciona con un formulario GET sin JavaScript de cliente, y mantener ese enfoque da tres cosas gratis: la comparación se puede compartir por enlace, funciona sin JavaScript, y no hay estado que se pierda al recargar.

## Como visitante quiero ver varios cursos enfrentados campo a campo para decidir cuál me conviene sin ir abriendo fichas de una en una

## Criterios de aceptación

- **Given** resultados de búsqueda **When** selecciono varios cursos y confirmo **Then** llego a una vista donde aparecen enfrentados, con los mismos campos alineados para poder compararlos.
- **Given** una comparación de cursos de plataformas distintas **When** la veo **Then** los campos se presentan igual para todos, y la plataforma de cada uno es visible.
- **Given** una comparación **When** copio la dirección y la abro de nuevo **Then** obtengo exactamente la misma comparación.
- **Given** que selecciono menos de dos cursos **When** confirmo **Then** se me explica que hacen falta al menos dos, en vez de mostrar una vista vacía.
- **Given** una dirección de comparación con identificadores inexistentes o mal formados **When** la abro **Then** se ignoran esos y se comparan los válidos, sin errores; si no queda ninguno, se explica.
- **Given** un curso en la comparación **When** quiero saber más **Then** puedo ir a su ficha y también a la plataforma de origen.

## Fuera de alcance

- Guardar comparaciones o favoritos: requiere cuentas, que son la Fase 3.
- Recomendar cuál es "mejor": el sitio muestra datos y deja decidir. Puntuar cursos con un criterio propio sería opinión disfrazada de dato, y además chocaría con la neutralidad que declara la página de afiliación.
- Comparar más de un puñado de cursos a la vez: por encima de cuatro la vista deja de leerse en una pantalla y compararla ya no ayuda.
- Gráficas o visualizaciones.

## Cuidados

- **Los huecos deben verse como huecos.** Los cursos de Coursera no tienen precio ni valoración; la comparación debe mostrar "no disponible" y no un cero ni un guion ambiguo que se pueda leer como "gratis" o "valoración pésima".
- Los identificadores llegan por la URL, así que son entrada externa: se validan antes de tocar la base de datos, como en `HU-008`.
- La divulgación de afiliación debe estar también aquí, junto a los enlaces de salida, por el mismo motivo que en la ficha.

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: saneado de los identificadores de la URL — duplicados, mayúsculas, inválidos, exceso sobre el máximo, ninguno e intentos de inyección (`src/lib/courses/compare.test.ts`)
- [x] Unitarios: construcción de las filas, incluidos los campos que un curso tiene y otro no, y omisión de filas que nadie puede rellenar
- [x] Integración: recupera varios cursos reales, respeta el orden pedido e ignora los inexistentes (`tests/integration/comparar.test.ts`)
- [x] E2E: un test por criterio (`e2e/comparar.spec.ts`)
- [x] `/security-review`: sin hallazgos

## Notas de implementación

- **Sin JavaScript de cliente.** Las casillas van en un formulario GET aparte del de filtros (no se pueden anidar) que envía a `/comparar`. Eso da tres cosas de golpe: la comparación se puede compartir por enlace, sobrevive a una recarga y funciona sin JavaScript — coherente con cómo ya funcionaba el buscador.
- **Los huecos se muestran como "No disponible"**, en cursiva y gris, nunca como `0` ni `—`. Un cero en la fila de precio se leería como "gratis" y en la de valoración como "malísimo"; ambas lecturas serían falsas.
- Una fila que **ningún** curso puede rellenar se omite entera: solo añadiría ruido a una tabla que existe para leerse de un vistazo.
- El orden de las columnas es el que pidió el usuario, no el que devuelva la base de datos. `getCoursesByIds` reordena expresamente.
- La página se marca `noindex`: las comparaciones son combinaciones infinitas de cursos que no aportan nada al índice y diluirían las fichas, que sí importan para el tráfico (`HU-016`).
- La divulgación de afiliación se repite aquí junto a los enlaces de salida, por el mismo motivo que en la ficha: va donde se decide pulsar.

## Estado

Cerrada.
