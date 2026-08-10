import { createSupabaseServerClient } from "../../lib/supabase/server-client";
import { parseCourseSearchFilters, type RawSearchParams } from "../../lib/courses/search-filters";
import { searchCourses } from "../../lib/courses/search-courses";
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
        <ul className={styles.results}>
          {results.map((course) => (
            <li key={course.id} className={styles.card}>
              {course.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={course.imageUrl} alt="" className={styles.image} />
              )}
              <div>
                <h2>{course.title}</h2>
                <p className={styles.meta}>
                  <span>{course.source}</span>
                  {course.priceAmount !== null && (
                    <span>
                      {" "}
                      · {course.priceAmount} {course.priceCurrency}
                    </span>
                  )}
                  {course.rating !== null && <span> · ⭐ {course.rating}</span>}
                  {course.language && <span> · {course.language}</span>}
                </p>
                {course.description && (
                  <p className={styles.description}>{course.description}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
