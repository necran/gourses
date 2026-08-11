// Datos identificativos del titular del sitio, exigidos por el artículo 10 de
// la LSSI-CE. Se centralizan aquí para que el aviso legal no dependa de texto
// suelto repartido por las páginas.
//
export const TITULAR = {
  nombre: "Rubén García Alcántara",
  nif: "51470645A",
  email: "hola@gourses.com",
  sitio: "gourses.com",
  url: "https://gourses.com",
} as const;

export function titularCompleto(): boolean {
  return TITULAR.nombre.trim().length > 0 && TITULAR.nif.trim().length > 0;
}
