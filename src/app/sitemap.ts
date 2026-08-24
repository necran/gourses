import type { MetadataRoute } from "next";
import { createSupabaseServerClient } from "../lib/supabase/server-client";
import { TITULAR } from "../lib/legal/titular";

// Se genera desde la base de datos en cada petición, no se fija a mano: la
// ingesta diaria cambia el catálogo y un sitemap escrito a mano quedaría
// desfasado a los pocos días (HU-016).
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const fijas: MetadataRoute.Sitemap = [
    { url: `${TITULAR.url}/`, changeFrequency: "daily", priority: 1 },
    { url: `${TITULAR.url}/buscar`, changeFrequency: "daily", priority: 0.8 },
    { url: `${TITULAR.url}/afiliacion`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${TITULAR.url}/privacidad`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${TITULAR.url}/aviso-legal`, changeFrequency: "yearly", priority: 0.3 },
  ];

  try {
    const client = createSupabaseServerClient();
    const cursos = await leerTodosLosCursos(client);

    const fichas: MetadataRoute.Sitemap = cursos.map((c) => ({
      url: `${TITULAR.url}/curso/${c.id}`,
      lastModified: c.updated_at ? new Date(c.updated_at) : undefined,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));

    return [...fijas, ...fichas];
  } catch {
    // Un fallo leyendo el catálogo no debe dejar al buscador sin sitemap:
    // mejor servir las páginas fijas que devolver un error.
    return fijas;
  }
}

interface FilaCurso {
  id: string;
  updated_at: string | null;
}

// El límite real de un sitemap es 50.000 URLs; se deja margen para las
// páginas fijas. Si el catálogo se acerca a esta cifra, hace falta partir el
// sitemap en varios (un índice de sitemaps), no subir más este número.
const TOPE_SITEMAP = 49_000;

// PostgREST de este proyecto limita cada respuesta a 1.000 filas *aunque se
// pida más* con `.limit()` — no es la instrucción SQL, es un tope del propio
// servidor (comprobado contra la API real: pedir 49.000 sigue devolviendo
// 1.000). El `.limit(5000)` que había antes nunca llegó a hacer nada: el
// catálogo entero estaba ya recortado a 1.000 fichas mucho antes de esa cifra,
// y nadie lo había notado porque un sitemap corto no da ningún error (HU-029).
// Se pagina con `.range()` hasta agotar el catálogo o el tope de arriba.
async function leerTodosLosCursos(
  client: ReturnType<typeof createSupabaseServerClient>
): Promise<FilaCurso[]> {
  const PAGINA = 1000;
  const cursos: FilaCurso[] = [];

  for (let desde = 0; desde < TOPE_SITEMAP; desde += PAGINA) {
    const { data, error } = await client
      .from("courses")
      .select("id, updated_at")
      .order("id", { ascending: true })
      .range(desde, Math.min(desde + PAGINA, TOPE_SITEMAP) - 1);

    if (error) throw new Error(`Fallo al leer el catálogo para el sitemap: ${error.message}`);
    if (!data || data.length === 0) break;

    cursos.push(...data);
    if (data.length < PAGINA) break;
  }

  return cursos;
}
