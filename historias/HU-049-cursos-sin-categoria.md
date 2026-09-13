# HU-049 — Que los cursos en español no se queden sin categoría

## Contexto

Fase 1, corrección de un fallo de ingesta. Detectado al revisar el estado del proyecto
el 2026-09-13: **316 de los 9.380 cursos no tienen categoría**, así que no aparecen al
filtrar por ninguna ni en sus páginas de categoría (HU-046).

Investigado hasta el final antes de tocar nada, porque las primeras dos hipótesis eran
falsas:

1. Los 316 son **todos de Udemy** (315 tienen precio, y Coursera no publica precios).
2. No es que falte mapear alguna categoría: el mapeo cubre las 13 reales, y hay un test
   que lo comprueba.
3. Tampoco es lo de las subcategorías de HU-023: `job.ts` pasa siempre el título de la
   **categoría raíz**, también cuando recorre una subcategoría.

La causa real, comprobada contra la API el 2026-09-13:

> Con `Accept-Language: es`, Udemy devuelve los títulos de categoría **traducidos**:
> «Desarrollo», «Informática y software», «Diseño», «Enseñanzas y disciplinas
> académicas»… El mapeo (`UDEMY_CATEGORIES`) está escrito con los títulos en inglés, así
> que ninguno casa y `mapUdemyCategory` devuelve `null`.

Eso lo introdujo HU-033 al crear la pasada en español, que corre con `UDEMY_LOCALE=es`.
La prueba definitiva está en las marcas de tiempo: **314 de los 316 se escribieron en la
misma hora** (2026-09-09, 15h UTC), mientras que todos los cursos con categoría vienen
de otras pasadas (08h, 09h y 10h). Es una sola causa, no dos, y explica también los 135
cursos **en inglés** que están entre ellos: el descubrimiento en español devuelve cursos
en los dos idiomas, y todos pasan por el mismo mapeo roto.

«Marketing» se escribe igual en los dos idiomas: por eso no fallaron los 4.000 cursos de
esa pasada, solo los de las otras doce categorías.

## Como visitante quiero que los cursos en español aparezcan en su categoría para poder filtrarlos y encontrarlos como los demás

## Criterios de aceptación

- **Given** un curso descubierto con el catálogo en español **When** se ingiere
  **Then** se guarda con su categoría del vocabulario común, igual que uno en inglés
- **Given** la ingesta en cualquier idioma **When** Udemy devuelve los títulos
  traducidos **Then** la categoría se resuelve igualmente, sin depender del idioma del
  título
- **Given** la pasada en inglés **When** se ejecuta **Then** sigue guardando exactamente
  las mismas categorías que hoy
- **Given** una categoría que Udemy añada mañana **When** aparece **Then** el curso se
  guarda sin categoría y la ingesta sigue, como hasta ahora — nunca se inventa una
- **Given** los 316 cursos que hoy están sin categoría **When** vuelva a pasar la
  ingesta en español **Then** quedan clasificados, sin necesidad de tocar la base a mano

## Fuera de alcance

- **Los cursos de Coursera sin categoría**: hoy no hay ninguno.
- **Ampliar el vocabulario común** (HU-010). Se sigue mapeando a las mismas once
  categorías.
- **Traducir la interfaz** ni nada de i18n: esto es ingesta.
- **Una migración para rellenar los 316 a mano.** El dato viene de la fuente; lo arregla
  la ingesta en su siguiente pasada. Retocar la base a mano dejaría una clasificación
  que nadie podría reproducir.

## Diseño

- **Mapear por el identificador de categoría, no por su título.** Comprobado contra la
  API: los 13 identificadores son **los mismos en inglés y en español** (`288`
  Development / Desarrollo, `294` IT & Software / Informática y software…). El título es
  lo que cambia con el idioma; el identificador, no. `job.ts` ya tiene el `id` a mano,
  así que no hace falta ninguna petición extra.
- **El mapeo por título se queda como respaldo**, no se borra: si algún día la API
  dejara de dar el identificador en algún camino, el comportamiento actual sigue
  valiendo para el catálogo en inglés. Y así el cambio no obliga a tocar los tests que
  ya cubren esa vía.
- **Sin migración**: la ingesta nocturna en español volverá a tocar esas filas y
  `upsertCourse` las actualizará con su categoría.

## Cuidados

- **Los identificadores son de un tercero**: se validan igual que todo lo que llega de
  fuera. Uno desconocido devuelve `null` —el curso se guarda sin categoría— en vez de
  lanzar y tumbar la pasada, que es la regla que ya sigue el mapeo por título.
- **La pasada en inglés no puede cambiar de comportamiento.** Es la que sostiene el
  catálogo entero; cualquier cambio aquí tiene que dejarla idéntica.
- **No romper el test de cobertura** que exige que las 13 categorías reales estén
  mapeadas: ahora tiene que haber su equivalente por identificador.

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: los 13 identificadores reales mapean y dan la misma categoría que su
      título en inglés; uno desconocido da `null` sin lanzar; los títulos en español que
      hoy no mapean sí se resuelven por identificador — `categories.test.ts`
- [x] Unitarios: el normalizador resuelve la categoría con el identificador aunque el
      título venga traducido, sigue resolviéndola por título sin identificador, recurre
      al título si el identificador es desconocido, y deja el curso sin categoría cuando
      no reconoce ninguno de los dos — `normalize.test.ts`
- [x] Integración: sin consulta nueva. Se ejecutaron igualmente las dos que recorren la
      API real y el `job` completo (`udemy-ingest`, 6 casos, y `catalogo-ampliado`, 3,
      que cubre el camino de subcategorías)
- [x] E2E: no aplica — esto es ingesta, no interfaz. Lo que se ve en la web ya está
      cubierto por HU-022 y HU-046. Se ejecutó la suite entera igualmente
- [x] `/security-review` sin hallazgos críticos ni altos

## Estado

`Cerrada`

### Resultado de los tests

- Unitarios (`npm test`): 566 pasan, 122 omitidos (11 nuevos).
- Integración (`npm run test:integration`): 122 pasan.
- E2E (`npx playwright test`): 195 pasan. Pasada completa limpia.

### Comprobado contra la API real, no solo con tests

Los tests demuestran que el mapeo funciona; no que la pasada en español clasifique de
verdad. Así que se ejecutó la ingesta real, recortada al mínimo (`UDEMY_LOCALE=es`, un
ámbito, una página, diez cursos, sin subcategorías):

    Idioma: es. Ámbitos recorridos: 1, procesados: 10, guardados: 10

Los cursos sin categoría bajaron de **316 a 306**: exactamente los diez guardados, que
volvieron clasificados como «desarrollo». Es el escenario que causaba el fallo,
funcionando.

Los 306 restantes quedan a la espera de la próxima pasada completa en español, que los
actualizará sin necesidad de tocar la base a mano.

### Revisión de seguridad

Sin hallazgos:

- **El identificador viene de un tercero y se trata como tal**: se busca en una tabla
  cerrada y uno desconocido devuelve `null`; no se interpola en ninguna consulta ni se
  usa para construir rutas. Probado con desconocidos, `NaN`, `Infinity`, `null` y
  `undefined`.
- **No cambia lo que se guarda de cada curso** más allá de la categoría, ni añade
  llamadas a la API: el identificador ya lo tenía el `job` en memoria.
- **La pasada en inglés se comporta igual que antes**, que era el riesgo real de tocar
  aquí: sigue resolviendo por título y sus tests no cambiaron.

### Dos hipótesis descartadas antes de tocar nada

Se anotan porque las dos parecían razonables y las dos eran falsas:

1. **«Falta mapear alguna categoría».** No: el mapeo cubre las 13 reales y hay un test
   que lo comprueba.
2. **«Es el recorrido por subcategorías de HU-023».** No: `job.ts` pasa siempre el
   título de la categoría **raíz**, también en los ámbitos de subcategoría.

Y una tercera, a medias: pensé que había **dos** causas, porque entre los 316 había 135
cursos en inglés. Las marcas de tiempo lo desmintieron —314 de los 316 escritos en la
misma hora, distinta de la de las pasadas que sí clasifican—: es una sola causa, y esos
135 son cursos en inglés que devuelve el descubrimiento en español.

### Qué cambió respecto al diseño previsto

Nada del diseño. Lo único que conviene recordar es por qué se mapea por identificador y
no por título traducido: los identificadores son **los mismos en cualquier idioma**
(comprobado contra la API el 2026-09-13), así que una futura pasada en francés o en
portugués no volvería a romper esto. Añadir los títulos en español habría arreglado hoy
y roto mañana.
