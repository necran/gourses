# HU-060 — Enlazar las páginas de tema desde el resto del sitio

## Contexto

Fase 6, tráfico orgánico (2026-09-15). HU-058 crea las páginas `/cursos/<tema>` y las
anuncia en el sitemap, pero una página a la que no enlaza nada del propio sitio se
descubre tarde y Google la considera menos importante (se vio con las categorías en
HU-056: cinco solo se encontraban por el sitemap). Esta parte se separó de HU-058 para
poder cerrar aquella antes.

## Como visitante que explora el sitio quiero llegar a los temas desde donde estoy para encontrar cursos de lo que me interesa sin buscar

## Criterios de aceptación

- **Given** la portada **When** recorro sus enlaces **Then** hay una sección de temas que
  lleva a las páginas de tema que superan el umbral, y a ninguna que no lo supere
- **Given** la página de una categoría **When** recorro sus enlaces **Then** enlaza a los
  temas que superan el umbral y cuya mayoría de cursos en español es de esa categoría
- **Given** la ficha de un curso cuyo título pertenece a un tema que supera el umbral
  **When** la abro **Then** enlaza a la página de ese tema
- **Given** un tema que baja del umbral **When** se recorren portada, categorías y fichas
  **Then** ninguna enlaza a él

## Fuera de alcance

- Crear las páginas de tema, clasificar los cursos o el sitemap: HU-058.
- Menús desplegables o navegación nueva en la cabecera.

## Diseño

- Reutiliza de HU-058 la columna `temas`, la lista cerrada y la función que decide si un
  tema supera el umbral. El recuento por tema se calcula una vez y se comparte.
- La categoría «dueña» de cada tema se calcula con los datos (la categoría con más cursos
  en español del tema), no se fija a mano.

## Checklist de tests (obligatorio antes de cerrar)

- [ ] Unitarios: categoría dueña de un tema (empates, tema sin cursos), temas enlazables
      según el umbral
- [ ] E2E: un test por criterio de aceptación
- [ ] `/security-review` sin hallazgos críticos ni altos

## Estado

`Abierta` (depende de HU-058)
