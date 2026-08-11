import Link from "next/link";
import { createSupabaseServerClient } from "../../lib/supabase/server-client";
import { parseCourseSearchFilters, type RawSearchParams } from "../../lib/courses/search-filters";
import { searchCourses } from "../../lib/courses/search-courses";
import { formatDuration } from "../../lib/courses/duration";
import { MAX_COMPARADOS } from "../../lib/courses/compare";
import styles from "./page.module.css";

interface BuscarPageProps {
  searchParams: Promise<RawSearchParams>;
}

export default async function BuscarPage({ searchParams }: BuscarPageProps) {
  const rawParams = await searchParams;
  const filters = parseCourseSearchFilters(rawParams);
  const client = createSupabaseServerClient();
  const results = await searchCourses(client, filters);

  return (
    <main className={styles.main}>
      <h1>Buscar cursos</h1>

      <form method="get" className={styles.form}>
        <input
          type="text"
          name="keyword"
          placeholder="Palabra clave"
          defaultValue={filters.keyword ?? ""}
          aria-label="Palabra clave"
        />
        <input
          type="number"
          name="maxPrice"
          placeholder="Precio máximo"
          min={0}
          step="0.01"
          defaultValue={filters.maxPrice ?? ""}
          aria-label="Precio máximo"
        />
        <input
          type="number"
          name="minRating"
          placeholder="Valoración mínima"
          min={0}
          max={5}
          step="0.1"
          defaultValue={filters.minRating ?? ""}
          aria-label="Valoración mínima"
        />
        <input
          type="text"
          name="language"
          placeholder="Idioma"
          defaultValue={filters.language ?? ""}
          aria-label="Idioma"
        />
        <button type="submit">Buscar</button>
      </form>

      {results.length === 0 ? (
        <p role="status">No se han encontrado cursos con esos criterios.</p>
      ) : (
        // Formulario aparte del de filtros (no se pueden anidar). Envía por GET
        // a /comparar, así que la comparación queda en la dirección y se puede
        // compartir, y funciona sin JavaScript de cliente (HU-017).
        <form method="get" action="/comparar">
        <div className={styles.barraComparar}>
          <button type="submit" className={styles.botonComparar}>
            Comparar seleccionados
          </button>
          <span className={styles.ayudaComparar}>
            Marca de 2 a {MAX_COMPARADOS} cursos
          </span>
        </div>
        <ul className={styles.results}>
          {results.map((course) => (
            <li key={course.id} className={styles.card}>
              <input
                type="checkbox"
                name="ids"
                value={course.id}
                className={styles.casilla}
                aria-label={`Seleccionar ${course.title} para comparar`}
              />
              {course.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={course.imageUrl} alt="" className={styles.image} />
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
        </form>
      )}
    </main>
  );
}
