"use client";

import { useEffect } from "react";
import { recordarBusqueda } from "../../lib/courses/ultima-busqueda";

// Guarda en esta pestaña la búsqueda que se está viendo, para que «Volver a la
// búsqueda» de la ficha y de /comparar vuelva a ella (HU-042). `href` llega
// ya construido en el servidor con los filtros saneados.
export function RecordarBusqueda({ href }: { href: string }) {
  useEffect(() => {
    recordarBusqueda(href);
  }, [href]);
  return null;
}
