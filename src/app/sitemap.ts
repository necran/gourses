import type { MetadataRoute } from "next";
import { createSupabaseServerClient } from "../lib/supabase/server-client";
import { COURSE_CATEGORIES } from "../lib/courses/categories";
import { enlaceCategoria } from "../lib/courses/categoria-seo";
import { TITULAR } from "../lib/legal/titular";
import { enlaceTema, leerResumenTemas, temasEnlazables } from "../lib/courses/temas-datos";
import {
  enlaceNovedades,
  leerNovedades,
  resumenNovedades,
  superaUmbralNovedades,
} from "../lib/courses/novedades";

// Se genera desde la base de datos, no se fija a mano: la ingesta diaria cambia
// el catálogo y un sitemap escrito a mano quedaría desfasado (HU-016).
//
// Pero no en cada petición (HU-050): con 15.000 cursos eran 16 consultas y 5 s
// de función por visita de un rastreador, en producción, para algo que solo
// cambia una vez al día. Se regenera como mucho una vez al día, que coincide con
// la cadencia de la ingesta. Sin base de datos (la compilación en GitHub,
// HU-044) el try/catch de abajo devuelve las páginas fijas en vez de fallar.
export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const fijas: MetadataRoute.Sitemap = [
    { url: `${TITULAR.url}/`, changeFrequency: "daily", priority: 1 },
    { url: `${TITULAR.url}/buscar`, changeFrequency: "daily", priority: 0.8 },
    { url: `${TITULAR.url}/afiliacion`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${TITULAR.url}/privacidad`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${TITULAR.url}/aviso-legal`, changeFrequency: "yearly", priority: 0.3 },
  ];

  // Las once páginas de categoría (HU-046). Van con las fijas y no con las
  // fichas a propósito: no dependen de leer el catálogo, así que si esa lectura
  // falla siguen anunciándose. Prioridad por encima de una ficha suelta y por
  // debajo del buscador: son las puertas de entrada desde una búsqueda como
  // "cursos de diseño".
  const categorias: MetadataRoute.Sitemap = COURSE_CATEGORIES.map((categoria) => ({
    url: `${TITULAR.url}${enlaceCategoria(categoria)}`,
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  try {
    const client = createSupabaseServerClient();
    const cursos = await leerTodosLosCursos(client);

    // Sin `lastModified` (HU-056): salía de `updated_at`, que la ingesta diaria
    // pone al día aunque el curso no cambie, así que todas las fichas se
    // anunciaban «modificadas» cada día. Un `lastmod` que siempre cambia enseña
    // a Google a ignorarlo; mejor no declarar una fecha que no significa nada.
    const fichas: MetadataRoute.Sitemap = cursos.map((c) => ({
      url: `${TITULAR.url}/curso/${c.id}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));

    // Las páginas de tema (HU-058), solo las que superan el umbral: anunciar una
    // que se sirve con `noindex` sería pedirle a Google que rastree algo que se le
    // dice que no indexe. A diferencia de las categorías, dependen de leer el
    // catálogo, así que si ese recuento falla se omiten un día.
    let temas: MetadataRoute.Sitemap = [];
    try {
      temas = temasEnlazables(await leerResumenTemas(client)).map((t) => ({
        url: `${TITULAR.url}${enlaceTema(t)}`,
        changeFrequency: "daily" as const,
        priority: 0.7,
      }));
    } catch {
      temas = [];
    }

    // Las novedades (HU-059), solo si hay suficientes para ser indexables. Cambian
    // a diario, que es justo lo que se le dice al rastreador.
    let novedades: MetadataRoute.Sitemap = [];
    try {
      if (superaUmbralNovedades(resumenNovedades(await leerNovedades(client)))) {
        novedades = [{ url: `${TITULAR.url}${enlaceNovedades()}`, changeFrequency: "daily" as const, priority: 0.8 }];
      }
    } catch {
      novedades = [];
    }

    return [...fijas, ...categorias, ...temas, ...novedades, ...fichas];
  } catch {
    // Un fallo leyendo el catálogo no debe dejar al buscador sin sitemap:
    // mejor servir las páginas fijas que devolver un error.
    return [...fijas, ...categorias];
  }
}

interface FilaCurso {
  id: string;
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
      .select("id")
      .order("id", { ascending: true })
      .range(desde, Math.min(desde + PAGINA, TOPE_SITEMAP) - 1);

    if (error) throw new Error(`Fallo al leer el catálogo para el sitemap: ${error.message}`);
    if (!data || data.length === 0) break;

    cursos.push(...data);
    if (data.length < PAGINA) break;
  }

  return cursos;
}
