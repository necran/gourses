import type { SupabaseClient } from "@supabase/supabase-js";
import type { DurationRange } from "./duration.ts";
import { conSeparadorDeMiles } from "../formato-numero.ts";
import { UMBRAL_CURSOS_EN_ESPANOL } from "./temas.ts";

// «Cursos nuevos en español» (HU-059): los publicados en los últimos 90 días,
// con las fechas reales de las plataformas. Lo que decide qué se dice, en
// funciones puras; la lectura, aparte.

/** Cuántos días cuenta como «nuevo». */
export const PLAZO_NOVEDADES_DIAS = 90;

/**
 * Mismo mínimo que las páginas de tema (HU-058): por debajo, la página responde
 * pero no se ofrece al índice, porque sería una página fina.
 */
export const UMBRAL_NOVEDADES = UMBRAL_CURSOS_EN_ESPANOL;

export interface Novedad {
  id: string;
  source: string;
  title: string;
  description: string | null;
  priceAmount: number | null;
  priceCurrency: string | null;
  rating: number | null;
  language: string | null;
  imageUrl: string | null;
  duration: DurationRange | null;
  publicadoEn: string;
}

// ---------------------------------------------------------------- textos

export function tituloNovedades(): string {
  return "Cursos nuevos en español";
}

export function descripcionNovedades(total: number): string {
  const cuantos = `${conSeparadorDeMiles(total)} ${total === 1 ? "curso" : "cursos"}`;
  return (
    `${cuantos} en español publicados en Udemy y Coursera en los últimos ${PLAZO_NOVEDADES_DIAS} días, ` +
    "del más reciente al más antiguo."
  );
}

export function enlaceNovedades(pagina = 1): string {
  return pagina > 1 ? `/novedades?pagina=${pagina}` : "/novedades";
}

/** Desde qué instante cuenta como nuevo. */
export function inicioDelPlazo(ahora: Date): Date {
  return new Date(ahora.getTime() - PLAZO_NOVEDADES_DIAS * 24 * 60 * 60 * 1000);
}

const FORMATO_FECHA = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Madrid",
});

/** «3 de julio de 2017». Acepta ISO completo o «AAAA-MM-DD». */
export function fechaLegible(fecha: string): string | null {
  const ms = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(fecha) ? `${fecha}T12:00:00Z` : fecha);
  return Number.isFinite(ms) ? FORMATO_FECHA.format(new Date(ms)) : null;
}

export interface ResumenNovedades {
  total: number;
  porPlataforma: { udemy: number; coursera: number };
}

export function resumenNovedades(novedades: readonly Novedad[]): ResumenNovedades {
  return {
    total: novedades.length,
    porPlataforma: {
      udemy: novedades.filter((n) => n.source === "udemy").length,
      coursera: novedades.filter((n) => n.source === "coursera").length,
    },
  };
}

/**
 * Si la portada enseña su sección de novedades (HU-067). Sin cursos nuevos no se
 * enseña vacía: una sección con un hueco dice menos que no estar.
 */
export function mostrarNovedadesEnPortada(novedades: readonly Novedad[]): boolean {
  return novedades.length > 0;
}

export function superaUmbralNovedades(resumen: ResumenNovedades): boolean {
  return resumen.total >= UMBRAL_NOVEDADES;
}

/** Presentación con datos. Sin cursos, lo dice sin rodeos en vez de enseñar un cero. */
export function textoNovedades(r: ResumenNovedades): string {
  if (r.total === 0) {
    return `No hay cursos en español publicados en los últimos ${PLAZO_NOVEDADES_DIAS} días.`;
  }
  const plataformas = [
    r.porPlataforma.udemy > 0 ? `${conSeparadorDeMiles(r.porPlataforma.udemy)} de Udemy` : null,
    r.porPlataforma.coursera > 0 ? `${conSeparadorDeMiles(r.porPlataforma.coursera)} de Coursera` : null,
  ].filter(Boolean);
  const cuantos = `${conSeparadorDeMiles(r.total)} ${r.total === 1 ? "curso nuevo" : "cursos nuevos"}`;
  return (
    `En los últimos ${PLAZO_NOVEDADES_DIAS} días se han publicado ${cuantos} en español` +
    (plataformas.length === 2 ? `: ${plataformas.join(" y ")}.` : ".") +
    " Las fechas son las que publica cada plataforma."
  );
}

// ---------------------------------------------------------------- lectura

interface FilaNovedad {
  id: string;
  source: string;
  title: string;
  description: string | null;
  price_amount: number | string | null;
  price_currency: string | null;
  rating: number | string | null;
  language: string | null;
  image_url: string | null;
  duration_min_minutes: number | null;
  duration_max_minutes: number | null;
  publicado_en: string;
}

// PostgREST devuelve como mucho 1.000 filas (HU-029). Si algún día hubiera más
// novedades en 90 días, se paginaría aquí, no se subiría el tope.
const TOPE = 1000;

export async function leerNovedades(client: SupabaseClient, ahora: Date = new Date()): Promise<Novedad[]> {
  return leerNovedadesHasta(client, TOPE, ahora);
}

/**
 * Las primeras novedades, para la sección de la portada (HU-067): traerse las
 * 1.000 de `leerNovedades` para enseñar cuatro sería pagar la consulta entera en
 * cada visita.
 */
export async function leerUltimasNovedades(
  client: SupabaseClient,
  limite: number,
  ahora: Date = new Date()
): Promise<Novedad[]> {
  return leerNovedadesHasta(client, limite, ahora);
}

async function leerNovedadesHasta(
  client: SupabaseClient,
  limite: number,
  ahora: Date
): Promise<Novedad[]> {
  const { data, error } = await client
    .from("courses")
    .select(
      "id, source, title, description, price_amount, price_currency, rating, language, image_url, duration_min_minutes, duration_max_minutes, publicado_en"
    )
    .eq("language", "es")
    .gte("publicado_en", inicioDelPlazo(ahora).toISOString())
    .order("publicado_en", { ascending: false })
    .order("id", { ascending: true })
    .limit(limite);

  if (error) throw new Error(`Fallo al leer las novedades: ${error.message}`);
  return ((data ?? []) as FilaNovedad[]).map((f) => ({
    id: f.id,
    source: f.source,
    title: f.title,
    description: f.description,
    priceAmount: f.price_amount === null ? null : Number(f.price_amount),
    priceCurrency: f.price_currency,
    rating: f.rating === null ? null : Number(f.rating),
    language: f.language,
    imageUrl: f.image_url,
    duration:
      f.duration_min_minutes === null || f.duration_max_minutes === null
        ? null
        : { minMinutes: f.duration_min_minutes, maxMinutes: f.duration_max_minutes },
    publicadoEn: f.publicado_en,
  }));
}
