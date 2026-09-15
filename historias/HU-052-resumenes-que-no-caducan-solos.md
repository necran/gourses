# HU-052 — Resúmenes con IA que no caducan solos, para Coursera también y en español primero

## Contexto

Fase 6, estrategia de tráfico orgánico (2026-09-15). Las 15.815 fichas del sitemap
repiten la descripción de Udemy o Coursera, casi siempre en inglés: Google ya tiene ese
texto en la web original y no tiene motivo para mostrar la copia. El contenido propio en
español es lo que puede posicionar, y el único que hay es el resumen con IA de HU-030.

Al medir su estado en la base de desarrollo:

| | Udemy (es) | Coursera (es) | Toda la base |
|---|---|---|---|
| Cursos | 3.540 | 260 | 15.395 |
| Con resumen | 0 | 0 | 949 |

Y tres fallos que explican por qué no avanza:

1. **Los resúmenes caducan cada día sin que cambie nada.** `necesitaResumen` regenera
   si `updated_at` es posterior al resumen, pero la ingesta diaria pone
   `updated_at = now()` a todos los cursos que recorre, cambien o no
   (`postgres-course-store.ts`, `updateCourse`). De los 949 resúmenes, **528 ya cuentan
   como caducados** con la descripción intacta, y el job los rehará gastando la cuota
   gratuita de Gemini en lo que ya estaba hecho.
2. **Coursera queda fuera.** HU-030 lo dejó fuera de alcance porque su descripción «ya
   es corta». No siempre: el umbral de 200 caracteres ya descarta las cortas, y las
   largas se quedan sin contenido propio.
3. **No hay orden.** El job recorre los cursos como los devuelve la base. Con una cuota
   diaria limitada, lo que no se haga hoy debería ser lo que menos importa, y hoy
   importa el español.

Además, cuando la cuota diaria se agota, el job sigue: cada curso restante espera su
turno de 4,5 s, reintenta cinco veces y acaba en `fallidos`. Con miles de candidatos son
horas perdidas para no generar nada.

Llevarlo a producción con una tarea programada es **HU-053**: se separa porque solo se
puede verificar ejecutándose allí, y esta parte se puede probar y cerrar ya.

## Como visitante que llega desde un buscador quiero leer en español de qué va un curso para decidir en segundos si me interesa

## Criterios de aceptación

- **Given** un curso de Udemy **o de Coursera** con descripción suficiente y sin resumen
  **When** se ejecuta el job **Then** se genera el resumen y se guarda junto a la huella
  de la descripción que resumió
- **Given** un curso ya resumido **When** la ingesta vuelve a pasar sin cambiar su
  descripción (aunque actualice la fecha) **Then** el job no lo vuelve a resumir
- **Given** un curso ya resumido **When** su descripción cambia **Then** el job lo
  vuelve a resumir
- **Given** candidatos en varios idiomas **When** se ejecuta el job **Then** se resumen
  primero los cursos en español y, dentro de cada idioma, los que tienen más alumnos
- **Given** que la API responde que la cuota diaria está agotada **When** el job está
  en marcha **Then** se detiene sin hacer más peticiones, informa de cuántos quedan y la
  siguiente ejecución sigue por donde lo dejó
- **Given** un curso de Coursera con resumen **When** se ve su ficha **Then** el resumen
  se muestra marcado como generado automáticamente, igual que en Udemy

## Fuera de alcance

- **La tarea programada en producción**: es HU-053.
- **Cambiar la ingesta para que no toque `updated_at` si no cambia nada.** Otras partes
  pueden depender de esa fecha; la huella resuelve el problema de los resúmenes sin
  tocarlas.
- **Usar el resumen en el meta de descripción o en los datos estructurados.** HU-030 lo
  dejó fuera a propósito; se revisa en la historia de SEO técnico.
- **Traducir la descripción completa.** Solo se resume.
- **Pasar a un plan de pago de Gemini.** Decisión del usuario (2026-09-15): cuenta
  gratuita.

## Diseño

- **Huella**: columna nueva `resumen_ia_descripcion_sha256` (migración `0009`), el
  SHA-256 en hexadecimal de la descripción resumida. `necesitaResumen` compara la huella
  guardada con la de la descripción actual, en vez de fechas.
- **Sin regenerar lo que ya hay**: la migración rellena la huella de los resúmenes
  existentes con la descripción actual (Postgres 17 calcula `sha256()` en SQL con el
  mismo resultado que Node, comprobado). Todos se generaron desde el 9 de septiembre y
  la ingesta no cambia descripciones sin motivo, así que dar por buena la actual es
  razonable y ahorra 949 llamadas.
- **Orden**: lo decide la consulta (`language = 'es'` primero, luego `num_subscribers`
  descendente con nulos al final, luego `id`); el job respeta ese orden con concurrencia 1.
- **Cuota diaria**: el adaptador de Gemini distingue el 429 de cuota **diaria** (su
  mensaje nombra `PerDay`) y lanza un error propio que no se reintenta. El job lo
  reconoce, deja de lanzar tareas y devuelve `detenidoPorCuota` y cuántos quedan.

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: huella, `necesitaResumen` por huella (sin resumen, huella igual, huella
      distinta, fecha más nueva con huella igual), detección de cuota diaria, el job se
      detiene al agotarla y respeta el orden
- [x] Integración: contra la base de test, Coursera entra, el orden por idioma y alumnos,
      no regenera si solo cambia la fecha y sí si cambia la descripción, se guarda la huella
- [x] E2E: la ficha de Coursera muestra el resumen marcado
- [x] `/security-review` sin hallazgos críticos ni altos

## Estado

`Cerrada` (2026-09-15)

### Reparto de criterios y tests

| Criterio | Dónde se prueba |
|---|---|
| Udemy o Coursera, se guarda la huella | integración: «genera y guarda…», «resume también un curso de Coursera» |
| No regenera si solo cambia la fecha | integración: «no regenera… si la ingesta solo actualiza la fecha»; unitario de `necesitaResumen` |
| Regenera si cambia la descripción | integración: «regenera el resumen si la descripción cambia» |
| Español primero, luego más alumnos | integración: orden con seis cursos; unitario: el job no reordena |
| Cuota diaria agotada | unitarios: detección (diaria sí, por minuto no), no se reintenta, el job para y cuenta pendientes |
| Ficha de Coursera con resumen | e2e `resumen-coursera.spec.ts` |

Además, un test de integración comprueba que el `UPDATE` de la migración da por buenos
los resúmenes antiguos: la huella calculada en SQL coincide con la de Node.

### La base de test no admite todas las migraciones

`npm run migrate` contra `gourses_test` falla en `0004_favorites.sql`
(`schema "auth" does not exist`): esa base es un Postgres a secas, sin el esquema de
Auth de Supabase. Por eso `0009` se aplicó sola en test, igual que se venían aplicando
las de cursos. En desarrollo se aplicó con `npm run migrate`: los 949 resúmenes tienen
huella y ninguno queda pendiente de regenerar.

### En producción

Hay que aplicar `0009` en Supabase Cloud **antes** de desplegar este código: el job
lee la columna nueva. En producción no hay ningún resumen todavía (el job solo se había
lanzado contra desarrollo), así que el relleno no toca nada. Queda anotado para el
despliegue y para HU-053.

### Resultado de los tests

- Unitarios (`npm test`): 605 pasan.
- Integración (`npm run test:integration`): 124 pasan, 6 de ellos de esta historia.
- E2E (`npx playwright test`): 202 pasan. La primera pasada dio un fallo en un test de
  HU-050 que abría la ficha de un curso sembrado y ya borrado por otro test; se corrigió
  ese test (anotado en HU-050).

### Revisión de seguridad

Sin hallazgos críticos ni altos:

- **SQL**: consultas con parámetros; el orden no depende de ninguna entrada.
- **Clave de Gemini**: sigue leyéndose solo en el script; el error de cuota no incluye el
  mensaje original de la API ni la clave.
- **Salida del modelo**: sin cambios respecto a HU-030; se muestra como texto (React
  escapa) y marcada como generada.
- **Huella**: SHA-256 de un texto público; no protege nada, solo detecta cambios.
