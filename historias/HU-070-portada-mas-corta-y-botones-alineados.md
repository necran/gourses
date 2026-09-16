# HU-070 — Portada más corta, con índices, y botones de la ficha alineados

## Contexto

Fase 6, ajustes de interfaz pedidos por el usuario (2026-09-16). Tres cosas, dos de la
portada y una de la ficha.

**1. La portada enseña demasiado de golpe.** Lista **las once** categorías y **todos** los
temas que superan el umbral, uno detrás de otro, en dos filas de pastillas que ocupan media
pantalla antes de llegar a los cursos.

Que estén las once no fue un descuido: lo puso HU-056 a propósito, porque con seis había
cinco páginas de categoría que **no tenían ningún enlace en el sitio** y solo se descubrían
por el sitemap. Así que no se puede recortar sin más: hace falta un sitio donde estén todas.

Y ahora mismo no existe. `/categoria` y `/cursos` **dan 404**: solo hay `/categoria/algo` y
`/cursos/algo`. El «ver todas» que pide el usuario necesita un destino.

**2. Los botones de la ficha no cuadran.** El bloque de compra es una fila con tres piezas
—precio, botón principal con su aviso de afiliado, y la pareja de favoritos y comparar— y se
nota:

- La columna del medio es alta (botón más dos líneas de aviso), y los botones secundarios se
  alinean a su centro, así que flotan a media altura sin relación con nada.
- El botón de comparar trae su propio contenedor alineado a la derecha, que contradice el
  centrado de la fila.
- **Sin sesión, «favoritos» no es un botón, es un párrafo** («Accede para guardar…»): un
  texto suelto junto a un chip, cada uno con su línea base.
- Al no caber, la fila envuelve y las piezas cambian de sitio según el ancho.

## Como visitante quiero una portada que se lea de un vistazo y una ficha con los botones ordenados para encontrar lo que busco sin tropezar con la interfaz

## Criterios de aceptación

- **Given** la portada **When** la abro **Then** veo unas pocas categorías y unos pocos temas,
  cada lista con un enlace para verlas todas
- **Given** `/categoria` **When** la abro **Then** están las once categorías, cada una con
  enlace a su página
- **Given** `/cursos` **When** la abro **Then** están todos los temas enlazables, agrupados por
  su categoría
- **Given** el sitio entero **When** se recorre **Then** ninguna categoría ni tema pierde su
  enlace interno: lo que salía de la portada ahora sale del índice (el criterio de HU-056 se
  sigue cumpliendo, por otro camino)
- **Given** la ficha de un curso **When** la miro **Then** el precio y «Ver curso» van arriba,
  y favoritos y comparar debajo, alineados entre sí sobre la misma línea
- **Given** la ficha sin sesión **When** la miro **Then** la invitación a acceder se alinea con
  el botón de comparar en vez de flotar a otra altura
- **Given** los dos índices **When** se leen sus metadatos **Then** tienen título y descripción
  propios, son canónicos de sí mismos y declaran migas de pan, y están en el sitemap

## Fuera de alcance

- **Rediseñar los botones** (forma, color, iconos): el rediseño del 2026-09-10 está bien; lo
  que falla es la colocación. No se tocan sus módulos, compartidos con el buscador, favoritos
  y la comparación.
- **Cambiar qué categorías o temas existen**, ni sus umbrales.
- **El orden de los cursos**, que es de HU-067.

## Diseño

- `CATEGORIAS_EN_PORTADA = 6` y `TEMAS_EN_PORTADA = 8`, con su enlace «Ver todas» a cada
  índice. Las listas siguen saliendo de los mismos datos, solo se recortan al pintar.
- `/categoria`: estático, sin base de datos, con las once de `COURSE_CATEGORIES`.
- `/cursos`: los temas enlazables (HU-060) agrupados por su categoría dueña, que ya se calcula.
- Ficha: el bloque de compra pasa a **dos filas** —precio y acción principal arriba, secundarios
  debajo, separados por una línea— en vez de tres columnas peleando por el ancho. La
  alineación se corrige **desde el CSS de la ficha**, sin tocar los componentes compartidos.

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: cuántas categorías y temas se enseñan en la portada
- [x] E2E: un test por criterio de aceptación, incluida la garantía de HU-056 por el índice
- [x] `/security-review` sin hallazgos críticos ni altos

## Estado

`Cerrada` (2026-09-16)

### Lo hecho

- **Portada**: 6 categorías y 8 temas, cada lista con su enlace al índice. El enlace solo
  aparece si de verdad queda algo fuera.
- **`/categoria`**: las once, sin tocar la base de datos.
- **`/cursos`**: los temas enlazables agrupados por su categoría dueña, **más un grupo «Otros
  temas»** para los que no tengan ninguna: sin él, este índice prometía tenerlos todos y podía
  dejarse alguno fuera.
- **Ficha**: los secundarios bajan a su propia fila (`flex-basis: 100%`), con una línea que los
  separa de la acción principal, alineados entre sí y a la izquierda. El precio deja de
  centrarse contra la columna alta del botón. **Solo CSS de la ficha**: los módulos de los
  botones, compartidos con buscador, favoritos y comparación, no se tocan.
- **Sitemap**: los dos índices.
- Los dos índices entran también en la revisión móvil (HU-062) y en la de axe (HU-064).

### Dos garantías que cambian de sitio, a conciencia

- **HU-056** («la portada enlaza las once categorías») y **HU-060** («la portada enlaza todos
  los temas del umbral») eran criterios de *cómo* se cumplía algo más importante: que ninguna
  categoría ni tema se descubriera solo por el sitemap. Sus tests ahora comprueban el
  **recorrido entero**: portada → índice → todos. La garantía es la misma; el camino, uno más.

### Dos defectos míos, encontrados por los tests

- Los títulos de categoría del índice de temas medían **23 px de alto**, uno por debajo del
  mínimo de WCAG 2.2 AA. Lo cazó la revisión móvil en cuanto añadí la página a su lista.
- El índice de temas agrupaba solo por categoría dueña: un tema enlazable sin dueña no habría
  aparecido en ninguna parte. De ahí el grupo «Otros temas».

### Resultado de los tests

- Unitarios (`npm test`): 826 pasan (5 nuevos).
- Integración (`npm run test:integration`): 162 pasan.
- E2E (`npx playwright test`): **287 pasan en 2,9 min, sin fallos** (6 nuevos).

La alineación de la ficha se comprueba **midiendo posiciones reales** en pantalla: que los
secundarios estén por debajo del botón principal y que sus centros coincidan con menos de
2 px de diferencia. Incluye el caso sin sesión, donde «favoritos» es una invitación de texto y
no un botón, que era el que peor se veía.

**Incidencia del entorno, de nuevo.** Una pasada intermedia dio 5 fallos, todos con la misma
firma: un clic que no cambia la URL en 5 s. El servidor de desarrollo había crecido a
**3,65 GB en 36 minutos** y la máquina estaba con carga 16 (Chrome, WindowServer y Teams).
Reiniciado el servidor, la suite entera pasa. Ningún fallo afirmaba que el contenido
estuviera mal.

### Revisión de seguridad

Sin hallazgos. `/categoria` es estática y no lee nada; `/cursos` lee por el mismo camino que
el resto (clave anónima y RLS de `courses`) y, si falla, ofrece salida en vez de romperse.
Ninguna de las dos recibe parámetros. El JSON-LD pasa por `serializeStructuredData`. En la
ficha solo cambia CSS.
