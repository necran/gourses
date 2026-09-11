"use client";

import { useId } from "react";
import { MAX_COMPARADOS } from "../lib/courses/compare";
import { anadir, estaEnCesta, estaLlena, quitar } from "../lib/courses/cesta-comparar";
import { almacenCesta, useCesta } from "../lib/courses/almacen-cesta";
import { useHidratado } from "../lib/use-hidratado";
import styles from "./boton-cesta.module.css";

interface BotonCestaProps {
  courseId: string;
  title: string;
  /** Tamaño reducido, para tarjetas de lista (favoritos). */
  compacto?: boolean;
}

// Dos fichas una al lado de otra: es lo que hace "comparar" en este sitio.
function IconoComparar() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="7" height="16" rx="1.5" />
      <rect x="14" y="4" width="7" height="16" rx="1.5" />
    </svg>
  );
}

// Añadir o quitar un curso de la cesta de comparación (HU-041), igual en la
// ficha y en favoritos. No sale de la página: la barra de la cesta (HU-040)
// refleja el cambio.
//
// Sin JavaScript no hay cesta, así que se pinta como enlace a /buscar con el
// curso ya marcado (el camino de HU-031); al hidratar pasa a ser un botón.
export function BotonCesta({ courseId, title, compacto = false }: BotonCestaProps) {
  const hidratado = useHidratado();
  const cesta = useCesta();
  const idAviso = useId();
  const enCesta = estaEnCesta(cesta, courseId);
  const bloqueado = !enCesta && estaLlena(cesta);
  const clase = `${styles.boton} ${compacto ? styles.compacto : ""} ${enCesta ? styles.enCesta : ""}`;

  if (!hidratado) {
    return (
      <a href={`/buscar?preseleccionado=${encodeURIComponent(courseId)}`} className={clase}>
        <IconoComparar />
        Añadir a la comparación
      </a>
    );
  }

  return (
    <div className={styles.contenedor}>
      <button
        type="button"
        className={clase}
        disabled={bloqueado}
        aria-describedby={bloqueado ? idAviso : undefined}
        onClick={() =>
          almacenCesta().actualizar((c) =>
            enCesta ? quitar(c, courseId) : anadir(c, { id: courseId, titulo: title })
          )
        }
      >
        <IconoComparar />
        {enCesta ? "Quitar de la comparación" : "Añadir a la comparación"}
      </button>
      {bloqueado && (
        <p id={idAviso} className={styles.aviso}>
          Ya tienes {MAX_COMPARADOS} cursos para comparar. Quita uno en la barra de abajo para
          añadir este.
        </p>
      )}
    </div>
  );
}
