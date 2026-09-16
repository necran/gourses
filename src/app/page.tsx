import Link from "next/link";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "../lib/supabase/server-client";
import { getCatalogSummary } from "../lib/courses/catalog-summary";
import { CATEGORY_LABELS, COURSE_CATEGORIES } from "../lib/courses/categories";
import { enlaceCategoria } from "../lib/courses/categoria-seo";
import { searchCourses, type CourseSearchResult } from "../lib/courses/search-courses";
import { parseCourseSearchFilters } from "../lib/courses/search-filters";
import { preferredLanguageFrom } from "../lib/courses/preferred-language";
import { formatDuration } from "../lib/courses/duration";
import { nombreIdioma, nombrePlataforma } from "../lib/courses/presentacion";
import { DIMENSIONES_MINIATURA, cargaDeMiniatura } from "../lib/imagenes";
import { serializeStructuredData } from "../lib/courses/course-seo";
import { datosEstructuradosSitio } from "../lib/seo/seo-sitio";
import { nombreTema, type TemaId } from "../lib/courses/temas";
import { enlaceTema, leerResumenTemas, temasEnlazables } from "../lib/courses/temas-datos";
import { RUTA_GUIAS } from "../lib/courses/guias";
import {
  CATEGORIAS_EN_PORTADA,
  TEMAS_EN_PORTADA,
  primeros,
  quedanMas,
} from "../lib/courses/portada";
import {
  fechaLegible,
  leerUltimasNovedades,
  mostrarNovedadesEnPortada,
  type Novedad,
} from "../lib/courses/novedades";
import styles from "./page.module.css";

// Las cifras vienen de la base de datos en cada carga, así que la portada no
// puede prerenderizarse de una vez para siempre.
export const dynamic = "force-dynamic";

// Las once, no seis (HU-056): con seis, cinco páginas de categoría solo se
// descubrían por el sitemap, sin ningún enlace desde el propio sitio.
const CATEGORIAS_DESTACADAS = COURSE_CATEGORIES;

// Antes eran 6: se veían demasiado pocos para dar una idea real del
// catálogo. 12 sigue siendo una muestra —el catálogo completo, con
// paginación de verdad, vive en /buscar (HU-025)— pero llena la portada sin
// necesitar scroll infinito ni estado de cliente, que romperían el principio
// del sitio de que todo vive en la URL (HU-017).
const CURSOS_DESTACADOS = 12;

// Cuatro: una fila en escritorio con la misma rejilla que los destacados. La
// lista completa está en /novedades (HU-067).
const NOVEDADES_EN_PORTADA = 4;

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

  // HU-032: se prioriza sin filtrar, así que un fallo leyendo la cabecera no
  // debería poder darse, pero si algún día lo hiciera, más vale mostrar el
  // orden normal que tumbar la portada por esto.
  let idiomaPreferido: string | null = null;
  try {
    idiomaPreferido = preferredLanguageFrom((await headers()).get("accept-language"));
  } catch {
    idiomaPreferido = null;
  }

  // Sin filtros ni orden, searchCourses reparte a partes iguales entre
  // plataformas (HU-007): así la portada no enseña solo Udemy, que es la que
  // tiene valoración y ganaría cualquier otro orden.
  // Temas que superan el umbral (HU-060), para enlazar sus páginas. Como el
  // resumen del catálogo, es un añadido: si falla, la portada sale sin la sección.
  let temas: TemaId[] = [];
  try {
    temas = temasEnlazables(await leerResumenTemas(client));
  } catch {
    temas = [];
  }

  // HU-067. Como los temas: si falla, la portada sale sin la sección.
  let novedades: Novedad[] = [];
  try {
    novedades = await leerUltimasNovedades(client, NOVEDADES_EN_PORTADA);
  } catch {
    novedades = [];
  }

  let destacados: CourseSearchResult[] = [];
  try {
    const { resultados } = await searchCourses(
      client,
      parseCourseSearchFilters({}),
      CURSOS_DESTACADOS,
      idiomaPreferido
    );
    destacados = resultados;
  } catch {
    destacados = [];
  }

  return (
    <main className={styles.main}>
      {/* Qué es el sitio y su buscador, para los buscadores (HU-056). */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeStructuredData(datosEstructuradosSitio()) }}
      />
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
          {primeros(CATEGORIAS_DESTACADAS, CATEGORIAS_EN_PORTADA).map((categoria) => (
            <li key={categoria}>
              {/* A la página de la categoría, no al buscador con un filtro puesto
                  (HU-046): es una dirección con su propio título y descripción, que
                  es justo para lo que existe. Se enlaza por el identificador y no por
                  la etiqueta: buscar "Desarrollo" como texto no encuentra nada, porque
                  los títulos del catálogo están casi todos en inglés (HU-022). */}
              <Link href={enlaceCategoria(categoria)}>{CATEGORY_LABELS[categoria]}</Link>
            </li>
          ))}
        </ul>
        {/* HU-070: las demás no se pierden, están en el índice. */}
        {quedanMas(CATEGORIAS_DESTACADAS, CATEGORIAS_EN_PORTADA) && (
          <p className={styles.verNovedades}>
            <Link href="/categoria">Ver todas las categorías →</Link>
          </p>
        )}
        {/* Las guías tienen su propio enlace bajo los temas: aquí se apilaban
            tres líneas de enlaces seguidas y la portada se veía amontonada. */}
      </section>

      {temas.length > 0 && (
        <section className={styles.categorias} aria-labelledby="temas-populares">
          <h2 id="temas-populares">Temas populares</h2>
          <ul className={styles.listaCategorias}>
            {primeros(temas, TEMAS_EN_PORTADA).map((tema) => (
              <li key={tema}>
                <Link href={enlaceTema(tema)}>{nombreTema(tema)}</Link>
              </li>
            ))}
          </ul>
          {/* HU-070: el resto, en el índice de temas. */}
          {quedanMas(temas, TEMAS_EN_PORTADA) && (
            <p className={styles.verNovedades}>
              <Link href="/cursos">Ver todos los temas →</Link>
            </p>
          )}
          {/* El enlace de texto a las novedades que vivía aquí desde HU-059 sobra
              desde HU-067: la portada tiene su propia sección de novedades, con
              su «Ver todas». */}
        </section>
      )}

      {/* HU-067: lo último publicado en español, con su fecha. Va antes de los
          destacados porque es lo que cambia cada día. */}
      {mostrarNovedadesEnPortada(novedades) && (
        <section className={styles.destacados} aria-labelledby="novedades-portada">
          <div className={styles.destacadosCabecera}>
            <h2 id="novedades-portada">Novedades en español</h2>
            <Link href="/novedades" className={styles.verTodos}>
              Ver todas →
            </Link>
          </div>
          <ul className={styles.rejillaDestacados}>
            {novedades.map((course, posicion) => (
              <li key={course.id} className={styles.tarjetaDestacada}>
                {course.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={course.imageUrl}
                    alt=""
                    className={styles.miniatura}
                    {...DIMENSIONES_MINIATURA}
                    loading={cargaDeMiniatura(posicion)}
                    decoding="async"
                  />
                ) : (
                  <div className={styles.miniaturaVacia} aria-hidden="true">
                    <span>{course.source === "udemy" ? "U" : "C"}</span>
                  </div>
                )}
                <p className={styles.tarjetaCategoria}>{nombrePlataforma(course.source)}</p>
                <h3>
                  <Link href={`/curso/${course.id}`}>{course.title}</Link>
                </h3>
                <p className={styles.tarjetaMeta}>
                  {course.source === "coursera" ? "Lanzado el " : "Publicado el "}
                  <time dateTime={course.publicadoEn}>{fechaLegible(course.publicadoEn)}</time>
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {destacados.length > 0 && (
        <section className={styles.destacados}>
          <div className={styles.destacadosCabecera}>
            <h2>Cursos destacados</h2>
            <Link href="/buscar" className={styles.verTodos}>
              Ver todos →
            </Link>
          </div>
          <ul className={styles.rejillaDestacados}>
            {destacados.map((course, posicion) => (
              <li key={course.id} className={styles.tarjetaDestacada}>
                {course.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={course.imageUrl}
                    alt=""
                    className={styles.miniatura}
                    {...DIMENSIONES_MINIATURA}
                    loading={cargaDeMiniatura(posicion)}
                    decoding="async"
                  />
                ) : (
                  <div className={styles.miniaturaVacia} aria-hidden="true">
                    <span>{course.source === "udemy" ? "U" : "C"}</span>
                  </div>
                )}
                <p className={styles.tarjetaCategoria}>{nombrePlataforma(course.source)}</p>
                <h3>
                  <Link href={`/curso/${course.id}`}>{course.title}</Link>
                </h3>
                <p className={styles.tarjetaMeta}>
                  {[
                    course.rating !== null ? `⭐ ${course.rating}` : null,
                    formatDuration(course.duration) ? `⏱ ${formatDuration(course.duration)}` : null,
                    course.language ? nombreIdioma(course.language) : null,
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

          {/* Doce cursos son una muestra, no el catálogo: este botón deja
              claro que hay muchísimos más y lleva al buscador de verdad, con
              paginación (HU-025), en vez de dejar que alguien piense que
              esto es todo lo que hay. */}
          <p className={styles.verTodosDestacado}>
            <Link href="/buscar" className={styles.botonVerTodos}>
              Ver todo el catálogo →
            </Link>
          </p>
        </section>
      )}

      {/* Las guías, en su propio bloque. Colgaban de «Temas populares», y ahí se
          leían como si fueran parte de los temas, que no lo son. */}
      <p className={styles.verGuias}>
        <Link href={RUTA_GUIAS}>Guías con datos del catálogo →</Link>
      </p>

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
