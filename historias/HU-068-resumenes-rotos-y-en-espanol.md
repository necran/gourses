# HU-068 — Resúmenes cortados: detectarlos, rehacerlos y no volver a guardarlos

## Contexto

Fase 6, contenido propio (2026-09-16). Revisando el estado del posicionamiento con el
usuario salieron tres cosas sobre los resúmenes con IA (HU-030, HU-052):

1. **16 de los 949 resúmenes están cortados a media palabra.** Miden entre 37 y 73
   caracteres y acaban así: «Este curso enseña a aplicar LLM SEO y», «…desde los conceptos
   básicos hasta avanzados de». Uno ni siquiera es un resumen: «:* Lifetime access, 30-day
   money-back», un trozo suelto de la descripción.
2. **No se arreglan solos.** `necesitaResumen` solo regenera cuando cambia la huella de la
   descripción (HU-052). Si el resumen salió mal pero la descripción sigue igual, se queda
   roto para siempre.
3. **El adaptador no se entera.** Nunca mira `finishReason`: una respuesta cortada por el
   límite de tokens se guarda tal cual, y solo se detectaría mirando la ficha.

### Qué lo provocó, comprobado contra la API real

Los 16 se generaron el 8 y 9 de septiembre, **antes** de cambiar a `gemini-3.5-flash-lite`.
Repitiendo hoy uno de esos cursos con la configuración actual, la API responde
`finishReason: STOP` y un resumen completo de 414 caracteres: el modelo de entonces se
gastaba el presupuesto de salida razonando y devolvía un fragmento.

Comprobado también que **`thinkingConfig: { thinkingBudget: 0 }` no vale**: este modelo lo
rechaza con un 400. No se toca.

O sea: el fallo ya no se reproduce, pero nada impide que vuelva, y nada limpia lo que dejó.

### Lo que hay pendiente de resumir

| | Con resumen | Pendientes |
|---|---|---|
| Español | **0** | 3.636 |
| Otros idiomas | 949 | 10.655 |

Los resúmenes son el único contenido propio de las fichas: la descripción es la de la
plataforma, igual que en otros cien agregadores. Y el español es lo que puede posicionar.

## Como visitante quiero que el resumen de la ficha sea un resumen entero y no media frase para saber de qué va el curso sin abrir la descripción

## Criterios de aceptación

- **Given** un resumen guardado que se cortó a medias **When** se ejecuta el job **Then** se
  regenera, aunque su descripción no haya cambiado
- **Given** un resumen correcto **When** se ejecuta el job **Then** no se regenera: la cuota
  diaria no se gasta en rehacer lo que ya está bien
- **Given** que la API devuelve una respuesta cortada (`finishReason` distinto de `STOP`)
  **When** el adaptador la recibe **Then** falla en vez de guardar el fragmento, y el job la
  reintenta como cualquier otro fallo
- **Given** la ficha de un curso con resumen **When** se lee **Then** el resumen termina una
  frase, no a media palabra

## Fuera de alcance

- **Cubrir los 3.636 cursos en español.** Depende de la cuota diaria gratuita, que Google no
  publica; se irá haciendo día a día con el job ya programado (HU-053). Esta historia deja el
  job en condiciones de hacerlo sin generar basura.
- **Cambiar de modelo o de proveedor.**
- **Puntuar la calidad del resumen** más allá de si está entero: eso no lo decide una regla.

## Diseño

- `resumenDefectuoso(resumen)`: pura. Un resumen es defectuoso si mide menos de 120
  caracteres o si no termina en `.`, `!`, `?` o `…`. Contra la base de desarrollo señala
  **exactamente los 16 rotos y ninguno de los 933 buenos**. El recorte propio de
  `limpiarResumen` termina en `…`, así que no se marca a sí mismo.
- `necesitaResumen` la usa además de la huella.
- `respuestaCortada(finishReason)`: pura, para que el adaptador rechace lo que no venga con
  `STOP`. El error es reintentable, como los demás errores de red.

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: detector de resúmenes defectuosos, regeneración, respuesta cortada
- [x] Integración: el job rehace un resumen roto y respeta uno bueno
- [x] E2E: la ficha no muestra un resumen cortado a media palabra
- [x] `/security-review` sin hallazgos críticos ni altos

## Estado

`Cerrada` (2026-09-16)

### Lo hecho

- `resumenDefectuoso` y `respuestaCortada`, puras, en `resumen-curso.ts`.
- `necesitaResumen` rehace también lo defectuoso, aunque la huella coincida.
- El adaptador de Gemini **rechaza** una respuesta cuyo `finishReason` no sea `STOP`, en vez
  de guardar el fragmento. Se trata como un fallo más: el job lo reintenta.
- **Primero lo roto, luego lo que falta.** El store ordenaba español primero, y los 16 rotos
  eran cursos en inglés: habrían quedado detrás de 3.636 cursos, semanas sin arreglarse. La
  regla se repite en SQL (el `ORDER BY` lo pone Postgres) y un test de integración comprueba
  que SQL y TypeScript dicen lo mismo, como ya se hizo con los temas.

### Resultado de ejecutar el job contra desarrollo

- **Los 16 resúmenes cortados, rehechos** en unos 2 minutos. El detector ya no marca ninguno.
- **Español: de 0 a 33**, a 13,5 resúmenes por minuto, que es exactamente el ritmo que impone
  la espera de 4,5 s entre llamadas del adaptador.
- **Calidad de los nuevos**: entre 425 y 492 caracteres, terminando frases enteras.
- **La cuota diaria sigue sin medir**: haría falta dejar el job horas y no bloquea esta
  historia. A este ritmo, los 3.636 en español son unas 4,5 h de ejecución continua *si la
  cuota lo permitiera*; en producción los irá haciendo día a día el workflow de HU-053.

### Un hallazgo de accesibilidad, de propina

Al generar los primeros resúmenes, la revisión de axe (HU-064) empezó a fallar: la etiqueta
«Resumen generado automáticamente» llevaba `opacity: 0.75` y se quedaba por debajo del 4,5:1
que pide WCAG 1.4.3. **No se había visto nunca porque hasta hoy ninguna ficha auditada tenía
resumen.** Quitada la opacidad; el color de por sí contrasta de sobra. Mismo caso que la
paginación inactiva en HU-064.

### Resultado de los tests

- Unitarios (`npm test`): 803 pasan.
- Integración (`npm run test:integration`): 160 pasan (3 nuevos).
- E2E (`npx playwright test`): 273 en total; 271 pasaron y 2 fallaron por lentitud del
  entorno —una navegación que no llegó en 5 s y un test que agotó sus 30 s recorriendo
  enlaces en serie, con la última petición respondiendo 200—. Relanzado ese fichero por
  duplicado, **12 de 12 en verde**; el de axe, 6 de 6; el de favoritos, 21 de 21.

### Al desplegar

No hay migración. El job y su workflow ya existen (HU-053): en cuanto haya
`GEMINI_API_KEY` en GitHub, empezará a generar resúmenes en producción, y ahora lo hará sin
guardar fragmentos y arreglando primero lo que salga roto.

### Revisión de seguridad

Sin hallazgos. La clave de la API se lee solo en el entrypoint del job y nunca llega al
frontend. El job corre fuera de la web, con Postgres directo. La regla en SQL no recibe
entrada externa: es una condición fija sobre una columna propia. No se registran datos
personales ni contenidos de terceros en los logs.
