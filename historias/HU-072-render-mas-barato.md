# HU-072 — Que construir una página tarde menos, y por tanto cueste menos

## Contexto

Fase 6, hosting (2026-09-21). Tras HU-071 cada visita es una sola petición al servidor, pero
esa petición sigue siendo lenta: medido en producción, ya calentada, la mediana de respuesta
de la portada era **1.632 ms**, el buscador 851, una categoría 589 y una ficha 511. La página
de privacidad, que no toca la base de datos, tarda 263. En Netlify se paga la ejecución de
cada función por el tiempo que dura, así que una página lenta es una página cara.

### Dónde se iba el tiempo

- **La base de datos no es el problema.** Medido con `EXPLAIN ANALYZE` sobre producción, cada
  consulta se ejecuta dentro de Supabase en menos de 6 ms, salvo la vista de temas (20 ms).
- **Los viajes sí.** Las funciones de Netlify están en Virginia (`IAD`, EE. UU. este) y
  Supabase en Irlanda. La región de las funciones solo se puede cambiar en el plan Pro
  («Upgrade to customize»), así que cada consulta paga un viaje transatlántico que no se
  puede quitar. Lo que sí se puede es **no encadenarlos**.
- La portada esperaba cinco lecturas una detrás de otra (el resumen del catálogo, que a su vez
  pedía el total y *después* los de cada fuente; los temas; las novedades; los destacados), y
  la ficha pedía el curso y *después* su histórico de precio, cuando el id del histórico ya se
  tenía desde el principio.

## Como responsable del sitio quiero que las lecturas que no dependen unas de otras se pidan a la vez, para que cada página responda antes y gaste menos créditos

## Criterios de aceptación

- **Given** el resumen del catálogo **When** se calcula **Then** el total y el recuento de cada
  plataforma se piden a la vez, y sigue dando el mismo resultado, incluida la plataforma sin
  cursos y los fallos parciales
- **Given** una ficha **When** se lee **Then** el curso y su histórico de precio se piden a la
  vez; un curso inexistente sigue dando «no encontrado» y un fallo en cualquiera de las dos
  lecturas sigue dando error
- **Given** la portada **When** carga **Then** el resumen, los temas, las novedades y los
  destacados se leen a la vez, y cada uno sigue fallando por separado sin tumbar la página
- **Given** una ficha **When** se genera **Then** el curso se lee una sola vez por petición, no
  una para los metadatos y otra para la página
- **Given** el contenido de esas páginas **When** se compara con el de antes **Then** es el
  mismo: no cambia nada de lo que se ve (lo cubren los tests e2e y de integración existentes)

## Fuera de alcance

- **Cambiar la región de las funciones**: exige el plan Pro.
- **Cachear resultados en memoria**: descartado con datos. Las consultas duran milisegundos
  dentro de la base; lo que se ahorraría es el viaje, y con las lecturas ya en paralelo el
  ahorro adicional es pequeño frente al riesgo de servir datos obsoletos y de que los tests
  que siembran filas vean lecturas viejas.
- **El resto de páginas**: `/buscar`, categorías, temas y novedades ya tienen pocas lecturas
  encadenadas (una o dos, y las de categoría y tema ya iban en paralelo). Se mira con la
  medición en producción.
- **Asegurar tiempos concretos en CI**: los tiempos son intermitentes. Los tests comprueban que
  las lecturas se piden a la vez, no cuánto tardan.

## Diseño

- `getCatalogSummary` pide el total y los de cada plataforma en un `Promise.all`.
- `getCourseById` pide el curso y el histórico en un `Promise.all`.
- La portada lee sus cuatro bloques en un `Promise.all`, cada uno con su propio `.catch` para
  que un fallo no tumbe la página, como antes.
- La ficha lee el curso con `React.cache`, así `generateMetadata` y la página comparten la
  lectura.
- Los tests usan un cliente de Supabase falso en el que ninguna consulta responde hasta que el
  test lo decide: si todas las consultas están «en marcha» antes de que responda la primera,
  se pidieron a la vez.

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: las lecturas se piden a la vez y conservan su comportamiento ante fallos
- [x] Comprobado que esos tests **fallan con el código secuencial antiguo** (una consulta en
      marcha en vez de tres; solo `courses` en vez de las dos tablas)
- [x] Integración: la portada y la ficha dan lo mismo que antes
- [x] E2E: suite completa sin regresiones
- [x] `/security-review` sin hallazgos críticos ni altos

## Estado

`Cerrada` (2026-09-21)

### Resultado de los tests

- Unitarios (`npm test`): 846 pasan (8 nuevos).
- Integración (`npm run test:integration`): 162 pasan.
- E2E (`npx playwright test`): 290 pasan en 2,5 min, sin fallos.

### Revisión de seguridad

Sin hallazgos. Solo cambia el orden en que se piden las lecturas; las consultas, sus filtros y
la RLS son los mismos. El id de la ficha se sigue validando como UUID antes de consultar.
Un id con forma válida pero inexistente ahora dispara también la consulta del histórico
(descartada al no haber curso): una lectura de más, sin dato alguno expuesto.

### Medición en producción

Se anota al final, tras desplegar.
