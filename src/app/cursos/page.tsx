import type { Metadata } from "next";
import Link from "../../components/enlace";
import { createSupabaseServerClient } from "../../lib/supabase/server-client";
import { CATEGORY_LABELS, COURSE_CATEGORIES } from "../../lib/courses/categories";
import { enlaceCategoria } from "../../lib/courses/categoria-seo";
import { serializeStructuredData } from "../../lib/courses/course-seo";
import { nombreTema, type TemaId } from "../../lib/courses/temas";
import { enlaceTema, leerResumenTemas, temasDeCategoria, temasEnlazables } from "../../lib/courses/temas-datos";
import { OPEN_GRAPH_SITIO, migasDePan } from "../../lib/seo/seo-sitio";
import legal from "../legal.module.css";
import styles from "./page.module.css";

// Índice de temas (HU-070). Como el de categorías, existe para que la portada
// pueda enseñar solo unos pocos sin que el resto pierda su enlace.
//
// Solo los temas enlazables (HU-060): los que no llegan al umbral se sirven con
// `noindex`, y enlazarlos desde aquí sería pedirle a Google que rastree algo que
// se le dice que no indexe.

export const RUTA_TEMAS = "/cursos";
const TITULO = "Todos los temas con cursos en español";
const DESCRIPCION =
  "Python, Excel, fotografía, marketing… los temas del catálogo que tienen cursos en español " +
  "suficientes, agrupados por categoría.";

// Los temas cambian con la ingesta, así que no se prerenderiza de una vez.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  alternates: { canonical: RUTA_TEMAS },
  openGraph: { title: TITULO, description: DESCRIPCION, ...OPEN_GRAPH_SITIO },
};

export default async function IndiceDeTemas() {
  let porCategoria: Array<{ categoria: (typeof COURSE_CATEGORIES)[number]; temas: TemaId[] }> = [];
  let sueltos: TemaId[] = [];
  let error = false;

  try {
    const resumen = await leerResumenTemas(createSupabaseServerClient());
    const enlazables = temasEnlazables(resumen);
    const deCategoria = new Set(enlazables);
    porCategoria = COURSE_CATEGORIES.map((categoria) => ({
      categoria,
      temas: temasDeCategoria(resumen, categoria).filter((t) => deCategoria.has(t)),
    })).filter((grupo) => grupo.temas.length > 0);

    // Un tema solo aparece arriba si tiene categoría dueña (HU-060). Los que no
    // la tengan irían a ningún sitio, y este índice promete tenerlos todos.
    const yaMostrados = new Set(porCategoria.flatMap((grupo) => grupo.temas));
    sueltos = enlazables.filter((tema) => !yaMostrados.has(tema));
  } catch {
    error = true;
  }

  return (
    <main className={legal.main}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeStructuredData(
            migasDePan([
              { nombre: "Inicio", ruta: "/" },
              { nombre: TITULO, ruta: RUTA_TEMAS },
            ])
          ),
        }}
      />
      <p className={legal.volver}>
        <Link href="/">← Inicio</Link>
      </p>

      <h1>{TITULO}</h1>
      <p>
        Un tema es algo concreto que se aprende —Python, Excel, fotografía—, y cada uno tiene su
        página con los cursos en español ordenados por cuántas personas los han valorado.
      </p>

      {error || porCategoria.length === 0 ? (
        <p role="status">
          No hemos podido cargar los temas ahora mismo. Puedes{" "}
          <Link href="/categoria">explorar por categoría</Link> o{" "}
          <Link href="/buscar">buscar en el catálogo</Link>.
        </p>
      ) : (
        <>
          {porCategoria.map((grupo) => (
            <section key={grupo.categoria} className={styles.grupo}>
              <h2>
                <Link href={enlaceCategoria(grupo.categoria)}>{CATEGORY_LABELS[grupo.categoria]}</Link>
              </h2>
              <ul className={styles.lista}>
                {grupo.temas.map((tema) => (
                  <li key={tema}>
                    <Link href={enlaceTema(tema)}>{nombreTema(tema)}</Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {sueltos.length > 0 && (
            <section className={styles.grupo}>
              <h2>Otros temas</h2>
              <ul className={styles.lista}>
                {sueltos.map((tema) => (
                  <li key={tema}>
                    <Link href={enlaceTema(tema)}>{nombreTema(tema)}</Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <p>
        ¿No está lo que buscas? <Link href="/buscar">Búscalo en todo el catálogo</Link>.
      </p>
    </main>
  );
}
