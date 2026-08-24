# HU-028 — Decir cuántos resultados hay

## Contexto

Deuda anotada al cerrar HU-025 y HU-027. El buscador sabe si hay página siguiente, pero
no dice cuántos resultados hay. Con 8.796 cursos en el catálogo, eso deja al visitante
sin la información que decide lo siguiente que va a hacer: si su búsqueda ha devuelto 12
resultados no hace falta afinarla, y si ha devuelto 3.000 no tiene sentido ir pasando
páginas — hay que filtrar.

Hoy la única señal es «Siguiente», que dice lo mismo con 51 resultados que con 8.000.

Es barato: la cuenta la puede dar la misma consulta que ya se hace (`count` de PostgREST),
sin una petición extra por fuente.

## Como visitante quiero saber cuántos cursos ha encontrado mi búsqueda para decidir si afinarla o ponerme a mirarlos

## Criterios de aceptación

- **Given** el buscador sin filtros **When** lo abro **Then** veo cuántos cursos hay

- **Given** una búsqueda con una palabra clave **When** la hago **Then** el número que
  veo es el de esa búsqueda, menor que el del catálogo entero

- **Given** una búsqueda sin resultados **When** la hago **Then** se me dice que no hay
  ninguno, no un cero suelto

- **Given** que estoy en la segunda página **When** miro el número **Then** sigue siendo
  el total de la búsqueda, no el de los cursos de esta página

## Fuera de alcance

- Decir cuántas páginas hay o poder saltar a una concreta.
- Contar por plataforma («4.796 de Udemy, 4.000 de Coursera»).
- Cambiar el número de resultados por página.

## Cuidados

- El total tiene que contar **lo que cumple los filtros**, no lo que cabe en la página.
- En el camino de reparto equilibrado hay una consulta por fuente: el total es la suma
  de las dos, no el de una.
- Singular y plural: «1 curso», no «1 cursos».
- La cuenta va en la misma consulta que ya se hacía, sin peticiones extra.

## Checklist de tests (obligatorio antes de cerrar)

- [ ] Unitarios: el texto del recuento (cero, uno, muchos, miles)
- [ ] Integración: el total es el de la búsqueda y no cambia al pasar de página, en los
      dos caminos de consulta (con orden y sin orden)
- [ ] E2E: un test por cada criterio de aceptación de arriba
- [ ] `/security-review` sin hallazgos críticos ni altos

## Estado

`En progreso`
