"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { MAX_COMPARADOS } from "../lib/courses/compare";
import {
  anadir,
  estaEnCesta,
  estaLlena,
  hrefComparar,
  quitar,
} from "../lib/courses/cesta-comparar";
import { almacenCesta, useCesta } from "../lib/courses/almacen-cesta";
import styles from "./barra-comparar.module.css";

// Cabecera del formulario "Comparar seleccionados" (HU-017) de /buscar.
//
// Sin JavaScript es un botón de envío normal: el formulario GET manda a
// /comparar las casillas marcadas en esta página. Con JavaScript manda la cesta
// entera (HU-040), que incluye lo marcado en otras páginas o desde otras
// pestañas.
export function BarraComparar() {
  const router = useRouter();

  return (
    <div className={styles.barraComparar}>
      <button
        type="submit"
        className={styles.botonComparar}
        onClick={(evento) => {
          evento.preventDefault();
          router.push(hrefComparar(almacenCesta().obtener()));
        }}
      >
        Comparar seleccionados
      </button>
      <span className={styles.ayudaComparar}>Marca de 2 a {MAX_COMPARADOS} cursos</span>
    </div>
  );
}

interface CasillaCompararProps {
  courseId: string;
  title: string;
  /** Llega desde una ficha con `?preseleccionado=` (HU-031). */
  defaultChecked?: boolean;
}

// Mismo `name="ids"` que recoge parseCompareIds, para que el formulario siga
// funcionando sin JavaScript. Con JavaScript, la casilla refleja la cesta
// (HU-040) y cada cambio la actualiza.
//
// Se deja sin controlar (`defaultChecked`, no `checked`) a propósito: lo que se
// marque antes de que cargue el script, o lo que venga preseleccionado, está
// ya en el DOM al hidratar y se suma a la cesta en vez de perderse.
export function CasillaComparar({ courseId, title, defaultChecked }: CasillaCompararProps) {
  const cesta = useCesta();
  const casilla = useRef<HTMLInputElement>(null);
  const sincronizada = useRef(false);
  const enCesta = estaEnCesta(cesta, courseId);
  const bloqueada = !enCesta && estaLlena(cesta);

  useEffect(() => {
    const input = casilla.current;
    if (!input) return;

    if (!sincronizada.current) {
      sincronizada.current = true;
      if (input.checked) {
        // Se consulta el almacén y no `enCesta`: en el primer render tras
        // hidratar, la cesta pintada todavía es la vacía del servidor.
        const actual = almacenCesta().actualizar((c) => anadir(c, { id: courseId, titulo: title }));
        input.checked = estaEnCesta(actual, courseId);
        return;
      }
    }
    input.checked = enCesta;
  }, [enCesta, courseId, title]);

  return (
    <input
      ref={casilla}
      type="checkbox"
      name="ids"
      value={courseId}
      className={styles.casilla}
      aria-label={`Seleccionar ${title} para comparar`}
      defaultChecked={defaultChecked}
      disabled={bloqueada}
      title={bloqueada ? `Ya tienes el máximo de ${MAX_COMPARADOS} cursos marcados` : undefined}
      onChange={(evento) => {
        const input = evento.currentTarget;
        const marcar = input.checked;
        const actual = almacenCesta().actualizar((c) =>
          marcar ? anadir(c, { id: courseId, titulo: title }) : quitar(c, courseId)
        );
        input.checked = estaEnCesta(actual, courseId);
      }}
    />
  );
}
