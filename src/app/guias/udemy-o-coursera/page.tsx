import type { Metadata } from "next";
import Link from "../../../components/enlace";
import { notFound } from "next/navigation";
import { cache } from "react";
import { createSupabaseServerClient } from "../../../lib/supabase/server-client";
import { CATEGORY_LABELS } from "../../../lib/courses/categories";
import { enlaceCategoria } from "../../../lib/courses/categoria-seo";
import { serializeStructuredData, sourceLabel } from "../../../lib/courses/course-seo";
import { nombreTema } from "../../../lib/courses/temas";
import { enlaceTema } from "../../../lib/courses/temas-datos";
import { conSeparadorDeMiles } from "../../../lib/formato-numero";
import {
  RUTA_GUIA,
  categoriasDestacadas,
  descripcionGuia,
  filasGuia,
  leerGuia,
  seccionesGuia,
  temasDestacados,
  tituloGuia,
} from "../../../lib/courses/guia-plataformas";
import { OPEN_GRAPH_SITIO, migasDePan } from "../../../lib/seo/seo-sitio";
import legal from "../../legal.module.css";
import styles from "./page.module.css";

// Las cifras cambian con cada ingesta: se calculan al servir la página (HU-063),
// una sola vez para metadatos y contenido.
const leer = cache(async () => leerGuia(createSupabaseServerClient()));

export async function generateMetadata(): Promise<Metadata> {
  const { plataformas } = await leer();
  const descripcion = descripcionGuia(plataformas.get("udemy"), plataformas.get("coursera"));
  return {
    title: tituloGuia(),
    description: descripcion,
    alternates: { canonical: RUTA_GUIA },
    openGraph: { title: tituloGuia(), description: descripcion, ...OPEN_GRAPH_SITIO },
  };
}

export default async function GuiaUdemyOCoursera() {
  const { plataformas, categorias, temas, enlazables } = await leer();
  const udemy = plataformas.get("udemy");
  const coursera = plataformas.get("coursera");
  // Sin una de las dos no hay comparación que hacer.
  if (!udemy || !coursera) notFound();

  return (
    <main className={legal.main}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeStructuredData(
            migasDePan([
              { nombre: "Inicio", ruta: "/" },
              { nombre: tituloGuia(), ruta: RUTA_GUIA },
            ])
          ),
        }}
      />
      <p className={legal.volver}>
        <Link href="/">← Inicio</Link>
      </p>

      <h1>{tituloGuia()}</h1>
      <p>
        Tenemos los dos catálogos enteros, con los mismos datos de cada curso. En vez de opinar
        cuál conviene más, esta guía cuenta lo que dicen las cifras, para que decidas tú.
      </p>

      <h2>Las dos plataformas, cifra a cifra</h2>
      {/* Se desplaza en horizontal en el móvil; enfocable para poder hacerlo con el teclado. */}
      <div className={styles.tabla} role="region" aria-label="Comparación de Udemy y Coursera" tabIndex={0}>
        <table>
          <thead>
            <tr>
              <th scope="col">Dato</th>
              <th scope="col">Udemy</th>
              <th scope="col">Coursera</th>
            </tr>
          </thead>
          <tbody>
            {filasGuia(udemy, coursera).map((fila) => (
              <tr key={fila.etiqueta}>
                <th scope="row">{fila.etiqueta}</th>
                {[fila.udemy, fila.coursera].map((celda, i) => (
                  <td key={i} className={celda.publicado ? undefined : styles.noPublica}>
                    {celda.texto}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {seccionesGuia(udemy, coursera).map((seccion) => (
        <section key={seccion.titulo}>
          <h2>{seccion.titulo}</h2>
          {seccion.parrafos.map((parrafo) => (
            <p key={parrafo}>{parrafo}</p>
          ))}
        </section>
      ))}

      <h2>Dónde tiene más cursos cada una</h2>
      {[udemy, coursera].map((plataforma) => {
        const suyasCategorias = categoriasDestacadas(categorias, plataforma.source);
        const suyosTemas = temasDestacados(temas, plataforma.source, enlazables);
        return (
          <section key={plataforma.source} aria-labelledby={`donde-${plataforma.source}`}>
            <h3 id={`donde-${plataforma.source}`}>{sourceLabel(plataforma.source)}</h3>
            {suyasCategorias.length > 0 && (
              <>
                <p>Las categorías con más cursos:</p>
                <ul>
                  {suyasCategorias.map((c) => (
                    <li key={c.categoria}>
                      <Link href={enlaceCategoria(c.categoria)}>{CATEGORY_LABELS[c.categoria]}</Link>:{" "}
                      {conSeparadorDeMiles(c.cursos)} cursos
                    </li>
                  ))}
                </ul>
              </>
            )}
            {suyosTemas.length > 0 && (
              <>
                <p>Los temas con más cursos en español:</p>
                <ul>
                  {suyosTemas.map((t) => (
                    <li key={t.tema}>
                      <Link href={enlaceTema(t.tema)}>{nombreTema(t.tema)}</Link>:{" "}
                      {conSeparadorDeMiles(t.enEspanol)} en español
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        );
      })}

      <h2>De dónde salen estas cifras</h2>
      <p>
        Del catálogo que publican Udemy y Coursera, que se actualiza cada día, y se calculan al
        abrir esta página. Donde pone «No lo publica», la plataforma no incluye ese dato en su
        catálogo: no quiere decir que el curso no cueste nada ni que no tenga valoraciones.
      </p>
      <p>
        Para ver los cursos uno al lado del otro, <Link href="/buscar">busca en el catálogo</Link>.
      </p>
    </main>
  );
}
