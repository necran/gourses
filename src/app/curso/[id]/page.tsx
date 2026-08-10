import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "../../../lib/supabase/server-client";
import { getCourseById } from "../../../lib/courses/get-course";
import { resolvePriceDisplay } from "../../../lib/courses/price-display";
import { safeExternalUrl } from "../../../lib/courses/safe-external-url";
import styles from "./page.module.css";

interface CoursePageProps {
  params: Promise<{ id: string }>;
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

  return (
    <main className={styles.main}>
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
              {course.rating !== null && <span> · ⭐ {course.rating}</span>}
              {course.level && <span> · {course.level}</span>}
              {course.language && <span> · {course.language}</span>}
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
            <a
              className={styles.boton}
              href={enlace}
              target="_blank"
              rel="noopener noreferrer nofollow sponsored"
            >
              Ver curso en {course.source}
            </a>
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
