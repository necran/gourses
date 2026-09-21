"use client";

import Link from "./enlace";
import { MAX_COMPARADOS, MIN_COMPARADOS } from "../lib/courses/compare";
import {
  estaLlena,
  hrefComparar,
  nombreEnCesta,
  quitar,
  vaciar,
} from "../lib/courses/cesta-comparar";
import { almacenCesta, useAnuncioCesta, useCesta } from "../lib/courses/almacen-cesta";
import styles from "./barra-cesta.module.css";

// Barra de la cesta de comparación (HU-040), en todas las páginas. Va al final
// del <body> con `position: sticky`: se queda pegada abajo mientras se baja por
// la página y, al llegar al final, se apoya tras el pie en vez de taparlo.
//
// No se pinta en el servidor, que no conoce la cesta: aparece al hidratar.
export function BarraCesta() {
  const cesta = useCesta();
  const anuncio = useAnuncioCesta();
  const puedeComparar = cesta.length >= MIN_COMPARADOS;

  return (
    <>
      {/* Sin role="status" a propósito: varias páginas ya tienen el suyo y
          esto es solo el anuncio de un cambio, no el estado de la página. */}
      <p className={styles.oculto} aria-live="polite" aria-atomic="true">
        {anuncio}
      </p>

      {cesta.length > 0 && (
        <aside className={styles.barra} aria-label="Cursos marcados para comparar">
          <div className={styles.contenido}>
            <p className={styles.recuento}>
              <strong>{cesta.length}</strong> de {MAX_COMPARADOS} para comparar
            </p>

            <ul className={styles.cursos}>
              {cesta.map((curso) => (
                <li key={curso.id} className={styles.curso}>
                  <span className={styles.titulo} title={nombreEnCesta(curso)}>
                    {nombreEnCesta(curso)}
                  </span>
                  <button
                    type="button"
                    className={styles.quitar}
                    aria-label={`Quitar ${nombreEnCesta(curso)} de la comparación`}
                    onClick={() => almacenCesta().actualizar((c) => quitar(c, curso.id))}
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                </li>
              ))}
            </ul>

            <div className={styles.acciones}>
              <button
                type="button"
                className={styles.vaciar}
                onClick={() => almacenCesta().actualizar(vaciar)}
              >
                Vaciar
              </button>
              {puedeComparar ? (
                <Link href={hrefComparar(cesta)} className={styles.comparar}>
                  Comparar
                </Link>
              ) : (
                <button type="button" className={styles.comparar} disabled>
                  Comparar
                </button>
              )}
            </div>
          </div>

          {!puedeComparar && (
            <p className={styles.ayuda}>Marca al menos otro curso para poder compararlos.</p>
          )}
          {estaLlena(cesta) && (
            <p className={styles.ayuda}>
              Ya tienes el máximo de {MAX_COMPARADOS}. Quita uno para añadir otro.
            </p>
          )}
        </aside>
      )}
    </>
  );
}
