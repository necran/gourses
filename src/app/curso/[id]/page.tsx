import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "../../../lib/supabase/server-client";
import { getCourseById } from "../../../lib/courses/get-course";
import { resolvePriceDisplay } from "../../../lib/courses/price-display";
import { safeExternalUrl } from "../../../lib/courses/safe-external-url";
import { CATEGORY_LABELS } from "../../../lib/courses/categories";
import { formatDuration } from "../../../lib/courses/duration";
import {
  courseDescription,
  courseStructuredData,
  courseTitle,
  serializeStructuredData,
} from "../../../lib/courses/course-seo";
import { TITULAR } from "../../../lib/legal/titular";
import { BotonFavorito } from "../../../components/boton-favorito";
import { BotonCesta } from "../../../components/boton-cesta";
import { EnlaceUltimaBusqueda } from "../../../components/enlace-ultima-busqueda";
import { conSeparadorDeMiles } from "../../../lib/formato-numero";
import { nombreIdioma, nombrePlataforma } from "../../../lib/courses/presentacion";
import { enlaceCategoria, tituloCategoria } from "../../../lib/courses/categoria-seo";
import { esTema, nombreTema } from "../../../lib/courses/temas";
import { enlaceTema, leerResumenTemas, temasEnlazables } from "../../../lib/courses/temas-datos";
import { fechaLegible } from "../../../lib/courses/novedades";
import { migasDePan } from "../../../lib/seo/seo-sitio";
import styles from "./page.module.css";

interface CoursePageProps {
  params: Promise<{ id: string }>;
}

// Cada ficha lleva su propio título y descripción: son la puerta de entrada
// desde los buscadores y, si se repiten, Google no puede distinguirlas
// (HU-016). Si el curso no existe, se devuelven metadatos neutros porque la
// página resultante será la de "no encontrado".
export async function generateMetadata({ params }: CoursePageProps): Promise<Metadata> {
  const { id } = await params;
  const course = await getCourseById(createSupabaseServerClient(), id);

  if (!course) return { title: "Curso no encontrado" };

  return {
    title: courseTitle(course),
    description: courseDescription(course),
    alternates: { canonical: `/curso/${course.id}` },
    openGraph: {
      title: courseTitle(course),
      description: courseDescription(course),
      type: "article",
      images: course.imageUrl ? [course.imageUrl] : undefined,
    },
  };
}

function formatPrice(amount: number, currency: string | null): string {
  return currency ? `${amount} ${currency}` : String(amount);
}

export default async function CoursePage({ params }: CoursePageProps) {
  const { id } = await params;
  const client = createSupabaseServerClient();
  const course = await getCourseById(client, id);

  // Un id inválido o inexistente lleva a la página de "no encontrado" de Next,
  // nunca a un error sin manejar.
  if (!course) notFound();

  const price = resolvePriceDisplay(
    course.priceAmount,
    course.priceCurrency,
    course.priceHistory
  );
  const enlace = safeExternalUrl(course.affiliateUrl);

  // HU-060: los temas del curso que tienen página indexable. Solo se consulta si
  // el curso tiene alguno; y si la lectura falla, la ficha sale sin los enlaces.
  const temasDelCurso = course.temas.filter(esTema);
  const temasConPagina =
    temasDelCurso.length === 0
      ? []
      : await leerResumenTemas(client)
          .then((resumen) => temasEnlazables(resumen).filter((t) => temasDelCurso.includes(t)))
          .catch(() => []);

  const datosEstructurados = courseStructuredData(course, `${TITULAR.url}/curso/${course.id}`);

  return (
    <main className={styles.main}>
      {/* Datos estructurados para que el buscador entienda que esto describe un
          curso concreto. Solo declara lo que se sabe (ver course-seo.ts). */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeStructuredData(datosEstructurados) }}
      />
      {/* Migas de pan (HU-056): portada, su categoría si la tiene, y el curso. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeStructuredData(
            migasDePan([
              { nombre: "Inicio", ruta: "/" },
              ...(course.category
                ? [{ nombre: tituloCategoria(course.category), ruta: enlaceCategoria(course.category) }]
                : []),
              { nombre: course.title, ruta: `/curso/${course.id}` },
            ])
          ),
        }}
      />
      <p className={styles.volver}>
        <EnlaceUltimaBusqueda>← Volver a la búsqueda</EnlaceUltimaBusqueda>
      </p>

      <article>
        <header className={styles.cabecera}>
          {course.imageUrl && (
            // Es lo primero que se ve de la ficha: se pide de inmediato y con
            // prioridad, nunca diferida (HU-050). width/height reservan el hueco;
            // el tamaño en pantalla lo pone el CSS.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={course.imageUrl}
              alt=""
              className={styles.imagen}
              width={480}
              height={270}
              fetchPriority="high"
              decoding="async"
            />
          )}
          <div>
            <h1>{course.title}</h1>
            <p className={styles.fuente}>
              <span className={styles.etiqueta}>{nombrePlataforma(course.source)}</span>
              {course.category && <span> · {CATEGORY_LABELS[course.category]}</span>}
              {course.rating !== null && (
                <span>
                  {" "}
                  · ⭐ {course.rating}
                  {course.numReviews !== null && ` (${conSeparadorDeMiles(course.numReviews)} reseñas)`}
                </span>
              )}
              {course.level && <span> · {course.level}</span>}
              {course.language && <span> · {nombreIdioma(course.language)}</span>}
              {formatDuration(course.duration) && (
                <span> · ⏱ {formatDuration(course.duration)}</span>
              )}
            </p>
            {course.instructor && (
              <p className={styles.instructor}>
                Impartido por {course.instructor}
                {course.numSubscribers !== null &&
                  ` · ${conSeparadorDeMiles(course.numSubscribers)} alumnos`}
              </p>
            )}
            {/* HU-059: las fechas que publica la plataforma. Coursera solo da la de
                lanzamiento; Udemy, también la de última actualización. */}
            {course.publicadoEn && fechaLegible(course.publicadoEn) && (
              <p className={styles.instructor}>
                {course.source === "coursera" ? "Lanzado el " : "Publicado el "}
                <time dateTime={course.publicadoEn}>{fechaLegible(course.publicadoEn)}</time>
                {course.actualizadoEnPlataforma && fechaLegible(course.actualizadoEnPlataforma) && (
                  <>
                    {" · Actualizado el "}
                    <time dateTime={course.actualizadoEnPlataforma}>
                      {fechaLegible(course.actualizadoEnPlataforma)}
                    </time>
                  </>
                )}
              </p>
            )}
          </div>
        </header>

        {temasConPagina.length > 0 && (
          <nav className={styles.temas} aria-label="Más cursos de este tema">
            <span>Más cursos en español de:</span>
            <ul>
              {temasConPagina.map((tema) => (
                <li key={tema}>
                  <Link href={enlaceTema(tema)}>{nombreTema(tema)}</Link>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <section className={styles.compra}>
          <p className={styles.precio}>
            {price.amount === null ? (
              <span className={styles.sinPrecio}>Precio no disponible en esta plataforma</span>
            ) : (
              <>
                {price.previousAmount !== null && (
                  <s className={styles.precioAnterior}>
                    {formatPrice(price.previousAmount, price.currency)}
                  </s>
                )}{" "}
                <strong className={styles.precioActual}>
                  {formatPrice(price.amount, price.currency)}
                </strong>
              </>
            )}
          </p>

          {/* HU-055: ir al curso va justo después del precio, en el HTML y no
              solo a la vista, para que teclado y lector de pantalla sigan el
              mismo orden. Antes iba el último y en el móvil quedaba fuera de la
              primera pantalla. */}
          {enlace && (
            <div className={styles.acciones}>
              <a
                className={styles.boton}
                href={enlace}
                target="_blank"
                rel="noopener noreferrer nofollow sponsored"
              >
                Ver curso en {nombrePlataforma(course.source)}
              </a>
              {/* La divulgación va junto al enlace, no escondida en una página
                  legal: es donde la persona decide si pulsa (HU-013). */}
              <p className={styles.divulgacion}>
                Enlace de afiliado: podemos cobrar comisión, sin coste extra para ti.{" "}
                <Link href="/afiliacion">Más información</Link>
              </p>
            </div>
          )}

          <div className={styles.secundarias}>
            {/* Guardar no depende de que la plataforma tenga enlace de salida. */}
            <BotonFavorito courseId={course.id} />

            {/* HU-041: añadir o quitar de la cesta de comparación, sin salir de la
                ficha. Tampoco depende de si el curso tiene enlace de salida. */}
            <BotonCesta courseId={course.id} title={course.title} />
          </div>
        </section>

        {/* Marcado explícitamente como generado, y separado de la descripción
            real: nunca se mezclan como si fueran lo mismo (HU-030). Solo
            Udemy tiene resumen —Coursera queda fuera de alcance—, así que no
            hay que distinguir aquí de dónde viene: si existe, es de IA. */}
        {course.resumenIA && (
          <section className={styles.resumenIA}>
            <p>{course.resumenIA}</p>
            <p className={styles.resumenIAEtiqueta}>Resumen generado automáticamente</p>
          </section>
        )}

        {course.description && (
          <section>
            <h2>Descripción</h2>
            <p className={styles.descripcion}>{course.description}</p>
          </section>
        )}

        {/* Vienen de la misma llamada de detalle de Udemy que la descripción
            (HU-029). Coursera no tiene equivalente, así que en sus fichas
            estas dos secciones no aparecen — no es un hueco, es que la
            plataforma no publica esto. */}
        {course.whatYouWillLearn && (
          <section>
            <h2>Lo que aprenderás</h2>
            <ul className={styles.listaAprendizaje}>
              {course.whatYouWillLearn.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </section>
        )}

        {course.requirements && (
          <section>
            <h2>Requisitos</h2>
            <ul className={styles.listaAprendizaje}>
              {course.requirements.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </section>
        )}
      </article>
    </main>
  );
}
