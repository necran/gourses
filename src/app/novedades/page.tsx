import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { createSupabaseServerClient } from "../../lib/supabase/server-client";
import { parseCourseSearchFilters } from "../../lib/courses/search-filters";
import { formatDuration } from "../../lib/courses/duration";
import { DIMENSIONES_MINIATURA, cargaDeMiniatura } from "../../lib/imagenes";
import { nombrePlataforma } from "../../lib/courses/presentacion";
import {
  descripcionNovedades,
  enlaceNovedades,
  fechaLegible,
  leerNovedades,
  resumenNovedades,
  superaUmbralNovedades,
  textoNovedades,
  tituloNovedades,
} from "../../lib/courses/novedades";
import { serializeStructuredData } from "../../lib/courses/course-seo";
import { OPEN_GRAPH_SITIO, migasDePan } from "../../lib/seo/seo-sitio";
import styles from "./page.module.css";

interface NovedadesPageProps {
  searchParams: Promise<{ pagina?: string | string[] }>;
}

const POR_PAGINA = 50;

// Las novedades cambian con cada ingesta: se leen en cada petición, una vez
// para metadatos y página.
const leer = cache(async () => {
  const novedades = await leerNovedades(createSupabaseServerClient());
  return { novedades, resumen: resumenNovedades(novedades) };
});

async function paginaPedida(searchParams: NovedadesPageProps["searchParams"]): Promise<number> {
  return parseCourseSearchFilters({ pagina: (await searchParams).pagina }).pagina;
}

export async function generateMetadata({ searchParams }: NovedadesPageProps): Promise<Metadata> {
  const pagina = await paginaPedida(searchParams);
  const { resumen } = await leer();
  const descripcion = descripcionNovedades(resumen.total);

  return {
    title: tituloNovedades(),
    description: descripcion,
    alternates: { canonical: enlaceNovedades(pagina) },
    // Con pocas novedades la página responde igual, pero no se ofrece al índice
    // (mismo criterio que las páginas de tema, HU-058).
    ...(superaUmbralNovedades(resumen) ? {} : { robots: { index: false, follow: true } }),
    openGraph: { title: tituloNovedades(), description: descripcion, ...OPEN_GRAPH_SITIO },
  };
}

export default async function NovedadesPage({ searchParams }: NovedadesPageProps) {
  const pagina = await paginaPedida(searchParams);
  const { novedades, resumen } = await leer();

  const desde = (pagina - 1) * POR_PAGINA;
  const enEstaPagina = novedades.slice(desde, desde + POR_PAGINA);
  const hayMas = novedades.length > desde + POR_PAGINA;

  return (
    <main className={styles.main}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeStructuredData(
            migasDePan([
              { nombre: "Inicio", ruta: "/" },
              { nombre: tituloNovedades(), ruta: enlaceNovedades() },
            ])
          ),
        }}
      />
      <p className={styles.volver}>
        <Link href="/">← Inicio</Link>
      </p>

      <h1>{tituloNovedades()}</h1>
      <div className={styles.intro}>
        <p>{textoNovedades(resumen)}</p>
      </div>

      {enEstaPagina.length === 0 ? (
        <p role="status" className={styles.vacio}>
          {pagina > 1 ? (
            <>
              Esta página ya no tiene resultados.{" "}
              <Link href={enlaceNovedades()}>Volver a la primera</Link>
            </>
          ) : (
            <Link href="/buscar">Buscar en todo el catálogo</Link>
          )}
        </p>
      ) : (
        <>
          <ul className={styles.results}>
            {enEstaPagina.map((course, posicion) => (
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
                    <span className={styles.fecha}>
                      {course.source === "coursera" ? "Lanzado el " : "Publicado el "}
                      <time dateTime={course.publicadoEn}>{fechaLegible(course.publicadoEn)}</time>
                    </span>
                    <span> · {nombrePlataforma(course.source)}</span>
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
                  </p>
                  {course.description && (
                    <p className={styles.description}>{course.description}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <nav className={styles.paginacion} aria-label="Paginación de resultados">
            {pagina > 1 ? (
              <Link href={enlaceNovedades(pagina - 1)} rel="prev">
                ← Anterior
              </Link>
            ) : (
              <span className={styles.paginaInactiva}>← Anterior</span>
            )}

            <span className={styles.paginaActual}>Página {pagina}</span>

            {hayMas ? (
              <Link href={enlaceNovedades(pagina + 1)} rel="next">
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
