import type { SupabaseClient } from "@supabase/supabase-js";
import type { DurationRange } from "./duration.ts";
import { formatDuration } from "./duration.ts";
import { conSeparadorDeMiles } from "../formato-numero.ts";
import {
  RESENAS_MINIMAS,
  TEMAS,
  nombreEnFrase,
  type RecuentoTema,
  type TemaId,
} from "./temas.ts";

// Datos y textos de las páginas /cursos/<tema> (HU-058). Lo que decide qué se
// dice está en funciones puras, para probarlo sin base de datos; la lectura, en
// funciones aparte y pequeñas.
//
// Todo el texto sale de los datos del catálogo. Nada de frases de relleno por
// tema: son las que convierten treinta páginas en contenido fino hecho en masa.

export interface CursoDeTema {
  id: string;
  source: string;
  title: string;
  description: string | null;
  priceAmount: number | null;
  priceCurrency: string | null;
  rating: number | null;
  numReviews: number | null;
  level: string | null;
  language: string | null;
  imageUrl: string | null;
  duration: DurationRange | null;
}

// ---------------------------------------------------------------- textos y enlaces

/** «Cursos de Python en español». Igual en el titular y en la pestaña. */
export function tituloTema(tema: TemaId): string {
  return `Cursos de ${nombreEnFrase(tema)} en español`;
}

// `conSeparadorDeMiles` y no `toLocaleString("es-ES")`: esta última no agrupa los
// números de cuatro cifras («1542»), y en el resto del sitio se lee «1.542».
const plural = (n: number, uno: string, varios: string) =>
  `${conSeparadorDeMiles(n)} ${n === 1 ? uno : varios}`;

/** Descripción para los resultados de búsqueda, por debajo de los 160 caracteres. */
export function descripcionTema(tema: TemaId, enEspanol: number): string {
  const texto =
    `Compara ${plural(enEspanol, "curso", "cursos")} de ${nombreEnFrase(tema)} en español ` +
    "de Udemy y Coursera: valoración, duración y precio, uno al lado del otro.";
  return texto.length > 160 ? texto.slice(0, 159).trimEnd() + "…" : texto;
}

/** Dirección de la página, que es también su canónica. La primera no lleva `?pagina=1`. */
export function enlaceTema(tema: TemaId, pagina = 1): string {
  return pagina > 1 ? `/cursos/${tema}?pagina=${pagina}` : `/cursos/${tema}`;
}

// ---------------------------------------------------------------- resumen

export interface ResumenTema {
  enEspanol: number;
  /** Cursos del tema en cualquier idioma. */
  total: number;
  porPlataforma: { udemy: number; coursera: number };
  /** Media de los cursos de Udemy, con un decimal. Coursera no publica valoración. */
  valoracionMediaUdemy: number | null;
  /** Mediana de la duración (punto medio de cada rango), en minutos. */
  duracionMedianaMinutos: number | null;
  /** El precio más repetido y el más bajo, en la moneda más habitual. */
  precio: { habitual: number; desde: number; moneda: string } | null;
  recuento: RecuentoTema;
}

function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const orden = [...valores].sort((a, b) => a - b);
  const mitad = Math.floor(orden.length / 2);
  return orden.length % 2 === 1 ? orden[mitad] : (orden[mitad - 1] + orden[mitad]) / 2;
}

function masRepetido<T>(valores: T[]): T | null {
  const cuentas = new Map<T, number>();
  for (const v of valores) cuentas.set(v, (cuentas.get(v) ?? 0) + 1);
  let mejor: T | null = null;
  let veces = 0;
  for (const [v, n] of cuentas) {
    if (n > veces) {
      mejor = v;
      veces = n;
    }
  }
  return mejor;
}

/** Resume los cursos **en español** de un tema. `total` es el de todos los idiomas. */
export function resumenTema(cursos: readonly CursoDeTema[], total: number): ResumenTema {
  const udemy = cursos.filter((c) => c.source === "udemy");
  const valoraciones = udemy.map((c) => c.rating).filter((r): r is number => r !== null);

  const duraciones = cursos
    .map((c) => c.duration)
    .filter((d): d is DurationRange => d !== null)
    .map((d) => (d.minMinutes + d.maxMinutes) / 2);

  // Se comparan precios en una sola moneda: mezclar 14,99 EUR con 19,99 USD sería
  // inventarse cuál es «el más barato».
  const conPrecio = cursos.filter(
    (c): c is CursoDeTema & { priceAmount: number; priceCurrency: string } =>
      c.priceAmount !== null && c.priceCurrency !== null
  );
  const moneda = masRepetido(conPrecio.map((c) => c.priceCurrency));
  const importes = conPrecio.filter((c) => c.priceCurrency === moneda).map((c) => c.priceAmount);

  return {
    enEspanol: cursos.length,
    total: Math.max(total, cursos.length),
    porPlataforma: { udemy: udemy.length, coursera: cursos.filter((c) => c.source === "coursera").length },
    valoracionMediaUdemy:
      valoraciones.length > 0
        ? Math.round((valoraciones.reduce((s, r) => s + r, 0) / valoraciones.length) * 10) / 10
        : null,
    duracionMedianaMinutos: mediana(duraciones),
    precio:
      moneda && importes.length > 0
        ? { habitual: masRepetido(importes)!, desde: Math.min(...importes), moneda }
        : null,
    recuento: {
      enEspanol: cursos.length,
      enEspanolConResenas: cursos.filter((c) => (c.numReviews ?? 0) >= RESENAS_MINIMAS).length,
    },
  };
}

function importe(cantidad: number, moneda: string): string {
  const numero = cantidad.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return moneda === "EUR" ? `${numero} €` : `${numero} ${moneda}`;
}

/**
 * Texto de presentación, frase a frase. Una frase cuyo dato no existe no
 * aparece, en vez de decir «0 h». Nunca promete «gratis»: no hay ningún curso a
 * precio 0, y Coursera sin precio es «no lo sabemos», no «gratis».
 */
export function textoPresentacion(tema: TemaId, r: ResumenTema): string[] {
  const nombre = nombreEnFrase(tema);
  const frases: string[] = [];

  const plataformas = [
    r.porPlataforma.udemy > 0 ? `${conSeparadorDeMiles(r.porPlataforma.udemy)} de Udemy` : null,
    r.porPlataforma.coursera > 0 ? `${conSeparadorDeMiles(r.porPlataforma.coursera)} de Coursera` : null,
  ].filter(Boolean);
  const otrosIdiomas =
    r.total > r.enEspanol ? ` (${conSeparadorDeMiles(r.total)} contando todos los idiomas)` : "";
  frases.push(
    `Hay ${plural(r.enEspanol, "curso", "cursos")} de ${nombre} en español${otrosIdiomas}` +
      (plataformas.length === 2 ? `: ${plataformas.join(" y ")}.` : ".")
  );

  if (r.valoracionMediaUdemy !== null) {
    const valoracion = r.valoracionMediaUdemy.toLocaleString("es-ES", { minimumFractionDigits: 1 });
    frases.push(
      `Los de Udemy tienen una valoración media de ${valoracion} sobre 5` +
        (r.porPlataforma.coursera > 0 ? "; Coursera no publica valoraciones." : ".")
    );
  }

  if (r.duracionMedianaMinutos !== null) {
    const minutos = Math.round(r.duracionMedianaMinutos);
    const duracion = formatDuration({ minMinutes: minutos, maxMinutes: minutos });
    if (duracion) frases.push(`La duración típica ronda ${duracion}.`);
  }

  if (r.precio) {
    const { habitual, desde, moneda } = r.precio;
    frases.push(
      `El precio más habitual es ${importe(habitual, moneda)}` +
        (desde < habitual ? `, y los hay desde ${importe(desde, moneda)}` : "") +
        ", según la última actualización del catálogo."
    );
  }

  return frases;
}

// ---------------------------------------------------------------- recuentos

export interface FilaRecuento {
  temas: string[] | null;
  language: string | null;
  num_reviews: number | null;
}

/** Cuántos cursos tiene cada tema, para decidir cuáles son indexables. */
export function agregarRecuentos(filas: readonly FilaRecuento[]): Map<TemaId, RecuentoTema> {
  const recuentos = new Map<TemaId, RecuentoTema>(
    TEMAS.map((t) => [t, { enEspanol: 0, enEspanolConResenas: 0 }])
  );
  for (const fila of filas) {
    if (fila.language !== "es") continue;
    for (const tema of fila.temas ?? []) {
      const r = recuentos.get(tema as TemaId);
      if (!r) continue; // un tema que ya no está en la lista
      r.enEspanol += 1;
      if ((fila.num_reviews ?? 0) >= RESENAS_MINIMAS) r.enEspanolConResenas += 1;
    }
  }
  return recuentos;
}

// ---------------------------------------------------------------- lectura

const COLUMNAS =
  "id, source, title, description, price_amount, price_currency, rating, num_reviews, level, language, image_url, duration_min_minutes, duration_max_minutes";

interface FilaCurso {
  id: string;
  source: string;
  title: string;
  description: string | null;
  price_amount: number | string | null;
  price_currency: string | null;
  rating: number | string | null;
  num_reviews: number | null;
  level: string | null;
  language: string | null;
  image_url: string | null;
  duration_min_minutes: number | null;
  duration_max_minutes: number | null;
}

function aCurso(f: FilaCurso): CursoDeTema {
  return {
    id: f.id,
    source: f.source,
    title: f.title,
    description: f.description,
    priceAmount: f.price_amount === null ? null : Number(f.price_amount),
    priceCurrency: f.price_currency,
    rating: f.rating === null ? null : Number(f.rating),
    numReviews: f.num_reviews,
    level: f.level,
    language: f.language,
    imageUrl: f.image_url,
    duration:
      f.duration_min_minutes === null || f.duration_max_minutes === null
        ? null
        : { minMinutes: f.duration_min_minutes, maxMinutes: f.duration_max_minutes },
  };
}

// PostgREST devuelve como mucho 1.000 filas por respuesta (HU-029). El tema más
// grande tiene 277 cursos en español; si alguno se acercara a 1.000, habría que
// paginar la lectura aquí, no subir el tope.
const TOPE_POR_TEMA = 1000;

/**
 * Los cursos en español de un tema, de más a menos reseñados: así «los más
 * reseñados» son los primeros y el listado empieza por lo que más gente ha
 * probado, sin que el sitio opine cuál es mejor.
 */
export async function leerCursosDeTema(client: SupabaseClient, tema: TemaId): Promise<CursoDeTema[]> {
  const { data, error } = await client
    .from("courses")
    .select(COLUMNAS)
    .contains("temas", [tema])
    .eq("language", "es")
    .order("num_reviews", { ascending: false, nullsFirst: false })
    .order("rating", { ascending: false, nullsFirst: false })
    .order("id", { ascending: true })
    .limit(TOPE_POR_TEMA);

  if (error) throw new Error(`Fallo al leer los cursos del tema: ${error.message}`);
  return ((data ?? []) as FilaCurso[]).map(aCurso);
}

/** Cursos del tema en cualquier idioma. */
export async function contarCursosDeTema(client: SupabaseClient, tema: TemaId): Promise<number> {
  const { count, error } = await client
    .from("courses")
    .select("id", { count: "exact", head: true })
    .contains("temas", [tema]);

  if (error) throw new Error(`Fallo al contar los cursos del tema: ${error.message}`);
  return count ?? 0;
}

/** Recuento de todos los temas, leyendo solo los cursos que tienen alguno. */
export async function leerRecuentosDeTemas(client: SupabaseClient): Promise<Map<TemaId, RecuentoTema>> {
  const PAGINA = 1000;
  const filas: FilaRecuento[] = [];

  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await client
      .from("courses")
      .select("temas, language, num_reviews")
      .not("temas", "eq", "{}")
      .order("id", { ascending: true })
      .range(desde, desde + PAGINA - 1);

    if (error) throw new Error(`Fallo al contar los temas: ${error.message}`);
    if (!data || data.length === 0) break;
    filas.push(...(data as FilaRecuento[]));
    if (data.length < PAGINA) break;
  }

  return agregarRecuentos(filas);
}
