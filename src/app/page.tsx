import Link from "next/link";
import { createSupabaseServerClient } from "../lib/supabase/server-client";
import { getCatalogSummary } from "../lib/courses/catalog-summary";
import { CATEGORY_LABELS, COURSE_CATEGORIES } from "../lib/courses/categories";
import styles from "./page.module.css";

// Las cifras vienen de la base de datos en cada carga, así que la portada no
// puede prerenderizarse de una vez para siempre.
export const dynamic = "force-dynamic";

const CATEGORIAS_DESTACADAS = COURSE_CATEGORIES.slice(0, 6);

export default async function Home() {
  // Un fallo leyendo el resumen no debe tumbar la portada: es un dato
  // decorativo, no el contenido (HU-012).
  let resumen = null;
  try {
    resumen = await getCatalogSummary(createSupabaseServerClient());
  } catch {
    resumen = null;
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
              <Link href={`/buscar?keyword=${encodeURIComponent(CATEGORY_LABELS[categoria])}`}>
                {CATEGORY_LABELS[categoria]}
              </Link>
            </li>
          ))}
        </ul>
      </section>

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
