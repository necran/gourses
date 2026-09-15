// Resumen de curso apoyado en su descripción real (HU-030).
//
// A propósito NO genera contenido desde cero: resume un texto que ya existe.
// Con 8.796 cursos y enlaces de afiliado, producir un párrafo inventado por
// curso sin apoyo en datos reales es el patrón que Google vigila como *scaled
// content abuse* — páginas finas en masa con afiliación detrás. Resumir con el
// texto delante acota mucho el riesgo de que el modelo se invente algo.

import { createHash } from "node:crypto";

// La descripción más corta que merece la pena resumir. Por debajo de esto, un
// resumen no acorta nada de verdad — solo gasta una llamada a cambio de nada.
export const LONGITUD_MINIMA_DESCRIPCION = 200;

// Cuánto se deja crecer el resumen antes de recortarlo. No es el límite que se
// le pide al modelo (eso va en el prompt): es un resguardo para que una
// respuesta que se fuera de madre no acabe ocupando media ficha.
const LONGITUD_MAXIMA_RESUMEN = 500;

export interface CursoParaResumir {
  title: string;
  description: string;
}

// Puro y sin llamar a nada: así se prueba sin API ni red. El texto real va
// entero en el prompt — nada de "según lo que sepas del curso", que es la
// puerta por la que un modelo se inventa datos que el texto no tiene.
export function construirPrompt(curso: CursoParaResumir): string {
  return [
    "Resume en español la descripción de este curso en 2 o 3 frases, para que",
    "alguien decida en unos segundos si le interesa.",
    "",
    "Usa solo lo que dice el texto. No inventes cifras, logros, valoraciones ni",
    "afirmaciones que no estén ahí. Si el texto es publicitario o repetitivo,",
    "queda con la sustancia, no con el tono. No uses comillas ni encabezados,",
    "solo el resumen.",
    "",
    `Título: ${curso.title}`,
    "",
    "Descripción:",
    curso.description,
  ].join("\n");
}

// Recorta con cuidado de no partir una palabra a la mitad.
function recortar(texto: string, limite: number): string {
  if (texto.length <= limite) return texto;
  const cortado = texto.slice(0, limite);
  const ultimoEspacio = cortado.lastIndexOf(" ");
  return (ultimoEspacio > 0 ? cortado.slice(0, ultimoEspacio) : cortado).trimEnd() + "…";
}

// Limpieza mínima de lo que pueda devolver el modelo pese a lo pedido en el
// prompt: comillas envolventes, un encabezado tipo "Resumen:" delante.
export function limpiarResumen(texto: string): string {
  const sinEncabezado = texto.trim().replace(/^(resumen|summary)\s*:\s*/i, "");
  const sinComillas = sinEncabezado.replace(/^["“]|["”]$/g, "").trim();
  return recortar(sinComillas, LONGITUD_MAXIMA_RESUMEN);
}

/** Genera el resumen de un curso a partir de su título y descripción reales. */
export type GeneradorDeResumen = (curso: CursoParaResumir) => Promise<string>;

export interface CursoConEstadoResumen extends CursoParaResumir {
  id: string;
  resumenIA: string | null;
  /** Huella de la descripción que se resumió, si hay resumen (HU-052). */
  resumenIADescripcionSha256: string | null;
}

/** SHA-256 en hexadecimal; coincide con `encode(sha256(convert_to(t, 'UTF8')), 'hex')`. */
export function huellaDescripcion(descripcion: string): string {
  return createHash("sha256").update(descripcion, "utf8").digest("hex");
}

// Decide si un curso necesita (re)generar su resumen. Pura, sin tocar la base
// de datos: así se prueba cada caso sin sembrar nada (HU-030).
//
// Compara huellas y no fechas (HU-052): la ingesta diaria actualiza
// `updated_at` de todos los cursos aunque no cambie nada, y comparar fechas
// daba cada resumen por caducado al día siguiente.
export function necesitaResumen(curso: CursoConEstadoResumen): boolean {
  if (curso.description.length < LONGITUD_MINIMA_DESCRIPCION) return false;
  if (!curso.resumenIA || !curso.resumenIADescripcionSha256) return true;

  // Si la descripción ya no es la que se resumió, el resumen habla de un texto
  // que no es el que se ve en la ficha.
  return curso.resumenIADescripcionSha256 !== huellaDescripcion(curso.description);
}

// La cuota **diaria** agotada no es un fallo de un curso: fallarían todos los
// que quedan, y reintentar no sirve hasta el día siguiente. Por eso tiene su
// propio error, cuyo mensaje no lleva el código 429 a propósito — así
// `esReintentable` no lo reintenta y el job lo reconoce para parar (HU-052).
export class CuotaDiariaAgotadaError extends Error {
  constructor() {
    super("Cuota diaria gratuita de la API de IA agotada");
    this.name = "CuotaDiariaAgotadaError";
  }
}

// Gemini nombra la cuota en el propio mensaje del 429:
// "GenerateRequestsPerDayPerProjectPerModel-FreeTier" (visto el 2026-09-09).
// La de por minuto también es un 429, pero esa sí se pasa esperando.
export function esCuotaDiariaAgotada(status: number | undefined, mensaje: string): boolean {
  return status === 429 && /per ?day/i.test(mensaje);
}
