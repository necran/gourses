import type { SupabaseClient } from "@supabase/supabase-js";
import { conSeparadorDeMiles } from "../formato-numero.ts";
import { horas, porcentaje } from "./guia-plataformas.ts";
import { NIVELES, type Nivel } from "./nivel.ts";

// Guía «cuánto dura un curso según su nivel» (HU-075). Las cifras salen de la
// vista `duracion_por_nivel` (migración 0020) al servir la página.
//
// Solo Udemy en español: Coursera no publica nivel (0 de 262 cursos en
// español lo tienen, comprobado al escribir esta guía), así que no hay con
// qué comparar y la guía lo dice en vez de omitirlo en silencio.

export const RUTA_GUIA_NIVEL = "/guias/duracion-segun-el-nivel";

/** Mismo umbral que el resto del sitio para hablar de «con respaldo» (HU-058). */
export const UMBRAL_RESENAS_CON_RESPALDO = 50;

export interface ResumenNivel {
  nivel: Nivel;
  cursos: number;
  conRespaldo: number;
  duracionMedianaMinutos: number | null;
  valoracionMedia: number | null;
}

// ---------------------------------------------------------------- metadatos

export function tituloGuiaNivel(): string {
  return "Cuánto dura un curso según su nivel, con datos";
}

export function descripcionGuiaNivel(niveles: readonly ResumenNivel[]): string {
  const cursos = niveles.reduce((suma, n) => suma + n.cursos, 0);
  const texto =
    `Cuánto dura de mediana un curso de Udemy en español según su nivel, con ${conSeparadorDeMiles(cursos)} ` +
    "cursos medidos: Principiante, Intermedio, Experto y Todos los niveles.";
  return texto.length > 160 ? `${texto.slice(0, 159).trimEnd()}…` : texto;
}

// ---------------------------------------------------------------- tabla

export interface FilaNivel {
  nivel: Nivel;
  cursos: number;
  duracion: string | null;
  respaldo: string;
  valoracion: string | null;
}

function media(valor: number): string {
  return (Math.round(valor * 100) / 100).toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Una fila por nivel, del que dura más al que dura menos: es el hallazgo de la guía. */
export function filasGuiaNivel(niveles: readonly ResumenNivel[]): FilaNivel[] {
  return [...niveles]
    .sort((a, b) => (b.duracionMedianaMinutos ?? 0) - (a.duracionMedianaMinutos ?? 0))
    .map((n) => ({
      nivel: n.nivel,
      cursos: n.cursos,
      duracion: n.duracionMedianaMinutos === null ? null : horas(n.duracionMedianaMinutos),
      respaldo: `${conSeparadorDeMiles(n.conRespaldo)} (${porcentaje(n.conRespaldo, n.cursos)})`,
      valoracion: n.valoracionMedia === null ? null : media(n.valoracionMedia),
    }));
}

// ---------------------------------------------------------------- texto

/**
 * Lo que se puede afirmar mirando la tabla, calculado: ni una frase escrita a
 * mano que mañana deje de ser verdad.
 */
export function conclusiones(niveles: readonly ResumenNivel[]): string[] {
  const conDuracion = niveles.filter((n) => n.duracionMedianaMinutos !== null);
  const frases: string[] = [];

  if (conDuracion.length > 1) {
    const ordenados = [...conDuracion].sort(
      (a, b) => (b.duracionMedianaMinutos ?? 0) - (a.duracionMedianaMinutos ?? 0)
    );
    const larga = ordenados[0];
    const corta = ordenados[ordenados.length - 1];
    frases.push(
      `Un curso de ${larga.nivel} dura ${horas(larga.duracionMedianaMinutos!)} de mediana; uno de ${corta.nivel}, ` +
        `${horas(corta.duracionMedianaMinutos!)}: ${porcentaje(
          Math.max(larga.duracionMedianaMinutos! - corta.duracionMedianaMinutos!, 0),
          corta.duracionMedianaMinutos!
        )} más de duración entre el más largo y el más corto.`
    );

    const todos = niveles.find((n) => n.nivel === "Todos los niveles");
    const principiante = niveles.find((n) => n.nivel === "Principiante");
    if (
      todos?.duracionMedianaMinutos != null &&
      principiante?.duracionMedianaMinutos != null &&
      todos.duracionMedianaMinutos > principiante.duracionMedianaMinutos
    ) {
      frases.push(
        `«Todos los niveles» no es la opción corta: dura ${horas(todos.duracionMedianaMinutos)} de mediana, ` +
          `frente a las ${horas(principiante.duracionMedianaMinutos)} de un curso de Principiante.`
      );
    }
  }

  const conValoracion = niveles.filter((n) => n.valoracionMedia !== null);
  if (conValoracion.length > 1) {
    const valores = conValoracion.map((n) => n.valoracionMedia!);
    const diferencia = Math.max(...valores) - Math.min(...valores);
    if (diferencia < 0.2) {
      frases.push(
        "La valoración media apenas cambia de un nivel a otro: elegir el nivel no es apostar por la " +
          "calidad del curso, es apostar por cuánto tiempo se quiere dedicar."
      );
    }
  }

  return frases;
}

// ---------------------------------------------------------------- lectura

interface FilaVista {
  level: string;
  cursos: number | string;
  con_respaldo: number | string;
  duracion_mediana_minutos: number | string | null;
  valoracion_media: number | string | null;
}

const n = (v: number | string) => Number(v);
const nn = (v: number | string | null) => (v === null ? null : Number(v));

function esNivel(valor: string): valor is Nivel {
  return (NIVELES as readonly string[]).includes(valor);
}

export function aResumenNivel(f: FilaVista): ResumenNivel | null {
  // Un nivel que no esté en la lista cerrada (NIVELES) no tiene fila: ya pasó
  // con valores sin normalizar de antes de HU-065, y no hay etiqueta para ellos.
  if (!esNivel(f.level)) return null;
  return {
    nivel: f.level,
    cursos: n(f.cursos),
    conRespaldo: n(f.con_respaldo),
    duracionMedianaMinutos: nn(f.duracion_mediana_minutos),
    valoracionMedia: nn(f.valoracion_media),
  };
}

export async function leerDuracionPorNivel(client: SupabaseClient): Promise<ResumenNivel[]> {
  const { data, error } = await client.from("duracion_por_nivel").select("*");
  if (error) throw new Error(`Fallo al leer la duración por nivel: ${error.message}`);
  return ((data ?? []) as FilaVista[])
    .map(aResumenNivel)
    .filter((r): r is ResumenNivel => r !== null);
}
