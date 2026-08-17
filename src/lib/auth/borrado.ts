import { normalizeEmail } from "./email.ts";

// Borrar la cuenta no tiene vuelta atrás, así que no basta con pulsar un botón:
// hay que escribir el propio correo. Es un gesto deliberado, difícil de hacer
// sin querer, y a la vez no obliga a recordar ninguna contraseña —que además
// aquí no existen.
//
// Se comparan las dos direcciones normalizadas (sin espacios y en minúsculas):
// exigir que coincidan también las mayúsculas sería una trampa sin ninguna
// ganancia, porque el correo ya identifica igual escrito de cualquier forma.
export function confirmacionCoincide(escrito: string, correoDeLaCuenta: string): boolean {
  const a = normalizeEmail(escrito);
  const b = normalizeEmail(correoDeLaCuenta);

  // Una cuenta sin correo no puede confirmarse escribiendo la cadena vacía.
  if (a.length === 0 || b.length === 0) return false;

  return a === b;
}
