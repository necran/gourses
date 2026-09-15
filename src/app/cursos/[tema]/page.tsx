import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { createSupabaseServerClient } from "../../../lib/supabase/server-client";
import { parseCourseSearchFilters } from "../../../lib/courses/search-filters";
import { formatDuration } from "../../../lib/courses/duration";
import { DIMENSIONES_MINIATURA, cargaDeMiniatura } from "../../../lib/imagenes";
import { nombreIdioma, nombrePlataforma } from "../../../lib/courses/presentacion";
import {
  esTema,
  nombreEnFrase,
  nombreTema,
  superaUmbral,
  type TemaId,
} from "../../../lib/courses/temas";
import {
  contarCursosDeTema,
  descripcionTema,
  enlaceTema,
  leerCursosDeTema,
  resumenTema,
  textoPresentacion,
  tituloTema,
} from "../../../lib/courses/temas-datos";
import { serializeStructuredData } from "../../../lib/courses/course-seo";
import { OPEN_GRAPH_SITIO, migasDePan } from "../../../lib/seo/seo-sitio";
import { conSeparadorDeMiles } from "../../../lib/formato-numero";
import styles from "./page.module.css";

interface TemaPageProps {
  params: Promise<{ tema: string }>;
  searchParams: Promise<{ pagina?: string | string[] }>;
}

const POR_PAGINA = 50;

// Metadatos y página necesitan los mismos datos: se leen una vez por petición.
const leerTema = cache(async (tema: TemaId) => {
  const client = createSupabaseServerClient();
  const [cursos, total] = await Promise.all([
    leerCursosDeTema(client, tema),
    contarCursosDeTema(client, tema),
  ]);
  return resumenYCursos(cursos, total);
});

function resumenYCursos(cursos: Awaited<ReturnType<typeof leerCursosDeTema>>, total: number) {
  return { cursos, resumen: resumenTema(cursos, total) };
}

async function paginaPedida(searchParams: TemaPageProps["searchParams"]): Promise<number> {
  return parseCourseSearchFilters({ pagina: (await searchParams).pagina }).pagina;
}

export async function generateMetadata({ params, searchParams }: TemaPageProps): Promise<Metadata> {
  const { tema } = await params;
  if (!esTema(tema)) return { title: "Tema no encontrado" };
  const pagina = await paginaPedida(searchParams);
  const { resumen } = await leerTema(tema);

  const descripcion = descripcionTema(tema, resumen.enEspanol);
  return {
    title: tituloTema(tema),
    description: descripcion,
    alternates: { canonical: enlaceTema(tema, pagina) },
    // Por debajo del umbral la página sigue respondiendo con sus cursos, pero no
    // se ofrece al índice: con pocos cursos sería la página fina que la historia
    // quiere evitar. No es un 404 porque el tema es válido y puede volver a
    // superar el umbral tras la ingesta de mañana (HU-058).
    ...(superaUmbral(resumen.recuento) ? {} : { robots: { index: false, follow: true } }),
    openGraph: { title: tituloTema(tema), description: descripcion, ...OPEN_GRAPH_SITIO },
  };
}

export default async function TemaPage({ params, searchParams }: TemaPageProps) {
  const { tema } = await params;
  // Solo temas de la lista cerrada: uno inventado no es una página de este sitio.
  if (!esTema(tema)) notFound();

  const pagina = await paginaPedida(searchParams);
  const { cursos, resumen } = await leerTema(tema);

  const desde = (pagina - 1) * POR_PAGINA;
  const enEstaPagina = cursos.slice(desde, desde + POR_PAGINA);
  const hayMas = cursos.length > desde + POR_PAGINA;

  // Los más reseñados, solo en la primera página: la forma honrada de responder a
  // «los mejores cursos de X» sin opinar. El listado ya viene en ese orden.
  const masResenados =
    pagina === 1 ? cursos.filter((c) => (c.numReviews ?? 0) > 0).slice(0, 3) : [];

  return (
    <main className={styles.main}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeStructuredData(
            migasDePan([
              { nombre: "Inicio", ruta: "/" },
              { nombre: tituloTema(tema), ruta: enlaceTema(tema) },
            ])
          ),
        }}
      />
      <p className={styles.volver}>
        <Link href="/">← Inicio</Link>
      </p>

      <h1>{tituloTema(tema)}</h1>
      <div className={styles.intro}>
        {textoPresentacion(tema, resumen).map((frase) => (
          <p key={frase}>{frase}</p>
        ))}
        <p>
          <Link href={`/buscar?keyword=${encodeURIComponent(nombreTema(tema))}`}>
            Buscar también en otros idiomas
          </Link>
        </p>
      </div>

      {masResenados.length === 3 && (
        <section className={styles.destacados} aria-labelledby="mas-resenados">
          <h2 id="mas-resenados">Los más reseñados</h2>
          <ol>
            {masResenados.map((c) => (
              <li key={c.id}>
                <Link href={`/curso/${c.id}`}>{c.title}</Link>
                <span className={styles.meta}>
                  {nombrePlataforma(c.source)} · {conSeparadorDeMiles(c.numReviews ?? 0)} reseñas
                  {c.rating !== null && ` · ⭐ ${c.rating}`}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {enEstaPagina.length === 0 ? (
        <p role="status" className={styles.vacio}>
          {pagina > 1 ? (
            <>
              Esta página ya no tiene resultados.{" "}
              <Link href={enlaceTema(tema)}>Volver a la primera</Link>
            </>
          ) : (
            <>
              Todavía no hay cursos de {nombreEnFrase(tema)} en español.{" "}
              <Link href="/buscar">Buscar en todo el catálogo</Link>
            </>
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
                    <span>{nombrePlataforma(course.source)}</span>
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
                    {course.language && <span> · {nombreIdioma(course.language)}</span>}
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
              <Link href={enlaceTema(tema, pagina - 1)} rel="prev">
                ← Anterior
              </Link>
            ) : (
              <span className={styles.paginaInactiva}>← Anterior</span>
            )}

            <span className={styles.paginaActual}>Página {pagina}</span>

            {hayMas ? (
              <Link href={enlaceTema(tema, pagina + 1)} rel="next">
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
