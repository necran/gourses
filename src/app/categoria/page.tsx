import type { Metadata } from "next";
import Link from "../../components/enlace";
import { CATEGORY_LABELS, COURSE_CATEGORIES } from "../../lib/courses/categories";
import { enlaceCategoria } from "../../lib/courses/categoria-seo";
import { serializeStructuredData } from "../../lib/courses/course-seo";
import { OPEN_GRAPH_SITIO, migasDePan } from "../../lib/seo/seo-sitio";
import legal from "../legal.module.css";
import styles from "./page.module.css";

// Índice de categorías (HU-070). Existe para que la portada pueda enseñar solo
// unas pocas sin que las demás se queden sin enlace en el sitio, que es lo que
// arregló HU-056 poniéndolas todas en la portada.
//
// No lee la base de datos: la lista de categorías es del código.

export const RUTA_CATEGORIAS = "/categoria";
const TITULO = "Todas las categorías de cursos";
const DESCRIPCION =
  `Las ${COURSE_CATEGORIES.length} categorías del catálogo, con cursos de Udemy y Coursera en ` +
  "una sola lista: desarrollo, negocios, diseño, idiomas y el resto.";

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  alternates: { canonical: RUTA_CATEGORIAS },
  openGraph: { title: TITULO, description: DESCRIPCION, ...OPEN_GRAPH_SITIO },
};

export default function IndiceDeCategorias() {
  return (
    <main className={legal.main}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeStructuredData(
            migasDePan([
              { nombre: "Inicio", ruta: "/" },
              { nombre: TITULO, ruta: RUTA_CATEGORIAS },
            ])
          ),
        }}
      />
      <p className={legal.volver}>
        <Link href="/">← Inicio</Link>
      </p>

      <h1>{TITULO}</h1>
      <p>
        Cada categoría tiene su propia página, con los cursos de las dos plataformas juntos y
        los filtros de precio, valoración y duración.
      </p>

      <ul className={styles.lista}>
        {COURSE_CATEGORIES.map((categoria) => (
          <li key={categoria}>
            <Link href={enlaceCategoria(categoria)}>{CATEGORY_LABELS[categoria]}</Link>
          </li>
        ))}
      </ul>

      <p>
        También puedes <Link href="/cursos">ver los temas concretos</Link> —Python, Excel,
        fotografía— o <Link href="/buscar">buscar en todo el catálogo</Link>.
      </p>
    </main>
  );
}
