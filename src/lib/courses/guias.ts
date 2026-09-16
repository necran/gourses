import { RUTA_GUIA as RUTA_GUIA_PLATAFORMAS, tituloGuia as tituloGuiaPlataformas } from "./guia-plataformas.ts";
import { RUTA_GUIA_PRECIOS, tituloGuiaPrecios } from "./guia-precios.ts";

// El índice de guías (HU-069). Las guías se declaran **aquí y solo aquí**: la
// página `/guias`, el sitemap y los enlaces del sitio leen de esta lista, así
// que publicar la próxima es añadir una línea y no acordarse de tres sitios.

export const RUTA_GUIAS = "/guias";

export interface Guia {
  ruta: string;
  titulo: string;
  /** Una frase de qué contesta la guía, para el índice. */
  resumen: string;
}

export const GUIAS: readonly Guia[] = [
  {
    ruta: RUTA_GUIA_PLATAFORMAS,
    titulo: tituloGuiaPlataformas(),
    resumen:
      "En qué se diferencian las dos plataformas del catálogo: cuántos cursos tiene cada una, " +
      "cuántos en español, y qué publica cada una sobre precio, valoraciones y duración.",
  },
  {
    ruta: RUTA_GUIA_PRECIOS,
    titulo: tituloGuiaPrecios(),
    resumen:
      "Qué se paga y cuántas horas se obtienen en cada materia, con los precios y las " +
      "duraciones de los cursos en español del catálogo.",
  },
];

export function tituloIndiceGuias(): string {
  return "Guías con datos del catálogo";
}

export function descripcionIndiceGuias(): string {
  const texto =
    `${GUIAS.length} guías hechas con los catálogos de Udemy y Coursera medidos con los mismos ` +
    "campos: precios reales, duraciones y qué publica cada plataforma.";
  return texto.length > 160 ? `${texto.slice(0, 159).trimEnd()}…` : texto;
}
