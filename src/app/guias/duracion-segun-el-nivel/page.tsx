import type { Metadata } from "next";
import Link from "../../../components/enlace";
import { notFound } from "next/navigation";
import { cache } from "react";
import { createSupabaseServerClient } from "../../../lib/supabase/server-client";
import { serializeStructuredData } from "../../../lib/courses/course-seo";
import { conSeparadorDeMiles } from "../../../lib/formato-numero";
import {
  RUTA_GUIA_NIVEL,
  conclusiones,
  descripcionGuiaNivel,
  filasGuiaNivel,
  leerDuracionPorNivel,
  tituloGuiaNivel,
} from "../../../lib/courses/guia-nivel";
import { RUTA_GUIAS, tituloIndiceGuias } from "../../../lib/courses/guias";
import { OPEN_GRAPH_SITIO, migasDePan } from "../../../lib/seo/seo-sitio";
import legal from "../../legal.module.css";
import styles from "./page.module.css";

// Guía «cuánto dura un curso según su nivel» (HU-075). Las cifras se calculan
// al servir la página, como las otras guías: nada escrito a mano que se quede viejo.
const leer = cache(async () => leerDuracionPorNivel(createSupabaseServerClient()));

export async function generateMetadata(): Promise<Metadata> {
  const niveles = await leer();
  const descripcion = descripcionGuiaNivel(niveles);
  return {
    title: tituloGuiaNivel(),
    description: descripcion,
    alternates: { canonical: RUTA_GUIA_NIVEL },
    openGraph: { title: tituloGuiaNivel(), description: descripcion, ...OPEN_GRAPH_SITIO },
  };
}

export default async function GuiaDuracionPorNivel() {
  const niveles = await leer();
  // Sin datos no hay guía que enseñar: mejor un 404 que una tabla vacía.
  if (niveles.length === 0) notFound();

  const filas = filasGuiaNivel(niveles);

  return (
    <main className={legal.main}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeStructuredData(
            migasDePan([
              { nombre: "Inicio", ruta: "/" },
              { nombre: tituloIndiceGuias(), ruta: RUTA_GUIAS },
              { nombre: tituloGuiaNivel(), ruta: RUTA_GUIA_NIVEL },
            ])
          ),
        }}
      />
      <p className={legal.volver}>
        <Link href={RUTA_GUIAS}>← Guías</Link>
      </p>

      <h1>{tituloGuiaNivel()}</h1>
      <p>
        Cuánto dura de mediana un curso según el nivel que declara, con los cursos{" "}
        <strong>en español de Udemy</strong> del catálogo. Coursera no publica nivel en su
        catálogo, así que esta guía es solo de Udemy.
      </p>

      <h2>Duración por nivel</h2>
      <div className={styles.tabla} role="region" aria-label="Duración y valoración por nivel" tabIndex={0}>
        <table>
          <thead>
            <tr>
              <th scope="col">Nivel</th>
              <th scope="col">Cursos en español</th>
              <th scope="col">Duración mediana</th>
              <th scope="col">Con 50 reseñas o más</th>
              <th scope="col">Valoración media</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => (
              <tr key={fila.nivel}>
                <th scope="row">{fila.nivel}</th>
                <td>{conSeparadorDeMiles(fila.cursos)}</td>
                <td>{fila.duracion ?? "No lo publica"}</td>
                <td>{fila.respaldo}</td>
                <td>{fila.valoracion ?? "No lo publica"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Lo que dicen estas cifras</h2>
      {conclusiones(niveles).map((frase) => (
        <p key={frase}>{frase}</p>
      ))}

      <h2>De dónde salen</h2>
      <p>
        Del catálogo de Udemy en español, que se actualiza cada día, y se calculan al abrir esta
        página. El nivel es el que declara quien publica el curso, no una medida independiente de
        la dificultad real.
      </p>
      <p>
        <Link href="/buscar">Búscalo en el catálogo</Link> para ver los cursos de cada nivel.
      </p>
    </main>
  );
}
