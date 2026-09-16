import type { SupabaseClient } from "@supabase/supabase-js";
import { conSeparadorDeMiles } from "../formato-numero.ts";
import { CATEGORY_LABELS, type CourseCategory } from "./categories.ts";
import { esCategoria } from "./categoria-seo.ts";
import { NO_LO_PUBLICA, euros, horas, porcentaje } from "./guia-plataformas.ts";
import { UMBRAL_CURSOS_EN_ESPANOL } from "./temas.ts";

// Guía «cuánto cuesta un curso» (HU-069). Las cifras salen de la vista
// `precios_por_categoria` (migración 0019) al servir la página.
//
// La guía no dice qué comprar: dice lo que se paga y lo que dura en cada
// materia, que es lo que no se puede saber sin tener los catálogos medidos.

export const RUTA_GUIA_PRECIOS = "/guias/cuanto-cuesta-un-curso";

/**
 * Por debajo de esto no se dan cifras de una categoría: idiomas tiene 4 cursos
 * en español, y de cuatro cursos no sale ninguna «duración típica». Es el mismo
 * umbral con el que se decide publicar una página de tema (HU-058).
 */
export const MUESTRA_MINIMA = UMBRAL_CURSOS_EN_ESPANOL;

export interface ResumenCategoria {
  categoria: CourseCategory;
  cursos: number;
  conPrecio: number;
  precioHabitualEur: number | null;
  precioMinimoEur: number | null;
  precioMaximoEur: number | null;
  conDuracion: number;
  duracionMedianaMinutos: number | null;
  conRespaldo: number;
}

// ---------------------------------------------------------------- metadatos

export function tituloGuiaPrecios(): string {
  return "Cuánto cuesta un curso online en español, por materia";
}

export function descripcionGuiaPrecios(categorias: readonly ResumenCategoria[]): string {
  const cursos = categorias.reduce((suma, c) => suma + c.cursos, 0);
  const texto =
    `Qué se paga y cuánto dura un curso en español según la materia, con ${conSeparadorDeMiles(cursos)} ` +
    "cursos de Udemy y Coursera medidos con los mismos campos.";
  return texto.length > 160 ? `${texto.slice(0, 159).trimEnd()}…` : texto;
}

// ---------------------------------------------------------------- tabla

export interface CeldaPrecios {
  texto: string;
  /** Falso cuando la plataforma no publica el dato o la muestra es pequeña. */
  publicado: boolean;
}

export interface FilaPrecios {
  categoria: CourseCategory;
  etiqueta: string;
  cursos: number;
  /** Si la muestra da para dar cifras. */
  suficiente: boolean;
  precio: CeldaPrecios;
  duracion: CeldaPrecios;
  respaldo: CeldaPrecios;
}

const SIN_DATOS: CeldaPrecios = { texto: "Pocos cursos para decirlo", publicado: false };
const NO_PUBLICA: CeldaPrecios = { texto: NO_LO_PUBLICA, publicado: false };

export function muestraSuficiente(resumen: ResumenCategoria): boolean {
  return resumen.cursos >= MUESTRA_MINIMA;
}

function celdaPrecio(r: ResumenCategoria): CeldaPrecios {
  if (!muestraSuficiente(r)) return SIN_DATOS;
  // Cero cursos con precio no es «gratis»: es que esa materia, en español, son
  // cursos de Coursera, que no publica precio (HU-063).
  if (r.conPrecio === 0 || r.precioHabitualEur === null) return NO_PUBLICA;

  const rango =
    r.precioMinimoEur !== null && r.precioMaximoEur !== null && r.precioMaximoEur > r.precioMinimoEur
      ? ` (de ${euros(r.precioMinimoEur)} a ${euros(r.precioMaximoEur)})`
      : "";
  return { texto: `${euros(r.precioHabitualEur)}${rango}`, publicado: true };
}

function celdaDuracion(r: ResumenCategoria): CeldaPrecios {
  if (!muestraSuficiente(r)) return SIN_DATOS;
  if (r.conDuracion === 0 || r.duracionMedianaMinutos === null) return NO_PUBLICA;
  return { texto: `${horas(r.duracionMedianaMinutos)} de mediana`, publicado: true };
}

function celdaRespaldo(r: ResumenCategoria): CeldaPrecios {
  if (!muestraSuficiente(r)) return SIN_DATOS;
  return {
    texto: `${conSeparadorDeMiles(r.conRespaldo)} (${porcentaje(r.conRespaldo, r.cursos)})`,
    publicado: true,
  };
}

/** Una fila por categoría, de más a menos cursos en español. */
export function filasGuiaPrecios(categorias: readonly ResumenCategoria[]): FilaPrecios[] {
  return [...categorias]
    .sort((a, b) => b.cursos - a.cursos || a.categoria.localeCompare(b.categoria))
    .map((r) => ({
      categoria: r.categoria,
      etiqueta: CATEGORY_LABELS[r.categoria],
      cursos: r.cursos,
      suficiente: muestraSuficiente(r),
      precio: celdaPrecio(r),
      duracion: celdaDuracion(r),
      respaldo: celdaRespaldo(r),
    }));
}

// ---------------------------------------------------------------- texto

/**
 * Lo que se puede afirmar mirando la tabla, calculado: ni una frase escrita a
 * mano que mañana deje de ser verdad.
 */
export function conclusiones(categorias: readonly ResumenCategoria[]): string[] {
  const conCifras = categorias.filter(muestraSuficiente);
  const conPrecio = conCifras.filter((c) => c.precioHabitualEur !== null);
  const frases: string[] = [];

  if (conPrecio.length > 0) {
    const habituales = new Set(conPrecio.map((c) => c.precioHabitualEur));
    if (habituales.size === 1) {
      frases.push(
        `El precio más repetido es el mismo en las ${conPrecio.length} materias que publican precio: ` +
          `${euros(conPrecio[0].precioHabitualEur!)}. Lo que cambia de una a otra no es lo que suele costar ` +
          "un curso, sino hasta dónde llegan los más caros y cuántas horas dan por ese dinero."
      );
    }

    const masCaro = [...conPrecio].sort((a, b) => (b.precioMaximoEur ?? 0) - (a.precioMaximoEur ?? 0))[0];
    const menosCaro = [...conPrecio].sort((a, b) => (a.precioMaximoEur ?? 0) - (b.precioMaximoEur ?? 0))[0];
    if (masCaro !== menosCaro && masCaro.precioMaximoEur !== null && menosCaro.precioMaximoEur !== null) {
      frases.push(
        `El curso más caro de ${CATEGORY_LABELS[masCaro.categoria]} cuesta ${euros(masCaro.precioMaximoEur)}; ` +
          `en ${CATEGORY_LABELS[menosCaro.categoria]}, el techo se queda en ${euros(menosCaro.precioMaximoEur)}.`
      );
    }
  }

  const conDuracion = conCifras.filter((c) => c.duracionMedianaMinutos !== null);
  if (conDuracion.length > 1) {
    const ordenadas = [...conDuracion].sort(
      (a, b) => (b.duracionMedianaMinutos ?? 0) - (a.duracionMedianaMinutos ?? 0)
    );
    const larga = ordenadas[0];
    const corta = ordenadas[ordenadas.length - 1];
    frases.push(
      `Por horas, un curso de ${CATEGORY_LABELS[larga.categoria]} dura ${horas(larga.duracionMedianaMinutos!)} ` +
        `de mediana y uno de ${CATEGORY_LABELS[corta.categoria]}, ${horas(corta.duracionMedianaMinutos!)}.`
    );
  }

  const pocas = categorias.filter((c) => !muestraSuficiente(c));
  if (pocas.length > 0) {
    const nombres = pocas
      .sort((a, b) => a.categoria.localeCompare(b.categoria))
      .map((c) => CATEGORY_LABELS[c.categoria]);
    frases.push(
      `De ${nombres.join(", ")} hay menos de ${MUESTRA_MINIMA} cursos en español en el catálogo: ` +
        "muy pocos para hablar de un precio o una duración típicos."
    );
  }

  return frases;
}

// ---------------------------------------------------------------- lectura

interface FilaVista {
  category: string;
  cursos: number | string;
  con_precio: number | string;
  precio_habitual_eur: number | string | null;
  precio_minimo_eur: number | string | null;
  precio_maximo_eur: number | string | null;
  con_duracion: number | string;
  duracion_mediana_minutos: number | string | null;
  con_respaldo: number | string;
}

const n = (v: number | string) => Number(v);
const nn = (v: number | string | null) => (v === null ? null : Number(v));

export function aResumenCategoria(f: FilaVista): ResumenCategoria | null {
  // La categoría llega de la base, pero la lista cerrada manda: una categoría
  // que ya no existe en el código no tiene ni etiqueta ni página.
  if (!esCategoria(f.category)) return null;
  return {
    categoria: f.category,
    cursos: n(f.cursos),
    conPrecio: n(f.con_precio),
    precioHabitualEur: nn(f.precio_habitual_eur),
    precioMinimoEur: nn(f.precio_minimo_eur),
    precioMaximoEur: nn(f.precio_maximo_eur),
    conDuracion: n(f.con_duracion),
    duracionMedianaMinutos: nn(f.duracion_mediana_minutos),
    conRespaldo: n(f.con_respaldo),
  };
}

export async function leerPreciosPorCategoria(client: SupabaseClient): Promise<ResumenCategoria[]> {
  const { data, error } = await client.from("precios_por_categoria").select("*");
  if (error) throw new Error(`Fallo al leer los precios por categoría: ${error.message}`);
  return ((data ?? []) as FilaVista[])
    .map(aResumenCategoria)
    .filter((r): r is ResumenCategoria => r !== null);
}
