import Link from "next/link";
import { createSupabaseServerClient } from "../../lib/supabase/server-client";
import {
  ETIQUETAS_ORDEN,
  ORDENES,
  excluyePorFaltaDeDato,
  parseCourseSearchFilters,
  textoRecuento,
  type CourseSearchFilters,
  type RawSearchParams,
} from "../../lib/courses/search-filters";
import { searchCourses } from "../../lib/courses/search-courses";
import { formatDuration } from "../../lib/courses/duration";
import { MAX_COMPARADOS } from "../../lib/courses/compare";
import { CATEGORY_LABELS, COURSE_CATEGORIES } from "../../lib/courses/categories";
import styles from "./page.module.css";

// Nombra en el aviso solo lo que se está filtrando, para que no hable de
// valoraciones cuando solo se ha puesto un precio.
function textoDatoQueFalta(filters: CourseSearchFilters): string {
  if (filters.maxPrice !== null && filters.minRating !== null) return "precio o valoración";
  return filters.maxPrice !== null ? "precio" : "valoración";
}

interface BuscarPageProps {
  searchParams: Promise<RawSearchParams>;
}

// Construye la dirección de otra página conservando la búsqueda (HU-025).
//
// Se arma con los filtros **ya saneados**, no con lo que venía en la dirección:
// así un parámetro basura que alguien haya colado no se reenvía tal cual en los
// enlaces de la página.
function enlaceIncluyendoSinDato(filters: CourseSearchFilters): string {
  // Vuelve a la primera página: la búsqueda pasa a tener otros resultados, así
  // que seguir en la página 7 de la anterior no significa nada.
  return enlacePagina({ ...filters, incluirSinDato: true }, 1);
}

function enlacePagina(filters: CourseSearchFilters, pagina: number): string {
  const params = new URLSearchParams();
  if (filters.keyword) params.set("keyword", filters.keyword);
  if (filters.maxPrice !== null) params.set("maxPrice", String(filters.maxPrice));
  if (filters.minRating !== null) params.set("minRating", String(filters.minRating));
  if (filters.language) params.set("language", filters.language);
  if (filters.category) params.set("category", filters.category);
  if (filters.incluirSinDato) params.set("sinDato", "1");
  if (filters.orden) params.set("orden", filters.orden);
  if (pagina > 1) params.set("pagina", String(pagina));
  const query = params.toString();
  return query ? `/buscar?${query}` : "/buscar";
}

export default async function BuscarPage({ searchParams }: BuscarPageProps) {
  const rawParams = await searchParams;
  const filters = parseCourseSearchFilters(rawParams);
  const client = createSupabaseServerClient();
  const { resultados, pagina, hayMas, total } = await searchCourses(client, filters);

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
        {/* Va en el formulario para que se vea cuál está aplicada y se pueda
            quitar; si no, quien llega desde la portada no entiende por qué ve
            solo una parte del catálogo (HU-022). */}
        <select name="category" defaultValue={filters.category ?? ""} aria-label="Categoría">
          <option value="">Todas las categorías</option>
          {COURSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        {/* El orden va en el mismo formulario que los filtros: cambiarlo es
            otra búsqueda, y así vuelve sola a la página 1 al no mandarse
            `pagina` (HU-027). */}
        <select name="orden" defaultValue={filters.orden ?? ""} aria-label="Ordenar por">
          <option value="">Mezcla equilibrada</option>
          {ORDENES.map((o) => (
            <option key={o} value={o}>
              {ETIQUETAS_ORDEN[o]}
            </option>
          ))}
        </select>

        {/* Se conserva al volver a filtrar: si se perdiera, cambiar la palabra
            clave volvería a esconder medio catálogo sin avisar (HU-026). No va
            como casilla visible porque solo tiene sentido cuando hay un filtro
            que excluye, y entonces ya se ofrece en el aviso. */}
        {filters.incluirSinDato && <input type="hidden" name="sinDato" value="1" />}
        <button type="submit">Buscar</button>
      </form>

      {/* Solo cuando de verdad hay un filtro que descarta por falta de dato.
          Un aviso permanente es ruido y se deja de leer (HU-026). */}
      {excluyePorFaltaDeDato(filters) && (
        <p className={styles.avisoSinDato} role="status">
          Los cursos que no publican {textoDatoQueFalta(filters)} quedan fuera de esta
          búsqueda. Coursera no publica ni precios ni valoraciones, así que se queda
          fuera su catálogo entero.{" "}
          <Link href={enlaceIncluyendoSinDato(filters)}>Incluirlos de todos modos</Link>
        </p>
      )}

      {/* Antes de decidir si merece la pena mirar los resultados (HU-028). Sin
          condición: "0 resultados" es tan información como cualquier otro
          número, y textoRecuento ya dice "no se ha encontrado ninguno" en ese
          caso, así que no hace falta un mensaje aparte para la página 1. */}
      <p className={styles.recuento} role="status">
        {textoRecuento(total)}
      </p>

      {resultados.length === 0 ? (
        // Si total fuera 0 ya lo habría dicho el recuento de arriba: este caso
        // es total > 0 con una página más allá del final.
        pagina > 1 && (
          <p role="status">
            Esta página ya no tiene resultados.{" "}
            <Link href={enlacePagina(filters, 1)}>Volver a la primera</Link>
          </p>
        )
      ) : (
        // Formulario aparte del de filtros (no se pueden anidar). Envía por GET
        // a /comparar, así que la comparación queda en la dirección y se puede
        // compartir, y funciona sin JavaScript de cliente (HU-017).
        <>
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
          {resultados.map((course) => (
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

        {/* Enlaces, no botones: pasar de página es navegar, así que tiene que
            poder compartirse, abrirse en otra pestaña y funcionar sin
            JavaScript, igual que el resto del buscador (HU-025). Los extremos
            van como texto y no como enlace muerto. */}
        <nav className={styles.paginacion} aria-label="Paginación de resultados">
          {pagina > 1 ? (
            <Link href={enlacePagina(filters, pagina - 1)} rel="prev">
              ← Anterior
            </Link>
          ) : (
            <span className={styles.paginaInactiva}>← Anterior</span>
          )}

          <span className={styles.paginaActual}>Página {pagina}</span>

          {hayMas ? (
            <Link href={enlacePagina(filters, pagina + 1)} rel="next">
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
