# HU-063 — Guía «Udemy o Coursera: cuál te conviene», con datos del catálogo

## Contexto

Fase 6, tráfico orgánico (2026-09-15). «Udemy o Coursera» es una búsqueda informativa
frecuente, y este sitio tiene algo que las comparativas genéricas no tienen: **los dos
catálogos enteros, con los mismos campos**. Una guía hecha con esos datos es contenido
propio de verdad, y lleva a las páginas de tema y categoría.

### Lo que dicen los datos (base de desarrollo, 2026-09-15)

| | Udemy | Coursera |
|---|---|---|
| Cursos | 11.400 | 4.106 |
| En español | 3.544 | 262 |
| Idiomas | 2 | 20 |
| Con precio publicado | 11.115 (97 %) | 0 |
| Con valoración | 11.399 (media 4,57) | 0 |
| Con duración | 11.398 (mediana 5 h) | 1.860 (mediana 8 h) |
| Con número de reseñas | 10.602 | 0 |

- **Precio de Udemy**: el 91,5 % de los cursos con precio en euros está a 14,99 €; el más
  barato, 14,99 €, y el más caro, 219,99 €.
- **Categorías**: Udemy pesa en negocios (3.530), desarrollo personal (2.034) y diseño y
  creatividad (1.932); Coursera, en negocios (1.202), desarrollo (869), IT y software (669)
  y datos e IA (470).
- **Nivel**: Udemy lo publica en casi todos los cursos; Coursera, en ninguno.

### Un hallazgo aparte

Los niveles de Udemy salen en dos idiomas según la pasada de la ingesta: «Todos los
niveles» (5.443) y «All Levels» (1.825), «Principiante» (2.307) y «Beginner» (629)… Se ve
en la ficha. No es de esta historia: se anota para corregirlo en una propia.

## Como persona que duda entre Udemy y Coursera quiero ver en qué se diferencian con datos reales para elegir la plataforma que me conviene

## Criterios de aceptación

- **Given** `/guias/udemy-o-coursera` **When** la abro **Then** veo una comparación de las
  dos plataformas con cifras del catálogo: cuántos cursos, cuántos en español, idiomas,
  precio, valoraciones y duración
- **Given** esas cifras **When** se comparan con la base **Then** coinciden: se calculan al
  servir la página, no están escritas a mano
- **Given** un dato que una plataforma no publica (precio o valoración de Coursera) **When**
  se muestra **Then** se dice que no lo publica, nunca un cero
- **Given** la guía **When** la leo **Then** no afirma nada que los datos no sostengan (ni
  «es mejor», ni certificados, ni suscripciones), y enlaza a las categorías y temas donde
  cada plataforma tiene más cursos
- **Given** sus metadatos **When** se leen **Then** tiene título y descripción propios, es
  canónica de sí misma y declara migas de pan
- **Given** el sitemap y la portada **When** se recorren **Then** incluyen la guía

## Fuera de alcance

- **Opiniones o recomendaciones editoriales** («Coursera es mejor para…»). La guía dice lo
  que muestran los datos y deja la decisión a quien la lee.
- **Datos que no hay en el catálogo**: certificados, suscripciones, universidades, políticas
  de reembolso. Serían afirmaciones sin respaldo.
- **Más guías** (Udemy o Domestika…): solo hay dos plataformas en el catálogo.

## Diseño

- Vista `resumen_plataformas` (migración `0015`, `security_invoker`) con los agregados por
  plataforma: la web lee con la clave anónima y PostgREST no agrega.
- Funciones puras para el texto y el formato de las cifras; la página compone con datos.
- Mismo aspecto que las páginas de texto (`legal.module.css`) y una tabla comparativa que se
  desplaza sola en el móvil.

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: formato de cifras, datos ausentes como «no lo publica», texto sin
      afirmaciones fuera de los datos, metadatos
- [x] Integración: la vista cuenta lo mismo que una consulta directa
- [x] E2E: un test por criterio de aceptación
- [x] `/security-review` sin hallazgos críticos ni altos

## Estado

`Cerrada` (2026-09-15)

### Lo hecho

- Migración `0015`: tres vistas con `security_invoker`, `resumen_plataformas` (una fila por
  plataforma; el precio más repetido con `mode()` y la duración mediana con
  `percentile_cont`), `categorias_por_plataforma` y `temas_por_plataforma`. Leer las tres
  tarda ~110 ms en desarrollo.
- `src/lib/courses/guia-plataformas.ts`: la tabla, los textos y qué categorías y temas
  enlazar, en funciones puras. Los porcentajes nunca redondean a 100 % lo que no es todo:
  Udemy publica la duración en 11.398 de 11.400 cursos y se dice «99,9 %».
- Página `/guias/udemy-o-coursera` con el aspecto de las páginas de texto; la tabla se
  desplaza sola en el móvil y es enfocable con el teclado. Enlazada desde la portada (bajo
  las categorías) y en el sitemap. Añadida a la revisión móvil de HU-062.
- Solo se enlazan temas que superan el umbral (HU-060).

**Al desplegar**: aplicar `0015` en Supabase Cloud (solo crea vistas, no reescribe tablas).

### Resultado de los tests

- Unitarios (`npm test`): 772 pasan (18 nuevos).
- Integración (`npm run test:integration`): 145 pasan (3 nuevos).
- E2E (`npx playwright test`): 257, 256 a la primera. El que falló
  (paginación de temas, HU-058) fue una navegación que tardó más de 5 s con el servidor de
  desarrollo cargado; relanzado su fichero solo, pasa entero (10 de 10). Los 6 nuevos y la
  revisión móvil de la guía, en verde.

### Revisión de seguridad

Sin hallazgos. La página no recibe entrada del usuario. Las vistas se consultan con los
permisos de quien pregunta (`security_invoker`), solo se concede `select`, y exponen
recuentos de datos que ya son públicos por la RLS de `courses`. El JSON-LD pasa por
`serializeStructuredData`, que escapa `<`.
