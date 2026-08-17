# HU-019 — Guardar cursos en favoritos

## Contexto

Fase 3 del roadmap (`docs/analisis-y-estrategia.md`), segunda mitad: HU-018 trajo las
cuentas, y una cuenta sin nada que guardar no sirve de nada. Esta historia le da su
razón de ser.

Además es el cimiento de la Fase 4: las alertas de bajada de precio necesitan saber
qué cursos le importan a cada persona, y eso es exactamente la lista de favoritos.

## Como persona con cuenta quiero guardar cursos en una lista para volver a ellos sin tener que buscarlos otra vez

## Criterios de aceptación

- **Given** que he entrado en mi cuenta y estoy en la ficha de un curso
  **When** pulso «Guardar en favoritos»
  **Then** el curso queda guardado y el botón pasa a ofrecer quitarlo

- **Given** que tengo un curso guardado
  **When** pulso «Quitar de favoritos»
  **Then** deja de estar guardado y el botón vuelve a ofrecer guardarlo

- **Given** que tengo cursos guardados
  **When** entro en `/favoritos`
  **Then** veo todos, cada uno enlazando a su ficha

- **Given** que no tengo ningún curso guardado
  **When** entro en `/favoritos`
  **Then** se me explica cómo guardar el primero, sin que parezca un error

- **Given** que no he entrado en mi cuenta
  **When** entro en `/favoritos`
  **Then** se me lleva a la página de acceso

- **Given** que no he entrado en mi cuenta
  **When** veo la ficha de un curso
  **Then** se me invita a entrar para poder guardarlo, en lugar de un botón que fallaría

- **Given** que guardé un curso y cerré sesión
  **When** vuelvo a entrar más tarde
  **Then** el curso sigue en mi lista

## Fuera de alcance

- **Guardar desde la lista de resultados.** La lista ya va dentro de un `<form>` para
  comparar y HTML no admite formularios anidados. Se puede resolver con el atributo
  `form=` de los botones, pero es un enredo que merece su propia historia y no cambia
  lo que esta entrega.
- Ordenar, etiquetar o agrupar favoritos. Una lista simple, por ahora.
- Compartir la lista, o hacerla pública. Los favoritos son privados y punto.
- Avisar de bajadas de precio: eso es la Fase 4, y esta historia es su cimiento.
- Borrar la cuenta con todo lo que cuelga de ella (obligación del RGPD). Queda
  anotado como deuda desde HU-018; se hace en su propia historia.

## Cuidados

- Los favoritos son datos personales: revelan qué le interesa a alguien. Quien decide
  quién ve qué es la RLS, no el código de la página. Una consulta sin filtro debe
  devolver cero filas ajenas por sí sola, sin que nadie se acuerde de filtrar.
- Guardar dos veces el mismo curso no puede duplicar ni reventar: la clave primaria
  `(user_id, course_id)` lo hace imposible por diseño.
- El identificador del curso llega de un formulario, así que se valida antes de tocar
  la base de datos, como todo lo que entra de fuera.

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: validación del identificador de curso que llega del formulario
- [x] Integración: **la RLS aísla de verdad** — con la sesión de A no se ven ni se
      borran los favoritos de B, aunque se pida explícitamente
- [x] Integración: guardar dos veces el mismo curso no duplica ni falla
- [x] E2E: un test por cada criterio de aceptación de arriba (7 de 7)
- [x] `/security-review` sin hallazgos críticos ni altos

## Estado

**Cerrada.**

- Unitarios: 199 pasan.
- Integración: 46 pasan, 7 de ellos dedicados al aislamiento entre cuentas.
- E2E: 50 pasan.
- Revisión de seguridad: sin hallazgos críticos ni altos.

## Qué encontró la revisión de seguridad

Nada explotable. Verificó como correctos el aislamiento por RLS, que ninguna consulta
de favoritos usa la clave de servicio ni el cliente anónimo, que `user_id` sale del
`getUser()` validado contra el servidor y no del formulario, y que las páginas privadas
llevan `noindex` y no aparecen en el sitemap.

Pero de paso destapó **un fallo real de robustez, y con él un test mío que engañaba**:

`upsert` se traduce a `ON CONFLICT DO UPDATE`, así que Postgres aplica las políticas de
UPDATE de la tabla — que a propósito no existen, porque una fila de favoritos no tiene
nada que actualizar. Resultado: guardar dos veces el mismo curso (un doble clic basta)
fallaba con un error de RLS.

Lo grave no era el fallo, sino que el test de integración lo tapaba: solo contaba filas
después, y contar 1 no distingue «no duplicó» de «no llegó a guardar». Ahora llama a la
función de producción y comprueba que no lanza. Verificado que el test corregido falla
con el código anterior — si no, no probaría nada.

El arreglo es `ignoreDuplicates: true`, que manda `ON CONFLICT DO NOTHING`: la
semántica que se quería desde el principio.

## Deuda que sigue abierta

- Guardar desde la lista de resultados (fuera de alcance arriba).
- Borrar la cuenta desde la interfaz, con todo lo que cuelga de ella (RGPD). La
  cascada ya está en la base de datos y hay test que lo demuestra; falta el botón.
- Los favoritos de un curso retirado del catálogo dejan de mostrarse pero la fila
  permanece. Limpiarlas es tarea de la ingesta, no de aquí.
