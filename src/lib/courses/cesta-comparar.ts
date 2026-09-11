import { MAX_COMPARADOS } from "./compare";
import { isValidCourseId } from "./get-course";

// La cesta de comparación (HU-040): los cursos que alguien lleva marcados para
// comparar mientras navega. Se guarda en el navegador (ver almacen-cesta.ts);
// aquí solo está la lógica, sin tocar ningún almacenamiento.

export interface CursoEnCesta {
  readonly id: string;
  /** Solo para pintar la barra sin preguntar al servidor; la verdad son los ids. */
  readonly titulo: string;
}

export type Cesta = readonly CursoEnCesta[];

export const CESTA_VACIA: Cesta = Object.freeze([]);

export const CLAVE_CESTA = "gourses:cesta-comparar";

// Ningún título real se acerca; el tope es para que un valor editado a mano no
// pueda llenar la barra.
const MAX_LONGITUD_TITULO = 300;

function normalizarTitulo(titulo: unknown): string {
  return typeof titulo === "string" ? titulo.trim().slice(0, MAX_LONGITUD_TITULO) : "";
}

export function estaEnCesta(cesta: Cesta, id: string): boolean {
  const clave = id.toLowerCase();
  return cesta.some((c) => c.id.toLowerCase() === clave);
}

export function estaLlena(cesta: Cesta): boolean {
  return cesta.length >= MAX_COMPARADOS;
}

// `anadir`, `quitar` y `vaciar` devuelven la misma cesta, no una copia, cuando
// no cambia nada: el almacén usa esa identidad para no anunciar un cambio que no
// ha habido.
export function anadir(cesta: Cesta, curso: CursoEnCesta): Cesta {
  if (!isValidCourseId(curso.id) || estaEnCesta(cesta, curso.id) || estaLlena(cesta)) {
    return cesta;
  }
  return [...cesta, { id: curso.id, titulo: normalizarTitulo(curso.titulo) }];
}

export function quitar(cesta: Cesta, id: string): Cesta {
  if (!estaEnCesta(cesta, id)) return cesta;
  const clave = id.toLowerCase();
  const resto = cesta.filter((c) => c.id.toLowerCase() !== clave);
  return resto.length > 0 ? resto : CESTA_VACIA;
}

export function vaciar(cesta: Cesta): Cesta {
  return cesta.length === 0 ? cesta : CESTA_VACIA;
}

// Lo guardado en el navegador es entrada externa: lo puede editar la propia
// persona o una extensión. Mismo criterio que parseCompareIds: se descarta lo
// inválido, repetido o de más, en vez de tirar la cesta entera.
export function leerCesta(bruto: string | null): Cesta {
  if (!bruto) return CESTA_VACIA;

  let datos: unknown;
  try {
    datos = JSON.parse(bruto);
  } catch {
    return CESTA_VACIA;
  }
  if (!Array.isArray(datos)) return CESTA_VACIA;

  let cesta = CESTA_VACIA;
  for (const dato of datos) {
    if (typeof dato !== "object" || dato === null) continue;
    const { id, titulo } = dato as Record<string, unknown>;
    if (typeof id !== "string") continue;
    cesta = anadir(cesta, { id, titulo: normalizarTitulo(titulo) });
  }
  return cesta;
}

export function serializarCesta(cesta: Cesta): string {
  return JSON.stringify(cesta.map(({ id, titulo }) => ({ id, titulo })));
}

// El resultado sí vive en la URL: es lo que se comparte, y /comparar vuelve a
// sanear los ids con parseCompareIds sin fiarse de que vengan de aquí.
export function hrefComparar(cesta: Cesta): string {
  if (cesta.length === 0) return "/comparar";
  return `/comparar?ids=${cesta.map((c) => encodeURIComponent(c.id)).join(",")}`;
}

export function nombreEnCesta(curso: CursoEnCesta): string {
  return curso.titulo || "Curso sin título";
}

// Lo que se anuncia a lectores de pantalla tras cada cambio: la barra aparece,
// crece o encoge en otra zona de la pantalla, y sin esto el cambio pasa
// desapercibido para quien no la ve.
export function describirCambio(antes: Cesta, despues: Cesta): string {
  if (antes === despues) return "";

  const cuenta = `Llevas ${despues.length} de ${MAX_COMPARADOS}.`;
  const anadidos = despues.filter((c) => !estaEnCesta(antes, c.id));
  const quitados = antes.filter((c) => !estaEnCesta(despues, c.id));

  if (anadidos.length === 1 && quitados.length === 0) {
    return `Añadido a la comparación: ${nombreEnCesta(anadidos[0])}. ${cuenta}`;
  }
  if (quitados.length === 1 && anadidos.length === 0) {
    return `Quitado de la comparación: ${nombreEnCesta(quitados[0])}. ${cuenta}`;
  }
  if (despues.length === 0) return "Se ha vaciado la selección para comparar.";
  return `Selección para comparar actualizada. ${cuenta}`;
}
