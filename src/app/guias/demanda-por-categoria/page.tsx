import type { Metadata } from "next";
import Link from "../../../components/enlace";
import { notFound } from "next/navigation";
import { cache } from "react";
import { createSupabaseServerClient } from "../../../lib/supabase/server-client";
import { enlaceCategoria } from "../../../lib/courses/categoria-seo";
import { serializeStructuredData } from "../../../lib/courses/course-seo";
import { conSeparadorDeMiles } from "../../../lib/formato-numero";
import {
  RUTA_GUIA_DEMANDA,
  conclusiones,
  descripcionGuiaDemanda,
  filasGuiaDemanda,
  leerDemandaPorCategoria,
  tituloGuiaDemanda,
} from "../../../lib/courses/guia-demanda";
import { RUTA_GUIAS, tituloIndiceGuias } from "../../../lib/courses/guias";
import { OPEN_GRAPH_SITIO, migasDePan } from "../../../lib/seo/seo-sitio";
import legal from "../../legal.module.css";
import styles from "./page.module.css";

// Guía «qué categoría tiene más demanda, por alumnos inscritos» (HU-076). Las
// cifras se calculan al servir la página, como las otras guías: nada escrito
// a mano que se quede viejo.
//
// `force-dynamic`: sin esto, Next intenta generar la página en build, donde no
// hay variables de entorno reales, y el build entero falla (HU-044).
export const dynamic = "force-dynamic";

const leer = cache(async () => leerDemandaPorCategoria(createSupabaseServerClient()));

export async function generateMetadata(): Promise<Metadata> {
  const categorias = await leer();
  const descripcion = descripcionGuiaDemanda(categorias);
  return {
    title: tituloGuiaDemanda(),
    description: descripcion,
    alternates: { canonical: RUTA_GUIA_DEMANDA },
    openGraph: { title: tituloGuiaDemanda(), description: descripcion, ...OPEN_GRAPH_SITIO },
  };
}

export default async function GuiaDemandaPorCategoria() {
  const categorias = await leer();
  // Sin datos no hay guía que enseñar: mejor un 404 que una tabla vacía.
  if (categorias.length === 0) notFound();

  const filas = filasGuiaDemanda(categorias);

  return (
    <main className={legal.main}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeStructuredData(
            migasDePan([
              { nombre: "Inicio", ruta: "/" },
              { nombre: tituloIndiceGuias(), ruta: RUTA_GUIAS },
              { nombre: tituloGuiaDemanda(), ruta: RUTA_GUIA_DEMANDA },
            ])
          ),
        }}
      />
      <p className={legal.volver}>
        <Link href={RUTA_GUIAS}>← Guías</Link>
      </p>

      <h1>{tituloGuiaDemanda()}</h1>
      <p>
        El número de cursos de una materia no es lo mismo que su demanda real. Esto compara
        cuántos alumnos tiene de mediana un curso según la materia, con los cursos{" "}
        <strong>en español de Udemy</strong> del catálogo. Coursera no publica el número de
        alumnos inscritos en su catálogo, así que esta guía es solo de Udemy.
      </p>

      <h2>Alumnos por curso, según la materia</h2>
      <div className={styles.tabla} role="region" aria-label="Alumnos inscritos por categoría" tabIndex={0}>
        <table>
          <thead>
            <tr>
              <th scope="col">Materia</th>
              <th scope="col">Cursos en español</th>
              <th scope="col">Alumnos por curso, mediana</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => (
              <tr key={fila.categoria}>
                <th scope="row">
                  <Link href={enlaceCategoria(fila.categoria)}>{fila.etiqueta}</Link>
                </th>
                <td>{conSeparadorDeMiles(fila.cursos)}</td>
                <td>{fila.alumnosMediana ?? "No lo publica"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Lo que dicen estas cifras</h2>
      {conclusiones(categorias).map((frase) => (
        <p key={frase}>{frase}</p>
      ))}

      <h2>De dónde salen</h2>
      <p>
        Del catálogo de Udemy en español, que se actualiza cada día, y se calculan al abrir
        esta página. Es la mediana, no la media, de los alumnos inscritos por curso: así un
        curso con muchísimos alumnos no maquilla el dato de toda la materia.
      </p>
      <p>
        <Link href="/buscar">Búscalo en el catálogo</Link> para ver los cursos de cada materia.
      </p>
    </main>
  );
}
