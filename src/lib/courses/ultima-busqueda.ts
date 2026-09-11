import { useSyncExternalStore } from "react";
import { parseCourseSearchFilters } from "./search-filters";
import { enlacePagina } from "./buscar-enlaces";

// La última búsqueda de esta pestaña (HU-042), para que «Volver a la búsqueda»
// en la ficha y en /comparar vuelva a ella con sus filtros, su orden y su
// página. En `sessionStorage`: es de esta pestaña y se borra al cerrarla.

export const CLAVE_ULTIMA_BUSQUEDA = "gourses:ultima-busqueda";

const ORIGEN_FICTICIO = "https://gourses.invalid";

// Lo guardado es entrada externa y acaba en un `href`: sin esto sería una
// redirección abierta. Solo vale una ruta /buscar de este mismo sitio, y ni
// siquiera se usa la cadena guardada: se reconstruye desde los filtros
// saneados, igual que los enlaces de paginación.
export function hrefUltimaBusqueda(guardado: string | null): string {
  if (!guardado) return "/buscar";

  let url: URL;
  try {
    url = new URL(guardado, ORIGEN_FICTICIO);
  } catch {
    return "/buscar";
  }
  if (url.origin !== ORIGEN_FICTICIO || url.pathname !== "/buscar") return "/buscar";

  const filtros = parseCourseSearchFilters(Object.fromEntries(url.searchParams));
  return enlacePagina(filtros, filtros.pagina);
}

export function recordarBusqueda(href: string): void {
  try {
    window.sessionStorage.setItem(CLAVE_ULTIMA_BUSQUEDA, href);
  } catch {
    // Sin almacenamiento, «Volver a la búsqueda» lleva a /buscar sin filtros.
  }
}

function leer(): string {
  try {
    return hrefUltimaBusqueda(window.sessionStorage.getItem(CLAVE_ULTIMA_BUSQUEDA));
  } catch {
    return "/buscar";
  }
}

// Mientras se está en la ficha o en /comparar la última búsqueda no cambia,
// así que no hace falta escuchar nada: basta con leerla al pintar.
const sinCambios = () => () => {};

export function useUltimaBusqueda(): string {
  return useSyncExternalStore(sinCambios, leer, () => "/buscar");
}
