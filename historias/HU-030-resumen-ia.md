# HU-030 — Resumen de cada curso generado con IA, apoyado en la descripción real

## Contexto

Segunda mitad de la investigación que dio pie a HU-029. La conclusión entonces fue
clara: **no generar contenido desde cero**. Con 8.796 cursos y enlaces de afiliado,
producir un párrafo de relleno genérico por curso sin apoyo en datos reales es
exactamente el patrón que Google vigila como *scaled content abuse* — páginas finas
en masa con enlace de afiliado detrás.

Con HU-029 ya hay una descripción real por curso de Udemy (antes era un titular de una
línea). Eso cambia la tarea: ya no hace falta inventar nada, solo **resumir** un texto
que existe. Es una tarea de resumen con apoyo, no de generación libre, y el riesgo de
alucinación se acota mucho porque el modelo tiene el texto delante en vez de tener que
inventárselo.

Se hace como un job aparte (`npm run resumir:cursos`), bajo demanda — no en el cron de
ingesta. Igual que la propia ingesta, nunca se llama a la API de IA desde una ruta de
la web (`.claude/rules/ingesta-fuentes.md`, mismo espíritu). Se usa Claude Haiku 4.5:
para un resumen corto de un texto que ya está delante, es de sobra, y a escala del
catálogo entero la diferencia de coste frente a un modelo mayor es real.

## Como visitante quiero leer un resumen corto de cada curso para hacerme una idea rápida sin tener que leer la descripción completa

## Criterios de aceptación

- **Given** un curso con descripción real y sin resumen todavía **When** se ejecuta
  el job **Then** se genera un resumen corto apoyado en esa descripción, nunca con
  datos que el texto no contenga

- **Given** un curso cuya descripción ha cambiado desde la última vez **When** se
  ejecuta el job **Then** se regenera el resumen; si no ha cambiado, no se vuelve a
  pedir (ni se paga otra vez por lo mismo)

- **Given** un curso sin descripción, o con una demasiado corta para merecer resumen
  **When** se ejecuta el job **Then** se deja sin tocar, sin gastar una llamada en
  vano

- **Given** que la API de IA falla para un curso suelto **When** el job sigue
  corriendo **Then** los demás cursos se procesan igual — un fallo no tumba la
  ejecución entera (mismo criterio que ya rige la ingesta)

- **Given** un curso con resumen **When** se ve su ficha **Then** el resumen se
  muestra marcado como generado automáticamente, nunca mezclado con el texto de la
  plataforma de origen como si fuera lo mismo

## Fuera de alcance

- Generar resumen para Coursera: su descripción ya es corta de por sí: en la
  mayoría de los casos, resumir un texto corto no aporta nada. Se deja fuera hasta
  que haya un motivo concreto para lo contrario.
- Traducir descripciones que no estén en español. El resumen se pide en español
  sobre el texto que haya, sea cual sea su idioma original.
- Automatizarlo en el cron de ingesta. Sigue siendo un job aparte, bajo demanda.
- Usar el resumen en los datos estructurados (`schema.org`) o en el meta de
  descripción: ahí sigue mandando el texto real de la plataforma, que es el dato
  con el que hay acuerdo de afiliación.

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: construcción del prompt (grounded, sin inventar), selección de
      candidatos (sin descripción, descripción corta, ya resumido y sin cambios),
      un fallo puntual no detiene el resto
- [x] Integración: el job escribe el resumen y la fecha en la base real
- [x] E2E: el resumen se muestra en la ficha, marcado como generado, cuando existe;
      no aparece nada cuando no existe
- [x] `/security-review` sin hallazgos críticos ni altos

## Estado

`Cerrada`

Unitarios (13 en resumen-curso, 5 en resumen-job), 4 de integración contra la base
real (con un generador falso — nunca la API real de Anthropic en los tests, que
costaría dinero en cada ejecución) y 2 e2e. Suites completas en verde: 377 unitarios,
101 de integración, 98 e2e. `/security-review` sin hallazgos.

## Decisiones tomadas con el usuario, no por mi cuenta

Dos cosas de esta historia eran decisiones externas al código, no técnicas — se
preguntaron antes de escribir nada:

- **Proveedor**: la API de Anthropic. La clave la crea y pega el usuario en
  `.env.local`; nunca se ha manejado aquí.
- **Modelo**: Claude Haiku 4.5, explícitamente pedido por el usuario tras comparar
  coste y ajuste a la tarea (un resumen corto de un texto que ya está delante no
  necesita un modelo mayor, y a escala de 8.796 cursos la diferencia de coste es real).
- **Cuándo se genera**: job aparte, bajo demanda (`npm run resumir:cursos`), nunca en
  el cron de ingesta — para que el coste y el resultado se vean antes de repetirlo.

## Lo que se descubrió al ejecutar la suite completa, no al escribir el código

Las suites e2e nuevas (siembran y borran cursos reales en `courses` durante la
ejecución) empujaron una carrera que ya existía en `recuento.spec.ts`: ese test
compara el recuento del catálogo entero entre dos cargas de página, y con más suites
sembrando en paralelo, el número cambiaba por en medio con la frecuencia suficiente
para fallar de forma reproducible (2 de 2 ejecuciones completas). Arreglado acotando
ese test concreto a una palabra clave que ningún curso de prueba coincide, en vez de
tocar el sistema de aislamiento de tests del proyecto entero.

## Deuda que sigue abierta

- Coursera sigue sin resumen: su descripción ya es corta de por sí.
- El resumen no se usa en los datos estructurados ni en el meta de descripción, a
  propósito: ahí sigue mandando el texto real de la plataforma.
