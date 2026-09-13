# HU-043 — Que el sitio no se corte por la derecha en el móvil

## Contexto

Incidencia detectada al revisar capturas durante HU-040, HU-041 y HU-042, y anotada en
las tres como «fuera de alcance, para una incidencia aparte». Es anterior a esas
historias: no la introdujo ninguna.

A 400 px de ancho, en `/buscar`, en la ficha de un curso y en `/comparar`, el contenido
se sale por la derecha y queda cortado: títulos a medias, el campo de búsqueda partido,
el texto de introducción sin final. No hay barra de desplazamiento horizontal porque
`html` y `body` lo recortan, así que **lo que se sale no se puede ni leer ni alcanzar**.

Medido en el navegador a 400 px (2026-09-13):

| Página | Ancho de `main` |
|---|---|
| `/buscar` | 980 px |
| `/comparar` (3 cursos) | 768 px |
| Ficha de curso | 646 px |
| Portada y páginas legales | 400 px, correcto |

**Causa, en dos capas:**

1. **`body` es un contenedor flexible en columna** (`display: flex`, para el pie).
   `html` y `body` miden 400 px, pero en un contenedor así la línea toma la anchura del
   contenido más ancho, y los hijos se estiran hasta ella: por eso `main` acaba midiendo
   980 px y desborda a su propio padre. La etiqueta `viewport` está bien puesta, así que
   no es eso.
2. **Dentro, hay elementos flexibles que no pueden encoger.** El bloque de texto de cada
   tarjeta de resultado y el de la cabecera de la ficha son elementos flexibles con
   `min-width: auto`, así que nunca bajan de la anchura de su contenido. En la ficha se
   suma la imagen, de 21 rem fijos y sin encoger.

## Como visitante que entra desde el móvil quiero ver el contenido completo dentro de la pantalla para poder leer los títulos y usar el buscador sin que se corten

## Criterios de aceptación

- **Given** una pantalla de 400 px **When** abro `/buscar` **Then** no hay contenido
  fuera de la pantalla: el formulario y las tarjetas de resultado caben a lo ancho
- **Given** una pantalla de 400 px **When** abro la ficha de un curso **Then** la
  imagen y el título no compiten por el ancho: se apilan, y nada queda cortado
- **Given** una pantalla de 400 px **When** abro `/comparar` **Then** la página no se
  sale, y la tabla comparativa sigue desplazándose dentro de su propio contenedor, que
  es como se lee en móvil desde HU-017
- **Given** una pantalla de 400 px **When** abro la portada, favoritos, mi cuenta o una
  página legal **Then** tampoco hay nada fuera de la pantalla (no se rompe lo que ya
  estaba bien)
- **Given** una pantalla de escritorio **When** abro esas mismas páginas **Then** se ven
  igual que antes de esta historia

## Fuera de alcance

- **Rediseñar el móvil.** Esto arregla el corte; no cambia tipografías, tamaños ni el
  orden de los elementos más allá de lo que hace falta para que quepan.
- **La barra de la cesta** (HU-040), que ya se adapta.
- **Quitar el recorte de `overflow-x`** de `html` y `body`: sigue siendo la red de
  seguridad para que nunca aparezca desplazamiento horizontal.

## Diseño

- `body > * { max-width: 100% }` en `globals.css`: acota a la cabecera, el contenido, el
  pie y la barra, para que ninguno pueda estirar la línea del contenedor flexible.
  Se prefiere a quitar el `display: flex` del `body`, que es lo que sostiene el pie.
- `min-width: 0` en los dos bloques de texto flexibles (tarjeta de resultado y cabecera
  de ficha), que es lo que les permite encoger y que el texto se ajuste.
- En la ficha, por debajo de 30 rem la cabecera se apila y la imagen pasa a ancho
  completo, como ya hace la tarjeta de favoritos.

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: no aplica, es CSS sin lógica
- [x] Integración: no aplica
- [x] E2E: un test por criterio, con la pantalla a 400 px, comprobando que ningún
      elemento sobresale (sin contar lo que vive dentro de un contenedor con
      desplazamiento propio, como la tabla de comparar) — `e2e/movil-sin-cortes.spec.ts`
      (7 tests)
- [x] Comprobación visual con capturas a 400 px y en escritorio
- [x] `/security-review` ejecutado, sin hallazgos críticos/altos abiertos

## Estado

`Cerrada`

### Resultado

Medido después del arreglo, a 400 px: `main` mide 400 y `scrollWidth` es 400 en
`/buscar`, en la ficha y en `/comparar`. En escritorio no cambia nada (1280, 980 y
1100, como antes).

- E2E: 169 en total, 7 nuevos. En la última pasada completa falló solo
  `seo.spec.ts › cada ficha tiene su propio título`, el intermitente ya documentado
  desde HU-039 (otro test siembra y borra un curso en paralelo); pasa aislado.
- Unitarios e integración: no se tocó nada de lógica, así que no cambian.
- Revisión de seguridad: sin hallazgos. Es CSS: no hay entrada nueva, ni datos, ni
  cambios en autenticación o permisos. El recorte de `overflow-x` de `html` y `body` se
  mantiene como red de seguridad.

### Qué cambió respecto al diseño previsto

- **`max-width: 100%` no servía**, aunque en la prueba manual pareciera que sí: la
  probé con `!important`. Sin él, la clase `.main` de cada página (que fija su propio
  `max-width`) tiene más peso que una regla de elemento y gana. Se cambió a
  `width: 100%`, que ninguna página redefine, y se comprobó sin `!important` en las
  cuatro páginas.
- **`min-width: 0` en los hijos del body no arregla nada** (probado: `main` seguía en
  980). En un contenedor flexible en columna, el mínimo automático solo actúa en el eje
  principal, que aquí es el vertical.
- **Se descartó pasar el `body` a `display: block`**, que daba el mismo resultado: es
  un cambio de más alcance y el `flex` en columna sostiene la colocación del pie.

### Un susto por el camino

Una pasada completa falló en tres tests de la ficha, dos con `ERR_CONNECTION_RESET`.
No era el CSS: la suite se lanzó justo después de editar `globals.css` y el servidor de
desarrollo estaba recompilando. Con el árbol quieto, esos tres pasan.
