"use client";

import { useEffect } from "react";
import { reemplazar, type CursoEnCesta } from "../../lib/courses/cesta-comparar";
import { almacenCesta } from "../../lib/courses/almacen-cesta";

// Abrir una comparación la convierte en la comparación en curso (HU-042):
// quien la está viendo es con esos cursos con los que va a seguir, venga de su
// propia cesta o de un enlace compartido.
//
// Recibe los cursos que el servidor ha encontrado en el catálogo, no los ids
// de la URL: un id inventado o un curso retirado nunca llega a la cesta.
export function AdoptarComparacion({ cursos }: { cursos: CursoEnCesta[] }) {
  useEffect(() => {
    almacenCesta().actualizar((cesta) => reemplazar(cesta, cursos));
  }, [cursos]);
  return null;
}
