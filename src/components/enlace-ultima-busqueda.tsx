"use client";

import type { ReactNode } from "react";
import Link from "./enlace";
import { useUltimaBusqueda } from "../lib/courses/ultima-busqueda";

// Enlace a la última búsqueda de esta pestaña (HU-042). Se pinta en el
// servidor apuntando a /buscar, que es lo que queda sin JavaScript o si se
// llega directamente, y al hidratar pasa a la búsqueda guardada.
export function EnlaceUltimaBusqueda({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link href={useUltimaBusqueda()} className={className}>
      {children}
    </Link>
  );
}
