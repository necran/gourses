# HU-042 — Gestionar la comparación desde `/comparar` y volver sin perder la búsqueda

## Contexto

Fase 2. Depende de HU-040 (la cesta).

En `/comparar` hoy no se puede quitar una columna ni añadir otro curso: hay que volver a
empezar. Además, «Volver a la búsqueda» (en `/comparar` y en la ficha) lleva a
`/buscar` a secas y pierde la palabra clave, los filtros, el orden y la página
(reproducido el 2026-09-11: se venía de `/buscar?keyword=python` y se volvía a
`/buscar`).

También falta decidir qué relación hay entre la URL de `/comparar` (que se comparte) y
la cesta (que es de cada navegador). Decisión: **abrir una comparación la convierte en
la comparación en curso**. Quien la está viendo es con esos cursos con los que va a
seguir trabajando, venga de su propia cesta o de un enlace que le han pasado.

## Como visitante que está comparando quiero quitar o añadir cursos desde la propia comparación y volver a mi búsqueda tal como la dejé para afinar la comparación sin empezar de cero

## Criterios de aceptación

- **Given** una comparación de 3 cursos **When** pulso «Quitar» en la columna de uno
  **Then** la comparación se queda con los otros 2, la URL cambia a esos 2 ids (sigue
  siendo compartible) y la cesta también
- **Given** una comparación de 2 cursos **When** quito uno **Then** se explica que hace
  falta al menos otro, y el que queda sigue en la cesta
- **Given** una comparación con menos de `MAX_COMPARADOS` cursos **When** pulso «Añadir
  otro curso» **Then** vuelvo a mi última búsqueda con esos cursos ya marcados
- **Given** que abro un enlace de comparación compartido **When** carga **Then** la
  cesta pasa a ser exactamente esos cursos (los que existan), y la barra lo refleja
- **Given** un enlace de comparación con un curso ya retirado del catálogo **When** lo
  abro **Then** ese curso desaparece también de la cesta (no queda un título fantasma
  en la barra)
- **Given** que venía de `/buscar?keyword=python&orden=precio-asc&pagina=2` **When**
  pulso «Volver a la búsqueda» en `/comparar` o en una ficha **Then** vuelvo a esa
  misma búsqueda, con sus filtros, su orden y su página
- **Given** que llego a `/comparar` o a una ficha sin haber buscado antes en esta
  pestaña (enlace directo) **When** pulso «Volver a la búsqueda» **Then** voy a
  `/buscar` sin filtros
- **Given** que navego sin JavaScript **When** uso `/comparar` **Then** «Quitar» sigue
  funcionando (es un enlace a la comparación sin ese id) y «Volver a la búsqueda» lleva
  a `/buscar`

## Fuera de alcance

- Reordenar las columnas de la comparación.
- Guardar comparaciones con nombre o en la cuenta.
- Cambiar los campos que se comparan (HU-017).

## Diseño

- **«Quitar» por columna**: enlace SSR a `/comparar?ids=<resto>` (funciona sin
  JavaScript). Con JavaScript, además actualiza la cesta.
- **Adoptar la URL como cesta**: un componente cliente en `/comparar` recibe del
  servidor la lista **ya saneada y resuelta contra el catálogo** (`cursos`, no los ids
  crudos de la URL) y la escribe en la cesta al montar.
- **Última búsqueda**: `/buscar` guarda su propia dirección en `sessionStorage` (por
  pestaña, se borra al cerrarla). «Volver a la búsqueda» y «Añadir otro curso» la
  usan si existe; si no, `/buscar`.

## Cuidados

- **Nada de redirección abierta**: lo guardado en `sessionStorage` es entrada externa.
  Solo se acepta si, al interpretarlo, es una ruta `/buscar` del propio sitio; se
  reconstruye a partir de los filtros saneados por `parseCourseSearchFilters`, nunca
  se usa la cadena guardada tal cual como `href`. Sin esquema, sin host, sin `//`.
- **Adoptar no confía en la URL**: se adoptan solo los cursos que el servidor ha
  encontrado, así que un id inventado o retirado nunca llega a la cesta.
- **Quitar la última columna de un par**: no deja una página rota ni vacía; es el
  aviso de «hace falta al menos otro» que ya existe.

## Checklist de tests (obligatorio antes de cerrar)

- [ ] Unitarios: construcción del enlace «Quitar» (orden conservado, último curso);
      validación de la última búsqueda guardada (rutas ajenas, `//evil`, `javascript:`,
      parámetros basura, vacío)
- [ ] Integración: no hace falta si no hay consulta nueva
- [ ] E2E: un test por criterio de aceptación, incluido sin JavaScript
- [ ] `/security-review` ejecutado, sin hallazgos críticos/altos abiertos (atención
      especial a la redirección desde `sessionStorage`)

## Estado

`Abierta`
