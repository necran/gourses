// HU-065. Udemy devuelve el nivel en el idioma en que se pidió el catálogo: la
// pasada en español trae «Principiante» y la de inglés «Beginner» (HU-049), así
// que la base acababa con los dos vocabularios mezclados y la ficha enseñaba
// «All Levels» a unos cursos y «Todos los niveles» a otros. Se guarda siempre la
// etiqueta en español.

export const NIVELES = ["Todos los niveles", "Principiante", "Intermedio", "Experto"] as const;
export type Nivel = (typeof NIVELES)[number];

const EQUIVALENCIAS: Record<string, Nivel> = {
  "all levels": "Todos los niveles",
  "todos los niveles": "Todos los niveles",
  beginner: "Principiante",
  "beginner level": "Principiante",
  principiante: "Principiante",
  intermediate: "Intermedio",
  "intermediate level": "Intermedio",
  intermedio: "Intermedio",
  expert: "Experto",
  "expert level": "Experto",
  experto: "Experto",
};

/**
 * La etiqueta en español del nivel. Un valor que no se reconoce se guarda tal
 * cual (recortado): mejor mostrar lo que dice la plataforma que perder el dato.
 */
export function normalizarNivel(nivel: string | null | undefined): string | null {
  if (typeof nivel !== "string") return null;
  const limpio = nivel.trim().replace(/\s+/g, " ");
  if (!limpio) return null;
  return EQUIVALENCIAS[limpio.toLowerCase()] ?? limpio;
}
