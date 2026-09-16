import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { createSupabaseServerClient } from "../../../lib/supabase/server-client";
import { enlaceCategoria } from "../../../lib/courses/categoria-seo";
import { serializeStructuredData } from "../../../lib/courses/course-seo";
import { conSeparadorDeMiles } from "../../../lib/formato-numero";
import { RUTA_GUIA as RUTA_GUIA_PLATAFORMAS } from "../../../lib/courses/guia-plataformas";
import {
  RUTA_GUIA_PRECIOS,
  conclusiones,
  descripcionGuiaPrecios,
  filasGuiaPrecios,
  leerPreciosPorCategoria,
  tituloGuiaPrecios,
} from "../../../lib/courses/guia-precios";
import { RUTA_GUIAS, tituloIndiceGuias } from "../../../lib/courses/guias";
import { OPEN_GRAPH_SITIO, migasDePan } from "../../../lib/seo/seo-sitio";
import legal from "../../legal.module.css";
import styles from "./page.module.css";

// Guía «cuánto cuesta un curso» (HU-069). Las cifras se calculan al servir la
// página, como en la guía de plataformas: nada escrito a mano que se quede viejo.
const leer = cache(async () => leerPreciosPorCategoria(createSupabaseServerClient()));

export async function generateMetadata(): Promise<Metadata> {
  const categorias = await leer();
  const descripcion = descripcionGuiaPrecios(categorias);
  return {
    title: tituloGuiaPrecios(),
    description: descripcion,
    alternates: { canonical: RUTA_GUIA_PRECIOS },
    openGraph: { title: tituloGuiaPrecios(), description: descripcion, ...OPEN_GRAPH_SITIO },
  };
}

export default async function GuiaCuantoCuesta() {
  const categorias = await leer();
  // Sin datos no hay guía que enseñar: mejor un 404 que una tabla vacía.
  if (categorias.length === 0) notFound();

  const filas = filasGuiaPrecios(categorias);

  return (
    <main className={legal.main}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeStructuredData(
            migasDePan([
              { nombre: "Inicio", ruta: "/" },
              { nombre: tituloIndiceGuias(), ruta: RUTA_GUIAS },
              { nombre: tituloGuiaPrecios(), ruta: RUTA_GUIA_PRECIOS },
            ])
          ),
        }}
      />
      <p className={legal.volver}>
        <Link href={RUTA_GUIAS}>← Guías</Link>
      </p>

      <h1>{tituloGuiaPrecios()}</h1>
      <p>
        Precios y duraciones de los cursos <strong>en español</strong> del catálogo, por materia.
        Sirve para lo que cuesta saber por tu cuenta: si el precio que estás mirando es el
        normal en esa materia, y cuántas horas se suelen dar por él.
      </p>

      <h2>Qué se paga en cada materia</h2>
      <div className={styles.tabla} role="region" aria-label="Precios y duración por materia" tabIndex={0}>
        <table>
          <thead>
            <tr>
              <th scope="col">Materia</th>
              <th scope="col">Cursos en español</th>
              <th scope="col">Precio habitual</th>
              <th scope="col">Duración</th>
              <th scope="col">Con 50 reseñas o más</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => (
              <tr key={fila.categoria}>
                <th scope="row">
                  <Link href={enlaceCategoria(fila.categoria)}>{fila.etiqueta}</Link>
                </th>
                <td>{conSeparadorDeMiles(fila.cursos)}</td>
                {[fila.precio, fila.duracion, fila.respaldo].map((celda, i) => (
                  <td key={i} className={celda.publicado ? undefined : styles.sinDato}>
                    {celda.texto}
                  </td>
                ))}
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
        Del catálogo que publican Udemy y Coursera, que se actualiza cada día, y se calculan al
        abrir esta página. «No lo publica» quiere decir que esa plataforma no incluye el dato en
        su catálogo, no que el curso sea gratis: en español, las materias sin precio son cursos
        de Coursera, que no publica precios (lo cuenta la{" "}
        <Link href={RUTA_GUIA_PLATAFORMAS}>guía de las dos plataformas</Link>).
      </p>
      <p>
        El precio es el del catálogo el día que se consultó, y las plataformas lo cambian con
        promociones. <Link href="/buscar">Búscalo en el catálogo</Link> para ver el de hoy.
      </p>
    </main>
  );
}
