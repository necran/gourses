import type { SupabaseClient } from "@supabase/supabase-js";
import { conSeparadorDeMiles } from "../formato-numero.ts";
import { sourceLabel } from "./course-seo.ts";
import { esCategoria } from "./categoria-seo.ts";
import type { CourseCategory } from "./categories.ts";
import type { TemaId } from "./temas.ts";
import { leerResumenTemas, temasEnlazables } from "./temas-datos.ts";

// Guía «Udemy o Coursera» (HU-063). Todas las cifras salen de las vistas de la
// migración 0015 al servir la página: nada escrito a mano que se quede viejo.
// Y la guía no afirma nada que esos datos no sostengan: ni «es mejor», ni
// certificados, ni suscripciones, que no están en el catálogo.

export const RUTA_GUIA = "/guias/udemy-o-coursera";

export interface ResumenPlataforma {
  source: string;
  cursos: number;
  enEspanol: number;
  idiomas: number;
  conPrecio: number;
  conPrecioEur: number;
  precioMinimoEur: number | null;
  precioMaximoEur: number | null;
  precioHabitualEur: number | null;
  cursosConPrecioHabitual: number;
  conValoracion: number;
  valoracionMedia: number | null;
  conDuracion: number;
  duracionMedianaMinutos: number | null;
  conResenas: number;
  conNivel: number;
}

// ---------------------------------------------------------------- formato

/**
 * Porcentaje con un decimal como mucho: «50 %», «91,5 %». Nunca redondea a
 * 100 % algo que no es todo (11.398 de 11.400 es «99,9 %»), ni a 0 % algo que
 * no es nada: diría que la plataforma lo publica siempre, o nunca.
 */
export function porcentaje(parte: number, total: number): string {
  if (total <= 0) return "0 %";
  let valor = Math.round((1000 * parte) / total) / 10;
  if (valor === 100 && parte < total) valor = 99.9;
  if (valor === 0 && parte > 0) valor = 0.1;
  return `${valor.toLocaleString("es-ES", { maximumFractionDigits: 1 })} %`;
}

export function euros(cantidad: number): string {
  return `${cantidad.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

export function horas(minutos: number): string {
  const h = Math.round((minutos / 60) * 10) / 10;
  return `${h.toLocaleString("es-ES", { maximumFractionDigits: 1 })} h`;
}

const miles = conSeparadorDeMiles;

function media(valor: number): string {
  return (Math.round(valor * 100) / 100).toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ---------------------------------------------------------------- metadatos

export function tituloGuia(): string {
  return "Udemy o Coursera: en qué se diferencian, con datos";
}

export function descripcionGuia(udemy: ResumenPlataforma | undefined, coursera: ResumenPlataforma | undefined): string {
  const partes = [udemy, coursera]
    .filter((p): p is ResumenPlataforma => Boolean(p))
    .map((p) => `${miles(p.cursos)} de ${sourceLabel(p.source)}`);
  const texto =
    `Comparamos ${partes.join(" y ")} cursos con los mismos datos: cursos en español, idiomas, ` +
    "precio, valoraciones y duración.";
  return texto.length > 160 ? texto.slice(0, 159).trimEnd() + "…" : texto;
}

// ---------------------------------------------------------------- tabla

/**
 * Una celda de la tabla comparativa. Si la plataforma no publica el dato, se
 * dice («No lo publica»), nunca un cero: un precio 0 se leería como «gratis».
 */
export interface CeldaGuia {
  texto: string;
  publicado: boolean;
}

export const NO_LO_PUBLICA = "No lo publica";
const NO_PUBLICA: CeldaGuia = { texto: NO_LO_PUBLICA, publicado: false };

export interface FilaGuia {
  etiqueta: string;
  udemy: CeldaGuia;
  coursera: CeldaGuia;
}

const publicaPrecio = (p: ResumenPlataforma) =>
  p.conPrecioEur > 0 && p.precioHabitualEur !== null && p.precioMinimoEur !== null && p.precioMaximoEur !== null;
const publicaValoracion = (p: ResumenPlataforma) => p.conValoracion > 0 && p.valoracionMedia !== null;
const publicaDuracion = (p: ResumenPlataforma) => p.conDuracion > 0 && p.duracionMedianaMinutos !== null;

/** «; la publica en el 45,3 % de los cursos», o nada si la publica en todos. */
function cobertura(conDato: number, p: ResumenPlataforma): string {
  return conDato === p.cursos ? "" : `; la publica en el ${porcentaje(conDato, p.cursos)} de los cursos`;
}

function celdaPrecio(p: ResumenPlataforma): CeldaGuia {
  if (!publicaPrecio(p)) return NO_PUBLICA;
  return {
    texto:
      `${euros(p.precioHabitualEur!)} en el ${porcentaje(p.cursosConPrecioHabitual, p.conPrecioEur)} de los cursos ` +
      `(de ${euros(p.precioMinimoEur!)} a ${euros(p.precioMaximoEur!)})`,
    publicado: true,
  };
}

function celdaValoracion(p: ResumenPlataforma): CeldaGuia {
  if (!publicaValoracion(p)) return NO_PUBLICA;
  return { texto: `${media(p.valoracionMedia!)} de media, en ${miles(p.conValoracion)} cursos`, publicado: true };
}

function celdaDuracion(p: ResumenPlataforma): CeldaGuia {
  if (!publicaDuracion(p)) return NO_PUBLICA;
  return {
    texto: `${horas(p.duracionMedianaMinutos!)} de mediana${cobertura(p.conDuracion, p)}`,
    publicado: true,
  };
}

function celdaNivel(p: ResumenPlataforma): CeldaGuia {
  if (p.conNivel === 0) return NO_PUBLICA;
  return { texto: `En el ${porcentaje(p.conNivel, p.cursos)} de los cursos`, publicado: true };
}

/** La tabla comparativa, fila a fila, siempre con Udemy y Coursera en ese orden. */
export function filasGuia(udemy: ResumenPlataforma, coursera: ResumenPlataforma): FilaGuia[] {
  const fila = (etiqueta: string, f: (p: ResumenPlataforma) => CeldaGuia): FilaGuia => ({
    etiqueta,
    udemy: f(udemy),
    coursera: f(coursera),
  });
  return [
    fila("Cursos en el catálogo", (p) => ({ texto: miles(p.cursos), publicado: true })),
    fila("En español", (p) => ({
      texto: `${miles(p.enEspanol)} (${porcentaje(p.enEspanol, p.cursos)})`,
      publicado: true,
    })),
    fila("Idiomas", (p) => ({ texto: miles(p.idiomas), publicado: true })),
    fila("Precio por curso", celdaPrecio),
    fila("Valoraciones", celdaValoracion),
    fila("Duración", celdaDuracion),
    fila("Nivel del curso", celdaNivel),
  ];
}

// ---------------------------------------------------------------- texto

export interface SeccionGuia {
  titulo: string;
  parrafos: string[];
}

function fraseIdioma(p: ResumenPlataforma): string {
  const idiomas = p.idiomas === 1 ? "1 idioma" : `${miles(p.idiomas)} idiomas`;
  return (
    `${sourceLabel(p.source)} tiene ${miles(p.enEspanol)} cursos en español de ${miles(p.cursos)}, ` +
    `el ${porcentaje(p.enEspanol, p.cursos)} de su catálogo, que abarca ${idiomas}.`
  );
}

function frasePrecio(p: ResumenPlataforma): string {
  const nombre = sourceLabel(p.source);
  if (!publicaPrecio(p)) {
    return `${nombre} no publica el precio en su catálogo, así que aquí no aparece: hay que consultarlo en su web.`;
  }
  return (
    `En ${nombre}, el precio más repetido es ${euros(p.precioHabitualEur!)}: lo tiene el ` +
    `${porcentaje(p.cursosConPrecioHabitual, p.conPrecioEur)} de los cursos con precio. ` +
    `El más barato cuesta ${euros(p.precioMinimoEur!)} y el más caro, ${euros(p.precioMaximoEur!)}.`
  );
}

function fraseValoracion(p: ResumenPlataforma): string {
  const nombre = sourceLabel(p.source);
  if (!publicaValoracion(p)) {
    return `${nombre} no publica valoraciones en su catálogo, así que sus cursos no se pueden ordenar por nota.`;
  }
  return (
    `En ${nombre}, la valoración media es ${media(p.valoracionMedia!)} sobre 5, ` +
    `con nota en ${miles(p.conValoracion)} cursos.`
  );
}

function fraseDuracion(p: ResumenPlataforma): string {
  const nombre = sourceLabel(p.source);
  if (!publicaDuracion(p)) return `${nombre} no publica la duración de sus cursos.`;
  return (
    `En ${nombre}, la mitad de los cursos dura menos de ${horas(p.duracionMedianaMinutos!)} y la otra mitad, más` +
    (p.conDuracion === p.cursos
      ? "."
      : `. La duración viene en el ${porcentaje(p.conDuracion, p.cursos)} de sus cursos.`)
  );
}

/** Los apartados de texto de la guía: cada frase sale de una cifra de la vista. */
export function seccionesGuia(udemy: ResumenPlataforma, coursera: ResumenPlataforma): SeccionGuia[] {
  const ambas = [udemy, coursera];
  return [
    { titulo: "Cursos en español", parrafos: ambas.map(fraseIdioma) },
    { titulo: "Precio", parrafos: ambas.map(frasePrecio) },
    { titulo: "Valoraciones", parrafos: ambas.map(fraseValoracion) },
    { titulo: "Duración", parrafos: ambas.map(fraseDuracion) },
  ];
}

// ---------------------------------------------------------------- dónde tiene más cursos

export interface FilaCategoriaPlataforma {
  source: string;
  category: string | null;
  cursos: number | string;
  en_espanol: number | string;
}

export interface FilaTemaPlataforma {
  source: string;
  tema: string;
  en_espanol: number | string;
}

export interface CategoriaDestacada {
  categoria: CourseCategory;
  cursos: number;
}

export interface TemaDestacado {
  tema: TemaId;
  enEspanol: number;
}

/** Las categorías con más cursos de la plataforma, de más a menos. */
export function categoriasDestacadas(
  filas: readonly FilaCategoriaPlataforma[],
  source: string,
  cuantas = 3
): CategoriaDestacada[] {
  return filas
    .filter((f) => f.source === source && esCategoria(f.category ?? undefined) && Number(f.cursos) > 0)
    .map((f) => ({ categoria: f.category as CourseCategory, cursos: Number(f.cursos) }))
    .sort((a, b) => b.cursos - a.cursos || a.categoria.localeCompare(b.categoria))
    .slice(0, cuantas);
}

/**
 * Los temas con más cursos en español de la plataforma. Solo los enlazables:
 * un tema por debajo del umbral se sirve con `noindex` y no se enlaza (HU-060).
 */
export function temasDestacados(
  filas: readonly FilaTemaPlataforma[],
  source: string,
  enlazables: readonly TemaId[],
  cuantos = 5
): TemaDestacado[] {
  return filas
    .filter((f) => f.source === source && (enlazables as readonly string[]).includes(f.tema) && Number(f.en_espanol) > 0)
    .map((f) => ({ tema: f.tema as TemaId, enEspanol: Number(f.en_espanol) }))
    .sort((a, b) => b.enEspanol - a.enEspanol || a.tema.localeCompare(b.tema))
    .slice(0, cuantos);
}

// ---------------------------------------------------------------- lectura

interface FilaVista {
  source: string;
  cursos: number | string;
  en_espanol: number | string;
  idiomas: number | string;
  con_precio: number | string;
  con_precio_eur: number | string;
  precio_minimo_eur: number | string | null;
  precio_maximo_eur: number | string | null;
  precio_habitual_eur: number | string | null;
  cursos_con_precio_habitual: number | string;
  con_valoracion: number | string;
  valoracion_media: number | string | null;
  con_duracion: number | string;
  duracion_mediana_minutos: number | string | null;
  con_resenas: number | string;
  con_nivel: number | string;
}

const n = (v: number | string) => Number(v);
const nn = (v: number | string | null) => (v === null ? null : Number(v));

export function aResumen(f: FilaVista): ResumenPlataforma {
  return {
    source: f.source,
    cursos: n(f.cursos),
    enEspanol: n(f.en_espanol),
    idiomas: n(f.idiomas),
    conPrecio: n(f.con_precio),
    conPrecioEur: n(f.con_precio_eur),
    precioMinimoEur: nn(f.precio_minimo_eur),
    precioMaximoEur: nn(f.precio_maximo_eur),
    precioHabitualEur: nn(f.precio_habitual_eur),
    cursosConPrecioHabitual: n(f.cursos_con_precio_habitual),
    conValoracion: n(f.con_valoracion),
    valoracionMedia: nn(f.valoracion_media),
    conDuracion: n(f.con_duracion),
    duracionMedianaMinutos: nn(f.duracion_mediana_minutos),
    conResenas: n(f.con_resenas),
    conNivel: n(f.con_nivel),
  };
}

export interface DatosGuia {
  plataformas: Map<string, ResumenPlataforma>;
  categorias: FilaCategoriaPlataforma[];
  temas: FilaTemaPlataforma[];
  enlazables: TemaId[];
}

/** Todo lo que necesita la guía, en cuatro consultas pequeñas a vistas agregadas. */
export async function leerGuia(client: SupabaseClient): Promise<DatosGuia> {
  const [plataformas, categorias, temas, resumenTemas] = await Promise.all([
    client.from("resumen_plataformas").select("*"),
    client.from("categorias_por_plataforma").select("source, category, cursos, en_espanol"),
    client.from("temas_por_plataforma").select("source, tema, en_espanol"),
    leerResumenTemas(client),
  ]);
  for (const { error } of [plataformas, categorias, temas]) {
    if (error) throw new Error(`Fallo al leer los datos de la guía: ${error.message}`);
  }
  return {
    plataformas: new Map(((plataformas.data ?? []) as FilaVista[]).map((f) => [f.source, aResumen(f)])),
    categorias: (categorias.data ?? []) as FilaCategoriaPlataforma[],
    temas: (temas.data ?? []) as FilaTemaPlataforma[],
    enlazables: temasEnlazables(resumenTemas),
  };
}
