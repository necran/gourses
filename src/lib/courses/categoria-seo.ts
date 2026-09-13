import { CATEGORY_LABELS, COURSE_CATEGORIES, type CourseCategory } from "./categories";

// Lo que necesita una página de categoría para presentarse ante un buscador
// (HU-046). Aparte del componente para poder probarlo sin renderizar nada.

// El identificador llega por la dirección, así que es entrada externa: solo
// vale si está en la lista cerrada de categorías. Nada de normalizar
// mayúsculas ni acentos — `/categoria/Desarrollo` no es una dirección de este
// sitio, y aceptarla crearía dos direcciones para la misma página.
export function esCategoria(slug: string | undefined): slug is CourseCategory {
  return typeof slug === "string" && (COURSE_CATEGORIES as readonly string[]).includes(slug);
}

// «Cursos de Desarrollo». Se usa igual como <h1> y como título de la pestaña:
// si el titular de la página y el título del buscador dijeran cosas distintas,
// quien llega desde Google sentiría que ha aterrizado en otro sitio.
//
// La etiqueta va tal cual, sin pasarla a minúscula: «IT y software» perdería
// su forma («iT y software») por ganar poco.
export function tituloCategoria(categoria: CourseCategory): string {
  return `Cursos de ${CATEGORY_LABELS[categoria]}`;
}

// Descripción para los resultados de búsqueda. Lleva el número de cursos
// porque es lo que distingue a este sitio de la web de una sola plataforma, y
// se queda por debajo de los 160 caracteres que corta Google.
export function descripcionCategoria(categoria: CourseCategory, total: number): string {
  const cuantos =
    total === 1 ? "1 curso" : `${total.toLocaleString("es-ES")} cursos`;

  const texto =
    `Compara ${cuantos} de ${CATEGORY_LABELS[categoria]} de Udemy y Coursera: ` +
    "precio, valoración, duración e idioma, uno al lado del otro.";

  return texto.length > 160 ? texto.slice(0, 159).trimEnd() + "…" : texto;
}

// La dirección de la propia página, que también es su canónica. La primera
// página no lleva `?pagina=1`: sería otra dirección para el mismo contenido.
export function enlaceCategoria(categoria: CourseCategory, pagina = 1): string {
  return pagina > 1 ? `/categoria/${categoria}?pagina=${pagina}` : `/categoria/${categoria}`;
}
