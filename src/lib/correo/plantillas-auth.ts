import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Plantillas de los correos que manda Supabase Auth (el enlace de acceso).
//
// Viven en `supabase/plantillas-correo/*.html` y no en el panel de Supabase a
// propósito: el panel no tiene historial ni revisión, así que un cambio ahí no
// se ve en ningún sitio. Aquí el fichero es la fuente de verdad, `npm run
// correo:plantillas` lo sube, y los tests de abajo comprueban lo que se sube.
//
// Ojo con las dos plantillas: `signInWithOtp` **no manda siempre la misma**.
// Si la dirección ya tiene cuenta sale «Magic Link»; si es la primera vez, sale
// «Confirm signup». Traducir solo una deja la mitad de los correos en inglés,
// y justo la mitad que reciben los que llegan nuevos.

const AQUI = dirname(fileURLToPath(import.meta.url));
const CARPETA = join(AQUI, "../../../supabase/plantillas-correo");

export interface PlantillaAuth {
  /** Nombre del fichero, sin extensión. */
  id: string;
  /** Cómo se llama en la configuración de Supabase Auth. */
  claveSupabase: "confirmation" | "magic_link";
  asunto: string;
}

export const PLANTILLAS_AUTH: readonly PlantillaAuth[] = [
  {
    id: "enlace-de-acceso",
    claveSupabase: "magic_link",
    asunto: "Tu enlace para entrar en Gourses",
  },
  {
    id: "confirmar-registro",
    claveSupabase: "confirmation",
    asunto: "Confirma tu correo y entra en Gourses",
  },
] as const;

export function leerPlantilla(id: string): string {
  return readFileSync(join(CARPETA, `${id}.html`), "utf8");
}

/**
 * Variables que GoTrue (el Auth de Supabase) rellena en estas plantillas.
 * Cualquier otra se queda literal en el correo, así que la lista sirve para
 * cazar erratas antes de que lleguen a una bandeja de entrada.
 */
export const VARIABLES_SUPABASE = [
  "ConfirmationURL",
  "Token",
  "TokenHash",
  "SiteURL",
  "RedirectTo",
  "Email",
  "Data",
] as const;

/**
 * Renderiza el trozo de plantilla de Go que usa Supabase: `{{ .Variable }}`.
 *
 * No pretende ser un motor de plantillas —no hay condicionales ni bucles en
 * estos correos— sino poder mirar el resultado en un test. Si la plantilla
 * nombra una variable que Supabase no rellena, revienta aquí en vez de mandar
 * un correo con un hueco vacío donde debía ir el enlace.
 */
export function renderizar(plantilla: string, valores: Record<string, string>): string {
  return plantilla.replace(/\{\{\s*\.([A-Za-z]+)\s*\}\}/g, (_todo, nombre: string) => {
    if (!(VARIABLES_SUPABASE as readonly string[]).includes(nombre)) {
      throw new Error(`La plantilla usa {{ .${nombre} }}, que Supabase Auth no rellena`);
    }
    return valores[nombre] ?? "";
  });
}
