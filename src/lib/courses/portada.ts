// Cuánto se enseña en la portada (HU-070).
//
// Antes salían las once categorías y todos los temas que superan el umbral: dos
// filas de pastillas que ocupaban media pantalla antes de llegar a los cursos.
// Se recortan al pintar, y cada lista lleva su enlace al índice completo —que es
// lo que evita repetir el fallo de HU-056, cuando cinco categorías se quedaron
// sin ningún enlace en el sitio.

export const CATEGORIAS_EN_PORTADA = 6;
export const TEMAS_EN_PORTADA = 8;

/** Los primeros `cuantos`, sin tocar el orden que traiga la lista. */
export function primeros<T>(lista: readonly T[], cuantos: number): T[] {
  return lista.slice(0, Math.max(0, cuantos));
}

/** Si merece la pena ofrecer «ver todas»: solo cuando queda algo fuera. */
export function quedanMas(lista: readonly unknown[], cuantos: number): boolean {
  return lista.length > cuantos;
}
