// Validación del correo antes de pedirle nada a Supabase (HU-018). No
// pretende decidir si el buzón existe —eso solo lo demuestra que llegue el
// mensaje— sino descartar lo que ni siquiera tiene forma de dirección, para no
// gastar envíos ni dar una confirmación engañosa.
const CORREO = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

const MAX_LONGITUD = 254; // Límite de longitud de una dirección (RFC 5321).

export function normalizeEmail(valor: string): string {
  return valor.trim().toLowerCase();
}

export function isValidEmail(valor: string | null | undefined): boolean {
  if (typeof valor !== "string") return false;

  const limpio = normalizeEmail(valor);
  if (limpio.length === 0 || limpio.length > MAX_LONGITUD) return false;

  return CORREO.test(limpio);
}
