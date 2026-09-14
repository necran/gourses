import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "../../../lib/supabase/server-client";
import { searchCourses } from "../../../lib/courses/search-courses";
import { parseCourseSearchFilters, textoRecuento } from "../../../lib/courses/search-filters";
import { preferredLanguageFrom } from "../../../lib/courses/preferred-language";
import { formatDuration } from "../../../lib/courses/duration";
import { DIMENSIONES_MINIATURA, cargaDeMiniatura } from "../../../lib/imagenes";
import { CATEGORY_LABELS } from "../../../lib/courses/categories";
import {
  descripcionCategoria,
  enlaceCategoria,
  esCategoria,
  tituloCategoria,
} from "../../../lib/courses/categoria-seo";
import styles from "./page.module.css";

interface CategoriaPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ pagina?: string | string[] }>;
}

// Cuenta cuántos cursos tiene la categoría, que es lo único que hace falta
// para la descripción. Se pide la página 1 y se usa su `total` (HU-028), en
// vez de una consulta aparte.
async function contarEnCategoria(slug: string): Promise<number> {
  if (!esCategoria(slug)) return 0;
  const filtros = { ...parseCourseSearchFilters({}), category: slug };
  const { total } = await searchCourses(createSupabaseServerClient(), filtros, 1);
  return total;
}

export async function generateMetadata({ params }: CategoriaPageProps): Promise<Metadata> {
  const { slug } = await params;
  if (!esCategoria(slug)) return { title: "Categoría no encontrada" };

  // Si el catálogo no responde, se publica igualmente la página con su título:
  // quedarse sin descripción es mucho menos malo que caerse.
  let total = 0;
  try {
    total = await contarEnCategoria(slug);
  } catch {
    total = 0;
  }

  return {
    title: tituloCategoria(slug),
    description:
      total > 0
        ? descripcionCategoria(slug, total)
        : `Cursos de ${CATEGORY_LABELS[slug]} de Udemy y Coursera, comparados con los mismos datos.`,
    // Esta es la dirección buena de la categoría, no `/buscar?category=`.
    alternates: { canonical: enlaceCategoria(slug) },
  };
}

export default async function CategoriaPage({ params, searchParams }: CategoriaPageProps) {
  const { slug } = await params;

  // Un identificador que no está en la lista cerrada no es una categoría de
  // este sitio: se va a "no encontrado" igual que una ficha inexistente, en
  // vez de enseñar un listado vacío que un buscador indexaría.
  if (!esCategoria(slug)) notFound();

  const { pagina: paginaCruda } = await searchParams;
  const filtros = {
    ...parseCourseSearchFilters({ pagina: paginaCruda }),
    category: slug,
  };

  // HU-032, igual que en el buscador: si falla la cabecera se sigue sin
  // priorizar idioma.
  let idiomaPreferido: string | null = null;
  try {
    idiomaPreferido = preferredLanguageFrom((await headers()).get("accept-language"));
  } catch {
    idiomaPreferido = null;
  }

  const { resultados, pagina, hayMas, total } = await searchCourses(
    createSupabaseServerClient(),
    filtros,
    undefined,
    idiomaPreferido
  );

  return (
    <main className={styles.main}>
      <p className={styles.volver}>
        <Link href="/">← Todas las categorías</Link>
      </p>

      <h1>{tituloCategoria(slug)}</h1>
      <p className={styles.intro}>
        Los mismos datos para todos, vengan de Udemy o de Coursera: precio, valoración,
        duración e idioma. {textoRecuento(total)}{" "}
        <Link href={`/buscar?category=${slug}`}>Afinar la búsqueda</Link>
      </p>

      {resultados.length === 0 ? (
        // Ninguna categoría está vacía hoy, pero la ingesta puede cambiar: es
        // un punto de partida, no un error.
        <p role="status" className={styles.vacio}>
          {pagina > 1 ? (
            <>
              Esta página ya no tiene resultados.{" "}
              <Link href={enlaceCategoria(slug)}>Volver a la primera</Link>
            </>
          ) : (
            <>
              Todavía no hay cursos en esta categoría.{" "}
              <Link href="/buscar">Buscar en todo el catálogo</Link>
            </>
          )}
        </p>
      ) : (
        <>
          <ul className={styles.results}>
            {resultados.map((course, posicion) => (
              <li key={course.id} className={styles.card}>
                {course.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={course.imageUrl}
                    alt=""
                    className={styles.image}
                    {...DIMENSIONES_MINIATURA}
                    loading={cargaDeMiniatura(posicion)}
                    decoding="async"
                  />
                )}
                <div>
                  <h2>
                    <Link href={`/curso/${course.id}`}>{course.title}</Link>
                  </h2>
                  <p className={styles.meta}>
                    <span>{course.source}</span>
                    {course.priceAmount !== null && (
                      <span>
                        {" "}
                        · {course.priceAmount} {course.priceCurrency}
                      </span>
                    )}
                    {course.rating !== null && <span> · ⭐ {course.rating}</span>}
                    {formatDuration(course.duration) && (
                      <span> · ⏱ {formatDuration(course.duration)}</span>
                    )}
                    {course.language && <span> · {course.language}</span>}
                  </p>
                  {course.description && (
                    <p className={styles.description}>{course.description}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {/* Misma paginación que el buscador (HU-025): enlaces, para que cada
              página sea compartible y alcanzable sin JavaScript. */}
          <nav className={styles.paginacion} aria-label="Paginación de resultados">
            {pagina > 1 ? (
              <Link href={enlaceCategoria(slug, pagina - 1)} rel="prev">
                ← Anterior
              </Link>
            ) : (
              <span className={styles.paginaInactiva}>← Anterior</span>
            )}

            <span className={styles.paginaActual}>Página {pagina}</span>

            {hayMas ? (
              <Link href={enlaceCategoria(slug, pagina + 1)} rel="next">
                Siguiente →
              </Link>
            ) : (
              <span className={styles.paginaInactiva}>Siguiente →</span>
            )}
          </nav>
        </>
      )}
    </main>
  );
}
