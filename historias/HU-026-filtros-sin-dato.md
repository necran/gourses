# HU-026 — Que filtrar por precio no borre media web

## Contexto

Deuda detectada al cerrar HU-025. En cuanto alguien escribe un precio máximo o una
valoración mínima en el buscador, **desaparecen los 4.000 cursos de Coursera**, casi la
mitad del catálogo (8.796), sin decir nada.

No es un fallo de escritura: es lo que hace SQL. `price_amount <= 20` es `NULL` cuando
no hay precio, y una condición nula no se cumple, así que la fila se descarta. Lo mismo
con `rating >= 4`. Y da la casualidad de que **ningún** curso de Coursera tiene precio ni
valoración: no es que falten algunos, es que su API no publica esos campos y no hay forma
de pedirlos (verificado el 2026-08-24, ver `docs/analisis-y-estrategia.md`).

El resultado es que un filtro de precio convierte el comparador en un buscador de solo
Udemy, y quien lo usa no tiene manera de enterarse. Es justo lo contrario de lo que dice
la propia página de comparar:

> «Un hueco significa que esa plataforma no publica ese dato, no que el curso valga cero.»

Excluirlos por defecto es defendible —quien pide «menos de 20 €» no quiere ruido de
precio desconocido—. Lo que no es defendible es hacerlo **en silencio** y sin salida.

## Como visitante quiero enterarme de que un filtro está dejando fuera media web, y poder incluirla, para no creer que el catálogo es la mitad de lo que es

## Criterios de aceptación

- **Given** una búsqueda con precio máximo **When** la hago **Then** se me avisa de que
  los cursos que no publican precio quedan fuera, y de cómo incluirlos

- **Given** ese aviso **When** pulso para incluirlos **Then** vuelven a aparecer cursos
  de Coursera junto a los que cumplen el precio

- **Given** una búsqueda con valoración mínima **When** la hago **Then** recibo el mismo
  aviso, porque Coursera tampoco publica valoraciones

- **Given** una búsqueda sin filtro de precio ni de valoración **When** la hago **Then**
  no aparece ningún aviso, porque no se está dejando nada fuera

- **Given** que he incluido los cursos sin ese dato **When** paso de página **Then**
  siguen incluidos

## Fuera de alcance

- Inventar precios o valoraciones para Coursera. No se pueden obtener.
- Ordenar por precio o valoración.
- Cambiar el comportamiento por defecto: sin pedirlo, los cursos sin ese dato siguen
  quedando fuera del filtro. Lo que cambia es que se sepa.

## Cuidados

- El aviso solo aparece cuando de verdad hay un filtro que excluye por falta de dato.
  Un aviso permanente es ruido y se deja de leer.
- Sin JavaScript de cliente: el buscador va con formularios y enlaces (HU-007, HU-025).
- La elección tiene que viajar en la dirección, como el resto de filtros, para que el
  enlace compartido enseñe lo mismo.

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: saneado de la opción y cuándo procede avisar
- [x] Integración: con la opción puesta aparecen cursos sin precio; sin ella, no
- [x] E2E: un test por cada criterio de aceptación de arriba
- [x] `/security-review` sin hallazgos críticos ni altos

## Estado

`Cerrada`

Unitarios (14 nuevos), integración (7) y e2e (5, uno por criterio). Suites completas en
verde: 323 unitarios, 81 de integración, 81 e2e. `/security-review` sin hallazgos.

## Lo que hubo que comprobar contra la base, no razonar

**Que PostgREST combine los dos `.or()` con Y y no con O.** Se añade uno por el precio y
otro por la valoración, además del que ya usaba la palabra clave. Si los combinara con O,
pedir «menos de 20 € y más de 4 estrellas» habría devuelto cursos que no cumplen ninguna
de las dos. Los ANDea, y hay un test que lo fija: si algún día cambiara, se vería.

**Que el precio quepa en el filtro.** Al pasar de `.lte(campo, n)` —donde el valor lo
serializa supabase-js— a interpolarlo en el texto del filtro, el precio máximo pasó a
importar como cadena. No tenía tope, y `String(1e21)` da `"1e+21"`, que allí no significa
nada. Se capó a 100.000; ningún curso se acerca. El caso contrario, `1e-7`, se probó
contra la base real: Postgres lo lee como numérico sin error.

## Lo que NO cambia

Por defecto los cursos sin precio siguen quedando fuera del filtro de precio. Quien pide
«menos de 20 €» no quiere ruido de precio desconocido, y eso era razonable desde el
principio. Lo que no era defendible es hacerlo en silencio: la propia página de comparar
promete que «un hueco significa que esa plataforma no publica ese dato, no que el curso
valga cero», y el filtro los trataba como si valieran infinito.

## Deuda que sigue abierta

- No se puede ordenar los resultados por precio ni por valoración.
- El buscador no dice cuántos resultados hay en total, solo si hay más.
