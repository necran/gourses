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

  const datosEstructurados = courseStructuredData(course, `${TITULAR.url}/curso/${course.id}`);

  return (
    <main className={styles.main}>
      {/* Datos estructurados para que el buscador entienda que esto describe un
          curso concreto. Solo declara lo que se sabe (ver course-seo.ts). */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeStructuredData(datosEstructurados) }}
      />
      <p className={styles.volver}>
        <Link href="/buscar">← Volver a la búsqueda</Link>
      </p>

      <article>
        <header className={styles.cabecera}>
          {course.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={course.imageUrl} alt="" className={styles.imagen} />
          )}
          <div>
            <h1>{course.title}</h1>
            <p className={styles.fuente}>
              <span className={styles.etiqueta}>{course.source}</span>
              {course.category && <span> · {CATEGORY_LABELS[course.category]}</span>}
              {course.rating !== null && <span> · ⭐ {course.rating}</span>}
              {course.level && <span> · {course.level}</span>}
              {course.language && <span> · {course.language}</span>}
              {formatDuration(course.duration) && (
                <span> · ⏱ {formatDuration(course.duration)}</span>
              )}
            </p>
            {course.instructor && (
              <p className={styles.instructor}>Impartido por {course.instructor}</p>
            )}
          </div>
        </header>

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

          {enlace && (
            <div className={styles.acciones}>
              <a
                className={styles.boton}
                href={enlace}
                target="_blank"
                rel="noopener noreferrer nofollow sponsored"
              >
                Ver curso en {course.source}
              </a>
              {/* La divulgación va junto al enlace, no escondida en una página
                  legal: es donde la persona decide si pulsa (HU-013). */}
              <p className={styles.divulgacion}>
                Enlace de afiliado: podemos cobrar comisión, sin coste extra para ti.{" "}
                <Link href="/afiliacion">Más información</Link>
              </p>
            </div>
          )}
        </section>

        {course.description && (
          <section>
            <h2>Descripción</h2>
            <p className={styles.descripcion}>{course.description}</p>
          </section>
        )}
      </article>
    </main>
  );
}
