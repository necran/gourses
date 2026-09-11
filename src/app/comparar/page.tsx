import type { Metadata } from "next";
import Link from "next/link";
import { createSupabaseServerClient } from "../../lib/supabase/server-client";
import { getCoursesByIds } from "../../lib/courses/get-course";
import {
  MIN_COMPARADOS,
  buildCompareRows,
  parseCompareIds,
} from "../../lib/courses/compare";
import { safeExternalUrl } from "../../lib/courses/safe-external-url";
import { sourceLabel } from "../../lib/courses/course-seo";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Comparar cursos",
  description:
    "Compara cursos de distintas plataformas campo a campo: precio, valoración, duración, nivel e idioma.",
  // Las comparaciones son combinaciones infinitas de cursos; no aportan nada
  // al índice de un buscador y diluirían las fichas, que sí importan (HU-016).
  robots: { index: false, follow: true },
};

interface CompararPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CompararPage({ searchParams }: CompararPageProps) {
  const params = await searchParams;
  const ids = parseCompareIds(params.ids);

  const cursos = ids.length > 0 ? await getCoursesByIds(createSupabaseServerClient(), ids) : [];
  const filas = buildCompareRows(cursos);

  if (cursos.length < MIN_COMPARADOS) {
    return (
      <main className={styles.main}>
        <p className={styles.volver}>
          <Link href="/buscar">← Volver a la búsqueda</Link>
        </p>
        <h1>Comparar cursos</h1>
        <p className={styles.aviso} role="status">
          {cursos.length === 0
            ? "No hay cursos que comparar. Vuelve al buscador, marca al menos dos y pulsa «Comparar»."
            : "Hace falta al menos un curso más. Vuelve al buscador y marca otro para poder compararlos."}
        </p>
      </main>
    );
  }

  return (
    <main className={styles.main}>
      <p className={styles.volver}>
        <Link href="/buscar">← Volver a la búsqueda</Link>
      </p>

      <h1>Comparar cursos</h1>
      <p className={styles.intro}>
        Los mismos datos para todos, vengan de la plataforma que vengan. Un hueco significa que
        esa plataforma no publica ese dato, no que el curso valga cero.
      </p>

      <div className={styles.tablaContenedor}>
        <table className={styles.tabla}>
          <caption className={styles.oculto}>
            Comparación de {cursos.length} cursos campo a campo
          </caption>
          <thead>
            <tr>
              <th scope="col" className={styles.esquina}>
                <span className={styles.oculto}>Campo</span>
              </th>
              {cursos.map((c) => (
                <th key={c.id} scope="col" className={styles.cabeceraCurso}>
                  <Link href={`/curso/${c.id}`}>{c.title}</Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => (
              <tr key={fila.etiqueta}>
                <th scope="row" className={styles.etiqueta}>
                  {fila.etiqueta}
                </th>
                {fila.celdas.map((celda, i) => (
                  <td key={cursos[i].id}>
                    {celda.valor ?? (
                      <span className={styles.sinDato}>No disponible</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <th scope="row" className={styles.etiqueta}>
                Ir al curso
              </th>
              {cursos.map((c) => {
                const enlace = safeExternalUrl(c.affiliateUrl);
                return (
                  <td key={c.id}>
                    {enlace ? (
                      <a
                        className={styles.boton}
                        href={enlace}
                        target="_blank"
                        rel="noopener noreferrer nofollow sponsored"
                      >
                        Ver en {sourceLabel(c.source)}
                      </a>
                    ) : (
                      <span className={styles.sinDato}>No disponible</span>
                    )}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Misma divulgación que en la ficha: va donde se decide pulsar. */}
      <p className={styles.divulgacion}>
        Los enlaces de salida pueden ser de afiliado: podemos cobrar comisión, sin coste extra
        para ti y sin que altere el orden ni el contenido de esta comparación.{" "}
        <Link href="/afiliacion">Más información</Link>
      </p>
    </main>
  );
}
