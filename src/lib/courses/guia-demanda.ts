import type { SupabaseClient } from "@supabase/supabase-js";
import { conSeparadorDeMiles } from "../formato-numero.ts";
import { CATEGORY_LABELS, type CourseCategory } from "./categories.ts";
import { esCategoria } from "./categoria-seo.ts";

// Guía «qué categoría tiene más demanda, por alumnos inscritos» (HU-076). Las
// cifras salen de la vista `demanda_por_categoria` (migración 0021) al servir
// la página.
//
// Solo Udemy en español: Coursera no publica alumnos inscritos (0 de 262
// cursos en español lo tienen, comprobado al escribir esta guía).
//
// El número de cursos de una categoría no mide su demanda real: hay
// categorías sobreofertadas y categorías con menos oferta pero mucho más
// tirón por curso. La guía no dice qué estudiar, solo lo mide.

export const RUTA_GUIA_DEMANDA = "/guias/demanda-por-categoria";

export interface ResumenCategoriaDemanda {
  categoria: CourseCategory;
  cursos: number;
  alumnosMediana: number | null;
  alumnosMedia: number | null;
}

// ---------------------------------------------------------------- metadatos

export function tituloGuiaDemanda(): string {
  return "Qué categoría tiene más demanda, por alumnos inscritos";
}

export function descripcionGuiaDemanda(categorias: readonly ResumenCategoriaDemanda[]): string {
  const cursos = categorias.reduce((suma, c) => suma + c.cursos, 0);
  const texto =
    `Cuántos alumnos tiene de mediana un curso de Udemy en español según su materia, con ${conSeparadorDeMiles(
      cursos
    )} cursos medidos: el número de cursos no es lo mismo que la demanda real.`;
  return texto.length > 160 ? `${texto.slice(0, 159).trimEnd()}…` : texto;
}

// ---------------------------------------------------------------- tabla

export interface FilaDemanda {
  categoria: CourseCategory;
  etiqueta: string;
  cursos: number;
  alumnosMediana: string | null;
}

/** Una fila por categoría, de más a menos alumnos por curso: es el hallazgo de la guía. */
export function filasGuiaDemanda(categorias: readonly ResumenCategoriaDemanda[]): FilaDemanda[] {
  return [...categorias]
    .sort((a, b) => (b.alumnosMediana ?? 0) - (a.alumnosMediana ?? 0))
    .map((c) => ({
      categoria: c.categoria,
      etiqueta: CATEGORY_LABELS[c.categoria],
      cursos: c.cursos,
      alumnosMediana: c.alumnosMediana === null ? null : conSeparadorDeMiles(Math.round(c.alumnosMediana)),
    }));
}

// ---------------------------------------------------------------- texto

/**
 * Lo que se puede afirmar mirando la tabla, calculado: ni una frase escrita a
 * mano que mañana deje de ser verdad.
 */
export function conclusiones(categorias: readonly ResumenCategoriaDemanda[]): string[] {
  const conDatos = categorias.filter((c) => c.alumnosMediana !== null);
  const frases: string[] = [];

  if (conDatos.length > 1) {
    const porAlumnos = [...conDatos].sort((a, b) => (b.alumnosMediana ?? 0) - (a.alumnosMediana ?? 0));
    const masDemanda = porAlumnos[0];
    const menosDemanda = porAlumnos[porAlumnos.length - 1];
    const porCursos = [...conDatos].sort((a, b) => b.cursos - a.cursos);
    const masCursos = porCursos[0];

    frases.push(
      `${CATEGORY_LABELS[masDemanda.categoria]} tiene la mediana de alumnos por curso más alta: ` +
        `${conSeparadorDeMiles(Math.round(masDemanda.alumnosMediana!))}. ` +
        `${CATEGORY_LABELS[menosDemanda.categoria]} tiene la más baja: ` +
        `${conSeparadorDeMiles(Math.round(menosDemanda.alumnosMediana!))}.`
    );

    if (masCursos.categoria !== masDemanda.categoria && masCursos.alumnosMediana !== null) {
      const veces = masCursos.cursos / masDemanda.cursos;
      const vecesAlumnos = masDemanda.alumnosMediana! / masCursos.alumnosMediana;
      if (veces > 1.5 && vecesAlumnos > 1.5) {
        frases.push(
          `${CATEGORY_LABELS[masCursos.categoria]} tiene ${veces.toLocaleString("es-ES", { maximumFractionDigits: 1 })} ` +
            `veces más cursos que ${CATEGORY_LABELS[masDemanda.categoria]} (${conSeparadorDeMiles(
              masCursos.cursos
            )} frente a ${conSeparadorDeMiles(masDemanda.cursos)}), pero un curso de ` +
            `${CATEGORY_LABELS[masDemanda.categoria]} tiene de mediana ${vecesAlumnos.toLocaleString("es-ES", {
              maximumFractionDigits: 1,
            })} veces más alumnos inscritos: el número de cursos no mide la demanda real.`
        );
      }
    }

    const distorsionadas = conDatos.filter(
      (c) => c.alumnosMedia !== null && c.alumnosMediana !== null && c.alumnosMedia / c.alumnosMediana > 2
    );
    if (distorsionadas.length > 0) {
      frases.push(
        "Se usa la mediana, no la media: en categorías como " +
          distorsionadas
            .map((c) => CATEGORY_LABELS[c.categoria])
            .sort()
            .join(", ") +
          ", uno o dos cursos con muchísimos alumnos maquillarían el dato de toda la categoría si se promediara."
      );
    }
  }

  return frases;
}

// ---------------------------------------------------------------- lectura

interface FilaVista {
  category: string;
  cursos: number | string;
  alumnos_mediana: number | string | null;
  alumnos_media: number | string | null;
}

const n = (v: number | string) => Number(v);
const nn = (v: number | string | null) => (v === null ? null : Number(v));

export function aResumenCategoriaDemanda(f: FilaVista): ResumenCategoriaDemanda | null {
  // Una categoría que ya no esté en la lista cerrada no tiene ni etiqueta ni página.
  if (!esCategoria(f.category)) return null;
  return {
    categoria: f.category,
    cursos: n(f.cursos),
    alumnosMediana: nn(f.alumnos_mediana),
    alumnosMedia: nn(f.alumnos_media),
  };
}

export async function leerDemandaPorCategoria(client: SupabaseClient): Promise<ResumenCategoriaDemanda[]> {
  const { data, error } = await client.from("demanda_por_categoria").select("*");
  if (error) throw new Error(`Fallo al leer la demanda por categoría: ${error.message}`);
  return ((data ?? []) as FilaVista[])
    .map(aResumenCategoriaDemanda)
    .filter((r): r is ResumenCategoriaDemanda => r !== null);
}
