// Separador de miles escrito a mano, con punto. `toLocaleString("es-ES")`
// depende de que el entorno traiga los datos ICU completos de ese locale, y no
// siempre los trae (comprobado en este proyecto: Node los da sin separar).
// Escribirlo a mano no depende de nada.
export function conSeparadorDeMiles(n: number): string {
  return Math.trunc(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
