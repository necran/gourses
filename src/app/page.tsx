import Link from "next/link";
import { createSupabaseServerClient } from "../lib/supabase/server-client";
import { getCatalogSummary } from "../lib/courses/catalog-summary";
import { CATEGORY_LABELS, COURSE_CATEGORIES } from "../lib/courses/categories";
import { searchCourses, type CourseSearchResult } from "../lib/courses/search-courses";
import { parseCourseSearchFilters } from "../lib/courses/search-filters";
import { formatDuration } from "../lib/courses/duration";
import styles from "./page.module.css";

// Las cifras vienen de la base de datos en cada carga, así que la portada no
// puede prerenderizarse de una vez para siempre.
export const dynamic = "force-dynamic";

const CATEGORIAS_DESTACADAS = COURSE_CATEGORIES.slice(0, 6);

export default async function Home() {
  const client = createSupabaseServerClient();

  // Un fallo leyendo el resumen no debe tumbar la portada: es un dato
  // decorativo, no el contenido (HU-012).
  let resumen = null;
  try {
    resumen = await getCatalogSummary(client);
  } catch {
    resumen = null;
  }

  // Sin filtros ni orden, searchCourses reparte a partes iguales entre
  // plataformas (HU-007): así la portada no enseña solo Udemy, que es la que
  // tiene valoración y ganaría cualquier otro orden.
  let destacados: CourseSearchResult[] = [];
  try {
    const { resultados } = await searchCourses(client, parseCourseSearchFilters({}), 6);
    destacados = resultados;
  } catch {
    destacados = [];
  }

  return (
    <main className={styles.main}>
      <section className={styles.hero}>
        <h1>Compara cursos online de varias plataformas a la vez</h1>
        <p className={styles.subtitulo}>
          Buscamos en los catálogos de Udemy y Coursera y te los enseñamos juntos, con su
          precio, valoración, duración e idioma, para que no tengas que ir plataforma por
          plataforma.
        </p>

        <form action="/buscar" method="get" className={styles.buscador}>
          <input
            type="text"
            name="keyword"
            placeholder="¿Qué quieres aprender?"
            aria-label="¿Qué quieres aprender?"
            className={styles.campo}
          />
          <button type="submit" className={styles.boton}>
            Buscar cursos
          </button>
        </form>

        {resumen && (
          <p className={styles.cifras} data-testid="catalogo-cifras">
            <strong>{resumen.courseCount.toLocaleString("es-ES")}</strong> cursos de{" "}
            <strong>{resumen.sourceCount}</strong>{" "}
            {resumen.sourceCount === 1 ? "plataforma" : "plataformas"}
          </p>
        )}
      </section>

      <section className={styles.categorias}>
        <h2>Explora por categoría</h2>
        <ul className={styles.listaCategorias}>
          {CATEGORIAS_DESTACADAS.map((categoria) => (
            <li key={categoria}>
              {/* Se enlaza por el identificador de categoría, no por la etiqueta: buscar
                  "Desarrollo" como texto no encuentra nada, porque los títulos del
                  catálogo están casi todos en inglés (HU-022). */}
              <Link href={`/buscar?category=${categoria}`}>
                {CATEGORY_LABELS[categoria]}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {destacados.length > 0 && (
        <section className={styles.destacados}>
          <div className={styles.destacadosCabecera}>
            <h2>Cursos destacados</h2>
            <Link href="/buscar" className={styles.verTodos}>
              Ver todos →
            </Link>
          </div>
          <ul className={styles.rejillaDestacados}>
            {destacados.map((course) => (
              <li key={course.id} className={styles.tarjetaDestacada}>
                {course.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={course.imageUrl} alt="" className={styles.miniatura} />
                ) : (
                  <div className={styles.miniaturaVacia} aria-hidden="true">
                    <span>{course.source === "udemy" ? "U" : "C"}</span>
                  </div>
                )}
                <p className={styles.tarjetaCategoria}>{course.source}</p>
                <h3>
                  <Link href={`/curso/${course.id}`}>{course.title}</Link>
                </h3>
                <p className={styles.tarjetaMeta}>
                  {[
                    course.rating !== null ? `⭐ ${course.rating}` : null,
                    formatDuration(course.duration) ? `⏱ ${formatDuration(course.duration)}` : null,
                    course.language,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {course.priceAmount !== null ? (
                  <p className={styles.tarjetaPrecio}>
                    {course.priceAmount} {course.priceCurrency}
                  </p>
                ) : (
                  <p className={styles.tarjetaSinPrecio}>Precio no disponible en esta plataforma</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={styles.comoFunciona}>
        <h2>Cómo funciona</h2>
        <ol className={styles.pasos}>
          <li>
            <strong>Buscas una vez.</strong> Consultamos nuestro catálogo, no las webs de
            cada plataforma, así que los resultados salen al instante.
          </li>
          <li>
            <strong>Comparas de verdad.</strong> Los cursos de todas las plataformas se
            muestran con los mismos datos y el mismo formato.
          </li>
          <li>
            <strong>Compras donde siempre.</strong> El enlace te lleva al curso en su
            plataforma de origen; la matrícula y el pago los gestionan ellos.
          </li>
        </ol>
      </section>
    </main>
  );
}
