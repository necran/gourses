import Link from "next/link";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "../../lib/supabase/server-client";
import { createSupabaseSessionClient } from "../../lib/supabase/session-client";
import {
  ETIQUETAS_ORDEN,
  ORDENES,
  excluyePorFaltaDeDato,
  parseCourseSearchFilters,
  textoDatoQueFalta,
  textoRecuento,
  type CourseSearchFilters,
  type RawSearchParams,
} from "../../lib/courses/search-filters";
import { searchCourses } from "../../lib/courses/search-courses";
import { preferredLanguageFrom } from "../../lib/courses/preferred-language";
import { formatDuration } from "../../lib/courses/duration";
import { isValidCourseId } from "../../lib/courses/get-course";
import { idsFavoritos } from "../../lib/favorites/favorites";
import { enlacePagina } from "../../lib/courses/buscar-enlaces";
import { CATEGORY_LABELS, COURSE_CATEGORIES } from "../../lib/courses/categories";
import { BarraComparar, CasillaComparar } from "../../components/barra-comparar";
import { alternarFavorito } from "../favoritos/actions";
import { RecordarBusqueda } from "./recordar-busqueda";
import styles from "./page.module.css";

interface BuscarPageProps {
  searchParams: Promise<RawSearchParams>;
}

function enlaceIncluyendoSinDato(filters: CourseSearchFilters): string {
  // Vuelve a la primera página: la búsqueda pasa a tener otros resultados, así
  // que seguir en la página 7 de la anterior no significa nada.
  return enlacePagina({ ...filters, incluirSinDato: true }, 1);
}

// HU-031: se llega aquí desde el botón de comparar de una ficha o de
// favoritos cuando no hay JavaScript (con JavaScript, ese botón añade a la
// cesta sin salir de la página, HU-041), y desde enlaces antiguos. Si no es un
// id válido se ignora sin más — no filtra ni cambia los resultados.
function preseleccionadoDesde(raw: string | string[] | undefined): string | null {
  const valor = Array.isArray(raw) ? raw[0] : raw;
  return valor && isValidCourseId(valor) ? valor : null;
}

// El corazón de HU-019, en pequeño: lleno cuando el curso está guardado.
function IconoCorazon({ guardado }: { guardado: boolean }) {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill={guardado ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

export default async function BuscarPage({ searchParams }: BuscarPageProps) {
  const rawParams = await searchParams;
  const filters = parseCourseSearchFilters(rawParams);
  const preseleccionado = preseleccionadoDesde(rawParams.preseleccionado);
  const client = createSupabaseServerClient();

  // HU-032: si falla la lectura de la cabecera, se busca igual sin priorizar
  // — es una preferencia de orden, no una condición de la que dependa poder
  // buscar.
  let idiomaPreferido: string | null = null;
  try {
    idiomaPreferido = preferredLanguageFrom((await headers()).get("accept-language"));
  } catch {
    idiomaPreferido = null;
  }

  const { resultados, pagina, hayMas, total } = await searchCourses(
    client,
    filters,
    undefined,
    idiomaPreferido
  );

  // HU-045: qué cursos de esta página están ya guardados. Solo con sesión: sin
  // ella no se pinta el botón (la ficha ya explica que hace falta entrar) y no
  // se paga la consulta.
  const sesion = await createSupabaseSessionClient();
  const {
    data: { user },
  } = await sesion.auth.getUser();
  const favoritos = user ? new Set(await idsFavoritos(sesion)) : null;

  return (
    <main className={styles.main}>
      <RecordarBusqueda href={enlacePagina(filters, pagina)} />
      <h1>Buscar cursos</h1>

      <form method="get" className={styles.form}>
        <div className={styles.campo}>
          <label htmlFor="f-keyword">Palabra clave</label>
          <input
            id="f-keyword"
            type="text"
            name="keyword"
            placeholder="¿Qué quieres aprender?"
            defaultValue={filters.keyword ?? ""}
          />
        </div>
        <div className={`${styles.campo} ${styles.campoEstrecho}`}>
          <label htmlFor="f-maxPrice">Precio máximo</label>
          <input
            id="f-maxPrice"
            type="number"
            name="maxPrice"
            min={0}
            step="0.01"
            defaultValue={filters.maxPrice ?? ""}
          />
        </div>
        <div className={`${styles.campo} ${styles.campoEstrecho}`}>
          <label htmlFor="f-minRating">Valoración mínima</label>
          <input
            id="f-minRating"
            type="number"
            name="minRating"
            min={0}
            max={5}
            step="0.1"
            placeholder="0–5"
            defaultValue={filters.minRating ?? ""}
          />
        </div>
        {/* En horas, que es como se piensa el tiempo disponible; por dentro
            son minutos (HU-048). Medio en medio: «hora y media» es una
            petición normal, «1,37 h» no. */}
        <div className={`${styles.campo} ${styles.campoEstrecho}`}>
          <label htmlFor="f-maxDuration">Duración máxima</label>
          <input
            id="f-maxDuration"
            type="number"
            name="maxDuration"
            min={0}
            step="0.5"
            placeholder="horas"
            defaultValue={filters.maxDuration !== null ? filters.maxDuration / 60 : ""}
          />
        </div>
        <div className={`${styles.campo} ${styles.campoEstrecho}`}>
          <label htmlFor="f-language">Idioma</label>
          <input
            id="f-language"
            type="text"
            name="language"
            placeholder="es, en…"
            defaultValue={filters.language ?? ""}
          />
        </div>
        {/* Va en el formulario para que se vea cuál está aplicada y se pueda
            quitar; si no, quien llega desde la portada no entiende por qué ve
            solo una parte del catálogo (HU-022). */}
        <div className={styles.campo}>
          <label htmlFor="f-category">Categoría</label>
          <select id="f-category" name="category" defaultValue={filters.category ?? ""}>
            <option value="">Todas las categorías</option>
            {COURSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        {/* El orden va en el mismo formulario que los filtros: cambiarlo es
            otra búsqueda, y así vuelve sola a la página 1 al no mandarse
            `pagina` (HU-027). */}
        <div className={styles.campo}>
          <label htmlFor="f-orden">Ordenar por</label>
          <select id="f-orden" name="orden" defaultValue={filters.orden ?? ""}>
            <option value="">Mezcla equilibrada</option>
            {ORDENES.map((o) => (
              <option key={o} value={o}>
                {ETIQUETAS_ORDEN[o]}
              </option>
            ))}
          </select>
        </div>

        {/* Se conserva al volver a filtrar: si se perdiera, cambiar la palabra
            clave volvería a esconder medio catálogo sin avisar (HU-026). No va
            como casilla visible porque solo tiene sentido cuando hay un filtro
            que excluye, y entonces ya se ofrece en el aviso. */}
        {filters.incluirSinDato && <input type="hidden" name="sinDato" value="1" />}
        <button type="submit" className={styles.botonBuscar}>
          Buscar
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        </button>
      </form>

      {/* Solo cuando de verdad hay un filtro que descarta por falta de dato.
          Un aviso permanente es ruido y se deja de leer (HU-026). */}
      {excluyePorFaltaDeDato(filters) && (
        <p className={styles.avisoSinDato} role="status">
          Los cursos que no publican {textoDatoQueFalta(filters)} quedan fuera de esta
          búsqueda.{" "}
          {/* Esta segunda frase solo es cierta del precio y la valoración: eso
              Coursera no lo publica nunca, y por eso su catálogo entero se cae
              de esas búsquedas (HU-026). Con el filtro de duración sería
              mentira — la publica en 1.819 de sus 4.000 cursos—, así que se
              dice solo cuando toca (HU-048). */}
          {(filters.maxPrice !== null || filters.minRating !== null) && (
            <>
              Coursera no publica ni precios ni valoraciones, así que se queda fuera su
              catálogo entero.{" "}
            </>
          )}
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
        {/* HU-045: el formulario de guardar vive **fuera** del de comparar,
            porque HTML no admite formularios anidados. Los botones de cada
            tarjeta lo referencian con `form=` y llevan el id del curso en su
            propio `value`, así que no hace falta ni un campo oculto ni
            JavaScript. Está vacío a propósito. */}
        {favoritos && <form id="guardar-favorito" action={alternarFavorito} />}
        <form method="get" action="/comparar">
        <BarraComparar />
        <ul className={styles.results}>
          {resultados.map((course) => {
            const guardado = favoritos?.has(course.id) ?? false;
            return (
            <li key={course.id} className={styles.card}>
              <CasillaComparar
                courseId={course.id}
                title={course.title}
                defaultChecked={course.id === preseleccionado}
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
              {favoritos && (
                <button
                  type="submit"
                  form="guardar-favorito"
                  name="courseId"
                  value={course.id}
                  className={`${styles.favorito} ${guardado ? styles.favoritoGuardado : ""}`}
                  aria-label={
                    guardado
                      ? `Quitar ${course.title} de favoritos`
                      : `Guardar ${course.title} en favoritos`
                  }
                >
                  <IconoCorazon guardado={guardado} />
                </button>
              )}
            </li>
            );
          })}
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
