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
    const { data, error } = await client
      .from("courses")
      .select("id, updated_at")
      .order("updated_at", { ascending: false })
      .limit(5000);

    if (error || !data) return fijas;

    const fichas: MetadataRoute.Sitemap = data.map((c) => ({
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
