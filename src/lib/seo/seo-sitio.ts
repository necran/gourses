import type { CourseSearchFilters } from "../courses/search-filters.ts";
import { TITULAR } from "../legal/titular.ts";

// SEO del sitio en conjunto (HU-056), aparte de las fichas (course-seo.ts) y de
// las categorías (categoria-seo.ts). Funciones puras: se prueban sin montar
// ninguna página.

/** Nombre de marca, igual que en los títulos de la plantilla del layout. */
export const NOMBRE_SITIO = "Gourses";

/**
 * Imagen para compartir en redes (1200 × 630). Está en `public/` y se declara a
 * mano, no con el fichero especial `opengraph-image` de Next: una página que
 * declara su propio `openGraph` (las categorías) **sustituye entero** el del
 * layout, y con el fichero especial esas páginas se quedaban sin imagen
 * (comprobado en HU-056). Estática y no generada: generarla gastaría cómputo de
 * Netlify en cada visita de un rastreador de redes.
 */
export const IMAGEN_COMPARTIR = {
  url: "/imagen-compartir.png",
  width: 1200,
  height: 630,
  alt: "Gourses: compara cursos online de Udemy y Coursera a la vez, por precio, valoración y duración.",
  type: "image/png",
} as const;

/**
 * Lo común del `openGraph` de todas las páginas que no son una ficha. Cada una
 * lo extiende con su título y descripción; sin esto, al declarar su `openGraph`
 * perdería la imagen y el nombre del sitio.
 */
// Sin `as const` en el objeto: dejaría la lista de imágenes como solo lectura, y
// el tipo de metadatos de Next exige una lista normal.
export const OPEN_GRAPH_SITIO = {
  siteName: NOMBRE_SITIO,
  locale: "es_ES",
  type: "website" as const,
  images: [IMAGEN_COMPARTIR],
};

/**
 * Si una búsqueda merece estar en el índice de un buscador. Solo `/buscar` a
 * secas: cada combinación de palabra clave, filtros, orden o página es otra
 * dirección con casi el mismo contenido, y además las categorías ya tienen su
 * propia página (HU-046). Esas búsquedas se marcan `noindex, follow`: no se
 * indexan, pero sus enlaces a fichas se siguen.
 *
 * Los parámetros que no son filtros (una marca de campaña, `preseleccionado`)
 * no cuentan: no cambian los resultados, y la canónica ya los agrupa.
 */
export function busquedaIndexable(filters: CourseSearchFilters): boolean {
  return (
    filters.keyword === null &&
    filters.category === null &&
    filters.maxPrice === null &&
    filters.minRating === null &&
    filters.maxDuration === null &&
    filters.language === null &&
    filters.orden === null &&
    !filters.incluirSinDato &&
    filters.pagina === 1
  );
}

/** Dirección absoluta en el dominio canónico; los datos estructurados las exigen. */
export function urlAbsoluta(ruta: string): string {
  return new URL(ruta, TITULAR.url).toString();
}

/**
 * Qué es el sitio, para la portada: el sitio con su buscador (lo que permite a
 * Google ofrecer buscar dentro de él) y quién lo publica. Se enlazan por `@id`
 * en un solo bloque en vez de repetir la organización.
 */
export function datosEstructuradosSitio(): Record<string, unknown> {
  const idSitio = urlAbsoluta("/#sitio");
  const idOrganizacion = urlAbsoluta("/#organizacion");

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": idSitio,
        url: urlAbsoluta("/"),
        name: NOMBRE_SITIO,
        inLanguage: "es",
        publisher: { "@id": idOrganizacion },
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${urlAbsoluta("/buscar")}?keyword={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "Organization",
        "@id": idOrganizacion,
        name: NOMBRE_SITIO,
        url: urlAbsoluta("/"),
      },
    ],
  };
}

export interface Miga {
  nombre: string;
  /** Ruta dentro del sitio, p. ej. `/categoria/desarrollo`. */
  ruta: string;
}

/** Migas de pan (`BreadcrumbList`), de la portada a la página actual. */
export function migasDePan(migas: readonly Miga[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: migas.map((miga, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: miga.nombre,
      item: urlAbsoluta(miga.ruta),
    })),
  };
}
