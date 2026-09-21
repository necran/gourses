import type { MetadataRoute } from "next";
import { TITULAR } from "../lib/legal/titular";

// Rastreadores que no traen visitas y sí gasto (HU-071). En Netlify cada
// petición es un cargo en créditos, y el sitio se pausó el 21 de septiembre de
// 2026 por agotarlos. Solo obedecen los que respetan robots.txt; para el resto
// haría falta el cortafuegos de Netlify.
//
// Son los de entrenamiento de IA y los de herramientas SEO de terceros. **No** se
// bloquean los buscadores ni los rastreadores de búsqueda con IA (OAI-SearchBot,
// PerplexityBot), que sí pueden traer visitas.
export const RASTREADORES_SIN_VALOR = [
  // Entrenamiento de modelos de IA
  "GPTBot",
  "ClaudeBot",
  "anthropic-ai",
  "CCBot",
  "Bytespider",
  "Amazonbot",
  "meta-externalagent",
  "Diffbot",
  "ImagesiftBot",
  "Omgilibot",
  "Timpibot",
  // Herramientas SEO y de análisis de terceros
  "AhrefsBot",
  "SemrushBot",
  "MJ12bot",
  "DotBot",
  "BLEXBot",
  "PetalBot",
  "DataForSeoBot",
  "MauiBot",
];

// Lo que no interesa rastrear a nadie:
//
// - `/buscar?…`: cada combinación de filtros es una dirección distinta con el
//   mismo contenido (ya va con `noindex`, HU-056), y es infinita. `/buscar` a
//   secas sí se rastrea.
// - `_rsc=`: son los datos internos de navegación de Next, no páginas. Google los
//   estaba rastreando: el 82 % de sus peticiones era «otro tipo de archivo».
// - Las páginas de cuenta y comparación, que además piden sesión o cursos elegidos.
export const RUTAS_SIN_INTERES = [
  "/buscar?",
  "/comparar",
  "/favoritos",
  "/mi-cuenta",
  "/acceder",
  "/boletin/",
  "/cuenta-borrada",
  "/*_rsc=",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: RUTAS_SIN_INTERES },
      { userAgent: RASTREADORES_SIN_VALOR, disallow: "/" },
    ],
    sitemap: `${TITULAR.url}/sitemap.xml`,
  };
}
