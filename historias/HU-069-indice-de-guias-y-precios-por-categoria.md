# HU-069 — Índice de guías, y una guía de precios por categoría

## Contexto

Fase 6, tráfico orgánico (2026-09-16). Al revisar el posicionamiento con el usuario salió la
idea de montar un blog. Se descartó con un motivo: publicar artículos genéricos («los mejores
cursos de X») junto a enlaces de afiliado es el patrón que Google vigila como *scaled content
abuse*, y además competiríamos sin autoridad contra miles de páginas iguales.

Lo que sí funciona es lo que ya demostró HU-063: **guías construidas con nuestros datos**, que
nadie más puede escribir porque nadie más tiene los dos catálogos medidos con los mismos
campos. Falta lo que las hace encontrables:

1. **No hay índice.** `/guias/udemy-o-coursera` solo se alcanza desde un enlace de la portada.
   `/guias` da 404.
2. **Solo hay una guía.**

### Qué sostienen los datos (base de desarrollo, cursos en español)

| Categoría | Cursos | Con precio | Precio habitual | Máximo | Duración mediana |
|---|---|---|---|---|---|
| Negocios | 1.044 | 956 | 14,99 € | 219,99 € | 4,5 h |
| Desarrollo personal | 694 | 648 | 14,99 € | 219,99 € | 3,5 h |
| Diseño y creatividad | 647 | 511 | 14,99 € | 219,99 € | 5,5 h |
| Desarrollo | 407 | 364 | 14,99 € | **39,99 €** | **13 h** |
| Salud y bienestar | 377 | 358 | 14,99 € | 139,99 € | **3,25 h** |
| IT y software | 203 | 180 | 14,99 € | 159,99 € | 13 h |

**La conclusión con datos no es el precio, es lo que se obtiene por él.** El precio más
repetido es 14,99 € en las ocho categorías con precio, así que una guía por categoría serían
once páginas diciendo lo mismo. Lo que de verdad cambia es el techo (39,99 € en desarrollo
frente a 219,99 € en negocios) y las horas: un curso de desarrollo dura cuatro veces más que
uno de salud por el mismo precio.

**Muestras que no dan para afirmar nada**: idiomas (4 cursos en español), datos e IA (16),
ciencia y matemáticas (25), y ninguna de las tres publica precio —son cursos de Coursera—.
Se dicen como lo que son, no se rellenan.

## Como persona que busca curso quiero saber qué se paga y qué duración esperar en cada materia para juzgar si un precio es normal antes de comprar

## Criterios de aceptación

- **Given** `/guias` **When** la abro **Then** veo la lista de guías publicadas, cada una con
  su título y de qué trata, y enlaza a cada una
- **Given** `/guias/cuanto-cuesta-un-curso` **When** la abro **Then** veo una tabla por
  categoría con cuántos cursos en español hay, cuántos publican precio, el precio habitual, el
  rango y la duración mediana, calculados al servir la página
- **Given** una categoría con menos de 20 cursos en español **When** se muestra **Then** se
  dice que no hay datos suficientes, en vez de dar una cifra que sale de cuatro cursos
- **Given** una categoría cuyos cursos no publican precio **When** se muestra **Then** se dice
  que no lo publican, nunca un cero ni «gratis»
- **Given** la guía **When** la leo **Then** no afirma nada que los datos no sostengan, y
  enlaza a las categorías y a la guía de plataformas
- **Given** las dos páginas **When** se leen sus metadatos **Then** tienen título y
  descripción propios, son canónicas de sí mismas y declaran migas de pan
- **Given** el sitemap y la portada **When** se recorren **Then** incluyen el índice de guías

## Fuera de alcance

- **Una guía por categoría.** Ver arriba: serían páginas casi idénticas.
- **Guías sobre temas que ya tienen su página** (`/cursos/inteligencia-artificial` y demás):
  competirían contra ellas.
- **Comparar precios con otras plataformas** que no están en el catálogo.
- **Histórico de precios** («¿es buen momento para comprar?»): hay datos (HU-021), pero es
  otra historia.

## Diseño

- Migración `0019`: vista `precios_por_categoria` (`security_invoker`), una fila por
  categoría con los agregados en español. La web lee con la clave anónima y PostgREST no
  agrega.
- `src/lib/courses/guia-precios.ts`: umbral de 20 cursos (el mismo de HU-058), textos y
  formato en funciones puras; «No lo publica» reutilizando el criterio de HU-063.
- `/guias` como índice con una lista de guías declarada en un solo sitio, para que añadir la
  próxima sea una línea y aparezca sola en el índice y en el sitemap.
- Mismo aspecto que las páginas de texto (`legal.module.css`) y tabla que se desplaza en el
  móvil, como en HU-063.

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: umbral de muestra, «no lo publica», formato, textos sin afirmaciones de más
- [x] Integración: la vista cuenta lo mismo que una consulta directa
- [x] E2E: un test por criterio de aceptación
- [x] `/security-review` sin hallazgos críticos ni altos

## Estado

`Cerrada` (2026-09-16)

### Lo hecho

- **Registro único de guías** (`src/lib/courses/guias.ts`): el índice, el sitemap y los
  enlaces salen de la misma lista. Publicar la próxima guía es añadir una línea.
- **`/guias`**, que antes daba 404, con una tarjeta por guía y de qué contesta cada una.
- **`/guias/cuanto-cuesta-un-curso`**, con la tabla por materia y conclusiones **calculadas**,
  no escritas a mano: si mañana los datos cambian, las frases cambian solas.
- Migración `0019`: vista `precios_por_categoria` (313 ms en desarrollo, 11 filas).
- La portada enlaza el índice, junto al enlace directo a la guía de plataformas, que se deja
  para no romper el criterio de HU-063.

### Lo que sostienen los datos

El precio más repetido es **14,99 € en las ocho materias que publican precio**, así que una
guía por categoría habrían sido once páginas casi idénticas. Lo que de verdad distingue a
cada materia es el techo y las horas: el curso más caro de negocios cuesta 219,99 € y el de
desarrollo se queda en 39,99 €, mientras que un curso de desarrollo dura 13 h de mediana
frente a 3,25 h en salud y bienestar. Idiomas (4 cursos en español), datos e IA (16) y
ciencia (25, sin precio) se muestran como lo que son, sin inventar cifras.

### Dos tests míos que estaban mal, y por qué

- `resumen-sin-cortes` (HU-068) leía **los resúmenes más cortos del catálogo vivo** y, en
  paralelo, pillaba la fila que siembra el e2e de HU-030 («Este curso enseña X e Y de forma
  práctica.»). Ahora excluye las filas de prueba (`zzz-`, `test-`): el criterio habla de
  cursos reales.
- El e2e de la guía de plataformas pedía sus ocho enlaces **en serie** y agotaba los 30 s del
  test con la última respondiendo 200. Ahora van en paralelo, con las mismas comprobaciones.

### Resultado de los tests

- Unitarios (`npm test`): 821 pasan.
- Integración (`npm run test:integration`): 162 pasan (2 nuevos).
- E2E (`npx playwright test`): **279 pasan en 2,5 min, sin un solo fallo** (6 nuevos).

**Incidencia del entorno, otra vez, y no del código.** Una pasada intermedia dio 17 fallos en
7,4 min, casi todos `page.goto: Test timeout of 30000ms`: páginas que no cargaban. La máquina
estaba ahogada —IntelliJ al 440 % de CPU indexando y 5,6 GB de 7,1 de swap— y el servidor de
desarrollo había crecido a 2,46 GB tras 1 h 20. Reiniciado el servidor y pasado el pico de
IntelliJ, la suite entera pasa. Comprobado que no quedaban procesos huérfanos de las
ejecuciones interrumpidas.

**Un test que conviene vigilar**: `gestionar-comparacion`, «Volver a la búsqueda», falló hoy
dos veces **en clics distintos** y pasa al relanzarlo (29 de 30 en repeticiones). No se ha
tocado: sin una causa comprobada, cambiarle la espera sería maquillarlo.

### Al desplegar

Aplicar `0019` en Supabase Cloud. Solo crea una vista, no reescribe la tabla.

### Revisión de seguridad

Sin hallazgos. La vista es de solo lectura, con `security_invoker`, y solo se le concede
`select`: expone recuentos de datos que ya son públicos por la RLS de `courses`. Las dos
páginas no reciben entrada del usuario —no tienen parámetros—, el registro de guías es
estático y el JSON-LD pasa por `serializeStructuredData`.
